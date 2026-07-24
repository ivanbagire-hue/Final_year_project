# Manics Ltd Partnership Management System

Version 2.0 is a database-backed web application for managing partners, deals,
contracts, communications, users, and management reports.

## Architecture

```text
Browser (HTML/CSS/JavaScript)
              |
              | JSON over HTTP + HttpOnly session cookie
              v
Node.js HTTP server (`server.js`)
              |
              v
SQLite database (`data/manics.sqlite`)
              |
              +-- Contract files (`data/uploads/`)
```

The server uses only Node.js built-in modules. There are no third-party
dependencies or external services required for a school demonstration.

## Requirements

- Windows 10 or 11
- A modern browser such as Chrome, Edge, or Firefox

The launcher checks for Node.js 22.5 or newer. If it is missing or outdated,
the launcher automatically installs the current Node.js LTS release through
Windows Package Manager (`winget`) before starting the application. The backend
uses Node's built-in SQLite module, so there are no npm packages to install.

If both Node.js and `winget` are unavailable, the launcher explains how to
install Node.js manually; Windows cannot safely install software without either
a package manager or user authorization.

## Run the system

Open PowerShell in this folder and run:

```powershell
.\start-system.cmd
```

This launcher:

1. Finds Node.js even when PowerShell or Conda has a stale `PATH`.
2. Verifies that Node.js is version 22.5 or newer.
3. Installs or upgrades Node.js LTS with `winget` when necessary.
4. Verifies the built-in SQLite module.
5. Detects whether the Manics server is already running.
6. Starts the server and creates the SQLite database automatically on first run.

Alternatively, if dependencies are already installed, run Node directly:

```powershell
& "C:\Program Files\nodejs\node.exe" server.js
```

Then open:

```text
http://localhost:3000
```

Do not open `index.html` directly from File Explorer. The pages now require the
backend server.

Run the automated integration test with:

```powershell
npm.cmd test
```

## Demonstration accounts

| Role | Email | Password |
|---|---|---|
| Administrator | admin@manicsgroup.co.za | admin123 |
| Manager | sarah@manicsgroup.co.za | manager123 |
| Employee | john@manicsgroup.co.za | employee123 |

Change demonstration passwords before any real deployment.

## Role permissions

| Capability | Administrator | Manager | Employee | Business Partner |
|---|---:|---:|---:|---:|
| View dashboard and records | Yes | Yes | Yes | Yes |
| Manage partners, deals, contracts | Yes | Yes | No | No |
| Record communications | Yes | Yes | Yes | No |
| Generate report history | Yes | Yes | No | No |
| View users | Yes | Yes | No | No |
| Manage users and reset database | Yes | No | No | No |

These rules are enforced by the server, not only by hidden buttons.

## Database and security

- SQLite foreign keys prevent deletion of partners or deals that still have
  linked records.
- Passwords use salted `scrypt` hashes. Plaintext passwords are never returned
  by the API.
- Login state uses random, hashed server-side sessions and an HttpOnly,
  SameSite cookie.
- Mutating requests have same-origin checks and server-side role validation.
- Input length, email, date sequence, enum, uniqueness, and amount validation
  are enforced server-side.
- Contract files are limited to PDF, DOC, or DOCX and 5 MB.
- Security response headers include CSP, frame protection, and MIME sniffing
  protection.

## Data reset and backup

An administrator can use **Profile & Settings → Reset All Data** to restore the
current demonstration dataset. This also removes uploaded contract files and
invalidates sessions.

Use **Export All Data (JSON)** before resetting if a demonstration record needs
to be retained.

For a filesystem-level backup, stop the server and copy the `data` directory.
The directory is intentionally excluded from source control because it contains
runtime and potentially confidential information.

## Suggested defense demonstration

1. Log in as Administrator and explain the secure server session.
2. Open the dashboard and identify current partners, deals, contracts, and
   upcoming meetings.
3. Add a partner.
4. Create a deal linked to that partner.
5. Create a contract linked to the deal and attach a small PDF.
6. Download the stored contract from the contracts table.
7. Record a meeting with the partner.
8. Show that dashboard and report figures reflect the database changes.
9. Export the report CSV and system JSON.
10. Log in as Employee and show that partner/deal/contract mutation controls are
    unavailable and server permissions reject unauthorized writes.

## Verification performed

- JavaScript syntax checks for the server, shared scripts, and every inline page
  script
- Static local-link and DOM-ID checks
- Live HTTP serving and session checks
- Administrator login and database bootstrap
- Database creation of a partner
- Foreign-key rejection when deleting a linked partner
- `403 Forbidden` response for an employee attempting a partner write
- Administrator database reset and reseeding

## Production limitations

This implementation is suitable for a local school defense and small internal
demonstration. Before internet deployment, add HTTPS through a reverse proxy,
an environment-specific secret/configuration strategy, automated backups,
email-based password recovery, structured audit logs, and a production
deployment/monitoring process. For larger concurrent deployments, migrate the
SQLite schema to PostgreSQL.
