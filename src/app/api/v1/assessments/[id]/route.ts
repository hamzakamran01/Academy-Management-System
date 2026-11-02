import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { deleteDraftAssessment, getMarksSheet, updateAssessment } from "@/server/modules/results";
import { assessmentSchema } from "@/lib/schemas";

export const GET = route<{ id: string }>(async (_req, { id }) => getMarksSheet(await apiCtx(), id));
export const PATCH = route<{ id: string }>(async (req, { id }) =>
  updateAssessment(await apiCtx(), id, await parseBody(req, assessmentSchema.omit({ classSubjectId: true }).partial())),
);
export const DELETE = route<{ id: string }>(async (_req, { id }) => deleteDraftAssessment(await apiCtx(), id));
