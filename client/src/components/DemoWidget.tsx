import type { Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DemoWidgetProps {
  socket: Socket | null;
  milestoneId: string;
  demoUrl?: string | null;
  role: string;
}

export function DemoWidget({ socket, milestoneId, demoUrl, role }: DemoWidgetProps) {
  const handleApprove = () => {
    socket?.emit("approve_milestone", { milestoneId });
  };

  return (
    <Card className="w-full max-w-md border-blue-300">
      <CardHeader>
        <CardTitle className="text-base">Demo Submission</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="font-medium">Milestone:</span> {milestoneId}
        </p>
        <p className="break-all">
          <span className="font-medium">Demo:</span>{" "}
          {demoUrl ? (
            <a className="text-primary underline" href={demoUrl} target="_blank" rel="noreferrer">
              {demoUrl}
            </a>
          ) : (
            "Mock demo link"
          )}
        </p>
        {role === "CLIENT" ? (
          <Button className="w-full" onClick={handleApprove}>
            Approve Milestone
          </Button>
        ) : (
          <p className="text-muted-foreground">Awaiting client approval.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default DemoWidget;
