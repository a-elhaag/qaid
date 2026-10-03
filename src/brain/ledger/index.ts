import { RATES } from '../config';
import type { Entry } from '../types';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const isIncome = (e: Entry) => e.category === 'sales';
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const confirmedOnly = (es: Entry[]) => es.filter((e) => e.confirmed);

export function vatSummary(entries: Entry[]) {
  const c = confirmedOnly(entries);
  const outputVat = round2(sum(c.filter(isIncome).map((e) => e.vat)));
  const inputVat = round2(sum(c.filter((e) => !isIncome(e)).map((e) => e.vat)));
  return { outputVat, inputVat, payable: round2(outputVat - inputVat) };
}

export function profitAndLoss(entries: Entry[]) {
  const c = confirmedOnly(entries);
  const revenue = round2(sum(c.filter(isIncome).map((e) => e.subtotal)));
  const expensesByCategory: Record<string, number> = {};
  for (const e of c.filter((x) => !isIncome(x))) {
    expensesByCategory[e.category] = round2((expensesByCategory[e.category] ?? 0) + e.subtotal);
  }
  const totalExpenses = round2(sum(Object.values(expensesByCategory)));
  const net = round2(revenue - totalExpenses);
  return { revenue, expensesByCategory, totalExpenses, net, margin: revenue > 0 ? round2(net / revenue) : null };
}

export function payroll(employees: { name: string; wage: number }[]) {
  const { employer, employee, minWage, maxWage } = RATES.socialInsurance;
  const rows = employees.map((p) => {
    const insurable = Math.min(Math.max(p.wage, minWage), maxWage);
    return { name: p.name, wage: p.wage, insurable, employee: round2(insurable * employee), employer: round2(insurable * employer) };
  });
  return { rows, totalEmployee: round2(sum(rows.map((r) => r.employee))), totalEmployer: round2(sum(rows.map((r) => r.employer))) };
}

const key = (s: string) => s.trim().toLowerCase();
const avgByVendor = (es: Entry[]) => {
  const m = new Map<string, number[]>();
  for (const e of es) m.set(key(e.vendor), [...(m.get(key(e.vendor)) ?? []), e.total]);
  return new Map([...m].map(([k, v]) => [k, sum(v) / v.length]));
};

export function priceChanges(prev: Entry[], cur: Entry[]) {
  const p = avgByVendor(prev);
  const names = new Map(cur.map((e) => [key(e.vendor), e.vendor]));
  const out: { vendor: string; prevAvg: number; curAvg: number; pct: number }[] = [];
  for (const [k, curAvg] of avgByVendor(cur)) {
    const prevAvg = p.get(k);
    if (!prevAvg) continue;
    out.push({ vendor: names.get(k)!, prevAvg: round2(prevAvg), curAvg: round2(curAvg), pct: round2((curAvg - prevAvg) / prevAvg) });
  }
  return out.sort((a, b) => b.pct - a.pct);
}
