import re,sys
def clean(path):
    s=open(path,encoding='utf8').read()
    s=re.sub(r'<direction-type>\s*<metronome[^>]*>.*?</metronome>\s*</direction-type>','',s,flags=re.S)
    # directions left with only <sound> are fine; drop empty ones
    s=re.sub(r'<direction[^>]*>\s*</direction>','',s)
    open(path,'w',encoding='utf8').write(s)
for p in sys.argv[1:]: clean(p)
