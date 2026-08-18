  document.addEventListener("LSAFFEventLoaded",
    function(e) {
      e.detail.init();
    });

  // Existing picks were embedded under Lasso's "Cactus" theme (70/30
  // text-vs-image flex split), which reads fine in Lasso's own wide dashboard
  // preview but collapses the product photo to a ~36px sliver once it's
  // rendered at the Amazon Picks grid's card width (Che, 2026-08-15:
  // unacceptable). Lasso ships every theme's CSS on every page regardless of
  // which one an embed was created with, so swapping the theme class after
  // their snippet renders it re-flows the same embed into the "Cutter" theme
  // (50/50 split, image block-centered, full-width button) with no separate
  // API call -- confirmed against Lasso's own stylesheet rules for
  // .embed-lasso-cutter. Scoped to .picks-lasso-rail so it can never touch a
  // Lasso embed elsewhere on the site that was deliberately built as Cactus.
  // Lasso's title field is the full Amazon listing name, hardcoded into the
  // embed itself (see _LASSO_SHORT_TITLES in html_output.py). Once rendered,
  // swap in the brand+type version from that div's data-short-title attribute
  // -- doesn't touch Lasso's stored data, just what this page displays.
  (function () {
    var grid = document.querySelector(".picks-lasso-rail");
    if (!grid) return;
    function retheme() {
      grid.querySelectorAll(".embed-lasso-cactus").forEach(function (el) {
        el.classList.remove("embed-lasso-cactus");
        el.classList.add("embed-lasso-cutter");
      });
      // Some picks (the ones with a "Boosted" badge) bundle the button and
      // disclosure+date inside the same title/price box instead of their own
      // top-level boxes, which only gives them the ~half-card text column --
      // "Buy Now on Amazon" wrapped to 3 lines and the disclosure to 5+
      // ragged ones (Che, 2026-08-16, caught on Sam Edelman vs. Aerosoles).
      // Move both up to sit directly under the grid so the "btn"/"meta" CSS
      // rules above (full card width, same as the other picks) apply.
      grid.querySelectorAll(".embed-lasso-end, a.embed-lasso-button-1").forEach(function (el) {
        var display = el.closest(".embed-lasso-display");
        if (display && el.parentElement !== display) display.appendChild(el);
      });
      grid.querySelectorAll(".lasso-embed[data-short-title]").forEach(function (wrap) {
        var short = wrap.getAttribute("data-short-title");
        var t = wrap.querySelector(".embed-lasso-title");
        if (t && t.textContent.trim() !== short) {
          t.textContent = short;
          if (t.hasAttribute("title")) t.setAttribute("title", short);
        }
      });
      // Same frozen-at-creation issue as the colors: these embeds render
      // "Buy Now" even though Lasso's saved button text is "Buy on Amazon".
      // Amazon's Associates terms require the link's own wording make clear
      // it goes to Amazon (Che, 2026-08-15) -- "Buy Now" alone doesn't say
      // that, so it's forced to "Buy Now on Amazon" here rather than trusting
      // whatever text shipped with the embed.
      grid.querySelectorAll("a.embed-lasso-button-1, a.embed-lasso-button-2").forEach(function (btn) {
        if (btn.textContent.trim() !== "Buy Now on Amazon") btn.textContent = "Buy Now on Amazon";
      });
      // Real list price / coupon, hand-verified against Amazon (see
      // cache/amazon_picks_verified_prices.json) and passed in via
      // data-list-price/data-discount-pct/data-coupon on the wrapper div.
      // Reuses .price-was/.pct-pill from the deal grid so a real discount
      // here reads exactly like a real discount everywhere else on the site.
      grid.querySelectorAll(".lasso-embed[data-list-price], .lasso-embed[data-coupon]").forEach(function (wrap) {
        var priceEl = wrap.querySelector(".embed-lasso-price");
        if (!priceEl || priceEl.dataset.pkEnriched) return;
        priceEl.dataset.pkEnriched = "1";
        var listPrice = wrap.getAttribute("data-list-price");
        var pct = wrap.getAttribute("data-discount-pct");
        if (listPrice && pct) {
          var was = document.createElement("span");
          was.className = "price-was";
          was.textContent = "$" + listPrice;
          var pill = document.createElement("span");
          pill.className = "pct-pill";
          pill.textContent = pct + "% off";
          priceEl.appendChild(was);
          priceEl.appendChild(pill);
        }
        var coupon = wrap.getAttribute("data-coupon");
        if (coupon) {
          var note = document.createElement("div");
          note.className = "pick-lasso-coupon";
          note.textContent = "+ " + coupon;
          priceEl.insertAdjacentElement("afterend", note);
        }
      });
    }
    retheme();
    new MutationObserver(retheme).observe(grid, {subtree: true, childList: true, attributes: true, attributeFilter: ["class"]});
  })();
