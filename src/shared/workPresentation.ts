import type { Work } from "./api";
export const workFilters = [
  ["all", "全部"],
  ["published", "已发布"],
  ["remixes", "Remix"],
  ["drafts", "草稿"],
  ["creating", "生成中"],
  ["attention", "需要处理"],
  ["revoked", "已撤销"],
] as const;
export type WorkFilter = (typeof workFilters)[number][0];
export function includesWork(work: Work, filter: WorkFilter) {
  switch (filter) {
    case "all":
      return true;
    case "published":
      return work.status === "published";
    case "remixes":
      return work.creationMode === "remix";
    case "drafts":
      return work.status === "draft" && !work.publicLinkRevokedAt;
    case "creating":
      return work.status === "processing";
    case "attention":
      return (
        ["hidden", "deleted"].includes(work.status) ||
        work.contentReviewStatus === "rejected" ||
        (work.status === "draft" && !!work.generationJobId)
      );
    case "revoked":
      return !!work.publicLinkRevokedAt;
  }
}
export function lifecycle(work: Work) {
  if (work.publicLinkRevokedAt) return "公开链接已撤销";
  return (
    (
      {
        published: "已发布",
        processing: "生成中",
        draft: "私有草稿",
        hidden: "不可用",
        deleted: "已删除",
      } as Record<string, string>
    )[work.status] || work.status
  );
}
export function reviewLabel(work: Work) {
  return work.contentReviewStatus === "approved"
    ? `内容审核通过${work.ageRating ? " · " + work.ageRating : ""}`
    : work.contentReviewStatus === "rejected"
      ? "内容需要修改"
      : work.contentReviewRequestedAt
        ? "内容审核中"
        : "尚未提交审核";
}
