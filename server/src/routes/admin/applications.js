import { Router } from 'express';
import { z } from 'zod';
import { tx } from '../../db.js';
import { HttpError, notFound, parse } from '../../lib/http.js';
import { logEvent } from '../../lib/events.js';
import { mails } from '../../lib/mailer.js';
import { sendPush } from '../../lib/push.js';

const router = Router();
const ADMIN_STATUSES = ['applied', 'selected', 'rejected', 'completed'];

/**
 * Updates applications and returns the rows that newly became 'selected'
 * (those creators get the "you were selected" email).
 */
async function updateApplications(adminId, ids, { status, admin_note }) {
  return tx(async (db) => {
    const { rows: before } = await db.query(
      `SELECT a.id, a.status, u.id AS user_id, u.email, c.title, c.slug, c.id AS campaign_id
       FROM applications a JOIN users u ON u.id = a.creator_id JOIN campaigns c ON c.id = a.campaign_id
       WHERE a.id = ANY($1::uuid[]) FOR UPDATE OF a`,
      [ids],
    );
    const idsFound = before.map((r) => r.id);
    if (status && idsFound.length) {
      // Only rows whose status actually changes, so decided_at stays meaningful
      await db.query(
        `UPDATE applications SET status = $2, decided_at = CASE WHEN $2 = 'applied' THEN NULL ELSE now() END
         WHERE id = ANY($1::uuid[]) AND status <> $2`,
        [idsFound, status],
      );
    }
    if (admin_note !== undefined && idsFound.length) {
      await db.query('UPDATE applications SET admin_note = $2 WHERE id = ANY($1::uuid[])', [idsFound, admin_note]);
    }
    const changed = status ? before.filter((r) => r.status !== status) : [];
    for (const r of changed) {
      await logEvent(adminId, status === 'selected' ? 'selected' : 'application_status_changed',
        { application_id: r.id, campaign_id: r.campaign_id, from: r.status, to: status }, db);
    }
    return { found: before.length, newlySelected: status === 'selected' ? changed : [] };
  });
}

async function notifySelected(rows) {
  await Promise.all(rows.map((r) => Promise.all([
    mails.selected(r.email, r),
    sendPush([r.user_id], { title: 'נבחרת! 🎉', body: `נבחרת לקמפיין "${r.title}". הבריף המלא מחכה לך.`, url: `/c/${r.slug}` }),
  ])));
}

const one = z.object({
  status: z.enum(ADMIN_STATUSES).optional(),
  admin_note: z.string().max(2000).nullable().optional(),
});

router.patch('/:id', async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) throw notFound('application_not_found');
  const data = parse(one, req.body);
  const { found, newlySelected } = await updateApplications(req.user.id, [req.params.id], data);
  if (!found) throw notFound('application_not_found');
  await notifySelected(newlySelected);
  res.json({ ok: true, updated: found });
});

const bulk = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(ADMIN_STATUSES),
});

router.post('/bulk', async (req, res) => {
  const { ids, status } = parse(bulk, req.body);
  const { found, newlySelected } = await updateApplications(req.user.id, ids, { status });
  if (!found) throw new HttpError(404, 'application_not_found');
  await notifySelected(newlySelected);
  res.json({ ok: true, updated: found, newly_selected: newlySelected.length });
});

export default router;
