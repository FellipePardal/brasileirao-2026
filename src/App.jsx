import { useState, useMemo, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

const DARK  = { bg:"#0f172a", card:"#1e293b", border:"#334155", muted:"#475569", text:"#f1f5f9", textMd:"#94a3b8", textSm:"#64748b" };
const LIGHT = { bg:"#f8fafc", card:"#ffffff", border:"#e2e8f0", muted:"#cbd5e1", text:"#1e293b", textMd:"#475569", textSm:"#64748b" };

const fmt  = v => (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const fmtK = v => `R$${((v||0)/1000).toFixed(0)}k`;
const parseBR = s => parseFloat((s||"0").toString().replace(/\./g,"").replace(",",".")) || 0;
const fmtNum  = n => Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtR    = v => "R$ "+Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtRs   = v => "R$ "+Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0});

const Pill = ({label,color}) => (
  <span style={{background:color+"22",color,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>
);
const KPI = ({label,value,sub,color,T}) => (
  <div style={{background:T.card,borderRadius:12,padding:"18px 20px",borderLeft:`4px solid ${color}`}}>
    <p style={{color:T.textMd,fontSize:12,marginBottom:6}}>{label}</p>
    <p style={{fontSize:20,fontWeight:700,color,marginBottom:2}}>{value}</p>
    <p style={{color:T.textSm,fontSize:11}}>{sub}</p>
  </div>
);
const iSty = T => ({background:T.bg,border:`1px solid ${T.muted}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:13,width:"100%",boxSizing:"border-box"});
const btnStyle = {color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontWeight:600,fontSize:13};
const CustomTooltip = ({active,payload,label,T}) => {
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px"}}>
      <p style={{color:T.textMd,marginBottom:6,fontWeight:600}}>{label}</p>
      {payload.map(p=><p key={p.name} style={{color:p.fill||p.color,margin:"2px 0"}}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

const DETENTORES = ["CazeTV/Record/Premiere","Amazon","A definir"];
const CIDADES    = ["Rio de Janeiro","São Paulo","Curitiba","Belo Horizonte","Porto Alegre","Chapecó","Mirassol","Outro"];
const TIMES      = ["Fluminense","Botafogo","Flamengo","Vasco","Corinthians","Palmeiras","São Paulo","Athletico PR","Grêmio","Internacional","Cruzeiro","Atlético MG","Chapecoense","Santos","Vitória","Mirassol","Coritiba","Outro"];
const CATS = [
  { key:"logistica", label:"Logística", color:"#22c55e", subs:[{key:"outros_log",label:"Outros Logística"},{key:"transporte",label:"Transporte"},{key:"uber",label:"Uber"},{key:"hospedagem",label:"Hospedagem"},{key:"diaria",label:"Diária"}]},
  { key:"pessoal",   label:"Pessoal",   color:"#3b82f6", subs:[{key:"coord_um",label:"Coord UM"},{key:"prod_um",label:"Prod UM"},{key:"prod_campo",label:"Prod Campo"},{key:"monitoracao",label:"Monitoração"},{key:"supervisor1",label:"Supervisor 1"},{key:"supervisor2",label:"Supervisor 2"},{key:"dtv",label:"DTV"},{key:"vmix",label:"Vmix"},{key:"audio",label:"Áudio"}]},
  { key:"operacoes", label:"Operações", color:"#f59e0b", subs:[{key:"um_b1",label:"UM B1"},{key:"um_b2",label:"UM B2"},{key:"geradores",label:"Geradores"},{key:"sng",label:"SNG"},{key:"sng_extra",label:"SNG Extra"},{key:"seg_espacial",label:"Seg. Espacial"},{key:"seg_extra",label:"Seg. Extra"},{key:"drone",label:"Drone"},{key:"grua",label:"Grua/Policam"},{key:"dslr",label:"DSLR + Microlink"},{key:"carrinho",label:"Carrinho"},{key:"especial",label:"Especial"},{key:"goalcam",label:"Goalcam"},{key:"minidrone",label:"Minidrone"},{key:"infra",label:"Infra + Distr."},{key:"extra",label:"Extra"}]},
];
const allSubKeys = () => { const r={}; CATS.forEach(c=>c.subs.forEach(s=>{r[s.key]=0;})); return r; };
const PESSOAL = {coord_um:1000,prod_um:0,prod_campo:400,monitoracao:0,supervisor1:800,supervisor2:800,dtv:800,vmix:500,audio:800};
const B1_SUL      = {outros_log:0,transporte:6000,uber:1000,hospedagem:2450,diaria:550,...PESSOAL,um_b1:85000,um_b2:0,geradores:4500,sng:6600,sng_extra:0,seg_espacial:4500,seg_extra:0,drone:2500,grua:4500,dslr:8500,carrinho:0,especial:15000,goalcam:4000,minidrone:2500,infra:6776,extra:0};
const B2_SUDESTE  = {outros_log:0,transporte:5000,uber:1000,hospedagem:1450,diaria:550,...PESSOAL,um_b1:0,um_b2:50000,geradores:4500,sng:6600,sng_extra:0,seg_espacial:4500,seg_extra:0,drone:2500,grua:4500,dslr:8500,carrinho:0,especial:0,goalcam:0,minidrone:0,infra:6776,extra:0};
const B2_SUL      = {outros_log:0,transporte:10010,uber:1200,hospedagem:3150,diaria:640,...PESSOAL,um_b1:0,um_b2:50000,geradores:6000,sng:7920,sng_extra:0,seg_espacial:4500,seg_extra:0,drone:3500,grua:9000,dslr:10500,carrinho:0,especial:0,goalcam:0,minidrone:0,infra:6776,extra:0};
const getDefaults = (cat,regiao="sudeste") => { if(cat==="B1") return {...B1_SUL}; if(regiao==="sul") return {...B2_SUL}; return {...B2_SUDESTE}; };
const JOGO_CENARIO = {1:"b1",2:"b1",5:"b1",8:"b1",10:"b1",11:"b1",15:"b1",16:"b1",3:"b2s",9:"b2s",14:"b2s",6:"b2sul",4:"b2sul",7:"b2sul",12:"b2sul",13:"b2sul"};
const getJogoDefaults = (id,cat,det) => { const c=JOGO_CENARIO[id]; if(c==="b1") return {...B1_SUL}; if(c==="b2sul") return {...B2_SUL}; if(c==="b2s") return {...B2_SUDESTE}; if(cat==="B1") return {...B1_SUL}; if(det==="CazeTV/Record/Premiere") return {...B2_SUL}; return {...B2_SUDESTE}; };
const subTotal = subs => Object.values(subs||{}).reduce((s,v)=>s+(v||0),0);
const catTotal = (subs,cat) => cat.subs.reduce((s,sub)=>s+(subs?.[sub.key]||0),0);
const makeJogo = (id,rodada,cat,cidade,data,hora,mandante,visitante,detentor) => {
  const defs=getJogoDefaults(id,cat,detentor);
  return {id,rodada,categoria:cat,cidade,data,hora,mandante,visitante,detentor,orcado:{...defs},provisionado:{...allSubKeys()},realizado:{...allSubKeys()}};
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
  return {id:100+i,rodada,categoria:cat,cidade:"A definir",data:"A definir",hora:"A definir",mandante:"A definir",visitante:"A definir",detentor:"A definir",orcado:{...getDefaults(cat)},provisionado:{...getDefaults(cat)},realizado:{...allSubKeys()}};
});
const ALL_JOGOS = [...JOGOS_REAIS,...JOGOS_PLACEHOLDER];
const SERVICOS_INIT = [
  { secao:"Pessoal", itens:[{id:1,nome:"Coordenador Sinal Internacional",orcado:0,provisionado:0,realizado:0,obs:""},{id:2,nome:"Produtor Campo/Detentores",orcado:0,provisionado:0,realizado:0,obs:""},{id:3,nome:"Produtor Assets/Pacote",orcado:0,provisionado:0,realizado:0,obs:""},{id:4,nome:"Editor de Imagens 1",orcado:0,provisionado:0,realizado:14900,obs:""},{id:5,nome:"Editor de Imagens 2",orcado:0,provisionado:0,realizado:0,obs:""}]},
  { secao:"Transmissão", itens:[{id:6,nome:"Recepção Fibra para MMs, Antipirataria e Arquivo",orcado:234612,provisionado:0,realizado:0,obs:""}]},
  { secao:"Infraestrutura e Distribuição de Sinais", itens:[{id:7,nome:"Antipirataria (Serviço LiveMode)",orcado:425600,provisionado:0,realizado:840,obs:""},{id:8,nome:"Estatísticas",orcado:120000,provisionado:0,realizado:7000,obs:""},{id:9,nome:"Ferramenta de Clipping",orcado:200000,provisionado:0,realizado:0,obs:""},{id:10,nome:"Media Day",orcado:300000,provisionado:0,realizado:0,obs:""},{id:11,nome:"Espumas",orcado:5000,provisionado:0,realizado:0,obs:""},{id:12,nome:"Grafismo",orcado:90000,provisionado:0,realizado:0,obs:""},{id:13,nome:"Vinheta + Trilha",orcado:35000,provisionado:0,realizado:16000,obs:""}]},
];
const TIPO_COLOR = {fixo:"#6366f1",variavel:"#f43f5e"};
const PIE_COLORS = ["#22c55e","#3b82f6","#f59e0b","#ec4899","#8b5cf6","#06b6d4","#f97316"];
const SECAO_COLORS = {"Pessoal":"#3b82f6","Transmissão":"#22c55e","Infraestrutura e Distribuição de Sinais":"#f59e0b"};
const CENARIO_INFO = {b1:{label:"B1 Sudeste",color:"#22c55e",total:159476,cat:"B1",regiao:"sudeste"},b2s:{label:"B2 Sudeste",color:"#3b82f6",total:100976,cat:"B2",regiao:"sudeste"},b2sul:{label:"B2 Sul",color:"#f59e0b",total:118296,cat:"B2",regiao:"sul"}};

const CAMPEONATOS = [
  {id:"brasileirao-2026",nome:"Brasileirão Série A",edicao:"2026",status:"Em andamento",statusColor:"#22c55e",cor:"#166534",corGrad:"linear-gradient(135deg,#166534,#15803d)",icon:"🇧🇷",rodadas:38,descricao:"Campeonato Brasileiro — FFU Transmissões"},
  {id:"estaduais-2026",nome:"Campeonatos Estaduais",edicao:"2026",status:"Planejamento",statusColor:"#f59e0b",cor:"#92400e",corGrad:"linear-gradient(135deg,#78350f,#92400e)",icon:"🏆",rodadas:null,descricao:"Estaduais — em estruturação",emBreve:true},
];

// ─── HOME ─────────────────────────────────────────────────────────────────────
function Home({onEnter,T,darkMode,setDarkMode}) {
  return (
    <div style={{minHeight:"100vh",background:T.bg}}>
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",padding:"28px 24px 24px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#22c55e,#16a34a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📡</div>
            <div>
              <p style={{color:"#94a3b8",fontSize:11,letterSpacing:3,textTransform:"uppercase",margin:"0 0 2px"}}>Portal Financeiro</p>
              <h1 style={{fontSize:22,fontWeight:800,margin:0,color:"#f1f5f9"}}>FFU — Transmissões</h1>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"#64748b",fontSize:12}}>Temporada 2026</span>
            <button onClick={()=>setDarkMode(d=>!d)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 14px",cursor:"pointer",fontSize:12,color:"#94a3b8",fontWeight:600}}>{darkMode?"☀️ Claro":"🌙 Escuro"}</button>
          </div>
        </div>
      </div>
      <div style={{padding:"32px 24px",maxWidth:900,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:36}}>
          {[{label:"Campeonatos Ativos",value:"1",sub:"de 2 planejados",color:"#22c55e"},{label:"Temporada",value:"2026",sub:"FFU Transmissões",color:"#3b82f6"}].map(k=>(
            <div key={k.label} style={{background:T.card,borderRadius:14,padding:"20px",borderLeft:`4px solid ${k.color}`}}>
              <p style={{color:T.textMd,fontSize:12,marginBottom:8}}>{k.label}</p>
              <p style={{fontSize:22,fontWeight:800,color:k.color,margin:"0 0 4px"}}>{k.value}</p>
              <p style={{color:T.textSm,fontSize:11,margin:0}}>{k.sub}</p>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,fontSize:16,color:T.text,fontWeight:700}}>Campeonatos</h2>
          <span style={{color:T.textSm,fontSize:12}}>{CAMPEONATOS.length} projetos</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))",gap:20}}>
          {CAMPEONATOS.map(camp=>(
            <div key={camp.id} style={{background:T.card,borderRadius:18,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.18)",opacity:camp.emBreve?0.7:1}}>
              <div style={{background:camp.corGrad,padding:"24px 24px 20px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <span style={{fontSize:36}}>{camp.icon}</span>
                    <h3 style={{margin:"8px 0 4px",fontSize:18,fontWeight:800,color:"#fff"}}>{camp.nome}</h3>
                    <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.7)"}}>{camp.edicao} · {camp.descricao}</p>
                  </div>
                  <span style={{background:camp.statusColor+"33",color:camp.statusColor,borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,border:`1px solid ${camp.statusColor}55`,whiteSpace:"nowrap"}}>{camp.status}</span>
                </div>
              </div>
              <div style={{padding:"20px 24px"}}>
                {camp.id==="brasileirao-2026"&&<div style={{marginBottom:16}}><div style={{display:"flex",gap:16,fontSize:12}}><span style={{color:T.textMd}}>Rodadas: <b style={{color:T.text}}>{camp.rodadas}</b></span><span style={{color:T.textMd}}>Detentores: <b style={{color:T.text}}>CazeTV · Amazon</b></span></div></div>}
                {camp.emBreve&&<p style={{color:T.textSm,fontSize:12,margin:"0 0 16px",fontStyle:"italic"}}>Em estruturação — será disponibilizado em breve.</p>}
                <button onClick={()=>!camp.emBreve&&onEnter(camp.id)} style={{...btnStyle,background:camp.emBreve?T.border:camp.cor,width:"100%",padding:"11px",fontSize:14,borderRadius:10,cursor:camp.emBreve?"not-allowed":"pointer",opacity:camp.emBreve?0.5:1}}>{camp.emBreve?"🔒 Em breve":"Abrir campeonato →"}</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:48,textAlign:"center",color:T.textSm,fontSize:11}}>FFU Portal Financeiro · Temporada 2026 · Todos os campeonatos</div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function TabRelatorio({jogos,servicos,T}) {
  const divulgados=jogos.filter(j=>j.mandante!=="A definir");
  const [filtroRod,setFiltroRod]=useState("Todas");
  const [filtroCat,setFiltroCat]=useState("Todas");
  const jogosF=divulgados.filter(j=>(filtroRod==="Todas"||j.rodada===parseInt(filtroRod))&&(filtroCat==="Todas"||j.categoria===filtroCat));
  const catTotals=CATS.map(cat=>({label:cat.label,color:cat.color,orc:jogosF.reduce((s,j)=>s+catTotal(j.orcado,cat),0),prov:jogosF.reduce((s,j)=>s+catTotal(j.provisionado,cat),0),real:jogosF.reduce((s,j)=>s+catTotal(j.realizado,cat),0)}));
  const totOrc=catTotals.reduce((s,c)=>s+c.orc,0),totProv=catTotals.reduce((s,c)=>s+c.prov,0),totReal=catTotals.reduce((s,c)=>s+c.real,0);
  const allServItens=servicos.flatMap(s=>s.itens);
  const sOrc=allServItens.reduce((s,x)=>s+x.orcado,0),sReal=allServItens.reduce((s,x)=>s+x.realizado,0);
  const grandOrc=totOrc+sOrc,grandReal=totReal+sReal;
  const rodadasList=["Todas",...Array.from(new Set(divulgados.map(j=>j.rodada))).sort((a,b)=>a-b).map(String)];
  return(
    <div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
        {rodadasList.map(r=>(<button key={r} onClick={()=>setFiltroRod(r)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:filtroRod===r?"#22c55e":T.card,color:filtroRod===r?"#fff":T.textMd}}>{r==="Todas"?"Todas":`Rd ${r}`}</button>))}
        <div style={{width:1,background:T.border,margin:"0 4px"}}/>
        {["Todas","B1","B2"].map(c=>(<button key={c} onClick={()=>setFiltroCat(c)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:filtroCat===c?"#f59e0b":T.card,color:filtroCat===c?"#000":T.textMd}}>{c==="Todas"?"B1+B2":c}</button>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Total Orçado (jogos+fixos)" value={fmt(grandOrc)} sub={`${jogosF.length} jogos selecionados`} color="#22c55e" T={T}/>
        <KPI label="Total Realizado" value={fmt(grandReal)} sub={`${grandOrc?((grandReal/grandOrc)*100).toFixed(1):0}% executado`} color="#f59e0b" T={T}/>
        <KPI label="Saving Geral" value={fmt(grandOrc-grandReal)} sub="Orçado - Realizado" color={(grandOrc-grandReal)>=0?"#a3e635":"#ef4444"} T={T}/>
        <KPI label="Custo Médio / Jogo" value={jogosF.length?fmt(totOrc/jogosF.length):"—"} sub="Orçado variável" color="#8b5cf6" T={T}/>
      </div>
      <div style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}><h3 style={{margin:0,fontSize:14,color:T.textMd}}>Custos Variáveis por Categoria</h3></div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
          <thead><tr style={{background:T.bg}}>{["Categoria","Orçado","Provisionado","Realizado","Saving","% Exec."].map(h=><th key={h} style={{padding:"10px 16px",textAlign:h==="Categoria"?"left":"right",color:T.textSm,fontSize:11}}>{h}</th>)}</tr></thead>
          <tbody>
            {catTotals.map(c=>{const sv=c.orc-c.real;const pct=c.orc?((c.real/c.orc)*100).toFixed(1):0;return(<tr key={c.label} style={{borderTop:`1px solid ${T.border}`}}><td style={{padding:"10px 16px",fontWeight:600,color:c.color}}>{c.label}</td><td style={{padding:"10px 16px",textAlign:"right",color:T.text}}>{fmt(c.orc)}</td><td style={{padding:"10px 16px",textAlign:"right",color:"#3b82f6"}}>{fmt(c.prov)}</td><td style={{padding:"10px 16px",textAlign:"right",color:"#f59e0b"}}>{fmt(c.real)}</td><td style={{padding:"10px 16px",textAlign:"right",fontWeight:700,color:sv>=0?"#a3e635":"#ef4444"}}>{fmt(sv)}</td><td style={{padding:"10px 16px",textAlign:"right",color:T.textMd}}>{pct}%</td></tr>);})}
            <tr style={{borderTop:`2px solid ${T.muted}`,background:T.bg,fontWeight:700}}><td style={{padding:"12px 16px",color:T.text}}>TOTAL VARIÁVEL</td><td style={{padding:"12px 16px",textAlign:"right",color:"#22c55e"}}>{fmt(totOrc)}</td><td style={{padding:"12px 16px",textAlign:"right",color:"#3b82f6"}}>{fmt(totProv)}</td><td style={{padding:"12px 16px",textAlign:"right",color:"#f59e0b"}}>{fmt(totReal)}</td><td style={{padding:"12px 16px",textAlign:"right",color:(totOrc-totReal)>=0?"#a3e635":"#ef4444"}}>{fmt(totOrc-totReal)}</td><td style={{padding:"12px 16px",textAlign:"right",color:T.textMd}}>{totOrc?((totReal/totOrc)*100).toFixed(1):0}%</td></tr>
          </tbody>
        </table></div>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <span style={{color:T.textMd,fontWeight:700,fontSize:13}}>Serviços Fixos</span>
        <div style={{display:"flex",gap:20,fontSize:13}}><span>Orçado: <b style={{color:"#22c55e"}}>{fmt(sOrc)}</b></span><span>Realizado: <b style={{color:"#f59e0b"}}>{fmt(sReal)}</b></span><span>Saving: <b style={{color:(sOrc-sReal)>=0?"#a3e635":"#ef4444"}}>{fmt(sOrc-sReal)}</b></span></div>
      </div>
    </div>
  );
}

function TabServicos({servicos,setServicos,T}) {
  const [editing,setEditing]=useState(null);const [draft,setDraft]=useState(null);
  const allItens=servicos.flatMap(s=>s.itens);
  const totOrc=allItens.reduce((s,x)=>s+x.orcado,0),totProv=allItens.reduce((s,x)=>s+x.provisionado,0),totReal=allItens.reduce((s,x)=>s+x.realizado,0);
  const startEdit=i=>{setEditing(i.id);setDraft({...i});};const cancelEdit=()=>{setEditing(null);setDraft(null);};
  const saveEdit=()=>{setServicos(ss=>ss.map(s=>({...s,itens:s.itens.map(it=>it.id===draft.id?draft:it)})));setEditing(null);setDraft(null);};
  const addItem=secao=>{const n={id:Date.now(),nome:"Novo serviço",orcado:0,provisionado:0,realizado:0,obs:""};setServicos(ss=>ss.map(s=>s.secao===secao?{...s,itens:[...s.itens,n]}:s));};
  const deleteItem=(secao,id)=>setServicos(ss=>ss.map(s=>s.secao===secao?{...s,itens:s.itens.filter(it=>it.id!==id)}:s));
  const IS=iSty(T);const COLS=["Serviço","Orçado","Provisionado","Realizado","Saving","% Exec.","Progresso","Obs",""];
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,marginBottom:24}}>
        <KPI label="Total Orçado" value={fmt(totOrc)} sub="Serviços fixos" color="#22c55e" T={T}/>
        <KPI label="Provisionado" value={fmt(totProv)} sub="Estimativa" color="#3b82f6" T={T}/>
        <KPI label="Realizado" value={fmt(totReal)} sub={`${totOrc?((totReal/totOrc)*100).toFixed(1):0}% executado`} color="#f59e0b" T={T}/>
        <KPI label="Saving" value={fmt(totOrc-totReal)} sub="Orçado - Realizado" color={(totOrc-totReal)>=0?"#a3e635":"#ef4444"} T={T}/>
      </div>
      {servicos.map(({secao,itens})=>{
        const sOrc=itens.reduce((s,x)=>s+x.orcado,0),sProv=itens.reduce((s,x)=>s+x.provisionado,0),sReal=itens.reduce((s,x)=>s+x.realizado,0);
        const cor=SECAO_COLORS[secao]||"#8b5cf6";
        return(<div key={secao} style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:20}}>
          <div style={{padding:"12px 20px",background:T.bg,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{width:4,height:20,background:cor,borderRadius:2,display:"inline-block"}}/><span style={{fontWeight:700,fontSize:15,color:cor}}>{secao}</span></div>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{display:"flex",gap:12,fontSize:12}}><span style={{color:T.textMd}}>Orç: <b style={{color:"#22c55e"}}>{fmt(sOrc)}</b></span><span style={{color:T.textMd}}>Saving: <b style={{color:(sOrc-sReal)>=0?"#a3e635":"#ef4444"}}>{fmt(sOrc-sReal)}</b></span></div>
              <button onClick={()=>addItem(secao)} style={{...btnStyle,background:cor+"33",color:cor,padding:"4px 12px",fontSize:11}}>+ item</button>
            </div>
          </div>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
            <thead><tr style={{background:T.bg}}>{COLS.map(h=><th key={h} style={{padding:"8px 14px",textAlign:h==="Serviço"||h==="Obs"||h===""?"left":"right",color:T.muted,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {itens.map(item=>{
                const isEd=editing===item.id;const row=isEd?draft:item;const sv=row.orcado-row.realizado;const pct=row.orcado?Math.min(100,(row.realizado/row.orcado)*100):0;
                return(<tr key={item.id} style={{borderTop:`1px solid ${T.border}`}}>
                  <td style={{padding:"10px 14px",fontWeight:600,fontSize:13,color:T.text}}>{isEd?<input value={draft.nome} onChange={e=>setDraft(d=>({...d,nome:e.target.value}))} style={{...IS,width:220}}/>:row.nome}</td>
                  {["orcado","provisionado","realizado"].map(k=>{const col=k==="orcado"?"#22c55e":k==="provisionado"?"#3b82f6":"#f59e0b";return(<td key={k} style={{padding:"10px 14px",textAlign:"right"}}>{isEd?<input value={draft[k]} onChange={e=>setDraft(d=>({...d,[k]:parseFloat(e.target.value)||0}))} style={{...IS,width:110,textAlign:"right",color:col}}/>:<span style={{color:row[k]===0?T.muted:col}}>{fmt(row[k])}</span>}</td>);})}
                  <td style={{padding:"10px 14px",textAlign:"right",fontWeight:700,color:sv>=0?"#a3e635":"#ef4444"}}>{fmt(sv)}</td>
                  <td style={{padding:"10px 14px",textAlign:"right",fontSize:12,color:T.textMd}}>{pct.toFixed(1)}%</td>
                  <td style={{padding:"10px 14px",minWidth:90}}><div style={{background:T.border,borderRadius:4,height:6}}><div style={{background:pct>90?"#ef4444":pct>60?"#f59e0b":"#22c55e",width:`${pct}%`,height:"100%",borderRadius:4}}/></div></td>
                  <td style={{padding:"10px 14px",color:T.textSm,fontSize:12}}>{isEd?<input value={draft.obs} onChange={e=>setDraft(d=>({...d,obs:e.target.value}))} style={{...IS,width:160}}/>:row.obs}</td>
                  <td style={{padding:"10px 14px"}}>{isEd?<div style={{display:"flex",gap:6}}><button onClick={cancelEdit} style={{...btnStyle,background:"#475569",padding:"4px 10px",fontSize:11}}>✕</button><button onClick={saveEdit} style={{...btnStyle,background:"#22c55e",padding:"4px 10px",fontSize:11}}>✓</button></div>:<div style={{display:"flex",gap:6}}><button onClick={()=>startEdit(item)} style={{...btnStyle,background:T.border,padding:"4px 10px",fontSize:11}}>✏</button><button onClick={()=>deleteItem(secao,item.id)} style={{...btnStyle,background:"#7f1d1d",padding:"4px 10px",fontSize:11}}>🗑</button></div>}</td>
                </tr>);
              })}
              <tr style={{borderTop:`2px solid ${T.border}`,background:T.bg,fontWeight:700}}><td style={{padding:"10px 14px",color:cor}}>Total {secao}</td><td style={{padding:"10px 14px",textAlign:"right",color:"#22c55e"}}>{fmt(sOrc)}</td><td style={{padding:"10px 14px",textAlign:"right",color:"#3b82f6"}}>{fmt(sProv)}</td><td style={{padding:"10px 14px",textAlign:"right",color:"#f59e0b"}}>{fmt(sReal)}</td><td style={{padding:"10px 14px",textAlign:"right",color:(sOrc-sReal)>=0?"#a3e635":"#ef4444"}}>{fmt(sOrc-sReal)}</td><td colSpan={4}/></tr>
            </tbody>
          </table></div>
        </div>);
      })}
    </div>
  );
}

function NovoRapidoModal({cenario,jogos,onSave,onClose,T}) {
  const info=CENARIO_INFO[cenario];const proximaRodada=Math.max(0,...jogos.filter(j=>j.mandante!=="A definir").map(j=>j.rodada))+1;
  const [form,setForm]=useState({mandante:"",visitante:"",rodada:String(proximaRodada),cidade:"",data:"",hora:"",detentor:"A definir"});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));const IS=iSty(T);
  const field=(label,key,opts=null)=>(<div style={{marginBottom:12}}><label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>{label}</label>{opts?<select value={form[key]} onChange={e=>set(key,e.target.value)} style={IS}>{opts.map(o=><option key={o}>{o}</option>)}</select>:<input value={form[key]} onChange={e=>set(key,e.target.value)} style={IS}/>}</div>);
  const handleSave=()=>{if(!form.mandante||!form.visitante) return;const defs=getDefaults(info.cat,info.regiao);onSave({...form,id:Date.now(),rodada:parseInt(form.rodada)||0,categoria:info.cat,regiao:info.regiao,orcado:{...defs},provisionado:{...defs},realizado:{...allSubKeys()}});};
  return(<div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
    <div style={{background:T.card,borderRadius:16,padding:28,width:"100%",maxWidth:440,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}><div style={{width:4,height:28,background:info.color,borderRadius:2}}/><div><h3 style={{margin:0,fontSize:16,color:T.text}}>Novo Jogo — {info.label}</h3><p style={{margin:"4px 0 0",fontSize:12,color:T.textSm}}>Orçado automático: <b style={{color:info.color}}>{fmt(info.total)}</b></p></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>{field("Mandante","mandante",TIMES)}{field("Visitante","visitante",TIMES)}{field("Rodada","rodada")}{field("Data","data")}{field("Hora","hora")}{field("Cidade","cidade",CIDADES)}{field("Detentor","detentor",DETENTORES)}</div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><button onClick={onClose} style={{...btnStyle,background:"#475569"}}>Cancelar</button><button onClick={handleSave} style={{...btnStyle,background:info.color,color:cenario==="b2sul"?"#000":"#fff"}}>Adicionar Jogo</button></div>
    </div>
  </div>);
}

function NovoJogoModal({onSave,onClose,T}) {
  const [form,setForm]=useState({mandante:"",visitante:"",rodada:"",cidade:"",data:"",hora:"",categoria:"B1",regiao:"Sudeste",detentor:"A definir"});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));const IS=iSty(T);
  const field=(label,key,opts=null)=>(<div style={{marginBottom:12}}><label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>{label}</label>{opts?<select value={form[key]} onChange={e=>set(key,e.target.value)} style={IS}>{opts.map(o=><option key={o}>{o}</option>)}</select>:<input value={form[key]} onChange={e=>set(key,e.target.value)} style={IS}/>}</div>);
  const handleSave=()=>{if(!form.mandante||!form.visitante) return;const defs=getDefaults(form.categoria,form.regiao==="Sul"?"sul":"sudeste");onSave({...form,id:Date.now(),rodada:parseInt(form.rodada)||0,orcado:{...defs},provisionado:{...defs},realizado:{...allSubKeys()}});};
  return(<div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
    <div style={{background:T.card,borderRadius:16,padding:28,width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto"}}>
      <h3 style={{margin:"0 0 20px",fontSize:16,color:T.text}}>Novo Jogo</h3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>{field("Mandante","mandante",TIMES)}{field("Visitante","visitante",TIMES)}{field("Rodada","rodada")}{field("Data","data")}{field("Hora","hora")}{field("Cidade","cidade",CIDADES)}{field("Categoria","categoria",["B1","B2"])}{field("Região","regiao",["Sudeste","Sul"])}{field("Detentor","detentor",DETENTORES)}</div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><button onClick={onClose} style={{...btnStyle,background:"#475569"}}>Cancelar</button><button onClick={handleSave} style={{...btnStyle,background:"#22c55e"}}>Adicionar</button></div>
    </div>
  </div>);
}

function VisaoMicro({jogos,jogoId,onChangeJogo,onSave,T}) {
  const divulgados=jogos.filter(j=>j.mandante!=="A definir");const idx=divulgados.findIndex(j=>j.id===jogoId);const jogo=divulgados[idx];
  const [draft,setDraft]=useState(null);const [editing,setEditing]=useState(false);const [activeTab,setActiveTab]=useState("orcado");
  const emptyNums=()=>allSubKeys();
  const safeDraft=j=>({...j,orcado:{...emptyNums(),...(j.orcado||{})},provisionado:{...emptyNums(),...(j.provisionado||{})},realizado:{...emptyNums(),...(j.realizado||{})}});
  const setVal=(tipo,subkey,v)=>setDraft(d=>({...d,[tipo]:{...d[tipo],[subkey]:v===""?"":(parseFloat(v)||0)}}));
  const startEdit=()=>{setDraft(safeDraft(jogo));setEditing(true);};const cancelEdit=()=>{setDraft(null);setEditing(false);};
  const saveEdit=()=>{const sanitize=obj=>{const out={};Object.keys(obj||{}).forEach(k=>{out[k]=parseFloat(obj[k])||0;});return out;};onSave({...draft,orcado:sanitize(draft.orcado),provisionado:sanitize(draft.provisionado),realizado:sanitize(draft.realizado)});setEditing(false);setDraft(null);};
  const copyOrcadoToProvisionado=()=>{if(!draft) return;setDraft(d=>({...d,provisionado:{...d.orcado}}));};
  const data=editing&&draft?draft:(jogo||{});const IS=iSty(T);
  if(!jogo) return <p style={{color:T.textSm,padding:20}}>Nenhum jogo selecionado.</p>;
  const safeOrc={...emptyNums(),...(data.orcado||{})};const safeProv={...emptyNums(),...(data.provisionado||{})};const safeReal={...emptyNums(),...(data.realizado||{})};
  const totOrc=subTotal(safeOrc),totProv=subTotal(safeProv),totReal=subTotal(safeReal);
  const compareTabs=["orcado","provisionado","realizado"];const compareColors={"orcado":"#22c55e","provisionado":"#3b82f6","realizado":"#f59e0b"};
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>idx>0&&onChangeJogo(divulgados[idx-1].id)} disabled={idx===0} style={{...btnStyle,background:idx===0?T.card:T.border,padding:"6px 14px",opacity:idx===0?0.4:1,color:T.text}}>←</button>
          <select value={jogoId} onChange={e=>onChangeJogo(parseInt(e.target.value))} style={{...IS,width:"auto",padding:"7px 14px",fontWeight:600,maxWidth:"60vw"}}>
            {divulgados.map(j=><option key={j.id} value={j.id}>Rd {j.rodada} · {j.mandante} x {j.visitante}</option>)}
          </select>
          <button onClick={()=>idx<divulgados.length-1&&onChangeJogo(divulgados[idx+1].id)} disabled={idx===divulgados.length-1} style={{...btnStyle,background:idx===divulgados.length-1?T.card:T.border,padding:"6px 14px",opacity:idx===divulgados.length-1?0.4:1,color:T.text}}>→</button>
        </div>
        <div style={{display:"flex",gap:8}}>
          {!editing?<button onClick={startEdit} style={{...btnStyle,background:"#3b82f6"}}>✏ Editar valores</button>:<>
            {activeTab==="provisionado"&&<button onClick={copyOrcadoToProvisionado} style={{...btnStyle,background:"#6366f1",fontSize:12}}>↓ Copiar Orçado</button>}
            <button onClick={cancelEdit} style={{...btnStyle,background:"#475569"}}>Cancelar</button>
            <button onClick={saveEdit} style={{...btnStyle,background:"#22c55e"}}>💾 Salvar</button>
          </>}
        </div>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:"18px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div><h2 style={{margin:"0 0 6px",fontSize:20,color:T.text}}>{data.mandante} x {data.visitante}</h2><p style={{color:T.textMd,fontSize:13,margin:0}}>Rodada {data.rodada} · {data.cidade} · {data.data} {data.hora} · {data.detentor}</p></div>
          <Pill label={data.categoria} color={data.categoria==="B1"?"#22c55e":"#f59e0b"}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginTop:18}}>
          {[{label:"Orçado",value:fmt(totOrc),color:"#22c55e"},{label:"Provisionado",value:fmt(totProv),color:"#3b82f6"},{label:"Realizado",value:fmt(totReal),color:"#f59e0b"},{label:"Saving",value:fmt(totOrc-totReal),color:(totOrc-totReal)>=0?"#a3e635":"#ef4444"}].map(k=>(
            <div key={k.label} style={{background:T.bg,borderRadius:8,padding:"12px 16px",borderTop:`3px solid ${k.color}`}}><p style={{color:T.textSm,fontSize:11,margin:"0 0 4px"}}>{k.label}</p><p style={{color:k.color,fontWeight:700,fontSize:16,margin:0}}>{k.value}</p></div>
          ))}
        </div>
      </div>
      {editing&&<div style={{display:"flex",gap:4,marginBottom:16}}>{compareTabs.map(t=>(<button key={t} onClick={()=>setActiveTab(t)} style={{padding:"6px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:activeTab===t?compareColors[t]:T.card,color:activeTab===t?"#fff":T.textMd,textTransform:"capitalize"}}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>))}</div>}
      {CATS.map(cat=>{
        const cOrc=catTotal(safeOrc,cat),cProv=catTotal(safeProv,cat),cReal=catTotal(safeReal,cat);
        return(<div key={cat.key} style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:16}}>
          <div style={{padding:"12px 20px",background:T.bg,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <span style={{fontWeight:700,fontSize:14,color:cat.color}}>{cat.label}</span>
            <div style={{display:"flex",gap:16,fontSize:12}}><span style={{color:T.textMd}}>Orç: <b style={{color:"#22c55e"}}>{fmt(cOrc)}</b></span><span style={{color:T.textMd}}>Prov: <b style={{color:"#3b82f6"}}>{fmt(cProv)}</b></span><span style={{color:T.textMd}}>Real: <b style={{color:"#f59e0b"}}>{fmt(cReal)}</b></span><span style={{color:T.textMd}}>Saving: <b style={{color:(cOrc-cProv)>=0?"#a3e635":"#ef4444"}}>{fmt(cOrc-cProv)}</b></span></div>
          </div>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:400}}>
            <thead><tr style={{background:T.bg}}>{["Item","Orçado","Provisionado","Realizado","Saving"].map(h=>(<th key={h} style={{padding:"8px 20px",textAlign:h==="Item"?"left":"right",color:T.muted,fontSize:11}}>{h}</th>))}</tr></thead>
            <tbody>
              {cat.subs.map(sub=>{
                const o=safeOrc[sub.key]||0,p=safeProv[sub.key]||0,r=safeReal[sub.key]||0;
                if(!editing&&o===0&&p===0&&r===0) return null;
                const draftTipo=editing&&draft?{orcado:{...emptyNums(),...(draft.orcado||{})},provisionado:{...emptyNums(),...(draft.provisionado||{})},realizado:{...emptyNums(),...(draft.realizado||{})}}:null;
                return(<tr key={sub.key} style={{borderTop:`1px solid ${T.border}`}}>
                  <td style={{padding:"10px 20px",fontSize:13,color:T.text}}>{sub.label}</td>
                  {["orcado","provisionado","realizado"].map(tipo=>{
                    const val=tipo==="orcado"?o:tipo==="provisionado"?p:r;const col=tipo==="orcado"?"#22c55e":tipo==="provisionado"?"#3b82f6":"#f59e0b";const isActive=!editing||activeTab===tipo;
                    return(<td key={tipo} style={{padding:"8px 20px",textAlign:"right",opacity:editing&&!isActive?0.35:1}}>{editing&&isActive&&draftTipo?<input value={draftTipo[tipo][sub.key]??0} onChange={e=>setVal(tipo,sub.key,e.target.value)} style={{...IS,width:90,textAlign:"right",padding:"4px 8px",color:col}}/>:<span style={{fontSize:13,color:val===0?T.muted:col}}>{fmt(val)}</span>}</td>);
                  })}
                  <td style={{padding:"10px 20px",textAlign:"right",fontWeight:600,color:(o-p)>=0?"#a3e635":"#ef4444",fontSize:13}}>{fmt(o-p)}</td>
                </tr>);
              })}
              <tr style={{borderTop:`2px solid ${T.border}`,background:T.bg,fontWeight:700}}><td style={{padding:"10px 20px",fontSize:13,color:T.text}}>Total {cat.label}</td><td style={{padding:"10px 20px",textAlign:"right",color:"#22c55e"}}>{fmt(cOrc)}</td><td style={{padding:"10px 20px",textAlign:"right",color:"#3b82f6"}}>{fmt(cProv)}</td><td style={{padding:"10px 20px",textAlign:"right",color:"#f59e0b"}}>{fmt(cReal)}</td><td style={{padding:"10px 20px",textAlign:"right",color:(cOrc-cProv)>=0?"#a3e635":"#ef4444"}}>{fmt(cOrc-cProv)}</td></tr>
            </tbody>
          </table></div>
        </div>);
      })}
    </div>
  );
}

// ─── TAB APRESENTAÇÕES ────────────────────────────────────────────────────────
const ORC_PADRAO  = [306440,206427,331103,206347];
const REAL_PADRAO = [266760,145080,226700,73700];

function useDonut(canvasRef, rec, pend) {
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const cx=55,cy=55,r=50,ri=34;
    ctx.clearRect(0,0,110,110);
    const total=rec+pend||1; let start=-Math.PI/2;
    [[rec,"#22c55e"],[pend,"#d97706"]].forEach(([val,color])=>{
      const a=val/total*Math.PI*2;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+a);ctx.closePath();
      ctx.fillStyle=color;ctx.fill();start+=a;
    });
    ctx.beginPath();ctx.arc(cx,cy,ri,0,Math.PI*2);ctx.fillStyle="#1e293b";ctx.fill();
  },[rec,pend]);
}

// ── Formulário Custos Fixos ────────────────────────────────────────────────────
const CATS_FIXOS_INIT = [
  { id:"pessoal", label:"Pessoal", subs:[
    { id:1, nome:"Freelas Fixos", itens:[
      {id:1,nome:"Coordenador sinal internacional",orc:0,gasto:0,prov:0},
      {id:2,nome:"Produtor campo/detentores",orc:0,gasto:0,prov:0},
      {id:3,nome:"Produtor assets/pacote",orc:0,gasto:0,prov:0},
      {id:4,nome:"Editor de imagens 1",orc:0,gasto:14900,prov:0},
      {id:5,nome:"Editor de imagens 2",orc:0,gasto:0,prov:0},
    ]}
  ]},
  { id:"transmissao", label:"Transmissão", subs:[
    { id:2, nome:"Pacotes Mensais", itens:[
      {id:6,nome:"Recepção Fibra para MMs, Antipirataria e Arquivo",orc:234612,gasto:0,prov:234612},
    ]}
  ]},
  { id:"infra", label:"Infraestrutura e Distribuição de Sinais", subs:[
    { id:3, nome:"Serviços (Pacotes Mensais)", itens:[
      {id:7,nome:"Antipirataria (Serviço LiveMode)",orc:425600,gasto:840,prov:299160},
      {id:8,nome:"Estatísticas",orc:120000,gasto:7000,prov:49000},
      {id:9,nome:"Ferramenta de Clipping",orc:200000,gasto:0,prov:200000},
      {id:10,nome:"Media Day",orc:300000,gasto:0,prov:200000},
      {id:11,nome:"Espumas",orc:5000,gasto:0,prov:5000},
      {id:12,nome:"Grafismo",orc:90000,gasto:0,prov:90000},
      {id:13,nome:"Vinheta + Trilha",orc:35000,gasto:16000,prov:19000},
    ]}
  ]},
];

function TabApresentacoes({T}) {
  // ── Seletor de tipo
  const [tipo, setTipo] = useState(null); // null | "variaveis" | "fixos"

  if (!tipo) return <SeletorTipo T={T} onSelect={setTipo}/>;
  if (tipo === "variaveis") return <FormVariaveis T={T} onBack={()=>setTipo(null)}/>;
  return <FormFixos T={T} onBack={()=>setTipo(null)}/>;
}

function SeletorTipo({T, onSelect}) {
  return (
    <div>
      <h2 style={{margin:"0 0 8px",fontSize:16,color:T.text,fontWeight:700}}>Gerar Apresentação PPTX</h2>
      <p style={{color:T.textMd,fontSize:13,marginBottom:28}}>Selecione o tipo de custo que deseja apresentar:</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:20}}>
        {[
          {key:"variaveis",icon:"📊",label:"Custos Variáveis",desc:"Acompanhamento por rodada — orçado × realizado, saving acumulado e notas fiscais.",color:"#22c55e",grad:"linear-gradient(135deg,#14532d,#166534)"},
          {key:"fixos",icon:"🔒",label:"Custos Fixos",desc:"Serviços fixos do campeonato — orçado × gasto × provisionado por categoria.",color:"#3b82f6",grad:"linear-gradient(135deg,#1e3a5f,#1e40af)"},
        ].map(opt=>(
          <div key={opt.key} onClick={()=>onSelect(opt.key)}
            style={{background:T.card,borderRadius:18,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.18)",cursor:"pointer",transition:"transform .15s",border:`1px solid ${T.border}`}}
            onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"}
            onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
            <div style={{background:opt.grad,padding:"28px 24px 22px"}}>
              <span style={{fontSize:40}}>{opt.icon}</span>
              <h3 style={{margin:"10px 0 6px",fontSize:18,fontWeight:800,color:"#fff"}}>{opt.label}</h3>
            </div>
            <div style={{padding:"18px 24px"}}>
              <p style={{color:T.textMd,fontSize:13,margin:"0 0 18px",lineHeight:1.5}}>{opt.desc}</p>
              <button style={{...btnStyle,background:opt.color,width:"100%",padding:"11px",fontSize:14,borderRadius:10,color:"#fff"}}>
                Preencher formulário →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormVariaveis({T, onBack}) {
  const [rodadaAtual,setRodadaAtual]=useState(4);
  const [orcGlobal,setOrcGlobal]=useState("11.540.692,00");
  const [orcAteRod,setOrcAteRod]=useState("1.050.317,00");
  const [macroOrc,setMacroOrc]=useState("11.540.692,00");
  const [macroReal,setMacroReal]=useState("712.240,00");
  const [macroProj,setMacroProj]=useState("10.980.000,00");
  const [nfEsp,setNfEsp]=useState("712.240,00");
  const [nfRec,setNfRec]=useState("623.410,00");
  const [status,setStatus]=useState({msg:"Pronto para gerar",cls:""});
  const [loading,setLoading]=useState(false);
  const canvasRef=useRef(null);

  const makeRodadas=(n)=>Array.from({length:n},(_,i)=>({label:`R${i+1}`,orcado:fmtNum(ORC_PADRAO[i]||0),realizado:fmtNum(REAL_PADRAO[i]||0)}));
  const [rodadas,setRodadas]=useState(makeRodadas(4));

  const setRodadaCount=(n)=>{
    const num=Math.max(1,Math.min(38,parseInt(n)||1));
    setRodadaAtual(num);
    setRodadas(prev=>Array.from({length:num},(_,i)=>prev[i]||{label:`R${i+1}`,orcado:"0,00",realizado:"0,00"}));
  };
  const setRodadaField=(i,field,val)=>setRodadas(prev=>prev.map((r,idx)=>idx===i?{...r,[field]:val}:r));

  const parsed=useMemo(()=>{
    const rows=rodadas.map(r=>({label:r.label,orcado:parseBR(r.orcado),realizado:parseBR(r.realizado)}));
    const totOrc=rows.reduce((s,r)=>s+r.orcado,0);
    const totReal=rows.reduce((s,r)=>s+r.realizado,0);
    const orcAteRodV=parseBR(orcAteRod);
    const saving=orcAteRodV-totReal;
    const savPct=orcAteRodV>0?saving/orcAteRodV*100:0;
    const nfEspV=parseBR(nfEsp);const nfRecV=parseBR(nfRec);
    const nfPend=Math.max(0,nfEspV-nfRecV);
    const pctRec=nfEspV>0?nfRecV/nfEspV*100:0;
    return{rows,totOrc,totReal,saving,savPct,nfPend,pctRec,nfEspV,nfRecV};
  },[rodadas,orcAteRod,nfEsp,nfRec]);

  useDonut(canvasRef,parsed.nfRecV,parsed.nfPend);

  const IS={...iSty(T),width:"100%"};
  const labelSty={color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1};
  const fw={marginBottom:16};

  async function gerarPPTX() {
    if(typeof PptxGenJS==="undefined"){setStatus({msg:"❌ Biblioteca PPTX não carregada.",cls:"err"});return;}
    setLoading(true);setStatus({msg:"Gerando...",cls:""});
    try {
      const {rows,totReal,saving,nfPend,pctRec,nfRecV,nfEspV}=parsed;
      const orcGlobalV=parseBR(orcGlobal),orcAteRodV=parseBR(orcAteRod);
      const macroOrcV=parseBR(macroOrc),macroRealV=parseBR(macroReal),macroProjV=parseBR(macroProj);
      const pctRecV=nfEspV>0?(nfRecV/nfEspV*100).toFixed(1):"0.0";
      const pctPendV=nfEspV>0?(nfPend/nfEspV*100).toFixed(1):"0.0";
      const fmtBRL=v=>"R$ "+Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtBRLk=v=>"R$ "+Number(v).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0});
      const C={bg:"FFFFFF",bgLight:"F9FAFB",border:"E5E7EB",borderDark:"D1D5DB",verde:"166534",verdeAc:"22C55E",verdeL:"F0FDF4",verdeBd:"BBF7D0",azul:"1E40AF",azulAc:"3B82F6",azulL:"EFF6FF",azulBd:"BFDBFE",ambarAc:"D97706",cinzaBar:"D1D5DB",dark:"111827",sub:"9CA3AF",strip:"111827"};
      const pptx=new PptxGenJS();pptx.layout="LAYOUT_WIDE";
      const sl=pptx.addSlide();sl.background={color:C.bg};
      sl.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.33,h:0.06,fill:{color:C.verdeAc},line:{width:0}});
      sl.addText("Acompanhamento Orçamentário – Brasileirão 2026",{x:0.3,y:0.1,w:12.7,h:0.4,fontSize:20,bold:true,color:C.dark,fontFace:"Segoe UI"});
      sl.addText(`Serviços Variáveis  ·  Rodada ${rodadaAtual} de 38`,{x:0.3,y:0.5,w:12.7,h:0.2,fontSize:9.5,color:"555555",fontFace:"Segoe UI"});
      sl.addShape(pptx.ShapeType.line,{x:0.3,y:0.74,w:12.73,h:0,line:{color:C.border,width:0.75}});
      const kpis=[{label:"ORÇADO TOTAL",value:fmtBRL(orcGlobalV),style:"normal"},{label:`ORÇADO ATÉ R${rodadaAtual}`,value:fmtBRL(orcAteRodV),style:"normal"},{label:`REALIZADO ATÉ R${rodadaAtual}`,value:fmtBRL(totReal),style:"normal"},{label:"SAVING ACUMULADO",value:fmtBRL(saving),style:"verde"}];
      const kW=3.13,kH=0.82,kY=0.82,kGap=0.06;
      kpis.forEach((k,i)=>{const x=0.3+i*(kW+kGap),isV=k.style==="verde";sl.addShape(pptx.ShapeType.rect,{x,y:kY,w:kW,h:kH,fill:{color:isV?C.verdeL:C.bgLight},line:{color:isV?C.verdeBd:C.border,width:1}});sl.addShape(pptx.ShapeType.rect,{x,y:kY,w:kW,h:0.04,fill:{color:isV?C.verdeAc:"555555"},line:{width:0}});sl.addText(k.label,{x:x+0.14,y:kY+0.08,w:kW-0.2,h:0.18,fontSize:6.5,bold:true,color:"666666",charSpacing:0.8,fontFace:"Segoe UI"});sl.addText(k.value,{x:x+0.14,y:kY+0.28,w:kW-0.2,h:0.38,fontSize:14.5,bold:true,color:isV?C.verde:C.dark,fontFace:"Segoe UI"});});
      const bX=0.3,bY=1.78,bW=8.2,bH=2.7,pX=8.7,pY=1.78,pW=4.33,pH=2.7;
      sl.addShape(pptx.ShapeType.rect,{x:bX,y:bY,w:bW,h:bH,fill:{color:C.bgLight},line:{color:C.border,width:1}});
      sl.addText("Comparativo Orçado × Realizado",{x:bX+0.2,y:bY+0.14,w:5,h:0.24,fontSize:9.5,bold:true,color:C.dark,fontFace:"Segoe UI"});
      [{color:C.cinzaBar,label:"Orçado"},{color:C.verdeAc,label:"Realizado"}].forEach((l,i)=>{const lx=bX+bW-2.2+i*1.1;sl.addShape(pptx.ShapeType.rect,{x:lx,y:bY+0.18,w:0.13,h:0.13,fill:{color:l.color},line:{width:0}});sl.addText(l.label,{x:lx+0.17,y:bY+0.15,w:0.85,h:0.2,fontSize:7.5,color:"555555",fontFace:"Segoe UI"});});
      const aX=bX+0.55,aY=bY+0.52,aW=bW-0.7,aH=bH-0.82;const maxV=Math.max(...rows.map(r=>r.orcado),1);const grpW=aW/rows.length,barW=grpW*0.3,bgap=grpW*0.05;
      [0.25,0.5,0.75,1].forEach(p=>{const gy=aY+aH*(1-p);sl.addShape(pptx.ShapeType.line,{x:aX,y:gy,w:aW,h:0,line:{color:p===1?C.borderDark:C.border,width:p===1?0.75:0.4,dashType:p<1?"sysDash":"solid"}});sl.addText(fmtBRLk(maxV*p),{x:bX+0.02,y:gy-0.13,w:0.5,h:0.18,fontSize:5.5,color:"666666",align:"right",fontFace:"Segoe UI"});});
      rows.forEach((r,i)=>{const gx=aX+i*grpW+grpW*0.06,baseY=aY+aH;const hO=(r.orcado/maxV)*aH,hR=(r.realizado/maxV)*aH;sl.addShape(pptx.ShapeType.rect,{x:gx,y:baseY-hO,w:barW,h:hO,fill:{color:C.cinzaBar},line:{width:0}});sl.addShape(pptx.ShapeType.rect,{x:gx+barW+bgap,y:baseY-Math.max(hR,.01),w:barW,h:Math.max(hR,.01),fill:{color:C.verdeAc},line:{width:0}});sl.addText(fmtBRLk(r.orcado),{x:gx-0.08,y:baseY-hO-0.18,w:barW+0.16,h:0.18,fontSize:5.5,color:"555555",align:"center",fontFace:"Segoe UI"});sl.addText(fmtBRLk(r.realizado),{x:gx+barW+bgap-0.08,y:baseY-Math.max(hR,.01)-0.18,w:barW+0.16,h:0.18,fontSize:5.5,color:C.verde,align:"center",fontFace:"Segoe UI"});sl.addText(r.label,{x:gx-0.05,y:baseY+0.06,w:barW*2+bgap+0.1,h:0.2,fontSize:8.5,bold:true,color:"555555",align:"center",fontFace:"Segoe UI"});});
      sl.addShape(pptx.ShapeType.rect,{x:pX,y:pY,w:pW,h:pH,fill:{color:C.bgLight},line:{color:C.border,width:1}});
      sl.addText("Notas Fiscais",{x:pX+0.2,y:pY+0.14,w:pW-0.3,h:0.24,fontSize:9.5,bold:true,color:C.dark,fontFace:"Segoe UI"});
      sl.addText(`Recebidas × Pendentes — R${rodadaAtual}`,{x:pX+0.2,y:pY+0.38,w:pW-0.3,h:0.18,fontSize:7.5,color:"555555",fontFace:"Segoe UI"});
      sl.addChart(pptx.ChartType.doughnut,[{name:"NFs",labels:["Recebidas","Pendentes"],values:[nfRecV,nfPend]}],{x:pX+0.3,y:pY+0.52,w:pW-0.6,h:pH-0.9,holeSize:55,chartColors:["22C55E","D97706"],showLabel:false,showValue:false,showPercent:false,showLegend:false,shadow:{type:"none"}});
      const legY=pY+pH-0.32;
      [{color:C.verdeAc,label:`Recebidas — ${pctRecV}%  (${fmtBRLk(nfRecV)})`},{color:"D97706",label:`Pendentes — ${pctPendV}%  (${fmtBRLk(nfPend)})`}].forEach((l,i)=>{const lx=pX+0.3+i*((pW-0.6)/2);sl.addShape(pptx.ShapeType.rect,{x:lx,y:legY,w:0.12,h:0.12,fill:{color:l.color},line:{width:0}});sl.addText(l.label,{x:lx+0.17,y:legY-0.01,w:(pW-0.6)/2-0.2,h:0.16,fontSize:7,color:"444444",fontFace:"Segoe UI"});});
      const tY=4.58;sl.addShape(pptx.ShapeType.rect,{x:0.3,y:tY,w:13.03,h:0.26,fill:{color:"333333"},line:{width:0}});
      [{label:"RODADA",x:0.3,w:1.2},{label:"ORÇADO",x:1.5,w:3.1},{label:"REALIZADO",x:4.6,w:3.1},{label:"SAVING",x:7.7,w:3.1},{label:"SAVING %",x:10.8,w:2.56}].forEach(c=>{sl.addText(c.label,{x:c.x+0.12,y:tY+0.04,w:c.w-0.15,h:0.18,fontSize:6.5,bold:true,color:"AAAAAA",charSpacing:0.8,fontFace:"Segoe UI"});});
      rows.forEach((r,i)=>{const ry=tY+0.26+i*0.2;sl.addShape(pptx.ShapeType.rect,{x:0.3,y:ry,w:13.03,h:0.2,fill:{color:i%2===0?"FFFFFF":C.bgLight},line:{width:0}});const sav=r.orcado-r.realizado,savPctR=r.orcado>0?sav/r.orcado*100:0;[{x:0.3,w:1.2,txt:r.label,color:"333333",bold:true},{x:1.5,w:3.1,txt:fmtBRL(r.orcado),color:"333333"},{x:4.6,w:3.1,txt:fmtBRL(r.realizado),color:"333333"},{x:7.7,w:3.1,txt:(sav>=0?"▲ ":"▼ ")+fmtBRLk(Math.abs(sav)),color:sav>=0?C.verde:"DC2626"},{x:10.8,w:2.56,txt:(sav>=0?"▲ ":"▼ ")+Math.abs(savPctR).toFixed(1)+"%",color:sav>=0?C.verde:"DC2626"}].forEach(v=>{sl.addText(v.txt,{x:v.x+0.12,y:ry+0.02,w:v.w-0.15,h:0.16,fontSize:7,bold:v.bold||false,color:v.color,fontFace:"Segoe UI"});});});
      const totOrcT=rows.reduce((s,r)=>s+r.orcado,0),totSavT=totOrcT-totReal,totSavPct=totOrcT>0?totSavT/totOrcT*100:0,totRowY=tY+0.26+rows.length*0.2;
      sl.addShape(pptx.ShapeType.rect,{x:0.3,y:totRowY,w:13.03,h:0.2,fill:{color:"EEEEEE"},line:{width:0}});sl.addShape(pptx.ShapeType.line,{x:0.3,y:totRowY,w:13.03,h:0,line:{color:C.borderDark,width:0.5}});
      [{x:0.3,w:1.2,txt:"TOTAL",color:"333333"},{x:1.5,w:3.1,txt:fmtBRL(totOrcT),color:"333333"},{x:4.6,w:3.1,txt:fmtBRL(totReal),color:"333333"},{x:7.7,w:3.1,txt:"▲ "+fmtBRLk(totSavT),color:C.verde},{x:10.8,w:2.56,txt:"▲ "+totSavPct.toFixed(1)+"%",color:C.verde}].forEach(v=>{sl.addText(v.txt,{x:v.x+0.12,y:totRowY+0.02,w:v.w-0.15,h:0.16,fontSize:7,bold:true,color:v.color,fontFace:"Segoe UI"});});
      const sY=6.6,sH=0.9;sl.addShape(pptx.ShapeType.rect,{x:0,y:sY,w:13.33,h:sH,fill:{color:C.strip},line:{width:0}});
      sl.addText("RODADA",{x:0.25,y:sY+0.1,w:1.8,h:0.18,fontSize:6,bold:true,color:"777777",charSpacing:1,fontFace:"Segoe UI"});sl.addText(`${rodadaAtual} / 38`,{x:0.25,y:sY+0.3,w:1.8,h:0.44,fontSize:20,bold:true,color:"F9FAFB",fontFace:"Segoe UI"});
      [{label:"ORÇADO TOTAL CAMPEONATO",value:fmtBRL(macroOrcV),color:"F9FAFB"},{label:"VARIÁVEIS REALIZADO",value:fmtBRL(macroRealV),color:"4ADE80"},{label:"PROJETADO ATÉ O FINAL",value:fmtBRL(macroProjV),color:"60A5FA"}].forEach((c,i)=>{const scW=(13.33-2.2)/3,cx=2.2+i*scW;sl.addShape(pptx.ShapeType.line,{x:cx,y:sY+0.12,w:0,h:sH-0.24,line:{color:"2D2D2D",width:0.75}});sl.addText(c.label,{x:cx+0.15,y:sY+0.1,w:scW-0.2,h:0.2,fontSize:5.8,bold:true,color:"777777",charSpacing:0.5,fontFace:"Segoe UI"});sl.addText(c.value,{x:cx+0.15,y:sY+0.34,w:scW-0.2,h:0.38,fontSize:12,bold:true,color:c.color,fontFace:"Segoe UI"});});
      await pptx.writeFile({fileName:`dashboard_variaveis_R${rodadaAtual}_brasileirao2026.pptx`});
      setStatus({msg:`✅ dashboard_variaveis_R${rodadaAtual}.pptx baixado!`,cls:"ok"});
    } catch(e){setStatus({msg:"❌ Erro: "+e.message,cls:"err"});}
    setLoading(false);
  }

  const {rows,totOrc,totReal,saving,savPct,nfPend,pctRec,nfRecV,nfEspV}=parsed;
  const secHdr={fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:T.text,marginBottom:16};
  const secNum={fontSize:10,color:T.textSm,fontWeight:700,marginRight:8};
  const grid3={display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20};
  const fieldWrap={marginBottom:16};

  return(
    <div style={{paddingBottom:80}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={onBack} style={{...btnStyle,background:T.border,color:T.text,padding:"6px 14px",fontSize:12}}>← Voltar</button>
        <div>
          <h2 style={{margin:0,fontSize:15,color:T.text,fontWeight:700}}>📊 Custos Variáveis</h2>
          <p style={{margin:"2px 0 0",fontSize:12,color:T.textMd}}>Acompanhamento por rodada</p>
        </div>
      </div>

      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>01</span><span style={secHdr}>Configuração Base</span></div>
        <div style={grid3}>
          <div style={fw}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Rodada Atual *</label><input type="number" min={1} max={38} value={rodadaAtual} onChange={e=>setRodadaCount(e.target.value)} style={{...IS}}/><span style={{fontSize:10,color:T.textSm}}>Qual rodada acabou de ser jogada</span></div>
          <div style={fw}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Orçado Total – Campeonato *</label><input value={orcGlobal} onChange={e=>setOrcGlobal(e.target.value)} style={{...IS}}/><span style={{fontSize:10,color:T.textSm}}>Orçamento fixo (38 rodadas)</span></div>
          <div style={fw}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Orçado Acumulado até a Rodada *</label><input value={orcAteRod} onChange={e=>setOrcAteRod(e.target.value)} style={{...IS}}/><span style={{fontSize:10,color:T.textSm}}>Valor real orçado (não proporcional)</span></div>
        </div>
      </div>

      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>02</span><span style={secHdr}>Acompanhamento Macro — Campeonato</span></div>
        <div style={grid3}>
          {[{label:"Orçado",val:macroOrc,set:setMacroOrc,color:"#9ca3af",desc:"Valor previamente orçado para o campeonato."},{label:"Realizado",val:macroReal,set:setMacroReal,color:"#22c55e",desc:"NFs com confirmação de recebimento até a rodada atual."},{label:"Projetado",val:macroProj,set:setMacroProj,color:"#3b82f6",desc:"Estimativa para rodadas ainda não realizadas."}].map(({label,val,set:setter,color,desc})=>(
            <div key={label} style={{background:T.bg,borderRadius:8,padding:"16px",borderTop:`3px solid ${color}`}}>
              <p style={{fontSize:10,fontWeight:700,color,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>{label}</p>
              <div style={fw}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Valor Total *</label><input value={val} onChange={e=>setter(e.target.value)} style={{...IS,color}}/></div>
              <p style={{fontSize:10,color:T.textSm,lineHeight:1.5}}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>03</span><span style={secHdr}>Dados por Rodada</span><span style={{marginLeft:"auto",fontSize:11,color:T.textSm}}>Saving calculado automaticamente</span></div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
          <thead><tr style={{background:T.bg}}>{["Rodada","Orçado (R$) *","Realizado (R$) *","Saving (R$)"].map((h,i)=>(<th key={h} style={{padding:"10px 12px",textAlign:i===0?"left":"right",color:T.textSm,fontSize:11,borderBottom:`1px solid ${T.border}`}}>{h}</th>))}</tr></thead>
          <tbody>{rows.map((r,i)=>{const sav=r.orcado-r.realizado;return(<tr key={i} style={{borderBottom:`1px solid ${T.border}`}}><td style={{padding:"6px 12px",fontWeight:700,color:"#22c55e",fontSize:13}}>{r.label}</td><td style={{padding:"4px 12px",textAlign:"right"}}><input value={rodadas[i].orcado} onChange={e=>setRodadaField(i,"orcado",e.target.value)} style={{...iSty(T),width:120,textAlign:"right",padding:"4px 8px"}}/></td><td style={{padding:"4px 12px",textAlign:"right"}}><input value={rodadas[i].realizado} onChange={e=>setRodadaField(i,"realizado",e.target.value)} style={{...iSty(T),width:120,textAlign:"right",padding:"4px 8px",color:"#22c55e"}}/></td><td style={{padding:"6px 12px",textAlign:"right",fontWeight:700,color:sav>=0?"#a3e635":"#ef4444"}}>{sav>=0?"▲ ":"▼ "}{fmtR(Math.abs(sav))}</td></tr>);})}</tbody>
          <tfoot><tr style={{background:T.bg}}><td style={{padding:"10px 12px",fontSize:11,color:T.textSm,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Total</td><td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:T.text}}>{fmtR(totOrc)}</td><td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:T.text}}>{fmtR(totReal)}</td><td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:saving>=0?"#a3e635":"#ef4444"}}>{saving>=0?"▲ ":"▼ "}{fmtR(Math.abs(saving))}</td></tr></tfoot>
        </table></div>
      </div>

      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}><span style={secNum}>04</span><span style={secHdr}>Notas Fiscais — Rodada Atual</span></div>
        <div style={grid3}>
          <div style={fieldWrap}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Notas Esperadas *</label><input value={nfEsp} onChange={e=>setNfEsp(e.target.value)} style={{...IS}}/><span style={{fontSize:10,color:T.textSm}}>Total de NFs previstas</span></div>
          <div style={fieldWrap}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Notas Recebidas *</label><input value={nfRec} onChange={e=>setNfRec(e.target.value)} style={{...IS,color:"#22c55e"}}/><span style={{fontSize:10,color:T.textSm}}>NFs que já entraram no sistema</span></div>
          <div style={fieldWrap}><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Notas Pendentes <span style={{background:"#052e16",color:"#4ade80",fontSize:9,padding:"1px 5px",borderRadius:2,marginLeft:4}}>AUTO</span></label><input readOnly value={fmtNum(nfPend)} style={{...IS,color:"#d97706",cursor:"default"}}/><span style={{fontSize:10,color:T.textSm}}>Esperadas − Recebidas</span></div>
        </div>
        <div style={{display:"flex",gap:32,alignItems:"flex-start",marginTop:20,flexWrap:"wrap"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            <div style={{position:"relative",width:110,height:110}}><canvas ref={canvasRef} width={110} height={110}/><div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:15,fontWeight:700,color:T.text}}>{Math.round(pctRec)}%</div></div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <span style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:T.textMd}}><span style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/> Recebidas · <b style={{color:T.text}}>{fmtRs(nfRecV)}</b></span>
              <span style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:T.textMd}}><span style={{width:8,height:8,borderRadius:"50%",background:"#d97706",flexShrink:0}}/> Pendentes · <b style={{color:T.text}}>{fmtRs(nfPend)}</b></span>
            </div>
          </div>
          <div style={{display:"flex",gap:28,flexWrap:"wrap",flex:1}}>
            {[{label:"% Recebidas",val:`${pctRec.toFixed(1)}%`,sub:fmtRs(nfRecV),color:"#22c55e"},{label:"% Pendentes",val:`${(100-pctRec).toFixed(1)}%`,sub:fmtRs(nfPend),color:"#d97706"},{label:"Saving Acumulado",val:(saving>=0?"▲ ":"▼ ")+fmtRs(Math.abs(saving)),sub:`${(saving>=0?"▲ ":"▼ ")}${Math.abs(savPct).toFixed(1)}% vs. orçado`,color:saving>=0?"#a3e635":"#ef4444"}].map(m=>(<div key={m.label}><p style={{fontSize:10,color:T.textSm,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{m.label}</p><p style={{fontSize:22,fontWeight:300,color:m.color,marginBottom:2}}>{m.val}</p><p style={{fontSize:10,color:T.textSm}}>{m.sub}</p></div>))}
          </div>
        </div>
      </div>

      <div style={{position:"sticky",bottom:0,left:0,right:0,background:T.card,borderTop:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:50,borderRadius:"0 0 12px 12px"}}>
        <div><p style={{fontSize:12,color:T.textMd,marginBottom:2}}><b style={{color:T.text}}>Tudo preenchido?</b> Clique para gerar e baixar o PPTX.</p><p style={{fontSize:11,color:status.cls==="ok"?"#22c55e":status.cls==="err"?"#ef4444":T.textSm}}>{status.msg}</p></div>
        <button onClick={gerarPPTX} disabled={loading} style={{...btnStyle,background:loading?"#1a3a20":"#22c55e",color:loading?"#4ade80":"#000",padding:"11px 28px",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",opacity:loading?0.7:1}}>{loading?"Gerando...":"⚡ Gerar PPTX"}</button>
      </div>
    </div>
  );
}

// ── Formulário Custos Fixos ────────────────────────────────────────────────────
function FormFixos({T, onBack}) {
  const [rodadaAtual, setRodadaAtual] = useState(4);
  const [orcTotal, setOrcTotal] = useState("1.410.212,00");
  const [status, setStatus] = useState({msg:"Aguardando...", cls:""});
  const [loading, setLoading] = useState(false);

  // cats state
  const [cats, setCats] = useState(() => JSON.parse(JSON.stringify(CATS_FIXOS_INIT)));
  const [collapsed, setCollapsed] = useState({});
  const [collapsedSubs, setCollapsedSubs] = useState({});

  const toggleCat = id => setCollapsed(p=>({...p,[id]:!p[id]}));
  const toggleSub = id => setCollapsedSubs(p=>({...p,[id]:!p[id]}));

  const updateItem = (catId, subId, itemId, field, val) => {
    setCats(prev => prev.map(cat => cat.id!==catId ? cat : {...cat, subs: cat.subs.map(sub => sub.id!==subId ? sub : {...sub, itens: sub.itens.map(it => it.id!==itemId ? it : {...it, [field]: field==="nome"?val:(parseBR(val)||0)})})}));
  };
  const addItem = (catId, subId) => {
    setCats(prev => prev.map(cat => cat.id!==catId ? cat : {...cat, subs: cat.subs.map(sub => sub.id!==subId ? sub : {...sub, itens: [...sub.itens, {id:Date.now(),nome:"",orc:0,gasto:0,prov:0}]})}));
  };
  const removeItem = (catId, subId, itemId) => {
    setCats(prev => prev.map(cat => cat.id!==catId ? cat : {...cat, subs: cat.subs.map(sub => sub.id!==subId ? sub : {...sub, itens: sub.itens.filter(it=>it.id!==itemId)})}));
  };
  const addSub = (catId) => {
    setCats(prev => prev.map(cat => cat.id!==catId ? cat : {...cat, subs: [...cat.subs, {id:Date.now(), nome:"Nova Subcategoria", itens:[{id:Date.now()+1,nome:"",orc:0,gasto:0,prov:0}]}]}));
  };
  const removeSub = (catId, subId) => {
    setCats(prev => prev.map(cat => cat.id!==catId ? cat : {...cat, subs: cat.subs.filter(s=>s.id!==subId)}));
  };
  const updateSubNome = (catId, subId, val) => {
    setCats(prev => prev.map(cat => cat.id!==catId ? cat : {...cat, subs: cat.subs.map(sub => sub.id!==subId ? sub : {...sub, nome:val})}));
  };

  // totals
  const calcSub = sub => {
    const orc=sub.itens.reduce((s,it)=>s+it.orc,0);
    const gasto=sub.itens.reduce((s,it)=>s+it.gasto,0);
    const prov=sub.itens.reduce((s,it)=>s+it.prov,0);
    return {orc,gasto,prov,saldo:orc-gasto-prov};
  };
  const calcCat = cat => {
    const subs = cat.subs.map(calcSub);
    return {orc:subs.reduce((s,x)=>s+x.orc,0),gasto:subs.reduce((s,x)=>s+x.gasto,0),prov:subs.reduce((s,x)=>s+x.prov,0),saldo:subs.reduce((s,x)=>s+x.saldo,0)};
  };
  const totals = useMemo(()=>{
    const cs=cats.map(cat=>({...cat,...calcCat(cat)}));
    return {cats:cs,orc:cs.reduce((s,c)=>s+c.orc,0),gasto:cs.reduce((s,c)=>s+c.gasto,0),prov:cs.reduce((s,c)=>s+c.prov,0),saldo:cs.reduce((s,c)=>s+c.saldo,0)};
  },[cats]);

  const IS = iSty(T);
  const colColor = {orc:"#3b82f6", gasto:T.text, prov:"#f59e0b"};

  async function gerarPPTX() {
    if(typeof PptxGenJS==="undefined"){setStatus({msg:"❌ Biblioteca PPTX não carregada.",cls:"err"});return;}
    setLoading(true);setStatus({msg:"Gerando...",cls:""});
    try {
      const d = {rod:rodadaAtual, orcTot:parseBR(orcTotal), ...totals};
      const fmtBRL=v=>"R$ "+Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtBRLk=v=>"R$ "+Number(v).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0});
      const C={bg:"FFFFFF",bgLight:"F9FAFB",border:"E5E7EB",borderDark:"D1D5DB",verde:"166534",verdeAc:"22C55E",verdeL:"F0FDF4",verdeBd:"BBF7D0",azul:"1E40AF",azulAc:"3B82F6",azulL:"EFF6FF",ambar:"92400E",ambarAc:"F59E0B",ambarL:"FFFBEB",ambarBd:"FDE68A",cinzaBar:"D1D5DB",dark:"111827",sub:"9CA3AF",strip:"111827"};
      const pptx=new PptxGenJS();pptx.layout="LAYOUT_WIDE";
      const sl=pptx.addSlide();sl.background={color:C.bg};
      const W=13.33;
      sl.addShape(pptx.ShapeType.rect,{x:0,y:0,w:W,h:0.06,fill:{color:C.azulAc},line:{width:0}});
      sl.addText("Custos Fixos – Brasileirão 2026",{x:0.3,y:0.1,w:12.7,h:0.4,fontSize:20,bold:true,color:C.dark,fontFace:"Segoe UI"});
      sl.addText(`Serviços Fixos  ·  Rodada ${d.rod} de 38`,{x:0.3,y:0.5,w:12.7,h:0.2,fontSize:9.5,color:"555555",fontFace:"Segoe UI"});
      sl.addShape(pptx.ShapeType.line,{x:0.3,y:0.74,w:12.73,h:0,line:{color:C.border,width:0.75}});
      const kpis=[{label:"ORÇADO TOTAL",value:fmtBRL(d.orcTot),bg:C.bgLight,bd:C.border,vc:C.dark,bar:"555555"},{label:"GASTO TOTAL",value:fmtBRL(d.gasto),bg:C.bgLight,bd:C.border,vc:C.dark,bar:"555555"},{label:"PROVISIONADO",value:fmtBRL(d.prov),bg:C.ambarL,bd:C.ambarBd,vc:C.ambar,bar:C.ambarAc},{label:"SALDO TOTAL",value:fmtBRL(d.saldo),bg:d.saldo>=0?C.verdeL:"FEF2F2",bd:d.saldo>=0?C.verdeBd:"FECACA",vc:d.saldo>=0?C.verde:"DC2626",bar:d.saldo>=0?C.verdeAc:"DC2626"}];
      const kW=3.13,kH=0.82,kY=0.82,kGap=0.06;
      kpis.forEach((k,i)=>{const x=0.3+i*(kW+kGap);sl.addShape(pptx.ShapeType.rect,{x,y:kY,w:kW,h:kH,fill:{color:k.bg},line:{color:k.bd,width:1}});sl.addShape(pptx.ShapeType.rect,{x,y:kY,w:kW,h:0.04,fill:{color:k.bar},line:{width:0}});sl.addText(k.label,{x:x+0.14,y:kY+0.08,w:kW-0.2,h:0.18,fontSize:6.5,bold:true,color:"666666",charSpacing:0.8,fontFace:"Segoe UI"});sl.addText(k.value,{x:x+0.14,y:kY+0.28,w:kW-0.2,h:0.38,fontSize:14.5,bold:true,color:k.vc,fontFace:"Segoe UI"});});
      const bX=0.3,bY=1.78,bW=W-0.6,bH=2.7;
      sl.addShape(pptx.ShapeType.rect,{x:bX,y:bY,w:bW,h:bH,fill:{color:C.bgLight},line:{color:C.border,width:1}});
      sl.addText("Comparativo Orçado × Gasto × Provisionado",{x:bX+0.2,y:bY+0.14,w:7,h:0.24,fontSize:9.5,bold:true,color:C.dark,fontFace:"Segoe UI"});
      [{color:C.cinzaBar,label:"Orçado"},{color:C.verdeAc,label:"Gasto"},{color:C.ambarAc,label:"Provisionado"}].forEach((l,i)=>{const lx=bX+bW-4.0+i*1.35;sl.addShape(pptx.ShapeType.rect,{x:lx,y:bY+0.18,w:0.13,h:0.13,fill:{color:l.color},line:{width:0}});sl.addText(l.label,{x:lx+0.17,y:bY+0.15,w:1.1,h:0.2,fontSize:7.5,color:"555555",fontFace:"Segoe UI"});});
      const aX=bX+0.55,aY=bY+0.52,aW=bW-0.7,aH=bH-0.82;
      const maxV=Math.max(...d.cats.map(c=>c.orc),1);
      const grpW=aW/d.cats.length,barW=grpW*0.22,bgap=grpW*0.03;
      [0.25,0.5,0.75,1].forEach(p=>{const gy=aY+aH*(1-p);sl.addShape(pptx.ShapeType.line,{x:aX,y:gy,w:aW,h:0,line:{color:p===1?C.borderDark:C.border,width:p===1?0.75:0.4,dashType:p<1?"sysDash":"solid"}});sl.addText(fmtBRLk(maxV*p),{x:bX+0.02,y:gy-0.13,w:0.5,h:0.18,fontSize:5.5,color:"666666",align:"right",fontFace:"Segoe UI"});});
      d.cats.forEach((cat,i)=>{const gx=aX+i*grpW+grpW*0.08,baseY=aY+aH;const hO=(cat.orc/maxV)*aH,hG=(cat.gasto/maxV)*aH,hP=(cat.prov/maxV)*aH;sl.addShape(pptx.ShapeType.rect,{x:gx,y:baseY-hO,w:barW,h:Math.max(hO,.01),fill:{color:C.cinzaBar},line:{width:0}});sl.addShape(pptx.ShapeType.rect,{x:gx+barW+bgap,y:baseY-Math.max(hG,.01),w:barW,h:Math.max(hG,.01),fill:{color:C.verdeAc},line:{width:0}});sl.addShape(pptx.ShapeType.rect,{x:gx+2*(barW+bgap),y:baseY-Math.max(hP,.01),w:barW,h:Math.max(hP,.01),fill:{color:C.ambarAc},line:{width:0}});sl.addText(fmtBRLk(cat.orc),{x:gx-0.06,y:baseY-hO-0.18,w:barW+0.12,h:0.18,fontSize:5,color:"555555",align:"center",fontFace:"Segoe UI"});sl.addText(fmtBRLk(cat.gasto),{x:gx+barW+bgap-0.06,y:baseY-Math.max(hG,.01)-0.18,w:barW+0.12,h:0.18,fontSize:5,color:C.verde,align:"center",fontFace:"Segoe UI"});sl.addText(fmtBRLk(cat.prov),{x:gx+2*(barW+bgap)-0.06,y:baseY-Math.max(hP,.01)-0.18,w:barW+0.12,h:0.18,fontSize:5,color:C.ambar,align:"center",fontFace:"Segoe UI"});const sl2=cat.label.length>20?cat.label.substring(0,20)+"…":cat.label;sl.addText(sl2,{x:gx-0.1,y:baseY+0.06,w:barW*3+bgap*2+0.2,h:0.2,fontSize:7.5,bold:true,color:"555555",align:"center",fontFace:"Segoe UI"});});
      const tY=4.58,tblW=W-0.6;
      const cols=[tblW*0.35,tblW*0.16,tblW*0.16,tblW*0.16,tblW*0.17];
      const rowH=0.24,hdrH=0.26;
      let cx=0.3;
      ["CATEGORIA","ORÇADO","GASTO","PROVISIONADO","SALDO"].forEach((h,i)=>{sl.addShape(pptx.ShapeType.rect,{x:cx,y:tY,w:cols[i],h:hdrH,fill:{color:"333333"},line:{width:0}});sl.addText(h,{x:cx+0.08,y:tY,w:cols[i]-0.1,h:hdrH,fontSize:7,bold:true,color:"AAAAAA",fontFace:"Segoe UI",valign:"middle",charSpacing:0.8});cx+=cols[i];});
      d.cats.forEach((cat,ri)=>{const rowY=tY+hdrH+ri*rowH;const bg=ri%2===0?"FFFFFF":C.bgLight;cx=0.3;const vals=[cat.label,fmtBRL(cat.orc),fmtBRL(cat.gasto),fmtBRL(cat.prov),fmtBRL(cat.saldo)];const colors=[C.dark,C.dark,C.dark,C.ambar,cat.saldo>=0?C.verde:"DC2626"];const bolds=[true,false,false,false,true];vals.forEach((v,i)=>{sl.addShape(pptx.ShapeType.rect,{x:cx,y:rowY,w:cols[i],h:rowH,fill:{color:bg},line:{color:C.border,width:0.5}});sl.addText(v,{x:cx+0.08,y:rowY,w:cols[i]-0.1,h:rowH,fontSize:8,bold:bolds[i],color:colors[i],fontFace:"Segoe UI",valign:"middle"});cx+=cols[i];});});
      const totRowY=tY+hdrH+d.cats.length*rowH;cx=0.3;
      const totVals=["TOTAL",fmtBRL(d.orc),fmtBRL(d.gasto),fmtBRL(d.prov),fmtBRL(d.saldo)];
      const totColors=["FFFFFF","FFFFFF","FFFFFF","FCD34D",d.saldo>=0?"4ADE80":"F87171"];
      totVals.forEach((v,i)=>{sl.addShape(pptx.ShapeType.rect,{x:cx,y:totRowY,w:cols[i],h:rowH,fill:{color:"111827"},line:{width:0}});sl.addText(v,{x:cx+0.08,y:totRowY,w:cols[i]-0.1,h:rowH,fontSize:8,bold:true,color:totColors[i],fontFace:"Segoe UI",valign:"middle"});cx+=cols[i];});
      const sY=6.6,sH=0.9;sl.addShape(pptx.ShapeType.rect,{x:0,y:sY,w:W,h:sH,fill:{color:C.strip},line:{width:0}});
      sl.addText("RODADA",{x:0.25,y:sY+0.1,w:1.8,h:0.18,fontSize:6,bold:true,color:"777777",charSpacing:1,fontFace:"Segoe UI"});sl.addText(`${d.rod} / 38`,{x:0.25,y:sY+0.28,w:1.8,h:0.44,fontSize:20,bold:true,color:"F9FAFB",fontFace:"Segoe UI"});
      const sCols=[{label:"ORÇADO TOTAL CAMPEONATO",value:fmtBRL(d.orcTot),color:"F9FAFB"},{label:"SALDO TOTAL",value:(d.saldo>=0?"▲ ":"▼ ")+fmtBRLk(Math.abs(d.saldo)),color:d.saldo>=0?"4ADE80":"F87171"}];
      const scW=(W-2.2)/sCols.length;
      sCols.forEach((c,i)=>{const cx2=2.2+i*scW;sl.addShape(pptx.ShapeType.line,{x:cx2,y:sY+0.12,w:0,h:sH-0.24,line:{color:"2D2D2D",width:0.75}});sl.addText(c.label,{x:cx2+0.15,y:sY+0.1,w:scW-0.2,h:0.2,fontSize:5.8,bold:true,color:"777777",charSpacing:0.5,fontFace:"Segoe UI"});sl.addText(c.value,{x:cx2+0.15,y:sY+0.32,w:scW-0.2,h:0.4,fontSize:13,bold:true,color:c.color,fontFace:"Segoe UI"});});
      await pptx.writeFile({fileName:`Fixos_Brasileirao2026_R${d.rod}.pptx`});
      setStatus({msg:`✅ Fixos_Brasileirao2026_R${d.rod}.pptx baixado!`,cls:"ok"});
    } catch(e){setStatus({msg:"❌ Erro: "+e.message,cls:"err"});}
    setLoading(false);
  }

  return (
    <div style={{paddingBottom:80}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={onBack} style={{...btnStyle,background:T.border,color:T.text,padding:"6px 14px",fontSize:12}}>← Voltar</button>
        <div>
          <h2 style={{margin:0,fontSize:15,color:T.text,fontWeight:700}}>🔒 Custos Fixos</h2>
          <p style={{margin:"2px 0 0",fontSize:12,color:T.textMd}}>Serviços fixos do campeonato</p>
        </div>
      </div>

      {/* S1 Config */}
      <div style={{background:T.card,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:18}}>
          <span style={{fontSize:10,color:T.textSm,fontWeight:700,marginRight:8}}>01</span>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:T.text}}>Configuração Base</span>
          <span style={{marginLeft:"auto",fontSize:11,color:T.textSm}}>Atualizar a cada rodada</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Rodada de Referência *</label><input type="number" min={1} max={38} value={rodadaAtual} onChange={e=>setRodadaAtual(parseInt(e.target.value)||1)} style={{...IS}}/></div>
          <div><label style={{color:T.textSm,fontSize:11,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Orçado Total – Campeonato *</label><input value={orcTotal} onChange={e=>setOrcTotal(e.target.value)} style={{...IS,color:"#3b82f6"}}/></div>
        </div>
      </div>

      {/* S2 Totais rápidos */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[{l:"Orçado Total",v:fmt(totals.orc),c:"#3b82f6"},{l:"Gasto Total",v:fmt(totals.gasto),c:T.text},{l:"Provisionado Total",v:fmt(totals.prov),c:"#f59e0b"},{l:"Saldo Total",v:fmt(totals.saldo),c:totals.saldo>=0?"#22c55e":"#ef4444"}].map(k=>(
          <div key={k.l} style={{background:T.card,borderRadius:10,padding:"14px 16px",borderTop:`3px solid ${k.c}`}}>
            <p style={{color:T.textSm,fontSize:10,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{k.l}</p>
            <p style={{color:k.c,fontWeight:700,fontSize:15,margin:0}}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Categorias */}
      {cats.map(cat => {
        const ct = calcCat(cat);
        const isOpen = !collapsed[cat.id];
        return (
          <div key={cat.id} style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:16}}>
            {/* Cat header */}
            <div onClick={()=>toggleCat(cat.id)} style={{padding:"12px 20px",background:T.bg,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{color:T.textSm,fontSize:10,transition:"transform .2s",display:"inline-block",transform:isOpen?"rotate(0)":"rotate(-90deg)"}}>▼</span>
                <span style={{fontWeight:800,fontSize:12,letterSpacing:2,textTransform:"uppercase",color:"#3b82f6"}}>{cat.label}</span>
              </div>
              <div style={{display:"flex",gap:20,fontSize:12}}>
                <span style={{color:T.textMd}}>Orç: <b style={{color:"#3b82f6"}}>{fmt(ct.orc)}</b></span>
                <span style={{color:T.textMd}}>Gasto: <b style={{color:T.text}}>{fmt(ct.gasto)}</b></span>
                <span style={{color:T.textMd}}>Prov: <b style={{color:"#f59e0b"}}>{fmt(ct.prov)}</b></span>
                <span style={{color:T.textMd}}>Saldo: <b style={{color:ct.saldo>=0?"#22c55e":"#ef4444"}}>{fmt(ct.saldo)}</b></span>
              </div>
            </div>

            {isOpen && (
              <div>
                {cat.subs.map(sub => {
                  const st = calcSub(sub);
                  const subOpen = !collapsedSubs[sub.id];
                  return (
                    <div key={sub.id} style={{borderTop:`1px solid ${T.border}`}}>
                      {/* Sub header */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 20px",background:T.card,cursor:"pointer"}} onClick={()=>toggleSub(sub.id)}>
                        <div style={{display:"flex",alignItems:"center",gap:8}} onClick={e=>e.stopPropagation()}>
                          <span onClick={()=>toggleSub(sub.id)} style={{color:T.textSm,fontSize:10,cursor:"pointer",transform:subOpen?"rotate(0)":"rotate(-90deg)",display:"inline-block",transition:"transform .2s"}}>▼</span>
                          <input value={sub.nome} onChange={e=>updateSubNome(cat.id,sub.id,e.target.value)} onClick={e=>e.stopPropagation()} style={{background:"transparent",border:"none",color:T.text,fontWeight:600,fontSize:13,cursor:"text",fontFamily:"inherit",outline:"none",width:240,borderBottom:`1px solid transparent`}} onFocus={e=>e.target.style.borderBottom=`1px solid #3b82f6`} onBlur={e=>e.target.style.borderBottom=`1px solid transparent`}/>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:16,fontSize:11}}>
                          <span style={{color:T.textMd}}>Orç: <b style={{color:"#3b82f6"}}>{fmt(st.orc)}</b></span>
                          <span style={{color:T.textMd}}>Gasto: <b style={{color:T.text}}>{fmt(st.gasto)}</b></span>
                          <span style={{color:T.textMd}}>Saldo: <b style={{color:st.saldo>=0?"#22c55e":"#ef4444"}}>{fmt(st.saldo)}</b></span>
                          <button onClick={e=>{e.stopPropagation();removeSub(cat.id,sub.id);}} style={{background:"none",border:"none",color:T.textSm,cursor:"pointer",fontSize:11,padding:"2px 6px",borderRadius:4}} onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color=T.textSm}>✕</button>
                        </div>
                      </div>

                      {subOpen && (
                        <div style={{padding:"12px 20px"}}>
                          <div style={{overflowX:"auto"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                              <thead>
                                <tr style={{background:T.bg}}>
                                  {["Item / Serviço","Orçado (R$)","Gasto (R$)","Provisionado (R$)","Saldo (R$)",""].map((h,i)=>(
                                    <th key={h} style={{padding:"7px 10px",textAlign:i===0?"left":"right",color:T.textSm,fontSize:10,letterSpacing:1,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
                                      {h}{i===4&&<span style={{background:"#052e16",color:"#4ade80",fontSize:8,padding:"1px 5px",borderRadius:2,marginLeft:4,fontWeight:700}}>AUTO</span>}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sub.itens.map(item => {
                                  const saldo = item.orc - item.gasto - item.prov;
                                  return (
                                    <tr key={item.id} style={{borderBottom:`1px solid ${T.border}`}}>
                                      <td style={{padding:"4px 6px"}}><input value={item.nome} onChange={e=>updateItem(cat.id,sub.id,item.id,"nome",e.target.value)} placeholder="Nome do item" style={{...IS,fontSize:12,padding:"6px 8px"}}/></td>
                                      {[["orc","#3b82f6"],["gasto",T.text],["prov","#f59e0b"]].map(([field,color])=>(
                                        <td key={field} style={{padding:"4px 6px",textAlign:"right"}}>
                                          <input value={fmtNum(item[field])} onChange={e=>updateItem(cat.id,sub.id,item.id,field,e.target.value)} style={{...IS,width:120,textAlign:"right",padding:"6px 8px",fontSize:12,color}}/>
                                        </td>
                                      ))}
                                      <td style={{padding:"4px 6px",textAlign:"right"}}>
                                        <input readOnly value={fmtNum(saldo)} style={{...IS,width:120,textAlign:"right",padding:"6px 8px",fontSize:12,color:saldo>=0?"#4ade80":"#ef4444",background:saldo>=0?"#0a1a0f":"#2a0a0a",cursor:"default"}}/>
                                      </td>
                                      <td style={{padding:"4px 6px",textAlign:"center"}}>
                                        <button onClick={()=>removeItem(cat.id,sub.id,item.id)} style={{background:"none",border:"none",color:T.textSm,cursor:"pointer",fontSize:12,padding:"4px 8px"}} onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color=T.textSm}>✕</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <button onClick={()=>addItem(cat.id,sub.id)} style={{marginTop:8,background:"none",border:`1px dashed #1e3a5a`,color:"#3b82f6",padding:"5px 12px",borderRadius:7,cursor:"pointer",fontSize:11,letterSpacing:.4}}>+ Item</button>
                          {/* Sub footer totals */}
                          <div style={{display:"flex",gap:20,padding:"8px 10px",background:T.bg,borderRadius:7,marginTop:8,flexWrap:"wrap",fontSize:11}}>
                            {[{l:"Itens",v:sub.itens.length,c:T.text},{l:"Orçado",v:fmt(st.orc),c:"#3b82f6"},{l:"Gasto",v:fmt(st.gasto),c:T.text},{l:"Provisionado",v:fmt(st.prov),c:"#f59e0b"},{l:"Saldo",v:fmt(st.saldo),c:st.saldo>=0?"#22c55e":"#ef4444"}].map(x=>(
                              <div key={x.l}><div style={{color:T.textSm,fontSize:9,textTransform:"uppercase",letterSpacing:.5}}>{x.l}</div><div style={{color:x.c,fontWeight:700,marginTop:2}}>{x.v}</div></div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={()=>addSub(cat.id)} style={{width:"100%",background:"none",border:`1px dashed #1e2a1e`,color:"#4a6a4a",padding:"8px",borderRadius:"0 0 8px 8px",cursor:"pointer",fontSize:11,letterSpacing:.4}} onMouseEnter={e=>{e.target.style.background="#0d1a0d";e.target.style.color="#22c55e";}} onMouseLeave={e=>{e.target.style.background="none";e.target.style.color="#4a6a4a";}}>+ Adicionar Subcategoria</button>
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div style={{position:"sticky",bottom:0,left:0,right:0,background:T.card,borderTop:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:50,borderRadius:"0 0 12px 12px"}}>
        <div><p style={{fontSize:12,color:T.textMd,marginBottom:2}}><b style={{color:T.text}}>Tudo preenchido?</b> Clique para gerar o PPTX de Custos Fixos.</p><p style={{fontSize:11,color:status.cls==="ok"?"#22c55e":status.cls==="err"?"#ef4444":T.textSm}}>{status.msg}</p></div>
        <button onClick={gerarPPTX} disabled={loading} style={{...btnStyle,background:loading?"#1a2a3a":"#3b82f6",color:loading?"#60a5fa":"#fff",padding:"11px 28px",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",opacity:loading?0.7:1}}>{loading?"Gerando...":"📊 Gerar PPTX"}</button>
      </div>
    </div>
  );
}

// ─── BRASILEIRÃO ─────────────────────────────────────────────────────────────
function Brasileirao({onBack,T,darkMode,setDarkMode}) {
  const [jogos,setJogos]       = useState(ALL_JOGOS);
  const [servicos,setServicos] = useState(SERVICOS_INIT);

  const setJogosP=fn=>{setJogos(prev=>{const next=typeof fn==="function"?fn(prev):fn;return next;});};
  const setServicosP=fn=>{setServicos(prev=>{const next=typeof fn==="function"?fn(prev):fn;return next;});};

  const varCalc=useMemo(()=>{
    const allJ=jogos.filter(j=>j.mandante!=="A definir");
    const result=CATS.map(cat=>({nome:cat.label,orcado:allJ.reduce((s,j)=>s+catTotal(j.orcado,cat),0),provisionado:allJ.reduce((s,j)=>s+catTotal(j.provisionado,cat),0),realizado:allJ.reduce((s,j)=>s+catTotal(j.realizado,cat),0),tipo:"variavel"}));
    const extraOrc=allJ.reduce((s,j)=>s+((j.orcado&&j.orcado.extra)||0),0);
    result.push({nome:"Extra",orcado:extraOrc,provisionado:0,realizado:0,tipo:"variavel"});
    return result;
  },[jogos]);
  const fixosCalc=useMemo(()=>servicos.map(s=>({nome:s.secao,orcado:s.itens.reduce((t,i)=>t+i.orcado,0),provisionado:s.itens.reduce((t,i)=>t+i.provisionado,0),realizado:s.itens.reduce((t,i)=>t+i.realizado,0),tipo:"fixo"})),[servicos]);
  const RESUMO_CATS=[...varCalc,...fixosCalc];

  const [tab,setTab]=useState("dashboard");
  const [showNovo,setNovo]=useState(false);
  const [novoRapido,setNovoRapido]=useState(null);
  const [filtroRod,setFiltroRod]=useState("Todas");
  const [filtroCat,setFiltroCat]=useState("Todas");
  const [showPlaceholder,setShowPlaceholder]=useState(false);
  const [microJogoId,setMicroJogoId]=useState(JOGOS_REAIS[0].id);

  const saveJogo=j=>setJogosP(js=>js.map(x=>x.id===j.id?j:x));
  const addJogo=j=>{setJogosP(js=>[...js,j]);setNovo(false);setNovoRapido(null);};
  const totalOrc=RESUMO_CATS.reduce((s,c)=>s+c.orcado,0),totalProv=RESUMO_CATS.reduce((s,c)=>s+c.provisionado,0),totalReal=RESUMO_CATS.reduce((s,c)=>s+c.realizado,0);
  const pctGasto=totalOrc?((totalReal/totalOrc)*100).toFixed(1):0;
  const divulgados=jogos.filter(j=>j.mandante!=="A definir"),aDivulgar=jogos.filter(j=>j.mandante==="A definir");
  const rodadasList=["Todas",...Array.from(new Set(divulgados.map(j=>j.rodada))).sort((a,b)=>a-b).map(String)];
  const filtrados=(showPlaceholder?jogos:divulgados).filter(j=>(filtroRod==="Todas"||j.rodada===parseInt(filtroRod))&&(filtroCat==="Todas"||j.categoria===filtroCat));
  const savingRodada=useMemo(()=>{const map={};divulgados.forEach(j=>{const r=`R${j.rodada}`;if(!map[r])map[r]={name:r,"Saving":0};map[r]["Saving"]+=subTotal(j.orcado)-subTotal(j.provisionado);});return Object.values(map).sort((a,b)=>parseInt(a.name.slice(1))-parseInt(b.name.slice(1)));},[jogos]);
  const jogosFiltered=divulgados.filter(j=>(filtroRod==="Todas"||j.rodada===parseInt(filtroRod))&&(filtroCat==="Todas"||j.categoria===filtroCat));
  const totOrcJogos=jogosFiltered.reduce((s,j)=>s+subTotal(j.orcado),0),totProvJogos=jogosFiltered.reduce((s,j)=>s+subTotal(j.provisionado),0),totRealJogos=jogosFiltered.reduce((s,j)=>s+subTotal(j.realizado),0);
  const TABS=["dashboard","serviços","jogos","micro","savings","gráficos","relatório","apresentações"];

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Inter',sans-serif",paddingBottom:40}}>
      <div style={{background:"linear-gradient(135deg,#166534,#15803d,#166534)",padding:"16px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button onClick={onBack} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600}}>← Portal</button>
            <div>
              <p style={{color:"#86efac",fontSize:11,letterSpacing:2,textTransform:"uppercase",margin:"0 0 2px"}}>FFU — Transmissões</p>
              <h1 style={{fontSize:19,fontWeight:700,margin:0,color:"#fff"}}>Brasileirão Série A 2026</h1>
              <p style={{color:"#bbf7d0",fontSize:11,margin:"2px 0 0"}}>{divulgados.length} jogos divulgados · {aDivulgar.length} a divulgar · 38 rodadas</p>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            <button onClick={()=>setDarkMode(d=>!d)} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:12,color:"#fff",fontWeight:600}}>{darkMode?"☀️ Claro":"🌙 Escuro"}</button>
            <div style={{textAlign:"right"}}><p style={{color:"#86efac",fontSize:10,margin:"0 0 1px"}}>Execução geral</p><p style={{fontSize:26,fontWeight:800,color:pctGasto>80?"#fca5a5":"#86efac",margin:0}}>{pctGasto}%</p></div>
          </div>
        </div>
        <div style={{display:"flex",gap:2,marginTop:14,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          {TABS.map(t=>(<button key={t} onClick={()=>setTab(t)} style={{padding:"8px 14px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",whiteSpace:"nowrap",background:tab===t?T.bg:"rgba(255,255,255,0.12)",color:tab===t?"#22c55e":"#e2e8f0",fontWeight:tab===t?700:400,fontSize:13,textTransform:"capitalize",flexShrink:0}}>{t}</button>))}
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
              <div style={{display:"flex",gap:12,fontSize:12,color:T.textMd}}><span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"#6366f1",marginRight:4}}/>Fixo</span><span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"#f43f5e",marginRight:4}}/>Variável</span></div>
            </div>
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
              <thead><tr style={{background:T.bg}}>{["Categoria","Tipo","Orçado","Provisionado","Realizado","Saldo","% Exec.","Progresso"].map(h=><th key={h} style={{padding:"10px 16px",textAlign:h==="Categoria"||h==="Tipo"?"left":"right",color:T.textSm,fontSize:12,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {RESUMO_CATS.map(c=>{const saldo=c.orcado-c.realizado;const pct=c.orcado?Math.min(100,(c.realizado/c.orcado)*100):0;return(<tr key={c.nome} style={{borderTop:`1px solid ${T.border}`}}><td style={{padding:"12px 16px",fontWeight:600,whiteSpace:"nowrap",color:T.text}}>{c.nome}</td><td style={{padding:"12px 16px"}}><Pill label={c.tipo} color={TIPO_COLOR[c.tipo]}/></td><td style={{padding:"12px 16px",textAlign:"right",whiteSpace:"nowrap",color:T.text}}>{fmt(c.orcado)}</td><td style={{padding:"12px 16px",textAlign:"right",color:"#3b82f6",whiteSpace:"nowrap"}}>{fmt(c.provisionado||0)}</td><td style={{padding:"12px 16px",textAlign:"right",color:"#f59e0b",whiteSpace:"nowrap"}}>{fmt(c.realizado)}</td><td style={{padding:"12px 16px",textAlign:"right",fontWeight:600,color:saldo<0?"#ef4444":"#22c55e",whiteSpace:"nowrap"}}>{fmt(saldo)}</td><td style={{padding:"12px 16px",textAlign:"right",color:T.text}}>{pct.toFixed(1)}%</td><td style={{padding:"12px 20px"}}><div style={{background:T.border,borderRadius:4,height:8,minWidth:60}}><div style={{background:pct>90?"#ef4444":pct>60?"#f59e0b":"#22c55e",width:`${pct}%`,height:"100%",borderRadius:4}}/></div></td></tr>);})}
                <tr style={{borderTop:`2px solid ${T.muted}`,background:T.bg,fontWeight:700}}><td colSpan={2} style={{padding:"12px 16px",color:T.text}}>TOTAL GERAL</td><td style={{padding:"12px 16px",textAlign:"right",color:"#22c55e",whiteSpace:"nowrap"}}>{fmt(totalOrc)}</td><td style={{padding:"12px 16px",textAlign:"right",color:"#3b82f6",whiteSpace:"nowrap"}}>{fmt(totalProv)}</td><td style={{padding:"12px 16px",textAlign:"right",color:"#f59e0b",whiteSpace:"nowrap"}}>{fmt(totalReal)}</td><td style={{padding:"12px 16px",textAlign:"right",color:(totalOrc-totalReal)>=0?"#22c55e":"#ef4444",whiteSpace:"nowrap"}}>{fmt(totalOrc-totalReal)}</td><td style={{padding:"12px 16px",textAlign:"right",color:T.text}}>{pctGasto}%</td><td/></tr>
              </tbody>
            </table></div>
          </div>
        </>)}

        {tab==="jogos"&&(<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {rodadasList.map(r=>(<button key={r} onClick={()=>setFiltroRod(r)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:filtroRod===r?"#22c55e":T.card,color:filtroRod===r?"#fff":T.textMd}}>{r==="Todas"?"Todas":`Rd ${r}`}</button>))}
              <div style={{width:1,background:T.border,margin:"0 4px"}}/>
              {["Todas","B1","B2"].map(c=>(<button key={c} onClick={()=>setFiltroCat(c)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:filtroCat===c?"#f59e0b":T.card,color:filtroCat===c?"#000":T.textMd}}>{c==="Todas"?"B1+B2":c}</button>))}
              <button onClick={()=>setShowPlaceholder(p=>!p)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:showPlaceholder?"#8b5cf6":T.card,color:showPlaceholder?"#fff":T.textMd}}>{showPlaceholder?"Ocultar a divulgar":"Ver a divulgar"}</button>
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
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
              <thead><tr style={{background:T.bg}}>{["Jogo","Rd","Cidade","Data","Cat.","Detentor","Orçado","Provisionado","Realizado","Saving",""].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",color:T.textSm,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {filtrados.map(j=>{const o=subTotal(j.orcado),p=subTotal(j.provisionado),r=subTotal(j.realizado);const isDef=j.mandante==="A definir";
                  return(<tr key={j.id} style={{borderTop:`1px solid ${T.border}`,opacity:isDef?0.45:1}}>
                    <td style={{padding:"10px 12px",fontWeight:600,fontSize:13,whiteSpace:"nowrap",color:T.text}}>{isDef?<span style={{color:T.textSm,fontStyle:"italic"}}>A divulgar</span>:`${j.mandante} x ${j.visitante}`}</td>
                    <td style={{padding:"10px 12px",color:T.textMd,fontSize:12}}>{j.rodada}</td>
                    <td style={{padding:"10px 12px",color:T.textMd,fontSize:12,whiteSpace:"nowrap"}}>{j.cidade}</td>
                    <td style={{padding:"10px 12px",color:T.textMd,fontSize:12,whiteSpace:"nowrap"}}>{j.data}</td>
                    <td style={{padding:"10px 12px"}}><Pill label={j.categoria} color={j.categoria==="B1"?"#22c55e":"#f59e0b"}/></td>
                    <td style={{padding:"10px 12px",fontSize:11,color:T.textMd,whiteSpace:"nowrap"}}>{j.detentor}</td>
                    <td style={{padding:"10px 12px",fontSize:13,whiteSpace:"nowrap",color:T.text}}>{fmtK(o)}</td>
                    <td style={{padding:"10px 12px",fontSize:13,color:"#3b82f6",whiteSpace:"nowrap"}}>{fmtK(p)}</td>
                    <td style={{padding:"10px 12px",fontSize:13,color:"#f59e0b",whiteSpace:"nowrap"}}>{fmtK(r)}</td>
                    <td style={{padding:"10px 12px",fontWeight:600,color:(o-p)>=0?"#22c55e":"#ef4444",whiteSpace:"nowrap"}}>{fmtK(o-p)}</td>
                    <td style={{padding:"10px 12px"}}><button onClick={()=>{setMicroJogoId(j.id);setTab("micro");}} style={{...btnStyle,background:"#1d4ed8",padding:"4px 10px",fontSize:11}}>🔍</button></td>
                  </tr>);
                })}
              </tbody>
            </table></div>
          </div>
        </>)}

        {tab==="micro"&&<VisaoMicro jogos={jogos} jogoId={microJogoId} onChangeJogo={setMicroJogoId} onSave={saveJogo} T={T}/>}
        {tab==="serviços"&&<TabServicos servicos={servicos} setServicos={setServicosP} T={T}/>}

        {tab==="savings"&&(<>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
            {["Todas",...Array.from(new Set(divulgados.map(j=>j.rodada))).sort((a,b)=>a-b).map(String)].map(r=>(<button key={r} onClick={()=>setFiltroRod(r)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:filtroRod===r?"#22c55e":T.card,color:filtroRod===r?"#fff":T.textMd}}>{r==="Todas"?"Todas":`Rd ${r}`}</button>))}
            <div style={{width:1,background:T.border,margin:"0 4px"}}/>
            {["Todas","B1","B2"].map(c=>(<button key={c} onClick={()=>setFiltroCat(c)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:filtroCat===c?"#f59e0b":T.card,color:filtroCat===c?"#000":T.textMd}}>{c==="Todas"?"B1+B2":c}</button>))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
            <KPI label="Saving (Orç − Prov)" value={fmt(totOrcJogos-totProvJogos)} sub={`${totOrcJogos?((totOrcJogos-totProvJogos)/totOrcJogos*100).toFixed(1):0}% do budget`} color="#22c55e" T={T}/>
            <KPI label="% Saving" value={totOrcJogos?`${((totOrcJogos-totProvJogos)/totOrcJogos*100).toFixed(1)}%`:"—"} sub="sobre o orçado" color="#3b82f6" T={T}/>
            <KPI label="Custo Médio / Jogo" value={jogosFiltered.length?fmt(totOrcJogos/jogosFiltered.length):"—"} sub="orçado" color="#8b5cf6" T={T}/>
          </div>
          <div style={{background:T.card,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}><h3 style={{margin:0,fontSize:14,color:T.textMd}}>Saving por Jogo</h3></div>
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
              <thead><tr style={{background:T.bg}}>{["Jogo","Rd","Cat.","Orçado","Provisionado","Saving (Orç − Prov)"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",color:T.textSm,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {jogosFiltered.map(j=>{const o=subTotal(j.orcado),p=subTotal(j.provisionado),sv=o-p;
                  return(<tr key={j.id} style={{borderTop:`1px solid ${T.border}`}}>
                    <td style={{padding:"10px 14px",fontWeight:600,fontSize:13,whiteSpace:"nowrap",color:T.text}}>{j.mandante} x {j.visitante}</td>
                    <td style={{padding:"10px 14px",color:T.textMd}}>{j.rodada}</td>
                    <td style={{padding:"10px 14px"}}><Pill label={j.categoria} color={j.categoria==="B1"?"#22c55e":"#f59e0b"}/></td>
                    <td style={{padding:"10px 14px",whiteSpace:"nowrap",color:T.text}}>{fmt(o)}</td>
                    <td style={{padding:"10px 14px",color:"#3b82f6",whiteSpace:"nowrap"}}>{fmt(p)}</td>
                    <td style={{padding:"10px 14px",fontWeight:700,color:sv>=0?"#22c55e":"#ef4444",whiteSpace:"nowrap"}}>{fmt(sv)}</td>
                  </tr>);
                })}
                <tr style={{borderTop:`2px solid ${T.muted}`,background:T.bg,fontWeight:700}}>
                  <td colSpan={3} style={{padding:"12px 14px",color:T.text}}>TOTAL</td>
                  <td style={{padding:"12px 14px",whiteSpace:"nowrap",color:T.text}}>{fmt(totOrcJogos)}</td>
                  <td style={{padding:"12px 14px",color:"#3b82f6",whiteSpace:"nowrap"}}>{fmt(totProvJogos)}</td>
                  <td style={{padding:"12px 14px",fontWeight:700,color:(totOrcJogos-totProvJogos)>=0?"#22c55e":"#ef4444",whiteSpace:"nowrap"}}>{fmt(totOrcJogos-totProvJogos)}</td>
                </tr>
              </tbody>
            </table></div>
          </div>
        </>)}

        {tab==="gráficos"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:20}}>
            <div style={{background:T.card,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:14,color:T.textMd}}>Saving por Rodada</h3>
              <ResponsiveContainer width="100%" height={260}><BarChart data={savingRodada}><XAxis dataKey="name" tick={{fill:T.textMd,fontSize:11}}/><YAxis tickFormatter={fmtK} tick={{fill:T.textMd,fontSize:11}}/><Tooltip content={<CustomTooltip T={T}/>}/><Bar dataKey="Saving" fill="#22c55e" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
            </div>
            <div style={{background:T.card,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:14,color:T.textMd}}>Distribuição do Budget</h3>
              <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={RESUMO_CATS.map(c=>({name:c.nome,value:c.orcado}))} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>{RESUMO_CATS.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmt(v)}/></PieChart></ResponsiveContainer>
            </div>
            <div style={{background:T.card,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:14,color:T.textMd}}>Orçado por Jogo — B1 vs B2</h3>
              <ResponsiveContainer width="100%" height={260}><BarChart data={divulgados.map(j=>({name:`R${j.rodada} ${j.mandante.split(" ")[0]}`,valor:subTotal(j.orcado),cat:j.categoria}))}><XAxis dataKey="name" tick={{fill:T.textMd,fontSize:9}}/><YAxis tickFormatter={fmtK} tick={{fill:T.textMd,fontSize:11}}/><Tooltip content={<CustomTooltip T={T}/>}/><Bar dataKey="valor" radius={[4,4,0,0]}>{divulgados.map(j=><Cell key={j.id} fill={j.categoria==="B1"?"#22c55e":"#f59e0b"}/>)}</Bar></BarChart></ResponsiveContainer>
            </div>
          </div>
        )}

        {tab==="relatório"&&<TabRelatorio jogos={jogos} servicos={servicos} T={T}/>}
        {tab==="apresentações"&&<TabApresentacoes T={T}/>}
      </div>

      {showNovo&&<NovoJogoModal onSave={addJogo} onClose={()=>setNovo(false)} T={T}/>}
      {novoRapido&&<NovoRapidoModal cenario={novoRapido} jogos={jogos} onSave={addJogo} onClose={()=>setNovoRapido(null)} T={T}/>}
    </div>
  );
}

export default function App() {
  const [darkMode,setDarkMode]=useState(true);
  const [pagina,setPagina]=useState("home");
  const T=darkMode?DARK:LIGHT;
  const toggleDark=v=>{const next=typeof v==="function"?v(darkMode):v;setDarkMode(next);};
  if(pagina==="home") return <Home onEnter={setPagina} T={T} darkMode={darkMode} setDarkMode={toggleDark}/>;
  if(pagina==="brasileirao-2026") return <Brasileirao onBack={()=>setPagina("home")} T={T} darkMode={darkMode} setDarkMode={toggleDark}/>;
  return <Home onEnter={setPagina} T={T} darkMode={darkMode} setDarkMode={toggleDark}/>;
}
