import test from "node:test";
import assert from "node:assert/strict";
import {interviewPrompt, roomQuestionPrompt, oneQuestion, fallbackQuestion, waitingVoices} from "../lib/interview.mjs";

test("an opening interview does not invent other people", () => {
 const prompt = interviewPrompt({question: "Should the street be car-free?", name: "Maya", mine: [], others: []});
 assert.match(prompt, /exactly one question/);
 assert.match(prompt, /Maya/);
 assert.match(prompt, /Do not follow a prepared list/);
 assert.match(prompt, /Do not refer to other people/);
 assert.doesNotMatch(prompt, /has said/);
 assert.doesNotMatch(prompt, /question \d+ of/);
});

test("a follow-up can use someone who has arrived", () => {
 const prompt = interviewPrompt({
  question: "Should the street be car-free?",
  name: "Maya",
  mine: [{author: "Maya", content: "I want quieter mornings."}],
  others: [{name: "Jordan", answers: ["Deliveries still need access."]}]
 });
 assert.match(prompt, /Jordan has said: Deliveries still need access/);
 assert.match(prompt, /without forcing agreement/);
});

test("waiting voices ignore Libert and the person being interviewed", () => {
 const voices = waitingVoices([
  {kind: "interview", author: "Libert", addressee: "Maya", content: "Where do you stand?"},
  {kind: "interview", author: "Maya", addressee: "Maya", content: "With the residents."},
  {kind: "interview", author: "Jordan", addressee: "Jordan", content: "Keep a delivery window."}
 ], "Maya");
 assert.deepEqual(voices, [{name: "Jordan", answers: ["Keep a delivery window."]}]);
});

test("questions stay to a single plain line", () => {
 assert.equal(oneQuestion("## First?\n\nSecond?"), "First?");
 assert.equal(fallbackQuestion({question: "", mine: [], others: []}).includes("think through"), true);
 assert.match(fallbackQuestion({question: "Roads", mine: [{author: "Maya", content: "Quieter mornings."}], others: [{name: "Sam", answers: ["No."]}]}), /Sam/);
 assert.match(fallbackQuestion({question: "Roads", mine: [{author: "Maya", content: "Quieter mornings."}], others: []}), /Quieter mornings/);
});

test("a room question is one question grounded in the room", () => {
 const prompt = roomQuestionPrompt({question: "Roads", turns: [{author: "Maya", content: "Quieter mornings."}]});
 assert.match(prompt, /exactly one question/);
 assert.match(prompt, /Maya: Quieter mornings/);
});
