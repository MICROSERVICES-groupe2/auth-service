import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type UserRole = 'CLIENT' | 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export interface UserAttributes {
  id: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  twoFaSecret: string | null;
  twoFaEnabled: boolean;
  isActive: boolean;
  googleId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes,
  'id' | 'passwordHash' | 'twoFaSecret' | 'twoFaEnabled' | 'isActive' | 'googleId'
> {}

export class User extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes {
  declare id: string;
  declare email: string;
  declare passwordHash: string | null;
  declare role: UserRole;
  declare twoFaSecret: string | null;
  declare twoFaEnabled: boolean;
  declare isActive: boolean;
  declare googleId: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('CLIENT', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN'),
      defaultValue: 'CLIENT',
      allowNull: false,
    },
    twoFaSecret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    twoFaEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
  }
);