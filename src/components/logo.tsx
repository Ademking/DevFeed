import { cn } from "@/lib/utils";

export const Logo = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    className={cn("size-6 text-foreground", className)}
    fill="none"
    viewBox="0 0 32 32"
  >
    <rect fill="currentColor" height="32" width="32" />
    <path
      d="m11.5 10.5-5 5.5 5 5.5M20.5 10.5l5 5.5-5 5.5M17.5 9l-3 14"
      stroke="var(--background)"
      strokeLinecap="square"
      strokeWidth="2.6"
    />
  </svg>
);
