const MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٫': '.', '٬': ',',
};

export const normalizeDigits = (s: string) => s.replace(/[٠-٩۰-۹٫٬]/g, (c) => MAP[c] ?? c);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function dateForms(iso: string): string[] {
  const [y, m, d] = iso.split('-');
  const dn = String(Number(d));
  const mn = String(Number(m));
  return [iso, `${d}/${m}/${y}`, `${d}-${m}-${y}`, `${dn}/${mn}/${y}`, `${dn}-${mn}-${y}`, `${y}/${m}/${d}`];
}

export function appearsIn(
  markdown: string,
  field: 'vendor' | 'date' | 'subtotal' | 'vat' | 'total',
  value: string | number,
): boolean {
  const text = normalizeDigits(markdown);
  if (field === 'vendor') {
    // Normalize vendor value: trim, lowercase, collapse spaces, normalize digits
    const s = normalizeDigits(String(value).trim().toLowerCase().replace(/\s+/g, ' '));
    // Unicode-aware word boundaries for proper Arabic/non-ASCII support
    return new RegExp(`(?<![\\p{L}\\p{N}])${esc(s)}(?![\\p{L}\\p{N}])`, 'u').test(text.toLowerCase());
  }
  if (field === 'date') return dateForms(String(value)).some((f) => text.includes(f));
  const n = Number(value);
  const flat = text.replace(/(\d),(?=\d{3}\b)/g, '$1'); // drop thousands commas
  return [n.toFixed(2), String(n)].some((s) => new RegExp(`(?<![\\d.])${esc(s)}(?!\\d)`).test(flat));
}
