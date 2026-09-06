import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, passwordIssue } from "@/lib/password";

export const Route = createFileRoute("/auth/reset")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Reset your password — JobLanded" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  // The reset-link email points here with a recovery token in the URL;
  // supabase-js picks that up and fires PASSWORD_RECOVERY once the session
  // is ready. Until then, the form stays disabled rather than pretending a
  // direct visit to this page (with no token) can update anything.
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const issue = passwordIssue(password);
    if (issue) {
      toast.error(issue);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md panel p-8">
        <Link to="/" className="font-display text-xl font-semibold text-primary">
          JobLanded
        </Link>
        <h1 className="mt-6 text-2xl font-semibold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready
            ? "Enter and confirm your new password below."
            : "Open this page from the reset link in your email to continue."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={!ready}
            />
            <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={!ready}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !ready}>
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
