import assert from "node:assert/strict";
import test from "node:test";
import { TUTORIAL_STEPS, tutorialState, tutorialSeen, rememberTutorial } from "../client/tutorial-content.js";
import { clipTutorialTarget, tutorialCardPosition } from "../client/tutorial-layout.js";
import { expectedMixingStep, pointCollidesWithCounters } from "../shared/game.js";

const profile={name:"Mittens",role:"Tabby" as const,fur:"#2266ee",accessory:"Bow tie"};

test("the opening tour covers the interface and supplies valid, isolated preview scenes",()=>{
  assert.equal(new Set(TUTORIAL_STEPS.map(step=>step.id)).size,TUTORIAL_STEPS.length);
  for(const step of TUTORIAL_STEPS){
    const state=tutorialState("tour",profile,step.scene);
    assert.equal(state.code,"TUTORIAL");assert.equal(state.hostId,"tour");assert.equal(state.shiftSeconds,180);
    assert.equal(state.health,3);assert.equal(state.coins,0);assert.equal(state.players.tour.fur,profile.fur);
    assert.equal(pointCollidesWithCounters(state.tavern,state.players.tour),false,`${step.id} cat has a safe position`);
    assert.ok(step.body.length<330,`${step.id} stays concise`);
  }
  for(const id of ["bartender","saves","crew","movement","action","orders","stats","pantry","carrying","chop","mixer","ingredients","timing","hold","chop-beat","paw-beat","serve","handoff","tidy","pause","book","settings","upgrades"])
    assert.ok(TUTORIAL_STEPS.some(step=>step.id===id),id);
});

test("workbench previews use real recipe steps and do not mutate neighboring scenes",()=>{
  for(const[scene,kind]of[["ingredients","ingredient"],["timed","timed-tool"],["chop-beat","rhythm"],["paw-beat","rhythm"]] as const){
    const state=tutorialState("tour",profile,scene);assert.equal(expectedMixingStep(state.mixing.tour)?.kind,kind);
    const clean=tutorialState("tour",profile,"serve");state.players.tour.carrying.length=0;
    assert.equal(clean.players.tour.drink,"catnip");assert.equal(Object.keys(clean.mixing).length,0);
  }
});

test("coach cards avoid a highlighted control when there is space and stay on small screens",()=>{
  for(const viewport of [{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:1440,height:960}]){
    const card={width:Math.min(352,viewport.width-24),height:290};
    for(const target of [{x:12,y:12,width:180,height:44},{x:viewport.width-170,y:viewport.height-90,width:156,height:65}]){
      const p=tutorialCardPosition(viewport,card,[target]);
      assert.ok(p.x>=12&&p.y>=12&&p.x+card.width<=viewport.width-12&&p.y+card.height<=viewport.height-12);
      const overlap=Math.max(0,Math.min(p.x+card.width,target.x+target.width)-Math.max(p.x,target.x))*
        Math.max(0,Math.min(p.y+card.height,target.y+target.height)-Math.max(p.y,target.y));
      assert.equal(overlap,0);
    }
    assert.equal(clipTutorialTarget({x:-500,y:-500,width:20,height:20},viewport),undefined);
    assert.deepEqual(clipTutorialTarget({x:-2,y:15,width:100,height:50},viewport),{x:6,y:15,width:92,height:50});
  }
  const safe={width:390,height:844,insets:{top:47,right:0,bottom:34,left:0}};
  const p=tutorialCardPosition(safe,{width:352,height:300},[{x:12,y:90,width:180,height:44}]);
  assert.ok(p.y>=59&&p.y+300<=798,"coach card stays clear of the notch and home indicator");
});

test("completion and skip are remembered independently of solo saves, with blocked storage tolerated",()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,"localStorage"),stored=new Map([["paws-pours-solo-slots-v2","keep this save"]]);
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)}});
  try{
    assert.equal(tutorialSeen(),false);rememberTutorial("skipped");assert.equal(tutorialSeen(),true);
    rememberTutorial("complete");assert.equal(tutorialSeen(),true);assert.equal(stored.get("paws-pours-solo-slots-v2"),"keep this save");
    Object.defineProperty(globalThis,"localStorage",{configurable:true,get(){throw new Error("Storage blocked");}});
    assert.equal(tutorialSeen(),false);assert.doesNotThrow(()=>rememberTutorial("skipped"));
  }finally{if(descriptor)Object.defineProperty(globalThis,"localStorage",descriptor);else Reflect.deleteProperty(globalThis,"localStorage");}
});
