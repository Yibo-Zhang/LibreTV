# LibreTV private deployment fork

This fork carries application changes needed by Yibo's deployment. Nix packaging,
host settings and deployment belong in `/home/yibo/nix_config`.

- Keep upstream password authentication as the default.
- `AUTH_DISABLED=true` explicitly delegates access control to the surrounding
  private network. It must work without PASSWORD, cookies or a login request.
- Keep `/api/status`, `/api/auth`, the shared API guard and the frontend setup
  state consistent when changing access behavior.
- Disabling login must not disable SSRF checks or alter video-source handling.
- Run type checking, lint, tests and a production build before deployment.
- Use the shared `yibo-ui-verify` skill for a fresh-browser check of subscription
  import, search and playback without cookies or localStorage from a previous run.
