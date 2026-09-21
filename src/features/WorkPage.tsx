import { useState } from "react";
import {
  Link,
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import { Play, Repeat2, History, Eye, ArrowUpRight } from "lucide-react";
import {
  api,
  part,
  eligible,
  type Work,
  type Version,
  type List,
} from "../shared/api";
import {
  Header,
  Button,
  Loading,
  Empty,
  ErrorState,
  Notice,
  Sheet,
  useResource,
} from "../shared/ui";
import { useApp } from "../app/store";
import { Conversation } from "./Conversation";
import { GenerationDetails } from "./GenerationDetails";
import { Cover } from "./Feed";
import { Player } from "./Player";
import { CoverEditor } from "./CoverEditor";
import { Community } from "./Community";
export default function WorkPage({
  shared = false,
  preview = false,
}: {
  shared?: boolean;
  preview?: boolean;
}) {
  const { workId, slug } = useParams(),
    [params] = useSearchParams(),
    nav = useNavigate(),
    { session, toast, requireLogin } = useApp(),
    r = useResource(
      () =>
        api<{ work: Work }>(
          shared ? "public/works/" + part(slug!) : "works/" + part(workId!),
        ),
      [workId, slug],
    ),
    [play, setPlay] = useState(preview),
    [panel, setPanel] = useState(""),
    [versions, setVersions] = useState<Version[]>([]),
    [title, setTitle] = useState(""),
    [theme, setTheme] = useState(""),
    [busy, setBusy] = useState(false),
    [viewed, setViewed] = useState(false);
  const work = r.data?.work,
    owner = !!work && session.user?.username === work.creator,
    artifact = preview
      ? params.get("artifact") || work?.artifactId
      : work?.artifactId;
  const candidate = useResource(async () => {
    if (!preview || !owner || !artifact) return undefined;
    const v = await api<List<Version>>(`works/${part(work!.id)}/versions`);
    return v.data.find((v) => v.artifactId === artifact);
  }, [preview, owner, work?.id, artifact]);
  const canPublish = preview
    ? !candidate.loading && candidate.data?.verificationGrade === "verified"
    : work?.verificationGrade === "verified";
  async function mutate(action: string, body?: unknown) {
    setBusy(true);
    try {
      const v = await api<{ work: Work }>(
        `works/${part(work!.id)}/${action}`,
        "POST",
        body,
      );
      r.setData(v);
      setPanel("");
      toast(action === "publish" ? "作品已发布" : "公开链接已撤销");
      if (action === "publish") {
        sessionStorage.setItem("pulse.h5.feed-mode", "latest");
        sessionStorage.setItem("pulse.h5.feed-focus", work!.id);
        window.dispatchEvent(new Event("pulse:creation-reset"));
        nav("/");
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (r.loading) return <Loading />;
  if (r.error === "内容已失效或不可用")
    return (
      <Empty
        title="作品已不可用"
        action={
          <Link className="button primary" to="/">
            发现其他作品
          </Link>
        }
      >
        链接可能已被撤销，或作品已下架。
      </Empty>
    );
  if (r.error || !work)
    return <ErrorState message={r.error || "没有找到作品"} retry={r.reload} />;
  if (shared && !eligible(work))
    return <Notice>这个作品已不可公开访问。</Notice>;
  return (
    <div className="page work-page">
      <Header title={preview ? "私有预览" : "作品"} back={!shared}>
        <span className="muted small-text">
          {preview
            ? "仅自己可见"
            : work.status === "published"
              ? "公开作品"
              : "草稿"}
        </span>
      </Header>
      {play ? (
        <>
          <Player
            work={work}
            artifactId={artifact}
            onInteraction={() => setViewed(true)}
          />
          <Button className="wide" onClick={() => setPlay(false)}>
            退出游玩
          </Button>
        </>
      ) : (
        <div className="detail-cover">
          <Cover work={work} animate />
          <Button
            className="primary"
            onClick={() => {
              setPlay(true);
            }}
          >
            <Play size={18} />
            开始游玩
          </Button>
        </div>
      )}
      <h2>{work.title}</h2>
      <p className="byline">@{work.creator}</p>
      <p className="description">{work.theme || work.prompt}</p>
      {work.creationMode === "remix" ? (
        <p className="source-note">
          Remix · 原作者 @{work.originalCreator}
          {work.parentId ? (
            <Link to={"/works/" + part(work.parentId)}>
              查看原作
              <ArrowUpRight size={14} />
            </Link>
          ) : null}
        </p>
      ) : null}
      {!preview ? (
        <Community work={work} onUpdate={(w) => r.setData({ work: w })} />
      ) : null}
      {!owner && !preview ? (
        <button
          className="text-button"
          onClick={() => {
            if (requireLogin()) setPanel("block");
          }}
        >
          屏蔽这位作者
        </button>
      ) : null}
      {work.allowRemix && work.status === "published" ? (
        <Link className="button outline wide" to={"/remix/" + part(work.id)}>
          <Repeat2 size={18} />
          Remix 这个作品
        </Link>
      ) : null}
      {owner ? (
        <section className="owner-actions">
          <Button className="wide" onClick={() => setPanel("cover")}>
            {work.cover ? "更换或移除封面" : "设置封面"}
          </Button>
          <Link
            className="button wide"
            to={"/works/" + part(work.id) + "/edit"}
          >
            继续创作新版本
          </Link>
          <Button
            className="text-button wide"
            onClick={() => setPanel("conversation")}
          >
            查看创作对话
          </Button>
          {candidate.data?.generationId || work.generationJobId ? (
            <Button
              className="text-button wide"
              onClick={() => setPanel("generation-details")}
            >
              方案与验收
            </Button>
          ) : null}
          <Button
            className="wide"
            onClick={async () => {
              try {
                const v = await api<List<Version>>(
                  `works/${part(work.id)}/versions`,
                );
                setVersions(v.data);
                setPanel("versions");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <History size={18} />
            版本历史
          </Button>
          {artifact && canPublish ? (
            <Button
              className="primary wide"
              onClick={() => {
                setTitle(work.title);
                setTheme(work.theme);
                setPanel("publish");
              }}
            >
              发布这个版本
            </Button>
          ) : null}
          {preview && !canPublish ? (
            <Notice>
              {candidate.error ||
                "这个版本尚未通过发布验收，可以继续修改后再试。"}
            </Notice>
          ) : null}
          {work.status === "published" ? (
            <Button
              className="text-button wide"
              onClick={() => setPanel("unpublish")}
            >
              撤销公开链接
            </Button>
          ) : null}
          <Link className="text-button wide" to="/create">
            新建原创作品
          </Link>
          <label className="toggle-row">
            <span>允许其他人 Remix</span>
            <input
              type="checkbox"
              checked={work.allowRemix}
              onChange={async (e) => {
                try {
                  const v = await api<{ work: Work }>(
                    `works/${part(work.id)}/remix-permission`,
                    "PATCH",
                    { allowRemix: e.target.checked },
                  );
                  r.setData(v);
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            />
          </label>
        </section>
      ) : null}
      {panel === "cover" ? (
        <CoverEditor
          work={work}
          onSave={(w) => r.setData({ work: w })}
          onClose={() => setPanel("")}
        />
      ) : null}
      {panel === "conversation" ? (
        <Conversation workId={work.id} onClose={() => setPanel("")} />
      ) : panel === "generation-details" &&
        (candidate.data?.generationId || work.generationJobId) ? (
        <GenerationDetails
          jobId={(candidate.data?.generationId || work.generationJobId)!}
          onClose={() => setPanel("")}
        />
      ) : null}
      {panel === "block" ? (
        <Sheet title="屏蔽这位作者？" onClose={() => setPanel("")}>
          <p>首页将不再显示 @{work.creator} 的作品，可在设置中解除。</p>
          <Button
            className="primary wide"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`users/${part(work.creator)}/block`, "POST", {});
                nav("/");
                toast("已屏蔽作者");
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            确认屏蔽
          </Button>
        </Sheet>
      ) : panel === "publish" ? (
        <Sheet title="发布作品" onClose={() => setPanel("")}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void mutate("publish", { title, theme, artifactId: artifact });
            }}
          >
            <label>
              作品名称
              <input
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label>
              玩法说明
              <textarea
                maxLength={120}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                required
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={viewed}
                onChange={(e) => setViewed(e.target.checked)}
              />
              我已试玩并确认这个版本可以正常交互
            </label>
            <p className="muted">
              发布后其他人可以游玩和分享。素材随作品交付；审核与公开状态以服务端为准。
            </p>
            <Button className="primary wide" busy={busy} disabled={!viewed}>
              确认发布
            </Button>
          </form>
        </Sheet>
      ) : panel === "unpublish" ? (
        <Sheet title="撤销公开链接？" onClose={() => setPanel("")}>
          <p>作品保留在草稿中，其他人将无法通过公开链接访问。</p>
          <Button
            className="primary wide"
            busy={busy}
            onClick={() => mutate("unpublish")}
          >
            确认撤销
          </Button>
        </Sheet>
      ) : panel === "versions" ? (
        <Sheet title="版本历史" onClose={() => setPanel("")}>
          {versions.length ? (
            versions.map((v) => (
              <div className="version-row" key={v.generationId}>
                <div>
                  <strong>
                    版本 {v.version}{" "}
                    {v.isPublished
                      ? "· 已发布"
                      : v.isCurrent
                        ? "· 当前候选"
                        : ""}
                  </strong>
                  <small>
                    {v.stage} · {new Date(v.createdAt).toLocaleString("zh-CN")}
                  </small>
                </div>
                {v.artifactId ? (
                  <Link
                    replace
                    className="icon-button"
                    aria-label={`预览版本 ${v.version}`}
                    to={`/works/${part(work.id)}/preview?artifact=${part(v.artifactId)}`}
                    onClick={() => {
                      setPanel("");
                      setPlay(true);
                    }}
                  >
                    <Eye size={20} />
                  </Link>
                ) : (
                  <Link to={"/generations/" + part(v.generationId)}>详情</Link>
                )}
              </div>
            ))
          ) : (
            <p>还没有生成版本。</p>
          )}
        </Sheet>
      ) : null}
    </div>
  );
}
