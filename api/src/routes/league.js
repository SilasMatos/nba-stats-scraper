/**
 * Rotas de standings e líderes de liga
 * GET /api/standings              — classificação completa
 * GET /api/leaders                — top líderes de liga
 * GET /api/leaders/:category      — líderes de uma categoria
 * GET /api/scores                 — últimos resultados
 */
const router = require('express').Router()
const pool = require('../db/pool')

// ── GET /api/standings ───────────────────────────────────────────────
router.get('/standings', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT conference, division, team, wins, losses,
             ROUND(pct * 100, 1) AS aprov_pct,
             games_behind, home_record, road_record, last_10, streak
      FROM standings
      ORDER BY conference, pct DESC
    `)
    res.json({ total: rows.length, standings: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/scores ──────────────────────────────────────────────────
router.get('/scores', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        game_date, away_team, away_score, home_team, home_score,
        CASE WHEN away_score > home_score THEN away_team ELSE home_team END  AS vencedor,
        ABS(away_score - home_score)                                         AS margem,
        away_score + home_score                                              AS total_pts,
        leader_points, leader_rebounds, leader_assists
      FROM latest_scores_and_leaders
      WHERE away_score IS NOT NULL
      ORDER BY game_date DESC
    `)
    res.json({ total: rows.length, jogos: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/leaders ─────────────────────────────────────────────────
router.get('/leaders', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT stat_category, rank, player_name, team, value
      FROM top_20_league_leaders
      ORDER BY stat_category, rank
    `)
    // Agrupa por categoria
    const grouped = {}
    for (const row of rows) {
      if (!grouped[row.stat_category]) grouped[row.stat_category] = []
      grouped[row.stat_category].push(row)
    }
    res.json({ categorias: Object.keys(grouped).length, leaders: grouped })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/leaders/:category ──────────────────────────────────────
router.get('/leaders/:category', async (req, res) => {
  const cat = req.params.category.replace(/-/g, ' ')
  try {
    const { rows } = await pool.query(
      `
      SELECT stat_category, rank, player_name, team, value
      FROM top_20_league_leaders
      WHERE stat_category ILIKE $1
      ORDER BY rank
    `,
      [`%${cat}%`]
    )
    res.json({ categoria: cat, total: rows.length, leaders: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
