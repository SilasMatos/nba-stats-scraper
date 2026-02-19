/**
 * Rotas de times
 * GET /api/teams                   — todos os times do roster
 * GET /api/teams/:team             — detalhes completos de um time
 * GET /api/teams/:team/standings   — classificação
 * GET /api/teams/:team/offense     — stats ofensivos
 * GET /api/teams/:team/defense     — stats defensivos
 * GET /api/teams/rankings          — ranking geral para apostas
 */
const router = require('express').Router()
const pool = require('../db/pool')

const round = (v, n = 1) => (v == null ? null : +parseFloat(v).toFixed(n))

// ── GET /api/teams ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        rt.abreviacao,
        rt.nome_completo,
        s.wins, s.losses,
        ROUND(s.pct * 100, 1)                                       AS aprov_pct,
        s.conference,
        s.last_10,
        s.streak,
        r.ppg,
        ROUND(
          od_atq.points::NUMERIC / NULLIF(od_atq.games, 0) -
          od_def.points::NUMERIC / NULLIF(od_def.games, 0), 1
        )                                                           AS net_rating
      FROM roster_teams rt
      LEFT JOIN standings s         ON s.team = rt.abreviacao
      LEFT JOIN ratios_teams r      ON r.team = rt.abreviacao
      LEFT JOIN offensive_defensive od_atq
        ON od_atq.team = rt.abreviacao AND od_atq.stat_type = 'OFFENSE'
      LEFT JOIN offensive_defensive od_def
        ON od_def.team = rt.abreviacao AND od_def.stat_type = 'DEFENSE'
      ORDER BY s.pct DESC NULLS LAST
    `)
    res.json({ total: rows.length, times: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/teams/rankings ──────────────────────────────────────────
router.get('/rankings', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        s.team,
        s.conference,
        ROUND(s.pct * 100, 1)                                          AS aprov_pct,
        s.last_10,
        s.streak,
        rt.ppg,
        ROUND(od_atq.points::NUMERIC / NULLIF(od_atq.games, 0), 1)    AS pts_marcados_pg,
        ROUND(od_def.points::NUMERIC / NULLIF(od_def.games, 0), 1)    AS pts_cedidos_pg,
        ROUND(
          od_atq.points::NUMERIC / NULLIF(od_atq.games, 0) -
          od_def.points::NUMERIC / NULLIF(od_def.games, 0), 1
        )                                                              AS net_rating,
        ROUND(od_atq.fg_pct  * 100, 1)                                 AS fg_pct_atq,
        ROUND(od_atq.fg3_pct * 100, 1)                                 AS fg3_pct_atq,
        ROUND(od_def.fg_pct  * 100, 1)                                 AS fg_pct_def,
        ROUND(
          s.pct * 40 +
          (od_atq.points::NUMERIC / NULLIF(od_atq.games,0) -
           od_def.points::NUMERIC / NULLIF(od_def.games,0)) * 1.5 +
          od_atq.fg_pct * 30, 2
        )                                                              AS betting_score
      FROM standings s
      JOIN ratios_teams rt         ON rt.team = s.team
      JOIN offensive_defensive od_atq ON od_atq.team = s.team AND od_atq.stat_type = 'OFFENSE'
      JOIN offensive_defensive od_def ON od_def.team = s.team AND od_def.stat_type = 'DEFENSE'
      ORDER BY betting_score DESC
    `)
    res.json({ total: rows.length, rankings: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/teams/:team ─────────────────────────────────────────────
router.get('/:team', async (req, res) => {
  const team = req.params.team.toUpperCase()
  try {
    const [
      { rows: stand },
      { rows: ratios },
      { rows: offDef },
      { rows: oppPts },
      { rows: h2h },
      { rows: players }
    ] = await Promise.all([
      pool.query(`SELECT * FROM standings WHERE team = $1 LIMIT 1`, [team]),
      pool.query(`SELECT * FROM ratios_teams WHERE team = $1 LIMIT 1`, [team]),
      pool.query(`SELECT * FROM offensive_defensive WHERE team = $1`, [team]),
      pool.query(
        `SELECT * FROM opponent_points_breakdown WHERE team = $1 LIMIT 1`,
        [team]
      ),
      pool.query(
        `
        SELECT opponent, wins, losses,
               ROUND(wins::NUMERIC / NULLIF(wins + losses, 0) * 100, 1) AS win_pct
        FROM head_to_head_win_grid WHERE team = $1 ORDER BY win_pct DESC
      `,
        [team]
      ),
      pool.query(
        `SELECT player_name FROM roster_players WHERE team_abrev = $1 ORDER BY player_name`,
        [team]
      )
    ])

    const off = offDef.find(r => r.stat_type === 'OFFENSE')
    const def = offDef.find(r => r.stat_type === 'DEFENSE')

    res.json({
      team,
      standings: stand[0] ?? null,
      ratios: ratios[0] ?? null,
      offense: off ?? null,
      defense: def ?? null,
      opponent_points_allowed: oppPts[0] ?? null,
      net_rating:
        off && def && off.games
          ? round(off.points / off.games - def.points / def.games, 2)
          : null,
      head_to_head_record: h2h,
      roster: players.map(p => p.player_name)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/teams/:team/standings ──────────────────────────────────
router.get('/:team/standings', async (req, res) => {
  const team = req.params.team.toUpperCase()
  try {
    const { rows } = await pool.query(
      `SELECT * FROM standings WHERE team = $1 LIMIT 1`,
      [team]
    )
    if (!rows[0])
      return res.status(404).json({ error: `Time "${team}" não encontrado` })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/teams/:team/offense ─────────────────────────────────────
router.get('/:team/offense', async (req, res) => {
  const team = req.params.team.toUpperCase()
  try {
    const { rows } = await pool.query(
      `SELECT * FROM offensive_defensive WHERE team = $1 AND stat_type = 'OFFENSE' LIMIT 1`,
      [team]
    )
    res.json(rows[0] ?? { aviso: 'Sem dados ofensivos' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/teams/:team/defense ─────────────────────────────────────
router.get('/:team/defense', async (req, res) => {
  const team = req.params.team.toUpperCase()
  try {
    const { rows } = await pool.query(
      `SELECT * FROM offensive_defensive WHERE team = $1 AND stat_type = 'DEFENSE' LIMIT 1`,
      [team]
    )
    res.json(rows[0] ?? { aviso: 'Sem dados defensivos' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
