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
    map.onclick = () => { this.overview = !this.overview; map.setAttribute("aria-pressed", String(this.overview)); map.textContent = this.overview ? "Follow" : "Map"; };
    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.reset(); });
    window.addEventListener("orientationchange", () => this.reset());
  }
  reset() { this.pointer = undefined; this.move({ x: 0, y: 0 }); this.knob.style.transform = "translate(0,0)"; }
  setEnabled(enabled: boolean) {
    if (this.enabled && !enabled) this.reset();
    this.enabled = enabled; this.pad.setAttribute("aria-disabled", String(!enabled));
    this.root.querySelectorAll<HTMLButtonElement>(".touch-actions button").forEach(button => button.disabled = !enabled);
  }
  setStatus(carry: string, interaction: string) {
    this.root.querySelector(".touch-carry")!.textContent = carry;
    const button = this.root.querySelector<HTMLButtonElement>(".touch-interact")!;
    button.textContent = interaction || "Interact";
  }
}
