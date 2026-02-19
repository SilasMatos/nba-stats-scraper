/**
 * GET /api/matchup/:timeA/vs/:timeB
 *
 * Retorna relatório estatístico completo de um confronto entre dois times.
 * Ex: GET /api/matchup/ATL/vs/MIA
 */
const router = require('express').Router()
const pool = require('../db/pool')

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
  return fetchOne(
    `
    SELECT team, conference, division, wins, losses,
           pct, games_behind, home_record, road_record, last_10, streak
    FROM standings
    WHERE team = $1
    LIMIT 1
  `,
    [team]
  )
}

// ── Offense/Defense de um time ───────────────────────────────────────
async function getOffDef(team) {
  const rows = await fetchAll(
    `
    SELECT stat_type, games, fg, fga, fg_pct, fg3, f3a, fg3_pct,
           ft, fta, ft_pct, off_reb, def_reb, total_reb,
           assists, steals, blocks, turnovers, points
    FROM offensive_defensive
    WHERE team = $1
  `,
    [team]
  )
  return {
    offense: rows.find(r => r.stat_type === 'OFFENSE') ?? null,
    defense: rows.find(r => r.stat_type === 'DEFENSE') ?? null
  }
}

// ── Ratios do time ───────────────────────────────────────────────────
async function getRatiosTeam(team) {
  return fetchOne(
    `
    SELECT team, games, wins, losses, fg_pct, fg3_pct, ft_pct,
           ppg, rpg, apg
    FROM ratios_teams
    WHERE team = $1
    LIMIT 1
  `,
    [team]
  )
}

// ── Head-to-Head ─────────────────────────────────────────────────────
async function getH2H(teamA, teamB) {
  return fetchOne(
    `
    SELECT team, opponent, wins, losses,
           ROUND(wins::NUMERIC / NULLIF(wins + losses, 0) * 100, 1) AS win_pct
    FROM head_to_head_win_grid
    WHERE team = $1 AND opponent = $2
    LIMIT 1
  `,
    [teamA, teamB]
  )
}

// ── Jogadores do roster de um time ──────────────────────────────────
async function getRosterPlayers(team) {
  return fetchAll(
    `
    SELECT player_name, team_nome
    FROM roster_players
    WHERE team_abrev = $1
    ORDER BY player_name
  `,
    [team]
  )
}

// ── Stats de temporada dos jogadores do roster ───────────────────────
async function getPlayerSeasonStats(team) {
  return fetchAll(
    `
    SELECT
      rp.player_name,
      rp.team_abrev,
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
    FROM roster_players rp
    LEFT JOIN alphabetical_player_cumulatives apc
      ON apc.player_name ILIKE '%' || SPLIT_PART(rp.player_name, ' ', 2) || '%'
      AND apc.team ILIKE rp.team_abrev
    WHERE rp.team_abrev = $1
    ORDER BY ppg DESC NULLS LAST
  `,
    [team]
  )
}

// ── Últimos boxscores de um time ─────────────────────────────────────
async function getRecentBoxscores(team) {
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
    [team]
  )
}

// ── Net Rating de um time ────────────────────────────────────────────
function calcNetRating(offense, defense) {
  if (!offense || !defense || !offense.games) return null
  const ptsMarcados = offense.points / offense.games
  const ptsCedidos = defense.points / defense.games
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
  // Projeção base: média ataque dos dois times
  const ptsCedidosA = defA && defA.games ? defA.points / defA.games : null
  const ptsCedidosB = defB && defB.games ? defB.points / defB.games : null

  const proj =
    ppgA != null && ppgB != null
      ? round(
          (ppgA + ppgB + (ptsCedidosA ?? ppgA) + (ptsCedidosB ?? ppgB)) / 2,
          1
        )
      : null

  // Histórico de totais
  const { rows: hist } = await pool.query(`
    SELECT
      COUNT(*)                                                  AS total_jogos,
      ROUND(AVG(away_score + home_score)::NUMERIC, 1)           AS media_total,
      MIN(away_score + home_score)                              AS min_total,
      MAX(away_score + home_score)                              AS max_total,
      COUNT(*) FILTER (WHERE away_score + home_score > 220)     AS over_220,
      COUNT(*) FILTER (WHERE away_score + home_score > 230)     AS over_230
    FROM latest_scores_and_leaders
    WHERE away_score IS NOT NULL
  `)

  const h = hist[0]
  return {
    projecao_ajustada: proj,
    media_historica_liga: h?.media_total ? +h.media_total : null,
    min_historico: h?.min_total,
    max_historico: h?.max_total,
    pct_over_220:
      h?.total_jogos > 0 ? round((h.over_220 / h.total_jogos) * 100, 1) : null,
    pct_over_230:
      h?.total_jogos > 0 ? round((h.over_230 / h.total_jogos) * 100, 1) : null,
    total_jogos_analisados: +h?.total_jogos || 0
  }
}

// ── Probabilidade de vitória (modelo simples) ─────────────────────────
function calcWinProbability(netA, netB, h2hPct, aprovCasaPct, aprovForaPct) {
  // Composição: 40% net rating, 30% H2H, 15% aprov casa, 15% aprov fora
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
      boxB
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
      getRecentBoxscores(teamB)
    ])

    // ── Cálculos compostos ───────────────────────────────────────────
    const netA = calcNetRating(offDefA.offense, offDefA.defense)
    const netB = calcNetRating(offDefB.offense, offDefB.defense)

    const scoreA = calcBettingScore(standA, netA, offDefA.offense)
    const scoreB = calcBettingScore(standB, netB, offDefB.offense)

    // Aproveitamento em casa/fora
    let aprovCasaA = null,
      aprovForaB = null
    if (standA?.home_record?.match(/^(\d+)-(\d+)$/)) {
      const [v, d] = standA.home_record.split('-').map(Number)
      aprovCasaA = round((v / (v + d)) * 100, 1)
    }
    if (standB?.road_record?.match(/^(\d+)-(\d+)$/)) {
      const [v, d] = standB.road_record.split('-').map(Number)
      aprovForaB = round((v / (v + d)) * 100, 1)
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
    const totalProj = await getTotalProjection(
      teamA,
      teamB,
      ratioA?.ppg ? +ratioA.ppg : null,
      ratioB?.ppg ? +ratioB.ppg : null,
      offDefA.defense,
      offDefB.defense
    )

    // ── Resposta final ───────────────────────────────────────────────
    res.json({
      confronto: `${teamA} vs ${teamB}`,
      gerado_em: new Date().toISOString(),

      // ---------- TIMES ----------
      times: {
        [teamA]: {
          abreviacao: teamA,
          nome_completo: rosterA[0]?.team_nome ?? teamA,
          standings: standA,
          ratios: ratioA,
          offense: offDefA.offense,
          defense: offDefA.defense,
          net_rating: netA,
          aprov_casa_pct: aprovCasaA,
          betting_score: scoreA
        },
        [teamB]: {
          abreviacao: teamB,
          nome_completo: rosterB[0]?.team_nome ?? teamB,
          standings: standB,
          ratios: ratioB,
          offense: offDefB.offense,
          defense: offDefB.defense,
          net_rating: netB,
          aprov_fora_pct: aprovForaB,
          betting_score: scoreB
        }
      },

      // ---------- H2H ----------
      head_to_head: {
        [`${teamA}_vs_${teamB}`]: h2hAB,
        [`${teamB}_vs_${teamA}`]: h2hBA
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

      // ---------- ROSTER & STATS DE JOGADORES ----------
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
    console.error(`[MATCHUP] Erro: ${err.message}`)
    res
      .status(500)
      .json({ error: 'Erro ao processar a requisição', details: err.message })
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
    if (standA?.home_record?.match(/^(\d+)-(\d+)$/)) {
      const [v, d] = standA.home_record.split('-').map(Number)
      aprovCasaA = round((v / (v + d)) * 100, 1)
    }
    if (standB?.road_record?.match(/^(\d+)-(\d+)$/)) {
      const [v, d] = standB.road_record.split('-').map(Number)
      aprovForaB = round((v / (v + d)) * 100, 1)
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
