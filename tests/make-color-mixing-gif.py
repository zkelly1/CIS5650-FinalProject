from PIL import Image
from pathlib import Path
root=Path(__file__).resolve().parents[1]
# Shared palette includes both the dark interface and all overlapping ink colors.
palette=Image.open(root/'media/color-mixing-page.png').convert('RGB').quantize(colors=256)
frames=[]
for path in sorted((root/'media/frames/color-mixing-light-glazes').glob('[0-9]*.png')):
 with Image.open(path) as im:
  frames.append(im.convert('RGB').resize((1152,992),Image.Resampling.LANCZOS).quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG))
# Pause on the completed three-way blend so viewers can compare each overlap.
durations=[40]*len(frames)
durations[-1]=2500
frames[0].save(root/'media/color-mixing-demo.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True)
print(len(frames),'frames')
