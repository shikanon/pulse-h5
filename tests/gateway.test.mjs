import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  configuration,
  createGateway,
  allowedPath,
  isPublic,
} from "../server/gateway.mjs";

test("development identity cannot target production or a nonlocal API", () => {
  for (const env of [
    { NODE_ENV: "production", PULSE_DEV_USER: "test" },
    { PULSE_DEV_USER: "test", PULSE_API_ORIGIN: "https://api.example.org" },
    { PULSE_DEV_USER: "test", PULSE_H5_ORIGIN: "https://app.example.org" },
  ])
    assert.throws(() => configuration(env));
  assert.equal(
    configuration({ PULSE_DEV_USER: "pulse.test" }).localUser,
    "pulse.test",
  );
});
test("credentials and non-origin upstream URLs are rejected", () => {
  for (const origin of [
    "https://secret@example.org",
    "https://example.org/path",
    "https://example.org/?token=secret",
  ])
    assert.throws(() => configuration({ PULSE_API_ORIGIN: origin }));
});
test("admin and direct token APIs cannot be reached through the public gateway", () => {
  for (const path of [
    "/v1/admin/users",
    "/v1/%61dmin/users",
    "/v1/%2561dmin/users",
    "/v1/auth/apple/admin",
    "/v1/auth/refresh",
    "/v1/agent-runs/a",
    "/v1/foo%2f..%2fadmin",
  ])
    assert.equal(allowedPath(path), false, path);
  assert.equal(allowedPath("/v1/works/123/comments"), true);
  assert.equal(isPublic("POST", "/v1/works"), false);
  assert.equal(isPublic("GET", "/v1/me"), false);
  assert.equal(isPublic("GET", "/v1/feed"), true);
});
test("gateway blocks forged origins and unauthenticated member mutations", async () => {
  const gateway = createGateway(configuration({})),
    server = http.createServer(async (req, res) => {
      if (!(await gateway(req, res))) {
        res.writeHead(404);
        res.end();
      }
    });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(
      (
        await fetch(base + "/api/v1/works", {
          method: "POST",
          headers: { Origin: "https://evil.example" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/v1/works", {
          method: "POST",
          headers: { Origin: "http://127.0.0.1:8080" },
          body: "{}",
        })
      ).status,
      401,
    );
    assert.equal((await fetch(base + "/v1/admin/users")).status, 404);
    assert.equal(
      (
        await fetch(base + "/session/local", {
          method: "POST",
          headers: { Origin: "http://127.0.0.1:8080" },
        })
      ).status,
      404,
    );
    const s = await (await fetch(base + "/session")).json();
    assert.equal(s.user, null);
    assert.equal(s.localLogin, false);
    assert.equal(JSON.stringify(s).includes("accessToken"), false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test("private sandbox grants load files without cookies and expire on logout", async () => {
  const upstream = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.headers["x-pulse-user"] !== "pulse.test") {
      res.writeHead(403);
      return res.end("{}");
    }
    if (req.url === "/v1/me")
      return res.end(
        JSON.stringify({ user: { id: "u", username: "pulse.test" } }),
      );
    if (req.url.includes("/files/")) {
      res.setHeader("Content-Type", "text/javascript");
      return res.end("game()");
    }
    res.end(JSON.stringify({ artifact: { entryFile: "index.html" } }));
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  const config = configuration({
      PULSE_API_ORIGIN: `http://127.0.0.1:${upstream.address().port}`,
      PULSE_DEV_USER: "pulse.test",
    }),
    gateway = createGateway(config);
  const server = http.createServer((req, res) => gateway(req, res));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`,
    headers = { Origin: config.origin, "Content-Type": "application/json" };
  try {
    const auth = await fetch(base + "/session/local", {
      method: "POST",
      headers,
    });
    const cookie = auth.headers.get("set-cookie").split(";")[0];
    assert.match(auth.headers.get("set-cookie"), /HttpOnly/);
    const body = JSON.stringify({
      artifactId: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(
      (
        await fetch(base + "/session/artifact", {
          method: "POST",
          headers,
          body,
        })
      ).status,
      403,
    );
    const grant = await (
      await fetch(base + "/session/artifact", {
        method: "POST",
        headers: { ...headers, Cookie: cookie },
        body,
      })
    ).json();
    const script = await fetch(base + grant.base + "app.js", {
      headers: { "Sec-Fetch-Site": "cross-site" },
    });
    assert.equal(script.status, 200);
    assert.equal(await script.text(), "game()");
    assert.equal(
      (await fetch(base + grant.base + "app.js", { method: "POST" })).status,
      404,
    );
    await fetch(base + "/session/logout", {
      method: "POST",
      headers: { ...headers, Cookie: cookie },
    });
    assert.equal((await fetch(base + grant.base + "app.js")).status, 404);
  } finally {
    await new Promise((r) => server.close(r));
    await new Promise((r) => upstream.close(r));
  }
});


test("production accepts same-host private API but rejects unencrypted remote API", () => {
  const base = {NODE_ENV: "production", PULSE_H5_ORIGIN: "https://pulse.example"};
  assert.equal(configuration({...base, PULSE_API_ORIGIN: "http://127.0.0.1:18793"}).production, true);
  assert.throws(() => configuration({...base, PULSE_API_ORIGIN: "http://10.0.0.1:8787"}));
  assert.throws(() => configuration({...base, PULSE_API_ORIGIN: "http://127.0.0.1:18793", PULSE_DEV_USER: "test"}));
});
