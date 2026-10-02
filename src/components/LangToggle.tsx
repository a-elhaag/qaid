import { toggleLang } from '@/i18n/actions';
import { getDict } from '@/i18n/server';

export async function LangToggle({ className = '' }: { className?: string }) {
  const { t } = await getDict();
  return (
    <form action={toggleLang}>
      <button className={`rounded-full border border-current px-4 py-2 text-sm font-semibold ${className}`}>{t.switchTo}</button>
    </form>
  );
}
