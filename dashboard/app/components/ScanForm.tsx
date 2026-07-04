"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startScanAction } from "../lib/actions";
import { PHASE_LABEL, type ScanStatus } from "../lib/scan-types";

// Sektör şablonları: tek tıkla kategorileri doldurur (dashboard'dan sektör-seçmeli tarama).
const SECTOR_PRESETS = [
  { emoji: "☕", label: "Restoran/Kafe", categories: "kafe, restoran, kahve dükkanı" },
  { emoji: "🩺", label: "Sağlık/Klinik", categories: "diş kliniği, güzellik merkezi, estetik klinik" },
  { emoji: "🏭", label: "Üretim/Sanayi", categories: "ilaç, kimya sanayi, fabrika" },
  { emoji: "🛍️", label: "E-ticaret/Perakende", categories: "butik, mağaza, konsept mağaza" },
];

export function ScanForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasRunning = useRef(false);

  const [city, setCity] = useState("İstanbul");
  const [districts, setDistricts] = useState("");
  const [categories, setCategories] = useState("kafe, restoran");
  const [max, setMax] = useState(15);

  async function poll() {
    const res = await fetch("/api/scan-status", { cache: "no-store" });
    const s: ScanStatus | null = await res.json();
    setStatus(s);
    const active = !!s?.running;
    if (active) wasRunning.current = true;
    if (!active && wasRunning.current) {
      // Tarama bitti -> listeyi tazele, polling'i durdur.
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

  // Sayfa acilisinda: devam eden bir tarama var mi bak.
  useEffect(() => {
    poll();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await startScanAction({ city, districts, categories, max });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Tarama başlatılamadı.");
      return;
    }
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
          <button className="btn btn-wa" onClick={submit} disabled={busy}>
            {busy ? "Başlatılıyor…" : "Taramayı Başlat"}
          </button>
          {error && <span className="scan-error">{error}</span>}
        </div>
      )}
    </div>
  );
}

function ScanProgress({ status }: { status: ScanStatus }) {
  if (!status.running && status.phase === "done") {
    return <span className="scan-prog done">✓ {status.message ?? "Tamamlandı"}</span>;
  }
  if (!status.running && status.phase === "error") {
    return <span className="scan-prog err">Hata: {status.message}</span>;
  }
  if (!status.running) return null;

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
