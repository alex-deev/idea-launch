import { randomUUID } from "node:crypto";

import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

export const authRouter = Router();

function luhnOk(num: string): boolean {
  const digits = num.replace(/\\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let parity = digits.length % 2;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[i]);
    if (i % 2 === parity) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function brandFromNumber(num: string): string {
  const n = num.replace(/\\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6(?:011|5)/.test(n)) return "Discover";
  return "Card";
}

authRouter.post("/register", async (req, res) => {
  const body = (req.body ?? {}) as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    paymentMethod?: {
      cardNumber?: string;
      expMonth?: number | string;
      expYear?: number | string;
      cvc?: string;
    };
  };

  const { name, email, password, role } = body;
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedRole = role === "BUILDER" ? "BUILDER" : "CLIENT";

  if (!name?.trim() || !normalizedEmail || !password || password.length < 6) {
    res.status(400).json({
      error: "name, email, and a password of at least 6 characters are required",
    });
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  // Client accounts require a (mock) payment method on file.
  let pmData:
    | {
        provider: string;
        providerRef: string;
        brand: string;
        last4: string;
        expMonth: number;
        expYear: number;
      }
    | null = null;

  if (normalizedRole === "CLIENT") {
    const pm = body.paymentMethod;
    const cardNumber = String(pm?.cardNumber ?? "").replace(/\\s+/g, "");
    const expMonth = Number(pm?.expMonth);
    const expYear = Number(pm?.expYear);
    const cvc = String(pm?.cvc ?? "").trim();

    if (!cardNumber || !luhnOk(cardNumber)) {
      res.status(400).json({ error: "A valid card number is required" });
      return;
    }
    if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12) {
      res.status(400).json({ error: "A valid expiry month is required" });
      return;
    }
    const now = new Date();
    const fullYear = expYear < 100 ? 2000 + expYear : expYear;
    if (!Number.isInteger(fullYear) || fullYear < now.getFullYear()) {
      res.status(400).json({ error: "A valid expiry year is required" });
      return;
    }
    if (fullYear === now.getFullYear() && expMonth < now.getMonth() + 1) {
      res.status(400).json({ error: "Card is expired" });
      return;
    }
    if (!/^\d{3,4}$/.test(cvc)) {
      res.status(400).json({ error: "A valid CVC is required" });
      return;
    }

    pmData = {
      provider: "mock",
      providerRef: `pm_mock_${randomUUID().replace(/-/g, "")}`,
      brand: brandFromNumber(cardNumber),
      last4: cardNumber.slice(-4),
      expMonth,
      expYear: fullYear,
    };
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashPassword(password),
      role: normalizedRole,
      ...(pmData
        ? {
            paymentMethods: {
              create: {
                provider: pmData.provider,
                providerRef: pmData.providerRef,
                brand: pmData.brand,
                last4: pmData.last4,
                expMonth: pmData.expMonth,
                expYear: pmData.expYear,
                isDefault: true,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  res.status(201).json({ user });
});
