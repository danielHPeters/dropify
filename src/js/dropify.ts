const pluginName = 'dropify'

/**
 * Dropify plugin
 *
 */
export default class Dropify {
  private static readonly defaults = {
    defaultFile: '',
    maxFileSize: 0,
    minWidth: 0,
    maxWidth: 0,
    minHeight: 0,
    maxHeight: 0,
    showRemove: true,
    showLoader: true,
    showErrors: true,
    errorTimeout: 3000,
    errorsPosition: 'overlay',
    imgFileExtensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'],
    maxFileSizePreview: '5M',
    allowedFormats: ['portrait', 'square', 'landscape'],
    allowedFileExtensions: ['*'],
    messages: {
      'default': 'Drag and drop a file here or click',
      'replace': 'Drag and drop or click to replace',
      'remove': 'Remove',
      'error': 'Ooops, something wrong happended.'
    },
    error: {
      'fileSize': 'The file size is too big ({{ value }} max).',
      'minWidth': 'The image width is too small ({{ value }}}px min).',
      'maxWidth': 'The image width is too big ({{ value }}}px max).',
      'minHeight': 'The image height is too small ({{ value }}}px min).',
      'maxHeight': 'The image height is too big ({{ value }}px max).',
      'imageFormat': 'The image format is not allowed ({{ value }} only).',
      'fileExtension': 'The file is not allowed ({{ value }} only).'
    },
    tpl: {
      wrap: '<div class="dropify-wrapper"></div>',
      loader: '<div class="dropify-loader"></div>',
      message: '<div class="dropify-message"><span class="file-icon" /> <p>{{ default }}</p></div>',
      preview: '<div class="dropify-preview"><span class="dropify-render"></span><div class="dropify-infos"><div class="dropify-infos-inner"><p class="dropify-infos-message">{{ replace }}</p></div></div></div>',
      filename: '<p class="dropify-filename"><span class="dropify-filename-inner"></span></p>',
      clearButton: '<button type="button" class="dropify-clear">{{ remove }}</button>',
      errorLine: '<p class="dropify-error">{{ error }}</p>',
      errorsContainer: '<div class="dropify-errors-container"><ul></ul></div>'
    }
  }
  private element: HTMLInputElement
  private input: JQuery<HTMLElement>
  private loader: JQuery<HTMLElement>
  private wrapper: JQuery<HTMLElement>
  private clearButton: JQuery<HTMLElement>
  private preview: JQuery<HTMLElement>
  private filenameWrapper: JQuery<HTMLElement>
  private errorsContainer: JQuery<HTMLElement>
  private settings
  private errorsEvent
  isDisabled: boolean
  isInit: boolean
  file: { object: File; name: string; size: number; width: number; height: number; type: string }

  constructor (element: HTMLInputElement, options) {
    this.element = element
    this.input = $(this.element)
    this.wrapper = null
    this.preview = null
    this.filenameWrapper = null
    this.settings = $.extend(true, Dropify.defaults, options, this.input.data())
    this.errorsEvent = $.Event('dropify.errors')
    this.isDisabled = false
    this.isInit = false
    this.file = {
      object: null,
      name: null,
      size: null,
      width: null,
      height: null,
      type: null
    }

    if (!Array.isArray(this.settings.allowedFormats)) {
      this.settings.allowedFormats = this.settings.allowedFormats.split(' ')
    }

    if (!Array.isArray(this.settings.allowedFileExtensions)) {
      this.settings.allowedFileExtensions = this.settings.allowedFileExtensions.split(' ')
    }

    this.onChange = this.onChange.bind(this)
    this.clearElement = this.clearElement.bind(this)
    this.onFileReady = this.onFileReady.bind(this)

    this.translateMessages()
    this.createElements()
    this.setContainerSize()

    this.errorsEvent.errors = []

    this.input.on('change', this.onChange)
  }

  /**
   * On change event
   */
  onChange (): void {
    this.resetPreview()
    this.readFile(this.element)
  }

  /**
   * Create dom elements
   */
  createElements (): void {
    this.isInit = true
    this.input.wrap($(this.settings.tpl.wrap))
    this.wrapper = this.input.parent()

    const messageWrapper = $(this.settings.tpl.message).insertBefore(this.input)
    $(this.settings.tpl.errorLine).appendTo(messageWrapper)

    if (this.isTouchDevice() === true) {
      this.wrapper.addClass('touch-fallback')
    }

    if (this.input.attr('disabled')) {
      this.isDisabled = true
      this.wrapper.addClass('disabled')
    }

    if (this.settings.showLoader === true) {
      this.loader = $(this.settings.tpl.loader)
      this.loader.insertBefore(this.input)
    }

    this.preview = $(this.settings.tpl.preview)
    this.preview.insertAfter(this.input)

    if (this.isDisabled === false && this.settings.showRemove === true) {
      this.clearButton = $(this.settings.tpl.clearButton)
      this.clearButton.insertAfter(this.input)
      this.clearButton.on('click', this.clearElement)
    }

    this.filenameWrapper = $(this.settings.tpl.filename)
    this.filenameWrapper.prependTo(this.preview.find('.dropify-infos-inner'))

    if (this.settings.showErrors === true) {
      this.errorsContainer = $(this.settings.tpl.errorsContainer)

      if (this.settings.errorsPosition === 'outside') {
        this.errorsContainer.insertAfter(this.wrapper)
      } else {
        this.errorsContainer.insertBefore(this.input)
      }
    }

    const defaultFile = this.settings.defaultFile || ''

    if (defaultFile.trim() !== '') {
      this.file.name = this.cleanFilename(defaultFile)
      this.setPreview(this.isImage(), defaultFile)
    }
  }

  /**
   * Read the file using FileReader
   *
   * @param input
   */
  readFile (input: HTMLInputElement): void {
    if (input.files && input.files[0]) {
      const file = input.files[0]

      this.clearErrors()
      this.showLoader()
      this.setFileInformations(file)
      this.errorsEvent.errors = []
      this.checkFileSize()
      this.isFileExtensionAllowed()

      if (this.isImage() && this.file.size < this.sizeToByte(this.settings.maxFileSizePreview)) {
        const reader = new FileReader()
        const image = new Image()

        reader.readAsDataURL(file)
        reader.onload = () => {
          const srcBase64 = reader.result
          image.src = reader.result.toString()
          image.onload = () => {
            this.setFileDimensions(image.width, image.height)
            this.validateImage()
            this.onFileReady(true, srcBase64)
          }

        }
      } else {
        this.onFileReady(false)
      }
    }
  }

  /**
   * On file ready to show.
   *
   * @param event
   * @param previewable
   * @param src
   */
  onFileReady (previewable: boolean, src: string | ArrayBuffer = '') {

    if (this.errorsEvent.errors.length === 0) {
      this.setPreview(previewable, src)
    } else {
      this.input.trigger(this.errorsEvent, [this])
      for (let i = this.errorsEvent.errors.length - 1; i >= 0; i--) {
        const errorNamespace = this.errorsEvent.errors[i].namespace
        const errorKey = errorNamespace.split('.').pop()
        this.showError(errorKey)
      }

      if (typeof this.errorsContainer !== undefined) {
        this.errorsContainer.addClass('visible')

        setTimeout(() => { this.errorsContainer[0].classList.remove('visible') }, this.settings.errorTimeout)
      }

      this.wrapper[0].classList.add('has-error')
      this.resetPreview()
      this.clearElement()
    }
  }

  /**
   * Set file information.
   *
   * @param file
   */
  setFileInformations (file: File): void {
    this.file.object = file
    this.file.name = file.name
    this.file.size = file.size
    this.file.type = file.type
    this.file.width = null
    this.file.height = null
  }

  /**
   * Set file dimensions.
   *
   * @param width
   * @param height
   */
  setFileDimensions (width: number, height: number) {
    this.file.width = width
    this.file.height = height
  }

  /**
   * Set the preview and animate it.
   *
   * @param previewable
   * @param src
   */
  setPreview (previewable: boolean, src: string | ArrayBuffer): void {
    this.wrapper.removeClass('has-error').addClass('has-preview')
    this.filenameWrapper.children('.dropify-filename-inner').html(this.file.name)
    const render = this.preview.children('.dropify-render')

    this.hideLoader()

    if (previewable) {
      const imgTag = $(`<img src="${src}" alt="Upload preview">`)

      if (this.settings.height) {
        imgTag.css('max-height', this.settings.height)
      }

      imgTag.appendTo(render)
    } else {
      $('<i>').attr('class', 'dropify-font-file').appendTo(render)
      $('<span class="dropify-extension">').html(this.getFileType()).appendTo(render)
    }
    this.preview.fadeIn()
  }

  /**
   * Reset the preview
   */
  resetPreview (): void {
    this.wrapper.removeClass('has-preview')
    const render = this.preview.children('.dropify-render')
    render.find('.dropify-extension').remove()
    render.find('i').remove()
    render.find('img').remove()
    this.preview.hide()
    this.hideLoader()
  }

  /**
   * Clean the src and get the filename.
   *
   * @param src
   */
  cleanFilename (src: string): string {
    let filename = src.split('\\').pop()
    if (filename === src) {
      filename = src.split('/').pop()
    }

    return src !== '' ? filename : ''
  }

  /**
   * Clear the element, events are available
   */
  clearElement (): void {
    if (this.errorsEvent.errors.length === 0) {
      const eventBefore = $.Event('dropify.beforeClear')
      this.input.trigger(eventBefore, [this])

      if (eventBefore.result !== false) {
        this.resetFile()
        this.input.val('')
        this.resetPreview()

        this.input.trigger($.Event('dropify.afterClear'), [this])
      }
    } else {
      this.resetFile()
      this.input.val('')
      this.resetPreview()
    }
  }

  /**
   * Reset file informations
   */
  resetFile (): void {
    this.file.object = null
    this.file.name = null
    this.file.size = null
    this.file.type = null
    this.file.width = null
    this.file.height = null
  }

  /**
   * Set the container height.
   */
  setContainerSize (): void {
    if (this.settings.height) {
      this.wrapper.height(this.settings.height)
    }
  }

  /**
   * Test if it's touch screen.
   *
   * @return
   */
  isTouchDevice (): boolean {
    return (('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (navigator.msMaxTouchPoints > 0))
  }

  /**
   * Get the file type.
   *
   * @return
   */
  getFileType (): string {
    return this.file.name.split('.').pop().toLowerCase()
  }

  /**
   * Test if the file is an image
   *
   * @return
   */
  isImage (): boolean {
    return this.settings.imgFileExtensions.indexOf(this.getFileType()) !== -1
  }

  /**
   * Test if the file extension is allowed
   *
   * @return
   */
  isFileExtensionAllowed (): boolean {
    const isAllowed = this.settings.allowedFileExtensions.indexOf('*') !== -1
      || this.settings.allowedFileExtensions.indexOf(this.getFileType()) !== -1

    if (!isAllowed) {
      this.pushError('fileExtension')
    }

    return isAllowed
  }

  /**
   * Translate messages if needed.
   */
  translateMessages (): void {
    this.settings.tpl.forEach(name => {
      this.settings.messages.forEach(key => {
        this.settings.tpl[name] = this.settings.tpl[name].replace('{{ ' + key + ' }}', this.settings.messages[key])
      })
    })
  }

  /**
   * Check the limit file size.
   */
  checkFileSize (): void {
    if (this.sizeToByte(this.settings.maxFileSize) !== 0 && this.file.size > this.sizeToByte(this.settings.maxFileSize)) {
      this.pushError('fileSize')
    }
  }

  /**
   * Convert file size to bytes.
   *
   * @return size
   */
  sizeToByte (size: string): number {
    let value = 0

    if (size !== '0') {
      let unit = size.slice(-1).toUpperCase(),
        kb = 1024,
        mb = kb * 1024,
        gb = mb * 1024

      if (unit === 'K') {
        value = parseFloat(size) * kb
      } else if (unit === 'M') {
        value = parseFloat(size) * mb
      } else if (unit === 'G') {
        value = parseFloat(size) * gb
      }
    }

    return value
  }

  /**
   * Validate image dimensions and format.
   */
  validateImage (): void {
    if (this.settings.minWidth !== 0 && this.settings.minWidth >= this.file.width) {
      this.pushError('minWidth')
    }

    if (this.settings.maxWidth !== 0 && this.settings.maxWidth <= this.file.width) {
      this.pushError('maxWidth')
    }

    if (this.settings.minHeight !== 0 && this.settings.minHeight >= this.file.height) {
      this.pushError('minHeight')
    }

    if (this.settings.maxHeight !== 0 && this.settings.maxHeight <= this.file.height) {
      this.pushError('maxHeight')
    }

    if (this.settings.allowedFormats.indexOf(this.getImageFormat()) == '-1') {
      this.pushError('imageFormat')
    }
  }

  /**
   * Get image format.
   *
   * @return
   */
  getImageFormat (): string {
    let format

    if (this.file.width === this.file.height) {
      format = 'square'
    } else if (this.file.width < this.file.height) {
      format = 'portrait'
    } else if (this.file.width > this.file.height) {
      format = 'landscape'
    } else {
      format = ''
    }

    return format
  }

  /**
   * Push error.
   *
   * @param errorKey
   */
  pushError (errorKey: string): void {
    const e = $.Event('dropify.error.' + errorKey)
    this.errorsEvent.errors.push(e)
    this.input.trigger(e, [this])
  }

  /**
   * Clear errors.
   */
  clearErrors (): void {
    if (typeof this.errorsContainer !== undefined) {
      this.errorsContainer.children('ul').html('')
    }
  }

  /**
   * Show error in DOM.
   *
   * @param  errorKey
   */
  showError (errorKey: string): void {
    if (typeof this.errorsContainer !== undefined) {
      this.errorsContainer.children('ul').append('<li>' + this.getError(errorKey) + '</li>')
    }
  }

  /**
   * Get error message.
   *
   * @return message
   */
  getError (errorKey: string): string {
    const error = this.settings.error[errorKey]
    let value = ''

    if (errorKey === 'fileSize') {
      value = this.settings.maxFileSize
    } else if (errorKey === 'minWidth') {
      value = this.settings.minWidth
    } else if (errorKey === 'maxWidth') {
      value = this.settings.maxWidth
    } else if (errorKey === 'minHeight') {
      value = this.settings.minHeight
    } else if (errorKey === 'maxHeight') {
      value = this.settings.maxHeight
    } else if (errorKey === 'imageFormat') {
      value = this.settings.allowedFormats.join(', ')
    } else if (errorKey === 'fileExtension') {
      value = this.settings.allowedFileExtensions.join(', ')
    }

    if (value !== '') {
      return error.replace('{{ value }}', value)
    }

    return error
  }

  /**
   * Show the loader.
   */
  showLoader (): void {
    if (typeof this.loader !== undefined) {
      this.loader.show()
    }
  }

  /**
   * Hide the loader.
   */
  hideLoader (): void {
    if (typeof this.loader !== undefined) {
      this.loader.hide()
    }
  }

  /**
   * Destroy dropify.
   */
  destroy (): void {
    this.input.siblings().remove()
    this.input.unwrap()
    this.isInit = false
  }

  /**
   * Init dropify.
   */
  init (): void {
    this.createElements()
  }
}

$.fn[pluginName] = function (options) {
  this.each(function () {
    if (!$.data(this, pluginName)) {
      $.data(this, pluginName, new Dropify(this, options))
    }
  })

  return this
}
