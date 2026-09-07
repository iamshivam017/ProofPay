import * as React from "react";

import { cn } from "@/src/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-32 w-full resize-y rounded-md border border-line bg-black/20 px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-[#58615b] focus:border-signal/60 focus:ring-2 focus:ring-signal/10 disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
