import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { api, safeLink, type User } from "../shared/api";
import { appleSignIn } from "../shared/apple";
import { Header, Button, Notice } from "../shared/ui";
import { useApp } from "../app/store";
export default function Login() {
  const { session, config, refresh } = useApp(),
    location = useLocation(),
    nav = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accept, setAccept] = useState(false);
  const raw = location.state?.returnTo;
  const returnTo =
    typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
      ? raw
      : "/me";
  const termsRequired =
    !!config.termsURL &&
    !!config.termsVersion &&
    session.user?.termsAcceptance?.version !== config.termsVersion;
  async function login(local = false) {
    setBusy(true);
    setError("");
    try {
      let user = session.user;
      if (!user) {
        const credentials = local
          ? undefined
          : await appleSignIn(session.appleClientId, session.redirectURI);
        const r = await api<{ user: User }>(
          local ? "/session/local" : "/session/apple",
          "POST",
          credentials,
        );
        user = r.user;
        const guestKey = `pulse.h5.draft.v1:guest:${returnTo}`;
        const draft = localStorage.getItem(guestKey);
        if (draft) {
          localStorage.setItem(
            `pulse.h5.draft.v1:${user.id}:${returnTo}`,
            draft,
          );
          localStorage.removeItem(guestKey);
        }
      }
      if (accept && config.termsVersion)
        await api("me/terms-acceptance", "POST");
      await refresh();
      const pending = sessionStorage.getItem("pulse.h5.intent");
      sessionStorage.removeItem("pulse.h5.intent");
      if (pending) {
        const intent = JSON.parse(pending);
        if (
          intent.returnTo === returnTo &&
          ["like", "save"].includes(intent.kind) &&
          typeof intent.workId === "string"
        )
          await api(
            `works/${encodeURIComponent(intent.workId)}/${intent.kind}`,
            "PUT",
          );
      }
      nav(returnTo, { replace: true });
    } catch (e) {
      setError((e as Error).message || "登录已取消，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page login">
      <Header title="Pulse" back />
      <div className="login-mark">
        <Activity size={48} />
      </div>
      <h2>
        让灵感
        <br />
        <em>在这里发生。</em>
      </h2>
      <p className="muted">
        登录后即可创作、收藏和 Remix，
        <br />
        与你的互动世界保持连接。
      </p>
      {error ? <Notice>{error}</Notice> : null}
      {termsRequired ? (
        <label className="check-row">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
          />
          我已阅读并同意
          <a href={safeLink(config.termsURL)} target="_blank" rel="noreferrer">
            用户条款
          </a>
        </label>
      ) : null}
      {session.user ? (
        <Button
          className="primary wide"
          busy={busy}
          disabled={termsRequired && !accept}
          onClick={() => login()}
        >
          继续
          <ArrowRight size={18} />
        </Button>
      ) : session.localLogin ? (
        <>
          <Notice>本机隔离开发环境，使用合成测试账号。</Notice>
          <Button
            className="primary wide"
            busy={busy}
            disabled={termsRequired && !accept}
            onClick={() => login(true)}
          >
            使用本地测试账号
            <ArrowRight size={18} />
          </Button>
        </>
      ) : session.appleClientId ? (
        <Button
          className="primary wide"
          busy={busy}
          disabled={termsRequired && !accept}
          onClick={() => login()}
        >
          通过 Apple 登录
        </Button>
      ) : (
        <Notice>此环境暂未开放 Web 登录。你仍然可以浏览和游玩公开作品。</Notice>
      )}
      <Link className="button wide" to="/">
        先逛一逛
      </Link>
      <p className="privacy-note">
        <ShieldCheck size={16} />
        你的作品，在发布前仅自己可见。
      </p>
      {safeLink(config.privacyPolicyURL) ? (
        <a
          className="muted"
          href={safeLink(config.privacyPolicyURL)}
          target="_blank"
          rel="noreferrer"
        >
          隐私政策
        </a>
      ) : null}
    </div>
  );
}
