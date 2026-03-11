import { useState } from "react";
import { CATS, btnStyle, iSty } from "../../constants";
import { fmt, subTotal, catTotal } from "../../utils";
import { allSubKeys } from "../../data";
import { Pill } from "../shared";

export default function VisaoMicro({jogos, jogoId, onChangeJogo, onSave, T}) {
  const divulgados = jogos.filter(j => j.mandante !== "A definir");
  const idx  = divulgados.findIndex(j => j.id === jogoId);
  const jogo = divulgados[idx];

  const [draft,     setDraft]     = useState(null);
  const [editing,   setEditing]   = useState(false);
  const [activeTab, setActiveTab] = useState("orcado");

  const emptyNums = () => allSubKeys();
  const safeDraft = j => ({
    ...j,
    orcado:       {...emptyNums(), ...(j.orcado||{})},
    provisionado: {...emptyNums(), ...(j.provisionado||{})},
    realizado:    {...emptyNums(), ...(j.realizado||{})},
  });

  const setVal     = (tipo,subkey,v) => setDraft(d => ({...d, [tipo]:{...d[tipo],[subkey]:v===""?"":(parseFloat(v)||0)}}));
  const startEdit  = () => { setDraft(safeDraft(jogo)); setEditing(true); };
  const cancelEdit = () => { setDraft(null); setEditing(false); };
  const saveEdit   = () => {
    const sanitize = obj => { const out={}; Object.keys(obj||{}).forEach(k=>{out[k]=parseFloat(obj[k])||0;}); return out; };
    onSave({...draft, orcado:sanitize(draft.orcado), provisionado:sanitize(draft.provisionado), realizado:sanitize(draft.realizado)});
    setEditing(false); setDraft(null);
  };
  const copyOrcadoToProvisionado = () => { if(!draft) return; setDraft(d=>({...d,provisionado:{...d.orcado}})); };

  if(!jogo) return <p style={{color:T.textSm,padding:20}}>Nenhum jogo selecionado.</p>;

  const data    = editing && draft ? draft : jogo;
  const IS      = iSty(T);
  const safeOrc  = {...emptyNums(), ...(data.orcado||{})};
  const safeProv = {...emptyNums(), ...(data.provisionado||{})};
  const safeReal = {...emptyNums(), ...(data.realizado||{})};
  const totOrc   = subTotal(safeOrc);
  const totProv  = subTotal(safeProv);
  const totReal  = subTotal(safeReal);
  const compareTabs   = ["orcado","provisionado","realizado"];
  const compareColors = {orcado:"#22c55e", provisionado:"#3b82f6", realizado:"#f59e0b"};

  return (
    <div>
      {/* Navegação entre jogos */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>idx>0&&onChangeJogo(divulgados[idx-1].id)} disabled={idx===0} style={{...btnStyle,background:idx===0?T.card:T.border,padding:"6px 14px",opacity:idx===0?0.4:1,color:T.text}}>←</button>
          <select value={jogoId} onChange={e=>onChangeJogo(parseInt(e.target.value))} style={{...IS,width:"auto",padding:"7px 14px",fontWeight:600,maxWidth:"60vw"}}>
            {divulgados.map(j=><option key={j.id} value={j.id}>Rd {j.rodada} · {j.mandante} x {j.visitante}</option>)}
          </select>
          <button onClick={()=>idx<divulgados.length-1&&onChangeJogo(divulgados[idx+1].id)} disabled={idx===divulgados.length-1} style={{...btnStyle,background:idx===divulgados.length-1?T.card:T.border,padding:"6px 14px",opacity:idx===divulgados.length-1?0.4:1,color:T.text}}>→</button>
        </div>
        <div style={{display:"flex",gap:8}}>
          {!editing
            ? <button onClick={startEdit} style={{...btnStyle,background:"#3b82f6"}}>✏ Editar valores</button>
            : <>
                {activeTab==="provisionado" && <button onClick={copyOrcadoToProvisionado} style={{...btnStyle,background:"#6366f1",fontSize:12}}>↓ Copiar Orçado</button>}
                <button onClick={cancelEdit} style={{...btnStyle,background:"#475569"}}>Cancelar</button>
                <button onClick={saveEdit}   style={{...btnStyle,background:"#22c55e"}}>💾 Salvar</button>
              </>
          }
        </div>
      </div>

      {/* Card do jogo */}
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
            {label:"Orçado",      value:fmt(totOrc),          color:"#22c55e"},
            {label:"Provisionado",value:fmt(totProv),         color:"#3b82f6"},
            {label:"Realizado",   value:fmt(totReal),         color:"#f59e0b"},
            {label:"Saving",      value:fmt(totOrc-totReal),  color:(totOrc-totReal)>=0?"#a3e635":"#ef4444"},
          ].map(k => (
            <div key={k.label} style={{background:T.bg,borderRadius:8,padding:"12px 16px",borderTop:`3px solid ${k.color}`}}>
              <p style={{color:T.textSm,fontSize:11,margin:"0 0 4px"}}>{k.label}</p>
              <p style={{color:k.color,fontWeight:700,fontSize:16,margin:0}}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs de edição */}
      {editing && (
        <div style={{display:"flex",gap:4,marginBottom:16}}>
          {compareTabs.map(t => (
            <button key={t} onClick={()=>setActiveTab(t)} style={{padding:"6px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:activeTab===t?compareColors[t]:T.card,color:activeTab===t?"#fff":T.textMd,textTransform:"capitalize"}}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Tabelas por categoria */}
      {CATS.map(cat => {
        const cOrc  = catTotal(safeOrc, cat);
        const cProv = catTotal(safeProv, cat);
        const cReal = catTotal(safeReal, cat);
        const draftTipo = editing && draft ? {
          orcado:       {...emptyNums(), ...(draft.orcado||{})},
          provisionado: {...emptyNums(), ...(draft.provisionado||{})},
          realizado:    {...emptyNums(), ...(draft.realizado||{})},
        } : null;

        return (
          <div key={cat.key} style={{background:T.card,borderRadius:12,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"12px 20px",background:T.bg,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <span style={{fontWeight:700,fontSize:14,color:cat.color}}>{cat.label}</span>
              <div style={{display:"flex",gap:16,fontSize:12}}>
                <span style={{color:T.textMd}}>Orç: <b style={{color:"#22c55e"}}>{fmt(cOrc)}</b></span>
                <span style={{color:T.textMd}}>Prov: <b style={{color:"#3b82f6"}}>{fmt(cProv)}</b></span>
                <span style={{color:T.textMd}}>Real: <b style={{color:"#f59e0b"}}>{fmt(cReal)}</b></span>
                <span style={{color:T.textMd}}>Saving: <b style={{color:(cOrc-cProv)>=0?"#a3e635":"#ef4444"}}>{fmt(cOrc-cProv)}</b></span>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:400}}>
                <thead>
                  <tr style={{background:T.bg}}>
                    {["Item","Orçado","Provisionado","Realizado","Saving"].map(h => (
                      <th key={h} style={{padding:"8px 20px",textAlign:h==="Item"?"left":"right",color:T.muted,fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cat.subs.map(sub => {
                    const o = safeOrc[sub.key]||0, p = safeProv[sub.key]||0, r = safeReal[sub.key]||0;
                    if(!editing && o===0 && p===0 && r===0) return null;
                    const isActive = !editing || activeTab===sub.key || true;
                    return (
                      <tr key={sub.key} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:"10px 20px",fontSize:13,color:T.text}}>{sub.label}</td>
                        {["orcado","provisionado","realizado"].map(tipo => {
                          const val = tipo==="orcado"?o:tipo==="provisionado"?p:r;
                          const col = tipo==="orcado"?"#22c55e":tipo==="provisionado"?"#3b82f6":"#f59e0b";
                          const active = !editing || activeTab===tipo;
                          return (
                            <td key={tipo} style={{padding:"8px 20px",textAlign:"right",opacity:editing&&!active?0.35:1}}>
                              {editing && active && draftTipo
                                ? <input value={draftTipo[tipo][sub.key]??0} onChange={e=>setVal(tipo,sub.key,e.target.value)} style={{...IS,width:90,textAlign:"right",padding:"4px 8px",color:col}}/>
                                : <span style={{fontSize:13,color:val===0?T.muted:col}}>{fmt(val)}</span>
                              }
                            </td>
                          );
                        })}
                        <td style={{padding:"10px 20px",textAlign:"right",fontWeight:600,color:(o-p)>=0?"#a3e635":"#ef4444",fontSize:13}}>{fmt(o-p)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:`2px solid ${T.border}`,background:T.bg,fontWeight:700}}>
                    <td style={{padding:"10px 20px",fontSize:13,color:T.text}}>Total {cat.label}</td>
                    <td style={{padding:"10px 20px",textAlign:"right",color:"#22c55e"}}>{fmt(cOrc)}</td>
                    <td style={{padding:"10px 20px",textAlign:"right",color:"#3b82f6"}}>{fmt(cProv)}</td>
                    <td style={{padding:"10px 20px",textAlign:"right",color:"#f59e0b"}}>{fmt(cReal)}</td>
                    <td style={{padding:"10px 20px",textAlign:"right",color:(cOrc-cProv)>=0?"#a3e635":"#ef4444"}}>{fmt(cOrc-cProv)}</td>
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
