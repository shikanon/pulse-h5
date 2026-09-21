import { useState } from "react";
import { api, part, type Asset, type Work } from "../shared/api";
import { useResource } from "../shared/ui";
import { useApp } from "../app/store";
import { Assets } from "./Assets";

export function CoverEditor({
  work,
  onSave,
  onClose,
}: {
  work: Work;
  onSave: (work: Work) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Asset[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useApp();
  const cap = useResource(
    () => api<{ materialUploads?: boolean }>("generation-capabilities"),
    [],
  );
  return (
    <Assets
      selected={selected}
      onChange={setSelected}
      uploads={cap.data?.materialUploads === true}
      initialKind="media"
      coverMode
      saving={saving}
      onClose={onClose}
      onConfirm={async () => {
        setSaving(true);
        try {
          const result = await api<{ work: Work }>(
            `works/${part(work.id)}/cover`,
            "PATCH",
            { assetId: selected[0]?.id || "" },
          );
          onSave(result.work);
          window.dispatchEvent(new Event("pulse:feed-refresh"));
          toast(
            selected.length ? "封面已保存" : "已移除封面，首页展示游戏预览",
          );
          onClose();
        } catch (e) {
          toast((e as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
