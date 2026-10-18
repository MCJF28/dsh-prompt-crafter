# dsh-prompt-enhancer

<a id="chinese"></a>

**中文** | [English](#english)

输入框右侧的「优化」按钮：写完一段话按一下，让模型把它改写成更容易被执行好的提示词。

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

## 模型

设置 → 优化里的「优化用的模型」：

- **自动**（默认）：跟随当前对话正在使用的模型
- **手动**：固定用一个模型，从完整模型列表里选

自动模式靠监听 `agent/request` 事件记下每个会话实际调用的路由。这是唯一能在 HTTP 路由里拿到「当前对话模型」的入口——`agents.currentInitiator()` 只在模型调用链里有效，`sessions.binding()` 在浏览器上下文不可用。

设置页会显示「上次实际调用」，这个值由代码记录，可以用来核实路由（模型自述自己是谁并不可靠）。

## 安装

**推荐：内置插件安装程序。** 打开「设置 → 内置插件」，粘贴包名，点安装，再重启应用：

```
dsh-prompt-enhancer
```

安装程序会自动写进 `dsh.profile.bundles`，不用手改任何文件。

命令行方式（先完全退出应用）：

```bash
cd ~/.dsh/profiles/desktop
pnpm add dsh-prompt-enhancer
```

然后把包名加进 `dsh.profile.bundles`，重启应用。


## 存储

`~/.dsh/prompt-optimizer/settings.json`

---

<a id="english"></a>

**English** | [中文](#chinese)

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

**The built-in plugin installer is the recommended way.** Open Settings → Built-in Plugins, paste the package name, press install, then restart the app:

```
dsh-prompt-enhancer
```

The installer writes the entry into `dsh.profile.bundles` for you; no manual file edits.

From the command line (quit the app completely first):

```bash
cd ~/.dsh/profiles/desktop
pnpm add dsh-prompt-enhancer
```

Add the package name to `dsh.profile.bundles` and restart the app.


## Storage

`~/.dsh/prompt-optimizer/settings.json`
