from PIL import Image
from pathlib import Path
root=Path(__file__).resolve().parents[1]
paths=sorted((root/'media/frames/seepage').glob('[0-9]*.png'))
# A shared palette from painting, front and back captures prevents color flicker.
samples=[Image.open(paths[i]).convert('RGB').resize((360,280)) for i in [35,75,124,266,315,457,506]]
sheet=Image.new('RGB',(360*len(samples),280))
for i,im in enumerate(samples):sheet.paste(im,(i*360,0))
palette=sheet.quantize(colors=256)
frames=[]
for path in paths:
 with Image.open(path) as im:
  frames.append(im.convert('RGB').resize((1008,784),Image.Resampling.LANCZOS).quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG))
frames[0].save(root/'media/paper-seepage-demo.gif',save_all=True,append_images=frames[1:],duration=40,loop=0,optimize=True)
print(len(frames),'frames; saved media/paper-seepage-demo.gif')
