import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

const {
  PORT = 8080,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SMTP_HOST = 'smtp.gmail.com',
  SMTP_PORT = 465,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  ADMIN_USER,
  ADMIN_PASS,
  ADMIN_JWT_SECRET,
  CORS_ORIGIN
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const mailer =
  SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      })
    : null;

app.use(
  cors({
    origin: CORS_ORIGIN ? CORS_ORIGIN.split(',') : '*',
    credentials: true
  })
);
app.use(express.json());

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No autorizado.' });
  }

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalido.' });
  }
};

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: 'Faltan credenciales.' });
  }

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ message: 'Credenciales invalidas.' });
  }

  const token = jwt.sign({ role: 'admin' }, ADMIN_JWT_SECRET, {
    expiresIn: '8h'
  });

  return res.json({ token });
});

app.get('/api/admin/inscriptions', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('inscriptions')
    .select('id, full_name, phone, email, created_at, confirmed_at, status, paid')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ message: 'Error cargando inscripciones.' });
  }

  return res.json(data || []);
});

app.post('/api/inscriptions', async (req, res) => {
  const { fullName, phone, email } = req.body || {};

  if (!fullName || !phone || !email) {
    return res.status(400).json({ message: 'Faltan datos.' });
  }

  const { data: existing } = await supabase
    .from('inscriptions')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ message: 'Email ya registrado.' });
  }

  const { error: insertError } = await supabase.from('inscriptions').insert({
    full_name: fullName,
    phone,
    email,
    status: 'pendiente'
  });

  if (insertError) {
    return res.status(500).json({ message: 'No se pudo guardar la inscripcion.' });
  }

  return res.json({ ok: true });
});

app.post('/api/admin/inscriptions/:id/paid', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { paid } = req.body || {};

  if (typeof paid !== 'boolean') {
    return res.status(400).json({ message: 'Estado de pago invalido.' });
  }

  const { error } = await supabase
    .from('inscriptions')
    .update({ paid, status: paid ? 'pagado' : 'pendiente' })
    .eq('id', id);

  if (error) {
    return res.status(500).json({ message: 'No se pudo actualizar el pago.' });
  }

  return res.json({ ok: true });
});

app.post('/api/admin/inscriptions/:id/confirm', requireAuth, async (req, res) => {
  const { id } = req.params;

  if (!mailer || !EMAIL_FROM) {
    return res.status(400).json({ message: 'Email no configurado.' });
  }

  const { data, error } = await supabase
    .from('inscriptions')
    .select('id, full_name, email, confirmed_at')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return res.status(404).json({ message: 'Inscripcion no encontrada.' });
  }

  if (data.confirmed_at) {
    return res.json({ ok: true, alreadyConfirmed: true });
  }

  try {
    await mailer.sendMail({
      from: EMAIL_FROM,
      to: data.email,
      subject: 'Inscripcion confirmada - Torneo de Truco Volley 2026',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Inscripcion confirmada</h2>
          <p>Hola ${data.full_name},</p>
          <p>Tu inscripcion al Torneo de Truco Volley 2026 fue confirmada.</p>
          <p>Te esperamos en el torneo. ¡Gracias por sumarte!</p>
        </div>
      `
    });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo enviar el email.' });
  }

  const { error: updateError } = await supabase
    .from('inscriptions')
    .update({ confirmed_at: new Date().toISOString(), status: 'confirmado' })
    .eq('id', id);

  if (updateError) {
    return res.status(500).json({ message: 'No se pudo actualizar la inscripcion.' });
  }

  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
