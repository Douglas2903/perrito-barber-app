# Manual de operação — Perrito Barber App 3.0 (item 3.j)

Rotina para manter o sistema funcionando: backup, o que fazer se o sistema cair, janela de manutenção, abertura de chamados e monitoramento de disponibilidade.

## Componentes

| Componente | Onde | Painel |
|---|---|---|
| Site (HTML/CSS/JS) | Vercel | vercel.com → projeto `perrito-barber-app` |
| Banco, login e regras | Supabase, projeto `perrito-barber-app` (ref `wjkpnqhkzuhtbmasjczv`) | supabase.com/dashboard |
| Código-fonte | GitHub | repositório do projeto |

**Responsáveis:**
- **Gerente (Caique Fernandes Galiardo):** dono do sistema e aprova mudanças.
- **Responsável técnico:** ainda não há uma pessoa designada. Enquanto isso, a função é exercida pela **equipe de desenvolvimento (Grupo 3)**, pelos chamados no GitHub. Onde este manual diz "responsável técnico", leia "equipe de desenvolvimento" até que a barbearia designe alguém, o que é recomendado antes do uso real.

---

## 1. Backup manual do banco

O **plano gratuito do Supabase não faz backup automático**. O backup é manual, com a frequência abaixo.

| Quando | O quê | Quem |
|---|---|---|
| Toda segunda-feira (dia fechado) | Backup completo (seção 1.1) | Responsável técnico |
| Antes de qualquer manutenção | Backup completo | Responsável técnico |
| Toda segunda-feira (opção sem instalar nada) | Exportar as tabelas em CSV (seção 1.2) | Gerente |

Guarde os arquivos em dois lugares diferentes (ex.: Google Drive da barbearia e um pendrive), com o nome `perrito-AAAA-MM-DD`. Mantenha pelo menos as últimas 8 semanas.

### 1.1 Backup completo com `pg_dump` (responsável técnico)

1. Instale o cliente do PostgreSQL na **versão 17**, a mesma do servidor (o `pg_dump` não exporta de um servidor mais novo que ele).
2. No painel do Supabase, clique em **Connect** e copie a *connection string* do **Session pooler**. Ela funciona em redes IPv4.
3. Troque `[YOUR-PASSWORD]` pela senha do banco, definida na criação do projeto. Se ela se perder, troque em **Project Settings → Database → Reset database password**.
4. Gere o backup da estrutura e dos dados do sistema:

```bash
pg_dump "COLE_A_CONNECTION_STRING" --schema=public --schema=private --format=custom --file=perrito-AAAA-MM-DD.dump
```

5. Gere o backup das contas de login:

```bash
pg_dump "COLE_A_CONNECTION_STRING" --data-only --table=auth.users --table=auth.identities --format=custom --file=perrito-auth-AAAA-MM-DD.dump
```

6. Confira se os dois arquivos foram criados e não estão vazios.

**Restauração:** sempre teste primeiro num projeto Supabase novo, de teste.
1. Crie o projeto.
2. Aplique as migrações de `supabase/migrations/`.
3. Restaure as contas com `pg_restore --data-only` usando o arquivo `perrito-auth-…`.
4. Restaure os dados com `pg_restore --data-only --schema=public` usando o arquivo `perrito-…`.

Restaure as contas **antes** dos dados, porque o cadastro cria o perfil por trigger. Se houver conflito de linhas já criadas pelo trigger, limpe a tabela `perfis` do projeto de teste antes de restaurar os dados.

> As migrações versionadas no GitHub também recriam a **estrutura** do banco do zero (README, passo 3). O backup protege os **dados**.

### 1.2 Exportação em CSV (gerente, sem instalar nada)

1. No painel do Supabase, abra **Table Editor**.
2. Para cada tabela (`agendamentos`, `agendamento_servicos`, `perfis`, `barbeiros`, `servicos`, `escalas`, `bloqueios`), abra a tabela e use a opção de exportar em **CSV**.
3. Salve os arquivos numa pasta `perrito-AAAA-MM-DD`.

O CSV serve para consulta e para recuperar informações pontuais. Para restaurar o sistema inteiro, use o backup da seção 1.1.

---

## 2. Se o sistema cair

### 2.1 Diagnóstico rápido (5 minutos)

| Sintoma | Provável causa | O que fazer |
|---|---|---|
| O site não abre | Vercel fora do ar ou deploy com erro | Verificar vercel-status.com. No painel da Vercel → **Deployments**, se o último deploy falhou, use **Instant Rollback** (ou "Promote to Production") num deploy anterior que funcionava. |
| O site abre, mas mostra "Não foi possível abrir o sistema" | `js/config.js` não foi gerado | Na Vercel, conferir as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY` e fazer **Redeploy**. |
| O site abre, mas login e agenda dão erro de conexão | Supabase fora do ar ou projeto pausado | Verificar status.supabase.com. No painel do Supabase, se o projeto estiver **Paused** (projetos gratuitos pausam após um período sem uso), clicar em **Restore project** e aguardar. |
| Erro só para um usuário | Sessão expirada ou conta | Pedir para sair e entrar de novo e limpar os dados do site no navegador. Conferir o papel em `perfis`. |
| Horários não aparecem para ninguém | Escala, bloqueio ou serviço desativado | Gerente: conferir Equipe (escalas e bloqueios) e Serviços (ativos). |

### 2.2 Contingência em papel

**Prevenção, todo fim de expediente (terça a sábado):**

1. O gerente entra na **Agenda geral**, visão **Dia**, e vai para o **dia seguinte** de funcionamento (botão **›**). No sábado, o próximo é a terça.
2. Clica em **Imprimir agenda do dia**. Sai uma folha A4 com uma coluna por barbeiro e, em cada atendimento, horário, cliente, telefone e serviços. Se não houver impressora, escolha **Salvar como PDF** e guarde o arquivo no celular.
3. Deixa a folha no balcão. Se o sistema cair no dia seguinte, a equipe já sabe quem vem e a que horas.

**Durante a queda:**

1. Os barbeiros seguem a **agenda impressa** do dia.
2. O gerente anota numa folha **cada novo agendamento** feito por telefone ou balcão: data, hora, barbeiro, cliente, telefone e serviços.
3. Antes de anotar, confere na agenda impressa e na própria folha se o barbeiro está livre naquele horário. Sem o sistema, ninguém mais faz essa checagem.

**Quando o sistema voltar, lançar os agendamentos anotados:**

1. O sistema **não tem** uma função para o gerente agendar em nome do cliente. O lançamento é feito **pelo próprio cliente no app**:
   - o gerente liga ou manda mensagem para cada cliente da folha e pede que agende pelo site o horário combinado; ou
   - se o cliente estiver na barbearia, o gerente ajuda a agendar pelo celular do próprio cliente.
2. Se o horário combinado já tiver sido ocupado por outra pessoa pelo app, o gerente combina com o cliente o próximo horário livre do mesmo barbeiro, ou de outro.
3. Ao final, o gerente confere a **Agenda geral** contra a folha e risca cada linha lançada. Só descarta a folha quando todas estiverem riscadas.
4. Registre um chamado (seção 4) com o horário de início e de fim da queda.

### 2.3 Erro em produção depois de uma atualização

1. Faça o rollback do site na Vercel (Instant Rollback).
2. Se a atualização incluiu mudança no banco, restaure o backup feito antes da manutenção (seção 1.1).
3. Abra um chamado com prioridade **Alta**.

---

## 3. Janela de manutenção — segundas-feiras

A barbearia fecha às segundas. Toda manutenção planejada é feita **na segunda-feira, das 9h às 12h**, sem clientes em atendimento.

**Procedimento:**
1. Fazer o backup completo (seção 1.1).
2. Aplicar as mudanças de banco (novas migrações) pelo SQL Editor ou pela CLI.
3. Rodar os testes automatizados:
   - `tests/sql/regras.sql` no SQL Editor: todas as linhas devem ter `passou = true`;
   - `node tests/regras-api.mjs` e `node tests/concorrencia.mjs 5`.
4. Publicar o site (merge na branch principal, que dispara o deploy automático na Vercel).
5. Fazer o teste de fumaça: entrar com uma conta de cada papel e abrir as telas principais.
6. Rodar os **Advisors** do Supabase (**Advisors → Security / Performance**) e tratar os novos alertas.
7. Registrar a manutenção na tabela abaixo.

**Rotina semanal (toda segunda):**
- backup;
- conferir os Advisors;
- conferir se o projeto Supabase está ativo;
- revisar os chamados abertos;
- conferir o monitor de uptime (seção 5).

| Data | O que foi feito | Responsável | Backup feito? | Testes OK? |
|---|---|---|---|---|
| | | | | |

---

## 4. Como abrir um chamado

**Canal:** aba **Issues** do repositório no GitHub → **New issue**. Urgências (sistema fora do ar em dia de atendimento): registrar a issue com prioridade **Alta** e aplicar a contingência em papel (seção 2.2) até o sistema voltar.

**O que informar:**
1. **Título curto:** ex. "Cliente não consegue cancelar horário".
2. **Perfil afetado:** cliente, barbeiro ou gerente, e o e-mail da conta. Nunca envie senhas.
3. **Passos para reproduzir:** o que foi feito, tela por tela.
4. **Resultado esperado × resultado obtido**, com a mensagem de erro exata.
5. **Data e hora** (horário de São Paulo), aparelho e navegador.
6. **Print da tela.**
7. **Prioridade:**

| Prioridade | Quando | Prazo de atendimento sugerido |
|---|---|---|
| Alta | Sistema fora do ar ou ninguém consegue agendar | Mesmo dia |
| Média | Uma função não funciona, mas existe alternativa | Até a próxima segunda (janela de manutenção) |
| Baixa | Ajuste visual ou melhoria | Planejar em uma janela futura |

O chamado é fechado só depois que quem o abriu confirmar a correção.

---

## 5. Monitoramento de disponibilidade (RNF04)

**Requisito:** o sistema deve ficar no ar no mínimo **99% do tempo por mês**.

**Limitação dos fornecedores:** os planos gratuitos da Vercel e do Supabase **não oferecem garantia formal de disponibilidade (SLA)**. O RNF04 é cumprido pelo **acompanhamento mensal** feito pela barbearia: medir, registrar e agir quando a meta não for atingida.

### 5.1 Configurar o monitor (uma vez)

1. Crie uma conta gratuita num serviço de monitoramento de uptime (por exemplo, UptimeRobot, Better Stack ou similar).
2. Crie um monitor do tipo **HTTP(s)** para o endereço do sistema na Vercel, com verificação a cada 5 minutos.
3. Cadastre o e-mail do gerente e o do responsável técnico para receber os alertas de queda.
4. Se o serviço tiver página de status ou relatório mensal, deixe-os ativados.

O monitor confere se o **site** responde. Uma queda só do Supabase (site abre, mas login e agenda falham) pode não aparecer nele. Por isso **toda queda percebida pelos usuários também vira chamado** (seção 4), com o horário de início e de fim, e entra na conta do mês.

> Projetos gratuitos do Supabase podem ser pausados depois de um período sem uso. Com a barbearia usando o sistema todos os dias, isso não deve ocorrer. Se ocorrer, o tempo até restaurar o projeto (seção 2.1) conta como indisponibilidade.

### 5.2 Fechamento mensal (1ª segunda-feira do mês)

1. Anote a disponibilidade do mês informada pelo monitor.
2. Some os minutos fora do ar registrados em chamados que o monitor não detectou.
3. Calcule: **disponibilidade = (minutos do mês − minutos fora do ar) ÷ minutos do mês × 100**.
4. A meta é **≥ 99%**: no máximo cerca de **7h12min** fora do ar num mês de 30 dias (**7h26min** num mês de 31 dias).
5. Abaixo da meta: abrir um chamado de prioridade Média com as causas e as ações (ex.: migrar para um plano pago com SLA, mudar a janela de manutenção, revisar o processo de deploy).

| Mês/ano | Disponibilidade do monitor | Minutos fora do ar (chamados) | Disponibilidade final | Meta ≥ 99%? | Responsável |
|---|---|---|---|---|---|
| | | | | | |
