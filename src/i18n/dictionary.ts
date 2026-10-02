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
    exists: 'This email already has an account. Sign in instead.',
    noOffice: 'This account is not linked to an office.',
    check: 'Check your email to confirm the account.',
    seal: 'PREPARED · YOU DECIDE · PREPARED · YOU DECIDE ·',
  },
  board: {
    title: 'Client ledger',
    toReview: 'receipts to review',
    cols: { no: 'No.', client: 'Client', review: 'To review', flags: 'Flags', missing: 'Missing', status: 'Status' },
    status: { strange: 'Needs you', missing: 'Documents missing', silent: 'Gone quiet', review: 'Awaiting review', ready: 'Clear' },
    empty: 'No clients yet. Add the first one below; each gets a private upload link.',
    addName: 'Client name',
    add: 'Add client',
    signOut: 'Sign out',
    synthetic: 'Demo data is invented',
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
    exists: 'هذا البريد لديه حساب بالفعل. سجّل الدخول بدلًا من ذلك.',
    noOffice: 'هذا الحساب غير مرتبط بمكتب.',
    check: 'تحقق من بريدك لتأكيد الحساب.',
    seal: 'جاهز · وأنت تقرر · جاهز · وأنت تقرر ·',
  },
  board: {
    title: 'دفتر العملاء',
    toReview: 'إيصالًا بانتظار المراجعة',
    cols: { no: 'رقم', client: 'العميل', review: 'للمراجعة', flags: 'تنبيهات', missing: 'ناقص', status: 'الحالة' },
    status: { strange: 'يحتاجك', missing: 'مستندات ناقصة', silent: 'صامت', review: 'بانتظار المراجعة', ready: 'سليم' },
    empty: 'لا عملاء بعد. أضف أول عميل بالأسفل، ولكل عميل رابط رفع خاص.',
    addName: 'اسم العميل',
    add: 'إضافة عميل',
    signOut: 'خروج',
    synthetic: 'بيانات تجريبية مخترعة',
  },
};

export const dictionaries = { en, ar };
export type Dict = typeof en;
