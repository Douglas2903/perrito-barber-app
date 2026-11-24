# Perrito Barber App 3.0

Sistema web de **agendamento e gestão** da **Perrito Barbearia** (Rua Luís Góis, 322, São Paulo/SP), com 3 barbeiros atendendo ao mesmo tempo (Sênior, Pleno e Júnior).

Trabalho da disciplina de Laboratório de Engenharia de Software — ADS, Fatec-SP.

| Perfil | O que faz |
|---|---|
| **Cliente** | Cria a conta, agenda (serviços → barbeiro ou "qualquer profissional" → data → horário → confirmação), vê e cancela os próprios horários e pode excluir a conta (LGPD). |
| **Barbeiro** | Vê **somente a própria agenda**, dia a dia, no celular, e marca atendimentos como concluídos. |
| **Gerente** | Agenda geral (dia com os 3 barbeiros lado a lado e semana), cancela e troca barbeiro, cuida da equipe (escalas, folgas, logins), dos serviços e dos indicadores. |

Horário de funcionamento: terça a sexta, 10h–20h; sábado, 8h–19h; fechado domingo e segunda. Fuso: `America/Sao_Paulo`.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | HTML, CSS e JavaScript puro (ES modules), SPA sem framework e **sem etapa de build** |
| Back-end | Supabase: Auth (e-mail/senha, JWT), PostgreSQL, Row Level Security e funções RPC em PL/pgSQL |
| Cliente | `@supabase/supabase-js` **2.119.0**, importado do CDN jsDelivr com versão fixa |
| Hospedagem | Vercel (site estático) |

### Onde ficam as regras de negócio

Toda regra crítica está **no banco**; o front-end só exibe e chama:

- **Sem conflito de horário (RD01/RNF05):** *exclusion constraint* com `btree_gist` em `agendamentos` — o mesmo barbeiro não pode ter dois intervalos `[inicio, fim)` sobrepostos fora do status `cancelado`. Barbeiros diferentes podem atender no mesmo horário (RD02).
- **Dentro da escala (RD03):** função única `private.validar_janela` (expediente, almoço, bloqueios, dia fechado, conflito), usada por todas as RPCs.
- **Preço congelado (RD05):** `agendamento_servicos.preco_cobrado` e `agendamentos.valor_total` são gravados na criação; um trigger impede alterá-los.
- **Cancelamento lógico (RF09):** um trigger impede `DELETE` em agendamentos.
- **Acesso (RNF03):** RLS em todas as tabelas; o front-end nunca grava agendamentos direto — só pelas funções RPC.

### Estrutura de pastas

```
index.html              página única da SPA
vercel.json             deploy e cabeçalhos de segurança (CSP)
css/                    base (tokens), layout e componentes
js/
  config.example.js     modelo da configuração (o config.js real fica fora do Git)
  supabase.js           cliente Supabase
  router.js             rotas por hash e proteção por papel
  auth.js               login, cadastro, sessão e perfil
  app.js                inicialização e menu
  pages/                uma tela por arquivo
  services/             chamadas ao Supabase
  utils/                datas (fuso SP), moeda, validação, UI
scripts/gerar-config.mjs  gera js/config.js a partir de variáveis (deploy)
supabase/
  migrations/           SQL versionado (recria o banco do zero)
  seed.sql              dados iniciais e de demonstração
tests/                  testes automatizados (SQL e Node)
docs/                   interfaces, testes, operação, treinamento, homologação
```

### Banco de dados

| Tabela | Conteúdo |
|---|---|
| `perfis` | Um por usuário do Auth (`id = auth.users.id`): nome, telefone, e-mail, papel. Criado por trigger no cadastro, sempre como `cliente`. |
| `barbeiros` | Profissionais; `perfil_id` liga a um login (opcional). |
| `servicos` | Catálogo com preço e duração atuais. |
| `escalas` | Expediente e almoço por barbeiro e dia da semana. |
| `bloqueios` | Folgas e compromissos. |
| `agendamentos` | Horário, status, valor total e dados de cancelamento. |
| `agendamento_servicos` | Serviços de cada agendamento com preço e duração congelados. |

Funções chamadas pelo front-end: `horarios_disponiveis`, `criar_agendamento`, `cancelar_agendamento`, `concluir_agendamento`, `trocar_barbeiro`, `excluir_minha_conta`, `promover_barbeiro`, `desvincular_barbeiro` e `indicadores`.

> Decisão de projeto: `perfis` **não** tem chave estrangeira para `auth.users`. Assim, quando o cliente exclui a conta (LGPD), o usuário do Auth é apagado e o perfil fica anonimizado, preservando o histórico de atendimentos.

---

## Como rodar do zero

Pré-requisitos: conta gratuita no [Supabase](https://supabase.com), conta na [Vercel](https://vercel.com) ligada ao GitHub, Git e Python 3 (ou Node 18+) para o servidor local.

### 1. Criar o projeto no Supabase

1. Em [supabase.com/dashboard](https://supabase.com/dashboard), clique em **New project**.
2. Escolha a organização, dê o nome `perrito-barber-app`, defina uma senha forte para o banco (guarde-a: ela é usada no backup) e a região mais próxima.
3. Aguarde o status **Healthy**.

### 2. Configurar a autenticação

1. **Authentication → Sign In / Providers → Email**: mantenha **Email** habilitado.
2. Desligue **Confirm email** e clique em **Save changes** (o cadastro entra direto; o plano gratuito limita o envio de e-mails).
3. **Limitação conhecida:** a opção **Prevent use of leaked passwords** só existe no plano Pro ou superior do Supabase. No plano gratuito ela fica desligada, e o único alerta restante dos Advisors de segurança é este. Como mitigação, o cadastro exige senha de 8 ou mais caracteres com letras e números.

### 3. Rodar as migrações e o seed

**Opção A — pelo painel (sem instalar nada):** abra **SQL Editor → New query**, cole e execute **um arquivo por vez, nesta ordem**:

1. `supabase/migrations/20261124005538_extensoes_e_tabelas.sql`
2. `supabase/migrations/20261124010533_regras_e_triggers.sql`
3. `supabase/migrations/20261124011437_funcoes_rpc.sql`
4. `supabase/migrations/20261124011500_rls_e_permissoes.sql`
5. `supabase/migrations/20261124011921_correcoes_advisors.sql`
6. `supabase/migrations/20261124020532_indicadores.sql`
7. `supabase/seed.sql`

**Opção B — pela Supabase CLI** (na pasta do projeto; o `init` só é necessário na primeira vez e cria `supabase/config.toml`):

```bash
npx supabase init
```

```bash
npx supabase login
```

```bash
npx supabase link --project-ref SEU_PROJECT_REF
```

```bash
npx supabase db push
```

Depois execute o `supabase/seed.sql` pelo SQL Editor.

O seed cria: os 5 serviços, os 3 barbeiros, as escalas (almoço escalonado: 12h/13h/14h de terça a sexta e 11h/12h/13h no sábado), **contas de demonstração** e agendamentos de exemplo.

| Conta de demonstração | Papel |
|---|---|
| `gerente.demo@example.com` | gerente |
| `senior.demo@example.com`, `pleno.demo@example.com`, `junior.demo@example.com` | barbeiros |
| `cliente1.demo@example.com`, `cliente2.demo@example.com` | clientes |

Senha de todas: `Perrito@2026`.

> **Produção:** execute só as seções 1 a 3 do `seed.sql` (serviços, barbeiros e escalas). As seções 4 e 5 criam contas e agendamentos de demonstração.

### 4. Criar o primeiro gerente

Todo cadastro novo nasce como cliente. Para o dono (Caique) virar gerente:

1. Abra o sistema e crie a conta dele pela tela **Criar conta**.
2. No **SQL Editor**, execute (trocando o e-mail):

```sql
update public.perfis
   set papel = 'gerente'
 where lower(email) = lower('email-do-caique@exemplo.com');
```

3. Saia e entre de novo no sistema.

A partir daí, o gerente promove barbeiros pela tela **Equipe → Vincular login** (a pessoa cria a conta antes); não é necessário usar a chave `service_role`.

### 5. Configurar o `js/config.js`

1. Copie `js/config.example.js` para `js/config.js`.
2. No Supabase, vá em **Project Settings → API Keys** e copie:
   - a **Project URL** (`https://<ref>.supabase.co`) para `SUPABASE_URL`;
   - a chave **publishable** (`sb_publishable_...`) — ou a **anon** legada — para `SUPABASE_ANON_KEY`.
3. **Nunca** use a chave `service_role`/`secret`: o arquivo vai para o navegador.

O `js/config.js` está no `.gitignore` e não vai para o repositório.

### 6. Rodar localmente

ES modules não funcionam abrindo o `index.html` direto do disco; use um servidor local na pasta do projeto:

```bash
python -m http.server 8080
```

Abra <http://localhost:8080> e entre com uma conta de demonstração.

(Alternativa com Node: `npx serve -l 8080 .`)

### 7. Deploy na Vercel

Como o `js/config.js` fica fora do Git, a Vercel o gera no deploy a partir de variáveis de ambiente (`scripts/gerar-config.mjs`, configurado no `vercel.json`). Não há empacotamento de código.

1. Envie o repositório para o GitHub.
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório.
3. Em **Framework Preset**, escolha **Other**. Não altere Build Command e Output Directory (vêm do `vercel.json`).
4. Em **Environment Variables**, adicione:
   - `SUPABASE_URL` = `https://<ref>.supabase.co`
   - `SUPABASE_ANON_KEY` = a chave publishable/anon
5. Clique em **Deploy**. O script recusa a publicação se receber uma chave `service_role`/`secret`.
6. No Supabase, em **Authentication → URL Configuration**, coloque a URL da Vercel em **Site URL**.

Depois do primeiro deploy, cada `git push` na branch principal publica uma nova versão.

---

## Testes

Detalhes e roteiro manual em [`docs/testes.md`](docs/testes.md).

| Teste | Como rodar |
|---|---|
| Regras do banco (45 verificações, sem gravar nada) | Colar `tests/sql/regras.sql` no SQL Editor e executar |
| Concorrência (2 a 10 chamadas simultâneas) | `cd tests && npm install && node concorrencia.mjs 10` |
| RLS e regras pela API | `cd tests && node regras-api.mjs` |

---

## Documentação

- [Interfaces e usabilidade](docs/interfaces.md)
- [Testes](docs/testes.md)
- [Manual de operação](docs/manual-operacao.md)
- [Manual de treinamento](docs/manual-treinamento.md)
- [Homologação](docs/homologacao.md)

## Fora do escopo

Pagamento online, nota fiscal eletrônica, notificações por WhatsApp/SMS e app nativo.
