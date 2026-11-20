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
   insert into public.app_admins (email) values ('admin@ejemplo.com');
   ```

6. Iniciar el panel:

   ```bash
   npm run dev
   ```

## Uso

- **Productos / Marcas / Categorías**: alta, edición, eliminación y búsqueda manual. Los logos e imágenes se suben al bucket `catalog-images`.
- **Importar Excel**: seleccionar un `.xlsx`/`.xls`, revisar la previsualización y confirmar. Las filas se insertan con `upsert` usando `sku` como clave, por lo que repetir un SKU actualiza el producto. Las marcas y categorías que no existan se crean automáticamente.
- Para que un producto aparezca en la tienda, su estado debe ser **Publicado** (`published`).

### Columnas del Excel

| Columna | Aliases aceptados | Observaciones |
| --- | --- | --- |
| `sku` | codigo, code | Obligatorio y único |
| `name` | nombre, producto | Obligatorio |
| `brand` | marca | Se crea si no existe |
| `category` | categoria | Se crea si no existe |
| `description` | descripcion | Opcional |
| `sale_price` | price, precio, precio_venta | Numérico |
| `stock` | existencia, cantidad | Entero >= 0. Si hay varias columnas con prefijo `stock`, `existencia` o `cantidad` (por ejemplo `stock_lima`, `stock_arequipa`), se suman automáticamente; si existe una columna `stock` con valor, esa columna tiene prioridad |
| `status` | estado | draft, review, published, archived (o borrador, revisión, publicado, archivado). Por defecto `draft` |
| `image_url` | image, imagen, url_imagen | URL pública de la imagen |

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
