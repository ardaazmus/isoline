import { AppShell } from "@/components/shell";

/** v1 toolkit (ADR-008): the offline-first calculators keep their routes and shell. */
export default function ToolkitLayout({ children }: LayoutProps<"/[lang]">) {
  return <AppShell>{children}</AppShell>;
}
