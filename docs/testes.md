# Testes — Perrito Barber App 3.0 (item 3.i)

O sistema tem três tipos de teste:

1. **Testes automatizados das regras no banco** (`tests/sql/regras.sql`): 45 verificações em SQL.
2. **Testes automatizados pela API** (`tests/regras-api.mjs` e `tests/concorrencia.mjs`): usam o mesmo caminho do navegador (Supabase com o JWT do usuário).
3. **Roteiro de testes manuais** (seção 3): casos CT01 a CT31 executados na interface.

Os automatizados usam as **contas de demonstração do seed** (senha `Perrito@2026`).

---

## 1. Testes das regras em SQL

**Arquivo:** `tests/sql/regras.sql`

**Como rodar:** no painel do Supabase, abra **SQL Editor → New query**, cole o arquivo inteiro e clique em **Run**. O resultado é uma tabela com as colunas `caso`, `passou`, `descricao` e `detalhe`. **Todas as linhas devem ter `passou = true`.**

O script roda entre `BEGIN` e `ROLLBACK`: **nada fica gravado**. Ele simula usuários logados trocando o papel do Postgres para `authenticated` e preenchendo `request.jwt.claims`, que é o mesmo mecanismo usado pela API.

| Casos | O que verifica | Requisito |
|---|---|---|
| R01–R02 | Antes do expediente e terminando depois dele: recusado | RD03 |
| R03–R04 | No almoço e invadindo o almoço: recusado | RD03 |
| R05 | Durante bloqueio (folga/compromisso): recusado | RD03, RF03 |
| R06 | No passado: recusado | RD03 |
| R07–R08 | Segunda-feira e domingo: recusado | RD03 |
| R09 | Fora da grade de 15 minutos: recusado | RF06 |
| R10–R11 | Dois barbeiros diferentes no mesmo horário: **aceito** | RD02 |
| R12 | Mesmo barbeiro sobreposto: recusado | RD01 |
| R13–R14 | "Qualquer profissional": recusa quando todos estão indisponíveis; aceita quando há alguém livre | RF05 |
| R15 | `horarios_disponiveis` responde em menos de 2 s | RNF01 |
| R16–R19 | Horários livres coerentes (sem almoço, sem ocupados, dia fechado vazio) | RF06 |
| R20–R23 | Preço congelado após reajuste; novo agendamento usa o preço novo; `valor_total` imutável | RD05 |
| R24 | `DELETE` em agendamentos recusado (até para administrador) | RF09 |
| R25–R29 | Cancelamento: cliente só cancela o próprio; barbeiro não cancela; histórico mantido; horário volta a ficar livre | RF09 |
| R30–R33 | Cliente não faz INSERT direto, só vê os próprios, não vira gerente, não altera preço | RNF03 |
| R34–R37 | Barbeiro **não lê a agenda de outro barbeiro**, lê a própria e não troca barbeiro | RNF03, RF08 |
| R38–R41 | Gerente lê tudo; bloqueio sobre agendamento é recusado; troca de barbeiro valida conflito | RF07, RF09 |
| R44–R45 | A exclusion constraint **sozinha** barra sobreposição no mesmo barbeiro (SQLSTATE 23P01) e aceita outro barbeiro | RD01, RD02, RNF05 |
| R42–R43 | Visitante sem login não lê nem agenda | RNF03 |

---

## 2. Testes pela API (Node)

**Pré-requisitos:** Node 18 ou superior e o `js/config.js` preenchido. Em vez do arquivo, também é possível usar as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

```bash
cd tests
```

```bash
npm install
```

### 2.1 Teste de concorrência — `tests/concorrencia.mjs` (RD01, RNF05)

O script dispara **N chamadas simultâneas** de `criar_agendamento` para o **mesmo barbeiro e horário**. Cada chamada usa uma sessão própria, simulando clientes diferentes clicando ao mesmo tempo.

```bash
node concorrencia.mjs 10
```

O argumento é a quantidade de chamadas, de 2 a 10 (padrão 10). O script:

1. faz login dos clientes de demonstração e procura um horário livre do Barbeiro Júnior a cerca de 3 semanas;
2. dispara as N chamadas ao mesmo tempo, com `Promise.all`;
3. exige **exatamente 1 aceita** e N−1 recusadas por horário ocupado;
4. confere, como gerente, que existe **1 único agendamento ativo** nesse horário;
5. **cancela** o agendamento de teste (cancelamento lógico), liberando o horário.

O código de saída é `0` quando tudo passa e `1` quando alguma verificação falha.

Exemplo de saída (execução de 24/11/2026):

```
  chamada  1: recusada [P0001] Esse horário já está ocupado.
  ...
  chamada  7: ACEITA (id 20efb2ac-...)
  ...
✅ PASSOU  Exatamente 1 chamada aceita
✅ PASSOU  Todas as demais chamadas foram recusadas
✅ PASSOU  Toda recusa é por horário ocupado (exclusion constraint 23P01 ou pré-checagem)
✅ PASSOU  No banco existe 1 único agendamento ativo nesse horário (visão do gerente)
```

**Como a garantia funciona:** a função faz uma pré-checagem, que gera uma mensagem amigável. Se duas transações passarem juntas por essa pré-checagem, a *exclusion constraint* `agendamentos_sem_conflito_por_barbeiro` barra a segunda no momento do INSERT (SQLSTATE `23P01`), e a função devolve "Esse horário acabou de ser ocupado. Escolha outro.". Por isso a recusa pode vir com o código `P0001` (pré-checagem) ou `23P01` (constraint), conforme o momento exato em que cada requisição chega. Nos dois casos, só uma é aceita. Os casos R44 e R45 do teste SQL provam que a constraint funciona sozinha.

### 2.2 RLS e regras pela API — `tests/regras-api.mjs` (RNF03, RD03)

```bash
node regras-api.mjs
```

O script verifica:
- o barbeiro Sênior não lê a agenda do Pleno e não altera agendamentos;
- o cliente lê só os próprios dados e não faz INSERT, DELETE nem troca de papel;
- agendamentos na segunda-feira, antes do expediente, no almoço e no passado são recusados;
- o visitante sem login não lê dados e não consulta horários.

O script não grava nada.

---

## 3. Roteiro de testes manuais

**Ambiente:** o sistema publicado (ou rodando localmente) com o seed aplicado. Use um celular, ou o modo dispositivo do navegador (F12 → ícone de celular, 360 px), quando indicado.

**Contas:**
- `gerente.demo@example.com`
- `senior.demo@example.com`
- `pleno.demo@example.com`
- `cliente1.demo@example.com`
- `cliente2.demo@example.com`

Senha de todas: `Perrito@2026`.

### Acesso e perfis

| CT | Caso | Passos | Resultado esperado | Requisito |
|---|---|---|---|---|
| CT01 | Cadastro de cliente | 1. Abrir o sistema. 2. "Criar conta". 3. Preencher nome, telefone, e-mail e senha (8+ caracteres, com letras e números). 4. "Criar conta". | Aviso de LGPD visível no formulário. Conta criada e cliente direcionado para "Agendar". O menu mostra só "Agendar" e "Meus horários". | RF01, RD04 |
| CT02 | Validação do cadastro | Na tela "Criar conta", clicar em "Criar conta" sem preencher. | Mensagem em português em cada campo, abaixo dele. | RF01 |
| CT03 | E-mail já cadastrado | Cadastrar com `cliente1.demo@example.com`. | "Já existe uma conta com este e-mail. Tente entrar." | RF01 |
| CT04 | Login inválido | Entrar com senha errada. | "E-mail ou senha incorretos." | RF01 |
| CT05 | Redirecionamento por papel | Entrar como cliente, depois como barbeiro, depois como gerente. | Cliente → Agendar. Barbeiro → Minha agenda. Gerente → Agenda geral, com o menu Agenda, Equipe, Serviços e Indicadores. | RF01 |
| CT06 | Acesso indevido por URL | Logado como cliente, digitar `#/agenda` na barra de endereço. | Volta para "Agendar", sem mostrar a agenda geral. | RF01, RNF03 |

### Agendamento do cliente

| CT | Caso | Passos | Resultado esperado | Requisito |
|---|---|---|---|---|
| CT07 | Soma de serviços | Como cliente, em "Agendar", marcar "Corte de cabelo" e "Sobrancelha". | O rodapé mostra "2 serviço(s) · 1h" e **R$ 80,00**. | RF06 |
| CT08 | Datas disponíveis | Avançar até "Data". | Só aparecem dias de terça a sábado, até 60 dias à frente. | RF04, RD03 |
| CT09 | Horários livres | Escolher "Barbeiro Pleno" e a próxima terça com agendamentos de exemplo. | Não aparecem 11:00 (ocupado) nem horários que invadam o almoço (13h–14h). | RF04, RF06, RD03 |
| CT10 | Qualquer profissional | Escolher "Qualquer profissional" e um horário. | Aparece "você será atendido por [nome]". A confirmação mostra o barbeiro escolhido pelo sistema. | RF05 |
| CT11 | Confirmação com preço | Concluir o agendamento. | A confirmação mostra data em dd/mm/aaaa, horário, barbeiro e **total em R$**. Depois de confirmar, o horário aparece em "Meus horários → Próximos". | RF06, RD05 |
| CT12 | Horário disputado | Em duas janelas (cliente1 e cliente2), escolher o mesmo barbeiro, data e horário e ir até a confirmação nas duas. Confirmar primeiro numa e depois na outra. | A primeira confirma. A segunda mostra "Esse horário acabou de ser ocupado. Escolha outro." e volta para a lista de horários, sem o horário disputado. | RD01, RNF05 |
| CT13 | Dois barbeiros no mesmo horário | O cliente1 agenda às 17:00 com o Sênior; o cliente2 agenda às 17:00 com o Júnior. | Os dois são aceitos. Na lista do Júnior, o horário ocupado pelo Sênior continua livre. | RF04, RD02 |
| CT14 | Cancelar | Em "Meus horários", tocar em "Cancelar" num horário futuro, informar o motivo e confirmar. | O agendamento vai para o "Histórico" como "Cancelado", com o motivo. O horário volta a ficar disponível. | RF09 |
| CT15 | Excluir conta (LGPD) | Com uma conta de teste: "Meus horários" → "Excluir minha conta" → "Excluir definitivamente". | Volta ao login, e o login com essa conta passa a falhar. Para o gerente, os atendimentos antigos aparecem como "Cliente removido". Os horários futuros da conta foram cancelados. | RD04 |
| CT16 | Tempo de resposta | Na etapa "Horário", medir o tempo até a lista aparecer. | Menos de 2 segundos. | RNF01 |

### Agenda do barbeiro

| CT | Caso | Passos | Resultado esperado | Requisito |
|---|---|---|---|---|
| CT17 | Somente a própria agenda | Entrar como `senior.demo` no celular, a 360 px e depois a 414 px. | Aparecem só os atendimentos do Barbeiro Sênior, com cliente e telefone clicável. Não há rolagem horizontal. | RF08, RNF02, RNF03 |
| CT18 | Navegação entre dias | Usar ‹ e › e "Hoje". | Domingo e segunda são pulados. A data aparece por extenso (ex.: "Terça-feira, 24/11/2026"). | RF08 |
| CT19 | Concluir atendimento | Num atendimento confirmado cujo horário já começou, tocar em "Marcar como concluído". | O status muda para "Concluído". O botão não aparece em atendimentos futuros. | RF08, RF10 |

### Painel do gerente

| CT | Caso | Passos | Resultado esperado | Requisito |
|---|---|---|---|---|
| CT20 | Agenda diária | Entrar como gerente. | Uma coluna por barbeiro, com almoço sombreado e os agendamentos posicionados no horário. | RF07 |
| CT21 | Agenda semanal | Clicar em "Semana". | Terça a sábado, com a contagem de atendimentos por dia. Clicar num dia abre a visão diária. | RF07 |
| CT22 | Trocar barbeiro | Clicar num agendamento futuro → "Trocar para" outro barbeiro livre → "Trocar barbeiro". | O agendamento passa para a coluna do novo barbeiro. | RF09 |
| CT23 | Trocar para barbeiro ocupado | Repetir o CT22 escolhendo um barbeiro ocupado naquele horário. | Mensagem "Esse horário já está ocupado." e nada muda. | RF09, RD01 |
| CT24 | Cancelar pelo gerente | Clicar num agendamento → informar o motivo → "Cancelar agendamento". | Some da grade e aparece em "cancelado(s) neste dia". | RF09 |
| CT25 | Escala | Equipe → "Escala" de um barbeiro → mudar o almoço → "Salvar escala". | Escala salva. Os horários livres do cliente refletem o novo almoço. | RF03, RD03 |
| CT26 | Escala com agendamento | Desmarcar um dia em que o barbeiro tem agendamento futuro e salvar. | Recusado com "Alteração recusada: o agendamento de dd/mm/aaaa às hh:mm ficaria inválido…". | RF03, RD03 |
| CT27 | Bloqueio (folga) | Equipe → "Novo bloqueio" → barbeiro, datas, "Dia inteiro", motivo → "Criar bloqueio". | O bloqueio aparece na lista. O cliente não vê horários desse barbeiro no período. Bloqueio sobre um agendamento confirmado é recusado. | RF03, RD03 |
| CT28 | Vincular login | Criar uma conta nova como cliente. Como gerente: Equipe → barbeiro sem login → "Vincular login" → e-mail dessa conta. | Na próxima entrada, a conta vê "Minha agenda" daquele barbeiro. E-mail inexistente mostra "Nenhum usuário cadastrado com este e-mail…". | RF01 |
| CT29 | Reajuste de preço | Serviços → mudar o preço de "Corte de cabelo" → Salvar. Conferir um agendamento antigo e fazer um novo. | O antigo mantém o valor original e o novo usa o preço novo. | RD05 |
| CT30 | Indicadores | Indicadores → "Este mês", "Mês passado" e "Personalizado". | Tabela por barbeiro com realizados, cancelamentos e faturamento, mais a linha de total. O período aparece em dd/mm/aaaa. Período invertido mostra uma mensagem de erro clara. | RF10 |
| CT31 | Manter cadastro de profissionais | Equipe → "Novo barbeiro" → nome e nível → Salvar. Depois "Editar" (mudar o nome) e "Desativar". Em seguida, tentar desativar o Barbeiro Sênior, que tem agendamentos futuros. | O novo barbeiro aparece na lista e, depois de editado, com o nome novo. Desativado, ele fica "Inativo" e some da escolha de barbeiro do cliente. A desativação do Sênior é recusada com "Alteração recusada…". | RF02 |

### Registro de execução

| Data | Responsável | CTs executados | Falhas encontradas | Observações |
|---|---|---|---|---|
| 24/11/2026 | Equipe do projeto (testes automatizados) | R01–R45 (SQL), regras-api, concorrência (2 e 10 chamadas) e fluxos E2E das telas | Nenhuma pendente | Bugs corrigidos durante o desenvolvimento: menu inferior cobrindo o botão "Sair" no celular; campo de data nativo exibindo o formato do idioma do navegador. |
| | | | | |
