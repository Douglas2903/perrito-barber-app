// =============================================================================
// Testes de RLS e regras pela API (o mesmo caminho do navegador: PostgREST
// com o JWT do usuário). Complementa tests/sql/regras.sql.
//
// Uso:  node regras-api.mjs
// Não grava nada: só leituras e tentativas que devem ser recusadas.
// =============================================================================
import {
  BARBEIROS, CONTAS, SERVICOS, criarClienteAnonimo, criarClienteLogado, diaAbertoDaqui, encerrar, verificar,
} from './apoio.mjs';

console.log('Testes de regras e RLS pela API\n');

// --- Barbeiro Sênior tentando ler a agenda do Pleno (RNF03)
const senior = await criarClienteLogado(CONTAS.senior);
const { data: doPleno } = await senior.from('agendamentos').select('id').eq('barbeiro_id', BARBEIROS.pleno);
verificar(doPleno?.length === 0, 'Barbeiro Sênior NÃO lê a agenda do Pleno (RLS)', `linhas retornadas: ${doPleno?.length}`);
const { data: todosDoSenior } = await senior.from('agendamentos').select('barbeiro_id');
verificar(todosDoSenior.length > 0 && todosDoSenior.every((a) => a.barbeiro_id === BARBEIROS.senior),
  'Barbeiro Sênior lê somente os próprios agendamentos', `linhas: ${todosDoSenior.length}`);
const { error: erroUpdateBarbeiro } = await senior.from('agendamentos')
  .update({ status: 'cancelado' }).eq('barbeiro_id', BARBEIROS.pleno).select('id');
verificar(Boolean(erroUpdateBarbeiro), 'Barbeiro não altera agendamentos direto na tabela', erroUpdateBarbeiro?.message);

// --- Cliente
const cliente = await criarClienteLogado(CONTAS.cliente1);
const { data: { user } } = await cliente.auth.getUser();
const { data: visiveis } = await cliente.from('agendamentos').select('cliente_id');
verificar(visiveis.every((a) => a.cliente_id === user.id), 'Cliente lê somente os próprios agendamentos', `linhas: ${visiveis.length}`);

const { error: erroInsert } = await cliente.from('agendamentos').insert({
  cliente_id: user.id, barbeiro_id: BARBEIROS.senior,
  inicio: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  fim: new Date(Date.now() + 30 * 86_400_000 + 3_600_000).toISOString(), valor_total: 0,
});
verificar(Boolean(erroInsert), 'Cliente NÃO insere agendamento direto (só pela função)', erroInsert?.message);

const { error: erroDelete } = await cliente.from('agendamentos').delete().eq('cliente_id', user.id).select('id');
verificar(Boolean(erroDelete), 'Cliente NÃO apaga agendamentos (cancelamento é lógico)', erroDelete?.message);

const { error: erroPapel } = await cliente.from('perfis').update({ papel: 'gerente' }).eq('id', user.id);
verificar(Boolean(erroPapel), 'Cliente NÃO muda o próprio papel', erroPapel?.message);

const { data: perfisVisiveis } = await cliente.from('perfis').select('id');
verificar(perfisVisiveis.length === 1, 'Cliente lê somente o próprio perfil', `perfis visíveis: ${perfisVisiveis.length}`);

// --- Regras de agenda pela função (RD03)
const segunda = (() => { // próxima segunda-feira
  const d = new Date(`${diaAbertoDaqui(8)}T12:00:00Z`);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();
const tentativas = [
  ['segunda-feira (fechado)', `${segunda}T11:00:00-03:00`, BARBEIROS.senior],
  ['antes do expediente', `${diaAbertoDaqui(8)}T09:00:00-03:00`, BARBEIROS.senior],
  ['no almoço do Sênior', `${diaAbertoDaqui(8)}T12:00:00-03:00`, BARBEIROS.senior],
  ['no passado', new Date(Date.now() - 86_400_000).toISOString().slice(0, 13) + ':00:00Z', BARBEIROS.senior],
];
for (const [descricao, inicio, barbeiro] of tentativas) {
  // eslint-disable-next-line no-await-in-loop
  const { error } = await cliente.rpc('criar_agendamento', { p_inicio: inicio, p_servicos: [SERVICOS.corte], p_barbeiro_id: barbeiro });
  verificar(Boolean(error), `Agendamento ${descricao} é recusado`, error?.message);
}

// --- Visitante sem login
const anonimo = criarClienteAnonimo();
const { data: anonDados, error: anonErro } = await anonimo.from('agendamentos').select('id');
verificar(Boolean(anonErro) || anonDados?.length === 0, 'Visitante sem login não lê agendamentos', anonErro?.message);
const { error: anonRpc } = await anonimo.rpc('horarios_disponiveis', { p_data: diaAbertoDaqui(8), p_servicos: [SERVICOS.corte] });
verificar(Boolean(anonRpc), 'Visitante sem login não consulta horários', anonRpc?.message);

encerrar();
