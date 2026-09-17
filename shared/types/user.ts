import { Role } from '../constants/roles.js';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  status: string;
  isActive: boolean;
  emailVerified: Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastLoginAt: string | Date | null;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  status: string;
  permissions: string[];
  lastLoginAt: string | Date | null;
  createdAt: string | Date;
}
