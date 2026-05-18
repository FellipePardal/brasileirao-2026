import { useState } from "react";
import { KPI, Pill } from "../shared";
import { fmt, subTotal } from "../../utils";
import { CATS, btnStyle, iSty, RADIUS } from "../../constants";
import { getNFFile } from "../../lib/supabase";
import { countNotasFiscais, getEnvioMetricas, normalizeEnvioMetricas, sumNotasFiscais } from "../../lib/notasFiscais";
import { Card, PanelTitle, Button, Chip, tableStyles } from "../ui";
import { Plus, ArrowLeft, CheckCircle2, Clock, Eye, Trash2, Share2, ExternalLink, Download, Send, Package, Edit2, PlusCircle, X } from "lucide-react";

const catTotal = (subs, cat) => cat.subs.reduce((s, sub) => s + (subs?.[sub.key]||0), 0);
const nextEnvioNumero = envios => Math.max(0, ...(envios || []).map(e => Number(e.numero) || 0)) + 1;
const makePublicToken = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `envio_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export default function TabEnvio({ jogos, notas, notasMensais, notasLivemode = [], servicos, envios, setEnvios, T, enviosKey = "envios", dedupeNotasPorNF = false }) {
  const [view, setView] = useState("lista");
  const [envioDetalheId, setEnvioDetalheId] = useState(null);

  const [selJogosNFs, setSelJogosNFs] = useState(new Set());
  const [selMensaisNFs, setSelMensaisNFs] = useState(new Set());
  const [selLivemodeNFs, setSelLivemodeNFs] = useState(new Set());
  const [obs, setObs] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [nomeEnvio, setNomeEnvio] = useState("");

  // Edição de nome
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeTemp, setNomeTemp] = useState("");

  // Preview de NF
  const [previewId, setPreviewId] = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const openPreview = async (notaId) => {
    setPreviewId(notaId);
    setPreviewSrc(null);
    setPreviewLoading(true);
    const data = await getNFFile(notaId);
    setPreviewSrc(data || null);
    setPreviewLoading(false);
  };

  // Adicionar notas a envio existente
  const [addingNotas, setAddingNotas] = useState(false);
  const [addSelJogos, setAddSelJogos] = useState(new Set());
  const [addSelMensais, setAddSelMensais] = useState(new Set());
  const [addSelLivemode, setAddSelLivemode] = useState(new Set());

  const IS = iSty(T);
  const TS = tableStyles(T);
  const purple = "#a855f7";
  const cyan = "#06b6d4";
  const divulgados = jogos.filter(j => j.mandante !== "A definir");

  const teal = "#14b8a6";
  const nfsEnviadas = new Set(envios.flatMap(e => [...(e.notasIds||[]), ...(e.mensaisIds||[]), ...(e.livemodeIds||[])]));
  const nfsDisponiveis = notas.filter(n => !nfsEnviadas.has(n.id))
    .sort((a,b) => (a.rodada||0) - (b.rodada||0) || (a.fornecedor||"").localeCompare(b.fornecedor||""));
  const mensaisDisponiveis = notasMensais.filter(n => !nfsEnviadas.has(n.id));
  const livemodeDisponiveis = notasLivemode.filter(n => !nfsEnviadas.has(n.id));

  const toggleJogoNF = id => setSelJogosNFs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleMensalNF = id => setSelMensaisNFs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllJogos = () => setSelJogosNFs(new Set(nfsDisponiveis.map(n => n.id)));
  const selectAllMensais = () => setSelMensaisNFs(new Set(mensaisDisponiveis.map(n => n.id)));
  const toggleLivemodeNF = id => setSelLivemodeNFs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllLivemode = () => setSelLivemodeNFs(new Set(livemodeDisponiveis.map(n => n.id)));

  const selJogosArr = notas.filter(n => selJogosNFs.has(n.id));
  const selMensaisArr = notasMensais.filter(n => selMensaisNFs.has(n.id));
  const selLivemodeArr = notasLivemode.filter(n => selLivemodeNFs.has(n.id));
  const totalSelValor = sumNotasFiscais(selJogosArr, "valorNF", { dedupe: dedupeNotasPorNF }) + selMensaisArr.reduce((s, n) => s + (n.valor||0), 0) + selLivemodeArr.reduce((s, n) => s + (n.valor||0), 0);
  const proximoNumeroEnvio = nextEnvioNumero(envios);
  const envioPublicRef = envio => `${enviosKey}:${envio.publicToken || `id:${envio.id}`}`;
  const envioPublicHash = envio => `#envio/${encodeURIComponent(envioPublicRef(envio))}`;
  const envioPublicUrl = envio => `${window.location.origin}${window.location.pathname}${envioPublicHash(envio)}`;
  const copiarLinkEnvio = envio => {
    const url = envioPublicUrl(envio);
    navigator.clipboard.writeText(url);
    alert("Link copiado!\n" + url);
  };

  const criarEnvio = () => {
    if (selJogosNFs.size === 0 && selMensaisNFs.size === 0 && selLivemodeNFs.size === 0) return;
    const numero = proximoNumeroEnvio;
    const totalLivemode = selLivemodeArr.reduce((s, n) => s + (n.valor||0), 0);
    const novo = normalizeEnvioMetricas({
      id: Date.now(),
      numero,
      publicToken: makePublicToken(),
      nome: nomeEnvio.trim() || "",
      criadoEm: new Date().toISOString(),
      dataPagamento,
      obs,
      notasIds: [...selJogosNFs],
      mensaisIds: [...selMensaisNFs],
      livemodeIds: [...selLivemodeNFs],
      notasResumo: selJogosArr.map(n => ({id:n.id,codigo:n.codigo,fornecedor:n.fornecedor,valorNF:n.valorNF,numeroNF:n.numeroNF,jogoLabel:n.jogoLabel,rodada:n.rodada,servicosLabels:n.servicosLabels,dataEmissao:n.dataEmissao,dataPagamento,hasFile:n.hasFile})),
      mensaisResumo: selMensaisArr.map(n => ({id:n.id,fornecedor:n.fornecedor,valor:n.valor,numeroNF:n.numeroNF,categoria:n.categoria,mesLabel:n.mesLabel,dataEmissao:n.dataEmissao,dataPagamento,hasFile:n.hasFile})),
      livemodeResumo: selLivemodeArr.map(n => ({id:n.id,fornecedor:n.fornecedor||"Livemode",valor:n.valor,numeroNF:n.numeroNF,rodada:n.rodada,rodadas:n.rodadas,rodadasLabel:n.rodadasLabel,servicosLabels:n.servicosLabels,dataEmissao:n.dataEmissao,dataPagamento,hasFile:n.hasFile})),
      totalJogos: 0,
      totalMensais: 0,
      totalLivemode,
      totalGeral: totalSelValor,
      qtdNotas: selJogosNFs.size + selMensaisNFs.size + selLivemodeNFs.size,
    }, { dedupeNotasPorNF });
    setEnvios(ev => [...ev, novo]);
    setView("lista");
    setSelJogosNFs(new Set());
    setSelMensaisNFs(new Set());
    setSelLivemodeNFs(new Set());
    setObs("");
    setDataPagamento("");
    setNomeEnvio("");
  };

  const excluirEnvio = (id) => {
    if (!window.confirm("Excluir este envio? As NFs voltarão a ficar disponíveis.")) return;
    setEnvios(ev => ev.filter(e => e.id !== id));
  };

  const downloadNF = async (notaId, filename) => {
    const data = await getNFFile(notaId);
    if (!data) { alert("Arquivo não encontrado"); return; }
    const a = document.createElement("a"); a.href = data; a.download = filename; a.click();
  };

  const togglePago = (envioId) => {
    setEnvios(ev => ev.map(e => {
      if (e.id !== envioId) return e;
      const novoPago = !e.pago;
      if (novoPago) {
        return {
          ...e, pago: true,
          notasResumo: (e.notasResumo||[]).map(n => ({...n, statusNota:"Pago"})),
          mensaisResumo: (e.mensaisResumo||[]).map(n => ({...n, statusNota:"Pago"})),
          livemodeResumo: (e.livemodeResumo||[]).map(n => ({...n, statusNota:"Pago"})),
        };
      }
      return {...e, pago: false};
    }));
  };

  const STATUS_NOTA = ["Pendente","Pago","Alteração"];
  const STATUS_NOTA_COLOR = {"Pendente":"#f59e0b","Pago":"#22c55e","Alteração":"#ef4444"};

  const updateNotaStatus = (envioId, notaId, tipo, novoStatus) => {
    setEnvios(ev => ev.map(e => {
      if (e.id !== envioId) return e;
      const campo = tipo === "jogo" ? "notasResumo" : tipo === "mensal" ? "mensaisResumo" : "livemodeResumo";
      return {...e, [campo]: (e[campo]||[]).map(n => n.id === notaId ? {...n, statusNota: novoStatus} : n)};
    }));
  };

  // ── Renomear envio ──
  const salvarNome = (envioId) => {
    setEnvios(ev => ev.map(e => e.id === envioId ? {...e, nome: nomeTemp.trim()} : e));
    setEditandoNome(false);
    setNomeTemp("");
  };

  // ── Remover nota individual do envio ──
  const removerNotaDoEnvio = (envioId, notaId, tipo) => {
    setEnvios(ev => ev.map(e => {
      if (e.id !== envioId) return e;
      const idsCampo = tipo === "jogo" ? "notasIds" : tipo === "mensal" ? "mensaisIds" : "livemodeIds";
      const resumoCampo = tipo === "jogo" ? "notasResumo" : tipo === "mensal" ? "mensaisResumo" : "livemodeResumo";
      const novasIds = (e[idsCampo]||[]).filter(id => id !== notaId);
      const novoResumo = (e[resumoCampo]||[]).filter(n => n.id !== notaId);
      return normalizeEnvioMetricas({
        ...e,
        [idsCampo]: novasIds,
        [resumoCampo]: novoResumo,
      }, { dedupeNotasPorNF });
    }));
  };

  // ── Adicionar notas a envio existente ──
  const toggleAddJogo = id => setAddSelJogos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAddMensal = id => setAddSelMensais(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAddLivemode = id => setAddSelLivemode(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const confirmarAdicionarNotas = (envioId) => {
    if (addSelJogos.size === 0 && addSelMensais.size === 0 && addSelLivemode.size === 0) return;
    const novosJogos = notas.filter(n => addSelJogos.has(n.id));
    const novosMensais = notasMensais.filter(n => addSelMensais.has(n.id));
    const novosLivemode = notasLivemode.filter(n => addSelLivemode.has(n.id));

    setEnvios(ev => ev.map(e => {
      if (e.id !== envioId) return e;
      const notasIds = [...(e.notasIds||[]), ...[...addSelJogos]];
      const mensaisIds = [...(e.mensaisIds||[]), ...[...addSelMensais]];
      const livemodeIds = [...(e.livemodeIds||[]), ...[...addSelLivemode]];
      const notasResumo = [...(e.notasResumo||[]), ...novosJogos.map(n => ({id:n.id,codigo:n.codigo,fornecedor:n.fornecedor,valorNF:n.valorNF,numeroNF:n.numeroNF,jogoLabel:n.jogoLabel,rodada:n.rodada,servicosLabels:n.servicosLabels,dataEmissao:n.dataEmissao,dataPagamento:e.dataPagamento,hasFile:n.hasFile}))];
      const mensaisResumo = [...(e.mensaisResumo||[]), ...novosMensais.map(n => ({id:n.id,fornecedor:n.fornecedor,valor:n.valor,numeroNF:n.numeroNF,categoria:n.categoria,mesLabel:n.mesLabel,dataEmissao:n.dataEmissao,dataPagamento:e.dataPagamento,hasFile:n.hasFile}))];
      const livemodeResumo = [...(e.livemodeResumo||[]), ...novosLivemode.map(n => ({id:n.id,fornecedor:n.fornecedor||"Livemode",valor:n.valor,numeroNF:n.numeroNF,rodada:n.rodada,rodadas:n.rodadas,rodadasLabel:n.rodadasLabel,servicosLabels:n.servicosLabels,dataEmissao:n.dataEmissao,dataPagamento:e.dataPagamento,hasFile:n.hasFile}))];
      return normalizeEnvioMetricas({...e, notasIds, mensaisIds, livemodeIds, notasResumo, mensaisResumo, livemodeResumo}, { dedupeNotasPorNF });
    }));

    setAddingNotas(false);
    setAddSelJogos(new Set());
    setAddSelMensais(new Set());
    setAddSelLivemode(new Set());
  };

  const envioLabel = e => e?.nome || `Envio ${e?.numero}`;

  const totalEnvios = envios.length;
  const metricasEnvios = envios.map(e => ({ envio: e, ...getEnvioMetricas(e, { dedupeNotasPorNF }) }));
  const totalNFsEnviadas = metricasEnvios.reduce((s, e) => s + e.qtdNotas, 0);
  const totalValorEnviado = metricasEnvios.reduce((s, e) => s + e.totalGeral, 0);
  const totalPago = metricasEnvios.filter(e => e.envio.pago).reduce((s, e) => s + e.totalGeral, 0);
  const totalPendentePgto = metricasEnvios.filter(e => !e.envio.pago).reduce((s, e) => s + e.totalGeral, 0);

  // Derivado direto do estado — sempre atualizado
  const envioDetalhe = envioDetalheId ? envios.find(e => e.id === envioDetalheId) : null;
  const envioDetalheMetricas = envioDetalhe ? getEnvioMetricas(envioDetalhe, { dedupeNotasPorNF }) : null;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:16}}>
        <KPI label="Total Envios" value={String(totalEnvios)} sub="Pacotes enviados" color={purple} T={T}/>
        <KPI label="NFs Enviadas" value={String(totalNFsEnviadas)} sub="Jogos + Mensais" color={T.brand} T={T}/>
        <KPI label="NFs Pendentes" value={String(countNotasFiscais(nfsDisponiveis, { dedupe: dedupeNotasPorNF }) + mensaisDisponiveis.length)} sub="Não enviadas" color={T.warning} T={T}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:24}}>
        <KPI label="Valor Enviado" value={fmt(totalValorEnviado)} sub="Total acumulado" color={cyan} T={T}/>
        <KPI label="Pago" value={fmt(totalPago)} sub={`${envios.filter(e=>e.pago).length} envio${envios.filter(e=>e.pago).length!==1?"s":""}`} color={T.brand} T={T}/>
        <KPI label="Aguardando Pgto" value={fmt(totalPendentePgto)} sub={`${envios.filter(e=>!e.pago).length} envio${envios.filter(e=>!e.pago).length!==1?"s":""}`} color={T.danger} T={T}/>
      </div>

      {/* ── LISTA DE ENVIOS ── */}
      {view === "lista" && (<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:12}}>
          <span style={{color:T.textMd,fontSize:13,fontWeight:600}}>{envios.length} envio{envios.length!==1?"s":""}</span>
          <Button T={T} variant="primary" size="md" icon={Plus} onClick={()=>setView("novo")}>Novo Envio</Button>
        </div>

        {envios.length === 0 && (
          <Card T={T}>
            <div style={{padding:60,textAlign:"center"}}>
              <div style={{width:60,height:60,borderRadius:16,background:T.brandSoft,border:`1px solid ${T.brandBorder}`,color:T.brand,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
                <Package size={28} strokeWidth={2}/>
              </div>
              <p style={{color:T.text,fontSize:14,margin:"0 0 4px",fontWeight:600}}>Nenhum envio realizado ainda</p>
              <p style={{color:T.textSm,fontSize:12,margin:0}}>Clique em "Novo Envio" para montar seu primeiro pacote</p>
            </div>
          </Card>
        )}

        {[...envios].reverse().map(envio => {
          const metricas = getEnvioMetricas(envio, { dedupeNotasPorNF });
          return (
          <Card key={envio.id} T={T} style={{marginBottom:12}} accent={envio.pago?T.brand:T.danger}>
            <div style={{padding:"18px 22px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span className="num" style={{background:purple,color:"#fff",borderRadius:RADIUS.md,padding:"5px 14px",fontSize:14,fontWeight:800,letterSpacing:"-0.01em"}}>{envioLabel(envio)}</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5,background:envio.pago?T.brand+"22":T.danger+"22",color:envio.pago?T.brand:T.danger,border:`1px solid ${envio.pago?T.brand:T.danger}55`,borderRadius:RADIUS.pill,padding:"4px 11px",fontSize:10,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase"}}>
                    {envio.pago ? <CheckCircle2 size={11} strokeWidth={2.5}/> : <Clock size={11} strokeWidth={2.5}/>}
                    {envio.pago?"Pago":"Aguardando"}
                  </span>
                  <span className="num" style={{color:T.textSm,fontSize:12}}>{new Date(envio.criadoEm).toLocaleDateString("pt-BR")}</span>
                  <span style={{color:T.textMd,fontSize:12}}>{metricas.qtdNotas} nota{metricas.qtdNotas!==1?"s":""}</span>
                </div>
                <span className="num" style={{color:cyan,fontWeight:800,fontSize:18,letterSpacing:"-0.02em"}}>{fmt(metricas.totalGeral)}</span>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
                {metricas.totalJogos > 0 && <Pill label={`Jogos: ${fmt(metricas.totalJogos)}`} color={T.brand}/>}
                {metricas.totalMensais > 0 && <Pill label={`Mensais: ${fmt(metricas.totalMensais)}`} color={cyan}/>}
                {metricas.totalLivemode > 0 && <Pill label={`Livemode: ${fmt(metricas.totalLivemode)}`} color={teal}/>}
                {envio.dataPagamento && <Pill label={`Pgto: ${envio.dataPagamento}`} color={purple}/>}
                {envio.obs && <span style={{color:T.textSm,fontSize:11}}>Obs: {envio.obs}</span>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <Button T={T} variant={envio.pago?"secondary":"primary"} size="sm" icon={CheckCircle2} onClick={()=>togglePago(envio.id)}>
                  {envio.pago?"Marcar pendente":"Marcar pago"}
                </Button>
                <Button T={T} variant="secondary" size="sm" icon={Eye} onClick={()=>{setEnvioDetalheId(envio.id);setView("detalhe");setEditandoNome(false);setAddingNotas(false);}}>Ver detalhes</Button>
                <Button T={T} variant="secondary" size="sm" icon={Share2} onClick={()=>copiarLinkEnvio(envio)}>Compartilhar</Button>
                <Button T={T} variant="secondary" size="sm" icon={ExternalLink} onClick={()=>window.open(envioPublicHash(envio),"_blank")}>Abrir página</Button>
                <Button T={T} variant="danger" size="sm" icon={Trash2} onClick={()=>excluirEnvio(envio.id)}>Excluir</Button>
              </div>
            </div>
          </Card>
        );})}
      </>)}

      {/* ── NOVO ENVIO ── */}
      {view === "novo" && (<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <Button T={T} variant="secondary" size="md" icon={ArrowLeft} onClick={()=>setView("lista")}>Cancelar</Button>
            <h3 style={{margin:0,fontSize:18,color:T.text,fontWeight:800,letterSpacing:"-0.02em"}}>Novo Envio</h3>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:12,marginBottom:16}}>
          <div>
            <label style={{color:T.textSm,fontSize:10,display:"block",marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:700}}>Nome do Envio (opcional)</label>
            <input value={nomeEnvio} onChange={e=>setNomeEnvio(e.target.value)} placeholder={`Envio ${proximoNumeroEnvio}`} style={IS}/>
          </div>
          <div>
            <label style={{color:T.textSm,fontSize:10,display:"block",marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:700}}>Data de Pagamento</label>
            <input value={dataPagamento} onChange={e=>setDataPagamento(e.target.value)} placeholder="dd/mm/aaaa" style={IS}/>
          </div>
          <div>
            <label style={{color:T.textSm,fontSize:10,display:"block",marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:700}}>Observações (opcional)</label>
            <input value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: Inclui NF atrasada da Rd 8" style={IS}/>
          </div>
        </div>

        <Card T={T} style={{marginBottom:16}} accent={T.brand}>
          <PanelTitle T={T} title={`NFs de Jogos (${nfsDisponiveis.length} disponíveis)`} subtitle={`${selJogosNFs.size} selecionada${selJogosNFs.size!==1?"s":""}`} color={T.brand}
            right={<Button T={T} variant="secondary" size="sm" onClick={selectAllJogos}>Selecionar todas</Button>}
          />
          {nfsDisponiveis.length === 0 ? (
            <p style={{color:T.textSm,fontSize:12,padding:16,margin:0}}>Todas as NFs de jogos já foram enviadas</p>
          ) : (
            <div style={{maxHeight:320,overflowY:"auto"}}>
              {nfsDisponiveis.map(n => {
                const sel = selJogosNFs.has(n.id);
                return (
                  <div key={n.id} onClick={()=>toggleJogoNF(n.id)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"10px 22px",cursor:"pointer",borderTop:`1px solid ${T.border}`,background:sel?T.brand+"15":"transparent",transition:"background .15s"}}>
                    <input type="checkbox" checked={sel} readOnly style={{accentColor:T.brand}}/>
                    <span style={{flex:1,fontSize:13,color:T.text,fontWeight:600}}>{n.fornecedor}</span>
                    <span style={{fontSize:11,color:T.textSm}}>NF {n.numeroNF||"—"}</span>
                    <span style={{fontSize:11,color:T.textSm}}>{n.jogoLabel}</span>
                    <Pill label={`Rd ${n.rodada}`} color={T.warning}/>
                    <span className="num" style={{fontSize:13,color:purple,fontWeight:700,minWidth:90,textAlign:"right"}}>{fmt(n.valorNF)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card T={T} style={{marginBottom:16}} accent={cyan}>
          <PanelTitle T={T} title={`NFs Mensais (${mensaisDisponiveis.length} disponíveis)`} subtitle={`${selMensaisNFs.size} selecionada${selMensaisNFs.size!==1?"s":""}`} color={cyan}
            right={<Button T={T} variant="secondary" size="sm" onClick={selectAllMensais}>Selecionar todas</Button>}
          />
          {mensaisDisponiveis.length === 0 ? (
            <p style={{color:T.textSm,fontSize:12,padding:16,margin:0}}>Todas as NFs mensais já foram enviadas</p>
          ) : (
            <div style={{maxHeight:320,overflowY:"auto"}}>
              {mensaisDisponiveis.map(n => {
                const sel = selMensaisNFs.has(n.id);
                return (
                  <div key={n.id} onClick={()=>toggleMensalNF(n.id)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"10px 22px",cursor:"pointer",borderTop:`1px solid ${T.border}`,background:sel?cyan+"15":"transparent",transition:"background .15s"}}>
                    <input type="checkbox" checked={sel} readOnly style={{accentColor:cyan}}/>
                    <span style={{flex:1,fontSize:13,color:T.text,fontWeight:600}}>{n.fornecedor}</span>
                    <span style={{fontSize:11,color:T.textSm}}>NF {n.numeroNF||"—"}</span>
                    <Pill label={n.mesLabel} color={cyan}/>
                    <Pill label={n.categoria} color={T.warning}/>
                    {n.dataEmissao && <span style={{fontSize:10,color:T.textSm}}>Em: {n.dataEmissao}</span>}
                    <span className="num" style={{fontSize:13,color:purple,fontWeight:700,minWidth:90,textAlign:"right"}}>{fmt(n.valor)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card T={T} style={{marginBottom:16}} accent={teal}>
          <PanelTitle T={T} title={`NFs Livemode (${livemodeDisponiveis.length} disponíveis)`} subtitle={`${selLivemodeNFs.size} selecionada${selLivemodeNFs.size!==1?"s":""}`} color={teal}
            right={<Button T={T} variant="secondary" size="sm" onClick={selectAllLivemode}>Selecionar todas</Button>}
          />
          {livemodeDisponiveis.length === 0 ? (
            <p style={{color:T.textSm,fontSize:12,padding:16,margin:0}}>Todas as NFs Livemode já foram enviadas</p>
          ) : (
            <div style={{maxHeight:320,overflowY:"auto"}}>
              {livemodeDisponiveis.map(n => {
                const sel = selLivemodeNFs.has(n.id);
                return (
                  <div key={n.id} onClick={()=>toggleLivemodeNF(n.id)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"10px 22px",cursor:"pointer",borderTop:`1px solid ${T.border}`,background:sel?teal+"15":"transparent",transition:"background .15s"}}>
                    <input type="checkbox" checked={sel} readOnly style={{accentColor:teal}}/>
                    <span style={{flex:1,fontSize:13,color:T.text,fontWeight:600}}>{n.fornecedor || "Livemode"}</span>
                    <Pill label={n.rodadasLabel || `Rd ${n.rodada}`} color={T.warning}/>
                    <span style={{fontSize:10,color:T.textSm}}>{(n.servicosLabels||[]).join(", ")}</span>
                    <span style={{fontSize:10,color:T.textSm}}>NF {n.numeroNF||"—"}</span>
                    <span className="num" style={{fontSize:13,color:purple,fontWeight:700,minWidth:90,textAlign:"right"}}>{fmt(n.valor)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card T={T}>
          <div style={{padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <div>
              <p style={{color:T.textMd,fontSize:13,margin:"0 0 4px"}}>{selJogosNFs.size + selMensaisNFs.size + selLivemodeNFs.size} nota{selJogosNFs.size+selMensaisNFs.size+selLivemodeNFs.size!==1?"s":""} selecionada{selJogosNFs.size+selMensaisNFs.size+selLivemodeNFs.size!==1?"s":""}</p>
              <p className="num" style={{color:cyan,fontWeight:800,fontSize:22,margin:0,letterSpacing:"-0.02em"}}>{fmt(totalSelValor)}</p>
            </div>
            <Button T={T} variant="primary" size="lg" icon={Send} onClick={criarEnvio} disabled={selJogosNFs.size+selMensaisNFs.size+selLivemodeNFs.size===0}>
              Criar Envio
            </Button>
          </div>
        </Card>
      </>)}

      {/* ── DETALHE DO ENVIO ── */}
      {view === "detalhe" && envioDetalhe && (<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <Button T={T} variant="secondary" size="md" icon={ArrowLeft} onClick={()=>{setView("lista");setAddingNotas(false);setEditandoNome(false);}}>Voltar</Button>
            {editandoNome ? (
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input value={nomeTemp} onChange={e=>setNomeTemp(e.target.value)} placeholder={`Envio ${envioDetalhe.numero}`}
                  autoFocus onKeyDown={e => e.key === "Enter" && salvarNome(envioDetalhe.id)}
                  style={{...IS,width:220,fontSize:16,fontWeight:700,padding:"6px 12px"}}/>
                <Button T={T} variant="primary" size="sm" onClick={()=>salvarNome(envioDetalhe.id)}>Salvar</Button>
                <Button T={T} variant="secondary" size="sm" onClick={()=>setEditandoNome(false)}>Cancelar</Button>
              </div>
            ) : (
              <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>{setEditandoNome(true);setNomeTemp(envioDetalhe.nome||"");}}>
                <span className="num" style={{background:purple,color:"#fff",borderRadius:RADIUS.md,padding:"6px 16px",fontSize:16,fontWeight:800,letterSpacing:"-0.01em"}}>{envioLabel(envioDetalhe)}</span>
                <Edit2 size={14} color={T.textSm} strokeWidth={2}/>
              </div>
            )}
            <span style={{display:"inline-flex",alignItems:"center",gap:5,background:(envioDetalhe?.pago)?T.brand+"22":T.danger+"22",color:(envioDetalhe?.pago)?T.brand:T.danger,border:`1px solid ${(envioDetalhe?.pago)?T.brand:T.danger}55`,borderRadius:RADIUS.pill,padding:"5px 12px",fontSize:11,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase"}}>
              {(envioDetalhe?.pago) ? <CheckCircle2 size={12} strokeWidth={2.5}/> : <Clock size={12} strokeWidth={2.5}/>}
              {(envioDetalhe?.pago)?"Pago":"Aguardando"}
            </span>
            <span className="num" style={{color:T.textSm,fontSize:12}}>{new Date(envioDetalhe.criadoEm).toLocaleDateString("pt-BR")}</span>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Button T={T} variant={(envioDetalhe?.pago)?"secondary":"primary"} size="sm" icon={CheckCircle2} onClick={()=>togglePago(envioDetalhe.id)}>
              {(envioDetalhe?.pago)?"Marcar pendente":"Marcar pago"}
            </Button>
            <Button T={T} variant="secondary" size="sm" icon={PlusCircle} onClick={()=>{setAddingNotas(!addingNotas);setAddSelJogos(new Set());setAddSelMensais(new Set());setAddSelLivemode(new Set());}}>
              {addingNotas?"Cancelar":"Adicionar notas"}
            </Button>
            <Button T={T} variant="secondary" size="sm" icon={Share2} onClick={()=>copiarLinkEnvio(envioDetalhe)}>Compartilhar</Button>
            <Button T={T} variant="secondary" size="sm" icon={ExternalLink} onClick={()=>window.open(envioPublicHash(envioDetalhe),"_blank")}>Abrir página</Button>
          </div>
        </div>

        {/* ── ADICIONAR NOTAS (expandível) ── */}
        {addingNotas && (
          <Card T={T} style={{marginBottom:16}} accent={T.brand}>
            <PanelTitle T={T} title="Adicionar notas a este envio" subtitle={`${addSelJogos.size + addSelMensais.size} selecionadas`} color={T.brand}/>
            {nfsDisponiveis.length + mensaisDisponiveis.length + livemodeDisponiveis.length === 0 ? (
              <p style={{color:T.textSm,fontSize:12,padding:16,margin:0}}>Todas as NFs já foram enviadas</p>
            ) : (<>
              {nfsDisponiveis.length > 0 && (
                <div style={{borderTop:`1px solid ${T.border}`}}>
                  <p style={{color:T.textSm,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",padding:"10px 22px 4px",margin:0}}>NFs de Jogos</p>
                  <div style={{maxHeight:200,overflowY:"auto"}}>
                    {nfsDisponiveis.map(n => {
                      const sel = addSelJogos.has(n.id);
                      return (
                        <div key={n.id} onClick={()=>toggleAddJogo(n.id)}
                          style={{display:"flex",alignItems:"center",gap:12,padding:"8px 22px",cursor:"pointer",background:sel?T.brand+"15":"transparent",transition:"background .15s"}}>
                          <input type="checkbox" checked={sel} readOnly style={{accentColor:T.brand}}/>
                          <span style={{flex:1,fontSize:12,color:T.text,fontWeight:600}}>{n.fornecedor}</span>
                          <span style={{fontSize:10,color:T.textSm}}>NF {n.numeroNF||"—"}</span>
                          <span style={{fontSize:10,color:T.textSm}}>{n.jogoLabel}</span>
                          <Pill label={`Rd ${n.rodada}`} color={T.warning}/>
                          <span className="num" style={{fontSize:12,color:purple,fontWeight:700}}>{fmt(n.valorNF)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {mensaisDisponiveis.length > 0 && (
                <div style={{borderTop:`1px solid ${T.border}`}}>
                  <p style={{color:T.textSm,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",padding:"10px 22px 4px",margin:0}}>NFs Mensais</p>
                  <div style={{maxHeight:200,overflowY:"auto"}}>
                    {mensaisDisponiveis.map(n => {
                      const sel = addSelMensais.has(n.id);
                      return (
                        <div key={n.id} onClick={()=>toggleAddMensal(n.id)}
                          style={{display:"flex",alignItems:"center",gap:12,padding:"8px 22px",cursor:"pointer",background:sel?cyan+"15":"transparent",transition:"background .15s"}}>
                          <input type="checkbox" checked={sel} readOnly style={{accentColor:cyan}}/>
                          <span style={{flex:1,fontSize:12,color:T.text,fontWeight:600}}>{n.fornecedor}</span>
                          <span style={{fontSize:10,color:T.textSm}}>NF {n.numeroNF||"—"}</span>
                          <Pill label={n.mesLabel} color={cyan}/>
                          <Pill label={n.categoria} color={T.warning}/>
                          <span className="num" style={{fontSize:12,color:purple,fontWeight:700}}>{fmt(n.valor)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {livemodeDisponiveis.length > 0 && (
                <div style={{borderTop:`1px solid ${T.border}`}}>
                  <p style={{color:T.textSm,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",padding:"10px 22px 4px",margin:0}}>NFs Livemode</p>
                  <div style={{maxHeight:200,overflowY:"auto"}}>
                    {livemodeDisponiveis.map(n => {
                      const sel = addSelLivemode.has(n.id);
                      return (
                        <div key={n.id} onClick={()=>toggleAddLivemode(n.id)}
                          style={{display:"flex",alignItems:"center",gap:12,padding:"8px 22px",cursor:"pointer",background:sel?teal+"15":"transparent",transition:"background .15s"}}>
                          <input type="checkbox" checked={sel} readOnly style={{accentColor:teal}}/>
                          <span style={{flex:1,fontSize:12,color:T.text,fontWeight:600}}>{n.fornecedor || "Livemode"}</span>
                          <Pill label={n.rodadasLabel || `Rd ${n.rodada}`} color={T.warning}/>
                          <span style={{fontSize:9,color:T.textSm}}>{(n.servicosLabels||[]).join(", ")}</span>
                          <span className="num" style={{fontSize:12,color:purple,fontWeight:700}}>{fmt(n.valor)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{padding:"12px 22px",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"flex-end"}}>
                <Button T={T} variant="primary" size="md" icon={PlusCircle} onClick={()=>confirmarAdicionarNotas(envioDetalhe.id)} disabled={addSelJogos.size+addSelMensais.size+addSelLivemode.size===0}>
                  Adicionar {addSelJogos.size + addSelMensais.size + addSelLivemode.size} nota{addSelJogos.size+addSelMensais.size+addSelLivemode.size!==1?"s":""}
                </Button>
              </div>
            </>)}
          </Card>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16,marginBottom:20}}>
          <KPI label="NFs de Jogos" value={fmt(envioDetalheMetricas.totalJogos)} sub={`${countNotasFiscais(envioDetalhe.notasResumo||[], { dedupe: dedupeNotasPorNF })} notas`} color={T.brand} T={T}/>
          <KPI label="NFs Mensais" value={fmt(envioDetalheMetricas.totalMensais)} sub={`${(envioDetalhe.mensaisResumo||[]).length} notas`} color={cyan} T={T}/>
          <KPI label="NFs Livemode" value={fmt(envioDetalheMetricas.totalLivemode)} sub={`${(envioDetalhe.livemodeResumo||[]).length} notas`} color={teal} T={T}/>
          <KPI label="Total Envio" value={fmt(envioDetalheMetricas.totalGeral)} sub={`${envioDetalheMetricas.qtdNotas} notas`} color={purple} T={T}/>
        </div>

        {envioDetalhe.obs && (
          <Card T={T} style={{marginBottom:16}}>
            <div style={{padding:"12px 18px",color:T.textMd,fontSize:12}}>
              <b style={{color:T.text}}>Observação:</b> {envioDetalhe.obs}
            </div>
          </Card>
        )}

        {(envioDetalhe.notasResumo||[]).length > 0 && (
          <Card T={T} style={{marginBottom:16}}>
            <PanelTitle T={T} title="Notas Fiscais de Jogos" color={T.brand}/>
            <div style={TS.wrap}>
              <table style={{...TS.table, minWidth:780}}>
                <thead>
                  <tr style={TS.thead}>
                    {["Código","Nº NF","Fornecedor","Valor","Emissão","Data Pgto","Jogo","Rd","Serviços","Status","",""].map((h,i) =>
                      <th key={h+i} style={{...TS.th, ...(h==="Valor"?TS.thRight:TS.thLeft)}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...envioDetalhe.notasResumo].sort((a,b) => (a.rodada||0) - (b.rodada||0) || (a.fornecedor||"").localeCompare(b.fornecedor||"")).map(n => (
                    <tr key={n.id} style={TS.tr}>
                      <td style={TS.td}><code className="num" style={{color:T.brand,fontSize:11,background:T.brand+"15",padding:"2px 6px",borderRadius:4,fontWeight:600}}>{n.codigo}</code></td>
                      <td className="num" style={{...TS.td, fontWeight:600, fontSize:12}}>{n.numeroNF||"—"}</td>
                      <td style={{...TS.td, fontSize:12}}>{n.fornecedor}</td>
                      <td className="num" style={{...TS.tdNum, color:purple, fontWeight:700}}>{fmt(n.valorNF)}</td>
                      <td className="num" style={{...TS.td, color:T.textSm, fontSize:11}}>{n.dataEmissao||"—"}</td>
                      <td className="num" style={{...TS.td, color:T.textSm, fontSize:11}}>{n.dataPagamento||"—"}</td>
                      <td style={{...TS.td, fontSize:11, whiteSpace:"nowrap"}}>{n.jogoLabel}</td>
                      <td className="num" style={{...TS.td, fontSize:12}}>{n.rodada}</td>
                      <td style={{...TS.td, fontSize:10, color:T.textSm}}>{(n.servicosLabels||[]).join(", ")}</td>
                      <td style={TS.td}>
                        <select value={n.statusNota||"Pendente"} onChange={e=>updateNotaStatus(envioDetalhe.id, n.id, "jogo", e.target.value)}
                          style={{background:STATUS_NOTA_COLOR[n.statusNota||"Pendente"]+"22",color:STATUS_NOTA_COLOR[n.statusNota||"Pendente"],border:`1px solid ${STATUS_NOTA_COLOR[n.statusNota||"Pendente"]}55`,borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                          {STATUS_NOTA.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={TS.td}>{n.hasFile && (
                        <div style={{display:"flex",gap:4}}>
                          <Button T={T} variant="secondary" size="sm" icon={Eye} onClick={()=>openPreview(n.id)}/>
                          <Button T={T} variant="secondary" size="sm" icon={Download} onClick={()=>downloadNF(n.id, n.codigo)}/>
                        </div>
                      )}</td>
                      <td style={TS.td}>
                        <Button T={T} variant="danger" size="sm" icon={X} onClick={()=>removerNotaDoEnvio(envioDetalhe.id, n.id, "jogo")}/>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {(envioDetalhe.mensaisResumo||[]).length > 0 && (
          <Card T={T}>
            <PanelTitle T={T} title="Notas Fiscais Mensais" color={cyan}/>
            <div style={TS.wrap}>
              <table style={{...TS.table, minWidth:680}}>
                <thead>
                  <tr style={TS.thead}>
                    {["Fornecedor","Categoria","Mês","Nº NF","Valor","Emissão","Data Pgto","Status","",""].map((h,i) =>
                      <th key={h+i} style={{...TS.th, ...(h==="Valor"?TS.thRight:TS.thLeft)}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {envioDetalhe.mensaisResumo.map(n => (
                    <tr key={n.id} style={TS.tr}>
                      <td style={{...TS.td, fontWeight:600, fontSize:12}}>{n.fornecedor}</td>
                      <td style={TS.td}><Pill label={n.categoria} color={cyan}/></td>
                      <td style={{...TS.td, fontSize:12}}>{n.mesLabel}</td>
                      <td className="num" style={{...TS.td, fontSize:12}}>{n.numeroNF||"—"}</td>
                      <td className="num" style={{...TS.tdNum, color:purple, fontWeight:700}}>{fmt(n.valor)}</td>
                      <td className="num" style={{...TS.td, color:T.textSm, fontSize:11}}>{n.dataEmissao||"—"}</td>
                      <td className="num" style={{...TS.td, color:T.textSm, fontSize:11}}>{n.dataPagamento||"—"}</td>
                      <td style={TS.td}>
                        <select value={n.statusNota||"Pendente"} onChange={e=>updateNotaStatus(envioDetalhe.id, n.id, "mensal", e.target.value)}
                          style={{background:STATUS_NOTA_COLOR[n.statusNota||"Pendente"]+"22",color:STATUS_NOTA_COLOR[n.statusNota||"Pendente"],border:`1px solid ${STATUS_NOTA_COLOR[n.statusNota||"Pendente"]}55`,borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                          {STATUS_NOTA.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={TS.td}>{n.hasFile && (
                        <div style={{display:"flex",gap:4}}>
                          <Button T={T} variant="secondary" size="sm" icon={Eye} onClick={()=>openPreview(n.id)}/>
                          <Button T={T} variant="secondary" size="sm" icon={Download} onClick={()=>downloadNF(n.id, `NF_${n.fornecedor}`)}/>
                        </div>
                      )}</td>
                      <td style={TS.td}>
                        <Button T={T} variant="danger" size="sm" icon={X} onClick={()=>removerNotaDoEnvio(envioDetalhe.id, n.id, "mensal")}/>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {(envioDetalhe.livemodeResumo||[]).length > 0 && (
          <Card T={T} style={{marginTop:16}}>
            <PanelTitle T={T} title="Notas Fiscais Livemode" color={teal}/>
            <div style={TS.wrap}>
              <table style={{...TS.table, minWidth:600}}>
                <thead>
                  <tr style={TS.thead}>
                    {["Rodadas","Nº NF","Fornecedor","Serviços","Valor","Emissão","Status","",""].map((h,i) =>
                      <th key={h+i} style={{...TS.th, ...(h==="Valor"?TS.thRight:TS.thLeft)}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {envioDetalhe.livemodeResumo.map(n => (
                    <tr key={n.id} style={TS.tr}>
                      <td style={{...TS.td, fontWeight:700, fontSize:12}}>{n.rodadasLabel || `Rd ${n.rodada}`}</td>
                      <td className="num" style={{...TS.td, fontSize:12}}>{n.numeroNF||"—"}</td>
                      <td style={{...TS.td, fontWeight:600, fontSize:12}}>{n.fornecedor}</td>
                      <td style={{...TS.td, fontSize:10, color:T.textSm}}>{(n.servicosLabels||[]).join(", ")}</td>
                      <td className="num" style={{...TS.tdNum, color:purple, fontWeight:700}}>{fmt(n.valor)}</td>
                      <td className="num" style={{...TS.td, color:T.textSm, fontSize:11}}>{n.dataEmissao||"—"}</td>
                      <td style={TS.td}>
                        <select value={n.statusNota||"Pendente"} onChange={e=>updateNotaStatus(envioDetalhe.id, n.id, "livemode", e.target.value)}
                          style={{background:STATUS_NOTA_COLOR[n.statusNota||"Pendente"]+"22",color:STATUS_NOTA_COLOR[n.statusNota||"Pendente"],border:`1px solid ${STATUS_NOTA_COLOR[n.statusNota||"Pendente"]}55`,borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                          {STATUS_NOTA.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={TS.td}>{n.hasFile && (
                        <div style={{display:"flex",gap:4}}>
                          <Button T={T} variant="secondary" size="sm" icon={Eye} onClick={()=>openPreview(n.id)}/>
                          <Button T={T} variant="secondary" size="sm" icon={Download} onClick={()=>downloadNF(n.id, `NF_LM_${n.fornecedor}`)}/>
                        </div>
                      )}</td>
                      <td style={TS.td}>
                        <Button T={T} variant="danger" size="sm" icon={X} onClick={()=>removerNotaDoEnvio(envioDetalhe.id, n.id, "livemode")}/>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </>)}

      {/* ── MODAL PREVIEW NF ── */}
      {previewId !== null && (
        <div onClick={() => { setPreviewId(null); setPreviewSrc(null); }}
          style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:T.card,borderRadius:16,padding:"16px 20px",maxWidth:900,width:"100%",maxHeight:"92vh",display:"flex",flexDirection:"column",border:`1px solid ${T.border}`,boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexShrink:0}}>
              <span style={{color:T.text,fontWeight:700,fontSize:15}}>Visualizar Nota Fiscal</span>
              <button onClick={() => { setPreviewId(null); setPreviewSrc(null); }}
                style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",cursor:"pointer",color:T.textSm,display:"flex",alignItems:"center"}}>
                <X size={16}/>
              </button>
            </div>
            <div style={{flex:1,minHeight:0,overflow:"auto",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {previewLoading ? (
                <p style={{color:T.textMd,fontSize:14}}>Carregando arquivo...</p>
              ) : previewSrc ? (
                previewSrc.startsWith("data:application/pdf") ? (
                  <iframe src={previewSrc} style={{width:"100%",height:"75vh",border:"none",borderRadius:8}}/>
                ) : (
                  <img src={previewSrc} alt="NF" style={{maxWidth:"100%",maxHeight:"75vh",objectFit:"contain",borderRadius:8}}/>
                )
              ) : (
                <p style={{color:T.textMd,fontSize:14}}>Arquivo não encontrado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
