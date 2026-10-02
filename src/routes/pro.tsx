import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

// Placeholder until the Gumroad checkout URL is configured.
const CHECKOUT_URL = "https://gumroad.com/l/xrynld";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "JobLanded Pro — AI tailoring for $9.99" },
      {
        name: "description",
        content:
          "Unlock AI-tailored resumes and cover letters, explained match scores, job recommendations and posting-search analysis for a one-time $9.99.",
      },
      { property: "og:title", content: "JobLanded Pro — AI tailoring for $9.99" },
      {
        property: "og:description",
        content: "One-time $9.99 unlocks every AI feature in JobLanded.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProPage,
});

const features = [
  "AI-tailored resumes and cover letters for every posting",
  "Match scores with explanations for every job",
  "AI job recommendations based on your resume",
  "Posting-search match analysis across many roles at once",
];

function ProPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-16">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← JobLanded
        </Link>
        <h1 className="mt-4 text-4xl font-semibold">JobLanded Pro</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          $9.99 one-time payment. No subscription.
        </p>
      </div>
      <ul className="panel space-y-3 p-6">
        {features.map((f) => (
          <li key={f} className="flex gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
          </li>
        ))}
      </ul>
      <Button asChild size="lg">
        <a href={CHECKOUT_URL} target="_blank" rel="noreferrer">
          Buy JobLanded Pro — $9.99
        </a>
      </Button>
      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Already bought?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gumroad emails you a license key. Paste it on the{" "}
          <Link to="/account" className="text-primary underline">
            Account page
          </Link>{" "}
          to activate Pro. Each key works on up to 3 devices.
        </p>
      </section>
    </main>
  );
}
