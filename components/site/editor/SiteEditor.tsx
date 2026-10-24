"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Section, SiteFooter, SiteGeneral } from "@/lib/site/types";
import { DEFAULT_SETTINGS } from "@/lib/site/defaults";
import { siteApi } from "@/lib/site/client";
import { cleanUrl } from "@/lib/site/validate";
import EditableSections from "./EditableSections";
import { SectionList } from "../Sections";
import MediaPicker from "./MediaPicker";
import { EdCtx, Picked } from "./EditableBits";
import { HistoryModal, PageSettingsModal, SiteSettingsModal } from "./Modals";

type Status = "saved" | "saving" | "unsaved" | "error" | "conflict";

export default function SiteEditor({ pageId, onExit }: { pageId: string; onExit: (published: boolean) => void }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [title, setTitle] = useState("");
  const [seo, setSeo] = useState("");
  const [canPublish, setCanPublish] = useState(false);
  const [hasUnpublished, setHasUnpublished] = useState(false);
  const [status, setStatus] = useState<Status>("saved");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [modal, setModal] = useState<null | "history" | "page" | "site">(null);
  const [general, setGeneral] = useState<SiteGeneral>(DEFAULT_SETTINGS.general);
  const [footer, setFooter] = useState<SiteFooter>(DEFAULT_SETTINGS.footer);
  const [picker, setPicker] = useState<{ cur: Picked; resolve: (r: Picked | null) => void } | null>(null);
  const [dirty, setDirty] = useState(false);

  const base = useRef<string | null>(null);
  const rev = useRef(0);
  const published = useRef(false);
  const latest = useRef({ sections, title, seo });
  latest.current = { sections, title, seo };

  useEffect(() => {
    (async () => {
      const { ok, data } = await siteApi(`/api/site/page?id=${pageId}`);
      if (!ok) {
        setLoadError(data.error || "Could not open this page for editing.");
        setLoading(false);
        return;
      }
      setSections(data.page.draft || []);
      setTitle(data.page.title || "");
      setSeo(data.page.seo_description || "");
      setHasUnpublished(!!data.page.has_unpublished);
      setCanPublish(!!data.access?.canPublish);
      base.current = data.page.updated_at;
      if (data.settings?.general) setGeneral({ ...DEFAULT_SETTINGS.general, ...data.settings.general });
      if (data.settings?.footer) setFooter({ ...DEFAULT_SETTINGS.footer, ...data.settings.footer });
      setLoading(false);
    })();
  }, [pageId]);

  const save = useCallback(async (): Promise<boolean> => {
    const myRev = rev.current;
    setStatus("saving");
    const { sections: s, title: t, seo: d } = latest.current;
    const { ok, status: code, data } = await siteApi("/api/site/page", { method: "PUT", body: { id: pageId, sections: s, title: t, seo_description: d, base_updated_at: base.current } });
    if (!ok) {
      setStatus(code === 409 ? "conflict" : "error");
      setMessage(data.error || "Could not save.");
      return false;
    }
    base.current = data.updated_at;
    setHasUnpublished(!!data.has_unpublished);
    if (rev.current === myRev) {
      setDirty(false);
      setStatus("saved");
      setMessage("");
    } else setStatus("unsaved");
    return true;
  }, [pageId]);

  // Save by itself a moment after the last change
  useEffect(() => {
    if (!dirty || status === "conflict") return;
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
  }, [dirty, sections, title, seo, save, status]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch = () => {
    rev.current++;
    setDirty(true);
    setStatus("unsaved");
  };
  const changeSections = (s: Section[]) => {
    setSections(s);
    touch();
  };

  async function publish() {
    if (dirty && !(await save())) return;
    setStatus("saving");
    const { ok, data } = await siteApi("/api/site/publish", { body: { id: pageId } });
    if (!ok) {
      setStatus("error");
      setMessage(data.error || "Could not publish.");
      return;
    }
    published.current = true;
    setHasUnpublished(false);
    setStatus("saved");
    setMessage("Published. Visitors now see this version.");
  }

  async function exit() {
    if (dirty && status !== "conflict") await save();
    onExit(published.current);
  }

  async function discard() {
    const { ok, data } = await siteApi("/api/site/discard", { body: { id: pageId } });
    if (ok) {
      setSections(data.sections || []);
      base.current = data.updated_at;
      setHasUnpublished(false);
      setDirty(false);
      setStatus("saved");
      setModal(null);
    }
  }

  const ctx = {
    pickImage: (cur: Picked) => new Promise<Picked | null>((resolve) => setPicker({ cur, resolve })),
    askLink: (cur: string) => {
      const v = window.prompt("Where should this go?\n\nExamples:  /about   or   https://example.com   or   tel:+923001234567", cur);
      return v === null ? null : cleanUrl(v);
    },
  };

  if (loading) return <div className="ed-loading">Opening the editor…</div>;
  if (loadError) return <div className="ed-loading"><p className="ed-error">{loadError}</p><button type="button" onClick={() => onExit(false)}>Close</button></div>;

  const label: Record<Status, string> = { saved: hasUnpublished ? "Saved as draft" : "All changes saved", saving: "Saving…", unsaved: "Unsaved changes…", error: "Couldn't save", conflict: "Needs reload" };

  return (
    <EdCtx.Provider value={ctx}>
      <div className="ed-wrap">
        <div className="ed-toolbar">
          <div className="ed-tb-left">
            <strong>Editing: {title}</strong>
            <span className={`ed-status ${status}`}>{label[status]}</span>
            {hasUnpublished && <span className="ed-status draft">Not published yet</span>}
          </div>
          <div className="ed-tb-right">
            <button type="button" onClick={() => setPreview((v) => !v)}>{preview ? "Back to editing" : "Preview"}</button>
            <button type="button" onClick={() => setModal("page")}>Page settings</button>
            {canPublish && <button type="button" onClick={() => setModal("site")}>School details &amp; footer</button>}
            <button type="button" onClick={() => setModal("history")}>History</button>
            {canPublish ? (
              <button type="button" className="primary" onClick={publish} disabled={status === "saving" || (!hasUnpublished && !dirty)}>Publish</button>
            ) : (
              <span className="ed-hint">An admin publishes your changes</span>
            )}
            <button type="button" onClick={exit}>Close editor</button>
          </div>
        </div>

        {(message || status === "conflict") && (
          <div className={`ed-banner ${status === "error" || status === "conflict" ? "bad" : "good"}`}>
            {message}{" "}
            {status === "conflict" && <button type="button" onClick={() => window.location.reload()}>Reload the page</button>}
          </div>
        )}

        {preview ? (
          <div className="ed-preview"><SectionList sections={sections} /></div>
        ) : (
          <>
            <p className="ed-help">Click any text to change it, click a picture to replace it. Your changes save by themselves. They go live only when you press Publish.</p>
            <EditableSections sections={sections} onChange={changeSections} />
          </>
        )}

        {picker && <MediaPicker current={picker.cur} onDone={(r) => { picker.resolve(r); setPicker(null); }} />}
        {modal === "page" && <PageSettingsModal title={title} seo={seo} onClose={() => setModal(null)} onSave={(t, s) => { setTitle(t); setSeo(s); touch(); }} />}
        {modal === "site" && <SiteSettingsModal general={general} footer={footer} onClose={() => setModal(null)} onSaved={() => window.location.reload()} />}
        {modal === "history" && (
          <HistoryModal
            pageId={pageId}
            canRestore
            hasUnpublished={hasUnpublished}
            onDiscard={discard}
            onClose={() => setModal(null)}
            onRestored={(s, at) => { setSections(s); base.current = at; setHasUnpublished(true); setDirty(false); setStatus("saved"); }}
          />
        )}
      </div>
    </EdCtx.Provider>
  );
}
