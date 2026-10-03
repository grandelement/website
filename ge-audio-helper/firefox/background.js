function mediaKind(tab) {
  const url = String(tab && tab.url || "");
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/soundcloud\.com/i.test(url)) return "soundcloud";
  if (/bandcamp\.com/i.test(url)) return "bandcamp";
  if (/spotify\.com/i.test(url)) return "spotify";
  return "browser";
}

async function scanAudioTabs() {
  const tabs = await browser.tabs.query({});
  return tabs
    .filter(tab => {
      const url = String(tab.url || "");
      return !!tab.audible ||
        /youtube\.com|youtu\.be|soundcloud\.com|bandcamp\.com|open\.spotify\.com/i.test(url);
    })
    .map(tab => ({
      id: String(tab.id),
      title: String(tab.title || "Browser audio"),
      url: String(tab.url || ""),
      audible: !!tab.audible,
      muted: !!(tab.mutedInfo && tab.mutedInfo.muted),
      active: !!tab.active,
      windowId: tab.windowId,
      kind: mediaKind(tab)
    }))
    .sort((a, b) => Number(b.audible) - Number(a.audible) || Number(b.active) - Number(a.active) || a.title.localeCompare(b.title));
}

browser.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === "ge-audio-scan") {
    return scanAudioTabs().then(sources => ({ ok: true, sources }));
  }
  if (msg.type === "ge-audio-focus") {
    const tabId = Number(msg.tabId);
    if (!Number.isFinite(tabId)) return Promise.resolve({ ok: false, error: "Invalid tab" });
    return browser.tabs.get(tabId).then(tab =>
      browser.windows.update(tab.windowId, { focused: true })
        .then(() => browser.tabs.update(tabId, { active: true }))
        .then(() => ({ ok: true }))
    );
  }
});
