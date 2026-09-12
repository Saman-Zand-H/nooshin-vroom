#!/usr/bin/env python3
"""Small no-secret GitHub push receiver for the private vroom server."""

import json
import os
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REPOSITORY = "Saman-Zand-H/nooshin-vroom"
DEPLOY_SCRIPT = "/opt/nooshin-vroom/deploy/deploy.sh"
SHA_RE = re.compile(r"^[0-9a-f]{40}$")


class Handler(BaseHTTPRequestHandler):
    def _reply(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):  # noqa: N802
        if self.path != "/pushed/":
            self._reply(404, {"error": "not found"})
            return
        if self.headers.get_content_type() != "application/json":
            self._reply(415, {"error": "application/json required"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 1_000_000:
                raise ValueError
            payload = json.loads(self.rfile.read(length))
            repository = payload.get("repository", {}).get("full_name")
            ref = payload.get("ref")
            after = payload.get("after")
        except (ValueError, TypeError, json.JSONDecodeError):
            self._reply(400, {"error": "invalid JSON payload"})
            return
        if repository != REPOSITORY or ref != "refs/heads/master" or not SHA_RE.fullmatch(str(after)):
            self._reply(202, {"accepted": False})
            return
        with open("/var/log/nooshin-vroom-deploy.log", "ab", buffering=0) as log:
            subprocess.Popen(
                [DEPLOY_SCRIPT, str(after)],
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
                env={**os.environ, "GITHUB_SHA": str(after)},
            )
        self._reply(202, {"accepted": True, "after": after})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 9000), Handler).serve_forever()
