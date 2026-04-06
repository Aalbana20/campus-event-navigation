# Campus Event & Navigation

A web app for UMES students to discover campus events, RSVP, create events, and find buildings on campus.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router 7, Vite |
| Backend | Flask (Python) |
| Database | SQLite (local dev) |
| Auth | JWT (Flask-JWT-Extended) |

---

## Project Structure

```
campus-event-navigation/
├── backend/
│   ├── application.py   # Flask server
│   ├── requirements.txt # Python dependencies
│   └── users.db         # SQLite database (auto-created on first run)
├── src/                 # React frontend
│   ├── pages/
│   ├── components/
│   ├── context/
│   └── ...
├── docs/                # Architecture docs and schema
├── public/
├── index.html
└── package.json
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/Aalbana20/campus-event-navigation.git
cd campus-event-navigation
```

### 2. Run the backend

Make sure Python 3 is installed.

```bash
cd backend
pip install -r requirements.txt
python application.py
```

The Flask server runs at `http://localhost:5000`.

### 3. Run the frontend

Open a second terminal from the project root.

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

---

## Environment Variables

The backend reads these from your environment. For local dev the defaults work fine — **change `JWT_SECRET_KEY` before any deployment**.

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET_KEY` | `dev-secret-change-before-deploy` | Secret used to sign JWT tokens |
| `FLASK_DEBUG` | `false` | Set to `true` to enable Flask debug mode locally |

To set them locally (Mac/Linux):
```bash
export JWT_SECRET_KEY=your-secret-here
export FLASK_DEBUG=true
python application.py
```

On Windows (Command Prompt):
```cmd
set JWT_SECRET_KEY=your-secret-here
set FLASK_DEBUG=true
python application.py
```

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/signup` | Create a new account |
| POST | `/login` | Log in, returns JWT token |
| POST | `/make_admin` | Promote a user to admin (requires admin JWT) |

### Signup
```json
POST /signup
{ "email": "student@umes.edu", "username": "ali", "password": "Secret123!" }
```

### Login
```json
POST /login
{ "email": "student@umes.edu", "password": "Secret123!" }
```
Returns:
```json
{ "message": "Login successful", "token": "<jwt>", "username": "ali", "role": "user" }
```

---

## Features

- **Discover** — swipe through campus events (keyboard arrows supported)
- **My Events** — view saved/RSVP'd events in card or calendar view
- **Create Event** — organizers can create events with flyer upload
- **Profile** — view and edit your profile
- **Auth** — sign up and log in with hashed passwords and JWT tokens
- **View Map** — event cards link directly to Google Maps

---

## Notes for the Team

- `users.db` is auto-created in `backend/` the first time you run the server — do not commit it
- All passwords are hashed with `werkzeug.security` — never stored in plaintext
- The JWT token returned on login should be stored in `localStorage` and sent as `Authorization: Bearer <token>` on future authenticated requests
- The `make_admin` route requires a valid admin JWT — it cannot be called anonymously
