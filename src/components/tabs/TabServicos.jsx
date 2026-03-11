import { useState } from "react";
import { SECAO_COLORS, btnStyle, iSty } from "../../constants";
import { fmt } from "../../utils";
import { KPI } from "../shared";

export default function TabServicos({servicos, setServicos, T}) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);

  const allItens = servicos.flatMap(s => s.itens);
  const totOrc  = allItens.reduce((s,x) => s+x.orcado, 0);
  const totProv = allItens.reduce((s,x) => s+x.provisionado, 0);
  const totReal = allItens.reduce((s,x) => s+x.realizado, 0);

  const startEdit  = i => { setEditing(i.id); setDraft({...i}); };
  const cancelEdit = () => { setEditing(null); setDraft(null); };
  const saveEdit   = () => {
    setServicos(ss => ss.map(s => ({...s, itens: s.itens.map(it => it.id===draft.id ? draft : it)})));
    setEditing(null); setDraft(null);
  };
  const addItem    = secao => {
    const n = {id:Date.now(), nome:"Novo serviço", orcado:0, provisionado:0, realizado:0, obs:""};
    setServicos(ss => ss.map(s => s.secao===secao ? {...s, itens:[...s.itens, n]} : s));
  };
  const deleteItem = (secao, id) =>
    setServicos(ss => ss.map(s => s.secao===secao ? {...s, itens:s.itens.filter(it=>it.id!==id)} : s));

  const IS   = iSty(T);
  const COLS = ["Serviço","Orçado","Provisionado","Realizado","Saving","% Exec.","Progresso","Obs",""];

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,marginBottom:24}}>
        <KPI label="Total Orçado"   value={fmt(totOrc)}  sub="Serviços fixos" color="#22c55e" T={T}/>
        <KPI label="Provisionado"   value={fmt(totProv)} sub="Estimativa"     color="#3b82f6" T={T}/>
        <KPI label="Realizado"      value={fmt(totReal)} sub={`${totOrc?((totReal/totOrc)*100).toFixed(1):0}% executado`} color="#f59e0b" T={T}/>
        <KPI label="Saving"         value={fmt(totOrc-totReal)} sub="Orçado - Realizado" color={(totOrc-totReal)>=0?"#a3e635":"#ef4444"} T={T}/>
      </div>

      {servicos.map(({secao, itens}) => {
        const sOrc  = itens.reduce((s,x) => s+x.orcado, 0);
        const sProv = itens.reduce((s,x) => s+x.provisionado, 0);
        const sReal = itens.reduce((s,x) => s+x.realizado, 0);
        const cor   = SECAO_COLORS[secao] || "#8b5cf6";

        return (
          <div key={secao} style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"12px 20px",background:T.bg,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{width:4,height:20,background:cor,borderRadius:2,display:"inline-block"}}/>
                <span style={{fontWeight:700,fontSize:15,color:cor}}>{secao}</span>
              </div>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={{display:"flex",gap:12,fontSize:12}}>
                  <span style={{color:T.textMd}}>Orç: <b style={{color:"#22c55e"}}>{fmt(sOrc)}</b></span>
                  <span style={{color:T.textMd}}>Saving: <b style={{color:(sOrc-sReal)>=0?"#a3e635":"#ef4444"}}>{fmt(sOrc-sReal)}</b></span>
                </div>
                <button onClick={()=>addItem(secao)} style={{...btnStyle,background:cor+"33",color:cor,padding:"4px 12px",fontSize:11}}>+ item</button>
              </div>
            </div>

            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                <thead>
                  <tr style={{background:T.bg}}>
                    {COLS.map(h => <th key={h} style={{padding:"8px 14px",textAlign:h==="Serviço"||h==="Obs"||h===""?"left":"right",color:T.muted,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {itens.map(item => {
                    const isEd = editing===item.id;
                    const row  = isEd ? draft : item;
                    const sv   = row.orcado - row.realizado;
                    const pct  = row.orcado ? Math.min(100,(row.realizado/row.orcado)*100) : 0;

                    return (
                      <tr key={item.id} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:"10px 14px",fontWeight:600,fontSize:13,color:T.text}}>
                          {isEd ? <input value={draft.nome} onChange={e=>setDraft(d=>({...d,nome:e.target.value}))} style={{...IS,width:220}}/> : row.nome}
                        </td>
                        {["orcado","provisionado","realizado"].map(k => {
                          const col = k==="orcado"?"#22c55e":k==="provisionado"?"#3b82f6":"#f59e0b";
                          return (
                            <td key={k} style={{padding:"10px 14px",textAlign:"right"}}>
                              {isEd
                                ? <input value={draft[k]} onChange={e=>setDraft(d=>({...d,[k]:parseFloat(e.target.value)||0}))} style={{...IS,width:110,textAlign:"right",color:col}}/>
                                : <span style={{color:row[k]===0?T.muted:col}}>{fmt(row[k])}</span>
                              }
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
                        <td style={{padding:"10px 14px",color:T.textSm,fontSize:12}}>
                          {isEd ? <input value={draft.obs} onChange={e=>setDraft(d=>({...d,obs:e.target.value}))} style={{...IS,width:160}}/> : row.obs}
                        </td>
                        <td style={{padding:"10px 14px"}}>
                          {isEd
                            ? <div style={{display:"flex",gap:6}}>
                                <button onClick={cancelEdit} style={{...btnStyle,background:"#475569",padding:"4px 10px",fontSize:11}}>✕</button>
                                <button onClick={saveEdit}   style={{...btnStyle,background:"#22c55e",padding:"4px 10px",fontSize:11}}>✓</button>
                              </div>
                            : <div style={{display:"flex",gap:6}}>
                                <button onClick={()=>startEdit(item)}        style={{...btnStyle,background:T.border,padding:"4px 10px",fontSize:11}}>✏</button>
                                <button onClick={()=>deleteItem(secao,item.id)} style={{...btnStyle,background:"#7f1d1d",padding:"4px 10px",fontSize:11}}>🗑</button>
                              </div>
                          }
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
    </div>
  );
}
