// =============================================================================
// Utilitários de interface: criação segura de elementos, avisos, modal,
// estados de carregamento/vazio e tradução de erros para o usuário.
// =============================================================================

/**
 * Cria um elemento DOM. Textos viram nós de texto (nunca HTML), o que evita
 * injeção de código (XSS) com dados vindos do banco.
 *   h('button', { class: 'botao', onclick: salvar }, 'Salvar')
 */
export function h(tag, propriedades = {}, ...filhos) {
  const elemento = document.createElement(tag);

  for (const [nome, valor] of Object.entries(propriedades ?? {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (nome.startsWith('on') && typeof valor === 'function') {
      elemento.addEventListener(nome.slice(2), valor);
    } else if (nome === 'class') {
      elemento.className = valor;
    } else if (nome === 'dataset') {
      Object.assign(elemento.dataset, valor);
    } else if (nome in elemento && typeof valor !== 'string') {
      elemento[nome] = valor;
    } else {
      elemento.setAttribute(nome, valor === true ? '' : String(valor));
    }
  }

  adicionarFilhos(elemento, filhos);
  return elemento;
}

function adicionarFilhos(elemento, filhos) {
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
}

/** Substitui todo o conteúdo de um elemento. */
export function substituirConteudo(elemento, ...filhos) {
  elemento.replaceChildren();
  adicionarFilhos(elemento, filhos);
}

export function criarCarregando(texto = 'Carregando…') {
  return h('div', { class: 'carregando', role: 'status' },
    h('span', { class: 'carregando__icone', 'aria-hidden': 'true' }), texto);
}

export function criarVazio(titulo, texto = '') {
  return h('div', { class: 'vazio' },
    h('p', { class: 'vazio__titulo' }, titulo),
    texto ? h('p', {}, texto) : null);
}

/** Caixa de mensagem dentro da página. tipo: info | erro | sucesso | alerta */
export function criarAviso(texto, tipo = 'info') {
  return h('div', { class: `aviso aviso--${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' },
    h('p', {}, texto));
}

export function criarCabecalhoPagina(titulo, subtitulo = '', ...acoes) {
  return h('div', { class: 'cabecalho-pagina' },
    h('div', {}, h('h1', {}, titulo), subtitulo ? h('p', { class: 'texto-suave' }, subtitulo) : null),
    acoes.length ? h('div', { class: 'grupo-botoes' }, ...acoes) : null);
}

/**
 * Campo de formulário acessível (rótulo, ajuda e mensagem de erro ligados ao
 * input por aria-describedby). Retorna { elemento, controle, mostrarErro }.
 *   criarCampo({ id: 'email', rotulo: 'E-mail', atributos: { type: 'email' } })
 * Para <select>/<textarea>, passe tag: 'select' e os filhos em "opcoes".
 */
export function criarCampo({ id, rotulo, ajuda = '', tag = 'input', atributos = {}, opcoes = [] }) {
  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  const controle = h(tag, {
    id, name: id, 'aria-describedby': [ajuda ? idAjuda : '', idErro].join(' ').trim(), ...atributos,
  }, ...opcoes);
  const erro = h('p', { class: 'campo__erro', id: idErro });

  function mostrarErro(mensagem) {
    erro.textContent = mensagem || '';
    if (mensagem) controle.setAttribute('aria-invalid', 'true');
    else controle.removeAttribute('aria-invalid');
  }

  const elemento = h('div', { class: 'campo' },
    h('label', { for: id }, rotulo),
    controle,
    ajuda ? h('p', { class: 'campo__ajuda', id: idAjuda }, ajuda) : null,
    erro);

  return { elemento, controle, mostrarErro };
}

/**
 * Valida vários campos de uma vez. "regras" = [[campo, funcaoValidar], ...].
 * Mostra os erros, foca o primeiro inválido e retorna true se tudo estiver ok.
 */
export function validarCampos(regras) {
  let primeiroInvalido = null;
  for (const [campo, validar] of regras) {
    const mensagem = validar(campo.controle.value);
    campo.mostrarErro(mensagem);
    if (mensagem && !primeiroInvalido) primeiroInvalido = campo.controle;
  }
  primeiroInvalido?.focus();
  return !primeiroInvalido;
}

/** Mensagem temporária no canto da tela. */
export function notificar(texto, tipo = 'sucesso') {
  const area = document.getElementById('avisos');
  if (!area) return;
  const toast = h('div', { class: `toast toast--${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' }, texto);
  area.append(toast);
  setTimeout(() => toast.remove(), tipo === 'erro' ? 7000 : 4000);
}

/**
 * Executa uma ação assíncrona mostrando o botão como "ocupado" e impedindo
 * clique duplo. Retorna o resultado da ação.
 */
export async function comBotaoOcupado(botao, acao) {
  if (botao.getAttribute('aria-busy') === 'true') return undefined;
  botao.setAttribute('aria-busy', 'true');
  botao.disabled = true;
  try {
    return await acao();
  } finally {
    botao.removeAttribute('aria-busy');
    botao.disabled = false;
  }
}

/**
 * Modal acessível baseado em <dialog>. Retorna uma Promise resolvida com o
 * valor da ação clicada (ou null ao fechar/cancelar).
 *   abrirModal({ titulo, conteudo, acoes: [{ texto, valor, classe }] })
 * Se a ação tiver "aoConfirmar", ela é executada antes de fechar; se lançar
 * erro, a mensagem aparece no modal e ele continua aberto.
 */
export function abrirModal({ titulo, conteudo = [], acoes = [] }) {
  return new Promise((resolver) => {
    const areaErro = h('div', { role: 'alert' });
    const botoes = acoes.map((acao) => {
      const botao = h('button', { type: 'button', class: `botao ${acao.classe ?? ''}` }, acao.texto);
      botao.addEventListener('click', async () => {
        if (!acao.aoConfirmar) {
          fechar(acao.valor ?? null);
          return;
        }
        substituirConteudo(areaErro);
        try {
          const resultado = await comBotaoOcupado(botao, acao.aoConfirmar);
          fechar(resultado ?? acao.valor ?? true);
        } catch (erro) {
          substituirConteudo(areaErro, criarAviso(mensagemDeErro(erro), 'erro'));
        }
      });
      return botao;
    });

    const dialogo = h('dialog', { class: 'modal', 'aria-labelledby': 'modal-titulo' },
      h('div', { class: 'modal__corpo' },
        h('h2', { id: 'modal-titulo' }, titulo),
        conteudo,
        areaErro,
        h('div', { class: 'modal__acoes' }, botoes)));

    function fechar(valor) {
      dialogo.close();
      dialogo.remove();
      resolver(valor);
    }

    dialogo.addEventListener('cancel', (evento) => {
      evento.preventDefault();
      fechar(null);
    });

    document.body.append(dialogo);
    dialogo.showModal();
  });
}

/** Confirmação simples (sim/não). Resolve true/false. */
export async function confirmar({ titulo, mensagem, textoConfirmar = 'Confirmar', perigo = false }) {
  const resposta = await abrirModal({
    titulo,
    conteudo: [h('p', {}, mensagem)],
    acoes: [
      { texto: 'Voltar', classe: 'botao--secundario', valor: false },
      { texto: textoConfirmar, classe: perigo ? 'botao--perigo' : '', valor: true },
    ],
  });
  return resposta === true;
}

// -----------------------------------------------------------------------------
// Tradução de erros técnicos para mensagens claras ao usuário.
// As funções do banco já devolvem mensagens em português (códigos P0001,
// P0002, 23P01, 42501, 28000) e são exibidas como vieram.
// -----------------------------------------------------------------------------
const CODIGOS_COM_MENSAGEM_PROPRIA = new Set(['P0001', 'P0002', '23P01', '42501', '28000']);

const TRADUCOES = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/user already registered/i, 'Já existe uma conta com este e-mail. Tente entrar.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'],
  [/password should be at least/i, 'A senha é muito curta.'],
  [/(weak|pwned|leaked) password/i, 'Esta senha é fraca ou já apareceu em vazamentos. Escolha outra.'],
  [/rate limit|too many requests/i, 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'],
  [/failed to fetch|network|load failed/i, 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'],
  [/jwt expired|invalid jwt|session/i, 'Sua sessão expirou. Entre novamente.'],
  [/permission denied|row-level security/i, 'Você não tem permissão para esta ação.'],
  [/duplicate key/i, 'Já existe um registro com esses dados.'],
  [/violates check constraint/i, 'Algum valor informado é inválido. Confira os campos.'],
];

/** Erro de validação do próprio front-end: a mensagem é exibida como está. */
export class ErroDeValidacao extends Error {}

export function mensagemDeErro(erro) {
  if (!erro) return 'Ocorreu um erro inesperado.';
  const mensagem = erro.message ?? String(erro);
  if (erro instanceof ErroDeValidacao || CODIGOS_COM_MENSAGEM_PROPRIA.has(erro.code)) return mensagem;
  const traducao = TRADUCOES.find(([padrao]) => padrao.test(mensagem));
  return traducao ? traducao[1] : 'Não foi possível concluir a operação. Tente novamente.';
}

/** Lança o erro do Supabase (se houver) para ser tratado com try/catch. */
export function exigirSucesso({ data, error }) {
  if (error) throw error;
  return data;
}
