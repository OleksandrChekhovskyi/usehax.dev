/* The player and the recording together weigh about half a megabyte for a 2m37s demo,
 * so neither is on the critical path: they are prefetched at low priority once the page
 * has loaded, and mounted only when a visitor asks to watch. With scripting off, no play
 * control is inserted and the poster stands on its own. */
(function () {
  var mount = document.getElementById("demo");
  if (!mount || !window.Promise) return;

  /* What 80 columns of the recording measure at 16px, and so the width at which the
   * exact size stops fitting. Kept in step with .demo-window in style.css. */
  var TERMINAL_WIDTH = 774;

  function append(el, parent) {
    return new Promise(function (resolve, reject) {
      el.onload = resolve;
      el.onerror = reject;
      parent.appendChild(el);
    });
  }

  function loadPlayer() {
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "vendor/asciinema-player.css";
    var js = document.createElement("script");
    js.src = "vendor/asciinema-player.min.js";
    return Promise.all([append(css, document.head), append(js, document.body)]);
  }

  var button = document.createElement("button");
  button.type = "button";
  button.className = "demo-play";
  button.innerHTML = '<span class="demo-play-icon" aria-hidden="true"></span>' +
                     '<span class="demo-play-label">Play the session · 2m37s</span>';
  mount.appendChild(button);

  button.addEventListener("click", function () {
    var label = button.querySelector(".demo-play-label");
    button.disabled = true;
    label.textContent = "Loading…";
    loadPlayer().then(function () {
      /* The player mounts under the poster and only takes over once it is actually
       * painting: it briefly lays out at its default 80x24 before reading the
       * recording's own size, and that resize should not be on show. */
      var stage = document.createElement("div");
      stage.className = "demo-screen";
      mount.insertBefore(stage, mount.firstChild);

      /* Speed and idle trimming are presentation, so they stay here rather than
       * being baked into demo.cast: the controls can still take it back to 1×.
       *
       * Fitting to width makes the player solve for a font size, which all but
       * always lands on a fraction of a pixel and smears glyphs on low-DPI screens.
       * Asking for 16px exactly avoids that; only below the width that size needs
       * is there no choice but to scale to fit. */
      var options = {autoPlay: true, speed: 2, idleTimeLimit: 1};
      if (stage.getBoundingClientRect().width >= TERMINAL_WIDTH) {
        options.fit = false;
        options.terminalFontSize = "16px";
      } else {
        options.fit = "width";
      }
      var player = AsciinemaPlayer.create("demo.cast", stage, options);

      /* The player announces play before it has the recording, so play is not proof of
       * success and error can still arrive after the poster has stepped aside. The
       * control is hidden rather than removed so that it can simply come back. */
      player.addEventListener("play", function () {
        mount.className = "demo is-playing";
      });
      player.addEventListener("error", function () {
        mount.className = "demo";
        if (stage.parentNode) stage.parentNode.removeChild(stage);
        button.disabled = false;
        label.textContent = "Could not load the recording — retry";
      });
    }).catch(function () {
      button.disabled = false;
      label.textContent = "Could not load the player — retry";
    });
  });

  /* Warm the cache after the page is otherwise finished, so a click on play usually
   * has nothing left to fetch. rel=prefetch is explicitly low priority, so it yields
   * to anything the page still needs; on metered or slow connections it is skipped
   * rather than spending half a megabyte the visitor may never watch. */
  function prefetch() {
    var conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;
    ["vendor/asciinema-player.min.js", "vendor/asciinema-player.css", "demo.cast"]
      .forEach(function (href) {
        var link = document.createElement("link");
        link.rel = "prefetch";
        link.href = href;
        document.head.appendChild(link);
      });
  }
  if (document.readyState === "complete") prefetch();
  else window.addEventListener("load", prefetch);
})();
