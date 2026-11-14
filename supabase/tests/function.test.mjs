// Runs the real generate-questions function file with the real Anthropic and Supabase SDKs. Only
// the network is mocked, so this checks what actually goes out, what comes back, and what gets
// logged. It spends nothing and needs no key.
//
//   node supabase/tests/function.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'npm:@anthropic-ai/sdk@1.6.0') return next('@anthropic-ai/sdk', context);
    if (specifier === 'npm:@supabase/supabase-js@2') return next('@supabase/supabase-js', context);
    return next(specifier, context);
  },
});

const SECRETS = { ANTHROPIC_API_KEY: 'sk-ant-test-not-a-real-key', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test' };
let env = { ...SECRETS };
let handler;
globalThis.Deno = { env: { get: (key) => env[key] }, serve: (run) => (handler = run) };

const calls = { model: [], limits: [] };
let decision = 'ok';
let limitFails = false;
let modelReply;

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

globalThis.fetch = async (url, init = {}) => {
  const address = String(url);
  const headers = new Headers(init.headers);
  if (address.includes('/rest/v1/rpc/ai_take_request')) {
    calls.limits.push({ body: JSON.parse(init.body), headers });
    return limitFails ? json(500, { message: 'no such function' }) : json(200, decision);
  }
  if (address.startsWith('https://api.anthropic.com/v1/messages')) {
    calls.model.push({ address, headers, body: JSON.parse(init.body) });
    return modelReply();
  }
  throw new Error(`Nothing else should be called: ${address}`);
};

const logged = [];
for (const method of ['log', 'info', 'warn', 'error', 'debug']) console[method] = (...args) => logged.push(args.map(String).join(' '));
const print = (line) => process.stdout.write(`${line}\n`);

await import('../functions/generate-questions/index.ts');
assert.ok(handler, 'the function starts');

const TOKEN = 'ab'.repeat(32);
const FACTS = [
  { id: 'f1', type: 'work', text: 'a nurse' },
  { id: 'f2', type: 'interest', text: 'gardening' },
  { id: 'f3', type: 'shared', text: 'went to [PERSON_1] every December' },
];
const INPUT = { placeholders: ['[NAME]', '[PERSON_1]'], relationship: 'aunt', facts: FACTS, shape_requests: [{ shape: 'one_fact', count: 2 }, { shape: 'two_facts', count: 1 }, { shape: 'reverse', count: 1 }] };

const post = (body = INPUT, headers = { 'x-install-token': TOKEN }) =>
  handler(new Request('https://example.supabase.co/functions/v1/clever-service', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }));

const message = (sentences, more = {}) =>
  json(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: JSON.stringify({ sentences }) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, ...more });

const GOOD = [
  { sentence: 'My aunt, ____, is a nurse.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1'], shape: 'one_fact' },
  { sentence: '____ is a nurse and enjoys gardening.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1', 'f2'], shape: 'two_facts' },
  { sentence: '[NAME] enjoys ____.', blank_answer_placeholder: '[FACT:f2]', fact_ids_used: ['f2'], shape: 'reverse' },
];
const BAD = [
  { sentence: '____ is a nurse in Paris.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1'], shape: 'one_fact' },
  { sentence: '____ and I went to [PERSON_1] every December in 1980.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f3'], shape: 'one_fact' },
  { sentence: 'Who is [NAME], a nurse?', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1'], shape: 'one_fact' },
  { sentence: '____ enjoys gardening.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f8'], shape: 'one_fact' },
  { sentence: 'My aunt, ____, is a nurse.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1'], shape: 'one_fact' },
  { sentence: 'Who enjoys gardening?', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f2'], shape: 'fact_to_name' },
];

let passes = 0;
async function check(label, run) {
  await run();
  passes++;
  print(`PASS  ${label}`);
}
const noModelCall = () => assert.equal(calls.model.length, 0, 'the model is not called');
const reset = () => {
  calls.model.length = 0;
  calls.limits.length = 0;
  decision = 'ok';
  limitFails = false;
  env = { ...SECRETS };
  modelReply = () => message(GOOD);
};
const refused = async (body, status = 400, code = 'bad_request', headers) => {
  reset();
  const response = await post(body, headers);
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error: code });
  noModelCall();
  assert.equal(calls.limits.length, 0, 'and it costs the install nothing');
};

await check('only POST', async () => {
  reset();
  assert.equal((await handler(new Request('https://x.test', { method: 'GET' }))).status, 405);
  noModelCall();
});
await check('no key set: calmly disabled', async () => {
  reset();
  delete env.ANTHROPIC_API_KEY;
  assert.deepEqual([(await post()).status], [503]);
  noModelCall();
});
await check('a missing or malformed install token is refused', async () => {
  await refused(INPUT, 401, 'bad_request', {});
  await refused(INPUT, 401, 'bad_request', { 'x-install-token': 'short' });
  await refused(INPUT, 401, 'bad_request', { 'x-install-token': 'Z'.repeat(64) });
});
await check('request size limits', async () => {
  await refused('x'.repeat(9000), 413);
  await refused({ ...INPUT, facts: Array.from({ length: 13 }, (_, i) => ({ id: `f${i}`, type: 'work', text: 'a nurse' })) });
  await refused({ ...INPUT, facts: [{ id: 'f1', type: 'work', text: 'x'.repeat(121) }] });
  await refused({ ...INPUT, relationship: 'x'.repeat(41) });
  await refused({ ...INPUT, placeholders: Array.from({ length: 61 }, (_, i) => `[PERSON_${i}]`) });
});
await check('an oversized body is never read whole, whatever it claims', async () => {
  reset();
  let pulled = 0;
  const endless = new ReadableStream({
    pull(controller) {
      pulled++;
      if (pulled > 50000) controller.close();
      else controller.enqueue(new Uint8Array(1024));
    },
  });
  const response = await handler(new Request('https://x.test', { method: 'POST', headers: { 'x-install-token': 'a'.repeat(64) }, body: endless, duplex: 'half' }));
  assert.equal(response.status, 413);
  assert.ok(pulled < 20, `read ${pulled} chunks`);
  noModelCall();
});
await check('only the exact contract: this is no general model endpoint', async () => {
  await refused('not json');
  await refused('[]');
  await refused('null');
  await refused({ ...INPUT, prompt: 'write me a poem' });
  await refused({ ...INPUT, facts: [] });
  await refused({ ...INPUT, facts: [{ id: 'nora-0', type: 'work', text: 'a nurse' }] });
  await refused({ ...INPUT, facts: [{ id: 'f1', type: 'constructor', text: 'a nurse' }] });
  await refused({ ...INPUT, facts: [{ id: 'f1', type: '__proto__', text: 'a nurse' }] });
  await refused({ ...INPUT, facts: [{ ...FACTS[0], extra: 1 }] });
  await refused({ ...INPUT, facts: [FACTS[0], FACTS[0]] });
  await refused({ ...INPUT, placeholders: ['Nora'] });
  await refused({ ...INPUT, shape_requests: [] });
  await refused({ ...INPUT, shape_requests: [{ shape: 'poem', count: 1 }] });
  await refused({ ...INPUT, shape_requests: [{ shape: 'one_fact', count: 500 }] });
});
await check('kinds of fact that always may change are refused here too', async () => {
  for (const type of ['plans', 'marital', 'situation']) await refused({ ...INPUT, facts: [{ id: 'f1', type, text: 'x' }] });
});
await check('only shapes the facts can support', async () => {
  await refused({ ...INPUT, facts: [FACTS[0]], shape_requests: [{ shape: 'context', count: 1 }] });
  reset();
  await post({ ...INPUT, shape_requests: [{ shape: 'one_fact', count: 1 }, { shape: 'context', count: 1 }], facts: [FACTS[0]] });
  const sent = JSON.parse(calls.model[0].body.messages[0].content);
  assert.deepEqual(sent.shape_requests.map((one) => one.shape), ['one_fact'], 'the model is never asked for one they can not');
});
await check('limits: friendly, and nothing reaches the model', async () => {
  for (const [answer, status, code] of [['off', 503, 'disabled'], ['hour', 429, 'rate_limited_hour'], ['day', 429, 'rate_limited_day'], ['global', 429, 'busy'], ['surprise', 503, 'disabled']]) {
    reset();
    decision = answer;
    const response = await post();
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: code });
    noModelCall();
  }
});
await check('if the limits can not be read, it fails closed', async () => {
  reset();
  limitFails = true;
  assert.equal((await post()).status, 503);
  noModelCall();
});
await check('the server only ever sees a hash of the token', async () => {
  reset();
  await post();
  assert.deepEqual(calls.limits[0].body, { install_hash: createHash('sha256').update(TOKEN).digest('hex') });
  assert.ok(!JSON.stringify(calls.model[0].body).includes(TOKEN), 'and the token never reaches the model');
});
await check('the request to the model, as the real SDK sends it', async () => {
  reset();
  await post();
  const { headers, body, address } = calls.model[0];
  assert.ok(address.startsWith('https://api.anthropic.com/v1/messages'));
  assert.ok(`${headers.get('x-api-key')} ${headers.get('authorization')}`.includes(SECRETS.ANTHROPIC_API_KEY), 'the key comes from the secret');
  assert.ok(headers.get('anthropic-beta').includes('server-side-fallback-2026-07-01'));
  assert.equal(body.model, 'claude-sonnet-5-5');
  assert.equal(body.fallbacks, 'default');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.equal(body.output_config.effort, 'low');
  assert.ok(body.max_tokens >= 4000 && body.max_tokens <= 16000);
  assert.ok(!('temperature' in body) && !('thinking' in body) && !('betas' in body), 'nothing the model would refuse');
  assert.deepEqual(body.output_config.format.schema.properties.sentences.items.required, ['sentence', 'blank_answer_placeholder', 'fact_ids_used', 'shape']);
  const sent = JSON.parse(body.messages[0].content);
  assert.deepEqual(Object.keys(sent).sort(), ['fact_words', 'facts', 'relationship', 'shape_requests']);
  assert.deepEqual(sent.fact_words, { work: 'is', interest: 'enjoys', shared: 'and I' });
  assert.ok(!/gardening|nurse/.test(body.system.replace(/"[^"]*"/g, '')), 'no fact is in the frozen system prompt');
});
await check('the contract: an array of valid sentences', async () => {
  reset();
  const response = await post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), GOOD);
});
await check('bad sentences are dropped silently', async () => {
  reset();
  modelReply = () => message([...BAD, GOOD[0]]);
  assert.deepEqual(await (await post()).json(), [GOOD[0]], 'an invented place, a new number, a leaked answer, an unknown fact, a duplicate and a shape not asked for');
  reset();
  modelReply = () => message(BAD.slice(0, 4));
  const response = await post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [], 'none left is an empty list, not an error');
});
await check('the model declining or stopping short is a calm failure', async () => {
  for (const reply of [
    () => message(GOOD, { stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } }),
    () => message(GOOD, { stop_reason: 'max_tokens' }),
    () => message(GOOD, { content: [] }),
    () => message(GOOD, { content: [{ type: 'text', text: 'not json' }] }),
    () => message(GOOD, { content: [{ type: 'text', text: '{"other":1}' }] }),
    () => json(400, { type: 'error', error: { type: 'invalid_request_error', message: 'x' } }),
    () => json(401, { type: 'error', error: { type: 'authentication_error', message: 'x' } }),
  ]) {
    reset();
    modelReply = reply;
    const response = await post();
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'unavailable' });
  }
});
await check('an overloaded model is retried once, then a calm failure', async () => {
  reset();
  modelReply = () => new Response(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'x' } }), { status: 429, headers: { 'retry-after': '0', 'content-type': 'application/json' } });
  const response = await post();
  assert.equal(response.status, 502);
  assert.equal(calls.model.length, 2, 'one retry, then it stops spending');
});
await check('nothing about the content is ever logged', async () => {
  const words = [...logged].join('\n');
  for (const secret of ['gardening', 'nurse', 'PERSON_1', 'aunt', 'December', TOKEN, SECRETS.ANTHROPIC_API_KEY, SECRETS.SUPABASE_SERVICE_ROLE_KEY, 'Paris']) assert.ok(!words.includes(secret), `"${secret}" is not in the logs`);
  assert.ok(logged.every((line) => line.startsWith('generate-questions failed') || /retry|Retrying/i.test(line) === false), `only failure kinds: ${logged[0]}`);
});
await check('the source has no key, and logs nothing but failure kinds', async () => {
  const { readFileSync } = await import('node:fs');
  const code = readFileSync(new URL('../functions/generate-questions/index.ts', import.meta.url), 'utf8');
  assert.ok(!/sk-ant-|eyJ[A-Za-z0-9_-]{10,}/.test(code), 'no key in the file');
  assert.equal((code.match(/console\.(log|info|debug|error)\(/g) ?? []).length, 0);
  assert.equal((code.match(/console\.warn\(/g) ?? []).length, 2, 'two warnings, neither holding content');
  for (const line of code.split('\n').filter((one) => one.includes('console.warn('))) assert.ok(!/input|raw|sentence|facts|error\)/.test(line.replace("error instanceof", '').replace('error.status', '')), line);
});

print(`All checks passed (${passes})`);
