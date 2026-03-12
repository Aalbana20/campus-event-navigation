# Database Schema (PostgreSQL) - Draft

## users

- id (PK)
- name
- email (UNIQUE)
- password_hash
- role (student|organizer|admin)
- created_at

## buildings

- id (PK)
- name
- latitude
- longitude

## categories

- id (PK)
- name

## events

- id (PK)
- title
- description
- category_id (FK -> categories.id)
- tags (optional)
- building_id (FK -> buildings.id)
- room (optional)
- start_time
- end_time
- capacity
- organizer_id (FK -> users.id)
- flyer_url (optional)
- created_at

## rsvps

- id (PK)
- user_id (FK -> users.id)
- event_id (FK -> events.id)
- created_at
- CONSTRAINT unique(user_id, event_id)

## event_preferences

- id (PK)
- user_id (FK -> users.id)
- event_id (FK -> events.id)
- preference_type (interested|not_interested|saved|maybe)
- created_at
- CONSTRAINT unique(user_id, event_id)

## Business Rules

- Capacity enforcement: count(rsvps for event) <= events.capacity
- Organizer can only edit/delete their own events unless admin
- Each event must belong to a valid category
- Each event must reference a valid building
- Swipe or preference actions do not count as RSVP
