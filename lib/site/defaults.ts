import type { SiteSettings } from "./types";

// Safe to import in the browser too (no database code).
export const DEFAULT_SETTINGS: SiteSettings = {
  general: {
    school_name: "Government Boys High School, P.H. Pilot, Dadu",
    tagline: "Learning Today, Leading Tomorrow",
    phone: "",
    email: "",
    address_short: "",
    apply_label: "Apply Now",
    apply_href: "/admissions",
    show_portal_link: true,
  },
  footer: { about: "", social: [], columns: [], legal: [], copyright: "" },
};
