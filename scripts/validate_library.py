import json,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
cat=json.loads((root/'catalog.json').read_text());items=cat['items'];assert cat['count']==len(items)
ids=[i['id'] for i in items];assert len(ids)==len(set(ids));assert 'jKMOpJ2CfNs' not in ids
for i in items:
 assert i.get('sefer') and i.get('perek'),i
 if i.get('audio'):
  a=root/'audio'/(i['id']+'.m4a');assert a.exists() and a.stat().st_size>10000,i
 c=root/'c'/(i['id']+'.json')
 if c.exists():
  lines=json.loads(c.read_text());assert lines and all(isinstance(x,list) and len(x)==2 and isinstance(x[0],(int,float)) and isinstance(x[1],str) for x in lines),i
 r=root/'r'/(i['id']+'.json')
 if r.exists():
  points=json.loads(r.read_text())['points'];assert points and all(isinstance(x,str) and x.strip() for x in points),i
print('Validated',len(items),'Nach entries; pending reviews are not fabricated.')
