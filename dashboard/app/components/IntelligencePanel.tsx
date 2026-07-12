// Firma-bazlı AI Sales Intelligence detay panosu (görüntüleme; server component).
// Yalnız `lead.intelligence` doluysa render edilir. Mevcut CSS sınıflarını kullanır.

import type {
  CompanyIntelligence,
  DecisionMaker,
  Enrichment,
  IntelScores,
  NewsSignal,
} from "../lib/types";
import { INTEL_SCORE_META, OPP_PRIORITY_LABEL } from "../lib/types";
import { scoreBand } from "../lib/score";

const DEPTH_LABEL: Record<CompanyIntelligence["depth"], string> = {
  quick: "Hızlı analiz",
  standard: "Standart analiz",
  deep: "Derin AI Intelligence",
};

export function IntelligencePanel({
  intel,
  enrichment: e,
}: {
  intel: CompanyIntelligence;
  enrichment?: Enrichment;
}) {
  return (
    <>
      {/* Skorlar */}
      <div className="section">
        <h3>
          AI Skorları{" "}
          <span className="chip" style={{ fontWeight: 500 }}>
            {DEPTH_LABEL[intel.depth]} · güven {intel.confidence}
          </span>
        </h3>
        <div className="scores" style={{ flexWrap: "wrap" }}>
          {INTEL_SCORE_META.map((m) => (
            <ScoreCell key={m.key} n={intel.scores[m.key as keyof IntelScores]} l={m.label} />
          ))}
        </div>
      </div>

      {/* Firma Özeti + İhtiyaç */}
      <div className="section">
        <h3>Firma Özeti</h3>
        <div className="kv"><div className="k">Ne yapıyor?</div><div>{intel.summary.whatTheyDo}</div></div>
        <div className="kv"><div className="k">Sektör</div><div>{intel.summary.industry}</div></div>
        {intel.summary.targetCustomers.length > 0 && (
          <div className="kv">
            <div className="k">Hedef kitle</div>
            <div className="chips">{intel.summary.targetCustomers.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
          </div>
        )}
        <div className="kv"><div className="k">Tahmini büyüklük</div><div>{intel.summary.estimatedSize ?? "insufficient_data"}</div></div>
        <div className="kv"><div className="k">Dijital olgunluk</div><div>{intel.summary.digitalMaturity}</div></div>
        {intel.potentialNeeds.length > 0 && (
          <div className="kv">
            <div className="k">Potansiyel ihtiyaçlar</div>
            <div className="chips">{intel.potentialNeeds.map((n) => <span className="chip" key={n}>{n}</span>)}</div>
          </div>
        )}
      </div>

      {/* Otomasyon Fırsatları */}
      {intel.opportunities.length > 0 && (
        <div className="section">
          <h3>AI Otomasyon Fırsatları ({intel.opportunities.length})</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {intel.opportunities.map((op, i) => (
              <div key={i} style={{ border: "1px solid var(--border, #24304a)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <strong>{op.name}</strong>
                  <span className="chip" title="öncelik / zorluk">
                    öncelik: {OPP_PRIORITY_LABEL[op.priority]} · zorluk: {OPP_PRIORITY_LABEL[op.difficulty]}
                  </span>
                </div>
                <MiniKv k="Problem" v={op.problem} />
                <MiniKv k="Çözüm" v={op.solution} />
                <MiniKv k="Yaklaşım" v={op.approach} />
                <MiniKv k="Tahmini etki" v={op.estimatedImpact} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Satış Açısı — Önerilen Hizmetler (fit skoru) */}
      {intel.recommendedServices.length > 0 && (
        <div className="section">
          <h3>Satış Açısı — Önerilen Hizmetler</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {[...intel.recommendedServices].sort((a, b) => b.fitScore - a.fitScore).map((s) => (
              <div key={s.service} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ minWidth: 220 }}>{s.service}</span>
                <span style={{ flex: 1, height: 8, background: "rgba(255,255,255,.06)", borderRadius: 4, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${s.fitScore}%`, background: "var(--accent, #34d399)" }} />
                </span>
                <b style={{ minWidth: 34, textAlign: "right" }}>{s.fitScore}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Karar Vericiler */}
      <div className="section">
        <h3>Karar Vericiler {intel.contacts.length ? `(${intel.contacts.length})` : ""}</h3>
        {intel.contacts.length === 0 ? (
          <div className="contact-note muted">Site-türevli karar verici bulunamadı (insufficient_data).</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {intel.contacts.map((c: DecisionMaker, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <strong>{c.name}</strong>
                {c.title && <span style={{ color: "var(--muted)" }}>{c.title}</span>}
                {c.linkedin && <a className="chip" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
                {c.email && <span className="chip">{c.email}</span>}
                <span className="chip" style={{ marginLeft: "auto" }}>güven {c.confidence}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teknoloji Stack */}
      <div className="section">
        <h3>Teknoloji Stack</h3>
        <TechRow label="CMS" items={intel.technologies.cms} />
        <TechRow label="Frontend" items={intel.technologies.frontend} />
        <TechRow label="Analytics" items={intel.technologies.analytics} />
        <TechRow label="CRM / Pazarlama" items={intel.technologies.crmMarketing} />
        <TechRow label="Altyapı" items={intel.technologies.infrastructure} />
        <TechRow label="E-ticaret" items={intel.technologies.ecommerce} />
        <div className="kv">
          <div className="k">E-posta / DNS</div>
          <div className="chips">
            {intel.technologies.emailDns.mailProvider && <span className="chip">{intel.technologies.emailDns.mailProvider}</span>}
            <Flag label="SPF" v={intel.technologies.emailDns.spf} />
            <Flag label="DMARC" v={intel.technologies.emailDns.dmarc} />
            <Flag label="SSL" v={intel.technologies.emailDns.ssl} />
            {intel.technologies.emailDns.mxRecords.slice(0, 2).map((mx) => <span className="chip" key={mx}>{mx}</span>)}
          </div>
        </div>
      </div>

      {/* Güncel Sinyaller */}
      {intel.signals.length > 0 && (
        <div className="section">
          <h3>Güncel Sinyaller</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {intel.signals.map((s: NewsSignal, i) => (
              <div key={i} style={{ borderLeft: "3px solid var(--accent, #34d399)", paddingLeft: 10 }}>
                <div style={{ fontWeight: 600 }}>{s.title}{s.date ? ` · ${s.date}` : ""}</div>
                <div style={{ color: "var(--muted)", fontSize: 14 }}>{s.summary}</div>
                <div style={{ fontSize: 13 }}>→ {s.salesMeaning}</div>
                {s.source && <a href={s.source} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>kaynak ↗</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Satış Mesajları (6 varyant) */}
      <div className="section">
        <h3>Satış Mesajları</h3>
        <MsgBlock title="Cold E-posta — Kısa/Direkt" body={intel.outreach.coldEmailShort} />
        <MsgBlock title="Cold E-posta — Danışmanlık Odaklı" body={intel.outreach.coldEmailConsultative} />
        <MsgBlock title="Cold E-posta — Problem/Çözüm" body={intel.outreach.coldEmailProblemSolution} />
        <MsgBlock title="LinkedIn Mesajı" body={intel.outreach.linkedinMessage} />
        <MsgBlock title="WhatsApp Mesajı" body={intel.outreach.whatsappMessage} />
        <MsgBlock title="Arama Scripti" body={intel.outreach.callScript} />
      </div>

      {/* İletişim / Web (enrichment) */}
      {e && (
        <div className="section">
          <h3>İletişim & Web</h3>
          {e.salesEmail && <MiniKv k="Satış e-postası" v={e.salesEmail} />}
          {e.supportEmail && <MiniKv k="Destek e-postası" v={e.supportEmail} />}
          {e.generalEmail && <MiniKv k="Genel e-posta" v={e.generalEmail} />}
          {e.contactFormUrl && (
            <div className="kv"><div className="k">İletişim formu</div><div><a href={e.contactFormUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{e.contactFormUrl}</a></div></div>
          )}
          {e.pagesCrawled?.length ? <MiniKv k="Taranan sayfalar" v={`${e.pagesCrawled.length} sayfa`} /> : null}
        </div>
      )}

      {/* Kaynaklar */}
      {intel.sources.length > 0 && (
        <div className="section">
          <h3>Kaynaklar</h3>
          <div className="chips">
            {intel.sources.map((s) => (
              <a className="chip" key={s} href={s} target="_blank" rel="noreferrer">{shortHost(s)} ↗</a>
            ))}
          </div>
        </div>
      )}
    </>
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

function TechRow({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="kv">
      <div className="k">{label}</div>
      <div className="chips">{items.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
    </div>
  );
}

function Flag({ label, v }: { label: string; v: boolean | null }) {
  const txt = v == null ? "?" : v ? "✓" : "✗";
  return <span className="chip">{label} {txt}</span>;
}

function MiniKv({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <span style={{ color: "var(--muted)", fontSize: 13, marginRight: 6 }}>{k}:</span>
      <span>{v}</span>
    </div>
  );
}

function MsgBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="msg">
      <div className="subj">{title}</div>
      {body}
    </div>
  );
}

function shortHost(url: string): string {
  try {
    return new URL(url).pathname === "/" ? new URL(url).hostname : new URL(url).hostname + "…";
  } catch {
    return url.slice(0, 30);
  }
}
