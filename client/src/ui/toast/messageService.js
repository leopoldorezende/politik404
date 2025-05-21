// messageService.js - Um serviço para controlar e exibir mensagens em toda a aplicação

// Uma variável para armazenar a referência para o componente Toast
let messageRef = null;

// Configurar a referência do componente Toast
export const setMessageRef = (ref) => {
  messageRef = ref;
};

// Verificar se o messageRef está definido
const checkRef = () => {
  if (!messageRef) {
    console.warn('MessageRef não está definido. Certifique-se de configurar a ref antes de chamar os métodos.');
    return false;
  }
  return true;
};

// Exibir uma mensagem
export const showMessage = (message, type = 'info', duration = 5000) => {
  if (!checkRef()) return null;
  return messageRef.show(message, type, duration);
};

// Exibir uma mensagem de erro
export const showError = (message, duration = 5000) => {
  if (!checkRef()) return null;
  return messageRef.show(message, 'error', duration);
};

// Exibir uma mensagem de sucesso
export const showSuccess = (message, duration = 5000) => {
  if (!checkRef()) return null;
  return messageRef.show(message, 'success', duration);
};

// Exibir uma mensagem de aviso
export const showWarning = (message, duration = 5000) => {
  if (!checkRef()) return null;
  return messageRef.show(message, 'warning', duration);
};

// Exibir uma mensagem de informação
export const showInfo = (message, duration = 5000) => {
  if (!checkRef()) return null;
  return messageRef.show(message, 'info', duration);
};

// Remover uma mensagem específica por ID
export const dismissMessage = (id) => {
  if (!checkRef()) return;
  messageRef.dismiss(id);
};

// Remover todas as mensagens
export const dismissAllMessages = () => {
  if (!checkRef()) return;
  messageRef.dismissAll();
};

// Simular um alert() mas usando o sistema de mensagens
export const showAlert = (message, type = 'info') => {
  if (!checkRef()) {
    // Fallback para o alert() nativo se a ref não estiver disponível
    alert(message);
    return;
  }
  
  // Criar uma mensagem que permanecerá até o usuário clicar nela
  // Utilizando duration = 0 para que a mensagem não seja removida automaticamente
  return messageRef.show(message, type, 0);
};

const MessageService = {
  setMessageRef,
  showMessage,
  showError,
  showSuccess,
  showWarning,
  showInfo,
  dismissMessage,
  dismissAllMessages,
  showAlert
};

export default MessageService;