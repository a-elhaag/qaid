import { toggleLang } from '@/i18n/actions';
import { getDict } from '@/i18n/server';
import { btnSolid } from './buttons';

export async function LangToggle({ className }: { className?: string }) {
  const { t } = await getDict();
  return (
    <form action={toggleLang}>
      <button className={className ?? btnSolid}>{t.switchTo}</button>
    </form>
  );
}
