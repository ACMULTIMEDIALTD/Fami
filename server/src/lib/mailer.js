import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transport = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : null;
export const outbox = []; // populated in tests / when no SMTP is configured

function layout(body) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#222">${body}</div>`;
}

export async function sendMail({ to, subject, html, text }) {
  if (!to) return;
  const msg = { from: config.mailFrom, to, subject, html: layout(html), text };
  if (!transport) {
    outbox.push(msg);
    if (outbox.length > 50) outbox.shift();
    if (!config.isTest) console.log(`[mail] to=${to} subject=${subject}\n${text || html}`);
    return;
  }
  try {
    await transport.sendMail(msg);
  } catch (err) {
    console.error('mail failed', to, subject, err.message);
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const mails = {
  magicLink: (to, url) => sendMail({
    to,
    subject: 'קישור כניסה לקהילה של נועה',
    text: `לכניסה לחצי על הקישור (תקף ל-30 דקות):\n${url}`,
    html: `<p>היי,</p><p>לכניסה לחצי על הקישור (תקף ל-30 דקות):</p><p><a href="${esc(url)}">כניסה לקהילה</a></p><p>אם לא ביקשת להתחבר, אפשר להתעלם מהמייל.</p>`,
  }),
  signupReceived: (to) => sendMail({
    to,
    subject: 'קיבלנו את ההרשמה שלך 💛',
    text: 'תודה שנרשמת! נועה מאשרת חברות תוך 48 שעות. נעדכן אותך במייל.',
    html: '<p>תודה שנרשמת!</p><p>נועה מאשרת חברות תוך 48 שעות. נעדכן אותך במייל.</p>',
  }),
  approved: (to) => sendMail({
    to,
    subject: 'ברוכה הבאה לקהילה! 🎉',
    text: `החברות שלך אושרה. כנסי לאזור האישי כדי להצטרף לקבוצת הווטסאפ ולראות קמפיינים פתוחים:\n${config.appUrl}/dashboard`,
    html: `<p>החברות שלך אושרה!</p><p>כנסי לאזור האישי כדי להצטרף לקבוצת הווטסאפ ולראות קמפיינים פתוחים:</p><p><a href="${config.appUrl}/dashboard">לאזור האישי</a></p>`,
  }),
  selected: (to, campaign) => sendMail({
    to,
    subject: `נבחרת לקמפיין: ${campaign.title} 🎉`,
    text: `נבחרת לקמפיין "${campaign.title}"! הבריף המלא ותנאי התשלום מחכים לך כאן:\n${config.appUrl}/c/${campaign.slug}`,
    html: `<p>נבחרת לקמפיין <b>${esc(campaign.title)}</b>!</p><p>הבריף המלא ותנאי התשלום מחכים לך כאן:</p><p><a href="${config.appUrl}/c/${esc(campaign.slug)}">לפרטי הקמפיין</a></p>`,
  }),
  newSignup: (name, email) => sendMail({
    to: config.notifyEmail,
    subject: `יוצרת חדשה ממתינה לאישור: ${name}`,
    text: `${name} (${email}) השלימה הרשמה.\n${config.appUrl}/admin/creators?status=pending`,
    html: `<p><b>${esc(name)}</b> (${esc(email)}) השלימה הרשמה.</p><p><a href="${config.appUrl}/admin/creators?status=pending">למאגר היוצרות</a></p>`,
  }),
  brandInquiry: (data) => sendMail({
    to: config.notifyEmail,
    subject: `פנייה ממותג: ${data.brand}`,
    text: Object.entries(data).map(([k, v]) => `${k}: ${v ?? ''}`).join('\n'),
    html: `<p><b>פנייה חדשה מהאתר</b></p><ul>
      <li>שם: ${esc(data.name)}</li><li>מותג: ${esc(data.brand)}</li>
      <li>טלפון: ${esc(data.phone)}</li><li>מייל: ${esc(data.email)}</li></ul>
      <p style="white-space:pre-wrap">${esc(data.message)}</p>`,
  }),
};
