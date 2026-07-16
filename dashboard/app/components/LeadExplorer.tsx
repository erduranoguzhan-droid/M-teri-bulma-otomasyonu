"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { CrmStatus, Lead } from "../lib/types";
import { CRM_STATUSES } from "../lib/types";
import { scoreBand } from "../lib/score";
import { sectorFor, sectorEmoji, sectorLabel, SECTOR_META } from "../lib/sectors";
import { bulkUpdateStatusAction } from "../lib/actions";
import { downloadCsv, downloadJson, downloadInstantlyCsv } from "../lib/csv";

type SortKey = "score" | "recent" | "aiFit" | "buying" | "pressure";
type FlagKey = "website" | "email" | "decision" | "company" | "competitors";
const FLAGS: { key: FlagKey; label: string }[] = [
  { key: "website", label: "Website var" },
  { key: "email", label: "E-posta var" },
  { key: "decision", label: "Karar verici var" },
  { key: "company", label: "🎯 Firma AI modu" },
  { key: "competitors", label: "🥊 Rakip analizli" },
];
const BANDS = [
  { key: "all", label: "Tüm skorlar", min: -1 },
  { key: "hot", label: "Sıcak 75+", min: 75 },
  { key: "warm", label: "Ilık 60+", min: 60 },
  { key: "mid", label: "Orta 40+", min: 40 },
];

export function LeadExplorer({ leads }: { leads: Lead[] }) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [status, setStatus] = useState("all");
  const [band, setBand] = useState("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [flags, setFlags] = useState<Set<FlagKey>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<CrmStatus>("iletisim_kuruldu");
  const [pending, startTransition] = useTransition();

  // Sadece veride bulunan sektor/statuleri filtre olarak goster.
  const sectorsPresent = useMemo(() => {
    const set = new Set(leads.map((l) => sectorFor(l.raw)));
    return SECTOR_META.filter((s) => set.has(s.key));
  }, [leads]);
  const statusesPresent = useMemo(() => {
    const set = new Set(leads.map((l) => l.crmStatus));
    return CRM_STATUSES.filter((s) => set.has(s.value));
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr-TR");
    const bandMin = BANDS.find((b) => b.key === band)?.min ?? -1;
    const out = leads.filter((l) => {
      if (sector !== "all" && sectorFor(l.raw) !== sector) return false;
      if (status !== "all" && l.crmStatus !== status) return false;
      if (bandMin >= 0 && (l.analysis?.leadScore ?? -1) < bandMin) return false;
      if (flags.has("website") && !l.raw.website) return false;
      if (flags.has("email") && !(l.enrichment?.emails.length || l.enrichment?.salesEmail)) return false;
      if (flags.has("decision") && !(l.intelligence?.contacts.length)) return false;
      if (flags.has("company") && l.scanMode !== "company") return false;
      if (flags.has("competitors") && !l.intelligence?.competitors) return false;
      if (needle) {
        const hay = `${l.raw.name} ${l.raw.category ?? ""} ${l.raw.city ?? ""}`.toLocaleLowerCase("tr-TR");
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const key = (l: Lead): number => {
      if (sort === "aiFit") return l.intelligence?.scores.aiFitScore ?? l.analysis?.leadScore ?? -1;
      if (sort === "buying") return l.intelligence?.scores.buyingPotentialScore ?? l.analysis?.icpScore ?? -1;
      if (sort === "pressure") return l.intelligence?.competitors?.competitivePressureScore ?? -1;
      return l.analysis?.leadScore ?? -1;
    };
    out.sort((a, b) =>
      sort === "recent"
        ? (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
        : key(b) - key(a),
    );
    return out;
  }, [leads, q, sector, status, band, sort, flags]);

  const toggleFlag = (k: FlagKey) =>
    setFlags((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  const reset = () => { setQ(""); setSector("all"); setStatus("all"); setBand("all"); setFlags(new Set()); };
  const filtersActive = q !== "" || sector !== "all" || status !== "all" || band !== "all" || flags.size > 0;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allFilteredSelected) filtered.forEach((l) => n.delete(l.id));
      else filtered.forEach((l) => n.add(l.id));
      return n;
    });
  const applyBulk = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkUpdateStatusAction(ids, bulkStatus);
      setSelected(new Set());
    });
  };

  return (
    <>
      <div className="explorer-bar">
        <input
          className="explorer-search"
          type="search"
          placeholder="Ara: isim, kategori, şehir…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="sort-toggle">
          <button className={sort === "score" ? "on" : ""} onClick={() => setSort("score")}>Öncelik</button>
          <button className={sort === "buying" ? "on" : ""} onClick={() => setSort("buying")}>Satın Alma</button>
          <button className={sort === "aiFit" ? "on" : ""} onClick={() => setSort("aiFit")}>AI Uygunluk</button>
          <button className={sort === "pressure" ? "on" : ""} onClick={() => setSort("pressure")}>🥊 Rakip Baskısı</button>
          <button className={sort === "recent" ? "on" : ""} onClick={() => setSort("recent")}>En yeni</button>
        </div>
      </div>

      <div className="filter-rows">
        <FilterChips
          items={[{ key: "all", label: "Tüm sektörler" }, ...sectorsPresent.map((s) => ({ key: s.key, label: `${s.emoji} ${s.label}` }))]}
          active={sector}
          onPick={setSector}
        />
        <FilterChips
          items={[{ key: "all", label: "Tüm durumlar" }, ...statusesPresent.map((s) => ({ key: s.value, label: s.label }))]}
          active={status}
          onPick={setStatus}
        />
        <FilterChips items={BANDS.map((b) => ({ key: b.key, label: b.label }))} active={band} onPick={setBand} />
        <div className="filter-chips">
          {FLAGS.map((f) => (
            <button
              key={f.key}
              className={`fchip ${flags.has(f.key) ? "on" : ""}`}
              onClick={() => toggleFlag(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="explorer-count">
        {filtered.length > 0 && (
          <label className="selectall">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
            Tümünü seç
          </label>
        )}
        <span>{filtered.length} lead{filtersActive ? ` / ${leads.length}` : ""}</span>
        {filtersActive && <button className="link-btn" onClick={reset}>filtreleri temizle</button>}
        <button
          className="csv-btn"
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
          title="Filtrelenmiş leadleri CSV olarak indir (Excel uyumlu)"
        >
          ⬇ CSV
        </button>
        <button
          className="csv-btn"
          onClick={() => downloadJson(filtered)}
          disabled={filtered.length === 0}
          title="Tam veriyi JSON olarak indir (Supabase/Airtable/webhook beslemesi)"
        >
          ⬇ JSON
        </button>
        <button
          className="csv-btn"
          onClick={() => downloadInstantlyCsv(filtered)}
          disabled={filtered.length === 0}
          title="Instantly / cold-email platformları için CSV (email + kişiselleştirilmiş mesaj)"
        >
          ⬇ Instantly
        </button>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">Filtreyle eşleşen lead yok.</div>
        ) : (
          filtered.map((l) => {
            const a = l.analysis;
            const sec = sectorFor(l.raw);
            const st = CRM_STATUSES.find((s) => s.value === l.crmStatus);
            const isSel = selected.has(l.id);
            const pressure = l.intelligence?.competitors?.competitivePressureScore;
            return (
              <div key={l.id} className={`lrow ${isSel ? "sel" : ""}`}>
                <input
                  type="checkbox"
                  className="lrow-check"
                  checked={isSel}
                  onChange={() => toggle(l.id)}
                  aria-label={`${l.raw.name} seç`}
                />
                <Link href={`/lead/${l.id}`} className="lrow-link">
                  <span className={`score-badge ${scoreBand(a?.leadScore)}`}>{a ? a.leadScore : "–"}</span>
                  <span className="name">
                    {l.raw.name}
                    <small>
                      <span title={sectorLabel(sec)}>{sectorEmoji(sec)}</span>{" "}
                      {[l.raw.category, l.raw.city].filter(Boolean).join(" · ") || "—"}
                    </small>
                  </span>
                  <span className="svc">
                    {pressure != null && (
                      <span
                        title={`Rakip baskısı ${pressure}/100`}
                        style={{
                          fontSize: 12, fontWeight: 700, marginRight: 6, padding: "1px 6px", borderRadius: 6,
                          color: pressure >= 50 ? "var(--bad)" : "var(--muted)",
                          border: `1px solid ${pressure >= 50 ? "var(--bad)" : "var(--border)"}`,
                        }}
                      >
                        🥊 {pressure}
                      </span>
                    )}
                    {a?.recommendedServices[0] ?? l.stage}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: st?.color }}>● {st?.label ?? l.crmStatus}</span>
                </Link>
              </div>
            );
          })
        )}
      </div>

      {selected.size > 0 && (
        <div className="bulkbar">
          <span className="bulk-count">{selected.size} seçili</span>
          <label className="bulk-set">
            Statü:
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as CrmStatus)} disabled={pending}>
              {CRM_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-mail" onClick={applyBulk} disabled={pending}>
            {pending ? "Uygulanıyor…" : "Uygula"}
          </button>
          <button className="link-btn light" onClick={() => setSelected(new Set())} disabled={pending}>
            Seçimi temizle
          </button>
        </div>
      )}
    </>
  );
}

function FilterChips({
  items,
  active,
  onPick,
}: {
  items: { key: string; label: string }[];
  active: string;
  onPick: (k: string) => void;
}) {
  return (
    <div className="filter-chips">
      {items.map((it) => (
        <button
          key={it.key}
          className={`fchip ${active === it.key ? "on" : ""}`}
          onClick={() => onPick(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
