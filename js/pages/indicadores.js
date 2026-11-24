// Tela provisória — implementada na etapa 6.
import { criarCabecalhoPagina, criarVazio } from '../utils/ui.js';

export function montar(container) {
  container.append(criarCabecalhoPagina('Indicadores'), criarVazio('Em construção', 'Esta tela chega na etapa 6.'));
}
