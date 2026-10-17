/**
 * Link-preview crawlers + automation + honeypot signals.
 * Real in-app browsers are not matched by broad app names alone.
 */
const BOT_PATTERNS = [
  /facebookexternalhit/i,
  /facebot/i,
  /meta-externalagent/i,
  /twitterbot/i,
  /linkedinbot/i,
  /telegrambot/i,
  /discordbot/i,
  /slackbot/i,
  /slack-imgproxy/i,
  /googlebot/i,
  /bingbot/i,
  /applebot/i,
  /pinterestbot/i,
  /embedly/i,
  /vkshare/i,
  /redditbot/i,
  /snap url preview/i,
  /skypeuripreview/i,
  /ifttt/i,
  /petalbot/i,
  /yandexbot/i,
  /duckduckbot/i,
  /baiduspider/i,
  /rogerbot/i,
  /showyoubot/i,
  /outbrain/i,
  /w3c_validator/i,
  /curl\//i,
  /^wget/i,
  /python-requests/i,
  /python-urllib/i,
  /axios\//i,
  /node-fetch/i,
  /go-http-client/i,
  /java\//i,
  /libwww-perl/i,
  /httpclient/i,
  /okhttp/i,
  /scrapy/i,
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /bytespider/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /dotbot/i,
  /mj12bot/i,
  /gptbot/i,
  /claudebot/i,
  /amazonbot/i,
];

export function isLinkPreviewBot(userAgent = navigator.userAgent) {
  const ua = userAgent || "";
  return BOT_PATTERNS.some((re) => re.test(ua));
}

export function isAutomatedBrowser() {
  if (navigator.webdriver) return true;
  if (window.callPhantom || window._phantom) return true;
  if (window.__nightmare) return true;
  if (window.domAutomation || window.domAutomationController) return true;

  const ua = navigator.userAgent || "";
  if (/HeadlessChrome|PhantomJS|Selenium|Puppeteer|Playwright/i.test(ua)) {
    return true;
  }

  // Missing languages / zero plugins often = headless
  try {
    if (!navigator.languages || navigator.languages.length === 0) return true;
  } catch {
    /* ignore */
  }

  return false;
}

/** Skip tracking / permissions for crawlers and automation */
export function shouldSkipVisitorFlow() {
  return isLinkPreviewBot() || isAutomatedBrowser();
}

/** Classify stored visit (DB flag + heuristics for older rows) */
export function visitLooksLikeBot(visit) {
  if (!visit) return false;
  if (visit.is_bot === true) return true;
  if (visit.is_bot === false) return false;

  const di = visit.device_info || {};
  if (di.visitKind === "bot") return true;
  if (di.flags?.webdriver) return true;
  if (di.honeypot?.hit) return true;

  const ua = di.userAgent || "";
  return isLinkPreviewBot(ua) || /HeadlessChrome|PhantomJS/i.test(ua);
}
