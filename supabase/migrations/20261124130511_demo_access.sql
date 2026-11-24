create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.business_profiles (
  user_id    uuid primary key default auth.uid()
             references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 200),
  tax_id     text not null check (char_length(tax_id) between 1 and 20),
  address    text not null check (char_length(address) between 1 and 300),
  email      text check (char_length(email) <= 200),
  phone      text check (char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.business_profiles is
  'Datos fiscales del emisor de las facturas. Uno por usuario.';

comment on column public.business_profiles.tax_id is
  'NIF/CIF del emisor (identificador fiscal, no impuestos). Obligatorio en factura (RD 1619/2012, art. 6).';
comment on column public.business_profiles.address is
  'Domicilio fiscal del emisor. Obligatorio en factura (RD 1619/2012, art. 6).';
comment on column public.business_profiles.phone is
  'Opcional. Contacto en el PDF; posible uso en la integración con WhatsApp.';

create trigger business_profiles_set_updated_at
  before update on public.business_profiles
  for each row execute function public.set_updated_at();

-- RLS explícita (aunque el proyecto la active por defecto).
alter table public.business_profiles enable row level security;

-- Defensa en profundidad: un visitante sin sesión (rol anon) no necesita
-- esta tabla para nada, así que le quitamos los permisos de entrada.
revoke all on table public.business_profiles from anon;

-- Cada usuario solo ve y modifica su propio perfil.
-- (select auth.uid()) entre paréntesis: Postgres lo evalúa una vez por
-- consulta en lugar de una vez por fila (recomendación de Supabase).
create policy "business_profiles: ver el propio"
  on public.business_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "business_profiles: crear el propio"
  on public.business_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "business_profiles: editar el propio"
  on public.business_profiles for update
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
end;
$$;

revoke execute on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;

create or replace function public.delete_my_demo_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users
  where id = auth.uid()
    and is_anonymous is true;
end;
$$;

revoke execute on function public.delete_my_demo_account() from public, anon;
grant execute on function public.delete_my_demo_account() to authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'limpiar-usuarios-demo',
  '0 * * * *',  -- minuto 0 de cada hora
  $$
    delete from auth.users
    where is_anonymous is true
      and created_at < now() - interval '24 hours';
  $$
);
