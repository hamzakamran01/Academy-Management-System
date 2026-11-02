/**
 * Pakistani mobile number normalisation (BR-AUTH-01).
 * Accepts 03xx-xxxxxxx, 3xxxxxxxxx, +923xxxxxxxxx, 00923xxxxxxxxx (spaces/dashes ignored).
 * Returns E.164 (+923xxxxxxxxx) or null.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let rest: string | null = null;
  if (/^\+923\d{9}$/.test(digits)) rest = digits.slice(3);
  else if (/^00923\d{9}$/.test(digits)) rest = digits.slice(4);
  else if (/^923\d{9}$/.test(digits)) rest = digits.slice(2);
  else if (/^03\d{9}$/.test(digits)) rest = digits.slice(1);
  else if (/^3\d{9}$/.test(digits)) rest = digits;
  return rest ? `+92${rest}` : null;
}

export const PHONE_ERROR = "Enter a valid Pakistani mobile number";

/** +923001234567 → 0300 1234567 */
export function formatPhone(e164: string): string {
  const m = /^\+92(3\d{2})(\d{7})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]}` : e164;
}

/** Masked for logs (NFR-SEC-12): +92300*****67 */
export function maskPhone(e164: string): string {
  return e164.length > 8 ? `${e164.slice(0, 6)}*****${e164.slice(-2)}` : "***";
}

/** wa.me link digits (BR-AUTH-04): +923001234567 → 923001234567 */
export function whatsappLink(e164: string, message: string): string {
  return `https://wa.me/${e164.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`;
}
