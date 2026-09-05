import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Wraps any element in a hoverable tooltip bubble. Used across the app to
 * explain what a control, score, or badge means without cluttering the UI
 * with permanent help text.
 */
export function Hint({ children, tip }: { children: ReactNode; tip: string }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{tip}</TooltipContent>
    </Tooltip>
  );
}
