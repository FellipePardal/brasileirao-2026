import { useState, useRef, useEffect } from "react";
import { getState, setState, fileToDataUrl, saveNFFile } from "../lib/supabase";

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

// ── Serviços por jogo ──────────────────────────────────────────────────────────
const SERVICOS_JOGO = [
  { catLabel:"Operações", catColor:"#D97706", subKey:"um_b3",      subLabel:"UM B3" },
  { catLabel:"Pessoal",   catColor:"#2563EB", subKey:"prod_um",    subLabel:"Produtor de UM" },
  { catLabel:"Pessoal",   catColor:"#2563EB", subKey:"prod_campo", subLabel:"Produtor de Campo" },
  { catLabel:"Pessoal",   catColor:"#2563EB", subKey:"supervisor1",subLabel:"Supervisor 1" },
  { catLabel:"Operações", catColor:"#D97706", subKey:"geradores",  subLabel:"Geradores" },
  { catLabel:"Operações", catColor:"#D97706", subKey:"sng",        subLabel:"SNG" },
];

// ── Serviços mensais (IDs espelham PAULISTAO_SERVICOS_INIT) ───────────────────
const SERVICOS_MENSAIS = [
  { id:1, nome:"Coordenador de Sinal Internacional", secao:"Pessoal",     color:"#2563EB" },
  { id:2, nome:"Editor de Vídeos",                   secao:"Pessoal",     color:"#2563EB" },
  { id:3, nome:"Editor de Vídeos 2",                 secao:"Pessoal",     color:"#2563EB" },
  { id:4, nome:"Suporte Operacional Vmix",           secao:"Pessoal",     color:"#2563EB" },
  { id:6, nome:"Estatísticas",                       secao:"Transmissão", color:"#7C3AED" },
  { id:7, nome:"Ingest/Edição (WSC)",                secao:"Transmissão", color:"#7C3AED" },
];

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const STEPS_JOGO    = ["Fase/Rodada","Jogos","Serviços","Valores","Nota Fiscal"];
const STEPS_MENSAL  = ["Mês","Serviço","Valores","Nota Fiscal"];

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

function NFDataStep({ nfData, setNfData, arquivo, setArquivo, fileRef, fornecedores, resumo }) {
  return (
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
      {resumo}
    </div>
  );
}

// ── Formulário por JOGO ────────────────────────────────────────────────────────
function FormJogo({ divulgados, fornecedores, onDone }) {
  const [step, setStep] = useState(0);
  const [rodadaSel, setRodadaSel] = useState(null);
  const [qtdJogos, setQtdJogos] = useState(1);
  const [jogosSel, setJogosSel] = useState([]);
  const [servicosSel, setServicosSel] = useState({});
  const [valores, setValores] = useState({});
  const [nfData, setNfData] = useState({ fornecedor:"", numeroNF:"", dataEmissao:"", dataEnvio:"", obs:"" });
  const [arquivo, setArquivo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const rodadas = Array.from(
    new Map(divulgados.map(j => [`${j.fase}__${j.rodada}`, { fase: j.fase, rodada: j.rodada }])).values()
  ).sort((a, b) => a.rodada - b.rodada);

  const jogosRodada = rodadaSel
    ? divulgados.filter(j => j.fase === rodadaSel.fase && j.rodada === rodadaSel.rodada)
    : [];

  const totalGeral = Object.values(valores).reduce((s, v) => s + (v || 0), 0);

  const canNext = () => {
    if (step === 0) return rodadaSel != null;
    if (step === 1) return jogosSel.length === qtdJogos;
    if (step === 2) return Object.values(servicosSel).some(a => a.length > 0);
    if (step === 3) return Object.values(valores).some(v => v > 0);
    if (step === 4) return nfData.fornecedor.length > 0;
    return false;
  };

  const toggleJogo = id => setJogosSel(prev => {
    if (prev.includes(id)) return prev.filter(x => x !== id);
    if (prev.length >= qtdJogos) return [...prev.slice(1), id];
    return [...prev, id];
  });

  const toggleServico = (jogoId, subKey) => setServicosSel(prev => {
    const arr = prev[jogoId] || [];
    return {...prev, [jogoId]: arr.includes(subKey) ? arr.filter(k => k !== subKey) : [...arr, subKey]};
  });

  const setValor = (key, val) => setValores(prev => ({...prev, [key]: parseFloat(val) || 0}));

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
      const submissionId = Date.now() + jogoId;
      let hasFile = false;
      if (arquivo) {
        try { const d = await fileToDataUrl(arquivo); await saveNFFile(submissionId, d); hasFile = true; } catch(_){}
      }
      submissions.push({
        id: submissionId, tipo:"jogo", ...nfData, valorNF,
        fase: jogo.fase, rodada: jogo.rodada, jogoId: jogo.id,
        jogoLabel: `${jogo.mandante} x ${jogo.visitante}`,
        mandante: jogo.mandante, visitante: jogo.visitante,
        servicosKeys: subs.map(sk => `${jogo.id}_${sk}`),
        servicosLabels: SERVICOS_JOGO.filter(s => subs.includes(s.subKey)).map(s => s.subLabel),
        servicosValores, status:"pendente", hasFile, enviadoEm: new Date().toISOString(),
      });
    }
    const current = (await getState('paulistao_nf_submissions')) || [];
    await setState('paulistao_nf_submissions', [...current, ...submissions]);
    setSubmitting(false);
    onDone();
  };

  const STEPS = STEPS_JOGO;
  const byCat = {};
  SERVICOS_JOGO.forEach(s => { if (!byCat[s.catLabel]) byCat[s.catLabel] = {color:s.catColor,items:[]}; byCat[s.catLabel].items.push(s); });

  return (
    <>
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

        {step === 1 && (
          <div>
            <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Quantos jogos?</h3>
            <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Essa NF cobre quantos jogos?</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:20}}>
              {[1,2,3,4].map(n => (
                <button key={n} onClick={() => { setQtdJogos(n); setJogosSel([]); }}
                  style={{padding:"14px",borderRadius:10,border:`2px solid ${qtdJogos===n?BRAND:T.border}`,cursor:"pointer",fontSize:15,fontWeight:700,
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
                    {j.grupo && <span style={{fontSize:11,fontWeight:700,color:BRAND,background:T.brandSoft,padding:"3px 8px",borderRadius:6}}>{j.grupo}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Serviços prestados</h3>
            <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Selecione os serviços que você realizou</p>
            {jogosSel.map(jogoId => {
              const jogo = divulgados.find(j => j.id === jogoId);
              if (!jogo) return null;
              const selected = servicosSel[jogoId] || [];
              return (
                <div key={jogoId} style={{marginBottom:20}}>
                  {jogosSel.length > 1 && <div style={{marginBottom:12}}><span style={{fontWeight:700,fontSize:14,color:T.text}}>{jogo.mandante} x {jogo.visitante}</span></div>}
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

        {step === 3 && (
          <div>
            <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Valores</h3>
            <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Informe o valor de cada serviço</p>
            {jogosSel.map(jogoId => {
              const jogo = divulgados.find(j => j.id === jogoId);
              if (!jogo) return null;
              const subs = servicosSel[jogoId] || [];
              return (
                <div key={jogoId} style={{marginBottom:20}}>
                  {jogosSel.length > 1 && <div style={{marginBottom:12}}><span style={{fontWeight:700,fontSize:13,color:T.text}}>{jogo.mandante} x {jogo.visitante}</span></div>}
                  {subs.map(sk => {
                    const s = SERVICOS_JOGO.find(x => x.subKey === sk);
                    if (!s) return null;
                    const key = `${jogoId}_${sk}`;
                    return (
                      <div key={sk} style={{marginBottom:10}}>
                        <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>{s.subLabel}</label>
                        <div style={{display:"flex",alignItems:"center"}}>
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

        {step === 4 && (
          <NFDataStep nfData={nfData} setNfData={setNfData} arquivo={arquivo} setArquivo={setArquivo} fileRef={fileRef} fornecedores={fornecedores}
            resumo={
              <div style={{background:T.bg,borderRadius:10,padding:"14px 16px"}}>
                <p style={{color:T.textMd,fontSize:11,fontWeight:600,margin:"0 0 8px"}}>Resumo</p>
                {jogosSel.map(jogoId => {
                  const jogo = divulgados.find(j => j.id === jogoId);
                  if (!jogo) return null;
                  const subs = servicosSel[jogoId] || [];
                  const total = subs.reduce((s, sk) => s + (valores[`${jogoId}_${sk}`] || 0), 0);
                  return (
                    <div key={jogoId} style={{marginBottom:8}}>
                      <div style={{fontWeight:600,fontSize:13,color:T.text}}>{jogo.mandante} x {jogo.visitante}</div>
                      <div style={{fontSize:11,color:T.textSm,margin:"2px 0"}}>{subs.map(sk => SERVICOS_JOGO.find(x => x.subKey === sk)?.subLabel).filter(Boolean).join(", ")}</div>
                      <div style={{fontSize:13,color:BRAND,fontWeight:700}}>{fmt(total)}</div>
                    </div>
                  );
                })}
                <div style={{borderTop:`1px solid ${T.border}`,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:14,fontWeight:700,color:T.text}}>Total</span>
                  <span style={{fontSize:18,fontWeight:700,color:BRAND}}>{fmt(totalGeral)}</span>
                </div>
              </div>
            }
          />
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:step===0?"1fr":"1fr 1fr",gap:10,marginTop:16}}>
        {step > 0 && <button onClick={() => setStep(s => s-1)} style={{...btnS,background:"#475569"}}>Voltar</button>}
        {step < 4
          ? <button onClick={() => setStep(s => s+1)} disabled={!canNext()} style={{...btnS,background:canNext()?BRAND:"#334155",opacity:canNext()?1:0.5}}>Próximo</button>
          : <button onClick={handleSubmit} disabled={!canNext()||submitting} style={{...btnS,background:canNext()&&!submitting?BRAND:"#334155",opacity:canNext()&&!submitting?1:0.5,fontSize:16}}>{submitting?"Enviando...":"Enviar NF"}</button>
        }
      </div>
    </>
  );
}

// ── Formulário MENSAL ──────────────────────────────────────────────────────────
function FormMensal({ fornecedores, onDone }) {
  const [step, setStep] = useState(0);
  const [mesSel, setMesSel] = useState(new Date().getMonth());
  const [servicoSel, setServicoSel] = useState(null);
  const [valor, setValorState] = useState("");
  const [nfData, setNfData] = useState({ fornecedor:"", numeroNF:"", dataEmissao:"", dataEnvio:"", obs:"" });
  const [arquivo, setArquivo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const canNext = () => {
    if (step === 0) return mesSel != null;
    if (step === 1) return servicoSel != null;
    if (step === 2) return (parseFloat(valor) || 0) > 0;
    if (step === 3) return nfData.fornecedor.length > 0;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const submissionId = Date.now();
    let hasFile = false;
    if (arquivo) {
      try { const d = await fileToDataUrl(arquivo); await saveNFFile(submissionId, d); hasFile = true; } catch(_){}
    }
    const submission = {
      id: submissionId, tipo:"mensal", ...nfData,
      valorNF: parseFloat(valor) || 0,
      mes: mesSel, mesLabel: MESES[mesSel],
      servicoId: servicoSel.id,
      servicoNome: servicoSel.nome,
      servicosLabels: [servicoSel.nome],
      status:"pendente", hasFile, enviadoEm: new Date().toISOString(),
    };
    const current = (await getState('paulistao_nf_submissions')) || [];
    await setState('paulistao_nf_submissions', [...current, submission]);
    setSubmitting(false);
    onDone();
  };

  const STEPS = STEPS_MENSAL;
  const bySec = {};
  SERVICOS_MENSAIS.forEach(s => { if (!bySec[s.secao]) bySec[s.secao] = {color:s.color,items:[]}; bySec[s.secao].items.push(s); });

  return (
    <>
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

        {step === 0 && (
          <div>
            <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Qual o mês de referência?</h3>
            <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Selecione o mês da competência</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {MESES.map((m, i) => (
                <button key={m} onClick={() => setMesSel(i)}
                  style={{padding:"12px",borderRadius:10,border:`2px solid ${mesSel===i?BRAND:T.border}`,cursor:"pointer",fontSize:14,fontWeight:mesSel===i?700:400,
                    background:mesSel===i?T.brandSoft:T.bg,color:mesSel===i?BRAND:T.textMd,textAlign:"center"}}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Qual o serviço?</h3>
            <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Selecione o serviço prestado em {MESES[mesSel]}</p>
            {Object.entries(bySec).map(([secNome, {color, items}]) => (
              <div key={secNome} style={{marginBottom:16}}>
                <p style={{color,fontSize:12,fontWeight:700,margin:"0 0 8px"}}>{secNome}</p>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {items.map(s => {
                    const sel = servicoSel?.id === s.id;
                    return (
                      <button key={s.id} onClick={() => setServicoSel(s)}
                        style={{padding:"12px 16px",borderRadius:10,border:`2px solid ${sel?color:T.border}`,cursor:"pointer",
                          background:sel?color+"22":T.bg,color:sel?color:T.textMd,textAlign:"left",fontWeight:sel?700:400,fontSize:14}}>
                        {s.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Valor da NF</h3>
            <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>{servicoSel?.nome} · {MESES[mesSel]}</p>
            <div style={{display:"flex",alignItems:"center"}}>
              <span style={{background:T.muted,color:T.text,padding:"12px 12px",borderRadius:"8px 0 0 8px",fontSize:14,fontWeight:600}}>R$</span>
              <input type="number" value={valor} onChange={e => setValorState(e.target.value)}
                placeholder="0" style={{...IS,borderRadius:"0 8px 8px 0",borderLeft:"none",fontWeight:700,color:BRAND,fontSize:20}} autoFocus/>
            </div>
            {(parseFloat(valor)||0) > 0 && (
              <div style={{background:T.bg,borderRadius:10,padding:"14px 16px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:T.textMd,fontWeight:600,fontSize:14}}>Total</span>
                <span style={{fontSize:20,fontWeight:700,color:BRAND}}>{fmt(parseFloat(valor)||0)}</span>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <NFDataStep nfData={nfData} setNfData={setNfData} arquivo={arquivo} setArquivo={setArquivo} fileRef={fileRef} fornecedores={fornecedores}
            resumo={
              <div style={{background:T.bg,borderRadius:10,padding:"14px 16px"}}>
                <p style={{color:T.textMd,fontSize:11,fontWeight:600,margin:"0 0 8px"}}>Resumo</p>
                <div style={{fontWeight:600,fontSize:13,color:T.text}}>{servicoSel?.nome}</div>
                <div style={{fontSize:11,color:T.textSm,margin:"2px 0"}}>{MESES[mesSel]}</div>
                <div style={{fontSize:13,color:BRAND,fontWeight:700}}>{fmt(parseFloat(valor)||0)}</div>
              </div>
            }
          />
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:step===0?"1fr":"1fr 1fr",gap:10,marginTop:16}}>
        {step > 0 && <button onClick={() => setStep(s => s-1)} style={{...btnS,background:"#475569"}}>Voltar</button>}
        {step < 3
          ? <button onClick={() => setStep(s => s+1)} disabled={!canNext()} style={{...btnS,background:canNext()?BRAND:"#334155",opacity:canNext()?1:0.5}}>Próximo</button>
          : <button onClick={handleSubmit} disabled={!canNext()||submitting} style={{...btnS,background:canNext()&&!submitting?BRAND:"#334155",opacity:canNext()&&!submitting?1:0.5,fontSize:16}}>{submitting?"Enviando...":"Enviar NF"}</button>
        }
      </div>
    </>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function FormularioPublicoPaulistao() {
  const [jogos, setJogos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState(null); // null | "jogo" | "mensal"
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([getState('paulistao_jogos'), getState('paulistao_fornecedores')]).then(([j, f]) => {
      if (j) setJogos(j);
      if (f) setFornecedores(f);
      setLoading(false);
    });
  }, []);

  const divulgados = jogos.filter(j => j.mandante !== "A definir");

  const reset = () => { setTipo(null); setDone(false); };

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

        ) : !tipo ? (
          /* Seletor de tipo */
          <div style={{background:T.card,borderRadius:16,padding:"28px 20px"}}>
            <h3 style={{color:T.text,margin:"0 0 4px",fontSize:16}}>Tipo de nota fiscal</h3>
            <p style={{color:T.textSm,fontSize:12,margin:"0 0 20px"}}>Selecione o tipo de NF que deseja enviar</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <button onClick={() => setTipo("jogo")}
                style={{padding:"18px 20px",borderRadius:12,border:`2px solid ${T.border}`,cursor:"pointer",background:T.bg,textAlign:"left",
                  display:"flex",alignItems:"center",gap:16,transition:"border-color 0.15s"}}
                onMouseEnter={e => e.currentTarget.style.borderColor = BRAND}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                <div style={{width:44,height:44,borderRadius:10,background:T.brandSoft,border:`1px solid ${T.brandBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>⚽</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:T.text}}>Por Jogo</div>
                  <div style={{fontSize:12,color:T.textSm,marginTop:2}}>UM B3, Produtor de UM, Produtor de Campo, Supervisor 1, Geradores, SNG</div>
                </div>
              </button>
              <button onClick={() => setTipo("mensal")}
                style={{padding:"18px 20px",borderRadius:12,border:`2px solid ${T.border}`,cursor:"pointer",background:T.bg,textAlign:"left",
                  display:"flex",alignItems:"center",gap:16,transition:"border-color 0.15s"}}
                onMouseEnter={e => e.currentTarget.style.borderColor = BRAND}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                <div style={{width:44,height:44,borderRadius:10,background:"rgba(124,58,237,0.14)",border:"1px solid rgba(124,58,237,0.32)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📅</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:T.text}}>Mensal</div>
                  <div style={{fontSize:12,color:T.textSm,marginTop:2}}>Coord. Sinal Internacional, Editor de Vídeos, Vmix, Estatísticas, Ingest/WSC</div>
                </div>
              </button>
            </div>
          </div>

        ) : tipo === "jogo" ? (
          <FormJogo divulgados={divulgados} fornecedores={fornecedores} onDone={() => setDone(true)}/>
        ) : (
          <FormMensal fornecedores={fornecedores} onDone={() => setDone(true)}/>
        )}

        {tipo && !done && (
          <button onClick={() => setTipo(null)} style={{...btnS,background:"transparent",color:T.textSm,fontSize:12,marginTop:8,border:`1px solid ${T.border}`}}>
            ← Voltar ao início
          </button>
        )}
      </div>

      <div style={{textAlign:"center",padding:"20px",color:T.textSm,fontSize:10}}>
        FFU — Transmissões · Paulistão F 2026
      </div>
    </div>
  );
}
