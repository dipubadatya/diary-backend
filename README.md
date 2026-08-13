# Diary — Backend

*The API that powers everything.*

---

> **Diary** is a full-stack social writing platform built around a simple idea —
some thoughts are too personal to say out loud, but too heavy to keep to yourself.
Diary gives anyone a place to write freely, share their stories, and connect with
people who feel the same way. Whether it is a feeling you cannot explain, a story
you have been carrying, or just words you needed to put somewhere — this is that place.

This repository is the backend. It handles every piece of logic, data, and
real-time communication that the frontend depends on..

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Scripts](#scripts)
- [Frontend](#frontend)
- [Status](#status)

---

## Overview

This is the REST API and real-time server for [Diary](https://github.com/dipubadatya/diary-frontend). It is built with **Node.js**, **Express**, and **TypeScript**, backed by **MongoDB**, and uses **Socket.IO** for real-time messaging.

It covers everything from user registration and JWT authentication to story management, comments, image uploads, and live chat — all structured in a clean, scalable pattern that is easy to extend.

---

## Features

- **Authentication** — Register, login, logout, and JWT-based session handling
- **Google OAuth** — Sign in with Google using Google Identity
- **User Profiles** — Create and update profile information and avatars
- **Stories** — Write, edit, delete, and browse stories
- **Comments** — Add and retrieve comments on any story
- **Real-Time Messaging** — Live chat between users powered by Socket.IO
- **GIF Support** — Send GIFs in messages via Giphy integration
- **Image Uploads** — Profile pictures and story images stored on Cloudinary
- **Email Notifications** — Transactional emails via Nodemailer
- **Error Handling** — Consistent, clean error responses across all endpoints

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Real-Time | Socket.IO |
| Authentication | JWT + Bcrypt |
| OAuth | Google Identity (OAuth 2.0) |
| File Storage | Cloudinary |
| Email | Nodemailer |
| GIF Integration | Giphy API |

---

## Project Structure

```
diary-backend/
├── src/
│   ├── config/          # Database connection and third-party service setup
│   ├── controllers/     # Request handlers organized by feature
│   ├── middlewares/     # Auth guards, error handlers, file upload middleware
│   ├── models/          # Mongoose schemas and TypeScript interfaces
│   ├── routes/          # API route definitions per feature module
│   ├── services/        # Business logic and reusable operations
│   ├── app.ts           # Express application setup and middleware registration
│   └── socket.ts        # Socket.IO server configuration and event handlers
├── dist/                # Compiled JavaScript output (not committed)
├── .env                 # Environment variables (not committed)
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

Each feature module follows the same pattern — its own controller, model, and route file. Adding a new feature means following that pattern. Nothing else needs to change.

---

## Getting Started

### Prerequisites

Make sure you have the following installed before continuing:

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher
- A [MongoDB](https://www.mongodb.com/) database (local or Atlas)
- A [Cloudinary](https://cloudinary.com/) account
- A [Google Cloud](https://console.cloud.google.com/) project with OAuth 2.0 credentials
- A [Giphy](https://developers.giphy.com/) developer account

---

### 1. Clone the Repository

```bash
git clone https://github.com/dipubadatya/diary-backend.git
cd diary-backend
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Configure Environment Variables

Create a `.env` file at the root of the project:

```bash
touch .env
```

Then fill in the values as described in the [Environment Variables](#environment-variables) section below.

---

### 4. Start the Development Server

```bash
npm run dev
```

The server will start at **http://localhost:3000** by default.

---

## Environment Variables

Create a `.env` file at the project root and provide all of the following values. The application will not start without a valid MongoDB URI.

```env
# ─────────────────────────────────────────
# Server
# ─────────────────────────────────────────
PORT=3000

# ─────────────────────────────────────────
# Database
# ─────────────────────────────────────────
# Your MongoDB connection string
# Local example:  mongodb://localhost:27017/diary
# Atlas example:  mongodb+srv://<user>:<password>@cluster.mongodb.net/diary
MONGODB_URI=your_mongodb_connection_string

# ─────────────────────────────────────────
# Authentication
# ─────────────────────────────────────────
# A long, random secret string used to sign JWT tokens
# Generate one: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_jwt_secret

# ─────────────────────────────────────────
# Google OAuth 2.0
# ─────────────────────────────────────────
# 1. Go to https://console.cloud.google.com/
# 2. Create a project (or select an existing one)
# 3. Navigate to APIs & Services → Credentials
# 4. Click "Create Credentials" → OAuth 2.0 Client ID
# 5. Set application type to "Web application"
# 6. Add your authorized redirect URIs
#    e.g. http://localhost:3000/api/auth/google/callback
# 7. Copy the Client ID and Client Secret below
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ─────────────────────────────────────────
# Email (Nodemailer)
# ─────────────────────────────────────────
# Use a real email address and an app-specific password
# Gmail users: enable 2FA and generate an App Password at
# https://myaccount.google.com/apppasswords
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_app_password

# ─────────────────────────────────────────
# GIF Support (Giphy)
# ─────────────────────────────────────────
# 1. Go to https://developers.giphy.com/
# 2. Log in and create an app
# 3. Copy the API key from your app dashboard
GIPHY_API_KEY=your_giphy_api_key

# ─────────────────────────────────────────
# File Storage (Cloudinary)
# ─────────────────────────────────────────
# 1. Sign up at https://cloudinary.com/
# 2. Go to your Dashboard
# 3. Copy Cloud Name, API Key, and API Secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

> **Never commit your `.env` file.** It is already listed in `.gitignore`.

---

## API Reference

| Module | Method | Endpoint | Description |
|---|---|---|---|
| **Auth** | POST | `/api/auth/register` | Create a new account |
| | POST | `/api/auth/login` | Log in and receive a JWT |
| | POST | `/api/auth/google` | Sign in with Google |
| | POST | `/api/auth/logout` | Invalidate the session |
| **Users** | GET | `/api/users/:id` | Get a user profile |
| | PUT | `/api/users/:id` | Update profile information |
| **Stories** | GET | `/api/stories` | Fetch all stories |
| | GET | `/api/stories/:id` | Fetch a single story |
| | POST | `/api/stories` | Create a new story |
| | PUT | `/api/stories/:id` | Edit an existing story |
| | DELETE | `/api/stories/:id` | Delete a story |
| **Comments** | GET | `/api/stories/:id/comments` | Get comments on a story |
| | POST | `/api/stories/:id/comments` | Add a comment |
| **Messages** | GET | `/api/messages/:userId` | Get conversation history |
| | POST | `/api/messages` | Send a message |
| **Uploads** | POST | `/api/uploads/image` | Upload an image to Cloudinary |

> Protected endpoints require a valid JWT token in the `Authorization` header as `Bearer <token>`.

---

## Scripts

```bash
# Start the development server with live reload
npm run dev

# Compile TypeScript to JavaScript in the dist/ folder
npm run build

# Run the compiled production build
npm start
```

---

## Frontend

The frontend that consumes this API is a separate repository.

**[diary-frontend →](https://github.com/dipubadatya/diary-frontend)**

Built with React, TypeScript, Tailwind CSS, Vite, and Socket.IO Client.

---

## Status

**Active.** New features and fixes are added regularly. Contributions, issues, and feedback are welcome.

---

*Backend for Diary — the frontend lives [here](https://github.com/dipubadatya/diary-frontend).*