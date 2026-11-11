#!/usr/bin/env python3
"""Rough pitch contour of short sounds, to check that SUCCESS sounds rise and end high (a sound that ends on falling notes reads as
an error to a child). Usage: convert first, then run:
  ffmpeg -i some.ogg -ac 1 -ar 16000 /tmp/some.wav && python3 tools/sound_pitch.py '/tmp/some.wav'
Prints the average pitch of the first and last third and a UP / DOWN / flat verdict. Autocorrelation is crude (octave errors happen), so
also LISTEN. Added after the Escape Room unlock sound turned out to end with falling notes. See docs/kenney-asset-plan.md "Sound choices".
"""
import wave, struct, sys, glob, os
def load(p):
    w=wave.open(p); n=w.getnframes(); d=struct.unpack('<%dh'%n, w.readframes(n)); return [x/32768 for x in d], w.getframerate()
def pitch(win, sr):
    # autocorrelation pitch, 150-2500 Hz
    best=0; bl=0; e=sum(x*x for x in win)
    if e/len(win) < 1e-4: return None
    for lag in range(int(sr/2500), int(sr/150)):
        c=sum(win[i]*win[i+lag] for i in range(0,len(win)-lag,2))
        if c>best: best=c; bl=lag
    return sr/bl if bl and best>0.3*e/2 else None
for p in sorted(glob.glob(sys.argv[1])):
    x,sr=load(p); dur=len(x)/sr; step=int(sr*0.05); win=int(sr*0.04)
    ps=[]
    for i in range(0,len(x)-win,step):
        ps.append(pitch(x[i:i+win],sr))
    ps=[q for q in ps if q]
    if len(ps)<3: print(os.path.basename(p),'%.2fs'%dur,'(no clear pitch)'); continue
    third=max(1,len(ps)//3)
    a=sum(ps[:third])/third; b=sum(ps[-third:])/third
    trend='UP' if b>a*1.08 else 'DOWN' if b<a*0.92 else 'flat'
    print('%-24s %.2fs  start~%4.0fHz  end~%4.0fHz  %s'%(os.path.basename(p)[:-4],dur,a,b,trend))
