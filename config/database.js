// config/database.js
const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'), // Busca el archivo en la raíz del proyecto
  logging: false // Desactiva los logs de SQL en la consola
});

module.exports = sequelize;