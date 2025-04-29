// ==========================================
// UTILS MODULE - Funções utilitárias e auxiliares
// ==========================================

/**
 * Calcula média móvel para um conjunto de valores históricos
 * @param {Array<number>} historico - Conjunto de valores históricos
 * @returns {number} - Média móvel
 */
export function calcularMediaMovel(historico) {
    if (historico.length === 0) return 0;
    return historico.reduce((a, b) => a + b, 0) / historico.length;
  }
  
  /**
   * Limita um valor dentro de um intervalo com tendência a voltar ao alvo
   * @param {number} valor - Valor atual
   * @param {number} min - Limite mínimo
   * @param {number} max - Limite máximo
   * @param {number} valorAlvo - Valor alvo para o qual o sistema tende a retornar
   * @returns {number} - Valor limitado com tendência
   */
  export function limitarComCurva(valor, min, max, valorAlvo) {
    if (valor < min) valor = min;
    if (valor > max) valor = max;
    
    const distanciaDoAlvo = Math.abs(valor - valorAlvo);
    
    if (valor > valorAlvo) {
      const fatorCorrecao = 1 - Math.min(0.2, distanciaDoAlvo * 0.01);
      return valor * fatorCorrecao + valorAlvo * (1 - fatorCorrecao);
    } else if (valor < valorAlvo) {
      const fatorCorrecao = 1 - Math.min(0.2, distanciaDoAlvo * 0.01);
      return valor * fatorCorrecao + valorAlvo * (1 - fatorCorrecao);
    }
    
    return valor;
  }