export type ParsedListing = {
  mangaId: string;
  title: string;
  imageUrl: string;
  subtitle?: string;
};

export type ParsedManga = {
  title: string;
  thumbnailUrl: string;
  synopsis: string;
  author?: string;
  status: string;
  genres: string[];
};

export type ParsedChapter = {
  chapterId: string;
  title: string;
  chapNum: number;
  volume: number;
  publishDate: Date;
};

export type BulkReaderConfig = {
  mode: "bulk";
  pages: string[];
};

export type TraditionalReaderConfig = {
  mode: "traditional";
  cid: string;
  pageCount: number;
  pageBase: string;
  chapterUrl: string;
  keyExpression: string;
  secretKey?: string;
};

export type ReaderConfig = BulkReaderConfig | TraditionalReaderConfig;

export type PageFetchResult = {
  status: number;
  body: string;
};

export type ResolverOptions = {
  concurrency?: number;
  maxAttempts?: number;
};
