// =============================================================================
// Agendamentos. Leitura direta da tabela (filtrada pela RLS conforme o papel)
// e escrita SOMENTE pelas funções RPC do banco, que validam as regras.
// =============================================================================
import { supabase } from '../supabase.js';
import { inicioDoDia, somarDias } from '../utils/datas.js';
import { exigirSucesso } from '../utils/ui.js';

// Colunas usadas em todas as listagens. O cliente é buscado pela FK
// cliente_id (há duas FKs para perfis, por isso o nome explícito).
const COLUNAS_AGENDAMENTO = `
  id, inicio, fim, status, valor_total, criado_em, cancelado_em, motivo_cancelamento,
  barbeiro_id,
  barbeiro:barbeiros(id, nome, nivel),
  cliente:perfis!agendamentos_cliente_id_fkey(nome, telefone),
  itens:agendamento_servicos(preco_cobrado, duracao_min, servico:servicos(nome))
`;

// ------------------------------- Leitura ------------------------------------

/** Agendamentos visíveis ao usuário (RLS) com início no período [de, ate]. */
export async function listarAgendamentosNoPeriodo(dataInicialISO, dataFinalISO, { barbeiroId } = {}) {
  let consulta = supabase
    .from('agendamentos')
    .select(COLUNAS_AGENDAMENTO)
    .gte('inicio', inicioDoDia(dataInicialISO))
    .lt('inicio', inicioDoDia(somarDias(dataFinalISO, 1)))
    .order('inicio');
  if (barbeiroId) consulta = consulta.eq('barbeiro_id', barbeiroId);
  return exigirSucesso(await consulta);
}

/** Todos os agendamentos do próprio cliente (a RLS já filtra). */
export async function listarMeusAgendamentos() {
  return exigirSucesso(await supabase
    .from('agendamentos')
    .select(COLUNAS_AGENDAMENTO)
    .order('inicio', { ascending: false }));
}

// ---------------------------------- RPC -------------------------------------

/** Horários de início livres (de 15 em 15 min) para os serviços escolhidos. */
export async function buscarHorariosDisponiveis({ dataISO, servicoIds, barbeiroId = null }) {
  return exigirSucesso(await supabase.rpc('horarios_disponiveis', {
    p_data: dataISO,
    p_servicos: servicoIds,
    p_barbeiro_id: barbeiroId,
  }));
}

export async function criarAgendamento({ inicio, servicoIds, barbeiroId = null }) {
  return exigirSucesso(await supabase.rpc('criar_agendamento', {
    p_inicio: inicio,
    p_servicos: servicoIds,
    p_barbeiro_id: barbeiroId,
  }));
}

export async function cancelarAgendamento(id, motivo = '') {
  exigirSucesso(await supabase.rpc('cancelar_agendamento', { p_id: id, p_motivo: motivo || null }));
}

export async function concluirAgendamento(id) {
  exigirSucesso(await supabase.rpc('concluir_agendamento', { p_id: id }));
}

export async function trocarBarbeiro(id, novoBarbeiroId) {
  exigirSucesso(await supabase.rpc('trocar_barbeiro', { p_id: id, p_novo_barbeiro: novoBarbeiroId }));
}
