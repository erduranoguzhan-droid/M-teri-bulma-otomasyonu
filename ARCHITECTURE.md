# Mimari — Vertex Lead Gen

Bu doküman sistemin nasıl çalıştığını, modüllerin sorumluluklarını ve nereye nasıl
yeni özellik ekleneceğini özetler. Ayrıntılı kullanım için [README.md](README.md).

## Genel Bakış

İki modlu bir müşteri-kazanım sistemi. Ortak çekirdek katman + bağımsız modüller +
sabit `LeadStore` arayüzü sayesinde depolama (JSON ⇄ Supabase) kod değişmeden takılır.

```
SEKTÖR MODU:   BUL(Maps) → ZENGİNLEŞTİR(site) → ANALİZ(LLM) → TEKLİF(LLM)
FİRMA MODU:    BUL(isim) → DERİN ENRİCH(çok-sayfa+DNS) → AI INTELLIGENCE → RAKİP ANALİZİ
               (RAKİP ANALİZİ opsiyonel/additive; deep derinlikte otomatik)
GÖSTER:        Dashboard (Kokpit + Insights) · CLI list
```

**Çekirdek ilke — AI UYDURMAZ.** Veri yoksa `insufficient_data` / boş dizi / `null`.
Sayısal skorlar LLM tahmini değil, sinyallerden **deterministik** hesaplanır
(`computeScores`, `computeIntelScores`, `computeCompetitivePressure`).

## Katmanlar

| Katman | Yol | Sorumluluk |
|---|---|---|
| Çekirdek | `src/core/` | Tipler, config, `LeadStore` arayüzü, LLM köprüsü, skorlama, eşzamanlılık havuzu |
| Modüller | `src/modules/` | finder / enricher / analyzer / outreach — her biri tek sorumluluk, arayüzle bağlı |
| Orkestrasyon | `src/*.ts` | `pipeline`, `scan`, `companyScan`, `rescore`, `reenrich`, `competitors`, `migrate` |
| Dashboard | `dashboard/app/` | Next.js 16 arayüz; aynı depoyu okur/yazar |

### `src/core/`
- **types.ts** — `Lead` veri modeli (find→enrich→analyze→outreach aşama aşama zenginleşir).
- **storage.ts** — `LeadStore` arayüzü + `JsonLeadStore` / `SupabaseLeadStore`. `createStore()` config'e göre seçer.
- **config.ts** — env okuma (LLM backend, eşzamanlılık, Supabase, `COMPETITOR_MAX`…).
- **llm.ts** — `llmJson()`: backend'e göre `cli` (claude -p, Max) veya `api` (Anthropic) + retry/backoff.
- **scoring.ts** — sektör-modu deterministik skorlar.
- **intelligence.ts** — firma-modu tipler + `computeIntelScores` (opsiyonel `competitivePressure`, additive) + rakip matris/baskı yardımcıları.
- **pool.ts** — `mapPool` eşzamanlılık havuzu (izole hata, resumable ölçek).

### `src/modules/`
- **finder/googleMaps.ts** — Playwright scraper. `findCompanies` (sektör) + `findBestPlace` (isimle en iyi eşleşen tek yer).
- **finder/byName.ts** — `findCompanyByName`: `findBestPlace`'i sarar, koordinat/placeId çıkarır.
- **enricher/enrich.ts** — sektör-modu hafif site zenginleştirme.
- **enricher/deepEnrich.ts** — firma-modu çok-sayfa keşif + tech stack + DNS/e-posta + karar verici/sinyal.
- **analyzer/analyze.ts** — sektör-modu LLM analizi (playbook + hizmet eşleştirme).
- **analyzer/intelligence.ts** — firma-modu AI Sales Intelligence (nitel katman; skorlar koddan).
- **analyzer/competitors.ts** — rakip önerisi + gerçek tarama + matris + nitel özet.
- **outreach/generate.ts** — kişiselleştirilmiş WhatsApp/e-posta.

## Veri modeli

`Lead` tek nesne; aşamalar opsiyonel alanlarla eklenir (`enrichment`, `analysis`,
`outreach`, `intelligence`). `intelligence.competitors` ve `scanMode` **additive** —
sektör modu ve eski kayıtlar etkilenmez. Supabase'de iç içe veriler `jsonb`.

## LLM backend

`.env` `LLM_BACKEND`: `cli` (Max aboneliği, API kredisi yok, rate-limit'li) veya
`api` (Haiku, ölçek için hızlı/ucuz). `llmJson` her ikisini de aynı Zod şemasıyla
sarar; geçici hatada üstel backoff. Toplu işlemler `mapPool` ile eşzamanlı ve resumable.

## Skorlama felsefesi

Tüm skorlar sinyallerden deterministik. Kurallar değişince LLM harcamadan yeniden
uygulanır: `rescore` (sektör), `competitors` (rakip analizi ekle/yenile). Rakip baskısı
`urgency`/`priority`'ye additive beslenir; `competitivePressure` verilmezse davranış birebir korunur.

## Dashboard

`dashboard/app/` — Next.js 16. Server component'ler depoyu okur; server action'lar yazar.
- **/** (Kokpit) — "🎯 Bugün" iş kuyruğu, pipeline hunisi, skor histogramı, pipeline değeri, `LeadExplorer` (arama/filtre/toplu işlem/CSV).
- **/insights** — analitik: skor/sektör dağılımı, hizmet talebi, rakip istihbaratı (baskı dağılımı, olgunluk kıyası, pazar boşluğu), pipeline değeri. Grafikler `lib/insights.ts` (saf hesap) + `components/InsightCharts.tsx` (dataviz kurallı bar + hover tooltip).
- **/lead/[id]** — detay: skorlar + "neden bu skor", zenginleştirme, `IntelligencePanel` + `CompetitorPanel`, hazır mesajlar, insan-onaylı gönderim.
- Tipler `dashboard/app/lib/types.ts`'te **elle aynalanır** (ayrı Next projesi) — `src/core` değişince güncelle.

### Tema & renk (globals.css)

Tek kaynak `globals.css`: **dark varsayılan** + `[data-theme=light]` override. Kural —
**component'te hardcoded renk yok**, her renk bir token. Aksi halde bir tema sessizce kırılır
(ışık temasında `rgba(255,255,255,…)` kenarlıklar görünmez olur).

| Token | Ne için |
|---|---|
| `--paper` / `--surface` / `--elevated` / `--border` / `--border-soft` | yüzey & kenarlık |
| `--ink` / `--muted` | metin (metin **her zaman** ink token'ı giyer, seri rengini değil) |
| `--accent` + `--accent-ink` / `--accent-soft` | vurgu |
| `--good` / `--warn` / `--bad` / `--neutral` / `--info` (+ `-bg` çiftleri) | **durum** renkleri |
| `--band-ink` | durum bandı **dolgusu üzerindeki** metin (dark koyu / light beyaz) |

**Skor bandı = durum, kategorik kimlik değil.** `scoreBand()` → `s-hot|s-warm|s-mid|s-low`;
badge için `.s-*` (arka planlı), büyük sayı için `.score-band-s-*` (renk-yalnız). Histogram
bantları da aynı eşlemeyi kullanır — aynı kavram her yerde aynı renk.

**Dataviz renkleri** (`page.tsx` bantları, `insights` grafikleri, `CRM_STATUSES`) durum
token'ı değildir; değiştirmeden önce paleti doğrula (dataviz skill'i, `validate_palette.js`)
— kontrast ≥3:1 ve komşu çiftlerde normal-görüş ΔE ≥15 gerekir. Kazanıldı/Kaybedildi'nin
yeşil-kırmızısı bilinçli: status konvansiyonu, yanında etiket taşır.

### Tarama süreci (dashboard → CLI)

Dashboard taramayı **detached CLI süreci** olarak başlatır; ilerleme `data/scan-status.json`
üzerinden paylaşılır (dosya = tek kanal).

- **Süreç ölürse bayrak asılı kalır.** "Aktif mi?" sorusunun tek cevabı `isScanActive`
  (30 dk timeout). Okuyucular **`readScanStatusNormalized()`** kullanır — ölü tarama
  `running:false` + `stale:true` olarak döner. Client asla ham `running`'e bakmamalı,
  yoksa panel sonsuza kadar "çalışıyor" gösterir.
- **Süreç başlatma her zaman `lib/spawn.ts`** üzerinden. Windows'ta `npm` bir `.cmd` ve Node
  onu `shell:false` ile reddeder (EINVAL) → `shell:true` zorunlu → argümanlar **tırnaklanmalı**.
  Tırnaksız hâli boşluklu değerleri parçalar ("kafe, restoran") ve kullanıcı metnini
  komut enjeksiyonuna açar. Boş bayrak (`--districts ""`) gönderme: CLI sonraki bayrağı
  değer sanır.

## Uzatma noktaları

| İstenen | Nereye |
|---|---|
| Yeni sektör | `src/core/services.ts` `SECTOR_KEYWORDS` + `SECTOR_PLAYBOOK` (+ `dashboard/app/lib/sectors.ts`) |
| Yeni tech imzası | `deepEnrich.ts` `detectTechStack` / `detectBasicTech` |
| Yeni rakip yeteneği | `intelligence.ts` `COMPETITOR_CAPABILITY_LABELS` + `competitorCapabilities` |
| Yeni kaynak (IG/LinkedIn) | `src/modules/finder/` altına yeni modül; `RawCompany` döndür |
| Yeni depolama | `LeadStore` implementasyonu (`storage.ts`) |
| Yeni grafik | `lib/insights.ts` saf fonksiyon + `InsightCharts.tsx` (paleti validator'dan geçir) |
| Yeni renk/durum | `globals.css` token çifti (dark + light) — component'e hex yazma |
| CLI'yi panelden çağırma | `lib/spawn.ts` `spawnNpmDetached` (elle `spawn` kullanma) |

## Doğrulama

- Tip: kökte `npm run typecheck`; dashboard `npx tsc --noEmit`.
- Deterministik mantık: küçük test scriptleri (ağ/LLM'siz) — matris/baskı/skor.
- Uçtan uca: `npm run scan:company -- --names "..." --depth deep` → depo kaydında
  `intelligence.competitors` + dashboard render.
