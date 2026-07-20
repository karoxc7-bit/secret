# Landing + consent + admin dashboard

پەڕەی نێوان بۆ سەردانکەر: **ئاگاداری ڕوون**، هەڵبژاردنی لۆکەیشن/کامێرا، کۆکردنەوەی IP و زانیاری ئامێر، دواتر گواستنەوە بۆ لینکی تۆ (وەک Facebook).

---

## ١) Supabase (یەکجار)

1. بچۆ [supabase.com](https://supabase.com) → **New project**.
2. **SQL Editor** → هەموو ناوەڕۆکی `supabase/schema.sql` copy/paste بکە → **Run**.
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

## ٤) `config.js`

فایلی `config.js` لە ڕepۆدا هەیە (تەنها **publishable** key). دەتوانیت `redirectUrl` بگۆڕیت:

```javascript
redirectUrl: "https://www.facebook.com/karoxghafoor"
```

گۆڕانکاری → `git add config.js` → `git commit` → `git push` → چەند خولەک چاوەڕوان بکە بۆ نوێبوونی Pages.

---

## ٥) دۆمەینی تایبەت (ئارەزوومەندانە — example.com)

1. GitHub → **Settings** → **Pages** → **Custom domain** → `example.com`.
2. لە تۆمارکاری DNS (Cloudflare, Namecheap, …):
   - **A** records بۆ IP‑ەکانی GitHub Pages، یان
   - **CNAME** `www` → `USERNAME.github.io`
3. چاوەڕێی SSL بکە (خۆکار لە GitHub).
4. لە Supabase **Site URL** بگۆڕە بۆ `https://example.com/`.

---

## ٦) تاقیکردنەوە

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
