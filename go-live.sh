#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fansgametime.com — the last mile.
#
# Everything upstream of this is already done: the repo exists, GitHub Pages
# is built, and CNAME already names fansgametime.com. The ONLY thing left is
# four DNS records at GoDaddy, and this script writes them.
#
# It needs a GoDaddy API key, which is the one credential that does not exist
# on this machine. Two minutes to make one:
#
#   1. developer.godaddy.com/keys  → Create New API Key → Production
#   2. printf 'KEY:SECRET\n' > ~/.secrets/godaddy-api && chmod 600 ~/.secrets/godaddy-api
#   3. bash ~/fans/go-live.sh
#
# Note: GoDaddy gates the production DNS API on account size. If step 3 returns
# 403 ACCESS_DENIED, the API is not open on this account and the records have
# to go in by hand — the exact four are printed at the bottom either way.
# ---------------------------------------------------------------------------
set -uo pipefail
DOMAIN=fansgametime.com
KEYFILE=~/.secrets/godaddy-api
# GitHub Pages apex addresses. These are GitHub's published set and are stable.
IPS=(185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153)

show_manual () {
  cat <<TXT

  Do this by hand at godaddy.com → My Products → $DOMAIN → DNS:

    DELETE  the existing parked A record for @ (it points at GoDaddy)

    A      @      185.199.108.153     600
    A      @      185.199.109.153     600
    A      @      185.199.110.153     600
    A      @      185.199.111.153     600
    CNAME  www    aisoundz.github.io  1 hour

  Then run:  bash ~/fans/go-live.sh --watch
  which waits for it to propagate and turns HTTPS on by itself.

TXT
}

if [ "${1:-}" = "--watch" ]; then
  echo "Waiting for $DOMAIN to point at GitHub Pages..."
  until getent hosts $DOMAIN | grep -q '185.199.10'; do sleep 60; done
  echo "DNS is live. Waiting for the certificate..."
  for _ in $(seq 1 60); do
    gh api -X PUT repos/aisoundz/fans/pages -F https_enforced=true >/dev/null 2>&1 && break
    sleep 60
  done
  curl -sI https://$DOMAIN | head -1
  echo "https://$DOMAIN is live."
  exit 0
fi

if [ ! -f "$KEYFILE" ]; then
  echo "No GoDaddy API key at $KEYFILE — that is the only thing missing."
  show_manual; exit 1
fi

CRED=$(tr -d " \t\r\n" < "$KEYFILE")

# TWO CREDENTIAL FORMATS, BECAUSE GODADDY CHANGED THEIRS.
# The old developer-keys system issued a KEY and a SECRET and wants
#   Authorization: sso-key KEY:SECRET
# The newer Personal Access Token is a single opaque string and wants
#   Authorization: Bearer TOKEN
# A colon in the file is the tell, but it is not worth trusting — so both
# are tried on a harmless GET and whichever answers 200 is the one used.
AUTH=""
for scheme in "sso-key $CRED" "Bearer $CRED"; do
  c=$(curl -s -o /tmp/gd.try -w '%{http_code}' \
    "https://api.godaddy.com/v1/domains/$DOMAIN/records" -H "Authorization: $scheme")
  if [ "$c" = "200" ]; then AUTH="$scheme"; echo "  auth: ${scheme%% *}"; break; fi
done
if [ -z "$AUTH" ]; then
  echo "  Neither auth scheme was accepted. Last response:"
  echo "  $(head -c 240 /tmp/gd.try)"
  echo "  401 usually means the token was copied short, or it is an OTE/test key."
  echo "  403 means the scope does not include Domains & DNS."
  show_manual; exit 1
fi

# READ BEFORE WRITE. Prove the key works and show what is there now, so a bad
# key or an OTE key fails on a harmless GET instead of half-writing a live
# domain's records. Also prints the current records as a rollback note.
echo "Checking the key against $DOMAIN..."
code=$(curl -s -o /tmp/gd.pre -w '%{http_code}' \
  "https://api.godaddy.com/v1/domains/$DOMAIN/records" \
  -H "Authorization: $AUTH")
if [ "$code" != "200" ]; then
  echo "  HTTP $code — the key did not work. Nothing was changed."
  case "$code" in
    401) echo "  401 = bad key/secret, or an OTE (test) key was made instead of Production." ;;
    403) echo "  403 = the API is not open on this account." ;;
  esac
  echo "  $(head -c 240 /tmp/gd.pre)"
  show_manual; exit 1
fi
echo "  key works. Records before the change are saved at /tmp/gd.pre:"
python3 -c "
import json
for r in json.load(open('/tmp/gd.pre')):
    print('    %-6s %-6s %s' % (r.get('type'), r.get('name'), r.get('data')))
" 2>/dev/null | head -20
cp /tmp/gd.pre ~/fans/dns-before-$(date +%Y%m%d-%H%M).json

BODY=$(printf '%s\n' "${IPS[@]}" | python3 -c "
import sys,json
print(json.dumps([{'data':ip.strip(),'ttl':600} for ip in sys.stdin if ip.strip()]))")

code=$(curl -s -o /tmp/gd.out -w '%{http_code}' -X PUT \
  "https://api.godaddy.com/v1/domains/$DOMAIN/records/A/@" \
  -H "Authorization: $AUTH" -H 'Content-Type: application/json' \
  -d "$BODY")
echo "A @      -> HTTP $code"
[ "$code" = "200" ] || { echo "  $(head -c 300 /tmp/gd.out)"; show_manual; exit 1; }

code=$(curl -s -o /tmp/gd2.out -w '%{http_code}' -X PUT \
  "https://api.godaddy.com/v1/domains/$DOMAIN/records/CNAME/www" \
  -H "Authorization: $AUTH" -H 'Content-Type: application/json' \
  -d '[{"data":"aisoundz.github.io","ttl":3600}]')
echo "CNAME www -> HTTP $code"

echo "Records written. Handing over to the watcher — it will turn HTTPS on when the cert issues."
exec bash "$0" --watch
