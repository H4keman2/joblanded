import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({
    meta: [
      { title: "Applications — JobLanded" },
      {
        name: "description",
        content: "Track application status, notes and follow-up dates for every role you pursue.",
      },
      { property: "og:title", content: "Applications — JobLanded" },
      { property: "og:description", content: "Status, notes and follow-ups for every application." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="panel p-8">
      <h1 className="text-2xl font-semibold">Applications</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The status tracker and follow-up reminders arrive with the jobs module.
      </p>
    </div>
  ),
});
