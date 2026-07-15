"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ScanRecord, ScanRunStatus } from "../lib/scans";
import { deleteScanAction, renameScanAction, rerunScanAction } from "../lib/scan-actions";

const STATUS_META: Record<ScanRunStatus, { label: string; cls: string }> = {
  running: { label: "Çalışıyor", cls: "st-running" },
  completed: { label: "Tamamlandı", cls: "st-completed" },
  cancelled: { label: "İptal Edildi", cls: "st-cancelled" },
  error: { label: "Hata Oluştu", cls: "st-error" },
};

type SortKey = "recent" | "leads" | "score" | "found" | "duration";
const PAGE_SIZE = 12;

export function ScansTable({ scans }: { scans: ScanRecord[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | ScanRunStatus>("all");
  const [mode, setMode] = useState<"all" | "sector" | "company">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(0);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr-TR");
    const out = scans.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (mode !== "all" && s.mode !== mode) return false;
      if (needle) {
        const hay = `${s.name} ${s.city ?? ""} ${s.categories ?? ""} ${s.districts ?? ""}`.toLocaleLowerCase("tr-TR");
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const key = (s: ScanRecord): number => {
      if (sort === "leads") return s.leadCount;
      if (sort === "found") return s.foundCount;
      if (sort === "score") return s.avgScore ?? -1;
      if (sort === "duration") return s.durationS ?? -1;
      return Date.parse(s.startedAt || "") || 0;
    };
    return out.sort((a, b) => key(b) - key(a));
  }, [scans, q, status, mode, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }

  function onRename(s: ScanRecord) {
    const name = window.prompt("Yeni tarama adı:", s.name);
    if (name == null || !name.trim()) return;
    startTransition(async () => {
      await renameScanAction(s.id, name);
      flash("Yeniden adlandırıldı.");
      router.refresh();
    });
  }
  function onDelete(s: ScanRecord) {
    if (!window.confirm(`"${s.name}" taraması silinsin mi? (Leadler korunur)`)) return;
    startTransition(async () => {
      await deleteScanAction(s.id);
      flash("Tarama silindi.");
      router.refresh();
    });
  }
  function onRerun(s: ScanRecord) {
    startTransition(async () => {
      const res = await rerunScanAction(s.id);
      flash(res.ok ? "Yeniden tarama başlatıldı." : res.error ?? "Başlatılamadı.");
      if (res.ok) router.refresh();
    });
  }
  function onCopy(s: ScanRecord) {
    const text = `${s.name} — ${s.city ?? ""} ${s.categories ?? ""} (${s.mode})`.trim();
    navigator.clipboard?.writeText(text).then(() => flash("Kopyalandı."), () => flash("Kopyalanamadı."));
  }

  const filtersActive = q !== "" || status !== "all" || mode !== "all";

  return (
    <>
      <div className="explorer-bar">
        <input
          className="explorer-search"
          type="search"
          placeholder="Ara: ad, şehir, kategori…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
        />
        <div className="sort-toggle">
          <button className={sort === "recent" ? "on" : ""} onClick={() => setSort("recent")}>En yeni</button>
          <button className={sort === "leads" ? "on" : ""} onClick={() => setSort("leads")}>Lead</button>
          <button className={sort === "score" ? "on" : ""} onClick={() => setSort("score")}>Skor</button>
          <button className={sort === "duration" ? "on" : ""} onClick={() => setSort("duration")}>Süre</button>
        </div>
      </div>

      <div className="filter-rows">
        <div className="filter-chips">
          {(["all", "completed", "running", "error", "cancelled"] as const).map((k) => (
            <button key={k} className={`fchip ${status === k ? "on" : ""}`} onClick={() => { setStatus(k); setPage(0); }}>
              {k === "all" ? "Tüm durumlar" : STATUS_META[k].label}
            </button>
          ))}
        </div>
        <div className="filter-chips">
          {(["all", "sector", "company"] as const).map((k) => (
            <button key={k} className={`fchip ${mode === k ? "on" : ""}`} onClick={() => { setMode(k); setPage(0); }}>
              {k === "all" ? "Tüm türler" : k === "sector" ? "🗺️ Sektör" : "🎯 Firma AI"}
            </button>
          ))}
        </div>
      </div>

      <div className="explorer-count">
        <span>{filtered.length} tarama{filtersActive ? ` / ${scans.length}` : ""}</span>
        {msg && <span style={{ color: "var(--accent)" }}>{msg}</span>}
        <button className="csv-btn" onClick={() => download(toCsv(filtered), "taramalar.csv", "text/csv")} disabled={!filtered.length}>⬇ CSV</button>
        <button className="csv-btn" onClick={() => download(JSON.stringify(filtered, null, 2), "taramalar.json", "application/json")} disabled={!filtered.length}>⬇ JSON</button>
      </div>

      <div className="card scans-table" style={{ opacity: pending ? 0.6 : 1 }}>
        <div className="scans-head">
          <span>Tarama</span><span>Tür</span><span>Başlangıç</span><span>Süre</span>
          <span className="num">Bulunan</span><span className="num">Lead</span><span className="num">Skor</span>
          <span>Durum</span><span>İşlem</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty">Kayıt yok. Bir tarama başlat; otomatik burada listelenir.</div>
        ) : (
          rows.map((s) => {
            const st = STATUS_META[s.status];
            return (
              <div key={s.id} className="scans-row">
                <Link href={`/scans/${s.id}`} className="scans-name">
                  {s.name}
                  <small>{[s.city, s.districts, s.categories].filter(Boolean).join(" · ") || "—"}</small>
                </Link>
                <span className="scans-mode">{s.mode === "company" ? "🎯 Firma" : "🗺️ Sektör"}</span>
                <span className="scans-dim" title={s.finishedAt ? `Bitiş: ${fmt(s.finishedAt)}` : ""}>{fmt(s.startedAt)}</span>
                <span className="scans-dim">{fmtDur(s.durationS)}</span>
                <span className="num">{s.foundCount}</span>
                <span className="num">{s.leadCount}</span>
                <span className="num">{s.avgScore ?? "—"}</span>
                <span><span className={`scan-badge ${st.cls}`}>{s.status === "running" && <i className="dot-pulse" />}{st.label}</span></span>
                <span className="scans-actions">
                  <Link href={`/scans/${s.id}`} className="mini-btn" title="Sonuçları aç">Aç</Link>
                  <button className="mini-btn" onClick={() => onRerun(s)} disabled={pending} title="Yeniden çalıştır">↻</button>
                  <button className="mini-btn" onClick={() => onRename(s)} disabled={pending} title="Yeniden adlandır">✎</button>
                  <button className="mini-btn" onClick={() => onCopy(s)} title="Kopyala">⧉</button>
                  <button className="mini-btn danger" onClick={() => onDelete(s)} disabled={pending} title="Sil">🗑</button>
                </span>
              </div>
            );
          })
        )}
      </div>

      {pageCount > 1 && (
        <div className="pager">
          <button className="mini-btn" disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>← Önceki</button>
          <span>{clampedPage + 1} / {pageCount}</span>
          <button className="mini-btn" disabled={clampedPage >= pageCount - 1} onClick={() => setPage(clampedPage + 1)}>Sonraki →</button>
        </div>
      )}
    </>
  );
}

function fmt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtDur(s?: number): string {
  if (s == null) return "—";
  if (s < 60) return `${s}sn`;
  const m = Math.floor(s / 60);
  return `${m}dk ${s % 60}sn`;
}
function toCsv(scans: ScanRecord[]): string {
  const cols = ["name", "mode", "status", "city", "districts", "categories", "foundCount", "leadCount", "avgScore", "startedAt", "finishedAt", "durationS"];
  const cell = (v: unknown) => {
    const str = v == null ? "" : String(v);
    return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const head = cols.join(";");
  const rows = scans.map((s) => cols.map((c) => cell((s as unknown as Record<string, unknown>)[c])).join(";"));
  return "﻿" + [head, ...rows].join("\r\n");
}
function download(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
