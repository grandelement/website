/* DEPRECATED QR tracker
   QR attribution now belongs in the permanent GE Studios Vault fan_events ledger.
   The /qr/ page loads ge-vault-client.js, which creates the first-party anonymous
   visitor ID and submits qr_scan plus campaign attribution to:
   https://vault.grandelement.com/v1/public/event

   Keep this Worker only as a transparent pass-through if an older Cloudflare route
   still references it. Do not create or write a second QR database.
*/
export default {
  async fetch(request) {
    return fetch(request);
  }
};
