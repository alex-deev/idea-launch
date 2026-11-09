import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

/**
 * Phase 2 Synthesis Agent.
 *
 * Converts a client's free-text idea into the structured scope blueprint that
 * the existing SCOPE_WIDGET UI already understands. Uses Gemini Structured
 * Outputs (responseMimeType + responseSchema) so the model must return JSON
 * matching the marketplace contract.
 */

export const scopeBlueprintSchema = z.object({
  title: z.string().min(1),
  executiveSummary: z.string().min(1),
  technicalArchitecture: z.string().min(1),
  coreFeatures: z.array(z.string().min(1)).min(1).max(12),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1),
        amount: z.number().int().positive(),
      }),
    )
    .length(4),
  outOfScope: z.array(z.string().min(1)).max(12),
});

export type ScopeBlueprint = z.infer<typeof scopeBlueprintSchema>;

export interface SynthesisInput {
  idea: string;
  budgetCents?: number;
  timeline?: string;
  preferredStack?: string;
}

export interface SynthesisResult {
  blueprint: ScopeBlueprint;
  source: "gemini" | "fallback";
}

const MILESTONE_TITLES = [
  "Agreement",
  "Initial Demo",
  "Final Demo",
  "Deployment",
] as const;

const DEFAULT_BUDGET_CENTS = 100_000; // $1,000.00, matches the seeded demo project

const SYSTEM_PROMPT = `You are the Idea Launch scoping agent. Convert a client's software idea into a delivery blueprint for a milestone-based escrow marketplace.

Rules:
- Amounts are integer USD cents. The four milestone amounts MUST sum exactly to the client's stated budget.
- Use exactly four milestones in this order: Agreement, Initial Demo, Final Demo, Deployment.
- Keep the architecture to the platform defaults (React, Node.js/Express, PostgreSQL/Prisma, Socket.io) unless the idea clearly requires otherwise.
- Be concrete and concise. Do not return markdown or commentary outside the JSON object.`;

const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    executiveSummary: { type: Type.STRING },
    technicalArchitecture: { type: Type.STRING },
    coreFeatures: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    milestones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          amount: { type: Type.INTEGER },
        },
        required: ["title", "amount"],
      },
    },
    outOfScope: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    "title",
    "executiveSummary",
    "technicalArchitecture",
    "coreFeatures",
    "milestones",
    "outOfScope",
  ],
};

function sumAmounts(milestones: ScopeBlueprint["milestones"]): number {
  return milestones.reduce((total, milestone) => total + milestone.amount, 0);
}

/**
 * Gemini is instructed to hit the budget exactly, but structured outputs do not
 * enforce arithmetic. Normalize the result so escrow math never drifts.
 */
function normalizeBudget(
  blueprint: ScopeBlueprint,
  budgetCents: number,
): ScopeBlueprint {
  const milestones = blueprint.milestones.map((milestone, index) => ({
    title: MILESTONE_TITLES[index] ?? milestone.title,
    amount: Math.max(1, Math.round(milestone.amount)),
  }));

  const currentTotal = sumAmounts(milestones);
  const difference = budgetCents - currentTotal;
  const last = milestones[milestones.length - 1];
  last.amount = Math.max(1, last.amount + difference);

  // If clamping the last milestone left a residual, spread it over earlier
  // stages so the total is exactly the funded budget.
  const residual = budgetCents - sumAmounts(milestones);
  if (residual !== 0) {
    milestones[0].amount = Math.max(1, milestones[0].amount + residual);
  }

  return { ...blueprint, milestones };
}

export function createFallbackBlueprint(input: SynthesisInput): ScopeBlueprint {
  const budgetCents = input.budgetCents ?? DEFAULT_BUDGET_CENTS;
  const stageAmount = Math.floor(budgetCents / 4);
  const remainder = budgetCents - stageAmount * 4;
  const idea = input.idea.trim() || "A new software project";

  return {
    title: "Project Scope Blueprint",
    executiveSummary: `A scoped delivery plan for "${idea.slice(0, 140)}", covering architecture, features, and milestone-based delivery.`,
    technicalArchitecture:
      input.preferredStack ??
      "React frontend, Node.js/Express backend, PostgreSQL via Prisma, Socket.io realtime.",
    coreFeatures: [
      "AI-assisted scoping",
      "Milestone-based escrow",
      "Realtime chat and demos",
      "Quality scoring",
    ],
    milestones: MILESTONE_TITLES.map((title, index) => ({
      title,
      amount: stageAmount + (index === 0 ? remainder : 0),
    })),
    outOfScope: ["Native mobile apps", "Third-party billing integrations"],
  };
}

/**
 * Generate a scope blueprint. Falls back to a deterministic blueprint when no
 * Gemini key is configured so local development works without credentials.
 * API/validation failures are surfaced to the caller.
 */
export async function synthesizeScope(
  input: SynthesisInput,
): Promise<SynthesisResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const budgetCents = input.budgetCents ?? DEFAULT_BUDGET_CENTS;

  if (!apiKey) {
    console.warn(
      "[synthesis] GEMINI_API_KEY is not set; using deterministic fallback blueprint.",
    );
    return {
      blueprint: createFallbackBlueprint({ ...input, budgetCents }),
      source: "fallback",
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: [
      SYSTEM_PROMPT,
      "",
      `Client idea: ${input.idea}`,
      `Budget (cents): ${budgetCents}`,
      input.timeline ? `Timeline: ${input.timeline}` : "",
      input.preferredStack ? `Preferred stack: ${input.preferredStack}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    config: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: 0.4,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsed = scopeBlueprintSchema.parse(JSON.parse(text));
  return {
    blueprint: normalizeBudget(parsed, budgetCents),
    source: "gemini",
  };
}
