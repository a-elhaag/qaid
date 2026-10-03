import ExcelJS from 'exceljs';
import { RATES } from '../config';
import { payroll, profitAndLoss, vatSummary } from '../ledger';
import type { Entry } from '../types';

export type PackInput = { clientName: string; month: string; entries: Entry[]; employees: { name: string; wage: number }[] };

export async function buildWorkbook(i: PackInput): Promise<Buffer> {
  const confirmed = i.entries.filter((e) => e.confirmed);
  const pl = profitAndLoss(i.entries);
  const vat = vatSummary(i.entries);
  const pay = payroll(i.employees);
  const wb = new ExcelJS.Workbook();

  const en = wb.addWorksheet('Entries');
  en.addRow(['Date', 'Vendor', 'Category', 'Subtotal', 'VAT', 'Total']);
  confirmed.forEach((e) => en.addRow([e.date, e.vendor, e.category, e.subtotal, e.vat, e.total]));
  const last = confirmed.length + 1;
  const sumOf = (col: string, field: 'subtotal' | 'vat' | 'total') => ({
    formula: `SUM(${col}2:${col}${last})`,
    result: Math.round(confirmed.reduce((s, e) => s + e[field], 0) * 100) / 100,
  });
  en.addRow(['Total', '', '', sumOf('D', 'subtotal'), sumOf('E', 'vat'), sumOf('F', 'total')]);

  // P&L layout is relied on by the test and the formulas: row 4 is net profit.
  const p = wb.addWorksheet('P&L');
  p.addRow([`${i.clientName} ${i.month}`]);
  p.addRow(['Revenue (net of VAT)', pl.revenue]);
  p.addRow(['Expenses', pl.totalExpenses]);
  p.addRow(['Net profit', { formula: 'B2-B3', result: pl.net }]);
  Object.entries(pl.expensesByCategory).forEach(([c, v]) => p.addRow([`  ${c}`, v]));

  const v = wb.addWorksheet('VAT');
  v.addRow([`VAT rate ${RATES.vat * 100}% (to verify)`]);
  v.addRow(['Output VAT', vat.outputVat]);
  v.addRow(['Input VAT', vat.inputVat]);
  v.addRow(['Payable', { formula: 'B2-B3', result: vat.payable }]);

  const w = wb.addWorksheet('Payroll');
  w.addRow(['Name', 'Wage', 'Insurable wage', 'Employee share', 'Employer share']);
  pay.rows.forEach((r) => w.addRow([r.name, r.wage, r.insurable, r.employee, r.employer]));
  w.addRow(['Total', '', '', pay.totalEmployee, pay.totalEmployer]);
  w.addRow([`Social insurance rates to verify: employee ${RATES.socialInsurance.employee * 100}%, employer ${RATES.socialInsurance.employer * 100}%`]);

  for (const sheet of wb.worksheets) {
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((c) => (c.width = 22));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
