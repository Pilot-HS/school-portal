import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublishedSections, loadSiteState, pageHref, resolvePage } from "@/lib/site/data";
import SiteShell from "./SiteShell";
import { SectionList } from "./Sections";

function NotReady({ reason }: { reason?: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#f5f6f2", color: "#163a2b", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 520, background: "#fff", border: "1px solid #dbe1da", borderRadius: 12, padding: 28 }}>
        <h1 style={{ marginTop: 0, fontSize: "1.4rem" }}>Government Boys High School, P.H. Pilot, Dadu</h1>
        <p>The new website has not been set up yet.</p>
        <p style={{ fontSize: "0.9rem", color: "#46564d" }}>
          {reason === "empty"
            ? "The website tables exist but have no content. The admin should log in, open Website, and press “Load the current website content”."
            : "The admin needs to run the one-time database setup (setup-database.sql) in Supabase, then log in, open Website, and load the current content."}
        </p>
        <Link href="/login" style={{ color: "#8a6a1a", fontWeight: 700 }}>Portal login</Link>
      </div>
    </div>
  );
}

export async function renderSitePage(parts: string[]) {
  const state = await loadSiteState();
  if (!state.ready) return <NotReady reason={state.reason} />;
  const page = resolvePage(state.pages, parts);
  if (!page) notFound();
  const sections = await loadPublishedSections(page.id);
  return (
    <SiteShell settings={state.settings} menu={state.menu} activeHref={pageHref(page, state.pages)} pageId={page.id} pageTitle={page.title}>
      <SectionList sections={sections} />
    </SiteShell>
  );
}

export async function siteMetadata(parts: string[]): Promise<Metadata> {
  const state = await loadSiteState();
  if (!state.ready) return { title: "Government Boys High School, P.H. Pilot, Dadu" };
  const page = resolvePage(state.pages, parts);
  const school = state.settings.general.school_name;
  if (!page) return { title: school };
  return {
    title: page.is_home ? `Home | ${school}` : `${page.title} | ${school}`,
    description: page.seo_description || undefined,
  };
}
