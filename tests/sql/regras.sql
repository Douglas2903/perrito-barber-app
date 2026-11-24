-- =============================================================================
-- Perrito Barber App 3.0 — Testes automatizados das regras do banco
-- -----------------------------------------------------------------------------
-- Como rodar: cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- Tudo roda dentro de BEGIN ... ROLLBACK: nenhum dado fica gravado.
-- O resultado é uma tabela com uma linha por verificação (coluna "passou").
--
-- Pré-requisito: migrações + seed aplicados (usa os IDs fixos do seed).
-- Os testes simulam usuários logados trocando o papel do Postgres para
-- "authenticated" e preenchendo request.jwt.claims (o mesmo que a API faz).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Infraestrutura do teste
-- -----------------------------------------------------------------------------
create temp table resultados (
  ordem     timestamptz default clock_timestamp(),
  caso      text,
  descricao text,
  passou    boolean,
  detalhe   text
);
grant all on resultados to authenticated, anon;

-- Simula o usuário logado (null = volta a ser administrador).
create function pg_temp.como(p_usuario uuid) returns void language plpgsql as $$
begin
  if p_usuario is null then
    reset role;
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

-- Executa um comando e registra se o resultado (aceito/recusado) era o esperado.
create function pg_temp.tentar(p_caso text, p_descricao text, p_comando text, p_deve_aceitar boolean)
returns void language plpgsql as $$
begin
  begin
    execute p_comando;
    insert into resultados (caso, descricao, passou, detalhe)
    values (p_caso, p_descricao, p_deve_aceitar, 'aceito');
  exception when others then
    insert into resultados (caso, descricao, passou, detalhe)
    values (p_caso, p_descricao, not p_deve_aceitar, 'recusado: ' || sqlerrm);
  end;
end $$;

-- Avalia uma condição booleana em SQL e registra o resultado.
create function pg_temp.verificar(p_caso text, p_descricao text, p_condicao text)
returns void language plpgsql as $$
declare
  v_ok boolean;
begin
  execute 'select (' || p_condicao || ')' into v_ok;
  insert into resultados (caso, descricao, passou, detalhe)
  values (p_caso, p_descricao, coalesce(v_ok, false), p_condicao);
exception when others then
  insert into resultados (caso, descricao, passou, detalhe)
  values (p_caso, p_descricao, false, 'erro: ' || sqlerrm);
end $$;

-- Próxima data (a partir de hoje + 8 dias, para não colidir com o seed) no dia da semana pedido.
create function pg_temp.dia(p_dow int) returns date language sql as $$
  select d::date
  from generate_series((now() at time zone 'America/Sao_Paulo')::date + 8,
                       (now() at time zone 'America/Sao_Paulo')::date + 14, interval '1 day') d
  where extract(dow from d) = p_dow
  limit 1;
$$;

-- Data + hora local de São Paulo => timestamptz.
create function pg_temp.em(p_dia date, p_hora time) returns timestamptz language sql as $$
  select (p_dia + p_hora) at time zone 'America/Sao_Paulo';
$$;

-- Monta a chamada de criar_agendamento.
create function pg_temp.agendar(p_inicio timestamptz, p_servicos uuid[], p_barbeiro uuid)
returns text language sql as $$
  select format('select public.criar_agendamento(%L, %L, %L)', p_inicio, p_servicos, p_barbeiro);
$$;

-- IDs fixos do seed:
--   serviços:  ...0001 corte (45 min, R$60) | ...0002 barba (30) | ...0004 sobrancelha (15)
--   barbeiros: 2...0001 Sênior | 2...0002 Pleno | 2...0003 Júnior
--   usuários:  3...0001 gerente | 3...0002 barbeiro Sênior | 3...0005 cliente1 | 3...0006 cliente2

-- -----------------------------------------------------------------------------
-- Preparação feita pelo administrador: bloqueio do Pleno na quarta, 16h–18h.
-- -----------------------------------------------------------------------------
insert into public.bloqueios (barbeiro_id, inicio, fim, motivo)
values ('22222222-0000-4000-8000-000000000002',
        pg_temp.em(pg_temp.dia(3), '16:00'), pg_temp.em(pg_temp.dia(3), '18:00'), 'Teste automatizado');

-- =============================================================================
-- RD03 — agendamentos que devem ser RECUSADOS (como cliente1)
-- =============================================================================
select pg_temp.como('33333333-0000-4000-8000-000000000005');

select pg_temp.tentar('R01', 'Antes do expediente (quarta 09:00)',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '09:00'), array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000001'), false);

select pg_temp.tentar('R02', 'Termina depois do expediente (quarta 19:30 + 45 min)',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '19:30'), array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000001'), false);

select pg_temp.tentar('R03', 'No almoço do Sênior (quarta 12:00)',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '12:00'), array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000001'), false);

select pg_temp.tentar('R04', 'Invade o almoço (quarta 11:30 + 45 min)',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '11:30'), array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000001'), false);

select pg_temp.tentar('R05', 'Durante bloqueio do Pleno (quarta 16:30)',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '16:30'), array['11111111-0000-4000-8000-000000000002']::uuid[], '22222222-0000-4000-8000-000000000002'), false);

select pg_temp.tentar('R06', 'No passado (ontem)',
  pg_temp.agendar(date_trunc('hour', now()) - interval '1 day', array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000001'), false);

select pg_temp.tentar('R07', 'Segunda-feira (fechado)',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(1), '11:00'), array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000001'), false);

select pg_temp.tentar('R08', 'Domingo (fechado)',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(0), '11:00'), array['11111111-0000-4000-8000-000000000001']::uuid[], null), false);

select pg_temp.tentar('R09', 'Fora da grade de 15 min (quarta 17:10)',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '17:10'), array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000001'), false);

-- =============================================================================
-- RD01/RD02 — conflito por barbeiro
-- =============================================================================
select pg_temp.tentar('R10', 'Cliente1 com o Sênior (quarta 17:00) — aceito',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '17:00'), array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000001'), true);

select pg_temp.como('33333333-0000-4000-8000-000000000006');

select pg_temp.tentar('R11', 'Cliente2 com o Júnior no MESMO horário (RD02) — aceito',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '17:00'), array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000003'), true);

select pg_temp.tentar('R12', 'Cliente2 com o Sênior sobrepondo (quarta 17:30) — recusado (RD01)',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '17:30'), array['11111111-0000-4000-8000-000000000002']::uuid[], '22222222-0000-4000-8000-000000000001'), false);

-- Sênior e Júnior ocupados e Pleno bloqueado às 17:00: "qualquer profissional" não encontra ninguém.
select pg_temp.tentar('R13', 'Qualquer profissional às 17:00 com todos indisponíveis — recusado',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '17:00'), array['11111111-0000-4000-8000-000000000004']::uuid[], null), false);

select pg_temp.tentar('R14', 'Qualquer profissional às 18:00 — aceito',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '18:00'), array['11111111-0000-4000-8000-000000000004']::uuid[], null), true);

-- =============================================================================
-- RF06 / RNF01 — horários disponíveis
-- =============================================================================
create temp table medicao as select clock_timestamp() as inicio;
grant all on medicao to authenticated;

create temp table horarios as
  select * from public.horarios_disponiveis(pg_temp.dia(3), array['11111111-0000-4000-8000-000000000001']::uuid[], null);
grant all on horarios to authenticated;

select pg_temp.verificar('R15', 'horarios_disponiveis responde em menos de 2 s (RNF01)',
  $$ (select clock_timestamp() - inicio from medicao) < interval '2 seconds' $$);
select pg_temp.verificar('R16', 'Há horários livres na quarta',
  $$ (select count(*) from horarios) > 0 $$);
select pg_temp.verificar('R17', '17:00 não aparece (todos ocupados/bloqueados)',
  $$ not exists (select 1 from horarios where inicio = pg_temp.em(pg_temp.dia(3), '17:00')) $$);
select pg_temp.verificar('R18', 'Nenhum horário cai no almoço de quem foi indicado',
  $$ not exists (
       select 1 from horarios h join public.escalas e
         on e.barbeiro_id = h.barbeiro_id and e.dia_semana = 3
       where (h.inicio at time zone 'America/Sao_Paulo')::time < e.almoco_fim
         and ((h.inicio + interval '45 minutes') at time zone 'America/Sao_Paulo')::time > e.almoco_inicio) $$);
select pg_temp.verificar('R19', 'Dia fechado (segunda) não tem horários',
  $$ (select count(*) from public.horarios_disponiveis(pg_temp.dia(1), array['11111111-0000-4000-8000-000000000001']::uuid[], null)) = 0 $$);

-- =============================================================================
-- RD05 — preço congelado
-- =============================================================================
select pg_temp.como(null);
update public.servicos set preco = 75.00 where id = '11111111-0000-4000-8000-000000000001';

select pg_temp.verificar('R20', 'Agendamento antigo mantém R$ 60,00 após reajuste',
  $$ (select a.valor_total = 60.00 and i.preco_cobrado = 60.00
      from public.agendamentos a join public.agendamento_servicos i on i.agendamento_id = a.id
      where a.barbeiro_id = '22222222-0000-4000-8000-000000000001' and a.inicio = pg_temp.em(pg_temp.dia(3), '17:00')) $$);

select pg_temp.como('33333333-0000-4000-8000-000000000005');
select pg_temp.tentar('R21', 'Novo agendamento após reajuste — aceito',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '10:00'), array['11111111-0000-4000-8000-000000000001']::uuid[], '22222222-0000-4000-8000-000000000003'), true);
select pg_temp.como(null);
select pg_temp.verificar('R22', 'Novo agendamento cobra o preço novo (R$ 75,00)',
  $$ (select valor_total = 75.00 from public.agendamentos
      where barbeiro_id = '22222222-0000-4000-8000-000000000003' and inicio = pg_temp.em(pg_temp.dia(3), '10:00')) $$);

select pg_temp.tentar('R23', 'Alterar valor_total de agendamento existente — recusado',
  $$ update public.agendamentos set valor_total = 1 where barbeiro_id = '22222222-0000-4000-8000-000000000003' and inicio > now() $$, false);

-- =============================================================================
-- RF09 — cancelamento lógico
-- =============================================================================
select pg_temp.tentar('R24', 'DELETE em agendamentos (mesmo como admin) — recusado',
  $$ delete from public.agendamentos where inicio > now() $$, false);

create temp table alvo as
  select id from public.agendamentos
  where barbeiro_id = '22222222-0000-4000-8000-000000000001' and inicio = pg_temp.em(pg_temp.dia(3), '17:00');
grant all on alvo to authenticated;

select pg_temp.como('33333333-0000-4000-8000-000000000006');
select pg_temp.tentar('R25', 'Cliente2 cancelar agendamento do cliente1 — recusado',
  $$ select public.cancelar_agendamento((select id from alvo), 'teste') $$, false);

select pg_temp.como('33333333-0000-4000-8000-000000000002');
select pg_temp.tentar('R26', 'Barbeiro cancelar agendamento — recusado (só cliente/gerente)',
  $$ select public.cancelar_agendamento((select id from alvo), 'teste') $$, false);

select pg_temp.como('33333333-0000-4000-8000-000000000005');
select pg_temp.tentar('R27', 'Cliente1 cancelar o próprio — aceito',
  $$ select public.cancelar_agendamento((select id from alvo), 'Teste automatizado') $$, true);
select pg_temp.verificar('R28', 'Cancelado continua no histórico com status e data',
  $$ (select status = 'cancelado' and cancelado_em is not null from public.agendamentos where id = (select id from alvo)) $$);
select pg_temp.tentar('R29', 'Horário cancelado fica livre de novo — aceito',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '17:00'), array['11111111-0000-4000-8000-000000000002']::uuid[], '22222222-0000-4000-8000-000000000001'), true);

-- =============================================================================
-- RNF03 — RLS e permissões
-- =============================================================================
select pg_temp.tentar('R30', 'Cliente fazer INSERT direto em agendamentos — recusado',
  $$ insert into public.agendamentos (cliente_id, barbeiro_id, inicio, fim, valor_total)
     values (auth.uid(), '22222222-0000-4000-8000-000000000001', now() + interval '30 days', now() + interval '30 days 1 hour', 0) $$, false);
select pg_temp.verificar('R31', 'Cliente1 só enxerga os próprios agendamentos',
  $$ (select count(*) from public.agendamentos where cliente_id <> auth.uid()) = 0
     and (select count(*) from public.agendamentos) > 0 $$);
select pg_temp.tentar('R32', 'Cliente promover a si mesmo a gerente — recusado',
  $$ update public.perfis set papel = 'gerente' where id = auth.uid() $$, false);
select pg_temp.tentar('R33', 'Cliente alterar preço de serviço — sem efeito/recusado',
  $$ do $x$ begin
       update public.servicos set preco = 1 where id = '11111111-0000-4000-8000-000000000002';
       if found then raise exception 'cliente conseguiu alterar preço'; end if;
       raise exception 'nenhuma linha alterada';
     end $x$ $$, false);

-- Barbeiro Sênior
select pg_temp.como('33333333-0000-4000-8000-000000000002');
select pg_temp.verificar('R34', 'Barbeiro Sênior NÃO lê a agenda de outro barbeiro',
  $$ (select count(*) from public.agendamentos where barbeiro_id <> '22222222-0000-4000-8000-000000000001') = 0 $$);
select pg_temp.verificar('R35', 'Barbeiro Sênior lê a própria agenda',
  $$ (select count(*) from public.agendamentos where barbeiro_id = '22222222-0000-4000-8000-000000000001') > 0 $$);
select pg_temp.verificar('R36', 'Barbeiro não lê bloqueios de outro barbeiro',
  $$ (select count(*) from public.bloqueios where barbeiro_id <> '22222222-0000-4000-8000-000000000001') = 0 $$);
select pg_temp.tentar('R37', 'Barbeiro trocar barbeiro de agendamento — recusado',
  $$ select public.trocar_barbeiro((select id from public.agendamentos limit 1), '22222222-0000-4000-8000-000000000002') $$, false);

-- Gerente
select pg_temp.como('33333333-0000-4000-8000-000000000001');
select pg_temp.verificar('R38', 'Gerente lê agendamentos de todos os barbeiros',
  $$ (select count(distinct barbeiro_id) from public.agendamentos) = 3 $$);
select pg_temp.tentar('R39', 'Gerente criar bloqueio sobre agendamento confirmado — recusado',
  format($f$ insert into public.bloqueios (barbeiro_id, inicio, fim, motivo)
             values ('22222222-0000-4000-8000-000000000001', %L, %L, 'teste') $f$,
         pg_temp.em(pg_temp.dia(3), '16:45'), pg_temp.em(pg_temp.dia(3), '17:30')), false);
select pg_temp.tentar('R40', 'Gerente trocar barbeiro para horário livre — aceito',
  format($f$ select public.trocar_barbeiro(
               (select id from public.agendamentos where barbeiro_id = '22222222-0000-4000-8000-000000000003' and inicio = %L),
               '22222222-0000-4000-8000-000000000001') $f$, pg_temp.em(pg_temp.dia(3), '10:00')), true);
select pg_temp.tentar('R41', 'Gerente trocar para barbeiro ocupado — recusado',
  format($f$ select public.trocar_barbeiro(
               (select id from public.agendamentos where barbeiro_id = '22222222-0000-4000-8000-000000000003' and inicio = %L),
               '22222222-0000-4000-8000-000000000001') $f$, pg_temp.em(pg_temp.dia(3), '17:00')), false);

-- Exclusion constraint sozinha (sem a pré-checagem da função): mesmo um
-- INSERT direto do administrador sobrepondo o mesmo barbeiro é barrado com
-- SQLSTATE 23P01. É isso que garante o resultado quando duas transações
-- simultâneas passam juntas pela pré-checagem.
select pg_temp.como(null);
select pg_temp.tentar('R44', 'INSERT direto sobreposto no mesmo barbeiro (admin) — recusado pela constraint',
  format($f$ insert into public.agendamentos (cliente_id, barbeiro_id, inicio, fim, valor_total)
             values ('33333333-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000001', %L, %L, 0) $f$,
         pg_temp.em(pg_temp.dia(3), '17:15'), pg_temp.em(pg_temp.dia(3), '17:45')), false);
select pg_temp.tentar('R45', 'INSERT direto no mesmo horário com OUTRO barbeiro — aceito (RD02)',
  format($f$ insert into public.agendamentos (cliente_id, barbeiro_id, inicio, fim, valor_total)
             values ('33333333-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000002', %L, %L, 0) $f$,
         pg_temp.em(pg_temp.dia(3), '17:15'), pg_temp.em(pg_temp.dia(3), '17:45')), true);

-- Visitante sem login (anon)
select pg_temp.como(null);
set local role anon;
select pg_temp.tentar('R42', 'Visitante sem login lendo agendamentos — recusado',
  $$ select count(*) from public.agendamentos $$, false);
select pg_temp.tentar('R43', 'Visitante sem login chamando criar_agendamento — recusado',
  pg_temp.agendar(pg_temp.em(pg_temp.dia(3), '19:00'), array['11111111-0000-4000-8000-000000000004']::uuid[], null), false);
reset role;

-- -----------------------------------------------------------------------------
-- Relatório
-- -----------------------------------------------------------------------------
select caso, passou, descricao, detalhe from resultados order by ordem;

rollback;
