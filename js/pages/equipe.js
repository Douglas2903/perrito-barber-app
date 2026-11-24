// =============================================================================
// Tela: Gerente — Equipe (RF02, RF03)
// Cadastrar, editar e desativar barbeiros; editar a escala semanal; criar e
// remover bloqueios (folga/compromisso); vincular um usuário (login) a um
// barbeiro pelo e-mail. As regras (horário de funcionamento, agendamentos
// futuros que ficariam órfãos etc.) são validadas pelo banco.
// =============================================================================
import {
  NIVEIS, atualizarBarbeiro, criarBarbeiro, desvincularUsuarioDoBarbeiro, listarTodosBarbeiros,
  promoverUsuarioABarbeiro,
} from '../services/barbeiros.js';
import { criarBloqueio, listarProximosBloqueios, removerBloqueio } from '../services/bloqueios.js';
import { listarEscalas, removerEscala, salvarEscala } from '../services/escalas.js';
import {
  NOMES_DIAS, DIAS_DE_FUNCIONAMENTO, formatarData, formatarDataHora, horaCurta, horaDosMinutos, hojeISO,
  instanteEmSaoPaulo, minutosDaHora, somarDias,
} from '../utils/datas.js';
import {
  ErroDeValidacao, abrirModal, confirmar, criarAviso, criarCabecalhoPagina, criarCampo, criarCarregando, criarVazio,
  h, mensagemDeErro, notificar, substituirConteudo,
} from '../utils/ui.js';
import { validarEmail, validarNome } from '../utils/validacao.js';

// Limites do horário de funcionamento (o banco valida por dia da semana).
const FUNCIONAMENTO = { 2: ['10:00', '20:00'], 3: ['10:00', '20:00'], 4: ['10:00', '20:00'], 5: ['10:00', '20:00'], 6: ['08:00', '19:00'] };

export async function montar(container) {
  const areaBarbeiros = h('div', {}, criarCarregando());
  const areaBloqueios = h('div', {}, criarCarregando());
  let barbeiros = [];

  container.append(
    criarCabecalhoPagina('Equipe', 'Barbeiros, escalas, folgas e acesso ao sistema.',
      h('button', { type: 'button', class: 'botao', onclick: () => editarBarbeiro(null) }, 'Novo barbeiro')),
    h('section', { class: 'secao', 'aria-labelledby': 'titulo-barbeiros' },
      h('h2', { id: 'titulo-barbeiros' }, 'Barbeiros'), areaBarbeiros),
    h('section', { class: 'secao', 'aria-labelledby': 'titulo-bloqueios' },
      h('div', { class: 'cabecalho-pagina' },
        h('h2', { id: 'titulo-bloqueios' }, 'Folgas e compromissos'),
        h('button', { type: 'button', class: 'botao botao--secundario', onclick: () => novoBloqueio() }, 'Novo bloqueio')),
      areaBloqueios));

  // --------------------------------------------------------------- carregar
  async function carregarBarbeiros() {
    try {
      const [lista, escalas] = await Promise.all([listarTodosBarbeiros(), listarEscalas()]);
      barbeiros = lista;
      substituirConteudo(areaBarbeiros, lista.length
        ? h('ul', { class: 'lista lista--grade' }, lista.map((b) => criarCartaoBarbeiro(b, escalas.filter((e) => e.barbeiro_id === b.id))))
        : criarVazio('Nenhum barbeiro cadastrado', 'Use "Novo barbeiro".'));
    } catch (erro) {
      substituirConteudo(areaBarbeiros, criarAviso(mensagemDeErro(erro), 'erro'));
    }
  }

  async function carregarBloqueios() {
    try {
      const bloqueios = await listarProximosBloqueios();
      substituirConteudo(areaBloqueios, bloqueios.length
        ? h('ul', { class: 'lista' }, bloqueios.map(criarItemBloqueio))
        : criarVazio('Nenhuma folga ou compromisso agendado'));
    } catch (erro) {
      substituirConteudo(areaBloqueios, criarAviso(mensagemDeErro(erro), 'erro'));
    }
  }

  function recarregarTudo() {
    carregarBarbeiros();
    carregarBloqueios();
  }

  // ---------------------------------------------------------- apresentação
  function criarCartaoBarbeiro(barbeiro, escalas) {
    const resumoEscala = DIAS_DE_FUNCIONAMENTO.map((dia) => {
      const escala = escalas.find((e) => e.dia_semana === dia);
      return h('li', {}, h('span', { class: 'texto-suave' }, `${NOMES_DIAS[dia].slice(0, 3)} `),
        escala ? `${horaCurta(escala.hora_inicio)}–${horaCurta(escala.hora_fim)}`
          + (escala.almoco_inicio ? ` (almoço ${horaCurta(escala.almoco_inicio)})` : '') : 'folga');
    });

    return h('li', { class: `cartao cartao-barbeiro barbeiro--${barbeiro.nivel}` },
      h('div', { class: 'cartao__titulo' },
        h('div', {}, h('h3', {}, barbeiro.nome), h('span', { class: 'texto-suave texto-pequeno' }, `Nível ${NIVEIS[barbeiro.nivel]}`)),
        h('span', { class: `etiqueta ${barbeiro.ativo ? 'etiqueta--concluido' : 'etiqueta--neutra'}` }, barbeiro.ativo ? 'Ativo' : 'Inativo')),
      h('p', { class: 'texto-pequeno' }, 'Login: ',
        barbeiro.perfil ? h('strong', {}, barbeiro.perfil.email) : h('span', { class: 'texto-suave' }, 'sem acesso ao sistema')),
      h('ul', { class: 'escala-resumo' }, resumoEscala),
      h('div', { class: 'grupo-botoes' },
        h('button', { type: 'button', class: 'botao botao--secundario botao--pequeno', onclick: () => editarEscala(barbeiro, escalas) }, 'Escala'),
        h('button', { type: 'button', class: 'botao botao--secundario botao--pequeno', onclick: () => editarBarbeiro(barbeiro) }, 'Editar'),
        barbeiro.perfil_id
          ? h('button', { type: 'button', class: 'botao botao--fantasma botao--pequeno', onclick: () => desvincular(barbeiro) }, 'Remover login')
          : h('button', { type: 'button', class: 'botao botao--fantasma botao--pequeno', onclick: () => vincularLogin(barbeiro) }, 'Vincular login'),
        h('button', {
          type: 'button',
          class: `botao botao--pequeno ${barbeiro.ativo ? 'botao--perigo' : ''}`,
          onclick: () => alternarAtivo(barbeiro),
        }, barbeiro.ativo ? 'Desativar' : 'Reativar')));
  }

  function criarItemBloqueio(bloqueio) {
    return h('li', { class: 'item-bloqueio item-bloqueio--linha' },
      h('div', {},
        h('strong', {}, bloqueio.barbeiro?.nome ?? ''),
        h('div', {}, `${formatarDataHora(bloqueio.inicio)} até ${formatarDataHora(bloqueio.fim)}`),
        h('div', {}, bloqueio.motivo)),
      h('button', {
        type: 'button',
        class: 'botao botao--fantasma botao--pequeno',
        onclick: async () => {
          if (!await confirmar({ titulo: 'Remover bloqueio?', mensagem: 'O barbeiro volta a ficar disponível nesse período.', textoConfirmar: 'Remover' })) return;
          try {
            await removerBloqueio(bloqueio.id);
            notificar('Bloqueio removido.');
            carregarBloqueios();
          } catch (erro) {
            notificar(mensagemDeErro(erro), 'erro');
          }
        },
      }, 'Remover'));
  }

  // -------------------------------------------------------------- barbeiro
  async function editarBarbeiro(barbeiro) {
    const nome = criarCampo({ id: 'barbeiro-nome', rotulo: 'Nome', atributos: { value: barbeiro?.nome ?? '', maxlength: 100 } });
    const nivel = criarCampo({
      id: 'barbeiro-nivel',
      rotulo: 'Nível',
      tag: 'select',
      opcoes: Object.entries(NIVEIS).map(([valor, rotulo]) => h('option', { value: valor, selected: barbeiro?.nivel === valor }, rotulo)),
    });

    const salvo = await abrirModal({
      titulo: barbeiro ? 'Editar barbeiro' : 'Novo barbeiro',
      conteudo: [nome.elemento, nivel.elemento,
        barbeiro ? null : h('p', { class: 'texto-suave texto-pequeno' },
          'Depois de criar, defina a escala. Para o barbeiro acessar a agenda, use "Vincular login".')],
      acoes: [
        { texto: 'Cancelar', classe: 'botao--secundario', valor: false },
        {
          texto: 'Salvar',
          aoConfirmar: async () => {
            const erroNome = validarNome(nome.controle.value);
            nome.mostrarErro(erroNome);
            if (erroNome) throw new ErroDeValidacao(erroNome);
            const dados = { nome: nome.controle.value.trim(), nivel: nivel.controle.value };
            if (barbeiro) await atualizarBarbeiro(barbeiro.id, dados);
            else await criarBarbeiro(dados);
            return true;
          },
        },
      ],
    });
    if (salvo) {
      notificar('Barbeiro salvo.');
      carregarBarbeiros();
    }
  }

  async function alternarAtivo(barbeiro) {
    const desativando = barbeiro.ativo;
    const confirmado = await confirmar({
      titulo: desativando ? `Desativar ${barbeiro.nome}?` : `Reativar ${barbeiro.nome}?`,
      mensagem: desativando
        ? 'Ele deixa de aparecer para agendamento. Se houver agendamentos futuros, cancele-os ou troque o barbeiro antes.'
        : 'Ele volta a aparecer para agendamento, conforme a escala.',
      textoConfirmar: desativando ? 'Desativar' : 'Reativar',
      perigo: desativando,
    });
    if (!confirmado) return;
    try {
      await atualizarBarbeiro(barbeiro.id, { ativo: !desativando });
      notificar(desativando ? 'Barbeiro desativado.' : 'Barbeiro reativado.');
      carregarBarbeiros();
    } catch (erro) {
      await abrirModal({ titulo: 'Não foi possível desativar', conteudo: [criarAviso(mensagemDeErro(erro), 'erro')], acoes: [{ texto: 'Entendi' }] });
    }
  }

  async function vincularLogin(barbeiro) {
    const email = criarCampo({
      id: 'email-login', rotulo: 'E-mail da conta',
      ajuda: 'A pessoa precisa ter criado uma conta no sistema (tela "Criar conta"). Ela passa a ver só a própria agenda.',
      atributos: { type: 'email', inputmode: 'email' },
    });
    const vinculado = await abrirModal({
      titulo: `Vincular login a ${barbeiro.nome}`,
      conteudo: [email.elemento],
      acoes: [
        { texto: 'Cancelar', classe: 'botao--secundario', valor: false },
        {
          texto: 'Vincular',
          aoConfirmar: async () => {
            const erroEmail = validarEmail(email.controle.value);
            email.mostrarErro(erroEmail);
            if (erroEmail) throw new ErroDeValidacao(erroEmail);
            await promoverUsuarioABarbeiro(email.controle.value.trim(), barbeiro.id);
            return true;
          },
        },
      ],
    });
    if (vinculado) {
      notificar('Usuário vinculado. No próximo acesso ele verá "Minha agenda".');
      carregarBarbeiros();
    }
  }

  async function desvincular(barbeiro) {
    const confirmado = await confirmar({
      titulo: 'Remover acesso?',
      mensagem: `${barbeiro.perfil?.email} deixa de ver a agenda de ${barbeiro.nome} e volta a ser cliente.`,
      textoConfirmar: 'Remover acesso',
      perigo: true,
    });
    if (!confirmado) return;
    try {
      await desvincularUsuarioDoBarbeiro(barbeiro.id);
      notificar('Acesso removido.');
      carregarBarbeiros();
    } catch (erro) {
      notificar(mensagemDeErro(erro), 'erro');
    }
  }

  // ---------------------------------------------------------------- escala
  async function editarEscala(barbeiro, escalasAtuais) {
    const linhas = DIAS_DE_FUNCIONAMENTO.map((dia) => criarLinhaEscala(dia, escalasAtuais.find((e) => e.dia_semana === dia)));

    const salvo = await abrirModal({
      titulo: `Escala de ${barbeiro.nome}`,
      conteudo: [
        h('p', { class: 'texto-suave texto-pequeno' },
          'Terça a sexta: 10h–20h. Sábado: 8h–19h. Domingo e segunda: fechado.'),
        h('div', { class: 'escala-editor' }, linhas.map((l) => l.elemento)),
      ],
      acoes: [
        { texto: 'Cancelar', classe: 'botao--secundario', valor: false },
        {
          texto: 'Salvar escala',
          aoConfirmar: async () => {
            for (const linha of linhas) {
              const valores = linha.ler();
              if (valores) await salvarEscala({ barbeiro_id: barbeiro.id, ...valores });
              else if (escalasAtuais.some((e) => e.dia_semana === linha.dia)) await removerEscala(barbeiro.id, linha.dia);
            }
            return true;
          },
        },
      ],
    });
    if (salvo) {
      notificar('Escala salva.');
      carregarBarbeiros();
    } else {
      carregarBarbeiros(); // reflete o que foi salvo antes de um eventual erro
    }
  }

  function criarLinhaEscala(dia, escala) {
    const [abre, fecha] = FUNCIONAMENTO[dia];
    const horarios = opcoesDeHorario(abre, fecha);
    const trabalha = h('input', { type: 'checkbox', checked: Boolean(escala), id: `trabalha-${dia}` });
    const seletor = (valorAtual, opcoes, rotulo, comVazio = false) => h('select', { 'aria-label': `${rotulo} (${NOMES_DIAS[dia]})` },
      comVazio ? h('option', { value: '' }, 'Sem almoço') : null,
      opcoes.map((hora) => h('option', { value: hora, selected: hora === valorAtual }, hora)));

    const inicio = seletor(horaCurta(escala?.hora_inicio) || abre, horarios, 'Início');
    const fim = seletor(horaCurta(escala?.hora_fim) || fecha, horarios, 'Fim');
    const almoco = seletor(horaCurta(escala?.almoco_inicio), horarios, 'Almoço', true);
    const campos = h('div', { class: 'escala-editor__campos' },
      h('label', {}, 'Início', inicio), h('label', {}, 'Fim', fim), h('label', {}, 'Almoço (1h)', almoco));

    const atualizar = () => { campos.hidden = !trabalha.checked; };
    trabalha.addEventListener('change', atualizar);
    atualizar();

    return {
      dia,
      elemento: h('fieldset', { class: 'escala-editor__dia' },
        h('legend', {}, h('label', { for: `trabalha-${dia}` }, trabalha, ` ${NOMES_DIAS[dia]}`)), campos),
      ler: () => {
        if (!trabalha.checked) return null;
        const almocoFim = almoco.value ? horaDosMinutos(minutosDaHora(almoco.value) + 60) : null;
        return {
          dia_semana: dia,
          hora_inicio: inicio.value,
          hora_fim: fim.value,
          almoco_inicio: almoco.value || null,
          almoco_fim: almocoFim,
        };
      },
    };
  }

  // -------------------------------------------------------------- bloqueio
  async function novoBloqueio() {
    const ativos = barbeiros.filter((b) => b.ativo);
    if (!ativos.length) {
      notificar('Cadastre um barbeiro ativo primeiro.', 'erro');
      return;
    }
    const barbeiro = criarCampo({
      id: 'bloqueio-barbeiro', rotulo: 'Barbeiro', tag: 'select',
      opcoes: ativos.map((b) => h('option', { value: b.id }, b.nome)),
    });
    const dataInicio = criarCampo({ id: 'bloqueio-data-inicio', rotulo: 'Data inicial', atributos: { type: 'date', value: hojeISO(), min: hojeISO() } });
    const dataFim = criarCampo({ id: 'bloqueio-data-fim', rotulo: 'Data final', atributos: { type: 'date', value: hojeISO(), min: hojeISO() } });
    const diaInteiro = h('input', { type: 'checkbox', id: 'bloqueio-dia-inteiro', checked: true });
    const horaInicio = criarCampo({ id: 'bloqueio-hora-inicio', rotulo: 'Das', tag: 'select', opcoes: opcoesDeHorario('08:00', '20:00').map((x) => h('option', { value: x }, x)) });
    const horaFim = criarCampo({ id: 'bloqueio-hora-fim', rotulo: 'Até', tag: 'select', opcoes: opcoesDeHorario('08:00', '20:00').map((x) => h('option', { value: x, selected: x === '20:00' }, x)) });
    const motivo = criarCampo({ id: 'bloqueio-motivo', rotulo: 'Motivo', atributos: { maxlength: 200, placeholder: 'Ex.: Folga, consulta médica, curso' } });
    const resumo = h('p', { class: 'texto-suave texto-pequeno', 'aria-live': 'polite' });
    const horas = h('div', { class: 'linha-campos' }, horaInicio.elemento, horaFim.elemento);

    const periodo = () => {
      const inicio = diaInteiro.checked ? instanteEmSaoPaulo(dataInicio.controle.value, '00:00') : instanteEmSaoPaulo(dataInicio.controle.value, horaInicio.controle.value);
      const fim = diaInteiro.checked ? instanteEmSaoPaulo(somarDias(dataFim.controle.value, 1), '00:00') : instanteEmSaoPaulo(dataFim.controle.value, horaFim.controle.value);
      return { inicio, fim };
    };
    const atualizarResumo = () => {
      horas.hidden = diaInteiro.checked;
      if (!dataInicio.controle.value || !dataFim.controle.value) { resumo.textContent = ''; return; }
      resumo.textContent = diaInteiro.checked
        ? `Dia(s) inteiro(s): de ${formatarData(dataInicio.controle.value)} a ${formatarData(dataFim.controle.value)}.`
        : `De ${formatarData(dataInicio.controle.value)} às ${horaInicio.controle.value} até ${formatarData(dataFim.controle.value)} às ${horaFim.controle.value}.`;
    };
    [dataInicio, dataFim, horaInicio, horaFim].forEach((c) => c.controle.addEventListener('change', atualizarResumo));
    diaInteiro.addEventListener('change', atualizarResumo);
    atualizarResumo();

    const criado = await abrirModal({
      titulo: 'Novo bloqueio',
      conteudo: [
        barbeiro.elemento,
        h('div', { class: 'linha-campos' }, dataInicio.elemento, dataFim.elemento),
        h('label', { class: 'opcao' }, diaInteiro, h('span', { class: 'opcao__titulo' }, 'Dia inteiro (folga)')),
        horas, motivo.elemento, resumo,
      ],
      acoes: [
        { texto: 'Cancelar', classe: 'botao--secundario', valor: false },
        {
          texto: 'Criar bloqueio',
          aoConfirmar: async () => {
            if (!dataInicio.controle.value || !dataFim.controle.value) throw new ErroDeValidacao('Informe as datas.');
            if (motivo.controle.value.trim().length < 2) {
              motivo.mostrarErro('Informe o motivo.');
              throw new ErroDeValidacao('Informe o motivo do bloqueio.');
            }
            const { inicio, fim } = periodo();
            if (new Date(fim) <= new Date(inicio)) throw new ErroDeValidacao('O fim precisa ser depois do início.');
            await criarBloqueio({ barbeiroId: barbeiro.controle.value, inicio, fim, motivo: motivo.controle.value.trim() });
            return true;
          },
        },
      ],
    });
    if (criado) {
      notificar('Bloqueio criado. Esse período não aparece mais para agendamento.');
      carregarBloqueios();
    }
  }

  recarregarTudo();
}

/** Horários de 15 em 15 minutos entre "inicio" e "fim" (inclusive). */
function opcoesDeHorario(inicio, fim) {
  const opcoes = [];
  for (let minuto = minutosDaHora(inicio); minuto <= minutosDaHora(fim); minuto += 15) {
    opcoes.push(horaDosMinutos(minuto));
  }
  return opcoes;
}
