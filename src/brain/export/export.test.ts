import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { profitAndLoss, vatSummary } from '../ledger';
import { buildPdf } from './pack';
import { buildWorkbook, type PackInput } from './xlsx';
import type { Entry } from '../types';

const e = (o: Partial<Entry>): Entry => ({ id: String(Math.random()), clientId: 'c', documentId: null, vendor: 'v', date: '2026-10-05', subtotal: 100, vat: 14, total: 114, category: 'supplies', confirmed: true, ...o });
const input: PackInput = {
  clientName: 'Mona Home Goods',
  month: '2026-10',
  entries: [e({ category: 'sales', subtotal: 1000, vat: 140, total: 1140 }), e({ subtotal: 200, vat: 28, total: 228 }), e({ confirmed: false, subtotal: 9999, total: 9999 })],
  employees: [{ name: 'Sara', wage: 7000 }],
};

describe('buildWorkbook', () => {
  it('has the four sheets and totals equal ledger totals', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildWorkbook(input)) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Entries', 'P&L', 'VAT', 'Payroll']);
    const pl = wb.getWorksheet('P&L')!;
    expect((pl.getCell('B4').value as { result: number }).result).toBe(profitAndLoss(input.entries).net);
    const vat = wb.getWorksheet('VAT')!;
    expect((vat.getCell('B4').value as { result: number }).result).toBe(vatSummary(input.entries).payable);
  });
  it('excludes unconfirmed entries from the Entries sheet', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildWorkbook(input)) as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Entries')!.rowCount).toBe(1 + 2 + 1); // header + 2 confirmed + totals
  });
});

describe('buildPdf', () => {
  it('produces a PDF', async () => {
    const buf = await buildPdf(input);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
