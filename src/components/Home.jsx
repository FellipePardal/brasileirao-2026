import { CAMPEONATOS } from "../constants";
import { btnStyle } from "../constants";

export default function Home({onEnter, T, darkMode, setDarkMode}) {
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
            <button onClick={()=>setDarkMode(d=>!d)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 14px",cursor:"pointer",fontSize:12,color:"#94a3b8",fontWeight:600}}>
              {darkMode ? "☀️ Claro" : "🌙 Escuro"}
            </button>
          </div>
        </div>
      </div>

      <div style={{padding:"32px 24px",maxWidth:900,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:36}}>
          {[
            {label:"Campeonatos Ativos",value:"1",sub:"de 2 planejados",color:"#22c55e"},
            {label:"Temporada",value:"2026",sub:"FFU Transmissões",color:"#3b82f6"},
          ].map(k => (
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
          {CAMPEONATOS.map(camp => (
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
                {camp.id==="brasileirao-2026" && (
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",gap:16,fontSize:12}}>
                      <span style={{color:T.textMd}}>Rodadas: <b style={{color:T.text}}>{camp.rodadas}</b></span>
                      <span style={{color:T.textMd}}>Detentores: <b style={{color:T.text}}>CazeTV · Amazon</b></span>
                    </div>
                  </div>
                )}
                {camp.emBreve && <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px",fontStyle:"italic"}}>Em estruturação — será disponibilizado em breve.</p>}
                <button
                  onClick={()=>!camp.emBreve&&onEnter(camp.id)}
                  style={{...btnStyle,background:camp.emBreve?T.border:camp.cor,width:"100%",padding:"11px",fontSize:14,borderRadius:10,cursor:camp.emBreve?"not-allowed":"pointer",opacity:camp.emBreve?0.5:1}}
                >
                  {camp.emBreve ? "🔒 Em breve" : "Abrir campeonato →"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:48,textAlign:"center",color:T.textSm,fontSize:11}}>FFU Portal Financeiro · Temporada 2026 · Todos os campeonatos</div>
      </div>
    </div>
  );
}
