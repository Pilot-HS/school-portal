"use client";

import { classLabel } from "@/lib/teacherUi";

// A class dropdown that lists the teacher's own classes first.
export default function ClassSelect({
  id,
  value,
  onChange,
  classes,
  myClassIds,
  placeholder = "Select a class…",
  required = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  classes: any[];
  myClassIds: string[];
  placeholder?: string;
  required?: boolean;
}) {
  const mine = classes.filter((c) => myClassIds.includes(c.id));
  const others = classes.filter((c) => !myClassIds.includes(c.id));

  return (
    <select id={id} required={required} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {mine.length > 0 ? (
        <>
          <optgroup label="Your classes">
            {mine.map((c) => (
              <option key={c.id} value={c.id}>{classLabel(c)}</option>
            ))}
          </optgroup>
          {others.length > 0 && (
            <optgroup label="Other classes">
              {others.map((c) => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </optgroup>
          )}
        </>
      ) : (
        classes.map((c) => (
          <option key={c.id} value={c.id}>{classLabel(c)}</option>
        ))
      )}
    </select>
  );
}
