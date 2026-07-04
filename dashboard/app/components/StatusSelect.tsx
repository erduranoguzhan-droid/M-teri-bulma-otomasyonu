"use client";

import { useTransition } from "react";
import { updateStatus } from "../lib/actions";
import { CRM_STATUSES, type CrmStatus } from "../lib/types";

export function StatusSelect({ id, value }: { id: string; value: CrmStatus }) {
  const [pending, startTransition] = useTransition();
  const color = CRM_STATUSES.find((s) => s.value === value)?.color ?? "#64748b";

  return (
    <select
      className="status-select"
      value={value}
      disabled={pending}
      style={{ borderColor: color, color }}
      onChange={(e) => {
        const next = e.target.value as CrmStatus;
        startTransition(() => updateStatus(id, next));
      }}
    >
      {CRM_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
