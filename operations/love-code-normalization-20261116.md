# Access code normalization: LOVE

The Back Room public UI previously singled out the legacy LOVE code for status auditing, key rotation, labels, and master-switch warnings. Those hardcoded special cases have been removed. It now displays and edits all non-revoked saved access-code records using the same standard controls and existing permission checkboxes. No code is automatically rotated or suspended.

The literal word LOVE is still legitimately used for the **Love album**, favorites button, and song titles. Those are unrelated to authentication and must stay.

The Radio Gate already submits entered code strings to the Vault `/v1/public/access/redeem` endpoint and requires a successful response. Its client-side legacy cleanup also revokes old local LOVE-derived owner/demo privileges; **do not remove that safety cleanup**.

The private Cloudflare Vault Workers and D1 code records are not stored in this public GitHub repository. This PR cannot guarantee that server-side code named LOVE is no longer reserved, or that any pre-existing privileged server record has been normalized. Before claiming completion, audit the private redemption handler for `LOVE`, `LOVER`, `access_legacy_love_v1` and any other code-string-specific policy, and ensure all permissions come solely from authenticated code records. Preserve the currently issued code and its users; never delete/rotate without explicit owner request.

The screenshot of `https://vault.grandelement.com/` returns `{ok:false,error:"Not found."}`. This is a non-API root and **does not prove** access-code or event endpoints are unavailable. Verify each supported API route with appropriate authorization, not by loading the domain root.
