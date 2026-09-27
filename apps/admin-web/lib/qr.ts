import qrcode from "qrcode-generator";

/**
 * A QR code for a URL, as an SVG string. Drawn locally in the browser: no
 * third-party QR service ever sees the codes.
 */
export function qrSvg(text: string): string {
  const qr = qrcode(0, "M"); // auto size, ~15% error correction (survives smudged posters)
  qr.addData(text);
  qr.make();
  return qr.createSvgTag(4, 2);
}
