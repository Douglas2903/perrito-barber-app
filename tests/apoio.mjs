// =============================================================================
// Apoio aos testes automatizados (Node 18+).
// Lê a URL e a chave pública de js/config.js (o mesmo arquivo do front-end)
// ou das variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY.
// Usa as contas de demonstração do seed (senha configurável por TESTE_SENHA).
// =============================================================================
import { createClient } from '@supabase/supabase-js';

export const CONTAS = {
  gerente: 'gerente.demo@example.com',
  senior: 'senior.demo@example.com',
  pleno: 'pleno.demo@example.com',
  cliente1: 'cliente1.demo@example.com',
  cliente2: 'cliente2.demo@example.com',
};

export const BARBEIROS = {
  senior: '22222222-0000-4000-8000-000000000001',
  pleno: '22222222-0000-4000-8000-000000000002',
  junior: '22222222-0000-4000-8000-000000000003',
};

export const SERVICOS = {
  corte: '11111111-0000-4000-8000-000000000001',
  barba: '11111111-0000-4000-8000-000000000002',
};

const SENHA = process.env.TESTE_SENHA ?? 'Perrito@2026';

async function lerConfiguracao() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, chave: process.env.SUPABASE_ANON_KEY };
  }
  try {
    const config = await import(new URL('../js/config.js', import.meta.url));
    return { url: config.SUPABASE_URL, chave: config.SUPABASE_ANON_KEY };
  } catch {
    throw new Error('Configure js/config.js ou as variáveis SUPABASE_URL e SUPABASE_ANON_KEY.');
  }
}

const { url, chave } = await lerConfiguracao();

/** Cliente sem login (papel anon). */
export function criarClienteAnonimo() {
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Cliente já autenticado com a conta informada. Cada chamada = sessão independente. */
export async function criarClienteLogado(email, senha = SENHA) {
  const cliente = criarClienteAnonimo();
  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha no login de ${email}: ${error.message}`);
  return cliente;
}

/** Data AAAA-MM-DD em São Paulo, "dias" a partir de hoje, pulando domingo e segunda. */
export function diaAbertoDaqui(dias) {
  const data = new Date(Date.now() + dias * 86_400_000);
  for (;;) {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data);
    const diaSemana = new Date(`${iso}T12:00:00Z`).getUTCDay();
    if (diaSemana >= 2) return iso;
    data.setTime(data.getTime() + 86_400_000);
  }
}

// ------------------------------------------------------------- relatório
let falhas = 0;

export function verificar(condicao, descricao, detalhe = '') {
  if (!condicao) falhas += 1;
  console.log(`${condicao ? '✅ PASSOU' : '❌ FALHOU'}  ${descricao}${detalhe ? `\n          ${detalhe}` : ''}`);
}

export function encerrar() {
  console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
  process.exit(falhas ? 1 : 0);
}
