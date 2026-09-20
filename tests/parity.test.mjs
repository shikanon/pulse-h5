import test from "node:test";
import assert from "node:assert/strict";
import {
  selectedContext,
  creationInstruction,
  parseCreation,
} from "../src/shared/creationContext.ts";
import { includesWork, lifecycle } from "../src/shared/workPresentation.ts";

test("creation instructions round-trip the iOS context contract without publishing private direction", () => {
  const context = {
    preserve: "保留原来的计分规则",
    materials: [
      {
        id: "asset-1",
        name: "cat.png",
        role: "reaction",
        placement: "通关时显示",
      },
    ],
  };
  const instruction = creationInstruction("把节奏调慢", context);
  assert.match(instruction, /\n\n--- Pulse creation context ---\n/);
  assert.deepEqual(parseCreation(instruction), {
    message: "把节奏调慢",
    context,
  });
  assert.equal(
    creationInstruction("原始创意", { preserve: "", materials: [] }),
    "原始创意",
  );
  assert.equal(parseCreation("普通消息").message, "普通消息");
});
test("material context drops removed files, constrains directions and normalizes roles by type", () => {
  const c = selectedContext(
    {
      preserve: "a".repeat(900),
      materials: [
        {
          id: "sound",
          name: "old",
          role: "character",
          placement: "b".repeat(500),
        },
        { id: "removed", name: "gone", role: "background", placement: "" },
      ],
    },
    [{ id: "sound", kind: "audio", displayName: "music.wav" }],
  );
  assert.equal(c.preserve.length, 800);
  assert.deepEqual(c.materials, [
    {
      id: "sound",
      name: "music.wav",
      role: "music",
      placement: "b".repeat(400),
    },
  ]);
});
test("malformed creation context never hides the original user instruction", () => {
  const raw =
    'idea\n\n--- Pulse creation context ---\n{"preserve":false,"materials":[]}';
  assert.equal(parseCreation(raw).message, raw);
});
test("profile distinguishes generating, private, rejected and deliberately revoked work as iOS does", () => {
  const w = {
    status: "draft",
    creationMode: "original",
    contentReviewStatus: "pending",
  };
  assert.equal(includesWork(w, "drafts"), true);
  assert.equal(includesWork({ ...w, status: "processing" }, "drafts"), false);
  assert.equal(includesWork({ ...w, status: "processing" }, "creating"), true);
  assert.equal(
    includesWork({ ...w, publicLinkRevokedAt: "2026-09-20" }, "drafts"),
    false,
  );
  assert.equal(
    includesWork({ ...w, publicLinkRevokedAt: "2026-09-20" }, "revoked"),
    true,
  );
  assert.equal(
    lifecycle({ ...w, publicLinkRevokedAt: "2026-09-20" }),
    "公开链接已撤销",
  );
  assert.equal(
    includesWork({ ...w, contentReviewStatus: "rejected" }, "attention"),
    true,
  );
  assert.equal(includesWork({ ...w, creationMode: "remix" }, "remixes"), true);
  assert.equal(includesWork({ ...w, status: "published" }, "published"), true);
});
