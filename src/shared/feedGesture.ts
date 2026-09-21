export type FeedGesture = {
  id: number;
  x: number;
  y: number;
  started: number;
  distance: number;
  cancelled: boolean;
};
export function moveGesture(g: FeedGesture, x: number, y: number) {
  g.distance = Math.max(g.distance, Math.hypot(x - g.x, y - g.y));
}
export function finishGesture(
  g: FeedGesture,
  x: number,
  y: number,
  now: number,
) {
  moveGesture(g, x, y);
  if (g.cancelled) return "none";
  const dx = x - g.x,
    dy = y - g.y;
  if (Math.abs(dy) >= 60 && Math.abs(dy) > Math.abs(dx) * 1.2)
    return dy < 0 ? "next" : "previous";
  if (g.distance <= 10 && now - g.started <= 500) return "tap";
  return "none";
}
