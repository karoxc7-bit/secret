/**
 * Link-preview crawlers (social / search). Real in-app browsers are not matched
 * (e.g. avoid broad "WhatsApp" — users open links inside WhatsApp too).
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
  /axios\//i,
  /headlesschrome/i,
  /phantomjs/i,
];

export function isLinkPreviewBot(userAgent = navigator.userAgent) {
  const ua = userAgent || "";
  return BOT_PATTERNS.some((re) => re.test(ua));
}

export function isAutomatedBrowser() {
  if (navigator.webdriver) return true;
  const ua = navigator.userAgent || "";
  return /HeadlessChrome|PhantomJS/i.test(ua);
}

/** Skip tracking / permissions for crawlers and automation */
export function shouldSkipVisitorFlow() {
  return isLinkPreviewBot() || isAutomatedBrowser();
}
