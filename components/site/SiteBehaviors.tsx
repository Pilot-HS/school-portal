"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Small interactions the website needs: mobile menu, FAQ accordions, gallery filters,
// the print button, the sample forms, and the online admission form.
export default function SiteBehaviors() {
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t || !t.closest) return;

      const toggle = t.closest(".menu-toggle");
      if (toggle) {
        const nav = document.querySelector("nav.main-nav");
        nav?.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(!!nav?.classList.contains("open")));
        return;
      }
      const trigger = t.closest(".accordion-trigger");
      if (trigger) {
        const item = trigger.closest(".accordion-item");
        if (!item) return;
        const wasOpen = item.classList.contains("open");
        item.parentElement?.querySelectorAll(".accordion-item").forEach((i) => {
          i.classList.remove("open");
          i.querySelector(".accordion-trigger")?.setAttribute("aria-expanded", "false");
        });
        if (!wasOpen) {
          item.classList.add("open");
          trigger.setAttribute("aria-expanded", "true");
        }
        return;
      }
      const filterBtn = t.closest(".gallery-filter button") as HTMLElement | null;
      if (filterBtn) {
        const bar = filterBtn.closest(".gallery-filter");
        bar?.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        filterBtn.classList.add("active");
        const category = filterBtn.getAttribute("data-filter");
        document.querySelectorAll<HTMLElement>(".gallery-grid [data-category]").forEach((item) => {
          item.style.display = category === "all" || item.getAttribute("data-category") === category ? "" : "none";
        });
        return;
      }
      if (t.closest('[data-action="print"]')) {
        window.print();
      }
    }

    async function onSubmit(e: Event) {
      const form = e.target as HTMLFormElement;
      if (!form || !form.matches) return;

      if (form.matches("form[data-demo-form]")) {
        e.preventDefault();
        const note = (form.querySelector(".form-submit-note") || form.parentElement?.querySelector(".form-submit-note")) as HTMLElement | null;
        if (note) {
          note.textContent = "Thanks. This form isn't switched on yet. Please call or visit the school office.";
          note.style.color = "#2f6b4f";
        }
        return;
      }

      if (form.id === "admission-form") {
        e.preventDefault();
        const note = form.querySelector(".form-submit-note") as HTMLElement | null;
        const btn = document.getElementById("admission-submit-btn") as HTMLButtonElement | null;
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Submitting…";
        }
        const formData = new FormData(form);
        const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null);
        formData.set("sibling_enrolled", val("sibling_enrolled")?.checked ? "yes" : "no");
        formData.set("declaration_accepted", val("declaration_accepted")?.checked ? "yes" : "no");
        const studentName = val("student_full_name")?.value || "";
        const classApplying = val("class_applying_for")?.value || "";
        const yearSelect = document.getElementById("academic_year_id") as HTMLSelectElement | null;
        const yearText = yearSelect?.selectedOptions[0]?.textContent || "";
        try {
          const res = await fetch("/api/admissions/submit-application", { method: "POST", body: formData });
          const result = await res.json();
          if (res.ok) {
            const set = (id: string, text: string) => {
              const el = document.getElementById(id);
              if (el) el.textContent = text;
            };
            set("conf-ref-id", result.reference_id);
            set("conf-student-name", studentName);
            set("conf-class", classApplying);
            set("conf-academic-year", yearText);
            set("conf-date", new Date().toLocaleDateString());
            form.style.display = "none";
            const conf = document.getElementById("admission-confirmation");
            if (conf) conf.style.display = "block";
          } else if (note) {
            note.textContent = result.error || "Something went wrong. Please try again or visit the office directly.";
            note.style.color = "#a13636";
          }
        } catch {
          if (note) {
            note.textContent = "Couldn't reach the server. Please check your connection and try again.";
            note.style.color = "#a13636";
          }
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Submit Application";
        }
      }
    }

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);

    // Fill the academic-year list on the admission form
    const select = document.getElementById("academic_year_id") as HTMLSelectElement | null;
    if (select) {
      (async () => {
        try {
          const res = await fetch("/api/academic-years/list");
          const result = await res.json();
          const years: any[] = result.academic_years || [];
          if (years.length === 0) {
            select.innerHTML = '<option value="">Not available — please call the office</option>';
            return;
          }
          select.innerHTML =
            '<option value="">Select…</option>' +
            years.map((y) => `<option value="${y.id}"${y.is_current ? " selected" : ""}>${String(y.label).replace(/</g, "&lt;")}${y.is_current ? " (Current)" : ""}</option>`).join("");
        } catch {
          select.innerHTML = '<option value="">Could not load — please refresh</option>';
        }
      })();
    }

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, [pathname]);

  return null;
}
