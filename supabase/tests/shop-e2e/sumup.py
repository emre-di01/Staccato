# SumUp im Ticketshop; frisch nach up.sh oder nach e2e.py
import json,urllib.request as u,urllib.error,time,subprocess,os,uuid,concurrent.futures as cf
S=os.path.dirname(os.path.abspath(__file__)); env=dict(l.strip().split('=',1) for l in open(S+'/e2e.env'))
SCH='81111111-1111-1111-1111-111111111111'; EV='83000000-0000-0000-0000-000000000002'; ok=bad=0
def req(url,data=None,h={},m=None):
    r=u.Request(url,data=data if isinstance(data,bytes) or data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json',**h},method=m or ('POST' if data is not None else 'GET'))
    try: x=u.urlopen(r,timeout=90); b=x.read(); c=x.status
    except urllib.error.HTTPError as e: b=e.read(); c=e.code
    try: return c,json.loads(b)
    except Exception: return c,b.decode()
F='http://127.0.0.1:19000/'; B='http://127.0.0.1:18002'
A=lambda w:{'Authorization':'Bearer '+env[w]}
def shop(h={},**d): return req(F+'shop',d,h)
def konto(who='U20',**d): return req(F+'zahlungskonto',{'schule_id':SCH,**d},A(who) if who else {})
def verw(who='U20',**d): return req(F+'shop-verwaltung',d,A(who))[1]
def rpc(f,who='U20',**d): return req('http://127.0.0.1:18000/rest/v1/rpc/'+f,d,A(who))
def st(): return req(B+'/_state')[1]
def setz(**d): req(B+'/_set',d)
def pay(i): return req(B+'/_pay',{'id':i})[1]
def sql(q): return subprocess.run(['docker','exec','-i','staccato_ticket_test','psql','-U','postgres','-h','127.0.0.1','-qtA','postgres'],input=q,text=True,capture_output=True).stdout.strip()
def mails(): return req('http://127.0.0.1:18025/api/v1/messages')[1]['total']
def t(n,c,x=''):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print('FEHLER',n,str(x)[:400])
def hook(i,schule=SCH): return req(F+'sumup-webhook?schule='+schule,{'event_type':'CHECKOUT_STATUS_CHANGED','id':i})[0]
def abgleich(h={'x-internal-secret':'intern'}): return req(F+'sumup-webhook',{'aufgabe':'abgleich'},h)
IP=[0]
def kauf(n=1,mail='su@example.test',**k):
    IP[0]+=1
    return shop({'X-Forwarded-For':'198.18.0.%d'%IP[0]},**{**dict(aktion='kaufen',event_id=EV,anzahl=n,betrag=15*n,name='Gast Öz',email=mail,sprache='de',agb=True),**k})[1]
def best(z): return shop(aktion='bestellung',zugang=z)[1]
def bid(m): return sql("select id from ticket_bestellungen where kaeufer_email='%s' order by erstellt_am desc limit 1"%m)
def tix(b): return sql("select id from tickets where bestellung_id='%s' and status in ('gueltig','demo') order by id"%b).split()
def refs(b): z=sql("select externe_id from ticket_zahlungen where bestellung_id='%s'"%b); return [round(e['amount']*100) for e in st()['tx'][z]['transaction_events']]
def gebucht(b): return sql("select coalesce(sum(r.betrag),0) from ticket_erstattungen r join ticket_zahlungen z on z.id=r.zahlung_id where z.bestellung_id='%s'"%b)
def storno(b,ids,betrag,v=None): return verw(aktion='stornieren',bestellung_id=b,ticket_ids=ids,betrag=betrag,vorgang=v or str(uuid.uuid4()))
def frei(): sql("delete from zahlung_sperren")
def fertig(n,mail):
    k=kauf(n,mail); i=k['url'].split('/')[-1]; pay(i); hook(i); return k,i
sql("delete from shop_drossel; update ticket_einstellungen set shop_aktiv=true,kapazitaet=60 where event_id='%s'; delete from schul_zahlungskonten where schule_id='%s'"%(EV,SCH))

# Schlüssel
def key(k='sup_sk_GeheimerSchluessel99',**d): return konto(aktion='sumup_schluessel',schluessel=k,**d)[1]
t('Schüler darf nicht',konto('U01',aktion='sumup_schluessel',schluessel='sup_sk_abcdefghijkl')[0]==403 and konto('U01',aktion='sumup_start')[0]==403 and konto(None,aktion='sumup_start')[0]==401)
t('öffentlicher Schlüssel',key('sup_pk_abcdefghijkl')['grund']=='oeffentlich'); t('Format',key('rk_live_abc')['grund']=='format')
t('falscher Schlüssel',key('sup_sk_FALSCHabcdefgh')['grund']=='ungueltig'); t('fehlendes Recht',key('sup_sk_KEINRECHTabcdefg')['grund']=='rechte')
setz(haendler={'MCHF':{'sandbox':False,'default_currency':'CHF'}}); t('nur Euro',key()['grund']=='waehrung')
setz(haendler={'MLIVE001':{'sandbox':False,'default_currency':'EUR'},'MTEST002':{'sandbox':True,'default_currency':'EUR'}})
r=key(); t('mehrere Händler: Auswahl',r['grund']=='haendler' and {x['code'] for x in r['liste']}=={'MLIVE001','MTEST002'},r)
t('fremder Händler nicht wählbar',key(haendler='MFREMD')['grund']=='haendler')
r=key(haendler='MLIVE001'); t('verbunden',r=={'ok':True,'livemode':True,'letzte4':'E001','haendler':'MLIVE001'},r)
t('kein Klartext','GeheimerSchluessel' not in sql("select schluessel from schul_zahlungskonten where schule_id='%s'"%SCH) and sql("select schluessel like 'v1:%%' from schul_zahlungskonten where schule_id='%s'"%SCH)=='t')
t('REST liefert nichts',all(req('http://127.0.0.1:18000/rest/v1/'+x,None,A('U20'))[1] in ([],) or req('http://127.0.0.1:18000/rest/v1/'+x,None,A('U20'))[0] in (401,403) for x in ('schul_zahlungskonten','zahlungskonto_oauth','zahlung_sperren')))
t('Sperren nur intern',rpc('zahlung_sperren',p_name='x',p_sekunden=1)[0]==403 and rpc('sumup_abgleich_liste')[0]==403 and rpc('zahlung_entsperren',p_name='x')[0]==403)
s=rpc('zahlungskonto_status',p_schule_id=SCH)[1]; t('Status',s['anbieter']=='sumup' and s['konten'][0]['art']=='schluessel' and 'schluessel' not in s['konten'][0],s)
t('Schüler sieht Status nicht',rpc('zahlungskonto_status','U01',p_schule_id=SCH)[0] in (401,403) and rpc('zahlungskonto_waehlen','U01',p_schule_id=SCH,p_anbieter='sumup')[0] in (401,403))
t('Shop nennt Anbieter',shop(aktion='info',slug='probe')[1]['anbieter']=='sumup')

# Kauf
k=kauf(2); t('Kauf',k.get('ok') and k['url'].startswith('https://checkout.sumup.test/'),k); z=k['zugang']; i=k['url'].split('/')[-1]; c=st()['checkouts'][i]
t('SumUp-Angaben',c['amount']==30 and c['currency']=='EUR' and c['merchant_code']=='MLIVE001' and c['checkout_reference']==bid('su@example.test') and c['redirect_url']=='https://app.example.test/shop/bestellung' and z not in json.dumps(c) and c['return_url']=='https://api.example.test/functions/v1/sumup-webhook?schule='+SCH and c['hosted_checkout']=={'enabled':True},c)
o=best(z); t('vor Zahlung keine Codes',o['status']=='reserviert' and all(x['code'] is None for x in o['tickets'])); t('keine internen Felder',not {'checkout_id','schule_id','id','anbieter'}&set(o),o)
t('Meldung ohne Zahlung ändert nichts',hook(i)==200 and best(z)['status']=='reserviert')
n=len(st()['log']); t('Unbekannte Meldung ohne Rückfrage',hook(str(uuid.uuid4()))==200 and hook(i,'72222222-2222-2222-2222-222222222222')==200 and len(st()['log'])==n); t('Unsinn abgelehnt',req(F+'sumup-webhook?schule=x',{'id':i})[0]==400 and req(F+'sumup-webhook?schule='+SCH,b'xx')[0]==400 and req(F+'sumup-webhook')[0]==405)
t('Abgleich nur intern',abgleich({'x-internal-secret':'falsch'})[0]==403 and abgleich({})[0]==400)
m0=mails(); pay(i)
with cf.ThreadPoolExecutor(6) as ex: rs=list(ex.map(lambda _:hook(i),range(6)))
t('6x Meldung gleichzeitig',all(x==200 for x in rs),rs); b=bid('su@example.test'); time.sleep(1)
t('eine Zahlung, 2 Tickets, eine Mail',sql("select string_agg(methode||betrag||externe_id,',') from ticket_zahlungen where bestellung_id='%s'"%b)=='sumup30.00tx-'+i and len(tix(b))==2 and mails()==m0+1,(sql("select * from ticket_zahlungen where bestellung_id='%s'"%b),mails()-m0))
t('Link zeigt Tickets',best(z)['status']=='bezahlt' and all(len(q['code'])==32 for q in best(z)['tickets']))
t('Barstorno gesperrt',rpc('tickets_stornieren',p_bestellung_id=b,p_ticket_ids=tix(b),p_erstattung=10)[0]>=400)
# Meldung verloren
k=kauf(1,'rueck@example.test'); pay(k['url'].split('/')[-1]); t('Rückkehr ohne Meldung',best(k['zugang'])['status']=='bezahlt')
k=kauf(1,'sweep@example.test'); i=k['url'].split('/')[-1]; pay(i); b=bid('sweep@example.test'); sql("update ticket_bestellungen set erstellt_am=now()-interval '50 minutes',frist=now()-interval '15 minutes' where id='%s'; select tickets_bereinigen()"%b)
r=abgleich(); t('Abgleich holt verlorene Meldung nach',r[0]==200 and r[1]['fehler']==0 and len(tix(b))==1,(r,sql("select status from ticket_bestellungen where id='%s'"%b)))
n=len(st()['log']); sql("update ticket_bestellungen set erstellt_am=now()-interval '50 minutes' where id='%s'"%b); r=abgleich(); t('Abgeschlossene nicht nochmal',all('checkouts/'+i not in x[1] for x in st()['log'][n:]),r)
# Abbruch, Ablauf
k=kauf(1,'ab@example.test'); i=k['url'].split('/')[-1]; t('Abbruch',shop(aktion='abbrechen',zugang=k['zugang'])[1]['status']=='verfallen' and st()['checkouts'][i]['status']=='EXPIRED')
k=kauf(1,'ab2@example.test'); pay(k['url'].split('/')[-1]); t('Abbruch nach Zahlung: bezahlt',shop(aktion='abbrechen',zugang=k['zugang'])[1]['status']=='bezahlt')
k=kauf(1,'abl@example.test'); i=k['url'].split('/')[-1]; req(B+'/_expire',{'id':i}); t('abgelaufen gibt frei',hook(i)==200 and best(k['zugang'])['status']=='verfallen')
setz(fail='checkouts'); r=kauf(1,'ausfall@example.test'); setz(fail=None); t('Ausfall: Meldung ohne Interna, Platz frei',r=={'ok':False,'grund':'fehler'} and sql("select status from ticket_bestellungen where kaeufer_email='ausfall@example.test'")=='verfallen',r)
k=kauf(1,'fremdbetrag@example.test'); i=k['url'].split('/')[-1]; c=st()['checkouts']; c[i]['merchant_code']='MANDERS'; setz(checkouts=c); pay(i); hook(i); t('anderer Händler zählt nicht',best(k['zugang'])['status']!='bezahlt')
# Teilstorno
b=bid('su@example.test'); T=tix(b); v=str(uuid.uuid4())
t('zu viel',storno(b,T[:1],15.01)['grund']=='erstattung')
with cf.ThreadPoolExecutor(5) as ex: rs=list(ex.map(lambda _:storno(b,T[:1],15,v),range(5)))
t('5x gleicher Storno: eine Erstattung',all(x.get('ok') for x in rs) and refs(b)==[1500] and gebucht(b)=='15.00',(rs,refs(b),gebucht(b)))
setz(ablehnen=True); v=str(uuid.uuid4()); r=storno(b,T[1:],10,v); setz(ablehnen=False)
t('Ablehnung: offen, sofort wiederholbar',r['erstattung']=='offen' and refs(b)==[1500] and verw(aktion='wiederholen',bestellung_id=b,vorgang=v)['erstattung']=='erledigt' and sorted(refs(b))==[1000,1500] and gebucht(b)=='25.00',(r,refs(b)))
setz(verloren=True); v=str(uuid.uuid4()); r=storno(b,[],5,v); r2=verw(aktion='wiederholen',bestellung_id=b,vorgang=v); n=refs(b)
t('Antwort verloren: erst nach Wartezeit',r['erstattung']=='offen' and r2['erstattung']=='offen' and sorted(n)==[500,1000,1500],(r,r2,n))
sql("update zahlung_sperren set seit=now()-interval '11 minutes'"); r=verw(aktion='wiederholen',bestellung_id=b,vorgang=v); t('danach abgeglichen, nicht doppelt',r['erstattung']=='erledigt' and sorted(refs(b))==[500,1000,1500] and gebucht(b)=='30.00',(r,refs(b)))
t('nichts mehr erstattbar',storno(b,[],0.01)['grund']=='erstattung')
# zwei verschiedene Stornos gleichzeitig
fertig(3,'par@example.test'); b=bid('par@example.test'); T=tix(b)
with cf.ThreadPoolExecutor(3) as ex: rs=list(ex.map(lambda x:storno(b,[x],15),T))
for o in sql("select vorgang from ticket_online_erstattungen where bestellung_id='%s' and erledigt_am is null"%b).split(): verw(aktion='wiederholen',bestellung_id=b,vorgang=o)
t('3 Stornos gleichzeitig: genau 45 €',sum(refs(b))==4500 and gebucht(b)=='45.00',(rs,refs(b),gebucht(b)))
# Anzeige bei SumUp hinkt nach einer verbuchten Erstattung hinterher
fertig(2,'verz@example.test'); b=bid('verz@example.test'); T=tix(b); setz(verzoegert=True); storno(b,T[:1],15); storno(b,T[1:],15); setz(verzoegert=False); t('verzögerte Anzeige: richtig',refs(b)==[1500,1500] and gebucht(b)=='30.00',refs(b))
# von Hand bei SumUp erstattet
fertig(1,'hand@example.test'); b=bid('hand@example.test'); z=sql("select externe_id from ticket_zahlungen where bestellung_id='%s'"%b); req(B+'/v1.0/merchants/MLIVE001/payments/%s/refunds'%z,{'amount':1500},{'Authorization':'Bearer sup_sk_x'})
t('von Hand erstattet: nicht nochmal',storno(b,tix(b),15)['erstattung']=='erledigt' and refs(b)==[1500] and gebucht(b)=='15.00',refs(b))
fertig(1,'canc@example.test'); b=bid('canc@example.test'); x=st()['tx']; z=sql("select externe_id from ticket_zahlungen where bestellung_id='%s'"%b); x[z]['simple_status']='CANCELLED'; setz(tx=x); t('bei SumUp storniert: nicht nochmal',storno(b,tix(b),15)['erstattung']=='erledigt' and refs(b)==[])
# zu spät und ausverkauft
k=kauf(1,'spaet@example.test'); i=k['url'].split('/')[-1]; b=bid('spaet@example.test'); sql("update ticket_bestellungen set frist=now()-interval '1 minute',erstellt_am=now()-interval '40 minutes' where id='%s'; update ticket_einstellungen set kapazitaet=(select count(*) from tickets t join ticket_bestellungen o on o.id=t.bestellung_id where t.event_id='%s' and (t.status in ('gueltig','eingeloest') or (t.status='reserviert' and o.frist>now()))) where event_id='%s'"%(b,EV,EV))
pay(i); setz(fail='refunds'); r=hook(i); setz(fail=None); t('Auto-Erstattung scheitert: SumUp soll wiederholen',r==500 and refs(b)==[],(r,refs(b))); t('Sperre hält',hook(i)==500 and refs(b)==[])
sql("update zahlung_sperren set seit=now()-interval '11 minutes'"); r=abgleich(); t('Abgleich erstattet genau einmal',r[1]['fehler']==0 and hook(i)==200 and refs(b)==[1500] and gebucht(b)=='15.00',(r,refs(b),gebucht(b)))
t('automatisch Erstattetes nicht nochmal',storno(b,[],1)['grund']=='nicht_stornierbar')
sql("update ticket_einstellungen set kapazitaet=90 where event_id='%s'"%EV)

# Beide Anbieter: Wechsel, alte Bestellungen bleiben bei SumUp
r=konto(aktion='verbinden',schluessel='rk_live_GeheimerSchluessel1234')[1]; t('Stripe dazu verbunden',r.get('ok'),r); s=rpc('zahlungskonto_status',p_schule_id=SCH)[1]; t('SumUp bleibt aktiv',s['anbieter']=='sumup' and len(s['konten'])==2,s)
k=kauf(1,'offen@example.test'); i=k['url'].split('/')[-1]
t('Wechsel',rpc('zahlungskonto_waehlen',p_schule_id=SCH,p_anbieter='stripe')[1] is True and shop(aktion='info',slug='probe')[1]['anbieter']=='stripe'); t('unbekannter Anbieter',rpc('zahlungskonto_waehlen',p_schule_id=SCH,p_anbieter='paypal')[1] is False and rpc('zahlungskonto_status',p_schule_id=SCH)[1]['anbieter']=='stripe')
pay(i); t('laufende SumUp-Zahlung kommt an',hook(i)==200 and best(k['zugang'])['status']=='bezahlt'); b=bid('offen@example.test'); t('Erstattung über SumUp trotz Wechsel',storno(b,tix(b),15)['erstattung']=='erledigt' and refs(b)==[1500])
k=kauf(1,'str@example.test'); t('neue Käufe bei Stripe',k['url'].startswith('https://checkout.stripe.test/') and sql("select anbieter from ticket_bestellungen where kaeufer_email='str@example.test'")=='stripe',k)
fertig_b=bid('ab2@example.test'); t('SumUp trennen lässt Stripe',konto(aktion='trennen',anbieter='sumup')[1].get('ok') and [x['anbieter'] for x in rpc('zahlungskonto_status',p_schule_id=SCH)[1]['konten']]==['stripe']); t('ohne SumUp keine Erstattung, nichts storniert',storno(fertig_b,tix(fertig_b),15)['grund']=='kein_konto' and len(tix(fertig_b))==1)
konto(aktion='trennen',anbieter='stripe')

# OAuth
setz(haendler={'MLIVE001':{'sandbox':False,'default_currency':'EUR'}})
t('möglich',konto(aktion='sumup_moeglich')[1]=={'ok':True,'oauth':True})
def start(who='U20'):
    r=konto(who,aktion='sumup_start')[1]; q=dict(x.split('=',1) for x in r['url'].split('?')[1].split('&')); return r['url'],q
def fert(who='U20',**d): return req(F+'zahlungskonto',{'aktion':'sumup_fertig',**d},A(who))[1]
url,q=start(); t('Anmeldelink',q['client_id']=='cid' and q['response_type']=='code' and 'app.example.test' in q['redirect_uri'] and 'geheim' not in url and len(q['state'])==64,url)
t('Zustand nur als Hash',q['state'] not in sql("select string_agg(state_hash,',') from zahlungskonto_oauth"))
t('fremde Person',fert('U01',state=q['state'],code='gut')['grund']=='abgelaufen'); t('falscher Zustand',fert(state='a'*64,code='gut')['grund']=='abgelaufen' and fert(state='x',code='gut')['grund']=='abgelaufen')
t('Code abgelehnt',fert(state=q['state'],code='schlecht')['grund']=='ungueltig'); t('Zustand gilt nur einmal',fert(state=q['state'],code='gut')['grund']=='abgelaufen')
_,q=start(); setz(scope='transactions.history'); t('payments fehlt',fert(state=q['state'],code='gut')['grund']=='rechte'); setz(scope='payments transactions.history user.profile_readonly')
_,q=start(); sql("update zahlungskonto_oauth set erstellt_am=now()-interval '16 minutes'"); t('zu alt',fert(state=q['state'],code='gut')['grund']=='abgelaufen')
_,q=start(); sql("update profiles set rolle='schueler' where id='8a000000-0000-0000-0000-000000000020'; update schul_mitgliedschaften set rolle='schueler' where user_id='8a000000-0000-0000-0000-000000000020'"); t('kein Admin mehr',fert(state=q['state'],code='gut').get('grund')=='verboten'); sql("update profiles set rolle='admin' where id='8a000000-0000-0000-0000-000000000020'; update schul_mitgliedschaften set rolle='admin' where user_id='8a000000-0000-0000-0000-000000000020'")
setz(haendler={'MLIVE001':{'sandbox':False,'default_currency':'EUR'},'MTEST002':{'sandbox':True,'default_currency':'EUR'}})
_,q=start(); r=fert(state=q['state'],code='gut1'); t('Auswahl',r['grund']=='haendler' and len(r['liste'])==2,r); t('Token nur verschlüsselt',sql("select zugang like 'v1:%' from zahlungskonto_oauth where zugang is not null")=='t')
t('fremde Person wählt nicht',fert('U01',state=q['state'],haendler='MLIVE001')['grund']=='abgelaufen')
r=fert(state=q['state'],haendler='MLIVE001'); t('OAuth verbunden',r.get('ok') and r['livemode'],r); t('Vorgang aufgeräumt',sql("select count(*) from zahlungskonto_oauth where zugang is not null")=='0')
s=rpc('zahlungskonto_status',p_schule_id=SCH)[1]; t('Status oauth',s['konten'][0]['art']=='oauth' and s['anbieter']=='sumup',s); t('Token verschlüsselt',sql("select schluessel like 'v1:%%' and schluessel not like '%%at%%refresh%%' from schul_zahlungskonten where schule_id='%s'"%SCH)=='t')
k,i=fertig(1,'oa@example.test'); t('Kauf über OAuth',best(k['zugang'])['status']=='bezahlt')
# Token abgelaufen: viele gleichzeitig, SumUp dreht den Refresh-Token weiter
setz(dauer=60,langsam=0.4); konto(aktion='trennen',anbieter='sumup'); _,q=start(); fert(state=q['state'],code='gut2') ; _r=sql("select 1"); s=rpc('zahlungskonto_status',p_schule_id=SCH)[1]
if not s['verbunden']:
    _,q=start(); fert(state=q['state'],code='gut2'); fert(state=q['state'],haendler='MLIVE001')
setz(dauer=3600); n=st()['n']
with cf.ThreadPoolExecutor(6) as ex: rs=list(ex.map(lambda j:kauf(1,'tok%d@example.test'%j),range(6)))
t('6 Käufe gleichzeitig, ein Tokenwechsel',all(x.get('ok') for x in rs) and st()['n']==n+1 and sql("select neu_verbinden from schul_zahlungskonten where schule_id='%s'"%SCH)=='f',(rs,st()['n']-n)); setz(langsam=0)
# Freigabe entzogen
setz(dauer=60); konto(aktion='trennen',anbieter='sumup'); _,q=start(); fert(state=q['state'],code='gut3'); fert(state=q['state'],haendler='MLIVE001'); setz(entzogen=True,dauer=3600); b=bid('oa@example.test')
r=kauf(1,'weg@example.test'); t('entzogen: Kauf scheitert sauber',r=={'ok':False,'grund':'fehler'} and sql("select neu_verbinden from schul_zahlungskonten where schule_id='%s'"%SCH)=='t',r); t('Shop schließt',shop(aktion='info',slug='probe')[1]['events']==[]); t('Admin sieht es',rpc('zahlungskonto_status',p_schule_id=SCH)[1]['konten'][0]['neu_verbinden'] is True); t('keine Erstattung ins Leere',storno(b,tix(b),15)['grund']=='kein_konto' and len(tix(b))==1)
setz(entzogen=False); _,q=start(); fert(state=q['state'],code='gut4'); r=fert(state=q['state'],haendler='MLIVE001'); t('neu verbunden',r.get('ok') and shop(aktion='info',slug='probe')[1]['events']!=[] and storno(b,tix(b),15)['erstattung']=='erledigt',r)
# Demo (Sandbox)
r=key(haendler='MTEST002'); t('Sandbox = Demo',r.get('ok') and r['livemode'] is False and shop(aktion='info',slug='probe')[1]['testmodus'] is True,r)
k,i=fertig(1,'demo@example.test'); o=best(k['zugang']); t('Demo-Kauf',o['demo'] and o['status']=='bezahlt' and o['tickets'][0]['status']=='demo',o); b=bid('demo@example.test'); t('Demo-Storno',storno(b,tix(b),15)['erstattung']=='erledigt' and refs(b)==[1500])
b=bid('rueck@example.test'); t('echte Bestellung nicht über Sandbox erstatten',storno(b,tix(b),15)['grund']=='kein_konto' and len(tix(b))==1)
# kopierter Zugang für andere Schule
sql("insert into schulen(id,name) values('83333333-3333-3333-3333-333333333333','R') on conflict do nothing; insert into schul_zahlungskonten(schule_id,anbieter,schluessel,livemode,letzte4,haendler) select '83333333-3333-3333-3333-333333333333',anbieter,schluessel,livemode,letzte4,haendler from schul_zahlungskonten where schule_id='%s'; update ticket_bestellungen set schule_id='83333333-3333-3333-3333-333333333333' where kaeufer_email='tok0@example.test'"%SCH)
t('kopierter Zugang nutzlos',hook(sql("select checkout_id from ticket_bestellungen where kaeufer_email='tok0@example.test'"),'83333333-3333-3333-3333-333333333333')==500)
log=subprocess.run(['docker','logs','t-edge'],capture_output=True,text=True); t('keine Geheimnisse im Protokoll',not any(x in log.stdout+log.stderr for x in ('GeheimerSchluessel','client_secret','sup_sk_','refresh_token')))
print(f'{ok} ok, {bad} Fehler')
