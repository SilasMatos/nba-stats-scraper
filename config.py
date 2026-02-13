import os
from dotenv import load_dotenv

load_dotenv()

# ── Banco de Dados PostgreSQL ──────────────────────────────────────
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "nba_data")
DB_USER = os.getenv("DB_USER", "meuusuario")
DB_PASSWORD = os.getenv("DB_PASSWORD", "minhasenha")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# ── Selenium ───────────────────────────────────────────────────────
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"
DOWNLOAD_DIR = os.path.abspath(os.getenv("DOWNLOAD_DIR", "./downloads"))

# ── URL alvo ───────────────────────────────────────────────────────
NBA_STATS_URL = "https://www.nba.com/stats/tools/media-central-game-stats"

# ── Base URL do CDN ────────────────────────────────────────────────
CDN_BASE = "https://cdn.nba.com/static/json/staticData/EliasGameStats/00"

# ── Mapeamento de categorias (League Wide Stats) ──────────────────
# Chave: texto exibido na página → valor: slug para nome de tabela
CATEGORY_SLUG_MAP = {
    "LATEST BOXSCORE LINES": "latest_boxscore_lines",
    "ALPHABETICAL PLAYER CUMULATIVES": "alphabetical_player_cumulatives",
    "ALPHABETICAL ROOKIE CUMULATIVES": "alphabetical_rookie_cumulatives",
    "ATTENDANCE": "attendance",
    "LATEST SCORES AND LEADERS": "latest_scores_and_leaders",
    "SINGLE-GAME HIGHS/LOWS": "single_game_highs_lows",
    "TOP 10 LEAGUE LEADERS": "top_10_league_leaders",
    "TOP 20 LEAGUE LEADERS": "top_20_league_leaders",
    "ROOKIE LEAGUE LEADERS": "rookie_league_leaders",
    "RATIOS - PLAYERS": "ratios_players",
    "RATIOS - TEAMS": "ratios_teams",
    "PLAYOFF SCHEDULE/RESULTS": "playoff_schedule_results",
    "STANDINGS": "standings",
    "HEAD-TO-HEAD WIN GRID": "head_to_head_win_grid",
    "OFFENSIVE/DEFENSIVE": "offensive_defensive",
    "MISCELLANEOUS": "miscellaneous",
    "OPPONENT POINTS BREAKDOWN": "opponent_points_breakdown",
}

# ── URLs diretas de cada categoria (extraídas do HTML da página) ──
# Essas URLs são os links exatos que aparecem na tabela "League Wide Stats"
CATEGORY_URLS = [
    {
        "category": "Latest Boxscore Lines",
        "slug": "latest_boxscore_lines",
        "url": f"{CDN_BASE}/all_players_day.txt",
    },
    {
        "category": "Alphabetical Player Cumulatives",
        "slug": "alphabetical_player_cumulatives",
        "url": f"{CDN_BASE}/all_players_season.txt",
    },
    {
        "category": "Alphabetical Rookie Cumulatives",
        "slug": "alphabetical_rookie_cumulatives",
        "url": f"{CDN_BASE}/all_rookies.txt",
    },
    {
        "category": "Attendance",
        "slug": "attendance",
        "url": f"{CDN_BASE}/attend.txt",
    },
    {
        "category": "Latest Scores and Leaders",
        "slug": "latest_scores_and_leaders",
        "url": f"{CDN_BASE}/day_scores.txt",
    },
    {
        "category": "Single-Game Highs/Lows",
        "slug": "single_game_highs_lows",
        "url": f"{CDN_BASE}/high_low.txt",
    },
    {
        "category": "Top 10 League Leaders",
        "slug": "top_10_league_leaders",
        "url": f"{CDN_BASE}/leaders.txt",
    },
    {
        "category": "Top 20 League Leaders",
        "slug": "top_20_league_leaders",
        "url": f"{CDN_BASE}/leaders_deep.txt",
    },
    {
        "category": "Rookie League Leaders",
        "slug": "rookie_league_leaders",
        "url": f"{CDN_BASE}/leaders_rookies.txt",
    },
    {
        "category": "Ratios - Players",
        "slug": "ratios_players",
        "url": f"{CDN_BASE}/ratios_players.txt",
    },
    {
        "category": "Ratios - Teams",
        "slug": "ratios_teams",
        "url": f"{CDN_BASE}/ratios_teams.txt",
    },
    {
        "category": "Playoff Schedule/Results",
        "slug": "playoff_schedule_results",
        "url": f"{CDN_BASE}/results_pos.txt",
    },
    {
        "category": "Standings",
        "slug": "standings",
        "url": f"{CDN_BASE}/stand.txt",
    },
    {
        "category": "Head-to-Head Win Grid",
        "slug": "head_to_head_win_grid",
        "url": f"{CDN_BASE}/stand_tvt.txt",
    },
    {
        "category": "Offensive/Defensive",
        "slug": "offensive_defensive",
        "url": f"{CDN_BASE}/team_opp.txt",
    },
    {
        "category": "Miscellaneous",
        "slug": "miscellaneous",
        "url": f"{CDN_BASE}/team_opp_misc.txt",
    },
    {
        "category": "Opponent Points Breakdown",
        "slug": "opponent_points_breakdown",
        "url": f"{CDN_BASE}/team_opp_pts_breakdown.txt",
    },
]
