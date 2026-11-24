// =============================================================================
// Roteador da SPA baseado em hash (#/rota). Funciona em hospedagem estática
// sem configuração de servidor. Cada rota declara quem pode acessá-la; a
// proteção real dos dados está na RLS — aqui o objetivo é a navegação.
//
// Contrato de uma página (js/pages/*.js):
//   export async function montar(container, { perfil, parametros })
//   -> pode retornar uma função de limpeza, chamada ao sair da página.
// =============================================================================
import { obterPerfilAtual, rotaInicial } from './auth.js';
import { criarAviso, criarCarregando, mensagemDeErro, substituirConteudo } from './utils/ui.js';

export const ROTAS = {
  '/login': { titulo: 'Entrar', publica: true, pagina: () => import('./pages/login.js') },
  '/cadastro': { titulo: 'Criar conta', publica: true, pagina: () => import('./pages/cadastro.js') },

  '/agendar': {
    titulo: 'Agendar', icone: '✂', papeis: ['cliente'],
    pagina: () => import('./pages/novo-agendamento.js'),
  },
  '/meus-agendamentos': {
    titulo: 'Meus horários', icone: '☰', papeis: ['cliente'],
    pagina: () => import('./pages/meus-agendamentos.js'),
  },
  '/minha-agenda': {
    titulo: 'Minha agenda', icone: '▦', papeis: ['barbeiro'],
    pagina: () => import('./pages/minha-agenda.js'),
  },
  '/agenda': {
    titulo: 'Agenda', icone: '▦', papeis: ['gerente'],
    pagina: () => import('./pages/agenda-geral.js'),
  },
  '/equipe': {
    titulo: 'Equipe', icone: '☺', papeis: ['gerente'],
    pagina: () => import('./pages/equipe.js'),
  },
  '/servicos': {
    titulo: 'Serviços', icone: '✂', papeis: ['gerente'],
    pagina: () => import('./pages/servicos.js'),
  },
  '/indicadores': {
    titulo: 'Indicadores', icone: '▲', papeis: ['gerente'],
    pagina: () => import('./pages/indicadores.js'),
  },
};

let limparPaginaAtual = null;
let contadorNavegacao = 0;

/** Rotas que aparecem no menu para um papel. */
export function rotasDoMenu(papel) {
  return Object.entries(ROTAS)
    .filter(([, rota]) => rota.papeis?.includes(papel))
    .map(([caminho, rota]) => ({ caminho, ...rota }));
}

export function caminhoAtual() {
  const [caminho] = (window.location.hash.replace(/^#/, '') || '/').split('?');
  return caminho;
}

function parametrosAtuais() {
  const [, busca = ''] = window.location.hash.split('?');
  return Object.fromEntries(new URLSearchParams(busca));
}

export function navegar(caminho) {
  if (window.location.hash === `#${caminho}`) {
    renderizarRotaAtual();
  } else {
    window.location.hash = caminho;
  }
}

/** Decide para onde redirecionar quando a rota não pode ser exibida. */
function redirecionamentoNecessario(caminho, perfil) {
  const rota = ROTAS[caminho];
  if (!rota) return rotaInicial(perfil);
  if (rota.publica) return perfil ? rotaInicial(perfil) : null;
  if (!perfil) return '/login';
  if (!rota.papeis.includes(perfil.papel)) return rotaInicial(perfil);
  return null;
}

export async function renderizarRotaAtual() {
  const container = document.getElementById('conteudo');
  const caminho = caminhoAtual();
  const perfil = obterPerfilAtual();

  const destino = redirecionamentoNecessario(caminho, perfil);
  if (destino) {
    window.location.replace(`#${destino}`);
    return;
  }

  const navegacao = ++contadorNavegacao;
  const rota = ROTAS[caminho];

  if (typeof limparPaginaAtual === 'function') limparPaginaAtual();
  limparPaginaAtual = null;

  document.title = `${rota.titulo} · Perrito Barbearia`;
  container.classList.toggle('conteudo--publico', Boolean(rota.publica));
  substituirConteudo(container, criarCarregando());
  document.dispatchEvent(new CustomEvent('rota-alterada', { detail: { caminho } }));

  try {
    const modulo = await rota.pagina();
    if (navegacao !== contadorNavegacao) return; // usuário já navegou para outra tela
    substituirConteudo(container);
    limparPaginaAtual = await modulo.montar(container, { perfil, parametros: parametrosAtuais() });
  } catch (erro) {
    console.error(erro);
    substituirConteudo(container, criarAviso(mensagemDeErro(erro), 'erro'));
  }

  container.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

export function iniciarRoteador() {
  window.addEventListener('hashchange', renderizarRotaAtual);
  renderizarRotaAtual();
}
