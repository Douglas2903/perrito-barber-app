-- =============================================================================
-- Perrito Barber App 3.0 — Seed (dados iniciais e de demonstração)
-- -----------------------------------------------------------------------------
-- Pode ser executado mais de uma vez: usa IDs fixos e ON CONFLICT DO NOTHING.
--
-- ATENÇÃO: cria CONTAS DE DEMONSTRAÇÃO (senha documentada no README) para a
-- homologação e os testes automáticos. Antes do uso real, remova essas contas
-- ou troque as senhas (ver README, seção "Antes de ir para produção").
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Serviços (preço e duração atuais)
-- -----------------------------------------------------------------------------
insert into public.servicos (id, nome, preco, duracao_min) values
  ('11111111-0000-4000-8000-000000000001', 'Corte de cabelo',                  60.00, 45),
  ('11111111-0000-4000-8000-000000000002', 'Barba tradicional / toalha quente', 60.00, 30),
  ('11111111-0000-4000-8000-000000000003', 'Combo cabelo + barba',             110.00, 60),
  ('11111111-0000-4000-8000-000000000004', 'Sobrancelha',                       20.00, 15),
  ('11111111-0000-4000-8000-000000000005', 'Penteado / química',                80.00, 45)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Barbeiros
-- -----------------------------------------------------------------------------
insert into public.barbeiros (id, nome, nivel) values
  ('22222222-0000-4000-8000-000000000001', 'Barbeiro Sênior', 'senior'),
  ('22222222-0000-4000-8000-000000000002', 'Barbeiro Pleno',  'pleno'),
  ('22222222-0000-4000-8000-000000000003', 'Barbeiro Júnior', 'junior')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Escalas — expediente completo, almoço de 1h escalonado (sempre há alguém
--    atendendo). Terça a sexta 10h–20h; sábado 8h–19h.
-- -----------------------------------------------------------------------------
insert into public.escalas (barbeiro_id, dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim)
select b.barbeiro_id, d.dia, d.inicio, d.fim,
       case when d.dia = 6 then b.almoco_sabado else b.almoco_semana end,
       case when d.dia = 6 then b.almoco_sabado else b.almoco_semana end + interval '1 hour'
from (values
  ('22222222-0000-4000-8000-000000000001'::uuid, time '12:00', time '11:00'),
  ('22222222-0000-4000-8000-000000000002'::uuid, time '13:00', time '12:00'),
  ('22222222-0000-4000-8000-000000000003'::uuid, time '14:00', time '13:00')
) as b (barbeiro_id, almoco_semana, almoco_sabado)
cross join (values
  (2::smallint, time '10:00', time '20:00'),
  (3::smallint, time '10:00', time '20:00'),
  (4::smallint, time '10:00', time '20:00'),
  (5::smallint, time '10:00', time '20:00'),
  (6::smallint, time '08:00', time '19:00')
) as d (dia, inicio, fim)
on conflict (barbeiro_id, dia_semana) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Contas de demonstração (Auth). SENHA INICIAL de todas: Perrito@2026
--    Troque as senhas logo depois de rodar o seed (README, passo 3).
--    O trigger ao_criar_usuario_criar_perfil cria o perfil como "cliente".
-- -----------------------------------------------------------------------------
do $$
declare
  v_conta record;
begin
  for v_conta in
    select * from (values
      ('33333333-0000-4000-8000-000000000001'::uuid, 'gerente.demo@example.com',  'Caique (gerente demo)', '11900000001'),
      ('33333333-0000-4000-8000-000000000002'::uuid, 'senior.demo@example.com',   'Barbeiro Sênior',       '11900000002'),
      ('33333333-0000-4000-8000-000000000003'::uuid, 'pleno.demo@example.com',    'Barbeiro Pleno',        '11900000003'),
      ('33333333-0000-4000-8000-000000000004'::uuid, 'junior.demo@example.com',   'Barbeiro Júnior',       '11900000004'),
      ('33333333-0000-4000-8000-000000000005'::uuid, 'cliente1.demo@example.com', 'João Cliente (demo)',   '11900000005'),
      ('33333333-0000-4000-8000-000000000006'::uuid, 'cliente2.demo@example.com', 'Pedro Cliente (demo)',  '11900000006')
    ) as c (id, email, nome, telefone)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_conta.id, 'authenticated', 'authenticated',
      v_conta.email, extensions.crypt('Perrito@2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', v_conta.nome, 'telefone', v_conta.telefone),
      now(), now(), '', '', '', '', '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      v_conta.id::text, v_conta.id,
      jsonb_build_object('sub', v_conta.id::text, 'email', v_conta.email, 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict (provider_id, provider) do nothing;
  end loop;
end;
$$;

-- Papéis das contas de demonstração
update public.perfis set papel = 'gerente'
 where id = '33333333-0000-4000-8000-000000000001';

update public.perfis set papel = 'barbeiro'
 where id in ('33333333-0000-4000-8000-000000000002',
              '33333333-0000-4000-8000-000000000003',
              '33333333-0000-4000-8000-000000000004');

update public.barbeiros b
   set perfil_id = v.perfil_id
  from (values
    ('22222222-0000-4000-8000-000000000001'::uuid, '33333333-0000-4000-8000-000000000002'::uuid),
    ('22222222-0000-4000-8000-000000000002'::uuid, '33333333-0000-4000-8000-000000000003'::uuid),
    ('22222222-0000-4000-8000-000000000003'::uuid, '33333333-0000-4000-8000-000000000004'::uuid)
  ) as v (barbeiro_id, perfil_id)
 where b.id = v.barbeiro_id
   and b.perfil_id is null;

-- -----------------------------------------------------------------------------
-- 5. Agendamentos de exemplo: dos últimos 14 dias aos próximos 7.
--    Dias passados: concluídos (com alguns cancelados). Hoje e futuro: confirmados.
--    Gravados direto (sem RPC) porque o seed roda como administrador e precisa
--    criar histórico no passado; a exclusion constraint continua valendo.
-- -----------------------------------------------------------------------------
do $$
declare
  c_fuso       constant text := 'America/Sao_Paulo';
  v_hoje       date := (now() at time zone c_fuso)::date;
  v_dia        date;
  v_modelo     record;
  v_inicio     timestamptz;
  v_duracao    integer;
  v_valor      numeric(10, 2);
  v_status     public.status_agendamento;
  v_id         uuid;
  v_seq        integer := 0;
begin
  if exists (select 1 from public.agendamentos) then
    raise notice 'Já existem agendamentos; exemplos não foram recriados.';
    return;
  end if;

  for v_dia in select generate_series(v_hoje - 14, v_hoje + 7, interval '1 day')::date loop
    continue when extract(dow from v_dia) not between 2 and 6;

    for v_modelo in
      select * from (values
        ('22222222-0000-4000-8000-000000000001'::uuid, time '10:00', '33333333-0000-4000-8000-000000000005'::uuid,
         array['11111111-0000-4000-8000-000000000001']::uuid[]),
        ('22222222-0000-4000-8000-000000000002'::uuid, time '11:00', '33333333-0000-4000-8000-000000000006'::uuid,
         array['11111111-0000-4000-8000-000000000003']::uuid[]),
        ('22222222-0000-4000-8000-000000000003'::uuid, time '15:00', '33333333-0000-4000-8000-000000000005'::uuid,
         array['11111111-0000-4000-8000-000000000002']::uuid[]),
        ('22222222-0000-4000-8000-000000000001'::uuid, time '16:00', '33333333-0000-4000-8000-000000000006'::uuid,
         array['11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000004']::uuid[])
      ) as m (barbeiro_id, hora, cliente_id, servicos)
    loop
      v_seq := v_seq + 1;
      v_inicio := (v_dia + v_modelo.hora) at time zone c_fuso;

      select sum(s.duracao_min), sum(s.preco) into v_duracao, v_valor
      from public.servicos s where s.id = any (v_modelo.servicos);

      v_status := case
        when v_dia >= v_hoje then 'confirmado'
        when v_seq % 7 = 0   then 'cancelado'
        else 'concluido'
      end;

      insert into public.agendamentos (
        cliente_id, barbeiro_id, inicio, fim, status, valor_total,
        cancelado_em, cancelado_por, motivo_cancelamento
      ) values (
        v_modelo.cliente_id, v_modelo.barbeiro_id, v_inicio,
        v_inicio + make_interval(mins => v_duracao), v_status, v_valor,
        case when v_status = 'cancelado' then v_inicio - interval '1 day' end,
        case when v_status = 'cancelado' then v_modelo.cliente_id end,
        case when v_status = 'cancelado' then 'Imprevisto (exemplo do seed)' end
      )
      returning id into v_id;

      insert into public.agendamento_servicos (agendamento_id, servico_id, preco_cobrado, duracao_min)
      select v_id, s.id, s.preco, s.duracao_min
      from public.servicos s where s.id = any (v_modelo.servicos);
    end loop;
  end loop;
end;
$$;
