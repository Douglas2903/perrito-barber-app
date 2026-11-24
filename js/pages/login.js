// =============================================================================
// Tela: Login (e-mail e senha).
// Após entrar, o app.js redireciona para a tela inicial do papel do usuário.
// =============================================================================
import { entrar } from '../auth.js';
import { comBotaoOcupado, criarAviso, criarCampo, h, mensagemDeErro, substituirConteudo, validarCampos } from '../utils/ui.js';
import { validarEmail } from '../utils/validacao.js';

export function criarMarcaAcesso(subtitulo) {
  return h('div', { class: 'marca-acesso' },
    h('h1', {}, 'Perrito ', h('strong', {}, 'Barbearia')),
    h('p', { class: 'texto-suave' }, subtitulo));
}

export function montar(container) {
  const email = criarCampo({
    id: 'email', rotulo: 'E-mail',
    atributos: { type: 'email', autocomplete: 'email', inputmode: 'email', required: true },
  });
  const senha = criarCampo({
    id: 'senha', rotulo: 'Senha',
    atributos: { type: 'password', autocomplete: 'current-password', required: true },
  });
  const areaMensagem = h('div');
  const botaoEntrar = h('button', { type: 'submit', class: 'botao botao--bloco' }, 'Entrar');

  async function aoEnviar(evento) {
    evento.preventDefault();
    substituirConteudo(areaMensagem);

    const valido = validarCampos([
      [email, validarEmail],
      [senha, (valor) => (valor ? '' : 'Informe a senha.')],
    ]);
    if (!valido) return;

    try {
      await comBotaoOcupado(botaoEntrar, () => entrar(email.controle.value, senha.controle.value));
    } catch (erro) {
      substituirConteudo(areaMensagem, criarAviso(mensagemDeErro(erro), 'erro'));
      senha.controle.select();
    }
  }

  container.append(h('section', { class: 'cartao cartao--acesso', 'aria-labelledby': 'titulo-login' },
    criarMarcaAcesso('Rua Luís Góis, 322 · São Paulo (SP)'),
    h('h2', { id: 'titulo-login' }, 'Entrar'),
    h('form', { class: 'formulario', novalidate: true, onsubmit: aoEnviar },
      email.elemento, senha.elemento, areaMensagem, botaoEntrar),
    h('p', { class: 'rodape-acesso' },
      'Ainda não tem conta? ', h('a', { href: '#/cadastro' }, 'Criar conta'))));

  email.controle.focus();
}
