import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

export type FakeRole = "CLIENT" | "BUILDER";

export interface FakeUser {
  id: string;
  name: string;
  email: string;
  role: FakeRole;
}

interface AuthContextValue {
  user: FakeUser | null;
  signIn: (email: string, password: string, role: FakeRole) => Promise<FakeUser>;
  signUp: (name: string, email: string, password: string, role: FakeRole) => Promise<FakeUser>;
  signOut: () => void;
}

const STORAGE_KEY = "idea-launch:fake-user";

function readStoredUser(): FakeUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FakeUser) : null;
  } catch {
    return null;
  }
}

function storeUser(user: FakeUser | null) {
  if (user) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FakeUser | null>(() => readStoredUser());

  const signIn = useCallback(async (email: string, _password: string, role: FakeRole) => {
    // Fake auth: accept any non-empty credentials and create/refresh a demo user.
    if (!email.trim()) {
      throw new Error("Email is required");
    }

    const fakeUser: FakeUser = {
      id: role === "CLIENT" ? "client-user" : "builder-user",
      name: role === "CLIENT" ? "Client User" : "Builder User",
      email,
      role,
    };

    storeUser(fakeUser);
    setUser(fakeUser);
    return fakeUser;
  }, []);

  const signUp = useCallback(async (name: string, email: string, _password: string, role: FakeRole) => {
    if (!name.trim() || !email.trim()) {
      throw new Error("Name and email are required");
    }

    const fakeUser: FakeUser = {
      id: role === "CLIENT" ? "client-user" : "builder-user",
      name,
      email,
      role,
    };

    storeUser(fakeUser);
    setUser(fakeUser);
    return fakeUser;
  }, []);

  const signOut = useCallback(() => {
    storeUser(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signOut }}>
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
