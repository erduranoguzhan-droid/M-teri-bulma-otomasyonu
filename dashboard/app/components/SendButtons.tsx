"use client";

import { useTransition } from "react";
import { markContactedAction } from "../lib/actions";
import { mailtoLink, waLink } from "../lib/links";
import type { ContactChannel, Outreach } from "../lib/types";

export function SendButtons({
  id,
  phone,
  email,
  outreach,
}: {
  id: string;
  phone?: string;
  email?: string;
  outreach: Outreach;
}) {
  const [pending, startTransition] = useTransition();
  const wa = waLink(phone, outreach.whatsapp);
  const mail = mailtoLink(email, outreach.email.subject, outreach.email.body);

  function send(url: string, channel: ContactChannel) {
    window.open(url, "_blank", "noopener,noreferrer");
    startTransition(() => markContactedAction(id, channel));
  }

  return (
    <div className="send-row">
      <button
        className="btn btn-wa"
        disabled={!wa || pending}
        onClick={() => wa && send(wa, "whatsapp")}
        title={wa ? "" : "Telefon numarası yok"}
      >
        WhatsApp&apos;ta Aç &amp; Gönderildi İşaretle
      </button>
      <button
        className="btn btn-mail"
        disabled={!mail || pending}
        onClick={() => mail && send(mail, "email")}
        title={mail ? "" : "E-posta adresi bulunamadı"}
      >
        E-posta Aç &amp; Gönderildi İşaretle
      </button>
    </div>
  );
}
