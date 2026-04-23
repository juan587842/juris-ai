# Spec: Página de Configurações

**Data:** 2026-04-23
**Status:** Aprovado

---

## Visão Geral

Página `/configuracoes` com 5 tabs para gerenciar perfil do usuário, dados do escritório, integrações de canal, preferências de notificação e segurança de acesso. Dados persistidos no Supabase (exceto troca de senha, que usa Supabase Auth diretamente).

---

## Rota e Navegação

- **Rota:** `/configuracoes`
- **Arquivo:** `frontend/app/(app)/configuracoes/page.tsx`
- **AppShell:** adicionar item `{ href: "/configuracoes", label: "Configurações", icon: Settings }` no final de `NAV_ITEMS` em `frontend/components/layout/AppShell.tsx`

---

## Banco de Dados

### Migration 1 — tabela `escritorio`

```sql
create table public.escritorio (
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

create policy "leitura autenticada" on public.escritorio
  for select using (auth.role() = 'authenticated');

create policy "escrita admin" on public.escritorio
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
```

A tabela `escritorio` tem no máximo 1 row (configuração global do escritório).

### Migration 2 — coluna `notif_preferences` em `profiles`

```sql
alter table public.profiles
  add column notif_preferences jsonb not null default '{
    "dias_processo": 7,
    "dias_lead": 3,
    "dias_prazo": 5,
    "dias_oportunidade": 14,
    "canal": "whatsapp"
  }'::jsonb;
```

---

## Backend (Python)

### Endpoints novos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/configuracoes/perfil` | Retorna `profiles` do usuário logado + email do auth |
| PUT | `/api/configuracoes/perfil` | Atualiza `full_name`, `oab_number`, `avatar_url`, `notif_preferences` |
| GET | `/api/configuracoes/escritorio` | Retorna row da tabela `escritorio` |
| PUT | `/api/configuracoes/escritorio` | Upsert na tabela `escritorio` (requer role=admin) |
| GET | `/api/inboxes` | Lista todos os `inboxes` |
| POST | `/api/inboxes` | Cria novo inbox |
| PUT | `/api/inboxes/{id}` | Atualiza inbox (nome, evolution_instance, ativo) |

**Segurança:** troca de senha usa `supabase.auth.updateUser({ password })` direto do client — sem endpoint backend.

---

## Frontend

### Estrutura de arquivos

```
frontend/
  app/(app)/configuracoes/
    page.tsx                          ← controla tab ativa
  components/configuracoes/
    PerfilTab.tsx
    EscritorioTab.tsx
    IntegracoesTab.tsx
    NotificacoesTab.tsx
    SegurancaTab.tsx
```

### `page.tsx`

- Header: ícone `Settings`, título "Configurações", subtítulo "Gerencie seu perfil e preferências"
- Tabs no topo: Perfil | Escritório | Integrações | Notificações | Segurança
- Tab ativa controlada por estado local (`useState`)
- Passa `userId` e `userEmail` (do layout) para cada tab via props

### `PerfilTab`

- Campos editáveis: Nome completo (`full_name`), Nº OAB (`oab_number`), Avatar URL (`avatar_url`)
- Campo read-only: Email (vem do Supabase Auth — não editável aqui)
- Campo read-only: Função (`role`) — exibe label amigável (Admin / Advogado / Atendente)
- `GET /api/configuracoes/perfil` ao montar
- `PUT /api/configuracoes/perfil` ao salvar
- Feedback: toast/mensagem inline de sucesso ou erro

### `EscritorioTab`

- Campos: Nome do escritório, OAB (escritório), Logo URL, Endereço, Telefone, Site
- Textareas: Assinatura padrão, Texto de rodapé
- Se `role !== 'admin'`: todos os campos read-only + aviso "Somente administradores podem editar"
- `GET /api/configuracoes/escritorio` ao montar
- `PUT /api/configuracoes/escritorio` ao salvar
- Se GET retorna vazio (nenhum row): exibe form em branco para criação

### `IntegracoesTab`

- Lista cards de `inboxes` (nome, canal badge, evolution_instance, toggle ativo/inativo)
- Botão "Nova integração" → expande form inline: Nome, Canal (select: whatsapp/webchat/email), Evolution Instance
- `GET /api/inboxes` ao montar
- `POST /api/inboxes` ao criar; `PUT /api/inboxes/{id}` ao editar/toggle ativo

### `NotificacoesTab`

- 4 inputs numéricos com label e descrição:
  - Processos sem andamento (dias) — `dias_processo`
  - Leads sem contato (dias) — `dias_lead`
  - Prazo fatal (dias antes) — `dias_prazo`
  - Oportunidade parada (dias) — `dias_oportunidade`
- Select canal: WhatsApp | Email
- Reutiliza os mesmos controles do `ConfigPanel` da página Alertas
- `GET /api/configuracoes/perfil` ao montar (lê `notif_preferences`)
- `PUT /api/configuracoes/perfil` ao salvar — persiste no Supabase **e** escreve `alertas_config` no localStorage (mesma chave usada pela página Alertas), mantendo compatibilidade sem alterar a página Alertas

### `SegurancaTab`

- 3 campos: Senha atual, Nova senha, Confirmar nova senha
- Validação client-side: nova senha ≥ 8 chars; confirmar = nova
- Chama `supabase.auth.updateUser({ password: novaSenha })` direto do client
- Não envia senha atual para o backend (Supabase Auth não requer re-auth para update)
- Feedback inline de sucesso/erro

---

## Padrão Visual

Segue o padrão das outras páginas:
- Container: `flex flex-col h-full overflow-y-auto bg-radial-gold`
- Header: `border-b px-6 py-4` com ícone gold + título + subtítulo
- Cards/seções: `bg-surface/60 border border-border/60 rounded-xl p-6`
- Inputs: `bg-surface-elevated border border-border/60 rounded-lg px-3 py-2 text-sm`
- Botão salvar: `bg-primary text-background` (gold sólido)
- Tabs: estilo similar ao seletor de período do Analytics (ativo = gold sólido, inativo = `bg-surface/40`)

---

## Restrições e Observações

- RLS em `escritorio`: apenas admin pode escrever; qualquer autenticado lê
- `notif_preferences` em `profiles`: cada usuário tem suas próprias preferências
- `NotificacoesTab` escreve no localStorage (chave `alertas_config`) ao salvar, mantendo a página Alertas sem alteração
- Não há upload de arquivo para logo/avatar — campos aceitam URL externa
- Sem feature de convite de usuários neste escopo
