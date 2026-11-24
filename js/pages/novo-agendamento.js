// =============================================================================
// Tela: Cliente — Novo agendamento (RF04, RF05, RF06)
// Fluxo em 5 passos: serviços → barbeiro → data → horário → confirmação.
// O front-end só exibe e chama: disponibilidade, preço final e escolha do
// barbeiro ("qualquer profissional") são decididos pelo banco.
// =============================================================================
import { navegar } from '../router.js';
import { NIVEIS, listarBarbeirosAtivos } from '../services/barbeiros.js';
import { buscarHorariosDisponiveis, criarAgendamento } from '../services/agendamentos.js';
import { listarServicosAtivos } from '../services/servicos.js';
import {
  abreNoDia, formatarData, formatarDataComDiaSemana, formatarDuracao, formatarHora, hojeISO,
  partesDoDia, somarDias,
} from '../utils/datas.js';
import { formatarMoeda, somarValores } from '../utils/moeda.js';
import {
  comBotaoOcupado, criarAviso, criarCabecalhoPagina, criarCarregando, criarVazio, h, mensagemDeErro,
  notificar, substituirConteudo,
} from '../utils/ui.js';

const PASSOS = ['Serviços', 'Barbeiro', 'Data', 'Horário', 'Confirmação'];
const QUALQUER_PROFISSIONAL = 'qualquer';
const DIAS_DE_ANTECEDENCIA = 60; // mesmo limite validado no banco
const MENSAGEM_HORARIO_OCUPADO = 'Esse horário acabou de ser ocupado. Escolha outro.';

export async function montar(container) {
  container.append(criarCabecalhoPagina('Novo agendamento'), criarCarregando());

  const [servicos, barbeiros] = await Promise.all([listarServicosAtivos(), listarBarbeirosAtivos()]);
  if (!servicos.length || !barbeiros.length) {
    substituirConteudo(container, criarCabecalhoPagina('Novo agendamento'),
      criarVazio('Agendamento indisponível no momento', 'Não há serviços ou barbeiros ativos. Tente mais tarde.'));
    return undefined;
  }

  const diasDisponiveis = listarDiasDeFuncionamento();
  const estado = {
    passo: 0,
    servicoIds: [],
    barbeiroId: QUALQUER_PROFISSIONAL,
    dataISO: diasDisponiveis[0],
    horario: null, // { inicio, barbeiro_id, barbeiro_nome }
    horarios: [],
    mensagem: null, // { texto, tipo }
  };
  let consultaHorarios = 0;
  let ativo = true;

  // ----------------------------------------------------------------- cálculo
  const servicosEscolhidos = () => servicos.filter((s) => estado.servicoIds.includes(s.id));
  const duracaoEscolhida = () => servicosEscolhidos().reduce((total, s) => total + s.duracao_min, 0);
  const valorEscolhido = () => somarValores(servicosEscolhidos().map((s) => s.preco));
  const nomeDoBarbeiro = (id) => barbeiros.find((b) => b.id === id)?.nome ?? '';

  function passoValido(passo) {
    if (passo === 0) return estado.servicoIds.length > 0;
    if (passo === 1) return Boolean(estado.barbeiroId);
    if (passo === 2) return Boolean(estado.dataISO);
    if (passo === 3) return Boolean(estado.horario);
    return true;
  }

  // ------------------------------------------------------------ alterações
  function irPara(passo, mensagem = null) {
    estado.passo = passo;
    estado.mensagem = mensagem;
    renderizar();
    document.getElementById('titulo-passo')?.focus();
    if (passo === 3) carregarHorarios();
  }

  function alterarSelecao(mudanca) {
    mudanca();
    estado.horario = null; // qualquer mudança anterior invalida o horário escolhido
    renderizar();
  }

  async function carregarHorarios() {
    const consulta = ++consultaHorarios;
    estado.horarios = null;
    renderizar();
    try {
      const horarios = await buscarHorariosDisponiveis({
        dataISO: estado.dataISO,
        servicoIds: estado.servicoIds,
        barbeiroId: estado.barbeiroId === QUALQUER_PROFISSIONAL ? null : estado.barbeiroId,
      });
      if (!ativo || consulta !== consultaHorarios) return;
      estado.horarios = horarios;
    } catch (erro) {
      if (!ativo || consulta !== consultaHorarios) return;
      estado.horarios = [];
      estado.mensagem = { texto: mensagemDeErro(erro), tipo: 'erro' };
    }
    renderizar();
  }

  async function confirmar(botao) {
    try {
      await comBotaoOcupado(botao, () => criarAgendamento({
        inicio: estado.horario.inicio,
        servicoIds: estado.servicoIds,
        barbeiroId: estado.barbeiroId === QUALQUER_PROFISSIONAL ? null : estado.barbeiroId,
      }));
      notificar(`Agendamento confirmado para ${formatarData(estado.horario.inicio)} às ${formatarHora(estado.horario.inicio)}.`);
      navegar('/meus-agendamentos');
    } catch (erro) {
      if (erro.code === '23P01' || /ocupado/i.test(erro.message ?? '')) {
        // Outra pessoa reservou o horário nesse meio-tempo: volta e recarrega.
        estado.horario = null;
        irPara(3, { texto: MENSAGEM_HORARIO_OCUPADO, tipo: 'alerta' });
        return;
      }
      estado.mensagem = { texto: mensagemDeErro(erro), tipo: 'erro' };
      renderizar();
    }
  }

  // ------------------------------------------------------------ renderização
  function renderizar() {
    const tituloPasso = h('h2', { id: 'titulo-passo', tabindex: '-1' },
      `${estado.passo + 1}. ${PASSOS[estado.passo]}`);

    substituirConteudo(container,
      criarCabecalhoPagina('Novo agendamento', `Passo ${estado.passo + 1} de ${PASSOS.length}`),
      criarIndicadorDePassos(estado.passo),
      tituloPasso,
      estado.mensagem ? criarAviso(estado.mensagem.texto, estado.mensagem.tipo) : null,
      renderizarPasso(),
      criarBarraDeAcoes());
  }

  function renderizarPasso() {
    switch (estado.passo) {
      case 0: return renderizarServicos();
      case 1: return renderizarBarbeiros();
      case 2: return renderizarDatas();
      case 3: return renderizarHorarios();
      default: return renderizarConfirmacao();
    }
  }

  function renderizarServicos() {
    return h('fieldset', { class: 'opcoes fieldset-limpo' },
      h('legend', { class: 'visualmente-oculto' }, 'Escolha um ou mais serviços'),
      servicos.map((servico) => h('label', { class: 'opcao' },
        h('input', {
          type: 'checkbox',
          value: servico.id,
          checked: estado.servicoIds.includes(servico.id),
          onchange: (evento) => alterarSelecao(() => {
            estado.servicoIds = evento.target.checked
              ? [...estado.servicoIds, servico.id]
              : estado.servicoIds.filter((id) => id !== servico.id);
          }),
        }),
        h('span', { class: 'opcao__texto' },
          h('span', { class: 'opcao__titulo' }, servico.nome),
          h('span', { class: 'opcao__detalhe' }, formatarDuracao(servico.duracao_min))),
        h('strong', {}, formatarMoeda(servico.preco)))));
  }

  function renderizarBarbeiros() {
    const opcoes = [
      { id: QUALQUER_PROFISSIONAL, titulo: 'Qualquer profissional', detalhe: 'Mais horários: o primeiro barbeiro livre' },
      ...barbeiros.map((b) => ({ id: b.id, titulo: b.nome, detalhe: `Nível ${NIVEIS[b.nivel]}` })),
    ];
    return h('fieldset', { class: 'opcoes fieldset-limpo' },
      h('legend', { class: 'visualmente-oculto' }, 'Escolha o barbeiro'),
      opcoes.map((opcao) => h('label', { class: 'opcao' },
        h('input', {
          type: 'radio',
          name: 'barbeiro',
          value: opcao.id,
          checked: estado.barbeiroId === opcao.id,
          onchange: () => alterarSelecao(() => { estado.barbeiroId = opcao.id; }),
        }),
        h('span', { class: 'opcao__texto' },
          h('span', { class: 'opcao__titulo' }, opcao.titulo),
          h('span', { class: 'opcao__detalhe' }, opcao.detalhe)))));
  }

  function renderizarDatas() {
    return h('div', {},
      h('p', { class: 'texto-suave texto-pequeno' },
        'Atendemos de terça a sexta, das 10h às 20h, e aos sábados, das 8h às 19h.'),
      h('div', { class: 'faixa-dias', role: 'group', 'aria-label': 'Datas disponíveis' },
        diasDisponiveis.map((dataISO) => {
          const partes = partesDoDia(dataISO);
          return h('button', {
            type: 'button',
            class: 'dia',
            'aria-pressed': String(estado.dataISO === dataISO),
            'aria-label': formatarDataComDiaSemana(dataISO),
            onclick: () => alterarSelecao(() => { estado.dataISO = dataISO; }),
          },
          h('span', { class: 'dia__semana' }, dataISO === hojeISO() ? 'Hoje' : partes.semana),
          h('span', { class: 'dia__numero' }, partes.dia),
          h('span', { class: 'dia__mes' }, partes.mes));
        })),
      h('p', {}, 'Data escolhida: ', h('strong', {}, formatarDataComDiaSemana(estado.dataISO))));
  }

  function renderizarHorarios() {
    const cabecalho = h('p', { class: 'texto-suave' }, formatarDataComDiaSemana(estado.dataISO),
      ` · duração ${formatarDuracao(duracaoEscolhida())}`);

    if (estado.horarios === null) return h('div', {}, cabecalho, criarCarregando('Buscando horários livres…'));
    if (!estado.horarios.length) {
      return h('div', {}, cabecalho, criarVazio('Nenhum horário livre neste dia',
        'Volte e escolha outra data ou "Qualquer profissional".'));
    }

    return h('div', {}, cabecalho,
      h('div', { class: 'grade-horarios', role: 'group', 'aria-label': 'Horários livres' },
        estado.horarios.map((horario) => h('button', {
          type: 'button',
          class: 'horario',
          'aria-pressed': String(estado.horario?.inicio === horario.inicio),
          onclick: () => { estado.horario = horario; renderizar(); },
        }, formatarHora(horario.inicio)))),
      estado.horario && estado.barbeiroId === QUALQUER_PROFISSIONAL
        ? h('p', { class: 'texto-suave margem-topo' },
          `Às ${formatarHora(estado.horario.inicio)} você será atendido por ${estado.horario.barbeiro_nome}.`)
        : null);
  }

  function renderizarConfirmacao() {
    const barbeiro = estado.barbeiroId === QUALQUER_PROFISSIONAL
      ? `${estado.horario.barbeiro_nome} (qualquer profissional)`
      : nomeDoBarbeiro(estado.barbeiroId);

    return h('div', { class: 'cartao' },
      h('dl', { class: 'resumo' },
        criarLinhaResumo('Data', formatarDataComDiaSemana(estado.dataISO)),
        criarLinhaResumo('Horário', `${formatarHora(estado.horario.inicio)} (duração ${formatarDuracao(duracaoEscolhida())})`),
        criarLinhaResumo('Barbeiro', barbeiro),
        criarLinhaResumo('Local', 'Rua Luís Góis, 322 · São Paulo (SP)')),
      h('table', { class: 'tabela margem-topo' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Serviço'), h('th', { class: 'numero' }, 'Valor'))),
        h('tbody', {},
          servicosEscolhidos().map((s) => h('tr', {},
            h('td', {}, s.nome), h('td', { class: 'numero' }, formatarMoeda(s.preco)))),
          h('tr', {}, h('td', {}, h('strong', {}, 'Total a pagar na barbearia')),
            h('td', { class: 'numero' }, h('strong', { class: 'texto-destaque' }, formatarMoeda(valorEscolhido())))))),
      h('p', { class: 'texto-suave texto-pequeno margem-topo' },
        'O valor fica garantido mesmo que a tabela de preços mude. O pagamento é feito na barbearia.'));
  }

  function criarBarraDeAcoes() {
    const ultimoPasso = estado.passo === PASSOS.length - 1;
    const botaoVoltar = estado.passo > 0
      ? h('button', { type: 'button', class: 'botao botao--secundario', onclick: () => irPara(estado.passo - 1) }, 'Voltar')
      : null;
    const botaoAvancar = h('button', {
      type: 'button',
      class: 'botao',
      disabled: !passoValido(estado.passo),
      onclick: (evento) => (ultimoPasso ? confirmar(evento.currentTarget) : irPara(estado.passo + 1)),
    }, ultimoPasso ? 'Confirmar agendamento' : 'Continuar');

    const quantidade = estado.servicoIds.length;
    return h('div', { class: 'barra-acoes' },
      h('div', { class: 'barra-acoes__resumo', 'aria-live': 'polite' },
        h('span', { class: 'texto-suave' },
          quantidade ? `${quantidade} serviço(s) · ${formatarDuracao(duracaoEscolhida())}` : 'Nenhum serviço escolhido'),
        h('strong', {}, formatarMoeda(valorEscolhido()))),
      h('div', { class: 'grupo-botoes' }, botaoVoltar, botaoAvancar));
  }

  renderizar();
  return () => { ativo = false; };
}

// -----------------------------------------------------------------------------
function listarDiasDeFuncionamento() {
  const hoje = hojeISO();
  const dias = [];
  for (let i = 0; i <= DIAS_DE_ANTECEDENCIA; i += 1) {
    const dataISO = somarDias(hoje, i);
    if (abreNoDia(dataISO)) dias.push(dataISO);
  }
  return dias;
}

function criarIndicadorDePassos(passoAtual) {
  return h('ol', { class: 'passos', 'aria-hidden': 'true' },
    PASSOS.map((_, indice) => h('li', {
      dataset: { estado: indice < passoAtual ? 'feito' : indice === passoAtual ? 'atual' : 'pendente' },
    })));
}

function criarLinhaResumo(rotulo, valor) {
  return h('div', { class: 'resumo__linha' }, h('dt', {}, rotulo), h('dd', {}, valor));
}
