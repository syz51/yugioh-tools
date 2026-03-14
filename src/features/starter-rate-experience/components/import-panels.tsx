import {
  EXTRA_DECK_MAX_CARDS,
  MAIN_DECK_MAX_CARDS,
  MAIN_DECK_MIN_CARDS,
  SIDE_DECK_MAX_CARDS,
} from '../../../lib/ydk'
import { MAX_UPLOAD_BYTES } from '../lib/constants'
import { formatByteLimit } from '../lib/utils'
import type { DeckImportModel } from '../types'

export function LandingDeckInput({
  inputId,
  model,
}: {
  inputId: string
  model: DeckImportModel
}) {
  return (
    <section className="surface-panel deck-input-panel">
      <div className="panel-header-row deck-input-header">
        <input
          id={inputId}
          className="sr-only"
          type="file"
          accept=".ydk,text/plain"
          disabled={model.isLoading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) {
              return
            }

            void model.handleFileSelection(file)
            event.target.value = ''
          }}
        />
        <div className="deck-input-actions">
          <label className="primary-button" htmlFor={inputId}>
            上传 .ydk
          </label>
          <button
            className="secondary-button"
            type="button"
            disabled={model.isLoading}
            onClick={model.loadSampleDeck}
          >
            载入示例卡组
          </button>
          <button
            className="secondary-button ghost"
            type="button"
            disabled={model.isLoading}
            onClick={model.clearWorkspace}
          >
            清空
          </button>
        </div>
      </div>

      <ImportStatusBanner model={model} />

      <form
        className="deck-editor-form"
        onSubmit={(event) => {
          event.preventDefault()
          void model.importDeck(model.draftText, model.sourceName)
        }}
      >
        <label className="deck-text-block" htmlFor={`${inputId}-editor`}>
          <span>直接粘贴</span>
          <textarea
            id={`${inputId}-editor`}
            className="deck-editor"
            placeholder={`#created by 你的名字\n#main\n89631139\n89631139\n#extra\n!side`}
            value={model.draftText}
            onChange={(event) => model.setDraftText(event.target.value)}
          />
        </label>

        <div className="deck-submit-row">
          <button className="primary-button" type="submit">
            {model.isLoading ? '正在载入卡组...' : '导入并开始分析'}
          </button>
          <div className="deck-limit-note">
            主卡组 {MAIN_DECK_MIN_CARDS} - {MAIN_DECK_MAX_CARDS} 张 ·
            额外卡组最多 {EXTRA_DECK_MAX_CARDS} 张 · 副卡组最多{' '}
            {SIDE_DECK_MAX_CARDS} 张 · 文件上限{' '}
            {formatByteLimit(MAX_UPLOAD_BYTES)}
          </div>
        </div>
      </form>
    </section>
  )
}

export function ImportGuidePanel() {
  return (
    <section className="surface-panel guide-panel">
      <div className="guide-panel-head">
        <p className="panel-kicker">使用说明</p>
        <h2>导入卡组，计算先手启动率。</h2>
      </div>

      <div className="guide-list">
        <article>
          <strong>1. 把卡表丢进来</strong>
          <p>
            上传模拟器导出的 <code>.ydk</code>{' '}
            文件，直接粘贴卡组文本，或者先用示例卡组试一下流程都可以。
          </p>
          <p>
            小提示：可以前往{' '}
            <a
              className="guide-inline-link"
              href="https://get-deck.com/"
              target="_blank"
              rel="noreferrer"
            >
              GetDeck工具
            </a>{' '}
            将截图导出为 <code>.ydk</code>。
          </p>
        </article>
        <article>
          <strong>2. 等它解析完成</strong>
          <p>
            系统会去补全卡片资料，准备好之后会自动跳到起手率面板，不需要手动切页。
          </p>
        </article>
        <article>
          <strong>3. 填一卡动数量，看命中率</strong>
          <p>
            在下一页输入主卡组里一共放了多少张一卡动，工具就会给出准确的起手命中率。
          </p>
        </article>
      </div>

      <dl className="guide-facts">
        <div>
          <dt>支持输入</dt>
          <dd>上传 .ydk 或直接粘贴文本</dd>
        </div>
        <div>
          <dt>切换方式</dt>
          <dd>导入成功后自动进入分析页</dd>
        </div>
        <div>
          <dt>统计范围</dt>
          <dd>目前只计算主卡组的一卡动</dd>
        </div>
        <div>
          <dt>当前限制</dt>
          <dd>
            主卡组 {MAIN_DECK_MIN_CARDS} - {MAIN_DECK_MAX_CARDS} 张 ·
            额外卡组最多 {EXTRA_DECK_MAX_CARDS} 张 · 副卡组最多{' '}
            {SIDE_DECK_MAX_CARDS} 张 · {formatByteLimit(MAX_UPLOAD_BYTES)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function ImportStatusBanner({ model }: { model: DeckImportModel }) {
  return (
    <section className="import-status-banner" aria-live="polite">
      {model.errorMessage ? (
        <p className="status-message is-error">{model.errorMessage}</p>
      ) : model.isLoading ? (
        <p className="status-message">正在从 YGOCDB 拉取卡片资料...</p>
      ) : (
        <p className="status-message">
          还没有导入卡组。先把卡表放进来，才能开始看起手率。
        </p>
      )}
    </section>
  )
}
