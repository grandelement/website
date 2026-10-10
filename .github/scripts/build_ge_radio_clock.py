#!/usr/bin/env python3
"""Build one deterministic UTC playlist from real audio durations; fail closed."""
import datetime,hashlib,json,pathlib,subprocess
from urllib.parse import quote
ROOT=pathlib.Path(__file__).resolve().parents[2]
MUSIC=ROOT/"ge-music"/"music"
CLIPS=ROOT/"ge-music"/"clips"
OUT=ROOT/"radio"/"sync-playlist.json"
CORE=("Intergy","Love","Soul","Spirit","Fire")
EPOCH=int(datetime.datetime(2026,1,1,tzinfo=datetime.timezone.utc).timestamp()*1000)
def duration_ms(file):
 r=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(file)],capture_output=True,text=True,timeout=35)
 if r.returncode:raise RuntimeError("ffprobe failed: "+str(file)+" "+r.stderr[:220])
 n=round(float(r.stdout.strip())*1000)
 if n<2000:raise RuntimeError("Invalid duration: "+str(file))
 return n
def meta(path,kind="song"):
 rel=path.relative_to(ROOT).as_posix()
 parent=path.parent.name
 album=next((x for x in CORE if parent.endswith(" - "+x)),parent)
 title=path.stem.split("_",1)[-1].replace("_"," ").strip()
 return dict(url="/"+quote(rel,safe="/"),path=rel,title=title,album=album,duration_ms=duration_ms(path),kind=kind)
def main():
 files=sorted((p for p in MUSIC.rglob("*.mp3") if p.parent.name.endswith(tuple(" - "+x for x in CORE))),key=lambda p:p.relative_to(ROOT).as_posix().casefold())
 if len(files)<20:raise RuntimeError("Missing core MP3s: refusing incomplete schedule")
 ids=sorted(CLIPS.glob("GE Station Identification - *.m4a"))
 tracks=[]
 for i,path in enumerate(files):
  tracks.append(meta(path))
  if (i+1)%5==0 and ids:tracks.append(meta(ids[((i+1)//5-1)%len(ids)],"station_id"))
 total=sum(x["duration_ms"] for x in tracks)
 out={"format":"ge-radio-clock-v1","epoch_utc_ms":EPOCH,"cycle_duration_ms":total,"tracks":tracks}
 out["playlist_hash"]=hashlib.sha256(json.dumps(tracks,sort_keys=True,separators=(",",":")).encode()).hexdigest()[:16]
 OUT.parent.mkdir(exist_ok=True)
 OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
 print("GE RADIO clock manifest: %s tracks, %.2f hours, hash %s"%(len(tracks),total/3600000,out["playlist_hash"]))
if __name__=="__main__":main()
