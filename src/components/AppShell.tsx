import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Hint } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const nav = [
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/applications" className="font-display text-lg font-semibold text-primary">
            JobLanded
          </Link>

          {/* Full nav — hidden below md, where it would otherwise become a
              horizontally-scrolling strip rather than a real menu. */}
          <nav className="hidden flex-1 items-center gap-1 overflow-x-auto md:flex">
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

          {/* Mobile nav — a slide-out drawer instead of a scrolling tab strip. */}
          <div className="ml-auto md:hidden">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="font-display text-primary">JobLanded</SheetTitle>
                </SheetHeader>
                <nav className="mt-4 flex flex-col gap-1">
                  {nav.map(({ to, label }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      activeProps={{ className: "bg-secondary text-foreground" }}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
