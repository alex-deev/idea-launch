import type { Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULT_MILESTONES = [
  { title: "Agreement", amount: 25000 },
  { title: "Initial Demo", amount: 25000 },
  { title: "Final Demo", amount: 25000 },
  { title: "Deployment", amount: 25000 },
];

interface OfferMilestone {
  title: string;
  amount: number;
}

interface OfferWidgetProps {
  socket: Socket | null;
  projectId: string;
  role: string;
  projectStatus: string;
  milestones?: OfferMilestone[];
  total?: number;
}

function formatCents(amount: number) {
  return `$${(amount / 100).toFixed(2)}`;
}

export function OfferWidget({
  socket,
  projectId,
  role,
  projectStatus,
  milestones = DEFAULT_MILESTONES,
  total,
}: OfferWidgetProps) {
  const computedTotal = total ?? milestones.reduce((sum, item) => sum + item.amount, 0);
  const isFunded = projectStatus === "ACTIVE";

  const handleAccept = () => {
    socket?.emit("accept_offer", { projectId });
  };

  return (
    <Card className="w-full max-w-md border-primary/30">
      <CardHeader>
        <CardTitle className="text-base">Final Offer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm">
          {milestones.map((milestone) => (
            <div key={milestone.title} className="flex items-center justify-between">
              <span>{milestone.title}</span>
              <span className="font-medium">{formatCents(milestone.amount)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t pt-2 font-semibold">
          <span>Total</span>
          <span>{formatCents(computedTotal)}</span>
        </div>
        {isFunded ? (
          <p className="text-sm font-medium text-green-600">Project Funded</p>
        ) : role === "CLIENT" ? (
          <Button className="w-full" onClick={handleAccept}>
            Accept &amp; Fund Escrow
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Waiting for client approval.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default OfferWidget;
