import Link from "next/link";
import { getLeads, isFollowUpDue } from "./lib/leads";
import { shortDate } from "./lib/links";
import { scoreBand } from "./lib/score";
import { sectorEmoji, sectorFor, sectorLabel } from "./lib/sectors";
import { SnoozeButton } from "./components/SnoozeButton";
import { ScanForm } from "./components/ScanForm";
import { LeadExplorer } from "./components/LeadExplorer";
import { CRM_STATUSES } from "./lib/types";
import { computePipelineStats, formatTRY, formatPct } from "./lib/pipeline";

const HOT_THRESHOLD = 75;

// Her istekte guncel JSON'u oku (build-time cache degil).
export const dynamic = "force-dynamic";

export default async function Home() {
  const leads = await getLeads();

  if (leads.length === 0) {
    return (
      <>
        <Header />
        <div className="card">
          <div className="empty">
            Henüz lead yok. Terminalde çalıştır:
            <br />
            <br />
            <code>npm run pipeline -- &quot;kafe Kadıköy İstanbul&quot; 15</code>
          </div>
        </div>
      </>
    );
  }

  const scored = leads.filter((l) => l.analysis);
  const avg =
    scored.length > 0
      ? Math.round(scored.reduce((s, l) => s + (l.analysis!.leadScore ?? 0), 0) / scored.length)
      : 0;
  const hot = scored.filter((l) => (l.analysis!.leadScore ?? 0) >= 75).length;
  const won = leads.filter((l) => l.crmStatus === "kazanildi").length;

  const due = leads
    .filter((l) => isFollowUpDue(l))
    .sort((a, b) => (a.followUpAt ?? "").localeCompare(b.followUpAt ?? ""));

  // Sicak yeni: henuz dokunulmamis (yeni + iletisim yok), mesaji hazir, yuksek skorlu.
  const hotNew = leads
    .filter(
      (l) =>
        l.crmStatus === "yeni" &&
        !l.contactedAt &&
        l.outreach &&
        (l.analysis?.leadScore ?? 0) >= HOT_THRESHOLD,
    )
    .sort((a, b) => (b.analysis?.leadScore ?? 0) - (a.analysis?.leadScore ?? 0))
    .slice(0, 12);

  // Pipeline hunisi: her CRM statusunde kac lead var.
  const funnel = CRM_STATUSES.map((s) => ({
    ...s,
    count: leads.filter((l) => l.crmStatus === s.value).length,
  })).filter((s) => s.count > 0);
  const funnelMax = Math.max(1, ...funnel.map((s) => s.count));

  const pipe = computePipelineStats(leads);

  return (
    <>
      <Header />

      <div className="metrics">
        <Metric v={leads.length} k="Toplam Lead" />
        <Metric v={hot} k="Sıcak (75+)" />
        <Metric v={due.length} k="Takip Zamanı" />
        <Metric v={avg} k="Ort. Skor" />
        <Metric v={won} k="Kazanılan" />
      </div>

      <h3 className="section-title">🎯 Bugün</h3>
      {due.length === 0 && hotNew.length === 0 ? (
        <div className="card today-clear">
          ✓ İş kuyruğun temiz — yeni tarama başlatıp taze lead ekleyebilirsin.
        </div>
      ) : (
        <>
          <div className="today-summary">
            Bugün <b>{due.length}</b> takip + <b>{hotNew.length}</b> sıcak yeni lead seni bekliyor.
          </div>

          {due.length > 0 && (
            <div className="card followup-card today-block">
              <div className="today-head">⏰ Takip zamanı gelenler ({due.length})</div>
              {due.map((l) => {
                const status = CRM_STATUSES.find((s) => s.value === l.crmStatus);
                return (
                  <div key={l.id} className="row followup-row">
                    <Link href={`/lead/${l.id}`} className="name" style={{ gridColumn: "1 / 2" }}>
                      {l.raw.name}
                      <small>
                        {status?.label} · takip: {shortDate(l.followUpAt)}
                      </small>
                    </Link>
                    <SnoozeButton id={l.id} days={3} />
                  </div>
                );
              })}
            </div>
          )}

          {hotNew.length > 0 && (
            <div className="card today-block">
              <div className="today-head">🔥 Sıcak yeni leadler — ilk temas ({hotNew.length})</div>
              {hotNew.map((l) => {
                const a = l.analysis;
                const sec = sectorFor(l.raw);
                return (
                  <Link key={l.id} href={`/lead/${l.id}`} className="row">
                    <span className={`score-badge ${scoreBand(a?.leadScore)}`}>{a?.leadScore ?? "–"}</span>
                    <span className="name">
                      {l.raw.name}
                      <small>
                        <span title={sectorLabel(sec)}>{sectorEmoji(sec)}</span>{" "}
                        {[l.raw.category, l.raw.city].filter(Boolean).join(" · ") || "—"}
                      </small>
                    </span>
                    <span className="svc">{a?.recommendedServices[0] ?? "—"}</span>
                    <span className="go">İncele →</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {funnel.length > 0 && (
        <>
          <h3 className="section-title">Pipeline</h3>
          <div className="card funnel">
            {funnel.map((s) => (
              <div key={s.value} className="funnel-row">
                <span className="funnel-label" style={{ color: s.color }}>● {s.label}</span>
                <span className="funnel-bar">
                  <span
                    className="funnel-fill"
                    style={{ width: `${(s.count / funnelMax) * 100}%`, background: s.color }}
                  />
                </span>
                <span className="funnel-count">{s.count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">Skor Dağılımı (sektör bazında)</h3>
      <ScoreHistogram leads={leads} />

      <h3 className="section-title">💰 Pipeline Değeri</h3>
      <div className="metrics value-metrics">
        <Metric v={formatTRY(pipe.openValue)} k="Açık Pipeline" />
        <Metric v={formatTRY(pipe.weightedValue)} k="Beklenen (ağırlıklı)" />
        <Metric v={formatTRY(pipe.wonValue)} k="Kazanılan Değer" />
        <Metric v={formatPct(pipe.winRate)} k="Kazanma Oranı" />
        <Metric v={formatPct(pipe.contactRate)} k="İletişim Oranı" />
      </div>
      <div className="value-note">
        Değerler bütçe tahmininden (düşük ₺15B · orta ₺35B · yüksek ₺75B) türetilir; beklenen değer her
        leadin CRM aşamasının kapanma olasılığıyla ağırlıklandırılır. Reklam harcaması yok →
        <b> müşteri edinme maliyeti (CAC) ≈ yalnızca zaman</b>; bu yüzden kazanılan her anlaşma yüksek marjlı.
      </div>

      <h3 className="section-title">Tüm Leadler</h3>
      <LeadExplorer leads={leads} />
    </>
  );
}

function Header() {
  return (
    <>
      <div className="topbar">
        <div className="brand">
          <h1>Müşteri Bulma Otomasyonu</h1>
          <span className="tag">Vertex Lead-Gen</span>
        </div>
      </div>
      <ScanForm />
    </>
  );
}

const HIST_BANDS = [
  { key: "hot", label: "Sıcak 75+", min: 75, color: "#ef7d70" },
  { key: "warm", label: "Ilık 60-74", min: 60, color: "#e0b04a" },
  { key: "mid", label: "Orta 40-59", min: 40, color: "#4a9d92" },
  { key: "low", label: "Düşük <40", min: 0, color: "#c2c8cf" },
];

function bandOf(score: number): string {
  return (HIST_BANDS.find((b) => score >= b.min) ?? HIST_BANDS[HIST_BANDS.length - 1]).key;
}

function ScoreHistogram({ leads }: { leads: import("./lib/types").Lead[] }) {
  const scored = leads.filter((l) => l.analysis);
  const sectors = [...new Set(scored.map((l) => sectorFor(l.raw)))];
  const rows = sectors
    .map((sec) => {
      const inSec = scored.filter((l) => sectorFor(l.raw) === sec);
      const counts: Record<string, number> = {};
      for (const l of inSec) {
        const k = bandOf(l.analysis!.leadScore ?? 0);
        counts[k] = (counts[k] ?? 0) + 1;
      }
      return { sec, total: inSec.length, counts };
    })
    .sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  if (rows.length === 0) return null;

  return (
    <div className="card hist">
      {rows.map((r) => (
        <div key={r.sec} className="hist-row">
          <span className="hist-label">
            {sectorEmoji(r.sec)} {sectorLabel(r.sec)}
          </span>
          <span className="hist-bar" style={{ width: `${(r.total / maxTotal) * 100}%` }}>
            {HIST_BANDS.map((b) =>
              r.counts[b.key] ? (
                <span
                  key={b.key}
                  className="hist-seg"
                  style={{ flex: r.counts[b.key], background: b.color }}
                  title={`${b.label}: ${r.counts[b.key]}`}
                >
                  {r.counts[b.key]}
                </span>
              ) : null,
            )}
          </span>
          <span className="hist-total">{r.total}</span>
        </div>
      ))}
      <div className="hist-legend">
        {HIST_BANDS.map((b) => (
          <span key={b.key} className="hist-leg">
            <span className="hist-dot" style={{ background: b.color }} /> {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Metric({ v, k }: { v: number | string; k: string }) {
  return (
    <div className="metric">
      <div className="v">{v}</div>
      <div className="k">{k}</div>
    </div>
  );
}
