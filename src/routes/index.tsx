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
        <ScoreBreakdown />
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
    render: () => <TailorStudio />,
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

interface TailorDraft {
  angle: string;
  summary: string;
  cover: string;
  why: string;
  ats: { score: number; note: string; flags: string[] };
  keywords: { score: number; note: string; hits: string[]; misses: string[] };
}

const tailorDrafts: TailorDraft[] = [
  {
    angle: "Systems & scale",
    summary:
      "Product designer with 7 years shipping systems-driven B2B software. Built and maintained a 60-component design system adopted by four product teams, cutting handoff time by 40%.",
    cover:
      "Northwind's move toward a unified analytics surface is exactly the problem I spent the last two years on — consolidating five inconsistent dashboards into one system that a small team could actually maintain.",
    why: "Leads with the posting's top required skill (design systems) and attaches the metric already on her resume. Opens the letter on the analytics-tooling gap so the weakest part of the match is answered first.",
    ats: {
      score: 94,
      note: "Standard section headings, single-column layout, no tables or graphics — parses cleanly in every major ATS.",
      flags: ["Standard headings", "Single column", "No tables/images", "Standard bullets"],
    },
    keywords: {
      score: 91,
      note: "Covers 9 of 10 posting keywords. 'Analytics tooling' appears once in the cover but not in the summary.",
      hits: ["design system", "component library", "B2B software", "product designer", "handoff", "adopted", "analytics surface", "maintain", "teams"],
      misses: ["analytics tooling"],
    },
  },
  {
    angle: "Outcome-first",
    summary:
      "Product designer who turns messy B2B workflows into measurable wins: 40% faster design-to-ship handoff, five dashboards consolidated into one, four teams on a shared component library.",
    cover:
      "In my last two years I cut a five-dashboard mess down to one analytics surface that a three-person team maintains without a backlog — the same consolidation Northwind is starting now.",
    why: "Same evidence, reordered so numbers come before role language. Useful when the posting emphasizes impact and ownership over craft vocabulary.",
    ats: {
      score: 92,
      note: "Clean structure and standard headings. The colon-heavy summary line reads slightly dense to parsers but stays within tolerance.",
      flags: ["Standard headings", "Single column", "No tables/images", "Slightly dense summary"],
    },
    keywords: {
      score: 84,
      note: "Covers 8 of 10 keywords. Swapping 'design system' for 'component library' drops the posting's top exact-match phrase.",
      hits: ["component library", "B2B workflows", "product designer", "handoff", "dashboards", "analytics surface", "maintains", "teams"],
      misses: ["design system", "analytics tooling"],
    },
  },
  {
    angle: "Collaboration & craft",
    summary:
      "Product designer partnering closely with engineering on B2B tooling. Owned a 60-component library with four product teams as customers, and ran the review rituals that kept it adopted.",
    cover:
      "What drew me to Northwind is that the analytics work is cross-team by nature. My last consolidation succeeded because I treated four product teams as customers of the system, not consumers of a spec.",
    why: "Foregrounds the cross-functional signal from her resume, since the posting names 'partner with data engineering' twice. Trades one metric for adoption language.",
    ats: {
      score: 95,
      note: "The cleanest of the four: short sentences, standard headings, and no formatting the parser can trip on.",
      flags: ["Standard headings", "Single column", "Short sentences", "No tables/images"],
    },
    keywords: {
      score: 79,
      note: "Covers 7 of 10 keywords. 'Partnering with engineering' is a near-match for 'partner with data engineering' but not exact, and no metric keywords carry over.",
      hits: ["product designer", "B2B tooling", "component library", "product teams", "engineering", "adopted", "cross-team"],
      misses: ["design system", "analytics tooling", "handoff"],
    },
  },
  {
    angle: "Gap-forward",
    summary:
      "Product designer with 7 years in B2B software and two years designing data-heavy interfaces — dashboards, filters, and drill-downs used daily by internal analytics teams.",
    cover:
      "I'll be direct about the analytics-tooling line in your posting: I haven't shipped a BI product, but I've spent two years designing the dashboards and drill-downs analysts live in, and that's where the consolidation work actually happens.",
    why: "Addresses the flagged gap head-on rather than obliquely. Scores lower on keyword overlap but reads honestly for roles where the gap is likely to come up in screening anyway.",
    ats: {
      score: 90,
      note: "Fully parseable, though the em-dash phrasing and first-person honesty line are written for a human reader, not a keyword ranker.",
      flags: ["Standard headings", "Single column", "No tables/images", "Human-first phrasing"],
    },
    keywords: {
      score: 72,
      note: "Covers 6 of 10 keywords. 'Analytics tooling' is named directly (a win for screening questions) but systems vocabulary disappears entirely.",
      hits: ["product designer", "B2B software", "analytics tooling", "dashboards", "drill-downs", "analytics teams"],
      misses: ["design system", "component library", "handoff", "adopted"],
    },
  },
];


// ATS-optimized revisions: same inputs, rewritten to fix the base version's
// weakest readability flag and work the missing keywords back in.
const optimizedDrafts: TailorDraft[] = [
  {
    angle: "ATS-optimized · Systems & scale",
    summary:
      "Product designer with 7 years in B2B software. Built a 60-component design system adopted by four product teams, cutting handoff time by 40%. Designed analytics tooling dashboards used daily by internal teams.",
    cover:
      "Northwind's move toward a unified analytics surface is exactly the problem I spent the last two years on — consolidating five inconsistent dashboards into one design system and analytics tooling surface that a small team could actually maintain.",
    why: "Only change vs. v1: the missing 'analytics tooling' keyword is worked into both the summary and the letter. Readability flags were already clean, so nothing else moved.",
    ats: {
      score: 96,
      note: "Keeps v1's clean structure. Sentence split for scanability; no new formatting risk introduced.",
      flags: ["Standard headings", "Single column", "No tables/images", "Shorter sentences"],
    },
    keywords: {
      score: 100,
      note: "Covers all 10 posting keywords. 'Analytics tooling' now appears in both the summary and the cover letter.",
      hits: ["design system", "component library", "B2B software", "product designer", "handoff", "adopted", "analytics surface", "analytics tooling", "maintain", "teams"],
      misses: [],
    },
  },
  {
    angle: "ATS-optimized · Outcome-first",
    summary:
      "Product designer who turns messy B2B workflows into measurable wins. Cut design-to-ship handoff time 40%, consolidated five dashboards into one analytics tooling surface, and moved four teams onto a shared design system.",
    cover:
      "In my last two years I cut a five-dashboard mess down to one analytics surface that a three-person team maintains without a backlog — the same consolidation Northwind is starting now, built on the design system four teams already ship from.",
    why: "Fixes v2's two problems: the dense colon-led summary is split into short sentences (readability flag), and the exact-match phrases 'design system' and 'analytics tooling' are restored.",
    ats: {
      score: 96,
      note: "Colon-heavy summary line split into three short sentences — clears the 'slightly dense summary' flag.",
      flags: ["Standard headings", "Single column", "No tables/images", "Short sentences"],
    },
    keywords: {
      score: 100,
      note: "Covers all 10 posting keywords. 'Design system' and 'analytics tooling' restored as exact matches.",
      hits: ["design system", "component library", "B2B workflows", "product designer", "handoff", "dashboards", "analytics surface", "analytics tooling", "maintains", "teams"],
      misses: [],
    },
  },
  {
    angle: "ATS-optimized · Collaboration & craft",
    summary:
      "Product designer partnering with engineering on B2B tooling. Owned a 60-component design system with four product teams as customers, cutting handoff time 40% and keeping adoption high through analytics tooling review rituals.",
    cover:
      "What drew me to Northwind is that the analytics tooling work is cross-team by nature. My last consolidation succeeded because I treated four product teams as customers of the design system, not consumers of a spec — and handoff time dropped 40% as a result.",
    why: "Keeps v3's collaboration angle but restores the exact phrase 'design system', the dropped 'handoff' keyword, and the missing 'analytics tooling'. Retains the strongest readability score of the set.",
    ats: {
      score: 96,
      note: "v3 was already the cleanest structure; the keyword additions were made without lengthening sentences past parser-safe limits.",
      flags: ["Standard headings", "Single column", "Short sentences", "No tables/images"],
    },
    keywords: {
      score: 100,
      note: "Covers all 10 posting keywords. 'Design system', 'handoff', and 'analytics tooling' all restored.",
      hits: ["design system", "product designer", "B2B tooling", "component library", "product teams", "engineering", "adopted", "cross-team", "handoff", "analytics tooling"],
      misses: [],
    },
  },
  {
    angle: "ATS-optimized · Gap-forward",
    summary:
      "Product designer with 7 years in B2B software and two years designing analytics tooling — dashboards, filters, and drill-downs built on a shared design system and used daily by internal analytics teams.",
    cover:
      "I'll be direct about the analytics-tooling line in your posting: I haven't shipped a BI product, but I've spent two years designing the dashboards and drill-downs analysts live in, inside the same design system that cut our handoff time 40% — and that's where the consolidation work actually happens.",
    why: "Keeps v4's honest gap framing but pulls 'design system', 'component library' context, 'handoff', and 'adopted' back into the text. The human-first honesty line stays — it's a readability choice, not a parser risk.",
    ats: {
      score: 93,
      note: "Fully parseable. First-person honesty line retained deliberately: it's the version's angle, and it costs nothing at the parser.",
      flags: ["Standard headings", "Single column", "No tables/images", "Human-first phrasing"],
    },
    keywords: {
      score: 95,
      note: "Covers 9 of 10 keywords. 'Adopted' is implied by the consolidation story rather than stated — the one deliberate trade-off kept from v4.",
      hits: ["design system", "product designer", "B2B software", "analytics tooling", "dashboards", "drill-downs", "analytics teams", "handoff", "component library"],
      misses: ["adopted"],
    },
  },
];

// Version refs: 0..3 are base drafts, 100..103 are their ATS-optimized revisions.
function resolveDraft(ref: number): TailorDraft {
  return ref >= 100 ? optimizedDrafts[ref - 100]! : tailorDrafts[ref]!;
}
const isOptimized = (ref: number) => ref >= 100;

function TailorStudio() {
  const [versions, setVersions] = useState<number[]>([0]);
  const [selected, setSelected] = useState(0);
  const [compare, setCompare] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(true);


  const regenerate = () => {
    const next = versions.length % tailorDrafts.length;
    setVersions((v) => [...v, next]);
    setSelected(versions.length);
    setCompare(null);
  };

  const optimize = () => {
    const base = versions[selected]! % 100;
    const optimized = base + 100;
    if (versions.includes(optimized)) {
      setSelected(versions.indexOf(optimized));
    } else {
      setVersions((v) => [...v, optimized]);
      setSelected(versions.length);
    }
    setCompare(null);
  };

  const optimizeAll = () => {
    setVersions((prev) => {
      const bases = [...new Set(prev.filter((r) => r < 100))];
      const missing = bases.map((b) => b + 100).filter((o) => !prev.includes(o));
      return [...prev, ...missing];
    });
    // Pair the current base draft with its optimized twin for side-by-side compare.
    const base = versions[selected]! % 100;
    const optimizedRef = base + 100;
    const next = versions.includes(optimizedRef)
      ? versions
      : [...versions, ...[...new Set(versions.filter((r) => r < 100))].map((b) => b + 100).filter((o) => !versions.includes(o))];
    const baseIdx = next.indexOf(base);
    const optIdx = next.indexOf(optimizedRef);
    setSelected(baseIdx === -1 ? 0 : baseIdx);
    setCompare(optIdx === -1 ? null : optIdx);
  };

  const primary = resolveDraft(versions[selected]!);
  const secondary = compare === null ? null : resolveDraft(versions[compare]!);
  const versionLabel = (i: number) =>
    `v${i + 1}${isOptimized(versions[i]!) ? " · ATS" : ""}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Version history
        </span>
        {versions.map((d, i) => (
          <Hint key={i} tip={`Angle: ${resolveDraft(d).angle}. Same parsed resume and job post — only the framing changes.`}>
            <button
              onClick={() => setSelected(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === selected
                  ? "bg-primary text-primary-foreground"
                  : i === compare
                    ? "bg-secondary text-secondary-foreground ring-1 ring-primary"
                    : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {versionLabel(i)}
            </button>
          </Hint>
        ))}
        <Button size="sm" variant="outline" onClick={regenerate} disabled={versions.length >= 4}>
          Regenerate
        </Button>
        <Hint tip="Rewrites the selected draft to fix its weakest ATS readability flag and work its missing keywords back in — same evidence, higher coverage.">
          <Button size="sm" onClick={optimize}>
            ATS-optimize this draft
          </Button>
        </Hint>
        <Hint tip="Creates an ATS-optimized revision of every base version in the history and opens the selected base next to its optimized twin so you can compare side by side.">
          <Button size="sm" variant="secondary" onClick={optimizeAll}>
            ATS-optimize all versions
          </Button>
        </Hint>
        {versions.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setCompare((c) =>
                c === null ? versions.map((_, i) => i).find((i) => i !== selected) ?? null : null,
              )
            }
          >
            {compare === null ? "Compare" : "Exit compare"}
          </Button>
        )}
        {compare !== null && (
          <Hint tip="Word-level diff between the two drafts: text only in the other version is struck through, text unique to this one is highlighted.">
            <Button size="sm" variant={showDiff ? "secondary" : "ghost"} onClick={() => setShowDiff((d) => !d)}>
              {showDiff ? "Hide changes" : "Highlight changes"}
            </Button>
          </Hint>
        )}
      </div>

      <div className={`mt-5 grid gap-6 ${secondary ? "md:grid-cols-2" : ""}`}>
        <DraftCard
          label={versionLabel(selected)}
          draft={primary}
          diffAgainst={secondary && showDiff ? secondary : undefined}
        />
        {secondary && compare !== null && (
          <div className="border-t border-border pt-6 md:border-l md:border-t-0 md:pt-0 md:pl-6">
            <div className="mb-3 flex flex-wrap gap-2">
              {versions.map((_, i) =>
                i === selected ? null : (
                  <button
                    key={i}
                    onClick={() => setCompare(i)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      i === compare
                        ? "bg-secondary text-secondary-foreground ring-1 ring-primary"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {versionLabel(i)}
                  </button>
                ),
              )}
            </div>
            <DraftCard
              label={versionLabel(compare)}
              draft={secondary}
              diffAgainst={showDiff ? primary : undefined}
            />
          </div>
        )}
      </div>

    </div>
  );
}

function ScoreBar({ score, tone }: { score: number; tone?: "warn" }) {
  const color =
    score >= 85 ? "bg-primary" : score >= 75 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${tone === "warn" ? "bg-amber-500" : color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-foreground">{score}</span>
    </div>
  );
}

type DiffToken = { text: string; type: "same" | "add" | "del" };

// Word-level LCS diff. Returns tokens for `target` relative to `base`.
function diffWords(base: string, target: string): DiffToken[] {
  const a = base.match(/\S+\s*/g) ?? [];
  const b = target.match(/\S+\s*/g) ?? [];
  const norm = (s: string) => s.trim().toLowerCase().replace(/[.,;:—–-]+$/g, "");
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] =
        norm(a[i]!) === norm(b[j]!)
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: DiffToken[] = [];
  const push = (text: string, type: DiffToken["type"]) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (norm(a[i]!) === norm(b[j]!)) {
      push(b[j]!, "same");
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      push(a[i]!, "del");
      i++;
    } else {
      push(b[j]!, "add");
      j++;
    }
  }
  while (i < n) push(a[i++]!, "del");
  while (j < m) push(b[j++]!, "add");
  return out;
}

function DiffText({ base, text }: { base?: string | undefined; text: string }) {
  if (!base || base === text) return <>{text}</>;
  return (
    <>
      {diffWords(base, text).map((t, i) =>
        t.type === "same" ? (
          <span key={i}>{t.text}</span>
        ) : t.type === "add" ? (
          <span
            key={i}
            className="rounded-sm bg-primary/15 px-0.5 font-medium text-foreground decoration-primary/50"
          >
            {t.text}
          </span>
        ) : (
          <span key={i} className="rounded-sm bg-destructive/10 px-0.5 text-destructive/70 line-through">
            {t.text}
          </span>
        ),
      )}
    </>
  );
}

function DraftCard({
  label,
  draft,
  diffAgainst,
}: {
  label: string;
  draft: TailorDraft;
  diffAgainst?: TailorDraft | undefined;
}) {

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</span>
        <span className="text-xs text-muted-foreground">{draft.angle}</span>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2">
        <div>
          <Hint tip={draft.ats.note}>
            <p className="cursor-help text-xs font-medium uppercase tracking-wide text-muted-foreground underline decoration-dotted underline-offset-2">
              ATS readability
            </p>
          </Hint>
          <div className="mt-1.5">
            <ScoreBar score={draft.ats.score} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.ats.flags.map((f) => (
              <span key={f} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                {f}
              </span>
            ))}
          </div>
        </div>
        <div>
          <Hint tip={draft.keywords.note}>
            <p className="cursor-help text-xs font-medium uppercase tracking-wide text-muted-foreground underline decoration-dotted underline-offset-2">
              Keyword coverage
            </p>
          </Hint>
          <div className="mt-1.5">
            <ScoreBar score={draft.keywords.score} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.keywords.hits.map((k) => (
              <Hint key={k} tip={`"${k}" appears in the posting and in this version.`}>
                <span className="cursor-help rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {k}
                </span>
              </Hint>
            ))}
            {draft.keywords.misses.map((k) => (
              <Hint key={k} tip={`"${k}" appears in the posting but is missing from this version.`}>
                <span className="cursor-help rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                  {k}
                </span>
              </Hint>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rewritten resume summary
        </p>
        {diffAgainst && (
          <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="rounded-sm bg-primary/15 px-1 font-medium text-foreground">added</span>
            <span className="rounded-sm bg-destructive/10 px-1 text-destructive/70 line-through">removed</span>
          </span>
        )}
      </div>
      <blockquote className="mt-2 border-l-2 border-primary pl-4 text-sm text-muted-foreground">
        <DiffText base={diffAgainst?.summary} text={draft.summary} />
      </blockquote>
      <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Cover letter opener
      </p>
      <blockquote className="mt-2 border-l-2 border-primary pl-4 text-sm text-muted-foreground">
        <DiffText base={diffAgainst?.cover} text={draft.cover} />
      </blockquote>

      <p className="mt-4 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Why this version: </span>
        {draft.why}
      </p>
    </div>
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

const scoreBuckets = [
  {
    name: "Required skills covered",
    earned: 45.6,
    max: 50,
    detail: "8 of 9 required skills matched, 1 partial",
    tip: "Each required skill is worth ~5.6 points. Design systems, Figma, prototyping, design ops and cross-functional leadership matched outright; quantitative research got partial credit.",
    items: [
      {
        label: "Design systems",
        weight: "+5.6",
        note: "Exact match, posting's top requirement, 4 mentions on her resume",
        resume: "Built and maintained a 60-component design system adopted by four product teams.",
        resumeMark: ["design system"],
        job: "You will own our design system and scale it across a growing product surface.",
        jobMark: ["design system"],
      },
      {
        label: "Figma",
        weight: "+5.6",
        note: "Literal tool match against the posting's tooling line",
        resume: "Ran all design work in Figma, including shared libraries and component documentation.",
        resumeMark: ["Figma"],
        job: "Deep fluency in Figma and modern prototyping tools.",
        jobMark: ["Figma"],
      },
      {
        label: "Cross-functional leadership",
        weight: "+5.6",
        note: "Matched to \"partner with engineering and product\"",
        resume: "Led cross-functional launches with engineering and product for four major releases.",
        resumeMark: ["cross-functional", "engineering and product"],
        job: "Partner with engineering and product to take features from concept to launch.",
        jobMark: ["engineering and product"],
      },
      {
        label: "Prototyping",
        weight: "+5.6",
        note: "Inferred from bullet wording, counted as a full match",
        resume: "Tested interactive flows with clickable mockups before handoff.",
        resumeMark: ["interactive flows", "clickable mockups"],
        job: "Deep fluency in Figma and modern prototyping tools.",
        jobMark: ["prototyping"],
      },
      {
        label: "Quantitative research",
        weight: "+1.6",
        note: "Partial: research mentioned, no studies with numbers — costs ~4 points",
        resume: "Informed roadmap decisions with user research sessions.",
        resumeMark: ["user research"],
        job: "Run quantitative research studies and translate metrics into design decisions.",
        jobMark: ["quantitative research", "metrics"],
      },
    ],
  },
  {
    name: "Experience vs. minimum",
    earned: 20,
    max: 20,
    detail: "7 yrs against a 5+ yr minimum",
    tip: "This bucket is pass/fail at the minimum. Clearing 5+ years earns all 20 points; extra years add nothing.",
    items: [
      {
        label: "7 yrs vs. 5+ required",
        weight: "+20",
        note: "Full credit — no bonus for exceeding the minimum",
        resume: "Product Designer, Halcyon (2019–2024) · UX Designer, Bright Fig (2017–2019)",
        resumeMark: ["2019–2024", "2017–2019"],
        job: "5+ years of product design experience in software teams.",
        jobMark: ["5+ years"],
      },
    ],
  },
  {
    name: "Title similarity",
    earned: 19,
    max: 20,
    detail: "\"Product Designer\" vs. \"Senior Product Designer\"",
    tip: "Titles are compared as phrases. A seniority-only difference costs a single point; a different discipline would cost most of the bucket.",
    items: [
      {
        label: "Product Designer → Senior Product Designer",
        weight: "+19",
        note: "Same discipline, one seniority step below",
        resume: "Product Designer, Halcyon — 2019 to 2024",
        resumeMark: ["Product Designer"],
        job: "Senior Product Designer, Northwind Labs",
        jobMark: ["Senior Product Designer"],
      },
      {
        label: "UX Designer",
        weight: "+0",
        note: "Second title, already covered by the stronger match",
        resume: "UX Designer, Bright Fig — 2017 to 2019",
        resumeMark: ["UX Designer"],
        job: "Senior Product Designer, Northwind Labs",
        jobMark: ["Product Designer"],
      },
    ],
  },
  {
    name: "Preferred extras",
    earned: 7,
    max: 10,
    detail: "1 of 3 nice-to-haves",
    tip: "Preferred items never disqualify. Missing B2B analytics tooling is the only real deduction in the whole score.",
    items: [
      {
        label: "Design ops ownership",
        weight: "+7",
        note: "Listed as preferred, matched from her tooling and process bullets",
        resume: "Owned design ops: file structure, contribution process, and review rituals.",
        resumeMark: ["design ops"],
        job: "Nice to have: experience improving design ops and team process.",
        jobMark: ["design ops"],
      },
      {
        label: "B2B analytics tooling",
        weight: "+0",
        note: "Not present — the ~3 point gap that keeps this off 95%",
        resume: null,
        resumeMark: [],
        job: "Nice to have: prior work on B2B analytics or data-heavy dashboards.",
        jobMark: ["B2B analytics"],
      },
    ],
  },
] as const;

function Marked({ text, marks }: { text: string; marks: readonly string[] }) {
  if (marks.length === 0) return <>{text}</>;
  const pattern = new RegExp(
    `(${marks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  return (
    <>
      {text.split(pattern).map((part, i) =>
        marks.some((m) => m.toLowerCase() === part.toLowerCase()) ? (
          <mark
            key={i}
            className="rounded bg-accent px-1 py-0.5 font-medium text-accent-foreground"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Evidence({
  resume,
  resumeMark,
  job,
  jobMark,
}: {
  resume: string | null;
  resumeMark: readonly string[];
  job: string;
  jobMark: readonly string[];
}) {
  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-2">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          From your resume
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {resume ? <Marked text={resume} marks={resumeMark} /> : "No matching line found."}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          From the job post
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          <Marked text={job} marks={jobMark} />
        </p>
      </div>
    </div>
  );
}

function ScoreItem({ item }: { item: (typeof scoreBuckets)[number]["items"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="text-left text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
        >
          {item.label}
          <span className="ml-1.5 text-[10px] uppercase tracking-wide">
            {open ? "hide evidence" : "evidence"}
          </span>
        </button>
        <span className="shrink-0 font-mono text-muted-foreground">{item.weight}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground/80">{item.note}</p>
      {open && (
        <Evidence
          resume={item.resume}
          resumeMark={item.resumeMark}
          job={item.job}
          jobMark={item.jobMark}
        />
      )}
    </li>
  );
}

function ScoreBreakdown() {
  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Score breakdown
        </p>
        <p className="text-xs text-muted-foreground">91.6 of 100 points · rounded to 92%</p>
      </div>

      <div className="mt-4 space-y-5">
        {scoreBuckets.map((bucket) => (
          <div key={bucket.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <Hint tip={bucket.tip}>
                <span className="font-medium">{bucket.name}</span>
              </Hint>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {bucket.earned} / {bucket.max}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(bucket.earned / bucket.max) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{bucket.detail}</p>
            <ul className="mt-2 space-y-2.5">
              {bucket.items.map((item) => (
                <ScoreItem key={item.label} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Click any line to see the exact resume and job-post text that triggered the match.
      </p>
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
