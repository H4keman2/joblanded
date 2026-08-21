import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs — JobLanded" },
      {
        name: "description",
        content: "Save job postings and see how well each one matches your resume profile.",
      },
      { property: "og:title", content: "Jobs — JobLanded" },
      { property: "og:description", content: "Saved job postings with match scores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="panel p-8">
      <h1 className="text-2xl font-semibold">Jobs</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Job input, match scoring and tailoring land here next — resume parsing comes first so
        matches have something to compare against.
      </p>
    </div>
  ),
});
