// =============================================================================
// Perfis de usuário (tabela public.perfis).
// =============================================================================
import { supabase } from '../supabase.js';
import { exigirSucesso } from '../utils/ui.js';

/** Perfil do usuário logado (a RLS só devolve o próprio). */
export async function buscarPerfil(usuarioId) {
  return exigirSucesso(await supabase
    .from('perfis')
    .select('id, nome, telefone, email, papel')
    .eq('id', usuarioId)
    .single());
}

/** LGPD: anonimiza os dados, cancela agendamentos futuros e remove o acesso. */
export async function excluirMinhaConta() {
  exigirSucesso(await supabase.rpc('excluir_minha_conta'));
}
