import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

import {
  MILESTONE_TITLES,
  buildMilestones,
  calculateMilestoneAmounts,
} from "../lib/milestones.js";

/**
 * Phase 2 Synthesis/Refinement Agent.
 *
 * Converts a client's idea into a delivery blueprint and can iteratively ask
 * targeted clarifying questions (needs_info) before producing a ready blueprint.
 * Uses Gemini Structured Outputs so the model must return JSON matching the
 * marketplace contract. Fallback (no key) or on AI error/timeout returns a
 * deterministic ready blueprint so scoping never blocks.
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

export interface RefinementAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface SynthesisInput {
  idea: string;
  budgetCents?: number;
  timeline?: string;
  appKinds?: string[];
  appKindOther?: string;
  /** Prior refinement answers (chronological) to incorporate. */
  refinementAnswers?: RefinementAnswer[];
  /** Previous AI questions asked in the last turn (for context). */
  previousQuestions?: { id: string; question: string }[];
  /** Prior context summary from earlier refinement turns. */
  previousContextSummary?: string;
  /** 0-based refinement round (0 = initial intake). */
  round?: number;
  /** Force a ready blueprint when limits are reached. */
  forceReady?: boolean;
}

export interface ScopeRefinementQuestion {
  id: string;
  question: string;
  hint?: string;
  required?: boolean;
}

export interface SynthesisNeedsInfo {
  status: "needs_info";
  questions: ScopeRefinementQuestion[];
  contextSummary?: string;
  source: "gemini" | "nemotron" | "fallback";
}

export interface SynthesisReady {
  status: "ready";
  blueprint: ScopeBlueprint;
  contextSummary?: string;
  source: "gemini" | "nemotron" | "fallback";
}

export type SynthesisResult = SynthesisNeedsInfo | SynthesisReady;

const DEFAULT_BUDGET_CENTS = 100_000; // $1,000.00
export const MAX_REFINEMENT_ROUNDS = 3;
export const MAX_REFINEMENT_QUESTIONS = 4;
const GEMINI_TIMEOUT_MS = 30_000;
const NEMOTRON_TIMEOUT_MS = 30_000;
const DEFAULT_NEMOTRON_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const DEFAULT_NEMOTRON_BASE_URL = "https://integrate.api.nvidia.com/v1";

const READY_SYSTEM_PROMPT = `You are the Idea Launch scoping agent. Convert a client's software idea and any clarification answers into a delivery blueprint for a milestone-based escrow marketplace.

Rules:
- Amounts are integer USD cents. The three milestone amounts MUST sum exactly to the client's stated budget.
- Use exactly three milestones in this order: Initial Demo, Final Demo, Deployment.
- Milestone payout split is business-model auto-calculated: Initial Demo 30%, Final Demo 40%, Deployment 30% of the total budget.
- Agreement is implicit when the client accepts the final offer (not a milestone and not chargeable).
- Consider the client's selected "App kind" (platform target) when shaping the architecture, features, and out-of-scope items. Keep recommendations concrete and appropriate for the stated platform(s).
- If "Other" app kind details are provided, reflect them. Incorporate all provided clarification answers.
- Do not assume a specific tech stack unless implied by the idea/platform; be practical and clear.
- Be concrete and concise. Return only the JSON object.`;

const REFINE_SYSTEM_PROMPT = `You are the Idea Launch scoping agent helping clarify a client's software idea before producing a delivery blueprint.

Decide the next step:
- Return status "needs_info" with 1-${MAX_REFINEMENT_QUESTIONS} targeted, high-signal clarifying questions when key details are missing or ambiguous (e.g. target users/audience, core user flows, must-have vs nice-to-have, integrations/data, platforms/devices specifics, constraints/success criteria). Ask only questions that materially improve the scope. Keep questions concise and specific.
- Return status "ready" with a complete blueprint when the idea and any provided answers are sufficient to scope confidently.

Blueprint rules (when ready):
- Amounts are integer USD cents. The three milestone amounts MUST sum exactly to the client's stated budget.
- Exactly three milestones in this order: Initial Demo, Final Demo, Deployment. Split 30% / 40% / 30%.
- Agreement is implicit at final-offer acceptance (not a milestone). Consider app kind/platform targets. Incorporate clarification answers. Be concrete and practical.
- Return only the JSON object.`;

const BLUEPRINT_PROPERTIES = {
  title: { type: Type.STRING },
  executiveSummary: { type: Type.STRING },
  technicalArchitecture: { type: Type.STRING },
  coreFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
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
  outOfScope: { type: Type.ARRAY, items: { type: Type.STRING } },
  appKinds: { type: Type.ARRAY, items: { type: Type.STRING } },
  appKindOther: { type: Type.STRING },
};

const READY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ["ready"] },
    contextSummary: { type: Type.STRING },
    blueprint: {
      type: Type.OBJECT,
      properties: BLUEPRINT_PROPERTIES,
      required: [
        "title",
        "executiveSummary",
        "technicalArchitecture",
        "coreFeatures",
        "milestones",
        "outOfScope",
      ],
    },
  },
  required: ["status", "blueprint"],
};

const REFINE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ["needs_info", "ready"] },
    contextSummary: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          hint: { type: Type.STRING },
          required: { type: Type.BOOLEAN },
        },
        required: ["id", "question"],
      },
    },
    blueprint: {
      type: Type.OBJECT,
      properties: BLUEPRINT_PROPERTIES,
      required: [
        "title",
        "executiveSummary",
        "technicalArchitecture",
        "coreFeatures",
        "milestones",
        "outOfScope",
      ],
    },
  },
  required: ["status"],
};

const needsInfoSchema = z.object({
  status: z.literal("needs_info"),
  questions: z
    .array(
      z.object({
        id: z.string().min(1),
        question: z.string().min(1),
        hint: z.string().min(1).optional(),
        required: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(MAX_REFINEMENT_QUESTIONS),
  contextSummary: z.string().min(1).optional(),
});

const readyResponseSchema = z.object({
  status: z.literal("ready"),
  blueprint: scopeBlueprintSchema,
  contextSummary: z.string().min(1).optional(),
});

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

export function normalizeBlueprint(
  blueprint: ScopeBlueprint,
  budgetCents: number,
  input: Pick<SynthesisInput, "appKinds" | "appKindOther">,
): ScopeBlueprint {
  const amounts = calculateMilestoneAmounts(budgetCents);
  const milestones = MILESTONE_TITLES.map((title, index) => ({
    title,
    amount: amounts[index],
  }));
  const appKinds = normalizeAppKinds(input as SynthesisInput);
  const appKindOther = normalizeAppKindOther(input as SynthesisInput);
  return {
    ...blueprint,
    milestones,
    appKinds: appKinds.length ? appKinds : (blueprint.appKinds ?? []),
    ...(appKindOther
      ? { appKindOther }
      : blueprint.appKindOther
        ? { appKindOther: blueprint.appKindOther }
        : {}),
  };
}

function formatAnswers(answers: RefinementAnswer[] | undefined): string {
  if (!Array.isArray(answers) || answers.length === 0) return "";
  return answers
    .filter((a) => a && typeof a.answer === "string" && a.answer.trim())
    .map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer.trim()}`)
    .join("\n\n");
}

function buildContext(input: SynthesisInput, budgetCents: number): string {
  const appKindText = describeAppKinds(input);
  const answersText = formatAnswers(input.refinementAnswers);
  const prevSummary = input.previousContextSummary?.trim();
  return [
    `Client idea: ${input.idea}`,
    `Budget (cents): ${budgetCents}`,
    input.timeline ? `Timeline: ${input.timeline}` : "",
    `App kind (platform targets): ${appKindText}`,
    prevSummary ? `Previous context summary: ${prevSummary}` : "",
    answersText ? `Clarification answers:\n${answersText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function createFallbackBlueprint(
  input: SynthesisInput & { budgetCents?: number },
): ScopeBlueprint {
  const budgetCents = input.budgetCents ?? DEFAULT_BUDGET_CENTS;
  const idea = (input.idea ?? "").trim() || "A new software project";
  const appKinds = normalizeAppKinds(input);
  const appKindOther = normalizeAppKindOther(input);
  const appKindText = describeAppKinds(input);
  const answersText = formatAnswers(input.refinementAnswers);
  const summaryExtra = answersText
    ? ` Client details: ${answersText.replace(/\s+/g, " ").slice(0, 280)}`
    : "";

  const architectureBase =
    appKinds.length || appKindOther
      ? `Platform target: ${appKindText}. Architecture and delivery will be tailored to the selected app kind(s).`
      : "Architecture and delivery will be tailored to the product needs.";

  return {
    title: "Project Scope Blueprint",
    executiveSummary: `A scoped delivery plan for "${idea.slice(0, 140)}" (${appKindText}), covering architecture, features, and milestone-based delivery.${summaryExtra}`,
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

function coerceQuestions(raw: ScopeRefinementQuestion[]): ScopeRefinementQuestion[] {
  return raw.slice(0, MAX_REFINEMENT_QUESTIONS).map((q, i) => ({
    id: q.id?.trim() || `q${i + 1}`,
    question: q.question.trim(),
    ...(q.hint?.trim() ? { hint: q.hint.trim() } : {}),
    ...(q.required === false ? { required: false } : { required: true }),
  }));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function fallbackReady(
  input: SynthesisInput,
  budgetCents: number,
  reason: string,
): SynthesisReady {
  console.warn(`[synthesis] ${reason}; using deterministic fallback blueprint.`);
  return {
    status: "ready",
    blueprint: createFallbackBlueprint({ ...input, budgetCents }),
    contextSummary:
      "A fallback blueprint was generated because AI scoping was unavailable. You can edit the details and refine further if needed.",
    source: "fallback",
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty AI response.");
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try to recover a JSON object from fenced/extra text.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI response was not valid JSON.");
  }
}

function parseSynthesisModelResponse(
  raw: unknown,
  input: SynthesisInput,
  budgetCents: number,
  source: "gemini" | "nemotron",
  startedAt: number,
  model: string,
): SynthesisResult {
  const obj = raw as any;

  if (obj?.status === "ready" && obj.blueprint) {
    const parsed = readyResponseSchema.parse(obj);
    console.info(`[synthesis] ready via ${source} model=${model} in ${Date.now() - startedAt}ms`);
    return {
      status: "ready",
      blueprint: normalizeBlueprint(parsed.blueprint, budgetCents, input),
      contextSummary: parsed.contextSummary,
      source,
    };
  }

  if (obj?.status === "needs_info" && Array.isArray(obj.questions) && obj.questions.length > 0) {
    const parsed = needsInfoSchema.parse(obj);
    console.info(
      `[synthesis] needs_info via ${source} model=${model} (${parsed.questions.length} questions) in ${Date.now() - startedAt}ms`,
    );
    return {
      status: "needs_info",
      questions: coerceQuestions(parsed.questions),
      contextSummary: parsed.contextSummary,
      source,
    };
  }

  throw new Error("AI response did not match expected schema.");
}

async function synthesizeScopeWithNemotron(
  input: SynthesisInput,
  apiKey: string,
  budgetCents: number,
): Promise<SynthesisResult> {
  const round = Math.max(0, Number(input.round ?? 0));
  const model = (process.env.NVIDIA_MODEL ?? DEFAULT_NEMOTRON_MODEL).trim() || DEFAULT_NEMOTRON_MODEL;
  const baseUrl = (process.env.NVIDIA_BASE_URL ?? DEFAULT_NEMOTRON_BASE_URL).trim().replace(/\/+$/, "");
  const context = buildContext(input, budgetCents);
  const forceReady = input.forceReady || round >= MAX_REFINEMENT_ROUNDS;
  const systemPrompt = forceReady ? READY_SYSTEM_PROMPT : REFINE_SYSTEM_PROMPT;
  const responseShape = forceReady
    ? `Return JSON: {"status":"ready","contextSummary":"...","blueprint":{"title":"...","executiveSummary":"...","technicalArchitecture":"...","coreFeatures":["..."],"milestones":[{"title":"Initial Demo","amount":0},{"title":"Final Demo","amount":0},{"title":"Deployment","amount":0}],"outOfScope":["..."],"appKinds":["..."],"appKindOther":"..."}}`
    : `Return JSON: either {"status":"needs_info","contextSummary":"...","questions":[{"id":"q1","question":"...","hint":"...","required":true}]} (1-${MAX_REFINEMENT_QUESTIONS} questions) OR {"status":"ready","contextSummary":"...","blueprint":{...}}.`;
  const userContent = [context, `Refinement round: ${round}`, responseShape, "Return only valid JSON."]
    .filter(Boolean)
    .join("\n\n");

  const startedAt = Date.now();
  console.info(
    `[synthesis] start provider=nemotron model=${model} round=${round} forceReady=${Boolean(forceReady)} answers=${input.refinementAnswers?.length ?? 0}`,
  );

  const response = await withTimeout(
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
        stream: false,
        response_format: { type: "json_object" },
      }),
    }),
    NEMOTRON_TIMEOUT_MS,
    "Nemotron request",
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Nemotron API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content)
    ? content.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("")
    : "";
  if (!text) throw new Error("Nemotron returned an empty response.");

  const raw = extractJsonObject(text);

  // If model asked questions in an early round, accept needs_info; if ambiguous/empty, force ready.
  if (!forceReady) {
    try {
      return parseSynthesisModelResponse(raw, input, budgetCents, "nemotron", startedAt, model);
    } catch (e) {
      // Fall through to force-ready attempt below.
      console.warn(`[synthesis] nemotron response invalid for refine step, retrying as ready: ${(e as Error).message}`);
    }
  } else {
    return parseSynthesisModelResponse(raw, input, budgetCents, "nemotron", startedAt, model);
  }

  // Ambiguous needs_info: produce a ready blueprint.
  const readyStartedAt = Date.now();
  const readyResp = await withTimeout(
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: READY_SYSTEM_PROMPT },
          { role: "user", content: [context, "Return only valid JSON.", `Return JSON: {"status":"ready","contextSummary":"...","blueprint":{...}}`].join("\n\n") },
        ],
        temperature: 0.4,
        stream: false,
        response_format: { type: "json_object" },
      }),
    }),
    NEMOTRON_TIMEOUT_MS,
    "Nemotron ready fallback",
  );
  if (!readyResp.ok) {
    const errText = await readyResp.text().catch(() => "");
    throw new Error(`Nemotron API error ${readyResp.status}: ${errText.slice(0, 300)}`);
  }
  const readyData = (await readyResp.json()) as any;
  const readyContent = readyData?.choices?.[0]?.message?.content;
  const readyText = typeof readyContent === "string" ? readyContent : "";
  if (!readyText) throw new Error("Nemotron returned an empty response.");
  return parseSynthesisModelResponse(extractJsonObject(readyText), input, budgetCents, "nemotron", readyStartedAt, model);
}

async function synthesizeScopeWithGemini(
  input: SynthesisInput,
  apiKey: string,
  budgetCents: number,
): Promise<SynthesisResult> {
  const round = Math.max(0, Number(input.round ?? 0));
  const ai = new GoogleGenAI({ apiKey });
  const configuredModel = (process.env.GEMINI_MODEL ?? "gemini-2.5-flash").trim() || "gemini-2.5-flash";
  const context = buildContext(input, budgetCents);
  const candidates = Array.from(
    new Set([
      configuredModel,
      configuredModel.startsWith("models/") ? configuredModel.slice("models/".length) : `models/${configuredModel}`,
    ].filter(Boolean)),
  );

  let lastError: unknown = null;
  for (const model of candidates) {
    const startedAt = Date.now();
    console.info(
      `[synthesis] start provider=gemini model=${model} round=${round} forceReady=${Boolean(input.forceReady)} answers=${input.refinementAnswers?.length ?? 0}`,
    );
    try {
      if (input.forceReady || round >= MAX_REFINEMENT_ROUNDS) {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: [READY_SYSTEM_PROMPT, "", context].join("\n"),
            config: {
              responseMimeType: "application/json",
              responseSchema: READY_RESPONSE_SCHEMA,
              temperature: 0.4,
            },
          }),
          GEMINI_TIMEOUT_MS,
          "Gemini ready synthesis",
        );
        const text = response.text;
        if (!text) throw new Error("Gemini returned an empty response.");
        return parseSynthesisModelResponse(extractJsonObject(text), input, budgetCents, "gemini", startedAt, model);
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [REFINE_SYSTEM_PROMPT, "", context, "", `Refinement round: ${round}`].join("\n"),
          config: {
            responseMimeType: "application/json",
            responseSchema: REFINE_RESPONSE_SCHEMA,
            temperature: 0.4,
          },
        }),
        GEMINI_TIMEOUT_MS,
        "Gemini refinement",
      );
      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response.");
      const raw = extractJsonObject(text);

      try {
        return parseSynthesisModelResponse(raw, input, budgetCents, "gemini", startedAt, model);
      } catch (e) {
        // If ambiguous needs_info in refine step, force ready.
        if (!(input.forceReady || round >= MAX_REFINEMENT_ROUNDS)) {
          const fallbackResponse = await withTimeout(
            ai.models.generateContent({
              model,
              contents: [READY_SYSTEM_PROMPT, "", context].join("\n"),
              config: {
                responseMimeType: "application/json",
                responseSchema: READY_RESPONSE_SCHEMA,
                temperature: 0.4,
              },
            }),
            GEMINI_TIMEOUT_MS,
            "Gemini ready fallback",
          );
          const readyText = fallbackResponse.text;
          if (!readyText) throw new Error("Gemini returned an empty response.");
          return parseSynthesisModelResponse(extractJsonObject(readyText), input, budgetCents, "gemini", startedAt, model);
        }
        throw e;
      }
    } catch (error) {
      lastError = error;
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[synthesis] attempt failed provider=gemini model=${model} in ${Date.now() - startedAt}ms: ${reason}`);
      // try next candidate
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Gemini synthesis failed"));
}

/**
 * Generate scope refinement: returns targeted questions (needs_info) or a
 * ready, normalized blueprint. Provider order: Nemotron -> Gemini (if configured)
 * -> deterministic fallback. Any provider error/timeout/invalid output falls
 * through so scoping never blocks.
 */
export async function synthesizeScope(input: SynthesisInput): Promise<SynthesisResult> {
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const budgetCents = input.budgetCents ?? DEFAULT_BUDGET_CENTS;

  if (nvidiaKey) {
    try {
      return await synthesizeScopeWithNemotron(input, nvidiaKey, budgetCents);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[synthesis] Nemotron provider failed: ${reason}`);
      // fall through to Gemini / deterministic fallback
    }
  } else {
    console.warn("[synthesis] NVIDIA_API_KEY is not set; skipping Nemotron provider.");
  }

  if (geminiKey) {
    try {
      return await synthesizeScopeWithGemini(input, geminiKey, budgetCents);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[synthesis] Gemini provider failed: ${reason}`);
      // fall through to deterministic fallback
    }
  } else {
    console.warn("[synthesis] GEMINI_API_KEY is not set; skipping Gemini provider.");
  }

  const reason = geminiKey || nvidiaKey
    ? "AI providers unavailable"
    : "No AI provider API key configured";
  return fallbackReady(input, budgetCents, reason);
}
