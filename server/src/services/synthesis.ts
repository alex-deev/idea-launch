import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

import {
  MILESTONE_TITLES,
  buildMilestones,
  calculateMilestoneAmounts,
} from "../lib/milestones.js";

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
        amount: z.number().int().nonnegative(),
      }),
    )
    .length(3),
  outOfScope: z.array(z.string().min(1)).max(12),
  appKinds: z.array(z.string().min(1)).optional().default([]),
  appKindOther: z.string().min(1).optional(),
});

export type ScopeBlueprint = z.infer<typeof scopeBlueprintSchema>;

export interface SynthesisInput {
  idea: string;
  budgetCents?: number;
  timeline?: string;
  appKinds?: string[];
  appKindOther?: string;
}

export interface SynthesisResult {
  blueprint: ScopeBlueprint;
  source: "gemini" | "fallback";
}

const DEFAULT_BUDGET_CENTS = 100_000; // $1,000.00

const SYSTEM_PROMPT = `You are the Idea Launch scoping agent. Convert a client's software idea into a delivery blueprint for a milestone-based escrow marketplace.

Rules:
- Amounts are integer USD cents. The three milestone amounts MUST sum exactly to the client's stated budget.
- Use exactly three milestones in this order: Initial Demo, Final Demo, Deployment.
- Milestone payout split is business-model auto-calculated: Initial Demo 30%, Final Demo 40%, Deployment 30% of the total budget.
- Agreement is implicit when the client accepts the final offer (not a milestone and not chargeable).
- Consider the client's selected "App kind" (platform target) when shaping the architecture, features, and out-of-scope items (e.g. website, web app, mobile app, desktop app, or other targets). Keep recommendations concrete and appropriate for the stated platform(s).
- If "Other" app kind details are provided, reflect them.
- Do not assume a specific tech stack unless implied by the idea/platform; be practical and clear.
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
    appKinds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    appKindOther: { type: Type.STRING },
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

function normalizeAppKinds(input: SynthesisInput): string[] {
  return Array.isArray(input.appKinds)
    ? input.appKinds.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim())
    : [];
}

function normalizeAppKindOther(input: SynthesisInput): string | undefined {
  const other = typeof input.appKindOther === "string" ? input.appKindOther.trim() : "";
  return other ? other : undefined;
}

function describeAppKinds(input: SynthesisInput): string {
  const kinds = normalizeAppKinds(input);
  const other = normalizeAppKindOther(input);
  const parts = [...kinds];
  if (other) parts.push(`Other: ${other}`);
  return parts.length ? parts.join(", ") : "Not specified";
}

/**
 * Enforce fixed milestone titles/order and the 30/40/30 business-model split
 * so escrow math never drifts from the stated budget. Preserve app kind fields.
 */
function normalizeBlueprint(
  blueprint: ScopeBlueprint,
  budgetCents: number,
  input: SynthesisInput,
): ScopeBlueprint {
  const amounts = calculateMilestoneAmounts(budgetCents);
  const milestones = MILESTONE_TITLES.map((title, index) => ({
    title,
    amount: amounts[index],
  }));
  const appKinds = normalizeAppKinds(input);
  const appKindOther = normalizeAppKindOther(input);
  return {
    ...blueprint,
    milestones,
    appKinds: appKinds.length ? appKinds : (blueprint.appKinds ?? []),
    ...(appKindOther ? { appKindOther } : blueprint.appKindOther ? { appKindOther: blueprint.appKindOther } : {}),
  };
}

export function createFallbackBlueprint(input: SynthesisInput): ScopeBlueprint {
  const budgetCents = input.budgetCents ?? DEFAULT_BUDGET_CENTS;
  const idea = input.idea.trim() || "A new software project";
  const appKinds = normalizeAppKinds(input);
  const appKindOther = normalizeAppKindOther(input);
  const appKindText = describeAppKinds(input);

  const architectureBase =
    appKinds.length || appKindOther
      ? `Platform target: ${appKindText}. Architecture and delivery will be tailored to the selected app kind(s).`
      : "Architecture and delivery will be tailored to the product needs.";

  return {
    title: "Project Scope Blueprint",
    executiveSummary: `A scoped delivery plan for "${idea.slice(0, 140)}" (${appKindText}), covering architecture, features, and milestone-based delivery.`,
    technicalArchitecture: architectureBase,
    coreFeatures: [
      "Clear user experience for the target platform(s)",
      "Core functionality aligned to the project idea",
      "Milestone-based delivery and demos",
      "Quality review and handoff",
    ],
    milestones: buildMilestones(budgetCents).map(({ title, amount }) => ({
      title,
      amount,
    })),
    outOfScope: ["Features not described in the agreed scope", "Unrelated platform targets"],
    appKinds,
    ...(appKindOther ? { appKindOther } : {}),
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
  const appKindText = describeAppKinds(input);

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
      `App kind (platform targets): ${appKindText}`,
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
    blueprint: normalizeBlueprint(parsed, budgetCents, input),
    source: "gemini",
  };
}