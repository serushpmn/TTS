import type { Speaker, Voice } from "./types";

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function genderOf(voiceId: string, voices: Voice[]): string {
  return voices.find((voice) => voice.id === voiceId)?.gender ?? "Female";
}

export function voicesByGender(voices: Voice[], gender: string): Voice[] {
  return voices.filter((voice) => voice.gender === gender);
}

/** True when there are fewer than 2 speakers, or both Female and Male are present. */
export function hasMixedGenders(speakers: Speaker[], voices: Voice[]): boolean {
  if (speakers.length < 2 || voices.length === 0) return true;
  const genders = new Set(speakers.map((speaker) => genderOf(speaker.voice_id, voices)));
  return genders.has("Female") && genders.has("Male");
}

export function allowedGendersFor(
  speakerId: string,
  speakers: Speaker[],
  voices: Voice[],
): Array<"Female" | "Male"> {
  if (speakers.length < 2) return ["Female", "Male"];
  const others = speakers.filter((speaker) => speaker.id !== speakerId);
  const otherGenders = new Set(others.map((speaker) => genderOf(speaker.voice_id, voices)));
  if (!otherGenders.has("Female")) return ["Female"];
  if (!otherGenders.has("Male")) return ["Male"];
  return ["Female", "Male"];
}

function alternatingGenders(count: number): Array<"Female" | "Male"> {
  const start: "Female" | "Male" = Math.random() < 0.5 ? "Female" : "Male";
  const other: "Female" | "Male" = start === "Female" ? "Male" : "Female";
  return Array.from({ length: count }, (_, index) => (index % 2 === 0 ? start : other));
}

export function randomVoiceForSpeaker(
  speakerId: string,
  speakers: Speaker[],
  voices: Voice[],
): Voice | null {
  const allowed = allowedGendersFor(speakerId, speakers, voices);
  const pool = voices.filter((voice) => allowed.includes(voice.gender as "Female" | "Male"));
  if (!pool.length) return null;
  const current = speakers.find((speaker) => speaker.id === speakerId)?.voice_id;
  const choices = pool.length > 1 ? pool.filter((voice) => voice.id !== current) : pool;
  return pickRandom(choices);
}

export function randomizeSpeakerVoices(speakers: Speaker[], voices: Voice[]): Speaker[] {
  if (!voices.length) return speakers;
  const females = voicesByGender(voices, "Female");
  const males = voicesByGender(voices, "Male");
  if (!females.length || !males.length) return speakers;

  const genders = alternatingGenders(speakers.length);
  const used = new Set<string>();

  return speakers.map((speaker, index) => {
    const pool = genders[index] === "Female" ? females : males;
    const available = pool.filter((voice) => !used.has(voice.id));
    const choice = pickRandom(available.length ? available : pool);
    used.add(choice.id);
    return { ...speaker, voice_id: choice.id };
  });
}

export function nextSpeakerDefaults(
  speakers: Speaker[],
  voices: Voice[],
): { voice_id: string; name: string } {
  const females = voicesByGender(voices, "Female");
  const males = voicesByGender(voices, "Male");
  let need: "Female" | "Male";
  if (!speakers.length) {
    need = Math.random() < 0.5 ? "Female" : "Male";
  } else {
    const genders = new Set(speakers.map((speaker) => genderOf(speaker.voice_id, voices)));
    if (!genders.has("Female")) need = "Female";
    else if (!genders.has("Male")) need = "Male";
    else need = Math.random() < 0.5 ? "Female" : "Male";
  }
  const pool = need === "Female" ? females : males;
  const voice = pickRandom(pool.length ? pool : voices);
  return { voice_id: voice.id, name: voice.name };
}
