-- =============================================================================
-- Perrito Barber App 3.0 — Migração 04: Row Level Security e permissões
-- -----------------------------------------------------------------------------
-- Duas camadas (RNF03):
--   1) GRANT/REVOKE: o que cada papel do Postgres pode fazer na tabela
--      (ex.: ninguém do front-end faz INSERT/UPDATE/DELETE em agendamentos).
--   2) RLS: quais LINHAS cada usuário enxerga/altera.
-- O papel "anon" (visitante sem login) não acessa nenhuma tabela.
-- Nas políticas, auth.uid() e as funções auxiliares vão dentro de (select ...)
-- para serem avaliadas uma vez por consulta, e não uma vez por linha.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RLS ativada em todas as tabelas
-- -----------------------------------------------------------------------------
alter table public.perfis               enable row level security;
alter table public.barbeiros            enable row level security;
alter table public.servicos             enable row level security;
alter table public.escalas              enable row level security;
alter table public.bloqueios            enable row level security;
alter table public.agendamentos         enable row level security;
alter table public.agendamento_servicos enable row level security;

-- -----------------------------------------------------------------------------
-- Privilégios de tabela (começa do zero e libera só o necessário)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated;

-- perfis: o usuário só altera nome e telefone (papel e e-mail nunca pelo front).
grant update (nome, telefone) on public.perfis to authenticated;

-- Cadastros mantidos pelo gerente (a RLS restringe ao papel gerente).
-- barbeiros.perfil_id fica de fora: só muda pelas RPCs promover/desvincular.
grant insert (nome, nivel, ativo), update (nome, nivel, ativo) on public.barbeiros to authenticated;
grant insert (nome, preco, duracao_min, ativo), update (nome, preco, duracao_min, ativo) on public.servicos to authenticated;
grant insert, update, delete on public.escalas   to authenticated;
grant insert, update, delete on public.bloqueios to authenticated;

-- agendamentos e agendamento_servicos: somente leitura para o front-end.
-- Inserção/alteração apenas pelas funções RPC (SECURITY DEFINER).

-- Funções auxiliares usadas nas políticas precisam ser executáveis.
revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.papel_atual()       to authenticated;
grant execute on function private.eh_gerente()        to authenticated;
grant execute on function private.barbeiro_atual_id() to authenticated;

-- RPCs públicas: só usuários autenticados.
revoke execute on function public.horarios_disponiveis(date, uuid[], uuid)       from public, anon;
revoke execute on function public.criar_agendamento(timestamptz, uuid[], uuid)   from public, anon;
revoke execute on function public.cancelar_agendamento(uuid, text)               from public, anon;
revoke execute on function public.concluir_agendamento(uuid)                     from public, anon;
revoke execute on function public.trocar_barbeiro(uuid, uuid)                    from public, anon;
revoke execute on function public.excluir_minha_conta()                          from public, anon;
revoke execute on function public.promover_barbeiro(text, uuid)                  from public, anon;
revoke execute on function public.desvincular_barbeiro(uuid)                     from public, anon;

grant execute on function public.horarios_disponiveis(date, uuid[], uuid)     to authenticated;
grant execute on function public.criar_agendamento(timestamptz, uuid[], uuid) to authenticated;
grant execute on function public.cancelar_agendamento(uuid, text)             to authenticated;
grant execute on function public.concluir_agendamento(uuid)                   to authenticated;
grant execute on function public.trocar_barbeiro(uuid, uuid)                  to authenticated;
grant execute on function public.excluir_minha_conta()                        to authenticated;
grant execute on function public.promover_barbeiro(text, uuid)                to authenticated;
grant execute on function public.desvincular_barbeiro(uuid)                   to authenticated;

-- =============================================================================
-- Políticas
-- =============================================================================

-- ---------------------------------- perfis -----------------------------------
-- Cada um lê o próprio; o gerente lê todos; o barbeiro lê os clientes que têm
-- agendamento com ele (para ver nome e telefone na agenda).
create policy perfis_select on public.perfis
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.eh_gerente())
    or exists (
      select 1 from public.agendamentos a
      where a.cliente_id = perfis.id
        and a.barbeiro_id = (select private.barbeiro_atual_id())
    )
  );

create policy perfis_update on public.perfis
  for update to authenticated
  using      (id = (select auth.uid()) or (select private.eh_gerente()))
  with check (id = (select auth.uid()) or (select private.eh_gerente()));

-- --------------------------------- barbeiros ---------------------------------
-- Ativos: qualquer autenticado. Inativos: gerente, o próprio barbeiro e quem
-- tem agendamento com ele (para o histórico continuar mostrando o nome).
create policy barbeiros_select on public.barbeiros
  for select to authenticated
  using (
    ativo
    or (select private.eh_gerente())
    or perfil_id = (select auth.uid())
    or exists (select 1 from public.agendamentos a where a.barbeiro_id = barbeiros.id)
  );

create policy barbeiros_insert on public.barbeiros
  for insert to authenticated
  with check ((select private.eh_gerente()));

create policy barbeiros_update on public.barbeiros
  for update to authenticated
  using ((select private.eh_gerente()))
  with check ((select private.eh_gerente()));

-- --------------------------------- servicos ----------------------------------
-- Ativos: qualquer autenticado. Inativos: gerente e quem tem esse serviço em
-- algum agendamento visível (histórico).
create policy servicos_select on public.servicos
  for select to authenticated
  using (
    ativo
    or (select private.eh_gerente())
    or exists (select 1 from public.agendamento_servicos i where i.servico_id = servicos.id)
  );

create policy servicos_insert on public.servicos
  for insert to authenticated
  with check ((select private.eh_gerente()));

create policy servicos_update on public.servicos
  for update to authenticated
  using ((select private.eh_gerente()))
  with check ((select private.eh_gerente()));

-- --------------------------------- escalas -----------------------------------
-- Leitura liberada (expediente não é dado sensível); escrita só do gerente.
create policy escalas_select on public.escalas
  for select to authenticated
  using (true);

create policy escalas_insert on public.escalas
  for insert to authenticated
  with check ((select private.eh_gerente()));

create policy escalas_update on public.escalas
  for update to authenticated
  using ((select private.eh_gerente()))
  with check ((select private.eh_gerente()));

create policy escalas_delete on public.escalas
  for delete to authenticated
  using ((select private.eh_gerente()));

-- -------------------------------- bloqueios ----------------------------------
create policy bloqueios_select on public.bloqueios
  for select to authenticated
  using (
    (select private.eh_gerente())
    or barbeiro_id = (select private.barbeiro_atual_id())
  );

create policy bloqueios_insert on public.bloqueios
  for insert to authenticated
  with check ((select private.eh_gerente()));

create policy bloqueios_update on public.bloqueios
  for update to authenticated
  using ((select private.eh_gerente()))
  with check ((select private.eh_gerente()));

create policy bloqueios_delete on public.bloqueios
  for delete to authenticated
  using ((select private.eh_gerente()));

-- ------------------------------- agendamentos --------------------------------
-- Cliente: os próprios. Barbeiro: só os dele. Gerente: todos.
-- Não há política de INSERT/UPDATE/DELETE: escrita só via RPC.
create policy agendamentos_select on public.agendamentos
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or barbeiro_id = (select private.barbeiro_atual_id())
    or (select private.eh_gerente())
  );

-- --------------------------- agendamento_servicos ----------------------------
-- Visível quando o agendamento correspondente é visível (a RLS de
-- agendamentos é aplicada dentro do EXISTS).
create policy agendamento_servicos_select on public.agendamento_servicos
  for select to authenticated
  using (
    exists (select 1 from public.agendamentos a where a.id = agendamento_servicos.agendamento_id)
  );
