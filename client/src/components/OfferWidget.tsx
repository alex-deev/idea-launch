import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PLATFORM_TARGETS,
  PLATFORM_TARGET_LABELS,
  TARGET_DESCRIPTIONS,
  TARGET_MATRIX,
  type BundleSpec,
  type PlatformTarget,
  buildBundleSpec,
  parseBundleSpec,
  uniqueTargets,
} from "@/lib/deliverables";
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
    deliverable?: unknown;
  }> | null;
  longTermAmountCents?: number | null;
  longTermCadence?: "NONE" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME" | null;
  longTermNotes?: string | null;
  builder?: { id: string; name?: string | null; email?: string | null } | null;
}

type SlotOverride = { label?: string; notes?: string };

interface OffersPanelProps {
  role: "CLIENT" | "BUILDER" | string;
  userId: string;
  projectId: string;
  projectStatus: string;
  selectedOfferId?: string | null;
  offers: OfferRecord[];
  probationary?: boolean;
  builderAtCapacity?: boolean;
  open?: boolean;
  onToggle?: () => void;
  unreadCount?: number;
  onJumpToLatest?: () => void;
  onSubmitOffer: (terms: {
    totalCents: number;
    longTermAmountCents?: number | null;
    longTermCadence?: string;
    longTermNotes?: string | null;
    milestoneDueDates?: Array<string | null>;
    platformTargets: PlatformTarget[];
    slotOverrides?: SlotOverride[];
  }) => void;
  onReviseOffer: (terms: {
    totalCents: number;
    longTermAmountCents?: number | null;
    longTermCadence?: string;
    longTermNotes?: string | null;
    milestoneDueDates?: Array<string | null>;
    platformTargets: PlatformTarget[];
    slotOverrides?: SlotOverride[];
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
      platformTargets: PlatformTarget[];
      slotOverrides?: SlotOverride[];
    },
  ) => void;
  onMarkOfferFinal: (offerId: string) => void;
  onUnfinalizeOffer: (offerId: string) => void;
  onAcceptOffer: (offerId: string) => void;
  defaultTotalCents?: number;
  defaultPlatformTargets?: PlatformTarget[];
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

function bundleFromOffer(offer: OfferRecord | null | undefined): BundleSpec | null {
  return parseBundleSpec((offer?.milestonesSnapshot?.[0] as any)?.deliverable);
}

function TermSheet({
  title,
  initialTotalCents,
  initialLongTermAmountCents,
  initialLongTermCadence,
  initialLongTermNotes,
  initialDueDates,
  initialTargets,
  initialSlotOverrides,
  submitLabel,
  onSubmit,
  disabled,
}: {
  title: string;
  initialTotalCents: number;
  initialLongTermAmountCents?: number | null;
  initialLongTermCadence?: string | null;
  initialLongTermNotes?: string | null;
  initialDueDates?: Array<string | null>;
  initialTargets?: PlatformTarget[];
  initialSlotOverrides?: SlotOverride[];
  submitLabel: string;
  onSubmit: (terms: {
    totalCents: number;
    longTermAmountCents?: number | null;
    longTermCadence?: string;
    longTermNotes?: string | null;
    milestoneDueDates?: Array<string | null>;
    platformTargets: PlatformTarget[];
    slotOverrides?: SlotOverride[];
  }) => void;
  disabled?: boolean;
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
  const [targets, setTargets] = useState<PlatformTarget[]>(
    initialTargets && initialTargets.length ? uniqueTargets(initialTargets) : ["WEB"],
  );
  const [overrides, setOverrides] = useState<Record<PlatformTarget, SlotOverride>>(() => {
    const map: Record<string, SlotOverride> = {};
    (initialTargets ?? []).forEach((t, i) => {
      const o = initialSlotOverrides?.[i];
      map[t] = { label: o?.label ?? "", notes: o?.notes ?? "" };
    });
    return map as any;
  });

  const totalCents = Math.round(Number(total) * 100);
  const milestones = useMemo(
    () => (Number.isFinite(totalCents) && totalCents > 0 ? buildMilestones(totalCents) : []),
    [totalCents],
  );
  const bundle = useMemo(() => buildBundleSpec(targets), [targets]);

  const toggleTarget = (t: PlatformTarget) => {
    setTargets((prev) => {
      const has = prev.includes(t);
      if (has) {
        const next = prev.filter((x) => x !== t);
        return next.length ? next : prev; // keep at least one
      }
      return uniqueTargets([...prev, t]);
    });
  };

  const setOverride = (t: PlatformTarget, patch: SlotOverride) => {
    setOverrides((prev) => ({ ...prev, [t]: { ...(prev[t] ?? {}), ...patch } }));
  };

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

        <div className="space-y-2">
          <div className="space-y-0.5">
            <span className="text-xs font-medium">Platform targets (applies to every milestone)</span>
            <p className="text-xs text-muted-foreground">
              Select all agreed platforms. Each milestone submission will include a locked deliverable for every target.
            </p>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {PLATFORM_TARGETS.map((t) => {
              const checked = targets.includes(t);
              return (
                <label key={t} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs ${checked ? "border-primary/50 bg-primary/5" : ""}`}>
                  <input type="checkbox" className="mt-0.5" checked={checked} onChange={() => toggleTarget(t)} />
                  <span>
                    <span className="block font-medium">{PLATFORM_TARGET_LABELS[t]}</span>
                    <span className="block text-muted-foreground">{TARGET_DESCRIPTIONS[t]}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="rounded-md border p-2">
            <p className="mb-1 text-xs font-medium">Pinned deliverables per milestone (read-only targets)</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {bundle.slots.map((s) => {
                const pinned = TARGET_MATRIX[s.target];
                return (
                  <li key={s.target} className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline">{PLATFORM_TARGET_LABELS[s.target]}</Badge>
                    <span>{pinned.kind.replace("_", " ")}{pinned.platform ? ` · ${pinned.platform}` : ""}{pinned.os ? ` · ${pinned.os}` : ""}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-2">
            {targets.map((t) => (
              <div key={t} className="grid gap-1 sm:grid-cols-2">
                <Input
                  className="h-8 text-xs"
                  value={overrides[t]?.label ?? ""}
                  onChange={(e) => setOverride(t, { label: e.target.value })}
                  placeholder={`${PLATFORM_TARGET_LABELS[t]} label (optional)`}
                />
                <Input
                  className="h-8 text-xs"
                  value={overrides[t]?.notes ?? ""}
                  onChange={(e) => setOverride(t, { notes: e.target.value })}
                  placeholder={`${PLATFORM_TARGET_LABELS[t]} review note (optional)`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Long-term cost (USD, informational)</span>
            <Input type="number" min="0" step="0.01" value={ltAmount} onChange={(e) => setLtAmount(e.target.value)} placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Cadence</span>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={ltCadence} onChange={(e) => setLtCadence(e.target.value)}>
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

        <Button
          className="w-full"
          disabled={disabled || !(Number.isFinite(totalCents) && totalCents > 0) || targets.length === 0}
          onClick={() =>
            onSubmit({
              totalCents,
              longTermAmountCents: ltAmount.trim() === "" ? null : Math.round(Number(ltAmount) * 100),
              longTermCadence: ltCadence,
              longTermNotes: ltNotes.trim() || null,
              milestoneDueDates: dueDates.map((d) => (d ? new Date(d).toISOString() : null)),
              platformTargets: targets,
              slotOverrides: targets.map((t) => ({
                ...(overrides[t]?.label?.trim() ? { label: overrides[t].label!.trim() } : {}),
                ...(overrides[t]?.notes?.trim() ? { notes: overrides[t].notes!.trim() } : {}),
              })),
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
  open = false,
  onToggle,
  unreadCount = 0,
  onJumpToLatest,
  onSubmitOffer,
  onReviseOffer,
  onWithdrawOffer,
  onSelectOffer,
  onCancelNegotiation,
  onUpdateOfferTerms,
  onMarkOfferFinal,
  onUnfinalizeOffer,
  onAcceptOffer,
  defaultTotalCents = 100000,
  defaultPlatformTargets = ["WEB"],
}: OffersPanelProps) {
  const myOffer = offers.find((o) => o.builderId === userId);
  const selectedOffer = offers.find((o) => o.id === selectedOfferId) ?? null;
  const [editingTerms, setEditingTerms] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  if (projectStatus !== "OPEN_FOR_BIDS") return null;

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

  const renderTargets = (offer: OfferRecord) => {
    const b = bundleFromOffer(offer);
    if (!b) return null;
    return (
      <div className="flex flex-wrap gap-1 text-xs">
        {b.targets.map((t) => (
          <Badge key={t} variant="secondary">{PLATFORM_TARGET_LABELS[t]}</Badge>
        ))}
      </div>
    );
  };

  const initialOverridesFrom = (offer: OfferRecord | null | undefined): SlotOverride[] | undefined => {
    const b = bundleFromOffer(offer);
    if (!b) return undefined;
    return b.slots.map((s) => ({ label: s.label ?? "", notes: s.notes ?? "" }));
  };

  return (
    <div className="relative -mx-3 border-t border-border/60 px-3 py-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <div className="text-sm font-semibold">Offers &amp; Terms</div>
            <div className="truncate text-xs text-muted-foreground">{summary}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unreadCount > 0 ? <Badge variant="default" className="h-5 min-w-5 px-1.5">{unreadCount > 99 ? "99+" : unreadCount} new</Badge> : null}
          {selectedOfferId ? <Badge variant="secondary">Negotiation</Badge> : null}
          <span className="text-xs text-muted-foreground">{open ? "Collapse" : "Expand"}</span>
        </div>
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-2 flex flex-col gap-2">
          {unreadCount > 0 && onJumpToLatest ? (
            <button type="button" className="mx-auto inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium shadow hover:bg-muted" onClick={onJumpToLatest}>
              <span>New {unreadCount === 1 ? "message" : "messages"}</span>
              <span className="text-muted-foreground">Jump to latest</span>
            </button>
          ) : null}
          <div className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto rounded-md border bg-background p-3 shadow-lg">
            {role === "BUILDER" ? (
              !myOffer ? (
                builderAtCapacity ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    You’ve reached the limit of 3 accepted active projects, so you can’t submit an offer for a new project plan right now.
                  </div>
                ) : (
                  <TermSheet
                    title="Submit your offer (one per project)"
                    initialTotalCents={defaultTotalCents}
                    initialTargets={defaultPlatformTargets}
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
                  {renderTargets(myOffer)}
                  {editingTerms ? (
                    <TermSheet
                      title="Revise offer"
                      initialTotalCents={myOffer.totalCents}
                      initialLongTermAmountCents={myOffer.longTermAmountCents}
                      initialLongTermCadence={myOffer.longTermCadence}
                      initialLongTermNotes={myOffer.longTermNotes}
                      initialDueDates={myOffer.milestonesSnapshot?.map((m) => m.dueDate ?? null)}
                      initialTargets={bundleFromOffer(myOffer)?.targets ?? defaultPlatformTargets}
                      initialSlotOverrides={initialOverridesFrom(myOffer)}
                      submitLabel="Save revision"
                      onSubmit={(t) => {
                        onReviseOffer(t);
                        setEditingTerms(false);
                      }}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingTerms(true)}>Revise</Button>
                      <Button size="sm" variant="destructive" onClick={onWithdrawOffer}>Withdraw (final)</Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{myOffer.status}</Badge>
                    <span>Your offer: {fmt(myOffer.totalCents)}</span>
                  </div>
                  {renderTargets(myOffer)}
                  {myOffer.status === "SELECTED" ? (
                    <p className="text-muted-foreground">Selected for negotiation. Discuss in chat and mark final when ready.</p>
                  ) : myOffer.status === "FINAL" ? (
                    <p className="text-muted-foreground">Marked final — waiting for client decision.</p>
                  ) : null}
                </div>
              )
            ) : null}

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
                          {renderTargets(offer)}
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
                            {canSelect ? <Button size="sm" onClick={() => onSelectOffer(offer.id)}>Select for negotiation</Button> : null}
                            {isSelected ? <Badge>Selected</Badge> : null}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            ) : null}

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
                        initialTargets={bundleFromOffer(selectedOffer)?.targets ?? defaultPlatformTargets}
                        initialSlotOverrides={initialOverridesFrom(selectedOffer)}
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
                            {renderTargets(selectedOffer)}
                            {builderFinalCompact ? (
                              <div className="text-xs text-muted-foreground">Milestone and long-term details hidden. Use “See more” to review terms.</div>
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
                                  <Button size="sm" variant="outline" onClick={() => setDetailsExpanded((v) => !v)}>{detailsExpanded ? "See less" : "See more"}</Button>
                                  <Button size="sm" variant="outline" onClick={() => onUnfinalizeOffer(selectedOffer.id)}>Unfinalize &amp; edit</Button>
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
        </div>
      ) : null}
    </div>
  );
}

export function OfferWidget() {
  return null;
}

export default OfferWidget;