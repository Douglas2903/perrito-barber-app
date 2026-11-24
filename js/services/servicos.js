// =============================================================================
// Catálogo de serviços (tabela public.servicos).
// Leitura: RLS mostra os ativos a qualquer usuário logado e todos ao gerente.
// Escrita: só o gerente (RLS).
// =============================================================================
import { supabase } from '../supabase.js';
import { exigirSucesso } from '../utils/ui.js';

const COLUNAS = 'id, nome, preco, duracao_min, ativo';

export async function listarServicosAtivos() {
  return exigirSucesso(await supabase
    .from('servicos').select(COLUNAS).eq('ativo', true).order('nome'));
}

export async function listarTodosServicos() {
  return exigirSucesso(await supabase
    .from('servicos').select(COLUNAS).order('ativo', { ascending: false }).order('nome'));
}

export async function criarServico({ nome, preco, duracao_min }) {
  return exigirSucesso(await supabase
    .from('servicos').insert({ nome, preco, duracao_min }).select(COLUNAS).single());
}

export async function atualizarServico(id, alteracoes) {
  return exigirSucesso(await supabase
    .from('servicos').update(alteracoes).eq('id', id).select(COLUNAS).single());
}
