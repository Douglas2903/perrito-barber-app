-- =============================================================================
-- Perrito Barber App 3.0 — Migração 03: funções RPC (regras de negócio)
-- -----------------------------------------------------------------------------
-- O front-end nunca grava agendamentos direto nas tabelas: chama estas
-- funções. Cada uma valida quem está chamando (papel) e as regras no servidor.
-- SECURITY DEFINER + search_path vazio: precisam enxergar a agenda inteira
-- (ex.: horários ocupados por outros clientes) sem expor esses dados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auxiliares privadas
-- -----------------------------------------------------------------------------

-- Antecedência máxima para agendar (decisão do projeto: 60 dias).
create or replace function private.dias_antecedencia_maxima()
returns integer
language sql
immutable
set search_path = ''
as $$ select 60; $$;

-- Exige login e um dos papéis informados. Retorna o papel de quem chamou.
create or replace function private.exigir_papel(p_papeis public.papel_usuario[])
returns public.papel_usuario
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_papel public.papel_usuario;
begin
  if (select auth.uid()) is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;

  v_papel := private.papel_atual();

  if v_papel is null or not (v_papel = any (p_papeis)) then
    raise exception 'Você não tem permissão para esta ação.' using errcode = '42501';
  end if;

  return v_papel;
end;
$$;

-- Soma duração e valor dos serviços escolhidos, validando a lista.
-- Trava as linhas dos serviços (FOR SHARE) até o fim da transação para que
-- uma mudança de preço simultânea não gere valor_total diferente dos itens.
create or replace function private.resumo_servicos(p_servicos uuid[])
returns table (duracao_total integer, valor_total numeric)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_quantidade integer := coalesce(cardinality(p_servicos), 0);
  v_validos    integer;
begin
  if v_quantidade = 0 then
    raise exception 'Escolha pelo menos um serviço.' using errcode = 'P0001';
  end if;

  if v_quantidade <> (select count(distinct s) from unnest(p_servicos) s) then
    raise exception 'Há serviços repetidos na lista.' using errcode = 'P0001';
  end if;

  perform 1 from public.servicos s where s.id = any (p_servicos) for share;

  select count(*), sum(s.duracao_min), sum(s.preco)
    into v_validos, duracao_total, valor_total
  from public.servicos s
  where s.id = any (p_servicos) and s.ativo;

  if v_validos <> v_quantidade then
    raise exception 'Um ou mais serviços escolhidos não estão disponíveis.' using errcode = 'P0001';
  end if;

  return next;
end;
$$;

-- Barbeiros ativos com a quantidade de atendimentos ativos no dia.
-- Usado para distribuir "qualquer profissional" para quem está menos ocupado.
create or replace function private.barbeiros_por_carga(p_data date)
returns table (barbeiro_id uuid, nome text, carga integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.nome,
    (
      select count(*)::integer
      from public.agendamentos a
      where a.barbeiro_id = b.id
        and a.status <> 'cancelado'
        and a.inicio >= (p_data::timestamp       at time zone private.fuso_horario())
        and a.inicio <  ((p_data + 1)::timestamp at time zone private.fuso_horario())
    )
  from public.barbeiros b
  where b.ativo;
$$;

-- =============================================================================
-- RPCs públicas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- horarios_disponiveis (RF05, RF06)
-- Horários de início livres, de 15 em 15 min, para a duração somada dos
-- serviços. Com p_barbeiro_id nulo ("qualquer profissional") devolve uma linha
-- por horário, indicando o barbeiro menos ocupado que está livre.
-- -----------------------------------------------------------------------------
create or replace function public.horarios_disponiveis(
  p_data        date,
  p_servicos    uuid[],
  p_barbeiro_id uuid default null
)
returns table (inicio timestamptz, barbeiro_id uuid, barbeiro_nome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_fuso    constant text := private.fuso_horario();
  v_hoje    date := (now() at time zone v_fuso)::date;
  v_duracao interval;
begin
  perform private.exigir_papel(array['cliente', 'gerente']::public.papel_usuario[]);

  select make_interval(mins => r.duracao_total) into v_duracao
  from private.resumo_servicos(p_servicos) r;

  if p_data is null or p_data < v_hoje or p_data > v_hoje + private.dias_antecedencia_maxima() then
    return;
  end if;

  return query
  with candidatos as (
    select c.barbeiro_id, c.nome, c.carga, e.hora_inicio, e.hora_fim
    from private.barbeiros_por_carga(p_data) c
    join public.escalas e
      on e.barbeiro_id = c.barbeiro_id
     and e.dia_semana = extract(dow from p_data)
    where p_barbeiro_id is null or c.barbeiro_id = p_barbeiro_id
  ),
  janelas as (
    select c.barbeiro_id, c.nome, c.carga, (t.horario at time zone v_fuso) as horario_inicio
    from candidatos c
    cross join lateral generate_series(
      p_data + c.hora_inicio,
      p_data + c.hora_fim - v_duracao,
      interval '15 minutes'
    ) as t (horario)
  ),
  livres as (
    select j.*
    from janelas j
    where j.horario_inicio > now()
      and private.validar_janela(j.barbeiro_id, j.horario_inicio, j.horario_inicio + v_duracao) is null
  )
  select distinct on (l.horario_inicio) l.horario_inicio, l.barbeiro_id, l.nome
  from livres l
  order by l.horario_inicio, l.carga, l.nome;
end;
$$;

-- -----------------------------------------------------------------------------
-- criar_agendamento (RF04, RD01, RD03, RD05)
-- Valida tudo, calcula duração/valor, escolhe o barbeiro quando for
-- "qualquer profissional" e grava agendamento + itens na mesma transação.
-- A exclusion constraint é a última barreira contra cliques simultâneos.
-- -----------------------------------------------------------------------------
create or replace function public.criar_agendamento(
  p_inicio      timestamptz,
  p_servicos    uuid[],
  p_barbeiro_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_msg_ocupado constant text := 'Esse horário acabou de ser ocupado. Escolha outro.';
  v_fuso        constant text := private.fuso_horario();
  v_cliente_id  uuid := (select auth.uid());
  v_hoje        date := (now() at time zone v_fuso)::date;
  v_data        date;
  v_resumo      record;
  v_fim         timestamptz;
  v_candidato   record;
  v_erro        text;
  v_motivo      text;
  v_houve_corrida boolean := false;
  v_id          uuid;
begin
  perform private.exigir_papel(array['cliente']::public.papel_usuario[]);

  if p_inicio is null then
    raise exception 'Informe o horário do agendamento.' using errcode = 'P0001';
  end if;

  select * into v_resumo from private.resumo_servicos(p_servicos);

  v_data := (p_inicio at time zone v_fuso)::date;
  v_fim  := p_inicio + make_interval(mins => v_resumo.duracao_total);

  if p_inicio <= now() then
    raise exception 'Não é possível agendar em um horário que já passou.' using errcode = 'P0001';
  end if;

  if v_data > v_hoje + private.dias_antecedencia_maxima() then
    raise exception 'Agendamentos podem ser feitos com até % dias de antecedência.',
      private.dias_antecedencia_maxima() using errcode = 'P0001';
  end if;

  if extract(minute from p_inicio)::int % 15 <> 0 or extract(second from p_inicio) <> 0 then
    raise exception 'Horário inválido: os horários são de 15 em 15 minutos.' using errcode = 'P0001';
  end if;

  -- Barbeiro escolhido: um único candidato. "Qualquer profissional": todos,
  -- do menos ao mais ocupado no dia; o primeiro livre fica com o atendimento.
  for v_candidato in
    select c.barbeiro_id
    from private.barbeiros_por_carga(v_data) c
    where p_barbeiro_id is null or c.barbeiro_id = p_barbeiro_id
    order by c.carga, c.nome
  loop
    v_erro := private.validar_janela(v_candidato.barbeiro_id, p_inicio, v_fim);

    if v_erro is null then
      begin
        insert into public.agendamentos (cliente_id, barbeiro_id, inicio, fim, valor_total)
        values (v_cliente_id, v_candidato.barbeiro_id, p_inicio, v_fim, v_resumo.valor_total)
        returning id into v_id;

        -- Preço e duração congelados (RD05).
        insert into public.agendamento_servicos (agendamento_id, servico_id, preco_cobrado, duracao_min)
        select v_id, s.id, s.preco, s.duracao_min
        from public.servicos s
        where s.id = any (p_servicos);

        return v_id;
      exception
        when exclusion_violation then
          -- Outro cliente gravou o mesmo horário neste instante (SQLSTATE 23P01).
          v_houve_corrida := true;
          v_erro := c_msg_ocupado;
      end;
    end if;

    v_motivo := coalesce(v_motivo, v_erro);
  end loop;

  if v_houve_corrida then
    raise exception '%', c_msg_ocupado using errcode = '23P01';
  end if;

  if p_barbeiro_id is not null then
    raise exception '%', coalesce(v_motivo, 'Barbeiro inativo ou inexistente.') using errcode = 'P0001';
  end if;

  raise exception 'Nenhum profissional disponível nesse horário. Escolha outro.' using errcode = 'P0001';
end;
$$;

-- -----------------------------------------------------------------------------
-- cancelar_agendamento (RF09) — cancelamento lógico.
-- Cliente: só os próprios e antes do início. Gerente: qualquer um.
-- -----------------------------------------------------------------------------
create or replace function public.cancelar_agendamento(p_id uuid, p_motivo text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_usuario_id  uuid := (select auth.uid());
  v_papel       public.papel_usuario;
  v_agendamento public.agendamentos;
begin
  v_papel := private.exigir_papel(array['cliente', 'gerente']::public.papel_usuario[]);

  select * into v_agendamento from public.agendamentos a where a.id = p_id for update;

  if not found or (v_papel = 'cliente' and v_agendamento.cliente_id <> v_usuario_id) then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;

  if v_agendamento.status <> 'confirmado' then
    raise exception 'Só é possível cancelar agendamentos confirmados.' using errcode = 'P0001';
  end if;

  if v_papel = 'cliente' and v_agendamento.inicio <= now() then
    raise exception 'Este horário já começou ou passou e não pode mais ser cancelado.' using errcode = 'P0001';
  end if;

  update public.agendamentos a
     set status              = 'cancelado',
         cancelado_em        = now(),
         cancelado_por       = v_usuario_id,
         motivo_cancelamento = left(nullif(btrim(p_motivo), ''), 300)
   where a.id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- concluir_agendamento — marca o atendimento como realizado (RF08, RF10).
-- Barbeiro: só os dele. Gerente: qualquer um. Só depois do horário de início.
-- -----------------------------------------------------------------------------
create or replace function public.concluir_agendamento(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_papel       public.papel_usuario;
  v_agendamento public.agendamentos;
begin
  v_papel := private.exigir_papel(array['barbeiro', 'gerente']::public.papel_usuario[]);

  select * into v_agendamento from public.agendamentos a where a.id = p_id for update;

  if not found or (v_papel = 'barbeiro' and v_agendamento.barbeiro_id is distinct from private.barbeiro_atual_id()) then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;

  if v_agendamento.status <> 'confirmado' then
    raise exception 'Só é possível concluir agendamentos confirmados.' using errcode = 'P0001';
  end if;

  if v_agendamento.inicio > now() then
    raise exception 'O atendimento só pode ser concluído a partir do horário de início.' using errcode = 'P0001';
  end if;

  update public.agendamentos a set status = 'concluido' where a.id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- trocar_barbeiro (RF09) — só o gerente; valida escala e conflito do novo.
-- -----------------------------------------------------------------------------
create or replace function public.trocar_barbeiro(p_id uuid, p_novo_barbeiro uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_agendamento public.agendamentos;
  v_erro        text;
begin
  perform private.exigir_papel(array['gerente']::public.papel_usuario[]);

  select * into v_agendamento from public.agendamentos a where a.id = p_id for update;

  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;

  if v_agendamento.status <> 'confirmado' then
    raise exception 'Só é possível trocar o barbeiro de agendamentos confirmados.' using errcode = 'P0001';
  end if;

  if v_agendamento.inicio <= now() then
    raise exception 'Não é possível trocar o barbeiro de um atendimento que já começou.' using errcode = 'P0001';
  end if;

  if v_agendamento.barbeiro_id = p_novo_barbeiro then
    raise exception 'O agendamento já é deste barbeiro.' using errcode = 'P0001';
  end if;

  v_erro := private.validar_janela(p_novo_barbeiro, v_agendamento.inicio, v_agendamento.fim, p_id);
  if v_erro is not null then
    raise exception '%', v_erro using errcode = 'P0001';
  end if;

  begin
    update public.agendamentos a set barbeiro_id = p_novo_barbeiro where a.id = p_id;
  exception
    when exclusion_violation then
      raise exception 'Esse horário acabou de ser ocupado na agenda do novo barbeiro. Escolha outro.'
        using errcode = '23P01';
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- excluir_minha_conta (RD04 — LGPD)
-- Cancela os agendamentos futuros, anonimiza o perfil (o histórico continua,
-- sem dados pessoais) e apaga o usuário do Auth, removendo o acesso.
-- -----------------------------------------------------------------------------
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := (select auth.uid());
begin
  perform private.exigir_papel(array['cliente']::public.papel_usuario[]);

  update public.agendamentos a
     set status              = 'cancelado',
         cancelado_em        = now(),
         cancelado_por       = v_usuario_id,
         motivo_cancelamento = 'Conta excluída pelo cliente (LGPD).'
   where a.cliente_id = v_usuario_id
     and a.status = 'confirmado'
     and a.inicio > now();

  update public.perfis p
     set nome           = 'Cliente removido',
         telefone       = null,
         email          = null,
         anonimizado_em = now()
   where p.id = v_usuario_id;

  delete from auth.users u where u.id = v_usuario_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- promover_barbeiro (RF02) — liga um usuário cadastrado a um barbeiro.
-- Evita usar a chave service_role para criar contas de barbeiro.
-- -----------------------------------------------------------------------------
create or replace function public.promover_barbeiro(p_email text, p_barbeiro_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_perfil   public.perfis;
  v_barbeiro public.barbeiros;
begin
  perform private.exigir_papel(array['gerente']::public.papel_usuario[]);

  select * into v_perfil from public.perfis p where lower(p.email) = lower(btrim(p_email)) for update;
  if not found then
    raise exception 'Nenhum usuário cadastrado com este e-mail. Peça para a pessoa criar a conta primeiro.'
      using errcode = 'P0002';
  end if;

  if v_perfil.papel <> 'cliente' then
    raise exception 'Este usuário já é barbeiro ou gerente.' using errcode = 'P0001';
  end if;

  select * into v_barbeiro from public.barbeiros b where b.id = p_barbeiro_id for update;
  if not found then
    raise exception 'Barbeiro não encontrado.' using errcode = 'P0002';
  end if;

  if v_barbeiro.perfil_id is not null then
    raise exception 'Este barbeiro já está vinculado a outro usuário.' using errcode = 'P0001';
  end if;

  update public.perfis p set papel = 'barbeiro' where p.id = v_perfil.id;
  update public.barbeiros b set perfil_id = v_perfil.id where b.id = p_barbeiro_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- desvincular_barbeiro (RF02) — desfaz a promoção: o usuário volta a cliente.
-- -----------------------------------------------------------------------------
create or replace function public.desvincular_barbeiro(p_barbeiro_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_perfil_id uuid;
begin
  perform private.exigir_papel(array['gerente']::public.papel_usuario[]);

  select b.perfil_id into v_perfil_id from public.barbeiros b where b.id = p_barbeiro_id for update;
  if v_perfil_id is null then
    raise exception 'Este barbeiro não está vinculado a nenhum usuário.' using errcode = 'P0001';
  end if;

  update public.barbeiros b set perfil_id = null where b.id = p_barbeiro_id;
  update public.perfis p set papel = 'cliente' where p.id = v_perfil_id and p.papel = 'barbeiro';
end;
$$;
