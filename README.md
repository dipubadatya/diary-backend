# Diary Backend

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

---
