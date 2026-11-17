import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// The whole suite runs in demo mode against a scratch data folder (see playwright.config.mjs).
// Tests share that server and run in order; each one creates its own uniquely named post.
const origin = (baseURL) => new URL(baseURL).origin;
// The server writes its login key in the scratch data folder (see playwright.config.mjs).
const accessKey = readFileSync(new URL('../.e2e-run/.data/access.key', import.meta.url), 'utf8').trim();
const cookie = { Cookie: `studio_session=${accessKey}` };
const hasFfprobe = spawnSync('ffprobe', ['-version'], { stdio: 'ignore' }).status === 0;
// 1x1 PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');

async function createDraft(page, topic) {
  await page.getByLabel('Temi').fill(topic);
  await page.getByRole('button', { name: 'Genera una bozza' }).click();
  await expect(page.locator('#notice')).toHaveText('Bozza generata.');
  return page.locator('#posts article').filter({ hasText: topic }).first();
}

test.beforeEach(async ({ page }) => {
  await page.goto(`/?key=${accessKey}`); // logs in (cookie) and redirects to /
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#environment')).not.toHaveText('Caricamento');
});

test('starts in demo mode without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('heading', { name: /Calendario/ })).toBeVisible();
  await expect(page.locator('#environment')).toContainText(/prova/i);
  await expect(page.getByLabel('Modalità di Studio Social')).toHaveValue('demo');
  expect(errors).toEqual([]);
});

test('everything except the LinkedIn callback requires the login cookie', async ({ request, baseURL }) => {
  const headers = { Origin: origin(baseURL), 'Content-Type': 'application/json' };
  for (const path of ['/', '/app.js', '/api/status', '/api/configuration', '/media/00000000-0000-0000-0000-000000000000']) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  expect((await request.post('/api/new', { headers, data: { channel: 'linkedin', content: 'x' } })).status()).toBe(401);
  expect((await request.post('/api/new', { headers: { ...headers, Cookie: 'studio_session=wrong' }, data: {} })).status()).toBe(401);
  // The page itself must not hand out anything that grants access.
  const page = await (await request.get('/')).text();
  expect(page).not.toContain(accessKey);
  // The callback is exempt (it has its own state check) and must not leak a session.
  const callback = await request.get('/auth/linkedin/callback?state=x', { maxRedirects: 0 });
  expect(callback.status()).toBe(303);
  expect(callback.headers()['set-cookie']).toBeUndefined();
});

test('login key sets an HttpOnly cookie, a wrong key does not', async ({ request }) => {
  const wrong = await request.get(`/?key=${'0'.repeat(64)}`, { maxRedirects: 0 });
  expect(wrong.status()).toBe(401);
  expect(wrong.headers()['set-cookie']).toBeUndefined();
  const login = await request.get(`/?key=${accessKey}`, { maxRedirects: 0 });
  expect(login.status()).toBe(303);
  const setCookie = login.headers()['set-cookie'];
  expect(setCookie).toContain('studio_session=');
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('SameSite=Lax');
  expect((await request.get('/api/status', { headers: cookie })).status()).toBe(200);
});

test('API rejects requests from another origin even with the cookie', async ({ request, baseURL }) => {
  const headers = { ...cookie, 'Content-Type': 'application/json' };
  const own = await request.post('/api/new', { headers: { ...headers, Origin: origin(baseURL) }, data: { channel: 'linkedin', content: 'x' } });
  expect(own.status()).toBe(200);
  const foreign = await request.post('/api/new', { headers: { ...headers, Origin: 'https://evil.example' }, data: { channel: 'linkedin', content: 'x' } });
  expect(foreign.status()).toBe(403);
});

test('the page shows login instructions when the session is gone', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const response = await page.goto('/');
  expect(response.status()).toBe(401);
  await expect(page.locator('body')).toContainText('terminale');
  await context.close();
});

test('generates a draft from a brief', async ({ page }) => {
  const draft = await createDraft(page, 'Bozza generata dal test');
  await expect(draft).toContainText('Bozza');
  await expect(draft).toContainText('Testo di esempio');
  await expect(page.locator('#draft-count')).not.toHaveText('0');
});

test('edits and saves a draft', async ({ page }) => {
  const draft = await createDraft(page, 'Bozza da modificare');
  await draft.getByRole('button', { name: 'Modifica' }).click();
  const editor = page.locator('#editor');
  await expect(editor).toBeVisible();
  await editor.getByLabel('Testo').fill('Testo modificato dal test');
  await editor.getByRole('button', { name: 'Salva bozza' }).click();
  await expect(page.locator('#notice')).toHaveText('Bozza salvata.');
  await expect(page.locator('#posts')).toContainText('Testo modificato dal test');
});

test('publishes a post now (simulated)', async ({ page }) => {
  await page.getByRole('button', { name: 'Scrivi un post' }).click();
  const editor = page.locator('#editor');
  await editor.getByLabel('Testo').fill('Post pubblicato dal test');
  await editor.getByRole('button', { name: 'Salva bozza' }).click();
  await expect(page.locator('#notice')).toHaveText('Bozza salvata.');
  const post = page.locator('#posts').locator('article').filter({ hasText: 'Post pubblicato dal test' }).first();
  await post.getByRole('button', { name: 'Modifica' }).click();
  await editor.getByRole('button', { name: 'Pubblica ora' }).click();
  await expect(page.locator('#notice')).toHaveText('Post messo in coda.');
  await expect(post).toContainText('Invio simulato', { timeout: 20_000 });
  await expect(page.locator('#sent-count')).not.toHaveText('0');
});

test('schedules a post in the future', async ({ page }) => {
  await page.getByRole('button', { name: 'Scrivi un post' }).click();
  const editor = page.locator('#editor');
  await editor.getByLabel('Testo').fill('Post programmato dal test');
  await editor.getByRole('button', { name: 'Salva bozza' }).click();
  await expect(page.locator('#notice')).toHaveText('Bozza salvata.');
  const post = page.locator('#posts').locator('article').filter({ hasText: 'Post programmato dal test' }).first();
  await post.getByRole('button', { name: 'Modifica' }).click();
  const when = new Date(Date.now() + 2 * 86_400_000);
  const local = new Date(when.getTime() - when.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await editor.getByLabel(/Data e ora/).fill(local);
  await editor.getByRole('button', { name: 'Programma' }).click();
  await expect(page.locator('#notice')).toHaveText('Post programmato.');
  await expect(post).toContainText('In programma');
});

test('rejects a past date when scheduling', async ({ page }) => {
  await page.getByRole('button', { name: 'Scrivi un post' }).click();
  const editor = page.locator('#editor');
  await editor.getByLabel('Testo').fill('Post con data passata');
  await editor.getByRole('button', { name: 'Salva bozza' }).click();
  const post = page.locator('#posts').locator('article').filter({ hasText: 'Post con data passata' }).first();
  await post.getByRole('button', { name: 'Modifica' }).click();
  await editor.getByLabel(/Data e ora/).fill('2020-01-01T10:00');
  await editor.getByRole('button', { name: 'Programma' }).click();
  await expect(editor.locator('#editor-notice')).toContainText('data futura');
});

test('uploads a photo through the interface', async ({ page }) => {
  test.skip(!hasFfprobe, 'ffprobe (FFmpeg) is required for media uploads');
  await page.getByLabel('Canale').first().selectOption('linkedin');
  await page.locator('#plan-file').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#plan-media img, #plan-media video')).toBeVisible({ timeout: 15_000 });
});

test('account guides are available', async ({ page }) => {
  await page.getByRole('link', { name: 'Account' }).click();
  await page.getByText('Configura LinkedIn').click();
  await expect(page.locator('#linkedin-guide')).toHaveAttribute('open', '');
  await expect(page.locator('#linkedin-guide')).toContainText('Client ID');
});
