-- Adiciona campo resultado em processos para calcular taxa de êxito
ALTER TABLE processos
ADD COLUMN resultado text CHECK (resultado IN (
  'procedente', 'improcedente', 'acordo', 'desistencia'
));

COMMENT ON COLUMN processos.resultado IS
  'Desfecho do processo. NULL = em andamento. Preenchido ao finalizar/arquivar.';
