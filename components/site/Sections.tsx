import type { Btn, Section } from "@/lib/site/types";
import { sanitizeHtml } from "@/lib/site/sanitize";
import { styleObj } from "@/lib/site/util";

const BTN: Record<string, string> = { primary: "btn btn-primary", outline: "btn btn-outline", ghost: "btn btn-ghost-light" };
const Html = ({ as: Tag = "p", html, style, className }: { as?: any; html?: string; style?: any; className?: string }) =>
  html ? <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} /> : null;
const A = ({ b, className, small }: { b: Btn; className?: string; small?: boolean }) => (
  <a className={`${className || BTN[b.style || "primary"]}${small ? " btn-sm" : ""}`} href={b.href || "#"}>{b.label}</a>
);

function Head({ kicker, heading, align }: { kicker?: string; heading?: string; align?: string }) {
  if (!kicker && !heading) return null;
  return (
    <div className={`section-head${align === "center" ? " text-center" : ""}`}>
      {kicker ? <span className="kicker">{kicker}</span> : null}
      {heading ? <h2>{heading}</h2> : null}
    </div>
  );
}
const Wrap = ({ bg, children }: { bg?: string; children: React.ReactNode }) => (
  <section className={bg === "alt" ? "alt-bg" : undefined}>
    <div className="container">{children}</div>
  </section>
);
const CenterBtn = ({ b }: { b?: Btn | null }) => (b && b.label ? <div className="text-center mt-32"><A b={{ ...b, style: "outline" }} /></div> : null);

export function SectionView({ section: s }: { section: Section }) {
  switch (s.type) {
    case "banner":
      return (
        <div className="page-banner" data-section={s.id}>
          <div className="container">
            {s.kicker ? <span className="kicker">{s.kicker}</span> : null}
            <h1>{s.title}</h1>
            {s.subtitle ? <p>{s.subtitle}</p> : null}
          </div>
        </div>
      );
    case "hero":
      return (
        <section className="hero" data-section={s.id}>
          <div className="container hero-inner">
            {s.eyebrow ? <span className="eyebrow-note">{s.eyebrow}</span> : null}
            <h1>{s.title}</h1>
            <Html html={s.lead} className="lead" />
            <div className="hero-actions">{s.buttons.map((b, i) => <A key={i} b={b} />)}</div>
          </div>
        </section>
      );
    case "quick_links":
      return (
        <div className="quick-actions" data-section={s.id}>
          <div className="container">
            <div className="quick-grid">
              {s.items.map((it, i) => (
                <a key={i} href={it.href} className="quick-item">
                  <div className="qi-label">{it.label}</div>
                  {it.sub ? <div className="qi-sub">{it.sub}</div> : null}
                </a>
              ))}
            </div>
          </div>
        </div>
      );
    case "split": {
      const img = s.image ? (
        <div>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={s.image.src} alt={s.image.alt} style={styleObj(s.image.style) || { border: "1px solid var(--border)" }} /></div>
      ) : null;
      const text = (
        <div>
          {s.badge ? <span className="badge">{s.badge}</span> : null}
          {s.heading ? <h2 className="mt-32">{s.heading}</h2> : null}
          {s.paragraphs.map((p, i) => <Html key={i} html={p} />)}
          {s.button && s.button.label ? <A b={{ ...s.button, style: "outline" }} small /> : null}
        </div>
      );
      return (
        <section className={s.bg === "alt" ? "alt-bg" : undefined} data-section={s.id}>
          <div className="container two-col">{s.imageSide === "left" ? <>{img}{text}</> : <>{text}{img}</>}</div>
        </section>
      );
    }
    case "stats":
      return (
        <section className="stats-band" data-section={s.id}>
          <div className="container">
            <div className="stats-grid">
              {s.items.map((it, i) => (
                <div key={i}><div className="stat-num">{it.num}</div><div className="stat-label">{it.label}</div></div>
              ))}
            </div>
          </div>
        </section>
      );
    case "cards":
      return (
        <section className={s.bg === "alt" ? "alt-bg" : undefined} data-section={s.id}>
          <div className="container">
            <Head kicker={s.kicker} heading={s.heading} align={s.align} />
            <div className="card-grid">
              {s.items.map((it, i) =>
                s.variant === "news" ? (
                  <div className="news-card" key={i}>
                    {it.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.image.src} alt={it.image.alt} style={styleObj(it.image.style)} /> : null}
                    <div className="news-body">
                      {it.date ? <span className="news-date">{it.date}</span> : null}
                      <h3>{it.title}</h3>
                      <Html html={it.text} />
                    </div>
                  </div>
                ) : (
                  <div className="card" key={i}>
                    {it.eyebrow ? <span className="card-eyebrow">{it.eyebrow}</span> : null}
                    <h3>{it.title}</h3>
                    <Html html={it.text} />
                  </div>
                )
              )}
            </div>
            <CenterBtn b={s.button} />
          </div>
        </section>
      );
    case "features":
      return (
        <section className={s.bg === "alt" ? "alt-bg" : undefined} data-section={s.id}>
          <div className="container">
            <Head kicker={s.kicker} heading={s.heading} align={s.align} />
            <div className="feature-list">
              {s.items.map((it, i) => (
                <div className="feature-item" key={i}>
                  <div className="feature-num">{it.num || String(i + 1).padStart(2, "0")}</div>
                  <div><h3>{it.title}</h3><Html html={it.text} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "facilities":
      return (
        <section className={s.bg === "alt" ? "alt-bg" : undefined} data-section={s.id}>
          <div className="container">
            <Head kicker={s.kicker} heading={s.heading} align={s.align} />
            <div className="facility-grid">
              {s.items.map((it, i) => (
                <div className="facility-item" key={i}><h3>{it.title}</h3><Html html={it.text} /></div>
              ))}
            </div>
          </div>
        </section>
      );
    case "gallery":
      return (
        <section className={s.bg === "alt" ? "alt-bg" : undefined} data-section={s.id}>
          <div className="container">
            <Head kicker={s.kicker} heading={s.heading} align={s.align} />
            <div className="gallery-grid">
              {s.images.map((im, i) => {
                // eslint-disable-next-line @next/next/no-img-element
                const el = <img src={im.src} alt={im.alt} style={styleObj(im.style)} />;
                return im.href ? <a key={i} href={im.href}>{el}</a> : <div key={i}>{el}</div>;
              })}
            </div>
            <CenterBtn b={s.button} />
          </div>
        </section>
      );
    case "cta":
      return (
        <div className="cta-band" data-section={s.id}>
          <div className="container cta-band-inner" style={{ paddingTop: 36, paddingBottom: 36 }}>
            <div>
              <h2 style={{ marginBottom: 6 }}>{s.heading}</h2>
              <Html html={s.text} style={{ margin: 0 }} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{s.buttons.map((b, i) => <A key={i} b={b} />)}</div>
          </div>
        </div>
      );
    case "newsletter":
      return (
        <section className="newsletter tight" data-section={s.id}>
          <div className="container">
            <div className="two-col" style={{ alignItems: "flex-start" }}>
              <div>
                <h2 style={{ color: "#fff" }}>{s.heading}</h2>
                <Html html={s.text} style={{ color: "#b9c4c9" }} />
              </div>
              <div>
                <form className="newsletter-form" data-demo-form>
                  <input type="email" placeholder="Your email address" required aria-label="Email address" />
                  <button type="submit" className="btn btn-primary">Subscribe</button>
                </form>
                <p className="form-submit-note" style={{ color: "#8fa0aa", fontSize: "0.8rem", marginTop: 10 }} />
              </div>
            </div>
          </div>
        </section>
      );
    case "html":
      return <div style={{ display: "contents" }} data-section={s.id} dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.html) }} />;
    default:
      return null;
  }
}

export function SectionList({ sections }: { sections: Section[] }) {
  return <>{sections.map((s) => <SectionView key={s.id} section={s} />)}</>;
}
