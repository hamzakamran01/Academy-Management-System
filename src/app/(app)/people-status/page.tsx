import { ShieldCheck, UserRound, Users, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { TeacherSummaryGrid } from "@/components/teacher-summary";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { Avatar, ProgressBar, StatTile } from "@/components/ui/data";
import { formatDate, formatRelative } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { peopleStatus } from "@/server/modules/admin";

export const metadata: Metadata = { title: "People status" };
export const dynamic = "force-dynamic";

/** S-05 / FR-DSH-05 */
export default async function PeopleStatusPage() {
  const ctx = await requireCtx(["super_admin"]);
  const d = await peopleStatus(ctx);
  const parentPct = d.parents.total ? Math.round((d.parents.loggedIn / d.parents.total) * 100) : 0;
  return (
    <>
      <PageHeader title="People status" subtitle={`Last 4 weeks · ${formatDate(d.period.from)} – ${formatDate(d.period.to)}`} back="/more" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active students" value={d.students.active} sub={`${d.students.removed} removed overall`} icon={UsersRound} href="/students" />
        <StatTile label="Parents active" value={`${parentPct}%`} sub={`${d.parents.loggedIn} of ${d.parents.total}`} icon={UserRound} tone={parentPct >= 80 ? "success" : "warning"} href="/parents" />
        <StatTile label="Teachers" value={d.teachers.length} icon={Users} tone="info" href="/teachers" />
        <StatTile label="Admins" value={d.admins.length} icon={ShieldCheck} tone="neutral" href="/admins" />
      </div>
      <Card className="mb-5">
        <CardBody className="pt-4">
          <p className="mb-2 text-sm font-medium">Parent adoption (goal ≥ 80%)</p>
          <ProgressBar value={parentPct} marker={80} tone={parentPct >= 80 ? "success" : "warning"} label="Parents signed in" />
        </CardBody>
      </Card>

      <SectionTitle>Teachers</SectionTitle>
      <ul className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {d.teachers.map((t) => (
          <li key={t.id}>
            <Card>
              <Link href={`/teachers/${t.id}`} className="flex items-center gap-3 px-4 pt-4 hover:opacity-90">
                <Avatar name={t.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="text-[13px] text-muted">
                    {t.summary.subjects} subjects · {t.actions} actions this week{t.lastActiveAt ? ` · active ${formatRelative(t.lastActiveAt)}` : ""}
                  </p>
                </div>
              </Link>
              <CardBody className="pt-3">
                <TeacherSummaryGrid s={t.summary} compact />
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <SectionTitle>Admins</SectionTitle>
      <Card>
        <CardHeader title="Office staff" description="Last active and actions in the last 7 days" />
        <ul className="divide-y divide-border border-t border-border">
          {d.admins.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={a.name} size="sm" />
              <p className="min-w-0 flex-1 truncate font-medium">{a.name}</p>
              <span className="text-[13px] text-muted">{a.lastActiveAt ? formatRelative(a.lastActiveAt) : "never"}</span>
              <span className="tabular w-20 text-end text-sm font-semibold">{a.actions} actions</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
