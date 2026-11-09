import type { Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
}

export function ScopeWidget({ socket, projectId, role, payload }: ScopeWidgetProps) {
  const scope = payload ?? {};

  const handleApprove = () => {
    socket?.emit("approve_scope", { projectId });
  };

  return (
    <Card className="w-full max-w-2xl border-indigo-300">
      <CardHeader>
        <CardTitle className="text-base">{scope.title ?? "Project Scope Blueprint"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
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

        {role === "CLIENT" ? (
          <Button className="w-full" onClick={handleApprove}>
            Approve Blueprint
          </Button>
        ) : (
          <p className="text-muted-foreground">Waiting for client approval.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default ScopeWidget;
