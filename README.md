# block-inheritance-templating

block based template rendering engine

## Features

* block based template inheritance (blocks can be overwritten or reused)
* translation hooks (integrates with nearly all translation apis)
* caching hooks (integrates with nearly all caching apis)
* livecycle hooks (easy to add new features, e.g. css collecting)
* extendable (all kinds of objects and functions can be passed into the template)

## Advantages

* small (~1.7kb minified)
* fast
* dependency free
* all features are documented and covered by tests
* pure javascript templates (no extra parsing overhead)
* dual use: frontend (browser) and backend (node)
* can be used with javascript template literals
* allows a logic-less template style or full-fledged template scripting

## the ***template***

Every object that has a `parent` and a `block` property is a template. 

The `parent` property is `null` or points to another template. As the parent can
have a parent template of its own, every template is the beginning of a template
(inheritance) chain. If a lookup in a template fails the lookup is repeated in
the parent, then in the parents parent and so on. Therefor the template chain 
should not create a circle.

The `block` property is an object of template blocks...

```js
const someTemplate = {
    parent: null,
    block: {
        main: (vars, local, fnc) => `...`,
        someBlock: (vars, local, fnc) => `...`,
        anotherBlock: (vars, local, fnc) => `...`,
    },
}
```

or a function returning template blocks.

```js
const someTemplate = {
    parent: null,
    block: name => {
        switch (name) {
            case 'main': return (vars, local, fnc) => `...`
            case 'someBlock': return (vars, local, fnc) => `...`
            case `anotherBlock`: return (vars, local, fnc) => `...`
            default: return null
        }
    },
}
```

## a ***template block***

A template block is an async function rooted in the `block` property of the 
template object. Its name is the property name. There are three arguments to 
this function `vars`, `local` and `fnc` supplied by the rendering engine.

A template block has to return a string value.

### the ***vars*** argument

The `vars` argument is a function by which all variables can be accessed that 
have been passed to the `render` call or are rooted in the `vars` property of 
the template chain.

```js
const variable = vars('someVariable')
```

### the ***fnc*** argument

The `fnc` object holds user-land functions passed to the `render` call and the
three (async) rendering functions `block`, `ìterate` and `render`.

```
- fnc.block (blockName, localVars)
- fnc.iterate (blockName, data, separator='')
- fnc.render (tpl, variables, lng, fnc={}, entrypoint='main')
```

The `block` function renders a block. It has to be a block of the same template
chain identified by the blocks name. As second argument local variables can be 
passed. If the same variable exists in the current `vars` function, it will be
overwritten by the passed variable.

```js
const renderedBlock = await fnc.block('someBlock', { someVar: 42, anotherVar: 'Hello World' })
```

The `iterate` function iterates `block` function calls over a data array. The 
result will be joined via the passed separator.

```js
const renderedBlocks = await fnc.iterate('someBlock', [/*...*/], '<hr/>')
```

The `render` function is **the** render function. By it one can render other 
template chains or the same template chain with other arguments.

```js
const renderedTemplate = await fnc.render(template, vars, lang, fnc, entrypoint)
```

### the ***local*** argument

The `local` argument holds some special functionality:

```
- local.parent()
- local.lang
- local.index
- local.vars(name)
- local.trans(item, category=null)
```

`local.parent()` looks for the same block in the templates inheritance chain and
renders it with the same arguments.

```js
const renderedParentBlock = await local.parent()
```

`local.lang` holds the current language in which the template is rendered.

```js
const currentLang = local.lang
```

`local.index` holds the current iteration index or null.

```js
const loopIndexIsEven = (local.index % 2 === 0)
```

`local.vars` is like the `vars` argument but holds the variables explicitly 
passed to the last block call only.

```js
const localVariable = local.vars('someLocalVariable')
```

`local.trans` translates an item in the current language via the special
function `trans()`.

```js
const translatedString = local.trans('hello', 'snippet.words')
```

## special functions

Some functions have a special meaning to the template engine. They can be passed 
by the `fnc` object or be rooted in the `fnc` property of the template
inheritance chain.

```
- trans (item, category, lang, blockName, template, vars, local, fnc) => ...
- onError (e,            lang, blockName, template, vars, local, fnc) => ...
- getCache (             lang, blockName, template, vars, local, fnc) => ...
- setCache (result,      lang, blockName, template, vars, local, fnc) => ...
- preRender (            lang, blockName, template, vars, local, fnc) => ...
- postRender (           lang, blockName, template, vars, local, fnc) => ...
- preCall (              lang, blockName, template, vars, local, fnc) => ...
- postCall (             lang, blockName, template, vars, local, fnc) => ...
```

### trans 

`trans()` is the translation function it can be accessed in the template via 
`local.trans(item, category)`.

### onError

`onError()` will be called if rendering or one of the other special functions
throws an error. If `onError()` does not throw an error the result is used 
instead of the rendered.

If no `onError()` function is found the error will be rethrown.

### getCache, setCache

`getCache()` and `setCache()` can be used to cache rendered blocks.

### preRender, postRender

`preRender()` will be called pre and `postRender()` post rendering. Both will 
not be called if the cache hits.

### preCall, postCall
`preCall()` will be called pre and `postCall()` post rendering. Both will
be called with or without a cache hit.

## how to ***render*** a template

```js
const render = require('./block-inheritance-templating').render
```

or 

```js
import { render } from './block-inheritance-templating/index.mjs'
```

then 

```js
const vars = {}
const lang = 'en'
const fnc = {}
const entrypoint = 'main'

const output = await render(template, vars, lang, fnc, entrypoint)
```


## Basic Example

```js
const render = require('./block-inheritance-templating').render

const parentTemplate = {
    parent: null,
    block: {
        main: async (vars, local, fnc) => {
            return `<!doctype html>
<html lang="${ await local.trans('lang') }">
<head>
    <title>${ vars('title') }</title>
    ${ await fnc.block('head') }
</head>
<body>
    ${ await fnc.block('nav') }
    <h1>${ vars('title') }</h1>
    ${ await fnc.block('content') }
</body>
</html>`
        },
        head: async function() {
            return `<script>let that, be, empty</script>`
        },
    },
}

const renderedTemplate = {
    parent: parentTemplate,
    block: {
        nav: async (vars, local, fnc) => {
            return `
    <nav>${ await fnc.iterate('navItemBlock', vars('navItems')) }
    </nav>`
        },
        navItemBlock: async (vars, local) => {
            return `
        <a href=${ vars('href') }>(${ local.index }) ${ vars('content') }</a>`
        },
        content: (vars) => vars('content'),
    },
}

const vars = { 
    title: 'Hello World', 
    navItems: [
        { href: 'https://hello.com', content: 'hugs to you' },
        { href: 'https://world.com', content: 'global issues' },
    ],
}

const lang = 'en'

const fnc = {
    trans: function(name, category, lang) {
        switch (name) {
            case 'lang': return lang
            default: return name
        }
    }
}

const output = await render(renderedTemplate, vars, lang, fnc);

// c o n s o l e . l o g (output) gives:
//
// <!doctype html>
// <html lang="en">
// <head>
//     <title>Hello World</title>
//     <script>let that, be, empty</script>
// </head>
// <body>
//     
//     <nav>
//         <a href=https://hello.com>(0) hugs to you</a>
//         <a href=https://world.com>(1) global issues</a>
//     </nav>
//     <h1>Hello World</h1>
//     <p>some content</p>
// </body>
// </html>
```
