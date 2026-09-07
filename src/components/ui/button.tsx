import * as React from "react";

import { cn } from "@/src/lib/utils";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-signal text-ink hover:bg-[#c8ff88] focus-visible:ring-signal",
  outline: "border border-line bg-transparent text-white hover:border-[#3d493f] hover:bg-white/[.03] focus-visible:ring-white/30",
  ghost: "bg-transparent text-muted hover:bg-white/[.04] hover:text-white focus-visible:ring-white/30",
  danger: "bg-red-500 text-white hover:bg-red-400 focus-visible:ring-red-400",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
