import { Construction } from "lucide-react";

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="portal-panel" style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
        <div className="icon-badge icon-badge-amber" style={{ width: "48px", height: "48px" }}>
          <Construction size={22} />
        </div>
      </div>
      <h2 style={{ marginBottom: "8px" }}>{title}</h2>
      <p style={{ maxWidth: "440px", margin: "0 auto" }}>{description}</p>
    </div>
  );
}
