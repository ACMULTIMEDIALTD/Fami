const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set (32+ chars) in production');
}

export const config = {
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/fami',
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-do-not-use-in-production',
  appUrl: (env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: (env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
  cookieSameSite: (env.COOKIE_SAMESITE || 'lax').toLowerCase(),
  termsVersion: env.CURRENT_TERMS_VERSION || '2026-10-v1',
  termsPdfUrl: env.TERMS_PDF_URL || '',
  whatsappGroupUrl: env.WHATSAPP_GROUP_URL || '',
  adminEmail: env.ADMIN_EMAIL || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  smtpUrl: env.SMTP_URL || '',
  mailFrom: env.MAIL_FROM || 'no-reply@example.com',
  notifyEmail: env.NOTIFY_EMAIL || env.ADMIN_EMAIL || '',
};
