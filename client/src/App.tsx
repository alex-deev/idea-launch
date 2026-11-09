import { useState } from "react";

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

function App() {
  const [role, setRole] = useState<Role>("CLIENT");
  const [users, setUsers] = useState(INITIAL_USERS);

  const activeUser = users[role];

  const handleOnboardingComplete = () => {
    setUsers((prev) => ({
      ...prev,
      BUILDER: { ...prev.BUILDER, probationary: false, rulesAccepted: true },
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-lg font-semibold">Idea Launch</h1>
        <div className="flex items-center gap-2">
          {role === "BUILDER" && activeUser.probationary ? (
            <Badge variant="secondary">$1,500 Budget Cap</Badge>
          ) : null}
          <Button
            variant={role === "CLIENT" ? "default" : "outline"}
            onClick={() => setRole("CLIENT")}
          >
            Client
          </Button>
          <Button
            variant={role === "BUILDER" ? "default" : "outline"}
            onClick={() => setRole("BUILDER")}
          >
            Builder
          </Button>
        </div>
      </header>
      <main className="flex justify-center p-4">
        {role === "BUILDER" && !activeUser.rulesAccepted ? (
          <BuilderOnboarding
            userId={activeUser.id}
            onComplete={handleOnboardingComplete}
          />
        ) : (
          <Chat
            userId={activeUser.id}
            role={activeUser.role}
            name={activeUser.name}
            probationary={activeUser.probationary}
          />
        )}
      </main>
    </div>
  );
}

export default App;
