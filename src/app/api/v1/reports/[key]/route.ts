import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseQuery, route } from "@/server/http";
import { buildReport, reportXlsx, type ReportKey } from "@/server/modules/reports";
import { zId, zMonth } from "@/lib/validation";

const query = z.object({
  format: z.enum(["json", "xlsx"]).default("json"),
  classId: zId.optional(),
  month: zMonth.optional(),
  classSubjectId: zId.optional(),
});

/** GET /reports/{key}?format=xlsx|json — same scoping and DTO rules as the screens (BR-DSH-02). */
export const GET = route<{ key: string }>(async (req, { key }) => {
  const ctx = await apiCtx();
  const { format, ...p } = parseQuery(req, query);
  if (format === "json") return buildReport(ctx, key as ReportKey, p);
  const { buffer, filename } = await reportXlsx(ctx, key as ReportKey, p);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
