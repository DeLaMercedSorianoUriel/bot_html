const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const path = require('path');
const {
  generateGeminiResponse,
  formatGeminiResponse,
  saveChatHistoryToFile,
  initializeConversation
} = require('./utils');

// NUEVO: Importar el módulo os para obtener la IP de la máquina
const os = require('os');

const app = express();
const port = 3000;

// Variable global para el prompt inicial
let INITIAL_PROMPT = '';

// Almacenamiento de historiales de conversación
const conversationHistory = {};

// Configuración de la sesión
app.use(session({
  secret: 'your-secret-key', // Cambia esto por una clave más segura
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Cambia a true si usas HTTPS
}));

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Middleware para restringir acceso a /profe a localhost
function restrictToLocalhost(req, res, next) {
  const clientIp = req.ip;
  if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === '::ffff:127.0.0.1') {
    next();
  } else {
    res.status(403).send('Acceso denegado: esta página solo está disponible desde localhost.');
  }
}

// Ruta principal
app.get('/', (req, res) => {
  let sessionId = req.session.sessionId;

  // Generar ID de sesión si no existe
  if (!sessionId) {
    sessionId = uuidv4();
    req.session.sessionId = sessionId;
  }

  // Servir el archivo index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta para obtener la respuesta inicial del bot
app.get('/initial-message', async (req, res) => {
  let sessionId = req.session.sessionId;

  if (!sessionId) {
    sessionId = uuidv4();
    req.session.sessionId = sessionId;
  }

  // Inicializar conversación y obtener respuesta inicial
  const initialBotResponse = await initializeConversation(sessionId, conversationHistory, INITIAL_PROMPT);

  // Enviar respuesta inicial al frontend
  res.json({ response: initialBotResponse || '' });
});

// Ruta para procesar los mensajes del chat
app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  let sessionId = req.session.sessionId;

  // Generar ID de sesión si no existe
  if (!sessionId) {
    sessionId = uuidv4();
    req.session.sessionId = sessionId;
  }

  // Inicializar historial si no existe
  if (!conversationHistory[sessionId]) {
    conversationHistory[sessionId] = [];
  }

  // Agregar mensaje del usuario
  conversationHistory[sessionId].push({ role: 'user', content: userMessage });

  // Obtener respuesta de Gemini
  const rawResponse = await generateGeminiResponse(conversationHistory[sessionId]);
  const botResponse = formatGeminiResponse(rawResponse);

  // Agregar respuesta del bot
  conversationHistory[sessionId].push({ role: 'model', content: rawResponse });

  // Guardar historial en archivo
  saveChatHistoryToFile(sessionId, conversationHistory[sessionId]);

  // Enviar respuesta al frontend
  res.json({ response: botResponse, sessionId: sessionId });
});

// Ruta para servir profe.html (solo localhost)
app.get('/profe', restrictToLocalhost, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profe.html'));
});

// Ruta para actualizar el INITIAL_PROMPT (solo localhost)
app.post('/update-prompt', restrictToLocalhost, (req, res) => {
  const newPrompt = req.body.prompt?.trim();
  if (!newPrompt) {
    return res.status(400).json({ error: 'El prompt no puede estar vacío.' });
  }
  INITIAL_PROMPT = newPrompt;
  res.json({ message: 'Prompt inicial actualizado correctamente.' });
});

// NUEVO: Obtener IP automáticamente
// MODIFICADO: Obtener IP automáticamente
// Función para obtener la dirección IPv4 de la máquina (no localhost)
function getServerIp() {
  // Obtener todas las interfaces de red
  const interfaces = os.networkInterfaces();
  // Iterar sobre todas las interfaces
  for (const ifaceName in interfaces) {
    // Buscar una dirección IPv4 no interna
    const iface = interfaces[ifaceName].find(
      addr => addr.family === 'IPv4' && !addr.internal
    );
    // Devolver la primera dirección IPv4 no interna encontrada
    if (iface) {
      return iface.address;
    }
  }
  // Fallback: devolver null si no se encuentra una IP adecuada
  return null;
}

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  // NUEVO: Mostrar la IP del servidor en la consola
  const serverIp = getServerIp();
  if (serverIp) {
    console.log(`Server listening at http://${serverIp}:${port}`);
  } else {
    console.log(`Server listening at http://<IP>:${port} (no se pudo detectar la IP automáticamente)`);
  }
  console.log(`Prompt configuration page available at http://localhost:${port}/profe`);
});