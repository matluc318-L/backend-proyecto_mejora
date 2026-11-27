# D'Lu Admin

Panel administrativo independiente para cargar marcas, categorías y productos de la tienda D'Lu Store. Es un proyecto separado: no modifica la tienda ni agrega enlaces hacia este panel.

## Requisitos

- Node.js 18+
- Un proyecto de Supabase (el mismo que usa la tienda)

## Configuración

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar `.env.example` a `.env` y completar:

   ```text
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
   ```

3. En el SQL Editor de Supabase, ejecutar `supabase/migrations/20261119000000_restore_admin_access.sql`, `supabase/migrations/20261122000000_admin_audit.sql`, `supabase/migrations/20261127000000_product_four_images.sql` y `supabase/migrations/20261127010000_product_image_urls_array.sql`. Estas migraciones:
   - crean `app_admins`, `admin_audit_log` y las funciones `is_app_admin()` y `log_admin_action()`;
   - restauran INSERT/UPDATE/DELETE de `brands`, `categories` y `products` solo para administradores;
   - permiten a los administradores leer la auditoría, pero no modificarla;
   - crean el bucket público `catalog-images` para logos e imágenes;
   - agregan `image_url_2`, `image_url_3` e `image_url_4` a `products` y luego `image_urls` con las imágenes extra (la tienda lee `image_url` + `image_urls`, hasta 4 en total).

4. Crear el usuario administrador en **Authentication → Users** de Supabase (email y contraseña).

5. Autorizar ese correo en el SQL Editor:

   ```sql
   insert into public.app_admins (email, user_id)
   values ('admin@ejemplo.com', (select id from auth.users where lower(email) = lower('admin@ejemplo.com')))
   on conflict (email) do update set user_id = excluded.user_id;
   ```

   Si el usuario ya existía en `app_admins` con `user_id` nulo, vuelve a ejecutar la migración o este `insert` para completarlo. Puedes comprobarlo con `select email, user_id from public.app_admins;`.

6. (Opcional) Búsqueda automática de imágenes al importar. Crear una API key en **serper.dev** (incluye 2.500 consultas gratis) y guardarla como secreto junto con la función:

   ```bash
   supabase login
   supabase link --project-ref <ref-de-tu-proyecto>
   supabase secrets set SERPER_API_KEY=tu-key
   supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://tu-panel.ejemplo.com
   supabase functions deploy search-product-images
   ```

   `ALLOWED_ORIGINS` debe contener los orígenes exactos (esquema + host + puerto) desde los que se usa el panel, separados por comas. La función rechaza cualquier otro origen y exige un JWT válido de administrador.

   La función busca por nombre del producto y, según las casillas marcadas al importar, descarga/sube hasta 4 imágenes al bucket `catalog-images` y/o devuelve el `title` encontrado. Busca 10 candidatos en Serper, descarta duplicados y sube los primeros 4 válidos (máx. 5 MB cada uno). Si hay menos de 4, los espacios restantes conservan el valor del Excel o quedan vacíos. La primera imagen se guarda en `image_url` y las demás en `image_urls`. Tras cambiar la función hay que volver a desplegarla con `supabase functions deploy search-product-images`. Ambas opciones comparten una sola llamada a Serper por fila; si no hay resultado, se conserva el nombre del Excel. Si no se configura, la importación funciona igual pero solo usa las columnas de imagen del Excel.

7. (Recomendado) Exigir MFA a los administradores:
   1. Habilitar TOTP en **Authentication → MFA** del panel de Supabase.
   2. Ejecutar `supabase/migrations/20261122000001_require_admin_mfa.sql` en el SQL Editor.
   3. Agregar `VITE_REQUIRE_MFA=true` al `.env`.

   Al ingresar, el panel pedirá escanear un QR (solo la primera vez) y luego un código de 6 dígitos. No ejecutar esa migración si MFA no está habilitado en Supabase: las escrituras quedarían bloqueadas.

8. Iniciar el panel:

   ```bash
   npm run dev
   ```

## Dar acceso a otra persona

### Para editar el mismo catálogo (mismo proyecto de Supabase)

1. Entregar el código. Si se usa Git, `.env` no se incluye porque está en `.gitignore`: copiar `.env.example` a `.env` con la URL y la anon key del proyecto. Si se entrega la carpeta completa con `.env`, ya queda apuntando a ese Supabase. Nunca compartir la clave `service_role`.
2. Instalar Node.js 18+, ejecutar `npm install` y luego `npm run dev`.
3. Crear el usuario en **Authentication → Users → Add user** de Supabase (email y contraseña). El panel solo inicia sesión con correo y contraseña.
4. Autorizar ese correo en el SQL Editor:

   ```sql
   insert into public.app_admins (email, user_id)
   values ('companero@ejemplo.com', (select id from auth.users where lower(email) = lower('companero@ejemplo.com')))
   on conflict (email) do update set user_id = excluded.user_id;
   ```

   Sin este paso aparece la pantalla "Sin permisos". La migración SQL no hace falta ejecutarla de nuevo porque ya está aplicada en ese proyecto.
5. Ingresar en el panel con ese correo y contraseña. La búsqueda con Serper funciona sin configuración adicional, pero consume los créditos del proyecto.

### Para usar un catálogo separado (otro proyecto de Supabase)

Además de los pasos anteriores, en el proyecto nuevo hay que ejecutar la migración `supabase/migrations/20261119000000_restore_admin_access.sql`, crear y autorizar al usuario, desplegar la función con su propia key:

```bash
supabase secrets set SERPER_API_KEY=tu-key
supabase secrets set ALLOWED_ORIGINS=https://tu-panel.ejemplo.com
supabase functions deploy search-product-images
```

y colocar la URL, la anon key y `VITE_REQUIRE_MFA` del proyecto nuevo en el `.env`. Si se exige MFA, ejecutar también la migración `20261122000001_require_admin_mfa.sql` y configurar TOTP en ese proyecto.

## Uso

- **Productos / Marcas / Categorías**: alta, edición, eliminación y búsqueda manual. Cada producto admite hasta 4 imágenes (archivo o URL) y todas se suben al bucket `catalog-images`.
- **Importar Excel**: seleccionar un `.xlsx`/`.xls`, revisar la previsualización y confirmar. En el modal se elige el estado y se pueden activar por separado la búsqueda de imágenes (solo filas con columnas de imagen vacías; rellena los huecos sin pisar las del Excel) y el uso del título de Serper como nombre.
 Las filas se insertan con `upsert` usando `sku` como clave, por lo que repetir un SKU actualiza el producto. Las marcas y categorías que no existan se crean automáticamente.
- Para que un producto aparezca en la tienda, su estado debe ser **Publicado** (`published`).

### Columnas del Excel

| Columna | Aliases aceptados | Observaciones |
| --- | --- | --- |
| `sku` | codigo, code | Obligatorio y único |
| `name` | nombre, producto | Obligatorio |
| `brand` | marca | Se crea si no existe |
| `category` | categoria | Se crea si no existe |
| `description` | descripcion | Opcional |
| `sale_price` | price, precio, precio_venta | Numérico en dólares; se convierte a soles (x3.46) al importar |
| `stock` | existencia, cantidad | Entero >= 0. Si hay varias columnas con prefijo `stock`, `existencia` o `cantidad` (por ejemplo `stock_lima`, `stock_arequipa`), se suman automáticamente; si existe una columna `stock` con valor, esa columna tiene prioridad |
| `status` | estado | draft, review, published, archived (o borrador, revisión, publicado, archivado). Por defecto `draft` |
| `image_url` | image, imagen, url_imagen | URL pública de la imagen principal. Si falta y la búsqueda está activa, se obtiene por nombre con Serper |
| `image_url_2` | image_2, imagen_2 | Segunda imagen. Si falta, Serper puede completarla |
| `image_url_3` | image_3, imagen_3 | Tercera imagen. Si falta, Serper puede completarla |
| `image_url_4` | image_4, imagen_4 | Cuarta imagen. Si falta, Serper puede completarla |

Se aceptan encabezados con mayúsculas, acentos, espacios o guiones bajos. El botón **Descargar plantilla** genera un archivo de ejemplo.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Seguridad

- El frontend solo usa la clave `anon`; la clave `service_role` nunca se incluye en el proyecto. `.env` está en `.gitignore` y no aparece en el historial de Git.
- El acceso de lectura y escritura se controla con RLS mediante `app_admins`.
- La búsqueda de imágenes valida el JWT y el rol admin, y solo acepta peticiones desde los orígenes declarados en `ALLOWED_ORIGINS`. Sin ese secreto, la función responde 500 en lugar de quedar abierta.
- Si se aplica la migración de MFA, `is_app_admin()` también exige el factor TOTP en el token, por lo que un JWT de contraseña solo no alcanza para escrituras ni para invocar la función.
- Las altas, ediciones, borrados e importaciones se registran en `admin_audit_log` mediante una función `SECURITY DEFINER`. Los admins pueden leerla desde **Auditoría**, pero no alterarla (no hay policies de INSERT/UPDATE/DELETE).
- La sesión usa `persistSession`/`autoRefreshToken` con flujo PKCE; `detectSessionInUrl` está desactivado porque no hay login OAuth.
- Los errores que llegan del cliente de Supabase se mapean a mensajes genéricos antes de mostrarse; los errores de validación propios del Excel se marcan como `PublicError` para conservar su texto.
