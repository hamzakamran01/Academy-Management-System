import { z } from "zod";

/** Academy settings (SRS §6.11.2). Defaults per PRD Appendix B. */

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

export const gradeRowSchema = z.object({
  minPercent: z.number().min(0).max(100),
  grade: z.string().min(1).max(4),
  remark: z.string().max(40).optional(),
});

export const settingsSchema = z.object({
  registrationPrefix: z.string().regex(/^[A-Z]{1,5}$/, "1–5 capital letters"),
  gradeScale: z.array(gradeRowSchema).min(1),
  passPercent: z.number().min(0).max(100),
  showClassAverageToParents: z.boolean(),
  showPositionToParents: z.boolean(),
  showProgressStatusToParents: z.boolean(),
  teacherCanEditSyllabus: z.boolean(),
  feeRowOnJoin: z.boolean(),
  notifyParentOnPaid: z.boolean(),
  feeReminderEnabled: z.boolean(),
  feeReminderDay: z.number().int().min(1).max(28),
  attendanceReminderTime: time,
  notifyLate: z.boolean(),
  weeklyPlanDeadline: z.object({ weekday: z.number().int().min(1).max(7), time }),
  lessonLogReminderTime: time,
  progressThresholds: z.object({ atRisk: z.number().min(0).max(100), behind: z.number().min(0).max(100) }),
});

export type AcademySettings = z.infer<typeof settingsSchema>;
export type GradeRow = z.infer<typeof gradeRowSchema>;

export const DEFAULT_SETTINGS: AcademySettings = {
  registrationPrefix: "CL",
  gradeScale: [
    { minPercent: 90, grade: "A+" },
    { minPercent: 80, grade: "A" },
    { minPercent: 70, grade: "B" },
    { minPercent: 60, grade: "C" },
    { minPercent: 50, grade: "D" },
    { minPercent: 40, grade: "E" },
    { minPercent: 0, grade: "F" },
  ],
  passPercent: 40,
  showClassAverageToParents: true,
  showPositionToParents: false,
  showProgressStatusToParents: false,
  teacherCanEditSyllabus: false,
  feeRowOnJoin: true,
  notifyParentOnPaid: true,
  feeReminderEnabled: false,
  feeReminderDay: 10,
  attendanceReminderTime: "11:00",
  notifyLate: false,
  weeklyPlanDeadline: { weekday: 1, time: "10:00" },
  lessonLogReminderTime: "18:00",
  progressThresholds: { atRisk: 5, behind: 15 },
};

/** Merge stored (possibly older/partial) settings with defaults so new keys never crash old data. */
export function resolveSettings(stored: unknown): AcademySettings {
  const merged = { ...DEFAULT_SETTINGS, ...(typeof stored === "object" && stored ? stored : {}) };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
