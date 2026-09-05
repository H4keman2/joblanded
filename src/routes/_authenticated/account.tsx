import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteAccount, exportAccountData, getProfile, saveProfile } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/ui/hint";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account — JobLanded" },
      {
        name: "description",
        content:
          "Update your name and phone number, change your email or password, download your data, or delete your account.",
      },
      { property: "og:title", content: "Account — JobLanded" },
      { property: "og:description", content: "Manage your JobLanded profile and account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

function todayFileStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function AccountPage() {
  const fetchProfile = useServerFn(getProfile);
  const persistProfile = useServerFn(saveProfile);
  const runExport = useServerFn(exportAccountData);
  const runDeleteAccount = useServerFn(deleteAccount);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  });

  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
      });
    }
  }, [profile]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await persistProfile({ data: { full_name: form.full_name, phone: form.phone } });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  // --- Email ---
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const emailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    },
    onSuccess: (_r, email) => {
      toast.success(`Confirmation link sent to ${email}. Click it to finish changing your email.`);
      setChangingEmail(false);
      setNewEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Password ---
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordMutation = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated");
      setChangingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    passwordMutation.mutate(newPassword);
  }

  // --- Sessions ---
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut({ scope: "local" });
    navigate({ to: "/auth", replace: true });
  }

  const signOutEverywhereMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      navigate({ to: "/auth", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Export ---
  const exportMutation = useMutation({
    mutationFn: () => runExport(),
    onSuccess: (payload) => {
      downloadJson(payload, `joblanded-export-${todayFileStamp()}.json`);
      toast.success("Your data was downloaded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Delete account ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const deleteMutation = useMutation({
    mutationFn: () => runDeleteAccount(),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut({ scope: "local" });
      toast.success("Your account and data have been deleted.");
      navigate({ to: "/", replace: true });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setDeleteDialogOpen(false);
    },
  });

  const canConfirmDelete =
    !!authUser?.email && deleteConfirmText.trim().toLowerCase() === authUser.email.toLowerCase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, login and data.</p>
      </div>

      <section className="panel max-w-xl space-y-1 p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Your name and phone are used when tailoring resumes and cover letters.
        </p>
        <form onSubmit={onSave} className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder={isLoading ? "Loading…" : "Jane Doe"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+1 555 000 1234"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </section>

      <section className="panel max-w-xl space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">Login &amp; security</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your email is what you sign in with — changing it requires confirming the new address.
          </p>
        </div>

        <div className="space-y-2 border-t border-border pt-5">
          <Label>Email address</Label>
          <p className="text-sm text-foreground">{authUser?.email ?? "Loading…"}</p>
          {changingEmail ? (
            <div className="mt-2 space-y-3">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@email.com"
                autoComplete="email"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={emailMutation.isPending || !newEmail.trim()}
                  onClick={() => emailMutation.mutate(newEmail.trim())}
                >
                  {emailMutation.isPending ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : null}
                  Send confirmation
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setChangingEmail(false);
                    setNewEmail("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={() => setChangingEmail(true)}
            >
              Change email
            </Button>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-5">
          <Label>Password</Label>
          {changingPassword ? (
            <form onSubmit={onSubmitPassword} className="mt-2 space-y-3">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : null}
                  Update password
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setChangingPassword(false);
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">••••••••</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setChangingPassword(true)}
              >
                Change password
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="panel max-w-xl space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Sessions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign out of this browser, or everywhere you're currently signed in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
          <Hint tip="Ends every active session for your account, on every device.">
            <Button
              variant="outline"
              onClick={() => signOutEverywhereMutation.mutate()}
              disabled={signOutEverywhereMutation.isPending}
            >
              {signOutEverywhereMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : null}
              Sign out everywhere
            </Button>
          </Hint>
        </div>
      </section>

      <section className="panel max-w-xl space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Your data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download a copy of everything JobLanded has for your account: your profile, resumes,
            saved jobs, matches, tailored documents and applications.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
        >
          {exportMutation.isPending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 size-4" />
          )}
          Download your data
        </Button>
      </section>

      <section
        className="panel max-w-xl space-y-4 p-6"
        style={{ borderColor: "var(--destructive)" }}
      >
        <div>
          <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently deletes your account and every resume, job, match, tailored document and
            application tied to it. This can't be undone.
          </p>
        </div>
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteConfirmText("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your profile, resumes, saved jobs, matches, tailored
                documents and applications, and signs you out everywhere. This can't be undone. Type{" "}
                <span className="font-medium text-foreground">{authUser?.email}</span> to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={authUser?.email ?? ""}
              autoComplete="off"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={!canConfirmDelete || deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  if (!canConfirmDelete) return;
                  deleteMutation.mutate();
                }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : null}
                Delete my account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
