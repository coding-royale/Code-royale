import Link from "next/link";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A button-styled anchor. Renders a plain <a> (Next Link for internal routes,
 * a native anchor when `external`) so we never put button semantics (role,
 * tabindex) on links — no Base UI involvement, no hydration surprises.
 */
function LinkButton({
  className,
  variant,
  size,
  external = false,
  ...props
}: ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    external?: boolean
  }) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (external) {
    const { href, children, ...rest } = props;
    return (
      <a href={typeof href === "string" ? href : undefined} className={classes} {...rest}>
        {children}
      </a>
    );
  }

  return <Link className={classes} {...props} />;
}

export { LinkButton };
