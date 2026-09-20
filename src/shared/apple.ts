type AppleResult = {
  authorization: { id_token: string; code: string; state: string };
  user?: { name?: { firstName: string; lastName: string } };
};
declare global {
  interface Window {
    AppleID?: {
      auth: { init: (o: unknown) => void; signIn: () => Promise<AppleResult> };
    };
  }
}
export async function appleSignIn(clientId: string, redirectURI: string) {
  if (!window.AppleID)
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src =
        "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
      s.onload = () => resolve();
      s.onerror = () => {
        s.remove();
        reject(Error("无法载入 Apple 登录，请重试"));
      };
      document.head.append(s);
    });
  const nonce = crypto.randomUUID(),
    state = crypto.randomUUID(),
    hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce)),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  window.AppleID!.auth.init({
    clientId,
    redirectURI,
    scope: "name email",
    state,
    nonce: hash,
    usePopup: true,
  });
  const r = await window.AppleID!.auth.signIn();
  if (r.authorization.state !== state) throw Error("登录校验失败，请重新登录");
  return {
    identityToken: r.authorization.id_token,
    nonce,
    authorizationCode: r.authorization.code,
    displayName: r.user?.name
      ? [r.user.name.firstName, r.user.name.lastName].join(" ")
      : undefined,
  };
}
