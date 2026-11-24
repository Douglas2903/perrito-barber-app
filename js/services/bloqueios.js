// =============================================================================
// Bloqueios de agenda: folgas e compromissos (tabela public.bloqueios).
// O banco recusa bloqueio sobre agendamento confirmado.
// =============================================================================
import { supabase } from '../supabase.js';
import { inicioDoDia, somarDias } from '../utils/datas.js';
import { exigirSucesso } from '../utils/ui.js';

/** Bloqueios que tocam o período [dataInicial, dataFinal] (visíveis pela RLS). */
export async function listarBloqueiosNoPeriodo(dataInicialISO, dataFinalISO, { barbeiroId } = {}) {
  let consulta = supabase
    .from('bloqueios')
    .select('id, barbeiro_id, inicio, fim, motivo, barbeiro:barbeiros(nome)')
    .lt('inicio', inicioDoDia(somarDias(dataFinalISO, 1)))
    .gt('fim', inicioDoDia(dataInicialISO))
    .order('inicio');
  if (barbeiroId) consulta = consulta.eq('barbeiro_id', barbeiroId);
  return exigirSucesso(await consulta);
}

/** Próximos bloqueios (a partir de hoje). */
export async function listarProximosBloqueios() {
  return exigirSucesso(await supabase
    .from('bloqueios')
    .select('id, barbeiro_id, inicio, fim, motivo, barbeiro:barbeiros(nome)')
    .gt('fim', new Date().toISOString())
    .order('inicio'));
}

export async function criarBloqueio({ barbeiroId, inicio, fim, motivo }) {
  exigirSucesso(await supabase
    .from('bloqueios')
    .insert({ barbeiro_id: barbeiroId, inicio, fim, motivo })
    .select('id')
    .single());
}

export async function removerBloqueio(id) {
  exigirSucesso(await supabase.from('bloqueios').delete().eq('id', id));
}
