import { useEffect, useState } from "react";

import type { Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ScopePayload {
  title?: string;
  executiveSummary?: string;
  technicalArchitecture?: string;
  coreFeatures?: string[];
  milestones?: { title: string; amount: number }[];
  outOfScope?: string[];
}

interface ScopeWidgetProps {
  socket: Socket | null;
  projectId: string;
  role: string;
  payload?: ScopePayload;
  messageId?: string;
  editable?: boolean;
}

export function ScopeWidget({
  socket,
  projectId,
  role,
  payload,
  messageId,
  editable = false,
}: ScopeWidgetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ScopePayload>(payload ?? {});

  useEffect(() => {
    if (!isEditing) {
      setDraft(payload ?? {});
    }
  }, [isEditing, payload]);

  const canEdit = editable && role === "CLIENT";

  const handleApprove = () => {
    socket?.emit("approve_scope", {
      projectId,
      messageId,
      payload: isEditing ? draft : (payload ?? {}),
    });
    setIsEditing(false);
  };

  const scope = isEditing ? draft : (payload ?? {});

  const updateMilestone = (
    index: number,
    field: "title" | "amount",
    value: string,
  ) => {
    setDraft((current) => {
      const milestones = [...(current.milestones ?? [])];
      const milestone = { ...(milestones[index] ?? { title: "", amount: 0 }) };
      if (field === "title") {
        milestone.title = value;
      } else {
        milestone.amount = Number(value) || 0;
      }
      milestones[index] = milestone;
      return { ...current, milestones };
    });
  };

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
              onClick={() => setIsEditing((value) => !value)}
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
              <div className="space-y-2">
                {(scope.milestones ?? []).map((milestone, index) => (
                  <div key={`${milestone.title}-${index}`} className="flex gap-2">
                    <span className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm">
                      {milestone.title}
                    </span>
                    <Input
                      type="number"
                      value={milestone.amount}
                      onChange={(event) =>
                        updateMilestone(index, "amount", event.target.value)
                      }
                      placeholder="Amount (cents)"
                    />
                  </div>
                ))}
              </div>
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

            {scope.technicalArchitecture ? (
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

        {role === "CLIENT" && editable ? (
          <Button className="w-full" onClick={handleApprove}>
            Approve Blueprint
          </Button>
        ) : role === "CLIENT" ? (
          <p className="text-muted-foreground">Blueprint approved.</p>
        ) : (
          <p className="text-muted-foreground">Waiting for client approval.</p>
        )}
      </CardContent>
    </Card>
  );
}
