# Homologação — Perrito Barber App 3.0 (item 3.l)

Este documento orienta como o dono e gerente da Perrito Barbearia, **Caique Fernandes Galiardo**, aprova o sistema antes do uso real.

## 1. Como a homologação funciona

1. **Preparação (equipe do projeto):** o sistema é publicado na Vercel com o banco do Supabase configurado, o seed aplicado e os testes automatizados passando (`docs/testes.md`).
2. **Sessão de homologação (cerca de 1h30, numa segunda-feira):** o gerente executa cada item da seção 3, com um celular e um computador, acompanhado por alguém da equipe.
3. **Registro:** para cada item, marcar **Aprovado**, **Aprovado com ressalva** ou **Reprovado**, anotando a observação.
4. **Correções:** cada item reprovado vira um chamado (manual de operação, seção 4). Depois da correção, só os itens afetados são homologados de novo.
5. **Aceite final:** com todos os itens aprovados (ou aprovados com ressalvas aceitas), o gerente assina a seção 5.
6. **Antes do uso real:**
   - criar a conta do gerente e torná-lo gerente (README, passo 4);
   - vincular os barbeiros reais (Equipe → Vincular login);
   - **remover ou trocar a senha das contas de demonstração**;
   - fazer o primeiro backup.

**Contas para a sessão:**
- `gerente.demo@example.com`
- `senior.demo@example.com`
- `cliente1.demo@example.com`
- `cliente2.demo@example.com`

Senha de todas: `Perrito@2026`. Os casos de teste citados (CT) estão em `docs/testes.md`.

## 2. Dados da sessão

| Campo | Valor |
|---|---|
| Data | ___/___/______ |
| Endereço do sistema | |
| Versão (commit) | |
| Participantes | |

## 3. Checklist de requisitos

Legenda do resultado: **A** = Aprovado · **R** = Aprovado com ressalva · **X** = Reprovado.

### 3.1 Requisitos funcionais

| Req. | Descrição | Critério de aceite | Como verificar | Resultado | Observação |
|---|---|---|---|---|---|
| RF01 | Perfis de acesso (cliente, barbeiro, gerente) | O cliente cria a própria conta e nasce como cliente. Cada papel vê só o seu menu e as suas telas. Acesso por URL a uma tela de outro papel é negado. | CT01–CT06 | | |
| RF02 | Cadastro de barbeiros e acesso deles | O gerente cadastra, edita e desativa barbeiros e vincula um login pelo e-mail. O barbeiro vinculado passa a ver "Minha agenda". | CT28; Equipe | | |
| RF03 | Escala e bloqueios | O gerente edita a escala semanal e cria folgas e compromissos. Os horários livres do cliente refletem as mudanças. Mudança que deixaria cliente sem atendimento é recusada com mensagem clara. | CT25–CT27 | | |
| RF04 | Agendamento pelo cliente | O cliente escolhe serviços (com soma de duração e valor), barbeiro, data (só dias de funcionamento) e horário, e confirma vendo o preço. | CT07, CT08, CT11 | | |
| RF05 | "Qualquer profissional" | Com "qualquer profissional", aparecem os horários em que ao menos um barbeiro está livre, e o sistema informa quem vai atender. | CT10 | | |
| RF06 | Horários disponíveis | Só aparecem horários livres, de 15 em 15 minutos, respeitando escala, almoço, bloqueios, agendamentos e o horário atual. | CT09 | | |
| RF07 | Agenda geral do gerente | Visão diária com uma coluna por barbeiro e visão semanal. Clicar num agendamento mostra os detalhes. | CT20, CT21 | | |
| RF08 | Agenda do barbeiro | No celular, o barbeiro vê somente os próprios atendimentos do dia e navega entre os dias. | CT17–CT19 | | |
| RF09 | Cancelamento e troca de barbeiro | O cliente cancela os próprios horários e o gerente cancela qualquer um. O cancelamento mantém o histórico com o motivo. O gerente troca o barbeiro com validação de escala e conflito. | CT14, CT22–CT24 | | |
| RF10 | Indicadores | Por barbeiro e período: realizados, cancelamentos e faturamento, com totais. Os valores conferem com a agenda do período. | CT30 | | |

### 3.2 Requisitos não funcionais

| Req. | Descrição | Critério de aceite | Como verificar | Resultado | Observação |
|---|---|---|---|---|---|
| RNF01 | Desempenho | A lista de horários disponíveis aparece em menos de 2 segundos. | CT16; teste R15 | | |
| RNF02 | *[confirmar o texto no documento de requisitos]* — sugestão: interface responsiva, mobile first | Todas as telas funcionam de 360 px até desktop, sem rolagem horizontal da página, com botões grandes no celular. | Telas no celular e no computador; CT17 | | |
| RNF03 | Segurança (RLS) | Cada usuário acessa só o que o papel permite. O barbeiro não lê a agenda de outro. Ninguém grava agendamentos sem passar pelas regras. A chave `service_role` não aparece no site. | CT06, CT17; `tests/regras-api.mjs`; R30–R43 | | |
| RNF04 | *[confirmar o texto no documento de requisitos]* — sugestão: usabilidade | Textos em português do Brasil, valores em R$, datas em dd/mm/aaaa, mensagens de erro claras e estados de carregamento e de lista vazia em todas as telas. | Uso geral; `docs/interfaces.md` | | |
| RNF05 | Concorrência | Agendamentos simultâneos para o mesmo barbeiro e horário: só um é aceito; o outro recebe "Esse horário acabou de ser ocupado. Escolha outro." | CT12; `tests/concorrencia.mjs 10` | | |

### 3.3 Regras de domínio

| Req. | Descrição | Critério de aceite | Como verificar | Resultado | Observação |
|---|---|---|---|---|---|
| RD01 | Sem conflito no mesmo barbeiro | Nunca existem dois agendamentos ativos sobrepostos para o mesmo barbeiro, nem com cliques simultâneos (garantido no banco). | CT12, CT23; R12, R44 | | |
| RD02 | Barbeiros diferentes no mesmo horário | Dois clientes podem agendar o mesmo horário com barbeiros diferentes. | CT13; R10–R11, R45 | | |
| RD03 | Dentro da escala | Recusa fora do expediente, no almoço, em bloqueio, no passado, no domingo e na segunda. | CT08, CT09, CT26, CT27; R01–R08 | | |
| RD04 | LGPD | O cadastro informa quais dados são coletados e para quê. O cliente exclui a conta: os dados pessoais são anonimizados, os horários futuros cancelados e o histórico mantido sem identificação. | CT01, CT15 | | |
| RD05 | Preço congelado | Reajustar um serviço não altera o valor de agendamentos já feitos. Os novos usam o preço novo. | CT29; R20–R23 | | |

## 4. Pendências e ressalvas

| Nº | Item | Descrição | Prazo | Responsável |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

## 5. Termo de aceite

Declaro que homologuei o **Perrito Barber App 3.0** conforme o checklist acima e que o sistema atende aos requisitos da Perrito Barbearia, observadas as ressalvas registradas na seção 4.

☐ **Aprovado** ☐ **Aprovado com ressalvas** ☐ **Reprovado**

&nbsp;

______________________________________________
**Caique Fernandes Galiardo** — dono e gerente, Perrito Barbearia

Data: ___/___/______

&nbsp;

______________________________________________
**Responsável pelo projeto** (equipe de desenvolvimento)

Data: ___/___/______
