/**
 * Migration: cria as tabelas roster_teams e roster_players
 * Executar uma vez: npm run migrate
 */
const pool = require('./pool')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Tabela de times do roster
    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_teams (
        id          SERIAL PRIMARY KEY,
        temporada   VARCHAR(20)  NOT NULL DEFAULT '2025-2026',
        nome_completo VARCHAR(100) NOT NULL,
        abreviacao  VARCHAR(5)   NOT NULL UNIQUE,
        created_at  TIMESTAMP    DEFAULT NOW()
      );
    `)
    console.log('[MIGRATE] Tabela roster_teams OK')

    // Tabela de jogadores do roster
    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_players (
        id            SERIAL PRIMARY KEY,
        temporada     VARCHAR(20)  NOT NULL DEFAULT '2025-2026',
        team_abrev    VARCHAR(5)   NOT NULL,
        team_nome     VARCHAR(100) NOT NULL,
        player_name   VARCHAR(100) NOT NULL,
        created_at    TIMESTAMP    DEFAULT NOW(),
        UNIQUE (temporada, team_abrev, player_name)
      );
    `)
    console.log('[MIGRATE] Tabela roster_players OK')

    // Índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roster_players_team
        ON roster_players (team_abrev);
      CREATE INDEX IF NOT EXISTS idx_roster_players_name
        ON roster_players (player_name);
    `)
    console.log('[MIGRATE] Índices criados OK')

    await client.query('COMMIT')
    console.log('[MIGRATE] Migration concluída com sucesso!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[MIGRATE] Erro:', err.message)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(() => process.exit(1))
