// create-user.js
const readline = require('readline');
const sequelize = require('./config/database');
const User = require('./models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createUser() {
  await sequelize.sync();

  rl.question('Introduce el nombre de usuario: ', (username) => {
    rl.question('Introduce la contraseña: ', (password) => {
      rl.question('Introduce el rol (profesor o alumno): ', async (role) => {
        if (role !== 'profesor' && role !== 'alumno') {
          console.error("Error: El rol debe ser 'profesor' o 'alumno'.");
          rl.close();
          await sequelize.close();
          return;
        }

        try {
          const newUser = await User.create({
            username,
            password, // El hook en el modelo se encargará de encriptarla
            role
          });
          console.log(`¡Usuario '${newUser.username}' con rol '${newUser.role}' creado exitosamente!`);
        } catch (error) {
          console.error('Error al crear el usuario:', error.message);
        } finally {
          rl.close();
          await sequelize.close();
        }
      });
    });
  });
}

createUser();