"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { teacherApi } from "@/lib/teacherApi";

// Shown only to people who may change the website (the admin, and anyone the admin has allowed).
export default function EditBar() {
  const [access, setAccess] = useState<{ canEdit: boolean; canPublish: boolean; role: string; via: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { ok, data: me } = await teacherApi("/api/site/me");
      if (ok && me.canEdit) setAccess(me);
    })();
  }, []);

  if (!access) return null;
  const home = access.role === "admin" ? "/admin/website" : `/${access.role}`;
  return (
    <div className="site-editbar no-print" role="status">
      <strong>{access.via === "admin" ? "Admin" : "Website editor"}</strong>
      <span>You can edit this website{access.canPublish ? "" : " (an admin publishes your changes)"}.</span>
      <Link href={home}>{access.role === "admin" ? "Website tools" : "Back to portal"}</Link>
    </div>
  );
}
