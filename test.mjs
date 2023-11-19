/**
 * block-inheritance-templating
 * block based template rendering engine
 *
 * @package block-inheritance-templating
 * @link https://github.com/Koudela/block-inheritance-templating/
 * @copyright Copyright (c) 2022 Thomas Koudela
 * @license http://opensource.org/licenses/MIT MIT License
 */

import test from 'ava'
import { render } from './index.mjs'

const getVarsFnc = (point, result=null) => {
    return (name) => {
        switch (name) {
            case point: return result ?? point
            default: return null
        }
    }
}

const printVars = async (vars) => vars('render')
    +'|'+((vars('block') + vars('iterate')) + vars('fncRender'))
    +'|'+vars('template')
    +'|'+vars('parent')+'#'

test('vars() passed as object', async t => {
    const varsObjectTemplate = {
        parent: {
            parent: null,
            block: { main: printVars },
            vars: {
                parent:'parent',
                block:'_',
                iterate:'_',
                fncRender:'_',
            },
        },
        block: {
            main: async (vars, local, fnc) => await printVars(vars, local)
                +await fnc.block('vars', { block:'block' })
                +await fnc.iterate('vars', [{ iterate:'i1' },{ iterate:'i2' }])
                +await fnc.render(varsObjectTemplate, { fncRender:'fncRender' }, 'en', {}, 'vars')
                +await local.parent(),
            vars: printVars

        },
        vars: {
            template:'template'
        },
    }
    const result = await render(varsObjectTemplate, { render: 'render' }, 'en')
    t.is(
        'render|___|template|parent#'
        +'render|block__|template|parent#'
        +'render|_i1_|template|parent#'
        +'render|_i2_|template|parent#'
        +'null|__fncRender|template|parent#'
        +'render|___|null|parent#',
        result
    )
})

test('vars() passed as function', async t => {
    const varsFunctionTemplate = {
        parent: {
            parent: null,
            block: { main: printVars },
            vars: (name) => {
                switch (name) {
                    case 'parent': return 'parent'
                    case 'block': case 'iterate': case 'fncRender': return '_'
                    default: return null
                }
            },
        },
        block: {
            main: async (vars, local, fnc) => await printVars(vars, local)
                +await fnc.block('vars', getVarsFnc('block'))
                +await fnc.iterate('vars', [getVarsFnc('iterate', 'i1'), getVarsFnc('iterate', 'i2')])
                +await fnc.render(varsFunctionTemplate, getVarsFnc('fncRender'), 'en', {}, 'vars')
                +await local.parent(),
            vars: printVars
        },
        vars: getVarsFnc('template')
    }
    const result = await render(varsFunctionTemplate, getVarsFnc('render'), 'en')
    t.is(
        'render|___|template|parent#'
        +'render|block__|template|parent#'
        +'render|_i1_|template|parent#'
        +'render|_i2_|template|parent#'
        +'null|__fncRender|template|parent#'
        +'render|___|null|parent#',
        result
    )
})

const getVarsInheritanceChainTemplate = (printVars) => {
    const varsInheritanceChainTemplate = {
        parent: {
            parent: null,
            block: {main: printVars},
            vars: {
                render: 'x',
                block: 'x',
                iterate: 'x',
                fncRender: 'x',
                template: 'x',
                parent: 'parent',
            },
        },
        block: {
            main: async (vars, local, fnc) => await printVars(vars, local)
                + await fnc.block('vars', {block: 'block'})
                + await fnc.iterate('vars', [{iterate: 'i1'}, {iterate: 'i2'}])
                + await fnc.render(varsInheritanceChainTemplate, {fncRender: 'fncRender'}, 'en', {}, 'vars')
                + await local.parent(),
            vars: printVars
        },
        vars: {
            render: '-',
            block: '-',
            iterate: '-',
            fncRender: '-',
            template: 'template',
        },
    }

    return varsInheritanceChainTemplate
}

test('vars() inheritance chain', async t => {
    const result = await render(getVarsInheritanceChainTemplate(printVars), {
        render:'render',
        block:'_',
        iterate:'_',
        fncRender:'_',
    }, 'en')
    t.is(
        'render|___|template|parent#'
        +'render|block__|template|parent#'
        +'render|_i1_|template|parent#'
        +'render|_i2_|template|parent#'
        +'-|--fncRender|template|parent#'
        +'render|___|x|parent#',
        result
    )
})

test('function passed to fnc', async t => {
    const template = {
        parent: null,
        block: {
            main: async (vars, local, fnc) => fnc.test()
        },
        fnc: {
            test: () => 'wtf'
        }
    }
    const result = await render(template, {}, 'en', { test: () => 'hello world' })
    t.is(result, 'hello world')
})

test('fnc.block() inheritance chain', async t => {
    const template = {
        parent: {
            parent: null,
            block: {
                main: () => ``,
                block: () => ``,
                childBlock: () => ``,
                parentBlock: async (vars, local, fnc) => `parentBlock|`+await fnc.block('childBlock'),
            }
        },
        block: {
            main: async (vars, local, fnc) => `main|`+await fnc.block('block'),
            block: async (vars, local, fnc) => `block|`+await fnc.block('parentBlock'),
            childBlock: () => `childBlock`,
        },
    }
    const result = await render(template, {}, 'en')
    t.is(result, 'main|block|parentBlock|childBlock')
})

test('fnc.iterate() inheritance chain', async t => {
    const template = {
        parent: {
            parent: null,
            block: {
                main: () => ``,
                block: () => ``,
                childBlock: () => ``,
                parentBlock: async (vars, local, fnc) => `parentBlock|`+await fnc.iterate('childBlock',[{}]),
            }
        },
        block: {
            main: async (vars, local, fnc) => `main|`+await fnc.iterate('block',[{}]),
            block: async (vars, local, fnc) => `block|`+await fnc.iterate('parentBlock',[{}]),
            childBlock: () => `childBlock`,
        },
    }
    const result = await render(template, {}, 'en')
    t.is(result, 'main|block|parentBlock|childBlock')
})

test('fnc.render()', async t => {
    const otherTemplate = {
        parent: null,
        block: {
            main: () => `otherTemplate`
        }
    }
    const template = {
        parent: null,
        block: {
            main: async (vars, local, fnc) =>
                await fnc.render(template, {}, 'en', {}, 'otherMain')
                +'|'+ await fnc.render(otherTemplate, {}, 'en'),
            otherMain: () => `otherMain`,
        },
    }
    const result = await render(template, {}, 'en')
    t.is(result, 'otherMain|otherTemplate')
})


test('local.parent()', async t => {
    const template = {
        parent: {
            parent: null,
            block: {
                main: () => `parentMain`
            }
        },
        block: {
            main: async (vars, local) => await local.parent()
        }
    }
    const result = await render(template, {}, 'en')
    t.is(result, 'parentMain')
})

test('local.lang', async t => {
    const template = {
        parent: null,
        block: {
            main: async (vars, local, fnc) => await fnc.block('lang')+'|'+await fnc.render(template, {}, 'de', {}, 'lang'),
            lang: (vars, local) => local.lang
        }
    }
    const result = await render(template, {}, 'en')
    t.is(result, 'en|de')
})

test('local.index', async t => {
    const template = {
        parent: null,
        block: {
            main: async (vars, local, fnc) => await fnc.iterate('iterate',[{},{},{}],'|'),
            iterate: (vars, local) => ''+local.index
        }
    }
    const result = await render(template, {}, 'en')
    t.is(result, '0|1|2')
})

test('local.vars()', async t => {
    const printVars = async (vars, local) => local.vars('render')
        +'|'+((local.vars('block') +''+ local.vars('iterate')) + local.vars('fncRender'))
        +'|'+local.vars('template')
        +'|'+local.vars('parent')+'#'
    const result = await render(getVarsInheritanceChainTemplate(printVars), {
        render:'render',
        block:'_',
        iterate:'_',
        fncRender:'_',
    }, 'en')
    t.is(
        'null|nullnullnull|null|null#'
        +'null|blocknullnull|null|null#'
        +'null|nulli1null|null|null#'
        +'null|nulli2null|null|null#'
        +'null|nullnullnull|null|null#'
        +'null|nullnullnull|null|null#',
        result
    )
})

test('local.trans() + special function trans()', async t => {
    const trans = async (name, category, lang) => {
        if (name === 'testName' && category === 'testCategory' && lang === 'en') return 'translated'
        if (name === 'testName' && category === 'testCategory' && lang === 'de') return 'übersetzt'
        return null
    }
    const template = {
        parent: {
            parent: null,
            block: {}
        },
        block: {
            main: async (vars, local) => await local.trans('testName', 'testCategory')
        },
    }
    let content = await render(template, {}, 'en', { trans })
    t.is(content, 'translated')
    content = await render(template, {}, 'de', { trans })
    t.is(content, 'übersetzt')
})

test('special function onError()', async t => {
    const template = {
        parent: null,
        block: {
            main: () => {
                throw new Error('Ups')
            }
        }
    }
    try {
        await render(template, {}, 'en')
        t.fail()
    } catch (e) {
        t.is('Ups', e.message)
    }
    const result = await render(template, {}, 'en', { onError: (e) => e.message + '!' })
    t.is(result, 'Ups!')
    try {
        await render(template, {}, 'en', { onError: (e) => { throw new Error(e.message + '?') }})
        t.fail()
    } catch (e) {
        t.is('Ups?', e.message)
    }
})

test('special functions getCache(), setCache(), preRender(), postRender(), preCall(), postCall()', async t => {
    const isCalled = {
        preCall: false,
        getCache: false,
        preRender: false,
        render: false,
        postRender: false,
        postCall: false,
    }
    const Cache = {}
    const setCache = (result, lang, blockName) => {
        if (!(lang in Cache)) Cache[lang] = {}
        Cache[lang][blockName] = result
    }
    const getCache = (lang, blockName) => {
        isCalled.getCache = new Date()
        return new Promise(resolve => setTimeout(() => {
            resolve(lang in Cache ? (Cache[lang][blockName] ?? null) : null)
        }, 1))
    }
    const preRender = () => {
        isCalled.preRender = new Date()
        return new Promise(resolve => setTimeout(resolve, 2));
    }
    const postRender = () => isCalled.postRender = new Date()
    const preCall = () => {
        isCalled.preCall = new Date()
        return new Promise(resolve => setTimeout(resolve, 2));
    }
    const postCall = () => isCalled.postCall = new Date()
    const template = {
        parent: null,
        block: {
            main: async () => {
                isCalled.render = new Date()
                return new Promise(resolve => setTimeout(() => resolve('main'), 1))
            }
        }
    }
    let result = await render(template, {}, 'en', { setCache, getCache, preRender, postRender, preCall, postCall })
    t.is(result, 'main')
    t.is(isCalled.preCall < isCalled.render, true)
    t.is(isCalled.preRender < isCalled.render, true)
    t.is(isCalled.render < isCalled.postRender, true)
    t.is(isCalled.render < isCalled.postCall, true)
    isCalled.preCall = false
    isCalled.getCache = false
    isCalled.preRender = false
    isCalled.render = false
    isCalled.postRender = false
    isCalled.postCall = false
    result = await render(template, {}, 'en', { setCache, getCache, preRender, postRender, preCall, postCall })
    t.is(result, 'main')
    t.is(isCalled.preRender, false)
    t.is(isCalled.postRender, false)
    t.is(isCalled.render, false)
    t.is(isCalled.preCall < isCalled.getCache, true)
    t.is(isCalled.getCache < isCalled.postCall, true)
})

test('special functions getCache(), setCache(), preRender(), postRender(), preCall(), postCall() inheritance chain', async t => {
    const isCalled = {
        preCall: false,
        getCache: false,
        preRender: false,
        render: false,
        postRender: false,
        postCall: false,
    }
    const Cache = {}
    const setCache = (result, lang, blockName) => {
        if (!(lang in Cache)) Cache[lang] = {}
        Cache[lang][blockName] = result
    }
    const getCache = (lang, blockName) => {
        isCalled.getCache = new Date()
        return new Promise(resolve => setTimeout(() => {
            resolve(lang in Cache ? (Cache[lang][blockName] ?? null) : null)
        }, 1))
    }
    const preRender = () => {
        isCalled.preRender = new Date()
        return new Promise(resolve => setTimeout(resolve, 2));
    }
    const postRender = () => isCalled.postRender = new Date()
    const preCall = () => {
        isCalled.preCall = new Date()
        return new Promise(resolve => setTimeout(resolve, 2));
    }
    const postCall = () => isCalled.postCall = new Date()
    const template = {
        parent: {
            parent: null,
            block: {},
            fnc: {
                setCache,
                preRender,
                preCall,
                getCache: null,
                postRender: null,
            }
        },
        block: {
            main: async () => {
                isCalled.render = new Date()
                return new Promise(resolve => setTimeout(() => resolve('main'), 1))
            }
        },
        fnc: {
            getCache,
            postRender,
            postCall: null,
        },
    }
    let result = await render(template, {}, 'en', { postCall })
    t.is(result, 'main')
    t.is(isCalled.preCall < isCalled.render, true)
    t.is(isCalled.preRender < isCalled.render, true)
    t.is(isCalled.render < isCalled.postRender, true)
    t.is(isCalled.render < isCalled.postCall, true)
    isCalled.preCall = false
    isCalled.getCache = false
    isCalled.preRender = false
    isCalled.render = false
    isCalled.postRender = false
    isCalled.postCall = false
    result = await render(template, {}, 'en', { postCall })
    t.is(result, 'main')
    t.is(isCalled.preRender, false)
    t.is(isCalled.postRender, false)
    t.is(isCalled.render, false)
    t.is(isCalled.preCall < isCalled.getCache, true)
    t.is(isCalled.getCache < isCalled.postCall, true)
})

test('render()', async t => {
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
            content: (vars) => vars('content'),
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
        },
    }

    const vars = {
        title: 'Hello World',
        navItems: [
            { href: 'https://hello.com', content: 'hugs to you' },
            { href: 'https://world.com', content: 'global issues' },
        ],
        content: '<p>some content</p>',
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

    t.is(output, `<!doctype html>
<html lang="en">
<head>
    <title>Hello World</title>
    <script>let that, be, empty</script>
</head>
<body>
    
    <nav>
        <a href=https://hello.com>(0) hugs to you</a>
        <a href=https://world.com>(1) global issues</a>
    </nav>
    <h1>Hello World</h1>
    <p>some content</p>
</body>
</html>`)
})
