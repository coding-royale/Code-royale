import { ReactNode } from "react";

interface GlowCardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  accent?: "cyan" | "blue" | "purple";
}

const accentBarClass: Record<Required<GlowCardProps>["accent"], string> = {
  cyan: "bg-sky-500",
  blue: "bg-blue-500",
  purple: "bg-violet-500",
};

export function GlowCard({
  title,
  description,
  children,
  accent = "cyan",
}: GlowCardProps) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]">
      <div className={`absolute inset-x-0 top-0 h-px ${accentBarClass[accent]}`} />
      <div className="flex h-full flex-col gap-3 p-6">
        {title && (
          <h3 className="text-lg font-semibold text-[var(--cr-fg)]">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-sm text-[var(--cr-fg-muted)]">
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
