/**
 * First-run seed: academy profile, current academic year and the first Super Admin.
 * Prints a one-time setup link where the owner sets their password.
 *
 *   npm run db:seed -- --phone 03001234567 --name "Owner Name" [--academy "Academy Name"] [--roles super_admin,admin,teacher,parent]
 *
 * Safe to re-run: reuses the academy and user, issues a fresh setup link.
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { and, eq, isNull } from "drizzle-orm";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { normalizePhone } from "../src/lib/phone";
import { hashToken, newToken } from "../src/server/auth/crypto";
import { connect } from "../src/server/db/connect";
import * as s from "../src/server/db/schema";

async function main() {
  const { values } = parseArgs({
    options: {
      phone: { type: "string" },
      name: { type: "string" },
      academy: { type: "string", default: "Kamran Maths and Science Academy" },
      roles: { type: "string", default: "super_admin" },
    },
  });
  const phone = normalizePhone(values.phone ?? process.env.SEED_PHONE ?? "");
  const name = values.name ?? process.env.SEED_NAME;
  const ALL = ["super_admin", "admin", "teacher", "parent"] as const;
  const roles = values.roles!.split(",").map((r) => r.trim()).filter((r): r is (typeof ALL)[number] => (ALL as readonly string[]).includes(r));
  if (!phone || !name || !roles.length) {
    console.error('Usage: npm run db:seed -- --phone 03001234567 --name "Owner Name" [--academy "Academy Name"]');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const conn = await connect(url, { max: 1 });
  const db = conn.db;

  try {
    const token = await db.transaction(async (tx) => {
      let [academy] = await tx.select().from(s.academy).limit(1);
      if (!academy) {
        [academy] = await tx.insert(s.academy).values({ name: values.academy!, settings: DEFAULT_SETTINGS }).returning();
        console.log(`✓ Academy created: ${academy!.name}`);
      }
      const academyId = academy!.id;

      const [year] = await tx
        .select()
        .from(s.academicYears)
        .where(and(eq(s.academicYears.academyId, academyId), eq(s.academicYears.isCurrent, true)));
      if (!year) {
        const now = new Date();
        const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        await tx.insert(s.academicYears).values({
          academyId,
          name: `${startYear}–${String(startYear + 1).slice(2)}`,
          startDate: `${startYear}-04-01`,
          endDate: `${startYear + 1}-03-31`,
          isCurrent: true,
        });
        console.log(`✓ Academic year ${startYear}–${String(startYear + 1).slice(2)} created and set as current`);
      }

      let [user] = await tx.select().from(s.users).where(eq(s.users.phone, phone));
      if (!user) {
        [user] = await tx.insert(s.users).values({ academyId, phone, name }).returning();
        console.log(`✓ User created: ${name} (${phone})`);
      }
      for (const role of roles) {
        await tx
          .insert(s.roleAssignments)
          .values({ userId: user!.id, role })
          .onConflictDoUpdate({ target: [s.roleAssignments.userId, s.roleAssignments.role], set: { active: true } });
      }
      console.log(`✓ Roles: ${roles.join(", ")}`);

      await tx
        .update(s.setupTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(s.setupTokens.userId, user!.id), isNull(s.setupTokens.usedAt)));
      const raw = newToken();
      await tx.insert(s.setupTokens).values({
        userId: user!.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      });
      return raw;
    });

    const base = process.env.APP_URL ?? "http://localhost:3000";
    console.log("\n  Setup link (valid 7 days, single use):");
    console.log(`  ${base}/setup/${token}\n`);
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error("✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
