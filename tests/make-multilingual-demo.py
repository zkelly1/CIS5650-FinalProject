from PIL import Image
from pathlib import Path
root=Path(__file__).resolve().parents[1]
palette=Image.open(root/'media/ukrainian-sunflower.png').convert('RGB').quantize(colors=128)
frames=[]
orchid_start=0
for name in ['sunflower-reference','orchid-reference']:
    if name=='orchid-reference': orchid_start=len(frames)
    for path in sorted((root/'media/frames'/name).glob('*.png')):
        with Image.open(path) as im:
            frames.append(im.convert('RGB').resize((1024,720),Image.Resampling.LANCZOS).quantize(palette=palette,dither=Image.Dither.NONE))
frames[0].save(root/'media/multilingual-demo.gif',save_all=True,append_images=frames[1:],duration=20,loop=0,optimize=True)
print(f'{len(frames)} frames; Ukrainian sunflower first, Chinese orchid second')

frames[orchid_start].save(root/'media/orchid-demo.gif',save_all=True,append_images=frames[orchid_start+1:],duration=20,loop=0,optimize=True)
