import { DEMO } from '../src/lib/demo';
import { db } from '../src/server/db';
import { monthKey, shiftMonth } from '../src/server/queries';

const OFFICE = 'مكتب أحمد (تجريبي)';
const cur = monthKey(new Date());
const d = (m: string, day: number) => `${m}-${String(day).padStart(2, '0')}`;
const row = (m: string, day: number, vendor: string, subtotal: number, category: string, vatRate = 0.14) => {
  const vat = Math.round(subtotal * vatRate * 100) / 100;
  return { vendor, entry_date: d(m, day), subtotal, vat, total: Math.round((subtotal + vat) * 100) / 100, category, confirmed: true };
};
const must = <T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> => {
  if (r.error || r.data == null) throw new Error(`${what}: ${r.error?.message ?? 'no data'}`);
  return r.data;
};

async function main() {
  // Remove only the demo user and the demo office, each by id. Other users' data is never touched.
  const { data: users } = await db().auth.admin.listUsers({ perPage: 200 });
  const old = users.users.find((u) => u.email === DEMO.email);
  if (old) await db().auth.admin.deleteUser(old.id);
  const { data: olds } = await db().from('offices').select('id').eq('name', OFFICE);
  for (const o of olds ?? []) await db().from('offices').delete().eq('id', o.id); // cascades to clients, entries, flags

  const office = must(await db().from('offices').insert({ name: OFFICE }).select('id').single(), 'office');
  const demoUser = await db().auth.admin.createUser({ email: DEMO.email, password: DEMO.password, email_confirm: true });
  if (demoUser.error) throw demoUser.error;
  must(await db().from('office_members').insert({ user_id: demoUser.data.user.id, office_id: office.id }).select(), 'member');

  const mk = async (name: string, name_en: string) => must(await db().from('clients').insert({ office_id: office.id, name, name_en }).select('id,token').single(), name);
  const months = [shiftMonth(cur, -2), shiftMonth(cur, -1), cur];
  const clients = {
    mona: await mk('منى للمستلزمات المنزلية', 'Mona Home Goods'),
    cafe: await mk('كافيه النيل', 'Nile Cafe'),
    acc: await mk('عالم الإكسسوارات', 'Accessories World'),
    alu: await mk('ورشة الألومنيوم', 'Aluminium Workshop'),
    insta: await mk('متجر إنستجرام للملابس', 'Insta Clothing'),
  };
  const put = async (client: { id: string }, rows: ReturnType<typeof row>[]) =>
    must(await db().from('entries').insert(rows.map((r) => ({ ...r, client_id: client.id }))).select('id'), 'entries');

  // Mona: supplier price jump of 9% this month, margin dips.
  await put(clients.mona, [
    ...months.slice(0, 2).flatMap((m) => [row(m, 3, 'مبيعات المحل', 9000, 'sales'), row(m, 5, 'مورد الأدوات المنزلية', 4000, 'supplies'), row(m, 1, 'المالك', 1500, 'rent', 0)]),
    row(cur, 3, 'مبيعات المحل', 9000, 'sales'),
    row(cur, 5, 'مورد الأدوات المنزلية', 4360, 'supplies'),
    row(cur, 1, 'المالك', 1500, 'rent', 0),
  ]);
  // Cafe: rent receipt missing this month (expected_docs below).
  await put(clients.cafe, months.flatMap((m) => [row(m, 2, 'مبيعات الكافيه', 6000, 'sales'), row(m, 4, 'مورد البن', 1800, 'supplies'), ...(m === cur ? [] : [row(m, 1, 'المالك', 2000, 'rent', 0)])]));
  // Accessories: duplicate invoice this month, the copy still waiting for review.
  await put(clients.acc, [
    ...months.slice(0, 2).flatMap((m) => [row(m, 3, 'مبيعات', 5000, 'sales'), row(m, 6, 'مستورد الإكسسوارات', 2000, 'supplies')]),
    row(cur, 3, 'مبيعات', 5000, 'sales'),
    row(cur, 6, 'مستورد الإكسسوارات', 2000, 'supplies'),
    { ...row(cur, 6, 'مستورد الإكسسوارات', 2000, 'supplies'), confirmed: false },
  ]);
  // Aluminium workshop: unusually high VAT this month.
  await put(clients.alu, [
    ...months.slice(0, 2).flatMap((m) => [row(m, 4, 'مبيعات الورشة', 12000, 'sales'), row(m, 7, 'مورد الألومنيوم', 5000, 'supplies')]),
    row(cur, 4, 'مبيعات الورشة', 12000, 'sales'),
    row(cur, 7, 'مورد الألومنيوم', 20000, 'supplies'),
  ]);
  // Instagram seller: nothing this month.
  await put(clients.insta, months.slice(0, 2).flatMap((m) => [row(m, 5, 'مبيعات إنستجرام', 7000, 'sales', 0), row(m, 8, 'مورد الملابس', 3000, 'supplies')]));

  must(
    await db().from('expected_docs').insert([
      { client_id: clients.mona.id, vendor: 'المالك', label: 'إيصال الإيجار' },
      { client_id: clients.cafe.id, vendor: 'المالك', label: 'إيصال الإيجار' },
      { client_id: clients.cafe.id, vendor: 'مورد البن', label: 'فاتورة مورد البن' },
    ]).select('id'),
    'expected_docs',
  );
  must(
    await db().from('employees').insert([
      { client_id: clients.mona.id, name: 'سارة', monthly_wage: 7000 },
      { client_id: clients.mona.id, name: 'كريم', monthly_wage: 9000 },
      { client_id: clients.cafe.id, name: 'مصطفى', monthly_wage: 7500 },
    ]).select('id'),
    'employees',
  );

  // Flags matching the stories (live uploads get theirs from the pipeline; seeded history needs them directly).
  const one = async (client: { id: string }, vendor: string, day: number, confirmed?: boolean) => {
    let q = db().from('entries').select('id').eq('client_id', client.id).eq('vendor', vendor).eq('entry_date', d(cur, day));
    if (confirmed !== undefined) q = q.eq('confirmed', confirmed);
    return must(await q.single(), `entry ${vendor}`).id as string;
  };
  must(
    await db().from('flags').insert([
      { client_id: clients.mona.id, entry_id: await one(clients.mona, 'مورد الأدوات المنزلية', 5), kind: 'price_jump', detail: 'مورد الأدوات المنزلية ارتفع 9% عن المتوسط السابق' },
      { client_id: clients.acc.id, entry_id: await one(clients.acc, 'مستورد الإكسسوارات', 6, false), kind: 'duplicate', detail: 'نفس فاتورة مستورد الإكسسوارات مسجلة مرتين' },
      { client_id: clients.alu.id, entry_id: await one(clients.alu, 'مورد الألومنيوم', 7), kind: 'vat_spike', detail: 'ضريبة القيمة المضافة أعلى من المعتاد' },
    ]).select('id'),
    'flags',
  );

  for (const [k, c] of Object.entries(clients)) console.log(k.padEnd(6), `/c/${c.token}`);
  console.log(`\ndemo login: ${DEMO.email}`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
