import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BuilderPayoutDialogProps {
  open: boolean;
  onClose: () => void;
  projectTitle?: string;
  milestoneTitle?: string;
  amountReleasedNow?: number;
  totalReleased?: number;
  paymentStatus?: string | null;
  paymentRef?: string | null;
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BuilderPayoutDialog({
  open,
  onClose,
  projectTitle,
  milestoneTitle,
  amountReleasedNow = 0,
  totalReleased = 0,
  paymentStatus,
  paymentRef,
}: BuilderPayoutDialogProps) {
  if (!open) return null;
  const pending =
    paymentStatus && paymentStatus !== "SUCCEEDED" && paymentStatus !== "PAID";
  const isFinal = milestoneTitle === "Deployment";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Release details"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">
            {isFinal ? "Final milestone completed" : "Release details"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Project</span>
              <span className="font-medium">{projectTitle ?? "Project"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Milestone</span>
              <span className="font-medium">{milestoneTitle ?? "Deployment"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Released now</span>
              <span className="font-semibold">{fmt(amountReleasedNow)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total released</span>
              <span className="font-semibold">{fmt(totalReleased)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={pending ? "secondary" : "default"}>
              {pending ? "Transfer pending" : "Paid"}
            </Badge>
            {paymentRef ? (
              <span className="text-xs text-muted-foreground">ref: {paymentRef}</span>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            {pending
              ? "Transfer is still processing; funds will arrive once the transfer completes."
              : "Funds have been released to you (mock gateway)."}
          </p>

          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface ClientCongratsDialogProps {
  open: boolean;
  onClose: () => void;
  projectTitle?: string;
}

export function ClientCongratsDialog({
  open,
  onClose,
  projectTitle,
}: ClientCongratsDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Project completed"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Project complete 🎉</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>{projectTitle ?? "Your project"}</strong> is finished. All milestones have been
            approved and funds released. Thank you for collaborating!
          </p>
          <Button className="w-full" onClick={onClose}>
            Awesome
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

