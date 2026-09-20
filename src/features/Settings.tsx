import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut,
  ExternalLink,
  Download,
  ChevronRight,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import { api, part, safeLink, type List, type User } from "../shared/api";
import { appleSignIn } from "../shared/apple";
import { Header, Button, Sheet, Notice } from "../shared/ui";
import { useApp } from "../app/store";
export default function Settings() {
  const { session, config, refresh, requireLogin, toast } = useApp(),
    nav = useNavigate(),
    [panel, setPanel] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(session.user?.displayName || ""),
    [username, setUsername] = useState(session.user?.username || ""),
    [rows, setRows] = useState<
      { id?: string; reason?: string; status?: string }[]
    >([]),
    [blocked, setBlocked] = useState<string[]>([]),
    [confirm, setConfirm] = useState(""),
    [allowRemix, setAllowRemix] = useState(
      () => localStorage.getItem("pulse.h5.allowRemix") !== "false",
    ),
    [consent, setConsent] = useState(
      () => localStorage.getItem("pulse.h5.analytics") === "true",
    );
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await api("/session/logout", "POST");
    for (const k of Object.keys(localStorage))
      if (k.startsWith("pulse.h5.draft.v1:")) localStorage.removeItem(k);
    await refresh();
    nav("/");
    toast("已退出登录");
  }
  return (
    <div className="page settings">
      <Header title="设置" back />
      <h2 className="section-label">账号与创作</h2>
      <div className="setting-list">
        <button
          onClick={() => {
            if (requireLogin()) setPanel("profile");
          }}
        >
          <UserRound size={19} />
          <span>个人资料</span>
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => {
            if (requireLogin())
              void run(async () => {
                const r =
                  await api<
                    List<{ id: string; reason: string; status: string }>
                  >("me/reports");
                setRows(r.data);
                setPanel("reports");
              });
          }}
        >
          <ShieldCheck size={19} />
          <span>我的举报</span>
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => {
            if (requireLogin())
              void run(async () => {
                const r = await api<List<string>>("me/blocked-users");
                setBlocked(r.data);
                setPanel("blocked");
              });
          }}
        >
          <span>屏蔽名单</span>
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => {
            if (requireLogin())
              void run(async () => {
                const d = await api("me/export"),
                  blob = new Blob([JSON.stringify(d, null, 2)], {
                    type: "application/json",
                  }),
                  url = URL.createObjectURL(blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = "pulse-account-export.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast("账号数据已导出");
              });
          }}
        >
          <Download size={19} />
          <span>导出账号数据</span>
        </button>
      </div>
      <h2 className="section-label">创作偏好</h2>
      <label className="toggle-row">
        <span>
          新作品默认允许 Remix
          <small>仅影响之后新建的作品，可在作品详情单独调整。</small>
        </span>
        <input
          type="checkbox"
          checked={allowRemix}
          onChange={(e) => {
            setAllowRemix(e.target.checked);
            localStorage.setItem(
              "pulse.h5.allowRemix",
              String(e.target.checked),
            );
          }}
        />
      </label>
      <h2 className="section-label">隐私与体验</h2>
      <div className="setting-list">
        <label className="toggle-row">
          <span>
            使用情况统计<small>默认关闭，可随时停止并清除</small>
          </span>
          <input
            type="checkbox"
            disabled={busy}
            checked={consent}
            onChange={(e) => {
              const next = e.target.checked;
              void run(async () => {
                let deviceId =
                  localStorage.getItem("pulse.h5.device") ||
                  crypto.randomUUID();
                if (next) {
                  await api("growth/visits", "POST", {
                    platform: "web",
                    deviceId,
                    consent: true,
                  });
                  localStorage.setItem("pulse.h5.device", deviceId);
                } else {
                  await api("growth/identity", "DELETE", {
                    platform: "web",
                    deviceId,
                    consent: true,
                  });
                  localStorage.removeItem("pulse.h5.device");
                }
                localStorage.setItem("pulse.h5.analytics", String(next));
                setConsent(next);
                toast(next ? "已开启使用统计" : "已关闭并清除使用记录");
              });
            }}
          />
        </label>
        {[
          ["隐私政策", config.privacyPolicyURL],
          ["用户条款", config.termsURL],
          ["帮助与支持", config.supportURL],
        ].map(([label, url]) =>
          safeLink(url) ? (
            <a
              key={label}
              href={safeLink(url)}
              target="_blank"
              rel="noreferrer"
            >
              <span>{label}</span>
              <ExternalLink size={17} />
            </a>
          ) : null,
        )}
        <div className="setting-row">
          <span>语言</span>
          <span className="muted">简体中文</span>
        </div>
        <div className="setting-row">
          <span>版本</span>
          <span className="muted">Pulse H5 0.1.0</span>
        </div>
      </div>
      {session.user ? (
        <>
          <Button
            className="outline wide"
            busy={busy}
            onClick={() => setPanel("logout")}
          >
            <LogOut size={18} />
            退出登录
          </Button>
          <button
            className="text-button danger wide"
            onClick={() => setPanel("delete")}
          >
            删除账号
          </button>
        </>
      ) : (
        <Link className="button primary wide" to="/login">
          登录 Pulse
        </Link>
      )}
      {panel === "profile" ? (
        <Sheet title="个人资料" onClose={() => setPanel("")}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api<{ user: User }>("me", "PATCH", {
                  username,
                  displayName: name,
                });
                await refresh();
                setPanel("");
                toast("资料已保存");
              });
            }}
          >
            <label>
              用户名
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={32}
              />
            </label>
            <label>
              展示名称
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </label>
            <Button className="primary wide" busy={busy}>
              保存资料
            </Button>
          </form>
        </Sheet>
      ) : panel === "reports" ? (
        <Sheet title="我的举报" onClose={() => setPanel("")}>
          {rows.length ? (
            rows.map((r) => (
              <div className="setting-row" key={r.id}>
                <span>{r.reason}</span>
                <small>{r.status}</small>
              </div>
            ))
          ) : (
            <p className="muted">暂无举报记录。</p>
          )}
        </Sheet>
      ) : panel === "blocked" ? (
        <Sheet title="屏蔽名单" onClose={() => setPanel("")}>
          {blocked.length ? (
            blocked.map((u) => (
              <div className="setting-row" key={u}>
                <span>@{u}</span>
                <Button
                  busy={busy}
                  onClick={() =>
                    run(async () => {
                      await api(`users/${part(u)}/block`, "DELETE");
                      setBlocked((a) => a.filter((v) => v !== u));
                    })
                  }
                >
                  解除屏蔽
                </Button>
              </div>
            ))
          ) : (
            <p className="muted">没有屏蔽的用户。</p>
          )}
        </Sheet>
      ) : panel === "logout" ? (
        <Sheet title="退出 Pulse？" onClose={() => setPanel("")}>
          <p>服务端作品会保留，本浏览器的创作草稿将清除。</p>
          <Button
            className="primary wide"
            busy={busy}
            onClick={() => run(logout)}
          >
            确认退出
          </Button>
        </Sheet>
      ) : panel === "delete" ? (
        <Sheet title="删除账号" onClose={() => setPanel("")}>
          <p>
            删除将移除账号及相关内容，并取消进行中的生成任务。此操作不可撤销。
          </p>
          {!session.appleClientId ? (
            <Notice>当前环境未配置 Apple 重新认证，暂时无法删除账号。</Notice>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const proof = await appleSignIn(
                    session.appleClientId,
                    session.redirectURI,
                  );
                  await api(
                    "me",
                    "DELETE",
                    {
                      confirmation: confirm,
                      identityToken: proof.identityToken,
                      nonce: proof.nonce,
                      authorizationCode: proof.authorizationCode,
                    },
                    crypto.randomUUID(),
                  );
                  await logout();
                });
              }}
            >
              <label>
                输入 DELETE {session.user?.username}
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <Button
                className="danger wide"
                busy={busy}
                disabled={confirm !== `DELETE ${session.user?.username}`}
              >
                重新认证并删除
              </Button>
            </form>
          )}
        </Sheet>
      ) : null}
    </div>
  );
}
