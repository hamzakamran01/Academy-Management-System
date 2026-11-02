import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { requireCtx } from "@/server/auth/session";
import { monthOptions } from "@/server/modules/fees";
import { listClasses } from "@/server/modules/org";
import { REPORTS } from "@/server/modules/reports";
import { classSubjectOptions } from "@/server/modules/results";
import { ReportCard } from "./report-card";

export const metadata: Metadata = { title: "Reports" };

/** A-17 / FR-DSH-06: role-scoped Excel exports. */
export default async function ReportsPage() {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const [classes, months, css] = await Promise.all([listClasses(ctx), monthOptions(ctx.academyId), classSubjectOptions(ctx)]);
  const mine = REPORTS.filter((r) => r.roles.includes(ctx.role));
  return (
    <>
      <PageHeader title="Reports" subtitle="Download as Excel — the same data you can see on screen" back="/more" />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {mine.map((r) => (
          <li key={r.key}>
            <ReportCard
              reportKey={r.key}
              title={r.title}
              description={r.description}
              needs={r.needs}
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
              months={months}
              classSubjects={css.map((c) => ({ id: c.id, name: `${c.subjectName} · ${c.className}` }))}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
