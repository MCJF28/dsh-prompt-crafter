# dsh-prompt-crafter

<a id="chinese"></a>

**中文** | [English](#english)

输入框右侧的「优化」按钮：写完一段话按一下，让模型把它改写成更容易被执行好的提示词。

**完全免费。** 插件自带一个免费模型通道，装好即用，不需要任何账号、API Key 或付费——你发送的每一条优化请求都不消耗对话额度。免费通道不可用时自动回退到你当前对话的模型，功能永远不会因为免费通道挂掉而失效。

## 用法

1. 在输入框写下你想说的话（可以很随意）
2. 点按钮
3. 草稿被替换成改写后的版本，可以直接发送，也可以 Ctrl+Z 撤销

优化期间按钮显示「优化中…」，失败时上方弹出原因，5 秒后自动消失。

## 三档力度

设置 → 优化里可选：

| 档位 | 做什么 |
|---|---|
| **精简** | 只修语病和指代不清，几乎不改结构 |
| **均衡**（默认） | 补齐含糊处，明确产出与约束，长度相当 |
| **详细** | 把任务拆细讲透，补背景、步骤、约束、验收标准 |
| **自定义** | 完全自己写系统提示词，留空则回退到均衡 |

### 一个刻意的设计

三档都先做**性质判断**：确认 / 道谢 / 闲聊 / 简单提问 → 保持原样那么短；只有任务要求才按档位加码。

没有这条规则时，「ok，完成的很好」会被「详细」档扩写成带目标、背景、步骤、约束、验收标准的一整篇文档——那只是把噪声写进了提示词。

除了提示词，还有一道工程兜底：短的非任务输入配上了远超它的输出时，自动改用「精简」档重试一次。

## 模型：三选一

设置 → 优化里的「优化用的模型」：

| 选项 | 做什么 |
|---|---|
| **免费通道**（标着「优先」） | 走插件内置的免费模型，**零成本、无需配置**；打开设置页会自动测试连通性，也可以手动重测 |
| **自动** | 跟随当前对话正在使用的模型 |
| **手动** | 固定用一个模型，从完整模型列表里选 |

**免费通道的免费是字面意义的免费**：插件内置了一个公开的模型端点，所有安装者共用，你不花一分钱，也不需要注册任何服务。作为交换，它有额度上限、可能偶尔拥挤——所以它失败时自动改用你当前对话的模型跑完，设置页会显示回退原因。

连通性测试：选中「免费通道」后，设置页会发一句 `Hi` 给免费通道，显示耗时和回复。这是端到端验证——绿点表示真的收到了模型回应，不是空连接。

想换成自己的额度（更稳、更快），用环境变量覆盖即可：

```bash
DSH_FREE_CHANNEL_BASE_URL=https://your-endpoint/v1
DSH_FREE_CHANNEL_API_KEY=sk-...
DSH_FREE_CHANNEL_MODEL=your-model
```

自动模式靠监听 `agent/request` 事件记下每个会话实际调用的路由。这是唯一能在 HTTP 路由里拿到「当前对话模型」的入口——`agents.currentInitiator()` 只在模型调用链里有效，`sessions.binding()` 在浏览器上下文不可用。

设置页会显示「上次实际调用」，这个值由代码记录，可以用来核实路由（模型自述自己是谁并不可靠）。

## 安装

**推荐：内置插件安装程序。** 打开「设置 → 内置插件」，粘贴包名，点安装，再重启应用：

```
dsh-prompt-crafter
```

安装程序会自动写进 `dsh.profile.bundles`，不用手改任何文件。

命令行方式（先完全退出应用）：

```bash
cd ~/.dsh/profiles/desktop
pnpm add dsh-prompt-crafter
```

然后把包名加进 `dsh.profile.bundles`，重启应用。

## 存储

`~/.dsh/prompt-optimizer/settings.json`

---

<a id="english"></a>

**English** | [中文](#chinese)

An **Optimize** button next to the send key: write a draft, press it once, and let the model rewrite it into a prompt that is easier to execute well.

**Completely free.** The plugin ships with a free model channel that works out of the box — no account, no API key, no payment. Every optimization request costs you nothing from your conversation budget, and if the free channel is unavailable, the plugin falls back to your current conversation's model automatically. The button never stops working because the free channel did.

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

## Model: three choices

"Model for optimization" under Settings → Optimize:

| Option | What it does |
|---|---|
| **Free channel** (tagged "priority") | Uses the bundled free model — **zero cost, zero configuration**. Opening the settings page probes connectivity automatically; you can re-test manually |
| **Automatic** | Follow the model the current conversation is using |
| **Manual** | Pin one model, chosen from the full model list |

**The free channel is free in the literal sense**: the plugin embeds a public model endpoint shared by all installers. You pay nothing and sign up for nothing. In exchange it has quota limits and can get crowded — so when it fails, the optimization continues on your current conversation's model, and the settings page shows why.

Connectivity probe: selecting "Free channel" sends a literal `Hi` to the endpoint and reports the round-trip latency and the reply. That is end-to-end verification — a green dot means a real model response came back, not just an open socket.

To use your own quota instead (more stable, faster), override it with environment variables:

```bash
DSH_FREE_CHANNEL_BASE_URL=https://your-endpoint/v1
DSH_FREE_CHANNEL_API_KEY=sk-...
DSH_FREE_CHANNEL_MODEL=your-model
```

Automatic mode works by listening to `agent/request` and recording the route each conversation actually calls. That is the only way to reach "the model this conversation is using" from an HTTP route — `agents.currentInitiator()` only works inside the model call chain, and `sessions.binding()` is unavailable in the browser context.

The settings page shows "last actual call". That value is recorded by code, so it can be used to verify routing — a model's self-description is not reliable.

## Install

**The built-in plugin installer is the recommended way.** Open Settings → Built-in Plugins, paste the package name, press install, then restart the app:

```
dsh-prompt-crafter
```

The installer writes the entry into `dsh.profile.bundles` for you; no manual file edits.

From the command line (quit the app completely first):

```bash
cd ~/.dsh/profiles/desktop
pnpm add dsh-prompt-crafter
```

Add the package name to `dsh.profile.bundles` and restart the app.

## Storage

`~/.dsh/prompt-optimizer/settings.json`
