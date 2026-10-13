(function () {
  var mount = document.getElementById("demo");
  if (!mount || !window.Promise) return;

  /* 80 columns at 16px; keep in sync with .demo-window in style.css. */
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
      /* Keep the poster over the player's initial 80x24 layout until playback starts. */
      var stage = document.createElement("div");
      stage.className = "demo-screen";
      mount.insertBefore(stage, mount.firstChild);

      var options = {autoPlay: true, speed: 2, idleTimeLimit: 1};
      /* Prefer an integer font size to avoid blurred glyphs on low-DPI screens. */
      if (stage.getBoundingClientRect().width >= TERMINAL_WIDTH) {
        options.fit = false;
        options.terminalFontSize = "16px";
      } else {
        options.fit = "width";
      }
      var player = AsciinemaPlayer.create("demo.cast", stage, options);

      /* A recording error can follow play; retain the button for retries. */
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

  /* rel=prefetch gives optional assets lower priority than page resources. */
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
