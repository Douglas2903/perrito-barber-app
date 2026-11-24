-- =============================================================================
-- Perrito Barber App 3.0 — Migração 02: funções auxiliares e triggers
-- -----------------------------------------------------------------------------
-- Tudo aqui fica no schema "private" (não exposto pela API) ou é trigger.
-- As funções são SECURITY DEFINER com search_path vazio: leem as tabelas sem
-- depender da RLS de quem chamou e não podem ser enganadas por objetos
-- criados em outro schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Identidade de quem está chamando (usadas pelas políticas RLS e pelas RPCs)
-- -----------------------------------------------------------------------------
create or replace function private.papel_atual()
returns public.papel_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.papel from public.perfis p where p.id = (select auth.uid());
$$;

create or replace function private.eh_gerente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.papel_atual()) = 'gerente', false);
$$;

-- id do registro de barbeiro ligado ao usuário logado (null se não for barbeiro).
create or replace function private.barbeiro_atual_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.barbeiros b
  join public.perfis p on p.id = b.perfil_id
  where b.perfil_id = (select auth.uid())
    and p.papel = 'barbeiro';
$$;

-- -----------------------------------------------------------------------------
-- Fuso horário oficial do sistema
-- -----------------------------------------------------------------------------
create or replace function private.fuso_horario()
returns text
language sql
immutable
set search_path = ''
as $$ select 'America/Sao_Paulo'::text; $$;

-- -----------------------------------------------------------------------------
-- validar_janela: diz se um barbeiro pode atender no intervalo [inicio, fim).
-- Retorna NULL quando está tudo certo, ou a mensagem de erro em português.
-- É a única implementação da regra RD03 e é reaproveitada por:
--   horarios_disponiveis, criar_agendamento, trocar_barbeiro e pelos triggers
--   que impedem alterar escala/bloqueio/barbeiro deixando agendamentos órfãos.
-- p_ignorar_id: agendamento a desconsiderar na checagem de conflito (o próprio).
-- -----------------------------------------------------------------------------
create or replace function private.validar_janela(
  p_barbeiro_id uuid,
  p_inicio      timestamptz,
  p_fim         timestamptz,
  p_ignorar_id  uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fuso       constant text := private.fuso_horario();
  v_ini_local  timestamp := p_inicio at time zone v_fuso;
  v_fim_local  timestamp := p_fim    at time zone v_fuso;
  v_dia        date      := v_ini_local::date;
  v_escala     public.escalas;
begin
  if not exists (select 1 from public.barbeiros b where b.id = p_barbeiro_id and b.ativo) then
    return 'Barbeiro inativo ou inexistente.';
  end if;

  if extract(dow from v_dia) not between 2 and 6 then
    return 'A barbearia não abre aos domingos e segundas-feiras.';
  end if;

  select * into v_escala
  from public.escalas e
  where e.barbeiro_id = p_barbeiro_id
    and e.dia_semana = extract(dow from v_dia);

  if not found then
    return 'O barbeiro não atende neste dia da semana.';
  end if;

  if v_ini_local < v_dia + v_escala.hora_inicio or v_fim_local > v_dia + v_escala.hora_fim then
    return format('Horário fora do expediente do barbeiro (das %s às %s).',
                  to_char(v_escala.hora_inicio, 'HH24:MI'), to_char(v_escala.hora_fim, 'HH24:MI'));
  end if;

  if v_escala.almoco_inicio is not null
     and v_ini_local < v_dia + v_escala.almoco_fim
     and v_fim_local > v_dia + v_escala.almoco_inicio then
    return 'Horário coincide com o intervalo de almoço do barbeiro.';
  end if;

  if exists (
    select 1 from public.bloqueios bl
    where bl.barbeiro_id = p_barbeiro_id
      and bl.inicio < p_fim
      and bl.fim > p_inicio
  ) then
    return 'O barbeiro está indisponível neste horário (folga ou compromisso).';
  end if;

  if exists (
    select 1 from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.status <> 'cancelado'
      and a.id is distinct from p_ignorar_id
      and a.inicio < p_fim
      and a.fim > p_inicio
  ) then
    return 'Esse horário já está ocupado.';
  end if;

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Garante que os agendamentos futuros confirmados de um barbeiro continuam
-- válidos depois de uma mudança de escala, bloqueio ou desativação.
-- Assim o gerente não deixa, sem perceber, cliente marcado em horário em que
-- o barbeiro não estará.
-- -----------------------------------------------------------------------------
create or replace function private.exigir_agendamentos_futuros_validos(p_barbeiro_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_agendamento record;
  v_erro        text;
begin
  for v_agendamento in
    select a.id, a.inicio, a.fim
    from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.status = 'confirmado'
      and a.inicio > now()
    order by a.inicio
  loop
    v_erro := private.validar_janela(p_barbeiro_id, v_agendamento.inicio, v_agendamento.fim, v_agendamento.id);
    if v_erro is not null then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Alteração recusada: o agendamento de %s ficaria inválido. Motivo: %s Cancele ou troque o barbeiro desse agendamento antes.',
          to_char(v_agendamento.inicio at time zone private.fuso_horario(), 'DD/MM/YYYY "às" HH24:MI'),
          v_erro);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Trigger: novo usuário no Auth => cria o perfil como "cliente".
-- Os dados vêm do raw_user_meta_data enviado no cadastro (nome e telefone).
-- -----------------------------------------------------------------------------
create or replace function private.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, telefone, email, papel)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone', ''), '\D', '', 'g'), ''),
    lower(new.email),
    'cliente'
  );
  return new;
end;
$$;

create trigger ao_criar_usuario_criar_perfil
  after insert on auth.users
  for each row execute function private.criar_perfil_novo_usuario();

-- -----------------------------------------------------------------------------
-- Trigger: agendamentos nunca são apagados (RF09 — cancelamento lógico) e os
-- valores congelados nunca mudam (RD05). Um cancelado também não "revive".
-- -----------------------------------------------------------------------------
create or replace function private.proteger_agendamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Agendamentos não podem ser apagados. Use o cancelamento.'
      using errcode = 'P0001';
  end if;

  if new.cliente_id  <> old.cliente_id
     or new.inicio      <> old.inicio
     or new.fim         <> old.fim
     or new.valor_total <> old.valor_total
     or new.criado_em   <> old.criado_em then
    raise exception 'Cliente, horário e valor de um agendamento não podem ser alterados.'
      using errcode = 'P0001';
  end if;

  if old.status <> 'confirmado' and new.status <> old.status then
    raise exception 'Agendamento % não pode mudar de status.', old.status
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger agendamentos_protecao
  before update or delete on public.agendamentos
  for each row execute function private.proteger_agendamento();

create or replace function private.proteger_item_agendamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Os serviços de um agendamento são definitivos (preço congelado).'
    using errcode = 'P0001';
end;
$$;

create trigger agendamento_servicos_protecao
  before update or delete on public.agendamento_servicos
  for each row execute function private.proteger_item_agendamento();

-- -----------------------------------------------------------------------------
-- Triggers que preservam a validade dos agendamentos futuros.
-- -----------------------------------------------------------------------------
create or replace function private.validar_apos_mudar_escala()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.exigir_agendamentos_futuros_validos(old.barbeiro_id);
  end if;
  if tg_op = 'UPDATE' and new.barbeiro_id <> old.barbeiro_id then
    perform private.exigir_agendamentos_futuros_validos(new.barbeiro_id);
  end if;
  return null;
end;
$$;

create trigger escalas_preservar_agendamentos
  after update or delete on public.escalas
  for each row execute function private.validar_apos_mudar_escala();

create or replace function private.validar_apos_mudar_bloqueio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.exigir_agendamentos_futuros_validos(new.barbeiro_id);
  return null;
end;
$$;

create trigger bloqueios_preservar_agendamentos
  after insert or update on public.bloqueios
  for each row execute function private.validar_apos_mudar_bloqueio();

create or replace function private.validar_apos_desativar_barbeiro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.exigir_agendamentos_futuros_validos(new.id);
  return null;
end;
$$;

create trigger barbeiros_preservar_agendamentos
  after update of ativo on public.barbeiros
  for each row
  when (old.ativo and not new.ativo)
  execute function private.validar_apos_desativar_barbeiro();
