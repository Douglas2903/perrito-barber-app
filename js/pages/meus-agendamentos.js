// Tela provisória — implementada na etapa 3.
import { criarCabecalhoPagina, criarVazio } from '../utils/ui.js';

export function montar(container) {
  container.append(criarCabecalhoPagina('Meus horários'), criarVazio('Em construção', 'Esta tela chega na etapa 3.'));
}
