import { useState, useEffect, useRef } from 'react';

/**
 * Hook personalizado para gerenciar cooldowns de ações
 * @param {number} duration - Duração do cooldown em milissegundos (padrão: 15s)
 * @returns {Object} - Funções para gerenciar cooldowns
 */
const useActionCooldown = (duration = 30000) => {

  // Migração de dados antigos (se existir)
  const migrateOldData = () => {
    try {
      const oldData = localStorage.getItem('tradeCooldowns');
      if (oldData && !localStorage.getItem('actionCooldowns')) {
        const parsed = JSON.parse(oldData);
       
        parsed.military_alliance = 0;
        localStorage.setItem('actionCooldowns', JSON.stringify(parsed));
        localStorage.removeItem('tradeCooldowns'); // Remover dados antigos
        console.log('[COOLDOWN] Migrated old trade cooldowns to action cooldowns');
      }
    } catch (e) {
      console.error('Erro na migração de cooldowns:', e);
    }
  };

  // Usar localStorage para persistir os timestamps entre sessões
  const getStoredTimestamps = () => {
    // Executar migração na primeira vez
    migrateOldData();
    
    try {
      const stored = localStorage.getItem('actionCooldowns');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler cooldowns do localStorage:', e);
    }
    return { export: 0, import: 0, military_alliance: 0 };
  };

  // Obter cooldowns de cancelamento
  const getCancelCooldowns = () => {
    try {
      const stored = localStorage.getItem('allianceCancelCooldowns');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler cooldowns de cancelamento:', e);
    }
    return {};
  };

  // Armazenar timestamps no ref para evitar perda em re-renderizações
  const timestampsRef = useRef(getStoredTimestamps());
  const cancelCooldownsRef = useRef(getCancelCooldowns());
  
  // Armazenar tempos restantes para UI
  const [remainingTimes, setRemainingTimes] = useState({
    export: 0,
    import: 0,
    military_alliance: 0
  });
  
  // Estado para controlar timer ativo
  const [timerActive, setTimerActive] = useState(false);

  // Salvar timestamps no localStorage
  const saveTimestamps = (data) => {
    try {
      localStorage.setItem('actionCooldowns', JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar cooldowns:', e);
    }
  };

  // Verificar se está em cooldown (incluindo cancelamento)
  const isInCooldown = (actionType) => {
    const now = Date.now();
    
    // Verificar cooldown normal
    const timestamp = timestampsRef.current[actionType];
    if (timestamp && (now - timestamp) < duration) {
      return true;
    }
    
    return false;
  };

  // Retorna o tempo restante (considerando ambos os tipos de cooldown)
  const getRemainingTime = (actionType) => {
    const now = Date.now();
    let maxRemaining = 0;
    
    // Verificar cooldown normal
    const timestamp = timestampsRef.current[actionType];
    if (timestamp) {
      const normalRemaining = Math.max(0, Math.ceil((duration - (now - timestamp)) / 1000));
      maxRemaining = Math.max(maxRemaining, normalRemaining);
    }
    
    return maxRemaining;
  };

  // Efeito para inicializar cooldowns e atualizar timer
  useEffect(() => {
    // Atualizar referências de cancelamento
    cancelCooldownsRef.current = getCancelCooldowns();
    
    // Verificar cooldowns iniciais
    const initializeTimers = () => {
      const now = Date.now();
      const timestamps = timestampsRef.current;
      const cancelCooldowns = cancelCooldownsRef.current;
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
          const cancelCooldowns = getCancelCooldowns();
          
          Object.keys(timestampsRef.current).forEach(type => {
            let maxRemaining = 0;
            
            // Cooldown normal
            if (timestampsRef.current[type] > 0) {
              const elapsed = now - timestampsRef.current[type];
              
              if (elapsed < duration) {
                maxRemaining = Math.max(maxRemaining, Math.ceil((duration - elapsed) / 1000));
                anyActive = true;
              } else if (newTimes[type] > 0) {
                timestampsRef.current[type] = 0;
                updated = true;
              }
            }
            
            newTimes[type] = maxRemaining;
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
   * @param {string} actionType - Tipo de ação ('export', 'import', 'military_alliance')
   */
  const startCooldown = (actionType) => {
    console.log(`Iniciando cooldown para ${actionType}`);
    
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

  return {
    startCooldown,
    isInCooldown,
    getRemainingTime
  };
};

export default useActionCooldown;