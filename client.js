/**
 * dsh-share-chat-card — Client half.
 *
 * Adds a "分享" pill to the composer dock. It opens a modal that lists the
 * loaded conversation as individually selectable records and exports the
 * chosen ones as either a self-contained HTML page or a set of PNG images.
 *
 * Data comes from the slot's standard props (`useChat` / `useSessions`); the
 * panel never folds session events itself and never touches DOM outside its
 * own component tree (a detached <a download> click is the only exception).
 */
window.__ModuleLoader__.load({
  id: 'dsh-share-chat-card',
  factory(require) {
    'use strict'

    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef } = React

    const NS = 'dshShareChatCard'
    const TRIGGER_ID = 'dsh-share-chat-card'

    // ── locale ────────────────────────────────────────────────────────────
    const ZH = {
      trigger: '分享',
      dialogTitle: '分享会话',
      eyebrow: '会话分享',
      hint: '选择要分享的记录，导出为图片或网页',
      listTitle: '记录清单',
      selectAll: '全选',
      clearAll: '清空',
      chatOnly: '只选对话',
      selected: '已选 {n}/{total}',
      optionReasoning: '思考过程',
      optionTime: '显示时间',
      preview: '预览',
      exportPng: '导出 PNG',
      exportHtml: '导出 HTML',
      copyPng: '复制图片',
      close: '关闭',
      emptyList: '这个会话还没有可分享的记录',
      untitled: '未命名会话',
      roleUser: '我',
      roleAi: 'DeepSeek',
      roleTool: '工具',
      roleNotice: '提示',
      entryCount: '{n} 条记录',
      tagSteering: '补充',
      tagFailed: '失败',
      thinking: '思考过程',
      turnError: '回合中断',
      maxTokens: '输出达到上限',
      docBy: '由 DSH 会话分享生成',
      docMeta: '{date} · {n} 条记录{stats}',
      statTools: '{n} 次工具',
      statWork: '耗时 {span}',
      statSpan: '跨度 {span}',
      statTokens: '{n} tokens',
      spanSec: '{n} 秒',
      spanMin: '{n} 分钟',
      spanHour: '{h} 小时 {m} 分',
      spanDay: '{d} 天 {h} 小时',
      previewCut: '预览只显示前 {shown}/{total} 条，导出会包含全部记录',
      previewClip: '预览已省略部分超长内容，导出为完整文本',
      statusPng: '已导出 {n} 张 PNG',
      statusHtml: '已导出 HTML 文件',
      statusCopied: '图片已复制，可以直接粘贴发送',
      statusCopyMulti: '有多张图片，已复制第 1 张',
      statusCopyFail: '复制失败，请改用「导出 PNG」',
      statusPngFail: 'PNG 导出失败，可以试试 HTML',
      statusHtmlFail: 'HTML 导出失败',
      statusEmpty: '先选择至少一条记录',
      busy: '正在生成…',
      busyPage: '正在生成第 {i}/{n} 页…',
      noArgs: '无参数',
      stopReason: '已中断',
      page: '{i}/{n}',
      brand: 'DeepSeek Harness',
    }
    const EN = {
      trigger: 'Share',
      dialogTitle: 'Share conversation',
      eyebrow: 'Session share',
      hint: 'Pick the records to share, then export as images or a web page',
      listTitle: 'Records',
      selectAll: 'Select all',
      clearAll: 'Clear',
      chatOnly: 'Chat only',
      selected: '{n} of {total} selected',
      optionReasoning: 'Reasoning',
      optionTime: 'Timestamps',
      preview: 'Preview',
      exportPng: 'Export PNG',
      exportHtml: 'Export HTML',
      copyPng: 'Copy image',
      close: 'Close',
      emptyList: 'No records to share in this conversation yet',
      untitled: 'Untitled conversation',
      roleUser: 'Me',
      roleAi: 'DeepSeek',
      roleTool: 'Tool',
      roleNotice: 'Notice',
      entryCount: '{n} messages',
      tagSteering: 'Follow-up',
      tagFailed: 'failed',
      thinking: 'Reasoning',
      turnError: 'Turn stopped',
      maxTokens: 'Output hit the cap',
      docBy: 'Made with DSH Session Share',
      docMeta: '{date} · {n} messages{stats}',
      statTools: '{n} tool calls',
      statWork: '{span} work',
      statSpan: '{span} span',
      statTokens: '{n} tokens',
      spanSec: '{n}s',
      spanMin: '{n} min',
      spanHour: '{h}h {m}m',
      spanDay: '{d}d {h}h',
      previewCut: 'Preview shows the first {shown} of {total} records; the export keeps all of them',
      previewClip: 'Long content is shortened here; the export keeps the full text',
      statusPng: 'Exported {n} PNG file(s)',
      statusHtml: 'Exported the HTML file',
      statusCopied: 'Image copied — paste it anywhere',
      statusCopyMulti: 'Multiple pages: copied page 1',
      statusCopyFail: 'Copy failed — use Export PNG instead',
      statusPngFail: 'PNG export failed — try HTML',
      statusHtmlFail: 'HTML export failed',
      statusEmpty: 'Select at least one record first',
      busy: 'Rendering…',
      busyPage: 'Rendering page {i} of {n}…',
      noArgs: 'no arguments',
      stopReason: 'interrupted',
      page: '{i}/{n}',
      brand: 'DeepSeek Harness',
    }

    // ── styles ────────────────────────────────────────────────────────────
    const PANEL_CSS = `
.dss-dock{display:flex;align-items:center}
.dss-trigger{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:20px;cursor:pointer;transition:background-color .12s,color .12s,border-color .12s}
.dss-trigger:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.dss-trigger:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.dss-trigger svg{width:13px;height:13px;display:block}
.dss-dialog{position:fixed;inset:0;margin:auto;width:min(1040px,calc(100vw - 36px));height:min(760px,calc(100vh - 40px));max-width:none;max-height:none;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-primary);overflow:visible;outline:none}
.dss-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(2px)}
.dss-shell{display:flex;flex-direction:column;height:100%;min-height:0;border-radius:18px;overflow:hidden;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);box-shadow:0 28px 70px -28px rgba(0,0,0,.6);animation:dss-pop .16s ease-out}
@keyframes dss-pop{from{opacity:.55;transform:scale(.985)}to{opacity:1;transform:none}}
.dss-top{display:flex;align-items:flex-start;gap:16px;padding:16px 20px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dss-top-main{min-width:0;flex:1}
.dss-eyebrow{font-size:11px;letter-spacing:.14em;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}
.dss-title{font-size:17px;font-weight:600;line-height:26px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dss-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin-top:3px}
.dss-iconbtn{flex:none;width:28px;height:28px;border-radius:9px;border:none;background:transparent;color:var(--dsw-alias-label-tertiary);display:grid;place-items:center;cursor:pointer;padding:0}
.dss-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss-iconbtn svg{width:14px;height:14px}
.dss-body{display:flex;flex:1;min-height:0}
.dss-side{width:372px;flex:none;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--dsw-alias-border-l1)}
.dss-side-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px 8px}
.dss-side-head span:first-child{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dss-count{font-size:11.5px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.dss-tools-row{display:flex;gap:6px;padding:0 12px 10px;flex-wrap:wrap}
.dss-mini{height:24px;padding:0 9px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer}
.dss-mini:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss-list{flex:1;min-height:0;overflow-y:auto;padding:2px 8px 14px}
.dss-row{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:9px;cursor:pointer;min-width:0}
.dss-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dss-row input{flex:none;width:14px;height:14px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;margin:0}
.dss-chip{flex:none;min-width:34px;text-align:center;font-size:11px;line-height:19px;border-radius:999px;padding:0 7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
.dss-chip[data-role="user"]{background:var(--dsw-alias-brand-primary-soft,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-brand-text,var(--dsw-alias-brand-primary))}
.dss-chip[data-role="ai"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.dss-chip[data-role="tool"],.dss-chip[data-role="note"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
.dss-rowtext{flex:1;min-width:0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dss-row[data-role="tool"] .dss-rowtext,.dss-row[data-role="note"] .dss-rowtext{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dss-clock{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.dss-empty{display:grid;place-items:center;height:100%;min-height:200px;color:var(--dsw-alias-label-tertiary);font-size:12.5px;text-align:center;padding:24px}
.dss-pre{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.dss-pre-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px 6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dss-pre-head span:last-child{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.dss-pre-body{flex:1;min-height:0;overflow:auto;padding:8px 16px 20px}
.dss-pre-doc{zoom:.62;max-width:760px;margin:0 auto}
.dss-foot{display:flex;align-items:center;gap:14px;padding:11px 16px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex-wrap:wrap}
.dss-opts{display:flex;align-items:center;gap:14px}
.dss-check{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dss-check input{width:14px;height:14px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.dss-actions{display:flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
.dss-status{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);max-width:280px;text-align:right}
.dss-status[data-tone="ok"]{color:var(--dsw-alias-state-success-primary)}
.dss-status[data-tone="bad"]{color:var(--dsw-alias-state-error-primary)}
.dss-btn{height:30px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
.dss-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dss-btn:disabled{opacity:.5;cursor:default}
.dss-btn[data-kind="primary"]{border-color:transparent;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:#fff}
.dss-btn[data-kind="primary"]:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary))}
.dss-btn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
@media (max-width:860px){.dss-side{width:300px}.dss-pre{display:none}}
`

    const DOC_CSS = `
.dss-doc{font-family:"Segoe UI","Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif;font-size:15px;line-height:1.75;color:#1d2129;background:#eef1f6}
.dss-doc *{box-sizing:border-box}
.dss-sheet{max-width:820px;margin:0 auto;background:#fff;border-radius:20px;padding:34px 42px 28px;box-shadow:0 1px 2px rgba(16,24,40,.06),0 22px 52px -30px rgba(16,24,40,.4)}
.dss-brand{display:flex;align-items:center;gap:9px;color:#8a93a0;font-size:12px;letter-spacing:.02em}
.dss-logo{width:24px;height:24px;border-radius:8px;background:#4d6bfe;color:#fff;font-weight:700;font-size:14px;line-height:24px;text-align:center;letter-spacing:0}
.dss-h1{font-size:24px;line-height:1.35;font-weight:650;color:#0f172a;margin:18px 0 0;letter-spacing:-.01em}
.dss-sub{font-size:12.5px;color:#8a93a0;margin-top:8px;font-variant-numeric:tabular-nums}
.dss-divider{height:1px;background:#eef0f4;margin:18px 0 2px}
.dss-e{margin-top:20px}
.dss-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:#8a93a0}
.dss-who{font-weight:600;color:#5b6472}
.dss-e[data-role="user"] .dss-who{color:#4d6bfe}
.dss-clock{font-variant-numeric:tabular-nums}
.dss-tag{padding:0 6px;border-radius:999px;background:#eef2ff;color:#4d6bfe;font-size:11px;line-height:17px}
.dss-bubble{margin-top:8px;background:#eef2ff;border:1px solid #dfe6ff;border-radius:14px;padding:12px 16px}
.dss-bubble .dss-md{margin-top:0}
.dss-reason{margin-top:10px;background:#f8f8fa;border-left:3px solid #e5e7eb;border-radius:0 10px 10px 0;padding:10px 14px}
.dss-reason-label{font-size:11px;font-weight:600;color:#8a93a0;letter-spacing:.04em;margin-bottom:5px}
.dss-reason .dss-md{margin-top:0;font-size:13.5px;line-height:1.65;color:#5b6472}
.dss-md{margin-top:10px;font-size:15px;line-height:1.75;color:#1d2129;word-break:break-word}
.dss-md p{margin:0 0 10px}
.dss-md p:last-child{margin-bottom:0}
.dss-md h3{font-size:17px;font-weight:650;color:#0f172a;margin:16px 0 8px}
.dss-md h4{font-size:15.5px;font-weight:650;color:#0f172a;margin:14px 0 6px}
.dss-md ul,.dss-md ol{margin:0 0 10px;padding-left:22px}
.dss-md li{margin:3px 0}
.dss-md code{font-family:"Cascadia Code",Consolas,"SF Mono",Menlo,monospace;font-size:13px;background:#f2f3f5;border-radius:5px;padding:1px 5px;color:#2b3444}
.dss-md pre{margin:10px 0;background:#f5f6f8;border:1px solid #eceef2;border-radius:10px;padding:12px 14px;overflow-x:auto}
.dss-md pre code{display:block;background:none;padding:0;font-size:12.5px;line-height:1.7;white-space:pre}
.dss-md blockquote{margin:10px 0;padding:2px 0 2px 12px;border-left:3px solid #dfe3ea;color:#5b6472}
.dss-md a{color:#4d6bfe;text-decoration:none;border-bottom:1px solid rgba(77,107,254,.3)}
.dss-md table{border-collapse:collapse;margin:10px 0;font-size:13.5px}
.dss-md th,.dss-md td{border:1px solid #e5e8ee;padding:5px 9px;text-align:left}
.dss-md th{background:#f7f8fa;font-weight:600}
.dss-md hr{border:0;border-top:1px solid #e7eaef;margin:14px 0}
.dss-tool{display:flex;align-items:baseline;gap:8px;margin-top:12px;padding:8px 12px;border-radius:10px;background:#f7f8fa;color:#5b6472;font-size:12.5px;min-width:0}
.dss-tool-glyph{color:#8a93a0}
.dss-tool-name{font-family:"Cascadia Code",Consolas,"SF Mono",Menlo,monospace;font-weight:600;color:#2b3444;white-space:nowrap}
.dss-tool-arg{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:"Cascadia Code",Consolas,"SF Mono",Menlo,monospace;font-size:12px}
.dss-tool[data-failed="1"]{background:#fff1f0;color:#b42318}
.dss-note{margin-top:12px;padding:9px 12px;border-radius:10px;background:#fff7ed;color:#9a5b12;font-size:12.5px}
.dss-note[data-kind="error"]{background:#fff1f0;color:#b42318}
.dss-foot{margin-top:28px;padding-top:13px;border-top:1px solid #eef0f4;display:flex;justify-content:space-between;gap:12px;font-size:11.5px;color:#9aa3b0}
.dss-empty{padding:48px 24px;text-align:center;color:#8a93a0}
.dss-cut{margin-top:16px;padding:8px 12px;border-radius:9px;background:#f6f7f9;color:#8a93a0;font-size:12px;text-align:center}
`

    // ── markdown ─────────────────────────────────────────────────────────
    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    function safeHref(url) {
      const trimmed = String(url || '').trim()
      return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : ''
    }

    function parseInline(source) {
      const text = String(source == null ? '' : source)
      const runs = []
      let buffer = ''
      const flush = () => {
        if (buffer) {
          runs.push({ text: buffer })
          buffer = ''
        }
      }
      let i = 0
      while (i < text.length) {
        const ch = text[i]
        if (ch === '`') {
          const end = text.indexOf('`', i + 1)
          if (end > i + 1 && text.slice(i + 1, end).indexOf('\n') === -1) {
            flush()
            runs.push({ text: text.slice(i + 1, end), code: true })
            i = end + 1
            continue
          }
        }
        if (ch === '\\' && (text[i + 1] === '*' || text[i + 1] === '_' || text[i + 1] === '`' || text[i + 1] === '[')) {
          buffer += text[i + 1]
          i += 2
          continue
        }
        if ((ch === '*' && text[i + 1] === '*') || (ch === '_' && text[i + 1] === '_')) {
          const mark = ch + ch
          const end = text.indexOf(mark, i + 2)
          if (end > i + 2) {
            flush()
            runs.push({ text: text.slice(i + 2, end), bold: true })
            i = end + 2
            continue
          }
        }
        if (ch === '~' && text[i + 1] === '~') {
          const end = text.indexOf('~~', i + 2)
          if (end > i + 2) {
            flush()
            runs.push({ text: text.slice(i + 2, end), strike: true })
            i = end + 2
            continue
          }
        }
        if (ch === '*' || ch === '_') {
          const end = text.indexOf(ch, i + 1)
          const inner = end > i + 1 ? text.slice(i + 1, end) : ''
          if (inner && inner.indexOf('\n') === -1 && !/^\s/.test(inner) && !/\s$/.test(inner)) {
            flush()
            runs.push({ text: inner, italic: true })
            i = end + 1
            continue
          }
        }
        if (ch === '[') {
          const match = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(i))
          if (match) {
            const href = safeHref(match[2])
            flush()
            runs.push(href ? { text: match[1], link: href } : { text: match[1] })
            i += match[0].length
            continue
          }
        }
        if (ch === 'h' && (i === 0 || /[\s(]/.test(text[i - 1]))) {
          const match = /^https?:\/\/[^\s<>()]+/.exec(text.slice(i))
          if (match) {
            const url = match[0].replace(/[.,;，。；]+$/, '')
            flush()
            runs.push({ text: url, link: url })
            i += url.length
            continue
          }
        }
        buffer += ch
        i += 1
      }
      flush()
      return runs
    }

    function isBlockStart(line) {
      return (
        /^\s*```/.test(line) ||
        /^\s*~~~/.test(line) ||
        /^\s*#{1,6}\s+/.test(line) ||
        /^\s*>\s?/.test(line) ||
        /^\s*([-*+]|\d+\.)\s+/.test(line) ||
        /^\s*\|.*\|/.test(line) ||
        /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)
      )
    }

    function parseBlocks(source) {
      const text = String(source == null ? '' : source).replace(/\r\n?/g, '\n')
      const lines = text.split('\n')
      const blocks = []
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        if (!line.trim()) {
          i += 1
          continue
        }
        const fence = /^\s*(```+|~~~+)\s*([A-Za-z0-9_+.-]*)\s*$/.exec(line)
        if (fence) {
          const marker = fence[1][0]
          const body = []
          i += 1
          while (i < lines.length && !new RegExp('^\\s*' + (marker === '`' ? '```' : '~~~') + '+\\s*$').test(lines[i])) {
            body.push(lines[i])
            i += 1
          }
          if (i < lines.length) i += 1
          blocks.push({ type: 'code', lang: fence[2] || '', text: body.join('\n') })
          continue
        }
        const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line)
        if (heading) {
          blocks.push({ type: 'heading', level: heading[1].length, runs: parseInline(heading[2].trim()) })
          i += 1
          continue
        }
        if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
          blocks.push({ type: 'hr' })
          i += 1
          continue
        }
        if (/^\s*>/.test(line)) {
          const body = []
          while (i < lines.length && /^\s*>/.test(lines[i])) {
            body.push(lines[i].replace(/^\s*>\s?/, ''))
            i += 1
          }
          blocks.push({ type: 'quote', blocks: parseBlocks(body.join('\n')) })
          continue
        }
        if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
          const rows = []
          const header = splitRow(line)
          i += 2
          while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
            rows.push(splitRow(lines[i]))
            i += 1
          }
          blocks.push({ type: 'table', header, rows })
          continue
        }
        const listItem = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line)
        if (listItem) {
          const ordered = /\d+\./.test(listItem[2])
          const items = []
          let baseIndent = listItem[1].length
          while (i < lines.length) {
            const item = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i])
            if (!item) break
            const indent = item[1].length
            const continuation = []
            const body = item[3]
            i += 1
            while (i < lines.length && lines[i].trim() && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) && !isBlockStart(lines[i])) {
              continuation.push(lines[i].trim())
              i += 1
            }
            items.push({
              level: indent > baseIndent ? 1 : 0,
              runs: parseInline((body + ' ' + continuation.join(' ')).trim()),
            })
          }
          if (!items.some((item) => item.level > 0)) baseIndent = 0
          blocks.push({ type: 'list', ordered, items })
          continue
        }
        const paragraph = []
        while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i]) && !/^\s*\|.*\|\s*$/.test(lines[i])) {
          paragraph.push(lines[i].trim())
          i += 1
        }
        if (paragraph.length) blocks.push({ type: 'paragraph', runs: parseInline(paragraph.join('\n')) })
      }
      return blocks
    }

    function splitRow(line) {
      const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
      return cells.map((cell) => cell.trim())
    }

    function renderInlineHtml(runs) {
      return runs
        .map((run) => {
          let html = escapeHtml(run.text)
          if (run.code) html = '<code>' + html + '</code>'
          if (run.bold) html = '<strong>' + html + '</strong>'
          if (run.italic) html = '<em>' + html + '</em>'
          if (run.strike) html = '<del>' + html + '</del>'
          if (run.link) html = '<a href="' + escapeHtml(run.link) + '" target="_blank" rel="noopener noreferrer">' + html + '</a>'
          return html
        })
        .join('')
    }

    function renderBlocksHtml(blocks) {
      const out = []
      for (const block of blocks) {
        if (block.type === 'paragraph') out.push('<p>' + renderInlineHtml(block.runs) + '</p>')
        else if (block.type === 'heading') {
          const level = block.level <= 2 ? 3 : 4
          out.push('<h' + level + '>' + renderInlineHtml(block.runs) + '</h' + level + '>')
        } else if (block.type === 'code') {
          out.push('<pre><code>' + escapeHtml(block.text) + '</code></pre>')
        } else if (block.type === 'quote') {
          out.push('<blockquote>' + renderBlocksHtml(block.blocks) + '</blockquote>')
        } else if (block.type === 'list') {
          const tag = block.ordered ? 'ol' : 'ul'
          const items = block.items.map((item) => '<li>' + (item.level ? '<span style="padding-left:16px"></span>' : '') + renderInlineHtml(item.runs) + '</li>')
          out.push('<' + tag + '>' + items.join('') + '</' + tag + '>')
        } else if (block.type === 'table') {
          const header = '<tr>' + block.header.map((cell) => '<th>' + renderInlineHtml(parseInline(cell)) + '</th>').join('') + '</tr>'
          const rows = block.rows
            .map((row) => '<tr>' + row.map((cell) => '<td>' + renderInlineHtml(parseInline(cell)) + '</td>').join('') + '</tr>')
            .join('')
          out.push('<table>' + header + rows + '</table>')
        } else if (block.type === 'hr') {
          out.push('<hr>')
        }
      }
      return out.join('')
    }

    // ── data extraction ──────────────────────────────────────────────────
    function promptText(content) {
      if (!Array.isArray(content)) return ''
      const parts = []
      for (const block of content) {
        if (!block) continue
        if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
        else if (block.type === 'image') parts.push('[图片]')
        else if (block.type === 'file') parts.push('[文件] ' + (block.path || block.name || ''))
      }
      return parts.join('\n').trim()
    }

    function assistantParts(blocks) {
      const text = []
      const reasoning = []
      for (const block of blocks || []) {
        if (!block) continue
        if (block.kind === 'text' && typeof block.text === 'string' && block.text.trim()) text.push(block.text)
        else if (block.kind === 'reasoning' && typeof block.text === 'string' && block.text.trim()) reasoning.push(block.text)
      }
      return { text: text.join('\n\n').trim(), reasoning: reasoning.join('\n\n').trim() }
    }

    function collectItems(order, nodes) {
      const items = []
      if (!Array.isArray(order) || !nodes) return items
      const skip = new Set([
        'system-prompt', 'context', 'compaction', 'manual-compaction', 'command', 'command-input',
        'turn-process', 'turn-tail', 'turn-trigger', 'model-retry', 'question-reply', 'workflow-run', 'unknown',
      ])
      // A Node's `location.turn` is the live Turn record: `start.time` opens when
      // the human message lands and `end.time` closes when the agent finishes, so
      // `end - start` is the work time the UI itself reports as "Took …".
      const turnOf = (node) => {
        const location = node.location
        if (!location || (location.kind !== 'turn' && location.kind !== 'step')) return undefined
        const turn = location.turn
        if (!turn || typeof turn.turn !== 'number') return undefined
        return {
          id: turn.turn,
          start: turn.start && typeof turn.start.time === 'number' ? turn.start.time : 0,
          end: turn.end && typeof turn.end.time === 'number' ? turn.end.time : 0,
        }
      }
      for (const key of order) {
        const node = nodes.get(key)
        if (!node || skip.has(node.kind) || node.visibility === 'hidden') continue
        const data = node.data || {}
        const turn = turnOf(node)
        if (node.kind === 'user') {
          const text = promptText(data.content)
          if (!text) continue
          items.push({ id: node.key || key, role: 'user', time: data.time, text, turn })
        } else if (node.kind === 'steering') {
          const text = promptText(data.content)
          if (!text) continue
          items.push({ id: node.key || key, role: 'user', time: data.time, text, steering: true, turn })
        } else if (node.kind === 'assistant-step') {
          const parts = assistantParts(data.blocks)
          if (!parts.text && !parts.reasoning) continue
          items.push({ id: node.key || key, role: 'ai', time: data.time, text: parts.text, reasoning: parts.reasoning, usage: data.usage, turn })
        } else if (node.kind === 'tool-call') {
          const root = data.root || data
          const call = root.call || {}
          items.push({
            id: node.key || key,
            role: 'tool',
            time: root.callTime,
            toolName: root.name || call.name || 'tool',
            argsRaw: typeof call.argsRaw === 'string' ? call.argsRaw : '',
            failed: root.isError === true,
            turn,
          })
        } else if (node.kind === 'turn-error') {
          items.push({ id: node.key || key, role: 'note', time: data.time, kind: 'error', message: data.message || '', code: data.code, turn })
        } else if (node.kind === 'turn-max-tokens') {
          items.push({ id: node.key || key, role: 'note', time: data.time, kind: 'warn', message: 'maxTokens' })
        }
      }
      return items
    }

    // ── helpers ──────────────────────────────────────────────────────────
    function truncate(value, limit) {
      const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
      return text.length > limit ? text.slice(0, limit - 1) + '…' : text
    }

    function stripMarkdown(value) {
      return String(value == null ? '' : value)
        .replace(/```[\s\S]*?```/g, ' [代码] ')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_~#>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    function toolArgsSummary(item, t) {
      const raw = item.argsRaw || ''
      let args = null
      try {
        args = raw ? JSON.parse(raw) : null
      } catch {
        args = null
      }
      if (args && typeof args === 'object' && !Array.isArray(args)) {
        const keys = ['command', 'cmd', 'path', 'file_path', 'filePath', 'pattern', 'query', 'url', 'prompt', 'description', 'name', 'title']
        for (const key of keys) {
          if (typeof args[key] === 'string' && args[key].trim()) return truncate(args[key], 180)
        }
        const first = Object.values(args).find((value) => typeof value === 'string' && value.trim())
        if (first) return truncate(first, 180)
      }
      const trimmed = truncate(raw, 180)
      return trimmed || t('noArgs')
    }

    function pad2(value) {
      return value < 10 ? '0' + value : String(value)
    }

    function formatClock(time) {
      const date = new Date(typeof time === 'number' ? time : Date.now())
      if (Number.isNaN(date.getTime())) return ''
      return pad2(date.getHours()) + ':' + pad2(date.getMinutes())
    }

    function formatDate(date) {
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
    }

    function stamp(date) {
      return (
        date.getFullYear().toString() +
        pad2(date.getMonth() + 1) +
        pad2(date.getDate()) +
        '-' +
        pad2(date.getHours()) +
        pad2(date.getMinutes())
      )
    }

    function safeFileName(value) {
      const base = String(value || 'session').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
      return (base || 'session').slice(0, 64)
    }

    function saveBlob(blob, name) {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      anchor.rel = 'noopener'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 8000)
    }

    function canvasToBlob(canvas) {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
      })
    }

    function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    // Rendering a long session is one synchronous burst; give the browser a
    // frame first so the "正在生成…" status is actually visible instead of the
    // dialog looking frozen while layout runs.
    function nextPaint() {
      return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => setTimeout(resolve, 30))
        } else {
          setTimeout(resolve, 30)
        }
      })
    }

    // ── document model ───────────────────────────────────────────────────
    function formatCount(value) {
      return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    // A share's header answers "what am I looking at": how many records, how much
    // the model burned, and how long the shared window actually spans. Token
    // numbers only exist when the provider reported usage for the steps.
    function formatSpan(ms, t) {
      const seconds = Math.max(1, Math.round(ms / 1000))
      if (seconds < 60) return t('spanSec', { n: seconds })
      const minutes = Math.max(1, Math.round(ms / 60000))
      if (minutes < 60) return t('spanMin', { n: minutes })
      const hours = Math.floor(ms / 3600000)
      if (hours < 24) return t('spanHour', { h: hours, m: Math.round((ms % 3600000) / 60000) })
      return t('spanDay', { d: Math.floor(hours / 24), h: hours % 24 })
    }

    function buildStats(entries, t) {
      let tools = 0
      let tokens = 0
      let first = 0
      let last = 0
      const turns = new Map()
      const mark = (time) => {
        if (typeof time !== 'number' || !time) return
        if (!first || time < first) first = time
        if (time > last) last = time
      }
      for (const entry of entries) {
        mark(entry.time)
        if (entry.role === 'tool') tools += 1
        if (entry.tokens) tokens += entry.tokens
        if (entry.turn && typeof entry.turn.id === 'number') {
          const info = turns.get(entry.turn.id) || { start: 0, end: 0, replies: 0 }
          if (!info.start && entry.turn.start) info.start = entry.turn.start
          if (entry.turn.end) info.end = entry.turn.end
          if (entry.role === 'ai') info.replies += 1
          turns.set(entry.turn.id, info)
        }
      }
      // Only turns that actually carry a shared model reply count as work time;
      // turns whose reply was not shared would otherwise inflate the number.
      let work = 0
      for (const info of turns.values()) {
        if (!info.replies || !info.start || !info.end || info.end <= info.start) continue
        work += info.end - info.start
      }
      const parts = []
      if (tools) parts.push(t('statTools', { n: tools }))
      if (work) parts.push(t('statWork', { span: formatSpan(work, t) }))
      const span = first && last && last > first ? last - first : 0
      if (span) parts.push(t('statSpan', { span: formatSpan(span, t) }))
      if (tokens) parts.push(t('statTokens', { n: formatCount(tokens) }))
      return { text: parts.length ? ' · ' + parts.join(' · ') : '', tokens, span, work, tools }
    }

    function buildDoc(input) {
      const t = input.t
      const entries = []
      for (const item of input.items) {
        const turn = item.turn
        if (item.role === 'user') {
          if (!item.text.trim()) continue
          entries.push({ role: 'user', time: item.time, text: item.text, steering: item.steering === true, turn })
        } else if (item.role === 'ai') {
          const hasText = item.text.trim().length > 0
          const hasReasoning = input.includeReasoning && item.reasoning.trim().length > 0
          if (!hasText && !hasReasoning) continue
          const usage = item.usage
          const tokens = usage && typeof usage === 'object' && typeof usage.totalTokens === 'number' ? usage.totalTokens : 0
          entries.push({ role: 'ai', time: item.time, text: item.text, reasoning: hasReasoning ? item.reasoning : '', tokens, turn })
        } else if (item.role === 'tool') {
          entries.push({ role: 'tool', time: item.time, name: item.toolName, args: toolArgsSummary(item, t), failed: item.failed === true, turn })
        } else if (item.role === 'note') {
          const message = item.message === 'maxTokens' ? t('maxTokens') : item.message
          entries.push({ role: 'note', time: item.time, kind: item.kind || 'warn', message, turn })
        }
      }
      const stats = buildStats(entries, t)
      return {
        title: input.title || t('untitled'),
        date: formatDate(input.now),
        count: entries.filter((entry) => entry.role === 'user' || entry.role === 'ai').length,
        entries,
        stats: stats.text,
        tokens: stats.tokens,
        span: stats.span,
        work: stats.work,
        showTime: input.showTime === true,
        t,
        now: input.now,
      }
    }

    function entryLabel(entry, t) {
      if (entry.role === 'user') return t('roleUser')
      if (entry.role === 'ai') return t('roleAi')
      if (entry.role === 'tool') return t('roleTool')
      return t('roleNotice')
    }

    function renderDocHtml(doc) {
      const t = doc.t
      const parts = []
      parts.push('<div class="dss-doc"><div class="dss-sheet">')
      parts.push(
        '<div class="dss-brand"><span class="dss-logo">D</span><span>' +
          escapeHtml(t('brand')) +
          '</span></div>'
      )
      parts.push('<h1 class="dss-h1">' + escapeHtml(doc.title) + '</h1>')
      parts.push('<div class="dss-sub">' + escapeHtml(t('docMeta', { date: doc.date, n: doc.count, stats: doc.stats || '' })) + '</div>')
      parts.push('<div class="dss-divider"></div>')
      if (!doc.entries.length) parts.push('<div class="dss-empty">' + escapeHtml(t('emptyList')) + '</div>')
      for (const entry of doc.entries) {
        parts.push('<div class="dss-e" data-role="' + entry.role + '">')
        const clock = doc.showTime && entry.time ? '<span class="dss-clock">' + escapeHtml(formatClock(entry.time)) + '</span>' : ''
        if (entry.role === 'user') {
          const tag = entry.steering ? '<span class="dss-tag">' + escapeHtml(t('tagSteering')) + '</span>' : ''
          parts.push('<div class="dss-meta"><span class="dss-who">' + escapeHtml(t('roleUser')) + '</span>' + tag + clock + '</div>')
          parts.push('<div class="dss-bubble"><div class="dss-md">' + renderBlocksHtml(parseBlocks(entry.text)) + '</div></div>')
        } else if (entry.role === 'ai') {
          parts.push('<div class="dss-meta"><span class="dss-who">' + escapeHtml(t('roleAi')) + '</span>' + clock + '</div>')
          if (entry.reasoning) {
            parts.push(
              '<div class="dss-reason"><div class="dss-reason-label">' +
                escapeHtml(t('thinking')) +
                '</div><div class="dss-md">' +
                renderBlocksHtml(parseBlocks(entry.reasoning)) +
                '</div></div>'
            )
          }
          if (entry.text) parts.push('<div class="dss-md">' + renderBlocksHtml(parseBlocks(entry.text)) + '</div>')
        } else if (entry.role === 'tool') {
          parts.push(
            '<div class="dss-tool" data-failed="' +
              (entry.failed ? '1' : '0') +
              '"><span class="dss-tool-glyph">⚙</span><span class="dss-tool-name">' +
              escapeHtml(entry.name) +
              (entry.failed ? ' · ' + escapeHtml(t('tagFailed')) : '') +
              '</span><span class="dss-tool-arg">' +
              escapeHtml(entry.args) +
              '</span></div>'
          )
        } else {
          const glyph = entry.kind === 'error' ? '⚠' : '⏹'
          parts.push('<div class="dss-note" data-kind="' + entry.kind + '">' + glyph + ' ' + escapeHtml(entry.message) + '</div>')
        }
        parts.push('</div>')
      }
      if (doc.__preview) {
        const shown = String(doc.__preview.shown)
        const total = String(doc.__preview.total)
        const text = doc.__preview.shown < doc.__preview.total ? t('previewCut', { shown, total }) : t('previewClip')
        parts.push('<div class="dss-cut">' + escapeHtml(text) + '</div>')
      }
      parts.push('<div class="dss-foot"><span>' + escapeHtml(t('docBy')) + '</span><span>' + escapeHtml(doc.date) + '</span></div>')
      parts.push('</div></div>')
      return parts.join('')
    }

    // The preview is a live DOM island inside the dialog. A long session with
    // reasoning switched on can be megabytes of markdown; rendering all of it
    // stalls the whole GUI, so the preview shows a bounded slice of the same
    // document while every export path still uses the full model.
    const PREVIEW = { entries: 12, text: 2400, reasoning: 1600 }

    function previewDoc(doc) {
      if (!doc || !Array.isArray(doc.entries) || !doc.entries.length) return doc
      let clipped = false
      const entries = doc.entries.slice(0, PREVIEW.entries).map((entry) => {
        if (!entry.text && !entry.reasoning) return entry
        let copy = entry
        if (entry.text && entry.text.length > PREVIEW.text) {
          copy = Object.assign({}, copy, { text: entry.text.slice(0, PREVIEW.text) })
          clipped = true
        }
        if (entry.reasoning && entry.reasoning.length > PREVIEW.reasoning) {
          copy = Object.assign({}, copy, { reasoning: entry.reasoning.slice(0, PREVIEW.reasoning) })
          clipped = true
        }
        return copy
      })
      if (!clipped && entries.length === doc.entries.length) return doc
      return Object.assign({}, doc, {
        entries,
        __preview: { shown: entries.length, total: doc.entries.length, clipped },
      })
    }

    function buildHtmlFile(doc, t) {
      const body = renderDocHtml(doc)
      return (
        '<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>' +
        escapeHtml(doc.title) +
        '</title><style>html,body{margin:0;padding:0;background:#eef1f6}.dss-doc{padding:28px 16px 40px}' +
        DOC_CSS +
        '@media (max-width:760px){.dss-sheet{padding:22px 18px 20px;border-radius:14px}.dss-h1{font-size:20px}.dss-doc{padding:12px 0 24px}}</style></head><body>' +
        body +
        '</body></html>'
      )
    }

    // ── canvas renderer (PNG) ────────────────────────────────────────────
    const SANS = '"Segoe UI","Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'
    const MONO = '"Cascadia Code","Cascadia Mono",Consolas,"SF Mono",Menlo,monospace'
    const CF = {
      bg: '#eef1f6',
      sheet: '#ffffff',
      text: '#1d2129',
      sub: '#5b6472',
      faint: '#8a93a0',
      head: '#0f172a',
      brand: '#4d6bfe',
      line: '#e8ebf0',
      codeBg: '#f2f3f5',
      codeText: '#2b3444',
      userBg: '#eef2ff',
      reasonBg: '#f8f8fa',
      reasonBar: '#e5e7eb',
      toolBg: '#f7f8fa',
      warnBg: '#fff7ed',
      warnText: '#9a5b12',
      errBg: '#fff1f0',
      errText: '#b42318',
    }

    let measurer = null
    function measureText(text, font) {
      if (!measurer) {
        const canvas = document.createElement('canvas')
        measurer = canvas.getContext('2d')
      }
      measurer.font = font
      return measurer.measureText(text).width
    }

    function runFont(run, size) {
      const style = (run.italic ? 'italic ' : '') + (run.bold ? '600 ' : '400 ')
      return run.code ? style + (size - 1.5) + 'px ' + MONO : style + size + 'px ' + SANS
    }

    function splitAtoms(runs) {
      const atoms = []
      for (const run of runs) {
        const text = run.text || ''
        if (!text) continue
        let buffer = ''
        let spaces = false
        const flush = () => {
          if (buffer) {
            atoms.push({ text: buffer, run })
            buffer = ''
          }
          spaces = false
        }
        for (const cp of Array.from(text)) {
          const isSpace = /\s/u.test(cp)
          const isWide = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/u.test(cp)
          if (isSpace) {
            if (!spaces) {
              flush()
              spaces = true
            }
            buffer += cp
          } else if (isWide) {
            flush()
            atoms.push({ text: cp, run })
          } else {
            if (spaces) flush()
            buffer += cp
          }
        }
        flush()
      }
      return atoms
    }

    function wrapRuns(runs, width, options) {
      const lines = []
      let segs = []
      let cursor = 0
      let maxSize = options.size
      const flushLine = () => {
        if (segs.length) lines.push({ segs, size: maxSize })
        segs = []
        cursor = 0
        maxSize = options.size
      }
      const pushSeg = (text, font, run, size) => {
        const segWidth = measureText(text, font)
        if (cursor + segWidth > width && segs.length) flushLine()
        segs.push({
          text,
          font,
          fill: run.color || (run.code ? CF.codeText : run.link ? CF.brand : options.color || CF.text),
          w: segWidth,
          size,
          x: cursor,
          code: run.code === true,
          link: run.link === true,
        })
        cursor += segWidth
        if (size > maxSize) maxSize = size
      }
      for (const atom of splitAtoms(runs)) {
        const font = runFont(atom.run, options.size)
        const size = atom.run.code ? options.size - 1.5 : options.size
        if (cursor + measureText(atom.text, font) <= width) {
          pushSeg(atom.text, font, atom.run, size)
          continue
        }
        let rest = atom.text
        while (rest) {
          if (cursor > 0) flushLine()
          let part = ''
          for (const cp of Array.from(rest)) {
            if (measureText(part + cp, font) > width) break
            part += cp
          }
          if (!part) part = Array.from(rest)[0] || ''
          pushSeg(part, font, atom.run, size)
          rest = rest.slice(part.length)
          if (rest) flushLine()
        }
      }
      flushLine()
      return lines
    }

    function fitText(text, font, width) {
      if (measureText(text, font) <= width) return text
      let value = text
      while (value.length > 1 && measureText(value + '…', font) > width) value = value.slice(0, -1)
      return value + '…'
    }

    function displayWidth(text) {
      let width = 0
      for (const cp of Array.from(text)) width += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/u.test(cp) ? 2 : 1
      return width
    }

    const CANVAS = { W: 880, MARGIN: 22, PAD: 44, SCALE: 2, LIMIT: 7800, FOOT: 54 }

    function buildCanvasLines(doc) {
      const t = doc.t
      const L = CANVAS.PAD
      const CW = CANVAS.W - CANVAS.PAD * 2
      const lines = []
      let bgId = 0
      const push = (line) => lines.push(line)
      const spacer = (height, bg) => push({ h: height, segs: [], size: 0, bg })
      const paragraph = (runs, options) => {
        const wrapped = wrapRuns(runs, options.width, {
          size: options.size,
          color: options.color,
        })
        for (const line of wrapped) {
          push({
            h: options.lineHeight,
            segs: line.segs,
            size: line.size,
            x0: options.x,
            bg: options.bg,
          })
        }
      }
      const makeBox = (fill, bar, x, w) => ({
        id: 'bg' + (bgId += 1),
        fill,
        bar,
        x: x === undefined ? L : x,
        w: w === undefined ? CW : w,
      })
      const labelLine = (name, role, time, extra) => {
        const nameFont = '600 12.5px ' + SANS
        const segs = []
        let x = 0
        const add = (text, font, fill, size) => {
          const w = measureText(text, font)
          segs.push({ text, font, fill, w, size, x })
          x += w + 10
        }
        add(name, nameFont, role === 'user' ? CF.brand : CF.head, 12.5)
        if (extra) add(extra, '400 11px ' + SANS, CF.brand, 11)
        if (doc.showTime && time) add(formatClock(time), '400 11px ' + SANS, CF.faint, 11)
        push({ h: 22, segs, size: 12.5, x0: L })
      }

      const markdown = (blocks, options) => {
        let first = true
        for (const block of blocks) {
          if (!first) spacer(options.gap === undefined ? 8 : options.gap, options.bg)
          first = false
          if (block.type === 'paragraph') {
            paragraph(block.runs, {
              x: options.x,
              width: options.width,
              size: options.size,
              lineHeight: options.lineHeight,
              color: options.color,
              bg: options.bg,
            })
          } else if (block.type === 'heading') {
            const size = block.level <= 1 ? 20 : block.level === 2 ? 17.5 : block.level === 3 ? 16 : 15
            spacer(6, options.bg)
            paragraph(
              block.runs.map((run) => (run.bold ? run : { ...run, bold: true })),
              {
                x: options.x,
                width: options.width,
                size,
                lineHeight: size * 1.45,
                color: CF.head,
                bg: options.bg,
              }
            )
          } else if (block.type === 'code') {
            const box = options.bg || makeBox(CF.codeBg, null, options.x, options.width)
            spacer(8, box)
            const codeRuns = block.text.split('\n')
            for (const row of codeRuns.length ? codeRuns : ['']) {
              const wrapped = wrapRuns([{ text: row || ' ', code: true }], options.width - 28, {
                size: 12.5,
                color: CF.codeText,
              })
              for (const line of wrapped) {
                push({ h: 20, segs: line.segs, size: line.size, x0: options.x + 14, bg: box })
              }
            }
            spacer(8, box)
          } else if (block.type === 'quote') {
            markdown(block.blocks, { ...options, color: CF.sub, x: options.x + 12, width: options.width - 12 })
          } else if (block.type === 'list') {
            let index = 0
            for (const item of block.items) {
              index += 1
              const bullet = block.ordered ? index + '. ' : '• '
              const runs = [{ text: bullet, color: CF.brand }, ...item.runs]
              const wrapped = wrapRuns(runs, options.width - 26, {
                size: options.size,
                color: options.color,
              })
              wrapped.forEach((line, lineIndex) => {
                push({
                  h: options.lineHeight,
                  segs: line.segs,
                  size: line.size,
                  x0: options.x + (lineIndex === 0 ? 0 : 26) + item.level * 14,
                  bg: options.bg,
                })
              })
            }
          } else if (block.type === 'table') {
            const table = [block.header, ...block.rows]
            const columns = Math.max(...table.map((row) => row.length))
            const widths = []
            for (let c = 0; c < columns; c += 1) {
              widths[c] = Math.min(28, Math.max(...table.map((row) => displayWidth(row[c] || ''))))
            }
            const headerBand = options.bg ? options.bg : makeBox(CF.codeBg, null, options.x, options.width)
            table.forEach((row, rowIndex) => {
              const band = rowIndex === 0 ? headerBand : options.bg
              if (rowIndex === 0 && !options.bg) spacer(4, band)
              const cells = []
              for (let c = 0; c < columns; c += 1) {
                const text = row[c] || ''
                const width = widths[c]
                const cellText = displayWidth(text) > width ? truncate(text, width) : text
                cells.push(cellText + ' '.repeat(Math.max(0, width - displayWidth(cellText))))
              }
              const text = cells.join('  ')
              const font = rowIndex === 0 ? '600 12px ' + MONO : '400 12px ' + MONO
              push({
                h: 18,
                segs: [{ text, font, fill: rowIndex === 0 ? CF.head : CF.sub, w: measureText(text, font), size: 12, x: 0 }],
                size: 12,
                x0: options.x + 6,
                bg: band,
              })
              if (rowIndex === table.length - 1 && !options.bg) spacer(4, band)
            })
          } else if (block.type === 'hr') {
            push({ h: 18, segs: [], size: 0, rule: true })
          }
        }
      }

      for (const entry of doc.entries) {
        if (entry.role === 'user') {
          spacer(14)
          labelLine(t('roleUser'), 'user', entry.time, entry.steering ? t('tagSteering') : '')
          spacer(6)
          const box = makeBox(CF.userBg, null)
          spacer(10, box)
          markdown(parseBlocks(entry.text), {
            x: L + 16,
            width: CW - 32,
            size: 15,
            lineHeight: 25,
            color: CF.text,
            bg: box,
          })
          spacer(12, box)
          spacer(6)
        } else if (entry.role === 'ai') {
          spacer(14)
          labelLine(t('roleAi'), 'ai', entry.time)
          if (entry.reasoning) {
            spacer(7)
            const box = makeBox(CF.reasonBg, CF.reasonBar)
            spacer(10, box)
            push({
              h: 18,
              x0: L + 14,
              size: 11,
              segs: [{ text: t('thinking'), font: '600 11px ' + SANS, fill: CF.faint, w: measureText(t('thinking'), '600 11px ' + SANS), size: 11, x: 0 }],
              bg: box,
            })
            markdown(parseBlocks(entry.reasoning), {
              x: L + 14,
              width: CW - 28,
              size: 13.5,
              lineHeight: 21,
              color: CF.sub,
              bg: box,
              gap: 6,
            })
            spacer(10, box)
          }
          if (entry.text) {
            spacer(6)
            markdown(parseBlocks(entry.text), {
              x: L,
              width: CW,
              size: 15,
              lineHeight: 26,
              color: CF.text,
            })
          }
          spacer(6)
        } else if (entry.role === 'tool') {
          spacer(8)
          const box = makeBox(entry.failed ? CF.errBg : CF.toolBg, null)
          spacer(7, box)
          const nameFont = '600 12px ' + MONO
          const argFont = '400 11.5px ' + MONO
          const nameText = '⚙ ' + entry.name + (entry.failed ? ' · ' + t('tagFailed') : '')
          const nameWidth = measureText(nameText, nameFont)
          push({
            h: 22,
            size: 12,
            x0: L + 12,
            segs: [
              { text: nameText, font: nameFont, fill: entry.failed ? CF.errText : CF.head, w: nameWidth, size: 12, x: 0 },
              {
                text: fitText(entry.args, argFont, CW - 40 - nameWidth),
                font: argFont,
                fill: CF.sub,
                w: 0,
                size: 11.5,
                x: nameWidth + 12,
              },
            ],
            bg: box,
          })
          spacer(7, box)
        } else {
          spacer(8)
          const box = makeBox(entry.kind === 'error' ? CF.errBg : CF.warnBg, null)
          spacer(9, box)
          const glyph = entry.kind === 'error' ? '⚠ ' : '⏹ '
          paragraph([{ text: glyph + entry.message }], {
            x: L + 12,
            width: CW - 24,
            size: 12.5,
            lineHeight: 20,
            color: entry.kind === 'error' ? CF.errText : CF.warnText,
            bg: box,
          })
          spacer(10, box)
        }
      }
      return lines
    }

    function roundRect(ctx, x, y, w, h, radius) {
      const r = Math.max(0, Math.min(radius, w / 2, h / 2))
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.arcTo(x + w, y, x + w, y + r, r)
      ctx.lineTo(x + w, y + h - r)
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
      ctx.lineTo(x + r, y + h)
      ctx.arcTo(x, y + h, x, y + h - r, r)
      ctx.lineTo(x, y + r)
      ctx.arcTo(x, y, x + r, y, r)
      ctx.closePath()
    }

    function drawHeader(ctx, doc, pageInfo) {
      const t = doc.t
      const L = CANVAS.PAD
      const R = CANVAS.W - CANVAS.PAD
      const top = pageInfo.first ? 34 : 26
      ctx.textBaseline = 'alphabetic'
      if (pageInfo.first) {
        const logoSize = 24
        roundRect(ctx, L, top, logoSize, logoSize, 8)
        ctx.fillStyle = CF.brand
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 14px ' + SANS
        ctx.textAlign = 'center'
        ctx.fillText('D', L + logoSize / 2, top + 17)
        ctx.textAlign = 'left'
        ctx.fillStyle = CF.faint
        ctx.font = '400 12px ' + SANS
        ctx.fillText(t('brand'), L + logoSize + 9, top + 16)
        const titleTop = top + 40
        ctx.fillStyle = CF.head
        ctx.font = '650 21px ' + SANS
        doc.__titleLines.forEach((line, index) => {
          let x = L
          for (const seg of line.segs) {
            ctx.font = seg.font
            ctx.fillStyle = seg.fill || CF.head
            ctx.fillText(seg.text, L + (seg.x || 0), titleTop + 21 + index * 30)
            x += seg.w
          }
        })
        const metaTop = titleTop + doc.__titleLines.length * 30 + 6
        ctx.fillStyle = CF.faint
        ctx.font = '400 12.5px ' + SANS
        const metaFont = '400 12.5px ' + SANS
        const metaText = t('docMeta', { date: doc.date, n: doc.count, stats: doc.stats || '' })
        ctx.fillText(fitText(metaText, metaFont, R - L), L, metaTop + 14)
        ctx.fillStyle = CF.line
        ctx.fillRect(L, metaTop + 28, R - L, 1)
        pageInfo.contentTop = metaTop + 50
      } else {
        const logoSize = 18
        roundRect(ctx, L, top, logoSize, logoSize, 6)
        ctx.fillStyle = CF.brand
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 11px ' + SANS
        ctx.textAlign = 'center'
        ctx.fillText('D', L + logoSize / 2, top + 13)
        ctx.textAlign = 'left'
        ctx.fillStyle = CF.head
        const titleFont = '600 13px ' + SANS
        ctx.font = titleFont
        ctx.fillText(fitText(doc.title, titleFont, R - L - logoSize - 24), L + logoSize + 12, top + 14)
        ctx.fillStyle = CF.line
        ctx.fillRect(L, top + 32, R - L, 1)
        pageInfo.contentTop = top + 54
      }
    }

    function drawFooter(ctx, doc, pageInfo) {
      const t = doc.t
      const L = CANVAS.PAD
      const R = CANVAS.W - CANVAS.PAD
      const y = pageInfo.height - 34
      ctx.fillStyle = CF.faint
      ctx.font = '400 11px ' + SANS
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(t('docBy'), L, y)
      if (pageInfo.total > 1) {
        ctx.textAlign = 'right'
        ctx.fillText(t('page', { i: pageInfo.index + 1, n: pageInfo.total }), R, y)
        ctx.textAlign = 'left'
      }
    }

    function drawBox(ctx, box, top, bottom) {
      if (box.fill) {
        roundRect(ctx, box.x, top, box.w, Math.max(0, bottom - top), 14)
        ctx.fillStyle = box.fill
        ctx.fill()
      }
      if (box.bar) {
        ctx.fillStyle = box.bar
        ctx.fillRect(box.x, top, 3, Math.max(0, bottom - top))
      }
    }

    function layoutPages(doc) {
      const CW = CANVAS.W - CANVAS.PAD * 2
      const titleRuns = parseInline(doc.title).map((run) => ({ ...run, bold: true }))
      doc.__titleLines = wrapRuns(titleRuns, CW, { size: 21, lineHeight: 30, color: CF.head })
      const lines = buildCanvasLines(doc)

      const head1 = 130 + doc.__titleLines.length * 30
      const head2 = 26 + 54
      const pages = []
      let page = { first: true, lines: [], end: head1 }
      let y = head1
      for (const line of lines) {
        if (y + line.h > CANVAS.LIMIT - CANVAS.FOOT && page.lines.length) {
          page.end = y
          pages.push(page)
          page = { first: false, lines: [], end: head2 }
          y = head2
        }
        page.lines.push({ line, y })
        y += line.h
      }
      page.end = y
      pages.push(page)
      pages.forEach((info, index) => {
        info.index = index
        info.total = pages.length
        info.height = Math.round(info.end + CANVAS.FOOT)
      })
      return pages
    }

    function renderPage(doc, info) {
      const L = CANVAS.PAD
      const R = CANVAS.W - CANVAS.PAD
      const CW = R - L
      {
        const canvas = document.createElement('canvas')
        canvas.width = CANVAS.W * CANVAS.SCALE
        canvas.height = info.height * CANVAS.SCALE
        const ctx = canvas.getContext('2d')
        ctx.scale(CANVAS.SCALE, CANVAS.SCALE)
        ctx.textBaseline = 'alphabetic'
        ctx.fillStyle = CF.bg
        ctx.fillRect(0, 0, CANVAS.W, info.height)
        roundRect(ctx, CANVAS.MARGIN, CANVAS.MARGIN, CANVAS.W - CANVAS.MARGIN * 2, info.height - CANVAS.MARGIN * 2, 20)
        ctx.fillStyle = CF.sheet
        ctx.fill()
        drawHeader(ctx, doc, info)
        // background groups first
        let i = 0
        while (i < info.lines.length) {
          const item = info.lines[i]
          if (item.line.bg) {
            let j = i
            while (j + 1 < info.lines.length && info.lines[j + 1].line.bg === item.line.bg) j += 1
            drawBox(ctx, item.line.bg, item.y, info.lines[j].y + info.lines[j].line.h)
            i = j + 1
          } else {
            i += 1
          }
        }
        // inline-code chips first, so their edges never cover a neighbour glyph
        for (const item of info.lines) {
          const line = item.line
          if (line.rule) continue
          const base = item.y + line.h / 2 + (line.size || 15) * 0.35
          for (const seg of line.segs) {
            if (!seg.code) continue
            const x = line.x0 + (seg.x || 0)
            roundRect(ctx, x + 1, base - seg.size * 0.92, Math.max(0, seg.w - 2), seg.size * 1.34, 3)
            ctx.fillStyle = CF.codeBg
            ctx.fill()
          }
        }
        // then text
        for (const item of info.lines) {
          const line = item.line
          const top = item.y
          if (line.rule) {
            ctx.fillStyle = CF.line
            ctx.fillRect(L, top + line.h / 2, CW, 1)
            continue
          }
          const base = top + line.h / 2 + (line.size || 15) * 0.35
          for (const seg of line.segs) {
            const x = line.x0 + (seg.x || 0)
            ctx.font = seg.font
            ctx.fillStyle = seg.fill || CF.text
            ctx.fillText(seg.text, x, base)
            if (seg.link) {
              ctx.fillStyle = 'rgba(77,107,254,0.35)'
              ctx.fillRect(x, base + 2, seg.w, 1)
            }
          }
        }
        drawFooter(ctx, doc, info)
        return canvas
      }
    }

    // ── UI ───────────────────────────────────────────────────────────────
    function ShareIcon() {
      return h(
        'svg',
        { viewBox: '0 0 20 20', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M10 12.6V3.6' }),
        h('path', { d: 'M6.7 6.9 10 3.6l3.3 3.3' }),
        h('path', { d: 'M4.4 11.2v3.3A1.7 1.7 0 0 0 6.1 16.2h7.8a1.7 1.7 0 0 0 1.7-1.7v-3.3' })
      )
    }

    function Row(props) {
      const item = props.item
      const t = props.t
      const chip = item.role === 'user' ? t('roleUser') : item.role === 'ai' ? t('roleAi') : item.role === 'tool' ? t('roleTool') : t('roleNotice')
      const text = previewText(item, t)
      return h(
        'label',
        { className: 'dss-row', 'data-role': item.role },
        h('input', { type: 'checkbox', checked: props.checked, onChange: () => props.onToggle(item.id) }),
        h('span', { className: 'dss-chip', 'data-role': item.role }, chip),
        h('span', { className: 'dss-rowtext' }, text),
        item.time && props.showTime ? h('span', { className: 'dss-clock' }, formatClock(item.time)) : null
      )
    }

    function previewText(item, t) {
      if (item.role === 'tool') {
        const args = toolArgsSummary(item, t)
        return item.toolName + ' · ' + args
      }
      if (item.role === 'note') return item.message === 'maxTokens' ? t('maxTokens') : item.message
      const raw = item.text || item.reasoning || ''
      const text = stripMarkdown(raw.length > 600 ? raw.slice(0, 600) : raw)
      return truncate(text, 160) || t('noArgs')
    }

    function SharePanel(props) {
      const { t, sessionId, useChat, useSessions, close } = props
      const title = useSessions ? useSessions((state) => (state.byId[sessionId] || {}).displayTitle) : ''
      const order = useChat ? useChat((state) => state.order) : undefined
      const nodes = useChat ? useChat((state) => state.nodes) : undefined
      const items = useMemo(() => collectItems(order, nodes), [order, nodes])
      const defaultIds = useMemo(() => new Set(items.filter((item) => item.role !== 'tool').map((item) => item.id)), [items])
      const [selected, setSelected] = useState(null)
      const [includeReasoning, setIncludeReasoning] = useState(false)
      const [showTime, setShowTime] = useState(true)
      const [busy, setBusy] = useState(false)
      const [status, setStatus] = useState({ text: '', tone: '' })
      const dialogRef = useRef(null)

      useEffect(() => {
        const element = dialogRef.current
        if (!element) return
        if (typeof element.showModal === 'function') {
          if (!element.open) element.showModal()
        }
        try {
          element.focus({ preventScroll: true })
        } catch {}
        const onCancel = (event) => {
          event.preventDefault()
          close?.()
        }
        element.addEventListener('cancel', onCancel)
        return () => {
          element.removeEventListener('cancel', onCancel)
          try {
            if (element.open) element.close()
          } catch {}
        }
      }, [])

      const selection = selected || defaultIds
      const selectedItems = items.filter((item) => selection.has(item.id))
      const model = useMemo(
        () =>
          buildDoc({
            title: title || t('untitled'),
            items: selectedItems,
            includeReasoning,
            showTime,
            t,
            now: new Date(),
          }),
        [items, selection, includeReasoning, showTime, title, t]
      )
      const docHtml = useMemo(() => renderDocHtml(previewDoc(model)), [model])
      const fileBase = useMemo(() => safeFileName(title || t('untitled')) + '-' + stamp(new Date()), [title, t])

      const toggle = (id) => {
        const next = new Set(selection)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelected(next)
        setStatus({ text: '', tone: '' })
      }
      const setAll = (mode) => {
        const next = new Set()
        for (const item of items) {
          if (mode === 'all') next.add(item.id)
          else if (mode === 'chat' && (item.role === 'user' || item.role === 'ai')) next.add(item.id)
        }
        setSelected(next)
        setStatus({ text: '', tone: '' })
      }

      const exportHtml = async () => {
        if (!model.entries.length) {
          setStatus({ text: t('statusEmpty'), tone: 'bad' })
          return
        }
        setBusy(true)
        try {
          await nextPaint()
          const html = buildHtmlFile(model, t)
          saveBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), fileBase + '.html')
          setStatus({ text: t('statusHtml'), tone: 'ok' })
        } catch (error) {
          console.error('[dsh-share-chat-card] html export failed', error)
          setStatus({ text: t('statusHtmlFail'), tone: 'bad' })
        } finally {
          setBusy(false)
        }
      }

      const exportPng = async () => {
        if (!model.entries.length) {
          setStatus({ text: t('statusEmpty'), tone: 'bad' })
          return
        }
        setBusy(true)
        setStatus({ text: t('busy'), tone: '' })
        try {
          await nextPaint()
          const pages = layoutPages(model)
          for (let index = 0; index < pages.length; index += 1) {
            setStatus({ text: t('busyPage', { i: index + 1, n: pages.length }), tone: '' })
            const canvas = renderPage(model, pages[index])
            const blob = await canvasToBlob(canvas)
            const suffix = pages.length > 1 ? '-' + String(index + 1).padStart(2, '0') : ''
            saveBlob(blob, fileBase + suffix + '.png')
            if (index + 1 < pages.length) await delay(240)
          }
          setStatus({ text: t('statusPng', { n: pages.length }), tone: 'ok' })
        } catch (error) {
          console.error('[dsh-share-chat-card] png export failed', error)
          setStatus({ text: t('statusPngFail'), tone: 'bad' })
        } finally {
          setBusy(false)
        }
      }

      const copyPng = async () => {
        if (!model.entries.length) {
          setStatus({ text: t('statusEmpty'), tone: 'bad' })
          return
        }
        if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
          setStatus({ text: t('statusCopyFail'), tone: 'bad' })
          return
        }
        setBusy(true)
        setStatus({ text: t('busy'), tone: '' })
        try {
          await nextPaint()
          const pages = layoutPages(model)
          const blob = await canvasToBlob(renderPage(model, pages[0]))
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          setStatus({ text: pages.length > 1 ? t('statusCopyMulti') : t('statusCopied'), tone: 'ok' })
        } catch (error) {
          console.error('[dsh-share-chat-card] copy failed', error)
          setStatus({ text: t('statusCopyFail'), tone: 'bad' })
        } finally {
          setBusy(false)
        }
      }

      return h(
        'dialog',
        {
          ref: dialogRef,
          className: 'dss-dialog',
          tabIndex: -1,
          'aria-label': t('dialogTitle'),
          onClick: (event) => {
            if (event.target === dialogRef.current) close()
          },
        },
        h('style', null, PANEL_CSS),
        h('style', null, DOC_CSS),
        h(
          'div',
          { className: 'dss-shell' },
          h(
            'div',
            { className: 'dss-top' },
            h(
              'div',
              { className: 'dss-top-main' },
              h('div', { className: 'dss-eyebrow' }, t('eyebrow')),
              h('div', { className: 'dss-title' }, title || t('untitled')),
              h('div', { className: 'dss-hint' }, t('hint'))
            ),
            h(
              'button',
              { className: 'dss-iconbtn', type: 'button', 'aria-label': t('close'), onClick: close },
              h(
                'svg',
                { viewBox: '0 0 20 20', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' },
                h('path', { d: 'M5 5 15 15M15 5 5 15' })
              )
            )
          ),
          h(
            'div',
            { className: 'dss-body' },
            h(
              'div',
              { className: 'dss-side' },
              h(
                'div',
                { className: 'dss-side-head' },
                h('span', null, t('listTitle')),
                h('span', { className: 'dss-count' }, t('selected', { n: selectedItems.length, total: items.length }))
              ),
              h(
                'div',
                { className: 'dss-tools-row' },
                h('button', { className: 'dss-mini', type: 'button', onClick: () => setAll('all') }, t('selectAll')),
                h('button', { className: 'dss-mini', type: 'button', onClick: () => setAll('none') }, t('clearAll')),
                h('button', { className: 'dss-mini', type: 'button', onClick: () => setAll('chat') }, t('chatOnly'))
              ),
              h(
                'div',
                { className: 'dss-list' },
                items.length
                  ? items.map((item) =>
                      h(Row, {
                        key: item.id,
                        item,
                        t,
                        checked: selection.has(item.id),
                        showTime,
                        onToggle: toggle,
                      })
                    )
                  : h('div', { className: 'dss-empty' }, t('emptyList'))
              )
            ),
            h(
              'div',
              { className: 'dss-pre' },
              h('div', { className: 'dss-pre-head' }, h('span', null, t('preview')), h('span', null, 'PNG / HTML')),
              h('div', { className: 'dss-pre-body' }, h('div', { className: 'dss-pre-doc' }, h('div', { dangerouslySetInnerHTML: { __html: docHtml } })))
            )
          ),
          h(
            'div',
            { className: 'dss-foot' },
            h(
              'div',
              { className: 'dss-opts' },
              h(
                'label',
                { className: 'dss-check' },
                h('input', { type: 'checkbox', checked: includeReasoning, onChange: (event) => setIncludeReasoning(event.target.checked) }),
                t('optionReasoning')
              ),
              h(
                'label',
                { className: 'dss-check' },
                h('input', { type: 'checkbox', checked: showTime, onChange: (event) => setShowTime(event.target.checked) }),
                t('optionTime')
              )
            ),
            h(
              'div',
              { className: 'dss-actions' },
              status.text ? h('span', { className: 'dss-status', 'data-tone': status.tone }, status.text) : null,
              h('button', { className: 'dss-btn', type: 'button', disabled: busy, onClick: copyPng }, t('copyPng')),
              h('button', { className: 'dss-btn', type: 'button', disabled: busy, onClick: exportHtml }, t('exportHtml')),
              h('button', { className: 'dss-btn', 'data-kind': 'primary', type: 'button', disabled: busy, onClick: exportPng }, t('exportPng'))
            )
          )
        )
      )
    }

    function ShareTrigger(props) {
      const [open, setOpen] = useState(false)
      const { t } = props
      useEffect(() => {
        if (!open) return
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [open])
      return h(
        'div',
        { className: 'dss-dock' },
        h('style', null, PANEL_CSS),
        h(
          'button',
          {
            className: 'dss-trigger',
            type: 'button',
            title: t('dialogTitle'),
            'aria-label': t('dialogTitle'),
            onClick: () => setOpen(true),
          },
          h(ShareIcon),
          h('span', null, t('trigger'))
        ),
        open
          ? h(SharePanel, {
              t,
              sessionId: props.sessionId,
              useChat: props.useChat,
              useSessions: props.useSessions,
              close: () => setOpen(false),
            })
          : null
      )
    }

    // ── plugin ───────────────────────────────────────────────────────────
    function apply(ctx) {
      const t = typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : (key) => key
      ctx.effect(() => {
        const offZh = ctx.locale.register(NS, 'zh', ZH)
        const offEn = ctx.locale.register(NS, 'en', EN)
        return () => {
          offZh()
          offEn()
        }
      })
      ctx.slots.inject('conversation.composer.dock', () =>
        ctx.slots.register(
          {
            name: 'conversation.composer.dock',
            id: TRIGGER_ID,
            order: 12,
            inject: () => ({ t }),
          },
          ShareTrigger
        )
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    }
  },
})
