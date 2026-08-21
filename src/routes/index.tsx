import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FileText, Target, ClipboardList, BellRing } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JobMatch — Resume Parsing, Job Matching & Application Tracking" },
      {
        name: "description",
        content:
          "JobMatch turns your resume into a structured profile, scores every job you save, tailors resumes and cover letters, and tracks follow-ups.",
      },
      { property: "og:title", content: "JobMatch — Run your job search in one place" },
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

const features = [
  {
    icon: FileText,
    title: "Resume parsing",
    body: "Upload a PDF or paste your resume — get skills, titles, experience and education extracted and editable.",
  },
  {
    icon: Target,
    title: "Match scoring",
    body: "Every job you save gets a match percentage plus a short explanation of the fit.",
  },
  {
    icon: ClipboardList,
    title: "Application tracker",
    body: "Saved, applied, interviewing, rejected, offer — with notes on every role.",
  },
  {
    icon: BellRing,
    title: "Follow-up reminders",
    body: "Set a follow-up date when you apply and see what's due on your dashboard.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="font-display text-lg font-semibold text-primary">JobMatch</span>
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-16 pt-12 text-center sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Job search workspace
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
          From resume to follow-up, without the spreadsheet.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
          JobMatch reads your resume once, then scores, tailors and tracks every role you go after.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Get started free</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-20 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, body }) => (
          <article key={title} className="panel p-6">
            <Icon className="size-5 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
