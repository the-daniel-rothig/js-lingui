/* @flow */
import { interpolate } from './context'
import { isString, isFunction } from './essentials'
import t from './t'
import { select, plural, selectOrdinal } from './select'

type Catalog = { [key: string]: string | Function }
type Catalogs = { [key: string]: Catalog }

type Message = {|
  defaults?: string,
  values?: Object,
  formats?: Object
|}

type LanguageData = {
  plurals: Function
}
type AllLanguageData = { [key: string]: LanguageData }

type setupI18nProps = {
  language?: string,
  messages?: Catalogs,
  languageData?: AllLanguageData,
  development?: Object
}

class I18n {
  _language: string

  // Messages in all loaded language.
  _messages: Catalogs
  // Messages in active language. This is optimization, so we don't perform
  // object lookup _messages[language] for each translation.
  _activeMessages: Catalog

  _languageData: AllLanguageData

  _dev: Object

  t: Function
  plural: Function
  select: Function
  selectOrdinal: Function

  constructor () {
    // Messages and languageData are merged on load,
    // so we must initialize it manually
    this._activeMessages = {}
    this._messages = {}
    this._languageData = {}

    if (process.env.NODE_ENV !== 'production') {
      this.t = t
      this.select = select
      this.plural = plural(this)
      this.selectOrdinal = selectOrdinal(this)
    }
  }

  get availableLanguages (): Array<string> {
    return Object.keys(this._messages)
  }

  get messages (): Catalog {
    return this._activeMessages
  }

  get languageData (): LanguageData {
    const data = this._languageData[this.language]

    if (process.env.NODE_ENV !== 'production') {
      // Allow overriding data in development, useful for testing
      if (!data) {
        return this._dev.loadLanguageData(this.language)
      }
    }

    return data
  }

  get language (): string {
    return this._language
  }

  load (messages: Catalogs) {
    if (typeof messages !== 'object') return

    // deeply merge Catalogs
    Object.keys({ ...this._messages, ...messages }).forEach(language => {
      if (!this._messages[language]) this._messages[language] = {}

      let compiledMessages = messages[language] || {}

      if (process.env.NODE_ENV !== 'production') {
        if (this._dev && isFunction(this._dev.compile)) {
          compiledMessages = Object.keys(compiledMessages).reduce((dict, id) => {
            const msg = compiledMessages[id]
            dict[id] = isString(msg) ? this._dev.compile(msg) : msg
            return dict
          }, {})
        }
      }

      Object.assign(
        this._messages[language],
        compiledMessages
      )
    })
  }

  loadLanguageData (languageData: AllLanguageData) {
    if (!languageData) return
    Object.assign(this._languageData, languageData)
  }

  activate (language: string) {
    if (!language) return

    if (process.env.NODE_ENV !== 'production') {
      if (this.availableLanguages.indexOf(language) === -1) {
        console.warn(`Message catalog for locale "${language}" not loaded.`)
      }
    }

    this._language = language
    this._activeMessages = this._messages[this.language] || {}
  }

  use (language: string) {
    return setupI18n({
      language,
      messages: this._messages,
      languageData: this._languageData,
      development: this._dev
    })
  }

  // default translate method
  _ (id: string, { defaults, values = {}, formats = {} }: Message = {}) {
    let translation = this.messages[id] || defaults || id

    if (process.env.NODE_ENV !== 'production') {
      if (isString(translation) && this._dev && isFunction(this._dev.compile)) {
        translation = this._dev.compile(translation)
      }
    }

    if (typeof translation !== 'function') return translation
    return interpolate(translation, this.language, this.languageData)(values, formats)
  }

  pluralForm (n: number, pluralType?: 'cardinal' | 'ordinal' = 'cardinal'): string {
    return this.languageData.plurals(n, pluralType === 'ordinal')
  }

  development (config: Object) {
    this._dev = config
  }
}

function setupI18n (params?: setupI18nProps = {}): I18n {
  const i18n = new I18n()

  if (process.env.NODE_ENV !== 'production') {
    if (params.development) i18n.development(params.development)
  }

  if (params.messages) i18n.load(params.messages)
  if (params.language) i18n.activate(params.language)
  if (params.languageData) i18n.loadLanguageData(params.languageData)

  return i18n
}

export default setupI18n()
export { setupI18n }
export type { Message, Catalog, Catalogs, AllLanguageData, LanguageData, I18n }
