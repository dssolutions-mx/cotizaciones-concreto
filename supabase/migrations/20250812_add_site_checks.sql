-- Create table for on-site slump/extensibility + temperature checks
create table if not exists public.site_checks (
  id uuid primary key default gen_random_uuid(),
  remision_id uuid null references public.remisiones(id) on delete set null,
  remision_number_manual text not null,
  plant_id uuid not null references public.plants(id),
  fecha_muestreo timestamptz not null default now(),
  hora_salida_planta time null,
  hora_llegada_obra time null,
  test_type text not null check (test_type in ('SLUMP','EXTENSIBILIDAD')),
  valor_inicial_cm numeric(5,2) null,
  fue_ajustado boolean not null default false,
  detalle_ajuste text null,
  valor_final_cm numeric(5,2) null,
  temperatura_ambiente numeric(5,2) null,
  temperatura_concreto numeric(5,2) null,
  observaciones text null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists site_checks_created_at_idx on public.site_checks (created_at desc);
create index if not exists site_checks_plant_id_idx on public.site_checks (plant_id);
create index if not exists site_checks_remision_id_idx on public.site_checks (remision_id);
create index if not exists site_checks_remision_number_manual_idx on public.site_checks (remision_number_manual);

-- RLS
alter table public.site_checks enable row level security;

-- Policies
drop policy if exists site_checks_select on public.site_checks;
create policy site_checks_select on public.site_checks
  for select to authenticated
  using (exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid()
      and p.role in ('QUALITY_TEAM','PLANT_MANAGER','LABORATORY','EXECUTIVE')
  ));

drop policy if exists site_checks_insert on public.site_checks;
create policy site_checks_insert on public.site_checks
  for insert to authenticated
  with check (exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid()
      and p.role in ('QUALITY_TEAM','PLANT_MANAGER','LABORATORY','EXECUTIVE')
  ));

drop policy if exists site_checks_update on public.site_checks;
create policy site_checks_update on public.site_checks
  for update to authenticated
  using (
    created_by = auth.uid() or exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid()
        and p.role in ('QUALITY_TEAM','PLANT_MANAGER','LABORATORY','EXECUTIVE')
    )
  )
  with check (true);

-- Auto-link trigger when a remision is inserted later the same day
create or replace function public.link_site_checks_to_remision()
returns trigger language plpgsql as $$
begin
  update public.site_checks sc
    set remision_id = new.id
  where sc.remision_id is null
    and sc.remision_number_manual = new.remision_number::text;
  return new;
end;
$$;

drop trigger if exists trg_link_site_checks on public.remisiones;
create trigger trg_link_site_checks
after insert on public.remisiones
for each row execute function public.link_site_checks_to_remision();


