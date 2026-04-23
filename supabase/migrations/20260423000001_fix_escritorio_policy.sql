-- fix: replace direct profiles subquery with get_my_role() to avoid RLS infinite recursion
drop policy if exists "escritorio_write" on public.escritorio;

create policy "escritorio_write" on public.escritorio
  for all using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- enforce single-row constraint
alter table public.escritorio
  add column if not exists singleton boolean not null default true unique;

-- NOT NULL on timestamps
alter table public.escritorio
  alter column created_at set not null,
  alter column updated_at set not null;

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
