"use client";

import { useEffect, useState } from "react";
import { siteApi } from "@/lib/site/client";
import { ModalShell } from "./Modals";
import { cleanUrl } from "@/lib/site/validate";

// Makes big phone photos smaller before they are uploaded.
async function shrink(file: File, max = 1600): Promise<File> {
  if (file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    const f = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (f === 1 && file.size < 700_000) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * f);
    c.height = Math.round(bmp.height * f);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const type = file.type === "image/png" && file.size < 500_000 ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), type, 0.85));
    if (!blob) return file;
    return new File([blob], `photo.${type === "image/png" ? "png" : "jpg"}`, { type });
  } catch {
    return file;
  }
}

export default function MediaPicker({ current, onDone }: { current: { src: string; alt: string }; onDone: (r: { src: string; alt: string } | null) => void }) {
  const [tab, setTab] = useState<"upload" | "library" | "web">("upload");
  const [alt, setAlt] = useState(current.alt || "");
  const [library, setLibrary] = useState<{ id: string; url: string }[]>([]);
  const [web, setWeb] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tab !== "library") return;
    (async () => {
      const { ok, data } = await siteApi("/api/site/media");
      if (ok) setLibrary(data.media || []);
    })();
  }, [tab]);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    const small = await shrink(file);
    const form = new FormData();
    form.append("file", small);
    const { ok, data } = await siteApi("/api/site/upload", { form });
    setBusy(false);
    if (!ok) return setError(data.error || "The upload didn't work. Please try again.");
    onDone({ src: data.url, alt });
  }

  function useWeb() {
    const u = cleanUrl(web);
    if (!/^https?:\/\//i.test(u) && !u.startsWith("/")) return setError("Paste a full picture address starting with https://");
    onDone({ src: u, alt });
  }

  return (
    <ModalShell title="Change the picture" onClose={() => onDone(null)} wide>
      <div className="ed-tabs">
        <button type="button" className={tab === "upload" ? "on" : ""} onClick={() => setTab("upload")}>Upload a photo</button>
        <button type="button" className={tab === "library" ? "on" : ""} onClick={() => setTab("library")}>Pictures already uploaded</button>
        <button type="button" className={tab === "web" ? "on" : ""} onClick={() => setTab("web")}>Web address</button>
      </div>
      <label className="ed-field">Describe the picture (for people who can&apos;t see it)
        <input value={alt} maxLength={150} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Students playing cricket" />
      </label>
      {tab === "upload" && (
        <label className="ed-drop">
          {busy ? "Uploading…" : "Tap to choose a photo from your phone or computer"}
          <input type="file" accept="image/*" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      )}
      {tab === "library" && (
        <div className="ed-library">
          {library.length === 0 && <p>No uploaded pictures yet.</p>}
          {library.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt="" onClick={() => onDone({ src: m.url, alt })} />
          ))}
        </div>
      )}
      {tab === "web" && (
        <div>
          <input className="ed-weburl" placeholder="https://…" value={web} onChange={(e) => setWeb(e.target.value)} />
          <div className="ed-actions"><button type="button" className="ed-primary" onClick={useWeb}>Use this picture</button></div>
        </div>
      )}
      {current.src && alt !== current.alt && <div className="ed-actions"><button type="button" onClick={() => onDone({ src: current.src, alt })}>Keep the picture, only change the description</button></div>}
      {error && <p className="ed-error">{error}</p>}
    </ModalShell>
  );
}
