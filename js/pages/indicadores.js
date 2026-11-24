// =============================================================================
// Tela: Gerente — Indicadores (RF10)
// Por barbeiro e por período: atendimentos realizados (concluídos),
// cancelamentos e faturamento (soma dos valores congelados dos concluídos).
// =============================================================================
import { buscarIndicadores } from '../services/indicadores.js';
import { formatarData, hojeISO, somarDias } from '../utils/datas.js';
import { formatarMoeda, somarValores } from '../utils/moeda.js';
import {
  criarAviso, criarCabecalhoPagina, criarCampo, criarCarregando, criarVazio, h, mensagemDeErro,
  substituirConteudo,
} from '../utils/ui.js';

/** Períodos prontos. Cada um devolve [dataInicialISO, dataFinalISO]. */
const PERIODOS = {
  semana: { rotulo: 'Últimos 7 dias', calcular: (hoje) => [somarDias(hoje, -6), hoje] },
  mes: { rotulo: 'Este mês', calcular: (hoje) => [`${hoje.slice(0, 8)}01`, hoje] },
  mesPassado: {
    rotulo: 'Mês passado',
    calcular: (hoje) => {
      const ultimoDiaMesPassado = somarDias(`${hoje.slice(0, 8)}01`, -1);
      return [`${ultimoDiaMesPassado.slice(0, 8)}01`, ultimoDiaMesPassado];
    },
  },
  personalizado: { rotulo: 'Personalizado', calcular: null },
};

export function montar(container) {
  const hoje = hojeISO();
  const estado = { periodo: 'mes', inicio: PERIODOS.mes.calcular(hoje)[0], fim: hoje };

  const areaFiltros = h('div', { class: 'filtros' });
  const areaResultado = h('div');
  container.append(
    criarCabecalhoPagina('Indicadores', 'Atendimentos realizados, cancelamentos e faturamento por barbeiro.'),
    areaFiltros,
    areaResultado);

  function escolherPeriodo(chave) {
    estado.periodo = chave;
    if (PERIODOS[chave].calcular) [estado.inicio, estado.fim] = PERIODOS[chave].calcular(hoje);
    renderizarFiltros();
    if (PERIODOS[chave].calcular) carregar();
  }

  function renderizarFiltros() {
    const botoes = Object.entries(PERIODOS).map(([chave, periodo]) => h('button', {
      type: 'button',
      'aria-pressed': String(estado.periodo === chave),
      onclick: () => escolherPeriodo(chave),
    }, periodo.rotulo));

    const personalizado = estado.periodo === 'personalizado' ? criarFormularioPeriodo() : null;
    substituirConteudo(areaFiltros,
      h('div', { class: 'segmentos segmentos--rolagem', role: 'group', 'aria-label': 'Período' }, botoes),
      personalizado);
  }

  function criarFormularioPeriodo() {
    const inicio = criarCampo({ id: 'indicador-inicio', rotulo: 'De', atributos: { type: 'date', value: estado.inicio, max: hoje } });
    const fim = criarCampo({ id: 'indicador-fim', rotulo: 'Até', atributos: { type: 'date', value: estado.fim, max: hoje } });
    return h('form', {
      class: 'linha-campos margem-topo',
      onsubmit: (evento) => {
        evento.preventDefault();
        estado.inicio = inicio.controle.value;
        estado.fim = fim.controle.value;
        carregar();
      },
    }, inicio.elemento, fim.elemento,
    h('div', { class: 'campo campo--botao' }, h('button', { type: 'submit', class: 'botao' }, 'Aplicar')));
  }

  async function carregar() {
    if (!estado.inicio || !estado.fim) {
      substituirConteudo(areaResultado, criarAviso('Informe as duas datas do período.', 'alerta'));
      return;
    }
    substituirConteudo(areaResultado, criarCarregando());
    try {
      const linhas = await buscarIndicadores(estado.inicio, estado.fim);
      substituirConteudo(areaResultado, renderizarResultado(linhas));
    } catch (erro) {
      substituirConteudo(areaResultado, criarAviso(mensagemDeErro(erro), 'erro'));
    }
  }

  function renderizarResultado(linhas) {
    const titulo = h('h2', { class: 'margem-topo' }, `De ${formatarData(estado.inicio)} a ${formatarData(estado.fim)}`);
    if (!linhas.length) return h('div', {}, titulo, criarVazio('Sem dados no período'));

    const total = {
      realizados: linhas.reduce((soma, l) => soma + l.realizados, 0),
      cancelados: linhas.reduce((soma, l) => soma + l.cancelados, 0),
      faturamento: somarValores(linhas.map((l) => l.faturamento)),
    };

    return h('div', {},
      titulo,
      h('div', { class: 'tabela-rolagem' }, h('table', { class: 'tabela' },
        h('caption', { class: 'visualmente-oculto' }, 'Indicadores por barbeiro no período'),
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, 'Barbeiro'),
          h('th', { scope: 'col', class: 'numero' }, 'Realizados'),
          h('th', { scope: 'col', class: 'numero' }, 'Cancelamentos'),
          h('th', { scope: 'col', class: 'numero' }, 'Faturamento'))),
        h('tbody', {}, linhas.map((l) => h('tr', {},
          h('th', { scope: 'row' }, l.barbeiro_nome),
          h('td', { class: 'numero' }, String(l.realizados)),
          h('td', { class: 'numero' }, String(l.cancelados)),
          h('td', { class: 'numero' }, formatarMoeda(l.faturamento))))),
        h('tfoot', {}, h('tr', {},
          h('th', { scope: 'row' }, 'Total'),
          h('td', { class: 'numero' }, h('strong', {}, String(total.realizados))),
          h('td', { class: 'numero' }, h('strong', {}, String(total.cancelados))),
          h('td', { class: 'numero' }, h('strong', { class: 'texto-destaque' }, formatarMoeda(total.faturamento))))))),
      h('p', { class: 'texto-suave texto-pequeno margem-topo' },
        'Realizados = atendimentos marcados como concluídos. Faturamento = soma dos valores cobrados nesses atendimentos '
        + '(preço do momento do agendamento). Agendamentos ainda confirmados não entram no faturamento.'));
  }

  renderizarFiltros();
  carregar();
}
