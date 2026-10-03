import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
await p.goto('https://qaid-bay.vercel.app/login');
await p.getByRole('button', { name: /Ahmed/i }).click();
await p.waitForURL(/board/, { timeout: 60000 });
await ctx.storageState({ path: 'raw/state.json' });
for (const [n, id] of [['mona', 'ca61c990-2806-410e-a678-fbb965c39035'], ['acc', 'a1984a28-9e98-4a7e-a03d-79084dadd601'], ['cafe', 'd65aeb3b-5564-499a-89a2-dda4f9525f0d']]) {
  await p.goto('https://qaid-bay.vercel.app/board/' + id); await p.waitForTimeout(2500);
  await p.screenshot({ path: `raw/x-${n}.png`, fullPage: true });
}
await b.close();
