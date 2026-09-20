import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { ArrowLeft, LoaderCircle, X, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
export function Button({
  children,
  busy,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${className}`}
    >
      {busy ? <LoaderCircle size={18} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Header({
  title,
  back = false,
  children,
}: {
  title: string;
  back?: boolean;
  children?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <header className="page-header">
      <div className="inline">
        {back ? (
          <button
            className="icon-button"
            aria-label="返回"
            onClick={() => nav(-1)}
          >
            <ArrowLeft />
          </button>
        ) : null}
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="notice" role="status">
      {children}
    </p>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="empty">
      <Sparkles size={34} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      正在加载…
    </div>
  );
}
let sheetCount = 0;
let unlockedOverflow = "";
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    let active = true;
    const id = crypto.randomUUID(),
      href = window.location.href;
    const arm = () => {
      if (active && window.location.href === href)
        history.pushState(
          {
            ...history.state,
            idx: (history.state?.idx || 0) + 1,
            pulseSheet: id,
          },
          "",
          href,
        );
    };
    // Defer so React's StrictMode setup/cleanup probe never adds a history entry.
    queueMicrotask(arm);
    const pop = () => {
      if (history.state?.pulseSheet === id) return;
      closeRef.current();
      setTimeout(() => {
        if (active && d.open && history.state?.pulseSheet !== id) arm();
      }, 0);
    };
    window.addEventListener("popstate", pop);
    if (sheetCount === 0) unlockedOverflow = document.body.style.overflow;
    sheetCount++;
    document.body.style.overflow = "hidden";
    return () => {
      active = false;
      window.removeEventListener("popstate", pop);
      d.close();
      sheetCount--;
      if (sheetCount === 0) document.body.style.overflow = unlockedOverflow;
      if (history.state?.pulseSheet === id) history.back();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="sheet"
    >
      <div className="sheet-inner">
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function useResource<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loader()
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [...deps, revision]);
  return {
    data,
    setData,
    error,
    loading,
    reload: () => setRevision((n) => n + 1),
  };
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <Empty
      title="暂时无法加载"
      action={<Button onClick={retry}>重新连接</Button>}
    >
      {message}
    </Empty>
  );
}
