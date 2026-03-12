# API Endpoints (Draft)

## Authentication

- POST /auth/signup
- POST /auth/login

## Events

- GET /events
- GET /events/:id
- POST /events
- PUT /events/:id
- DELETE /events/:id

## RSVP

- POST /events/:id/rsvp
- DELETE /events/:id/rsvp

## Categories

- GET /categories

## Buildings

- GET /buildings
- GET /buildings/:id

## Event Preferences

- POST /events/:id/preference
- DELETE /events/:id/preference

## Recommendations

- GET /users/:id/recommendations
