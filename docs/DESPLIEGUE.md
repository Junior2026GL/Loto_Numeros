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
2. Crea la base y aplica las migraciones con un usuario administrador de MySQL: `cd backend && npm run db:setup`
   (usa las variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`; sirve también para una base remota como la de Railway).
   Alternativa manual: ejecutar `setup.sql` en Workbench y luego `npm run migrate`.
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

## Alternativa: Railway (tres servicios: MySQL, backend y frontend)
Crea el proyecto desde el repositorio de GitHub. Cada servicio de código usa su carpeta (**Root Directory**:
`backend` y `frontend`) y se construye con el `Dockerfile` que tiene.

**1. MySQL** (plantilla de Railway). Para cargar las tablas desde tu PC activa temporalmente
*Settings > Networking > Add Public Access*, ejecuta en `backend` (con `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD` apuntando al host y puerto públicos) `npm run db:setup`, y **quita el acceso público** al terminar.
Railway crea la base con el nombre `railway`: usa ese mismo nombre en `DB_NAME` (en el comando y en el backend).

**2. Backend** (`backend`). Variables: `NODE_ENV=production`, `PORT=4000`, un `JWT_SECRET` aleatorio de 32+
caracteres, `FRONTEND_URL` (la dirección pública del frontend, sin `/` al final), `TRUST_PROXY=1`, `DB_HOST`
(`mysql.railway.internal`), `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}`, `DB_NAME` y
`SYNC_AUTO=true`. En *Settings > Networking > Generate Domain* usa el puerto **4000**.

**3. Frontend** (`frontend`). Variable: `VITE_API_URL=https://<dominio-del-backend>/api`. Se aplica **al compilar**,
así que si la cambias hay que volver a desplegar. nginx escucha en la variable `PORT` (80 por defecto): define
`PORT=8080` y apunta el dominio al **8080**, como en otros servicios de Railway. Lo importante es que el puerto del
dominio y `PORT` coincidan.

Errores que ya aparecieron y su causa:
- `En producción JWT_SECRET debe estar definido…` → falta la variable `JWT_SECRET` (o es débil).
- `Unknown database 'loto_numeros'` → el nombre de `DB_NAME` no coincide con la base donde se crearon las tablas.
- `host not found in upstream "backend"` (frontend) → corregido: nginx ya no hace proxy; solo sirve la aplicación.

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
