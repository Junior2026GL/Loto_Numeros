# Publicar Loto Números

Esta guía describe cómo poner el sistema en un servidor. No se ha probado en un servidor real: sigue la
lista de verificación del final antes de dar acceso a usuarios.

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
3. Cambia de inmediato la contraseña del `superadmin` desde la pantalla de usuarios.

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

Con `NODE_ENV=production` el servidor **no arranca** si `JWT_SECRET` es débil o falta `FRONTEND_URL` o `DB_PASSWORD`.

```bash
cd backend
npm ci --omit=dev
npm start
```
Mantenlo corriendo con un administrador de procesos (por ejemplo `pm2 start src/server.js --name loto-api`).

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

## 5. Copias de seguridad
`npm run backup` (en `backend`) crea `backend/backups/loto_numeros_<fecha>.sql` con `mysqldump`.
Prográmalo cada día (cron en Linux o Programador de tareas en Windows) y **guarda una copia fuera del servidor**.
Para restaurar: `mysql -u root -p loto_numeros < copia.sql`.

## Lista de verificación antes de abrir
- [ ] HTTPS activo y funcionando.
- [ ] `JWT_SECRET` nuevo, `DB_PASSWORD` no vacío, usuario de MySQL sin permisos de administrador.
- [ ] Contraseña del `superadmin` cambiada (y sin usar la inicial).
- [ ] `TRUST_PROXY=1` si hay proxy; `0` si el servidor recibe tráfico directo.
- [ ] Una copia de seguridad hecha y una restauración probada en otra base.
- [ ] Entrar con un usuario `ADMIN` y otro `NORMAL` y comprobar que ven solo lo que les corresponde.

## Seguridad: lo que ya hace el sistema
- Cada petición valida en la base que el usuario siga activo y con su rol actual (un usuario desactivado o
  con otro rol pierde el acceso al instante).
- Límite de intentos de login por usuario (5 → bloqueo de 15 min) y por IP (20 fallidos / 15 min).
- Límite general de la API (600 solicitudes / 15 min por IP), cuerpo máximo de 100 KB, cabeceras de `helmet`.
- No usa cookies: el token viaja en la cabecera `Authorization`, por lo que no es vulnerable a CSRF.
  Como el token se guarda en el navegador, lo que más hay que cuidar es no introducir fallos de XSS.
- En producción los errores internos no se muestran al usuario.
