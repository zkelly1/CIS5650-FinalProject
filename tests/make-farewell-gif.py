from PIL import Image
from pathlib import Path
root=Path(__file__).resolve().parents[1]
frames=[]
palette=Image.open(root/'media/farewell-english.png').convert('RGB').quantize(colors=96)
for path in sorted((root/'media/frames/farewell-reference').glob('*.png')):
    with Image.open(path) as im:
        frames.append(im.convert('RGB').resize((1024,720),Image.Resampling.LANCZOS).quantize(palette=palette,dither=Image.Dither.NONE))
frames[0].save(root/'media/farewell-demo.gif',save_all=True,append_images=frames[1:],duration=20,loop=0,optimize=True)
print(len(frames),'frames')
