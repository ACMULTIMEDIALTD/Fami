import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db.js';
import { HttpError } from './http.js';

export const COOKIE = 'fami_session';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000; // 30 days — creators come back from WhatsApp links

const cookieOpts = () => ({
  httpOnly: true,
  secure: config.cookieSecure || config.cookieSameSite === 'none',
  sameSite: config.cookieSameSite,
  path: '/',
});

export function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: Math.floor(MAX_AGE_MS / 1000) });
  res.cookie(COOKIE, token, { ...cookieOpts(), maxAge: MAX_AGE_MS });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, cookieOpts());
}

/**
 * Reads the session cookie and loads the user fresh from the DB on every request,
 * so role/status changes (e.g. suspension) take effect immediately.
 */
export async function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const { sub } = jwt.verify(token, config.jwtSecret);
    req.user = await one('SELECT id, email, phone, role, status FROM users WHERE id = $1', [sub]);
  } catch {
    // invalid/expired token → treat as anonymous
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'unauthenticated', 'יש להתחבר'));
  if (req.user.status === 'suspended' || req.user.status === 'left') {
    return next(new HttpError(403, 'account_inactive', 'החשבון אינו פעיל'));
  }
  next();
}

export const requireRole = (role) => [
  requireAuth,
  (req, _res, next) => (req.user.role === role ? next() : next(new HttpError(403, 'forbidden'))),
];
