export interface ValidEnv {
  PORT: number;
  JWT_SECRET: string;
  ADMIN_USER: string;
  ADMIN_PASSWORD: string;
  DB_PATH: string;
  NODE_ENV: string;
}

export function validateEnv(config: Record<string, unknown>): ValidEnv {
  const env = config as Record<string, string | undefined>;
  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number');
  const dbPath = env.DB_PATH || 'data/valkyrie.db';
  if (env.NODE_ENV === 'production' && (!env.JWT_SECRET || env.JWT_SECRET.length < 16)) {
    throw new Error('JWT_SECRET must be set to at least 16 characters in production');
  }
  return {
    PORT: port,
    JWT_SECRET: env.JWT_SECRET || 'valkyrie-dev-secret-change-me',
    ADMIN_USER: env.ADMIN_USER || 'admin',
    ADMIN_PASSWORD: env.ADMIN_PASSWORD || 'valkyrie',
    DB_PATH: dbPath,
    NODE_ENV: env.NODE_ENV || 'development',
  };
}
