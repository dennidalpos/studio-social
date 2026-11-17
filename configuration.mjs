import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { createSecureContext } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { findExecutable } from './hardening.mjs';

export class ConfigError extends Error {}
const field = (name, label, options = {}) => ({ name, label, ...options });
const secret = (name, label) => field(name, label, { secret: true });
export const groups = {
  linkedin: [field('LINKEDIN_CLIENT_ID', 'Client ID'), secret('LINKEDIN_CLIENT_SECRET', 'Client Secret'), field('LINKEDIN_VERSION', 'Versione API video', { placeholder: '202610', pattern: '^\\d{6}$' })],
  facebook: [field('FACEBOOK_PAGE_ID', 'ID Pagina Facebook', { pattern: '^\\d+$' }), secret('FACEBOOK_PAGE_TOKEN', 'Token della Pagina'), field('FACEBOOK_GRAPH_VERSION', 'Versione Graph API di Meta', { placeholder: 'v27.0', pattern: '^v\\d+\\.\\d+$' })],
  instagram: [field('INSTAGRAM_PAGE_ID', 'ID della Pagina collegata', { pattern: '^\\d+$' }), secret('INSTAGRAM_PAGE_TOKEN', 'Token della Pagina collegata'), field('INSTAGRAM_PUBLIC_DIR', 'Cartella già servita via HTTPS'), field('INSTAGRAM_PUBLIC_BASE_URL', 'URL pubblico della cartella', { url: true, placeholder: 'https://media.example.com/instagram/' })],
  openai: [secret('OPENAI_API_KEY', 'Chiave API OpenAI'), field('OPENAI_MODEL', 'Modello OpenAI', { placeholder: 'gpt-5-mini' })],
  claude: [secret('ANTHROPIC_API_KEY', 'Chiave API Anthropic'), field('ANTHROPIC_MODEL', 'Modello Claude', { placeholder: 'claude-sonnet-5-5' })],
  qwen: [secret('QWEN_API_KEY', 'Chiave API QwenCloud'), field('QWEN_MODEL', 'Modello QwenCloud', { placeholder: 'qwen3.7-plus' }), field('QWEN_BASE_URL', 'URL base QwenCloud', { url: true, placeholder: 'https://ap-southeast-1.maas.qwencloudapi.com/compatible-mode/v1' })],
  google: [secret('GEMINI_API_KEY', 'Chiave Gemini API'), field('GEMINI_MODEL', 'Modello Gemini', { placeholder: 'gemini-3.8-flash' }), field('ANTIGRAVITY_AGENT', 'ID dell’agente Antigravity', { placeholder: 'antigravity-preview-05-2026' }), field('ANTIGRAVITY_MODEL', 'Modello Antigravity', { placeholder: 'gemini-3.8-flash' })],
  compatible: [secret('COMPAT_API_KEY', 'Chiave API del servizio'), field('COMPAT_BASE_URL', 'URL base Chat Completions', { url: true }), field('COMPAT_MODEL', 'Identificativo del modello')],
};

function httpsUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new ConfigError(`${label}: inserisci un URL HTTPS valido.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new ConfigError(`${label}: usa HTTPS e ometti credenziali, query e frammenti.`);
}

export function openConfiguration(directory, legacy) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(directory, 'configuration.sqlite'));
  db.exec('CREATE TABLE IF NOT EXISTS configuration (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const read = db.prepare('SELECT value FROM configuration WHERE key = ?');
  const write = db.prepare('INSERT INTO configuration VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const load = (name) => read.get(name)?.value;
  const save = (name, value) => write.run(name, value);
  function effective(overrides = {}) {
    const config = { ...legacy, ...Object.fromEntries(db.prepare("SELECT key, value FROM configuration WHERE key NOT LIKE 'local_tls_%'").all().map(row => [row.key, row.value])), ...overrides };
    const qwenSaved = load('QWEN_API_KEY') !== undefined || Object.hasOwn(overrides, 'QWEN_API_KEY');
    if (qwenSaved) config.DASHSCOPE_API_KEY = '';
    else config.QWEN_API_KEY ||= config.DASHSCOPE_API_KEY;
    return config;
  }
  function describe() {
    const config = effective();
    return Object.fromEntries(Object.entries(groups).map(([group, fields]) => [group, fields.map(item => item.secret
      ? { ...item, configured: Boolean(config[item.name]) }
      : { ...item, value: config[item.name] || '' })]));
  }
  function changes(group, data) {
    if (!Object.hasOwn(groups, group) || !data || typeof data !== 'object' || Array.isArray(data)) throw new ConfigError('Configurazione non riconosciuta.');
    const fields = groups[group];
    return Object.fromEntries(Object.entries(data).map(([name, raw]) => {
      const item = fields.find(field => field.name === name);
      if (!item || typeof raw !== 'string' || raw.length > 4096 || /[\r\n\0]/.test(raw)) throw new ConfigError('Campo di configurazione non valido.');
      const value = raw.trim();
      if (value && item.pattern && !new RegExp(item.pattern).test(value)) throw new ConfigError(`${item.label}: formato non valido.`);
      if (value && item.url) httpsUrl(value, item.label);
      return [name, value];
    }));
  }
  function saveAll(values) {
    db.exec('BEGIN');
    try {
      for (const [name, value] of Object.entries(values)) save(name, value);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function readTls() {
    const cert = load('local_tls_cert');
    const key = load('local_tls_key');
    return cert && key ? { cert, key } : null;
  }
  return { effective, describe, changes, saveAll, readTls };
}

export function validateCertificate(credentials) {
  try {
    if (typeof credentials.cert !== 'string' || typeof credentials.key !== 'string') throw new Error();
    createSecureContext(credentials);
    const cert = new X509Certificate(credentials.cert);
    if (!cert.checkHost('localhost') || Date.parse(cert.validFrom) > Date.now() || Date.parse(cert.validTo) <= Date.now()) throw new Error();
    return { cert: credentials.cert.trim(), key: credentials.key.trim() };
  } catch { throw new ConfigError('Inserisci un certificato PEM valido per localhost e la chiave privata corrispondente.'); }
}

export async function generateCertificate(directory) {
  const folder = await mkdtemp(join(directory, 'tls-'));
  try {
    const cert = join(folder, 'localhost.pem');
    const key = join(folder, 'localhost-key.pem');
    const openssl = findExecutable('openssl');
    if (!openssl) throw new Error('openssl non trovato');
    await promisify(execFile)(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-addext', 'basicConstraints=critical,CA:FALSE', '-addext', 'extendedKeyUsage=serverAuth', '-keyout', key, '-out', cert], { timeout: 15000, windowsHide: true });
    return validateCertificate({ cert: await readFile(cert, 'utf8'), key: await readFile(key, 'utf8') });
  } catch { throw new ConfigError('Generazione del certificato non riuscita. Verifica che OpenSSL sia disponibile oppure incolla certificato e chiave PEM nell’interfaccia.'); }
  finally { await rm(folder, { recursive: true, force: true }); }
}
