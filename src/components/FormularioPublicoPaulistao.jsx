import { useState, useRef, useEffect } from "react";
import { Pill } from "./shared";
import { getState, setState, fileToDataUrl, saveNFFile } from "../lib/supabase";

const SUBS_EXCLUIR = new Set(["transporte","uber","hospedagem","seg_espacial","infra"]);
const T = {
  bg:"#060912", card:"#0f1623", border:"#1e293b", muted:"#334155",
  text:"#f8fafc", textMd:"#cbd5e1", textSm:"#94a3b8",
  surface:"#0f1623", surfaceAlt:"#0a0f1a",
  brand:"#65B32E", brandSoft:"rgba(101,179,46,0.14)", brandBorder:"rgba(101,179,46,0.32)",
};
const BRAND = "#65B32E";
const btnS = { color:"#fff", border:"none", borderRadius:10, padding:"13px 20px", cursor:"pointer", fontWeight:700, fontSize:14, width:"100%", letterSpacing:"-0.005em" };
const IS = { background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:10, color:T.text, padding:"12px 14px", fontSize:14, width:"100%", boxSizing:"border-box", MozAppearance:"textfield", fontFamily:"'Poppins',sans-serif" };
const fmt = v => (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const HIDE_SPINNERS = `input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}input[type=number]{-moz-appearance:textfield}`;

const CATS_PAULISTAO = [
  { key:"operacoes", label:"Operações", color:"#3b82f6", subs:[
    { key:"um_b3", label:"UM B3" },
    { key:"um_b1", label:"UM B1" },
    { key:"downlink", label:"Downlink" },
    { key:"distribuicao", label:"Distribuição" },
    { key:"liveu", label:"LiveU" },
    { key:"maquinas", label:"Máquinas" },
    { key:"operador_tecnico", label:"Operador Técnico" },
    { key:"coordenador", label:"Coordenador" },
  ]},
  { key:"producao", label:"Produção", color:"#f59e0b", subs:[
    { key:"comentarista", label:"Comentarista" },
    { key:"narrador", label:"Narrador" },
    { key:"reporter", label:"Repórter" },
    { key:"camera", label:"Câmera" },
    { key:"auxiliar_producao", label:"Aux. Produção" },
  ]},
  { key:"pos_producao", label:"Pós-Produção", color:"#8b5cf6", subs:[
    { key:"edicao", label:"Edição" },
    { key:"grafismo", label:"Grafismo" },
    { key:"sonoplastia", label:"Sonoplastia" },
  ]},
];

function extrairServicos(jogo) {
  const s = [];
  CATS_PAULISTAO.forEach(cat => { cat.subs.forEach(sub => {
    if (SUBS_EXCLUIR.has(sub.key)) return;
    if ((jogo.provisionado?.[sub.key] || 0) > 0)
      s.push({ subKey:sub.key, subLabel:sub.label, catLabel:cat.label, catColor:cat.color });
  })});
  // Se jogo não tem provisionado configurado, mostra todas as subs disponíveis
  if (s.length === 0) {
    CATS_PAULISTAO.forEach(cat => { cat.subs.forEach(sub => {
      if (SUBS_EXCLUIR.has(sub.key)) return;
      s.push({ subKey:sub.key, subLabel:sub.label, catLabel:cat.label, catColor:cat.color });
    })});
  }
  return s;
}

function FornecedorInput({ value, onChange, fornecedores }) {
  const [open, setOpen] = useState(false);
  const q = value.toLowerCase();
  const filtered = q.length > 0
    ? fornecedores.filter(f => f.apelido.toLowerCase().includes(q) || f.razaoSocial.toLowerCase().includes(q) || f.funcao?.toLowerCase().includes(q)).slice(0,6) : [];
  return (
    <div style={{position:"relative"}}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Digite seu nome ou empresa..." style={IS}/>
      {open && filtered.length > 0 && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:T.card,border:`1px solid ${T.border}`,borderRadius:10,marginTop:4,maxHeight:240,overflowY:"auto",boxShadow:"0 12px 32px rgba(0,0,0,0.5)"}}>
          {filtered.map(f => (
            <div key={f.id} onMouseDown={() => { onChange(f.apelido); setOpen(false); }}
              style={{padding:"12px 16px",cursor:"pointer",borderBottom:`1px solid ${T.border}`}}
              onMouseEnter={e => e.currentTarget.style.background = T.bg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>{f.apelido}</div>
              <div style={{fontSize:12,color:T.textSm,marginTop:2}}>{f.funcao}{f.razaoSocial ? ` · ${f.razaoSocial.slice(0,35)}${f.razaoSocial.length>35?"...":""}` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STEPS = ["Fase/Rodada","Jogos","Serviços","Valores","Nota Fiscal"];

export default function FormularioPublicoPaulistao() {
  const [jogos, setJogos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(0);
  const [rodadaSel, setRodadaSel] = useState(null);
  const [qtdJogos, setQtdJogos] = useState(1);
  const [jogosSel, setJogosSel] = useState([]);
  const [servicosSel, setServicosSel] = useState({});
  const [valores, setValores] = useState({});
  const [nfData, setNfData] = useState({ fornecedor:"", numeroNF:"", dataEmissao:"", dataEnvio:"", obs:""});
  const [arquivo, setArquivo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    Promise.all([getState('paulistao_jogos'), getState('paulistao_fornecedores')]).then(([j, f]) => {
      if (j) setJogos(j);
      if (f) setFornecedores(f);
      setLoading(false);
    });
  }, []);

  const divulgados = jogos.filter(j => j.mandante !== "A definir");

  // Agrupa por fase + rodada para o seletor
  const rodadas = Array.from(
    new Map(divulgados.map(j => [`${j.fase}__${j.rodada}`, { fase: j.fase, rodada: j.rodada }])).values()
  ).sort((a, b) => a.rodada - b.rodada);

  const jogosRodada = rodadaSel
    ? divulgados.filter(j => j.fase === rodadaSel.fase && j.rodada === rodadaSel.rodada)
    : [];

  const canNext = () => {
    if (step === 0) return rodadaSel != null;
    if (step === 1) return jogosSel.length === qtdJogos;
    if (step === 2) return Object.values(servicosSel).some(a => a.length > 0);
    if (step === 3) return Object.values(valores).some(v => v > 0);
    if (step === 4) return nfData.fornecedor.length > 0;
    return false;
  };

  const toggleJogo = id => {
    setJogosSel(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= qtdJogos) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const toggleServico = (jogoId, subKey) => {
    setServicosSel(prev => {
      const arr = prev[jogoId] || [];
      return {...prev, [jogoId]: arr.includes(subKey) ? arr.filter(k => k !== subKey) : [...arr, subKey]};
    });
  };

  const setValor = (key, val) => setValores(prev => ({...prev, [key]: parseFloat(val) || 0}));
  const totalGeral = Object.values(valores).reduce((s, v) => s + (v || 0), 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    const submissions = [];
    for (const jogoId of jogosSel) {
      const jogo = divulgados.find(j => j.id === jogoId);
      if (!jogo) continue;
      const subs = servicosSel[jogoId] || [];
      if (subs.length === 0) continue;
      const servicosValores = {};
      let valorNF = 0;
      subs.forEach(sk => { const v = valores[`${jogoId}_${sk}`] || 0; servicosValores[sk] = v; valorNF += v; });
      const allServicos = extrairServicos(jogo);
      const submissionId = Date.now() + jogoId;
      let hasFile = false;
      if (arquivo) {
        try { const d = await fileToDataUrl(arquivo); await saveNFFile(submissionId, d); hasFile = true; } catch(_){}
      }
      submissions.push({
        id: submissionId, ...nfData, valorNF, fase: jogo.fase, rodada: jogo.rodada, jogoId: jogo.id,
        jogoLabel: `${jogo.mandante} x ${jogo.visitante}`, mandante: jogo.mandante, visitante: jogo.visitante,
        servicosKeys: subs.map(sk => `${jogo.id}_${sk}`),
        servicosLabels: allServicos.filter(s => subs.includes(s.subKey)).map(s => s.subLabel),
        servicosValores, status:"pendente", hasFile, enviadoEm: new Date().toISOString(),
      });
    }
    const current = (await getState('paulistao_nf_submissions')) || [];
    await setState('paulistao_nf_submissions', [...current, ...submissions]);
    setSubmitting(false);
    setDone(true);
  };

  const reset = () => {
    setStep(0); setRodadaSel(null); setQtdJogos(1); setJogosSel([]);
    setServicosSel({}); setValores({}); setNfData({ fornecedor:"", numeroNF:"", dataEmissao:"", dataEnvio:"", obs:""});
    setArquivo(null); setDone(false);
  };

  if (loading) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{color:T.textMd,fontSize:16}}>Carregando...</p>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Poppins',sans-serif"}}>
      <style>{HIDE_SPINNERS}</style>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#060912 0%,#0f1623 60%,#0a1a0f 100%)",borderBottom:`1px solid ${T.border}`,padding:"24px 16px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,right:-60,width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle, ${BRAND}1f 0%, transparent 60%)`,pointerEvents:"none"}}/>
        <div style={{maxWidth:560,margin:"0 auto",position:"relative"}}>
          <p style={{color:BRAND,fontSize:10,letterSpacing:"0.18em",textTransform:"uppercase",margin:"0 0 6px",fontWeight:700}}>Livemode · Transmissões</p>
          <h1 style={{fontSize:22,fontWeight:800,margin:0,color:"#fff",letterSpacing:"-0.025em"}}>Envio de Nota Fiscal</h1>
          <p style={{color:T.textMd,fontSize:12,margin:"4px 0 0"}}>Paulistão F 2026</p>
        </div>
      </div>

      <div style={{padding:"20px 16px",maxWidth:560,margin:"0 auto"}}>

        {done ? (
          <div style={{background:T.card,borderRadius:18,padding:"48px 28px",textAlign:"center",border:`1px solid ${T.border}`,boxShadow:"0 20px 40px -12px rgba(0,0,0,0.6)"}}>
            <div style={{width:64,height:64,borderRadius:18,background:T.brandSoft,border:`1px solid ${T.brandBorder}`,color:BRAND,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",fontSize:32}}>✓</div>
            <h3 style={{color:T.text,margin:"0 0 8px",fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>Nota fiscal enviada!</h3>
            <p style={{color:T.textMd,fontSize:13,margin:"0 0 28px"}}>Sua NF será analisada pela equipe. Obrigado!</p>
            <button onClick={reset} style={{...btnS,background:`linear-gradient(135deg,#3a7a1a,${BRAND})`,maxWidth:280,margin:"0 auto",boxShadow:`0 4px 14px ${BRAND}55`}}>Enviar outra NF</button>
          </div>
        ) : (<>

          {/* Progress */}
          <div style={{display:"flex",gap:6,marginBottom:24}}>
            {STEPS.map((s, i) => (
              <div key={s} style={{flex:1,textAlign:"center"}}>
                <div style={{height:4,borderRadius:2,background:i<=step?BRAND:T.border,marginBottom:6,boxShadow:i<=step?`0 0 12px ${BRAND}aa`:"none"}}/>
                <span style={{fontSize:10,color:i<=step?BRAND:T.textSm,fontWeight:i===step?700:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{s}</span>
              </div>
            ))}
          </div>

          <div style={{background:T.card,borderRadius:16,padding:"24px 20px",minHeight:200}}>

            {/* STEP 0: Fase/Rodada */}
            {step === 0 && (
              <div>
                <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Qual a fase/rodada?</h3>
                <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Selecione a rodada referente à nota fiscal</p>
                <select
                  value={rodadaSel ? `${rodadaSel.fase}__${rodadaSel.rodada}` : ""}
                  onChange={e => {
                    if (!e.target.value) { setRodadaSel(null); return; }
                    const [fase, rodada] = e.target.value.split("__");
                    setRodadaSel({ fase, rodada: parseInt(rodada) });
                  }}
                  style={{...IS,fontSize:16,fontWeight:600,padding:"14px",color:rodadaSel?T.text:T.textSm}}>
                  <option value="" disabled>Selecione a rodada...</option>
                  {rodadas.map(r => (
                    <option key={`${r.fase}__${r.rodada}`} value={`${r.fase}__${r.rodada}`}>
                      {r.fase} — Rodada {r.rodada}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* STEP 1: Jogos */}
            {step === 1 && (
              <div>
                <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Quantos jogos?</h3>
                <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Essa NF cobre quantos jogos?</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
                  {[1,2].map(n => (
                    <button key={n} onClick={() => { setQtdJogos(n); setJogosSel([]); }} style={{padding:"14px",borderRadius:10,border:`2px solid ${qtdJogos===n?BRAND:T.border}`,cursor:"pointer",fontSize:15,fontWeight:700,
                      background:qtdJogos===n?T.brandSoft:T.bg,color:qtdJogos===n?BRAND:T.textMd,textAlign:"center"}}>
                      {n} jogo{n>1?"s":""}
                    </button>
                  ))}
                </div>
                <p style={{color:T.textMd,fontSize:12,margin:"0 0 10px",fontWeight:600}}>Selecione o{qtdJogos>1?"s":""} jogo{qtdJogos>1?"s":""}:</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {jogosRodada.map(j => {
                    const sel = jogosSel.includes(j.id);
                    return (
                      <button key={j.id} onClick={() => toggleJogo(j.id)}
                        style={{padding:"14px 16px",borderRadius:12,border:`2px solid ${sel?BRAND:T.border}`,cursor:"pointer",
                          background:sel?T.brandSoft:T.bg,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:14,color:T.text}}>{j.mandante} x {j.visitante}</div>
                          <div style={{color:T.textSm,fontSize:12,marginTop:2}}>{j.data}{j.cidade ? ` · ${j.cidade}` : ""}</div>
                        </div>
                        {j.grupo && <Pill label={j.grupo} color={BRAND}/>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: Serviços */}
            {step === 2 && (
              <div>
                <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Serviços prestados</h3>
                <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Selecione os serviços que você realizou</p>
                {jogosSel.map(jogoId => {
                  const jogo = divulgados.find(j => j.id === jogoId);
                  if (!jogo) return null;
                  const servicos = extrairServicos(jogo);
                  const selected = servicosSel[jogoId] || [];
                  const byCat = {};
                  servicos.forEach(s => { if (!byCat[s.catLabel]) byCat[s.catLabel] = {color:s.catColor,items:[]}; byCat[s.catLabel].items.push(s); });
                  return (
                    <div key={jogoId} style={{marginBottom:20}}>
                      <div style={{marginBottom:12}}>
                        <span style={{fontWeight:700,fontSize:14,color:T.text}}>{jogo.mandante} x {jogo.visitante}</span>
                      </div>
                      {Object.entries(byCat).map(([catName, {color, items}]) => (
                        <div key={catName} style={{marginBottom:12}}>
                          <p style={{color,fontSize:12,fontWeight:700,margin:"0 0 8px"}}>{catName}</p>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                            {items.map(s => {
                              const sel = selected.includes(s.subKey);
                              return (
                                <button key={s.subKey} onClick={() => toggleServico(jogoId, s.subKey)}
                                  style={{padding:"10px 12px",borderRadius:8,border:`2px solid ${sel?color:T.border}`,cursor:"pointer",fontSize:13,fontWeight:sel?700:400,
                                    background:sel?color+"22":"transparent",color:sel?color:T.textMd,textAlign:"center"}}>
                                  {s.subLabel}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 3: Valores */}
            {step === 3 && (
              <div>
                <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Valores</h3>
                <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Informe o valor de cada serviço</p>
                {jogosSel.map(jogoId => {
                  const jogo = divulgados.find(j => j.id === jogoId);
                  if (!jogo) return null;
                  const subs = servicosSel[jogoId] || [];
                  const allServicos = extrairServicos(jogo);
                  return (
                    <div key={jogoId} style={{marginBottom:20}}>
                      {jogosSel.length > 1 && (
                        <div style={{marginBottom:12}}>
                          <span style={{fontWeight:700,fontSize:13,color:T.text}}>{jogo.mandante} x {jogo.visitante}</span>
                        </div>
                      )}
                      {subs.map(sk => {
                        const s = allServicos.find(x => x.subKey === sk);
                        if (!s) return null;
                        const key = `${jogoId}_${sk}`;
                        return (
                          <div key={sk} style={{marginBottom:10}}>
                            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>{s.subLabel}</label>
                            <div style={{display:"flex",alignItems:"center",gap:0}}>
                              <span style={{background:T.muted,color:T.text,padding:"12px 12px",borderRadius:"8px 0 0 8px",fontSize:14,fontWeight:600}}>R$</span>
                              <input type="number" value={valores[key] || ""} onChange={e => setValor(key, e.target.value)}
                                placeholder="0" style={{...IS,borderRadius:"0 8px 8px 0",borderLeft:"none",fontWeight:600,color:BRAND,fontSize:16}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                <div style={{background:T.bg,borderRadius:10,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:T.textMd,fontWeight:600,fontSize:14}}>Total</span>
                  <span style={{fontSize:20,fontWeight:700,color:BRAND}}>{fmt(totalGeral)}</span>
                </div>
              </div>
            )}

            {/* STEP 4: Dados NF */}
            {step === 4 && (
              <div>
                <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Dados da Nota Fiscal</h3>
                <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Preencha os dados e anexe o arquivo</p>
                <div style={{marginBottom:14}}>
                  <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Fornecedor / Razão Social</label>
                  <FornecedorInput value={nfData.fornecedor} onChange={v => setNfData(d => ({...d, fornecedor:v}))} fornecedores={fornecedores}/>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Nº da Nota Fiscal</label>
                  <input value={nfData.numeroNF} onChange={e => setNfData(d => ({...d, numeroNF:e.target.value}))} style={IS}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  <div>
                    <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Data de Emissão</label>
                    <input value={nfData.dataEmissao} onChange={e => setNfData(d => ({...d, dataEmissao:e.target.value}))} placeholder="dd/mm/aaaa" style={IS}/>
                  </div>
                  <div>
                    <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Data de Envio</label>
                    <input value={nfData.dataEnvio} onChange={e => setNfData(d => ({...d, dataEnvio:e.target.value}))} placeholder="dd/mm/aaaa" style={IS}/>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Observações (opcional)</label>
                  <input value={nfData.obs} onChange={e => setNfData(d => ({...d, obs:e.target.value}))} style={IS}/>
                </div>
                <div style={{marginBottom:16}}>
                  <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Arquivo da NF</label>
                  <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => setArquivo(e.target.files[0]||null)} style={{display:"none"}}/>
                  <div onClick={() => fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {e.preventDefault(); setArquivo(e.dataTransfer.files[0]||null);}}
                    style={{border:`2px dashed ${arquivo?BRAND:T.muted}`,borderRadius:10,padding:"20px 16px",cursor:"pointer",textAlign:"center",background:arquivo?"#22c55e11":T.bg}}>
                    {arquivo
                      ? <p style={{margin:0,color:BRAND,fontSize:14,fontWeight:600}}>{arquivo.name}<br/><span style={{fontSize:12,fontWeight:400}}>({(arquivo.size/1024).toFixed(0)} KB)</span></p>
                      : <p style={{margin:0,color:T.textSm,fontSize:13}}>Toque para selecionar ou arraste o arquivo<br/><span style={{fontSize:11}}>PDF, PNG, JPG (máx. 10MB)</span></p>}
                  </div>
                </div>
                {/* Resumo */}
                <div style={{background:T.bg,borderRadius:10,padding:"14px 16px"}}>
                  <p style={{color:T.textMd,fontSize:11,fontWeight:600,margin:"0 0 8px"}}>Resumo</p>
                  {jogosSel.map(jogoId => {
                    const jogo = divulgados.find(j => j.id === jogoId);
                    if (!jogo) return null;
                    const subs = servicosSel[jogoId] || [];
                    const allServicos = extrairServicos(jogo);
                    const total = subs.reduce((s, sk) => s + (valores[`${jogoId}_${sk}`] || 0), 0);
                    return (
                      <div key={jogoId} style={{marginBottom:8}}>
                        <div style={{fontWeight:600,fontSize:13,color:T.text}}>{jogo.mandante} x {jogo.visitante}</div>
                        <div style={{fontSize:11,color:T.textSm,margin:"2px 0"}}>{subs.map(sk => allServicos.find(x => x.subKey === sk)?.subLabel).filter(Boolean).join(", ")}</div>
                        <div style={{fontSize:13,color:BRAND,fontWeight:700}}>{fmt(total)}</div>
                      </div>
                    );
                  })}
                  <div style={{borderTop:`1px solid ${T.border}`,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:14,fontWeight:700,color:T.text}}>Total</span>
                    <span style={{fontSize:18,fontWeight:700,color:BRAND}}>{fmt(totalGeral)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={{display:"grid",gridTemplateColumns:step===0?"1fr":"1fr 1fr",gap:10,marginTop:16}}>
            {step > 0 && (
              <button onClick={() => setStep(s => s-1)} style={{...btnS,background:"#475569"}}>Voltar</button>
            )}
            {step < 4 ? (
              <button onClick={() => setStep(s => s+1)} disabled={!canNext()}
                style={{...btnS,background:canNext()?BRAND:"#334155",opacity:canNext()?1:0.5}}>
                Próximo
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!canNext()||submitting}
                style={{...btnS,background:canNext()&&!submitting?BRAND:"#334155",opacity:canNext()&&!submitting?1:0.5,fontSize:16}}>
                {submitting ? "Enviando..." : "Enviar NF"}
              </button>
            )}
          </div>
        </>)}
      </div>

      <div style={{textAlign:"center",padding:"20px",color:T.textSm,fontSize:10}}>
        FFU — Transmissões · Paulistão F 2026
      </div>
    </div>
  );
}
