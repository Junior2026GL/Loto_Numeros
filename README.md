# Loto Números

React + Vite (frontend), Node.js + Express (backend) y MySQL.

## Carpetas principales

- `backend/src/config/`: configuración del servidor
- `backend/src/infrastructure/database/`: acceso MySQL, migraciones y seeds
- `backend/src/modules/`: módulos del API (`auth`, `users`, `audit`)
- `backend/src/shared/`: middleware, constantes y utilidades
- `frontend/src/app/`: aplicación y rutas React
- `frontend/src/components/`: componentes reutilizables
- `frontend/src/features/`: vistas y servicios por funcionalidad
- `frontend/src/layouts/`: navegación y diseño
- `frontend/src/styles/`: estilos globales
- `docs/`: documentación

## Arranque local

1. Ejecuta `backend/src/infrastructure/database/setup.sql` en MySQL: crea la base, las tablas, los roles, el juego, el historial 2026 y el Super Admin.
2. Si solo necesitas roles y usuarios, usa `usuarios_y_roles.sql` (requiere haber ejecutado antes `setup.sql`).
3. En `backend`, copia `.env.example` a `.env`, configura credenciales, ejecuta `npm install` y `npm run dev`.
4. En `frontend`, copia `.env.example` a `.env`, ejecuta `npm install` y `npm run dev`.
5. Accede a `http://localhost:5173`.
