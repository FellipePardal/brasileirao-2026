import { useState } from "react";
import { CATS } from "../../constants";
import { fmt, catTotal } from "../../utils";
import { KPI } from "../shared";

export default function TabRelatorio({jogos, servicos, T}) {
  const divulgados = jogos.filter(j => j.mandante !== "A definir");
  const [filtroRod, setFiltroRod] = useState("Todas");
  const [filtroCat, setFiltroCat] = useState("Todas");

  const jogosF = divulgados.filter(j =>
    (filtroRod==="Todas" || j.rodada===parseInt(filtroRod)) &&
    (filtroCat==="Todas" || j.categoria===filtroCat)
  );

  const catTotals = CATS.map(cat => ({
    label: cat.label, color: cat.color,
    orc:  jogosF.reduce((s,j) => s+catTotal(j.orcado, cat), 0),
    prov: jogosF.reduce((s,j) => s+catTotal(j.provisionado, cat), 0),
    real: jogosF.reduce((s,j) => s+catTotal(j.realizado, cat), 0),
  }));

  const totOrc  = catTotals.reduce((s,c) => s+c.orc, 0);
  const totProv = catTotals.reduce((s,c) => s+c.prov, 0);
  const totReal = catTotals.reduce((s,c) => s+c.real, 0);

  const allServItens = servicos.flatMap(s => s.itens);
  const sOrc  = allServItens.reduce((s,x) => s+x.orcado, 0);
  const sReal = allServItens.reduce((s,x) => s+x.realizado, 0);

  const grandOrc  = totOrc + sOrc;
  const grandReal = totReal + sReal;

  const rodadasList = ["Todas", ...Array.from(new Set(divulgados.map(j=>j.rodada))).sort((a,b)=>a-b).map(String)];

  return (
    <div>
      {/* Filtros */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
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
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Total Orçado (jogos+fixos)" value={fmt(grandOrc)} sub={`${jogosF.length} jogos selecionados`} color="#22c55e" T={T}/>
        <KPI label="Total Realizado" value={fmt(grandReal)} sub={`${grandOrc?((grandReal/grandOrc)*100).toFixed(1):0}% executado`} color="#f59e0b" T={T}/>
        <KPI label="Saving Geral" value={fmt(grandOrc-grandReal)} sub="Orçado - Realizado" color={(grandOrc-grandReal)>=0?"#a3e635":"#ef4444"} T={T}/>
        <KPI label="Custo Médio / Jogo" value={jogosF.length?fmt(totOrc/jogosF.length):"—"} sub="Orçado variável" color="#8b5cf6" T={T}/>
      </div>

      {/* Tabela categorias */}
      <div style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
          <h3 style={{margin:0,fontSize:14,color:T.textMd}}>Custos Variáveis por Categoria</h3>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
            <thead>
              <tr style={{background:T.bg}}>
                {["Categoria","Orçado","Provisionado","Realizado","Saving","% Exec."].map(h => (
                  <th key={h} style={{padding:"10px 16px",textAlign:h==="Categoria"?"left":"right",color:T.textSm,fontSize:11}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catTotals.map(c => {
                const sv  = c.orc - c.real;
                const pct = c.orc ? ((c.real/c.orc)*100).toFixed(1) : 0;
                return (
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

      {/* Rodapé serviços fixos */}
      <div style={{background:T.card,borderRadius:12,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <span style={{color:T.textMd,fontWeight:700,fontSize:13}}>Serviços Fixos</span>
        <div style={{display:"flex",gap:20,fontSize:13}}>
          <span>Orçado: <b style={{color:"#22c55e"}}>{fmt(sOrc)}</b></span>
          <span>Realizado: <b style={{color:"#f59e0b"}}>{fmt(sReal)}</b></span>
          <span>Saving: <b style={{color:(sOrc-sReal)>=0?"#a3e635":"#ef4444"}}>{fmt(sOrc-sReal)}</b></span>
        </div>
      </div>
    </div>
  );
}
