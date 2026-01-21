# Torneo de Truco Volley 2026

Landing + inscripcion en 3 pasos con panel admin.

## Frontend (Vercel)

```bash
npm install
npm run dev
```

Variables:

- `VITE_API_URL` (ej: `http://localhost:8080`)

## Backend (Render)

```bash
cd backend
npm install
npm run dev
```

Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST` (default: `smtp.gmail.com`)
- `SMTP_PORT` (default: `465`)
- `SMTP_USER`
- `SMTP_PASS` (App Password de Gmail)
- `EMAIL_FROM`
- `ADMIN_USER`
- `ADMIN_PASS`
- `ADMIN_JWT_SECRET`
- `CORS_ORIGIN` (separado por comas si hay varios)

## Supabase

1. Crear tabla con `backend/supabase.sql`.
2. Mantener la Service Role Key solo en el backend.

## Admin

Ir a `/admin`, loguearse y cargar la lista de inscriptos. Se muestran links a los comprobantes y un boton para enviar el email de confirmacion final.
