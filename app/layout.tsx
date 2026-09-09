import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal | Government Boys High School, P.H. Pilot, Dadu",
  description: "Student, parent, teacher, and admin portal for GBHS Pilot Dadu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="demo-banner">
          This portal is connected to a real database with real logins &mdash; but it's still in early development. Some features are read-only for now.
        </div>
        {children}
      </body>
    </html>
  );
}
