import Link from "next/link";
import { notFound } from "next/navigation";
import { getScan, getScanLeads } from "../../lib/scans";
import { LeadExplorer } from "../../components/LeadExplorer";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  running: "Çalışıyor",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
  error: "Hata Oluştu",
};

export default async function ScanDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) notFound();
  const leads = await getScanLeads(id);

  const hot = leads.filter((l) => (l.analysis?.leadScore ?? 0) >= 75).length;

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <Link href="/scans" className="back">← Tarama Geçmişi</Link>
        </div>
        <span className={`scan-badge st-${scan.status}`}>{STATUS_LABEL[scan.status] ?? scan.status}</span>
      </div>

      <div className="detail-head">
        <div>
          <h2>{scan.name}</h2>
          <div style={{ color: "var(--muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="sector-tag">{scan.mode === "company" ? "🎯 Firma AI" : "🗺️ Sektör"}</span>
            {[scan.city, scan.districts, scan.categories].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <div className="metrics">
        <Metric v={scan.foundCount} k="Bulunan İşletme" />
        <Metric v={scan.leadCount} k="Lead Sayısı" />
        <Metric v={scan.avgScore ?? "—"} k="Ort. AI Skoru" />
        <Metric v={hot} k="Sıcak (75+)" />
        <Metric v={fmtDur(scan.durationS)} k="Süre" />
      </div>

      <h3 className="section-title">Bu Taramanın Leadleri</h3>
      {leads.length === 0 ? (
        <div className="card"><div className="empty">Bu taramaya bağlı lead bulunamadı.</div></div>
      ) : (
        <LeadExplorer leads={leads} />
      )}
    </>
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

function fmtDur(s?: number): string {
  if (s == null) return "—";
  if (s < 60) return `${s}sn`;
  return `${Math.floor(s / 60)}dk ${s % 60}sn`;
}
