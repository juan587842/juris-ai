-- Fix: recursão infinita nas policies RLS que consultavam a tabela profiles diretamente.
-- Solução: função SECURITY DEFINER que lê o role sem ativar RLS.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- profiles
DROP POLICY IF EXISTS profiles_admin_read ON profiles;
CREATE POLICY profiles_admin_read ON profiles
  FOR SELECT
  USING (auth.uid() = id OR get_my_role() = 'admin');

-- leads
DROP POLICY IF EXISTS leads_write ON leads;
CREATE POLICY leads_write ON leads
  FOR ALL
  USING (get_my_role() IN ('admin', 'advogado', 'atendente'));

-- oportunidades
DROP POLICY IF EXISTS oportunidades_write ON oportunidades;
CREATE POLICY oportunidades_write ON oportunidades
  FOR ALL
  USING (get_my_role() IN ('admin', 'advogado', 'atendente'));

-- processos
DROP POLICY IF EXISTS processos_write ON processos;
CREATE POLICY processos_write ON processos
  FOR ALL
  USING (get_my_role() IN ('admin', 'advogado'));

-- inboxes
DROP POLICY IF EXISTS inboxes_admin_write ON inboxes;
CREATE POLICY inboxes_admin_write ON inboxes
  FOR ALL
  USING (get_my_role() = 'admin');

-- tags
DROP POLICY IF EXISTS tags_write ON tags;
CREATE POLICY tags_write ON tags
  FOR ALL
  USING (get_my_role() IN ('admin', 'advogado'));

-- consentimentos_lgpd
DROP POLICY IF EXISTS consentimentos_write ON consentimentos_lgpd;
CREATE POLICY consentimentos_write ON consentimentos_lgpd
  FOR ALL
  USING (get_my_role() IN ('admin', 'advogado'));

-- audit_log
DROP POLICY IF EXISTS audit_log_admin_read ON audit_log;
CREATE POLICY audit_log_admin_read ON audit_log
  FOR SELECT
  USING (get_my_role() = 'admin');
