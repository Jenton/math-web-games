#!/bin/bash
# Copies and converts the chosen Kenney (CC0) assets into assets/kenney/. Re-runnable.
# Usage: tools/make_kenney_assets.sh "/path/to/Kenney Game Assets All-in-1 3.8.0"
# Images are downscaled (they are shown small) and audio is converted from Ogg to M4A (AAC) because older iPad Safari cannot play Ogg.
set -euo pipefail
K="${1:-/Volumes/JentMini Drive/AI Projects/Kenney Game Assets All-in-1 3.8.0}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/kenney"
A="$K/2D assets"; S="$K/Audio"
mkdir -p "$OUT"/{runner,escape,board,animals,aliens,tiles,balance,medals,fx,ui,archery,sfx,music,voice,fonts}

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
# Number Defense board: grass, dirt, tower pad and scenery from the Tower Defense pack (64 px top-down tiles)
for n in 038 048 119 130 131 133 135 136 137; do img "$A/Tower Defense/PNG/Default size/towerDefense_tile$n.png" "$OUT/board/t$n.png" 64; done
# Escape Room: Tiny Dungeon 16 px pixel tiles, scaled up 3x with nearest-neighbor so they stay crisp
TD="$A/Tiny Dungeon/Tiles"
for n in 0 10 11 28 29 40 46 48 49 50 54 55 63 64 75 82 84 85 89 92 96 97 120 121 122 114 116; do
  ffmpeg -loglevel error -y -i "$TD/tile_$(printf %04d $n).png" -vf "format=rgba,scale=48:48:flags=neighbor" -pix_fmt rgba "$OUT/escape/t$n.png"
done
# Number Line Runner: Pixel Platformer tiles (18 px) and characters (24 px), scaled 3x with nearest-neighbor so they stay crisp
PP="$A/Pixel Platformer/Tiles"
for n in 1 4 5 34 54 44 67 91 111 112 124 125 126 127 128 151; do
  ffmpeg -loglevel error -y -i "$PP/tile_$(printf %04d $n).png" -vf "format=rgba,scale=iw*3:ih*3:flags=neighbor" -pix_fmt rgba "$OUT/runner/t$n.png"
done
for n in 0 1 4 5 24 25; do
  ffmpeg -loglevel error -y -i "$PP/Characters/tile_$(printf %04d $n).png" -vf "format=rgba,scale=iw*3:ih*3:flags=neighbor" -pix_fmt rgba "$OUT/runner/c$n.png"
done
for n in 0 11 15; do
  ffmpeg -loglevel error -y -i "$PP/Backgrounds/tile_$(printf %04d $n).png" -vf "format=rgba,scale=iw*3:ih*3:flags=neighbor" -pix_fmt rgba "$OUT/runner/b$n.png"
done
# Arrow Range: ONE style family, smooth vector (Background Elements Remastered, Shooting Gallery, Platformer Pack Remastered, Toon Characters). No pixel art in this scene.
# Not in the bundle (draw as small original SVG): the bow, the arrow, the quiver. Findings: docs/game-ideas.md "Arrow Range: design plan" > "Art".
BG="$A/Background Elements Remastered"; SG="$A/Shooting Gallery/PNG"; TC="$A/Toon Characters"
img "$BG/Backgrounds/backgroundColorGrass.png"     "$OUT/archery/sky.png"        768
for f in hills hillsLarge cloudLayer1; do img "$BG/Backgrounds/Elements/$f.png" "$OUT/archery/$f.png" 768; done
for f in tree treeSmall_green1 bush1 castleWall castleWallAlt tower towerSmall cloud1 cloud2 cloud3; do img "$BG/PNG/Retina/$f.png" "$OUT/archery/$f.png" 192; done
img "$SG/Stall/bg_wood.png"            "$OUT/archery/wood.png"    256     # wooden platform / planks
img "$SG/Objects/stick_wood.png"       "$OUT/archery/post.png"    64      # support post
for f in target_colored target_red1 target_red3 target_white; do img "$SG/Objects/$f.png" "$OUT/archery/$f.png" 128; done   # ringed targets, 128 px
for f in flagRed1 flagRed2 flagRed_down; do img "$A/Platformer Pack Remastered/PNG/Items/$f.png" "$OUT/archery/$f.png" 128; done   # wind flag: two wave frames and a calm one
for who in male female; do   W=$([ $who = male ] && echo Male || echo Female)   # archer: side, idle, hold (arms up), attack0/1 (draw and release), cheer, hurt; 96 x 128
  for pose in side idle hold attack0 attack1 cheer0 hurt; do
    img "$TC/$W adventurer/PNG/Poses/character_${who}Adventurer_$pose.png" "$OUT/archery/${who}_$pose.png" 96
  done
done
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
snd "$R2/upgrade4.ogg"          sfx/solved   # rising chiptune sweep, same family as the coin ding (the old powerUp3 ended on falling notes)
snd "$I/glass_003.ogg"         sfx/level
snd "$IM/impactGeneric_light_001.ogg" sfx/place
snd "$I/maximize_004.ogg"      sfx/card
snd "$R2/lose2.ogg"            sfx/lose
snd "$R2/hurt2.ogg"            sfx/hurt
snd "$RPG/knifeSlice.ogg"      sfx/hit
snd "$I/drop_002.ogg"          sfx/pop    # soft bubble pop for Number Defense kills (the coin ding was too sharp to hear on every hit)
snd "$RPG/bookFlip1.ogg"       sfx/flip
for i in 00 08; do snd "$J/jingles-pizzicato_$i.ogg" sfx/win$i; done   # only rising jingles: 03 and 07 ended lower than they began
snd "$V/correct.ogg"           voice/correct
snd "$V/level_up.ogg"          voice/level_up
snd "$V/congratulations.ogg"   voice/congratulations
snd "$V/ready.ogg"             voice/ready
snd "$V/go.ogg"                voice/go
for n in 1 2 3 4 5 6 7 8 9 10; do snd "$V/$n.ogg" voice/$n; done
snd "$S/Music Loops/Loops/Farm Frolics.ogg" music/farm
snd "$S/Music Loops/Loops/Mishief Stroll.ogg" music/stroll
du -sh "$OUT"; find "$OUT" -type f | wc -l
