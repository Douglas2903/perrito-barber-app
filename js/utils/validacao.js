// =============================================================================
// Validação de formulários. Cada função retorna a mensagem de erro em
// português ou "" quando o valor é válido. (O banco valida de novo.)
// =============================================================================

export function somenteDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

export function validarNome(nome) {
  const limpo = String(nome ?? '').trim();
  if (limpo.length < 2) return 'Informe seu nome (mínimo 2 letras).';
  if (limpo.length > 100) return 'O nome pode ter no máximo 100 caracteres.';
  return '';
}

export function validarEmail(email) {
  const limpo = String(email ?? '').trim();
  if (!limpo) return 'Informe o e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) return 'E-mail inválido. Exemplo: nome@email.com';
  return '';
}

export function validarTelefone(telefone) {
  const digitos = somenteDigitos(telefone);
  if (digitos.length < 10 || digitos.length > 11) {
    return 'Informe o telefone com DDD. Exemplo: (11) 98765-4321';
  }
  return '';
}

export function validarSenha(senha) {
  const texto = String(senha ?? '');
  if (texto.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(texto) || !/\d/.test(texto)) return 'Use letras e números na senha.';
  return '';
}

/** "11987654321" -> "(11) 98765-4321" */
export function formatarTelefone(telefone) {
  const digitos = somenteDigitos(telefone);
  if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return telefone ?? '';
}

/** Máscara aplicada enquanto o usuário digita o telefone. */
export function mascararTelefone(texto) {
  const digitos = somenteDigitos(texto).slice(0, 11);
  if (digitos.length <= 2) return digitos.length ? `(${digitos}` : '';
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}
