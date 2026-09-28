# GE Website Back Room Publisher

This Worker is the private write bridge for the Website Back Room.

## Security model

The browser contains no GitHub credential and no admin password.

Cloudflare secrets:
- BACKROOM_PASSWORD
- SESSION_SECRET
- GITHUB_TOKEN

The GitHub token should be fine-grained, restricted to the `grandelement/website` repository, with Contents read/write only.

## API

- `GET /health`
- `POST /login` with `{"password":"..."}`
- `GET /session` with Bearer session
- `POST /publish` with Bearer session and `{"config":{...}}`

Successful publishing writes only `config/site-live.json` on `main`.

Recommended Worker hostname: `https://backroom-api.grandelement.com`.
