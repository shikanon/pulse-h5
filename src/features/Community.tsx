import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Flag,
  Repeat2,
  MoreHorizontal,
} from "lucide-react";
import { api, part, type List, type Work } from "../shared/api";
import { Button, Sheet, Notice, Loading, useResource } from "../shared/ui";
import { useApp } from "../app/store";
type Comment = {
  id: string;
  author: string;
  body: string;
  score: number;
  createdAt: string;
};
export function Community({
  work,
  onUpdate,
  compact = false,
}: {
  work: Work;
  onUpdate: (w: Work) => void;
  compact?: boolean;
}) {
  const { requireLogin, session, toast } = useApp(),
    [panel, setPanel] = useState(() => {
      const key = "pulse.h5.resume-comments:" + work.id;
      if (sessionStorage.getItem(key)) return "comments";
      return "";
    }),
    [busy, setBusy] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    sessionStorage.removeItem("pulse.h5.resume-comments:" + work.id);
    let active = true;
    if (session.user)
      api<List<Work>>("me/saved")
        .then((r) => {
          if (active) setSaved(r.data.some((w) => w.id === work.id));
        })
        .catch(() => {});
    else setSaved(false);
    return () => {
      active = false;
    };
  }, [work.id, session.user?.id]);
  async function like() {
    if (!session.user)
      sessionStorage.setItem(
        "pulse.h5.intent",
        JSON.stringify({
          kind: "like",
          workId: work.id,
          returnTo: location.pathname,
        }),
      );
    if (!requireLogin()) return;
    setBusy("like");
    try {
      const r = await api<{ work: Work }>(
        `works/${part(work.id)}/like`,
        work.viewerHasLiked ? "DELETE" : "PUT",
      );
      onUpdate({ ...work, ...r.work });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function save() {
    if (!session.user)
      sessionStorage.setItem(
        "pulse.h5.intent",
        JSON.stringify({
          kind: "save",
          workId: work.id,
          returnTo: location.pathname,
        }),
      );
    if (!requireLogin()) return;
    setBusy("save");
    try {
      await api(`works/${part(work.id)}/save`, saved ? "DELETE" : "PUT");
      setSaved(!saved);
      toast(saved ? "已取消收藏" : "已收藏，可在个人中心查看");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function share() {
    if (!work.publicSlug) {
      toast("作品发布后即可分享");
      return;
    }
    const url = new URL("/a/" + part(work.publicSlug), location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: work.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("作品链接已复制");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        toast("复制失败，请从浏览器地址栏分享");
    }
  }
  return (
    <>
      <div className={"social " + (compact ? "compact-social" : "")}>
        <button
          disabled={!!busy}
          aria-label="点赞"
          aria-pressed={work.viewerHasLiked}
          onClick={like}
        >
          <Heart fill={work.viewerHasLiked ? "currentColor" : "none"} />
          <span>{work.likes || 0}</span>
        </button>
        <button aria-label="评论" onClick={() => setPanel("comments")}>
          <MessageCircle />
          <span>{work.comments || 0}</span>
        </button>
        {compact ? (
          work.allowRemix ? (
            <Link
              aria-label="Remix 这个作品"
              to={"/remix/" + part(work.id)}
              className="remix-action"
            >
              <Repeat2 />
              <span>Remix</span>
            </Link>
          ) : (
            <button disabled aria-label="作者未开放 Remix">
              <Repeat2 />
              <span>未开放</span>
            </button>
          )
        ) : null}
        <button
          disabled={!!busy}
          aria-label="收藏"
          aria-pressed={saved}
          onClick={save}
        >
          <Bookmark fill={saved ? "currentColor" : "none"} />
        </button>
        <button aria-label="分享" onClick={share}>
          <Share2 />
        </button>
        <button
          className={compact ? "feed-safety" : ""}
          aria-label={compact ? "安全选项" : "举报"}
          onClick={() => {
            if (compact) setPanel("safety");
            else if (requireLogin()) setPanel("report");
          }}
        >
          {compact ? <MoreHorizontal size={20} /> : <Flag size={18} />}
        </button>
      </div>
      {panel === "safety" ? (
        <Sheet title="安全选项" onClose={() => setPanel("")}>
          <Button
            className="wide"
            onClick={() => {
              if (requireLogin()) setPanel("report");
            }}
          >
            举报作品
          </Button>
          {session.user?.username !== work.creator ? (
            <Button
              className="wide"
              onClick={() => {
                if (requireLogin()) setPanel("block");
              }}
            >
              屏蔽 @{work.creator}
            </Button>
          ) : null}
          <Button className="wide" onClick={() => setPanel("guidelines")}>
            社区规范
          </Button>
        </Sheet>
      ) : panel === "block" ? (
        <Sheet title="屏蔽这位作者？" onClose={() => setPanel("")}>
          <p>其作品与评论将从你的内容中移除，可在设置中解除。</p>
          <Button
            className="primary wide"
            busy={!!busy}
            onClick={async () => {
              setBusy("block");
              try {
                await api(`users/${part(work.creator)}/block`, "POST", {});
                setPanel("");
                window.dispatchEvent(new Event("pulse:feed-refresh"));
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
          >
            确认屏蔽
          </Button>
        </Sheet>
      ) : panel === "guidelines" ? (
        <Sheet title="社区规范" onClose={() => setPanel("")}>
          <p>
            尊重他人和原创内容。请勿发布骚扰、仇恨、色情、欺诈或侵犯隐私的内容。发现问题可举报，也可屏蔽相关作者。
          </p>
        </Sheet>
      ) : null}
      {panel === "comments" ? (
        <Comments
          work={work}
          onClose={() => setPanel("")}
          onAdded={(delta) =>
            onUpdate({ ...work, comments: Math.max(0, work.comments + delta) })
          }
        />
      ) : panel === "report" ? (
        <Report work={work} onClose={() => setPanel("")} />
      ) : null}
    </>
  );
}
function Comments({
  work,
  onClose,
  onAdded,
}: {
  work: Work;
  onClose: () => void;
  onAdded: (delta: number) => void;
}) {
  const { requireLogin, session, toast } = useApp(),
    [body, setBody] = useState(
      () => sessionStorage.getItem("pulse.h5.comment:" + work.id) || "",
    ),
    [busy, setBusy] = useState(false),
    [rating, setRating] = useState(() =>
      Number(sessionStorage.getItem("pulse.h5.comment-rating:" + work.id) || 5),
    ),
    submission = useRef({ body: "", score: 0, key: "" }),
    [reported, setReported] = useState<Comment>(),
    [deleting, setDeleting] = useState<Comment>(),
    [cursor, setCursor] = useState<string>(),
    [more, setMore] = useState<Comment[]>([]);
  const r = useResource(
    () => api<List<Comment>>(`works/${part(work.id)}/comments?limit=30`),
    [work.id],
  );
  async function submit() {
    if (!session.user) {
      sessionStorage.setItem("pulse.h5.comment:" + work.id, body);
      sessionStorage.setItem(
        "pulse.h5.comment-rating:" + work.id,
        String(rating),
      );
      sessionStorage.setItem("pulse.h5.resume-comments:" + work.id, "true");
    }
    if (!requireLogin()) return;
    setBusy(true);
    try {
      if (
        submission.current.body !== body ||
        submission.current.score !== rating
      )
        submission.current = { body, score: rating, key: crypto.randomUUID() };
      await api(
        `works/${part(work.id)}/comments`,
        "POST",
        { body, score: rating },
        submission.current.key,
      );
      setBody("");
      sessionStorage.removeItem("pulse.h5.comment:" + work.id);
      sessionStorage.removeItem("pulse.h5.comment-rating:" + work.id);
      submission.current = { body: "", score: 0, key: "" };
      setMore([]);
      setCursor(undefined);
      r.reload();
      onAdded(1);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="评论" onClose={onClose}>
      <div className="comments">
        {r.loading ? (
          <Loading />
        ) : r.error ? (
          <Notice>{r.error}</Notice>
        ) : (
          [...(r.data?.data || []), ...more].map((c) => (
            <article key={c.id}>
              <div className="avatar small">{c.author[0]?.toUpperCase()}</div>
              <div>
                <strong>@{c.author}</strong>
                <small className="comment-rating">
                  {"★".repeat(c.score)}
                  {"☆".repeat(5 - c.score)}
                </small>
                <p>{c.body}</p>
              </div>
              {c.author === session.user?.username ? (
                <button className="text-button" onClick={() => setDeleting(c)}>
                  删除
                </button>
              ) : (
                <button
                  className="text-button"
                  aria-label={"举报评论：" + c.body}
                  onClick={() => {
                    if (requireLogin()) setReported(c);
                  }}
                >
                  举报
                </button>
              )}
            </article>
          ))
        )}
        {!r.loading && !r.data?.data.length ? (
          <p className="muted">留下第一条感想吧。</p>
        ) : null}
        {(cursor === undefined ? r.data?.nextCursor : cursor) ? (
          <Button
            onClick={async () => {
              try {
                const page = await api<List<Comment>>(
                  `works/${part(work.id)}/comments?cursor=${part(cursor || r.data!.nextCursor!)}`,
                );
                setMore((a) => [...a, ...page.data]);
                setCursor(page.nextCursor || "");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            更多评论
          </Button>
        ) : null}
      </div>
      <label className="rating-picker">
        评分
        <select
          aria-label="评分"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} 星
            </option>
          ))}
        </select>
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="comment-form"
      >
        <input
          aria-label="评论内容"
          maxLength={500}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="说说你的感受…"
        />
        <Button
          type="submit"
          className="primary"
          busy={busy}
          disabled={!body.trim()}
        >
          发送
        </Button>
      </form>
      {deleting ? (
        <Sheet
          title="删除这条评论？"
          onClose={() => {
            if (!busy) setDeleting(undefined);
          }}
        >
          <p>评论删除后无法恢复。</p>
          <p className="muted">{deleting.body}</p>
          <Button
            className="wide"
            disabled={busy}
            onClick={() => setDeleting(undefined)}
          >
            取消
          </Button>
          <Button
            className="primary wide"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(
                  `works/${part(work.id)}/comments/${part(deleting.id)}`,
                  "DELETE",
                );
                setDeleting(undefined);
                setMore([]);
                setCursor(undefined);
                r.reload();
                onAdded(-1);
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            确认删除
          </Button>
        </Sheet>
      ) : null}
      {reported ? (
        <Report
          work={work}
          comment={reported}
          onClose={() => setReported(undefined)}
        />
      ) : null}
    </Sheet>
  );
}
function Report({
  work,
  onClose,
  comment,
}: {
  work: Work;
  onClose: () => void;
  comment?: Comment;
}) {
  const [reason, setReason] = useState("不适宜内容"),
    [details, setDetails] = useState(""),
    [busy, setBusy] = useState(false),
    { toast } = useApp();
  return (
    <Sheet title={comment ? "举报评论" : "举报作品"} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(
              "reports",
              "POST",
              {
                targetType: comment ? "comment" : "work",
                targetId: comment?.id || work.id,
                reason,
                details,
              },
              crypto.randomUUID(),
            );
            toast("举报已提交，可在设置中查看处理状态");
            onClose();
          } catch (e) {
            toast((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          原因
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {[
              "不适宜内容",
              "侵犯版权",
              "骚扰或仇恨",
              "误导与欺诈",
              "其他问题",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          补充说明
          <textarea
            value={details}
            maxLength={2000}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        <Button className="primary" busy={busy}>
          提交举报
        </Button>
      </form>
    </Sheet>
  );
}
