// Explicit opt-in: creates synthetic content only on a loopback, deterministic API.
import assert from "node:assert/strict";
const root = new URL(process.env.PULSE_E2E_API || "http://127.0.0.1:18887");
assert(
  ["localhost", "127.0.0.1"].includes(root.hostname),
  "Integration tests require a loopback API",
);
async function call(
  path,
  method = "GET",
  body,
  user = "pulse.fixture.creator",
) {
  const r = await fetch(new URL("/v1/" + path, root), {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Pulse-User": user,
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  assert(r.ok, `${method} ${path}: ${r.status} ${JSON.stringify(d)}`);
  return d;
}
assert.equal(
  (await call("generation-capabilities")).mode,
  "deterministic-local",
);
const { work } = await call("works", "POST", {
  instruction: "生成可触控、有暂停按钮的贪吃蛇",
  title: "贪吃蛇 · 本地验收作品",
  creationMode: "original",
  allowRemix: true,
});
async function generate(id, user = "pulse.fixture.creator", base) {
  let { generation } = await call(
    `works/${id}/generations`,
    "POST",
    {
      instruction: "生成可触控、有暂停按钮的贪吃蛇",
      assetIds: [],
      ...(base ? { baseArtifactId: base } : {}),
    },
    user,
  );
  for (let i = 0; i < 150; i++) {
    generation = (
      await call(`generations/${generation.id}`, "GET", undefined, user)
    ).generation;
    if (
      ["succeeded", "failed", "cancelled", "fallback_ready"].includes(
        generation.stage,
      )
    )
      break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(generation.stage, "succeeded");
  return generation;
}
const job = await generate(work.id);
await call(`generations/${job.id}/plan`);
await call(`verifications/${job.verificationId}`);
const published = (
  await call(`works/${work.id}/publish`, "POST", {
    title: work.title,
    theme: "本地 API 验收生成，可开始、暂停和触控转向。",
    artifactId: job.artifactId,
  })
).work;
assert(published.publicSlug);
assert((await call("feed?mode=latest")).data.some((w) => w.id === work.id));
await call(`works/${work.id}/like`, "PUT", undefined, "pulse.h5.e2e");
const comment = (
  await call(
    `works/${work.id}/comments`,
    "POST",
    { body: "本地 H5 契约验收评论", score: 5 },
    "pulse.h5.e2e",
  )
).comment;
assert(
  (await call(`works/${work.id}/comments`)).data.some(
    (c) => c.id === comment.id,
  ),
);
await call(`works/${work.id}/save`, "PUT", undefined, "pulse.h5.e2e");
assert(
  (await call("me/saved", "GET", undefined, "pulse.h5.e2e")).data.some(
    (w) => w.id === work.id,
  ),
);
const remix = (
  await call(
    "works",
    "POST",
    {
      instruction: "让贪吃蛇更慢一些",
      creationMode: "remix",
      parentWorkId: work.id,
      parentArtifactId: job.artifactId,
    },
    "pulse.h5.e2e",
  )
).work;
assert.equal(remix.parentId, work.id);
assert.equal(remix.originalCreator, "pulse.fixture.creator");
await generate(remix.id, "pulse.h5.e2e");
const candidate = await generate(
  work.id,
  "pulse.fixture.creator",
  job.artifactId,
);
const publicBefore = (await call(`public/works/${published.publicSlug}`)).work;
assert.equal(publicBefore.artifactId, job.artifactId);
assert(
  (await call(`works/${work.id}/versions`)).data.some(
    (v) => v.artifactId === candidate.artifactId && !v.isPublished,
  ),
);
await call(`works/${work.id}/publish`, "POST", {
  title: work.title,
  theme: "第二版",
  artifactId: candidate.artifactId,
});
assert.equal(
  (await call(`public/works/${published.publicSlug}`)).work.artifactId,
  candidate.artifactId,
);
await call(`works/${work.id}/unpublish`, "POST");
const gone = await fetch(
  new URL("/v1/public/works/" + published.publicSlug, root),
);
assert([404, 410].includes(gone.status));
// Re-publish a synthetic fixture for browser acceptance of another creator's work.
const final = (
  await call(`works/${work.id}/publish`, "POST", {
    title: work.title,
    theme: "本地 API 验收作品 · 触控、暂停和重新开始。",
    artifactId: candidate.artifactId,
  })
).work;
console.log(
  JSON.stringify(
    {
      passed: true,
      checks: [
        "generate",
        "plan",
        "verification",
        "publish",
        "feed",
        "comment",
        "like",
        "save",
        "remix-lineage",
        "private-candidate",
        "version-publish",
        "revocation",
      ],
      fixtureWork: work.id,
      publicSlug: final.publicSlug,
    },
    null,
    2,
  ),
);
