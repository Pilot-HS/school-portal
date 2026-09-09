# GBHS Pilot Dadu — Student/Parent/Teacher/Admin Portal

A real, working portal connected to a Supabase database, with secure
logins and role-based access (each person only sees their own — or
their child's — data, enforced by the database itself, not just the
app).

This is **separate** from your public school website. Think of it as:
- `school-website` repo → the public site (already live)
- `school-portal` repo (this one) → the login-required portals

---

## 1. Put this code on GitHub

1. Go to [github.com](https://github.com) → **+** → **New repository**.
   Name it `school-portal`, set it to **Public** (or Private if you'd
   rather — either works with Vercel), don't add a README. Create it.
2. On the empty repo page, click **uploading an existing file** and
   drag in everything from this folder (all files and folders,
   including the hidden `.gitignore` and `.env.local.example` — but
   **never** upload a real `.env.local` file if you create one for
   local testing, since it would contain secrets).
3. Commit changes.

---

## 2. Deploy it on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up — choose
   **"Continue with GitHub"** so it's linked automatically.
2. Click **"Add New..."** → **"Project"**.
3. Find and select your `school-portal` repository, then click
   **Import**. Vercel will auto-detect it's a Next.js project.
4. Before clicking Deploy, expand **"Environment Variables"** and add
   these three (get the values from your Supabase dashboard → Project
   Settings → API Keys):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://ovkjmaoebyspdalibltw.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Publishable key (`sb_publishable_...`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | your **secret** key from the "Legacy anon, service_role API keys" tab, or the "secret" key on the new API Keys page — never share this one publicly |

5. Click **Deploy**. After 1–2 minutes you'll get a live URL like
   `https://school-portal-yourname.vercel.app`.

---

## 3. Create your first admin account (one-time, manual step)

The app only lets an *existing* admin create new accounts — which
means the very first admin has to be created directly in Supabase:

1. In Supabase, go to **Authentication** → **Users** → **Add user** →
   **Create new user**. Enter an email and password for yourself,
   and make sure "Auto Confirm User" is checked. Click Create.
2. Copy the new user's ID (a long string, e.g. `a1b2c3d4-...`) from
   the users list.
3. Go to **SQL Editor** → **New query**, and run (replacing the ID
   and name):
   ```sql
   insert into public.profiles (id, full_name, role)
   values ('paste-the-user-id-here', 'Your Name', 'admin');
   ```
4. Go to your live portal URL and log in with that email/password —
   you'll land on the Admin Dashboard, and can now use the
   **"Create New Account"** button to add everyone else.

---

## 4. Adding students, teachers, and classes

Right now, creating *logins* is self-service (via the admin's "Create
New Account" button), but linking those logins to actual student/
teacher records, and adding classes, is done directly in Supabase's
Table Editor for now (a spreadsheet-like view — no coding needed):

1. In Supabase, click **Table Editor** in the sidebar.
2. **classes** table: add rows like `grade: "9", section: "A"`.
3. **students** table: add a row per student — `full_name`, `roll_no`,
   `class_id` (pick from the classes table), and if they have a
   student login, paste their `profile_id` (their user ID from
   Authentication → Users). Leave `parent_profile_id` blank or fill it
   with the parent's user ID to link a parent account.
4. **teachers** table: similar — `full_name`, `subject`, and
   `profile_id` if they have a login.
5. **attendance**, **exam_results**, **fees**, **assignments**,
   **notices**: add rows the same way as records come in.

Building proper in-app forms for all of this (so the admin doesn't
need to touch Supabase directly) is a natural next step — happy to
build that whenever you're ready.

---

## What's real vs. what's next

**Real right now:**
- Actual login with email + password (Supabase Auth)
- Each person only sees their own (or their child's) data — enforced
  by the database's Row Level Security, not just hidden in the app
- Live data: attendance, assignments, exam results, fees, notices
- Admin can create new logins from the dashboard

**Still to build:**
- In-app forms for admin/teachers to add students, mark attendance,
  post assignments, and record results (currently done via Supabase's
  Table Editor)
- Password reset / "forgot password" flow
- Email notifications
