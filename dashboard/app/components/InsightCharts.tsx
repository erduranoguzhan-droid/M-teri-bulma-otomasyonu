"use client";

// Insights bar grafikleri (dataviz: yatay bar = kimlik/buyukluk isi, dogrudan deger etiketi,
// ince mark + 4px yuvarlak veri-ucu, recessive eksen, per-mark hover tooltip).
// Kontrast WARN olan renklerde relief kurali: her bar'da GORUNUR deger etiketi var.

import { useState } from "react";
import type { BarDatum } from "../lib/insights";

interface HoverState {
  i: number;
  x: number;
  y: number;
}

export function HBars({
  data,
  unit = "",
  defaultColor = "var(--accent)",
  labelWidth = 150,
}: {
  data: BarDatum[];
  unit?: string;
  defaultColor?: string;
  labelWidth?: number;
}) {
  const [hover, setHover] = useState<HoverState | null>(null);
  if (data.length === 0) return <div className="chart-empty">Henüz veri yok.</div>;
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="hbars" onMouseLeave={() => setHover(null)}>
      {data.map((d, i) => {
        const dim = hover != null && hover.i !== i;
        return (
          <div
            key={d.label}
            className="hbar-row"
            onMouseEnter={(e) => setHover({ i, x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => setHover({ i, x: e.clientX, y: e.clientY })}
          >
            <span className="hbar-label" style={{ width: labelWidth }} title={d.label}>
              {d.label}
            </span>
            <span className="hbar-track">
              <span
                className="hbar-fill"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background: d.color ?? defaultColor,
                  opacity: dim ? 0.5 : 1,
                }}
              />
            </span>
            <span className="hbar-val">
              {d.value}
              {unit}
            </span>
          </div>
        );
      })}

      {hover != null && (
        <div className="chart-tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <strong>{data[hover.i].label}</strong>
          <div className="chart-tip-v">
            {data[hover.i].value}
            {unit}
            {data[hover.i].meta ? ` · ${data[hover.i].meta}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Iki-degerli karsilastirma cubugu ( or. sizin olgunluk vs rakip ort.). Tek eksen,
 * ayni olcek; iki ayri hue + dogrudan etiket (renk-only degil).
 */
export function CompareBars({
  a,
  b,
}: {
  a: { label: string; value: number; color: string };
  b: { label: string; value: number; color: string };
}) {
  const max = Math.max(1, a.value, b.value, 100);
  return (
    <div className="cmp">
      {[a, b].map((d) => (
        <div key={d.label} className="cmp-row">
          <span className="cmp-label">{d.label}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
          </span>
          <span className="hbar-val">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
