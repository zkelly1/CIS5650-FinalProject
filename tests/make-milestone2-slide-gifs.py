"""Encode actual GPU capture frames for the revised Milestone 2 deck."""
from pathlib import Path
import json
import sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def palette_from(images):
    sheet=Image.new('RGB',(256*len(images),256))
    for i,im in enumerate(images): sheet.paste(im.resize((256,256)),(256*i,0))
    return sheet.quantize(colors=256)
def save_gif(path,frames,durations):
    # Include the finished image twice so small orange/purple leaves retain color.
    pal=palette_from([frames[i] for i in [0,0,len(frames)//4,len(frames)//2,3*len(frames)//4,-1]])
    indexed=[im.quantize(palette=pal,dither=Image.Dither.FLOYDSTEINBERG) for im in frames]
    indexed[0].save(path,save_all=True,append_images=indexed[1:],duration=durations,loop=0,optimize=True,disposal=1)
    print(path.name,len(frames),path.stat().st_size)
manifest=json.loads((ROOT/'performance/landscape-capture.json').read_text())
landscape=[ROOT/manifest['frameDirectory']/f'{i:04d}.png' for i in range(manifest['frames'])]
if len(landscape)>10 and '--seepage-only' not in sys.argv:
    frames=[Image.open(p).convert('RGB').resize((1050,930),Image.Resampling.LANCZOS) for p in landscape]
    # Show the destination briefly, then draw from a blank sheet and hold the result.
    final=Image.open(ROOT/'media/landscape-interface.png').convert('RGB').resize((1050,930),Image.Resampling.LANCZOS)
    # GIF timing is quantized to 10 ms. Round cumulative time so the whole
    # drawing and rotation play at 1.5x without per-frame rounding drift.
    durations=[];elapsed=0;encoded=0
    for duration in [1200]+manifest['durationsMs']:
        elapsed+=duration/1.5
        next_time=round(elapsed/10)*10
        durations.append(next_time-encoded);encoded=next_time
    save_gif(ROOT/'media/landscape-drawing.gif',[final]+frames,durations)
if '--landscape-only' in sys.argv:
    sys.exit(0)
seepage=sorted((ROOT/'media/frames/seepage').glob('[0-9]*.png'))
assert len(seepage)==573,'Expected three matching 191-frame experiments'
for case,thickness in enumerate(['0.06','0.15','0.60']):
    frames=[]
    for i,path in enumerate(seepage[case*191:(case+1)*191]):
        # Preserve the complete page, controls, and original experiment annotation.
        im=Image.open(path).convert('RGB').resize((1008,868),Image.Resampling.LANCZOS)
        frames.append(im)
    save_gif(ROOT/f'media/seepage-{thickness}-comparison.gif',[frames[124]]+frames,[1300]+[50]*190+[1000])
