const path = require('path')
const { Pool } = require('pg')

// Carrega .env do diretório raiz do projeto (nba-stats-scraper/)
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') })

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'nba_data',
  user: process.env.DB_USER || 'meuusuario',
  password: process.env.DB_PASSWORD || 'minhasenha'
})

console.log(
  `[DB] Config: host=${process.env.DB_HOST || 'localhost'}, db=${process.env.DB_NAME || 'nba_data'}, user=${process.env.DB_USER || 'meuusuario'}`
)

pool.on('connect', () => {
  console.log('[DB] Conexão estabelecida com PostgreSQL')
})

pool.on('error', err => {
  console.error('[DB] Erro inesperado no pool:', err.message)
})

module.exports = pool
