from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[1]
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
for name in ['stroke','spread']:
    frames=[]
    files=sorted((root/'media/frames').glob(name+'-*.png'))
    for i,file in enumerate(files):
        im=Image.open(file).convert('RGB')
        if name=='spread':
            im=im.crop((33,33,97,97)).resize((512,512),Image.Resampling.NEAREST)
            label=f'Wet ink spreading and drying | {i/6:.1f} simulated seconds'
        else:
            im=im.resize((842,468),Image.Resampling.LANCZOS)
            elapsed=(i+1)/15 if i<61 else 61/15+(i-60)/3
            label=f'GPU ink on smooth paper | {elapsed:.1f} simulated seconds'
        out=Image.new('RGB',(im.width,im.height+48),'#11151c');out.paste(im,(0,0));ImageDraw.Draw(out).text((14,im.height+12),label,font=font,fill='#e7e9ee');frames.append(out)
    durations=[70 if name=='stroke' and i<61 else 100 for i in range(len(frames))];durations[-1]=1800
    frames[0].save(root/f'media/ink-{name}.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True)
print('Created media/ink-stroke.gif and media/ink-spread.gif')

# Optional full-interface recording from capture-interface.mjs.
interface_files = sorted((root/'media/frames/interface').glob('*.png'))
if interface_files:
    frames = [Image.open(file).convert('RGB').resize((1008, 700), Image.Resampling.LANCZOS)
              for file in interface_files]
    durations = [80] * len(frames)
    if len(durations) > 47:
        durations[47] = 900
    durations[-1] = 1600
    frames[0].save(root/'media/interface-demo.gif', save_all=True,
                   append_images=frames[1:], duration=durations, loop=0, optimize=True)
    print('Created media/interface-demo.gif')
