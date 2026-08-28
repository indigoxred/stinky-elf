export const BULK_PACKED_SCRIPT = String.raw`eval(function(p,a,c,k,e,d){return p;}('0=[\'//img.example/1.jpg\',\'//img.example/2.jpg\'];',62,1,'newImgs'.split('|'),0,{}))`;

export const PAGE_PACKED_SCRIPT = String.raw`eval(function(p,a,c,k,e,d){return p;}('0=\'//img.example/\';1=[\"003.jpg\"];',62,2,'pix|pvalue'.split('|'),0,{}))`;

export const KEY_PACKED_SCRIPT = String.raw`eval(function(p,a,c,k,e,d){return p;}('var 0=\'ab\'+\'cd\';',62,1,'key'.split('|'),0,{}))`;

export const MALFORMED_PACKED_SCRIPT =
  "eval(function(p,a,c,k,e,d){return p;}('payload',62,'broken'))";

export const SEARCH_HTML = `
<html><body>
  <ul class="manga-list-4-list">
    <li>
      <a href="/manga/class_no_bocchi/"><img src="//img.example/cover.jpg"></a>
      <p class="manga-list-4-item-title"><a href="/manga/class_no_bocchi/" title="Class No Bocchi">Class No Bocchi</a></p>
      <p class="manga-list-4-item-tip">Updated today</p>
    </li>
  </ul>
  <div class="pager-list-left"><a class="active">1</a><a href="?page=2">2</a></div>
</body></html>`;

export const DIRECTORY_HTML = `
<html><body>
  <ul class="manga-list-1-list">
    <li>
      <a href="https://www.mangahere.cc/manga/class_no_bocchi/" title="Class No Bocchi">
        <img class="manga-list-1-cover" src="https://img.example/cover.jpg">
      </a>
      <p class="manga-list-1-item-subtitle">Comedy</p>
    </li>
  </ul>
</body></html>`;

export const MANGA_DETAILS_HTML = `
<html><body>
  <section class="detail-info">
    <img class="detail-info-cover-img" src="//img.example/cover.jpg">
    <span class="detail-info-right-title-font">Class No Bocchi</span>
    <p class="detail-info-right-say"><a>Example Author</a></p>
    <span class="detail-info-right-title-tip">Completed</span>
    <div class="detail-info-right-tag-list"><a>Comedy</a><a>School Life</a></div>
  </section>
  <p class="fullcontent">A sanitized synopsis.</p>
</body></html>`;

export const CHAPTER_LIST_HTML = `
<html><body>
  <ul class="detail-main-list" id="chapterlist">
    <li><a href="/manga/class_no_bocchi/v01/c025/"><p class="title3">Vol. 1 Chapter 25</p><p class="title2">Aug 28, 2026</p></a></li>
    <li><a href="/manga/class_no_bocchi/c024/"><p class="title3">Chapter 24</p><p class="title2">Yesterday</p></a></li>
  </ul>
</body></html>`;

export const CHAPTER_URL =
  "https://www.mangahere.cc/manga/class_no_bocchi/c025/1.html";

export const BULK_READER_HTML = `
<html><body>
  <script src="/js/chapter_bar.js"></script>
  <script>${BULK_PACKED_SCRIPT}</script>
</body></html>`;

export const TRADITIONAL_READER_HTML = `
<html><body>
  <script>var chapterid = 12345;</script>
  <script>${KEY_PACKED_SCRIPT}</script>
  <div class="pager-list-left"><span>
    <a data-page="1">1</a><a data-page="2">2</a><a data-page="3">3</a><a>Next</a>
  </span></div>
</body></html>`;
