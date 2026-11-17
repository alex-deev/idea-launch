import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, type FakeRole } from "@/contexts/AuthContext";

export function SignUpPage() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation(["auth", "common"]);

  useEffect(() => {
    if (user) {
      navigate("/workspace", { replace: true });
    }
  }, [user, navigate]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<FakeRole>("CLIENT");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock payment method (client only; PCI-safe: only tokenized display stored server-side)
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvc, setCvc] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      let paymentMethod:
        | { cardNumber: string; expMonth: number; expYear: number; cvc: string }
        | undefined;
      if (role === "CLIENT") {
        paymentMethod = {
          cardNumber: cardNumber.replace(/\s+/g, ""),
          expMonth: Number(expMonth),
          expYear: Number(expYear),
          cvc: cvc.trim(),
        };
      }
      await signUp(name, email, password, role, paymentMethod);
      navigate("/workspace", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth:signUpFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <img src="/logo-mark.svg" alt="" aria-hidden="true" className="mb-1 h-10 w-10" />
        <CardTitle>{t("auth:createAccountTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("auth:name")}</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
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
            <Select value={role} onValueChange={(value) => setRole(value as FakeRole)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("auth:workspace")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLIENT">{t("auth:client")}</SelectItem>
                <SelectItem value="BUILDER">{t("auth:builder")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "CLIENT" ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">{t("auth:paymentMethodTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("auth:paymentMethodHelp")}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("auth:cardNumber")}</label>
                <Input
                  value={cardNumber}
                  onChange={(event) => setCardNumber(event.target.value)}
                  placeholder="4242 4242 4242 4242"
                  inputMode="numeric"
                  autoComplete="cc-number"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("auth:month")}</label>
                  <Input
                    value={expMonth}
                    onChange={(event) => setExpMonth(event.target.value)}
                    placeholder="MM"
                    inputMode="numeric"
                    autoComplete="cc-exp-month"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("auth:year")}</label>
                  <Input
                    value={expYear}
                    onChange={(event) => setExpYear(event.target.value)}
                    placeholder="YYYY"
                    inputMode="numeric"
                    autoComplete="cc-exp-year"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("auth:cvc")}</label>
                  <Input
                    value={cvc}
                    onChange={(event) => setCvc(event.target.value)}
                    placeholder="123"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t("common:creatingAccount") : t("common:createAccount")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth:haveAccount")} <Link to="/signin" className="text-primary underline">{t("common:signIn")}</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}