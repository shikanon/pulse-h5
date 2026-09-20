import { lazy, Suspense, Component, type ReactNode } from "react";
import {
  NavLink,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { House, Plus, UserRound, Activity } from "lucide-react";
import { AppProvider } from "./context";
import { useApp } from "./store";
import { Loading, Empty, Button } from "../shared/ui";
const Feed = lazy(() => import("../features/Feed")),
  Composer = lazy(() => import("../features/Composer")),
  Generation = lazy(() => import("../features/Generation")),
  WorkPage = lazy(() => import("../features/WorkPage")),
  Wallet = lazy(() => import("../features/Wallet")),
  Profile = lazy(() => import("../features/Profile")),
  Settings = lazy(() => import("../features/Settings")),
  Login = lazy(() => import("../features/Login"));
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Empty
        title="页面遇到问题"
        action={
          <Button onClick={() => window.location.reload()}>重新打开</Button>
        }
      >
        草稿保存在本浏览器，可以重新打开继续。
      </Empty>
    ) : (
      this.props.children
    );
  }
}
function Member({ children }: { children: ReactNode }) {
  const { session } = useApp(),
    location = useLocation();
  return session.user ? (
    children
  ) : (
    <Navigate
      to="/login"
      replace
      state={{ returnTo: location.pathname + location.search }}
    />
  );
}
export function App() {
  const location = useLocation();
  return (
    <ErrorBoundary>
      <AppProvider>
        <div className="desktop-brand">
          <Activity />
          <strong>Pulse</strong>
          <span>让灵感，可以游玩。</span>
        </div>
        <div className="app-shell">
          <main id="main">
            <Suspense fallback={<Loading />}>
              <Routes location={location}>
<Route path="/me/credits" element={<Member><Wallet /></Member>} />
                <Route path="/" element={<Feed />} />
                <Route path="/create" element={<Composer key="original" />} />
                <Route
                  path="/remix/:workId"
                  element={<Composer key={location.pathname} />}
                />
                <Route
                  path="/works/:workId/edit"
                  element={<Composer key={location.pathname} />}
                />
                <Route
                  path="/generations/:jobId"
                  element={
                    <Member>
                      <Generation />
                    </Member>
                  }
                />
                <Route
                  path="/works/:workId"
                  element={<WorkPage key={location.pathname} />}
                />
                <Route
                  path="/works/:workId/preview"
                  element={
                    <Member>
                      <WorkPage
                        key={location.pathname + location.search}
                        preview
                      />
                    </Member>
                  }
                />
                <Route
                  path="/a/:slug"
                  element={<WorkPage key={location.pathname} shared />}
                />
                <Route path="/me" element={<Profile />} />
                <Route
                  path="/me/library"
                  element={<Profile key="library" collection />}
                />
                <Route path="/settings" element={<Settings />} />
                <Route path="/login" element={<Login />} />
                <Route
                  path="*"
                  element={
                    <Empty
                      title="这个页面不存在"
                      action={<a href="/">返回首页</a>}
                    />
                  }
                />
              </Routes>
            </Suspense>
          </main>
          <MainNavigation />
        </div>
      </AppProvider>
    </ErrorBoundary>
  );
}

function MainNavigation() {
  const location = useLocation(),
    { creationRoute } = useApp();
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <NavLink
        to="/"
        end
        onClick={() => {
          if (location.pathname === "/")
            window.dispatchEvent(new Event("pulse:home-reset"));
        }}
      >
        <House />
        <span>Home</span>
      </NavLink>
      <NavLink
        to={creationRoute}
        className={() =>
          location.pathname === "/create" ||
          location.pathname.startsWith("/remix/") ||
          location.pathname.startsWith("/generations/") ||
          /\/works\/[^/]+\/(edit|preview)/.test(location.pathname)
            ? "active"
            : ""
        }
      >
        <span className="create-icon">
          <Plus />
        </span>
        <span>Create</span>
      </NavLink>
      <NavLink to="/me">
        <UserRound />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
}
