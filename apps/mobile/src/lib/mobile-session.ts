/** Minimum identity used by the experience; independent of the login provider. */
export interface MobileSession {
  access_token: string;
  user: { id: string; email?: string };
}
