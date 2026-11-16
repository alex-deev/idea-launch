import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import {
  Banknote,
  Eye,
 
  FileText,
  Gauge,
  Handshake,
  MessageSquareCheck,
  Moon,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { BuilderOnboarding } from "@/components/BuilderOnboarding";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { SignInPage } from "@/pages/SignInPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { useAuth, type FakeUser } from "@/contexts/AuthContext";
import { useInView } from "@/hooks/useInView";
import { API_URL } from "@/lib/api";

interface UserState {
  id: string;
  role: "CLIENT" | "BUILDER";
  name: string;
  probationary: boolean;
  rulesAccepted: boolean;
}

function TitleManager() {
  const location = useLocation();

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Idea Launch",
      "/signin": "Sign In — Idea Launch",
      "/signup": "Sign Up — Idea Launch",
      "/workspace": "Workspace — Idea Launch",
    };
    document.title = titles[location.pathname] ?? "Idea Launch";
  }, [location.pathname]);

  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading session...</p>;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading session...</p>;
  }

  if (user) {
    return <Navigate to="/workspace" replace />;
  }

  return <>{children}</>;
}

function Header({
  user,
  signOut,
  builderProbationary = false,
  theme,
  onToggleTheme,
}: {
  user: FakeUser | null;
  signOut: () => void;
  builderProbationary?: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const location = useLocation();

  return (
    <header className="shrink-0 flex items-center justify-between border-b p-4">
      <Link to="/" className="text-lg font-semibold">
        Idea Launch
      </Link>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user ? (
          <>
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Sign up</Link>
            </Button>
          </>
        )}
        {user?.role === "BUILDER" && location.pathname === "/workspace" && builderProbationary ? (
          <Badge variant="secondary">$1,500 Budget Cap</Badge>
        ) : null}
      </div>
    </header>
  );
}

function LandingPage({ user }: { user: FakeUser | null }) {
  const steps = [
    {
      number: "01",
      title: "Scope",
      body: "Describe your idea in plain language. Get an AI-generated blueprint with features, milestones, and out-of-scope — refine until it’s right.",
      accent: "bg-[#e6f3fe] text-[#0075de] border-[#0075de]/20",
    },
    {
      number: "02",
      title: "Compare & agree",
      body: "Publish to builders, review offers side by side, negotiate terms, and accept a final plan that locks scope and budget.",
      accent: "bg-[#fff4d6] text-[#8a5a00] border-[#ffb110]/30",
    },
    {
      number: "03",
      title: "Fund & ship",
      body: "Fund escrow across 3 milestones (30/40/30). Builders submit demo bundles, you review, and release payment on approval.",
      accent: "bg-[#fde8e4] text-[#b42318] border-[#f64932]/25",
    },
  ];

  const clientPoints = [
    {
      icon: Sparkles,
      title: "AI-assisted scoping",
      body: "Describe your idea, budget, and timeline in plain language. Get a structured blueprint — summary, features, milestones, and what’s out of scope — then refine it before you publish.",
    },
    {
      icon: Scale,
      title: "Compare offers on equal terms",
      body: "Review proposals from multiple builders side by side. Each offer includes a total budget, milestone schedule, deliverable targets, and timeline so you can choose with confidence.",
    },
    {
      icon: Handshake,
      title: "Negotiate, then lock the plan",
      body: "Select one builder to discuss terms in a focused conversation. When the offer is final and you accept, the agreed scope, milestones, and budget become the shared source of truth.",
    },
    {
      icon: ShieldCheck,
      title: "Milestone-based escrow protection",
      body: "Fund a fixed total split across three milestones. Payment is released only when you approve each submitted demo bundle — you pay for approved progress, not promises.",
      featured: true,
      highlight: "30 / 40 / 30",
      highlightLabel: "Initial · Final · Deployment",
    },
    {
      icon: Eye,
      title: "Review-driven delivery",
      body: "Builders submit staged demos for review. Approve to move forward, or request changes with clear feedback — progress stays transparent from first demo to deployment.",
    },
  ];

  const builderPoints = [
    {
      icon: FileText,
      title: "Clear, standardized scope",
      body: "Start from a published blueprint with defined features, milestones, and deliverable expectations — less guesswork, fewer surprises, and a shared understanding from day one.",
    },
    {
      icon: Send,
      title: "One focused offer per project",
      body: "Submit a single, structured offer with your proposed total, milestone dates, and delivery targets. When selected, negotiate terms directly with the client and finalize when you’re aligned.",
    },
    {
      icon: MessageSquareCheck,
      title: "Staged demos, explicit feedback",
      body: "Deliver work as milestone demo bundles and get concrete review outcomes. If changes are requested, you know exactly what to address before the next approval.",
    },
    {
      icon: Banknote,
      title: "Get paid per approved milestone",
      body: "Escrow is tied to the agreed plan. As each milestone is approved, the corresponding portion is released — predictable payouts tied to delivered, accepted progress.",
      featured: true,
      highlight: "30 / 40 / 30",
      highlightLabel: "Released per approval",
    },
    {
      icon: Gauge,
      title: "Built for sustainable work",
      body: "Capacity and eligibility rules keep workloads manageable, while transparent terms and milestone structure help you focus on building instead of chasing clarity or payment.",
    },
  ];

  const clientFeatured = clientPoints.find((p) => p.featured)!;
  const clientRegular = clientPoints.filter((p) => !p.featured);
  const builderFeatured = builderPoints.find((p) => p.featured)!;
  const builderRegular = builderPoints.filter((p) => !p.featured);

  const howReveal = useInView<HTMLDivElement>({ threshold: 0.15 });
  const clientsReveal = useInView<HTMLDivElement>({ threshold: 0.15 });
  const buildersReveal = useInView<HTMLDivElement>({ threshold: 0.15 });
  const ctaReveal = useInView<HTMLDivElement>({ threshold: 0.2 });

  return (
    <div className="w-full max-w-5xl space-y-24 py-10 md:space-y-32 md:py-16">
      <section className="mx-auto max-w-3xl space-y-8 text-center">
        <div className="space-y-5">
          <h1
            className="hero-reveal text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl md:leading-[1.05] md:tracking-[-0.04em]"
            style={{ animationDelay: "0ms" }}
          >
            Scope, fund, and{" "}
            <span className="inline-block rounded-full bg-[#f6d5b8] px-3 py-0.5 text-black transition-transform duration-300 hover:scale-105 md:px-4">
              ship
            </span>{" "}
            software with confidence.
          </h1>
          <p
            className="hero-reveal mx-auto max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground md:text-xl"
            style={{ animationDelay: "120ms" }}
          >
            Turn an idea into a clear blueprint, compare builder offers, and pay only as each
            milestone is approved.
          </p>
        </div>

        <div
          className="hero-reveal flex flex-wrap items-center justify-center gap-3 pt-2"
          style={{ animationDelay: "240ms" }}
        >
          {user ? (
            <Button asChild size="lg" className="active:scale-[0.98]">
              <Link to="/workspace">Go to workspace</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="active:scale-[0.98]">
                <Link to="/signup">Get started</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="active:scale-[0.98]">
                <Link to="/signin">Sign in</Link>
              </Button>
            </>
          )}
        </div>
        <p
          className="hero-reveal text-xs tracking-wide text-muted-foreground"
          style={{ animationDelay: "360ms" }}
        >
          3 milestones · 30/40/30 escrow · demo-reviewed releases
        </p>
      </section>

      <section ref={howReveal.ref} className="space-y-10">
        <div className={`space-y-3 text-center reveal ${howReveal.inView ? "is-visible" : ""}`}>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            How it works
          </p>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            From idea to approved delivery
          </h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            A structured path from first description to final deployment — with clarity at every
            step.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`group rounded-xl border border-border bg-card p-6 text-left transition-colors duration-200 hover:border-foreground/20 hover:bg-muted/20 md:p-7 reveal ${howReveal.inView ? "is-visible" : ""}`}
              style={{ animationDelay: `${120 + i * 80}ms` }}
            >
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-transform duration-200 group-hover:scale-105 ${step.accent}`}
              >
                {step.number}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        ref={clientsReveal.ref}
        className="rounded-2xl bg-[#e6f3fe]/35 p-6 dark:bg-[#1e3a5f]/20 md:p-10"
      >
        <div className="space-y-10">
          <div
            className={`mx-auto max-w-3xl space-y-3 text-center reveal ${clientsReveal.inView ? "is-visible" : ""}`}
          >
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#0075de]">
              For clients
            </p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Turn uncertainty into a plan you can trust
            </h2>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Idea Launch helps non-technical and technical clients alike move from a rough idea to
              a funded, reviewable project — without guessing at scope or paying everything upfront.
            </p>
          </div>

          <div
            className={`group rounded-xl border border-[#0075de]/15 bg-[#e6f3fe]/70 p-6 transition-colors duration-200 hover:bg-[#e6f3fe] dark:border-[#62aef0]/20 dark:bg-[#1e3a5f]/35 dark:hover:bg-[#1e3a5f]/50 md:p-8 reveal ${clientsReveal.inView ? "is-visible" : ""}`}
            style={{ animationDelay: "80ms" }}
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-[#0075de] dark:text-[#62aef0]">
                  <clientFeatured.icon className="h-5 w-5" />
                  <h3 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                    {clientFeatured.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                  {clientFeatured.body}
                </p>
              </div>
              <div className="shrink-0 rounded-xl border border-[#0075de]/15 bg-card/70 px-5 py-4 text-center dark:border-[#62aef0]/20 dark:bg-card/40">
                <p className="text-2xl font-semibold tracking-tight text-[#0075de] dark:text-[#62aef0] md:text-3xl">
                  {clientFeatured.highlight}
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {clientFeatured.highlightLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {clientRegular.map((point, i) => (
              <div
                key={point.title}
                className={`group rounded-xl border border-border bg-card p-6 transition-colors duration-200 hover:border-foreground/20 hover:bg-muted/20 md:p-7 reveal ${clientsReveal.inView ? "is-visible" : ""}`}
                style={{ animationDelay: `${160 + i * 70}ms` }}
              >
                <div className="flex items-center gap-2 text-[#0075de] dark:text-[#62aef0]">
                  <point.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  <h3 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
                    {point.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        ref={buildersReveal.ref}
        className="rounded-2xl bg-[#fff4d6]/35 p-6 dark:bg-[#3a2f1e]/20 md:p-10"
      >
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-start">
          <div
            className={`space-y-3 md:sticky md:top-8 reveal ${buildersReveal.inView ? "is-visible" : ""}`}
          >
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#b18164]">
              For builders
            </p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Build with clarity, deliver with confidence
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Spend less time decoding vague requests and more time shipping. Idea Launch gives
              builders structured projects, explicit terms, and milestone-based releases.
            </p>
          </div>

          <div className="space-y-4">
            <div
              className={`group rounded-xl border border-[#ffb110]/20 bg-[#fff4d6]/70 p-6 transition-colors duration-200 hover:bg-[#fff4d6] dark:border-[#ffb110]/20 dark:bg-[#3a2f1e]/35 dark:hover:bg-[#3a2f1e]/50 md:p-7 reveal ${buildersReveal.inView ? "is-visible" : ""}`}
              style={{ animationDelay: "80ms" }}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 text-[#8a5a00] dark:text-[#ffb110]">
                    <builderFeatured.icon className="h-5 w-5" />
                    <h3 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                      {builderFeatured.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                    {builderFeatured.body}
                  </p>
                </div>
                <div className="shrink-0 rounded-xl border border-[#ffb110]/20 bg-card/70 px-5 py-4 text-center dark:bg-card/40">
                  <p className="text-2xl font-semibold tracking-tight text-[#8a5a00] dark:text-[#ffb110] md:text-3xl">
                    {builderFeatured.highlight}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {builderFeatured.highlightLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {builderRegular.map((point, i) => (
                <div
                  key={point.title}
                  className={`group rounded-xl border border-border bg-card p-6 transition-colors duration-200 hover:border-foreground/20 hover:bg-muted/20 md:p-7 reveal ${buildersReveal.inView ? "is-visible" : ""}`}
                  style={{ animationDelay: `${160 + i * 70}ms` }}
                >
                  <div className="flex items-center gap-2 text-[#8a5a00] dark:text-[#ffb110]">
                    <point.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                    <h3 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
                      {point.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        ref={ctaReveal.ref}
        className={`mx-auto max-w-2xl space-y-5 border-t border-border pt-16 text-center reveal ${ctaReveal.inView ? "is-visible" : ""}`}
      >
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Ready to turn an idea into a shipped project?
        </h2>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Start with a clear blueprint, find the right builder, and move forward one approved
          milestone at a time.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {user ? (
            <Button asChild size="lg" className="active:scale-[0.98]">
              <Link to="/workspace">Go to workspace</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="active:scale-[0.98]">
                <Link to="/signup">Get started</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="active:scale-[0.98]">
                <Link to="/signin">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function WorkspaceView({
  user,
  onboarded,
  onComplete,
}: {
  user: FakeUser;
  onboarded: boolean;
  onComplete: () => void;
}) {
  if (user.role === "CLIENT") {
    return <ClientView user={user} />;
  }
  return <BuilderView user={user} onboarded={onboarded} onComplete={onComplete} />;
}

function toUserState(user: FakeUser, builderOnboarded: boolean): UserState {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    probationary: user.role === "BUILDER" && !builderOnboarded,
    rulesAccepted: user.role === "CLIENT" || builderOnboarded,
  };
}

function ClientView({ user }: { user: FakeUser }) {
  const userState = toUserState(user, true);
  return (
    <ProjectWorkspace
      userId={userState.id}
      role={userState.role}
      name={userState.name}
      probationary={userState.probationary}
    />
  );
}

function BuilderView({
  user,
  onboarded,
  onComplete,
}: {
  user: FakeUser;
  onboarded: boolean;
  onComplete: () => void;
}) {
  const userState = toUserState(user, onboarded);

  if (!userState.rulesAccepted) {
    return <BuilderOnboarding userId={userState.id} onComplete={onComplete} />;
  }

  return (
    <ProjectWorkspace
      userId={userState.id}
      role={userState.role}
      name={userState.name}
      probationary={userState.probationary}
    />
  );
}

function App() {
  const { user, signOut } = useAuth();
  const [builderOnboarded, setBuilderOnboarded] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    setBuilderOnboarded(false);

    if (!user || user.role !== "BUILDER") {
      return;
    }

    let cancelled = false;
    fetch(`${API_URL}/api/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        const profile = data?.user;
        setBuilderOnboarded(Boolean(profile?.rulesAccepted && !profile?.probationary));
      })
      .catch(() => {
        if (!cancelled) setBuilderOnboarded(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <TitleManager />
      <div className="flex h-dvh flex-col bg-background">
        <Header user={user} signOut={signOut} builderProbationary={user?.role === "BUILDER" && !builderOnboarded} theme={theme} onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
        <main className="flex min-h-0 flex-1 justify-center overflow-hidden p-4">
          <div className="flex h-full w-full max-w-6xl flex-col">
            <Routes>
              <Route
                path="/"
                element={
                  <div className="h-full overflow-y-auto">
                    <div className="flex min-h-full items-start justify-center px-2 pb-8 md:px-4">
                      <LandingPage user={user} />
                    </div>
                  </div>
                }
              />
              <Route
                path="/signin"
                element={
                  <RedirectIfAuthenticated>
                    <div className="flex h-full items-center justify-center">
                      <SignInPage />
                    </div>
                  </RedirectIfAuthenticated>
                }
              />
              <Route
                path="/signup"
                element={
                  <RedirectIfAuthenticated>
                    <div className="flex h-full items-center justify-center">
                      <SignUpPage />
                    </div>
                  </RedirectIfAuthenticated>
                }
              />
              <Route
                path="/workspace"
                element={
                  <RequireAuth>
                    {user ? (
                      <div className="h-full">
                        <WorkspaceView
                          user={user}
                          onboarded={builderOnboarded}
                          onComplete={() => setBuilderOnboarded(true)}
                        />
                      </div>
                    ) : null}
                  </RequireAuth>
                }
              />
              <Route path="/client" element={<Navigate to="/workspace" replace />} />
              <Route path="/builder" element={<Navigate to="/workspace" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
