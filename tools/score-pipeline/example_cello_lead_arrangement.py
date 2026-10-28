"""Example: turn a 3-part MusicXML trio (viola solo + violin + cello) into a violin+cello duet where the cello takes the melody and the violin a second voice. Edits MusicXML directly (keeps slurs/ties). Input a.xml = uncompressed score.xml from the .mxl (unzip -p x.mxl score.xml)."""
import copy, xml.etree.ElementTree as ET, statistics
t=ET.parse('a.xml'); r=t.getroot()
parts={p.get('id'):p for p in r.findall('part')}
names={sp.get('id'):sp.find('part-name').text for sp in r.find('part-list').findall('score-part')}
print(names)
idv=[k for k,v in names.items() if v=='Viola'][0]; idn=[k for k,v in names.items() if v=='Violin'][0]; idc=[k for k,v in names.items() if v=='Violoncello'][0]
V,N,C=parts[idv],parts[idn],parts[idc]
def midi(n):
    p=n.find('pitch')
    if p is None: return None
    st={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[p.find('step').text]
    return 12*(int(p.find('octave').text)+1)+st+int(float(p.findtext('alter','0')))
def pitched(m): return [n for n in m.findall('note') if n.find('pitch') is not None]
def shift(el,o):
    for n in el.iter('note'):
        p=n.find('pitch')
        if p is not None:
            oc=p.find('octave'); oc.text=str(int(oc.text)+o)
        # remove fingering/ornament leftovers: keep notations
    return el
CONTENT=('note','backup','forward','direction','harmony')
def swap(target,src,octs):
    # remove content from target, insert from src (copies)
    tdirs=[d for d in target.findall('direction') if d.find('.//sound[@tempo]') is not None]
    idx=[i for i,e in enumerate(list(target)) if e.tag in CONTENT]
    first=idx[0] if idx else len(list(target))
    for e in list(target):
        if e.tag in CONTENT: target.remove(e)
    pos=first
    new=[]
    for e in src:
        if e.tag in CONTENT:
            c=copy.deepcopy(e)
            if c.tag=='direction' and c.find('.//sound[@tempo]') is not None: continue
            new.append(c)
    for d in tdirs: new.insert(0,d)
    for c in new:
        target.insert(pos,c); pos+=1
    shift(target,octs)
vm=V.findall('measure'); nm=N.findall('measure'); cm=C.findall('measure')
assert len(vm)==len(nm)==len(cm)
mel=[] ; sec=[]
cl_prev=None
for i in range(len(vm)):
    vmeas,nmeas,cmeas=vm[i],nm[i],cm[i]
    rests=not pitched(vmeas)
    nv=copy.deepcopy(nmeas)  # violin original
    if rests:
        # melody = violin bar -12 ; second voice = cello bar up
        newmel=copy.deepcopy(vmeas)
        swap(newmel,nmeas,-1)
        pm=[midi(n) for n in pitched(cmeas)]
        up=1 if (not pm or min(pm)+12>=55) else 2
        sec_m=copy.deepcopy(nmeas); swap(sec_m,cmeas,up)
        mel.append(newmel); sec.append(sec_m)
    else:
        mel.append(copy.deepcopy(vmeas)); sec.append(nv)
# melody part: clefs per bar
def setclef(m,sign,line):
    a=m.find('attributes')
    if a is None:
        a=ET.Element('attributes'); m.insert(0,a)
    for c in a.findall('clef'): a.remove(c)
    c=ET.Element('clef'); ET.SubElement(c,'sign').text=sign; ET.SubElement(c,'line').text=str(line)
    # attributes child order: divisions,key,time,staves,clef...
    pos=0
    for k,e in enumerate(list(a)):
        if e.tag in ('divisions','key','time','staves','part-symbol','instruments'): pos=k+1
    a.insert(pos,c)
last=None
for m in mel:
    pm=[midi(n) for n in pitched(m)]
    med=statistics.median(pm) if pm else None
    want=last if med is None else ('G' if med>=60 else 'F')
    if want is None: want='F'
    if want!=last or m is mel[0]:
        setclef(m,*(('G',2) if want=='G' else ('F',4)))
        last=want
# fix: if a later measure already had clef attr from the viola source (alto), it was cleared by setclef only when changed; remove alto leftovers
for m in mel:
    a=m.find('attributes')
    if a is not None:
        cl=a.findall('clef')
        for c in cl:
            if c.find('sign').text=='C': a.remove(c)
# rebuild parts
for e in list(V): 
    if e.tag=='measure': V.remove(e)
for m in mel: V.append(m)
for e in list(N):
    if e.tag=='measure': N.remove(e)
for m in sec: N.append(m)
r.find('part-list')
pl=r.find('part-list')
for sp in pl.findall('score-part'):
    if sp.get('id')==idc: pl.remove(sp)
# order: violin first then cello
for sp in pl.findall('score-part'):
    if sp.get('id')==idv:
        sp.find('part-name').text='Violoncello'
        for tag in ('part-abbreviation',):
            x=sp.find(tag)
            if x is not None: x.text='Vc.'
        for ins in sp.findall('score-instrument'):
            ins.find('instrument-name').text='Violoncello'
        for mi in sp.findall('midi-instrument'):
            pg=mi.find('midi-program')
            if pg is not None: pg.text='43'
r.remove(C)
# put violin part before cello
r.remove(N); idx=list(r).index(V); r.insert(idx,N)
for sp in list(pl.findall('score-part')): pass
# reorder score-part so violin first
sps=pl.findall('score-part'); 
order=[idn,idv]
for sp in sps: pl.remove(sp)
for pid in order:
    pl.append([s for s in sps if s.get('id')==pid][0])
t.write('arp_cello_lead.musicxml',encoding='utf-8',xml_declaration=True)
print('ok')
