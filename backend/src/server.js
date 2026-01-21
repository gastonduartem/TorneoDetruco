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

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const roundRobin = (teamIds) => {
  const teams = [...teamIds];
  const hasBye = teams.length % 2 !== 0;
  if (hasBye) teams.push(null);
  const totalRounds = teams.length - 1;
  const half = teams.length / 2;
  const rounds = [];

  for (let round = 0; round < totalRounds; round += 1) {
    const matches = [];
    for (let i = 0; i < half; i += 1) {
      const home = teams[i];
      const away = teams[teams.length - 1 - i];
      if (home && away) {
        matches.push({ home, away });
      }
    }
    rounds.push(matches);
    const fixed = teams[0];
    const rotated = teams.slice(1);
    rotated.unshift(rotated.pop());
    teams.splice(0, teams.length, fixed, ...rotated);
  }

  return rounds;
};

const getTournamentState = async () => {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return { tournament: null };
  }

  const [participants, teams, groups, groupTeams, matches, bracketMatches] =
    await Promise.all([
      supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('tournament_teams')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('seed_index', { ascending: true }),
      supabase
        .from('tournament_groups')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('group_index', { ascending: true }),
      supabase
        .from('tournament_group_teams')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('slot_index', { ascending: true }),
      supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('round_index', { ascending: true })
        .order('match_index', { ascending: true }),
      supabase
        .from('tournament_bracket_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('round_index', { ascending: true })
        .order('match_index', { ascending: true })
    ]);

  return {
    tournament,
    participants: participants.data || [],
    teams: teams.data || [],
    groups: groups.data || [],
    groupTeams: groupTeams.data || [],
    matches: matches.data || [],
    bracketMatches: bracketMatches.data || []
  };
};

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

app.get('/api/admin/tournament', requireAuth, async (req, res) => {
  const state = await getTournamentState();
  return res.json(state);
});

app.post('/api/admin/tournament/reset', requireAuth, async (req, res) => {
  const { data: existing } = await supabase
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase.from('tournaments').delete().eq('id', existing.id);
  }

  return res.json({ ok: true });
});

app.post('/api/admin/tournament/start', requireAuth, async (req, res) => {
  const { data: existing } = await supabase
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase.from('tournaments').delete().eq('id', existing.id);
  }

  const { data: paidParticipants, error } = await supabase
    .from('inscriptions')
    .select('id, name, phone')
    .eq('paid', true)
    .order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ message: 'Error cargando participantes.' });
  }

  if (!paidParticipants || paidParticipants.length < 2) {
    return res
      .status(400)
      .json({ message: 'Se necesitan al menos 2 participantes pagados.' });
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .insert({ stage: 'heads', current_head_index: 0 })
    .select('*')
    .single();

  if (tournamentError) {
    return res.status(500).json({ message: 'No se pudo crear el torneo.' });
  }

  const participantsPayload = paidParticipants.map((participant) => ({
    tournament_id: tournament.id,
    inscription_id: participant.id,
    name: participant.name,
    phone: participant.phone
  }));

  const { error: participantError } = await supabase
    .from('tournament_participants')
    .insert(participantsPayload);

  if (participantError) {
    return res.status(500).json({ message: 'No se pudieron guardar participantes.' });
  }

  const teamCount = Math.floor(participantsPayload.length / 2);
  const teamsPayload = Array.from({ length: teamCount }, (_, index) => ({
    tournament_id: tournament.id,
    seed_index: index
  }));

  const { error: teamsError } = await supabase
    .from('tournament_teams')
    .insert(teamsPayload);

  if (teamsError) {
    return res.status(500).json({ message: 'No se pudieron crear equipos.' });
  }

  const state = await getTournamentState();
  return res.json(state);
});

app.post('/api/admin/tournament/draw-head', requireAuth, async (req, res) => {
  const state = await getTournamentState();
  const { tournament, participants, teams } = state;

  if (!tournament || tournament.stage !== 'heads') {
    return res.status(400).json({ message: 'El torneo no esta en etapa de cabezas.' });
  }

  const usedIds = new Set(
    teams
      .map((team) => team.head_participant_id)
      .filter(Boolean)
  );

  const available = participants.filter((participant) => !usedIds.has(participant.id));

  if (available.length === 0) {
    return res.status(400).json({ message: 'No hay participantes disponibles.' });
  }

  const nextTeam = teams.find((team) => !team.head_participant_id);
  if (!nextTeam) {
    return res.status(400).json({ message: 'Todas las cabezas ya fueron asignadas.' });
  }

  const picked = available[Math.floor(Math.random() * available.length)];

  await supabase
    .from('tournament_teams')
    .update({ head_participant_id: picked.id })
    .eq('id', nextTeam.id);

  const remainingHeads = teams.filter((team) => !team.head_participant_id).length - 1;
  if (remainingHeads <= 0) {
    await supabase
      .from('tournaments')
      .update({ stage: 'seconds', current_head_index: 0 })
      .eq('id', tournament.id);
  }

  const updated = await getTournamentState();
  return res.json({ ...updated, lastDraw: picked });
});

app.post('/api/admin/tournament/draw-second', requireAuth, async (req, res) => {
  const state = await getTournamentState();
  const { tournament, participants, teams } = state;

  if (!tournament || tournament.stage !== 'seconds') {
    return res.status(400).json({ message: 'El torneo no esta en etapa de segundos.' });
  }

  if (tournament.pending_member_id) {
    const pending = participants.find(
      (participant) => participant.id === tournament.pending_member_id
    );
    return res.json({ ...state, pending });
  }

  const usedIds = new Set(
    teams
      .flatMap((team) => [team.head_participant_id, team.second_participant_id])
      .filter(Boolean)
  );

  const available = participants.filter((participant) => !usedIds.has(participant.id));

  if (available.length === 0) {
    return res.status(400).json({ message: 'No hay participantes disponibles.' });
  }

  const picked = available[Math.floor(Math.random() * available.length)];

  await supabase
    .from('tournaments')
    .update({ pending_member_id: picked.id })
    .eq('id', tournament.id);

  const updated = await getTournamentState();
  return res.json({ ...updated, pending: picked });
});

const findNextTeamIndex = (teams, startIndex) => {
  if (!teams.length) return 0;
  const total = teams.length;
  for (let offset = 1; offset <= total; offset += 1) {
    const index = (startIndex + offset) % total;
    if (!teams[index].second_participant_id) {
      return index;
    }
  }
  return startIndex;
};

app.post('/api/admin/tournament/next-team', requireAuth, async (req, res) => {
  const state = await getTournamentState();
  const { tournament, teams } = state;

  if (!tournament || tournament.stage !== 'seconds') {
    return res.status(400).json({ message: 'El torneo no esta en etapa de segundos.' });
  }

  const nextIndex = findNextTeamIndex(teams, tournament.current_head_index);

  await supabase
    .from('tournaments')
    .update({ current_head_index: nextIndex })
    .eq('id', tournament.id);

  const updated = await getTournamentState();
  return res.json(updated);
});

app.post('/api/admin/tournament/confirm-team', requireAuth, async (req, res) => {
  const state = await getTournamentState();
  const { tournament, participants, teams } = state;

  if (!tournament || tournament.stage !== 'seconds') {
    return res.status(400).json({ message: 'El torneo no esta en etapa de segundos.' });
  }

  if (!tournament.pending_member_id) {
    return res.status(400).json({ message: 'No hay participante pendiente.' });
  }

  const currentTeam = teams[tournament.current_head_index];
  if (!currentTeam) {
    return res.status(400).json({ message: 'Equipo actual invalido.' });
  }

  const head = participants.find((participant) => participant.id === currentTeam.head_participant_id);
  const pending = participants.find((participant) => participant.id === tournament.pending_member_id);

  await supabase
    .from('tournament_teams')
    .update({
      second_participant_id: tournament.pending_member_id,
      name: head && pending ? `${head.name} & ${pending.name}` : null
    })
    .eq('id', currentTeam.id);

  const remainingSeconds = teams.filter((team) => !team.second_participant_id).length - 1;
  const nextIndex = findNextTeamIndex(teams, tournament.current_head_index);

  await supabase
    .from('tournaments')
    .update({
      pending_member_id: null,
      current_head_index: remainingSeconds > 0 ? nextIndex : 0,
      stage: remainingSeconds > 0 ? 'seconds' : 'groups'
    })
    .eq('id', tournament.id);

  const updated = await getTournamentState();
  return res.json(updated);
});

app.post('/api/admin/tournament/groups', requireAuth, async (req, res) => {
  const { groupCount } = req.body || {};
  const state = await getTournamentState();
  const { tournament, teams } = state;

  if (!tournament || tournament.stage !== 'groups') {
    return res.status(400).json({ message: 'El torneo no esta en etapa de grupos.' });
  }

  if (![2, 3, 4].includes(groupCount)) {
    return res.status(400).json({ message: 'Cantidad de grupos invalida.' });
  }

  const completeTeams = teams.filter(
    (team) => team.head_participant_id && team.second_participant_id
  );

  const shuffledTeams = shuffle(completeTeams);
  const groupNames = ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D'];
  const groupsPayload = Array.from({ length: groupCount }, (_, index) => ({
    tournament_id: tournament.id,
    group_index: index,
    name: groupNames[index]
  }));

  const { data: createdGroups, error: groupsError } = await supabase
    .from('tournament_groups')
    .insert(groupsPayload)
    .select('*');

  if (groupsError) {
    return res.status(500).json({ message: 'No se pudieron crear grupos.' });
  }

  const groupAssignments = [];
  shuffledTeams.forEach((team, index) => {
    const groupIndex = index % groupCount;
    const slotIndex = Math.floor(index / groupCount);
    groupAssignments.push({
      tournament_id: tournament.id,
      group_id: createdGroups[groupIndex].id,
      team_id: team.id,
      slot_index: slotIndex
    });
  });

  const { error: assignmentError } = await supabase
    .from('tournament_group_teams')
    .insert(groupAssignments);

  if (assignmentError) {
    return res.status(500).json({ message: 'No se pudieron asignar equipos.' });
  }

  const matchesPayload = [];
  createdGroups.forEach((group) => {
    const groupTeamIds = groupAssignments
      .filter((assignment) => assignment.group_id === group.id)
      .map((assignment) => assignment.team_id);
    const rounds = roundRobin(groupTeamIds);
    rounds.forEach((round, roundIndex) => {
      round.forEach((match, matchIndex) => {
        matchesPayload.push({
          tournament_id: tournament.id,
          group_id: group.id,
          round_index: roundIndex + 1,
          match_index: matchIndex,
          home_team_id: match.home,
          away_team_id: match.away
        });
      });
    });
  });

  if (matchesPayload.length) {
    const { error: matchesError } = await supabase
      .from('tournament_matches')
      .insert(matchesPayload);

    if (matchesError) {
      return res.status(500).json({ message: 'No se pudieron crear partidos.' });
    }
  }

  await supabase
    .from('tournaments')
    .update({ stage: 'group_fixtures', group_count: groupCount })
    .eq('id', tournament.id);

  const updated = await getTournamentState();
  return res.json(updated);
});

app.post('/api/admin/tournament/matches/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { homeScore, awayScore } = req.body || {};

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
    return res.status(400).json({ message: 'Puntajes invalidos.' });
  }

  const { error } = await supabase
    .from('tournament_matches')
    .update({ home_score: homeScore, away_score: awayScore })
    .eq('id', id);

  if (error) {
    return res.status(500).json({ message: 'No se pudo guardar el resultado.' });
  }

  const updated = await getTournamentState();
  return res.json(updated);
});

app.post('/api/admin/tournament/bracket', requireAuth, async (req, res) => {
  const { matches } = req.body || {};
  const state = await getTournamentState();
  const { tournament } = state;

  if (!tournament) {
    return res.status(400).json({ message: 'No hay torneo activo.' });
  }

  if (!Array.isArray(matches) || matches.length === 0) {
    return res.status(400).json({ message: 'No hay partidos para la llave.' });
  }

  const payload = matches.map((match) => ({
    tournament_id: tournament.id,
    round_index: match.round_index,
    match_index: match.match_index,
    bracket_type: match.bracket_type || 'main',
    home_team_id: match.home_team_id || null,
    away_team_id: match.away_team_id || null
  }));

  const { error } = await supabase.from('tournament_bracket_matches').insert(payload);

  if (error) {
    return res.status(500).json({ message: 'No se pudo crear la llave.' });
  }

  const { data: mainMatches } = await supabase
    .from('tournament_bracket_matches')
    .select('*')
    .eq('tournament_id', tournament.id)
    .eq('bracket_type', 'main');

  const maxRound = Math.max(...mainMatches.map((item) => item.round_index));
  for (const match of mainMatches) {
    const hasHome = Boolean(match.home_team_id);
    const hasAway = Boolean(match.away_team_id);
    if (match.winner_team_id || (hasHome && hasAway) || (!hasHome && !hasAway)) {
      continue;
    }
    const winnerId = hasHome ? match.home_team_id : match.away_team_id;
    await supabase
      .from('tournament_bracket_matches')
      .update({ winner_team_id: winnerId })
      .eq('id', match.id);

    if (match.round_index < maxRound) {
      const nextRound = match.round_index + 1;
      const nextMatchIndex = Math.floor(match.match_index / 2);
      const isHome = match.match_index % 2 === 0;
      await supabase
        .from('tournament_bracket_matches')
        .update(isHome ? { home_team_id: winnerId } : { away_team_id: winnerId })
        .eq('tournament_id', tournament.id)
        .eq('round_index', nextRound)
        .eq('match_index', nextMatchIndex);
    }
  }

  await supabase
    .from('tournaments')
    .update({ stage: 'playoffs' })
    .eq('id', tournament.id);

  const updated = await getTournamentState();
  return res.json(updated);
});

app.post('/api/admin/tournament/bracket/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { homeScore, awayScore } = req.body || {};

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
    return res.status(400).json({ message: 'Puntajes invalidos.' });
  }

  const { data: match, error } = await supabase
    .from('tournament_bracket_matches')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !match) {
    return res.status(404).json({ message: 'Partido no encontrado.' });
  }

  if (homeScore === awayScore) {
    return res.status(400).json({ message: 'No puede haber empate.' });
  }

  const winnerId = homeScore > awayScore ? match.home_team_id : match.away_team_id;

  await supabase
    .from('tournament_bracket_matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      winner_team_id: winnerId
    })
    .eq('id', id);

  if (match.bracket_type === 'main') {
    const { data: allMatches } = await supabase
      .from('tournament_bracket_matches')
      .select('*')
      .eq('tournament_id', match.tournament_id)
      .eq('bracket_type', 'main');

    const maxRound = Math.max(...allMatches.map((item) => item.round_index));
    if (match.round_index < maxRound) {
      const nextRound = match.round_index + 1;
      const nextMatchIndex = Math.floor(match.match_index / 2);
      const isHome = match.match_index % 2 === 0;

      await supabase
        .from('tournament_bracket_matches')
        .update(isHome ? { home_team_id: winnerId } : { away_team_id: winnerId })
        .eq('tournament_id', match.tournament_id)
        .eq('round_index', nextRound)
        .eq('match_index', nextMatchIndex);
    }

    const semifinalRound = maxRound - 1;
    if (match.round_index === semifinalRound) {
      const semis = allMatches.filter(
        (item) => item.round_index === semifinalRound
      );
      const allDone = semis.every((item) => item.winner_team_id);
      if (allDone) {
        const losers = semis.map((item) =>
          item.winner_team_id === item.home_team_id
            ? item.away_team_id
            : item.home_team_id
        );
        await supabase
          .from('tournament_bracket_matches')
          .update({ home_team_id: losers[0], away_team_id: losers[1] })
          .eq('tournament_id', match.tournament_id)
          .eq('bracket_type', 'third_place');
      }
    }
  }

  const updated = await getTournamentState();
  return res.json(updated);
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
