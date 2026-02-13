# NBA Stats Scraper 🏀

Robô automatizado em Python + Selenium para coletar estatísticas da NBA
a partir da página **Media Central Game Stats** (Elias) e salvar em um
banco de dados PostgreSQL.

## Categorias Coletadas (19+)

### League Wide Stats (17 categorias)

| #   | Categoria                       |
| --- | ------------------------------- |
| 1   | Latest Boxscore Lines           |
| 2   | Alphabetical Player Cumulatives |
| 3   | Alphabetical Rookie Cumulatives |
| 4   | Attendance                      |
| 5   | Latest Scores and Leaders       |
| 6   | Single-Game Highs/Lows          |
| 7   | Top 10 League Leaders           |
| 8   | Top 20 League Leaders           |
| 9   | Rookie League Leaders           |
| 10  | Ratios - Players                |
| 11  | Ratios - Teams                  |
| 12  | Playoff Schedule/Results        |
| 13  | Standings                       |
| 14  | Head-to-Head Win Grid           |
| 15  | Offensive/Defensive             |
| 16  | Miscellaneous                   |
| 17  | Opponent Points Breakdown       |

### Team Stats (2+ categorias adicionais)

| #   | Categoria           |
| --- | ------------------- |
| 18  | Team Boxscore Lines |
| 19  | Team Cumulatives    |

---

## Pré-requisitos

- **Python 3.10+**
- **Google Chrome** (instalado no sistema)
- **PostgreSQL** (rodando e acessível)
- **ChromeDriver** (instalado automaticamente pelo `webdriver-manager`)

## Instalação

```bash
# 1. Clone o repositório
cd nba-stats-scraper

# 2. Crie um ambiente virtual
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # Linux/Mac

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Configure o banco de dados
# Copie o exemplo e preencha com suas credenciais
copy .env.example .env
# Edite o arquivo .env com suas configurações do PostgreSQL
```

## Configuração do PostgreSQL

Antes de rodar, crie o banco de dados:

```sql
CREATE DATABASE nba_stats;
```

Edite o arquivo `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nba_stats
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
HEADLESS=true
```

## Como Executar

```bash
python main.py
```

O scraper vai:

1. Criar automaticamente todas as 19+ tabelas no PostgreSQL
2. Abrir o Chrome (headless por padrão)
3. Navegar até a página do NBA Media Central
4. Clicar em cada categoria e baixar o arquivo TXT
5. Fazer o parse dos dados
6. Salvar no banco de dados

## Estrutura do Projeto

```
nba-stats-scraper/
├── main.py              # Ponto de entrada — orquestra todo o fluxo
├── scraper.py           # Selenium — navega e baixa os TXT
├── parser.py            # Parsers para cada formato de dados
├── database.py          # Modelos SQLAlchemy (19+ tabelas)
├── config.py            # Configurações (DB, URLs, categorias)
├── requirements.txt     # Dependências Python
├── .env.example         # Template de variáveis de ambiente
└── README.md            # Este arquivo
```

## Tabelas no Banco de Dados

| Tabela                            | Descrição                            |
| --------------------------------- | ------------------------------------ |
| `scrape_runs`                     | Log de cada execução do scraper      |
| `raw_data`                        | Conteúdo TXT bruto de cada categoria |
| `latest_boxscore_lines`           | Linhas de boxscore diárias           |
| `alphabetical_player_cumulatives` | Acumulados por jogador               |
| `alphabetical_rookie_cumulatives` | Acumulados de rookies                |
| `attendance`                      | Dados de público                     |
| `latest_scores_and_leaders`       | Placares e líderes                   |
| `single_game_highs_lows`          | Recordes de jogo                     |
| `top_10_league_leaders`           | Top 10 líderes                       |
| `top_20_league_leaders`           | Top 20 líderes                       |
| `rookie_league_leaders`           | Líderes entre rookies                |
| `ratios_players`                  | Médias por jogador                   |
| `ratios_teams`                    | Médias por time                      |
| `playoff_schedule_results`        | Resultados dos playoffs              |
| `standings`                       | Classificação                        |
| `head_to_head_win_grid`           | Confrontos diretos                   |
| `offensive_defensive`             | Estatísticas off/def                 |
| `miscellaneous`                   | Dados diversos                       |
| `opponent_points_breakdown`       | Detalhamento de pontos adversários   |
| `team_boxscore_lines`             | Boxscore por time                    |
| `team_cumulatives`                | Acumulados por time                  |

## Modo Headless

Por padrão, o Chrome roda em modo headless (sem janela). Para ver o
navegador em ação, altere no `.env`:

```env
HEADLESS=false
```

## Logs

Os logs são salvos em `nba_scraper.log` e também exibidos no terminal.
