import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth, type FakeRole } from "@/contexts/AuthContext";

export function SignUpPage() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();

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
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value as FakeRole)}
            >
              <option value="CLIENT">Client</option>
              <option value="BUILDER">Builder</option>
            </select>
          </div>

          {role === "CLIENT" ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Payment method (mock — no real charge)</p>
              <p className="text-xs text-muted-foreground">
                Required to fund escrow later. Card details are tokenized; only a mock token and
                last 4 digits are stored. Never enter a real card.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Card number</label>
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
                  <label className="text-sm font-medium">Month</label>
                  <Input
                    value={expMonth}
                    onChange={(event) => setExpMonth(event.target.value)}
                    placeholder="MM"
                    inputMode="numeric"
                    autoComplete="cc-exp-month"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Year</label>
                  <Input
                    value={expYear}
                    onChange={(event) => setExpYear(event.target.value)}
                    placeholder="YYYY"
                    inputMode="numeric"
                    autoComplete="cc-exp-year"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CVC</label>
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
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/signin" className="text-primary underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}