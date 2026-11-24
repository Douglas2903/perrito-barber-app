// =============================================================================
// Tela: Gerente — Serviços
// Editar preço e duração, ativar/desativar e cadastrar serviços.
// Reajustes não afetam agendamentos já feitos (preço congelado — RD05).
// =============================================================================
import { atualizarServico, criarServico, listarTodosServicos } from '../services/servicos.js';
import { formatarDuracao } from '../utils/datas.js';
import { formatarMoeda, lerValorDigitado } from '../utils/moeda.js';
import {
  ErroDeValidacao, abrirModal, comBotaoOcupado, criarAviso, criarCabecalhoPagina, criarCampo, criarCarregando,
  criarVazio, h, mensagemDeErro, notificar, substituirConteudo,
} from '../utils/ui.js';
import { validarNome } from '../utils/validacao.js';

const DURACOES = Array.from({ length: 16 }, (_, i) => (i + 1) * 15); // 15 min a 4 h

export async function montar(container) {
  const areaTabela = h('div', {}, criarCarregando());

  container.append(
    criarCabecalhoPagina('Serviços', 'Preço e duração usados nos próximos agendamentos.',
      h('button', { type: 'button', class: 'botao', onclick: novoServico }, 'Novo serviço')),
    criarAviso('Mudanças de preço valem só para agendamentos novos. Os já marcados mantêm o valor combinado.'),
    h('div', { class: 'margem-topo' }, areaTabela));

  async function carregar() {
    try {
      const servicos = await listarTodosServicos();
      substituirConteudo(areaTabela, servicos.length
        ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'tabela' },
          h('thead', {}, h('tr', {},
            h('th', {}, 'Serviço'), h('th', {}, 'Preço (R$)'), h('th', {}, 'Duração'), h('th', {}, 'Ativo'), h('th', {}, ''))),
          h('tbody', {}, servicos.map(criarLinha))))
        : criarVazio('Nenhum serviço cadastrado', 'Use "Novo serviço".'));
    } catch (erro) {
      substituirConteudo(areaTabela, criarAviso(mensagemDeErro(erro), 'erro'));
    }
  }

  function criarLinha(servico) {
    const preco = h('input', {
      type: 'text', inputmode: 'decimal', value: Number(servico.preco).toFixed(2).replace('.', ','),
      'aria-label': `Preço de ${servico.nome}`, size: 8,
    });
    const duracao = h('select', { 'aria-label': `Duração de ${servico.nome}` },
      DURACOES.map((minutos) => h('option', { value: minutos, selected: minutos === servico.duracao_min }, formatarDuracao(minutos))));
    const ativo = h('input', { type: 'checkbox', checked: servico.ativo, 'aria-label': `${servico.nome} ativo` });
    const botaoSalvar = h('button', { type: 'button', class: 'botao botao--secundario botao--pequeno' }, 'Salvar');

    botaoSalvar.addEventListener('click', async () => {
      const valor = lerValorDigitado(preco.value);
      if (Number.isNaN(valor)) {
        notificar(`Preço inválido em "${servico.nome}". Use o formato 60,00.`, 'erro');
        preco.focus();
        return;
      }
      try {
        await comBotaoOcupado(botaoSalvar, () => atualizarServico(servico.id, {
          preco: valor, duracao_min: Number(duracao.value), ativo: ativo.checked,
        }));
        notificar(`"${servico.nome}" atualizado: ${formatarMoeda(valor)}, ${formatarDuracao(Number(duracao.value))}${ativo.checked ? '' : ' (inativo)'}.`);
        carregar();
      } catch (erro) {
        notificar(mensagemDeErro(erro), 'erro');
      }
    });

    return h('tr', { class: servico.ativo ? '' : 'linha-inativa' },
      h('td', {}, h('strong', {}, servico.nome)),
      h('td', {}, preco),
      h('td', {}, duracao),
      h('td', {}, ativo),
      h('td', {}, botaoSalvar));
  }

  async function novoServico() {
    const nome = criarCampo({ id: 'servico-nome', rotulo: 'Nome', atributos: { maxlength: 100 } });
    const preco = criarCampo({ id: 'servico-preco', rotulo: 'Preço (R$)', atributos: { inputmode: 'decimal', placeholder: '60,00' } });
    const duracao = criarCampo({
      id: 'servico-duracao', rotulo: 'Duração', tag: 'select',
      opcoes: DURACOES.map((m) => h('option', { value: m, selected: m === 30 }, formatarDuracao(m))),
    });

    const criado = await abrirModal({
      titulo: 'Novo serviço',
      conteudo: [nome.elemento, h('div', { class: 'linha-campos' }, preco.elemento, duracao.elemento)],
      acoes: [
        { texto: 'Cancelar', classe: 'botao--secundario', valor: false },
        {
          texto: 'Criar serviço',
          aoConfirmar: async () => {
            const erroNome = validarNome(nome.controle.value);
            nome.mostrarErro(erroNome);
            const valor = lerValorDigitado(preco.controle.value);
            preco.mostrarErro(Number.isNaN(valor) ? 'Use o formato 60,00.' : '');
            if (erroNome || Number.isNaN(valor)) throw new ErroDeValidacao('Corrija os campos destacados.');
            await criarServico({ nome: nome.controle.value.trim(), preco: valor, duracao_min: Number(duracao.controle.value) });
            return true;
          },
        },
      ],
    });
    if (criado) {
      notificar('Serviço criado.');
      carregar();
    }
  }

  carregar();
}
