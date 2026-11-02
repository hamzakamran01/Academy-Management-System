import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { deleteAnnouncement, setPinned } from "@/server/modules/announcements";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { pinned } = await parseBody(req, z.object({ pinned: z.boolean() }));
  await setPinned(await apiCtx(), id, pinned);
});
export const DELETE = route<{ id: string }>(async (_req, { id }) => deleteAnnouncement(await apiCtx(), id));
