"use client";

import { useTransition } from "react";
import { snoozeFollowUpAction } from "../lib/actions";

export function SnoozeButton({ id, days = 3 }: { id: string; days?: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn btn-ghost"
      disabled={pending}
      onClick={() => startTransition(() => snoozeFollowUpAction(id, days))}
    >
      Ertele +{days}g
    </button>
  );
}
