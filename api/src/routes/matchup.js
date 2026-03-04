/**
 * GET /api/matchup/:timeA/vs/:timeB
 *
 * Retorna relatório estatístico completo de um confronto entre dois times.
 * Ex: GET /api/matchup/ATL/vs/MIA
 *
 * Resolve automaticamente as diferentes abreviações/nomes usados em cada
 * tabela do banco de dados via team-resolver.
 */
const router = require('express').Router()
const pool = require('../db/pool')
const { resolve } = require('../helpers/team-resolver')

// ── Helpers ──────────────────────────────────────────────────────────
const round = (v, n = 1) => (v == null ? null : +parseFloat(v).toFixed(n))

async function fetchOne(sql, params) {
  const { rows } = await pool.query(sql, params)
  return rows[0] ?? null
}
async function fetchAll(sql, params) {
  const { rows } = await pool.query(sql, params)
  return rows
}

// ── Standings de um time ─────────────────────────────────────────────
async function getStandings(team) {
  const standingsName = resolve(team, 'standings')
  if (!standingsName) return null

  return fetchOne(
    `
    SELECT team, conference, division, wins, losses,
           pct, games_behind, home_record, road_record, last_10, streak
    FROM standings
    WHERE LOWER(team) = LOWER($1)
    LIMIT 1
  `,
    [standingsName]
  )
}

// ── Offense/Defense de um time ───────────────────────────────────────
async function getOffDef(team) {
  const offdefName = resolve(team, 'offdef')
  if (!offdefName) return { offense: null, defense: null }

  const rows = await fetchAll(
    `
    SELECT stat_type, games, fg, fga, fg_pct, fg3, f3a, fg3_pct,
           ft, fta, ft_pct, off_reb, def_reb, total_reb,
           assists, steals, blocks, turnovers, points
    FROM offensive_defensive
    WHERE LOWER(team) = LOWER($1)
      AND stat_type IN ('OFFENSE', 'DEFENSE')
      AND points IS NOT NULL
    ORDER BY stat_type, id
  `,
    [offdefName]
  )

  const offense = rows.find(r => r.stat_type === 'OFFENSE') ?? null
  const defense = rows.find(r => r.stat_type === 'DEFENSE') ?? null

  // A seção DEFENSE do scraper não inclui a coluna "games",
  // então copiamos o valor do OFFENSE.
  if (defense && !defense.games && offense) {
    defense.games = offense.games
  }

  return { offense, defense }
}

// ── Ratios do time (calculado a partir do offensive_defensive) ───────
// A tabela ratios_teams pode estar vazia, então calculamos a partir
// dos dados de offensive_defensive que sempre existem.
async function getRatiosTeam(team) {
  const offdefName = resolve(team, 'offdef')
  if (!offdefName) return null

  return fetchOne(
    `
    SELECT
      atq.team,
      atq.games,
      ROUND(atq.fg::NUMERIC   / NULLIF(atq.fga, 0), 3)             AS fg_pct,
      ROUND(atq.fg3::NUMERIC  / NULLIF(atq.f3a, 0), 3)             AS fg3_pct,
      ROUND(atq.ft::NUMERIC   / NULLIF(atq.fta, 0), 3)             AS ft_pct,
      ROUND(atq.points::NUMERIC   / NULLIF(atq.games, 0), 1)       AS ppg,
      ROUND(atq.total_reb::NUMERIC / NULLIF(atq.games, 0), 1)      AS rpg,
      ROUND(atq.assists::NUMERIC   / NULLIF(atq.games, 0), 1)      AS apg,
      ROUND(atq.steals::NUMERIC    / NULLIF(atq.games, 0), 1)      AS spg,
      ROUND(atq.blocks::NUMERIC    / NULLIF(atq.games, 0), 1)      AS bpg,
      ROUND(atq.turnovers::NUMERIC / NULLIF(atq.games, 0), 1)      AS topg
    FROM offensive_defensive atq
    WHERE LOWER(atq.team) = LOWER($1)
      AND atq.stat_type = 'OFFENSE'
      AND atq.points IS NOT NULL
    LIMIT 1
  `,
    [offdefName]
  )
}

// ── Opponent Points Breakdown ────────────────────────────────────────
async function getOpponentBreakdown(team) {
  const oppName = resolve(team, 'opp')
  if (!oppName) return null

  return fetchOne(
    `
    SELECT
      team,
      opp_fg,
      opp_fg_pct,
      opp_fg3_pct,
      opp_points
    FROM opponent_points_breakdown
    WHERE LOWER(team) = LOWER($1)
    LIMIT 1
  `,
    [oppName]
  )
}

// ── Head-to-Head ─────────────────────────────────────────────────────
async function getH2H(teamA, teamB) {
  const h2hA = resolve(teamA, 'h2h')
  const h2hB = resolve(teamB, 'h2h')
  if (!h2hA || !h2hB) return null

  return fetchOne(
    `
    SELECT team, opponent, wins, losses,
           ROUND(wins::NUMERIC / NULLIF(wins + losses, 0) * 100, 1) AS win_pct
    FROM head_to_head_win_grid
    WHERE team = $1 AND opponent = $2
    LIMIT 1
  `,
    [h2hA, h2hB]
  )
}

// ── Jogadores do roster de um time ──────────────────────────────────
async function getRosterPlayers(team) {
  return fetchAll(
    `
    SELECT np.full_name AS player_name, nt.full_name AS team_nome
    FROM nba_players np
    JOIN nba_teams nt ON nt.abbreviation = np.team_abbreviation
    WHERE np.team_abbreviation = $1
    ORDER BY np.full_name
  `,
    [team]
  )
}

// ── Stats de temporada dos jogadores do roster ───────────────────────
// Faz JOIN com alphabetical_player_cumulatives usando a abreviação
// correta (APC) e retorna SOMENTE jogadores com dados estatísticos.
// Usa DISTINCT ON para evitar duplicatas de jogadores tradados.
async function getPlayerSeasonStats(team) {
  const apcTeam = resolve(team, 'apc')
  if (!apcTeam) return []

  return fetchAll(
    `
    SELECT DISTINCT ON (np.full_name)
      np.full_name                                                  AS player_name,
      np.team_abbreviation                                          AS team_abrev,
      apc.games,
      apc.minutes,
      ROUND(apc.minutes::NUMERIC / NULLIF(apc.games, 0), 1)        AS mpg,
      apc.points,
      ROUND(apc.points::NUMERIC  / NULLIF(apc.games, 0), 1)        AS ppg,
      apc.total_reb,
      ROUND(apc.total_reb::NUMERIC / NULLIF(apc.games, 0), 1)      AS rpg,
      apc.assists,
      ROUND(apc.assists::NUMERIC / NULLIF(apc.games, 0), 1)        AS apg,
      apc.steals,
      ROUND(apc.steals::NUMERIC  / NULLIF(apc.games, 0), 1)        AS spg,
      apc.blocks,
      ROUND(apc.blocks::NUMERIC  / NULLIF(apc.games, 0), 1)        AS bpg,
      apc.turnovers,
      ROUND(apc.turnovers::NUMERIC / NULLIF(apc.games, 0), 1)      AS topg,
      apc.fg, apc.fga,
      ROUND(apc.fg::NUMERIC  / NULLIF(apc.fga, 0) * 100, 1)        AS fg_pct,
      apc.fg3, apc.f3a,
      ROUND(apc.fg3::NUMERIC / NULLIF(apc.f3a, 0) * 100, 1)        AS fg3_pct,
      apc.ft, apc.fta,
      ROUND(apc.ft::NUMERIC  / NULLIF(apc.fta, 0) * 100, 1)        AS ft_pct,
      ROUND((apc.points + apc.total_reb + apc.assists)::NUMERIC
            / NULLIF(apc.games, 0), 1)                             AS pra_pg
    FROM nba_players np
    INNER JOIN alphabetical_player_cumulatives apc
      ON apc.player_name ILIKE '%' || np.last_name || '%'
      AND apc.team = $2
    WHERE np.team_abbreviation = $1
      AND apc.games IS NOT NULL
      AND apc.games > 0
    ORDER BY np.full_name, apc.games DESC
  `,
    [team, apcTeam]
  )
}

// ── Últimos boxscores de um time ─────────────────────────────────────
async function getRecentBoxscores(team) {
  const boxTeam = resolve(team, 'h2h')
  if (!boxTeam) return []

  return fetchAll(
    `
    SELECT
      lbl.game_date,
      lbl.player_name,
      lbl.opponent,
      lbl.minutes,
      lbl.points,
      lbl.total_reb,
      lbl.assists,
      lbl.steals,
      lbl.blocks,
      lbl.turnovers,
      lbl.fg, lbl.fga,
      ROUND(lbl.fg::NUMERIC / NULLIF(lbl.fga, 0) * 100, 1)  AS fg_pct,
      lbl.fg3, lbl.f3a,
      lbl.ft, lbl.fta
    FROM latest_boxscore_lines lbl
    WHERE lbl.team = $1
    ORDER BY lbl.game_date DESC, lbl.points DESC
    LIMIT 50
  `,
    [boxTeam]
  )
}

// ── Attendance de um time ────────────────────────────────────────────
async function getAttendance(team) {
  const fullName = resolve(team, 'full')
  if (!fullName) return null

  return fetchOne(
    `
    SELECT team, home_games, home_total, home_avg,
           road_games, road_total, road_avg,
           overall_games, overall_total, overall_avg
    FROM attendance
    WHERE team ILIKE $1
    LIMIT 1
  `,
    [`%${fullName}%`]
  )
}

// ── Jogos recentes entre os dois times ───────────────────────────────
async function getRecentMatchups(teamA, teamB) {
  const scoresA = resolve(teamA, 'scores')
  const scoresB = resolve(teamB, 'scores')
  if (!scoresA || !scoresB) return []

  return fetchAll(
    `
    SELECT game_date, away_team, away_score, home_team, home_score,
           away_score + home_score AS total_pts,
           leader_points, leader_rebounds, leader_assists
    FROM latest_scores_and_leaders
    WHERE away_score IS NOT NULL
      AND (
        (LOWER(away_team) = LOWER($1) AND LOWER(home_team) = LOWER($2))
        OR
        (LOWER(away_team) = LOWER($2) AND LOWER(home_team) = LOWER($1))
      )
    ORDER BY game_date DESC
    LIMIT 10
  `,
    [scoresA, scoresB]
  )
}

// ── Net Rating de um time ────────────────────────────────────────────
function calcNetRating(offense, defense) {
  if (!offense || !defense) return null
  const games = offense.games || defense.games
  if (!games) return null
  const ptsMarcados = offense.points / games
  const ptsCedidos = defense.points / games
  return round(ptsMarcados - ptsCedidos, 2)
}

// ── Score composto para apostas ──────────────────────────────────────
function calcBettingScore(standings, netRating, offense) {
  if (!standings || netRating == null || !offense) return null
  return round(
    standings.pct * 40 + netRating * 2 + (offense.fg_pct ?? 0) * 30,
    2
  )
}

// ── Projeção de Total de Pontos (Over/Under) ─────────────────────────
async function getTotalProjection(teamA, teamB, ppgA, ppgB, defA, defB) {
  const gamesA = defA?.games || null
  const gamesB = defB?.games || null
  const ptsCedidosA = defA && gamesA ? defA.points / gamesA : null
  const ptsCedidosB = defB && gamesB ? defB.points / gamesB : null

  const proj =
    ppgA != null && ppgB != null
      ? round(
          (ppgA + ppgB + (ptsCedidosA ?? ppgA) + (ptsCedidosB ?? ppgB)) / 2,
          1
        )
      : null

  // Histórico geral de totais
  const { rows: hist } = await pool.query(`
    SELECT
      COUNT(*)                                                  AS total_jogos,
      ROUND(AVG(away_score + home_score)::NUMERIC, 1)           AS media_total,
      MIN(away_score + home_score)                              AS min_total,
      MAX(away_score + home_score)                              AS max_total,
      COUNT(*) FILTER (WHERE away_score + home_score > 210)     AS over_210,
      COUNT(*) FILTER (WHERE away_score + home_score > 220)     AS over_220,
      COUNT(*) FILTER (WHERE away_score + home_score > 230)     AS over_230,
      COUNT(*) FILTER (WHERE away_score + home_score > 240)     AS over_240
    FROM latest_scores_and_leaders
    WHERE away_score IS NOT NULL
  `)

  const h = hist[0]
  const totalJogos = +h?.total_jogos || 0

  return {
    projecao_ajustada: proj,
    media_historica_liga: h?.media_total ? +h.media_total : null,
    min_historico: h?.min_total,
    max_historico: h?.max_total,
    pct_over_210:
      totalJogos > 0 ? round((h.over_210 / totalJogos) * 100, 1) : null,
    pct_over_220:
      totalJogos > 0 ? round((h.over_220 / totalJogos) * 100, 1) : null,
    pct_over_230:
      totalJogos > 0 ? round((h.over_230 / totalJogos) * 100, 1) : null,
    pct_over_240:
      totalJogos > 0 ? round((h.over_240 / totalJogos) * 100, 1) : null,
    total_jogos_analisados: totalJogos
  }
}

// ── Probabilidade de vitória (modelo simples) ─────────────────────────
function calcWinProbability(netA, netB, h2hPct, aprovCasaPct, aprovForaPct) {
  const netDiff = (netA ?? 0) - (netB ?? 0)
  const netScore = Math.min(Math.max(50 + netDiff * 3, 10), 90)
  const h2hScore = h2hPct ?? 50
  const casaScore = aprovCasaPct ?? 50
  const foraScore = aprovForaPct ?? 50

  const prob = round(
    netScore * 0.4 +
      h2hScore * 0.3 +
      casaScore * 0.15 +
      (100 - foraScore) * 0.15,
    1
  )
  return Math.min(Math.max(prob, 10), 90)
}

// ══════════════════════════════════════════════════════════════════════
//  ENDPOINT PRINCIPAL — GET /api/matchup/:teamA/vs/:teamB
// ══════════════════════════════════════════════════════════════════════
router.get('/:teamA/vs/:teamB', async (req, res) => {
  const teamA = req.params.teamA.toUpperCase().trim()
  const teamB = req.params.teamB.toUpperCase().trim()

  try {
    // ── Busca em paralelo ────────────────────────────────────────────
    const [
      standA,
      standB,
      offDefA,
      offDefB,
      ratioA,
      ratioB,
      h2hAB,
      h2hBA,
      rosterA,
      rosterB,
      playerStatsA,
      playerStatsB,
      boxA,
      boxB,
      oppBreakdownA,
      oppBreakdownB,
      attendA,
      attendB,
      recentMatchups
    ] = await Promise.all([
      getStandings(teamA),
      getStandings(teamB),
      getOffDef(teamA),
      getOffDef(teamB),
      getRatiosTeam(teamA),
      getRatiosTeam(teamB),
      getH2H(teamA, teamB),
      getH2H(teamB, teamA),
      getRosterPlayers(teamA),
      getRosterPlayers(teamB),
      getPlayerSeasonStats(teamA),
      getPlayerSeasonStats(teamB),
      getRecentBoxscores(teamA),
      getRecentBoxscores(teamB),
      getOpponentBreakdown(teamA),
      getOpponentBreakdown(teamB),
      getAttendance(teamA),
      getAttendance(teamB),
      getRecentMatchups(teamA, teamB)
    ])

    // ── Cálculos compostos ───────────────────────────────────────────
    const netA = calcNetRating(offDefA.offense, offDefA.defense)
    const netB = calcNetRating(offDefB.offense, offDefB.defense)

    const scoreA = calcBettingScore(standA, netA, offDefA.offense)
    const scoreB = calcBettingScore(standB, netB, offDefB.offense)

    // Aproveitamento em casa/fora (aceita formato "14-16" ou "14- 16")
    let aprovCasaA = null,
      aprovForaB = null
    if (standA?.home_record) {
      const m = standA.home_record.replace(/\s/g, '').match(/^(\d+)-(\d+)$/)
      if (m) {
        const [, v, d] = m.map(Number)
        aprovCasaA = round((v / (v + d)) * 100, 1)
      }
    }
    if (standB?.road_record) {
      const m = standB.road_record.replace(/\s/g, '').match(/^(\d+)-(\d+)$/)
      if (m) {
        const [, v, d] = m.map(Number)
        aprovForaB = round((v / (v + d)) * 100, 1)
      }
    }

    // Win probability (A = casa, B = visitante)
    const probWinA = calcWinProbability(
      netA,
      netB,
      h2hAB?.win_pct ? +h2hAB.win_pct : null,
      aprovCasaA,
      aprovForaB
    )

    // Projeção Over/Under
    const ppgA = ratioA?.ppg ? +ratioA.ppg : null
    const ppgB = ratioB?.ppg ? +ratioB.ppg : null
    const totalProj = await getTotalProjection(
      teamA,
      teamB,
      ppgA,
      ppgB,
      offDefA.defense,
      offDefB.defense
    )

    // ── Nome completo (de nba_teams) ─────────────────────────────────
    const nomeA = resolve(teamA, 'full') ?? rosterA[0]?.team_nome ?? teamA
    const nomeB = resolve(teamB, 'full') ?? rosterB[0]?.team_nome ?? teamB

    // ── Ordenar jogadores por ppg DESC ───────────────────────────────
    const sortByPpg = (a, b) => (+b.ppg || 0) - (+a.ppg || 0)
    playerStatsA.sort(sortByPpg)
    playerStatsB.sort(sortByPpg)

    // ── Resposta final ───────────────────────────────────────────────
    res.json({
      confronto: `${teamA} vs ${teamB}`,
      gerado_em: new Date().toISOString(),

      // ---------- TIMES ----------
      times: {
        [teamA]: {
          abreviacao: teamA,
          nome_completo: nomeA,
          standings: standA,
          ratios: ratioA,
          offense: offDefA.offense,
          defense: offDefA.defense,
          net_rating: netA,
          aprov_casa_pct: aprovCasaA,
          opp_breakdown: oppBreakdownA,
          attendance: attendA,
          betting_score: scoreA
        },
        [teamB]: {
          abreviacao: teamB,
          nome_completo: nomeB,
          standings: standB,
          ratios: ratioB,
          offense: offDefB.offense,
          defense: offDefB.defense,
          net_rating: netB,
          aprov_fora_pct: aprovForaB,
          opp_breakdown: oppBreakdownB,
          attendance: attendB,
          betting_score: scoreB
        }
      },

      // ---------- H2H ----------
      head_to_head: {
        [`${teamA}_vs_${teamB}`]: h2hAB,
        [`${teamB}_vs_${teamA}`]: h2hBA,
        jogos_recentes: recentMatchups
      },

      // ---------- PROBABILIDADES ----------
      probabilidades: {
        prob_vitoria_casa_pct: probWinA,
        prob_vitoria_visitante_pct: round(100 - probWinA, 1),
        favorito: probWinA >= 50 ? teamA : teamB,
        modelo: 'NetRating(40%) + H2H(30%) + PercCasa(15%) + PercFora(15%)'
      },

      // ---------- OVER/UNDER ----------
      over_under: totalProj,

      // ---------- STATS DE JOGADORES (somente com dados) ----------
      jogadores: {
        [teamA]: playerStatsA,
        [teamB]: playerStatsB
      },

      // ---------- ROSTER OFICIAL ----------
      roster: {
        [teamA]: rosterA,
        [teamB]: rosterB
      },

      // ---------- BOXSCORES RECENTES ----------
      boxscores_recentes: {
        [teamA]: boxA,
        [teamB]: boxB
      }
    })
  } catch (err) {
    console.error(`[MATCHUP] Erro:`, err)
    res.status(500).json({
      error: 'Erro ao processar a requisição',
      details: err.message || String(err),
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    })
  }
})

// ── GET /api/matchup/:teamA/vs/:teamB/summary — versão resumida ──────
router.get('/:teamA/vs/:teamB/summary', async (req, res) => {
  const teamA = req.params.teamA.toUpperCase().trim()
  const teamB = req.params.teamB.toUpperCase().trim()

  try {
    const [standA, standB, offDefA, offDefB, ratioA, ratioB, h2hAB] =
      await Promise.all([
        getStandings(teamA),
        getStandings(teamB),
        getOffDef(teamA),
        getOffDef(teamB),
        getRatiosTeam(teamA),
        getRatiosTeam(teamB),
        getH2H(teamA, teamB)
      ])

    const netA = calcNetRating(offDefA.offense, offDefA.defense)
    const netB = calcNetRating(offDefB.offense, offDefB.defense)

    let aprovCasaA = null,
      aprovForaB = null
    if (standA?.home_record) {
      const m = standA.home_record.replace(/\s/g, '').match(/^(\d+)-(\d+)$/)
      if (m) {
        const [, v, d] = m.map(Number)
        aprovCasaA = round((v / (v + d)) * 100, 1)
      }
    }
    if (standB?.road_record) {
      const m = standB.road_record.replace(/\s/g, '').match(/^(\d+)-(\d+)$/)
      if (m) {
        const [, v, d] = m.map(Number)
        aprovForaB = round((v / (v + d)) * 100, 1)
      }
    }

    const probWinA = calcWinProbability(
      netA,
      netB,
      h2hAB?.win_pct ? +h2hAB.win_pct : null,
      aprovCasaA,
      aprovForaB
    )

    const projTotal =
      ratioA?.ppg && ratioB?.ppg ? round(+ratioA.ppg + +ratioB.ppg, 1) : null

    res.json({
      confronto: `${teamA} vs ${teamB}`,
      [teamA]: {
        record: standA ? `${standA.wins}W-${standA.losses}L` : null,
        pct: standA ? round(standA.pct * 100, 1) : null,
        ppg: ratioA?.ppg,
        net_rating: netA,
        aprov_casa_pct: aprovCasaA,
        last_10: standA?.last_10,
        streak: standA?.streak
      },
      [teamB]: {
        record: standB ? `${standB.wins}W-${standB.losses}L` : null,
        pct: standB ? round(standB.pct * 100, 1) : null,
        ppg: ratioB?.ppg,
        net_rating: netB,
        aprov_fora_pct: aprovForaB,
        last_10: standB?.last_10,
        streak: standB?.streak
      },
      h2h: h2hAB ?? { aviso: 'Sem histórico direto encontrado' },
      prob_vitoria_casa_pct: probWinA,
      prob_vitoria_visitante_pct: round(100 - probWinA, 1),
      favorito: probWinA >= 50 ? teamA : teamB,
      projecao_total_pts: projTotal
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
