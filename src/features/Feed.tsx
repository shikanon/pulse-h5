import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Gamepad2,
  ArrowDown,
  ArrowUp,
  X,
  RefreshCw,
} from "lucide-react";
import { api, artifactPath, part, type Work, type List } from "../shared/api";
import { Button, Loading, Empty, ErrorState } from "../shared/ui";
import { useApp } from "../app/store";
import { Player } from "./Player";
import { Community } from "./Community";
export function Cover({ work }: { work: Work }) {
  const [failed, setFailed] = useState(false);
  const poster = work.artifactPreviewUrl
    ? artifactPath(work.artifactPreviewUrl, work.artifactId, "preview.png")
    : undefined;
  useEffect(() => setFailed(false), [poster]);
  return poster && !failed ? (
    <img
      className="cover"
      src={poster}
      alt={`${work.title}预览`}
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className="cover fallback-poster"
      role="img"
      aria-label={`${work.title} · 暂无静态预览`}
    >
      <Gamepad2 size={28} />
    </div>
  );
}
export default function Feed() {
  const [mode, setMode] = useState(
      () => sessionStorage.getItem("pulse.h5.feed-mode") || "featured",
    ),
    [works, setWorks] = useState<Work[]>([]),
    [index, setIndex] = useState(0),
    [cursor, setCursor] = useState<string>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [immersive, setImmersive] = useState(false),
    [revision, setRevision] = useState(0);
  const initialPosition = useRef(
    Number(sessionStorage.getItem("pulse.h5.feed-index") || 0),
  );
  const initialMode = useRef(mode);
  useEffect(() => {
    sessionStorage.setItem("pulse.h5.feed-mode", mode);
    sessionStorage.setItem("pulse.h5.feed-index", String(index));
  }, [mode, index]);
  const { toast } = useApp(),
    touch = useRef(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    setImmersive(false);
    api<List<Work>>(
      `feed?mode=${mode}&limit=20`,
      "GET",
      undefined,
      undefined,
      c.signal,
    )
      .then((r) => {
        setWorks(r.data);
        setCursor(r.nextCursor);
        const focus = sessionStorage.getItem("pulse.h5.feed-focus"),
          focusIndex = r.data.findIndex((w) => w.id === focus);
        setIndex(
          focusIndex >= 0
            ? focusIndex
            : initialMode.current === mode
              ? Math.min(
                  initialPosition.current,
                  Math.max(0, r.data.length - 1),
                )
              : 0,
        );
        if (focusIndex >= 0) sessionStorage.removeItem("pulse.h5.feed-focus");
        initialPosition.current = 0;
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [mode, revision]);
  async function next() {
    if (index < works.length - 1) {
      setIndex(index + 1);
      return;
    }
    if (!cursor) {
      toast("已经看到这里了，试试创作一个新作品。");
      return;
    }
    try {
      const r = await api<List<Work>>(
        `feed?mode=${mode}&cursor=${part(cursor)}`,
      );
      setWorks((a) => [...a, ...r.data]);
      setCursor(r.nextCursor);
      if (r.data.length) setIndex(index + 1);
    } catch (e) {
      toast((e as Error).message);
    }
  }
  useEffect(() => {
    const reset = () => {
      setImmersive(false);
      setIndex(0);
    };
    const offline = () => setImmersive(false);
    const refresh = () => setRevision((n) => n + 1);
    window.addEventListener("pulse:feed-refresh", refresh);
    window.addEventListener("pulse:home-reset", reset);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("pulse:feed-refresh", refresh);
      window.removeEventListener("pulse:home-reset", reset);
      window.removeEventListener("offline", offline);
    };
  }, []);
  const work = works[index];
  return (
    <div
      className={"native-feed " + (immersive ? "is-immersive" : "")}
      onTouchStart={(e) => {
        touch.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (immersive || (e.target as HTMLElement).closest("button,a,dialog"))
          return;
        const d = touch.current - e.changedTouches[0].clientY;
        if (Math.abs(d) > 80) {
          if (d > 0) void next();
          else setIndex((i) => Math.max(0, i - 1));
        }
      }}
    >
      <div className="feed-top" hidden={immersive}>
        <div className="feed-modes" aria-label="作品排序">
          <button
            aria-pressed={mode === "featured"}
            disabled={loading}
            onClick={() => setMode("featured")}
          >
            精选
          </button>
          <button
            aria-pressed={mode === "latest"}
            disabled={loading}
            onClick={() => setMode("latest")}
          >
            最新
          </button>
        </div>
        <button
          className="icon-button"
          aria-label="刷新作品"
          onClick={() => setRevision((n) => n + 1)}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="feed-exit" hidden={!immersive}>
        <button className="exit-play" onClick={() => setImmersive(false)}>
          <X size={18} />
          退出游玩
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={() => setRevision((n) => n + 1)} />
      ) : !work ? (
        <Empty
          title="这里还没有作品"
          action={
            <Link className="button primary" to="/create">
              创作第一个作品
            </Link>
          }
        >
          试试创作，或重新加载。
        </Empty>
      ) : (
        <article className="native-feed-card">
          <div className="feed-runtime">
            <Player
              key={work.id}
              work={work}
              showsResultControls={!immersive}
              onInteraction={() => setImmersive(true)}
            />
          </div>
          <div className="native-summary" hidden={immersive}>
            <div className="summary-heading">
              <strong>@{work.creator}</strong>
              <Link className="text-button" to={"/works/" + part(work.id)}>
                详情
              </Link>
            </div>
            <p className="summary-theme">{work.theme || work.title}</p>
            <Community
              key={work.id}
              work={work}
              compact
              onUpdate={(w) =>
                setWorks((a) => a.map((v) => (v.id === w.id ? w : v)))
              }
            />
          </div>
        </article>
      )}
      {!immersive && work && !loading ? (
        <div className="native-pager">
          <button
            aria-label="上一个作品"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ArrowUp size={16} />
          </button>
          <span>
            {index + 1} / {works.length}
            {cursor ? "+" : ""}
          </span>
          <button aria-label="下一个作品" onClick={next}>
            <ArrowDown size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
