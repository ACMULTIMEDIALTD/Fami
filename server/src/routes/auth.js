import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { one, query } from '../db.js';
import { config } from '../config.js';
import { HttpError, parse } from '../lib/http.js';
import { setSession, clearSession, requireAuth } from '../lib/auth.js';
import { unregisterDevice } from '../lib/push.js';
import { normalizePhone } from '../lib/phone.js';
import { logEvent } from '../lib/events.js';
import { mails } from '../lib/mailer.js';

const router = Router();
const MAGIC_TTL_MIN = 30;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 10_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'יותר מדי ניסיונות, נסי שוב בעוד כמה דקות' },
});

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Only allow same-app relative redirects ("/c/abc"), never "//evil.com" or absolute URLs. */
export function safeNext(next) {
  return typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : null;
}

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('כתובת מייל לא תקינה'),
  phone: z.string().trim().transform(normalizePhone).refine((p) => p && /^0\d{8,9}$/.test(p), 'מספר טלפון לא תקין'),
  password: z.string().min(8, 'סיסמה של 8 תווים לפחות').max(200).optional().or(z.literal('').transform(() => undefined)),
});

router.post('/signup', limiter, async (req, res) => {
  const { email, phone, password } = parse(signupSchema, req.body);
  if (!password && !config.mailEnabled) {
    // No email sign-in links yet → without a password she could never log in again
    throw new HttpError(400, 'validation_error', 'יש לבחור סיסמה', { fields: { password: 'יש לבחור סיסמה (8 תווים לפחות)' } });
  }
  const exists = await one('SELECT email, phone FROM users WHERE email = $1 OR phone = $2', [email, phone]);
  if (exists) {
    const field = exists.email.toLowerCase() === email ? 'email' : 'phone';
    throw new HttpError(409, `${field}_taken`, field === 'email'
      ? 'המייל הזה כבר רשום — אפשר להתחבר'
      : 'מספר הטלפון הזה כבר רשום — אפשר להתחבר');
  }
  const hash = password ? await bcrypt.hash(password, 12) : null;
  const user = await one(
    `INSERT INTO users (email, phone, password_hash) VALUES ($1, $2, $3)
     RETURNING id, email, phone, role, status`,
    [email, phone, hash],
  );
  await logEvent(user.id, 'signup', { ip: req.ip, app: req.get('X-Client') === 'app' });
  const token = setSession(req, res, user);
  res.status(201).json({ user, token });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('כתובת מייל לא תקינה'),
  password: z.string().optional(),
  next: z.string().optional(),
});

router.post('/login', limiter, async (req, res) => {
  const { email, password, next } = parse(loginSchema, req.body);
  const user = await one('SELECT id, email, phone, role, status, password_hash FROM users WHERE email = $1', [email]);

  if (!password) {
    if (!config.mailEnabled) {
      throw new HttpError(400, 'mail_disabled', 'כניסה עם קישור למייל לא זמינה כרגע. היכנסי עם סיסמה.');
    }
    // Magic link. Same response whether or not the email exists (no account enumeration).
    if (user && !['suspended', 'left'].includes(user.status)) {
      const token = crypto.randomBytes(32).toString('base64url');
      await query(
        `INSERT INTO magic_links (token, user_id, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
        [sha256(token), user.id, MAGIC_TTL_MIN],
      );
      const qs = safeNext(next) ? `?next=${encodeURIComponent(next)}` : '';
      // /m/<token> is a client page: in a browser it signs in there; on a phone with the app
      // installed the same https link opens the app (universal / app links).
      await mails.magicLink(user.email, `${config.appUrl}/m/${token}${qs}`);
    }
    return res.json({ ok: true, magic: true });
  }

  const valid = user?.password_hash && (await bcrypt.compare(password, user.password_hash));
  if (!valid) throw new HttpError(401, 'invalid_credentials', 'מייל או סיסמה שגויים');
  if (['suspended', 'left'].includes(user.status)) throw new HttpError(403, 'account_inactive', 'החשבון אינו פעיל');

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  await logEvent(user.id, 'login', { method: 'password' });
  const token = setSession(req, res, user);
  delete user.password_hash;
  res.json({ user, token });
});

/** Consume a magic-link token (single use). Returns null when expired/used/suspended. */
async function consumeMagic(raw) {
  const link = await one(
    `UPDATE magic_links SET used_at = now()
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [sha256(raw)],
  );
  const user = link && (await one('SELECT id, email, phone, role, status FROM users WHERE id = $1', [link.user_id]));
  if (!user || ['suspended', 'left'].includes(user.status)) return null;
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  await logEvent(user.id, 'login', { method: 'magic' });
  return user;
}

/** Used by the /m/:token page (web and app). */
router.post('/magic', limiter, async (req, res) => {
  const { token: raw } = parse(z.object({ token: z.string().min(10).max(200) }), req.body);
  const user = await consumeMagic(raw);
  if (!user) throw new HttpError(410, 'link_expired', 'הקישור פג תוקף או שכבר נעשה בו שימוש. אפשר לבקש קישור חדש.');
  const token = setSession(req, res, user);
  res.json({ user, token });
});

// Links sent before /m/<token> existed still work
router.get('/magic/:token', async (req, res) => {
  const user = await consumeMagic(req.params.token);
  if (!user) return res.redirect(`${config.appUrl}/login?error=link_expired`);
  setSession(req, res, user);
  res.redirect(`${config.appUrl}${safeNext(req.query.next) || '/dashboard'}`);
});

router.post('/logout', async (req, res) => {
  // The app passes its push token so this phone stops getting notifications for this account
  if (req.body?.push_token) await unregisterDevice(req.body.push_token);
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const creator = await one(
    'SELECT full_name, terms_version, terms_accepted_at FROM creators WHERE user_id = $1',
    [req.user.id],
  );
  res.json({
    user: req.user,
    profile: creator
      ? { full_name: creator.full_name, terms_version: creator.terms_version, terms_accepted_at: creator.terms_accepted_at }
      : null,
    needs_profile: req.user.role === 'creator' && !creator,
    needs_terms: !!creator && creator.terms_version !== config.termsVersion,
    terms: { version: config.termsVersion, pdf_url: config.termsPdfUrl },
    whatsapp_group_url: req.user.status === 'active' ? config.whatsappGroupUrl || null : null,
  });
});

export default router;
