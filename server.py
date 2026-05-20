#!/usr/bin/env python3
import base64
import hmac
import json
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class DashboardHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if not self.is_authorized():
            self.request_auth()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if not self.is_authorized():
            self.request_auth()
            return

        if self.path != "/api/generate":
            self.send_error(404, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            api_key = payload.get("apiKey") or os.environ.get("OPENAI_API_KEY")
            model = payload.get("model") or "gpt-5.4"
            prompt = (payload.get("prompt") or "").strip()
            transcript = (payload.get("transcript") or "").strip()
            title = (payload.get("title") or "").strip()

            if not api_key:
                self.write_json({"error": "Add an OpenAI API key first."}, 400)
                return
            if not prompt:
                self.write_json({"error": "Add a prompt first."}, 400)
                return
            if not transcript:
                self.write_json({"error": "Add a transcript first."}, 400)
                return

            compiled_prompt = (
                prompt.replace("{{transcript}}", transcript)
                if "{{transcript}}" in prompt
                else f"{prompt}\n\nClinical transcript:\n{transcript}"
            )
            if title:
                compiled_prompt = f"Case: {title}\n\n{compiled_prompt}"

            request_payload = {
                "model": model,
                "input": [
                    {
                        "role": "developer",
                        "content": (
                            "You are helping with prompt engineering interview practice. "
                            "Follow the user's prompt exactly, ground clinical claims in the transcript, "
                            "and clearly mark uncertainty. Do not invent clinical facts."
                        ),
                    },
                    {"role": "user", "content": compiled_prompt},
                ],
            }

            request = urllib.request.Request(
                "https://api.openai.com/v1/responses",
                data=json.dumps(request_payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                data = json.loads(response.read().decode("utf-8"))

            text = data.get("output_text") or self.extract_response_text(data)
            self.write_json({"output": text, "usage": data.get("usage")})
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            self.write_json({"error": message or str(exc)}, exc.code)
        except Exception as exc:
            self.write_json({"error": str(exc)}, 500)

    def extract_response_text(self, data):
        chunks = []
        for item in data.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in {"output_text", "text"} and content.get("text"):
                    chunks.append(content["text"])
        return "\n".join(chunks).strip()

    def write_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def is_authorized(self):
        password = os.environ.get("DASHBOARD_PASSWORD")
        if not password:
            return True

        header = self.headers.get("Authorization", "")
        if not header.startswith("Basic "):
            return False
        try:
            decoded = base64.b64decode(header.removeprefix("Basic ").strip()).decode("utf-8")
        except Exception:
            return False
        _, _, supplied = decoded.partition(":")
        return hmac.compare_digest(supplied, password)

    def request_auth(self):
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="Prompt Dashboard"')
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"Authentication required.")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4173"))
    host = os.environ.get("HOST") or ("0.0.0.0" if os.environ.get("RENDER") else "127.0.0.1")
    server = ThreadingHTTPServer((host, port), DashboardHandler)
    print(f"Serving dashboard at http://{host}:{port}/index.html")
    server.serve_forever()
