# Campus Event Navigation

A React + Vite app for discovering campus events, saving RSVPs, creating events, and managing a lightweight campus profile.

## Stack

- React 19
- Vite
- React Router 7
- Supabase Auth
- Context API for local event state

## Project Structure

```text
campus-event-navigation/
├── docs/
├── public/
├── src/
│   ├── components/
│   ├── context/
│   ├── pages/
│   ├── App.jsx
│   ├── CreateEvent.jsx
│   ├── main.jsx
│   └── supabaseClient.js
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

## Environment Variables

Create a root `.env` file with:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not commit `.env`.

## Local Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Production Build

```bash
npm run build
```

## Auth Flow

- Signup uses Supabase Auth from the frontend
- Login uses Supabase Auth from the frontend
- Logout clears the Supabase session and local `user` cache
- Route protection is based on the active Supabase session

## Notes

- Supabase Auth users appear in the Supabase dashboard under Authentication > Users
- Event data in `EventContext` is still local UI state and is intentionally preserved
