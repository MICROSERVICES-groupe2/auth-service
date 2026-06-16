import { sequelize } from '../config/database';
import { User } from './user';
import { RefreshToken } from './RefreshToken';
import { UserPermission } from './UserPermission';

// Relations
User.hasMany(RefreshToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(UserPermission, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserPermission.belongsTo(User, { foreignKey: 'userId' });

export const syncDatabase = async (): Promise<void> => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Tables synchronisées');
  } catch (error) {
    console.error('❌ Erreur sync tables :', error);
    process.exit(1);
  }
};

export { sequelize, User, RefreshToken, UserPermission };