import {
  LayoutDashboard,
  GraduationCap,
  CalendarDays,
  RotateCcw,
  Award,
  History,
  Settings,
  UserRound,
  Users,
  Building2,
  KeyRound,
  Kanban,
  ClipboardCheck,
  UserCog,
  ShieldCheck,
  BarChart3,
  ScrollText,
  Palette,
  type LucideIcon,
} from "lucide-react";

/** Roles from ARCHITECTURE.pdf section 4. Keys match messages roles.* */
export const ROLES = [
  "learner",
  "instructor",
  "org_admin",
  "content_creator",
  "reviewer",
  "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

export type NavItem = {
  /** messages key under nav.* */
  key: string;
  href: string;
  icon: LucideIcon;
  /** optional count badge (e.g. due reviews) */
  badge?: number;
};

export type NavSection = { items: NavItem[] };

/** Sidebar navigation per role. Hrefs are the route groups in ui-plan.md section 6. */
export const NAV: Record<Role, NavSection[]> = {
  learner: [
    {
      items: [
        { key: "dashboard", href: "/learn", icon: LayoutDashboard },
        { key: "courses", href: "/learn/courses", icon: GraduationCap },
        { key: "plan", href: "/learn/plan", icon: CalendarDays },
        { key: "reviews", href: "/learn/reviews", icon: RotateCcw },
        { key: "credentials", href: "/learn/credentials", icon: Award },
        { key: "history", href: "/learn/history", icon: History },
      ],
    },
    {
      items: [
        { key: "profile", href: "/learn/profile", icon: UserRound },
        { key: "settings", href: "/learn/settings", icon: Settings },
      ],
    },
  ],
  instructor: [
    {
      items: [
        { key: "cohort", href: "/instruct", icon: Users },
        { key: "learners", href: "/instruct/learners", icon: GraduationCap },
      ],
    },
    { items: [{ key: "settings", href: "/instruct/settings", icon: Settings }] },
  ],
  org_admin: [
    {
      items: [
        { key: "orgDashboard", href: "/org", icon: LayoutDashboard },
        { key: "learners", href: "/org/learners", icon: Users },
        { key: "courses", href: "/org/courses", icon: GraduationCap },
        { key: "entitlements", href: "/org/entitlements", icon: KeyRound },
      ],
    },
    { items: [{ key: "settings", href: "/org/settings", icon: Settings }] },
  ],
  content_creator: [
    {
      items: [
        { key: "workspace", href: "/content", icon: Kanban },
        { key: "courses", href: "/content/courses", icon: GraduationCap },
      ],
    },
    { items: [{ key: "settings", href: "/content/settings", icon: Settings }] },
  ],
  reviewer: [
    {
      items: [{ key: "reviewQueue", href: "/review", icon: ClipboardCheck }],
    },
    { items: [{ key: "settings", href: "/review/settings", icon: Settings }] },
  ],
  super_admin: [
    {
      items: [
        { key: "orgs", href: "/admin", icon: Building2 },
        { key: "users", href: "/admin/users", icon: UserCog },
        { key: "roles", href: "/admin/roles", icon: ShieldCheck },
        { key: "entitlements", href: "/admin/entitlements", icon: KeyRound },
        { key: "analytics", href: "/admin/analytics", icon: BarChart3 },
        { key: "auditLog", href: "/admin/audit", icon: ScrollText },
      ],
    },
    {
      items: [
        { key: "kit", href: "/kit", icon: Palette },
        { key: "settings", href: "/admin/settings", icon: Settings },
      ],
    },
  ],
};

/** Where "/" sends a user, by role priority (highest first). */
export const ROLE_HOME: Record<Role, string> = {
  super_admin: "/admin",
  org_admin: "/org",
  content_creator: "/content",
  reviewer: "/review",
  instructor: "/instruct",
  learner: "/learn",
};
