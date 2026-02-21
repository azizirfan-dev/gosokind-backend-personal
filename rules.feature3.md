# MASTER RULES: Feature 3 (Driver & Worker) - V2.0

## 1. ARCHITECTURE & FOLDER INTEGRITY [CRITICAL]

- **Work Directory:** ONLY work in `src/`. NEVER touch, read, or write to `dist/`.
- **Dist Folder:** Treat `dist/` as toxic waste. It is for build artifacts only.
- **Layered Architecture:** - `Route` (Define endpoints & Middleware) ->
  - `Controller` (Parse Request, Validate Zod, Send Response) ->
  - `Service` (Business Logic & DB Calls).

## 2. STRICT CODING STANDARDS (Non-Negotiable)

- [cite_start]**Max Lines Per File:** 200 lines[cite: 286].
- [cite_start]**Max Lines Per Function:** 15 lines[cite: 289].
  - _Strategy:_ Use "Atomic Private Helpers". Break big logic into small, named functions (e.g., `validateUser()`, `checkInventory()`, `updateStatus()`).
- **Variable Naming:** Descriptive and clear (e.g., `isShiftActive` instead of `flag`).
- **No HTML Responses:** Always return JSON envelopes.

## 3. SECURITY PROTOCOLS [PATCHED]

- **Authentication Source:**
  - **FORBIDDEN:** Getting `userId` or `employeeId` from `req.body`.
  - **MANDATORY:** Get IDs from `req.user` (or `res.locals.user`) injected by Auth Middleware.
- **Route Protection:** All endpoints must use `verifyToken` middleware.
- **Input Validation:** Every `req.body` must be parsed with **Zod** schema.

## 4. DATABASE STRATEGY (Schema Freeze Mode)

- **Constraint:** Do NOT modify `schema.prisma` unless explicitly authorized.
- **Relational Integrity:** - Since we cannot add `outletId` to `Attendance`, always use `include: { outlet: true }` via `Employee` relation when validating location.
- **Race Condition Handling (Driver):**
  - Do NOT use optimistic locking (versioning) columns.
  - **USE:** Atomic Updates with WHERE clauses.
  - _Example:_ `UPDATE orders SET driverId = X WHERE id = Y AND driverId IS NULL`.

## 5. BUSINESS LOGIC CONSTRAINTS

### A. Attendance

- Logic must handle Timezone issues (User UTC+7 vs Server UTC).
- Check 3 conditions before Clock In:
  1. Geofence (100m).
  2. No Active Shift (Forgot to clock out).
  3. One Shift Per Day (Prevent double attendance).

### B. Worker Station (Washing/Ironing/Packing)

- **Input Validation:** Worker inputs MUST match Admin's `OrderItem` quantity.
- **Mismatch Flow:** If quantity mismatch -> Throw 400 Error -> Worker must request Bypass.

## 6. WORKSPACE ISOLATION

- **Firewall:** Backend (`gosokind-backend`) must NEVER import from Frontend (`gosokind-frontend`).
- **Dependencies:** Install packages strictly in the backend folder.
