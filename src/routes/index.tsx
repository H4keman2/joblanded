import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Hint({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="cursor-help rounded underline decoration-dotted decoration-from-font underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">{tip}</TooltipContent>
    </Tooltip>
  );
}

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
    why: "Everything downstream reads from this structured profile, not the raw PDF. Fixing a wrong title or a missing skill here changes every future match score and tailored draft.",
    render: () => (
      <>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Row
            label="Name"
            value="Maya Ortiz"
            tip="Pulled from the resume header. Used on tailored documents."
          />
          <Row
            label="Years of experience"
            value="7"
            tip="Summed from role date ranges, overlaps counted once. This is the number compared against a job's minimum requirement."
          />
          <Row
            label="Titles"
            value="Product Designer, UX Designer"
            tip="Past job titles. Title similarity is one of the four scoring inputs — closer titles score higher."
          />
          <Row
            label="Education"
            value="BFA Design, RISD (2017)"
            tip="Degree and year. Only affects scoring when a posting states a specific education requirement."
          />
        </dl>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Skills extracted
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ["Design systems", "Appears 4 times across her roles, so it's treated as a core skill rather than a mention."],
              ["Figma", "Named tool. Matched literally against tools listed in the posting."],
              ["Prototyping", "Inferred from bullet wording, not a skills list."],
              ["User research", "Present but shallow — this is what produces the research gap in step 2."],
              ["Accessibility", "Extra skill the posting doesn't ask for; never counted against her."],
              ["Design ops", "Grouped from process and tooling ownership bullets."],
              ["Cross-functional leadership", "Derived from bullets about leading engineers and PMs through launches."],
            ].map(([s, tip]) => (
              <Hint key={s} tip={tip!}>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                  {s}
                </span>
              </Hint>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Hover any field or skill to see where it came from and how it&apos;s used.
          </p>
        </div>
      </>
    ),
  },
  {
    key: "match",
    label: "Match",
    step: "Step 2",
    caption: "She pastes the Northwind Labs job description. It's scored against her parsed profile.",
    why: "The score is a weighted read of four things: required skills covered (50%), years of experience vs. the minimum (20%), title similarity (20%), and preferred-but-optional extras (10%). Missing a preferred item costs a few points; missing a required skill costs a lot.",
    render: () => (
      <>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">Senior Product Designer</p>
            <p className="text-xs text-muted-foreground">Northwind Labs · Remote · $150–175k</p>
          </div>
          <Hint tip="92% = 8 of 9 required skills (≈46/50) + experience above the minimum (20/20) + a near-exact title match (19/20) + 1 of 3 preferred extras (≈7/10).">
            <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
              92% match
            </span>
          </Hint>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Strengths
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <Hint tip="Posting asks for 5+ years; her parsed total is 7. Clearing the minimum earns the full 20 points — going far beyond it adds nothing.">
                  7 yrs vs. 5+ required
                </Hint>
              </li>
              <li>
                <Hint tip="Design systems is the posting's first required skill and her most repeated one, so it carries the heaviest single weight in the score.">
                  Owned a design system end-to-end
                </Hint>
              </li>
              <li>
                <Hint tip="Matches the posting's line about partnering with engineering and product — evidence for a required responsibility, not just a skill keyword.">
                  Led cross-functional launches
                </Hint>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gaps</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <Hint tip="Listed under &ldquo;nice to have,&rdquo; so it only reduces the 10% preferred bucket — roughly 3 points, not a disqualifier.">
                  No B2B analytics tooling (preferred)
                </Hint>
              </li>
              <li>
                <Hint tip="Her resume mentions research but shows no quantitative studies. Partial credit on a required skill costs about 4 points — and it's the one thing worth addressing in the cover letter.">
                  Light on quantitative research
                </Hint>
              </li>
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
    why: "The drafts are built from the step 2 output, not from scratch: strengths get pulled forward with numbers attached, and the closest gap gets addressed obliquely. Nothing is invented — every claim traces back to a line in her parsed resume.",
    render: () => (
      <>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rewritten resume summary
        </p>
        <blockquote className="mt-2 border-l-2 border-primary pl-4 text-sm text-muted-foreground">
          <Hint tip="Leads with the posting's top required skill and her strongest signal, restated with the metric already on her resume (60 components, 4 teams, 40%). Quantified strengths land better than adjectives.">
            Product designer with 7 years shipping systems-driven B2B software. Built and maintained
            a 60-component design system adopted by four product teams, cutting handoff time by 40%.
          </Hint>
        </blockquote>
        <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cover letter opener
        </p>
        <blockquote className="mt-2 border-l-2 border-primary pl-4 text-sm text-muted-foreground">
          <Hint tip="Opens on the analytics-tooling gap from step 2 and reframes it with the closest real experience she has, so the weakest part of the match is answered in the first sentence instead of ignored.">
            Northwind&apos;s move toward a unified analytics surface is exactly the problem I spent
            the last two years on — consolidating five inconsistent dashboards into one system that a
            small team could actually maintain.
          </Hint>
        </blockquote>
      </>
    ),
  },
  {
    key: "followup",
    label: "Follow up",
    step: "Step 4",
    caption: "She marks it applied and sets a date. It surfaces on her dashboard the day it's due.",
    why: "The follow-up date is the only thing that decides what your dashboard shows. Applications with a date due today or earlier rise to the top; everything else stays out of the way.",
    render: () => (
      <>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Hint tip="Status drives visibility: applied and interviewing stay on the dashboard, saved and rejected don't.">
            <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              Applied
            </span>
          </Hint>
          <Hint tip="Default suggestion is one week after applying — early enough to be useful, late enough not to nag. Maya can pick any date.">
            <span className="text-muted-foreground">Applied Mar 4 · Follow up Mar 11</span>
          </Hint>
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
    <TooltipProvider delayDuration={100}>
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
          <ExampleStep
            key={current.key}
            step={current.step}
            title={current.label}
            caption={current.caption}
            why={current.why}
          >
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
    </TooltipProvider>
  );
}

function ExampleStep({
  step,
  title,
  caption,
  why,
  children,
}: {
  step: string;
  title: string;
  caption: string;
  why: string;
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
      <div className="mt-5 rounded-lg border border-border bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          What drove this
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">{why}</p>
      </div>
    </div>
  );
}

function Row({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{tip ? <Hint tip={tip}>{value}</Hint> : value}</dd>
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
