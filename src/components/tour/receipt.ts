/** A synthetic "photo" of a printed receipt on a dark table, drawn in the browser. Invented data. */
export async function makeReceiptBlob(): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 1200;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2b2b2b';
  g.fillRect(0, 0, 900, 1200);
  g.fillStyle = '#fbfbf6';
  g.fillRect(180, 80, 540, 1040);
  g.fillStyle = '#111';
  g.font = 'bold 44px monospace';
  g.fillText('GULF SUPPLIES', 230, 170);
  g.font = '34px monospace';
  const rows = [['Invoice', '2026-10-06'], ['Item x5', '200.00'], ['Item x2', '50.00'], ['Subtotal', '250.00'], ['VAT 14%', '35.00'], ['Total', '285.00']];
  rows.forEach(([a, b], i) => {
    g.fillText(a, 230, 290 + i * 90);
    g.fillText(b, 520, 290 + i * 90);
  });
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.92));
}
