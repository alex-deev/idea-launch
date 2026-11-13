import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuilderOnboarding } from "@/components/BuilderOnboarding";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { SignInPage } from "@/pages/SignInPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { useAuth, type FakeUser } from "@/contexts/AuthContext";
import { API_URL } from "@/lib/api";

interface UserState {
  id: string;
  role: "CLIENT" | "BUILDER";
  name: string;
  probationary: boolean;
  rulesAccepted: boolean;
}

function TitleManager() {
  const location = useLocation();

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Idea Launch",
      "/signin": "Sign In — Idea Launch",
      "/signup": "Sign Up — Idea Launch",
      "/workspace": "Workspace — Idea Launch",
    };
    document.title = titles[location.pathname] ?? "Idea Launch";
  }, [location.pathname]);

  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading session...</p>;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading session...</p>;
  }

  if (user) {
    return <Navigate to="/workspace" replace />;
  }

  return <>{children}</>;
}

function Header({
  user,
  signOut,
  builderProbationary = false,
  theme,
  onToggleTheme,
}: {
  user: FakeUser | null;
  signOut: () => void;
  builderProbationary?: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const location = useLocation();

  return (
    <header className="shrink-0 flex items-center justify-between border-b p-4">
      <Link to="/" className="text-lg font-semibold">
        Idea Launch
      </Link>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user ? (
          <>
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Sign up</Link>
            </Button>
          </>
        )}
        {user?.role === "BUILDER" && location.pathname === "/workspace" && builderProbationary ? (
          <Badge variant="secondary">$1,500 Budget Cap</Badge>
        ) : null}
      </div>
    </header>
  );
}

function LandingPage({ user }: { user: FakeUser | null }) {
  return (
    <div className="w-full max-w-2xl space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Idea Launch</h1>
        <p className="text-muted-foreground">
          Scope, fund, and ship projects with milestone-based escrow—clients define and approve
          work, builders deliver demos and get paid.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {user ? (
          <Button asChild>
            <Link to="/workspace">Go to workspace</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/signup">Create account</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function WorkspaceView({
  user,
  onboarded,
  onComplete,
}: {
  user: FakeUser;
  onboarded: boolean;
  onComplete: () => void;
}) {
  if (user.role === "CLIENT") {
    return <ClientView user={user} />;
  }
  return <BuilderView user={user} onboarded={onboarded} onComplete={onComplete} />;
}

function toUserState(user: FakeUser, builderOnboarded: boolean): UserState {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    probationary: user.role === "BUILDER" && !builderOnboarded,
    rulesAccepted: user.role === "CLIENT" || builderOnboarded,
  };
}

function ClientView({ user }: { user: FakeUser }) {
  const userState = toUserState(user, true);
  return (
    <ProjectWorkspace
      userId={userState.id}
      role={userState.role}
      name={userState.name}
      probationary={userState.probationary}
    />
  );
}

function BuilderView({
  user,
  onboarded,
  onComplete,
}: {
  user: FakeUser;
  onboarded: boolean;
  onComplete: () => void;
}) {
  const userState = toUserState(user, onboarded);

  if (!userState.rulesAccepted) {
    return <BuilderOnboarding userId={userState.id} onComplete={onComplete} />;
  }

  return (
    <ProjectWorkspace
      userId={userState.id}
      role={userState.role}
      name={userState.name}
      probationary={userState.probationary}
    />
  );
}

function App() {
  const { user, signOut } = useAuth();
  const [builderOnboarded, setBuilderOnboarded] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    setBuilderOnboarded(false);

    if (!user || user.role !== "BUILDER") {
      return;
    }

    let cancelled = false;
    fetch(`${API_URL}/api/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        const profile = data?.user;
        setBuilderOnboarded(Boolean(profile?.rulesAccepted && !profile?.probationary));
      })
      .catch(() => {
        if (!cancelled) setBuilderOnboarded(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <TitleManager />
      <div className="flex h-dvh flex-col bg-background">
        <Header user={user} signOut={signOut} builderProbationary={user?.role === "BUILDER" && !builderOnboarded} theme={theme} onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
        <main className="flex min-h-0 flex-1 justify-center overflow-hidden p-4">
          <div className="flex h-full w-full max-w-6xl flex-col">
            <Routes>
              <Route
                path="/"
                element={
                  <div className="flex h-full items-center justify-center">
                    <LandingPage user={user} />
                  </div>
                }
              />
              <Route
                path="/signin"
                element={
                  <RedirectIfAuthenticated>
                    <div className="flex h-full items-center justify-center">
                      <SignInPage />
                    </div>
                  </RedirectIfAuthenticated>
                }
              />
              <Route
                path="/signup"
                element={
                  <RedirectIfAuthenticated>
                    <div className="flex h-full items-center justify-center">
                      <SignUpPage />
                    </div>
                  </RedirectIfAuthenticated>
                }
              />
              <Route
                path="/workspace"
                element={
                  <RequireAuth>
                    {user ? (
                      <div className="h-full">
                        <WorkspaceView
                          user={user}
                          onboarded={builderOnboarded}
                          onComplete={() => setBuilderOnboarded(true)}
                        />
                      </div>
                    ) : null}
                  </RequireAuth>
                }
              />
              <Route path="/client" element={<Navigate to="/workspace" replace />} />
              <Route path="/builder" element={<Navigate to="/workspace" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
