// models/Setting.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Setting = sequelize.define('Setting', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true
  },
  value: {
    type: DataTypes.TEXT, // Usamos TEXT para prompts largos
    allowNull: false
  }
}, {
  timestamps: false // No necesitamos timestamps para esto
});

module.exports = Setting;