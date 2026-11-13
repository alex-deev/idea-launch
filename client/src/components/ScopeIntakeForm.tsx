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

const APP_KIND_OPTIONS = [
  { value: "Website", label: "Website", description: "Informational pages viewed in a browser" },
  { value: "Web app", label: "Web app", description: "Interactive software used in a browser" },
  { value: "Mobile app", label: "Mobile app", description: "App for phones or tablets" },
  { value: "Desktop app", label: "Desktop app", description: "Software installed on a computer" },
] as const;

export function ScopeIntakeForm({
  projectId,
  userId,
  socket,
  projectTotal,
}: ScopeIntakeFormProps) {
  const [idea, setIdea] = useState("");
  const [budget, setBudget] = useState(String(projectTotal > 0 ? projectTotal / 100 : 1000));
  const [timeline, setTimeline] = useState("");
  const [appKinds, setAppKinds] = useState<string[]>([]);
  const [appKindOther, setAppKindOther] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAppKind = (value: string) => {
    setAppKinds((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!idea.trim() || !socket) return;

    const budgetCents = Math.round(Number(budget) * 100);
    const other = appKindOther.trim();
    setIsSubmitting(true);
    socket.emit("send_message", {
      projectId,
      senderId: userId,
      type: "TEXT",
      content: `[TRIGGER_SCOPE_GENERATION] ${idea.trim()}`,
      payload: {
        budgetCents: Number.isFinite(budgetCents) && budgetCents > 0 ? budgetCents : undefined,
        timeline: timeline.trim() || undefined,
        appKinds,
        ...(other ? { appKindOther: other } : {}),
      },
    });
    setIdea("");
    setIsSubmitting(false);
  };

  return (
    <Card className="w-full max-w-2xl shrink-0">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">App kind</label>
            <p className="text-xs text-muted-foreground">
              What are you building? Select all that apply.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {APP_KIND_OPTIONS.map((option) => {
                const checked = appKinds.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${
                      checked ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => toggleAppKind(option.value)}
                    />
                    <span>
                      <span className="font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="space-y-1 pt-1">
              <label className="text-sm font-medium">Other (optional)</label>
              <Input
                value={appKindOther}
                onChange={(event) => setAppKindOther(event.target.value)}
                placeholder="e.g. browser extension, API/backend service"
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
