"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { startScanAction, startCompanyScanAction } from "../lib/actions";
import { PHASE_LABEL, ITEM_PHASE_LABEL, type ScanStatus } from "../lib/scan-types";

// Sektör şablonları: tek tıkla kategorileri doldurur (sektör-bazlı tarama).
const SECTOR_PRESETS = [
  { emoji: "☕", label: "Restoran/Kafe", categories: "kafe, restoran, kahve dükkanı" },
  { emoji: "🩺", label: "Sağlık/Klinik", categories: "diş kliniği, güzellik merkezi, estetik klinik" },
  { emoji: "🏭", label: "Üretim/Sanayi", categories: "ilaç, kimya sanayi, fabrika" },
  { emoji: "🛍️", label: "E-ticaret/Perakende", categories: "butik, mağaza, konsept mağaza" },
];

type ScanType = "sector" | "company";

export function ScanForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scanType, setScanType] = useState<ScanType>("sector");
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasRunning = useRef(false);

  // Sektör modu alanları
  const [city, setCity] = useState("İstanbul");
  const [districts, setDistricts] = useState("");
  const [categories, setCategories] = useState("kafe, restoran");
  const [max, setMax] = useState(15);

  // Firma modu alanları
  const [names, setNames] = useState("");
  const [coCountry, setCoCountry] = useState("Türkiye");
  const [coCity, setCoCity] = useState("");
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const [coMax, setCoMax] = useState(50);
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("standard");
  // Rakip analizi alanları
  const [withCompetitors, setWithCompetitors] = useState(false);
  const [competitors, setCompetitors] = useState("");
  const [maxCompetitors, setMaxCompetitors] = useState(4);
  // Deep derinlikte rakip analizi her zaman açık (CLI de otomatik yapar).
  const competitorsOn = depth === "deep" || withCompetitors;

  async function poll() {
    const res = await fetch("/api/scan-status", { cache: "no-store" });
    const s: ScanStatus | null = await res.json();
    setStatus(s);
    const active = !!s?.running;
    if (active) wasRunning.current = true;
    if (!active && wasRunning.current) {
      wasRunning.current = false;
      router.refresh();
      stopPolling();
    }
  }

  function startPolling() {
    if (timer.current) return;
    poll();
    timer.current = setInterval(poll, 3000);
  }
  function stopPolling() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  useEffect(() => {
    poll();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitSector() {
    setError(null);
    setBusy(true);
    const res = await startScanAction({ city, districts, categories, max });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Tarama başlatılamadı.");
    wasRunning.current = true;
    startPolling();
  }

  async function submitCompany() {
    setError(null);
    setBusy(true);
    const res = await startCompanyScanAction({
      names, country: coCountry, city: coCity, lang, max: coMax, depth,
      competitors, maxCompetitors, withCompetitors: competitorsOn,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Tarama başlatılamadı.");
    wasRunning.current = true;
    startPolling();
  }

  const running = !!status?.running;

  return (
    <div className="scan-panel">
      <div className="scan-head">
        <button className="btn btn-mail" onClick={() => setOpen((o) => !o)} disabled={running}>
          {running ? "Tarama çalışıyor…" : "+ Yeni Tarama"}
        </button>
        {status && <ScanProgress status={status} />}
      </div>

      {open && !running && (
        <div className="scan-form">
          {/* Tarama Tipi seçimi */}
          <div className="preset-row" role="radiogroup" aria-label="Tarama Tipi">
            <span className="preset-lbl">Tarama Tipi:</span>
            <button
              type="button"
              className={`fchip ${scanType === "sector" ? "on" : ""}`}
              onClick={() => setScanType("sector")}
            >
              🗺️ Sektöre Göre
            </button>
            <button
              type="button"
              className={`fchip ${scanType === "company" ? "on" : ""}`}
              onClick={() => setScanType("company")}
            >
              🎯 Firmaya Göre (AI Intelligence)
            </button>
          </div>

          {scanType === "sector" ? (
            <>
              <div className="preset-row">
                <span className="preset-lbl">Sektör şablonu:</span>
                {SECTOR_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={`fchip ${categories === p.categories ? "on" : ""}`}
                    onClick={() => setCategories(p.categories)}
                  >
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
              <label>
                Şehir
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="İstanbul" />
              </label>
              <label>
                İlçeler (virgülle)
                <input value={districts} onChange={(e) => setDistricts(e.target.value)} placeholder="Kadıköy, Beşiktaş, Şişli" />
              </label>
              <label>
                Kategoriler (virgülle)
                <input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="kafe, restoran" />
              </label>
              <label className="max">
                Sorgu başına
                <input type="number" min={1} max={30} value={max} onChange={(e) => setMax(Number(e.target.value))} />
              </label>
              <button className="btn btn-wa" onClick={submitSector} disabled={busy}>
                {busy ? "Başlatılıyor…" : "Taramayı Başlat"}
              </button>
            </>
          ) : (
            <>
              <label>
                Firma adları (virgül veya satırla ayır)
                <textarea
                  rows={4}
                  value={names}
                  onChange={(e) => setNames(e.target.value)}
                  placeholder={"Pfizer Türkiye\nAcıbadem\nTrendyol\nArçelik"}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </label>
              <label>
                CSV yükle (ilk kolon = firma adı)
                <input type="file" accept=".csv,text/csv" onChange={onCsv} />
              </label>
              <div className="preset-row" style={{ gap: 8 }}>
                <label style={{ flex: 1 }}>
                  Ülke
                  <input value={coCountry} onChange={(e) => setCoCountry(e.target.value)} placeholder="Türkiye" />
                </label>
                <label style={{ flex: 1 }}>
                  Şehir
                  <input value={coCity} onChange={(e) => setCoCity(e.target.value)} placeholder="(opsiyonel)" />
                </label>
              </div>
              <div className="preset-row" style={{ gap: 8 }}>
                <label>
                  Dil
                  <select value={lang} onChange={(e) => setLang(e.target.value as "tr" | "en")}>
                    <option value="tr">Türkçe</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="max">
                  Maks. firma
                  <input type="number" min={1} max={200} value={coMax} onChange={(e) => setCoMax(Number(e.target.value))} />
                </label>
                <label>
                  Derinlik
                  <select value={depth} onChange={(e) => setDepth(e.target.value as typeof depth)}>
                    <option value="quick">Hızlı analiz</option>
                    <option value="standard">Standart analiz</option>
                    <option value="deep">Derin AI Intelligence</option>
                  </select>
                </label>
              </div>

              {/* Rakip analizi */}
              <div className="preset-row" style={{ gap: 8, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: "row" }}>
                  <input
                    type="checkbox"
                    checked={competitorsOn}
                    disabled={depth === "deep"}
                    onChange={(e) => setWithCompetitors(e.target.checked)}
                  />
                  🥊 Rakip analizi yap{depth === "deep" ? " (deep'te otomatik)" : ""}
                </label>
                <label className="max">
                  Maks. rakip
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxCompetitors}
                    disabled={!competitorsOn}
                    onChange={(e) => setMaxCompetitors(Number(e.target.value))}
                  />
                </label>
              </div>
              {competitorsOn && (
                <label>
                  Rakipler (elle, opsiyonel — boşsa AI önerir)
                  <textarea
                    rows={2}
                    value={competitors}
                    onChange={(e) => setCompetitors(e.target.value)}
                    placeholder={"Trendyol Go, Migros Hemen"}
                    style={{ width: "100%", resize: "vertical" }}
                  />
                </label>
              )}

              <button className="btn btn-wa" onClick={submitCompany} disabled={busy || !names.trim()}>
                {busy ? "Başlatılıyor…" : "AI Intelligence Taramayı Başlat"}
              </button>
            </>
          )}
          {error && <span className="scan-error">{error}</span>}
        </div>
      )}

      {/* Firma-bazlı ilerleme (firma başı durum) */}
      {status?.mode === "company" && status.items?.length ? (
        <CompanyProgress items={status.items} />
      ) : null}
    </div>
  );

  function onCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).map((l) => l.split(",")[0]?.replace(/^["']|["']$/g, "").trim()).filter(Boolean) as string[];
      // Başlık satırını ele.
      if (lines[0] && /firma|company|name|isim|^ad$/i.test(lines[0])) lines.shift();
      setNames((prev) => [prev.trim(), lines.join("\n")].filter(Boolean).join("\n"));
    };
    reader.readAsText(file, "utf-8");
  }
}

function ScanProgress({ status }: { status: ScanStatus }) {
  if (!status.running && status.phase === "done") {
    return <span className="scan-prog done">✓ {status.message ?? "Tamamlandı"}</span>;
  }
  if (!status.running && status.phase === "error") {
    return <span className="scan-prog err">Hata: {status.message}</span>;
  }
  if (!status.running) return null;

  if (status.mode === "company") {
    const items = status.items ?? [];
    const done = items.filter((i) => i.phase === "completed").length;
    return (
      <span className="scan-prog">
        <span className="spinner" /> AI Intelligence — {done}/{items.length} firma
      </span>
    );
  }

  const label = PHASE_LABEL[status.phase];
  const detail =
    status.phase === "find"
      ? `${status.queryIndex + 1}/${status.queryTotal} · ${status.message ?? ""}`
      : `${status.found} firma`;
  return (
    <span className="scan-prog">
      <span className="spinner" /> {label} — {detail}
    </span>
  );
}

function CompanyProgress({ items }: { items: NonNullable<ScanStatus["items"]> }) {
  const tone: Record<string, string> = {
    completed: "#34d399",
    error: "#f87171",
    ai_analyzing: "#a78bfa",
    competitor_analyzing: "#f59e0b",
  };
  return (
    <div className="company-progress" style={{ marginTop: 12, display: "grid", gap: 4 }}>
      {items.map((it) => (
        <div
          key={it.name}
          style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, opacity: it.phase === "waiting" ? 0.5 : 1 }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {it.phase === "completed" ? "✓" : it.phase === "error" ? "✕" : "•"} {it.name}
          </span>
          <span style={{ color: tone[it.phase] ?? "#94a3b8", flexShrink: 0 }}>
            {ITEM_PHASE_LABEL[it.phase]}
            {it.phase === "error" && it.message ? ` — ${it.message.slice(0, 40)}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
