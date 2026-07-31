// All email template content (subject lines, body copy, from-addresses) for
// the Cloud Functions email flows lives here, kept separate from the
// trigger/orchestration logic in index.ts so it can be found and edited
// without digging through function definitions.

export type Locale = "en" | "ru";

export function resolveLocale(value: unknown): Locale {
  return value === "ru" ? "ru" : "en";
}

// Every email that references Emomapp must link back to the app.
export const APP_URL = "https://emomapp.app/";

// Requires a domain (or subdomain, e.g. mail.emomapp.app) verified in the
// Resend dashboard — until that's done, sends from this address will fail.
export const EMAIL_FROM = "Emomapp <reminders@emomapp.app>";

// Distinct from EMAIL_FROM (reminders@emomapp.app) — the welcome and
// install-prompt emails send from reminder@ on the mail. subdomain verified
// in Resend.
export const WELCOME_EMAIL_FROM = "Emomapp <reminder@mail.emomapp.app>";

// -----------------------------------------------------------------------
// Daily reminder
// -----------------------------------------------------------------------

export type ReminderContent = { subject: string; body: string; cta: string; url: string };

export const REMINDER_CONTENT: Record<Locale, ReminderContent> = {
  en: {
    subject: "Mark yourself on Emomapp",
    body: "Hey! This is a reminder to log your mood on Emomapp. The best time to check in is right after something shifts — a difficult conversation, a burst of energy or a moment of calm. Open Emomapp when you feel it and add a note. The more you check in, the more detailed your report becomes.",
    cta: "Check in now →",
    url: "https://emomapp.app/en",
  },
  ru: {
    subject: "Отметься на Эмокарте",
    body: "Здравствуйте. Это напоминание зайти на Эмокарту и отметить ваше состояние. Лучший момент для отметки — сразу после того, как что-то изменилось. Тяжёлый разговор, прилив энергии или неожиданное спокойствие. Откройте Emomapp когда ощущаете, что пора. Чем чаще вы отмечаетесь на Эмокарте, тем подробнее будет отчёт о ваших скрытых тенденциях.",
    cta: "Отметиться →",
    url: "https://emomapp.app/ru",
  },
};

export function buildReminderEmailContent(content: ReminderContent) {
  const text = `${content.subject}\n\n${content.body}\n\n${content.cta} ${content.url}`;
  const html = `<p>${content.body}</p><p><a href="${content.url}">${content.cta}</a></p>`;
  return { text, html };
}

// -----------------------------------------------------------------------
// Welcome email
// -----------------------------------------------------------------------

export type WelcomeContent = {
  subject: string;
  intro: string;
  pitch: string;
  buildup: string;
  ctaLabel: string;
  milestones: string;
  telegramText: string;
  telegramLinkLabel: string;
  telegramUrl: string;
  signature: string;
};

export const WELCOME_CONTENT: Record<Locale, WelcomeContent> = {
  en: {
    subject: "Welcome to Emomapp",
    intro: "Welcome — and thank you for being a founding user.",
    pitch:
      "Most apps ask how you feel. Emomapp asks something different: how is the situation landing on you right now — and how much do you feel you can influence it? Two sliders, ten seconds, and you've placed yourself on the map.",
    buildup:
      "The picture builds over time. Check in a few times today — after a meeting, a meal, when your energy shifts. The trail those moments make is where the real patterns live.",
    ctaLabel: "Open Emomapp →",
    milestones: "After 5 check-ins, your first pattern report appears. After 20, the full picture.",
    telegramText:
      "Join our founding users community on Telegram — share what you notice, ask questions, help shape what this becomes:",
    telegramLinkLabel: "Join the group",
    telegramUrl: "https://t.me/+gpylW64kg_lkOTUx",
    signature: "Oksana",
  },
  ru: {
    subject: "Добро пожаловать в Эмокарту",
    // "одной из первых" in the original draft is grammatically feminine —
    // rephrased to stay gender-neutral, consistent with how the rest of the
    // app handles Russian copy that doesn't know the reader's gender.
    intro: "Добро пожаловать — и спасибо, что ты в числе первых.",
    pitch:
      "Большинство приложений спрашивают, что ты чувствуешь. Эмокарта спрашивает другое: как обстоятельства влияют на тебя прямо сейчас — и насколько ты чувствуешь, что можешь на них влиять? Два слайдера, десять секунд — и ты на карте.",
    buildup:
      "Картина складывается со временем. Делай отметки несколько раз в день — после встречи, после еды, когда что-то меняется. Траектория этих моментов — и есть настоящая картина.",
    ctaLabel: "Открыть Эмокарту →",
    milestones: "После 5 отметок появится первый отчёт о паттернах. После 20 — полная картина.",
    telegramText:
      "Присоединяйся к сообществу первых пользователей в Telegram — делись тем, что замечаешь, задавай вопросы, помогай формировать то, чем станет Эмокарта:",
    telegramLinkLabel: "Войти в группу",
    telegramUrl: "https://t.me/+CNtztWwlF6syODlh",
    signature: "Оксана",
  },
};

export function buildWelcomeEmailContent(content: WelcomeContent) {
  const html = [
    `<p>${content.intro}</p>`,
    `<p>${content.pitch}</p>`,
    `<p>${content.buildup}</p>`,
    `<p><a href="${APP_URL}">${content.ctaLabel}</a></p>`,
    `<p>${content.milestones}</p>`,
    `<p>${content.telegramText} <a href="${content.telegramUrl}">${content.telegramLinkLabel}</a></p>`,
    `<p>— ${content.signature}</p>`,
  ].join("");

  const text = [
    content.intro,
    content.pitch,
    content.buildup,
    `${content.ctaLabel} ${APP_URL}`,
    content.milestones,
    `${content.telegramText} ${content.telegramLinkLabel}: ${content.telegramUrl}`,
    `— ${content.signature}`,
  ].join("\n\n");

  return { html, text };
}

// -----------------------------------------------------------------------
// Install-prompt email — sent once, after the user's first check-in
// -----------------------------------------------------------------------

export type InstallPromptContent = {
  subject: string;
  intro: string;
  instructionsIntro: string;
  iosLabel: string;
  iosSteps: string;
  androidLabel: string;
  androidSteps: string;
  closing: string;
  signature: string;
  ctaLabel: string;
};

export const INSTALL_PROMPT_CONTENT: Record<Locale, InstallPromptContent> = {
  en: {
    subject: "Keep Emomapp one tap away",
    intro: "You made your first check-in.",
    instructionsIntro:
      "Now save Emomapp to your homescreen so it's always there when something shifts — no searching, no browser, one tap.",
    iosLabel: "On iPhone:",
    iosSteps: 'open emomapp.app in Safari → tap the Share button → "Add to Home Screen"',
    androidLabel: "On Android:",
    androidSteps: 'open emomapp.app in Chrome → tap the three-dot menu → "Add to Home Screen"',
    closing: "See you on the map.",
    signature: "Oksana",
    ctaLabel: "Open Emomapp →",
  },
  ru: {
    subject: "Держи Эмокарту под рукой",
    // "сделала" in the original draft is grammatically feminine — bracketed
    // to stay gender-neutral, matching the "ознакомился(лась)" pattern
    // already used for the signup consent checkboxes.
    intro: "Ты сделал(а) первую отметку.",
    instructionsIntro:
      "Теперь сохрани Эмокарту на экран телефона — чтобы она всегда была рядом, когда что-то меняется. Без поиска, без браузера, один тап.",
    iosLabel: "На iPhone:",
    iosSteps: 'открой emomapp.app в Safari → нажми кнопку «Поделиться» → «На экран "Домой"»',
    androidLabel: "На Android:",
    androidSteps: "открой emomapp.app в Chrome → нажми три точки → «Добавить на главный экран»",
    closing: "Увидимся на карте.",
    signature: "Оксана",
    ctaLabel: "Открыть Эмокарту →",
  },
};

export function buildInstallPromptEmailContent(content: InstallPromptContent) {
  const html = [
    `<p>${content.intro}</p>`,
    `<p>${content.instructionsIntro}</p>`,
    `<p><strong>${content.iosLabel}</strong> ${content.iosSteps}</p>`,
    `<p><strong>${content.androidLabel}</strong> ${content.androidSteps}</p>`,
    `<p>${content.closing}<br/>— ${content.signature}</p>`,
    `<p><a href="${APP_URL}">${content.ctaLabel}</a></p>`,
  ].join("");

  const text = [
    content.intro,
    content.instructionsIntro,
    `${content.iosLabel} ${content.iosSteps}`,
    `${content.androidLabel} ${content.androidSteps}`,
    `${content.closing}\n— ${content.signature}`,
    `${content.ctaLabel} ${APP_URL}`,
  ].join("\n\n");

  return { html, text };
}
