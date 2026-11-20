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

3. En el SQL Editor de Supabase, ejecutar `supabase/migrations/20261119000000_restore_admin_access.sql`. Esta migración:
   - crea `app_admins` y la función `is_app_admin()`;
   - restaura INSERT/UPDATE/DELETE de `brands`, `categories` y `products` solo para administradores;
   - crea el bucket público `catalog-images` para logos e imágenes.

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
   supabase functions deploy search-product-images
   ```

   La función busca por nombre del producto y, según las casillas marcadas al importar, descarga/sube la imagen al bucket `catalog-images` y/o devuelve el `title` encontrado. Ambas opciones comparten una sola llamada a Serper por fila; si no hay resultado, se conserva el nombre del Excel. Si no se configura, la importación funciona igual pero solo usa la columna `image_url` del Excel.

7. Iniciar el panel:

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
supabase functions deploy search-product-images
```

y colocar la URL y anon key del proyecto nuevo en el `.env`.

## Uso

- **Productos / Marcas / Categorías**: alta, edición, eliminación y búsqueda manual. Los logos e imágenes se suben al bucket `catalog-images`.
- **Importar Excel**: seleccionar un `.xlsx`/`.xls`, revisar la previsualización y confirmar. En el modal se elige el estado y se pueden activar por separado la búsqueda de imágenes (solo filas sin `image_url`) y el uso del título de Serper como nombre. Las filas se insertan con `upsert` usando `sku` como clave, por lo que repetir un SKU actualiza el producto. Las marcas y categorías que no existan se crean automáticamente.
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
| `image_url` | image, imagen, url_imagen | URL pública de la imagen. Si falta y la búsqueda está activa, se obtiene por nombre con Serper |

Se aceptan encabezados con mayúsculas, acentos, espacios o guiones bajos. El botón **Descargar plantilla** genera un archivo de ejemplo.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Seguridad

- El frontend solo usa la clave `anon`; la clave `service_role` nunca se incluye en el proyecto.
- El acceso de escritura se controla con RLS mediante `app_admins`.
- El bucket `catalog-images` es público para lectura, pero solo los administradores pueden subir o borrar archivos.
