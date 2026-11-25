create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 200),
  tax_id     text not null check (tax_id ~ '^[A-Z0-9]{1,20}$'),
  address    text not null check (char_length(address) between 1 and 300),
  email      text check (char_length(email) <= 200),
  phone      text check (char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_user_id_tax_id_key unique (user_id, tax_id)
);

comment on table public.clients is
  'Clientes del usuario: destinatarios de presupuestos y facturas. Sin borrado en el MVP (D-B11).';

comment on column public.clients.tax_id is
  'NIF/NIE/CIF del cliente, normalizado (mayúsculas, sin espacios ni guiones). Obligatorio en factura (RD 1619/2012, art. 6). Único por usuario.';
comment on column public.clients.address is
  'Domicilio del cliente en un solo campo de texto. Obligatorio en factura completa (RD 1619/2012, art. 6).';
comment on column public.clients.email is
  'Opcional. Contacto del cliente.';
comment on column public.clients.phone is
  'Opcional. Posible uso en la integración con WhatsApp.';

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();


alter table public.clients enable row level security;

revoke all on table public.clients from anon;

revoke delete, truncate on table public.clients from authenticated;

create policy "clients: ver los propios"
  on public.clients for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "clients: crear los propios"
  on public.clients for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "clients: editar los propios"
  on public.clients for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.seed_demo_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
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
end;
$$;

revoke execute on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;
