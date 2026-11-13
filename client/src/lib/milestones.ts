export const MILESTONE_TITLES = [
  "Agreement",
  "Initial Demo",
  "Final Demo",
  "Deployment",
] as const;

export const MILESTONE_RELEASE_PERCENTS = [0, 30, 40, 30] as const;

export interface MilestoneAmount {
  title: string;
  amount: number;
  releasePercent: number;
}

/**
 * Business-model auto-calc: 0% / 30% / 40% / 30% of total escrow (integer cents).
 * Agreement carries no payout; stages 2-4 carry the releasable funds.
 * Remainder cents are applied to Deployment so the four amounts always sum to total.
 */
export function calculateMilestoneAmounts(totalCents: number): number[] {
  const total = Number.isFinite(totalCents) ? Math.max(0, Math.round(totalCents)) : 0;
  const initialDemo = Math.round((total * 30) / 100);
  const finalDemo = Math.round((total * 40) / 100);
  const deployment = total - initialDemo - finalDemo;
  return [0, initialDemo, finalDemo, deployment];
}

export function buildMilestones(totalCents: number): MilestoneAmount[] {
  const amounts = calculateMilestoneAmounts(totalCents);
  return MILESTONE_TITLES.map((title, index) => ({
    title,
    amount: amounts[index],
    releasePercent: MILESTONE_RELEASE_PERCENTS[index],
  }));
}

export function normalizeMilestones(
  totalCents: number,
  milestones?: { title?: string; amount?: number; releasePercent?: number }[] | null,
): MilestoneAmount[] {
  const calculated = buildMilestones(totalCents);
  if (!milestones?.length) return calculated;
  return calculated.map((milestone, index) => ({
    ...milestone,
    // Titles are fixed to the four stages; amounts are always recalculated.
    title: MILESTONE_TITLES[index] ?? milestones[index]?.title ?? milestone.title,
  }));
}

export function sumMilestoneAmounts(
  milestones: { amount: number }[] | null | undefined,
): number {
  return (milestones ?? []).reduce((sum, milestone) => sum + (milestone.amount ?? 0), 0);
}
