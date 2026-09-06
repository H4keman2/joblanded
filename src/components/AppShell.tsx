import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Hint } from "@/components/ui/hint";

const nav = [
  {
    to: "/dashboard",
    label: "Dashboard",
    tip: "Your job search at a glance: resume status, saved jobs and follow-ups due.",
  },
  {
    to: "/jobs",
    label: "Jobs",
    tip: "Save postings, get resume-matched recommendations, and generate tailored versions.",
  },
  {
    to: "/posting-search",
    label: "Posting search",
    tip: "Paste several postings at once and see which roles each resume section matches best.",
  },
  {

    to: "/resume",
    label: "Resume",
    tip: "Upload or paste your resume and review the skills, titles and details we extracted.",
  },
  {
    to: "/applications",
    label: "Applications",
    tip: "Track status, notes and follow-up dates for every role you've applied to.",
  },
  {
    to: "/account",
    label: "Account",
    tip: "Update your contact details or sign out.",
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/dashboard" className="font-display text-lg font-semibold text-primary">
            JobLanded
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {nav.map(({ to, label, tip }) => (
              <Hint key={to} tip={tip}>
                <Link
                  to={to}
                  className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  {label}
                </Link>
              </Hint>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
