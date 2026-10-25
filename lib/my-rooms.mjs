export const MY_ROOMS_KEY = "libert-my-rooms";

function text(value, max) {
 return String(value || "").trim().slice(0, max);
}

export function addPeople(current, incoming) {
 const known = new Map();
 for (const person of [...(current || []), ...(incoming || [])]) {
  const name = text(person?.name, 60);
  if (!name || name === "Libert") continue;
  const email = text(person?.email, 80).toLowerCase();
  const key = email || name.toLowerCase();
  const existing = known.get(key);
  if (!existing) known.set(key, {name, email});
  else if (email && !existing.email) known.set(key, {...existing, email});
 }
 return [...known.values()].slice(0, 12);
}

export function upsertRoom(rooms, entry, now = new Date().toISOString()) {
 const id = text(entry?.id, 48);
 const secret = text(entry?.secret || "", 128);
 if (!id || !secret) return Array.isArray(rooms) ? rooms : [];
 const prior = (rooms || []).find(room => room?.id === id) || {};
 const next = {
  id,
  secret,
  question: text(entry.question ?? prior.question, 300),
  role: prior.role === "created" || entry.role === "created" ? "created" : "joined",
  hostName: text(entry.hostName || prior.hostName, 60),
  hostEmail: text(entry.hostEmail || prior.hostEmail, 80).toLowerCase(),
  people: addPeople(prior.people, entry.people),
  createdAt: prior.createdAt || now,
  updatedAt: now
 };
 return [next, ...(rooms || []).filter(room => room?.id !== id)].slice(0, 24);
}

export function readRooms() {
 try {
  const value = JSON.parse(localStorage.getItem(MY_ROOMS_KEY) || "[]");
  return Array.isArray(value) ? value.filter(room => room?.id && room?.secret) : [];
 } catch {
  return [];
 }
}

export function rememberRoom(entry) {
 const rooms = upsertRoom(readRooms(), entry);
 try { localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(rooms)); } catch {}
 return rooms;
}

export function notePeople(id, people) {
 const rooms = readRooms();
 const prior = rooms.find(room => room.id === id);
 if (!prior) return rooms;
 return rememberRoom({...prior, people: addPeople(prior.people, people)});
}
