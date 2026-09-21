import test from "node:test";
import assert from "node:assert/strict";
import { coverSource } from "../src/shared/workCover.ts";
import { isPublic } from "../server/gateway.mjs";
test("optional covers use only a work-scoped route, never arbitrary media URLs", () => {
  assert.equal(coverSource({ id: "work" }), undefined);
  assert.equal(
    coverSource({ id: "work", cover: { kind: "audio" } }),
    undefined,
  );
  for (const kind of ["image", "video"])
    assert.equal(
      coverSource({
        id: "work",
        cover: { kind, assetId: "asset-1", url: "https://other/private" },
      }),
      "/api/v1/works/work/cover?asset=asset-1",
    );
});
test("anonymous clients may read covers but never edit them or read asset libraries", () => {
  assert.equal(isPublic("GET", "/v1/works/123/cover"), true);
  assert.equal(isPublic("PATCH", "/v1/works/123/cover"), false);
  assert.equal(isPublic("GET", "/v1/assets/123"), false);
});
