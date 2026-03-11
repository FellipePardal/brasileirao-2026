import { fmt } from "../utils";

export const Pill = ({label, color}) => (
  <span style={{background:color+"22",color,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>
);

export const KPI = ({label, value, sub, color, T}) => (
  <div style={{background:T.card,borderRadius:12,padding:"18px 20px",borderLeft:`4px solid ${color}`}}>
    <p style={{color:T.textMd,fontSize:12,marginBottom:6}}>{label}</p>
    <p style={{fontSize:20,fontWeight:700,color,marginBottom:2}}>{value}</p>
    <p style={{color:T.textSm,fontSize:11}}>{sub}</p>
  </div>
);

export const CustomTooltip = ({active, payload, label, T}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px"}}>
      <p style={{color:T.textMd,marginBottom:6,fontWeight:600}}>{label}</p>
      {payload.map(p => <p key={p.name} style={{color:p.fill||p.color,margin:"2px 0"}}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};
