import{j as e}from"./vendor-misc-3X49e_Sp.js";import{r,N as P}from"./vendor-react-Cc_9tIgx.js";import{u as M,s as L,C as c,T as q,a as z,b as k}from"./index-CcQ1SZyl.js";import"./vendor-supabase-Bad_8zXo.js";const _=[["♩",8,9,0,28,.18],["♪",18,12,2,18,.14],["♫",30,8,5,36,.16],["♬",45,11,1,22,.2],["𝄞",58,7,3.5,42,.12],["♩",68,10,.5,16,.15],["♪",78,13,4,30,.13],["♫",88,9,2.5,20,.17],["♬",52,14,7,14,.12],["𝄢",22,8,6,38,.1],["♩",92,11,1.5,24,.14],["♪",38,10,8,18,.16]];function J(){const{session:D,rolle:T,laden:C,T:i,theme:E,darkMode:b,changeTheme:F,toggleDark:I,lang:o,setLang:N}=M(),[v,R]=r.useState(""),[j,W]=r.useState(""),[l,s]=r.useState(""),[a,d]=r.useState(!1),[B,S]=r.useState("login"),[w,H]=r.useState(""),[A,p]=r.useState(!1);if(!C&&D)return e.jsx(P,{to:L(T),replace:!0});async function $(t){t.preventDefault(),d(!0),s("");const{error:n}=await k.auth.signInWithPassword({email:v,password:j});n&&s(i("login_error")),d(!1)}async function O(t){t.preventDefault(),d(!0),s("");const{error:n}=await k.auth.resetPasswordForEmail(w,{redirectTo:window.location.origin+"/passwort-zuruecksetzen"});n?s(i("reset_email_error")):p(!0),d(!1)}return e.jsxs("div",{className:"login-wrapper",style:{minHeight:"100vh",display:"flex",background:"var(--bg)",fontFamily:"'Outfit', 'DM Sans', sans-serif"},children:[e.jsxs("div",{className:"login-mobile-header",children:[_.slice(0,6).map(([t,n,g,x,m,f],h)=>e.jsx("span",{className:"float-note",style:{left:`${n}%`,fontSize:m,animationDuration:`${g}s`,animationDelay:`${-x}s`,opacity:f},children:t},h)),e.jsxs("div",{style:{position:"relative",display:"flex",alignItems:"center",gap:12},children:[e.jsx("div",{className:"logo-pulse",style:{fontSize:36},children:"♩"}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:22,fontWeight:800,letterSpacing:"-0.5px"},children:"Staccato"}),e.jsx("div",{style:{fontSize:12,opacity:.7},children:i("app_tagline")})]})]})]}),e.jsxs("div",{style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(150deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 65%, #000) 100%)",color:"var(--primary-fg)",padding:48,position:"relative",overflow:"hidden"},className:"login-left",children:[_.map(([t,n,g,x,m,f],h)=>e.jsx("span",{className:"float-note",style:{left:`${n}%`,fontSize:m,animationDuration:`${g}s`,animationDelay:`${-x}s`,opacity:f},children:t},h)),e.jsx("div",{style:{position:"absolute",width:400,height:400,borderRadius:"50%",background:"rgba(255,255,255,0.06)",top:-100,right:-100,filter:"blur(60px)",pointerEvents:"none"}}),e.jsx("div",{style:{position:"absolute",width:300,height:300,borderRadius:"50%",background:"rgba(255,255,255,0.04)",bottom:-80,left:-60,filter:"blur(50px)",pointerEvents:"none"}}),e.jsxs("div",{style:{position:"relative",textAlign:"center",width:"100%",maxWidth:360},children:[e.jsx("div",{className:"logo-pulse",style:{fontSize:72,marginBottom:12},children:"♩"}),e.jsx("div",{style:{fontSize:44,fontWeight:800,letterSpacing:"-1.5px",marginBottom:6},children:"Staccato"}),e.jsx("div",{style:{fontSize:15,opacity:.65,letterSpacing:"0.01em"},children:i("app_tagline")}),e.jsxs("div",{style:{marginTop:40,textAlign:"left",background:"rgba(255,255,255,0.1)",borderRadius:16,padding:"20px 20px 16px",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.18)"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:14},children:[e.jsx("span",{style:{fontSize:16},children:"✨"}),e.jsxs("span",{style:{fontSize:12,fontWeight:700,opacity:.9,textTransform:"uppercase",letterSpacing:"0.08em"},children:[i("whats_new_login_label")," · v",c[0].version]})]}),e.jsx("ul",{style:{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:8},children:c[0].features.map((t,n)=>e.jsxs("li",{style:{display:"flex",alignItems:"flex-start",gap:10},children:[e.jsx("span",{style:{fontSize:15,lineHeight:1.45,flexShrink:0},children:t.icon}),e.jsx("span",{style:{fontSize:13,opacity:.85,lineHeight:1.5},children:t[o]??t.de})]},n))})]})]})]}),e.jsxs("main",{style:{width:420,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:48,background:"var(--surface)"},className:"login-right",children:[e.jsx("div",{style:{display:"flex",gap:8,marginBottom:32,alignSelf:"flex-end"},children:["de","en","tr"].map(t=>e.jsx("button",{onClick:()=>N(t),style:{padding:"4px 10px",borderRadius:8,border:"1px solid var(--border)",background:o===t?"var(--accent)":"transparent",color:o===t?"var(--accent-fg)":"var(--text-3)",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:o===t?700:400},children:t.toUpperCase()},t))}),e.jsxs("div",{style:{width:"100%",maxWidth:340},children:[B==="login"?e.jsxs(e.Fragment,{children:[e.jsx("h1",{style:{fontSize:26,fontWeight:800,color:"var(--text)",marginBottom:8,letterSpacing:"-0.5px"},children:i("login_title")}),e.jsx("p",{style:{color:"var(--text-3)",fontSize:14,marginBottom:32},children:i("login_sub")}),e.jsxs("form",{onSubmit:$,style:{display:"flex",flexDirection:"column",gap:16},children:[e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:6},children:[e.jsx("label",{style:u,children:i("email")}),e.jsx("input",{type:"email",value:v,onChange:t=>R(t.target.value),required:!0,placeholder:"name@beispiel.de",style:y})]}),e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:6},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"},children:[e.jsx("label",{style:u,children:i("password")}),e.jsx("button",{type:"button",onClick:()=>{S("reset"),s(""),p(!1)},style:{fontSize:12,color:"var(--primary)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0},children:i("forgot_password")})]}),e.jsx("input",{type:"password",value:j,onChange:t=>W(t.target.value),required:!0,placeholder:"••••••••",style:y})]}),l&&e.jsx("p",{style:{color:"var(--danger)",fontSize:13,margin:0},children:l}),e.jsx("button",{type:"submit",disabled:a,style:{marginTop:8,padding:"13px",borderRadius:"var(--radius)",border:"none",background:"var(--primary)",color:"var(--primary-fg)",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:a?.7:1,transition:"opacity 0.15s"},children:i(a?"loading":"login_btn")})]}),e.jsx("p",{style:{marginTop:24,fontSize:12,color:"var(--text-3)",textAlign:"center"},children:i("no_access")})]}):e.jsxs(e.Fragment,{children:[e.jsxs("button",{type:"button",onClick:()=>{S("login"),s(""),p(!1)},style:{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"var(--text-3)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:24},children:["← ",i("back_to_login")]}),e.jsx("h1",{style:{fontSize:26,fontWeight:800,color:"var(--text)",marginBottom:8,letterSpacing:"-0.5px"},children:i("reset_email_title")}),e.jsx("p",{style:{color:"var(--text-3)",fontSize:14,marginBottom:32},children:i("reset_email_sub")}),A?e.jsx("div",{style:{background:"color-mix(in srgb, var(--success) 15%, transparent)",border:"1px solid var(--success)",borderRadius:"var(--radius)",padding:"14px 16px",color:"var(--success)",fontSize:14},children:i("reset_email_sent")}):e.jsxs("form",{onSubmit:O,style:{display:"flex",flexDirection:"column",gap:16},children:[e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:6},children:[e.jsx("label",{style:u,children:i("email")}),e.jsx("input",{type:"email",value:w,onChange:t=>H(t.target.value),required:!0,placeholder:"name@beispiel.de",style:y,autoFocus:!0})]}),l&&e.jsx("p",{style:{color:"var(--danger)",fontSize:13,margin:0},children:l}),e.jsx("button",{type:"submit",disabled:a,style:{marginTop:8,padding:"13px",borderRadius:"var(--radius)",border:"none",background:"var(--primary)",color:"var(--primary-fg)",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:a?.7:1,transition:"opacity 0.15s"},children:i(a?"loading":"reset_email_btn")})]})]}),e.jsx("div",{className:"login-whats-new",style:{marginTop:28},children:e.jsxs("div",{style:{paddingTop:24,borderTop:"1px solid var(--border)"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:12},children:[e.jsx("span",{style:{fontSize:14},children:"✨"}),e.jsxs("span",{style:{fontSize:11,fontWeight:700,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em"},children:[i("whats_new_login_label")," · v",c[0].version]})]}),e.jsx("ul",{style:{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:8},children:c[0].features.map((t,n)=>e.jsxs("li",{style:{display:"flex",alignItems:"flex-start",gap:10},children:[e.jsx("span",{style:{fontSize:15,lineHeight:1.4,flexShrink:0},children:t.icon}),e.jsx("span",{style:{fontSize:13,color:"var(--text-2)",lineHeight:1.5},children:t[o]??t.de})]},n))})]})}),e.jsxs("div",{style:{marginTop:32,paddingTop:24,borderTop:"1px solid var(--border)"},children:[e.jsx("div",{style:{fontSize:11,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10},children:i("theme")}),e.jsxs("div",{style:{display:"flex",gap:6,flexWrap:"wrap"},children:[q.map(t=>e.jsx("button",{onClick:()=>F(t),title:z[t].name.de,style:{width:32,height:32,borderRadius:8,border:`2px solid ${E===t?"var(--accent)":"var(--border)"}`,background:"var(--bg-2)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},children:z[t].icon},t)),e.jsx("button",{onClick:I,title:b?"Hell":"Dunkel",style:{width:32,height:32,borderRadius:8,border:"1px solid var(--border)",background:"var(--bg-2)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},children:b?"☀️":"🌙"})]})]})]})]}),e.jsxs("div",{style:{position:"fixed",bottom:0,left:0,right:0,textAlign:"center",padding:"10px",fontSize:12,color:"var(--text-3)",display:"flex",justifyContent:"center",gap:16,zIndex:10},children:[e.jsx("a",{href:"/impressum",style:{color:"var(--text-3)",textDecoration:"none"},children:"Impressum"}),e.jsx("a",{href:"/datenschutz",style:{color:"var(--text-3)",textDecoration:"none"},children:"Datenschutz"})]}),e.jsx("style",{children:`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }

        /* Floating notes */
        .float-note {
          position: absolute;
          bottom: -60px;
          animation: floatUp linear infinite;
          pointer-events: none;
          user-select: none;
          will-change: transform, opacity;
        }
        @keyframes floatUp {
          0%   { transform: translateY(0)   rotate(0deg);   opacity: inherit; }
          15%  { opacity: inherit; }
          85%  { opacity: inherit; }
          100% { transform: translateY(-110vh) rotate(20deg); opacity: 0; }
        }

        /* Logo pulse */
        .logo-pulse {
          display: inline-block;
          animation: logoPulse 3s ease-in-out infinite;
        }
        @keyframes logoPulse {
          0%, 100% { transform: scale(1);    }
          50%       { transform: scale(1.08); }
        }

        /* Mobile header */
        .login-mobile-header {
          display: none;
        }

        .login-whats-new { display: none; }

        @media (max-width: 640px) {
          .login-wrapper {
            flex-direction: column;
          }
          .login-left  { display: none !important; }
          .login-right {
            width: 100% !important;
            flex: 1;
            justify-content: flex-start !important;
            padding-top: 32px !important;
          }
          .login-whats-new { display: block; }
          .login-mobile-header {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            background: linear-gradient(150deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 65%, #000) 100%);
            color: var(--primary-fg);
            padding: 28px 24px;
            width: 100%;
            flex-shrink: 0;
          }
        }
      `})]})}const u={fontSize:13,fontWeight:600,color:"var(--text-2)"},y={padding:"11px 14px",borderRadius:"var(--radius)",border:"1.5px solid var(--border)",fontSize:14,outline:"none",fontFamily:"inherit",background:"var(--bg)",color:"var(--text)",width:"100%",transition:"border-color 0.15s"};export{J as default};
//# sourceMappingURL=LoginPage-DJFHmBoB.js.map
