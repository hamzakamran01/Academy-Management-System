import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/server/db";
import { academicYears, academy, holidays } from "@/server/db/schema";
import { resolveSettings, type AcademySettings } from "@/lib/settings";
import type { Calendar } from "@/lib/dates";
import { ApiError } from "@/server/http";

export type AcademyInfo = { id: string; name: string; address: string | null; phone: string | null; logoKey: string | null; settings: AcademySettings };

export const getAcademy = cache(async (academyId: string): Promise<AcademyInfo> => {
  const [row] = await db.select().from(academy).where(eq(academy.id, academyId));
  if (!row) throw new ApiError(500, "NO_ACADEMY", "Academy not configured");
  return { id: row.id, name: row.name, address: row.address, phone: row.phone, logoKey: row.logoKey, settings: resolveSettings(row.settings) };
});

export const getSettings = async (academyId: string) => (await getAcademy(academyId)).settings;

export type CurrentYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  workingDays: number[];
  calendar: Calendar;
};

/** Current academic year with its holidays as a working-day Calendar. */
export const getCurrentYear = cache(async (academyId: string): Promise<CurrentYear | null> => {
  const [year] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.academyId, academyId), eq(academicYears.isCurrent, true)));
  if (!year) return null;
  const hols = await db
    .select({ name: holidays.name, startDate: holidays.startDate, endDate: holidays.endDate })
    .from(holidays)
    .where(eq(holidays.academicYearId, year.id))
    .orderBy(asc(holidays.startDate));
  return {
    id: year.id,
    name: year.name,
    startDate: year.startDate,
    endDate: year.endDate,
    workingDays: year.workingDays,
    calendar: { startDate: year.startDate, endDate: year.endDate, workingDays: year.workingDays, holidays: hols },
  };
});

export async function requireCurrentYear(academyId: string): Promise<CurrentYear> {
  const y = await getCurrentYear(academyId);
  if (!y) throw new ApiError(409, "NO_CURRENT_YEAR", "Set up the current academic year first");
  return y;
}
