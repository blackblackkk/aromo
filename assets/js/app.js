/* Ароматно и точка — логика магазина (без сборки и зависимостей) */
(function () {
  'use strict';

  var CFG = window.AROMO_CONFIG || {};
  var PRODUCTS = window.AROMO_PRODUCTS || [];
  var DECANTS = window.AROMO_DECANTS || [];
  var FAMILIES = window.AROMO_FAMILIES || [];
  var DELIVERY = CFG.delivery && CFG.delivery.length ? CFG.delivery
    : ['СДЭК — до пункта выдачи', 'СДЭК — курьером до двери', 'Почта России'];
  var GENDER = { f: 'Женские', m: 'Мужские', u: 'Унисекс' };
  var GENDER_ONE = { f: 'женский', m: 'мужской', u: 'унисекс' };
  var SPRAYS_PER_ML = 12; // ориентир для подсказки про распив
  var PAGE = 12;

  var TINT = {};
  FAMILIES.forEach(function (f) { TINT[f.name] = f.tint; });

  var byId = {};
  PRODUCTS.forEach(function (p, i) {
    byId[p.id] = p;
    p.rank = i;
    p.decants = DECANTS.filter(function (ml) { return ml < p.s[0][0]; })
      .map(function (ml) { return { type: 'd', ml: ml, price: decantPrice(p, ml) }; });
    p.bottles = p.s.map(function (s) { return { type: 'b', ml: s[0], price: s[1] }; });
    p.first = p.decants[0] || p.bottles[0];
    p.min = p.first.price;
    p.search = [p.b, p.n, p.f, p.c].concat(p.t, p.h, p.d).join(' ').toLowerCase();
  });

  // Цена распива: цена миллилитра во флаконе + наценка за розлив и атомайзер. Формулу можно заменить.
  function decantPrice(p, ml) {
    var perMl = p.s[0][1] / p.s[0][0];
    return Math.ceil((perMl * ml * 1.25 + 60) / 10) * 10;
  }

  /* ---------- Хранилище ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* без сохранения */ } }
  };
  var cart = store.get('aromo-cart', []).filter(function (l) { return byId[l.id]; });
  var favs = store.get('aromo-favs', []).filter(function (id) { return byId[id]; });

  /* ---------- Состояние ---------- */
  var F = freshFilters();
  var shown = PAGE;
  var sel = null;      // выбранный объём на странице аромата
  var qty = 1;
  var current = null;  // открытый аромат
  var lastFocus = null;

  function freshFilters() { return { q: '', gender: [], family: [], brand: [], max: null, sort: 'pop' }; }

  /* ---------- Утилиты ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rub(n) { return n.toLocaleString('ru-RU') + ' ₽'; }
  function plural(n, f) { var a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b > 1 && b < 5 ? f[1] : f[2]; }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function toggle(arr, v) { var i = arr.indexOf(v); if (i < 0) arr.push(v); else arr.splice(i, 1); }
  function variantLabel(v) { return (v.type === 'd' ? 'Распив ' : 'Флакон ') + v.ml + ' мл'; }
  function findVariant(p, type, ml) {
    return (type === 'd' ? p.decants : p.bottles).filter(function (v) { return v.ml === ml; })[0];
  }

  var ICON = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
    x: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
  };

  /* ---------- Иллюстрации: условные флаконы ---------- */
  var SHAPES = {
    square: { d: 'M56 96h88a6 6 0 0 1 6 6v104a6 6 0 0 1-6 6H56a6 6 0 0 1-6-6V102a6 6 0 0 1 6-6z', top: 96, cap: 'box', label: 150 },
    tall: { d: 'M76 84h48a8 8 0 0 1 8 8v112a8 8 0 0 1-8 8H76a8 8 0 0 1-8-8V92a8 8 0 0 1 8-8z', top: 84, cap: 'box', label: 146 },
    round: { d: 'M100 92a60 60 0 1 1 0 120a60 60 0 1 1 0-120z', top: 93, cap: 'ball', label: 152 },
    arch: { d: 'M50 212v-72a50 50 0 0 1 100 0v72z', top: 91, cap: 'box', label: 160 },
    drum: { d: 'M56 120h88a16 16 0 0 1 16 16v60a16 16 0 0 1-16 16H56a16 16 0 0 1-16-16v-60a16 16 0 0 1 16-16z', top: 120, cap: 'wide', label: 166 },
    facet: { d: 'M100 88l50 26v76l-50 22-50-22v-76z', top: 89, cap: 'box', label: 152 }
  };
  var svgN = 0;

  function flacon(p, bare) {
    var s = SHAPES[p.sh] || SHAPES.square, t = TINT[p.f] || '#C9A27A', u = 'fl' + (++svgN);
    var dark = hash(p.id) % 2 === 0, capFill = dark ? '#21150B' : 'url(#' + u + 'm)';
    var ny = s.top - 13, cap;
    if (s.cap === 'ball') cap = '<circle cx="100" cy="' + (ny - 15) + '" r="17" fill="' + capFill + '"/>';
    else if (s.cap === 'wide') cap = '<rect x="72" y="' + (ny - 26) + '" width="56" height="27" rx="3" fill="' + capFill + '"/>';
    else cap = '<rect x="82" y="' + (ny - 36) + '" width="36" height="37" rx="3" fill="' + capFill + '"/>';
    return '<svg viewBox="0 0 200 240" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="' + u + 'c"><path d="' + s.d + '"/></clipPath>' +
      '<linearGradient id="' + u + 'l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + t + '" stop-opacity=".62"/><stop offset="1" stop-color="' + t + '"/></linearGradient>' +
      '<linearGradient id="' + u + 'm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8E6238"/><stop offset=".45" stop-color="#E3C49A"/><stop offset="1" stop-color="#9C6E41"/></linearGradient></defs>' +
      (bare ? '' : '<circle cx="100" cy="132" r="94" fill="' + t + '" opacity=".14"/>') +
      '<ellipse cx="100" cy="215" rx="64" ry="5" fill="#21150B" opacity=".12"/>' +
      '<path d="' + s.d + '" fill="#fff" opacity=".6"/>' +
      '<g clip-path="url(#' + u + 'c)"><rect x="0" y="' + (s.top + 20) + '" width="200" height="240" fill="url(#' + u + 'l)"/>' +
      '<rect x="60" y="0" width="9" height="240" fill="#fff" opacity=".3"/><rect x="73" y="0" width="3" height="240" fill="#fff" opacity=".22"/></g>' +
      '<path d="' + s.d + '" fill="none" stroke="#21150B" stroke-opacity=".32" stroke-width="1.2"/>' +
      '<rect x="91" y="' + ny + '" width="18" height="15" fill="#F7F1EA" stroke="#21150B" stroke-opacity=".32" stroke-width="1"/>' + cap +
      '<rect x="77" y="' + (s.label - 15) + '" width="46" height="30" fill="#F7F1EA"/>' +
      '<path d="M85 ' + (s.label - 5) + 'h30M89 ' + (s.label + 2) + 'h17" stroke="#21150B" stroke-opacity=".55" stroke-width="1.1"/>' +
      '<circle cx="110" cy="' + (s.label + 2) + '" r="1.7" fill="#B18151"/>' +
      '</svg>';
  }

  function vial(p, ml, bare) {
    var t = TINT[p.f] || '#C9A27A', u = 'vl' + (++svgN);
    var h = 56 + Math.sqrt(ml) * 17, w = 26 + Math.sqrt(ml) * 4.2, x = 100 - w / 2, y = 212 - h;
    return '<svg viewBox="0 0 200 240" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + u + 'l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + t + '" stop-opacity=".62"/><stop offset="1" stop-color="' + t + '"/></linearGradient>' +
      '<linearGradient id="' + u + 'm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8E6238"/><stop offset=".45" stop-color="#E3C49A"/><stop offset="1" stop-color="#9C6E41"/></linearGradient></defs>' +
      (bare ? '' : '<circle cx="100" cy="132" r="94" fill="' + t + '" opacity=".14"/>') +
      '<ellipse cx="100" cy="215" rx="' + (w * .8) + '" ry="4" fill="#21150B" opacity=".12"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="#fff" opacity=".6"/>' +
      '<rect x="' + x + '" y="' + (y + h * .18) + '" width="' + w + '" height="' + (h * .82) + '" rx="5" fill="url(#' + u + 'l)"/>' +
      '<rect x="' + (x + w * .16) + '" y="' + y + '" width="' + (w * .12) + '" height="' + h + '" fill="#fff" opacity=".3"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="none" stroke="#21150B" stroke-opacity=".32" stroke-width="1.2"/>' +
      '<rect x="' + (100 - w * .36) + '" y="' + (y - 20) + '" width="' + (w * .72) + '" height="21" rx="2" fill="url(#' + u + 'm)"/>' +
      '<rect x="' + (100 - w * .2) + '" y="' + (y - 30) + '" width="' + (w * .4) + '" height="11" rx="2" fill="#21150B"/>' +
      '</svg>';
  }

  /* ---------- Карточка ---------- */
  function favBtn(p) {
    var on = favs.indexOf(p.id) >= 0;
    return '<button class="fav" data-action="fav" data-id="' + p.id + '" aria-pressed="' + on + '" aria-label="' +
      (on ? 'Убрать из избранного' : 'Добавить в избранное') + ': ' + esc(p.n) + '">' + ICON.heart + '</button>';
  }

  function card(p) {
    return '<article class="card">' +
      '<a class="card__art niche" href="#product-' + p.id + '" aria-label="' + esc(p.b + ' ' + p.n) + '">' + flacon(p) + '</a>' +
      favBtn(p) +
      '<div class="card__body">' +
      '<a class="card__brand" href="#catalog" data-go-brand="' + esc(p.b) + '">' + esc(p.b) + '</a>' +
      '<h3 class="card__name"><a href="#product-' + p.id + '">' + esc(p.n) + '</a></h3>' +
      '<p class="card__meta">' + esc(p.c) + ', ' + GENDER_ONE[p.g] + '</p>' +
      '<p class="card__price"><b>от ' + rub(p.min) + '</b><span>за ' + p.first.ml + ' мл</span></p>' +
      '</div></article>';
  }

  /* ---------- Главная ---------- */
  function ladderHtml() {
    return DECANTS.map(function (ml) {
      var d = Math.round(12 + Math.sqrt(ml) * 9.5);
      return '<button type="button" data-action="ladder" data-ml="' + ml + '" aria-pressed="' + (ml === 5) + '">' +
        '<i style="--d:' + d + 'px"></i><span>' + ml + '<small> мл</small></span></button>';
    }).join('');
  }
  function ladderOut(ml) {
    var sprays = ml * SPRAYS_PER_ML, days = Math.round(sprays / 4);
    return '<b>' + ml + ' мл</b><span>Примерно ' + sprays + ' ' + plural(sprays, ['нанесение', 'нанесения', 'нанесений']) +
      '. Этого хватает где-то на ' + days + ' ' + plural(days, ['день', 'дня', 'дней']) + ' ежедневной носки.</span>';
  }
  function brandsList() {
    var m = {};
    PRODUCTS.forEach(function (p) { m[p.b] = (m[p.b] || 0) + 1; });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'ru'); }).map(function (b) { return { name: b, n: m[b] }; });
  }
  function faqHtml() {
    var qa = [
      ['Что такое распив?', 'Это аромат из оригинального флакона, перелитый в стеклянный атомайзер объёмом от 2 до 50 мл. Так можно познакомиться с парфюмом до покупки целого флакона или взять любимый аромат в поездку.'],
      ['Какой объём взять для знакомства?', 'На первое знакомство обычно берут 2–3 мл: этого хватает, чтобы поносить аромат несколько дней и понять, как он раскрывается на коже. Если аромат уже знаком и нужен запас — 10 мл и больше.'],
      ['Куда вы доставляете?', 'По всей России. Срок и стоимость зависят от города и способа доставки — менеджер назовёт их, когда будет подтверждать заказ.'],
      ['Как оформить заказ?', 'Выберите аромат и объём, добавьте в корзину и оставьте контакты. Менеджер свяжется с вами, подтвердит наличие и согласует доставку и оплату.']
    ];
    return '<div class="faq">' + qa.map(function (x) {
      return '<details><summary>' + x[0] + '</summary><p>' + x[1] + '</p></details>';
    }).join('') + '</div>';
  }

  // Штамп «Осторожно, стекло» для блока про доставку
  var SEAL = '<svg class="seal" viewBox="0 0 316 220" aria-hidden="true" focusable="false">' +
    '<defs><path id="seal-top" d="M27 110a83 83 0 0 1 166 0"/><path id="seal-bottom" d="M15 110a95 95 0 0 0 190 0"/></defs>' +
    '<g fill="none" stroke="currentColor"><circle cx="110" cy="110" r="104" stroke-width="1.6"/><circle cx="110" cy="110" r="65" stroke-width="1"/>' +
    '<path stroke-width="1.5" d="M222 88q7-9 14 0t14 0 14 0 14 0 14 0 14 0M226 110q7-9 14 0t14 0 14 0 14 0 14 0 14 0M222 132q7-9 14 0t14 0 14 0 14 0 14 0 14 0"/></g>' +
    '<text class="seal__ring" text-anchor="middle"><textPath href="#seal-top" startOffset="50%">АРОМАТНО И ТОЧКА</textPath></text>' +
    '<text class="seal__ring" text-anchor="middle"><textPath href="#seal-bottom" startOffset="50%">ОСТОРОЖНО, СТЕКЛО</textPath></text>' +
    '<circle cx="23" cy="110" r="2.6" fill="currentColor"/><circle cx="197" cy="110" r="2.6" fill="currentColor"/>' +
    '<text class="seal__a" x="104" y="138" text-anchor="middle">А</text><circle cx="143" cy="132" r="5" fill="currentColor"/></svg>';

  var BLOT_HINT = 'Блоттер — бумажная полоска, на которой пробуют аромат. Выберите свою.';
  function pickCap(p) { return p.c + ', ' + GENDER_ONE[p.g] + ', ' + p.f.toLowerCase(); }

  function viewHome() {
    var hits = PRODUCTS.filter(function (p) { return p.hit; }).slice(0, 8);
    var first = hits[0] || PRODUCTS[0];

    var asked = hits.slice(0, 4).map(function (p) {
      return '<a class="tag" href="#product-' + p.id + '">' + esc(p.n) + '</a>';
    }).join('');

    var picks = hits.map(function (p) {
      var notes = [p.t[0], p.h[0], p.d[0]].filter(function (n, i, arr) { return arr.indexOf(n) === i; }).join(', ');
      return '<li><a class="pick" href="#product-' + p.id + '" data-pick="' + p.id + '">' +
        '<span class="pick__art niche" aria-hidden="true">' + flacon(p) + '</span>' +
        '<span class="pick__name">' + esc(p.n) + '<small>' + esc(p.b) + '</small></span>' +
        '<span class="pick__notes">' + esc(notes) + '</span>' +
        '<span class="pick__price">от ' + rub(p.min) + '<small>за ' + p.first.ml + ' мл</small></span></a></li>';
    }).join('');

    var DY = [0, 14, 4, 20, 8, 0, 16, 6, 12];
    var blots = FAMILIES.map(function (f, i) {
      var n = PRODUCTS.filter(function (p) { return p.f === f.name; }).length;
      return '<a class="blotter" href="#catalog" data-go-family="' + esc(f.name) + '" data-cap="' + esc(f.name + ' — ' + f.text.toLowerCase()) + '"' +
        ' style="--tint:' + f.tint + ';--y:' + DY[i % 9] + 'px">' +
        '<span class="blotter__strip"><i></i></span><b>' + esc(f.name) + '</b><em>' + n + '</em></a>';
    }).join('');

    // На главной — двенадцать брендов: сначала те, чьи ароматы в «Сейчас выбирают»
    var top = [];
    hits.forEach(function (p) { if (top.indexOf(p.b) < 0) top.push(p.b); });
    brandsList().forEach(function (b) { if (top.length < 12 && top.indexOf(b.name) < 0) top.push(b.name); });
    var brands = top.sort(function (a, b) { return a.localeCompare(b); }).map(function (b) {
      return '<a href="#catalog" data-go-brand="' + esc(b) + '">' + esc(b) + '</a>';
    }).join('');

    return '<section class="hero"><div class="hero__in">' +
      '<div class="hero__text"><h1>Найди свой Аромат<i class="dot"></i></h1>' +
      '<form class="finder js-search" id="finder" role="search" autocomplete="off">' +
      '<label class="visually-hidden" for="finder-input">Поиск по каталогу</label>' +
      '<div class="finder__field">' + ICON.search + '<input class="js-q" id="finder-input" type="search" placeholder="Аромат, бренд или нота">' +
      '<button class="btn" type="submit">Найти</button></div>' +
      '<div class="search__results" hidden></div>' +
      '<p class="finder__hint">В каталоге больше 30 000 позиций. Часто ищут:</p>' +
      '<div class="tags">' + asked + '</div></form></div>' +
      '<div class="hero__art"><img src="assets/img/logo-mark.webp" srcset="assets/img/logo-mark-480.webp 480w, assets/img/logo-mark.webp 800w" sizes="(max-width: 900px) 320px, 60vw" width="800" height="560" fetchpriority="high" decoding="async" alt="Знак «Ароматно и точка»: буква А в виде парфюмерного флакона с золотой крышкой"></div>' +
      '</div></section>' +

      '<nav class="quick wrap" aria-label="Разделы каталога">' +
      '<a href="#catalog" data-go-gender="f">Женские' + ICON.chev + '</a>' +
      '<a href="#catalog" data-go-gender="m">Мужские' + ICON.chev + '</a>' +
      '<a href="#catalog" data-go-gender="u">Унисекс' + ICON.chev + '</a>' +
      '<a href="#brands">Все бренды' + ICON.chev + '</a></nav>' +

      '<section class="section wrap duo picks">' +
      '<div class="duo__side"><h2 class="h2">Сейчас выбирают</h2>' +
      '<div class="picks__art niche" id="pick-art" data-id="' + first.id + '">' + flacon(first) + '</div>' +
      '<p class="picks__cap" id="pick-cap">' + esc(pickCap(first)) + '</p></div>' +
      '<div><ul class="picks__list">' + picks + '</ul>' +
      '<a class="btn btn--ghost picks__more" href="#catalog" data-action="reset-go">Смотреть весь каталог</a></div>' +
      '</section>' +

      '<section class="decant" id="decant"><div class="decant__in">' +
      '<div><h2>Сначала познакомьтесь. Флакон подождёт</h2>' +
      '<p>Переливаем аромат из оригинального флакона в стеклянный атомайзер — от 2 до 50 мл. Поносите пару дней и решите, ваш ли это запах.</p>' +
      '<a class="btn btn--light" href="#catalog" data-action="reset-go">Выбрать аромат</a></div>' +
      '<div><p class="ladder__hint" id="ladder-hint">Нажмите на объём — покажем, на сколько его хватит</p>' +
      '<div class="ladder" role="group" aria-labelledby="ladder-hint">' + ladderHtml() + '</div>' +
      '<div class="ladder__out" id="ladder-out" aria-live="polite">' + ladderOut(5) + '</div></div>' +
      '</div></section>' +

      '<section class="section wrap">' +
      '<h2 class="h2 h2--wide">Не помните название? Начните с характера</h2>' +
      '<div class="blotters" id="blotters">' + blots + '</div>' +
      '<p class="blotters__cap" id="blot-cap">' + BLOT_HINT + '</p></section>' +

      '<section class="section wrap duo">' +
      '<div class="duo__side"><h2 class="h2">Бренды</h2></div>' +
      '<div><div class="brandgrid">' + brands + '</div>' +
      '<a class="btn btn--ghost picks__more" href="#brands">Все бренды по алфавиту</a></div></section>' +

      '<section class="section wrap duo ship">' +
      '<div class="duo__side">' + SEAL + '</div>' +
      '<div><h2 class="h2">Оперативная доставка по всей России</h2>' +
      '<p>Флаконы и атомайзеры упаковываем так, чтобы они доехали целыми. Срок и стоимость зависят от города — их назовёт менеджер, когда будет подтверждать заказ.</p>' +
      '<a class="btn btn--ghost picks__more" href="#delivery">Доставка и оплата</a></div></section>';
  }

  function showPick(a) {
    var p = byId[a.getAttribute('data-pick')], art = $('#pick-art');
    if (!p || !art || art.getAttribute('data-id') === p.id) return;
    art.setAttribute('data-id', p.id);
    art.innerHTML = flacon(p);
    $('#pick-cap').textContent = pickCap(p);
  }
  function hoverHome(e) {
    var a = e.target.closest && e.target.closest('.pick'); if (a) showPick(a);
    var b = e.target.closest && e.target.closest('.blotter'), cap = $('#blot-cap');
    if (b && cap) cap.textContent = b.getAttribute('data-cap');
  }
  document.addEventListener('mouseover', hoverHome);
  document.addEventListener('focusin', hoverHome);
  document.addEventListener('mouseout', function (e) {
    var box = e.target.closest && e.target.closest('#blotters'), cap = $('#blot-cap');
    if (box && cap && !(e.relatedTarget && box.contains(e.relatedTarget))) cap.textContent = BLOT_HINT;
  });

  /* ---------- Каталог ---------- */
  function filtered() {
    var q = F.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var list = PRODUCTS.filter(function (p) {
      if (F.gender.length && F.gender.indexOf(p.g) < 0) return false;
      if (F.family.length && F.family.indexOf(p.f) < 0) return false;
      if (F.brand.length && F.brand.indexOf(p.b) < 0) return false;
      if (F.max != null && p.min > F.max) return false;
      for (var i = 0; i < q.length; i++) if (p.search.indexOf(q[i]) < 0) return false;
      return true;
    });
    var sorters = {
      pop: function (a, b) { return (b.hit - a.hit) || (a.rank - b.rank); },
      asc: function (a, b) { return a.min - b.min; },
      desc: function (a, b) { return b.min - a.min; },
      name: function (a, b) { return a.n.localeCompare(b.n); },
      brand: function (a, b) { return a.b.localeCompare(b.b) || a.n.localeCompare(b.n); }
    };
    return list.sort(sorters[F.sort] || sorters.pop);
  }

  function priceBounds() {
    var mins = PRODUCTS.map(function (p) { return p.min; });
    return { lo: Math.floor(Math.min.apply(null, mins) / 100) * 100, hi: Math.ceil(Math.max.apply(null, mins) / 100) * 100 };
  }

  function check(name, value, label, n, on) {
    return '<label class="check"><input type="checkbox" name="' + name + '" value="' + esc(value) + '"' + (on ? ' checked' : '') + '><i></i>' +
      esc(label) + '<em>' + n + '</em></label>';
  }

  function viewCatalog() {
    var pb = priceBounds(), max = F.max == null ? pb.hi : F.max;
    var count = function (k, v) { return PRODUCTS.filter(function (p) { return p[k] === v; }).length; };
    var segs = [['', 'Все'], ['f', GENDER.f], ['m', GENDER.m], ['u', GENDER.u]].map(function (s) {
      var on = s[0] ? (F.gender.length === 1 && F.gender[0] === s[0]) : !F.gender.length;
      return '<button type="button" class="seg" data-action="seg" data-g="' + s[0] + '" aria-pressed="' + on + '">' + s[1] + '</button>';
    }).join('');
    var fams = FAMILIES.map(function (f) { return check('family', f.name, f.name, count('f', f.name), F.family.indexOf(f.name) >= 0); }).join('');
    var brands = brandsList().map(function (b) { return check('brand', b.name, b.name, b.n, F.brand.indexOf(b.name) >= 0); }).join('');
    var sortOpt = [['pop', 'Сначала популярные'], ['asc', 'Сначала дешевле'], ['desc', 'Сначала дороже'], ['name', 'По названию'], ['brand', 'По бренду']]
      .map(function (o) { return '<option value="' + o[0] + '"' + (F.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');

    return '<section class="page"><header class="page__head"><h1>Каталог<i class="dot"></i></h1><p id="cat-count" aria-live="polite"></p></header>' +
      '<div class="segs" role="group" aria-label="Для кого">' + segs + '</div>' +
      '<div class="catalog__layout">' +
      '<aside class="filters" id="filters" aria-label="Фильтры">' +
      '<div class="filters__head"><h2>Фильтры</h2><button class="icon-btn" data-action="filters-close" aria-label="Закрыть фильтры">' + ICON.close + '</button></div>' +
      '<div class="filters__body">' +
      '<fieldset><legend>Характер</legend>' + fams + '</fieldset>' +
      '<fieldset><legend>Бренд</legend><input type="search" id="brand-find" placeholder="Найти бренд" aria-label="Найти бренд в списке">' +
      '<div class="filters__scroll" id="brand-list">' + brands + '</div></fieldset>' +
      '<fieldset class="range"><legend>Цена</legend><label for="price-max">До <output id="price-out">' + rub(max) + '</output></label>' +
      '<input type="range" id="price-max" min="' + pb.lo + '" max="' + pb.hi + '" step="100" value="' + max + '">' +
      '<small>Считаем по самому маленькому объёму аромата.</small></fieldset>' +
      '</div>' +
      '<div class="filters__foot"><button class="link filters__reset" data-action="reset">Сбросить<span> фильтры</span></button>' +
      '<button class="btn filters__apply" id="filters-apply" data-action="filters-close">Показать</button></div>' +
      '</aside>' +
      '<div><div class="toolbar"><button class="btn btn--ghost toolbar__filters" data-action="filters-open">Фильтры<i class="count" id="filters-n" hidden></i></button>' +
      '<label class="sort"><span>Сортировка</span><select id="sort" aria-label="Сортировка">' + sortOpt + '</select></label>' +
      '<div class="chips" id="chips"></div></div>' +
      '<div class="grid" id="grid"></div><div class="more" id="more"></div></div>' +
      '</div></section>';
  }

  function chip(kind, value, label) {
    return '<button class="chip" data-action="chip" data-kind="' + kind + '" data-value="' + esc(value) + '" aria-label="Убрать фильтр: ' + esc(label) + '">' + esc(label) + ICON.x + '</button>';
  }

  function updateGrid() {
    var grid = $('#grid'); if (!grid) return;
    var list = filtered(), n = list.length;
    $('#cat-count').textContent = n ? 'Найдено ' + n + ' ' + plural(n, ['аромат', 'аромата', 'ароматов']) : 'Ничего не нашлось';
    var chips = [];
    if (F.q.trim()) chips.push(chip('q', '', 'Поиск: ' + F.q.trim()));
    F.family.forEach(function (f) { chips.push(chip('family', f, f)); });
    F.brand.forEach(function (b) { chips.push(chip('brand', b, b)); });
    if (F.max != null) chips.push(chip('max', '', 'До ' + rub(F.max)));
    $('#chips').innerHTML = chips.join('');
    var act = F.family.length + F.brand.length + (F.max != null ? 1 : 0), fn = $('#filters-n'), ap = $('#filters-apply');
    if (fn) { fn.hidden = !act; fn.textContent = act; }
    if (ap) ap.textContent = n ? 'Показать ' + n + ' ' + plural(n, ['аромат', 'аромата', 'ароматов']) : 'Ничего не нашлось';

    if (!n) {
      grid.outerHTML = '<div class="empty" id="grid"><h2>По этим условиям ароматов нет</h2>' +
        '<p>Уберите часть фильтров или проверьте запрос — возможно, аромат записан латиницей.</p>' +
        '<button class="btn" data-action="reset">Сбросить фильтры</button></div>';
      $('#more').innerHTML = '';
      return;
    }
    if (!grid.classList.contains('grid')) { grid.outerHTML = '<div class="grid" id="grid"></div>'; grid = $('#grid'); }
    grid.innerHTML = list.slice(0, shown).map(card).join('');
    $('#more').innerHTML = n > shown
      ? '<button class="btn btn--ghost" data-action="more">Показать ещё ' + Math.min(PAGE, n - shown) + '</button>' : '';
  }

  /* ---------- Страница аромата ---------- */
  function volTile(v) {
    var on = sel.type === v.type && sel.ml === v.ml, d = Math.round(9 + Math.sqrt(v.ml) * 3.4);
    return '<button type="button" class="vol" data-action="vol" data-type="' + v.type + '" data-ml="' + v.ml + '" aria-pressed="' + on + '">' +
      '<span class="vol__ico">' + (v.type === 'd' ? '<i style="width:' + d + 'px;height:' + d + 'px"></i>' : '<i class="vol__flask"></i>') + '</span>' +
      '<b>' + v.ml + ' мл</b><span>' + rub(v.price) + '</span></button>';
  }
  function volsHtml(p) {
    return (p.decants.length ? '<h2 id="vd">Распив<small>в стеклянном атомайзере</small></h2>' +
      '<div class="vols__grid" role="group" aria-labelledby="vd">' + p.decants.map(volTile).join('') + '</div>' : '') +
      '<h2 id="vb">Флакон<small>целиком, в упаковке</small></h2>' +
      '<div class="vols__grid" role="group" aria-labelledby="vb">' + p.bottles.map(volTile).join('') + '</div>';
  }
  function buybarHtml(p) {
    var v = findVariant(p, sel.type, sel.ml);
    return '<div><b>' + rub(v.price * qty) + '</b><span>' + variantLabel(v) + (qty > 1 ? ' × ' + qty : '') + '</span></div>' +
      '<button class="btn" data-action="add">В корзину</button>';
  }
  function priceHtml(p) {
    var v = findVariant(p, sel.type, sel.ml);
    return '<b>' + rub(v.price * qty) + '</b><span>' + variantLabel(v) +
      (qty > 1 ? ', ' + qty + ' шт. по ' + rub(v.price) : '') + ' — ' + rub(Math.round(v.price / v.ml)) + ' за мл</span>';
  }
  function pyramidHtml(p) {
    var a = p.t.join(', '), b = p.h.join(', '), c = p.d.join(', ');
    if (a === b && b === c) return '<dl class="pyramid"><div><dt>Композиция</dt><dd>' + esc(a) + '</dd></div></dl>';
    return '<dl class="pyramid"><div><dt>Верхние ноты</dt><dd>' + esc(a) + '</dd></div>' +
      '<div><dt>Ноты сердца</dt><dd>' + esc(b) + '</dd></div><div><dt>База</dt><dd>' + esc(c) + '</dd></div></dl>';
  }

  function viewProduct(p) {
    current = p; qty = 1;
    var d5 = findVariant(p, 'd', 5);
    sel = d5 ? { type: 'd', ml: 5 } : { type: p.first.type, ml: p.first.ml };
    var related = PRODUCTS.filter(function (x) { return x.f === p.f && x.id !== p.id; }).slice(0, 4);

    return '<section class="page product">' +
      '<nav class="crumbs" aria-label="Вы здесь"><a href="#catalog" data-action="reset-go">Каталог</a><span>/</span>' +
      '<a href="#catalog" data-go-brand="' + esc(p.b) + '">' + esc(p.b) + '</a><span>/</span><span>' + esc(p.n) + '</span></nav>' +
      '<div class="product__layout">' +
      '<div class="product__art niche" id="p-art">' + (sel.type === 'd' ? vial(p, sel.ml) : flacon(p)) + '</div>' +
      '<div><a class="product__brand" href="#catalog" data-go-brand="' + esc(p.b) + '">' + esc(p.b) + '</a>' +
      '<h1>' + esc(p.n) + '</h1>' +
      '<p class="product__meta">' + esc(p.c) + ', ' + GENDER_ONE[p.g] + ', ' + p.f.toLowerCase() + '</p>' +
      '<div class="vols" id="p-vols">' + volsHtml(p) + '</div>' +
      '<p class="product__price" id="p-price" aria-live="polite">' + priceHtml(p) + '</p>' +
      '<div class="buy"><div class="qty"><button type="button" data-action="qty" data-d="-1" aria-label="Уменьшить количество">−</button>' +
      '<output id="p-qty">1</output><button type="button" data-action="qty" data-d="1" aria-label="Увеличить количество">+</button></div>' +
      '<button class="btn buy__add" data-action="add">Добавить в корзину</button>' + favBtn(p) + '</div>' +
      pyramidHtml(p) +
      '<ul class="assure"><li>Только оригинальная парфюмерия</li>' +
      '<li>Распив — из оригинального флакона в стеклянный атомайзер</li>' +
      '<li>Доставка по всей России</li></ul>' +
      '</div></div>' +
      (related.length ? '<section class="section"><h2 class="h2 h2--wide">Близкие по характеру</h2>' +
        '<div class="grid">' + related.map(card).join('') + '</div></section>' : '') +
      '<div class="buybar" id="buybar">' + buybarHtml(p) + '</div>' +
      '</section>';
  }

  function refreshProduct() {
    $('#p-vols').innerHTML = volsHtml(current);
    $('#p-price').innerHTML = priceHtml(current);
    $('#p-qty').textContent = qty;
    $('#buybar').innerHTML = buybarHtml(current);
    $('#p-art').innerHTML = sel.type === 'd' ? vial(current, sel.ml) : flacon(current);
  }

  /* ---------- Бренды ---------- */
  function viewBrands() {
    var groups = {};
    brandsList().forEach(function (b) { var l = b.name.charAt(0).toUpperCase(); (groups[l] = groups[l] || []).push(b); });
    var letters = Object.keys(groups).sort();
    return '<section class="page"><header class="page__head"><h1>Бренды<i class="dot"></i></h1>' +
      '<p>Выберите бренд, чтобы открыть его ароматы в каталоге.</p></header>' +
      '<div class="letters">' + letters.map(function (l) { return '<a href="#brands" data-action="letter" data-letter="' + l + '">' + l + '</a>'; }).join('') + '</div>' +
      '<div class="brands">' + letters.map(function (l) {
        return '<section id="letter-' + l + '"><h2>' + l + '</h2>' + groups[l].map(function (b) {
          return '<a href="#catalog" data-go-brand="' + esc(b.name) + '">' + esc(b.name) + '<em>' + b.n + '</em></a>';
        }).join('') + '</section>';
      }).join('') + '</div></section>';
  }

  /* ---------- Доставка, о магазине, избранное ---------- */
  function viewDelivery() {
    return '<section class="page"><header class="page__head"><h1>Доставка и оплата<i class="dot"></i></h1>' +
      '<p>Отправляем заказы по всей России.</p></header>' +
      '<div class="prose"><div>' +
      '<h2>Как проходит заказ</h2><ol class="steps">' +
      '<li><span><b>Соберите корзину</b><span>Выберите ароматы и объём: распив от 2 до 50 мл или целый флакон.</span></span></li>' +
      '<li><span><b>Оставьте контакты</b><span>Имя, телефон, город и удобный способ доставки.</span></span></li>' +
      '<li><span><b>Подтвердите заказ с менеджером</b><span>Он проверит наличие, назовёт срок и стоимость доставки и согласует оплату.</span></span></li>' +
      '<li><span><b>Получите посылку</b><span>Флаконы и атомайзеры упаковываем так, чтобы они доехали целыми.</span></span></li></ol>' +
      '</div><div>' +
      '<h2>Способы доставки</h2><p>' + DELIVERY.map(esc).join('. ') + '.</p>' +
      '<p>Срок и стоимость зависят от города и выбранного способа — точные цифры назовёт менеджер при подтверждении.</p>' +
      '<h2>Оплата</h2><p>Способ оплаты согласуем при подтверждении заказа.</p>' +
      '<h2>Остались вопросы?</h2>' + faqHtml() +
      '</div></div></section>';
  }

  function viewAbout() {
    var rows = [
      ['Более 30 000 позиций оригинальной парфюмерии', 'От классики больших домов до нишевых марок. Если аромат существует, скорее всего, он у нас есть.', 'catalog', 'Открыть каталог'],
      ['Распив и пробники от 2 до 50 мл', 'Не обязательно покупать флакон, чтобы понять, ваш ли это запах. Возьмите несколько миллилитров, поносите и решайте спокойно.', 'decant', 'Как устроен распив'],
      ['Оперативная доставка по всей России', 'Быстро собираем заказы и отправляем в любой город. Флаконы и атомайзеры упаковываем так, чтобы они доехали целыми.', 'delivery', 'Доставка и оплата']
    ];
    return '<section class="about"><h1 class="visually-hidden">О магазине «Ароматно и точка»</h1>' +
      '<div class="about__logo"><img src="assets/img/logo-full.webp" srcset="assets/img/logo-full-768.webp 768w, assets/img/logo-full.webp 1536w" sizes="(max-width: 1040px) 100vw, 1040px" width="1536" height="1024" decoding="async" alt="Логотип «Ароматно и точка»: буква А в виде парфюмерного флакона и название магазина"></div>' +
      '<div class="wrap about__rows">' + rows.map(function (r) {
        return '<div class="about__row"><h2 class="h2">' + r[0] + '</h2>' +
          '<div><p>' + r[1] + '</p><a class="link" href="#' + r[2] + '"' + (r[2] === 'catalog' ? ' data-action="reset-go"' : '') + '>' + r[3] + '</a></div></div>';
      }).join('') + '</div></section>';
  }

  function viewFavorites() {
    var list = favs.map(function (id) { return byId[id]; }).filter(Boolean);
    return '<section class="page"><header class="page__head"><h1>Избранное<i class="dot"></i></h1></header>' +
      (list.length ? '<div class="grid">' + list.map(card).join('') + '</div>'
        : '<div class="empty"><h2>Здесь будут ароматы, которые вы отметили</h2>' +
          '<p>Нажмите на сердце в карточке аромата, чтобы сохранить его и вернуться позже.</p>' +
          '<a class="btn" href="#catalog">Открыть каталог</a></div>') +
      '</section>';
  }

  /* ---------- Корзина ---------- */
  function cartTotal() {
    return cart.reduce(function (s, l) { var v = findVariant(byId[l.id], l.type, l.ml); return s + (v ? v.price * l.qty : 0); }, 0);
  }
  function cartCount() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function saveCart() { store.set('aromo-cart', cart); renderCart(); }

  function renderCart() {
    var n = cartCount();
    $$('.js-cart-count').forEach(function (c) { c.hidden = !n; c.textContent = n; });
    $$('.js-fav-count').forEach(function (c) { c.hidden = !favs.length; c.textContent = favs.length; });
    var body = $('#cart-body');
    if (!cart.length) {
      body.innerHTML = '<div class="cart-empty"><h3>В корзине пока пусто</h3>' +
        '<p>Начните с каталога — любой аромат можно взять распивом от 2 мл.</p>' +
        '<a class="btn" href="#catalog" data-action="cart-close">Открыть каталог</a></div>';
      return;
    }
    body.innerHTML = '<div class="cart-list">' + cart.map(function (l, i) {
      var p = byId[l.id], v = findVariant(p, l.type, l.ml);
      return '<div class="line"><a class="line__art niche" href="#product-' + p.id + '" aria-label="' + esc(p.n) + '">' + (l.type === 'd' ? vial(p, l.ml) : flacon(p)) + '</a>' +
        '<div><p class="line__brand">' + esc(p.b) + '</p><p class="line__name"><a href="#product-' + p.id + '">' + esc(p.n) + '</a></p>' +
        '<p class="line__var">' + variantLabel(v) + '</p>' +
        '<div class="qty qty--sm"><button type="button" data-action="line-qty" data-i="' + i + '" data-d="-1" aria-label="Уменьшить количество">−</button>' +
        '<output>' + l.qty + '</output><button type="button" data-action="line-qty" data-i="' + i + '" data-d="1" aria-label="Увеличить количество">+</button></div></div>' +
        '<div class="line__side"><b>' + rub(v.price * l.qty) + '</b><button class="line__del" data-action="line-del" data-i="' + i + '">Удалить</button></div></div>';
    }).join('') + '</div>' +
      '<div class="cart-foot"><div class="total"><span>Итого</span><b>' + rub(cartTotal()) + '</b></div>' +
      '<small>Без учёта доставки — её стоимость назовёт менеджер.</small>' +
      '<a class="btn btn--wide" href="#checkout">Оформить заказ</a></div>';
  }

  function addToCart(id, type, ml, n) {
    var l = cart.filter(function (x) { return x.id === id && x.type === type && x.ml === ml; })[0];
    if (l) l.qty += n; else cart.push({ id: id, type: type, ml: ml, qty: n });
    saveCart();
    toast('Добавлено в корзину');
  }

  /* ---------- Оформление ---------- */
  function viewCheckout() {
    if (!cart.length) {
      return '<section class="page"><header class="page__head"><h1>Оформление заказа<i class="dot"></i></h1></header>' +
        '<div class="empty"><h2>Сначала добавьте ароматы в корзину</h2><p>Оформлять пока нечего.</p>' +
        '<a class="btn" href="#catalog">Открыть каталог</a></div></section>';
    }
    var items = cart.map(function (l) {
      var p = byId[l.id], v = findVariant(p, l.type, l.ml);
      return '<li><span>' + esc(p.b + ' ' + p.n) + '<small>' + variantLabel(v) + ' × ' + l.qty + '</small></span><b>' + rub(v.price * l.qty) + '</b></li>';
    }).join('');
    var radios = DELIVERY.map(function (d, i) {
      return '<label class="radio"><input type="radio" name="delivery" value="' + esc(d) + '"' + (i === 0 ? ' checked' : '') + '>' + esc(d) + '</label>';
    }).join('');

    return '<section class="page"><header class="page__head"><h1>Оформление заказа<i class="dot"></i></h1>' +
      '<p>Оставьте контакты — менеджер подтвердит наличие и согласует доставку и оплату.</p></header>' +
      '<div class="checkout"><form class="form" id="order" novalidate>' +
      '<div class="form__row"><label><span>Имя и фамилия</span><input class="field" name="name" autocomplete="name" required></label>' +
      '<label><span>Телефон</span><input class="field" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7" required></label></div>' +
      '<label><span>Город</span><input class="field" name="city" autocomplete="address-level2" required></label>' +
      '<fieldset><legend>Способ доставки</legend>' + radios + '</fieldset>' +
      '<label><span>Адрес или пункт выдачи (можно уточнить позже)</span><input class="field" name="address" autocomplete="street-address"></label>' +
      '<label><span>Как с вами связаться</span><select class="field" name="contact"><option>Telegram</option><option>WhatsApp</option><option>Звонок</option></select></label>' +
      '<label><span>Комментарий к заказу</span><textarea class="field" name="comment"></textarea></label>' +
      '<label class="agree"><input type="checkbox" name="agree" required><span>Согласен на обработку персональных данных для оформления заказа</span></label>' +
      '<p class="form__error" id="order-error" role="alert" hidden></p>' +
      '<button class="btn" type="submit">Отправить заказ</button></form>' +
      '<aside class="summary" aria-label="Ваш заказ"><h2>Ваш заказ</h2><ul>' + items + '</ul>' +
      '<div class="total"><span>Итого</span><b>' + rub(cartTotal()) + '</b></div><small>Без учёта доставки.</small></aside>' +
      '</div></section>';
  }

  function fieldError(el, msg) {
    var old = el.parentNode.querySelector('.err'); if (old) old.remove();
    if (msg) {
      el.setAttribute('aria-invalid', 'true');
      var s = document.createElement('span'); s.className = 'err'; s.textContent = msg;
      el.parentNode.appendChild(s);
    } else el.removeAttribute('aria-invalid');
    return !msg;
  }

  function submitOrder(form) {
    var f = form.elements, ok = true, first = null;
    function need(el, cond, msg) { if (!fieldError(el, cond ? '' : msg)) { ok = false; first = first || el; } }
    need(f.name, f.name.value.trim().length > 1, 'Укажите имя, чтобы менеджер знал, как к вам обращаться');
    need(f.phone, f.phone.value.replace(/\D/g, '').length >= 10, 'Укажите телефон полностью, с кодом — например, +7 900 000-00-00');
    need(f.city, f.city.value.trim().length > 1, 'Укажите город доставки');
    var err = $('#order-error');
    if (!f.agree.checked) { ok = false; err.hidden = false; err.textContent = 'Отметьте согласие на обработку данных — без него заказ не оформить.'; first = first || f.agree; }
    else err.hidden = true;
    if (!ok) { first.focus(); return; }

    var lines = cart.map(function (l) {
      var p = byId[l.id], v = findVariant(p, l.type, l.ml);
      return { brand: p.b, name: p.n, variant: variantLabel(v), qty: l.qty, price: v.price, sum: v.price * l.qty };
    });
    var order = {
      name: f.name.value.trim(), phone: f.phone.value.trim(), city: f.city.value.trim(),
      delivery: f.delivery.value, address: f.address.value.trim(), contact: f.contact.value,
      comment: f.comment.value.trim(), items: lines, total: cartTotal()
    };
    var text = 'Заказ «Ароматно и точка»\n\n' + lines.map(function (l, i) {
      return (i + 1) + '. ' + l.brand + ' ' + l.name + ' — ' + l.variant + ' × ' + l.qty + ' = ' + rub(l.sum);
    }).join('\n') + '\n\nИтого: ' + rub(order.total) + ' (без доставки)\n\n' +
      order.name + ', ' + order.phone + '\n' + order.city + ', ' + order.delivery +
      (order.address ? '\nАдрес: ' + order.address : '') + '\nСвязь: ' + order.contact +
      (order.comment ? '\nКомментарий: ' + order.comment : '');
    order.text = text;

    if (!CFG.orderEndpoint) { showOrderText(text); return; }

    var btn = form.querySelector('[type="submit"]');
    btn.disabled = true; btn.textContent = 'Отправляем…';
    fetch(CFG.orderEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); })
      .then(function () {
        cart = []; saveCart();
        $('#view').innerHTML = '<section class="page done"><header class="page__head"><h1>Заказ отправлен<i class="dot"></i></h1>' +
          '<p class="lead">Менеджер свяжется с вами, подтвердит наличие и согласует доставку и оплату.</p></header>' +
          '<a class="btn" href="#catalog">Вернуться в каталог</a></section>';
        window.scrollTo(0, 0);
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Отправить заказ';
        err.hidden = false;
        err.textContent = 'Заказ не отправился. Проверьте интернет и нажмите «Отправить заказ» ещё раз — корзина сохранена.';
      });
  }

  // Пока не подключён приём заказов: показываем готовый текст заказа для отправки менеджеру
  function showOrderText(text) {
    var links = '';
    if (CFG.telegram) links += '<a class="btn btn--ghost" href="' + esc(CFG.telegram) + '" target="_blank" rel="noopener">Открыть Telegram</a>';
    if (CFG.whatsapp) links += '<a class="btn btn--ghost" href="' + esc(CFG.whatsapp) + '" target="_blank" rel="noopener">Открыть WhatsApp</a>';
    $('#view').innerHTML = '<section class="page done"><header class="page__head"><h1>Заказ собран<i class="dot"></i></h1>' +
      '<p class="lead">Скопируйте текст заказа и отправьте его менеджеру — он подтвердит наличие и согласует доставку и оплату.</p></header>' +
      '<pre class="order-text" id="order-text">' + esc(text) + '</pre>' +
      '<div class="done__actions"><button class="btn" data-action="copy-order">Скопировать текст заказа</button>' + links +
      '<a class="btn btn--ghost" href="#catalog">Вернуться в каталог</a></div></section>';
    window.scrollTo(0, 0);
    $('#view').focus({ preventScroll: true });
  }

  /* ---------- Слои: корзина, меню, фильтры ---------- */
  var overlay = $('#overlay');
  function openLayer(el) {
    closeLayers(true);
    lastFocus = document.activeElement;
    $('#toast').classList.remove('is-on');
    el.classList.add('is-open'); if (el.id !== 'filters') el.setAttribute('aria-hidden', 'false');
    overlay.hidden = false; document.body.classList.add('is-locked');
    var b = el.querySelector('button, a'); if (b) b.focus();
  }
  function closeLayers(silent) {
    var any = false;
    [$('#cart'), $('#menu'), $('#filters')].forEach(function (el) {
      if (!el) return;
      if (el.classList.contains('is-open')) { el.classList.remove('is-open'); any = true; }
      if (el.id !== 'filters') el.setAttribute('aria-hidden', 'true');
    });
    overlay.hidden = true; document.body.classList.remove('is-locked');
    if (any && !silent && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  var toastT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('is-on'); }, 2400);
  }

  /* ---------- Поиск: в шапке и на первом экране ---------- */
  function hideSuggest() {
    $$('.search__results').forEach(function (b) { b.hidden = true; });
    var pop = $('#sheet-popular'); if (pop) pop.hidden = false;
  }
  function suggest(input) {
    var box = input.form && input.form.querySelector('.search__results'); if (!box) return;
    var q = input.value.trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; syncPopular(input, box); return; }
    var words = q.split(/\s+/);
    var list = PRODUCTS.filter(function (p) { return words.every(function (w) { return p.search.indexOf(w) >= 0; }); });
    box.innerHTML = list.length
      ? list.slice(0, 5).map(function (p) {
        return '<a class="search__item" href="#product-' + p.id + '">' + flacon(p) + '<span><b>' + esc(p.n) + '</b><span>' + esc(p.b) + ' — от ' + rub(p.min) + '</span></span></a>';
      }).join('') + '<button type="submit" class="search__all">Показать все результаты: ' + list.length + '</button>'
      : '<p class="search__empty">Ничего не нашлось. Попробуйте название латиницей или ноту — например, «ваниль».</p>';
    box.hidden = false;
    syncPopular(input, box);
  }
  function syncPopular(input, box) {
    var pop = input.form.parentNode.querySelector('.sheet__popular'); if (pop) pop.hidden = !box.hidden;
  }

  // Поиск на телефоне: отдельный экран поверх страницы
  var sheet = $('#search-sheet'), isPhone = window.matchMedia('(max-width: 900px)');
  function openSearch() {
    closeLayers(true);
    sheet.hidden = false; document.body.classList.add('is-locked');
    var i = $('#sheet-input'); i.value = ''; hideSuggest(); $('#sheet-popular').hidden = false; i.focus();
  }
  function closeSearch() {
    if (sheet.hidden) return;
    sheet.hidden = true; document.body.classList.remove('is-locked');
  }
  $('#sheet-popular').innerHTML = '<h2>Часто ищут</h2>' + PRODUCTS.filter(function (p) { return p.hit; }).slice(0, 6).map(function (p) {
    return '<a class="search__item" href="#product-' + p.id + '">' + flacon(p) + '<span><b>' + esc(p.n) + '</b><span>' + esc(p.b) + ' — от ' + rub(p.min) + '</span></span></a>';
  }).join('');
  document.addEventListener('input', function (e) { if (e.target.matches('.js-q')) suggest(e.target); });
  document.addEventListener('focusin', function (e) {
    if (!e.target.matches || !e.target.matches('.js-q')) return;
    if (e.target.id === 'finder-input' && isPhone.matches) { e.target.blur(); openSearch(); return; }
    suggest(e.target);
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.js-search')) hideSuggest(); });

  // На главной поиск стоит на первом экране; в шапке он появляется, когда первый экран прокручен
  var heroWatch = null;
  function watchHero(isHome) {
    if (heroWatch) { heroWatch.disconnect(); heroWatch = null; }
    document.body.classList.toggle('is-home', isHome);
    document.body.classList.remove('is-past-hero');
    var f = $('#finder');
    if (!isHome || !f) return;
    if (!('IntersectionObserver' in window)) { document.body.classList.add('is-past-hero'); return; }
    heroWatch = new IntersectionObserver(function (en) {
      document.body.classList.toggle('is-past-hero', !en[0].isIntersecting);
    });
    heroWatch.observe(f);
  }

  // На телефоне цена и кнопка покупки закрепляются внизу, пока основная кнопка не на экране
  var buyWatch = null;
  function watchBuy() {
    if (buyWatch) { buyWatch.disconnect(); buyWatch = null; }
    var b = $('.buy__add'), bar = $('#buybar');
    if (!b || !bar || !('IntersectionObserver' in window)) return;
    buyWatch = new IntersectionObserver(function (en) { bar.classList.toggle('is-on', !en[0].isIntersecting); });
    buyWatch.observe(b);
  }

  /* ---------- Маршруты ---------- */
  var TITLES = { catalog: 'Каталог', brands: 'Бренды', delivery: 'Доставка и оплата', about: 'О магазине', favorites: 'Избранное', checkout: 'Оформление заказа' };
  function go(name) {
    if (location.hash === '#' + name) route(); else location.hash = name;
  }
  function route() {
    var h = location.hash.replace(/^#/, ''), view = $('#view'), html, title = '';
    closeSearch(); closeLayers(true); hideSuggest(); current = null;
    if (h.indexOf('product-') === 0 && byId[h.slice(8)]) { var p = byId[h.slice(8)]; html = viewProduct(p); title = p.b + ' ' + p.n; }
    else if (h === 'catalog') html = viewCatalog();
    else if (h === 'brands') html = viewBrands();
    else if (h === 'delivery') html = viewDelivery();
    else if (h === 'about') html = viewAbout();
    else if (h === 'favorites') html = viewFavorites();
    else if (h === 'checkout') html = viewCheckout();
    else { html = viewHome(); if (h !== 'decant') h = ''; }
    title = title || TITLES[h];
    document.title = (title ? title + ' — ' : '') + 'Ароматно и точка' + (title ? '' : ' — оригинальная парфюмерия, распив от 2 мл');
    view.innerHTML = html;
    if (h === 'catalog') updateGrid();
    watchHero(h === '' || h === 'decant');
    watchBuy();
    document.body.classList.toggle('is-product', !!current);
    $$('[data-nav]').forEach(function (a) {
      var k = a.getAttribute('data-nav');
      var on = k === 'home' ? (h === '' || h === 'decant') : k === 'catalog' ? (h === 'catalog' || !!current) : k === h;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (h === 'decant') { var d = $('#decant'); if (d) d.scrollIntoView(); }
    else window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ---------- События ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go-brand],[data-go-family],[data-go-gender]');
    if (t) {
      F = freshFilters(); shown = PAGE;
      if (t.hasAttribute('data-go-brand')) F.brand = [t.getAttribute('data-go-brand')];
      if (t.hasAttribute('data-go-family')) F.family = [t.getAttribute('data-go-family')];
      if (t.hasAttribute('data-go-gender')) F.gender = [t.getAttribute('data-go-gender')];
      e.preventDefault(); go('catalog'); return;
    }
    if (e.target === overlay) { closeLayers(); return; }
    var a = e.target.closest('[data-action]');
    if (!a) return;
    var act = a.getAttribute('data-action'), i;
    switch (act) {
      case 'cart-open': openLayer($('#cart')); break;
      case 'cart-close': closeLayers(); break;
      case 'menu-open': openLayer($('#menu')); break;
      case 'menu-close': closeLayers(); break;
      case 'filters-open': openLayer($('#filters')); break;
      case 'filters-close': closeLayers(); break;
      case 'search-open': openSearch(); break;
      case 'search-close': closeSearch(); break;
      case 'seg':
        F.gender = a.getAttribute('data-g') ? [a.getAttribute('data-g')] : []; shown = PAGE;
        $$('.seg').forEach(function (b) { b.setAttribute('aria-pressed', b === a); });
        updateGrid();
        break;
      case 'fav':
        toggle(favs, a.getAttribute('data-id')); store.set('aromo-favs', favs);
        var on = favs.indexOf(a.getAttribute('data-id')) >= 0;
        $$('.fav[data-id="' + a.getAttribute('data-id') + '"]').forEach(function (b) {
          b.setAttribute('aria-pressed', on);
          b.setAttribute('aria-label', (on ? 'Убрать из избранного' : 'Добавить в избранное') + ': ' + byId[b.getAttribute('data-id')].n);
        });
        renderCart();
        toast(on ? 'Добавлено в избранное' : 'Убрано из избранного');
        if (location.hash === '#favorites' && !on) route();
        break;
      case 'ladder':
        $$('.ladder button').forEach(function (b) { b.setAttribute('aria-pressed', b === a); });
        $('#ladder-out').innerHTML = ladderOut(+a.getAttribute('data-ml'));
        break;
      case 'vol':
        sel = { type: a.getAttribute('data-type'), ml: +a.getAttribute('data-ml') };
        refreshProduct();
        var again = $('.vols [data-type="' + sel.type + '"][data-ml="' + sel.ml + '"]'); if (again) again.focus();
        break;
      case 'qty':
        qty = Math.max(1, Math.min(20, qty + +a.getAttribute('data-d')));
        $('#p-qty').textContent = qty; $('#p-price').innerHTML = priceHtml(current); $('#buybar').innerHTML = buybarHtml(current);
        break;
      case 'add': addToCart(current.id, sel.type, sel.ml, qty); break;
      case 'line-qty':
        i = +a.getAttribute('data-i');
        cart[i].qty += +a.getAttribute('data-d');
        if (cart[i].qty < 1) cart.splice(i, 1);
        saveCart(); if (location.hash === '#checkout') route();
        break;
      case 'line-del':
        cart.splice(+a.getAttribute('data-i'), 1); saveCart();
        if (location.hash === '#checkout') route();
        break;
      case 'more': shown += PAGE; updateGrid(); break;
      case 'reset': F = freshFilters(); shown = PAGE; route(); break;
      case 'reset-go':
        F = freshFilters(); shown = PAGE;
        if (location.hash === '#catalog' && a.getAttribute('href') === '#catalog') route();
        break;
      case 'chip':
        var k = a.getAttribute('data-kind'), v = a.getAttribute('data-value');
        if (k === 'q') F.q = ''; else if (k === 'max') F.max = null; else toggle(F[k], v);
        shown = PAGE; route();
        break;
      case 'letter':
        e.preventDefault();
        var sec = document.getElementById('letter-' + a.getAttribute('data-letter')); if (sec) sec.scrollIntoView();
        break;
      case 'copy-order':
        var txt = $('#order-text').textContent;
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject())
          .then(function () { toast('Текст заказа скопирован'); })
          .catch(function () {
            var r = document.createRange(); r.selectNodeContents($('#order-text'));
            var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
            toast('Текст выделен — скопируйте его вручную');
          });
        break;
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('.filters input[type="checkbox"]')) { toggle(F[t.name], t.value); shown = PAGE; updateGrid(); }
    else if (t.id === 'sort') { F.sort = t.value; updateGrid(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'price-max') {
      var pb = priceBounds(); F.max = +t.value >= pb.hi ? null : +t.value;
      $('#price-out').textContent = rub(+t.value); shown = PAGE; updateGrid();
    } else if (t.id === 'brand-find') {
      var q = t.value.trim().toLowerCase();
      $$('#brand-list .check').forEach(function (l) { l.hidden = q && l.textContent.toLowerCase().indexOf(q) < 0; });
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'order') { e.preventDefault(); submitOrder(e.target); }
    else if (e.target.matches('.js-search')) {
      e.preventDefault();
      var qi = e.target.querySelector('.js-q');
      F = freshFilters(); F.q = qi.value.trim(); shown = PAGE;
      hideSuggest(); qi.blur();
      go('catalog');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!sheet.hidden) closeSearch();
      else if ($$('.search__results').some(function (b) { return !b.hidden; })) hideSuggest(); else closeLayers();
    }
  });

  /* ---------- Подвал: контакты ---------- */
  (function () {
    var c = $('#footer-contacts'), html = '';
    if (CFG.phone) html += '<a href="tel:' + esc(CFG.phone.replace(/[^\d+]/g, '')) + '">' + esc(CFG.phone) + '</a>';
    if (CFG.telegram) html += '<a href="' + esc(CFG.telegram) + '" target="_blank" rel="noopener">Telegram</a>';
    if (CFG.whatsapp) html += '<a href="' + esc(CFG.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a>';
    if (CFG.email) html += '<a href="mailto:' + esc(CFG.email) + '">' + esc(CFG.email) + '</a>';
    c.insertAdjacentHTML('beforeend', html || '<p>Контакты скоро появятся здесь.</p>');
    $('#footer-legal').textContent = '© ' + new Date().getFullYear() + ' Ароматно и точка' + (CFG.legal ? '. ' + CFG.legal : '');
  })();

  renderCart();
  route();
})();
