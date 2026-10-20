"use client";

import { useTeacher } from "@/components/TeacherShell";
import ReportCardsTool from "@/components/ReportCardsTool";

export default function TeacherReportCardsPage() {
  const { classes, myClassIds } = useTeacher();
  return (
    <div className="portal-main">
      <h1 className="t-page-title no-print">Report Cards</h1>
      <ReportCardsTool classes={classes} myClassIds={myClassIds} />
    </div>
  );
}
