
import type { ReactNode } from "react";
import AppLayoutClient from "./AppLayoutClient";

// Disable Instant Navigation validation for this route subtree.
export const instant = false;

export default function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
