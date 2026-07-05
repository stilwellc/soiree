/* ============================================================
   soirée — the concierge ledger (app)
   Consumes window.TruthPass.verify(rawEvents, now) only.
   All scraped strings pass through esc() before innerHTML.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- constants & helpers ---------------- */
  var PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>" +
    "<rect width='400' height='300' fill='#241a11'/>" +
    "<rect x='14' y='14' width='372' height='272' fill='none' stroke='#c9a96a' stroke-opacity='.35' stroke-width='1'/>" +
    "<text x='200' y='176' font-family='Georgia,serif' font-style='italic' font-size='96' fill='#c9a96a' fill-opacity='.8' text-anchor='middle'>s</text>" +
    "<text x='200' y='232' font-family='Georgia,serif' font-style='italic' font-size='15' fill='#8d7c63' text-anchor='middle'>photograph to follow</text>" +
    "</svg>").replace(/'/g, '%27');

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAY_MS = 86400000;

  var NOW = new Date();
  var TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  var TODAY_KEY = TODAY.getFullYear() + '-' + String(TODAY.getMonth() + 1).padStart(2, '0') + '-' + String(TODAY.getDate()).padStart(2, '0');

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dayDiff(d) { return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - TODAY) / DAY_MS); }
  function fmtShort(d) {
    var s = MONTHS[d.getMonth()].toUpperCase() + ' ' + d.getDate();
    if (d.getFullYear() !== TODAY.getFullYear()) s += ' ’' + String(d.getFullYear()).slice(2);
    return s;
  }
  function fmtLong(d) {
    var s = DAYS[d.getDay()] + ', ' + MONTHS_FULL[d.getMonth()] + ' ' + d.getDate();
    if (d.getFullYear() !== TODAY.getFullYear()) s += ', ' + d.getFullYear();
    return s;
  }
  function localDate(iso) { if (!iso) return null; var p = String(iso).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function reduceMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------------- NOAA solar almanac (NYC 40.71 / -74.01) ---------------- */
  function sunEvent(date, zenith) {
    var lat = 40.71, lng = -74.01, rad = Math.PI / 180;
    var n = Math.round((date - new Date(date.getFullYear(), 0, 0)) / DAY_MS);
    var lngHour = lng / 15;
    var t = n + ((18 - lngHour) / 24);                               /* evening events */
    var M = (0.9856 * t) - 3.289;
    var L = M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634;
    L = ((L % 360) + 360) % 360;
    var RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = ((RA % 360) + 360) % 360;
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    var sinDec = 0.39782 * Math.sin(L * rad);
    var cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (Math.cos(zenith * rad) - (sinDec * Math.sin(lat * rad))) / (cosDec * Math.cos(lat * rad));
    if (cosH < -1 || cosH > 1) return null;
    var H = (Math.acos(cosH) / rad) / 15;
    var T = H + RA - (0.06571 * t) - 6.622;
    var UT = (((T - lngHour) % 24) + 24) % 24;
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) + UT * 3600000);
  }
  function fmtSun(d) {
    if (!d) return '—';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  }
  function renderAlmanac() {
    var dayOfYear = Math.round((TODAY - new Date(TODAY.getFullYear(), 0, 0)) / DAY_MS);
    var golden = sunEvent(TODAY, 84);      /* sun 6° above horizon */
    var sunset = sunEvent(TODAY, 90.833);  /* official sunset */
    var last = sunEvent(TODAY, 96);        /* civil dusk — last light */
    var dot = '<span class="dot">·</span>';
    /* each segment is a nowrap span so line breaks land on the dots,
       never inside a label ("LAST / LIGHT") */
    var seg = function (s) { return '<span class="alm-seg">' + s + '</span>'; };
    $('almanac').innerHTML =
      seg('Vol. I') + ' ' + dot + seg('No. ' + dayOfYear) + ' ' + dot +
      seg('<b>' + esc(DAYS[TODAY.getDay()] + ', ' + MONTHS_FULL[TODAY.getMonth()] + ' ' + TODAY.getDate() + ', ' + TODAY.getFullYear()) + '</b>') + '<br>' +
      seg('Golden hour ' + esc(fmtSun(golden))) + ' ' + dot +
      seg('Sunset ' + esc(fmtSun(sunset))) + ' ' + dot +
      seg('Last light ' + esc(fmtSun(last)));
  }

  /* ---------------- state ---------------- */
  var RAW = [];
  var R = null;              /* TruthPass.verify result */
  var byId = {};
  var artOk = {};            /* id -> image load succeeded */
  var region = 'both';
  try { region = localStorage.getItem('soiree.region') || 'both'; } catch (e) { }
  if (['both', 'nyc', 'hoboken-jc'].indexOf(region) < 0) region = 'both';

  var plan = {};
  try {
    /* purge stale per-date cards, then load today's */
    Object.keys(localStorage).forEach(function (k) {
      if (/^soiree\.card\./.test(k) && k !== 'soiree.card.' + TODAY_KEY) localStorage.removeItem(k);
    });
    plan = JSON.parse(localStorage.getItem('soiree.card.' + TODAY_KEY) || '{}');
  } catch (e) { plan = {}; }
  function savePlan() { try { localStorage.setItem('soiree.card.' + TODAY_KEY, JSON.stringify(plan)); } catch (e) { } }

  /* ---------------- region ---------------- */
  function regionOf(raw) {
    return /hoboken|jersey city/i.test(String(raw.location || '')) ? 'hoboken-jc' : 'nyc';
  }
  function wireRegister() {
    var reg = $('register');
    reg.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-region]');
      if (!b) return;
      region = b.getAttribute('data-region');
      try { localStorage.setItem('soiree.region', region); } catch (e) { }
      reg.querySelectorAll('[data-region]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      var sel = $('dispatchRegion');
      if (sel && region !== 'both') sel.value = region;
      runPipeline();
    });
    reg.querySelectorAll('[data-region]').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.getAttribute('data-region') === region));
    });
  }

  /* ---------------- pipeline ---------------- */
  function runPipeline() {
    var filtered = region === 'both' ? RAW : RAW.filter(function (e) { return regionOf(e) === region; });
    R = window.TruthPass.verify(filtered, new Date());
    byId = {};
    R.events.forEach(function (e) { byId[e.id] = e; });
    /* purge card picks that expired or vanished from the verified set */
    var dirty = false;
    Object.keys(plan).forEach(function (id) { if (!byId[id]) { delete plan[id]; dirty = true; } });
    if (dirty) savePlan();
    preloadTonightArt().then(function () { render(); });
    refreshSeal();
  }

  function preloadTonightArt() {
    var list = R.shelves.tonight.concat(R.shelves.earlierToday).filter(function (e) { return e.image && artOk[e.id] === undefined; });
    if (!list.length) return Promise.resolve();
    return Promise.all(list.map(function (e) {
      return new Promise(function (res) {
        var img = new Image();
        /* some venues (AMNH) 403 hotlinked requests that carry a referrer */
        img.referrerPolicy = 'no-referrer';
        var done = function (ok) { return function () { artOk[e.id] = ok; res(); }; };
        var timer = setTimeout(done(false), 2200);
        img.onload = function () { clearTimeout(timer); done(true)(); };
        img.onerror = function () { clearTimeout(timer); done(false)(); };
        img.src = e.image;
      });
    }));
  }

  /* ---------------- row rendering ---------------- */
  function isOnView(e) { return e.event_type === 'exhibition' || R.shelves.onView.indexOf(e) >= 0; }

  /* address hygiene for display: collapse whitespace, strip "(map)" */
  function cleanAddr(e) {
    return String(e.address || '').replace(/\(map\)/gi, '').replace(/\s+/g, ' ').trim();
  }

  /* venue line: gallery/venue name when we have one, else street · neighborhood */
  function whereLine(e) {
    if (e.where) return e.where;
    var street = cleanAddr(e).split(',')[0].trim();
    var loc = String(e.location || '').replace(/\s+/g, ' ').trim();
    var isCity = /^(new york( city)?|nyc|hoboken|jersey city)$/i.test(loc);
    if (loc && !isCity) return loc + (street && street.toLowerCase() !== loc.toLowerCase() && !/new york|nyc/i.test(street) ? ' · ' + street : '');
    var hood = e.neighborhood || (isCity ? loc : 'New York');
    if (street && street.toLowerCase() !== hood.toLowerCase() && street.toLowerCase() !== 'nyc') return street + ' · ' + hood;
    return hood;
  }

  /* start minutes: from the module when present, else parsed off displayTime */
  function minutesOf(e) {
    if (e.startMin != null) return e.startMin;
    var m = String(e.displayTime || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    var h = +m[1] % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + (+m[2]);
  }

  function timeCellHtml(e, mode) {
    if (mode === 'onview') {
      var dt = String(e.dateChip || e.displayTime || '');
      var m = dt.match(/^(THRU|OPENS)\s+(.+)$/i);
      if (m) return '<div class="tcell"><span class="tl">' + esc(m[1]) + '</span><span class="td">' + esc(m[2]) + '</span></div>';
      return '<div class="tcell"><span class="td">' + esc(dt) + '</span></div>';
    }
    if (mode === 'horizon') {
      var d = e.startAt || localDate(e.start_date);
      return '<div class="tcell"><span class="tl">' + DAYS[d.getDay()].slice(0, 3) + '</span><span class="td">' + esc(fmtShort(d)) + '</span></div>';
    }
    var t = String(e.displayTime || 'TBA');
    var tm = t.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
    if (tm) return '<div class="tcell"><span class="tv">' + tm[1] + '</span><span class="tm">' + tm[2].toUpperCase() + '</span></div>';
    return '<div class="tcell tba" aria-label="Time to be announced"><span class="tv">TBA</span></div>';
  }

  function chipsHtml(e, mode) {
    var c = '';
    if (e.isFree) c += ' <span class="chip free">Free</span>';
    if (e.soldOut) c += ' <span class="chip wine">Sold out</span>';
    if (e.earlierToday) c += ' <span class="chip earlier">Earlier today</span>';
    if (mode === 'onview' && e.endAt && !(/OPENS/i.test(e.dateChip || '')) && dayDiff(e.endAt) <= 14) {
      c += ' <span class="chip closing">Final days</span>';
    }
    return c;
  }

  function rowHtml(e, mode) {
    var end = localDate(e.end_date), start = localDate(e.start_date);
    var multi = (!isOnView(e) && end && start && end > start && dayDiff(end) > 0)
      ? '<span class="sep">·</span><span> through ' + esc(fmtShort(end)) + '</span>' : '';
    /* poster promotion needs strong art AND a real parsed time — TBA/artless
       events stay as rows (brief §2.4) */
    var poster = (mode === 'tonight' && !e.earlierToday && artOk[e.id] && minutesOf(e) != null) ? ' poster' : '';
    return '<article class="row' + (e.earlierToday ? ' past-today' : '') + poster + '" role="button" tabindex="0" data-id="' + esc(String(e.id)) + '" aria-label="' + esc(e.cleanName) + '">' +
      timeCellHtml(e, mode) +
      '<div class="thumb"><img loading="lazy" referrerpolicy="no-referrer" src="' + esc(e.image || PLACEHOLDER) + '" alt="" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'"></div>' +
      '<div class="rbody"><h3 class="rname">' + esc(e.cleanName) + '</h3>' +
      '<p class="rmeta"><span>' + esc(whereLine(e)) + '</span>' + multi + chipsHtml(e, mode) + '</p></div>' +
      sealBtnHtml(e.id) +
      '</article>';
  }

  function sealBtnHtml(id) {
    var inPlan = !!plan[id];
    return '<button class="addbtn' + (inPlan ? ' inplan' : '') + '" data-add="' + esc(String(id)) + '" aria-pressed="' + inPlan + '" aria-label="' + (inPlan ? 'Remove from' : 'Note on') + ' your evening card">' +
      (inPlan
        ? '<svg viewBox="0 0 13 13" aria-hidden="true"><path d="M2 7l3 3 6-8"/></svg>'
        : '<svg viewBox="0 0 13 13" aria-hidden="true"><path d="M6.5 1v11M1 6.5h11"/></svg>') +
      '</button>';
  }

  function shelfHtml(id, title, sub, count, inner) {
    return '<section class="shelf" id="' + id + '" data-shelf aria-label="' + esc(title) + '">' +
      '<div class="shelf-head"><h2>' + esc(title) + '</h2><div class="rule"></div><span class="count">' + count + (count === 1 ? ' occasion' : ' occasions') + '</span></div>' +
      (sub ? '<p class="shelf-sub">' + esc(sub) + '</p>' : '') +
      '<div class="rows">' + inner + '</div></section>';
  }

  /* ---------------- editorial lead ---------------- */
  function pickLead() {
    var nowMin = NOW.getHours() * 60 + NOW.getMinutes();
    var q = R.shelves.tonight.filter(function (e) {
      var m = minutesOf(e);
      return m != null && m >= 17 * 60 && m > nowMin && artOk[e.id];
    });
    if (!q.length) return null;
    q.sort(function (a, b) { return (minutesOf(a) - minutesOf(b)) || ((b.isFree ? 1 : 0) - (a.isFree ? 1 : 0)); });
    return q[0];
  }

  function leadHtml(e) {
    return '<article class="lead" data-lead="' + esc(String(e.id)) + '">' +
      '<div class="lead-photo"><img referrerpolicy="no-referrer" src="' + esc(e.image) + '" alt="" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'"></div>' +
      '<div class="lead-body">' +
      '<p class="lead-k">Tonight’s lead</p>' +
      '<h3 class="lead-name" role="button" tabindex="0" data-detail="' + esc(String(e.id)) + '">' + esc(e.cleanName) + '</h3>' +
      '<p class="lead-meta"><span>' + esc(e.displayTime) + '</span><span class="sep">·</span><span>' + esc(whereLine(e)) + '</span>' + chipsHtml(e, 'tonight') + '</p>' +
      '<div class="lead-actions">' +
      '<button class="btn solid" data-detail="' + esc(String(e.id)) + '">Details</button>' +
      '<a class="btn" href="' + esc(e.mapsUrl) + '" target="_blank" rel="noopener">Directions</a>' +
      '</div></div></article>';
  }

  /* ---------------- dated copy (derived-only, defaults to nothing) ---------------- */
  var DATED_COPY = {
    '07-05': 'The Fourth has burned off and the city exhales.',
    '01-01': 'The year is an hour old; the city sleeps it off.',
    '12-31': 'The last page of the year — write it well.'
  };

  /* ---------------- render ---------------- */
  function render() {
    var L = $('ledger');
    var s = R.shelves, c = R.counts;
    var html = '';

    /* --- tonight --- */
    var lead = pickLead();
    var tonightRows = s.tonight.filter(function (e) { return !lead || e.id !== lead.id; });
    var inner = (lead ? leadHtml(lead) : '') +
      tonightRows.map(function (e) { return rowHtml(e, 'tonight'); }).join('') +
      s.earlierToday.map(function (e) { return rowHtml(e, 'tonight'); }).join('');
    if (c.tonight === 0) {
      inner = '<div class="note"><p class="n-k">From the concierge</p><p>Nothing on the books tonight — it happens to the best of cities. May we suggest ' +
        (c.tomorrow ? '<a href="#tomorrow">tomorrow</a>' : '<a href="#week">the week ahead</a>') +
        (c.onView ? ', or a gallery <a href="#onview">still on view</a>.' : '.') + '</p></div>' + inner;
    } else if (c.tonight <= 2) {
      inner += '<div class="note"><p class="n-k">From the concierge</p><p>A quiet ' + DAYS[TODAY.getDay()] + ' — the city catches its breath. ' +
        (c.tomorrow ? 'Tomorrow the ledger holds <a href="#tomorrow">' + c.tomorrow + ' occasion' + (c.tomorrow === 1 ? '' : 's') + '</a>' : 'The week ahead fills quickly') +
        (c.onView ? ', and <a href="#onview">' + c.onView + ' exhibition' + (c.onView === 1 ? '' : 's') + '</a> remain on view, no reservation required.' : '.') +
        '</p></div>';
    }
    html += shelfHtml('tonight', 'Tonight', fmtLong(TODAY), c.tonight, inner);

    /* --- tomorrow --- */
    if (c.tomorrow) {
      html += shelfHtml('tomorrow', 'Tomorrow', fmtLong(new Date(TODAY.getTime() + DAY_MS)), c.tomorrow,
        s.tomorrow.map(function (e) { return rowHtml(e, 'tomorrow'); }).join(''));
    }

    /* --- this week with day dividers --- */
    if (c.thisWeek) {
      var wk = '', lastDay = '';
      s.thisWeek.forEach(function (e) {
        var d = localDate(e.start_date);
        var dk = DAYS[d.getDay()].slice(0, 3).toUpperCase() + ' ' + fmtShort(d);
        if (dk !== lastDay) { wk += '<div class="daydiv"><span>' + esc(dk) + '</span><i></i></div>'; lastDay = dk; }
        wk += rowHtml(e, 'week');
      });
      html += shelfHtml('week', 'This Week', 'Through ' + fmtLong(new Date(TODAY.getTime() + 7 * DAY_MS)), c.thisWeek, wk);
    }

    /* --- horizon --- */
    if (c.horizon) {
      html += shelfHtml('horizon', 'On the Horizon', 'Worth marking the calendar', c.horizon,
        s.horizon.map(function (e) { return rowHtml(e, 'horizon'); }).join(''));
    }

    /* --- on view --- */
    if (c.onView) {
      html += shelfHtml('onview', 'On View', 'Exhibitions — walk in whenever', c.onView,
        s.onView.map(function (e) { return rowHtml(e, 'onview'); }).join(''));
    }

    L.innerHTML = html;

    /* --- rail --- */
    var navDefs = [
      ['tonight', 'Tonight', c.tonight],
      ['tomorrow', 'Tomorrow', c.tomorrow],
      ['week', 'This Week', c.thisWeek],
      ['horizon', 'Horizon', c.horizon],
      ['onview', 'On View', c.onView]
    ];
    $('shelfnavIn').innerHTML = navDefs
      .filter(function (n) { return n[2] > 0 || n[0] === 'tonight'; })
      .map(function (n) { return '<a href="#' + n[0] + '" data-nav="' + n[0] + '">' + n[1] + ' <b>' + n[2] + '</b></a>'; }).join('');

    /* --- greeting (same counts as rail & footer: R.counts) --- */
    var hr = NOW.getHours();
    var salute = hr < 12 ? 'Good morning.' : hr < 17 ? 'Good afternoon.' : 'Good evening.';
    var g = salute + ' ';
    g += c.tonight
      ? c.tonight + (c.tonight === 1 ? ' occasion holds' : ' occasions hold') + ' for tonight'
      : 'Tonight is quiet';
    var more = c.tomorrow + c.thisWeek;
    if (more) g += '; the week keeps ' + more + ' more';
    g += '.';
    var mmdd = String(TODAY.getMonth() + 1).padStart(2, '0') + '-' + String(TODAY.getDate()).padStart(2, '0');
    if (DATED_COPY[mmdd]) g += ' ' + DATED_COPY[mmdd];
    $('mastGreeting').textContent = g;

    /* --- colophon (same verified set) --- */
    $('colophonLine').innerHTML = '<b>' + R.events.length + ' events on the ledger, verified ' + esc(fmtLong(TODAY)) + '</b><br>— we print what we can verify, and nothing else —';
    $('colophonSources').textContent = R.sources.length ? 'Sourced from ' + R.sources.join(' · ') + '.' : '';
    var ab = $('aboutSources');
    if (ab) ab.textContent = R.sources.length ? R.sources.length + ' hand-checked feeds' : '—';

    observeShelves();
    var first = (lead || s.tonight[0] || s.tomorrow[0] || s.onView[0]);
    if (first) setWell(first);
  }

  /* ---------------- photo well (desktop) ---------------- */
  var wellFlip = false, wellCurrent = null;
  function setWell(e) {
    if (!e || e === wellCurrent || !window.matchMedia('(min-width:900px)').matches) return;
    wellCurrent = e;
    var incoming = $(wellFlip ? 'wellA' : 'wellB');
    var outgoing = $(wellFlip ? 'wellB' : 'wellA');
    wellFlip = !wellFlip;
    incoming.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    incoming.src = e.image || PLACEHOLDER;
    incoming.classList.add('show'); outgoing.classList.remove('show');
    var t = isOnView(e) ? (e.dateChip || e.displayTime || '') :
      ((dayDiff(e.startAt || localDate(e.start_date)) === 0 ? 'Tonight' : fmtShort(localDate(e.start_date))) +
        (e.displayTime && e.displayTime !== 'TBA' ? ' · ' + e.displayTime : ''));
    $('wellTime').textContent = t;
    $('wellName').textContent = e.cleanName;
    $('wellWhere').textContent = whereLine(e) + (e.isFree ? '  ·  free' : '');
  }

  /* ---------------- sheets: open/close, focus trap, drag ---------------- */
  var scrim = $('scrim');
  var openSheet = null;
  var lastFocus = null;

  function focusables(el) {
    return Array.prototype.filter.call(
      el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (n) { return n.offsetParent !== null && !n.disabled; });
  }
  function show(sheetEl, invoker) {
    if (openSheet) openSheet.classList.remove('open');
    openSheet = sheetEl;
    lastFocus = invoker || document.activeElement;
    sheetEl.classList.add('open');
    scrim.classList.add('open');
    document.body.style.overflow = 'hidden';
    sheetEl.scrollTop = 0;
    setTimeout(function () {
      if (openSheet !== sheetEl) return;
      var close = sheetEl.querySelector('.sh-close');
      if (close) close.focus({ preventScroll: true });
    }, 60);
  }
  function hideSheets() {
    if (!openSheet) return;
    openSheet.classList.remove('open');
    openSheet = null;
    scrim.classList.remove('open');
    document.body.style.overflow = '';
    if (/^\/(about|pins|favorites)$/.test(location.pathname)) history.replaceState({}, '', '/');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }
  scrim.addEventListener('click', hideSheets);
  $('detailClose').addEventListener('click', hideSheets);
  $('cardClose').addEventListener('click', hideSheets);
  $('aboutClose').addEventListener('click', hideSheets);
  document.addEventListener('keydown', function (ev) {
    if (!openSheet) return;
    if (ev.key === 'Escape') { ev.preventDefault(); hideSheets(); return; }
    if (ev.key !== 'Tab') return;
    var f = focusables(openSheet);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!openSheet.contains(document.activeElement)) {
      ev.preventDefault(); (ev.shiftKey ? last : first).focus(); return;
    }
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault(); last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault(); first.focus();
    }
  });

  /* drag-to-dismiss on the grab handle (mobile) */
  document.querySelectorAll('.sheet').forEach(function (sheet) {
    var grab = sheet.querySelector('.sh-grab');
    if (!grab) return;
    var startY = null;
    grab.addEventListener('pointerdown', function (ev) {
      if (window.matchMedia('(min-width:900px)').matches) return;
      startY = ev.clientY;
      sheet.style.transition = 'none';
      grab.setPointerCapture(ev.pointerId);
    });
    grab.addEventListener('pointermove', function (ev) {
      if (startY == null) return;
      var dy = Math.max(0, ev.clientY - startY);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    });
    function release(ev) {
      if (startY == null) return;
      var dy = Math.max(0, ev.clientY - startY);
      sheet.style.transition = '';
      sheet.style.transform = '';
      startY = null;
      if (dy > 90) hideSheets();
    }
    grab.addEventListener('pointerup', release);
    grab.addEventListener('pointercancel', release);
  });

  /* ---------------- detail sheet ---------------- */
  function openDetail(id, invoker) {
    var e = byId[id]; if (!e) return;
    var onView = isOnView(e);
    var timeFact = (e.displayTime && e.displayTime !== 'TBA' && !onView)
      ? esc(e.displayTime)
      : (onView ? esc(e.displayTime || '') : 'Time TBA <span class="sub">check the listing</span>');
    var priceFact = e.isFree
      ? '<span class="fv gold" style="padding:0">Free — as published</span>'
      : 'Not published <span class="sub">see the listing</span>';
    var addr = cleanAddr(e);
    if (!addr || addr.toLowerCase() === 'nyc') addr = e.location;
    var html =
      '<div class="sh-photo">' +
      (e.soldOut ? '<span class="soldbadge">Sold out</span>' : '') +
      '<img referrerpolicy="no-referrer" src="' + esc(e.image || PLACEHOLDER) + '" alt="" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'"></div>' +
      '<div class="sh-body">' +
      '<p class="sh-when">' + esc(e.displayDate || '') + chipsHtml(e, onView ? 'onview' : 'event') + '</p>' +
      '<h2 class="sh-name" id="detailName">' + esc(e.cleanName) + '</h2>' +
      (e.credit ? '<p class="sh-credit">' + esc(/^curated/i.test(e.credit) ? e.credit : 'Curated by ' + e.credit) + '</p>' : '') +
      '<div class="facts">' +
      '<div class="fact"><span class="fk">When</span><span class="fv">' + esc(e.displayDate || '') + '</span></div>' +
      (!onView ? '<div class="fact"><span class="fk">Time</span><span class="fv">' + timeFact + '</span></div>' : '') +
      '<div class="fact"><span class="fk">Where</span><span class="fv">' + esc(addr) + '</span></div>' +
      '<div class="fact"><span class="fk">Price</span><span class="fv">' + priceFact + '</span></div>' +
      '</div>' +
      '<div class="sh-actions">' +
      '<a class="btn" href="' + esc(e.mapsUrl) + '" target="_blank" rel="noopener"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 11S2 7.6 2 4.8a4 4 0 118 0C10 7.6 6 11 6 11z"/><circle cx="6" cy="4.8" r="1.4"/></svg>Directions</a>' +
      '<a class="btn solid" href="' + esc(e.url) + '" target="_blank" rel="noopener">Event page<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9l6-6M4.5 3H9v4.5"/></svg></a>' +
      '</div>' +
      '<div class="sh-actions">' +
      '<button class="btn" data-add="' + esc(String(e.id)) + '">' + (plan[e.id] ? '✓ On your card' : 'Note on your card') + '</button>' +
      '<button class="btn" data-ics="' + esc(String(e.id)) + '"><svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="2.5" width="9" height="8" rx="1"/><path d="M1.5 5h9M4 1v2.5M8 1v2.5"/></svg>Add to calendar</button>' +
      '</div>' +
      /* description after the action row (brief §3: actions are item 4, description item 5) */
      (e.cleanDescription ? '<p class="sh-desc">' + esc(e.cleanDescription) + '</p>' : '') +
      dealsHtml(e) +
      '<div class="provenance">' +
      '<div class="prow"><span>Source</span><b>— ' + esc(e.source || 'the venue') + '</b></div>' +
      (e.note ? '<div class="prow"><span class="pnote">' + esc(e.note) + '</span></div>' : '') +
      '</div>' +
      '</div>';
    $('detailContent').innerHTML = html;
    var sheet = $('detailSheet');
    sheet.setAttribute('aria-label', e.cleanName);
    show(sheet, invoker);
  }

  /* per-event, data-driven deals only — the hardcoded regional deals panel is gone */
  function dealsHtml(e) {
    var deals = e.deals;
    if (!deals) return '';
    if (typeof deals === 'string') deals = [deals];
    if (!Array.isArray(deals) || !deals.length) return '';
    return '<div class="note" style="margin-top:16px"><p class="n-k">On the house</p>' +
      deals.map(function (d) { return '<p>' + esc(typeof d === 'string' ? d : (d && d.text) || '') + '</p>'; }).join('') +
      '</div>';
  }

  /* ---------------- ICS (ported from the legacy app) ---------------- */
  function downloadICS(e) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var ymdOf = function (d) { return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); };
    var dtLines;
    var start = localDate(e.start_date), end = localDate(e.end_date) || start;
    if (end && start && start > end) start = end;   /* healed dates */
    var mins = minutesOf(e);
    if (start && mins != null) {
      var ymd = ymdOf(start);
      var h = Math.floor(mins / 60), m = mins % 60;
      var dtStart = ymd + 'T' + pad(h) + pad(m) + '00';
      var dtEnd = (end && end > start)
        ? ymdOf(end) + 'T230000'
        : ymd + 'T' + pad(Math.min(23, h + 3)) + pad(m) + '00';
      dtLines = ['DTSTART:' + dtStart, 'DTEND:' + dtEnd];
    } else {
      /* time TBA — export an all-day entry; we never fabricate a 7 PM the
         ledger itself refuses to print (DTEND is exclusive per RFC 5545) */
      var s = start || TODAY;
      var last = (end && end > s) ? end : s;
      var next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      dtLines = ['DTSTART;VALUE=DATE:' + ymdOf(s), 'DTEND;VALUE=DATE:' + ymdOf(next)];
    }
    var escIcs = function (s) { return String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n'); };
    var ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Soiree//Event//EN',
      'BEGIN:VEVENT',
      dtLines[0],
      dtLines[1],
      'SUMMARY:' + escIcs(e.cleanName),
      'DESCRIPTION:' + escIcs(e.cleanDescription || ''),
      'LOCATION:' + escIcs(cleanAddr(e) || e.location || ''),
      e.url ? 'URL:' + e.url : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = String(e.cleanName).replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-') + '.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Calendar file saved');
  }

  /* ---------------- evening card ---------------- */
  function planList() {
    return Object.keys(plan).map(function (id) { return byId[id]; }).filter(Boolean)
      .sort(function (a, b) {
        var sd = function (e) { return isOnView(e) ? (e.startAt || e.endAt || TODAY) : (e.startAt || localDate(e.start_date) || TODAY); };
        var da = sd(a), db = sd(b);
        if (da - db) return da - db;
        var ma = minutesOf(a), mb = minutesOf(b);
        if (ma == null) return 1;
        if (mb == null) return -1;
        return ma - mb;
      });
  }
  function refreshSeal() {
    var n = Object.keys(plan).length;
    $('sealCount').textContent = n;
    $('sealBtn').classList.toggle('show', n > 0);
  }
  function bumpSeal() {
    if (reduceMotion()) return;
    var s = $('sealBtn');
    s.classList.remove('bump');
    void s.offsetWidth;
    s.classList.add('bump');
  }
  function cardTimeLabel(e) {
    if (isOnView(e)) return /OPENS/i.test(e.dateChip || '') ? e.dateChip : 'ON VIEW';
    var d = localDate(e.start_date);
    var pre = dayDiff(d) === 0 ? '' : fmtShort(d) + ' · ';
    return pre + (e.displayTime && e.displayTime !== 'TBA' ? e.displayTime : 'TIME TBA');
  }
  function renderCard() {
    var list = planList();
    var html = '<div class="card-head"><p class="ch-k">The concierge has noted</p><h3>Your Evening</h3>' +
      '<p class="ch-d">' + esc(fmtLong(TODAY)) + ' · ' + list.length + (list.length === 1 ? ' stop' : ' stops') + '</p></div>' +
      '<div class="sh-body">';
    if (!list.length) {
      html += '<p class="card-empty">The card is blank — for now.<br>Tap the <b style="font-style:normal">+</b> beside any occasion and the evening writes itself.</p>';
    } else {
      html += '<div class="card-rows">' + list.map(function (e) {
        return '<div class="crow"><div class="tcell"><span class="tv" style="font-size:10.5px;letter-spacing:.04em">' + esc(cardTimeLabel(e)) + '</span></div>' +
          '<div class="cb"><p class="cn">' + esc(e.cleanName) + '</p><p class="cw">' + esc(whereLine(e)) + (e.isFree ? ' · free' : '') + '</p></div>' +
          '<button class="rm" data-remove="' + esc(String(e.id)) + '" aria-label="Remove ' + esc(e.cleanName) + '"><svg viewBox="0 0 13 13" aria-hidden="true"><path d="M2 2l9 9M11 2l-9 9"/></svg></button></div>';
      }).join('') + '</div>' +
        '<div class="sh-actions"><button class="btn solid" id="copyPlan">Copy the plan</button><button class="btn" id="clearPlan">Clear</button></div>';
    }
    html += '<p class="card-kept">Kept on this device — no account, no fuss.</p></div>';
    $('cardContent').innerHTML = html;
  }
  function togglePlan(id) {
    var adding = !plan[id];
    if (adding) plan[id] = 1; else delete plan[id];
    savePlan(); refreshSeal();
    if (adding) bumpSeal();
    document.querySelectorAll('[data-add="' + id + '"]').forEach(function (b) {
      if (b.classList.contains('addbtn')) {
        b.classList.toggle('inplan', adding);
        b.setAttribute('aria-pressed', String(adding));
        b.innerHTML = adding
          ? '<svg viewBox="0 0 13 13" aria-hidden="true"><path d="M2 7l3 3 6-8"/></svg>'
          : '<svg viewBox="0 0 13 13" aria-hidden="true"><path d="M6.5 1v11M1 6.5h11"/></svg>';
        b.setAttribute('aria-label', (adding ? 'Remove from' : 'Note on') + ' your evening card');
        if (!reduceMotion()) { b.classList.add('pop'); setTimeout(function () { b.classList.remove('pop'); }, 220); }
      } else {
        b.innerHTML = adding ? '✓ On your card' : 'Note on your card';
      }
    });
    toast(adding ? 'Noted on your card' : 'Struck from the card');
  }
  function openCard(invoker) {
    renderCard();
    show($('cardSheet'), invoker);
  }
  $('sealBtn').addEventListener('click', function () { openCard(this); });
  $('cardContent').addEventListener('click', function (ev) {
    var rm = ev.target.closest('[data-remove]');
    if (rm) {
      togglePlan(rm.getAttribute('data-remove'));
      renderCard();
      if (!Object.keys(plan).length) hideSheets();
      return;
    }
    if (ev.target.closest('#copyPlan')) {
      var txt = 'soirée — ' + fmtLong(TODAY) + '\n' + planList().map(function (e) {
        var venue = whereLine(e).split(' · ')[0];
        return cardTimeLabel(e) + ' — ' + e.cleanName + ' @ ' + venue + ' (' + (e.neighborhood || '') + ')';
      }).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
        function () { toast('Plan copied'); },
        function () { toast('Could not copy'); });
      return;
    }
    if (ev.target.closest('#clearPlan')) {
      Object.keys(plan).forEach(function (id) { togglePlan(id); });
      renderCard();
      hideSheets();
    }
  });

  /* ---------------- toast ---------------- */
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
  }

  /* ---------------- wiring (delegated once) ---------------- */
  function wire() {
    var L = $('ledger');
    L.addEventListener('click', function (ev) {
      var add = ev.target.closest('[data-add]');
      if (add) { ev.stopPropagation(); togglePlan(add.getAttribute('data-add')); return; }
      if (ev.target.closest('a')) return;
      var det = ev.target.closest('[data-detail]');
      if (det) { openDetail(det.getAttribute('data-detail'), det); return; }
      if (ev.target.closest('.lead')) return;
      var row = ev.target.closest('.row');
      if (row) openDetail(row.getAttribute('data-id'), row);
    });
    L.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var det = ev.target.closest('[data-detail]');
      if (det) { ev.preventDefault(); openDetail(det.getAttribute('data-detail'), det); return; }
      var row = ev.target.closest('.row');
      if (row && ev.target === row) { ev.preventDefault(); openDetail(row.getAttribute('data-id'), row); }
    });
    L.addEventListener('mouseover', function (ev) {
      var row = ev.target.closest('[data-id],[data-lead]');
      if (row) setWell(byId[row.getAttribute('data-id') || row.getAttribute('data-lead')]);
    });
    L.addEventListener('focusin', function (ev) {
      var row = ev.target.closest('[data-id],[data-lead]');
      if (row) setWell(byId[row.getAttribute('data-id') || row.getAttribute('data-lead')]);
    });
    $('detailContent').addEventListener('click', function (ev) {
      var add = ev.target.closest('[data-add]');
      if (add) { togglePlan(add.getAttribute('data-add')); return; }
      var ics = ev.target.closest('[data-ics]');
      if (ics) { var e = byId[ics.getAttribute('data-ics')]; if (e) downloadICS(e); }
    });
  }

  /* the well crossfades to the row nearest viewport center on scroll (brief §2) */
  function wellSpy() {
    if (!window.matchMedia('(min-width:900px)').matches) return;
    var rows = $('ledger').querySelectorAll('[data-id],[data-lead]');
    if (!rows.length) return;
    var mid = window.innerHeight / 2, best = null, bestD = Infinity;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      var d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestD) { bestD = d; best = rows[i]; }
    }
    if (best) setWell(byId[best.getAttribute('data-id') || best.getAttribute('data-lead')]);
  }

  /* ---------------- scrollspy ---------------- */
  var spyWired = false;
  var spyTick = false;
  function spy() {
    var links = {};
    document.querySelectorAll('[data-nav]').forEach(function (a) { links[a.getAttribute('data-nav')] = a; });
    var shelves = document.querySelectorAll('[data-shelf]');
    var currentId = null;
    shelves.forEach(function (s) {
      if (s.getBoundingClientRect().top <= 140) currentId = s.id;
    });
    if (!currentId && shelves.length) currentId = shelves[0].id;
    Object.keys(links).forEach(function (k) { links[k].classList.toggle('on', k === currentId); });
    var on = links[currentId];
    if (on) {
      var navIn = $('shelfnavIn');
      var target = on.offsetLeft - (navIn.clientWidth - on.offsetWidth) / 2;
      if (Math.abs(navIn.scrollLeft - target) > 40) navIn.scrollTo({ left: target, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  }
  function observeShelves() {
    if (!spyWired) {
      spyWired = true;
      window.addEventListener('scroll', function () {
        if (spyTick) return;
        spyTick = true;
        requestAnimationFrame(function () { spyTick = false; spy(); wellSpy(); });
      }, { passive: true });
    }
    spy();
  }

  /* ---------------- deep link (/e/* pages inject window.__DEEP_EVENT_ID__) ---------------- */
  function openDeepLink() {
    var id = window.__DEEP_EVENT_ID__;
    if (id == null) return;
    window.__DEEP_EVENT_ID__ = null;
    if (!byId[id] && region !== 'both') {
      /* the linked occasion may sit across the river — widen the register */
      region = 'both';
      try { localStorage.setItem('soiree.region', region); } catch (e) { }
      $('register').querySelectorAll('[data-region]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x.getAttribute('data-region') === 'both'));
      });
      runPipeline(); /* verify() is synchronous — byId is repopulated before we look */
    }
    if (byId[id]) openDetail(String(id));
  }

  /* ---------------- routes ---------------- */
  function scrollToShelf(id) {
    var el = $(id) || $('tonight');
    if (el) el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function applyRoute() {
    var p = location.pathname;
    if (p === '/social' || p === '/all') { history.replaceState({}, '', '/'); return; }
    if (p === '/today') { requestAnimationFrame(function () { scrollToShelf('tonight'); }); }
    else if (p === '/week') { requestAnimationFrame(function () { scrollToShelf('week'); }); }
    else if (p === '/pins' || p === '/favorites') { openCard(); }
    else if (p === '/about') { show($('aboutSheet')); }
  }
  $('aboutLink').addEventListener('click', function (ev) {
    ev.preventDefault();
    history.pushState({}, '', '/about');
    show($('aboutSheet'), this);
  });
  window.addEventListener('popstate', function () {
    if (location.pathname === '/about') show($('aboutSheet'));
    else if (openSheet) { openSheet.classList.remove('open'); openSheet = null; scrim.classList.remove('open'); document.body.style.overflow = ''; }
  });

  /* ---------------- subscribe ---------------- */
  function wireDispatch() {
    var form = $('dispatchForm');
    var sel = $('dispatchRegion');
    if (region !== 'both' && sel) sel.value = region;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = $('dispatchEmail').value.trim();
      if (!email || email.indexOf('@') < 0) { toast('An address, if you please'); return; }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, region: sel.value })
      }).then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (data) {
          if (data && data.success) { $('dispatch').classList.add('sent'); }
          else { toast((data && data.error) || 'Something went wrong'); btn.disabled = false; }
        })
        .catch(function () { toast('Network hiccough — try again'); btn.disabled = false; });
    });
    /* the seal FAB steps aside while the dispatch fields are focused —
       it must never sit over typed text with the keyboard up */
    var dispatch = $('dispatch');
    dispatch.addEventListener('focusin', function () { $('sealBtn').classList.add('dodge'); });
    dispatch.addEventListener('focusout', function () { $('sealBtn').classList.remove('dodge'); });
  }

  /* ---------------- instagram band (render only when posts exist) ---------------- */
  function initIgBand() {
    fetch('/api/instagram-feed')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.posts) || !data.posts.length) return;
        $('igGrid').innerHTML = data.posts.slice(0, 6).map(function (p) {
          return '<a href="' + esc(p.permalink) + '" target="_blank" rel="noopener" aria-label="Instagram post">' +
            '<img src="' + esc(p.media_url) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></a>';
        }).join('');
        $('igband').hidden = false;
      })
      .catch(function () { });
  }

  /* ---------------- boot ---------------- */
  renderAlmanac();
  wireRegister();
  wireDispatch();
  wire();
  initIgBand();

  fetch('/api/events')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (j) {
      RAW = j.events || [];
      var filtered = region === 'both' ? RAW : RAW.filter(function (e) { return regionOf(e) === region; });
      R = window.TruthPass.verify(filtered, new Date());
      byId = {};
      R.events.forEach(function (e) { byId[e.id] = e; });
      var dirty = false;
      Object.keys(plan).forEach(function (id) { if (!byId[id]) { delete plan[id]; dirty = true; } });
      if (dirty) savePlan();
      refreshSeal();
      preloadTonightArt().then(function () {
        render();
        applyRoute();
        openDeepLink();
      });
    })
    .catch(function (err) {
      $('ledger').innerHTML =
        '<div class="note" style="margin-top:44px"><p class="n-k">A word from the concierge</p><p>The ledger could not be fetched just now (' + esc(err.message) + '). Give it a moment, then refresh.</p></div>';
    });
})();
