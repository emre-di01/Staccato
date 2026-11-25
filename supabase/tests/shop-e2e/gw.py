# Gateway (/rest/v1 → PostgREST, /auth/v1/user aus dem JWT), nachgebautes Stripe auf :8001 und SumUp auf :8002
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
            s=[x for x in ST['sessions'].values() if x['payment_intent']==f['payment_intent']][0]; weg=sum(r['amount'] for r in ST['refunds'].values() if r['payment_intent']==f['payment_intent']); amt=int(f.get('amount') or s['amount_total']-weg)
            if ST.get('ablehnen'): ST['idem'][ik]={'error':{'code':'insufficient'}}; return J({'error':{'code':'balance_insufficient','message':'kein Guthaben'}},400)
            if amt<=0 or weg+amt>s['amount_total']: return J({'error':{'code':'charge_already_refunded','message':'zu viel'}},400)
            r={'id':'re_'+uuid.uuid4().hex[:10],'amount':amt,'status':'succeeded','payment_intent':f['payment_intent'],'metadata':{'vorgang':f['metadata[vorgang]']} if 'metadata[vorgang]' in f else {}}; ST['refunds'][r['id']]=r
            if ST.get('verloren'): ST['verloren']=False; return J({'error':{'code':'api_error','message':'Antwort verloren'}},500)
            return merk(r)
        if path=='/v1/refunds' and 'payment_intent=' in self.path:
            pi=p.parse_qs(self.path.split('?')[1])['payment_intent'][0]; return J({'data':[r for r in ST['refunds'].values() if r['payment_intent']==pi]})
        if path=='/v1/webhook_endpoints' and self.command=='POST':
            w={'id':'we_'+uuid.uuid4().hex[:8],'secret':'whsec_'+uuid.uuid4().hex,'url':f['url']}; ST['webhooks'][w['id']]=w; return J(w)
        if path.startswith('/v1/webhook_endpoints/') and self.command=='DELETE': ST['webhooks'].pop(path.split('/')[-1],None); return J({'deleted':True})
        return J({'data':[]})
    do_GET=do_POST=do_PATCH=do_DELETE=do
SU={'checkouts':{},'tx':{},'refresh':'r0','access':{},'log':[],'fail':None,'haendler':{'MLIVE001':{'sandbox':False,'default_currency':'EUR'}},'scope':'payments transactions.history user.profile_readonly','verloren':False,'ablehnen':False,'entzogen':False,'n':0,'langsam':0,'verzoegert':False}
LOCK=threading.Lock()
class U(G):
    def do(self):
        n=int(self.headers.get('Content-Length') or 0); raw=self.rfile.read(n).decode() if n else ''; path=self.path.split('?')[0]; J=lambda d,c=200: self.out(c,json.dumps(d).encode(),'application/json')
        if path.startswith('/_'):
            b=json.loads(raw) if raw else {}
            if path=='/_state': return J(SU)
            if path=='/_set': SU.update(b); return J({})
            c=SU['checkouts'][b['id']]
            if path=='/_expire': c['status']='EXPIRED'; return J(c)
            t='tx-'+b['id']; c.update(status='PAID',transaction_id=t,transactions=[{'id':'tx-fehl','status':'FAILED'},{'id':t,'status':'SUCCESSFUL'}]); SU['tx'][t]={'id':t,'amount':c['amount'],'status':'SUCCESSFUL','simple_status':'SUCCESSFUL','transaction_events':[],'events':[]}; return J(c)
        SU['log'].append([self.command,path,raw])
        if path=='/token':
            f=dict(p.parse_qsl(raw))
            if f.get('client_secret')!='geheim': return J({'error':'invalid_client'},401)
            with LOCK:
                if f['grant_type']=='authorization_code' and not f['code'].startswith('gut'): return J({'error':'invalid_grant'},400)
                if f['grant_type']=='refresh_token' and (SU['entzogen'] or f['refresh_token']!=SU['refresh']): return J({'error':'invalid_grant'},400)
                SU['n']+=1; a='at%d'%SU['n']; SU['refresh']='r%d'%SU['n']; SU['access'][a]=True
            time.sleep(SU['langsam'])
            return J({'access_token':a,'refresh_token':SU['refresh'],'expires_in':SU.get('dauer',3600),'scope':SU['scope']})
        key=(self.headers.get('Authorization') or '')[7:]
        if not (key.startswith('sup_sk_') and 'FALSCH' not in key) and key not in SU['access']: return J({'message':'unauthorized'},401)
        if SU['fail'] and SU['fail'] in path: return J({'message':'geheime interne Meldung'},500)
        if path=='/v0.1/memberships': return J({'items':[{'type':'merchant','resource':{'id':k,'type':'merchant','name':'Haus '+k}} for k in SU['haendler']]+[{'type':'organization','resource':{'id':'ORG','type':'organization'}}]})
        if path.startswith('/v1/merchants/'):
            m=SU['haendler'].get(path.split('/')[-1]); return J({'merchant_code':path.split('/')[-1],**m}) if m else J({'title':'nf'},404)
        if path=='/v0.1/checkouts' and self.command=='GET': return J([]) if 'KEINRECHT' not in key else J({'message':'forbidden'},403)
        if path=='/v0.1/checkouts':
            b=json.loads(raw)
            if any(c['checkout_reference']==b['checkout_reference'] for c in SU['checkouts'].values()): return J({'error_code':'DUPLICATED_CHECKOUT'},409)
            i=str(uuid.uuid4()); SU['checkouts'][i]={**b,'id':i,'status':'PENDING','hosted_checkout_url':'https://checkout.sumup.test/pay/'+i,'transactions':[]}; return J(SU['checkouts'][i],201)
        if path.startswith('/v0.1/checkouts/'):
            c=SU['checkouts'].get(path.split('/')[-1])
            if not c: return J({'error_code':'NOT_FOUND'},404)
            if self.command=='DELETE':
                if c['status']!='PENDING': return J({'error_code':'CHECKOUT_PROCESSED'},409)
                c['status']='EXPIRED'
            return J(c)
        if path.startswith('/v2.1/merchants/'):
            t=SU['tx'].get(p.parse_qs(self.path.split('?')[1])['id'][0]); 
            if t and SU['verzoegert']: t={**t,'transaction_events':[],'events':[]}
            return J(t) if t else J({'title':'nf'},404)
        if path.endswith('/refunds'):
            t=SU['tx'][path.split('/')[-2]]; b=json.loads(raw) if raw else {}
            with LOCK:
                weg=sum(round(e['amount']*100) for e in t['transaction_events']); amt=b.get('amount') or round(t['amount']*100)-weg
                if SU['ablehnen']: return J({'title':'Bad Request'},400)
                if amt<=0 or weg+amt>round(t['amount']*100): return J({'title':'zu viel'},400)
                t['transaction_events'].append({'event_type':'REFUND','status':'REFUNDED','amount':amt/100}); t['events'].append({'type':'REFUND','status':'REFUNDED','amount':amt/100})
            time.sleep(0.2)
            if SU['verloren']: SU['verloren']=False; return J({'title':'weg'},502)
            return J({},201)
        return J({'title':'nf'},404)
    do_GET=do_POST=do_PATCH=do_DELETE=do
threading.Thread(target=ThreadingHTTPServer(('0.0.0.0',8002),U).serve_forever,daemon=True).start()
threading.Thread(target=ThreadingHTTPServer(('0.0.0.0',8001),T).serve_forever,daemon=True).start()
ThreadingHTTPServer(('0.0.0.0',8000),G).serve_forever()
