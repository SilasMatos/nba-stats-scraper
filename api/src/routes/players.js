/**
 * Rotas de jogadores
 * GET /api/players/:name               — stats de temporada do jogador
 * GET /api/players/:name/boxscores     — últimos jogos
 * GET /api/players/:name/props         — análise de props para apostas
 * GET /api/players/team/:team          — todos os jogadores de um time
 */
const router = require('express').Router()
const pool = require('../db/pool')

const round = (v, n = 1) => (v == null ? null : +parseFloat(v).toFixed(n))

// ── GET /api/players/team/:team ──────────────────────────────────────
router.get('/team/:team', async (req, res) => {
  const team = req.params.team.toUpperCase()
  try {
    const { rows } = await pool.query(
      `
      SELECT
        rp.player_name,
        rp.team_abrev,
        rp.team_nome,
        apc.games, apc.minutes,
        ROUND(apc.minutes::NUMERIC / NULLIF(apc.games, 0), 1)    AS mpg,
        ROUND(apc.points::NUMERIC  / NULLIF(apc.games, 0), 1)    AS ppg,
        ROUND(apc.total_reb::NUMERIC / NULLIF(apc.games, 0), 1)  AS rpg,
        ROUND(apc.assists::NUMERIC / NULLIF(apc.games, 0), 1)    AS apg,
        ROUND(apc.steals::NUMERIC  / NULLIF(apc.games, 0), 1)    AS spg,
        ROUND(apc.blocks::NUMERIC  / NULLIF(apc.games, 0), 1)    AS bpg,
        ROUND(apc.turnovers::NUMERIC / NULLIF(apc.games, 0), 1)  AS topg,
        ROUND(apc.fg::NUMERIC  / NULLIF(apc.fga, 0) * 100, 1)    AS fg_pct,
        ROUND(apc.fg3::NUMERIC / NULLIF(apc.f3a, 0) * 100, 1)    AS fg3_pct,
        ROUND(apc.ft::NUMERIC  / NULLIF(apc.fta, 0) * 100, 1)    AS ft_pct
      FROM roster_players rp
      LEFT JOIN alphabetical_player_cumulatives apc
        ON apc.player_name ILIKE '%' || SPLIT_PART(rp.player_name, ' ', 2) || '%'
        AND apc.team ILIKE rp.team_abrev
      WHERE rp.team_abrev = $1
      ORDER BY ppg DESC NULLS LAST
    `,
      [team]
    )

    res.json({ team, total: rows.length, jogadores: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/players/:name ───────────────────────────────────────────
router.get('/:name', async (req, res) => {
  const name = req.params.name.replace(/-/g, ' ')
  try {
    const { rows } = await pool.query(
      `
      SELECT
        player_name, team, position, games, minutes,
        ROUND(minutes::NUMERIC / NULLIF(games, 0), 1)        AS mpg,
        points,
        ROUND(points::NUMERIC  / NULLIF(games, 0), 1)        AS ppg,
        total_reb,
        ROUND(total_reb::NUMERIC / NULLIF(games, 0), 1)      AS rpg,
        assists,
        ROUND(assists::NUMERIC / NULLIF(games, 0), 1)        AS apg,
        steals,
        ROUND(steals::NUMERIC  / NULLIF(games, 0), 1)        AS spg,
        blocks,
        ROUND(blocks::NUMERIC  / NULLIF(games, 0), 1)        AS bpg,
        turnovers,
        ROUND(turnovers::NUMERIC / NULLIF(games, 0), 1)      AS topg,
        fg, fga,
        ROUND(fg::NUMERIC  / NULLIF(fga, 0) * 100, 1)        AS fg_pct,
        fg3, f3a,
        ROUND(fg3::NUMERIC / NULLIF(f3a, 0) * 100, 1)        AS fg3_pct,
        ft, fta,
        ROUND(ft::NUMERIC  / NULLIF(fta, 0) * 100, 1)        AS ft_pct,
        ROUND((points + total_reb + assists)::NUMERIC
              / NULLIF(games, 0), 1)                         AS pra_pg
      FROM alphabetical_player_cumulatives
      WHERE player_name ILIKE $1
      ORDER BY games DESC
    `,
      [`%${name}%`]
    )

    if (rows.length === 0)
      return res.status(404).json({ error: `Jogador "${name}" não encontrado` })

    res.json({ total: rows.length, jogadores: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/players/:name/boxscores ────────────────────────────────
router.get('/:name/boxscores', async (req, res) => {
  const name = req.params.name.replace(/-/g, ' ')
  try {
    const { rows } = await pool.query(
      `
      SELECT
        game_date, team, opponent, position, minutes,
        points, total_reb, assists, steals, blocks, turnovers,
        fg, fga,
        ROUND(fg::NUMERIC / NULLIF(fga, 0) * 100, 1)   AS fg_pct,
        fg3, f3a, ft, fta
      FROM latest_boxscore_lines
      WHERE player_name ILIKE $1
      ORDER BY game_date DESC
    `,
      [`%${name}%`]
    )

    res.json({ jogador: name, total_jogos: rows.length, boxscores: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/players/:name/props ─────────────────────────────────────
router.get('/:name/props', async (req, res) => {
  const name = req.params.name.replace(/-/g, ' ')
  try {
    // Stats de temporada
    const { rows: season } = await pool.query(
      `
      SELECT player_name, team, games, points, total_reb, assists,
             steals, blocks, turnovers, fg, fga, fg3, f3a, ft, fta, minutes
      FROM alphabetical_player_cumulatives
      WHERE player_name ILIKE $1
      ORDER BY games DESC LIMIT 1
    `,
      [`%${name}%`]
    )

    // Últimos jogos para desvio padrão
    const { rows: box } = await pool.query(
      `
      SELECT points, total_reb, assists, steals, blocks, turnovers, minutes
      FROM latest_boxscore_lines
      WHERE player_name ILIKE $1
      ORDER BY game_date DESC
    `,
      [`%${name}%`]
    )

    if (!season[0])
      return res.status(404).json({ error: `Jogador "${name}" não encontrado` })

    const s = season[0]
    const g = s.games || 1

    // Médias
    const ppg = round(s.points / g)
    const rpg = round(s.total_reb / g)
    const apg = round(s.assists / g)
    const spg = round(s.steals / g)
    const bpg = round(s.blocks / g)
    const topg = round(s.turnovers / g)
    const mpg = round(s.minutes / g)

    // Desvio padrão a partir dos boxscores
    function stddev(arr, key) {
      const vals = arr.map(r => r[key]).filter(v => v != null)
      if (vals.length < 2) return null
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      const variance =
        vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length
      return round(Math.sqrt(variance))
    }

    function hitRate(arr, key, line) {
      const vals = arr.map(r => r[key]).filter(v => v != null)
      if (!vals.length) return null
      return round((vals.filter(v => v > line).length / vals.length) * 100)
    }

    const ptsStd = stddev(box, 'points')
    const rebStd = stddev(box, 'total_reb')
    const astStd = stddev(box, 'assists')

    res.json({
      jogador: s.player_name,
      time: s.team,
      jogos_temporada: s.games,
      jogos_analisados_boxscore: box.length,

      medias: { ppg, rpg, apg, spg, bpg, topg, mpg },

      eficiencia: {
        fg_pct: round((s.fg / (s.fga || 1)) * 100),
        fg3_pct: round((s.fg3 / (s.f3a || 1)) * 100),
        ft_pct: round((s.ft / (s.fta || 1)) * 100)
      },

      // Análise de consistência
      consistencia: {
        pts_desvio_padrao: ptsStd,
        reb_desvio_padrao: rebStd,
        ast_desvio_padrao: astStd,
        pts_coef_variacao: ppg ? round((ptsStd / ppg) * 100) : null,
        reb_coef_variacao: rpg ? round((rebStd / rpg) * 100) : null,
        ast_coef_variacao: apg ? round((astStd / apg) * 100) : null
      },

      // Hit rate para linhas comuns de apostas
      hit_rates: {
        pts_over_10: hitRate(box, 'points', 10),
        pts_over_15: hitRate(box, 'points', 15),
        pts_over_20: hitRate(box, 'points', 20),
        pts_over_25: hitRate(box, 'points', 25),
        pts_over_30: hitRate(box, 'points', 30),
        reb_over_4: hitRate(box, 'total_reb', 4),
        reb_over_6: hitRate(box, 'total_reb', 6),
        reb_over_8: hitRate(box, 'total_reb', 8),
        ast_over_3: hitRate(box, 'assists', 3),
        ast_over_5: hitRate(box, 'assists', 5),
        ast_over_7: hitRate(box, 'assists', 7),
        pra_over_20: hitRate(
          box.map(r => ({
            pra: (r.points || 0) + (r.total_reb || 0) + (r.assists || 0)
          })),
          'pra',
          20
        ),
        pra_over_30: hitRate(
          box.map(r => ({
            pra: (r.points || 0) + (r.total_reb || 0) + (r.assists || 0)
          })),
          'pra',
          30
        )
      },

      ultimos_jogos: box.slice(0, 10)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
