export function interviewThread(events, name) {
 return (events || []).filter(event => event?.kind === "interview" && event.addressee === name);
}

export function waitingVoices(events, self) {
 const voices = new Map();
 for (const event of events || []) {
  if (event?.kind !== "interview" || !event.author || event.author === "Libert" || event.author === self) continue;
  const prior = voices.get(event.author) || [];
  prior.push(String(event.content || ""));
  voices.set(event.author, prior);
 }
 return [...voices.entries()].map(([name, answers]) => ({name, answers}));
}

export function oneQuestion(text) {
 const plain = String(text || "").replace(/[#*_`>]/g, "").trim();
 const line = plain.split(/\n+/).map(item => item.trim()).find(Boolean) || "";
 return line.slice(0, 420);
}

export function fallbackQuestion({question, mine, others}) {
 if (!mine?.length) {
  return question
   ? "What is your own view on “" + String(question).slice(0, 180) + "”, and what do you most want the others to understand?"
   : "What should this group think through, and where do you already stand?";
 }
 const other = (others || []).find(person => person.answers?.length);
 if (other) return other.name + " is here too. What would you want them to hear from you, and where might you still disagree?";
 return "What would someone who disagrees most need to hear from you?";
}

export function interviewPrompt({question, name, mine, others}) {
 const lines = [
  "You are Libert, a careful interview agent speaking with one person before a group discussion.",
  "Ask exactly one question. Use at most two short sentences. No headings, lists, synthesis, or advice.",
  "Draw out their view. Leave disagreement possible. Do not invent participants or put words in anyone's mouth.",
  "Discussion question: " + (question || "None set. Ask what they want the group to think through."),
  "Person you are interviewing: " + name
 ];
 if (mine?.length) {
  lines.push("This interview so far:");
  for (const turn of mine.slice(-8)) lines.push(turn.author + ": " + turn.content);
  lines.push("Ask the single best follow-up.");
 } else lines.push("They have not answered yet. Ask one opening question about their own view.");
 if (others?.length) {
  lines.push("Others are arriving in the waiting room. You may let this question take one of their views into account, without forcing agreement.");
  for (const person of others.slice(0, 8)) {
   const last = person.answers?.at(-1);
   lines.push(last ? person.name + " has said: " + String(last).slice(0, 500) : person.name + " has arrived and has not answered yet.");
  }
 } else lines.push("No one else has arrived. Do not refer to other people.");
 return lines.join("\n\n").slice(0, 11000);
}

export function roomQuestionPrompt({question, turns}) {
 const lines = [
  "You are Libert, interviewing a live group. Ask exactly one question to the room. At most two short sentences. No headings, lists, or synthesis.",
  "Use only what people have actually said. If their views differ, ask about that difference without forcing agreement. If little has been said, ask a question that helps the next person state their own view.",
  "Discussion question: " + (question || "Open discussion."),
  "What is in the room:"
 ];
 if (turns?.length) for (const turn of turns.slice(-20)) lines.push(turn.author + ": " + String(turn.content).slice(0, 700));
 else lines.push("Nothing yet.");
 return lines.join("\n\n").slice(0, 11000);
}
