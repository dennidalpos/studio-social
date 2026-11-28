import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeneration } from '../generation.mjs';

class Failure extends Error {}

const completion = { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'Post' } }] }) };
const brief = { provider: 'compatible', topic: 't', audience: 'a', tone: 'x', facts: '', channel: 'linkedin' };
const base = { DEMO: 'false', COMPAT_API_KEY: 'secret-key', COMPAT_MODEL: 'm', COMPAT_BASE_URL: 'https://llm.example.com/v1' };

function create(env, fetcher) {
  return createGeneration({ ...base, ...env }, { demo: false, limit: () => 3000, ErrorType: Failure, fetcher });
}

// Captures the wait passed to AbortSignal.timeout and the lines written to the server log.
async function observe(run) {
  const waits = [];
  const logged = [];
  const timeout = AbortSignal.timeout;
  const error = console.error;
  AbortSignal.timeout = (ms) => { waits.push(ms); return timeout.call(AbortSignal, ms); };
  console.error = (...lines) => logged.push(lines.join(' '));
  try { await run(); } finally { AbortSignal.timeout = timeout; console.error = error; }
  return { waits, logged };
}

test('AI_TIMEOUT_MINUTES sets the wait for texts and for the model list', async () => {
  const { waits } = await observe(async () => {
    const created = create({ AI_TIMEOUT_MINUTES: '5' }, async () => completion);
    await created.generate(brief);
    await created.listModels('compatible').catch(() => {});
  });
  assert.deepEqual(waits, [300_000, 300_000]);
});

test('Accepts a decimal comma, caps at 60 minutes and falls back to the defaults when empty or invalid', async () => {
  for (const [minutes, expected] of [['0,5', 30_000], ['500', 3_600_000], ['', 60_000], ['abc', 60_000], ['0', 60_000], ['-2', 60_000]]) {
    const { waits } = await observe(() => create({ AI_TIMEOUT_MINUTES: minutes }, async () => completion).generate(brief));
    assert.deepEqual(waits, [expected], `AI_TIMEOUT_MINUTES=${minutes}`);
  }
});

test('A network failure logs the real cause without the key and keeps the generic message', async () => {
  const cause = Object.assign(new Error('getaddrinfo ENOTFOUND llm.example.com'), { code: 'ENOTFOUND' });
  const failure = Object.assign(new TypeError('fetch failed'), { cause });
  let thrown;
  const { logged } = await observe(async () => {
    thrown = await create({}, async () => { throw failure; }).generate(brief).catch(error => error);
  });
  assert.match(thrown.message, /non ha risposto\. Controlla la connessione a internet e l’indirizzo del servizio/);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /llm\.example\.com/);
  assert.match(logged[0], /ENOTFOUND/);
  assert.match(logged[0], /fetch failed/);
  assert.doesNotMatch(logged[0], /secret-key/);
});

test('A timeout says so and points to the wait setting', async () => {
  const timeoutError = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  let thrown;
  const { logged } = await observe(async () => {
    thrown = await create({}, async () => { throw timeoutError; }).listModels('compatible').catch(error => error);
  });
  assert.match(thrown.message, /entro il tempo di attesa impostato/);
  assert.match(thrown.message, /Impostazioni AI/);
  assert.match(logged[0], /TimeoutError/);
});
