import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { captureSoloSnapshot } from "../shared/solo-save.js";
import { gridCellCenter, initialState, type GameState, type Order, type Player } from "../shared/game.js";

const url = process.env.SMOKE_SERVER_URL ?? "http://localhost:3001";
const profile = (token: string) => ({ token, name: "Seating QA", role: "Tabby" as const, fur: "#e5a265", accessory: "Bow tie" });
const connect = () => new Promise<Socket>((resolve, reject) => {
  const socket = io(url, { forceNew: true, reconnection: false });
  socket.once("connect", () => resolve(socket)); socket.once("connect_error", reject);
});
const wait = (socket: Socket, predicate: (state: GameState) => boolean, timeoutMs = 5000) => new Promise<GameState>((resolve, reject) => {
  const timer = setTimeout(() => { socket.off("state", onState); reject(new Error("Timed out waiting for seating state")); }, timeoutMs);
  const onState = (state: GameState) => { if (predicate(state)) { clearTimeout(timer); socket.off("state", onState); resolve(state); } };
  socket.on("state", onState);
});
const orders = (): Order[] => [
  { id:"a", tableId:"table-1", seatId:"table-1-seat", recipeId:"catnip", customer:"Guest A", patience:160, maxPatience:200 },
  { id:"b", tableId:"table-1", seatId:"table-1-seat-2", recipeId:"moonmilk", customer:"Guest B", patience:140, maxPatience:200 },
  { id:"bar", tableId:"bar-1", seatId:"bar-stool-1", recipeId:"tuna", customer:"Bar guest", patience:160, maxPatience:200 }
];

async function main() {
  const checks = [];
  for (const scenario of [
    { name:"serve from right half of table", cell:[12,3], drink:"catnip", removed:"table-1-seat" },
    { name:"serve guest B directly at chair", cell:[12,0], drink:"moonmilk", removed:"table-1-seat-2" },
    { name:"serve bar guest from kitchen", cell:[7,1], drink:"tuna", removed:"bar-stool-1" },
    { name:"reject wrong chair without losing drink", cell:[12,0], drink:"catnip", removed:undefined },
    { name:"serve more urgent duplicate recipe", cell:[12,3], drink:"catnip", removed:"table-1-seat-2", duplicate:true }
  ]) {
    const socket = await connect(), token = `seating-${Date.now()}-${checks.length}`;
    try {
      const player: Player = { id:token, ...profile(token), ...gridCellCenter(...scenario.cell as [number,number]),
        direction:"down", moving:false, moveSequence:0, carrying:[], drink:scenario.drink, drinkQuality:1, connected:true, score:0 };
      const state = initialState("SAVED", token, 42); state.players[token] = player; state.phase = "shift"; state.orders = orders();
      if (scenario.duplicate) state.orders[1].recipeId = "catnip";
      let pending = wait(socket, state => state.pausedAt !== null);
      socket.emit("create-room", { ...profile(token), solo:true, snapshot:captureSoloSnapshot(state, token) }); await pending;
      pending = wait(socket, state => state.pausedAt === null); socket.emit("set-pause", false); await pending;
      pending = wait(socket, state => scenario.removed ? state.orders.length === 2 : state.message.includes("did not order"));
      socket.emit("interact"); const result = await pending;
      if (scenario.removed) {
        assert.ok(result.orders.every(order => order.seatId !== scenario.removed));
        assert.equal(result.players[token].drink, undefined); assert.ok(result.coins > 0);
      } else { assert.equal(result.orders.length, 3); assert.equal(result.players[token].drink, scenario.drink); }
      checks.push(scenario.name);
    } finally { socket.disconnect(); }
  }
  const host = await connect(), guest = await connect(), hostToken = `arrivals-${Date.now()}`, guestToken = `${hostToken}-guest`;
  try {
    let pending = wait(host, state => state.players[hostToken] !== undefined);
    host.emit("create-room", profile(hostToken)); const created = await pending;
    pending = wait(host, state => state.players[guestToken] !== undefined);
    guest.emit("join-room", { ...profile(guestToken), code:created.code }); await pending;
    pending = wait(host, state => Object.values(state.players).every(player => player.ready));
    host.emit("lobby-ready", true); guest.emit("lobby-ready", true); await pending;
    pending = wait(host, state => state.orders.length === 3, 28000); host.emit("start-shift"); const arrived = await pending;
    assert.deepEqual(arrived.orders.map(order => order.tableId), ["table-1", "bar-1", "table-1"]);
    assert.equal(new Set(arrived.orders.map(order => order.seatId)).size, 3);
    checks.push("natural arrivals fill a bar stool and both seats at one table");
  } finally { host.disconnect(); guest.disconnect(); }
  console.log(JSON.stringify({ ok:true, checks }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
