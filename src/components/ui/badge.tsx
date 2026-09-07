import type { HTMLAttributes } from "react";

import { cn } from "@/src/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted",
        className,
      )}
      {...props}
    />
  );
}
