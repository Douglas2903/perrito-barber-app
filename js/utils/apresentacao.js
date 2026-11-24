// =============================================================================
// Apresentação de agendamentos, reaproveitada pelas telas de cliente,
// barbeiro e gerente (evita duplicar a montagem do "cartão" de agendamento).
// =============================================================================
import {
  diaAbertoMaisProximo, formatarData, formatarDataComDiaSemana, formatarDuracao, formatarHora, hojeISO,
  proximoDiaAberto, somarDias,
} from './datas.js';
import { formatarMoeda } from './moeda.js';
import { h } from './ui.js';
import { formatarTelefone } from './validacao.js';

export const ROTULOS_STATUS = {
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export function criarEtiquetaStatus(status) {
  return h('span', { class: `etiqueta etiqueta--${status}` }, ROTULOS_STATUS[status] ?? status);
}

export function nomesDosServicos(agendamento) {
  return (agendamento.itens ?? []).map((item) => item.servico?.nome ?? 'Serviço').join(' + ');
}

export function duracaoTotal(agendamento) {
  return (agendamento.itens ?? []).reduce((total, item) => total + item.duracao_min, 0);
}

/**
 * Cartão de um agendamento.
 * opcoes: { mostrarData, mostrarCliente, mostrarBarbeiro, acoes: [Node] }
 */
export function criarItemAgendamento(agendamento, opcoes = {}) {
  const { mostrarData = true, mostrarCliente = false, mostrarBarbeiro = true, acoes = [] } = opcoes;
  const horario = `${formatarHora(agendamento.inicio)} – ${formatarHora(agendamento.fim)}`;

  return h('li', { class: `item-agenda item-agenda--${agendamento.status}` },
    h('div', { class: 'item-agenda__topo' },
      h('div', {},
        mostrarData ? h('div', { class: 'item-agenda__linha' }, formatarData(agendamento.inicio)) : null,
        h('div', { class: 'item-agenda__hora' }, horario)),
      criarEtiquetaStatus(agendamento.status)),
    h('div', {}, h('strong', {}, nomesDosServicos(agendamento))),
    h('div', { class: 'item-agenda__linha' },
      `${formatarDuracao(duracaoTotal(agendamento))} · ${formatarMoeda(agendamento.valor_total)}`),
    mostrarBarbeiro && agendamento.barbeiro
      ? h('div', { class: 'item-agenda__linha' }, `Barbeiro: ${agendamento.barbeiro.nome}`) : null,
    mostrarCliente && agendamento.cliente
      ? h('div', { class: 'item-agenda__linha' },
        `Cliente: ${agendamento.cliente.nome}`,
        agendamento.cliente.telefone ? ' · ' : '',
        agendamento.cliente.telefone
          ? h('a', { href: `tel:${agendamento.cliente.telefone}` }, formatarTelefone(agendamento.cliente.telefone))
          : null)
      : null,
    agendamento.status === 'cancelado' && agendamento.motivo_cancelamento
      ? h('div', { class: 'item-agenda__linha' }, `Motivo: ${agendamento.motivo_cancelamento}`) : null,
    acoes.length ? h('div', { class: 'grupo-botoes' }, ...acoes) : null);
}

/**
 * Navegação entre dias de funcionamento: anterior, hoje, próximo e escolha
 * direta. Domingos e segundas são pulados (barbearia fechada).
 * "salto" permite andar de semana em semana (salto = 7).
 */
export function criarSeletorDeData({ dataISO, aoMudar, salto = 1, rotulo = formatarDataComDiaSemana(dataISO) }) {
  const andar = (direcao) => {
    const destino = salto === 1
      ? proximoDiaAberto(dataISO, direcao)
      : diaAbertoMaisProximo(somarDias(dataISO, salto * direcao));
    aoMudar(destino);
  };

  // O campo nativo fica oculto: o formato exibido por ele depende do idioma
  // do navegador. A data é sempre mostrada pelo app em dd/mm/aaaa.
  const campoData = h('input', {
    type: 'date',
    value: dataISO,
    tabindex: '-1',
    'aria-hidden': 'true',
    class: 'seletor-data__campo',
    onchange: (evento) => evento.target.value && aoMudar(diaAbertoMaisProximo(evento.target.value)),
  });
  const abrirCalendario = () => {
    if (typeof campoData.showPicker === 'function') campoData.showPicker();
    else campoData.click();
  };

  return h('div', { class: 'seletor-data' },
    h('button', { type: 'button', class: 'botao botao--secundario', 'aria-label': 'Anterior', onclick: () => andar(-1) }, '‹'),
    h('div', { class: 'seletor-data__centro' },
      h('strong', { class: 'seletor-data__rotulo', 'aria-live': 'polite' }, rotulo),
      h('div', { class: 'seletor-data__extras' },
        h('button', { type: 'button', class: 'botao botao--fantasma botao--pequeno', onclick: () => aoMudar(diaAbertoMaisProximo(hojeISO())) }, 'Hoje'),
        h('button', { type: 'button', class: 'botao botao--fantasma botao--pequeno', onclick: abrirCalendario }, 'Ir para data'),
        campoData)),
    h('button', { type: 'button', class: 'botao botao--secundario', 'aria-label': 'Próximo', onclick: () => andar(1) }, '›'));
}

