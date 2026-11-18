import type { InkParams } from './ink-simulation';

// Thickness belongs to the current sheet: changing brushes must never erase it.
export type BrushSettings = Omit<InkParams, 'thickness'>;
export const BRUSH_PRESETS: { id: string; name: string; description: string; params: BrushSettings }[] = [
  { id: 'round-brush', name: 'Round Brush', description: 'A balanced brush for everyday ink strokes.',
    params: { diffusion: .18, absorption: .65, settling: 1.1, waterLoad: 5, radius: 8, roughness: 0 } },
  { id: 'soft-wash', name: 'Soft Wash', description: 'A wide, wet brush for soft color washes.',
    params: { diffusion: .16, absorption: .6, settling: .7, waterLoad: 8, radius: 18, roughness: .1 } },
  { id: 'fine-detail', name: 'Fine Detail', description: 'A small, controlled brush for branches and lettering.',
    params: { diffusion: .04, absorption: 2, settling: 3, waterLoad: 1.5, radius: 2, roughness: .15 } },
  { id: 'dry-ink', name: 'Dry Ink', description: 'Less water and quick settling for textured marks.',
    params: { diffusion: .03, absorption: 3, settling: 4, waterLoad: 1, radius: 4, roughness: .7 } },
  { id: 'flowing-ink', name: 'Flowing Ink', description: 'A wet brush with more spreading and feathering.',
    params: { diffusion: .22, absorption: .3, settling: .4, waterLoad: 10, radius: 10, roughness: .3 } },
];

export function initBrushPresets(apply: (params: BrushSettings) => void) {
  const select = document.querySelector<HTMLSelectElement>('#brush-style')!;
  const description = document.querySelector<HTMLElement>('#brush-description')!;
  let selected = BRUSH_PRESETS[0];
  for (const preset of BRUSH_PRESETS) select.add(new Option(preset.name, preset.id));
  function sync() {
    description.textContent = selected.description;
  }
  function restore() { apply({ ...selected.params }); sync(); }
  select.addEventListener('change', () => {
    const next = BRUSH_PRESETS.find(preset => preset.id === select.value);
    if (!next) return;
    selected = next;
    restore();
  });
  document.querySelector('#reset-sliders')!.addEventListener('click', restore);
  sync();
  return { sync };
}
