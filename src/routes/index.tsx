import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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

const steps = [
  {
    title: "1. Parse your resume",
    body: "Upload a PDF or paste plain text. JobLanded extracts skills, titles, experience, and education into a structured profile.",
  },
  {
    title: "2. Score every job",
    body: "Paste in job descriptions and get a match percentage plus a plain-language breakdown of why it's a fit—or not.",
  },
  {
    title: "3. Tailor your story",
    body: "Generate a tailored resume and cover letter for each role, then edit the output before you send it.",
  },
  {
    title: "4. Follow up on time",
    body: "Track statuses, set follow-up reminders, and keep every application moving from saved to offer.",
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

      <WorkedExample />
    </div>
  );
}

const exampleSteps = [
  {
    key: "parse",
    label: "Parse",
    step: "Step 1",
    caption: "Maya uploads a 2-page PDF resume. JobLanded returns a structured profile she can edit.",
    render: () => (
      <>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="Name" value="Maya Ortiz" />
          <Row label="Years of experience" value="7" />
          <Row label="Titles" value="Product Designer, UX Designer" />
          <Row label="Education" value="BFA Design, RISD (2017)" />
        </dl>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Skills extracted
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              "Design systems",
              "Figma",
              "Prototyping",
              "User research",
              "Accessibility",
              "Design ops",
              "Cross-functional leadership",
            ].map((s) => (
              <span
                key={s}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </>
    ),
  },
  {
    key: "match",
    label: "Match",
    step: "Step 2",
    caption: "She pastes the Northwind Labs job description. It's scored against her parsed profile.",
    render: () => (
      <>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">Senior Product Designer</p>
            <p className="text-xs text-muted-foreground">Northwind Labs · Remote · $150–175k</p>
          </div>
          <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
            92% match
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Strengths
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>7 yrs vs. 5+ required</li>
              <li>Owned a design system end-to-end</li>
              <li>Led cross-functional launches</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gaps</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>No B2B analytics tooling (preferred)</li>
              <li>Light on quantitative research</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },
  {
    key: "tailor",
    label: "Tailor",
    step: "Step 3",
    caption:
      "A resume summary and cover letter opener are drafted for this role. Maya edits before sending.",
    render: () => (
      <>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rewritten resume summary
        </p>
        <blockquote className="mt-2 border-l-2 border-primary pl-4 text-sm text-muted-foreground">
          Product designer with 7 years shipping systems-driven B2B software. Built and maintained a
          60-component design system adopted by four product teams, cutting handoff time by 40%.
        </blockquote>
        <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cover letter opener
        </p>
        <blockquote className="mt-2 border-l-2 border-primary pl-4 text-sm text-muted-foreground">
          Northwind&apos;s move toward a unified analytics surface is exactly the problem I spent the
          last two years on — consolidating five inconsistent dashboards into one system that a small
          team could actually maintain.
        </blockquote>
      </>
    ),
  },
  {
    key: "followup",
    label: "Follow up",
    step: "Step 4",
    caption: "She marks it applied and sets a date. It surfaces on her dashboard the day it's due.",
    render: () => (
      <>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            Applied
          </span>
          <span className="text-muted-foreground">Applied Mar 4 · Follow up Mar 11</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          On Mar 11 the application moves to the top of her dashboard. If she hears back, she flips
          the status to Interviewing and sets the next date.
        </p>
      </>
    ),
  },
];

function WorkedExample() {
  const [active, setActive] = useState(0);
  const current = exampleSteps[active]!;

  return (
    <section className="border-t border-border bg-secondary/30">
      <div className="mx-auto max-w-5xl px-4 py-20">
        <h2 className="text-center text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          A worked example
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
          Meet Maya, a product designer applying to Northwind Labs. Click through each step to see
          exactly what JobLanded produces.
        </p>

        <div
          role="tablist"
          aria-label="Worked example steps"
          className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-2"
        >
          {exampleSteps.map((s, i) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                i === active
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <ExampleStep key={current.key} step={current.step} title={current.label} caption={current.caption}>
            {current.render()}
          </ExampleStep>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => setActive((i) => Math.max(0, i - 1))}
            disabled={active === 0}
          >
            Back
          </Button>
          <span className="text-xs text-muted-foreground">
            {active + 1} of {exampleSteps.length}
          </span>
          <Button
            variant="outline"
            onClick={() => setActive((i) => Math.min(exampleSteps.length - 1, i + 1))}
            disabled={active === exampleSteps.length - 1}
          >
            Next
          </Button>
        </div>

        <div className="mt-10 flex justify-center">
          <Button asChild size="lg">
            <Link to="/auth">Try it with your resume</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function ExampleStep({
  step,
  title,
  caption,
  children,
}: {
  step: string;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel animate-in fade-in p-6 duration-300">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
          {step}
        </span>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{caption}</p>
      <div className="mt-5 border-t border-border pt-5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
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
