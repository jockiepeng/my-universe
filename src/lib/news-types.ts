export interface NewsArticle { title: string; summary: string; value: string; source: string; basis: string; url: string }
export interface HistoryEvent { date: string; title: string; summary: string; url: string }
export interface NewsReport { id: string; date: string; commentId: string; updatedAt: string; url: string; articles: NewsArticle[]; history: HistoryEvent[] }
export interface NewsSnapshot { updatedAt: string | null; reports: NewsReport[] }
