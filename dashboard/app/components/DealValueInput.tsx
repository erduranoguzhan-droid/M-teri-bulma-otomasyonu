"use client";

import { useState, useTransition } from "react";
import { setDealValueAction } from "../lib/actions";

export function DealValueInput({
  id,
  current,
  estimate,
}: {
  id: string;
  current?: number;
  estimate: number;
}) {
  const [val, setVal] = useState(current != null ? String(current) : "");
  const [pending, start] = useTransition();

  const save = () => {
    const n = val.trim() === "" ? null : Number(val.replace(/[^\d]/g, ""));
    if (n != null && !Number.isFinite(n)) return;
    start(async () => {
      await setDealValueAction(id, n);
    });
  };
  const reset = () => {
    setVal("");
    start(async () => {
      await setDealValueAction(id, null);
    });
  };

  return (
    <div className="deal-input">
      <span className="deal-cur">₺</span>
      <input
        type="text"
        inputMode="numeric"
        value={val}
        placeholder={`tahmin: ${estimate.toLocaleString("tr-TR")}`}
        onChange={(e) => setVal(e.target.value)}
        disabled={pending}
      />
      <button className="btn btn-ghost" onClick={save} disabled={pending}>
        {pending ? "…" : "Kaydet"}
      </button>
      {current != null && (
        <button className="link-btn" onClick={reset} disabled={pending}>
          tahmine dön
        </button>
      )}
    </div>
  );
}
