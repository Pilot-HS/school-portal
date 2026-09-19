const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export default function TimetableGrid({
  entries,
  showTeacher = true,
  showClass = false,
}: {
  entries: any[];
  showTeacher?: boolean;
  showClass?: boolean;
}) {
  function findEntry(d: string, p: number) {
    return entries.filter((e) => e.day_of_week === d && e.period_number === p);
  }

  if (entries.length === 0) {
    return <p>No timetable has been set up for this class yet.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Period</th>
            {DAYS.map((d) => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => (
            <tr key={p}>
              <td>{p}</td>
              {DAYS.map((d) => {
                const matches = findEntry(d, p);
                return (
                  <td key={d} style={{ minWidth: "110px" }}>
                    {matches.length === 0 ? (
                      <span style={{ color: "var(--border)" }}>&mdash;</span>
                    ) : (
                      matches.map((entry) => (
                        <div key={entry.id} style={{ marginBottom: "4px" }}>
                          <div style={{ fontWeight: 600 }}>{entry.subject}</div>
                          {showClass && entry.classes?.name && (
                            <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{entry.classes.name}</div>
                          )}
                          {showTeacher && entry.teachers?.full_name && (
                            <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{entry.teachers.full_name}</div>
                          )}
                        </div>
                      ))
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
