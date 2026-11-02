export type Role = "super_admin" | "admin" | "teacher" | "parent";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Owner",
  admin: "Admin",
  teacher: "Teacher",
  parent: "Parent",
};

/** Default role chosen at login when a person holds several. */
export const ROLE_PRIORITY: Role[] = ["super_admin", "admin", "teacher", "parent"];

export const isStaffAdmin = (r: Role) => r === "super_admin" || r === "admin";

/** Session lengths (FR-AUTH-05). */
export const SESSION_DAYS: Record<Role, number> = { super_admin: 7, admin: 14, teacher: 60, parent: 60 };
