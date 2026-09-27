import { isValidGreekVat, normalizeGreekVat } from "./greek-vat";

describe("Greek VAT number (ΑΦΜ)", () => {
  it("accepts a number with a correct check digit, with or without EL prefix and spaces", () => {
    expect(isValidGreekVat("123456783")).toBe(true);
    expect(isValidGreekVat("EL 123 456 783")).toBe(true);
    expect(normalizeGreekVat("el123456783")).toBe("123456783");
  });

  it("rejects wrong check digits, wrong lengths and all zeros", () => {
    expect(isValidGreekVat("123456789")).toBe(false);
    expect(isValidGreekVat("12345678")).toBe(false);
    expect(isValidGreekVat("000000000")).toBe(false);
    expect(isValidGreekVat("12345678A")).toBe(false);
  });
});
