import { z } from "zod";
import { zDate, zId, zName } from "./validation";

/** Request schemas shared between client forms and API routes. */
export const classSchema = z.object({
  name: z.string().trim().min(1, "Enter a class name").max(60),
  level: z.coerce.number().int().min(0).max(99),
  shift: z.string().max(30).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(500).optional().nullable(),
  classTeacherId: zId.optional().nullable(),
  subjectIds: z.array(zId).max(30).optional(),
});

const optText = (max: number) => z.string().trim().max(max).optional().nullable();

export const parentSchema = z.object({
  phone: z.string().trim().min(1, "Enter a mobile number"),
  name: optText(120),
  relation: z.enum(["father", "mother", "guardian"]),
});

export const studentSchema = z.object({
  name: zName,
  guardianName: zName,
  gender: z.enum(["male", "female", "other"]),
  dob: zDate.optional().nullable().or(z.literal("").transform(() => null)),
  address: optText(300),
  notes: optText(1000),
  admissionDate: zDate,
  classId: zId,
  rollNo: z.string().trim().max(10).optional().nullable(),
  excludedClassSubjectIds: z.array(zId).max(30).optional(),
  parents: z.array(parentSchema).min(1, "Add at least one parent").max(2, "At most 2 parents"),
});

export const studentUpdateSchema = studentSchema
  .omit({ classId: true, parents: true, rollNo: true })
  .partial()
  .extend({ rollNo: z.string().trim().min(1).max(10).optional() });

export const moveSchema = z.object({ classId: zId, date: zDate, rollNo: z.string().trim().max(10).optional().nullable() });

export const removeSchema = z.object({
  reason: z.enum(["left", "completed", "transferred", "expelled", "other"]),
  note: optText(300),
  date: zDate,
});

export const assessmentSchema = z.object({
  classSubjectId: zId,
  type: z.enum(["weekly", "monthly", "midterm", "final", "other"]),
  title: z.string().trim().min(2, "Enter a title").max(80),
  date: zDate,
  totalMarks: z.number({ error: "Enter total marks" }).positive("Must be more than 0").max(1000),
  chapterIds: z.array(zId).max(50).optional(),
});
