<!-- # Diary Backend

Backend API for **Diary**, a modern social writing platform built with **Node.js**, **Express.js**, **TypeScript**, and **MongoDB**. It powers authentication, story publishing, comments, messaging, and other core platform features.

---

## Features

- Secure JWT authentication
- User registration and login
- User profile management
- Story creation, editing, and deletion
- Comments on stories
- Real-time messaging with Socket.IO
- Image upload support with Cloudinary
- RESTful API architecture
- Centralized error handling
- Modular and scalable project structure

---

## Tech Stack

- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- Socket.IO
- JWT
- Bcrypt
- Cloudinary

---

## Project Structure

```text
src/
├── config/
├── controllers/
├── middlewares/
├── models/
├── routes/
├── services/
├── app.ts
└── socket.ts

dist/
```

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/your-username/diary-backend.git
cd diary-backend
```

### Install dependencies

```bash
npm install
```

### Create a `.env` file

```env
PORT=3000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## Available Scripts

```bash
# Start development server
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start
```

---

## API Modules

- Authentication
- Users
- Stories
- Comments
- Messages
- File Uploads

---

## Project Status

The backend is under active development with additional features and improvements planned.

--- -->
# Diary — Backend

*The API that powers everything.*

---

This is the backend for [Diary](https://github.com/dipubadatya/diary-frontend), a social writing platform. It handles authentication, stories, comments, messaging, and file uploads — everything the frontend depends on to work.

Built with Node.js, Express, TypeScript, and MongoDB.

---

## What it handles

- User registration, login, and JWT authentication
- Profile creation and management
- Writing, editing, and deleting stories
- Comments on stories
- Real-time messaging via Socket.IO
- Image uploads through Cloudinary
- Clean error handling across all endpoints

---

## Built with

| Layer | Tools |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Language | TypeScript |
| Database | MongoDB, Mongoose |
| Real-Time | Socket.IO |
| Auth | JWT, Bcrypt |
| File Storage | Cloudinary |

---

## Frontend

The frontend that consumes this API lives here.

**[diary-frontend →](https://github.com/dipubadatya/diary-frontend)**

React · TypeScript · Tailwind CSS · Vite · Socket.IO Client

---

## Running it locally

**1. Clone and install**

```bash
git clone https://github.com/dipubadatya/diary-backend.git
cd diary-backend
npm install
```

**2. Set your environment**

Create a `.env` file at the project root.

```env
PORT=3000

# Database
MONGODB_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id

# Email
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_password

# GIF Support
GIPHY_API_KEY=your_giphy_api_key

# File Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Fill in your own values. The app will not start without a valid MongoDB URI.

**3. Start the dev server**

```bash
npm run dev
```

Server runs at [http://localhost:3000](http://localhost:3000) by default.

---

## Scripts

```bash
npm run dev      # development server with live reload
npm run build    # compile TypeScript to dist/
npm start        # run the compiled production build
```

---

## Codebase at a glance

```
src/
├── config/          database and third-party setup
├── controllers/     request handlers per feature
├── middlewares/     auth guards, error handling, uploads
├── models/          Mongoose schemas
├── routes/          API route definitions
├── services/        business logic, reusable operations
├── app.ts           Express app setup
└── socket.ts        Socket.IO configuration

dist/                compiled output, not committed
```

Each feature has its own controller, model, and route file. Adding something new means following the same pattern — nothing needs to change elsewhere.

---

## API surface

| Module | Covers |
|---|---|
| Auth | Register, login, token handling |
| Users | Profile read and update |
| Stories | Create, edit, delete, fetch |
| Comments | Add and retrieve comments |
| Messages | Send and receive, real-time |
| Uploads | Image upload via Cloudinary |

---

## Status

Active. New features and fixes go in regularly.

---

*Backend for Diary — the frontend is [here](https://github.com/dipubadatya/diary-frontend).*