# Landing + consent + admin dashboard

پەڕەی نێوان بۆ سەردانکەر: **ئاگاداری ڕوون**، هەڵبژاردنی لۆکەیشن/کامێرا، کۆکردنەوەی IP و زانیاری ئامێر، دواتر گواستنەوە بۆ لینکی تۆ (وەک Facebook).

---

## ١) Supabase (یەکجار)

1. بچۆ [supabase.com](https://supabase.com) → **New project**.
2. **SQL Editor** → `supabase/schema.sql` (یان ئەگەر پێشتر جێبەجێ کردووە تەنها `supabase/settings.sql`) → **Run**.
3. **Authentication** → **Users** → **Add user** → ئیمەیڵ + وشەی نهێنی **ئەدمین** (بۆ `/admin/`).
4. **Authentication** → **URL configuration** → لە **Site URL** بنووسە:
   - `https://USERNAME.github.io/REPO-NAME/` (دوای ئەوەی GitHub Pages چالاک بوو، ئەم URL‑ە نوێ بکەرەوە).
5. **Project Settings** → **API** — URL و publishable key لە `config.js` دان.\  
   ⚠️ **کلیلی `sb_secret_` هەرگیز لە GitHub یان براوزەر مەهێڵە.**

---

## ٢) GitHub — دروستکردنی ڕepۆ و push

### ئامادە لە کۆمپیوتەر

```powershell
cd C:\Users\karox\Desktop\secret
git init
git branch -M main
git add .
git commit -m "Initial site for GitHub Pages"
```

### ڕepۆی نوێ لە GitHub

**ڕێگەی A — وێب:** [github.com/new](https://github.com/new) → ناو ( بۆ نمونە `secret`) → Public → دروست بکە.

**ڕێگەی B — CLI** (ئەگەر `gh` دامەزراوە):

```powershell
gh auth login
gh repo create secret --public --source=. --remote=origin --push
```

**ڕێگەی C — دەستی:**

```powershell
git remote add origin https://github.com/USERNAME/secret.git
git push -u origin main
```

`USERNAME` و `secret` بگۆڕە بە ناوی خۆت.

---

## ٣) چالاککردنی GitHub Pages

1. لە ڕepۆ: **Settings** → **Pages**.
2. **Build and deployment** → **Source:** **Deploy from a branch**.
3. **Branch:** `main` · **Folder:** `/ (root)` → **Save**.
4. دوای ٢–٥ خولەک URL دەردەکەوێت:

> ئەگەر workflowی Actions هەڵەی «Get a Pages site failed» بدات: لە Settings → Pages **GitHub Actions** هەڵنەبژێرە مەگەر بەتەنها Actions deploy بەکاربهێنیت. ئەم پڕۆژەیە بە **branch deploy** کافییە؛ پێویست بە `pages.yml` نییە.

| بەش | URL |
|-----|-----|
| سەردانکەر | `https://USERNAME.github.io/REPO/` |
| ئەدمین | `https://USERNAME.github.io/REPO/admin/` |

5. لە Supabase **Site URL** بگۆڕە بۆ هەمان لینکی سەردانکەر (هەنگاوی ١).

---

## ٤) لینکی گواستنەوە (ئەدمین)

دوای چوونەژوورەوە لە **`/admin/`** → بەشی **لینکی گواستنەوە** → URL بنووسە (وەک `https://www.facebook.com/karoxghafoor`) → **پاشەکەوت**. سەردانکەران دواتر بۆ ئەو لینکە دەچن؛ پێویست بە گۆڕینی `config.js` نییە.

---

## ٥) `config.js`

فایلی `config.js` لە ڕepۆدا هەیە (تەنها **publishable** key). دەتوانیت `redirectUrl` بگۆڕیت:

```javascript
redirectUrl: "https://www.facebook.com/karoxghafoor"
```

گۆڕانکاری → `git add config.js` → `git commit` → `git push` → چەند خولەک چاوەڕوان بکە بۆ نوێبوونی Pages.

---

## ٦) دۆمەینی تایبەت — `toktik.lol` (Porkbun)

### A) GitHub

1. ڕepۆ **secret** → **Settings** → **Pages**
2. لە **Custom domain** بنووسە: `toktik.lol` → **Save**
3. چاوەڕێ بکە تا **DNS check** سەوز بێت و **HTTPS** چالاک ببێت (تا ٢۴ کاتژمێر)
4. فایلی `CNAME` لە ڕepۆدا `toktik.lol`ە (پush کراوە)

**لینکەکان دوای چالاکبوون:**

| بەش | URL |
|-----|-----|
| سەردانکەر | `https://toktik.lol/` |
| ئەدمین | `https://toktik.lol/admin/` |

### B) Porkbun → DNS (toktik.lol)

**URL Forwarding** بەتاڵ بهێڵە — تەنها DNS.

لە **DNS Records** ئەمانە زیاد بکە (ئەگەر تۆمارێکی پێشوو هەیە بۆ `@` سڕی بکەرەوە):

| Type | Host | Answer |
|------|------|--------|
| **A** | `@` (یان blank) | `185.199.108.153` |
| **A** | `@` | `185.199.109.153` |
| **A** | `@` | `185.199.110.153` |
| **A** | `@` | `185.199.111.153` |
| **CNAME** | `www` | `karoxc7-bit.github.io` |

(ئەگەر Porkbun **ALIAS** بۆ root هەیە، دەتوانیت `@` → `karoxc7-bit.github.io` بەکاربهێنیت لەجیاتی 4 A.)

**www:** لە GitHub دەتوانیت `www.toktik.lol` زیاد بکەیت؛ لە Porkbun CNAMEی سەرەوە پێویستە.

### C) Supabase

**Authentication** → **URL configuration**:

- **Site URL:** `https://toktik.lol/`
- **Redirect URLs:** `https://toktik.lol/admin/`

### D) SSL

SSL لە **GitHub Pages** خۆکار دێت (Let's Encrypt). لە Porkbun «SSL: Nothing Yet» ئاساییە — پێویست ناکات SSL لە Porkbun بکڕیت بۆ ئەم شێوازە.

---

## ٧) تاقیکردنەوە

1. لە مۆبایل/PC بکەرەوە `https://USERNAME.github.io/REPO/`.
2. ڕەزامەندی تاقی بکە → دەبێت لە Supabase **Table Editor** → `visits` ڕیزێک زیاد ببێت.
3. `/admin/` → چوونەژوورەوە بە ئیمەیڵ/وشەی ئەدمین → لیستی سەردانەکان.

**کامێرا/لۆکەیشن:** تەنها لە **HTTPS** کار دەکات (GitHub Pages HTTPS هەیە).

---

## هۆستی فری

| خزمەت | نرخ |
|--------|-----|
| GitHub Pages | فری |
| Supabase (free tier) | فری |

---

## یاسایی

سەردانکەر پێش کۆکردنەوە ئاگادار دەکرێتەوە. بۆ بەکارهێنانی گشتی سیاسەتی تایبەtmەندی زیاد بکە.

## پێکهاتە

```
index.html
admin/index.html
js/
css/
config.js
supabase/schema.sql
```
