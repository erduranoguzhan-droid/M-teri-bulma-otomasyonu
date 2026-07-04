# Vercel Deploy Rehberi (dashboard)

Dashboard `dashboard/` alt klasöründe bir **Next.js 16** uygulaması. Supabase'i uzak DB
olarak kullandığı için Vercel'de sorunsuz çalışır — sadece birkaç ayar gerekir.

## Adımlar

1. **GitHub'a yükle** (bkz. ana README / `gh` akışı) — repo hazır olmalı.

2. **Vercel'de proje aç:** [vercel.com/new](https://vercel.com/new) → GitHub reposunu seç (Import).

3. **Root Directory'i `dashboard` yap** (ÖNEMLİ):
   - Import ekranında **Root Directory → Edit → `dashboard`** seç.
   - Böylece Vercel sadece dashboard'u derler; CLI (`src/`) deploy edilmez.
   - Framework otomatik **Next.js** algılanır.

4. **Environment Variables ekle** (Settings → Environment Variables):
   ```
   STORAGE_BACKEND   = supabase
   SUPABASE_URL      = https://xxxx.supabase.co
   SUPABASE_SERVICE_KEY = sb_secret_...      (GİZLİ — sadece burada, git'te değil)
   ```
   Üçünü de **Production** (istersen Preview) ortamına ekle.

5. **Deploy** → birkaç dakikada canlı URL (`https://xxx.vercel.app`).

## Önemli notlar

- **"Yeni Tarama" butonu Vercel'de ÇALIŞMAZ.** Tarama Playwright (tarayıcı) + CLI
  gerektirir; Vercel serverless ortamında bunlar yok. **Tarama yerelde yapılır**
  (`npm run scan` / yerel dashboard), canlı Vercel dashboard'u **oku / yönet / gönder**
  amaçlıdır. Yerelde tarayıp Supabase'e yazarsın, canlı dashboard anında görür.
- `service_role` anahtarı RLS'i bypass eder → **yalnızca Vercel env'inde** (sunucu tarafı),
  asla client'a gitmez. `.env*` git'te yok.
- Aynı Supabase'i hem yerel CLI hem canlı dashboard paylaşır — tek kaynak.

## Yerel + canlı birlikte çalışma

```
Yerel CLI (tarama/analiz)  ─┐
                            ├─►  Supabase (tek DB)  ◄─  Vercel dashboard (canlı)
Yerel dashboard (test)     ─┘
```
