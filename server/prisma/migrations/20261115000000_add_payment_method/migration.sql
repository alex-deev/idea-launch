-- Add PCI-safe mock payment method storage + link payments to the method used.
CREATE TABLE "PaymentMethod" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "providerRef" TEXT NOT NULL,
  "brand" TEXT,
  "last4" TEXT,
  "expMonth" INTEGER,
  "expYear" INTEGER,
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentMethod_providerRef_key" ON "PaymentMethod"("providerRef");
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

ALTER TABLE "PaymentMethod"
  ADD CONSTRAINT "PaymentMethod_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD COLUMN "paymentMethodId" TEXT;

CREATE INDEX "Payment_paymentMethodId_idx" ON "Payment"("paymentMethodId");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
