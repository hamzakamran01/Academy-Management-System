/**
 * Password rules shared by the server (enforced) and forms (live checklist).
 *
 * Everyone: at least 8 characters, not a common password.
 * Owners (super admin) — they can see all money and salaries — also need a
 * letter, a number and a symbol, and must not use their phone number.
 */

const COMMON = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "password123", "qwerty123", "11111111",
  "00000000", "abcd1234", "pakistan", "pakistan123", "iloveyou", "admin123", "welcome1", "87654321",
  "12341234", "asdf1234", "qwertyui", "1q2w3e4r", "pass1234", "letmein1", "11223344", "aa123456",
  "password@1", "pakistan@1", "admin@123", "abc@1234", "p@ssw0rd", "pass@123", "qwerty@1",
]);

export type PasswordRule = { label: string; ok: (pw: string) => boolean };

export function passwordRules(opts: { strong?: boolean; phone?: string } = {}): PasswordRule[] {
  const rules: PasswordRule[] = [{ label: "At least 8 characters", ok: (pw) => pw.length >= 8 }];
  if (opts.strong) {
    const tail = (opts.phone ?? "").replace(/\D/g, "").slice(-7);
    rules.push(
      { label: "A letter and a number", ok: (pw) => /[A-Za-z]/.test(pw) && /\d/.test(pw) },
      { label: "A symbol, like @ # $ ! or *", ok: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
    );
    if (tail.length === 7) rules.push({ label: "Not your phone number", ok: (pw) => !pw.replace(/\D/g, "").includes(tail) });
  }
  return rules;
}

/** First problem with the password, or null when it's acceptable. */
export function passwordProblem(password: string, opts: { strong?: boolean; phone?: string } = {}): string | null {
  if (password.length > 128) return "Use at most 128 characters";
  const failed = passwordRules(opts).find((r) => !r.ok(password));
  if (failed) {
    if (failed.label.startsWith("At least")) return "Use at least 8 characters";
    if (failed.label.startsWith("A letter")) return "Owner passwords need a letter and a number";
    if (failed.label.startsWith("A symbol")) return "Owner passwords need a symbol, like @ # $ ! or *";
    return "Don't use your phone number in your password";
  }
  if (COMMON.has(password.toLowerCase())) return "This password is too common — choose another";
  return null;
}
