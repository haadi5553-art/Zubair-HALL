# Zubair Hall Mess Manager

A complete mess register for the **two wing messes (East Wing and West Wing) of Zubair Hall, University of Engineering & Technology (UET), Lahore**. It replaces the handwritten register: daily attendance, menus, ingredient consumption and expenses for Lunch and Dinner, with official reports for the Resident Tutor.

Runs on your own PC and opens on any phone or laptop over the hostel WiFi. All data stays in a database file on your disk.

---

## Features

- **Two messes, fully separate** — East Wing and West Wing have independent attendance, ingredients, expenses, rates and reports; one switch at the top of the page.
- **Daily Entry** — per meal: menu, students who ate, rate per student (pre-filled with the last used rate), and a full ingredient table (category, item, quantity, unit, unit price, auto-calculated amount, vendor/note). Day-level extra expenses (gas, salaries, repairs, transport…). Live totals while typing: ingredients cost, amount at rate, cost per student, surplus/deficit. Warnings for missing attendance or unit prices. "Copy items from previous day" saves typing.
- **Short Report** (daily and weekly, Mon–Sun) — the one-page report for the Resident Tutor: attendance and price summary, lunch ingredients, dinner ingredients, extra expenses, overall surplus/(deficit). On screen, PDF and Excel.
- **Detailed Report** (daily, weekly, monthly, custom range) — overall financial summary, day-wise summary with totals, category-wise expenditure with % share, item-wise consolidated usage, every daily record with every ingredient row, and a signature block (Mess Incharge, Munshi, Resident Tutor). PDF and Excel.
- **Dashboard** — month view with KPIs, daily expenditure vs amount-at-rate line chart, category spending, top 10 items.
- **Records** — browse, edit and delete any past day (delete requires confirmation).
- **Settings** — everything from the app: names (RT, Mess Incharge, Munshi per mess), mess strength, default rates, item/expense categories, units, password.
- **Backup & restore** — one-click full JSON backup download, restore from file, full Excel export.
- **Security** — single password login (PBKDF2-salted hash, never plain text), 60-second lock after 5 wrong attempts, HttpOnly signed session cookie, everything behind login.
- Light/dark mode, mobile-friendly layout.

## Quick start on your own PC (Windows / macOS / Linux)

**Windows: just double-click `start.bat`.** It does everything by itself:

- if Node.js is missing, it downloads its own runtime automatically (one time, ~30 MB)
- installs dependencies (first run, 5–10 minutes, needs internet)
- creates the database and builds the app
- starts the server and opens the app in the browser

After the first run, using the app daily = double-click `start.bat`, ready in about 20 seconds. To stop the app, close the black window.

Manual steps, if you prefer a terminal (Windows / macOS / Linux):

1. Install **Node.js LTS** from <https://nodejs.org>.
2. Put this folder somewhere permanent, e.g. `C:\mess-manager`.
3. Open a terminal in the folder (`cmd` in the Explorer address bar on Windows).
4. ```
   npm install        # once, 5-10 minutes
   npm run db:push    # once, creates the database
   npm run build      # once
   npm start          # every time you want to use the app
   ```
5. Allow Node.js through the firewall when Windows asks.
6. Find your PC's address: `ipconfig` → **IPv4 Address** (e.g. `192.168.1.50`).
7. On any phone on the **same WiFi**: open `http://192.168.1.50:3000`. On this PC: <http://localhost:3000>.

`./start.sh` (macOS/Linux) automates the same steps if Node.js is already installed.

**First login password:** the one chosen at setup (`Hadi2750` by default). Change it immediately in **Settings → Change password**. Forgotten? Run `npm run reset-password` and log in with the initial password again.

### Data & backups

- Everything is stored in `db/custom.db` (SQLite) next to the app.
- **Weekly habit:** Settings → Data → *Download full backup (JSON)* and keep the file in Google Drive / WhatsApp Saved Messages / USB.
- *Restore from backup file* replaces all current data with the backup (both messes).
- *Export all data to Excel* produces a readable workbook of every record.

### Optional HTTPS

The app is only reachable inside your hostel network, so HTTP is normally acceptable. If you want HTTPS anyway (e.g. with a self-signed certificate from [mkcert](https://github.com/FiloSottile/mkcert)):

```
mkcert -install
mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 192.168.1.50
npm run start:https
```

Phones will need to trust the mkcert root (visit `http://localhost:3000` once on the PC after `mkcert -install`; on phones install the generated root CA or accept the warning).

### Configuring ports / secrets

`.env` in the project folder:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Location of the SQLite file (keep as is) |
| `SESSION_SECRET` | Private random string that signs login sessions — keep private |
| `MESS_PASSWORD_HASH` | Salted PBKDF2 hash of the initial password (never the plain password) |

After changing the password in the app, the hash lives in the database; the env value is only the initial default.

### Appendix: free cloud hosting with your own URL (Vercel + Neon, no credit card)

If you want the app reachable from anywhere (not just hostel WiFi), host it on **Vercel (free) + Neon Postgres (free)**. Nothing in the code needs to change - the SQLite → Postgres switch and the table creation happen automatically during the first build. Full click-by-click guide: `Zubair-Hall-Cloud-Deploy-Guide.pdf`.

Short version:

1. Create a free **GitHub** account and upload this project (New repository → "uploading an existing file" → drag the files → Commit changes).
2. Create a free database at <https://neon.tech> and copy the connection string (`postgresql://...`).
3. At <https://vercel.com> (sign in with GitHub) → Add New Project → Import the repo.
4. **Project Name: `zubair-hall-mess`** → the app gets the URL `https://zubair-hall-mess.vercel.app`.
5. Environment Variables: `DATABASE_URL` = the Neon string, `SESSION_SECRET` = any long random text with a private suffix only you know. Then **Deploy**.
6. Open the URL, log in with the initial password and change it in Settings → Change password.

Data then lives in Neon's cloud (permanent free tier, ~0.5 GB — years of mess records). Weekly backup habit still applies: Settings → Data → Download full backup.

---

## Project structure

```
prisma/schema.prisma        database model (meals, ingredients, expenses, settings, credential)
src/lib/                    auth, settings, calculation engine, PDF/Excel builders, sample data
src/app/api/                REST API routes (auth, entries, reports, exports, backup, settings)
src/components/app/         single-page app: login, dashboard, daily entry, reports, records, settings
scripts/                    test suite (run-tests.ts), password reset, optional HTTPS server
db/custom.db                the data file (created on first run)
start.bat / start.sh        one-click starters
```

## Testing

`scripts/run-tests.ts` runs a 79-check end-to-end suite (login + lockout, validation, mess isolation, report math cross-checked against raw rows, PDF/Excel exports, backup→clear→restore roundtrip, password change, per-mess settings):

```
bash scripts/with-server.sh bun run scripts/run-tests.ts
```

## Tech stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4 + shadcn/ui, Prisma + SQLite, PDFKit, ExcelJS, Recharts. All amounts are recalculated server-side; dates are plain `YYYY-MM-DD` strings in Pakistan Standard Time.
