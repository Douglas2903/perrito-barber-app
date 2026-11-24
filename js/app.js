// =============================================================================
// Ponto de entrada da SPA: verifica a configuração, restaura a sessão, monta
// o topo/menu conforme o papel do usuário e inicia o roteador.
// =============================================================================
import { criarAviso, h, substituirConteudo } from './utils/ui.js';

async function iniciar() {
  let modulos;
  try {
    // Import dinâmico: se config.js estiver ausente ou o CDN indisponível,
    // mostramos uma mensagem clara em vez de uma tela em branco.
    const [auth, router] = await Promise.all([import('./auth.js'), import('./router.js')]);
    modulos = { auth, router };
  } catch (erro) {
    console.error(erro);
    mostrarFalhaDeInicializacao(erro);
    return;
  }

  const { auth, router } = modulos;

  document.getElementById('botao-sair').addEventListener('click', async () => {
    await auth.sair();
  });

  document.addEventListener('rota-alterada', (evento) => marcarItemAtivo(evento.detail.caminho));

  await auth.iniciarAutenticacao();
  atualizarTopo(auth.obterPerfilAtual(), router);

  auth.aoMudarAutenticacao((perfil) => {
    atualizarTopo(perfil, router);
    router.navegar(perfil ? auth.rotaInicial(perfil) : '/login');
  });

  router.iniciarRoteador();
}

function atualizarTopo(perfil, router) {
  const topo = document.getElementById('topo');
  const navegacao = document.getElementById('navegacao');
  topo.hidden = !perfil;
  document.getElementById('nome-usuario').textContent = perfil ? perfil.nome : '';

  const itens = perfil ? router.rotasDoMenu(perfil.papel) : [];
  substituirConteudo(navegacao, itens.map((item) => h('a', {
    class: 'navegacao__link',
    href: `#${item.caminho}`,
    dataset: { caminho: item.caminho },
  },
  h('span', { class: 'navegacao__icone', 'aria-hidden': 'true' }, item.icone),
  h('span', {}, item.titulo))));

  marcarItemAtivo(router.caminhoAtual());
}

function marcarItemAtivo(caminho) {
  document.querySelectorAll('.navegacao__link').forEach((link) => {
    if (link.dataset.caminho === caminho) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function mostrarFalhaDeInicializacao(erro) {
  const conteudo = document.getElementById('conteudo');
  const configuracaoAusente = /config/i.test(String(erro?.message));
  substituirConteudo(conteudo, h('div', { class: 'cartao cartao--acesso' },
    h('h1', {}, 'Não foi possível abrir o sistema'),
    criarAviso(configuracaoAusente
      ? 'A configuração do Supabase não foi encontrada. Crie o arquivo js/config.js a partir de js/config.example.js (veja o README).'
      : 'Falha ao carregar os componentes do sistema. Verifique sua conexão e recarregue a página.', 'erro')));
  conteudo.classList.add('conteudo--publico');
}

iniciar();
