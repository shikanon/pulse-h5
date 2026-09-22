export type Work = {
  cover?: { assetId: string; kind: "image" | "video"; url: string };
  id: string;
  title: string;
  creator: string;
  prompt: string;
  theme: string;
  interaction: string;
  creationMode: string;
  parentId?: string;
  originalCreator: string;
  allowRemix: boolean;
  status: string;
  verificationGrade: string;
  contentReviewStatus: string;
  ageRating: string;
  artifactId?: string;
  artifactEntryUrl?: string;
  artifactPreviewUrl?: string;
  publicSlug?: string;
  publicUrl?: string;
  generationJobId?: string;
  likes: number;
  comments: number;
  remixes: number;
  viewerHasLiked: boolean;
  currentVersion?: number;
  publicLinkRevokedAt?: string;
  contentReviewRequestedAt?: string;
  updatedAt?: string;
};
export type User = {
  id: string;
  username: string;
  displayName: string;
  termsAcceptance?: { version: string; url: string };
};
export type Job = {
  id: string;
  workId: string;
  instruction: string;
  stage: string;
  statusMessage: string;
  artifactId?: string;
  planId?: string;
  verificationId?: string;
  verificationGrade: string;
  retryable: boolean;
  assetIds: string[];
};
export type Asset = {
  storage?: string;
  id: string;
  displayName: string;
  fileName: string;
  sizeBytes: number;
  mediaType: string;
  kind: string;
  library: string;
  status: string;
  summary?: string;
};
export type Version = {
  version: number;
  generationId: string;
  artifactId?: string;
  stage: string;
  isCurrent: boolean;
  isPublished: boolean;
  createdAt: string;
  verificationGrade: string;
};
export type Configuration = {
  maintenance: boolean;
  maintenanceMessage?: string;
  privacyPolicyURL?: string;
  termsURL?: string;
  termsVersion?: string;
  supportURL?: string;
};
export type Session = {
  emailEnabled?: boolean;
  user: User | null;
  localLogin: boolean;
  appleClientId: string;
  redirectURI: string;
};
export type List<T> = { data: T[]; nextCursor?: string };
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "",
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    path.startsWith("/session") ? path : "/api/v1/" + path,
    {
      method,
      credentials: "same-origin",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.startsWith("/session/email/"))
      window.dispatchEvent(new Event("pulse:auth-expired"));
    throw new APIError(
      response.status,
      (path.startsWith("/session/email/") && data.error?.message) ||
        {
          401: "请先登录后继续",
          403: "你没有权限执行此操作",
          404: "内容已失效或不可用",
          410: "内容已失效或不可用",
          429: "操作太频繁，请稍后重试",
        }[response.status] ||
        data.error?.message ||
        "暂时无法连接，请重试",
      data.error?.code,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const part = encodeURIComponent;
export const terminal = (stage: string) =>
  ["succeeded", "fallback_ready", "failed", "cancelled"].includes(stage);
export const stageName: Record<string, string> = {
  queued: "准备创作",
  processing_assets: "准备素材",
  planning: "设计互动方案",
  coding: "构建互动作品",
  verifying: "自动验收",
  repairing: "修复体验",
  fallback_building: "准备安全版本",
  succeeded: "可以试玩了",
  fallback_ready: "需要继续修改",
  failed: "生成需要关注",
  cancelled: "已取消生成",
};
export function artifactPath(
  url: string | undefined,
  id: string | undefined,
  file = "index.html",
) {
  if (!id) return undefined;
  const expected = `/v1/artifacts/${part(id)}/files/`;
  if (!url) return "/api" + expected + file;
  try {
    const parsed = new URL(url, location.origin);
    if (
      parsed.username ||
      parsed.password ||
      !parsed.pathname.startsWith(expected) ||
      parsed.hash
    )
      return undefined;
    return "/api" + parsed.pathname + parsed.search;
  } catch {
    return undefined;
  }
}
export const eligible = (work: Work) =>
  work.status === "published" &&
  work.verificationGrade === "verified" &&
  (work.contentReviewStatus === "pending" ||
    (work.contentReviewStatus === "approved" && work.ageRating === "4+"));
export const safeLink = (s?: string) => {
  try {
    const u = new URL(s || "");
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
};
