# Publicar Loto Números

Esta guía describe cómo poner el sistema en un servidor. **Nada de esto se ha probado en un servidor real**
(la restauración de copias sí se probó, y el código se prueba con la suite automática). Sigue la lista de
verificación del final antes de dar acceso a usuarios.

## Requisitos
- Node.js 20 o superior y MySQL 8.
- Un dominio con HTTPS (el sistema envía contraseñas y tokens; **no lo publiques sin HTTPS**).

## 1. Base de datos
1. Crea un usuario de MySQL **propio de la aplicación** (no uses `root`) con permisos solo sobre `loto_numeros`:
   ```sql
   CREATE USER 'loto_app'@'localhost' IDENTIFIED BY '<contraseña larga>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON loto_numeros.* TO 'loto_app'@'localhost';
   ```
2. Ejecuta `backend/src/infrastructure/database/setup.sql` con un usuario administrador de MySQL.
3. Aplica las migraciones (con un usuario con permiso de `ALTER`/`CREATE`): `cd backend && npm run migrate`.
4. El `superadmin` inicial queda obligado a cambiar su contraseña en el primer ingreso. La contraseña inicial
   está en tu mensaje de entrega, no en el código: **no la reutilices**.

## 2. Backend
Crea `backend/.env` a partir de `.env.example` con valores de producción:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | cadena aleatoria de 32+ caracteres (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `FRONTEND_URL` | la URL pública del sistema, p. ej. `https://loto.tudominio.com` |
| `DB_USER` / `DB_PASSWORD` | el usuario de aplicación del paso 1 |
| `TRUST_PROXY` | `1` si hay nginx delante (necesario para que los límites de intentos vean la IP real) |
| `SYNC_AUTO` | `true` para que busque los resultados nuevos solo después de cada sorteo |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | correo saliente para recuperar contraseñas. Sin `SMTP_HOST` la recuperación se desactiva |

Con `NODE_ENV=production` el servidor **no arranca** si `JWT_SECRET` es débil o falta `FRONTEND_URL` o `DB_PASSWORD`.

```bash
cd backend
npm ci --omit=dev
npm start
```
Mantenlo corriendo con un administrador de procesos (por ejemplo `pm2 start src/server.js --name loto-api`).
Monitoreo: `GET /api/health` responde 200 si la API y la base responden, y 503 si la base no responde.

## 3. Frontend
```bash
cd frontend
echo "VITE_API_URL=https://loto.tudominio.com/api" > .env
npm ci
npm run build
```
Sirve la carpeta `frontend/dist` como sitio estático.

## 4. nginx (ejemplo)
```nginx
server {
  listen 443 ssl;
  server_name loto.tudominio.com;
  # ssl_certificate ... (por ejemplo con certbot)

  root /ruta/a/loto-numeros/frontend/dist;
  location / { try_files $uri /index.html; }   # necesario para las rutas de React

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Host $host;
  }
}
```

## Alternativa: Docker (sin probar)
Se incluyen `docker-compose.yml` y los `Dockerfile`, pero **no pude probarlos** (no había Docker disponible):
espera tener que ajustarlos.
```bash
cp .env.docker.example .env     # y cambia TODAS las contraseñas
docker compose up --build       # el sistema queda en http://localhost:8080
```
`setup.sql` se ejecuta solo la primera vez que arranca la base; después ejecuta
`docker compose exec backend npm run migrate`. Pon HTTPS delante (por ejemplo con un proxy inverso) antes de publicarlo.

## 5. Copias de seguridad
- **Crear:** `npm run backup` (en `backend`) genera `backend/backups/loto_numeros_<fecha>.sql` con `mysqldump`.
  Prográmalo cada día (cron en Linux o Programador de tareas en Windows) y **guarda una copia fuera del servidor**.
- **Restaurar:** `npm run restore -- backups/<archivo>.sql <base_destino>`. Restaura primero en una base de prueba
  y compara los datos. Restaurar sobre la base en uso exige `--confirmar-sobrescribir`.
- La restauración está probada: una copia restaurada en una base temporal tuvo exactamente los mismos conteos de
  todas las tablas.

## Lista de verificación antes de abrir
- [ ] HTTPS activo y funcionando.
- [ ] `JWT_SECRET` nuevo, `DB_PASSWORD` no vacío, usuario de MySQL sin permisos de administrador.
- [ ] Migraciones aplicadas (`npm run migrate` dice "ya está al día").
- [ ] Contraseña del `superadmin` cambiada por una propia.
- [ ] `TRUST_PROXY=1` si hay proxy; `0` si el servidor recibe tráfico directo.
- [ ] SMTP configurado y recuperación de contraseña probada con un usuario con correo.
- [ ] Una copia de seguridad hecha y programada, y una restauración probada en otra base.
- [ ] Entrar con un usuario `ADMIN` y otro `NORMAL` y comprobar que ven solo lo que les corresponde.
- [ ] Probar el sistema en celular (el diseño responsive no se ha verificado en un dispositivo real).

## Seguridad: lo que ya hace el sistema
- Cada petición valida en la base que el usuario siga activo, con su rol actual y con su sesión vigente:
  un usuario desactivado, con otro rol o que cambió su contraseña pierde el acceso al instante.
- Contraseñas temporales: un usuario nuevo o con contraseña restablecida por un admin **debe cambiarla** antes de usar el sistema.
- Política de contraseñas: 8+ caracteres con letras y números.
- Límite de intentos de login por usuario (5 → bloqueo de 15 min) y por IP (20 fallidos / 15 min); límite de
  recuperación (10 / hora) y general de la API (600 / 15 min por IP). Cuerpo máximo de 100 KB, cabeceras de `helmet`.
- No usa cookies: el token viaja en la cabecera `Authorization`, por lo que no es vulnerable a CSRF.
  Como el token se guarda en el navegador, lo que más hay que cuidar es no introducir fallos de XSS.
- En producción los errores internos no se muestran al usuario.
- Las exportaciones CSV neutralizan fórmulas de Excel.
