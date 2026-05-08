import { useState, useMemo, useEffect, useRef } from "react";
import { DARK, LIGHT, CATS, TIPO_COLOR, LS_JOGOS, LS_SERVICOS, LS_DARK, btnStyle, RADIUS, CENARIO_INFO, FONT } from "./constants";
import { fmt, fmtK, subTotal, catTotal, lsGet, lsSet } from "./utils";
import { ALL_JOGOS, SERVICOS_INIT } from "./data";
import { KPI, Pill, CustomTooltip } from "./components/shared";
import { Card, SectionHeader, Stat, Badge, Progress, IconButton } from "./components/ui";
import {
  LayoutDashboard, FileText, Users, ClipboardList,
  ArrowLeft, Eye, EyeOff, Sun, Moon, Lock,
  Wallet, TrendingUp, Activity, PiggyBank, Truck, Target,
} from "lucide-react";
import Home             from "./components/Home";
import LivemodeLogo     from "./components/LivemodeLogo";
import TabJogos         from "./components/tabs/TabJogos";
import TabSavings       from "./components/tabs/TabSavings";
import TabGraficos      from "./components/tabs/TabGraficos";
import TabServicos      from "./components/tabs/TabServicos";
import VisaoMicro       from "./components/tabs/VisaoMicro";
import TabApresentacoes from "./components/tabs/TabApresentacoes";
import TabNotas         from "./components/tabs/TabNotas";
import TabNotasMensal  from "./components/tabs/TabNotasMensal";
import TabEnvio        from "./components/tabs/TabEnvio";
import TabLivemode     from "./components/tabs/TabLivemode";
import TabLogistica    from "./components/tabs/TabLogistica";
import { NovoJogoModal, NovoRapidoModal } from "./components/modals/NovoJogoModal";
import { getState, setState as setSupabaseState, supabase } from "./lib/supabase";
import { FORNECEDORES_INIT } from "./data/fornecedores";
import { COTACAO_INIT } from "./data/negociacoes";


// ─── BRASILEIRÃO ──────────────────────────────────────────────────────────────
function Brasileirao({ onBack, onOpenHub, T, darkMode, setDarkMode }) {
  const [jogos, setJogosRaw]       = useState(ALL_JOGOS);
  const [servicos, setServicosRaw] = useState(SERVICOS_INIT);
  const [notas, setNotasRaw]               = useState([]);
  const [notasMensais, setNotasMensaisRaw] = useState([]);
  const [envios, setEnviosRaw]             = useState([]);
  const [fornecedores, setFornecedoresRaw] = useState(FORNECEDORES_INIT);
  const [cotacoes, setCotacoesRaw]         = useState(COTACAO_INIT);
  const [livemode, setLivemodeRaw]       = useState([]);
  const [notasLivemode, setNotasLivemodeRaw] = useState([]);
  const [logistica, setLogisticaRaw]     = useState([]);
  const [eventosLog, setEventosLogRaw]   = useState([]);
  const [fornecedoresJogo, setFornecedoresJogoRaw] = useState({});
  const [loading, setLoading]            = useState(true);

  useEffect(() => {
    async function load() {
      const [j, s, n, f, nm, ev, lm, nlm, co, fj, lg, elg] = await Promise.all([getState('jogos'), getState('servicos'), getState('notas'), getState('fornecedores'), getState('notas_mensais'), getState('envios'), getState('livemode'), getState('notas_livemode'), getState('cotacoes'), getState('fornecedores_jogo'), getState('logistica'), getState('eventos_log')]);
      // Seed APENAS quando o valor é null/undefined (linha não existe no banco).
      // Nunca sobrescreve um array vazio legítimo, e nunca escreve por cima de
      // dados existentes — assim um getState com falha transitória/null não zera
      // notas, notas_mensais, fornecedores etc. (incidente 2026-05-01).
      const seedIfMissing = (val, key, init, setRaw) => {
        if (val != null) { setRaw(val); return; }
        setRaw(init);
        setSupabaseState(key, init);
      };
      seedIfMissing(j, 'jogos', ALL_JOGOS, setJogosRaw);
      if (s != null) {
        // Migração: renomear "Infraestrutura e Distribuição de Sinais" -> "Serviços Complementares"
        const OLD = "Infraestrutura e Distribuição de Sinais";
        const NEW = "Serviços Complementares";
        const precisaMigrar = Array.isArray(s) && s.some(sec => sec.secao === OLD);
        if (precisaMigrar) {
          const migrado = s.map(sec => sec.secao === OLD ? {...sec, secao: NEW} : sec);
          setServicosRaw(migrado);
          setSupabaseState('servicos', migrado);
        } else {
          setServicosRaw(s);
        }
      } else { setServicosRaw(SERVICOS_INIT); setSupabaseState('servicos', SERVICOS_INIT); }
      seedIfMissing(n,   'notas',             [],                  setNotasRaw);
      seedIfMissing(f,   'fornecedores',      FORNECEDORES_INIT,   setFornecedoresRaw);
      seedIfMissing(nm,  'notas_mensais',     [],                  setNotasMensaisRaw);
      seedIfMissing(ev,  'envios',            [],                  setEnviosRaw);
      seedIfMissing(lm,  'livemode',          [],                  setLivemodeRaw);
      seedIfMissing(nlm, 'notas_livemode',    [],                  setNotasLivemodeRaw);
      seedIfMissing(co,  'cotacoes',          COTACAO_INIT,        setCotacoesRaw);
      seedIfMissing(fj,  'fornecedores_jogo', {},                  setFornecedoresJogoRaw);
      seedIfMissing(lg,  'logistica',         [],                  setLogisticaRaw);
      seedIfMissing(elg, 'eventos_log',       [],                  setEventosLogRaw);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel('app_state_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state' }, payload => {
        if (payload.new.key === 'jogos')        setJogosRaw(payload.new.value);
        if (payload.new.key === 'servicos')     setServicosRaw(payload.new.value);
        if (payload.new.key === 'notas')        setNotasRaw(payload.new.value);
        if (payload.new.key === 'fornecedores')   setFornecedoresRaw(payload.new.value);
        if (payload.new.key === 'notas_mensais') setNotasMensaisRaw(payload.new.value);
        if (payload.new.key === 'envios')        setEnviosRaw(payload.new.value);
        if (payload.new.key === 'livemode')      setLivemodeRaw(payload.new.value);
        if (payload.new.key === 'notas_livemode') setNotasLivemodeRaw(payload.new.value);
        if (payload.new.key === 'cotacoes')       setCotacoesRaw(payload.new.value);
        if (payload.new.key === 'fornecedores_jogo') setFornecedoresJogoRaw(payload.new.value);
        if (payload.new.key === 'logistica')     setLogisticaRaw(payload.new.value);
        if (payload.new.key === 'eventos_log')   setEventosLogRaw(payload.new.value);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const setJogos = fn => setJogosRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('jogos', next); return next;
  });
  const setServicos = fn => setServicosRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('servicos', next); return next;
  });
  const setNotas = fn => setNotasRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('notas', next); return next;
  });
  const setEnvios = fn => setEnviosRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('envios', next); return next;
  });
  const setNotasMensais = fn => setNotasMensaisRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('notas_mensais', next); return next;
  });
  const setFornecedores = fn => setFornecedoresRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('fornecedores', next); return next;
  });
  const setLivemode = fn => setLivemodeRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('livemode', next); return next;
  });
  const setNotasLivemode = fn => setNotasLivemodeRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('notas_livemode', next); return next;
  });
  const setCotacoes = fn => setCotacoesRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('cotacoes', next); return next;
  });
  const setEventosLog = fn => setEventosLogRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    setSupabaseState('eventos_log', next); return next;
  });
  // Debounce da gravação no Supabase para reduzir rollbacks do realtime durante digitação
  const logisticaTimer = useRef(null);
  const setLogistica = fn => setLogisticaRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    if (logisticaTimer.current) clearTimeout(logisticaTimer.current);
    logisticaTimer.current = setTimeout(() => { setSupabaseState('logistica', next); }, 500);
    return next;
  });
  const fornJogoTimer = useRef(null);
  const setFornecedoresJogo = fn => setFornecedoresJogoRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    if (fornJogoTimer.current) clearTimeout(fornJogoTimer.current);
    fornJogoTimer.current = setTimeout(() => { setSupabaseState('fornecedores_jogo', next); }, 500);
    return next;
  });

  // Mapa de categoria variável (aba Mensal) → chave de CAT no dashboard
  const VAR_CAT_TO_CATKEY = { "Transporte":"logistica", "Uber":"logistica", "Hospedagem":"logistica", "Seg. Espacial":"operacoes" };

  // Realizado de logística por jogo (fonte única: lançamentos da aba Logística)
  // Mapeamento: transporte_locado + passagem (+ ajuste passagem) -> transporte
  //             uber -> uber
  //             hospedagem + clara + espresso (+ ajuste hospedagem) -> hospedagem
  //             outros -> outros_log
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

  // Rateio de notas mensais "Seg. Espacial" entre jogos do mês
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

  // jogosCalc: jogos com realizado de logística derivado (substitui as subs logística)
  const jogosCalc = useMemo(() => jogos.map(j => {
    const lg = logRealizadoPorJogo[j.id];
    const se = rateioSegEspacialPorJogo[j.id];
    if (!lg && !se) return j;
    return {
      ...j,
      realizado: {
        ...(j.realizado||{}),
        ...(lg ? {
          transporte: lg.transporte,
          uber:       lg.uber,
          hospedagem: lg.hospedagem,
          outros_log: lg.outros_log,
        } : {}),
        ...(se ? { seg_espacial: se } : {}),
      },
    };
  }), [jogos, logRealizadoPorJogo, rateioSegEspacialPorJogo]);

  // Servicos com realizado derivado das NFs mensais (fonte única da verdade: as NFs)
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

  // "Outros Mensais": NFs mensais sem servicoId e sem mapeamento variável (ex: categoria "Outro")
  const outrosMensaisCalc = useMemo(() => {
    const total = notasMensais
      .filter(n => !n.servicoId && !VAR_CAT_TO_CATKEY[n.categoria])
      .reduce((s, n) => s + (n.valor || 0), 0);
    return total > 0
      ? [{ nome:"Outros Mensais", orcado:0, provisionado:0, realizado: total, tipo:"fixo" }]
      : [];
  }, [notasMensais]);

  const RESUMO_CATS = [...varCalc, ...fixosCalc, ...outrosMensaisCalc];

  const [setor,           setSetor]           = useState("orcamento");
  const [tab,             setTab]             = useState("dashboard");
  const [showNovo,        setNovo]            = useState(false);
  const [novoRapido,      setNovoRapido]      = useState(null);
  const [jogoEdit,        setJogoEdit]        = useState(null);

  const [filtroRod,       setFiltroRod]       = useState("Todas");
  const [filtroCat,       setFiltroCat]       = useState("Todas");
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [microJogoId,     setMicroJogoId]     = useState(jogos.find(j=>j.mandante!=="A definir")?.id);
  const [ocultar,         setOcultar]         = useState(false);

  const saveJogo       = j => setJogos(js => js.map(x => x.id===j.id ? j : x));
  const addJogo        = j => {
    setJogos(js => {
      // 1) Tentar substituir placeholder da mesma rodada e categoria
      let replaced = false;
      let next = js.map(x => {
        if (!replaced && x.mandante === "A definir" && x.rodada === j.rodada && x.categoria === j.categoria) {
          replaced = true;
          return { ...j, id: x.id };
        }
        return x;
      });
      // 2) Se não achou match exato, substituir qualquer placeholder disponível
      if (!replaced) {
        next = js.map(x => {
          if (!replaced && x.mandante === "A definir") {
            replaced = true;
            return { ...j, id: x.id };
          }
          return x;
        });
      }
      return replaced ? next : js; // nunca ultrapassar o total de 76
    });
    setNovo(false); setNovoRapido(null);
  };
  const deleteJogo     = id => { if(window.confirm("Excluir este jogo?")) setJogos(js => js.filter(j => j.id !== id)); };
  const editJogo       = j => setJogoEdit(j);
  const handleEditSave = j => { saveJogo(j); setJogoEdit(null); };


  const totalOrc  = RESUMO_CATS.reduce((s,c) => s+c.orcado, 0);
  const totalProv = RESUMO_CATS.reduce((s,c) => s+c.provisionado, 0);
  const totalReal = RESUMO_CATS.reduce((s,c) => s+c.realizado, 0);
  const pctGasto  = totalOrc ? ((totalReal/totalOrc)*100).toFixed(1) : 0;

  const divulgados  = jogosCalc.filter(j => j.mandante !== "A definir").sort((a,b) => a.rodada - b.rodada || a.id - b.id);
  const aDivulgar   = jogos.filter(j => j.mandante === "A definir");
  const rodadasList = ["Todas", ...Array.from(new Set(divulgados.map(j=>j.rodada))).sort((a,b)=>a-b).map(String)];

  // ─── PROJETADO ATÉ FIM DO CAMPEONATO ────────────────────────────────────────
  // Plano pré-campeonato: 34 B1 sudeste + 18 B2 sudeste + 24 B2 sul = 76 jogos
  const PLANO_JOGOS = { b1:34, b2s:18, b2sul:24 };
  const CIDADES_SUL = ["Porto Alegre","Curitiba","Chapecó","Chapeco","Criciúma","Criciuma","Florianópolis","Florianopolis"];
  const cenarioDoJogo = j => {
    if (j.categoria === "B1") return "b1";
    const isSul = j.regiao ? String(j.regiao).toLowerCase()==="sul" : CIDADES_SUL.includes(j.cidade);
    return isSul ? "b2sul" : "b2s";
  };
  const divulgadosCount = { b1:0, b2s:0, b2sul:0 };
  divulgados.forEach(j => { divulgadosCount[cenarioDoJogo(j)]++; });
  const orcRestanteJogos = Object.keys(PLANO_JOGOS).reduce((s,k) => {
    const restante = Math.max(0, PLANO_JOGOS[k] - divulgadosCount[k]);
    return s + restante * CENARIO_INFO[k].total;
  }, 0);
  const totalProjetado = totalProv + orcRestanteJogos;

  const filtrados = (showPlaceholder ? jogosCalc : divulgados).filter(j =>
    (filtroRod==="Todas" || j.rodada===parseInt(filtroRod)) &&
    (filtroCat==="Todas" || j.categoria===filtroCat)
  ).sort((a,b) => a.rodada - b.rodada || a.id - b.id);

  const jogosFiltered = divulgados.filter(j =>
    (filtroRod==="Todas" || j.rodada===parseInt(filtroRod)) &&
    (filtroCat==="Todas" || j.categoria===filtroCat)
  );
  const totOrcJogos  = jogosFiltered.reduce((s,j) => s+subTotal(j.orcado), 0);
  const totProvJogos = jogosFiltered.reduce((s,j) => s+subTotal(j.provisionado), 0);

  const savingRodada = useMemo(() => {
    const map = {};
    divulgados.forEach(j => {
      const r = `R${j.rodada}`;
      if(!map[r]) map[r] = { name:r, Saving:0 };
      map[r].Saving += subTotal(j.orcado) - subTotal(j.provisionado);
    });
    return Object.values(map).sort((a,b) => parseInt(a.name.slice(1))-parseInt(b.name.slice(1)));
  }, [jogos]);

  const TABS_ORC  = ["dashboard","serviços","jogos","micro","savings","gráficos"];
  const TABS_NF   = ["notas fiscais","mensal","serviços livemode"];
  const TABS_REL  = ["apresentações","envio"];
  const TABS_LOG  = ["logística"];
  const TABS = setor === "orcamento" ? TABS_ORC : setor === "notas" ? TABS_NF : setor === "logistica" ? TABS_LOG : TABS_REL;

  const handleSetorChange = s => {
    // Fornecedores agora é um módulo do HUB — abre filtrado no campeonato atual
    if (s === "fornecedores") { onOpenHub && onOpenHub("brasileirao-2026"); return; }
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
    {k:"orcamento",    l:"Orçamento",            icon:LayoutDashboard},
    {k:"notas",        l:"Notas Fiscais",        icon:FileText},
    {k:"logistica",    l:"Logística",            icon:Truck},
    {k:"fornecedores", l:"Hub de Fornecedores →", icon:Users},
    {k:"relatorio",    l:"Relatório",            icon:ClipboardList},
  ];

  const setorAtual = SETORES.find(s => s.k === setor);

  return (
    <div className="page-enter" style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Poppins',sans-serif",display:"flex"}}>

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside style={{
        width:72,
        minHeight:"100vh",
        background: T.gradSidebar || "linear-gradient(180deg,#0a0f1a,#0f172a)",
        borderRight:"1px solid rgba(255,255,255,0.06)",
        display:"flex",
        flexDirection:"column",
        alignItems:"center",
        paddingTop:16,
        paddingBottom:16,
        gap:6,
        flexShrink:0,
        position:"sticky",
        top:0,
        height:"100vh",
      }}>
        {/* Livemode mark — clica para voltar */}
        <div style={{ marginBottom: 12 }}>
          <LivemodeLogo size={40} onClick={onBack} title="Voltar ao portal"/>
        </div>

        <div style={{ width:32, height:1, background:"rgba(255,255,255,0.06)", marginBottom:8 }}/>

        {/* setores */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {SETORES.map(s => (
            <IconButton key={s.k} icon={s.icon} title={s.l}
              active={setor===s.k}
              onClick={()=>handleSetorChange(s.k)}
              size={44} T={T}/>
          ))}
        </div>

        <div style={{ flex:1 }}/>

        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <IconButton
            icon={ocultar ? EyeOff : Eye}
            title={ocultar?"Mostrar valores":"Ocultar valores"}
            onClick={()=>setOcultar(o=>!o)}
            active={ocultar}
            size={40} T={T}
          />
          <IconButton
            icon={darkMode ? Sun : Moon}
            title={darkMode?"Modo claro":"Modo escuro"}
            onClick={()=>setDarkMode(d=>!d)}
            size={40} T={T}
          />
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <div style={{flex:1,minWidth:0,paddingBottom:40,background:T.bg}}>
        {/* Header corporativo */}
        <div style={{
          background: T.surface || T.card,
          borderBottom: `1px solid ${T.border}`,
          padding: "20px 32px 0",
        }}>
          <div style={{
            display:"flex",
            justifyContent:"space-between",
            alignItems:"flex-start",
            flexWrap:"wrap",
            gap:16,
            paddingBottom:18,
          }}>
            <div style={{ minWidth:0, display:"flex", alignItems:"center", gap:14 }}>
              {setorAtual?.icon && (
                <div style={{
                  width:42, height:42, borderRadius:12,
                  background: T.brandSoft || "rgba(16,185,129,0.12)",
                  border: `1px solid ${T.brandBorder || "rgba(16,185,129,0.28)"}`,
                  color: T.brand || "#10b981",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  flexShrink:0,
                }}>
                  <setorAtual.icon size={20} strokeWidth={2.25}/>
                </div>
              )}
              <div style={{ minWidth:0 }}>
                <p style={{
                  color: T.brand || "#65B32E",
                  fontSize: 10,
                  letterSpacing:"0.16em",
                  textTransform:"uppercase",
                  margin:"0 0 3px",
                  fontWeight:600,
                  fontFamily: FONT.ui,
                }}>Livemode · Transmissões · {setorAtual?.l}</p>
                <h1 style={{
                  fontFamily: FONT.display,
                  fontSize:22,
                  fontWeight:700,
                  margin:0,
                  color:T.text,
                  letterSpacing:"-0.005em",
                  lineHeight:1.1,
                }}>Brasileirão Série A 2026</h1>
                <p style={{ color:T.textMd, fontSize:12, margin:"4px 0 0" }}>
                  <span className="num" style={{ color:T.text, fontWeight:600 }}>{divulgados.length}</span> divulgados
                  <span style={{ color:T.border, margin:"0 8px" }}>·</span>
                  <span className="num" style={{ color:T.text, fontWeight:600 }}>{aDivulgar.length}</span> a divulgar
                  <span style={{ color:T.border, margin:"0 8px" }}>·</span>
                  <span className="num" style={{ color:T.text, fontWeight:600 }}>38</span> rodadas
                </p>
              </div>
            </div>

            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{
                display:"flex", alignItems:"center", gap:12,
                padding:"10px 18px",
                background: T.surfaceAlt || T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: RADIUS.lg,
              }}>
                <Wallet size={16} color={T.projetado || "#7C3AED"} strokeWidth={2.25}/>
                <div style={{ textAlign:"right" }}>
                  <p style={{ color:T.textSm, fontSize:10, margin:"0 0 2px", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>Orçado total campeonato</p>
                  <p className="num" style={{
                    fontFamily: FONT.display,
                    fontSize:22,
                    fontWeight:700,
                    color: T.projetado || "#7C3AED",
                    margin:0,
                    filter:ocultar?"blur(8px)":"none",
                    transition:"filter 0.2s",
                    letterSpacing:"-0.005em",
                    lineHeight:1,
                  }}>{fmt(11540692)}</p>
                </div>
              </div>

              <div style={{
                display:"flex", alignItems:"center", gap:12,
                padding:"10px 18px",
                background: T.surfaceAlt || T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: RADIUS.lg,
              }}>
                <Activity size={16} color={T.brand || "#65B32E"} strokeWidth={2.25}/>
                <div style={{ textAlign:"right" }}>
                  <p style={{ color:T.textSm, fontSize:10, margin:"0 0 2px", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>Execução geral</p>
                  <p className="num" style={{
                    fontFamily: FONT.display,
                    fontSize:22,
                    fontWeight:700,
                    color: pctGasto>80 ? (T.danger||"#DC2626") : (T.brand||"#65B32E"),
                    margin:0,
                    filter:ocultar?"blur(8px)":"none",
                    transition:"filter 0.2s",
                    letterSpacing:"-0.005em",
                    lineHeight:1,
                  }}>{pctGasto}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* tabs */}
          <div style={{
            display:"flex", gap:4, overflowX:"auto", WebkitOverflowScrolling:"touch",
            marginBottom:-1,
          }}>
            {TABS.map(t => {
              const isActive = tab===t;
              return (
                <button key={t} onClick={()=>setTab(t)} style={{
                  padding:"12px 16px",
                  border:"none",
                  borderBottom: `2px solid ${isActive ? (T.brand||"#65B32E") : "transparent"}`,
                  background:"transparent",
                  color: isActive ? T.text : T.textMd,
                  fontFamily: FONT.ui,
                  fontWeight: isActive ? 500 : 400,
                  fontSize:13,
                  cursor:"pointer",
                  whiteSpace:"nowrap",
                  textTransform:"capitalize",
                  flexShrink:0,
                  letterSpacing:"0",
                }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div key={tab} className="tab-content" style={{padding:"28px 32px",filter:ocultar?"blur(10px)":"none",transition:"filter 0.3s",userSelect:ocultar?"none":"auto"}}>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard" && (<>
          <div className="stagger" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:24}}>
            <Stat T={T} label="Total Orçado"       value={fmt(totalOrc)}           sub="Jogos + serviços fixos"                                           color={T.info}    icon={Wallet}     />
            <Stat T={T} label="Total Provisionado" value={fmt(totalProv)}          sub={`${totalOrc?((totalProv/totalOrc)*100).toFixed(1):0}% do orçado`} color={T.warning} icon={PiggyBank}  />
            <Stat T={T} label="Total Realizado"    value={fmt(totalReal)}          sub={`${pctGasto}% executado`}                                         color={T.success} icon={TrendingUp} />
            <Stat T={T} label="Projetado"          value={fmt(totalProjetado)}     sub={`Provisionado + ${(PLANO_JOGOS.b1+PLANO_JOGOS.b2s+PLANO_JOGOS.b2sul)-divulgados.length} jogos a divulgar`} color={T.projetado || "#7C3AED"}  icon={Target} />
          </div>
          <Card T={T}>
            <SectionHeader
              T={T}
              title="Resumo por Categoria"
              subtitle="Visão consolidada por natureza de despesa"
              icon={LayoutDashboard}
              right={
                <div style={{display:"flex",gap:10,fontSize:11,color:T.textMd}}>
                  <Badge color="#6366f1" T={T}>Fixo</Badge>
                  <Badge color="#f43f5e" T={T}>Variável</Badge>
                </div>
              }
            />
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}>
                <thead>
                  <tr style={{background:T.surfaceAlt||T.bg}}>
                    {["Categoria","Tipo","Orçado","Provisionado","Realizado","% Exec.","Progresso"].map(h => (
                      <th key={h} style={{
                        padding:"11px 16px",
                        textAlign:h==="Categoria"||h==="Tipo"?"left":"right",
                        color:T.textSm,
                        fontSize:10,
                        fontWeight:700,
                        letterSpacing:"0.06em",
                        textTransform:"uppercase",
                        whiteSpace:"nowrap",
                        borderBottom:`1px solid ${T.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESUMO_CATS.map(c => {
                    const saldo = c.orcado-c.realizado;
                    const pct   = c.orcado ? Math.min(100,(c.realizado/c.orcado)*100) : 0;
                    return (
                      <tr key={c.nome} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:"13px 16px",fontWeight:600,whiteSpace:"nowrap",color:T.text,fontSize:13}}>{c.nome}</td>
                        <td style={{padding:"13px 16px"}}><Pill label={c.tipo} color={TIPO_COLOR[c.tipo]}/></td>
                        <td className="num" style={{padding:"13px 16px",textAlign:"right",whiteSpace:"nowrap",color:T.text,fontSize:13}}>{fmt(c.orcado)}</td>
                        <td className="num" style={{padding:"13px 16px",textAlign:"right",color:T.warning||"#D97706",whiteSpace:"nowrap",fontSize:13}}>{fmt(c.provisionado||0)}</td>
                        <td className="num" style={{padding:"13px 16px",textAlign:"right",color:T.success||"#16A34A",whiteSpace:"nowrap",fontSize:13}}>{fmt(c.realizado)}</td>
                        <td className="num" style={{padding:"13px 16px",textAlign:"right",color:T.text,fontSize:13}}>{pct.toFixed(1)}%</td>
                        <td style={{padding:"13px 20px",minWidth:120}}>
                          <Progress value={pct} T={T}/>
                        </td>
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

        {/* ── ABAS ── */}
        {tab==="jogos"         && <TabJogos         jogos={jogosCalc} filtrados={filtrados} filtroRod={filtroRod} setFiltroRod={setFiltroRod} filtroCat={filtroCat} setFiltroCat={setFiltroCat} showPlaceholder={showPlaceholder} setShowPlaceholder={setShowPlaceholder} rodadasList={rodadasList} setMicroJogoId={setMicroJogoId} setTab={setTab} setNovo={setNovo} setNovoRapido={setNovoRapido} onDelete={deleteJogo} onEdit={editJogo} T={T}/>}
        {tab==="savings"       && <TabSavings       jogosFiltered={jogosFiltered} divulgados={divulgados} totOrcJogos={totOrcJogos} totProvJogos={totProvJogos} filtroRod={filtroRod} setFiltroRod={setFiltroRod} filtroCat={filtroCat} setFiltroCat={setFiltroCat} rodadasList={rodadasList} T={T}/>}
        {tab==="gráficos"      && <TabGraficos      divulgados={divulgados} savingRodada={savingRodada} RESUMO_CATS={RESUMO_CATS} T={T}/>}
        {tab==="micro"         && <VisaoMicro       jogos={jogosCalc} jogoId={microJogoId} onChangeJogo={setMicroJogoId} onSave={saveJogo} T={T}/>}
        {tab==="serviços"      && <TabServicos      servicos={servicosCalc} setServicos={setServicos} T={T}/>}
        {tab==="notas fiscais" && <TabNotas notas={notas} setNotas={setNotas} jogos={jogos} setJogos={setJogos} fornecedores={fornecedores} envios={envios} setEnvios={setEnvios} fornecedoresJogo={fornecedoresJogo} setFornecedoresJogo={setFornecedoresJogo} T={T}/>}
        {tab==="mensal" && <TabNotasMensal notas={notasMensais} setNotas={setNotasMensais} fornecedores={fornecedores} servicos={servicosCalc} T={T}/>}
        {tab==="serviços livemode" && <TabLivemode livemode={livemode} setLivemode={setLivemode} notasLivemode={notasLivemode} setNotasLivemode={setNotasLivemode} jogos={jogos} setJogos={setJogos} fornecedores={fornecedores} T={T}/>}
        {tab==="logística"     && <TabLogistica logistica={logistica} setLogistica={setLogistica} jogos={jogos} fornecedores={fornecedores} eventosLog={eventosLog} setEventosLog={setEventosLog} T={T}/>}
        {tab==="apresentações" && <TabApresentacoes jogos={divulgados} servicos={servicosCalc} notasMensais={notasMensais} T={T}/>}
        {tab==="envio"         && <TabEnvio jogos={jogosCalc} notas={notas} notasMensais={notasMensais} notasLivemode={notasLivemode} servicos={servicosCalc} envios={envios} setEnvios={setEnvios} T={T}/>}

      </div>

      {showNovo    && <NovoJogoModal   onSave={addJogo} onClose={()=>setNovo(false)} T={T}/>}
      {novoRapido  && <NovoRapidoModal cenario={novoRapido} jogos={jogos} onSave={addJogo} onClose={()=>setNovoRapido(null)} T={T}/>}
      {jogoEdit    && <NovoJogoModal   jogo={jogoEdit} onSave={handleEditSave} onClose={()=>setJogoEdit(null)} T={T}/>}

      </div>{/* /Main */}
    </div>
  );
}

// ─── TELA DE ACESSO ──────────────────────────────────────────────────────────
const LS_AUTH = "ffu_auth_v1";
const ACCESS_PIN = "2026hub";

function LoginGate({ onAuth, T }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState(false);

  const handleSubmit = e => {
    e.preventDefault();
    if (pin === ACCESS_PIN) {
      lsSet(LS_AUTH, true);
      onAuth();
    } else {
      setErro(true);
      setTimeout(() => setErro(false), 2000);
    }
  };

  return (
    <div className="page-enter" style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Poppins',sans-serif"}}>
      <div style={{width:"100%",maxWidth:400,padding:32}}>
        <div style={{ margin:"0 auto 24px", display:"flex", justifyContent:"center" }}>
          <LivemodeLogo size={56} radius={12}/>
        </div>
        <h1 style={{textAlign:"center",fontFamily: FONT.display,fontSize:26,fontWeight:700,color:T.text,margin:"0 0 6px",letterSpacing:"-0.005em"}}>HUB FINANCEIRO</h1>
        <p style={{textAlign:"center",color:T.textMd,fontSize:13,margin:"0 0 28px"}}>Acesso restrito — insira o código de acesso</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="Código de acesso"
            autoFocus
            style={{
              width:"100%",boxSizing:"border-box",
              background:T.surface||T.card,border:`1px solid ${erro ? (T.danger||"#DC2626") : T.borderStrong||T.muted}`,
              borderRadius:8,padding:"12px 16px",fontSize:15,color:T.text,
              fontFamily:"'Poppins',sans-serif",textAlign:"center",letterSpacing:"0.1em",
              transition:"border-color 0.2s",
            }}
          />
          {erro && <p style={{color:T.danger||"#DC2626",fontSize:12,textAlign:"center",margin:"8px 0 0",fontWeight:500}}>Código incorreto</p>}
          <button type="submit" style={{
            width:"100%",marginTop:16,
            background: T.brand || "#65B32E",
            color:"#fff",border:"none",borderRadius:7,padding:"10px",height:38,
            cursor:"pointer",fontWeight:500,fontSize:13,fontFamily: "'Poppins',sans-serif",
          }}>
            Entrar
          </button>
        </form>
        <p style={{textAlign:"center",color:T.textSm,fontSize:10,margin:"24px 0 0",letterSpacing:"0.08em",textTransform:"uppercase"}}>
          Livemode · Transmissões · 2026
        </p>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
import FormularioPublico from "./components/FormularioPublico";
import FormularioPublicoPaulistao from "./components/FormularioPublicoPaulistao";
import EnvioPublico from "./components/EnvioPublico";
import HubFornecedores from "./components/HubFornecedores";
import TabelaPrecoPublica from "./components/TabelaPrecoPublica";
import Paulistao from "./components/Paulistao";
import CampeonatoCustom from "./components/CampeonatoCustom";
import { NovoCampeonatoModal } from "./components/modals/NovoCampeonatoModal";
import { REGISTRY_KEY } from "./data/customCampeonato";
import { getState as getStateSb, setState as setStateSb } from "./lib/supabase";

export default function App() {
  const [darkMode, setDarkMode] = useState(() => lsGet(LS_DARK, true));
  const [pagina,   setPagina]   = useState("home");
  const [hubFiltro, setHubFiltro] = useState("todos"); // filtro pré-aplicado ao abrir o Hub de Fornecedores
  const [authed,   setAuthed]   = useState(() => lsGet(LS_AUTH, false));
  const [customCampeonatos, setCustomCampeonatos] = useState([]);
  const [showNovoCampModal, setShowNovoCampModal] = useState(false);
  const T = darkMode ? DARK : LIGHT;

  // Carrega o registry de campeonatos custom uma vez ao logar.
  useEffect(() => {
    if (!authed) return;
    let mounted = true;
    getStateSb(REGISTRY_KEY).then(arr => {
      if (mounted && Array.isArray(arr)) setCustomCampeonatos(arr);
    });
    return () => { mounted = false; };
  }, [authed]);

  const criarCampeonato = async ({ config, jogos, servicos }) => {
    // 1) Persiste estado inicial dos buckets do novo campeonato
    await Promise.all([
      setStateSb(`${config.id}_jogos`, jogos),
      setStateSb(`${config.id}_servicos`, servicos || []),
      setStateSb(`${config.id}_notas`, []),
      setStateSb(`${config.id}_notas_mensais`, []),
      setStateSb(`${config.id}_envios`, []),
      setStateSb(`${config.id}_livemode`, []),
      setStateSb(`${config.id}_notas_livemode`, []),
      setStateSb(`${config.id}_logistica`, []),
      setStateSb(`${config.id}_eventos_log`, []),
      setStateSb(`${config.id}_fornecedores_jogo`, {}),
    ]);
    // 2) Atualiza o registry global
    const next = [...customCampeonatos.filter(c => c.id !== config.id), config];
    setCustomCampeonatos(next);
    await setStateSb(REGISTRY_KEY, next);
    // 3) Fecha modal e navega
    setShowNovoCampModal(false);
    setPagina(`custom:${config.id}`);
  };

  const excluirCampeonato = async (id) => {
    const next = customCampeonatos.filter(c => c.id !== id);
    setCustomCampeonatos(next);
    await setStateSb(REGISTRY_KEY, next);
    // Os dados (`${id}_*`) ficam no Supabase para auditoria; podem ser limpos pelo painel.
  };

  const toggleDark = v => {
    const next = typeof v === "function" ? v(darkMode) : v;
    setDarkMode(next); lsSet(LS_DARK, next);
  };

  // Abre o Hub com filtro pré-aplicado (usado por shortcut de dentro de um campeonato)
  const abrirHubFornecedores = (filtro = "todos") => {
    setHubFiltro(filtro);
    setPagina("hub-fornecedores");
  };

  // Rotas públicas — acessíveis sem autenticação
  if (window.location.hash === "#formulario") return <FormularioPublico/>;
  if (window.location.hash === "#formulario-paulistao") return <FormularioPublicoPaulistao/>;
  const envioMatch = window.location.hash.match(/^#envio\/(\d+)$/);
  if (envioMatch) return <EnvioPublico numero={parseInt(envioMatch[1])}/>;
  const tabelaMatch = window.location.hash.match(/^#tabela\/([0-9a-fA-F-]+)$/);
  if (tabelaMatch) return <TabelaPrecoPublica token={tabelaMatch[1]}/>;

  // Tela de login para o HUB
  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} T={T}/>;

  if(pagina==="brasileirao-2026") return <Brasileirao onBack={()=>setPagina("home")} onOpenHub={abrirHubFornecedores} T={T} darkMode={darkMode} setDarkMode={toggleDark}/>;
  if(pagina==="paulistao-feminino-2026") return <Paulistao onBack={()=>setPagina("home")} onOpenHub={abrirHubFornecedores} T={T} darkMode={darkMode} setDarkMode={toggleDark}/>;
  if(pagina?.startsWith("custom:")) {
    const id = pagina.slice(7);
    const config = customCampeonatos.find(c => c.id === id);
    if (config) return <CampeonatoCustom config={config} onBack={()=>setPagina("home")} onOpenHub={abrirHubFornecedores} T={T} darkMode={darkMode} setDarkMode={toggleDark}/>;
    // Config não encontrado (ex: registry ainda carregando após reload). Volta ao home.
    setPagina("home");
    return null;
  }
  if(pagina==="hub-fornecedores") return <HubFornecedores onBack={()=>setPagina("home")} filtroInicial={hubFiltro} T={T} darkMode={darkMode} setDarkMode={toggleDark}/>;
  return (
    <>
      <Home
        onEnter={setPagina}
        onOpenHub={abrirHubFornecedores}
        T={T} darkMode={darkMode} setDarkMode={toggleDark}
        customCampeonatos={customCampeonatos}
        onCriarCampeonato={()=>setShowNovoCampModal(true)}
        onExcluirCampeonato={excluirCampeonato}
      />
      {showNovoCampModal && (
        <NovoCampeonatoModal
          T={T}
          onClose={()=>setShowNovoCampModal(false)}
          onSave={criarCampeonato}
        />
      )}
    </>
  );
}
