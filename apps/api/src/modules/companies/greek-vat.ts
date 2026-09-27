/** Normalizes "EL 123 456 783" -> "123456783". */
export const normalizeGreekVat = (input: string) => input.replace(/\s/g, "").replace(/^EL/i, "");

/** Greek tax number (ΑΦΜ): 9 digits whose last is a mod-11 check digit. */
export function isValidGreekVat(input: string): boolean {
  const afm = normalizeGreekVat(input);
  if (!/^\d{9}$/.test(afm) || /^0+$/.test(afm)) return false;
  const digits = [...afm].map(Number);
  const sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * 2 ** (8 - i), 0);
  return (sum % 11) % 10 === digits[8];
}
