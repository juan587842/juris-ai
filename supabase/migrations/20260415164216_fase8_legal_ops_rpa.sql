-- Fase 8: Legal Ops / RPA — campos de monitoramento

-- processos: configuração de monitoramento
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS monitorar           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificar_cliente   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultima_verificacao_at TIMESTAMPTZ;

-- andamentos: campos adicionados pelo robô
ALTER TABLE andamentos
  ADD COLUMN IF NOT EXISTS pdf_url                TEXT,
  ADD COLUMN IF NOT EXISTS pdf_texto              TEXT,
  ADD COLUMN IF NOT EXISTS notificado_advogado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notificado_cliente_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origem                 TEXT NOT NULL DEFAULT 'manual';

-- intimacoes: rastrear envio de WhatsApp
ALTER TABLE intimacoes
  ADD COLUMN IF NOT EXISTS notificado_advogado_at TIMESTAMPTZ;

-- Nova tabela: histórico de verificações do robô
CREATE TABLE IF NOT EXISTS monitoramento_logs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id               UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  provider                  TEXT NOT NULL,
  status                    TEXT NOT NULL CHECK (status IN ('ok','erro','sem_novidade')),
  movimentacoes_encontradas INT  NOT NULL DEFAULT 0,
  erro_msg                  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE monitoramento_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitoramento_logs_authenticated"
  ON monitoramento_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_monitoramento_logs_processo
  ON monitoramento_logs(processo_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_processos_monitorar
  ON processos(monitorar) WHERE monitorar = true;
