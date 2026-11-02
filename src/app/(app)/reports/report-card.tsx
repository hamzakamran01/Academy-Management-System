"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatMonth } from "@/lib/format";

type Opt = { id: string; name: string };

export function ReportCard({
  reportKey,
  title,
  description,
  needs,
  classes,
  months,
  classSubjects,
}: {
  reportKey: string;
  title: string;
  description: string;
  needs: ("class" | "month" | "classSubject")[];
  classes: Opt[];
  months: string[];
  classSubjects: Opt[];
}) {
  const [classId, setClassId] = useState("");
  const [month, setMonth] = useState(months[0] ?? "");
  const [cs, setCs] = useState("");
  const missing = (needs.includes("classSubject") && !cs) || (reportKey === "fee-status" && !classId);
  const qs = new URLSearchParams({ format: "xlsx" });
  if (needs.includes("class") && classId) qs.set("classId", classId);
  if (needs.includes("month") && month) qs.set("month", month);
  if (needs.includes("classSubject") && cs) qs.set("classSubjectId", cs);

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-fg">
          <FileSpreadsheet className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-[13px] text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {needs.includes("class") && (
          <Select aria-label="Class" className="h-10 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{reportKey === "fee-status" ? "Choose class" : "All classes"}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}
        {needs.includes("month") && (
          <Select aria-label="Month" className="h-10 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </Select>
        )}
        {needs.includes("classSubject") && (
          <Select aria-label="Subject" className="h-10 text-sm" value={cs} onChange={(e) => setCs(e.target.value)}>
            <option value="">Choose subject</option>
            {classSubjects.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}
      </div>
      <a
        href={missing ? undefined : `/api/v1/reports/${reportKey}?${qs}`}
        aria-disabled={missing}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-3", missing && "pointer-events-none opacity-50")}
        download
      >
        <FileSpreadsheet aria-hidden /> Download Excel
      </a>
    </Card>
  );
}
