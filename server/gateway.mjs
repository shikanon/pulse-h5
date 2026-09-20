import { randomBytes } from "node:crypto";

const loopback = (url) =>
  ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
export function configuration(env = process.env) {
  const production = env.NODE_ENV === "production";
  const upstream = new URL(env.PULSE_API_ORIGIN || "http://127.0.0.1:8787");
  const origin = new URL(env.PULSE_H5_ORIGIN || "http://127.0.0.1:8080").origin;
  if (!["http:", "https:"].includes(upstream.protocol))
    throw Error("API origin must use HTTP or HTTPS");
  if (
    upstream.username ||
    upstream.password ||
    upstream.pathname !== "/" ||
    upstream.search ||
    upstream.hash
  )
    throw Error("PULSE_API_ORIGIN must be a plain origin");
  if (
    production &&
    ((upstream.protocol !== "https:" && !loopback(upstream)) ||
      !env.PULSE_H5_ORIGIN ||
      !origin.startsWith("https:"))
  )
    throw Error(
      "Production requires HTTPS H5 and HTTPS or loopback API origins",
    );
  const localUser = env.PULSE_DEV_USER || "";
  if (
    localUser &&
    (production || !loopback(upstream) || !loopback(new URL(origin)))
  )
    throw Error(
      "Development identity is loopback-only and forbidden in production",
    );
  return {
    production,
    upstream,
    origin,
    localUser,
    appleClientId: env.PULSE_APPLE_WEB_CLIENT_ID || "",
  };
}
export const isPublic = (method, path) =>
  (method === "GET" &&
    (/^\/v1\/(feed|client-configuration|generation-capabilities|auth-configuration)$/.test(
      path,
    ) ||
      /^\/v1\/(public\/|artifacts\/)/.test(path) ||
      /^\/v1\/works\/[^/]+(\/comments)?$/.test(path))) ||
  (/^(POST|DELETE)$/.test(method) &&
    /^\/v1\/(play-sessions(?:\/[^/]+\/(events|challenge))?|growth\/(visits|identity)|client-events)$/.test(
      path,
    ));
export function allowedPath(path) {
  try {
    path = decodeURIComponent(path);
  } catch {
    return false;
  }
  if (path.includes("%")) return false;
  return (
    path.startsWith("/v1/") &&
    !/^\/v1\/(admin|auth|agent-runs)(\/|$)/.test(path) &&
    !/%2f|%5c|\\|\.\./i.test(path)
  );
}
export async function readJSON(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_048_576)
      throw Object.assign(Error("Request is too large"), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

export function createGateway(config) {
  // Opaque browser cookie. Upstream credentials never leave this process.
  // Sessions intentionally expire on restart; use one instance or a shared store in deployment.
  const sessions = new Map();
  const grants = new Map();
  const cookieName = config.production ? "__Host-pulse" : "pulse-local";
  function cookie(res, value, maxAge = 604800) {
    res.setHeader(
      "Set-Cookie",
      `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.production ? "; Secure" : ""}`,
    );
  }
  function find(req) {
    const id = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    const s = sessions.get(id);
    if (s && s.expires < Date.now()) {
      sessions.delete(id);
      return [];
    }
    return [id, s];
  }
  function save(res, session, oldId) {
    if (oldId) sessions.delete(oldId);
    for (const [id, s] of sessions)
      if (s.expires < Date.now()) sessions.delete(id);
    if (sessions.size >= 10000)
      throw Object.assign(Error("Please retry later"), { status: 503 });
    const id = randomBytes(32).toString("hex");
    sessions.set(id, { ...session, expires: Date.now() + 604800000 });
    cookie(res, id);
  }
  async function upstream(path, method = "GET", body, session, extra = {}) {
    if (
      session?.tokens &&
      Date.parse(session.tokens.accessExpiresAt) < Date.now() + 30000
    ) {
      session.refresh ??= (async () => {
        const r = await fetch(new URL("/v1/auth/refresh", config.upstream), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw Object.assign(Error("请重新登录"), { status: 401 });
        const data = await r.json();
        session.tokens = data.session;
        session.user = data.user;
      })().finally(() => {
        delete session.refresh;
      });
      await session.refresh;
    }
    return fetch(new URL(path, config.upstream), {
      method,
      headers: {
        ...extra,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(session?.tokens
          ? { Authorization: `Bearer ${session.tokens.accessToken}` }
          : config.localUser
            ? {
                "X-Pulse-User": session?.dev
                  ? config.localUser
                  : "pulse.h5.visitor",
              }
            : {}),
        "X-Pulse-Client-Platform": "web",
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
  }
  return async (req, res) => {
    const url = new URL(req.url, config.origin),
      path = url.pathname.startsWith("/api/v1/")
        ? url.pathname.slice(4)
        : url.pathname,
      method = req.method || "GET";
    if (
      !path.startsWith("/v1/") &&
      !path.startsWith("/session") &&
      !path.startsWith("/play/")
    )
      return false;
    try {
      // A capability is bound to one Artifact and one live server session. It lets
      // opaque sandbox frames load relative files without exposing account tokens.
      if (path.startsWith("/play/")) {
        const match = /^\/play\/([a-f0-9]{64})\/(.+)$/.exec(path),
          grant = match && grants.get(match[1]);
        if (
          method !== "GET" ||
          !grant ||
          grant.expires < Date.now() ||
          (grant.sessionId && !sessions.has(grant.sessionId))
        )
          return (
            json(res, 404, {
              error: { message: "播放授权已失效，请重新载入" },
            }),
            true
          );
        const suffix = decodeURIComponent(match[2]);
        if (
          suffix.includes("..") ||
          suffix.includes("\\") ||
          suffix.includes("%")
        )
          return (json(res, 404, {}), true);
        const active = grant.sessionId
          ? sessions.get(grant.sessionId)
          : undefined;
        if (active && active.expires < Date.now())
          return (json(res, 401, {}), true);
        const response = await upstream(
          `/v1/artifacts/${grant.artifactId}/files/${suffix}${url.search}`,
          "GET",
          undefined,
          active,
        );
        for (const key of ["content-type", "content-security-policy"])
          if (response.headers.has(key))
            res.setHeader(key, response.headers.get(key));
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.statusCode = response.status;
        if (response.body)
          for await (const chunk of response.body) res.write(chunk);
        res.end();
        return true;
      }
      // Reject cross-site requests, including credentialed reads, before reaching the API.
      if (
        req.headers["sec-fetch-site"] === "cross-site" ||
        (method !== "GET" && req.headers.origin !== config.origin)
      )
        return (
          json(res, 403, { error: { message: "请求来源不受信任" } }),
          true
        );
      const [id, session] = find(req);
      if (path === "/session" && method === "GET") {
        let user = session?.user || null;
        if (session) {
          const r = await upstream("/v1/me", "GET", undefined, session);
          if (!r.ok) {
            if (r.status === 401 || r.status === 403) {
              sessions.delete(id);
              cookie(res, "", 0);
              user = null;
            } else throw Error("暂时无法恢复登录");
          } else {
            user = (await r.json()).user;
            session.user = user;
          }
        }
        const authResponse = await fetch(new URL("/v1/auth-configuration", config.upstream), {redirect:"error",signal:AbortSignal.timeout(3000)}).catch(()=>null);
        const authConfig = authResponse?.ok ? await authResponse.json() : {};
        json(res, 200, {
          user,
          localLogin: !!config.localUser,
          appleClientId: authConfig.appleEnabled
            ? authConfig.appleWebClientId || config.appleClientId
            : "",
          redirectURI: config.origin + "/login",
        });
        return true;
      }
      if (path === "/session/artifact" && method === "POST") {
        const { artifactId } = await readJSON(req);
        if (
          typeof artifactId !== "string" ||
          !/^[a-f0-9-]{36}$/i.test(artifactId)
        )
          return (json(res, 400, {}), true);
        const check = await upstream(
          `/v1/artifacts/${artifactId}`,
          "GET",
          undefined,
          session,
        );
        if (!check.ok)
          return (
            json(res, check.status, {
              error: { message: "无权访问此版本或作品已失效" },
            }),
            true
          );
        const metadata = await check.json();
        const entryFile = metadata.artifact?.entryFile;
        if (
          typeof entryFile !== "string" ||
          !/^[\w./-]+$/.test(entryFile) ||
          entryFile.includes("..") ||
          entryFile.startsWith("/")
        )
          return (json(res, 502, { error: { message: "作品入口无效" } }), true);
        for (const [key, g] of grants)
          if (g.expires < Date.now()) grants.delete(key);
        if (grants.size >= 10000) return (json(res, 503, {}), true);
        const token = randomBytes(32).toString("hex");
        grants.set(token, {
          artifactId,
          sessionId: session ? id : undefined,
          expires: Date.now() + 1800000,
        });
        json(res, 200, { base: `/play/${token}/`, entryFile });
        return true;
      }
      if (path === "/session/local" && method === "POST") {
        if (!config.localUser)
          return (
            json(res, 404, { error: { message: "本地登录未启用" } }),
            true
          );
        const s = { dev: true };
        const r = await upstream("/v1/me", "GET", undefined, s);
        const data = await r.json();
        if (!r.ok) return (json(res, r.status, data), true);
        save(res, { ...s, user: data.user }, id);
        json(res, 200, { user: data.user });
        return true;
      }
      if (path === "/session/apple" && method === "POST") {
        if (!config.appleClientId)
          return (
            json(res, 503, { error: { message: "消费者 Web 登录尚未配置" } }),
            true
          );
        const input = await readJSON(req);
        const r = await upstream("/v1/auth/apple", "POST", {
          identityToken: input.identityToken,
          nonce: input.nonce,
          displayName: input.displayName,
        });
        const data = await r.json();
        if (!r.ok) return (json(res, r.status, data), true);
        save(res, { tokens: data.session, user: data.user }, id);
        json(res, 200, { user: data.user });
        return true;
      }
      if (path === "/session/logout" && method === "POST") {
        if (session?.tokens) {
          const r = await upstream("/v1/auth/logout", "POST", {}, session);
          if (!r.ok && r.status !== 401)
            return (
              json(res, r.status, { error: { message: "退出失败，请重试" } }),
              true
            );
        }
        sessions.delete(id);
        cookie(res, "", 0);
        json(res, 200, { ok: true });
        return true;
      }
      if (!allowedPath(path))
        return (json(res, 404, { error: { message: "接口不可用" } }), true);
      if (!session && !isPublic(method, path))
        return (json(res, 401, { error: { message: "请先登录" } }), true);
      const body =
        method === "GET" || method === "HEAD" ? undefined : await readJSON(req);
      const headers = {};
      if (req.headers["idempotency-key"])
        headers["Idempotency-Key"] = req.headers["idempotency-key"];
      if (req.headers.range) headers.Range = req.headers.range;
      const response = await upstream(
        path + url.search,
        method,
        body,
        session,
        headers,
      );
      for (const key of [
        "content-type",
        "content-security-policy",
        "content-range",
        "accept-ranges",
        "retry-after",
      ])
        if (response.headers.has(key))
          res.setHeader(key, response.headers.get(key));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Sandboxed Artifact modules have opaque origin; only Artifact files allow CORS.
      if (/^\/v1\/artifacts\/[^/]+\/files\//.test(path))
        res.setHeader("Access-Control-Allow-Origin", "*");
      res.statusCode = response.status;
      if (response.body)
        for await (const chunk of response.body) res.write(chunk);
      res.end();
      return true;
    } catch (error) {
      if (!res.headersSent)
        json(res, error.status || 502, {
          error: {
            message:
              error.status === 401
                ? "登录已过期，请重新登录"
                : error.status === 413
                  ? "文件过大"
                  : "服务暂时不可用，请稍后重试",
          },
        });
      else res.end();
      return true;
    }
  };
}
