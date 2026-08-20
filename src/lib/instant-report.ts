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
  Protecting: ["frustration", "anger", "worry", "irritation", "defensiveness", "jealousy", "determination", "anxiety"],
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

// A fixed two-line return nudge, shown prominently after every check-in
// regardless of state or intensity.
export const RETURN_NUDGE_TITLE = "Your unique report is building.";
export const RETURN_NUDGE_BODY = "Come back soon! Every check-in adds to your inner world picture.";

// The descriptive paragraph after the "You feel …" lead, per quadrant per tier.
const QUADRANT_BODY: Record<Quadrant, Record<Tier, string>> = {
  Receiving: {
    near: "Something gentle is here. Life is offering something small and good.",
    mid: "Life is giving right now and you're opening and letting it in. This is exactly right when you rest or absorb what's good.",
    far: "Life is fully giving and you're wide open to it. This is rare — let yourself be in it completely.",
  },
  Building: {
    near: "Things are softly moving in your direction.",
    mid: "Circumstances are with you and you have the energy to act on them. This is when things get made — good time to start, push, or commit.",
    far: "Circumstances are fully with you and your energy is high. This is a powerful place — use it.",
  },
  Protecting: {
    near: "Something feels slightly off. You're alert but not yet in full defense.",
    mid: "Something doesn't feel right and you're resisting it. That sharpness is useful to defend your stance. But when it lasts long it drains fast — worth asking whether the threat is still real.",
    far: "Something is clearly wrong and you're fully braced against it. At this intensity the body and mind burn through resources fast. This is when rest and support matter more than usual, even if they're the last thing on your mind.",
  },
  Enduring: {
    near: "Things feel harder than they could be and your capacity to change them feels limited.",
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

// Every preset emotion word across all quadrants (lowercase). A chosen emotion
// not in this set is a user-entered "other".
const STANDARD_EMOTIONS = new Set(
  Object.values(QUADRANT_EMOTIONS)
    .flat()
    .map((emotion) => emotion.toLowerCase()),
);

function buildLead(quadrant: Quadrant, tier: Tier, emotion: string): string {
  const lc = emotion.trim().toLowerCase();
  // For a free-text "other" emotion the intensity modifier reads awkwardly
  // ("You feel a quiet <phrase>"), so drop it and use the plain lead.
  if (STANDARD_EMOTIONS.has(lc)) {
    // Protecting near reads better without the softening "a quiet".
    if (tier === "near" && quadrant !== "Protecting") return `You feel a quiet ${lc}.`;
    if (tier === "far") return `You feel deep ${lc}.`;
  }
  return `You feel ${lc}.`;
}

// ── Russian localization ──────────────────────────────────────────────────
// Rendered when locale === "ru". Verbatim from the RU spec: it deliberately
// keeps per-tier "come back" lines and directive closers that the English
// report no longer uses, so RU and EN diverge in wording and closing by design.

type RuEmotion = { acc: string; gen: string; gender: "f" | "m" | "n"; awe?: true };

// Chosen emotion (English canonical key) → Russian forms. `acc` = accusative
// (the form after "Ты чувствуешь …"); `gen` = genitive (Protecting-near
// "…причину <gen>"). Anxiety is handled by its own override text.
const RU_EMOTIONS: Record<string, RuEmotion> = {
  // Receiving
  gratitude: { acc: "благодарность", gen: "благодарности", gender: "f" },
  peace: { acc: "покой", gen: "покоя", gender: "m" },
  awe: { acc: "восхищение", gen: "восхищения", gender: "n", awe: true },
  relief: { acc: "облегчение", gen: "облегчения", gender: "n" },
  contentment: { acc: "удовлетворённость", gen: "удовлетворённости", gender: "f" },
  tenderness: { acc: "нежность", gen: "нежности", gender: "f" },
  // Building
  excitement: { acc: "воодушевление", gen: "воодушевления", gender: "n" },
  confidence: { acc: "уверенность", gen: "уверенности", gender: "f" },
  pride: { acc: "гордость", gen: "гордости", gender: "f" },
  inspiration: { acc: "вдохновение", gen: "вдохновения", gender: "n" },
  joy: { acc: "радость", gen: "радости", gender: "f" },
  curiosity: { acc: "любопытство", gen: "любопытства", gender: "n" },
  // Protecting
  frustration: { acc: "фрустрацию", gen: "фрустрации", gender: "f" },
  anger: { acc: "злость", gen: "злости", gender: "f" },
  worry: { acc: "беспокойство", gen: "беспокойства", gender: "n" },
  irritation: { acc: "раздражение", gen: "раздражения", gender: "n" },
  defensiveness: { acc: "обиду", gen: "обиды", gender: "f" },
  jealousy: { acc: "ревность", gen: "ревности", gender: "f" },
  determination: { acc: "решимость", gen: "решимости", gender: "f" },
  // Enduring
  sadness: { acc: "грусть", gen: "грусти", gender: "f" },
  exhaustion: { acc: "истощение", gen: "истощения", gender: "n" },
  hopelessness: { acc: "безнадёжность", gen: "безнадёжности", gender: "f" },
  grief: { acc: "горе", gen: "горя", gender: "n" },
  loneliness: { acc: "одиночество", gen: "одиночества", gender: "n" },
  shame: { acc: "стыд", gen: "стыда", gender: "m" },
};

// Near-tier adjective ("спокойн-"), agreeing with the emotion noun's gender.
const RU_NEAR_ADJ: Record<"f" | "m" | "n", string> = {
  f: "спокойную",
  m: "спокойный",
  n: "спокойное",
};

// восхищение (awe) takes a different construction at every tier.
const RU_AWE_LEAD: Record<Tier, string> = {
  near: "Ты в тихом восхищении.",
  mid: "Ты в восхищении.",
  far: "Ты в глубоком восхищении.",
};

// Body text AFTER the "Ты чувствуешь …" lead, per quadrant per tier.
// {gen} = the chosen emotion in the genitive (Protecting near only).
const QUADRANT_BODY_RU: Record<Quadrant, Record<Tier, string>> = {
  Receiving: {
    near: "Жизнь дарит приятное состояние и ты его принимаешь. Хорошо.",
    mid: "Жизнь к тебе добра, и ты принимаешь это. Это время отдохнуть и впитать хорошее. Запомни это состояние.",
    far: "Жизнь полностью с тобой — и ты принимаешь её всю. Это бывает редко.",
  },
  Building: {
    near: "Жизнь на твоей стороне. Ты в хорошем состоянии.",
    mid: "Обстоятельства на твоей стороне, и у тебя есть энергия действовать. Сейчас — время действовать.",
    far: "Обстоятельства полностью с тобой, и ты чувствуешь свои силы. Это очень активное состояние.",
  },
  Protecting: {
    near: "Что-то идёт не так и тебя это напрягает. Обрати внимание на причину {gen}.",
    mid: "Что-то идёт не так, и ты сопротивляешься этому. Если такая конфронтация длится долго, силы быстро уходят. Важно понимать, насколько реальна эта угроза или только её возможность?",
    far: "Что-то явно не так, и ты полностью в защите. При такой интенсивности ресурсы уходят быстро. Отдых и поддержка сейчас важнее обычного — даже если это последнее, о чём думаешь.",
  },
  Enduring: {
    near: "Обстоятельства непростые, и возможности что-то изменить сейчас ограничены. Прожить это время легче, когда есть поддержка.",
    mid: "Сейчас тебе тяжело, и изменить многое не в твоих силах. Сейчас важна любая поддержка. Не оставайся в одиночестве.",
    far: "Тяжесть реальна. Сейчас важнее всего быть рядом с людьми. Поговори с кем-нибудь.",
  },
};

const QUADRANT_ANXIETY_RU: Record<Quadrant, string> = {
  Receiving:
    "Ты чувствуешь тревогу — хотя сейчас жизнь к тебе добра. Иногда это значит, что тебе сложно принять хорошее — или ты уже думаешь о том, что будет потом.",
  Building:
    "Ты чувствуешь тревогу — хотя обстоятельства на твоей стороне. Часто это тревога перед успехом: страх не справиться именно тогда, когда всё возможно. Замечай её — это тоже важно.",
  Protecting:
    "Ты чувствуешь тревогу — и что-то действительно идёт не так. Это тревога в её самой ясной форме: сигнал, что что-то требует внимания. Доверяй ей. И проверь — угроза ещё здесь или уже прошла?",
  Enduring:
    "Ты чувствуешь тревогу — и почвы под ногами сейчас нет. Это самый трудный вид тревоги: когда действием из неё не выйти. Самое важное сейчас — не переживать это в одиночестве.",
};

const EDGE_BODY_RU: Record<EdgeState, Record<Tier, string>> = {
  Opening: {
    near: "Тебе хорошо и ты не торопишься действовать. Так ощущается свобода.",
    mid: "Тебе хорошо. Ты в пространстве, где возможно и активное действие, и полное расслабление. Это состояние настоящей свободы.",
    far: "Обстоятельства явно на твоей стороне, и энергия есть — но направление ещё не выбрано.",
  },
  Seeking: {
    near: "У тебя есть энергия, но ситуация ещё не прояснилась. Ты в готовности — и этого достаточно.",
    mid: "У тебя есть энергия и готовность. Ситуация ещё не показала себя — хорошая она или нет, пока неясно. Ты в готовности и можешь действовать. Это сильное место.",
    far: "Ты в высокой готовности — сканируешь всё вокруг. Ситуация ещё не определилась. При такой интенсивности бдительность быстро истощает. Отдохни, когда сможешь.",
  },
  Bracing: {
    near: "Ситуация непростая, и ещё не ясно, как с ней быть. Где-то между сопротивлением и принятием. Это реальное место.",
    mid: "Сейчас тяжело. Ты не борешься и не сдаёшься. Это одно из самых редких состояний.",
    far: "Ситуация очень тяжёлая, и ты на пределе того, что можешь выдержать. Граница между сопротивлением и принятием сейчас тонкая. Сейчас важнее всего поддержка — не чтобы что-то решить, а просто не переживать это в одиночестве.",
  },
  Drifting: {
    near: "Всё тихо. Не плохо и не хорошо. Ты принимаешь это.",
    mid: "Всё тихо, и ты принимаешь это — что бы это ни было. Состояние покоя.",
    far: "Ты полностью отпускаешь ситуацию. То, что держалось или сопротивлялось, больше не отнимает силы.",
  },
};

const CENTER_BODY_RU =
  "Ты в центре. Обстоятельства ни за тебя, ни против. Ты ни рулишь, ни дрейфуешь. Это место максимальной свободы — потому что ничто не отвлекает. Это состояние присутствия.";

// Per-tier "come back" line (RU only; EN uses the fixed two-line nudge).
const RETURN_NUDGE_RU: Record<Tier, string> = {
  near: "Возвращайся, если что-то изменится.",
  mid: "Возвращайся, когда что-то сдвинётся.",
  far: "Возвращайся, как только что-то изменится.",
};

function buildLeadRu(quadrant: Quadrant, tier: Tier, emotion: string): string {
  const data = RU_EMOTIONS[emotion.trim().toLowerCase()];
  if (data?.awe) return RU_AWE_LEAD[tier];
  if (!data) return `Ты чувствуешь ${emotion.trim()}.`; // user-entered "other"
  // The "спокойн-" adjective is used only on Receiving/Building near.
  if (tier === "near" && (quadrant === "Receiving" || quadrant === "Building")) {
    return `Ты чувствуешь ${RU_NEAR_ADJ[data.gender]} ${data.acc}.`;
  }
  if (tier === "far") return `Ты чувствуешь ${data.acc} — глубоко.`;
  return `Ты чувствуешь ${data.acc}.`;
}

function buildQuadrantBodyRu(quadrant: Quadrant, tier: Tier, emotion: string): string {
  const body = QUADRANT_BODY_RU[quadrant][tier];
  if (!body.includes("{gen}")) return body;
  // Only preset emotions have a declined genitive form. For a user-typed
  // "other" (or no emotion at all), drop the trailing "…причину <gen>."
  // sentence entirely rather than insert an undeclinable phrase.
  const gen = RU_EMOTIONS[emotion.trim().toLowerCase()]?.gen;
  if (!gen) return body.replace(/\s*[^.]*\{gen\}\.\s*$/, "");
  return body.replace("{gen}", gen);
}

function buildRuReport(state: StateKey, tier: Tier, emotion: string, isAnxiety: boolean): InstantReport {
  if (isQuadrant(state)) {
    if (isAnxiety) return { body: QUADRANT_ANXIETY_RU[state], comeBack: RETURN_NUDGE_RU[tier] };
    const description = buildQuadrantBodyRu(state, tier, emotion);
    const body = emotion.trim() ? `${buildLeadRu(state, tier, emotion)} ${description}` : description;
    return { body, comeBack: RETURN_NUDGE_RU[tier] };
  }
  if (state === "Still") return { body: CENTER_BODY_RU, comeBack: RETURN_NUDGE_RU.mid };
  const edgeBody = EDGE_BODY_RU[state as EdgeState];
  if (edgeBody) return { body: edgeBody[tier], comeBack: RETURN_NUDGE_RU[tier] };
  return { body: CENTER_BODY_RU, comeBack: RETURN_NUDGE_RU.mid };
}

// `comeBack` is the per-tier Russian "come back" line; it is null in English,
// where the closing is the fixed two-line nudge (RETURN_NUDGE_TITLE/BODY).
export type InstantReport = { body: string; comeBack: string | null };

// Assemble the report paragraph for a placement. `emotion` is the raw stored
// value (a title-cased preset, a custom free-text string, or empty). When
// empty on a quadrant, the "You feel …" lead is dropped and the descriptive
// body stands alone. `locale` selects English (default) or Russian.
export function buildInstantReport({
  state,
  intensity,
  emotion,
  locale,
}: {
  state: StateKey;
  intensity: Intensity;
  emotion: string;
  locale: string;
}): InstantReport {
  const tier = tierFromIntensity(intensity);
  const isAnxiety = emotion.trim().toLowerCase() === "anxiety";

  if (locale === "ru") return buildRuReport(state, tier, emotion, isAnxiety);

  if (isQuadrant(state)) {
    if (isAnxiety) return { body: QUADRANT_ANXIETY[state], comeBack: null };
    const description = QUADRANT_BODY[state][tier];
    const body = emotion.trim() ? `${buildLead(state, tier, emotion)} ${description}` : description;
    return { body, comeBack: null };
  }

  if (state === "Still") return { body: CENTER_BODY, comeBack: null };

  const edgeBody = EDGE_BODY[state as EdgeState];
  if (edgeBody) return { body: edgeBody[tier], comeBack: null };

  // Fallback (should not happen): treat as center.
  return { body: CENTER_BODY, comeBack: null };
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
