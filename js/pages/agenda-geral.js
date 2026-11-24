// =============================================================================
// Tela: Gerente — Agenda geral (RF07, RF09)
// Visão diária com os barbeiros lado a lado (uma coluna por barbeiro) e visão
// semanal (terça a sábado). Ao clicar num agendamento: concluir, cancelar ou
// trocar de barbeiro — todas as ações validadas pelas funções do banco.
// =============================================================================
import { listarTodosBarbeiros } from '../services/barbeiros.js';
import {
  cancelarAgendamento, concluirAgendamento, listarAgendamentosNoPeriodo, trocarBarbeiro,
} from '../services/agendamentos.js';
import { listarBloqueiosNoPeriodo } from '../services/bloqueios.js';
import { listarEscalas } from '../services/escalas.js';
import {
  criarEtiquetaStatus, duracaoTotal, nomesDosServicos, criarSeletorDeData,
} from '../utils/apresentacao.js';
import {
  dataISODe, diaAbertoMaisProximo, diaDaSemana, formatarData, formatarDataHora, formatarDuracao,
  formatarHora, hojeISO, horaCurta, horaDosMinutos, inicioDaSemanaDeTrabalho, minutosDaHora, minutosNoDia,
  partesDoDia, somarDias,
} from '../utils/datas.js';
import { formatarMoeda } from '../utils/moeda.js';
import {
  abrirModal, criarAviso, criarCabecalhoPagina, criarCarregando, criarVazio, h, mensagemDeErro,
  notificar, substituirConteudo,
} from '../utils/ui.js';
import { formatarTelefone } from '../utils/validacao.js';

const MINUTOS_POR_LINHA = 15;
const ALTURA_LINHA_PX = 22;
const DIAS_DA_SEMANA_DE_TRABALHO = 5; // terça a sábado

export async function montar(container, { parametros }) {
  container.append(criarCabecalhoPagina('Agenda geral'), criarCarregando());

  const [barbeiros, escalas] = await Promise.all([listarTodosBarbeiros(), listarEscalas()]);
  const estado = {
    visao: parametros.visao === 'semana' ? 'semana' : 'dia',
    dataISO: diaAbertoMaisProximo(parametros.data ?? hojeISO()),
  };
  let carregamento = 0;
  const areaAgenda = h('div');

  function renderizar() {
    const botaoVisao = (visao, texto) => h('button', {
      type: 'button',
      'aria-pressed': String(estado.visao === visao),
      onclick: () => { estado.visao = visao; renderizar(); },
    }, texto);

    const inicioSemana = inicioDaSemanaDeTrabalho(estado.dataISO);
    const rotulo = estado.visao === 'dia' ? undefined
      : `Semana de ${formatarData(inicioSemana)} a ${formatarData(somarDias(inicioSemana, DIAS_DA_SEMANA_DE_TRABALHO - 1))}`;

    substituirConteudo(container,
      criarCabecalhoPagina('Agenda geral', 'Clique em um agendamento para concluir, cancelar ou trocar o barbeiro.',
        h('div', { class: 'segmentos', role: 'group', 'aria-label': 'Visão' },
          botaoVisao('dia', 'Dia'), botaoVisao('semana', 'Semana'))),
      criarSeletorDeData({
        dataISO: estado.dataISO,
        salto: estado.visao === 'dia' ? 1 : 7,
        rotulo,
        aoMudar: (novaData) => { estado.dataISO = novaData; renderizar(); },
      }),
      areaAgenda);
    carregar();
  }

  async function carregar() {
    const atual = ++carregamento;
    const inicio = estado.visao === 'dia' ? estado.dataISO : inicioDaSemanaDeTrabalho(estado.dataISO);
    const fim = estado.visao === 'dia' ? estado.dataISO : somarDias(inicio, DIAS_DA_SEMANA_DE_TRABALHO - 1);
    substituirConteudo(areaAgenda, criarCarregando());
    try {
      const [agendamentos, bloqueios] = await Promise.all([
        listarAgendamentosNoPeriodo(inicio, fim),
        listarBloqueiosNoPeriodo(inicio, fim),
      ]);
      if (atual !== carregamento) return;
      const contexto = { barbeiros, escalas, agendamentos, bloqueios, aoAbrir: abrirDetalhes };
      substituirConteudo(areaAgenda, estado.visao === 'dia'
        ? renderizarVisaoDia(estado.dataISO, contexto)
        : renderizarVisaoSemana(inicio, contexto, (dataISO) => {
          estado.visao = 'dia';
          estado.dataISO = dataISO;
          renderizar();
        }));
    } catch (erro) {
      if (atual === carregamento) substituirConteudo(areaAgenda, criarAviso(mensagemDeErro(erro), 'erro'));
    }
  }

  async function abrirDetalhes(agendamento) {
    const alterado = await abrirModalDoAgendamento(agendamento, barbeiros);
    if (alterado) {
      notificar(alterado);
      carregar();
    }
  }

  renderizar();
  return undefined;
}

// =============================================================================
// Visão diária: colunas por barbeiro, linhas de 15 minutos
// =============================================================================
function renderizarVisaoDia(dataISO, { barbeiros, escalas, agendamentos, bloqueios, aoAbrir }) {
  const diaSemana = diaDaSemana(dataISO);
  const ativos = agendamentos.filter((a) => a.status !== 'cancelado');
  const cancelados = agendamentos.filter((a) => a.status === 'cancelado');
  const colunas = barbeiros.filter((b) => b.ativo || ativos.some((a) => a.barbeiro_id === b.id));

  if (!colunas.length) return criarVazio('Nenhum barbeiro ativo', 'Cadastre barbeiros na tela Equipe.');

  const escalasDoDia = escalas.filter((e) => e.dia_semana === diaSemana);
  const { inicioMin, fimMin } = limitesDoDia(escalasDoDia, ativos);
  const alturaTotal = ((fimMin - inicioMin) / MINUTOS_POR_LINHA) * ALTURA_LINHA_PX;
  const paraPx = (minutos) => ((minutos - inicioMin) / MINUTOS_POR_LINHA) * ALTURA_LINHA_PX;

  const colunaHoras = h('div', { class: 'agenda-dia__horas' });
  colunaHoras.style.height = `${alturaTotal}px`;
  for (let minuto = Math.ceil(inicioMin / 60) * 60; minuto < fimMin; minuto += 60) {
    colunaHoras.append(posicionar(h('span', { class: 'agenda-dia__hora' }, horaDosMinutos(minuto)), paraPx(minuto)));
  }

  const cabecalhos = colunas.map((barbeiro) => {
    const quantidade = ativos.filter((a) => a.barbeiro_id === barbeiro.id).length;
    return h('div', { class: `agenda-dia__cabecalho barbeiro--${barbeiro.nivel}` },
      h('strong', {}, barbeiro.nome), h('span', { class: 'texto-suave texto-pequeno' }, `${quantidade} atend.`));
  });

  const corpos = colunas.map((barbeiro) => {
    const coluna = h('div', { class: 'agenda-dia__coluna' });
    coluna.style.height = `${alturaTotal}px`;
    const escala = escalasDoDia.find((e) => e.barbeiro_id === barbeiro.id);

    // Fora do expediente / almoço / bloqueios (fundo) e agendamentos (frente).
    for (const faixa of faixasIndisponiveis(escala, inicioMin, fimMin)) {
      coluna.append(posicionar(h('div', { class: 'agenda-dia__indisponivel' }, faixa.texto),
        paraPx(faixa.inicio), paraPx(faixa.fim) - paraPx(faixa.inicio)));
    }
    for (const bloqueio of bloqueios.filter((b) => b.barbeiro_id === barbeiro.id)) {
      const inicio = Math.max(inicioMin, dataISODe(bloqueio.inicio) < dataISO ? inicioMin : minutosNoDia(bloqueio.inicio));
      const fim = Math.min(fimMin, dataISODe(bloqueio.fim) > dataISO ? fimMin : minutosNoDia(bloqueio.fim));
      if (fim > inicio) {
        coluna.append(posicionar(h('div', { class: 'agenda-dia__bloqueio', title: bloqueio.motivo }, bloqueio.motivo),
          paraPx(inicio), paraPx(fim) - paraPx(inicio)));
      }
    }
    for (const agendamento of ativos.filter((a) => a.barbeiro_id === barbeiro.id)) {
      const inicio = minutosNoDia(agendamento.inicio);
      const fim = inicio + duracaoTotal(agendamento);
      coluna.append(posicionar(h('button', {
        type: 'button',
        class: `agenda-dia__evento agenda-dia__evento--${agendamento.status}`,
        'aria-label': `${formatarHora(agendamento.inicio)}, ${agendamento.cliente?.nome}, ${nomesDosServicos(agendamento)}`,
        onclick: () => aoAbrir(agendamento),
      },
      h('strong', {}, `${formatarHora(agendamento.inicio)} ${agendamento.cliente?.nome ?? ''}`),
      h('span', {}, nomesDosServicos(agendamento))), paraPx(inicio), paraPx(fim) - paraPx(inicio)));
    }
    return coluna;
  });

  const grade = h('div', { class: 'agenda-dia', role: 'region', 'aria-label': 'Agenda do dia por barbeiro', tabindex: '0' },
    h('div', { class: 'agenda-dia__canto' }), cabecalhos, colunaHoras, corpos);
  grade.style.setProperty('--colunas', colunas.length);

  return h('div', {},
    escalasDoDia.length ? null : criarAviso('A barbearia não tem expediente cadastrado neste dia.', 'alerta'),
    h('div', { class: 'agenda-dia__rolagem' }, grade),
    h('p', { class: 'texto-suave texto-pequeno margem-topo' },
      'Faixas listradas: fora do expediente, almoço ou bloqueio. Cancelados não ocupam a agenda.'),
    cancelados.length
      ? h('details', { class: 'margem-topo' },
        h('summary', {}, `${cancelados.length} cancelado(s) neste dia`),
        h('ul', { class: 'lista margem-topo' }, cancelados.map((a) => h('li', { class: 'item-agenda item-agenda--cancelado' },
          `${formatarHora(a.inicio)} · ${a.barbeiro?.nome} · ${a.cliente?.nome} · ${nomesDosServicos(a)}`,
          a.motivo_cancelamento ? ` — ${a.motivo_cancelamento}` : ''))))
      : null);
}

/** Primeiro e último minuto exibidos: expediente do dia (ou 08–20h) e agendamentos fora dele. */
function limitesDoDia(escalasDoDia, agendamentos) {
  const inicios = escalasDoDia.map((e) => minutosDaHora(horaCurta(e.hora_inicio)));
  const fins = escalasDoDia.map((e) => minutosDaHora(horaCurta(e.hora_fim)));
  for (const a of agendamentos) {
    inicios.push(minutosNoDia(a.inicio));
    fins.push(minutosNoDia(a.inicio) + duracaoTotal(a));
  }
  const inicioMin = inicios.length ? Math.floor(Math.min(...inicios) / 60) * 60 : 8 * 60;
  const fimMin = fins.length ? Math.ceil(Math.max(...fins) / 60) * 60 : 20 * 60;
  return { inicioMin, fimMin };
}

function faixasIndisponiveis(escala, inicioMin, fimMin) {
  if (!escala) return [{ inicio: inicioMin, fim: fimMin, texto: 'Não trabalha' }];
  const faixas = [];
  const inicioExpediente = minutosDaHora(horaCurta(escala.hora_inicio));
  const fimExpediente = minutosDaHora(horaCurta(escala.hora_fim));
  if (inicioExpediente > inicioMin) faixas.push({ inicio: inicioMin, fim: inicioExpediente, texto: '' });
  if (fimExpediente < fimMin) faixas.push({ inicio: fimExpediente, fim: fimMin, texto: '' });
  if (escala.almoco_inicio) {
    faixas.push({
      inicio: minutosDaHora(horaCurta(escala.almoco_inicio)),
      fim: minutosDaHora(horaCurta(escala.almoco_fim)),
      texto: 'Almoço',
    });
  }
  return faixas;
}

function posicionar(elemento, topoPx, alturaPx = null) {
  elemento.style.top = `${topoPx}px`;
  if (alturaPx !== null) elemento.style.height = `${Math.max(alturaPx, ALTURA_LINHA_PX)}px`;
  return elemento;
}

// =============================================================================
// Visão semanal: terça a sábado, lista compacta por dia
// =============================================================================
function renderizarVisaoSemana(inicioSemana, { agendamentos, aoAbrir }, aoEscolherDia) {
  const dias = Array.from({ length: DIAS_DA_SEMANA_DE_TRABALHO }, (_, i) => somarDias(inicioSemana, i));

  return h('div', { class: 'agenda-semana' }, dias.map((dataISO) => {
    const doDia = agendamentos.filter((a) => dataISODe(a.inicio) === dataISO);
    const ativos = doDia.filter((a) => a.status !== 'cancelado');
    const partes = partesDoDia(dataISO);

    return h('section', { class: 'agenda-semana__dia', 'aria-label': formatarData(dataISO) },
      h('button', {
        type: 'button',
        class: 'agenda-semana__titulo',
        onclick: () => aoEscolherDia(dataISO),
        title: 'Abrir a visão diária',
      },
      h('strong', {}, `${partes.semana} ${partes.dia}/${dataISO.slice(5, 7)}`),
      h('span', { class: 'texto-suave texto-pequeno' },
        `${ativos.length} atend.${doDia.length > ativos.length ? ` · ${doDia.length - ativos.length} canc.` : ''}`)),
      ativos.length
        ? h('ul', { class: 'agenda-semana__lista' }, ativos.map((a) => h('li', {},
          h('button', {
            type: 'button',
            class: `agenda-semana__item barbeiro--${a.barbeiro?.nivel}`,
            onclick: () => aoAbrir(a),
          },
          h('strong', {}, formatarHora(a.inicio)),
          h('span', {}, `${a.barbeiro?.nome?.replace('Barbeiro ', '')} · ${a.cliente?.nome ?? ''}`),
          a.status === 'concluido' ? h('span', { class: 'texto-pequeno texto-suave' }, 'concluído') : null))))
        : h('p', { class: 'texto-suave texto-pequeno' }, 'Sem agendamentos'));
  }));
}

// =============================================================================
// Modal de detalhes com as ações do gerente
// =============================================================================
async function abrirModalDoAgendamento(agendamento, barbeiros) {
  const confirmado = agendamento.status === 'confirmado';
  const jaComecou = new Date(agendamento.inicio) <= new Date();

  const outrosBarbeiros = barbeiros.filter((b) => b.ativo && b.id !== agendamento.barbeiro_id);
  const seletorBarbeiro = h('select', { id: 'novo-barbeiro' },
    outrosBarbeiros.map((b) => h('option', { value: b.id }, b.nome)));
  const motivo = h('textarea', { id: 'motivo-gerente', maxlength: 300, placeholder: 'Opcional' });

  const detalhes = h('dl', { class: 'resumo' },
    linha('Quando', `${formatarDataHora(agendamento.inicio)} (${formatarDuracao(duracaoTotal(agendamento))})`),
    linha('Barbeiro', agendamento.barbeiro?.nome ?? ''),
    linha('Cliente', agendamento.cliente?.nome ?? ''),
    linha('Telefone', agendamento.cliente?.telefone ? formatarTelefone(agendamento.cliente.telefone) : '—'),
    linha('Serviços', nomesDosServicos(agendamento)),
    linha('Valor', formatarMoeda(agendamento.valor_total)),
    h('div', { class: 'resumo__linha' }, h('dt', {}, 'Situação'), h('dd', {}, criarEtiquetaStatus(agendamento.status))));

  const podeTrocar = confirmado && !jaComecou && outrosBarbeiros.length > 0;
  const conteudo = [detalhes];
  if (podeTrocar) {
    conteudo.push(h('div', { class: 'campo' }, h('label', { for: 'novo-barbeiro' }, 'Trocar para'), seletorBarbeiro));
  }
  if (confirmado) {
    conteudo.push(h('div', { class: 'campo' }, h('label', { for: 'motivo-gerente' }, 'Motivo do cancelamento'), motivo));
  }

  const acoes = [{ texto: 'Fechar', classe: 'botao--secundario', valor: null }];
  if (confirmado) {
    acoes.push({
      texto: 'Cancelar agendamento',
      classe: 'botao--perigo',
      aoConfirmar: async () => {
        await cancelarAgendamento(agendamento.id, motivo.value.trim());
        return 'Agendamento cancelado.';
      },
    });
  }
  if (podeTrocar) {
    acoes.push({
      texto: 'Trocar barbeiro',
      classe: 'botao--secundario',
      aoConfirmar: async () => {
        await trocarBarbeiro(agendamento.id, seletorBarbeiro.value);
        return `Agendamento transferido para ${seletorBarbeiro.selectedOptions[0].textContent}.`;
      },
    });
  }
  if (confirmado && jaComecou) {
    acoes.push({
      texto: 'Concluir',
      aoConfirmar: async () => {
        await concluirAgendamento(agendamento.id);
        return 'Atendimento concluído.';
      },
    });
  }

  return abrirModal({ titulo: 'Agendamento', conteudo, acoes });
}

function linha(rotulo, valor) {
  return h('div', { class: 'resumo__linha' }, h('dt', {}, rotulo), h('dd', {}, valor));
}
