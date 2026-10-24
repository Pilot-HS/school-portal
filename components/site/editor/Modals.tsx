"use client";

import { useEffect, useState } from "react";
import { TEMPLATES } from "@/lib/site/templates";
import { siteApi } from "@/lib/site/client";
import type { SiteFooter, SiteGeneral } from "@/lib/site/types";

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="ed-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ed-modal${wide ? " wide" : ""}`} role="dialog" aria-label={title}>
        <div className="ed-modal-head"><strong>{title}</strong><button type="button" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="ed-modal-body">{children}</div>
      </div>
    </div>
  );
}

export function AddSectionModal({ onPick, onClose }: { onPick: (key: string) => void; onClose: () => void }) {
  return (
    <Shell title="Add a section" onClose={onClose} wide>
      <p style={{ marginTop: 0, color: "#555" }}>Choose what to add. It comes with sample words and pictures that you can change.</p>
      <div className="ed-templates">
        {TEMPLATES.map((t) => (
          <button type="button" key={t.key} onClick={() => onPick(t.key)}>
            <strong>{t.name}</strong>
            <span>{t.description}</span>
          </button>
        ))}
      </div>
    </Shell>
  );
}

export function PageSettingsModal({ title, seo, onSave, onClose }: { title: string; seo: string; onSave: (title: string, seo: string) => void; onClose: () => void }) {
  const [t, setT] = useState(title);
  const [s, setS] = useState(seo);
  return (
    <Shell title="Page settings" onClose={onClose}>
      <label className="ed-field">Page name (shown in the browser tab and search results)
        <input value={t} maxLength={150} onChange={(e) => setT(e.target.value)} />
      </label>
      <label className="ed-field">Short description for Google (optional)
        <textarea rows={3} maxLength={300} value={s} onChange={(e) => setS(e.target.value)} />
      </label>
      <div className="ed-actions"><button type="button" className="ed-primary" onClick={() => { onSave(t.trim() || title, s.trim()); onClose(); }}>Save</button><button type="button" onClick={onClose}>Cancel</button></div>
    </Shell>
  );
}

export function HistoryModal({ pageId, canRestore, onRestored, onDiscard, onClose, hasUnpublished }: { pageId: string; canRestore: boolean; onRestored: (sections: any[], updatedAt: string) => void; onDiscard: () => void; onClose: () => void; hasUnpublished: boolean }) {
  const [versions, setVersions] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    (async () => {
      const { ok, data } = await siteApi(`/api/site/versions?id=${pageId}`);
      if (ok) setVersions(data.versions || []);
      else setError(data.error || "Could not load the history.");
    })();
  }, [pageId]);

  async function restore(v: any) {
    if (!window.confirm("Put this version back into your draft? You can still publish or undo afterwards.")) return;
    setBusy(v.id);
    const { ok, data } = await siteApi("/api/site/restore", { body: { id: pageId, version_id: v.id } });
    if (!ok) {
      setError(data.error || "Could not restore.");
      setBusy("");
      return;
    }
    onRestored(data.sections, data.updated_at);
    onClose();
  }

  return (
    <Shell title="Earlier versions" onClose={onClose}>
      {hasUnpublished && (
        <div className="ed-note">
          You have changes that aren&apos;t published yet.{" "}
          <button type="button" className="ed-linkbtn" onClick={() => window.confirm("Throw away the unpublished changes and go back to what is live?") && onDiscard()}>Discard them</button>
        </div>
      )}
      {error && <p className="ed-error">{error}</p>}
      {!versions && !error && <p>Loading…</p>}
      {versions && versions.length === 0 && <p>No earlier versions yet. A version is saved each time someone publishes this page.</p>}
      {versions && versions.map((v) => (
        <div className="ed-version" key={v.id}>
          <div>
            <strong>{new Date(v.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong>
            <div style={{ fontSize: "0.8rem", color: "#666" }}>{v.note || "Published"} by {v.by}</div>
          </div>
          {canRestore && <button type="button" disabled={!!busy} onClick={() => restore(v)}>{busy === v.id ? "Restoring…" : "Use this version"}</button>}
        </div>
      ))}
    </Shell>
  );
}

type L = { label: string; href?: string };
function LinkRows({ rows, onChange, max }: { rows: L[]; onChange: (r: L[]) => void; max: number }) {
  return (
    <div>
      {rows.map((r, i) => (
        <div className="ed-linkrow" key={i}>
          <input aria-label="Link text" placeholder="Text" value={r.label} onChange={(e) => onChange(rows.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
          <input aria-label="Link address" placeholder="Address (optional)" value={r.href || ""} onChange={(e) => onChange(rows.map((x, k) => (k === i ? { ...x, href: e.target.value } : x)))} />
          <button type="button" aria-label="Remove" onClick={() => onChange(rows.filter((_, k) => k !== i))}>✕</button>
        </div>
      ))}
      {rows.length < max && <button type="button" className="ed-linkbtn" onClick={() => onChange([...rows, { label: "", href: "" }])}>+ Add</button>}
    </div>
  );
}

export function SiteSettingsModal({ general, footer, onClose, onSaved }: { general: SiteGeneral; footer: SiteFooter; onClose: () => void; onSaved: () => void }) {
  const [g, setG] = useState<SiteGeneral>({ ...general });
  const [f, setF] = useState<SiteFooter>(JSON.parse(JSON.stringify(footer)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const { ok, data } = await siteApi("/api/site/settings", { method: "PUT", body: { general: g, footer: f } });
    if (!ok) {
      setError(data.error || "Could not save.");
      setBusy(false);
      return;
    }
    onSaved();
  }

  const gi = (key: keyof SiteGeneral, label: string) => (
    <label className="ed-field">{label}<input value={String((g as any)[key] ?? "")} onChange={(e) => setG({ ...g, [key]: e.target.value })} /></label>
  );

  return (
    <Shell title="School name, contact details and footer" onClose={onClose} wide>
      <p className="ed-note">These appear on every page. Changes here go live as soon as you save.</p>
      <div className="ed-grid2">
        {gi("school_name", "School name")}
        {gi("tagline", "Tagline")}
        {gi("phone", "Phone (top bar)")}
        {gi("email", "Email (top bar)")}
        {gi("address_short", "Address (top bar)")}
        {gi("apply_label", "Top-right button text")}
        {gi("apply_href", "Top-right button goes to")}
        {gi("brand_mark", "Logo letter")}
      </div>
      <label className="ed-check"><input type="checkbox" checked={g.show_portal_link !== false} onChange={(e) => setG({ ...g, show_portal_link: e.target.checked })} /> Show the “Portal Login” link in the top bar</label>

      <h4>Footer</h4>
      <label className="ed-field">About text<textarea rows={3} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} /></label>
      <label className="ed-field">Copyright line<input value={f.copyright} onChange={(e) => setF({ ...f, copyright: e.target.value })} /></label>
      <div className="ed-field">Social links (for example FB, IG, YT)<LinkRows rows={f.social} max={8} onChange={(social) => setF({ ...f, social })} /></div>
      {f.columns.map((c, i) => (
        <div className="ed-field" key={i}>
          <input className="ed-coltitle" value={c.title} placeholder="Column heading" onChange={(e) => setF({ ...f, columns: f.columns.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} />
          <LinkRows rows={c.links} max={12} onChange={(links) => setF({ ...f, columns: f.columns.map((x, k) => (k === i ? { ...x, links } : x)) })} />
        </div>
      ))}
      <div className="ed-field">Links at the very bottom (Privacy, Terms…)<LinkRows rows={f.legal} max={8} onChange={(legal) => setF({ ...f, legal })} /></div>

      {error && <p className="ed-error">{error}</p>}
      <div className="ed-actions"><button type="button" className="ed-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save and go live"}</button><button type="button" onClick={onClose}>Cancel</button></div>
    </Shell>
  );
}

export { Shell as ModalShell };
