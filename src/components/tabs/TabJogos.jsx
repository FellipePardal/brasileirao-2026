import { Pill } from "../shared";
import { fmtK, subTotal } from "../../utils";
import { btnStyle } from "../../constants";

export default function TabJogos({
  jogos, filtrados, filtroRod, setFiltroRod, filtroCat, setFiltroCat,
  showPlaceholder, setShowPlaceholder, rodadasList,
  setMicroJogoId, setTab, setNovo, setNovoRapido, T
}) {
  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {rodadasList.map(r => (
            <button key={r} onClick={()=>setFiltroRod(r)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:filtroRod===r?"#22c55e":T.card,color:filtroRod===r?"#fff":T.textMd}}>
              {r==="Todas" ? "Todas" : `Rd ${r}`}
            </button>
          ))}
          <div style={{width:1,background:T.border,margin:"0 4px"}}/>
          {["Todas","B1","B2"].map(c => (
            <button key={c} onClick={()=>setFiltroCat(c)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:filtroCat===c?"#f59e0b":T.card,color:filtroCat===c?"#000":T.textMd}}>
              {c==="Todas" ? "B1+B2" : c}
            </button>
          ))}
          <button onClick={()=>setShowPlaceholder(p=>!p)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,background:showPlaceholder?"#8b5cf6":T.card,color:showPlaceholder?"#fff":T.textMd}}>
            {showPlaceholder ? "Ocultar a divulgar" : "Ver a divulgar"}
          </button>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>setNovoRapido("b1")}    style={{...btnStyle,background:"#22c55e",fontSize:12}}>+ B1 Sudeste</button>
          <button onClick={()=>setNovoRapido("b2s")}   style={{...btnStyle,background:"#3b82f6",fontSize:12}}>+ B2 Sudeste</button>
          <button onClick={()=>setNovoRapido("b2sul")} style={{...btnStyle,background:"#f59e0b",color:"#000",fontSize:12}}>+ B2 Sul</button>
          <button onClick={()=>setNovo(true)}          style={{...btnStyle,background:"#475569",fontSize:12}}>+ Personalizado</button>
        </div>
      </div>

      <div style={{background:T.card,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,color:T.textSm,fontSize:12}}>
          {filtrados.length} jogos
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
            <thead>
              <tr style={{background:T.bg}}>
                {["Jogo","Rd","Cidade","Data","Cat.","Detentor","Orçado","Provisionado","Realizado","Saving",""].map(h => (
                  <th key={h} style={{padding:"10px 12px",textAlign:"left",color:T.textSm,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(j => {
                const o=subTotal(j.orcado), p=subTotal(j.provisionado), r=subTotal(j.realizado);
                const isDef = j.mandante==="A definir";
                return (
                  <tr key={j.id} style={{borderTop:`1px solid ${T.border}`,opacity:isDef?0.45:1}}>
                    <td style={{padding:"10px 12px",fontWeight:600,fontSize:13,whiteSpace:"nowrap",color:T.text}}>
                      {isDef ? <span style={{color:T.textSm,fontStyle:"italic"}}>A divulgar</span> : `${j.mandante} x ${j.visitante}`}
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
                      <button onClick={()=>{setMicroJogoId(j.id);setTab("micro");}} style={{...btnStyle,background:"#1d4ed8",padding:"4px 10px",fontSize:11}}>🔍</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
