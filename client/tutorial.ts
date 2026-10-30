import { clipTutorialTarget, tutorialCardPosition, type TutorialRect } from "./tutorial-layout";
import { TUTORIAL_STEPS, tutorialControls, tutorialPlaysGame, type TutorialStep } from "./tutorial-content";
import "./tutorial.css";

export class Tutorial {
  private readonly root = document.createElement("section");
  private readonly card: HTMLElement;
  private index = 0;
  private frame?: number;
  private focusBefore?: HTMLElement;
  private inertBefore = false;
  private onClose?: (result:"complete"|"skipped")=>void;
  private feedback?: string;
  private readonly maskId = `tour-mask-${Math.random().toString(36).slice(2)}`;
  constructor(private readonly scope:HTMLElement, private readonly options: {
    touch:()=>boolean; step:(step:TutorialStep)=>void; targets:(step:TutorialStep)=>TutorialRect[]; avoid?:()=>TutorialRect[]; escape?:()=>boolean;
  }) {
    this.root.className="tutorial-layer"; this.root.hidden=true;
    this.root.innerHTML=`<svg class="tutorial-shade" aria-hidden="true"><defs><mask id="${this.maskId}" maskUnits="userSpaceOnUse"><rect class="tour-mask-base" fill="white" width="100%" height="100%"/><g class="tour-cutouts"></g></mask></defs><rect fill="#100d18" fill-opacity=".66" width="100%" height="100%" mask="url(#${this.maskId})"/><g class="tour-outlines"></g></svg>
      <article class="tutorial-card" role="dialog" aria-modal="false" aria-labelledby="tutorial-title" aria-describedby="tutorial-copy tutorial-tip">
        <header><span class="tutorial-step"></span><button class="tutorial-skip" type="button">Skip tutorial</button></header>
        <progress class="tutorial-progress" max="${TUTORIAL_STEPS.length}" aria-label="Tutorial progress"></progress>
        <div class="tutorial-words"><h2 id="tutorial-title"></h2><p id="tutorial-copy"></p><p id="tutorial-tip" role="status"></p><button class="tutorial-explain" type="button" hidden>Show instructions</button></div>
        <footer><button class="tutorial-back" type="button">Back</button><button class="tutorial-reset" type="button">Reset</button><button class="tutorial-next" type="button">Next</button></footer>
      </article>`;
    document.body.append(this.root); this.card=this.root.querySelector("article")!;
    this.root.querySelector<HTMLButtonElement>(".tutorial-skip")!.onclick=()=>this.finish("skipped");
    this.root.querySelector<HTMLButtonElement>(".tutorial-reset")!.onclick=()=>{
      if(this.card.classList.contains("practicing"))this.render();else this.practice();
    };
    this.root.querySelector<HTMLButtonElement>(".tutorial-explain")!.onclick=()=>{this.card.classList.remove("practicing");this.root.querySelector<HTMLButtonElement>(".tutorial-explain")!.hidden=true;this.position();this.schedule();};
    this.root.querySelector<HTMLButtonElement>(".tutorial-back")!.onclick=()=>{if(this.index>0){this.index--;this.render();}};
    this.root.querySelector<HTMLButtonElement>(".tutorial-next")!.onclick=()=>{
      if(this.index===TUTORIAL_STEPS.length-1)this.finish("complete"); else {this.index++;this.render();}
    };
    window.addEventListener("keydown",event=>{
      if(!this.isOpen)return;
      if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();if(!this.options.escape?.())this.finish("skipped");}
      if(event.key==="Tab"){
        const controls=[...document.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex='0']")]
          .filter(node=>node.getClientRects().length&&(this.card.contains(node)||this.allowed(node)));
        const index=controls.indexOf(document.activeElement as HTMLElement);
        const next=event.shiftKey?(index<=0?controls.length-1:index-1):(index+1)%controls.length;
        event.preventDefault();event.stopImmediatePropagation();controls[next]?.focus();
      }
    },true);
    for(const name of ["pointerdown","click","dblclick","contextmenu"])document.addEventListener(name,event=>{
      if(!this.isOpen||!(event.target instanceof Element)||this.card.contains(event.target))return;
      if(this.allowed(event.target)){if(name==="pointerdown")this.practice();return;}
      event.preventDefault();event.stopImmediatePropagation();
    },true);
    const schedule=()=>this.schedule();
    window.addEventListener("resize",schedule);window.addEventListener("scroll",schedule,true);
    window.visualViewport?.addEventListener("resize",schedule);
    if("ResizeObserver" in window)new ResizeObserver(schedule).observe(this.card);
    document.fonts?.addEventListener("loadingdone",schedule);
  }
  get isOpen(){return !this.root.hidden;}
  get step(){return TUTORIAL_STEPS[this.index];}
  private allowed(target:Element){
    const label=target.closest("label");
    return tutorialControls(this.step).some(selector=>Boolean(target.closest(selector)||label?.querySelector(selector)));
  }
  refresh(){this.schedule();}
  practice(){
    if(!this.isOpen||this.card.classList.contains("practicing"))return;
    this.card.classList.add("practicing");this.root.querySelector<HTMLButtonElement>(".tutorial-explain")!.hidden=false;this.position();this.schedule();
    this.root.querySelector(".tutorial-reset")!.textContent="Reset";
  }
  report(message:string){if(!this.isOpen||this.feedback===message)return;this.feedback=message;this.root.querySelector("#tutorial-tip")!.textContent=message;this.position();this.schedule();}
  start(onClose:(result:"complete"|"skipped")=>void){
    if(this.isOpen)return;
    this.focusBefore=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
    this.inertBefore=this.scope.inert;this.scope.inert=false;this.onClose=onClose;this.index=0;this.root.hidden=false;
    document.body.dataset.tutorialActive="true";
    this.render();this.root.querySelector<HTMLButtonElement>(".tutorial-next")!.focus();
  }
  private render(){
    const step=this.step,touch=this.options.touch();this.root.dataset.step=step.id;
    this.feedback=undefined;this.card.classList.remove("practicing");
    this.root.querySelector<HTMLButtonElement>(".tutorial-explain")!.hidden=true;
    this.root.querySelector<HTMLButtonElement>(".tutorial-reset")!.hidden=!tutorialPlaysGame(step)&&step.scene!=="upgrades";
    this.root.querySelector(".tutorial-reset")!.textContent="Try it";
    document.body.dataset.tutorialPractice=String(tutorialPlaysGame(step));
    this.options.step(step);
    this.root.querySelector(".tutorial-step")!.textContent=`Opening tour · ${this.index+1} of ${TUTORIAL_STEPS.length}`;
    this.root.querySelector<HTMLProgressElement>("progress")!.value=this.index+1;
    this.root.querySelector("h2")!.textContent=step.title;
    const touchBody=touch&&["movement","action"].includes(step.id);
    this.root.querySelector("#tutorial-copy")!.textContent=touchBody
      ? `${step.id==="movement"?"The kitchen is on the left and the guest tables are on the right. ":""}${step.touchTip}` :step.body;
    this.root.querySelector("#tutorial-tip")!.textContent=touch&&!touchBody&&step.touchTip?step.touchTip:
      touch&&step.id==="action"?"One button handles each station. No separate handoff button is needed.":step.tip??"";
    this.root.querySelector<HTMLButtonElement>(".tutorial-back")!.disabled=this.index===0;
    this.root.querySelector(".tutorial-next")!.textContent=this.index===TUTORIAL_STEPS.length-1?"Finish tour":this.index===0?"Show me around":"Next";
    this.card.querySelector(".tutorial-words")!.scrollTop=0;
    this.position();
    this.schedule();
  }
  private finish(result:"complete"|"skipped"){
    if(!this.isOpen)return;
    this.root.hidden=true;this.scope.inert=this.inertBefore;
    delete document.body.dataset.tutorialActive;delete document.body.dataset.tutorialPractice;
    if(this.frame!==undefined)cancelAnimationFrame(this.frame);
    this.frame=undefined;const done=this.onClose;this.onClose=undefined;done?.(result);
    if(this.focusBefore?.isConnected&&!this.focusBefore.closest(".hidden")&&!(this.focusBefore as HTMLButtonElement).disabled)
      this.focusBefore.focus({preventScroll:true});
  }
  private schedule(){
    if(!this.isOpen||this.frame!==undefined)return;
    this.frame=requestAnimationFrame(()=>{this.frame=requestAnimationFrame(()=>{this.frame=undefined;this.position();});});
  }
  private position(){
    if(!this.isOpen)return;
    const style=getComputedStyle(this.root);
    const viewport={width:document.documentElement.clientWidth,height:window.innerHeight,insets:{
      top:parseFloat(style.paddingTop)||0,right:parseFloat(style.paddingRight)||0,
      bottom:parseFloat(style.paddingBottom)||0,left:parseFloat(style.paddingLeft)||0}};
    const targets=this.options.targets(this.step).map(rect=>clipTutorialTarget(rect,viewport)).filter((r):r is TutorialRect=>Boolean(r));
    const wide=viewport.height<=520&&viewport.width>viewport.height&&targets.some(r=>r.width>viewport.width*.55);
    this.card.style.width=wide?`${Math.min(480,viewport.width-24)}px`:"";
    const avoids=this.card.classList.contains("practicing")?(this.options.avoid?.()??[]):[];
    const box=this.card.getBoundingClientRect(),p=tutorialCardPosition(viewport,box,[...targets,...avoids]);
    this.card.style.left=`${p.x}px`;this.card.style.top=`${p.y}px`;
    const svg=this.root.querySelector("svg")!;svg.setAttribute("viewBox",`0 0 ${viewport.width} ${viewport.height}`);
    const rects=targets.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="7"/>`).join("");
    this.root.querySelector(".tour-cutouts")!.innerHTML=rects;
    this.root.querySelector(".tour-outlines")!.innerHTML=rects;
  }
}
