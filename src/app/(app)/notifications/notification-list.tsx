"use client";

import { Banknote, Bell, BookOpen, CheckCheck, GraduationCap, Megaphone, NotebookPen, Settings, Wallet, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";

type N = { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

const ICON: Record<string, LucideIcon> = {
  result: GraduationCap,
  homework: NotebookPen,
  fee: Wallet,
  announcement: Megaphone,
  plan: BookOpen,
  reminder: Bell,
  salary: Banknote,
  system: Settings,
};

export function NotificationList({ items }: { items: N[] }) {
  const router = useRouter();
  const [read, setRead] = useState<Set<string>>(new Set(items.filter((i) => i.readAt).map((i) => i.id)));
  const unread = items.filter((i) => !read.has(i.id)).length;
  const today = new Date().toDateString();
  const groups = [
    { label: "Today", items: items.filter((i) => new Date(i.createdAt).toDateString() === today) },
    { label: "Earlier", items: items.filter((i) => new Date(i.createdAt).toDateString() !== today) },
  ].filter((g) => g.items.length);

  async function open(n: N) {
    if (!read.has(n.id)) {
      setRead((r) => new Set(r).add(n.id));
      api("/notifications/read", { body: { ids: [n.id] } }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  return (
    <>
      {unread > 0 && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              setRead(new Set(items.map((i) => i.id)));
              await api("/notifications/read", { body: { ids: "all" } }).catch(() => {});
              router.refresh();
            }}
          >
            <CheckCheck aria-hidden /> Mark all read
          </Button>
        </div>
      )}
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
              {g.items.map((n) => {
                const Icon = ICON[n.type.split(".")[0]!] ?? Bell;
                const isUnread = !read.has(n.id);
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => open(n)} className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-start hover:bg-surface-2", isUnread && "bg-primary-soft/35")}>
                      <span className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl", isUnread ? "bg-primary text-primary-fg" : "bg-surface-3 text-muted")}>
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[15px] leading-5", isUnread ? "font-semibold" : "font-medium")}>{n.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-sm text-muted [overflow-wrap:anywhere]">{n.body}</span>
                        <span className="mt-1 block text-xs text-subtle">{formatRelative(n.createdAt)}</span>
                      </span>
                      {isUnread && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
