// =============================================================================
// Apresentação de agendamentos, reaproveitada pelas telas de cliente,
// barbeiro e gerente (evita duplicar a montagem do "cartão" de agendamento).
// =============================================================================
import { formatarData, formatarDuracao, formatarHora } from './datas.js';
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
