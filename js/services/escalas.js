// =============================================================================
// Escalas semanais (tabela public.escalas). Uma linha por barbeiro e dia.
// O banco garante: só terça a sábado, dentro do horário de funcionamento, e
// recusa mudanças que deixariam agendamentos futuros fora do expediente.
// =============================================================================
import { supabase } from '../supabase.js';
import { exigirSucesso } from '../utils/ui.js';

export async function listarEscalas(barbeiroId = null) {
  let consulta = supabase
    .from('escalas')
    .select('barbeiro_id, dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim')
    .order('dia_semana');
  if (barbeiroId) consulta = consulta.eq('barbeiro_id', barbeiroId);
  return exigirSucesso(await consulta);
}

/** Cria ou atualiza o expediente de um dia. */
export async function salvarEscala(escala) {
  exigirSucesso(await supabase
    .from('escalas')
    .upsert(escala, { onConflict: 'barbeiro_id,dia_semana' })
    .select('barbeiro_id')
    .single());
}

/** Marca o barbeiro como "não trabalha" naquele dia da semana. */
export async function removerEscala(barbeiroId, diaSemana) {
  exigirSucesso(await supabase
    .from('escalas').delete().eq('barbeiro_id', barbeiroId).eq('dia_semana', diaSemana));
}
