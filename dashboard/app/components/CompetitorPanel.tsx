// Rakip Analizi panosu (görüntüleme; server component).
// Yalnız `intel.competitors` doluysa render edilir. Mevcut CSS sınıflarını kullanır — additive.

import type { CSSProperties } from "react";
import type { CompetitorAnalysis, CompetitorSnapshot } from "../lib/types";
import { COMPETITOR_CAPABILITY_LABELS } from "../lib/types";
import { scoreBand } from "../lib/score";

const SOURCE_LABEL: Record<CompetitorSnapshot["source"], string> = {
  ai_suggested: "AI önerisi",
  user: "Elle",
};

export function CompetitorPanel({ comp }: { comp: CompetitorAnalysis }) {
  const reachable = comp.competitors.filter((c) => c.reachable);
  return (
    <div className="section">
      <h3>
        Rakip Analizi{" "}
        <span className="chip" style={{ fontWeight: 500 }}>
          {comp.competitors.length} rakip · {reachable.length} taranabildi
        </span>
      </h3>

      {/* Skor + olgunluk kıyası */}
      <div className="scores" style={{ flexWrap: "wrap", marginBottom: 12 }}>
        <ScoreCell n={comp.competitivePressureScore} l="Rakip Baskısı" />
        <ScoreCell n={comp.leadDigitalMaturity} l="Sizin Olgunluk" />
        <ScoreCell n={comp.avgCompetitorMaturity} l="Rakip Ort. Olgunluk" />
      </div>

      {/* Geride / Önde */}
      {(comp.behindOn.length > 0 || comp.aheadOn.length > 0) && (
        <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          {comp.behindOn.length > 0 && (
            <div className="kv">
              <div className="k">⚠ Geride</div>
              <div className="chips">
                {comp.behindOn.map((c) => (
                  <span className="chip" key={c} style={{ borderColor: "#f87171", color: "#f87171" }}>{c}</span>
                ))}
              </div>
            </div>
          )}
          {comp.aheadOn.length > 0 && (
            <div className="kv">
              <div className="k">✓ Önde</div>
              <div className="chips">
                {comp.aheadOn.map((c) => (
                  <span className="chip" key={c} style={{ borderColor: "#34d399", color: "#34d399" }}>{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Karşılaştırma matrisi (yatay kaydırılabilir) */}
      {comp.competitors.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thL}>Yetenek</th>
                <th style={thC}>Siz</th>
                {comp.competitors.map((c) => (
                  <th key={c.name} style={thC} title={c.website ?? ""}>
                    {c.name}
                    {!c.reachable && <span style={{ color: "#94a3b8" }}> ⋯</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPETITOR_CAPABILITY_LABELS.map(({ key, label }) => {
                const gap = comp.gaps.find((g) => g.capability === label);
                return (
                  <tr key={key}>
                    <td style={{ ...tdL, color: gap?.verdict === "behind" ? "#f87171" : undefined }}>{label}</td>
                    <td style={tdC}>{mark(gap?.leadHas ?? false)}</td>
                    {comp.competitors.map((c) => (
                      <td key={c.name} style={tdC}>{capMark(c.capabilities[key])}</td>
                    ))}
                  </tr>
                );
              })}
              <tr>
                <td style={{ ...tdL, fontWeight: 600 }}>Dijital olgunluk</td>
                <td style={{ ...tdC, fontWeight: 600 }}>{comp.leadDigitalMaturity}</td>
                {comp.competitors.map((c) => (
                  <td key={c.name} style={tdC}>{c.reachable ? c.digitalMaturityScore : "—"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* AI özet + satış açısı */}
      <div className="kv"><div className="k">Konum özeti</div><div>{comp.competitiveSummary}</div></div>
      <div className="kv"><div className="k">Satış açısı</div><div>{comp.salesAngle}</div></div>

      {/* Rakip detay kartları */}
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {comp.competitors.map((c) => (
          <div key={c.name} style={{ border: "1px solid var(--border, #24304a)", borderRadius: 10, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <strong>{c.name}</strong>
              <span className="chip">{SOURCE_LABEL[c.source]}</span>
              {c.reachable ? (
                <span className="chip" style={{ borderColor: "#34d399", color: "#34d399" }}>olgunluk {c.digitalMaturityScore}</span>
              ) : (
                <span className="chip" style={{ color: "#94a3b8" }}>{c.note ?? "erişilemedi"}</span>
              )}
              {c.website && (
                <a className="chip" href={c.website} target="_blank" rel="noreferrer" style={{ marginLeft: "auto" }}>
                  {shortHost(c.website)} ↗
                </a>
              )}
            </div>
            {c.reachable && (
              <div className="chips">
                {techChips(c).map((t) => <span className="chip" key={t}>{t}</span>)}
                {c.socialPresence.map((s) => <span className="chip" key={s}>{s}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreCell({ n, l }: { n: number; l: string }) {
  return (
    <div className="sc">
      <div className={`n score-band-${scoreBand(n)}`} style={{ fontVariantNumeric: "tabular-nums" }}>{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function mark(v: boolean): string {
  return v ? "✓" : "✗";
}
function capMark(v: boolean | null): string {
  return v == null ? "?" : v ? "✓" : "✗";
}

/** Rakip kartı için kısa teknoloji özeti (dolu alanlardan). */
function techChips(c: CompetitorSnapshot): string[] {
  const t = c.techStack;
  const out: string[] = [];
  if (t.cms.length) out.push(...t.cms);
  if (t.crmMarketing.length) out.push(...t.crmMarketing);
  if (t.analytics.length) out.push(...t.analytics.slice(0, 2));
  if (t.ecommerce.length) out.push(...t.ecommerce);
  if (t.emailDns.mailProvider) out.push(t.emailDns.mailProvider);
  return [...new Set(out)].slice(0, 8);
}

function shortHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 24);
  }
}

const thL: CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border, #24304a)", position: "sticky", left: 0 };
const thC: CSSProperties = { textAlign: "center", padding: "6px 8px", borderBottom: "1px solid var(--border, #24304a)", whiteSpace: "nowrap" };
const tdL: CSSProperties = { textAlign: "left", padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,.04)" };
const tdC: CSSProperties = { textAlign: "center", padding: "5px 8px", borderBottom: "1px solid rgba(255,255,255,.04)" };
