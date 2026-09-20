import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, type Session, type Configuration } from "../shared/api";
import { Loading, ErrorState, Empty } from "../shared/ui";
import { AppContext } from "./store";
export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({
      user: null,
      localLogin: false,
      appleClientId: "",
      redirectURI: "",
    }),
    [config, setConfig] = useState<Configuration>(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0),
    [creationRoute, setCreationRoute] = useState("/create");
  const nav = useNavigate(),
    location = useLocation();
  const refresh = async () => setSession(await api<Session>("/session"));
  useEffect(() => {
    let live = true;
    Promise.all([
      api<{ configuration: Configuration }>("client-configuration"),
      api<Session>("/session"),
    ])
      .then(([c, s]) => {
        if (live) {
          setConfig(c.configuration);
          setSession(s);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [revision]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4200);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    const expire = () => {
      setSession((s) => ({ ...s, user: null }));
      nav("/login", {
        state: { returnTo: location.pathname + location.search },
      });
    };
    window.addEventListener("pulse:auth-expired", expire);
    return () => window.removeEventListener("pulse:auth-expired", expire);
  }, [location.pathname, location.search, nav]);
  useEffect(() => {
    const key = "pulse.h5.creation-route:" + (session.user?.id || "guest");
    const stored = sessionStorage.getItem(key);
    setCreationRoute(
      stored &&
        /^\/(create$|remix\/|generations\/|works\/[^/]+\/(edit|preview))/.test(
          stored,
        )
        ? stored
        : "/create",
    );
  }, [session.user?.id]);
  useEffect(() => {
    if (
      !/^\/(create$|remix\/|generations\/|works\/[^/]+\/(edit|preview))/.test(
        location.pathname,
      )
    )
      return;
    const route = location.pathname + location.search;
    setCreationRoute(route);
    sessionStorage.setItem(
      "pulse.h5.creation-route:" + (session.user?.id || "guest"),
      route,
    );
  }, [location.pathname, location.search, session.user?.id]);
  useEffect(() => {
    const reset = () => {
      setCreationRoute("/create");
      sessionStorage.removeItem(
        "pulse.h5.creation-route:" + (session.user?.id || "guest"),
      );
    };
    window.addEventListener("pulse:creation-reset", reset);
    return () => window.removeEventListener("pulse:creation-reset", reset);
  }, [session.user?.id]);
  const requireLogin = () => {
    if (
      session.user &&
      (!config?.termsVersion ||
        session.user.termsAcceptance?.version === config.termsVersion)
    )
      return true;
    nav("/login", { state: { returnTo: location.pathname + location.search } });
    return false;
  };
  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => {
          setError("");
          setRevision((n) => n + 1);
        }}
      />
    );
  if (!config) return <Loading />;
  if (config.maintenance)
    return (
      <Empty title="Pulse 正在维护">
        {config.maintenanceMessage || "请稍后回来，你的作品仍然安全保存。"}
      </Empty>
    );
  return (
    <AppContext.Provider
      value={{
        session,
        config,
        refresh,
        requireLogin,
        creationRoute,
        toast: setMessage,
      }}
    >
      {children}
      {message ? (
        <div className="toast" role="status">
          {message}
        </div>
      ) : null}
    </AppContext.Provider>
  );
}
