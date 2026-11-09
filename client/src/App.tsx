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
      "/client": "Client Workspace — Idea Launch",
      "/builder": "Builder Workspace — Idea Launch",
    };
    document.title = titles[location.pathname] ?? "Idea Launch";
  }, [location.pathname]);

  return null;
}

function RequireAuth({
  role,
  children,
}: {
  role: "CLIENT" | "BUILDER";
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading session...</p>;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === "CLIENT" ? "/client" : "/builder"} replace />;
  }

  return <>{children}</>;
}

function Header({
  user,
  signOut,
  builderProbationary = false,
}: {
  user: FakeUser | null;
  signOut: () => void;
  builderProbationary?: boolean;
}) {
  const location = useLocation();

  return (
    <header className="shrink-0 flex items-center justify-between border-b p-4">
      <Link to="/" className="text-lg font-semibold">
        Idea Launch
      </Link>
      <div className="flex items-center gap-2">
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
        {user?.role === "BUILDER" && location.pathname === "/builder" && builderProbationary ? (
          <Badge variant="secondary">$1,500 Budget Cap</Badge>
        ) : null}
      </div>
    </header>
  );
}

function Home({ user }: { user: FakeUser | null }) {
  return (
    <div className="w-full max-w-2xl space-y-6 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Choose your workspace</h2>
        <p className="text-muted-foreground">
          Clients scope, fund, and approve project milestones. Builders onboard,
          submit demos, and receive escrow releases.
        </p>
      </div>
      <div className="flex justify-center gap-3">
        {user ? (
          <Button asChild>
            <Link to={user.role === "CLIENT" ? "/client" : "/builder"}>
              Open workspace
            </Link>
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

  return (
    <BrowserRouter>
      <TitleManager />
      <div className="flex h-dvh flex-col bg-background">
        <Header user={user} signOut={signOut} builderProbationary={user?.role === "BUILDER" && !builderOnboarded} />
        <main className="flex min-h-0 flex-1 justify-center overflow-hidden p-4">
          <div className="flex h-full w-full max-w-6xl flex-col">
            <Routes>
              <Route path="/" element={<div className="flex h-full items-center justify-center"><Home user={user} /></div>} />
              <Route path="/signin" element={<div className="flex h-full items-center justify-center"><SignInPage /></div>} />
              <Route path="/signup" element={<div className="flex h-full items-center justify-center"><SignUpPage /></div>} />
              <Route
                path="/client"
                element={
                  <RequireAuth role="CLIENT">
                    {user ? <div className="h-full"><ClientView user={user} /></div> : null}
                  </RequireAuth>
                }
              />
              <Route
                path="/builder"
                element={
                  <RequireAuth role="BUILDER">
                    {user ? (
                      <div className="h-full">
                        <BuilderView
                          user={user}
                          onboarded={builderOnboarded}
                          onComplete={() => setBuilderOnboarded(true)}
                        />
                      </div>
                    ) : null}
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
