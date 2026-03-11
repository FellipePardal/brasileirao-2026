import { useState, useMemo, useEffect, useRef } from "react";
import PptxGenJS from "pptxgenjs"; // ← FIX: import direto, sem depender de global
import { btnStyle, iSty, ORC_PADRAO, REAL_PADRAO } from "../../constants";
import { parseBR, fmtNum, fmtR, fmtRs } from "../../utils";
import { CATS_FIXOS_INIT } from "../../data";

// ─── PALETA COMPARTILHADA ─────────────────────────────────────────────────────
const C = {
  bg:"FFFFFF", bgLight:"F9FAFB", border:"E5E7EB", borderDark:"D1D5DB",
  verde:"166534", verdeAc:"22C55E", verdeL:"F0FDF4", verdeBd:"BBF7D0",
  azul:"1E40AF",  azulAc:"3B82F6",  azulL:"EFF6FF",  azulBd:"BFDBFE",
  ambar:"D97706", ambarL:"FFFBEB",
  cinza:"D1D5DB", dark:"111827",   sub:"9CA3AF",
};

const fmtBRL  = v => "R$ " + Number(v).toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtBRLk = v => "R$ " + Number(v).toLocaleString("pt-BR", {minimumFractionDigits:0, maximumFractionDigits:0});

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
  return (
    <div>
      <h2 style={{margin:"0 0 8px",fontSize:16,color:T.text,fontWeight:700}}>Gerar Apresentação PPTX</h2>
      <p style={{color:T.textMd,fontSize:13,marginBottom:28}}>Selecione o tipo de custo que deseja apresentar:</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:20}}>
        {[
          {key:"variaveis",icon:"📊",label:"Custos Variáveis",desc:"Acompanhamento por rodada — orçado × realizado, saving acumulado e notas fiscais.",color:"#22c55e",grad:"linear-gradient(135deg,#14532d,#166534)"},
          {key:"fixos",    icon:"🔒",label:"Custos Fixos",    desc:"Serviços fixos do campeonato — orçado × gasto × provisionado por categoria.",color:"#3b82f6",grad:"linear-gradient(135deg,#1e3a5f,#1e40af)"},
        ].map(opt => (
          <div key={opt.key} onClick={()=>onSelect(opt.key)}
            style={{background:T.card,borderRadius:18,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.18)",cursor:"pointer",border:`1px solid ${T.border}`}}
            onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"}
            onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
            <div style={{background:opt.grad,padding:"28px 24px 22px"}}>
              <span style={{fontSize:40}}>{opt.icon}</span>
              <h3 style={{margin:"10px 0 6px",fontSize:18,fontWeight:800,color:"#fff"}}>{opt.label}</h3>
            </div>
            <div style={{padding:"18px 24px"}}>
              <p style={{color:T.textMd,fontSize:13,margin:"0 0 18px",lineHeight:1.5}}>{opt.desc}</p>
              <button style={{...btnStyle,background:opt.color,width:"100%",padding:"11px",fontSize:14,borderRadius:10}}>Preencher formulário →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FORM VARIÁVEIS ───────────────────────────────────────────────────────────
function FormVariaveis({T, onBack}) {
  const [rodadaAtual, setRodadaAtual] = useState(4);
  const [orcGlobal,   setOrcGlobal]   = useState("11.540.692,00");
  const [orcAteRod,   setOrcAteRod]   = useState("1.050.317,00");
  const [macroOrc,    setMacroOrc]    = useState("11.540.692,00");
  const [macroReal,   setMacroReal]   = useState("712.240,00");
  const [macroProj,   setMacroProj]   = useState("10.980.000,00");
  const [nfEsp,       setNfEsp]       = useState("712.240,00");
  const [nfRec,       setNfRec]       = useState("623.410,00");
  const [status,      setStatus]      = useState({msg:"Pronto para gerar",cls:""});
  const [loading,     setLoading]     = useState(false);
  const canvasRef = useRef(null);

  const makeRodadas = n => Array.from({length:n}, (_,i) => ({label:`R${i+1}`, orcado:fmtNum(ORC_PADRAO[i]||0), realizado:fmtNum(REAL_PADRAO[i]||0)}));
  const [rodadas, setRodadas] = useState(makeRodadas(4));

  const setRodadaCount = n => {
    const num = Math.max(1, Math.min(38, parseInt(n)||1));
    setRodadaAtual(num);
    setRodadas(prev => Array.from({length:num}, (_,i) => prev[i]||{label:`R${i+1}`,orcado:"0,00",realizado:"0,00"}));
  };
  const setRodadaField = (i,field,val) => setRodadas(prev => prev.map((r,idx) => idx===i ? {...r,[field]:val} : r));

  const parsed = useMemo(() => {
    const rows      = rodadas.map(r => ({label:r.label, orcado:parseBR(r.orcado), realizado:parseBR(r.realizado)}));
    const totOrc    = rows.reduce((s,r) => s+r.orcado, 0);
    const totReal   = rows.reduce((s,r) => s+r.realizado, 0);
    const orcAteRodV = parseBR(orcAteRod);
    const saving    = orcAteRodV - totReal;
    const savPct    = orcAteRodV > 0 ? saving/orcAteRodV*100 : 0;
    const nfEspV    = parseBR(nfEsp), nfRecV = parseBR(nfRec);
    const nfPend    = Math.max(0, nfEspV - nfRecV);
    const pctRec    = nfEspV > 0 ? nfRecV/nfEspV*100 : 0;
    return {rows, totOrc, totReal, saving, savPct, nfPend, pctRec, nfEspV, nfRecV};
  }, [rodadas, orcAteRod, nfEsp, nfRec]);

  useDonut(canvasRef, parsed.nfRecV, parsed.nfPend);

  const IS     = {...iSty(T), width:"100%"};
  const grid3  = {display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20};
  const secHdr = {fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:T.text,marginBottom:16};
  const secNum = {fontSize:10,color:T.textSm,fontWeight:700,marginRight:8};
  const {rows, totOrc, totReal, saving, savPct, nfPend, pctRec, nfRecV, nfEspV} = parsed;

  // ── GERAR PPTX VARIÁVEIS ──────────────────────────────────────────────────
  async function gerarPPTX() {
    setLoading(true); setStatus({msg:"Gerando...", cls:""});
    try {
      const orcGlobalV  = parseBR(orcGlobal);
      const orcAteRodV  = parseBR(orcAteRod);
      const macroOrcV   = parseBR(macroOrc);
      const macroRealV  = parseBR(macroReal);
      const macroProjV  = parseBR(macroProj);
      const pctRecV     = nfEspV > 0 ? (nfRecV/nfEspV*100).toFixed(1) : "0.0";
      const pctPendV    = nfEspV > 0 ? (nfPend/nfEspV*100).toFixed(1) : "0.0";
      const savingSign  = saving >= 0 ? "▲" : "▼";

      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5"

      // ── SLIDE 1: VISÃO MACRO ──────────────────────────────────────────────
      const s1 = pptx.addSlide();
      s1.background = {color: C.bg};

      // barra superior verde
      s1.addShape(pptx.ShapeType.rect, {x:0,y:0,w:13.33,h:0.06,fill:{color:C.verdeAc},line:{width:0}});

      // título
      s1.addText("Acompanhamento Orçamentário – Brasileirão 2026", {
        x:0.3,y:0.12,w:12.7,h:0.4,fontSize:20,bold:true,color:C.dark,fontFace:"Segoe UI"
      });
      s1.addText(`Serviços Variáveis  ·  Rodada ${rodadaAtual} de 38`, {
        x:0.3,y:0.52,w:12.7,h:0.22,fontSize:10,color:C.sub,fontFace:"Segoe UI"
      });

      // separador
      s1.addShape(pptx.ShapeType.line, {x:0.3,y:0.82,w:12.73,h:0,line:{color:C.border,width:1}});

      // ── 3 KPIs macro ──
      const kpis = [
        {label:"ORÇADO TOTAL",      val:fmtBRL(macroOrcV),  color:C.cinza,   bg:C.bgLight},
        {label:"REALIZADO",         val:fmtBRL(macroRealV), color:C.verdeAc, bg:C.verdeL},
        {label:"PROJETADO FINAL",   val:fmtBRL(macroProjV), color:C.azulAc,  bg:C.azulL},
      ];
      kpis.forEach(({label,val,color,bg}, i) => {
        const x = 0.3 + i * 4.3;
        s1.addShape(pptx.ShapeType.rect, {x, y:0.96, w:4.1, h:1.6, fill:{color:bg}, line:{color:color,width:1.5}, rectRadius:0.08});
        s1.addText(label, {x:x+0.18,y:1.06,w:3.74,h:0.22,fontSize:8,bold:true,color:color,charSpacing:2,fontFace:"Segoe UI"});
        s1.addText(val,   {x:x+0.18,y:1.34,w:3.74,h:0.72,fontSize:22,bold:false,color:C.dark,fontFace:"Segoe UI"});
      });

      // ── saving / orçado campeonato ──
      s1.addShape(pptx.ShapeType.rect, {x:0.3,y:2.72,w:12.73,h:1.5,fill:{color:C.bgLight},line:{color:C.border,width:1},rectRadius:0.08});
      s1.addText("SAVING ACUMULADO", {x:0.5,y:2.86,w:6,h:0.22,fontSize:8,bold:true,color:C.sub,charSpacing:2,fontFace:"Segoe UI"});
      s1.addText(`${savingSign} ${fmtBRL(Math.abs(saving))}`, {
        x:0.5,y:3.1,w:5,h:0.72,fontSize:26,bold:false,
        color:saving>=0?C.verdeAc:"EF4444",fontFace:"Segoe UI"
      });
      s1.addText(`${Math.abs(savPct).toFixed(1)}% vs. orçado acumulado  ·  Orçado até R${rodadaAtual}: ${fmtBRL(orcAteRodV)}`, {
        x:0.5,y:3.84,w:8,h:0.22,fontSize:9,color:C.sub,fontFace:"Segoe UI"
      });
      s1.addText("ORÇADO CAMPEONATO", {x:7.3,y:2.86,w:5.5,h:0.22,fontSize:8,bold:true,color:C.sub,charSpacing:2,fontFace:"Segoe UI",align:"right"});
      s1.addText(fmtBRL(orcGlobalV), {x:7.3,y:3.1,w:5.5,h:0.5,fontSize:18,color:C.dark,fontFace:"Segoe UI",align:"right"});

      // ── SLIDE 2: TABELA POR RODADA ────────────────────────────────────────
      const s2 = pptx.addSlide();
      s2.background = {color: C.bg};
      s2.addShape(pptx.ShapeType.rect, {x:0,y:0,w:13.33,h:0.06,fill:{color:C.verdeAc},line:{width:0}});
      s2.addText("Acompanhamento por Rodada", {x:0.3,y:0.12,w:10,h:0.38,fontSize:18,bold:true,color:C.dark,fontFace:"Segoe UI"});
      s2.addText(`Rodada ${rodadaAtual}`, {x:10.3,y:0.12,w:2.73,h:0.38,fontSize:18,bold:true,color:C.verdeAc,fontFace:"Segoe UI",align:"right"});
      s2.addShape(pptx.ShapeType.line, {x:0.3,y:0.6,w:12.73,h:0,line:{color:C.border,width:1}});

      const tblHeader = [
        [{text:"Rodada",  options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.verde},align:"center"}}],
        [{text:"Orçado",  options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.verde},align:"right"}}],
        [{text:"Realizado",options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.verde},align:"right"}}],
        [{text:"Saving",  options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.verde},align:"right"}}],
      ];

      const tblRows = [
        tblHeader,
        ...rows.map((r, idx) => {
          const sav = r.orcado - r.realizado;
          const fillColor = idx%2===0 ? C.bg : C.bgLight;
          return [
            [{text:r.label,          options:{bold:true,fontSize:9,color:C.verdeAc,fill:{color:fillColor},align:"center"}}],
            [{text:fmtBRL(r.orcado), options:{fontSize:9,color:C.dark,fill:{color:fillColor},align:"right"}}],
            [{text:fmtBRL(r.realizado),options:{fontSize:9,color:C.dark,fill:{color:fillColor},align:"right"}}],
            [{text:(sav>=0?"▲ ":"▼ ")+fmtBRL(Math.abs(sav)),options:{fontSize:9,bold:true,color:sav>=0?"00B050":"FF0000",fill:{color:fillColor},align:"right"}}],
          ];
        }),
        // totais
        [
          [{text:"TOTAL", options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.dark},align:"center"}}],
          [{text:fmtBRL(totOrc),  options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.dark},align:"right"}}],
          [{text:fmtBRL(totReal), options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.dark},align:"right"}}],
          [{text:(saving>=0?"▲ ":"▼ ")+fmtBRL(Math.abs(saving)),options:{bold:true,fontSize:9,color:saving>=0?"A3E635":"FF0000",fill:{color:C.dark},align:"right"}}],
        ],
      ];

      s2.addTable(tblRows.map(r => r.map(c => c[0])), {
        x:0.3, y:0.75, w:12.73,
        colW:[1.5, 3.7, 3.7, 3.73],
        border:{type:"solid",color:C.border,pt:0.5},
        rowH:0.32,
      });

      // ── SLIDE 3: NOTAS FISCAIS ────────────────────────────────────────────
      const s3 = pptx.addSlide();
      s3.background = {color: C.bg};
      s3.addShape(pptx.ShapeType.rect, {x:0,y:0,w:13.33,h:0.06,fill:{color:C.verdeAc},line:{width:0}});
      s3.addText("Status de Notas Fiscais", {x:0.3,y:0.12,w:12.7,h:0.38,fontSize:18,bold:true,color:C.dark,fontFace:"Segoe UI"});
      s3.addShape(pptx.ShapeType.line, {x:0.3,y:0.6,w:12.73,h:0,line:{color:C.border,width:1}});

      const nfKpis = [
        {label:"ESPERADAS",  val:fmtBRL(nfEspV),  color:C.cinza,   bg:C.bgLight},
        {label:"RECEBIDAS",  val:fmtBRL(nfRecV),  color:C.verdeAc, bg:C.verdeL},
        {label:"PENDENTES",  val:fmtBRL(nfPend),  color:C.ambar,   bg:"FFFBEB"},
      ];
      nfKpis.forEach(({label,val,color,bg}, i) => {
        const x = 0.3 + i * 4.3;
        s3.addShape(pptx.ShapeType.rect, {x,y:0.78,w:4.1,h:1.4,fill:{color:bg},line:{color,width:1.5},rectRadius:0.08});
        s3.addText(label, {x:x+0.18,y:0.88,w:3.74,h:0.22,fontSize:8,bold:true,color,charSpacing:2,fontFace:"Segoe UI"});
        s3.addText(val,   {x:x+0.18,y:1.14,w:3.74,h:0.62,fontSize:20,color:C.dark,fontFace:"Segoe UI"});
      });

      // barra de progresso NF
      const barY = 2.4, barH = 0.38, barX = 0.3, barW = 12.73;
      const recW = nfEspV > 0 ? barW * (nfRecV/nfEspV) : 0;
      s3.addShape(pptx.ShapeType.rect, {x:barX,y:barY,w:barW,h:barH,fill:{color:C.ambar+"33"},line:{width:0},rectRadius:0.08});
      if (recW > 0)
        s3.addShape(pptx.ShapeType.rect, {x:barX,y:barY,w:recW,h:barH,fill:{color:C.verdeAc},line:{width:0},rectRadius:0.08});
      s3.addText(`${pctRecV}% recebidas`, {x:barX+0.1,y:barY,w:6,h:barH,fontSize:10,bold:true,color:"FFFFFF",fontFace:"Segoe UI",valign:"middle"});
      s3.addText(`${pctPendV}% pendentes`, {x:barX+6.5,y:barY,w:6.3,h:barH,fontSize:10,color:C.ambar,fontFace:"Segoe UI",valign:"middle",align:"right"});

      // saving no rodapé
      s3.addShape(pptx.ShapeType.rect, {x:0.3,y:3.0,w:12.73,h:1.2,fill:{color:saving>=0?C.verdeL:"FFF0F0"},line:{color:saving>=0?C.verdeAc:"EF4444",width:1},rectRadius:0.08});
      s3.addText("SAVING ACUMULADO", {x:0.5,y:3.1,w:12,h:0.22,fontSize:8,bold:true,charSpacing:2,color:saving>=0?C.verde:"9B1C1C",fontFace:"Segoe UI"});
      s3.addText(`${savingSign} ${fmtBRL(Math.abs(saving))}   (${Math.abs(savPct).toFixed(1)}% vs. orçado)`, {
        x:0.5,y:3.34,w:12,h:0.72,fontSize:24,color:saving>=0?C.verdeAc:"EF4444",fontFace:"Segoe UI"
      });

      await pptx.writeFile({fileName:`dashboard_variaveis_R${rodadaAtual}_brasileirao2026.pptx`});
      setStatus({msg:`✅ dashboard_variaveis_R${rodadaAtual}.pptx baixado!`, cls:"ok"});
    } catch(e) {
      setStatus({msg:"❌ Erro: "+e.message, cls:"err"});
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <div style={{paddingBottom:80}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={onBack} style={{...btnStyle,background:T.border,color:T.text,padding:"6px 14px",fontSize:12}}>← Voltar</button>
        <div>
          <h2 style={{margin:0,fontSize:15,color:T.text,fontWeight:700}}>📊 Custos Variáveis</h2>
          <p style={{margin:"2px 0 0",fontSize:12,color:T.textMd}}>Acompanhamento por rodada</p>
        </div>
      </div>

      {/* Seção 01 */}
      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>01</span><span style={secHdr}>Configuração Base</span></div>
        <div style={grid3}>
          <div style={{marginBottom:16}}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Rodada Atual *</label><input type="number" min={1} max={38} value={rodadaAtual} onChange={e=>setRodadaCount(e.target.value)} style={{...IS}}/></div>
          <div style={{marginBottom:16}}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Orçado Total – Campeonato *</label><input value={orcGlobal} onChange={e=>setOrcGlobal(e.target.value)} style={{...IS}}/></div>
          <div style={{marginBottom:16}}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Orçado Acumulado até a Rodada *</label><input value={orcAteRod} onChange={e=>setOrcAteRod(e.target.value)} style={{...IS}}/></div>
        </div>
      </div>

      {/* Seção 02 */}
      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>02</span><span style={secHdr}>Acompanhamento Macro</span></div>
        <div style={grid3}>
          {[{label:"Orçado",val:macroOrc,set:setMacroOrc,color:"#9ca3af"},{label:"Realizado",val:macroReal,set:setMacroReal,color:"#22c55e"},{label:"Projetado",val:macroProj,set:setMacroProj,color:"#3b82f6"}].map(({label,val,set:setter,color})=>(
            <div key={label} style={{background:T.bg,borderRadius:8,padding:"16px",borderTop:`3px solid ${color}`}}>
              <p style={{fontSize:10,fontWeight:700,color,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>{label}</p>
              <input value={val} onChange={e=>setter(e.target.value)} style={{...IS,color}}/>
            </div>
          ))}
        </div>
      </div>

      {/* Seção 03 */}
      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>03</span><span style={secHdr}>Dados por Rodada</span></div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
            <thead><tr style={{background:T.bg}}>{["Rodada","Orçado (R$) *","Realizado (R$) *","Saving (R$)"].map((h,i)=>(<th key={h} style={{padding:"10px 12px",textAlign:i===0?"left":"right",color:T.textSm,fontSize:11,borderBottom:`1px solid ${T.border}`}}>{h}</th>))}</tr></thead>
            <tbody>
              {rows.map((r,i) => {
                const sav = r.orcado - r.realizado;
                return (
                  <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                    <td style={{padding:"6px 12px",fontWeight:700,color:"#22c55e",fontSize:13}}>{r.label}</td>
                    <td style={{padding:"4px 12px",textAlign:"right"}}><input value={rodadas[i].orcado} onChange={e=>setRodadaField(i,"orcado",e.target.value)} style={{...iSty(T),width:120,textAlign:"right",padding:"4px 8px"}}/></td>
                    <td style={{padding:"4px 12px",textAlign:"right"}}><input value={rodadas[i].realizado} onChange={e=>setRodadaField(i,"realizado",e.target.value)} style={{...iSty(T),width:120,textAlign:"right",padding:"4px 8px",color:"#22c55e"}}/></td>
                    <td style={{padding:"6px 12px",textAlign:"right",fontWeight:700,color:sav>=0?"#a3e635":"#ef4444"}}>{sav>=0?"▲ ":"▼ "}{fmtR(Math.abs(sav))}</td>
                  </tr>
                );
              })}
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

      {/* Seção 04 */}
      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>04</span><span style={secHdr}>Notas Fiscais</span></div>
        <div style={grid3}>
          <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Notas Esperadas *</label><input value={nfEsp} onChange={e=>setNfEsp(e.target.value)} style={{...IS}}/></div>
          <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Notas Recebidas *</label><input value={nfRec} onChange={e=>setNfRec(e.target.value)} style={{...IS,color:"#22c55e"}}/></div>
          <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Pendentes <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO</span></label><input readOnly value={fmtNum(nfPend)} style={{...IS,color:"#d97706",cursor:"default"}}/></div>
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
              {label:"% Recebidas",    val:`${pctRec.toFixed(1)}%`,              sub:fmtRs(nfRecV),                            color:"#22c55e"},
              {label:"% Pendentes",    val:`${(100-pctRec).toFixed(1)}%`,        sub:fmtRs(nfPend),                            color:"#d97706"},
              {label:"Saving Acumulado",val:(saving>=0?"▲ ":"▼ ")+fmtRs(Math.abs(saving)),sub:`${Math.abs(savPct).toFixed(1)}% vs. orçado`,color:saving>=0?"#a3e635":"#ef4444"},
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

      {/* Footer */}
      <div style={{position:"sticky",bottom:0,background:T.card,borderTop:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:50}}>
        <div>
          <p style={{fontSize:12,color:T.textMd,marginBottom:2}}><b style={{color:T.text}}>Tudo preenchido?</b> Clique para gerar e baixar o PPTX.</p>
          <p style={{fontSize:11,color:status.cls==="ok"?"#22c55e":status.cls==="err"?"#ef4444":T.textSm}}>{status.msg}</p>
        </div>
        <button onClick={gerarPPTX} disabled={loading} style={{...btnStyle,background:loading?"#1a3a20":"#22c55e",color:loading?"#4ade80":"#000",padding:"11px 28px",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",opacity:loading?0.7:1}}>
          {loading ? "Gerando..." : "⚡ Gerar PPTX"}
        </button>
      </div>
    </div>
  );

  // helpers locais (sem conflito com escopo externo)
  function secNum() {}
  function secHdr() {}
}

// ─── FORM FIXOS ───────────────────────────────────────────────────────────────
function FormFixos({T, onBack}) {
  const [rodadaAtual, setRodadaAtual] = useState(4);
  const [orcTotal,    setOrcTotal]    = useState("1.410.212,00");
  const [status,      setStatus]      = useState({msg:"Aguardando...", cls:""});
  const [loading,     setLoading]     = useState(false);
  const [cats,        setCats]        = useState(() => JSON.parse(JSON.stringify(CATS_FIXOS_INIT)));
  const [collapsed,      setCollapsed]      = useState({});

  const toggleCat = id => setCollapsed(p=>({...p,[id]:!p[id]}));

  const updateItem    = (catId,subId,itemId,field,val) => setCats(prev=>prev.map(cat=>cat.id!==catId?cat:{...cat,subs:cat.subs.map(sub=>sub.id!==subId?sub:{...sub,itens:sub.itens.map(it=>it.id!==itemId?it:{...it,[field]:field==="nome"?val:(parseBR(val)||0)})})}));
  const addItem       = (catId,subId) => setCats(prev=>prev.map(cat=>cat.id!==catId?cat:{...cat,subs:cat.subs.map(sub=>sub.id!==subId?sub:{...sub,itens:[...sub.itens,{id:Date.now(),nome:"",orc:0,gasto:0,prov:0}]})}));
  const removeItem    = (catId,subId,itemId) => setCats(prev=>prev.map(cat=>cat.id!==catId?cat:{...cat,subs:cat.subs.map(sub=>sub.id!==subId?sub:{...sub,itens:sub.itens.filter(it=>it.id!==itemId)})}));
  const addSub        = catId => setCats(prev=>prev.map(cat=>cat.id!==catId?cat:{...cat,subs:[...cat.subs,{id:Date.now(),nome:"Nova Subcategoria",itens:[{id:Date.now()+1,nome:"",orc:0,gasto:0,prov:0}]}]}));
  const removeSub     = (catId,subId) => setCats(prev=>prev.map(cat=>cat.id!==catId?cat:{...cat,subs:cat.subs.filter(s=>s.id!==subId)}));
  const updateSubNome = (catId,subId,val) => setCats(prev=>prev.map(cat=>cat.id!==catId?cat:{...cat,subs:cat.subs.map(sub=>sub.id!==subId?sub:{...sub,nome:val})}));

  const calcSub = sub => ({
    orc:   sub.itens.reduce((s,it)=>s+it.orc, 0),
    gasto: sub.itens.reduce((s,it)=>s+it.gasto, 0),
    prov:  sub.itens.reduce((s,it)=>s+it.prov, 0),
    saldo: sub.itens.reduce((s,it)=>s+it.orc-it.gasto-it.prov, 0),
  });
  const calcCat = cat => {
    const subs = cat.subs.map(calcSub);
    return {orc:subs.reduce((s,x)=>s+x.orc,0),gasto:subs.reduce((s,x)=>s+x.gasto,0),prov:subs.reduce((s,x)=>s+x.prov,0),saldo:subs.reduce((s,x)=>s+x.saldo,0)};
  };
  const totals = useMemo(()=>{
    const cs = cats.map(cat => ({...cat,...calcCat(cat)}));
    return {cats:cs,orc:cs.reduce((s,c)=>s+c.orc,0),gasto:cs.reduce((s,c)=>s+c.gasto,0),prov:cs.reduce((s,c)=>s+c.prov,0),saldo:cs.reduce((s,c)=>s+c.saldo,0)};
  },[cats]);

  const IS = iSty(T);

  // ── GERAR PPTX FIXOS ──────────────────────────────────────────────────────
  async function gerarPPTX() {
    setLoading(true); setStatus({msg:"Gerando...", cls:""});
    try {
      const orcTotalV = parseBR(orcTotal);
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";

      // ── SLIDE 1: RESUMO GERAL ─────────────────────────────────────────────
      const s1 = pptx.addSlide();
      s1.background = {color: C.bg};
      s1.addShape(pptx.ShapeType.rect, {x:0,y:0,w:13.33,h:0.06,fill:{color:C.azulAc},line:{width:0}});
      s1.addText("Custos Fixos – Brasileirão 2026", {x:0.3,y:0.12,w:10,h:0.38,fontSize:20,bold:true,color:C.dark,fontFace:"Segoe UI"});
      s1.addText(`Rodada ${rodadaAtual} de 38`, {x:10.3,y:0.12,w:2.73,h:0.38,fontSize:18,bold:true,color:C.azulAc,fontFace:"Segoe UI",align:"right"});
      s1.addShape(pptx.ShapeType.line, {x:0.3,y:0.6,w:12.73,h:0,line:{color:C.border,width:1}});

      // 4 KPIs
      const kpis = [
        {label:"ORÇADO TOTAL",  val:fmtBRL(orcTotalV),    color:C.cinza,   bg:C.bgLight},
        {label:"GASTO",         val:fmtBRL(totals.gasto), color:C.azulAc,  bg:C.azulL},
        {label:"PROVISIONADO",  val:fmtBRL(totals.prov),  color:C.ambar,   bg:"FFFBEB"},
        {label:"SALDO",         val:fmtBRL(totals.saldo), color:totals.saldo>=0?C.verdeAc:"EF4444", bg:totals.saldo>=0?C.verdeL:"FFF0F0"},
      ];
      kpis.forEach(({label,val,color,bg}, i) => {
        const x = 0.3 + i * 3.2;
        s1.addShape(pptx.ShapeType.rect, {x,y:0.78,w:3.0,h:1.4,fill:{color:bg},line:{color,width:1.5},rectRadius:0.08});
        s1.addText(label, {x:x+0.14,y:0.88,w:2.72,h:0.22,fontSize:7.5,bold:true,color,charSpacing:2,fontFace:"Segoe UI"});
        s1.addText(val,   {x:x+0.14,y:1.14,w:2.72,h:0.6,fontSize:17,color:C.dark,fontFace:"Segoe UI"});
      });

      // tabela resumo por categoria
      const tblHead = [
        {text:"Categoria",   options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.azul}}},
        {text:"Orçado",      options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.azul},align:"right"}},
        {text:"Gasto",       options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.azul},align:"right"}},
        {text:"Provisionado",options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.azul},align:"right"}},
        {text:"Saldo",       options:{bold:true,fontSize:9,color:"FFFFFF",fill:{color:C.azul},align:"right"}},
      ];
      const catRows = totals.cats.map((cat, idx) => {
        const fill = {color: idx%2===0 ? C.bg : C.bgLight};
        const saldoColor = cat.saldo >= 0 ? "00B050" : "FF0000";
        return [
          {text:cat.label,           options:{fontSize:9,bold:true,color:C.dark,fill}},
          {text:fmtBRL(cat.orc),     options:{fontSize:9,color:C.dark,fill,align:"right"}},
          {text:fmtBRL(cat.gasto),   options:{fontSize:9,color:C.dark,fill,align:"right"}},
          {text:fmtBRL(cat.prov),    options:{fontSize:9,color:C.ambar,fill,align:"right"}},
          {text:fmtBRL(cat.saldo),   options:{fontSize:9,bold:true,color:saldoColor,fill,align:"right"}},
        ];
      });
      const totRow = [
        {text:"TOTAL", options:{fontSize:9,bold:true,color:"FFFFFF",fill:{color:C.dark}}},
        {text:fmtBRL(totals.orc),   options:{fontSize:9,bold:true,color:"FFFFFF",fill:{color:C.dark},align:"right"}},
        {text:fmtBRL(totals.gasto), options:{fontSize:9,bold:true,color:"FFFFFF",fill:{color:C.dark},align:"right"}},
        {text:fmtBRL(totals.prov),  options:{fontSize:9,bold:true,color:"FFFFFF",fill:{color:C.dark},align:"right"}},
        {text:fmtBRL(totals.saldo), options:{fontSize:9,bold:true,color:totals.saldo>=0?"A3E635":"FF0000",fill:{color:C.dark},align:"right"}},
      ];
      s1.addTable([tblHead, ...catRows, totRow], {
        x:0.3, y:2.36, w:12.73, colW:[4,2.18,2.18,2.18,2.19],
        border:{type:"solid",color:C.border,pt:0.5}, rowH:0.3,
      });

      // ── SLIDE 2+: DETALHE POR CATEGORIA ──────────────────────────────────
      for (const cat of cats) {
        const sl = pptx.addSlide();
        sl.background = {color: C.bg};
        sl.addShape(pptx.ShapeType.rect, {x:0,y:0,w:13.33,h:0.06,fill:{color:C.azulAc},line:{width:0}});
        sl.addText(cat.label, {x:0.3,y:0.12,w:10,h:0.38,fontSize:18,bold:true,color:C.dark,fontFace:"Segoe UI"});
        sl.addText(`Rodada ${rodadaAtual}`, {x:10.3,y:0.12,w:2.73,h:0.38,fontSize:14,color:C.azulAc,fontFace:"Segoe UI",align:"right"});
        sl.addShape(pptx.ShapeType.line, {x:0.3,y:0.6,w:12.73,h:0,line:{color:C.border,width:1}});

        const catHead = [
          {text:"Item",        options:{bold:true,fontSize:8.5,color:"FFFFFF",fill:{color:C.azul}}},
          {text:"Orçado",      options:{bold:true,fontSize:8.5,color:"FFFFFF",fill:{color:C.azul},align:"right"}},
          {text:"Gasto",       options:{bold:true,fontSize:8.5,color:"FFFFFF",fill:{color:C.azul},align:"right"}},
          {text:"Provisionado",options:{bold:true,fontSize:8.5,color:"FFFFFF",fill:{color:C.azul},align:"right"}},
          {text:"Saldo",       options:{bold:true,fontSize:8.5,color:"FFFFFF",fill:{color:C.azul},align:"right"}},
        ];

        const itemRows = [];
        cat.subs.forEach((sub, si) => {
          // linha de subcategoria
          itemRows.push([
            {text:sub.nome, options:{fontSize:8,bold:true,color:C.azulAc,fill:{color:C.azulL}}},
            {text:"", options:{fill:{color:C.azulL}}},
            {text:"", options:{fill:{color:C.azulL}}},
            {text:"", options:{fill:{color:C.azulL}}},
            {text:"", options:{fill:{color:C.azulL}}},
          ]);
          sub.itens.forEach((it, ii) => {
            const saldo = it.orc - it.gasto - it.prov;
            const fill  = {color: ii%2===0 ? C.bg : C.bgLight};
            itemRows.push([
              {text:it.nome||"—",    options:{fontSize:8.5,color:C.dark,fill}},
              {text:fmtBRL(it.orc),  options:{fontSize:8.5,color:C.dark,fill,align:"right"}},
              {text:fmtBRL(it.gasto),options:{fontSize:8.5,color:C.dark,fill,align:"right"}},
              {text:fmtBRL(it.prov), options:{fontSize:8.5,color:C.ambar,fill,align:"right"}},
              {text:fmtBRL(saldo),   options:{fontSize:8.5,bold:true,color:saldo>=0?"00B050":"FF0000",fill,align:"right"}},
            ]);
          });
        });

        // total categoria
        const ct = calcCat(cat);
        itemRows.push([
          {text:"TOTAL "+cat.label, options:{fontSize:8.5,bold:true,color:"FFFFFF",fill:{color:C.dark}}},
          {text:fmtBRL(ct.orc),    options:{fontSize:8.5,bold:true,color:"FFFFFF",fill:{color:C.dark},align:"right"}},
          {text:fmtBRL(ct.gasto),  options:{fontSize:8.5,bold:true,color:"FFFFFF",fill:{color:C.dark},align:"right"}},
          {text:fmtBRL(ct.prov),   options:{fontSize:8.5,bold:true,color:"FFFFFF",fill:{color:C.dark},align:"right"}},
          {text:fmtBRL(ct.saldo),  options:{fontSize:8.5,bold:true,color:ct.saldo>=0?"A3E635":"FF0000",fill:{color:C.dark},align:"right"}},
        ]);

        sl.addTable([catHead, ...itemRows], {
          x:0.3, y:0.75, w:12.73, colW:[4,2.18,2.18,2.18,2.19],
          border:{type:"solid",color:C.border,pt:0.5}, rowH:0.28,
        });
      }

      await pptx.writeFile({fileName:`custos_fixos_R${rodadaAtual}_brasileirao2026.pptx`});
      setStatus({msg:`✅ custos_fixos_R${rodadaAtual}.pptx baixado!`, cls:"ok"});
    } catch(e) {
      setStatus({msg:"❌ Erro: "+e.message, cls:"err"});
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <div style={{paddingBottom:80}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={onBack} style={{...btnStyle,background:T.border,color:T.text,padding:"6px 14px",fontSize:12}}>← Voltar</button>
        <h2 style={{margin:0,fontSize:15,color:T.text,fontWeight:700}}>🔒 Custos Fixos</h2>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
          <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4}}>Rodada Atual</label><input type="number" min={1} max={38} value={rodadaAtual} onChange={e=>setRodadaAtual(parseInt(e.target.value)||1)} style={{...IS}}/></div>
          <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4}}>Orçado Total</label><input value={orcTotal} onChange={e=>setOrcTotal(e.target.value)} style={{...IS}}/></div>
        </div>
        {cats.map(cat => {
          const ct = totals.cats.find(c=>c.id===cat.id)||{orc:0,gasto:0,prov:0,saldo:0};
          return (
            <div key={cat.id} style={{background:T.bg,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>toggleCat(cat.id)}>
                <span style={{fontWeight:700,color:T.text}}>{cat.label}</span>
                <div style={{display:"flex",gap:12,fontSize:12,alignItems:"center"}}>
                  <span style={{color:"#3b82f6"}}>Orç: {ct.orc.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})}</span>
                  <span style={{color:ct.saldo>=0?"#a3e635":"#ef4444"}}>Saldo: {ct.saldo.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})}</span>
                  <button onClick={e=>{e.stopPropagation();addSub(cat.id);}} style={{...btnStyle,background:"#3b82f633",color:"#3b82f6",padding:"2px 10px",fontSize:11}}>+ sub</button>
                  <span style={{color:T.textSm}}>{collapsed[cat.id]?"▲":"▼"}</span>
                </div>
              </div>
              {!collapsed[cat.id] && cat.subs.map(sub => (
                <div key={sub.id} style={{borderTop:`1px solid ${T.border}`,padding:"10px 20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <input value={sub.nome} onChange={e=>updateSubNome(cat.id,sub.id,e.target.value)} style={{...IS,width:"auto",flex:1,marginRight:12,fontSize:12,fontWeight:600}}/>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>addItem(cat.id,sub.id)} style={{...btnStyle,background:"#22c55e33",color:"#22c55e",padding:"2px 10px",fontSize:11}}>+ item</button>
                      <button onClick={()=>removeSub(cat.id,sub.id)} style={{...btnStyle,background:"#7f1d1d",padding:"2px 8px",fontSize:11}}>🗑</button>
                    </div>
                  </div>
                  {sub.itens.map(item => (
                    <div key={item.id} style={{display:"grid",gridTemplateColumns:"1fr 100px 100px 100px 28px",gap:8,marginBottom:6,alignItems:"center"}}>
                      <input value={item.nome} onChange={e=>updateItem(cat.id,sub.id,item.id,"nome",e.target.value)} placeholder="Nome do item" style={{...IS,fontSize:12}}/>
                      {["orc","gasto","prov"].map(f=>(
                        <input key={f} value={item[f]} onChange={e=>updateItem(cat.id,sub.id,item.id,f,e.target.value)} placeholder={f==="orc"?"Orç":f==="gasto"?"Gasto":"Prov"} style={{...IS,fontSize:12,textAlign:"right",color:f==="orc"?"#3b82f6":f==="gasto"?T.text:"#f59e0b"}}/>
                      ))}
                      <button onClick={()=>removeItem(cat.id,sub.id,item.id)} style={{...btnStyle,background:"#7f1d1d",padding:"2px 6px",fontSize:11}}>✕</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{position:"sticky",bottom:0,background:T.card,borderTop:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:50}}>
        <p style={{fontSize:11,color:status.cls==="ok"?"#22c55e":status.cls==="err"?"#ef4444":T.textSm,margin:0}}>{status.msg}</p>
        <button onClick={gerarPPTX} disabled={loading} style={{...btnStyle,background:loading?"#1a3a20":"#3b82f6",padding:"11px 28px",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",opacity:loading?0.7:1}}>
          {loading ? "Gerando..." : "⚡ Gerar PPTX"}
        </button>
      </div>
    </div>
  );
}

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────
export default function TabApresentacoes({T}) {
  const [tipo, setTipo] = useState(null);
  if (!tipo)             return <SeletorTipo T={T} onSelect={setTipo}/>;
  if (tipo==="variaveis") return <FormVariaveis T={T} onBack={()=>setTipo(null)}/>;
  return <FormFixos T={T} onBack={()=>setTipo(null)}/>;
}
