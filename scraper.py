"""
Scraper Selenium para o NBA Media Central Game Stats.

Usa as URLs diretas conhecidas do CDN (extraídas do HTML da página).
Abre o navegador, navega pela página para estabelecer a sessão/cookies,
depois acessa cada URL .txt usando a sessão autenticada do browser.
"""

import os
import re
import time
import logging
from typing import Optional

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
    WebDriverException,
)
from webdriver_manager.chrome import ChromeDriverManager

from config import NBA_STATS_URL, HEADLESS, DOWNLOAD_DIR, CATEGORY_URLS

logger = logging.getLogger(__name__)


class NBAStatsScraper:
    """Scraper para NBA Media Central Game Stats usando Selenium."""

    def __init__(self):
        self.driver: Optional[webdriver.Chrome] = None
        self.wait: Optional[WebDriverWait] = None

    # ── Setup / Teardown ───────────────────────────────────────────
    def start_browser(self):
        """Inicializa o Chrome com as opções configuradas."""
        chrome_options = Options()

        if HEADLESS:
            chrome_options.add_argument("--headless=new")

        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument(
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        )

        # Preferências para download
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        prefs = {
            "download.default_directory": DOWNLOAD_DIR,
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
        }
        chrome_options.add_experimental_option("prefs", prefs)

        # Desabilita detecção de automação
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option("useAutomationExtension", False)

        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)

        # Remove flag navigator.webdriver
        self.driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"},
        )

        self.wait = WebDriverWait(self.driver, 30)
        logger.info("[SCRAPER] Navegador Chrome iniciado")

    def stop_browser(self):
        """Fecha o navegador."""
        if self.driver:
            self.driver.quit()
            logger.info("[SCRAPER] Navegador fechado")

    # ── Tratamento de popups ───────────────────────────────────────
    def _dismiss_cookie_popup(self):
        """Fecha popup de cookies/privacidade se aparecer."""
        selectors = [
            "button#onetrust-accept-btn-handler",
            "button[title='I Accept']",
            "button.accept-all",
            "button[aria-label='Accept']",
            "button[aria-label='I Accept']",
        ]
        for selector in selectors:
            try:
                btn = self.driver.find_element(By.CSS_SELECTOR, selector)
                btn.click()
                logger.info("[SCRAPER] Popup de cookies fechado")
                time.sleep(1)
                return True
            except (NoSuchElementException, WebDriverException):
                continue
        return False

    # ── Navegação principal ────────────────────────────────────────
    def navigate_to_page(self):
        """
        Navega até a página do Media Central Game Stats.
        Isso estabelece cookies/sessão necessários para acessar o CDN.
        """
        logger.info(f"[SCRAPER] Acessando {NBA_STATS_URL}")
        self.driver.get(NBA_STATS_URL)
        time.sleep(5)  # Aguarda carregamento JS

        # Tenta fechar popup de cookies
        self._dismiss_cookie_popup()
        time.sleep(2)

        # Verifica se a tabela carregou para confirmar que a sessão está ativa
        try:
            self.wait.until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "table.Crom_table__p1iZz, a[href*='.txt']")
                )
            )
            logger.info("[SCRAPER] Página carregada — tabela de categorias detectada")
        except TimeoutException:
            logger.warning(
                "[SCRAPER] Tabela não detectada com seletores padrão, "
                "mas prosseguindo com URLs diretas..."
            )

    # ── Descoberta dinâmica de links (fallback) ────────────────────
    def discover_links_from_page(self) -> list[dict]:
        """
        Fallback: extrai links .txt dinamicamente da página caso
        as URLs diretas falhem ou haja categorias novas.
        """
        discovered = []

        # Busca links <a> com href terminando em .txt dentro da tabela
        links = self.driver.find_elements(
            By.CSS_SELECTOR,
            "table.Crom_table__p1iZz a[href$='.txt'], "
            "a.Anchor_anchor__cSc3P[href*='EliasGameStats']"
        )

        for link in links:
            try:
                href = link.get_attribute("href")
                text = link.text.strip()
                if href and text:
                    slug = (
                        text.upper()
                        .replace(" ", "_")
                        .replace("/", "_")
                        .replace("-", "_")
                        .lower()
                    )
                    discovered.append({
                        "category": text,
                        "slug": slug,
                        "url": href,
                    })
                    logger.info(f"  [DISCOVERED] {text} → {href}")
            except StaleElementReferenceException:
                continue

        # Se não encontrou pela tabela, tenta todos os links da página
        if not discovered:
            all_a = self.driver.find_elements(By.TAG_NAME, "a")
            for a in all_a:
                try:
                    href = a.get_attribute("href") or ""
                    text = a.text.strip()
                    if "EliasGameStats" in href and text and href.endswith(".txt"):
                        slug = (
                            text.upper()
                            .replace(" ", "_")
                            .replace("/", "_")
                            .replace("-", "_")
                            .lower()
                        )
                        discovered.append({
                            "category": text,
                            "slug": slug,
                            "url": href,
                        })
                        logger.info(f"  [DISCOVERED] {text} → {href}")
                except StaleElementReferenceException:
                    continue

        logger.info(f"[SCRAPER] Links descobertos dinamicamente: {len(discovered)}")
        return discovered

    # ── Download de conteúdo TXT ───────────────────────────────────
    def download_txt_content(self, url: str) -> str | None:
        """
        Abre uma URL de TXT em nova aba e captura o conteúdo.
        Usa a sessão do browser (mesmo cookies) para evitar 403.
        """
        try:
            # Abre em nova aba
            original_window = self.driver.current_window_handle
            self.driver.execute_script(f"window.open('{url}', '_blank');")
            time.sleep(2)

            # Muda para nova aba
            windows = self.driver.window_handles
            self.driver.switch_to.window(windows[-1])
            time.sleep(3)

            # Captura o conteúdo da página (texto puro do .txt)
            content = self.driver.find_element(By.TAG_NAME, "body").text

            # Se o body não tiver conteúdo, tenta <pre>
            if not content or len(content) < 10:
                try:
                    content = self.driver.find_element(By.TAG_NAME, "pre").text
                except NoSuchElementException:
                    pass

            # Tenta capturar via page_source se ainda vazio
            if not content or len(content) < 10:
                src = self.driver.page_source
                content = re.sub(r"<[^>]+>", "", src)

            # Fecha a aba e volta à original
            self.driver.close()
            self.driver.switch_to.window(original_window)
            time.sleep(1)

            if content and len(content) > 10:
                logger.info(f"[DOWNLOAD] OK — {len(content)} chars de {url.split('/')[-1]}")
                return content
            else:
                logger.warning(f"[DOWNLOAD] Conteúdo vazio para {url}")
                return None

        except Exception as e:
            logger.error(f"[DOWNLOAD] Erro ao baixar {url}: {e}")
            # Tenta voltar à janela original
            try:
                windows = self.driver.window_handles
                if len(windows) > 1:
                    self.driver.close()
                self.driver.switch_to.window(self.driver.window_handles[0])
            except Exception:
                pass
            return None

    # ── Salvar TXT localmente ──────────────────────────────────────
    def _save_txt_local(self, slug: str, content: str):
        """Salva o conteúdo TXT em arquivo local para backup."""
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        filepath = os.path.join(DOWNLOAD_DIR, f"{slug}.txt")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        logger.info(f"[SAVE] Arquivo local: {filepath}")

    # ── Scrape completo ────────────────────────────────────────────
    def scrape_all(self) -> list[dict]:
        """
        Executa o scraping completo:
        1. Navega até a página (estabelece sessão/cookies)
        2. Usa as 17 URLs diretas conhecidas do CATEGORY_URLS
        3. Para cada URL, abre em nova aba e captura o conteúdo TXT
        4. Também busca links dinâmicos caso haja categorias extras

        Retorna lista de dicts com:
            [{"category": "...", "slug": "...", "url": "...", "content": "..."}]
        """
        results = []
        urls_processed = set()
        total = len(CATEGORY_URLS)

        # 1. Navega até a página para estabelecer sessão
        self.navigate_to_page()

        # 2. Baixa todas as 17 categorias conhecidas
        logger.info("=" * 60)
        logger.info(f"[SCRAPER] Baixando {total} categorias (League Wide Stats)")
        logger.info("=" * 60)

        for i, item in enumerate(CATEGORY_URLS, 1):
            category = item["category"]
            slug = item["slug"]
            url = item["url"]

            logger.info(f"[{i:02d}/{total}] {category}")
            logger.info(f"         URL: {url}")

            content = self.download_txt_content(url)

            if content:
                self._save_txt_local(slug, content)

            results.append({
                "category": category.upper(),
                "slug": slug,
                "url": url,
                "content": content,
            })
            urls_processed.add(url)

            # Pausa entre downloads
            time.sleep(2)

        # 3. Verifica se há categorias extras na página (fallback)
        logger.info("=" * 60)
        logger.info("[SCRAPER] Verificando categorias extras na página...")
        logger.info("=" * 60)

        try:
            self.driver.switch_to.window(self.driver.window_handles[0])
            self.driver.get(NBA_STATS_URL)
            time.sleep(5)
            self._dismiss_cookie_popup()
            time.sleep(2)

            discovered = self.discover_links_from_page()
            extras = [d for d in discovered if d["url"] not in urls_processed]

            if extras:
                logger.info(f"[SCRAPER] {len(extras)} categorias extras encontradas!")
                for item in extras:
                    logger.info(f"  [EXTRA] {item['category']} → {item['url']}")
                    content = self.download_txt_content(item["url"])

                    if content:
                        self._save_txt_local(item["slug"], content)

                    results.append({
                        "category": item["category"].upper(),
                        "slug": item["slug"],
                        "url": item["url"],
                        "content": content,
                    })
                    time.sleep(2)
            else:
                logger.info("[SCRAPER] Nenhuma categoria extra encontrada")

        except Exception as e:
            logger.warning(f"[SCRAPER] Erro ao buscar extras: {e}")

        # Resumo
        ok = sum(1 for r in results if r["content"])
        fail = sum(1 for r in results if not r["content"])
        logger.info("=" * 60)
        logger.info(f"[SCRAPER] RESUMO: {len(results)} categorias total")
        logger.info(f"         Sucesso: {ok} | Falha: {fail}")
        logger.info("=" * 60)

        return results
