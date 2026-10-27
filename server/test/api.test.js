import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, outbox, pushOutbox, app, agent, resetDb, loginAdmin, makeCreator, campaignBody, profile } from './helpers.js';
import request from 'supertest';

let admin;
before(async () => { await resetDb(); admin = await loginAdmin(); });
after(() => pool.end());

test('only landing-type endpoints are public', async () => {
  const anon = agent();
  await anon.get('/api/v1/public/meta').expect(200);
  await anon.get('/api/v1/campaigns').expect(401);
  await anon.get('/api/v1/campaigns/whatever').expect(401);
  await anon.get('/api/v1/admin/creators').expect(401);
});

test('signup → profile requires terms → pending', async () => {
  const a = agent();
  const r = await a.post('/api/v1/auth/signup').send({ email: 'New@Test.local', phone: '+972 52-111-2233' }).expect(201);
  assert.equal(r.body.user.status, 'pending');
  assert.equal(r.body.user.phone, '0521112233');
  await agent().post('/api/v1/auth/signup').send({ email: 'new@test.local', phone: '0529999999' }).expect(409);

  const me = await a.get('/api/v1/auth/me').expect(200);
  assert.equal(me.body.needs_profile, true);
  assert.equal(me.body.whatsapp_group_url, null);

  const noTerms = profile(); delete noTerms.terms_accept;
  const bad = await a.put('/api/v1/me/profile').send(noTerms).expect(400);
  assert.equal(bad.body.error, 'terms_required');

  const noSocial = await a.put('/api/v1/me/profile').send(profile({ instagram_handle: '' })).expect(400);
  assert.ok(noSocial.body.fields.instagram_handle);

  const ok = await a.put('/api/v1/me/profile').send(profile({ instagram_handle: 'https://instagram.com/noa.test/' })).expect(201);
  assert.equal(ok.body.profile.instagram_handle, 'noa.test');
  assert.equal(ok.body.profile.terms_version, '2026-10-v1');
  assert.equal(ok.body.profile.tier, undefined, 'admin-only fields hidden from creator');
  assert.deepEqual(ok.body.profile.niche_ids, [1, 2]);

  // Admin got a notification, creator got a confirmation
  assert.ok(outbox.some((m) => m.to === 'admin@test.local'));
  assert.ok(outbox.some((m) => m.to === 'new@test.local'));

  // Pending creators don't see the board
  const board = await a.get('/api/v1/campaigns').expect(200);
  assert.equal(board.body.locked, true);
  // ...and can't reach admin
  await a.get('/api/v1/admin/creators').expect(403);
});

test('magic link login', async () => {
  const { email } = await makeCreator({ admin });
  outbox.length = 0;
  await agent().post('/api/v1/auth/login').send({ email: 'nobody@test.local' }).expect(200);
  assert.equal(outbox.length, 0);
  await agent().post('/api/v1/auth/login').send({ email, next: '/c/abc' }).expect(200);
  const link = outbox.at(-1).text.match(/http:\/\/app\.test(\S+)/)[1];
  assert.match(link, /^\/m\/[\w-]+\?next=%2Fc%2Fabc$/);
  const token = link.split('/')[2].split('?')[0];

  const a = agent();
  await a.post('/api/v1/auth/magic').send({ token }).expect(200);
  await a.get('/api/v1/auth/me').expect(200);
  // single use
  const again = await agent().post('/api/v1/auth/magic').send({ token }).expect(410);
  assert.equal(again.body.error, 'link_expired');

  // legacy GET link still redirects
  await agent().post('/api/v1/auth/login').send({ email }).expect(200);
  const t2 = outbox.at(-1).text.match(/\/m\/([\w-]+)/)[1];
  const r = await agent().get(`/api/v1/auth/magic/${t2}`).expect(302);
  assert.equal(r.headers.location, 'http://app.test/dashboard');
});

test('campaign flow: eligibility, visibility, select, close', async () => {
  const big = await makeCreator({ admin, instagram_followers: 12000 });
  const small = await makeCreator({ admin, instagram_followers: 1000 });
  const barterOnly = await makeCreator({ admin, open_to_paid: false });
  const third = await makeCreator({ admin });

  const c = (await admin.post('/api/v1/admin/campaigns').send(campaignBody()).expect(201)).body.campaign;
  assert.equal(c.status, 'open');
  const draft = (await admin.post('/api/v1/admin/campaigns').send(campaignBody({ status: undefined, title: 'טיוטה' })).expect(201)).body.campaign;
  assert.equal(draft.status, 'draft');

  // Board never leaks brief/payment, and drafts are invisible
  const board = await big.agent.get('/api/v1/campaigns').expect(200);
  assert.equal(board.body.campaigns.length, 1);
  const card = board.body.campaigns[0];
  assert.equal(card.full_brief, undefined);
  assert.equal(card.payment_note, undefined);
  assert.equal(card.eligibility.ok, true);
  assert.ok(!JSON.stringify(board.body).includes('SECRET'));
  await big.agent.get(`/api/v1/campaigns/${draft.slug}`).expect(404);

  // Blocked reasons
  const s = await small.agent.get(`/api/v1/campaigns/${c.slug}`).expect(200);
  assert.equal(s.body.eligibility.reason, 'min_followers');
  assert.equal(s.body.eligibility.message, 'דרוש מינימום 5,000 עוקבים');
  const sa = await small.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({}).expect(422);
  assert.equal(sa.body.error, 'min_followers');
  const b = await barterOnly.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({}).expect(422);
  assert.equal(b.body.error, 'not_open_to_paid');

  // Apply, double apply, withdraw, re-apply
  await big.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({ message: 'x'.repeat(301) }).expect(400);
  await big.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({ message: 'מתאימה!' }).expect(201);
  const dup = await big.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({}).expect(422);
  assert.equal(dup.body.error, 'already_applied');
  await big.agent.delete(`/api/v1/campaigns/${c.slug}/apply`).expect(200);
  await big.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({ message: 'שוב' }).expect(201);
  await third.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({}).expect(201);

  // Admin applications table
  const apps = await admin.get(`/api/v1/admin/campaigns/${c.id}/applications`).expect(200);
  assert.equal(apps.body.applications.length, 2);
  assert.equal(apps.body.campaign.applied_count, 2);
  const bigApp = apps.body.applications.find((x) => x.creator_id === big.id);
  assert.equal(bigApp.message, 'שוב');

  // Not selected yet → still no brief
  let d = await big.agent.get(`/api/v1/campaigns/${c.slug}`).expect(200);
  assert.equal(d.body.campaign.full_brief, undefined);

  outbox.length = 0;
  await admin.post('/api/v1/admin/applications/bulk').send({ ids: [bigApp.id], status: 'selected' }).expect(200);
  assert.equal(outbox.filter((m) => m.to === big.email).length, 1);
  // selecting again doesn't re-email
  await admin.patch(`/api/v1/admin/applications/${bigApp.id}`).send({ status: 'selected', admin_note: 'מעולה' }).expect(200);
  assert.equal(outbox.filter((m) => m.to === big.email).length, 1);

  d = await big.agent.get(`/api/v1/campaigns/${c.slug}`).expect(200);
  assert.equal(d.body.selected, true);
  assert.equal(d.body.campaign.full_brief, 'BRIEF-SECRET');
  assert.equal(d.body.campaign.payment_note, 'PAY-SECRET ₪400');
  // ...but the list endpoint still never includes it
  const mine = await big.agent.get('/api/v1/me/applications').expect(200);
  assert.ok(!JSON.stringify(mine.body).includes('SECRET'));
  await big.agent.delete(`/api/v1/campaigns/${c.slug}/apply`).expect(409);

  // WhatsApp text + CSV
  const wa = await admin.get(`/api/v1/admin/campaigns/${c.id}/whatsapp-text`).expect(200);
  assert.match(wa.body.text, /^📣 קמפיין חדש: קמפיין קוסמטיקה\n/);
  assert.match(wa.body.text, /בתשלום · מינימום 5,000 עוקבים/);
  assert.match(wa.body.text, new RegExp(`👉 http://app.test/c/${c.slug}$`));
  assert.ok(!wa.body.text.includes('SECRET'));
  const csv = await admin.get(`/api/v1/admin/campaigns/${c.id}/export.csv`).expect(200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.equal(csv.text.trim().split('\r\n').length, 2);

  // Close → remaining applied become rejected
  const closed = await admin.patch(`/api/v1/admin/campaigns/${c.id}`).send({ status: 'closed' }).expect(200);
  assert.equal(closed.body.auto_rejected, 1);
  const t = await third.agent.get('/api/v1/me/applications').expect(200);
  assert.equal(t.body.applications[0].status, 'rejected');
  // closed campaign: still visible to applicants, gone for others
  await third.agent.get(`/api/v1/campaigns/${c.slug}`).expect(200);
  await small.agent.get(`/api/v1/campaigns/${c.slug}`).expect(404);
});

test('niche / region / barter rules', async () => {
  const north = await makeCreator({ admin, region_id: 1, niches: [3] });
  const c = (await admin.post('/api/v1/admin/campaigns')
    .send(campaignBody({ type: 'barter', min_followers: 0, region_ids: [5], required_niche_ids: [3] })).expect(201)).body.campaign;
  const r = await north.agent.get(`/api/v1/campaigns/${c.slug}`).expect(200);
  assert.equal(r.body.eligibility.reason, 'region');
  assert.match(r.body.eligibility.message, /תל אביב/);
  await admin.patch(`/api/v1/admin/campaigns/${c.id}`).send({ region_ids: [] }).expect(200);
  const r2 = await north.agent.get(`/api/v1/campaigns/${c.slug}`).expect(200);
  assert.equal(r2.body.eligibility.ok, true);
});

test('deadline passed blocks apply and hides from board', async () => {
  const cr = await makeCreator({ admin });
  const c = (await admin.post('/api/v1/admin/campaigns').send(campaignBody({ min_followers: 0 })).expect(201)).body.campaign;
  await pool.query(`UPDATE campaigns SET deadline_apply = now() - interval '1 minute' WHERE id = $1`, [c.id]);
  const res = await cr.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({}).expect(422);
  assert.equal(res.body.error, 'deadline_passed');
  const board = await cr.agent.get('/api/v1/campaigns').expect(200);
  assert.ok(!board.body.campaigns.some((x) => x.slug === c.slug));
});

test('terms re-accept when version changes', async () => {
  const cr = await makeCreator({ admin });
  await pool.query(`UPDATE creators SET terms_version = '2025-01-v0' WHERE user_id = $1`, [cr.id]);
  const me = await cr.agent.get('/api/v1/auth/me').expect(200);
  assert.equal(me.body.needs_terms, true);
  const c = (await admin.post('/api/v1/admin/campaigns').send(campaignBody({ min_followers: 0 })).expect(201)).body.campaign;
  assert.equal((await cr.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({}).expect(422)).body.error, 'terms_outdated');
  await cr.agent.post('/api/v1/me/terms').send({ version: 'old' }).expect(409);
  await cr.agent.post('/api/v1/me/terms').send({ version: '2026-10-v1' }).expect(200);
  assert.equal((await cr.agent.get('/api/v1/auth/me')).body.needs_terms, false);
  await cr.agent.post(`/api/v1/campaigns/${c.slug}/apply`).send({}).expect(201);
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM events WHERE user_id = $1 AND type = 'terms_accepted'`, [cr.id]);
  assert.equal(rows[0].n, 2);
});

test('admin creators: filters, patch, CSV, suspend', async () => {
  const a = await makeCreator({ admin, full_name: 'דנה פילטר', instagram_followers: 50000, niches: [4], region_id: 2 });
  let r = await admin.get('/api/v1/admin/creators?q=פילטר').expect(200);
  assert.equal(r.body.creators.length, 1);
  assert.deepEqual(r.body.creators[0].niches, ['אוכל']);
  r = await admin.get('/api/v1/admin/creators?niche=4&min_followers=40000&region=2&open_to=paid').expect(200);
  assert.deepEqual(r.body.creators.map((x) => x.id), [a.id]);
  r = await admin.get('/api/v1/admin/creators?status=pending').expect(200);
  assert.ok(r.body.creators.every((x) => x.status === 'pending'));

  await admin.patch(`/api/v1/admin/creators/${a.id}`).send({ tier: 'A', internal_rating: 5, admin_notes: 'מעולה' }).expect(200);
  r = await admin.get(`/api/v1/admin/creators/${a.id}`).expect(200);
  assert.equal(r.body.profile.tier, 'A');
  assert.ok(r.body.events.length > 0);
  await admin.patch(`/api/v1/admin/creators/${a.id}`).send({ internal_rating: 9 }).expect(400);

  const csv = await admin.get('/api/v1/admin/creators/export.csv?tier=A').expect(200);
  assert.ok(csv.text.startsWith('﻿'));
  assert.match(csv.text, /דנה פילטר/);

  await admin.patch(`/api/v1/admin/creators/${a.id}`).send({ status: 'suspended' }).expect(200);
  await a.agent.get('/api/v1/auth/me').expect(403);

  // Can't approve someone with no profile
  const bare = agent();
  const u = (await bare.post('/api/v1/auth/signup').send({ email: 'bare@test.local', phone: '0541231234' }).expect(201)).body.user;
  await admin.patch(`/api/v1/admin/creators/${u.id}`).send({ status: 'active' }).expect(400);
});

test('brands CRUD + campaign delete rules', async () => {
  const b = (await admin.post('/api/v1/admin/brands').send({ name: 'לוריאל', contact_email: 'x@y.com' }).expect(201)).body.brand;
  const c = (await admin.post('/api/v1/admin/campaigns').send(campaignBody({ brand_id: b.id })).expect(201)).body.campaign;
  await admin.delete(`/api/v1/admin/brands/${b.id}`).expect(409);
  await admin.delete(`/api/v1/admin/campaigns/${c.id}`).expect(409);
  await admin.patch(`/api/v1/admin/brands/${b.id}`).send({ notes: 'חתמו' }).expect(200);
  const list = await admin.get('/api/v1/admin/brands').expect(200);
  assert.equal(list.body.brands.find((x) => x.id === b.id).campaign_count, 1);
  await admin.post('/api/v1/admin/campaigns').send(campaignBody({ slug: c.slug })).expect(409);
});

test('brand inquiry emails Noa; honeypot is silently dropped', async () => {
  outbox.length = 0;
  const body = { name: 'רון', brand: 'מותג', phone: '0501112222', email: 'ron@brand.co.il', message: 'היי' };
  await agent().post('/api/v1/public/brand-inquiry').send({ ...body, website: 'spam' }).expect(200);
  assert.equal(outbox.length, 0);
  await agent().post('/api/v1/public/brand-inquiry').send(body).expect(200);
  assert.equal(outbox[0].to, 'admin@test.local');
});

test('native app: bearer token auth, push devices, push triggers', async () => {
  const { email, id } = await makeCreator({ admin, instagram_followers: 9000, niches: [2] });
  const other = await makeCreator({ admin, instagram_followers: 500 });

  // Browser login → no token in the body; app login → token
  const web = await agent().post('/api/v1/auth/login').send({ email, password: 'password123' }).expect(200);
  assert.equal(web.body.token, undefined);
  const login = await request(app).post('/api/v1/auth/login').set('X-Client', 'app')
    .send({ email, password: 'password123' }).expect(200);
  const token = login.body.token;
  assert.ok(token);

  const bearer = (m, url) => request(app)[m](url).set('Authorization', `Bearer ${token}`).set('X-Client', 'app');
  assert.equal((await bearer('get', '/api/v1/auth/me').expect(200)).body.user.id, id);
  await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer nope').expect(401);

  // CORS allows the Capacitor WebView origins
  const pre = await request(app).options('/api/v1/auth/me').set('Origin', 'capacitor://localhost').set('Access-Control-Request-Method', 'GET');
  assert.equal(pre.headers['access-control-allow-origin'], 'capacitor://localhost');

  // Register both creators' phones
  await bearer('post', '/api/v1/me/devices').send({ token: 'fcm-token-'.padEnd(40, 'a'), platform: 'ios' }).expect(200);
  await bearer('post', '/api/v1/me/devices').send({ token: 'x', platform: 'ios' }).expect(400);
  const otherLogin = await request(app).post('/api/v1/auth/login').set('X-Client', 'app').send({ email: other.email, password: 'password123' });
  await request(app).post('/api/v1/me/devices').set('Authorization', `Bearer ${otherLogin.body.token}`)
    .send({ token: 'fcm-other-'.padEnd(40, 'b'), platform: 'android' }).expect(200);

  // Opening a campaign pushes only to creators who are eligible
  pushOutbox.length = 0;
  const c = (await admin.post('/api/v1/admin/campaigns').send(campaignBody({ min_followers: 5000, required_niche_ids: [2] })).expect(201)).body.campaign;
  assert.equal(pushOutbox.length, 1);
  assert.deepEqual(pushOutbox[0].userIds, [id]);
  assert.equal(pushOutbox[0].url, `/c/${c.slug}`);

  // Draft → open via PATCH also pushes; editing an open campaign does not
  pushOutbox.length = 0;
  const d = (await admin.post('/api/v1/admin/campaigns').send(campaignBody({ status: undefined, min_followers: 0 })).expect(201)).body.campaign;
  assert.equal(pushOutbox.length, 0);
  await admin.patch(`/api/v1/admin/campaigns/${d.id}`).send({ status: 'open' }).expect(200);
  assert.equal(pushOutbox.length, 1);
  assert.equal(pushOutbox[0].userIds.length, 2);
  await admin.patch(`/api/v1/admin/campaigns/${d.id}`).send({ title: 'שם חדש' }).expect(200);
  assert.equal(pushOutbox.length, 1);

  // Selected → push to that creator
  await bearer('post', `/api/v1/campaigns/${c.slug}/apply`).send({}).expect(201);
  const apps = await admin.get(`/api/v1/admin/campaigns/${c.id}/applications`).expect(200);
  pushOutbox.length = 0;
  await admin.post('/api/v1/admin/applications/bulk').send({ ids: [apps.body.applications[0].id], status: 'selected' }).expect(200);
  assert.equal(pushOutbox.length, 1);
  assert.match(pushOutbox[0].title, /נבחרת/);

  // Logout with the push token unregisters the phone
  await bearer('post', '/api/v1/auth/logout').send({ push_token: 'fcm-token-'.padEnd(40, 'a') }).expect(200);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM push_devices WHERE user_id = $1', [id]);
  assert.equal(rows[0].n, 0);
});
