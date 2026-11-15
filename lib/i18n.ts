/** Interface translations. Story text is translated by the hourly job (see synthesize.ts). */
import type { Category } from "./types";

export const LOCALES = ["en", "es", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** BCP 47 tags for <html lang> and Intl date formatting. */
export const LOCALE_TAG: Record<Locale, string> = { en: "en-US", es: "es-ES", zh: "zh-CN" };
export const LOCALE_NAME: Record<Locale, string> = { en: "EN", es: "ES", zh: "中文" };
export const LOCALE_LABEL: Record<Locale, string> = { en: "English", es: "Español", zh: "简体中文" };

/** "/" for English, "/es", "/zh" otherwise. */
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
  categoryTitle: { tech: "Top 10 Tech & AI", finance: "Top 10 Finance & Markets", politics: "Top 10 Politics", world: "Top 10 World", health: "Top 10 Health" },
  categoryTab: { tech: "Tech & AI", finance: "Finance & Markets", politics: "Politics", world: "World", health: "Health" },
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
  categoryTitle: { tech: "Top 10 Tecnología e IA", finance: "Top 10 Finanzas y Mercados", politics: "Top 10 Política", world: "Top 10 Mundo", health: "Top 10 Salud" },
  categoryTab: { tech: "Tecnología e IA", finance: "Finanzas y Mercados", politics: "Política", world: "Mundo", health: "Salud" },
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
  categoryTitle: { tech: "科技与 AI 十大新闻", finance: "财经与市场十大新闻", politics: "政治十大新闻", world: "国际十大新闻", health: "健康十大新闻" },
  categoryTab: { tech: "科技与 AI", finance: "财经与市场", politics: "政治", world: "国际", health: "健康" },
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

const DICTS: Record<Locale, Dictionary> = { en, es, zh };
export const getDictionary = (locale: Locale): Dictionary => DICTS[locale];
