"use client";

function renderInput(def: any, existingValue: string, existingFileUrl: string) {
  const name = `custom_${def.id}`;
  switch (def.field_type) {
    case "short_text":
      return <input id={name} name={name} required={def.is_required} defaultValue={existingValue || ""} />;
    case "long_text":
      return (
        <textarea
          id={name}
          name={name}
          required={def.is_required}
          defaultValue={existingValue || ""}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", fontFamily: "inherit" }}
        />
      );
    case "number":
      return <input id={name} name={name} type="number" required={def.is_required} defaultValue={existingValue || ""} />;
    case "date":
      return <input id={name} name={name} type="date" required={def.is_required} defaultValue={existingValue || ""} />;
    case "dropdown": {
      const opts: string[] = Array.isArray(def.options) ? def.options : [];
      return (
        <select id={name} name={name} required={def.is_required} defaultValue={existingValue || ""}>
          <option value="">Select&hellip;</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case "yes_no":
      return (
        <select id={name} name={name} required={def.is_required} defaultValue={existingValue || ""}>
          <option value="">Select&hellip;</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
    case "file":
      return (
        <div>
          {existingFileUrl && (
            <a href={existingFileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: "0.8rem", color: "var(--accent-2)", marginBottom: "6px" }}>
              View current file
            </a>
          )}
          <input id={name} name={name} type="file" accept="image/jpeg,image/png" />
        </div>
      );
    default:
      return null;
  }
}

export default function CustomFieldInputs({
  definitions,
  section,
  values = {},
  fileUrls = {},
}: {
  definitions: any[];
  section: string;
  values?: Record<string, string>;
  fileUrls?: Record<string, string>;
}) {
  const sectionFields = definitions.filter((d) => d.section === section);
  if (sectionFields.length === 0) return null;

  return (
    <>
      {sectionFields.map((def) => (
        <div className="form-field" key={def.id}>
          <label htmlFor={`custom_${def.id}`}>{def.label}{def.is_required ? " *" : ""}</label>
          {renderInput(def, values[def.id], fileUrls[def.id])}
        </div>
      ))}
    </>
  );
}
