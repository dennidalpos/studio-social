import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// The whole suite runs in demo mode against a scratch data folder (see playwright.config.mjs).
// Tests share that server and run in order; each one creates its own uniquely named post.
const origin = (baseURL) => new URL(baseURL).origin;
// The server writes its login key in the scratch data folder (see playwright.config.mjs).
const accessKey = readFileSync(new URL('../.e2e-run/.data/access.key', import.meta.url), 'utf8').trim();
const cookie = { Cookie: `studio_session_3100=${accessKey}` };
const hasFfprobe = spawnSync('ffprobe', ['-version'], { stdio: 'ignore' }).status === 0;
// 1x1 PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');

async function createDraft(page, topic) {
  await page.getByLabel('Temi').fill(topic);
  await page.getByRole('button', { name: 'Genera una bozza' }).click();
  await expect(page.locator('#notice')).toHaveText('Bozza generata.');
  return page.locator('#posts article').filter({ hasText: topic }).first();
}

test.beforeEach(async ({ page }, testInfo) => {
  // Tests run in the advanced view unless their title starts with "simple:"; the choice is only seeded once.
  await page.addInitScript((view) => {
    if (!localStorage.getItem('studio-view')) localStorage.setItem('studio-view', view);
    if (!localStorage.getItem('studio-lang')) localStorage.setItem('studio-lang', 'it');
  }, testInfo.title.startsWith('simple:') ? 'simple' : 'advanced');
  await page.goto(`/?key=${accessKey}`); // logs in (cookie) and redirects to /
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('body')).toHaveAttribute('data-view', /simple|advanced/);
  if (!testInfo.title.startsWith('simple:')) await expect(page.locator('#environment')).not.toHaveText('Caricamento');
});

test('starts in demo mode without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('heading', { name: /Calendario/ })).toBeVisible();
  await expect(page.locator('#environment')).toContainText(/demo · invii simulati/i);
  await expect(page.getByLabel('Ambiente di Studio Social')).toHaveValue('demo');
  expect(errors).toEqual([]);
});

test('everything except the LinkedIn callback requires the login cookie', async ({ request, baseURL }) => {
  const headers = { Origin: origin(baseURL), 'Content-Type': 'application/json' };
  for (const path of ['/', '/app.js', '/api/status', '/api/configuration', '/media/00000000-0000-0000-0000-000000000000']) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  expect((await request.post('/api/new', { headers, data: { channel: 'linkedin', content: 'x' } })).status()).toBe(401);
  expect((await request.post('/api/new', { headers: { ...headers, Cookie: 'studio_session_3100=wrong' }, data: {} })).status()).toBe(401);
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
  expect(setCookie).toContain('studio_session_3100=');
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

test('the bar stays visible, the menu marks the section and back-to-top works', async ({ page }) => {
  await expect(page.locator('#to-top')).toBeHidden();
  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.locator('#account')).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Account' })).toHaveAttribute('aria-current', 'location');
  // The bar is pinned and the section starts below it, not under it.
  const bar = await page.locator('.bar').boundingBox();
  const section = await page.locator('#account').boundingBox();
  expect(bar.y).toBe(0);
  expect(section.y).toBeGreaterThanOrEqual(bar.height - 1);
  await expect(page.locator('#to-top')).toBeVisible();
  await page.locator('#to-top').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('#to-top')).toBeHidden();
  // A reload never restores a scroll position in the middle of the page.
  await page.getByRole('link', { name: 'Account' }).click();
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0); // explicit #account is honoured
  await page.goto('/');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('the mode pill explains the mode and leads to the setting', async ({ page }) => {
  const pill = page.locator('#environment');
  await expect(pill).toHaveAttribute('title', /nulla viene inviato/);
  await pill.click();
  await expect(page.locator('#account')).toBeInViewport();
  await expect(page.getByLabel('Ambiente di Studio Social')).toBeVisible();
  await expect(page.locator('#mode-help')).toContainText('simulati');
});

test('errors are announced as alerts and stay visible under the bar', async ({ page }) => {
  await page.getByRole('button', { name: 'Scrivi un post' }).click();
  await page.getByRole('button', { name: 'Salva bozza' }).click();
  await expect(page.locator('#editor-notice')).toHaveAttribute('role', 'alert');
  await page.locator('#close-editor').click();
  await page.getByRole('link', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Applica ambiente' }).click();
  await expect(page.locator('#config-notice')).toHaveText('Questa modalità è già attiva.');
});

test('simple: opens without accounts, plan or mode pill', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Scrivi, controlla/ })).toBeVisible();
  await expect(page.locator('#piano')).toBeHidden();
  await expect(page.locator('#account')).toBeHidden();
  await expect(page.locator('#environment')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Copia e apri LinkedIn' })).toBeDisabled();
});

test('simple: previews the text and counts characters per social', async ({ page }) => {
  await page.getByLabel('Testo del post').fill('Ciao mondo');
  await expect(page.locator('#simple-preview')).toHaveText('Ciao mondo');
  await expect(page.locator('#simple-count')).toHaveText('10 / 3000 caratteri');
  await page.locator('#simple-form').getByText('Instagram', { exact: true }).click();
  await expect(page.locator('#simple-count')).toHaveText('10 / 2200 caratteri');
  await expect(page.getByRole('button', { name: 'Copia e apri Instagram' })).toBeEnabled();
  await page.getByLabel('Testo del post').fill('x'.repeat(2250));
  await expect(page.locator('#simple-count')).toContainText('50 caratteri in più');
  await expect(page.getByRole('button', { name: 'Copia e apri Instagram' })).toBeDisabled();
});

test('simple: copies the text and opens LinkedIn with the post already written', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route('https://www.linkedin.com/**', (route) => route.fulfill({ contentType: 'text/html', body: 'ok' }));
  const text = 'Primo post: caffè & idee #test';
  await page.getByLabel('Testo del post').fill(text);
  const popup = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Copia e apri LinkedIn' }).click();
  const opened = await popup;
  const url = new URL(opened.url());
  expect(url.origin + url.pathname).toBe('https://www.linkedin.com/feed/');
  expect(url.searchParams.get('shareActive')).toBe('true');
  expect(url.searchParams.get('text')).toBe(text);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  await expect(page.locator('#simple-notice')).toContainText('Testo copiato');
});

test('simple: the AI button writes the post from a request', async ({ page }) => {
  await page.getByRole('button', { name: 'Scrivi con l’AI' }).click();
  await expect(page.locator('#simple-notice')).toHaveText('Scrivi cosa vuoi dire all’AI.');
  await page.getByLabel('Chiedi all’AI').fill('Annuncia il corso di fotografia');
  await expect(page.locator('#simple-web')).toBeEnabled();
  await page.getByRole('button', { name: 'Scrivi con l’AI' }).click();
  await expect(page.locator('#simple-notice')).toContainText('Testo scritto dall’AI');
  await expect(page.getByLabel('Testo del post')).toHaveValue(/^Annuncia il corso di fotografia/);
  await expect(page.locator('#simple-preview')).toContainText('Annuncia il corso di fotografia');
  await expect(page.getByRole('button', { name: 'Copia e apri LinkedIn' })).toBeEnabled();
});

test('improves the plan fields from generic words and offers the web toggle', async ({ page }) => {
  // Earlier tests saved a plan: start from empty fields.
  for (const name of ['topic', 'audience', 'tone', 'facts']) await page.locator(`#plan [name=${name}]`).fill('');
  await page.getByRole('button', { name: 'Migliora i campi con l’AI' }).click();
  await expect(page.locator('#notice')).toHaveText('Scrivi almeno una parola in uno dei campi.');
  await page.getByLabel('Temi').fill('progetti');
  await page.getByRole('button', { name: 'Migliora i campi con l’AI' }).click();
  await expect(page.locator('#notice')).toHaveText('Campi migliorati. Controllali e salva il piano.');
  await expect(page.locator('#plan [name=audience]')).not.toHaveValue('');
  await expect(page.locator('#plan [name=tone]')).not.toHaveValue('');
  const web = page.locator('#plan-web');
  await expect(web).toBeEnabled();
  await web.check();
  await page.getByRole('button', { name: 'Salva piano' }).click();
  await expect(page.locator('#notice')).toHaveText('Piano salvato.');
  await page.reload();
  await expect(page.locator('#plan-web')).toBeChecked();
  await page.locator('#plan-web').uncheck();
  await page.getByRole('button', { name: 'Salva piano' }).click();
  await expect(page.locator('#notice')).toHaveText('Piano salvato.');
});

test('deletes a draft after confirming, from the card and from the editor', async ({ page }) => {
  const first = await createDraft(page, 'Bozza da eliminare dalla card');
  page.once('dialog', dialog => { expect(dialog.message()).toContain('Eliminare questo post?'); void dialog.dismiss(); });
  await first.getByRole('button', { name: 'Elimina' }).click();
  await expect(first).toBeVisible();
  page.once('dialog', dialog => void dialog.accept());
  await first.getByRole('button', { name: 'Elimina' }).click();
  await expect(page.locator('#notice')).toHaveText('Post eliminato.');
  await expect(page.locator('#posts article').filter({ hasText: 'Bozza da eliminare dalla card' })).toHaveCount(0);

  const second = await createDraft(page, 'Bozza da eliminare dall’editor');
  await second.getByRole('button', { name: 'Modifica' }).click();
  page.once('dialog', dialog => void dialog.accept());
  await page.locator('#delete-post').click();
  await expect(page.locator('#editor')).not.toBeVisible();
  await expect(page.locator('#posts article').filter({ hasText: 'Bozza da eliminare dall’editor' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Scrivi un post' }).click();
  await expect(page.locator('#delete-post')).toBeHidden();
  await page.locator('#close-editor').click();
});

test('clears all the test posts in demo mode', async ({ page }) => {
  await createDraft(page, 'Prova da svuotare');
  await expect(page.locator('#clear-demo')).toBeVisible();
  page.once('dialog', dialog => void dialog.accept());
  await page.locator('#clear-demo').click();
  await expect(page.locator('#notice')).toHaveText('Post di prova eliminati.');
  await expect(page.locator('#posts .post-item')).toHaveCount(0);
  await expect(page.locator('#clear-demo')).toBeHidden();
});

test('the menu marks one place only, also when plan and posts sit side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect(page.locator('nav a[aria-current]')).toHaveCount(1);
  await expect(page.locator('nav a[aria-current]')).toHaveText('Piano');
  await page.locator('nav a[href="#post"]').click();
  await expect(page.locator('nav a[aria-current]')).toHaveText('Post');
  await expect(page.locator('nav a[aria-current]')).toHaveCount(1);
});

test('simple: the draft and the chosen view are remembered', async ({ page }) => {
  await page.getByLabel('Testo del post').fill('Bozza da ritrovare');
  await page.reload();
  await expect(page.getByLabel('Testo del post')).toHaveValue('Bozza da ritrovare');
  await page.getByRole('button', { name: 'Passa alla modalità avanzata' }).click();
  await expect(page.getByRole('heading', { name: /Calendario/ })).toBeVisible();
  await expect(page.locator('#simple')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Calendario/ })).toBeVisible();
  await page.getByRole('button', { name: 'Passa alla modalità semplice' }).click();
  await expect(page.getByRole('heading', { name: /Scrivi, controlla/ })).toBeVisible();
});

test('account guides open one at a time', async ({ page }) => {
  await page.getByRole('link', { name: 'Account' }).click();
  await page.getByText('Configura LinkedIn').click();
  await page.getByText('Configura Facebook').click();
  await expect(page.locator('#facebook-guide')).toHaveAttribute('open', '');
  await expect(page.locator('#linkedin-guide')).not.toHaveAttribute('open', '');
});

test('account guides are available', async ({ page }) => {
  await page.getByRole('link', { name: 'Account' }).click();
  await page.getByText('Configura LinkedIn').click();
  await expect(page.locator('#linkedin-guide')).toHaveAttribute('open', '');
  await expect(page.locator('#linkedin-guide')).toContainText('Client ID');
});

test('lists the models of a provider and fills the model field', async ({ page }) => {
  let sent;
  await page.route('**/api/models', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { models: [
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (claude-sonnet-5-5)' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (claude-haiku-5-5)' },
    ] } });
  });
  await page.getByText('Configura i provider AI').click();
  await page.locator('summary', { hasText: /^Claude$/ }).click();
  const claude = page.locator('form[data-configuration="claude"]');
  await claude.getByLabel('Chiave API Anthropic', { exact: true }).fill('sk-test-key');
  await claude.getByRole('button', { name: 'Elenca modelli' }).click();
  const list = claude.getByLabel(/Modelli disponibili/);
  await expect(list).toBeVisible();
  await expect(claude.locator('.form-notice')).toContainText('2 modelli disponibili');
  expect(sent.group).toBe('claude');
  expect(sent.values.ANTHROPIC_API_KEY).toBe('sk-test-key');
  await list.selectOption('claude-haiku-5-5');
  await expect(claude.getByLabel('Modello Claude', { exact: true })).toHaveValue('claude-haiku-5-5');
});

test('asks for the API key before listing models', async ({ page }) => {
  await page.getByText('Configura i provider AI').click();
  await page.locator('summary', { hasText: /^OpenAI$/ }).click();
  const openai = page.locator('form[data-configuration="openai"]');
  await openai.getByRole('button', { name: 'Elenca modelli' }).click();
  await expect(openai.locator('.form-notice')).toContainText('Inserisci la chiave API');
  await expect(openai.getByLabel(/Modelli disponibili/)).toBeHidden();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('keeps the section menu, does not scroll sideways and has 44px targets', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Navigazione' })).toBeVisible();
    await page.getByRole('link', { name: 'Account' }).click();
    await expect(page.locator('#account')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    const short = await page.evaluate(() => [...document.querySelectorAll('button, select, summary, input:not([type=hidden]):not([type=checkbox]):not([type=radio])')]
      .filter((element) => { const box = element.getBoundingClientRect(); return box.width && box.height && box.height < 43.5; })
      .map((element) => element.textContent.trim().slice(0, 20) || element.name));
    expect(short).toEqual([]);
  });
});

test.describe('simple view on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('simple: fits the screen and has 44px targets', async ({ page }) => {
    await page.getByLabel('Testo del post').fill('Prova su telefono');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    const short = await page.evaluate(() => [...document.querySelectorAll('button, select, summary, textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio])')]
      .filter((element) => { const box = element.getBoundingClientRect(); return box.width && box.height && box.height < 43.5; })
      .map((element) => element.textContent.trim().slice(0, 20) || element.name));
    expect(short).toEqual([]);
    expect(await page.locator('#view-toggle').innerText()).toBe('Vista avanzata');
    expect(await page.locator('.bar').evaluate((bar) => bar.getBoundingClientRect().height)).toBeLessThan(80);
  });
});

test.describe('dark scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('uses the dark palette and still loads its fonts', async ({ page }) => {
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(19, 25, 21)');
    await expect(page.getByRole('heading', { name: /Calendario/ })).toHaveCSS('color', 'rgb(232, 237, 229)');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family).sort())).toEqual(['DM Sans', 'Instrument Serif']);
  });
});

test('language: English translates the interface and Italian restores it', async ({ page }) => {
  await page.getByLabel('Lingua').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: /Editorial calendar/ })).toBeVisible();
  await expect(page.locator('#generate')).toHaveText('Generate a draft');
  await page.locator('#generate').click();
  await expect(page.locator('#notice')).toHaveText(/Working…|Topics: enter 1 to 350 characters\./);
  await page.getByLabel('Language').selectOption('it');
  await expect(page.locator('#generate')).toHaveText('Genera una bozza');
});
