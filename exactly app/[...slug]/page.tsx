import { renderSitePage, siteMetadata } from "@/components/site/SitePage";

export const dynamic = "force-dynamic";

async function parts(params: any): Promise<string[]> {
  const p = await params;
  return Array.isArray(p?.slug) ? p.slug.map((s: string) => decodeURIComponent(s)) : [];
}

export async function generateMetadata({ params }: { params: any }) {
  return siteMetadata(await parts(params));
}

// Every other page of the school website (About, Academics, ... and any page the admin adds)
export default async function SitePageRoute({ params }: { params: any }) {
  return renderSitePage(await parts(params));
}
