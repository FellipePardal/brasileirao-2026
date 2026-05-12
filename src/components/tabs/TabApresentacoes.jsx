import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import PptxGenJS from "pptxgenjs";
import { btnStyle, iSty, ORC_PADRAO, REAL_PADRAO, RADIUS } from "../../constants";
import { parseBR, fmtNum, fmtR, fmtRs, subTotal } from "../../utils";
import { Card, Button } from "../ui";
import { BarChart3, Lock, ArrowRight, ArrowLeft, FileDown, LayoutGrid, ChevronDown, ChevronRight } from "lucide-react";

const fmtBRL = v => "R$ " + Number(v).toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});

// Estado persistido em localStorage
function usePersistedState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch {}
    return typeof initial === "function" ? initial() : initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

// ─── HOOK DONUT ───────────────────────────────────────────────────────────────
function useDonut(canvasRef, rec, pend) {
useEffect(() => {
const canvas = canvasRef.current; if (!canvas) return;
const ctx = canvas.getContext("2d");
const cx=55, cy=55, r=50, ri=34;
ctx.clearRect(0,0,110,110);
const total = rec+pend || 1; let start = -Math.PI/2;
[[rec,"#22c55e"],[pend,"#d97706"]].forEach(([val,color]) => {
const a = val/total*Math.PI*2;
ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+a); ctx.closePath();
ctx.fillStyle = color; ctx.fill(); start += a;
});
ctx.beginPath(); ctx.arc(cx,cy,ri,0,Math.PI*2); ctx.fillStyle="#1e293b"; ctx.fill();
}, [rec, pend]);
}

// ─── SELETOR DE TIPO ──────────────────────────────────────────────────────────
function SeletorTipo({T, onSelect}) {
const opts = [
{key:"variaveis",  icon:BarChart3,  label:"Custos Variáveis",        desc:"Acompanhamento por rodada — orçado × realizado, saving acumulado e notas fiscais.", color:T.brand,   grad:"linear-gradient(135deg,#047857 0%,#10b981 100%)"},
{key:"fixos",      icon:Lock,       label:"Custos Fixos",            desc:"Serviços fixos do campeonato — orçado × gasto × realizado por categoria.",           color:T.info,    grad:"linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)"},
{key:"visaogeral", icon:LayoutGrid, label:"Visão Geral Orçamentária", desc:"Slide único consolidado — KPIs globais, síntese dos pilares (variáveis + fixos) e tabela de blocos.",  color:"#7c3aed", grad:"linear-gradient(135deg,#5b21b6 0%,#7c3aed 100%)"},
];
return (
<div>
<p style={{color:T.brand,fontSize:11,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",margin:"0 0 8px"}}>Apresentações</p>
<h2 style={{margin:"0 0 6px",fontSize:24,color:T.text,fontWeight:800,letterSpacing:"-0.025em"}}>Gerar Apresentação PPTX</h2>
<p style={{color:T.textMd,fontSize:14,marginBottom:32}}>Selecione o tipo de custo que deseja apresentar.</p>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:20}}>
{opts.map(opt => {
const Icon = opt.icon;
return (
<Card key={opt.key} T={T} hoverable onClick={()=>onSelect(opt.key)} style={{cursor:"pointer"}}>
<div onClick={()=>onSelect(opt.key)}>
<div style={{background:opt.grad,padding:"28px 26px 24px",position:"relative",overflow:"hidden"}}>
<div style={{position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:"50%",background:"radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%)",pointerEvents:"none"}}/>
<div style={{width:50,height:50,borderRadius:14,background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
<Icon size={24} color="#fff" strokeWidth={2.25}/>
</div>
<h3 style={{margin:"14px 0 4px",fontSize:18,fontWeight:800,color:"#fff",letterSpacing:"-0.02em",position:"relative"}}>{opt.label}</h3>
</div>
<div style={{padding:"18px 24px 22px"}}>
<p style={{color:T.textMd,fontSize:13,margin:"0 0 18px",lineHeight:1.55}}>{opt.desc}</p>
<Button T={T} variant="primary" size="md" fullWidth icon={ArrowRight}>Preencher formulário</Button>
</div>
</div>
</Card>
);
})}
</div>
</div>
);
}

// ─── FORM VARIÁVEIS ───────────────────────────────────────────────────────────
const ORC_GLOBAL_FIXO = 10130480; // Orçado total variáveis do campeonato (travado)

function FormVariaveis({T, onBack, jogos = [], onDadosCalculados}) {
const [status,      setStatus]      = useState({msg:"Pronto para gerar",cls:""});
const [loading,     setLoading]     = useState(false);
const canvasRef = useRef(null);

// Rodadas disponíveis (jogos já divulgados)
const rodadasDisp = useMemo(() =>
Array.from(new Set(jogos.map(j => j.rodada))).sort((a,b) => a-b),
[jogos]);

const [rodadaAtual, setRodadaAtual] = usePersistedState("apres_var_rodada", () => rodadasDisp[rodadasDisp.length-1] || 1);
useEffect(() => {
if (rodadasDisp.length && !rodadasDisp.includes(rodadaAtual)) {
setRodadaAtual(rodadasDisp[rodadasDisp.length-1]);
}
}, [rodadasDisp]); // eslint-disable-line react-hooks/exhaustive-deps

// Dados computados de jogos (auto)
const computed = useMemo(() => {
const jogosAteRod = jogos.filter(j => j.rodada <= rodadaAtual);
const orcAteRod  = jogosAteRod.reduce((s, j) => s + subTotal(j.orcado || {}), 0);
const realAteRod = jogosAteRod.reduce((s, j) => s + subTotal(j.realizado || {}), 0);
const provAteRod = jogosAteRod.reduce((s, j) => s + subTotal(j.provisionado || {}), 0);
const rodadasAteAtual = rodadasDisp.filter(r => r <= rodadaAtual);
const rodadasAuto = rodadasAteAtual.map(r => {
const jr = jogos.filter(j => j.rodada === r);
return {
rodada: r,
label: `R${r}`,
orcadoAuto:    jr.reduce((s, j) => s + subTotal(j.orcado || {}), 0),
// Na tabela "Realizado" = provisionado (mesma fonte da aba Savings)
realizadoAuto: jr.reduce((s, j) => s + subTotal(j.provisionado || {}), 0),
};
});
return { orcAteRod, realAteRod, provAteRod, rodadasAuto };
}, [jogos, rodadaAtual, rodadasDisp]);

// Overrides por linha (rodada → {orcado?, realizado?})
const [overrides, setOverrides] = usePersistedState("apres_var_overrides", {});
const setRodadaField = (rodada, field, val) =>
setOverrides(prev => ({...prev, [rodada]: {...prev[rodada], [field]: val}}));

// Overrides do bloco "Notas Fiscais" — vazio = usar valor automático da tabela
const [nfEspOverride, setNfEspOverride] = usePersistedState("apres_var_nfEsp", "");
const [nfRecOverride, setNfRecOverride] = usePersistedState("apres_var_nfRec", "");
const resetOverrides = () => { setOverrides({}); setNfEspOverride(""); setNfRecOverride(""); };

// View da tabela aplicando overrides
const rodadasView = computed.rodadasAuto.map(r => ({
...r,
orcado:    overrides[r.rodada]?.orcado    ?? fmtNum(r.orcadoAuto),
realizado: overrides[r.rodada]?.realizado ?? fmtNum(r.realizadoAuto),
}));

const parsed = useMemo(() => {
const rows    = rodadasView.map(r => ({label:r.label, orcado:parseBR(r.orcado), realizado:parseBR(r.realizado)}));
const totOrc  = rows.reduce((s,r) => s+r.orcado, 0);
const totReal = rows.reduce((s,r) => s+r.realizado, 0);
const saving  = totOrc - totReal;
const savPct  = totOrc > 0 ? saving/totOrc*100 : 0;
// Auto: nfEsp segue o total da coluna "Realizado" da tabela; nfRec segue o realizado real das NFs
const autoNfEspV = totReal;
const autoNfRecV = computed.realAteRod;
const nfEspV = nfEspOverride !== "" ? parseBR(nfEspOverride) : autoNfEspV;
const nfRecV = nfRecOverride !== "" ? parseBR(nfRecOverride) : autoNfRecV;
const nfPend = Math.max(0, nfEspV - nfRecV);
const pctRec = nfEspV > 0 ? nfRecV/nfEspV*100 : 0;
return {rows, totOrc, totReal, saving, savPct, nfPend, pctRec, nfEspV, nfRecV, autoNfEspV, autoNfRecV};
}, [rodadasView, computed, nfEspOverride, nfRecOverride]);

useDonut(canvasRef, parsed.nfRecV, parsed.nfPend);

const IS     = {...iSty(T), width:"100%"};
const IS_RO  = {...IS, background:T.bg, cursor:"default"};
const grid3  = {display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20};
const secHdr = {fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:T.text,marginBottom:16};
const secNum = {fontSize:10,color:T.textSm,fontWeight:700,marginRight:8};
const {rows, totOrc, totReal, saving, savPct, nfPend, pctRec, nfRecV, nfEspV, autoNfEspV, autoNfRecV} = parsed;
const orcGlobalFmt = fmtNum(ORC_GLOBAL_FIXO);
// Orçado acumulado = total da coluna Orçado da tabela (com overrides)
const orcAteRodFmt = fmtNum(totOrc);

useEffect(() => {
  if (onDadosCalculados) {
    onDadosCalculados({
      orcGlobal:   ORC_GLOBAL_FIXO,
      orcAteRod:   totOrc,
      realizado:   totReal,
      saving:      saving,
      savPct:      savPct,
      rows:        rows,
      nfEspV:      nfEspV,
      nfRecV:      nfRecV,
      nfPend:      nfPend,
      pctRec:      pctRec,
      rodadaAtual: rodadaAtual,
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [totOrc, totReal, saving, savPct, nfEspV, nfRecV, nfPend, pctRec, rodadaAtual]);

async function gerarPPTX() {
  setLoading(true); setStatus({ msg: "Gerando…", cls: "" });
  try {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    const sl = pptx.addSlide();
    sl.background = { color: "FFFFFF" };

    // ── Barra verde topo ────────────────────────────────────────────────────
    sl.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.06,
      fill: { color: "166534" }, line: { width: 0 }
    });

    // ── Título e Subtítulo ──────────────────────────────────────────────────
    sl.addText("Custos Variáveis", {
      x: 0.35, y: 0.1, w: 12.6, h: 0.38,
      fontSize: 22, bold: true, color: "111827", fontFace: "Segoe UI"
    });

    const rodadaComEstouro = rows.find(r => r.orcado - r.realizado < 0)?.label ?? null;
    const subtitulo = savPct >= 0
      ? `Operação jogo a jogo gera saving de ${Math.abs(savPct).toFixed(1)}%, dentro do orçado até a Rodada ${rodadaAtual}.`
      : `Operação jogo a jogo com estouro de ${Math.abs(savPct).toFixed(1)}%${rodadaComEstouro ? ", alerta isolado na " + rodadaComEstouro : ""}.`;

    sl.addText(subtitulo, {
      x: 0.35, y: 0.5, w: 12.6, h: 0.26,
      fontSize: 11, color: "374151", fontFace: "Segoe UI"
    });

    sl.addShape(pptx.ShapeType.line, {
      x: 0.35, y: 0.82, w: 12.63, h: 0,
      line: { color: "E5E7EB", width: 1 }
    });

    // ── 4 KPI Cards numerados ───────────────────────────────────────────────
    const kW = 3.1, kH = 1.0, kY = 0.94, kGap = 0.077;
    const kpis = [
      { num: "1", label: "ORÇADO TOTAL",                  val: fmtBRL(ORC_GLOBAL_FIXO), valColor: "9CA3AF", accent: false },
      { num: "2", label: `ORÇADO ATÉ R${rodadaAtual}`,    val: fmtBRL(totOrc),          valColor: "111827", accent: false },
      { num: "3", label: `REALIZADO ATÉ R${rodadaAtual}`, val: fmtBRL(totReal),         valColor: "111827", accent: false },
      {
        num: "4", label: "SAVING ACUMULADO",
        val: (saving >= 0 ? "▲ " : "▼ ") + fmtBRL(Math.abs(saving)),
        valColor: saving >= 0 ? "16A34A" : "DC2626",
        accent: true
      },
    ];

    kpis.forEach(({ num, label, val, valColor, accent }, i) => {
      const x = 0.35 + i * (kW + kGap);
      sl.addShape(pptx.ShapeType.rect, {
        x, y: kY, w: kW, h: kH,
        fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 0.75 }
      });
      if (accent) {
        sl.addShape(pptx.ShapeType.rect, {
          x, y: kY, w: 0.06, h: kH,
          fill: { color: saving >= 0 ? "16A34A" : "DC2626" }, line: { width: 0 }
        });
      }
      sl.addText(num, {
        x: x + 0.12, y: kY + 0.09, w: 0.2, h: 0.16,
        fontSize: 8, color: "9CA3AF", fontFace: "Segoe UI"
      });
      sl.addText(label, {
        x: x + 0.12, y: kY + 0.28, w: kW - 0.22, h: 0.18,
        fontSize: 7.5, bold: true, color: "6B7280", charSpacing: 1.2, fontFace: "Segoe UI"
      });
      sl.addText(val, {
        x: x + 0.12, y: kY + 0.5, w: kW - 0.22, h: 0.4,
        fontSize: 16, color: valColor, fontFace: "Segoe UI"
      });
    });

    // ── Gráfico de Barras (coluna esquerda 60%) ─────────────────────────────
    sl.addText("Gráfico de Barras (Orçado vs Realizado)", {
      x: 0.35, y: 2.06, w: 7.8, h: 0.22,
      fontSize: 11, bold: true, color: "111827", fontFace: "Segoe UI"
    });

    sl.addChart(pptx.ChartType.bar, [
      { name: "Orçado",    labels: rows.map(r => r.label), values: rows.map(r => r.orcado) },
      { name: "Realizado", labels: rows.map(r => r.label), values: rows.map(r => r.realizado) },
    ], {
      x: 0.35, y: 2.3, w: 7.8, h: 3.1,
      barDir: "col", barGrouping: "clustered",
      chartColors: ["C8C8C8", "22C55E"],
      showValue: false,
      showLegend: true, legendPos: "b", legendFontSize: 9,
      valGridLine: { style: "none" }, catGridLine: { style: "none" },
      valAxisLabelFontSize: 8, catAxisLabelFontSize: 8,
    });

    // ── Status NFs (coluna direita 40%) ─────────────────────────────────────
    sl.addText("Status NFs", {
      x: 8.35, y: 2.06, w: 4.63, h: 0.22,
      fontSize: 11, bold: true, color: "111827", fontFace: "Segoe UI"
    });

    const pctRecV = nfEspV > 0 ? Math.min(1, nfRecV / nfEspV) : 0;
    const barW = 4.63, barH = 0.26, barX = 8.35, barY = 2.32;

    sl.addShape(pptx.ShapeType.rect, { x: barX, y: barY, w: barW, h: barH, fill: { color: "D1D5DB" }, line: { width: 0 } });
    sl.addShape(pptx.ShapeType.rect, { x: barX, y: barY, w: Math.max(0.05, barW * pctRecV), h: barH, fill: { color: "16A34A" }, line: { width: 0 } });

    sl.addText(`${Math.round(pctRecV * 100)}% Recebidas (${fmtBRL(nfRecV)})`, {
      x: barX, y: barY + 0.3, w: barW * 0.6, h: 0.18,
      fontSize: 8, bold: true, color: "16A34A", fontFace: "Segoe UI"
    });
    sl.addText(`${Math.round((1 - pctRecV) * 100)}% Pendentes (${fmtBRL(nfPend)})`, {
      x: barX + barW * 0.6, y: barY + 0.3, w: barW * 0.4, h: 0.18,
      fontSize: 8, color: "6B7280", fontFace: "Segoe UI", align: "right"
    });

    // ── Tabela por Rodada (coluna direita) ──────────────────────────────────
    const th = (txt, align = "left") => ({
      text: txt,
      options: { bold: true, fontSize: 7.5, color: "FFFFFF", fill: { color: "111827" }, align }
    });

    const tblRows = rows.map((r, i) => {
      const sav    = r.orcado - r.realizado;
      const savPctRow = r.orcado > 0 ? sav / r.orcado * 100 : 0;
      const fill   = { color: i % 2 === 0 ? "FFFFFF" : "F9FAFB" };
      const sc     = sav >= 0 ? "16A34A" : "DC2626";
      const icon   = sav >= 0 ? "▲ " : "▼ ";
      return [
        { text: r.label,                                          options: { fontSize: 8, bold: true, color: "374151", fill } },
        { text: fmtBRL(r.orcado),                                options: { fontSize: 8, color: "374151", fill, align: "right" } },
        { text: fmtBRL(r.realizado),                             options: { fontSize: 8, color: "374151", fill, align: "right" } },
        { text: icon + fmtBRL(Math.abs(sav)),                    options: { fontSize: 8, bold: true, color: sc, fill, align: "right" } },
        { text: icon + Math.abs(savPctRow).toFixed(1) + "%",     options: { fontSize: 8, bold: true, color: sc, fill, align: "right" } },
      ];
    });

    const stcTot  = saving >= 0 ? "A3E635" : "FF6B6B";
    const iconTot = saving >= 0 ? "▲ " : "▼ ";
    const totFill = { color: "111827" };
    const tblTot  = [
      { text: "TOTAL",                                           options: { fontSize: 8, bold: true, color: "FFFFFF", fill: totFill } },
      { text: fmtBRL(totOrc),                                   options: { fontSize: 8, bold: true, color: "FFFFFF", fill: totFill, align: "right" } },
      { text: fmtBRL(totReal),                                  options: { fontSize: 8, bold: true, color: "FFFFFF", fill: totFill, align: "right" } },
      { text: iconTot + fmtBRL(Math.abs(saving)),               options: { fontSize: 8, bold: true, color: stcTot, fill: totFill, align: "right" } },
      { text: iconTot + Math.abs(savPct).toFixed(1) + "%",      options: { fontSize: 8, bold: true, color: stcTot, fill: totFill, align: "right" } },
    ];

    const rowH = Math.max(0.2, 4.5 / (rows.length + 2));
    sl.addTable(
      [
        [th("RODADA"), th("ORÇADO", "right"), th("REALIZADO", "right"), th("SAVING (R$)", "right"), th("SAVING (%)", "right")],
        ...tblRows,
        tblTot,
      ],
      {
        x: 8.35, y: 2.7, w: 4.63,
        colW: [0.65, 1.02, 1.02, 1.18, 0.76],
        border: { type: "solid", color: "E5E7EB", pt: 0.5 },
        rowH,
      }
    );

    // ── Rodapé ──────────────────────────────────────────────────────────────
    sl.addText("Acompanhamento Orçamentário – Brasileirão 2026", {
      x: 0.35, y: 7.28, w: 12.63, h: 0.16,
      fontSize: 7.5, color: "9CA3AF", align: "center", fontFace: "Segoe UI"
    });

    await pptx.writeFile({ fileName: `custos_variaveis_R${rodadaAtual}_brasileirao2026.pptx` });
    setStatus({ msg: `✅ custos_variaveis_R${rodadaAtual}.pptx baixado!`, cls: "ok" });
  } catch (e) {
    setStatus({ msg: "❌ Erro: " + e.message, cls: "err" });
    console.error(e);
  }
  setLoading(false);
}

return (
<div style={{paddingBottom:80}}>
<div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
<Button T={T} variant="secondary" size="md" icon={ArrowLeft} onClick={onBack}>Voltar</Button>
<div style={{display:"flex",alignItems:"center",gap:12}}>
<div style={{width:40,height:40,borderRadius:12,background:T.brandSoft||"rgba(16,185,129,0.12)",border:`1px solid ${T.brandBorder||"rgba(16,185,129,0.28)"}`,color:T.brand||"#10b981",display:"flex",alignItems:"center",justifyContent:"center"}}>
<BarChart3 size={18} strokeWidth={2.25}/>
</div>
<div>
<h2 style={{margin:0,fontSize:18,color:T.text,fontWeight:800,letterSpacing:"-0.02em"}}>Custos Variáveis</h2>
<p style={{margin:"2px 0 0",fontSize:12,color:T.textMd}}>Acompanhamento por rodada</p>
</div>
</div>
</div>

  <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
    <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>01</span><span style={secHdr}>Configuração Base</span></div>
    <div style={grid3}>
      <div style={{marginBottom:16}}>
        <label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Rodada Atual *</label>
        <select value={rodadaAtual} onChange={e=>setRodadaAtual(parseInt(e.target.value))} style={{...IS}}>
          {rodadasDisp.length === 0
            ? <option value={1}>—</option>
            : rodadasDisp.map(r => <option key={r} value={r}>Rodada {r}</option>)}
        </select>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Orçado Total – Campeonato <span style={{background:"#1e3a5f",color:"#93c5fd",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>FIXO</span></label>
        <input readOnly value={orcGlobalFmt} style={{...IS_RO}}/>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Orçado Acumulado até a Rodada <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO</span></label>
        <input readOnly value={orcAteRodFmt} style={{...IS_RO,color:"#22c55e"}}/>
      </div>
    </div>
  </div>

  <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
    <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8,marginBottom:18}}>
      <div style={{display:"flex",alignItems:"baseline",gap:8}}><span style={secNum}>02</span><span style={secHdr}>Dados por Rodada</span></div>
      <button onClick={resetOverrides} style={{...btnStyle,background:T.border,color:T.text,padding:"5px 12px",fontSize:11}}>🔄 Re-sincronizar com portal</button>
    </div>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
        <thead><tr style={{background:T.bg}}>{["Rodada","Orçado (R$)","Realizado (R$)","Saving (R$)"].map((h,i)=>(<th key={h} style={{padding:"10px 12px",textAlign:i===0?"left":"right",color:T.textSm,fontSize:11,borderBottom:`1px solid ${T.border}`}}>{h}</th>))}</tr></thead>
        <tbody>
          {rodadasView.map((r,i) => {
            const orcVal  = parseBR(r.orcado);
            const realVal = parseBR(r.realizado);
            const sav     = orcVal - realVal;
            return (
              <tr key={r.rodada} style={{borderBottom:`1px solid ${T.border}`}}>
                <td style={{padding:"6px 12px",fontWeight:700,color:"#22c55e",fontSize:13}}>{r.label}</td>
                <td style={{padding:"4px 12px",textAlign:"right"}}><input value={r.orcado} onChange={e=>setRodadaField(r.rodada,"orcado",e.target.value)} style={{...iSty(T),width:120,textAlign:"right",padding:"4px 8px"}}/></td>
                <td style={{padding:"4px 12px",textAlign:"right"}}><input value={r.realizado} onChange={e=>setRodadaField(r.rodada,"realizado",e.target.value)} style={{...iSty(T),width:120,textAlign:"right",padding:"4px 8px",color:"#22c55e"}}/></td>
                <td style={{padding:"6px 12px",textAlign:"right",fontWeight:700,color:sav>=0?"#a3e635":"#ef4444"}}>{sav>=0?"▲ ":"▼ "}{fmtR(Math.abs(sav))}</td>
              </tr>
            );
          })}
          {rodadasView.length === 0 && (
            <tr><td colSpan={4} style={{padding:24,textAlign:"center",color:T.textSm,fontSize:12}}>Nenhuma rodada disponível</td></tr>
          )}
        </tbody>
        <tfoot><tr style={{background:T.bg}}>
          <td style={{padding:"10px 12px",fontSize:11,color:T.textSm,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Total</td>
          <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:T.text}}>{fmtR(totOrc)}</td>
          <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:T.text}}>{fmtR(totReal)}</td>
          <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:saving>=0?"#a3e635":"#ef4444"}}>{saving>=0?"▲ ":"▼ "}{fmtR(Math.abs(saving))}</td>
        </tr></tfoot>
      </table>
    </div>
  </div>

  <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
    <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>03</span><span style={secHdr}>Notas Fiscais</span></div>
    <div style={grid3}>
      <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Notas Esperadas <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO · editável</span></label><input value={nfEspOverride !== "" ? nfEspOverride : fmtNum(autoNfEspV)} onChange={e=>setNfEspOverride(e.target.value)} style={{...IS}}/></div>
      <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Notas Recebidas <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO · editável</span></label><input value={nfRecOverride !== "" ? nfRecOverride : fmtNum(autoNfRecV)} onChange={e=>setNfRecOverride(e.target.value)} style={{...IS,color:"#22c55e"}}/></div>
      <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Pendentes <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO</span></label><input readOnly value={fmtNum(nfPend)} style={{...IS_RO,color:"#d97706"}}/></div>
    </div>
    <div style={{display:"flex",gap:32,alignItems:"flex-start",marginTop:20,flexWrap:"wrap"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
        <div style={{position:"relative",width:110,height:110}}>
          <canvas ref={canvasRef} width={110} height={110}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:15,fontWeight:700,color:T.text}}>{Math.round(pctRec)}%</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          <span style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:T.textMd}}><span style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/> Recebidas · <b style={{color:T.text}}>{fmtRs(nfRecV)}</b></span>
          <span style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:T.textMd}}><span style={{width:8,height:8,borderRadius:"50%",background:"#d97706",flexShrink:0}}/> Pendentes · <b style={{color:T.text}}>{fmtRs(nfPend)}</b></span>
        </div>
      </div>
      <div style={{display:"flex",gap:28,flexWrap:"wrap",flex:1}}>
        {[
          {label:"% Recebidas",     val:`${pctRec.toFixed(1)}%`,                           sub:fmtRs(nfRecV),                             color:"#22c55e"},
          {label:"% Pendentes",     val:`${(100-pctRec).toFixed(1)}%`,                     sub:fmtRs(nfPend),                             color:"#d97706"},
          {label:"Saving Acumulado",val:(saving>=0?"▲ ":"▼ ")+fmtRs(Math.abs(saving)),    sub:`${Math.abs(savPct).toFixed(1)}% vs. orçado`,color:saving>=0?"#a3e635":"#ef4444"},
        ].map(m=>(
          <div key={m.label}>
            <p style={{fontSize:10,color:T.textSm,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{m.label}</p>
            <p style={{fontSize:22,fontWeight:300,color:m.color,marginBottom:2}}>{m.val}</p>
            <p style={{fontSize:10,color:T.textSm}}>{m.sub}</p>
          </div>
        ))}
      </div>
    </div>
  </div>

  <div style={{position:"sticky",bottom:0,background:T.surface||T.card,borderTop:`1px solid ${T.border}`,padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:50,boxShadow:"0 -8px 24px -8px rgba(0,0,0,0.3)"}}>
    <div>
      <p style={{fontSize:12,color:T.textMd,marginBottom:2}}><b style={{color:T.text,fontWeight:700}}>Tudo preenchido?</b> Clique para gerar e baixar o PPTX.</p>
      <p style={{fontSize:11,color:status.cls==="ok"?T.brand:status.cls==="err"?T.danger:T.textSm,fontWeight:600}}>{status.msg}</p>
    </div>
    <Button T={T} variant="primary" size="lg" icon={FileDown} onClick={gerarPPTX} disabled={loading}>
      {loading ? "Gerando..." : "Gerar PPTX"}
    </Button>
  </div>
</div>

);
}

// ─── FORM FIXOS ───────────────────────────────────────────────────────────────
const MESES_FIX = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function FormFixos({T, onBack, servicos = [], notasMensais = [], onDadosCalculados}) {
const [status,  setStatus]  = useState({msg:"Pronto para gerar", cls:""});
const [loading, setLoading] = useState(false);
const [mesAtual, setMesAtual] = usePersistedState("apres_fix_mes", () => new Date().getMonth());

// Categorias variáveis (excluídas dos "Outros Mensais" fixos)
const VAR_CATS_FIX = new Set(["Transporte","Uber","Hospedagem","Seg. Espacial"]);

// Auto: orçado anual ÷ 12 × meses decorridos (acumulado até o mês selecionado)
//       gasto = NFs mensais até o mês selecionado
const mesesDecorridos = mesAtual + 1; // jan=1, fev=2, ...
const computed = useMemo(() => {
const sections = servicos.map(sec => {
const idsItens = sec.itens.map(it => it.id);
const orcAnual  = sec.itens.reduce((s, it) => s + (it.orcado || 0), 0);
const provAnual = sec.itens.reduce((s, it) => s + (it.provisionado || 0), 0);
// Orçado e provisionado mensais por-item conforme flag "tipo":
//   linear  → total / 12 * mesesDecorridos
//   pontual → total integral a partir do mês alocado
//   misto   → parte linear /12 + parte pontual a partir do mês alocado
// Encerrados: provisionado congela em realAoEncerrar (independente do tipo)
// Rateio pontual: fração = (meses alocados decorridos) / (total de meses alocados)
const pontualRatio = (it, mes) => {
  const list = Array.isArray(it.mesesAlocacao) ? it.mesesAlocacao
    : (it.mesAlocacao != null ? [it.mesAlocacao] : []);
  if (!list.length) return mes >= 0 ? 1 : 0; // sem config: aparece integral
  const decorridos = list.filter(m => m <= mes).length;
  return decorridos / list.length;
};
const orcAuto = sec.itens.reduce((s, it) => {
  const orc = it.orcado || 0;
  const tipo = it.tipo || "linear";
  if (tipo === "pontual") return s + orc * pontualRatio(it, mesAtual);
  if (tipo === "misto") {
    const pl = it.parcelaLinear || 0;
    const pp = it.parcelaPontual || 0;
    const tot = pl + pp;
    if (tot > 0) {
      const rL = pl / tot;
      return s + (orc * rL / 12) * mesesDecorridos + orc * (1 - rL) * pontualRatio(it, mesAtual);
    }
    return s + (orc / 12) * mesesDecorridos;
  }
  return s + (orc / 12) * mesesDecorridos;
}, 0);
const itensDebug = sec.itens.map(it => {
  if (it.status === "encerrado") return { nome: it.nome, tipo: "encerrado", prov: it.realAoEncerrar || 0, ratio: null, contribui: it.realAoEncerrar || 0, mesesAlocacao: [] };
  const prov = it.provisionado || 0;
  const tipo = it.tipo || "linear";
  if (tipo === "pontual") {
    const ratio = pontualRatio(it, mesAtual);
    return { nome: it.nome, tipo, prov, ratio, contribui: prov * ratio, mesesAlocacao: it.mesesAlocacao || [] };
  }
  if (tipo === "misto") {
    const pl = it.parcelaLinear || 0; const pp = it.parcelaPontual || 0;
    return { nome: it.nome, tipo, prov, ratio: null, contribui: (pl / 12) * mesesDecorridos + pp * pontualRatio(it, mesAtual), mesesAlocacao: it.mesesAlocacao || [] };
  }
  return { nome: it.nome, tipo: "linear", prov, ratio: null, contribui: (prov / 12) * mesesDecorridos, mesesAlocacao: [] };
});
const provAuto = itensDebug.reduce((s, it) => s + it.contribui, 0);
const provTotalAnual = provAnual;
// prov anual apenas de itens ativos (encerrados saem da expectativa de NFs)
const provAnualAtivos = sec.itens
  .filter(it => it.status !== "encerrado")
  .reduce((s, it) => s + (it.provisionado || 0), 0);
const idsEncerrados = sec.itens.filter(it => it.status === "encerrado").map(it => it.id);
const gastoAuto = notasMensais
.filter(n => n.servicoId && idsItens.includes(n.servicoId) && n.mes <= mesAtual)
.reduce((s, n) => s + (n.valor || 0), 0);
const gastoEncerrados = notasMensais
.filter(n => n.servicoId && idsEncerrados.includes(n.servicoId) && n.mes <= mesAtual)
.reduce((s, n) => s + (n.valor || 0), 0);
return { secao: sec.secao, orcAnual, orcAuto, provAuto, provTotalAnual, provAnualAtivos, gastoAuto, gastoEncerrados, itensDebug };
});

// "Outros Mensais": NFs sem servicoId e sem categoria variável mapeada
const outrosGasto = notasMensais
  .filter(n => !n.servicoId && !VAR_CATS_FIX.has(n.categoria) && n.mes <= mesAtual)
  .reduce((s, n) => s + (n.valor || 0), 0);
if (outrosGasto > 0) {
  sections.push({ secao: "Outros Mensais", orcAnual: 0, orcAuto: 0, provAuto: 0, provTotalAnual: 0, provAnualAtivos: 0, gastoAuto: outrosGasto, gastoEncerrados: 0 });
}

const orcAnualTotal         = sections.reduce((s, x) => s + x.orcAnual, 0);
const provTotalAnualAll     = sections.reduce((s, x) => s + x.provTotalAnual, 0);
const provTotalAnualAtivos  = sections.reduce((s, x) => s + (x.provAnualAtivos ?? x.provTotalAnual), 0);
const gastoEncerradosTotal  = sections.reduce((s, x) => s + (x.gastoEncerrados || 0), 0);
const orcTotalAuto          = sections.reduce((s, x) => s + x.orcAuto, 0);
return { sections, orcTotalAuto, orcAnualTotal, provTotalAnualAll, provTotalAnualAtivos, gastoEncerradosTotal };

}, [servicos, notasMensais, mesAtual, mesesDecorridos]);

// Overrides por seção (secao → {orc?, gasto?})
const [overrides, setOverrides] = usePersistedState("apres_fix_overrides", {});
const setSecField = (secao, field, val) =>
setOverrides(prev => ({...prev, [secao]: {...prev[secao], [field]: val}}));
const resetOverrides = () => setOverrides({});

// View aplicando overrides
const sectionsView = computed.sections.map(s => ({
...s,
orc:   overrides[s.secao]?.orc   ?? fmtNum(s.orcAuto),
prov:  overrides[s.secao]?.prov  ?? fmtNum(s.provAuto),
gasto: overrides[s.secao]?.gasto ?? fmtNum(s.gastoAuto),
}));

const parsed = useMemo(() => {
const rows = sectionsView.map(s => {
const orc   = parseBR(s.orc);
const prov  = parseBR(s.prov);
const gasto = parseBR(s.gasto);
// "Outros Mensais" não tem provisionado — saldo compara orçado com gasto real
const saldo = s.secao === "Outros Mensais" ? orc - gasto : orc - prov;
return { secao: s.secao, orc, prov, gasto, saldo };
});
const orcTotal   = rows.reduce((s, r) => s + r.orc, 0);
const provTotal  = rows.reduce((s, r) => s + r.prov, 0);
const gastoTotal = rows.reduce((s, r) => s + r.gasto, 0);
const saldoTotal = orcTotal - provTotal;
return { rows, orcTotal, provTotal, gastoTotal, saldoTotal };
}, [sectionsView]);

const { rows, orcTotal, provTotal, gastoTotal, saldoTotal } = parsed;
const provTotalAnual    = computed.provTotalAnualAll;
// Pendente de NF ignora serviços encerrados: exclui do prov anual e desconta seu gasto.
const provAtivoBase     = computed.provTotalAnualAtivos;
const gastoAtivo        = Math.max(0, gastoTotal - (computed.gastoEncerradosTotal || 0));
const nfRecV = gastoAtivo;
const nfPend = Math.max(0, provAtivoBase - gastoAtivo);
const pctRec = provAtivoBase > 0 ? nfRecV / provAtivoBase * 100 : 0;

// Realizado da Visão Geral segue a mesma regra da tabela do slide:
// Outros Mensais usa gasto (prov=0), demais usam prov.
const realizadoVG = rows.reduce((s, r) => s + (r.secao === "Outros Mensais" ? r.gasto : r.prov), 0);
const saldoVG     = orcTotal - realizadoVG;

useEffect(() => {
  if (onDadosCalculados) {
    onDadosCalculados({
      orcAnualTotal:  computed.orcAnualTotal,
      orcAcumulado:   orcTotal,
      gastoAcumulado: gastoTotal,
      provAcumulado:  realizadoVG,
      saldo:          saldoVG,
      provAnual:      provTotalAnual,
      nfRecV:         nfRecV,
      nfPend:         nfPend,
      pctRec:         pctRec,
      rows:           rows,
      mesAtual:       mesAtual,
      mesLabel:       MESES_FIX[mesAtual],
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [orcTotal, gastoTotal, realizadoVG, saldoVG, nfRecV, nfPend, pctRec, mesAtual]);
const canvasRef = useRef(null);
useDonut(canvasRef, nfRecV, nfPend);

const [expandedSecs, setExpandedSecs] = useState({});
const toggleSec = secao => setExpandedSecs(prev => ({...prev, [secao]: !prev[secao]}));

const orcTotalFmt = fmtNum(orcTotal);
const IS    = {...iSty(T), width:"100%"};
const IS_RO = {...IS, background:T.bg, cursor:"default"};
const grid3  = {display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20};
const secHdr = {fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:T.text,marginBottom:16};
const secNum = {fontSize:10,color:T.textSm,fontWeight:700,marginRight:8};

async function gerarPPTX() {
  setLoading(true); setStatus({ msg: "Gerando…", cls: "" });
  try {
    const mesLabel = MESES_FIX[mesAtual];
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    const sl = pptx.addSlide();
    sl.background = { color: "FFFFFF" };

    // ── Barra verde topo ────────────────────────────────────────────────────
    sl.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.06,
      fill: { color: "166534" }, line: { width: 0 }
    });

    // ── Título e Subtítulo ──────────────────────────────────────────────────
    sl.addText("Custos Fixos", {
      x: 0.35, y: 0.1, w: 12.6, h: 0.38,
      fontSize: 22, bold: true, color: "111827", fontFace: "Segoe UI"
    });
    sl.addText(`Capital estrutural estritamente sob controle até o mês de ${mesLabel}.`, {
      x: 0.35, y: 0.5, w: 12.6, h: 0.26,
      fontSize: 11, color: "374151", fontFace: "Segoe UI"
    });
    sl.addShape(pptx.ShapeType.line, {
      x: 0.35, y: 0.82, w: 12.63, h: 0,
      line: { color: "E5E7EB", width: 1 }
    });

    // ── 4 KPI Cards numerados ───────────────────────────────────────────────
    const kW = 3.1, kH = 1.0, kY = 0.94, kGap = 0.077;
    const kpis = [
      { num: "1", label: "ORÇAMENTO TOTAL (CAMPEONATO)",            val: fmtBRL(computed.orcAnualTotal), valColor: "9CA3AF", accent: false },
      { num: "2", label: `ORÇADO ACUM. (ATÉ ${mesLabel.toUpperCase()})`, val: fmtBRL(orcTotal),        valColor: "111827", accent: false },
      { num: "3", label: `REALIZADO (ATÉ ${mesLabel.toUpperCase()})`,     val: fmtBRL(provTotal),       valColor: "111827", accent: false },
      {
        num: "4", label: "SALDO ACUMULADO",
        val: (saldoTotal >= 0 ? "▲ " : "▼ ") + fmtBRL(Math.abs(saldoTotal)),
        valColor: saldoTotal >= 0 ? "16A34A" : "DC2626",
        accent: true
      },
    ];

    kpis.forEach(({ num, label, val, valColor, accent }, i) => {
      const x = 0.35 + i * (kW + kGap);
      sl.addShape(pptx.ShapeType.rect, {
        x, y: kY, w: kW, h: kH,
        fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 0.75 }
      });
      if (accent) {
        sl.addShape(pptx.ShapeType.rect, {
          x, y: kY, w: 0.06, h: kH,
          fill: { color: saldoTotal >= 0 ? "16A34A" : "DC2626" }, line: { width: 0 }
        });
      }
      sl.addText(num, {
        x: x + 0.12, y: kY + 0.09, w: 0.2, h: 0.16,
        fontSize: 8, color: "9CA3AF", fontFace: "Segoe UI"
      });
      sl.addText(label, {
        x: x + 0.12, y: kY + 0.28, w: kW - 0.22, h: 0.18,
        fontSize: 7.5, bold: true, color: "6B7280", charSpacing: 1.2, fontFace: "Segoe UI"
      });
      sl.addText(val, {
        x: x + 0.12, y: kY + 0.5, w: kW - 0.22, h: 0.4,
        fontSize: 16, color: valColor, fontFace: "Segoe UI"
      });
    });

    // ── Barra Comparativo Orçado vs Realizado ──────────────────────────────
    sl.addText("Comparativo Orçado vs. Realizado", {
      x: 0.35, y: 2.06, w: 12.63, h: 0.22,
      fontSize: 10, color: "6B7280", align: "center", fontFace: "Segoe UI"
    });

    const bW = 12.63, bH = 0.42, bX = 0.35, bY = 2.32;
    const orcBase  = orcTotal || 1;
    const pctProv  = Math.min(1, provTotal / orcBase);
    const provW    = Math.max(0.3, bW * pctProv);
    const saldoW   = bW - provW;

    sl.addShape(pptx.ShapeType.rect, { x: bX, y: bY, w: bW, h: bH, fill: { color: "D1D5DB" }, line: { width: 0 } });
    sl.addShape(pptx.ShapeType.rect, { x: bX, y: bY, w: provW, h: bH, fill: { color: "14532D" }, line: { width: 0 } });

    sl.addText(`Realizado: ${fmtBRL(provTotal)}`, {
      x: bX + 0.1, y: bY + 0.02, w: provW - 0.15, h: bH - 0.04,
      fontSize: 9, bold: true, color: "FFFFFF", valign: "middle", fontFace: "Segoe UI"
    });
    sl.addText(`Saldo: ${fmtBRL(saldoTotal)}`, {
      x: bX + provW + 0.1, y: bY + 0.02, w: saldoW - 0.15, h: bH - 0.04,
      fontSize: 9, color: "374151", valign: "middle", fontFace: "Segoe UI"
    });

    // ── Barra Status NFs ────────────────────────────────────────────────────
    sl.addText("Status NFs", {
      x: 0.35, y: 2.86, w: 12.63, h: 0.22,
      fontSize: 10, color: "6B7280", align: "center", fontFace: "Segoe UI"
    });

    const bW3 = 12.63, bH3 = 0.26, bX3 = 0.35, bY3 = 3.12;
    const pctRec3 = Math.min(1, pctRec / 100);

    sl.addShape(pptx.ShapeType.rect, { x: bX3, y: bY3, w: bW3, h: bH3, fill: { color: "D1D5DB" }, line: { width: 0 } });
    sl.addShape(pptx.ShapeType.rect, { x: bX3, y: bY3, w: Math.max(0.05, bW3 * pctRec3), h: bH3, fill: { color: "16A34A" }, line: { width: 0 } });

    sl.addText(`${Math.round(pctRec)}% Recebidas (${fmtBRL(nfRecV)})`, {
      x: bX3, y: bY3 + 0.3, w: 5, h: 0.18,
      fontSize: 8, bold: true, color: "16A34A", fontFace: "Segoe UI"
    });
    sl.addText(`${Math.round(100 - pctRec)}% Pendentes (${fmtBRL(nfPend)})`, {
      x: bX3 + 7.63, y: bY3 + 0.3, w: 5, h: 0.18,
      fontSize: 8, color: "6B7280", fontFace: "Segoe UI", align: "right"
    });

    // ── Tabela por Seção ────────────────────────────────────────────────────
    const th = (txt, align = "left") => ({
      text: txt,
      options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "111827" }, align }
    });

    const tblBody = rows.map((r, i) => {
      const fill = { color: i % 2 === 0 ? "FFFFFF" : "F9FAFB" };
      const sc   = r.saldo >= 0 ? "16A34A" : "DC2626";
      // Coluna REALIZADO = base do saldo: Outros Mensais usa gasto (prov=0),
      // demais seções usam provisionado mensal.
      const realizadoVal = r.secao === "Outros Mensais" ? r.gasto : r.prov;
      return [
        { text: r.secao,                options: { fontSize: 9, bold: true, color: "374151", fill } },
        { text: fmtBRL(r.orc),          options: { fontSize: 9, color: "374151", fill, align: "right" } },
        { text: fmtBRL(realizadoVal),   options: { fontSize: 9, color: "374151", fill, align: "right" } },
        { text: fmtBRL(r.saldo),        options: { fontSize: 9, bold: true, color: sc, fill, align: "right" } },
      ];
    });

    const stcTot  = saldoTotal >= 0 ? "A3E635" : "FF6B6B";
    const totFill = { color: "111827" };
    const realizadoTot = rows.reduce((s, r) => s + (r.secao === "Outros Mensais" ? r.gasto : r.prov), 0);
    const tblTot  = [
      { text: "TOTAL",                 options: { fontSize: 9, bold: true, color: "FFFFFF", fill: totFill } },
      { text: fmtBRL(orcTotal),        options: { fontSize: 9, bold: true, color: "FFFFFF", fill: totFill, align: "right" } },
      { text: fmtBRL(realizadoTot),    options: { fontSize: 9, bold: true, color: "FFFFFF", fill: totFill, align: "right" } },
      { text: fmtBRL(saldoTotal),      options: { fontSize: 9, bold: true, color: stcTot, fill: totFill, align: "right" } },
    ];

    const rowH = Math.max(0.26, 3.5 / (rows.length + 2));
    sl.addTable(
      [
        [th("SEÇÃO"), th("ORÇADO ACUM.", "right"), th("REALIZADO", "right"), th("SALDO", "right")],
        ...tblBody,
        tblTot,
      ],
      {
        x: 0.35, y: 3.55, w: 12.63,
        colW: [5.8, 2.4, 2.4, 2.03],
        border: { type: "solid", color: "E5E7EB", pt: 0.5 },
        rowH,
      }
    );

    // ── Rodapé ──────────────────────────────────────────────────────────────
    sl.addText("Acompanhamento Orçamentário – Brasileirão 2026", {
      x: 0.35, y: 7.28, w: 12.63, h: 0.16,
      fontSize: 7.5, color: "9CA3AF", align: "center", fontFace: "Segoe UI"
    });

    await pptx.writeFile({ fileName: `custos_fixos_${mesLabel.toLowerCase()}_brasileirao2026.pptx` });
    setStatus({ msg: `✅ custos_fixos_${mesLabel.toLowerCase()}.pptx baixado!`, cls: "ok" });
  } catch (e) {
    setStatus({ msg: "❌ Erro: " + e.message, cls: "err" });
    console.error(e);
  }
  setLoading(false);
}

return (
<div style={{paddingBottom:80}}>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
<div style={{display:"flex",alignItems:"center",gap:14}}>
<Button T={T} variant="secondary" size="md" icon={ArrowLeft} onClick={onBack}>Voltar</Button>
<div style={{display:"flex",alignItems:"center",gap:12}}>
<div style={{width:40,height:40,borderRadius:12,background:T.info+"1f",border:`1px solid ${T.info}3a`,color:T.info,display:"flex",alignItems:"center",justifyContent:"center"}}>
<Lock size={18} strokeWidth={2.25}/>
</div>
<div>
<h2 style={{margin:0,fontSize:18,color:T.text,fontWeight:800,letterSpacing:"-0.02em"}}>Custos Fixos</h2>
<p style={{margin:"2px 0 0",fontSize:12,color:T.textMd}}>Lineares ÷ 12 · Pontuais integrais · Acompanhamento acumulado mensal</p>
</div>
</div>
</div>
<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
<p style={{fontSize:10,color:T.textSm,fontWeight:700,letterSpacing:1,textTransform:"uppercase",margin:"0 0 2px"}}>Orçado Total Campeonato</p>
<p style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>{fmtR(computed.orcAnualTotal)}</p>
</div>
</div>

  <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
    <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>01</span><span style={secHdr}>Configuração Base</span></div>
    <div style={grid3}>
      <div style={{marginBottom:16}}>
        <label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Mês de Referência *</label>
        <select value={mesAtual} onChange={e=>setMesAtual(parseInt(e.target.value))} style={{...IS}}>
          {MESES_FIX.map((m,i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Orçado Acumulado até {MESES_FIX[mesAtual]} <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO</span></label>
        <input readOnly value={orcTotalFmt} style={{...IS_RO}} title={`Anual: ${fmtR(computed.orcAnualTotal)} — lineares ÷ 12 × ${mesesDecorridos}; pontuais integrais`}/>
        <p style={{fontSize:10,color:T.textSm,margin:"4px 0 0"}}>Anual: {fmtR(computed.orcAnualTotal)} · lineares ÷ 12 × {mesesDecorridos} {mesesDecorridos===1?"mês":"meses"} · pontuais integrais</p>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Realizado Acumulado até {MESES_FIX[mesAtual]} <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO</span></label>
        <input readOnly value={fmtNum(provTotal)} style={{...IS_RO,color:"#3b82f6"}} title={`Anual: ${fmtR(computed.provTotalAnualAll)} — lineares ÷ 12 × ${mesesDecorridos}; pontuais integrais`}/>
        <p style={{fontSize:10,color:T.textSm,margin:"4px 0 0"}}>Anual: {fmtR(computed.provTotalAnualAll)} · lineares ÷ 12 × {mesesDecorridos} {mesesDecorridos===1?"mês":"meses"} · pontuais integrais</p>
      </div>
    </div>
    <div style={grid3}>
      <div style={{marginBottom:0}}>
        <label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Gasto Acumulado até {MESES_FIX[mesAtual]} <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO</span></label>
        <input readOnly value={fmtNum(gastoTotal)} style={{...IS_RO,color:"#22c55e"}}/>
      </div>
      <div style={{marginBottom:0}}>
        <label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Saldo até {MESES_FIX[mesAtual]} (Orçado − Realizado) <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO</span></label>
        <input readOnly value={fmtNum(saldoTotal)} style={{...IS_RO, color: saldoTotal >= 0 ? "#a3e635" : "#ef4444"}}/>
        <p style={{fontSize:10,color:T.textSm,margin:"4px 0 0"}}>{fmtR(orcTotal)} (orç.) − {fmtR(provTotal)} (real.) = {saldoTotal >= 0 ? "▲" : "▼"} {fmtR(Math.abs(saldoTotal))}</p>
      </div>
    </div>
  </div>

  <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
    <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8,marginBottom:18}}>
      <div style={{display:"flex",alignItems:"baseline",gap:8}}><span style={secNum}>02</span><span style={secHdr}>Dados por Seção</span></div>
      <button onClick={resetOverrides} style={{...btnStyle,background:T.border,color:T.text,padding:"5px 12px",fontSize:11}}>🔄 Re-sincronizar com portal</button>
    </div>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
        <thead><tr style={{background:T.bg}}>
          {["Seção","Orçado Acum. (R$)","Gasto (R$)","Realizado (R$)","Saldo (R$)"].map((h,i) => (
            <th key={h} style={{padding:"10px 12px",textAlign:i===0?"left":"right",color:T.textSm,fontSize:11,borderBottom:`1px solid ${T.border}`}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {sectionsView.map((s, i) => {
            const orcVal   = parseBR(s.orc);
            const provVal  = parseBR(s.prov);
            const sav      = orcVal - provVal;
            const debug    = computed.sections.find(x => x.secao === s.secao)?.itensDebug || [];
            const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
            const expanded = !!expandedSecs[s.secao];
            return (
              <Fragment key={s.secao}>
              <tr style={{borderBottom:`1px solid ${T.border}`}}>
                <td style={{padding:"6px 12px",fontWeight:700,color:"#3b82f6",fontSize:13}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {debug.length > 0 && (
                      <button onClick={()=>toggleSec(s.secao)} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:T.textSm,display:"flex",alignItems:"center"}}>
                        {expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      </button>
                    )}
                    {s.secao}
                  </div>
                </td>
                <td style={{padding:"4px 12px",textAlign:"right"}}>
                  <input value={s.orc} onChange={e=>setSecField(s.secao,"orc",e.target.value)}
                    style={{...iSty(T),width:130,textAlign:"right",padding:"4px 8px"}}/>
                </td>
                <td style={{padding:"4px 12px",textAlign:"right"}}>
                  <input value={s.gasto} onChange={e=>setSecField(s.secao,"gasto",e.target.value)}
                    style={{...iSty(T),width:130,textAlign:"right",padding:"4px 8px",color:"#22c55e"}}/>
                </td>
                <td style={{padding:"4px 12px",textAlign:"right"}}>
                  <input value={s.prov} onChange={e=>setSecField(s.secao,"prov",e.target.value)}
                    style={{...iSty(T),width:130,textAlign:"right",padding:"4px 8px",color:"#3b82f6"}}/>
                </td>
                <td style={{padding:"6px 12px",textAlign:"right",fontWeight:700,color:sav>=0?"#a3e635":"#ef4444"}}>{sav>=0?"▲ ":"▼ "}{fmtR(Math.abs(sav))}</td>
              </tr>
              {debug.length > 0 && expanded && (
                <tr style={{background:T.bg}}>
                  <td colSpan={5} style={{padding:"6px 12px 10px 24px"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr>
                        {["Item","Tipo","Prov. Anual","Meses Aloc.","Ratio/Fator","Contribui"].map((h,i)=>(
                          <th key={h} style={{padding:"3px 8px",textAlign:i===0?"left":"right",color:T.textSm,borderBottom:`1px solid ${T.border}`}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {debug.map(it => (
                          <tr key={it.nome}>
                            <td style={{padding:"3px 8px",color:T.textMd}}>{it.nome}</td>
                            <td style={{padding:"3px 8px",textAlign:"right",color:it.tipo==="pontual"?"#d97706":it.tipo==="linear"?T.textSm:"#7c3aed"}}>{it.tipo}</td>
                            <td style={{padding:"3px 8px",textAlign:"right",color:T.text}}>{fmtBRL(it.prov)}</td>
                            <td style={{padding:"3px 8px",textAlign:"right",color:T.textSm}}>{it.mesesAlocacao?.length ? it.mesesAlocacao.map(m => MESES_SHORT[m] ?? m).join(", ") : "—"}</td>
                            <td style={{padding:"3px 8px",textAlign:"right",color:T.textSm}}>{it.ratio !== null ? `${(it.ratio*100).toFixed(0)}%` : `÷12×${mesesDecorridos}`}</td>
                            <td style={{padding:"3px 8px",textAlign:"right",fontWeight:700,color:"#3b82f6"}}>{fmtBRL(it.contribui)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
          {sectionsView.length === 0 && (
            <tr><td colSpan={5} style={{padding:24,textAlign:"center",color:T.textSm,fontSize:12}}>Nenhuma seção no portal</td></tr>
          )}
        </tbody>
        <tfoot><tr style={{background:T.bg}}>
          <td style={{padding:"10px 12px",fontSize:11,color:T.textSm,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Total</td>
          <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:T.text}}>{fmtR(orcTotal)}</td>
          <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:T.text}}>{fmtR(gastoTotal)}</td>
          <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:"#3b82f6"}}>{fmtR(provTotal)}</td>
          <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:saldoTotal>=0?"#a3e635":"#ef4444"}}>{saldoTotal>=0?"▲ ":"▼ "}{fmtR(Math.abs(saldoTotal))}</td>
        </tr></tfoot>
      </table>
    </div>
  </div>

  <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
    <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:4}}><span style={secNum}>03</span><span style={secHdr}>Notas Fiscais vs Realizado Total</span></div>
    <p style={{fontSize:12,color:T.textMd,marginBottom:18}}>Realizado total: <b style={{color:"#3b82f6"}}>{fmtRs(provTotalAnual)}</b> · NFs recebidas: <b style={{color:"#22c55e"}}>{fmtRs(nfRecV)}</b> · Pendente: <b style={{color:"#d97706"}}>{fmtRs(nfPend)}</b></p>
    <div style={{display:"flex",gap:32,alignItems:"flex-start",flexWrap:"wrap"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
        <div style={{position:"relative",width:110,height:110}}>
          <canvas ref={canvasRef} width={110} height={110}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:15,fontWeight:700,color:T.text}}>{Math.round(pctRec)}%</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          <span style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:T.textMd}}><span style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/> Recebidas · <b style={{color:T.text}}>{fmtRs(nfRecV)}</b></span>
          <span style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:T.textMd}}><span style={{width:8,height:8,borderRadius:"50%",background:"#d97706",flexShrink:0}}/> Pendentes · <b style={{color:T.text}}>{fmtRs(nfPend)}</b></span>
        </div>
      </div>
      <div style={{display:"flex",gap:28,flexWrap:"wrap",flex:1}}>
        {[
          {label:"% Recebidas",     val:`${pctRec.toFixed(1)}%`,                               sub:fmtRs(nfRecV),                               color:"#22c55e"},
          {label:"% Pendentes",     val:`${(100-pctRec).toFixed(1)}%`,                         sub:fmtRs(nfPend),                               color:"#d97706"},
        ].map(m=>(
          <div key={m.label}>
            <p style={{fontSize:10,color:T.textSm,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{m.label}</p>
            <p style={{fontSize:22,fontWeight:300,color:m.color,marginBottom:2}}>{m.val}</p>
            <p style={{fontSize:10,color:T.textSm}}>{m.sub}</p>
          </div>
        ))}
      </div>
    </div>
  </div>

  <div style={{position:"sticky",bottom:0,background:T.surface||T.card,borderTop:`1px solid ${T.border}`,padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:50,boxShadow:"0 -8px 24px -8px rgba(0,0,0,0.3)"}}>
    <div>
      <p style={{fontSize:12,color:T.textMd,marginBottom:2}}><b style={{color:T.text,fontWeight:700}}>Tudo certo?</b> Clique para gerar o PPTX.</p>
      <p style={{fontSize:11,color:status.cls==="ok"?T.brand:status.cls==="err"?T.danger:T.textSm,fontWeight:600}}>{status.msg}</p>
    </div>
    <Button T={T} variant="primary" size="lg" icon={FileDown} onClick={gerarPPTX} disabled={loading}>
      {loading ? "Gerando..." : "Gerar PPTX"}
    </Button>
  </div>
</div>

);
}


// ─── FORM VISÃO GERAL ─────────────────────────────────────────────────────────
const ORC_TOTAL_VAR_CAMPEONATO = 10130480; // fixo — orçado total variáveis

function FormVisaoGeral({ T, onBack, dadosVar, dadosFix }) {
  const [status,  setStatus]  = useState({ msg: "Pronto para gerar", cls: "" });
  const [loading, setLoading] = useState(false);

  const secHdr = { fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: T.text, marginBottom: 12 };
  const secNum = { fontSize: 10, color: T.textSm, fontWeight: 700, marginRight: 8 };

  // Valores consolidados dos dois slides
  const varOrc       = dadosVar?.orcAteRod      ?? 0;
  const varReal      = dadosVar?.realizado       ?? 0;
  const varSaving    = dadosVar?.saving          ?? 0;
  const rodadaAtual  = dadosVar?.rodadaAtual     ?? "—";
  const fixOrcAcum   = dadosFix?.orcAcumulado    ?? 0;
  const fixGasto     = dadosFix?.provAcumulado   ?? 0; // "Realizado" na VG = provisionado (alinhado com Custos Fixos)
  const fixSaldo     = dadosFix?.saldo           ?? 0;
  const fixOrcAnual  = dadosFix?.orcAnualTotal   ?? 0;
  const mesLabel     = dadosFix?.mesLabel        ?? "—";

  const orcTotalCampeonato = ORC_TOTAL_VAR_CAMPEONATO + fixOrcAnual;
  const realTotalGlobal    = varReal + fixGasto;
  const orcTotalPeriodo    = varOrc + fixOrcAcum;
  const savingGlobal       = orcTotalPeriodo - realTotalGlobal;
  const savingGlobalPct    = orcTotalPeriodo > 0 ? savingGlobal / orcTotalPeriodo * 100 : 0;

  const dadosOk = dadosVar && dadosFix;

  async function gerarPPTX() {
    if (!dadosOk) {
      setStatus({ msg: "⚠️ Abra e configure os slides de Variáveis e Fixos antes de gerar.", cls: "err" });
      return;
    }
    setLoading(true); setStatus({ msg: "Gerando…", cls: "" });
    try {
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      const sl = pptx.addSlide();
      sl.background = { color: "FFFFFF" };

      // ── Barra verde topo ──────────────────────────────────────────────────
      sl.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 13.33, h: 0.06,
        fill: { color: "166534" }, line: { width: 0 }
      });

      // ── Título ────────────────────────────────────────────────────────────
      sl.addText("Visão Geral Orçamentária", {
        x: 0.35, y: 0.12, w: 12.6, h: 0.5,
        fontSize: 28, bold: true, color: "111827", fontFace: "Segoe UI"
      });
      sl.addShape(pptx.ShapeType.line, {
        x: 0.35, y: 0.72, w: 12.63, h: 0,
        line: { color: "E5E7EB", width: 1 }
      });

      // ── 3 KPI Cards ───────────────────────────────────────────────────────
      const kW = 4.14, kH = 1.1, kY = 0.85, kGap = 0.105;
      const kpis = [
        {
          label: "ORÇAMENTO TOTAL DO CAMPEONATO",
          val: fmtBRL(orcTotalCampeonato),
          valColor: "9CA3AF",
          accent: false,
        },
        {
          label: "REALIZADO (ATUAL)",
          val: fmtBRL(realTotalGlobal),
          valColor: "111827",
          accent: false,
        },
        {
          label: "SAVING / SALDO GLOBAL",
          val: (savingGlobal >= 0 ? "▲ " : "▼ ") + fmtBRL(Math.abs(savingGlobal)),
          valColor: savingGlobal >= 0 ? "16A34A" : "DC2626",
          accent: true,
          bold: true,
        },
      ];

      kpis.forEach(({ label, val, valColor, accent, bold }, i) => {
        const x = 0.35 + i * (kW + kGap);
        sl.addShape(pptx.ShapeType.rect, {
          x, y: kY, w: kW, h: kH,
          fill: { color: "F3F4F6" }, line: { color: "E5E7EB", width: 0.75 }
        });
        if (accent) {
          sl.addShape(pptx.ShapeType.rect, {
            x, y: kY, w: 0.06, h: kH,
            fill: { color: savingGlobal >= 0 ? "16A34A" : "DC2626" }, line: { width: 0 }
          });
        }
        sl.addText(label, {
          x: x + 0.18, y: kY + 0.12, w: kW - 0.28, h: 0.2,
          fontSize: 7.5, bold: true, color: "6B7280", charSpacing: 1.5, fontFace: "Segoe UI"
        });
        sl.addText(val, {
          x: x + 0.18, y: kY + 0.38, w: kW - 0.28, h: 0.58,
          fontSize: bold ? 26 : 22, bold: !!bold, color: valColor, fontFace: "Segoe UI"
        });
      });

      // ── Síntese dos Pilares ───────────────────────────────────────────────
      sl.addText("Síntese dos Pilares", {
        x: 0.35, y: 2.1, w: 12.63, h: 0.26,
        fontSize: 12, color: "374151", align: "center", fontFace: "Segoe UI"
      });

      const pY = 2.44, pH = 1.32;

      // Pilar Esquerdo — Variáveis
      sl.addShape(pptx.ShapeType.rect, {
        x: 0.35, y: pY, w: 5.9, h: pH,
        fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 0.75 }
      });
      sl.addText("Dinâmica Operacional (Custos Variáveis)", {
        x: 0.55, y: pY + 0.1, w: 5.5, h: 0.24,
        fontSize: 11, bold: true, color: "111827", align: "center", fontFace: "Segoe UI"
      });
      sl.addText(`Orçamento do Período: ${fmtBRL(varOrc)}`, {
        x: 0.55, y: pY + 0.38, w: 5.5, h: 0.2,
        fontSize: 10, color: "6B7280", align: "center", fontFace: "Segoe UI"
      });
      sl.addText(`Realizado: ${fmtBRL(varReal)}`, {
        x: 0.55, y: pY + 0.6, w: 5.5, h: 0.2,
        fontSize: 10, color: "6B7280", align: "center", fontFace: "Segoe UI"
      });
      sl.addText(`Saldo: ${fmtBRL(varSaving)}`, {
        x: 0.55, y: pY + 0.84, w: 5.5, h: 0.26,
        fontSize: 12, bold: true,
        color: varSaving >= 0 ? "16A34A" : "DC2626",
        align: "center", fontFace: "Segoe UI"
      });

      // Linha divisória vertical
      sl.addShape(pptx.ShapeType.line, {
        x: 6.665, y: pY + 0.08, w: 0, h: pH - 0.16,
        line: { color: "E5E7EB", width: 1 }
      });

      // Pilar Direito — Fixos
      sl.addShape(pptx.ShapeType.rect, {
        x: 6.78, y: pY, w: 5.9, h: pH,
        fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 0.75 }
      });
      sl.addText("Estrutura Acumulada (Custos Fixos)", {
        x: 6.98, y: pY + 0.1, w: 5.5, h: 0.24,
        fontSize: 11, bold: true, color: "111827", align: "center", fontFace: "Segoe UI"
      });
      sl.addText(`Orçado até ${mesLabel}: ${fmtBRL(fixOrcAcum)}`, {
        x: 6.98, y: pY + 0.38, w: 5.5, h: 0.2,
        fontSize: 10, color: "6B7280", align: "center", fontFace: "Segoe UI"
      });
      sl.addText(`Realizado até ${mesLabel}: ${fmtBRL(fixGasto)}`, {
        x: 6.98, y: pY + 0.6, w: 5.5, h: 0.2,
        fontSize: 10, color: "6B7280", align: "center", fontFace: "Segoe UI"
      });
      sl.addText(`Saldo até ${mesLabel}: ${fmtBRL(fixSaldo)}`, {
        x: 6.98, y: pY + 0.84, w: 5.5, h: 0.26,
        fontSize: 12, bold: true,
        color: fixSaldo >= 0 ? "16A34A" : "DC2626",
        align: "center", fontFace: "Segoe UI"
      });

      // ── Tabela de Blocos ──────────────────────────────────────────────────
      const th = (txt, align = "left") => ({
        text: txt,
        options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "111827" }, align }
      });

      const mkRow = (label, orc, real, sav, pct, idx) => {
        const fill = { color: idx % 2 === 0 ? "FFFFFF" : "F9FAFB" };
        const sc   = sav >= 0 ? "16A34A" : "DC2626";
        const icon = sav >= 0 ? "▲ " : "▼ ";
        return [
          { text: label,                                       options: { fontSize: 9, color: "374151", fill } },
          { text: fmtBRL(orc),                                options: { fontSize: 9, color: "374151", fill, align: "right" } },
          { text: fmtBRL(real),                               options: { fontSize: 9, color: "374151", fill, align: "right" } },
          { text: icon + fmtBRL(Math.abs(sav)),               options: { fontSize: 9, bold: true, color: sc, fill, align: "right" } },
          { text: icon + Math.abs(pct).toFixed(1) + "%",      options: { fontSize: 9, bold: true, color: sc, fill, align: "right" } },
        ];
      };

      const savVarPct = varOrc > 0 ? varSaving / varOrc * 100 : 0;
      const savFixPct = fixOrcAcum > 0 ? fixSaldo / fixOrcAcum * 100 : 0;
      const fillTot   = { color: "F3F4F6" };
      const scTot     = savingGlobal >= 0 ? "16A34A" : "DC2626";
      const iconTot   = savingGlobal >= 0 ? "▲ " : "▼ ";

      const tblTot = [
        { text: "TOTAL",                                         options: { fontSize: 9, bold: true, color: "111827", fill: fillTot } },
        { text: fmtBRL(orcTotalPeriodo),                        options: { fontSize: 9, bold: true, color: "111827", fill: fillTot, align: "right" } },
        { text: fmtBRL(realTotalGlobal),                        options: { fontSize: 9, bold: true, color: "111827", fill: fillTot, align: "right" } },
        { text: iconTot + fmtBRL(Math.abs(savingGlobal)),       options: { fontSize: 9, bold: true, color: scTot, fill: fillTot, align: "right" } },
        { text: iconTot + Math.abs(savingGlobalPct).toFixed(1) + "%", options: { fontSize: 9, bold: true, color: scTot, fill: fillTot, align: "right" } },
      ];

      sl.addTable([
        [th("BLOCO"), th("ORÇADO (Período)", "right"), th("REALIZADO", "right"), th("SAVING / SALDO (R$)", "right"), th("%", "right")],
        mkRow(`1  Serviços Variáveis (R1–R${rodadaAtual})`, varOrc,    varReal,  varSaving, savVarPct, 0),
        mkRow(`2  Custos Fixos (até ${mesLabel})`,           fixOrcAcum, fixGasto, fixSaldo,  savFixPct, 1),
        tblTot,
      ], {
        x: 0.35, y: 3.9, w: 12.63,
        colW: [4.6, 2.4, 2.4, 2.4, 0.83],
        border: { type: "solid", color: "E5E7EB", pt: 0.5 },
        rowH: 0.42,
      });

      // ── Rodapé ────────────────────────────────────────────────────────────
      sl.addText("Acompanhamento Orçamentário – Brasileirão 2026", {
        x: 0.35, y: 7.28, w: 12.63, h: 0.16,
        fontSize: 7.5, color: "9CA3AF", align: "center", fontFace: "Segoe UI"
      });

      await pptx.writeFile({ fileName: `visao_geral_brasileirao2026.pptx` });
      setStatus({ msg: "✅ visao_geral_brasileirao2026.pptx baixado!", cls: "ok" });
    } catch (e) {
      setStatus({ msg: "❌ Erro: " + e.message, cls: "err" });
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <Button T={T} variant="secondary" size="md" icon={ArrowLeft} onClick={onBack}>Voltar</Button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.28)", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LayoutGrid size={18} strokeWidth={2.25} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: T.text, fontWeight: 800, letterSpacing: "-0.02em" }}>Visão Geral Orçamentária</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMd }}>Consolida os dados de Variáveis + Fixos em 1 slide</p>
          </div>
        </div>
      </div>

      {/* ── Aviso se dados ausentes ─────────────────────────────────────────── */}
      {!dadosOk && (
        <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: "14px 20px", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "#92400e", fontWeight: 700, margin: "0 0 4px" }}>⚠️ Dados incompletos</p>
          <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
            Para gerar a Visão Geral, primeiro abra e configure os slides de{" "}
            {!dadosVar && <b>Custos Variáveis</b>}
            {!dadosVar && !dadosFix && " e "}
            {!dadosFix && <b>Custos Fixos</b>}.
            Os dados são sincronizados automaticamente ao abrir cada formulário.
          </p>
        </div>
      )}

      {/* ── Preview dos valores consolidados ────────────────────────────────── */}
      {dadosOk && (
        <div style={{ background: T.card, borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
            <span style={secNum}>01</span><span style={secHdr}>Resumo Consolidado</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Orçamento Total Campeonato", val: fmtR(orcTotalCampeonato), color: T.textMd },
              { label: "Realizado Total",            val: fmtR(realTotalGlobal),    color: T.text },
              { label: "Saving / Saldo Global",      val: (savingGlobal >= 0 ? "▲ " : "▼ ") + fmtR(Math.abs(savingGlobal)), color: savingGlobal >= 0 ? "#16a34a" : "#dc2626" },
            ].map(m => (
              <div key={m.label} style={{ background: T.bg, borderRadius: 8, padding: "12px 16px", border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 10, color: T.textSm, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: m.color, margin: 0 }}>{m.val}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: T.bg, borderRadius: 8, padding: "12px 16px", border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.textSm, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Variáveis — até R{rodadaAtual}</p>
              <p style={{ fontSize: 12, color: T.textMd, margin: "0 0 2px" }}>Orçado: <b style={{ color: T.text }}>{fmtR(varOrc)}</b></p>
              <p style={{ fontSize: 12, color: T.textMd, margin: "0 0 2px" }}>Realizado: <b style={{ color: T.text }}>{fmtR(varReal)}</b></p>
              <p style={{ fontSize: 13, fontWeight: 700, color: varSaving >= 0 ? "#16a34a" : "#dc2626", margin: "4px 0 0" }}>
                Saldo: {varSaving >= 0 ? "▲ " : "▼ "}{fmtR(Math.abs(varSaving))}
              </p>
            </div>
            <div style={{ background: T.bg, borderRadius: 8, padding: "12px 16px", border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.textSm, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Fixos — até {mesLabel}</p>
              <p style={{ fontSize: 12, color: T.textMd, margin: "0 0 2px" }}>Orçado: <b style={{ color: T.text }}>{fmtR(fixOrcAcum)}</b></p>
              <p style={{ fontSize: 12, color: T.textMd, margin: "0 0 2px" }}>Realizado: <b style={{ color: T.text }}>{fmtR(fixGasto)}</b></p>
              <p style={{ fontSize: 13, fontWeight: 700, color: fixSaldo >= 0 ? "#16a34a" : "#dc2626", margin: "4px 0 0" }}>
                Saldo: {fixSaldo >= 0 ? "▲ " : "▼ "}{fmtR(Math.abs(fixSaldo))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Rodapé fixo ─────────────────────────────────────────────────────── */}
      <div style={{ position: "sticky", bottom: 0, background: T.surface || T.card, borderTop: `1px solid ${T.border}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 50, boxShadow: "0 -8px 24px -8px rgba(0,0,0,0.3)" }}>
        <div>
          <p style={{ fontSize: 12, color: T.textMd, marginBottom: 2 }}>
            <b style={{ color: T.text, fontWeight: 700 }}>
              {dadosOk ? "Tudo pronto! " : "Aguardando dados dos outros slides. "}
            </b>
            {dadosOk ? "Clique para gerar o PPTX da Visão Geral." : "Abra Variáveis e Fixos primeiro."}
          </p>
          <p style={{ fontSize: 11, color: status.cls === "ok" ? "#16a34a" : status.cls === "err" ? "#dc2626" : T.textSm, fontWeight: 600 }}>
            {status.msg}
          </p>
        </div>
        <Button T={T} variant="primary" size="lg" icon={FileDown} onClick={gerarPPTX} disabled={loading || !dadosOk}>
          {loading ? "Gerando..." : "Gerar PPTX"}
        </Button>
      </div>
    </div>
  );
}

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────
const MESES_DEFAULT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const VAR_CATS_FIX_DEFAULT = new Set(["Transporte","Uber","Hospedagem","Seg. Espacial"]);

export default function TabApresentacoes({T, jogos = [], servicos = [], notasMensais = []}) {
  const [tipo, setTipo] = useState(null);
  const [dadosVar, setDadosVar] = usePersistedState("apres_var_dados", null);
  const [dadosFix, setDadosFix] = usePersistedState("apres_fix_dados", null);

  // Lê rodada/mês/overrides persistidos pelos formulários — assim, mesmo sem
  // abrir Variáveis/Fixos nesta sessão, a Visão Geral reflete a última config.
  const readPersisted = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw !== null ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  };

  // Defaults calculados direto dos dados do portal + preferências persistidas.
  const defaultDadosVar = useMemo(() => {
    const rodadasDisp     = Array.from(new Set(jogos.map(j => j.rodada))).sort((a,b) => a-b);
    const ultima          = rodadasDisp[rodadasDisp.length-1] || 1;
    const rodadaPersist   = readPersisted("apres_var_rodada", ultima);
    const rodadaAtual     = rodadasDisp.includes(rodadaPersist) ? rodadaPersist : ultima;
    const ovr             = readPersisted("apres_var_overrides", {}) || {};
    const nfEspOverride   = readPersisted("apres_var_nfEsp", "");
    const nfRecOverride   = readPersisted("apres_var_nfRec", "");
    const rowsAuto        = rodadasDisp.filter(r => r <= rodadaAtual).map(r => {
      const jr = jogos.filter(j => j.rodada === r);
      return {
        rodada: r,
        label:  `R${r}`,
        orcadoAuto:    jr.reduce((s, j) => s + subTotal(j.orcado || {}), 0),
        realizadoAuto: jr.reduce((s, j) => s + subTotal(j.provisionado || {}), 0),
      };
    });
    const rows = rowsAuto.map(r => ({
      label:     r.label,
      orcado:    ovr[r.rodada]?.orcado    != null ? parseBR(ovr[r.rodada].orcado)    : r.orcadoAuto,
      realizado: ovr[r.rodada]?.realizado != null ? parseBR(ovr[r.rodada].realizado) : r.realizadoAuto,
    }));
    const orcAteRod = rows.reduce((s, r) => s + r.orcado, 0);
    const realizado = rows.reduce((s, r) => s + r.realizado, 0);
    const saving    = orcAteRod - realizado;
    const savPct    = orcAteRod > 0 ? saving / orcAteRod * 100 : 0;
    const autoNfEsp = realizado;
    const autoNfRec = jogos.filter(j => j.rodada <= rodadaAtual).reduce((s, j) => s + subTotal(j.realizado || {}), 0);
    const nfEspV    = nfEspOverride !== "" ? parseBR(nfEspOverride) : autoNfEsp;
    const nfRecV    = nfRecOverride !== "" ? parseBR(nfRecOverride) : autoNfRec;
    const nfPend    = Math.max(0, nfEspV - nfRecV);
    const pctRec    = nfEspV > 0 ? nfRecV / nfEspV * 100 : 0;
    return {
      orcGlobal: ORC_GLOBAL_FIXO,
      orcAteRod, realizado, saving, savPct, rows,
      nfEspV, nfRecV, nfPend, pctRec, rodadaAtual,
    };
  }, [jogos]);

  const defaultDadosFix = useMemo(() => {
    const mesAtual        = readPersisted("apres_fix_mes", new Date().getMonth());
    const mesesDecorridos = mesAtual + 1;
    const ovr             = readPersisted("apres_fix_overrides", {}) || {};
    const sections = servicos.map(sec => {
      const idsItens  = sec.itens.map(it => it.id);
      const idsEncerrados = sec.itens.filter(it => it.status === "encerrado").map(it => it.id);
      const orcAnual  = sec.itens.reduce((s, it) => s + (it.orcado || 0), 0);
      const provAnual = sec.itens.reduce((s, it) => s + (it.provisionado || 0), 0);
      const provAnualAtivos = sec.itens
        .filter(it => it.status !== "encerrado")
        .reduce((s, it) => s + (it.provisionado || 0), 0);
      const pontualRatio = it => {
        const list = Array.isArray(it.mesesAlocacao) ? it.mesesAlocacao
          : (it.mesAlocacao != null ? [it.mesAlocacao] : []);
        if (!list.length) return mesAtual >= 0 ? 1 : 0;
        return list.filter(m => m <= mesAtual).length / list.length;
      };
      const orcAuto = sec.itens.reduce((s, it) => {
        const orc = it.orcado || 0;
        const tipo = it.tipo || "linear";
        if (tipo === "pontual") return s + orc * pontualRatio(it);
        if (tipo === "misto") {
          const pl = it.parcelaLinear || 0;
          const pp = it.parcelaPontual || 0;
          const tot = pl + pp;
          if (tot > 0) {
            const rL = pl / tot;
            return s + (orc * rL / 12) * mesesDecorridos + orc * (1 - rL) * pontualRatio(it);
          }
          return s + (orc / 12) * mesesDecorridos;
        }
        return s + (orc / 12) * mesesDecorridos;
      }, 0);
      const provAuto  = sec.itens.reduce((s, it) => {
        if (it.status === "encerrado") return s + (it.realAoEncerrar || 0);
        const prov = it.provisionado || 0;
        const tipo = it.tipo || "linear";
        if (tipo === "pontual") return s + prov * pontualRatio(it);
        if (tipo === "misto") {
          const pl = it.parcelaLinear || 0;
          const pp = it.parcelaPontual || 0;
          return s + (pl / 12) * mesesDecorridos + pp * pontualRatio(it);
        }
        return s + (prov / 12) * mesesDecorridos;
      }, 0);
      const gastoAuto = notasMensais
        .filter(n => n.servicoId && idsItens.includes(n.servicoId) && n.mes <= mesAtual)
        .reduce((s, n) => s + (n.valor || 0), 0);
      const gastoEncerrados = notasMensais
        .filter(n => n.servicoId && idsEncerrados.includes(n.servicoId) && n.mes <= mesAtual)
        .reduce((s, n) => s + (n.valor || 0), 0);
      const o = ovr[sec.secao] || {};
      const orc   = o.orc   != null ? parseBR(o.orc)   : orcAuto;
      const prov  = o.prov  != null ? parseBR(o.prov)  : provAuto;
      const gasto = o.gasto != null ? parseBR(o.gasto) : gastoAuto;
      const saldo = sec.secao === "Outros Mensais" ? orc - gasto : orc - prov;
      return { secao: sec.secao, orcAnual, provAnual, provAnualAtivos, gastoEncerrados, orc, prov, gasto, saldo };
    });
    const outrosGasto = notasMensais
      .filter(n => !n.servicoId && !VAR_CATS_FIX_DEFAULT.has(n.categoria) && n.mes <= mesAtual)
      .reduce((s, n) => s + (n.valor || 0), 0);
    if (outrosGasto > 0) {
      const o = ovr["Outros Mensais"] || {};
      const gasto = o.gasto != null ? parseBR(o.gasto) : outrosGasto;
      sections.push({ secao: "Outros Mensais", orcAnual: 0, provAnual: 0, orc: 0, prov: 0, gasto, saldo: 0 });
    }
    const orcAnualTotal  = sections.reduce((s, x) => s + x.orcAnual, 0);
    const provAnualTotal = sections.reduce((s, x) => s + x.provAnual, 0);
    const orcAcumulado   = sections.reduce((s, x) => s + x.orc, 0);
    // Realizado da Visão Geral: Outros Mensais usa gasto (prov=0); demais usam prov.
    const provAcumulado  = sections.reduce((s, x) => s + (x.secao === "Outros Mensais" ? x.gasto : x.prov), 0);
    const gastoAcumulado = sections.reduce((s, x) => s + x.gasto, 0);
    const saldo          = orcAcumulado - provAcumulado;
    // Pendente de NF exclui serviços encerrados
    const provAnualAtivosTotal = sections.reduce((s, x) => s + (x.provAnualAtivos ?? x.provAnual ?? 0), 0);
    const gastoEncerradosTot   = sections.reduce((s, x) => s + (x.gastoEncerrados || 0), 0);
    const gastoAtivo           = Math.max(0, gastoAcumulado - gastoEncerradosTot);
    const nfRecV         = gastoAtivo;
    const nfPend         = Math.max(0, provAnualAtivosTotal - gastoAtivo);
    const pctRec         = provAnualAtivosTotal > 0 ? nfRecV / provAnualAtivosTotal * 100 : 0;
    return {
      orcAnualTotal, orcAcumulado, gastoAcumulado, provAcumulado,
      saldo, provAnual: provAnualTotal,
      nfRecV, nfPend, pctRec, rows: sections,
      mesAtual, mesLabel: MESES_DEFAULT[mesAtual],
    };
  }, [servicos, notasMensais]);

  if (!tipo) return <SeletorTipo T={T} onSelect={setTipo}/>;

  if (tipo === "variaveis")
    return <FormVariaveis T={T} onBack={()=>setTipo(null)} jogos={jogos}
              onDadosCalculados={setDadosVar}/>;

  if (tipo === "fixos")
    return <FormFixos T={T} onBack={()=>setTipo(null)} servicos={servicos} notasMensais={notasMensais}
              onDadosCalculados={setDadosFix}/>;

  if (tipo === "visaogeral")
    return <FormVisaoGeral T={T} onBack={()=>setTipo(null)}
              dadosVar={defaultDadosVar}
              dadosFix={defaultDadosFix}/>;

  return null;
}
