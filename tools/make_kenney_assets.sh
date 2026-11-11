#!/bin/bash
# Copies and converts the chosen Kenney (CC0) assets into assets/kenney/. Re-runnable.
# Usage: tools/make_kenney_assets.sh "/path/to/Kenney Game Assets All-in-1 3.8.0"
# Images are downscaled (they are shown small) and audio is converted from Ogg to M4A (AAC) because older iPad Safari cannot play Ogg.
set -euo pipefail
K="${1:-/Volumes/JentMini Drive/AI Projects/Kenney Game Assets All-in-1 3.8.0}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/kenney"
A="$K/2D assets"; S="$K/Audio"
rm -rf "$OUT"; mkdir -p "$OUT"/{animals,aliens,tiles,balance,medals,fx,ui,sfx,music,voice,fonts}

img() { ffmpeg -loglevel error -y -i "$1" -vf "format=rgba,scale='min($3,iw)':-1:flags=lanczos" -pix_fmt rgba "$2"; }   # src dst maxwidth
for a in frog chick owl rabbit panda penguin pig cow; do img "$A/Animal Pack Remastered/PNG/Round/$a.png" "$OUT/animals/$a.png" 128; done
for c in Green Blue Pink Yellow Beige; do img "$A/Physics Assets/PNG/Aliens/alien${c}_round.png" "$OUT/aliens/$c.png" 128; done
for m in Wood Marble Yellow Blue Metal Box; do img "$A/Letter Tiles/PNG/$m/letter.png" "$OUT/tiles/$m.png" 128; done
# Balance: mystery (round, yellow) and weight blocks from Physics Assets, coins from Puzzle Pack 2
for c in Green Blue Pink Yellow Beige; do img "$A/Physics Assets/PNG/Aliens/alien${c}_square.png" "$OUT/balance/block$c.png" 96; done
for i in 01 02 03 04 05 06 07 08; do [ -f "$A/Puzzle Pack 2/PNG/Coins/coin_$i.png" ] && img "$A/Puzzle Pack 2/PNG/Coins/coin_$i.png" "$OUT/balance/coin$i.png" 96; done
for i in 1 2 3; do img "$A/Medals/PNG/flat_medal$((i*2+1)).png" "$OUT/medals/m$i.png" 96; done
for i in 01 05 09; do img "$A/Puzzle Pack 2/PNG/Pipes/Green/pipeGreen_$i.png" "$OUT/balance/pipe$i.png" 96; done
img "$A/Medals/PNG/flat_medal1.png" "$OUT/medals/m0.png" 96
for f in star_01 star_02 spark_01 spark_02 star_05; do [ -f "$A/Particle Pack/PNG (Transparent)/$f.png" ] && img "$A/Particle Pack/PNG (Transparent)/$f.png" "$OUT/fx/$f.png" 128; done
for e in exclamation question heart heartBroken stars idea faceHappy faceSad; do img "$A/Emote Pack/PNG/Vector/Style 1/emote_$e.png" "$OUT/ui/emote_$e.png" 64; done
cp "$K/Other/Fonts/Kenney Future.ttf" "$K/Other/Fonts/Kenney High.ttf" "$OUT/fonts/" 2>/dev/null || true

snd() { ffmpeg -loglevel error -y -i "$1" -c:a aac -b:a 64k -ac 1 -ar 44100 "$OUT/$2.m4a"; }
I="$S/Interface Sounds/Audio"; R2="$S/Retro Sounds 2/Audio"; D="$S/Digital Audio/Audio"; U="$S/UI Audio/Audio"; IM="$S/Impact Sounds/Audio"; V="$S/Voiceover Pack/Audio (Female)"; J="$S/Music Jingles/Audio (Pizzicato)"; RPG="$S/RPG Audio/Audio"
snd "$R2/coin3.ogg"            sfx/correct
snd "$D/pepSound3.ogg"         sfx/correct2
snd "$I/error_005.ogg"         sfx/wrong
snd "$I/bong_001.ogg"          sfx/wrong2
snd "$U/click3.ogg"            sfx/click
snd "$I/open_001.ogg"          sfx/open
snd "$I/close_001.ogg"         sfx/close
snd "$U/rollover2.ogg"         sfx/step
snd "$D/powerUp3.ogg"          sfx/solved
snd "$I/glass_003.ogg"         sfx/level
snd "$IM/impactGeneric_light_001.ogg" sfx/place
snd "$I/maximize_004.ogg"      sfx/card
snd "$R2/lose2.ogg"            sfx/lose
snd "$R2/hurt2.ogg"            sfx/hurt
snd "$RPG/knifeSlice.ogg"      sfx/hit
snd "$RPG/bookFlip1.ogg"       sfx/flip
for i in 00 03 07; do snd "$J/jingles-pizzicato_$i.ogg" sfx/win$i; done
snd "$V/correct.ogg"           voice/correct
snd "$V/level_up.ogg"          voice/level_up
snd "$V/congratulations.ogg"   voice/congratulations
snd "$V/ready.ogg"             voice/ready
snd "$V/go.ogg"                voice/go
for n in 1 2 3 4 5 6 7 8 9 10; do snd "$V/$n.ogg" voice/$n; done
snd "$S/Music Loops/Loops/Farm Frolics.ogg" music/farm
snd "$S/Music Loops/Loops/Mishief Stroll.ogg" music/stroll
du -sh "$OUT"; find "$OUT" -type f | wc -l
