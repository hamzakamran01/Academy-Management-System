import { BookOpenCheck, GraduationCap, ShieldCheck, Wallet } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand";

const POINTS = [
  { icon: GraduationCap, title: "Results in front of names", text: "Teachers type marks on their phone — parents see them instantly." },
  { icon: BookOpenCheck, title: "Teaching you can see", text: "Syllabus coverage, lesson logs and homework for every class." },
  { icon: Wallet, title: "Fees without paperwork", text: "Paid / Unpaid per student, with a clear money picture for the owner." },
  { icon: ShieldCheck, title: "Private by design", text: "Everyone sees only what their role allows." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — desktop */}
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(145deg,oklch(0.42_0.2_272),oklch(0.3_0.16_280))] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -end-32 -top-32 size-[28rem] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -start-20 size-[30rem] rounded-full bg-[oklch(0.65_0.18_250)]/25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="size-10 rounded-xl ring-1 ring-white/25" />
          <span className="text-xl font-bold tracking-tight">Campusly</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">The whole academy, truthfully, on every phone.</h1>
          <p className="mt-4 text-lg text-white/75">One connected record for owners, admins, teachers and parents.</p>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/15">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-white/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-sm text-white/50">© {new Date().getFullYear()} Campusly</p>
      </aside>

      {/* Form side */}
      <main className="flex min-h-dvh flex-col pt-safe">
        <div className="relative overflow-hidden bg-[linear-gradient(160deg,oklch(0.45_0.2_272),oklch(0.34_0.17_282))] px-6 pb-20 pt-10 text-white lg:hidden">
          <div className="pointer-events-none absolute -end-20 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-2.5">
            <LogoMark className="ring-1 ring-white/25 rounded-[11px]" />
            <span className="text-lg font-bold tracking-tight">Campusly</span>
          </div>
          <p className="relative mt-6 text-2xl font-bold leading-snug">Your academy,<br />in your pocket.</p>
        </div>
        <div className="relative z-10 -mt-12 flex flex-1 justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:px-12">
          <div className="w-full max-w-[420px]">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-raised sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              <Logo className="mb-8 hidden lg:flex" />
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
