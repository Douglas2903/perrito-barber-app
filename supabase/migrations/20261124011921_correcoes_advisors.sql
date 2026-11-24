-- =============================================================================
-- Perrito Barber App 3.0 — Migração 05: correções apontadas pelos advisors
-- -----------------------------------------------------------------------------
-- Alerta 0029 (authenticated_security_definer_function_executable):
-- funções SECURITY DEFINER ficavam expostas diretamente em /rest/v1/rpc.
--
-- Correção (padrão recomendado pelo Supabase): a implementação SECURITY
-- DEFINER vai para o schema "private" (não exposto pela API) e o schema
-- "public" mantém só uma função fina SECURITY INVOKER, com a mesma assinatura,
-- que repassa a chamada. O front-end continua chamando os mesmos nomes.
-- Toda a validação de papel continua dentro das funções em "private".
-- =============================================================================

-- 1) Move as implementações para o schema private (grants são preservados).
alter function public.horarios_disponiveis(date, uuid[], uuid)     set schema private;
alter function public.criar_agendamento(timestamptz, uuid[], uuid) set schema private;
alter function public.cancelar_agendamento(uuid, text)             set schema private;
alter function public.concluir_agendamento(uuid)                   set schema private;
alter function public.trocar_barbeiro(uuid, uuid)                  set schema private;
alter function public.excluir_minha_conta()                        set schema private;
alter function public.promover_barbeiro(text, uuid)                set schema private;
alter function public.desvincular_barbeiro(uuid)                   set schema private;

-- 2) Funções públicas finas (SECURITY INVOKER) — a "fachada" da API.
create function public.horarios_disponiveis(
  p_data date, p_servicos uuid[], p_barbeiro_id uuid default null
)
returns table (inicio timestamptz, barbeiro_id uuid, barbeiro_nome text)
language sql security invoker set search_path = ''
as $$ select * from private.horarios_disponiveis(p_data, p_servicos, p_barbeiro_id); $$;

create function public.criar_agendamento(
  p_inicio timestamptz, p_servicos uuid[], p_barbeiro_id uuid default null
)
returns uuid
language sql security invoker set search_path = ''
as $$ select private.criar_agendamento(p_inicio, p_servicos, p_barbeiro_id); $$;

create function public.cancelar_agendamento(p_id uuid, p_motivo text default null)
returns void
language sql security invoker set search_path = ''
as $$ select private.cancelar_agendamento(p_id, p_motivo); $$;

create function public.concluir_agendamento(p_id uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.concluir_agendamento(p_id); $$;

create function public.trocar_barbeiro(p_id uuid, p_novo_barbeiro uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.trocar_barbeiro(p_id, p_novo_barbeiro); $$;

create function public.excluir_minha_conta()
returns void
language sql security invoker set search_path = ''
as $$ select private.excluir_minha_conta(); $$;

create function public.promover_barbeiro(p_email text, p_barbeiro_id uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.promover_barbeiro(p_email, p_barbeiro_id); $$;

create function public.desvincular_barbeiro(p_barbeiro_id uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.desvincular_barbeiro(p_barbeiro_id); $$;

-- 3) Permissões das fachadas: só usuários autenticados.
revoke execute on function public.horarios_disponiveis(date, uuid[], uuid)     from public, anon;
revoke execute on function public.criar_agendamento(timestamptz, uuid[], uuid) from public, anon;
revoke execute on function public.cancelar_agendamento(uuid, text)             from public, anon;
revoke execute on function public.concluir_agendamento(uuid)                   from public, anon;
revoke execute on function public.trocar_barbeiro(uuid, uuid)                  from public, anon;
revoke execute on function public.excluir_minha_conta()                        from public, anon;
revoke execute on function public.promover_barbeiro(text, uuid)                from public, anon;
revoke execute on function public.desvincular_barbeiro(uuid)                   from public, anon;

grant execute on function public.horarios_disponiveis(date, uuid[], uuid)     to authenticated;
grant execute on function public.criar_agendamento(timestamptz, uuid[], uuid) to authenticated;
grant execute on function public.cancelar_agendamento(uuid, text)             to authenticated;
grant execute on function public.concluir_agendamento(uuid)                   to authenticated;
grant execute on function public.trocar_barbeiro(uuid, uuid)                  to authenticated;
grant execute on function public.excluir_minha_conta()                        to authenticated;
grant execute on function public.promover_barbeiro(text, uuid)                to authenticated;
grant execute on function public.desvincular_barbeiro(uuid)                   to authenticated;
