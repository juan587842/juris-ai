-- =============================================================================
-- Juris AI — Migration 0001: Schema inicial
-- =============================================================================

-- ─── Extensões ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- busca por similaridade (nome do lead)

-- =============================================================================
-- USUÁRIOS / PERFIS
-- =============================================================================

create type user_role as enum ('admin', 'advogado', 'atendente');

create table profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    full_name   text not null,
    role        user_role not null default 'atendente',
    oab_number  text,                        -- número OAB (advogados)
    avatar_url  text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- =============================================================================
-- CRM
-- =============================================================================

create type lead_status as enum (
    'novo', 'contato_feito', 'qualificado', 'desqualificado', 'convertido'
);

create type area_juridica as enum (
    'trabalhista', 'civil', 'criminal', 'familia', 'empresarial',
    'tributario', 'previdenciario', 'imobiliario', 'outro'
);

create table leads (
    id              uuid primary key default uuid_generate_v4(),
    nome            text,
    telefone        text not null,           -- E.164 (+5511999999999)
    email           text,
    origem          text default 'whatsapp', -- whatsapp | landing_page | indicacao
    status          lead_status not null default 'novo',
    area_interesse  area_juridica,
    notas           text,
    assigned_to     uuid references profiles(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (telefone)
);

create index leads_telefone_idx on leads (telefone);
create index leads_status_idx   on leads (status);

create type oportunidade_estagio as enum (
    'novo_lead',
    'qualificado',
    'proposta_enviada',
    'negociacao',
    'ganho',
    'perdido'
);

create table oportunidades (
    id              uuid primary key default uuid_generate_v4(),
    lead_id         uuid not null references leads(id) on delete cascade,
    titulo          text not null,
    estagio         oportunidade_estagio not null default 'novo_lead',
    valor_estimado  numeric(12,2),
    area_juridica   area_juridica,
    assigned_to     uuid references profiles(id),
    data_fechamento date,
    notas           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index oportunidades_lead_idx   on oportunidades (lead_id);
create index oportunidades_estagio_idx on oportunidades (estagio);

create table tags (
    id    uuid primary key default uuid_generate_v4(),
    nome  text not null unique,
    cor   text default '#6366f1'
);

create table lead_tags (
    lead_id uuid not null references leads(id) on delete cascade,
    tag_id  uuid not null references tags(id)  on delete cascade,
    primary key (lead_id, tag_id)
);

-- =============================================================================
-- CHAT (módulo próprio, inspirado no Chatwoot)
-- =============================================================================

create type inbox_canal as enum ('whatsapp', 'webchat', 'email');
create type conversation_status as enum ('aberta', 'em_atendimento', 'resolvida', 'pendente');
create type sender_type as enum ('lead', 'ai', 'agent', 'system');
create type conversation_event_tipo as enum (
    'criada', 'atribuida', 'ai_pausada', 'ai_retomada', 'resolvida', 'reaberta'
);

create table inboxes (
    id              uuid primary key default uuid_generate_v4(),
    nome            text not null,
    canal           inbox_canal not null default 'whatsapp',
    evolution_instance text,               -- nome da instância na Evolution API
    ativo           boolean not null default true,
    created_at      timestamptz not null default now()
);

create table conversations (
    id                  uuid primary key default uuid_generate_v4(),
    inbox_id            uuid not null references inboxes(id),
    lead_id             uuid not null references leads(id),
    status              conversation_status not null default 'aberta',
    assigned_user_id    uuid references profiles(id),
    ai_enabled          boolean not null default true,
    last_message_at     timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index conversations_lead_idx   on conversations (lead_id);
create index conversations_status_idx on conversations (status);
create index conversations_inbox_idx  on conversations (inbox_id);

create table messages (
    id              uuid primary key default uuid_generate_v4(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    sender_type     sender_type not null,
    sender_id       uuid,                  -- profiles.id quando sender_type='agent'
    content         text,
    media_url       text,
    media_type      text,                  -- image/audio/document/video
    delivered_at    timestamptz,
    read_at         timestamptz,
    created_at      timestamptz not null default now()
);

create index messages_conversation_idx on messages (conversation_id, created_at);

create table internal_notes (
    id              uuid primary key default uuid_generate_v4(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    user_id         uuid not null references profiles(id),
    content         text not null,
    created_at      timestamptz not null default now()
);

create table conversation_events (
    id              uuid primary key default uuid_generate_v4(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    tipo            conversation_event_tipo not null,
    actor_id        uuid references profiles(id),
    metadata        jsonb default '{}',
    created_at      timestamptz not null default now()
);

-- =============================================================================
-- JURÍDICO
-- =============================================================================

create table processos (
    id              uuid primary key default uuid_generate_v4(),
    numero_cnj      text not null,          -- formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
    cliente_id      uuid references leads(id),
    advogado_id     uuid references profiles(id),
    tribunal        text,
    vara            text,
    area_juridica   area_juridica,
    status          text default 'ativo',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (numero_cnj)
);

create table andamentos (
    id                  uuid primary key default uuid_generate_v4(),
    processo_id         uuid not null references processos(id) on delete cascade,
    data_andamento      date not null,
    texto_original      text not null,
    texto_traduzido     text,               -- preenchido pelo agente tradutor
    notificado_cliente  boolean not null default false,
    created_at          timestamptz not null default now()
);

create index andamentos_processo_idx on andamentos (processo_id, data_andamento desc);

create type fonte_intimacao as enum ('DJEN', 'DJE', 'domicilio_judicial');

create table intimacoes (
    id              uuid primary key default uuid_generate_v4(),
    processo_id     uuid not null references processos(id) on delete cascade,
    fonte           fonte_intimacao not null,
    data_publicacao date not null,
    prazo_fatal     date,
    texto           text,
    notificado_em   timestamptz,
    created_at      timestamptz not null default now()
);

create index intimacoes_processo_idx on intimacoes (processo_id);
create index intimacoes_prazo_idx    on intimacoes (prazo_fatal) where prazo_fatal is not null;

-- =============================================================================
-- CONFORMIDADE LGPD + AUDIT
-- =============================================================================

create type base_legal_lgpd as enum (
    'consentimento', 'contrato', 'obrigacao_legal', 'interesse_legitimo'
);

create table consentimentos_lgpd (
    id              uuid primary key default uuid_generate_v4(),
    lead_id         uuid not null references leads(id) on delete cascade,
    base_legal      base_legal_lgpd not null default 'consentimento',
    opt_in_at       timestamptz,
    opt_out_at      timestamptz,
    evidencia       text,                   -- texto da mensagem de consentimento enviada
    created_at      timestamptz not null default now(),
    unique (lead_id)
);

create table audit_log (
    id          uuid primary key default uuid_generate_v4(),
    actor       text not null,              -- 'ai', 'system', ou profiles.id
    acao        text not null,
    entidade    text not null,              -- nome da tabela afetada
    entidade_id uuid,
    payload     jsonb default '{}',
    ip_address  text,
    created_at  timestamptz not null default now()
);

create index audit_log_entidade_idx on audit_log (entidade, entidade_id);
create index audit_log_actor_idx    on audit_log (actor);

-- =============================================================================
-- FUNÇÕES / TRIGGERS
-- =============================================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_leads_updated_at
    before update on leads
    for each row execute function update_updated_at();

create trigger trg_oportunidades_updated_at
    before update on oportunidades
    for each row execute function update_updated_at();

create trigger trg_conversations_updated_at
    before update on conversations
    for each row execute function update_updated_at();

create trigger trg_processos_updated_at
    before update on processos
    for each row execute function update_updated_at();

create trigger trg_profiles_updated_at
    before update on profiles
    for each row execute function update_updated_at();

-- Atualiza last_message_at na conversation ao inserir mensagem
create or replace function update_conversation_last_message()
returns trigger language plpgsql as $$
begin
    update conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
    return new;
end;
$$;

create trigger trg_messages_last_message
    after insert on messages
    for each row execute function update_conversation_last_message();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table profiles             enable row level security;
alter table leads                enable row level security;
alter table oportunidades        enable row level security;
alter table tags                 enable row level security;
alter table lead_tags            enable row level security;
alter table inboxes              enable row level security;
alter table conversations        enable row level security;
alter table messages             enable row level security;
alter table internal_notes       enable row level security;
alter table conversation_events  enable row level security;
alter table processos            enable row level security;
alter table andamentos           enable row level security;
alter table intimacoes           enable row level security;
alter table consentimentos_lgpd  enable row level security;
alter table audit_log            enable row level security;

-- Profiles: usuário vê/edita apenas o próprio perfil; admin vê todos
create policy "profiles_self" on profiles
    for all using (auth.uid() = id);

create policy "profiles_admin_read" on profiles
    for select using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    );

-- Leads: usuários autenticados lêem; admin e advogado escrevem
create policy "leads_authenticated_read" on leads
    for select using (auth.role() = 'authenticated');

create policy "leads_write" on leads
    for all using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid()
            and p.role in ('admin', 'advogado', 'atendente')
        )
    );

-- Oportunidades: mesma lógica de leads
create policy "oportunidades_read" on oportunidades
    for select using (auth.role() = 'authenticated');

create policy "oportunidades_write" on oportunidades
    for all using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid()
            and p.role in ('admin', 'advogado', 'atendente')
        )
    );

-- Conversations / Messages: usuários autenticados
create policy "conversations_authenticated" on conversations
    for all using (auth.role() = 'authenticated');

create policy "messages_authenticated" on messages
    for all using (auth.role() = 'authenticated');

create policy "internal_notes_authenticated" on internal_notes
    for all using (auth.role() = 'authenticated');

create policy "conversation_events_authenticated" on conversation_events
    for all using (auth.role() = 'authenticated');

-- Inbox: somente admin gerencia
create policy "inboxes_read" on inboxes
    for select using (auth.role() = 'authenticated');

create policy "inboxes_admin_write" on inboxes
    for all using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    );

-- Tags
create policy "tags_read"  on tags for select using (auth.role() = 'authenticated');
create policy "tags_write" on tags for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'advogado'))
);
create policy "lead_tags_authenticated" on lead_tags
    for all using (auth.role() = 'authenticated');

-- Processos / Andamentos / Intimacoes: autenticados lêem; advogado/admin escrevem
create policy "processos_read"  on processos for select using (auth.role() = 'authenticated');
create policy "processos_write" on processos for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'advogado'))
);
create policy "andamentos_authenticated" on andamentos for all using (auth.role() = 'authenticated');
create policy "intimacoes_authenticated" on intimacoes for all using (auth.role() = 'authenticated');

-- LGPD: admin e advogado
create policy "consentimentos_write" on consentimentos_lgpd
    for all using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'advogado'))
    );

-- Audit log: somente leitura para admin; escrita via service_key (backend)
create policy "audit_log_admin_read" on audit_log
    for select using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    );

-- =============================================================================
-- SUPABASE REALTIME
-- =============================================================================

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
