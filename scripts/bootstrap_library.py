import hashlib,json,pathlib,urllib.request,concurrent.futures,subprocess,tempfile,re,xml.etree.ElementTree as ET
root=pathlib.Path('.')
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'NachYomiLibrary/1.0'}),timeout=60) as r:return r.read()
def retain(pair):
 name,expected=pair;p=root/name
 if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==expected:return
 data=get('https://motzen-nach.sites.tab.bot/'+name)
 assert hashlib.sha256(data).hexdigest()==expected,'Preserved content checksum mismatch: '+name
 p.parent.mkdir(exist_ok=True);p.write_bytes(data)
if not (root/'.nach-bootstrap-complete').exists():
 manifest=json.loads((root/'scripts/preserved-manifest.json').read_text())
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(retain,manifest.items()))
 cat=json.loads((root/'catalog.json').read_text())
 rss=ET.fromstring(get('https://anchor.fm/s/11165f74/podcast/rss')).findall('./channel/item')
 for i in cat['items']:
  if not i.get('audio'):continue
  audio=root/'audio'/(i['id']+'.m4a')
  if audio.exists():continue
  matches=[e for e in rss if re.sub(r'\s+',' ',e.findtext('title','').strip()).casefold()==re.sub(r'\s+',' ',i['title'].strip()).casefold()]
  assert len(matches)==1,'No unique exact-title podcast match for '+i['id']
  url=matches[0].find('enclosure').get('url');assert url.startswith('https://')
  with tempfile.TemporaryDirectory() as wd:
   src=pathlib.Path(wd)/'source';src.write_bytes(get(url));candidate=pathlib.Path(wd)/'new.m4a'
   subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-vn','-ac','1','-c:a','aac','-b:a','48k','-movflags','+faststart',str(candidate)],check=True)
   duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(candidate)]));assert 15<=duration<=3600
   audio.parent.mkdir(exist_ok=True);audio.write_bytes(candidate.read_bytes())
 (root/'.nach-bootstrap-complete').write_text('Initial takeover import verified.\n')
