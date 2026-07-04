# Vertex Lead Gen — Çekirdek Döngü (v0.1)

Vertex için otomatik müşteri kazanım sisteminin **çekirdek döngüsü**. Türkiye + restoran/kafe sektörü için uçtan uca çalışır. Minimum bütçe: kendi scraper'ımız + sadece LLM maliyeti.

```
BUL → ZENGİNLEŞTİR → ANALİZ → TEKLİF → (GÖSTER: CLI listesi)
```

- **BUL** — Google Maps'ten firma çeker (Playwright, sıfır API maliyeti)
- **ZENGİNLEŞTİR** — website tarar; teknoloji (GA, Meta Pixel, WhatsApp, online sipariş, e-ticaret, **blog/içerik**) + **CMS/platform** (WordPress/Wix/Shopify…) + **site güncelliği (telif yılı)** + e-posta + sosyal medya (IG/FB/LinkedIn/YouTube/X/TikTok)
- **ANALİZ** — Claude: **otomatik sektör tespiti** (kategori/isimden) + sektöre özel playbook ile en büyük problem, otomasyon fırsatı, hizmet eşleştirme, Lead/ICP/Aciliyet skoru
  - Sektörler: `restoran-kafe`, `saglik-klinik`, `eticaret-perakende`, `uretim-sanayi`, `genel` (`src/core/services.ts`). Yeni sektör = `SECTOR_KEYWORDS` + `SECTOR_PLAYBOOK`'a bir giriş.
- **TEKLİF** — kişiselleştirilmiş Türkçe WhatsApp + e-posta taslağı

## Kurulum

```bash
npm install
npx playwright install chromium
cp .env.example .env      # ANTHROPIC_API_KEY'i doldur
```

## Kullanım

```bash
# Tüm döngü (bul → zenginleştir → analiz → teklif)
npm run pipeline -- "kafe Kadıköy İstanbul" 15

# Çoklu-sorgu tarama (ölçek): ilçe × kategori → otomatik sorgular
npm run scan -- --city "İstanbul" --districts "Kadıköy,Beşiktaş,Şişli" --categories "kafe,restoran" --max 15

# Adım adım
npm run find     -- "restoran Çankaya Ankara" 20
npm run enrich
npm run analyze
npm run outreach

# Sonuçlar
npm run list              # skora göre sıralı liste
npm run list -- 1         # tek leadin tüm detayı + mesaj taslakları

# Yeniden skorlama (kural degisince, LLM'siz/bedava — sektore duyarli uygular)
npm run rescore

# Yeniden zenginlestirme (website'leri tekrar tara; derin enrichment guncellemesi, LLM'siz)
npm run reenrich                    # website'i olan tum leadler
npm run reenrich -- uretim-sanayi   # sadece o sektor

# Outreach mesajlarini yeniden uret (ton kurallari degisince; sektor filtreli)
npm run outreach:regen                    # tum analizli leadler
npm run outreach:regen -- uretim-sanayi   # sadece o sektor
```

## Dashboard (web arayüzü)

`dashboard/` — Next.js 16 arayüzü. Aynı `data/leads.json`'ı okur/yazar (CLI ile ortak).

```bash
cd dashboard
npm install
npm run dev        # http://localhost:3000
```

- **"+ Yeni Tarama"** formu: **sektör şablonları** (tek tıkla kategori doldurur) + şehir/ilçe/kategori + canlı ilerleme
- Ana sayfa **kokpit**: metrikler + **"🎯 Bugün" çalışma kuyruğu** (takip zamanı gelenler + dokunulmamış sıcak yeni leadler) + **Pipeline hunisi** + **Pipeline değeri** + arama/filtre
  - **Arama** (isim/kategori/şehir) + **sektör / durum / skor filtreleri** (çip) + Skor/En-yeni sıralama (`LeadExplorer`, client-side)
  - Her satırda **sektör rozeti** (otomatik tespit)
  - **Toplu işlem:** çoklu seçim (satır checkbox + "Tümünü seç") → toplu statü değişimi (alt çubuk)
  - **CSV indir:** filtrelenmiş leadleri UTF-8 BOM'lu CSV olarak dışa aktar (Excel uyumlu)
- Detay: **sonraki en iyi aksiyon** banner'ı + sektör rozeti + skorlar + **"neden bu skor" kırılımı** + **elle anlaşma değeri** (tahmini geçersiz kılar) + **zenginleştirme** (platform/blog/telif + teknoloji + sosyal medya) + hazır WhatsApp/e-posta mesajları
- **Skor dağılımı** (sektör bazında histogram) + pipeline değeri metrikleri
- CRM statü değişimi: detay sayfasında dropdown (server action ile JSON'a yazar)
- **İnsan onaylı gönderim:** "WhatsApp'ta Aç" (wa.me, mesaj dolu) + "E-posta Aç" (mailto).
  Tıklayınca senin cihazından açılır **ve** otomatik "İletişim Kuruldu" + tarih + +3 gün takip işaretlenir.
  Ban/KVKK riski yok — mesaj senin hesabından, senin onayınla gider.
- **Follow-up:** takip zamanı gelenler ana sayfada listelenir; "Ertele +3g" ile ötelenir.
  Statü "Toplantı/Kazanıldı/Kaybedildi"ye geçince takip otomatik temizlenir.

## LLM Backend seçimi (ÖNEMLİ — ölçek notu)

`.env` içinde `LLM_BACKEND`:
- `cli` (varsayılan): Claude Code / Max aboneliği üzerinden, **API kredisi harcamaz**. `CLI_MODEL=sonnet`.
  Düşük hacim için ideal. **Ancak toplu taramada (15+ lead) Max rate-limit'e takılabilir** — bu yüzden
  `llmJson`'da otomatik retry + pace var; yine de yüksek hacimde yavaş ve bazı çağrılar yeniden denenir.
- `api`: Anthropic API (`ANTHROPIC_API_KEY`) + Haiku. **Ölçek için doğru seçim**: hızlı, güvenilir,
  rate-limit sorunu yok, çok ucuz (yüzlerce lead = kuruşlar). `ANALYZER_MODEL=claude-haiku-4-5`.

**Kural:** deneme/az hacim → `cli` (bedava). Günde yüzlerce lead → `api` (Haiku, kuruşlar).

Bir tarama yarım kalırsa (bazı leadler `enriched`'te kalırsa) sadece `npm run analyze && npm run outreach`
tekrar çalıştır — kaldığı yerden tamamlar (resumable; sadece eksik aşamadakileri işler).

### Eşzamanlılık / ölçek ayarları

Toplu işlemler eşzamanlılık havuzu (`src/core/pool.ts`) ile çalışır:

- **Enrichment** (website tarama) ağ I/O olduğu için backend'den bağımsız paralel: `ENRICH_CONCURRENCY` (varsayılan **4**). Onlarca lead'i saniyeler içinde tarar.
- **LLM (analiz/teklif)** eşzamanlılığı `LLM_CONCURRENCY`: boş bırakılırsa **api=6, cli=1**.
  CLI/Max'te paralellik rate-limit'i **kötüleştirir**, o yüzden seri + backoff. API/Haiku'da rate-limit yok → 6 paralel.
- Geçici hatalar (rate-limit/timeout/bozuk JSON) `LLM_RETRIES` (varsayılan **3**) kez üstel backoff ile denenir.

> **Kanıtlanmış limit:** `cli` backend ~9-10 ardışık analizden sonra Max kullanım tavanına çarpıyor
> (kalan leadler `enriched`'te kalır, sonra tamamlanır). Yüzlerce lead = `LLM_BACKEND=api` şart.

## Supabase'e geçiş (kalıcı DB / deploy)

Varsayılan depolama JSON dosyası. Kalıcı DB + çok kullanıcı + Vercel deploy için Supabase:

1. **Proje aç:** [supabase.com](https://supabase.com) → New Project (ücretsiz tier yeterli).
2. **Şemayı kur:** İki yol var:
   - **SQL Editor (elle):** Proje → SQL Editor → `supabase/schema.sql` içeriğini yapıştır → Run.
   - **Otomatik (önerilen):** `DATABASE_URL='<Session pooler URI>' npm run setup-db`
     (URI: Settings → Database → Connection string → **Session pooler**; `[YOUR-PASSWORD]` yerine DB şifresi).
     `service_role` anahtarı DDL çalıştıramaz; tablo oluşturmak için doğrudan Postgres bağlantısı gerekir.
3. **Anahtarları al:** Proje → Settings → API:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_KEY` (GİZLİ; sadece sunucu tarafında kullanılır)
4. **CLI'ı bağla:** kök `.env`'e ekle:
   ```
   STORAGE_BACKEND=supabase
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJ...
   ```
5. **Mevcut veriyi taşı:** `npm run migrate` (data/leads.json → Supabase; tekrar çalıştırmak güvenli).
6. **Dashboard'ı bağla:** `dashboard/.env.local` oluştur (bkz. `.env.local.example`), aynı 3 değeri koy.

Artık CLI (`scan`/`analyze`/…) ve dashboard aynı Supabase tablosunu kullanır. JSON'a dönmek için `STORAGE_BACKEND=json` yeter.

> **Güvenlik:** `service_role` anahtarı RLS'i bypass eder — asla tarayıcıya/istemciye gönderilmez, sadece sunucu (CLI + Next server) kullanır. `.env` / `.env.local` git'e girmez.

## Mimari

`src/core/` ortak katman (tipler, config, `LeadStore` arayüzü). `src/modules/` bağımsız modüller (finder / enricher / analyzer / outreach). Her modül tek sorumluluk, arayüz üzerinden bağlı.

**Depolama:** v0'da JSON dosya (`data/leads.json`). `LeadStore` arayüzü sabit — ileride Supabase/Postgres adaptörü kod değişmeden takılır.

## Yol Haritası (sonraki modüller)

- [x] Web dashboard (Next.js) — CRM statü yönetimi, metrikler
- [x] İnsan onaylı gönderim (wa.me + mailto) + follow-up takibi
- [x] Çoklu-sorgu tarama (`scan`) + dashboard'dan "Yeni Tarama" butonu + canlı ilerleme
- [x] Supabase adaptörü (`LeadStore` implementasyonu) + migration + dashboard dispatch — **canlı**
- [x] Paralel/batch işleme (eşzamanlılık havuzu + üstel backoff + resumable) — ölçek için
- [x] Çoklu sektör: otomatik sektör tespiti + sektöre özel playbook (restoran-kafe, sağlık-klinik, e-ticaret, üretim-sanayi, genel)
- [x] Skorlama v2: **sektöre duyarlı aciliyet ağırlıkları** (B2B'de tüketici sinyalleri sıfırlanır) + `npm run rescore` (LLM'siz yeniden skorlama)
- [x] Detay 2.0: sektör rozeti + "neden bu skor" kırılımı + zenginleştirme detayları
- [x] Outreach 2.0: **sektöre özel mesaj tonu** (B2B kurumsal ≠ kafe sıcak) + `npm run outreach:regen`
- [x] Pipeline değer analitiği: açık/beklenen(ağırlıklı)/kazanılan değer + kazanma & iletişim oranı (CAC/LTV temeli)
- [ ] Otomatik yanıt işleme (IMAP e-posta / WhatsApp API) — gelen yanıtı CRM'e yaz
- [ ] Yeni sektörler (klinik, e-ticaret) — `SECTOR_PLAYBOOK`'a ekle
- [ ] Yeni kaynaklar (Instagram, LinkedIn) — yeni finder modülü

## Notlar

- Google Maps scraping DOM'a bağlı; kırılırsa `src/modules/finder/googleMaps.ts` seçicilerini güncelle.
- `HEADLESS=false` ile taramayı görünür pencerede izleyebilirsin (debug).
