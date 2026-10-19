/**
 * Role-based platform menu (ADR-011, UX review 19.10.2026). Six top-level entries at most — Today, Reporting
 * cycles, My work, Organisation, Library, Settings — and a section's own pages show under it only while the person
 * is inside that section. An entry shows when the workspace kind and the member's role match; hiding is only
 * convenience — every screen and API checks permission again on the server.
 */
import type { MemberRole } from "@/server/policy/policy";

type Kind = "company" | "advisory" | "partner";
export type NavLeaf = { id: string; href: string; kinds?: Kind[]; roles?: MemberRole[] };
export type NavItem = NavLeaf & { children?: NavLeaf[] };

const ADMINS: MemberRole[] = ["owner", "admin"];
const LEADS: MemberRole[] = [...ADMINS, "project_lead", "preparer"];
/** Everyone who works on a cycle beyond entering their own values. */
const CYCLE_ROLES: MemberRole[] = [...LEADS, "data_owner", "reviewer", "report_editor", "management_signer", "viewer"];

export const PLATFORM_NAV: NavItem[] = [
  { id: "home", href: "/app/home" },
  { id: "projects", href: "/app/projects", roles: CYCLE_ROLES },
  { id: "tasks", href: "/app/tasks" },
  {
    id: "orgSection",
    href: "/app/organization",
    children: [
      { id: "organization", href: "/app/organization", roles: LEADS },
      { id: "portfolio", href: "/app/portfolio", kinds: ["advisory", "partner"] },
      { id: "clientsNew", href: "/app/portfolio/clients/new", kinds: ["advisory"], roles: ["owner", "admin", "preparer"] },
      { id: "engagements", href: "/app/engagements", roles: LEADS },
      { id: "relationships", href: "/app/relationships", roles: LEADS },
      { id: "handoff", href: "/app/handoff", kinds: ["advisory", "partner"], roles: ["owner", "admin", "report_editor"] },
    ],
  },
  {
    id: "library",
    href: "/app/quick",
    children: [
      { id: "quick", href: "/app/quick" },
      { id: "factors", href: "/app/factors", roles: [...LEADS, "data_owner", "reviewer"] },
      { id: "regulations", href: "/app/library/regulations" },
      { id: "crosswalk", href: "/app/library/crosswalk" },
      { id: "themes", href: "/app/library/themes" },
      { id: "reference", href: "/app/settings/reference", roles: ADMINS },
    ],
  },
  {
    id: "settings",
    href: "/app/settings/members",
    children: [
      { id: "members", href: "/app/settings/members", roles: ADMINS },
      { id: "security", href: "/app/settings/security", roles: ADMINS },
      { id: "audit", href: "/app/settings/audit", roles: ADMINS },
      { id: "import", href: "/app/settings/import", roles: ADMINS },
      { id: "account", href: "/app/account/security" },
      { id: "notifications", href: "/app/notifications" },
    ],
  },
];

const fits = (i: NavLeaf, kind: string, role: MemberRole | null) => (!i.kinds || i.kinds.includes(kind as Kind)) && (!i.roles || (role !== null && i.roles.includes(role)));

/**
 * The menu for this workspace kind and role: a section keeps the children this person may open and points at the
 * first of them; a section with a single child becomes that child; an empty section disappears.
 */
export function visibleNav(kind: string, role: MemberRole | null): NavItem[] {
  const out: NavItem[] = [];
  for (const item of PLATFORM_NAV) {
    if (!fits(item, kind, role)) continue;
    if (!item.children) {
      out.push(item);
      continue;
    }
    const children = item.children.filter((c) => fits(c, kind, role));
    if (!children.length) continue;
    if (children.length === 1) out.push({ ...children[0] });
    else out.push({ ...item, href: children[0].href, children });
  }
  return out;
}

/** True when a path belongs to this entry or one of its children. */
export function navActive(item: NavItem, path: string, locale: string): boolean {
  const hit = (href: string) => {
    const h = `/${locale}${href}`;
    return path === h || path.startsWith(`${h}/`);
  };
  return hit(item.href) || (item.children ?? []).some((c) => hit(c.href));
}
