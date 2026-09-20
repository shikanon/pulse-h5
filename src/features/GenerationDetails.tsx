import { api, part, type Job } from "../shared/api";
import { parseCreation } from "../shared/creationContext";
import { Sheet, Loading, ErrorState, useResource } from "../shared/ui";
type Plan = {
  title: string;
  objective: string;
  interactions: { id: string; trigger: string; effect: string }[];
  acceptanceCases: { id: string; action: string; assert: string }[];
};
type Verification = {
  grade: string;
  summary: string;
  checks: { name: string; status: string; summary: string }[];
};
export function GenerationDetails({
  jobId,
  onClose,
}: {
  jobId: string;
  onClose: () => void;
}) {
  const r = useResource(async () => {
    const { generation } = await api<{ generation: Job }>(
      `generations/${part(jobId)}`,
    );
    const [plan, verification] = await Promise.all([
      generation.planId
        ? api<{ plan: Plan }>(`generations/${part(jobId)}/plan`)
        : undefined,
      generation.verificationId
        ? api<{ verification: Verification }>(
            `verifications/${part(generation.verificationId)}`,
          )
        : undefined,
    ]);
    return { plan: plan?.plan, verification: verification?.verification };
  }, [jobId]);
  return (
    <Sheet title="方案与验收" onClose={onClose}>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : (
        <>
          {r.data?.verification ? (
            <>
              <h3>
                {r.data.verification.grade === "verified"
                  ? "验收通过"
                  : "需要继续完善"}
              </h3>
              <p>{r.data.verification.summary}</p>
              <details>
                <summary>检查详情</summary>
                {r.data.verification.checks.map((c) => (
                  <p key={c.name}>
                    <strong>
                      {c.name} · {c.status}
                    </strong>
                    <br />
                    {c.summary}
                  </p>
                ))}
              </details>
            </>
          ) : null}
          {r.data?.plan ? (
            <>
              <h3>{r.data.plan.title}</h3>
              <p>{parseCreation(r.data.plan.objective).message}</p>
              <h3>互动设计</h3>
              {r.data.plan.interactions.map((i) => (
                <p key={i.id}>
                  {i.trigger} → {i.effect}
                </p>
              ))}
              <h3>验收目标</h3>
              {r.data.plan.acceptanceCases.map((c) => (
                <p key={c.id}>
                  {c.action}：{c.assert}
                </p>
              ))}
            </>
          ) : null}
          <p className="muted">
            自动验收不代替实际试玩；素材呈现与玩法仍需亲自检查。
          </p>
        </>
      )}
    </Sheet>
  );
}
