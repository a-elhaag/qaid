import type { Metadata } from 'next';
import { Bodoni_Moda, Hanken_Grotesk, JetBrains_Mono, Reem_Kufi, Tajawal } from 'next/font/google';
import { dir } from '@/i18n/dictionary';
import { getLang } from '@/i18n/server';
import './globals.css';

const disp = Bodoni_Moda({ variable: '--f-disp', subsets: ['latin'], weight: ['500', '700'] });
const ui = Hanken_Grotesk({ variable: '--f-ui', subsets: ['latin'] });
const mono = JetBrains_Mono({ variable: '--f-mono', subsets: ['latin'] });
const kufi = Reem_Kufi({ variable: '--f-kufi', subsets: ['arabic'], weight: ['500', '700'] });
const taj = Tajawal({ variable: '--f-taj', subsets: ['arabic'], weight: ['400', '500', '700'] });

export const metadata: Metadata = {
  title: 'Qaid',
  description: 'Books prepared. Every number yours to confirm.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const lang = await getLang();
  return (
    <html lang={lang} dir={dir(lang)} className={`${disp.variable} ${ui.variable} ${mono.variable} ${kufi.variable} ${taj.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
