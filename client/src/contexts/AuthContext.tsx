import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { API_URL } from "@/lib/api";

export type FakeRole = "CLIENT" | "BUILDER";

export interface FakeUser {
  id: string;
  name: string;
  email: string;
  role: FakeRole;
}

interface AuthContextValue {
  user: FakeUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string, role: FakeRole) => Promise<FakeUser>;
  signUp: (name: string, email: string, password: string, role: FakeRole) => Promise<FakeUser>;
  signOut: () => Promise<void>;
}

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
}

function mapSessionUser(user: SessionUser): FakeUser {
  return {
    id: user.id ?? user.email ?? "unknown",
    name: user.name ?? "User",
    email: user.email ?? "",
    role: user.role === "BUILDER" ? "BUILDER" : "CLIENT",
  };
}

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_URL}/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch CSRF token");
  }
  const data = (await response.json()) as { csrfToken?: string };
  if (!data.csrfToken) {
    throw new Error("Missing CSRF token");
  }
  return data.csrfToken;
}

async function fetchSessionUser(): Promise<FakeUser | null> {
  const response = await fetch(`${API_URL}/auth/session`, {
    credentials: "include",
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { user?: SessionUser };
  return data.user ? mapSessionUser(data.user) : null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FakeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSessionUser()
      .then((sessionUser) => {
        if (!cancelled) setUser(sessionUser);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, _role: FakeRole) => {
    const csrfToken = await fetchCsrfToken();
    const body = new URLSearchParams({
      csrfToken,
      email,
      password,
      redirect: "false",
      callbackUrl: window.location.origin,
    });

    const response = await fetch(`${API_URL}/auth/callback/credentials`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error("Sign in failed");
    }

    const sessionUser = await fetchSessionUser();
    if (!sessionUser) {
      throw new Error("Sign in failed");
    }

    setUser(sessionUser);
    return sessionUser;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string, role: FakeRole) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Sign up failed");
    }

    return signIn(email, password, role);
  }, [signIn]);

  const signOut = useCallback(async () => {
    const csrfToken = await fetchCsrfToken();
    await fetch(`${API_URL}/auth/signout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        csrfToken,
        redirect: "false",
        callbackUrl: window.location.origin,
      }),
    });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
