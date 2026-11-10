import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ScopeIntakeFormProps {
  projectId: string;
  userId: string;
  socket: any;
  projectTotal: number;
}

export function ScopeIntakeForm({
  projectId,
  userId,
  socket,
  projectTotal,
}: ScopeIntakeFormProps) {
  const [idea, setIdea] = useState("");
  const [budget, setBudget] = useState(String(projectTotal > 0 ? projectTotal / 100 : 1000));
  const [timeline, setTimeline] = useState("");
  const [stack, setStack] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!idea.trim() || !socket) return;

    const budgetCents = Math.round(Number(budget) * 100);
    setIsSubmitting(true);
    socket.emit("send_message", {
      projectId,
      senderId: userId,
      type: "TEXT",
      content: `[TRIGGER_SCOPE_GENERATION] ${idea.trim()}`,
      payload: {
        budgetCents: Number.isFinite(budgetCents) && budgetCents > 0 ? budgetCents : undefined,
        timeline: timeline.trim() || undefined,
        preferredStack: stack.trim() || undefined,
      },
    });
    setIdea("");
    setIsSubmitting(false);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Project Intake</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Project idea</label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="Describe the software you want to build..."
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Budget (USD)</label>
              <Input
                type="number"
                min="1"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Timeline (optional)</label>
              <Input
                value={timeline}
                onChange={(event) => setTimeline(event.target.value)}
                placeholder="e.g. 6 weeks"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Preferred stack (optional)</label>
              <Input
                value={stack}
                onChange={(event) => setStack(event.target.value)}
                placeholder="React, Node.js"
              />
            </div>
          </div>
          <Button className="w-full" disabled={isSubmitting || !idea.trim()}>
            {isSubmitting ? "Refining..." : "Refine with AI"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
