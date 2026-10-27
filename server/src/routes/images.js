import { Router } from 'express';
import { one } from '../db.js';
import { HttpError } from '../lib/http.js';
import { verifyImageSig } from '../lib/images.js';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No login check here: access is granted by the signed, expiring URL (see lib/images.js)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!UUID.test(id) || !verifyImageSig(id, req.query.exp, req.query.sig)) {
    throw new HttpError(403, 'forbidden');
  }
  const img = await one('SELECT mime, data FROM images WHERE id = $1', [id]);
  if (!img) throw new HttpError(404, 'not_found');
  res.set('Content-Type', img.mime);
  res.set('Cache-Control', 'private, max-age=86400, immutable');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // the app loads it from capacitor://localhost
  res.send(img.data);
});

export default router;
