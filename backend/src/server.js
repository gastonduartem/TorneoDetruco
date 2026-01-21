import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

const {
  PORT = 8080,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_USER,
  ADMIN_PASS,
  ADMIN_JWT_SECRET,
  CORS_ORIGIN
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    .select('id, name, phone, paid, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ message: 'Error cargando inscripciones.' });
  }

  return res.json(data || []);
});

app.post('/api/inscriptions', async (req, res) => {
  const { name, phone } = req.body || {};

  try {
    if (!name || !phone) {
      return res.status(400).json({ message: 'Faltan datos.' });
    }

    const { error: insertError } = await supabase.from('inscriptions').insert({
      name,
      phone
    });

    if (insertError) {
      console.error('Error guardando inscripcion:', insertError);
      return res.status(500).json({
        message: insertError.message || 'No se pudo guardar la inscripcion.'
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error inesperado en inscripcion:', error);
    return res.status(500).json({
      message: error?.message || 'Error inesperado en inscripcion.'
    });
  }
});

app.delete('/api/admin/inscriptions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('inscriptions')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ message: 'No se pudo eliminar la inscripcion.' });
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
    .update({ paid })
    .eq('id', id);

  if (error) {
    return res.status(500).json({ message: 'No se pudo actualizar el pago.' });
  }

  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
