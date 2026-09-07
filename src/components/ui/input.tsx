import * as React from "react";

import { cn } from "@/src/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-md border border-line bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-[#58615b] focus:border-signal/60 focus:ring-2 focus:ring-signal/10 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
