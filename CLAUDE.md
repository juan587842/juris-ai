# CLAUDE.md — Juris AI

## Idioma
Sempre responder em **português brasileiro (pt-BR)**.

---

## Visão Geral do Projeto

**Juris AI** é uma plataforma de CRM e Legal Operations para escritórios de advocacia e departamentos jurídicos. Opera com automação 100% em Python, integrada ao WhatsApp via Evolution API, com painel centralizado no Chatwoot e orquestração de agentes de IA via Agno/LangGraph.

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Back-end | Python |
| Banco de dados | Supabase (PostgreSQL) — projeto `juris-db` |
| Mensageria / WhatsApp | Evolution API |
| Painel de atendimento | Chatwoot |
| Orquestração de agentes | Agno (tool calling rápido) / LangGraph (workflows longos) |
| LLM | OpenAI / OpenRouter |
| RPA / Automação | Python puro (sem no-code) |
| Infra / Auth | Supabase |

---

## Módulos Principais

1. **CRM / Business Development** — Funil Kanban, landing pages integradas
2. **Atendimento Omnicanal** — Chatbot via Evolution API + Chatwoot + transbordo humano
3. **Legal Ops / RPA** — Extração de PDFs, monitoramento de DJEN e Domicílio Judicial
4. **Jurimetria / BI** — Dashboards preditivos, análise de rentabilidade

---

## Regras de Desenvolvimento

- **Python puro** para automações — não usar ferramentas no-code ou low-code.
- **Supervisão humana obrigatória** — qualquer fluxo de IA deve permitir interrupção e assumida por humano via Chatwoot.
- **LGPD** — dados pessoais só podem ser coletados com consentimento explícito (opt-in). Suportar exclusão/anonimização (opt-out).
- **OAB Provimento 205/2021** — comunicação sóbria, sem captação indevida ou mercantilização.
- Não expor dados sensíveis de clientes em logs ou mensagens de erro.

---

## Supabase

- **Projeto:** `juris-db`
- **URL:** `https://yidxljgnhaqqetlkqaeh.supabase.co`
- MCP configurado em `.mcp.json` — usar ferramentas `mcp__supabase__*` para operações no banco.
- Sempre criar migrations para alterações de schema; nunca modificar o banco diretamente sem migration.
- RLS (Row Level Security) deve estar ativa em todas as tabelas com dados de usuários/clientes.
