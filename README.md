# Compameet Backend

Node.js + Express + PostgreSQL + Sequelize API for the Compameet companionship app (simplified redesign).

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup

1. Copy environment file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your PostgreSQL credentials and a strong `JWT_SECRET`.

3. Create the database (example):

   ```sql
   CREATE DATABASE compameet;
   ```

4. Install dependencies:

   ```bash
   npm install
   ```

5. Run migrations and seeders:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

6. Start the server:

   ```bash
   npm run dev
   ```

   API base URL: `http://localhost:2003/api/v1`

## Folder structure

```
src/
  controllers/v1/{admin,user,common}/
  services/v1/{admin,user,common}/
  routes/v1/{admin,user,common}/
```

## OTP (development)

When `OTP_MASTER_ENABLED=true`, any OTP request accepts verification with `DEV_OTP` (default `1234`) without needing a prior request.

## Seeded data

- **Cities:** Indore, Bhopal, Ujjain
- **Admin:** `admin@compameet.com` / `Admin@123`

## API overview

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/auth/request-otp` | Public |
| POST | `/api/v1/auth/verify-otp` | Public |
| POST | `/api/v1/auth/register` | `mobileVerifiedToken` in body |
| GET | `/api/v1/auth/me` | User JWT |
| GET | `/api/v1/cities` | Public (active cities) |
| POST | `/api/v1/admin/login` | Public |
| GET | `/api/v1/admin/me` | Admin JWT |
| GET | `/api/v1/admin/users` | Admin JWT |
| GET | `/api/v1/admin/cities` | Admin JWT |
| POST | `/api/v1/admin/cities` | Admin JWT |
| PATCH | `/api/v1/admin/cities/:id` | Admin JWT |

## Age rules (registration)

- **male:** 21+
- **female:** 18+
- **other:** 18+

## Response format

Success: `{ "success": true, "data": ... }`

Error: `{ "success": false, "message": "..." }`
