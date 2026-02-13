"""
NBA Stats Scraper — Ponto de entrada principal.

Executa o fluxo completo:
  1. Inicializa o banco de dados PostgreSQL (cria tabelas)
  2. Abre o Chrome com Selenium
  3. Navega até a página do NBA Media Central Game Stats
  4. Captura os links de download de cada categoria
  5. Baixa o conteúdo TXT de cada link
  6. Faz o parse dos dados
  7. Salva tudo no PostgreSQL (dados brutos + parsed)
"""

import os
import sys
import shutil
import logging
from datetime import datetime

from config import CATEGORY_SLUG_MAP, DOWNLOAD_DIR
from database import init_db, get_session, engine, Base, ScrapeRun, RawData, MODEL_MAP
from scraper import NBAStatsScraper
from parser import PARSER_MAP
from sqlalchemy import text

# ── Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("nba_scraper.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


def cleanup_before_run():
    """
    Limpeza pré-execução:
      1. Remove todos os arquivos da pasta downloads/
      2. Trunca todas as tabelas de dados (preserva scrape_runs)
    """
    # ── 1. Limpar pasta de downloads ──
    if os.path.exists(DOWNLOAD_DIR):
        count = 0
        for f in os.listdir(DOWNLOAD_DIR):
            fpath = os.path.join(DOWNLOAD_DIR, f)
            try:
                if os.path.isfile(fpath):
                    os.remove(fpath)
                    count += 1
            except Exception as e:
                logger.warning(f"[CLEANUP] Erro ao remover {fpath}: {e}")
        logger.info(f"[CLEANUP] {count} arquivos removidos de {DOWNLOAD_DIR}")
    else:
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        logger.info(f"[CLEANUP] Pasta criada: {DOWNLOAD_DIR}")

    # ── 2. Truncar tabelas de dados ──
    tables_to_truncate = [
        "raw_data",
        "latest_boxscore_lines",
        "alphabetical_player_cumulatives",
        "alphabetical_rookie_cumulatives",
        "attendance",
        "latest_scores_and_leaders",
        "single_game_highs_lows",
        "top_10_league_leaders",
        "top_20_league_leaders",
        "rookie_league_leaders",
        "ratios_players",
        "ratios_teams",
        "playoff_schedule_results",
        "standings",
        "head_to_head_win_grid",
        "offensive_defensive",
        "miscellaneous",
        "opponent_points_breakdown",
        "team_boxscore_lines",
        "team_cumulatives",
    ]

    with engine.connect() as conn:
        for table_name in tables_to_truncate:
            try:
                conn.execute(text(f'TRUNCATE TABLE "{table_name}" CASCADE'))
                conn.commit()
                logger.debug(f"[CLEANUP] Tabela '{table_name}' truncada")
            except Exception as e:
                conn.rollback()
                logger.warning(f"[CLEANUP] Erro ao truncar '{table_name}': {e}")

    logger.info(f"[CLEANUP] {len(tables_to_truncate)} tabelas truncadas")


def save_to_database(scraped_data: list[dict], run_id: int):
    """
    Salva os dados coletados no banco de dados.

    Para cada categoria:
      - Salva o conteúdo bruto na tabela `raw_data`
      - Faz parse e salva os dados estruturados na tabela específica
    """
    session = get_session()
    categories_ok = 0

    try:
        for item in scraped_data:
            category = item["category"]
            slug = item["slug"]
            url = item.get("url", "")
            content = item.get("content")

            if not content:
                logger.warning(f"[DB] Sem conteúdo para: {category}")
                continue

            # ── 1. Salva dado bruto ────────────────────────────────
            raw = RawData(
                category=category,
                category_slug=slug,
                source_url=url,
                raw_content=content,
                scrape_run_id=run_id,
            )
            session.add(raw)
            session.flush()
            logger.info(f"[DB] Dado bruto salvo: {category} ({len(content)} chars)")

            # ── 2. Parse e salva dados estruturados ────────────────
            parser_func = PARSER_MAP.get(slug)
            model_class = MODEL_MAP.get(slug)

            if parser_func and model_class:
                try:
                    parsed_records = parser_func(content)
                    if parsed_records:
                        for record in parsed_records:
                            obj = model_class(**record)
                            session.add(obj)
                        logger.info(
                            f"[DB] {len(parsed_records)} registros parsed salvos em '{slug}'"
                        )
                        categories_ok += 1
                    else:
                        logger.warning(f"[DB] Parser retornou 0 registros para: {category}")
                except Exception as e:
                    logger.error(f"[DB] Erro no parse de {category}: {e}")
                    # Ainda salva o dado bruto (já adicionado acima)
            else:
                logger.info(
                    f"[DB] Sem parser/modelo específico para '{slug}' — "
                    f"dado bruto salvo"
                )
                categories_ok += 1

        session.commit()
        logger.info(f"[DB] Commit realizado — {categories_ok} categorias processadas")

    except Exception as e:
        session.rollback()
        logger.error(f"[DB] Erro geral ao salvar: {e}")
        raise
    finally:
        session.close()

    return categories_ok


def main():
    """Função principal — orquestra todo o fluxo."""
    logger.info("=" * 60)
    logger.info("  NBA STATS SCRAPER — Iniciando")
    logger.info("=" * 60)

    # ── 1. Inicializa banco ────────────────────────────────────────
    logger.info("[INIT] Criando/verificando tabelas no PostgreSQL...")
    init_db(drop_existing=True)

    # ── 1.5. Limpeza pré-execução ─────────────────────────────────
    logger.info("[CLEANUP] Limpando dados anteriores...")
    cleanup_before_run()

    # ── 2. Registra execução ───────────────────────────────────────
    session = get_session()
    run = ScrapeRun(started_at=datetime.utcnow(), status="running")
    session.add(run)
    session.commit()
    run_id = run.id
    session.close()
    logger.info(f"[INIT] Execução #{run_id} registrada")

    # ── 3. Scraping com Selenium ───────────────────────────────────
    scraper = NBAStatsScraper()
    scraped_data = []

    try:
        scraper.start_browser()
        scraped_data = scraper.scrape_all()
    except Exception as e:
        logger.error(f"[SCRAPER] Erro fatal: {e}")
        # Atualiza status da execução
        session = get_session()
        run = session.query(ScrapeRun).get(run_id)
        if run:
            run.status = "error"
            run.finished_at = datetime.utcnow()
            run.error_message = str(e)
            session.commit()
        session.close()
        raise
    finally:
        scraper.stop_browser()

    # ── 4. Salva no banco ──────────────────────────────────────────
    if scraped_data:
        logger.info(f"[SAVE] Salvando {len(scraped_data)} categorias no banco...")
        categories_ok = save_to_database(scraped_data, run_id)
    else:
        logger.warning("[SAVE] Nenhum dado coletado!")
        categories_ok = 0

    # ── 5. Atualiza status da execução ─────────────────────────────
    session = get_session()
    run = session.query(ScrapeRun).get(run_id)
    if run:
        run.status = "success"
        run.finished_at = datetime.utcnow()
        run.categories_scraped = categories_ok
        session.commit()
    session.close()

    # ── Resumo final ───────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info(f"  CONCLUÍDO — Execução #{run_id}")
    logger.info(f"  Categorias coletadas: {len(scraped_data)}")
    logger.info(f"  Categorias salvas com sucesso: {categories_ok}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
