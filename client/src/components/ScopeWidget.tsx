import { useEffect, useMemo, useState } from "react";

import type { Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildMilestones,
  normalizeMilestones,
  sumMilestoneAmounts,
} from "@/lib/milestones";

interface ScopePayload {
  title?: string;
  executiveSummary?: string;
  technicalArchitecture?: string;
  coreFeatures?: string[];
  milestones?: { title: string; amount: number; releasePercent?: number }[];
  outOfScope?: string[];
  budgetCents?: number;
  appKinds?: string[];
  appKindOther?: string;
}

interface ScopeWidgetProps {
  socket: Socket | null;
  projectId: string;
  role: string;
  payload?: ScopePayload;
  messageId?: string;
  editable?: boolean;
  totalCents?: number;
}

export function ScopeWidget({
  socket,
  projectId,
  role,
  payload,
  messageId,
  editable = false,
  totalCents,
}: ScopeWidgetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ScopePayload>(payload ?? {});

  const canEdit = editable && role === "CLIENT";
  const showArchitecture = role !== "CLIENT";

  const resolvedTotal = useMemo(() => {
    if (typeof totalCents === "number" && totalCents > 0) return totalCents;
    const payloadBudget = (payload as { budgetCents?: number } | undefined)?.budgetCents;
    if (typeof payloadBudget === "number" && payloadBudget > 0) return payloadBudget;
    const milestoneSum = sumMilestoneAmounts(payload?.milestones);
    return milestoneSum > 0 ? milestoneSum : 0;
  }, [payload, totalCents]);

  const normalizedView = useMemo<ScopePayload>(() => {
    const base = payload ?? {};
    return {
      ...base,
      milestones: normalizeMilestones(resolvedTotal, base.milestones),
    };
  }, [payload, resolvedTotal]);

  useEffect(() => {
    if (!isEditing) {
      setDraft(normalizedView);
    }
  }, [isEditing, normalizedView]);

  const startEditing = () => {
    setDraft({
      ...normalizedView,
      milestones: buildMilestones(resolvedTotal),
    });
    setIsEditing(true);
  };

  const approvePayload = useMemo<ScopePayload>(() => {
    const base = isEditing ? draft : normalizedView;
    return {
      ...base,
      milestones: buildMilestones(resolvedTotal),
    };
  }, [draft, isEditing, normalizedView, resolvedTotal]);

  const handleApprove = () => {
    socket?.emit("approve_scope", {
      projectId,
      messageId,
      payload: approvePayload,
    });
    setIsEditing(false);
  };

  const scope = isEditing ? draft : normalizedView;

  return (
    <Card className="w-full max-w-2xl border-indigo-300">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            {isEditing ? (
              <Input
                value={scope.title ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            ) : (
              scope.title ?? "Project Scope Blueprint"
            )}
          </CardTitle>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
            >
              {isEditing ? "Cancel" : "Edit"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isEditing ? (
          <>
            <section className="space-y-2">
              <h3 className="font-semibold">Executive Summary</h3>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={scope.executiveSummary ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    executiveSummary: event.target.value,
                  }))
                }
                rows={3}
              />
            </section>

            {showArchitecture ? (
              <section className="space-y-2">
                <h3 className="font-semibold">Technical Architecture</h3>
                <textarea
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={scope.technicalArchitecture ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      technicalArchitecture: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="font-semibold">Core Features</h3>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={(scope.coreFeatures ?? []).join(", ")}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    coreFeatures: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                rows={2}
              />
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Milestones</h3>
              <p className="text-xs text-muted-foreground">
                Prices are auto-calculated (0% / 30% / 40% / 30%) and read-only.
              </p>
              <ul className="space-y-1">
                {buildMilestones(resolvedTotal).map((milestone) => (
                  <li key={milestone.title} className="flex items-center justify-between rounded-md border bg-muted px-3 py-2">
                    <span>{milestone.title}</span>
                    <span className="font-medium">${(milestone.amount / 100).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Out of Scope</h3>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={(scope.outOfScope ?? []).join(", ")}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    outOfScope: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                rows={2}
              />
            </section>

            <Button className="w-full" onClick={() => setIsEditing(false)}>
              Save edits
            </Button>
          </>
        ) : (
          <>
            {scope.executiveSummary ? (
              <section>
                <h3 className="font-semibold">Executive Summary</h3>
                <p>{scope.executiveSummary}</p>
              </section>
            ) : null}

            {(scope.appKinds && scope.appKinds.length > 0) || scope.appKindOther ? (
              <section>
                <h3 className="font-semibold">App kind</h3>
                <p>
                  {[...(scope.appKinds ?? []), scope.appKindOther ? `Other: ${scope.appKindOther}` : null]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </section>
            ) : null}

            {showArchitecture && scope.technicalArchitecture ? (
              <section>
                <h3 className="font-semibold">Technical Architecture</h3>
                <p>{scope.technicalArchitecture}</p>
              </section>
            ) : null}

            {scope.coreFeatures?.length ? (
              <section>
                <h3 className="font-semibold">Core Features</h3>
                <ul className="list-disc pl-5">
                  {scope.coreFeatures.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {scope.milestones?.length ? (
              <section>
                <h3 className="font-semibold">Milestones</h3>
                <ul className="space-y-1">
                  {scope.milestones.map((milestone) => (
                    <li key={milestone.title} className="flex justify-between">
                      <span>{milestone.title}</span>
                      <span>${(milestone.amount / 100).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {scope.outOfScope?.length ? (
              <section>
                <h3 className="font-semibold">Out of Scope</h3>
                <ul className="list-disc pl-5">
                  {scope.outOfScope.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}

        {role === "CLIENT" && editable && !isEditing ? (
          <Button className="w-full" onClick={handleApprove}>
            Approve &amp; Publish
          </Button>
        ) : role === "CLIENT" && editable && isEditing ? null : role === "CLIENT" ? (
          <p className="text-muted-foreground">Blueprint approved and published.</p>
        ) : (
          <p className="text-muted-foreground">Waiting for client approval &amp; publish.</p>
        )}
      </CardContent>
    </Card>
  );
}
