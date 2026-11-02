import { PersonDetail } from "@/components/person-detail";
import { requireCtx } from "@/server/auth/session";

export default async function AdminPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(["super_admin"]);
  return <PersonDetail ctx={ctx} id={(await params).id} role="admin" back="/admins" />;
}
