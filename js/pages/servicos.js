// Tela provisória — implementada na etapa 5.
import { criarCabecalhoPagina, criarVazio } from '../utils/ui.js';

export function montar(container) {
  container.append(criarCabecalhoPagina('Serviços'), criarVazio('Em construção', 'Esta tela chega na etapa 5.'));
}
