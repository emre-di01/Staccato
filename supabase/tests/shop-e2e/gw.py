# Gateway (/rest/v1 → PostgREST, /auth/v1/user aus dem JWT) und nachgebautes Stripe auf :8001
import json,base64,threading,time,urllib.request as u,urllib.parse as p,uuid,hmac,hashlib
from http.server import *
ST={'sessions':{},'refunds':{},'webhooks':{},'idem':{},'log':[],'fail':None,'norights':[]}
class G(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do(self):
        n=int(self.headers.get('Content-Length') or 0); body=self.rfile.read(n) if n else None
        if self.path.startswith('/auth/v1/user'):
            t=(self.headers.get('Authorization') or '').replace('Bearer ','').split('.')
            try: c=json.loads(base64.urlsafe_b64decode(t[1]+'=='))
            except Exception: c={}
            return self.out(200 if c.get('sub') else 401, json.dumps({'id':c.get('sub'),'email':'x@example.test'}).encode(),'application/json')
        if self.path.startswith('/rest/v1'):
            h={k:v for k,v in self.headers.items() if k.lower() not in('host','content-length','apikey')}
            try: r=u.urlopen(u.Request('http://t-rest:3000'+self.path[8:],data=body,headers=h,method=self.command)); self.out(r.status,r.read(),r.headers.get('Content-Type') or 'application/json')
            except u.HTTPError as e: self.out(e.code,e.read(),'application/json')
            return
        self.out(404,b'{}','application/json')
    def out(self,c,b,t): self.send_response(c); self.send_header('Content-Type',t); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    do_GET=do_POST=do_PATCH=do_DELETE=do
class T(G):
    def do(self):
        n=int(self.headers.get('Content-Length') or 0); raw=self.rfile.read(n).decode() if n else ''; f=dict(p.parse_qsl(raw)); path=self.path.split('?')[0]; J=lambda d,c=200: self.out(c,json.dumps(d).encode(),'application/json')
        if path.startswith('/_'):
            if path=='/_state': return J(ST)
            if path=='/_set': ST.update(json.loads(raw)); return J({})
            if path=='/_pay': s=ST['sessions'][f['id']]; s.update(payment_status='paid',status='complete',payment_intent='pi_'+f['id'][3:]); return J(s)
        ST['log'].append([self.command,path,f,self.headers.get('Idempotency-Key')])
        key=(self.headers.get('Authorization') or '')[7:]
        if 'FALSCH' in key: return J({'error':{'code':'invalid','message':'Invalid API Key'}},401)
        if any(x in path for x in ST['norights']): return J({'error':{'code':'permission','message':'no permission'}},403)
        if ST['fail'] and ST['fail'] in path: return J({'error':{'code':'api_error','message':'geheime interne Meldung'}},500)
        ik=self.headers.get('Idempotency-Key')
        if ik and ik in ST['idem']: return J(ST['idem'][ik])
        def merk(d):
            if ik: ST['idem'][ik]=d
            return J(d)
        if path=='/v1/checkout/sessions' and self.command=='POST':
            i='cs_'+uuid.uuid4().hex[:12]; amt=int(f['line_items[0][quantity]'])*int(f['line_items[0][price_data][unit_amount]'])
            ST['sessions'][i]={'id':i,'url':'https://checkout.stripe.test/'+i,'client_reference_id':f['client_reference_id'],'payment_status':'unpaid','status':'open','amount_total':amt,'currency':f['line_items[0][price_data][currency]'],'payment_intent':None,'form':f}; return merk(ST['sessions'][i])
        if path.endswith('/expire'):
            s=ST['sessions'][path.split('/')[-2]]
            if s['status']!='open': return J({'error':{'code':'x','message':'not open'}},400)
            s['status']='expired'; return J(s)
        if path.startswith('/v1/checkout/sessions/'): return J(ST['sessions'][path.split('/')[-1]])
        if path=='/v1/refunds' and self.command=='POST':
            s=[x for x in ST['sessions'].values() if x['payment_intent']==f['payment_intent']][0]; r={'id':'re_'+uuid.uuid4().hex[:10],'amount':s['amount_total']}; ST['refunds'][r['id']]=f['payment_intent']; return merk(r)
        if path=='/v1/webhook_endpoints' and self.command=='POST':
            w={'id':'we_'+uuid.uuid4().hex[:8],'secret':'whsec_'+uuid.uuid4().hex,'url':f['url']}; ST['webhooks'][w['id']]=w; return J(w)
        if path.startswith('/v1/webhook_endpoints/') and self.command=='DELETE': ST['webhooks'].pop(path.split('/')[-1],None); return J({'deleted':True})
        return J({'data':[]})
    do_GET=do_POST=do_PATCH=do_DELETE=do
threading.Thread(target=ThreadingHTTPServer(('0.0.0.0',8001),T).serve_forever,daemon=True).start()
ThreadingHTTPServer(('0.0.0.0',8000),G).serve_forever()
