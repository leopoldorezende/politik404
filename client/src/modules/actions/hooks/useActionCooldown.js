import { useState, useEffect, useRef } from 'react';

/**
 * Hook personalizado para gerenciar cooldowns de ações
 * @param {number} duration - Duração do cooldown em milissegundos (padrão: 15s)
 * @returns {Object} - Funções para gerenciar cooldowns
 */
const useActionCooldown = (duration = 15000) => {
  // Usar localStorage para persistir os timestamps entre sessões
  const getStoredTimestamps = () => {
    try {
      const stored = localStorage.getItem('tradeCooldowns');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler cooldowns do localStorage:', e);
    }
    return { export: 0, import: 0 };
  };

  // Armazenar timestamps no ref para evitar perda em re-renderizações
  const timestampsRef = useRef(getStoredTimestamps());
  
  // Armazenar tempos restantes para UI
  const [remainingTimes, setRemainingTimes] = useState({
    export: 0,
    import: 0
  });
  
  // Estado para controlar timer ativo
  const [timerActive, setTimerActive] = useState(false);

  // Salvar timestamps no localStorage
  const saveTimestamps = (data) => {
    try {
      localStorage.setItem('tradeCooldowns', JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar cooldowns:', e);
    }
  };

  // Efeito para inicializar cooldowns e atualizar timer
  useEffect(() => {
    // Verificar cooldowns iniciais
    const initializeTimers = () => {
      const now = Date.now();
      const timestamps = timestampsRef.current;
      let anyActive = false;
      const initialTimes = { ...remainingTimes };
      
      Object.keys(timestamps).forEach(type => {
        if (timestamps[type] > 0) {
          const elapsed = now - timestamps[type];
          if (elapsed < duration) {
            initialTimes[type] = Math.ceil((duration - elapsed) / 1000);
            anyActive = true;
          } else {
            timestamps[type] = 0;
            initialTimes[type] = 0;
          }
        }
      });
      
      if (anyActive) {
        setRemainingTimes(initialTimes);
        setTimerActive(true);
        saveTimestamps(timestamps);
      }
    };
    
    // Inicializar ao montar o componente
    initializeTimers();
    
    // Timer para atualizar contagens regressivas
    let timer;
    if (timerActive) {
      timer = setInterval(() => {
        const now = Date.now();
        let anyActive = false;
        let updated = false;
        
        setRemainingTimes(current => {
          const newTimes = { ...current };
          
          Object.keys(timestampsRef.current).forEach(type => {
            if (timestampsRef.current[type] > 0) {
              const elapsed = now - timestampsRef.current[type];
              
              if (elapsed < duration) {
                // Ainda em cooldown
                newTimes[type] = Math.ceil((duration - elapsed) / 1000);
                anyActive = true;
              } else if (newTimes[type] > 0) {
                // Cooldown terminou
                timestampsRef.current[type] = 0;
                newTimes[type] = 0;
                updated = true;
              }
            }
          });
          
          return newTimes;
        });
        
        // Se algum timestamp foi alterado, salvar
        if (updated) {
          saveTimestamps(timestampsRef.current);
        }
        
        // Se não há mais cooldowns, parar timer
        if (!anyActive) {
          setTimerActive(false);
        }
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timerActive, duration]);

  /**
   * Inicia o cooldown para uma ação específica
   * @param {string} actionType - Tipo de ação ('export' ou 'import')
   */
  const startCooldown = (actionType) => {
    // console.log(`Iniciando cooldown para ${actionType}`);
    
    const now = Date.now();
    
    // Atualizar ref e localStorage
    timestampsRef.current[actionType] = now;
    saveTimestamps(timestampsRef.current);
    
    // Atualizar tempo restante e ativar timer
    setRemainingTimes(current => ({
      ...current,
      [actionType]: Math.ceil(duration / 1000)
    }));
    
    setTimerActive(true);
  };

  /**
   * Verifica se uma ação está em cooldown
   * @param {string} actionType - Tipo de ação
   * @returns {boolean} - True se estiver em cooldown
   */
  const isInCooldown = (actionType) => {
    const timestamp = timestampsRef.current[actionType];
    if (!timestamp) return false;
    
    const elapsed = Date.now() - timestamp;
    return elapsed < duration;
  };

  /**
   * Retorna o tempo restante de cooldown em segundos
   * @param {string} actionType - Tipo de ação
   * @returns {number} - Tempo restante em segundos
   */
  const getRemainingTime = (actionType) => {
    return remainingTimes[actionType] || 0;
  };

  return {
    startCooldown,
    isInCooldown,
    getRemainingTime
  };
};

export default useActionCooldown;