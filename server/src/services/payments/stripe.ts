import { randomUUID } from "node:crypto";

import type {
  CreatePaymentIntentInput,
  CreateTransferInput,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentProvider,
  Transfer,
} from "./types.js";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

interface StripePaymentIntent {
  id: string;
  status: string;
  amount: number;
  currency: string;
  client_secret: string | null;
  metadata: Record<string, string>;
  created: number;
}

interface StripeTransfer {
  id: string;
  amount: number;
  currency: string;
  destination: string;
  metadata: Record<string, string>;
  created: number;
}

function toIntentStatus(status: string): PaymentIntentStatus {
  switch (status) {
    case "succeeded":
    case "processing":
    case "requires_payment_method":
    case "requires_confirmation":
    case "canceled":
      return status;
    default:
      // requires_action / requires_capture are treated as pending confirmation.
      return "requires_confirmation";
  }
}

/**
 * Minimal Stripe REST client (no SDK dependency). Used only when
 * USE_MOCK_PAYMENTS=false. Escrow PaymentIntents are created unconfirmed and
 * return a client_secret for Stripe.js; transfers require a connected account.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;

  constructor(
    private readonly secretKey: string,
    private readonly defaultDestinationAccountId?: string,
  ) {
    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is required when USE_MOCK_PAYMENTS is disabled.",
      );
    }
  }

  private async request<T>(
    path: string,
    params: URLSearchParams,
  ): Promise<T> {
    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": randomUUID(),
      },
      body: params,
    });

    const body = (await response.json()) as {
      error?: { message?: string };
    } & T;

    if (!response.ok) {
      throw new Error(
        body.error?.message ?? `Stripe request failed (${response.status})`,
      );
    }

    return body;
  }

  async createEscrowPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntent> {
    const params = new URLSearchParams({
      amount: String(input.amountCents),
      currency: (input.currency ?? "usd").toLowerCase(),
      "automatic_payment_methods[enabled]": "true",
      "metadata[projectId]": input.projectId,
    });

    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      params.set(`metadata[${key}]`, value);
    }

    const intent = await this.request<StripePaymentIntent>(
      "/payment_intents",
      params,
    );

    return {
      id: intent.id,
      provider: this.name,
      status: toIntentStatus(intent.status),
      amount: intent.amount,
      currency: intent.currency,
      clientSecret: intent.client_secret,
      metadata: intent.metadata ?? {},
      createdAt: new Date(intent.created * 1000).toISOString(),
    };
  }

  async createMilestoneTransfer(
    input: CreateTransferInput,
  ): Promise<Transfer> {
    const destination =
      input.destinationAccountId ?? this.defaultDestinationAccountId;

    if (!destination) {
      throw new Error(
        "A Stripe connected account is required for milestone transfers. " +
          "Set STRIPE_CONNECTED_ACCOUNT_ID or pass destinationAccountId.",
      );
    }

    const params = new URLSearchParams({
      amount: String(input.amountCents),
      currency: (input.currency ?? "usd").toLowerCase(),
      destination,
      "metadata[projectId]": input.projectId,
      "metadata[milestoneId]": input.milestoneId,
    });

    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      params.set(`metadata[${key}]`, value);
    }

    const transfer = await this.request<StripeTransfer>("/transfers", params);

    return {
      id: transfer.id,
      provider: this.name,
      status: "paid",
      amount: transfer.amount,
      currency: transfer.currency,
      destination: transfer.destination,
      metadata: transfer.metadata ?? {},
      createdAt: new Date(transfer.created * 1000).toISOString(),
    };
  }
}
