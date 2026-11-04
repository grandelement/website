#!/usr/bin/env python3
"""GE Video Studio: render a Grand Element track with motion-interpolated video,
varied crossfades, and an optional GE logo. Requires local FFmpeg + FFprobe.
Designed for the GE Tampermonkey "VIDEO PROJECT" JSON manifest.
"""
import argparse
import array
import json
import math
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TRANSITIONS = (
    "fade", "dissolve", "smoothleft", "smoothright", "circleopen",
    "circleclose", "slideleft", "slideright", "wipeup", "wiperight",
    "zoomin", "radial", "pixelize", "hblur", "diagtr", "fadeblack"
)

def run(args, capture=True, cwd=None):
    p = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE if capture else None,
                       stderr=subprocess.PIPE if capture else None)
    if p.returncode:
        err = (p.stderr or b"").decode("utf-8", errors="replace")
        raise RuntimeError("Command failed: " + " ".join(map(str, args[:6])) +
                           "\n" + err[-2500:])
    return p.stdout or b""

def duration(path):
    data = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(path)])
    return float(data.decode().strip())

def audio_onsets(song, length, sample_rate=8000):
    """Find energy attacks without third-party Python dependencies. Not perfect
    beat detection: ambient tracks with weak transients fall back to even cuts."""
    length = min(length, 900)
    try:
        pcm = run(["ffmpeg", "-v", "error", "-i", str(song), "-t", str(length),
                   "-ac", "1", "-ar", str(sample_rate), "-f", "s16le", "-"])
    except RuntimeError:
        return []
    a = array.array("h")
    a.frombytes(pcm[:len(pcm)//2*2])
    if not a:
        return []
    step = int(sample_rate * 0.10)
    energies = []
    for i in range(0, len(a)-step, step):
        frame = a[i:i+step]
        rms = math.sqrt(sum((s / 32768.0)**2 for s in frame) / len(frame))
        energies.append(rms)
    peaks = []
    for i in range(3, len(energies)-3):
        before = sum(energies[i-3:i]) / 3
        attack = max(0.0, energies[i] - before)
        if attack > 0.004 and energies[i] >= max(energies[i-2:i+3]):
            peaks.append((i*0.1, attack))
    return peaks

def cut_times(track_duration, target_seconds, transition, peaks, maximum):
    """A cut marks the START of an xfade, not its midpoint."""
    cuts = []
    desired = target_seconds
    while desired < track_duration - max(3.5, target_seconds * 0.35) and len(cuts) < maximum-1:
        candidates = [(t,s) for (t,s) in peaks
                      if abs(t-desired) <= 1.4
                      and (not cuts or t-cuts[-1] >= 3.5)]
        if candidates:
            t = max(candidates, key=lambda z: z[1]*(1-0.22*abs(z[0]-desired)))[0]
        else:
            t = desired
        t = min(t, track_duration - 3.5)
        if not cuts or t - cuts[-1] >= transition + 1.0:
            cuts.append(round(t,3))
        desired += target_seconds
    return cuts

def quote_filter_path(filename):
    return str(filename).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest", help="GE-Video-Project.json exported by the Messenger userscript")
    p.add_argument("--song", help="Grand Element MP3/WAV/FLAC file (otherwise use song_file in JSON)")
    p.add_argument("--logo", help="Actual transparent GE ship/logo PNG file")
    p.add_argument("--output", default="GE-Music-Video.mp4")
    p.add_argument("--width", type=int, default=1280)
    p.add_argument("--height", type=int, default=720)
    p.add_argument("--fps", type=int, choices=[24,30,60], default=60)
    p.add_argument("--scene-seconds", type=float, default=18)
    p.add_argument("--transition-seconds", type=float, default=1.4)
    p.add_argument("--slow", type=float, default=3, help="3 means 10s source -> ~30s output")
    p.add_argument("--random-seed", type=int, default=29)
    p.add_argument("--max-scenes", type=int, default=80)
    p.add_argument("--no-optical-flow", action="store_true",
                   help="Faster preview: simpler duplicated frames rather than expensive interpolation")
    p.add_argument("--logo-always", action="store_true",
                   help="Keep smaller logo in the middle, rather than intro/outro only")
    p.add_argument("--dry-run", action="store_true", help="Write render plan without rendering")
    args = p.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        p.error("Install FFmpeg and ensure ffmpeg and ffprobe are on PATH.")
    if args.slow < 1 or args.slow > 8:
        p.error("--slow should be between 1 and 8.")
    if args.transition_seconds <= 0 or args.transition_seconds >= args.scene_seconds - 2:
        p.error("Transition duration must be positive and shorter than scene duration.")
    manifest = Path(args.manifest).resolve()
    doc = json.loads(manifest.read_text(encoding="utf-8"))
    folder = manifest.parent
    song = Path(args.song or doc.get("song_file","")).expanduser()
    if not song.is_absolute():
        song = folder / song
    song = song.resolve()
    if not song.is_file():
        p.error("Provide the Grand Element song using --song /path/to/song.mp3")
    track_duration = duration(song)
    if track_duration < 4:
        p.error("Audio must be at least 4 seconds long.")
    clips = []
    for c in doc.get("clips", []):
        if not isinstance(c, dict):
            continue
        filename = c.get("local_file")
        if not filename:
            continue
        path = Path(filename).expanduser()
        if not path.is_absolute():
            path = folder / path
        if path.is_file():
            clips.append({"path":path.resolve(),"credit":c.get("creator_credit") or "",
                          "id":c.get("id") or "", "source_url":c.get("source_url") or ""})
    if not clips:
        p.error("No downloaded clips found. Put source videos beside manifest and set each clip's local_file to its actual file name.")
    cuts = cut_times(track_duration, args.scene_seconds, args.transition_seconds,
                     audio_onsets(song,track_duration), args.max_scenes)
    starts = [0.0]+cuts
    scene_count=len(starts)
    rng=random.Random(args.random_seed)
    chosen=[clips[i % len(clips)] for i in range(scene_count)]
    transitions=[]
    last_effect=None
    for i in range(scene_count-1):
        effects=[x for x in TRANSITIONS if x!=last_effect]
        effect=rng.choice(effects)
        transitions.append(effect)
        last_effect=effect
    scene_lengths=[(starts[i+1]-starts[i]+args.transition_seconds)
                   if i < scene_count-1 else (track_duration-starts[i])
                   for i in range(scene_count)]
    plan={
      "project_name":doc.get("project_name","GE Music Video"),
      "song":str(song), "track_duration_seconds":round(track_duration,3),
      "resolution":[args.width,args.height], "fps":args.fps,
      "slow_motion_factor":args.slow, "optical_flow":not args.no_optical_flow,
      "transitions":transitions, "transition_seconds":args.transition_seconds,
      "scenes":[{"clip_id":chosen[i]["id"],"file":str(chosen[i]["path"]),
                  "time_start":round(starts[i],3),"rendered_scene_length":round(scene_lengths[i],3),
                  "creator_credit":chosen[i]["credit"]}
                 for i in range(scene_count)],
      "limitations":"Audio onset estimates can miss subtle beats; manually review optical-flow artifacts and permissions. EQ aura/flying animated ship not yet implemented."
    }
    outfile=Path(args.output).expanduser().resolve()
    outfile.parent.mkdir(parents=True,exist_ok=True)
    planfile=outfile.with_suffix(".render-plan.json")
    planfile.write_text(json.dumps(plan,indent=2)+"\n",encoding="utf-8")
    print("Render plan:",planfile)
    if args.dry_run:
        return
    logo = Path(args.logo).expanduser().resolve() if args.logo else None
    if logo is not None and not logo.is_file():
        p.error("Logo file not found; use your actual transparent GE PNG.")
    with tempfile.TemporaryDirectory(prefix="ge-video-") as work:
        work=Path(work)
        command=["ffmpeg","-hide_banner","-y","-i",str(song)]
        for clip in chosen:
            # Loop inputs rather than slowing a static final frame when a source is too short.
            command+=["-stream_loop","-1","-i",str(clip["path"])]
        if logo:
            command+=["-loop","1","-i",str(logo)]
        filt=[]
        for i, clip in enumerate(chosen):
            length=scene_lengths[i]
            source_seconds=max(0.2,length/args.slow+0.25)
            chain=[
                "trim=duration="+str(round(source_seconds,4)),
                "setpts=(PTS-STARTPTS)*"+str(args.slow),
            ]
            if not args.no_optical_flow and args.slow>1:
                chain.append("minterpolate=fps="+str(args.fps)+":mi_mode=mci:mc_mode=aobmc:me_mode=bidir")
            else:
                chain.append("fps="+str(args.fps))
            chain += [
                "scale="+str(args.width)+":"+str(args.height)+":force_original_aspect_ratio=increase",
                "crop="+str(args.width)+":"+str(args.height),
                "setsar=1","format=yuv420p","trim=duration="+str(round(length,4)),
                "setpts=PTS-STARTPTS"
            ]
            # Creator tags are visible, editable, separate from the original file title.
            credit=clip["credit"].strip()
            if credit:
                credit_file="credit_"+str(i).zfill(3)+".txt"
                (work/credit_file).write_text("Visuals: "+credit[:120], encoding="utf-8")
                chain.append("drawtext=textfile="+quote_filter_path(credit_file)+
                             ":fontcolor=white:fontsize=22:box=1:boxcolor=black@0.45"+
                             ":x=26:y=h-text_h-25")
            filt.append("["+str(i+1)+":v]"+",".join(chain)+"[v"+str(i)+"]")
        # Audio remains one uninterrupted Grand Element song; clip audio is discarded.
        current="v0"
        for i in range(scene_count-1):
            out="joined"+str(i)
            filt.append("["+current+"][v"+str(i+1)+"]xfade=transition="+
                        transitions[i]+":duration="+str(args.transition_seconds)+
                        ":offset="+str(starts[i+1])+"["+out+"]")
            current=out
        if logo:
            overlay_id=scene_count+1
            size = min(args.width,args.height)*(0.20 if args.logo_always else 0.34)
            size = int(size // 2 * 2)
            filt.append("["+str(overlay_id)+":v]scale="+str(size)+":-1,format=rgba[logo0]")
            if args.logo_always:
                filt.append("["+current+"][logo0]overlay=(W-w)/2:(H-h)/2:shortest=1[final]")
            else:
                # Second overlay instance for ending title-card/ship reveal.
                intro=min(5.0,track_duration/4)
                outro=min(7.0,track_duration/4)
                filt.append("[logo0]split=2[li][lo]")
                filt.append("[li]fade=t=in:st=0:d=1:alpha=1,"+
                            "fade=t=out:st="+str(max(0.0,intro-1.2))+
                            ":d=1.2:alpha=1[logoIntro]")
                filt.append("[lo]fade=t=in:st="+str(max(0.0,track_duration-outro))+
                            ":d=1.7:alpha=1[logoOutro]")
                filt.append("["+current+"][logoIntro]overlay=(W-w)/2:(H-h)/2:"+
                            "enable='between(t,0,"+str(round(intro,3))+")':eof_action=pass[withIntro]")
                filt.append("[withIntro][logoOutro]overlay=(W-w)/2:(H-h)/2:"+
                            "enable='gte(t,"+str(round(track_duration-outro,3))+")':eof_action=pass[final]")
            current="final"
        graph=work/"graph.txt"
        graph.write_text(";\n".join(filt)+"\n", encoding="utf-8")
        command+=["-filter_complex_script",str(graph),
                 "-map","["+current+"]","-map","0:a:0",
                 "-t",str(track_duration),"-r",str(args.fps),
                 "-c:v","libx264","-crf","20","-preset","medium",
                 "-pix_fmt","yuv420p","-c:a","aac","-b:a","192k",
                 "-movflags","+faststart",str(outfile)]
        print("Rendering",scene_count,"scenes to",outfile)
        r=subprocess.run(command,cwd=work)
        if r.returncode:
            raise RuntimeError("FFmpeg render failed. Inspect the FFmpeg error above. Render plan was preserved.")
    print("Finished:",outfile)
    print("Limitations: center aura and animated ship fly-through require a later compositor stage.")

if __name__ == "__main__":
    try: main()
    except (ValueError,RuntimeError,OSError,KeyError) as e:
        print("ERROR:",e,file=sys.stderr)
        sys.exit(1)
