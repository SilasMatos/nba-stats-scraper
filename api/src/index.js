require('dotenv').config()
const express = require('express')
const cors = require('cors')

const matchupRoutes = require('./routes/matchup')
const playerRoutes = require('./routes/players')
const teamRoutes = require('./routes/teams')
const leagueRoutes = require('./routes/league')

const app = express()
const PORT = process.env.PORT || 3000

// ── Middlewares ──────────────────────────────────────────────────────
app.use(cors())
app.use(express.json())

// Log de requisições
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
  next()
})

// ── Rotas ────────────────────────────────────────────────────────────
app.use('/api/matchup', matchupRoutes)
app.use('/api/players', playerRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api', leagueRoutes) // standings, scores, leaders

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Rota raiz com documentação rápida ────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'NBA Stats API',
    version: '1.0.0',
    endpoints: {
      // ── CONFRONTOS (principal) ──────────────────────────────────
      'GET /api/matchup/:teamA/vs/:teamB':
        'Relatório estatístico completo de um confronto. Ex: /api/matchup/ATL/vs/MIA',
      'GET /api/matchup/:teamA/vs/:teamB/summary':
        'Resumo rápido do confronto com probabilidades',

      // ── JOGADORES ──────────────────────────────────────────────
      'GET /api/players/:name':
        'Stats de temporada de um jogador. Ex: /api/players/Trae-Young',
      'GET /api/players/:name/boxscores': 'Últimos boxscores do jogador',
      'GET /api/players/:name/props':
        'Análise de props com hit rate, desvio padrão e consistência',
      'GET /api/players/team/:team':
        'Todos os jogadores de um time com médias. Ex: /api/players/team/ATL',

      // ── TIMES ──────────────────────────────────────────────────
      'GET /api/teams': 'Lista todos os times com stats resumidas',
      'GET /api/teams/rankings':
        'Ranking de times por score composto para apostas',
      'GET /api/teams/:team':
        'Detalhes completos de um time (off/def/h2h/roster)',
      'GET /api/teams/:team/standings': 'Classificação de um time',
      'GET /api/teams/:team/offense': 'Estatísticas ofensivas',
      'GET /api/teams/:team/defense': 'Estatísticas defensivas',

      // ── LIGA ────────────────────────────────────────────────────
      'GET /api/standings': 'Classificação geral por conferência',
      'GET /api/scores':
        'Últimos resultados com vencedor, margem e total de pts',
      'GET /api/leaders': 'Top 20 líderes de liga agrupados por categoria',
      'GET /api/leaders/:category':
        'Líderes de uma categoria específica. Ex: /api/leaders/scoring',

      // ── OUTROS ─────────────────────────────────────────────────
      'GET /api/health': 'Verificação de saúde da API'
    },

    exemplos_de_uso: [
      'GET /api/matchup/ATL/vs/MIA',
      'GET /api/matchup/LAL/vs/BOS/summary',
      'GET /api/players/Trae-Young/props',
      'GET /api/players/team/LAL',
      'GET /api/teams/rankings',
      'GET /api/standings'
    ],

    times_disponiveis: [
      'ATL',
      'BOS',
      'BKN',
      'CHA',
      'CHI',
      'CLE',
      'DAL',
      'DEN',
      'DET',
      'GSW',
      'HOU',
      'IND',
      'LAC',
      'LAL',
      'MEM',
      'MIA',
      'MIL',
      'MIN',
      'NOP',
      'NYK',
      'OKC',
      'ORL',
      'PHI',
      'PHX',
      'POR',
      'SAC',
      'SAS',
      'TOR',
      'UTA',
      'WAS'
    ]
  })
})

// ── 404 ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res
    .status(404)
    .json({
      error: 'Rota não encontrada. Acesse / para ver os endpoints disponíveis.'
    })
})

// ── Error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message)
  res
    .status(500)
    .json({ error: 'Erro interno do servidor', details: err.message })
})

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏀 NBA Stats API rodando em http://localhost:${PORT}`)
  console.log(`   Documentação: http://localhost:${PORT}/`)
  console.log(
    `   Exemplo:      http://localhost:${PORT}/api/matchup/ATL/vs/MIA\n`
  )
})
