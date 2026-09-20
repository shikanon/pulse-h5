import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import {
  Sparkles,
  LockKeyhole,
  X,
  Images,
  Music,
  Library,
  Repeat2,
} from "lucide-react";
import {
  api,
  part,
  type Asset,
  type Work,
  type Job,
  type List,
  type Version,
} from "../shared/api";
import {
  Button,
  Header,
  Notice,
  Sheet,
  useResource,
  Loading,
} from "../shared/ui";
import { useApp } from "../app/store";
import { Conversation } from "./Conversation";
import {
  selectedContext,
  creationInstruction,
  parseCreation,
  rolesFor,
  roleLabels,
  type CreationContext,
  type MaterialRole,
} from "../shared/creationContext";
import { Assets } from "./Assets";
type Draft = {
  instruction: string;
  assets: Asset[];
  workId?: string;
  createKey: string;
  generationKey: string;
  lastInput?: string;
  context?: CreationContext;
};
const newDraft = (): Draft => ({
  instruction: "",
  assets: [],
  createKey: crypto.randomUUID(),
  generationKey: crypto.randomUUID(),
});
export default function Composer() {
  const { workId } = useParams(),
    location = useLocation(),
    nav = useNavigate(),
    { session, requireLogin, toast } = useApp(),
    remix = location.pathname.startsWith("/remix"),
    editing = !!workId && !remix;
  const storageKey = `pulse.h5.draft.v1:${session.user?.id || "guest"}:${location.pathname}`;
  const [draft, setDraft] = useState<Draft>(() => {
      try {
        const d = JSON.parse(localStorage.getItem(storageKey) || "null");
        return d && typeof d.instruction === "string" && Array.isArray(d.assets)
          ? d
          : newDraft();
      } catch {
        return newDraft();
      }
    }),
    [showAssets, setShowAssets] = useState(false),
    [assetKind, setAssetKind] = useState<"library" | "media" | "audio">(
      "library",
    ),
    [showConversation, setShowConversation] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmReset, setConfirmReset] = useState(false);
  const source = useResource(async () => {
      if (!workId) return undefined;
      const w = (await api<{ work: Work }>("works/" + part(workId))).work;
      if (editing) {
        const v = await api<List<Version>>(`works/${part(workId)}/versions`);
        const candidate = v.data.find((x) => x.isCurrent && x.artifactId);
        if (candidate) {
          w.artifactId = candidate.artifactId;
          const j = await api<{ generation: Job }>(
            `generations/${part(candidate.generationId)}`,
          );
          setDraft((d) =>
            d.context
              ? d
              : {
                  ...d,
                  context: parseCreation(j.generation.instruction).context,
                },
          );
        }
      }
      return w;
    }, [workId]),
    cap = useResource(
      () =>
        api<{ mode: string; modelBacked: boolean; materialUploads?: boolean }>(
          "generation-capabilities",
        ),
      [],
    );
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      setError("本浏览器无法保存草稿，请保持页面打开。");
    }
  }, [draft, storageKey]);
  async function generate() {
    if (!requireLogin()) return;
    setBusy(true);
    setError("");
    let d = { ...draft };
    try {
      if (remix && !source.data?.allowRemix) throw Error("原作未开放 Remix");
      if (!cap.data) throw Error("请先确认生成服务状态");
      if (!cap.data.modelBacked && cap.data.mode !== "deterministic-local")
        throw Error("生成服务尚未配置");
      if (!d.workId) {
        if (editing) d.workId = workId;
        else {
          const r = await api<{ work: Work }>(
            "works",
            "POST",
            {
              title: remix
                ? `${source.data!.title} — Remix`
                : d.instruction.slice(0, 28),
              instruction: d.instruction,
              theme: d.instruction.slice(0, 96),
              tint: "lime",
              interaction: source.data?.interaction || "garden",
              creationMode: remix ? "remix" : "original",
              allowRemix:
                localStorage.getItem("pulse.h5.allowRemix") !== "false",
              ...(remix
                ? {
                    parentWorkId: workId,
                    parentArtifactId: source.data?.artifactId,
                  }
                : {}),
            },
            d.createKey,
          );
          d.workId = r.work.id;
        }
        setDraft({ ...d });
      }
      const body = {
        instruction: creationInstruction(
          d.instruction,
          selectedContext(
            d.context || { preserve: "", materials: [] },
            d.assets,
          ),
        ),
        assetIds: d.assets.map((a) => a.id),
        ...(editing && source.data?.artifactId
          ? { baseArtifactId: source.data.artifactId }
          : {}),
      };
      const serialized = JSON.stringify(body);
      if (d.lastInput && d.lastInput !== serialized)
        d.generationKey = crypto.randomUUID();
      d.lastInput = serialized;
      setDraft({ ...d });
      localStorage.setItem(storageKey, JSON.stringify(d));
      const r = await api<{ generation: Job }>(
        `works/${part(d.workId!)}/generations`,
        "POST",
        body,
        d.generationKey,
      );
      nav("/generations/" + part(r.generation.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={"page composer " + (editing ? "editing" : "")}>
      <Header title={remix ? "Remix" : editing ? "继续创作" : "Create"} />
      {source.loading && workId ? (
        <Loading />
      ) : source.error ? (
        <Notice>{source.error}</Notice>
      ) : (
        <>
          {source.data && remix ? (
            <div className="source-note">
              <Repeat2 size={18} />
              <div>
                <span>{remix ? "Remix 自" : "正在修改"}</span>
                <strong>{source.data.title}</strong>
                <small>
                  @{source.data.creator} · 原作者 @{source.data.originalCreator}
                </small>
              </div>
            </div>
          ) : null}
          {!remix ? (
            <>
              <h2 className="creation-heading">
                {editing ? "完善这个版本" : "创造让人有感受的作品。"}
              </h2>
              <p className="creation-subtitle">
                {editing
                  ? "描述你的修改，现有玩法和素材会成为新版本的起点。"
                  : "从一句话开始，图片和视频都不是必需的。"}
              </p>
            </>
          ) : null}
          {editing || draft.workId ? (
            <div className="conversation-links">
              <button
                className="text-button"
                onClick={() => setShowConversation(true)}
              >
                查看创作对话
              </button>
              {source.data?.artifactId ? (
                <Link
                  className="text-button"
                  to={`/works/${part(workId!)}/preview?artifact=${part(source.data.artifactId)}`}
                >
                  返回预览
                </Link>
              ) : null}
            </div>
          ) : null}
          <p className="muted small-text">
            创作、试玩，再提出修改。每条请求都会成为这个作品的新版本。
          </p>
          {editing || remix ? (
            <p className="inherit-note">
              继承现有玩法与内嵌素材。需要新增内容时，再添加下方素材。
            </p>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <div className="prompt-box">
              <label className="prompt-label" htmlFor="instruction">
                {editing || remix ? "想修改什么？" : "你的想法"}
              </label>
              <textarea
                id="instruction"
                value={draft.instruction}
                onChange={(e) =>
                  setDraft({ ...draft, instruction: e.target.value })
                }
                maxLength={4000}
                placeholder={
                  editing || remix
                    ? "描述你想做出的改变…"
                    : "描述你想创造的体验…"
                }
                required
              />
            </div>
            {editing || remix || draft.context?.preserve ? (
              <details className="preserve-directions">
                <summary>哪些内容应该保持不变？</summary>
                <textarea
                  aria-label="保持不变的内容"
                  maxLength={800}
                  placeholder="例如：保留操作方式、计分和角色图片"
                  value={draft.context?.preserve || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      context: {
                        materials: draft.context?.materials || [],
                        preserve: e.target.value,
                      },
                    })
                  }
                />
                <small className="muted">
                  这些要求会沿用到下一轮，直到你修改它们。
                </small>
              </details>
            ) : null}
            <div className="resource-section">
              <div className="section-heading">
                <h3>资源库</h3>
                <span>{draft.assets.length} / 8 · 本轮新增</span>
              </div>
              <div className="resource-actions">
                {(
                  [
                    ["library", "素材库", Library],
                    ["media", "图片 / 视频", Images],
                    ["audio", "BGM", Music],
                  ] as const
                ).map(([kind, label, Icon]) => (
                  <button
                    type="button"
                    key={kind}
                    disabled={
                      busy ||
                      (kind !== "library" && cap.data?.materialUploads !== true)
                    }
                    onClick={() => {
                      if (requireLogin()) {
                        setAssetKind(kind);
                        setShowAssets(true);
                      }
                    }}
                  >
                    <Icon size={22} />
                    {label}
                  </button>
                ))}
              </div>
              {cap.data?.materialUploads !== true ? (
                <p className="muted small-text">
                  上传暂未开放，可以使用文字和公共素材创作。
                </p>
              ) : null}
              {draft.assets.length ? (
                <p className="muted small-text">
                  本轮素材{" "}
                  {Math.round(
                    draft.assets.reduce((n, a) => n + a.sizeBytes, 0) / 1024,
                  )}{" "}
                  KB / 4 MiB
                </p>
              ) : null}
              {selectedContext(
                draft.context || { preserve: "", materials: [] },
                draft.assets,
              ).materials.map((m) => {
                const asset = draft.assets.find((a) => a.id === m.id)!;
                const update = (patch: Partial<typeof m>) => {
                  const context = selectedContext(
                    draft.context || { preserve: "", materials: [] },
                    draft.assets,
                  );
                  setDraft({
                    ...draft,
                    context: {
                      ...context,
                      materials: context.materials.map((v) =>
                        v.id === m.id ? { ...v, ...patch } : v,
                      ),
                    },
                  });
                };
                return (
                  <div className="material-direction" key={m.id}>
                    <div className="section-heading">
                      <strong>{m.name}</strong>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={"移除 " + m.name}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            assets: draft.assets.filter((a) => a.id !== m.id),
                          })
                        }
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <label>
                      用途
                      <select
                        value={m.role}
                        onChange={(e) =>
                          update({ role: e.target.value as MaterialRole })
                        }
                      >
                        {rolesFor(asset.kind).map((role) => (
                          <option key={role} value={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      出现位置或触发时机
                      <textarea
                        maxLength={400}
                        value={m.placement}
                        onChange={(e) => update({ placement: e.target.value })}
                        placeholder="例如：消除一行后，在画面上方出现 2 秒"
                      />
                    </label>
                    {m.role === "reference" ? (
                      <small className="muted">
                        仅作视觉参考，不作为游戏内图片。请描述关键细节。
                      </small>
                    ) : null}
                  </div>
                );
              })}
              {editing || remix ? (
                <small className="muted">
                  移除本轮附件不会删除游戏内已有素材；删除已有内容请在指令中说明。
                </small>
              ) : null}
            </div>
            <div className="composer-submit">
              {error ? <Notice>{error}</Notice> : null}
              {cap.error ? (
                <Notice>
                  {cap.error}
                  <button type="button" onClick={cap.reload}>
                    重试
                  </button>
                </Notice>
              ) : null}
              {cap.data?.mode === "deterministic-local" ? (
                <p className="local-label">
                  本地测试生成器 · 不代表真实 AI 生成
                </p>
              ) : null}
              <Button
                type="submit"
                className="primary wide generate-button"
                busy={busy}
                disabled={
                  !draft.instruction.trim() ||
                  (!!cap.data &&
                    !cap.data.modelBacked &&
                    cap.data.mode !== "deterministic-local") ||
                  !cap.data ||
                  !!source.error ||
                  (remix && !source.data?.allowRemix)
                }
              >
                <Sparkles size={19} />
                {session.user
                  ? editing
                    ? "应用修改"
                    : remix
                      ? "生成 Remix"
                      : "开始生成"
                  : "登录并创作"}
              </Button>
            </div>
            <p className="privacy-note">
              <LockKeyhole size={15} />
              发布之前，你的草稿仅自己可见。
            </p>
            {draft.workId ? (
              <div className="inline">
                <Link
                  className="text-button"
                  to={"/works/" + part(draft.workId)}
                >
                  查看这个作品
                </Link>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirmReset(true)}
                >
                  新建另一个作品
                </button>
              </div>
            ) : null}
          </form>
        </>
      )}
      {showAssets ? (
        <Assets
          initialKind={assetKind}
          selected={draft.assets}
          uploads={cap.data?.materialUploads === true}
          onChange={(assets) => setDraft({ ...draft, assets })}
          onClose={() => setShowAssets(false)}
        />
      ) : null}
      {showConversation && (workId || draft.workId) ? (
        <Conversation
          workId={(editing ? workId : draft.workId)!}
          onClose={() => setShowConversation(false)}
        />
      ) : null}
      {confirmReset ? (
        <Sheet title="开始新的创作？" onClose={() => setConfirmReset(false)}>
          <p>当前作品仍保存在个人中心。本页输入会清空。</p>
          <Button
            className="primary wide"
            onClick={() => {
              setDraft(newDraft());
              setConfirmReset(false);
              toast("可以开始新的创作了");
            }}
          >
            新建作品
          </Button>
        </Sheet>
      ) : null}
    </div>
  );
}
