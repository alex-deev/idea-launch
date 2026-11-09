import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { name, email, password, role } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };

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

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashPassword(password),
      role: normalizedRole,
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
