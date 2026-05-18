import { useState, useMemo, useEffect, useRef } from "react";
import { CATS, TIPO_COLOR, RADIUS, FONT } from "../constants";
import { fmt, subTotal, catTotal } from "../utils";
import { Pill } from "./shared";
import { Card, SectionHeader, Stat, Badge, Progress, IconButton } from "./ui";
import {
  LayoutDashboard, FileText, Users, ClipboardList,
  ArrowLeft, Eye, EyeOff, Sun, Moon,
  Wallet, TrendingUp, Activity, PiggyBank, Truck, Target,
} from "lucide-react";
import TabJogosPaulistao  from "./tabs/TabJogosPaulistao";
import TabSavings         from "./tabs/TabSavings";
import TabGraficos        from "./tabs/TabGraficos";
import TabServicos        from "./tabs/TabServicos";
import VisaoMicro         from "./tabs/VisaoMicro";
import TabApresentacoes   from "./tabs/TabApresentacoes";
import TabNotas           from "./tabs/TabNotas";
import TabNotasMensal    from "./tabs/TabNotasMensal";
import TabEnvio          from "./tabs/TabEnvio";
import TabLivemode       from "./tabs/TabLivemode";
import TabLogistica      from "./tabs/TabLogistica";
import { NovoJogoPaulistaoModal } from "./modals/NovoJogoPaulistaoModal";
import { getState, setState as setSupabaseState, supabase } from "../lib/supabase";
import { FORNECEDORES_INIT } from "../data/fornecedores";
import { COTACAO_INIT } from "../data/negociacoes";
import { makeFaseHelpers } from "../data/customCampeonato";
import LivemodeLogo from "./LivemodeLogo";

// Página genérica para qualquer campeonato dinâmico criado via "Criar Novo".
// Recebe `config` com id, nome, edicao, cor, fases — e tudo que diferencia
// um campeonato do outro fica nesse objeto. Os jogos seed vêm de
// initialJogos (definidos no momento da criação no NovoCampeonatoModal).
export default function CampeonatoCustom({ config, initialJogos = [], initialServicos = [], onBack, onOpenHub, T, darkMode, setDarkMode }) {
  const { id: campId, nome, edicao, cor: PRIMARY, fases, formato = "mata_mata", numRodadas = 0 } = config;
  const { getFase, ordemFase } = makeFaseHelpers(fases);
  const isPC = formato === "pontos_corridos";

  // Chaves namespaced no Supabase — uma por campeonato.
  const K = {
    jogos:            `${campId}_jogos`,
    servicos:         `${campId}_servicos`,
    notas:            `${campId}_notas`,
    fornecedores:     `${campId}_fornecedores`,
    notas_mensais:    `${campId}_notas_mensais`,
    envios:           `${campId}_envios`,
    livemode:         `${campId}_livemode`,
    notas_livemode:   `${campId}_notas_livemode`,
    cotacoes:         `${campId}_cotacoes`,
    fornecedores_jogo:`${campId}_fornecedores_jogo`,
    logistica:        `${campId}_logistica`,
    eventos_log:      `${campId}_eventos_log`,
  };

  const [jogos, setJogosRaw]                       = useState(initialJogos);
  const [servicos, setServicosRaw]                 = useState(initialServicos);
  const [notas, setNotasRaw]                       = useState([]);
  const [notasMensais, setNotasMensaisRaw]         = useState([]);
  const [envios, setEnviosRaw]                     = useState([]);
  const [fornecedores, setFornecedoresRaw]         = useState(FORNECEDORES_INIT);
  const [cotacoes, setCotacoesRaw]                 = useState(COTACAO_INIT);
  const [livemode, setLivemodeRaw]                 = useState([]);
  const [notasLivemode, setNotasLivemodeRaw]       = useState([]);
  const [logistica, setLogisticaRaw]               = useState([]);
  const [eventosLog, setEventosLogRaw]             = useState([]);
  const [fornecedoresJogo, setFornecedoresJogoRaw] = useState({});
  const [loading, setLoading]                      = useState(true);

  useEffect(() => {
    async function load() {
      const [j, s, n, f, nm, ev, lm, nlm, co, fj, lg, elg] = await Promise.all([
        getState(K.jogos), getState(K.servicos), getState(K.notas), getState(K.fornecedores),
        getState(K.notas_mensais), getState(K.envios), getState(K.livemode), getState(K.notas_livemode),
        getState(K.cotacoes), getState(K.fornecedores_jogo), getState(K.logistica), getState(K.eventos_log),
      ]);
      // Seed APENAS quando o valor é null/undefined (linha não existe no banco).
      // Nunca sobrescreve dados — getState com falha transitória não pode zerar
      // notas/fornecedores etc. (incidente 2026-05-01).
      const seedIfMissing = (val, key, init, setRaw) => {
        if (val != null) { setRaw(val); return; }
        setRaw(init);
        setSupabaseState(key, init);
      };
      seedIfMissing(j,   K.jogos,             initialJogos,        setJogosRaw);
      seedIfMissing(s,   K.servicos,          initialServicos,     setServicosRaw);
      seedIfMissing(n,   K.notas,             [],                  setNotasRaw);
      seedIfMissing(f,   K.fornecedores,      FORNECEDORES_INIT,   setFornecedoresRaw);
      seedIfMissing(nm,  K.notas_mensais,     [],                  setNotasMensaisRaw);
      seedIfMissing(ev,  K.envios,            [],                  setEnviosRaw);
      seedIfMissing(lm,  K.livemode,          [],                  setLivemodeRaw);
      seedIfMissing(nlm, K.notas_livemode,    [],                  setNotasLivemodeRaw);
      seedIfMissing(co,  K.cotacoes,          COTACAO_INIT,        setCotacoesRaw);
      seedIfMissing(fj,  K.fornecedores_jogo, {},                  setFornecedoresJogoRaw);
      seedIfMissing(lg,  K.logistica,         [],                  setLogisticaRaw);
      seedIfMissing(elg, K.eventos_log,       [],                  setEventosLogRaw);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`${campId}_state_changes`)
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"app_state" }, payload => {
        const m = {
          [K.jogos]: setJogosRaw, [K.servicos]: setServicosRaw, [K.notas]: setNotasRaw,
          [K.fornecedores]: setFornecedoresRaw, [K.notas_mensais]: setNotasMensaisRaw,
          [K.envios]: setEnviosRaw, [K.livemode]: setLivemodeRaw, [K.notas_livemode]: setNotasLivemodeRaw,
          [K.cotacoes]: setCotacoesRaw, [K.fornecedores_jogo]: setFornecedoresJogoRaw,
          [K.logistica]: setLogisticaRaw, [K.eventos_log]: setEventosLogRaw,
        };
        const fn = m[payload.new.key];
        if (fn) fn(payload.new.value);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campId]);

  const persisted = (key, setRaw) => fn => setRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState(key, next);
    return next;
  });
  const setJogos          = persisted(K.jogos,           setJogosRaw);
  const setServicos       = persisted(K.servicos,        setServicosRaw);
  const setNotas          = persisted(K.notas,           setNotasRaw);
  const setEnvios         = persisted(K.envios,          setEnviosRaw);
  const setNotasMensais   = persisted(K.notas_mensais,   setNotasMensaisRaw);
  const setLivemode       = persisted(K.livemode,        setLivemodeRaw);
  const setNotasLivemode  = persisted(K.notas_livemode,  setNotasLivemodeRaw);
  const setEventosLog     = persisted(K.eventos_log,     setEventosLogRaw);

  const logTimer = useRef(null);
  const setLogistica = fn => setLogisticaRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    if (logTimer.current) clearTimeout(logTimer.current);
    logTimer.current = setTimeout(() => setSupabaseState(K.logistica, next), 500);
    return next;
  });
  const fjTimer = useRef(null);
  const setFornecedoresJogo = fn => setFornecedoresJogoRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    if (fjTimer.current) clearTimeout(fjTimer.current);
    fjTimer.current = setTimeout(() => setSupabaseState(K.fornecedores_jogo, next), 500);
    return next;
  });

  const VAR_CAT_TO_CATKEY = { "Transporte":"logistica","Uber":"logistica","Hospedagem":"logistica","Seg. Espacial":"operacoes" };

  const logRealizadoPorJogo = useMemo(() => {
    const map = {};
    (Array.isArray(logistica) ? logistica : []).filter(l => l && l.jogoId).forEach(l => {
      const v = l.valores || {};
      const aj = l.ajustes || {};
      const num = x => parseFloat(x) || 0;
      const entry = map[l.jogoId] || { transporte:0, uber:0, hospedagem:0, outros_log:0 };
      entry.transporte += num(v.transporte_locado) + num(v.passagem) + num(aj.passagem?.valor);
      entry.uber       += num(v.uber);
      entry.hospedagem += num(v.hospedagem) + num(v.clara) + num(v.espresso) + num(aj.hospedagem?.valor);
      entry.outros_log += num(v.outros);
      map[l.jogoId] = entry;
    });
    return map;
  }, [logistica]);

  const rateioSegEspacialPorJogo = useMemo(() => {
    const parseMes = (dataStr) => {
      if (!dataStr || /^[aà] definir$/i.test(dataStr.trim())) return null;
      let m = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return parseInt(m[2]) - 1;
      m = dataStr.match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/);
      if (m) return parseInt(m[2]) - 1;
      return null;
    };
    const jogosPorMes = {};
    jogos.filter(j => j.mandante !== "A definir").forEach(j => {
      const mes = parseMes(j.data);
      if (mes == null) return;
      (jogosPorMes[mes] = jogosPorMes[mes] || []).push(j.id);
    });
    const map = {};
    (notasMensais||[]).filter(n => n.categoria === "Seg. Espacial").forEach(n => {
      const ids = jogosPorMes[n.mes] || [];
      if (ids.length === 0) return;
      const share = (n.valor || 0) / ids.length;
      ids.forEach(id => { map[id] = (map[id] || 0) + share; });
    });
    return map;
  }, [notasMensais, jogos]);

  const jogosCalc = useMemo(() => jogos.map(j => {
    const lg = logRealizadoPorJogo[j.id];
    const se = rateioSegEspacialPorJogo[j.id];
    if (!lg && !se) return j;
    return {
      ...j,
      realizado: {
        ...(j.realizado||{}),
        ...(lg ? { transporte: lg.transporte, uber: lg.uber, hospedagem: lg.hospedagem, outros_log: lg.outros_log } : {}),
        ...(se ? { seg_espacial: se } : {}),
      },
    };
  }), [jogos, logRealizadoPorJogo, rateioSegEspacialPorJogo]);

  const servicosCalc = useMemo(() => servicos.map(sec => ({
    ...sec,
    itens: sec.itens.map(it => ({
      ...it,
      realizado: notasMensais.filter(n => n.servicoId === it.id).reduce((s, n) => s + (n.valor || 0), 0),
    })),
  })), [servicos, notasMensais]);

  const varCalc = useMemo(() => {
    const allJ = jogosCalc.filter(j => j.mandante !== "A definir");
    const result = CATS.map(cat => {
      const realizadoMensal = notasMensais
        .filter(n => !n.servicoId && VAR_CAT_TO_CATKEY[n.categoria] === cat.key && n.categoria !== "Seg. Espacial")
        .reduce((s, n) => s + (n.valor || 0), 0);
      return {
        nome: cat.label,
        orcado:       allJ.reduce((s,j) => s+catTotal(j.orcado, cat), 0),
        provisionado: allJ.reduce((s,j) => s+catTotal(j.provisionado, cat), 0),
        realizado:    allJ.reduce((s,j) => s+catTotal(j.realizado, cat), 0) + realizadoMensal,
        tipo: "variavel",
      };
    });
    const extraOrc = allJ.reduce((s,j) => s+((j.orcado&&j.orcado.extra)||0), 0);
    result.push({ nome:"Extra", orcado:extraOrc, provisionado:0, realizado:0, tipo:"variavel" });
    return result;
  }, [jogosCalc, notasMensais]);

  const fixosCalc = useMemo(() => servicosCalc.map(s => ({
    nome: s.secao,
    orcado:       s.itens.reduce((t,i) => t+i.orcado, 0),
    provisionado: s.itens.reduce((t,i) => t+i.provisionado, 0),
    realizado:    s.itens.reduce((t,i) => t+i.realizado, 0),
    tipo: "fixo",
  })), [servicosCalc]);

  const outrosMensaisCalc = useMemo(() => {
    const total = notasMensais
      .filter(n => !n.servicoId && !VAR_CAT_TO_CATKEY[n.categoria])
      .reduce((s, n) => s + (n.valor || 0), 0);
    return total > 0
      ? [{ nome:"Outros Mensais", orcado:0, provisionado:0, realizado: total, tipo:"fixo" }]
      : [];
  }, [notasMensais]);

  const RESUMO_CATS = [...varCalc, ...fixosCalc, ...outrosMensaisCalc];

  const [setor, setSetor]               = useState("orcamento");
  const [tab, setTab]                   = useState("dashboard");
  const [showNovo, setNovo]             = useState(false);
  const [jogoEdit, setJogoEdit]         = useState(null);
  const [filtroFase, setFiltroFase]     = useState("Todas");
  const [filtroRodada, setFiltroRodada] = useState("Todas");
  const [filtroGrupo, setFiltroGrupo]   = useState("Todos");
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [microJogoId, setMicroJogoId]   = useState(jogos.find(j=>j.mandante!=="A definir")?.id);
  const [ocultar, setOcultar]           = useState(false);

  const saveJogo       = j => setJogos(js => js.map(x => x.id===j.id ? j : x));
  const addJogo        = j => {
    setJogos(js => {
      let replaced = false;
      let next = js.map(x => {
        if (!replaced && x.mandante==="A definir" && x.fase===j.fase && x.grupo===j.grupo && x.rodada===j.rodada) {
          replaced = true;
          return { ...j, id: x.id };
        }
        return x;
      });
      if (!replaced) {
        next = js.map(x => {
          if (!replaced && x.mandante==="A definir" && x.fase===j.fase) {
            replaced = true;
            return { ...j, id: x.id };
          }
          return x;
        });
      }
      if (!replaced) next = [...js, j];
      return next;
    });
    setNovo(false); setJogoEdit(null);
  };
  const deleteJogo     = id => { if(window.confirm("Excluir este jogo?")) setJogos(js => js.filter(j => j.id !== id)); };
  const editJogo       = j => setJogoEdit(j);
  const handleEditSave = j => { saveJogo(j); setJogoEdit(null); };

  const totalOrc  = RESUMO_CATS.reduce((s,c) => s+c.orcado, 0);
  const totalProv = RESUMO_CATS.reduce((s,c) => s+c.provisionado, 0);
  const totalReal = RESUMO_CATS.reduce((s,c) => s+c.realizado, 0);
  const pctGasto  = totalOrc ? ((totalReal/totalOrc)*100).toFixed(1) : 0;

  const divulgados = jogosCalc.filter(j => j.mandante !== "A definir")
    .sort((a,b) => ordemFase(a.fase) - ordemFase(b.fase) || a.rodada - b.rodada || a.id - b.id);
  const aDivulgar  = jogos.filter(j => j.mandante === "A definir");

  // Projetado: por jogo, usa provisionado quando > 0; senão o orçado.
  // Idem para cada item de serviço fixo. Migra de orçado p/ provisionado
  // conforme o operador trava cada item.
  const projetadoJogos = jogosCalc.reduce((s, j) => {
    const prov = subTotal(j.provisionado);
    return s + (prov > 0 ? prov : subTotal(j.orcado));
  }, 0);
  const projetadoServicos = servicosCalc.reduce((s, sec) =>
    s + sec.itens.reduce((u, i) => u + ((i.provisionado || 0) > 0 ? i.provisionado : (i.orcado || 0)), 0), 0);
  const totalProjetado = projetadoJogos + projetadoServicos;

  // Reaproveita TabSavings com mapeamento fase→rodada compósita.
  // Pontos corridos: usa rodada direto (1..N). Mata-mata: ordemFase*100+rodada.
  const jogosParaSavings = useMemo(() => divulgados.map(j => ({
    ...j,
    rodada: isPC ? (j.rodada || 0) : (ordemFase(j.fase) * 100 + (j.rodada || 0)),
  })), [divulgados, isPC]);
  const rodadasListSavings = useMemo(() => {
    const set = new Set(jogosParaSavings.map(j => j.rodada));
    return ["Todas", ...Array.from(set).sort((a,b)=>a-b).map(String)];
  }, [jogosParaSavings]);
  const [filtroRodSav, setFiltroRodSav] = useState("Todas");
  const [filtroCatSav, setFiltroCatSav] = useState("Todas");
  const jogosFilteredSav = jogosParaSavings.filter(j =>
    (filtroRodSav==="Todas" || j.rodada===parseInt(filtroRodSav))
  );
  const totOrcSav  = jogosFilteredSav.reduce((s,j) => s+subTotal(j.orcado), 0);
  const totProvSav = jogosFilteredSav.reduce((s,j) => s+subTotal(j.provisionado), 0);

  const savingPorFase = useMemo(() => {
    const map = {};
    divulgados.forEach(j => {
      const fase = getFase(j.fase);
      const k = fase.short;
      if (!map[k]) map[k] = { name:k, Saving:0, ordem:fase.ordem };
      map[k].Saving += subTotal(j.orcado) - subTotal(j.provisionado);
    });
    return Object.values(map).sort((a,b)=>a.ordem-b.ordem);
  }, [divulgados]);

  const TABS_ORC  = ["dashboard","serviços","jogos","micro","savings","gráficos"];
  const TABS_NF   = ["notas fiscais","mensal","serviços livemode"];
  const TABS_REL  = ["apresentações","envio"];
  const TABS_LOG  = ["logística"];
  const TABS = setor==="orcamento" ? TABS_ORC : setor==="notas" ? TABS_NF : setor==="logistica" ? TABS_LOG : TABS_REL;

  const handleSetorChange = s => {
    if (s === "fornecedores") { onOpenHub && onOpenHub(campId); return; }
    setSetor(s);
    if (s === "orcamento") setTab("dashboard");
    else if (s === "notas") setTab("notas fiscais");
    else if (s === "logistica") setTab("logística");
    else if (s === "relatorio") setTab("apresentações");
  };

  if (loading) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{color:T.textMd,fontSize:16}}>Carregando...</p>
    </div>
  );

  const SETORES = [
    { k:"orcamento",    l:"Orçamento",            icon:LayoutDashboard },
    { k:"notas",        l:"Notas Fiscais",        icon:FileText },
    { k:"logistica",    l:"Logística",            icon:Truck },
    { k:"fornecedores", l:"Hub de Fornecedores →", icon:Users },
    { k:"relatorio",    l:"Relatório",            icon:ClipboardList },
  ];
  const setorAtual = SETORES.find(s => s.k === setor);

  const orcadoTotalCampeonato = jogos.reduce((s,j)=>s+subTotal(j.orcado),0)
                              + servicos.reduce((t,sec)=>t+sec.itens.reduce((u,i)=>u+(i.orcado||0),0),0);

  return (
    <div className="page-enter" style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Poppins',sans-serif",display:"flex"}}>
      <aside style={{
        width:72, minHeight:"100vh",
        background: T.gradSidebar || "linear-gradient(180deg,#0a0f1a,#0f172a)",
        borderRight:"1px solid rgba(255,255,255,0.06)",
        display:"flex", flexDirection:"column", alignItems:"center",
        paddingTop:16, paddingBottom:16, gap:6, flexShrink:0,
        position:"sticky", top:0, height:"100vh",
      }}>
        <div style={{ marginBottom: 12 }}>
          <LivemodeLogo size={40} onClick={onBack} title="Voltar ao portal"/>
        </div>
        <div style={{ width:32, height:1, background:"rgba(255,255,255,0.06)", marginBottom:8 }}/>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {SETORES.map(s => (
            <IconButton key={s.k} icon={s.icon} title={s.l}
              active={setor===s.k} onClick={()=>handleSetorChange(s.k)} size={44} T={T}/>
          ))}
        </div>
        <div style={{ flex:1 }}/>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <IconButton icon={ocultar ? EyeOff : Eye} title={ocultar?"Mostrar valores":"Ocultar valores"}
            onClick={()=>setOcultar(o=>!o)} active={ocultar} size={40} T={T}/>
          <IconButton icon={darkMode ? Sun : Moon} title={darkMode?"Modo claro":"Modo escuro"}
            onClick={()=>setDarkMode(d=>!d)} size={40} T={T}/>
        </div>
      </aside>

      <div style={{flex:1,minWidth:0,paddingBottom:40,background:T.bg}}>
        <div style={{
          background: T.surface || T.card,
          borderBottom: `1px solid ${T.border}`,
          padding: "20px 32px 0",
        }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16,paddingBottom:18}}>
            <div style={{ minWidth:0, display:"flex", alignItems:"center", gap:14 }}>
              {setorAtual?.icon && (
                <div style={{
                  width:42, height:42, borderRadius:RADIUS.md,
                  background: T.brandSoft || "rgba(101,179,46,0.10)",
                  color: T.brand || "#65B32E",
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                }}>
                  <setorAtual.icon size={20} strokeWidth={2.25}/>
                </div>
              )}
              <div style={{ minWidth:0 }}>
                <p style={{
                  color: T.brand || "#65B32E",
                  fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase",
                  margin:"0 0 3px", fontWeight:600, fontFamily: FONT.ui,
                }}>Livemode · Transmissões · {setorAtual?.l}</p>
                <h1 style={{ fontFamily: FONT.display, fontSize:22, fontWeight:700, margin:0, color:T.text, letterSpacing:"-0.005em", lineHeight:1.1 }}>{nome} {edicao}</h1>
                <p style={{ color:T.textMd, fontSize:12, margin:"4px 0 0" }}>
                  <span className="num" style={{ color:T.text, fontWeight:600 }}>{divulgados.length}</span> divulgados
                  <span style={{ color:T.border, margin:"0 8px" }}>·</span>
                  <span className="num" style={{ color:T.text, fontWeight:600 }}>{aDivulgar.length}</span> a divulgar
                  <span style={{ color:T.border, margin:"0 8px" }}>·</span>
                  <span className="num" style={{ color:T.text, fontWeight:600 }}>{isPC ? (numRodadas || Array.from(new Set(jogos.map(j=>j.rodada))).length) : fases.length}</span> {isPC ? "rodadas" : (fases.length===1?"fase":"fases")}
                </p>
              </div>
            </div>

            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",background: T.surfaceAlt || T.bg, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg}}>
                <Wallet size={16} color={T.projetado || "#7C3AED"} strokeWidth={2.25}/>
                <div style={{ textAlign:"right" }}>
                  <p style={{ color:T.textSm, fontSize:10, margin:"0 0 2px", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>Orçado total campeonato</p>
                  <p className="num" style={{ fontFamily: FONT.display, fontSize:22, fontWeight:700, color: T.projetado || "#7C3AED", margin:0, filter:ocultar?"blur(8px)":"none", transition:"filter 0.2s", letterSpacing:"-0.005em", lineHeight:1 }}>{fmt(orcadoTotalCampeonato)}</p>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",background: T.surfaceAlt || T.bg, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg}}>
                <Activity size={16} color={T.brand || "#65B32E"} strokeWidth={2.25}/>
                <div style={{ textAlign:"right" }}>
                  <p style={{ color:T.textSm, fontSize:10, margin:"0 0 2px", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>Execução geral</p>
                  <p className="num" style={{ fontFamily: FONT.display, fontSize:22, fontWeight:700, color: pctGasto>80 ? (T.danger||"#DC2626") : (T.brand||"#65B32E"), margin:0, filter:ocultar?"blur(8px)":"none", transition:"filter 0.2s", letterSpacing:"-0.005em", lineHeight:1 }}>{pctGasto}%</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:"flex", gap:4, overflowX:"auto", WebkitOverflowScrolling:"touch", marginBottom:-1 }}>
            {TABS.map(t => {
              const isActive = tab===t;
              return (
                <button key={t} onClick={()=>setTab(t)} style={{
                  padding:"12px 16px", border:"none",
                  borderBottom: `2px solid ${isActive ? (T.brand||"#65B32E") : "transparent"}`,
                  background:"transparent",
                  color: isActive ? T.text : T.textMd,
                  fontFamily: FONT.ui,
                  fontWeight: isActive ? 500 : 400,
                  fontSize:13, cursor:"pointer", whiteSpace:"nowrap",
                  textTransform:"capitalize", flexShrink:0,
                  letterSpacing:"0",
                }}>{t}</button>
              );
            })}
          </div>
        </div>

        <div key={tab} className="tab-content" style={{padding:"28px 32px",filter:ocultar?"blur(10px)":"none",transition:"filter 0.3s",userSelect:ocultar?"none":"auto"}}>
        {tab==="dashboard" && (<>
          <div className="stagger" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:24}}>
            <Stat T={T} label="Total Orçado"       value={fmt(totalOrc)}       sub="Jogos + serviços fixos" color={T.info} icon={Wallet}/>
            <Stat T={T} label="Total Provisionado" value={fmt(totalProv)}      sub={`${totalOrc?((totalProv/totalOrc)*100).toFixed(1):0}% do orçado`} color={T.warning} icon={PiggyBank}/>
            <Stat T={T} label="Total Realizado"    value={fmt(totalReal)}      sub={`${pctGasto}% executado`} color={T.success} icon={TrendingUp}/>
            <Stat T={T} label="Projetado"          value={fmt(totalProjetado)} sub="Provisionado quando há, senão orçado" color={T.projetado || "#7C3AED"} icon={Target}/>
          </div>
          <Card T={T}>
            <SectionHeader T={T} title="Resumo por Categoria" subtitle="Visão consolidada por natureza de despesa" icon={LayoutDashboard}
              right={<div style={{display:"flex",gap:10,fontSize:11,color:T.textMd}}>
                <Badge color="#6366f1" T={T}>Fixo</Badge>
                <Badge color="#f43f5e" T={T}>Variável</Badge>
              </div>}/>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}>
                <thead>
                  <tr style={{background:T.surfaceAlt||T.bg}}>
                    {["Categoria","Tipo","Orçado","Provisionado","Realizado","% Exec.","Progresso"].map(h => (
                      <th key={h} style={{padding:"11px 16px",textAlign:h==="Categoria"||h==="Tipo"?"left":"right",color:T.textSm,fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:`1px solid ${T.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESUMO_CATS.map(c => {
                    const pct = c.orcado ? Math.min(100,(c.realizado/c.orcado)*100) : 0;
                    return (
                      <tr key={c.nome} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:"13px 16px",fontWeight:600,whiteSpace:"nowrap",color:T.text,fontSize:13}}>{c.nome}</td>
                        <td style={{padding:"13px 16px"}}><Pill label={c.tipo} color={TIPO_COLOR[c.tipo]}/></td>
                        <td className="num" style={{padding:"13px 16px",textAlign:"right",whiteSpace:"nowrap",color:T.text,fontSize:13}}>{fmt(c.orcado)}</td>
                        <td className="num" style={{padding:"13px 16px",textAlign:"right",color:T.warning||"#D97706",whiteSpace:"nowrap",fontSize:13}}>{fmt(c.provisionado||0)}</td>
                        <td className="num" style={{padding:"13px 16px",textAlign:"right",color:T.success||"#16A34A",whiteSpace:"nowrap",fontSize:13}}>{fmt(c.realizado)}</td>
                        <td className="num" style={{padding:"13px 16px",textAlign:"right",color:T.text,fontSize:13}}>{pct.toFixed(1)}%</td>
                        <td style={{padding:"13px 20px",minWidth:120}}><Progress value={pct} T={T}/></td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:`2px solid ${T.borderStrong||T.border}`,background:T.surfaceAlt||T.bg,fontWeight:700}}>
                    <td colSpan={2} style={{padding:"14px 16px",color:T.text,fontSize:12,letterSpacing:"0.04em",textTransform:"uppercase"}}>Total Geral</td>
                    <td className="num" style={{padding:"14px 16px",textAlign:"right",color:T.info||"#2563EB",whiteSpace:"nowrap",fontSize:14,fontWeight:600}}>{fmt(totalOrc)}</td>
                    <td className="num" style={{padding:"14px 16px",textAlign:"right",color:T.warning||"#D97706",whiteSpace:"nowrap",fontSize:14,fontWeight:600}}>{fmt(totalProv)}</td>
                    <td className="num" style={{padding:"14px 16px",textAlign:"right",color:T.success||"#16A34A",whiteSpace:"nowrap",fontSize:14,fontWeight:600}}>{fmt(totalReal)}</td>
                    <td className="num" style={{padding:"14px 16px",textAlign:"right",color:T.text,fontSize:14,fontWeight:700}}>{pctGasto}%</td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>)}

        {tab==="jogos"         && <TabJogosPaulistao jogos={jogosCalc} fases={fases} formato={formato} numRodadas={numRodadas} filtroFase={filtroFase} setFiltroFase={setFiltroFase} filtroRodada={filtroRodada} setFiltroRodada={setFiltroRodada} filtroGrupo={filtroGrupo} setFiltroGrupo={setFiltroGrupo} showPlaceholder={showPlaceholder} setShowPlaceholder={setShowPlaceholder} setMicroJogoId={setMicroJogoId} setTab={setTab} setNovo={setNovo} onDelete={deleteJogo} onEdit={editJogo} T={T}/>}
        {tab==="savings"       && <TabSavings jogosFiltered={jogosFilteredSav} divulgados={jogosParaSavings} totOrcJogos={totOrcSav} totProvJogos={totProvSav} filtroRod={filtroRodSav} setFiltroRod={setFiltroRodSav} filtroCat={filtroCatSav} setFiltroCat={setFiltroCatSav} rodadasList={rodadasListSavings} T={T}/>}
        {tab==="gráficos"      && <TabGraficos divulgados={divulgados} savingRodada={savingPorFase} RESUMO_CATS={RESUMO_CATS} T={T}/>}
        {tab==="micro"         && <VisaoMicro jogos={jogosCalc} jogoId={microJogoId} onChangeJogo={setMicroJogoId} onSave={saveJogo} T={T}/>}
        {tab==="serviços"      && <TabServicos servicos={servicosCalc} setServicos={setServicos} T={T}/>}
        {tab==="notas fiscais" && <TabNotas notas={notas} setNotas={setNotas} jogos={jogos} setJogos={setJogos} fornecedores={fornecedores} envios={envios} fornecedoresJogo={fornecedoresJogo} setFornecedoresJogo={setFornecedoresJogo} T={T}/>}
        {tab==="mensal"        && <TabNotasMensal notas={notasMensais} setNotas={setNotasMensais} fornecedores={fornecedores} servicos={servicosCalc} T={T}/>}
        {tab==="serviços livemode" && <TabLivemode livemode={livemode} setLivemode={setLivemode} notasLivemode={notasLivemode} setNotasLivemode={setNotasLivemode} jogos={jogos} setJogos={setJogos} fornecedores={fornecedores} T={T}/>}
        {tab==="logística"     && <TabLogistica logistica={logistica} setLogistica={setLogistica} jogos={jogos} fornecedores={fornecedores} eventosLog={eventosLog} setEventosLog={setEventosLog} T={T}/>}
        {tab==="apresentações" && <TabApresentacoes jogos={divulgados} servicos={servicosCalc} notasMensais={notasMensais} T={T}/>}
        {tab==="envio"         && <TabEnvio jogos={jogosCalc} notas={notas} notasMensais={notasMensais} notasLivemode={notasLivemode} servicos={servicosCalc} envios={envios} setEnvios={setEnvios} T={T} enviosKey={K.envios}/>}
        </div>

        {showNovo && <NovoJogoPaulistaoModal fases={fases} titulo={nome} onSave={addJogo} onClose={()=>setNovo(false)} T={T}/>}
        {jogoEdit && <NovoJogoPaulistaoModal fases={fases} titulo={nome} jogo={jogoEdit} onSave={handleEditSave} onClose={()=>setJogoEdit(null)} T={T}/>}
      </div>
    </div>
  );
}
