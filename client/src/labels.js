export const TYPE_LABELS = { paid: 'בתשלום', barter: 'בארטר', hybrid: 'משולב' };
export const CAMPAIGN_STATUS = {
  draft: 'טיוטה', open: 'פתוח להגשה', closed: 'סגור', in_progress: 'בביצוע', done: 'הסתיים', cancelled: 'בוטל',
};
export const APP_STATUS = {
  applied: 'ממתינה לתשובה', selected: 'נבחרת 🎉', rejected: 'לא הפעם', withdrawn: 'בוטלה', completed: 'הושלם',
};
export const APP_STATUS_ADMIN = { ...APP_STATUS, applied: 'הגישה', selected: 'נבחרה', rejected: 'נדחתה' };
export const USER_STATUS = { pending: 'ממתינה', active: 'פעילה', suspended: 'מושעית', left: 'עזבה' };
export const PLATFORMS = { instagram: 'אינסטגרם', tiktok: 'טיקטוק', youtube: 'יוטיוב', other: 'אחר' };
export const GENDER = { mostly_women: 'בעיקר נשים', mostly_men: 'בעיקר גברים', mixed: 'מעורב' };
export const SECTORS = ['כללי', 'דתי', 'ערבי', 'דובר רוסית', 'דובר אנגלית', 'אחר'];
export const BILLING = { osek_patur: 'עוסקת פטורה', osek_murshe: 'עוסקת מורשית', company: 'חברה בע״מ', none: 'אין עדיין' };
export const TIERS = { A: 'A', B: 'B', new: 'חדשה' };

export const REJECTED_SOFT = 'לא הפעם, את במאגר להבא 💛';

export const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
export const fmtK = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
};
const tz = { timeZone: 'Asia/Jerusalem' };
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('he-IL', { ...tz, day: 'numeric', month: 'numeric', year: '2-digit' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('he-IL', { ...tz, day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const daysLeft = (d) => Math.ceil((new Date(d) - Date.now()) / 864e5);
