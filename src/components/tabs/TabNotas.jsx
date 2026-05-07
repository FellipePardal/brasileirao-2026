import { useState, useMemo, useRef, useEffect } from "react";
import { KPI, Pill } from "../shared";
import { fmt, subTotal } from "../../utils";
import { CATS, btnStyle, iSty, RADIUS } from "../../constants";
import { fileToDataUrl, saveNFFile, getNFFile, deleteNFFile, getState, setState as setSupabaseState } from "../../lib/supabase";
import { usePortalLink } from "../../hooks/usePortalLink";
import { getOperacionaisPorSubKey, findFornecedorTolerante } from "../../lib/portalLink";
import { Card, PanelTitle, Button, Chip, Segmented, Progress, tableStyles } from "../ui";
import { Plus, Eye, Trash2, Upload, Copy as CopyIcon, FileText } from "lucide-react";

const STATUS_NF = ["Pendente","Solicitada","Recebida","Conferida"];
const STATUS_COLOR = {"Pendente":"#f59e0b","Solicitada":"#3b82f6","Recebida":"#8b5cf6","Conferida":"#22c55e"};

// Append-only em nf_historico — toda criação/exclusão de NF deixa rastro
// (independente da origem: formulário público, "Registrar NF" ou "NF Avulsa").
// Permite reconstruir o array de notas se ele for zerado por bug ou ação manual.
async function pushHistorico(entry) {
  const atual = (await getState('nf_historico')) || [];
  await setSupabaseState('nf_historico', [...atual, entry]);
}

function FornecedorInput({ value, onChange, fornecedores, T }) {
  const IS = iSty(T);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const query = value.toLowerCase();
  const filtered = query.length > 0
    ? fornecedores.filter(f => f.apelido.toLowerCase().includes(query) || f.razaoSocial.toLowerCase().includes(query) || f.funcao.toLowerCase().includes(query)).slice(0, 8)
    : [];

  return (
    <div style={{position:"relative"}} ref={ref}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Digite para buscar..." style={IS}/>
      {open && filtered.length > 0 && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,marginTop:4,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.3)"}}>
          {filtered.map(f => (
            <div key={f.id} onMouseDown={() => { onChange(f.apelido); setOpen(false); }}
              style={{padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,display:"flex",flexDirection:"column",gap:2}}
              onMouseEnter={e => e.currentTarget.style.background = T.bg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:600,color:T.text}}>{f.apelido}</span>
                <span style={{fontSize:10,color:T.textSm,background:T.bg,padding:"1px 6px",borderRadius:4}}>{f.tipo}</span>
              </div>
              <span style={{fontSize:11,color:T.textSm}}>{f.funcao} · {f.razaoSocial.slice(0,40)}{f.razaoSocial.length>40?"...":""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewModal({ nota, onClose, T }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nota) return;
    setLoading(true);
    setSrc(null);
    getNFFile(nota.id).then(data => { setSrc(data); setLoading(false); }).catch(() => setLoading(false));
  }, [nota?.id]);

  if (!nota) return null;
  const isPdf = src?.startsWith('data:application/pdf');
  return (
    <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:200,display:"flex",flexDirection:"column"}}
      onClick={onClose}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",flexShrink:0}}
        onClick={e => e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <code style={{color:"#22c55e",fontSize:13,fontWeight:700}}>{nota.codigo}</code>
          <span style={{color:"#fff",fontSize:13}}>{nota.fornecedor}</span>
          <span style={{color:"#8b5cf6",fontWeight:600,fontSize:13}}>{fmt(nota.valorNF)}</span>
          <span style={{color:"#94a3b8",fontSize:12}}>{nota.jogoLabel} · Rd {nota.rodada}</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <a href={src} download={nota.codigo} style={{...btnStyle,background:"#3b82f6",padding:"6px 14px",fontSize:12,textDecoration:"none"}}>Download</a>
          <button onClick={onClose} style={{...btnStyle,background:"#475569",padding:"6px 14px",fontSize:12}}>Fechar</button>
        </div>
      </div>
      <div style={{flex:1,padding:"0 20px 20px",minHeight:0}} onClick={e => e.stopPropagation()}>
        {loading ? (
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <p style={{color:"#94a3b8",fontSize:16}}>Carregando...</p>
          </div>
        ) : !src ? (
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <p style={{color:"#94a3b8",fontSize:16}}>Arquivo não encontrado</p>
          </div>
        ) : isPdf ? (
          <iframe src={src} style={{width:"100%",height:"100%",border:"none",borderRadius:12,background:"#fff"}}/>
        ) : (
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",overflow:"auto"}}>
            <img src={src} alt={nota.codigo} style={{maxWidth:"100%",maxHeight:"100%",borderRadius:12,objectFit:"contain"}}/>
          </div>
        )}
      </div>
    </div>
  );
}

const SUBS_EXCLUIR = new Set(["transporte","uber","hospedagem","seg_espacial","infra","seg_extra"]);
// Subs que aceitam várias NFs compondo o mesmo provisionado (ex: diária, extras)
const SUBS_MULTI_NF = new Set(["diaria","extra"]);

function extrairServicos(jogo) {
  const servicos = [];
  CATS.forEach(cat => {
    cat.subs.forEach(sub => {
      if (SUBS_EXCLUIR.has(sub.key)) return;
      const valProv = jogo.provisionado?.[sub.key] || 0;
      if (valProv > 0) {
        servicos.push({ subKey: sub.key, subLabel: sub.label, catLabel: cat.label, catColor: cat.color, valorRef: valProv });
      }
    });
  });
  return servicos;
}

function abreviar(nome) {
  if (!nome || nome === "A definir") return "TBD";
  const map = {"Fluminense":"FLU","Botafogo":"BOT","Flamengo":"FLA","Vasco":"VAS","Corinthians":"COR","Palmeiras":"PAL","São Paulo":"SAO","Athletico PR":"CAP","Grêmio":"GRE","Internacional":"INT","Cruzeiro":"CRU","Atlético MG":"CAM","Chapecoense":"CHA","Santos":"SAN","Vitória":"VIT","Mirassol":"MIR","Coritiba":"CFC"};
  return map[nome] || nome.slice(0,3).toUpperCase();
}

function gerarCodigo(rodada, mandante, visitante, valorNF, numeroNF) {
  const rd = String(rodada).padStart(2, "0");
  const m = abreviar(mandante);
  const v = abreviar(visitante);
  const val = Math.round(valorNF || 0);
  const nf = (numeroNF || "SN").replace(/\s/g, "");
  return `RD${rd}_${m}x${v}_${val}_NF${nf}`;
}

// ─── Modal para registrar NF (suporta multi-jogo e multi-serviço) ────────────
const norm = s => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function RegistrarNFModal({ jogosRodada, notasExistentes, fornecedores, onSave, onClose, T, portal }) {
  const IS = iSty(T);
  const [form, setForm] = useState({
    numeroNF: "", fornecedor: "", dataEmissao: "", dataEnvio: "", obs: "", valorNF: "",
  });
  // selecionados: { "jogoId_subKey": valor }
  const [selecionados, setSelecionados] = useState({});
  const [arquivo, setArquivo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  // Soma de NFs já lançadas por (jogoId, subKey) — usado para subs multi-NF
  const valoresLancados = {};
  notasExistentes.forEach(n => {
    if (n.servicosDetalhe) {
      Object.entries(n.servicosDetalhe).forEach(([k, v]) => {
        valoresLancados[k] = (valoresLancados[k] || 0) + (v || 0);
      });
    } else if (n.servicosValores && n.jogoId) {
      Object.entries(n.servicosValores).forEach(([subKey, v]) => {
        const k = `${n.jogoId}_${subKey}`;
        valoresLancados[k] = (valoresLancados[k] || 0) + (v || 0);
      });
    }
  });

  // Serviços livres por jogo (provisionado > 0 + extras com fornecedor no Portal)
  const jogosComServicos = jogosRodada.map(jogo => {
    const base = extrairServicos(jogo);
    const baseKeys = new Set(base.map(s => s.subKey));
    const portalExtras = [];
    // Mantém todas as linhas UM com provisionado > 0 (categoria pode mudar entre orcamento e execução)
    let baseFinal = base;
    const baseTemUM = base.some(s => /^um_b/.test(s.subKey));
    if (portal) {
      const opCat = CATS.find(c => c.key === 'operacoes') || CATS[0];
      // SNG: divide em Premiere e Host (usam buckets financeiros diferentes — sng_extra e sng)
      const sngP = getOperacionaisPorSubKey(jogo.id, 'sng_premiere', portal);
      const sngH = getOperacionaisPorSubKey(jogo.id, 'sng_host', portal);
      if (sngP.length || sngH.length) {
        baseFinal = base.filter(s => s.subKey !== 'sng' && s.subKey !== 'sng_extra');
        if (sngH.length) portalExtras.push({ subKey: 'sng_host', subLabel: 'SNG Host', catLabel: opCat.label, catColor: opCat.color, valorRef: jogo.provisionado?.sng || 0, fromPortal: true });
        if (sngP.length) portalExtras.push({ subKey: 'sng_premiere', subLabel: 'SNG Premiere', catLabel: opCat.label, catColor: opCat.color, valorRef: jogo.provisionado?.sng_extra || 0, fromPortal: true });
      }
      CATS.forEach(cat => {
        cat.subs.forEach(sub => {
          if (sub.key === 'sng') return;
          if (baseKeys.has(sub.key)) return;
          if (SUBS_EXCLUIR.has(sub.key)) return;
          if (/^um_b/.test(sub.key) && baseTemUM) return;
          const opers = getOperacionaisPorSubKey(jogo.id, sub.key, portal, jogo.categoria);
          if (opers.length > 0) {
            portalExtras.push({
              subKey: sub.key, subLabel: sub.label,
              catLabel: cat.label, catColor: cat.color,
              valorRef: 0, fromPortal: true,
            });
          }
        });
      });
    }
    const servicos = [...baseFinal, ...portalExtras].map(s => {
      const key = `${jogo.id}_${s.subKey}`;
      const lancado = valoresLancados[key] || 0;
      const restante = Math.max(0, s.valorRef - lancado);
      return { ...s, lancado, restante, multi: SUBS_MULTI_NF.has(s.subKey) };
    }).filter(s => {
      if (s.multi) return true; // multi-NF sempre visível (pode lançar além do provisionado)
      const key = `${jogo.id}_${s.subKey}`;
      const nota = notasExistentes.find(n => n.servicosKeys?.includes(key));
      return !nota || nota.status !== "Conferida";
    });
    return { jogo, servicos };
  }).filter(j => j.servicos.length > 0);

  const toggleServico = (jogoId, subKey, valorSugerido) => {
    const key = `${jogoId}_${subKey}`;
    setSelecionados(prev => {
      if (prev[key] !== undefined) {
        const n = {...prev};
        delete n[key];
        if (Object.keys(n).length === 0) setForm(f => ({...f, valorNF: ""}));
        return n;
      }
      const next = {...prev, [key]: valorSugerido};
      if (Object.keys(prev).length === 0) setForm(f => ({...f, valorNF: String(valorSugerido || "")}));
      return next;
    });
  };

  const setValorUnit = (key, val) => {
    setSelecionados(prev => ({...prev, [key]: parseFloat(val) || 0}));
  };

  const setValorNFForm = (val) => {
    setForm(f => ({...f, valorNF: val}));
    // Com um único serviço selecionado, sincroniza o valor direto no selecionados
    if (selKeys.length === 1) {
      setSelecionados(prev => ({...prev, [selKeys[0]]: parseFloat(val) || 0}));
    }
  };

  const selKeys = Object.keys(selecionados);
  const totalNF = Object.values(selecionados).reduce((s, v) => s + (v || 0), 0);
  const rodada = jogosRodada[0]?.rodada;

  // Seleção é manual: o usuário clica em cada chip do fornecedor (ou no checkbox)
  // pra adicionar serviço por serviço. Isso permite registrar 1 NF por jogo
  // quando o fornecedor manda notas separadas.
  const jogoIds = [...new Set(selKeys.map(k => parseInt(k.split("_")[0])))];
  const jogoLabel = jogoIds.map(id => { const j = jogosRodada.find(x => x.id === id); return j ? `${j.mandante} x ${j.visitante}` : ""; }).join(" + ");
  const firstJogo = jogosRodada.find(j => j.id === jogoIds[0]) || jogosRodada[0];
  const codigo = firstJogo ? gerarCodigo(rodada, firstJogo.mandante, firstJogo.visitante, totalNF, form.numeroNF) : "";

  const handleSave = async () => {
    if (!form.numeroNF && !form.fornecedor) return;
    if (selKeys.length === 0) return;
    setUploading(true);
    const notaId = Date.now();
    let hasFile = false;
    if (arquivo) {
      try { const dataUrl = await fileToDataUrl(arquivo); await saveNFFile(notaId, dataUrl); hasFile = true; } catch(_){}
    }
    // servicosValores agrupado por subKey (para sync realizado), mas servicosKeys com jogoId
    const servicosValores = {};
    selKeys.forEach(k => {
      const subKey = k.split("_").slice(1).join("_");
      servicosValores[subKey] = (servicosValores[subKey] || 0) + selecionados[k];
    });
    // jogoIds envolvidos — salvar array para sync multi-jogo
    const jogosEnvolvidos = [...new Set(selKeys.map(k => parseInt(k.split("_")[0])))];
    const allLabels = selKeys.map(k => {
      const subKey = k.split("_").slice(1).join("_");
      for (const jcs of jogosComServicos) { const s = jcs.servicos.find(x => x.subKey === subKey); if (s) return s.subLabel; }
      return subKey;
    });

    onSave({
      id: notaId,
      codigo,
      ...form,
      valorNF: totalNF,
      rodada,
      jogoId: jogosEnvolvidos.length === 1 ? jogosEnvolvidos[0] : jogosEnvolvidos[0],
      jogoIds: jogosEnvolvidos,
      jogoLabel,
      servicosKeys: selKeys,
      servicosLabels: [...new Set(allLabels)],
      servicosValores,
      servicosDetalhe: {...selecionados}, // "jogoId_subKey": valor (granular)
      tipo: "prevista",
      status: "Conferida",
      hasFile,
    });
    setUploading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:T.card,borderRadius:16,padding:28,width:"100%",maxWidth:660,maxHeight:"90vh",overflowY:"auto"}}>
        <h3 style={{margin:"0 0 4px",fontSize:16,color:T.text}}>Registrar Nota Fiscal</h3>
        <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Rodada {rodada} · Selecione serviços de um ou mais jogos</p>

        {/* Seleção por jogo */}
        <div style={{marginBottom:16}}>
          {jogosComServicos.map(({ jogo, servicos }) => (
            <div key={jogo.id} style={{marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <Pill label={jogo.categoria} color={jogo.categoria==="B1"?"#22c55e":"#f59e0b"}/>
                <span style={{fontWeight:700,fontSize:13,color:T.text}}>{jogo.mandante} x {jogo.visitante}</span>
              </div>
              <div style={{background:T.bg,borderRadius:8,padding:8,display:"flex",flexDirection:"column",gap:2}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"2px 8px",fontSize:10,color:T.textSm}}>
                  <span style={{width:20}}/><span style={{flex:1}}>Serviço</span>
                  <span style={{width:80,textAlign:"right"}}>Ref. / Rest.</span>
                  <span style={{width:100,textAlign:"right"}}>Valor NF</span>
                </div>
                {servicos.map(s => {
                  const key = `${jogo.id}_${s.subKey}`;
                  const checked = selecionados[key] !== undefined;
                  const valorSugerido = s.multi ? s.restante : s.valorRef;
                  const opersRaw = portal ? getOperacionaisPorSubKey(jogo.id, s.subKey, portal, jogo.categoria) : [];
                  // Substitui pelo apelido canônico do Hub quando há match tolerante
                  const opers = [...new Set(opersRaw.map(n => {
                    const f = findFornecedorTolerante(fornecedores, n);
                    return f ? f.apelido : n;
                  }))];
                  const matchOpFornecedor = form.fornecedor && opers.some(n => norm(n) === norm(form.fornecedor) || norm(n).includes(norm(form.fornecedor)) || norm(form.fornecedor).includes(norm(n)));
                  return (
                    <div key={key} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,
                      background:checked?s.catColor+"18":(matchOpFornecedor?"#10b98114":"transparent"),
                      border: matchOpFornecedor && !checked ? "1px dashed #10b98155" : "1px solid transparent"}}>
                      <input type="checkbox" checked={checked} onChange={() => toggleServico(jogo.id, s.subKey, valorSugerido)}/>
                      <span style={{fontSize:13,color:T.text,flex:1,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        {s.subLabel}
                        {opers.length > 0 && opers.map((nm, i) => (
                          <span key={i}
                            onClick={() => { set("fornecedor", nm); if (!checked) toggleServico(jogo.id, s.subKey, valorSugerido); }}
                            title="Nome operacional do Portal — clique para usar como fornecedor"
                            style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:"#10b98122",color:"#10b981",fontWeight:600,letterSpacing:0.3,cursor:"pointer",border:"1px solid #10b98144"}}>
                            → {nm}
                          </span>
                        ))}
                        {s.multi && s.lancado > 0 && (
                          <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:"#f59e0b22",color:"#f59e0b",fontWeight:600,letterSpacing:0.3}}>
                            {fmt(s.lancado)} / {fmt(s.valorRef)}
                          </span>
                        )}
                        {s.multi && s.lancado === 0 && (
                          <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:"#3b82f622",color:"#3b82f6",fontWeight:600,letterSpacing:0.3}}>
                            multi-NF
                          </span>
                        )}
                      </span>
                      <span style={{fontSize:11,color:T.textSm,width:80,textAlign:"right"}}>
                        {s.multi ? <>Rest. <b style={{color:T.textMd}}>{fmt(s.restante)}</b></> : fmt(s.valorRef)}
                      </span>
                      {checked
                        ? <input type="number" value={selecionados[key]} onChange={e => setValorUnit(key, e.target.value)}
                            style={{...IS,width:100,textAlign:"right",padding:"3px 6px",fontSize:12,color:"#8b5cf6",fontWeight:600}}/>
                        : <span style={{width:100}}/>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {jogosComServicos.length === 0 && <p style={{color:T.textSm,fontSize:12}}>Todos os serviços já possuem NF</p>}
          {selKeys.length > 0 && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,padding:"0 8px"}}>
              <span style={{color:T.textMd,fontSize:11}}>{selKeys.length} serviço{selKeys.length>1?"s":""}{jogoIds.length>1?` em ${jogoIds.length} jogos`:""}</span>
              <span style={{fontSize:14,fontWeight:700,color:"#8b5cf6"}}>Total NF: {fmt(totalNF)}</span>
            </div>
          )}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Fornecedor</label>
            <FornecedorInput value={form.fornecedor} onChange={v => set("fornecedor", v)} fornecedores={fornecedores} T={T}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Nº da Nota</label>
            <input value={form.numeroNF} onChange={e => set("numeroNF", e.target.value)} style={IS}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>
              Valor NF (R$){selKeys.length > 1 && <span style={{color:T.textSm,fontSize:10,marginLeft:6}}>— edite por serviço acima</span>}
            </label>
            {selKeys.length <= 1
              ? <input type="number" value={form.valorNF} onChange={e => setValorNFForm(e.target.value)} style={IS}/>
              : <input readOnly value={totalNF} style={{...IS, opacity:0.55, cursor:"not-allowed"}}/>}
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Data Emissão</label>
            <input value={form.dataEmissao} onChange={e => set("dataEmissao", e.target.value)} placeholder="dd/mm" style={IS}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Data Envio</label>
            <input value={form.dataEnvio} onChange={e => set("dataEnvio", e.target.value)} placeholder="dd/mm" style={IS}/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Observações</label>
          <input value={form.obs} onChange={e => set("obs", e.target.value)} style={IS}/>
        </div>

        {/* Upload de arquivo */}
        <div style={{marginBottom:16}}>
          <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Arquivo da NF (PDF/imagem)</label>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => setArquivo(e.target.files[0] || null)} style={{display:"none"}}/>
          <div onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {e.preventDefault(); setArquivo(e.dataTransfer.files[0] || null);}}
            style={{border:`2px dashed ${arquivo?'#22c55e':T.muted}`,borderRadius:8,padding:"14px 16px",cursor:"pointer",textAlign:"center",
              background:arquivo?"#22c55e11":T.bg,transition:"all 0.2s"}}>
            {arquivo
              ? <p style={{margin:0,color:"#22c55e",fontSize:13,fontWeight:600}}>{arquivo.name} ({(arquivo.size/1024).toFixed(0)} KB)</p>
              : <p style={{margin:0,color:T.textSm,fontSize:12}}>Clique ou arraste o arquivo aqui</p>}
          </div>
        </div>

        {/* Código gerado */}
        {(form.numeroNF || totalNF > 0) && (
          <div style={{background:T.bg,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
            <p style={{color:T.textSm,fontSize:11,margin:"0 0 4px"}}>Código do arquivo:</p>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <code style={{fontSize:15,fontWeight:700,color:"#22c55e",letterSpacing:0.5,flex:1}}>{codigo}</code>
              <button onClick={() => {navigator.clipboard.writeText(codigo);}} style={{...btnStyle,background:T.border,padding:"4px 10px",fontSize:10,color:T.text}}>Copiar</button>
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{...btnStyle,background:"#475569"}}>Cancelar</button>
          <button onClick={handleSave} disabled={selecionados.length===0||uploading} style={{...btnStyle,background:selecionados.length>0?"#22c55e":"#475569",opacity:selecionados.length>0&&!uploading?1:0.5}}>
            {uploading ? "Enviando..." : "Salvar NF"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal para NF avulsa (não prevista) ─────────────────────────────────────
function NFAvulsaModal({ jogos, fornecedores, onSave, onClose, T }) {
  const IS = iSty(T);
  const divulgados = jogos.filter(j => j.mandante !== "A definir");
  const [jogoId, setJogoId] = useState(divulgados[0]?.id || null);
  const jogo = divulgados.find(j => j.id === parseInt(jogoId)) || divulgados[0];
  const [form, setForm] = useState({
    numeroNF: "", fornecedor: "", valorNF: 0, dataEmissao: "", dataEnvio: "", obs: "", descricao: "",
  });
  const [arquivo, setArquivo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const codigo = jogo ? gerarCodigo(jogo.rodada, jogo.mandante, jogo.visitante, form.valorNF, form.numeroNF) : "";

  const handleSave = async () => {
    if (!jogo || (!form.numeroNF && !form.fornecedor)) return;
    setUploading(true);
    const notaId = Date.now();
    let hasFile = false;
    if (arquivo) {
      try {
        const dataUrl = await fileToDataUrl(arquivo);
        await saveNFFile(notaId, dataUrl);
        hasFile = true;
      } catch(_){}
    }
    onSave({
      id: notaId,
      codigo,
      ...form,
      valorNF: parseFloat(form.valorNF) || 0,
      rodada: jogo.rodada,
      jogoId: jogo.id,
      jogoLabel: `${jogo.mandante} x ${jogo.visitante}`,
      mandante: jogo.mandante,
      visitante: jogo.visitante,
      servicosKeys: [],
      servicosLabels: [form.descricao || "Avulsa"],
      tipo: "avulsa",
      status: "Conferida",
      hasFile,
    });
    setUploading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:T.card,borderRadius:16,padding:28,width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}}>
        <h3 style={{margin:"0 0 4px",fontSize:16,color:T.text}}>NF Avulsa / Não Prevista</h3>
        <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>Para notas que não estavam previstas ou com valores diferentes</p>

        <div style={{marginBottom:12}}>
          <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Jogo</label>
          <select value={jogoId} onChange={e => setJogoId(e.target.value)} style={IS}>
            {divulgados.map(j => <option key={j.id} value={j.id}>Rd {j.rodada} · {j.mandante} x {j.visitante}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Fornecedor</label>
            <FornecedorInput value={form.fornecedor} onChange={v => set("fornecedor", v)} fornecedores={fornecedores} T={T}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Nº da Nota</label>
            <input value={form.numeroNF} onChange={e => set("numeroNF", e.target.value)} style={IS}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Valor NF (R$)</label>
            <input type="number" value={form.valorNF} onChange={e => set("valorNF", e.target.value)} style={IS}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Data Emissão</label>
            <input value={form.dataEmissao} onChange={e => set("dataEmissao", e.target.value)} placeholder="dd/mm" style={IS}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Data Envio</label>
            <input value={form.dataEnvio} onChange={e => set("dataEnvio", e.target.value)} placeholder="dd/mm" style={IS}/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Descrição do serviço</label>
          <input value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Ex: Frete extra, serviço adicional..." style={IS}/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Observações</label>
          <input value={form.obs} onChange={e => set("obs", e.target.value)} style={IS}/>
        </div>

        {/* Upload */}
        <div style={{marginBottom:16}}>
          <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Arquivo da NF (PDF/imagem)</label>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => setArquivo(e.target.files[0] || null)} style={{display:"none"}}/>
          <div onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {e.preventDefault(); setArquivo(e.dataTransfer.files[0] || null);}}
            style={{border:`2px dashed ${arquivo?'#22c55e':T.muted}`,borderRadius:8,padding:"14px 16px",cursor:"pointer",textAlign:"center",
              background:arquivo?"#22c55e11":T.bg}}>
            {arquivo
              ? <p style={{margin:0,color:"#22c55e",fontSize:13,fontWeight:600}}>{arquivo.name} ({(arquivo.size/1024).toFixed(0)} KB)</p>
              : <p style={{margin:0,color:T.textSm,fontSize:12}}>Clique ou arraste o arquivo aqui</p>}
          </div>
        </div>

        {(form.numeroNF || form.valorNF > 0) && (
          <div style={{background:T.bg,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
            <p style={{color:T.textSm,fontSize:11,margin:"0 0 4px"}}>Código do arquivo:</p>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <code style={{fontSize:15,fontWeight:700,color:"#22c55e",letterSpacing:0.5,flex:1}}>{codigo}</code>
              <button onClick={() => {navigator.clipboard.writeText(codigo);}} style={{...btnStyle,background:T.border,padding:"4px 10px",fontSize:10,color:T.text}}>Copiar</button>
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{...btnStyle,background:"#475569"}}>Cancelar</button>
          <button onClick={handleSave} disabled={uploading} style={{...btnStyle,background:"#f59e0b",color:"#000",opacity:uploading?0.5:1}}>
            {uploading ? "Enviando..." : "Salvar NF Avulsa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal NF Livemode / Reembolso Multi-jogo ────────────────────────────────
const LOG_SUBS = (CATS.find(c => c.key === "logistica")?.subs || []).map(s => s.key);
const logProvTotal = jogo => LOG_SUBS.reduce((s, k) => s + (jogo.provisionado?.[k] || 0), 0);

function NFLivemodeModal({ jogos, fornecedores, onSave, onClose, T }) {
  const IS = iSty(T);
  const divulgados = jogos.filter(j => j.mandante !== "A definir");
  const [form, setForm] = useState({ fornecedor: "Livemode", numeroNF: "", valorNF: "", dataEmissao: "", dataEnvio: "", obs: "" });
  const [jogosSel, setJogosSel] = useState(new Set());
  const [distrib, setDistrib] = useState({});
  const [arquivo, setArquivo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const toggleJogo = (jogoId) => {
    setJogosSel(prev => {
      const next = new Set(prev);
      if (next.has(jogoId)) {
        next.delete(jogoId);
        setDistrib(d => { const nd = {...d}; delete nd[jogoId]; return nd; });
      } else {
        next.add(jogoId);
        const jogo = divulgados.find(j => j.id === jogoId);
        setDistrib(d => ({...d, [jogoId]: logProvTotal(jogo)}));
      }
      return next;
    });
  };

  const autoDistribuir = () => {
    const totalNF = parseFloat(form.valorNF) || 0;
    if (totalNF === 0 || jogosSel.size === 0) return;
    const selecionados = divulgados.filter(j => jogosSel.has(j.id));
    const totalProv = selecionados.reduce((s, j) => s + logProvTotal(j), 0);
    const next = {};
    selecionados.forEach((j, i) => {
      if (totalProv === 0) {
        next[j.id] = i < selecionados.length - 1
          ? Math.round(totalNF / selecionados.length * 100) / 100
          : totalNF - selecionados.slice(0, i).reduce((s, x) => s + (next[x.id] || 0), 0);
      } else {
        const proporcional = Math.round((logProvTotal(j) / totalProv) * totalNF * 100) / 100;
        next[j.id] = i < selecionados.length - 1
          ? proporcional
          : Math.round((totalNF - selecionados.slice(0, i).reduce((s, x) => s + (next[x.id] || 0), 0)) * 100) / 100;
      }
    });
    setDistrib(next);
  };

  const totalDistrib = Object.values(distrib).reduce((s, v) => s + (v || 0), 0);
  const totalNF = parseFloat(form.valorNF) || 0;
  const diff = Math.round((totalNF - totalDistrib) * 100) / 100;
  const ok = Math.abs(diff) < 0.01;

  const jogosSelecionados = divulgados.filter(j => jogosSel.has(j.id));
  const firstJogo = jogosSelecionados[0];
  const rodada = firstJogo?.rodada;
  const jogoLabel = jogosSelecionados.map(j => `${j.mandante} x ${j.visitante}`).join(" + ");
  const codigo = firstJogo ? gerarCodigo(rodada, firstJogo.mandante, firstJogo.visitante, totalNF, form.numeroNF) : "";

  const handleSave = async () => {
    if (jogosSel.size === 0 || totalNF === 0) return;
    setUploading(true);
    const notaId = Date.now();
    let hasFile = false;
    if (arquivo) {
      try { const dataUrl = await fileToDataUrl(arquivo); await saveNFFile(notaId, dataUrl); hasFile = true; } catch(_) {}
    }
    const jogoIds = [...jogosSel];
    const servicosDetalhe = {};
    jogoIds.forEach(id => { servicosDetalhe[`${id}_reembolso_log`] = distrib[id] || 0; });

    onSave({
      id: notaId, codigo, ...form,
      valorNF: totalNF, rodada,
      jogoId: jogoIds[0], jogoIds, jogoLabel,
      servicosKeys: [], servicosLabels: ["Reembolso Log. Livemode"],
      servicosDetalhe,
      tipo: "reembolso_livemode", status: "Conferida", hasFile,
    });
    setUploading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:T.card,borderRadius:16,padding:28,width:"100%",maxWidth:660,maxHeight:"92vh",overflowY:"auto"}}>
        <h3 style={{margin:"0 0 4px",fontSize:16,color:T.text}}>NF Livemode — Reembolso Multi-jogo</h3>
        <p style={{color:T.textSm,fontSize:12,margin:"0 0 16px"}}>NF emitida pela Livemode cobrindo logística de vários jogos — distribua o valor proporcionalmente pelo provisionado</p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          {[
            ["Fornecedor","fornecedor","text"],
            ["Nº da Nota","numeroNF","text"],
            ["Valor Total NF (R$)","valorNF","number"],
            ["Data Emissão","dataEmissao","text","dd/mm"],
            ["Data Envio","dataEnvio","text","dd/mm"],
            ["Observações","obs","text"],
          ].map(([label, key, type, ph]) => (
            <div key={key} style={{marginBottom:12}}>
              <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>{label}</label>
              {key === "fornecedor"
                ? <FornecedorInput value={form.fornecedor} onChange={v => set("fornecedor", v)} fornecedores={fornecedores} T={T}/>
                : <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={ph||""} style={IS}/>}
            </div>
          ))}
        </div>

        {/* Seleção de jogos */}
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <label style={{color:T.textMd,fontSize:12,fontWeight:600}}>Jogos cobertos pela NF</label>
            {jogosSel.size > 0 && totalNF > 0 && (
              <button onClick={autoDistribuir} style={{...btnStyle,background:"#3b82f6",padding:"4px 12px",fontSize:11}}>
                Auto-distribuir proporcionalmente
              </button>
            )}
          </div>
          <div style={{background:T.bg,borderRadius:8,padding:8,display:"flex",flexDirection:"column",gap:3}}>
            {divulgados.length === 0 && <p style={{color:T.textSm,fontSize:12,padding:8}}>Nenhum jogo divulgado</p>}
            {divulgados.map(jogo => {
              const sel = jogosSel.has(jogo.id);
              const lp = logProvTotal(jogo);
              return (
                <div key={jogo.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,
                  background:sel?"#3b82f622":"transparent",border:`1px solid ${sel?"#3b82f644":"transparent"}`}}>
                  <input type="checkbox" checked={sel} onChange={() => toggleJogo(jogo.id)}/>
                  <Pill label={jogo.categoria} color={jogo.categoria==="B1"?"#22c55e":"#f59e0b"}/>
                  <span style={{flex:1,fontSize:13,color:T.text,fontWeight:600}}>
                    Rd {jogo.rodada} · {jogo.mandante} × {jogo.visitante}
                  </span>
                  <span style={{fontSize:11,color:T.textSm}}>Log. prov.: <b style={{color:T.textMd}}>{fmt(lp)}</b></span>
                  {sel && (
                    <input type="number" value={distrib[jogo.id] ?? ""}
                      onChange={e => setDistrib(d => ({...d, [jogo.id]: parseFloat(e.target.value) || 0}))}
                      style={{...IS,width:110,textAlign:"right",padding:"3px 6px",fontSize:12,color:"#8b5cf6",fontWeight:600}}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumo distribuição */}
        {jogosSel.size > 0 && (
          <div style={{background:T.bg,borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:T.textMd}}>Distribuído: <b style={{color:"#8b5cf6"}}>{fmt(totalDistrib)}</b></span>
            <span style={{fontSize:12,color:T.textMd}}>Total NF: <b style={{color:T.text}}>{fmt(totalNF)}</b></span>
            <span style={{fontSize:12,color:T.textMd}}>Diferença: <b style={{color:ok?"#22c55e":"#ef4444"}}>{ok?"✓ zerado":fmt(diff)}</b></span>
          </div>
        )}

        {/* Upload */}
        <div style={{marginBottom:16}}>
          <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Arquivo da NF (PDF/imagem)</label>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => setArquivo(e.target.files[0]||null)} style={{display:"none"}}/>
          <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); setArquivo(e.dataTransfer.files[0]||null);}}
            style={{border:`2px dashed ${arquivo?'#22c55e':T.muted}`,borderRadius:8,padding:"12px 16px",cursor:"pointer",textAlign:"center",background:arquivo?"#22c55e11":T.bg}}>
            {arquivo
              ? <p style={{margin:0,color:"#22c55e",fontSize:13,fontWeight:600}}>{arquivo.name}</p>
              : <p style={{margin:0,color:T.textSm,fontSize:12}}>Clique ou arraste o arquivo</p>}
          </div>
        </div>

        {(form.numeroNF || totalNF > 0) && codigo && (
          <div style={{background:T.bg,borderRadius:8,padding:"10px 14px",marginBottom:16}}>
            <p style={{color:T.textSm,fontSize:11,margin:"0 0 4px"}}>Código:</p>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <code style={{fontSize:14,fontWeight:700,color:"#22c55e",flex:1}}>{codigo}</code>
              <button onClick={() => navigator.clipboard.writeText(codigo)} style={{...btnStyle,background:T.border,padding:"4px 10px",fontSize:10,color:T.text}}>Copiar</button>
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{...btnStyle,background:"#475569"}}>Cancelar</button>
          <button onClick={handleSave} disabled={jogosSel.size===0||totalNF===0||uploading}
            style={{...btnStyle,background:jogosSel.size>0&&totalNF>0?"#65B32E":"#475569",opacity:jogosSel.size>0&&totalNF>0&&!uploading?1:0.5}}>
            {uploading ? "Enviando..." : "Salvar NF Livemode"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RECEBIDAS (submissões do formulário externo) ────────────────────────────
function RecebidasTab({ notas, addNota, jogos, T }) {
  const [submissions, setSubmissions] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editServicos, setEditServicos] = useState({});
  const [viewTab, setViewTab] = useState("pendentes"); // "pendentes" | "historico"

  const divulgados = jogos.filter(j => j.mandante !== "A definir");

  const loadAll = () => {
    setLoading(true);
    Promise.all([getState('nf_submissions'), getState('nf_historico')]).then(([s, h]) => {
      setSubmissions(s || []);
      setHistorico(h || []);
      setLoading(false);
    });
  };

  useEffect(() => { loadAll(); }, []);

  const salvarHistorico = (next) => { setHistorico(next); setSupabaseState('nf_historico', next); };

  const startEdit = (sub) => {
    setEditingId(sub.id);
    // Copiar servicosValores para edição
    setEditServicos({...(sub.servicosValores || {})});
  };

  const toggleEditServico = (sub, subKey) => {
    setEditServicos(prev => {
      const next = {...prev};
      if (next[subKey] !== undefined) { delete next[subKey]; }
      else { next[subKey] = 0; }
      return next;
    });
  };

  const setEditValor = (subKey, val) => {
    setEditServicos(prev => ({...prev, [subKey]: parseFloat(val) || 0}));
  };

  const aprovar = (sub) => {
    const sv = editingId === sub.id ? editServicos : (sub.servicosValores || {});
    const valorNF = Object.values(sv).reduce((s, v) => s + (v || 0), 0);
    const jogo = divulgados.find(j => j.id === sub.jogoId);
    const allServicos = jogo ? extrairServicos(jogo) : [];
    const servicosKeys = Object.keys(sv).map(sk => `${sub.jogoId}_${sk}`);
    const servicosLabels = Object.keys(sv).map(sk => {
      const s = allServicos.find(x => x.subKey === sk);
      return s ? s.subLabel : sk;
    });

    const mandante = jogo?.mandante || sub.jogoLabel?.split(/\s*x\s*/)[0] || "";
    const visitante = jogo?.visitante || sub.jogoLabel?.split(/\s*x\s*/)[1] || "";
    const nota = {
      ...sub,
      servicosValores: sv,
      servicosKeys,
      servicosLabels,
      valorNF,
      tipo: "prevista",
      status: "Conferida",
      codigo: gerarCodigo(sub.rodada, mandante, visitante, valorNF, sub.numeroNF),
    };
    addNota(nota);
    salvarHistorico([...historico, {...sub, decisao:"aprovada", decidoEm: new Date().toISOString()}]);
    const next = submissions.filter(s => s.id !== sub.id);
    setSubmissions(next);
    setSupabaseState('nf_submissions', next);
    setEditingId(null);
  };

  const rejeitar = (id) => {
    if (!window.confirm("Rejeitar esta submissão?")) return;
    const sub = submissions.find(s => s.id === id);
    salvarHistorico([...historico, {...sub, decisao:"rejeitada", decidoEm: new Date().toISOString()}]);
    const next = submissions.filter(s => s.id !== id);
    setSubmissions(next);
    setSupabaseState('nf_submissions', next);
  };

  const recuperar = (item) => {
    const next = [...submissions, {...item, decisao:undefined, decidoEm:undefined}];
    setSubmissions(next);
    setSupabaseState('nf_submissions', next);
    salvarHistorico(historico.filter(h => h.id !== item.id));
  };

  const excluirDefinitivo = (id) => {
    if (!window.confirm("Excluir definitivamente do histórico?")) return;
    deleteNFFile(id);
    salvarHistorico(historico.filter(h => h.id !== id));
  };

  if (loading) return <p style={{color:T.textSm,padding:20}}>Carregando submissões...</p>;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:4}}>
          {[{k:"pendentes",l:`Pendentes (${submissions.length})`},{k:"historico",l:`Histórico (${historico.length})`}].map(t => (
            <button key={t.k} onClick={() => setViewTab(t.k)} style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
              background:viewTab===t.k?"#8b5cf6":"transparent",color:viewTab===t.k?"#fff":T.textMd}}>
              {t.l}
            </button>
          ))}
        </div>
        <button onClick={loadAll} style={{...btnStyle,background:T.border,padding:"5px 14px",fontSize:11,color:T.text}}>Atualizar</button>
      </div>
      {viewTab === "pendentes" && submissions.length === 0 && (
        <div style={{background:T.card,borderRadius:12,padding:40,textAlign:"center"}}>
          <p style={{color:T.textSm,fontSize:13,margin:0}}>Nenhuma NF recebida pelo formulário externo</p>
          <p style={{color:T.textSm,fontSize:11,margin:"8px 0 0"}}>Link do formulário: <code style={{color:"#22c55e"}}>{window.location.origin}/#formulario</code></p>
        </div>
      )}
      {viewTab === "pendentes" && submissions.map(sub => {
        const isEditing = editingId === sub.id;
        const jogo = divulgados.find(j => j.id === sub.jogoId);
        const allServicos = jogo ? extrairServicos(jogo) : [];
        const svAtual = isEditing ? editServicos : (sub.servicosValores || {});
        const valorAtual = Object.values(svAtual).reduce((s, v) => s + (v || 0), 0);

        return (
          <div key={sub.id} style={{background:T.card,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:12}}>
              <div>
                <span style={{fontWeight:700,fontSize:14,color:T.text}}>{sub.fornecedor}</span>
                <span style={{color:T.textSm,fontSize:12,marginLeft:12}}>{sub.jogoLabel} · Rd {sub.rodada}</span>
                {sub.numeroNF && <span style={{color:T.textSm,fontSize:11,marginLeft:8}}>NF {sub.numeroNF}</span>}
              </div>
              <span style={{color:"#8b5cf6",fontWeight:700,fontSize:16}}>{fmt(valorAtual)}</span>
            </div>

            {/* Serviços — modo visualização ou edição */}
            {!isEditing ? (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {Object.entries(svAtual).map(([sk, val]) => {
                  const label = allServicos.find(x => x.subKey === sk)?.subLabel || sk;
                  return <Pill key={sk} label={`${label}: ${fmt(val)}`} color="#06b6d4"/>;
                })}
              </div>
            ) : (
              <div style={{background:T.bg,borderRadius:8,padding:10,marginBottom:12}}>
                <p style={{color:T.textMd,fontSize:11,fontWeight:600,margin:"0 0 8px"}}>Editar serviços e valores:</p>
                {allServicos.map(s => {
                  const ativo = editServicos[s.subKey] !== undefined;
                  return (
                    <div key={s.subKey} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,padding:"4px 0"}}>
                      <input type="checkbox" checked={ativo} onChange={() => toggleEditServico(sub, s.subKey)}/>
                      <span style={{flex:1,fontSize:12,color:ativo?T.text:T.textSm}}>{s.subLabel}</span>
                      {ativo && (
                        <input type="number" value={editServicos[s.subKey]} onChange={e => setEditValor(s.subKey, e.target.value)}
                          style={{background:T.card,border:`1px solid ${T.muted}`,borderRadius:6,color:"#8b5cf6",padding:"4px 8px",width:90,textAlign:"right",fontSize:12,fontWeight:600}}/>
                      )}
                    </div>
                  );
                })}
                <div style={{borderTop:`1px solid ${T.border}`,marginTop:6,paddingTop:6,textAlign:"right"}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#8b5cf6"}}>Total: {fmt(valorAtual)}</span>
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:12,color:T.textSm,marginBottom:12}}>
              {sub.dataEmissao && <span>Emissão: {sub.dataEmissao}</span>}
              {sub.dataEnvio && <span>Envio: {sub.dataEnvio}</span>}
              {sub.obs && <span>Obs: {sub.obs}</span>}
              {sub.hasFile && <Pill label="Arquivo anexo" color="#22c55e"/>}
              <span style={{color:T.textSm}}>Enviado: {new Date(sub.enviadoEm).toLocaleDateString("pt-BR")}</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              {!isEditing && <button onClick={() => startEdit(sub)} style={{...btnStyle,background:"#3b82f6",padding:"6px 20px",fontSize:12}}>Editar</button>}
              {isEditing && <button onClick={() => setEditingId(null)} style={{...btnStyle,background:"#475569",padding:"6px 20px",fontSize:12}}>Cancelar</button>}
              <button onClick={() => aprovar(sub)} style={{...btnStyle,background:"#22c55e",padding:"6px 20px",fontSize:12}}>Aprovar</button>
              <button onClick={() => rejeitar(sub.id)} style={{...btnStyle,background:"#7f1d1d",padding:"6px 20px",fontSize:12}}>Rejeitar</button>
            </div>
          </div>
        );
      })}

      {/* Histórico */}
      {viewTab === "historico" && (
        <>
          {historico.length === 0 && (
            <div style={{background:T.card,borderRadius:12,padding:40,textAlign:"center"}}>
              <p style={{color:T.textSm,fontSize:13,margin:0}}>Nenhum registro no histórico</p>
            </div>
          )}
          {[...historico].reverse().map(item => (
            <div key={item.id} style={{background:T.card,borderRadius:12,padding:"14px 20px",marginBottom:10,opacity:item.decisao==="rejeitada"?0.7:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Pill label={item.decisao==="aprovada"?"Aprovada":"Rejeitada"} color={item.decisao==="aprovada"?"#22c55e":"#ef4444"}/>
                  <span style={{fontWeight:700,fontSize:13,color:T.text}}>{item.fornecedor}</span>
                  <span style={{color:T.textSm,fontSize:11}}>{item.jogoLabel} · Rd {item.rodada}</span>
                </div>
                <span style={{color:"#8b5cf6",fontWeight:700,fontSize:14}}>{fmt(item.valorNF)}</span>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {(item.servicosLabels||[]).map(s => <Pill key={s} label={s} color="#06b6d4"/>)}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11,color:T.textSm,marginBottom:10}}>
                {item.numeroNF && <span>NF {item.numeroNF}</span>}
                {item.decidoEm && <span>{item.decisao==="aprovada"?"Aprovada":"Rejeitada"} em {new Date(item.decidoEm).toLocaleDateString("pt-BR")}</span>}
                {item.enviadoEm && <span>Enviada em {new Date(item.enviadoEm).toLocaleDateString("pt-BR")}</span>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={() => recuperar(item)} style={{...btnStyle,background:"#3b82f6",padding:"5px 16px",fontSize:11}}>Recuperar</button>
                <button onClick={() => excluirDefinitivo(item.id)} style={{...btnStyle,background:"#7f1d1d",padding:"5px 16px",fontSize:11}}>Excluir</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
function InlineFornecedor({ value, onChange, fornecedores, T }) {
  const IS = iSty(T);
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value || "");
  const [focused, setFocused] = useState(false);

  // Sincroniza com o parent somente quando NÃO está focado (evita rollback do realtime)
  useEffect(() => { if (!focused) setLocal(value || ""); }, [value, focused]);

  const v = local;
  const filtered = v.length > 0
    ? fornecedores.filter(f => f.apelido.toLowerCase().includes(v.toLowerCase()) || f.funcao.toLowerCase().includes(v.toLowerCase())).slice(0, 6)
    : [];

  const commit = (val) => { setLocal(val); onChange(val); };

  return (
    <div style={{position:"relative",minWidth:120}}>
      <input value={v}
        onChange={e => { setLocal(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setTimeout(() => {
          setOpen(false);
          setFocused(false);
          if (local !== (value || "")) onChange(local); // persiste ao sair
        }, 200)}
        placeholder="—"
        style={{...IS, padding:"3px 6px", fontSize:11, width:"100%", background:"transparent", border:`1px solid transparent`, borderRadius:4}}
        onMouseEnter={e => e.currentTarget.style.borderColor = T.muted}
        onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = "transparent"; }}
      />
      {open && filtered.length > 0 && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:T.card,border:`1px solid ${T.border}`,borderRadius:6,marginTop:2,maxHeight:160,overflowY:"auto",boxShadow:"0 6px 20px rgba(0,0,0,0.3)"}}>
          {filtered.map(f => (
            <div key={f.id} onMouseDown={() => { commit(f.apelido); setOpen(false); }}
              style={{padding:"5px 8px",cursor:"pointer",borderBottom:`1px solid ${T.border}`}}
              onMouseEnter={e => e.currentTarget.style.background = T.bg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{fontSize:12,fontWeight:600,color:T.text}}>{f.apelido}</span>
              <span style={{fontSize:10,color:T.textSm,marginLeft:6}}>{f.funcao}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TabNotas({ notas, setNotas, jogos, setJogos, fornecedores = [], envios = [], setEnvios, fornecedoresJogo = {}, setFornecedoresJogo, T }) {
  const { portal } = usePortalLink('brasileirao');

  // Sincroniza fornecedoresJogo com o Portal (matriz). Converte o nome operacional do Portal
  // no apelido canônico cadastrado no Hub (quando bate por match tolerante).
  useEffect(() => {
    if (!portal || !setFornecedoresJogo) return;
    const updates = {};
    let changed = false;

    function aplicarSubKey(jogo, subKey) {
      const key = `${jogo.id}_${subKey}`;
      const opers = getOperacionaisPorSubKey(jogo.id, subKey, portal, jogo.categoria);
      if (opers.length === 0) return;
      const canonicos = opers.map(n => {
        const f = findFornecedorTolerante(fornecedores, n);
        return f ? f.apelido : n;
      });
      const portalValor = [...new Set(canonicos)].join(' / ');
      if (fornecedoresJogo[key] !== portalValor) {
        updates[key] = portalValor;
        changed = true;
      }
    }

    jogos.filter(j => j.mandante && j.mandante !== 'A definir').forEach(jogo => {
      CATS.forEach(cat => {
        cat.subs.forEach(sub => {
          if (sub.key === 'sng') return; // tratado como 2 virtuais abaixo
          aplicarSubKey(jogo, sub.key);
        });
      });
      // SNG dividido em duas linhas
      aplicarSubKey(jogo, 'sng_premiere');
      aplicarSubKey(jogo, 'sng_host');
    });
    if (changed) {
      setFornecedoresJogo(prev => ({ ...prev, ...updates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, jogos, fornecedores]);

  const [tab, setTab] = useState("rodada");
  const [rodadaSel, setRodadaSel] = useState(null);
  const [showRegistrar, setShowRegistrar] = useState(null);
  const [showAvulsa, setShowAvulsa] = useState(false);
  const [showLivemode, setShowLivemode] = useState(false);
  const [filtroPlanilha, setFiltroPlanilha] = useState("Todas");
  const [filtroFornecedor, setFiltroFornecedor] = useState("Todos");
  const [preview, setPreview] = useState(null);
  const uploadRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  const handleUploadLater = async (file, nota) => {
    if (!file || !nota) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await saveNFFile(nota.id, dataUrl);
      setNotas(ns => ns.map(n => n.id === nota.id ? {...n, hasFile: true} : n));
    } catch (e) { console.error("Upload falhou:", e); }
    setUploadTarget(null);
  };

  const divulgados = jogos.filter(j => j.mandante !== "A definir");
  const rodadas = Array.from(new Set(divulgados.map(j => j.rodada))).sort((a, b) => a - b);
  const rodadaEfetiva = rodadaSel ?? (rodadas.length ? rodadas[rodadas.length - 1] : 1);
  const jogosRodada = divulgados.filter(j => j.rodada === rodadaEfetiva);

  // Mapa de notaId → número do envio
  const envioMap = useMemo(() => {
    const map = {};
    (envios || []).forEach(e => {
      const info = { numero: e.numero, dataPagamento: e.dataPagamento };
      (e.notasIds || []).forEach(id => { map[id] = info; });
    });
    return map;
  }, [envios]);

  // Stats
  const allServicos = useMemo(() => {
    return divulgados.flatMap(jogo => {
      const servicos = extrairServicos(jogo);
      return servicos.map(s => {
        const key = `${jogo.id}_${s.subKey}`;
        const nota = notas.find(n => n.servicosKeys?.includes(key));
        return { key, rodada: jogo.rodada, status: nota ? "Conferida" : "Pendente" };
      });
    });
  }, [divulgados, notas]);

  const totalPendente  = allServicos.filter(i => i.status === "Pendente").length;
  const totalConferida = allServicos.filter(i => i.status === "Conferida").length;
  const totalNotas     = notas.length;
  const totalValor     = notas.reduce((s, n) => s + (n.valorNF || 0), 0);
  const notasAvulsas   = notas.filter(n => n.tipo === "avulsa").length;

  // Recalcula o realizado sempre que as notas mudam
  useEffect(() => {
    // Aliases: subKeys virtuais (NF) → subKey financeira (CATS)
    // SNG Host alimenta o bucket "SNG"; SNG Premiere alimenta "SNG Extra".
    const ALIAS_SUBKEY = { sng_host: 'sng', sng_premiere: 'sng_extra' };
    setJogos(js => js.map(j => {
      const realizado = {...(j.realizado || {})};
      CATS.forEach(cat => cat.subs.forEach(sub => {
        if (!SUBS_EXCLUIR.has(sub.key)) realizado[sub.key] = 0;
      }));
      // Remove subKeys virtuais que não fazem parte do CATS (vinham de runs antigos
      // antes do alias sng_host->sng / sng_premiere->sng_extra)
      delete realizado.sng_host;
      delete realizado.sng_premiere;
      // Somar valores — usa servicosDetalhe (granular por jogo) se disponível
      notas.forEach(n => {
        if (n.servicosDetalhe) {
          // Multi-jogo: pegar só as chaves deste jogo
          Object.entries(n.servicosDetalhe).forEach(([k, valor]) => {
            const [jId, ...rest] = k.split("_");
            if (parseInt(jId) === j.id) {
              const subKey = rest.join("_");
              const finalKey = ALIAS_SUBKEY[subKey] || subKey;
              realizado[finalKey] = (realizado[finalKey] || 0) + valor;
            }
          });
        } else if (n.jogoId === j.id && n.servicosValores) {
          // Formato antigo: jogoId simples
          Object.entries(n.servicosValores).forEach(([subKey, valor]) => {
            const finalKey = ALIAS_SUBKEY[subKey] || subKey;
            realizado[finalKey] = (realizado[finalKey] || 0) + valor;
          });
        }
      });
      return {...j, realizado};
    }));
  }, [notas]); // eslint-disable-line react-hooks/exhaustive-deps

  const addNota = nota => {
    setNotas(ns => [...ns, nota]);
    // Histórico append-only: registra a criação. RecebidasTab já grava
    // "aprovada" para NFs vindas do formulário; aqui usamos "registrada"
    // para diferenciar criações via "Registrar NF" e "NF Avulsa".
    const jaTemDecisao = nota.decisao === "aprovada" || nota.decisao === "rejeitada";
    if (!jaTemDecisao) {
      pushHistorico({
        ...nota,
        decisao: nota.tipo === "avulsa" ? "avulsa" : "registrada",
        decidoEm: new Date().toISOString(),
      });
    }
    setShowRegistrar(null);
    setShowAvulsa(false);
  };

  const deleteNota = id => {
    const envioComNota = envios.find(e => (e.notasIds || []).includes(id));
    const msg = envioComNota
      ? `Excluir esta NF? Ela está no Envio ${envioComNota.numero} e também será removida de lá.`
      : "Excluir esta NF?";
    if (window.confirm(msg)) {
      const nota = notas.find(n => n.id === id);
      deleteNFFile(id);
      setNotas(ns => ns.filter(n => n.id !== id));
      if (setEnvios && envioComNota) {
        setEnvios(evs => evs.map(e => {
          if (!(e.notasIds || []).includes(id)) return e;
          const notasIds = (e.notasIds || []).filter(nid => nid !== id);
          const notasResumo = (e.notasResumo || []).filter(n => n.id !== id);
          const totalJogos = notasResumo.reduce((s, n) => s + (n.valorNF || 0), 0);
          return {
            ...e,
            notasIds,
            notasResumo,
            totalJogos,
            totalGeral: totalJogos + (e.totalMensais || 0) + (e.totalLivemode || 0),
            qtdNotas: notasIds.length + (e.mensaisIds || []).length + (e.livemodeIds || []).length,
          };
        }));
      }
      if (nota) pushHistorico({ ...nota, decisao: "excluida", excluidoEm: new Date().toISOString() });
    }
  };

  const limparRodada = (rodada) => {
    const nfsRodada = notas.filter(n => n.rodada === rodada);
    if (nfsRodada.length === 0) return;
    if (!window.confirm(`Apagar todas as ${nfsRodada.length} NFs da rodada ${rodada}? Os arquivos também serão removidos.`)) return;
    const agora = new Date().toISOString();
    const idsRodada = new Set(nfsRodada.map(n => n.id));
    nfsRodada.forEach(n => {
      deleteNFFile(n.id);
      pushHistorico({ ...n, decisao: "excluida", excluidoEm: agora, motivo: `limpar_rodada_${rodada}` });
    });
    setNotas(ns => ns.filter(n => n.rodada !== rodada));
    if (setEnvios) {
      setEnvios(evs => evs.map(e => {
        const afetadas = (e.notasIds || []).filter(id => idsRodada.has(id));
        if (afetadas.length === 0) return e;
        const notasIds = (e.notasIds || []).filter(id => !idsRodada.has(id));
        const notasResumo = (e.notasResumo || []).filter(n => !idsRodada.has(n.id));
        const totalJogos = notasResumo.reduce((s, n) => s + (n.valorNF || 0), 0);
        return {
          ...e,
          notasIds,
          notasResumo,
          totalJogos,
          totalGeral: totalJogos + (e.totalMensais || 0) + (e.totalLivemode || 0),
          qtdNotas: notasIds.length + (e.mensaisIds || []).length + (e.livemodeIds || []).length,
        };
      }));
    }
  };

  // Planilha
  const planilhaRodadas = ["Todas", ...Array.from(new Set(notas.map(n => String(n.rodada)).filter(Boolean))).sort((a, b) => a - b)];
  const planilhaFornecedores = ["Todos", ...Array.from(new Set(notas.map(n => n.fornecedor).filter(Boolean))).sort()];
  const planilhaItens = notas
    .filter(n => filtroPlanilha === "Todas" || String(n.rodada) === filtroPlanilha)
    .filter(n => filtroFornecedor === "Todos" || n.fornecedor === filtroFornecedor)
    .sort((a, b) => (a.rodada || 0) - (b.rodada || 0));

  // Resumo por fornecedor (para painel na planilha)
  const resumoFornecedor = useMemo(() => {
    if (filtroFornecedor === "Todos") return null;
    const nfsForn = notas.filter(n => n.fornecedor === filtroFornecedor);
    const totalGasto = nfsForn.reduce((s, n) => s + (n.valorNF || 0), 0);
    const jogosSet = new Set(nfsForn.flatMap(n => n.jogoIds || (n.jogoId ? [n.jogoId] : [])));
    const jogosComNF = jogos.filter(j => jogosSet.has(j.id) && j.mandante !== "A definir");
    const statusMap = {};
    nfsForn.forEach(n => {
      const env = envioMap[n.id];
      const st = env ? "Enviada" : "Pendente";
      statusMap[st] = (statusMap[st] || 0) + 1;
    });
    return { total: nfsForn.length, totalGasto, jogos: jogosComNF, status: statusMap };
  }, [filtroFornecedor, notas, jogos, envioMap]);

  const copyPlanilha = () => {
    const header = "Código\tNº NF\tFornecedor\tValor\tEmissão\tEnvio\tPagamento\tJogo\tRodada\tServiços\tTipo\tObs";
    const rows = planilhaItens.map(n =>
      `${n.codigo}\t${n.numeroNF}\t${n.fornecedor}\t${n.valorNF || 0}\t${n.dataEmissao}\t${n.dataEnvio}\t${envioMap[n.id]?.dataPagamento || ""}\t${n.jogoLabel}\t${n.rodada || ""}\t${(n.servicosLabels||[]).join(", ")}\t${n.tipo||"prevista"}\t${n.obs || ""}`
    );
    navigator.clipboard.writeText([header, ...rows].join("\n"));
    alert("Planilha copiada!");
  };

  const TABS_NF = [
    {value:"rodada", label:"Por Rodada"},
    {value:"planilha", label:"Planilha"},
    {value:"resumo", label:"Resumo"},
    {value:"recebidas", label:"Recebidas"},
  ];
  const TS = tableStyles(T);
  const purple = "#a855f7";
  const cyan = "#06b6d4";

  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <Segmented T={T} value={tab} onChange={setTab} options={TABS_NF}/>
        <div style={{display:"flex",gap:8}}>
          <Button T={T} variant="secondary" size="md" icon={FileText} onClick={()=>setShowLivemode(true)}>NF Livemode</Button>
          <Button T={T} variant="primary" size="md" icon={Plus} onClick={()=>setShowAvulsa(true)}>NF Avulsa</Button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,marginBottom:24}}>
        <KPI label="Serviços Pendentes" value={String(totalPendente)} sub="Sem NF" color={T.warning} T={T}/>
        <KPI label="Serviços Conferidos" value={String(totalConferida)} sub="Com NF" color={T.brand} T={T}/>
        <KPI label="Notas Registradas" value={`${totalNotas}`} sub={`${notasAvulsas} avulsa${notasAvulsas!==1?"s":""}`} color={purple} T={T}/>
        <KPI label="Valor Total NFs" value={fmt(totalValor)} sub={`${totalNotas} notas`} color={cyan} T={T}/>
      </div>

      {/* ── POR RODADA ── */}
      {tab === "rodada" && (<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{color:T.textSm,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Rodada</span>
            {rodadas.map(r => (
              <Chip key={r} active={rodadaEfetiva===r} onClick={()=>setRodadaSel(r)} T={T} color={purple}>{r}</Chip>
            ))}
          </div>
          <Button T={T} variant="primary" size="md" icon={Plus} onClick={()=>setShowRegistrar(true)}>Registrar NF (Rd {rodadaEfetiva})</Button>
        </div>

        {jogosRodada.map(jogo => {
          // Base: serviços com provisionado > 0
          const baseServicos = extrairServicos(jogo);
          const baseKeys = new Set(baseServicos.map(s => s.subKey));
          // Extras: serviços onde o Portal tem fornecedor (mesmo sem provisionado).
          // Valor de referência fica 0 — preenche depois quando a NF chegar.
          const portalExtras = [];
          // Mantém todas as linhas UM com provisionado > 0 (a categoria pode ter mudado entre orcamento e execução)
          let baseFinal = baseServicos;
          // Marca se já há alguma linha de UM no base — para não duplicar via Portal extras
          const baseTemUM = baseServicos.some(s => /^um_b/.test(s.subKey));
          if (portal) {
            const opCat = CATS.find(c => c.key === 'operacoes') || CATS[0];
            // SNG: separa em Host (bucket sng) + Premiere (bucket sng_extra)
            const sngP = getOperacionaisPorSubKey(jogo.id, 'sng_premiere', portal);
            const sngH = getOperacionaisPorSubKey(jogo.id, 'sng_host', portal);
            if (sngP.length || sngH.length) {
              baseFinal = baseServicos.filter(s => s.subKey !== 'sng' && s.subKey !== 'sng_extra');
              if (sngH.length) portalExtras.push({ subKey: 'sng_host', subLabel: 'SNG Host', catLabel: opCat.label, catColor: opCat.color, valorRef: jogo.provisionado?.sng || 0, fromPortal: true });
              if (sngP.length) portalExtras.push({ subKey: 'sng_premiere', subLabel: 'SNG Premiere', catLabel: opCat.label, catColor: opCat.color, valorRef: jogo.provisionado?.sng_extra || 0, fromPortal: true });
            }
            CATS.forEach(cat => {
              cat.subs.forEach(sub => {
                if (sub.key === 'sng') return;
                if (baseKeys.has(sub.key)) return;
                if (SUBS_EXCLUIR.has(sub.key)) return;
                // Se base já tem alguma linha UM (provisionado), não duplica via Portal
                if (/^um_b/.test(sub.key) && baseTemUM) return;
                const opers = getOperacionaisPorSubKey(jogo.id, sub.key, portal, jogo.categoria);
                if (opers.length > 0) {
                  portalExtras.push({
                    subKey: sub.key, subLabel: sub.label,
                    catLabel: cat.label, catColor: cat.color,
                    valorRef: 0, fromPortal: true,
                  });
                }
              });
            });
          }
          const servicos = [...baseFinal, ...portalExtras];
          const nfsDoJogo = notas.filter(n =>
            n.servicosKeys?.some(k => k.startsWith(`${jogo.id}_`))
            || (n.tipo === "avulsa" && n.jogoId === jogo.id)
            || (n.tipo === "reembolso_livemode" && (n.jogoIds || []).includes(jogo.id))
          );
          const servicosComNF = new Set(nfsDoJogo.flatMap(n => n.servicosKeys || []));
          const pendentes = servicos.filter(s => !servicosComNF.has(`${jogo.id}_${s.subKey}`)).length;
          const conferidas = servicos.filter(s => servicosComNF.has(`${jogo.id}_${s.subKey}`)).length;
          const accentJogo = jogo.categoria==="B1"?T.brand:T.warning;

          return (
            <Card key={jogo.id} T={T} style={{marginBottom:16}} accent={accentJogo}>
              <div style={{padding:"14px 20px",background:T.surfaceAlt||T.bg,borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <Pill label={jogo.categoria} color={accentJogo}/>
                  <span style={{fontWeight:700,fontSize:14,color:T.text,letterSpacing:"-0.005em"}}>{jogo.mandante} × {jogo.visitante}</span>
                  <span style={{color:T.textSm,fontSize:11}}>
                    <span className="num">{jogo.data}</span>
                    <span style={{margin:"0 6px",color:T.border}}>·</span>
                    {jogo.cidade}
                  </span>
                </div>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{color:T.warning,fontSize:11,fontWeight:700,background:T.warning+"1f",padding:"3px 10px",borderRadius:RADIUS.pill,border:`1px solid ${T.warning}33`}}>{pendentes} pendente{pendentes!==1?"s":""}</span>
                  <span className="num" style={{color:T.brand,fontSize:11,fontWeight:700,background:T.brand+"1f",padding:"3px 10px",borderRadius:RADIUS.pill,border:`1px solid ${T.brand}33`}}>{conferidas}/{servicos.length}</span>
                </div>
              </div>

              <div style={TS.wrap}>
                <table style={{...TS.table, minWidth:600}}>
                  <thead><tr style={TS.thead}>
                    {["Serviço","Categoria","Fornecedor Resp.","Valor Ref.","Valor NF","Status","NF Vinculada"].map(h =>
                      <th key={h} style={{...TS.th, ...TS.thLeft}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {servicos.map(s => {
                      const key = `${jogo.id}_${s.subKey}`;
                      const isMulti = SUBS_MULTI_NF.has(s.subKey);
                      const notasDestaLinha = nfsDoJogo.filter(n => n.servicosKeys?.includes(key));
                      const valorUnit = notasDestaLinha.reduce((sum, n) => {
                        if (n.servicosDetalhe && n.servicosDetalhe[key] != null) return sum + n.servicosDetalhe[key];
                        if (n.servicosValores?.[s.subKey] != null) return sum + n.servicosValores[s.subKey];
                        return sum;
                      }, 0);
                      const hasNotas = notasDestaLinha.length > 0;
                      const diff = hasNotas ? valorUnit - s.valorRef : null;
                      const restante = s.valorRef - valorUnit;
                      const statusLabel = !hasNotas ? "Pendente" : (isMulti && restante > 0.01 ? "Parcial" : "Conferida");
                      const statusColor = !hasNotas ? T.warning : (statusLabel === "Parcial" ? T.info : T.brand);
                      const nota = notasDestaLinha[0];
                      return (
                        <tr key={s.subKey} style={TS.tr}>
                          <td style={{...TS.td, fontWeight:600}}>{s.subLabel}</td>
                          <td style={TS.td}><Pill label={s.catLabel} color={s.catColor}/></td>
                          <td style={TS.td}>
                            <InlineFornecedor
                              value={fornecedoresJogo[`${jogo.id}_${s.subKey}`] || ""}
                              onChange={v => setFornecedoresJogo(prev => ({...prev, [`${jogo.id}_${s.subKey}`]: v}))}
                              fornecedores={fornecedores}
                              T={T}
                            />
                          </td>
                          <td className="num" style={{...TS.td, color:T.textSm, fontSize:12}}>{fmt(s.valorRef)}</td>
                          <td style={{...TS.td, fontSize:12}}>
                            {hasNotas ? (
                              <span style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                <span className="num" style={{color:purple,fontWeight:700}}>{fmt(valorUnit)}</span>
                                {diff !== 0 && <span className="num" style={{fontSize:10,color:diff>0?T.danger:(isMulti?T.info:T.brand),fontWeight:600}}>{diff>0?"+":""}{fmt(diff)}</span>}
                                {isMulti && notasDestaLinha.length > 1 && <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:T.info+"22",color:T.info,fontWeight:700}}>{notasDestaLinha.length} NFs</span>}
                              </span>
                            ) : <span style={{color:T.textSm}}>—</span>}
                          </td>
                          <td style={TS.td}>
                            <Pill label={statusLabel} color={statusColor}/>
                          </td>
                          <td style={{...TS.td, fontSize:11}}>
                            {!hasNotas ? <span style={{color:T.textSm}}>—</span>
                              : notasDestaLinha.length > 1 ? (
                                <span style={{color:T.textSm,fontSize:11}}>
                                  {notasDestaLinha.map(n => n.fornecedor).filter(Boolean).join(", ")}
                                </span>
                              ) : (
                                <span style={{color:T.text,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                  <code className="num" style={{color:T.brand,fontSize:11,background:T.brand+"15",padding:"2px 6px",borderRadius:4}}>{nota.codigo}</code>
                                  <span style={{color:T.textMd}}>{nota.fornecedor}</span>
                                  {envioMap[nota.id] && <Pill label={`Envio ${envioMap[nota.id].numero}`} color={purple}/>}
                                  {nota.hasFile
                                    ? <Button T={T} variant="secondary" size="sm" icon={Eye} onClick={()=>setPreview(nota)}/>
                                    : <Button T={T} variant="secondary" size="sm" icon={Upload} onClick={()=>{setUploadTarget(nota); uploadRef.current?.click();}}/>}
                                  <Button T={T} variant="danger" size="sm" icon={Trash2} onClick={()=>deleteNota(nota.id)}/>
                                </span>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {nfsDoJogo.filter(n => n.tipo === "avulsa" || n.tipo === "reembolso_livemode").length > 0 && (
                <div style={{padding:"10px 16px",borderTop:`1px solid ${T.border}`,background:T.surfaceAlt||T.bg}}>
                  <p style={{color:T.warning,fontSize:10,fontWeight:700,margin:"0 0 6px",letterSpacing:"0.06em",textTransform:"uppercase"}}>NFs Avulsas neste jogo</p>
                  {nfsDoJogo.filter(n => n.tipo === "avulsa" || n.tipo === "reembolso_livemode").map(n => {
                    const descricao = n.descricao || (n.servicosLabels || [])[0] || "Avulsa";
                    const isReembolso = n.tipo === "reembolso_livemode";
                    const valorExibido = isReembolso
                      ? (n.servicosDetalhe?.[`${jogo.id}_reembolso_log`] || 0)
                      : n.valorNF;
                    return (
                      <div key={n.id} style={{display:"flex",gap:12,alignItems:"center",fontSize:12,padding:"4px 0",flexWrap:"wrap"}}>
                        <code className="num" style={{color:T.brand,fontSize:11,background:T.brand+"15",padding:"2px 6px",borderRadius:4}}>{n.codigo}</code>
                        <span style={{color:T.text,fontWeight:600}}>{n.fornecedor}</span>
                        <Pill label={descricao} color={isReembolso?"#65B32E":T.warning}/>
                        <span className="num" style={{color:purple,fontWeight:700}}>{fmt(valorExibido)}</span>
                        {isReembolso && <span style={{fontSize:10,color:T.textSm}}>({fmt(n.valorNF)} total)</span>}
                        {n.numeroNF && <span style={{color:T.textSm,fontSize:11}}>NF {n.numeroNF}</span>}
                        {n.dataEmissao && <span style={{color:T.textSm,fontSize:11}}>Emissão {n.dataEmissao}</span>}
                        <span style={{marginLeft:"auto",display:"flex",gap:4}}>
                          {n.hasFile
                            ? <Button T={T} variant="secondary" size="sm" icon={Eye} onClick={()=>setPreview(n)}/>
                            : <Button T={T} variant="secondary" size="sm" icon={Upload} onClick={()=>{setUploadTarget(n); uploadRef.current?.click();}}/>}
                          <Button T={T} variant="danger" size="sm" icon={Trash2} onClick={()=>deleteNota(n.id)}/>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </>)}

      {/* ── PLANILHA ── */}
      {tab === "planilha" && (<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{color:T.textSm,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Rodada</span>
            {planilhaRodadas.map(r => (
              <Chip key={r} active={filtroPlanilha===r} onClick={()=>setFiltroPlanilha(r)} T={T} color={purple}>
                {r === "Todas" ? "Todas" : `Rd ${r}`}
              </Chip>
            ))}
          </div>
          <Button T={T} variant="primary" size="md" icon={CopyIcon} onClick={copyPlanilha}>Copiar Planilha</Button>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:18}}>
          <span style={{color:T.textSm,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Fornecedor</span>
          <select value={filtroFornecedor} onChange={e => setFiltroFornecedor(e.target.value)}
            style={{background:T.card,border:`1px solid ${T.muted}`,borderRadius:6,color:T.text,padding:"5px 10px",fontSize:12,cursor:"pointer",maxWidth:220}}>
            {planilhaFornecedores.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          {filtroFornecedor !== "Todos" && (
            <Chip active={false} onClick={()=>setFiltroFornecedor("Todos")} T={T} color={T.danger}>✕ Limpar</Chip>
          )}
        </div>

        {resumoFornecedor && (
          <Card T={T} style={{marginBottom:16}} accent={purple}>
            <div style={{padding:"16px 22px"}}>
              <p style={{color:T.textSm,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",margin:"0 0 10px"}}>Resumo — {filtroFornecedor}</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:12}}>
                <div>
                  <p style={{color:T.textSm,fontSize:10,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>Total gasto</p>
                  <p className="num" style={{color:purple,fontSize:18,fontWeight:800,margin:0}}>{fmt(resumoFornecedor.totalGasto)}</p>
                </div>
                <div>
                  <p style={{color:T.textSm,fontSize:10,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>Notas</p>
                  <p className="num" style={{color:T.text,fontSize:18,fontWeight:800,margin:0}}>{resumoFornecedor.total}</p>
                </div>
                <div>
                  <p style={{color:T.textSm,fontSize:10,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>Status</p>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:2}}>
                    {Object.entries(resumoFornecedor.status).map(([st, qt]) => (
                      <Pill key={st} label={`${st}: ${qt}`} color={st==="Enviada"?T.brand:T.warning}/>
                    ))}
                  </div>
                </div>
              </div>
              {resumoFornecedor.jogos.length > 0 && (
                <div>
                  <p style={{color:T.textSm,fontSize:10,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>Jogos com notas deste fornecedor</p>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {resumoFornecedor.jogos.map(j => (
                      <Pill key={j.id} label={`Rd${j.rodada} ${abreviar(j.mandante)}x${abreviar(j.visitante)}`} color={T.info}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card T={T}>
          <PanelTitle T={T} title="Planilha de Notas" subtitle={`${planilhaItens.length} notas`}
            right={<span style={{fontSize:12,color:T.textMd}}>Total: <b className="num" style={{color:purple}}>{fmt(planilhaItens.reduce((s, n) => s + (n.valorNF || 0), 0))}</b></span>}
          />
          <div style={TS.wrap}>
            <table style={{...TS.table, minWidth:1050}}>
              <thead>
                <tr style={TS.thead}>
                  {["Código","Nº NF","Fornecedor","Valor","Emissão","Envio","Pagamento","Jogo","Rd","Serviços","Tipo",""].map(h =>
                    <th key={h} style={{...TS.th, ...(h==="Valor"?TS.thRight:TS.thLeft)}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {planilhaItens.map(n => (
                  <tr key={n.id} style={TS.tr}>
                    <td style={TS.td}><code className="num" style={{color:T.brand,fontSize:11,background:T.brand+"15",padding:"3px 7px",borderRadius:4,fontWeight:600}}>{n.codigo}</code></td>
                    <td className="num" style={{...TS.td, fontWeight:600}}>{n.numeroNF}</td>
                    <td style={TS.td}>{n.fornecedor}</td>
                    <td className="num" style={{...TS.tdNum, color:purple, fontWeight:700}}>{fmt(n.valorNF || 0)}</td>
                    <td className="num" style={{...TS.td, color:T.textMd, fontSize:12}}>{n.dataEmissao}</td>
                    <td className="num" style={{...TS.td, color:T.textMd, fontSize:12}}>{n.dataEnvio}</td>
                    <td className="num" style={{...TS.td, color:T.textMd, fontSize:12}}>{envioMap[n.id]?.dataPagamento || "—"}</td>
                    <td style={{...TS.td, fontSize:12, whiteSpace:"nowrap"}}>{n.jogoLabel}</td>
                    <td className="num" style={{...TS.td, color:T.textMd, fontSize:12}}>{n.rodada}</td>
                    <td style={{...TS.td, color:T.textSm, fontSize:11, maxWidth:200}}>{(n.servicosLabels||[]).join(", ")}</td>
                    <td style={TS.td}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        <Pill label={n.tipo==="avulsa"?"Avulsa":"Prevista"} color={n.tipo==="avulsa"?T.warning:T.brand}/>
                        {envioMap[n.id] && <Pill label={`Envio ${envioMap[n.id].numero}`} color={purple}/>}
                      </div>
                    </td>
                    <td style={TS.td}>
                      <div style={{display:"flex",gap:4}}>
                        {n.hasFile
                          ? <Button T={T} variant="secondary" size="sm" icon={Eye} onClick={()=>setPreview(n)}/>
                          : <Button T={T} variant="secondary" size="sm" icon={Upload} onClick={()=>{setUploadTarget(n); uploadRef.current?.click();}}/>}
                        <Button T={T} variant="danger" size="sm" icon={Trash2} onClick={()=>deleteNota(n.id)}/>
                      </div>
                    </td>
                  </tr>
                ))}
                {planilhaItens.length === 0 && (
                  <tr><td colSpan={12} style={{padding:40,textAlign:"center",color:T.textSm}}>Nenhuma nota registrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </>)}

      {/* ── RESUMO ── */}
      {tab === "resumo" && (
        <Card T={T}>
          <PanelTitle T={T} title="Status por Rodada" subtitle="Progresso de notas conferidas vs pendentes"/>
          <div style={TS.wrap}>
            <table style={{...TS.table, minWidth:680}}>
              <thead>
                <tr style={TS.thead}>
                  {["Rodada","Serviços","Pendente","Conferida","NFs","Valor NFs","% Concluído"].map(h =>
                    <th key={h} style={{...TS.th, ...(h==="Rodada"?TS.thLeft:TS.thRight)}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rodadas.map(rod => {
                  const rodServicos = allServicos.filter(i => i.rodada === rod);
                  const tot = rodServicos.length;
                  const pend = rodServicos.filter(i => i.status === "Pendente").length;
                  const conf = rodServicos.filter(i => i.status === "Conferida").length;
                  const rodNotas = notas.filter(n => n.rodada === rod);
                  const rodValor = rodNotas.reduce((s, n) => s + (n.valorNF || 0), 0);
                  const pct = tot ? (conf / tot * 100) : 0;
                  return (
                    <tr key={rod} style={TS.tr}>
                      <td style={{...TS.td, fontWeight:600}}>Rodada {rod}</td>
                      <td className="num" style={TS.tdNum}>{tot}</td>
                      <td className="num" style={{...TS.tdNum, color:pend>0?T.warning:T.textSm}}>{pend}</td>
                      <td className="num" style={{...TS.tdNum, color:conf>0?T.brand:T.textSm}}>{conf}</td>
                      <td className="num" style={TS.tdNum}>{rodNotas.length}</td>
                      <td className="num" style={{...TS.tdNum, color:purple, fontWeight:700}}>{fmt(rodValor)}</td>
                      <td style={{padding:"13px 16px", textAlign:"right"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,justifyContent:"flex-end"}}>
                          <span className="num" style={{color:T.textMd,fontSize:12,minWidth:32}}>{pct.toFixed(0)}%</span>
                          <div style={{width:80}}><Progress value={pct} T={T}/></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── RECEBIDAS (do formulário externo) ── */}
      {tab === "recebidas" && (
        <RecebidasTab notas={notas} addNota={addNota} jogos={jogos} T={T}/>
      )}

      {showRegistrar && <RegistrarNFModal jogosRodada={jogosRodada} notasExistentes={notas} fornecedores={fornecedores} onSave={addNota} onClose={() => setShowRegistrar(null)} T={T} portal={portal}/>}
      {showAvulsa && <NFAvulsaModal jogos={jogos} fornecedores={fornecedores} onSave={addNota} onClose={() => setShowAvulsa(false)} T={T}/>}
      {showLivemode && <NFLivemodeModal jogos={jogos} fornecedores={fornecedores} onSave={addNota} onClose={() => setShowLivemode(false)} T={T}/>}
      {preview && <PreviewModal nota={preview} onClose={() => setPreview(null)} T={T}/>}
      <input ref={uploadRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" style={{display:"none"}}
        onChange={e => {if (e.target.files[0] && uploadTarget) handleUploadLater(e.target.files[0], uploadTarget); e.target.value="";}}/>
    </>
  );
}
