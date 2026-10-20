"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";
import McqSetupNotice from "@/components/McqSetupNotice";
import { teacherApi } from "@/lib/teacherApi";
import { questionsForVersion, PaperQuestion } from "@/lib/mcqShuffle";
import { omrSheetSvg } from "@/lib/omrLayout";

const SCHOOL = "Government Boys High School, P.H. Pilot, Dadu";
type Tab = "paper" | "key" | "omr";

export default function PaperPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("paper");
  const [version, setVersion] = useState("A");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { ok, data: d } = await teacherApi(`/api/teacher/mcq-papers?id=${id}`);
      if (!ok) {
        if (d.setup_needed) setSetupNeeded(true);
        else setError(d.error || "Could not load this paper.");
      } else setData(d);
      setLoading(false);
    })();
  }, [id]);

  const paper = data?.paper;
  const questions: PaperQuestion[] = useMemo(
    () => (paper ? questionsForVersion(paper.id, paper.questions, version) : []),
    [paper, version]
  );

  if (setupNeeded) return <div className="portal-main"><McqSetupNotice /></div>;
  if (loading) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 300 }} /></div>;
  if (error || !paper) {
    return (
      <div className="portal-main">
        <Link href="/teacher/mcq/papers" className="t-back"><ArrowLeft size={15} /> All papers</Link>
        <div className="t-error" role="alert"><span>{error || "Paper not found."}</span></div>
      </div>
    );
  }

  const n = questions.length;
  const total = n * Number(paper.marks_per_question);
  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  const subtitle = [data.subject_name, data.class_name && `Class ${data.class_name}`].filter(Boolean).join(" · ");

  async function remove() {
    if (!window.confirm("Delete this paper? This can't be undone.")) return;
    setBusy(true);
    const { ok, data: d } = await teacherApi("/api/teacher/mcq-papers", { method: "DELETE", body: { id } });
    if (!ok) {
      setError(d.error || "Could not delete the paper.");
      setBusy(false);
      return;
    }
    router.push("/teacher/mcq/papers");
  }

  return (
    <div className="portal-main">
      <div className="no-print">
        <Link href="/teacher/mcq/papers" className="t-back"><ArrowLeft size={15} /> All papers</Link>
        <h1 className="t-page-title" style={{ marginTop: 8 }}>{paper.title}</h1>
        <p className="t-test-meta" style={{ marginTop: -6, marginBottom: 16 }}>
          {n} questions · {fmt(total)} marks{paper.duration_minutes ? ` · ${paper.duration_minutes} minutes` : ""}
        </p>

        <div className="t-segment" role="tablist">
          <button className={tab === "paper" ? "active" : ""} onClick={() => setTab("paper")}>Question paper</button>
          <button className={tab === "key" ? "active" : ""} onClick={() => setTab("key")}>Answer key</button>
          <button className={tab === "omr" ? "active" : ""} onClick={() => setTab("omr")}>OMR sheet</button>
        </div>

        <div className="portal-panel" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          {tab !== "omr" && (
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="ver">Version</label>
              <select id="ver" value={version} onChange={(e) => setVersion(e.target.value)}>
                <option value="A">A — original order</option>
                <option value="B">B — shuffled</option>
                <option value="C">C — shuffled</option>
                <option value="D">D — shuffled</option>
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print</button>
          {data.can_edit && <button className="btn btn-outline" onClick={remove} disabled={busy}><Trash2 size={15} /> Delete paper</button>}
        </div>
        {tab === "paper" && <p className="t-hint" style={{ marginTop: 0 }}>Using several versions? Print each version separately. Students fill their version letter on the OMR sheet.</p>}
        {tab === "omr" && <p className="t-hint" style={{ marginTop: 0 }}>Print one OMR sheet per student, on plain white paper at normal size. Do not crop the four black corner squares.</p>}
      </div>

      {tab === "paper" && (
        <div className="print-sheet paper">
          <div className="paper-head">
            <div className="paper-school">{SCHOOL}</div>
            <div className="paper-title">{paper.title}</div>
            <div className="paper-meta">
              {[data.subject_name, data.class_name && `Class ${data.class_name}`, paper.duration_minutes && `Time: ${paper.duration_minutes} min`, `Total marks: ${fmt(total)}`].filter(Boolean).join("   |   ")}
            </div>
            <div className="paper-version">Version {version}</div>
          </div>
          <div className="paper-lines"><span>Name: ______________________________</span><span>Roll No: __________</span><span>Date: ____________</span></div>
          {paper.instructions && <p className="paper-ins"><strong>Instructions:</strong> {paper.instructions}</p>}
          <ol className="paper-questions">
            {questions.map((q) => (
              <li className="pq" key={q.id}>
                <div className="pq-text">{q.text}</div>
                <div className="pq-opts">
                  {(["A", "B", "C", "D"] as const).map((o, i) => (
                    <div key={o}><strong>{o}.</strong> {q.options[i]}</div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === "key" && (
        <div className="print-sheet paper">
          <div className="paper-head">
            <div className="paper-school">{SCHOOL}</div>
            <div className="paper-title">Answer Key — {paper.title}</div>
            <div className="paper-meta">{[subtitle, `Version ${version}`, `${fmt(total)} marks`].filter(Boolean).join("   |   ")}</div>
          </div>
          <div className="key-grid">
            {questions.map((q, i) => (
              <div key={q.id} className="key-cell"><span>{i + 1}</span><strong>{q.correct}</strong></div>
            ))}
          </div>
        </div>
      )}

      {tab === "omr" && (
        n > 100 ? (
          <div className="t-error"><span>OMR sheets support up to 100 questions.</span></div>
        ) : (
          <div className="print-sheet omr-sheet" dangerouslySetInnerHTML={{ __html: omrSheetSvg({ school: SCHOOL, title: paper.title, subtitle, numQuestions: n }) }} />
        )
      )}
    </div>
  );
}
