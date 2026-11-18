"""Encode the three-language farewell, preserving the full application view."""
from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'performance/farewell-milestone2-capture.json').read_text(encoding='utf8'))
paths=[root/manifest['frameDirectory']/f'{i:04d}.png' for i in range(manifest['frames'])]
assert len(paths)>10 and manifest['rotationDegrees']==360
samples=[root/f'media/farewell-m2-{language}.png' for language in ['english','russian','chinese']]
samples+=paths[::max(1,len(paths)//8)]
sheet=Image.new('RGB',(200*len(samples),200))
for i,path in enumerate(samples):
    with Image.open(path) as im: sheet.paste(im.convert('RGB').resize((200,200)),(i*200,0))
palette=sheet.quantize(colors=256)
frames=[]
for path in [samples[0]]+paths:
    with Image.open(path) as im:
        frames.append(im.convert('RGB').resize((1050,930),Image.Resampling.LANCZOS).quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG))
# Match the 1.5x pacing of the application demo, with cumulative GIF rounding.
durations=[];elapsed=0;encoded=0
for duration in [1200]+manifest['durationsMs']:
    elapsed+=duration/1.5;next_time=round(elapsed/10)*10
    durations.append(next_time-encoded);encoded=next_time
frames[0].save(root/'media/farewell-milestone2.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True,disposal=1)
print(len(frames),'frames; saved media/farewell-milestone2.gif')
