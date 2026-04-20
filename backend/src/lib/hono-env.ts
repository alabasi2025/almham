import type { AuthContext } from '../middleware/auth.js';

export interface HonoVariables {
  auth: AuthContext;
}

export interface HonoEnv {
  Variables: HonoVariables;
}
