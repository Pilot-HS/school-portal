import Link from "next/link";
import "../../app/site/site.css";
import type { MenuItem, SiteSettings } from "@/lib/site/types";
import SiteBehaviors from "./SiteBehaviors";
import EditBar from "./EditBar";

const FONTS = "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap";

export default function SiteShell({ settings, menu, activeHref, pageId, pageTitle, children }: { settings: SiteSettings; menu: MenuItem[]; activeHref: string; pageId?: string; pageTitle?: string; children: React.ReactNode }) {
  const g = settings.general;
  const f = settings.footer;
  const mark = (g.brand_mark || g.school_name || "G").trim().charAt(0).toUpperCase();
  const isActive = (m: MenuItem) => m.href === activeHref || m.children.some((c) => c.href === activeHref);

  return (
    <div className="site">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTS} />

      <div className="topbar">
        <div className="container">
          <div className="topbar-info">
            {g.phone ? <span>&#9742; {g.phone}</span> : null}
            {g.email ? <span>&#9993; {g.email}</span> : null}
            {g.address_short ? <span>&#128205; {g.address_short}</span> : null}
          </div>
          <div className="topbar-links">{g.show_portal_link ? <Link href="/login" className="portal-link">Portal Login</Link> : null}</div>
        </div>
      </div>

      <header className="site-header">
        <div className="container nav-row">
          <Link href="/" className="brand">
            <div className="brand-mark">{mark}</div>
            <div className="brand-text">
              <span className="school-name">{g.school_name}</span>
              {g.tagline ? <span className="school-tagline">{g.tagline}</span> : null}
            </div>
          </Link>
          <nav className="main-nav">
            {menu.map((m) =>
              m.children.length > 0 ? (
                <div className="nav-item has-sub" key={m.id}>
                  <Link href={m.href} className={isActive(m) ? "active" : undefined}>{m.label}</Link>
                  <div className="nav-sub">
                    {m.children.map((c) => <Link key={c.id} href={c.href} className={c.href === activeHref ? "active" : undefined}>{c.label}</Link>)}
                  </div>
                </div>
              ) : (
                <Link key={m.id} href={m.href} className={isActive(m) ? "active" : undefined}>{m.label}</Link>
              )
            )}
          </nav>
          <div className="header-cta">
            {g.apply_label ? <Link href={g.apply_href || "/admissions"} className="btn btn-primary btn-sm">{g.apply_label}</Link> : null}
            <button className="menu-toggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
          </div>
        </div>
      </header>

      <div className="site-page-content">{children}</div>
      <div id="site-editor-root"></div>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="brand" style={{ marginBottom: 14 }}>
                <div className="brand-mark">{mark}</div>
                <div className="brand-text"><span className="school-name" style={{ color: "#fff" }}>{g.school_name}</span></div>
              </div>
              {f.about ? <p style={{ fontSize: "0.87rem", maxWidth: 280 }}>{f.about}</p> : null}
              {f.social.length > 0 && (
                <div className="footer-social mt-32">
                  {f.social.map((s, i) => <a key={i} href={s.href || "#"} aria-label={s.label}>{s.label}</a>)}
                </div>
              )}
            </div>
            {f.columns.map((col, i) => (
              <div key={i}>
                <h4>{col.title}</h4>
                <ul>{col.links.map((l, j) => <li key={j}>{l.href ? <a href={l.href}>{l.label}</a> : l.label}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <span>{f.copyright}</span>
            <div style={{ display: "flex", gap: 18 }}>{f.legal.map((l, i) => <a key={i} href={l.href || "#"}>{l.label}</a>)}</div>
          </div>
        </div>
      </footer>

      <SiteBehaviors />
      <EditBar pageId={pageId} pageTitle={pageTitle} />
    </div>
  );
}
