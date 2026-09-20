import { useState } from "react";
import { api } from "../shared/api";
import { Header, Button, Loading, Notice, useResource } from "../shared/ui";
type WalletData = {
  balance: number;
  valueFen: number;
  entries: {
    id: string;
    kind: string;
    amount: number;
    balance: number;
    createdAt: string;
  }[];
};
export default function Wallet() {
  const r = useResource(() => api<WalletData>("me/credits"), []);
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="page wallet">
      <Header title="我的积分" back />
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <Notice>{r.error}</Notice>
      ) : (
        r.data && (
          <>
            <section className="wallet-balance">
              <p>可用积分</p>
              <h2>{r.data.balance.toLocaleString()}</h2>
              <p>
                1 积分 = ¥0.01 · 当前面值 ¥
                {((r.data.balance * r.data.valueFen) / 100).toFixed(2)}
              </p>
              <small>新用户获赠 10000 积分。积分用于平台内消费。</small>
            </section>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setMessage("");
                try {
                  await api("me/credits/redeem", "POST", { code: code.trim() });
                  setCode("");
                  setMessage("兑换成功，积分已到账");
                  r.reload();
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>卡券充值</h2>
              <label>
                兑换码
                <input
                  aria-label="兑换码"
                  autoComplete="off"
                  value={code}
                  maxLength={128}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="输入 PULSE 开头的卡券兑换码"
                />
              </label>
              <Button
                type="submit"
                className="primary wide"
                disabled={!code.trim()}
                busy={busy}
              >
                兑换充值
              </Button>
            </form>
            {message && <Notice>{message}</Notice>}
            <h2>积分明细</h2>
            {[...r.data.entries].reverse().map((entry) => (
              <article className="wallet-entry" key={entry.id}>
                <div>
                  <strong>
                    {entry.kind === "welcome" ? "新用户赠送" : "卡券充值"}
                  </strong>
                  <p>{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <strong>+{entry.amount.toLocaleString()}</strong>
              </article>
            ))}
          </>
        )
      )}
    </div>
  );
}
