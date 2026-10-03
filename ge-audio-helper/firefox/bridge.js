window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  const msg = event.data || {};
  if (msg.type !== "ge-dj-audio-scan-request" && msg.type !== "ge-dj-audio-focus-request") return;
  try {
    const result = msg.type === "ge-dj-audio-focus-request"
      ? await browser.runtime.sendMessage({ type: "ge-audio-focus", tabId: msg.tabId })
      : await browser.runtime.sendMessage({ type: "ge-audio-scan" });
    window.postMessage({
      type: msg.type === "ge-dj-audio-focus-request" ? "ge-dj-audio-focus-result" : "ge-dj-audio-sources",
      requestId: msg.requestId || "",
      ok: !!(result && result.ok),
      sources: result && Array.isArray(result.sources) ? result.sources : []
    }, "*");
  } catch (error) {
    window.postMessage({
      type: "ge-dj-audio-sources",
      requestId: msg.requestId || "",
      ok: false,
      error: String(error && error.message || error),
      sources: []
    }, "*");
  }
});
window.postMessage({ type: "ge-dj-audio-helper-ready" }, "*");
