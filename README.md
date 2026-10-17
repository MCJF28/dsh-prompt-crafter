# dsh-prompt-optimizer

English | [中文](./README.zh.md)

An **Optimize** button next to the send key: write a draft, press it once, and let the model rewrite it into a prompt that is easier to execute well.

## Usage

1. Type whatever you want to say (it can be rough)
2. Press the button
3. The draft is replaced with the rewritten version — send it, or undo with Ctrl+Z

While working the button reads "Optimizing…". On failure the reason appears above it and disappears after 5 seconds.

## Three levels

Settings → Optimize:

| Level | What it does |
|---|---|
| **Brief** | Only fixes grammar and unclear references; structure stays |
| **Balanced** (default) | Fills in vague spots, states the expected output and constraints, keeps the length roughly the same |
| **Detailed** | Breaks the task down, adds background, steps, constraints and acceptance criteria |
| **Custom** | Write the system prompt yourself; leaving it empty falls back to Balanced |

### One deliberate design choice

All three levels first **classify the input**: acknowledgements, thanks, small talk and simple questions stay as short as they were; only task requests are expanded according to the level.

Without that rule, "ok, good job" gets rewritten by Detailed into a full document with goals, background, steps, constraints and acceptance criteria — which is just noise inserted into your prompt.

Beyond the prompt itself there is an engineering backstop: when a short, non-task input produces an output far longer than itself, the plugin retries once with Brief.

## Model

"Model for optimization" under Settings → Optimize:

- **Automatic** (default): follow the model the current conversation is using
- **Manual**: pin one model, chosen from the full model list

Automatic mode works by listening to `agent/request` and recording the route each conversation actually calls. That is the only way to reach "the model this conversation is using" from an HTTP route — `agents.currentInitiator()` only works inside the model call chain, and `sessions.binding()` is unavailable in the browser context.

The settings page shows "last actual call". That value is recorded by code, so it can be used to verify routing — a model's self-description is not reliable.

## Install

```bash
pnpm add github:MCJF28/dsh-prompt-optimizer
```

Then add `dsh-prompt-optimizer` to `dsh.profile.bundles` and restart the app.

## Storage

`~/.dsh/prompt-optimizer/settings.json`
