export interface AuthIdentity {
  subject: string;
  email?: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface AuthPort {
  verifyAccessToken(token: string): Promise<AuthIdentity>;
}

export const AUTH_PORT = Symbol("AUTH_PORT");
