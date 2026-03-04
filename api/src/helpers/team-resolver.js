/**
 * Mapeamento de abreviações padrão (nba_teams.abbreviation) para os
 * identificadores usados em cada tabela do banco.
 *
 * Cada tabela do NBA Stats scraper armazena o nome do time de forma
 * diferente (cidade, abreviação curta, nome completo, etc.).
 * Este módulo centraliza a resolução.
 */

const TEAM_MAP = {
  ATL: {
    standings: 'Atlanta',
    offdef: 'Atl',
    h2h: 'ATL',
    apc: 'ATL',
    opp: 'Atlanta',
    full: 'Atlanta Hawks',
    scores: 'Atlanta'
  },
  BKN: {
    standings: 'Brooklyn',
    offdef: 'Bkn',
    h2h: 'BKN',
    apc: 'BRK',
    opp: 'Brooklyn',
    full: 'Brooklyn Nets',
    scores: 'Brooklyn'
  },
  BOS: {
    standings: 'Boston',
    offdef: 'Bos',
    h2h: 'BOS',
    apc: 'BOS',
    opp: 'Boston',
    full: 'Boston Celtics',
    scores: 'Boston'
  },
  CHA: {
    standings: 'Charlotte',
    offdef: 'Cha',
    h2h: 'CHA',
    apc: 'CHA',
    opp: 'Charlotte',
    full: 'Charlotte Hornets',
    scores: 'Charlotte'
  },
  CHI: {
    standings: 'Chicago',
    offdef: 'Chi',
    h2h: 'CHI',
    apc: 'CHI',
    opp: 'Chicago',
    full: 'Chicago Bulls',
    scores: 'Chicago'
  },
  CLE: {
    standings: 'Cleveland',
    offdef: 'Clev',
    h2h: 'CLE',
    apc: 'CLE',
    opp: 'Cleveland',
    full: 'Cleveland Cavaliers',
    scores: 'Cleveland'
  },
  DAL: {
    standings: 'Dallas',
    offdef: 'Dall',
    h2h: 'DAL',
    apc: 'DAL',
    opp: 'Dallas',
    full: 'Dallas Mavericks',
    scores: 'Dallas'
  },
  DEN: {
    standings: 'Denver',
    offdef: 'Den',
    h2h: 'DEN',
    apc: 'DEN',
    opp: 'Denver',
    full: 'Denver Nuggets',
    scores: 'Denver'
  },
  DET: {
    standings: 'Detroit',
    offdef: 'Det',
    h2h: 'DET',
    apc: 'DET',
    opp: 'Detroit',
    full: 'Detroit Pistons',
    scores: 'Detroit'
  },
  GSW: {
    standings: 'Golden State',
    offdef: 'G.S',
    h2h: 'GS',
    apc: 'GS',
    opp: 'Golden State',
    full: 'Golden State Warriors',
    scores: 'Golden State'
  },
  HOU: {
    standings: 'Houston',
    offdef: 'Hou',
    h2h: 'HOU',
    apc: 'HOU',
    opp: 'Houston',
    full: 'Houston Rockets',
    scores: 'Houston'
  },
  IND: {
    standings: 'Indiana',
    offdef: 'Ind',
    h2h: 'IND',
    apc: 'IND',
    opp: 'Indiana',
    full: 'Indiana Pacers',
    scores: 'Indiana'
  },
  LAC: {
    standings: 'L.A. Clippers',
    offdef: 'LA-C',
    h2h: 'LAC',
    apc: 'LAC',
    opp: 'L.A. Clippers',
    full: 'Los Angeles Clippers',
    scores: 'L.A. Clippers'
  },
  LAL: {
    standings: 'L.A. Lakers',
    offdef: 'LA-L',
    h2h: 'LAL',
    apc: 'LAL',
    opp: 'L.A. Lakers',
    full: 'Los Angeles Lakers',
    scores: 'L.A. Lakers'
  },
  MEM: {
    standings: 'Memphis',
    offdef: 'Mem',
    h2h: 'MEM',
    apc: 'MEM',
    opp: 'Memphis',
    full: 'Memphis Grizzlies',
    scores: 'Memphis'
  },
  MIA: {
    standings: 'Miami',
    offdef: 'Miami',
    h2h: 'MIA',
    apc: 'MIA',
    opp: 'Miami',
    full: 'Miami Heat',
    scores: 'Miami'
  },
  MIL: {
    standings: 'Milwaukee',
    offdef: 'Milw',
    h2h: 'MIL',
    apc: 'MIL',
    opp: 'Milwaukee',
    full: 'Milwaukee Bucks',
    scores: 'Milwaukee'
  },
  MIN: {
    standings: 'Minnesota',
    offdef: 'Minn',
    h2h: 'MIN',
    apc: 'MIN',
    opp: 'Minnesota',
    full: 'Minnesota Timberwolves',
    scores: 'Minnesota'
  },
  NOP: {
    standings: 'New Orleans',
    offdef: 'N.O',
    h2h: 'NO',
    apc: 'NO',
    opp: 'New Orleans',
    full: 'New Orleans Pelicans',
    scores: 'New Orleans'
  },
  NYK: {
    standings: 'New York',
    offdef: 'N.Y',
    h2h: 'NY',
    apc: 'NY',
    opp: 'New York',
    full: 'New York Knicks',
    scores: 'New York'
  },
  OKC: {
    standings: 'City',
    offdef: 'OKC',
    h2h: 'OKC',
    apc: 'OKC',
    opp: 'Oklahoma City',
    full: 'Oklahoma City Thunder',
    scores: 'Oklahoma City'
  },
  ORL: {
    standings: 'Orlando',
    offdef: 'Orl',
    h2h: 'ORL',
    apc: 'ORL',
    opp: 'Orlando',
    full: 'Orlando Magic',
    scores: 'Orlando'
  },
  PHI: {
    standings: 'Philadelphia',
    offdef: 'Phil',
    h2h: 'PHI',
    apc: 'PHI',
    opp: 'Philadelphia',
    full: 'Philadelphia 76ers',
    scores: 'Philadelphia'
  },
  PHX: {
    standings: 'Phoenix',
    offdef: 'Phoe',
    h2h: 'PHO',
    apc: 'PHO',
    opp: 'Phoenix',
    full: 'Phoenix Suns',
    scores: 'Phoenix'
  },
  POR: {
    standings: 'Portland',
    offdef: 'Port',
    h2h: 'POR',
    apc: 'POR',
    opp: 'Portland',
    full: 'Portland Trail Blazers',
    scores: 'Portland'
  },
  SAC: {
    standings: 'Sacramento',
    offdef: 'Sac',
    h2h: 'SAC',
    apc: 'SAC',
    opp: 'Sacramento',
    full: 'Sacramento Kings',
    scores: 'Sacramento'
  },
  SAS: {
    standings: 'San Antonio',
    offdef: 'S.A',
    h2h: 'SA',
    apc: 'SA',
    opp: 'San Antonio',
    full: 'San Antonio Spurs',
    scores: 'San Antonio'
  },
  TOR: {
    standings: 'Toronto',
    offdef: 'Tor',
    h2h: 'TOR',
    apc: 'TOR',
    opp: 'Toronto',
    full: 'Toronto Raptors',
    scores: 'Toronto'
  },
  UTA: {
    standings: 'Utah',
    offdef: 'Utah',
    h2h: 'UTA',
    apc: 'UTA',
    opp: 'Utah',
    full: 'Utah Jazz',
    scores: 'Utah'
  },
  WAS: {
    standings: 'Washington',
    offdef: 'Wash',
    h2h: 'WAS',
    apc: 'WAS',
    opp: 'Washington',
    full: 'Washington Wizards',
    scores: 'Washington'
  }
}

/**
 * Resolve uma abreviação padrão (ex: ATL) para o identificador
 * usado em uma tabela específica.
 *
 * @param {string} abbrev - Abreviação padrão do time (nba_teams.abbreviation)
 * @param {string} table  - Nome da tabela/formato: standings | offdef | h2h | apc | opp | full | scores
 * @returns {string|null}
 */
function resolve(abbrev, table) {
  const entry = TEAM_MAP[abbrev?.toUpperCase()]
  if (!entry) return null
  return entry[table] ?? null
}

/**
 * Retorna o objeto completo de mapeamento para um time.
 * @param {string} abbrev
 * @returns {object|null}
 */
function getTeamInfo(abbrev) {
  return TEAM_MAP[abbrev?.toUpperCase()] ?? null
}

module.exports = { TEAM_MAP, resolve, getTeamInfo }
