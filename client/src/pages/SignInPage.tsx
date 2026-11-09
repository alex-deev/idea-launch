import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth, type FakeRole } from "@/contexts/AuthContext";

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
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
      const user = await signIn(email, password, role);
      navigate(user.role === "CLIENT" ? "/client" : "/builder", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No account? <Link to="/signup" className="text-primary underline">Create one</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
