// Adds parameter toggles for bristles
import { BRISTLE_SLIDERS, DEFAULT_BRISTLE_PARAMS, type BristleBrush } from './bristle-brush';

export function installBristleUI(brush: BristleBrush, onToggle: (enabled: boolean) => void): void {
  const section = document.querySelector<HTMLElement>('.sliders');
  if (!section) return;
  const resetButton = section.querySelector('#reset-sliders');
  const make = (html: string) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };

  const toggle = make(`<label title="Replace the round brush tip with individual bristles."><span>Bristle brush</span><input type="checkbox" id="bristle-toggle" /><output></output></label>`);
  const checkbox = toggle.querySelector('input')!;
  checkbox.addEventListener('change', () => onToggle(checkbox.checked));
  section.insertBefore(toggle, resetButton);

  const inputs = BRISTLE_SLIDERS.map(s => {
    const label = make(`<label title="${s.title}"><span>${s.label}</span><input type="range" data-bristle="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" /><output></output></label>`);
    const input = label.querySelector('input')!;
    input.addEventListener('input', () => {
      brush.setParams({ [s.key]: Number(input.value) });
      input.nextElementSibling!.textContent = Number(input.value).toString();
    });
    section.insertBefore(label, resetButton);
    return input;
  });
  const sync = () => {
    for (const input of inputs) {
      input.value = String(brush.params[input.dataset.bristle as keyof typeof brush.params]);
      input.nextElementSibling!.textContent = Number(input.value).toString();
    }
  };
  resetButton?.addEventListener('click', () => { brush.setParams(DEFAULT_BRISTLE_PARAMS); sync(); });
  sync();
}
