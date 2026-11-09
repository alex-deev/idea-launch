import "dotenv/config";

import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { ExpressAuth, getSession } from "@auth/express";
import Credentials from "@auth/core/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "./lib/prisma.js";
import { authRouter } from "./routes/auth.js";
import { verifyPassword } from "./lib/password.js";
import { paymentsRouter } from "./routes/payments.js";
import { projectsRouter } from "./routes/projects.js";
import { initializeSocket } from "./socket.js";

const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const isProduction = process.env.NODE_ENV === "production";

const authConfig = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  debug: process.env.AUTH_DEBUG === "true",
  trustHost: true,
  session: {
    // JWT sessions are stored in an HttpOnly cookie; no session rows are read
    // on the hot path. The Prisma adapter still owns users/accounts.
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: isProduction
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProduction,
      },
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password || !verifyPassword(password, user.password)) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};

const app = express();

// Required behind Supabase/proxies so Auth.js sets secure cookies correctly.
app.set("trust proxy", 1);

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/me", async (req, res) => {
  const session = await getSession(req, authConfig as any);
  if (!session?.user?.id) {
    res.status(401).json({ user: null });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      probationary: true,
      rulesAccepted: true,
      ecosystems: true,
      portfolioUrls: true,
    },
  });

  res.json({ user: dbUser ?? session.user });
});

app.use("/auth", ExpressAuth(authConfig as any));
app.use("/api/auth", authRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);

const httpServer = createServer(app);
initializeSocket(httpServer);

httpServer.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
