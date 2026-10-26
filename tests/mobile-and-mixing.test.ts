import assert from "node:assert/strict";
import test from "node:test";
import { glassLayout, pouringLayout } from "../client/mixing-layout.js";
import { recolorFurPixels, walkingFurMask } from "../client/fur-color.js";
import { mobileCamera } from "../client/mobile-camera.js";
import { joystickVector } from "../client/touch-controls.js";

test("pouring starts only when the spout is vertically aligned with the glass mouth", () => {
  for (const glass of ["tall", "mug", "goblet"]) {
    for (const time of [0,50,100,200,300,350,1000]) {
      const pose = pouringLayout(glass, time, true);
      if (pose.stream) {
        assert.ok(Math.abs(pose.spout.x - pose.cup.mouth.x) < 1.2);
        assert.ok(pose.streamEnd.x > pose.cup.innerLeft && pose.streamEnd.x < pose.cup.innerRight);
        assert.ok(pose.streamEnd.y > pose.cup.mouth.y && pose.streamEnd.y < pose.cup.top + pose.cup.height * .16);
      }
    }
    assert.equal(pouringLayout(glass, 1000, false).stream, 0);
    assert.equal(pouringLayout(glass, 1000, true, true).stream, 1);
  }
});

test("bottle bounds clear the cup throughout its tilt, including wide mug handles", () => {
  for (const glass of ["tall", "mug", "goblet"]) for (let time=0; time<=350; time+=10) {
    const pose = pouringLayout(glass, time, true);
    const { cup, bottleScale: scale, tipInFrame: tip, angle } = pose;
    for (let sx=0; sx<=pose.bottleFrame.width; sx+=8) for (let sy=0; sy<=pose.bottleFrame.height; sy+=8) {
      const dx=(sx-tip.x)*scale, dy=(sy-tip.y)*scale;
      const x=pose.spout.x+dx*Math.cos(angle)-dy*Math.sin(angle);
      const y=pose.spout.y+dx*Math.sin(angle)+dy*Math.cos(angle);
      const insideCup=x>cup.left&&x<cup.left+cup.width&&y>cup.top&&y<cup.top+cup.height;
      assert.equal(insideCup,false,`${glass}: bottle overlaps at ${time}ms`);
    }
  }
});

test("glass openings share an anchor despite different art and handle padding", () => {
  for (const glass of ["tall", "mug", "goblet"]) {
    const cup=glassLayout(glass);
    assert.equal(cup.mouth.x,400);
    assert.ok(cup.mouth.x>cup.innerLeft&&cup.mouth.x<cup.innerRight);
    assert.equal(cup.top+cup.height,366);
  }
});

test("fur colors visibly replace warm source pixels while preserving alpha and masked clothing", () => {
  const source=new Uint8ClampedArray([230,185,150,255, 230,185,150,255, 60,35,75,255, 0,0,0,0]);
  const mask=new Uint8Array([1,0,1,1]);
  const blue=recolorFurPixels(source,"#2266ee",mask), red=recolorFurPixels(source,"#ee3322",mask);
  assert.ok(blue[2]>blue[0]*3);assert.ok(red[0]>red[2]*3);
  assert.deepEqual([...blue.slice(4)], [...source.slice(4)]);
  assert.equal(blue[3],255);assert.equal(blue[15],0);
  assert.deepEqual([...source.slice(0,4)],[230,185,150,255]);
});

test("walking masks include every facing's head and exclude the apron center", () => {
  const mask=walkingFurMask(1319,1193);
  for (const [x,y] of [[228,95],[215,380],[250,665],[245,960]]) assert.equal(mask[y*1319+x],1);
  for (const [x,y] of [[228,225],[205,520],[264,810],[245,1100]]) assert.equal(mask[y*1319+x],0);
});

test("touch joystick has a dead zone, normalized diagonals, and capped drag", () => {
  assert.deepEqual(joystickVector(2,3,40),{x:0,y:0});
  const diagonal=joystickVector(40,40,40);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<.00001);
  assert.deepEqual(joystickVector(500,0,40),{x:1,y:0});
  assert.deepEqual(joystickVector(0,-40,40),{x:0,y:-1});
});

test("phone and tablet cameras remain within the world and keep the cat visible", () => {
  for (const [width,height] of [[320,380],[390,480],[844,260],[1024,600]]) {
    for (const focus of [{x:90,y:120},{x:550,y:400},{x:995,y:630}]) {
      const camera=mobileCamera(focus,width,height);
      assert.ok(camera.x>=0&&camera.y>=0&&camera.width>0&&camera.height>0);
      assert.ok(camera.x+camera.width<=1088.001&&camera.y+camera.height<=712.001);
      assert.ok(focus.x>=camera.x&&focus.x<=camera.x+camera.width);
      assert.ok(focus.y>=camera.y&&focus.y<=camera.y+camera.height);
    }
  }
});
