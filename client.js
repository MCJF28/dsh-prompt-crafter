/**
 * dsh-prompt-enhancer —— Client 半区
 *
 * 两个界面：
 *   1. `conversation.input.right`：发送键左侧的「优化」按钮。
 *   2. `settings.section`：设置里的「优化」一页，配置模型与提示词风格。
 *
 * 视觉规范：高度 28px、无边框、hover 用 interactive-bg-hover，
 * 图标用内联 SVG（不用 emoji —— 跨系统渲染差异大且与 UI 风格不符）。
 *
 * 读写输入框的两个接口来自 slot 的 standardProps：
 *   - `useInput(selector => ...)` 读 InputState.draft
 *   - `inputActions.setDraft(text)` 整体替换草稿
 */

window.__ModuleLoader__.load({
  id: 'dsh-prompt-enhancer',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    // ── 样式 ──────────────────────────────────────────────────────────────

    const BUTTON_CSS = `
.dsho-root{position:relative;display:inline-flex;align-items:center;flex:none}
.dsho-btn{
  appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;
  height:28px;padding:0 9px;
  border:0;border-radius:var(--dsw-radius-sm);
  background:transparent;
  color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:13px;font-weight:500;line-height:20px;
  cursor:pointer;white-space:nowrap;
  transition:background-color .1s,color .1s,opacity .1s;
}
.dsho-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsho-btn:disabled{opacity:.4;cursor:default}
.dsho-btn[data-busy="true"]{color:var(--dsw-alias-state-business-primary);opacity:1}
.dsho-icon{display:block;flex:none;width:14px;height:14px}
.dsho-spin{animation:dsho-rotate .9s linear infinite;transform-origin:50% 50%}
@keyframes dsho-rotate{to{transform:rotate(360deg)}}
.dsho-err{
  position:absolute;bottom:calc(100% + 8px);right:0;
  width:max-content;max-width:260px;
  padding:7px 10px;
  border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-overlay);
  border:1px solid var(--dsw-alias-border-l2);
  color:var(--dsw-alias-state-error-primary);
  font-size:12px;line-height:17px;
  box-shadow:var(--dsw-elevation-soft);
  z-index:70;
  word-break:break-word;
}
`

    const PAGE_CSS = `
.dsho-page{display:flex;flex-direction:column;gap:22px;padding:2px 0 10px;width:100%}

/*
 * 区块标题：左侧一条品牌蓝竖线。
 * 整页只在少数关键位置用蓝色（标题竖线、选中卡片、预览卡左边框），
 * 其余保持中性色 —— 点缀比通体上色更耐看。
 */
.dsho-sec{display:flex;flex-direction:column;gap:10px}
.dsho-sec-title{
  display:flex;align-items:center;gap:8px;
  font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);
}
.dsho-sec-title::before{
  content:'';flex:none;
  width:3px;height:14px;border-radius:2px;
  background:var(--dsw-alias-brand-primary);
}
.dsho-sec-hint{font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary)}

/*
 * 卡片式选择器（对齐官方「外观」那组设置的形态）：
 * 图标在上、文字在下，整块可点。选中时品牌蓝描边 + 极浅蓝底。
 */
.dsho-cards{display:grid;gap:10px;width:100%}
.dsho-card-btn{
  appearance:none;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:9px;
  min-height:76px;padding:14px 10px;
  border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-panel);
  background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);
  font:inherit;cursor:pointer;
  transition:border-color .12s,background-color .12s,color .12s,box-shadow .12s;
}
.dsho-card-btn:hover:not(:disabled){
  border-color:var(--dsw-alias-brand-primary);
  color:var(--dsw-alias-label-primary);
}
.dsho-card-btn:disabled{opacity:.5;cursor:default}
.dsho-card-btn[data-on="true"]{
  border-color:var(--dsw-alias-brand-primary);
  background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, var(--dsw-alias-bg-layer-1));
  color:var(--dsw-alias-brand-primary);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary);
}
.dsho-card-icon{display:block;flex:none;width:20px;height:20px}
.dsho-card-label{font-size:13px;font-weight:500;line-height:18px;white-space:nowrap}

/* 下拉：自绘，避免原生 select 与主题不一致 */
.dsho-select{position:relative;display:block;width:100%}
.dsho-select-btn{
  appearance:none;display:flex;align-items:center;gap:8px;
  width:100%;height:38px;padding:0 12px;
  border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);
  font:inherit;font-size:13px;text-align:left;
  cursor:pointer;
}
.dsho-select-btn:hover{border-color:var(--dsw-alias-brand-primary)}
.dsho-select-btn:disabled{opacity:.5;cursor:default}
.dsho-select-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsho-select-caret{flex:none;width:14px;height:14px;color:var(--dsw-alias-label-secondary)}
.dsho-menu{
  position:absolute;top:calc(100% + 4px);left:0;right:0;
  max-height:300px;overflow-y:auto;
  padding:5px;
  border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-overlay);
  box-shadow:var(--dsw-elevation-soft);
  z-index:60;
}
.dsho-opt{
  appearance:none;display:flex;align-items:center;gap:8px;
  width:100%;padding:9px 10px;border:0;background:transparent;
  border-radius:calc(var(--dsw-radius-sm) - 2px);
  font:inherit;font-size:13px;text-align:left;
  color:var(--dsw-alias-label-secondary);
  cursor:pointer;
}
.dsho-opt:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsho-opt[data-on="true"]{color:var(--dsw-alias-brand-primary);font-weight:600}
.dsho-opt-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsho-opt-tag{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.8}
.dsho-check{flex:none;width:14px;height:14px}
/* 自定义提示词输入框 */
.dsho-textarea{
  width:100%;min-height:180px;resize:vertical;
  padding:11px 13px;box-sizing:border-box;
  border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);
  font:inherit;font-size:13px;line-height:21px;
}
.dsho-textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsho-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dsho-status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dsho-status[data-kind="ok"]{color:var(--dsw-alias-state-success-primary)}
.dsho-status[data-kind="err"]{color:var(--dsw-alias-state-error-primary)}
.dsho-card{
  padding:14px 16px;
  border:1px solid var(--dsw-alias-border-l1);
  border-left:2px solid var(--dsw-alias-brand-primary);
  border-radius:var(--dsw-radius-panel);
  background:var(--dsw-alias-bg-layer-1);
  display:flex;flex-direction:column;gap:7px;
  /* 固定最小高度：切换档位时提示词长度差很多，
     不锁高度会让整页上下跳动，看起来像"闪了一下"。 */
  min-height:168px;
}
.dsho-preview{
  font-size:12px;line-height:19px;
  color:var(--dsw-alias-label-secondary);
  white-space:pre-wrap;word-break:break-word;
  max-height:240px;overflow-y:auto;
}
/* 内容换档时淡入，而不是硬切。key 变化会重建节点，动画才会重放。 */
.dsho-fade{animation:dsho-fadein .16s ease-out}
@keyframes dsho-fadein{from{opacity:0}to{opacity:1}}
/* 免费通道卡片：自适应高度，不继承预览卡的最小高度 */
.dsho-card-auto{min-height:0}
.dsho-row{display:flex;align-items:center;justify-content:space-between;gap:14px}
.dsho-row-label{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsho-row-name{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dsho-row-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dsho-status[data-kind="warn"]{color:var(--dsw-alias-state-warn-primary)}
/* 开关：与宿主设置页同款 40×24 / 圆点 20 / 位移 16 */
.dsho-switch{
  position:relative;flex:none;
  width:40px;height:24px;padding:0;
  border:0;border-radius:999px;
  background:var(--dsw-alias-border-l2);
  cursor:pointer;transition:background-color .15s;
}
.dsho-switch[aria-checked="true"]{background:var(--dsw-alias-state-business-primary)}
.dsho-knob{
  position:absolute;top:2px;left:2px;
  width:20px;height:20px;border-radius:999px;
  background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);
  transition:transform .15s;
}
.dsho-switch[aria-checked="true"] .dsho-knob{transform:translateX(16px)}
`

    /**
     * 浮层样式单独一份。
     *
     * 必须跟着浮层组件一起渲染：shell.overlay 与设置页是两个独立槽位，
     * 设置页里注入的 <style> 管不到浮层 —— 早先共用 PAGE_CSS 时浮层完全没样式，
     * 退化成浏览器默认排版，还盖到了侧边栏上。
     */
    const TOAST_CSS = `
/*
 * 对齐原生设计系统：
 *   · 卡片 —— bg-layer-2 + 1px border-l1 + radius-lg(16px) + elevation-soft，
 *     与宿主的对话框同一个配方；用 radius-panel(28px) 会圆得像气泡。
 *   · 按钮 —— 胶囊形（999px），主按钮用 button-primary-fill 填充，
 *     文字色必须用 label-primary-foreground（反色）。早先用 #fff 配白色品牌色，
 *     字和底一个颜色，看起来就是个空白块。
 */
.dsho-toast{
  position:fixed;right:16px;bottom:16px;z-index:1000;
  width:300px;max-width:calc(100vw - 32px);
  display:flex;flex-direction:column;gap:8px;
  padding:12px 14px;
  box-sizing:border-box;
  border-radius:var(--dsw-radius-lg,16px);
  border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-primary);
  box-shadow:var(--dsw-elevation-soft);
  animation:dsho-toast-in .16s ease-out;
}
@keyframes dsho-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.dsho-toast-title{font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary)}
.dsho-toast-body{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dsho-toast-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:2px}
.dsho-toast-btn{
  appearance:none;
  height:28px;padding:0 14px;
  border-radius:999px;
  border:1px solid var(--dsw-alias-border-l2);
  background:transparent;
  color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12px;font-weight:500;
  cursor:pointer;
  transition:background-color .1s,border-color .1s,color .1s;
}
.dsho-toast-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsho-toast-btn:disabled{opacity:.5;cursor:default}
.dsho-toast-btn[data-primary="true"]{
  border-color:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));
  background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));
  color:var(--dsw-alias-label-primary-foreground,#fff);
}
.dsho-toast-btn[data-primary="true"]:hover:not(:disabled){
  border-color:var(--dsw-alias-button-primary-fill-hover,var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary)));
  background:var(--dsw-alias-button-primary-fill-hover,var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary)));
}
`

    // ── 图标 ──────────────────────────────────────────────────────────────

    /** 双星（优化）。14px 线性风格，与宿主图标一致。 */
    function SparkIcon(props) {
      return h('svg', {
        className: 'dsho-icon' + (props.spin ? ' dsho-spin' : ''),
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        h('path', { d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' }),
        h('path', { d: 'M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z' })
      )
    }

    function CaretIcon() {
      return h('svg', {
        className: 'dsho-select-caret',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }, h('path', { d: 'M6 9l6 6 6-6' }))
    }

    function CheckIcon() {
      return h('svg', {
        className: 'dsho-check',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }, h('path', { d: 'M4 12l5 5L20 6' }))
    }

    /** 选项卡片用的线性图标，统一 20px、currentColor、2px 描边。 */
    function LineIcon(props) {
      return h('svg', {
        className: 'dsho-card-icon',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }, props.children)
    }

    /** 自动：循环箭头（跟随）。 */
    function IconAuto() {
      return h(LineIcon, null,
        h('path', { d: 'M20 11a8 8 0 10-2.6 6' }),
        h('path', { d: 'M20 4v7h-7' })
      )
    }

    /** 手动：滑块（自己指定）。 */
    function IconManual() {
      return h(LineIcon, null,
        h('path', { d: 'M4 8h10M18 8h2M4 16h4M12 16h8' }),
        h('circle', { cx: 16, cy: 8, r: 2.2 }),
        h('circle', { cx: 10, cy: 16, r: 2.2 })
      )
    }

    /** 免费通道：闪电（不花额度、即开即用）。 */
    function IconFree() {
      return h(LineIcon, null,
        h('path', { d: 'M13 3L5 13h6l-1 8 8-10h-6l1-8z' })
      )
    }

    /**
     * 精简：压缩。
     *
     * 之前三个档位的图标都是横线（两行、三行、文档），语义重叠，
     * 一眼看过去全是"文本行"，分不出区别。现在改成各不相同的意象：
     *   精简 = 上下两条边夹住一个向下的箭头，表示把内容压短；
     *   均衡 = 天平，表示不多不少；
     *   详细 = 放大镜里看到文字，表示看得更细。
     */
    function IconBrief() {
      return h(LineIcon, null,
        h('path', { d: 'M4 5h16' }),
        h('path', { d: 'M4 19h16' }),
        h('path', { d: 'M12 8.5v5.5' }),
        h('path', { d: 'M8.8 11l3.2 3.2 3.2-3.2' })
      )
    }

    /** 均衡：天平。 */
    function IconBalanced() {
      return h(LineIcon, null,
        h('path', { d: 'M12 4v15' }),
        h('path', { d: 'M7 19h10' }),
        h('path', { d: 'M5 7h14' }),
        h('path', { d: 'M5 7l-2.6 5.6h5.2z' }),
        h('path', { d: 'M19 7l2.6 5.6h-5.2z' })
      )
    }

    /**
     * 详细：四角向外展开。
     *
     * 与「精简」的向内压缩箭头正好成对：一个收、一个放，形态对称、
     * 语义一眼可辨，而且全是简单折线，20px 下不会糊。
     * 试过放大镜方案，但镜片里的文字缩到 20px 只有 1px 高，糊成一团。
     */
    function IconDetailed() {
      return h(LineIcon, null,
        h('path', { d: 'M9 4H4v5' }),
        h('path', { d: 'M15 4h5v5' }),
        h('path', { d: 'M4 15v5h5' }),
        h('path', { d: 'M20 15v5h-5' })
      )
    }

    /** 自定义：铅笔。 */
    function IconCustom() {
      return h(LineIcon, null,
        h('path', { d: 'M4 20h4L19 9l-4-4L4 16z' }),
        h('path', { d: 'M14 6l4 4' })
      )
    }

    // ── 通用控件 ──────────────────────────────────────────────────────────

    /**
     * 卡片式选择器。
     *
     * 取代原来的胶囊分段：官方「外观」那组设置用的是大卡片（图标在上、文字在下），
     * 目标明确、点击热区大、选中态清楚。这里照同样的结构做，
     * 选中时用品牌蓝描边加浅蓝底，与整页的强调色统一。
     */
    function CardChoice(props) {
      return h('div', {
        className: 'dsho-cards',
        style: { gridTemplateColumns: `repeat(${props.options.length}, minmax(0, 1fr))` },
        role: 'radiogroup',
      }, props.options.map((option) => h('button', {
        key: option.id,
        type: 'button',
        role: 'radio',
        className: 'dsho-card-btn',
        'data-on': props.value === option.id ? 'true' : 'false',
        'aria-checked': props.value === option.id,
        disabled: props.disabled === true,
        onClick: () => props.onChange(option.id),
        title: option.summary,
      },
        h(option.Icon),
        h('span', { className: 'dsho-card-label' }, option.label)
      )))
    }

    /** 下拉单选：选项多时用。自绘，点击外部关闭。 */
    function Select(props) {
      const [open, setOpen] = useState(false)
      const boxRef = useRef(null)

      useEffect(() => {
        if (!open) return undefined
        const onDown = (event) => {
          if (boxRef.current !== null && !boxRef.current.contains(event.target)) setOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('mousedown', onDown)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      const current = props.options.find((option) => option.value === props.value)

      return h('div', { className: 'dsho-select', ref: boxRef },
        h('button', {
          type: 'button',
          className: 'dsho-select-btn',
          disabled: props.disabled === true,
          onClick: () => setOpen((previous) => !previous),
          'aria-haspopup': 'listbox',
          'aria-expanded': open,
        },
          h('span', { className: 'dsho-select-value' },
            current === undefined ? (props.placeholder ?? '请选择') : current.label),
          h(CaretIcon)
        ),
        open
          ? h('div', { className: 'dsho-menu', role: 'listbox' },
              props.options.length === 0
                ? h('div', { className: 'dsho-opt' }, '没有可用选项')
                : props.options.map((option) => h('button', {
                    key: option.value,
                    type: 'button',
                    role: 'option',
                    className: 'dsho-opt',
                    'data-on': option.value === props.value ? 'true' : 'false',
                    'aria-selected': option.value === props.value,
                    onClick: () => {
                      props.onChange(option.value)
                      setOpen(false)
                    },
                  },
                    h('span', { className: 'dsho-opt-name' }, option.label),
                    option.tag === undefined ? null : h('span', { className: 'dsho-opt-tag' }, option.tag),
                    option.value === props.value ? h(CheckIcon) : null
                  ))
            )
          : null
      )
    }

    // ── 网络 ──────────────────────────────────────────────────────────────

    async function postJson(path, body) {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }
      return data
    }

    function optimize(text, sessionId) {
      return postJson('/dsh-prompt-enhancer/optimize', { text, sessionId })
    }

    async function readSettings(sessionId) {
      const query = typeof sessionId === 'string' && sessionId.length > 0
        ? `?sessionId=${encodeURIComponent(sessionId)}`
        : ''
      const response = await fetch(`/dsh-prompt-enhancer/settings${query}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }
      return data
    }

    /** 路由来源的可读说明。 */
    const SOURCE_LABEL = {
      manual: '设置里手动指定',
      session: '当前对话实际在用',
      default: '默认模型',
      config: '配置文件兜底',
    }

    // ── 输入框按钮 ────────────────────────────────────────────────────────

    function OptimizeButton(props) {
      // 只订阅 draft，无关状态变化不触发重渲染。
      const draft = props.useInput((state) => state.draft)
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : undefined
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const timerRef = useRef(undefined)

      useEffect(() => () => {
        if (timerRef.current !== undefined) clearTimeout(timerRef.current)
      }, [])

      const text = typeof draft === 'string' ? draft : ''
      const empty = text.trim().length === 0

      const run = useCallback(async () => {
        if (busy) return
        const source = (typeof draft === 'string' ? draft : '').trim()
        if (source.length === 0) return

        setBusy(true)
        setError(null)
        try {
          const result = await optimize(source, sessionId)
          if (typeof result.text !== 'string' || result.text.length === 0) {
            throw new Error('模型返回了空内容')
          }
          props.inputActions.setDraft(result.text)
        } catch (err) {
          setError(String(err && err.message ? err.message : err))
          if (timerRef.current !== undefined) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setError(null), 5000)
        } finally {
          setBusy(false)
        }
      }, [busy, draft, sessionId, props.inputActions])

      return h('div', { className: 'dsho-root' },
        h('style', null, BUTTON_CSS),
        error === null ? null : h('div', { className: 'dsho-err', role: 'alert' }, error),
        h('button', {
          type: 'button',
          className: 'dsho-btn',
          'data-busy': busy ? 'true' : 'false',
          disabled: busy || empty,
          onClick: () => { void run() },
          'aria-label': busy ? '正在优化提示词' : '优化提示词',
          title: empty
            ? '先在输入框里写下要优化的内容'
            : '用当前模型把这段提示词改写得更清晰、更具可执行性',
        },
          h(SparkIcon, { spin: busy }),
          h('span', null, busy ? '优化中' : '优化')
        )
      )
    }

    // ── 设置页 ────────────────────────────────────────────────────────────

    function SettingsPage(props) {
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : undefined
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [status, setStatus] = useState(null)
      // 本地编辑态：改动即时保存，但 UI 要先反映出来。
      const [draft, setDraft] = useState(null)

      useEffect(() => {
        let alive = true
        void (async () => {
          try {
            const loaded = await readSettings(sessionId)
            if (!alive) return
            setData(loaded)
            setDraft(loaded.settings)
          } catch (err) {
            if (alive) setError(String(err && err.message ? err.message : err))
          }
        })()
        return () => { alive = false }
      }, [])

      /**
       * 保存设置。
       *
       * 刻意**不设 busy**：写的是本地文件，毫秒级完成，不需要忙碌态。
       * 早先在这里 setBusy(true) 会让所有卡片套上 opacity:.5，保存完再恢复，
       * 视觉上就是切换时"闪一下"。只有保存失败才用状态文字提示。
       */
      const persist = useCallback(async (next) => {
        setDraft(next)
        setStatus(null)
        try {
          const saved = await postJson('/dsh-prompt-enhancer/settings', next)
          setData((previous) => (previous === null ? previous : { ...previous, settings: saved.settings }))
          setStatus({
            kind: saved.saved ? 'ok' : 'err',
            text: saved.saved ? '已保存' : '已应用，但写入文件失败，重启后可能不保留',
          })
        } catch (err) {
          setStatus({ kind: 'err', text: String(err && err.message ? err.message : err) })
        }
      }, [])

      if (error !== null) {
        return h('div', { className: 'dsho-page' },
          h('style', null, PAGE_CSS),
          h('div', { className: 'dsho-status', 'data-kind': 'err' }, `读取设置失败：${error}`)
        )
      }
      if (data === null || draft === null) {
        return h('div', { className: 'dsho-page' },
          h('style', null, PAGE_CSS),
          h('div', { className: 'dsho-status' }, '正在读取…')
        )
      }

      const styles = data.styles ?? []
      const models = data.models ?? []
      // 每个风格档配一个图标，卡片式选项才有辨识度。
      const STYLE_ICON = {
        brief: IconBrief,
        balanced: IconBalanced,
        detailed: IconDetailed,
        custom: IconCustom,
      }
      const styleOptions = styles
        .map((item) => ({
          id: item.id,
          label: item.label,
          summary: item.summary,
          Icon: STYLE_ICON[item.id] ?? IconBalanced,
        }))
        .concat({
          id: 'custom',
          label: '自定义',
          summary: '完全自己写系统提示词',
          Icon: IconCustom,
        })

      const modelOptions = models.map((item) => ({
        value: `${item.provider}\u0000${item.model}`,
        label: item.name,
        tag: item.providerName ?? item.provider,
      }))
      const manualValue = draft.provider.length > 0 && draft.model.length > 0
        ? `${draft.provider}\u0000${draft.model}`
        : ''

      const currentStyle = styles.find((item) => item.id === draft.style)
      const resolved = data.resolved

      return h('div', { className: 'dsho-page' },
        h('style', null, PAGE_CSS),

        // 模型
        h('div', { className: 'dsho-sec' },
          h('div', { className: 'dsho-sec-title' }, '优化用的模型'),
          h('div', { className: 'dsho-sec-hint' },
            '自动：跟随当前对话正在使用的模型；手动：固定用一个模型；免费：优先走内置免费通道。'),
          h(CardChoice, {
            value: draft.modelMode,
            options: [
              { id: 'auto', label: '自动', summary: '跟随当前对话的模型', Icon: IconAuto },
              { id: 'manual', label: '手动', summary: '固定指定一个模型', Icon: IconManual },
              {
                id: 'free',
                label: '免费通道',
                summary: '内置免费模型，不消耗对话额度',
                Icon: IconFree,
              },
            ],
            onChange: (value) => { void persist({ ...draft, modelMode: value, freeChannelAsked: true }) },
          }),
          draft.modelMode === 'manual'
            ? h(Select, {
                value: manualValue,
                placeholder: models.length === 0 ? '没有可用模型' : '选择一个模型',
                options: modelOptions,
                onChange: (value) => {
                  const [provider, model] = value.split('\u0000')
                  void persist({ ...draft, provider, model })
                },
              })
            : draft.modelMode === 'free'
              ? h('div', { className: 'dsho-card dsho-card-auto' },
                  h('div', { className: 'dsho-sec-hint' },
                    `下一次优化将调用：免费通道 / ${data.freeChannel?.model ?? '内置模型'}`),
                  h('div', { className: 'dsho-sec-hint' },
                    '免费通道不可用时，自动回退到当前对话正在使用的模型，按钮不会因此失效。'),
                  data.lastUsed?.source === 'free'
                    ? h('div', { className: 'dsho-sec-hint' }, '上次优化走的是免费通道。')
                    : data.lastUsed?.freeError
                      ? h('div', { className: 'dsho-sec-hint', 'data-kind': 'warn' },
                          `上次免费通道不可用：${data.lastUsed.freeError}（已回退到对话模型）`)
                      : null
                )
              : h('div', { className: 'dsho-card' },
                  h('div', { className: 'dsho-sec-hint' },
                    resolved === undefined || resolved === null
                      ? '还没取到当前对话的模型。先在对话里发一条消息，这里就会跟上。'
                      : `下一次优化将调用：${resolved.provider} / ${resolved.model}`),
                  resolved === undefined || resolved === null
                    ? null
                    : h('div', { className: 'dsho-sec-hint' },
                        `来源：${SOURCE_LABEL[resolved.source] ?? resolved.source}`),
                  data.lastUsed === undefined || data.lastUsed === null
                    ? null
                    : h('div', { className: 'dsho-sec-hint' },
                        `上次实际调用：${data.lastUsed.provider} / ${data.lastUsed.model}`
                        + `（${SOURCE_LABEL[data.lastUsed.source] ?? data.lastUsed.source}，`
                        + `力度「${data.lastUsed.style}」）`)
                )
        ),

        // 风格
        h('div', { className: 'dsho-sec' },
          h('div', { className: 'dsho-sec-title' }, '改写力度'),
          h('div', { className: 'dsho-sec-hint' },
            '三档预设只改变写力度，不改你的意图。'),
          h(CardChoice, {
            value: draft.style,
            options: styleOptions,
            onChange: (value) => { void persist({ ...draft, style: value }) },
          }),
          draft.style === 'custom'
            ? h('textarea', {
                className: 'dsho-textarea',
                value: draft.customPrompt,
                placeholder: '写你自己的系统提示词。留空则使用「均衡」档。',
                spellCheck: false,
                onChange: (event) => setDraft({ ...draft, customPrompt: event.target.value }),
                onBlur: (event) => { void persist({ ...draft, customPrompt: event.target.value }) },
              })
            : h('div', { className: 'dsho-card' },
                h('div', {
                  // key 跟着档位变，节点才会重建，淡入动画才会重放一次。
                  key: `summary-${draft.style}`,
                  className: 'dsho-sec-hint dsho-fade',
                }, currentStyle === undefined ? '' : currentStyle.summary),
                h('div', {
                  key: `prompt-${draft.style}`,
                  className: 'dsho-preview dsho-fade',
                }, currentStyle === undefined ? '' : currentStyle.prompt)
              )
        ),

        status === null
          ? null
          : h('div', { className: 'dsho-status', 'data-kind': status.kind }, status.text)
      )
    }

    // ── 首次安装的免费通道询问 ────────────────────────────────────────────

    /**
     * 装好插件后问一次：要不要开启免费通道。
     *
     * 只问一次 —— 服务端把 `freeChannelAsked` 写进设置，问过就不再出现。
     * 不自动消失：这是个需要用户表态的选择，自动消失等于替他做了决定。
     */
    function FreeChannelPrompt() {
      // loading → 还没读到设置；ask → 要问；hidden → 不问
      const [phase, setPhase] = useState('loading')
      const [busy, setBusy] = useState(false)

      useEffect(() => {
        let alive = true
        void (async () => {
          try {
            const settings = await readSettings()
            if (!alive) return
            setPhase(settings?.settings?.freeChannelAsked === true ? 'hidden' : 'ask')
          } catch {
            if (alive) setPhase('hidden')
          }
        })()
        return () => { alive = false }
      }, [])

      const decide = useCallback(async (enable) => {
        setBusy(true)
        try {
          await postJson('/dsh-prompt-enhancer/settings', enable
            // 选择开启就是切到「免费通道」这个模型选项，不再有单独的开关。
            ? { modelMode: 'free', freeChannelAsked: true }
            : { freeChannelAsked: true })
        } catch {
          /* 保存失败也别让浮层一直挡着 */
        } finally {
          setBusy(false)
          setPhase('hidden')
        }
      }, [])

      if (phase !== 'ask') return null

      return h('div', {
        className: 'dsho-toast',
        role: 'dialog',
        'aria-label': '开启免费通道',
      },
        // 样式必须由这个组件自己注入：它渲染在 shell.overlay，拿不到设置页的 <style>。
        h('style', null, TOAST_CSS),
        h('div', { className: 'dsho-toast-title' }, '开启免费通道？'),
        h('div', { className: 'dsho-toast-body' },
          '提示词优化可以走内置的免费模型，不消耗你的对话额度。'
          + '免费通道不可用时会自动切回当前对话使用的模型，不影响使用。'),
        h('div', { className: 'dsho-toast-actions' },
          h('button', {
            type: 'button',
            className: 'dsho-toast-btn',
            disabled: busy,
            onClick: () => { void decide(false) },
          }, '暂不开启'),
          h('button', {
            type: 'button',
            className: 'dsho-toast-btn',
            'data-primary': 'true',
            disabled: busy,
            onClick: () => { void decide(true) },
          }, '开启')
        )
      )
    }

    // ── 错误边界 ──────────────────────────────────────────────────────────

    /** 渲染异常只影响这个插件的界面，不牵连整个设置页。 */
    function safe(Component) {
      return class Boundary extends React.Component {
        constructor(props) {
          super(props)
          this.state = { failed: false }
        }

        static getDerivedStateFromError() {
          return { failed: true }
        }

        render() {
          if (this.state.failed) {
            return h('div', { className: 'dsho-status', 'data-kind': 'err' },
              '优化设置加载出错，请刷新页面重试。')
          }
          return h(Component, this.props)
        }
      }
    }

    // ── 设置导航图标 ──────────────────────────────────────────────────────

    /*
     * 宿主的设置导航按 section id 硬编码图标，只认 account / models /
     * agent-presets / plugins / archived-sessions 五个，其余一律返回齿轮
     * （见 dsh-client-ui-settings-general 的 navIcon）。而 settings.section
     * 的注册接口只接受 id / order / label，没有 icon 字段。
     *
     * 所以这里自己动手：给导航行打一个 data 属性，再用 mask-image 把默认
     * 齿轮换成这个插件的图标。用 mask 而不是 background-image，是为了让
     * 颜色跟随 `currentColor` —— 选中时文字变蓝，图标自动跟着变蓝。
     */
    const NAV_ATTR = 'dshnav'
    const NAV_VALUE = 'dsh-prompt-enhancer'
    const NAV_LABEL = '优化'

    /** 双星图标（与输入框的优化按钮同一形状），stroke 用纯黑供 mask 取 alpha。 */
    const NAV_MASK = 'url("data:image/svg+xml,'
      + encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' "
        + "stroke='#000' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'>"
        + "<path d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'/>"
        + "<path d='M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'/>"
        + '</svg>',
      )
      + '")'

    const NAV_CSS = `
button[data-${NAV_ATTR}="${NAV_VALUE}"] > svg{display:none}
button[data-${NAV_ATTR}="${NAV_VALUE}"]::before{
  content:'';flex:none;
  width:16px;height:16px;
  background-color:currentColor;
  -webkit-mask:var(--dsho-nav-mask) center / contain no-repeat;
  mask:var(--dsho-nav-mask) center / contain no-repeat;
}
`

    /**
     * 找到设置导航里属于本插件的那一行并打标记。
     *
     * 定位方式：按钮的直属 span 文本等于「优化」，且它有一个 svg 兄弟
     * （导航行才同时有图标和文字），父容器里还含「通用设置」以排除别处的同名项。
     * 找不到就安静返回，不抛错。
     */
    function decorateNavRow() {
      try {
        const buttons = document.querySelectorAll('button')
        for (const button of buttons) {
          if (button.dataset[NAV_ATTR] === NAV_VALUE) continue
          if (button.querySelector(':scope > svg') === null) continue
          const label = button.querySelector(':scope > span')
          if (label === null || label.textContent.trim() !== NAV_LABEL) continue
          const list = button.parentElement
          if (list === null || !list.textContent.includes('通用设置')) continue
          button.dataset[NAV_ATTR] = NAV_VALUE
          button.style.setProperty('--dsho-nav-mask', NAV_MASK)
        }
      } catch {
        /* 定位失败不影响设置页本身 */
      }
    }

    /** 装上观察器：设置面板每次打开都要重新打标记（DOM 会被重建）。 */
    function installNavIcons() {
      try {
        const style = document.createElement('style')
        style.textContent = NAV_CSS
        document.head.appendChild(style)
        decorateNavRow()

        let queued = false
        const observer = new MutationObserver(() => {
          if (queued) return
          queued = true
          // 合并同一帧内的多次变更，避免设置面板动画期间反复扫描。
          requestAnimationFrame(() => {
            queued = false
            decorateNavRow()
          })
        })
        observer.observe(document.body, { childList: true, subtree: true })

        return () => {
          observer.disconnect()
          style.remove()
        }
      } catch {
        return undefined
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => installNavIcons())

        ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right',
          id: 'dsh-prompt-enhancer',
          order: 10,
          label: () => '优化',
        }, safe(OptimizeButton)))

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-prompt-enhancer',
          order: 45,
          label: () => '优化',
        }, safe(SettingsPage)))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-prompt-enhancer-free',
          order: 60,
          label: () => '免费通道',
        }, safe(FreeChannelPrompt)))
      },
    }
  },
})
