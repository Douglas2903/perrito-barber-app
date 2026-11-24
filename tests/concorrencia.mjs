// =============================================================================
// Teste de concorrência (RD01 / RNF05)
// Dispara N chamadas SIMULTÂNEAS de criar_agendamento para o MESMO barbeiro e
// o MESMO horário, cada uma com uma sessão própria (como clientes diferentes
// clicando ao mesmo tempo). Resultado esperado: exatamente 1 aceita; as demais
// recusadas com a mensagem de horário ocupado.
//
// Uso:  node concorrencia.mjs [N]      (N entre 2 e 10; padrão 10)
// Ao final, o agendamento criado é CANCELADO (cancelamento lógico), liberando
// o horário; ele permanece no histórico como "cancelado".
// =============================================================================
import {
  BARBEIROS, CONTAS, SERVICOS, criarClienteLogado, diaAbertoDaqui, encerrar, verificar,
} from './apoio.mjs';

const quantidade = Number(process.argv[2] ?? 10);
if (!Number.isInteger(quantidade) || quantidade < 2 || quantidade > 10) {
  console.error('Informe a quantidade de chamadas simultâneas entre 2 e 10. Ex.: node concorrencia.mjs 5');
  process.exit(2);
}

console.log(`Teste de concorrência: ${quantidade} chamadas simultâneas\n`);

// 1) Sessões independentes, alternando os dois clientes de demonstração.
const contas = [CONTAS.cliente1, CONTAS.cliente2];
const clientes = await Promise.all(
  Array.from({ length: quantidade }, (_, i) => criarClienteLogado(contas[i % contas.length])),
);

// 2) Um horário livre do Barbeiro Júnior daqui a ~3 semanas (longe do seed).
const data = diaAbertoDaqui(20);
const { data: livres, error: erroHorarios } = await clientes[0].rpc('horarios_disponiveis', {
  p_data: data, p_servicos: [SERVICOS.barba], p_barbeiro_id: BARBEIROS.junior,
});
if (erroHorarios || !livres?.length) {
  console.error('Não foi possível achar um horário livre para o teste:', erroHorarios?.message ?? 'lista vazia');
  process.exit(2);
}
const alvo = livres[Math.floor(livres.length / 2)].inicio;
console.log(`Horário disputado: ${data} ${new Date(alvo).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })} com o Barbeiro Júnior\n`);

// 3) Todas as chamadas disparadas ao mesmo tempo.
const resultados = await Promise.all(clientes.map((cliente) => cliente.rpc('criar_agendamento', {
  p_inicio: alvo, p_servicos: [SERVICOS.barba], p_barbeiro_id: BARBEIROS.junior,
})));

const aceitas = resultados.filter((r) => !r.error);
const recusadas = resultados.filter((r) => r.error);
resultados.forEach((r, i) => console.log(
  `  chamada ${String(i + 1).padStart(2)}: ${r.error ? `recusada [${r.error.code}] ${r.error.message}` : `ACEITA (id ${r.data})`}`,
));
console.log('');

verificar(aceitas.length === 1, 'Exatamente 1 chamada aceita', `aceitas: ${aceitas.length}`);
verificar(recusadas.length === quantidade - 1, 'Todas as demais chamadas foram recusadas', `recusadas: ${recusadas.length} de ${quantidade - 1}`);
verificar(
  recusadas.every((r) => r.error.code === '23P01' || /ocupado/i.test(r.error.message)),
  'Toda recusa é por horário ocupado (exclusion constraint 23P01 ou pré-checagem)',
);

// 4) Confirma no banco que há só 1 agendamento ativo nesse horário.
const { data: noBanco } = await clientes[0]
  .from('agendamentos').select('id').eq('barbeiro_id', BARBEIROS.junior).eq('inicio', alvo).neq('status', 'cancelado');
const gerente = await criarClienteLogado(CONTAS.gerente);
const { data: visaoGerente } = await gerente
  .from('agendamentos').select('id').eq('barbeiro_id', BARBEIROS.junior).eq('inicio', alvo).neq('status', 'cancelado');
verificar(visaoGerente?.length === 1, 'No banco existe 1 único agendamento ativo nesse horário (visão do gerente)',
  `encontrados: ${visaoGerente?.length} (o cliente 1 enxerga ${noBanco?.length} deles pela RLS)`);

// 5) Limpeza: cancela (não apaga) o agendamento criado.
if (aceitas.length) {
  const { error } = await gerente.rpc('cancelar_agendamento', { p_id: aceitas[0].data, p_motivo: 'Teste de concorrência' });
  console.log(error ? `\nAviso: não foi possível cancelar o agendamento de teste: ${error.message}` : '\nAgendamento de teste cancelado (horário liberado).');
}

encerrar();
