import { existsSync, readFileSync } from 'node:fs';
import { extractReceipt } from '../src/server/extractReceipt';

type Truth = { file: string; vendor: string; date: string; subtotal: number | null; vat: number | null; total: number; docType: string };
const truth: Truth[] = JSON.parse(readFileSync('samples/ground-truth.json', 'utf8'));
const FIELDS = ['vendor', 'date', 'subtotal', 'vat', 'total'] as const;
const hit: Record<string, number> = Object.fromEntries(FIELDS.map((f) => [f, 0]));
let n = 0;
const ms: number[] = [];
const agreement: Record<string, number> = {};
const gap = Number(process.env.SCORE_GAP_MS ?? 0); // pace requests when the Parse deployment rate-limits (429)

async function main() {
  for (const t of truth) {
    const p = `samples/photos/${t.file}.jpg`;
    if (!existsSync(p)) continue;
    n++;
    if (gap && n > 1) await new Promise((r) => setTimeout(r, gap));
    const t0 = Date.now();
    const r = await extractReceipt(readFileSync(p).toString('base64'), 'image/jpeg');
    ms.push(Date.now() - t0);
    for (const f of FIELDS) {
      const got = r.fields[f].value;
      agreement[r.fields[f].agreement] = (agreement[r.fields[f].agreement] ?? 0) + 1;
      const want = t[f];
      const ok = typeof want === 'number' ? Math.abs(Number(got) - want) < 0.01 : String(got ?? '').trim().toLowerCase() === String(want ?? '').trim().toLowerCase();
      if (ok) hit[f]++;
      else console.log(`${t.file} ${f}: got ${JSON.stringify(got)} want ${JSON.stringify(want)} [${r.fields[f].agreement}]`);
    }
  }
  const sorted = [...ms].sort((a, b) => a - b);
  console.log(`\nseconds per receipt: median ${(sorted[Math.floor(n / 2)] / 1000).toFixed(1)}, max ${(sorted[n - 1] / 1000).toFixed(1)}`);
  console.log('field agreement', agreement);
  console.log(`${n} receipts`, Object.fromEntries(FIELDS.map((f) => [f, `${hit[f]}/${n}`])));
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
