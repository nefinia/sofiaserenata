import re,sys
from xml.sax.saxutils import escape
def add(path,title,composer,arranger=None,rights=None):
    s=open(path,encoding='utf8').read()
    s=re.sub(r'<credit\b.*?</credit>\s*','',s,flags=re.S)
    def cr(t,words,j,extra=''):
        return f'<credit page="1"><credit-type>{t}</credit-type><credit-words justify="{j}" halign="{j}" valign="top" {extra}>{escape(words)}</credit-words></credit>\n  '
    c=cr('title',title,'center','font-size="22" font-weight="bold"')
    if arranger: c+=cr('subtitle',f'arranged by {arranger}','center','font-size="11"')
    c+=cr('composer',composer,'right','font-size="12"')
    if arranger: c+=cr('arranger',f'arr. {arranger}','right','font-size="10"') if False else ''
    if rights: c+=cr('rights',rights,'center','font-size="8" valign="bottom"')
    s=s.replace('</defaults>','</defaults>\n  '+c.rstrip()) if '</defaults>' in s else s.replace('<part-list>',c+'<part-list>',1)
    open(path,'w',encoding='utf8').write(s)
if __name__=='__main__':
    p=sys.argv[1]; add(p,*sys.argv[2:])
