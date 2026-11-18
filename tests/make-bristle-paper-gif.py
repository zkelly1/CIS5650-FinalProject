from PIL import Image
from pathlib import Path
root=Path(__file__).resolve().parents[1]
paths=sorted((root/'media/frames/bristle-paper-full-page').glob('[0-9]*.png'))
first=Image.open(paths[0]); scale=1008/first.width; size=(1008,round(first.height*scale))
# A shared palette sampled across all scenes (inks, papers, interface) prevents colour flicker.
samples=[Image.open(paths[i]).convert('RGB').resize((size[0]//2,size[1]//2)) for i in range(0,len(paths),max(1,len(paths)//8))]
sheet=Image.new('RGB',(size[0]//2*len(samples),size[1]//2))
for i,im in enumerate(samples):sheet.paste(im,(i*(size[0]//2),0))
palette=sheet.quantize(colors=256)
frames=[]
for path in paths:
 with Image.open(path) as im:
  frames.append(im.convert('RGB').resize(size,Image.Resampling.LANCZOS).quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG))
frames[0].save(root/'media/bristle-paper-demo.gif',save_all=True,append_images=frames[1:],duration=50,loop=0,optimize=True)
print(len(frames),'frames; saved media/bristle-paper-demo.gif')
