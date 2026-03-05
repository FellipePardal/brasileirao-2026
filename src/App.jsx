import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

const fmt  = v => (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const fmtK = v => `R$${((v||0)/1000).toFixed(0)}k`;

const DETENTORES = ["CazeTV/Record/Premiere","Amazon","A definir"];
const CIDADES    = ["Rio de Janeiro","São Paulo","Curitiba","Belo Horizonte","Porto Alegre","Chapecó","Mirassol","Outro"];
const TIMES      = ["Fluminense","Botafogo","Flamengo","Vasco","Corinthians","Palmeiras","São Paulo","Athletico PR","Grêmio","Internacional","Cruzeiro","Atlético MG","Chapecoense","Santos","Vitória","Mirassol","Coritiba","Outro"];

const CATS = [
  { key:"logistica", label:"Logística", color:"#22c55e",
    subs:[
      {key:"outros_log",  label:"Outros Logística"},
      {key:"transporte",  label:"Transporte"},
      {key:"uber",        label:"Uber"},
      {key:"hospedagem",  label:"Hospedagem"},
      {key:"diaria",      label:"Diária"},
    ]},
  { key:"pessoal", label:"Pessoal", color:"#3b82f6",
    subs:[
      {key:"coord_um",    label:"Coord UM"},
      {key:"prod_um",     label:"Prod UM"},
      {key:"prod_campo",  label:"Prod Campo"},
      {key:"monitoracao", label:"Monitoração"},
      {key:"supervisor1", label:"Supervisor 1"},
      {key:"supervisor2", label:"Supervisor 2"},
      {key:"dtv",         label:"DTV"},
      {key:"vmix",        label:"Vmix"},
      {key:"audio",       label:"Áudio"},
    ]},
  { key:"operacoes", label:"Operações", color:"#f59e0b",
    subs:[
      {key:"um_b1",       label:"UM B1"},
      {key:"um_b2",       label:"UM B2"},
      {key:"geradores",   label:"Geradores"},
      {key:"sng",         label:"SNG"},
      {key:"sng_extra",   label:"SNG Extra"},
      {key:"seg_espacial",label:"Seg. Espacial"},
      {key:"seg_extra",   label:"Seg. Extra"},
      {key:"drone",       label:"Drone"},
      {key:"grua",        label:"Grua/Policam"},
      {key:"dslr",        label:"DSLR + Microlink"},
      {key:"carrinho",    label:"Carrinho"},
      {key:"especial",    label:"Especial"},
      {key:"goalcam",     label:"Goalcam"},
      {key:"minidrone",   label:"Minidrone"},
      {key:"infra",       label:"Infra + Distr."},
      {key:"extra",       label:"Extra"},
    ]},
];

const allSubKeys = () => {
  const r={};
  CATS.forEach(c=>c.subs.forEach(s=>{r[s.key]=0;}));
  return r;
};

const PESSOAL = {coord_um:1000,prod_um:0,prod_campo:400,monitoracao:0,supervisor1:800,supervisor2:800,dtv:800,vmix:500,audio:800};

const B1_SUL = {outros_log:0,transporte:6000,uber:1000,hospedagem:2450,diaria:550,...PESSOAL,um_b1:85000,um_b2:0,geradores:4500,sng:6600,sng_extra:0,seg_espacial:4500,seg_extra:0,drone:2500,grua:4500,dslr:8500,carrinho:0,especial:15000,goalcam:4000,minidrone:2500,infra:6776,extra:0};
const B2_SUDESTE = {outros_log:0,transporte:5000,uber:1000,hospedagem:1450,diaria:550,...PESSOAL,um_b1:0,um_b2:50000,geradores:4500,sng:6600,sng_extra:0,seg_espacial:4500,seg_extra:0,drone:2500,grua:4500,dslr:8500,carrinho:0,especial:0,goalcam:0,minidrone:0,infra:6776,extra:0};
const B2_SUL = {outros_log:0,transporte:10010,uber:1200,hospedagem:3150,diaria:640,...PESSOAL,um_b1:0,um_b2:50000,geradores:6000,sng:7920,sng_extra:0,seg_espacial:4500,seg_extra:0,drone:3500,grua:9000,dslr:10500,carrinho:0,especial:0,goalcam:0,minidrone:0,infra:6776,extra:0};

const getDefaults = (cat, regiao="sudeste") => {
  if (cat==="B1") return {...B1_SUL};
  if (regiao==="sul") return {...B2_SUL};
  return {...B2_SUDESTE};
};

const JOGO_CENARIO = {
  1:"b1", 2:"b1", 5:"b1", 8:"b1", 10:"b1", 11:"b1", 15:"b1", 16:"b1",
  3:"b2s", 9:"b2s", 14:"b2s",
  6:"b2sul",
  4:"b2sul", 7:"b2sul", 12:"b2sul", 13:"b2sul",
};

const getJogoDefaults = (id, cat, det) => {
  const c = JOGO_CENARIO[id];
  if (c==="b1") return {...B1_SUL};
  if (c==="b2sul") return {...B2_SUL};
  if (c==="b2s") return {...B2_SUDESTE};
  if (cat==="B1") return {...B1_SUL};
  if (det==="CazeTV/Record/Premiere") return {...B2_SUL};
  return {...B2_SUDESTE};
};

const subTotal = subs => Object.values(subs||{}).reduce((s,v)=>s+(v||0),0);
const catTotal = (subs,cat) => cat.subs.reduce((s,sub)=>s+(subs?.[sub.key]||0),0);

const makeJogo = (id,rodada,cat,cidade,data,hora,mandante,visitante,detentor) => {
  const defs = getJogoDefaults(id,cat,detentor);
  return {id,rodada,categoria:cat,cidade,data,hora,mandante,visitante,detentor,
    orcado:{...defs},provisionado:{...allSubKeys()},realizado:{...allSubKeys()}};
};

const JOGOS_REAIS = [
  makeJogo(1,1,"B1","Rio de Janeiro","28/01","19:30","Fluminense","Grêmio","CazeTV/Record/Premiere"),
  makeJogo(2,1,"B1","Rio de Janeiro","29/01","21:30","Botafogo","Cruzeiro","Amazon"),
  makeJogo(3,2,"B2","Rio de Janeiro","05/02","20:00","Vasco","Chapecoense","Amazon"),
  makeJogo(4,2,"B2","Curitiba","18/02","19:30","Athletico PR","Corinthians","CazeTV/Record/Premiere"),
  makeJogo(5,3,"B1","Rio de Janeiro","12/02","19:30","Fluminense","Botafogo","CazeTV/Record/Premiere"),
  makeJogo(6,3,"B2","Porto Alegre","12/02","21:30","Internacional","Palmeiras","Amazon"),
  makeJogo(7,4,"B2","Curitiba","26/02","20:00","Coritiba","São Paulo","Amazon"),
  makeJogo(8,4,"B1","Rio de Janeiro","à definir","à definir","Botafogo","Vitória","CazeTV/Record/Premiere"),
  makeJogo(9,5,"B2","Mirassol","10/03","21:30","Mirassol","Santos","Amazon"),
  makeJogo(10,5,"B1","Rio de Janeiro","12/03","19:30","Vasco","Palmeiras","CazeTV/Record/Premiere"),
  makeJogo(11,6,"B1","Rio de Janeiro","14/03","20:30","Botafogo","Flamengo","Amazon"),
  makeJogo(12,6,"B2","Belo Horizonte","15/03","20:30","Cruzeiro","Vasco","CazeTV/Record/Premiere"),
  makeJogo(13,7,"B2","Curitiba","18/03","19:30","Athletico PR","Cruzeiro","CazeTV/Record/Premiere"),
  makeJogo(14,7,"B2","Chapecó","19/03","21:30","Chapecoense","Corinthians","Amazon"),
  makeJogo(15,8,"B1","Rio de Janeiro","21/03","18:30","Fluminense","Atlético MG","Amazon"),
  makeJogo(16,8,"B1","São Paulo","22/03","20:30","Corinthians","Flamengo","CazeTV/Record/Premiere"),
];

const JOGOS_PLACEHOLDER = Array.from({length:60},(_,i)=>{
  const rodada=9+Math.floor(i/2), cat=i%2===0?"B1":"B2";
  const defs=getDefaults(cat,"A definir");
  return {id:100+i,rodada,categoria:cat,cidade:"A definir",data:"A definir",hora:"A definir",
    mandante:"A definir",visitante:"A definir",detentor:"A definir",
    orcado:{...defs},provisionado:{...defs},realizado:{...allSubKeys()}};
});

const ALL_JOGOS = [...JOGOS_REAIS,...JOGOS_PLACEHOLDER];

const RESUMO_VARIAVEIS = [
  {nome:"Logística",  orcado:179000,  realizado:0,      tipo:"variavel"},
  {nome:"Pessoal",    orcado:81600,   realizado:44200,  tipo:"variavel"},
  {nome:"Operações",  orcado:1681200, realizado:667890, tipo:"variavel"},
  {nome:"Extra",      orcado:0,       realizado:1040,   tipo:"variavel"},
];

const SERVICOS_INIT = [
  { secao:"Pessoal", itens:[
    {id:1,  nome:"Coordenador Sinal Internacional", orcado:0,       provisionado:0, realizado:0,     obs:""},
    {id:2,  nome:"Produtor Campo/Detentores",        orcado:0,       provisionado:0, realizado:0,     obs:""},
    {id:3,  nome:"Produtor Assets/Pacote",           orcado:0,       provisionado:0, realizado:0,     obs:""},
    {id:4,  nome:"Editor de Imagens 1",              orcado:0,       provisionado:0, realizado:14900, obs:""},
    {id:5,  nome:"Editor de Imagens 2",              orcado:0,       provisionado:0, realizado:0,     obs:""},
  ]},
  { secao:"Transmissão", itens:[
    {id:6,  nome:"Recepção Fibra para MMs, Antipirataria e Arquivo", orcado:234612, provisionado:0, realizado:0, obs:""},
  ]},
  { secao:"Infraestrutura e Distribuição de Sinais", itens:[
    {id:7,  nome:"Antipirataria (Serviço LiveMode)", orcado:425600,  provisionado:0, realizado:840,   obs:""},
    {id:8,  nome:"Estatísticas",                     orcado:120000,  provisionado:0, realizado:7000,  obs:""},
    {id:9,  nome:"Ferramenta de Clipping",           orcado:200000,  provisionado:0, realizado:0,     obs:""},
    {id:10, nome:"Media Day",                        orcado:300000,  provisionado:0, realizado:0,     obs:""},
    {id:11, nome:"Espumas",                          orcado:5000,    provisionado:0, realizado:0,     obs:""},
    {id:12, nome:"Grafismo",                         orcado:90000,   provisionado:0, realizado:0,     obs:""},
    {id:13, nome:"Vinheta + Trilha",                 orcado:35000,   provisionado:0, realizado:16000, obs:""},
  ]},
];

const DARK = {
  bg:"#0f172a", card:"#1e293b", border:"#334155", muted:"#475569",
  text:"#f1f5f9", textMd:"#94a3b8", textSm:"#64748b",
};
const LIGHT = {
  bg:"#f8fafc", card:"#ffffff", border:"#e2e8f0", muted:"#cbd5e1",
  text:"#1e293b", textMd:"#475569", textSm:"#64748b",
};

const TIPO_COLOR={fixo:"#6366f1",variavel:"#f43f5e"};
const PIE_COLORS=["#22c55e","#3b82f6","#f59e0b","#ec4899","#8b5cf6","#06b6d4","#f97316"];
const iSty=T=>({background:T.bg,border:`1px solid ${T.muted}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:13,width:"100%",boxSizing:"border-box"});
const btnStyle={color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontWeight:600,fontSize:13};

const Pill=({label,color})=>(
  <span style={{background:color+"22",color,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>
);
const KPI=({label,value,sub,color,T})=>(
  <div style={{background:T.card,borderRadius:12,padding:"18px 20px",borderLeft:`4px solid ${color}`}}>
    <p style={{color:T.textMd,fontSize:12,marginBottom:6}}>{label}</p>
    <p style={{fontSize:20,fontWeight:700,color,marginBottom:2}}>{value}</p>
    <p style={{color:T.textSm,fontSize:11}}>{sub}</p>
  </div>
);
const CustomTooltip=({active,payload,label,T})=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px"}}>
      <p style={{color:T.textMd,marginBottom:6,fontWeight:600}}>{label}</p>
      {payload.map(p=><p key={p.name} style={{color:p.fill||p.color,margin:"2px 0"}}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

const SECAO_COLORS = {"Pessoal":"#3b82f6","Transmissão":"#22c55e","Infraestrutura e Distribuição de Sinais":"#f59e0b"};

// ─── NOVA ABA: RELATÓRIO ────────────────────────────────────────────────────
function TabRelatorio({jogos, servicos, T}) {
  const divulgados = jogos.filter(j=>j.mandante!=="A definir");
  const [filtroRod, setFiltroRod] = useState("Todas");
  const [filtroCat, setFiltroCat] = useState("Todas");

  const jogosF = divulgados.filter(j=>
    (filtroRod==="Todas"||j.rodada===parseInt(filtroRod))&&
    (filtroCat==="Todas"||j.categoria===filtroCat)
  );

  // Totais por categoria de custo
  const catTotals = CATS.map(cat=>{
    const orc  = jogosF.reduce((s,j)=>s+catTotal(j.orcado,cat),0);
    const prov = jogosF.reduce((s,j)=>s+catTotal(j.provisionado,cat),0);
    const real = jogosF.reduce((s,j)=>s+catTotal(j.realizado,cat),0);
    return {label:cat.label, color:cat.color, orc, prov, real};
  });

  const totOrc  = catTotals.reduce((s,c)=>s+c.orc,0);
  const totProv = catTotals.reduce((s,c)=>s+c.prov,0);
  const totReal = catTotals.reduce((s,c)=>s+c.real,0);

  // Breakdown por sub-item agregado
  const subAgg = {};
  CATS.forEach(cat=>{
    cat.subs.forEach(sub=>{
      subAgg[sub.key]={label:sub.label,catLabel:cat.label,catColor:cat.color,orc:0,prov:0,real:0};
    });
  });
  jogosF.forEach(j=>{
    CATS.forEach(cat=>{
      cat.subs.forEach(sub=>{
        subAgg[sub.key].orc  += j.orcado?.[sub.key]||0;
        subAgg[sub.key].prov += j.provisionado?.[sub.key]||0;
        subAgg[sub.key].real += j.realizado?.[sub.key]||0;
      });
    });
  });
  const subRows = Object.values(subAgg).filter(r=>r.orc>0||r.prov>0||r.real>0);

  const allServItens = servicos.flatMap(s=>s.itens);
  const sOrc  = allServItens.reduce((s,x)=>s+x.orcado,0);
  const sReal = allServItens.reduce((s,x)=>s+x.realizado,0);

  const grandOrc  = totOrc  + sOrc;
  const grandReal = totReal + sReal;

  const rodadasList=["Todas",...Array.from(new Set(divulgados.map(j=>j.rodada))).sort((a,b)=>a-b).map(String)];

  return(
    <div>
      {/* Filtros */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
        {rodadasList.map(r=>(
          <button key={r} onClick={()=>setFiltroRod(r)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,
            background:filtroRod===r?"#22c55e":T.card,color:filtroRod===r?"#fff":T.textMd}}>{r==="Todas"?"Todas":`Rd ${r}`}</button>
        ))}
        <div style={{width:1,background:T.border,margin:"0 4px"}}/>
        {["Todas","B1","B2"].map(c=>(
          <button key={c} onClick={()=>setFiltroCat(c)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,
            background:filtroCat===c?"#f59e0b":T.card,color:filtroCat===c?"#000":T.textMd}}>{c==="Todas"?"B1+B2":c}</button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Total Orçado (jogos+fixos)" value={fmt(grandOrc)} sub={`${jogosF.length} jogos selecionados`} color="#22c55e" T={T}/>
        <KPI label="Total Realizado" value={fmt(grandReal)} sub={`${grandOrc?((grandReal/grandOrc)*100).toFixed(1):0}% executado`} color="#f59e0b" T={T}/>
        <KPI label="Saving Geral" value={fmt(grandOrc-grandReal)} sub="Orçado - Realizado" color={(grandOrc-grandReal)>=0?"#a3e635":"#ef4444"} T={T}/>
        <KPI label="Custo Médio / Jogo" value={jogosF.length?fmt(totOrc/jogosF.length):"—"} sub="Orçado variável" color="#8b5cf6" T={T}/>
      </div>

      {/* Resumo por categoria de custo */}
      <div style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
          <h3 style={{margin:0,fontSize:14,color:T.textMd}}>Custos Variáveis por Categoria</h3>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
            <thead><tr style={{background:T.bg}}>
              {["Categoria","Orçado","Provisionado","Realizado","Saving","% Exec."].map(h=>
                <th key={h} style={{padding:"10px 16px",textAlign:h==="Categoria"?"left":"right",color:T.textSm,fontSize:11}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {catTotals.map(c=>{
                const sv=c.orc-c.real;
                const pct=c.orc?((c.real/c.orc)*100).toFixed(1):0;
                return(
                  <tr key={c.label} style={{borderTop:`1px solid ${T.border}`}}>
                    <td style={{padding:"10px 16px",fontWeight:600,color:c.color}}>{c.label}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",color:T.text}}>{fmt(c.orc)}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",color:"#3b82f6"}}>{fmt(c.prov)}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",color:"#f59e0b"}}>{fmt(c.real)}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",fontWeight:700,color:sv>=0?"#a3e635":"#ef4444"}}>{fmt(sv)}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",color:T.textMd}}>{pct}%</td>
                  </tr>
                );
              })}
              <tr style={{borderTop:`2px solid ${T.muted}`,background:T.bg,fontWeight:700}}>
                <td style={{padding:"12px 16px",color:T.text}}>TOTAL VARIÁVEL</td>
                <td style={{padding:"12px 16px",textAlign:"right",color:"#22c55e"}}>{fmt(totOrc)}</td>
                <td style={{padding:"12px 16px",textAlign:"right",color:"#3b82f6"}}>{fmt(totProv)}</td>
                <td style={{padding:"12px 16px",textAlign:"right",color:"#f59e0b"}}>{fmt(totReal)}</td>
                <td style={{padding:"12px 16px",textAlign:"right",color:(totOrc-totReal)>=0?"#a3e635":"#ef4444"}}>{fmt(totOrc-totReal)}</td>
                <td style={{padding:"12px 16px",textAlign:"right",color:T.textMd}}>{totOrc?((totReal/totOrc)*100).toFixed(1):0}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Top sub-itens de custo */}
      <div style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
          <h3 style={{margin:0,fontSize:14,color:T.textMd}}>Ranking de Sub-itens (por Orçado)</h3>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
            <thead><tr style={{background:T.bg}}>
              {["#","Item","Categoria","Orçado","Realizado","Saving","% do Total"].map(h=>
                <th key={h} style={{padding:"8px 14px",textAlign:h==="Item"||h==="Categoria"?"left":"right",color:T.textSm,fontSize:11}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[...subRows].sort((a,b)=>b.orc-a.orc).map((r,i)=>{
                const sv=r.orc-r.real;
                const pct=totOrc?(r.orc/totOrc*100).toFixed(1):0;
                return(
                  <tr key={r.label} style={{borderTop:`1px solid ${T.border}`}}>
                    <td style={{padding:"8px 14px",color:T.textSm,fontSize:11}}>{i+1}</td>
                    <td style={{padding:"8px 14px",fontWeight:600,color:T.text,fontSize:13}}>{r.label}</td>
                    <td style={{padding:"8px 14px"}}><Pill label={r.catLabel} color={r.catColor}/></td>
                    <td style={{padding:"8px 14px",textAlign:"right",color:T.text}}>{fmt(r.orc)}</td>
                    <td style={{padding:"8px 14px",textAlign:"right",color:"#f59e0b"}}>{fmt(r.real)}</td>
                    <td style={{padding:"8px 14px",textAlign:"right",color:sv>=0?"#a3e635":"#ef4444",fontWeight:600}}>{fmt(sv)}</td>
                    <td style={{padding:"8px 14px",textAlign:"right"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
                        <span style={{color:T.textMd,fontSize:12}}>{pct}%</span>
                        <div style={{width:60,background:T.border,borderRadius:4,height:6}}>
                          <div style={{width:`${Math.min(100,pct)}%`,height:"100%",borderRadius:4,background:r.catColor}}/>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fixos resumo */}
      <div style={{background:T.card,borderRadius:12,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <span style={{color:T.textMd,fontWeight:700,fontSize:13}}>Serviços Fixos (consolidado)</span>
        <div style={{display:"flex",gap:20,fontSize:13,flexWrap:"wrap"}}>
          <span>Orçado: <b style={{color:"#22c55e"}}>{fmt(sOrc)}</b></span>
          <span>Realizado: <b style={{color:"#f59e0b"}}>{fmt(sReal)}</b></span>
          <span>Saving: <b style={{color:(sOrc-sReal)>=0?"#a3e635":"#ef4444"}}>{fmt(sOrc-sReal)}</b></span>
        </div>
      </div>
    </div>
  );
}

function TabServicos({servicos, setServicos, T}) {
  const [editing, setEditing] = useState(null);
  const [draft,   setDraft]   = useState(null);

  const allItens = servicos.flatMap(s=>s.itens);
  const totOrc   = allItens.reduce((s,x)=>s+x.orcado,0);
  const totProv  = allItens.reduce((s,x)=>s+x.provisionado,0);
  const totReal  = allItens.reduce((s,x)=>s+x.realizado,0);

  const startEdit = (item) => { setEditing(item.id); setDraft({...item}); };
  const cancelEdit = () => { setEditing(null); setDraft(null); };
  const saveEdit = () => {
    setServicos(ss => ss.map(s=>({...s, itens: s.itens.map(it=>it.id===draft.id?draft:it)})));
    setEditing(null); setDraft(null);
  };
  const addItem = (secao) => {
    const newItem = {id:Date.now(),nome:"Novo serviço",orcado:0,provisionado:0,realizado:0,obs:""};
    setServicos(ss=>ss.map(s=>s.secao===secao?{...s,itens:[...s.itens,newItem]}:s));
  };
  const deleteItem = (secao, itemId) => {
    setServicos(ss=>ss.map(s=>s.secao===secao?{...s,itens:s.itens.filter(it=>it.id!==itemId)}:s));
  };

  const IS = iSty(T);
  const COLS = ["Serviço","Orçado","Provisionado","Realizado","Saving","% Exec.","Progresso","Obs",""];

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,marginBottom:24}}>
        <KPI label="Total Orçado" value={fmt(totOrc)}  sub="Serviços fixos aprovados" color="#22c55e" T={T}/>
        <KPI label="Provisionado" value={fmt(totProv)} sub="Estimativa de gasto" color="#3b82f6" T={T}/>
        <KPI label="Realizado"    value={fmt(totReal)} sub={`${totOrc?((totReal/totOrc)*100).toFixed(1):0}% executado`} color="#f59e0b" T={T}/>
        <KPI label="Saving"       value={fmt(totOrc-totReal)} sub="Orçado - Realizado" color={(totOrc-totReal)>=0?"#a3e635":"#ef4444"} T={T}/>
      </div>

      {servicos.map(({secao, itens})=>{
        const sOrc  = itens.reduce((s,x)=>s+x.orcado,0);
        const sProv = itens.reduce((s,x)=>s+x.provisionado,0);
        const sReal = itens.reduce((s,x)=>s+x.realizado,0);
        const cor   = SECAO_COLORS[secao]||"#8b5cf6";
        return(
          <div key={secao} style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"12px 20px",background:T.bg,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{width:4,height:20,background:cor,borderRadius:2,display:"inline-block"}}/>
                <span style={{fontWeight:700,fontSize:15,color:cor}}>{secao}</span>
              </div>
              <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:12,fontSize:12,flexWrap:"wrap"}}>
                  <span style={{color:T.textMd}}>Orç: <b style={{color:"#22c55e"}}>{fmt(sOrc)}</b></span>
                  <span style={{color:T.textMd}}>Prov: <b style={{color:"#3b82f6"}}>{fmt(sProv)}</b></span>
                  <span style={{color:T.textMd}}>Real: <b style={{color:"#f59e0b"}}>{fmt(sReal)}</b></span>
                  <span style={{color:T.textMd}}>Saving: <b style={{color:(sOrc-sReal)>=0?"#a3e635":"#ef4444"}}>{fmt(sOrc-sReal)}</b></span>
                </div>
                <button onClick={()=>addItem(secao)} style={{...btnStyle,background:cor+"33",color:cor,padding:"4px 12px",fontSize:11}}>+ item</button>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                <thead><tr style={{background:T.bg,borderTop:`1px solid ${T.card}`}}>
                  {COLS.map(h=><th key={h} style={{padding:"8px 14px",textAlign:h==="Serviço"||h==="Obs"||h===""?"left":"right",color:T.muted,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {itens.map(item=>{
                    const isEd = editing===item.id;
                    const row  = isEd ? draft : item;
                    const sv   = row.orcado - row.realizado;
                    const pct  = row.orcado ? Math.min(100,(row.realizado/row.orcado)*100) : 0;
                    return(
                      <tr key={item.id} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:"10px 14px",fontWeight:600,fontSize:13,color:T.text}}>
                          {isEd ? <input value={draft.nome} onChange={e=>setDraft(d=>({...d,nome:e.target.value}))} style={{...IS,width:220}}/> : row.nome}
                        </td>
                        {["orcado","provisionado","realizado"].map(k=>{
                          const col=k==="orcado"?"#22c55e":k==="provisionado"?"#3b82f6":"#f59e0b";
                          return(
                            <td key={k} style={{padding:"10px 14px",textAlign:"right"}}>
                              {isEd
                                ?<input value={draft[k]} onChange={e=>setDraft(d=>({...d,[k]:parseFloat(e.target.value)||0}))}
                                    style={{...IS,width:110,textAlign:"right",color:col}}/>
                                :<span style={{color:row[k]===0?T.muted:col}}>{fmt(row[k])}</span>}
                            </td>
                          );
                        })}
                        <td style={{padding:"10px 14px",textAlign:"right",fontWeight:700,color:sv>=0?"#a3e635":"#ef4444"}}>{fmt(sv)}</td>
                        <td style={{padding:"10px 14px",textAlign:"right",fontSize:12,color:T.textMd}}>{pct.toFixed(1)}%</td>
                        <td style={{padding:"10px 14px",minWidth:90}}>
                          <div style={{background:T.border,borderRadius:4,height:6}}>
                            <div style={{background:pct>90?"#ef4444":pct>60?"#f59e0b":"#22c55e",width:`${pct}%`,height:"100%",borderRadius:4}}/>
                          </div>
                        </td>
                        <td style={{padding:"10px 14px",color:T.textSm,fontSize:12,maxWidth:200}}>
                          {isEd ? <input value={draft.obs} onChange={e=>setDraft(d=>({...d,obs:e.target.value}))} style={{...IS,width:160}}/> : row.obs}
                        </td>
                        <td style={{padding:"10px 14px"}}>
                          {isEd
                            ?<div style={{display:"flex",gap:6}}>
                                <button onClick={cancelEdit} style={{...btnStyle,background:"#475569",padding:"4px 10px",fontSize:11}}>✕</button>
                                <button onClick={saveEdit}   style={{...btnStyle,background:"#22c55e",padding:"4px 10px",fontSize:11}}>✓</button>
                              </div>
                            :<div style={{display:"flex",gap:6}}>
                                <button onClick={()=>startEdit(item)} style={{...btnStyle,background:T.border,padding:"4px 10px",fontSize:11}}>✏</button>
                                <button onClick={()=>deleteItem(secao,item.id)} style={{...btnStyle,background:"#7f1d1d",padding:"4px 10px",fontSize:11}}>🗑</button>
                              </div>}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:`2px solid ${T.border}`,background:T.bg,fontWeight:700}}>
                    <td style={{padding:"10px 14px",color:cor}}>Total {secao}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:"#22c55e"}}>{fmt(sOrc)}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:"#3b82f6"}}>{fmt(sProv)}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:"#f59e0b"}}>{fmt(sReal)}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:(sOrc-sReal)>=0?"#a3e635":"#ef4444"}}>{fmt(sOrc-sReal)}</td>
                    <td colSpan={4}/>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div style={{background:T.card,borderRadius:12,padding:"14px 20px",display:"flex",justifyContent:"flex-end",gap:32,flexWrap:"wrap"}}>
        <span style={{color:T.textMd,fontWeight:700}}>TOTAL GERAL</span>
        <span style={{color:"#22c55e",fontWeight:700}}>{fmt(totOrc)}</span>
        <span style={{color:"#3b82f6",fontWeight:700}}>{fmt(totProv)}</span>
        <span style={{color:"#f59e0b",fontWeight:700}}>{fmt(totReal)}</span>
        <span style={{color:(totOrc-totReal)>=0?"#a3e635":"#ef4444",fontWeight:700}}>{fmt(totOrc-totReal)}</span>
      </div>
    </div>
  );
}

const CENARIO_INFO = {
  b1:    {label:"B1 Sudeste",  color:"#22c55e", total:159476, cat:"B1", regiao:"sudeste"},
  b2s:   {label:"B2 Sudeste",  color:"#3b82f6", total:100976, cat:"B2", regiao:"sudeste"},
  b2sul: {label:"B2 Sul",      color:"#f59e0b", total:118296, cat:"B2", regiao:"sul"},
};

function NovoRapidoModal({cenario, jogos, onSave, onClose, T}){
  const info = CENARIO_INFO[cenario];
  const proximaRodada = Math.max(0,...jogos.filter(j=>j.mandante!=="A definir").map(j=>j.rodada)) + 1;
  const [form,setForm] = useState({
    mandante:"", visitante:"", rodada:String(proximaRodada),
    cidade:"", data:"", hora:"", detentor:"A definir"
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const IS = iSty(T);

  const field = (label,key,opts=null) => (
    <div style={{marginBottom:12}}>
      <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>{label}</label>
      {opts
        ?<select value={form[key]} onChange={e=>set(key,e.target.value)} style={IS}>{opts.map(o=><option key={o}>{o}</option>)}</select>
        :<input value={form[key]} onChange={e=>set(key,e.target.value)} style={IS}/>}
    </div>
  );

  const handleSave = () => {
    if(!form.mandante||!form.visitante) return;
    const defs = getDefaults(info.cat, info.regiao);
    onSave({...form, id:Date.now(), rodada:parseInt(form.rodada)||0,
      categoria:info.cat, regiao:info.regiao,
      orcado:{...defs}, provisionado:{...defs}, realizado:{...allSubKeys()}});
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{background:T.card,borderRadius:16,padding:28,width:"100%",maxWidth:440,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{width:4,height:28,background:info.color,borderRadius:2}}/>
          <div>
            <h3 style={{margin:0,fontSize:16,color:T.text}}>Novo Jogo — {info.label}</h3>
            <p style={{margin:"4px 0 0",fontSize:12,color:T.textSm}}>Orçado automático: <b style={{color:info.color}}>{fmt(info.total)}</b></p>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          {field("Mandante","mandante",TIMES)}
          {field("Visitante","visitante",TIMES)}
          {field("Rodada","rodada")}
          {field("Data","data")}
          {field("Hora","hora")}
          {field("Cidade","cidade",CIDADES)}
          {field("Detentor","detentor",DETENTORES)}
        </div>
        <div style={{background:T.bg,borderRadius:8,padding:"10px 14px",marginTop:4,marginBottom:16}}>
          <p style={{color:T.textSm,fontSize:11,margin:"0 0 6px"}}>Valores que serão aplicados:</p>
          <div style={{display:"flex",gap:16,fontSize:12,flexWrap:"wrap"}}>
            <span style={{color:T.textMd}}>Logística: <b style={{color:"#22c55e"}}>{fmt(["outros_log","transporte","uber","hospedagem","diaria"].reduce((s,k)=>s+(getDefaults(info.cat,info.regiao)[k]||0),0))}</b></span>
            <span style={{color:T.textMd}}>Pessoal: <b style={{color:"#3b82f6"}}>{fmt(Object.keys(PESSOAL).reduce((s,k)=>s+(PESSOAL[k]||0),0))}</b></span>
            <span style={{color:T.textMd}}>Operações: <b style={{color:"#f59e0b"}}>{fmt(info.total - ["outros_log","transporte","uber","hospedagem","diaria",...Object.keys(PESSOAL)].reduce((s,k)=>s+(getDefaults(info.cat,info.regiao)[k]||0),0))}</b></span>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{...btnStyle,background:"#475569"}}>Cancelar</button>
          <button onClick={handleSave} style={{...btnStyle,background:info.color,color:cenario==="b2sul"?"#000":"#fff"}}>Adicionar Jogo</button>
        </div>
      </div>
    </div>
  );
}

function NovoJogoModal({onSave,onClose,T}){
  const [form,setForm]=useState({mandante:"",visitante:"",rodada:"",cidade:"",data:"",hora:"",categoria:"B1",regiao:"Sudeste",detentor:"A definir"});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const IS = iSty(T);
  const field=(label,key,opts=null)=>(
    <div style={{marginBottom:12}}>
      <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>{label}</label>
      {opts?<select value={form[key]} onChange={e=>set(key,e.target.value)} style={IS}>{opts.map(o=><option key={o}>{o}</option>)}</select>
           :<input value={form[key]} onChange={e=>set(key,e.target.value)} style={IS}/>}
    </div>
  );
  const handleSave=()=>{
    if(!form.mandante||!form.visitante) return;
    const defs=getDefaults(form.categoria, form.regiao==="Sul"?"sul":"sudeste");
    onSave({...form,id:Date.now(),rodada:parseInt(form.rodada)||0,
      orcado:{...defs},provisionado:{...defs},realizado:{...allSubKeys()}});
  };
  return(
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{background:T.card,borderRadius:16,padding:28,width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto"}}>
        <h3 style={{margin:"0 0 20px",fontSize:16,color:T.text}}>Novo Jogo</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          {field("Mandante","mandante",TIMES)}{field("Visitante","visitante",TIMES)}
          {field("Rodada","rodada")}{field("Data","data")}
          {field("Hora","hora")}{field("Cidade","cidade",CIDADES)}
          {field("Categoria","categoria",["B1","B2"])}{field("Região","regiao",["Sudeste","Sul"])}
          {field("Detentor","detentor",DETENTORES)}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <button onClick={onClose} style={{...btnStyle,background:"#475569"}}>Cancelar</button>
          <button onClick={handleSave} style={{...btnStyle,background:"#22c55e"}}>Adicionar</button>
        </div>
      </div>
    </div>
  );
}

function VisaoMicro({jogos,jogoId,onChangeJogo,onSave,T}){
  const divulgados=jogos.filter(j=>j.mandante!=="A definir");
  const idx=divulgados.findIndex(j=>j.id===jogoId);
  const jogo=divulgados[idx];
  const [draft,setDraft]=useState(null);
  const [editing,setEditing]=useState(false);
  const [activeTab,setActiveTab]=useState("orcado");

  const setVal=(tipo,subkey,v)=>setDraft(d=>({...d,[tipo]:{...d[tipo],[subkey]:parseFloat(v)||0}}));
  const startEdit=()=>{setDraft(JSON.parse(JSON.stringify(jogo)));setEditing(true);};
  const cancelEdit=()=>{setDraft(null);setEditing(false);};
  const saveEdit=()=>{onSave(draft);setEditing(false);setDraft(null);};
  const copyOrcadoToProvisionado=()=>{
    if(!draft) return;
    setDraft(d=>({...d,provisionado:{...d.orcado}}));
  };

  const data=editing?draft:jogo;
  const IS = iSty(T);
  if(!jogo) return <p style={{color:T.textSm,padding:20}}>Nenhum jogo selecionado.</p>;

  const totOrc=subTotal(data.orcado), totProv=subTotal(data.provisionado), totReal=subTotal(data.realizado);

  // Radar-style comparison for the 3 columns
  const compareTabs = ["orcado","provisionado","realizado"];
  const compareColors = {"orcado":"#22c55e","provisionado":"#3b82f6","realizado":"#f59e0b"};
  const compareTotals = {"orcado":totOrc,"provisionado":totProv,"realizado":totReal};

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>idx>0&&onChangeJogo(divulgados[idx-1].id)} disabled={idx===0}
            style={{...btnStyle,background:idx===0?T.card:T.border,padding:"6px 14px",opacity:idx===0?0.4:1,color:T.text}}>←</button>
          <select value={jogoId} onChange={e=>onChangeJogo(parseInt(e.target.value))}
            style={{...IS,width:"auto",padding:"7px 14px",fontWeight:600,maxWidth:"60vw"}}>
            {divulgados.map(j=><option key={j.id} value={j.id}>Rd {j.rodada} · {j.mandante} x {j.visitante}</option>)}
          </select>
          <button onClick={()=>idx<divulgados.length-1&&onChangeJogo(divulgados[idx+1].id)} disabled={idx===divulgados.length-1}
            style={{...btnStyle,background:idx===divulgados.length-1?T.card:T.border,padding:"6px 14px",opacity:idx===divulgados.length-1?0.4:1,color:T.text}}>→</button>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {!editing
            ?<button onClick={startEdit} style={{...btnStyle,background:"#3b82f6"}}>✏ Editar valores</button>
            :<>
               {activeTab==="provisionado"&&<button onClick={copyOrcadoToProvisionado} style={{...btnStyle,background:"#6366f1",fontSize:12}}>↓ Copiar Orçado</button>}
               <button onClick={cancelEdit} style={{...btnStyle,background:"#475569"}}>Cancelar</button>
               <button onClick={saveEdit} style={{...btnStyle,background:"#22c55e"}}>💾 Salvar</button>
             </>}
        </div>
      </div>

      <div style={{background:T.card,borderRadius:12,padding:"18px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <h2 style={{margin:"0 0 6px",fontSize:20,color:T.text}}>{data.mandante} x {data.visitante}</h2>
            <p style={{color:T.textMd,fontSize:13,margin:0}}>Rodada {data.rodada} · {data.cidade} · {data.data} {data.hora} · {data.detentor}</p>
          </div>
          <Pill label={data.categoria} color={data.categoria==="B1"?"#22c55e":"#f59e0b"}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginTop:18}}>
          {[
            {label:"Orçado",value:fmt(totOrc),color:"#22c55e"},
            {label:"Provisionado",value:fmt(totProv),color:"#3b82f6"},
            {label:"Realizado",value:fmt(totReal),color:"#f59e0b"},
            {label:"Saving",value:fmt(totOrc-totReal),color:(totOrc-totReal)>=0?"#a3e635":"#ef4444"},
          ].map(k=>(
            <div key={k.label} style={{background:T.bg,borderRadius:8,padding:"12px 16px",borderTop:`3px solid ${k.color}`}}>
              <p style={{color:T.textSm,fontSize:11,margin:"0 0 4px"}}>{k.label}</p>
              <p style={{color:k.color,fontWeight:700,fontSize:16,margin:0}}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tab toggle for which column to focus when editing */}
      {editing && (
        <div style={{display:"flex",gap:4,marginBottom:16}}>
          {compareTabs.map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)} style={{padding:"6px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
              background:activeTab===t?compareColors[t]:T.card,color:activeTab===t?"#fff":T.textMd,textTransform:"capitalize"}}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
      )}

      {CATS.map(cat=>{
        const cOrc=catTotal(data.orcado,cat), cProv=catTotal(data.provisionado,cat), cReal=catTotal(data.realizado,cat);
        return(
          <div key={cat.key} style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"12px 20px",background:T.bg,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <span style={{fontWeight:700,fontSize:14,color:cat.color}}>{cat.label}</span>
              <div style={{display:"flex",gap:16,fontSize:12,flexWrap:"wrap"}}>
                <span style={{color:T.textMd}}>Orç: <b style={{color:"#22c55e"}}>{fmt(cOrc)}</b></span>
                <span style={{color:T.textMd}}>Prov: <b style={{color:"#3b82f6"}}>{fmt(cProv)}</b></span>
                <span style={{color:T.textMd}}>Real: <b style={{color:"#f59e0b"}}>{fmt(cReal)}</b></span>
                <span style={{color:T.textMd}}>Saving: <b style={{color:(cOrc-cReal)>=0?"#a3e635":"#ef4444"}}>{fmt(cOrc-cReal)}</b></span>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:400}}>
                <thead><tr style={{background:T.bg,borderTop:`1px solid ${T.card}`}}>
                  {["Item","Orçado","Provisionado","Realizado","Saving"].map(h=>(
                    <th key={h} style={{padding:"8px 20px",textAlign:h==="Item"?"left":"right",color:T.muted,fontSize:11}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {cat.subs.map(sub=>{
                    const o=data.orcado?.[sub.key]||0,p=data.provisionado?.[sub.key]||0,r=data.realizado?.[sub.key]||0;
                    if(!editing&&o===0&&p===0&&r===0) return null;
                    return(
                      <tr key={sub.key} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:"10px 20px",fontSize:13,color:T.text}}>{sub.label}</td>
                        {["orcado","provisionado","realizado"].map(tipo=>{
                          const val=data[tipo]?.[sub.key]||0;
                          const col=tipo==="orcado"?"#22c55e":tipo==="provisionado"?"#3b82f6":"#f59e0b";
                          const isActive = !editing || activeTab===tipo;
                          return(
                            <td key={tipo} style={{padding:"8px 20px",textAlign:"right",opacity:editing&&!isActive?0.35:1}}>
                              {editing&&isActive
                                ?<input value={draft[tipo]?.[sub.key]||0} onChange={e=>setVal(tipo,sub.key,e.target.value)}
                                    style={{...IS,width:90,textAlign:"right",padding:"4px 8px",color:col}}/>
                                :<span style={{fontSize:13,color:val===0?T.muted:col}}>{fmt(val)}</span>}
                            </td>
                          );
                        })}
                        <td style={{padding:"10px 20px",textAlign:"right",fontWeight:600,color:(o-r)>=0?"#a3e635":"#ef4444",fontSize:13}}>{fmt(o-r)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:`2px solid ${T.border}`,background:T.bg,fontWeight:700}}>
                    <td style={{padding:"10px 20px",fontSize:13,color:T.text}}>Total {cat.label}</td>
                    <td style={{padding:"10px 20px",textAlign:"right",color:"#22c55e"}}>{fmt(cOrc)}</td>
                    <td style={{padding:"10px 20px",textAlign:"right",color:"#3b82f6"}}>{fmt(cProv)}</td>
                    <td style={{padding:"10px 20px",textAlign:"right",color:"#f59e0b"}}>{fmt(cReal)}</td>
                    <td style={{padding:"10px 20px",textAlign:"right",color:(cOrc-cReal)>=0?"#a3e635":"#ef4444"}}>{fmt(cOrc-cReal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App(){
  const [jogos,setJogos]       = useState(ALL_JOGOS);
  const [servicos,setServicos] = useState(SERVICOS_INIT);
  const [darkMode,setDarkMode] = useState(true);
  const [storageReady, setStorageReady] = useState(false);

  // Carregar dados salvos ao iniciar
  useState(()=>{
    (async()=>{
      try {
        const sJogos = await window.storage.get("bra2026:jogos");
        if(sJogos) setJogos(JSON.parse(sJogos.value));
      } catch(_){}
      try {
        const sServicos = await window.storage.get("bra2026:servicos");
        if(sServicos) setServicos(JSON.parse(sServicos.value));
      } catch(_){}
      try {
        const sDark = await window.storage.get("bra2026:darkMode");
        if(sDark) setDarkMode(JSON.parse(sDark.value));
      } catch(_){}
      setStorageReady(true);
    })();
  });

  // Persistir jogos sempre que mudar
  const setJogosP = (fn) => {
    setJogos(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      window.storage.set("bra2026:jogos", JSON.stringify(next)).catch(()=>{});
      return next;
    });
  };

  // Persistir serviços sempre que mudar
  const setServicosP = (fn) => {
    setServicos(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      window.storage.set("bra2026:servicos", JSON.stringify(next)).catch(()=>{});
      return next;
    });
  };

  // Persistir dark mode
  const setDarkModeP = (fn) => {
    setDarkMode(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      window.storage.set("bra2026:darkMode", JSON.stringify(next)).catch(()=>{});
      return next;
    });
  };

  const T = darkMode ? DARK : LIGHT;

  // Variáveis calculadas dinamicamente dos jogos
  const varCalc = useMemo(() => {
    const allJogos = jogos.filter(j => j.mandante !== "A definir"); // só jogos divulgados
    const result = CATS.map(cat => {
      const orc  = allJogos.reduce((s,j) => s + catTotal(j.orcado, cat), 0);
      const prov = allJogos.reduce((s,j) => s + catTotal(j.provisionado, cat), 0);
      const real = allJogos.reduce((s,j) => s + catTotal(j.realizado, cat), 0);
      return { nome: cat.label, orcado: orc, provisionado: prov, realizado: real, tipo: "variavel" };
    });
    // Extra: sub-item "extra" já está dentro de Operações; linha separada para visibilidade
    const extraOrc  = allJogos.reduce((s,j) => s + (j.orcado?.extra||0), 0);
    const extraProv = allJogos.reduce((s,j) => s + (j.provisionado?.extra||0), 0);
    const extraReal = allJogos.reduce((s,j) => s + (j.realizado?.extra||0), 0);
    result.push({ nome: "Extra", orcado: extraOrc, provisionado: extraProv, realizado: extraReal, tipo: "variavel" });
    return result;
  }, [jogos]);

  // Fixos calculados da aba Serviços
  const fixosCalc = useMemo(() => {
    return servicos.map(secao => ({
      nome:         secao.secao,
      orcado:       secao.itens.reduce((t,i) => t + i.orcado, 0),
      provisionado: secao.itens.reduce((t,i) => t + i.provisionado, 0),
      realizado:    secao.itens.reduce((t,i) => t + i.realizado, 0),
      tipo: "fixo"
    }));
  }, [servicos]);

  const RESUMO_CATS = [...varCalc, ...fixosCalc];
  const [tab,setTab]           = useState("dashboard");
  const [showNovo,setNovo]     = useState(false);
  const [novoRapido,setNovoRapido] = useState(null);
  const [filtroRod,setFiltroRod]     = useState("Todas");
  const [filtroCat,setFiltroCat]     = useState("Todas");
  const [showPlaceholder,setShowPlaceholder] = useState(false);
  const [microJogoId,setMicroJogoId] = useState(JOGOS_REAIS[0].id);

  const saveJogo=j=>setJogosP(js=>js.map(x=>x.id===j.id?j:x));
  const addJogo=j=>{setJogosP(js=>[...js,j]);setNovo(false);setNovoRapido(null);};

  const totalOrc  = RESUMO_CATS.reduce((s,c)=>s+c.orcado,0);
  const totalProv = RESUMO_CATS.reduce((s,c)=>s+c.provisionado,0);
  const totalReal = RESUMO_CATS.reduce((s,c)=>s+c.realizado,0);
  const pctGasto  = totalOrc?((totalReal/totalOrc)*100).toFixed(1):0;

  const divulgados=jogos.filter(j=>j.mandante!=="A definir");
  const aDivulgar=jogos.filter(j=>j.mandante==="A definir");
  const rodadasList=["Todas",...Array.from(new Set(divulgados.map(j=>j.rodada))).sort((a,b)=>a-b).map(String)];
  const filtrados=(showPlaceholder?jogos:divulgados).filter(j=>
    (filtroRod==="Todas"||j.rodada===parseInt(filtroRod))&&
    (filtroCat==="Todas"||j.categoria===filtroCat)
  );

  const savingRodada=useMemo(()=>{
    const map={};
    divulgados.forEach(j=>{
      const r=`R${j.rodada}`;
      if(!map[r]) map[r]={name:r,"Saving Prov.":0,"Saving Real.":0};
      map[r]["Saving Prov."]+=subTotal(j.orcado)-subTotal(j.provisionado);
      map[r]["Saving Real."]+=subTotal(j.orcado)-subTotal(j.realizado);
    });
    return Object.values(map).sort((a,b)=>parseInt(a.name.slice(1))-parseInt(b.name.slice(1)));
  },[jogos]);

  const jogosFiltered=divulgados.filter(j=>
    (filtroRod==="Todas"||j.rodada===parseInt(filtroRod))&&
    (filtroCat==="Todas"||j.categoria===filtroCat)
  );
  const totOrcJogos=jogosFiltered.reduce((s,j)=>s+subTotal(j.orcado),0);
  const totProvJogos=jogosFiltered.reduce((s,j)=>s+subTotal(j.provisionado),0);
  const totRealJogos=jogosFiltered.reduce((s,j)=>s+subTotal(j.realizado),0);

  const TABS=["dashboard","serviços","jogos","micro","savings","gráficos","relatório"];

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Inter',sans-serif",paddingBottom:40}}>
      {/* Cabeçalho */}
      <div style={{background:"linear-gradient(135deg,#166534,#15803d,#166534)",padding:"22px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
          <div>
            <p style={{color:"#86efac",fontSize:11,letterSpacing:2,textTransform:"uppercase",margin:"0 0 4px"}}>FFU — Transmissões</p>
            <h1 style={{fontSize:21,fontWeight:700,margin:0,color:"#fff"}}>Brasileirão Série A 2026</h1>
            <p style={{color:"#bbf7d0",fontSize:12,margin:"4px 0 0"}}>{divulgados.length} jogos divulgados · {aDivulgar.length} a divulgar · 38 rodadas</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <button
              onClick={()=>setDarkModeP(d=>!d)}
              style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:13,color:"#fff",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
              {darkMode ? "☀️ Claro" : "🌙 Escuro"}
            </button>
            <div style={{textAlign:"right"}}>
              <p style={{color:"#86efac",fontSize:11,margin:"0 0 2px"}}>Execução geral</p>
              <p style={{fontSize:30,fontWeight:800,color:pctGasto>80?"#fca5a5":"#86efac",margin:0}}>{pctGasto}%</p>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:2,marginTop:16,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:0}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"8px 16px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",whiteSpace:"nowrap",
              background:tab===t?T.bg:"rgba(255,255,255,0.12)",
              color:tab===t?"#22c55e":"#e2e8f0",
              fontWeight:tab===t?700:400,fontSize:13,textTransform:"capitalize",flexShrink:0
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"24px 16px"}}>

        {tab==="dashboard"&&(<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:24}}>
            <KPI label="Total Orçado" value={fmt(totalOrc)} sub="Jogos + serviços fixos" color="#22c55e" T={T}/>
            <KPI label="Total Provisionado" value={fmt(totalProv)} sub={`${totalOrc?((totalProv/totalOrc)*100).toFixed(1):0}% do orçado`} color="#3b82f6" T={T}/>
            <KPI label="Total Realizado" value={fmt(totalReal)} sub={`${pctGasto}% executado`} color="#f59e0b" T={T}/>
            <KPI label="Saldo Disponível" value={fmt(totalOrc-totalReal)} sub="Orçado - Realizado" color={(totalOrc-totalReal)>=0?"#a3e635":"#ef4444"} T={T}/>
          </div>

          <div style={{background:T.card,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <h3 style={{margin:0,fontSize:14,color:T.textMd}}>Resumo por Categoria</h3>
              <div style={{display:"flex",gap:12,fontSize:12,color:T.textMd}}>
                <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"#6366f1",marginRight:4}}/>Fixo</span>
                <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"#f43f5e",marginRight:4}}/>Variável</span>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
                <thead><tr style={{background:T.bg}}>
                  {["Categoria","Tipo","Orçado","Provisionado","Realizado","Saldo","% Exec.","Progresso"].map(h=>
                    <th key={h} style={{padding:"10px 16px",textAlign:h==="Categoria"||h==="Tipo"?"left":"right",color:T.textSm,fontSize:12,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {RESUMO_CATS.map(c=>{
                    const saldo=c.orcado-c.realizado;
                    const pct=c.orcado?Math.min(100,(c.realizado/c.orcado)*100):0;
                    return(
                      <tr key={c.nome} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:"12px 16px",fontWeight:600,whiteSpace:"nowrap",color:T.text}}>{c.nome}</td>
                        <td style={{padding:"12px 16px"}}><Pill label={c.tipo} color={TIPO_COLOR[c.tipo]}/></td>
                        <td style={{padding:"12px 16px",textAlign:"right",whiteSpace:"nowrap",color:T.text}}>{fmt(c.orcado)}</td>
                        <td style={{padding:"12px 16px",textAlign:"right",color:"#3b82f6",whiteSpace:"nowrap"}}>{fmt(c.provisionado||0)}</td>
                        <td style={{padding:"12px 16px",textAlign:"right",color:"#f59e0b",whiteSpace:"nowrap"}}>{fmt(c.realizado)}</td>
                        <td style={{padding:"12px 16px",textAlign:"right",fontWeight:600,color:saldo<0?"#ef4444":"#22c55e",whiteSpace:"nowrap"}}>{fmt(saldo)}</td>
                        <td style={{padding:"12px 16px",textAlign:"right",color:T.text}}>{pct.toFixed(1)}%</td>
                        <td style={{padding:"12px 20px"}}>
                          <div style={{background:T.border,borderRadius:4,height:8,minWidth:60}}>
                            <div style={{background:pct>90?"#ef4444":pct>60?"#f59e0b":"#22c55e",width:`${pct}%`,height:"100%",borderRadius:4}}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:`2px solid ${T.muted}`,background:T.bg,fontWeight:700}}>
                    <td colSpan={2} style={{padding:"12px 16px",color:T.text}}>TOTAL GERAL</td>
                    <td style={{padding:"12px 16px",textAlign:"right",color:"#22c55e",whiteSpace:"nowrap"}}>{fmt(totalOrc)}</td>
                    <td style={{padding:"12px 16px",textAlign:"right",color:"#3b82f6",whiteSpace:"nowrap"}}>{fmt(totalProv)}</td>
                    <td style={{padding:"12px 16px",textAlign:"right",color:"#f59e0b",whiteSpace:"nowrap"}}>{fmt(totalReal)}</td>
                    <td style={{padding:"12px 16px",textAlign:"right",color:(totalOrc-totalReal)>=0?"#22c55e":"#ef4444",whiteSpace:"nowrap"}}>{fmt(totalOrc-totalReal)}</td>
                    <td style={{padding:"12px 16px",textAlign:"right",color:T.text}}>{pctGasto}%</td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>)}

        {tab==="jogos"&&(<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {rodadasList.map(r=>(
                <button key={r} onClick={()=>setFiltroRod(r)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,
                  background:filtroRod===r?"#22c55e":T.card,color:filtroRod===r?"#fff":T.textMd}}>
                  {r==="Todas"?"Todas":`Rd ${r}`}
                </button>
              ))}
              <div style={{width:1,background:T.border,margin:"0 4px"}}/>
              {["Todas","B1","B2"].map(c=>(
                <button key={c} onClick={()=>setFiltroCat(c)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,
                  background:filtroCat===c?"#f59e0b":T.card,color:filtroCat===c?"#000":T.textMd}}>
                  {c==="Todas"?"B1+B2":c}
                </button>
              ))}
              <button onClick={()=>setShowPlaceholder(p=>!p)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,
                background:showPlaceholder?"#8b5cf6":T.card,color:showPlaceholder?"#fff":T.textMd}}>
                {showPlaceholder?"Ocultar a divulgar":"Ver a divulgar"}
              </button>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={()=>setNovoRapido("b1")} style={{...btnStyle,background:"#22c55e",fontSize:12}}>+ B1 Sudeste</button>
              <button onClick={()=>setNovoRapido("b2s")} style={{...btnStyle,background:"#3b82f6",fontSize:12}}>+ B2 Sudeste</button>
              <button onClick={()=>setNovoRapido("b2sul")} style={{...btnStyle,background:"#f59e0b",color:"#000",fontSize:12}}>+ B2 Sul</button>
              <button onClick={()=>setNovo(true)} style={{...btnStyle,background:"#475569",fontSize:12}}>+ Personalizado</button>
            </div>
          </div>
          <div style={{background:T.card,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,color:T.textSm,fontSize:12}}>{filtrados.length} jogos</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                <thead><tr style={{background:T.bg}}>
                  {["Jogo","Rd","Cidade","Data","Cat.","Detentor","Orçado","Provisionado","Realizado","Saving",""].map(h=>
                    <th key={h} style={{padding:"10px 12px",textAlign:"left",color:T.textSm,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filtrados.map(j=>{
                    const o=subTotal(j.orcado),p=subTotal(j.provisionado),r=subTotal(j.realizado);
                    const isDef=j.mandante==="A definir";
                    return(
                      <tr key={j.id} style={{borderTop:`1px solid ${T.border}`,opacity:isDef?0.45:1}}>
                        <td style={{padding:"10px 12px",fontWeight:600,fontSize:13,whiteSpace:"nowrap",color:T.text}}>
                          {isDef?<span style={{color:T.textSm,fontStyle:"italic"}}>A divulgar</span>:`${j.mandante} x ${j.visitante}`}
                        </td>
                        <td style={{padding:"10px 12px",color:T.textMd,fontSize:12}}>{j.rodada}</td>
                        <td style={{padding:"10px 12px",color:T.textMd,fontSize:12,whiteSpace:"nowrap"}}>{j.cidade}</td>
                        <td style={{padding:"10px 12px",color:T.textMd,fontSize:12,whiteSpace:"nowrap"}}>{j.data}</td>
                        <td style={{padding:"10px 12px"}}><Pill label={j.categoria} color={j.categoria==="B1"?"#22c55e":"#f59e0b"}/></td>
                        <td style={{padding:"10px 12px",fontSize:11,color:T.textMd,whiteSpace:"nowrap"}}>{j.detentor}</td>
                        <td style={{padding:"10px 12px",fontSize:13,whiteSpace:"nowrap",color:T.text}}>{fmtK(o)}</td>
                        <td style={{padding:"10px 12px",fontSize:13,color:"#3b82f6",whiteSpace:"nowrap"}}>{fmtK(p)}</td>
                        <td style={{padding:"10px 12px",fontSize:13,color:"#f59e0b",whiteSpace:"nowrap"}}>{fmtK(r)}</td>
                        <td style={{padding:"10px 12px",fontWeight:600,color:(o-p)>=0?"#22c55e":"#ef4444",whiteSpace:"nowrap"}}>{fmtK(o-p)}</td>
                        <td style={{padding:"10px 12px"}}>
                          <button onClick={()=>{setMicroJogoId(j.id);setTab("micro");}}
                            style={{...btnStyle,background:"#1d4ed8",padding:"4px 10px",fontSize:11}}>🔍</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>)}

        {tab==="micro"&&(
          <VisaoMicro jogos={jogos} jogoId={microJogoId} onChangeJogo={setMicroJogoId} onSave={saveJogo} T={T}/>
        )}

        {tab==="serviços"&&(
          <TabServicos servicos={servicos} setServicos={setServicosP} T={T}/>
        )}

        {tab==="savings"&&(<>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
            {["Todas",...Array.from(new Set(divulgados.map(j=>j.rodada))).sort((a,b)=>a-b).map(String)].map(r=>(
              <button key={r} onClick={()=>setFiltroRod(r)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,
                background:filtroRod===r?"#22c55e":T.card,color:filtroRod===r?"#fff":T.textMd}}>
                {r==="Todas"?"Todas":`Rd ${r}`}
              </button>
            ))}
            <div style={{width:1,background:T.border,margin:"0 4px"}}/>
            {["Todas","B1","B2"].map(c=>(
              <button key={c} onClick={()=>setFiltroCat(c)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,
                background:filtroCat===c?"#f59e0b":T.card,color:filtroCat===c?"#000":T.textMd}}>
                {c==="Todas"?"B1+B2":c}
              </button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:24}}>
            <KPI label="Saving Provisionado" value={fmt(totOrcJogos-totProvJogos)} sub={`em ${divulgados.length} jogos`} color="#3b82f6" T={T}/>
            <KPI label="Saving Realizado" value={fmt(totOrcJogos-totRealJogos)} sub="Confirmado" color="#22c55e" T={T}/>
            <KPI label="% Saving Prov." value={totOrcJogos?`${(((totOrcJogos-totProvJogos)/totOrcJogos)*100).toFixed(1)}%`:"—"} sub="do budget" color="#f59e0b" T={T}/>
            <KPI label="Custo Médio / Jogo" value={jogosFiltered.length?fmt(totOrcJogos/jogosFiltered.length):"—"} sub="orçado" color="#8b5cf6" T={T}/>
          </div>
          <div style={{background:T.card,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
              <h3 style={{margin:0,fontSize:14,color:T.textMd}}>Saving por Jogo</h3>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                <thead><tr style={{background:T.bg}}>
                  {["Jogo","Rd","Cat.","Orçado","Provisionado","Saving Prov.","Realizado","Saving Real."].map(h=>
                    <th key={h} style={{padding:"10px 14px",textAlign:"left",color:T.textSm,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {jogosFiltered.map(j=>{
                    const o=subTotal(j.orcado),p=subTotal(j.provisionado),r=subTotal(j.realizado);
                    return(
                      <tr key={j.id} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:"10px 14px",fontWeight:600,fontSize:13,whiteSpace:"nowrap",color:T.text}}>{j.mandante} x {j.visitante}</td>
                        <td style={{padding:"10px 14px",color:T.textMd}}>{j.rodada}</td>
                        <td style={{padding:"10px 14px"}}><Pill label={j.categoria} color={j.categoria==="B1"?"#22c55e":"#f59e0b"}/></td>
                        <td style={{padding:"10px 14px",whiteSpace:"nowrap",color:T.text}}>{fmt(o)}</td>
                        <td style={{padding:"10px 14px",color:"#3b82f6",whiteSpace:"nowrap"}}>{fmt(p)}</td>
                        <td style={{padding:"10px 14px",fontWeight:700,color:(o-p)>=0?"#22c55e":"#ef4444",whiteSpace:"nowrap"}}>{fmt(o-p)}</td>
                        <td style={{padding:"10px 14px",color:"#f59e0b",whiteSpace:"nowrap"}}>{fmt(r)}</td>
                        <td style={{padding:"10px 14px",fontWeight:700,color:(o-r)>=0?"#a3e635":"#ef4444",whiteSpace:"nowrap"}}>{fmt(o-r)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:`2px solid ${T.muted}`,background:T.bg,fontWeight:700}}>
                    <td colSpan={3} style={{padding:"12px 14px",color:T.text}}>TOTAL</td>
                    <td style={{padding:"12px 14px",whiteSpace:"nowrap",color:T.text}}>{fmt(totOrcJogos)}</td>
                    <td style={{padding:"12px 14px",color:"#3b82f6",whiteSpace:"nowrap"}}>{fmt(totProvJogos)}</td>
                    <td style={{padding:"12px 14px",color:"#22c55e",whiteSpace:"nowrap"}}>{fmt(totOrcJogos-totProvJogos)}</td>
                    <td style={{padding:"12px 14px",color:"#f59e0b",whiteSpace:"nowrap"}}>{fmt(totRealJogos)}</td>
                    <td style={{padding:"12px 14px",color:"#a3e635",whiteSpace:"nowrap"}}>{fmt(totOrcJogos-totRealJogos)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>)}

        {tab==="gráficos"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:20}}>
            <div style={{background:T.card,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:14,color:T.textMd}}>Saving por Rodada — Provisionado vs Realizado</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={savingRodada}>
                  <XAxis dataKey="name" tick={{fill:T.textMd,fontSize:11}}/>
                  <YAxis tickFormatter={fmtK} tick={{fill:T.textMd,fontSize:11}}/>
                  <Tooltip content={<CustomTooltip T={T}/>}/>
                  <Legend wrapperStyle={{fontSize:12}}/>
                  <Bar dataKey="Saving Prov." fill="#3b82f6" radius={[4,4,0,0]}/>
                  <Bar dataKey="Saving Real." fill="#22c55e" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:T.card,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:14,color:T.textMd}}>Distribuição do Budget Geral</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={RESUMO_CATS.map(c=>({name:c.nome,value:c.orcado}))} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                    label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {RESUMO_CATS.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>fmt(v)}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:T.card,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:14,color:T.textMd}}>Orçado por Jogo — B1 vs B2</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={divulgados.map(j=>({name:`R${j.rodada} ${j.mandante.split(" ")[0]}`,valor:subTotal(j.orcado),cat:j.categoria}))}>
                  <XAxis dataKey="name" tick={{fill:T.textMd,fontSize:9}}/>
                  <YAxis tickFormatter={fmtK} tick={{fill:T.textMd,fontSize:11}}/>
                  <Tooltip content={<CustomTooltip T={T}/>}/>
                  <Bar dataKey="valor" radius={[4,4,0,0]}>
                    {divulgados.map(j=><Cell key={j.id} fill={j.categoria==="B1"?"#22c55e":"#f59e0b"}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab==="relatório"&&(
          <TabRelatorio jogos={jogos} servicos={servicos} T={T}/>
        )}

      </div>

      {showNovo&&<NovoJogoModal onSave={addJogo} onClose={()=>setNovo(false)} T={T}/>}
      {novoRapido&&<NovoRapidoModal cenario={novoRapido} jogos={jogos} onSave={addJogo} onClose={()=>setNovoRapido(null)} T={T}/>}
    </div>
  );
}
