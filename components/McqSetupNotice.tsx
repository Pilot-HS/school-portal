export default function McqSetupNotice() {
  return (
    <div className="portal-panel">
      <h2>One-time setup needed</h2>
      <p style={{ marginTop: 0 }}>The MCQ tables haven&apos;t been created in the database yet. The school admin needs to do this once:</p>
      <ol style={{ paddingLeft: 20, lineHeight: 1.7, fontSize: "0.9rem" }}>
        <li>Open your project in <strong>Supabase</strong> and choose <strong>SQL Editor</strong>, then <strong>New query</strong>.</li>
        <li>Open the file <strong>database/mcq-setup.sql</strong> from the portal files, copy everything in it and paste it into the query.</li>
        <li>Press <strong>Run</strong>. Then come back here and reload this page.</li>
      </ol>
    </div>
  );
}
