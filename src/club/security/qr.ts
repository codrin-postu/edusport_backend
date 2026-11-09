/** The enrolment QR as an SVG string: the URL is encoded in the modules, never written as text. The library loads on first use. */
export async function qrSvg(text: string): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}
