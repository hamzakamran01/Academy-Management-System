import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/data";
import { diffDays, todayPkt, workingDaysBetween, addDays } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { getCurrentYear } from "@/server/modules/academy";
import { listHolidays } from "@/server/modules/org";
import { Holidays, WorkingDays } from "./calendar-client";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const ctx = await requireCtx();
  const year = await getCurrentYear(ctx.academyId);
  if (!year) return <EmptyState icon={CalendarDays} title="No academic year" description="The academy hasn't set up the current year yet." />;
  const holidays = await listHolidays(ctx.academyId);
  const admin = isStaffAdmin(ctx.role);
  const today = todayPkt();

  const totalDays = diffDays(year.startDate, year.endDate) + 1;
  const elapsed = Math.min(totalDays, Math.max(0, diffDays(year.startDate, today) + 1));
  const before = addDays(year.startDate, -1);
  const workingTotal = workingDaysBetween(year.calendar, before, year.endDate);
  const workingDone = workingDaysBetween(year.calendar, before, today < year.endDate ? today : year.endDate);

  return (
    <>
      <PageHeader title={admin ? "Year & holidays" : "Holidays"} subtitle={`Academic year ${year.name}`} back="/more" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Card>
            <CardBody className="pt-4">
              <p className="text-sm text-muted">Academic year</p>
              <p className="text-2xl font-bold tracking-tight">{year.name}</p>
              <p className="text-sm text-muted">
                {formatDate(year.startDate)} – {formatDate(year.endDate)}
              </p>
              <ProgressBar className="mt-4" value={(elapsed / totalDays) * 100} label="Year elapsed" />
              <div className="mt-2 flex justify-between text-[13px] text-muted">
                <span className="tabular">{workingDone} of {workingTotal} working days done</span>
                <span className="tabular">{Math.round((elapsed / totalDays) * 100)}%</span>
              </div>
            </CardBody>
          </Card>
          {admin && <WorkingDays yearId={year.id} initial={year.workingDays} editable={admin} />}
        </div>
        <Holidays holidays={holidays.map((h) => ({ id: h.id, name: h.name, startDate: h.startDate, endDate: h.endDate }))} editable={admin} today={today} />
      </div>
    </>
  );
}
