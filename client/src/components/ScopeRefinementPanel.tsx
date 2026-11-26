import { useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { emitWithAck } from "@/lib/socketAck";

export interface RefinementQuestion {
  id: string;
  question: string;
  hint?: string;
  required?: boolean;
}

export interface RefinementAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface RefinementState {
  status?: "needs_info" | "ready";
  round?: number;
  questions?: RefinementQuestion[];
  answers?: RefinementAnswer[];
  contextSummary?: string | null;
  source?: "gemini" | "nemotron" | "fallback";
  intake?: {
    idea?: string;
    budgetCents?: number;
    timeline?: string;
    appKinds?: string[];
    appKindOther?: string;
  };
}

interface ScopeRefinementPanelProps {
  projectId: string;
  userId: string;
  socket: Socket | null;
  refinement: RefinementState;
}

export function ScopeRefinementPanel({
  projectId,
  userId,
  socket,
  refinement,
}: ScopeRefinementPanelProps) {
  const questions = useMemo(
    () => (Array.isArray(refinement.questions) ? refinement.questions : []),
    [refinement.questions],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takingLong, setTakingLong] = useState(false);

  useEffect(() => {
    if (!isSubmitting) {
      setTakingLong(false);
      return;
    }
    const timer = setTimeout(() => setTakingLong(true), 12000);
    return () => clearTimeout(timer);
  }, [isSubmitting]);

  useEffect(() => {
    // Reset inputs when question set changes.
    const next: Record<string, string> = {};
    for (const q of questions) next[q.id] = "";
    setAnswers(next);
    setError(null);
  }, [questions.map((q) => q.id).join("|")]);

  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const missingAnswers = questions.some((q) => !(answers[q.id] ?? "").trim());

  const submit = async () => {
    if (!socket) {
      const msg = "Not connected. Please wait and try again.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (missingAnswers) {
      const msg = "Please answer all questions to continue.";
      setError(msg);
      return;
    }

    const payloadAnswers: RefinementAnswer[] = questions.map((q) => ({
      questionId: q.id,
      question: q.question,
      answer: (answers[q.id] ?? "").trim(),
    }));

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await emitWithAck(
        socket,
        "send_message",
        {
          projectId,
          senderId: userId,
          type: "TEXT",
          content: "[TRIGGER_SCOPE_GENERATION]",
          payload: {
            refine: true,
            action: "continue",
            answers: payloadAnswers,
          },
        },
        120000,
      );
      if (!result.ok) {
        const msg = result.error || "Failed to refine scope. Please try again.";
        setError(msg);
        toast.error(msg);
        return;
      }
      const res: any = result as any;
      const refinement = res?.message?.payload?.refinement ?? res?.message?.refinement ?? null;
      const source = refinement?.source ?? res?.source ?? null;
      if (res?.status === "ready") {
        if (source === "fallback") {
          toast.warning("Draft blueprint ready (AI unavailable — using a fallback). Please review and edit.");
        } else {
          toast.success("Scope blueprint ready");
        }
      } else {
        toast.success("Thanks — refining your scope");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const round = typeof refinement.round === "number" ? refinement.round : 0;

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">A few questions to refine your scope</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer these so the AI can tailor a more accurate blueprint for your project.
          {round > 0 ? ` (Round ${round + 1})` : ""}
        </p>
        {refinement.contextSummary ? (
          <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">What we know so far: </span>
            {refinement.contextSummary}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        {questions.map((q, index) => (
          <div key={q.id} className="space-y-2 rounded-md border p-3">
            <label className="block text-sm font-medium" htmlFor={`refine-${q.id}`}>
              {index + 1}. {q.question}
              {null}
            </label>
            {q.hint ? <p className="text-xs text-muted-foreground">{q.hint}</p> : null}
            <textarea
              id={`refine-${q.id}`}
              className="w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              disabled={isSubmitting}
              placeholder="Type your answer..."
            />
          </div>
        ))}
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions right now.</p>
        ) : null}
      </div>

      {isSubmitting && takingLong ? (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Still refining — taking longer than usual. Please keep this open.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        className="w-full sm:w-auto"
        onClick={() => void submit()}
        disabled={isSubmitting || questions.length === 0 || missingAnswers}
      >
        {isSubmitting ? "Refining scope..." : "Submit answers"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {answeredCount}/{questions.length} answered.
      </p>
    </div>
  );
}
