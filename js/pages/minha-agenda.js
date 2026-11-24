// Tela provisória — implementada na etapa 4.
import { criarCabecalhoPagina, criarVazio } from '../utils/ui.js';

export function montar(container) {
  container.append(criarCabecalhoPagina('Minha agenda'), criarVazio('Em construção', 'Esta tela chega na etapa 4.'));
}
