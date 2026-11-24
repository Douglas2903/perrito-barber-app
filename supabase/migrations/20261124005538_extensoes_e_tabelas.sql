-- =============================================================================
-- Perrito Barber App 3.0 — Migração 01: extensões, tipos e tabelas
-- -----------------------------------------------------------------------------
-- Cria a estrutura de dados do sistema. As regras de integridade que dependem
-- só da própria linha (CHECK) e a regra de "sem conflito de horário por
-- barbeiro" (EXCLUDE) ficam aqui, junto da tabela que protegem.
-- =============================================================================

-- btree_gist permite usar "=" em uuid dentro de um índice GiST, necessário
-- para a exclusion constraint (barbeiro_id WITH =, intervalo WITH &&).
-- Fica no schema "extensions" (boa prática do Supabase: nada de extensão em public).
create extension if not exists btree_gist with schema extensions;

-- Schema para funções auxiliares internas. Não é exposto pela API REST.
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.papel_usuario      as enum ('cliente', 'barbeiro', 'gerente');
create type public.nivel_barbeiro     as enum ('senior', 'pleno', 'junior');
create type public.status_agendamento as enum ('confirmado', 'concluido', 'cancelado');

-- -----------------------------------------------------------------------------
-- perfis: dados de cada usuário do Auth.
-- Não há FK para auth.users de propósito: quando o cliente exclui a conta
-- (LGPD), o usuário do Auth é apagado, mas o perfil anonimizado permanece
-- para manter o histórico de agendamentos íntegro. A criação do perfil é
-- garantida pelo trigger em auth.users (migração 02).
-- -----------------------------------------------------------------------------
create table public.perfis (
  id              uuid primary key,
  nome            text not null,
  telefone        text,
  email           text,
  papel           public.papel_usuario not null default 'cliente',
  criado_em       timestamptz not null default now(),
  anonimizado_em  timestamptz,

  constraint perfis_nome_valido     check (char_length(btrim(nome)) between 2 and 100),
  -- Telefone guardado só com dígitos: DDD + número (10 ou 11 dígitos).
  constraint perfis_telefone_valido check (telefone is null or telefone ~ '^[0-9]{10,11}$')
);

comment on table public.perfis is 'Perfil de cada usuário (cliente, barbeiro ou gerente). id = auth.users.id.';

create unique index perfis_email_unico on public.perfis (lower(email)) where email is not null;

-- -----------------------------------------------------------------------------
-- barbeiros: profissionais da casa. perfil_id liga o barbeiro a um login.
-- -----------------------------------------------------------------------------
create table public.barbeiros (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid unique references public.perfis (id) on delete set null,
  nome       text not null,
  nivel      public.nivel_barbeiro not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),

  constraint barbeiros_nome_valido check (char_length(btrim(nome)) between 2 and 100)
);

-- -----------------------------------------------------------------------------
-- servicos: catálogo com preço e duração atuais.
-- -----------------------------------------------------------------------------
create table public.servicos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null unique,
  preco        numeric(10, 2) not null,
  duracao_min  integer not null,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),

  constraint servicos_nome_valido    check (char_length(btrim(nome)) between 2 and 100),
  constraint servicos_preco_valido   check (preco >= 0),
  -- A grade de horários é de 15 em 15 minutos.
  constraint servicos_duracao_valida check (duracao_min between 15 and 480 and duracao_min % 15 = 0)
);

-- -----------------------------------------------------------------------------
-- escalas: expediente semanal de cada barbeiro (uma linha por barbeiro e dia).
-- dia_semana segue o padrão do PostgreSQL: 0 = domingo ... 6 = sábado.
-- A própria tabela garante o horário de funcionamento da barbearia:
--   terça a sexta (2 a 5), das 10h às 20h; sábado (6), das 8h às 19h.
-- -----------------------------------------------------------------------------
create table public.escalas (
  barbeiro_id    uuid not null references public.barbeiros (id) on delete cascade,
  dia_semana     smallint not null,
  hora_inicio    time not null,
  hora_fim       time not null,
  almoco_inicio  time,
  almoco_fim     time,

  primary key (barbeiro_id, dia_semana),

  constraint escalas_dia_de_funcionamento check (dia_semana between 2 and 6),
  constraint escalas_dentro_do_funcionamento check (
    (dia_semana between 2 and 5 and hora_inicio >= time '10:00' and hora_fim <= time '20:00')
    or (dia_semana = 6          and hora_inicio >= time '08:00' and hora_fim <= time '19:00')
  ),
  constraint escalas_intervalo_valido check (hora_inicio < hora_fim),
  constraint escalas_almoco_completo  check ((almoco_inicio is null) = (almoco_fim is null)),
  constraint escalas_almoco_valido    check (
    almoco_inicio is null
    or (almoco_inicio < almoco_fim and almoco_inicio >= hora_inicio and almoco_fim <= hora_fim)
  ),
  -- Mantém todos os horários alinhados à grade de 15 minutos.
  constraint escalas_grade_15_min check (
    extract(minute from hora_inicio)::int % 15 = 0
    and extract(minute from hora_fim)::int % 15 = 0
    and (almoco_inicio is null or (extract(minute from almoco_inicio)::int % 15 = 0
                                   and extract(minute from almoco_fim)::int % 15 = 0))
  )
);

-- -----------------------------------------------------------------------------
-- bloqueios: folgas e compromissos pontuais de um barbeiro.
-- -----------------------------------------------------------------------------
create table public.bloqueios (
  id           uuid primary key default gen_random_uuid(),
  barbeiro_id  uuid not null references public.barbeiros (id) on delete cascade,
  inicio       timestamptz not null,
  fim          timestamptz not null,
  motivo       text not null,
  criado_em    timestamptz not null default now(),

  constraint bloqueios_intervalo_valido check (inicio < fim),
  constraint bloqueios_motivo_valido    check (char_length(btrim(motivo)) between 2 and 200)
);

create index bloqueios_barbeiro_periodo on public.bloqueios (barbeiro_id, inicio, fim);

-- -----------------------------------------------------------------------------
-- agendamentos
-- A exclusion constraint é a garantia real contra conflito (RD01/RNF05):
-- o mesmo barbeiro não pode ter dois intervalos [inicio, fim) sobrepostos
-- entre agendamentos não cancelados. Como a restrição é por barbeiro_id,
-- barbeiros diferentes podem atender no mesmo horário (RD02).
-- -----------------------------------------------------------------------------
create table public.agendamentos (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid not null references public.perfis (id),
  barbeiro_id          uuid not null references public.barbeiros (id),
  inicio               timestamptz not null,
  fim                  timestamptz not null,
  status               public.status_agendamento not null default 'confirmado',
  valor_total          numeric(10, 2) not null,
  criado_em            timestamptz not null default now(),
  cancelado_em         timestamptz,
  cancelado_por        uuid references public.perfis (id),
  motivo_cancelamento  text,

  constraint agendamentos_intervalo_valido check (inicio < fim),
  constraint agendamentos_valor_valido     check (valor_total >= 0),
  constraint agendamentos_cancelamento_consistente check (
    (status = 'cancelado') = (cancelado_em is not null)
  ),
  constraint agendamentos_sem_conflito_por_barbeiro exclude using gist (
    barbeiro_id with =,
    tstzrange(inicio, fim, '[)') with &&
  ) where (status <> 'cancelado')
);

create index agendamentos_cliente_inicio  on public.agendamentos (cliente_id, inicio);
create index agendamentos_barbeiro_inicio on public.agendamentos (barbeiro_id, inicio);
create index agendamentos_inicio          on public.agendamentos (inicio);
create index agendamentos_cancelado_por   on public.agendamentos (cancelado_por);

-- -----------------------------------------------------------------------------
-- agendamento_servicos: itens do agendamento com preço e duração congelados
-- no momento da criação (RD05).
-- -----------------------------------------------------------------------------
create table public.agendamento_servicos (
  agendamento_id  uuid not null references public.agendamentos (id),
  servico_id      uuid not null references public.servicos (id),
  preco_cobrado   numeric(10, 2) not null,
  duracao_min     integer not null,

  primary key (agendamento_id, servico_id),

  constraint agendamento_servicos_preco_valido   check (preco_cobrado >= 0),
  constraint agendamento_servicos_duracao_valida check (duracao_min > 0)
);

create index agendamento_servicos_servico on public.agendamento_servicos (servico_id);
