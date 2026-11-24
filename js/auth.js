// =============================================================================
// Autenticação (Supabase Auth, e-mail e senha, JWT) e perfil do usuário logado.
// Mantém em memória a sessão e o perfil atuais e avisa quem se inscrever
// quando eles mudam (login, logout, expiração da sessão).
// =============================================================================
import { supabase } from './supabase.js';
import { buscarPerfil } from './services/perfis.js';
import { exigirSucesso } from './utils/ui.js';
import { somenteDigitos } from './utils/validacao.js';

/** Tela inicial de cada papel. */
export const ROTA_INICIAL_POR_PAPEL = {
  cliente: '/agendar',
  barbeiro: '/minha-agenda',
  gerente: '/agenda',
};

let perfilAtual = null;
const ouvintes = new Set();

export function obterPerfilAtual() {
  return perfilAtual;
}

export function rotaInicial(perfil = perfilAtual) {
  return perfil ? ROTA_INICIAL_POR_PAPEL[perfil.papel] : '/login';
}

/** Registra uma função chamada sempre que o perfil logado muda. */
export function aoMudarAutenticacao(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

async function atualizarPerfil(sessao) {
  try {
    perfilAtual = sessao?.user ? await buscarPerfil(sessao.user.id) : null;
  } catch {
    // Usuário sem perfil (ex.: conta excluída): trata como deslogado.
    perfilAtual = null;
  }
  ouvintes.forEach((ouvinte) => ouvinte(perfilAtual));
}

/** Carrega a sessão salva e passa a acompanhar mudanças. */
export async function iniciarAutenticacao() {
  const { data } = await supabase.auth.getSession();
  await atualizarPerfil(data.session);

  supabase.auth.onAuthStateChange((evento, sessao) => {
    if (evento === 'INITIAL_SESSION' || evento === 'TOKEN_REFRESHED') return;
    // A documentação do supabase-js recomenda não chamar o Supabase dentro
    // deste callback; por isso a consulta do perfil roda logo em seguida.
    setTimeout(() => atualizarPerfil(sessao), 0);
  });
}

export async function entrar(email, senha) {
  exigirSucesso(await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha,
  }));
}

/**
 * Cria a conta. O trigger do banco cria o perfil como "cliente" com o nome e
 * o telefone enviados em "data". Retorna true se a sessão já foi aberta, ou
 * false se o projeto exigir confirmação por e-mail.
 */
export async function cadastrar({ nome, telefone, email, senha }) {
  const dados = exigirSucesso(await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: senha,
    options: { data: { nome: nome.trim(), telefone: somenteDigitos(telefone) } },
  }));
  return Boolean(dados.session);
}

export async function sair() {
  await supabase.auth.signOut();
}
