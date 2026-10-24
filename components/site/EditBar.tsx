"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { teacherApi } from "@/lib/teacherApi";
import SiteEditor from "./editor/SiteEditor";

// Shown only to people who may change the website (the admin, and anyone the admin has allowed).
export default function EditBar({ pageId, pageTitle }: { pageId?: string; pageTitle?: string }) {
  const [access, setAccess] = useState<{ canEdit: boolean; canPublish: boolean; role: string; via: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { ok, data: me } = await teacherApi("/api/site/me");
      if (ok && me.canEdit) {
        setAccess(me);
        if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edit") === "1" && pageId) setEditing(true);
      }
    })();
  }, [pageId]);

  useEffect(() => {
    setRoot(document.getElementById("site-editor-root"));
    const site = document.querySelector(".site");
    if (!site) return;
    site.classList.toggle("site-editing", editing);
    return () => site.classList.remove("site-editing");
  }, [editing, access]);

  if (!access) return null;
  const home = access.role === "admin" ? "/admin/website" : `/${access.role}`;

  return (
    <>
      {!editing && (
        <div className="site-editbar no-print" role="status">
          <strong>{access.via === "admin" ? "Admin" : "Website editor"}</strong>
          {pageId ? <button type="button" className="site-editbtn" onClick={() => setEditing(true)}>Edit this page</button> : <span>You can edit this website.</span>}
          <Link href={home}>{access.role === "admin" ? "Website tools" : "Back to portal"}</Link>
        </div>
      )}
      {editing && pageId && root &&
        createPortal(
          <SiteEditor
            pageId={pageId}
            onExit={(published) => {
              setEditing(false);
              if (published) window.location.reload();
            }}
          />,
          root
        )}
    </>
  );
}
