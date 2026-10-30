export type KnowledgeItem = { id: string; content: string };
export type KnowledgeBook = { notes: KnowledgeItem[]; risks: KnowledgeItem[] };
export type KnowledgeSection = keyof KnowledgeBook;

export function defaultKnowledge(): KnowledgeBook {
  return {
    notes: [
      { id: "tech-rebound", content: "科技反抽，快进快出\n手里没有科技筹码、下跌趋势出现科技反抽时，研究用“中韩半导体”等工具做一口反抽，拼刺刀。先核对当日T+0资格、溢价、流动性和成本；退出目标是保本金、不隔夜，保本金并非保证。" },
      { id: "capital-memory", content: "盘面资金记忆\n医药方向被拉起时，联想到哈药、精华等资金记忆标的，及时检查其联动、主动性与承接；联想只是观察线索。" },
      { id: "reserve-cash", content: "留足机动资金，等待极致低吸\n震荡期间或大跌底部，至少留出七成可用资金，随时研究极致低吸。原话“留有7成仓位”暂按机动资金理解，具体比例由我确认；不自动改变系统仓位设置。" },
    ],
    risks: [
      { id: "company-earnings", content: "公司财报\n财报、业绩预告和快报：披露时间、预期差，以及对持仓和候选的影响。" },
      { id: "tech-earnings", content: "科技巨头财报\n营收、利润、资本开支与业绩指引；核对A股映射和市场预期。" },
      { id: "politics", content: "政治与地缘局势\n政策会议、国际冲突、制裁与突发事件：影响方向和可能的传导链。" },
      { id: "rates", content: "利率与货币政策\n加息、降息、央行会议与汇率变化：事件时间、预期差和流动性影响。" },
      { id: "oil", content: "油价\n油价变化、供需和突发消息，以及对相关产业链的影响。" },
      { id: "ipo", content: "巨头IPO\n上市时间、融资规模、资金分流和板块映射，区分传闻与公告。" },
      { id: "overseas-index", content: "美、日、韩指数\n主要指数与科技、半导体方向反馈；记录时间和来源，不把外围涨跌直接当成A股买点。" },
    ],
  };
}

export function validKnowledge(value: unknown): value is KnowledgeBook {
  if (!value || typeof value !== "object") return false;
  const book = value as KnowledgeBook;
  return ([book.notes, book.risks]).every(items => Array.isArray(items) && items.every(item => item && typeof item.id === "string" && item.id.trim() && typeof item.content === "string") && new Set(items.map(item => item.id)).size === items.length);
}

export function moveKnowledge(book: KnowledgeBook, section: KnowledgeSection, from: string, to: string): KnowledgeBook {
  const items = [...book[section]], a = items.findIndex(item => item.id === from), b = items.findIndex(item => item.id === to);
  if (a < 0 || b < 0 || a === b) return book;
  const [item] = items.splice(a, 1); items.splice(b, 0, item);
  return { ...book, [section]: items };
}
