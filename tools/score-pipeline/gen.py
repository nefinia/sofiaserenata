"""Generic builder: parts from token strings (see parse), with ties, chords, key changes, spanners."""
from fractions import Fraction as F
from music21 import stream, note, chord, meter, tempo, key, instrument, metadata, clef, dynamics, spanner, tie, expressions, bar, pitch, articulations
DUR={'w':4,'h.':3,'h':2,'q.':1.5,'q':1,'e.':0.75,'e':0.5,'s':0.25,'h..':3.5,'q..':1.75,'e..':0.875,'s.':0.375,'ss':0.125,'te':F(1,3),'tq':F(2,3),'ts':F(1,6),'f':F(1,5),'ft':F(1,10)}
def parse(s):
    out=[]
    for tok in s.split():
        tie_all=tok.endswith('~'); tok=tok.rstrip('~')
        p,_,d=tok.partition(':'); d=d or 'q'
        if p=='r': out.append(('r',[],DUR[d])); continue
        names=p.strip('[]').split(',')
        notes=[]
        for nm in names:
            t=nm.endswith('~'); nm=nm.rstrip('~'); f=nm.endswith('!'); nm=nm.rstrip('!')
            notes.append((nm,f,t or tie_all))
        out.append(('n',notes,DUR[d]))
    return out
def keymap(name):
    return {p.step:int(p.alter) for p in key.Key(name).alteredPitches}
def build(bars,name,abbr,inst,clf,ts='4/4',keys=None,start_key='C',dyn=(),hp=(),slurs=(),texts=(),arts=(),tempo_text=None,bpm=60,barlines=None,voltas=(),final=True,tsymbol=None,pos='below',clefs=None):
    keys=dict(keys or {}); keys.setdefault(min(bars),start_key)
    p=stream.Part(); p.partName=name; p.partAbbreviation=abbr; p.insert(0,inst)
    idx={}; ms={}; pend={}; cur=start_key; km=keymap(cur)
    nums=sorted(bars)
    for k in nums:
        m=stream.Measure(number=k)
        newkey=keys.get(k)
        if k==nums[0]:
            m.append(clf); m.append(key.Key(newkey or start_key)); t=meter.TimeSignature(ts)
            if tsymbol: t.symbol=tsymbol
            m.append(t)
            mm=tempo.MetronomeMark(number=bpm); mm.style.hideObjectOnPrint=True; m.insert(0,mm)
            if tempo_text:
                te=expressions.TextExpression(tempo_text); te.style.fontWeight='bold'; te.placement='above'; m.insert(0,te)
        elif newkey and newkey!=cur: m.insert(0,key.Key(newkey))
        if newkey: cur=newkey; km=keymap(cur)
        if clefs and k in clefs and k!=nums[0]: m.insert(0,clefs[k])
        off=0.0; state={}
        for kind,notes,ql in parse(bars[k]):
            if kind=='r': el=note.Rest(quarterLength=ql); pend={}
            else:
                objs=[(note.Note(nm,quarterLength=ql),f,t) for nm,f,t in notes]
                el=objs[0][0] if len(objs)==1 else chord.Chord([o[0] for o in objs],quarterLength=ql)
                for (n,f,t) in objs:
                    k_=(n.pitch.step,n.pitch.octave); alt=int(n.pitch.alter)
                    curalt=state.get(k_,km.get(n.pitch.step,0)); pn=n.pitch.nameWithOctave
                    if (alt!=curalt or f) and pn not in pend:
                        if n.pitch.accidental is None: n.pitch.accidental=pitch.Accidental('natural')
                        n.pitch.accidental.displayStatus=True
                    elif n.pitch.accidental is not None: n.pitch.accidental.displayStatus=False
                    state[k_]=alt
                newpend={}
                for (n,f,t) in objs:
                    pn=n.pitch.nameWithOctave; stop=pn in pend
                    if stop and t: n.tie=tie.Tie('continue')
                    elif stop: n.tie=tie.Tie('stop')
                    elif t: n.tie=tie.Tie('start')
                    if t: newpend[pn]=1
                pend=newpend
            m.insert(off,el); idx[(k,round(off,4))]=el; off+=ql
        p.append(m); ms[k]=m
    def at(b,o):
        kk=max(x for (n,x) in idx if n==b and x<=o+1e-6); return idx[(b,kk)]
    for b,o,mark in dyn: ms[b].insert(o,dynamics.Dynamic(mark))
    for b,o,t in texts:
        te=expressions.TextExpression(t); te.style.fontStyle='italic'; te.style.fontWeight='bold'; te.placement=pos; ms[b].insert(o,te)
    for kd,(b1,o1),(b2,o2) in hp:
        sp=(dynamics.Crescendo if kd=='c' else dynamics.Diminuendo)(at(b1,o1),at(b2,o2)); p.insert(0,sp)
    for (b1,o1),(b2,o2) in slurs: p.insert(0,spanner.Slur(at(b1,o1),at(b2,o2)))
    for b,o,a in arts:
        el=at(b,o)
        el.articulations.append({'stac':articulations.Staccato,'acc':articulations.Accent,'ten':articulations.Tenuto,'up':articulations.UpBow,'down':articulations.DownBow}[a]())
    if barlines:
        for b,(l,r) in barlines.items():
            if l: ms[b].leftBarline=l
            if r: ms[b].rightBarline=r
    for nums_,number in voltas: p.insert(0,spanner.RepeatBracket([ms[n] for n in nums_],number=number))
    if final: ms[nums[-1]].rightBarline=bar.Barline('final')
    return p,at,ms
