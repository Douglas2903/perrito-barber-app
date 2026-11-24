// =============================================================================
// Tela: Barbeiro — Minha agenda (RF08)
// Pensada para celular (360–414 px): um dia por vez, botões grandes, ligação
// direta para o cliente. Mostra SOMENTE os atendimentos do próprio barbeiro
// (garantido pela RLS no banco, não por filtro do front-end).
// =============================================================================
import { buscarBarbeiroDoUsuario } from '../services/barbeiros.js';
import { concluirAgendamento, listarAgendamentosNoPeriodo } from '../services/agendamentos.js';
import { listarBloqueiosNoPeriodo } from '../services/bloqueios.js';
import { listarEscalas } from '../services/escalas.js';
import { criarItemAgendamento, criarSeletorDeData } from '../utils/apresentacao.js';
import { diaAbertoMaisProximo, diaDaSemana, formatarHora, horaCurta, hojeISO } from '../utils/datas.js';
import { formatarMoeda, somarValores } from '../utils/moeda.js';
import {
  comBotaoOcupado, criarAviso, criarCabecalhoPagina, criarCarregando, criarVazio, h, mensagemDeErro,
  notificar, substituirConteudo,
} from '../utils/ui.js';

export async function montar(container, { perfil, parametros }) {
  container.append(criarCabecalhoPagina('Minha agenda'), criarCarregando());

  const barbeiro = await buscarBarbeiroDoUsuario(perfil.id);
  if (!barbeiro) {
    substituirConteudo(container, criarCabecalhoPagina('Minha agenda'),
      criarAviso('Seu usuário ainda não está vinculado a um barbeiro. Fale com o gerente.', 'alerta'));
    return undefined;
  }

  const escalas = await listarEscalas(barbeiro.id);
  let dataISO = parametros.data ?? diaAbertoMaisProximo(hojeISO());
  let carregamento = 0;
  const areaDia = h('div');

  function mudarData(novaData) {
    dataISO = novaData;
    renderizarCabecalho();
    carregarDia();
  }

  function renderizarCabecalho() {
    substituirConteudo(container,
      criarCabecalhoPagina('Minha agenda', `${barbeiro.nome} · somente os seus atendimentos`),
      criarSeletorDeData({ dataISO, aoMudar: mudarData }),
      areaDia);
  }

  async function carregarDia() {
    const atual = ++carregamento;
    substituirConteudo(areaDia, criarCarregando());
    try {
      const [agendamentos, bloqueios] = await Promise.all([
        listarAgendamentosNoPeriodo(dataISO, dataISO),
        listarBloqueiosNoPeriodo(dataISO, dataISO, { barbeiroId: barbeiro.id }),
      ]);
      if (atual !== carregamento) return;
      substituirConteudo(areaDia, ...renderizarDia(agendamentos, bloqueios));
    } catch (erro) {
      if (atual === carregamento) substituirConteudo(areaDia, criarAviso(mensagemDeErro(erro), 'erro'));
    }
  }

  async function concluir(agendamento, botao) {
    try {
      await comBotaoOcupado(botao, () => concluirAgendamento(agendamento.id));
      notificar(`Atendimento das ${formatarHora(agendamento.inicio)} concluído.`);
      carregarDia();
    } catch (erro) {
      notificar(mensagemDeErro(erro), 'erro');
    }
  }

  function renderizarDia(agendamentos, bloqueios) {
    const escala = escalas.find((e) => e.dia_semana === diaDaSemana(dataISO));
    const ativos = agendamentos.filter((a) => a.status !== 'cancelado');
    const previsto = somarValores(ativos.map((a) => a.valor_total));

    const resumo = h('div', { class: 'resumo-dia' },
      escala
        ? h('span', {}, 'Expediente ', h('strong', {}, `${horaCurta(escala.hora_inicio)}–${horaCurta(escala.hora_fim)}`),
          escala.almoco_inicio ? ` · almoço ${horaCurta(escala.almoco_inicio)}–${horaCurta(escala.almoco_fim)}` : '')
        : h('span', {}, h('strong', {}, 'Você não trabalha neste dia')),
      h('span', {}, h('strong', {}, String(ativos.length)), ' atendimento(s)'),
      h('span', {}, 'Previsto ', h('strong', {}, formatarMoeda(previsto))));

    // Agendamentos e bloqueios em ordem cronológica numa única lista.
    const eventos = [
      ...agendamentos.map((a) => ({ inicio: a.inicio, no: criarCartao(a) })),
      ...bloqueios.map((b) => ({ inicio: b.inicio, no: criarItemBloqueio(b) })),
    ].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

    return [
      resumo,
      eventos.length
        ? h('ul', { class: 'lista' }, eventos.map((e) => e.no))
        : criarVazio('Nenhum atendimento neste dia', 'Use as setas para ver outros dias.'),
      h('div', { class: 'margem-topo' },
        h('button', { type: 'button', class: 'botao botao--fantasma botao--bloco', onclick: carregarDia }, 'Atualizar')),
    ];
  }

  function criarCartao(agendamento) {
    const podeConcluir = agendamento.status === 'confirmado' && new Date(agendamento.inicio) <= new Date();
    return criarItemAgendamento(agendamento, {
      mostrarData: false,
      mostrarCliente: true,
      mostrarBarbeiro: false,
      acoes: podeConcluir
        ? [h('button', {
          type: 'button',
          class: 'botao botao--bloco',
          onclick: (evento) => concluir(agendamento, evento.currentTarget),
        }, 'Marcar como concluído')]
        : [],
    });
  }

  renderizarCabecalho();
  carregarDia();
  return undefined;
}

function criarItemBloqueio(bloqueio) {
  return h('li', { class: 'item-bloqueio' },
    h('strong', {}, `${formatarHora(bloqueio.inicio)} – ${formatarHora(bloqueio.fim)} · Indisponível`),
    h('div', {}, bloqueio.motivo));
}
