import { Router } from 'express';
import { z } from 'zod';
import { one, query, tx } from '../db.js';
import { config } from '../config.js';
import { HttpError, parse } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { getCreatorProfile } from '../lib/creators.js';
import { logEvent } from '../lib/events.js';
import { mails } from '../lib/mailer.js';
import { registerDevice } from '../lib/push.js';

const router = Router();
router.use(requireRole('creator'));

const empty = (v) => v === '' || v === null || v === undefined;
const optInt = (min = 0, max = 2_000_000_000) =>
  z.preprocess((v) => (empty(v) ? null : Number(v)), z.number({ message: 'יש להזין מספר' }).int('יש להזין מספר שלם').min(min).max(max).nullable());
const optText = (max = 200) =>
  z.preprocess((v) => (empty(v) ? null : String(v).trim() || null), z.string().max(max).nullable());
const handle = z.preprocess(
  (v) => (empty(v) ? null : String(v).trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/i, '').replace(/\/.*$/, '') || null),
  z.string().max(60).regex(/^[\w.]+$/, 'שם משתמש לא תקין').nullable(),
);
const url = z.string().trim().max(500).url('קישור לא תקין').refine((u) => /^https?:\/\//i.test(u), 'קישור לא תקין');

const thisYear = new Date().getFullYear();

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'שדה חובה').max(100),
  birth_year: optInt(1930, thisYear - 13),
  city: optText(100),
  region_id: optInt(1),

  instagram_handle: handle,
  instagram_followers: optInt(),
  tiktok_handle: handle,
  tiktok_followers: optInt(),
  youtube_url: z.preprocess((v) => (empty(v) ? null : v), url.nullable()),
  other_platforms: optText(300),

  audience_gender: z.preprocess((v) => (empty(v) ? null : v), z.enum(['mostly_women', 'mostly_men', 'mixed']).nullable()),
  audience_age_min: optInt(0, 100),
  audience_age_max: optInt(0, 100),
  audience_sector: optText(50),

  open_to_paid: z.boolean().default(true),
  open_to_barter: z.boolean().default(true),
  open_to_events: z.boolean().default(false),
  open_to_affiliate: z.boolean().default(false),
  billing_status: z.enum(['osek_patur', 'osek_murshe', 'company', 'none']).default('none'),

  niches: z.array(z.number().int().positive()).min(1, 'יש לבחור לפחות תחום אחד').max(5, 'עד 5 תחומים'),
  links: z.array(z.object({ url, label: optText(80) })).max(10).default([]),

  // read_to_end: the client unlocks the checkbox only after the terms were scrolled to the end
  terms_accept: z.object({ version: z.string(), read_to_end: z.boolean().optional() }).optional(),
})
  .refine((p) => p.instagram_handle || p.tiktok_handle, { path: ['instagram_handle'], message: 'יש להזין לפחות חשבון אינסטגרם או טיקטוק' })
  .refine((p) => !p.instagram_handle || p.instagram_followers != null, { path: ['instagram_followers'], message: 'כמה עוקבים יש באינסטגרם?' })
  .refine((p) => !p.tiktok_handle || p.tiktok_followers != null, { path: ['tiktok_followers'], message: 'כמה עוקבים יש בטיקטוק?' })
  .refine((p) => p.audience_age_min == null || p.audience_age_max == null || p.audience_age_min <= p.audience_age_max,
    { path: ['audience_age_max'], message: 'טווח גילאים לא תקין' });

const PROFILE_COLUMNS = [
  'full_name', 'birth_year', 'city', 'region_id',
  'instagram_handle', 'instagram_followers', 'tiktok_handle', 'tiktok_followers', 'youtube_url', 'other_platforms',
  'audience_gender', 'audience_age_min', 'audience_age_max', 'audience_sector',
  'open_to_paid', 'open_to_barter', 'open_to_events', 'open_to_affiliate',
  'billing_status',
];

router.get('/profile', async (req, res) => {
  res.json({ profile: await getCreatorProfile(req.user.id) });
});

router.put('/profile', async (req, res) => {
  const data = parse(profileSchema, req.body);
  const existing = await one('SELECT terms_version FROM creators WHERE user_id = $1', [req.user.id]);

  const accepting = data.terms_accept?.version === config.termsVersion;
  if (data.terms_accept && !accepting) {
    throw new HttpError(409, 'terms_version_mismatch', 'גרסת התנאים התעדכנה — יש לרענן את הדף', { current: config.termsVersion });
  }
  if (!existing && !accepting) {
    throw new HttpError(400, 'terms_required', 'יש לאשר את תנאי הקהילה', { fields: { terms_accept: 'יש לאשר את תנאי הקהילה' } });
  }

  const values = PROFILE_COLUMNS.map((c) => data[c]);
  await tx(async (db) => {
    if (!existing) {
      const cols = [...PROFILE_COLUMNS, 'terms_version', 'terms_ip'];
      await db.query(
        `INSERT INTO creators (user_id, ${cols.join(', ')}, terms_accepted_at)
         VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}, now())`,
        [req.user.id, ...values, config.termsVersion, req.ip],
      );
    } else {
      const sets = PROFILE_COLUMNS.map((c, i) => `${c} = $${i + 2}`);
      if (accepting) sets.push(`terms_version = $${values.length + 2}`, 'terms_accepted_at = now()', `terms_ip = $${values.length + 3}`);
      await db.query(
        `UPDATE creators SET ${sets.join(', ')}, updated_at = now() WHERE user_id = $1`,
        [req.user.id, ...values, ...(accepting ? [config.termsVersion, req.ip] : [])],
      );
    }

    await db.query('DELETE FROM creator_niches WHERE creator_id = $1', [req.user.id]);
    await db.query(
      `INSERT INTO creator_niches (creator_id, niche_id)
       SELECT $1, id FROM niches WHERE id = ANY($2::int[])`,
      [req.user.id, [...new Set(data.niches)]],
    );
    await db.query('DELETE FROM creator_links WHERE creator_id = $1', [req.user.id]);
    for (const [i, link] of data.links.entries()) {
      await db.query('INSERT INTO creator_links (creator_id, url, label, sort) VALUES ($1, $2, $3, $4)',
        [req.user.id, link.url, link.label, i]);
    }

    if (accepting) {
      await logEvent(req.user.id, 'terms_accepted',
        { version: config.termsVersion, ip: req.ip, read_to_end: data.terms_accept.read_to_end === true }, db);
    }
    await logEvent(req.user.id, existing ? 'profile_updated' : 'profile_created', null, db);
  });

  if (!existing) {
    await Promise.all([mails.signupReceived(req.user.email), mails.newSignup(data.full_name, req.user.email)]);
  }
  res.status(existing ? 200 : 201).json({ profile: await getCreatorProfile(req.user.id) });
});

/** Re-accept updated terms (the forced modal on login, spec §3.3). */
router.post('/terms', async (req, res) => {
  const { version, read_to_end } = parse(z.object({ version: z.string(), read_to_end: z.boolean().optional() }), req.body);
  if (version !== config.termsVersion) {
    throw new HttpError(409, 'terms_version_mismatch', 'גרסת התנאים התעדכנה — יש לרענן את הדף', { current: config.termsVersion });
  }
  const row = await one(
    `UPDATE creators SET terms_version = $2, terms_accepted_at = now(), terms_ip = $3, updated_at = now()
     WHERE user_id = $1 RETURNING terms_version, terms_accepted_at`,
    [req.user.id, version, req.ip],
  );
  if (!row) throw new HttpError(400, 'no_profile', 'יש להשלים את הפרופיל');
  await logEvent(req.user.id, 'terms_accepted', { version, ip: req.ip, read_to_end: read_to_end === true });
  res.json(row);
});

/** The app registers its push token after the user allows notifications. */
router.post('/devices', async (req, res) => {
  const { token, platform } = parse(z.object({
    token: z.string().min(20).max(4096),
    platform: z.enum(['ios', 'android']),
  }), req.body);
  await registerDevice(req.user.id, token, platform);
  res.json({ ok: true });
});

router.get('/applications', async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.status, a.message, a.applied_at, a.decided_at,
            c.slug, c.title, c.brand_display_name, c.type, c.status AS campaign_status,
            c.deadline_apply, c.deadline_publish
     FROM applications a JOIN campaigns c ON c.id = a.campaign_id
     WHERE a.creator_id = $1
     ORDER BY a.applied_at DESC`,
    [req.user.id],
  );
  res.json({ applications: rows });
});

export default router;
