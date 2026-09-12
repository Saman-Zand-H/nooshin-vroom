# Retired Supabase artifacts

The application no longer uses Supabase at runtime. The files in this folder
are retained only as a migration reference for rooms that still need a one-time
data export before moving to Django. Do not deploy these functions, apply these
migrations to a new environment, or add new frontend imports from this folder.

The active backend is `backend/`, and its HTTP contract is exposed through
Django Ninja at `/api/`.
