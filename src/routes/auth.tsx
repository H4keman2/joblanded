import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, passwordIssue } from "@/lib/password";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in to JobLanded — Job Search Workspace" },
      {
        name: "description",
        content:
          "Sign in to JobLanded to parse your resume, score job matches and track every application in one place.",
      },
      { property: "og:title", content: "Sign in to JobLanded" },
      {
        property: "og:description",
        content: "Access your resume profile, job matches and application tracker.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/applications", replace: true });
    });
  }, [navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setResetSent(false);
  }

  async function onForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send that reset link.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const issue = passwordIssue(password);
        if (issue) {
          toast.error(issue);
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/applications` },
        });
        if (error) throw error;
        toast.success("Account created. Let's set up your resume.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/applications", replace: true });
      else toast.message("Check your inbox to confirm your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
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

        {mode === "forgot" ? (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll email you a link to choose a new password.
            </p>

            {resetSent ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-foreground">
                  Check <span className="font-medium">{email}</span> for a reset link — it'll bring
                  you back here to set a new password.
                </p>
                <Button type="button" variant="outline" className="w-full" onClick={() => switchMode("signin")}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={onForgotPassword} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => switchMode("signin")}
                >
                  Back to sign in
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-semibold">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your resume, matches and applications in one workspace.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => switchMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                {mode === "signup" && (
                  <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
            </form>

            <button
              type="button"
              className="mt-6 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "No account yet? Sign up" : "Already have an account? Sign in"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
