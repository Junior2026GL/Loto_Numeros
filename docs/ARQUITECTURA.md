# Arquitectura de Loto Números

## Backend (`backend/src`)
Patrón por módulo (`modules/<modulo>`):

`routes -> controller -> service -> repository -> database`

| Módulo | Qué hace |
|---|---|
| `auth` | Login, sesiones, cambio y recuperación de contraseña, bloqueo por intentos |
| `users` | Alta, edición, activación y roles de usuarios (solo superadmin) |
| `audit` | Bitácora de acciones sensibles |
| `draws` | Historial de sorteos, registro manual, exportación CSV |
| `sync` | Descarga de resultados desde loto.hn (manual y programada) |
| `stats` | Cálculo de estadísticas (`stats.calculator.js` y `chi-square.js` son funciones puras) |
| `combos` | Generador de combinaciones, seguimiento de aciertos y prueba retrospectiva |
| `settings` | Ajustes de las estadísticas (solo superadmin) |

Código compartido en `shared/` (middleware, errores, utilidades) y acceso a recursos externos en `infrastructure/` (MySQL, correo, loto.hn).

### Decisiones de diseño
- **Lógica pura aparte.** Los cálculos (estadísticas, generador, prueba retrospectiva, chi-cuadrado, CSV, política de contraseñas) no tocan la base de datos, así se prueban con datos de ejemplo.
- **El token solo identifica.** Cada petición lee de la base el estado, el rol y la versión de sesión del usuario: un usuario desactivado, con otro rol o que cambió su contraseña pierde el acceso al instante.
- **Zona horaria fija (UTC-6, Honduras).** Se fija tanto en las fechas que envía Node como en la sesión de MySQL, para que no dependa de cómo esté configurado el servidor.
- **Una sola lotería por ahora.** La tabla `juegos` permite varias (rango, cantidad de números, días), pero el código usa el primer juego activo. Para soportar otra habría que añadir un selector de juego y pasar su id en las consultas; hoy no se necesita y por eso no se construyó.

## Base de datos
- `backend/src/infrastructure/database/setup.sql` crea la base inicial.
- Los cambios posteriores son migraciones numeradas en `.../migrations/`. `npm run migrate` aplica las pendientes (queda registro en `schema_migrations`).
- Para una instalación nueva: ejecutar `setup.sql` y luego `npm run migrate`.

## Frontend (`frontend/src`)
Organización por funcionalidades:

`features/<modulo>/pages`, `features/<modulo>/services`

Funcionalidades: `auth`, `dashboard`, `draws`, `stats`, `combos`, `sync`, `users`, `settings`, `audit`. Componentes comunes en `components/`, utilidades en `utils/` y el cliente HTTP en `services/api.js`.

## Pruebas y calidad
- `npm test` (backend): pruebas unitarias de la lógica pura.
- `npm run test:api` (backend): pruebas de la API contra una base **`loto_numeros_test` que se crea sola** (nunca toca la base real).
- `npm run lint` en backend y frontend (ESLint). La integración continua (`.github/workflows/ci.yml`) ejecuta todo en cada cambio.
