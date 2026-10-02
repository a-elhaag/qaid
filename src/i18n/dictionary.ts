export type Lang = 'en' | 'ar';
export const LANGS: Lang[] = ['en', 'ar'];
export const dir = (l: Lang) => (l === 'ar' ? 'rtl' : 'ltr');

const en = {
  brand: 'Qaid',
  tagline: 'Books prepared. Every number yours to confirm.',
  switchTo: 'العربية',
  login: {
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    demoNote: 'Demo office: Ahmed, an accounting practice (invented data)',
    demoBtn: 'Enter as Ahmed',
    createSummary: 'Create an account',
    passwordHint: 'Password (at least 8 characters)',
    create: 'Create',
    bad: 'Wrong email or password.',
    badSignup: 'Could not create the account. The password needs at least 8 characters.',
    noOffice: 'This account is not linked to an office.',
    check: 'Check your email to confirm the account.',
    seal: 'PREPARED · YOU DECIDE · PREPARED · YOU DECIDE ·',
  },
};

const ar: typeof en = {
  brand: 'قيد',
  tagline: 'دفاترك جاهزة. كل رقم بتأكيدك.',
  switchTo: 'English',
  login: {
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    signIn: 'دخول',
    demoNote: 'مكتب تجريبي: أحمد، مكتب محاسبة (بيانات مخترعة)',
    demoBtn: 'ادخل كأحمد',
    createSummary: 'إنشاء حساب جديد',
    passwordHint: 'كلمة المرور (٨ أحرف على الأقل)',
    create: 'إنشاء',
    bad: 'البريد أو كلمة المرور غير صحيحة.',
    badSignup: 'تعذّر إنشاء الحساب. كلمة المرور ٨ أحرف على الأقل.',
    noOffice: 'هذا الحساب غير مرتبط بمكتب.',
    check: 'تحقق من بريدك لتأكيد الحساب.',
    seal: 'جاهز · وأنت تقرر · جاهز · وأنت تقرر ·',
  },
};

export const dictionaries = { en, ar };
export type Dict = typeof en;
