// =============================================================================
// Gera js/config.js a partir de variáveis de ambiente.
// Usado no deploy da Vercel (Build Command), já que js/config.js fica fora do
// Git. Não é um "build" de código: só escreve duas constantes num arquivo.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=sb_publishable_... node scripts/gerar-config.mjs
//
// Segurança: recusa chaves privilegiadas (service_role / sb_secret_), que
// nunca podem ir para o navegador.
// =============================================================================
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL?.trim();
const chave = process.env.SUPABASE_ANON_KEY?.trim();

function falhar(mensagem) {
  console.error(`Erro ao gerar js/config.js: ${mensagem}`);
  process.exit(1);
}

function ehChavePrivilegiada(valor) {
  if (valor.startsWith('sb_secret_')) return true;
  const partes = valor.split('.');
  if (partes.length !== 3) return false;
  try {
    const conteudo = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
    return conteudo.role === 'service_role';
  } catch {
    return false;
  }
}

if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  falhar('defina SUPABASE_URL no formato https://<ref>.supabase.co');
}
if (!chave) falhar('defina SUPABASE_ANON_KEY com a chave pública (publishable/anon).');
if (ehChavePrivilegiada(chave)) falhar('a chave informada é service_role/secret. Use a chave pública (publishable/anon).');

const conteudo = `// Gerado por scripts/gerar-config.mjs — não edite à mão.
export const SUPABASE_URL = ${JSON.stringify(url.replace(/\/$/, ''))};
export const SUPABASE_ANON_KEY = ${JSON.stringify(chave)};
`;

writeFileSync(new URL('../js/config.js', import.meta.url), conteudo);
console.log('js/config.js gerado.');
