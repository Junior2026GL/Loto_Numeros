import './env.js';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, insertUser, startApi, PASSWORD } from './helpers.js';
import { db } from '../src/infrastructure/database/mysql.js';

let conn;
let api;

before(async () => {
  conn = await createTestDatabase();
  api = await startApi();
});

after(async () => {
  await api.close();
  await db.end();
  await conn.end();
});

test('health responde y comprueba la base de datos', async () => {
  const res = await api.request('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.db, 'ok');
});

test('login: credenciales incorrectas dan 401 y las correctas devuelven token y usuario', async () => {
  assert.equal((await api.login('superadmin', 'incorrecta1')).status, 401);
  assert.equal((await api.login('no.existe')).status, 401);

  const ok = await api.login('superadmin');
  assert.equal(ok.status, 200);
  assert.ok(ok.token);
  assert.equal(ok.data.user.rol, 'SUPER_ADMIN');
  assert.equal(ok.data.user.debeCambiarPassword, false);
});

test('un usuario con contraseña temporal solo puede ver su perfil y cambiarla', async () => {
  await insertUser(conn, { usuario: 'temporal', rol: 'NORMAL', mustChange: true });
  const { token, data } = await api.login('temporal');
  assert.equal(data.user.debeCambiarPassword, true);

  const blocked = await api.request('GET', '/sorteos/resumen', { token });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.code, 'PASSWORD_CHANGE_REQUIRED');

  const me = await api.request('GET', '/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.data.debeCambiarPassword, true);

  const change = (currentPassword, newPassword) =>
    api.request('PUT', '/auth/password', { token, body: { currentPassword, newPassword } });

  assert.equal((await change('equivocada1', 'NuevaClave2026')).status, 400, 'contraseña actual incorrecta');
  assert.equal((await change(PASSWORD, '12345678')).status, 400, 'sin letras');
  assert.equal((await change(PASSWORD, 'corta1')).status, 400, 'demasiado corta');
  assert.equal((await change(PASSWORD, PASSWORD)).status, 400, 'igual a la actual');

  const ok = await change(PASSWORD, 'NuevaClave2026');
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token);
  assert.equal(ok.data.user.debeCambiarPassword, false);

  // La sesión anterior caduca al cambiar la contraseña; la nueva funciona.
  assert.equal((await api.request('GET', '/auth/me', { token })).status, 401);
  assert.equal((await api.request('GET', '/sorteos/resumen', { token: ok.data.token })).status, 200);
  assert.equal((await api.login('temporal', PASSWORD)).status, 401);
  assert.equal((await api.login('temporal', 'NuevaClave2026')).status, 200);
});

test('tras 5 intentos fallidos el usuario queda bloqueado, incluso con la contraseña correcta', async () => {
  await insertUser(conn, { usuario: 'bloqueable', rol: 'NORMAL' });
  for (let i = 0; i < 5; i += 1) assert.equal((await api.login('bloqueable', 'mala12345')).status, 401);
  const locked = await api.login('bloqueable', PASSWORD);
  assert.equal(locked.status, 429);
  assert.match(locked.message, /Demasiados intentos/);
});

test('un usuario desactivado pierde el acceso al instante', async () => {
  const id = await insertUser(conn, { usuario: 'desactivable', rol: 'ADMIN' });
  const { token } = await api.login('desactivable');
  assert.equal((await api.request('GET', '/sorteos/resumen', { token })).status, 200);

  await conn.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [id]);
  assert.equal((await api.request('GET', '/sorteos/resumen', { token })).status, 401);
  assert.equal((await api.login('desactivable')).status, 401);
});

test('un cambio de rol se aplica al instante, sin esperar a que venza el token', async () => {
  const id = await insertUser(conn, { usuario: 'degradable', rol: 'ADMIN' });
  const { token } = await api.login('degradable');
  assert.equal((await api.request('GET', '/sincronizacion/estado', { token })).status, 200);

  await conn.query("UPDATE usuarios SET rol_id = (SELECT id FROM roles WHERE nombre = 'NORMAL') WHERE id = ?", [id]);
  assert.equal((await api.request('GET', '/sincronizacion/estado', { token })).status, 403);
});

test('un admin crea usuarios con contraseña temporal y se rechazan las contraseñas débiles', async () => {
  const { token } = await api.login('superadmin');
  const create = (password) =>
    api.request('POST', '/users', { token, body: { nombre: 'Nuevo Usuario', usuario: 'nuevo.usuario', password, rol: 'NORMAL' } });

  assert.equal((await create('12345678')).status, 400);
  assert.equal((await create('corta1')).status, 400);
  assert.equal((await create('ClaveInicial2026')).status, 201);

  const first = await api.login('nuevo.usuario', 'ClaveInicial2026');
  assert.equal(first.status, 200);
  assert.equal(first.data.user.debeCambiarPassword, true);

  // Si un admin le restablece la contraseña, vuelve a quedar obligado a cambiarla y su sesión caduca.
  const [[row]] = await conn.query("SELECT id FROM usuarios WHERE usuario = 'nuevo.usuario'");
  const reset = await api.request('PATCH', `/users/${row.id}/password`, { token, body: { password: 'OtraClave2026x' } });
  assert.equal(reset.status, 200);
  assert.equal((await api.request('GET', '/auth/me', { token: first.token })).status, 401);
  assert.equal((await api.login('nuevo.usuario', 'OtraClave2026x')).data.user.debeCambiarPassword, true);
});

test('recuperación de contraseña por código: flujo completo y protecciones', async () => {
  await insertUser(conn, { usuario: 'olvidadizo', rol: 'NORMAL', email: 'olvidadizo@ejemplo.com' });
  const oldSession = (await api.login('olvidadizo')).token;

  // En pruebas no hay SMTP: el servidor escribe el código en consola y aquí lo capturamos.
  const original = console.log;
  let code = null;
  console.log = (...args) => {
    const match = String(args[0]).match(/\[recuperación\] Código para olvidadizo: (\d{6})/);
    if (match) code = match[1];
  };

  try {
    const known = await api.request('POST', '/auth/forgot-password', { body: { usuario: 'olvidadizo' } });
    const unknown = await api.request('POST', '/auth/forgot-password', { body: { usuario: 'no.existe.nadie' } });
    assert.equal(known.status, 200);
    assert.deepEqual(known.data, unknown.data, 'no se revela si el usuario existe');
    assert.match(code, /^\d{6}$/);
  } finally {
    console.log = original;
  }

  const reset = (c, newPassword) =>
    api.request('POST', '/auth/reset-password', { body: { usuario: 'olvidadizo', code: c, newPassword } });

  assert.equal((await reset('000000', 'ClaveRecuperada2026')).status, 400, 'código incorrecto');
  assert.equal((await reset(code, '12345678')).status, 400, 'contraseña débil');
  assert.equal((await reset(code, 'ClaveRecuperada2026')).status, 200);
  assert.equal((await reset(code, 'OtraClaveDistinta2026')).status, 400, 'el código solo sirve una vez');

  assert.equal((await api.request('GET', '/auth/me', { token: oldSession })).status, 401, 'las sesiones anteriores caducan');
  assert.equal((await api.login('olvidadizo', 'ClaveRecuperada2026')).status, 200);
});

test('un código de recuperación se invalida tras 5 intentos fallidos', async () => {
  await insertUser(conn, { usuario: 'adivinador', rol: 'NORMAL', email: 'adivinador@ejemplo.com' });
  await api.request('POST', '/auth/forgot-password', { body: { usuario: 'adivinador' } });

  const guess = () =>
    api.request('POST', '/auth/reset-password', { body: { usuario: 'adivinador', code: '111111', newPassword: 'ClaveNueva2026x' } });
  for (let i = 0; i < 5; i += 1) assert.equal((await guess()).status, 400);

  const blocked = await guess();
  assert.equal(blocked.status, 400);
  assert.match(blocked.message, /Se superó el número de intentos/);
});
