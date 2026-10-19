"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The old "Enter Exam Results" page has been replaced by the new Tests area.
export default function OldResultsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/teacher/tests");
  }, [router]);
  return <div className="loading-shell">Opening Tests&hellip;</div>;
}
