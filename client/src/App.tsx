import { useEffect, useState, type MouseEvent } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Banknote,
  Eye,
  FileText,
  Gauge,
  Handshake,
  MessageSquareCheck,
  Moon,
  Rocket,
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
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": t("titles.home"),
      "/signin": t("titles.signIn"),
      "/signup": t("titles.signUp"),
      "/workspace": t("titles.workspace"),
    };
    document.title = titles[location.pathname] ?? t("appName");
    document.documentElement.lang = i18n.resolvedLanguage?.startsWith("es") ? "es" : "en";
  }, [location.pathname, t, i18n.resolvedLanguage]);

  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("loadingSession")}</p>;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("loadingSession")}</p>;
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
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage?.startsWith("es") ? "es" : "en";
  const nextLang = currentLang === "es" ? "en" : "es";

  return (
    <header className="shrink-0 flex items-center justify-between border-b p-4">
      <Link to="/" className="flex items-center gap-2" aria-label={t("appName")}>
        <img
          src={theme === "dark" ? "/logo-horizontal-dark.svg" : "/logo-horizontal.svg"}
          alt={t("appName")}
          className="hidden h-7 w-auto sm:block"
        />
        <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-8 w-8 sm:hidden" />
      </Link>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void i18n.changeLanguage(nextLang)}
          aria-label={t("language")}
          title={t("language")}
          className="px-2 text-xs font-semibold"
        >
          {currentLang === "es" ? "EN" : "ES"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          aria-label={t("toggleTheme")}
          title={t("toggleTheme")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user ? (
          <>
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              {t("signOut")}
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/signin">{t("signIn")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">{t("signUp")}</Link>
            </Button>
          </>
        )}
        {user?.role === "BUILDER" && location.pathname === "/workspace" && builderProbationary ? (
          <Badge variant="secondary">{t("budgetCap")}</Badge>
        ) : null}
      </div>
    </header>
  );
}

function LandingPage({ user }: { user: FakeUser | null }) {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();
  const [launchingTo, setLaunchingTo] = useState<string | null>(null);

  const handleLaunch = (e: MouseEvent, to: string) => {
    e.preventDefault();
    if (launchingTo) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate(to);
      return;
    }
    setLaunchingTo(to);
    window.setTimeout(() => navigate(to), 380);
  };

  const steps = [
    {
      number: "01",
      title: t("steps.scope.title"),
      body: t("steps.scope.body"),
      accent: "bg-[#e6f3fe] text-[#0075de] border-[#0075de]/20",
    },
    {
      number: "02",
      title: t("steps.compare.title"),
      body: t("steps.compare.body"),
      accent: "bg-[#fff4d6] text-[#8a5a00] border-[#ffb110]/30",
    },
    {
      number: "03",
      title: t("steps.fund.title"),
      body: t("steps.fund.body"),
      accent: "bg-[#fde8e4] text-[#b42318] border-[#f64932]/25",
    },
  ];

  const clientPoints = [
    { icon: Sparkles, title: t("clients.ai.title"), body: t("clients.ai.body") },
    { icon: Scale, title: t("clients.compare.title"), body: t("clients.compare.body") },
    { icon: Handshake, title: t("clients.negotiate.title"), body: t("clients.negotiate.body") },
    {
      icon: ShieldCheck,
      title: t("clients.escrow.title"),
      body: t("clients.escrow.body"),
      featured: true,
      highlight: t("clients.escrow.highlight"),
      highlightLabel: t("clients.escrow.highlightLabel"),
    },
    { icon: Eye, title: t("clients.review.title"), body: t("clients.review.body") },
  ];

  const builderPoints = [
    { icon: FileText, title: t("builders.scope.title"), body: t("builders.scope.body") },
    { icon: Send, title: t("builders.offer.title"), body: t("builders.offer.body") },
    { icon: MessageSquareCheck, title: t("builders.feedback.title"), body: t("builders.feedback.body") },
    {
      icon: Banknote,
      title: t("builders.payout.title"),
      body: t("builders.payout.body"),
      featured: true,
      highlight: t("builders.payout.highlight"),
      highlightLabel: t("builders.payout.highlightLabel"),
    },
    { icon: Gauge, title: t("builders.sustainable.title"), body: t("builders.sustainable.body") },
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
        <div className="flex flex-col items-center space-y-5">
          <img
            src="/logo-mark.svg"
            alt=""
            aria-hidden="true"
            className="hero-reveal h-14 w-14 md:h-16 md:w-16"
            style={{ animationDelay: "0ms" }}
          />
          <h1
            className="hero-reveal text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl md:leading-[1.05] md:tracking-[-0.04em]"
            style={{ animationDelay: "80ms" }}
          >
            {t("heroTitle1")}
            <span className="inline-block rounded-full bg-[#f6d5b8] px-3 py-0.5 text-black transition-transform duration-300 hover:scale-105 md:px-4">
              {t("heroHighlight")}
            </span>
            {t("heroTitle2")}
          </h1>
          <p
            className="hero-reveal mx-auto max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground md:text-xl"
            style={{ animationDelay: "200ms" }}
          >
            {t("heroSubtitle")}
          </p>
        </div>

        <div
          className="hero-reveal flex flex-wrap items-center justify-center gap-3 pt-2"
          style={{ animationDelay: "320ms" }}
        >
          {user ? (
            <Button asChild size="lg" className="active:scale-[0.98]">
              <Link to="/workspace" onClick={(e) => handleLaunch(e, "/workspace")}>{t("common:goToWorkspace")}</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="active:scale-[0.98]">
                <Link to="/signup" onClick={(e) => handleLaunch(e, "/signup")}>{t("getStarted")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="active:scale-[0.98]">
                <Link to="/signin" onClick={(e) => handleLaunch(e, "/signin")}>{t("common:signIn")}</Link>
              </Button>
            </>
          )}
        </div>
        <p
          className="hero-reveal text-xs tracking-wide text-muted-foreground"
          style={{ animationDelay: "440ms" }}
        >
          {t("heroNote")}
        </p>
      </section>

      <section ref={howReveal.ref} className="space-y-10">
        <div className={`space-y-3 text-center reveal ${howReveal.inView ? "is-visible" : ""}`}>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t("howItWorks")}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("howTitle")}
          </h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {t("howSubtitle")}
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
              {t("forClients")}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {t("clientsTitle")}
            </h2>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("clientsSubtitle")}
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
              {t("forBuilders")}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {t("buildersTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("buildersSubtitle")}
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
        className={`mx-auto max-w-3xl rounded-2xl border border-[#0075de]/10 bg-[#e6f3fe]/35 p-8 text-center transition-colors duration-300 hover:bg-[#e6f3fe]/50 dark:border-[#62aef0]/15 dark:bg-[#1e3a5f]/20 dark:hover:bg-[#1e3a5f]/30 md:p-12 reveal ${ctaReveal.inView ? "is-visible" : ""}`}
      >
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0075de]/10 text-[#0075de] dark:bg-[#62aef0]/15 dark:text-[#62aef0] reveal ${ctaReveal.inView ? "is-visible" : ""}`}
          style={{ animationDelay: "0ms" }}
        >
          <Rocket className="h-5 w-5" />
        </div>
        <h2
          className={`text-2xl font-semibold tracking-tight md:text-3xl reveal ${ctaReveal.inView ? "is-visible" : ""}`}
          style={{ animationDelay: "80ms" }}
        >
          {t("ctaTitle")}
        </h2>
        <p
          className={`mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base reveal ${ctaReveal.inView ? "is-visible" : ""}`}
          style={{ animationDelay: "160ms" }}
        >
          {t("ctaSubtitle")}
        </p>
        <div
          className={`mt-6 flex flex-wrap items-center justify-center gap-3 reveal ${ctaReveal.inView ? "is-visible" : ""}`}
          style={{ animationDelay: "240ms" }}
        >
          {user ? (
            <Button asChild size="lg" className="group active:scale-[0.98]">
              <Link to="/workspace" onClick={(e) => handleLaunch(e, "/workspace")}>
                {t("common:goToWorkspace")}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="group active:scale-[0.98]">
                <Link to="/signup" onClick={(e) => handleLaunch(e, "/signup")}>
                  {t("getStarted")}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="active:scale-[0.98]">
                <Link to="/signin" onClick={(e) => handleLaunch(e, "/signin")}>{t("common:signIn")}</Link>
              </Button>
            </>
          )}
        </div>
        <p
          className={`mt-4 text-xs tracking-wide text-muted-foreground reveal ${ctaReveal.inView ? "is-visible" : ""}`}
          style={{ animationDelay: "320ms" }}
        >
          {t("ctaNote")}
        </p>
      </section>

      {launchingTo ? (
        <div className="app-launch-overlay fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="app-launch-mark flex h-16 w-16 items-center justify-center rounded-2xl border border-[#0075de]/20 bg-[#e6f3fe]/60 p-2 dark:border-[#62aef0]/20 dark:bg-[#1e3a5f]/30">
              <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-full w-full" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {launchingTo === "/workspace" ? t("openingWorkspace") : t("opening")}
            </p>
          </div>
        </div>
      ) : null}
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
