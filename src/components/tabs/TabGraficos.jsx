import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { CustomTooltip } from "../shared";
import { fmt, fmtK, subTotal } from "../../utils";
import { PIE_COLORS } from "../../constants";

export default function TabGraficos({ divulgados, savingRodada, RESUMO_CATS, T }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:20}}>

      {/* Saving por Rodada */}
      <div style={{background:T.card,borderRadius:12,padding:20}}>
        <h3 style={{margin:"0 0 16px",fontSize:14,color:T.textMd}}>Saving por Rodada</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={savingRodada}>
            <XAxis dataKey="name" tick={{fill:T.textMd,fontSize:11}}/>
            <YAxis tickFormatter={fmtK} tick={{fill:T.textMd,fontSize:11}}/>
            <Tooltip content={<CustomTooltip T={T}/>}/>
            <Bar dataKey="Saving" fill="#22c55e" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Distribuição do Budget */}
      <div style={{background:T.card,borderRadius:12,padding:20}}>
        <h3 style={{margin:"0 0 16px",fontSize:14,color:T.textMd}}>Distribuição do Budget</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={RESUMO_CATS.map(c=>({name:c.nome,value:c.orcado}))}
              cx="50%" cy="50%" outerRadius={90} dataKey="value"
              label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
              labelLine={false}
            >
              {RESUMO_CATS.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
            </Pie>
            <Tooltip formatter={v=>fmt(v)}/>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Orçado por Jogo B1 vs B2 */}
      <div style={{background:T.card,borderRadius:12,padding:20}}>
        <h3 style={{margin:"0 0 16px",fontSize:14,color:T.textMd}}>Orçado por Jogo — B1 vs B2</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={divulgados.map(j=>({name:`R${j.rodada} ${j.mandante.split(" ")[0]}`,valor:subTotal(j.orcado),cat:j.categoria}))}>
            <XAxis dataKey="name" tick={{fill:T.textMd,fontSize:9}}/>
            <YAxis tickFormatter={fmtK} tick={{fill:T.textMd,fontSize:11}}/>
            <Tooltip content={<CustomTooltip T={T}/>}/>
            <Bar dataKey="valor" radius={[4,4,0,0]}>
              {divulgados.map(j => <Cell key={j.id} fill={j.categoria==="B1"?"#22c55e":"#f59e0b"}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
