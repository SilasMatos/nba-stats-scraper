/**
 * ══════════════════════════════════════════════════════════════════════
 *  ROTA DE CONFRONTO POR NOME COMPLETO DOS TIMES
 *
 *  GET /api/confronto/:timeCasa/vs/:timeFora
 *    → Aceita nomes completos (slug com hífens) OU abreviações
 *    → Ex: /api/confronto/Houston-Rockets/vs/Los-Angeles-Lakers
 *    → Ex: /api/confronto/HOU/vs/LAL
 *
 *  GET /api/confronto/times
 *    → Lista todos os times com nome completo + abreviação (de-para)
 *
 *  Retorna análise completa baseada em consultas_apostas.sql:
 *    §2  Classificação e forma atual
 *    §3  Desempenho ofensivo e defensivo
 *    §4  Head-to-Head
 *    §5  Eficiência de arremessos
 *    §7  Projeção Over/Under
 *    §8  Probabilidade de vitória
 *    §9  Props de jogadores (pts/reb/ast)
 *    §10 Boxscores recentes
 *    §11 Consistência de jogadores
 *    §13 Pressão de público (Attendance)
 *    §14 Jogadores vs defesa adversária
 *    §15 Scorecard para apostas
 * ══════════════════════════════════════════════════════════════════════
 */
const router = require('express').Router()
const pool = require('../db/pool')

// ── Helpers ──────────────────────────────────────────────────────────
const round = (v, n = 1) => (v == null ? null : +parseFloat(v).toFixed(n))

async function fetchOne(sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows[0] ?? null
}
async function fetchAll(sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows
}

// ══════════════════════════════════════════════════════════════════════
//  DE-PARA: RESOLUÇÃO DE NOMES → ABREVIAÇÃO
//
//  O lookup funciona em 3 camadas:
//    1. Já é uma abreviação válida (2-3 letras)  → busca em nba_teams
//    2. Nome completo exato no banco             → busca em nba_teams
//    3. Busca parcial (ILIKE) no banco           → busca em nba_teams
//
//  Tabela usada: nba_teams (full_name, abbreviation)
// ══════════════════════════════════════════════════════════════════════
async function resolverTime(nomeOuAbrev) {
  // Normaliza: remove hífens do slug, trim
  const nome = nomeOuAbrev.replace(/-/g, ' ').trim()

  // 1) Se parece ser abreviação (2-3 letras maiúsculas)
  if (/^[A-Z]{2,3}$/i.test(nome)) {
    const abrev = nome.toUpperCase()
    const found = await fetchOne(
      `SELECT full_name, abbreviation FROM nba_teams WHERE abbreviation = $1`,
      [abrev]
    )
    if (found)
      return {
        nome_completo: found.full_name,
        abreviacao: found.abbreviation
      }
  }

  // 2) Busca por nome completo exato (case-insensitive)
  const exato = await fetchOne(
    `SELECT full_name, abbreviation FROM nba_teams WHERE full_name ILIKE $1`,
    [nome]
  )
  if (exato)
    return { nome_completo: exato.full_name, abreviacao: exato.abbreviation }

  // 3) Busca parcial — por cidade, apelido ou parte do nome
  const parcial = await fetchOne(
    `SELECT full_name, abbreviation FROM nba_teams
     WHERE full_name ILIKE $1 OR full_name ILIKE $2
        OR city ILIKE $1 OR nickname ILIKE $1
     LIMIT 1`,
    [`%${nome}%`, `${nome}%`]
  )
  if (parcial)
    return {
      nome_completo: parcial.full_name,
      abreviacao: parcial.abbreviation
    }

  return null
}

// ══════════════════════════════════════════════════════════════════════
//  QUERIES — Cada função mapeia uma seção do consultas_apostas.sql
// ══════════════════════════════════════════════════════════════════════

// §2 — Classificação e forma atual do time
async function getClassificacao(abrev) {
  return fetchOne(
    `
    SELECT
      team, conference, division, wins, losses,
      ROUND(pct::NUMERIC * 100, 1)   AS aproveitamento_pct,
      games_behind                    AS jogos_atras_lider,
      home_record                     AS record_casa,
      road_record                     AS record_fora,
      last_10                         AS ultimos_10,
      streak                          AS sequencia_atual
    FROM standings
    WHERE team = $1
    LIMIT 1
  `,
    [abrev]
  )
}

// §3 — Desempenho ofensivo
async function getAtaque(abrev) {
  return fetchOne(
    `
    SELECT
      od.team, od.games,
      ROUND(od.points::NUMERIC / NULLIF(od.games, 0), 1)  AS pts_marcados_pg,
      od.fg, od.fga,
      ROUND(od.fg_pct  * 100, 1)   AS fg_pct,
      od.fg3, od.f3a,
      ROUND(od.fg3_pct * 100, 1)   AS fg3_pct,
      od.ft, od.fta,
      ROUND(od.ft_pct  * 100, 1)   AS ft_pct,
      od.off_reb, od.def_reb, od.total_reb,
      od.assists, od.steals, od.blocks, od.turnovers, od.points
    FROM offensive_defensive od
    WHERE od.team = $1 AND od.stat_type = 'OFFENSE'
    LIMIT 1
  `,
    [abrev]
  )
}

// §3 — Desempenho defensivo
async function getDefesa(abrev) {
  return fetchOne(
    `
    SELECT
      od.team, od.games,
      ROUND(od.points::NUMERIC / NULLIF(od.games, 0), 1)  AS pts_sofridos_pg,
      ROUND(od.fg_pct  * 100, 1)   AS fg_pct_adversario,
      ROUND(od.fg3_pct * 100, 1)   AS fg3_pct_adversario,
      od.steals                     AS roubos_bola,
      od.blocks                     AS tocos,
      od.off_reb, od.def_reb, od.total_reb,
      od.assists, od.turnovers, od.points
    FROM offensive_defensive od
    WHERE od.team = $1 AND od.stat_type = 'DEFENSE'
    LIMIT 1
  `,
    [abrev]
  )
}

// §3.3 — Net rating
async function getNetRating(abrev) {
  return fetchOne(
    `
    SELECT
      atq.team,
      ROUND(atq.points::NUMERIC / NULLIF(atq.games, 0), 1)   AS pts_marcados_pg,
      ROUND(def.points::NUMERIC / NULLIF(def.games, 0), 1)   AS pts_sofridos_pg,
      ROUND(
        atq.points::NUMERIC / NULLIF(atq.games, 0) -
        def.points::NUMERIC / NULLIF(def.games, 0), 1
      )                                                       AS net_points_pg
    FROM offensive_defensive atq
    JOIN offensive_defensive def
      ON atq.team = def.team AND def.stat_type = 'DEFENSE'
    WHERE atq.team = $1 AND atq.stat_type = 'OFFENSE'
    LIMIT 1
  `,
    [abrev]
  )
}

// §3.5 — Pontos cedidos (opponent points breakdown)
async function getOpponentBreakdown(abrev) {
  return fetchOne(
    `
    SELECT
      opb.team,
      ROUND(opb.opp_fg_pct  * 100, 1)   AS fg_pct_adversario,
      ROUND(opb.opp_fg3_pct * 100, 1)   AS fg3_pct_adversario,
      ROUND(opb.opp_ft_pct  * 100, 1)   AS ft_pct_adversario,
      opb.opp_points                      AS total_pts_cedidos,
      opb.opp_fg3                         AS tres_pts_cedidos
    FROM opponent_points_breakdown opb
    WHERE opb.team = $1
    LIMIT 1
  `,
    [abrev]
  )
}

// §4 — Head-to-Head
async function getH2H(abrevA, abrevB) {
  return fetchOne(
    `
    SELECT
      team, opponent,
      wins                                         AS vitorias,
      losses                                       AS derrotas,
      ROUND(
        wins::NUMERIC / NULLIF(wins + losses, 0) * 100, 1
      )                                            AS aproveitamento_h2h_pct
    FROM head_to_head_win_grid
    WHERE team = $1 AND opponent = $2
    LIMIT 1
  `,
    [abrevA, abrevB]
  )
}

// §5 — Ratios do time (eficiência de arremessos)
async function getRatiosTime(abrev) {
  return fetchOne(
    `
    SELECT
      team, games,
      ROUND(fg_pct  * 100, 1) AS fg_pct,
      ROUND(fg3_pct * 100, 1) AS fg3_pct,
      ROUND(ft_pct  * 100, 1) AS ft_pct,
      ppg, rpg, apg
    FROM ratios_teams
    WHERE team = $1
    LIMIT 1
  `,
    [abrev]
  )
}

// §7 — Projeção Over/Under entre dois times
async function getProjecaoOverUnder(abrevCasa, abrevFora) {
  return fetchOne(
    `
    SELECT
      a.team                                  AS time_casa,
      b.team                                  AS time_fora,
      a.ppg                                   AS ppg_casa,
      b.ppg                                   AS ppg_fora,
      ROUND((a.ppg + b.ppg)::NUMERIC, 1)      AS projecao_total_pts,
      ROUND(def_a.points::NUMERIC / NULLIF(def_a.games, 0), 1)  AS pts_cedidos_pg_casa,
      ROUND(def_b.points::NUMERIC / NULLIF(def_b.games, 0), 1)  AS pts_cedidos_pg_fora,
      ROUND(
        (a.ppg + b.ppg +
         def_a.points::NUMERIC / NULLIF(def_a.games, 0) +
         def_b.points::NUMERIC / NULLIF(def_b.games, 0)) / 2, 1
      )                                       AS projecao_ajustada
    FROM ratios_teams a
    JOIN ratios_teams b           ON b.team = $2
    JOIN offensive_defensive def_a
      ON def_a.team = a.team AND def_a.stat_type = 'DEFENSE'
    JOIN offensive_defensive def_b
      ON def_b.team = b.team AND def_b.stat_type = 'DEFENSE'
    WHERE a.team = $1
    LIMIT 1
  `,
    [abrevCasa, abrevFora]
  )
}

// §7.2 — Distribuição histórica de totais na liga
async function getDistribuicaoTotais() {
  return fetchAll(`
    SELECT
      away_score + home_score                        AS total_pts,
      COUNT(*)                                       AS frequencia,
      ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1
      )                                              AS prob_pct
    FROM latest_scores_and_leaders
    WHERE away_score IS NOT NULL
    GROUP BY total_pts
    ORDER BY total_pts
  `)
}

// §7.3 — % de jogos acima de linhas comuns
async function getProbOverUnderLinhas() {
  return fetchOne(`
    SELECT
      COUNT(*)                                                        AS total_jogos,
      ROUND(AVG(away_score + home_score)::NUMERIC, 1)                 AS media_total,
      MIN(away_score + home_score)                                    AS min_total,
      MAX(away_score + home_score)                                    AS max_total,
      COUNT(*) FILTER (WHERE away_score + home_score > 210)           AS over_210,
      ROUND(COUNT(*) FILTER (WHERE away_score + home_score > 210)
            * 100.0 / NULLIF(COUNT(*), 0), 1)                        AS pct_over_210,
      COUNT(*) FILTER (WHERE away_score + home_score > 220)           AS over_220,
      ROUND(COUNT(*) FILTER (WHERE away_score + home_score > 220)
            * 100.0 / NULLIF(COUNT(*), 0), 1)                        AS pct_over_220,
      COUNT(*) FILTER (WHERE away_score + home_score > 230)           AS over_230,
      ROUND(COUNT(*) FILTER (WHERE away_score + home_score > 230)
            * 100.0 / NULLIF(COUNT(*), 0), 1)                        AS pct_over_230
    FROM latest_scores_and_leaders
    WHERE away_score IS NOT NULL
  `)
}

// §8 — Força relativa (moneyline / modelo de probabilidade)
async function getForcaRelativa(abrevCasa, abrevFora) {
  return fetchOne(
    `
    WITH metricas AS (
      SELECT
        s.team,
        s.pct                                              AS aprov_geral,
        SPLIT_PART(s.home_record, '-', 1)::NUMERIC        AS vit_casa,
        SPLIT_PART(s.home_record, '-', 2)::NUMERIC        AS der_casa,
        SPLIT_PART(s.road_record, '-', 1)::NUMERIC        AS vit_fora,
        SPLIT_PART(s.road_record, '-', 2)::NUMERIC        AS der_fora,
        rt.ppg,
        od_atq.points::NUMERIC / NULLIF(od_atq.games, 0)  AS pts_marcados_pg,
        od_def.points::NUMERIC / NULLIF(od_def.games, 0)  AS pts_sofridos_pg
      FROM standings s
      JOIN ratios_teams rt         ON rt.team = s.team
      JOIN offensive_defensive od_atq
        ON od_atq.team = s.team AND od_atq.stat_type = 'OFFENSE'
      JOIN offensive_defensive od_def
        ON od_def.team = s.team AND od_def.stat_type = 'DEFENSE'
      WHERE s.team IN ($1, $2)
        AND s.home_record ~ '^\\d+-\\d+$'
        AND s.road_record ~ '^\\d+-\\d+$'
    )
    SELECT
      casa.team                                                    AS time_casa,
      fora.team                                                    AS time_fora,
      ROUND(casa.vit_casa / NULLIF(casa.vit_casa + casa.der_casa, 0) * 100, 1) AS aprov_casa_pct,
      ROUND(fora.vit_fora / NULLIF(fora.vit_fora + fora.der_fora, 0) * 100, 1) AS aprov_fora_pct,
      ROUND(casa.pts_marcados_pg - fora.pts_sofridos_pg, 1)       AS net_ataque_casa,
      ROUND(fora.pts_marcados_pg - casa.pts_sofridos_pg, 1)       AS net_ataque_fora,
      ROUND((casa.aprov_geral - fora.aprov_geral) * 100, 1)       AS edge_aproveitamento
    FROM metricas casa
    CROSS JOIN metricas fora
    WHERE casa.team = $1 AND fora.team = $2
    LIMIT 1
  `,
    [abrevCasa, abrevFora]
  )
}

// §9 — Stats de temporada dos jogadores do roster de um time
//   WHERE: nba_players.team_abbreviation = $1
//   JOIN: alphabetical_player_cumulatives via last_name ILIKE + team
async function getJogadoresStats(abrev) {
  return fetchAll(
    `
    SELECT
      np.full_name                                                    AS player_name,
      np.team_abbreviation                                            AS team_abrev,
      nt.full_name                                                    AS team_nome,
      apc.position,
      apc.games,
      apc.minutes,
      ROUND(apc.minutes::NUMERIC / NULLIF(apc.games, 0), 1)       AS mpg,
      apc.points,
      ROUND(apc.points::NUMERIC  / NULLIF(apc.games, 0), 1)       AS ppg,
      apc.total_reb,
      ROUND(apc.total_reb::NUMERIC / NULLIF(apc.games, 0), 1)     AS rpg,
      apc.assists,
      ROUND(apc.assists::NUMERIC / NULLIF(apc.games, 0), 1)       AS apg,
      apc.steals,
      ROUND(apc.steals::NUMERIC  / NULLIF(apc.games, 0), 1)       AS spg,
      apc.blocks,
      ROUND(apc.blocks::NUMERIC  / NULLIF(apc.games, 0), 1)       AS bpg,
      apc.turnovers,
      ROUND(apc.turnovers::NUMERIC / NULLIF(apc.games, 0), 1)     AS topg,
      apc.fg, apc.fga,
      ROUND(apc.fg::NUMERIC  / NULLIF(apc.fga, 0) * 100, 1)       AS fg_pct,
      apc.fg3, apc.f3a,
      ROUND(apc.fg3::NUMERIC / NULLIF(apc.f3a, 0) * 100, 1)       AS fg3_pct,
      apc.ft, apc.fta,
      ROUND(apc.ft::NUMERIC  / NULLIF(apc.fta, 0) * 100, 1)       AS ft_pct,
      ROUND(
        (apc.points + apc.total_reb + apc.assists)::NUMERIC
        / NULLIF(apc.games, 0), 1
      )                                                             AS pra_por_jogo
    FROM nba_players np
    JOIN nba_teams nt ON nt.abbreviation = np.team_abbreviation
    LEFT JOIN alphabetical_player_cumulatives apc
      ON apc.player_name ILIKE '%' || np.last_name || '%'
      AND apc.team ILIKE np.team_abbreviation
    WHERE np.team_abbreviation = $1
    ORDER BY ppg DESC NULLS LAST
  `,
    [abrev]
  )
}

// §9.2 — Ratios por jogador (médias)
async function getJogadoresRatios(abrev) {
  return fetchAll(
    `
    SELECT
      np.full_name                                  AS player_name,
      np.team_abbreviation                          AS team_abrev,
      rat.games,
      rat.ppg, rat.rpg, rat.apg, rat.spg, rat.bpg, rat.topg,
      ROUND(rat.fg_pct  * 100, 1)   AS fg_pct,
      ROUND(rat.fg3_pct * 100, 1)   AS fg3_pct,
      ROUND(rat.ft_pct  * 100, 1)   AS ft_pct
    FROM nba_players np
    LEFT JOIN ratios_players rat
      ON rat.player_name ILIKE '%' || np.last_name || '%'
      AND rat.team ILIKE np.team_abbreviation
    WHERE np.team_abbreviation = $1
    ORDER BY rat.ppg DESC NULLS LAST
  `,
    [abrev]
  )
}

// §10 — Boxscores recentes dos jogadores do roster de um time
//   WHERE: latest_boxscore_lines.team = $1
async function getBoxscoresRecentes(abrev) {
  return fetchAll(
    `
    SELECT
      lbl.game_date,
      lbl.player_name,
      lbl.team,
      lbl.opponent,
      lbl.position,
      lbl.minutes,
      lbl.points,
      lbl.total_reb,
      lbl.assists,
      lbl.steals,
      lbl.blocks,
      lbl.turnovers,
      lbl.fg, lbl.fga,
      ROUND(lbl.fg::NUMERIC / NULLIF(lbl.fga, 0) * 100, 1) AS fg_pct,
      lbl.fg3, lbl.f3a,
      lbl.ft, lbl.fta
    FROM latest_boxscore_lines lbl
    WHERE lbl.team = $1
    ORDER BY lbl.game_date DESC, lbl.points DESC
    LIMIT 60
  `,
    [abrev]
  )
}

// §11 — Consistência dos jogadores (desvio padrão de pts/reb/ast)
//   WHERE: latest_boxscore_lines.team = $1
async function getConsistenciaJogadores(abrev) {
  return fetchAll(
    `
    SELECT
      lbl.player_name,
      lbl.team,
      COUNT(*)                                        AS jogos_analisados,
      -- Pontos
      ROUND(AVG(lbl.points)::NUMERIC, 1)              AS media_pts,
      ROUND(STDDEV(lbl.points)::NUMERIC, 1)           AS desvio_pts,
      MIN(lbl.points)                                  AS min_pts,
      MAX(lbl.points)                                  AS max_pts,
      ROUND(STDDEV(lbl.points) / NULLIF(AVG(lbl.points), 0) * 100, 1)
                                                       AS coef_var_pts_pct,
      -- Rebotes
      ROUND(AVG(lbl.total_reb)::NUMERIC, 1)            AS media_reb,
      ROUND(STDDEV(lbl.total_reb)::NUMERIC, 1)         AS desvio_reb,
      ROUND(STDDEV(lbl.total_reb) / NULLIF(AVG(lbl.total_reb), 0) * 100, 1)
                                                       AS coef_var_reb_pct,
      -- Assistências
      ROUND(AVG(lbl.assists)::NUMERIC, 1)              AS media_ast,
      ROUND(STDDEV(lbl.assists)::NUMERIC, 1)           AS desvio_ast,
      ROUND(STDDEV(lbl.assists) / NULLIF(AVG(lbl.assists), 0) * 100, 1)
                                                       AS coef_var_ast_pct
    FROM latest_boxscore_lines lbl
    WHERE lbl.team = $1
    GROUP BY lbl.player_name, lbl.team
    HAVING COUNT(*) >= 2
    ORDER BY media_pts DESC
  `,
    [abrev]
  )
}

// §13 — Attendance
async function getAttendance(abrev) {
  return fetchOne(
    `
    SELECT
      team,
      home_games,
      home_avg      AS media_publico_casa,
      road_avg      AS media_publico_fora,
      overall_avg   AS media_publico_geral
    FROM attendance
    WHERE team = $1
    LIMIT 1
  `,
    [abrev]
  )
}

// §14 — Projeção de jogadores contra a defesa adversária
//   Jogadores do time A vs defesa do time B
async function getJogadoresVsDefesa(abrevTime, abrevAdversario) {
  return fetchAll(
    `
    WITH liga AS (
      SELECT AVG(od.fg_pct) AS media_fg_pct_liga
      FROM offensive_defensive od
      WHERE od.stat_type = 'DEFENSE'
    ),
    defesa_adv AS (
      SELECT
        od.team,
        od.fg_pct     AS fg_pct_cedido,
        od.fg3_pct    AS fg3_pct_cedido
      FROM offensive_defensive od
      WHERE od.team = $2 AND od.stat_type = 'DEFENSE'
    )
    SELECT
      np.full_name                                         AS player_name,
      rat.team                                             AS time_jogador,
      d.team                                               AS adversario,
      rat.ppg                                              AS ppg_base,
      ROUND(d.fg_pct_cedido  * 100, 1)                    AS fg_pct_defesa_adv,
      ROUND(l.media_fg_pct_liga * 100, 1)                  AS fg_pct_media_liga,
      ROUND(
        rat.ppg * (d.fg_pct_cedido / NULLIF(l.media_fg_pct_liga, 0)), 1
      )                                                    AS projecao_pts_ajustada
    FROM nba_players np
    LEFT JOIN ratios_players rat
      ON rat.player_name ILIKE '%' || np.last_name || '%'
      AND rat.team ILIKE np.team_abbreviation
    CROSS JOIN defesa_adv d
    CROSS JOIN liga l
    WHERE np.team_abbreviation = $1
      AND rat.ppg IS NOT NULL
    ORDER BY projecao_pts_ajustada DESC NULLS LAST
  `,
    [abrevTime, abrevAdversario]
  )
}

// §15 — Scorecard composto de um time para apostas
async function getScorecard(abrev) {
  return fetchOne(
    `
    SELECT
      s.team,
      s.conference,
      ROUND(s.pct * 100, 1)                                              AS aprov_pct,
      s.last_10                                                           AS forma_recente,
      s.streak                                                            AS sequencia,
      rt.ppg                                                              AS ppg_ataque,
      ROUND(od_atq.points::NUMERIC / NULLIF(od_atq.games, 0), 1)         AS pts_marcados_pg,
      ROUND(od_def.points::NUMERIC / NULLIF(od_def.games, 0), 1)         AS pts_cedidos_pg,
      ROUND(
        od_atq.points::NUMERIC / NULLIF(od_atq.games, 0) -
        od_def.points::NUMERIC / NULLIF(od_def.games, 0), 1
      )                                                                   AS net_rating,
      ROUND(od_atq.fg_pct  * 100, 1)                                      AS fg_pct_ataque,
      ROUND(od_atq.fg3_pct * 100, 1)                                      AS fg3_pct_ataque,
      ROUND(od_def.fg_pct  * 100, 1)                                      AS fg_pct_cedido,
      ROUND(od_def.fg3_pct * 100, 1)                                      AS fg3_pct_cedido,
      od_atq.assists                                                       AS ast_total,
      od_atq.turnovers                                                     AS to_total,
      od_atq.steals                                                        AS steals_total,
      ROUND(
        s.pct * 40 +
        (od_atq.points::NUMERIC / NULLIF(od_atq.games, 0) -
         od_def.points::NUMERIC / NULLIF(od_def.games, 0)) * 1.5 +
        ROUND(od_atq.fg_pct * 100, 1) * 0.3, 2
      )                                                                    AS score_aposta
    FROM standings s
    JOIN ratios_teams rt ON rt.team = s.team
    JOIN offensive_defensive od_atq
      ON od_atq.team = s.team AND od_atq.stat_type = 'OFFENSE'
    JOIN offensive_defensive od_def
      ON od_def.team = s.team AND od_def.stat_type = 'DEFENSE'
    WHERE s.team = $1
    LIMIT 1
  `,
    [abrev]
  )
}

// §15.2 — Relatório pré-jogo completo
async function getRelatorioPreJogo(abrevCasa, abrevFora) {
  return fetchOne(
    `
    WITH t1 AS (SELECT * FROM standings WHERE team = $1),
         t2 AS (SELECT * FROM standings WHERE team = $2),
         t1_atq AS (SELECT * FROM offensive_defensive WHERE team = $1 AND stat_type='OFFENSE'),
         t2_atq AS (SELECT * FROM offensive_defensive WHERE team = $2 AND stat_type='OFFENSE'),
         t1_def AS (SELECT * FROM offensive_defensive WHERE team = $1 AND stat_type='DEFENSE'),
         t2_def AS (SELECT * FROM offensive_defensive WHERE team = $2 AND stat_type='DEFENSE'),
         t1_rt  AS (SELECT * FROM ratios_teams WHERE team = $1),
         t2_rt  AS (SELECT * FROM ratios_teams WHERE team = $2),
         h2h    AS (SELECT * FROM head_to_head_win_grid WHERE team = $1 AND opponent = $2)
    SELECT
      $1                                                                    AS time_casa,
      $2                                                                    AS time_visitante,
      ROUND(t1.pct * 100, 1)                                               AS aprov_casa_pct,
      ROUND(t2.pct * 100, 1)                                               AS aprov_visit_pct,
      t1.last_10                                                            AS forma_casa,
      t2.last_10                                                            AS forma_visit,
      t1.streak                                                             AS seq_casa,
      t2.streak                                                             AS seq_visit,
      t1_rt.ppg                                                             AS ppg_casa,
      t2_rt.ppg                                                             AS ppg_visit,
      ROUND(t1_def.points::NUMERIC / NULLIF(t1_def.games, 0), 1)           AS pts_ced_casa,
      ROUND(t2_def.points::NUMERIC / NULLIF(t2_def.games, 0), 1)           AS pts_ced_visit,
      ROUND(t1_atq.points::NUMERIC/NULLIF(t1_atq.games,0) -
            t1_def.points::NUMERIC/NULLIF(t1_def.games,0), 1)              AS net_casa,
      ROUND(t2_atq.points::NUMERIC/NULLIF(t2_atq.games,0) -
            t2_def.points::NUMERIC/NULLIF(t2_def.games,0), 1)              AS net_visit,
      ROUND(t1_rt.ppg + t2_rt.ppg, 1)                                      AS proj_total_pts,
      h2h.wins                                                              AS h2h_vit_casa,
      h2h.losses                                                            AS h2h_der_casa,
      ROUND(h2h.wins::NUMERIC / NULLIF(h2h.wins + h2h.losses, 0) * 100, 1) AS h2h_pct_casa
    FROM t1, t2, t1_atq, t2_atq, t1_def, t2_def, t1_rt, t2_rt, h2h
    LIMIT 1
  `,
    [abrevCasa, abrevFora]
  )
}

// ── Jogos recentes entre os dois times (scores) ──────────────────────
async function getJogosRecentes(abrevA, abrevB) {
  return fetchAll(
    `
    SELECT
      game_date,
      away_team,
      away_score,
      home_team,
      home_score,
      CASE
        WHEN away_score > home_score THEN away_team
        ELSE home_team
      END                              AS vencedor,
      ABS(away_score - home_score)     AS margem_pontos,
      away_score + home_score          AS total_pontos,
      leader_points                    AS lider_pontos,
      leader_rebounds                  AS lider_rebotes,
      leader_assists                   AS lider_assistencias
    FROM latest_scores_and_leaders
    WHERE (home_team = $1 AND away_team = $2)
       OR (home_team = $2 AND away_team = $1)
    ORDER BY game_date DESC
  `,
    [abrevA, abrevB]
  )
}

// ══════════════════════════════════════════════════════════════════════
//  MODELO DE PROBABILIDADE DE VITÓRIA
// ══════════════════════════════════════════════════════════════════════
function calcProbVitoria(
  netCasa,
  netFora,
  h2hPctCasa,
  aprovCasaPct,
  aprovForaPct
) {
  const netDiff = (netCasa ?? 0) - (netFora ?? 0)
  const netScore = Math.min(Math.max(50 + netDiff * 3, 10), 90)
  const h2hScore = h2hPctCasa ?? 50
  const casaScore = aprovCasaPct ?? 50
  const foraScore = aprovForaPct ?? 50

  // Composição: 40% net rating, 30% H2H, 15% aprov casa, 15% aprov fora
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
//  GET /api/confronto/times — Lista todos os times (de-para)
// ══════════════════════════════════════════════════════════════════════
router.get('/times', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        full_name                                     AS nome_completo,
        abbreviation                                  AS abreviacao,
        LOWER(REPLACE(full_name, ' ', '-'))            AS slug,
        city,
        nickname,
        conference,
        division
      FROM nba_teams
      ORDER BY full_name
    `)
    res.json({
      descricao:
        'Use o nome completo ou slug na rota /api/confronto/:timeCasa/vs/:timeFora',
      total: rows.length,
      de_para: rows,
      exemplo_uso: [
        'GET /api/confronto/Houston-Rockets/vs/Los-Angeles-Lakers',
        'GET /api/confronto/HOU/vs/LAL',
        'GET /api/confronto/rockets/vs/lakers'
      ]
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════════
//  GET /api/confronto/:timeCasa/vs/:timeFora
//
//  PARÂMETROS:
//    :timeCasa  — Nome completo (slug) ou abreviação do time da casa
//    :timeFora  — Nome completo (slug) ou abreviação do time visitante
//
//  EXEMPLOS:
//    /api/confronto/Houston-Rockets/vs/Los-Angeles-Lakers
//    /api/confronto/HOU/vs/LAL
//    /api/confronto/rockets/vs/lakers
//
//  DE-PARA DOS FILTROS (WHERE):
//  ┌─────────────────────────────────┬──────────────────────────────────────────────┐
//  │  TABELA                         │  WHERE                                       │
//  ├─────────────────────────────────┼──────────────────────────────────────────────┤
//  │  standings                      │  team = abbreviation                         │
//  │  offensive_defensive            │  team = abbreviation                         │
//  │  ratios_teams                   │  team = abbreviation                         │
//  │  head_to_head_win_grid          │  team = abrevA, opponent = abrevB            │
//  │  opponent_points_breakdown      │  team = abbreviation                         │
//  │  attendance                     │  team = abbreviation                         │
//  │  nba_players                    │  team_abbreviation = abbreviation             │
//  │  alphabetical_player_cumulatives│  player_name ILIKE last_name + team ILIKE abr │
//  │  ratios_players                 │  player_name ILIKE last_name + team ILIKE abr │
//  │  latest_boxscore_lines          │  team = abbreviation                         │
//  │  latest_scores_and_leaders      │  home_team / away_team = abbreviation         │
//  │  nba_teams                      │  abbreviation / full_name (resolução nome)   │
//  └─────────────────────────────────┴──────────────────────────────────────────────┘
// ══════════════════════════════════════════════════════════════════════
router.get('/:timeCasa/vs/:timeFora', async (req, res) => {
  const slugCasa = req.params.timeCasa
  const slugFora = req.params.timeFora

  try {
    // ── Resolver nomes para abreviações ──────────────────────────────
    const [infoCasa, infoFora] = await Promise.all([
      resolverTime(slugCasa),
      resolverTime(slugFora)
    ])

    if (!infoCasa) {
      return res.status(404).json({
        error: `Time "${slugCasa}" não encontrado`,
        dica: 'Use GET /api/confronto/times para ver os nomes disponíveis'
      })
    }
    if (!infoFora) {
      return res.status(404).json({
        error: `Time "${slugFora}" não encontrado`,
        dica: 'Use GET /api/confronto/times para ver os nomes disponíveis'
      })
    }

    const abrevCasa = infoCasa.abreviacao
    const abrevFora = infoFora.abreviacao

    // ── Busca todas as análises em paralelo ──────────────────────────
    const [
      // §2 Classificação
      classifCasa,
      classifFora,
      // §3 Ataque + Defesa + Net Rating
      ataqueCasa,
      ataqueFora,
      defesaCasa,
      defesaFora,
      netCasa,
      netFora,
      oppBreakCasa,
      oppBreakFora,
      // §4 H2H
      h2hCasaVsFora,
      h2hForaVsCasa,
      // §5 Ratios
      ratiosCasa,
      ratiosFora,
      // §7 Over/Under
      projecaoOU,
      linhasOU,
      // §9 Jogadores stats
      jogadoresCasa,
      jogadoresFora,
      jogadoresRatiosCasa,
      jogadoresRatiosFora,
      // §10 Boxscores recentes
      boxCasa,
      boxFora,
      // §11 Consistência
      consistCasa,
      consistFora,
      // §13 Attendance
      attCasa,
      attFora,
      // §14 Jogadores vs defesa adversária
      jogVsDefCasa,
      jogVsDefFora,
      // §15 Scorecard
      scoreCasa,
      scoreFora,
      // Relatório pré-jogo
      relatorio,
      // Jogos recentes entre ambos
      jogosRecentes
    ] = await Promise.all([
      getClassificacao(abrevCasa),
      getClassificacao(abrevFora),
      getAtaque(abrevCasa),
      getAtaque(abrevFora),
      getDefesa(abrevCasa),
      getDefesa(abrevFora),
      getNetRating(abrevCasa),
      getNetRating(abrevFora),
      getOpponentBreakdown(abrevCasa),
      getOpponentBreakdown(abrevFora),
      getH2H(abrevCasa, abrevFora),
      getH2H(abrevFora, abrevCasa),
      getRatiosTime(abrevCasa),
      getRatiosTime(abrevFora),
      getProjecaoOverUnder(abrevCasa, abrevFora),
      getProbOverUnderLinhas(),
      getJogadoresStats(abrevCasa),
      getJogadoresStats(abrevFora),
      getJogadoresRatios(abrevCasa),
      getJogadoresRatios(abrevFora),
      getBoxscoresRecentes(abrevCasa),
      getBoxscoresRecentes(abrevFora),
      getConsistenciaJogadores(abrevCasa),
      getConsistenciaJogadores(abrevFora),
      getAttendance(abrevCasa),
      getAttendance(abrevFora),
      getJogadoresVsDefesa(abrevCasa, abrevFora),
      getJogadoresVsDefesa(abrevFora, abrevCasa),
      getScorecard(abrevCasa),
      getScorecard(abrevFora),
      getRelatorioPreJogo(abrevCasa, abrevFora).catch(() => null),
      getJogosRecentes(abrevCasa, abrevFora)
    ])

    // ── Cálculo de probabilidade de vitória ──────────────────────────
    let aprovCasaPct = null
    let aprovForaPct = null

    if (classifCasa?.record_casa?.match(/^(\d+)-(\d+)$/)) {
      const [v, d] = classifCasa.record_casa.split('-').map(Number)
      aprovCasaPct = round((v / (v + d)) * 100, 1)
    }
    if (classifFora?.record_fora?.match(/^(\d+)-(\d+)$/)) {
      const [v, d] = classifFora.record_fora.split('-').map(Number)
      aprovForaPct = round((v / (v + d)) * 100, 1)
    }

    const netPtsCasa = netCasa?.net_points_pg ? +netCasa.net_points_pg : null
    const netPtsFora = netFora?.net_points_pg ? +netFora.net_points_pg : null
    const h2hPctCasa = h2hCasaVsFora?.aproveitamento_h2h_pct
      ? +h2hCasaVsFora.aproveitamento_h2h_pct
      : null

    const probCasa = calcProbVitoria(
      netPtsCasa,
      netPtsFora,
      h2hPctCasa,
      aprovCasaPct,
      aprovForaPct
    )

    // ── Resposta final ───────────────────────────────────────────────
    res.json({
      confronto: `${infoCasa.nome_completo} vs ${infoFora.nome_completo}`,
      gerado_em: new Date().toISOString(),

      // ── DE-PARA: Mapeamento de nomes para abreviações ──────────────
      de_para: {
        casa: {
          input: slugCasa,
          nome_completo: infoCasa.nome_completo,
          abreviacao: abrevCasa
        },
        fora: {
          input: slugFora,
          nome_completo: infoFora.nome_completo,
          abreviacao: abrevFora
        },
        nota: 'Todas as tabelas usam a abreviação (nba_teams.abbreviation) no WHERE. nba_players usa team_abbreviation. alphabetical_player_cumulatives e ratios_players fazem JOIN por last_name ILIKE + team.'
      },

      // ── §2 CLASSIFICAÇÃO ───────────────────────────────────────────
      classificacao: {
        casa: classifCasa,
        fora: classifFora
      },

      // ── §3 DESEMPENHO OFENSIVO E DEFENSIVO ─────────────────────────
      desempenho: {
        casa: {
          ataque: ataqueCasa,
          defesa: defesaCasa,
          net_rating: netCasa,
          opponent_breakdown: oppBreakCasa
        },
        fora: {
          ataque: ataqueFora,
          defesa: defesaFora,
          net_rating: netFora,
          opponent_breakdown: oppBreakFora
        }
      },

      // ── §4 HEAD-TO-HEAD ────────────────────────────────────────────
      head_to_head: {
        [`${abrevCasa}_vs_${abrevFora}`]: h2hCasaVsFora,
        [`${abrevFora}_vs_${abrevCasa}`]: h2hForaVsCasa
      },

      // ── §5 EFICIÊNCIA DE ARREMESSOS ────────────────────────────────
      eficiencia_arremessos: {
        casa: ratiosCasa,
        fora: ratiosFora
      },

      // ── §7 PROJEÇÃO OVER/UNDER ─────────────────────────────────────
      over_under: {
        projecao_confronto: projecaoOU,
        linhas_historicas: linhasOU
      },

      // ── §8 PROBABILIDADE DE VITÓRIA (MONEYLINE) ────────────────────
      probabilidade_vitoria: {
        prob_vitoria_casa_pct: probCasa,
        prob_vitoria_fora_pct: round(100 - probCasa, 1),
        favorito:
          probCasa >= 50 ? infoCasa.nome_completo : infoFora.nome_completo,
        modelo: 'NetRating(40%) + H2H(30%) + AprovCasa(15%) + AprovFora(15%)',
        forca_relativa: await getForcaRelativa(abrevCasa, abrevFora).catch(
          () => null
        )
      },

      // ── §9 JOGADORES — STATS DE TEMPORADA ──────────────────────────
      jogadores: {
        descricao_filtro: {
          tabela: 'nba_players → alphabetical_player_cumulatives',
          where_time: 'nba_players.team_abbreviation = abbreviation',
          join_jogador:
            'apc.player_name ILIKE last_name AND apc.team ILIKE abbreviation'
        },
        casa: {
          time: infoCasa.nome_completo,
          abreviacao: abrevCasa,
          stats_temporada: jogadoresCasa,
          ratios: jogadoresRatiosCasa
        },
        fora: {
          time: infoFora.nome_completo,
          abreviacao: abrevFora,
          stats_temporada: jogadoresFora,
          ratios: jogadoresRatiosFora
        }
      },

      // ── §10 BOXSCORES RECENTES ─────────────────────────────────────
      boxscores_recentes: {
        descricao_filtro: 'latest_boxscore_lines.team = abreviacao',
        casa: boxCasa,
        fora: boxFora
      },

      // ── §11 CONSISTÊNCIA DOS JOGADORES ─────────────────────────────
      consistencia_jogadores: {
        descricao: 'Menor coef_var = mais consistente (melhor para props)',
        descricao_filtro:
          'latest_boxscore_lines.team = abreviacao, GROUP BY player_name',
        casa: consistCasa,
        fora: consistFora
      },

      // ── §13 PRESSÃO DE PÚBLICO ─────────────────────────────────────
      attendance: {
        casa: attCasa,
        fora: attFora
      },

      // ── §14 JOGADORES VS DEFESA ADVERSÁRIA ─────────────────────────
      jogadores_vs_defesa: {
        descricao:
          'Projeção de pontos ajustada: PPG × (FG% cedido pelo adversário / FG% média da liga)',
        descricao_filtro: {
          jogadores: 'nba_players.team_abbreviation = abbreviation do time',
          defesa:
            'offensive_defensive.team = abbreviation do adversário, stat_type = DEFENSE',
          liga: 'AVG de fg_pct de todas defesas'
        },
        [`${infoCasa.nome_completo}_vs_defesa_${infoFora.nome_completo}`]:
          jogVsDefCasa,
        [`${infoFora.nome_completo}_vs_defesa_${infoCasa.nome_completo}`]:
          jogVsDefFora
      },

      // ── §15 SCORECARD PARA APOSTAS ─────────────────────────────────
      scorecard: {
        descricao:
          'Score composto: aprov% × 40 + net_rating × 1.5 + fg%_ataque × 0.3',
        casa: scoreCasa,
        fora: scoreFora
      },

      // ── RELATÓRIO PRÉ-JOGO CONSOLIDADO ─────────────────────────────
      relatorio_pre_jogo: relatorio,

      // ── JOGOS RECENTES ENTRE OS DOIS TIMES ─────────────────────────
      jogos_recentes_entre_si: jogosRecentes
    })
  } catch (err) {
    console.error(`[CONFRONTO] Erro: ${err.message}`, err.stack)
    res.status(500).json({
      error: 'Erro ao processar confronto',
      details: err.message
    })
  }
})

module.exports = router
