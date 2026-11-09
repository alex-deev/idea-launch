import { useState } from "react";
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
import { Chat } from "@/components/Chat";

type Role = "CLIENT" | "BUILDER";

interface UserState {
  id: string;
  role: Role;
  name: string;
  probationary: boolean;
  rulesAccepted: boolean;
}

const INITIAL_USERS: Record<Role, UserState> = {
  CLIENT: { id: "client-user", role: "CLIENT", name: "Client User", probationary: false, rulesAccepted: true },
  BUILDER: { id: "builder-user", role: "BUILDER", name: "Builder User", probationary: true, rulesAccepted: false },
};

function Header({ users }: { users: Record<Role, UserState> }) {
  const location = useLocation();
  const isBuilderRoute = location.pathname.startsWith("/builder");

  return (
    <header className="flex items-center justify-between border-b p-4">
      <Link to="/" className="text-lg font-semibold">
        Idea Launch
      </Link>
      <div className="flex items-center gap-2">
        {isBuilderRoute && users.BUILDER.probationary ? (
          <Badge variant="secondary">$1,500 Budget Cap</Badge>
        ) : null}
        <Button
          asChild
          variant={location.pathname === "/client" ? "default" : "outline"}
        >
          <Link to="/client">Client</Link>
        </Button>
        <Button
          asChild
          variant={location.pathname === "/builder" ? "default" : "outline"}
        >
          <Link to="/builder">Builder</Link>
        </Button>
      </div>
    </header>
  );
}

function Home() {
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
        <Button asChild>
          <Link to="/client">Enter as Client</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/builder">Enter as Builder</Link>
        </Button>
      </div>
    </div>
  );
}

function ClientView({ user }: { user: UserState }) {
  return (
    <Chat
      userId={user.id}
      role={user.role}
      name={user.name}
      probationary={user.probationary}
    />
  );
}

function BuilderView({
  user,
  onComplete,
}: {
  user: UserState;
  onComplete: () => void;
}) {
  if (!user.rulesAccepted) {
    return <BuilderOnboarding userId={user.id} onComplete={onComplete} />;
  }

  return (
    <Chat
      userId={user.id}
      role={user.role}
      name={user.name}
      probationary={user.probationary}
    />
  );
}

function App() {
  const [users, setUsers] = useState(INITIAL_USERS);

  const handleOnboardingComplete = () => {
    setUsers((prev) => ({
      ...prev,
      BUILDER: { ...prev.BUILDER, probationary: false, rulesAccepted: true },
    }));
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Header users={users} />
        <main className="flex justify-center p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/client" element={<ClientView user={users.CLIENT} />} />
            <Route
              path="/builder"
              element={
                <BuilderView
                  user={users.BUILDER}
                  onComplete={handleOnboardingComplete}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
