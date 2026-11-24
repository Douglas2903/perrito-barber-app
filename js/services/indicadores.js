// =============================================================================
// Indicadores por barbeiro e período (RF10). O cálculo é feito no banco.
// =============================================================================
import { supabase } from '../supabase.js';
import { exigirSucesso } from '../utils/ui.js';

export async function buscarIndicadores(dataInicialISO, dataFinalISO) {
  return exigirSucesso(await supabase.rpc('indicadores', { p_inicio: dataInicialISO, p_fim: dataFinalISO }));
}
