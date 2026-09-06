export interface AuthIdentity {
  subject: string;
  email?: string;
  phone?: string;
}

export interface AuthPort {
  verifyAccessToken(token: string): Promise<AuthIdentity>;
}

export const AUTH_PORT = Symbol("AUTH_PORT");
