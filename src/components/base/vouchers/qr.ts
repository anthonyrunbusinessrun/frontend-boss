import QRCode from "qrcode";

/** Link a scanned QR code opens: the voucher record in this app. */
export const voucherLink = (origin: string, recordId: string) => `${origin}/vouchers?record=${encodeURIComponent(recordId)}`;

export async function qrDataUrl(text: string, width = 256): Promise<string> {
  return QRCode.toDataURL(text, { width, margin: 1, errorCorrectionLevel: "M" });
}

export async function qrBlob(text: string): Promise<Blob> {
  const url = await qrDataUrl(text, 320);
  return (await fetch(url)).blob();
}
