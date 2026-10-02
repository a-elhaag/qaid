import { existsSync, readFileSync } from 'node:fs';
import { extractReceipt } from '../src/server/extractReceipt';

type Truth = { file: string; vendor: string; date: string; subtotal: number | null; vat: number | null; total: number; docType: string };
const truth: Truth[] = JSON.parse(readFileSync('samples/ground-truth.json', 'utf8'));
const FIELDS = ['vendor', 'date', 'subtotal', 'vat', 'total'] as const;
const hit: Record<string, number> = Object.fromEntries(FIELDS.map((f) => [f, 0]));
let n = 0;

async function main() {
  for (const t of truth) {
    const p = `samples/photos/${t.file}.jpg`;
    if (!existsSync(p)) continue;
    n++;
    const r = await extractReceipt(readFileSync(p).toString('base64'), 'image/jpeg');
    for (const f of FIELDS) {
      const got = r.fields[f].value;
      const want = t[f];
      const ok = typeof want === 'number' ? Math.abs(Number(got) - want) < 0.01 : String(got ?? '').trim().toLowerCase() === String(want ?? '').trim().toLowerCase();
      if (ok) hit[f]++;
      else console.log(`${t.file} ${f}: got ${JSON.stringify(got)} want ${JSON.stringify(want)} [${r.fields[f].agreement}]`);
    }
  }
  console.log(`\n${n} receipts`, Object.fromEntries(FIELDS.map((f) => [f, `${hit[f]}/${n}`])));
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
