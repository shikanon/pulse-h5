import { Link } from "react-router-dom";
import {
  api,
  part,
  stageName,
  type Job,
  type List,
  type Version,
} from "../shared/api";
import { Sheet, Loading, Notice, Button, useResource } from "../shared/ui";
import { parseCreation } from "../shared/creationContext";
export function Conversation({
  workId,
  onClose,
}: {
  workId: string;
  onClose: () => void;
}) {
  const r = useResource(async () => {
    const v = await api<List<Version>>(`works/${part(workId)}/versions`);
    const jobs = await Promise.allSettled(
      v.data
        .slice()
        .sort((a, b) => a.version - b.version)
        .slice(-20)
        .map((v) =>
          api<{ generation: Job }>(`generations/${part(v.generationId)}`),
        ),
    );
    return {
      jobs: jobs.flatMap((j) =>
        j.status === "fulfilled" && j.value.generation.workId === workId
          ? [j.value.generation]
          : [],
      ),
      partial: jobs.some((j) => j.status === "rejected"),
    };
  }, [workId]);
  return (
    <Sheet title="创作对话" onClose={onClose}>
      <p className="muted">
        每条请求对应一个版本。历史版本保留在个人中心，这里只显示你自己的创作记录。
      </p>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <>
          <Notice>{r.error}</Notice>
          <Button onClick={r.reload}>重试</Button>
        </>
      ) : (
        <>
          {r.data?.partial ? <Notice>部分记录暂未载入，请重试。</Notice> : null}
          {r.data?.jobs.map((j) => (
            <article className="conversation-turn" key={j.id}>
              <blockquote>{parseCreation(j.instruction).message}</blockquote>
              <p className="muted">{stageName[j.stage] || j.stage}</p>
              {parseCreation(j.instruction).context.preserve ? (
                <small>
                  保持不变：{parseCreation(j.instruction).context.preserve}
                </small>
              ) : null}
              {j.artifactId ? (
                <Link
                  replace
                  className="text-button"
                  to={`/works/${part(workId)}/preview?artifact=${part(j.artifactId)}`}
                >
                  预览这个版本
                </Link>
              ) : null}
            </article>
          ))}
        </>
      )}
    </Sheet>
  );
}
