import { useState } from "react";
import type { Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectControlsProps {
  socket: Socket | null;
  project: any;
  role: string;
  userId: string;
}

export function ProjectControls({ socket, project, role, userId }: ProjectControlsProps) {
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");

  if (!project) return null;

  const milestones = project.milestones ?? [];
  const releasedPercent = milestones
    .filter((m: any) => m.status === "RELEASED" || m.status === "COMPLETED")
    .reduce((sum: number, m: any) => sum + (m.releasePercent ?? 0), 0);
  const releasedAmount = Math.round((project.totalEscrow ?? 0) * (releasedPercent / 100));

  const handleCancel = () => {
    socket?.emit("cancel_project", { projectId: project.id, userId });
  };

  const handleExtension = () => {
    socket?.emit("request_extension", { projectId: project.id, userId });
  };

  const handleSubmitRating = () => {
    if (rating < 1) return;
    socket?.emit("submit_rating", {
      projectId: project.id,
      userId,
      rating,
      feedback,
    });
  };

  const canRate =
    (project.status === "COMPLETED" || project.status === "CANCELLED") &&
    !project.qualityScore;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Project Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Status: <strong>{project.status}</strong></span>
          <span>
            Escrow released: <strong>{releasedPercent}%</strong> (${(releasedAmount / 100).toFixed(2)} / ${((project.totalEscrow ?? 0) / 100).toFixed(2)})
          </span>
        </div>

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

        <div className="flex flex-wrap gap-2">
          {role === "BUILDER" && project.status === "ACTIVE" && !project.extensionRequested ? (
            <Button variant="outline" size="sm" onClick={handleExtension}>
              Request Extension
            </Button>
          ) : null}

          {role === "CLIENT" &&
          project.status !== "COMPLETED" &&
          project.status !== "CANCELLED" ? (
            <Button variant="destructive" size="sm" onClick={handleCancel}>
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
            />
            <Button size="sm" onClick={handleSubmitRating} disabled={rating < 1}>
              Submit Rating
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default ProjectControls;
