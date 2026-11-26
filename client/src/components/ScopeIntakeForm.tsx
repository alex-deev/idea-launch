import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emitWithAck } from "@/lib/socketAck";

interface ScopeIntakeFormProps {
  projectId: string;
  userId: string;
  socket: Socket | null;
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
  const [status, setStatus] = useState<"idle" | "sending" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [takingLong, setTakingLong] = useState(false);

  // Show a gentle hint if generation/refinement is taking longer than usual.
  useEffect(() => {
    if (!isSubmitting) {
      setTakingLong(false);
      return;
    }
    const timer = setTimeout(() => setTakingLong(true), 12000);
    return () => clearTimeout(timer);
  }, [isSubmitting]);

  const toggleAppKind = (value: string) => {
    setAppKinds((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedIdea = idea.trim();
    if (!trimmedIdea || isSubmitting) return;
    if (!socket) {
      const msg = "Not connected. Please wait for the connection and try again.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const budgetCents = Math.round(Number(budget) * 100);
    const other = appKindOther.trim();
    setIsSubmitting(true);
    setStatus("sending");
    setError(null);

    // Show generating state immediately; ack resolves when server finishes synthesis (success/failure).
    const pendingToGenerating = setTimeout(() => {
      setStatus((current) => (current === "sending" ? "generating" : current));
    }, 300);

    try {
      const result = await emitWithAck(
        socket,
        "send_message",
        {
          projectId,
          senderId: userId,
          type: "TEXT",
          content: `[TRIGGER_SCOPE_GENERATION] ${trimmedIdea}`,
          payload: {
            budgetCents: Number.isFinite(budgetCents) && budgetCents > 0 ? budgetCents : undefined,
            timeline: timeline.trim() || undefined,
            appKinds,
            ...(other ? { appKindOther: other } : {}),
          },
        },
        120000,
      );

      if (!result.ok) {
        const msg = result.error || "Failed to generate scope. Please try again.";
        setError(msg);
        toast.error(msg);
        setIsSubmitting(false);
        setStatus("idle");
        return;
      }

      // On success the server emits/updates the SCOPE_WIDGET; UI transitions to questions or blueprint.
      setStatus("generating");
      const res: any = result as any;
      const msg = res?.message?.payload?.refinement ?? res?.message?.refinement ?? null;
      const source = msg?.source ?? res?.source ?? null;
      if (res?.status === "needs_info") {
        toast.success("A few questions are ready to refine your scope");
      } else if (source === "fallback") {
        toast.warning("Draft blueprint ready (AI unavailable — using a fallback). Please review and edit.");
      } else {
        toast.success("Scope blueprint ready");
      }
      setIsSubmitting(false);
      setStatus("idle");
    } finally {
      clearTimeout(pendingToGenerating);
    }
  };

  const buttonLabel =
    status === "sending"
      ? "Sending..."
      : status === "generating" || isSubmitting
        ? "Generating scope..."
        : "Refine with AI";

  return (
    <div className="w-full max-w-2xl shrink-0">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Project Intake</h2>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="scope-idea">
            Project idea
          </label>
          <textarea
            id="scope-idea"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Describe the software you want to build..."
            rows={4}
            disabled={isSubmitting}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="scope-budget">
              Budget (USD)
            </label>
            <Input
              id="scope-budget"
              type="number"
              min="1"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="scope-timeline">
              Timeline (optional)
            </label>
            <Input
              id="scope-timeline"
              value={timeline}
              onChange={(event) => setTimeline(event.target.value)}
              placeholder="e.g. 6 weeks"
              disabled={isSubmitting}
            />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">App kind</p>
          <p className="text-xs text-muted-foreground">What are you building? Select all that apply.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {APP_KIND_OPTIONS.map((option) => {
              const checked = appKinds.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${
                    checked ? "border-primary bg-primary/5" : ""
                  } ${isSubmitting ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={() => toggleAppKind(option.value)}
                    disabled={isSubmitting}
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
            <label className="text-sm font-medium" htmlFor="scope-appkind-other">
              Other (optional)
            </label>
            <Input
              id="scope-appkind-other"
              value={appKindOther}
              onChange={(event) => setAppKindOther(event.target.value)}
              placeholder="e.g. browser extension, API/backend service"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {isSubmitting ? (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {status === "sending"
              ? "Sending your idea..."
              : takingLong
                ? "Still working on your scope — taking longer than usual. Please keep this open."
                : "Generating scope with AI. This can take a moment."}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting || !idea.trim()}>
          {buttonLabel}
        </Button>
      </form>
    </div>
  );
}
