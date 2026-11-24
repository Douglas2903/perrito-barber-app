# Interfaces — Perrito Barber App 3.0 (item 3.g)

Este documento descreve cada tela, o que ela faz e por que foi desenhada assim. As justificativas se apoiam nas **10 heurísticas de Nielsen** (H1 a H10), em **mobile first** e em acessibilidade (WCAG).

## Princípios gerais

| Decisão | Justificativa |
|---|---|
| **Mobile first** (360 px até desktop) | A maioria dos clientes agenda pelo celular, e o barbeiro consulta a agenda entre um atendimento e outro. O layout é pensado para a tela pequena e ganha colunas em telas maiores. |
| **Menu inferior no celular, superior no desktop** | No celular, o polegar alcança a base da tela com facilidade. No desktop, o menu no topo é o padrão esperado (H4 — consistência e padrões). |
| **Botões e alvos com no mínimo 48 px** | Recomendação de área de toque para dedos; reduz toques errados (H5 — prevenção de erros). |
| **Tema escuro com destaque dourado** | Visual sóbrio de barbearia, igual em todas as telas. Contraste verificado: texto principal `#f2f2f3` e texto secundário `#b4b4bd` sobre fundo `#121214`, ambos acima de 4,5:1 (WCAG AA). |
| **Português do Brasil, R$ e dd/mm/aaaa** | Linguagem do usuário (H2 — correspondência com o mundo real). As datas são formatadas pelo próprio app no fuso `America/Sao_Paulo`, qualquer que seja o fuso ou o idioma do aparelho. |
| **Estados de carregamento e de lista vazia** | Toda lista mostra "Carregando…" enquanto busca os dados e uma mensagem explicativa quando não há itens (H1 — visibilidade do estado do sistema). |
| **Mensagens de erro claras** | Os erros técnicos são traduzidos (ex.: "E-mail ou senha incorretos.") e as regras do banco já devolvem mensagens em português que dizem o que fazer (H9 — ajudar a reconhecer e corrigir erros). |
| **Confirmação antes de ações destrutivas** | Cancelar, excluir conta, desativar barbeiro e remover bloqueio pedem confirmação num modal (H3 — controle e liberdade; H5). |
| **Acessibilidade** | HTML semântico, rótulos ligados aos campos, `aria-live` nos resumos, link "Pular para o conteúdo", foco visível e modais nativos (`<dialog>`), que prendem o foco e fecham com Esc. |

---

## Telas públicas

### Login (`#/login`)
**O que faz:** entrada com e-mail e senha. Depois do login, cada papel vai direto para a sua tela inicial.

**Usabilidade:**
- Formulário curto, com `autocomplete` para o gerenciador de senhas e teclado de e-mail no celular.
- O erro aparece no próprio formulário, e a senha fica selecionada para nova digitação (H9).
- Link visível para "Criar conta" (H6 — reconhecer em vez de lembrar).

### Criar conta (`#/cadastro`)
**O que faz:** cadastro de cliente com nome, telefone, e-mail e senha. Toda conta nasce como cliente.

**Usabilidade:**
- Validação campo a campo, com a mensagem abaixo do campo e foco no primeiro erro (H5, H9).
- Máscara automática do telefone, `(11) 98765-4321` (H5).
- **Aviso de LGPD** antes do botão: diz que só nome, telefone e e-mail são coletados e para quê (H10 — ajuda e documentação; transparência exigida pela LGPD).

---

## Cliente

### Novo agendamento (`#/agendar`) — RF04, RF05, RF06
**O que faz:** assistente em 5 passos.
1. **Serviços:** múltipla escolha com preço e duração de cada um. O rodapé mostra a duração e o valor somados em tempo real.
2. **Barbeiro:** um dos barbeiros ativos ou "Qualquer profissional".
3. **Data:** uma faixa com os dias de funcionamento (terça a sábado) dos próximos 60 dias.
4. **Horário:** os horários livres, de 15 em 15 minutos, calculados pelo banco. Com "qualquer profissional", informa quem vai atender.
5. **Confirmação:** data, horário, barbeiro, endereço e a tabela de serviços com o **total que será cobrado**.

**Usabilidade:**
- Um passo por vez reduz a carga cognitiva, e a barra de progresso mostra onde o usuário está (H1).
- "Continuar" só fica ativo quando o passo está válido. Domingo e segunda nem aparecem como opção (H5).
- "Voltar" em todos os passos, sem perder o que já foi escolhido (H3).
- O resumo fixo no rodapé mantém o valor sempre visível (H6).
- Se outra pessoa reservar o horário durante a confirmação, a tela volta aos horários com a mensagem "Esse horário acabou de ser ocupado. Escolha outro." e recarrega a lista (H9).

### Meus horários (`#/meus-agendamentos`) — RF09, RD04
**O que faz:**
- **Próximos:** agendamentos confirmados, cada um com botão "Cancelar" e motivo opcional.
- **Histórico:** concluídos e cancelados, com o motivo do cancelamento.
- **Minha conta e privacidade:** botão "Excluir minha conta".

**Usabilidade:**
- Os cartões trazem cor e etiqueta de status (Confirmado, Concluído, Cancelado), sem depender só da cor (H1, acessibilidade).
- A exclusão de conta explica as consequências antes da confirmação (H5, LGPD).

---

## Barbeiro

### Minha agenda (`#/minha-agenda`) — RF08
**O que faz:**
- Mostra os atendimentos **apenas do próprio barbeiro**, um dia por vez. A restrição é garantida pela RLS no banco.
- Mostra também as folgas e compromissos, o expediente e o almoço do dia, a quantidade de atendimentos e o valor previsto.
- Cada atendimento traz o cliente, com o telefone clicável (`tel:`), e o botão "Marcar como concluído" a partir do horário de início.

**Usabilidade (mobile first, 360–414 px):**
- Coluna única, horários em fonte grande e botões que ocupam a largura toda: dá para usar com uma mão.
- Setas ‹ › que pulam domingo e segunda, botão "Hoje" e "Ir para data" (H7 — flexibilidade e eficiência).
- A data aparece por extenso ("Terça-feira, 24/11/2026"). O seletor nativo fica oculto porque o formato dele depende do idioma do navegador (H4).
- Testada sem rolagem horizontal em 360 px e 414 px.

---

## Gerente

### Agenda geral (`#/agenda`) — RF07, RF09
**O que faz:**
- **Visão diária:** uma coluna por barbeiro, lado a lado, com linhas de 15 minutos. Almoço, horário fora do expediente e bloqueios aparecem sombreados, e os agendamentos ficam posicionados no horário.
- **Visão semanal:** de terça a sábado, com a lista compacta de cada dia. Clicar no dia abre a visão diária.
- Clicar num agendamento abre um modal com os detalhes e as ações **Concluir**, **Cancelar** (com motivo) e **Trocar barbeiro** (só lista os barbeiros ativos). O banco valida a escala e o conflito do novo barbeiro.

**Usabilidade:**
- A grade com as colunas lado a lado permite ver de relance quem está livre (H6, H8 — estética e design minimalista).
- Cada nível tem uma cor (dourado, azul e verde) para identificar o barbeiro na semana.
- Os cancelados não poluem a grade e ficam num resumo expansível.
- No celular, a grade rola na horizontal dentro do próprio quadro, sem quebrar a página.

### Equipe (`#/equipe`) — RF02, RF03
**O que faz:**
- Cartão por barbeiro, com nível, status, login vinculado e o resumo da escala semanal.
- Ações: **Escala** (início, fim e almoço de 1h por dia), **Editar**, **Vincular/Remover login** (pelo e-mail de uma conta existente) e **Desativar/Reativar**.
- **Folgas e compromissos:** criar um bloqueio (dia inteiro ou intervalo de horas, com o resumo do período em dd/mm/aaaa) e remover.

**Usabilidade:**
- Horários escolhidos em listas de 15 em 15 minutos, dentro do funcionamento. Não há como digitar um horário inválido (H5).
- Se a mudança deixaria um cliente agendado sem atendimento (escala, bloqueio ou desativação), o banco recusa e a mensagem diz qual agendamento resolver antes (H9).

### Serviços (`#/servicos`)
**O que faz:** tabela para editar preço, duração e ativo de cada serviço, e cadastrar serviços novos.

**Usabilidade:**
- Edição direto na linha, com "Salvar" por serviço (H7).
- Um aviso fixo explica que reajustes não mudam os agendamentos já feitos, porque o preço é congelado (H10, RD05).

### Indicadores (`#/indicadores`) — RF10
**O que faz:** por barbeiro e período, mostra atendimentos realizados (concluídos), cancelamentos e faturamento (soma dos valores cobrados), com linha de total. Os períodos prontos são "Últimos 7 dias", "Este mês" e "Mês passado", e há a opção "Personalizado".

**Usabilidade:**
- Os atalhos de período cobrem os usos mais comuns em um toque (H7).
- Um texto abaixo da tabela define cada métrica, para evitar interpretações diferentes (H10).
- Números alinhados à direita e valores em R$.
