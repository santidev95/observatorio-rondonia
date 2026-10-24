"use client";

import { Button, type ButtonProps } from "@mantine/core";
import Link from "next/link";

type Props = ButtonProps & {
  href: string;
  external?: boolean;
  download?: boolean;
  target?: string;
  rel?: string;
};

/** Keeps polymorphic Next.js links within a client boundary. */
export function LinkButton({ href, external, ...props }: Props) {
  return external ? (
    <Button component="a" href={href} {...props} />
  ) : (
    <Button component={Link} href={href} prefetch={false} {...props} />
  );
}
