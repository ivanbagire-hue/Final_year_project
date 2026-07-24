# Defense notes

## Problem addressed

Partnership data distributed across spreadsheets and messages is difficult to
track, secure, and report on. This system centralizes partners, deals,
contracts, communications, users, and reports in one relational database.

## Main design decisions

- **Relational model:** partners link to deals and communications; deals link to
  contracts. Foreign keys protect these relationships.
- **Role-based access:** permissions are checked on the server so changing HTML
  in the browser cannot grant database access.
- **Secure authentication:** the database stores password hashes rather than
  plaintext passwords, and browsers receive only an opaque HttpOnly session
  cookie.
- **Local deployment:** Node.js and SQLite keep the defense setup simple and
  reproducible without a separate database server.
- **Document storage:** contract metadata is stored in SQLite while file content
  is stored under a protected runtime upload directory and downloaded through
  an authenticated API.

## Core database relationships

```text
users 1 ─── * sessions

partners 1 ─── * deals 1 ─── * contracts
    |
    └───────── * communications

activities and reports record cross-system events
```

## Questions to be ready for

**Why SQLite?**  
It provides transactions, constraints, indexes, and a real relational database
without requiring a separate database service. PostgreSQL is the planned
scaling path.

**Why is authorization required on the server?**  
Browser controls can be modified by a user. Only server checks can protect the
database reliably.

**Why are files not stored directly inside SQLite?**  
Keeping file content on disk avoids inflating the transactional database while
SQLite retains searchable contract metadata.

**What happens when a linked partner is deleted?**  
The foreign-key constraint rejects the deletion until linked deals and
communications are handled. This prevents orphaned business records.

**How are passwords protected?**  
Each password has a random salt and is processed with Node.js `scrypt`. Login
comparison uses a timing-safe operation.

**What would change for production?**  
Use HTTPS, PostgreSQL for larger concurrency, scheduled encrypted backups,
central file/object storage, email recovery, monitoring, and automated
integration tests.

