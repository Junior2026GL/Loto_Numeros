import test from 'node:test';
import assert from 'node:assert/strict';

process.env.LOTTO_RETRY_DELAY_MS = '0';
const { fetchDrawResult } = await import('./lotohn.client.js');

const realFetch = globalThis.fetch;
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test('lotohn: reintenta ante un 403 pasajero y devuelve el resultado', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls < 3 ? json({}, 403) : json({ par1: '1', par2: '14', par3: '21', par4: '22', par5: '27', par6: '31' });
  };
  assert.deepEqual(await fetchDrawResult('2026-10-28', 6), { numeros: [1, 14, 21, 22, 27, 31] });
  assert.equal(calls, 3);
});

test('lotohn: un 403 persistente falla tras 3 intentos, con status y cf-ray en el mensaje', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return json({}, 403, { server: 'cloudflare', 'cf-ray': 'abc123-IAD' });
  };
  await assert.rejects(fetchDrawResult('2026-10-28', 6), (error) => {
    assert.equal(error.status, 403);
    assert.match(error.message, /HTTP 403 \(servidor cloudflare, cf-ray abc123-IAD\)/);
    return true;
  });
  assert.equal(calls, 3);
});

test('lotohn: un error que no es pasajero (404) no se reintenta', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return json({}, 404);
  };
  await assert.rejects(fetchDrawResult('2026-10-28', 6), /HTTP 404/);
  assert.equal(calls, 1);
});

test('lotohn: un día sin sorteo (lista vacía) devuelve null', async () => {
  globalThis.fetch = async () => json([]);
  assert.equal(await fetchDrawResult('2026-10-29', 6), null);
});
