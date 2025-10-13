const express = require('express');
const router = express.Router();
const path = require('path');
const Setting = require('../models/Setting');

// Middleware para proteger todas las rutas de este archivo
function esProfesor(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'profesor') {
    return next();
  }
  res.status(403).redirect('/login.html');
}
router.use(esProfesor); // Aplicamos el middleware a todo el router

// Ruta para servir la página de configuración de nombrado (la principal del profesor)
router.get('/config-naming', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'config-naming.html'));
});

// Ruta para servir la página de configuración del prompt
router.get('/config-prompt', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'profe.html'));
});

// Ruta para guardar los criterios de nombrado
router.post('/save-naming-criteria', async (req, res) => {
    const { fields, order, customFormat } = req.body;
    try {
        const criteria = { fields: fields || [], order: order || [], customFormat: customFormat || '' };
        await Setting.upsert({
            key: 'naming_criteria',
            value: JSON.stringify(criteria) // Guardamos la configuración como un texto JSON
        });
        res.json({ message: 'Criterios guardados correctamente.' });
    } catch (error) {
        console.error('Error al guardar criterios:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Ruta para actualizar el prompt
router.post('/update-prompt', async (req, res) => {
    // ¡CAMBIO! Leemos 'prompt' en lugar de 'newPrompt' para coincidir con tu HTML
    const { prompt } = req.body; 
    if (!prompt || prompt.trim() === '') {
        return res.status(400).json({ error: 'El prompt no puede estar vacío.' });
    }

    try {
        await Setting.upsert({ key: 'initial_prompt', value: prompt });
        
        // Actualizamos la variable global en el servidor
        req.app.locals.initialPrompt = prompt;

        res.json({ message: 'Prompt actualizado correctamente.' });
    } catch (error) {
        console.error('Error al actualizar el prompt:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;