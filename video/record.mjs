// Records the live app as short clips (one webm per scene) with a visible fake cursor.
// Usage: node record.mjs [scene ...]   scenes: board upload chat reminder pack arabic
import { chromium } from 'playwright-core';
import { renameSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'https://qaid-bay.vercel.app';
let MONA = '', CAFE = '';
const OUT = new URL('./raw/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const CURSOR = `
(() => {
  const mk = () => {
    if (document.getElementById('fc')) return;
    const d = document.createElement('div');
    d.id = 'fc';
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:none;will-change:transform';
    d.innerHTML = '<svg width="30" height="34" viewBox="0 0 30 34"><path d="M3 2 L3 26 L9.5 20.5 L14 31 L19 29 L14.5 18.5 L23 18 Z" fill="#fff" stroke="#16201e" stroke-width="2" stroke-linejoin="round"/></svg>';
    d.style.transform = 'translate(' + (window.__fx ?? 640) + 'px,' + (window.__fy ?? 360) + 'px)';
    document.documentElement.appendChild(d);
  };
  window.__fc = (x, y) => { window.__fx = x; window.__fy = y; mk(); document.getElementById('fc').style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
  document.addEventListener('DOMContentLoaded', mk);
  if (document.readyState !== 'loading') mk();
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

async function scene(browser, name, fn, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT + 'tmp-' + name, size: { width: 1280, height: 720 } }, storageState: OUT + 'state.json', ...extra });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const pos = { x: 640, y: 360 };
  const api = {
    page, pos,
    async setCursor() { await page.evaluate(([x, y]) => window.__fc?.(x, y), [pos.x, pos.y]).catch(() => {}); },
    async go(url) { await page.goto(BASE + url, { waitUntil: 'domcontentloaded' }); await api.setCursor(); },
    async moveTo(x, y, ms = 700) {
      const x0 = pos.x, y0 = pos.y, n = Math.max(8, Math.round(ms / 28));
      for (let i = 1; i <= n; i++) {
        const t = ease(i / n);
        const cx = x0 + (x - x0) * t, cy = y0 + (y - y0) * t - Math.sin(Math.PI * t) * 14;
        await page.mouse.move(cx, cy);
        await page.evaluate(([a, b]) => window.__fc?.(a, b), [cx, cy]).catch(() => {});
        await sleep(ms / n);
      }
      pos.x = x; pos.y = y;
    },
    async point(loc, { dx = 0, dy = 0, ms = 700 } = {}) {
      await loc.scrollIntoViewIfNeeded();
      const b = await loc.boundingBox();
      await api.moveTo(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, ms);
      return b;
    },
    async click(loc, opts) {
      await api.point(loc, opts);
      await sleep(180);
      await page.evaluate(() => { const c = document.getElementById('fc'); c?.animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 10px #c8a24a)' }, { filter: 'none' }], { duration: 350 }); }).catch(() => {});
      await loc.click();
    },
    async type(loc, text) { await api.click(loc); await page.keyboard.type(text, { delay: 55 }); },
  };
  try { await fn(api); } finally {
    const vid = page.video();
    await ctx.close();
    renameSync(await vid.path(), OUT + name + '.webm');
    console.log('recorded', name);
  }
}

const scenes = {
  async board(a) {
    await a.go('/board');
    await sleep(2500);
    const rows = a.page.locator('[role=row][data-tour^=row-]');
    await a.point(rows.nth(0), { dx: -120 }); await sleep(900);
    await a.point(rows.nth(1), { dx: -120 }); await sleep(900);
    await a.point(rows.nth(2), { dx: -120 }); await sleep(900);
    await a.point(rows.nth(3), { dx: -120 }); await sleep(900);
    await a.point(rows.nth(4), { dx: -120 }); await sleep(1200);
  },
  async upload(a) {
    await a.go('/board/' + MONA);
    await sleep(2000);
    await a.click(a.page.locator('[data-tour=scan]'));
    const frame = a.page.frameLocator('iframe[title]').first();
    await frame.getByRole('button', { name: /photograph/i }).waitFor({ timeout: 20000 });
    await sleep(1800);
    await a.point(frame.getByRole('button', { name: /photograph/i }), { ms: 900 });
    await sleep(600);
    await frame.locator('input[type=file]').setInputFiles(new URL('./assets/receipt-02.jpg', import.meta.url).pathname);
    await sleep(6000);
    await a.click(a.page.getByRole('button', { name: /close/i }).first());
    // wait for the live board refresh to bring the new entry in
    await a.page.locator('[data-tour=review-row]').first().waitFor({ timeout: 120000 });
    await sleep(1500);
    const row = a.page.locator('[data-tour=review-row]').first();
    await a.point(row.locator('img'), { ms: 900 }); await sleep(1800);
    await a.point(row.locator('input').nth(1), { ms: 800 }); await sleep(1500);
    await a.point(row.locator('input').nth(3), { ms: 800 }); await sleep(1500);
    const flag = row.getByText(/prior average|duplicate/i).first();
    if (await flag.count()) { await a.point(flag, { ms: 800 }); await sleep(2200); }
    const box = row.locator('input[type=checkbox]');
    if (!(await box.isChecked())) await a.click(box, { ms: 600 });
    await sleep(600);
    const cf = a.page.locator('[data-tour=confirm]').first();
    await cf.waitFor({ timeout: 30000 });
    await a.click(cf);
    await a.page.locator('[data-tour=review-row]').first().waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    await sleep(3500);
  },
  async chat(a) {
    await a.go('/chat');
    await sleep(1500);
    await a.type(a.page.locator('[data-tour=chat-input]'), 'Which clients need my attention today, and why?');
    await sleep(400);
    await a.click(a.page.locator('[data-tour=chat-send]'));
    await a.page.locator('[data-tour=chat-answer]').first().waitFor({ timeout: 60000 });
    let last = -1, same = 0;
    while (same < 4) { const n = (await a.page.locator('[data-tour=chat-answer]').last().innerText()).length; same = n === last ? same + 1 : 0; last = n; await sleep(800); }
    await sleep(2500);
  },
  async reminder(a) {
    await a.go('/board/' + CAFE);
    await sleep(2500);
    await a.click(a.page.locator('[data-tour=reminder-btn]'));
    const ta = a.page.locator('[data-tour=reminder-text]');
    await ta.waitFor({ timeout: 60000 });
    await a.page.waitForFunction(() => (document.querySelector('[data-tour=reminder-text]')?.value ?? '').length > 20, null, { timeout: 60000 });
    await sleep(3500);
  },
  async pack(a) {
    await a.go('/board/' + MONA);
    await sleep(2000);
    const links = a.page.locator('[data-tour=export] a');
    await a.point(links.nth(0), { ms: 800 }); await sleep(1200);
    await a.point(links.nth(1), { ms: 600 }); await sleep(1200);
  },
  async arabic(a) {
    await a.go('/board');
    await sleep(2000);
    await a.click(a.page.getByRole('button', { name: 'العربية' }));
    await a.page.waitForLoadState('domcontentloaded');
    await sleep(3500);
  },
};

const want = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
{ // fresh demo login (seed recreates the user and client ids)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login');
  await p.getByRole('button', { name: /Ahmed/i }).click();
  await p.waitForURL(/board/, { timeout: 60000 });
  await p.goto(BASE + '/board');
  const ids = await p.$$eval('a[href^="/board/"]', (as) => as.map((a) => [a.getAttribute('href').split('/').pop(), a.innerText]));
  MONA = ids.find(([, t]) => /Mona/.test(t))[0]; CAFE = ids.find(([, t]) => /Nile/.test(t))[0];
  await ctx.storageState({ path: OUT + 'state.json' });
  await ctx.close();
}
for (const [name, fn] of Object.entries(scenes)) if (!want.length || want.includes(name)) await scene(browser, name, fn);
await browser.close();
