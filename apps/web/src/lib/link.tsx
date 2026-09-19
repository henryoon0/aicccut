import * as React from "react";

/**
 * Minimal anchor shim standing in for `next/link` in fluid registry
 * components. Renders a plain <a>; TanStack Router intercepts same-origin
 * clicks at the router level when needed.
 */
type LinkProps = Omit<React.ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, ...rest },
  ref,
) {
  return <a ref={ref} href={href} {...rest} />;
});

export default Link;
