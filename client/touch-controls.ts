import type { Vec } from "../shared/game";

export function joystickVector(x: number, y: number, radius: number): Vec {
  const length = Math.hypot(x, y);
  if (length < radius * .15) return { x: 0, y: 0 };
  const strength = Math.min(1, length / radius);
  return { x: x / length * strength, y: y / length * strength };
}

export class TouchControls {
  readonly root: HTMLElement;
  private readonly pad: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly carry: HTMLElement;
  private readonly interactButton: HTMLButtonElement;
  private pointer?: number;
  private enabled = false;
  overview = false;
  constructor(mount: HTMLElement, private readonly move: (input: Vec) => void,
    interact: () => void) {
    this.root = document.createElement("section"); this.root.className = "touch-controls";
    this.root.setAttribute("aria-label", "Touch game controls");
    this.root.innerHTML = `<div class="touch-readout"><span class="touch-carry">Paws empty</span><button type="button" class="touch-map" aria-pressed="false">Map</button></div>
      <div class="touch-inputs"><div><div class="touch-pad" role="group" aria-label="Drag to move your cat"><span class="touch-pad-knob"></span><span class="touch-pad-cross" aria-hidden="true">✥</span></div><span class="touch-hint">Drag to move</span></div>
      <div class="touch-actions"><button type="button" class="touch-interact">Interact</button></div></div>`;
    mount.append(this.root); this.pad = this.root.querySelector(".touch-pad")!; this.knob = this.root.querySelector(".touch-pad-knob")!;
    this.carry=this.root.querySelector(".touch-carry")!;this.interactButton=this.root.querySelector(".touch-interact")!;
    const point = (event: PointerEvent) => {
      const rect = this.pad.getBoundingClientRect(), radius = rect.width / 2;
      const vector = joystickVector(event.clientX - rect.left - radius, event.clientY - rect.top - radius, radius * .75);
      this.move(vector); this.knob.style.transform = `translate(${vector.x * 28}px,${vector.y * 28}px)`;
    };
    this.pad.addEventListener("pointerdown", event => {
      if (!this.enabled || this.pointer !== undefined) return;
      event.preventDefault(); this.pointer = event.pointerId; this.pad.setPointerCapture(event.pointerId); point(event);
    });
    this.pad.addEventListener("pointermove", event => { if (event.pointerId === this.pointer && this.enabled) point(event); });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) this.pad.addEventListener(name, () => this.reset());
    this.root.querySelector(".touch-interact")!.addEventListener("click", () => { if (this.enabled) interact(); });
    const map = this.root.querySelector<HTMLButtonElement>(".touch-map")!;
    map.onclick = () => this.setOverview(!this.overview);
    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.reset(); });
    window.addEventListener("orientationchange", () => this.reset());
  }
  reset() { this.pointer = undefined; this.move({ x: 0, y: 0 }); this.knob.style.transform = "translate(0,0)"; }
  setOverview(value:boolean) {
    this.overview=value;const map=this.root.querySelector<HTMLButtonElement>(".touch-map")!;
    map.setAttribute("aria-pressed",String(value));map.textContent=value?"Follow":"Map";
  }
  setEnabled(enabled: boolean) {
    if(this.enabled===enabled&&this.pad.hasAttribute("aria-disabled"))return;
    if (this.enabled && !enabled) this.reset();
    this.enabled = enabled; this.pad.setAttribute("aria-disabled", String(!enabled));
    this.interactButton.disabled = !enabled;
  }
  setStatus(carry: string, interaction: string) {
    if(this.carry.textContent!==carry)this.carry.textContent = carry;
    const label=interaction||"Interact";
    if(this.interactButton.textContent!==label)this.interactButton.textContent = label;
  }
}
