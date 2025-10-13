// config/passport.js
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // 1. Buscar al usuario por su username
        const user = await User.findOne({ where: { username: username } });
        if (!user) {
          return done(null, false, { message: 'Ese usuario no existe' });
        }

        // 2. Comparar la contraseña ingresada con la encriptada en la BD
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
          return done(null, user); // ¡Éxito! El usuario está autenticado
        } else {
          return done(null, false, { message: 'Contraseña incorrecta' });
        }
      } catch (err) {
        return done(err);
      }
    })
  );

  // Guarda el ID del usuario en la sesión
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Recupera los datos del usuario a partir del ID de la sesión
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findByPk(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};