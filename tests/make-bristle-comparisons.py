from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path(__file__).resolve().parents[1]
frames=root/'media/frames/bristle-compare'

def font(size, bold=False):
  for name in (['segoeuib.ttf','DejaVuSans-Bold.ttf','Arial Bold.ttf'] if bold else ['segoeui.ttf','DejaVuSans.ttf','Arial.ttf']):
    try: return ImageFont.truetype(name, size)
    except OSError: pass
  return ImageFont.load_default()

def sheet(out, title, subtitle, rows):
  panels=[Image.open(frames/f'{name}.png').convert('RGB') for name,_ in rows]
  width=1100; scale=(width-220)/panels[0].width
  panels=[p.resize((width-220,round(p.height*scale)),Image.Resampling.LANCZOS) for p in panels]
  pad, head, gap = 24, 96, 12
  img=Image.new('RGB',(width+2*pad, head+sum(p.height+gap for p in panels)+pad),'#11151c')
  d=ImageDraw.Draw(img)
  d.text((pad,pad),title,fill='#e7e9ee',font=font(30,True))
  d.text((pad,pad+42),subtitle,fill='#a9b1c1',font=font(18))
  y=head
  for (name,label),p in zip(rows,panels):
    d.text((pad,y+p.height//2),label,fill='#b9dbe8',font=font(22,True),anchor='lm')
    img.paste(p,(pad+220,y)); y+=p.height+gap
  img.save(root/'media'/out); print('saved media/'+out)

sheet('bristle-dryness.png','Bristle brush: brush dryness',
  'Same stroke on the rough-cardboard preset, 192 bristles. Drier brushes only touch the paper\'s peaks.',
  [(f'dryness-{v}',f'Dryness {v}') for v in ['0','0.25','0.5','0.75']])
sheet('bristle-counts.png','Bristle brush: bristle count',
  'Same stroke on the default paper with no water on the bristles (wetness 0), so individual hairs stay visible.',
  [(f'count-{n}',f'{n} bristles') for n in [8,32,128,512]])
sheet('bristle-depletion.png','Bristle brush: ink depletion',
  'Same stroke (left to right) on the default paper, 192 bristles, wetness 0. Faster depletion makes hairs run dry sooner.',
  [(f'depletion-{v}',f'Depletion {v}') for v in ['0','0.25','0.5','1']])
