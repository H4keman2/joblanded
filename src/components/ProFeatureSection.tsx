import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProUpsell } from "@/components/ProUpsell";

/**
 * The standard locked-Pro section used across the app: header with Pro
 * badge, what it does, a benefit checklist, and the upsell. Every premium
 * feature uses this so they all look like one family.
 */
export function ProFeatureSection({
  icon,
  title,
  description,
  benefits,
  feature,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  benefits: { title: string; body: string }[];
  /** Label passed to the upsell, e.g. "AI resume review". */
  feature: string;
}) {
  return (
    <section className="panel space-y-6 p-6" aria-label={`${title} — Pro feature`}>
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <span aria-hidden="true" className="text-primary">
            {icon}
          </span>
          {title}
          <Badge variant="secondary" className="text-[11px]">
            Pro
          </Badge>
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {benefits.map((b) => (
          <li
            key={b.title}
            className="flex items-start gap-2.5 rounded-lg border border-border p-3"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check aria-hidden="true" className="h-3 w-3 text-primary" />
            </span>
            <div>
              <p className="text-sm font-semibold">{b.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{b.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <ProUpsell feature={feature} />
    </section>
  );
}
