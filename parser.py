"""
Parsers para cada tipo de arquivo TXT baixado do NBA Elias Stats.

Cada função recebe o texto bruto (str) e retorna uma lista de dicts
prontos para inserção via SQLAlchemy.

IMPORTANTE: Os formatos são baseados nos TXT reais baixados do CDN da NBA
(cdn.nba.com/static/json/staticData/EliasGameStats/00/*.txt).
"""

import re
import logging
from datetime import datetime, date

logger = logging.getLogger(__name__)


# ── Utilitários ────────────────────────────────────────────────────
def _safe_int(value: str) -> int | None:
    """Converte string para int, retornando None se falhar."""
    try:
        return int(value.strip().replace(",", ""))
    except (ValueError, AttributeError):
        return None


def _safe_float(value: str) -> float | None:
    """Converte string para float, retornando None se falhar."""
    try:
        v = value.strip()
        if v == "---":
            return None
        return float(v)
    except (ValueError, AttributeError):
        return None


def _parse_date(date_str: str) -> date | None:
    """Converte MM/DD/YYYY para date."""
    try:
        return datetime.strptime(date_str.strip(), "%m/%d/%Y").date()
    except (ValueError, AttributeError):
        return None


def _clean_lines(text: str) -> list[str]:
    """Retorna linhas não vazias."""
    lines = text.split("\n")
    return [line for line in lines if line.strip()]


# ══════════════════════════════════════════════════════════════════════
#  1. LATEST BOXSCORE LINES
#  Formato:
#  DATE       TM  OPP NAME                     (POS)  G MIN  FG FGA ...
#  02/11/2026 ATL CHA Johnson, Jalen           (F  )  1  34   7  15 ...
# ══════════════════════════════════════════════════════════════════════
def parse_boxscore_lines(text: str) -> list[dict]:
    """Parse de estatísticas diárias de jogadores (boxscore lines)."""
    records = []
    lines = _clean_lines(text)

    pattern = re.compile(
        r"(\d{2}/\d{2}/\d{4})\s+"  # DATA
        r"(\S+)\s+"                 # TIME
        r"(\S+)\s+"                 # ADVERSÁRIO
        r"(.+?)\s+"                 # NOME
        r"\((\S+\s*)\)\s+"          # POSIÇÃO
        r"(\d+)\s+"                 # G
        r"(\d+)\s+"                 # MIN
        r"(\d+)\s+(\d+)\s+"         # FG FGA
        r"(\d+)\s+(\d+)\s+"         # FG3 F3A
        r"(\d+)\s+(\d+)\s+"         # FT FTA
        r"(\d+)\s+(\d+)\s+(\d+)\s+" # OFF DEF TRB
        r"(\d+)\s+"                 # AST
        r"(\d+)\s+(\d+)\s+"         # PF DQ
        r"(\d+)\s+(\d+)\s+(\d+)\s+" # STL TO BLK
        r"(\d+)"                    # PTS
    )
    for line in lines:
        m = pattern.search(line)
        if m:
            records.append({
                "game_date": _parse_date(m.group(1)),
                "team": m.group(2).strip(),
                "opponent": m.group(3).strip(),
                "player_name": m.group(4).strip().rstrip(",").strip(),
                "position": m.group(5).strip(),
                "games": _safe_int(m.group(6)),
                "minutes": _safe_int(m.group(7)),
                "fg": _safe_int(m.group(8)),
                "fga": _safe_int(m.group(9)),
                "fg3": _safe_int(m.group(10)),
                "f3a": _safe_int(m.group(11)),
                "ft": _safe_int(m.group(12)),
                "fta": _safe_int(m.group(13)),
                "off_reb": _safe_int(m.group(14)),
                "def_reb": _safe_int(m.group(15)),
                "total_reb": _safe_int(m.group(16)),
                "assists": _safe_int(m.group(17)),
                "pf": _safe_int(m.group(18)),
                "dq": _safe_int(m.group(19)),
                "steals": _safe_int(m.group(20)),
                "turnovers": _safe_int(m.group(21)),
                "blocks": _safe_int(m.group(22)),
                "points": _safe_int(m.group(23)),
            })

    logger.debug(f"[PARSER] parse_boxscore_lines: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  2/3. ALPHABETICAL PLAYER CUMULATIVES / ROOKIE CUMULATIVES
#  Formato:
#  Total SAC ACT Achiuwa, Precious, Sac.  48 32  973  144  288 .500  16  54 .296 ...
# ══════════════════════════════════════════════════════════════════════
def parse_player_cumulatives(text: str) -> list[dict]:
    """Parse de estatísticas cumulativas de jogadores (season/rookies)."""
    records = []
    lines = _clean_lines(text)

    pattern = re.compile(
        r"^(Total|Team)\s+"        # SCOPE
        r"(\S+)\s+"                # TM (sigla)
        r"(\S+)\s+"                # RS (status: ACT, TR, NWT, TRC)
        r"(.+?)\s+"                # NOME completo com time
        r"(\d+)\s+"                # G
        r"(\d+)\s+"                # GS
        r"(\d+)\s+"                # MIN
        r"(\d+)\s+(\d+)\s+"        # FG FGA
        r"(\.\d+|1\.000|---)\s+"   # FG PCT
        r"(\d+)\s+(\d+)\s+"        # FG3 FG3A
        r"(\.\d+|1\.000|---)\s+"   # FG3 PCT
        r"(\d+)\s+(\d+)\s+"        # FT FTA
        r"(\.\d+|1\.000|---)\s+"   # FT PCT
        r"(\d+)\s+(\d+)\s+(\d+)\s+"# OFF DEF TREB
        r"(\d+)\s+"                # AST
        r"(\d+)\s+(\d+)\s+"        # PF DQ
        r"(\d+)\s+(\d+)\s+(\d+)\s+"# STL TO BLK
        r"(\d+)\s+"                # PTS
        r"([\d\.]+)\s+"            # PPG
        r"(\d+)"                   # HI
    )

    for line in lines:
        m = pattern.search(line)
        if m:
            name_raw = m.group(4).strip().rstrip(",").strip()
            team_abbr = m.group(2).strip()
            records.append({
                "player_name": name_raw,
                "team": team_abbr,
                "position": None,
                "games": _safe_int(m.group(5)),
                "minutes": _safe_int(m.group(7)),
                "fg": _safe_int(m.group(8)),
                "fga": _safe_int(m.group(9)),
                "fg3": _safe_int(m.group(11)),
                "f3a": _safe_int(m.group(12)),
                "ft": _safe_int(m.group(14)),
                "fta": _safe_int(m.group(15)),
                "off_reb": _safe_int(m.group(17)),
                "def_reb": _safe_int(m.group(18)),
                "total_reb": _safe_int(m.group(19)),
                "assists": _safe_int(m.group(20)),
                "pf": _safe_int(m.group(21)),
                "dq": _safe_int(m.group(22)),
                "steals": _safe_int(m.group(23)),
                "turnovers": _safe_int(m.group(24)),
                "blocks": _safe_int(m.group(25)),
                "points": _safe_int(m.group(26)),
            })

    logger.debug(f"[PARSER] parse_player_cumulatives: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  4. ATTENDANCE
#  Formato:
#  Atlanta Hawks                   25    406,165 16,247    31    548,915 17,707
# ══════════════════════════════════════════════════════════════════════
def parse_attendance(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)

    pattern = re.compile(
        r"^([A-Z][A-Za-z\s\.]+?)\s+"
        r"(\d+)\s+"                 # HOME G
        r"([\d,]+)\s+"              # HOME ATT
        r"([\d,]+)\s+"              # HOME AVG
        r"(\d+)\s+"                 # ROAD G
        r"([\d,]+)\s+"              # ROAD ATT
        r"([\d,]+)\s*$"             # ROAD AVG
    )

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("TOTALS") or stripped.startswith("TEAM") or stripped.startswith("INCLUDES"):
            continue
        if "HOME ATTENDANCE" in stripped or "ROAD ATTENDANCE" in stripped:
            continue

        m = pattern.match(stripped)
        if m:
            team_name = m.group(1).strip()
            home_g = _safe_int(m.group(2))
            home_att = _safe_int(m.group(3))
            home_avg = _safe_int(m.group(4))
            road_g = _safe_int(m.group(5))
            road_att = _safe_int(m.group(6))
            road_avg = _safe_int(m.group(7))

            overall_g = (home_g or 0) + (road_g or 0)
            overall_att = (home_att or 0) + (road_att or 0)
            overall_avg = overall_att // overall_g if overall_g else None

            records.append({
                "team": team_name,
                "home_games": home_g,
                "home_total": home_att,
                "home_avg": home_avg,
                "road_games": road_g,
                "road_total": road_att,
                "road_avg": road_avg,
                "overall_games": overall_g,
                "overall_total": overall_att,
                "overall_avg": overall_avg,
                "raw_line": stripped,
            })

    logger.debug(f"[PARSER] parse_attendance: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  5. LATEST SCORES AND LEADERS
#  Formato em pares de linhas:
#  Atlanta        107 27 22 26 32            Daniels 21       Johnson 13       Johnson 9
#  Charlotte      110 35 23 31 21            Miller 31        Hall 10          Ball 6
# ══════════════════════════════════════════════════════════════════════
def parse_scores_leaders(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)

    # Header da data
    date_val = None
    for line in lines:
        dm = re.search(r"GAMES OF\s+(\w+),\s+(\w+)\s+(\d+),\s+(\d{4})", line, re.IGNORECASE)
        if dm:
            try:
                date_str = f"{dm.group(2)} {dm.group(3)}, {dm.group(4)}"
                date_val = datetime.strptime(date_str, "%B %d, %Y").date()
            except ValueError:
                date_val = None
            break

    # Captura linhas com time e score
    score_pattern = re.compile(
        r"^([A-Z][A-Za-z\.\s]+?)\s+"
        r"(\d+)\s+"              # TOT
        r"(\d+)\s+(\d+)\s+(\d+)\s+(\d+)"  # Q1 Q2 Q3 Q4
    )

    game_lines = []
    for line in lines:
        m = score_pattern.match(line.strip())
        if m:
            game_lines.append({
                "team": m.group(1).strip(),
                "score": _safe_int(m.group(2)),
                "raw_line": line.strip(),
            })

    # Os jogos vêm em pares (away, home)
    for i in range(0, len(game_lines) - 1, 2):
        away = game_lines[i]
        home = game_lines[i + 1]
        records.append({
            "game_date": date_val,
            "away_team": away["team"],
            "home_team": home["team"],
            "away_score": away["score"],
            "home_score": home["score"],
            "leader_points": None,
            "leader_rebounds": None,
            "leader_assists": None,
            "raw_line": f"{away['raw_line']} | {home['raw_line']}",
        })

    logger.debug(f"[PARSER] parse_scores_leaders: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  6. SINGLE-GAME HIGHS/LOWS
#  Formato:
#  Minutes -- 52, Maxey, PHI vs. ATL, 11/30 (2 OT)
#  Fewest Field Goals -- 23, Brooklyn at NY, 1/21
# ══════════════════════════════════════════════════════════════════════
def parse_highs_lows(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("INCLUDES") or stripped.startswith("SINGLE-GAME"):
            continue

        # Formato: Category -- value, rest
        m = re.match(r"(.+?)\s+--\s+(\d+),\s*(.+)", stripped)
        if m:
            category = m.group(1).strip()
            value = _safe_int(m.group(2))
            rest = m.group(3).strip()

            stat_type = "LOW" if "Fewest" in category or "Lowest" in category else "HIGH"

            player_name = None
            team = None
            opponent = None

            # Padrão jogador: "Player, TEAM vs. OPP, date"
            pm = re.match(r"(.+?),\s*(\w{2,4})\s+(?:vs\.?|at)\s+(\w{2,4}),\s*(\d{1,2}/\d{1,2})", rest)
            if pm:
                player_name = pm.group(1).strip()
                team = pm.group(2).strip()
                opponent = pm.group(3).strip()
            else:
                # Padrão time: "Team Name vs. OPP, date"
                tm = re.match(r"(.+?)\s+(?:vs\.?|at)\s+(\w{2,4}),\s*(\d{1,2}/\d{1,2})", rest)
                if tm:
                    player_name = tm.group(1).strip()
                    opponent = tm.group(2).strip()

            records.append({
                "category": category,
                "stat_type": stat_type,
                "value": value,
                "player_name": player_name,
                "team": team,
                "opponent": opponent,
                "game_date": None,
                "raw_line": stripped,
            })

    logger.debug(f"[PARSER] parse_highs_lows: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  7/8/9. LEAGUE LEADERS (Top 10, Top 20, Rookie)
#  Formato multi-coluna lado a lado:
#  SCORING AVERAGE        G   FG  FT  PTS  AVG     REBOUNDS PER GAME ...
#  Doncic, LA-L          42  437 356 1379 32.8     Jokic, Den.       39 ...
# ══════════════════════════════════════════════════════════════════════
def parse_league_leaders(text: str) -> list[dict]:
    """Parse de league leaders. Formato multi-coluna com alinhamento fixo."""
    records = []
    lines = _clean_lines(text)

    current_categories = []

    header_pattern = re.compile(
        r"(SCORING AVERAGE|REBOUNDS PER GAME|ASSISTS PER GAME|"
        r"FIELD GOAL PCT\.|3-PT FIELD GOAL PCT\.|FREE THROW PCT\.|"
        r"STEALS PER GAME|BLOCKS PER GAME|MINUTES PER GAME)"
    )

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("INCLUDES") or stripped.startswith("ROOKIE LEADERS"):
            continue

        # Checa se é uma linha de header
        headers = header_pattern.findall(stripped)
        if headers:
            current_categories = headers
            continue

        if not current_categories:
            continue

        # Divide a linha em segmentos por espaçamento largo (4+ espaços)
        segments = re.split(r"\s{4,}", stripped)

        for i, segment in enumerate(segments):
            segment = segment.strip()
            if not segment:
                continue

            cat = current_categories[i] if i < len(current_categories) else (
                current_categories[-1] if current_categories else None
            )

            # Extrai: "Player, Team    NUM NUM ... AVG"
            pm = re.match(r"(.+?)\s{2,}([\d\.\s]+)$", segment)
            if pm:
                player_part = pm.group(1).strip()
                nums_part = pm.group(2).strip().split()

                if nums_part:
                    value = _safe_float(nums_part[-1])

                    # Separa nome e time: "Doncic, LA-L" ou "G. Antetokounmpo, Mil"
                    name_parts = player_part.rsplit(",", 1)
                    if len(name_parts) == 2:
                        player_name = name_parts[0].strip()
                        team = name_parts[1].strip().rstrip(".")
                    else:
                        player_name = player_part
                        team = None

                    records.append({
                        "stat_category": cat,
                        "rank": None,
                        "player_name": player_name,
                        "team": team,
                        "value": value,
                        "raw_line": segment.strip(),
                    })

    logger.debug(f"[PARSER] parse_league_leaders: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  10. RATIOS - PLAYERS
#  Formato lado a lado:
#  Assists Per Turnover                        Steals Per Turnover
#  Name                     AST   TO RATIO     Name                     STL   TO RATIO
#  Pritchard, Bos.          283   63  4.49     Wallace, OKC.            108   48  2.25
# ══════════════════════════════════════════════════════════════════════
def parse_ratios_players(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("INCLUDES") or stripped.startswith("Name"):
            continue
        if stripped in ("Assists Per Turnover", "Steals Per Turnover"):
            continue
        if "Assists Per Turnover" in stripped and "Steals Per Turnover" in stripped:
            continue

        # Dados lado a lado; divide por 4+ espaços
        segments = re.split(r"\s{4,}", stripped)

        for seg in segments:
            seg = seg.strip()
            if not seg or seg.startswith("Name"):
                continue

            # "Pritchard, Bos.          283   63  4.49"
            m = re.match(r"(.+?)\s{2,}(\d+)\s+(\d+)\s+([\d\.]+)", seg)
            if m:
                player_raw = m.group(1).strip()
                val1 = _safe_int(m.group(2))
                val2 = _safe_int(m.group(3))
                ratio = _safe_float(m.group(4))

                name_parts = player_raw.rsplit(",", 1)
                if len(name_parts) == 2:
                    player_name = name_parts[0].strip()
                    team = name_parts[1].strip().rstrip(".")
                else:
                    player_name = player_raw
                    team = None

                records.append({
                    "player_name": player_name,
                    "team": team,
                    "games": None,
                    "minutes": None,
                    "fg_pct": None,
                    "fg3_pct": None,
                    "ft_pct": None,
                    "ppg": ratio,
                    "rpg": _safe_float(str(val1)) if val1 else None,
                    "apg": _safe_float(str(val2)) if val2 else None,
                    "spg": None,
                    "bpg": None,
                    "topg": None,
                    "raw_line": seg.strip(),
                })

    logger.debug(f"[PARSER] parse_ratios_players: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  11. RATIOS - TEAMS
#  Formato lado a lado:
#  Denver                  1539  701  2.20     Oklahoma City            544  682  0.80
# ══════════════════════════════════════════════════════════════════════
def parse_ratios_teams(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)

    for line in lines:
        stripped = line.strip()

        if (stripped.startswith("INCLUDES") or stripped.startswith("Name")
                or "Assists" in stripped or "Steals" in stripped):
            continue

        segments = re.split(r"\s{4,}", stripped)

        for seg in segments:
            seg = seg.strip()
            if not seg or seg.startswith("Name"):
                continue

            m = re.match(r"([A-Z][A-Za-z\.\s]+?)\s{2,}(\d+)\s+(\d+)\s+([\d\.]+)", seg)
            if m:
                team_name = m.group(1).strip()
                val1 = _safe_int(m.group(2))
                val2 = _safe_int(m.group(3))
                ratio = _safe_float(m.group(4))

                records.append({
                    "team": team_name,
                    "games": None,
                    "wins": None,
                    "losses": None,
                    "fg_pct": None,
                    "fg3_pct": None,
                    "ft_pct": None,
                    "ppg": ratio,
                    "rpg": _safe_float(str(val1)) if val1 else None,
                    "apg": _safe_float(str(val2)) if val2 else None,
                    "raw_line": seg.strip(),
                })

    logger.debug(f"[PARSER] parse_ratios_teams: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  12. PLAYOFF SCHEDULE/RESULTS
#  Formato:
#  Apr 20 MIA 100 at CLE 121
# ══════════════════════════════════════════════════════════════════════
def parse_playoff_schedule(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)
    current_round = None
    current_series = None

    for line in lines:
        stripped = line.strip()

        if not stripped or "2024-2025" in stripped or "NBA POSTSEASON" in stripped:
            continue

        # Detecta nome da rodada
        if stripped in ("FIRST ROUND", "CONFERENCE SEMIFINALS", "CONFERENCE FINALS", "NBA FINALS"):
            current_round = stripped
            continue

        if stripped in ("EASTERN CONFERENCE", "WESTERN CONFERENCE"):
            continue

        # Detecta série: "TEAM vs. Team"
        if " vs. " in stripped and not stripped.startswith("("):
            current_series = stripped
            continue

        if stripped.startswith("(") and "WON" in stripped:
            continue

        # Captura resultado: "Apr 20 MIA 100 at CLE 121"
        m = re.match(
            r"(\w+\s+\d+)\s+"
            r"(\S+)\s+(\d+)\s+"
            r"at\s+"
            r"(\S+)\s+(\d+)",
            stripped
        )
        if m:
            records.append({
                "round_name": current_round,
                "game_date": None,
                "away_team": m.group(2).strip(),
                "home_team": m.group(4).strip(),
                "away_score": _safe_int(m.group(3)),
                "home_score": _safe_int(m.group(5)),
                "series_status": current_series,
                "raw_line": stripped,
            })

    logger.debug(f"[PARSER] parse_playoff_schedule: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  13. STANDINGS
#  Formato lado-a-lado (East à esquerda, West à direita):
#  Boston              35 19  .648    -  18- 9 17-10     0- 0  7-3   Won   1
# ══════════════════════════════════════════════════════════════════════
def parse_standings(text: str) -> list[dict]:
    records = []
    lines = text.split("\n")

    current_east_div = None
    current_west_div = None

    for line in lines:
        if not line.strip():
            continue

        if "EASTERN CONFERENCE" in line and "WESTERN CONFERENCE" in line:
            continue

        # Detecta divisões
        if "DIVISION" in line:
            parts = re.findall(r"(\w[\w\s]+DIVISION)", line)
            if len(parts) >= 2:
                current_east_div = parts[0].strip()
                current_west_div = parts[1].strip()
            elif len(parts) == 1:
                p = parts[0].strip()
                if "ATLANTIC" in p or "CENTRAL" in p or "SOUTHEAST" in p:
                    current_east_div = p
                else:
                    current_west_div = p
            continue

        if re.match(r"^\s*W\s+L\s+PCT", line.strip()) or line.strip().startswith("Scheduled"):
            continue

        team_pattern = re.compile(
            r"([A-Z][A-Za-z\.\s]+?)\s+"
            r"(\d+)\s+(\d+)\s+"           # W L
            r"(\.\d+)\s+"                 # PCT
            r"([\d\.]+|-+)\s+"            # GB
            r"(\d+\s*-\s*\d+)\s+"         # HOME
            r"(\d+\s*-\s*\d+)\s+"         # ROAD
            r"(\d+\s*-\s*\d+)\s+"         # NEUTRAL
            r"(\d+\s*-\s*\d+)\s+"         # LAST-10
            r"(Won|Lost)\s+"              # STREAK direction
            r"(\d+)"                      # STREAK count
        )

        # Divide a linha: cols 0-84 = East, cols 85+ = West
        left_part = line[:85] if len(line) > 85 else line
        right_part = line[85:] if len(line) > 85 else ""

        for part, conference, division in [
            (left_part, "EASTERN", current_east_div),
            (right_part, "WESTERN", current_west_div),
        ]:
            if not part.strip():
                continue

            m = team_pattern.search(part)
            if m:
                records.append({
                    "conference": conference,
                    "division": division,
                    "team": m.group(1).strip(),
                    "wins": _safe_int(m.group(2)),
                    "losses": _safe_int(m.group(3)),
                    "pct": _safe_float(m.group(4)),
                    "games_behind": m.group(5).strip() if m.group(5).strip() != "-" else "0",
                    "home_record": m.group(6).strip(),
                    "road_record": m.group(7).strip(),
                    "last_10": m.group(9).strip(),
                    "streak": f"{m.group(10)} {m.group(11)}",
                    "raw_line": part.strip(),
                })

    logger.debug(f"[PARSER] parse_standings: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  14. HEAD-TO-HEAD WIN GRID
#  Formato grade de abreviações com recordes W-L:
#     ATL   BKN   CHI   ...
#  BOS  1 --  2  0  2  2 ...  35 19  .648   -    7-3  Won   1
# ══════════════════════════════════════════════════════════════════════
def parse_head_to_head(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)

    # Extrair siglas do header (2 linhas com apenas siglas)
    team_columns = []
    data_started = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("INCLUDES") or "DIVISION" in stripped:
            continue

        # Header de siglas
        parts = stripped.split()
        if parts and all(len(p) <= 4 and p.isalpha() for p in parts) and len(parts) >= 10:
            team_columns.extend(parts)
            continue

        # Linhas com dados
        if parts and len(parts) > 10 and team_columns:
            team_abbr = parts[0]
            if len(team_abbr) <= 4 and team_abbr.isalpha():
                # Encontra pares W-L
                rest = stripped[len(team_abbr):].strip()
                tokens = re.findall(r"\d+|--", rest)

                opp_idx = 0
                tok_idx = 0
                while tok_idx < len(tokens) and opp_idx < len(team_columns):
                    w_tok = tokens[tok_idx]

                    if w_tok == "--":
                        tok_idx += 1
                        opp_idx += 1
                        continue

                    if tok_idx + 1 < len(tokens):
                        l_tok = tokens[tok_idx + 1]
                        if l_tok == "--":
                            tok_idx += 1
                            continue

                        # Verifica se ainda estamos nos head-to-head
                        # (depois vêm totais como W L PCT GB)
                        w_val = _safe_int(w_tok)
                        l_val = _safe_int(l_tok)
                        if w_val is not None and l_val is not None and w_val <= 4 and l_val <= 4:
                            records.append({
                                "team": team_abbr,
                                "opponent": team_columns[opp_idx] if opp_idx < len(team_columns) else "?",
                                "wins": w_val,
                                "losses": l_val,
                                "raw_line": stripped[:60],
                            })
                            tok_idx += 2
                            opp_idx += 1
                        else:
                            # Chegamos nos totais, para
                            break
                    else:
                        break

    logger.debug(f"[PARSER] parse_head_to_head: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  15. OFFENSIVE/DEFENSIVE (Teams' Statistics + Opponents')
#  Formato:
#  TEAM     G   MADE  ATT. PCT. MADE  ATT. PCT.  MADE  ATT. PCT.   OFF. DEF. TOT. ...
#  Den.    55   2356 4761 .495   755 1910 .395   1153 1423 .810    526 1821 2347 ...
# ══════════════════════════════════════════════════════════════════════
def parse_offensive_defensive(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)
    current_type = None

    for line in lines:
        stripped = line.strip()

        if "TEAMS' STATISTICS" in stripped.upper() or "TEAMS\u2019 STATISTICS" in stripped.upper():
            current_type = "OFFENSE"
            continue
        elif "OPPONENTS' STATISTICS" in stripped.upper() or "OPPONENTS\u2019 STATISTICS" in stripped.upper():
            current_type = "DEFENSE"
            continue

        if stripped.startswith("TEAM") or stripped.startswith("INCLUDES"):
            continue
        if "FIELD GOALS" in stripped or "REBOUNDS" in stripped or "SCORING" in stripped:
            continue

        # Tenta capturar linha de time com muitos campos numéricos
        parts = stripped.split()
        if not parts or current_type is None:
            continue

        team_abbr = parts[0].rstrip(".")

        if current_type == "OFFENSE" and len(parts) >= 21:
            try:
                games = _safe_int(parts[1])
                if games and 0 < games < 100:
                    records.append({
                        "team": team_abbr,
                        "stat_type": current_type,
                        "games": games,
                        "fg": _safe_int(parts[2]),
                        "fga": _safe_int(parts[3]),
                        "fg_pct": _safe_float(parts[4]),
                        "fg3": _safe_int(parts[5]),
                        "f3a": _safe_int(parts[6]),
                        "fg3_pct": _safe_float(parts[7]),
                        "ft": _safe_int(parts[8]),
                        "fta": _safe_int(parts[9]),
                        "ft_pct": _safe_float(parts[10]),
                        "off_reb": _safe_int(parts[11]),
                        "def_reb": _safe_int(parts[12]),
                        "total_reb": _safe_int(parts[13]),
                        "assists": _safe_int(parts[14]),
                        "steals": _safe_int(parts[17]),
                        "blocks": _safe_int(parts[19]),
                        "turnovers": _safe_int(parts[18]),
                        "points": _safe_int(parts[20]),
                        "raw_line": stripped,
                    })
            except (ValueError, IndexError):
                continue
        elif current_type == "DEFENSE" and len(parts) >= 19:
            try:
                fg = _safe_int(parts[1])
                if fg and fg > 100:
                    records.append({
                        "team": team_abbr,
                        "stat_type": current_type,
                        "games": None,
                        "fg": fg,
                        "fga": _safe_int(parts[2]),
                        "fg_pct": _safe_float(parts[3]),
                        "fg3": _safe_int(parts[4]),
                        "f3a": _safe_int(parts[5]),
                        "fg3_pct": _safe_float(parts[6]),
                        "ft": _safe_int(parts[7]),
                        "fta": _safe_int(parts[8]),
                        "ft_pct": _safe_float(parts[9]),
                        "off_reb": _safe_int(parts[10]),
                        "def_reb": _safe_int(parts[11]),
                        "total_reb": _safe_int(parts[12]),
                        "assists": _safe_int(parts[13]),
                        "steals": None,
                        "blocks": None,
                        "turnovers": None,
                        "points": _safe_int(parts[-3]) if len(parts) >= 19 else None,
                        "raw_line": stripped,
                    })
            except (ValueError, IndexError):
                continue

    logger.debug(f"[PARSER] parse_offensive_defensive: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  16. MISCELLANEOUS
#  Formato:
#  TEAM                    OWN    OPP.    OWN   OPP.    OWN   OPP. ...
#  Atlanta               117.3  118.6    .472  .476    14.3  15.9 ...
# ══════════════════════════════════════════════════════════════════════
def parse_miscellaneous(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)

    skip_keywords = (
        "INCLUDES", "TEAM", "COMPOSITE", "* -", "REBOUND PERC",
        "OFF.", "DEF.", "TOT.", "POINTS", "FIELD GOAL", "TURNOVERS",
        "REBOUND", "DECIDED", "BELOW", "OVERTIME",
    )

    for line in lines:
        stripped = line.strip()

        if any(stripped.startswith(kw) for kw in skip_keywords):
            continue

        # Dados de time
        m = re.match(r"^([A-Z][A-Za-z\.\s]+?)\s{2,}([\d\.\s\*\-]+)", stripped)
        if m:
            team_name = m.group(1).strip()
            if len(team_name) > 2:
                records.append({
                    "stat_category": "Team Miscellaneous",
                    "value": m.group(2).strip()[:200],
                    "description": None,
                    "raw_line": stripped,
                })

    logger.debug(f"[PARSER] parse_miscellaneous: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  17. OPPONENT POINTS BREAKDOWN
#  Formato:
#  Team                  InPaint  PerGame PctofTot   TotPts    Games   Tot/Gm
#  New Orleans              3200   57.143   49.868     6417       56  114.589
# ══════════════════════════════════════════════════════════════════════
def parse_opponent_points(text: str) -> list[dict]:
    records = []
    lines = _clean_lines(text)

    skip_keywords = ("INCLUDES", "Team", "TOTALS", "Points-in", "Fast Break", "Second Chance")

    for line in lines:
        stripped = line.strip()

        if any(stripped.startswith(kw) for kw in skip_keywords):
            continue

        m = re.match(
            r"^([A-Z][A-Za-z\.\s]+?)\s{2,}(\d+)\s+([\d\.]+)\s+([\d\.]+)\s+(\d+)\s+(\d+)\s+([\d\.]+)",
            stripped
        )
        if m:
            records.append({
                "team": m.group(1).strip(),
                "opp_fg": _safe_int(m.group(2)),
                "opp_fga": None,
                "opp_fg_pct": _safe_float(m.group(3)),
                "opp_fg3": None,
                "opp_f3a": None,
                "opp_fg3_pct": _safe_float(m.group(4)),
                "opp_ft": None,
                "opp_fta": None,
                "opp_ft_pct": None,
                "opp_points": _safe_int(m.group(5)),
                "raw_line": stripped,
            })

    logger.debug(f"[PARSER] parse_opponent_points: {len(records)} registros de {len(lines)} linhas")
    return records


# ══════════════════════════════════════════════════════════════════════
#  Parser genérico — usado quando não existe parser específico
# ══════════════════════════════════════════════════════════════════════
def parse_generic(text: str) -> list[dict]:
    """Faz parse genérico — cada linha se torna um registro raw."""
    records = []
    for line in _clean_lines(text):
        if not line.strip().startswith("INCLUDES") and len(line.strip()) > 3:
            records.append({"raw_line": line.strip()})
    return records


# ══════════════════════════════════════════════════════════════════════
#  Mapeamento slug → função parser
# ══════════════════════════════════════════════════════════════════════
PARSER_MAP = {
    "latest_boxscore_lines": parse_boxscore_lines,
    "alphabetical_player_cumulatives": parse_player_cumulatives,
    "alphabetical_rookie_cumulatives": parse_player_cumulatives,
    "attendance": parse_attendance,
    "latest_scores_and_leaders": parse_scores_leaders,
    "single_game_highs_lows": parse_highs_lows,
    "top_10_league_leaders": parse_league_leaders,
    "top_20_league_leaders": parse_league_leaders,
    "rookie_league_leaders": parse_league_leaders,
    "ratios_players": parse_ratios_players,
    "ratios_teams": parse_ratios_teams,
    "playoff_schedule_results": parse_playoff_schedule,
    "standings": parse_standings,
    "head_to_head_win_grid": parse_head_to_head,
    "offensive_defensive": parse_offensive_defensive,
    "miscellaneous": parse_miscellaneous,
    "opponent_points_breakdown": parse_opponent_points,
    "team_boxscore_lines": parse_boxscore_lines,
    "team_cumulatives": parse_generic,
}
