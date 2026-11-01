import { shiftAdvice, type ShiftReport } from "../shared/hospitality";

export function shiftReportContent(report: ShiftReport) {
  const stats=report.stats;
  return {
    metrics:[ ["Guests served",stats.served], ["Perfect drinks",stats.perfect], ["House Specials",stats.specials], ["Coins earned",stats.coinsEarned] ] as const,
    note:`${stats.missed} missed order${stats.missed===1?"":"s"} · ${stats.hazardsCleaned} spill${stats.hazardsCleaned===1?"":"s"} cleared · ${report.celebrationCount} tavern toast${report.celebrationCount===1?"":"s"}`,
    advice:shiftAdvice(stats),
    work:Object.values(stats.bartenders).map(work=>({name:work.name,description:[
      work.gathered?`${work.gathered} gathered`:"",work.chopped?`${work.chopped} chopped`:"",
      work.mixed?`${work.mixed} mixed`:"",work.served?`${work.served} served`:""
    ].filter(Boolean).join(" · ")})).filter(work=>work.description)
  };
}

export function renderShiftReport(report: ShiftReport): HTMLElement {
  const content=shiftReportContent(report),root=document.createElement("section");
  root.className="shift-report";root.setAttribute("aria-label",`Shift ${report.round} results`);
  const metrics=document.createElement("dl");metrics.className="shift-metrics";
  content.metrics.forEach(([label,value])=>{const group=document.createElement("div"),name=document.createElement("dt"),count=document.createElement("dd");name.textContent=label;count.textContent=String(value);group.append(count,name);metrics.append(group);});
  const note=document.createElement("p");note.className="shift-note";note.textContent=content.note;
  root.append(metrics,note);
  if(content.work.length){
    const title=document.createElement("h3");title.textContent="Every paw helped";root.append(title);
    const work=document.createElement("ul");work.className="shift-contributions";
    content.work.forEach(person=>{const item=document.createElement("li"),name=document.createElement("strong"),description=document.createElement("span");name.textContent=person.name;description.textContent=person.description;item.append(name,description);work.append(item);});root.append(work);
  }
  const advice=document.createElement("p");advice.className="shift-advice";advice.textContent=content.advice;root.append(advice);
  return root;
}
