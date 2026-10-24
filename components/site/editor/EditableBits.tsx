"use client";

import { createContext, useContext, useLayoutEffect, useRef } from "react";
import { sanitizeHtml } from "@/lib/site/sanitize";
import { styleObj } from "@/lib/site/util";
import type { Btn, Img } from "@/lib/site/types";

export type Picked = { src: string; alt: string };
export const EdCtx = createContext<{ pickImage: (cur: Picked) => Promise<Picked | null>; askLink: (cur: string) => string | null } | null>(null);
export const useEd = () => useContext(EdCtx)!;

// One line of text the editor can type into.
export function T({ value, onChange, tag = "span", className, style, placeholder, multiline = false }: { value: string; onChange: (v: string) => void; tag?: any; className?: string; style?: any; placeholder?: string; multiline?: boolean }) {
  const Tag: any = tag;
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== (value || "")) el.textContent = value || "";
  }, [value]);
  return (
    <Tag
      ref={ref}
      className={`ed-text ${className || ""}`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder || "Type here"}
      onBlur={(e: any) => {
        const v = (e.currentTarget.textContent || "").replace(/\s+/g, " ").trim();
        if (v !== (value || "")) onChange(v);
      }}
      onKeyDown={(e: any) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onPaste={(e: any) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    />
  );
}

// A paragraph that can hold bold, italic and line breaks (Ctrl+B, Ctrl+I).
export function RT({ html, onChange, tag = "p", className, style, placeholder }: { html: string; onChange: (v: string) => void; tag?: any; className?: string; style?: any; placeholder?: string }) {
  const Tag: any = tag;
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) {
      const clean = sanitizeHtml(html || "");
      if (el.innerHTML !== clean) el.innerHTML = clean;
    }
  }, [html]);
  return (
    <Tag
      ref={ref}
      className={`ed-text ed-rich ${className || ""}`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder || "Type here"}
      onBlur={(e: any) => {
        const v = sanitizeHtml(e.currentTarget.innerHTML).trim();
        if (v !== (html || "")) onChange(v);
      }}
      onPaste={(e: any) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    />
  );
}

// A picture: click it to replace it.
export function Im({ img, onChange, className }: { img: Img; onChange: (i: Img) => void; className?: string }) {
  const ed = useEd();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`ed-img ${className || ""}`}
      src={img.src}
      alt={img.alt}
      style={styleObj(img.style)}
      title="Click to change this picture"
      onClick={async () => {
        const r = await ed.pickImage({ src: img.src, alt: img.alt });
        if (r) onChange({ ...img, src: r.src, alt: r.alt });
      }}
    />
  );
}

const BTN: Record<string, string> = { primary: "btn btn-primary", outline: "btn btn-outline", ghost: "btn btn-ghost-light" };

// A button or link: type its words, and use the chain icon to change where it goes.
export function Lk({ b, onChange, small, forceStyle }: { b: Btn; onChange: (b: Btn) => void; small?: boolean; forceStyle?: string }) {
  const ed = useEd();
  return (
    <span className="ed-link-wrap">
      <a className={`${BTN[forceStyle || b.style || "primary"]}${small ? " btn-sm" : ""}`} href="#" onClick={(e) => e.preventDefault()}>
        <T value={b.label} onChange={(label) => onChange({ ...b, label })} placeholder="Button text" />
      </a>
      <button
        type="button"
        className="ed-link-gear"
        title={`This button goes to: ${b.href || "(nowhere)"} — click to change`}
        onClick={() => {
          const h = ed.askLink(b.href || "");
          if (h !== null) onChange({ ...b, href: h });
        }}
      >
        Link
      </button>
    </span>
  );
}

// Small Up / Down / Remove buttons shown on an item while editing.
export function Tools({ onUp, onDown, onRemove, label }: { onUp?: () => void; onDown?: () => void; onRemove?: () => void; label?: string }) {
  return (
    <div className="ed-tools" contentEditable={false}>
      {onUp && <button type="button" title={`Move ${label || "this"} earlier`} onClick={onUp}>↑</button>}
      {onDown && <button type="button" title={`Move ${label || "this"} later`} onClick={onDown}>↓</button>}
      {onRemove && <button type="button" className="danger" title={`Remove ${label || "this"}`} onClick={onRemove}>✕</button>}
    </div>
  );
}
