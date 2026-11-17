import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { DatabaseSync } from 'node:sqlite';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { loadAccessKey, restrictToCurrentUser } from './hardening.mjs';
import { providers, ProviderError, channelLimit } from './providers.mjs';
import { ConfigError, generateCertificate, openConfiguration, validateCertificate } from './configuration.mjs';
import { MediaError, channelNames, checkMedia, maxUpload, mediaHints, pruneMedia, sendMedia, storeMedia, verifyStoredReel } from './media.mjs';

process.umask(0o077);
const root = '.data';
mkdirSync(root, { recursive: true, mode: 0o700 });
if (!restrictToCurrentUser(root)) console.warn('Could not restrict .data to the current user. Check the folder permissions: it holds keys and tokens.');
const accessKey = loadAccessKey(root);
const settings = openConfiguration(root, process.env);
let config = settings.effective();
let service = providers(config);
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta locale non valida.');
const tlsCert = process.env.TLS_CERT_FILE;
const tlsKey = process.env.TLS_KEY_FILE;
if (Boolean(tlsCert) !== Boolean(tlsKey)) throw new Error('Imposta entrambi i file TLS.');
const securePort = tlsCert ? port : port === 65535 ? port - 1 : port + 1;
const origin = new URL(`${tlsCert ? 'https' : 'http'}://localhost:${port}`).origin;
const secureOrigin = new URL(`https://localhost:${securePort}`).origin;
const callback = `${secureOrigin}/auth/linkedin/callback`;
const opened = new Map();
let secureServer;
let secureReady = false;
let secureError = '';
let activeWrites = 0;

function openStudio(demo) {
  if (opened.has(demo)) return opened.get(demo);
  const directory = join(root, demo ? 'demo' : 'live');
  const mediaDir = join(directory, 'media');
  mkdirSync(mediaDir, { recursive: true });
  const db = new DatabaseSync(join(directory, 'studio.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      channel TEXT NOT NULL,
      target TEXT,
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      due INTEGER,
      created INTEGER NOT NULL,
      error TEXT,
      external_id TEXT,
      slot TEXT UNIQUE
    );
  `);

  if (!db.prepare('PRAGMA table_info(posts)').all().some(column => column.name === 'media_id')) {
    db.exec('ALTER TABLE posts ADD COLUMN media_id TEXT');
  }
  db.exec(`
    UPDATE posts SET status = 'unknown', error = 'Invio interrotto. Controlla il social prima di riprovare.' WHERE status = 'publishing';
    UPDATE posts SET status = 'draft', error = 'Generazione interrotta. Puoi completare la bozza.' WHERE status = 'generating';
  `);
  const studio = { db, mediaDir };
  opened.set(demo, studio);
  return studio;
}

let { db, mediaDir } = openStudio(service.demo);

const defaults = { channel: 'linkedin', topic: '', audience: '', tone: 'Professionale e concreto', facts: '', days: [1, 3, 5], time: '09:00', mode: 'draft', enabled: false };
const get = (key) => JSON.parse(db.prepare('SELECT data FROM settings WHERE key = ?').get(key)?.data ?? 'null');
const set = (key, value) => db.prepare('INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data').run(key, JSON.stringify(value));
const getPlan = () => {
  const plan = get('plan') ?? defaults;
  return { ...plan, provider: plan.provider ?? service.generation.defaultProvider };
};
const mediaKey = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const getMedia = (id) => id ? JSON.parse(db.prepare('SELECT data FROM media WHERE id = ?').get(id)?.data ?? 'null') : null;
const getPost = (id) => db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
const slots = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });
const channels = Object.keys(channelNames);
let workerBusy = false;
let oauthState;
// Login: the key lives in .data/access.key (readable only by this user) and in the URL printed at
// startup. Opening that URL sets an HttpOnly cookie; every other request needs the cookie, so a
// process that can only reach the port (not the data folder) cannot use the API.
// Cookies are shared across ports on localhost, so the port is part of the name.
const cookieName = `studio_session_${port}`;
const sessionCookie = `${cookieName}=${accessKey}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
function sameKey(given) {
  const a = Buffer.from(typeof given === 'string' ? given : '');
  const b = Buffer.from(accessKey);
  return a.length === b.length && timingSafeEqual(a, b);
}
function hasSession(req) {
  return (req.headers.cookie ?? '').split(';').some(part => {
    const [name, ...value] = part.trim().split('=');
    return name === cookieName && sameKey(value.join('='));
  });
}

function accountFor(channel) {
  if (channel === 'tiktok') return null;
  if (service.demo) return { id: `demo-${channel}`, name: 'Account di prova' };
  const account = get(channel);
  if (channel === 'linkedin' && service.linkedin && account?.expires > Date.now()) return account;
  if (channel === 'facebook' && service.facebook && account?.id === config.FACEBOOK_PAGE_ID) return account;
  if (channel === 'instagram' && service.instagram && account?.pageId === (config.INSTAGRAM_PAGE_ID || config.FACEBOOK_PAGE_ID)) return account;
  return null;
}

function addPost(channel, content, status = 'draft', slot = null, mediaId = null) {
  return db.prepare('INSERT OR IGNORE INTO posts(channel, content, status, created, slot, media_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(channel, content, status, Date.now(), slot, mediaId).lastInsertRowid;
}

class InputError extends Error {}

function channelFrom(value) {
  if (!channels.includes(value)) throw new InputError('Seleziona un canale valido.');
  return value;
}

function field(value, limit, label, required = false) {
  if (typeof value !== 'string' || value.trim().length > limit || (required && !value.trim())) {
    throw new InputError(`${label}: inserisci ${required ? 'da 1 a' : 'fino a'} ${limit} caratteri.`);
  }
  return value.trim();
}

function brief(data, required) {
  return {
    channel: channelFrom(data.channel), topic: field(data.topic, 350, 'Temi', required),
    audience: field(data.audience, 350, 'Pubblico'), tone: field(data.tone, 150, 'Tono'),
    facts: field(data.facts, 4500, 'Materiale di riferimento'),
  };
}

function selectMedia(id, channel, required = false) {
  const media = typeof id === 'string' && mediaKey.test(id) ? getMedia(id) : null;
  if (id != null && !media) throw new MediaError('Allegato non trovato. Carica di nuovo il file.');
  checkMedia(channel, media, required);
  if (required && !service.demo && channel === 'instagram' && media?.duration === null && !service.instagramPhotos) {
    throw new MediaError('Per pubblicare foto su Instagram imposta la cartella e l’URL pubblico nella guida Instagram in Account.');
  }
  return media;
}

function validatedPlan(data) {
  if (!Array.isArray(data.days) || data.days.some(day => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new InputError('Scegli giorni validi.');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time) || !['draft', 'auto'].includes(data.mode) || typeof data.enabled !== 'boolean') {
    throw new InputError('Controlla orario e modalità del piano.');
  }
  const result = { ...brief(data, data.enabled), days: [...new Set(data.days)], time: data.time, mode: data.mode, enabled: data.enabled };
  if (result.enabled && !result.days.length) throw new InputError('Scegli almeno un giorno.');
  result.provider = service.generation.validate(data.provider ?? getPlan().provider, result.enabled);
  const automatic = result.enabled && result.mode === 'auto';
  if (automatic && result.channel === 'tiktok') throw new InputError('Per TikTok scegli la modalità bozze ed esporta i post.');
  result.mediaId = selectMedia(data.mediaId, result.channel, automatic)?.id ?? null;
  if (automatic) {
    const account = accountFor(result.channel);
    if (!account) throw new InputError('Collega un account per attivare la pubblicazione automatica.');
    result.target = account.id;
  }
  return result;
}

async function publishDue(id) {
  const post = db.prepare("UPDATE posts SET status = 'publishing', error = NULL WHERE id = ? AND status = 'queued' AND due <= ? RETURNING *").get(id, Date.now());
  if (!post) return;
  const account = accountFor(post.channel);
  if (!account || account.id !== post.target) {
    db.prepare("UPDATE posts SET status = 'failed', error = ? WHERE id = ?").run('Collega lo stesso account e riprogramma il post.', post.id);
    return;
  }
  let externalId;
  try {
    const media = selectMedia(post.media_id, post.channel, true);
    const file = media && { ...media, path: join(mediaDir, media.id) };
    if (post.channel === 'instagram' && file) await verifyStoredReel(file);
    externalId = await service.publish(post, account, file);
  } catch (error) {
    const status = error.uncertain || !(error instanceof ProviderError || error instanceof MediaError) ? 'unknown' : 'failed';
    const message = error instanceof ProviderError || error instanceof MediaError ? error.message : 'La risposta del social non è stata verificata.';
    db.prepare('UPDATE posts SET status = ?, error = ? WHERE id = ?').run(status, message, post.id);
    return;
  }
  db.prepare('UPDATE posts SET status = ?, external_id = ? WHERE id = ?').run(service.demo ? 'simulated' : 'published', externalId, post.id);
}

function localDay(now) {
  const { year, month, day, hour, minute } = Object.fromEntries(slots.formatToParts(now).map(part => [part.type, part.value]));
  const weekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay() || 7;
  return { weekday, date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

function recentPosts(channel) {
  return db.prepare("SELECT substr(content, 1, 600) AS excerpt FROM posts WHERE channel = ? AND content <> '' ORDER BY id DESC LIMIT 6")
    .all(channel).map(post => post.excerpt);
}

async function generateForPlan() {
  const plan = getPlan();
  if (!plan.enabled) return;
  const local = localDay(new Date());
  if (!plan.days.includes(local.weekday) || local.time < plan.time) return;
  if (db.prepare('SELECT id FROM posts WHERE slot = ?').get(local.date)) return;
  const id = addPost(plan.channel, '', 'generating', local.date, plan.mediaId ?? null);
  const account = accountFor(plan.channel);
  try {
    const content = await service.generate({ ...plan, recent: recentPosts(plan.channel) });
    const current = getPlan();
    const samePlan = JSON.stringify(plan) === JSON.stringify(current);
    const sameAccount = account && account.id === plan.target && accountFor(plan.channel)?.id === plan.target;
    if (plan.mode === 'auto' && samePlan && sameAccount) {
      db.prepare("UPDATE posts SET content = ?, status = 'queued', target = ?, due = ? WHERE id = ?")
        .run(content, account.id, Date.now(), id);
    } else {
      const message = plan.mode === 'auto' && !sameAccount ? 'Account da ricollegare prima della pubblicazione.' : null;
      db.prepare("UPDATE posts SET content = ?, status = 'draft', error = ? WHERE id = ?").run(content, message, id);
    }
  } catch (error) {
    const message = error instanceof ProviderError || error instanceof MediaError ? error.message : 'Generazione interrotta. Puoi completare la bozza.';
    db.prepare("UPDATE posts SET status = 'draft', error = ? WHERE id = ?").run(message, id);
  }
}

let lastPrune = 0;
function pruneUnusedMedia() {
  lastPrune = Date.now();
  const used = new Set(db.prepare('SELECT media_id FROM posts WHERE media_id IS NOT NULL').all().map(row => row.media_id));
  const planned = get('plan')?.mediaId;
  if (planned) used.add(planned);
  try { pruneMedia(db, mediaDir, used); } catch { console.error('Media cleanup failed. It will be retried later.'); }
}

async function work() {
  if (workerBusy) return;
  workerBusy = true;
  try {
    if (Date.now() - lastPrune > 3_600_000) pruneUnusedMedia();
    await generateForPlan();
    const ready = db.prepare("SELECT id FROM posts WHERE status = 'queued' AND due <= ? ORDER BY due LIMIT 15").all(Date.now());
    for (const post of ready) await publishDue(post.id);
  } catch {
    console.error('Errore durante il controllo del calendario. Nuovo controllo al prossimo intervallo.');
  } finally {
    workerBusy = false;
  }
}

function status() {
  return {
    demo: service.demo, linkedinHttps: secureReady, openai: service.openai, generationProviders: service.generation.options, mediaHints, instagramPhotos: service.demo || service.instagramPhotos,
    plan: { ...getPlan(), media: getMedia(getPlan().mediaId) },
    accounts: Object.fromEntries(channels.map(channel => {
      const account = accountFor(channel);
      return [channel, { configured: Boolean(service[channel]), name: account?.name, expires: account?.expires, ready: Boolean(account) }];
    })),
    posts: db.prepare('SELECT p.id, p.channel, p.content, p.status, p.due, p.created, p.error, p.external_id, m.data AS media FROM posts p LEFT JOIN media m ON p.media_id = m.id ORDER BY p.created DESC, p.id DESC LIMIT 100').all().map(post => ({ ...post, media: JSON.parse(post.media ?? 'null') })),
  };
}

function respond(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new InputError('Formato richiesta non valido.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_000) throw new InputError('Richiesta troppo lunga.');
    chunks.push(chunk);
  }
  let data;
  try { data = JSON.parse(Buffer.concat(chunks)); } catch { throw new InputError('Richiesta non valida.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError('Richiesta non valida.');
  return data;
}

function updatePost(id, data) {
  const post = getPost(id);
  if (!post) throw new InputError('Post non trovato.');
  if (post.status === 'unknown' && data.action === 'verify') {
    if (typeof data.found !== 'boolean') throw new InputError('Indica l’esito della verifica.');
    db.prepare('UPDATE posts SET status = ?, due = NULL, error = NULL WHERE id = ?').run(data.found ? 'published' : 'draft', id);
    return;
  }
  if (!['draft', 'queued', 'failed'].includes(post.status)) throw new InputError('Questo post non è modificabile in questo stato.');
  const mediaId = Object.hasOwn(data, 'mediaId') ? data.mediaId : post.media_id;
  if (data.action === 'save') {
    const media = selectMedia(mediaId, post.channel);
    db.prepare("UPDATE posts SET content = ?, status = 'draft', due = NULL, target = NULL, error = NULL, media_id = ? WHERE id = ?")
      .run(field(data.content, channelLimit(post.channel), 'Post', !media), media?.id ?? null, id);
    return;
  }
  if (data.action !== 'queue') throw new InputError('Azione non valida.');
  if (post.channel === 'tiktok') throw new InputError('Scarica il media e pubblica nell’app TikTok.');
  const media = selectMedia(mediaId, post.channel, true);
  const account = accountFor(post.channel);
  if (!account) throw new InputError('Collega l’account prima di programmare la pubblicazione.');
  const due = data.due === null ? Date.now() : Date.parse(data.due);
  if (!Number.isFinite(due) || (data.due !== null && due <= Date.now())) throw new InputError('Scegli una data futura.');
  db.prepare("UPDATE posts SET content = ?, status = 'queued', due = ?, target = ?, error = NULL, media_id = ? WHERE id = ?")
    .run(field(data.content, channelLimit(post.channel), 'Post', !media), due, account.id, media?.id ?? null, id);
  void work();
}

function redirect(res, result) {
  res.writeHead(303, { Location: `${origin}/?linkedin=${result}#account` });
  res.end();
}

const files = {
  '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'],
  '/fonts/dm-sans-latin-wght-normal.woff2': ['fonts/dm-sans-latin-wght-normal.woff2', 'font/woff2'],
  '/fonts/instrument-serif-latin-400-normal.woff2': ['fonts/instrument-serif-latin-400-normal.woff2', 'font/woff2'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'], '/favicon.ico': ['favicon.svg', 'image/svg+xml'],
};

async function serve(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const requestOrigin = req.socket.encrypted ? secureOrigin : origin;
  if (req.headers.host !== new URL(requestOrigin).host) return respond(res, 403, { error: `Apri ${requestOrigin}.` });
  const url = new URL(req.url, requestOrigin);
  const path = url.pathname;
  if (req.method === 'GET' && path === '/' && sameKey(url.searchParams.get('key'))) {
    res.writeHead(303, { 'Set-Cookie': sessionCookie, Location: '/' });
    return res.end();
  }
  // The LinkedIn callback comes from another site and is protected by its own state value.
  if (path !== '/auth/linkedin/callback' && !hasSession(req)) {
    if (req.method !== 'GET' || path !== '/') return respond(res, 401, { error: 'Unauthorized.' });
    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset="utf-8"><title>Studio Social</title><p>Apri l’indirizzo con la chiave stampato nel terminale. · Open the address with the key printed in the terminal.</p>');
  }
  const mutate = req.method === 'POST' || (req.method === 'GET' && path === '/auth/linkedin/callback');
  if (mutate) activeWrites++;
  try {
    if (req.method === 'GET' && Object.hasOwn(files, path)) {
      const [name, type] = files[path];
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      const body = readFileSync(new URL(`./public/${name}`, import.meta.url));
      return res.end(body);
    }
    const view = /^\/media\/([a-f0-9-]+)$/.exec(path);
    if (['GET', 'HEAD'].includes(req.method) && view && mediaKey.test(view[1])) {
      const media = getMedia(view[1]);
      if (!media) return respond(res, 404, { error: 'Media non trovato.' });
      return sendMedia(res, media, join(mediaDir, media.id), req.headers.range, url.searchParams.has('download'));
    }
    if (req.method === 'GET' && path === '/api/status') return respond(res, 200, status());
    if (req.method === 'GET' && path === '/api/configuration') return respond(res, 200, describeConfiguration());
    if (req.method === 'GET' && path === '/linkedin-localhost.pem' && settings.readTls()) {
      res.writeHead(200, { 'Content-Type': 'application/x-pem-file', 'Content-Disposition': 'attachment; filename=studio-social-localhost.pem' });
      return res.end(settings.readTls().cert);
    }
    if (req.method === 'GET' && path === '/auth/linkedin/callback') {
      const state = url.searchParams.get('state');
      if (!req.socket.encrypted || !oauthState || state !== oauthState.value || oauthState.expires <= Date.now() || service.demo) return redirect(res, 'state');
      oauthState = undefined;
      const code = url.searchParams.get('code');
      if (!code || url.searchParams.has('error')) return redirect(res, 'cancelled');
      try {
        set('linkedin', await service.connectLinkedin(callback, code));
        return redirect(res, 'connected');
      } catch { return redirect(res, 'failed'); }
    }
    if (req.method !== 'POST') return respond(res, 404, { error: 'Pagina non trovata.' });
    if (req.headers.origin !== requestOrigin) return respond(res, 403, { error: 'Origine della richiesta non valida.' });
    if (req.headers['x-studio-mode'] && req.headers['x-studio-mode'] !== String(service.demo)) {
      return respond(res, 409, { error: 'La modalità è cambiata. Aggiorna la pagina e riprova.' });
    }
    if (path === '/api/media') {
      const channel = channelFrom(url.searchParams.get('channel'));
      if (Number(req.headers['content-length']) > maxUpload) return respond(res, 413, { error: 'Il file supera 100 MB.' });
      const media = await storeMedia(req, mediaDir, channel, (url.searchParams.get('name') ?? 'media').slice(0, 200));
      db.prepare('INSERT INTO media VALUES (?, ?)').run(media.id, JSON.stringify(media));
      return respond(res, 201, media);
    }
    const data = await readBody(req);
    if (path === '/api/configuration') return respond(res, 200, updateConfiguration(data));
    if (path === '/api/models') return respond(res, 200, await modelsFor(data));
    if (path === '/api/linkedin-https') return respond(res, 200, await configureHttps(data));
    if (path === '/api/linkedin') {
      if (service.demo || !service.linkedin || !secureReady) throw new InputError('Per collegare LinkedIn attiva la modalità reale e completa credenziali e HTTPS nella guida.');
      oauthState = { value: randomBytes(32).toString('hex'), expires: Date.now() + 10 * 60_000 };
      return respond(res, 200, { url: service.authorizeLinkedin(callback, oauthState.value) });
    }
    if (path === '/api/facebook') {
      if (service.demo || !service.facebook) throw new InputError('Inserisci ID e token nella guida Facebook in Account.');
      set('facebook', await service.connectFacebook());
    } else if (path === '/api/instagram') {
      if (service.demo || !service.instagram) throw new InputError('Inserisci il token della Pagina nella guida Instagram in Account.');
      const account = await service.connectInstagram();
      set('instagram', { ...account, pageId: config.INSTAGRAM_PAGE_ID || config.FACEBOOK_PAGE_ID });
    } else if (path === '/api/disconnect') {
      set(channelFrom(data.channel), null);
    } else if (path === '/api/plan') {
      set('plan', validatedPlan(data));
      void work();
    } else if (path === '/api/generate') {
      const input = brief(data, true);
      const media = selectMedia(data.mediaId, input.channel);
      addPost(input.channel, await service.generate({ ...input, provider: service.generation.validate(data.provider ?? getPlan().provider), recent: recentPosts(input.channel) }), 'draft', null, media?.id ?? null);
    } else if (path === '/api/new') {
      const channel = channelFrom(data.channel);
      const media = selectMedia(data.mediaId, channel);
      addPost(channel, field(data.content, channelLimit(channel), 'Post', !media), 'draft', null, media?.id ?? null);
    } else if (/^\/api\/posts\/\d+$/.test(path)) {
      updatePost(Number(path.split('/').at(-1)), data);
    } else {
      return respond(res, 404, { error: 'Pagina non trovata.' });
    }
    return respond(res, 200, status());
  } catch (error) {
    if (error instanceof InputError || error instanceof ConfigError || error instanceof ProviderError || error instanceof MediaError) return respond(res, 400, { error: error.message });
    return respond(res, 500, { error: 'Operazione non riuscita. Controlla la configurazione locale.' });
  } finally { if (mutate) activeWrites--; }
}

function describeConfiguration() {
  return {
    demo: service.demo, fields: settings.describe(), callback, httpsOrigin: secureOrigin,
    httpsReady: secureReady, httpsError: secureError, certificateAvailable: Boolean(settings.readTls()),
  };
}

// Lists the models a provider offers, using the typed (unsaved) key or URL when present and the saved ones otherwise.
async function modelsFor(data) {
  const updates = settings.changes(data.group, data.values ?? {});
  return { models: await providers(settings.effective(updates)).generation.listModels(data.group) };
}

function updateConfiguration(data) {
  if (activeWrites > 1 || workerBusy) throw new ConfigError('Attendi che termini l’operazione in corso e riprova.');
  let updates;
  if (data.group === 'mode') {
    if (typeof data.demo !== 'boolean') throw new ConfigError('Seleziona una modalità valida.');
    updates = { DEMO: String(data.demo) };
  } else updates = settings.changes(data.group, data.values);
  const nextConfig = settings.effective(updates);
  if (data.group === 'instagram') {
    const { INSTAGRAM_PUBLIC_DIR: directory, INSTAGRAM_PUBLIC_BASE_URL: url } = nextConfig;
    if (Boolean(directory) !== Boolean(url)) throw new ConfigError('Per le foto compila sia la cartella sia l’URL HTTPS. Lascia vuoti entrambi per pubblicare solo Reel.');
    if (directory) {
      try {
        if (!statSync(directory).isDirectory()) throw new Error();
        accessSync(directory, constants.W_OK);
      } catch { throw new ConfigError('Scegli una cartella esistente in cui Studio Social possa scrivere.'); }
    }
  }
  const nextService = providers(nextConfig);
  const nextStudio = openStudio(nextService.demo);
  settings.saveAll(updates);
  const changed = (...names) => names.some(name => (config[name] || '') !== (nextConfig[name] || ''));
  const existingLive = existsSync(join(root, 'live', 'studio.sqlite'));
  const liveDb = existingLive ? openStudio(false).db : null;
  if (liveDb) {
    const disconnect = liveDb.prepare('DELETE FROM settings WHERE key = ?');
    if (changed('LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET')) disconnect.run('linkedin');
    if (changed('FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_TOKEN')) disconnect.run('facebook');
    if (changed('INSTAGRAM_PAGE_ID', 'INSTAGRAM_PAGE_TOKEN', 'FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_TOKEN')) disconnect.run('instagram');
  }
  if (changed('LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'DEMO')) oauthState = undefined;
  config = nextConfig;
  service = nextService;
  ({ db, mediaDir } = nextStudio);
  return { ...describeConfiguration(), state: status() };
}

async function listenHttps(credentials) {
  if (secureReady && secureServer) {
    secureServer.setSecureContext(credentials);
    secureError = '';
    return;
  }
  const listener = createSecureServer(credentials, serve);
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(securePort, '127.0.0.1', () => {
      listener.removeListener('error', reject);
      resolve();
    });
  });
  secureServer = listener;
  secureReady = true;
  secureError = '';
}

async function configureHttps(data) {
  if (tlsCert) throw new ConfigError('HTTPS è già attivo sul server principale.');
  if (activeWrites > 1) throw new ConfigError('Attendi che termini l’altra operazione e riprova.');
  if (!['generate', 'import'].includes(data.action)) throw new ConfigError('Azione HTTPS non valida.');
  const credentials = data.action === 'generate' ? await generateCertificate(root) : validateCertificate(data);
  try { await listenHttps(credentials); }
  catch { throw new ConfigError(`Impossibile avviare HTTPS sulla porta ${securePort}. Libera la porta e riprova.`); }
  settings.saveAll({ local_tls_cert: credentials.cert, local_tls_key: credentials.key });
  return { ...describeConfiguration(), state: status() };
}

const server = tlsCert ? createSecureServer({ cert: readFileSync(tlsCert), key: readFileSync(tlsKey) }, serve) : createServer(serve);
server.listen(port, '127.0.0.1', async () => {
  secureReady = Boolean(tlsCert);
  const credentials = settings.readTls();
  if (!tlsCert && credentials) {
    try { await listenHttps(validateCertificate(credentials)); }
    catch { secureError = `HTTPS non disponibile sulla porta ${securePort}. Controlla la porta e il certificato.`; }
  }
  console.log(`Studio Social — ${origin}${service.demo ? ' (modalità prova)' : ''}`);
  console.log(`Login (first time in each browser): ${origin}/?key=${accessKey}`);
  setInterval(() => void work(), 15000);
  void work();
});
