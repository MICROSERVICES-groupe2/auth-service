import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface UserPermissionAttributes {
  id: string;
  userId: string;
  permission: string;
  createdAt?: Date;
}

interface UserPermissionCreationAttributes extends Optional<UserPermissionAttributes, 'id'> {}

export class UserPermission extends Model<UserPermissionAttributes, UserPermissionCreationAttributes>
  implements UserPermissionAttributes {
  declare id: string;
  declare userId: string;
  declare permission: string;
  declare readonly createdAt: Date;
}

UserPermission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    permission: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'user_permissions',
    timestamps: true,
    updatedAt: false,
  }
);