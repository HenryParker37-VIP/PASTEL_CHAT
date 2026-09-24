function shouldStartTelegramPolling(env = process.env) {
  return env.TELEGRAM_POLLING === 'true';
}

module.exports = { shouldStartTelegramPolling };
