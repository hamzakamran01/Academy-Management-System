import { BookOpen, CheckCircle2, ChevronRight, GraduationCap, Hourglass, Megaphone, MinusCircle, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChildSwitcher } from "@/components/child-switcher";
import { LogBody } from "@/components/teaching-log";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/data";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { addDays, todayPkt } from "@/lib/dates";
import { formatDate, formatMoney, formatMonth, formatPercent, formatRelative } from "@/lib/format";
import { fmtMark } from "@/lib/grades";
import type { parentDashboard } from "@/server/modules/dashboards";

type D = Awaited<ReturnType<typeof parentDashboard>>;

/** How many subjects the home shows under "What was taught" — the rest are one tap away. */
const CLASS_PREVIEW = 4;

/**
 * Parent home, built for people who rarely use apps: one child at a time,
 * two big answers first (fee paid? latest marks?), then what was taught and
 * the latest academy notice. Plain words, large tap targets, nothing else.
 */
export function ParentHome({ d }: { d: D }) {
  if (!d.child) return <EmptyState icon={GraduationCap} title="No active students linked" description="Contact the academy office if this is a mistake." />;
  const child = d.child;
  const today = todayPkt();
  const r = d.latestResult;
  const fee = d.feeThisMonth;
  const monthName = formatMonth(today).split(" ")[0];
  const recent = d.recentClass.slice(0, CLASS_PREVIEW);

  return (
    <div className="space-y-6">
      <div>
        <ChildSwitcher kids={d.kids} active={child.id} basePath="/home" />
        <Card className="flex items-center gap-4 p-4">
          <Avatar name={child.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-6">{child.name}</p>
            <p className="mt-0.5 truncate text-sm text-muted">
              {child.className ?? "—"}
              {child.rollNo ? ` · Roll no. ${child.rollNo}` : ""}
            </p>
          </div>
        </Card>
      </div>

      {child.readOnly && <Notice tone="warning">{child.name} has left the academy. You can view their records for 30 days.</Notice>}

      {/* The two questions every parent opens the app for */}
      <section aria-labelledby="glance-title">
        <SectionTitle>
          <span id="glance-title">At a glance</span>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <GlanceTile href="/fees" icon={Wallet} label={`${monthName} fee`} cta="View fees">
            {fee ? (
              <>
                <FeeStatus status={fee.status} />
                <p className="tabular mt-1 text-[13px] text-muted">
                  {formatMoney(fee.amount)}
                  {fee.status === "paid" && fee.markedAt ? ` · ${formatDate(fee.markedAt.toISOString().slice(0, 10)).slice(0, 6)}` : ""}
                </p>
              </>
            ) : (
              <p className="text-[15px] font-semibold text-muted">Not issued yet</p>
            )}
            {d.unpaidMonths > 1 && (
              <Badge tone="danger" className="mt-2">
                {d.unpaidMonths} months unpaid
              </Badge>
            )}
          </GlanceTile>

          <GlanceTile href={`/results?student=${child.id}`} icon={GraduationCap} label="Latest test" cta="All results">
            {r ? (
              <>
                <p className="tabular text-2xl font-bold leading-8">
                  {r.absent ? "Absent" : fmtMark(r.value!)}
                  {!r.absent && <span className="text-base font-medium text-muted">/{fmtMark(r.totalMarks)}</span>}
                </p>
                <p className="mt-1 truncate text-[13px] text-muted">
                  {r.subjectName}
                  {r.pct != null && ` · ${r.pct}%`}
                </p>
                {d.overall != null && (
                  <p className="mt-1 text-[13px] text-muted">
                    Year average <span className="tabular font-semibold text-fg">{formatPercent(d.overall)}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-[15px] font-semibold text-muted">No results yet</p>
            )}
          </GlanceTile>
        </div>
      </section>

      <section aria-labelledby="taught-title">
        <SectionTitle>
          <span id="taught-title">What was taught</span>
        </SectionTitle>
        <Card className="overflow-hidden">
          {recent.length ? (
            <ul className="divide-y divide-border">
              {recent.map((s) => (
                <li key={s.subjectName} className="px-4 py-3.5">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[15px] font-semibold">{s.subjectName}</p>
                    <DayChip date={s.entry.date} today={today} />
                  </div>
                  <LogBody log={s.entry} clamp />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 px-4 py-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                <BookOpen className="size-5" aria-hidden />
              </span>
              <p className="text-sm text-muted">No class updates in the last few days.</p>
            </div>
          )}
          <Link
            href={`/progress?student=${child.id}`}
            className="flex h-12 items-center justify-center gap-1 border-t border-border text-sm font-semibold text-primary transition-colors hover:bg-surface-2 active:bg-surface-3"
          >
            {d.recentClass.length > CLASS_PREVIEW ? `See all ${d.recentClass.length} subjects` : "See all classwork & homework"}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Card>
      </section>

      {d.announcement && (
        <section aria-labelledby="news-title">
          <SectionTitle>
            <span id="news-title">From the academy</span>
          </SectionTitle>
          <Link
            href={`/announcements#a-${d.announcement.id}`}
            className="group flex items-start gap-3.5 rounded-xl border border-border bg-surface p-4 shadow-card transition-[background-color,transform] hover:bg-surface-2 active:scale-[0.99]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
              <Megaphone className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold [overflow-wrap:anywhere]">{d.announcement.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted [overflow-wrap:anywhere]">{d.announcement.body}</p>
              <p className="mt-1.5 text-xs text-subtle">{formatRelative(d.announcement.publishedAt)}</p>
            </div>
            <ChevronRight className="mt-2.5 size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </section>
      )}
    </div>
  );
}

/** A big, tappable answer card: icon + label, the answer, then a clear "go" line at the bottom. */
function GlanceTile({ href, icon: Icon, label, cta, children }: { href: string; icon: LucideIcon; label: string; cta: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 shadow-card transition-[background-color,transform] hover:bg-surface-2 active:scale-[0.985]"
    >
      <span className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-muted">{label}</span>
      </span>
      <span className="mt-3 block flex-1">{children}</span>
      <span className="mt-3 inline-flex items-center gap-0.5 text-[13px] font-semibold text-primary">
        {cta}
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

/** Fee status as a large word with an icon — readable at a glance, never colour alone. */
function FeeStatus({ status }: { status: string }) {
  const s =
    status === "paid"
      ? { label: "Paid", icon: CheckCircle2, cls: "text-success-fg" }
      : status === "waived"
        ? { label: "Waived", icon: MinusCircle, cls: "text-muted" }
        : { label: "Unpaid", icon: Hourglass, cls: "text-warning-fg" };
  const Icon = s.icon;
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-xl font-bold leading-8", s.cls)}>
      <Icon className="size-5" aria-hidden />
      {s.label}
    </p>
  );
}

function DayChip({ date, today }: { date: string; today: string }) {
  const label = date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : formatDate(date).slice(0, 6);
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", date === today ? "bg-primary-soft text-primary-soft-fg" : "bg-surface-2 text-muted")}>
      {label}
    </span>
  );
}
