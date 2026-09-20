import type { Asset } from "./api";
export type MaterialRole =
  | "automatic"
  | "character"
  | "background"
  | "reaction"
  | "reference"
  | "music"
  | "sound"
  | "clip";
export type Material = {
  id: string;
  name: string;
  role: MaterialRole;
  placement: string;
};
export type CreationContext = { preserve: string; materials: Material[] };
export const roleLabels: Record<MaterialRole, string> = {
  automatic: "根据创意决定",
  character: "角色或物体",
  background: "背景",
  reaction: "反馈或奖励",
  reference: "仅作视觉参考",
  music: "背景音乐",
  sound: "音效",
  clip: "视频片段",
};
export const rolesFor = (kind: string): MaterialRole[] =>
  kind === "audio"
    ? ["music", "sound"]
    : kind === "video"
      ? ["clip", "reference"]
      : ["automatic", "character", "background", "reaction", "reference"];
const separator = "\n\n--- Pulse creation context ---\n";
const guidance =
  "Follow this author's material direction. Match each material id to the approved local asset path in the Plan. Use actual staged files for character/background/reaction/music/sound/clip roles. A reaction must be linked to the described gameplay event and must not block controls. A reference is visual inspiration only: inspect it if supported; do not embed it in the runtime or claim visual understanding you did not perform. Keep audio muted until user interaction, provide mute, and avoid autoplay video audio. Preserve the listed existing behavior unless this turn explicitly changes it. In a Remix, keep existing source and embedded media unless the author requests replacement. Verify material placement and event behavior in the working preview.";
export function selectedContext(
  context: CreationContext,
  assets: Asset[],
): CreationContext {
  return {
    preserve: context.preserve.slice(0, 800),
    materials: assets.map((a) => {
      const current = context.materials.find((m) => m.id === a.id),
        choices = rolesFor(a.kind);
      return {
        id: a.id,
        name: a.displayName,
        role:
          current && choices.includes(current.role) ? current.role : choices[0],
        placement: (current?.placement || "").slice(0, 400),
      };
    }),
  };
}
export function creationInstruction(message: string, context: CreationContext) {
  return !context.preserve.trim() && !context.materials.length
    ? message
    : message + separator + JSON.stringify(context) + "\n" + guidance;
}
export function parseCreation(instruction: string): {
  message: string;
  context: CreationContext;
} {
  const empty = { preserve: "", materials: [] };
  const index = instruction.lastIndexOf(separator);
  if (index < 0) return { message: instruction, context: empty };
  try {
    const c = JSON.parse(
      instruction.slice(index + separator.length).split("\n")[0],
    );
    if (
      typeof c.preserve !== "string" ||
      !Array.isArray(c.materials) ||
      c.materials.some(
        (m: Material) =>
          !m ||
          typeof m.id !== "string" ||
          typeof m.name !== "string" ||
          typeof m.placement !== "string" ||
          !Object.hasOwn(roleLabels, m.role),
      )
    )
      throw Error();
    return { message: instruction.slice(0, index), context: c };
  } catch {
    return { message: instruction, context: empty };
  }
}
