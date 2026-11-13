export const MILESTONE_TITLES = [
  "Initial Demo",
  "Final Demo",
  "Deployment",
] as const;

export const MILESTONE_RELEASE_PERCENTS = [30, 40, 30] as const;

export interface MilestoneBlueprint {
  stageNumber: number;
  title: string;
  amount: number;
  releasePercent: number;
}

export function calculateMilestoneAmounts(totalCents: number): number[] {
  const total = Number.isFinite(totalCents) ? Math.max(0, Math.round(totalCents)) : 0;
  const initialDemo = Math.round((total * 30) / 100);
  const finalDemo = Math.round((total * 40) / 100);
  const deployment = total - initialDemo - finalDemo;
  return [initialDemo, finalDemo, deployment];
}

export function buildMilestones(totalCents: number): MilestoneBlueprint[] {
  const amounts = calculateMilestoneAmounts(totalCents);
  return MILESTONE_TITLES.map((title, index) => ({
    stageNumber: index + 1,
    title,
    amount: amounts[index],
    releasePercent: MILESTONE_RELEASE_PERCENTS[index],
  }));
}

export function resolveProjectTotal(
  totalEscrow?: number | null,
  milestones?: { amount?: number }[] | null,
): number {
  if (Number.isInteger(totalEscrow) && (totalEscrow as number) > 0) {
    return totalEscrow as number;
  }
  const sum = (milestones ?? []).reduce(
    (acc, milestone) => acc + (Number(milestone.amount) || 0),
    0,
  );
  return sum > 0 ? sum : 0;
}
