# Lost2Found

A starter web application to report and search for lost and found items on campus.

## Features

- User registration and login
- Report lost or found items (with optional photo upload)
- Search and filter items by name, category, location, and type
- Simple dashboard and status tracking

## Getting Started

### Prerequisites

- Node.js 18+ (tested on Node 24)

### Install Dependencies

```bash
npm install
```

### Initialize the database

```bash
npm run migrate
```

### Start the server

```bash
npm start
```

Then open: http://localhost:3000

## Project Structure

- `app.js` - main Express server
- `routes/` - Express routes for auth, items, and home page
- `models/` - simple lowdb-based data access layer
- `views/` - EJS templates for UI
- `public/` - CSS and uploaded photos
- `data/db.json` - JSON datastore (created at runtime)

## Notes

- This is a minimal prototype. It uses `lowdb` for storage and is not suitable for production data.
- For production, migrate to a proper database (MySQL/Postgres) and add security measures (CSRF, input validation, rate limiting).
