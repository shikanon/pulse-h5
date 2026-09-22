import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { configuration, createGateway, clientIP } from "../server/gateway.mjs";
test("forwarded client IP is accepted only from an explicitly trusted local proxy", () => {
  const req = {
    socket: { remoteAddress: "127.0.0.1" },
    headers: { "x-real-ip": "203.0.113.10" },
  };
  assert.equal(clientIP(req, { trustProxy: false }), "127.0.0.1");
  assert.equal(clientIP(req, { trustProxy: true }), "203.0.113.10");
  assert.equal(
    clientIP(
      { ...req, socket: { remoteAddress: "198.51.100.4" } },
      { trustProxy: true },
    ),
    "198.51.100.4",
  );
  assert.equal(
    clientIP(
      { ...req, headers: { "x-real-ip": "attacker, 1.2.3.4" } },
      { trustProxy: true },
    ),
    "127.0.0.1",
  );
});
test("email session gateway keeps bearer tokens private and rejects forged origins", async () => {
  let seen;
  const upstream = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    seen = {
      path: req.url,
      body: JSON.parse(body),
      authorization: req.headers.authorization,
    };
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        user: { id: "email-user" },
        session: {
          accessToken: "private-access",
          refreshToken: "private-refresh",
          accessExpiresAt: "2099-01-01T00:00:00Z",
        },
      }),
    );
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  const origin = "http://pulse.test";
  const gateway = createGateway(
    configuration({
      PULSE_H5_ORIGIN: origin,
      PULSE_API_ORIGIN: `http://127.0.0.1:${upstream.address().port}`,
    }),
  );
  const server = http.createServer(gateway);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const request = {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Authorization: "Bearer forged",
      },
      body: JSON.stringify({
        email: "test@example.com",
        password: "synthetic-test-only",
        role: "admin",
      }),
    };
    const forged = await fetch(base + "/session/email/register", {
      ...request,
      headers: { ...request.headers, Origin: "https://attacker.example" },
    });
    assert.equal(forged.status, 403);
    for (const action of ["register", "login"]) {
      const response = await fetch(base + "/session/email/" + action, request);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { user: { id: "email-user" } });
      assert.match(response.headers.get("set-cookie"), /HttpOnly/);
      assert.equal(seen.path, "/v1/auth/email/" + action);
      assert.equal(seen.authorization, undefined);
      assert.equal(seen.body.role, undefined);
    }
  } finally {
    await new Promise((r) => server.close(r));
    await new Promise((r) => upstream.close(r));
  }
});
