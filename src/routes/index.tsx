import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JobLanded — Resume Parsing, Job Matching & Application Tracking" },
      {
        name: "description",
        content:
          "JobLanded turns your resume into a structured profile, scores every job you save, tailors resumes and cover letters, and tracks follow-ups.",
      },
      { property: "og:title", content: "JobLanded — Run your job search in one place" },
      {
        property: "og:description",
        content:
          "Parse your resume, score job matches, tailor documents and never miss a follow-up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const outcomes = [
  {
    title: "Stop guessing which jobs are worth your time",
    body: "Every posting gets scored against your actual experience, so you apply to the roles you're likely to land, not just the ones that sound good.",
  },
  {
    title: "Never rewrite a resume from scratch again",
    body: "Your resume is parsed once into structured data. Each application draws from it to build a tailored version, no starting over at 11pm before a deadline.",
  },
  {
    title: "Know where every application stands",
    body: "Saved, applied, interviewing, offer, it's all in one list instead of scattered across email threads and a half-updated spreadsheet.",
  },
  {
    title: "Follow up before it's too late",
    body: "Set a follow-up date when you apply, or let JobLanded suggest one. It shows up on your dashboard the day it's due.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="font-display text-lg font-semibold text-primary">JobLanded</span>
        <Link
          to="/auth"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-14 pt-12 text-center sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Job search workspace
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          From Start to JobLanded,
          <br />
          <span className="text-primary">without the spreadsheet.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
          Stop bouncing between tabs. Find the right roles, tailor your story, and follow up on time.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link to="/auth">Get started free</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="text-center text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          How JobLanded works
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ title, body }) => (
            <div key={title} className="panel p-5">
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-10 px-4 pb-24 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {outcomes.map(({ title, body }) => (
            <div key={title}>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <MatchPreviewCard />
      </section>
    </div>
  );
}

function MatchPreviewCard() {
  return (
    <div className="panel w-full max-w-sm shrink-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Senior Product Designer</p>
          <p className="text-xs text-muted-foreground">Northwind Labs · Remote</p>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
          92% match
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Strong overlap on design systems and cross-functional leadership. Light on the B2B
        analytics experience listed as preferred.
      </p>
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
          Applied
        </span>
        <span className="text-xs text-muted-foreground">Follow up in 4 days</span>
      </div>
    </div>
  );
}
