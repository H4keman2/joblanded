import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function ProUpsell({ feature }: { feature: string }) {
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-4 p-6">
      <div>
        <p className="font-semibold">{feature} is a JobLanded Pro feature</p>
        <p className="mt-1 text-sm text-muted-foreground">
          One-time $9.99 unlocks all AI features. Already bought? Activate your key on the Account page.
        </p>
      </div>
      <Button asChild>
        <Link to="/pro">
          <Sparkles className="mr-1.5 h-4 w-4" /> Get Pro
        </Link>
      </Button>
    </div>
  );
}
