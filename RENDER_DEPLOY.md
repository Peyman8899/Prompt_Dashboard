# Render Deployment

This dashboard is ready to deploy as a Render Web Service.

## Recommended Settings

- Service type: Web Service
- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `python server.py`

Render provides the `PORT` environment variable automatically. The server binds to `0.0.0.0` when running on Render.

## Environment Variables

Set these in Render, not in source code:

- `OPENAI_API_KEY`: your OpenAI API key
- `DASHBOARD_PASSWORD`: a shared password for opening the dashboard

With `DASHBOARD_PASSWORD` set, visitors see a browser login prompt. The username can be anything; the password must match this value.

## Deploy Flow

1. Push this folder to a GitHub repository.
2. In Render, choose **New** → **Blueprint** or **Web Service**.
3. Connect the GitHub repository.
4. If using Blueprint, Render reads `render.yaml`.
5. Add `OPENAI_API_KEY` and `DASHBOARD_PASSWORD` when Render asks for environment variables.
6. Deploy.

After deploy, Render gives you a stable `https://...onrender.com` URL.
