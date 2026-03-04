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

    // Tabela nba_teams (roster scraper — dados completos do site)
    await client.query(`
      CREATE TABLE IF NOT EXISTS nba_teams (
        id            SERIAL PRIMARY KEY,
        team_id       INTEGER UNIQUE,
        full_name     VARCHAR(100) NOT NULL,
        abbreviation  VARCHAR(5)   NOT NULL UNIQUE,
        city          VARCHAR(50),
        nickname      VARCHAR(50),
        conference    VARCHAR(20),
        division      VARCHAR(30),
        scraped_at    TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('[MIGRATE] Tabela nba_teams OK')

    // Tabela nba_players (roster scraper — dados completos do site)
    await client.query(`
      CREATE TABLE IF NOT EXISTS nba_players (
        id                SERIAL PRIMARY KEY,
        player_id         INTEGER,
        first_name        VARCHAR(100),
        last_name         VARCHAR(100),
        full_name         VARCHAR(200) NOT NULL,
        team_abbreviation VARCHAR(5),
        number            VARCHAR(10),
        position          VARCHAR(20),
        height            VARCHAR(10),
        weight            VARCHAR(20),
        last_attended     VARCHAR(100),
        country           VARCHAR(100),
        headshot_url      TEXT,
        scraped_at        TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('[MIGRATE] Tabela nba_players OK')

    // Índices nba_players
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nba_players_team
        ON nba_players (team_abbreviation);
      CREATE INDEX IF NOT EXISTS idx_nba_players_name
        ON nba_players (full_name);
    `)
    console.log('[MIGRATE] Índices nba_players criados OK')

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
