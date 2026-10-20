"use client";

import Link from "next/link";
import { ListChecks, FileText, ScanLine, ChevronRight } from "lucide-react";

export default function McqHubPage() {
  const cards = [
    { href: "/teacher/mcq/questions", title: "Question Bank", desc: "Add and organise multiple-choice questions", icon: ListChecks, tone: "blue" },
    { href: "/teacher/mcq/papers", title: "Make a Paper", desc: "Build a printable paper, answer key and OMR sheet", icon: FileText, tone: "green" },
    { href: "/teacher/mcq/scan", title: "Check OMR Sheets", desc: "Photograph filled sheets and get marks instantly", icon: ScanLine, tone: "amber" },
  ];
  return (
    <div className="portal-main">
      <h1 className="t-page-title">MCQ &amp; OMR</h1>
      <div className="t-actions" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.href} href={c.href} className="t-action">
              <div className={`icon-badge icon-badge-${c.tone}`}><Icon size={22} /></div>
              <div>
                <div className="t-action-title">{c.title}</div>
                <div className="t-action-desc">{c.desc}</div>
              </div>
              <ChevronRight size={18} className="t-action-arrow" />
            </Link>
          );
        })}
      </div>
      <div className="portal-panel">
        <h2>How it works</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: "0.92rem", margin: 0 }}>
          <li>Add your questions to the <strong>Question Bank</strong> (type them in, or paste many at once).</li>
          <li><strong>Make a Paper</strong> by choosing questions. Print the paper, the answer key and the OMR answer sheet.</li>
          <li>Students answer on the OMR sheet. Photograph each sheet in <strong>Check OMR Sheets</strong> and save the marks into a test.</li>
        </ol>
      </div>
    </div>
  );
}
