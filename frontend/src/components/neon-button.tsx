"use client";

import { ButtonHTMLAttributes, DetailedHTMLProps } from "react";
import Link from "next/link";

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[rgba(var(--cr-accent-rgb),0.4)] bg-[rgba(var(--cr-accent-rgb),0.10)] px-5 py-2 text-sm font-semibold text-[var(--cr-fg)] transition-colors duration-150 hover:border-[rgba(var(--cr-accent-rgb),0.7)] hover:bg-[rgba(var(--cr-accent-rgb),0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--cr-accent-rgb),0.5)]";

const merge = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(" ");

export function NeonButton(
  props: DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>,
) {
  const { className, children, ...rest } = props;
  return (
    <button
      {...rest}
      className={merge(
        baseClasses,
        rest.disabled &&
          "cursor-not-allowed opacity-60 hover:border-[rgba(var(--cr-accent-rgb),0.4)] hover:bg-[rgba(var(--cr-accent-rgb),0.10)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface NeonLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function NeonLink({ href, children, className }: NeonLinkProps) {
  return (
    <Link href={href} className={merge(baseClasses, className)}>
      {children}
    </Link>
  );
}
