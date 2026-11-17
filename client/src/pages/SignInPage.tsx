import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth, type FakeRole } from "@/contexts/AuthContext";

export function SignInPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation(["auth", "common"]);

  useEffect(() => {
    if (user) {
      navigate("/workspace", { replace: true });
    }
  }, [user, navigate]);
  const [email, setEmail] = useState("client@example.com");
  const [password, setPassword] = useState("password");
  const [role, setRole] = useState<FakeRole>("CLIENT");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password, role);
      navigate("/workspace", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth:signInFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <img src="/logo-mark.svg" alt="" aria-hidden="true" className="mb-1 h-10 w-10" />
        <CardTitle>{t("auth:signInTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("auth:email")}</label>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("auth:password")}</label>
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("auth:workspace")}</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value as FakeRole)}
            >
              <option value="CLIENT">{t("auth:client")}</option>
              <option value="BUILDER">{t("auth:builder")}</option>
            </select>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t("common:signingIn") : t("common:signIn")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth:noAccount")} <Link to="/signup" className="text-primary underline">{t("auth:createOne")}</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
