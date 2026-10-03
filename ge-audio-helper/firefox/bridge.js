window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  const msg = event.data || {};
  if (msg.type !== "ge-dj-audio-scan-request") return;
  try {
    const result = await browser.runtime.sendMessage({ type: "ge-audio-scan" });
    window.postMessage({
      type: "ge-dj-audio-sources",
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
