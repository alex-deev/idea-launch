export type PaymentProviderName = "mock" | "stripe";

export type PaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "processing"
  | "succeeded"
  | "canceled";

export type TransferStatus = "pending" | "paid" | "failed";

export interface PaymentIntent {
  id: string;
  provider: PaymentProviderName;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  clientSecret: string | null;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface Transfer {
  id: string;
  provider: PaymentProviderName;
  status: TransferStatus;
  amount: number;
  currency: string;
  destination: string | null;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface CreatePaymentIntentInput {
  projectId: string;
  amountCents: number;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface CreateTransferInput {
  projectId: string;
  milestoneId: string;
  amountCents: number;
  currency?: string;
  destinationAccountId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createEscrowPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  createMilestoneTransfer(input: CreateTransferInput): Promise<Transfer>;
}
