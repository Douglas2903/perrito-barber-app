# Manual de treinamento — Perrito Barber App 3.0 (item 3.k)

Roteiro de treinamento para cada perfil. Cada sessão deve ser feita com o sistema aberto, praticando os passos. Para treinar sem mexer em dados reais, use as contas de demonstração. As senhas são entregues à parte pelo responsável do projeto e não ficam no repositório.

| Perfil | Duração sugerida | Conta de treino |
|---|---|---|
| Cliente (apresentado pelo gerente no balcão ou nas redes) | 10 min | `cliente1.demo@example.com` |
| Barbeiro | 15 min | `senior.demo@example.com` |
| Gerente | 45 min | `gerente.demo@example.com` |

---

## 1. Cliente

**Objetivo:** criar a conta, agendar, acompanhar e cancelar os próprios horários.

### 1.1 Criar a conta
1. Abra o endereço do sistema no celular.
2. Toque em **Criar conta**.
3. Preencha nome, telefone com DDD, e-mail e uma senha de 8 ou mais caracteres, com letras e números.
4. Leia o aviso de privacidade: só nome, telefone e e-mail são guardados, e apenas para os agendamentos.
5. Toque em **Criar conta**. Você já entra no sistema.

### 1.2 Agendar
1. Na tela **Agendar**, marque um ou mais serviços. O total aparece embaixo.
2. Toque em **Continuar** e escolha um barbeiro, ou **Qualquer profissional** para ter mais opções de horário.
3. Escolha o dia. Só aparecem os dias em que a barbearia abre, de terça a sábado.
4. Escolha um horário livre.
5. Confira o resumo (data, hora, barbeiro e **valor a pagar na barbearia**) e toque em **Confirmar agendamento**.
6. Se aparecer "Esse horário acabou de ser ocupado", outra pessoa marcou no mesmo instante: escolha outro horário.

### 1.3 Ver e cancelar
1. Toque em **Meus horários**.
2. Em **Próximos**, toque em **Cancelar**, escreva o motivo (opcional) e confirme.
3. O horário passa para o **Histórico** como "Cancelado".

### 1.4 Excluir a conta (LGPD)
1. Em **Meus horários**, desça até **Minha conta e privacidade**.
2. Toque em **Excluir minha conta** e confirme.
3. Seus horários futuros são cancelados e seus dados pessoais são apagados.

**Exercício:** marcar um corte para a próxima quinta com "Qualquer profissional" e depois cancelar.

---

## 2. Barbeiro

**Objetivo:** consultar a própria agenda no celular e registrar os atendimentos realizados.

### 2.1 Primeiro acesso
1. Crie sua conta pela tela **Criar conta**, como um cliente.
2. Avise o gerente. Ele vincula sua conta ao seu cadastro de barbeiro (Equipe → Vincular login).
3. Saia e entre de novo: o menu passa a mostrar **Minha agenda**.

### 2.2 Usar a agenda no dia a dia
1. Ao entrar, aparece o dia de hoje, ou o próximo dia de funcionamento.
2. No topo ficam o expediente, o almoço, a quantidade de atendimentos e o valor previsto.
3. Cada cartão mostra o horário, os serviços, o cliente e o telefone. Toque no telefone para ligar.
4. Faixas listradas indicam folgas ou compromissos.
5. Use **‹** e **›** para trocar de dia (domingo e segunda são pulados), **Hoje** para voltar ao dia atual e **Ir para data** para escolher um dia no calendário.
6. Toque em **Atualizar** para ver agendamentos feitos há pouco.

### 2.3 Concluir atendimento
1. Depois de atender, toque em **Marcar como concluído** no cartão. O botão só aparece a partir do horário de início.
2. O status passa para "Concluído". Isso alimenta os indicadores do gerente.

**Importante:** você vê apenas os seus atendimentos. Para cancelar ou trocar um horário, fale com o gerente.

**Exercício:** abrir a agenda de sábado, ligar (de mentira) para o primeiro cliente e voltar para hoje.

---

## 3. Gerente

**Objetivo:** acompanhar a operação, ajustar a agenda, manter equipe e serviços e acompanhar os resultados.

### 3.1 Agenda geral
1. Ao entrar, aparece a **visão diária**, com uma coluna por barbeiro. Almoços e folgas ficam listrados.
2. Clique num agendamento para ver os detalhes e escolher uma ação:
   - **Trocar barbeiro:** escolha outro barbeiro em "Trocar para" e confirme. O sistema recusa se ele estiver ocupado, de folga ou fora do expediente.
   - **Cancelar agendamento:** escreva o motivo e confirme. O registro fica no histórico.
   - **Concluir:** disponível a partir do horário de início.
3. Use **Semana** para ver de terça a sábado. Clique no título de um dia para abri-lo na visão diária.

### 3.2 Equipe
1. **Novo barbeiro:** informe o nome e o nível. Depois, configure a **Escala**.
2. **Escala:** marque os dias trabalhados e escolha início, fim e almoço (1 hora). Mantenha os almoços em horários diferentes para sempre haver alguém atendendo.
3. **Vincular login:** peça ao barbeiro para criar a conta e informe o e-mail dela. **Remover login** devolve a pessoa ao papel de cliente.
4. **Novo bloqueio:** registre folgas (dia inteiro) ou compromissos (intervalo de horas) com o motivo.
5. **Desativar:** o barbeiro deixa de receber agendamentos.

Se o sistema recusar a escala, o bloqueio ou a desativação por haver clientes marcados, troque o barbeiro desses agendamentos ou cancele-os na Agenda geral e tente de novo.

### 3.3 Serviços
1. Altere o preço (formato `60,00`) ou a duração e clique em **Salvar** na linha.
2. Desmarque **Ativo** para tirar um serviço da tela de agendamento sem apagar o histórico.
3. Reajustes valem só para agendamentos novos. Os já marcados mantêm o valor combinado.

### 3.4 Indicadores
1. Escolha o período: **Últimos 7 dias**, **Este mês**, **Mês passado** ou **Personalizado**.
2. Leia por barbeiro: **Realizados** (concluídos), **Cancelamentos** e **Faturamento** (soma do valor dos concluídos).
3. Para o faturamento ficar correto, os barbeiros precisam marcar os atendimentos como concluídos.

### 3.5 Rotina semanal do gerente (segunda-feira)
1. Conferir as escalas e os bloqueios da semana.
2. Ver os indicadores da semana anterior.
3. Exportar o backup em CSV (manual de operação, seção 1.2), ou confirmar que o responsável técnico fez o backup completo.

**Exercício:** criar uma folga para o Barbeiro Júnior na próxima sexta e tentar um bloqueio sobre um horário já marcado, para ver a mensagem de recusa. Depois remover a folga de teste.

---

## Lista de presença

| Nome | Perfil | Data | Exercício concluído? | Assinatura |
|---|---|---|---|---|
| Caique Fernandes Galiardo | Gerente | | | |
| | Barbeiro Sênior | | | |
| | Barbeiro Pleno | | | |
| | Barbeiro Júnior | | | |
