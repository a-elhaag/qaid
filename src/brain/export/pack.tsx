import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { RATES } from '../config';
import { payroll, profitAndLoss, vatSummary } from '../ledger';
import type { PackInput } from './xlsx';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#16201e' },
  band: { backgroundColor: '#0d4a43', color: '#f1ead6', padding: 16, marginBottom: 10, borderRadius: 8 },
  h1: { fontSize: 18, color: '#f1ead6' },
  sub: { color: '#c8a24a', fontSize: 9, marginTop: 3 },
  note: { color: '#4b5b57', marginBottom: 10 },
  h2: { fontSize: 13, marginTop: 14, marginBottom: 6, color: '#0d4a43' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#b9c4b4' },
});
const Row = ({ a, b }: { a: string; b: string | number }) => (
  <View style={s.row}><Text>{a}</Text><Text>{String(b)}</Text></View>
);

// ponytail: the route passes name_en because react-pdf Arabic shaping is unverified.
export async function buildPdf(i: PackInput): Promise<Buffer> {
  const pl = profitAndLoss(i.entries);
  const vat = vatSummary(i.entries);
  const pay = payroll(i.employees);
  return renderToBuffer(
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <Text style={s.h1}>{i.clientName}</Text>
          <Text style={s.sub}>Month-end pack, {i.month}</Text>
        </View>
        <Text style={s.note}>Prepared for accountant review. Not filed or submitted. Invented demo data.</Text>
        <Text style={s.h2}>Profit and loss (EGP)</Text>
        <Row a="Revenue (net of VAT)" b={pl.revenue} />
        {Object.entries(pl.expensesByCategory).map(([c, v]) => <Row key={c} a={`Expense: ${c}`} b={v} />)}
        <Row a="Net profit" b={pl.net} />
        <Row a="Margin" b={pl.margin == null ? 'n/a' : `${Math.round(pl.margin * 100)}%`} />
        <Text style={s.h2}>VAT summary (rate {RATES.vat * 100}%, to verify)</Text>
        <Row a="Output VAT" b={vat.outputVat} />
        <Row a="Input VAT" b={vat.inputVat} />
        <Row a="Payable" b={vat.payable} />
        <Text style={s.h2}>Payroll and social insurance (rates to verify)</Text>
        {pay.rows.map((r) => <Row key={r.name} a={`${r.name} (employee / employer)`} b={`${r.employee} / ${r.employer}`} />)}
        <Row a="Totals" b={`${pay.totalEmployee} / ${pay.totalEmployer}`} />
      </Page>
    </Document>,
  );
}
