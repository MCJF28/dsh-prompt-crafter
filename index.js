/**
 * dsh-prompt-enhancer —— Host 半区
 *
 * 两部分：
 *   1. `/optimize`：接收输入框草稿，调用模型改写成更好的提示词，返回文本。
 *      客户端在发送键左侧放按钮调用它。
 *   2. `/settings`：读写本插件的设置（用哪个模型、用哪档提示词）。
 *      客户端在「设置」里放一页界面编辑它。
 *
 * 为什么不用工具（tool）：这是用户主动触发的编辑动作，发生在输入框里，
 * 与对话轮次无关；工具只能被模型调用，无法被按钮直接触发。
 *
 * 模型选择有两档：
 *   - auto（默认）：跟随当前对话实际使用的模型，由 `agent/request` 事件记录；
 *   - manual：用户指定的 provider/model。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'dsh-prompt-enhancer'

/** 需要的服务：LLM 调用 + HTTP 路由。 */
export const inject = ['llm', 'webServer']

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const PROFILE_DIR = process.env.DSH_PROFILE_DIR
  || join(DSH_HOME, 'profiles', process.env.DSH_PROFILE || 'desktop')

/** 设置文件：跟插件放在一起，卸载时一并清理。 */
const SETTINGS_DIR = join(DSH_HOME, 'prompt-optimizer')
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json')

/** 待优化文本的长度上限，防止把整篇文档塞进一次改写请求。 */
const MAX_INPUT_CHARS = 20000

/**
 * 三档预设提示词。
 *
 * 三档的差别只在「改写力度」，但都受同一条前置判断约束：
 * 先看输入是「确认/闲聊/简单提问」还是「任务要求」，只有后者才值得加码。
 *   brief   —— 只修语病与指代，几乎不动结构；
 *   balanced—— 补齐含糊处，明确产出与约束，长度相当（默认）；
 *   detailed—— 把任务拆细讲透（仅任务类输入）。
 *
 * 公共约束单独写在 COMMON 里，避免三段重复。
 *
 * 为什么这条前置判断是必须的：早期版本让 detailed 无条件"补背景、拆步骤、
 * 给验收标准"，结果用户输入「ok，完成的很好」这样一句确认，
 * 被扩写成带目标/背景/步骤/约束/验收标准的整篇文档 —— 完全是噪声。
 */
const COMMON = [
  '公共规则（三档都适用，优先级高于本档的其它要求）：',
  '1. 输出必须是纯文本。这段文字会被直接放进一个纯文本输入框，',
  '   其中不支持也不渲染 Markdown，所以一切 Markdown 语法都会原样显示成符号噪声。',
  '   因此：不要用星号做加粗或斜体，不要用井号做标题，不要用反引号包住代码，',
  '   不要用三个反引号做代码块，不要用行首的横线或星号做列表，',
  '   不要用竖线做表格，不要用三个横线做分隔线，不要写方括号配圆括号的链接。',
  '   需要分层时用纯文本序号：中文的「一、二、三」或阿拉伯数字「1. 2. 3.」；',
  '   需要小标题时写成「目标：」「约束：」这样的冒号形式，或者用方头括号括住关键词。',
  '2. 先判断用户这段话是什么性质，再决定改写力度：',
  '   a) 确认 / 道谢 / 赞叹 / 闲聊 / 简单反馈（例如「好的」「完成得很好」「谢谢」）',
  '      → 它本身就不是任务说明，保持原样那么短，最多润色一两个字，',
  '        绝不加标题、分点、背景、步骤、约束或验收标准；',
  '   b) 简单提问 → 保持一问一答的简洁，只把指代和范围写清楚；',
  '   c) 任务要求（要 AI 做某件事、产出某个东西）',
  '      → 才按本档规则改写。',
  '3. 改写的目标是让 AI 更容易理解，不是让文字变长变正式。',
  '   原文一句话，输出就该是一两句话，除非它是 c) 类任务。',
  '4. 不要凭空造结构。原文没有的信息不要用「（待补充）」「（此处填写）」之类的',
  '   占位符硬撑格式 —— 那只是把噪声写进了提示词。缺什么就少写什么。',
  '5. 只输出改写后的提示词正文，不要任何解释、前言或引号。',
  '6. 不要输出「以下是优化后的提示词」这类套话，直接给正文。',
  '7. 保持用户原本的语言（中文输入就输出中文，英文输入就输出英文）。',
].join('\n')

const STYLE_ITEMS = [
  {
    id: 'brief',
    label: '精简',
    summary: '只修语病和指代不清，几乎不改结构',
    prompt: [
      '你是一个提示词改写器。用户会给你一段他们准备发给 AI 的文字。',
      '这一档的目标是「克制」：做最小必要修改，让原文更通顺、指代更清楚即可。',
      '',
      '做法：',
      '1. 修正错别字、语病、断句混乱；',
      '2. 把「这个」「那个」「它」这类没有明确所指的代词换成具体对象；',
      '3. 把明显含糊的数量或范围补成具体的（例如「一些」→「3 个」），但只在上下文支持时这样做；',
      '4. 不重新组织结构，不增加新的要求，不补充背景；',
      '5. 改写后长度接近原文，最多不超过原文的 1.3 倍。',
      '',
      COMMON,
    ].join('\n'),
  },
  {
    id: 'balanced',
    label: '均衡',
    summary: '补齐含糊处，明确产出与约束，长度相当',
    prompt: [
      '你是一个提示词改写器。用户会给你一段他们准备发给 AI 的文字。',
      '这一档的目标是「更好用」：在不改变意图的前提下，让 AI 更容易一次做对。',
      '',
      '做法（只对「任务要求」类的输入执行）：',
      '1. 补齐含糊之处：把指代写清楚，把模糊的范围写成具体范围；',
      '2. 明确指出期望产出（文件、代码、回答、清单等）与约束条件；',
      '3. 把并列、有先后关系的步骤整理成清晰的顺序或分点；',
      '4. 去掉与目标无关的枝节表述；',
      '5. 改写后长度与原文大致相当，最多不超过原文的 2 倍；',
      '6. 如果原文已经足够清晰，就只做最小改动，不要为了改写而改写。',
      '',
      '对于确认、闲聊、简单提问这类输入，不要套用上面的做法，按公共规则第 2 条保持简短即可。',
      '',
      COMMON,
    ].join('\n'),
  },
  {
    id: 'detailed',
    label: '详细',
    summary: '把任务拆细讲透；非任务类输入保持简短',
    prompt: [
      '你是一个提示词改写器。用户会给你一段他们准备发给 AI 的文字。',
      '这一档的目标是「把任务说透」：让一份任务说明完整到可以直接执行、可以验收。',
      '',
      '重要：这一档只对「任务要求」类输入展开。',
      '如果用户输入的是一句确认、道谢、闲聊或简单提问，',
      '就按公共规则第 2 条处理 —— 保持一到三句，不要扩写成文档。',
      '把「好的，完成得很好」改写成带目标、背景、步骤、约束、验收标准的长文，',
      '是这一档最典型的错误，必须避免。',
      '',
      '当输入确实是任务要求时，按需补以下要素（有信息才写，没信息就跳过）：',
      '1. 目标：这段提示词要得到什么结果；',
      '2. 背景：原文隐含的上下文，把它显式写出来；',
      '3. 步骤：有先后关系的写成有序步骤，并行的写成并列项；',
      '4. 约束：范围、格式、语言、长度、禁止事项、边界情况；',
      '5. 验收标准：怎样算做完了、怎样算做对了；',
      '6. 分层方式用纯文本：小标题写成「目标：」「约束：」这样的冒号形式，',
      '   条目用阿拉伯数字或中文序号，不要用 Markdown 的井号、星号或横线列表；',
      '7. 允许比原文长，但每一句都要有信息量；宁可短而准，不要长而空。',
      '',
      COMMON,
    ].join('\n'),
  },
]

/** 默认设置。auto + balanced 是「不用配置也能用」的组合。 */
const DEFAULT_SETTINGS = {
  /** 'auto' 跟随当前对话 · 'manual' 固定一个 · 'free' 优先免费通道 */
  modelMode: 'auto',
  provider: '',
  model: '',
  style: 'balanced',
  customPrompt: '',
  /** 是否已经问过用户要不要用免费通道（首次安装时弹一次窗）。 */
  freeChannelAsked: false,
}

/**
 * 免费通道：一个 OpenAI 兼容端点。
 *
 * 它是「零配置」的那条路：用户不必自己选模型，开箱就能优化。
 * 但免费通道可能随时不可用（额度、网络、上游故障），所以**永远作为首选而非唯一**：
 * 调用失败或返回空时静默回退到当前对话正在用的模型，用户不会因此用不了这个按钮。
 *
 * 凭据内置在这里，等于对所有安装者公开 —— 这是「免费通道」这个产品的取舍，
 * 因此也提供 API Key 环境变量覆盖，方便换成自己的额度。
 */
const FREE_CHANNEL = {
  baseURL: process.env.DSH_FREE_CHANNEL_BASE_URL || 'https://api.hcnsec.cn/v1',
  apiKey: process.env.DSH_FREE_CHANNEL_API_KEY
    || 'sk-KF7KZR2M9xwq1rve7j7N0KYGgbmDfrwwuxrf2CI9Bvd7olPP',
  model: process.env.DSH_FREE_CHANNEL_MODEL || 'DeepSeek-V4-Flash',
  timeoutMs: 60000,
}

const STYLE_IDS = new Set(STYLE_ITEMS.map((item) => item.id).concat('custom'))

/**
 * 每个会话最近一次实际使用的模型。
 *
 * 为什么需要它：HTTP 路由里拿不到「当前对话正在用的模型」——
 *   `agents.currentInitiator()` 只在模型调用链里有效；
 *   `sessions.binding()` 在浏览器上下文不可用；
 *   模型选择器的状态在 slot inject 里，插件读不到。
 *
 * 但有一处能拿到：**模型发起请求时会经过 `agent/request` 事件**，
 * 那里带着本次调用的完整路由。把它按会话记下来即可。
 */
const routeBySession = new Map()

/** 当前设置（内存副本，写盘后更新）。 */
let settings = { ...DEFAULT_SETTINGS }

/**
 * 最后一次优化实际调用的路由。
 *
 * 设置页把它显示出来，是用来**核实**路由的：这个值由代码记录，
 * 不是模型自述。模型说自己是谁并不可靠（很多国产模型在训练数据里
 * 见过大量 GPT 的自称，会张冠李戴），但请求发给了哪个 provider、哪个 model，
 * 只有这里记录的是真的。
 */
let lastUsed = undefined

function loadSettings() {
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
    if (parsed === null || typeof parsed !== 'object') return
    settings = normalizeSettings(parsed)
  } catch {
    /* 文件不存在或损坏：用默认值 */
  }
}

function normalizeSettings(input) {
  const raw = input !== null && typeof input === 'object' ? input : {}
  // 三选一：auto 跟随对话 / manual 固定模型 / free 优先免费通道。
  // 兼容旧版布尔开关：曾经用 freeChannel:true 表示免费通道。
  let modelMode = 'auto'
  if (raw.modelMode === 'manual') modelMode = 'manual'
  else if (raw.modelMode === 'free') modelMode = 'free'
  else if (raw.modelMode === 'auto') modelMode = 'auto'
  else if (raw.freeChannel === true) modelMode = 'free'

  const style = typeof raw.style === 'string' && STYLE_IDS.has(raw.style) ? raw.style : 'balanced'
  return {
    modelMode,
    provider: typeof raw.provider === 'string' ? raw.provider : '',
    model: typeof raw.model === 'string' ? raw.model : '',
    style,
    customPrompt: typeof raw.customPrompt === 'string' ? raw.customPrompt : '',
    freeChannelAsked: raw.freeChannelAsked === true,
  }
}

function saveSettings() {
  try {
    mkdirSync(SETTINGS_DIR, { recursive: true })
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, undefined, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

/** 从 profile 的 patch 里读默认模型（最后兜底）。 */
function modelFromPatch() {
  try {
    const text = readFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), 'utf8')
    const idx = text.indexOf('agent-default-model')
    if (idx < 0) return undefined
    const rest = text.slice(idx, idx + 400)
    const provider = /provider:\s*["']?([\w.-]+)["']?/u.exec(rest)
    const model = /model:\s*["']?([\w.-]+)["']?/u.exec(rest)
    if (provider === null || model === null) return undefined
    return { provider: provider[1], model: model[1] }
  } catch {
    return undefined
  }
}

/** 按当前设置决定用哪份系统提示词。 */
function systemPromptFor(current) {
  if (current.style === 'custom') {
    const custom = current.customPrompt.trim()
    if (custom.length > 0) return custom
    // 自定义为空时退回均衡档，避免把空字符串当系统提示发出去。
    return STYLE_ITEMS.find((item) => item.id === 'balanced').prompt
  }
  const found = STYLE_ITEMS.find((item) => item.id === current.style)
  return (found ?? STYLE_ITEMS[1]).prompt
}

/**
 * 任务类输入的特征词。
 *
 * 用途只有一个：这类输入**本来就该展开**，不该被长度判据误伤。
 * 「帮我写一个登录页」只有 8 个字，详细档展开成 500 字是合理的；
 * 「ok，完成的很好」同样只有 9 个字，展开成 500 字就是噪声。
 * 区分二者的唯一可靠信号是——它是不是在要求做一件事。
 */
const TASK_HINT = /(写|做|实现|创建|新建|生成|修改|重构|修复|优化|分析|解释|翻译|转换|整理|列出|设计|搭建|配置|安装|部署|检查|评审|对比|总结|拆解|梳理|帮我|帮忙|请帮|如何|怎么|为什么|能否|可以帮|write|create|build|make|fix|refactor|explain|analy|implement|design)/iu

/**
 * 判断改写是否"把一句话扩成了一篇文档"。
 *
 * 这是提示词之外的工程兜底：就算提示词写清楚了，模型仍可能不受控地加码。
 * 只抓最刺眼的那种失控 —— 非任务类的短输入配上了远超它的输出。
 *
 * 阈值故意放宽，因为误伤（把该展开的任务压短）比漏放更烦人：
 *   - 极短输入（≤ 60 字）输出超过 400 字且超过原文 8 倍；
 *   - 或输出超过原文 12 倍且超过 1200 字。
 */
function looksOverExpanded(source, result) {
  const s = source.trim()
  const r = result.trim().length
  if (s.length === 0 || r === 0) return false
  // 任务类输入本来就该展开，直接放行。
  if (TASK_HINT.test(s)) return false
  if (s.length <= 60 && r > 400 && r > s.length * 8) return true
  if (r > s.length * 12 && r > 1200) return true
  return false
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * 调一次免费通道，返回纯文本。
 *
 * 走 OpenAI 兼容的 /chat/completions，非流式：这个按钮要的是「一次替换掉输入框」，
 * 流式反而会让草稿逐字变化，体验更差。
 * 任何异常都向上抛，由调用方决定回退 —— 这里不吞错，否则没法在设置页显示原因。
 */
async function callFreeChannel(system, input) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FREE_CHANNEL.timeoutMs)
  try {
    const response = await fetch(`${FREE_CHANNEL.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FREE_CHANNEL.apiKey}`,
      },
      body: JSON.stringify({
        model: FREE_CHANNEL.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: input },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`免费通道 HTTP ${response.status}${detail ? '：' + detail.slice(0, 120) : ''}`)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    return typeof content === 'string' ? content.trim() : ''
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`免费通道超时（${FREE_CHANNEL.timeoutMs / 1000}s）`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** 从流式响应里拼出完整文本。 */
async function collectText(stream) {
  let out = ''
  for await (const chunk of stream) {
    if (chunk === null || chunk === undefined) continue
    // text-delta 是增量文本块；兜底再认一次整块 text。
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
      out += chunk.text
      continue
    }
    if (chunk.type === 'text' && typeof chunk.text === 'string') {
      out += chunk.text
    }
  }
  return out
}

loadSettings()

export function apply(ctx) {
  /**
   * 记录每个会话实际使用的模型（供 auto 档使用）。
   *
   * `agent/request` 是 waterfall：必须 return next()，否则截断整条请求链。
   */
  ctx.on('agent/request', async (payload, next) => {
    const config = await next()
    const sessionId = payload?.agent?.session?.id ?? payload?.agent?.id
    if (sessionId !== undefined
      && typeof config?.provider === 'string'
      && typeof config?.model === 'string') {
      routeBySession.set(String(sessionId), { provider: config.provider, model: config.model })
    }
    return config
  })

  ctx.on('agent/disposed', ({ agent }) => {
    const sessionId = agent?.session?.id ?? agent?.id
    if (sessionId !== undefined) routeBySession.delete(String(sessionId))
  })

  /** 列出所有可选模型，供手动选择。取不到就返回空列表，不阻塞设置页。 */
  async function listAllModels() {
    const out = []
    let providers = []
    try {
      providers = ctx.llm.listProviders()
    } catch {
      return out
    }
    // 并行取每个 provider 的模型清单；单个失败不影响整体。
    const groups = await Promise.all(providers.map(async (info) => {
      try {
        const models = await ctx.llm.listModels(info.id)
        return models.map((model) => ({
          provider: info.id,
          providerName: info.name,
          model: model.id,
          name: model.name ?? model.id,
        }))
      } catch {
        return []
      }
    }))
    for (const group of groups) out.push(...group)
    return out
  }

  /** 解析实际要用的模型：manual 用设置里的，auto 按会话/兜底链取。 */
  function resolveRoute(sessionId, agent) {
    const current = settings
    if (current.modelMode === 'manual'
      && current.provider.length > 0
      && current.model.length > 0) {
      return { provider: current.provider, model: current.model, source: 'manual' }
    }

    // auto：优先用这个会话实际在跑的模型。
    if (sessionId.length > 0) {
      const remembered = routeBySession.get(sessionId)
      if (remembered !== undefined) return { ...remembered, source: 'session' }
    }

    try {
      const rc = agent?.session?.requestContext?.()
      if (rc !== undefined && typeof rc.provider === 'string' && typeof rc.model === 'string') {
        return { provider: rc.provider, model: rc.model, source: 'session' }
      }
    } catch {
      /* 忽略 */
    }
    try {
      const opts = agent?.options
      if (opts !== undefined && typeof opts.provider === 'string' && typeof opts.model === 'string') {
        return { provider: opts.provider, model: opts.model, source: 'session' }
      }
    } catch {
      /* 忽略 */
    }
    try {
      const selection = ctx.get?.('agentDefaultModel')?.currentSelection?.()
      if (selection !== undefined
        && typeof selection.provider === 'string'
        && typeof selection.model === 'string') {
        return { provider: selection.provider, model: selection.model, source: 'default' }
      }
    } catch {
      /* 忽略 */
    }
    const fromPatch = modelFromPatch()
    return fromPatch === undefined ? undefined : { ...fromPatch, source: 'config' }
  }

  // ── 设置读写 ────────────────────────────────────────────────────────────

  ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-prompt-enhancer/settings',
    handler: async (req, res) => {
      try {
        if (req.method === 'POST' || req.method === 'PUT') {
          const body = JSON.parse((await readBody(req)) || '{}')
          settings = normalizeSettings({ ...settings, ...body })
          const saved = saveSettings()
          res.writeHead(200, JSON_HEADERS)
          res.end(JSON.stringify({ ok: true, saved, settings, styles: STYLE_ITEMS }))
          return
        }

        const models = await listAllModels()

        // 设置页带上当前会话 id 时，就能算出「自动模式此刻会真正调用哪个模型」。
        // 这个值由代码推导（读 agent/request 记录与配置），**不是模型自述**，
        // 因此可以用来核实路由，而不受模型"自称 GPT"这类训练数据错觉的影响。
        const url = new URL(req.url ?? '/', 'http://localhost')
        const sessionId = url.searchParams.get('sessionId') ?? ''
        const knownSession = sessionId.length > 0 && routeBySession.has(sessionId)

        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify({
          ok: true,
          settings,
          styles: STYLE_ITEMS,
          models,
          resolved: resolveRoute(sessionId, undefined),
          hasSession: sessionId.length > 0,
          sessionKnown: knownSession,
          lastUsed,
          // 免费通道的展示信息（不返回 API Key）
          freeChannel: {
            model: FREE_CHANNEL.model,
            baseURL: FREE_CHANNEL.baseURL,
          },
        }))
      } catch (error) {
        res.writeHead(500, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }))
      }
    },
  })

  // ── 优化 ────────────────────────────────────────────────────────────────

  ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-prompt-enhancer/optimize',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          res.writeHead(405, JSON_HEADERS)
          res.end(JSON.stringify({ ok: false, error: '只支持 POST' }))
          return
        }

        const parsed = JSON.parse((await readBody(req)) || '{}')
        const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
        if (text.length === 0) {
          res.writeHead(400, JSON_HEADERS)
          res.end(JSON.stringify({ ok: false, error: '输入为空，没有可优化的内容' }))
          return
        }
        if (text.length > MAX_INPUT_CHARS) {
          res.writeHead(400, JSON_HEADERS)
          res.end(JSON.stringify({
            ok: false,
            error: `内容过长（${text.length} 字符），请精简到 ${MAX_INPUT_CHARS} 以内`,
          }))
          return
        }

        const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : ''
        let agent
        if (sessionId.length > 0) {
          try {
            agent = ctx.sessions?.binding?.(sessionId)?.agent
          } catch {
            /* 忽略 */
          }
        }
        if (agent === undefined) {
          try {
            agent = ctx.agents?.currentInitiator?.()
          } catch {
            /* 忽略 */
          }
        }

        /**
         * 尝试一次改写。
         *
         * 顺序：免费通道（若用户开启）→ 当前对话的模型。
         * 免费通道失败不报错、不打断，只把原因记下来给设置页显示，
         * 然后照常用会话模型跑完 —— 用户按下按钮就该拿到结果。
         */
        const enhanceOnce = async (system, input) => {
          let freeError
          if (settings.modelMode === 'free') {
            try {
              const out = await callFreeChannel(system, input)
              if (out.length > 0) return { text: out, usedFree: true }
              freeError = '免费通道返回空内容'
            } catch (error) {
              freeError = String(error?.message ?? error)
            }
          }

          const route = resolveRoute(sessionId, agent)
          if (route === undefined) {
            throw new Error(freeError
              ? `免费通道不可用（${freeError}），且取不到当前对话的模型`
              : '取不到可用模型。请到「设置 → 优化」选择模型，或先在「设置 → 模型」里选一个。')
          }

          const stream = ctx.llm.stream({
            provider: route.provider,
            model: route.model,
            system,
            messages: [{ role: 'user', content: [{ type: 'text', text: input }] }],
            maxTokens: 4096,
          })
          return { text: (await collectText(stream)).trim(), usedFree: false, freeError, route }
        }

        const first = await enhanceOnce(systemPromptFor(settings), text)
        let optimized = first.text
        let usedFree = first.usedFree
        if (optimized.length === 0) {
          res.writeHead(502, JSON_HEADERS)
          res.end(JSON.stringify({ ok: false, error: '模型没有返回内容，请重试' }))
          return
        }

        // 工程兜底：提示词改好了，但仍不排除模型把一句话扩成文档。
        // 判据 —— 短输入配上了远超它的输出：这说明改写方向跑偏了。
        // 此时改用最克制的「精简」档重试一次；取更短的结果，避免把噪声交给用户。
        let recovered = false
        if (looksOverExpanded(text, optimized)) {
          const briefPrompt = STYLE_ITEMS.find((item) => item.id === 'brief').prompt
          const retry = await enhanceOnce(briefPrompt, text)
          if (retry.text.length > 0 && retry.text.length < optimized.length) {
            optimized = retry.text
            recovered = true
            usedFree = retry.usedFree
          }
        }

        const provider = usedFree ? 'free-channel' : (first.route?.provider ?? 'unknown')
        const model = usedFree ? FREE_CHANNEL.model : (first.route?.model ?? 'unknown')

        // 记录本次真实使用的路由，供设置页核实。
        lastUsed = {
          provider,
          model,
          source: usedFree ? 'free' : (first.route?.source ?? 'session'),
          style: settings.style,
          freeError: first.freeError,
          at: Date.now(),
        }

        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify({
          ok: true,
          text: optimized,
          provider,
          model,
          style: settings.style,
          source: usedFree ? 'free' : (first.route?.source ?? 'session'),
          recovered,
          freeChannel: {
            enabled: settings.modelMode === 'free',
            used: usedFree,
            error: first.freeError ?? null,
          },
        }))
      } catch (error) {
        res.writeHead(500, JSON_HEADERS)
        res.end(JSON.stringify({
          ok: false,
          error: `优化失败：${String(error?.message ?? error)}`,
        }))
      }
    },
  })
}

export { STYLE_ITEMS, DEFAULT_SETTINGS }
