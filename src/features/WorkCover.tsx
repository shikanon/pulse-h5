import { useEffect, useRef, useState } from "react";
import type { Work } from "../shared/api";
import { coverSource } from "../shared/workCover";
import { Player } from "./Player";

export function WorkCoverMedia({
  work,
  animate = false,
  onError,
}: {
  work: Work;
  animate?: boolean;
  onError: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const src = coverSource(work);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (animate && !document.hidden && !reduced.matches)
        void video.current?.play().catch(() => {});
      else video.current?.pause();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      video.current?.pause();
    };
  }, [animate, src]);
  return work.cover?.kind === "video" ? (
    <video
      ref={video}
      className="work-cover-media"
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={`${work.title}视频封面`}
      onError={onError}
    />
  ) : (
    <img
      className="work-cover-media"
      src={src}
      alt={`${work.title}封面`}
      onError={onError}
    />
  );
}

export function FeedPreview({
  work,
  playing,
}: {
  work: Work;
  playing: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (playing) setStarted(true);
  }, [playing]);
  const covered = !!coverSource(work) && !failed;
  return (
    <>
      {(!covered || playing || started) && (
        <div
          className="feed-preview-content"
          hidden={covered && !playing}
          inert={!playing}
        >
          <Player
            work={work}
            active={!covered || playing}
            showsResultControls={!playing}
          />
        </div>
      )}
      {covered && !playing && (
        <WorkCoverMedia work={work} animate onError={() => setFailed(true)} />
      )}
    </>
  );
}
