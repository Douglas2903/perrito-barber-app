-- =============================================================================
-- Perrito Barber App 3.0 — Migração 06: indicadores (RF10)
-- -----------------------------------------------------------------------------
-- Por barbeiro e por período (datas no fuso de São Paulo):
--   realizados  = agendamentos com status 'concluido'
--   cancelados  = agendamentos com status 'cancelado'
--   faturamento = soma de valor_total dos concluídos (preço congelado)
-- SECURITY INVOKER: roda com as permissões de quem chama. Só o gerente
-- enxerga todos os agendamentos pela RLS; mesmo assim o papel é conferido.
-- =============================================================================
create or replace function public.indicadores(p_inicio date, p_fim date)
returns table (
  barbeiro_id   uuid,
  barbeiro_nome text,
  nivel         public.nivel_barbeiro,
  realizados    integer,
  cancelados    integer,
  faturamento   numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (select private.eh_gerente()) then
    raise exception 'Você não tem permissão para esta ação.' using errcode = '42501';
  end if;

  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido: a data final deve ser igual ou posterior à inicial.' using errcode = 'P0001';
  end if;

  if p_fim - p_inicio > 366 then
    raise exception 'Escolha um período de até 1 ano.' using errcode = 'P0001';
  end if;

  return query
  select
    b.id,
    b.nome,
    b.nivel,
    count(*) filter (where a.status = 'concluido')::integer,
    count(*) filter (where a.status = 'cancelado')::integer,
    coalesce(sum(a.valor_total) filter (where a.status = 'concluido'), 0)::numeric(10, 2)
  from public.barbeiros b
  left join public.agendamentos a
    on a.barbeiro_id = b.id
   and a.inicio >= (p_inicio::timestamp       at time zone private.fuso_horario())
   and a.inicio <  ((p_fim + 1)::timestamp    at time zone private.fuso_horario())
  group by b.id, b.nome, b.nivel, b.ativo
  having b.ativo or count(a.id) > 0
  order by b.nivel, b.nome;
end;
$$;

revoke execute on function public.indicadores(date, date) from public, anon;
grant execute on function public.indicadores(date, date) to authenticated;

-- private.fuso_horario() é usada acima com as permissões de quem chama.
grant execute on function private.fuso_horario() to authenticated;
