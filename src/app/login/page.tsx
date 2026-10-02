import { DEMO } from '@/lib/demo';
import { signIn, signUp } from './actions';

const MSG: Record<string, string> = { '1': 'البريد أو كلمة المرور غير صحيحة', '2': 'تعذّر إنشاء الحساب (كلمة المرور 8 أحرف على الأقل)', nooffice: 'هذا الحساب غير مرتبط بمكتب' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; check?: string }> }) {
  const sp = await searchParams;
  const input = 'w-full rounded-xl border border-neutral-200 px-4 py-3';
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">قيد</h1>
      {sp.error && <p className="text-red-600">{MSG[sp.error] ?? '!'}</p>}
      {sp.check && <p className="text-emerald-700">تحقق من بريدك لتأكيد الحساب</p>}

      <form action={signIn} className="space-y-3">
        <input type="hidden" name="next" value={sp.next ?? ''} />
        <input name="email" type="email" required placeholder="البريد الإلكتروني" className={input} dir="ltr" />
        <input name="password" type="password" required placeholder="كلمة المرور" className={input} dir="ltr" />
        <button className="w-full rounded-full bg-[var(--accent)] py-3 text-white">دخول</button>
      </form>

      <form action={signIn} className="rounded-2xl bg-neutral-50 p-4">
        <input type="hidden" name="next" value={sp.next ?? ''} />
        <input type="hidden" name="email" value={DEMO.email} />
        <input type="hidden" name="password" value={DEMO.password} />
        <p className="mb-2 text-sm text-neutral-500">حساب تجريبي: أحمد، مكتب محاسبة (بيانات مخترعة)</p>
        <button className="w-full rounded-full border border-[var(--accent)] py-3 text-[var(--accent)]">ادخل كأحمد</button>
      </form>

      <details className="text-sm text-neutral-500">
        <summary className="cursor-pointer">إنشاء حساب جديد</summary>
        <form action={signUp} className="mt-3 space-y-3">
          <input name="email" type="email" required placeholder="البريد الإلكتروني" className={input} dir="ltr" />
          <input name="password" type="password" required minLength={8} placeholder="كلمة المرور (8 أحرف على الأقل)" className={input} dir="ltr" />
          <button className="w-full rounded-full border py-3">إنشاء</button>
        </form>
      </details>
    </main>
  );
}
