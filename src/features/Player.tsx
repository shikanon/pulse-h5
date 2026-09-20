import { useEffect, useRef, useState } from "react";
import { RotateCcw, Share2, Download } from "lucide-react";
import { api, artifactPath, part, type Work } from "../shared/api";
import { Button, Notice } from "../shared/ui";
import { useApp } from "../app/store";
export function Player({
  work,
  artifactId = work.artifactId,
  onInteraction,
  showsResultControls = true,
}: {
  work: Work;
  artifactId?: string;
  onInteraction?: () => void;
  showsResultControls?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    [entry, setEntry] = useState<string>(),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [round, setRound] = useState(0),
    [score, setScore] = useState<number>(),
    session = useRef<string | undefined>(undefined),
    epoch = useRef(0),
    chain = useRef(Promise.resolve()),
    { toast } = useApp();
  useEffect(() => {
    let live = true;
    const token = ++epoch.current;
    setEntry(undefined);
    setError("");
    setLoaded(false);
    setScore(undefined);
    session.current = undefined;
    chain.current = Promise.resolve();
    const path = artifactPath(
      artifactId === work.artifactId ? work.artifactEntryUrl : undefined,
      artifactId,
    );
    if (!path) {
      setError("这个版本还没有可游玩的内容。");
      return;
    }
    (async () => {
      const params = new URLSearchParams(location.search),
        challengeId = params.get("challenge");
      if (
        params.getAll("challenge").length > 1 ||
        (challengeId && !/^[a-f0-9-]{36}$/i.test(challengeId))
      )
        throw Error("挑战链接无效");
      if (challengeId) {
        const v = await api<{
          challenge: { workId: string; artifactId: string };
        }>("public/challenges/" + part(challengeId));
        if (
          v.challenge.workId !== work.id ||
          v.challenge.artifactId !== artifactId
        )
          throw Error("挑战已失效或属于其他版本");
      }
      const grant = await api<{ base: string; entryFile: string }>(
        "/session/artifact",
        "POST",
        {
          artifactId,
        },
      );
      let playPath = grant.base + grant.entryFile + "?pulseRuntime=1";
      if (work.status === "published" && artifactId === work.artifactId) {
        try {
          const p = await api<{ session: { id: string; seed: number } }>(
            "play-sessions",
            "POST",
            {
              platform: "web",
              deviceId:
                localStorage.getItem("pulse.h5.analytics") === "true"
                  ? localStorage.getItem("pulse.h5.device") || ""
                  : "",
              consent: localStorage.getItem("pulse.h5.analytics") === "true",
              workId: work.id,
              ...(challengeId ? { challengeId } : {}),
            },
          );
          if (live) {
            session.current = p.session.id;
            const u = new URL(playPath, location.origin);
            u.searchParams.set("pulseRuntime", "1");
            u.hash = `pulseSeed=${p.session.seed}`;
            playPath = u.pathname + u.search + u.hash;
          }
        } catch (e) {
          if (challengeId) throw e;
        }
      }
      if (live && token === epoch.current) setEntry(playPath);
    })().catch((e) => {
      if (live) setError(e.message);
    });
    return () => {
      live = false;
      epoch.current++;
    };
  }, [work.id, artifactId, round]);
  useEffect(() => {
    if (!entry) return;
    const timer = setTimeout(() => {
      if (!loaded) setError("作品加载超时，请检查网络后重试。");
    }, 15000);
    return () => clearTimeout(timer);
  }, [entry, loaded]);
  useEffect(() => {
    const isActive = () =>
      !document.hidden && !document.querySelector("dialog[open]");
    const visible = () =>
      frame.current?.contentWindow?.postMessage(
        { type: "pulse:visibility", active: isActive() },
        "*",
      );
    const message = (e: MessageEvent) => {
      if (
        e.source !== frame.current?.contentWindow ||
        e.origin !== "null" ||
        !isActive()
      )
        return;
      const d = e.data;
      if (
        !d ||
        d.type !== "pulse:play-v1" ||
        !["protocol", "interaction", "qualified", "complete"].includes(d.name)
      )
        return;
      if (
        d.name === "complete" &&
        (!Number.isInteger(d.score) || d.score < 0 || d.score > 1e9)
      )
        return;
      if (d.name === "interaction" || d.name === "complete") onInteraction?.();
      if (!session.current) return;
      const sid = session.current,
        token = epoch.current;
      chain.current = chain.current
        .then(async () => {
          if (token !== epoch.current) return;
          const r = await api<{
            session: { completed: boolean; score: number };
          }>(`play-sessions/${part(sid)}/events`, "POST", {
            name: d.name,
            ...(d.name === "complete" ? { score: d.score } : {}),
          });
          if (token === epoch.current && r.session.completed)
            setScore(r.session.score);
        })
        .catch(() => {
          if (token === epoch.current) toast("成绩暂未保存，可以重新游玩。");
        });
    };
    const observer = new MutationObserver(visible);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("message", message);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("message", message);
    };
  }, [onInteraction, toast]);
  async function share(download = false) {
    try {
      if (!session.current) return;
      const data = await api<{
        challenge: { url: string; id: string; score: number };
      }>(`play-sessions/${part(session.current)}/challenge`, "POST", {});
      const url = new URL(
        `/a/${part(work.publicSlug!)}?challenge=${part(data.challenge.id)}`,
        location.origin,
      ).href;
      if (download) {
        const c = document.createElement("canvas");
        c.width = 900;
        c.height = 600;
        const x = c.getContext("2d")!;
        x.fillStyle = "#090a0b";
        x.fillRect(0, 0, 900, 600);
        x.fillStyle = "#c4ff3d";
        x.font = "bold 40px sans-serif";
        x.fillText("Pulse", 50, 70);
        x.fillStyle = "#fff";
        x.font = "bold 40px sans-serif";
        x.fillText(work.title.slice(0, 25), 50, 150, 800);
        x.font = "bold 140px sans-serif";
        x.fillText(String(score), 50, 330);
        x.font = "24px sans-serif";
        x.fillText("挑战同一版本 · 作品报告分数", 50, 400);
        x.font = "16px sans-serif";
        for (let i = 0; i < url.length; i += 80)
          x.fillText(url.slice(i, i + 80), 50, 470 + (i / 80) * 28);
        c.toBlob((b) => {
          if (!b) return;
          const u = URL.createObjectURL(b),
            a = document.createElement("a");
          a.href = u;
          a.download = "pulse-result.png";
          a.click();
          setTimeout(() => URL.revokeObjectURL(u), 1000);
        });
      } else if (navigator.share)
        await navigator.share({
          title: work.title,
          text: `我的成绩：${score}`,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        toast("挑战链接已复制");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast((e as Error).message);
    }
  }
  return (
    <div className="player-wrap">
      {error ? (
        <div className="player-error">
          <Notice>{error}</Notice>
          <Button onClick={() => setRound((n) => n + 1)}>重新加载</Button>
        </div>
      ) : entry ? (
        <iframe
          ref={frame}
          key={entry + round}
          src={entry}
          title={`游玩：${work.title}`}
          sandbox="allow-scripts"
          allow="autoplay"
          onLoad={() => {
            setLoaded(true);
            frame.current?.contentWindow?.postMessage(
              {
                type: "pulse:visibility",
                active:
                  !document.hidden && !document.querySelector("dialog[open]"),
              },
              "*",
            );
          }}
        />
      ) : (
        <div className="loading">正在载入作品…</div>
      )}
      {showsResultControls && score !== undefined ? (
        <div className="result">
          <strong>本轮成绩 {score}</strong>
          <small>由作品报告</small>
          <Button onClick={() => setRound((n) => n + 1)}>
            <RotateCcw size={16} />
            再玩一次
          </Button>
          <Button onClick={() => share()}>
            <Share2 size={16} />
            挑战好友
          </Button>
          <Button aria-label="下载结果卡" onClick={() => share(true)}>
            <Download size={16} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
