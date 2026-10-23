#!/usr/bin/env python3
"""Build one deterministic UTC playlist from real audio durations; fail closed."""
import datetime,hashlib,json,pathlib,subprocess
from urllib.parse import quote
ROOT=pathlib.Path(__file__).resolve().parents[2]
MUSIC=ROOT/"ge-music"/"music"
CLIPS=ROOT/"ge-music"/"clips"
OUT=ROOT/"radio"/"sync-playlist.json"
CATALOG_OUT=ROOT/"radio"/"track-durations.json"
AUDIO_EXTS={".mp3",".m4a",".aac",".wav",".ogg",".oga",".flac"}
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
 album=parent.rsplit(" - ",1)[-1]
 title=path.stem.split("_",1)[-1].replace("_"," ").strip()
 return dict(url="/"+quote(rel,safe="/"),path=rel,title=title,album=album,duration_ms=duration_ms(path),kind=kind)
def main():
 # Radio schedule is HARD FROZEN. Never rebuild sync-playlist.json when
 # files are uploaded. Only refresh complete file metadata for MUSIC/SHOP.
 # The primary BLITZ station sources immutable approved audio independently.
 ids=sorted(CLIPS.glob("GE Station Identification - *.m4a"))
 # Independent measured track catalog covers every GE album, including
 # Trio, Sessions I/II, Live and any Bangers selections outside the core rotation.
 # This is metadata only; no duplicate recordings are committed.
 catalog=[]
 for path in sorted(MUSIC.rglob("*"),key=lambda p:p.relative_to(ROOT).as_posix().casefold()):
  if not path.is_file() or path.suffix.lower() not in AUDIO_EXTS:continue
  # A corrupt, unsupported, or incomplete upload must fail the refresh, not
  # silently publish a misleading partial music/shop catalog.
  catalog.append(meta(path))
 for path in ids:
  try:catalog.append(meta(path,"station_id"))
  except Exception as exc:print("GE RADIO station clip metadata unavailable: %s (%s)"%(path,exc))
 if not any(x["kind"]=="song" for x in catalog):raise RuntimeError("Music catalog contains no playable album recordings")
 CATALOG_OUT.write_text(json.dumps({"format":"ge-radio-track-durations-v1","tracks":catalog},indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
 print("GE MUSIC album duration catalog updated: %s audio items; Radio schedule remains FROZEN"%(len(catalog)))
if __name__=="__main__":main()
