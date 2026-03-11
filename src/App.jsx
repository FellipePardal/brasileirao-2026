import { useState } from "react";
import { DARK, LIGHT, btnStyle, iSty, CENARIO_INFO, LS_JOGOS, LS_SERVICOS, LS_DARK } from "./constants";
import { lsGet, lsSet } from "./utils";
import { ALL_JOGOS, SERVICOS_INIT } from "./data";

import Home             from "./components/Home";
import TabRelatorio     from "./components/tabs/TabRelatorio";
import TabServicos      from "./components/tabs/TabServicos";
import TabApresentacoes from "./components/tabs/TabApresentacoes";
import VisaoMicro       from "./components/tabs/VisaoMicro";
import { NovoJogoModal, NovoRapidoModal } from "./components/modals/NovoJogoModal";

const TABS = [
  { id:"dashboard",     label:"📊 Dashboard"     },
  { id:"jogos",         label:"🎮 Jogos"          },
  { id:"servicos",      label:"🔧 Serviços"       },
  { id:"relatorio",     label:"📋 Relatório"      },
  { id:"apresentacoes", label:"📽 Apresentações"  },
];

export default function App() {
  const [darkMode,    setDarkMode]    = useState(() => lsGet(LS_DARK, true));
  const [campeonato,  setCampeonato]  = useState(null);
  const [activeTab,   setActiveTab]   = useState("dashboard");
  const [jogos,       setJogos]       = useState(() => lsGet(LS_JOGOS, ALL_JOGOS));
  const [servicos,    setServicos]    = useState(() => lsGet(LS_SERVICOS, SERVICOS_INIT));
  const [jogoAtivo,   setJogoAtivo]   = useState(null);
  const [modalNovo,   setModalNovo]   = useState(false);
  const [modalRapido, setModalRapido] = useState(null); // cenário: "b1" | "b2s" | "b2sul"

  const T = darkMode ? DARK : LIGHT;

  // Persiste jogos e serviços no localStorage sempre que mudam
  const updateJogos = next => { setJogos(next); lsSet(LS_JOGOS, next); };
  const updateServicos = next => { setServicos(next); lsSet(LS_SERVICOS, next); };

  const saveJogo = updated => updateJogos(jogos.map(j => j.id===updated.id ? updated : j));
  const addJogo  = novo    => {
    const next = [...jogos, novo];
    updateJogos(next);
    setJogoAtivo(novo.id);
    setActiveTab("jogos");
  };

  // Tela inicial
  if(!campeonato) {
    return <Home onEnter={id=>{setCampeonato(id); lsSet(LS_DARK, darkMode);}} T={T} darkMode={darkMode} setDarkMode={d=>{setDarkMode(d);lsSet(LS_DARK,d);}}/>;
  }

  return (
    <div style={{minHeight:"100vh", background:T.bg, color:T.text}}>

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)", padding:"16px 24px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setCampeonato(null)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,color:"#94a3b8"}}>← Portal</button>
          <span style={{color:"#f1f5f9",fontWeight:700,fontSize:16}}>🇧🇷 Brasileirão 2026</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setModalNovo(true)}      style={{...btnStyle,background:"#22c55e",padding:"6px 14px",fontSize:12}}>+ Jogo</button>
          {Object.entries(CENARIO_INFO).map(([key,info])=>(
            <button key={key} onClick={()=>setModalRapido(key)} style={{...btnStyle,background:info.color+"22",color:info.color,border:`1px solid ${info.color}44`,padding:"5px 12px",fontSize:11}}>+ {info.label}</button>
          ))}
          <button onClick={()=>{ const d=!darkMode; setDarkMode(d); lsSet(LS_DARK,d); }} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 14px",cursor:"pointer",fontSize:12,color:"#94a3b8"}}>
            {darkMode?"☀️":"🌙"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,padding:"12px 24px 0",borderBottom:`1px solid ${T.border}`,background:T.card,overflowX:"auto"}}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{padding:"8px 18px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,borderRadius:"8px 8px 0 0",background:activeTab===tab.id?"#22c55e":T.bg,color:activeTab===tab.id?"#fff":T.textMd,whiteSpace:"nowrap"}}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{padding:"24px", maxWidth:1200, margin:"0 auto"}}>
        {activeTab==="dashboard"     && <TabRelatorio    jogos={jogos} servicos={servicos} T={T}/>}
        {activeTab==="jogos"         && <VisaoMicro      jogos={jogos} jogoId={jogoAtivo || jogos.filter(j=>j.mandante!=="A definir")[0]?.id} onChangeJogo={setJogoAtivo} onSave={saveJogo} T={T}/>}
        {activeTab==="servicos"      && <TabServicos     servicos={servicos} setServicos={updateServicos} T={T}/>}
        {activeTab==="relatorio"     && <TabRelatorio    jogos={jogos} servicos={servicos} T={T}/>}
        {activeTab==="apresentacoes" && <TabApresentacoes T={T}/>}
      </div>

      {/* Modais */}
      {modalNovo && <NovoJogoModal  onSave={j=>{addJogo(j);setModalNovo(false);}} onClose={()=>setModalNovo(false)} T={T}/>}
      {modalRapido && <NovoRapidoModal cenario={modalRapido} jogos={jogos} onSave={j=>{addJogo(j);setModalRapido(null);}} onClose={()=>setModalRapido(null)} T={T}/>}
    </div>
  );
}
