// =============================================================================
// Valores em reais (R$).
// =============================================================================

const formatoReal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 110 -> "R$ 110,00". Aceita número ou string numérica (numeric do Postgres). */
export function formatarMoeda(valor) {
  return formatoReal.format(Number(valor) || 0);
}

/** Soma valores monetários sem erro de ponto flutuante (trabalha em centavos). */
export function somarValores(valores) {
  const centavos = valores.reduce((total, valor) => total + Math.round(Number(valor) * 100), 0);
  return centavos / 100;
}

/** "1.234,56" ou "1234.56" -> 1234.56. Retorna NaN se inválido. */
export function lerValorDigitado(texto) {
  const limpo = String(texto).trim().replace(/[R$\s]/g, '');
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return /^\d+(\.\d{1,2})?$/.test(normalizado) ? Number(normalizado) : Number.NaN;
}
