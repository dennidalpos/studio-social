import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeneration, linksIn } from '../generation.mjs';

class Failure extends Error {}

const chat = (content) => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content } }] }) });
const claude = (content, stop = 'end_turn') => ({ ok: true, status: 200, json: async () => ({ stop_reason: stop, content }) });
const openai = (text) => ({ ok: true, status: 200, json: async () => ({ status: 'completed', output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text }] }] }) });

function create(env, replies, limit = () => 3000) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return typeof replies === 'function' ? replies(calls.length) : replies;
  };
  return { ...createGeneration({ DEMO: 'false', ...env }, { demo: false, limit, ErrorType: Failure, fetcher }), calls };
}

const compat = { COMPAT_API_KEY: 'k', COMPAT_MODEL: 'm', COMPAT_BASE_URL: 'https://llm.example.com/v1' };

test('compose turns the request into a post for the chosen social and keeps it inside the limit', async () => {
  const ai = create(compat, chat('Ecco il post'));
  assert.equal(await ai.compose({ provider: 'compatible', prompt: 'un post sul corso', channel: 'instagram' }), 'Ecco il post');
  const user = JSON.parse(ai.calls[0].body.messages[1].content);
  assert.equal(user.richiesta, 'un post sul corso');
  assert.equal(user.canale, 'Instagram');
  assert.equal('tools' in ai.calls[0].body, false);
  const short = create(compat, chat('x'.repeat(2201)), (channel) => channel === 'instagram' ? 2200 : 3000);
  await assert.rejects(() => short.compose({ provider: 'compatible', prompt: 'p', channel: 'instagram' }), /limite di 2200 caratteri/);
});

test('web search: each provider uses its own tool and the links in the request are passed along', async () => {
  const link = 'https://example.com/corso';
  const o = create({ OPENAI_API_KEY: 'k' }, openai('Post'));
  assert.equal(await o.compose({ provider: 'openai', prompt: `leggi ${link}.`, channel: 'linkedin', web: true }), 'Post');
  assert.deepEqual(o.calls[0].body.tools, [{ type: 'web_search' }]);
  assert.deepEqual(JSON.parse(o.calls[0].body.input).link, [link]);
  assert.match(o.calls[0].body.instructions, /Web search is on|ricerca web è attiva/);

  const c = create({ ANTHROPIC_API_KEY: 'k' }, claude([{ type: 'text', text: 'Post' }]));
  await c.compose({ provider: 'claude', prompt: 'p', channel: 'linkedin', web: true });
  assert.deepEqual(c.calls[0].body.tools.map(tool => tool.type), ['web_search_20260209', 'web_fetch_20260209']);
  const old = create({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-haiku-4-5' }, claude([{ type: 'text', text: 'Post' }]));
  await old.compose({ provider: 'claude', prompt: 'p', channel: 'linkedin', web: true });
  assert.deepEqual(old.calls[0].body.tools.map(tool => tool.type), ['web_search_20250305', 'web_fetch_20250910']);

  const q = create({ QWEN_API_KEY: 'k' }, chat('Post'));
  await q.compose({ provider: 'qwen', prompt: 'p', channel: 'linkedin', web: true });
  assert.equal(q.calls[0].body.enable_search, true);
  const off = create({ QWEN_API_KEY: 'k' }, chat('Post'));
  await off.compose({ provider: 'qwen', prompt: 'p', channel: 'linkedin' });
  assert.equal('enable_search' in off.calls[0].body, false);
});

test('web search is refused for providers without it, and the options say which ones have it', async () => {
  const ai = create(compat, chat('Post'));
  await assert.rejects(() => ai.compose({ provider: 'compatible', prompt: 'p', channel: 'linkedin', web: true }), /non supporta la ricerca web/);
  assert.equal(ai.calls.length, 0);
  const flags = Object.fromEntries(ai.options.map(option => [option.id, option.web]));
  assert.deepEqual(flags, { openai: true, claude: true, qwen: true, gemini: false, antigravity: false, compatible: false });
});

test('Claude: continues after pause_turn and returns only the text after the last tool result', async () => {
  const ai = create({ ANTHROPIC_API_KEY: 'k' }, (call) => call === 1
    ? claude([{ type: 'text', text: 'Cerco…' }, { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} }], 'pause_turn')
    : claude([{ type: 'text', text: 'Cerco…' }, { type: 'web_search_tool_result', tool_use_id: 's1', content: [] }, { type: 'text', text: 'Post ' }, { type: 'text', text: 'finale' }]));
  assert.equal(await ai.compose({ provider: 'claude', prompt: 'p', channel: 'linkedin', web: true }), 'Post \nfinale');
  assert.equal(ai.calls.length, 2);
  assert.equal(ai.calls[1].body.messages.at(-1).role, 'assistant');
});

test('improve returns complete fields, accepts a fenced JSON answer and keeps the links', async () => {
  const link = 'https://example.com/a';
  const answer = '```json\n' + JSON.stringify({ topic: 'Innovazione nei progetti', audience: 'Responsabili di progetto', tone: 'Professionale', facts: 'Punti chiave del corso.' }) + '\n```';
  const ai = create(compat, chat(answer));
  const fields = await ai.improve({ provider: 'compatible', topic: 'progetti', audience: 'pm', tone: '', facts: `corso ${link}`, channel: 'linkedin' });
  assert.equal(fields.topic, 'Innovazione nei progetti');
  assert.match(fields.facts, new RegExp(link.replace(/[.]/g, '\\.')));
  assert.match(ai.calls[0].body.messages[0].content, /JSON/);
});

test('improve rejects answers that are not usable fields', async () => {
  for (const reply of ['non è json', JSON.stringify({ topic: 'x' }), JSON.stringify({ topic: 'a', audience: 'b', tone: 'c'.repeat(151), facts: 'd' })]) {
    const ai = create(compat, chat(reply));
    await assert.rejects(() => ai.improve({ provider: 'compatible', topic: 't', audience: '', tone: '', facts: '', channel: 'linkedin' }), /campi utilizzabili/);
  }
});

test('linksIn keeps at most five https links without credentials or trailing punctuation', () => {
  const text = 'a https://a.com/x, b http://no.com c https://user:pw@secret.com d https://a.com/x e https://b.com/y). ' + Array.from({ length: 6 }, (_, i) => `https://l${i}.com`).join(' ');
  const links = linksIn(text);
  assert.equal(links.length, 5);
  assert.deepEqual(links.slice(0, 2), ['https://a.com/x', 'https://b.com/y']);
  assert.ok(!links.some(link => link.includes('secret') || link.startsWith('http:')));
});
