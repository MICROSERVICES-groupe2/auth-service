import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type UserRole = 'CLIENT' | 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export interface UserAttributes {
  id: string;
  email: string;
  passwordHash: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  clientId: string | null;
  role: UserRole;
  twoFaSecret: string | null;
  twoFaEnabled: boolean;
  isActive: boolean;
  isVerified: boolean;
  googleId: string | null;
  fcmToken: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes,
  'id' | 'passwordHash' | 'firstName' | 'lastName' | 'phone' | 'avatarUrl' |
  'twoFaSecret' | 'twoFaEnabled' | 'isActive' | 'isVerified' | 'googleId' | 'fcmToken' | 'clientId'
> {}

export class User extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes {
  declare id: string;
  declare email: string;
  declare passwordHash: string | null;
  declare firstName: string | null;
  declare lastName: string | null;
  declare phone: string | null;
  declare avatarUrl: string | null;
  declare clientId: string | null;
  declare role: UserRole;
  declare twoFaSecret: string | null;
  declare twoFaEnabled: boolean;
  declare isActive: boolean;
  declare isVerified: boolean;
  declare googleId: string | null;
  declare fcmToken: string | null;
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
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    clientId: {
      type: DataTypes.UUID,
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
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fcmToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
  }
);
