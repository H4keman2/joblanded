import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addJob } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type SaveSearch = { url?: string; text?: string };

export const Route = createFileRoute("/_authenticated/save")({
  validateSearch: (search: Record<string, unknown>): SaveSearch => ({
    url: typeof search["url"] === "string" ? search["url"] : undefined,
    text: typeof search["text"] === "string" ? search["text"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Quick save a posting — JobLanded" },
      {
        name: "description",
        content: "Save a job posting from your phone in one step and pick it up on any device.",
      },
      { property: "og:title", content: "Quick save a posting — JobLanded" },
      {
        property: "og:description",
        content: "Save a job posting from your phone and pick it up on any device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuickSavePage,
});

function QuickSavePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(addJob);

  const [sourceUrl, setSourceUrl] = useState(search.url ?? "");
  const [description, setDescription] = useState(search.text ?? "");

  const save = useMutation({
    mutationFn: () => create({ data: { description, sourceUrl } }),
    onSuccess: () => {
      toast.success("Saved — it's on your Dashboard now");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="panel space-y-5 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Quick save</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Drop in a posting link — or paste the text if the page needs a login. It's saved to your
          account, so it shows up on your Dashboard wherever you sign in next.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <Label htmlFor="quick-url">Posting link</Label>
          <Input
            id="quick-url"
            inputMode="url"
            autoFocus
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="quick-text">Posting text (optional)</Label>
          <Textarea
            id="quick-text"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste the posting here if the link needs a login…"
            className="mt-1.5"
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save posting
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        Tip: add this page to your phone's home screen — then saving a posting you spot on the go is
        two taps.
      </p>
    </div>
  );
}
