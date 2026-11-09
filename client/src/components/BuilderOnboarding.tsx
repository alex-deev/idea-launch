import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SOCKET_URL } from "@/lib/api";

interface BuilderOnboardingProps {
  userId: string;
  onComplete: () => void;
}

export function BuilderOnboarding({ userId, onComplete }: BuilderOnboardingProps) {
  const [githubConnected, setGithubConnected] = useState(false);
  const [ecosystemsInput, setEcosystemsInput] = useState("");
  const [portfolioUrl1, setPortfolioUrl1] = useState("");
  const [portfolioUrl2, setPortfolioUrl2] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { userId, role: "BUILDER", name: "Builder User" },
    });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  const ecosystems = ecosystemsInput
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const isValid =
    githubConnected &&
    ecosystems.length > 0 &&
    ecosystems.length <= 2 &&
    rulesAccepted;

  const handleSubmit = () => {
    if (!isValid || !socketRef.current) return;
    if (ecosystems.length > 2) {
      setError("You can select at most two primary ecosystems.");
      return;
    }
    setError("");

    socketRef.current.emit(
      "submit_onboarding",
      {
        userId,
        ecosystems,
        portfolioUrls: [portfolioUrl1.trim(), portfolioUrl2.trim()].filter(Boolean),
        rulesAccepted,
      },
      (ack: { ok?: boolean }) => {
        if (ack?.ok) onComplete();
      },
    );
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Builder Onboarding</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button
            type="button"
            variant={githubConnected ? "secondary" : "default"}
            onClick={() => setGithubConnected(true)}
          >
            {githubConnected ? "GitHub Connected" : "Connect GitHub"}
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Primary ecosystems (comma-separated, max 2)
          </label>
          <Input
            value={ecosystemsInput}
            onChange={(event) => setEcosystemsInput(event.target.value)}
            placeholder="React, Node.js"
          />
          {ecosystems.length > 2 ? (
            <p className="text-sm text-red-600">Maximum of two ecosystems allowed.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Portfolio URL 1 (optional)</label>
          <Input
            value={portfolioUrl1}
            onChange={(event) => setPortfolioUrl1(event.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Portfolio URL 2 (optional)</label>
          <Input
            value={portfolioUrl2}
            onChange={(event) => setPortfolioUrl2(event.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={rulesAccepted}
            onCheckedChange={(checked) => setRulesAccepted(checked === true)}
          />
          <label className="text-sm">
            I acknowledge the 5% late penalty and progressive escrow rules.
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button className="w-full" onClick={handleSubmit} disabled={!isValid}>
          Complete Onboarding
        </Button>
      </CardContent>
    </Card>
  );
}

export default BuilderOnboarding;
