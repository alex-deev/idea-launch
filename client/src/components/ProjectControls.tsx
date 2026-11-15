import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_URL } from "@/lib/api";
import { emitWithAck } from "@/lib/socketAck";

interface ProjectControlsProps {
  socket: Socket | null;
  project: any;
  role: string;
  userId: string;
}

export function ProjectControls({ socket, project, role, userId }: ProjectControlsProps) {
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [cardOnFile, setCardOnFile] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRequestingExtension, setIsRequestingExtension] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (role !== "CLIENT") return;
    let cancelled = false;
    fetch(`${API_URL}/api/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const pm = data?.user?.paymentMethods?.[0];
        if (pm?.last4) {
          setCardOnFile(`${pm.brand ?? "Card"} •••• ${pm.last4}`);
        } else {
          setCardOnFile(null);
        }
      })
      .catch(() => {
        if (!cancelled) setCardOnFile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [role, userId]);

  if (!project) return null;

  const milestones = project.milestones ?? [];
  const releasedPercent = milestones
    .filter((m: any) => m.status === "RELEASED" || m.status === "COMPLETED")
    .reduce((sum: number, m: any) => sum + (m.releasePercent ?? 0), 0);
  const releasedAmount = Math.round((project.totalEscrow ?? 0) * (releasedPercent / 100));

  const clearMessages = () => {
    setActionError(null);
    setActionNotice(null);
  };

  const handleCancelConfirm = async () => {
    if (isCancelling) return;
    clearMessages();
    setIsCancelling(true);
    try {
      const result = await emitWithAck(socket, "cancel_project", {
        projectId: project.id,
        userId,
      });
      if (!result.ok) {
        const msg = result.error || "Failed to cancel project";
        setActionError(msg);
        toast.error(msg);
        return;
      }
      setCancelOpen(false);
      setActionNotice("Project cancellation requested. Status will update shortly.");
      toast.success("Project cancelled");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExtension = async () => {
    if (isRequestingExtension) return;
    clearMessages();
    setIsRequestingExtension(true);
    try {
      const result = await emitWithAck(socket, "request_extension", {
        projectId: project.id,
        userId,
      });
      if (!result.ok) {
        const msg = result.error || "Failed to request extension";
        setActionError(msg);
        toast.error(msg);
        return;
      }
      setActionNotice("Extension requested.");
      toast.success("Extension requested");
    } finally {
      setIsRequestingExtension(false);
    }
  };

  const handleSubmitRating = async () => {
    if (rating < 1 || isSubmittingRating) return;
    clearMessages();
    setIsSubmittingRating(true);
    try {
      const result = await emitWithAck(socket, "submit_rating", {
        projectId: project.id,
        userId,
        rating,
        feedback,
      });
      if (!result.ok) {
        const msg = result.error || "Failed to submit rating";
        setActionError(msg);
        toast.error(msg);
        return;
      }
      setActionNotice("Thanks — your rating was submitted.");
      toast.success("Rating submitted");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const canRate =
    (project.status === "COMPLETED" || project.status === "CANCELLED") &&
    !project.qualityScore;

  return (
    <>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Project Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Status: <strong>{project.status}</strong>
            </span>
            <span>
              Escrow released: <strong>{releasedPercent}%</strong> ($
              {(releasedAmount / 100).toFixed(2)} / ${((project.totalEscrow ?? 0) / 100).toFixed(2)})
            </span>
          </div>
          {role === "CLIENT" ? (
            <p className="text-xs text-muted-foreground">
              Card on file: {cardOnFile ?? "none (mock)"} — mock payment, no real charge.
            </p>
          ) : null}
          {project.status === "OPEN_FOR_BIDS" && project.acceptedOfferId ? (
            <p className="text-amber-600">
              Funding pending — retry “Accept &amp; Fund” to draft escrow (mock).
            </p>
          ) : null}
          {project.status === "ACTIVE" ? (
            <p className="text-green-600">Funds drafted &amp; held (mock) — escrow funded.</p>
          ) : null}

          {project.deadline ? (
            <p>
              Deadline: <strong>{new Date(project.deadline).toLocaleString()}</strong>
              {project.latePenaltyTotal ? (
                <span className="ml-2 text-red-600">
                  Late penalties: ${(project.latePenaltyTotal / 100).toFixed(2)}
                </span>
              ) : null}
            </p>
          ) : null}

          {project.extensionRequested ? (
            <p className="text-muted-foreground">Extension requested.</p>
          ) : null}

          {project.refundAmount ? (
            <p className="text-amber-600">
              Refund: ${(project.refundAmount / 100).toFixed(2)} ({project.refundPercent}%)
            </p>
          ) : null}

          {project.qualityScore ? (
            <p className="text-green-600">
              Quality rating: {project.qualityScore}/5
              {project.qualityFeedback ? ` — ${project.qualityFeedback}` : ""}
            </p>
          ) : null}

          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
          {actionNotice ? <p className="text-sm text-green-600">{actionNotice}</p> : null}

          <div className="flex flex-wrap gap-2">
            {role === "BUILDER" && project.status === "ACTIVE" && !project.extensionRequested ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleExtension()}
                disabled={isRequestingExtension}
              >
                {isRequestingExtension ? "Requesting..." : "Request Extension"}
              </Button>
            ) : null}

            {role === "CLIENT" &&
            project.status !== "COMPLETED" &&
            project.status !== "CANCELLED" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  clearMessages();
                  setCancelOpen(true);
                }}
                disabled={isCancelling}
              >
                Cancel Project
              </Button>
            ) : null}
          </div>

          {canRate ? (
            <div className="space-y-2 border-t pt-3">
              <p className="font-medium">Rate this project (1-5 stars)</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={rating === value ? "default" : "outline"}
                    onClick={() => setRating(value)}
                    disabled={isSubmittingRating}
                  >
                    {value}
                  </Button>
                ))}
              </div>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Optional feedback"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                disabled={isSubmittingRating}
              />
              <Button
                size="sm"
                onClick={() => void handleSubmitRating()}
                disabled={rating < 1 || isSubmittingRating}
              >
                {isSubmittingRating ? "Submitting..." : "Submit Rating"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={(open) => !isCancelling && setCancelOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this project?</DialogTitle>
            <DialogDescription>
              This will stop the project and apply the applicable refund/cancellation rules. This
              action can’t be undone from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isCancelling}>
              Keep project
            </Button>
            <Button variant="destructive" onClick={() => void handleCancelConfirm()} disabled={isCancelling}>
              {isCancelling ? "Cancelling..." : "Yes, cancel project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProjectControls;
