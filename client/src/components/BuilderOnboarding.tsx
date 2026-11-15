import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SOCKET_URL } from "@/lib/api";
import { emitWithAck } from "@/lib/socketAck";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const socketRef = useRef<Socket | null>(null);

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

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;
    if (ecosystems.length > 2) {
      setError("You can select at most two primary ecosystems.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const result = await emitWithAck(socketRef.current, "submit_onboarding", {
        userId,
        ecosystems,
        portfolioUrls: [portfolioUrl1.trim(), portfolioUrl2.trim()].filter(Boolean),
        rulesAccepted,
      });
      if (!result.ok) {
        const msg = result.error || "Failed to complete onboarding. Please try again.";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Onboarding complete");
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
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
            disabled={isSubmitting}
          >
            {githubConnected ? "GitHub Connected (mock)" : "Connect GitHub (mock)"}
          </Button>
          <p className="text-xs text-muted-foreground">
            GitHub connection is simulated for onboarding in this environment.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Primary ecosystems (comma-separated, max 2)
          </label>
          <Input
            value={ecosystemsInput}
            onChange={(event) => setEcosystemsInput(event.target.value)}
            placeholder="React, Node.js"
            disabled={isSubmitting}
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
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Portfolio URL 2 (optional)</label>
          <Input
            value={portfolioUrl2}
            onChange={(event) => setPortfolioUrl2(event.target.value)}
            placeholder="https://..."
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={rulesAccepted}
            onCheckedChange={(checked) => setRulesAccepted(checked === true)}
            disabled={isSubmitting}
          />
          <label className="text-sm">
            I acknowledge the 5% late penalty and progressive escrow rules.
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button className="w-full" onClick={() => void handleSubmit()} disabled={!isValid || isSubmitting}>
          {isSubmitting ? "Completing onboarding..." : "Complete Onboarding"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default BuilderOnboarding;
