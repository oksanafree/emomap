import { type Intensity, type StateKey } from "@/lib/state-detection";

// Single source of truth for the instant location report shown right after a
// check-in. Deterministic (no AI): the text is chosen from (quadrant/edge/
// center, intensity tier, chosen emotion). English only for now — a later
// pass localizes this module for `ru`.

export type Quadrant = "Receiving" | "Building" | "Protecting" | "Enduring";
export type EdgeState = "Opening" | "Seeking" | "Bracing" | "Drifting";
export type Tier = "near" | "mid" | "far";

const QUADRANTS: Quadrant[] = ["Receiving", "Building", "Protecting", "Enduring"];

function isQuadrant(state: StateKey): state is Quadrant {
  return (QUADRANTS as string[]).includes(state);
}

// §1 — fixed emotion lists per quadrant, anxiety always last. Stored lowercase
// (canonical); the UI title-cases for display and the report lowercases in the
// "You feel …" lead.
export const QUADRANT_EMOTIONS: Record<Quadrant, string[]> = {
  Receiving: ["gratitude", "peace", "awe", "relief", "contentment", "tenderness", "anxiety"],
  Building: ["excitement", "confidence", "pride", "inspiration", "joy", "curiosity", "anxiety"],
  Protecting: ["frustration", "anger", "worry", "irritation", "defensiveness", "jealousy", "anxiety"],
  Enduring: ["sadness", "exhaustion", "hopelessness", "grief", "loneliness", "shame", "anxiety"],
};

// §6 — each non-anxiety emotion's expected home quadrant, derived from the
// lists above. anxiety is intentionally absent: it is expected in ALL
// quadrants and is never a contradiction.
export const EMOTION_HOME: Record<string, Quadrant> = Object.fromEntries(
  (Object.entries(QUADRANT_EMOTIONS) as [Quadrant, string[]][]).flatMap(([quadrant, list]) =>
    list.filter((e) => e !== "anxiety").map((e) => [e, quadrant] as const),
  ),
);

// Which two quadrants each transitional edge sits between (§4). Order is
// cosmetic — the merged picker de-dupes and appends anxiety once.
const EDGE_ADJACENT: Record<EdgeState, [Quadrant, Quadrant]> = {
  Opening: ["Receiving", "Building"], // situation good, agency ambiguous
  Seeking: ["Building", "Protecting"], // agency high, situation ambiguous
  Bracing: ["Protecting", "Enduring"], // situation hard, agency ambiguous
  Drifting: ["Enduring", "Receiving"], // agency low, situation ambiguous
};

function mergeEmotions(quadrants: Quadrant[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const quadrant of quadrants) {
    for (const emotion of QUADRANT_EMOTIONS[quadrant]) {
      if (emotion === "anxiety") continue;
      if (!seen.has(emotion)) {
        seen.add(emotion);
        out.push(emotion);
      }
    }
  }
  out.push("anxiety");
  return out;
}

// Emotions offered on the picker for a given map placement. Quadrants get their
// fixed list; edges merge both neighbours; center (Still) merges all four.
export function getEmotionsForState(state: StateKey): string[] {
  if (isQuadrant(state)) return QUADRANT_EMOTIONS[state];
  if (state === "Still") return mergeEmotions(QUADRANTS);
  const adjacent = EDGE_ADJACENT[state as EdgeState];
  if (adjacent) return mergeEmotions(adjacent);
  return mergeEmotions(QUADRANTS);
}

const TIER_BY_INTENSITY: Record<Intensity, Tier> = { low: "near", medium: "mid", high: "far" };

export function tierFromIntensity(intensity: Intensity): Tier {
  return TIER_BY_INTENSITY[intensity];
}

// A single fixed return nudge, shown prominently after every check-in
// regardless of state or intensity.
export const RETURN_NUDGE = "Come back soon — the more you log, the clearer your pattern.";

// The descriptive paragraph after the "You feel …" lead, per quadrant per tier.
const QUADRANT_BODY: Record<Quadrant, Record<Tier, string>> = {
  Receiving: {
    near: "Something gentle is here. Life is offering something small and good — easy to overlook. Let yourself notice it.",
    mid: "Life is giving right now and you're opening and letting it in. This is exactly right when you rest or absorb what's good. But if it goes on too long, something that needs your attention might go unnoticed.",
    far: "Life is fully giving and you're wide open to it. This is rare — let yourself be in it completely. Just don't lose sight of what might still need your attention.",
  },
  Building: {
    near: "Things are softly moving in your direction. A good moment to take a small step.",
    mid: "Circumstances are with you and you have the energy to act on them. This is when things get made — good time to start, push, or commit. Watch that momentum doesn't turn into rushing.",
    far: "Circumstances are fully with you and your energy is high. This is a powerful place — use it. Just make sure speed doesn't outrun judgment.",
  },
  Protecting: {
    near: "Something feels slightly off. You're alert but not yet in full defense. Worth paying attention to what's bothering you.",
    mid: "Something doesn't feel right and you're resisting it. That sharpness is useful to defend your stance. But when it lasts long it drains fast — worth asking whether the threat is still real.",
    far: "Something is clearly wrong and you're fully braced against it. At this intensity the body and mind burn through resources fast. This is when rest and support matter more than usual, even if they're the last thing on your mind.",
  },
  Enduring: {
    near: "Things feel harder than they could be and your capacity to change them feels limited. Look for any small thing that restores you.",
    mid: "Things are hard and there's little you can change right now. This is the state of carrying. Look for any small thing that restores you. Don't go too deep into it alone.",
    far: "The weight is real and it is heavy. This is when you need people around you most. Talk to someone.",
  },
};

// §3 — anxiety override text (any tier). Anxiety is offered in every quadrant;
// in Receiving/Building/Enduring it reads as a contrast to circumstances, in
// Protecting it is anxiety in its clearest form.
const QUADRANT_ANXIETY: Record<Quadrant, string> = {
  Receiving:
    "You feel anxious — even though circumstances are giving right now. This sometimes means you don't quite trust the good yet, or you're already thinking about what comes after it. Worth noticing what's getting in the way of letting it in.",
  Building:
    "You feel anxious — even as things are moving in your direction. This is often performance anxiety: the fear of failing precisely when succeeding is possible. Notice it, and keep going.",
  Protecting:
    "You feel anxious — and something genuinely doesn't feel right. This is anxiety in its clearest form: a signal that something needs attention. Trust it. And check whether the threat is still present or already passing.",
  Enduring:
    "You feel anxious — and the ground doesn't feel solid right now. This is the hardest kind of anxiety: when you can't act your way out of it. The most important thing right now is to not be alone in it.",
};

// §4 — transitional (edge) states. No emotion in the copy.
const EDGE_BODY: Record<EdgeState, Record<Tier, string>> = {
  Opening: {
    near: "Something good is here. You're neither rushing to act nor fully letting go. A gentle kind of freedom.",
    mid: "Something good is here. You're not rushing to use it and not just absorbing it either. You're in the space where receiving and acting are both possible. That's a position of real freedom.",
    far: "Circumstances are clearly giving and your energy is high — but the direction isn't set yet. You're fully alive in the open. That's not a problem. That's range.",
  },
  Seeking: {
    near: "You have some energy and the situation is unclear. You're alert without knowing quite what to do with it. That's fine — not everything needs to resolve.",
    mid: "You have energy and readiness. The situation hasn't declared itself yet — good or threatening, unclear. You're alert and able. That's a strong place to be.",
    far: "You feel highly alert — ready for anything, scanning everything. The situation still hasn't shown what it is. At this intensity that vigilance burns through you fast. Let yourself rest when you can.",
  },
  Bracing: {
    near: "Things feel difficult but you haven't fully landed on how to meet them. You're somewhere between pushing back and carrying it. That in-between is a real place.",
    mid: "Things are hard. You're neither fighting nor surrendering. This is one of the rarest places to hold.",
    far: "Things are very hard and you're at the edge of what you can resist. The line between fighting and carrying is thin right now. This is when you need support most — not to solve anything, just to not face it alone.",
  },
  Drifting: {
    near: "Things are quiet. Not clearly hard, not clearly good. You're still and open. A gentle place to be.",
    mid: "Things are quiet and you're open to them — whatever they are. You're not carrying anything heavy and not taking anything in yet. A place of stillness.",
    far: "You've let go completely. Not giving up — releasing. Whatever was being held or resisted isn't being held anymore. This is full surrender, and there's a profound stillness in it. Stay close to what feels safe.",
  },
};

// §5 — center (Still).
const CENTER_BODY =
  "You're at the center. Circumstances are neither giving nor taking. You're neither driving nor drifting. This is the place of maximum freedom — because you're not pulled in any direction. Everything is possible from here.";

function buildLead(tier: Tier, emotion: string): string {
  const lc = emotion.trim().toLowerCase();
  if (tier === "near") return `You feel a quiet ${lc}.`;
  if (tier === "far") return `You feel deep ${lc}.`;
  return `You feel ${lc}.`;
}

export type InstantReport = { body: string; nudge: string };

// Assemble the report paragraph + nudge for a placement. `emotion` is the raw
// stored value (may be a title-cased preset, a custom free-text string, or
// empty). When empty on a quadrant, the "You feel …" lead is dropped and the
// descriptive body stands alone.
export function buildInstantReport({
  state,
  intensity,
  emotion,
}: {
  state: StateKey;
  intensity: Intensity;
  emotion: string;
}): InstantReport {
  const tier = tierFromIntensity(intensity);
  const isAnxiety = emotion.trim().toLowerCase() === "anxiety";

  if (isQuadrant(state)) {
    if (isAnxiety) return { body: QUADRANT_ANXIETY[state], nudge: RETURN_NUDGE };
    const description = QUADRANT_BODY[state][tier];
    const body = emotion.trim() ? `${buildLead(tier, emotion)} ${description}` : description;
    return { body, nudge: RETURN_NUDGE };
  }

  if (state === "Still") return { body: CENTER_BODY, nudge: RETURN_NUDGE };

  const edgeBody = EDGE_BODY[state as EdgeState];
  if (edgeBody) return { body: edgeBody[tier], nudge: RETURN_NUDGE };

  // Fallback (should not happen): treat as center.
  return { body: CENTER_BODY, nudge: RETURN_NUDGE };
}

export type Contradiction = {
  contradicting: true;
  emotion: string;
  placementQuadrant: Quadrant;
  emotionHomeQuadrant: Quadrant;
};

// §6 — log when the chosen emotion's home quadrant differs from where the user
// placed themselves. Only quadrant placements can contradict; anxiety and
// unknown/custom emotions never do.
export function detectContradiction(state: StateKey, emotion: string): Contradiction | null {
  if (!isQuadrant(state)) return null;
  const key = emotion.trim().toLowerCase();
  if (!key || key === "anxiety") return null;
  const home = EMOTION_HOME[key];
  if (!home || home === state) return null;
  return { contradicting: true, emotion, placementQuadrant: state, emotionHomeQuadrant: home };
}
