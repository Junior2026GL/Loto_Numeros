# Arquitectura de Loto Números

## Backend
Patrón por módulo (`backend/src/modules/<modulo>`):

`routes -> controller -> service -> repository -> database`

Módulos actuales: `auth`, `users`, `audit`.

## Frontend
Organización por funcionalidades:

`features/<modulo>/pages`, `features/<modulo>/components`, `features/<modulo>/services`

Funcionalidades actuales: `auth`, `dashboard`, `users`, `audit`.
