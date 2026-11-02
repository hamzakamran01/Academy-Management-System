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
import { studentFeeRows } from "@/server/modules/fees";
import { listClasses } from "@/server/modules/org";
import { getStudentProfile, studentActivity } from "@/server/modules/students";
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
  const tab = ["details", "fees", "history"].includes(sp.tab ?? "") ? sp.tab! : "details";
  const tabs = [
    { key: "details", label: "Details", href: `/students/${id}` },
    { key: "fees", label: "Fees", href: `/students/${id}?tab=fees` },
    ...(admin ? [{ key: "history", label: "History", href: `/students/${id}?tab=history` }] : []),
  ];

  const [academy, classes] = admin ? await Promise.all([getAcademy(ctx.academyId), listClasses(ctx)]) : [null, []];
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
        <div className="grid gap-4 lg:grid-cols-2">
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

      {tab === "fees" && <FeesTab ctxRole={ctx.role} rows={await studentFeeRows(ctx, id)} />}

      {tab === "history" && admin && <HistoryTab history={s.history} activity={await studentActivity(ctx, id)} />}
    </>
  );
}

function FeesTab({ rows, ctxRole }: { rows: Awaited<ReturnType<typeof studentFeeRows>>; ctxRole: string }) {
  if (!rows.length) return <EmptyState icon={Receipt} title="No fee months yet" description="Monthly fee rows are created on the 1st of each month." />;
  return (
    <ListCard>
      {rows.map((r) => (
        <ListRow
          key={r.id}
          title={formatMonth(r.month)}
          subtitle={
            r.status === "paid" && r.markedAt
              ? `Paid ${formatDate(r.markedAt.toISOString().slice(0, 10))}${r.markedByName ? ` · by ${r.markedByName}` : ""}`
              : r.status === "waived"
                ? `Waived${r.waiveReason ? ` — ${r.waiveReason}` : ""}`
                : r.className
          }
          trailing={
            <div className="flex items-center gap-3">
              {r.amount !== undefined && ctxRole !== "teacher" && <span className="tabular text-sm font-semibold">{formatMoney(r.amount)}</span>}
              <StatusBadge status={r.status} />
            </div>
          }
        />
      ))}
    </ListCard>
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
    <div className="grid gap-4 lg:grid-cols-2">
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
