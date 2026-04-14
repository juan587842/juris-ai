*Aviso: A integração com a plataforma **Chatwoot** foi uma especificação sua e não consta nas fontes fornecidas. Trata-se de uma informação externa ao material de base, e você pode querer verificar independentemente a documentação oficial dessa ferramenta para o seu desenvolvimento.*

# Documento de Requisitos do Produto (PRD) - Juris AI

## 1. Visão Geral do Produto
O **Juris AI** é uma plataforma de CRM e *Legal Operations* focada em escritórios de advocacia e departamentos jurídicos. O sistema opera com automação 100% baseada em código **Python**, integrado de forma nativa ao WhatsApp via **Evolution API**. O seu grande diferencial é a orquestração inteligente de agentes de IA — gerenciada sob demanda via **Agno** ou **LangGraph** — e uma interface de atendimento centralizada no **Chatwoot** para acompanhamento humano. A plataforma atua unindo a qualificação de novos leads à eficiência processual e à tradução de andamentos para clientes.

## 2. O Problema
*   **Perda de Receita por Tempo de Resposta:** Escritórios perdem clientes potenciais pela demora no atendimento. **Se mais de 30% dos leads passarem de 60 minutos sem resposta, há receita deixada na mesa**.
*   **Comunicação Desorganizada:** O uso descentralizado do WhatsApp **gera dependência de "prints" de conversas para registrar o histórico do cliente, fragmentando as informações no escritório**.
*   **Gargalos Operacionais e Prazos:** A contagem manual de prazos e o trabalho administrativo consomem tempo estratégico e elevam o risco de perdas ou preclusões processuais.
*   **Barreira do "Juridiquês":** Clientes leigos têm grande dificuldade em entender o andamento dos seus processos, gerando ansiedade e sobrecarregando o suporte.

## 3. Objetivos do Produto
*   **Automação do Atendimento Inicial:** Triagem imediata via IA no WhatsApp, garantindo respostas e qualificação de contatos 24/7.
*   **Centralização da Comunicação:** Unificar todos os canais de atendimento em uma única tela de chat operada via Chatwoot, eliminando a confusão de múltiplos aparelhos ou abas do WhatsApp Web.
*   **Eficiência em Escala (Python RPA):** Substituir ferramentas visuais engessadas por automações em código Python para a extração de dados e monitoramento de tribunais.
*   **Fidelização Proativa:** Informar o cliente ativamente sobre atualizações do processo, com a IA atuando como tradutora das movimentações complexas.

## 4. Público-Alvo
*   Pequenos e médios escritórios de advocacia que precisam estruturar a captação de clientes e o relacionamento.
*   Operações jurídicas (*Legal Ops*) e departamentos corporativos que necessitam de integrações escaláveis via código (Python) para lidar com alto volume de demandas e organização centralizada de mensageria.

---

## 5. Funcionalidades Principais (Core Features)

### 5.1. Módulo CRM e Business Development
*   **Funil de Vendas Visual (Kanban):** Visualização clara de oportunidades em cada estágio (ex: Novo Lead, Qualificado, Proposta Enviada).
*   **Páginas de Captura:** Criação de *landing pages* integradas ao CRM para captação de leads via tráfego pago (Google/Meta Ads).

### 5.2. Módulo de Atendimento Omnicanal (Integração Chatwoot + IA)
*   **Página de Chat Vinculada ao WhatsApp (Chatwoot):** Interface visual unificada baseada no Chatwoot para os advogados e a equipe comercial visualizarem e assumirem as conversas que ocorrem no WhatsApp.
*   **Chatbot via Evolution API:** O agente coleta informações, compreende o problema jurídico, qualifica o lead e o insere no funil de vendas. Todo o histórico fica visível na página do Chatwoot.
*   **Transbordo Humano (*Human-in-the-loop*):** Quando a IA esgota seu conhecimento ou identifica um lead de altíssimo valor, ela pausa sua atuação e sinaliza na interface do Chatwoot para que um advogado assuma a conversa instantaneamente.
*   **Tira-Dúvidas Jurídico (Tradução):** A IA busca os andamentos nos sistemas dos tribunais e responde às dúvidas do cliente em linguagem simples e objetiva em segundos, visível no painel do Chatwoot.

### 5.3. Módulo de Legal Ops e Automação RPA (Python)
*   **Orquestração de Dados e Documentos:** Algoritmos em Python leem e extraem dados de PDFs e petições, organizando os arquivos nativamente na nuvem.
*   **Monitoramento Ativo de Prazos:** Scripts em Python monitoram o Diário da Justiça Eletrônico Nacional (DJEN) e o Domicílio Judicial Eletrônico, disparando alertas automáticos sobre novas intimações.

### 5.4. Módulo de Jurimetria e BI
*   **Análise Preditiva e Dashboards:** Aplicação de ciência de dados para estimar chances de êxito, prever comportamentos de magistrados e mensurar a rentabilidade de cada caso.

---

## 6. Arquitetura Técnica e Orquestração (Back-end)
*   **Mensageria e Interface de Chat:** Utilização da **Evolution API** para se conectar ao WhatsApp, repassando os *webhooks* diretamente para o **Chatwoot**, que funcionará como o painel central de conversas de toda a equipe.
*   **Motor Cognitivo:** Modelos providos pela **OpenAI / OpenRouter**, refinados com prompts jurídicos de alta precisão.
*   **Orquestração de Agentes (Agno / LangGraph):** 
    *   *Agno:* Para tarefas rápidas da IA, como chamadas de ferramentas (*tool calling*) no back-end.
    *   *LangGraph:* Para fluxos cíclicos de longa duração (*workflows*), gerenciando a passagem de bastão perfeita entre a IA e o atendente humano no Chatwoot.
*   **Automação Core:** Desenvolvimento de RPA puramente em **Python** para integração via APIs aos tribunais, dispensando plataformas *no-code*.

---

## 7. Requisitos Não Funcionais (Ética, IA e Segurança)

### 7.1. Conformidade com a OAB (Provimento 205/2021)
*   **Publicidade Passiva e Sobriedade:** **A publicidade profissional deve ser informativa, pautar-se de forma sóbria e discreta, e não incutir a mercantilização ou a captação indevida de clientela**.
*   **Supervisão Humana Inegociável:** O uso do Chatwoot garante que a atuação autônoma do *bot* possa ser interrompida a qualquer momento, mantendo a responsabilidade técnica com o advogado e prevenindo respostas alucinadas.

### 7.2. Conformidade com a LGPD (Lei 13.709/18)
*   **Gestão de Consentimento (Opt-in):** **A legislação foi criada para regulamentar a utilização dos dados pessoais e proteger os direitos fundamentais de liberdade e privacidade**. O sistema solicitará o consentimento no Chatwoot/WhatsApp, garantindo que seja uma **manifestação livre, informada e inequívoca** antes da coleta de dados.
*   **Direito de Exclusão (Opt-out):** O titular dos dados pode solicitar o descadastro a qualquer momento, exigindo que o fluxo em Python anonimize ou exclua os dados imediatamente no CRM.

---

## 8. Métricas de Sucesso (KPIs)
*   **SLA de Atendimento:** Redução do tempo de resposta inicial para segundos (garantido pela IA) e centralização de todos os "chamados" no Chatwoot, acabando com a perda de leads.
*   **Crescimento do Faturamento:** Aumento do número de contratos assinados oriundos de conversões otimizadas do funil de vendas integrado ao chat.
*   **Otimização de Horas (Timesheet):** Volume de horas semanais salvas com a automação em Python e triagem prévia do Chatwoot.