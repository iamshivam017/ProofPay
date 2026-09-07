import * as React from "react";

import { cn } from "@/src/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("border border-line bg-panel/90 shadow-signal", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";
