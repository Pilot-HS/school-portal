import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Government Boys High School, P.H. Pilot, Dadu",
  description: "Government Boys High School, P.H. Pilot, Dadu: the school website and the student, parent, teacher and admin portal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
