const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path'); // <-- ¡AQUÍ ESTÁ LA CORRECCIÓN!
const SequelizeStore = require('connect-session-sequelize')(session.Store);

// --- 1. CONFIGURACIÓN INICIAL ---
const app = express();
const port = 3000;

const sequelize = require('./config/database');
const User = require('./models/User');
const Setting = require('./models/Setting');

// Usamos app.locals para el prompt, una forma segura de tener variables globales en Express
app.locals.initialPrompt = 'Eres un asistente de ayuda por defecto.';

// --- 2. MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionStore = new SequelizeStore({ db: sequelize });
app.use(
  session({
    secret: 'un_secreto_muy_largo_y_dificil_de_adivinar',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
  })
);

require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// --- 3. RUTAS ---
app.use('/auth', require('./routes/auth'));
app.use('/profesor', require('./routes/profesor'));

// Ruta principal - Redirige a REGISTRO si no está autenticado
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role === 'profesor') {
      res.redirect('/profesor/dashboard');
    } else {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  } else {
    res.redirect('/register.html');
  }
});

// Rutas del chatbot
const { initializeConversation, generateGeminiResponse, formatGeminiResponse, saveChatHistoryToFile } = require('./utils');
const conversationHistory = {};

function esAlumno(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'alumno') {
        return next();
    }
    res.status(403).redirect('/login.html');
}

app.get('/initial-message', esAlumno, async (req, res) => {
  const userId = req.user.id;
  const customFilename = `${req.user.username}_chat.txt`;
  
  // Usamos el prompt desde app.locals
  const prompt = req.app.locals.initialPrompt;
  const initialBotResponse = await initializeConversation(userId, conversationHistory, prompt, customFilename);
  res.json({ response: initialBotResponse || '' });
});

app.post('/chat', esAlumno, async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.user.id;
    const customFilename = `${req.user.username}_chat.txt`;

    if (!conversationHistory[userId]) {
        conversationHistory[userId] = [];
    }
    conversationHistory[userId].push({ role: 'user', content: userMessage });
    const rawResponse = await generateGeminiResponse(conversationHistory[userId]);
    const botResponse = formatGeminiResponse(rawResponse);
    conversationHistory[userId].push({ role: 'model', content: rawResponse });

    saveChatHistoryToFile(userId, conversationHistory[userId], customFilename);
    res.json({ response: botResponse });
});

// --- 4. FUNCIÓN DE ARRANQUE SEGURA ---
async function startServer() {
  try {
    await sequelize.sync({ force: false });
    console.log('Base de datos sincronizada correctamente.');

    const promptSetting = await Setting.findOne({ where: { key: 'initial_prompt' } });
    if (promptSetting) {
      app.locals.initialPrompt = promptSetting.value;
    } else {
      await Setting.create({ key: 'initial_prompt', value: app.locals.initialPrompt });
    }
    console.log('Prompt inicial cargado.');

    app.listen(port, () => {
      console.log(`Servidor corriendo en http://localhost:${port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error);
  }
}

startServer();