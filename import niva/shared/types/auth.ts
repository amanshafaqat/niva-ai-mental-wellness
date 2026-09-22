import { Role } from '../constants/roles.js';
import { User } from './user.js';

export interface GoogleOAuthPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    role: Role;
  };
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  session?: AuthSession;
}
