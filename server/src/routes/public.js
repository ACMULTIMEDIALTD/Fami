import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db.js';
import { config } from '../config.js';
import { parse } from '../lib/http.js';
import { logEvent } from '../lib/events.js';
import { mails } from '../lib/mailer.js';

const router = Router();

/** Lookup lists + current terms — needed by the signup wizard. */
router.get('/meta', async (_req, res) => {
  const [niches, regions] = await Promise.all([
    query('SELECT id, name FROM niches ORDER BY sort, id'),
    query('SELECT id, name FROM regions ORDER BY sort, id'),
  ]);
  res.json({
    niches: niches.rows,
    regions: regions.rows,
    terms: { version: config.termsVersion, pdf_url: config.termsPdfUrl },
    mail_enabled: config.mailEnabled,
  });
});

const inquiryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: config.isTest ? 10_000 : 5, legacyHeaders: false });

const inquirySchema = z.object({
  name: z.string().trim().min(2, 'שדה חובה').max(100),
  brand: z.string().trim().min(1, 'שדה חובה').max(100),
  phone: z.string().trim().min(9, 'מספר טלפון לא תקין').max(30),
  email: z.string().trim().email('כתובת מייל לא תקינה').max(200),
  message: z.string().trim().max(2000).optional().default(''),
  website: z.string().optional(), // honeypot — real users never fill it
});

router.post('/brand-inquiry', inquiryLimiter, async (req, res) => {
  const { website, ...data } = parse(inquirySchema, req.body);
  if (!website) {
    await logEvent(null, 'brand_inquiry', data);
    await mails.brandInquiry(data);
  }
  res.json({ ok: true });
});

export default router;
