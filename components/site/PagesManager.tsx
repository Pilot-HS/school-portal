"use client";

import { useCallback, useEffect, useState } from "react";
import { siteApi } from "@/lib/site/client";

type P = {
  id: string; slug: string; parent_id: string | null; title: string; menu_label: string | null; position: number;
  show_in_menu: boolean; is_home: boolean; has_unpublished: boolean; published_at: string | null; href: string;
};

// Add, rename, reorder, hide and delete website pages, and place pages under a menu item as sub-tabs.
export default function PagesManager({ onChanged }: { onChanged?: () => void }) {
  const [pages, setPages] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState("");
  const [busy, setBusy] = useState(false);

  // new page form
  const [nTitle, setNTitle] = useState("");
  const [nParent, setNParent] = useState("");
  const [nMenu, setNMenu] = useState(true);
  const [nCopy, setNCopy] = useState("");

  // settings form
  const [sTitle, setSTitle] = useState("");
  const [sLabel, setSLabel] = useState("");
  const [sSlug, setSSlug] = useState("");
  const [sMenu, setSMenu] = useState(true);
  const [sParent, setSParent] = useState("");

  const load = useCallback(async () => {
    const { ok, data } = await siteApi("/api/site/pages");
    if (!ok) {
      setError(data.error || "Could not load the pages.");
    } else {
      setPages(data.pages || []);
      setCanManage(!!data.can_manage);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tops = pages.filter((p) => !p.parent_id).sort((a, b) => a.position - b.position);
  const kidsOf = (id: string) => pages.filter((p) => p.parent_id === id).sort((a, b) => a.position - b.position);
  const label = (p: P) => p.menu_label || p.title;

  async function act(fn: () => Promise<{ ok: boolean; data: any }>, okText: string) {
    setBusy(true);
    setError("");
    setMessage("");
    const { ok, data } = await fn();
    setBusy(false);
    if (!ok) {
      setError(data.error || "Something went wrong.");
      return false;
    }
    setMessage(okText);
    await load();
    onChanged?.();
    return true;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const done = await act(
      () => siteApi("/api/site/pages", { body: { title: nTitle, parent_id: nParent || null, show_in_menu: nMenu, copy_from: nCopy || null } }),
      "Page created. It is not visible to visitors until you open it, edit it and press Publish."
    );
    if (done) {
      setAdding(false);
      setNTitle("");
      setNParent("");
      setNCopy("");
      setNMenu(true);
    }
  }

  function openSettings(p: P) {
    setEditId(editId === p.id ? "" : p.id);
    setSTitle(p.title);
    setSLabel(p.menu_label || "");
    setSSlug(p.slug);
    setSMenu(p.show_in_menu);
    setSParent(p.parent_id || "");
  }

  async function saveSettings(p: P) {
    const body: any = { id: p.id, title: sTitle, menu_label: sLabel };
    if (!p.is_home) {
      body.slug = sSlug;
      body.show_in_menu = sMenu;
      body.parent_id = sParent || null;
    }
    const done = await act(() => siteApi("/api/site/pages", { method: "PATCH", body }), "Saved.");
    if (done) setEditId("");
  }

  async function move(group: P[], i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= group.length) return;
    const ids = group.map((g) => g.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await act(() => siteApi("/api/site/pages/order", { body: { ids } }), "Menu order saved.");
  }

  async function remove(p: P) {
    const kids = kidsOf(p.id).length;
    const text = kids ? `Delete "${p.title}" and its ${kids} sub-tab${kids === 1 ? "" : "s"}? This cannot be undone.` : `Delete "${p.title}"? This cannot be undone.`;
    if (!window.confirm(text)) return;
    await act(() => siteApi("/api/site/pages", { method: "DELETE", body: { id: p.id } }), "Page deleted.");
  }

  async function duplicate(p: P) {
    await act(() => siteApi("/api/site/pages", { body: { title: `${p.title} (copy)`, parent_id: p.parent_id, show_in_menu: false, copy_from: p.id } }), "Copy created and hidden from the menu. Edit it, then publish.");
  }

  const Row = ({ p, group, i, child }: { p: P; group: P[]; i: number; child?: boolean }) => (
    <div className={`pm-item${child ? " child" : ""}`}>
      <div className="pm-row">
        <div className="pm-main">
          <strong>{label(p)}</strong>
          {p.is_home && <span className="pm-badge">Home</span>}
          {!p.show_in_menu && !p.is_home && <span className="pm-badge gray">Not in menu</span>}
          {!p.published_at ? <span className="pm-badge amber">Not published</span> : p.has_unpublished ? <span className="pm-badge amber">Unpublished changes</span> : <span className="pm-badge green">Live</span>}
          <div className="pm-url">{p.href}</div>
        </div>
        <div className="pm-actions">
          {canManage && !p.is_home && (
            <>
              <button type="button" className="pm-btn" disabled={busy || i === 0} onClick={() => move(group, i, -1)} aria-label="Move up">↑</button>
              <button type="button" className="pm-btn" disabled={busy || i === group.length - 1} onClick={() => move(group, i, 1)} aria-label="Move down">↓</button>
            </>
          )}
          <a className="pm-btn" href={`${p.href}?edit=1`}>Edit</a>
          <a className="pm-btn" href={p.href} target="_blank" rel="noopener noreferrer">View</a>
          {canManage && <button type="button" className="pm-btn" onClick={() => openSettings(p)}>Settings</button>}
          {canManage && !p.is_home && <button type="button" className="pm-btn" disabled={busy} onClick={() => duplicate(p)}>Copy</button>}
          {canManage && !p.is_home && <button type="button" className="pm-btn danger" disabled={busy} onClick={() => remove(p)}>Delete</button>}
        </div>
      </div>
      {editId === p.id && (
        <div className="pm-panel">
          <div className="pm-grid">
            <label>Page name<input value={sTitle} maxLength={150} onChange={(e) => setSTitle(e.target.value)} /></label>
            <label>Name in the menu<input value={sLabel} maxLength={40} placeholder={sTitle} onChange={(e) => setSLabel(e.target.value)} /></label>
            {!p.is_home && (
              <>
                <label>Web address<input value={sSlug} maxLength={80} onChange={(e) => setSSlug(e.target.value)} /></label>
                <label>
                  Place it
                  <select value={sParent} onChange={(e) => setSParent(e.target.value)} disabled={kidsOf(p.id).length > 0}>
                    <option value="">In the main menu</option>
                    {tops.filter((t) => !t.is_home && t.id !== p.id).map((t) => <option key={t.id} value={t.id}>As a sub-tab under {label(t)}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>
          {!p.is_home && <label className="pm-check"><input type="checkbox" checked={sMenu} onChange={(e) => setSMenu(e.target.checked)} /> Show this page in the menu</label>}
          {!p.is_home && <p className="pm-hint">If you change the web address, links to this page from other pages will need updating.</p>}
          <div className="pm-actions-row">
            <button type="button" className="pm-primary" disabled={busy} onClick={() => saveSettings(p)}>Save</button>
            <button type="button" className="pm-btn" onClick={() => setEditId("")}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) return <div className="skeleton" style={{ height: 160 }} />;

  return (
    <div className="pm">
      {error && <p className="pm-error" role="alert">{error}</p>}
      {message && <p className="pm-ok" role="status">{message}</p>}
      {!canManage && <p className="pm-hint">You can edit pages, but only someone allowed to publish can add, move or delete pages.</p>}

      {canManage && (
        <div style={{ marginBottom: 14 }}>
          {!adding ? (
            <button type="button" className="pm-primary" onClick={() => setAdding(true)}>+ Add a page</button>
          ) : (
            <form className="pm-panel" onSubmit={create}>
              <strong>New page</strong>
              <div className="pm-grid">
                <label>Page name<input required minLength={2} maxLength={150} value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="e.g. Sports" /></label>
                <label>
                  Where should it go?
                  <select value={nParent} onChange={(e) => setNParent(e.target.value)}>
                    <option value="">In the main menu</option>
                    {tops.filter((t) => !t.is_home).map((t) => <option key={t.id} value={t.id}>As a sub-tab under {label(t)}</option>)}
                  </select>
                </label>
                <label>
                  Start from
                  <select value={nCopy} onChange={(e) => setNCopy(e.target.value)}>
                    <option value="">A blank page</option>
                    {pages.map((t) => <option key={t.id} value={t.id}>A copy of {label(t)}</option>)}
                  </select>
                </label>
              </div>
              <label className="pm-check"><input type="checkbox" checked={nMenu} onChange={(e) => setNMenu(e.target.checked)} /> Show it in the menu once it is published</label>
              <div className="pm-actions-row">
                <button type="submit" className="pm-primary" disabled={busy}>{busy ? "Creating…" : "Create page"}</button>
                <button type="button" className="pm-btn" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="pm-list">
        {tops.map((p, i) => {
          const kids = kidsOf(p.id);
          return (
            <div key={p.id}>
              <Row p={p} group={tops} i={i} />
              {kids.map((k, j) => <Row key={k.id} p={k} group={kids} i={j} child />)}
              {canManage && !p.is_home && !adding && (
                <div className="pm-sub-add">
                  <button type="button" className="pm-link" onClick={() => { setAdding(true); setNParent(p.id); }}>+ Add a sub-tab under {label(p)}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
