import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead } from "../../lib/leads";
import { scoreBand } from "../../lib/score";
import { StatusSelect } from "../../components/StatusSelect";
import { SendButtons } from "../../components/SendButtons";
import { BUDGET_LABEL } from "../../lib/types";
import { shortDate } from "../../lib/links";
import { sectorFor, sectorEmoji, sectorLabel } from "../../lib/sectors";
import { urgencySignals, icpSignals, SCORE_WEIGHTS, BUDGET_FACTOR } from "../../lib/signals";
import { nextAction } from "../../lib/nextAction";
import { budgetEstimate, formatTRY } from "../../lib/pipeline";
import { DealValueInput } from "../../components/DealValueInput";
import { IntelligencePanel } from "../../components/IntelligencePanel";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const { raw, analysis: a, outreach: o, enrichment: e } = lead;
  const sec = sectorFor(raw);
  const na = nextAction(lead);

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <Link href="/" className="back">← Tüm leadler</Link>
        </div>
        <StatusSelect id={lead.id} value={lead.crmStatus} />
      </div>

      <div className="detail-head">
        <div>
          <h2>{raw.name}</h2>
          <div style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="sector-tag">{sectorEmoji(sec)} {sectorLabel(sec)}</span>
            <span>{[raw.category, raw.city].filter(Boolean).join(" · ") || "—"}</span>
          </div>
        </div>
        {a && (
          <span className={`score-badge ${scoreBand(a.leadScore)}`} style={{ height: 40, minWidth: 52, fontSize: 20 }}>
            {a.leadScore}
          </span>
        )}
      </div>

      <div className={`nba nba-${na.tone}`}>
        <span className="nba-label">→ {na.label}</span>
        {na.hint && <span className="nba-hint">{na.hint}</span>}
      </div>

      <div className="facts">
        <Fact k="Telefon" v={raw.phone ?? "—"} />
        <Fact k="Website" v={raw.website ?? "yok"} link={raw.website} />
        <Fact k="Google Puanı" v={raw.rating != null ? `${raw.rating} (${raw.reviewCount ?? 0} yorum)` : "—"} />
        <Fact k="E-posta" v={e?.emails.length ? e.emails.join(", ") : "—"} />
        {raw.mapsUrl && <Fact k="Google Maps" v="Haritada aç" link={raw.mapsUrl} />}
        {e?.socials.instagram && <Fact k="Instagram" v="Profil" link={e.socials.instagram} />}
      </div>

      {/* Firma-bazlı AI Sales Intelligence (varsa zengin görünüm) */}
      {lead.intelligence && <IntelligencePanel intel={lead.intelligence} enrichment={e} />}

      {a && !lead.intelligence && (
        <div className="section">
          <h3>Analiz</h3>
          <div className="scores">
            <Sc n={a.leadScore} l="Lead" />
            <Sc n={a.icpScore} l="ICP" />
            <Sc n={a.urgencyScore} l="Aciliyet" />
            <div className="sc">
              <div className="n" style={{ fontSize: 20, paddingTop: 6 }}>{BUDGET_LABEL[a.budgetLevel]}</div>
              <div className="l">Bütçe</div>
            </div>
          </div>

          <details className="breakdown">
            <summary>Skor neden {a.leadScore}? <span className="bd-hint">kırılımı gör</span></summary>
            <div className="bd-formula">
              <BdPart label="Aciliyet" score={a.urgencyScore} weight={SCORE_WEIGHTS.urgency} color="#b45309" />
              <span className="bd-op">+</span>
              <BdPart label="ICP" score={a.icpScore} weight={SCORE_WEIGHTS.icp} color="#0f766e" />
              <span className="bd-op">+</span>
              <BdPart label="Bütçe" score={BUDGET_FACTOR[a.budgetLevel]} weight={SCORE_WEIGHTS.budget} color="#6366f1" />
              <span className="bd-op">=</span>
              <div className="bd-part bd-total">
                <div className="bd-contrib">{a.leadScore}</div>
                <div className="bd-lbl">Lead</div>
              </div>
            </div>
            <div className="bd-signals">
              <div className="bd-col">
                <div className="bd-col-h up">Aciliyet sinyalleri (eksikler)</div>
                <div className="chips">
                  {urgencySignals(lead).map((s) => (
                    <span className="sig sig-up" key={s.label}>{s.label} <b>+{s.weight}</b></span>
                  ))}
                  {urgencySignals(lead).length === 0 && <span className="bd-none">— belirgin eksik yok</span>}
                </div>
              </div>
              <div className="bd-col">
                <div className="bd-col-h ok">ICP sinyalleri (artılar)</div>
                <div className="chips">
                  {icpSignals(lead).map((s) => (
                    <span className="sig sig-ok" key={s.label}>{s.label} <b>+{s.weight}</b></span>
                  ))}
                  {icpSignals(lead).length === 0 && <span className="bd-none">— artı sinyal yok</span>}
                </div>
              </div>
            </div>
          </details>

          <div className="kv">
            <div className="k">En Büyük Problem</div>
            <div>{a.biggestProblem}</div>
          </div>
          <div className="kv">
            <div className="k">En Kolay Otomasyon Fırsatı</div>
            <div>{a.easiestAutomation}</div>
          </div>
          <div className="kv">
            <div className="k">ROI Argümanı</div>
            <div>{a.bestRoiPitch}</div>
          </div>
          <div className="kv">
            <div className="k">Önerilen Hizmetler</div>
            <div className="chips">
              {a.recommendedServices.map((s) => (
                <span className="chip" key={s}>{s}</span>
              ))}
            </div>
          </div>

          <div className="kv">
            <div className="k">
              Anlaşma Değeri {lead.dealValue != null ? "(elle girildi)" : `(tahmini: ${formatTRY(budgetEstimate(lead))})`}
            </div>
            <DealValueInput id={lead.id} current={lead.dealValue} estimate={budgetEstimate(lead)} />
          </div>
        </div>
      )}

      {e && (
        <div className="section">
          <h3>Zenginleştirme</h3>
          <div className="kv">
            <div className="k">Website</div>
            <div>
              {raw.website ? (
                e.websiteReachable ? (
                  <span className="tag-ok">✓ Erişilebilir{e.websiteTitle ? ` — ${e.websiteTitle}` : ""}</span>
                ) : (
                  <span className="tag-bad">✗ Erişilemedi (bozuk/ihmal edilmiş)</span>
                )
              ) : (
                <span className="tag-bad">Website yok</span>
              )}
            </div>
          </div>

          {(e.tech.platform || e.tech.copyrightYear) && (
            <div className="kv">
              <div className="k">Site Altyapısı</div>
              <div>
                {e.tech.platform && <span className="chip">{e.tech.platform}</span>}{" "}
                {e.tech.copyrightYear && (
                  <span className={e.tech.copyrightYear <= new Date().getFullYear() - 2 ? "tag-bad" : "tag-ok"}>
                    telif: {e.tech.copyrightYear}
                    {e.tech.copyrightYear <= new Date().getFullYear() - 2 ? " (güncel değil)" : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="kv">
            <div className="k">Tespit Edilen Teknoloji</div>
            <div className="tech-grid">
              <Tech on={e.tech.hasWhatsApp} label="WhatsApp" />
              <Tech on={e.tech.hasOnlineOrdering} label="Online Sipariş" />
              <Tech on={e.tech.hasReservation} label="Rezervasyon" />
              <Tech on={e.tech.hasGoogleAnalytics} label="Analytics" />
              <Tech on={e.tech.hasMetaPixel} label="Meta Pixel" />
              <Tech on={e.tech.hasGoogleTagManager} label="Tag Manager" />
              <Tech on={e.tech.hasLiveChat} label="Canlı Destek" />
              <Tech on={e.tech.hasBlog} label="Blog/İçerik" />
              <Tech on={!!e.tech.ecommercePlatform} label={e.tech.ecommercePlatform ?? "E-ticaret"} />
            </div>
          </div>

          {(e.socials.instagram || e.socials.facebook || e.socials.linkedin || e.socials.whatsapp || e.socials.youtube || e.socials.twitter || e.socials.tiktok) && (
            <div className="kv">
              <div className="k">Sosyal Medya</div>
              <div className="chips">
                {e.socials.instagram && <SocialChip label="Instagram" href={e.socials.instagram} />}
                {e.socials.facebook && <SocialChip label="Facebook" href={e.socials.facebook} />}
                {e.socials.linkedin && <SocialChip label="LinkedIn" href={e.socials.linkedin} />}
                {e.socials.youtube && <SocialChip label="YouTube" href={e.socials.youtube} />}
                {e.socials.twitter && <SocialChip label="X/Twitter" href={e.socials.twitter} />}
                {e.socials.tiktok && <SocialChip label="TikTok" href={e.socials.tiktok} />}
                {e.socials.whatsapp && <SocialChip label="WhatsApp" href={e.socials.whatsapp} />}
              </div>
            </div>
          )}

          {e.emails.length > 0 && (
            <div className="kv">
              <div className="k">Bulunan E-postalar</div>
              <div>{e.emails.join(", ")}</div>
            </div>
          )}
        </div>
      )}

      {o && (
        <div className="section">
          <h3>Gönderim</h3>
          {lead.contactedAt ? (
            <div className="contact-note">
              ✓ {shortDate(lead.contactedAt)} tarihinde{" "}
              {lead.contactChannel === "whatsapp" ? "WhatsApp" : "e-posta"} ile iletişime geçildi.
              {lead.followUpAt && ` Takip: ${shortDate(lead.followUpAt)}.`}
            </div>
          ) : (
            <div className="contact-note muted">Henüz iletişime geçilmedi.</div>
          )}
          <SendButtons id={lead.id} phone={raw.phone} email={e?.emails[0]} outreach={o} />

          <h3 style={{ marginTop: 22 }}>Hazır Mesajlar</h3>
          <div className="msg">{o.whatsapp}</div>
          <div className="msg">
            <div className="subj">{o.email.subject}</div>
            {o.email.body}
          </div>
        </div>
      )}
    </>
  );
}

function Fact({ k, v, link }: { k: string; v: string; link?: string }) {
  return (
    <div className="fact">
      <div className="k">{k}</div>
      <div className="v">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 600 }}>
            {v}
          </a>
        ) : (
          v
        )}
      </div>
    </div>
  );
}

function Sc({ n, l }: { n: number; l: string }) {
  return (
    <div className="sc">
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function BdPart({ label, score, weight, color }: { label: string; score: number; weight: number; color: string }) {
  return (
    <div className="bd-part">
      <div className="bd-contrib" style={{ color }}>{Math.round(score * weight)}</div>
      <div className="bd-lbl">
        {label}
        <small>{score} × {Math.round(weight * 100)}%</small>
      </div>
    </div>
  );
}

function Tech({ on, label }: { on: boolean; label: string }) {
  return <span className={`tech ${on ? "tech-on" : "tech-off"}`}>{on ? "✓" : "✗"} {label}</span>;
}

function SocialChip({ label, href }: { label: string; href: string }) {
  return (
    <a className="chip" href={href} target="_blank" rel="noreferrer">{label} ↗</a>
  );
}
