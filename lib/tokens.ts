/**
 * Utility to extract clean barcode token from raw QR code text, URL, or manual input.
 *
 * Supported formats:
 * - Full URL: "http://localhost:3000/p/CB7D4278" -> "CB7D4278"
 * - Secure URL: "https://mrs-mai.com/p/CB7D4278?src=qr" -> "CB7D4278"
 * - Relative URL: "/p/CB7D4278" -> "CB7D4278"
 * - Plain token: "CB7D4278" or "cb7d4278" -> "CB7D4278"
 * - Legacy student ID: "#142" or "142" -> "142"
 */
export function extractBarcodeToken(input: string): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();

  // 1. Matches .../p/TOKEN where TOKEN is alphanumeric or dash
  const matchP = trimmed.match(/(?:^|\/)p\/([A-Za-z0-9_-]+)/i);
  if (matchP && matchP[1]) {
    return matchP[1].trim().toUpperCase();
  }

  // 2. If it's a full URL, extract last path segment
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        return segments[segments.length - 1].trim().toUpperCase();
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  // 3. Strip leading '#' if someone enters e.g. "#101"
  return trimmed.replace(/^#/, '').trim().toUpperCase();
}
