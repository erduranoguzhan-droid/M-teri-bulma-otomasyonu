import Link from "next/link";
import { getLeads } from "../lib/leads";
import { CRM_STATUSES } from "../lib/types";
import { formatTRY, formatPct } from "../lib/pipeline";
import { HBars, CompareBars } from "../components/InsightCharts";
import {
  insightsSummary,
  scoreDistribution,
  sectorDistribution,
  serviceDemand,
  competitorGapDemand,
  pressureDistribution,
  type BarDatum,
} from "../lib/insights";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const leads = await getLeads();

  if (leads.length === 0) {
    return (
      <>
        <InsightsHeader />
        <div className="card">
          <div className="empty">Henüz veri yok. Bir tarama başlat, sonra buraya dön.</div>
        </div>
      </>
    );
  }

  const s = insightsSummary(leads);
  const funnel: BarDatum[] = CRM_STATUSES.map((st) => ({
    label: st.label,
    value: leads.filter((l) => l.crmStatus === st.value).length,
    color: st.color,
  })).filter((d) => d.value > 0);

  const gaps = competitorGapDemand(leads);

  return (
    <>
      <InsightsHeader />

      {/* Ozet stat tile'lari */}
      <div className="metrics">
        <Metric v={s.total} k="Toplam Lead" />
        <Metric v={s.analyzed} k="Analiz Edildi" />
        <Metric v={s.hot} k="Sıcak (75+)" />
        <Metric v={s.avgScore} k="Ort. Skor" />
        <Metric v={formatPct(s.winRate)} k="Kazanma Oranı" />
        <Metric v={formatPct(s.contactRate)} k="İletişim Oranı" />
      </div>

      <div className="chart-grid">
        <ChartCard title="Skor Dağılımı" hint="Lead kalitesinin bantlara göre kırılımı">
          <HBars data={scoreDistribution(leads)} labelWidth={130} />
        </ChartCard>

        <ChartCard title="Sektör Dağılımı" hint="Hangi sektörde kaç lead (üzerine gel: ort. skor)">
          <HBars data={sectorDistribution(leads)} labelWidth={190} />
        </ChartCard>

        <ChartCard title="Pipeline Hunisi" hint="CRM aşamasına göre lead adedi">
          <HBars data={funnel} labelWidth={170} />
        </ChartCard>

        <ChartCard title="Hizmet Talebi" hint="Leadlere en çok önerilen Vertex hizmetleri">
          <HBars data={serviceDemand(leads)} labelWidth={210} />
        </ChartCard>
      </div>

      {/* Rakip analizi (yalniz firma-modu veri varsa) */}
      {s.withCompetitors > 0 && (
        <>
          <h3 className="section-title">🥊 Rakip İstihbaratı ({s.withCompetitors} firma)</h3>
          <div className="metrics">
            <Metric v={s.avgPressure ?? "—"} k="Ort. Rakip Baskısı" />
            <Metric v={s.avgLeadMaturity ?? "—"} k="Sizin Ort. Olgunluk" />
            <Metric v={s.avgCompetitorMaturity ?? "—"} k="Rakip Ort. Olgunluk" />
            <Metric v={s.companyMode} k="Firma AI Taraması" />
          </div>

          <div className="chart-grid">
            <ChartCard title="Rakip Baskısı Dağılımı" hint="Kaç firma ne düzeyde baskı altında">
              <HBars data={pressureDistribution(leads)} labelWidth={130} />
            </ChartCard>

            {s.avgLeadMaturity != null && s.avgCompetitorMaturity != null && (
              <ChartCard title="Dijital Olgunluk: Siz vs Rakip" hint="Firma-modu ortalamaları (0-100)">
                <CompareBars
                  a={{ label: "Sizin leadler", value: s.avgLeadMaturity, color: "var(--accent)" }}
                  b={{ label: "Rakip ort.", value: s.avgCompetitorMaturity, color: "#eb6834" }}
                />
              </ChartCard>
            )}

            {gaps.length > 0 && (
              <ChartCard title="Pazar Boşluğu" hint="Rakiplerinde olup leadlerinizde eksik olan yetenekler (satış fırsatı)" wide>
                <HBars data={gaps} labelWidth={150} defaultColor="#eb6834" />
              </ChartCard>
            )}
          </div>
        </>
      )}

      {/* Deger analitigi */}
      <h3 className="section-title">💰 Pipeline Değeri</h3>
      <div className="metrics value-metrics">
        <Metric v={formatTRY(s.openValue)} k="Açık Pipeline" />
        <Metric v={formatTRY(s.weightedValue)} k="Beklenen (ağırlıklı)" />
        <Metric v={formatTRY(s.wonValue)} k="Kazanılan Değer" />
        <Metric v={s.won} k="Kazanılan Adet" />
      </div>
      <div className="value-note">
        Değerler bütçe tahmininden türetilir; beklenen değer her leadin CRM aşamasının kapanma
        olasılığıyla ağırlıklandırılır. Detaylı iş kuyruğu için <Link href="/" className="bd-hint">Kokpit</Link>'e dön.
      </div>
    </>
  );
}

function InsightsHeader() {
  return (
    <div className="topbar">
      <div className="brand">
        <h1>Insights &amp; Analitik</h1>
        <span className="tag">Vertex Lead-Gen</span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  wide,
  children,
}: {
  title: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`chart-card${wide ? " wide" : ""}`}>
      <div className="chart-h">
        <span className="chart-title">{title}</span>
        {hint && <span className="chart-hint">{hint}</span>}
      </div>
      {children}
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
