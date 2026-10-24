import type { Section } from "./types";

const id = () => Math.random().toString(36).slice(2, 12);
const IMG = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1000&q=70";

export type TemplateInfo = { key: string; name: string; description: string; make: () => Section };

export const TEMPLATES: TemplateInfo[] = [
  {
    key: "split", name: "Text with picture", description: "A heading and paragraphs beside a photo",
    make: () => ({ id: id(), type: "split", bg: "plain", imageSide: "right", badge: "About", heading: "Write your heading here", paragraphs: ["Click here and write about this topic. You can add more paragraphs later."], button: null, image: { src: IMG, alt: "Describe the picture", style: "border:1px solid var(--border);" } }),
  },
  {
    key: "cards", name: "Cards", description: "Boxes with a title and short text",
    make: () => ({ id: id(), type: "cards", bg: "alt", kicker: "Section label", heading: "Section heading", align: "center", variant: "plain", button: null, items: [{ eyebrow: "Label", title: "First card", text: "Short description." }, { eyebrow: "Label", title: "Second card", text: "Short description." }, { eyebrow: "Label", title: "Third card", text: "Short description." }] }),
  },
  {
    key: "news", name: "News or events", description: "Cards with a picture, date and text",
    make: () => ({ id: id(), type: "cards", bg: "plain", kicker: "News", heading: "Latest news", align: "center", variant: "news", button: null, items: [{ image: { src: IMG, alt: "News picture" }, date: "1 January 2027", title: "News headline", text: "A short summary of the news." }, { image: { src: IMG, alt: "News picture" }, date: "1 January 2027", title: "News headline", text: "A short summary of the news." }, { image: { src: IMG, alt: "News picture" }, date: "1 January 2027", title: "News headline", text: "A short summary of the news." }] }),
  },
  {
    key: "features", name: "Numbered list", description: "Points with numbers, like reasons or steps",
    make: () => ({ id: id(), type: "features", bg: "plain", kicker: "Why us", heading: "A list of points", align: "left", items: [{ num: "01", title: "First point", text: "Explain this point." }, { num: "02", title: "Second point", text: "Explain this point." }, { num: "03", title: "Third point", text: "Explain this point." }] }),
  },
  {
    key: "facilities", name: "Small boxes", description: "A grid of short items, like facilities",
    make: () => ({ id: id(), type: "facilities", bg: "alt", kicker: "Facilities", heading: "What we offer", align: "center", items: [{ title: "Item one", text: "Short description." }, { title: "Item two", text: "Short description." }, { title: "Item three", text: "Short description." }, { title: "Item four", text: "Short description." }] }),
  },
  {
    key: "gallery", name: "Photo gallery", description: "A grid of pictures",
    make: () => ({ id: id(), type: "gallery", bg: "plain", kicker: "Gallery", heading: "Photos", align: "center", button: null, images: [1, 2, 3, 4, 5, 6].map(() => ({ src: IMG, alt: "Photo", style: "" })) }),
  },
  {
    key: "stats", name: "Numbers band", description: "Big numbers, like students and teachers",
    make: () => ({ id: id(), type: "stats", items: [{ num: "100", label: "First number" }, { num: "200", label: "Second number" }, { num: "300", label: "Third number" }, { num: "400", label: "Fourth number" }] }),
  },
  {
    key: "banner", name: "Page title banner", description: "A heading bar for the top of a page",
    make: () => ({ id: id(), type: "banner", kicker: "Section", title: "Page title", subtitle: "A short line under the title." }),
  },
  {
    key: "cta", name: "Call to action", description: "A highlighted bar with a message and buttons",
    make: () => ({ id: id(), type: "cta", heading: "A message to your visitors", text: "Tell people what to do next.", buttons: [{ label: "Button", href: "/contact", style: "primary" }] }),
  },
  {
    key: "quick", name: "Quick links", description: "A row of shortcuts",
    make: () => ({ id: id(), type: "quick_links", items: [{ label: "First link", sub: "Short note", href: "/" }, { label: "Second link", sub: "Short note", href: "/" }, { label: "Third link", sub: "Short note", href: "/" }] }),
  },
  {
    key: "text", name: "Plain text", description: "A heading and paragraphs, nothing else",
    make: () => ({ id: id(), type: "html", html: '<section><div class="container"><div class="section-head"><h2>Heading</h2></div><p>Click here and write your text. Select words and press Ctrl+B for bold.</p></div></section>' }),
  },
  {
    key: "downloads", name: "Downloads list", description: "Documents people can download",
    make: () => ({ id: id(), type: "html", html: '<section><div class="container"><div class="section-head"><span class="kicker">Downloads</span><h2>Documents</h2></div><div class="resource-list"><div class="resource-item"><div><h3>Document name</h3><p>PDF</p></div><a class="btn btn-outline btn-sm" href="#">Download</a></div><div class="resource-item"><div><h3>Another document</h3><p>PDF</p></div><a class="btn btn-outline btn-sm" href="#">Download</a></div></div></div></section>' }),
  },
  {
    key: "table", name: "Table", description: "Rows and columns, like fees or timetables",
    make: () => ({ id: id(), type: "html", html: '<section><div class="container"><div class="section-head"><h2>Table heading</h2></div><table class="fee-table"><thead><tr><th>Column one</th><th>Column two</th><th>Column three</th></tr></thead><tbody><tr><td>Row 1</td><td>Detail</td><td>Detail</td></tr><tr><td>Row 2</td><td>Detail</td><td>Detail</td></tr></tbody></table></div></section>' }),
  },
  {
    key: "contact", name: "Address and map", description: "Contact details with a Google map",
    make: () => ({ id: id(), type: "html", html: '<section><div class="container two-col"><div><h2>Visit or call us</h2><ul class="contact-info-list"><li><div><strong>Address</strong><span>Write the address here</span></div></li><li><div><strong>Phone</strong><span>Write the phone number here</span></div></li><li><div><strong>Email</strong><span>Write the email here</span></div></li></ul></div><div><div class="map-embed"><iframe title="Map" width="100%" height="100%" style="border:0;" loading="lazy" src="https://www.google.com/maps?q=Dadu,Sindh,Pakistan&output=embed"></iframe></div></div></div></section>' }),
  },
];

export function newSection(key: string): Section | null {
  const t = TEMPLATES.find((x) => x.key === key);
  return t ? t.make() : null;
}
