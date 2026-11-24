# Manual de operação — Perrito Barber App 3.0 (item 3.j)

Rotina para manter o sistema funcionando: backup, o que fazer se o sistema cair, janela de manutenção e abertura de chamados.

## Componentes

| Componente | Onde | Painel |
|---|---|---|
| Site (HTML/CSS/JS) | Vercel | vercel.com → projeto `perrito-barber-app` |
| Banco, login e regras | Supabase, projeto `perrito-barber-app` (ref `wjkpnqhkzuhtbmasjczv`) | supabase.com/dashboard |
| Código-fonte | GitHub | repositório do projeto |

**Responsáveis:**
- **Gerente (Caique Fernandes Galiardo):** dono do sistema e aprova mudanças.
- **Responsável técnico:** [preencher nome e contato].

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

### 2.2 Contingência enquanto o sistema está fora

1. O gerente anota os agendamentos feitos por telefone ou balcão numa folha (data, hora, barbeiro, cliente, telefone e serviços).
2. Os barbeiros seguem a lista em papel do dia.
3. Quando o sistema voltar, cada cliente anotado é orientado a confirmar o horário pelo aplicativo. O gerente confere a Agenda geral contra a folha.
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
- revisar os chamados abertos.

| Data | O que foi feito | Responsável | Backup feito? | Testes OK? |
|---|---|---|---|---|
| | | | | |

---

## 4. Como abrir um chamado

**Canal:** aba **Issues** do repositório no GitHub → **New issue**. Urgências (sistema fora do ar em dia de atendimento): ligar para o responsável técnico [preencher contato] **e** registrar a issue.

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
