import json,urllib.request as u,urllib.error,hmac,hashlib,time,subprocess,os,sys,concurrent.futures as cf
S=os.path.dirname(os.path.abspath(__file__)); env=dict(l.strip().split('=',1) for l in open(S+'/e2e.env'))
SCH='81111111-1111-1111-1111-111111111111'; EV='83000000-0000-0000-0000-000000000001'; ok=bad=0
def req(url,data=None,h={},m=None):
    r=u.Request(url,data=data if isinstance(data,bytes) or data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json',**h},method=m or ('POST' if data is not None else 'GET'))
    try: x=u.urlopen(r,timeout=60); b=x.read(); c=x.status
    except urllib.error.HTTPError as e: b=e.read(); c=e.code
    try: return c,json.loads(b)
    except Exception: return c,b.decode()
F='http://127.0.0.1:19000/'
def shop(h={},**d): return req(F+'shop',d,h)
def konto(who='U20',**d): return req(F+'zahlungskonto',{'schule_id':SCH,**d},{'Authorization':'Bearer '+env[who]} if who else {})
def st(): return req('http://127.0.0.1:18001/_state')[1]
def setz(**d): req('http://127.0.0.1:18001/_set',d)
def pay(i): return req('http://127.0.0.1:18001/_pay',('id='+i).encode())[1]
def sql(q): return subprocess.run(['docker','exec','-i','staccato_ticket_test','psql','-U','postgres','-h','127.0.0.1','-qtA','postgres'],input=q,text=True,capture_output=True).stdout.strip()
def mails(): return req('http://127.0.0.1:18025/api/v1/messages')[1]
def t(n,c,x=''):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print('FEHLER',n,str(x)[:300])
def hook(secret,typ,obj,schule=SCH,ts=None,live=True,sig=None):
    b=json.dumps({'type':typ,'livemode':live,'data':{'object':obj}}).encode(); ts=ts or int(time.time())
    s=sig or hmac.new(secret.encode(),f'{ts}.'.encode()+b,hashlib.sha256).hexdigest()
    return req(F+'stripe-webhook?schule='+schule,b,{'stripe-signature':f't={ts},v1={s}'})[0]
def kauf(n=1,mail='gast@example.test',ip='203.0.113.5',**k): return shop({'X-Forwarded-For':ip+', 172.18.0.1'},**{**dict(aktion='kaufen',event_id=EV,anzahl=n,betrag=15*n,name='Gast Öz',email=mail,sprache='de',agb=True),**k})

# Schlüssel
t('ohne Anmeldung',konto(None,aktion='verbinden',schluessel='rk_live_abcdefghijkl')[0]==401)
t('Schüler darf nicht',konto('U01',aktion='verbinden',schluessel='rk_live_abcdefghijkl')[0]==403)
t('Vollzugriff abgelehnt',konto(aktion='verbinden',schluessel='sk_test_abcdefghijkl')[1]['grund']=='vollzugriff')
t('Format',konto(aktion='verbinden',schluessel='quatsch')[1]['grund']=='format')
t('ungültiger Schlüssel',konto(aktion='verbinden',schluessel='rk_live_FALSCHabcdefg')[1]['grund']=='ungueltig')
setz(norights=['refunds']); t('fehlende Rechte',konto(aktion='verbinden',schluessel='rk_live_abcdefghijkl')[1]['grund']=='rechte')
setz(norights=['webhook_endpoints']); r=konto(aktion='verbinden',schluessel='rk_live_abcdefghijkl')[1]; t('Webhook von Hand nötig',r['grund']=='webhook_noetig' and r['url'].startswith('https://api.example.test/functions/v1/stripe-webhook?schule='+SCH),r)
t('mit Webhook-Geheimnis von Hand',konto(aktion='verbinden',schluessel='rk_live_abcdefghijkl',webhook_geheim='whsec_'+'a'*20)[1].get('ok') is True)
setz(norights=[]); r=konto(aktion='verbinden',schluessel='rk_live_GeheimerSchluessel1234')[1]; t('verbunden',r=={'ok':True,'livemode':True,'letzte4':'1234'},r)
r=konto(aktion='verbinden',schluessel='rk_live_GeheimerSchluessel5678')[1]; t('neu verbinden räumt alten Webhook weg',r.get('ok') and len(st()['webhooks'])==1,st()['webhooks'])
t('DB enthält keinen Klartext','GeheimerSchluessel' not in sql("select schluessel||webhook_geheim from schul_zahlungskonten") and sql("select count(*) from schul_zahlungskonten where schluessel like 'v1:%'")=='1')
sec=list(st()['webhooks'].values())[0]['secret']
t('REST liefert keine Schlüssel',req('http://127.0.0.1:18000/rest/v1/schul_zahlungskonten',None,{'Authorization':'Bearer '+env['U20']})[1]==[])
# Angebot
r=shop(aktion='info',slug='probe')[1]; t('Angebot',len(r['events'])==1 and r['events'][0]['lage']['preis']==15 and 'bild_pfad' not in r['events'][0],r)
t('unbekannter Shop',shop(aktion='info',slug='nix-da')[0]==404); t('Slug-Unsinn',shop(aktion='info',slug="x' or 1=1")[0]==404)
# Kauf
t('ohne AGB',kauf(agb=False)[1]['grund']=='angaben'); t('Honigtopf',kauf(website='x')[1]['grund']=='angaben'); t('Preis manipuliert',kauf(betrag=1)[1]['grund']=='betrag'); t('Anzahl als Text',kauf(anzahl='1')[1]['grund']=='anzahl')
c,k=kauf(2); t('Kauf',k.get('ok') and k['url'].startswith('https://checkout'),k); z=k['zugang']; cs=k['url'].split('/')[-1]; f=st()['sessions'][cs]['form']
t('Stripe-Angaben',f['line_items[0][price_data][unit_amount]']=='1500' and f['mode']=='payment' and f['success_url'].endswith(z) and 1800<int(f['expires_at'])-time.time()<1900 and f['customer_email']=='gast@example.test',f)
o=shop(aktion='bestellung',zugang=z)[1]; t('vor Zahlung keine Codes',o['status']=='reserviert' and all(x['code'] is None for x in o['tickets']),o); t('keine internen Felder',not {'checkout_id','schule_id','id'}&set(o))
t('falscher Zugang',shop(aktion='bestellung',zugang='a'*64)[0]==404 and shop(aktion='bestellung',zugang='x')[0]==404)
s=pay(cs)
t('Webhook ohne Signatur',req(F+'stripe-webhook?schule='+SCH,b'{}')[0]==400); t('falsche Signatur',hook(sec,'checkout.session.completed',s,sig='0'*64)==400); t('fremdes Geheimnis',hook('whsec_x','checkout.session.completed',s)==400)
t('alte Signatur',hook(sec,'checkout.session.completed',s,ts=int(time.time())-900)==400); t('Livemode passt nicht',hook(sec,'checkout.session.completed',s,live=False)==400); t('andere Schule',hook(sec,'checkout.session.completed',s,schule='72222222-2222-2222-2222-222222222222')==400)
t('bis hier nichts bezahlt',sql("select count(*) from ticket_zahlungen")=='0')
with cf.ThreadPoolExecutor(6) as ex: rs=list(ex.map(lambda _:hook(sec,'checkout.session.completed',s),range(6)))
t('6x Webhook gleichzeitig',all(x==200 for x in rs),rs); t('eine Zahlung, 2 Tickets',sql("select count(*) from ticket_zahlungen")=='1' and sql("select count(*) from tickets where status='gueltig'")=='2')
time.sleep(1); m=mails(); t('genau eine Mail',m['total']==1 and m['messages'][0]['To'][0]['Address']=='gast@example.test',m)
x=req('http://127.0.0.1:18025/api/v1/message/'+m['messages'][0]['ID'])[1]; t('Mail mit Link und 2 QR','/shop/bestellung/'+z in x['HTML'] and len(x['Inline'])==2 and 'Gast Öz' in x['HTML'])
o=shop(aktion='bestellung',zugang=z)[1]; t('Link zeigt Tickets',o['status']=='bezahlt' and all(len(q['code'])==32 for q in o['tickets']),o)
# Webhook fehlt → Rückfrage
c,k=kauf(1,'ohne@example.test'); cs=k['url'].split('/')[-1]; pay(cs); o=shop(aktion='bestellung',zugang=k['zugang'])[1]; t('ohne Webhook per Rückfrage',o['status']=='bezahlt',o); t('zweite Mail',mails()['total']==2)
# Abbruch
c,k=kauf(1,'ab@example.test'); t('voll',kauf(1,'voll@example.test',ip='203.0.113.6')[1]['grund']=='ausverkauft'); o=shop(aktion='abbrechen',zugang=k['zugang'])[1]; t('Abbruch',o['status']=='verfallen' and st()['sessions'][k['url'].split('/')[-1]]['status']=='expired',o)
c,k2=kauf(1,'neu@example.test'); t('Platz wieder frei',k2.get('ok'),k2); cs2=k2['url'].split('/')[-1]; pay(cs2); o=shop(aktion='abbrechen',zugang=k2['zugang'])[1]; t('Abbruch nach Zahlung: bleibt bezahlt',o['status']=='bezahlt',o)
# zu spät + ausverkauft → Erstattung
sql("update ticket_einstellungen set kapazitaet=5 where event_id='%s'"%EV); c,k=kauf(1,'spaet@example.test'); cs=k['url'].split('/')[-1]; sql("update ticket_bestellungen set frist=now()-interval '1 minute' where checkout_id='%s'"%cs)
c,k3=kauf(1,'letzter@example.test',ip='203.0.113.7'); t('anderer kauft letzten Platz',k3.get('ok'),k3); pay(k3['url'].split('/')[-1]); hook(sec,'checkout.session.completed',st()['sessions'][k3['url'].split('/')[-1]])
s=pay(cs); setz(fail='refunds'); t('Erstattung scheitert → Stripe soll wiederholen',hook(sec,'checkout.session.completed',s)==500); setz(fail=None)
t('Wiederholung erstattet',hook(sec,'checkout.session.completed',s)==200 and hook(sec,'checkout.session.completed',s)==200 and len(st()['refunds'])==1,st()['refunds']); t('nicht überbucht',sql("select count(*) from tickets where event_id='%s' and status='gueltig'"%EV)=='5')
o=shop(aktion='bestellung',zugang=k['zugang'])[1]; t('Käufer sieht storniert, kein Code',o['status']=='storniert' and o['tickets'][0]['code'] is None,o); t('Erstattung verbucht',sql("select count(*) from ticket_erstattungen where externe_id like 're_%'")=='1')
# Stripe-Ausfall beim Kauf
sql("update ticket_einstellungen set kapazitaet=6 where event_id='%s'"%EV); setz(fail='checkout/sessions'); c,r=kauf(1,'aus@example.test',ip='203.0.113.8'); t('Stripe-Ausfall: Meldung ohne Interna',c==500 and r=={'ok':False,'grund':'fehler'},r); setz(fail=None); t('Plätze nicht blockiert',kauf(1,'frei@example.test',ip='203.0.113.8')[1].get('ok'))
# abgelaufen
cs=sql("select checkout_id from ticket_bestellungen where kaeufer_email='frei@example.test' and status='reserviert'"); t('expired gibt frei',hook(sec,'checkout.session.expired',st()['sessions'][cs])==200 and sql("select status from ticket_bestellungen where checkout_id='%s'"%cs)=='verfallen')
# Gedränge
sql("update ticket_einstellungen set kapazitaet=9 where event_id='%s'"%EV)
with cf.ThreadPoolExecutor(10) as ex: rs=list(ex.map(lambda i:kauf(1,'p%d@example.test'%i,ip='198.51.100.%d'%i)[1],range(10)))
t('10 gleichzeitig auf 4 Plätze',sum(1 for r in rs if r.get('ok'))==4,[r.get('grund','ok') for r in rs])
for i in range(16): r=kauf(1,'z%d@example.test'%i,ip='1.2.3.%d, 198.51.100.99'%i)[1]
t('Bremse trotz gefälschter IP',r['grund']=='zu_viele',r)
# Nachbetreuung
def verw(who='U20',**d): return req(F+'shop-verwaltung',d,{'Authorization':'Bearer '+env[who]} if who else {})
def bid(m): return sql("select id from ticket_bestellungen where kaeufer_email='%s' and status='bezahlt' limit 1"%m)
def tix(b): return sql("select id from tickets where bestellung_id='%s' and status='gueltig' order by id"%b).split()
def uid(): import uuid; return str(uuid.uuid4())
def nochmal(m,ip='192.0.2.1',**k): r=shop({'X-Forwarded-For':ip},**{**dict(aktion='nochmal',slug='probe',email=m),**k}); time.sleep(1.5); return r
b1=bid('gast@example.test'); n0=mails()['total']
t('nochmal: zu früh, keine Mail',nochmal('gast@example.test')[1]=={'ok':True} and mails()['total']==n0)
sql("update ticket_bestellungen set mail_am=now()-interval '11 minutes' where id='%s'"%b1); r=nochmal(' GAST@example.test '); m=mails()
t('nochmal schickt',r[1]=={'ok':True} and m['total']==n0+1 and m['messages'][0]['To'][0]['Address']=='gast@example.test',(r,m['total']))
t('unbekannte Adresse: gleiche Antwort, keine Mail',nochmal('niemand@example.test')==(200,{'ok':True}) and mails()['total']==n0+1)
sql("update ticket_bestellungen set mail_am=now()-interval '11 minutes' where id='%s'"%b1); t('anderer Shop',nochmal('gast@example.test',slug='anderer')[1]=={'ok':True} and mails()['total']==n0+1)
t('nochmal: Bot',nochmal('gast@example.test',website='x')[1]['grund']=='angaben')
for i in range(9): r=shop({'X-Forwarded-For':'192.0.2.9'},aktion='nochmal',slug='probe',email='x%d@example.test'%i)[1]
t('nochmal gebremst',r['grund']=='zu_viele',r)
t('Verwaltung ohne Anmeldung',verw(None,aktion='mail',bestellung_id=b1)[0]==401); t('Schüler darf nicht',verw('U01',aktion='mail',bestellung_id=b1)[0]==403 and verw('U01',aktion='stornieren',bestellung_id=b1,ticket_ids=tix(b1),betrag=15,vorgang=uid())[0]==403); t('unbekannte Bestellung',verw(aktion='mail',bestellung_id=uid())[0]==403)
alt=sql("select string_agg(code,',' order by id) from tickets where bestellung_id='%s'"%b1); n0=mails()['total']
t('Admin schickt erneut',verw(aktion='mail',bestellung_id=b1,email='gast@example.test')[1]=={'ok':True,'geaendert':False} and mails()['total']==n0+1 and alt==sql("select string_agg(code,',' order by id) from tickets where bestellung_id='%s'"%b1))
t('ungültige Adresse',verw(aktion='mail',bestellung_id=b1,email='quatsch')[1]['grund']=='angaben' and mails()['total']==n0+1)
r=verw(aktion='mail',bestellung_id=b1,email='richtig@example.test')[1]; m=mails(); t('Adresse korrigiert',r=={'ok':True,'geaendert':True} and m['messages'][0]['To'][0]['Address']=='richtig@example.test',r)
neu=sql("select string_agg(code,',' order by id) from tickets where bestellung_id='%s'"%b1); t('alte Codes und alter Link ungültig',not set(alt.split(','))&set(neu.split(',')) and shop(aktion='bestellung',zugang=z)[0]==404)
z=sql("select zugang from ticket_bestellungen where id='%s'"%b1); t('neuer Link geht',[q['code'] for q in shop(aktion='bestellung',zugang=z)[1]['tickets']]==neu.split(','))
def refs(b): pi=sql("select externe_id from ticket_zahlungen where bestellung_id='%s'"%b); return [r['amount'] for r in st()['refunds'].values() if r['payment_intent']==pi]
def gebucht(b): return sql("select coalesce(sum(r.betrag),0) from ticket_erstattungen r join ticket_zahlungen z on z.id=r.zahlung_id where z.bestellung_id='%s'"%b)
T=tix(b1); v=uid(); t('zu viel',verw(aktion='stornieren',bestellung_id=b1,ticket_ids=T[:1],betrag=15.01,vorgang=v)[1]['grund']=='erstattung' and verw(aktion='stornieren',bestellung_id=b1,ticket_ids=T[:1],betrag=-1,vorgang=v)[1]['grund']=='erstattung' and verw(aktion='stornieren',bestellung_id=b1,ticket_ids=[],betrag=5,vorgang=v)[1]['grund']=='erstattung' and len(tix(b1))==2)
with cf.ThreadPoolExecutor(5) as ex: rs=list(ex.map(lambda _:verw(aktion='stornieren',bestellung_id=b1,ticket_ids=T[:1],betrag=15,vorgang=v)[1],range(5)))
t('5x gleicher Storno: eine Erstattung',all(x.get('ok') for x in rs) and refs(b1)==[1500] and gebucht(b1)=='15.00' and len(tix(b1))==1,(rs,refs(b1)))
o=shop(aktion='bestellung',zugang=z)[1]; t('Käufer sieht Rest',o['status']=='bezahlt' and o['zurueck']==15 and sorted(x['status'] for x in o['tickets'])==['gueltig','storniert'],o)
setz(fail='refunds'); v=uid(); r=verw(aktion='stornieren',bestellung_id=b1,ticket_ids=T[1:],betrag=10,vorgang=v)[1]; setz(fail=None)
t('Stripe-Ausfall: storniert, Erstattung offen',r=={'ok':True,'erstattung':'offen'} and refs(b1)==[1500] and shop(aktion='bestellung',zugang=z)[1]['zurueck']==25,r)
t('offene zählen mit',verw(aktion='stornieren',bestellung_id=b1,ticket_ids=[],betrag=6,vorgang=uid())[1]['grund']=='erstattung')
t('fremder Vorgang',verw(aktion='wiederholen',bestellung_id=bid('letzter@example.test'),vorgang=v)[0]==400)
t('wiederholen',verw(aktion='wiederholen',bestellung_id=b1,vorgang=v)[1]['erstattung']=='erledigt' and verw(aktion='wiederholen',bestellung_id=b1,vorgang=v)[1]['erstattung']=='erledigt' and sorted(refs(b1))==[1000,1500],refs(b1))
setz(verloren=True); v=uid(); r=verw(aktion='stornieren',bestellung_id=b1,ticket_ids=[],betrag=5,vorgang=v)[1]; r2=verw(aktion='wiederholen',bestellung_id=b1,vorgang=v)[1]
t('Antwort verloren: nicht doppelt',r['erstattung']=='offen' and r2['erstattung']=='erledigt' and sorted(refs(b1))==[500,1000,1500] and gebucht(b1)=='30.00',(r,r2,refs(b1)))
t('nichts mehr erstattbar',verw(aktion='stornieren',bestellung_id=b1,ticket_ids=[],betrag=0.01,vorgang=uid())[1]['grund']=='erstattung' and shop(aktion='bestellung',zugang=z)[1]['status']=='storniert')
b2=bid('letzter@example.test'); v=uid(); setz(ablehnen=True); r=verw(aktion='stornieren',bestellung_id=b2,ticket_ids=tix(b2),betrag=15,vorgang=v)[1]; setz(ablehnen=False); r2=verw(aktion='wiederholen',bestellung_id=b2,vorgang=v)[1]
t('Ablehnung blockiert Wiederholung nicht',r['erstattung']=='offen' and r2['erstattung']=='erledigt' and refs(b2)==[1500],(r,r2))
b3=bid('ohne@example.test'); pi=sql("select externe_id from ticket_zahlungen where bestellung_id='%s'"%b3); k=req('http://127.0.0.1:18001/v1/refunds',('payment_intent=%s&amount=1500'%pi).encode(),{'Authorization':'Bearer rk_test_x','Content-Type':'application/x-www-form-urlencoded'})
r=verw(aktion='stornieren',bestellung_id=b3,ticket_ids=tix(b3),betrag=15,vorgang=uid())[1]; t('schon im Dashboard erstattet: nicht nochmal',r['erstattung']=='erledigt' and refs(b3)==[1500] and gebucht(b3)=='15.00',(r,refs(b3)))
b4=bid('neu@example.test'); sql("update ticket_bestellungen set mail_am=null where id='%s'"%b4); r=verw(aktion='stornieren',bestellung_id=b4,ticket_ids=tix(b4),betrag=0,vorgang=uid())[1]; cs=sql("select checkout_id from ticket_bestellungen where id='%s'"%b4)
t('Storno ohne Geld; wiederholte Stripe-Meldung erstattet nichts',r=={'ok':True,'erstattung':'keine'} and hook(sec,'checkout.session.completed',st()['sessions'][cs])==200 and refs(b4)==[] ,(r,refs(b4)))
t('später doch erstatten',verw(aktion='stornieren',bestellung_id=b4,ticket_ids=[],betrag=7.5,vorgang=uid())[1]['erstattung']=='erledigt' and refs(b4)==[750])
t('automatisch Erstattetes nicht nochmal',verw(aktion='stornieren',bestellung_id=sql("select id from ticket_bestellungen where auto_erstatten"),ticket_ids=[],betrag=1,vorgang=uid())[1]['grund']=='nicht_stornierbar')
t('Stornierte Tickets nicht nochmal geschickt',verw(aktion='mail',bestellung_id=b4,email='neu@example.test')[1]['grund']=='nicht_moeglich')
# Schlüssel einer anderen Schule untergeschoben
sql("insert into schulen(id,name) values('82222222-2222-2222-2222-222222222222','Q'); insert into schul_zahlungskonten select '82222222-2222-2222-2222-222222222222',anbieter,schluessel,webhook_id,webhook_geheim,livemode,letzte4 from schul_zahlungskonten")
t('kopierter Schlüssel nutzlos',hook(sec,'checkout.session.completed',s,schule='82222222-2222-2222-2222-222222222222')==500)
t('trennen',konto(aktion='trennen')[1].get('ok') and len(st()['webhooks'])==0 and sql("select count(*) from schul_zahlungskonten where schule_id='%s'"%SCH)=='0'); t('Erstattung ohne Stripe: nichts storniert',verw(aktion='stornieren',bestellung_id=b4,ticket_ids=[],betrag=1,vorgang=uid())[1]['grund']=='kein_konto'); t('danach nichts im Shop',shop(aktion='info',slug='probe')[1]['events']==[]); t('GET abgelehnt',req(F+'shop')[0]==405)
# Demo mit Testschlüssel
sql("delete from shop_drossel; update ticket_einstellungen set kapazitaet=(select count(*) from tickets t join ticket_bestellungen b on b.id=t.bestellung_id where t.event_id='%s' and (t.status in ('gueltig','eingeloest') or (t.status='reserviert' and b.frist>now())))+1 where event_id='%s'"%(EV,EV)); n0=mails()['total']
r=konto(aktion='verbinden',schluessel='rk_test_abcdefghijkl')[1]; t('Testschlüssel erlaubt',r.get('ok') and r['livemode'] is False,r); sec=list(st()['webhooks'].values())[-1]['secret']
t('Shop zeigt Demo',shop(aktion='info',slug='probe')[1]['testmodus'] is True)
c,k=kauf(1,'demo@example.test',ip='192.0.2.50'); t('Demo-Kauf',k.get('ok'),k); c,k5=kauf(1,'demo2@example.test',ip='192.0.2.51'); t('Demo belegt keinen Platz',k5.get('ok'),k5)
cs=k['url'].split('/')[-1]; s=pay(cs); t('echte Meldung passt nicht zur Demo',hook(sec,'checkout.session.completed',s,live=True)==400); t('Demo bezahlt',hook(sec,'checkout.session.completed',s,live=False)==200)
o=shop(aktion='bestellung',zugang=k['zugang'])[1]; t('Demo-Bestellung',o['demo'] is True and o['status']=='bezahlt' and o['tickets'][0]['status']=='demo' and len(o['tickets'][0]['code'])==32,o)
t('keine gültigen Tickets',sql("select count(*) from tickets t join ticket_bestellungen b on b.id=t.bestellung_id where b.demo and t.status<>'demo'")=='0'); time.sleep(1); m=mails(); t('Mail als Demo gekennzeichnet',m['total']==n0+1 and m['messages'][0]['Subject'].startswith('[DEMO]'),m['messages'][0]['Subject'])
def rpc(f,**d): return req('http://127.0.0.1:18000/rest/v1/rpc/'+f,d,{'Authorization':'Bearer '+env['U20']})
sql("update events set beginn=now()+interval '1 hour' where id='%s'"%EV); x=rpc('ticket_scannen',p_event_id=EV,p_code=o['tickets'][0]['code'],p_scan_id=uid())[1]; t('Einlass lehnt Demo ab',x['ergebnis']=='demo',x)
x=rpc('abendkasse_reservierungen',p_event_id=EV)[1]; t('Demo nicht an der Abendkasse',isinstance(x,list) and not any(q['name']=='Gast Öz' and q['id']==bid('demo@example.test') for q in x),x)
bd=bid('demo@example.test'); r=verw(aktion='stornieren',bestellung_id=bd,ticket_ids=sql("select id from tickets where bestellung_id='%s'"%bd).split(),betrag=15,vorgang=uid())[1]; t('Demo-Storno',r.get('erstattung')=='erledigt' and refs(bd)==[1500],r)
c,k6=kauf(1,'demo3@example.test',ip='192.0.2.52'); sql("update schul_zahlungskonten set livemode=true"); t('Schlüsselwechsel: Demo-Storno nur mit Testschlüssel',verw(aktion='stornieren',bestellung_id=bd,ticket_ids=[],betrag=1,vorgang=uid())[1]['grund']=='kein_konto'); sql("update schul_zahlungskonten set livemode=false")
echt=sql("select count(*) from ticket_bestellungen where not demo"); t('Schüler löscht nicht',req('http://127.0.0.1:18000/rest/v1/rpc/shop_demo_loeschen',{'p_schule_id':SCH},{'Authorization':'Bearer '+env['U01']})[0] in (401,403)); x=rpc('shop_demo_loeschen',p_schule_id=SCH); t('Demo weggeräumt, Echtes bleibt',x[1]==3 and sql("select count(*) from ticket_bestellungen where demo")=='0' and sql("select count(*) from ticket_bestellungen where not demo")==echt,x)
print(f'{ok} ok, {bad} Fehler')
