// =============================================================================
// Datas e horas — sempre exibidas no fuso America/Sao_Paulo, qualquer que seja
// o fuso do aparelho do usuário.
//
// Convenção: "dataISO" é uma data pura no formato AAAA-MM-DD (sem hora/fuso).
// Instantes (timestamptz do banco) chegam como string ISO com fuso.
// =============================================================================

export const FUSO_HORARIO = 'America/Sao_Paulo';

export const NOMES_DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const NOMES_DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Dias em que a barbearia abre (0 = domingo … 6 = sábado): terça a sábado.
export const DIAS_DE_FUNCIONAMENTO = [2, 3, 4, 5, 6];

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit', year: 'numeric',
});
const formatoHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_HORARIO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const formatoPartes = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_HORARIO, year: 'numeric', month: '2-digit', day: '2-digit',
});
const formatoMesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

/** Converte uma dataISO em Date ao meio-dia UTC (evita "pular" de dia por fuso). */
function dataPuraParaDate(dataISO) {
  return new Date(`${dataISO}T12:00:00Z`);
}

/** 25/11/2026 — aceita instante (string/Date) ou dataISO. */
export function formatarData(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return formatoData.format(new Date(valor));
}

/** 14:30 */
export function formatarHora(instante) {
  return formatoHora.format(new Date(instante));
}

/** 25/11/2026 às 14:30 */
export function formatarDataHora(instante) {
  return `${formatarData(instante)} às ${formatarHora(instante)}`;
}

/** Quarta-feira, 25/11/2026 */
export function formatarDataComDiaSemana(dataISO) {
  return `${NOMES_DIAS[diaDaSemana(dataISO)]}, ${formatarData(dataISO)}`;
}

/** Data (AAAA-MM-DD) de um instante, no fuso de São Paulo. */
export function dataISODe(instante) {
  return formatoPartes.format(new Date(instante));
}

/** Hoje em São Paulo (AAAA-MM-DD). */
export function hojeISO() {
  return dataISODe(new Date());
}

/** Soma (ou subtrai) dias de uma dataISO. */
export function somarDias(dataISO, dias) {
  const data = dataPuraParaDate(dataISO);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(dataISO) {
  return dataPuraParaDate(dataISO).getUTCDay();
}

export function abreNoDia(dataISO) {
  return DIAS_DE_FUNCIONAMENTO.includes(diaDaSemana(dataISO));
}

/** Partes para exibir um "cartão de dia": { semana: 'Qua', dia: '25', mes: 'nov' }. */
export function partesDoDia(dataISO) {
  const data = dataPuraParaDate(dataISO);
  return {
    semana: NOMES_DIAS_CURTOS[data.getUTCDay()],
    dia: String(data.getUTCDate()).padStart(2, '0'),
    mes: formatoMesCurto.format(data).replace('.', ''),
  };
}

/** Deslocamento UTC de São Paulo numa data, ex.: "-03:00" (lido do próprio navegador). */
function deslocamentoSaoPaulo(dataISO) {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: FUSO_HORARIO, timeZoneName: 'longOffset' })
    .formatToParts(dataPuraParaDate(dataISO))
    .find((parte) => parte.type === 'timeZoneName')?.value ?? 'GMT-03:00';
  const deslocamento = nome.replace('GMT', '');
  return deslocamento === '' ? '+00:00' : deslocamento;
}

/** Instante de 00:00 de uma dataISO em São Paulo, para filtros no banco. */
export function inicioDoDia(dataISO) {
  return `${dataISO}T00:00:00${deslocamentoSaoPaulo(dataISO)}`;
}

/** Lista de dataISO de "inicio" (inclusive) a "fim" (inclusive). */
export function intervaloDeDatas(inicioISO, fimISO) {
  const datas = [];
  for (let data = inicioISO; data <= fimISO; data = somarDias(data, 1)) {
    datas.push(data);
  }
  return datas;
}

/** Terça-feira da semana (de funcionamento) que contém a data. */
export function inicioDaSemanaDeTrabalho(dataISO) {
  const dia = diaDaSemana(dataISO);
  const diasDesdeTerca = (dia + 7 - 2) % 7;
  return somarDias(dataISO, -diasDesdeTerca);
}

/** Converte "HH:MM:SS" (tipo time do Postgres) em "HH:MM". */
export function horaCurta(hora) {
  return hora ? hora.slice(0, 5) : '';
}

/** Minutos desde 00:00 de um instante, em São Paulo. */
export function minutosNoDia(instante) {
  const [hora, minuto] = formatarHora(instante).split(':').map(Number);
  return hora * 60 + minuto;
}

/** "1h 15min", "45 min" */
export function formatarDuracao(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas}h` : `${horas}h ${resto}min`;
}

/** Próxima data em que a barbearia abre, andando "direcao" (+1 ou -1) dias. */
export function proximoDiaAberto(dataISO, direcao = 1) {
  let data = somarDias(dataISO, direcao);
  while (!abreNoDia(data)) data = somarDias(data, direcao);
  return data;
}

/** A própria data, se a barbearia abre nela; senão a próxima data aberta. */
export function diaAbertoMaisProximo(dataISO) {
  return abreNoDia(dataISO) ? dataISO : proximoDiaAberto(dataISO, 1);
}
