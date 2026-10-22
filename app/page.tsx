import { renderSitePage, siteMetadata } from "@/components/site/SitePage";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return siteMetadata([]);
}

// The home page of the school website
export default async function HomePage() {
  return renderSitePage([]);
}
