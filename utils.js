const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Configuración de la API de Gemini
const apiKey = 'AIzaSyDAt1S0PuyuG5B3x4NViJFhBUOLp6_v_nM';
const modelName = 'gemini-2.0-flash';

// Carpeta para guardar historiales
const chatLogsDir = path.join(__dirname, 'chat_logs');
// NUEVO: Asegurar que la carpeta chat_logs exista antes de usarla
if (!fs.existsSync(chatLogsDir)) {
  fs.mkdirSync(chatLogsDir, { recursive: true });
  console.log(`Carpeta ${chatLogsDir} creada.`);
}

// Función para generar respuesta de Gemini
async function generateGeminiResponse(messages) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const data = {
    contents: messages.map(message => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }]
    }))
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API Error:', errorData);
      return `Gemini API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`;
    }

    const responseData = await response.json();
    const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.warn('Gemini API returned an empty response:', responseData);
      return 'Gemini API returned an empty response.';
    }

    return responseText;

  } catch (error) {
    console.error('Error fetching from Gemini API:', error);
    return `Error: ${error.message}`;
  }
}

// Función para formatear la respuesta
function formatGeminiResponse(responseText) {
  let formattedText = responseText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  formattedText = formattedText.replace(/:(?!\s)/g, ': ');
  formattedText = formattedText.replace(/\n/g, '<br>');
  return formattedText;
}

// Guarda el historial de la conversación en un archivo
function saveChatHistoryToFile(sessionId, history, customFilename) {
  // NUEVO: Usar la ruta absoluta con chatLogsDir y el nombre personalizado
  const filename = customFilename ? path.join(chatLogsDir, customFilename) : path.join(chatLogsDir, `chat_${sessionId}.txt`);
  let fileContent = '';

  history.forEach(message => {
    const sender = message.role === 'user' ? 'Usuario' : 'Bot';
    fileContent += `${sender}: ${message.content.replace(/\n/g, '\\n')}\n`;
  });

  fs.writeFileSync(filename, fileContent, 'utf8');
  console.log(`Chat history saved to ${filename}`);
}

// Inicializa la conversación con el prompt inicial
async function initializeConversation(sessionId, conversationHistory, initialPrompt, customFilename) {
  if (!conversationHistory[sessionId]) {
    conversationHistory[sessionId] = [];
    // Agregar el prompt inicial como mensaje del usuario
    conversationHistory[sessionId].push({ role: 'user', content: initialPrompt });
    // Generar respuesta inicial del bot
    const rawResponse = await generateGeminiResponse(conversationHistory[sessionId]);
    const botResponse = formatGeminiResponse(rawResponse);
    // Agregar respuesta del bot al historial
    conversationHistory[sessionId].push({ role: 'model', content: rawResponse });
    // NUEVO: Asegurar que el guardado use la carpeta chat_logs con el nombre personalizado
    saveChatHistoryToFile(sessionId, conversationHistory[sessionId], customFilename);
    return botResponse;
  }
  return null;
}

module.exports = {
  generateGeminiResponse,
  formatGeminiResponse,
  saveChatHistoryToFile,
  initializeConversation
};