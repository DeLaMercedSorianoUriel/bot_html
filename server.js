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

const os = require('os');

const app = express();
const port = 3000;

// Variable global para el prompt inicial
let INITIAL_PROMPT = '';

// NUEVO: Variable global para almacenar los criterios de nombrado
let namingCriteria = {
  fields: [],
  order: [],
  customFormat: ''
};

// Almacenamiento de historiales de conversación
const conversationHistory = {};

// Configuración de la sesión
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false,}
}));

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// NUEVO: Añadir middleware para evitar que express.static sirva index.html por defecto en la raíz
app.use((req, res, next) => {
  if (req.path === '/' && req.method === 'GET') {
    return next(); // Permite que la ruta personalizada maneje la raíz
  }
  next();
});
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

// NUEVA RUTA PRINCIPAL: Redirige siempre la raíz a student-input.html
app.get('/', (req, res) => {
    res.redirect('/student-input.html');
});

// NUEVO: Método para verificar si se completó student-input.html
function ensureStudentInputCompleted(req, res, next) {
  if (req.ip !== '::1' && req.ip !== '127.0.0.1' && req.ip !== '::ffff:127.0.0.1' && !req.session.customFilename) {
    return res.redirect('/student-input.html');
  }
  next();
}

// Aplicar el middleware de verificación antes de servir el chat
app.get('/index.html', ensureStudentInputCompleted, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta para obtener la respuesta inicial del bot
app.get('/initial-message', ensureStudentInputCompleted, async (req, res) => {
  let sessionId = req.session.sessionId;
  if (!sessionId) {
    sessionId = uuidv4();
    req.session.sessionId = sessionId;
  }
  // NUEVO: Pasar el nombre personalizado al inicializar la conversación
  const initialBotResponse = await initializeConversation(sessionId, conversationHistory, INITIAL_PROMPT, req.session.customFilename);
  res.json({ response: initialBotResponse || '' });
});

// Ruta para procesar los mensajes del chat
app.post('/chat', ensureStudentInputCompleted, async (req, res) => {
  const userMessage = req.body.message;
  let sessionId = req.session.sessionId;
  if (!sessionId) {
    sessionId = uuidv4();
    req.session.sessionId = sessionId;
  }
  if (!conversationHistory[sessionId]) {
    conversationHistory[sessionId] = [];
  }
  conversationHistory[sessionId].push({ role: 'user', content: userMessage });
  const rawResponse = await generateGeminiResponse(conversationHistory[sessionId]);
  const botResponse = formatGeminiResponse(rawResponse);
  conversationHistory[sessionId].push({ role: 'model', content: rawResponse });
  // NUEVO: Usar el nombre personalizado almacenado en la sesión
  saveChatHistoryToFile(sessionId, conversationHistory[sessionId], req.session.customFilename);
  res.json({ response: botResponse, sessionId: sessionId });
});

// Ruta para servir profe.html (solo localhost)
app.get('/profe', restrictToLocalhost, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'config-naming.html'));
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

// Ruta para servir la página de configuración de nombrado (solo localhost)
app.get('/config-naming', restrictToLocalhost, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'config-naming.html'));
});

// Ruta para procesar y guardar los criterios de nombrado
app.post('/save-naming-criteria', restrictToLocalhost, (req, res) => {
  const { fields, order, customFormat } = req.body;
  namingCriteria.fields = Array.isArray(fields) ? fields : [fields];
  namingCriteria.order = Array.isArray(order) ? order : [order];
  namingCriteria.customFormat = customFormat || '';
  res.json({ message: 'Criterios de nombrado guardados correctamente.' });
});

app.get('/get-naming-criteria', (req, res) => {
  res.json(namingCriteria.fields);
});

// Ruta para servir la página de entrada de datos del alumno
app.get('/student-input', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student-input.html'));
});

// Ruta para procesar los datos del alumno y redirigir al chat
app.post('/submit-student-data', (req, res) => {
  const studentData = req.body;
  // Generar nombre de archivo basado en los criterios del profesor y los datos del alumno
  const filenameParts = namingCriteria.fields.map(field => studentData[field] ? studentData[field].replace(/\s+/g, '') : 'unknown');
  const customFilename = filenameParts.join('_') + '.txt';
  // NUEVO: Almacenar el nombre personalizado en la sesión para usarlo en el chat
  req.session.customFilename = customFilename;
  res.redirect('/chat_logs');
});

// Función para obtener la dirección IPv4 de la máquina (no localhost)
function getServerIp() {
  const interfaces = os.networkInterfaces();
  for (const ifaceName in interfaces) {
    const iface = interfaces[ifaceName].find(
      addr => addr.family === 'IPv4' && !addr.internal
    );
    if (iface) {
      return iface.address;
    }
  }
  return null;
}

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  const serverIp = getServerIp();
  // NUEVO: Mostrar solo la IP y puerto sin /student-input.html
  const baseUrl = serverIp ? `http://${serverIp}:${port}/student-input` : `http://<IP>:${port}`;
  if (serverIp) {
    console.log(`Server listening at ${baseUrl}`);
  } else {
    console.log(`Server listening at http://<IP>:${port} (no se pudo detectar la IP automáticamente)`);
  }
  console.log(`Prompt configuration page available at http://localhost:${port}/profe`);
});