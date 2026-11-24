// =============================================================================
// Tela: Cadastro de cliente (RF01). Toda conta nova nasce como "cliente".
// Mostra o aviso de LGPD sobre os dados coletados e a finalidade.
// =============================================================================
import { cadastrar } from '../auth.js';
import { comBotaoOcupado, criarAviso, criarCampo, h, mensagemDeErro, substituirConteudo, validarCampos } from '../utils/ui.js';
import { mascararTelefone, validarEmail, validarNome, validarSenha, validarTelefone } from '../utils/validacao.js';
import { criarMarcaAcesso } from './login.js';

export function montar(container) {
  const nome = criarCampo({
    id: 'nome', rotulo: 'Nome',
    atributos: { autocomplete: 'name', maxlength: 100, required: true },
  });
  const telefone = criarCampo({
    id: 'telefone', rotulo: 'Telefone (com DDD)', ajuda: 'Usado só para contato sobre os seus agendamentos.',
    atributos: { type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '(11) 98765-4321', required: true },
  });
  const email = criarCampo({
    id: 'email', rotulo: 'E-mail',
    atributos: { type: 'email', autocomplete: 'email', inputmode: 'email', required: true },
  });
  const senha = criarCampo({
    id: 'senha', rotulo: 'Senha', ajuda: 'Mínimo de 8 caracteres, com letras e números.',
    atributos: { type: 'password', autocomplete: 'new-password', required: true },
  });
  const confirmacao = criarCampo({
    id: 'confirmacao', rotulo: 'Repita a senha',
    atributos: { type: 'password', autocomplete: 'new-password', required: true },
  });

  telefone.controle.addEventListener('input', () => {
    telefone.controle.value = mascararTelefone(telefone.controle.value);
  });

  const areaMensagem = h('div');
  const botaoCriar = h('button', { type: 'submit', class: 'botao botao--bloco' }, 'Criar conta');

  async function aoEnviar(evento) {
    evento.preventDefault();
    substituirConteudo(areaMensagem);

    const valido = validarCampos([
      [nome, validarNome],
      [telefone, validarTelefone],
      [email, validarEmail],
      [senha, validarSenha],
      [confirmacao, (valor) => {
        if (!valor) return 'Repita a senha.';
        return valor === senha.controle.value ? '' : 'As senhas não são iguais.';
      }],
    ]);
    if (!valido) return;

    try {
      const sessaoAberta = await comBotaoOcupado(botaoCriar, () => cadastrar({
        nome: nome.controle.value,
        telefone: telefone.controle.value,
        email: email.controle.value,
        senha: senha.controle.value,
      }));
      if (!sessaoAberta) {
        substituirConteudo(areaMensagem, criarAviso(
          'Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.', 'sucesso'));
      }
      // Com sessão aberta, o app redireciona automaticamente para "Agendar".
    } catch (erro) {
      substituirConteudo(areaMensagem, criarAviso(mensagemDeErro(erro), 'erro'));
    }
  }

  container.append(h('section', { class: 'cartao cartao--acesso', 'aria-labelledby': 'titulo-cadastro' },
    criarMarcaAcesso('Agende seu horário em poucos toques'),
    h('h2', { id: 'titulo-cadastro' }, 'Criar conta'),
    h('form', { class: 'formulario', novalidate: true, onsubmit: aoEnviar },
      nome.elemento, telefone.elemento, email.elemento, senha.elemento, confirmacao.elemento,
      h('div', { class: 'aviso', role: 'note' },
        h('p', {}, h('strong', {}, 'Privacidade (LGPD): '),
          'coletamos apenas nome, telefone e e-mail, usados somente para identificar você, ',
          'gerenciar seus agendamentos e entrar em contato sobre eles. ',
          'Não compartilhamos seus dados e você pode excluir sua conta a qualquer momento ',
          'em "Meus horários".')),
      areaMensagem,
      botaoCriar),
    h('p', { class: 'rodape-acesso' },
      'Já tem conta? ', h('a', { href: '#/login' }, 'Entrar'))));

  nome.controle.focus();
}
