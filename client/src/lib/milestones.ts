export const MILESTONE_TITLES = [
  "Initial Demo",
  "Final Demo",
  "Deployment",
] as const;

export const MILESTONE_RELEASE_PERCENTS = [30, 40, 30] as const;

export interface MilestoneAmount {
  title: string;
  amount: number;
  releasePercent: number;
}

/**
 * Business-model auto-calc: 30% / 40% / 30% of total escrow (integer cents).
 * All milestones are releasable/payable. Agreement is implicit at offer acceptance
 * (not a milestone). Remainder cents are applied to Deployment so amounts sum to total.
 */
export function calculateMilestoneAmounts(totalCents: number): number[] {
  const total = Number.isFinite(totalCents) ? Math.max(0, Math.round(totalCents)) : 0;
  const initialDemo = Math.round((total * 30) / 100);
  const finalDemo = Math.round((total * 40) / 100);
  const deployment = total - initialDemo - finalDemo;
  return [initialDemo, finalDemo, deployment];
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
  _milestones?: { title?: string; amount?: number; releasePercent?: number }[] | null,
): MilestoneAmount[] {
  // Titles/order/split are fixed (3 stages); amounts always recalculated from total.
  return buildMilestones(totalCents);
}

export function sumMilestoneAmounts(
  milestones: { amount: number }[] | null | undefined,
): number {
  return (milestones ?? []).reduce((sum, milestone) => sum + (milestone.amount ?? 0), 0);
}
