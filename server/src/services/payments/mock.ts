import { randomUUID } from "node:crypto";

import type {
  CreatePaymentIntentInput,
  CreateTransferInput,
  PaymentIntent,
  PaymentProvider,
  Transfer,
} from "./types.js";

function mockId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

/**
 * In-memory Stripe stand-in for local development and tests.
 *
 * PaymentIntents are auto-confirmed (status "succeeded") and transfers are
 * immediately "paid", which mirrors the happy path of a funded escrow account.
 * Set MOCK_PAYMENT_FAILURE_RATE to exercise failure handling.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  private readonly intents = new Map<string, PaymentIntent>();
  private readonly transfers = new Map<string, Transfer>();
  private readonly failureRate: number;

  constructor(options: { failureRate?: number } = {}) {
    this.failureRate = Math.min(
      1,
      Math.max(0, options.failureRate ?? 0),
    );
  }

  private maybeFail(): void {
    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      throw new Error("Simulated mock payment failure");
    }
  }

  async createEscrowPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntent> {
    this.maybeFail();

    const intent: PaymentIntent = {
      id: mockId("pi_mock"),
      provider: this.name,
      status: "succeeded",
      amount: input.amountCents,
      currency: (input.currency ?? "usd").toLowerCase(),
      clientSecret: mockId("pi_mock_secret"),
      metadata: {
        projectId: input.projectId,
        ...(input.metadata ?? {}),
      },
      createdAt: new Date().toISOString(),
    };

    this.intents.set(intent.id, intent);
    return intent;
  }

  async createMilestoneTransfer(
    input: CreateTransferInput,
  ): Promise<Transfer> {
    this.maybeFail();

    const transfer: Transfer = {
      id: mockId("tr_mock"),
      provider: this.name,
      status: "paid",
      amount: input.amountCents,
      currency: (input.currency ?? "usd").toLowerCase(),
      destination:
        input.destinationAccountId ??
        process.env.STRIPE_CONNECTED_ACCOUNT_ID ??
        "acct_mock_builder",
      metadata: {
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        ...(input.metadata ?? {}),
      },
      createdAt: new Date().toISOString(),
    };

    this.transfers.set(transfer.id, transfer);
    return transfer;
  }

  /** Test/debug helper: all mock objects created by this process. */
  list(): { intents: PaymentIntent[]; transfers: Transfer[] } {
    return {
      intents: [...this.intents.values()],
      transfers: [...this.transfers.values()],
    };
  }
}
