/**
 * Seed: popula roster_teams e roster_players a partir do roster.json
 * Executar: npm run seed
 */
const path = require('path')
const pool = require('./pool')
const rosterData = require(path.join(__dirname, '../../../roster.json'))

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let totalTimes = 0
    let totalJogadores = 0

    for (const time of rosterData.times) {
      // Upsert do time
      await client.query(
        `
        INSERT INTO roster_teams (temporada, nome_completo, abreviacao)
        VALUES ($1, $2, $3)
        ON CONFLICT (abreviacao) DO UPDATE
          SET nome_completo = EXCLUDED.nome_completo,
              temporada     = EXCLUDED.temporada
      `,
        [rosterData.temporada, time.nomeCompleto, time.abreviacao]
      )
      totalTimes++

      // Upsert de cada jogador
      for (const jogador of time.jogadores) {
        await client.query(
          `
          INSERT INTO roster_players (temporada, team_abrev, team_nome, player_name)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (temporada, team_abrev, player_name) DO UPDATE
            SET team_nome = EXCLUDED.team_nome
        `,
          [rosterData.temporada, time.abreviacao, time.nomeCompleto, jogador]
        )
        totalJogadores++
      }

      console.log(
        `  [SEED] ${time.abreviacao} — ${time.jogadores.length} jogadores inseridos`
      )
    }

    await client.query('COMMIT')
    console.log(
      `\n[SEED] Concluído: ${totalTimes} times | ${totalJogadores} jogadores`
    )
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[SEED] Erro:', err.message)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch(() => process.exit(1))
