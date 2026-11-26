# Roadmap de facturacion-ia

Documento vivo con **qué hay que construir, en qué estado está y qué decisiones se han tomado (y por qué)**.

- El orquestador lo lee antes de planificar y lo actualiza al terminar cada tarea.
- Leyenda: ✅ hecho · 🟡 en curso · ⏳ pendiente.

---

## 1. Enunciado de la prueba técnica

Crear un proyecto en **Next.js con Claude Code** que trabaje con **3 agentes**:

1. **Orquestador:** el agente principal, con su `CLAUDE.md`, que reparte el trabajo.
2. **Develop:** un subagente que programa, con su propio `.md` sobre cómo programar.
3. **Testing:** un subagente con un `.md` de **DIRECTRICES** que Develop tiene que cumplir. Testing revisa lo que hace Develop y le devuelve los fallos hasta que todo pasa.

Requisitos:

- Base de datos gratuita: **Supabase**.
- Publicada gratis en **Vercel**, con una URL de producción **pública**. Deployment Protection (Vercel Authentication) desactivada: debe abrirse en una ventana de incógnito sin pedir login.
- Solo **planes gratuitos**.
- **No subir claves de API al repositorio.**
- Login opcional. Si lo hay, hay que facilitar las credenciales a los evaluadores. Se ha resuelto con una cuenta demo de un clic, sin credenciales.

| Requisito | Estado | Dónde |
|---|---|---|
| Orquestador con `CLAUDE.md` | ✅ | `CLAUDE.md` (sección 5) |
| Subagente Develop | ✅ | `.claude/agents/develop.md` |
| Subagente Testing con DIRECTRICES | ✅ | `.claude/agents/testing.md` (D1–D24) |
| Supabase (gratis) | ✅ | Proyecto en `eu-north-1`, esquema en `supabase/migrations/` |
| Vercel (gratis, público) | ✅ | Funciones en `arn1`; protección desactivada y comprobado en incógnito |
| Sin claves en el repo | ✅ | `.env*` ignorado; solo se versiona `.env.example` |

---

## 2. Features del MVP

### Feature 1 · Acceso con cuenta demo efímera ✅
**Qué:** el botón "Probar la demo" crea un **usuario anónimo** de Supabase (`signInAnonymously()`) con datos de ejemplo. Al pulsar "Salir" se borra. Si quiere volver a probar, se crea otro usuario. **No hay login con email.**

- ✅ **1.1 CLI de Supabase:** `supabase` como dependencia de desarrollo, `supabase init` y `link` al proyecto. Anonymous sign-ins activados en el panel. "Confirm email" se deja activado a propósito (ver la decisión D-A3).
- ✅ **1.2 Migración `demo_access`:**
  - `set_updated_at()` y la tabla `business_profiles`, con RLS;
  - `seed_demo_data()` (security invoker) y `delete_my_demo_account()` (security definer);
  - tarea de pg_cron `limpiar-usuarios-demo`, que cada hora borra los usuarios anónimos de más de 24 h.
  - Ya **aplicada** en remoto. Scripts `npm run migration` y `npm run migration-list`.
- ✅ **Stash "feature acceso: tipos de BD…" aplicado** (`git stash pop`): `src/types/database.ts` y los clientes de Supabase tipados con `<Database>`.
- ✅ **1.3 Server Actions** (`src/lib/auth/actions.ts`, tipo del estado en `src/lib/auth/types.ts`). Aprobado por `testing` en la vuelta 1:
  - `startDemo(prevState, formData)`, para `useActionState`: si ya hay usuario → `/dashboard` (doble clic); `signInAnonymously()` → `rpc('seed_demo_data')` → `redirect('/dashboard')`. Con un 429 (`status === 429` o `code === 'over_request_rate_limit'`), un mensaje amable en español. Si falla el seed, limpia (borra la cuenta + `signOut`) y devuelve un error.
  - `endDemo()`: `requireUser()` → `rpc('delete_my_demo_account')` → `signOut({ scope: 'local' })` → `redirect('/')`. Si el borrado falla, cierra la sesión igualmente (el cron la limpia en 24 h).
  - `src/lib/auth/session.ts` (sin `"use server"`, para no exponerlo como endpoint) → `requireUser()`: usa `auth.getUser()`, no `getClaims()`, porque detecta usuarios ya borrados. Si no hay usuario, redirige a `/`. Lo reutilizarán **todas** las Server Actions.
- ✅ **1.4 Proxy** (`src/lib/supabase/proxy.ts`). Aprobado por `testing` (vuelta 1, más una vuelta 2 de mejoras pedida por el usuario). `getClaims()` en cada petición y después:
  - sin sesión y en una ruta privada → `/`;
  - con sesión y en `/` → `/dashboard`, pero solo si `getUser()` lo confirma. Si el usuario ya no existe, `signOut({ scope: 'local' })` y se muestra `/` (evita el bucle `/` ↔ `/dashboard`, ver D-A9). Ante un fallo de red no se borra la sesión.
  - `setAll` no crea una respuesta en cada llamada: acumula las cookies (un Map por nombre) y las cabeceras anti-caché de `@supabase/ssr`, y la respuesta (`next` o `redirect`) se construye una sola vez al final.
    - **Por qué:** `@supabase/ssr` solo envía las cabeceras en la primera llamada a `setAll` y no repite cookies ya escritas en `request.cookies`, así que con una respuesta nueva por llamada se perdían.
  - Ruta pública: solo `/`.
  - Solo se redirigen peticiones GET/HEAD (ver D-A10).
  - Pendiente: probar con una sesión real al terminar la 1.5. Excluir del `matcher` `robots.txt`, `sitemap.xml`, etc. cuando existan.
- ✅ **1.5 Interfaz mínima** (aprobada por `testing` en la vuelta 1; falta la verificación manual de abajo). Build: `○ /` (estática) y `◐ /dashboard` (PPR). Solo los botones son componentes cliente (`src/components/auth/`). Observaciones para el panel definitivo: registrar el `code` si falla la lectura del perfil; el banner no necesita `role="status"`; los SVG de la plantilla en `public/` ya no se usan.
  - **Portada `src/app/page.tsx`:**
    - qué es la app;
    - botón "Probar la demo" (`<form action={startDemo}>`), con estado de carga y mensaje de error mediante `useActionState` (ver D-A7);
    - aviso: "Se crea una cuenta temporal con datos ficticios que se borra al salir o en 24 h".
  - **`src/app/dashboard/page.tsx` provisional:**
    - cabecera con el nombre del perfil demo y el botón "Salir";
    - banner de modo demo;
    - la sesión y el perfil se leen dentro de un `<Suspense>`.
- **Verificación de la feature:**
  - clic → `/dashboard` con "Demo Consulting S.L." y un usuario anónimo nuevo en Supabase;
  - `/dashboard` en incógnito → redirige a `/`;
  - "Salir" → el usuario y su perfil desaparecen;
  - dos ventanas → cada una ve solo sus datos;
  - repetir en la URL de producción.

### Feature 2 · Clientes ✅
- Alta, edición, listado y búsqueda (nombre, NIF/CIF, email). **Sin borrado** en el MVP (ver D-B11).
- Campos: nombre, NIF/CIF (`tax_id`) y dirección obligatorios; email y teléfono opcionales (ver D-B12).
- Ampliar `seed_demo_data()` con unos 5 clientes de ejemplo.
- ✅ **2.1 Migración `clients`** (`20261125130237_clients.sql`) + ampliar `seed_demo_data()` con 5 clientes. Aprobada por `testing`, que la ensayó en un Postgres local desechable (RLS, sin delete/truncate, cascade y seed idempotente). ✅ Aplicada en remoto. Nota: los dos CIF de ejemplo (`B76543219`, `B87654328`) tienen el dígito de control mal calculado; se mantienen por decisión del usuario, ya que D-B12 no lo comprueba. Si algún día se valida, habrá que corregirlos en una migración nueva. Pendiente: regenerar los tipos (se hace al empezar la 2.2).
- ✅ **2.2 Dominio** (aprobada por `testing` en la vuelta 1):
  - tipos regenerados con el nuevo script `npm run types`;
  - Zod 4.6.7 y Vitest 4.1.12 (`vitest.config.mts`, `npm test`);
  - `src/lib/domain/tax-id.ts`: `normalizeTaxId` e `isValidSpanishTaxIdFormat` (NIF, NIE y CIF; letra final entre las 23 de control, sin calcularla);
  - `src/lib/domain/client.ts`: `clientInputSchema` (trim, `""` → `null` en email/teléfono, mensajes en español, descarta claves extra);
  - 92 tests.
  - Nota: Vitest 5 exige `@types/node` ≥22 (el proyecto tiene ^20). Instalar Vitest con npm 10.9 falla (`edgesOut`); se instaló con `npx npm@11`, y el lock es reproducible con `npm ci` de npm 10 (comprobado).
  - Mejora posible: un DNI sin el cero inicial (`1234567L`) se rechaza; se podría rellenar con ceros o explicarlo en el mensaje.
- ✅ **2.3 Server Actions** `createClientAction` y `updateClientAction` (`src/lib/clients/actions.ts`, tipos en `types.ts`). Aprobada por `testing` en la vuelta 1.
  - `requireUser()` primero, Zod antes de la BD y sin `user_id` (lo pone `default auth.uid()`).
  - NIF duplicado → error `23505` en el campo `tax_id`, sin `select` previo.
  - Devuelven `values` en cada error, porque React 19 resetea el formulario tras la acción.
  - Edición con `.bind(null, id)`: el id se valida como UUID (`.bind` no cifra) y 0 filas → "Cliente no encontrado".
  - `revalidatePath("/clientes", "layout")` antes del `redirect`, para invalidar la caché de atrás/adelante del router (ver D-C6).
  - Para la 2.4: el estado inicial del formulario de edición se construye desde la fila (`null` → `""`). Si se añade otro `unique` a `clients`, comprobar el nombre de la constraint en el `23505`.
- ✅ **2.4 Interfaz** (aprobada por `testing` en la vuelta 1; falta la verificación manual):
  - route group `src/app/(app)/` con un layout común (banner, cabecera con perfil + Salir y menú Panel · Clientes con enlace activo); `/dashboard` se ha movido dentro sin cambiar la URL (ver D-C7);
  - `/clientes`: búsqueda con `next/form` (GET `?q=`), tabla en escritorio y tarjetas en móvil, y estados vacío, sin resultados y error;
  - `/clientes/nuevo` y `/clientes/[id]/editar` con un `ClientForm` compartido; UUID validado antes de consultar y `notFound()` con `(app)/not-found.tsx` en español (con PPR la respuesta sale con 200 + `noindex`);
  - búsqueda segura en `src/lib/domain/client-search.ts` (37 tests): `.or()` de postgrest-js no escapa nada, así que primero se escapan los comodines de LIKE y después se entrecomilla al estilo PostgREST; `*` se cambia por `_`. `testing` lo probó con 20.016 cadenas sin ninguna inyección.
  - Mejoras posibles: test de `clientFormStateFromRow`; constante de longitud del `tax_id` en el dominio.
- ✅ **Corrección de la 2.4: formularios con datos viejos por `<Activity>`** (ver D-C8). Bug encontrado por el usuario: al editar varias veces, el formulario mezclaba valores viejos y nuevos.
  - Edición: `key={id:updated_at}` en `ClientForm`.
  - Segundo bug del usuario: un NIF erróneo, "Cancelar" y al volver seguía el valor erróneo. Se cambia a descartar siempre lo no guardado al salir (ver D-C8).

### Feature 3 · Presupuestos 🟡
- **Líneas:** descripción, cantidad, precio unitario y tipo de IVA (21/10/4/0 %). IRPF opcional (`irpf_rate`, 0 = sin retención).
- **Estados:** borrador → enviado → aceptado / rechazado.
- **Totales** calculados por `src/lib/domain/` (con tests) y guardados en la cabecera.
- **Numeración simple** `P-2026-0001`, asignada al crear. Usa una tabla genérica `document_counters` que reutilizarán las facturas (ver D-B14). Aquí los huecos no importan legalmente.
- **"Convertir en factura"** pasa a la Feature 4, porque necesita la tabla de facturas.
- ✅ **3.1 Dominio de importes** (aprobada por `testing`; después simplificada a cantidades con 2 decimales; 338 tests en total):
  - `money.ts`: `parseDecimalToHundredths` (texto → centésimas sin float; una sola escala, `DECIMAL_PLACES = 2`, para dinero, cantidad e IRPF), `divideRoundHalfUp` con bigint, `toDecimalString` (para `numeric`) y `formatCents` ("1.234,56 €");
  - `quote-totals.ts`: `computeQuoteTotals` (bases, `vat_breakdown` 21/10/4/0, subtotal, `vat_total`, `irpf_total` y total), con comprobación de rango de `numeric(12,2)`;
  - `quote.ts`: `quoteInputSchema` (errores `lines.N.campo`) y `quoteFormDataToInput` (FormData `lines[i][campo]`);
  - `quote-status.ts`: transiciones, `isEditable`/`isDeletable` y etiquetas.
  - Para la 3.3/3.4: supabase-js devuelve `numeric` como número JSON → pasarlo por `String()` + el parser; "1.234" se rechaza por tener 3 decimales (no hay separador de miles); `computeQuoteTotals` lanza con datos inválidos (en vivo, calcular solo lo válido).
  - Endurecimientos posibles (no aplicados): limitar la longitud del texto numérico antes de `BigInt` y los dígitos del índice de línea.
- ⏳ **3.2 Migración:** `document_counters`, `quotes`, `quote_lines`, `save_quote()` (atómica) y seed.
- ⏳ **3.3 Server Actions:** crear, editar (solo borrador), cambiar de estado y borrar (solo borrador).
- ⏳ **3.4 Interfaz:** listado, editor con líneas dinámicas y totales en vivo, y ficha con botones de estado.

### Feature 4 · Facturas ⏳
- **Numeración correlativa por serie y año** (`2026-0001`), **sin huecos**: la función de Postgres `issue_invoice(id)` (ver D-B1).
- **Estados guardados:** `draft | issued | paid`. **"Vencida" se calcula:** `issued` y `due_date < hoy` (ver D-B4).
- **Bloqueo de edición** una vez emitida, con triggers en la BD (ver D-B3).
- Al emitir se copian los datos del cliente en `client_snapshot jsonb` (ver D-B5).

### Feature 5 · PDF de factura ⏳
- Route Handler que genera el PDF descargable, con los datos del emisor (`business_profiles`) y del cliente (snapshot).

### Feature 6 · Panel ⏳
- Facturado en el mes y en el año, pendiente de cobro y facturas vencidas. Se calcula con `SUM(total)` sobre las cabeceras.

### Feature 7 · Presupuesto con IA ⏳
- **Qué:** el usuario escribe texto libre (por ejemplo, "Para Acme: 3 horas de consultoría a 50 € y una licencia anual de 200 €"). La IA devuelve un **borrador** (cliente encontrado o propuesto, y líneas) que el usuario revisa antes de guardar. **La IA nunca guarda nada sola.**
- **Gemini, plan gratuito,** llamado desde una Server Action. La clave va en una variable de entorno **del servidor** (sin `NEXT_PUBLIC_`).
- **Salida estructurada en JSON validada con Zod. La IA solo extrae datos:** los totales los calcula el dominio.
- **Detrás de una interfaz `AIProvider`** (`src/lib/ai/`), para poder cambiar de proveedor.
- **Límite de uso:**
  - por usuario: 10 al día (tabla `ai_usage` con incremento atómico), con un mensaje amable cuando se agota;
  - **además, un tope global diario** (ver D-A4).

### Feature 8 · Integraciones ⏳
- **WhatsApp:** enlace `wa.me` con el mensaje ya escrito.
- **Exportar a CSV:** Route Handler.
- **Patrón de adaptadores `IntegrationProvider`** (`src/lib/integrations/`), preparado para APIs reales como Holded. En la demo están simuladas.

### Feature 9 · Calidad y entrega ⏳
- **Responsive:** escritorio y móvil.
- **Tests unitarios** del dominio con Vitest.
- **Tests e2e** de los flujos clave en escritorio y móvil con Playwright. Cada test usa su propio usuario demo.
- **README cuidado** (ver la sección 5) y despliegue final en Vercel.

---

## 3. Decisiones tomadas (y por qué)

### A. Acceso y seguridad
- **D-A1 · Usuario anónimo por sesión, no una cuenta demo compartida.**
  - **Por qué:** cada evaluador tiene datos limpios, nadie pisa a nadie, se pueden probar acciones destructivas y la numeración empieza en `2026-0001`.
  - Se usan los *anonymous sign-ins* de Supabase, sin necesidad de la clave `service_role`.
- **D-A2 · Borrado: al pulsar "Salir" + pg_cron cada hora (24 h).**
  - **Por qué:** cerrar la pestaña no avisa al servidor.
  - Vercel Cron en Hobby solo se ejecuta una vez al día. pg_cron funciona dentro de la BD, sin claves.
- **D-A3 · "Confirm email" activado y "Allow new users to sign up" activado.**
  - **Por qué:** con la clave pública, cualquiera puede llamar a `/auth/v1/signup`. Con la confirmación activada, esas cuentas no pueden entrar. El SMTP gratuito solo envía al equipo, 2 emails por hora.
  - Si se desactivara, crearían cuentas **permanentes** que la limpieza no borra, porque solo borra las anónimas.
- **D-A4 · Tope global diario de la IA, además del límite por usuario.**
  - **Por qué:** crear otro usuario demo reinicia el límite de 10 al día, y la cuota gratuita de Gemini es por proyecto.
- **D-A5 · Abuso en la creación de usuarios:** el límite de Supabase de 30 registros anónimos por hora y por IP, más la limpieza de 24 h. El CAPTCHA (Turnstile) queda como mejora opcional, anotada en el README.
- **D-A6 · Seguridad en capas:**
  1. el proxy redirige al navegar (`getClaims()`, rápido);
  2. `requireUser()` (`getUser()`) en cada Server Action;
  3. RLS en cada tabla.
  - Borrar un usuario no invalida al momento su JWT, que dura hasta 1 h. Por eso las acciones usan `getUser()`.
  - `startDemo` es la excepción intencionada a `requireUser()`: es la acción que crea la sesión.
- **D-A7 · `useActionState` en vez de `useFormStatus` para el botón de la demo.**
  - **Por qué:** la guía de formularios de Next 16 lo recomienda para mostrar errores devueltos por la acción, y ya da `pending`, así que un solo hook basta.
- **D-A9 · El proxy confirma con `getUser()` solo al entrar en `/` con sesión.**
  - **Por qué:** el JWT de un usuario borrado por el cron sigue siendo válido hasta 1 h. Con `getClaims()` solo, `/` → `/dashboard` → `requireUser()` → `/` sería un bucle. Hacerlo solo en `/` mantiene rápidas el resto de rutas.
  - Se llama siempre, sin intentar deducir si `getClaims()` ya lo hizo por dentro, para no depender de detalles internos de auth-js. Coste aceptado: con tokens HS* o sin `kid` hay dos llamadas a Auth al entrar en `/` con sesión.
- **D-A10 · El proxy solo redirige GET/HEAD.**
  - **Por qué:** las Server Actions son POST (`proxy.md`) y pueden llegar sin la cabecera `Next-Action`: un formulario enviado sin JS (`server-action-request-meta.js`). Redirigirlas las rompería; ya se protegen con `requireUser()`.
- **D-A8 · `signOut({ scope: 'local' })` al salir.**
  - **Por qué:** borra las cookies antes de llamar a Supabase. Con `global`, un error de red o un 5xx conserva la sesión (`GoTrueClient._signOut`, auth-js 2.119.2). La cuenta anónima solo tiene una sesión y acaba de borrarse.

### B. Modelo de datos
- **D-B0 · El modelo se crea por features.** Cada feature añade solo las tablas y columnas que necesita, en su propia migración.
- **D-B1 · Numeración sin huecos.**
  - Los borradores **no tienen número**.
  - Al emitir, `issue_invoice(id)` hace en **una transacción** `insert into invoice_counters … on conflict do update set last_number = last_number + 1 returning`. La fila del contador queda bloqueada: dos emisiones simultáneas se ponen en cola. Si algo falla, se deshace todo.
  - Además, `unique (user_id, series, year, number)`.
  - Descartados:
    - `sequence`: deja huecos si una transacción falla;
    - `MAX()+1`: duplica números con peticiones simultáneas;
    - numerar el borrador: deja huecos al borrarlo.
- **D-B2 · Los totales los calcula el dominio y se guardan en la cabecera** (`subtotal`, `vat_total`, `irpf_total` y `total`).
  - **Por qué:** el panel suma fácilmente y una factura emitida queda congelada.
- **D-B3 · El bloqueo de facturas emitidas se hace en la BD con triggers.** No se puede editar la cabecera (salvo marcarla como cobrada), ni tocar sus líneas, ni borrarla. Protege aunque alguien llame a la API directamente.
- **D-B4 · "Vencida" no se guarda, se calcula.** Así no hace falta un proceso nocturno y siempre es correcto.
- **D-B5 · `client_snapshot jsonb` al emitir.** Si el cliente cambia después, la factura emitida conserva los datos que tenía.
- **D-B6 · RLS de las líneas a través de la tabla padre.** Las líneas no llevan `user_id`: la política comprueba con `exists` que la factura o el presupuesto es del usuario. Hay un índice por la FK.
- **D-B7 · Dinero en `numeric(12,2)` y cantidades también en `numeric(12,2)`** (antes `numeric(12,3)`; el usuario consideró sobreingeniería el tercer decimal para el MVP). `check` en IVA (0/4/10/21), en IRPF (0–100) y en los estados.
- **D-B8 · `business_profiles` (emisor):**
  - `name`, `tax_id` (NIF/CIF, **no son impuestos**) y `address` son obligatorios, porque lo exige el RD 1619/2012, art. 6;
  - `email` y `phone` son opcionales: van en el PDF y el teléfono podría usarse con WhatsApp.
- **D-B9 · Los datos demo van en `seed_demo_data()`, no en `seed.sql`.**
  - **Por qué:** `seed.sql` se ejecuta una sola vez para toda la BD, y cada usuario demo necesita sus propios datos.
  - En SQL por atomicidad: supabase-js no tiene transacciones.
- **D-B10 · SQL-first con la CLI, sin ORM.**
  - **Por qué:** lo importante del esquema es la RLS, las funciones, los triggers y el cron, y un ORM los cubre a medias. Además, Drizzle necesitaría una conexión directa que se salta la RLS.
  - Los tipos se generan con `supabase gen types`.
  - Los esquemas declarativos requieren Docker: es una posible mejora futura.

- **D-B11 · Sin borrado de clientes en el MVP.**
  - **Por qué:** las facturas apuntarán a los clientes, y borrar uno con documentos obliga a decidir qué pasa con ellos. Se pospone.
- **D-B12 · `tax_id` obligatorio, único por usuario, solo formatos españoles y sin comprobar el dígito de control.**
  - **Por qué:** obligatorio porque una factura completa exige el NIF del destinatario (RD 1619/2012, art. 6). Se valida el **formato** (NIF, NIE, CIF), pero **no** el cálculo de la letra o dígito de control (decisión del usuario). Se normaliza (mayúsculas, sin espacios ni guiones) para que `unique (user_id, tax_id)` funcione.
  - Los clientes extranjeros (NIF-IVA intracomunitario) quedan fuera de alcance (README).
  - No se aceptan los NIF K/L/M (menores, residentes en el extranjero y extranjeros sin NIE). El usuario lo considera sobreingeniería para la demo.
  - La dirección es un solo campo de texto obligatorio, como en `business_profiles`.
- **D-B13 · Búsqueda con un formulario GET (`/clientes?q=`).**
  - **Por qué:** funciona sin JS, la URL se puede compartir y la consulta se hace en el servidor. La búsqueda mientras se escribe queda como mejora posible.

- **D-B14 · Cálculo del dinero en enteros (céntimos) con redondeo half-up.**
  - **Por qué:** con coma flotante, `0.1 + 0.2 ≠ 0.3`. Los precios van en céntimos y las cantidades en centésimas (la misma escala × 100), y solo se redondea en puntos definidos.
  - Base de cada línea redondeada a céntimos; IVA por tipo sobre la suma de bases de ese tipo (desglose por tipo, RD 1619/2012, art. 6); IRPF sobre la base total; total = base + IVA − IRPF.
  - IRPF: un tipo por presupuesto; en la interfaz, 0 %, 7 % y 15 % (la BD admite 0–100, D-B7).
  - El servidor recalcula siempre los totales; nunca se fía de los que llegan del formulario. El mismo código puro muestra los totales en vivo en el navegador.
- **D-B15 · `save_quote()` en SQL para guardar cabecera y líneas de forma atómica** (security invoker, pasa por la RLS). Los totales los calcula TS; la función solo los guarda en una transacción.
- **D-B16 · Tabla genérica `document_counters (user_id, series, year, last_number)`** para la numeración. Presupuestos con la serie `P`; las facturas la reutilizarán.
- **D-B17 · Estados del presupuesto:** `draft → sent → accepted | rejected`. Solo se edita y se borra en borrador. Las transiciones válidas son una función del dominio con tests.

### C. Infraestructura
- **D-C1 · Funciones de Vercel en `arn1` (Estocolmo)**, junto a Supabase (`eu-north-1`), fijadas en `vercel.json`.
- **D-C2 · Sin la integración Supabase de Vercel.** Ya existía un proyecto, los nombres de las variables no coinciden con los nuestros, e inyectaría la clave `service_role`.
- **D-C3 · `cacheComponents` activado:** leer la sesión obliga a usar `<Suspense>`.
- **D-C5 · `await connection()` al principio de `requireUser()`.**
  - **Por qué:** con `partialPrefetching`, Next prerenderiza el App Shell con las cookies de la sesión, y supabase-js compara `Date.now()` con la caducidad del token. Eso da el error "unstable value `Date.now()` while prerendering". `connection()` obliga a que la comprobación de sesión se haga en una petición real; en las Server Actions se resuelve al instante.
  - Descartados: `"use cache: private"`, porque cachearía la comprobación de sesión (choca con D-A6); `io()`, porque se resuelve en silencio dentro de `"use cache"`, mientras que `connection()` da error y así protege. Desactivar `partialPrefetching` solo tapaba el síntoma.
- **D-C6 · `revalidatePath` tras escribir, aunque no haya `"use cache"`.**
  - **Por qué:** el `redirect` ya trae el destino con datos frescos, pero el router del navegador guarda las páginas para atrás/adelante y solo las descarta si la acción revalida (`server-action-reducer.js`, `invalidateBfCache`). Sin él, "Atrás" mostraría datos viejos.
- **D-C7 · Route group `(app)` con un layout común para el área privada.**
  - **Por qué:** todas las features heredan la navegación y la cabecera. El layout **no** es la barrera de seguridad: no se vuelve a renderizar en cada navegación, así que cada página que lee datos llama a su propio `requireUser()`.
- **D-C8 · Next 16 conserva las páginas con `<Activity>`: los formularios se resetean con `key`.**
  - **Por qué:** con Cache Components, al navegar la página se oculta y no se desmonta (`preserving-ui-state.md`), y se conservan el estado de React y el DOM de los inputs. Un input no controlado que el usuario ya tocó ignora un `defaultValue` nuevo.
  - **Los formularios no conservan borradores** (decisión del usuario): al salir, por cualquier vía, se descarta lo no guardado. Al ocultarse, el formulario se vuelve a montar. Edición: además `key` derivada de `updated_at`, para que `useActionState` arranque con los datos frescos.
  - En los e2e, localizar los elementos con `getByRole`/visibles, porque Activity deja el DOM oculto en la página.
- **D-C4 · Sin Docker:** las migraciones se aplican directamente al proyecto remoto con `npm run migration`. Solo las aplica el usuario.

### D. Proceso
- **D-D1 · Historial honesto.** El setup inicial (Next, Supabase, Vercel y la migración `demo_access`) se hizo manualmente. Desde el commit `feat: sistema de agentes orquestador, develop y testing`, el desarrollo pasa por el ciclo Orquestador → Develop → Testing. **No se reescribe el historial.**
- **D-D2 · El código anterior a los agentes se audita con `testing`** contra las directrices, en lugar de rehacerse.

---

## 4. Próximos pasos
1. ⏳ **Piloto del sistema de agentes,** en una sesión nueva de Claude Code:
   - preguntar el rol;
   - pedir a `testing` una auditoría de la migración `demo_access` y de `src/lib/supabase/` contra las directrices;
   - y/o un ciclo completo pequeño: añadir el script `npm run types` = `supabase gen types typescript --remote --schema public > src/types/database.ts`.
2. ✅ Stash aplicado y **feature 1.3** terminada.
3. ✅ **Feature 1.4: proxy.** ✅ **1.5: interfaz mínima.**
4. ✅ `server-only` importado en `session.ts` (el build falla si un componente cliente lo importa) y regla `@typescript-eslint/no-unused-vars` con el patrón `^_` en `eslint.config.mjs` (el prefijo `_` = "no usado a propósito").
5. ✅ **Verificación manual de la Feature 1** en local por el usuario (entrar, incógnito, dos ventanas, salir, usuario borrado sin bucle). Commit `605eb23` subido.
6. ✅ **Feature 2 (Clientes)** terminada y verificada por el usuario (commit `cd87294`).
8. 🟡 **Feature 3 (Presupuestos):** siguiente, 3.2 (migración).
7. ⏳ Diseño: `globals.css` conserva de la plantilla `font-family: Arial, Helvetica` y sobrescribe Geist; revisarlo cuando se haga el diseño definitivo.

---

## 5. Notas para el README (no olvidar)
- **Cómo probarla:** URL pública + botón "Probar la demo". No hacen falta credenciales. La cuenta se borra al salir o en 24 h.
- **Fuera de alcance:**
  - facturas rectificativas;
  - Verifactu/TicketBAI;
  - envío por email;
  - pagos parciales;
  - facturas recurrentes;
  - multiempresa.
- **Gemini, plan gratuito:** los datos pueden usarse para mejorar los productos de Google. En la demo solo hay datos ficticios.
- **Integraciones simuladas** (WhatsApp `wa.me` y CSV reales; Holded preparado vía `IntegrationProvider`).
- **Cómo se ha construido:** el sistema de agentes y el historial (D-D1).
- **Mejoras posibles:** CAPTCHA en la demo, esquemas declarativos con Docker y un hook `Stop` en Develop que ejecute `tsc` y `lint`.
- **Cómo ejecutarlo en local:**
  - variables de `.env.example`;
  - `npm run dev`;
  - `npm run migration` para el esquema.
