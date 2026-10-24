"use client";

import { useState } from "react";
import type { Section } from "@/lib/site/types";
import { sanitizeHtml } from "@/lib/site/sanitize";
import { newSection } from "@/lib/site/templates";
import { T, RT, Im, Lk, Tools, useEd } from "./EditableBits";
import { AddSectionModal } from "./Modals";

type Path = (string | number)[];
const clone = <X,>(v: X): X => JSON.parse(JSON.stringify(v));
const IMG = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1000&q=70";
const rid = () => Math.random().toString(36).slice(2, 12);

function setIn(obj: any, path: Path, value: any) {
  const o = clone(obj);
  let cur = o;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
  return o;
}

type Ops = {
  set: (path: Path, v: any) => void;
  move: (path: Path, i: number, d: number) => void;
  remove: (path: Path, i: number) => void;
  add: (path: Path, item: any) => void;
};
function makeOps(s: any, apply: (ns: any) => void): Ops {
  const arr = (path: Path) => path.reduce((o: any, k) => o[k], s) as any[];
  return {
    set: (path, v) => apply(setIn(s, path, v)),
    move: (path, i, d) => {
      const a = clone(arr(path));
      const j = i + d;
      if (j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]];
      apply(setIn(s, path, a));
    },
    remove: (path, i) => {
      const a = clone(arr(path));
      a.splice(i, 1);
      apply(setIn(s, path, a));
    },
    add: (path, item) => {
      const a = clone(arr(path));
      a.push(item);
      apply(setIn(s, path, a));
    },
  };
}

const LABELS: Record<string, string> = {
  banner: "Page title", hero: "Big opening banner", quick_links: "Quick links", split: "Text with picture", stats: "Numbers band",
  cards: "Cards", features: "Numbered list", facilities: "Small boxes", gallery: "Photo gallery", cta: "Call to action", newsletter: "Newsletter box", html: "Text / custom block",
};
const BG: [string, string][] = [["plain", "White"], ["alt", "Light grey"]];
const ALIGN: [string, string][] = [["left", "Left"], ["center", "Centre"]];
const OPTIONS: Record<string, { key: string; label: string; choices: [string, string][] }[]> = {
  split: [{ key: "bg", label: "Background", choices: BG }, { key: "imageSide", label: "Picture on the", choices: [["right", "Right"], ["left", "Left"]] }],
  cards: [{ key: "bg", label: "Background", choices: BG }, { key: "align", label: "Heading", choices: ALIGN }, { key: "variant", label: "Style", choices: [["plain", "Plain cards"], ["news", "News (with pictures)"]] }],
  features: [{ key: "bg", label: "Background", choices: BG }, { key: "align", label: "Heading", choices: ALIGN }],
  facilities: [{ key: "bg", label: "Background", choices: BG }, { key: "align", label: "Heading", choices: ALIGN }],
  gallery: [{ key: "bg", label: "Background", choices: BG }, { key: "align", label: "Heading", choices: ALIGN }],
};

function Head({ s, ops }: { s: any; ops: Ops }) {
  return (
    <div className={`section-head${s.align === "center" ? " text-center" : ""}`}>
      <T tag="span" className="kicker" value={s.kicker || ""} onChange={(v) => ops.set(["kicker"], v)} placeholder="Small label (optional)" />
      <T tag="h2" value={s.heading || ""} onChange={(v) => ops.set(["heading"], v)} placeholder="Heading" />
    </div>
  );
}
const AddBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <div className="ed-add-row" contentEditable={false}><button type="button" className="ed-add" onClick={onClick}>+ {label}</button></div>
);
const ItemTools = ({ ops, path, i, n, label }: { ops: Ops; path: Path; i: number; n: number; label: string }) => (
  <Tools label={label} onUp={i > 0 ? () => ops.move(path, i, -1) : undefined} onDown={i < n - 1 ? () => ops.move(path, i, 1) : undefined} onRemove={() => ops.remove(path, i)} />
);

function Body({ s, ops }: { s: any; ops: Ops }) {
  const ed = useEd();
  switch (s.type) {
    case "banner":
      return (
        <div className="page-banner"><div className="container">
          <T tag="span" className="kicker" value={s.kicker || ""} onChange={(v) => ops.set(["kicker"], v)} placeholder="Small label (optional)" />
          <T tag="h1" value={s.title} onChange={(v) => ops.set(["title"], v)} placeholder="Page title" />
          <T tag="p" multiline value={s.subtitle || ""} onChange={(v) => ops.set(["subtitle"], v)} placeholder="A short line under the title (optional)" />
        </div></div>
      );
    case "hero":
      return (
        <section className="hero"><div className="container hero-inner">
          <T tag="span" className="eyebrow-note" value={s.eyebrow || ""} onChange={(v) => ops.set(["eyebrow"], v)} placeholder="Small note above the title (optional)" />
          <T tag="h1" multiline value={s.title} onChange={(v) => ops.set(["title"], v)} placeholder="Main title" />
          <RT className="lead" html={s.lead || ""} onChange={(v) => ops.set(["lead"], v)} placeholder="Introduction" />
          <div className="hero-actions">
            {s.buttons.map((b: any, i: number) => (
              <span className="ed-item ed-inline" key={i}>
                <ItemTools ops={ops} path={["buttons"]} i={i} n={s.buttons.length} label="button" />
                <Lk b={b} onChange={(nb) => ops.set(["buttons", i], nb)} />
              </span>
            ))}
          </div>
          <AddBtn label="Add a button" onClick={() => ops.add(["buttons"], { label: "Button", href: "/", style: "ghost" })} />
        </div></section>
      );
    case "quick_links":
      return (
        <div className="quick-actions"><div className="container">
          <div className="quick-grid">
            {s.items.map((it: any, i: number) => (
              <div className="quick-item ed-item" key={i}>
                <ItemTools ops={ops} path={["items"]} i={i} n={s.items.length} label="link" />
                <T tag="div" className="qi-label" value={it.label} onChange={(v) => ops.set(["items", i, "label"], v)} placeholder="Link name" />
                <T tag="div" className="qi-sub" value={it.sub || ""} onChange={(v) => ops.set(["items", i, "sub"], v)} placeholder="Short note" />
                <button type="button" className="ed-link-gear" style={{ position: "static", marginTop: 6 }} title={`Goes to: ${it.href}`} onClick={() => { const h = ed.askLink(it.href || ""); if (h !== null) ops.set(["items", i, "href"], h); }}>Link</button>
              </div>
            ))}
          </div>
          <AddBtn label="Add a link" onClick={() => ops.add(["items"], { label: "New link", sub: "", href: "/" })} />
        </div></div>
      );
    case "split": {
      const img = s.image ? <div><Im img={s.image} onChange={(im) => ops.set(["image"], im)} /></div> : <div><button type="button" className="ed-add" onClick={() => ops.set(["image"], { src: IMG, alt: "", style: "border:1px solid var(--border);" })}>+ Add a picture</button></div>;
      const text = (
        <div>
          <T tag="span" className="badge" value={s.badge || ""} onChange={(v) => ops.set(["badge"], v)} placeholder="Small label (optional)" />
          <T tag="h2" className="mt-32" value={s.heading} onChange={(v) => ops.set(["heading"], v)} placeholder="Heading" />
          {s.paragraphs.map((p: string, i: number) => (
            <div className="ed-item ed-block" key={i}>
              <ItemTools ops={ops} path={["paragraphs"]} i={i} n={s.paragraphs.length} label="paragraph" />
              <RT html={p} onChange={(v) => ops.set(["paragraphs", i], v)} placeholder="Write a paragraph" />
            </div>
          ))}
          <AddBtn label="Add a paragraph" onClick={() => ops.add(["paragraphs"], "New paragraph.")} />
          {s.button ? (
            <span className="ed-item ed-inline"><Tools label="button" onRemove={() => ops.set(["button"], null)} /><Lk b={s.button} small forceStyle="outline" onChange={(b) => ops.set(["button"], b)} /></span>
          ) : (
            <AddBtn label="Add a button" onClick={() => ops.set(["button"], { label: "Learn more", href: "/", style: "outline" })} />
          )}
        </div>
      );
      return <section className={s.bg === "alt" ? "alt-bg" : undefined}><div className="container two-col">{s.imageSide === "left" ? <>{img}{text}</> : <>{text}{img}</>}</div></section>;
    }
    case "stats":
      return (
        <section className="stats-band"><div className="container">
          <div className="stats-grid">
            {s.items.map((it: any, i: number) => (
              <div className="ed-item" key={i}>
                <ItemTools ops={ops} path={["items"]} i={i} n={s.items.length} label="number" />
                <T tag="div" className="stat-num" value={it.num} onChange={(v) => ops.set(["items", i, "num"], v)} placeholder="0" />
                <T tag="div" className="stat-label" value={it.label} onChange={(v) => ops.set(["items", i, "label"], v)} placeholder="Label" />
              </div>
            ))}
          </div>
          <AddBtn label="Add a number" onClick={() => ops.add(["items"], { num: "0", label: "Label" })} />
        </div></section>
      );
    case "cards":
      return (
        <section className={s.bg === "alt" ? "alt-bg" : undefined}><div className="container">
          <Head s={s} ops={ops} />
          <div className="card-grid">
            {s.items.map((it: any, i: number) =>
              s.variant === "news" ? (
                <div className="news-card ed-item" key={i}>
                  <ItemTools ops={ops} path={["items"]} i={i} n={s.items.length} label="card" />
                  <Im img={it.image || { src: IMG, alt: "" }} onChange={(im) => ops.set(["items", i, "image"], im)} />
                  <div className="news-body">
                    <T tag="span" className="news-date" value={it.date || ""} onChange={(v) => ops.set(["items", i, "date"], v)} placeholder="Date" />
                    <T tag="h3" value={it.title} onChange={(v) => ops.set(["items", i, "title"], v)} placeholder="Headline" />
                    <RT html={it.text || ""} onChange={(v) => ops.set(["items", i, "text"], v)} placeholder="Summary" />
                  </div>
                </div>
              ) : (
                <div className="card ed-item" key={i}>
                  <ItemTools ops={ops} path={["items"]} i={i} n={s.items.length} label="card" />
                  <T tag="span" className="card-eyebrow" value={it.eyebrow || ""} onChange={(v) => ops.set(["items", i, "eyebrow"], v)} placeholder="Label (optional)" />
                  <T tag="h3" value={it.title} onChange={(v) => ops.set(["items", i, "title"], v)} placeholder="Title" />
                  <RT html={it.text || ""} onChange={(v) => ops.set(["items", i, "text"], v)} placeholder="Description" />
                </div>
              )
            )}
          </div>
          <AddBtn label="Add a card" onClick={() => ops.add(["items"], s.variant === "news" ? { image: { src: IMG, alt: "" }, date: "", title: "Headline", text: "Summary." } : { eyebrow: "", title: "New card", text: "Description." })} />
          {s.button ? (
            <div className="text-center mt-32 ed-item ed-inline"><Tools label="button" onRemove={() => ops.set(["button"], null)} /><Lk b={s.button} forceStyle="outline" onChange={(b) => ops.set(["button"], b)} /></div>
          ) : (
            <AddBtn label="Add a button under the cards" onClick={() => ops.set(["button"], { label: "See more", href: "/", style: "outline" })} />
          )}
        </div></section>
      );
    case "features":
      return (
        <section className={s.bg === "alt" ? "alt-bg" : undefined}><div className="container">
          <Head s={s} ops={ops} />
          <div className="feature-list">
            {s.items.map((it: any, i: number) => (
              <div className="feature-item ed-item" key={i}>
                <ItemTools ops={ops} path={["items"]} i={i} n={s.items.length} label="point" />
                <T tag="div" className="feature-num" value={it.num || ""} onChange={(v) => ops.set(["items", i, "num"], v)} placeholder="01" />
                <div>
                  <T tag="h3" value={it.title} onChange={(v) => ops.set(["items", i, "title"], v)} placeholder="Title" />
                  <RT html={it.text || ""} onChange={(v) => ops.set(["items", i, "text"], v)} placeholder="Explain" />
                </div>
              </div>
            ))}
          </div>
          <AddBtn label="Add a point" onClick={() => ops.add(["items"], { num: String(s.items.length + 1).padStart(2, "0"), title: "New point", text: "Explain this point." })} />
        </div></section>
      );
    case "facilities":
      return (
        <section className={s.bg === "alt" ? "alt-bg" : undefined}><div className="container">
          <Head s={s} ops={ops} />
          <div className="facility-grid">
            {s.items.map((it: any, i: number) => (
              <div className="facility-item ed-item" key={i}>
                <ItemTools ops={ops} path={["items"]} i={i} n={s.items.length} label="box" />
                <T tag="h3" value={it.title} onChange={(v) => ops.set(["items", i, "title"], v)} placeholder="Title" />
                <RT html={it.text || ""} onChange={(v) => ops.set(["items", i, "text"], v)} placeholder="Description" />
              </div>
            ))}
          </div>
          <AddBtn label="Add a box" onClick={() => ops.add(["items"], { title: "New item", text: "Short description." })} />
        </div></section>
      );
    case "gallery":
      return (
        <section className={s.bg === "alt" ? "alt-bg" : undefined}><div className="container">
          <Head s={s} ops={ops} />
          <div className="gallery-grid">
            {s.images.map((im: any, i: number) => (
              <a className="ed-item" href="#" key={i} onClick={(e) => e.preventDefault()}>
                <ItemTools ops={ops} path={["images"]} i={i} n={s.images.length} label="picture" />
                <Im img={im} onChange={(ni) => ops.set(["images", i], { ...ni, href: im.href ?? null })} />
              </a>
            ))}
          </div>
          <AddBtn label="Add a picture" onClick={() => ops.add(["images"], { src: IMG, alt: "", style: "" })} />
          {s.button ? (
            <div className="text-center mt-32 ed-item ed-inline"><Tools label="button" onRemove={() => ops.set(["button"], null)} /><Lk b={s.button} forceStyle="outline" onChange={(b) => ops.set(["button"], b)} /></div>
          ) : (
            <AddBtn label="Add a button under the pictures" onClick={() => ops.set(["button"], { label: "See all photos", href: "/gallery", style: "outline" })} />
          )}
        </div></section>
      );
    case "cta":
      return (
        <div className="cta-band"><div className="container cta-band-inner" style={{ paddingTop: 36, paddingBottom: 36 }}>
          <div>
            <T tag="h2" style={{ marginBottom: 6 }} value={s.heading} onChange={(v) => ops.set(["heading"], v)} placeholder="Message" />
            <RT style={{ margin: 0 }} html={s.text || ""} onChange={(v) => ops.set(["text"], v)} placeholder="More detail (optional)" />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {s.buttons.map((b: any, i: number) => (
              <span className="ed-item ed-inline" key={i}>
                <ItemTools ops={ops} path={["buttons"]} i={i} n={s.buttons.length} label="button" />
                <Lk b={b} onChange={(nb) => ops.set(["buttons", i], nb)} />
              </span>
            ))}
            <AddBtn label="Add a button" onClick={() => ops.add(["buttons"], { label: "Button", href: "/", style: "outline" })} />
          </div>
        </div></div>
      );
    case "newsletter":
      return (
        <section className="newsletter tight"><div className="container"><div className="two-col" style={{ alignItems: "flex-start" }}>
          <div>
            <T tag="h2" style={{ color: "#fff" }} value={s.heading} onChange={(v) => ops.set(["heading"], v)} placeholder="Heading" />
            <RT style={{ color: "#b9c4c9" }} html={s.text || ""} onChange={(v) => ops.set(["text"], v)} placeholder="Text" />
          </div>
          <div><p style={{ color: "#8fa0aa", fontSize: "0.85rem" }}>(The email box is shown on the live page. It is a sample and does not send anything yet.)</p></div>
        </div></div></section>
      );
    case "html":
      return (
        <div
          className="ed-html"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.html) }}
          onBlur={(e) => {
            const v = sanitizeHtml(e.currentTarget.innerHTML);
            if (v !== s.html) ops.set(["html"], v);
          }}
          onClick={async (e) => {
            const t = e.target as HTMLElement;
            if (t.tagName === "IMG") {
              const img = t as HTMLImageElement;
              const r = await ed.pickImage({ src: img.getAttribute("src") || "", alt: img.getAttribute("alt") || "" });
              if (r) {
                img.setAttribute("src", r.src);
                img.setAttribute("alt", r.alt);
                const root = img.closest(".ed-html") as HTMLElement;
                ops.set(["html"], sanitizeHtml(root.innerHTML));
              }
            }
          }}
        />
      );
    default:
      return null;
  }
}

function Frame({ s, index, total, ops, onMove, onDup, onDel, onToggleHide, onAdd, children }: any) {
  const [open, setOpen] = useState(false);
  const fields = OPTIONS[s.type] || [];
  const label = s.type === "cards" && s.variant === "news" ? "News or events" : LABELS[s.type] || s.type;
  return (
    <div className={`ed-section${s.hidden ? " ed-hidden" : ""}`}>
      <div className="ed-bar" contentEditable={false}>
        <span className="ed-label">{label}{s.hidden ? " (hidden from visitors)" : ""}</span>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>↑ Up</button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}>↓ Down</button>
        <button type="button" onClick={onDup}>Duplicate</button>
        <button type="button" onClick={onToggleHide}>{s.hidden ? "Show" : "Hide"}</button>
        {fields.length > 0 && <button type="button" onClick={() => setOpen((v) => !v)}>Options</button>}
        <button type="button" className="danger" onClick={onDel}>Delete</button>
      </div>
      {open && fields.length > 0 && (
        <div className="ed-options" contentEditable={false}>
          {fields.map((f) => (
            <label key={f.key}>
              {f.label}
              <select value={s[f.key] || f.choices[0][0]} onChange={(e) => ops.set([f.key], e.target.value)}>
                {f.choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      {children}
      <div className="ed-insert" contentEditable={false}><button type="button" onClick={onAdd}>+ Add a section here</button></div>
    </div>
  );
}

export default function EditableSections({ sections, onChange }: { sections: Section[]; onChange: (s: Section[]) => void }) {
  const [adding, setAdding] = useState<number | null>(null);
  const replace = (i: number, ns: Section) => onChange(sections.map((s, k) => (k === i ? ns : s)));
  const insert = (at: number, ns: Section) => onChange([...sections.slice(0, at), ns, ...sections.slice(at)]);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const a = sections.slice();
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };

  return (
    <div className="ed-canvas">
      {sections.length === 0 && <div className="ed-empty">This page is empty. Add your first section.</div>}
      <div className="ed-insert top" contentEditable={false}><button type="button" onClick={() => setAdding(0)}>+ Add a section at the top</button></div>
      {sections.map((s, i) => (
        <Frame
          key={s.id}
          s={s}
          index={i}
          total={sections.length}
          ops={makeOps(s, (ns: any) => replace(i, ns))}
          onMove={(d: number) => move(i, d)}
          onDup={() => insert(i + 1, { ...clone(s), id: rid() })}
          onDel={() => window.confirm("Delete this whole section?") && onChange(sections.filter((_, k) => k !== i))}
          onToggleHide={() => replace(i, { ...s, hidden: !s.hidden })}
          onAdd={() => setAdding(i + 1)}
        >
          <Body s={s} ops={makeOps(s, (ns: any) => replace(i, ns))} />
        </Frame>
      ))}
      {adding !== null && (
        <AddSectionModal
          onClose={() => setAdding(null)}
          onPick={(key) => {
            const ns = newSection(key);
            if (ns) insert(adding, ns);
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}
