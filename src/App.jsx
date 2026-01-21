import { useCallback, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const steps = [
  { id: 1, label: 'Torneo' },
  { id: 2, label: 'Datos' },
  { id: 3, label: 'Pago' },
  { id: 4, label: 'Confirmacion' }
];

const initialForm = {
  name: '',
  phone: ''
};

function LandingHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <img className="logo" src="/logo.png" alt="Torneo de Truco Volley" />
        <div className="header-text">
          <p className="eyebrow">Torneo de Truco 2026 --- 1ra Edición</p>
          <h1>Inscripciones abierta</h1>
          <p className="subtitle">
            Inscríbite hasta el 1 de febrero. Sorteo de equipos en el lugar.
          </p>
        </div>
      </div>
    </header>
  );
}

function TournamentInfo() {
  return (
    <div className="info-card">
      <h2>Datos del torneo</h2>
      <ul>
        <li>
          <strong>Fecha limite de inscripcion:</strong> 1 de febrero
        </li>
        <li>
          <strong>Precio:</strong> 120.000 Gs
        </li>
        <li>
          <strong>Lugar:</strong> A definir
        </li>
        <li>
          <strong>Premios:</strong> Para los ganadores
        </li>
      </ul>
      <a className="map-button">
        📍 Ubicacion a definir
      </a>
      <a className="map-button secondary" href="/reglas">
        📖 Reglas del torneo
      </a>
    </div>
  );
}

function PaymentInfo() {
  return (
    <div className="info-card accent">
      <h2>Medios de pago</h2>
      <ul>
        <li>
          <strong>Alias:</strong> 5895986
        </li>
        <li>
          <strong>Nombre:</strong> Gaston Duarte
        </li>
        <li>
          <strong>Cedula:</strong> 5895986
        </li>
        <li>
          <strong>Cuenta:</strong> 16124043
        </li>
        <li>
          <strong>Banco:</strong> Ueno Bank
        </li>
      </ul>
    </div>
  );
}

function Stepper({ current }) {
  return (
    <div className="stepper">
      {steps.map((step, index) => {
        const isActive = current === step.id;
        const isDone = current > step.id;
        return (
          <div
            key={step.id}
            className={`step ${isActive ? 'active' : ''} ${
              isDone ? 'done' : ''
            }`}
          >
            <span className="step-index">{index + 1}</span>
            <span className="step-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SignupFlow() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const canContinue = form.name && form.phone;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: 'loading', message: 'Enviando inscripcion...' });

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim()
      };

      const response = await fetch(`${API_BASE}/api/inscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const info = await response.json().catch(() => ({}));
        throw new Error(info?.message || 'Error al enviar la inscripcion.');
      }

      setStep(4);
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message || 'Ocurrio un problema, intenta de nuevo.'
      });
    }
  };

  return (
    <section className="form-card">
      <h2>Inscripcion</h2>
      <Stepper current={step} />

      {step === 1 && (
        <div className="info-step">
          <TournamentInfo />
          <button
            type="button"
            className="primary"
            onClick={() => setStep(2)}
          >
            Inscribirse
          </button>
        </div>
      )}

      {step === 2 && (
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            if (canContinue) setStep(3);
          }}
        >
          <label>
            Nombre o apodo
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ej: Gaston"
              required
            />
          </label>
          <label>
            Numero
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Ej: 0981 123456"
              required
            />
          </label>
          <div className="button-row">
            <button
              type="button"
              className="ghost"
              onClick={() => setStep(1)}
            >
              Volver
            </button>
            <button type="submit" className="primary" disabled={!canContinue}>
              Continuar
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form className="form-grid" onSubmit={handleSubmit}>
          <PaymentInfo />
          <p className="note">
            Enviar comprobante a Seba Marsal +595 986 633909.
          </p>
          {status.type === 'error' && (
            <div className="alert error">{status.message}</div>
          )}
          {status.type === 'loading' && (
            <div className="alert loading">{status.message}</div>
          )}
          <div className="button-row">
            <button
              type="button"
              className="ghost"
              onClick={() => setStep(2)}
            >
              Volver
            </button>
            <button type="submit" className="primary">
              Enviar inscripcion
            </button>
          </div>
        </form>
      )}

      {step === 4 && (
        <div className="confirmation">
          <h3>Inscripcion realizada</h3>
          <p>
            Tu inscripcion fue realizada con exito.
          </p>
          <div className="summary">
            <p>
              <strong>Nombre:</strong> {form.name}
            </p>
            <p>
              <strong>Numero:</strong> {form.phone}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminPage() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [token, setToken] = useState(() => localStorage.getItem('adminToken'));
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [inscriptions, setInscriptions] = useState([]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setStatus({ type: 'loading', message: 'Ingresando...' });

    try {
      const response = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        throw new Error('Credenciales invalidas.');
      }

      const data = await response.json();
      localStorage.setItem('adminToken', data.token);
      setToken(data.token);
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setInscriptions([]);
  };

  const fetchInscriptions = useCallback(async () => {
    if (!token) return;
    setStatus({ type: 'loading', message: 'Cargando inscriptos...' });
    try {
      const response = await fetch(`${API_BASE}/api/admin/inscriptions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar la lista.');
      }

      const data = await response.json();
      setInscriptions(data);
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token]);

  const handlePaidToggle = useCallback(
    async (id, paid) => {
      if (!token) return;
      setStatus({ type: 'loading', message: 'Actualizando pago...' });
      try {
        const response = await fetch(
          `${API_BASE}/api/admin/inscriptions/${id}/paid`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ paid })
          }
        );

        if (!response.ok) {
          const info = await response.json().catch(() => ({}));
          throw new Error(info?.message || 'No se pudo actualizar el pago.');
        }

        setInscriptions((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, paid } : item
          )
        );
        setStatus({ type: 'success', message: '' });
      } catch (error) {
        setStatus({ type: 'error', message: error.message });
      }
    },
    [token]
  );

  const handleDelete = useCallback(
    async (id) => {
      if (!token) return;
      if (!window.confirm('Eliminar esta inscripcion?')) return;
      setStatus({ type: 'loading', message: 'Eliminando inscripcion...' });
      try {
        const response = await fetch(
          `${API_BASE}/api/admin/inscriptions/${id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (!response.ok) {
          const info = await response.json().catch(() => ({}));
          throw new Error(info?.message || 'No se pudo eliminar.');
        }

        setInscriptions((prev) => prev.filter((item) => item.id !== id));
        setStatus({ type: 'success', message: '' });
      } catch (error) {
        setStatus({ type: 'error', message: error.message });
      }
    },
    [token]
  );

  return (
    <main className="admin-page">
      <div className="admin-card">
        <h1>Panel admin</h1>
        {!token && (
          <form className="form-grid" onSubmit={handleLogin}>
            <label>
              Usuario
              <input
                type="text"
                value={credentials.username}
                onChange={(event) =>
                  setCredentials((prev) => ({
                    ...prev,
                    username: event.target.value
                  }))
                }
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials((prev) => ({
                    ...prev,
                    password: event.target.value
                  }))
                }
                required
              />
            </label>
            <button type="submit" className="primary">
              Ingresar
            </button>
            {status.type === 'error' && (
              <div className="alert error">{status.message}</div>
            )}
          </form>
        )}

        {token && (
          <div className="admin-actions">
            <button className="ghost" onClick={handleLogout}>
              Salir
            </button>
            <button className="primary" onClick={fetchInscriptions}>
              Ver inscriptos
            </button>
            {status.type === 'loading' && (
              <div className="alert loading">{status.message}</div>
            )}
          </div>
        )}

        {token && inscriptions.length > 0 && (
          <div className="table">
            <div className="table-row header">
              <span>Nombre</span>
              <span>Numero</span>
              <span>Pago</span>
              <span>Acciones</span>
            </div>
            {inscriptions.map((item) => (
              <div className="table-row" key={item.id}>
                <span className="table-cell" data-label="Nombre">
                  {item.name}
                </span>
                <span className="table-cell" data-label="Numero">
                  {item.phone}
                </span>
                <label className="paid-toggle table-cell" data-label="Pago">
                  <input
                    type="checkbox"
                    checked={Boolean(item.paid)}
                    onChange={(event) =>
                      handlePaidToggle(item.id, event.target.checked)
                    }
                  />
                  <span>{item.paid ? 'Pagado' : 'Pendiente'}</span>
                </label>
                <button
                  type="button"
                  className="tag-button table-cell danger"
                  data-label="Acciones"
                  onClick={() => handleDelete(item.id)}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function RulesPage() {
  return (
    <main className="rules-page">
      <div className="rules-card">
        <h1>Reglas del torneo</h1>
        <section className="rules-section">
          <h2>Modalidad del torneo</h2>
          <ul>
            <li>Equipos de 2 jugadores.</li>
            <li>Fase de grupos + eliminacion.</li>
            <li>Duplas a ser sorteadas en el lugar.</li>
          </ul>
        </section>
        <section className="rules-section">
          <h2>Sistema de juego</h2>
          <ul>
            <li>Truco clasico.</li>
            <li>Partidas a 30 puntos.</li>
            <li>Con flor.</li>
          </ul>
        </section>
        <section className="rules-section">
          <h2>Fase de grupos</h2>
          <ul>
            <li>Los equipos se dividen en grupos.</li>
            <li>Cada equipo juega contra todos los equipos de su grupo.</li>
          </ul>
        </section>
        <section className="rules-section">
          <h2>Puntaje</h2>
          <ul>
            <li>Partido ganado: +1 puntos.</li>
            <li>Partido perdido: 0 puntos.</li>
          </ul>
        </section>
        <section className="rules-section">
          <h2>Clasificacion</h2>
          <ul>
            <li>Avanzan a semifinales los 2 primeros de cada grupo.</li>
            <li>El orden se define por mayor diferencia de puntos.</li>
            <li>Si empatan, cuenta el resultado del partido entre ellos.</li>
          </ul>
        </section>
        <section className="rules-section">
          <h2>Semifinales y final</h2>
          <ul>
            <li>Semifinales: 1° vs 4°, 2° vs 3°</li>
            <li>(Depende de la cantidad de equipos)</li>
            <li>Partidos a 30 puntos.</li>
            <li>Eliminacion directa.</li>
            <li>El que pierde queda afuera.</li>
            <li>Desde esta fase, el tongo ya es a diferencia.</li>
          </ul>
        </section>
        <a className="map-button" href="/">
          Volver al inicio
        </a>
      </div>
    </main>
  );
}

export default function App() {
  const pathname = window.location.pathname;

  if (pathname === '/admin') {
    return <AdminPage />;
  }

  if (pathname === '/reglas') {
    return <RulesPage />;
  }

  return (
    <div className="page">
      <LandingHeader />
      <main>
        <SignupFlow />
      </main>
      <footer>
        <p>Organiza: Torneo de Truco Volley 2026</p>
        <a href="/admin">Admin</a>
      </footer>
    </div>
  );
}
