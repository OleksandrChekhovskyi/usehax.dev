(function () {
  var count = document.getElementById("stars");
  if (!count || !window.fetch) return;

  /* The inline script in index.html reads the same entry to fill the slot before the first
   * paint, so it holds the slot's text as shown, fallback included, and when it was last
   * requested. */
  var CACHE_KEY = "hax-stars";
  var CACHE_TTL_MS = 10 * 60 * 1000;

  /* At most four characters, the room style.css gives the slot, and exactly four below 10k so
   * the padding is even; the repository is long past counts where 0.xk would read oddly.
   * Rounds down so a count is never overstated. */
  function format(stars) {
    if (stars < 10000) return (Math.floor(stars / 100) / 10).toFixed(1) + "k";
    return Math.floor(stars / 1000) + "k";
  }

  /* Storage throws when disabled, as in some private browsing modes. */
  function cacheTime() {
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached && typeof cached.time === "number") return cached.time;
    } catch (e) {}
    return 0;
  }

  function writeCache(text) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({text: text, time: Date.now()}));
    } catch (e) {}
  }

  /* Unauthenticated API calls are limited to 60 an hour per IP, and a failed attempt waits
   * out the interval too, since a rate-limited request should not be retried at once. */
  if (Date.now() - cacheTime() < CACHE_TTL_MS) return;

  fetch("https://api.github.com/repos/OleksandrChekhovskyi/hax")
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (repo) {
      if (typeof repo.stargazers_count !== "number") throw new Error("no star count");
      count.textContent = format(repo.stargazers_count);
      writeCache(count.textContent);
    })
    .catch(function () {
      if (!count.textContent) count.textContent = "Star";
      writeCache(count.textContent);
    });
})();
