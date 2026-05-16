// Shared inline-style constants for StueckDetail sub-components
export const s = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  modal:       { background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'28px 32px 0', flexShrink:0 },
  modalBody:   { overflowY:'auto', flex:1, padding:'24px 32px 28px', overscrollBehavior:'contain' },
  modalTitel:  { margin:0, fontSize:18, fontWeight:800, color:'var(--text)' },
  iconBtn:     { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 },
  label:       { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  sectionLabel:{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 },
  input:       { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%', boxSizing:'border-box' },
  btnPri:      { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:      { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  leer:        { padding:'32px', textAlign:'center', color:'var(--text-3)', fontSize:13, background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px dashed var(--border)' },
}
