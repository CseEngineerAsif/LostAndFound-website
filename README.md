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

### Configure Environment

Set these environment variables before running locally. You can use a `.env` file:

- `MONGODB_URI` (MongoDB Atlas connection string)
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SESSION_SECRET` (any long random string)

Optional:
- `CLOUDINARY_FOLDER` (defaults to `lost2found`)

Create a `.env` file at the project root using `.env.example` as a template.

### Check database connection

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
- `models/` - MongoDB (Mongoose) data access layer
- `views/` - EJS templates for UI
- `public/` - CSS and static assets

## Notes

- This project now uses MongoDB Atlas for data and Cloudinary for uploads.
- For production, add security measures (CSRF, input validation, rate limiting).
