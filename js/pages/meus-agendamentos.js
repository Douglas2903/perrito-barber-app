// =============================================================================
// Tela: Cliente — Meus agendamentos
// Próximos e histórico; cancelar (RF09) e excluir a conta (RD04 — LGPD).
// =============================================================================
import { sair } from '../auth.js';
import { cancelarAgendamento, listarMeusAgendamentos } from '../services/agendamentos.js';
import { excluirMinhaConta } from '../services/perfis.js';
import { criarItemAgendamento, nomesDosServicos } from '../utils/apresentacao.js';
import { formatarDataHora } from '../utils/datas.js';
import {
  abrirModal, criarAviso, criarCabecalhoPagina, criarCarregando, criarVazio, h, mensagemDeErro,
  notificar, substituirConteudo,
} from '../utils/ui.js';

export async function montar(container) {
  const areaLista = h('div', {}, criarCarregando());

  container.append(
    criarCabecalhoPagina('Meus horários', 'Seus próximos atendimentos e o histórico.',
      h('a', { class: 'botao', href: '#/agendar' }, 'Novo agendamento')),
    areaLista,
    criarSecaoExcluirConta());

  async function carregar() {
    try {
      const agendamentos = await listarMeusAgendamentos();
      substituirConteudo(areaLista, ...renderizarListas(agendamentos, pedirCancelamento));
    } catch (erro) {
      substituirConteudo(areaLista, criarAviso(mensagemDeErro(erro), 'erro'));
    }
  }

  async function pedirCancelamento(agendamento) {
    const motivo = h('textarea', { id: 'motivo-cancelamento', maxlength: 300, placeholder: 'Opcional' });
    const cancelado = await abrirModal({
      titulo: 'Cancelar agendamento?',
      conteudo: [
        h('p', {}, `${nomesDosServicos(agendamento)} em ${formatarDataHora(agendamento.inicio)} com ${agendamento.barbeiro?.nome}.`),
        h('div', { class: 'campo' }, h('label', { for: 'motivo-cancelamento' }, 'Motivo (opcional)'), motivo),
      ],
      acoes: [
        { texto: 'Manter horário', classe: 'botao--secundario', valor: false },
        {
          texto: 'Cancelar agendamento',
          classe: 'botao--perigo',
          aoConfirmar: () => cancelarAgendamento(agendamento.id, motivo.value.trim()),
        },
      ],
    });
    if (cancelado) {
      notificar('Agendamento cancelado. O horário foi liberado.');
      carregar();
    }
  }

  carregar();
}

function renderizarListas(agendamentos, aoCancelar) {
  const agora = Date.now();
  const proximos = agendamentos
    .filter((a) => a.status === 'confirmado' && new Date(a.fim).getTime() > agora)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const historico = agendamentos.filter((a) => !proximos.includes(a));

  return [
    h('section', { class: 'secao', 'aria-labelledby': 'titulo-proximos' },
      h('h2', { id: 'titulo-proximos' }, `Próximos (${proximos.length})`),
      proximos.length
        ? h('ul', { class: 'lista' }, proximos.map((agendamento) => criarItemAgendamento(agendamento, {
          acoes: new Date(agendamento.inicio).getTime() > agora
            ? [h('button', {
              type: 'button',
              class: 'botao botao--perigo botao--pequeno',
              onclick: () => aoCancelar(agendamento),
            }, 'Cancelar')]
            : [],
        })))
        : criarVazio('Você não tem horários marcados', 'Toque em "Novo agendamento" para marcar.')),
    h('section', { class: 'secao', 'aria-labelledby': 'titulo-historico' },
      h('h2', { id: 'titulo-historico' }, `Histórico (${historico.length})`),
      historico.length
        ? h('ul', { class: 'lista' }, historico.map((agendamento) => criarItemAgendamento(agendamento)))
        : criarVazio('Nenhum atendimento anterior')),
  ];
}

function criarSecaoExcluirConta() {
  async function aoExcluir() {
    const excluida = await abrirModal({
      titulo: 'Excluir minha conta?',
      conteudo: [
        h('p', {}, 'Seus horários futuros serão cancelados e seu nome, telefone e e-mail serão apagados.'),
        h('p', {}, 'O histórico de atendimentos é mantido sem os seus dados pessoais, como exige a LGPD. '
          + 'Esta ação não pode ser desfeita.'),
      ],
      acoes: [
        { texto: 'Voltar', classe: 'botao--secundario', valor: false },
        { texto: 'Excluir definitivamente', classe: 'botao--perigo', aoConfirmar: excluirMinhaConta },
      ],
    });
    if (excluida) {
      await sair();
      notificar('Sua conta foi excluída.');
    }
  }

  return h('section', { class: 'secao cartao', 'aria-labelledby': 'titulo-conta' },
    h('h2', { id: 'titulo-conta' }, 'Minha conta e privacidade'),
    h('p', { class: 'texto-suave' },
      'Guardamos apenas seu nome, telefone e e-mail para gerenciar seus agendamentos. '
      + 'Você pode excluir sua conta quando quiser.'),
    h('button', { type: 'button', class: 'botao botao--perigo', onclick: aoExcluir }, 'Excluir minha conta'));
}
