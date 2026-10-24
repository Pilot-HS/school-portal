// What the website is made of.

export type Btn = { label: string; href: string; style?: "primary" | "outline" | "ghost" };
export type Img = { src: string; alt: string; style?: string };

type Base = { id: string; hidden?: boolean };
export type Section =
  | (Base & { type: "banner"; kicker?: string; title: string; subtitle?: string })
  | (Base & { type: "hero"; eyebrow?: string; title: string; lead?: string; buttons: Btn[] })
  | (Base & { type: "quick_links"; items: { label: string; sub?: string; href: string }[] })
  | (Base & { type: "split"; bg?: "plain" | "alt"; imageSide?: "left" | "right"; badge?: string; heading: string; paragraphs: string[]; button?: Btn | null; image?: Img | null })
  | (Base & { type: "stats"; items: { num: string; label: string }[] })
  | (Base & { type: "cards"; bg?: "plain" | "alt"; kicker?: string; heading?: string; align?: "left" | "center"; variant?: "plain" | "news"; items: { eyebrow?: string; title: string; text?: string; date?: string; image?: Img | null }[]; button?: Btn | null })
  | (Base & { type: "features"; bg?: "plain" | "alt"; kicker?: string; heading?: string; align?: "left" | "center"; items: { num?: string; title: string; text?: string }[] })
  | (Base & { type: "facilities"; bg?: "plain" | "alt"; kicker?: string; heading?: string; align?: "left" | "center"; items: { title: string; text?: string }[] })
  | (Base & { type: "gallery"; bg?: "plain" | "alt"; kicker?: string; heading?: string; align?: "left" | "center"; images: (Img & { href?: string | null })[]; button?: Btn | null })
  | (Base & { type: "cta"; heading: string; text?: string; buttons: Btn[] })
  | (Base & { type: "newsletter"; heading: string; text?: string })
  | (Base & { type: "html"; html: string });

export type SiteGeneral = {
  school_name: string;
  tagline: string;
  phone: string;
  email: string;
  address_short: string;
  apply_label: string;
  apply_href: string;
  show_portal_link: boolean;
  brand_mark?: string;
};
export type FooterLink = { label: string; href?: string };
export type SiteFooter = {
  about: string;
  social: FooterLink[];
  columns: { title: string; links: FooterLink[] }[];
  legal: FooterLink[];
  copyright: string;
};
export type SiteSettings = { general: SiteGeneral; footer: SiteFooter };

export type PageRow = {
  id: string;
  slug: string;
  parent_id: string | null;
  title: string;
  menu_label: string | null;
  position: number;
  show_in_menu: boolean;
  is_home: boolean;
  seo_description: string | null;
};

export type MenuItem = { id: string; label: string; href: string; children: MenuItem[] };
