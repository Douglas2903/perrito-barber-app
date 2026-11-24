// =============================================================================
// Barbeiros (tabela public.barbeiros) e vínculo com usuários.
// =============================================================================
import { supabase } from '../supabase.js';
import { exigirSucesso } from '../utils/ui.js';

export const NIVEIS = {
  senior: 'Sênior',
  pleno: 'Pleno',
  junior: 'Júnior',
};

const ORDEM_NIVEL = { senior: 0, pleno: 1, junior: 2 };

/** Ordena do mais experiente para o menos experiente e depois por nome. */
function ordenarPorNivel(barbeiros) {
  return [...barbeiros].sort((a, b) =>
    ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function listarBarbeirosAtivos() {
  const dados = exigirSucesso(await supabase
    .from('barbeiros').select('id, nome, nivel').eq('ativo', true));
  return ordenarPorNivel(dados);
}

/** Gerente: todos os barbeiros, com o usuário vinculado (se houver). */
export async function listarTodosBarbeiros() {
  const dados = exigirSucesso(await supabase
    .from('barbeiros')
    .select('id, nome, nivel, ativo, perfil_id, perfil:perfis(nome, email)'));
  return ordenarPorNivel(dados).sort((a, b) => Number(b.ativo) - Number(a.ativo));
}

export async function criarBarbeiro({ nome, nivel }) {
  return exigirSucesso(await supabase
    .from('barbeiros').insert({ nome, nivel }).select('id').single());
}

export async function atualizarBarbeiro(id, alteracoes) {
  exigirSucesso(await supabase.from('barbeiros').update(alteracoes).eq('id', id).select('id').single());
}

export async function promoverUsuarioABarbeiro(email, barbeiroId) {
  exigirSucesso(await supabase.rpc('promover_barbeiro', { p_email: email, p_barbeiro_id: barbeiroId }));
}

export async function desvincularUsuarioDoBarbeiro(barbeiroId) {
  exigirSucesso(await supabase.rpc('desvincular_barbeiro', { p_barbeiro_id: barbeiroId }));
}
