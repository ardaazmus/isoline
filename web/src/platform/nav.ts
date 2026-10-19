/**
 * Role-based platform menu (ADR-011, plan 04 §1). An item shows when the workspace kind and the member's role match;
 * hiding is only convenience — every screen and API checks permission again on the server. Items join the menu as
 * their gate lands (G3 tasks, G5 review…).
 */
import type { MemberRole } from "@/server/policy/policy";

export type NavItem = { id: string; href: string; kinds?: ("company" | "advisory" | "partner")[]; roles?: MemberRole[] };
export type NavGroup = { id: string; items: NavItem[] };

const ADMINS: MemberRole[] = ["owner", "admin"];

export const PLATFORM_NAV: NavGroup[] = [
  {
    id: "work",
    items: [
      { id: "home", href: "/app/home" },
      { id: "portfolio", href: "/app/portfolio" },
      { id: "projects", href: "/app/projects" },
      { id: "tasks", href: "/app/tasks" },
      { id: "review", href: "/app/review" },
      { id: "handoff", href: "/app/handoff", kinds: ["advisory", "partner"], roles: ["owner", "admin", "report_editor"] },
      { id: "notifications", href: "/app/notifications" },
      { id: "engagements", href: "/app/engagements", roles: [...ADMINS, "project_lead", "preparer"] },
      { id: "organization", href: "/app/organization", roles: [...ADMINS, "project_lead", "preparer"] },
      { id: "factors", href: "/app/factors", roles: [...ADMINS, "project_lead", "preparer", "data_owner", "reviewer"] },
    ],
  },
  {
    id: "share",
    items: [
      { id: "relationships", href: "/app/relationships", roles: [...ADMINS, "project_lead", "preparer"] },
      { id: "clientsNew", href: "/app/portfolio/clients/new", kinds: ["advisory"], roles: ["owner", "admin", "preparer"] },
    ],
  },
  {
    id: "settings",
    items: [
      { id: "members", href: "/app/settings/members", roles: ADMINS },
      { id: "security", href: "/app/settings/security", roles: ADMINS },
      { id: "audit", href: "/app/settings/audit", roles: ADMINS },
      { id: "import", href: "/app/settings/import", roles: ADMINS },
      { id: "reference", href: "/app/settings/reference", roles: ADMINS },
      { id: "account", href: "/app/account/security" },
    ],
  },
];

export function visibleNav(kind: string, role: MemberRole | null): NavGroup[] {
  return PLATFORM_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.kinds || i.kinds.includes(kind as "company")) && (!i.roles || (role !== null && i.roles.includes(role)))),
  })).filter((g) => g.items.length);
}
