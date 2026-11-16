#!/usr/bin/env python3
"""Public RSS ingestion, CPU captions, and explicit pending-review ledger.
No credentials, paid API, source-video mutations, or progress storage access.
"""
import json,pathlib,re,subprocess,tempfile,time,urllib.request,xml.etree.ElementTree as ET
from nach_parser import parse_nach
ROOT=pathlib.Path(__file__).resolve().parent.parent
FEED='https://anchor.fm/s/11165f74/podcast/rss'
YOUTUBE='https://www.youtube.com/feeds/videos.xml?channel_id=UC-BXhEPqRXcCeyiWu8iTYpg'
EXCLUDED={'jKMOpJ2CfNs'}
def fetch(url):
 if not url.startswith('https://'):raise ValueError('HTTPS required')
 req=urllib.request.Request(url,headers={'User-Agent':'NachYomiLibrary/1.0'})
 with urllib.request.urlopen(req,timeout=45) as r:
  if not r.url.startswith('https://'):raise ValueError('Insecure redirect')
  return r.read()
def norm(t):return re.sub(r'\s+',' ',t.strip()).casefold()
def probe(p):return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(p)]))
def captions(audio,vid):
 import numpy as np
 import wave
 from faster_whisper import WhisperModel
 model=WhisperModel('small.en',device='cpu',compute_type='int8',cpu_threads=2)
 words=[]
 with tempfile.TemporaryDirectory() as wd:
  duration=probe(audio)
  for start in range(0,int(duration)+1,80):
   f=pathlib.Path(wd)/'chunk.wav'
   subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(audio),'-t','80','-ar','16000','-ac','1',str(f)],check=True)
   # FFmpeg already decoded mono 16 kHz PCM. Pass samples directly so
   # captioning does not depend on PyAV container-keyword compatibility.
   with wave.open(str(f),'rb') as wav:
    samples=np.frombuffer(wav.readframes(wav.getnframes()),dtype=np.int16).astype(np.float32)/32768.0
   segs,_=model.transcribe(samples,beam_size=1,language='en',vad_filter=True,word_timestamps=True,initial_prompt='Yechezkel. Yirmiyahu. Hashem. Beis HaMikdash. Bavel. Malbim. Radak. Abarbanel. Eretz Yisrael. Shechinah.')
   for s in segs:
    for w in s.words:words.append({'start':w.start+start,'end':w.end+start,'word':w.word})
 lines=[];buf=[]
 for w in words:
  if buf and (w['end']-buf[0]['start']>5.5 or len(''.join(x['word'] for x in buf))>85):lines.append([round(buf[0]['start'],2),''.join(x['word'] for x in buf).strip()]);buf=[]
  buf.append(w)
 if buf:lines.append([round(buf[0]['start'],2),''.join(x['word'] for x in buf).strip()])
 if len(lines)<5 or lines[-1][0]<duration*.65:raise ValueError('Caption coverage too low; needs review')
 dest=ROOT/'c'/(vid+'.json');dest.parent.mkdir(exist_ok=True);dest.write_text(json.dumps(lines,ensure_ascii=False)+'\n')
 return len(lines)
def main():
 catpath=ROOT/'catalog.json';cat=json.loads(catpath.read_text());items={i['id']:i for i in cat['items'] if i['id'] not in EXCLUDED};errors=[];awaiting_audio=[]
 rss=ET.fromstring(fetch(FEED)).findall('./channel/item');episodes={}
 for e in rss:
  title=e.findtext('title','');p=parse_nach(title)
  if p:
   enc=e.find('enclosure')
   if enc is not None and enc.get('type') in {'audio/mpeg','audio/mp4','audio/x-m4a','audio/aac'}:episodes.setdefault((p['sefer'],p['perek']),[]).append((title,enc.get('url',''),e.findtext('guid')))
 try:
  ns={'a':'http://www.w3.org/2005/Atom','y':'http://www.youtube.com/xml/schemas/2015'}
  yt=ET.fromstring(fetch(YOUTUBE))
  for e in yt.findall('a:entry',ns):
   vid=e.findtext('y:videoId',namespaces=ns);title=e.findtext('a:title','',ns);p=parse_nach(title)
   if not vid or vid in EXCLUDED or not p:continue
   if vid not in items:items[vid]={'id':vid,'title':title,**p,'published':e.findtext('a:published',namespaces=ns),'duration':0,'audio':False}
 except Exception as e:errors.append('YouTube metadata: '+str(e)[:300])
 completed=[];attempts=0
 for vid,i in items.items():
  audio=ROOT/'audio'/(vid+'.m4a');cap=ROOT/'c'/(vid+'.json')
  if audio.exists():i.update(audio=True,duration=round(probe(audio)))
  if audio.exists():i.update(audio=True,duration=round(probe(audio)))
  if audio.exists():i.update(audio=True,duration=round(probe(audio)))
  if audio.exists() and cap.exists():continue
  if attempts>=3:continue
  attempts+=1
  matches=[x for x in episodes.get((i.get('sefer'),i.get('perek')),[]) if norm(x[0])==norm(i['title'])]
  if not matches:awaiting_audio.append({'id':vid,'title':i['title'],'reason':'Matching public podcast audio not published yet'});continue
  if len(matches)!=1:errors.append(vid+': ambiguous exact-title podcast match');continue
  try:
   if not audio.exists():
    with tempfile.TemporaryDirectory() as wd:
     src=pathlib.Path(wd)/'source';src.write_bytes(fetch(matches[0][1]));candidate=pathlib.Path(wd)/'audio.m4a'
     subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-vn','-ac','1','-c:a','aac','-b:a','48k','-movflags','+faststart',str(candidate)],check=True)
     dur=probe(candidate)
     if not 15<=dur<=3600:raise ValueError('Unexpected audio duration')
     audio.parent.mkdir(exist_ok=True);audio.write_bytes(candidate.read_bytes())
   if not cap.exists():captions(audio,vid)
   i.update(audio=True,duration=round(probe(audio)));completed.append(vid)
  except Exception as e:errors.append(vid+': '+str(e)[:300])
 out=sorted(items.values(),key=lambda i:i.get('published') or '',reverse=True);cat.update(items=out,count=len(out),updated=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),last_ok=cat.get('last_ok',0) if errors else int(time.time()*1000));catpath.write_text(json.dumps(cat,ensure_ascii=False,indent=1)+'\n')
 pending=[{'id':i['id'],'title':i['title'],'caption':'c/'+i['id']+'.json','audio':'audio/'+i['id']+'.m4a'} for i in out if i.get('audio') and not (ROOT/'r'/(i['id']+'.json')).exists()]
 state={'checked_at':cat['updated'],'source':FEED,'completed':completed,'pending_reviews':pending,'awaiting_audio':awaiting_audio,'errors':errors};(ROOT/'maintenance-state.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n');print(json.dumps(state,ensure_ascii=False))
 if errors:raise SystemExit(1)
if __name__=='__main__':main()
