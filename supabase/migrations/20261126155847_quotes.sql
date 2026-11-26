create table public.document_counters (
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  series      text not null check (series ~ '^[A-Z0-9]{1,10}$'),
  year        int  not null check (year between 1000 and 9999),
  last_number int  not null check (last_number >= 1),
  primary key (user_id, series, year)
);

comment on table public.document_counters is
  'Último número asignado por usuario, serie y año. Lo usan los presupuestos (serie P) y lo reutilizarán las facturas. Solo se modifica con private.next_document_number().';
comment on column public.document_counters.series is
  'Serie del documento: P = presupuestos. Las facturas tendrán la suya.';
comment on column public.document_counters.last_number is
  'Último número entregado. El siguiente será last_number + 1.';

alter table public.document_counters enable row level security;

revoke all on table public.document_counters from anon, authenticated;

create schema if not exists private;

comment on schema private is
  'Funciones internas: no las expone la API de Supabase; solo las llaman otras funciones SQL.';

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.next_document_number(p_series text, p_year int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_number  int;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  insert into public.document_counters as dc (user_id, series, year, last_number)
  values (v_user_id, p_series, p_year, 1)
  on conflict (user_id, series, year) do update
    set last_number = dc.last_number + 1
    where dc.user_id = v_user_id
  returning dc.last_number into v_number;

  return v_number;
end;
$$;

comment on function private.next_document_number(text, int) is
  'Reserva y devuelve el siguiente número de la serie y año del usuario actual (auth.uid()). Security definer porque nadie tiene permisos sobre document_counters.';

revoke execute on function private.next_document_number(text, int) from public, anon;
grant execute on function private.next_document_number(text, int) to authenticated;

alter table public.clients
  add constraint clients_id_user_id_key unique (id, user_id);

create table public.quotes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  client_id   uuid not null,
  number      text not null check (number ~ '^P-[0-9]{4}-[0-9]{4,}$'),
  status      text not null default 'draft'
              check (status in ('draft', 'sent', 'accepted', 'rejected')),
  issue_date  date not null,
  valid_until date,
  irpf_rate   numeric(5,2) not null default 0 check (irpf_rate between 0 and 100),
  notes       text check (char_length(notes) <= 1000),
  subtotal    numeric(12,2) not null check (subtotal >= 0),
  vat_total   numeric(12,2) not null check (vat_total >= 0),
  irpf_total  numeric(12,2) not null check (irpf_total >= 0),
  total       numeric(12,2) not null check (total >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint quotes_user_id_number_key unique (user_id, number),
  constraint quotes_valid_until_check
    check (valid_until is null or valid_until >= issue_date),
  constraint quotes_irpf_total_le_subtotal_check check (irpf_total <= subtotal),
  constraint quotes_total_consistency_check check (total = subtotal + vat_total - irpf_total),
  constraint quotes_client_id_user_id_fkey
    foreign key (client_id, user_id) references public.clients (id, user_id)
    on delete no action
);

comment on table public.quotes is
  'Presupuestos (cabecera). Los totales los calcula el dominio en TS y se guardan aquí (D-B2). Se crean y editan con save_quote().';
comment on column public.quotes.number is
  'P-AAAA-NNNN, asignado al crear con private.next_document_number(). No cambia al editar, aunque cambie el año de issue_date. Puede tener huecos (no es una factura).';
comment on column public.quotes.status is
  'draft → sent → accepted | rejected (D-B17). Solo se edita y se borra en draft.';
comment on column public.quotes.irpf_rate is
  'Retención de IRPF en %, de 0 a 100 con 2 decimales. 0 = sin retención.';
comment on column public.quotes.subtotal is
  'Suma de las bases de las líneas (base imponible total).';
comment on column public.quotes.irpf_total is
  'round(subtotal × irpf_rate / 100), half-up. Se resta del total.';
comment on column public.quotes.total is
  'subtotal + vat_total − irpf_total.';

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

alter table public.quotes enable row level security;

revoke all on table public.quotes from anon;
-- TRUNCATE no pasa por la RLS: vaciaría la tabla de todos los usuarios.
revoke truncate on table public.quotes from authenticated;

create policy "quotes: ver los propios"
  on public.quotes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "quotes: crear los propios"
  on public.quotes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "quotes: editar los propios"
  on public.quotes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "quotes: borrar los propios en borrador"
  on public.quotes for delete
  to authenticated
  using ((select auth.uid()) = user_id and status = 'draft');

create index quotes_client_id_user_id_idx on public.quotes (client_id, user_id);

create table public.quote_lines (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes (id) on delete cascade,
  position    int not null check (position >= 0),
  description text not null check (char_length(description) between 1 and 500),
  quantity    numeric(12,2) not null check (quantity > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  vat_rate    smallint not null check (vat_rate in (0, 4, 10, 21)),
  base        numeric(12,2) not null check (base >= 0),
  created_at  timestamptz not null default now(),
  constraint quote_lines_quote_id_position_key unique (quote_id, position)
);

comment on table public.quote_lines is
  'Líneas de un presupuesto. Sin user_id: la RLS comprueba que el presupuesto padre es del usuario (D-B6). Se reescriben enteras con save_quote().';
comment on column public.quote_lines.position is
  'Orden de la línea dentro del presupuesto (0, 1, 2…).';
comment on column public.quote_lines.base is
  'round(quantity × unit_price), half-up, calculada por el dominio.';


alter table public.quote_lines enable row level security;

revoke all on table public.quote_lines from anon;
revoke update, truncate on table public.quote_lines from authenticated;

create policy "quote_lines: ver las de presupuestos propios"
  on public.quote_lines for select
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and q.user_id = (select auth.uid())
    )
  );

create policy "quote_lines: crear en presupuestos propios en borrador"
  on public.quote_lines for insert
  to authenticated
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and q.user_id = (select auth.uid())
        and q.status = 'draft'
    )
  );

create policy "quote_lines: borrar en presupuestos propios en borrador"
  on public.quote_lines for delete
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and q.user_id = (select auth.uid())
        and q.status = 'draft'
    )
  );

create or replace function public.save_quote(
  p_quote_id    uuid,
  p_client_id   uuid,
  p_issue_date  date,
  p_valid_until date,
  p_irpf_rate   numeric,
  p_notes       text,
  p_subtotal    numeric,
  p_vat_total   numeric,
  p_irpf_total  numeric,
  p_total       numeric,
  p_lines       jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_year     int;
  v_number   int;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if p_lines is null
     or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception using errcode = 'P0001', message = 'quote_lines_required';
  end if;

  if p_quote_id is null then
    v_year := extract(year from p_issue_date)::int;
    v_number := private.next_document_number('P', v_year);

    insert into public.quotes (
      client_id, number, issue_date, valid_until, irpf_rate, notes,
      subtotal, vat_total, irpf_total, total
    )
    values (
      p_client_id,
      'P-' || lpad(v_year::text, 4, '0') || '-'
        || lpad(v_number::text, greatest(4, length(v_number::text)), '0'),
      p_issue_date, p_valid_until, coalesce(p_irpf_rate, 0), p_notes,
      p_subtotal, p_vat_total, p_irpf_total, p_total
    )
    returning id into v_quote_id;
  else
    update public.quotes
    set client_id   = p_client_id,
        issue_date  = p_issue_date,
        valid_until = p_valid_until,
        irpf_rate   = coalesce(p_irpf_rate, 0),
        notes       = p_notes,
        subtotal    = p_subtotal,
        vat_total   = p_vat_total,
        irpf_total  = p_irpf_total,
        total       = p_total
    where id = p_quote_id
      and status = 'draft'
    returning id into v_quote_id;

    if v_quote_id is null then
      raise exception using errcode = 'P0001', message = 'quote_not_editable';
    end if;

    delete from public.quote_lines where quote_id = v_quote_id;
  end if;

  insert into public.quote_lines (
    quote_id, position, description, quantity, unit_price, vat_rate, base
  )
  select v_quote_id, l.position, l.description, l.quantity, l.unit_price,
         l.vat_rate, l.base
  from jsonb_to_recordset(p_lines) as l (
    position    int,
    description text,
    quantity    numeric,
    unit_price  numeric,
    vat_rate    smallint,
    base        numeric
  );

  return v_quote_id;
end;
$$;

comment on function public.save_quote(uuid, uuid, date, date, numeric, text, numeric, numeric, numeric, numeric, jsonb) is
  'Crea (p_quote_id null) o edita un presupuesto en borrador con sus líneas, de forma atómica. Guarda los totales calculados por el dominio; no recalcula. Devuelve el id.';

revoke execute on function public.save_quote(uuid, uuid, date, date, numeric, text, numeric, numeric, numeric, numeric, jsonb) from public, anon;
grant execute on function public.save_quote(uuid, uuid, date, date, numeric, text, numeric, numeric, numeric, numeric, jsonb) to authenticated;

create or replace function public.seed_demo_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_year_start  date := date_trunc('year', current_date)::date;
  v_issue_date  date;
  v_client_id   uuid;
  v_quote_id    uuid;
begin
  if v_user_id is null then
    raise exception 'Se necesita una sesión para cargar los datos demo';
  end if;

  if not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Los datos demo solo se cargan en cuentas demo';
  end if;

  insert into public.business_profiles (user_id, name, tax_id, address, email, phone)
  values (
    v_user_id,
    'Demo Consulting S.L.',
    'B00000000',
    'Calle Ficticia 1, 28000 Madrid',
    'facturacion@demo-consulting.example',
    '+34 600 000 000'
  )
  on conflict (user_id) do nothing;

  insert into public.clients (user_id, name, tax_id, address, email, phone)
  values
    (
      v_user_id,
      'Talleres Imaginarios del Norte S.L.',
      'B76543219',
      'Calle Inventada 12, 48001 Bilbao (Bizkaia)',
      'administracion@talleres-imaginarios.example',
      '+34 600 000 001'
    ),
    (
      v_user_id,
      'Laura Gómez Ejemplo',
      '12345678Z',
      'Avenida de la Prueba 5, 3º B, 46001 Valencia',
      'laura.gomez@estudio-ejemplo.example',
      null
    ),
    (
      v_user_id,
      'Panadería La Espiga Ficticia S.L.',
      'B87654328',
      'Plaza Supuesta 3, 41001 Sevilla',
      null,
      '+34 600 000 003'
    ),
    (
      v_user_id,
      'Marco Rossi Demo',
      'X1234567L',
      'Carrer Fictici 27, 08001 Barcelona',
      'marco.rossi@traducciones-demo.example',
      '+34 600 000 004'
    ),
    (
      v_user_id,
      'Elena Petrova Muestra',
      'Y7654321G',
      'Calle del Simulacro 8, 50001 Zaragoza',
      'elena@fotografia-muestra.example',
      '+34 600 000 005'
    )
  on conflict (user_id, tax_id) do nothing;

  if not exists (select 1 from public.quotes where user_id = v_user_id) then

    select id into v_client_id from public.clients
    where user_id = v_user_id and tax_id = 'B76543219';

    v_issue_date := greatest(current_date - 40, v_year_start);
    v_quote_id := public.save_quote(
      null, v_client_id, v_issue_date, v_issue_date + 30, 15,
      'Incluye dos visitas al taller. Desplazamientos incluidos.',
      1583.25, 332.48, 237.49, 1678.24,
      jsonb_build_array(
        jsonb_build_object('position', 0, 'description', 'Consultoría de procesos de producción (horas)',
          'quantity', 12.50, 'unit_price', 65.00, 'vat_rate', 21, 'base', 812.50),
        jsonb_build_object('position', 1, 'description', 'Jornada de formación para el equipo de taller',
          'quantity', 1.00, 'unit_price', 450.00, 'vat_rate', 21, 'base', 450.00),
        jsonb_build_object('position', 2, 'description', 'Informe de mejoras con plan de acción',
          'quantity', 1.00, 'unit_price', 320.75, 'vat_rate', 21, 'base', 320.75)
      )
    );
    update public.quotes set status = 'accepted' where id = v_quote_id;

    select id into v_client_id from public.clients
    where user_id = v_user_id and tax_id = 'B87654328';

    v_issue_date := greatest(current_date - 12, v_year_start);
    v_quote_id := public.save_quote(
      null, v_client_id, v_issue_date, v_issue_date + 30, 0,
      null,
      1174.35, 202.57, 0.00, 1376.92,
      jsonb_build_array(
        jsonb_build_object('position', 0, 'description', 'Diseño de carta y etiquetas de producto',
          'quantity', 1.00, 'unit_price', 380.00, 'vat_rate', 21, 'base', 380.00),
        jsonb_build_object('position', 1, 'description', 'Impresión de cartas plastificadas',
          'quantity', 500.00, 'unit_price', 0.85, 'vat_rate', 21, 'base', 425.00),
        jsonb_build_object('position', 2, 'description', 'Cáterin para la presentación de la nueva carta (por persona)',
          'quantity', 25.00, 'unit_price', 12.50, 'vat_rate', 10, 'base', 312.50),
        jsonb_build_object('position', 3, 'description', 'Manual de buenas prácticas de obrador (libro impreso)',
          'quantity', 3.00, 'unit_price', 18.95, 'vat_rate', 4, 'base', 56.85)
      )
    );
    update public.quotes set status = 'sent' where id = v_quote_id;

    select id into v_client_id from public.clients
    where user_id = v_user_id and tax_id = '12345678Z';

    v_issue_date := current_date;
    perform public.save_quote(
      null, v_client_id, v_issue_date, v_issue_date + 30, 7,
      'Pendiente de confirmar las horas de auditoría.',
      429.99, 52.50, 30.10, 452.39,
      jsonb_build_array(
        jsonb_build_object('position', 0, 'description', 'Auditoría de la web y del posicionamiento (horas)',
          'quantity', 1.50, 'unit_price', 33.33, 'vat_rate', 21, 'base', 50.00),
        jsonb_build_object('position', 1, 'description', 'Licencia anual de la herramienta de analítica',
          'quantity', 1.00, 'unit_price', 199.99, 'vat_rate', 21, 'base', 199.99),
        jsonb_build_object('position', 2, 'description', 'Curso de formación bonificado (exento de IVA)',
          'quantity', 2.00, 'unit_price', 90.00, 'vat_rate', 0, 'base', 180.00)
      )
    );
  end if;
end;
$$;

revoke execute on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;
