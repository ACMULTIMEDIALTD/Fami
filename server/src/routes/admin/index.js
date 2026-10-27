import { Router } from 'express';
import { requireRole } from '../../lib/auth.js';
import overview from './overview.js';
import creators from './creators.js';
import brands from './brands.js';
import campaigns from './campaigns.js';
import applications from './applications.js';

const router = Router();
router.use(requireRole('admin'));
router.use('/overview', overview);
router.use('/creators', creators);
router.use('/brands', brands);
router.use('/campaigns', campaigns);
router.use('/applications', applications);

export default router;
