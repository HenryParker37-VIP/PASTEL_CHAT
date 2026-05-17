// Centralized auth provider configuration.
// Checked at module load (compile-time inlining of process.env in CRA).
// Technical errors are logged only in dev mode — never shown to users.

const DEV = process.env.NODE_ENV === 'development';

export const AUTH_PROVIDERS = {
  google: {
    available: !!process.env.REACT_APP_GOOGLE_CLIENT_ID,
    name: 'Google',
    envKey: 'REACT_APP_GOOGLE_CLIENT_ID',
  },
  microsoft: {
    available: !!process.env.REACT_APP_MICROSOFT_CLIENT_ID,
    name: 'Microsoft',
    envKey: 'REACT_APP_MICROSOFT_CLIENT_ID',
  },
  // Future providers — add clientId env var and flip available: true to enable
  apple:    { available: false, name: 'Apple',    envKey: 'REACT_APP_APPLE_CLIENT_ID' },
  discord:  { available: false, name: 'Discord',  envKey: 'REACT_APP_DISCORD_CLIENT_ID' },
  telegram: { available: false, name: 'Telegram', envKey: 'REACT_APP_TELEGRAM_BOT_ID' },
};

if (DEV) {
  Object.entries(AUTH_PROVIDERS).forEach(([id, p]) => {
    if (!p.available) {
      console.info(`[Auth] ${p.name} provider not configured — set ${p.envKey} to enable it.`);
    }
  });
}
