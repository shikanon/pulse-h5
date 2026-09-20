import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Check, LoaderCircle, Sparkles, ArrowUpRight } from "lucide-react";
import { api, part, terminal, stageName, type Job } from "../shared/api";
import { Header, Button, Notice, Loading, Sheet } from "../shared/ui";
import { parseCreation } from "../shared/creationContext";
import { useApp } from "../app/store";
type Plan = {
  title: string;
  objective: string;
  interactions: { id: string; trigger: string; effect: string }[];
  acceptanceCases: { id: string; action: string; assert: string }[];
};
export default function Generation() {
  const nav = useNavigate();
  const { jobId } = useParams(),
    [job, setJob] = useState<Job>(),
    [error, setError] = useState(""),
    [plan, setPlan] = useState<Plan>(),
    [showPlan, setShowPlan] = useState(false),
    [verification, setVerification] = useState<{
      grade: string;
      checks: { name: string; status: string; summary: string }[];
      summary: string;
    }>(),
    [cancel, setCancel] = useState(false),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    { toast } = useApp();
  useEffect(() => {
    let live = true,
      t: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await api<{ generation: Job }>("generations/" + part(jobId!));
        if (!live) return;
        setJob(r.generation);
        setError("");
        if (r.generation.stage === "succeeded" && r.generation.artifactId) {
          nav(
            `/works/${part(r.generation.workId)}/preview?artifact=${part(r.generation.artifactId)}`,
            { replace: true },
          );
          return;
        }
        if (!terminal(r.generation.stage)) t = setTimeout(poll, 2000);
      } catch (e) {
        if (live) {
          setError((e as Error).message);
          t = setTimeout(poll, 8000);
        }
      }
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [jobId, revision]);
  async function action(name: string) {
    setBusy(true);
    try {
      const r = await api<{ generation: Job }>(
        `generations/${part(job!.id)}/${name}`,
        "POST",
        undefined,
        name === "retry" ? `retry-${job!.id}` : undefined,
      );
      if (r.generation.id !== jobId)
        window.location.assign("/generations/" + part(r.generation.id));
      else {
        setJob(r.generation);
        setRevision((n) => n + 1);
      }
      setCancel(false);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const steps = [
      "queued",
      "processing_assets",
      "planning",
      "coding",
      "verifying",
    ],
    index =
      job?.stage === "succeeded"
        ? 5
        : Math.max(0, steps.indexOf(job?.stage || "queued"));
  return (
    <div className="page generation">
      <Header title="正在创作" back />
      {!job ? (
        error ? (
          <Notice>{error}</Notice>
        ) : (
          <Loading />
        )
      ) : (
        <>
          <div
            className={"generation-orb " + (terminal(job.stage) ? "done" : "")}
          >
            <Sparkles size={38} />
          </div>
          <h2>{stageName[job.stage] || "正在处理"}</h2>
          <p className="muted center">
            {job.stage === "succeeded"
              ? "灵感已变成作品。现在去亲手试试。"
              : "你可以离开页面，任务会在服务器继续。"}
          </p>
          <blockquote>{parseCreation(job.instruction).message}</blockquote>
          <ol className="stages">
            {steps.map((s, i) => (
              <li key={s} className={index >= i ? "active" : ""}>
                {index > i ? (
                  <Check size={18} />
                ) : index === i && !terminal(job.stage) ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <span className="step-dot" />
                )}
                <span>{stageName[s]}</span>
              </li>
            ))}
          </ol>
          {error ? <Notice>{error}，将自动重新连接。</Notice> : null}
          {job.planId ? (
            <Button
              className="outline wide"
              onClick={async () => {
                try {
                  const r = await api<{ plan: Plan }>(
                    `generations/${part(job.id)}/plan`,
                  );
                  setPlan(r.plan);
                  setShowPlan(true);
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              查看创作方案
              <ArrowUpRight size={17} />
            </Button>
          ) : null}
          {job.artifactId ? (
            <Link
              className="button primary wide"
              to={`/works/${part(job.workId)}/preview?artifact=${part(job.artifactId)}`}
            >
              进入私有预览
            </Link>
          ) : null}
          {job.verificationId ? (
            <Button
              className="outline wide"
              onClick={async () => {
                try {
                  const r = await api<{
                    verification: NonNullable<typeof verification>;
                  }>(`verifications/${part(job.verificationId!)}`);
                  setVerification(r.verification);
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              查看验收结果
            </Button>
          ) : null}
          {job.stage === "failed" || job.stage === "fallback_ready" ? (
            <Notice>这一版尚不能直接发布。请查看预览或继续修改。</Notice>
          ) : null}
          {job.retryable && terminal(job.stage) ? (
            <Button
              className="wide"
              busy={busy}
              onClick={() => action("retry")}
            >
              重试这次生成
            </Button>
          ) : null}
          {!terminal(job.stage) ? (
            <Button
              className="text-button wide"
              onClick={() => setCancel(true)}
            >
              取消生成
            </Button>
          ) : (
            <Link
              className="button wide"
              to={"/works/" + part(job.workId) + "/edit"}
            >
              继续修改
            </Link>
          )}
        </>
      )}
      {showPlan && plan ? (
        <Sheet title="创作方案" onClose={() => setShowPlan(false)}>
          <h3>{plan.title}</h3>
          <p>{parseCreation(plan.objective).message}</p>
          <h3>互动设计</h3>
          {plan.interactions?.map((i) => (
            <p key={i.id}>
              {i.trigger} → {i.effect}
            </p>
          ))}
          <h3>验收目标</h3>
          {plan.acceptanceCases?.map((i) => (
            <p key={i.id}>
              {i.action}：{i.assert}
            </p>
          ))}
        </Sheet>
      ) : null}
      {cancel ? (
        <Sheet title="取消这次生成？" onClose={() => setCancel(false)}>
          <p>作品和指令会保留。这次任务取消后不能继续运行。</p>
          <Button
            className="primary wide"
            busy={busy}
            onClick={() => action("cancel")}
          >
            确认取消
          </Button>
        </Sheet>
      ) : null}
      {verification ? (
        <Sheet title="自动验收结果" onClose={() => setVerification(undefined)}>
          <h3>
            {verification.grade === "verified" ? "验收通过" : "需要继续完善"}
          </h3>
          <p>{verification.summary}</p>
          {verification.checks?.map((check, i) => (
            <p key={i}>
              <strong>
                {check.name} · {check.status}
              </strong>
              <br />
              {check.summary}
            </p>
          ))}
          <p className="muted">
            自动验收不代替实际试玩，请在发布前检查触控和玩法。
          </p>
        </Sheet>
      ) : null}
    </div>
  );
}
