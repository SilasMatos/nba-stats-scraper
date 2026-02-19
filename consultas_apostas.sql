-- ══════════════════════════════════════════════════════════════════════
--  NBA STATS — CONSULTAS ESTRATÉGICAS PARA ANÁLISE DE PARTIDAS E APOSTAS
--  Banco: PostgreSQL | Scraper: nba-stats-scraper
--  Atualizado: 2026-02-19
--
--  SUMÁRIO DAS SEÇÕES:
--  §1  Visão geral dos placares recentes
--  §2  Classificação e forma atual dos times
--  §3  Desempenho ofensivo e defensivo por time
--  §4  Head-to-head histórico entre dois times
--  §5  Eficiência de arremessos por time
--  §6  Top performers por categoria estatística
--  §7  Probabilidade de Total de Pontos (Over/Under)
--  §8  Probabilidade de vitória baseada em eficiência
--  §9  Props de jogadores (pts / reb / ast por jogo)
--  §10 Boxscore do último jogo de um jogador
--  §11 Consistência de jogadores (desvio padrão simulado)
--  §12 Análise de quebra de recordes recentes
--  §13 Pressão de público (Attendance)
--  §14 Exploração cruzada — jogadores vs defesas
--  §15 Ranking geral de times para apostas (scorecard)
-- ══════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §1  ÚLTIMOS RESULTADOS — visão geral dos jogos recentes        │
-- └─────────────────────────────────────────────────────────────────┘

-- 1.1  Todos os jogos mais recentes com placar e líderes estatísticos
SELECT
    game_date,
    away_team,
    away_score,
    home_team,
    home_score,
    CASE
        WHEN away_score > home_score THEN away_team
        ELSE home_team
    END                                      AS vencedor,
    ABS(away_score - home_score)             AS margem_pontos,
    away_score + home_score                  AS total_pontos,
    leader_points                            AS lider_pontos,
    leader_rebounds                          AS lider_rebotes,
    leader_assists                           AS lider_assistencias
FROM latest_scores_and_leaders
ORDER BY game_date DESC;


-- 1.2  Média de pontos totais nos últimos jogos (referência Over/Under)
SELECT
    ROUND(AVG(away_score + home_score)::NUMERIC, 1)   AS media_total_pts,
    ROUND(MIN(away_score + home_score)::NUMERIC, 1)   AS min_total_pts,
    ROUND(MAX(away_score + home_score)::NUMERIC, 1)   AS max_total_pts,
    COUNT(*)                                           AS qtd_jogos
FROM latest_scores_and_leaders
WHERE away_score IS NOT NULL;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §2  CLASSIFICAÇÃO ATUAL — STANDINGS                            │
-- └─────────────────────────────────────────────────────────────────┘

-- 2.1  Classificação completa com aproveitamento
SELECT
    conference,
    division,
    team,
    wins,
    losses,
    ROUND(pct::NUMERIC * 100, 1)   AS aproveitamento_pct,
    games_behind                    AS jogos_atras_lider,
    home_record                     AS record_casa,
    road_record                     AS record_fora,
    last_10                         AS ultimos_10,
    streak                          AS sequencia_atual
FROM standings
ORDER BY conference, pct DESC;


-- 2.2  Times em melhor forma (sequência positiva)
SELECT
    team,
    streak           AS sequencia,
    last_10          AS ultimos_10,
    wins,
    losses,
    ROUND(pct::NUMERIC * 100, 1) AS aproveitamento_pct
FROM standings
WHERE streak ILIKE 'W%'     -- sequência de vitórias
ORDER BY
    CAST(REGEXP_REPLACE(streak, '[^0-9]', '', 'g') AS INTEGER) DESC;


-- 2.3  Times com melhor/pior aproveitamento FORA de casa
SELECT
    team,
    road_record,
    SPLIT_PART(road_record, '-', 1)::INTEGER                       AS vit_fora,
    SPLIT_PART(road_record, '-', 2)::INTEGER                       AS der_fora,
    ROUND(
        SPLIT_PART(road_record, '-', 1)::NUMERIC /
        NULLIF(
            SPLIT_PART(road_record, '-', 1)::INTEGER +
            SPLIT_PART(road_record, '-', 2)::INTEGER, 0
        ) * 100, 1
    )                                                              AS aprov_fora_pct
FROM standings
WHERE road_record ~ '^\d+-\d+$'
ORDER BY aprov_fora_pct DESC;


-- 2.4  Times com melhor aproveitamento EM CASA
SELECT
    team,
    home_record,
    ROUND(
        SPLIT_PART(home_record, '-', 1)::NUMERIC /
        NULLIF(
            SPLIT_PART(home_record, '-', 1)::INTEGER +
            SPLIT_PART(home_record, '-', 2)::INTEGER, 0
        ) * 100, 1
    )                                                              AS aprov_casa_pct
FROM standings
WHERE home_record ~ '^\d+-\d+$'
ORDER BY aprov_casa_pct DESC;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §3  DESEMPENHO OFENSIVO E DEFENSIVO DOS TIMES                  │
-- └─────────────────────────────────────────────────────────────────┘

-- 3.1  Ranking Ofensivo — times que mais pontuam por jogo
SELECT
    rt.team,
    rt.games,
    rt.ppg                                                      AS pontos_por_jogo,
    rt.rpg                                                      AS rebotes_por_jogo,
    rt.apg                                                      AS assistencias_por_jogo,
    ROUND(rt.fg_pct::NUMERIC * 100, 1)                          AS fg_pct,
    ROUND(rt.fg3_pct::NUMERIC * 100, 1)                         AS fg3_pct,
    ROUND(rt.ft_pct::NUMERIC * 100, 1)                          AS ft_pct
FROM ratios_teams rt
ORDER BY rt.ppg DESC;


-- 3.2  Ranking Defensivo — menor pontuação permitida ao adversário
SELECT
    od.team,
    od.games,
    od.points                                                    AS pts_sofridos_total,
    ROUND(od.points::NUMERIC / NULLIF(od.games, 0), 1)          AS pts_sofridos_pg,
    ROUND(od.fg_pct::NUMERIC * 100, 1)                          AS fg_pct_adv,
    ROUND(od.fg3_pct::NUMERIC * 100, 1)                         AS fg3_pct_adv,
    od.steals                                                    AS roubos_de_bola,
    od.blocks                                                    AS tocos
FROM offensive_defensive od
WHERE od.stat_type = 'DEFENSE'
ORDER BY pts_sofridos_pg ASC;


-- 3.3  Comparativo ATAQUE vs DEFESA de cada time (net rating aproximado)
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
    ON atq.team = def.team
    AND def.stat_type = 'DEFENSE'
WHERE atq.stat_type = 'OFFENSE'
ORDER BY net_points_pg DESC;


-- 3.4  Eficiência total de arremessos (ofensivo)
SELECT
    od.team,
    od.fg, od.fga,
    ROUND(od.fg_pct  * 100, 1)   AS fg_pct,
    od.fg3, od.f3a,
    ROUND(od.fg3_pct * 100, 1)   AS fg3_pct,
    od.ft, od.fta,
    ROUND(od.ft_pct  * 100, 1)   AS ft_pct,
    od.assists,
    od.turnovers,
    od.steals,
    od.blocks
FROM offensive_defensive od
WHERE od.stat_type = 'OFFENSE'
ORDER BY od.fg_pct DESC;


-- 3.5  Pontos cedidos pelos adversários (pressão defensiva)
SELECT
    opb.team,
    ROUND(opb.opp_fg_pct  * 100, 1)   AS fg_pct_adversario,
    ROUND(opb.opp_fg3_pct * 100, 1)   AS fg3_pct_adversario,
    ROUND(opb.opp_ft_pct  * 100, 1)   AS ft_pct_adversario,
    opb.opp_points                     AS total_pts_cedidos,
    opb.opp_fg3                        AS tres_pts_cedidos
FROM opponent_points_breakdown opb
ORDER BY opb.opp_fg_pct ASC;    -- menor %FG cedido = melhor defesa


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §4  HEAD-TO-HEAD — HISTÓRICO DIRETO ENTRE DOIS TIMES           │
-- │  Substitua :time_a e :time_b pelas siglas dos times             │
-- └─────────────────────────────────────────────────────────────────┘

-- 4.1  Registro direto de um time contra o outro
-- Exemplo: ATL vs MIA
SELECT
    h2h.team,
    h2h.opponent,
    h2h.wins                                         AS vitorias_vs_adv,
    h2h.losses                                       AS derrotas_vs_adv,
    ROUND(
        h2h.wins::NUMERIC /
        NULLIF(h2h.wins + h2h.losses, 0) * 100, 1
    )                                                AS aprov_h2h_pct
FROM head_to_head_win_grid h2h
WHERE h2h.team = 'ATL'           -- ← altere para o time da casa
  AND h2h.opponent = 'MIA';      -- ← altere para o visitante


-- 4.2  Todos os confrontos do time A contra qualquer adversário
SELECT
    team,
    opponent,
    wins,
    losses,
    ROUND(wins::NUMERIC / NULLIF(wins + losses, 0) * 100, 1) AS aprov_pct
FROM head_to_head_win_grid
WHERE team = 'ATL'               -- ← altere para o time desejado
ORDER BY aprov_pct DESC;


-- 4.3  Matriz de H2H completa (visão de todos os confrontos)
SELECT
    team,
    opponent,
    wins,
    losses,
    wins + losses                                             AS jogos_totais,
    ROUND(wins::NUMERIC / NULLIF(wins + losses, 0) * 100, 1) AS aprov_pct
FROM head_to_head_win_grid
ORDER BY team, aprov_pct DESC;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §5  EFICIÊNCIA DE ARREMESSOS — ANÁLISE DE ATAQUE               │
-- └─────────────────────────────────────────────────────────────────┘

-- 5.1  Melhor aproveitamento de 3 pontos por time (temporada)
SELECT
    team,
    games,
    ROUND(fg3_pct * 100, 1)   AS fg3_pct,
    ppg,
    rpg,
    apg
FROM ratios_teams
ORDER BY fg3_pct DESC;


-- 5.2  Times com mais lances livres tentados (pressão na área)
SELECT
    od.team,
    od.fta                                            AS lt_tentados,
    od.ft                                             AS lt_convertidos,
    ROUND(od.ft_pct * 100, 1)                         AS lt_pct,
    od.off_reb                                        AS rebotes_ofensivos
FROM offensive_defensive od
WHERE od.stat_type = 'OFFENSE'
ORDER BY od.fta DESC;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §6  TOP PERFORMERS — LÍDERES DE LIGA POR CATEGORIA             │
-- └─────────────────────────────────────────────────────────────────┘

-- 6.1  Top 20 líderes de cada categoria estatística
SELECT
    stat_category,
    rank,
    player_name,
    team,
    value
FROM top_20_league_leaders
ORDER BY stat_category, rank;


-- 6.2  Top pontuadores da liga (prop de pontos)
SELECT
    player_name,
    team,
    value   AS media_pontos
FROM top_20_league_leaders
WHERE stat_category ILIKE '%scoring%'
   OR stat_category ILIKE '%points%'
ORDER BY value DESC
LIMIT 20;


-- 6.3  Líderes de assistências
SELECT
    player_name,
    team,
    value AS media_assistencias
FROM top_20_league_leaders
WHERE stat_category ILIKE '%assist%'
ORDER BY value DESC;


-- 6.4  Líderes de rebotes
SELECT
    player_name,
    team,
    value AS media_rebotes
FROM top_20_league_leaders
WHERE stat_category ILIKE '%reb%'
ORDER BY value DESC;


-- 6.5  Líderes de roubos de bola (steals)
SELECT
    player_name,
    team,
    value AS media_steals
FROM top_20_league_leaders
WHERE stat_category ILIKE '%steal%'
ORDER BY value DESC;


-- 6.6  Líderes de bloqueios (blocks)
SELECT
    player_name,
    team,
    value AS media_bloqueios
FROM top_20_league_leaders
WHERE stat_category ILIKE '%block%'
ORDER BY value DESC;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §7  PROBABILIDADE DE TOTAL DE PONTOS (OVER / UNDER)            │
-- └─────────────────────────────────────────────────────────────────┘

-- 7.1  Média de pontos dos dois times envolvidos (base para O/U)
-- Ajuste os slugs de time conforme a partida
SELECT
    a.team                                  AS time_casa,
    b.team                                  AS time_fora,
    a.ppg                                   AS ppg_casa,
    b.ppg                                   AS ppg_fora,
    ROUND((a.ppg + b.ppg)::NUMERIC, 1)      AS projecao_total_pts,
    -- Defesa (pontos cedidos/jogo)
    ROUND(def_a.points::NUMERIC / NULLIF(def_a.games, 0), 1)  AS pts_cedidos_pg_casa,
    ROUND(def_b.points::NUMERIC / NULLIF(def_b.games, 0), 1)  AS pts_cedidos_pg_fora,
    -- Projeção ajustada pela defesa adversária
    ROUND(
        (a.ppg + b.ppg +
         def_a.points::NUMERIC / NULLIF(def_a.games, 0) +
         def_b.points::NUMERIC / NULLIF(def_b.games, 0)) / 2, 1
    )                                       AS projecao_ajustada
FROM ratios_teams a
JOIN ratios_teams b
    ON b.team = 'MIA'              -- ← visitante
JOIN offensive_defensive def_a
    ON def_a.team = a.team AND def_a.stat_type = 'DEFENSE'
JOIN offensive_defensive def_b
    ON def_b.team = b.team AND def_b.stat_type = 'DEFENSE'
WHERE a.team = 'ATL';              -- ← time da casa


-- 7.2  Distribuição histórica de totais (todos os jogos recentes)
SELECT
    away_score + home_score                        AS total_pts,
    COUNT(*)                                       AS frequencia,
    ROUND(
        COUNT(*) * 100.0 /
        SUM(COUNT(*)) OVER (), 1
    )                                              AS prob_pct
FROM latest_scores_and_leaders
WHERE away_score IS NOT NULL
GROUP BY total_pts
ORDER BY total_pts;


-- 7.3  % de jogos que passaram determinado total (linha de aposta)
-- Substitua 220 pelo total da linha de aposta
SELECT
    COUNT(*) FILTER (WHERE away_score + home_score > 220)     AS over_220,
    COUNT(*) FILTER (WHERE away_score + home_score <= 220)    AS under_220,
    COUNT(*)                                                  AS total_jogos,
    ROUND(
        COUNT(*) FILTER (WHERE away_score + home_score > 220) * 100.0
        / NULLIF(COUNT(*), 0), 1
    )                                                         AS prob_over_pct
FROM latest_scores_and_leaders
WHERE away_score IS NOT NULL;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §8  PROBABILIDADE DE VITÓRIA (MONEYLINE)                       │
-- └─────────────────────────────────────────────────────────────────┘

-- 8.1  Força relativa dos dois times — modelo simples de Elo proxy
-- Net Rating + H2H + Aproveitamento em casa/fora
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
    WHERE s.home_record ~ '^\d+-\d+$'
      AND s.road_record ~ '^\d+-\d+$'
),
confronto AS (
    SELECT
        casa.team                                                   AS time_casa,
        fora.team                                                   AS time_fora,
        -- aproveitamento em casa / fora
        ROUND(casa.vit_casa / NULLIF(casa.vit_casa + casa.der_casa, 0) * 100, 1) AS aprov_casa_pct,
        ROUND(fora.vit_fora / NULLIF(fora.vit_fora + fora.der_fora, 0) * 100, 1) AS aprov_fora_pct,
        -- net rating de cada side
        ROUND(casa.pts_marcados_pg - fora.pts_sofridos_pg, 1)      AS net_ataque_casa,
        ROUND(fora.pts_marcados_pg - casa.pts_sofridos_pg, 1)      AS net_ataque_fora,
        -- edge de aproveitamento geral
        ROUND((casa.aprov_geral - fora.aprov_geral) * 100, 1)      AS edge_aproveitamento,
        -- H2H
        h2h.wins                                                    AS h2h_casa_vit,
        h2h.losses                                                  AS h2h_casa_der,
        ROUND(h2h.wins::NUMERIC / NULLIF(h2h.wins + h2h.losses, 0) * 100, 1) AS h2h_pct_casa
    FROM metricas casa
    CROSS JOIN metricas fora
    LEFT JOIN head_to_head_win_grid h2h
        ON h2h.team = casa.team AND h2h.opponent = fora.team
    WHERE casa.team = 'ATL'      -- ← time da casa
      AND fora.team = 'MIA'      -- ← visitante
)
SELECT
    time_casa,
    time_fora,
    aprov_casa_pct           AS "% vitórias em casa",
    aprov_fora_pct           AS "% vitórias fora",
    net_ataque_casa          AS "net pts casa",
    net_ataque_fora          AS "net pts fora",
    edge_aproveitamento      AS "edge aproveitamento % (casa - fora)",
    h2h_pct_casa             AS "h2h % vitórias do time da casa"
FROM confronto;


-- 8.2  Ranking de force dos times (score composto para apostas)
SELECT
    s.team,
    ROUND(s.pct * 100, 1)                                          AS aprov_pct,
    rt.ppg                                                          AS ppg,
    ROUND(od_atq.points::NUMERIC / NULLIF(od_atq.games, 0), 1)     AS pts_marcados_pg,
    ROUND(od_def.points::NUMERIC / NULLIF(od_def.games, 0), 1)     AS pts_cedidos_pg,
    ROUND(
        od_atq.points::NUMERIC / NULLIF(od_atq.games, 0) -
        od_def.points::NUMERIC / NULLIF(od_def.games, 0), 1
    )                                                               AS net_rating,
    -- Score composto (aprov% * 0.4 + net_rating * 2)
    ROUND(
        s.pct * 40 +
        (od_atq.points::NUMERIC / NULLIF(od_atq.games, 0) -
         od_def.points::NUMERIC / NULLIF(od_def.games, 0)) * 2, 2
    )                                                               AS score_composto
FROM standings s
JOIN ratios_teams rt ON rt.team = s.team
JOIN offensive_defensive od_atq ON od_atq.team = s.team AND od_atq.stat_type = 'OFFENSE'
JOIN offensive_defensive od_def ON od_def.team = s.team AND od_def.stat_type = 'DEFENSE'
ORDER BY score_composto DESC;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §9  PROPS DE JOGADORES — PONTOS / REBOTES / ASSISTÊNCIAS       │
-- └─────────────────────────────────────────────────────────────────┘

-- 9.1  Estatísticas de temporada de um jogador (acumuladas + médias)
-- Substitua 'LeBron James' pelo nome do jogador
SELECT
    apc.player_name,
    apc.team,
    apc.position,
    apc.games,
    apc.points,
    ROUND(apc.points::NUMERIC / NULLIF(apc.games, 0), 1)          AS ppg,
    apc.total_reb,
    ROUND(apc.total_reb::NUMERIC / NULLIF(apc.games, 0), 1)       AS rpg,
    apc.assists,
    ROUND(apc.assists::NUMERIC / NULLIF(apc.games, 0), 1)         AS apg,
    apc.steals,
    ROUND(apc.steals::NUMERIC / NULLIF(apc.games, 0), 1)          AS spg,
    apc.blocks,
    ROUND(apc.blocks::NUMERIC / NULLIF(apc.games, 0), 1)          AS bpg,
    apc.fg,
    apc.fga,
    apc.fg3,
    apc.f3a,
    apc.ft,
    apc.fta,
    apc.minutes,
    ROUND(apc.minutes::NUMERIC / NULLIF(apc.games, 0), 1)         AS mpg
FROM alphabetical_player_cumulatives apc
WHERE apc.player_name ILIKE '%LeBron%'  -- ← nome do jogador
ORDER BY apc.games DESC;


-- 9.2  Médias de todos os jogadores de um time (roster stats)
SELECT
    rp.player_name,
    rp.team,
    rp.games,
    rp.ppg,
    rp.rpg,
    rp.apg,
    rp.spg,
    rp.bpg,
    rp.topg,
    ROUND(rp.fg_pct  * 100, 1)   AS fg_pct,
    ROUND(rp.fg3_pct * 100, 1)   AS fg3_pct,
    ROUND(rp.ft_pct  * 100, 1)   AS ft_pct
FROM ratios_players rp
WHERE rp.team = 'LAL'            -- ← sigla do time
ORDER BY rp.ppg DESC;


-- 9.3  Combinação de props — PRA (Pts + Reb + Ast) por jogador
SELECT
    apc.player_name,
    apc.team,
    apc.games,
    ROUND(apc.points::NUMERIC  / NULLIF(apc.games, 0), 1)        AS ppg,
    ROUND(apc.total_reb::NUMERIC / NULLIF(apc.games, 0), 1)      AS rpg,
    ROUND(apc.assists::NUMERIC / NULLIF(apc.games, 0), 1)        AS apg,
    ROUND(
        (apc.points + apc.total_reb + apc.assists)::NUMERIC
        / NULLIF(apc.games, 0), 1
    )                                                             AS pra_por_jogo
FROM alphabetical_player_cumulatives apc
WHERE apc.games >= 20
ORDER BY pra_por_jogo DESC
LIMIT 30;


-- 9.4  Jogadores rookies com maior impacto (prop de rookies)
SELECT
    arc.player_name,
    arc.team,
    arc.games,
    ROUND(arc.points::NUMERIC  / NULLIF(arc.games, 0), 1)   AS ppg,
    ROUND(arc.total_reb::NUMERIC / NULLIF(arc.games, 0), 1) AS rpg,
    ROUND(arc.assists::NUMERIC / NULLIF(arc.games, 0), 1)   AS apg
FROM alphabetical_rookie_cumulatives arc
WHERE arc.games >= 10
ORDER BY ppg DESC
LIMIT 20;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §10  BOXSCORE DO ÚLTIMO JOGO DE UM JOGADOR                     │
-- └─────────────────────────────────────────────────────────────────┘

-- 10.1  Desempenho mais recente de um jogador específico
SELECT
    lbl.game_date,
    lbl.team,
    lbl.opponent,
    lbl.player_name,
    lbl.position,
    lbl.minutes,
    lbl.fg,
    lbl.fga,
    ROUND(lbl.fg::NUMERIC / NULLIF(lbl.fga, 0) * 100, 1)   AS fg_pct,
    lbl.fg3,
    lbl.f3a,
    lbl.ft,
    lbl.fta,
    lbl.off_reb,
    lbl.def_reb,
    lbl.total_reb,
    lbl.assists,
    lbl.steals,
    lbl.turnovers,
    lbl.blocks,
    lbl.points
FROM latest_boxscore_lines lbl
WHERE lbl.player_name ILIKE '%Trae Young%'    -- ← nome do jogador
ORDER BY lbl.game_date DESC;


-- 10.2  Boxscore completo de um jogo (todos os jogadores)
SELECT
    lbl.player_name,
    lbl.team,
    lbl.position,
    lbl.minutes,
    lbl.points,
    lbl.total_reb,
    lbl.assists,
    lbl.steals,
    lbl.blocks,
    lbl.turnovers,
    lbl.fg,
    lbl.fga,
    ROUND(lbl.fg::NUMERIC / NULLIF(lbl.fga, 0) * 100, 1)  AS fg_pct,
    lbl.fg3,
    lbl.f3a,
    lbl.ft,
    lbl.fta
FROM latest_boxscore_lines lbl
WHERE lbl.game_date = '2026-02-18'       -- ← data do jogo
  AND (lbl.team = 'ATL' OR lbl.opponent = 'ATL')  -- ← times envolvidos
ORDER BY lbl.team, lbl.points DESC;


-- 10.3  Top scorers do dia (todos os jogos da rodada)
SELECT
    lbl.game_date,
    lbl.player_name,
    lbl.team,
    lbl.opponent,
    lbl.points,
    lbl.total_reb,
    lbl.assists,
    lbl.minutes
FROM latest_boxscore_lines lbl
ORDER BY lbl.game_date DESC, lbl.points DESC
LIMIT 20;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §11  CONSISTÊNCIA DO JOGADOR (análise de variância)            │
-- └─────────────────────────────────────────────────────────────────┘

-- 11.1  Variância de pontos por jogo (consistência de jogadores)
-- Maior variância = maior risco em props de pontos
SELECT
    lbl.player_name,
    lbl.team,
    COUNT(*)                                   AS jogos_analisados,
    ROUND(AVG(lbl.points)::NUMERIC, 1)         AS media_pts,
    ROUND(STDDEV(lbl.points)::NUMERIC, 1)      AS desvio_padrao_pts,
    MIN(lbl.points)                            AS min_pts,
    MAX(lbl.points)                            AS max_pts,
    -- Coeficiente de variação: menor = mais consistente
    ROUND(
        STDDEV(lbl.points) / NULLIF(AVG(lbl.points), 0) * 100, 1
    )                                          AS coef_variacao_pct
FROM latest_boxscore_lines lbl
GROUP BY lbl.player_name, lbl.team
HAVING COUNT(*) >= 3
ORDER BY coef_variacao_pct ASC;


-- 11.2  Consistência de rebotes
SELECT
    lbl.player_name,
    lbl.team,
    COUNT(*)                                        AS jogos,
    ROUND(AVG(lbl.total_reb)::NUMERIC, 1)           AS media_reb,
    ROUND(STDDEV(lbl.total_reb)::NUMERIC, 1)        AS desvio_reb,
    ROUND(
        STDDEV(lbl.total_reb) / NULLIF(AVG(lbl.total_reb), 0) * 100, 1
    )                                               AS coef_var_reb_pct
FROM latest_boxscore_lines lbl
GROUP BY lbl.player_name, lbl.team
HAVING COUNT(*) >= 3
ORDER BY media_reb DESC;


-- 11.3  Consistência de assistências
SELECT
    lbl.player_name,
    lbl.team,
    COUNT(*)                                        AS jogos,
    ROUND(AVG(lbl.assists)::NUMERIC, 1)             AS media_ast,
    ROUND(STDDEV(lbl.assists)::NUMERIC, 1)          AS desvio_ast,
    ROUND(
        STDDEV(lbl.assists) / NULLIF(AVG(lbl.assists), 0) * 100, 1
    )                                               AS coef_var_ast_pct
FROM latest_boxscore_lines lbl
GROUP BY lbl.player_name, lbl.team
HAVING COUNT(*) >= 3
ORDER BY media_ast DESC;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §12  RECORDES E HIGHS/LOWS — ANÁLISE DE EXTREMOS               │
-- └─────────────────────────────────────────────────────────────────┘

-- 12.1  Todos os recordes de highs/lows por categoria
SELECT
    category,
    stat_type,
    player_name,
    team,
    opponent,
    game_date,
    value
FROM single_game_highs_lows
ORDER BY category, stat_type, value DESC;


-- 12.2  Maiores performances individuais (HIGHs de pontos)
SELECT
    player_name,
    team,
    opponent,
    game_date,
    value   AS recorde_pontos
FROM single_game_highs_lows
WHERE category ILIKE '%point%'
  AND stat_type = 'HIGH'
ORDER BY value DESC
LIMIT 10;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §13  PRESSÃO DE PÚBLICO — ATTENDANCE                           │
-- └─────────────────────────────────────────────────────────────────┘

-- 13.1  Times com maior público médio em casa
SELECT
    team,
    home_games,
    home_avg                      AS media_publico_casa,
    road_avg                      AS media_publico_fora,
    overall_avg                   AS media_publico_geral
FROM attendance
ORDER BY home_avg DESC;


-- 13.2  Correlação entre público e desempenho em casa
SELECT
    att.team,
    att.home_avg,
    s.wins,
    s.losses,
    SPLIT_PART(s.home_record, '-', 1)::INTEGER     AS vit_casa,
    ROUND(s.pct * 100, 1)                          AS aprov_pct
FROM attendance att
JOIN standings s ON s.team ILIKE '%' || att.team || '%'
                 OR att.team ILIKE '%' || s.team || '%'
ORDER BY att.home_avg DESC;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §14  EXPLORAÇÃO CRUZADA — JOGADOR vs DEFESA ADVERSÁRIA         │
-- └─────────────────────────────────────────────────────────────────┘

-- 14.1  Projeção de pontos de um jogador vs defesa específica
-- Leva em conta: PPG do jogador × (FG% cedido pelo adversário / FG% médio da liga)
WITH liga AS (
    SELECT
        AVG(od.fg_pct) AS media_fg_pct_liga
    FROM offensive_defensive od
    WHERE od.stat_type = 'DEFENSE'
),
jogador AS (
    SELECT
        rp.player_name,
        rp.team,
        rp.ppg,
        rp.fg_pct,
        rp.fg3_pct,
        rp.ft_pct
    FROM ratios_players rp
    WHERE rp.player_name ILIKE '%Trae Young%'   -- ← jogador
),
defesa_adv AS (
    SELECT
        od.team,
        od.fg_pct     AS fg_pct_cedido,
        od.fg3_pct    AS fg3_pct_cedido
    FROM offensive_defensive od
    WHERE od.team = 'MIA'                       -- ← adversário
      AND od.stat_type = 'DEFENSE'
)
SELECT
    j.player_name,
    j.team                                       AS time_do_jogador,
    d.team                                       AS adversario,
    j.ppg                                        AS ppg_base,
    ROUND(d.fg_pct_cedido  * 100, 1)             AS fg_pct_defesa_adv,
    ROUND(l.media_fg_pct_liga * 100, 1)          AS fg_pct_media_liga,
    -- Ajuste: se defesa é pior que média, projeta mais pontos
    ROUND(
        j.ppg * (d.fg_pct_cedido / NULLIF(l.media_fg_pct_liga, 0)), 1
    )                                            AS projecao_pts_ajustada
FROM jogador j, defesa_adv d, liga l;


-- 14.2  Jogadores mais eficientes contra defesas fracas
-- (defesas que cedem mais de 48% de FG%)
SELECT
    rp.player_name,
    rp.team,
    rp.ppg,
    rp.fg_pct,
    weak_def.team    AS defesa_fraca
FROM ratios_players rp
CROSS JOIN (
    SELECT team
    FROM offensive_defensive
    WHERE stat_type = 'DEFENSE'
      AND fg_pct > 0.48
) weak_def
WHERE rp.team != weak_def.team
ORDER BY rp.ppg DESC
LIMIT 20;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │  §15  SCORECARD COMPLETO PARA APOSTAS — RANKING GERAL           │
-- └─────────────────────────────────────────────────────────────────┘

-- 15.1  Dashboard completo por time — todos os indicadores numa visão
SELECT
    s.team,
    s.conference,
    ROUND(s.pct * 100, 1)                                              AS aprov_pct,
    s.last_10                                                          AS forma_recente,
    s.streak                                                           AS sequencia,
    rt.ppg                                                             AS ppg_ataque,
    ROUND(od_atq.points::NUMERIC / NULLIF(od_atq.games, 0), 1)        AS pts_marcados_pg,
    ROUND(od_def.points::NUMERIC / NULLIF(od_def.games, 0), 1)        AS pts_cedidos_pg,
    ROUND(
        od_atq.points::NUMERIC / NULLIF(od_atq.games, 0) -
        od_def.points::NUMERIC / NULLIF(od_def.games, 0), 1
    )                                                                  AS net_rating,
    ROUND(od_atq.fg_pct  * 100, 1)                                     AS fg_pct_ataque,
    ROUND(od_atq.fg3_pct * 100, 1)                                     AS fg3_pct_ataque,
    ROUND(od_def.fg_pct  * 100, 1)                                     AS fg_pct_cedido,
    ROUND(od_def.fg3_pct * 100, 1)                                     AS fg3_pct_cedido,
    od_atq.assists                                                     AS ast_total,
    od_atq.turnovers                                                   AS to_total,
    od_atq.steals                                                      AS steals_total,
    att.home_avg                                                       AS publico_medio_casa,
    -- Score final para apostas (quanto maior, mais favorável para apostar)
    ROUND(
        s.pct * 40 +
        (od_atq.points::NUMERIC / NULLIF(od_atq.games, 0) -
         od_def.points::NUMERIC / NULLIF(od_def.games, 0)) * 1.5 +
        ROUND(od_atq.fg_pct * 100, 1) * 0.3, 2
    )                                                                  AS score_aposta
FROM standings s
JOIN ratios_teams rt ON rt.team = s.team
JOIN offensive_defensive od_atq
    ON od_atq.team = s.team AND od_atq.stat_type = 'OFFENSE'
JOIN offensive_defensive od_def
    ON od_def.team = s.team AND od_def.stat_type = 'DEFENSE'
LEFT JOIN attendance att ON att.team ILIKE '%' || s.team || '%'
ORDER BY score_aposta DESC;


-- 15.2  Confronto direto pré-jogo — relatório completo para uma partida
-- Substitua 'ATL' e 'MIA' com os times da partida
WITH t1 AS (SELECT * FROM standings WHERE team = 'ATL'),
     t2 AS (SELECT * FROM standings WHERE team = 'MIA'),
     t1_atq AS (SELECT * FROM offensive_defensive WHERE team = 'ATL' AND stat_type='OFFENSE'),
     t2_atq AS (SELECT * FROM offensive_defensive WHERE team = 'MIA' AND stat_type='OFFENSE'),
     t1_def AS (SELECT * FROM offensive_defensive WHERE team = 'ATL' AND stat_type='DEFENSE'),
     t2_def AS (SELECT * FROM offensive_defensive WHERE team = 'MIA' AND stat_type='DEFENSE'),
     t1_rt  AS (SELECT * FROM ratios_teams WHERE team = 'ATL'),
     t2_rt  AS (SELECT * FROM ratios_teams WHERE team = 'MIA'),
     h2h    AS (SELECT * FROM head_to_head_win_grid WHERE team = 'ATL' AND opponent = 'MIA')
SELECT
    'ATL'                                                               AS time_casa,
    'MIA'                                                               AS time_visitante,
    -- Aproveitamentos
    ROUND(t1.pct * 100, 1)                                              AS aprov_casa_pct,
    ROUND(t2.pct * 100, 1)                                              AS aprov_visit_pct,
    t1.last_10                                                          AS forma_casa,
    t2.last_10                                                          AS forma_visit,
    t1.streak                                                           AS seq_casa,
    t2.streak                                                           AS seq_visit,
    -- Ataque
    t1_rt.ppg                                                           AS ppg_casa,
    t2_rt.ppg                                                           AS ppg_visit,
    -- Defesa (pts cedidos/jogo)
    ROUND(t1_def.points::NUMERIC / NULLIF(t1_def.games, 0), 1)         AS pts_ced_casa,
    ROUND(t2_def.points::NUMERIC / NULLIF(t2_def.games, 0), 1)         AS pts_ced_visit,
    -- Net rating
    ROUND(t1_atq.points::NUMERIC/NULLIF(t1_atq.games,0) -
          t1_def.points::NUMERIC/NULLIF(t1_def.games,0), 1)            AS net_casa,
    ROUND(t2_atq.points::NUMERIC/NULLIF(t2_atq.games,0) -
          t2_def.points::NUMERIC/NULLIF(t2_def.games,0), 1)            AS net_visit,
    -- Projeção de total
    ROUND(t1_rt.ppg + t2_rt.ppg, 1)                                    AS proj_total_pts,
    -- H2H
    h2h.wins                                                            AS h2h_vit_casa,
    h2h.losses                                                          AS h2h_der_casa,
    ROUND(h2h.wins::NUMERIC / NULLIF(h2h.wins + h2h.losses, 0) * 100, 1) AS h2h_pct_casa
FROM t1, t2, t1_atq, t2_atq, t1_def, t2_def, t1_rt, t2_rt, h2h;


-- ══════════════════════════════════════════════════════════════════════
--  NOTAS FINAIS:
--  • Todos os parâmetros de time/jogador marcados com "← altere" devem
--    ser substituídos antes de executar.
--  • As colunas "scraped_at" permitem filtrar por data de coleta:
--    WHERE scraped_at >= NOW() - INTERVAL '1 day'
--  • Para playoffs, use também a tabela playoff_schedule_results.
--  • As tabelas team_boxscore_lines e team_cumulatives contêm dados
--    agregados por time e podem complementar as análises de §3 e §8.
-- ══════════════════════════════════════════════════════════════════════
