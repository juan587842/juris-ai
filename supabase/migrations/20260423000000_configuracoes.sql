-- tabela escritorio (1 row global)
create table if not exists public.escritorio (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  oab         text,
  logo_url    text,
  endereco    text,
  telefone    text,
  site        text,
  assinatura  text,
  rodape      text,
  singleton   boolean not null default true unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.escritorio enable row level security;

create policy "escritorio_select" on public.escritorio
  for select using (auth.role() = 'authenticated');

create policy "escritorio_write" on public.escritorio
  for all using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_escritorio_updated_at
  before update on public.escritorio
  for each row execute function public.set_updated_at();

-- preferências de notificação por usuário
alter table public.profiles
  add column if not exists notif_preferences jsonb not null default '{
    "dias_processo": 7,
    "dias_lead": 3,
    "dias_prazo": 5,
    "dias_oportunidade": 14,
    "canal": "whatsapp"
  }'::jsonb;
