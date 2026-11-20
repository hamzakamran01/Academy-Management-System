import Link from "next/link";
import { CheckCircle2, History, Phone, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, DescriptionList, ListCard, ListRow } from "@/components/ui/data";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { LinkTabs } from "@/components/ui/tabs";
import { todayPkt } from "@/lib/dates";
import { formatDate, formatDateTime, formatMoney, formatMonth, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getAcademy } from "@/server/modules/academy";
import { studentFeeRows, studentFeeSettings } from "@/server/modules/fees";
import { listClasses } from "@/server/modules/org";
import { getStudentProfile, studentActivity } from "@/server/modules/students";
import { studentResults } from "@/server/modules/results";
import { fmtMark } from "@/lib/grades";
import { StudentFeeEditor } from "../../fees/settings/fee-settings-client";
import { ParentRowActions, StudentActions } from "./student-actions";

export const metadata: Metadata = { title: "Student" };

const REASON: Record<string, string> = { left: "Left", completed: "Completed", transferred: "Transferred", expelled: "Expelled", other: "Other" };

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; added?: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await getStudentProfile(ctx, id).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  const admin = isStaffAdmin(ctx.role);
  const tab = (admin ? ["details", "results", "fees", "history"] : ["details", "results"]).includes(sp.tab ?? "") ? sp.tab! : "details";
  const tabs = [
    { key: "details", label: "Details", href: `/students/${id}` },
    { key: "results", label: "Results", href: `/students/${id}?tab=results` },
    ...(admin ? [{ key: "fees", label: "Fees", href: `/students/${id}?tab=fees` }] : []),
    ...(admin ? [{ key: "history", label: "History", href: `/students/${id}?tab=history` }] : []),
  ];

  const [academy, classes] = admin ? await Promise.all([getAcademy(ctx.academyId), listClasses(ctx)]) : [null, []];
  const [fee] = ctx.role === "super_admin" && tab === "fees" ? await studentFeeSettings(ctx, [id]) : [];
  const taking = s.subjects.filter((x) => !x.excluded);

  return (
    <>
      <PageHeader
        title={s.name}
        back="/students"
        actions={
          admin && (
            <StudentActions
              id={id}
              name={s.name}
              status={s.status}
              currentClassId={s.current?.classId ?? null}
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
              today={todayPkt()}
              canDelete={ctx.role === "super_admin"}
              academyName={academy!.name}
            />
          )
        }
      />

      {sp.added === "1" && (
        <Notice tone="success" icon={CheckCircle2} className="mb-4" title="Student added">
          The parent can sign in as soon as they set a password from the setup link.
        </Notice>
      )}

      <Card className="mb-4 overflow-hidden">
        <div className="h-16 bg-[linear-gradient(120deg,var(--primary-soft),var(--info-soft))]" aria-hidden />
        <CardBody className="-mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Avatar name={s.name} size="lg" className="ring-4 ring-surface" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-bold tracking-tight">{s.name}</p>
              <StatusBadge status={s.status} />
            </div>
            <p className="text-sm text-muted">
              {s.current ? `${s.current.className} · Roll ${s.current.rollNo}` : "Not in a class"} · {s.registrationNo}
            </p>
          </div>
        </CardBody>
      </Card>

      {s.status === "removed" && (
        <Notice tone="warning" className="mb-4" title={`Removed on ${formatDate(s.removedOn)} — ${REASON[s.removedReason ?? "other"]}`}>
          {s.removedNote ?? "History is kept. Re-admit to bring them back with the same registration number."}
        </Notice>
      )}

      <LinkTabs tabs={tabs} active={tab} />

      {tab === "details" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Profile" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Father / guardian", value: s.guardianName },
                  { label: "Gender", value: s.gender === "male" ? "Boy" : s.gender === "female" ? "Girl" : "Other" },
                  ...(s.dob ? [{ label: "Date of birth", value: formatDate(s.dob) }] : []),
                  { label: "Admitted", value: formatDate(s.admissionDate) },
                  ...(s.address ? [{ label: "Address", value: s.address }] : []),
                ]}
              />
              {s.notes && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-muted">{s.notes}</p>}
            </CardBody>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Parents" />
              <ListCard className="rounded-none border-x-0 border-b-0 shadow-none">
                {s.parents.map((p) => (
                  <ListRow
                    key={p.id}
                    leading={<Avatar name={p.name} size="sm" />}
                    title={
                      <span className="flex items-center gap-2">
                        {p.name}
                        <Badge className="capitalize">{p.relation}</Badge>
                      </span>
                    }
                    subtitle={
                      <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                        <Phone className="size-3.5" aria-hidden /> {formatPhone(p.phone)}
                        {p.invited ? " · invite pending" : p.lastActiveAt ? ` · active ${formatRelative(p.lastActiveAt)}` : ""}
                      </a>
                    }
                    trailing={
                      admin && (
                        <ParentRowActions
                          studentId={id}
                          parentId={p.id}
                          name={p.name}
                          phone={p.phone}
                          invited={p.invited}
                          academyName={academy!.name}
                          canUnlink={s.parents.length > 1}
                        />
                      )
                    }
                  />
                ))}
              </ListCard>
            </Card>
            {s.current && (
              <Card>
                <CardHeader title="Subjects" description={`${taking.length} of ${s.subjects.length} class subjects`} />
                <CardBody className="flex flex-wrap gap-2">
                  {s.subjects.map((x) => (
                    <Badge key={x.classSubjectId} tone={x.excluded ? "neutral" : "primary"} size="md" className={x.excluded ? "line-through opacity-70" : undefined}>
                      {x.name}
                    </Badge>
                  ))}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "results" && <ResultsTab data={await studentResults(ctx, id)} />}

      {tab === "fees" && (
        <div className="space-y-4">
          {ctx.role === "super_admin" && (
            <Card>
              <CardHeader title="Fee amounts" description={fee?.note ?? undefined} />
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                {fee ? (
                  <div className="space-y-1 text-sm">
                    <p>Monthly fee <strong className="tabular">{formatMoney(fee.monthlyFee)}</strong></p>
                    <p>Paper money <strong className="tabular">{fee.paperFee != null ? formatMoney(fee.paperFee) : "Not charged"}</strong></p>
                  </div>
                ) : <Badge tone="warning">Fee needed</Badge>}
                <StudentFeeEditor studentId={id} name={s.name} monthlyFee={fee?.monthlyFee} paperFee={fee?.paperFee} note={fee?.note} />
              </CardBody>
            </Card>
          )}
          <FeesTab rows={await studentFeeRows(ctx, id)} />
        </div>
      )}

      {tab === "history" && admin && <HistoryTab history={s.history} activity={await studentActivity(ctx, id)} />}
    </>
  );
}

function ResultsTab({ data }: { data: Awaited<ReturnType<typeof studentResults>> }) {
  if (!data.items.length) return <EmptyState icon={Receipt} title="No published results yet" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge tone="primary" size="md">Overall {data.overall ?? "—"}% · {data.overallGrade ?? "—"}</Badge>
        {data.subjects.map((s) => (
          <Badge key={s.subjectName} size="md">{s.subjectName} {s.average ?? "—"}%</Badge>
        ))}
      </div>
      <ListCard>
        {data.items.map((t) => (
          <ListRow
            key={t.assessmentId}
            href={`/results/${t.assessmentId}`}
            title={`${t.subjectName} · ${t.title}`}
            subtitle={`${formatDate(t.date)}${t.classAverage != null ? ` · class avg ${fmtMark(t.classAverage)}` : ""}${t.position != null ? ` · position ${t.position}/${t.outOf}` : ""}`}
            trailing={
              t.absent ? (
                <Badge>Absent</Badge>
              ) : (
                <span className="tabular text-sm font-semibold">
                  {fmtMark(t.value!)}/{fmtMark(t.totalMarks)} · {t.grade}
                </span>
              )
            }
          />
        ))}
      </ListCard>
    </div>
  );
}

function FeesTab({ rows }: { rows: Awaited<ReturnType<typeof studentFeeRows>> }) {
  if (!rows.length) return <EmptyState icon={Receipt} title="No fee records yet" description="Monthly fee records are created on the first of each month." />;
  return (
    <Card>
      <CardHeader title="Monthly payment history" />
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((record) => (
          <li key={record.id} className="px-4 py-4">
            <p className="font-semibold">{formatMonth(record.month)}</p>
            <p className="mt-0.5 text-xs text-muted">{record.className}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ChargeHistory label="Monthly fee" amount={record.amount} status={record.status} paidAt={record.status === "paid" ? record.markedAt : null}
                detail={record.status === "waived" ? record.waiveReason : record.markedByName} />
              {record.paperAmount != null && (
                <ChargeHistory label="Paper money" amount={record.paperAmount} status={record.paperPaidAt ? "paid" : "unpaid"} paidAt={record.paperPaidAt} />
              )}
            </div>
            {record.classId && (
              <Link href={`/fees/class/${record.classId}?month=${record.month}`} className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline">
                Open collection list
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ChargeHistory({ label, amount, status, paidAt, detail }: {
  label: string;
  amount?: number;
  status: "paid" | "unpaid" | "waived";
  paidAt?: Date | null;
  detail?: string | null;
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{label}{amount !== undefined && <> <strong className="tabular">{formatMoney(amount)}</strong></>}</span>
        <StatusBadge status={status} />
      </div>
      {(paidAt || detail) && <p className="mt-1 text-xs text-muted">
        {paidAt && `Paid on ${formatDate(paidAt.toISOString().slice(0, 10))}`}{detail && (paidAt ? ` · ${detail}` : detail)}
      </p>}
    </div>
  );
}

function HistoryTab({
  history,
  activity,
}: {
  history: { id: string; className: string; rollNo: string; fromDate: string; toDate: string | null }[];
  activity: { id: string; summary: string | null; at: Date; actorName: string | null }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Classes" />
        <ol className="relative mx-4 mb-4 border-s border-border">
          {history.map((h) => (
            <li key={h.id} className="ms-4 py-2">
              <span className={`absolute -start-1.5 mt-1.5 size-3 rounded-full ring-4 ring-surface ${h.toDate ? "bg-border-strong" : "bg-primary"}`} aria-hidden />
              <p className="font-medium">{h.className} · Roll {h.rollNo}</p>
              <p className="text-[13px] text-muted">
                {formatDate(h.fromDate)} – {h.toDate ? formatDate(h.toDate) : "now"}
              </p>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <CardHeader title="Activity" description="Every change, who made it and when" />
        {activity.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {activity.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <p className="text-sm">{a.summary}</p>
                <p className="text-xs text-muted">
                  {a.actorName ?? "System"} · {formatDateTime(a.at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={History} title="No changes recorded" className="py-8" />
        )}
      </Card>
    </div>
  );
}
