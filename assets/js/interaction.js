(function(){
  var SOCIAL_CUSTOM_ID = 'honsocial';
  function closeAll(){
    var open = document.querySelectorAll('.over-menu.active,.megamenu.open,.catfilter-panel.open,.has-sub.open,.mega-left>li.open,.herosearch-suggest.open');
    Array.prototype.forEach.call(open, function(el){
      el.classList.remove('active');
      el.classList.remove('open');
      // The trigger's aria-expanded has to come back down with the panel, or
      // assistive tech keeps announcing a menu that is no longer on screen.
      var trig = el.querySelector(':scope > [aria-expanded]');
      if (trig) trig.setAttribute('aria-expanded', 'false');
    });
  }
  document.addEventListener('click', closeAll);
  // Escape closes whatever is open, the behaviour every menu widget is
  // expected to have and the only way out for a keyboard user.
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeAll();
  });

  // ---- per-card overflow menu: open in new tab / report / share flyout ----
  function copyToClipboard(text){
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(ta);
  }
  function shareTarget(net, pageUrl, title){
    var u = encodeURIComponent(pageUrl);
    var t = encodeURIComponent(title);
    if (net === 'email') return 'mailto:?subject=' + t + '&body=' + u;
    if (net === 'facebook') return 'https://www.facebook.com/sharer/sharer.php?u=' + u;
    if (net === 'twitter') return 'https://twitter.com/intent/tweet?url=' + u + '&text=' + t;
    if (net === 'pinterest') return 'https://pinterest.com/pin/create/button/?url=' + u + '&description=' + t;
    return '';
  }

  // One delegated listener on the grid instead of ~7 listeners per card.
  // Necessary now that most cards are built in the browser after this script
  // runs: per-element listeners attached at load would only ever cover the
  // server-rendered head of the grid, leaving the overflow menu dead on
  // every injected card. Also cheaper -- this used to attach ~42,000
  // listeners on a 6,000-card page.
  function cardShareUrl(card){
    // ?deal= rather than #. The "#" form is what these buttons handed out
    // until 2026-08-11, and it is the form confirmed to break when pasted
    // into an Instagram/TikTok/Facebook caption -- the caption parser reads
    // "#d" as the start of a hashtag and swallows the rest of the URL.
    return location.protocol + '//' + location.host + location.pathname
           + (card && card.id ? '?deal=' + encodeURIComponent(card.id) : '');
  }

  // Was grid.addEventListener -- broke entirely on any page with an
  // .over-menu but no .grid container (e.g. the durable /d/pick-*.html
  // Amazon Picks share pages added 2026-08-20: grid was null there, so the
  // listener never attached and Share silently did nothing). Delegating on
  // document instead costs nothing on grid pages (e.target.closest('.over-menu')
  // already scopes the logic correctly regardless of which ancestor the
  // listener sits on) and makes the Share button work on any page that has
  // one, not just the grid-based deal listings.
  document.addEventListener('click', function(e){
    var menu = e.target.closest ? e.target.closest('.over-menu') : null;
    if (!menu) return;
    e.stopPropagation();

    var url = menu.getAttribute('data-url');
    var title = menu.getAttribute('data-title') || 'Deal';
    var pageUrl = cardShareUrl(menu.closest('.card'));
    var dots = menu.querySelector('.dots');

    var shareBtn = e.target.closest('.sh');
    if (shareBtn) {
      e.preventDefault();
      var net = shareBtn.getAttribute('data-net');
      if (net === 'copy') {
        copyToClipboard(pageUrl);
        shareBtn.textContent = 'Copied!';
        setTimeout(function(){
          shareBtn.textContent = 'Copy Link';
          menu.classList.remove('active');
        }, 900);
        return;
      }
      var target = shareTarget(net, pageUrl, title);
      if (!target) return;
      if (net === 'email') { location.href = target; }
      else { window.open(target, '_blank', 'noopener'); }
      menu.classList.remove('active');
      return;
    }

    var shareLbl = e.target.closest('.menu-share-lbl');
    if (shareLbl) {
      e.preventDefault();
      var nowOpen = shareLbl.parentElement.classList.toggle('open');
      shareLbl.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
      return;
    }

    if (e.target.closest('.menu-open')) {
      e.preventDefault();
      window.open(url, '_blank', 'noopener');
      menu.classList.remove('active');
      return;
    }

    // "Report an Error" is a real href; let it navigate.
    if (e.target.closest('.menu-report')) return;
    // Anything else inside the open dropdown is not a control.
    if (e.target.closest('.dropdown')) return;

    // Toggle on the whole button, not just the glyph. The listener used to sit
    // on the .dots span, which measures 4.8x18px inside a 28x28 button -- 89%
    // of what looks like a button did nothing when clicked (measured in-page
    // 2026-08-10).
    var was = menu.classList.contains('active');
    closeAll();
    if (!was) menu.classList.add('active');
    if (dots) dots.setAttribute('aria-expanded', was ? 'false' : 'true');
  });

  var grid = document.querySelector('.grid');

  // ---- top-nav Categories mega menu (all pages) ----
  var megaBtn = document.getElementById('megaBtn');
  var megaPanel = document.getElementById('megaPanel');
  if (megaBtn && megaPanel) {
    megaBtn.addEventListener('click', function(e){
      e.stopPropagation();
      var was = megaPanel.classList.contains('open');
      closeAll();
      if (!was) megaPanel.classList.add('open');
    });
    megaPanel.addEventListener('click', function(e){ e.stopPropagation(); });
    // mega-menu links are plain hrefs to the per-category pages -- real,
    // crawlable navigation; no JS needed beyond open/close.
  }

  // ---- shared: Amazon-style suggestion dropdown under a search box ----
  // One implementation wired to two different card sets below (the deal
  // grid and Amazon Picks) instead of two near-identical copies. Every card
  // it reads from must carry data-title (lowercased, for matching) and
  // data-title-display (original case, for what the dropdown shows) -- see
  // _card()/_render_pick_card() in html_output.py.
  function reEsc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Amazon Picks are a separate catalogue, not part of any deal grid (see
  // _render_pick_card in html_output.py), so they're invisible to a search
  // that only scans the current page's cards. This is the fix for that:
  // a tiny title-only feed (picks-search.json), fetched once and cached
  // here, that the deal-grid search below also matches against. Lazy --
  // only the first real keystroke triggers the fetch -- so pages nobody
  // searches from never pay for it.
  var picksIndexPromise = null;
  function loadPicksIndex(){
    if (!picksIndexPromise) {
      picksIndexPromise = (window.fetch ? fetch('/picks-search.json') : Promise.reject())
        .then(function(r){ return r.ok ? r.json() : []; })
        .catch(function(){ return []; });
    }
    return picksIndexPromise;
  }

  function attachSearchSuggest(input, box, getCards, onSelect, includePicks){
    if (!input) return;
    // `box` is missing on any page whose HTML hasn't been regenerated since
    // this dropdown shipped (old static output has the search input but not
    // the #searchSuggest div). Filtering must still work on those pages --
    // only the dropdown itself is allowed to no-op -- so every box-touching
    // step below is individually guarded rather than bailing out up front.
    var SUGGEST_MAX = 8;
    var items = [];
    var activeIdx = -1;
    var picksIndex = null;
    if (includePicks) loadPicksIndex().then(function(list){ picksIndex = list; });

    function close(){ if (box) { box.classList.remove('open'); activeIdx = -1; } }

    function collect(query){
      var seen = {};
      var out = [];
      var cards = getCards();
      for (var i = 0; i < cards.length && out.length < SUGGEST_MAX; i++) {
        var titleLower = cards[i].getAttribute('data-title') || '';
        if (titleLower.indexOf(query) === -1 || seen[titleLower]) continue;
        seen[titleLower] = true;
        out.push({title: cards[i].getAttribute('data-title-display') || titleLower, pick: false});
      }
      if (picksIndex) {
        for (var p = 0; p < picksIndex.length && out.length < SUGGEST_MAX; p++) {
          var t = picksIndex[p];
          var tl = t.toLowerCase();
          if (tl.indexOf(query) === -1 || seen[tl]) continue;
          seen[tl] = true;
          out.push({title: t, pick: true});
        }
      }
      return out;
    }

    function render(query){
      if (!box) return;
      if (query.length < 2) { close(); items = []; return; }
      items = collect(query);
      activeIdx = -1;
      if (!items.length) { close(); return; }
      var hl = new RegExp('(' + reEsc(query) + ')', 'ig');
      box.innerHTML = items.map(function(it){
        var marked = esc(it.title).replace(hl, '<b>$1</b>');
        var tag = it.pick ? "<span class='sugg-tag'>Amazon Pick</span>" : '';
        return "<button type='button' role='option' data-value=\"" + esc(it.title) + '"'
          + (it.pick ? " data-pick='1'" : '') + '>' + marked + tag + '</button>';
      }).join('');
      box.classList.add('open');
    }

    function setActive(idx){
      var btns = box.querySelectorAll('button');
      Array.prototype.forEach.call(btns, function(b){ b.classList.remove('active'); });
      if (idx >= 0 && idx < btns.length) {
        btns[idx].classList.add('active');
        btns[idx].scrollIntoView({block: 'nearest'});
      }
    }

    function choose(it){
      if (it.pick) {
        // Picks aren't on this page at all -- send the click to the one
        // page that has them, with the search already applied there (see
        // applyPicksQueryParam below).
        location.href = '/amazon-picks.html?q=' + encodeURIComponent(it.title);
        return;
      }
      input.value = it.title;
      close();
      onSelect(it.title);
    }

    // Filtering can run over thousands of cards, so doing it on every
    // keystroke synchronously blocks the main thread long enough to feel
    // like input lag while typing. Debouncing lets fast typing finish
    // before the filter/suggestion pass runs.
    var debounce;
    input.addEventListener('input', function(){
      clearTimeout(debounce);
      debounce = setTimeout(function(){
        var v = input.value.trim();
        onSelect(v);
        render(v.toLowerCase());
      }, 150);
    });
    // Clicking into the field is a click on .herosearch, which bubbles to
    // the document-level closeAll() above and would hide the dropdown the
    // same tick it opens. Same fix as megaBtn/megaPanel use: stop it here.
    input.addEventListener('click', function(e){ e.stopPropagation(); });
    input.addEventListener('focus', function(){
      if (box && input.value.trim().length >= 2) render(input.value.trim().toLowerCase());
    });
    input.addEventListener('keydown', function(e){
      if (!box || !box.classList.contains('open')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        setActive(activeIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, -1);
        setActive(activeIdx);
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        choose(items[activeIdx]);
      } else if (e.key === 'Escape') {
        close();
      }
    });
    if (box) {
      box.addEventListener('click', function(e){ e.stopPropagation(); });
      box.addEventListener('mousedown', function(e){
        // mousedown, not click: fires before the input's blur, so the value
        // it reads is still whatever was just typed.
        var btn = e.target.closest ? e.target.closest('button') : null;
        if (btn) choose({title: btn.getAttribute('data-value'), pick: !!btn.getAttribute('data-pick')});
      });
    }
  }

  // ---- Amazon Picks page: category filter + load more ----
  // Separate from the deals-grid logic below because picks cards (`.pick` /
  // `.pick-lasso`) are a different render path (see _render_pick_card in
  // html_output.py) with their own CSS, not the `.card`/`.grid` this file's
  // main block expects -- and this file loads on every page, including
  // amazon-picks.html, where `grid` above is always null.
  (function(){
    var picksCatBtn = document.getElementById('picksCatBtn');
    var picksCatPanel = document.getElementById('picksCatPanel');
    var picksLoadMore = document.getElementById('picksLoadMore');
    var picksPager = document.getElementById('picksPager');
    var picksPagerStatus = document.getElementById('picksPagerStatus');
    var picksEmpty = document.getElementById('picksFilterEmpty');
    var allPicks = Array.prototype.slice.call(document.querySelectorAll('.pick'));
    if (!allPicks.length) return;
    var PICKS_PAGE_SIZE = 40;
    var pState = { cats: [], search: [], page: 1 };

    function pMatches(card){
      if (pState.cats.length && pState.cats.indexOf(card.getAttribute('data-cat')) === -1) return false;
      if (pState.search.length) {
        var title = card.getAttribute('data-title') || '';
        for (var w = 0; w < pState.search.length; w++) {
          if (title.indexOf(pState.search[w]) === -1) return false;
        }
      }
      return true;
    }
    function pRender(){
      var filtered = allPicks.filter(pMatches);
      var shown = Math.min(filtered.length, pState.page * PICKS_PAGE_SIZE);
      var visible = new Set(filtered.slice(0, shown));
      allPicks.forEach(function(c){ c.style.display = visible.has(c) ? '' : 'none'; });
      if (picksEmpty) picksEmpty.style.display = filtered.length ? 'none' : '';
      var remaining = filtered.length - shown;
      if (picksPager) picksPager.style.display = filtered.length ? 'flex' : 'none';
      if (picksLoadMore) {
        picksLoadMore.style.display = remaining > 0 ? '' : 'none';
        picksLoadMore.textContent = 'Load ' + Math.min(PICKS_PAGE_SIZE, remaining) + ' more';
      }
      if (picksPagerStatus) {
        picksPagerStatus.textContent = filtered.length
          ? ('Showing ' + shown + ' of ' + filtered.length)
          : '';
      }
    }
    if (picksLoadMore) picksLoadMore.addEventListener('click', function(){
      pState.page++;
      pRender();
    });
    if (picksCatBtn && picksCatPanel) {
      picksCatBtn.addEventListener('click', function(e){
        e.stopPropagation();
        var was = picksCatPanel.classList.contains('open');
        closeAll();
        if (!was) picksCatPanel.classList.add('open');
      });
      picksCatPanel.addEventListener('click', function(e){ e.stopPropagation(); });
      var picksApplyBtn = document.getElementById('picksCatApply');
      var picksClearBtn = document.getElementById('picksCatClear');
      if (picksApplyBtn) picksApplyBtn.addEventListener('click', function(){
        var vals = [];
        Array.prototype.forEach.call(picksCatPanel.querySelectorAll('input[type=checkbox]:checked'), function(b){
          vals.push(b.value);
        });
        pState.cats = vals;
        pState.page = 1;
        picksCatBtn.textContent = vals.length ? ('Category (' + vals.length + ') ▾') : 'Category ▾';
        picksCatPanel.classList.remove('open');
        pRender();
      });
      if (picksClearBtn) picksClearBtn.addEventListener('click', function(){
        Array.prototype.forEach.call(picksCatPanel.querySelectorAll('input[type=checkbox]'), function(b){
          b.checked = false;
        });
      });
    }
    // Same #dealSearch/#searchSuggest ids the deal-grid pages use (see
    // _picks_hero_search_html in html_output.py) -- harmless to share since
    // the deal-grid block below bails out early on this page (no .grid), so
    // only this wiring ever touches them here.
    var picksSearchEl = document.getElementById('dealSearch');
    attachSearchSuggest(
      picksSearchEl,
      document.getElementById('searchSuggest'),
      function(){ return allPicks; },
      function(text){
        pState.search = text.toLowerCase().split(/\s+/).filter(Boolean);
        pState.page = 1;
        pRender();
      }
    );
    // Landed here from a pick suggestion clicked on another page (see
    // choose() in attachSearchSuggest) -- ?q= carries the exact title, same
    // pattern as applyQueryParam() below for the deal grid.
    var picksQ = new URLSearchParams(location.search).get('q');
    if (picksQ && picksSearchEl) {
      picksSearchEl.value = picksQ;
      pState.search = picksQ.trim().toLowerCase().split(/\s+/).filter(Boolean);
    }
    pRender();
  })();

  if (!grid) return;
  var PAGE_SIZE = 40;

  var allCards = Array.prototype.filter.call(grid.children, function(el){
    return el.classList.contains('card');
  });
  var banner = grid.querySelector('.divider-banner');
  if (banner) banner.style.display = 'none';

  // ---- card markup, browser side ----
  // Mirrors _card() in html_output.py. Only the markup is duplicated: every
  // value it prints is computed once in Python by _card_fields() and carried
  // in deals.json, so the display *rules* live in one place. If you change
  // the card's structure or its data- attributes in _card(), change them
  // here too, because the grid ends up holding cards from both builders.
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  }
  function money(n){ return '$' + Number(n).toFixed(2); }

  function buildCard(d){
    var url = esc(d.url || '#');
    var title = esc(d.title);
    var thumb = d.image_url
      ? "<a class='thumb' href='" + url + "' target='_blank' rel='noopener sponsored' tabindex='-1' aria-hidden='true'>"
        + '<img src="' + esc(d.image_url) + '" alt="' + esc(String(d.title).slice(0,100)) + '"'
        + ' loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>'
      : "<span class='thumb noimg'>No image</span>";
    var pills = '';
    if (d.is_new) pills += "<span class='newpill'>New</span>";
    // (pills intentionally minimal here -- see _card() in the generator)
    var menu =
      "<div class='over-menu' data-url='" + url + "' data-title='" + title + "'>"
      + "<button type='button' class='dots' aria-haspopup='true' aria-expanded='false'"
      + " aria-label='More options for " + title + "'>&#8942;</button>"
      + "<div class='dropdown'>"
      + "<button type='button' class='menu-open'>Open in New Tab</button>"
      + "<a class='menu-report' href='/contact.html'>Report an Error</a>"
      + "<div class='has-sub'>"
      + "<button type='button' class='menu-share-lbl' aria-expanded='false'>&#9666; Share</button>"
      + "<div class='subdrop'>"
      + "<button type='button' class='sh' data-net='copy'>Copy Link</button>"
      + "<button type='button' class='sh' data-net='email'>Email</button>"
      + "<button type='button' class='sh' data-net='facebook'>Facebook</button>"
      + "<button type='button' class='sh' data-net='twitter'>Twitter / X</button>"
      + "<button type='button' class='sh' data-net='pinterest'>Pinterest</button>"
      + '</div></div></div></div>';

    var el = document.createElement('div');
    el.className = 'card ' + (d.is_new ? 'v' : 'z');
    el.id = d.id;
    el.setAttribute('data-cat', d.category || '');
    el.setAttribute('data-subcat', d.subcategory || '');
    el.setAttribute('data-title', String(d.title).toLowerCase());
    el.setAttribute('data-title-display', String(d.title));
    el.setAttribute('data-price', d.price);
    el.setAttribute('data-discount', d.discount_pct);
    el.setAttribute('data-age', d.age_minutes);
    el.setAttribute('data-first-seen-min', d.first_seen_minutes);
    el.innerHTML = thumb
      + "<div class='body'>" + menu
      + "<h3 class='clamp2'><a href='" + url + "' target='_blank' rel='noopener sponsored'>" + title + '</a></h3>'
      + "<div class='prices'><span class='price-now'>" + money(d.price) + '</span>'
      + "<span class='price-was'>" + money(d.original_price) + '</span>'
      + "<span class='pct-pill'>" + Math.round(d.discount_pct) + '% off</span></div>'
      + "<div class='meta'><span class='src-tag'>" + esc(d.source_label) + '</span>'
      + '<span>Seen ' + esc(d.seen_text) + '</span>' + pills + '</div>'
      + "<a class='cta' href='" + url + "' target='_blank' rel='noopener sponsored'>Buy on " + esc(d.source_label) + '</a>'
      + '</div>';
    return el;
  }

  var searchEl = document.getElementById('dealSearch');
  var sortEl = document.getElementById('dealSort');
  var pagerEl = document.getElementById('pager');
  var loadMoreBtn = document.getElementById('loadMore');
  var pagerStatus = document.getElementById('pagerStatus');
  var emptyEl = document.getElementById('filterEmpty');
  var catBtn = document.getElementById('catFilterBtn');
  var catPanel = document.getElementById('catFilterPanel');

  var state = { search: [], cats: [], page: 1, sort: 'default' };

  // `missing` decides which end an unparseable attribute lands on. It used to
  // always be -Infinity, which is right for a descending sort (unknown goes
  // last) and exactly wrong for an ascending one: a card with no data-price
  // sorted to the very top of "Price: low to high" as if it were free.
  function num(card, attr, missing){
    var n = parseFloat(card.getAttribute(attr));
    return isNaN(n) ? (missing === undefined ? -Infinity : missing) : n;
  }
  function matches(card){
    if (state.cats.length) {
      var cat = card.getAttribute('data-cat');
      var sub = card.getAttribute('data-subcat');
      var hit = false;
      for (var i = 0; i < state.cats.length; i++) {
        var v = state.cats[i];
        if (v === cat || (sub && v === cat + ':' + sub)) { hit = true; break; }
      }
      if (!hit) return false;
    }
    if (state.search.length) {
      var title = card.getAttribute('data-title');
      for (var w = 0; w < state.search.length; w++) {
        if (title.indexOf(state.search[w]) === -1) return false;
      }
    }
    return true;
  }
  function sortCompare(a, b){
    if (state.sort === 'name-asc') return a.getAttribute('data-title').localeCompare(b.getAttribute('data-title'));
    if (state.sort === 'name-desc') return b.getAttribute('data-title').localeCompare(a.getAttribute('data-title'));
    if (state.sort === 'price-asc') return num(a, 'data-price', Infinity) - num(b, 'data-price', Infinity);
    if (state.sort === 'price-desc') return num(b, 'data-price') - num(a, 'data-price');
    // data-age is minutes since LAST seen, which gets refreshed every run a
    // deal is merely re-confirmed still active -- so it reads ~0 for nearly
    // the whole catalogue every hour and can't tell new from long-since-found.
    // data-first-seen-min is minutes since it was truly first discovered;
    // ascending = newest first, and an unknown value belongs at the bottom
    // (Infinity), not billed as the freshest.
    if (state.sort === 'newest') return num(a, 'data-first-seen-min', Infinity) - num(b, 'data-first-seen-min', Infinity);
    return num(b, 'data-discount') - num(a, 'data-discount');
  }

  function render(){
    var filtered = allCards.filter(matches);

    if (state.sort !== 'default') {
      filtered = filtered.slice().sort(sortCompare);
      filtered.forEach(function(c){ grid.appendChild(c); });
    }

    // Cumulative, not paged: state.page counts how many batches are revealed,
    // so loading more appends below what you were already reading instead of
    // swapping the page under you and throwing you back to the top.
    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var shown = Math.min(filtered.length, state.page * PAGE_SIZE);
    var visibleSet = new Set(filtered.slice(0, shown));

    allCards.forEach(function(c){ c.style.display = visibleSet.has(c) ? '' : 'none'; });

    if (emptyEl) emptyEl.style.display = filtered.length ? 'none' : '';
    var remaining = filtered.length - shown;
    if (pagerEl) pagerEl.style.display = remaining > 0 ? 'flex' : 'none';
    if (pagerStatus) {
      pagerStatus.textContent = filtered.length
        ? ('Showing ' + shown + ' of ' + filtered.length)
        : '';
    }
    if (loadMoreBtn) {
      loadMoreBtn.textContent = remaining > 0
        ? ('Load ' + Math.min(PAGE_SIZE, remaining) + ' more')
        : 'Load more';
    }
  }

  function applyCats(vals){
    state.cats = vals;
    state.page = 1;
    if (catPanel) {
      Array.prototype.forEach.call(catPanel.querySelectorAll('input[type=checkbox]'), function(b){
        b.checked = vals.indexOf(b.value) !== -1;
      });
    }
    if (catBtn) {
      catBtn.textContent = vals.length ? ('Category (' + vals.length + ') ▾') : 'Category ▾';
    }
    render();
  }

  attachSearchSuggest(
    searchEl,
    document.getElementById('searchSuggest'),
    function(){ return allCards; },
    function(text){
      state.search = text.toLowerCase().split(/\s+/).filter(Boolean);
      state.page = 1;
      render();
    },
    true
  );

  if (sortEl) {
    sortEl.addEventListener('change', function(){
      state.sort = sortEl.value;
      state.page = 1;
      render();
    });
  }

  // ---- category filter dropdown (checkbox panel + Apply) ----
  if (catBtn && catPanel) {
    catBtn.addEventListener('click', function(e){
      e.stopPropagation();
      var was = catPanel.classList.contains('open');
      closeAll();
      if (!was) {
        Array.prototype.forEach.call(catPanel.querySelectorAll('input[type=checkbox]'), function(b){
          b.checked = state.cats.indexOf(b.value) !== -1;
        });
        catPanel.classList.add('open');
      }
    });
    catPanel.addEventListener('click', function(e){ e.stopPropagation(); });
    // Subcategory rows are collapsed behind a caret on their parent. Delegated
    // so it survives the panel being rebuilt, and opened automatically when a
    // subcategory inside is already part of the active filter -- otherwise
    // reopening the panel shows the parent unchecked with its checked child
    // hidden, which reads as the filter having been lost.
    catPanel.addEventListener('click', function(e){
      var caret = e.target.closest ? e.target.closest('.catfilter-caret') : null;
      if (!caret) return;
      var subs = caret.parentNode.nextElementSibling;
      if (!subs || subs.className.indexOf('catfilter-subs') === -1) return;
      var open = subs.classList.toggle('open');
      caret.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    catBtn.addEventListener('click', function(){
      Array.prototype.forEach.call(catPanel.querySelectorAll('.catfilter-subs'), function(subs){
        if (!subs.querySelector('input:checked')) return;
        subs.classList.add('open');
        var caret = subs.previousElementSibling &&
                    subs.previousElementSibling.querySelector('.catfilter-caret');
        if (caret) caret.setAttribute('aria-expanded', 'true');
      });
    });
    var applyBtn = document.getElementById('catApply');
    var clearBtn = document.getElementById('catClear');
    if (applyBtn) applyBtn.addEventListener('click', function(){
      var vals = [];
      Array.prototype.forEach.call(catPanel.querySelectorAll('input[type=checkbox]:checked'), function(b){
        vals.push(b.value);
      });
      applyCats(vals);
      catPanel.classList.remove('open');
    });
    if (clearBtn) clearBtn.addEventListener('click', function(){
      Array.prototype.forEach.call(catPanel.querySelectorAll('input[type=checkbox]'), function(b){
        b.checked = false;
      });
    });
  }

  // No scroll jump: the newly revealed cards start exactly where the button
  // was, so the reader carries on from the same spot.
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', function(){
    state.page++;
    render();
  });


  // ---- deep-link: #d-<id> (or ?deal=d-<id>) from social posts must survive
  // pagination. The ?deal= form exists because Instagram/TikTok/Facebook
  // caption text parses a bare "#" as the start of a hashtag and visibly
  // breaks the link (confirmed live 2026-08-11: "halfornothing.com/#d-ebay-
  // id-..." rendered with "#d" as a blue hashtag, garbling the rest) --
  // ?deal= has no "#" for the caption parser to trip on, same target either
  // way since both just resolve to the card's DOM id.
  // A ?deal= link that resolves to nothing used to fail silently: the visitor
  // landed on an ordinary front page with no hint that the thing they clicked
  // for was gone, and no way to tell that from "the site is broken". These
  // links live in social posts and outlive the listings they point at, so the
  // miss case is normal traffic, not an edge case, and it needs an answer.
  function wantedDeal(){
    return !!(new URLSearchParams(location.search).get('deal')
              || (location.hash && location.hash.length > 1));
  }

  function dealGoneNotice(){
    if (document.getElementById('dealGone')) return;
    var box = document.createElement('div');
    box.id = 'dealGone';
    box.className = 'deal-gone';
    box.innerHTML = "<b>That deal has ended.</b> The listing you followed sold out or "
      + "was taken down at the retailer. Everything below is live right now, "
      + "at 50% off or better.";
    var main = document.querySelector('main.wrap');
    if (main) main.insertBefore(box, main.firstChild);
  }

  function gotoDeepLink(){
    var dealParam = new URLSearchParams(location.search).get('deal');
    if (!dealParam && !(location.hash && location.hash.length > 1)) return false;
    var targetId = dealParam || location.hash.slice(1);
    var targetCard = document.getElementById(targetId);
    if (!targetCard || !targetCard.classList.contains('card')) return false;
    var filteredNow = allCards.filter(matches);
    var idx = filteredNow.indexOf(targetCard);
    if (idx === -1 && state.cats.length) {
      state.cats = [];
      filteredNow = allCards.filter(matches);
      idx = filteredNow.indexOf(targetCard);
    }
    if (idx === -1) return false;
    state.page = Math.floor(idx / PAGE_SIZE) + 1;
    render();
    targetCard.classList.add('linked');
    // Re-tag just this card's outbound links as social traffic. Only this
    // card, not the whole grid: the visitor followed a post to this specific
    // deal, so this is the click whose commission answers "does posting
    // actually sell anything". Retagging all 13,000 links would both cost a
    // long main-thread pass and blur the answer, since anything else they
    // browse to afterwards is ordinary on-site discovery.
    Array.prototype.forEach.call(targetCard.querySelectorAll('a[href*="campid="]'), function(a){
      a.href = a.href.replace(/([?&]customid=)[^&]*/, '$1' + SOCIAL_CUSTOM_ID);
    });
    var m = targetCard.querySelector('.over-menu');
    if (m) {
      m.setAttribute('data-url',
        (m.getAttribute('data-url') || '').replace(/([?&]customid=)[^&]*/, '$1' + SOCIAL_CUSTOM_ID));
    }
    setTimeout(function(){
      targetCard.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 50);
    return true;
  }

  // Pages with no grid of their own (About, Contact, Discount Index, /d/
  // deal pages, ...) carry a plain GET-form search box that submits here as
  // ?q=<value> -- see _redirect_search_html in html_output.py. No JS was
  // needed to send it; this is the JS needed to receive it.
  function applyQueryParam(){
    var q = new URLSearchParams(location.search).get('q');
    if (!q || !searchEl) return false;
    searchEl.value = q;
    state.search = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return true;
  }

  var deepLinked = gotoDeepLink();
  if (!deepLinked) {
    applyQueryParam();
    render();
  }

  // ---- the rest of the catalogue, from deals.json ----
  // The document carries only the first screenful of cards; everything below
  // that is built here. Deliberately after the first render, so the page is
  // interactive with what it already has before the fetch resolves, and so a
  // failed or blocked fetch degrades to "the first 60 deals work" rather
  // than to an empty page.
  var feedUrl = grid.getAttribute('data-feed');
  // No feed to wait for (the local view), so a miss is already conclusive.
  if ((!feedUrl || !window.fetch) && !deepLinked && wantedDeal()) dealGoneNotice();
  if (feedUrl && window.fetch) {
    var wantCat = grid.getAttribute('data-feed-cat');
    var wantSub = grid.getAttribute('data-feed-subcat');
    fetch(feedUrl, {cache: 'no-cache'})
      .then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function(feed){
        // Match against ids already in the document rather than assuming the
        // document holds exactly the feed's first N: the two are built from
        // the same ordered list, but keying on identity means a change to
        // FIRST_PAINT_CARDS, or any ordering difference, can't duplicate or
        // skip a card.
        var have = {};
        allCards.forEach(function(c){ have[c.id] = true; });

        var frag = document.createDocumentFragment();
        var added = 0;
        (feed.deals || []).forEach(function(d){
          if (have[d.id]) return;
          if (wantCat && d.category !== wantCat) return;
          if (wantSub && d.subcategory !== wantSub) return;
          frag.appendChild(buildCard(d));
          added++;
        });
        if (!added) return;
        grid.appendChild(frag);

        allCards = Array.prototype.filter.call(grid.children, function(el){
          return el.classList.contains('card');
        });
        // A deep link may point at a card that only just arrived, so try it
        // again now that the full set is present.
        if (!deepLinked) { deepLinked = gotoDeepLink(); }
        if (!deepLinked) {
          render();
          // Only now, with the whole catalogue loaded, is a miss really a
          // miss. Saying so before the fetch resolved would cry wolf at
          // every deep link to a card that simply hadn't arrived yet.
          if (wantedDeal()) dealGoneNotice();
        }
      })
      .catch(function(){
        // Silent by design: the page is already usable. Surfacing a fetch
        // error here would be a broken-looking site over a working one.
      });
  }
})();

// The ghost mark used to be positioned here, measured against the nav's
// "Deals" link on load and resize. It now sits at the content column's right
// edge instead (Che, 2026-08-13), which .mast-ghost expresses in CSS off
// .wrap's own max-width -- no measuring, and no flash of fallback position
// before the script runs.

// ---- hero search: rotating "Search for <term>" hint ----
// A layered span rather than the placeholder attribute, so the lead-in stays
// put while only the term swaps. Hides the moment anything is typed, and holds
// still for anyone who asked for reduced motion.
(function(){
  var input = document.getElementById('dealSearch');
  var hint = document.getElementById('searchHint');
  var word = document.getElementById('searchHintWord');
  if (!input || !hint || !word) return;

  var terms;
  try { terms = JSON.parse(input.getAttribute('data-hints') || '[]'); }
  catch (e) { terms = []; }
  if (!terms.length) { hint.classList.add('gone'); return; }

  function sync(){ hint.classList.toggle('gone', !!input.value); }
  input.addEventListener('input', sync);
  sync();

  word.textContent = terms[0];
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var i = 0;
  setInterval(function(){
    if (input.value || document.hidden) return;
    i = (i + 1) % terms.length;
    word.style.opacity = '0';
    setTimeout(function(){ word.textContent = terms[i]; word.style.opacity = ''; }, 180);
  }, 2600);
  word.style.transition = 'opacity .18s ease';
})();

// ---- scroll rail: arrow buttons + edge-aware disabling, shared by Today's
// Top Deals and Amazon Picks ----
// The viewport is a real scroll container, so the arrows only nudge it; swipe,
// trackpad and keyboard scrolling already work without any of this. Arrows
// fade out at each end rather than sitting there dead.
function initRail(viewportId, prevId, nextId, cardSelector, cardGap){
  var vp = document.getElementById(viewportId);
  var prev = document.getElementById(prevId);
  var next = document.getElementById(nextId);
  if (!vp || !prev || !next) return;

  function step(){
    var card = vp.querySelector(cardSelector);
    var w = card ? card.getBoundingClientRect().width + cardGap : 232;
    return Math.max(w, Math.floor(vp.clientWidth / w) * w);
  }
  function sync(){
    var max = vp.scrollWidth - vp.clientWidth;
    prev.disabled = vp.scrollLeft <= 2;
    next.disabled = vp.scrollLeft >= max - 2;
  }
  prev.addEventListener('click', function(){ vp.scrollBy({left: -step(), behavior:'smooth'}); });
  next.addEventListener('click', function(){ vp.scrollBy({left: step(), behavior:'smooth'}); });
  vp.addEventListener('scroll', function(){
    window.requestAnimationFrame(sync);
  }, {passive:true});
  window.addEventListener('resize', sync);
  sync();
}
initRail('tdViewport', 'tdPrev', 'tdNext', '.td-card', 14);
initRail('pkViewport', 'pkPrev', 'pkNext', '.pick', 14);
initRail('lassoViewport', 'lassoPrev', 'lassoNext', '.pick-lasso', 14);

(function(){
  var btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', function(){
    btn.classList.toggle('show', window.scrollY > 600);
  }, {passive:true});
  btn.addEventListener('click', function(){
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
})();

(function(){
  var el = document.getElementById('lastUpdated');
  if (!el) return;
  var updatedAt = new Date(el.getAttribute('data-updated'));
  function relative(){
    var mins = Math.round((Date.now() - updatedAt.getTime()) / 60000);
    var text;
    if (mins < 1) text = 'Just now';
    else if (mins === 1) text = '1 min ago';
    else if (mins < 60) text = mins + ' min ago';
    else {
      var hrs = Math.round(mins / 60);
      text = hrs === 1 ? '1 hour ago' : hrs + ' hours ago';
    }
    el.textContent = text;
  }
  relative();
  setInterval(relative, 30000);
})();
