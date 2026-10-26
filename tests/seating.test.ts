import assert from "node:assert/strict";
import test from "node:test";
import { gridCellCenter, initialState, makeTavern, nearbyStation, nextCustomerSeat, orderDestinationLabel,
  seatForOrder, servingOrderIndex, type Order, type Player, type Theme } from "../shared/game.js";
import { captureSoloSnapshot, restoreSoloSnapshot } from "../shared/solo-save.js";
import { seatedCustomerLayout } from "../client/customer-layout.js";
import { PLAYER_ANCHORS } from "../client/character-anchors.js";

const order = (id: string, tableId: string, seatId: string, recipeId = "catnip", patience = 60): Order =>
  ({ id, tableId, seatId, recipeId, customer: "Guest", patience, maxPatience: 80 });

test("arrivals use bar stools and two independent seats at the same table", () => {
  const tavern = makeTavern(42), orders: Order[] = [];
  for (let arrival = 0; arrival < 3; arrival++) {
    const seat = nextCustomerSeat(tavern, orders, arrival)!;
    orders.push(order(`guest-${arrival}`, seat.tableId!, seat.id));
  }
  assert.deepEqual(orders.map(guest => guest.tableId), ["table-1", "bar-1", "table-1"]);
  assert.equal(new Set(orders.map(guest => guest.seatId)).size, 3);
  assert.notEqual(seatForOrder(tavern, orders[0])?.id, seatForOrder(tavern, orders[2])?.id);
  assert.deepEqual(orders.map(orderDestinationLabel), ["Table 1 · A", "Bar 1", "Table 1 · B"]);
});

test("a full room never double-books a seat, and departures free exactly that seat", () => {
  const tavern = makeTavern(42), orders: Order[] = [];
  for (let index = 0; index < 12; index++) {
    const seat = nextCustomerSeat(tavern, orders, index)!;
    assert.ok(seat);
    orders.push(order(`guest-${index}`, seat.tableId!, seat.id));
  }
  assert.equal(new Set(orders.map(guest => guest.seatId)).size, 12);
  assert.equal(nextCustomerSeat(tavern, orders), undefined);
  const [departed] = orders.splice(3, 1);
  assert.equal(nextCustomerSeat(tavern, orders, 8)?.id, departed.seatId);
});

test("table and bar service match the correct guest without consuming a neighbor's order", () => {
  const tavern = makeTavern(42);
  const a = tavern.stations.find(station => station.id === "table-1-seat")!;
  const b = tavern.stations.find(station => station.id === "table-1-seat-2")!;
  const table = tavern.stations.find(station => station.id === "table-1")!;
  const bar = tavern.stations.find(station => station.id === "bar-1")!;
  const stool = tavern.stations.find(station => station.id === "bar-stool-1")!;
  const orders = [order("a", table.id, a.id), order("b", table.id, b.id, "moonmilk"), order("bar", bar.id, stool.id, "tuna")];
  assert.equal(servingOrderIndex(tavern, orders, b, "catnip"), -1);
  assert.equal(servingOrderIndex(tavern, orders, table, "tuna"), -1);
  assert.equal(servingOrderIndex(tavern, orders, b, "moonmilk"), 1);
  assert.equal(servingOrderIndex(tavern, orders, table, "moonmilk"), 1);
  assert.equal(servingOrderIndex(tavern, orders, bar, "tuna"), 2);
  assert.equal(servingOrderIndex(tavern, orders, stool, "tuna"), 2);
  orders[1].recipeId = "catnip"; orders[1].patience = 20;
  assert.equal(servingOrderIndex(tavern, orders, table, "catnip"), 1, "serve the more urgent matching guest first");
  orders.splice(1, 1);
  assert.equal(seatForOrder(tavern, orders[0])?.id, a.id);
  assert.equal(seatForOrder(tavern, orders[1])?.id, stool.id);
});

test("both halves of a long table can be approached from the front", () => {
  const tavern = makeTavern(42);
  for (const column of [11, 12, 14, 15]) {
    const target = nearbyStation(tavern, gridCellCenter(column, 3));
    assert.equal(target?.id, column < 14 ? "table-1" : "table-2");
  }
});

test("guest counters contain no pantry ingredients and remain linked to their stools", () => {
  const tavern = makeTavern(42);
  assert.ok(tavern.stations.filter(station => station.ingredient).every(station => station.gridX < 8));
  for (const stool of tavern.stations.filter(station => station.label === "Bar stool")) {
    const bar = tavern.stations.find(station => station.id === stool.tableId)!;
    assert.equal(bar.kind, "serve"); assert.equal(bar.serviceStyle, "bar");
    assert.equal(bar.gridY, stool.gridY); assert.equal(bar.gridX, stool.gridX - 1);
    assert.equal(stool.facing, "left");
  }
});

const player = { id:"solo", name:"QA", role:"Tabby", fur:"#e5a265", accessory:"Bow tie", ...gridCellCenter(3,8),
  direction:"down", moving:false, moveSequence:0, carrying:[], connected:true, score:0 } satisfies Player;

test("solo saves preserve paired table guests and bar seats, and migrate legacy orders", () => {
  const state = initialState("OLD", player.id, 42); state.players[player.id] = player; state.phase = "shift";
  state.orders = [order("a", "table-1", "table-1-seat"), order("b", "table-1", "table-1-seat-2"), order("bar", "bar-1", "bar-stool-1")];
  const restored = restoreSoloSnapshot(captureSoloSnapshot(state, player.id), "NEW", player)!;
  assert.deepEqual(restored.orders.map(guest => guest.seatId), state.orders.map(guest => guest.seatId));
  state.orders = [{ ...state.orders[0], seatId: undefined }];
  assert.equal(restoreSoloSnapshot(captureSoloSnapshot(state, player.id), "NEW", player)?.orders[0].seatId, "table-1-seat");
});

test("solo saves reject duplicated seats and seats attached to the wrong destination", () => {
  const state = initialState("OLD", player.id, 42); state.players[player.id] = player;
  state.orders = [order("a", "table-1", "table-1-seat"), order("b", "table-1", "table-1-seat")];
  assert.equal(restoreSoloSnapshot(captureSoloSnapshot(state, player.id), "NEW", player), undefined);
  state.orders = [order("a", "bar-1", "table-1-seat")];
  assert.equal(restoreSoloSnapshot(captureSoloSnapshot(state, player.id), "NEW", player), undefined);
});

test("seated customers align their body anchor with the cushion and omit walking feet", () => {
  for (const theme of ["Cozy Village Pub", "Haunted Moonlit Inn", "Pirate Cat Tavern"] as Theme[]) {
    for (const seat of makeTavern(42).stations.filter(station => station.kind === "seat")) {
      const pose = seatedCustomerLayout(seat, 400, 300, theme);
      const anchor = PLAYER_ANCHORS[seat.facing ?? "down"][0];
      const scale = pose.height / pose.frame.height;
      assert.ok(Math.abs(pose.left + (anchor.feetX - pose.frame.x) * scale - 400) <= 1);
      assert.ok(pose.bottom < 290, "body rests above the chair's floor contact");
      assert.equal(pose.top + pose.height, pose.bottom);
      assert.ok(pose.frame.height < 240, "walking legs are cropped at the hips");
    }
  }
});
