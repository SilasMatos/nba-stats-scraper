"""
Modelos do banco de dados PostgreSQL para armazenar os dados do NBA Stats.
Usa SQLAlchemy ORM com 19+ tabelas — uma por categoria de dados.
"""

from datetime import datetime, date

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Text,
    Date,
    DateTime,
    Boolean,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

from config import DATABASE_URL

Base = declarative_base()


# ══════════════════════════════════════════════════════════════════════
#  Tabela de controle de execuções do scraper
# ══════════════════════════════════════════════════════════════════════
class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="running")  # running | success | error
    categories_scraped = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)


# ══════════════════════════════════════════════════════════════════════
#  Dados brutos — armazena o conteúdo TXT original de cada categoria
# ══════════════════════════════════════════════════════════════════════
class RawData(Base):
    __tablename__ = "raw_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(100), nullable=False)
    category_slug = Column(String(100), nullable=False)
    source_url = Column(Text, nullable=True)
    raw_content = Column(Text, nullable=False)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    scrape_run_id = Column(Integer, nullable=True)


# ══════════════════════════════════════════════════════════════════════
#  1. LATEST BOXSCORE LINES — Estatísticas diárias de jogadores
# ══════════════════════════════════════════════════════════════════════
class LatestBoxscoreLines(Base):
    __tablename__ = "latest_boxscore_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_date = Column(Date, nullable=False)
    team = Column(String(5), nullable=False)
    opponent = Column(String(5), nullable=False)
    player_name = Column(String(100), nullable=False)
    position = Column(String(10), nullable=True)
    games = Column(Integer, nullable=True)
    minutes = Column(Integer, nullable=True)
    fg = Column(Integer, nullable=True)
    fga = Column(Integer, nullable=True)
    fg3 = Column(Integer, nullable=True)
    f3a = Column(Integer, nullable=True)
    ft = Column(Integer, nullable=True)
    fta = Column(Integer, nullable=True)
    off_reb = Column(Integer, nullable=True)
    def_reb = Column(Integer, nullable=True)
    total_reb = Column(Integer, nullable=True)
    assists = Column(Integer, nullable=True)
    pf = Column(Integer, nullable=True)
    dq = Column(Integer, nullable=True)
    steals = Column(Integer, nullable=True)
    turnovers = Column(Integer, nullable=True)
    blocks = Column(Integer, nullable=True)
    points = Column(Integer, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  2. ALPHABETICAL PLAYER CUMULATIVES — Acumulados por jogador
# ══════════════════════════════════════════════════════════════════════
class AlphabeticalPlayerCumulatives(Base):
    __tablename__ = "alphabetical_player_cumulatives"

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_name = Column(String(100), nullable=False)
    team = Column(String(5), nullable=True)
    position = Column(String(10), nullable=True)
    games = Column(Integer, nullable=True)
    minutes = Column(Integer, nullable=True)
    fg = Column(Integer, nullable=True)
    fga = Column(Integer, nullable=True)
    fg3 = Column(Integer, nullable=True)
    f3a = Column(Integer, nullable=True)
    ft = Column(Integer, nullable=True)
    fta = Column(Integer, nullable=True)
    off_reb = Column(Integer, nullable=True)
    def_reb = Column(Integer, nullable=True)
    total_reb = Column(Integer, nullable=True)
    assists = Column(Integer, nullable=True)
    pf = Column(Integer, nullable=True)
    dq = Column(Integer, nullable=True)
    steals = Column(Integer, nullable=True)
    turnovers = Column(Integer, nullable=True)
    blocks = Column(Integer, nullable=True)
    points = Column(Integer, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  3. ALPHABETICAL ROOKIE CUMULATIVES
# ══════════════════════════════════════════════════════════════════════
class AlphabeticalRookieCumulatives(Base):
    __tablename__ = "alphabetical_rookie_cumulatives"

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_name = Column(String(100), nullable=False)
    team = Column(String(5), nullable=True)
    position = Column(String(10), nullable=True)
    games = Column(Integer, nullable=True)
    minutes = Column(Integer, nullable=True)
    fg = Column(Integer, nullable=True)
    fga = Column(Integer, nullable=True)
    fg3 = Column(Integer, nullable=True)
    f3a = Column(Integer, nullable=True)
    ft = Column(Integer, nullable=True)
    fta = Column(Integer, nullable=True)
    off_reb = Column(Integer, nullable=True)
    def_reb = Column(Integer, nullable=True)
    total_reb = Column(Integer, nullable=True)
    assists = Column(Integer, nullable=True)
    pf = Column(Integer, nullable=True)
    dq = Column(Integer, nullable=True)
    steals = Column(Integer, nullable=True)
    turnovers = Column(Integer, nullable=True)
    blocks = Column(Integer, nullable=True)
    points = Column(Integer, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  4. ATTENDANCE
# ══════════════════════════════════════════════════════════════════════
class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team = Column(String(50), nullable=True)
    home_games = Column(Integer, nullable=True)
    home_total = Column(Integer, nullable=True)
    home_avg = Column(Integer, nullable=True)
    road_games = Column(Integer, nullable=True)
    road_total = Column(Integer, nullable=True)
    road_avg = Column(Integer, nullable=True)
    overall_games = Column(Integer, nullable=True)
    overall_total = Column(Integer, nullable=True)
    overall_avg = Column(Integer, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  5. LATEST SCORES AND LEADERS
# ══════════════════════════════════════════════════════════════════════
class LatestScoresAndLeaders(Base):
    __tablename__ = "latest_scores_and_leaders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_date = Column(Date, nullable=True)
    away_team = Column(String(50), nullable=True)
    home_team = Column(String(50), nullable=True)
    away_score = Column(Integer, nullable=True)
    home_score = Column(Integer, nullable=True)
    leader_points = Column(String(200), nullable=True)
    leader_rebounds = Column(String(200), nullable=True)
    leader_assists = Column(String(200), nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  6. SINGLE-GAME HIGHS/LOWS
# ══════════════════════════════════════════════════════════════════════
class SingleGameHighsLows(Base):
    __tablename__ = "single_game_highs_lows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(100), nullable=True)
    stat_type = Column(String(50), nullable=True)  # HIGH ou LOW
    player_name = Column(String(100), nullable=True)
    team = Column(String(50), nullable=True)
    opponent = Column(String(50), nullable=True)
    game_date = Column(Date, nullable=True)
    value = Column(Integer, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  7. TOP 10 LEAGUE LEADERS
# ══════════════════════════════════════════════════════════════════════
class Top10LeagueLeaders(Base):
    __tablename__ = "top_10_league_leaders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stat_category = Column(String(100), nullable=True)
    rank = Column(Integer, nullable=True)
    player_name = Column(String(100), nullable=True)
    team = Column(String(50), nullable=True)
    value = Column(Float, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  8. TOP 20 LEAGUE LEADERS
# ══════════════════════════════════════════════════════════════════════
class Top20LeagueLeaders(Base):
    __tablename__ = "top_20_league_leaders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stat_category = Column(String(100), nullable=True)
    rank = Column(Integer, nullable=True)
    player_name = Column(String(100), nullable=True)
    team = Column(String(50), nullable=True)
    value = Column(Float, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  9. ROOKIE LEAGUE LEADERS
# ══════════════════════════════════════════════════════════════════════
class RookieLeagueLeaders(Base):
    __tablename__ = "rookie_league_leaders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stat_category = Column(String(100), nullable=True)
    rank = Column(Integer, nullable=True)
    player_name = Column(String(100), nullable=True)
    team = Column(String(50), nullable=True)
    value = Column(Float, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  10. RATIOS - PLAYERS
# ══════════════════════════════════════════════════════════════════════
class RatiosPlayers(Base):
    __tablename__ = "ratios_players"

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_name = Column(String(100), nullable=True)
    team = Column(String(50), nullable=True)
    games = Column(Integer, nullable=True)
    minutes = Column(Integer, nullable=True)
    fg_pct = Column(Float, nullable=True)
    fg3_pct = Column(Float, nullable=True)
    ft_pct = Column(Float, nullable=True)
    ppg = Column(Float, nullable=True)
    rpg = Column(Float, nullable=True)
    apg = Column(Float, nullable=True)
    spg = Column(Float, nullable=True)
    bpg = Column(Float, nullable=True)
    topg = Column(Float, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  11. RATIOS - TEAMS
# ══════════════════════════════════════════════════════════════════════
class RatiosTeams(Base):
    __tablename__ = "ratios_teams"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team = Column(String(50), nullable=True)
    games = Column(Integer, nullable=True)
    wins = Column(Integer, nullable=True)
    losses = Column(Integer, nullable=True)
    fg_pct = Column(Float, nullable=True)
    fg3_pct = Column(Float, nullable=True)
    ft_pct = Column(Float, nullable=True)
    ppg = Column(Float, nullable=True)
    rpg = Column(Float, nullable=True)
    apg = Column(Float, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  12. PLAYOFF SCHEDULE/RESULTS
# ══════════════════════════════════════════════════════════════════════
class PlayoffScheduleResults(Base):
    __tablename__ = "playoff_schedule_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_name = Column(String(100), nullable=True)
    game_date = Column(Date, nullable=True)
    away_team = Column(String(50), nullable=True)
    home_team = Column(String(50), nullable=True)
    away_score = Column(Integer, nullable=True)
    home_score = Column(Integer, nullable=True)
    series_status = Column(String(100), nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  13. STANDINGS
# ══════════════════════════════════════════════════════════════════════
class Standings(Base):
    __tablename__ = "standings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conference = Column(String(50), nullable=True)
    division = Column(String(255), nullable=True)
    team = Column(String(100), nullable=True)
    wins = Column(Integer, nullable=True)
    losses = Column(Integer, nullable=True)
    pct = Column(Float, nullable=True)
    games_behind = Column(String(30), nullable=True)
    home_record = Column(String(30), nullable=True)
    road_record = Column(String(30), nullable=True)
    last_10 = Column(String(30), nullable=True)
    streak = Column(String(30), nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  14. HEAD-TO-HEAD WIN GRID
# ══════════════════════════════════════════════════════════════════════
class HeadToHeadWinGrid(Base):
    __tablename__ = "head_to_head_win_grid"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team = Column(String(50), nullable=True)
    opponent = Column(String(50), nullable=True)
    wins = Column(Integer, nullable=True)
    losses = Column(Integer, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  15. OFFENSIVE/DEFENSIVE
# ══════════════════════════════════════════════════════════════════════
class OffensiveDefensive(Base):
    __tablename__ = "offensive_defensive"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team = Column(String(50), nullable=True)
    stat_type = Column(String(20), nullable=True)  # OFFENSE ou DEFENSE
    games = Column(Integer, nullable=True)
    fg = Column(Integer, nullable=True)
    fga = Column(Integer, nullable=True)
    fg_pct = Column(Float, nullable=True)
    fg3 = Column(Integer, nullable=True)
    f3a = Column(Integer, nullable=True)
    fg3_pct = Column(Float, nullable=True)
    ft = Column(Integer, nullable=True)
    fta = Column(Integer, nullable=True)
    ft_pct = Column(Float, nullable=True)
    off_reb = Column(Integer, nullable=True)
    def_reb = Column(Integer, nullable=True)
    total_reb = Column(Integer, nullable=True)
    assists = Column(Integer, nullable=True)
    steals = Column(Integer, nullable=True)
    blocks = Column(Integer, nullable=True)
    turnovers = Column(Integer, nullable=True)
    points = Column(Integer, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  16. MISCELLANEOUS
# ══════════════════════════════════════════════════════════════════════
class Miscellaneous(Base):
    __tablename__ = "miscellaneous"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stat_category = Column(String(200), nullable=True)
    value = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  17. OPPONENT POINTS BREAKDOWN
# ══════════════════════════════════════════════════════════════════════
class OpponentPointsBreakdown(Base):
    __tablename__ = "opponent_points_breakdown"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team = Column(String(50), nullable=True)
    opp_fg = Column(Integer, nullable=True)
    opp_fga = Column(Integer, nullable=True)
    opp_fg_pct = Column(Float, nullable=True)
    opp_fg3 = Column(Integer, nullable=True)
    opp_f3a = Column(Integer, nullable=True)
    opp_fg3_pct = Column(Float, nullable=True)
    opp_ft = Column(Integer, nullable=True)
    opp_fta = Column(Integer, nullable=True)
    opp_ft_pct = Column(Float, nullable=True)
    opp_points = Column(Integer, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  18. TEAM BOXSCORE LINES (aba TEAM)
# ══════════════════════════════════════════════════════════════════════
class TeamBoxscoreLines(Base):
    __tablename__ = "team_boxscore_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_date = Column(Date, nullable=True)
    team = Column(String(50), nullable=True)
    opponent = Column(String(50), nullable=True)
    fg = Column(Integer, nullable=True)
    fga = Column(Integer, nullable=True)
    fg_pct = Column(Float, nullable=True)
    fg3 = Column(Integer, nullable=True)
    f3a = Column(Integer, nullable=True)
    fg3_pct = Column(Float, nullable=True)
    ft = Column(Integer, nullable=True)
    fta = Column(Integer, nullable=True)
    ft_pct = Column(Float, nullable=True)
    off_reb = Column(Integer, nullable=True)
    def_reb = Column(Integer, nullable=True)
    total_reb = Column(Integer, nullable=True)
    assists = Column(Integer, nullable=True)
    steals = Column(Integer, nullable=True)
    blocks = Column(Integer, nullable=True)
    turnovers = Column(Integer, nullable=True)
    pf = Column(Integer, nullable=True)
    points = Column(Integer, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  19. TEAM CUMULATIVES (aba TEAM)
# ══════════════════════════════════════════════════════════════════════
class TeamCumulatives(Base):
    __tablename__ = "team_cumulatives"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team = Column(String(50), nullable=True)
    games = Column(Integer, nullable=True)
    fg = Column(Integer, nullable=True)
    fga = Column(Integer, nullable=True)
    fg_pct = Column(Float, nullable=True)
    fg3 = Column(Integer, nullable=True)
    f3a = Column(Integer, nullable=True)
    fg3_pct = Column(Float, nullable=True)
    ft = Column(Integer, nullable=True)
    fta = Column(Integer, nullable=True)
    ft_pct = Column(Float, nullable=True)
    off_reb = Column(Integer, nullable=True)
    def_reb = Column(Integer, nullable=True)
    total_reb = Column(Integer, nullable=True)
    assists = Column(Integer, nullable=True)
    steals = Column(Integer, nullable=True)
    blocks = Column(Integer, nullable=True)
    turnovers = Column(Integer, nullable=True)
    points = Column(Integer, nullable=True)
    raw_line = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
#  Mapeamento rápido: slug → classe do modelo
# ══════════════════════════════════════════════════════════════════════
MODEL_MAP = {
    "latest_boxscore_lines": LatestBoxscoreLines,
    "alphabetical_player_cumulatives": AlphabeticalPlayerCumulatives,
    "alphabetical_rookie_cumulatives": AlphabeticalRookieCumulatives,
    "attendance": Attendance,
    "latest_scores_and_leaders": LatestScoresAndLeaders,
    "single_game_highs_lows": SingleGameHighsLows,
    "top_10_league_leaders": Top10LeagueLeaders,
    "top_20_league_leaders": Top20LeagueLeaders,
    "rookie_league_leaders": RookieLeagueLeaders,
    "ratios_players": RatiosPlayers,
    "ratios_teams": RatiosTeams,
    "playoff_schedule_results": PlayoffScheduleResults,
    "standings": Standings,
    "head_to_head_win_grid": HeadToHeadWinGrid,
    "offensive_defensive": OffensiveDefensive,
    "miscellaneous": Miscellaneous,
    "opponent_points_breakdown": OpponentPointsBreakdown,
    "team_boxscore_lines": TeamBoxscoreLines,
    "team_cumulatives": TeamCumulatives,
}


# ══════════════════════════════════════════════════════════════════════
#  Engine e Session
# ══════════════════════════════════════════════════════════════════════
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


def init_db(drop_existing: bool = False):
    """Cria todas as tabelas no banco de dados.

    Args:
        drop_existing: Se True, remove e recria todas as tabelas.
    """
    if drop_existing:
        Base.metadata.drop_all(engine)
        print("[DB] Tabelas existentes removidas")
    Base.metadata.create_all(engine)
    print(f"[DB] Tabelas criadas/verificadas com sucesso em {DATABASE_URL}")


def get_session():
    """Retorna uma nova sessão do banco."""
    return SessionLocal()
