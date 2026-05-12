// Linkagem com o Portal de Controle (mesma instância Supabase).
// Lê tabelas operacionais do Portal e mapeia (jogo × subKey financeiro) → fornecedor operacional.

import { supabase } from './supabase';

// Mapeia subKey financeiro do Hub → coluna(s) do Portal que contém o nome operacional do fornecedor.
// Cada entry pode resolver para 1+ nomes operacionais (ex: especial = trilho + clipcam).
// Para periféricos, o nome só vale se o toggle (drone/dslr/etc.) estiver = "Sim".
export const SUBKEY_TO_PORTAL = {
  // Pessoal
  supervisor1: { source: 'controle', cols: ['supervisores_1'] },
  supervisor2: { source: 'controle', cols: ['supervisores_2'] },
  dtv:         { source: 'controle', cols: ['dtv'] },
  vmix:        { source: 'controle', cols: ['op_vmix'] },
  audio:       { source: 'controle', cols: ['op_audio'] },

  // Operações — UM (Portal tem 1 coluna 'um'; padrão do jogo decide qual subKey usar)
  um_b1:       { source: 'controle', cols: ['um'], padrao: 'B1' },
  um_b2:       { source: 'controle', cols: ['um'], padrao: 'B2' },
  um_b3:       { source: 'controle', cols: ['um'], padrao: 'B3' },

  geradores:   { source: 'controle', cols: ['gerador'] },

  // SNG: tratado como 2 subKeys virtuais (Premiere e Host são serviços distintos com fornecedores próprios)
  sng_premiere: { source: 'controle', cols: ['sng_premiere'] },
  sng_host:     { source: 'controle', cols: ['sng_host'] },
  // SNG Extra (CATS) = SNG Premiere — mesmo fornecedor
  sng_extra:    { source: 'controle', cols: ['sng_premiere'] },

  // Periféricos — só conta se o toggle correspondente estiver = "Sim"
  drone:       { source: 'periferico', toggle: 'drone',     cols: ['fornecedor_drone'] },
  minidrone:   { source: 'periferico', toggle: 'minidrone', cols: ['fornecedor_minidrone'] },
  // DSLR + Microlink e DSLR + Transmissor são a mesma coisa — só usamos a subKey "dslr".
  dslr:        { source: 'periferico', toggle: 'dslr',      cols: ['fornecedor_dslr'] },
  grua:        { source: 'periferico', toggle: 'grua',      cols: ['fornecedor_grua'] },
  goalcam:     { source: 'periferico', toggle: 'goalcam',   cols: ['fornecedor_goalcam'] },
  carrinho:    { source: 'periferico', toggle: 'carrinho',  cols: ['fornecedor_carrinho'] },

  // Especial = Trilho + ClipCam (cada um respeita seu próprio toggle no Portal)
  especial:    { source: 'periferico-multi', subs: [
    { toggle: 'trilho',  col: 'fornecedor_trilho' },
    { toggle: 'clipcam', col: 'fornecedor_clipcam' },
  ]},
};

// Tolerância: normaliza nome (lower, sem acento, espaço único, sem pontuação extra).
const norm = s => String(s || '')
  .trim()
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Nomes que NÃO emitem NF (contratados internos ou já contemplados em outras NFs).
// Match é tolerante: nome do Portal pode vir com sufixos como "/ 21 98038-6887".
const NAO_EMITE_NF = [
  'anderson fernandes',
  'rafael gusmao',
  'gusmao',
  'op da produtora',
  'op. da produtora',
  'operador da produtora',
  'estrutura globo',
];

// Marcadores de "sem fornecedor" no Portal (qualquer valor que ESTRITAMENTE seja um marcador nulo)
const VALORES_NULOS = new Set(['nao', 'n/a', 'na', 'sem', '-', '--', 'x', 'nenhum', 'nada', 'n a']);

// Prefixos: qualquer texto que comece com isso é tratado como "sem fornecedor"
// (ex: "NÃO / Narração no local 5 câmeras..." vira observação, não é fornecedor)
const PREFIXOS_NULOS = ['nao ', 'sem ', 'n a '];

export function emiteNF(nomeOperacional) {
  const n = norm(nomeOperacional);
  if (!n) return false;
  if (VALORES_NULOS.has(n)) return false;
  if (PREFIXOS_NULOS.some(p => n.startsWith(p))) return false;
  return !NAO_EMITE_NF.some(blocked => {
    const b = norm(blocked);
    return n === b || n.startsWith(b + ' ') || n.includes(' ' + b + ' ') || n.startsWith(b);
  });
}

// Match tolerante: aceita prefixo, contém, e nome+sobrenome em comum
// (ex.: "Julio Fornazari / 11 98433-9323" ↔ "Julio Cesar Fornazari").
function matchAny(target, candidate) {
  const a = norm(target), b = norm(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b + ' ') || b.startsWith(a + ' ')) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Token-based: se primeiro+último de um aparecem no outro, é a mesma pessoa.
  const ta = a.split(' ').filter(Boolean);
  const tb = b.split(' ').filter(Boolean);
  // ignora tokens só de dígitos (telefone) na hora de calcular primeiro/último relevante
  const palavras = arr => arr.filter(t => !/^\d+$/.test(t));
  const wa = palavras(ta), wb = palavras(tb);
  if (wa.length >= 2 && wb.length >= 1) {
    const first = wa[0], last = wa[wa.length - 1];
    if (wb.includes(first) && (wa.length === 1 || wb.includes(last))) return true;
  }
  if (wb.length >= 2 && wa.length >= 1) {
    const first = wb[0], last = wb[wb.length - 1];
    if (wa.includes(first) && (wb.length === 1 || wa.includes(last))) return true;
  }
  return false;
}

// Encontra fornecedor (apelido) com tolerância
export function findFornecedorTolerante(fornecedores, nomeOperacional) {
  if (!nomeOperacional) return null;
  const target = norm(nomeOperacional);
  if (!target) return null;
  // 1) Match exato no apelido normalizado
  for (const f of fornecedores) {
    if (norm(f.apelido) === target) return f;
  }
  // 2) Match tolerante no apelido
  for (const f of fornecedores) {
    if (matchAny(f.apelido, nomeOperacional)) return f;
  }
  // 3) Match no início da razão social
  for (const f of fornecedores) {
    if (matchAny(f.razaoSocial, nomeOperacional)) return f;
  }
  return null;
}

// Tabelas operacionais do Portal por campeonato
const TABLES = {
  brasileirao: { controle: 'brasileirao_jogos', periferico: 'perifericos_brasileirao' },
  paulistao:   { controle: 'paulistao_feminino_jogos', periferico: 'perifericos_paulistao' },
};

// Busca rows de uma tabela e indexa por hub_jogo_id
async function fetchByHubId(tableName) {
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) return new Map();
  const map = new Map();
  (data || []).forEach(row => {
    if (row.hub_jogo_id) map.set(String(row.hub_jogo_id), row);
  });
  return map;
}

// Carrega dados operacionais do Portal para um campeonato.
// Retorna { controle: Map<hub_jogo_id, row>, periferico: Map<hub_jogo_id, row> }.
export async function loadPortalData(campeonato = 'brasileirao') {
  const t = TABLES[campeonato] || TABLES.brasileirao;
  const [controle, periferico] = await Promise.all([
    fetchByHubId(t.controle),
    fetchByHubId(t.periferico),
  ]);
  return { controle, periferico };
}

// Para um jogo do Hub e uma subKey financeira, retorna o(s) nome(s) operacional(is) do Portal.
// Retorna array (pode haver mais de um — ex: SNG Premiere + Host distintos).
// `jogoCategoria` opcional: usa B1/B2 do Hub para filtrar UM correta (Portal pode ter padrao=null).
export function getOperacionaisPorSubKey(jogoHubId, subKey, portal, jogoCategoria) {
  const cfg = SUBKEY_TO_PORTAL[subKey];
  if (!cfg || !portal) return [];
  const id = String(jogoHubId);

  if (cfg.source === 'controle') {
    const row = portal.controle.get(id);
    if (!row) return [];
    if (cfg.padrao) {
      const padraoEfetivo = (row.padrao && String(row.padrao).trim()) || jogoCategoria || '';
      if (String(padraoEfetivo).toUpperCase() !== cfg.padrao.toUpperCase()) return [];
    }
    const nomes = cfg.cols.map(c => row[c]).filter(Boolean).map(s => String(s).trim()).filter(Boolean);
    return [...new Set(nomes)].filter(emiteNF);
  }

  if (cfg.source === 'periferico') {
    const row = portal.periferico.get(id);
    if (!row) return [];
    if (row[cfg.toggle] !== 'Sim') return [];
    const nomes = cfg.cols.map(c => row[c]).filter(Boolean).map(s => String(s).trim()).filter(Boolean);
    return [...new Set(nomes)].filter(emiteNF);
  }

  if (cfg.source === 'periferico-multi') {
    const row = portal.periferico.get(id);
    if (!row) return [];
    const nomes = [];
    cfg.subs.forEach(sub => {
      if (row[sub.toggle] === 'Sim' && row[sub.col]) {
        nomes.push(String(row[sub.col]).trim());
      }
    });
    return [...new Set(nomes.filter(Boolean))].filter(emiteNF);
  }

  return [];
}

// Dado um array de jogos do Hub + uma subKey, retorna mapa { jogoId: [nomesOperacionais] }
export function mapearOperacionaisPorJogo(jogos, subKey, portal) {
  const out = {};
  jogos.forEach(j => {
    const nomes = getOperacionaisPorSubKey(j.id, subKey, portal);
    if (nomes.length) out[j.id] = nomes;
  });
  return out;
}
