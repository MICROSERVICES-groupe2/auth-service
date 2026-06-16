import { Sequelize } from 'sequelize';
import { config } from './index';

export const sequelize = new Sequelize(config.db.url, {
  dialect: 'postgres',
  logging: config.nodeEnv === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connecté');
  } catch (error) {
    console.error('❌ Erreur PostgreSQL :', error);
    process.exit(1);
  }
};