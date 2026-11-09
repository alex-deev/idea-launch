import { MockPaymentProvider } from "./mock.js";
import { StripePaymentProvider } from "./stripe.js";
import type { PaymentProvider, PaymentProviderName } from "./types.js";

let cachedProvider: PaymentProvider | undefined;

export function isMockPaymentsEnabled(): boolean {
  const value = process.env.USE_MOCK_PAYMENTS ?? "true";
  return value.toLowerCase() !== "false";
}

export function getPaymentProviderInfo(): {
  provider: PaymentProviderName;
  mockEnabled: boolean;
  stripeConfigured: boolean;
} {
  const mockEnabled = isMockPaymentsEnabled();
  return {
    provider: mockEnabled ? "mock" : "stripe",
    mockEnabled,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  };
}

export function getPaymentProvider(): PaymentProvider {
  if (cachedProvider) return cachedProvider;

  if (isMockPaymentsEnabled()) {
    const failureRate = Number(process.env.MOCK_PAYMENT_FAILURE_RATE ?? 0);
    cachedProvider = new MockPaymentProvider({
      failureRate: Number.isFinite(failureRate) ? failureRate : 0,
    });
    console.info("[payments] using mock payment provider");
    return cachedProvider;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "USE_MOCK_PAYMENTS=false but STRIPE_SECRET_KEY is not configured.",
    );
  }

  cachedProvider = new StripePaymentProvider(
    secretKey,
    process.env.STRIPE_CONNECTED_ACCOUNT_ID,
  );
  console.info("[payments] using Stripe payment provider");
  return cachedProvider;
}

/** Test helper: clears the provider singleton after env changes. */
export function resetPaymentProvider(): void {
  cachedProvider = undefined;
}

export type {
  CreatePaymentIntentInput,
  CreateTransferInput,
  PaymentIntent,
  PaymentProvider,
  Transfer,
} from "./types.js";
