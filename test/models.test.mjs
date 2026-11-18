import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeneration } from '../generation.mjs';

class Failure extends Error {}

function generation(env, reply) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, headers: options.headers });
    if (reply instanceof Error) throw reply;
    return reply;
  };
  const created = createGeneration({ DEMO: 'false', ...env }, { demo: false, limit: () => 3000, ErrorType: Failure, fetcher });
  return { ...created, calls };
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const failure = (status) => ({ ok: false, status, body: null, json: async () => ({}) });

test('OpenAI: hides models that do not write text and sorts the rest', async () => {
  const { listModels, calls } = generation({ OPENAI_API_KEY: 'k' }, ok({ data: [{ id: 'gpt-5-mini' }, { id: 'text-embedding-3-small' }, { id: 'whisper-1' }, { id: 'gpt-4.1' }, { id: 'gpt-5-mini' }] }));
  assert.deepEqual((await listModels('openai')).map(model => model.id), ['gpt-4.1', 'gpt-5-mini']);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/models');
  assert.equal(calls[0].headers.Authorization, 'Bearer k');
});

test('Claude: keeps the API order and shows display names', async () => {
  const { listModels, calls } = generation({ ANTHROPIC_API_KEY: 'k' }, ok({ data: [{ id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' }, { id: 'claude-haiku-5-5', display_name: 'Claude Haiku 5.5' }] }));
  const models = await listModels('claude');
  assert.deepEqual(models.map(model => model.id), ['claude-sonnet-5-5', 'claude-haiku-5-5']);
  assert.equal(models[0].label, 'Claude Sonnet 5.5 (claude-sonnet-5-5)');
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/models?limit=1000');
  assert.ok(calls[0].headers['anthropic-version']);
});

test('Gemini: removes the models/ prefix and hides image models', async () => {
  const { listModels, calls } = generation({ GEMINI_API_KEY: 'k' }, ok({ data: [{ id: 'models/gemini-3.8-flash' }, { id: 'models/imagen-4' }, { id: 'models/text-embedding-004' }] }));
  assert.deepEqual((await listModels('google')).map(model => model.id), ['gemini-3.8-flash']);
  assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/models');
});

test('QwenCloud and compatible services list from their own base URL', async () => {
  const qwen = generation({ QWEN_API_KEY: 'k' }, ok({ data: [{ id: 'qwen3.7-plus' }] }));
  await qwen.listModels('qwen');
  assert.equal(qwen.calls[0].url, 'https://ap-southeast-1.maas.qwencloudapi.com/compatible-mode/v1/models');
  for (const base of ['https://llm.example.com/v1', 'https://llm.example.com/v1/chat/completions']) {
    const compatible = generation({ COMPAT_API_KEY: 'k', COMPAT_BASE_URL: base }, ok({ data: [{ id: 'm1' }] }));
    await compatible.listModels('compatible');
    assert.equal(compatible.calls[0].url, 'https://llm.example.com/v1/models');
  }
});

test('asks for the key or the URL before calling out', async () => {
  const noKey = generation({}, ok({ data: [] }));
  await assert.rejects(() => noKey.listModels('openai'), /chiave API/);
  const noBase = generation({ COMPAT_API_KEY: 'k' }, ok({ data: [] }));
  await assert.rejects(() => noBase.listModels('compatible'), /indirizzo base/);
  const unsafe = generation({ COMPAT_API_KEY: 'k', COMPAT_BASE_URL: 'http://llm.example.com/v1' }, ok({ data: [] }));
  await assert.rejects(() => unsafe.listModels('compatible'), /indirizzo base/);
  assert.equal(noKey.calls.length + noBase.calls.length + unsafe.calls.length, 0);
});

test('reports provider errors, network failures and empty lists', async () => {
  await assert.rejects(() => generation({ OPENAI_API_KEY: 'k' }, failure(401)).listModels('openai'), /codice 401/);
  await assert.rejects(() => generation({ OPENAI_API_KEY: 'k' }, new Error('offline')).listModels('openai'), /non ha risposto/);
  await assert.rejects(() => generation({ OPENAI_API_KEY: 'k' }, ok({ data: [{ id: 'whisper-1' }] })).listModels('openai'), /non ha elencato/);
  await assert.rejects(() => generation({}, ok({})).listModels('unknown'), /servizi AI dell’elenco/);
});
