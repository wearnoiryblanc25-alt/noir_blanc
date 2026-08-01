# noir_blanc

## Cloudinary para productos

Las nuevas imagenes de productos ya no se guardan en `backend/uploads`. Ahora se suben a Cloudinary desde el backend y PostgreSQL conserva:

- `imagenPrincipal`
- `imagenPrincipalPublicId`
- `imagenes`
- `imagenesMetadata`

El backend sigue exponiendo `/uploads` solo para compatibilidad temporal con productos antiguos que todavia apunten a rutas locales.

## Variables requeridas

Configura estas variables solo en el backend:

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Variables base del backend:

```bash
PORT=3000
DB_HOST=
DB_PORT=
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=
FRONTEND_URL=
JWT_SECRET=
JWT_EXPIRES_IN=1d
NODE_ENV=development
```

Variable del frontend:

```bash
VITE_API_URL=http://localhost:3000
```

## Desarrollo local

1. Instala dependencias:

```bash
cd backend
npm install
cd ../frontend
npm install
```

2. Crea `backend/.env.dev` usando `backend/.env.example` como base y agrega ahi las credenciales de Cloudinary y PostgreSQL local.

3. Crea `frontend/.env` usando `frontend/.env.example` como base.

4. Ejecuta la migracion:

```bash
cd backend
npm run migration:run
```

5. Levanta backend y frontend:

```bash
cd backend
npm run start:dev
```

```bash
cd frontend
npm run dev
```

6. Verifica:

- las nuevas imagenes aparecen en la carpeta `noir-blanc/productos` de Cloudinary;
- PostgreSQL guarda la URL segura y el `public_id`;
- React muestra la URL devuelta por la API;
- no aparecen archivos nuevos dentro de `backend/uploads`.

## Railway

En el servicio del backend agrega:

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_DATABASE`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `FRONTEND_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `NODE_ENV=production`

No configures estas variables en el frontend ni con prefijo `VITE_`.

En el servicio del frontend agrega:

- `VITE_API_URL`

Si el frontend y el backend comparten el mismo dominio publico en Railway, el frontend ya puede caer por defecto al `window.location.origin` cuando `VITE_API_URL` no este definido. Aun asi, dejar `VITE_API_URL` explicita evita errores en builds y previews.

Antes de arrancar la version nueva, ejecuta la migracion del backend:

```bash
cd backend
npm run migration:run:prod
```

Despues despliega normalmente el backend y el frontend con el flujo que ya uses en Railway.
