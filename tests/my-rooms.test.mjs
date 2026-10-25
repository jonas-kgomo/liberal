import test from "node:test";
import assert from "node:assert/strict";
import {addPeople, upsertRoom} from "../lib/my-rooms.mjs";

test("a created room stays created when it is opened again", () => {
 const created = upsertRoom([], {id: "room1234567890", secret: "a".repeat(24), question: "Roads", role: "created", hostName: "Maya", people: [{name: "Maya"}]});
 const again = upsertRoom(created, {id: "room1234567890", secret: "a".repeat(24), role: "joined", people: [{name: "Jordan"}]});
 assert.equal(again[0].role, "created");
 assert.deepEqual(again[0].people.map(person => person.name), ["Maya", "Jordan"]);
 assert.equal(again[0].question, "Roads");
});

test("people collapse to one row for the same name", () => {
 assert.deepEqual(addPeople([{name: "Maya"}], [{name: "maya"}, {name: "Libert"}, {name: "Jordan"}]).map(person => person.name), ["Maya", "Jordan"]);
});

test("a room without an invitation secret is not kept", () => {
 assert.deepEqual(upsertRoom([], {id: "room1234567890", question: "Roads", role: "created"}), []);
});
