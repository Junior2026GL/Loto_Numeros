# Loto Números

Sistema para consultar los resultados del Loto SuperPremio Honduras, analizar el historial y llevar el
seguimiento de combinaciones. React + Vite (frontend), Node.js + Express (backend) y MySQL.

> Las estadísticas y las combinaciones son herramientas descriptivas. **Ninguna aumenta la probabilidad de ganar:**
> cada sorteo es independiente y todas las combinaciones son igual de probables.

## Carpetas principales

- `backend/src/modules/`: módulos del API (`auth`, `users`, `audit`, `draws`, `sync`, `stats`, `combos`, `settings`)
- `backend/src/infrastructure/`: MySQL (`setup.sql` y migraciones), correo y cliente de loto.hn
- `backend/src/shared/`: middleware, constantes y utilidades
- `backend/test/`: pruebas de la API
- `frontend/src/features/`: pantallas y servicios por funcionalidad
- `docs/`: arquitectura y guía de publicación

## Arranque local

1. En `backend`: copia `.env.example` a `.env` y pon tu `DB_PASSWORD`; luego `npm install`.
2. Crea la base con **`npm run db:setup`** (ejecuta `setup.sql` y las migraciones: tablas, roles, el juego, el historial inicial y el superadmin). No necesita Workbench.
3. `npm run dev`.
4. En `frontend`: copia `.env.example` a `.env`, `npm install` y `npm run dev`.
5. Abre `http://localhost:5173`. El superadmin debe cambiar su contraseña inicial en el primer ingreso.
6. Entra a **Sincronización** y pulsa "Sincronizar ahora" para traer los resultados que falten.

## Comandos útiles (en `backend`)

| Comando | Qué hace |
|---|---|
| `npm run db:setup` | Crea la base completa (setup.sql + migraciones); sirve también para una base remota |
| `npm run migrate` | Aplica solo las migraciones pendientes |
| `npm test` | Pruebas unitarias de la lógica pura |
| `npm run test:api` | Pruebas de la API (crea y usa la base `loto_numeros_test`) |
| `npm run lint` | ESLint (también en `frontend`) |
| `npm run backup` / `npm run restore` | Copia de seguridad y restauración de la base |

## Más información

- Arquitectura: `docs/ARQUITECTURA.md`
- Cómo publicar el sistema, copias de seguridad y Docker: `docs/DESPLIEGUE.md`
