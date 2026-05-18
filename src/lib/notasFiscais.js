const norm = value => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const num = value => Number(value) || 0;

export function notaFiscalKey(nota) {
  const numero = norm(nota?.numeroNF);
  if (!numero) return `id:${nota?.id ?? Math.random()}`;
  return [
    norm(nota?.fornecedor),
    numero,
    norm(nota?.dataEmissao),
  ].join("|");
}

export function groupNotasFiscais(notas = [], { dedupe = false } = {}) {
  if (!dedupe) return notas.map(nota => [notaFiscalKey({ id: nota?.id }), [nota]]);
  const groups = new Map();
  notas.forEach(nota => {
    const key = notaFiscalKey(nota);
    const safeKey = key.startsWith("|") || key.includes("||") ? `id:${nota?.id}` : key;
    if (!groups.has(safeKey)) groups.set(safeKey, []);
    groups.get(safeKey).push(nota);
  });
  return [...groups.entries()];
}

export function countNotasFiscais(notas = [], { dedupe = false } = {}) {
  return groupNotasFiscais(notas, { dedupe }).length;
}

export function sumNotasFiscais(notas = [], field = "valorNF", { dedupe = false } = {}) {
  if (!dedupe) return notas.reduce((sum, nota) => sum + num(nota?.[field]), 0);

  return groupNotasFiscais(notas, { dedupe }).reduce((sum, [, group]) => {
    const values = group.map(nota => num(nota?.valorFiscalTotal ?? nota?.[field]));
    if (values.length <= 1) return sum + (values[0] || 0);

    const first = values[0] || 0;
    const sameValue = values.every(value => Math.abs(value - first) < 0.01);
    return sum + (sameValue ? first : values.reduce((s, value) => s + value, 0));
  }, 0);
}

export function getNotaFiscalScales(notas = [], field = "valorNF", { dedupe = false } = {}) {
  const scales = {};
  groupNotasFiscais(notas, { dedupe }).forEach(([, group]) => {
    const values = group.map(nota => num(nota?.valorFiscalTotal ?? nota?.[field]));
    const first = values[0] || 0;
    const sameValue = group.length > 1 && values.every(value => Math.abs(value - first) < 0.01);
    const scale = sameValue ? 1 / group.length : 1;
    group.forEach(nota => { scales[nota.id] = scale; });
  });
  return scales;
}

export function getEnvioMetricas(envio, { dedupeNotasPorNF = false } = {}) {
  const notasResumo = envio?.notasResumo || [];
  const mensaisResumo = envio?.mensaisResumo || [];
  const livemodeResumo = envio?.livemodeResumo || [];

  const totalJogos = sumNotasFiscais(notasResumo, "valorNF", { dedupe: dedupeNotasPorNF });
  const totalMensais = mensaisResumo.reduce((sum, nota) => sum + num(nota?.valor), 0);
  const totalLivemode = livemodeResumo.reduce((sum, nota) => sum + num(nota?.valor), 0);
  const qtdNotas = countNotasFiscais(notasResumo, { dedupe: dedupeNotasPorNF }) + mensaisResumo.length + livemodeResumo.length;

  return {
    totalJogos,
    totalMensais,
    totalLivemode,
    totalGeral: totalJogos + totalMensais + totalLivemode,
    qtdNotas,
  };
}

export function normalizeEnvioMetricas(envio, options) {
  return { ...envio, ...getEnvioMetricas(envio, options) };
}
