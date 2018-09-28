'use strict'

const gulp = require('gulp')
const $ = require('gulp-load-plugins')()
const meta = require('./package.json')

const argv = require('minimist')(process.argv.slice(2))

const jsDir = 'src/js/'
const sassDir = 'src/sass/'
const fontsDir = 'src/fonts/'
const distDir = 'dist'
const banner = [
  '/*!',
  ' * =============================================================',
  ' * <%= name %> v<%= version %> - <%= description %>',
  ' * <%= homepage %>',
  ' *',
  ' * (c) 2017 - <%= author %>',
  ' * =============================================================',
  ' */\n\n'
].join('\n')
const umdDeps = {
  dependencies: () => {
    return [
      {
        name: '$',
        amd: 'jquery',
        cjs: 'jquery',
        global: 'jQuery',
        param: '$'
      }
    ]
  }
}

const onError = function (err) {
  $.util.beep()
  console.log(err.toString())
  this.emit('end')
}

gulp.task('copy:fonts', () => {
  return gulp.src(fontsDir + '**/*')
    .pipe(gulp.dest(distDir + '/fonts'))
})

gulp.task('build:sass', () => {
  return gulp.src(sassDir + '*.sass')
    .pipe($.plumber({ errorHandler: onError }))
    .pipe($.sass({indentedSyntax: true}))
    .pipe($.autoprefixer())

    .pipe($.header(banner, meta))
    .pipe(gulp.dest(distDir + '/css'))

    .pipe($.if(!argv.dev, $.cleanCss()))
    .pipe($.if(!argv.dev, $.rename(meta.name + '.min.css')))
    .pipe($.if(!argv.dev, gulp.dest(distDir + '/css')))
})

gulp.task('build:js', () => {
  return gulp.src([jsDir + '*.js'])
    .pipe($.plumber({ errorHandler: onError }))
    .pipe(gulp.dest(distDir + '/js'))
    .pipe($.umd(umdDeps))

    .pipe($.header(banner, meta))
    .pipe($.rename(meta.name + '.js'))
    .pipe(gulp.dest(distDir + '/js'))

    .pipe($.if(!argv.dev, $.uglify()))
    .pipe($.if(!argv.dev, $.header(banner, meta)))
    .pipe($.if(!argv.dev, $.rename(meta.name + '.min.js')))
    .pipe($.if(!argv.dev, gulp.dest(distDir + '/js')))
})

gulp.task('watch:js', () => {
  gulp.watch(jsDir + 'src/**/*.js', gulp.series('build:js'))
})

gulp.task('watch:sass', () => {
  gulp.watch(sassDir + 'src/**/*.sass', gulp.series('build:sass'))
})

gulp.task('watch', gulp.parallel('watch:js', 'watch:sass'))
gulp.task('build', gulp.series('build:sass', 'build:js', 'copy:fonts'))

gulp.task('default', gulp.series('build', 'watch'))
