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

### Feature 1 · Acceso con cuenta demo efímera 🟡
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
- ⏳ **1.4 Proxy** (`src/lib/supabase/proxy.ts`), después de `getClaims()`:
  - sin sesión y en una ruta privada → `/`;
  - con sesión y en `/` → `/dashboard`.
  - Copiar las cookies de sesión a la respuesta de redirección. Ruta pública: solo `/`.
  - Observación de `testing` en la 1.3: si el cron borró al usuario pero el navegador conserva cookies, `requireUser()` redirige a `/` sin limpiarlas. Valorar limpiarlas aquí.
- ⏳ **1.5 Interfaz mínima:**
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

### Feature 2 · Clientes ⏳
- Alta, edición, listado y búsqueda (nombre, NIF/CIF, email).
- Campos: nombre, NIF/CIF (`tax_id`), dirección, email y teléfono.
- Ampliar `seed_demo_data()` con unos 5 clientes de ejemplo.

### Feature 3 · Presupuestos ⏳
- **Líneas:** descripción, cantidad, precio unitario y tipo de IVA (21/10/4/0 %). IRPF opcional (`irpf_rate`, 0 = sin retención).
- **Estados:** borrador → enviado → aceptado / rechazado.
- **Totales** calculados por `src/lib/domain/` (con tests) y guardados en la cabecera.
- **Botón "Convertir en factura":** un presupuesto solo puede convertirse una vez (`invoices.quote_id unique`).
- **Numeración simple** `P-2026-0001`: reutiliza los contadores de facturas con otra serie. Aquí los huecos no importan legalmente.

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
- **D-B7 · Dinero en `numeric(12,2)`, cantidades en `numeric(12,3)`.** `check` en IVA (0/4/10/21), en IRPF (0–100) y en los estados.
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

### C. Infraestructura
- **D-C1 · Funciones de Vercel en `arn1` (Estocolmo)**, junto a Supabase (`eu-north-1`), fijadas en `vercel.json`.
- **D-C2 · Sin la integración Supabase de Vercel.** Ya existía un proyecto, los nombres de las variables no coinciden con los nuestros, e inyectaría la clave `service_role`.
- **D-C3 · `cacheComponents` activado:** leer la sesión obliga a usar `<Suspense>`.
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
3. ⏳ **Feature 1.4: proxy.**
4. ✅ `server-only` importado en `session.ts` (el build falla si un componente cliente lo importa) y regla `@typescript-eslint/no-unused-vars` con el patrón `^_` en `eslint.config.mjs` (el prefijo `_` = "no usado a propósito").

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
