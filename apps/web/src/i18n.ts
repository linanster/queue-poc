// Minimal i18n abstraction (design.md §1.8). Chinese + English to start.
// Not a full i18n framework — just the seam so copy is never hard-coded.

export type Lang = 'zh' | 'en';

type Dict = Record<string, { zh: string; en: string }>;

const dict: Dict = {
  appTitle: { zh: '排队取号', en: 'Queue' },
  privacyNote: {
    zh: '我们仅用一个匿名标识为你保留排队号，不收集你的个人信息。',
    en: 'We only use an anonymous identifier to hold your spot. No personal data is collected.',
  },
  yourNumber: { zh: '你的号码', en: 'Your number' },
  peopleAhead: { zh: '前面还有', en: 'People ahead' },
  people: { zh: '人', en: '' },
  statusWaiting: { zh: '排队中', en: 'Waiting' },
  statusReady: { zh: '轮到你了，请前往店员处', en: "It's your turn — please see a staff member" },
  statusServing: { zh: '服务中', en: 'Being served' },
  statusDone: { zh: '已完成', en: 'Completed' },
  statusMissed: { zh: '已过号（可联系店员召回）', en: 'Missed (ask staff to recall)' },
  statusCancelled: { zh: '已取消/已失效（请重新取号）', en: 'Cancelled/expired (please take a new ticket)' },
  taking: { zh: '正在取号…', en: 'Taking a ticket…' },
  leaveQueue: { zh: '放弃排队', en: 'Leave queue' },
  retake: { zh: '重新取号', en: 'Take a new ticket' },
  saveHint: {
    zh: '截图或收藏本页，关闭后可随时回来查看进度。',
    en: 'Screenshot or bookmark this page to return anytime.',
  },
  reconnecting: { zh: '正在重新连接…', en: 'Reconnecting…' },
  errorGeneric: { zh: '出错了，请重新扫码。', en: 'Something went wrong — please scan again.' },
  linkMember: { zh: '登录关联会员', en: 'Sign in to link membership' },
  linkMemberHint: {
    zh: '关联会员后，本次到店可累积积分 / 享专属权益。（示例功能）',
    en: 'Link your membership to earn points / unlock perks for this visit. (Demo)',
  },
  linkMemberRedirect: { zh: '正在跳转会员登录…', en: 'Redirecting to member login…' },
  memberLinked: { zh: '已关联会员（示例）', en: 'Membership linked (demo)' },
};

export function detectLang(): Lang {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function t(key: keyof typeof dict, lang: Lang): string {
  return dict[key]?.[lang] ?? key;
}
