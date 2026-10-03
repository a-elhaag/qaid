import { NextResponse } from 'next/server';
import { buildPdf } from '@/brain/export/pack';
import { buildWorkbook, type PackInput } from '@/brain/export/xlsx';
import { requireOffice } from '@/server/auth';
import { db } from '@/server/db';
import { mapEntry, monthKey, shiftMonth } from '@/server/queries';

export async function GET(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { officeId } = await requireOffice();
  const url = new URL(req.url);
  const month = url.searchParams.get('month') ?? monthKey(new Date());
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'bad month' }, { status: 400 });

  const { data: c } = await db().from('clients').select('id,name,name_en').eq('id', clientId).eq('office_id', officeId).maybeSingle();
  if (!c) return NextResponse.json({ error: 'not found' }, { status: 404 }); // also the answer for another office's client id
  const [{ data: es }, { data: emps }] = await Promise.all([
    db().from('entries').select('*').eq('client_id', clientId).gte('entry_date', `${month}-01`).lt('entry_date', `${shiftMonth(month, 1)}-01`),
    db().from('employees').select('name,monthly_wage').eq('client_id', clientId),
  ]);
  const input: PackInput = {
    clientName: format === 'pdf' ? c.name_en : c.name,
    month,
    entries: (es ?? []).map(mapEntry),
    employees: (emps ?? []).map((e) => ({ name: e.name, wage: Number(e.monthly_wage) })),
  };
  const buf = format === 'pdf' ? await buildPdf(input) : await buildWorkbook(input);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="qaid-${c.name_en.replace(/\W+/g, '-')}-${month}.${format}"`,
    },
  });
}
