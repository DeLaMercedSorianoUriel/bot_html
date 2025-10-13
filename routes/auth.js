const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User'); // Asegúrate de importar el modelo de Usuario

// RUTA POST PARA EL REGISTRO (NUEVA)
router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  try {
    // 1. Verificar si el usuario ya existe
    const existingUser = await User.findOne({ where: { username: username } });
    if (existingUser) {
      // Deberías manejar este error en el frontend, por ahora enviamos un mensaje simple
      return res.status(400).send('El nombre de usuario ya está en uso. <a href="/register.html">Intenta de nuevo</a>.');
    }

    // 2. Crear el nuevo usuario (la contraseña se encripta automáticamente gracias al 'hook' del modelo)
    await User.create({
      username,
      password,
      role
    });

    // 3. Redirigir al login para que pueda iniciar sesión
    res.redirect('/login.html');

  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).send('Hubo un error al registrar el usuario.');
  }
});

// Ruta POST para el login
router.post('/login', passport.authenticate('local', {
  successRedirect: '/', // Si el login es exitoso, redirige a la raíz
  failureRedirect: '/login.html?error=1', // Si falla, vuelve al login
}));

// Ruta para el logout
router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

module.exports = router;