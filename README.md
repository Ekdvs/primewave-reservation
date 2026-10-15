# ResourceHub: Resource Reservation Management System

A full-stack web application that lets an organization manage its shared resources (meeting rooms, labs, vehicles, projectors) and coordinate reservations without scheduling conflicts.

Built for the **PrimeWave Lab (Pvt) Ltd Software Engineering Internship Technical Assessment**.

| | |
|---|---|
| **Repository** | https://github.com/Ekdvs/primewave-reservation |
| **ER Diagram** | https://dbdiagram.io/d/ResourceHub-ER-6a4b23ee36d348d120723c9f |
| **Demo Video** | https://youtu.be/lA8PNCP29cU |

---

## Table of Contents

1. [Business Problem and Approach](#1-business-problem-and-approach)
2. [Features](#2-features)
3. [Tech Stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Database Design](#5-database-design)
6. [Getting Started](#6-getting-started)
7. [Demo Accounts](#7-demo-accounts)
8. [API Reference](#8-api-reference)
9. [Business Rules](#9-business-rules)
10. [Key Engineering Decisions](#10-key-engineering-decisions)
11. [Manual Test Guide](#11-manual-test-guide)
12. [Project Structure](#12-project-structure)
13. [Troubleshooting](#13-troubleshooting)
14. [Future Improvements](#14-future-improvements)

---

## 1. Business Problem and Approach

The organization shares several facilities. Reservations are handled through informal communication and manual records, which causes:

- overlapping reservations,
- scheduling confusion,
- no clear view of what is available.

**How this solution addresses it**

| Problem | Solution |
|---|---|
| Overlapping reservations | Double-booking is blocked **inside PostgreSQL** with an `EXCLUDE` constraint, so it stays correct even with simultaneous requests |
| Uncertainty about availability | Per-day availability view with free slots and existing bookings for every resource |
| Informal coordination | Central catalogue of resources, booking rules, and an approval workflow |
| Lack of visibility | Notifications, reservation history, an admin dashboard, and an audit trail |
| Reliability as usage grows | Server-side validation (Zod), database constraints, indexes, pagination, and transactional writes |

---

## 2. Features

### For all users
- Register and log in (JWT in an HttpOnly cookie)
- Browse resources with search and filters (category, status) and pagination
- Check **availability for any date** with free slots and booked slots
- Reserve a resource, with click-to-fill from free slots
- View own reservations and filter by status
- Cancel upcoming reservations
- In-app **notifications** (created, confirmed, rejected, cancelled, reminders, resource status changes) with an unread counter

### For administrators
- Create, edit, and delete resources and categories
- Set booking rules per resource: operating hours, maximum duration, capacity, approval required
- Change resource status (Active, Maintenance, Inactive). Affected users are notified
- **Approve or reject** pending reservations (a reason is required on rejection)
- View all reservations across the organization
- Dashboard: totals, today's reservations, pending approvals, most used resources (last 30 days)
- Audit log of every change (stored in the `AuditLog` table)

### Background maintenance
- Reservations that finish are marked `COMPLETED`
- Reminder notifications for reservations starting within 30 minutes (sent once, claimed atomically)

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js** (App Router), React |
| Language | **TypeScript** |
| Database | **PostgreSQL** |
| ORM | **Prisma** |
| Validation | **Zod** |
| Auth | `jose` (JWT, HS256) and `bcryptjs` |
| Styling | **Tailwind CSS** |
| Version control | Git and GitHub |

---

## 4. Architecture

```
Browser (React client components, Tailwind)
        │  fetch('/api/...')  (same origin, HttpOnly cookie)
        ▼
Next.js Route Handlers  (src/app/api/**/route.ts)
        │  route() wrapper -> consistent errors, Zod parsing
        ▼
Service layer (business rules, transactions)
        │
        ▼
Prisma Client  ->  PostgreSQL  (constraints, indexes)
```

**Layering**

- **Route handlers** are thin. They authenticate, validate input with Zod, and call a service.
- **Services** hold the business rules (booking rules, state transitions, notifications, audit logging).
- **Database** is the last line of defence (unique, check, and exclusion constraints).

**Consistent API contract**

```jsonc
// success
{ "data": { ... } }

// failure
{ "error": { "code": "BOOKING_CONFLICT", "message": "...", "details": [ ... ] } }
```

Validation errors return `400 VALIDATION_ERROR` with a per-field `details` array, which the UI maps onto form fields.

---

## 5. Database Design

**Interactive ER diagram:** https://dbdiagram.io/d/ResourceHub-ER-6a4b23ee36d348d120723c9f

### Entities

| Table | Purpose |
|---|---|
| `User` | Accounts with a role (`ADMIN` or `MEMBER`) |
| `ResourceCategory` | Meeting Room, Lab, Vehicle, Projector, and so on |
| `Resource` | A bookable asset plus its booking rules (hours, max duration, capacity, approval) |
| `Reservation` | A booking of one resource by one user for a time range, with status |
| `Notification` | In-app messages for users, linked optionally to a reservation |
| `AuditLog` | Who did what to which entity, with metadata |

### Relationships

- `ResourceCategory` 1 to N `Resource`
- `Resource` 1 to N `Reservation` (`onDelete: Restrict`, so history is never lost)
- `User` 1 to N `Reservation` as **owner**
- `User` 1 to N `Reservation` as **decider** (the admin who approved or rejected)
- `User` 1 to N `Notification` (cascade delete)
- `Reservation` 1 to N `Notification` (set null on delete)
- `User` 1 to N `AuditLog` (set null on delete)

### Reservation lifecycle

```
            ┌──────────── (requires approval) ───────────┐
            ▼                                             │
        PENDING ──approve──► CONFIRMED ──time passes──► COMPLETED
            │                    │
         reject                cancel
            ▼                    ▼
        REJECTED             CANCELLED
```

Resources that do not require approval (and bookings made by admins) go straight to `CONFIRMED`.

### The overlap guarantee

Application-level "check then insert" logic is not safe under concurrency: two requests can both pass the check. This project enforces the rule in the database with a migration:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_time_valid CHECK ("endTime" > "startTime");

ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startTime", "endTime", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));
```

- `[)` ranges make back-to-back bookings valid (10:00–11:00 followed by 11:00–12:00).
- Only `PENDING` and `CONFIRMED` rows hold a slot. Cancelled and rejected bookings release it.
- The API translates the database error into a friendly `409 BOOKING_CONFLICT` that lists the conflicting ranges.

This SQL lives in a committed Prisma migration, so `prisma migrate` applies it automatically.

---

## 6. Getting Started

### Prerequisites

- Node.js 20 or later
- PostgreSQL 14 or later (with the `btree_gist` extension, which ships with the standard PostgreSQL contrib modules)
- npm

### 1. Clone and install

```bash
git clone https://github.com/Ekdvs/primewave-reservation.git
cd primewave-reservation
npm install
```

### 2. Create the database

```bash
psql -U postgres -c "CREATE DATABASE reservation_db;"
```

### 3. Configure environment variables

Create a `.env` file in the project root (see `.env.example`):

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/reservation_db?schema=public"
JWT_SECRET="replace-with-a-long-random-string"
CRON_SECRET="replace-with-another-long-random-string"
ORG_UTC_OFFSET_MINUTES=330
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign login tokens. Generate one with `openssl rand -base64 32` |
| `CRON_SECRET` | Bearer secret protecting the maintenance endpoint |
| `ORG_UTC_OFFSET_MINUTES` | Organization time zone offset in minutes (`330` = Sri Lanka, UTC+05:30). Used to evaluate operating hours |

### 4. Apply migrations (includes the overlap constraint)

```bash
npx prisma migrate dev
npx prisma generate
```

Verify the constraints exist:

```sql
SELECT conname FROM pg_constraint
WHERE conname IN ('reservation_no_overlap', 'reservation_time_valid');
-- expect 2 rows
```

### 5. Seed demo data

```bash
npx prisma db seed
```

Creates an admin, a member, four categories, and four sample resources.

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000.

### Production build

```bash
npm run build
npm start
```

### Useful commands

| Command | Purpose |
|---|---|
| `npx prisma studio` | Browse the database in a GUI |
| `npx prisma migrate dev` | Create and apply migrations in development |
| `npx prisma migrate deploy` | Apply migrations in production |
| `npx prisma db seed` | Re-run the seed script (idempotent) |
| `npx tsc --noEmit` | Type-check the project |

### Running the maintenance job locally

Marks finished reservations `COMPLETED` and sends reminders:

```bash
curl http://localhost:3000/api/cron/maintenance -H "Authorization: Bearer <CRON_SECRET>"
```

In production this can be scheduled (for example with Vercel Cron, using the same endpoint and secret).

---

## 7. Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@primewave.lk` | `Password@123` |
| Member | `member@primewave.lk` | `Password@123` |

New registrations always receive the `MEMBER` role. The role is never accepted from the client.

---

## 8. API Reference

All endpoints are under `/api`. Authentication uses an HttpOnly `token` cookie (an `Authorization: Bearer <token>` header also works for tools like curl).

### Auth

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create a member account |
| POST | `/auth/login` | Public | Log in and set the cookie |
| POST | `/auth/logout` | Any | Clear the cookie |
| GET | `/auth/me` | User | Current user |

### Categories and Resources

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/categories` | User | List categories |
| POST | `/categories` | Admin | Create a category |
| GET | `/resources` | User | List with `q`, `categoryId`, `status`, `page`, `limit` |
| POST | `/resources` | Admin | Create a resource |
| GET | `/resources/:id` | User | Resource details |
| PATCH | `/resources/:id` | Admin | Update a resource |
| DELETE | `/resources/:id` | Admin | Delete (blocked if it has reservations) |
| GET | `/resources/:id/availability?date=YYYY-MM-DD` | User | Bookings and free slots for a day |

### Reservations

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/reservations` | User | List. `scope=mine` or `all` (admin), plus `status`, `resourceId`, `from`, `to`, `page`, `limit` |
| POST | `/reservations` | User | Create a reservation |
| GET | `/reservations/:id` | Owner or Admin | Details |
| POST | `/reservations/:id/cancel` | Owner or Admin | Cancel |
| POST | `/reservations/:id/decision` | Admin | `{ "action": "approve" }` or `{ "action": "reject", "reason": "..." }` |

### Notifications, Dashboard, Maintenance

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/notifications` | User | List (`unread=true` filter) with `unreadCount` |
| POST | `/notifications/:id/read` | User | Mark one as read |
| POST | `/notifications/read-all` | User | Mark all as read |
| GET | `/dashboard` | Admin | Aggregated statistics |
| GET | `/cron/maintenance` | Bearer `CRON_SECRET` | Complete finished reservations and send reminders |

### Example: create a reservation

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "<resource-id>",
    "title": "Sprint planning",
    "startTime": "2026-10-20T10:00:00+05:30",
    "endTime":   "2026-10-20T11:00:00+05:30",
    "attendees": 6
  }'
```

### Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod validation failed (`details` lists fields) |
| 401 | `UNAUTHORIZED` | Not logged in or invalid token |
| 403 | `FORBIDDEN` | Not allowed for this role or owner |
| 404 | `NOT_FOUND` | Record not found |
| 409 | `BOOKING_CONFLICT` | Overlaps an existing reservation |
| 409 | `RESOURCE_UNAVAILABLE` | Resource is in maintenance or inactive |
| 409 | `INVALID_STATE` | Action not valid for the current status |
| 422 | `OUTSIDE_OPERATING_HOURS`, `MAX_DURATION_EXCEEDED`, `CAPACITY_EXCEEDED`, `PAST_TIME`, `MULTI_DAY_NOT_ALLOWED` | Booking rule violated |

---

## 9. Business Rules

A reservation is accepted only when all of the following hold:

1. The resource exists and is **ACTIVE**.
2. The start time is not in the past.
3. Duration does not exceed the resource's **maximum duration**.
4. Attendees do not exceed the resource's **capacity** (when both are set).
5. The booking starts and ends on the **same day** within the resource's **operating hours** (evaluated in organization time).
6. The time range does **not overlap** any `PENDING` or `CONFIRMED` reservation for that resource (enforced by the database).

**Permissions**

- Members can view resources, create reservations, and see and cancel their own reservations (only before they start).
- Admins can additionally manage resources and categories, see all reservations, approve or reject, cancel any active reservation, and view the dashboard.

**Approval flow**

- If `requiresApproval` is true, a member's booking starts as `PENDING` and still **holds the slot**. Admins are notified.
- Rejecting requires a reason, which is shown to the requester. The slot is released.

---

## 10. Key Engineering Decisions

| Decision | Reasoning |
|---|---|
| **Database-enforced overlap prevention** | Prevents race conditions. A check-then-insert in code can be defeated by concurrent requests |
| **`tstzrange` with `[)`** | Allows back-to-back bookings and avoids off-by-one conflicts |
| **`Timestamptz` for all times** | Unambiguous instants. Local display and rule evaluation use the organization offset |
| **Zod at the API boundary** | Single source of truth for input validation, with field-level error messages |
| **Services plus thin route handlers** | Business rules stay testable and separate from HTTP concerns |
| **Transactions** | Reservation, notifications, and audit entries are written atomically |
| **Guarded state transitions** | `updateMany` with a status condition prevents double approval and duplicate reminders |
| **`onDelete: Restrict` on reservations** | Resources with history cannot be deleted. They are set to `INACTIVE` instead |
| **Roles are server-controlled** | Registration always creates `MEMBER`. Admins are seeded |
| **HttpOnly cookie auth** | The token is not exposed to client-side JavaScript |
| **Indexes** | Composite indexes on `(resourceId, startTime, endTime)`, `(userId, startTime)`, and `(status, startTime)` support availability, list, and dashboard queries |
| **Pagination everywhere** | Keeps list endpoints fast as data grows |
| **Audit log** | Traceability of reservation and resource changes |

---

## 11. Manual Test Guide

Use one normal window for the admin and a private window for a member.

| # | Scenario | Expected result |
|---|---|---|
| 1 | Register with a short password | Field validation error |
| 2 | Admin creates a resource with close time earlier than open time | Validation error on closing time |
| 3 | Member books a free slot | Confirmed, shown as "(yours)" in availability |
| 4 | Book a range overlapping an existing booking | `409` overlap error |
| 5 | Book back-to-back after an existing booking | **Succeeds** |
| 6 | Book outside operating hours | Operating hours error |
| 7 | Book longer than the max duration | Max duration error |
| 8 | Book above capacity | Capacity error |
| 9 | Book a resource in Maintenance | Blocked, form disabled |
| 10 | Book an approval-required resource | Status `PENDING`, slot is held |
| 11 | Admin rejects with a reason | Member is notified with the reason, slot is released |
| 12 | Admin approves | Status `CONFIRMED`, member is notified |
| 13 | Member cancels a future booking | Status `CANCELLED`, slot is free again |
| 14 | Member opens an admin-only page or endpoint | Redirected, or API returns `403` |
| 15 | Admin deletes a resource that has reservations | Blocked with a hint to set `INACTIVE` |
| 16 | **Race test:** submit the same slot from two tabs at once | Exactly one succeeds, the other gets `409` |
| 17 | Run the maintenance endpoint | Finished bookings become `COMPLETED`, reminders sent once |

---

## 12. Project Structure

```
prisma/
  schema.prisma
  seed.ts
  migrations/              # includes the overlap EXCLUDE constraint migration
src/
  app/
    api/                   # route handlers
      auth/                # register, login, logout, me
      categories/
      resources/           # CRUD, availability
      reservations/        # list/create, details, cancel, decision
      notifications/
      dashboard/
      cron/maintenance/
    (app)/                 # authenticated pages
      dashboard/
      resources/           # list and detail with booking
      reservations/
      notifications/
    login/  register/
    layout.tsx  page.tsx
  components/              # UI kit, Navbar, ResourceForm
  context/                 # AuthContext
  lib/                     # prisma client, auth, http helpers, errors, time utils, API client
  service/                 # resource, reservation, dashboard, maintenance logic
  validators/              # Zod schemas
```

---

## 13. Troubleshooting

| Problem | Fix |
|---|---|
| `relation "Reservation" does not exist` | Run `npx prisma migrate dev` |
| Overlapping bookings are not blocked | The overlap migration was not applied. Verify with the `pg_constraint` query in [Getting Started](#6-getting-started) |
| `extension "btree_gist" is not available` | Install the PostgreSQL contrib package, or run `CREATE EXTENSION btree_gist;` as a superuser |
| Adding the constraint fails | Existing rows overlap. Cancel one of each overlapping pair and re-run the migration |
| Every request returns 401 | `JWT_SECRET` is missing. Restart the dev server after editing `.env` |
| Login works, but the session is lost | Use `localhost` consistently, not a mix of `localhost` and `127.0.0.1` |
| "Cannot book a time in the past" | Pick a future time or another date |
| Seed command not found | Install the seed runner used by the project (`npm i -D tsx`) and check the seed configuration |

---

## 14. Future Improvements

- Email or push delivery for notifications
- Recurring reservations
- Calendar (week and month) view and iCal export
- Waitlist for fully booked resources
- Per-resource time zones
- Rate limiting and account lockout
- Automated tests (unit tests for the services, end-to-end tests for booking flows)
- Admin screen for the audit log

---

## Author

**Vishwa**, Computer Science graduate, University of Kelaniya
GitHub: [github.com/Ekdvs](https://github.com/Ekdvs)

Built with the assistance of AI development tools, as permitted by the assessment. All design decisions and the implementation are understood and can be explained.