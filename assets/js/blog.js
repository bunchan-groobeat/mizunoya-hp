/* =========================================================
   水野谷自動車 お知らせ/ブログ — 一覧 + 記事（microCMS 方式・J-DRY踏襲）
   ---------------------------------------------------------
   方式: ビルドなしの静的サイトのまま、ブラウザから microCMS の
         コンテンツAPIを直接 fetch して描画する（記事「公開」で即時反映）。

   接続情報は assets/js/config.js（window.MIZUNOYA_CONFIG）に分離。
   未接続（空欄）の間は、下記 DUMMY のダミー記事で雛形が動作する。
     - 一覧(blog.html)      : HTMLに書いた静的ダミー <li> をそのまま表示
     - 記事(blog-article.html): ?id= に応じて DUMMY から本文を描画

   セキュリティ: config.js の APIキーは必ず「読み取り専用(GET)」。本JSはGETのみ。

   ★画像パスの一元管理★
     ダミー記事の画像パスは下記 DUMMY の thumbnail / body 内に集約。
     本番接続後は microCMS の画像フィールド(thumbnail)を参照し、
     ?fit=crop&w=..&h=.. で配信最適化する（thumbUrl参照）。
========================================================= */
(function () {
  'use strict';

  var cfg = window.MIZUNOYA_CONFIG || {};
  var configured = !!(cfg.MICROCMS_SERVICE_DOMAIN && cfg.MICROCMS_API_KEY);

  /* ---------- ダミー記事（未接続時の雛形デモ用・2〜3件） ---------- */
  /* 本文は簡易HTML。実運用では microCMS のリッチエディタ本文(body)に置き換わる。 */
  var DUMMY = {
    'sample-1': {
      id: 'sample-1',
      title: 'ホームページをリニューアルしました',
      category: 'お知らせ',
      publishedDate: '2026-07-10',
      thumbnail: 'assets/img/mv4.webp',
      body:
        '<p>いつも有限会社 水野谷自動車をご利用いただき、誠にありがとうございます。' +
        'このたびホームページをリニューアルいたしました。</p>' +
        '<h2>お知らせ・ブログを始めます</h2>' +
        '<p>入庫情報やキャンペーン、季節ごとの点検のご案内などを、こちらのページで発信してまいります。' +
        'スマートフォンからも見やすいデザインになりました。</p>' +
        '<p>今後とも、クルマのかかりつけ工場としてよろしくお願いいたします。</p>'
    },
    'sample-2': {
      id: 'sample-2',
      title: '車検のご予約はお早めに（矢吹町・認証工場）',
      category: 'メンテナンス',
      publishedDate: '2026-07-05',
      thumbnail: 'assets/img/catch-maintenance.webp',
      body:
        '<p>国指定の認証工場（仙台陸運局認証番号 仙4-6522）として、軽自動車から大型車まで' +
        '車検・整備を承っております。</p>' +
        '<h2>過剰整備をしません</h2>' +
        '<p>過去の整備記録を管理し、必要な整備を必要なタイミングでご提案します。' +
        'お見積りは無料です。まずはお気軽にお電話ください。</p>' +
        '<h3>受付時間</h3>' +
        '<p>9:00 - 18:00（日・祝日を除く） / TEL 0248-43-2455</p>'
    },
    'sample-3': {
      id: 'sample-3',
      title: 'ボディーコーティングで夏の紫外線対策を',
      category: 'コーティング',
      publishedDate: '2026-06-28',
      thumbnail: 'assets/img/catch-coating.webp',
      body:
        '<p>VOCを含まない「スーパーガラスコーティング」で、洗練された輝きを長く保ちます。</p>' +
        '<ul>' +
        '<li>超長期的な耐久性</li>' +
        '<li>メンテナンスは水洗いだけ</li>' +
        '<li>驚異的な防汚性能</li>' +
        '</ul>' +
        '<p>施工のご相談・お見積りはお気軽にどうぞ。</p>'
    }
  };
  var DUMMY_ORDER = ['sample-1', 'sample-2', 'sample-3'];

  /* ---------- 共通ヘルパー ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatDate(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
  }
  function makeExcerpt(item) {
    if (item.excerpt) return item.excerpt;
    var tmp = document.createElement('div');
    tmp.innerHTML = item.body || '';
    var text = (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
    if (text.length > 80) text = text.slice(0, 80) + '…';
    return text;
  }
  // microCMS画像は ?fit=crop&w= 等でリサイズ配信できる。ローカルダミーはそのまま返す。
  function thumbUrl(item, w, h) {
    var t = item.thumbnail;
    var url = t && t.url ? t.url : (typeof t === 'string' ? t : '');
    if (!url) return '';
    if (/^https?:\/\/[^/]*microcms/.test(url) || (t && t.url)) {
      return url + '?fit=crop&w=' + w + '&h=' + h;
    }
    return url; // ローカルダミー画像
  }
  function getQueryId() {
    var m = /[?&]id=([^&]+)/.exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function apiUrl(path, query) {
    return 'https://' + cfg.MICROCMS_SERVICE_DOMAIN + '.microcms.io/api/v1/' +
      (cfg.MICROCMS_ENDPOINT || 'blog') + path + (query || '');
  }
  function apiHeaders() {
    return { 'X-MICROCMS-API-KEY': cfg.MICROCMS_API_KEY };
  }

  /* =========================================================
     一覧ページ（#blog_list）
  ========================================================= */
  function initList() {
    var listEl = document.getElementById('blog_list');
    if (!listEl) return;

    if (!configured) {
      if (window.console) {
        console.info('[Blog] microCMS 未接続のため静的ダミー一覧を表示中。' +
          'assets/js/config.js にサービスドメインと読み取り専用APIキーを設定すると自動取得に切り替わります。');
      }
      return; // HTMLの静的ダミー <li> をそのまま表示
    }

    listEl.innerHTML = '<li class="blog_state">読み込み中です…</li>';
    var url = apiUrl('', '?limit=' + encodeURIComponent(cfg.BLOG_LIMIT || 20) + '&orders=-publishedDate');

    fetch(url, { headers: apiHeaders() })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) {
        var items = (data && data.contents) || [];
        if (!items.length) { listEl.innerHTML = '<li class="blog_state">現在お知らせはありません。</li>'; return; }
        listEl.innerHTML = '';
        items.forEach(function (item) { listEl.appendChild(renderListItem(item)); });
      })
      .catch(function (e) {
        if (window.console) console.warn('[Blog] 一覧の取得に失敗。静的ダミーを表示します。', e);
        // 失敗時は listEl を壊さない（描画前に書き換えているのでダミー文言だけ戻す）
        listEl.innerHTML = '<li class="blog_state">お知らせを読み込めませんでした。時間をおいて再度お試しください。</li>';
      });
  }

  function renderListItem(item) {
    var li = document.createElement('li');
    var date = formatDate(item.publishedDate || item.publishedAt);
    var cat = item.category || 'お知らせ';
    var title = esc(item.title || '(無題)');
    var excerpt = esc(makeExcerpt(item));
    var thumb = thumbUrl(item, 360, 224);
    var href = 'blog-article.html?id=' + encodeURIComponent(item.id);

    li.innerHTML =
      (thumb ? '<a class="thumb" href="' + href + '"><img src="' + thumb + '" alt="' + title + '" loading="lazy"></a>' : '') +
      '<div class="body">' +
        '<p class="meta"><span class="date">' + esc(date) + '</span><span class="cat">' + esc(cat) + '</span></p>' +
        '<h2 class="title"><a href="' + href + '">' + title + '</a></h2>' +
        '<p class="excerpt">' + excerpt + '</p>' +
      '</div>';
    return li;
  }

  /* =========================================================
     記事ページ（#blog_article）
  ========================================================= */
  function initArticle() {
    var el = document.getElementById('blog_article');
    if (!el) return;
    var id = getQueryId() || 'sample-1';

    if (!configured) {
      var d = DUMMY[id] || DUMMY['sample-1'];
      renderArticle(el, d);
      return;
    }

    el.innerHTML = '<p class="blog_state">読み込み中です…</p>';
    fetch(apiUrl('/' + encodeURIComponent(id)), { headers: apiHeaders() })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (item) { renderArticle(el, item); })
      .catch(function (e) {
        if (window.console) console.warn('[Blog] 記事の取得に失敗。', e);
        el.innerHTML = '<p class="blog_state">記事を読み込めませんでした。' +
          '<a href="blog.html">お知らせ一覧へ戻る</a></p>';
      });
  }

  function renderArticle(el, item) {
    var date = formatDate(item.publishedDate || item.publishedAt);
    var cat = item.category || 'お知らせ';
    var title = esc(item.title || '(無題)');
    var thumb = thumbUrl(item, 900, 480);
    document.title = (item.title || 'お知らせ') + ' | 有限会社 水野谷自動車';

    el.innerHTML =
      '<div class="article_head">' +
        '<p class="article_meta"><span class="date">' + esc(date) + '</span><span class="cat">' + esc(cat) + '</span></p>' +
        '<h1 class="article_title">' + title + '</h1>' +
      '</div>' +
      (thumb ? '<div class="article_thumb"><img src="' + thumb + '" alt="' + title + '"></div>' : '') +
      '<div class="blog_body">' + (item.body || '') + '</div>' +
      '<p class="blog_back"><a class="link_button accent" href="blog.html">お知らせ一覧へ戻る</a></p>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    initList();
    initArticle();
  });
})();
