/* =========================================================
   ぶんちゃん式 車屋サイト 共通スクリプト
   出自: J-DRY(jdry-hp) main.js を車屋向けに一般化。
   - メインスライダー(PC #top_slider / スマホ #sp_slider)
   - ライトボックス(施工例・在庫写真の拡大 + 送り)
   - お問い合わせフォーム(Formspree 非同期送信)
   - ページ上部へ戻る
   - (任意) Instagram フィード(Behold.so)
   各サイトで共通。theme.js は不要。
========================================================= */
(function () {
  'use strict';

  /* ---------- メインスライダー ---------- */
  function initSlider(slider) {
    if (!slider) return;
    var slides = Array.prototype.slice.call(slider.querySelectorAll('.slide'));
    var dotsWrap = slider.querySelector('.slider_dots');
    if (slides.length === 0) return;
    var idx = 0, timer = null, INTERVAL = 5000, dots = [];
    if (dotsWrap) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = i + 1;
        b.addEventListener('click', function () { go(i); restart(); });
        dotsWrap.appendChild(b);
      });
      dots = Array.prototype.slice.call(dotsWrap.children);
    }
    function go(n) {
      slides[idx].classList.remove('is-active');
      if (dots[idx]) dots[idx].classList.remove('is-active');
      idx = (n + slides.length) % slides.length;
      slides[idx].classList.add('is-active');
      if (dots[idx]) dots[idx].classList.add('is-active');
    }
    function next() { go(idx + 1); }
    function restart() { if (timer) clearInterval(timer); timer = setInterval(next, INTERVAL); }
    slides[0].classList.add('is-active');
    if (dots[0]) dots[0].classList.add('is-active');
    if (slides.length > 1) restart();
  }

  /* ---------- Instagram フィード(任意・Behold.so) ---------- */
  var BEHOLD_FEED_ID = ''; // 顧客がBehold.so連携後にFeed IDを設定。未設定ならプレースホルダーのまま
  var INSTA_MAX = 6;
  function initInstagram() {
    var feed = document.querySelector('.insta_feed');
    if (!feed || !BEHOLD_FEED_ID) return;
    fetch('https://feeds.behold.so/' + BEHOLD_FEED_ID)
      .then(function (r) { if (!r.ok) throw new Error('feed ' + r.status); return r.json(); })
      .then(function (data) {
        var posts = (data && (data.posts || data)) || [];
        if (!posts.length) return;
        feed.innerHTML = '';
        posts.slice(0, INSTA_MAX).forEach(function (p) {
          var a = document.createElement('a');
          a.href = p.permalink || '#'; a.target = '_blank'; a.rel = 'noopener nofollow';
          var img = document.createElement('img');
          img.src = p.thumbnailUrl || p.mediaUrl || (p.sizes && p.sizes.small && p.sizes.small.mediaUrl);
          img.alt = (p.caption || 'Instagram').slice(0, 60); img.loading = 'lazy';
          a.appendChild(img); feed.appendChild(a);
        });
      })
      .catch(function (e) { console.warn('Instagram feed:', e); });
  }

  /* ---------- ライトボックス(J-DRY流用) ---------- */
  function initLightbox() {
    var links = document.querySelectorAll('a.thumb[href$=".jpg"], a.thumb[href$=".png"], a.thumb[href$=".jpeg"], a.thumb[href$=".webp"]');
    if (!links.length) return;
    var gallery = Array.prototype.map.call(links, function (a) {
      var t = a.querySelector('img');
      return { href: a.getAttribute('href'), alt: t ? t.alt : '' };
    });
    var overlay = document.createElement('div');
    overlay.className = 'lightbox_overlay'; overlay.innerHTML = '<img alt="">';
    document.body.appendChild(overlay);
    var bigImg = overlay.querySelector('img');
    var loading = document.createElement('div');
    loading.className = 'lb_loading'; loading.innerHTML = '<div></div>';
    document.body.appendChild(loading);
    var caption = document.createElement('div');
    caption.className = 'lb_caption'; document.body.appendChild(caption);
    var current = -1, animating = false;
    var ENTER = 350, EXIT = 250, SLIDE = 100, START_DELAY = 50, SWING = 'ease-in-out';
    function showLoading() { loading.style.display = 'block'; }
    function hideLoading() { loading.style.display = 'none'; }
    function showCaption(text) { caption.textContent = text || ''; caption.style.display = text ? 'block' : 'none'; }
    function hideCaption() { caption.style.display = 'none'; }
    function preload(src, cb) { showLoading(); hideCaption(); var pre = new Image(); pre.onload = pre.onerror = function () { hideLoading(); cb(); }; pre.src = src; }
    function enterFrom(offset) {
      bigImg.style.transition = 'none';
      bigImg.style.transform = 'translateX(' + offset + 'px)';
      bigImg.style.opacity = '0'; void bigImg.offsetWidth;
      setTimeout(function () {
        bigImg.style.transition = 'transform ' + ENTER + 'ms ' + SWING + ', opacity ' + ENTER + 'ms ' + SWING;
        bigImg.style.transform = 'translateX(0)'; bigImg.style.opacity = '1';
      }, START_DELAY);
    }
    function open(i) {
      overlay.classList.add('is-open'); current = i;
      bigImg.style.transition = 'none'; bigImg.style.opacity = '0';
      preload(gallery[i].href, function () { bigImg.src = gallery[i].href; bigImg.alt = gallery[i].alt; enterFrom(SLIDE); showCaption(gallery[i].alt); });
    }
    function slideNext() {
      if (animating || gallery.length < 2) return;
      animating = true;
      var nextIndex = (current + 1) % gallery.length;
      bigImg.style.transition = 'transform ' + EXIT + 'ms ' + SWING + ', opacity ' + EXIT + 'ms ' + SWING;
      bigImg.style.transform = 'translateX(-' + SLIDE + 'px)'; bigImg.style.opacity = '0';
      setTimeout(function () {
        current = nextIndex;
        preload(gallery[nextIndex].href, function () { bigImg.src = gallery[nextIndex].href; bigImg.alt = gallery[nextIndex].alt; enterFrom(SLIDE); showCaption(gallery[nextIndex].alt); setTimeout(function () { animating = false; }, ENTER + START_DELAY); });
      }, EXIT);
    }
    function close() { overlay.classList.remove('is-open'); hideLoading(); hideCaption(); bigImg.src = ''; current = -1; animating = false; }
    Array.prototype.forEach.call(links, function (a, i) { a.addEventListener('click', function (e) { e.preventDefault(); open(i); }); });
    bigImg.addEventListener('click', function (e) { e.stopPropagation(); slideNext(); });
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (overlay.classList.contains('is-open') && (e.key === 'Escape' || e.keyCode === 27)) close(); });
  }

  /* ---------- お問い合わせフォーム(Formspree 非同期送信) ---------- */
  function initContactForm() {
    var form = document.querySelector('.contact_form');
    if (!form) return;
    var status = form.querySelector('.form_status');
    var button = form.querySelector('button[type=submit]');
    function showStatus(msg, type) { if (!status) return; status.textContent = msg; status.className = 'form_status is-' + type; status.hidden = false; }
    var configured = form.action.indexOf('YOUR_FORM_ID') === -1 && /formspree\.io\/f\//.test(form.action);
    form.addEventListener('submit', function (e) {
      if (!configured) { e.preventDefault(); showStatus('送信先が未設定です。管理者にご連絡ください。', 'error'); return; }
      if (!window.fetch) return;
      e.preventDefault(); button.disabled = true; showStatus('送信中です…', 'pending');
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (res.ok) { form.reset(); showStatus('お問い合わせを送信しました。ご返信まで少々お待ちください。', 'success'); }
          else { return res.json().then(function (data) { var msg = (data && data.errors && data.errors.length) ? data.errors.map(function (x) { return x.message; }).join(' / ') : '送信に失敗しました。時間をおいて再度お試しください。'; showStatus(msg, 'error'); }); }
        })
        .catch(function () { showStatus('通信エラーが発生しました。時間をおいて再度お試しください。', 'error'); })
        .then(function () { button.disabled = false; });
    });
  }

  /* ---------- ページ上部へ戻る ---------- */
  function initReturnTop() {
    var btn = document.getElementById('return_top');
    if (!btn) return;
    btn.addEventListener('click', function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initSlider(document.getElementById('top_slider'));
    initSlider(document.getElementById('sp_slider'));
    initInstagram();
    initLightbox();
    initContactForm();
    initReturnTop();
  });
})();
