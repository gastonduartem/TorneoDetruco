import { useCallback, useEffect, useState } from 'react';

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

const buildStandings = (teams, matches) => {
  const stats = {};
  teams.forEach((team) => {
    stats[team.id] = {
      team,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0
    };
  });

  matches.forEach((match) => {
    if (match.home_score === null || match.away_score === null) return;
    const home = stats[match.home_team_id];
    const away = stats[match.away_team_id];
    if (!home || !away) return;

    home.pointsFor += match.home_score;
    home.pointsAgainst += match.away_score;
    away.pointsFor += match.away_score;
    away.pointsAgainst += match.home_score;
    home.diff = home.pointsFor - home.pointsAgainst;
    away.diff = away.pointsFor - away.pointsAgainst;

    if (match.home_score > match.away_score) {
      home.wins += 1;
      away.losses += 1;
    } else if (match.away_score > match.home_score) {
      away.wins += 1;
      home.losses += 1;
    }
  });

  const list = Object.values(stats);
  const grouped = list.reduce((acc, entry) => {
    const key = entry.wins;
    acc[key] = acc[key] || [];
    acc[key].push(entry);
    return acc;
  }, {});

  const winGroups = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a)
    .flatMap((wins) => {
      const group = grouped[wins];
      const sorted = group.sort((a, b) => {
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (group.length > 2 && b.pointsFor !== a.pointsFor) {
          return b.pointsFor - a.pointsFor;
        }
        if (group.length > 2 && a.pointsAgainst !== b.pointsAgainst) {
          return a.pointsAgainst - b.pointsAgainst;
        }
        return 0;
      });

      if (group.length === 2 && sorted[0].diff === sorted[1].diff) {
        const [first, second] = sorted;
        const headToHead = matches.find(
          (match) =>
            (match.home_team_id === first.team.id &&
              match.away_team_id === second.team.id) ||
            (match.home_team_id === second.team.id &&
              match.away_team_id === first.team.id)
        );
        if (headToHead && headToHead.home_score !== null && headToHead.away_score !== null) {
          const winnerId =
            headToHead.home_score > headToHead.away_score
              ? headToHead.home_team_id
              : headToHead.away_team_id;
          return winnerId === first.team.id ? [first, second] : [second, first];
        }
      }

      return sorted;
    });

  return winGroups;
};

const nextPowerOfTwo = (value) => {
  let power = 1;
  while (power < value) power *= 2;
  return power;
};

const buildBracketMatches = (groupRankings) => {
  const groupKeys = Object.keys(groupRankings);
  if (groupKeys.length === 2 && groupRankings[groupKeys[0]].length >= 4) {
    const [groupA, groupB] = groupKeys;
    const a = groupRankings[groupA];
    const b = groupRankings[groupB];
    return [
      { home: a[0].team, away: b[3].team },
      { home: a[2].team, away: b[1].team },
      { home: a[1].team, away: b[2].team },
      { home: a[3].team, away: b[0].team }
    ];
  }

  const seeds = groupKeys
    .flatMap((groupKey) => groupRankings[groupKey])
    .map((entry) => entry.team);

  const size = nextPowerOfTwo(seeds.length);
  const padded = [...seeds];
  while (padded.length < size) padded.push(null);

  const matches = [];
  for (let i = 0; i < padded.length; i += 2) {
    matches.push({ home: padded[i], away: padded[i + 1] });
  }
  return matches;
};

const getAvailableParticipants = (state, { includePending = false } = {}) => {
  if (!state?.participants || !state?.teams || !state?.tournament) return [];
  const assignedIds = new Set();
  state.teams.forEach((team) => {
    if (team.head_participant_id) assignedIds.add(team.head_participant_id);
    if (team.second_participant_id) assignedIds.add(team.second_participant_id);
  });
  if (state.tournament.pending_member_id && !includePending) {
    assignedIds.add(state.tournament.pending_member_id);
  }
  return state.participants.filter((participant) => !assignedIds.has(participant.id));
};

const getCompleteTeams = (state) => {
  if (!state?.teams) return [];
  return state.teams.filter(
    (team) => team.head_participant_id && team.second_participant_id
  );
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
  const [adminTab, setAdminTab] = useState('inscriptions');
  const [tournamentState, setTournamentState] = useState(null);
  const [lastDraw, setLastDraw] = useState(null);
  const [pendingMember, setPendingMember] = useState(null);
  const [matchInputs, setMatchInputs] = useState({});
  const [bracketInputs, setBracketInputs] = useState({});
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelItems, setWheelItems] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [manualSecondId, setManualSecondId] = useState('');
  const [showManualSecond, setShowManualSecond] = useState(false);
  const [groupSlots, setGroupSlots] = useState([]);
  const [groupWheelRotation, setGroupWheelRotation] = useState(0);
  const [groupWheelItems, setGroupWheelItems] = useState([]);
  const [groupSpinning, setGroupSpinning] = useState(false);
  const [groupAssignmentOrder, setGroupAssignmentOrder] = useState([]);
  const [lastGroupDraw, setLastGroupDraw] = useState(null);
  const spinDuration = 2400;

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
    setTournamentState(null);
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

  const fetchTournament = useCallback(async () => {
    if (!token) return;
    setStatus({ type: 'loading', message: 'Cargando torneo...' });
    try {
      const response = await fetch(`${API_BASE}/api/admin/tournament`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('No se pudo cargar el torneo.');
      }
      const data = await response.json();
      setTournamentState(data);
      setLastDraw(null);
      setPendingMember(
        data.tournament?.pending_member_id
          ? data.participants.find(
              (participant) =>
                participant.id === data.tournament.pending_member_id
            )
          : null
      );
      setWheelItems(
        getAvailableParticipants(data, {
          includePending: ['pairs', 'heads', 'seconds'].includes(
            data.tournament?.stage
          )
        })
      );
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token]);

  const startTournament = useCallback(async () => {
    if (!token) return;
    setStatus({ type: 'loading', message: 'Creando torneo...' });
    try {
      const response = await fetch(`${API_BASE}/api/admin/tournament/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo iniciar el torneo.');
      }
      setTournamentState(data);
      setLastDraw(null);
      setPendingMember(
        data.tournament?.pending_member_id
          ? data.participants.find(
              (participant) =>
                participant.id === data.tournament.pending_member_id
            )
          : null
      );
      setWheelItems(
        getAvailableParticipants(data, {
          includePending: ['pairs', 'heads', 'seconds'].includes(
            data.tournament?.stage
          )
        })
      );
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token]);

  const resetTournament = useCallback(async () => {
    if (!token) return;
    if (!window.confirm('Reiniciar torneo y borrar todo?')) return;
    setStatus({ type: 'loading', message: 'Reiniciando torneo...' });
    try {
      const response = await fetch(`${API_BASE}/api/admin/tournament/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('No se pudo reiniciar el torneo.');
      }
      setTournamentState(null);
      setLastDraw(null);
      setPendingMember(null);
      setGroupChoice(null);
      setMatchInputs({});
      setBracketInputs({});
      setWheelItems([]);
      setWheelRotation(0);
      setSpinning(false);
      setManualSecondId('');
      setShowManualSecond(false);
      setGroupSlots([]);
      setGroupWheelRotation(0);
      setGroupWheelItems([]);
      setGroupSpinning(false);
      setGroupAssignmentOrder([]);
      setLastGroupDraw(null);
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token]);

  const drawHead = useCallback(async () => {
    if (!token) return;
    if (spinning) return;
    const available = getAvailableParticipants(tournamentState);
    if (!available.length) {
      setStatus({ type: 'error', message: 'No hay participantes disponibles.' });
      return;
    }
    setWheelItems(available);
    setStatus({ type: 'loading', message: 'Girando ruleta...' });
    try {
      const response = await fetch(`${API_BASE}/api/admin/tournament/draw-head`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo girar.');
      }
      const picked = data.lastDraw;
      const index = available.findIndex((item) => item.id === picked?.id);
      if (index >= 0) {
        const angle = 360 / available.length;
        const centerAngle = angle * index + angle / 2;
        const targetRotation = wheelRotation + 1080 + (270 - centerAngle);
        setSpinning(true);
        setWheelRotation(targetRotation);
        setTimeout(() => {
          setTournamentState(data);
          setLastDraw(picked || null);
          setPendingMember(null);
          setSpinning(false);
        }, spinDuration);
      } else {
        setTournamentState(data);
        setLastDraw(picked || null);
      }
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token, spinning, tournamentState, wheelRotation]);

  const drawSecond = useCallback(async () => {
    if (!token) return;
    if (spinning) return;
    const available = getAvailableParticipants(tournamentState, {
      includePending: true
    });
    if (!available.length) {
      setStatus({ type: 'error', message: 'No hay participantes disponibles.' });
      return;
    }
    setWheelItems(available);
    setStatus({ type: 'loading', message: 'Girando ruleta...' });
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/tournament/draw-second`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo girar.');
      }
      const picked = data.pending;
      const index = available.findIndex((item) => item.id === picked?.id);
      if (index >= 0) {
        const angle = 360 / available.length;
        const centerAngle = angle * index + angle / 2;
        const targetRotation = wheelRotation + 1080 + (270 - centerAngle);
        setSpinning(true);
        setWheelRotation(targetRotation);
        setTimeout(() => {
          setTournamentState(data);
          setPendingMember(picked || null);
          setSpinning(false);
        }, spinDuration);
      } else {
        setTournamentState(data);
        setPendingMember(picked || null);
      }
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token, spinning, tournamentState, wheelRotation]);

  const confirmTeam = useCallback(async () => {
    if (!token) return;
    setStatus({ type: 'loading', message: 'Confirmando equipo...' });
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/tournament/confirm-team`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo confirmar.');
      }
      setTournamentState(data);
      setLastDraw(null);
      setPendingMember(
        data.tournament?.pending_member_id
          ? data.participants.find(
              (participant) =>
                participant.id === data.tournament.pending_member_id
            )
          : null
      );
      setWheelItems(
        getAvailableParticipants(data, {
          includePending: ['pairs', 'heads', 'seconds'].includes(
            data.tournament?.stage
          )
        })
      );
      setManualSecondId('');
      setShowManualSecond(false);
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token]);

  const selectSecond = useCallback(async () => {
    if (!token || !manualSecondId) return;
    setStatus({ type: 'loading', message: 'Asignando dupla...' });
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/tournament/select-second`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ participantId: manualSecondId })
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo asignar la dupla.');
      }
      setTournamentState(data);
      setPendingMember(
        data.tournament?.pending_member_id
          ? data.participants.find(
              (participant) =>
                participant.id === data.tournament.pending_member_id
            )
          : null
      );
      setWheelItems(
        getAvailableParticipants(data, {
          includePending: ['pairs', 'heads', 'seconds'].includes(
            data.tournament?.stage
          )
        })
      );
      setManualSecondId('');
      setShowManualSecond(false);
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [manualSecondId, token]);

  const nextTeam = useCallback(async () => {
    if (!token) return;
    setStatus({ type: 'loading', message: 'Pasando al siguiente equipo...' });
    try {
      const response = await fetch(`${API_BASE}/api/admin/tournament/next-team`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo avanzar.');
      }
      setTournamentState(data);
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token]);

  const confirmGroupDraw = useCallback(async () => {
    if (!token || !tournamentState?.tournament) return;
    const completeTeams = getCompleteTeams(tournamentState);
    if (groupAssignmentOrder.length !== completeTeams.length) {
      setStatus({ type: 'error', message: 'Faltan equipos por asignar.' });
      return;
    }
    const slotsByLabel = { A: 0, B: 0 };
    const assignments = groupAssignmentOrder.map((entry) => {
      const slotIndex = slotsByLabel[entry.label] ?? 0;
      slotsByLabel[entry.label] = slotIndex + 1;
      return {
        teamId: entry.teamId,
        groupIndex: entry.label === 'A' ? 0 : 1,
        slotIndex
      };
    });
    setStatus({ type: 'loading', message: 'Creando grupos...' });
    try {
      const response = await fetch(`${API_BASE}/api/admin/tournament/groups`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ groupCount: 2, assignments })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudieron crear grupos.');
      }
      setTournamentState(data);
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [groupAssignmentOrder, token, tournamentState]);

  const saveMatch = useCallback(
    async (matchId) => {
      if (!token) return;
      const scores = matchInputs[matchId];
      if (!scores || scores.home === '' || scores.away === '') {
        setStatus({ type: 'error', message: 'Completa ambos puntajes.' });
        return;
      }
      setStatus({ type: 'loading', message: 'Guardando resultado...' });
      try {
        const response = await fetch(
          `${API_BASE}/api/admin/tournament/matches/${matchId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              homeScore: Number(scores.home),
              awayScore: Number(scores.away)
            })
          }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || 'No se pudo guardar.');
        }
        setTournamentState(data);
        setStatus({ type: 'success', message: '' });
      } catch (error) {
        setStatus({ type: 'error', message: error.message });
      }
    },
    [token, matchInputs]
  );

  const saveBracketMatch = useCallback(
    async (matchId) => {
      if (!token) return;
      const scores = bracketInputs[matchId];
      if (!scores || scores.home === '' || scores.away === '') {
        setStatus({ type: 'error', message: 'Completa ambos puntajes.' });
        return;
      }
      setStatus({ type: 'loading', message: 'Guardando resultado...' });
      try {
        const response = await fetch(
          `${API_BASE}/api/admin/tournament/bracket/${matchId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              homeScore: Number(scores.home),
              awayScore: Number(scores.away)
            })
          }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || 'No se pudo guardar.');
        }
        setTournamentState(data);
        setStatus({ type: 'success', message: '' });
      } catch (error) {
        setStatus({ type: 'error', message: error.message });
      }
    },
    [token, bracketInputs]
  );

  const displayedWheelItems = spinning
    ? wheelItems
    : getAvailableParticipants(tournamentState, {
        includePending: ['pairs', 'heads', 'seconds'].includes(
          tournamentState?.tournament?.stage
        )
      });
  const displayedGroupSlots = groupSpinning ? groupWheelItems : groupSlots;

  const wheelColors = [
    '#f6c56b',
    '#f08c5e',
    '#6fbf8f',
    '#6586d4',
    '#d585b6',
    '#f2a65a'
  ];
  const wheelStyle =
    displayedWheelItems.length > 0
      ? {
          background: `conic-gradient(${displayedWheelItems
            .map(
              (_, index) =>
                `${wheelColors[index % wheelColors.length]} ${
                  (index * 360) / displayedWheelItems.length
                }deg ${((index + 1) * 360) / displayedWheelItems.length}deg`
            )
            .join(', ')})`,
          transform: `rotate(${wheelRotation}deg)`,
          transition: spinning
            ? `transform ${spinDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
            : 'none'
        }
      : { transform: `rotate(${wheelRotation}deg)` };

  const groupWheelStyle =
    displayedGroupSlots.length > 0
      ? {
          background: `conic-gradient(${displayedGroupSlots
            .map(
              (_, index) =>
                `${wheelColors[index % wheelColors.length]} ${
                  (index * 360) / displayedGroupSlots.length
                }deg ${((index + 1) * 360) / displayedGroupSlots.length}deg`
            )
            .join(', ')})`,
          transform: `rotate(${groupWheelRotation}deg)`,
          transition: groupSpinning
            ? `transform ${spinDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
            : 'none'
        }
      : { transform: `rotate(${groupWheelRotation}deg)` };

  const drawGroupSlot = useCallback(() => {
    if (!tournamentState?.tournament || groupSpinning) return;
    const completeTeams = getCompleteTeams(tournamentState);
    const assignedIds = new Set(groupAssignmentOrder.map((entry) => entry.teamId));
    const remainingTeams = completeTeams.filter((team) => !assignedIds.has(team.id));
    const currentTeam = remainingTeams[0];
    if (!currentTeam) return;
    if (!groupSlots.length) {
      setStatus({ type: 'error', message: 'No hay grupos disponibles.' });
      return;
    }
    setGroupWheelItems(groupSlots);
    setStatus({ type: 'loading', message: 'Girando ruleta...' });
    const index = Math.floor(Math.random() * groupSlots.length);
    const angle = 360 / groupSlots.length;
    const centerAngle = angle * index + angle / 2;
    const targetRotation = groupWheelRotation + 1080 + (270 - centerAngle);
    const selectedLabel = groupSlots[index];
    setGroupSpinning(true);
    setGroupWheelRotation(targetRotation);
    setTimeout(() => {
      setGroupAssignmentOrder((prev) => [
        ...prev,
        { teamId: currentTeam.id, label: selectedLabel }
      ]);
      setGroupSlots((prev) => prev.filter((_, idx) => idx !== index));
      setLastGroupDraw(selectedLabel);
      setGroupSpinning(false);
      setStatus({ type: 'success', message: '' });
    }, spinDuration);
  }, [
    groupAssignmentOrder,
    groupSlots,
    groupSpinning,
    groupWheelRotation,
    spinDuration,
    tournamentState
  ]);

  useEffect(() => {
    if (!tournamentState?.tournament || tournamentState.tournament.stage !== 'groups') {
      setGroupSlots([]);
      setGroupWheelRotation(0);
      setGroupWheelItems([]);
      setGroupSpinning(false);
      setGroupAssignmentOrder([]);
      setLastGroupDraw(null);
      return;
    }
    const completeTeams = getCompleteTeams(tournamentState);
    if (!groupSlots.length && completeTeams.length) {
      const half = Math.floor(completeTeams.length / 2);
      const slots = [
        ...Array.from({ length: half }, () => 'A'),
        ...Array.from({ length: completeTeams.length - half }, () => 'B')
      ];
      setGroupSlots(slots);
      setGroupWheelItems(slots);
      setGroupWheelRotation(0);
    }
  }, [groupSlots.length, tournamentState]);

  const createBracket = useCallback(async () => {
    if (!token || !tournamentState?.tournament) return;
    const teamsById = Object.fromEntries(
      tournamentState.teams.map((team) => [team.id, team])
    );
    const groupTeamsByGroup = tournamentState.groupTeams.reduce((acc, entry) => {
      acc[entry.group_id] = acc[entry.group_id] || [];
      acc[entry.group_id].push(entry.team_id);
      return acc;
    }, {});

    const groupRankings = {};
    tournamentState.groups.forEach((group) => {
      const teamIds = groupTeamsByGroup[group.id] || [];
      const groupTeamsList = teamIds.map((id) => teamsById[id]).filter(Boolean);
      const groupMatches = tournamentState.matches.filter(
        (match) => match.group_id === group.id
      );
      groupRankings[group.name] = buildStandings(groupTeamsList, groupMatches);
    });

    const groupSizes = Object.values(groupTeamsByGroup).map((list) => list.length);
    if (!groupSizes.length) {
      setStatus({ type: 'error', message: 'No hay grupos cargados.' });
      return;
    }

    const qualifyCount = Math.max(Math.min(...groupSizes) - 1, 1);

    Object.keys(groupRankings).forEach((key) => {
      groupRankings[key] = groupRankings[key].slice(0, qualifyCount);
    });

    const firstRound = buildBracketMatches(groupRankings);
    const totalTeams = firstRound.length * 2;
    const rounds = Math.log2(nextPowerOfTwo(totalTeams));
    const matches = [];

    for (let round = 1; round <= rounds; round += 1) {
      const matchesInRound = totalTeams / 2 ** round;
      for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
        if (round === 1) {
          const entry = firstRound[matchIndex] || { home: null, away: null };
          matches.push({
            round_index: round,
            match_index: matchIndex,
            home_team_id: entry.home?.id || null,
            away_team_id: entry.away?.id || null,
            bracket_type: 'main'
          });
        } else {
          matches.push({
            round_index: round,
            match_index: matchIndex,
            home_team_id: null,
            away_team_id: null,
            bracket_type: 'main'
          });
        }
      }
    }

    if (rounds >= 2) {
      matches.push({
        round_index: rounds - 1,
        match_index: 0,
        home_team_id: null,
        away_team_id: null,
        bracket_type: 'third_place'
      });
    }

    setStatus({ type: 'loading', message: 'Creando llaves...' });
    try {
      const response = await fetch(`${API_BASE}/api/admin/tournament/bracket`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ matches })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo crear la llave.');
      }
      setTournamentState(data);
      setStatus({ type: 'success', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token, tournamentState]);

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
            <button
              className={`ghost ${adminTab === 'inscriptions' ? 'active' : ''}`}
              onClick={() => {
                setAdminTab('inscriptions');
                fetchInscriptions();
              }}
            >
              Inscriptos
            </button>
            <button
              className={`ghost ${adminTab === 'tournament' ? 'active' : ''}`}
              onClick={() => {
                setAdminTab('tournament');
                fetchTournament();
              }}
            >
              Torneo
            </button>
            {status.type === 'loading' && (
              <div className="alert loading">{status.message}</div>
            )}
          </div>
        )}

        {token && adminTab === 'inscriptions' && inscriptions.length > 0 && (
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

        {token && adminTab === 'tournament' && (
          <div className="tournament">
            {!tournamentState?.tournament && (
              <div className="tournament-card">
                <h2>Empezar torneo</h2>
                <p>Se usaran solo los participantes con pago confirmado.</p>
                <div className="button-row">
                  <button className="primary" onClick={startTournament}>
                    Empezar torneo
                  </button>
                </div>
              </div>
            )}

            {tournamentState?.tournament && (
              <div className="tournament-card">
                <div className="tournament-header">
                  <h2>Panel de torneo</h2>
                  <button className="ghost danger" onClick={resetTournament}>
                    Reiniciar torneo
                  </button>
                </div>

                {['pairs', 'heads', 'seconds'].includes(
                  tournamentState.tournament.stage
                ) && (
                  <div className="tournament-step">
                    <h3>Sorteo de equipos</h3>
                    <p>Gira la ruleta para elegir los integrantes del equipo.</p>
                    <div className="roulette">
                      <div className="wheel-wrap">
                        <div className="wheel-pointer" />
                        <div className="wheel" style={wheelStyle}>
                          {displayedWheelItems.map((participant, index) => {
                            const angle =
                              (index * 360) / displayedWheelItems.length +
                              360 / displayedWheelItems.length / 2;
                            return (
                              <span
                                key={participant.id}
                                className="wheel-label"
                                style={{
                                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(-1 * var(--wheel-radius))) rotate(-${angle}deg)`
                                }}
                              >
                                {participant.name}
                              </span>
                            );
                          })}
                        </div>
                        {(() => {
                          const currentTeam =
                            tournamentState.teams[
                              tournamentState.tournament.current_head_index
                            ];
                          const head = currentTeam
                            ? tournamentState.participants.find(
                                (participant) =>
                                  participant.id === currentTeam.head_participant_id
                              )
                            : null;
                          const hasHead = Boolean(head);
                          const canSpin =
                            displayedWheelItems.length > 0 &&
                            !spinning &&
                            !pendingMember;
                          const drawLabel = hasHead
                            ? 'Girar (2do integrante)'
                            : 'Girar (1er integrante)';
                          const handleSpin = () => {
                            if (hasHead) {
                              drawSecond();
                            } else {
                              drawHead();
                            }
                          };

                          return (
                            <button
                              className="wheel-button"
                              onClick={handleSpin}
                              disabled={!canSpin}
                            >
                              {drawLabel}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    {(() => {
                      const currentTeam =
                        tournamentState.teams[
                          tournamentState.tournament.current_head_index
                        ];
                      const head = currentTeam
                        ? tournamentState.participants.find(
                            (participant) =>
                              participant.id === currentTeam.head_participant_id
                          )
                        : null;
                      const hasHead = Boolean(head);

                      return (
                        <>
                          {lastDraw && !hasHead && (
                            <div className="highlight-card">
                              {lastDraw.name} seleccionado
                            </div>
                          )}
                          {head && (
                            <div className="highlight-card">
                              1er integrante: {head.name}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {pendingMember && (
                      <div className="highlight-card">
                        {pendingMember.name} seleccionado
                      </div>
                    )}
                    {pendingMember && (
                      <div className="team-preview">
                        <strong>
                          {tournamentState.participants.find(
                            (participant) =>
                              participant.id ===
                              tournamentState.teams[
                                tournamentState.tournament.current_head_index
                              ]?.head_participant_id
                          )?.name || '---'}{' '}
                          & {pendingMember.name}
                        </strong>
                        <div className="button-row">
                          <button className="primary" onClick={confirmTeam}>
                            Confirmar equipo
                          </button>
                          <button
                            className="ghost"
                            onClick={() => setShowManualSecond((prev) => !prev)}
                          >
                            Elegir otra persona
                          </button>
                        </div>
                        {showManualSecond && (
                          <div className="roulette-panel">
                            <label>
                              Disponible
                              <select
                                value={manualSecondId}
                                onChange={(event) =>
                                  setManualSecondId(event.target.value)
                                }
                              >
                                <option value="">Seleccionar...</option>
                                {displayedWheelItems.map((participant) => (
                                  <option key={participant.id} value={participant.id}>
                                    {participant.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              className="ghost"
                              onClick={selectSecond}
                              disabled={!manualSecondId || spinning}
                            >
                              Confirmar nueva dupla
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="team-list">
                      {tournamentState.teams.map((team) => {
                        const head = tournamentState.participants.find(
                          (participant) =>
                            participant.id === team.head_participant_id
                        );
                        const second = tournamentState.participants.find(
                          (participant) =>
                            participant.id === team.second_participant_id
                        );
                        return (
                          <div className="team-item" key={team.id}>
                            <span>Equipo {team.seed_index + 1}</span>
                            <strong>
                              {head ? head.name : '---'}{' '}
                              {second ? `& ${second.name}` : ''}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {tournamentState.tournament.stage === 'groups' && (
                  <div className="tournament-step">
                    <h3>Sorteo de grupos</h3>
                    <p>Asigna cada equipo al Grupo A o Grupo B.</p>
                    <div className="roulette roulette-grid">
                      <div className="wheel-wrap">
                        <div className="wheel-pointer" />
                        <div className="wheel" style={groupWheelStyle}>
                          {displayedGroupSlots.map((slot, index) => {
                            const angle =
                              (index * 360) / displayedGroupSlots.length +
                              360 / displayedGroupSlots.length / 2;
                            return (
                              <span
                                key={`${slot}-${index}`}
                                className="wheel-label"
                                style={{
                                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(-1 * var(--wheel-radius))) rotate(-${angle}deg)`
                                }}
                              >
                                {slot}
                              </span>
                            );
                          })}
                        </div>
                        <button
                          className="wheel-button"
                          onClick={drawGroupSlot}
                          disabled={
                            groupSpinning || displayedGroupSlots.length === 0
                          }
                        >
                          Girar
                        </button>
                      </div>
                      <div className="roulette-panel">
                        {(() => {
                          const completeTeams = getCompleteTeams(tournamentState);
                          const assignedIds = new Set(
                            groupAssignmentOrder.map((entry) => entry.teamId)
                          );
                          const remainingTeams = completeTeams.filter(
                            (team) => !assignedIds.has(team.id)
                          );
                          const currentTeam = remainingTeams[0];
                          return (
                            <>
                              <h4>Equipo actual</h4>
                              <div className="highlight-card">
                                {currentTeam?.name || '---'}
                              </div>
                              {lastGroupDraw && (
                                <div className="highlight-card">
                                  Grupo {lastGroupDraw} seleccionado
                                </div>
                              )}
                              <p>
                                Quedan {remainingTeams.length} equipos por asignar.
                              </p>
                              <button
                                className="primary"
                                onClick={confirmGroupDraw}
                                disabled={
                                  remainingTeams.length > 0 ||
                                  groupAssignmentOrder.length !== completeTeams.length ||
                                  groupSpinning
                                }
                              >
                                Confirmar grupos
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {tournamentState.tournament.stage === 'group_fixtures' && (
                  <div className="tournament-step">
                    {(() => {
                      const allDone = tournamentState.matches.every(
                        (match) =>
                          match.home_score !== null && match.away_score !== null
                      );
                      return (
                        <>
                    <h3>Grupos</h3>
                    <div className="groups-grid">
                      {tournamentState.groups.map((group) => {
                        const groupTeams = tournamentState.groupTeams
                          .filter((entry) => entry.group_id === group.id)
                          .map((entry) =>
                            tournamentState.teams.find(
                              (team) => team.id === entry.team_id
                            )
                          )
                          .filter(Boolean);
                        return (
                          <div className="group-card" key={group.id}>
                            <h4>{group.name}</h4>
                            <ul>
                              {groupTeams.map((team) => (
                                <li key={team.id}>{team.name || 'Equipo'}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                    <h3>Fechas</h3>
                    {tournamentState.groups.map((group) => {
                      const groupMatches = tournamentState.matches.filter(
                        (match) => match.group_id === group.id
                      );
                      const rounds = groupMatches.reduce((acc, match) => {
                        acc[match.round_index] = acc[match.round_index] || [];
                        acc[match.round_index].push(match);
                        return acc;
                      }, {});

                      return (
                        <div className="rounds" key={group.id}>
                          <h4>{group.name}</h4>
                          {Object.keys(rounds).map((roundKey) => (
                            <div className="round-card" key={roundKey}>
                              <h5>Fecha {roundKey}</h5>
                              {rounds[roundKey].map((match) => {
                                const homeTeam = tournamentState.teams.find(
                                  (team) => team.id === match.home_team_id
                                );
                                const awayTeam = tournamentState.teams.find(
                                  (team) => team.id === match.away_team_id
                                );
                                return (
                                  <div className="match-row" key={match.id}>
                                    <span>{homeTeam?.name || '---'}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        matchInputs[match.id]?.home ??
                                        match.home_score ??
                                        ''
                                      }
                                      onChange={(event) =>
                                        setMatchInputs((prev) => ({
                                          ...prev,
                                          [match.id]: {
                                            ...prev[match.id],
                                            home: event.target.value
                                          }
                                        }))
                                      }
                                    />
                                    <span>vs</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        matchInputs[match.id]?.away ??
                                        match.away_score ??
                                        ''
                                      }
                                      onChange={(event) =>
                                        setMatchInputs((prev) => ({
                                          ...prev,
                                          [match.id]: {
                                            ...prev[match.id],
                                            away: event.target.value
                                          }
                                        }))
                                      }
                                    />
                                    <span>{awayTeam?.name || '---'}</span>
                                    <button
                                      className="ghost"
                                      onClick={() => saveMatch(match.id)}
                                    >
                                      Confirmar resultado
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    <h3>Tabla de posiciones</h3>
                    <div className="groups-grid">
                      {tournamentState.groups.map((group) => {
                        const groupTeamIds = tournamentState.groupTeams
                          .filter((entry) => entry.group_id === group.id)
                          .map((entry) => entry.team_id);
                        const groupTeamsList = groupTeamIds
                          .map((id) =>
                            tournamentState.teams.find((team) => team.id === id)
                          )
                          .filter(Boolean);
                        const groupMatches = tournamentState.matches.filter(
                          (match) => match.group_id === group.id
                        );
                        const standings = buildStandings(
                          groupTeamsList,
                          groupMatches
                        );
                        return (
                          <div className="group-card" key={group.id}>
                            <h4>{group.name}</h4>
                            <div className="table compact">
                              <div className="table-row header">
                                <span>Equipo</span>
                                <span>V</span>
                                <span>D</span>
                                <span>Dif</span>
                                <span>PF</span>
                                <span>PC</span>
                              </div>
                              {standings.map((entry) => (
                                <div className="table-row" key={entry.team.id}>
                                  <span className="table-cell" data-label="Equipo">
                                    {entry.team.name || 'Equipo'}
                                  </span>
                                  <span className="table-cell" data-label="V">
                                    {entry.wins}
                                  </span>
                                  <span className="table-cell" data-label="D">
                                    {entry.losses}
                                  </span>
                                  <span className="table-cell" data-label="Dif">
                                    {entry.diff}
                                  </span>
                                  <span className="table-cell" data-label="PF">
                                    {entry.pointsFor}
                                  </span>
                                  <span className="table-cell" data-label="PC">
                                    {entry.pointsAgainst}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button className="primary" onClick={createBracket} disabled={!allDone}>
                      Continuar a llaves
                    </button>
                    {!allDone && (
                      <p className="note">
                        Completa todos los resultados antes de continuar.
                      </p>
                    )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {tournamentState.tournament.stage === 'playoffs' && (
                  <div className="tournament-step">
                    <h3>Llave final</h3>
                    <div className="bracket">
                      {[...new Set(
                        tournamentState.bracketMatches
                          .filter((match) => match.bracket_type === 'main')
                          .map((match) => match.round_index)
                      )]
                        .sort((a, b) => a - b)
                        .map((roundIndex) => {
                          const roundMatches = tournamentState.bracketMatches.filter(
                            (match) =>
                              match.bracket_type === 'main' &&
                              match.round_index === roundIndex
                          );
                          return (
                            <div className="round-card" key={roundIndex}>
                              <h5>Ronda {roundIndex}</h5>
                              {roundMatches.map((match) => {
                                const homeTeam = tournamentState.teams.find(
                                  (team) => team.id === match.home_team_id
                                );
                                const awayTeam = tournamentState.teams.find(
                                  (team) => team.id === match.away_team_id
                                );
                                return (
                                  <div className="match-row" key={match.id}>
                                    <span>{homeTeam?.name || '---'}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        bracketInputs[match.id]?.home ??
                                        match.home_score ??
                                        ''
                                      }
                                      onChange={(event) =>
                                        setBracketInputs((prev) => ({
                                          ...prev,
                                          [match.id]: {
                                            ...prev[match.id],
                                            home: event.target.value
                                          }
                                        }))
                                      }
                                    />
                                    <span>vs</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        bracketInputs[match.id]?.away ??
                                        match.away_score ??
                                        ''
                                      }
                                      onChange={(event) =>
                                        setBracketInputs((prev) => ({
                                          ...prev,
                                          [match.id]: {
                                            ...prev[match.id],
                                            away: event.target.value
                                          }
                                        }))
                                      }
                                    />
                                    <span>{awayTeam?.name || '---'}</span>
                                    <button
                                      className="ghost"
                                      onClick={() => saveBracketMatch(match.id)}
                                    >
                                      Confirmar resultado
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                    </div>

                    <div className="round-card">
                      <h5>3er puesto</h5>
                      {tournamentState.bracketMatches
                        .filter((match) => match.bracket_type === 'third_place')
                        .map((match) => {
                          const homeTeam = tournamentState.teams.find(
                            (team) => team.id === match.home_team_id
                          );
                          const awayTeam = tournamentState.teams.find(
                            (team) => team.id === match.away_team_id
                          );
                          return (
                            <div className="match-row" key={match.id}>
                              <span>{homeTeam?.name || '---'}</span>
                              <input
                                type="number"
                                min="0"
                                value={
                                  bracketInputs[match.id]?.home ??
                                  match.home_score ??
                                  ''
                                }
                                onChange={(event) =>
                                  setBracketInputs((prev) => ({
                                    ...prev,
                                    [match.id]: {
                                      ...prev[match.id],
                                      home: event.target.value
                                    }
                                  }))
                                }
                              />
                              <span>vs</span>
                              <input
                                type="number"
                                min="0"
                                value={
                                  bracketInputs[match.id]?.away ??
                                  match.away_score ??
                                  ''
                                }
                                onChange={(event) =>
                                  setBracketInputs((prev) => ({
                                    ...prev,
                                    [match.id]: {
                                      ...prev[match.id],
                                      away: event.target.value
                                    }
                                  }))
                                }
                              />
                              <span>{awayTeam?.name || '---'}</span>
                              <button
                                className="ghost"
                                onClick={() => saveBracketMatch(match.id)}
                              >
                                Confirmar resultado
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
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
            <li>Partido ganado: +1 victoria.</li>
            <li>Partido perdido: 0 victorias.</li>
          </ul>
        </section>
        <section className="rules-section">
          <h2>Clasificación</h2>
          <ul>
            <li>Avanzan a la fase final los 2, 3 o 4 primeros de cada grupo (dependiendo de la cantidad de participantes).</li>
            <li>Clasifican <strong>uno menos</strong> que el tamaño del grupo.</li>
            <li>Si los grupos son desparejos, clasifican la <strong>misma cantidad</strong> en todos:</li>
                  <ul>
                    <li>Ejemplo: grupos de 4 y 5 → clasifican 3 de cada grupo.</li>
                  </ul>
            <li>
              <strong>Orden de clasificación</strong>
              <ol>
                <li>Mayor cantidad de victorias.</li>
                <li>
                  Si hay empate en victorias, se desempata por:
                  <ol>
                    <li>Mayor diferencia de puntos (puntos a favor - puntos en contra).</li>
                    <li>
                      Si persiste el empate:
                      <ul>
                        <li>
                          <strong>Empate entre 2 equipos:</strong>
                          <ul>
                            <li>Resultado del partido entre ambos (pasa el ganador).</li>
                          </ul>
                        </li>

                        <li>
                          <strong>Empate entre 3 equipos o más:</strong>
                          <ol>
                            <li>Mayor cantidad de puntos a favor.</li>
                            <li>Si sigue el empate, menor cantidad de puntos en contra.</li>
                          </ol>
                        </li>
                      </ul>
                    </li>
                  </ol>
                </li>
              </ol>
            </li>
          </ul>
        </section>
        <section className="rules-section">
          <h2>Fase final</h2>
          <ul>
            <li>
              <strong>Eliminación</strong>
              <ul>
                <li>Eliminación directa</li>
                <li>
                  <strong>Cruces</strong> (Grupo A vs Grupo B):
                  <ul>
                    <li>A1 vs B4</li>
                    <li>A3 vs B2</li>
                    <li>A2 vs B3</li>
                    <li>A4 vs B1</li>
                  </ul>
                </li>
                <li>Partidos a <strong>30 puntos</strong>.</li>
                <li>Hay partido por <strong>3er / 4to puesto</strong>.</li>
              </ul>
            </li>
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
