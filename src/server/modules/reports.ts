import "server-only";
import ExcelJS from "exceljs";
import type { Ctx } from "@/server/auth/session";
import { formatDate, formatMonth, formatPercent } from "@/lib/format";
import { fmtMark } from "@/lib/grades";

import { badRequest, forbidden } from "@/server/http";
import { getAcademy } from "./academy";
import { classFeeList, financeSummary, unpaidMultiple } from "./fees";
import { progressDashboard } from "./progress";
import { subjectResultSheet } from "./results";
import { salariesOverview } from "./salaries";
import { listStudents } from "./students";

export type ReportKey = "students" | "fee-status" | "unpaid" | "result-sheet" | "teaching-progress" | "finance" | "salaries";
type Params = { classId?: string; month?: string; classSubjectId?: string };
type Table = { title: string; subtitle: string; columns: { header: string; width?: number; numFmt?: string }[]; rows: (string | number | null)[][] };

export const REPORTS: { key: ReportKey; title: string; description: string; roles: Ctx["role"][]; needs: ("class" | "month" | "classSubject")[] }[] = [
  { key: "students", title: "Student list", description: "Roll, reg. no., guardian and parent phone by class", roles: ["super_admin", "admin", "teacher"], needs: ["class"] },
  { key: "fee-status", title: "Fee status by class", description: "Paid / unpaid per student for a month", roles: ["super_admin", "admin", "teacher"], needs: ["class", "month"] },
  { key: "unpaid", title: "Unpaid 2+ months", description: "Students to follow up with months owed", roles: ["super_admin", "admin"], needs: [] },
  { key: "result-sheet", title: "Result sheet", description: "Students × published tests for one subject", roles: ["super_admin", "admin", "teacher"], needs: ["classSubject"] },
  { key: "teaching-progress", title: "Teaching progress", description: "Coverage vs expected for every class subject", roles: ["super_admin", "admin"], needs: [] },
  { key: "finance", title: "Finance summary", description: "Expected, recovered and pending by class", roles: ["super_admin"], needs: ["month"] },
  { key: "salaries", title: "Salaries", description: "Salary bill and paid status for a month", roles: ["super_admin"], needs: ["month"] },
];

/** Builds a report table using the same services (and scoping/DTO rules) as the screens (BR-DSH-02). */
export async function buildReport(ctx: Ctx, key: ReportKey, p: Params): Promise<Table> {
  const def = REPORTS.find((r) => r.key === key);
  if (!def) throw badRequest("BAD_REPORT", "Unknown report");
  if (!def.roles.includes(ctx.role)) throw forbidden();
  const month = p.month ?? "";
  switch (key) {
    case "students": {
      const { items } = await listStudents(ctx, { classId: p.classId, status: "active", limit: 200 });
      return {
        title: "Student list",
        subtitle: items[0]?.className && p.classId ? items[0].className : "All classes",
        columns: [{ header: "Class", width: 22 }, { header: "Roll", width: 6 }, { header: "Name", width: 26 }, { header: "Reg. no.", width: 14 }, { header: "Father / guardian", width: 24 }, { header: "Parent phone", width: 16 }],
        rows: items.map((s) => [s.className, s.rollNo, s.name, s.registrationNo, s.guardianName, s.parentPhone]),
      };
    }
    case "fee-status": {
      if (!p.classId || !month) throw badRequest("MISSING", "Choose a class and month");
      const d = await classFeeList(ctx, p.classId, month);
      const amounts = ctx.role !== "teacher";
      return {
        title: `Fee status — ${d.class.name}`,
        subtitle: `${formatMonth(month)} · Paid ${d.counts.paid} · Unpaid ${d.counts.unpaid} · Waived ${d.counts.waived}`,
        columns: [{ header: "Roll", width: 6 }, { header: "Student", width: 26 }, ...(amounts ? [{ header: "Amount (Rs)", width: 12, numFmt: "#,##0" }] : []), { header: "Status", width: 10 }, { header: "Paid on", width: 14 }, { header: "Marked by", width: 20 }],
        rows: d.rows.map((r) => [r.rollNo, r.name, ...(amounts ? [r.amount ?? null] : []), r.status, r.markedAt ? formatDate(r.markedAt.toISOString().slice(0, 10)) : "", r.markedByName ?? ""]),
      };
    }
    case "unpaid": {
      const rows = await unpaidMultiple(ctx);
      const amounts = ctx.role === "super_admin";
      return {
        title: "Unpaid 2+ months",
        subtitle: `${rows.length} students`,
        columns: [{ header: "Student", width: 26 }, { header: "Reg. no.", width: 14 }, { header: "Class", width: 22 }, { header: "Months", width: 8 }, { header: "Which", width: 36 }, ...(amounts ? [{ header: "Owed (Rs)", width: 12, numFmt: "#,##0" }] : [])],
        rows: rows.map((r) => [r.name, r.registrationNo, r.className, r.months.length, r.months.map((m) => formatMonth(m, true)).join(", "), ...(amounts && "amount" in r ? [r.amount as number] : [])]),
      };
    }
    case "result-sheet": {
      if (!p.classSubjectId) throw badRequest("MISSING", "Choose a subject");
      const s = await subjectResultSheet(ctx, p.classSubjectId);
      return {
        title: `${s.subjectName} result sheet — ${s.className}`,
        subtitle: `${s.tests.length} published tests`,
        columns: [{ header: "Roll", width: 6 }, { header: "Student", width: 26 }, ...s.tests.map((t) => ({ header: `${t.title} (/${fmtMark(t.totalMarks)})`, width: 14 })), { header: "Average %", width: 11 }],
        rows: s.students.map((st) => [st.rollNo, st.name, ...st.cells.map((c) => (c == null ? null : c.absent ? "A" : c.value)), st.average]),
      };
    }
    case "teaching-progress": {
      const rows = await progressDashboard(ctx);
      return {
        title: "Teaching progress",
        subtitle: `As of ${formatDate(new Date().toISOString().slice(0, 10))}`,
        columns: [{ header: "Class", width: 22 }, { header: "Subject", width: 18 }, { header: "Teacher", width: 20 }, { header: "Covered %", width: 11 }, { header: "Expected %", width: 11 }, { header: "Status", width: 12 }, { header: "Remaining topics", width: 10 }, { header: "Last log", width: 14 }, { header: "Plan this week", width: 12 }],
        rows: rows.map((r) => [r.className, r.subjectName, r.teacherName, r.progress.coverage, r.progress.expected, r.progress.status.replace("_", " "), r.progress.remainingTopics, r.lastLog ? formatDate(r.lastLog) : "never", r.planStatus ?? "missing"]),
      };
    }
    case "finance": {
      if (!month) throw badRequest("MISSING", "Choose a month");
      const f = await financeSummary(ctx, month);
      return {
        title: "Finance summary",
        subtitle: `${formatMonth(month)} · Expected Rs ${f.expected.toLocaleString("en-PK")} · Recovered Rs ${f.recovered.toLocaleString("en-PK")} · ${formatPercent(f.recoveryPct)}`,
        columns: [{ header: "Class", width: 24 }, { header: "Students", width: 10 }, { header: "Expected (Rs)", width: 14, numFmt: "#,##0" }, { header: "Recovered (Rs)", width: 14, numFmt: "#,##0" }, { header: "Pending (Rs)", width: 14, numFmt: "#,##0" }, { header: "Unpaid", width: 8 }],
        rows: [...f.byClass.map((c) => [c.name, c.students, c.expected, c.recovered, c.pending, c.unpaidCount]), ["Total", f.counts.total, f.expected, f.recovered, f.pending, f.counts.unpaid]],
      };
    }
    case "salaries": {
      if (!month) throw badRequest("MISSING", "Choose a month");
      const s = await salariesOverview(ctx, month);
      return {
        title: "Salaries",
        subtitle: `${formatMonth(month)} · Bill Rs ${s.totals.bill.toLocaleString("en-PK")} · Paid Rs ${s.totals.paid.toLocaleString("en-PK")}`,
        columns: [{ header: "Name", width: 24 }, { header: "Role", width: 12 }, { header: "Monthly salary (Rs)", width: 16, numFmt: "#,##0" }, { header: "This month (Rs)", width: 16, numFmt: "#,##0" }, { header: "Status", width: 10 }, { header: "Paid on", width: 14 }],
        rows: s.items.map((i) => [i.name, i.roles.includes("teacher") ? "Teacher" : "Admin", i.salary, i.row?.amount ?? null, i.row?.status ?? "—", i.row?.paidOn ? formatDate(i.row.paidOn) : ""]),
      };
    }
  }
}

export async function reportXlsx(ctx: Ctx, key: ReportKey, p: Params): Promise<{ buffer: Buffer; filename: string }> {
  const t = await buildReport(ctx, key, p);
  const { name } = await getAcademy(ctx.academyId);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Campusly";
  wb.created = new Date();
  const ws = wb.addWorksheet(t.title.slice(0, 31), { views: [{ state: "frozen", ySplit: 4 }] });
  ws.addRow([name]).font = { bold: true, size: 14 };
  ws.addRow([t.title]).font = { bold: true, size: 12 };
  ws.addRow([t.subtitle]).font = { color: { argb: "FF5B6075" } };
  const header = ws.addRow(t.columns.map((c) => c.header));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F52D6" } }));
  for (const r of t.rows) ws.addRow(r);
  t.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width ?? 14;
    if (c.numFmt) col.numFmt = c.numFmt;
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: t.columns.length } };
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const slug = `${t.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { buffer, filename: `campusly-${slug}${p.month ? `-${p.month.slice(0, 7)}` : ""}.xlsx` };
}

