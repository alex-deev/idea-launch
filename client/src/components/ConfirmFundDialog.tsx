import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";

interface ConfirmFundDialogProps {
  open: boolean;
  projectId: string;
  offer: {
    id: string;
    totalCents: number;
    builder?: { name?: string | null } | null;
  } | null;
  projectTitle?: string;
  isRetry?: boolean;
  isDrafting: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ConfirmFundDialog({
  open,
  projectId,
  offer,
  projectTitle,
  isRetry = false,
  isDrafting,
  error,
  onConfirm,
  onClose,
}: ConfirmFundDialogProps) {
  const [cardOnFile, setCardOnFile] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCardLoading(true);
    fetch(`${API_URL}/api/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const pm = data?.user?.paymentMethods?.[0];
        if (pm?.last4) {
          setCardOnFile(`${pm.brand ?? "Card"} •••• ${pm.last4} (exp ${String(pm.expMonth).padStart(2, "0")}/${pm.expYear})`);
        } else {
          setCardOnFile(null);
        }
        setCardLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setCardOnFile(null);
          setCardLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open || !offer) return null;

  const canConfirm = !cardLoading && !!cardOnFile && !isDrafting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm funding"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDrafting) onClose();
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">
            {isRetry ? "Retry funding draft" : "Confirm funding"}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isDrafting}
            aria-label="Close"
          >
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
              <span className="text-muted-foreground">Builder</span>
              <span className="font-medium">{offer.builder?.name ?? "Builder"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount to draft</span>
              <span className="font-semibold">{fmt(offer.totalCents)}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Payment method on file</p>
            {cardLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : cardOnFile ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{cardOnFile}</Badge>
                <span className="text-xs text-muted-foreground">Mock — no real charge</span>
              </div>
            ) : (
              <p className="text-xs text-red-600">
                No payment method on file. Add a card in your account before funding.
              </p>
            )}
          </div>

          <div className="rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs dark:bg-amber-950/20">
            <p className="font-medium">What happens next</p>
            <p>
              A mock hold will be placed against your saved card and the funds drafted to escrow
              for this project. {isRetry ? "This retries a previous funding attempt." : ""}
              On success the project becomes <strong>Active</strong> and work can begin.
              <strong> No real charge is made (mock gateway).</strong>
            </p>
          </div>

          {error ? (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {!canConfirm && !isDrafting ? (
            <p className="text-xs text-red-600">
              {cardLoading
                ? "Loading payment method…"
                : "A payment method on file is required to confirm."}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              onClick={() => void onConfirm()}
              disabled={!canConfirm}
            >
              {isDrafting ? "Drafting funds…" : isRetry ? "Retry funding" : "Confirm & draft funds"}
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={onClose}
              disabled={isDrafting}
            >
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Project: {projectId}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConfirmFundDialog;