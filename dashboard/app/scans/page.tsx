import { getScans } from "../lib/scans";
import { ScansTable } from "../components/ScansTable";

export const dynamic = "force-dynamic";

export default async function ScansPage() {
  const scans = await getScans();
  return (
    <>
      <div className="topbar">
        <div className="brand">
          <h1>Tarama Geçmişi</h1>
          <span className="tag">{scans.length} tarama</span>
        </div>
      </div>
      <p className="value-note" style={{ marginBottom: 18 }}>
        Yaptığın her tarama otomatik kaydedilir. Bir kayda tıklayıp sonuçlarını tekrar açabilir,
        yeniden çalıştırabilir, yeniden adlandırabilir veya dışa aktarabilirsin.
      </p>
      <ScansTable scans={scans} />
    </>
  );
}
