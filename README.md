# Fix the Queues (no-JavaScript version)

This version sends students **only plain HTML and CSS**, so it works on school networks that block JavaScript. All the logic runs on Netlify's servers, and the student's browser never downloads any scripts. The browser also only ever talks to your Netlify address, so it still works if the network blocks supabase.co.

## What's in the folder

| Path | What it does |
| --- | --- |
| `public/styles.css` | The design |
| `netlify/functions/app.mjs` | The app: builds each page and saves reports. Runs on Netlify, not in the browser |
| `netlify.toml` | Tells Netlify where things are |
| `supabase/schema.sql` | Database setup (run once in Supabase) |
| `supabase/seed.sql` | Optional example reports |

Your Supabase Project URL and publishable key are already inside `app.mjs`.

---

## Step 1: Set up the database (skip if you've already done it)

1. In Supabase, open **SQL Editor → New query**.
2. Paste in everything from `supabase/schema.sql` and click **Run**. You should see *Success. No rows returned*.
3. Optional: do the same with `supabase/seed.sql` for example reports.

## Step 2: Put the code on GitHub

Netlify's drag-and-drop upload can't run the server part of this app, so it needs to come from GitHub instead. You only do this once.

1. Sign up at **github.com** (free).
2. Click **+ → New repository**. Name it `fix-the-queues`, leave everything else as it is, and click **Create repository**.
3. On the next page, click **uploading an existing file**.
4. Open the unzipped `fix-the-queues-no-js` folder, select **everything inside it** (`public`, `netlify`, `supabase`, `netlify.toml` and `README.md`), and drag it onto the GitHub page.
5. Click **Commit changes**.
6. Check that GitHub shows the `netlify` and `public` folders. If they're missing, the folders didn't upload: try again in Chrome or Edge.

## Step 3: Connect Netlify

1. Sign up at **netlify.com** (choosing **Sign up with GitHub** is easiest).
2. Click **Add new project → Import an existing project → GitHub**, and allow Netlify to see your repositories.
3. Pick **fix-the-queues**.
4. Leave the settings as they are (`netlify.toml` fills them in) and click **Deploy**.
5. After about a minute, you get a link like `https://random-name-123.netlify.app`. That's your app.
6. Optional: change the address under **Project configuration → Change project name**.

**Updating later:** change a file on GitHub (click it, then the pencil icon, then **Commit changes**). Netlify updates the live site automatically within a minute.

## Step 4: Test it

Open the link on two different phones. Sign in, make a report on one, and check it appears on the other. The leaderboard refreshes itself every minute.

---

## Optional settings

In Netlify, under **Project configuration → Environment variables**, you can add:

- `SCHOOL_NAME`: your school's name, shown on the sign-in page.
- `SUPABASE_URL` and `SUPABASE_KEY`: only if you move to a different Supabase project.

After changing these, go to **Deploys → Trigger deploy → Deploy project** so they take effect.

## Running the prototype

- **Change points per issue:** Supabase → Table Editor → `issue_types`.
- **Remove an unfair report:** Table Editor → `reports`, tick `hidden`.
- **Delete demo reports:** in SQL Editor, run `delete from public.reports where reporter_name like 'Demo %';`
- Points reset every Monday (UK time). Each student name can send 10 reports a day.
- Staff can see who sent anonymous reports in Supabase. Tell students that "anonymous" means hidden from other students.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "The database isn't set up yet" | Run `supabase/schema.sql` (Step 1). |
| "The Supabase key isn't right" | Check the URL and key at the top of `netlify/functions/app.mjs`. |
| Netlify shows "Page not found" | The `netlify` folder or `netlify.toml` didn't reach GitHub. Upload them again (Step 2.4). |
| The page looks unstyled | The `public` folder didn't reach GitHub. Upload it again. |
| It stopped working after a week | Free Supabase projects pause when unused. Open Supabase and click **Restore**. |

## Limits of this prototype

There are no passwords, so a student could type someone else's name. That's fine for a small trial. Before a whole-school launch, add proper sign-in, have someone check reports regularly, and check with your school about storing students' names.
