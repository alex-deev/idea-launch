import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildMilestones } from "@/lib/milestones";

export type OfferStatus =
  | "SUBMITTED"
  | "SELECTED"
  | "BLOCKED"
  | "FINAL"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN";

export interface OfferRecord {
  id: string;
  projectId: string;
  builderId: string;
  status: OfferStatus;
  totalCents: number;
  milestonesSnapshot?: Array<{
    stageNumber?: number;
    title: string;
    amount: number;
    releasePercent?: number;
    dueDate?: string | null;
  }> | null;
  longTermAmountCents?: number | null;
  longTermCadence?: "NONE" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME" | null;
  longTermNotes?: string | null;
  builder?: { id: string; name?: string | null; email?: string | null } | null;
}

interface OffersPanelProps {
  role: "CLIENT" | "BUILDER" | string;
  userId: string;
  projectId: string;
  projectStatus: string;
  selectedOfferId?: string | null;
  offers: OfferRecord[];
  probationary?: boolean;
  builderAtCapacity?: boolean;
  onSubmitOffer: (terms: {
    totalCents: number;
    longTermAmountCents?: number | null;
    longTermCadence?: string;
    longTermNotes?: string | null;
    milestoneDueDates?: Array<string | null>;
  }) => void;
  onReviseOffer: (terms: {
    totalCents: number;
    longTermAmountCents?: number | null;
    longTermCadence?: string;
    longTermNotes?: string | null;
    milestoneDueDates?: Array<string | null>;
  }) => void;
  onWithdrawOffer: () => void;
  onSelectOffer: (offerId: string) => void;
  onCancelNegotiation: () => void;
  onUpdateOfferTerms: (
    offerId: string,
    terms: {
      totalCents: number;
      longTermAmountCents?: number | null;
      longTermCadence?: string;
      longTermNotes?: string | null;
      milestoneDueDates?: Array<string | null>;
    },
  ) => void;
  onMarkOfferFinal: (offerId: string) => void;
  onAcceptOffer: (offerId: string) => void;
  defaultTotalCents?: number;
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function toDateInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function cadenceLabel(c?: string | null) {
  if (!c || c === "NONE") return "None";
  return c.charAt(0) + c.slice(1).toLowerCase().replace("_", " ");
}

function TermSheet({
  title,
  initialTotalCents,
  initialLongTermAmountCents,
  initialLongTermCadence,
  initialLongTermNotes,
  initialDueDates,
  submitLabel,
  onSubmit,
  disabled,
  allowDueDates = true,
}: {
  title: string;
  initialTotalCents: number;
  initialLongTermAmountCents?: number | null;
  initialLongTermCadence?: string | null;
  initialLongTermNotes?: string | null;
  initialDueDates?: Array<string | null>;
  submitLabel: string;
  onSubmit: (terms: {
    totalCents: number;
    longTermAmountCents?: number | null;
    longTermCadence?: string;
    longTermNotes?: string | null;
    milestoneDueDates?: Array<string | null>;
  }) => void;
  disabled?: boolean;
  allowDueDates?: boolean;
}) {
  const [total, setTotal] = useState((initialTotalCents / 100).toFixed(2));
  const [ltAmount, setLtAmount] = useState(
    initialLongTermAmountCents != null ? (initialLongTermAmountCents / 100).toFixed(2) : "",
  );
  const [ltCadence, setLtCadence] = useState(initialLongTermCadence ?? "NONE");
  const [ltNotes, setLtNotes] = useState(initialLongTermNotes ?? "");
  const [dueDates, setDueDates] = useState<string[]>(() => {
    const base = initialDueDates ?? [null, null, null];
    return [0, 1, 2].map((i) => toDateInput(base[i]));
  });

  const totalCents = Math.round(Number(total) * 100);
  const milestones = useMemo(
    () => (Number.isFinite(totalCents) && totalCents > 0 ? buildMilestones(totalCents) : []),
    [totalCents],
  );

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Total (USD) — milestones auto-calculated</span>
          <Input type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        {milestones.length ? (
          <ul className="space-y-1 rounded-md border p-2">
            {milestones.map((m) => (
              <li key={m.title} className="flex justify-between">
                <span>{m.title}</span>
                <span>{fmt(m.amount)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Long-term cost (USD, informational)</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={ltAmount}
              onChange={(e) => setLtAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Cadence</span>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={ltCadence}
              onChange={(e) => setLtCadence(e.target.value)}
            >
              <option value="NONE">None</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
              <option value="ONE_TIME">One-time</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Long-term notes (informational)</span>
          <Input value={ltNotes} onChange={(e) => setLtNotes(e.target.value)} placeholder="Support, maintenance, etc." />
        </label>
        {allowDueDates ? (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Proposed milestone due dates</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {buildMilestones(totalCents > 0 ? totalCents : initialTotalCents).map((m, i) => (
                <label key={m.title} className="flex flex-col gap-1 text-xs">
                  {m.title}
                  <Input
                    type="date"
                    value={dueDates[i] ?? ""}
                    onChange={(e) => {
                      const next = [...dueDates];
                      next[i] = e.target.value;
                      setDueDates(next);
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <Button
          className="w-full"
          disabled={disabled || !(Number.isFinite(totalCents) && totalCents > 0)}
          onClick={() =>
            onSubmit({
              totalCents,
              longTermAmountCents:
                ltAmount.trim() === "" ? null : Math.round(Number(ltAmount) * 100),
              longTermCadence: ltCadence,
              longTermNotes: ltNotes.trim() || null,
              milestoneDueDates: dueDates.map((d) => (d ? new Date(d).toISOString() : null)),
            })
          }
        >
          {submitLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function OffersPanel({
  role,
  userId,
  projectStatus,
  selectedOfferId,
  offers,
  probationary,
  builderAtCapacity = false,
  onSubmitOffer,
  onReviseOffer,
  onWithdrawOffer,
  onSelectOffer,
  onCancelNegotiation,
  onUpdateOfferTerms,
  onMarkOfferFinal,
  onAcceptOffer,
  defaultTotalCents = 100000,
}: OffersPanelProps) {
  const myOffer = offers.find((o) => o.builderId === userId);
  const selectedOffer = offers.find((o) => o.id === selectedOfferId) ?? null;
  const [editingTerms, setEditingTerms] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // Negotiation-scoped: collapsible panel only during OPEN_FOR_BIDS (above composer).
  if (projectStatus !== "OPEN_FOR_BIDS") {
    return null;
  }

  const summary = (() => {
    if (selectedOffer) {
      return `Selected · ${selectedOffer.builder?.name ?? "Builder"} · ${selectedOffer.status} · ${fmt(selectedOffer.totalCents)}`;
    }
    if (role === "BUILDER") {
      if (myOffer) return `Your offer · ${myOffer.status} · ${fmt(myOffer.totalCents)}`;
      return "No offer submitted yet";
    }
    const count = offers.length;
    return count === 0 ? "No offers yet" : `${count} offer${count === 1 ? "" : "s"} received`;
  })();

  return (
    <div className="space-y-3 border-t border-border/60 -mx-3 px-3 py-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold">Offers &amp; Terms</div>
            <div className="truncate text-xs text-muted-foreground">{summary}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selectedOfferId ? <Badge variant="secondary">Negotiation</Badge> : null}
          <span className="text-xs text-muted-foreground">{isExpanded ? "Collapse" : "Expand"}</span>
        </div>
      </button>

      {isExpanded ? (
        <div className="space-y-3">
      {role === "BUILDER" ? (
        !myOffer ? (
          builderAtCapacity ? (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              You’ve reached the limit of 3 accepted active projects, so you can’t submit an offer for
              a new project plan right now.
            </div>
          ) : (
            <TermSheet
              title="Submit your offer (one per project)"
              initialTotalCents={defaultTotalCents}
              submitLabel="Submit offer"
              onSubmit={onSubmitOffer}
            />
          )
        ) : myOffer.status === "SUBMITTED" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{myOffer.status}</Badge>
              <span>Your offer: {fmt(myOffer.totalCents)}</span>
            </div>
            {editingTerms ? (
              <TermSheet
                title="Revise offer"
                initialTotalCents={myOffer.totalCents}
                initialLongTermAmountCents={myOffer.longTermAmountCents}
                initialLongTermCadence={myOffer.longTermCadence}
                initialLongTermNotes={myOffer.longTermNotes}
                initialDueDates={myOffer.milestonesSnapshot?.map((m) => m.dueDate ?? null)}
                submitLabel="Save revision"
                onSubmit={(t) => {
                  onReviseOffer(t);
                  setEditingTerms(false);
                }}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingTerms(true)}>
                  Revise
                </Button>
                <Button size="sm" variant="destructive" onClick={onWithdrawOffer}>
                  Withdraw (final)
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{myOffer.status}</Badge>
              <span>Your offer: {fmt(myOffer.totalCents)}</span>
            </div>
            {myOffer.status === "SELECTED" ? (
              <p className="text-muted-foreground">Selected for negotiation. Discuss in chat and mark final when ready.</p>
            ) : myOffer.status === "FINAL" ? (
              <p className="text-muted-foreground">Marked final — waiting for client decision.</p>
            ) : null}
          </div>
        )
      ) : null}

      {/* Client: compare/select */}
      {role === "CLIENT" && projectStatus === "OPEN_FOR_BIDS" ? (
        <div className="space-y-2">
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offers yet. Builders can submit offers once the plan is published.</p>
          ) : (
            offers.map((offer) => {
              const isSelected = offer.id === selectedOfferId;
              const canSelect = !selectedOfferId && offer.status === "SUBMITTED";
              return (
                <Card key={offer.id} className={isSelected ? "border-primary" : ""}>
                  <CardContent className="space-y-2 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{offer.builder?.name ?? "Builder"}</span>
                        <Badge variant="outline">{offer.status}</Badge>
                      </div>
                      <span className="font-semibold">{fmt(offer.totalCents)}</span>
                    </div>
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {(offer.milestonesSnapshot ?? buildMilestones(offer.totalCents)).map((m: any) => (
                        <li key={m.title} className="flex justify-between">
                          <span>{m.title}</span>
                          <span>{fmt(m.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="text-xs text-muted-foreground">
                      Long-term: {offer.longTermAmountCents != null ? fmt(offer.longTermAmountCents) : "—"} ({cadenceLabel(offer.longTermCadence)})
                      {offer.longTermNotes ? ` · ${offer.longTermNotes}` : ""}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canSelect ? (
                        <Button size="sm" onClick={() => onSelectOffer(offer.id)}>Select for negotiation</Button>
                      ) : null}
                      {isSelected ? <Badge>Selected</Badge> : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : null}

      {/* Negotiation / final decision (selected offer) */}
      {projectStatus === "OPEN_FOR_BIDS" && selectedOffer ? (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Negotiation — {selectedOffer.builder?.name ?? "Builder"} ({selectedOffer.status})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editingTerms ? (
              role === "BUILDER" && userId === selectedOffer.builderId ? (
                <TermSheet
                  title="Update terms"
                  initialTotalCents={selectedOffer.totalCents}
                  initialLongTermAmountCents={selectedOffer.longTermAmountCents}
                  initialLongTermCadence={selectedOffer.longTermCadence}
                  initialLongTermNotes={selectedOffer.longTermNotes}
                  initialDueDates={selectedOffer.milestonesSnapshot?.map((m) => m.dueDate ?? null)}
                  submitLabel="Save terms"
                  onSubmit={(t) => {
                    onUpdateOfferTerms(selectedOffer.id, t);
                    setEditingTerms(false);
                    setDetailsExpanded(false);
                  }}
                />
              ) : null
            ) : (
              (() => {
                const isSelectedBuilder = role === "BUILDER" && userId === selectedOffer.builderId;
                const builderFinalCompact = isSelectedBuilder && selectedOffer.status === "FINAL" && !detailsExpanded;
                const milestones = (selectedOffer.milestonesSnapshot ?? buildMilestones(selectedOffer.totalCents)) as any[];
                return (
                  <>
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium"><span>Total</span><span>{fmt(selectedOffer.totalCents)}</span></div>
                      {builderFinalCompact ? (
                        <div className="text-xs text-muted-foreground">
                          Milestone and long-term details hidden. Use “See more” to review terms.
                        </div>
                      ) : (
                        <>
                          {milestones.map((m: any) => (
                            <div key={m.title} className="flex justify-between text-xs text-muted-foreground">
                              <span>{m.title}{m.dueDate ? ` · due ${toDateInput(m.dueDate)}` : ""}</span>
                              <span>{fmt(m.amount)}</span>
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground">
                            Long-term (informational): {selectedOffer.longTermAmountCents != null ? fmt(selectedOffer.longTermAmountCents) : "—"} ({cadenceLabel(selectedOffer.longTermCadence)})
                            {selectedOffer.longTermNotes ? ` · ${selectedOffer.longTermNotes}` : ""}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isSelectedBuilder ? (
                        selectedOffer.status === "FINAL" ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setDetailsExpanded((v) => !v)}>
                              {detailsExpanded ? "See less" : "See more"}
                            </Button>
                            <Button size="sm" onClick={() => setEditingTerms(true)}>Update terms</Button>
                          </>
                        ) : selectedOffer.status === "SELECTED" ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setEditingTerms(true)}>Edit terms</Button>
                            <Button size="sm" onClick={() => onMarkOfferFinal(selectedOffer.id)}>Mark Final offer</Button>
                          </>
                        ) : null
                      ) : null}
                      {role === "CLIENT" && selectedOffer.status === "FINAL" ? (
                        <Button
                          size="sm"
                          onClick={() => onAcceptOffer(selectedOffer.id)}
                          disabled={Boolean(probationary && selectedOffer.totalCents > 150000)}
                          title={probationary && selectedOffer.totalCents > 150000 ? "Exceeds probationary cap" : undefined}
                        >
                          Accept &amp; Fund
                        </Button>
                      ) : null}
                      {role === "CLIENT" ? (
                        <Button size="sm" variant="destructive" onClick={onCancelNegotiation}>Cancel negotiation</Button>
                      ) : null}
                    </div>
                  </>
                );
              })()
            )}
          </CardContent>
        </Card>
      ) : null}

        </div>
      ) : null}
    </div>
  );
}

// Keep a simple named export for legacy imports if any (unused in offer-driven flow).
export function OfferWidget() {
  return null;
}

export default OfferWidget;