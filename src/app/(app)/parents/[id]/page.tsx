import { PersonDetail } from "@/components/person-detail";
import { requireCtx } from "@/server/auth/session";

export default async function ParentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin"]);
  return <PersonDetail ctx={ctx} id={(await params).id} role="parent" back="/parents" />;
}
