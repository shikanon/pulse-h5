import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Settings,
  History,
  Bookmark,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { api, part, type Work, type List, type Version } from "../shared/api";
import {
  Header,
  Loading,
  Empty,
  ErrorState,
  Sheet,
  Button,
  useResource,
} from "../shared/ui";
import { useApp } from "../app/store";
import { Cover } from "./Feed";
import {
  workFilters,
  includesWork,
  lifecycle,
  reviewLabel,
  type WorkFilter,
} from "../shared/workPresentation";
export default function Profile({
  collection = false,
}: {
  collection?: boolean;
}) {
  const { session, toast } = useApp();
  const nav = useNavigate();
  const [filter, setFilter] = useState<WorkFilter>("all"),
    [tab, setTab] = useState("saved");
  const [selected, setSelected] = useState<Work>(),
    [panel, setPanel] = useState(""),
    [versions, setVersions] = useState<Version[]>([]),
    [busy, setBusy] = useState(false);
  const r = useResource(
    async () =>
      session.user
        ? api<List<Work>>(
            collection
              ? tab === "saved"
                ? "me/saved"
                : "me/recent"
              : "me/works",
          )
        : { data: [] },
    [session.user?.id, collection, tab],
  );
  async function showVersions(work: Work) {
    setBusy(true);
    try {
      const v = await api<List<Version>>(`works/${part(work.id)}/versions`);
      setVersions(v.data);
      setSelected(work);
      setPanel("versions");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const all = r.data?.data || [],
    works = collection ? all : all.filter((w) => includesWork(w, filter));
  const editPath = (w: Work) =>
    w.status === "processing" && w.generationJobId
      ? "/generations/" + part(w.generationJobId)
      : "/works/" + part(w.id) + "/edit";
  if (!session.user)
    return (
      <div className="page">
        <Header title="Profile" />
        <Empty
          title="将你的作品保存在一起"
          action={
            <Link className="button primary" to="/login">
              登录 Pulse
            </Link>
          }
        >
          准备好创作、发布或管理账号时再登录。
        </Empty>
      </div>
    );
  return (
    <div className="page profile">
      <Header
        title={collection ? "收藏与最近游玩" : "Profile"}
        back={collection}
      >
        <Link className="icon-button" to="/settings" aria-label="设置">
          <Settings />
        </Link>
      </Header>
      {!collection ? (
        <>
          <div className="profile-identity">
            <div className="avatar">
              {session.user.displayName?.[0]?.toUpperCase() || "P"}
            </div>
            <div>
              <h2>@{session.user.username}</h2>
              <p>{session.user.displayName}</p>
            </div>
          </div>
          <div className="profile-metrics">
            <div>
              <strong>
                {all.filter((w) => w.status === "published").length}
              </strong>
              <span>已发布</span>
            </div>
            <div>
              <strong>
                {all.filter((w) => w.creationMode === "remix").length}
              </strong>
              <span>Remix</span>
            </div>
            <div>
              <strong>{all.reduce((n, w) => n + w.likes, 0)}</strong>
              <span>获赞</span>
            </div>
          </div>
          <Link to="/me/credits" className="library-entry">
            我的积分 · 卡券充值
            <ChevronRight size={18} />
          </Link>
          <Link to="/me/library" className="library-entry">
            <Bookmark size={20} />
            <strong>收藏与最近游玩</strong>
            <ChevronRight size={18} />
          </Link>
          <div className="section-heading">
            <h2>你的作品</h2>
            <span>{works.length}</span>
            <button className="text-button" onClick={r.reload}>
              刷新
            </button>
          </div>
          <div className="work-filters" aria-label="作品状态筛选">
            {workFilters.map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                onClick={(e) => {
                  setFilter(id);
                  e.currentTarget.scrollIntoView({
                    block: "nearest",
                    inline: "nearest",
                  });
                }}
              >
                {label} {all.filter((w) => includesWork(w, id)).length}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="segments">
          <button
            aria-pressed={tab === "saved"}
            className={tab === "saved" ? "selected" : ""}
            onClick={() => setTab("saved")}
          >
            收藏
          </button>
          <button
            aria-pressed={tab === "recent"}
            className={tab === "recent" ? "selected" : ""}
            onClick={() => setTab("recent")}
          >
            最近游玩
          </button>
        </div>
      )}
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : works.length ? (
        <div className="work-list">
          {works.map((w) => (
            <article className="profile-work-row" key={w.id}>
              <button
                className="work-open"
                aria-label={"查看作品详情：" + w.title}
                onClick={() => {
                  if (collection && w.publicSlug)
                    nav("/a/" + part(w.publicSlug));
                  else {
                    setSelected(w);
                    setPanel("details");
                  }
                }}
              >
                <div className="work-thumbnail">
                  <Cover work={w} />
                </div>
                <div className="work-row-copy">
                  <strong>{w.title}</strong>
                  <p>{w.prompt}</p>
                  <small className={w.status === "published" ? "lime" : ""}>
                    {lifecycle(w)} ·{" "}
                    {w.verificationGrade === "verified" ? "验收通过" : "待完善"}
                  </small>
                  {w.currentVersion ? (
                    <small>版本 {w.currentVersion}</small>
                  ) : null}
                  <small>{reviewLabel(w)}</small>
                </div>
              </button>
              {!collection ? (
                <div className="work-row-actions">
                  <button
                    className="icon-button"
                    aria-label={"管理作品：" + w.title}
                    onClick={() => {
                      setSelected(w);
                      setPanel("details");
                    }}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  <button
                    disabled={busy}
                    className="icon-button"
                    aria-label={"版本历史：" + w.title}
                    onClick={() => showVersions(w)}
                  >
                    <History size={18} />
                  </button>
                </div>
              ) : (
                <Link
                  className="icon-button"
                  aria-label={"游玩：" + w.title}
                  to={"/works/" + part(w.id)}
                >
                  <ChevronRight />
                </Link>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            collection
              ? tab === "saved"
                ? "还没有收藏"
                : "还没有游玩记录"
              : "这里还没有作品"
          }
          action={
            <Link className="button primary" to="/create">
              创作互动作品
            </Link>
          }
        >
          当前分类中的作品会显示在这里。
        </Empty>
      )}
      {selected && panel ? (
        <Sheet
          title={
            panel === "versions"
              ? "版本历史"
              : panel === "revoke"
                ? "撤销公开链接？"
                : "作品详情"
          }
          onClose={() => setPanel("")}
        >
          {panel === "versions" ? (
            versions.map((v) => (
              <div className="version-row" key={v.generationId}>
                <div>
                  <strong>
                    版本 {v.version} ·{" "}
                    {v.isPublished
                      ? "已发布"
                      : v.isCurrent
                        ? "当前候选"
                        : "历史版本"}
                  </strong>
                  <small>
                    {v.verificationGrade === "verified" ? "验收通过" : "待完善"}{" "}
                    · {new Date(v.createdAt).toLocaleString("zh-CN")}
                  </small>
                </div>
                <Link
                  replace
                  to={
                    v.artifactId
                      ? `/works/${part(selected.id)}/preview?artifact=${part(v.artifactId)}`
                      : "/generations/" + part(v.generationId)
                  }
                >
                  查看
                </Link>
              </div>
            ))
          ) : panel === "revoke" ? (
            <>
              <p>公开链接将立即失效。私有草稿和审核记录会保留。</p>
              <Button
                busy={busy}
                className="primary wide"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`works/${part(selected.id)}/unpublish`, "POST");
                    setPanel("");
                    r.reload();
                    toast("公开链接已撤销");
                  } catch (e) {
                    toast((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                确认撤销
              </Button>
            </>
          ) : (
            <>
              <h3>{selected.title}</h3>
              <p>{selected.theme}</p>
              <p className="muted">{selected.prompt}</p>
              <p>
                {lifecycle(selected)} · {reviewLabel(selected)}
              </p>
              {selected.creator === session.user.username ? (
                <>
                  <Link
                    replace
                    className="button primary wide"
                    to={editPath(selected)}
                  >
                    {selected.status === "processing" ? "恢复生成" : "继续修改"}
                  </Link>
                  <Button
                    className="wide"
                    busy={busy}
                    onClick={() => showVersions(selected)}
                  >
                    版本历史
                  </Button>
                </>
              ) : null}
              <Link
                replace
                className="button wide"
                to={"/works/" + part(selected.id)}
              >
                {selected.status === "published" ? "打开作品" : "预览与管理"}
              </Link>
              {selected.status === "published" &&
              selected.creator === session.user.username ? (
                <Button
                  className="wide danger"
                  onClick={() => setPanel("revoke")}
                >
                  撤销公开链接
                </Button>
              ) : null}
            </>
          )}
        </Sheet>
      ) : null}
    </div>
  );
}
