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
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.escritorio enable row level security;

create policy "escritorio_select" on public.escritorio
  for select using (auth.role() = 'authenticated');

create policy "escritorio_write" on public.escritorio
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- preferências de notificação por usuário
alter table public.profiles
  add column if not exists notif_preferences jsonb not null default '{
    "dias_processo": 7,
    "dias_lead": 3,
    "dias_prazo": 5,
    "dias_oportunidade": 14,
    "canal": "whatsapp"
  }'::jsonb;
