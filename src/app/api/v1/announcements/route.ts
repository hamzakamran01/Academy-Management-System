import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { zId } from "@/lib/validation";
import { createAnnouncement, listAnnouncements } from "@/server/modules/announcements";

const schema = z.object({
  title: z.string().trim().min(3, "Enter a title").max(120),
  body: z.string().trim().min(3, "Write the announcement").max(3000),
  audienceType: z.enum(["all", "parents", "teachers", "classes"]),
  classIds: z.array(zId).max(50).optional(),
  pinned: z.boolean().optional(),
});

export const GET = route(async () => listAnnouncements(await apiCtx()));
export const POST = route(async (req) => createAnnouncement(await apiCtx(), await parseBody(req, schema)));
