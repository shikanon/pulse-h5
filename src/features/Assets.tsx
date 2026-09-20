import { useEffect, useRef, useState } from "react";
import { Upload, Image, Music, Film, Check, X } from "lucide-react";
import { api, part, type Asset, type List } from "../shared/api";
import { Sheet, Button, Notice, Loading, useResource } from "../shared/ui";
import { useApp } from "../app/store";
export function Assets({
  selected,
  onChange,
  onClose,
  uploads,
  initialKind = "library",
}: {
  selected: Asset[];
  onChange: (a: Asset[]) => void;
  onClose: () => void;
  uploads: boolean;
  initialKind?: "library" | "media" | "audio";
}) {
  const r = useResource(() => api<List<Asset>>("assets/library"), []),
    [tab, setTab] = useState(initialKind === "library" ? "public" : "private"),
    [progress, setProgress] = useState<number>(),
    [error, setError] = useState(""),
    xhr = useRef<XMLHttpRequest | undefined>(undefined),
    uploadId = useRef<string | undefined>(undefined),
    cancelled = useRef(false),
    input = useRef<HTMLInputElement>(null),
    { toast } = useApp();
  useEffect(
    () => () => {
      cancelled.current = true;
      xhr.current?.abort();
      if (uploadId.current)
        void api(`assets/uploads/${part(uploadId.current)}`, "DELETE").catch(
          () => {},
        );
    },
    [],
  );
  function add(a: Asset) {
    if (selected.some((v) => v.id === a.id)) {
      onChange(selected.filter((v) => v.id !== a.id));
      return;
    }
    if (
      selected.length >= 8 ||
      selected.reduce((s, v) => s + v.sizeBytes, 0) + a.sizeBytes >
        4 * 1024 * 1024
    ) {
      setError("每次最多 8 项素材，合计不超过 4 MiB。");
      return;
    }
    onChange([...selected, a]);
  }
  async function upload(file: File) {
    cancelled.current = false;
    setError("");
    if (
      file.size + selected.reduce((s, a) => s + a.sizeBytes, 0) >
        4 * 1024 * 1024 ||
      selected.length >= 8
    ) {
      setError("素材超出本轮 4 MiB 或 8 项限制。请先压缩或移除素材。");
      return;
    }
    setProgress(0);
    try {
      const grant = await api<{
        asset: Asset;
        upload: {
          url: string;
          method: string;
          headers: Record<string, string>;
          mode: string;
        };
      }>("assets/uploads", "POST", {
        fileName: file.name,
        mediaType: file.type,
        sizeBytes: file.size,
      });
      uploadId.current = grant.asset.id;
      if (cancelled.current) {
        await api(`assets/uploads/${part(grant.asset.id)}`, "DELETE");
        uploadId.current = undefined;
        throw Error("上传已取消");
      }
      const u = new URL(grant.upload.url);
      if (
        u.username ||
        u.password ||
        (u.protocol !== "https:" &&
          !(
            import.meta.env.DEV &&
            u.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(u.hostname)
          ))
      )
        throw Error("上传地址不受信任");
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest();
        xhr.current = x;
        x.open(grant.upload.method, u.href);
        x.timeout = 120000;
        for (const [k, v] of Object.entries(grant.upload.headers || {}))
          x.setRequestHeader(k, v);
        x.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 95));
        };
        x.onload = () =>
          x.status >= 200 && x.status < 300
            ? resolve()
            : reject(Error("上传失败，请重新选择文件重试"));
        x.onerror = () => reject(Error("网络中断，请重试"));
        x.ontimeout = () => reject(Error("上传超时，请重试"));
        x.onabort = () => reject(Error("上传已取消"));
        x.send(file);
      });
      setProgress(98);
      const complete = await api<{ asset: Asset }>(
        `assets/uploads/${part(grant.asset.id)}/complete`,
        "POST",
      );
      add(complete.asset);
      uploadId.current = undefined;
      toast("素材已添加");
      setTab("private");
      r.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(undefined);
      xhr.current = undefined;
      if (input.current) input.current.value = "";
    }
  }
  async function cancel() {
    cancelled.current = true;
    xhr.current?.abort();
    if (uploadId.current) {
      try {
        await api(`assets/uploads/${part(uploadId.current)}`, "DELETE");
        uploadId.current = undefined;
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  return (
    <Sheet
      title="素材库"
      onClose={() => {
        if (progress === undefined) onClose();
        else setError("请先完成或取消上传");
      }}
    >
      <p className="muted">
        图片、视频与音乐，让灵感更具体。已选 {selected.length} / 8
      </p>
      <div className="segments">
        {[
          ["public", "公共素材"],
          ["private", "我的素材"],
        ].map(([id, t]) => (
          <button
            className={id === tab ? "selected" : ""}
            onClick={() => setTab(id)}
            key={id}
          >
            {t}
          </button>
        ))}
      </div>
      {error ? <Notice>{error}</Notice> : null}
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <Notice>{r.error}</Notice>
      ) : (
        <div className="asset-list">
          {r.data?.data
            .filter((a) => a.library === tab && a.status === "ready")
            .map((a) => (
              <button
                key={a.id}
                className="asset-row"
                disabled={progress !== undefined}
                aria-pressed={selected.some((v) => v.id === a.id)}
                onClick={() => add(a)}
              >
                {a.kind === "audio" ? (
                  <Music />
                ) : a.kind === "video" ? (
                  <Film />
                ) : (
                  <Image />
                )}
                <span>
                  <strong>{a.displayName}</strong>
                  <small>
                    {a.summary || a.mediaType} ·{" "}
                    {Math.round(a.sizeBytes / 1024)} KB
                  </small>
                </span>
                {selected.some((v) => v.id === a.id) ? (
                  <Check className="lime" />
                ) : null}
              </button>
            ))}
          {!r.data?.data.some(
            (a) => a.library === tab && a.status === "ready",
          ) ? (
            <p className="muted">这里还没有素材。</p>
          ) : null}
        </div>
      )}
      {uploads ? (
        <>
          <input
            ref={input}
            type="file"
            hidden
            accept={
              initialKind === "audio"
                ? "audio/*"
                : initialKind === "media"
                  ? "image/*,video/*"
                  : "image/*,audio/*,video/*"
            }
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
            }}
          />
          {progress === undefined ? (
            <Button
              className="outline wide"
              onClick={() => input.current?.click()}
            >
              <Upload size={18} />
              上传素材
            </Button>
          ) : (
            <div className="inline">
              <progress max={100} value={progress} />
              <span>{progress}%</span>
              <Button onClick={cancel}>
                <X size={18} />
                取消
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="muted">当前服务未开启上传，仍可使用公共素材。</p>
      )}
      <Button
        className="primary wide"
        disabled={progress !== undefined}
        onClick={onClose}
      >
        完成选择
      </Button>
      <small className="muted">
        素材会随发布作品和允许的 Remix 进入交付内容。
      </small>
    </Sheet>
  );
}
