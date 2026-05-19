import { useState, useRef, useEffect, useMemo } from "react";
import { KPI, Pill } from "../shared";
import { fmt } from "../../utils";
import { btnStyle, iSty, RADIUS } from "../../constants";
import { fileToDataUrl, saveNFFile, getNFFile, deleteNFFile, getState, setState as setSupabaseState } from "../../lib/supabase";
import { Card, PanelTitle, Button, Chip, Progress, tableStyles } from "../ui";
import { Plus, Eye, Trash2, Upload, X, Download, FileText, Edit2, Check, AlertTriangle } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const VAR_CATEGORIAS = ["Transporte","Uber","Hospedagem","Seg. Espacial"];
const CATEGORIAS_MENSAL = [...VAR_CATEGORIAS, "Outro"];
const STATUS_COLOR = {"Pendente":"#f59e0b","Recebida":"#8b5cf6","Conferida":"#22c55e"};

function FornecedorInput({ value, onChange, fornecedores, T }) {
  const IS = iSty(T);
  const [open, setOpen] = useState(false);
  const query = value.toLowerCase();
  const filtered = query.length > 0
    ? fornecedores.filter(f => f.apelido.toLowerCase().includes(query) || f.razaoSocial.toLowerCase().includes(query) || f.funcao.toLowerCase().includes(query)).slice(0, 8)
    : [];

  return (
    <div style={{position:"relative"}}>
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
              <span style={{fontSize:11,color:T.textSm}}>{f.funcao}</span>
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
    setLoading(true); setSrc(null);
    getNFFile(nota.id).then(data => { setSrc(data); setLoading(false); }).catch(() => setLoading(false));
  }, [nota?.id]);

  if (!nota) return null;
  const isPdf = src?.startsWith('data:application/pdf');

  return (
    <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:200,display:"flex",flexDirection:"column"}} onClick={onClose}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",flexShrink:0}} onClick={e => e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{color:"#fff",fontSize:13,fontWeight:700}}>{nota.fornecedor}</span>
          <span style={{color:"#8b5cf6",fontWeight:600,fontSize:13}}>{fmt(nota.valor)}</span>
          <span style={{color:"#94a3b8",fontSize:12}}>{nota.categoria} · {nota.mesLabel}</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          {src && <a href={src} download={`${nota.fornecedor}_${nota.mesLabel}`} style={{...btnStyle,background:"#3b82f6",padding:"6px 14px",fontSize:12,textDecoration:"none"}}>Download</a>}
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
            <img src={src} alt={nota.fornecedor} style={{maxWidth:"100%",maxHeight:"100%",borderRadius:12,objectFit:"contain"}}/>
          </div>
        )}
      </div>
    </div>
  );
}

function NovaNotaMensalModal({ fornecedores, servicos, notasExistentes, onSave, onClose, T }) {
  const IS = iSty(T);
  const mesAtual = new Date().getMonth();
  const [form, setForm] = useState({
    fornecedor: "", categoriaSel: "var::Transporte", mes: mesAtual, numeroNF: "",
    valor: 0, dataEmissao: "", dataEnvio: "", descricao: "", obs: "",
  });
  const [arquivo, setArquivo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  // Saldo do serviço selecionado (se for fixo)
  const isFixo = form.categoriaSel.startsWith("fixo::");
  const servicoIdSel = isFixo ? parseInt(form.categoriaSel.split("::")[1]) : null;
  const servicoSel = servicoIdSel ? (servicos||[]).flatMap(s => s.itens).find(i => i.id === servicoIdSel) : null;
  const gastoServico = servicoSel
    ? (notasExistentes||[]).filter(n => n.servicoId === servicoSel.id).reduce((s, n) => s + (n.valor||0), 0)
    : 0;
  const saldoServico = servicoSel ? (servicoSel.provisionado||0) - gastoServico : 0;
  const valorAtual = parseFloat(form.valor) || 0;
  const saldoAposNota = saldoServico - valorAtual;

  const handleSave = async () => {
    if (!form.fornecedor) return;
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
    let categoria, servicoId = null;
    if (isFixo && servicoSel) {
      categoria = servicoSel.nome;
      servicoId = servicoSel.id;
    } else {
      categoria = form.categoriaSel.replace(/^var::/, "");
    }
    const { categoriaSel, ...rest } = form;
    onSave({
      id: notaId,
      ...rest,
      categoria,
      servicoId,
      valor: parseFloat(form.valor) || 0,
      mes: parseInt(form.mes),
      mesLabel: MESES[parseInt(form.mes)],
      status: "Conferida",
      hasFile,
    });
    setUploading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:T.card,borderRadius:16,padding:28,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto"}}>
        <h3 style={{margin:"0 0 20px",fontSize:16,color:T.text}}>Nova Nota Fiscal Mensal</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Fornecedor</label>
            <FornecedorInput value={form.fornecedor} onChange={v => set("fornecedor", v)} fornecedores={fornecedores} T={T}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Categoria</label>
            <select value={form.categoriaSel} onChange={e => set("categoriaSel", e.target.value)} style={IS}>
              <optgroup label="Variáveis Mensais">
                {VAR_CATEGORIAS.map(c => <option key={c} value={`var::${c}`}>{c}</option>)}
              </optgroup>
              {(servicos||[]).map(sec => (
                <optgroup key={sec.secao} label={`Serviços Fixos · ${sec.secao}`}>
                  {sec.itens.map(it => <option key={it.id} value={`fixo::${it.id}`}>{it.nome}</option>)}
                </optgroup>
              ))}
              <optgroup label="Outros">
                <option value="var::Outro">Outro</option>
              </optgroup>
            </select>
            {servicoSel && (
              <div style={{marginTop:6,padding:"6px 10px",background:T.bg,borderRadius:6,fontSize:11,display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                <span style={{color:T.textSm}}>Provisionado: <b style={{color:"#3b82f6"}}>{fmt(servicoSel.provisionado||0)}</b></span>
                <span style={{color:T.textSm}}>Já gasto: <b style={{color:"#f59e0b"}}>{fmt(gastoServico)}</b></span>
                <span style={{color:T.textSm}}>Saldo: <b style={{color:saldoServico>=0?"#22c55e":"#ef4444"}}>{fmt(saldoServico)}</b></span>
                {valorAtual > 0 && (
                  <span style={{color:T.textSm}}>Após esta NF: <b style={{color:saldoAposNota>=0?"#22c55e":"#ef4444"}}>{fmt(saldoAposNota)}</b></span>
                )}
              </div>
            )}
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Mês de referência</label>
            <select value={form.mes} onChange={e => set("mes", e.target.value)} style={IS}>
              {MESES.map((m,i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Nº da Nota</label>
            <input value={form.numeroNF} onChange={e => set("numeroNF", e.target.value)} style={IS}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Valor (R$)</label>
            <input type="number" value={form.valor} onChange={e => set("valor", e.target.value)} style={IS}/>
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
          <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Descrição</label>
          <input value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Ex: Transporte Janeiro, Uber Fevereiro..." style={IS}/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{color:T.textMd,fontSize:12,display:"block",marginBottom:4}}>Observações</label>
          <input value={form.obs} onChange={e => set("obs", e.target.value)} style={IS}/>
        </div>
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
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{...btnStyle,background:"#475569"}}>Cancelar</button>
          <button onClick={handleSave} disabled={uploading} style={{...btnStyle,background:"#06b6d4",opacity:uploading?0.5:1}}>
            {uploading ? "Enviando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TabNotasMensal({ notas, setNotas, fornecedores = [], servicos = [], T }) {
  const [mesSel, setMesSel] = useState(new Date().getMonth());
  const [filtroCat, setFiltroCat] = useState("Todas");
  const [showNova, setShowNova] = useState(false);
  const [preview, setPreview] = useState(null);
  const uploadRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingNF, setEditingNF] = useState("");

  const mesesComNotas = Array.from(new Set(notas.map(n => n.mes))).sort((a, b) => a - b);
  const mesesExibir = Array.from(new Set([...mesesComNotas, mesSel])).sort((a, b) => a - b);

  const filtered = notas.filter(n =>
    n.mes === mesSel &&
    (filtroCat === "Todas" || n.categoria === filtroCat)
  );

  const totalValor = filtered.reduce((s, n) => s + (n.valor || 0), 0);
  const totalGeral = notas.reduce((s, n) => s + (n.valor || 0), 0);

  // Histórico append-only para notas mensais (espelha o de TabNotas).
  // Permite recuperar a lista se for zerada por bug ou ação manual.
  const pushHistoricoMensal = async (entry) => {
    const atual = (await getState('nf_historico_mensal')) || [];
    await setSupabaseState('nf_historico_mensal', [...atual, entry]);
  };

  const addNota = n => {
    setNotas(ns => [...ns, n]);
    pushHistoricoMensal({ ...n, decisao: "registrada", decidoEm: new Date().toISOString() });
    setShowNova(false);
  };

  const deleteNota = id => {
    if (window.confirm("Excluir esta nota?")) {
      const nota = notas.find(n => n.id === id);
      deleteNFFile(id);
      setNotas(ns => ns.filter(n => n.id !== id));
      if (nota) pushHistoricoMensal({ ...nota, decisao: "excluida", excluidoEm: new Date().toISOString() });
    }
  };

  const startEdit = n => { setEditingId(n.id); setEditingNF(n.numeroNF || ""); };
  const cancelEdit = () => { setEditingId(null); setEditingNF(""); };
  const saveEditNF = id => {
    setNotas(ns => ns.map(n => n.id === id ? { ...n, numeroNF: editingNF.trim() } : n));
    setEditingId(null);
    setEditingNF("");
  };

  const handleUploadLater = async (file, nota) => {
    if (!file || !nota) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await saveNFFile(nota.id, dataUrl);
      setNotas(ns => ns.map(n => n.id === nota.id ? {...n, hasFile: true} : n));
    } catch(_){}
    setUploadTarget(null);
  };

  // Resumo por categoria no mês — categorias dinâmicas a partir das notas
  const todasCategoriasMes = Array.from(new Set(filtered.map(n => n.categoria).filter(Boolean)));
  const resumoCat = todasCategoriasMes.map(cat => {
    const ns = filtered.filter(n => n.categoria === cat);
    return { cat, qtd: ns.length, valor: ns.reduce((s, n) => s + (n.valor || 0), 0) };
  });

  // Saldo provisionado por serviço fixo (considera TODAS as notas, não só do mês)
  const saldosFixos = servicos.flatMap(sec =>
    sec.itens.map(it => {
      const gasto = notas.filter(n => n.servicoId === it.id).reduce((s, n) => s + (n.valor || 0), 0);
      const prov = it.provisionado || 0;
      return { secao: sec.secao, id: it.id, nome: it.nome, prov, gasto, saldo: prov - gasto };
    })
  );
  const fixosComMov = saldosFixos.filter(s => s.prov > 0 || s.gasto > 0);

  // Categorias para o filtro: variáveis + qualquer nome de fixo presente nas notas
  const fixosNomes = Array.from(new Set(notas.filter(n => n.servicoId).map(n => n.categoria)));
  const filtroCategorias = ["Todas", ...VAR_CATEGORIAS, ...fixosNomes, "Outro"];

  // Serviços fixos ativos esperados no mês selecionado que ainda não têm NF lançada
  const servicosSemNF = useMemo(() => servicos.flatMap(sec =>
    sec.itens
      .filter(it => {
        if (it.status === "encerrado") return false;
        if (it.tipo === "pontual" || it.tipo === "misto") return it.meses?.[mesSel] === true;
        return true; // linear: presente em todos os meses
      })
      .filter(it => !notas.some(n => n.servicoId === it.id && n.mes === mesSel))
      .map(it => ({ id: it.id, nome: it.nome, secao: sec.secao }))
  ), [servicos, notas, mesSel]);

  const TS = tableStyles(T);
  const cyan = "#06b6d4";

  return (
    <>
      {servicosSemNF.length > 0 && (
        <div style={{
          background:"rgba(217,119,6,0.08)",
          border:"1px solid #d97706",
          borderRadius:RADIUS.lg,
          padding:"14px 18px",
          marginBottom:20,
          display:"flex",
          alignItems:"flex-start",
          gap:12,
        }}>
          <AlertTriangle size={18} color="#f59e0b" style={{flexShrink:0,marginTop:1}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"#f59e0b",marginBottom:8}}>
              {servicosSemNF.length} serviço{servicosSemNF.length > 1 ? "s" : ""} sem NF em {MESES[mesSel]}
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {servicosSemNF.map(s => (
                <span key={s.id} style={{
                  background:"rgba(217,119,6,0.12)",
                  border:"1px solid rgba(217,119,6,0.4)",
                  borderRadius:6,
                  padding:"3px 10px",
                  fontSize:11,
                  fontWeight:600,
                  color:"#fbbf24",
                }}>
                  {s.nome}
                  <span style={{color:"#d97706",marginLeft:5,fontWeight:400}}>· {s.secao}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,marginBottom:24}}>
        <KPI label={`Total ${MESES[mesSel]}`} value={fmt(totalValor)} sub={`${filtered.length} notas`} color={cyan} T={T}/>
        <KPI label="Total Geral" value={fmt(totalGeral)} sub={`${notas.length} notas (todos os meses)`} color="#a855f7" T={T}/>
        <KPI label="Categorias no mês" value={String(resumoCat.length)} sub={resumoCat.map(r => r.cat).join(", ") || "—"} color={T.brand} T={T}/>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:T.textSm,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Mês</span>
          <select value={mesSel} onChange={e => setMesSel(parseInt(e.target.value))}
            style={{background:T.surface||T.card,border:`1px solid ${T.border}`,borderRadius:RADIUS.md,color:T.text,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <div style={{width:1,height:24,background:T.border}}/>
          {filtroCategorias.map(c => (
            <Chip key={c} active={filtroCat===c} onClick={()=>setFiltroCat(c)} T={T} color={cyan}>{c}</Chip>
          ))}
        </div>
        <Button T={T} variant="primary" size="md" icon={Plus} onClick={()=>setShowNova(true)}>Nova NF Mensal</Button>
      </div>

      {resumoCat.length > 0 && (
        <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
          {resumoCat.map(r => (
            <div key={r.cat} style={{
              background:T.surface||T.card,
              border:`1px solid ${T.border}`,
              borderRadius:RADIUS.md,
              padding:"10px 16px",
              display:"flex",
              gap:14,
              alignItems:"center",
              boxShadow:T.shadowSoft,
            }}>
              <span style={{color:T.text,fontSize:12,fontWeight:600}}>{r.cat}</span>
              <span className="num" style={{color:cyan,fontSize:13,fontWeight:700}}>{fmt(r.valor)}</span>
              <span style={{color:T.textSm,fontSize:11}}>{r.qtd} NF{r.qtd>1?"s":""}</span>
            </div>
          ))}
        </div>
      )}

      {fixosComMov.length > 0 && (
        <Card T={T} style={{marginBottom:20}}>
          <PanelTitle T={T} title="Saldo Provisionado · Serviços Fixos" subtitle="Atualizado a cada NF lançada"/>
          <div style={{padding:"18px 20px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {fixosComMov.map(s => {
                const pct = s.prov > 0 ? Math.min(100, (s.gasto / s.prov) * 100) : 0;
                const cor = s.saldo < 0 ? T.danger : pct > 90 ? T.warning : T.brand;
                return (
                  <div key={s.id} style={{
                    background:T.surfaceAlt||T.bg,
                    borderRadius:RADIUS.md,
                    padding:"12px 14px",
                    border:`1px solid ${T.border}`,
                    position:"relative",
                    overflow:"hidden",
                  }}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:cor,boxShadow:`0 0 12px ${cor}88`}}/>
                    <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:2,marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.nome}</div>
                    <div style={{fontSize:10,color:T.textSm,marginBottom:8,letterSpacing:"0.04em",textTransform:"uppercase",fontWeight:600}}>{s.secao}</div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:6}}>
                      <span style={{color:T.textSm}}>Prov: <b className="num" style={{color:T.info}}>{fmt(s.prov)}</b></span>
                      <span style={{color:T.textSm}}>Gasto: <b className="num" style={{color:T.warning}}>{fmt(s.gasto)}</b></span>
                    </div>
                    <Progress value={pct} T={T} color={cor} height={5}/>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:6}}>
                      <span className="num" style={{color:T.textSm}}>{pct.toFixed(0)}% consumido</span>
                      <span style={{color:T.textSm}}>Saldo: <b className="num" style={{color:cor}}>{fmt(s.saldo)}</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <Card T={T}>
        <PanelTitle T={T} title={`Notas Fiscais — ${MESES[mesSel]}`} subtitle={`${filtered.length} notas`}
          right={<span style={{fontSize:12,color:T.textMd}}>Total: <b className="num" style={{color:cyan}}>{fmt(totalValor)}</b></span>}
        />
        <div style={TS.wrap}>
          <table style={{...TS.table, minWidth:780}}>
            <thead>
              <tr style={TS.thead}>
                {["Fornecedor","Categoria","Nº NF","Valor","Emissão","Envio","Descrição",""].map(h =>
                  <th key={h} style={{...TS.th, ...(h==="Valor"?TS.thRight:TS.thLeft)}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(n => (
                <tr key={n.id} style={TS.tr}>
                  <td style={{...TS.td, fontWeight:600, whiteSpace:"nowrap"}}>{n.fornecedor}</td>
                  <td style={TS.td}><Pill label={n.categoria} color={cyan}/></td>
                  <td className="num" style={{...TS.td, fontSize:12, minWidth:120}}>
                    {editingId === n.id ? (
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        <input
                          autoFocus
                          value={editingNF}
                          onChange={e => setEditingNF(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEditNF(n.id); if (e.key === "Escape") cancelEdit(); }}
                          style={{...iSty(T), width:90, padding:"3px 7px", fontSize:12}}
                        />
                        <Button T={T} variant="primary" size="sm" icon={Check} onClick={() => saveEditNF(n.id)}/>
                        <Button T={T} variant="secondary" size="sm" icon={X} onClick={cancelEdit}/>
                      </div>
                    ) : (
                      <span style={{color:T.textMd}}>{n.numeroNF || "—"}</span>
                    )}
                  </td>
                  <td className="num" style={{...TS.tdNum, color:cyan, fontWeight:700}}>{fmt(n.valor)}</td>
                  <td className="num" style={{...TS.td, color:T.textMd, fontSize:12}}>{n.dataEmissao || "—"}</td>
                  <td className="num" style={{...TS.td, color:T.textMd, fontSize:12}}>{n.dataEnvio || "—"}</td>
                  <td style={{...TS.td, color:T.textSm, fontSize:12, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{n.descricao || n.obs || "—"}</td>
                  <td style={TS.td}>
                    <div style={{display:"flex",gap:4}}>
                      {n.hasFile
                        ? <Button T={T} variant="secondary" size="sm" icon={Eye}    onClick={()=>setPreview(n)}/>
                        : <Button T={T} variant="secondary" size="sm" icon={Upload} onClick={()=>{setUploadTarget(n); uploadRef.current?.click();}}/>}
                      <Button T={T} variant="secondary" size="sm" icon={Edit2} onClick={()=>startEdit(n)}/>
                      <Button T={T} variant="danger"    size="sm" icon={Trash2} onClick={()=>deleteNota(n.id)}/>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{padding:40,textAlign:"center",color:T.textSm}}>Nenhuma nota mensal em {MESES[mesSel]}</td></tr>
              )}
              {filtered.length > 0 && (
                <tr style={TS.totalRow}>
                  <td style={{...TS.td, textTransform:"uppercase", letterSpacing:"0.04em", fontSize:11}}>Total</td>
                  <td colSpan={2}/>
                  <td className="num" style={{...TS.tdNum, color:cyan}}>{fmt(totalValor)}</td>
                  <td colSpan={4}/>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showNova && <NovaNotaMensalModal fornecedores={fornecedores} servicos={servicos} notasExistentes={notas} onSave={addNota} onClose={() => setShowNova(false)} T={T}/>}
      {preview && <PreviewModal nota={preview} onClose={() => setPreview(null)} T={T}/>}
      <input ref={uploadRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" style={{display:"none"}}
        onChange={e => {if (e.target.files[0] && uploadTarget) handleUploadLater(e.target.files[0], uploadTarget); e.target.value="";}}/>
    </>
  );
}
