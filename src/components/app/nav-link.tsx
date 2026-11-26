"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  href: string;
  segment: string;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
  children: ReactNode;
};

export function NavLink({
  href,
  segment,
  className,
  activeClassName,
  inactiveClassName,
  children,
}: NavLinkProps) {
  const isActive = useSelectedLayoutSegment() === segment;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`${className} ${isActive ? activeClassName : inactiveClassName}`}
    >
      {children}
    </Link>
  );
}
