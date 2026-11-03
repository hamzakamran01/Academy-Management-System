import {
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  FileBarChart,
  GraduationCap,
  History,
  Home,
  LayoutDashboard,
  LayoutGrid,
  Library,
  ListChecks,
  Megaphone,
  NotebookPen,
  Settings,
  ShieldCheck,
  Sun,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./roles";

export type NavItem = { href: string; label: string; icon: LucideIcon; match?: string[] };
export type NavGroup = { label: string; items: NavItem[] };

const more: NavItem = { href: "/more", label: "More", icon: LayoutGrid };

/** Bottom navigation, 5 tabs (PRD §4.1). */
export const BOTTOM_NAV: Record<Role, NavItem[]> = {
  parent: [
    { href: "/home", label: "Home", icon: Home },
    { href: "/results", label: "Results", icon: GraduationCap },
    { href: "/progress", label: "In class", icon: BookOpen, match: ["/homework"] },
    { href: "/fees", label: "Fees", icon: Wallet },
    more,
  ],
  teacher: [
    { href: "/home", label: "Today", icon: Sun, match: ["/lesson", "/my-progress"] },
    { href: "/classes", label: "My Classes", icon: Library },
    { href: "/results", label: "Results", icon: GraduationCap },
    { href: "/my-salary", label: "Salary", icon: Banknote },
    more,
  ],
  admin: [
    { href: "/home", label: "Dashboard", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: UsersRound },
    { href: "/classes", label: "Classes", icon: Library },
    { href: "/fees", label: "Fees", icon: Wallet },
    more,
  ],
  super_admin: [
    { href: "/home", label: "Overview", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: UsersRound },
    { href: "/finance", label: "Finance", icon: Banknote, match: ["/fees", "/salaries"] },
    { href: "/teachers", label: "Teachers", icon: Users },
    more,
  ],
};

const people = (role: Role): NavItem[] => [
  { href: "/students", label: "Students", icon: UsersRound },
  { href: "/teachers", label: "Teachers", icon: Users },
  { href: "/parents", label: "Parents", icon: UserCircle },
  ...(role === "super_admin" ? [{ href: "/admins", label: "Admins", icon: ShieldCheck }] : []),
];

const academics: NavItem[] = [
  { href: "/classes", label: "Classes", icon: Library },
  { href: "/results", label: "Results", icon: GraduationCap },
  { href: "/progress", label: "Teaching log", icon: NotebookPen },
];

/** Full menu: desktop sidebar and the "More" screen. */
export const MENU: Record<Role, NavGroup[]> = {
  super_admin: [
    { label: "Home", items: [{ href: "/home", label: "Overview", icon: LayoutDashboard }] },
    { label: "Money", items: [
      { href: "/finance", label: "Finance", icon: Banknote },
      { href: "/fees", label: "Fee status", icon: Wallet },
      { href: "/salaries", label: "Salaries", icon: Banknote },
    ] },
    { label: "Academics", items: academics },
    { label: "People", items: [...people("super_admin"), { href: "/people-status", label: "People status", icon: BarChart3 }] },
    { label: "Communication", items: [{ href: "/announcements", label: "Announcements", icon: Megaphone }, { href: "/notifications", label: "Notifications", icon: Bell }] },
    { label: "Academy", items: [
      { href: "/calendar", label: "Year & holidays", icon: CalendarDays },
      { href: "/subjects", label: "Subjects", icon: BookOpen },
      { href: "/reports", label: "Reports", icon: FileBarChart },
      { href: "/activity", label: "Activity log", icon: History },
      { href: "/settings", label: "Settings", icon: Settings },
    ] },
  ],
  admin: [
    { label: "Home", items: [{ href: "/home", label: "Dashboard", icon: LayoutDashboard }] },
    { label: "Academics", items: [...academics, { href: "/fees", label: "Fees", icon: Wallet }] },
    { label: "People", items: people("admin") },
    { label: "Communication", items: [{ href: "/announcements", label: "Announcements", icon: Megaphone }, { href: "/notifications", label: "Notifications", icon: Bell }] },
    { label: "Academy", items: [
      { href: "/calendar", label: "Year & holidays", icon: CalendarDays },
      { href: "/subjects", label: "Subjects", icon: BookOpen },
      { href: "/reports", label: "Reports", icon: FileBarChart },
      { href: "/activity", label: "Activity log", icon: History },
    ] },
  ],
  teacher: [
    { label: "Teaching", items: [
      { href: "/home", label: "Today", icon: Sun },
      { href: "/classes", label: "My classes", icon: Library },
      { href: "/results", label: "Results", icon: GraduationCap },
    ] },
    { label: "Me", items: [
      { href: "/my-progress", label: "My logs", icon: ListChecks },
      { href: "/my-salary", label: "Salary", icon: Banknote },
      { href: "/reports", label: "Reports", icon: FileBarChart },
    ] },
    { label: "Communication", items: [
      { href: "/announcements", label: "Announcements", icon: Megaphone },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/calendar", label: "Holidays", icon: CalendarDays },
    ] },
  ],
  parent: [
    { label: "My child", items: [
      { href: "/home", label: "Home", icon: Home },
      { href: "/results", label: "Results", icon: GraduationCap },
      { href: "/progress", label: "In class", icon: BookOpen },
      { href: "/homework", label: "Homework", icon: NotebookPen },
      { href: "/fees", label: "Fees", icon: Wallet },
    ] },
    { label: "Academy", items: [
      { href: "/announcements", label: "Announcements", icon: Megaphone },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/calendar", label: "Holidays", icon: CalendarDays },
    ] },
  ],
};

export function isActive(pathname: string, item: NavItem): boolean {
  const hit = (p: string) => pathname === p || pathname.startsWith(p + "/");
  return hit(item.href) || (item.match ?? []).some(hit);
}
