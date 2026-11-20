/** Interface translations. Story text is translated by the hourly job (see synthesize.ts). */
import type { Category } from "./types";

export const LOCALES = ["en", "es", "zh", "ja", "de", "fr", "ko", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** BCP 47 tags for <html lang> and Intl date formatting. */
export const LOCALE_TAG: Record<Locale, string> = { en: "en-US", es: "es-ES", zh: "zh-CN", ja: "ja-JP", de: "de-DE", fr: "fr-FR", ko: "ko-KR", pt: "pt-BR" };
/** hreflang alternates for search engines: every language version of the home page. */
export const LOCALE_ALTERNATES: Record<string, string> = { en: "/", es: "/es", "zh-Hans": "/zh", ja: "/ja", de: "/de", fr: "/fr", ko: "/ko", "pt-BR": "/pt" };
export const LOCALE_NAME: Record<Locale, string> = { en: "EN", es: "ES", zh: "中文", ja: "日本語", de: "DE", fr: "FR", ko: "한국어", pt: "PT" };
export const LOCALE_LABEL: Record<Locale, string> = { en: "English", es: "Español", zh: "简体中文", ja: "日本語", de: "Deutsch", fr: "Français", ko: "한국어", pt: "Português" };

/** First-visit tooltip, written in the language it offers. */
export const LOCALE_NUDGE: Record<Locale, string> = {
  en: "Read in English?",
  es: "¿Leer en español?",
  zh: "切换到简体中文？",
  ja: "日本語で読みますか？",
  de: "Auf Deutsch lesen?",
  fr: "Lire en français ?",
  ko: "한국어로 읽으시겠어요?",
  pt: "Ler em português?",
};

/** The first supported language in the browser's list ("pt-BR" -> pt, "zh-TW" -> zh), or null. */
export function preferredLocale(languages: readonly string[]): Locale | null {
  for (const tag of languages) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

/** "/" for English, "/es", "/zh", ... otherwise. */
export const localePath = (locale: Locale) => (locale === DEFAULT_LOCALE ? "/" : `/${locale}`);

export interface Dictionary {
  tagline: string;
  /** Short label before the publishing hours on phones. */
  hoursLabel: string;
  finiteEdition: string;
  timeMachineLabel: string;
  latestSuffix: string;
  selectEdition: string;
  nextDrop: string;
  /** Tag that fades in briefly when a new edition loads. */
  newEdition: string;
  nextShort: string;
  savedStories: string;
  toggleTheme: string;
  compactView: string;
  expandedView: string;
  categoryTitle: Record<Category, string>;
  categoryTab: Record<Category, string>;
  snapshotLocked: (date: string) => string;
  read: (n: number, total: number) => string;
  whyItMatters: string;
  badgeNew: string;
  badgeNewTitle: string;
  badgeHot: string;
  badgeHotTitle: string;
  sources: (n: number) => string;
  readMark: string;
  bookmark: string;
  removeBookmark: string;
  copyLink: string;
  /** Thumbs on each story (not saved; just for this visit). */
  rateUp: string;
  rateDown: string;
  timeMachineBadge: string;
  viewingSnapshot: string;
  jumpToLatest: (time: string) => string;
  noStoriesInCategory: string;
  caughtUpTitle: string;
  caughtUpBody: (n: number) => string;
  savedTitle: string;
  savedSubtitle: string;
  noSaved: string;
  noSavedHint: string;
  remove: string;
  close: string;
  missingTitle: string;
  missingBody: string;
  goLatest: string;
  firstEditionTitle: string;
  firstEditionBody: string;
  presentedBy: (name: string) => string;
  sponsored: string;
  paidPlacement: (name: string) => string;
  advertise: string;
  reachReaders: string;
  sponsorEdition: (category: string) => string;
  toasts: {
    topOfHour: string;
    loadedEdition: (label: string) => string;
    saved: string;
    removed: string;
    copied: (rank: number) => string;
  };
  footer: {
    rights: string;
    terms: string;
    privacy: string;
    publishers: string;
    advertise: string;
    englishOnly: string;
  };
  aiNote: string;
}

const en: Dictionary = {
  tagline: "Every hour’s top 10 news",
  hoursLabel: "Updates",
  finiteEdition: "Finite Edition",
  timeMachineLabel: "Time Machine Snapshot",
  latestSuffix: " (Latest)",
  selectEdition: "Select an edition",
  nextDrop: "Next drop",
  newEdition: "New edition",
  nextShort: "Next",
  savedStories: "Saved stories",
  toggleTheme: "Toggle appearance",
  compactView: "Compact View",
  expandedView: "Expanded View",
  categoryTitle: { tech: "Top 10 Tech & AI", finance: "Top 10 Finance & Markets", politics: "Top 10 US Politics", world: "Top 10 World", health: "Top 10 Health" },
  categoryTab: { tech: "Tech & AI", finance: "Finance & Markets", politics: "US Politics", world: "World", health: "Health" },
  snapshotLocked: (d) => `Snapshot locked ${d} · Ranked by multi-source velocity`,
  read: (n, t) => `${n}/${t} read`,
  whyItMatters: "Why it matters:",
  badgeNew: "New",
  badgeNewTitle: "First hour in the Top 10",
  badgeHot: "Hot",
  badgeHotTitle: "Many newsrooms are covering this right now",
  sources: (n) => `${n} ${n === 1 ? "Source" : "Sources"}:`,
  readMark: "✓ Read",
  bookmark: "Bookmark story",
  removeBookmark: "Remove bookmark",
  copyLink: "Copy permanent snapshot link",
  rateUp: "Good pick",
  rateDown: "Not for me",
  timeMachineBadge: "TIME MACHINE",
  viewingSnapshot: "Viewing immutable snapshot from",
  jumpToLatest: (t) => `Jump to Latest (${t}) →`,
  noStoriesInCategory: "No stories in this category for this hour.",
  caughtUpTitle: "You’re all caught up for this hour.",
  caughtUpBody: (n) => `That’s all ${n} stories for this category. Step away, get back to work, and check back at the top of the hour—or switch tabs above to scan another beat.`,
  savedTitle: "Saved Briefings",
  savedSubtitle: "Stories bookmarked across hourly snapshots",
  noSaved: "No saved stories yet",
  noSavedHint: "Click the bookmark icon on any ranked story to save it here.",
  remove: "Remove",
  close: "Close",
  missingTitle: "No edition for that hour",
  missingBody: "We couldn't find a published snapshot for",
  goLatest: "Go to the latest edition →",
  firstEditionTitle: "The first edition is on its way",
  firstEditionBody: "Editions are locked at the top of every hour. Check back after the next drop.",
  presentedBy: (n) => `Presented by ${n}`,
  sponsored: "Sponsored",
  paidPlacement: (n) => `Paid placement by ${n} · not part of the Top 10`,
  advertise: "Advertise",
  reachReaders: "Reach thousands of readers every hour.",
  sponsorEdition: (c) => `Sponsor the ${c} Edition →`,
  toasts: {
    topOfHour: "Top of the hour! Fresh snapshot locked.",
    loadedEdition: (l) => `Time Machine: Loaded ${l} edition`,
    saved: "Saved to your reading list",
    removed: "Removed from Saved Briefings",
    copied: (r) => `Copied snapshot link for #${r}`,
  },
  footer: {
    rights: "Headlines link to the original publishers. Summaries are AI-assisted and written in our own words.",
    terms: "Terms of Use",
    privacy: "Privacy Policy",
    publishers: "Publisher / DMCA Opt-Out",
    advertise: "Advertise",
    englishOnly: "",
  },
  aiNote: "",
};

const es: Dictionary = {
  tagline: "El top 10 de noticias de cada hora",
  hoursLabel: "Cada hora",
  finiteEdition: "Edición finita",
  timeMachineLabel: "Edición de la Máquina del Tiempo",
  latestSuffix: " (Última)",
  selectEdition: "Elige una edición",
  nextDrop: "Próxima edición",
  newEdition: "Nueva edición",
  nextShort: "Próxima",
  savedStories: "Noticias guardadas",
  toggleTheme: "Cambiar apariencia",
  compactView: "Vista compacta",
  expandedView: "Vista ampliada",
  categoryTitle: { tech: "Top 10 Tecnología e IA", finance: "Top 10 Finanzas y Mercados", politics: "Top 10 Política de EE. UU.", world: "Top 10 Mundo", health: "Top 10 Salud" },
  categoryTab: { tech: "Tecnología e IA", finance: "Finanzas y Mercados", politics: "Política EE. UU.", world: "Mundo", health: "Salud" },
  snapshotLocked: (d) => `Edición cerrada el ${d} · Clasificada por velocidad multifuente`,
  read: (n, t) => `${n}/${t} leídas`,
  whyItMatters: "Por qué importa:",
  badgeNew: "Nuevo",
  badgeNewTitle: "Primera hora en el Top 10",
  badgeHot: "Hot",
  badgeHotTitle: "Muchos medios lo están cubriendo ahora mismo",
  sources: (n) => `${n} ${n === 1 ? "fuente" : "fuentes"}:`,
  readMark: "✓ Leída",
  bookmark: "Guardar noticia",
  removeBookmark: "Quitar de guardadas",
  copyLink: "Copiar enlace permanente",
  rateUp: "Buena elección",
  rateDown: "No me interesa",
  timeMachineBadge: "MÁQUINA DEL TIEMPO",
  viewingSnapshot: "Estás viendo la edición inmutable de las",
  jumpToLatest: (t) => `Ir a la última (${t}) →`,
  noStoriesInCategory: "No hay noticias en esta categoría para esta hora.",
  caughtUpTitle: "Ya estás al día por esta hora.",
  caughtUpBody: (n) => `Esas son las ${n} noticias de esta categoría. Desconecta, vuelve a lo tuyo y regresa a la próxima hora, o cambia de pestaña para ver otra sección.`,
  savedTitle: "Noticias guardadas",
  savedSubtitle: "Noticias guardadas de distintas ediciones",
  noSaved: "Aún no has guardado noticias",
  noSavedHint: "Pulsa el icono de marcador en cualquier noticia para guardarla aquí.",
  remove: "Quitar",
  close: "Cerrar",
  missingTitle: "No hay edición para esa hora",
  missingBody: "No encontramos una edición publicada para",
  goLatest: "Ir a la última edición →",
  firstEditionTitle: "La primera edición está en camino",
  firstEditionBody: "Las ediciones se cierran al inicio de cada hora. Vuelve después de la próxima.",
  presentedBy: (n) => `Presentado por ${n}`,
  sponsored: "Patrocinado",
  paidPlacement: (n) => `Contenido pagado por ${n} · no forma parte del Top 10`,
  advertise: "Publicidad",
  reachReaders: "Llega a miles de lectores cada hora.",
  sponsorEdition: (c) => `Patrocina la edición de ${c} →`,
  toasts: {
    topOfHour: "¡Nueva hora! Edición recién cerrada.",
    loadedEdition: (l) => `Máquina del Tiempo: edición de ${l}`,
    saved: "Guardada en tu lista de lectura",
    removed: "Quitada de tus noticias guardadas",
    copied: (r) => `Enlace de la #${r} copiado`,
  },
  footer: {
    rights: "Los titulares enlazan a los medios originales. Los resúmenes se redactan con ayuda de IA y con nuestras propias palabras.",
    terms: "Términos de uso",
    privacy: "Privacidad",
    publishers: "Medios y DMCA",
    advertise: "Publicidad",
    englishOnly: "(en inglés)",
  },
  aiNote: "Traducción automática con IA.",
};

const zh: Dictionary = {
  tagline: "每小时十大新闻",
  hoursLabel: "每小时更新",
  finiteEdition: "有限版",
  timeMachineLabel: "时光机快照",
  latestSuffix: "（最新）",
  selectEdition: "选择一期",
  nextDrop: "下一期",
  newEdition: "新一期",
  nextShort: "下一期",
  savedStories: "已收藏",
  toggleTheme: "切换外观",
  compactView: "精简视图",
  expandedView: "完整视图",
  categoryTitle: { tech: "科技与 AI 十大新闻", finance: "财经与市场十大新闻", politics: "美国政治十大新闻", world: "国际十大新闻", health: "健康十大新闻" },
  categoryTab: { tech: "科技与 AI", finance: "财经与市场", politics: "美国政治", world: "国际", health: "健康" },
  snapshotLocked: (d) => `快照锁定于 ${d} · 按多来源传播速度排名`,
  read: (n, t) => `已读 ${n}/${t}`,
  whyItMatters: "为何重要：",
  badgeNew: "新",
  badgeNewTitle: "首次进入十大",
  badgeHot: "热",
  badgeHotTitle: "众多媒体正在报道",
  sources: (n) => `${n} 个来源：`,
  readMark: "✓ 已读",
  bookmark: "收藏",
  removeBookmark: "取消收藏",
  copyLink: "复制永久链接",
  rateUp: "赞",
  rateDown: "不感兴趣",
  timeMachineBadge: "时光机",
  viewingSnapshot: "正在查看不可更改的历史快照：",
  jumpToLatest: (t) => `回到最新（${t}）→`,
  noStoriesInCategory: "本小时该分类暂无新闻。",
  caughtUpTitle: "本小时的新闻你已全部看完。",
  caughtUpBody: (n) => `这是该分类的全部 ${n} 条新闻。去忙你的事吧，整点再回来看看，或切换上方标签浏览其他板块。`,
  savedTitle: "收藏的简报",
  savedSubtitle: "跨时段收藏的新闻",
  noSaved: "还没有收藏",
  noSavedHint: "点击任意新闻的书签图标即可收藏到这里。",
  remove: "移除",
  close: "关闭",
  missingTitle: "该时段没有快照",
  missingBody: "找不到以下时段的已发布快照：",
  goLatest: "前往最新一期 →",
  firstEditionTitle: "第一期即将发布",
  firstEditionBody: "每到整点锁定一期。请在下一期发布后再来。",
  presentedBy: (n) => `赞助商：${n}`,
  sponsored: "赞助",
  paidPlacement: (n) => `${n} 付费推广 · 不属于十大排名`,
  advertise: "广告合作",
  reachReaders: "每小时触达数千名读者。",
  sponsorEdition: (c) => `赞助「${c}」版块 →`,
  toasts: {
    topOfHour: "整点到了！新一期已锁定。",
    loadedEdition: (l) => `时光机：已载入 ${l} 这一期`,
    saved: "已加入阅读列表",
    removed: "已从收藏中移除",
    copied: (r) => `已复制第 ${r} 条的链接`,
  },
  footer: {
    rights: "标题均链接至原始媒体。摘要由 AI 辅助、以我们自己的语言撰写。",
    terms: "使用条款",
    privacy: "隐私政策",
    publishers: "媒体与 DMCA",
    advertise: "广告合作",
    englishOnly: "（英文）",
  },
  aiNote: "内容由 AI 翻译。",
};

const ja: Dictionary = {
  tagline: "毎時のトップ10ニュース",
  hoursLabel: "毎時更新",
  finiteEdition: "限定版",
  timeMachineLabel: "タイムマシン・スナップショット",
  latestSuffix: "（最新）",
  selectEdition: "版を選択",
  nextDrop: "次の更新",
  newEdition: "最新版",
  nextShort: "次",
  savedStories: "保存した記事",
  toggleTheme: "表示を切り替え",
  compactView: "コンパクト表示",
  expandedView: "詳細表示",
  categoryTitle: { tech: "テック・AI トップ10", finance: "金融・マーケット トップ10", politics: "米国政治 トップ10", world: "国際 トップ10", health: "健康 トップ10" },
  categoryTab: { tech: "テック・AI", finance: "金融・マーケット", politics: "米国政治", world: "国際", health: "健康" },
  snapshotLocked: (d) => `${d} 確定 · 複数メディアの報道速度でランキング`,
  read: (n, t) => `${n}/${t} 既読`,
  whyItMatters: "なぜ重要か：",
  badgeNew: "新着",
  badgeNewTitle: "初めてトップ10入り",
  badgeHot: "注目",
  badgeHotTitle: "多くのメディアが今まさに報じています",
  sources: (n) => `${n} 件の情報源：`,
  readMark: "✓ 既読",
  bookmark: "記事を保存",
  removeBookmark: "保存を解除",
  copyLink: "固定リンクをコピー",
  rateUp: "いいね",
  rateDown: "興味なし",
  timeMachineBadge: "タイムマシン",
  viewingSnapshot: "確定済みの過去版を表示中：",
  jumpToLatest: (t) => `最新版へ（${t}）→`,
  noStoriesInCategory: "この時間帯、このカテゴリーの記事はありません。",
  caughtUpTitle: "この時間のニュースはすべて読みました。",
  caughtUpBody: (n) => `このカテゴリーの ${n} 本はこれで全部です。ひと息ついて、次の正時にまたどうぞ。上のタブで別の分野も見られます。`,
  savedTitle: "保存したブリーフィング",
  savedSubtitle: "各時間帯から保存した記事",
  noSaved: "保存した記事はまだありません",
  noSavedHint: "記事のブックマークアイコンを押すと、ここに保存されます。",
  remove: "削除",
  close: "閉じる",
  missingTitle: "その時間の版はありません",
  missingBody: "次の時間の公開版が見つかりませんでした：",
  goLatest: "最新版へ →",
  firstEditionTitle: "最初の版はまもなく公開されます",
  firstEditionBody: "各版は毎正時に確定します。次の更新後にもう一度ご覧ください。",
  presentedBy: (n) => `提供：${n}`,
  sponsored: "スポンサー",
  paidPlacement: (n) => `${n} による広告 · トップ10には含まれません`,
  advertise: "広告掲載",
  reachReaders: "毎時、数千人の読者に届きます。",
  sponsorEdition: (c) => `「${c}」版のスポンサーになる →`,
  toasts: {
    topOfHour: "正時になりました。最新版を確定しました。",
    loadedEdition: (l) => `タイムマシン：${l} の版を表示`,
    saved: "リーディングリストに保存しました",
    removed: "保存から削除しました",
    copied: (r) => `#${r} のリンクをコピーしました`,
  },
  footer: {
    rights: "見出しは各メディアの元記事にリンクしています。要約は AI の支援を受け、独自の言葉で書かれています。",
    terms: "利用規約",
    privacy: "プライバシー",
    publishers: "メディア・DMCA",
    advertise: "広告掲載",
    englishOnly: "（英語）",
  },
  aiNote: "AI による自動翻訳です。",
};

const de: Dictionary = {
  tagline: "Die Top 10 Nachrichten jeder Stunde",
  hoursLabel: "Stündlich",
  finiteEdition: "Kompakte Ausgabe",
  timeMachineLabel: "Zeitmaschinen-Ausgabe",
  latestSuffix: " (Aktuell)",
  selectEdition: "Ausgabe wählen",
  nextDrop: "Nächste Ausgabe",
  newEdition: "Neue Ausgabe",
  nextShort: "Nächste",
  savedStories: "Gespeicherte Meldungen",
  toggleTheme: "Darstellung wechseln",
  compactView: "Kompaktansicht",
  expandedView: "Ausführliche Ansicht",
  categoryTitle: { tech: "Top 10 Tech & KI", finance: "Top 10 Finanzen & Märkte", politics: "Top 10 US-Politik", world: "Top 10 Welt", health: "Top 10 Gesundheit" },
  categoryTab: { tech: "Tech & KI", finance: "Finanzen & Märkte", politics: "US-Politik", world: "Welt", health: "Gesundheit" },
  snapshotLocked: (d) => `Ausgabe festgelegt ${d} · Gerankt nach Berichtstempo vieler Quellen`,
  read: (n, t) => `${n}/${t} gelesen`,
  whyItMatters: "Warum es wichtig ist:",
  badgeNew: "Neu",
  badgeNewTitle: "Erste Stunde in den Top 10",
  badgeHot: "Heiß",
  badgeHotTitle: "Viele Redaktionen berichten gerade darüber",
  sources: (n) => `${n} ${n === 1 ? "Quelle" : "Quellen"}:`,
  readMark: "✓ Gelesen",
  bookmark: "Meldung speichern",
  removeBookmark: "Nicht mehr speichern",
  copyLink: "Dauerhaften Link kopieren",
  rateUp: "Gute Wahl",
  rateDown: "Nichts für mich",
  timeMachineBadge: "ZEITMASCHINE",
  viewingSnapshot: "Du siehst die feste Ausgabe von",
  jumpToLatest: (t) => `Zur aktuellen Ausgabe (${t}) →`,
  noStoriesInCategory: "Keine Meldungen in dieser Kategorie für diese Stunde.",
  caughtUpTitle: "Du bist für diese Stunde auf dem neuesten Stand.",
  caughtUpBody: (n) => `Das waren alle ${n} Meldungen dieser Kategorie. Mach eine Pause und schau zur vollen Stunde wieder vorbei, oder wechsle oben den Bereich.`,
  savedTitle: "Gespeicherte Briefings",
  savedSubtitle: "Gespeicherte Meldungen aus verschiedenen Ausgaben",
  noSaved: "Noch nichts gespeichert",
  noSavedHint: "Tippe bei einer Meldung auf das Lesezeichen, um sie hier zu speichern.",
  remove: "Entfernen",
  close: "Schließen",
  missingTitle: "Keine Ausgabe für diese Stunde",
  missingBody: "Wir haben keine veröffentlichte Ausgabe gefunden für",
  goLatest: "Zur aktuellen Ausgabe →",
  firstEditionTitle: "Die erste Ausgabe ist unterwegs",
  firstEditionBody: "Jede Ausgabe wird zur vollen Stunde festgelegt. Schau nach der nächsten wieder vorbei.",
  presentedBy: (n) => `Präsentiert von ${n}`,
  sponsored: "Gesponsert",
  paidPlacement: (n) => `Bezahlte Platzierung von ${n} · nicht Teil der Top 10`,
  advertise: "Werbung",
  reachReaders: "Erreiche jede Stunde Tausende Leserinnen und Leser.",
  sponsorEdition: (c) => `Ausgabe ${c} sponsern →`,
  toasts: {
    topOfHour: "Volle Stunde! Neue Ausgabe festgelegt.",
    loadedEdition: (l) => `Zeitmaschine: Ausgabe ${l} geladen`,
    saved: "Zur Leseliste hinzugefügt",
    removed: "Aus den gespeicherten Meldungen entfernt",
    copied: (r) => `Link zu #${r} kopiert`,
  },
  footer: {
    rights: "Schlagzeilen verlinken auf die Originalmedien. Zusammenfassungen sind KI-gestützt und in eigenen Worten verfasst.",
    terms: "Nutzungsbedingungen",
    privacy: "Datenschutz",
    publishers: "Medien & DMCA",
    advertise: "Werbung",
    englishOnly: "(auf Englisch)",
  },
  aiNote: "Automatisch mit KI übersetzt.",
};

const fr: Dictionary = {
  tagline: "Le top 10 de l’actualité, chaque heure",
  hoursLabel: "Chaque heure",
  finiteEdition: "Édition limitée",
  timeMachineLabel: "Édition Machine à remonter le temps",
  latestSuffix: " (Dernière)",
  selectEdition: "Choisir une édition",
  nextDrop: "Prochaine édition",
  newEdition: "Nouvelle édition",
  nextShort: "Prochaine",
  savedStories: "Articles enregistrés",
  toggleTheme: "Changer l’apparence",
  compactView: "Vue compacte",
  expandedView: "Vue détaillée",
  categoryTitle: { tech: "Top 10 Tech & IA", finance: "Top 10 Finance & Marchés", politics: "Top 10 Politique américaine", world: "Top 10 Monde", health: "Top 10 Santé" },
  categoryTab: { tech: "Tech & IA", finance: "Finance & Marchés", politics: "Politique US", world: "Monde", health: "Santé" },
  snapshotLocked: (d) => `Édition figée le ${d} · Classée selon la vitesse de couverture multi-sources`,
  read: (n, t) => `${n}/${t} lus`,
  whyItMatters: "Pourquoi c’est important :",
  badgeNew: "Nouveau",
  badgeNewTitle: "Première heure dans le Top 10",
  badgeHot: "Chaud",
  badgeHotTitle: "De nombreuses rédactions en parlent en ce moment",
  sources: (n) => `${n} ${n === 1 ? "source" : "sources"} :`,
  readMark: "✓ Lu",
  bookmark: "Enregistrer l’article",
  removeBookmark: "Retirer des enregistrements",
  copyLink: "Copier le lien permanent",
  rateUp: "Bon choix",
  rateDown: "Pas pour moi",
  timeMachineBadge: "MACHINE À REMONTER LE TEMPS",
  viewingSnapshot: "Vous consultez l’édition figée de",
  jumpToLatest: (t) => `Voir la dernière (${t}) →`,
  noStoriesInCategory: "Aucun article dans cette catégorie pour cette heure.",
  caughtUpTitle: "Vous êtes à jour pour cette heure.",
  caughtUpBody: (n) => `Voilà les ${n} articles de cette catégorie. Faites une pause et revenez à l’heure pile, ou changez d’onglet ci-dessus pour une autre rubrique.`,
  savedTitle: "Briefings enregistrés",
  savedSubtitle: "Articles enregistrés depuis différentes éditions",
  noSaved: "Aucun article enregistré",
  noSavedHint: "Touchez l’icône de signet sur un article pour l’enregistrer ici.",
  remove: "Retirer",
  close: "Fermer",
  missingTitle: "Aucune édition pour cette heure",
  missingBody: "Aucune édition publiée trouvée pour",
  goLatest: "Aller à la dernière édition →",
  firstEditionTitle: "La première édition arrive",
  firstEditionBody: "Chaque édition est figée à l’heure pile. Revenez après la prochaine.",
  presentedBy: (n) => `Présenté par ${n}`,
  sponsored: "Sponsorisé",
  paidPlacement: (n) => `Contenu payé par ${n} · hors Top 10`,
  advertise: "Publicité",
  reachReaders: "Touchez des milliers de lecteurs chaque heure.",
  sponsorEdition: (c) => `Sponsoriser l’édition ${c} →`,
  toasts: {
    topOfHour: "Heure pile ! Nouvelle édition figée.",
    loadedEdition: (l) => `Machine à remonter le temps : édition de ${l}`,
    saved: "Ajouté à votre liste de lecture",
    removed: "Retiré des articles enregistrés",
    copied: (r) => `Lien du n° ${r} copié`,
  },
  footer: {
    rights: "Les titres renvoient aux médias d’origine. Les résumés sont rédigés avec l’aide de l’IA, dans nos propres mots.",
    terms: "Conditions d’utilisation",
    privacy: "Confidentialité",
    publishers: "Médias et DMCA",
    advertise: "Publicité",
    englishOnly: "(en anglais)",
  },
  aiNote: "Traduction automatique par IA.",
};

const ko: Dictionary = {
  tagline: "매시간 톱10 뉴스",
  hoursLabel: "매시간 업데이트",
  finiteEdition: "한정판",
  timeMachineLabel: "타임머신 스냅샷",
  latestSuffix: " (최신)",
  selectEdition: "호 선택",
  nextDrop: "다음 업데이트",
  newEdition: "새 소식",
  nextShort: "다음",
  savedStories: "저장한 기사",
  toggleTheme: "화면 모드 전환",
  compactView: "간단히 보기",
  expandedView: "자세히 보기",
  categoryTitle: { tech: "테크·AI 톱10", finance: "금융·시장 톱10", politics: "미국 정치 톱10", world: "국제 톱10", health: "건강 톱10" },
  categoryTab: { tech: "테크·AI", finance: "금융·시장", politics: "미국 정치", world: "국제", health: "건강" },
  snapshotLocked: (d) => `${d} 확정 · 여러 매체의 보도 속도로 순위 결정`,
  read: (n, t) => `${n}/${t} 읽음`,
  whyItMatters: "왜 중요한가:",
  badgeNew: "새로",
  badgeNewTitle: "처음으로 톱10 진입",
  badgeHot: "화제",
  badgeHotTitle: "지금 많은 매체가 보도하고 있습니다",
  sources: (n) => `출처 ${n}곳:`,
  readMark: "✓ 읽음",
  bookmark: "기사 저장",
  removeBookmark: "저장 취소",
  copyLink: "고정 링크 복사",
  rateUp: "좋아요",
  rateDown: "관심 없음",
  timeMachineBadge: "타임머신",
  viewingSnapshot: "확정된 지난 호를 보는 중:",
  jumpToLatest: (t) => `최신 호로 (${t}) →`,
  noStoriesInCategory: "이 시간에는 이 분야 기사가 없습니다.",
  caughtUpTitle: "이번 시간 뉴스를 모두 읽었습니다.",
  caughtUpBody: (n) => `이 분야의 기사 ${n}개를 모두 보셨습니다. 잠시 쉬었다가 정각에 다시 들러 주세요. 위 탭에서 다른 분야도 볼 수 있습니다.`,
  savedTitle: "저장한 브리핑",
  savedSubtitle: "여러 시간대에서 저장한 기사",
  noSaved: "아직 저장한 기사가 없습니다",
  noSavedHint: "기사의 북마크 아이콘을 누르면 여기에 저장됩니다.",
  remove: "삭제",
  close: "닫기",
  missingTitle: "해당 시간의 호가 없습니다",
  missingBody: "다음 시간에 발행된 호를 찾을 수 없습니다:",
  goLatest: "최신 호로 가기 →",
  firstEditionTitle: "첫 호가 곧 발행됩니다",
  firstEditionBody: "매 정각에 한 호씩 확정됩니다. 다음 업데이트 후 다시 확인해 주세요.",
  presentedBy: (n) => `제공: ${n}`,
  sponsored: "스폰서",
  paidPlacement: (n) => `${n} 유료 광고 · 톱10에 포함되지 않음`,
  advertise: "광고 문의",
  reachReaders: "매시간 수천 명의 독자에게 닿습니다.",
  sponsorEdition: (c) => `「${c}」 섹션 후원하기 →`,
  toasts: {
    topOfHour: "정각입니다! 새 호가 확정되었습니다.",
    loadedEdition: (l) => `타임머신: ${l} 호를 불러왔습니다`,
    saved: "읽기 목록에 저장했습니다",
    removed: "저장한 기사에서 삭제했습니다",
    copied: (r) => `#${r} 링크를 복사했습니다`,
  },
  footer: {
    rights: "헤드라인은 원래 매체로 연결됩니다. 요약은 AI의 도움을 받아 자체 문장으로 작성되었습니다.",
    terms: "이용약관",
    privacy: "개인정보처리방침",
    publishers: "매체 및 DMCA",
    advertise: "광고 문의",
    englishOnly: "(영어)",
  },
  aiNote: "AI 자동 번역입니다.",
};

const pt: Dictionary = {
  tagline: "O top 10 de notícias de cada hora",
  hoursLabel: "De hora em hora",
  finiteEdition: "Edição enxuta",
  timeMachineLabel: "Edição da Máquina do Tempo",
  latestSuffix: " (Mais recente)",
  selectEdition: "Escolha uma edição",
  nextDrop: "Próxima edição",
  newEdition: "Nova edição",
  nextShort: "Próxima",
  savedStories: "Notícias salvas",
  toggleTheme: "Mudar aparência",
  compactView: "Visão compacta",
  expandedView: "Visão completa",
  categoryTitle: { tech: "Top 10 Tecnologia e IA", finance: "Top 10 Finanças e Mercados", politics: "Top 10 Política dos EUA", world: "Top 10 Mundo", health: "Top 10 Saúde" },
  categoryTab: { tech: "Tecnologia e IA", finance: "Finanças e Mercados", politics: "Política dos EUA", world: "Mundo", health: "Saúde" },
  snapshotLocked: (d) => `Edição fechada em ${d} · Classificada pela velocidade de cobertura em várias fontes`,
  read: (n, t) => `${n}/${t} lidas`,
  whyItMatters: "Por que importa:",
  badgeNew: "Novo",
  badgeNewTitle: "Primeira hora no Top 10",
  badgeHot: "Em alta",
  badgeHotTitle: "Muitas redações estão cobrindo isso agora",
  sources: (n) => `${n} ${n === 1 ? "fonte" : "fontes"}:`,
  readMark: "✓ Lida",
  bookmark: "Salvar notícia",
  removeBookmark: "Remover das salvas",
  copyLink: "Copiar link permanente",
  rateUp: "Boa escolha",
  rateDown: "Não é pra mim",
  timeMachineBadge: "MÁQUINA DO TEMPO",
  viewingSnapshot: "Você está vendo a edição fechada de",
  jumpToLatest: (t) => `Ir para a mais recente (${t}) →`,
  noStoriesInCategory: "Nenhuma notícia nesta categoria nesta hora.",
  caughtUpTitle: "Você está em dia com esta hora.",
  caughtUpBody: (n) => `Essas são as ${n} notícias desta categoria. Faça uma pausa e volte na próxima hora, ou troque de aba acima para ver outra editoria.`,
  savedTitle: "Briefings salvos",
  savedSubtitle: "Notícias salvas de várias edições",
  noSaved: "Nenhuma notícia salva ainda",
  noSavedHint: "Toque no ícone de marcador em qualquer notícia para salvá-la aqui.",
  remove: "Remover",
  close: "Fechar",
  missingTitle: "Não há edição para essa hora",
  missingBody: "Não encontramos uma edição publicada para",
  goLatest: "Ir para a edição mais recente →",
  firstEditionTitle: "A primeira edição está a caminho",
  firstEditionBody: "As edições são fechadas no início de cada hora. Volte depois da próxima.",
  presentedBy: (n) => `Apresentado por ${n}`,
  sponsored: "Patrocinado",
  paidPlacement: (n) => `Conteúdo pago por ${n} · fora do Top 10`,
  advertise: "Anuncie",
  reachReaders: "Alcance milhares de leitores a cada hora.",
  sponsorEdition: (c) => `Patrocine a edição de ${c} →`,
  toasts: {
    topOfHour: "Hora cheia! Nova edição fechada.",
    loadedEdition: (l) => `Máquina do Tempo: edição de ${l}`,
    saved: "Salva na sua lista de leitura",
    removed: "Removida das notícias salvas",
    copied: (r) => `Link da nº ${r} copiado`,
  },
  footer: {
    rights: "As manchetes levam aos veículos originais. Os resumos são feitos com ajuda de IA, com nossas próprias palavras.",
    terms: "Termos de uso",
    privacy: "Privacidade",
    publishers: "Veículos e DMCA",
    advertise: "Anuncie",
    englishOnly: "(em inglês)",
  },
  aiNote: "Tradução automática por IA.",
};

const DICTS: Record<Locale, Dictionary> = { en, es, zh, ja, de, fr, ko, pt };
export const getDictionary = (locale: Locale): Dictionary => DICTS[locale];
