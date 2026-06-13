# Python Coding Test Platform

A full-stack coding practice and mock test platform for second-year Indian engineering students learning Python.

## Features

- JWT authentication with student/admin roles
- Coding editor with Python execution, output, errors, and test case results
- Syllabus-based Python questions across Basic, Intermediate, and Advanced topics
- Mock tests for 30, 60, 90 minutes and full semester practice
- Student analytics, progress tracking, streaks, weak/strong topics
- College/global/weekly/monthly leaderboards
- Admin panel for managing questions and reports
- Docker-based Python execution mode for production
- PDF/report/certificate-ready API structure

## Quick Start

```bash
npm install
npm --prefix client install
npm --prefix server install
docker compose up -d postgres
cp server/.env.example server/.env
npm run seed
npm run dev
```

Open:

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api/health

Demo accounts after seeding:

- Student: `student@example.com` / `Student@123`
- Admin: `admin@example.com` / `Admin@123`

If PostgreSQL is not running during local development, the API automatically falls back to an in-memory demo store so registration, login, questions, analytics, mock tests, and admin screens still work for classroom demos. Start PostgreSQL and run `npm run seed` when you want persistent data.

## Google Account Login

Students should sign in with Google. Create a Google OAuth 2.0 Web Client ID, then set the same client ID in:

- `server/.env` as `GOOGLE_CLIENT_ID`
- `client/.env` as `VITE_GOOGLE_CLIENT_ID`

The app keeps a password-based admin fallback for local setup only.

## Docker Deployment

```bash
docker compose up --build
```

For public sharing with students, deploy this repository to a VPS or cloud platform and point a domain/subdomain at the client. See [docs/INSTALLATION.md](docs/INSTALLATION.md) and [docs/API.md](docs/API.md).

## Google Cloud Permanent Link

The app is packaged for Google Cloud Run with a single HTTPS service that serves both the React frontend and `/api` backend. Use [docs/GOOGLE_CLOUD_DEPLOYMENT.md](docs/GOOGLE_CLOUD_DEPLOYMENT.md) to create the permanent Cloud Run link.
