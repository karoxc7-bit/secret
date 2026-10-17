/**
 * Silent traps for scripted fillers / crawlers that touch hidden fields.
 * Humans never see these; filled/checked = bot signal.
 */

const STYLE =
  "position:absolute!important;left:-10000px!important;top:-10000px!important;width:1px!important;height:1px!important;opacity:0!important;overflow:hidden!important;pointer-events:none!important;tabindex:-1;";

export function mountHoneypot(root = document.body) {
  if (!root || document.getElementById("ops-hp-root")) return;

  const wrap = document.createElement("div");
  wrap.id = "ops-hp-root";
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = STYLE;

  wrap.innerHTML = `
    <label>website <input type="text" name="website" id="ops-hp-website" autocomplete="off" tabindex="-1" /></label>
    <label>email <input type="email" name="email_confirm" id="ops-hp-email" autocomplete="off" tabindex="-1" /></label>
    <label><input type="checkbox" name="ops_hp_check" id="ops-hp-check" tabindex="-1" /> confirm</label>
    <a id="ops-hp-link" href="/admin/secret-login" tabindex="-1">admin</a>
  `;

  root.appendChild(wrap);

  const link = wrap.querySelector("#ops-hp-link");
  if (link) {
    link.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        sessionStorage.setItem("ops_hp_link", "1");
      },
      true
    );
  }
}

export function honeypotTriggered() {
  const website = document.getElementById("ops-hp-website");
  const email = document.getElementById("ops-hp-email");
  const check = document.getElementById("ops-hp-check");

  if (website && String(website.value || "").trim()) return { hit: true, reason: "hp_website" };
  if (email && String(email.value || "").trim()) return { hit: true, reason: "hp_email" };
  if (check && check.checked) return { hit: true, reason: "hp_check" };
  if (sessionStorage.getItem("ops_hp_link") === "1") return { hit: true, reason: "hp_link" };

  return { hit: false, reason: null };
}
