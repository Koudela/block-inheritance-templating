/**
 * block-inheritance-templating
 * block based template rendering engine
 *
 * @package block-inheritance-templating
 * @link https://github.com/Koudela/block-inheritance-templating/
 * @copyright Copyright (c) 2022-2025 Thomas Koudela
 * @license http://opensource.org/licenses/MIT MIT License
 */

export { render }

const maxBlockCount = 1000

function isNull(item) {
    return item === null || typeof item === 'undefined'
}

function isFnc(item) {
    return typeof item === 'function'
}

function error(message) {
    throw Error(message)
}

function rethrow(e) {
    throw e
}

/**
 * @param {*} fct
 * @param {Array} args
 *
 * @returns {*|null}
 */
function callFnc(fct, args) {
    return isFnc(fct) ? fct(...args) : null
}

/**
 * @param {Object} object
 * @param {string} name
 * @param {Array} args
 *
 * @returns {*|null}
 */
function callFncOnObj(object, name, args) {
    return callFnc(object[name] ?? null, args)
}

/**
 * @param {Object|function|null} dictionary
 *
 * @returns {function}
 */
function getDictionary(dictionary) {
    return isNull(dictionary) ? () => null : isFnc(dictionary) ? dictionary : name => (dictionary[name] ?? null)
}

/**
 * @param {function|Object|null} dictionary
 * @param {int|null} index
 *
 * @return Object
 */
function getLocalObj(dictionary, index=null) {
    return {
        vars: getDictionary(dictionary),
        index: index,
    }
}

function iterateChain(tpl, callback, result=null) {
    while (isNull(result) && !isNull(tpl)) {
        result = callback(tpl)
        tpl = tpl.parent
    }

    return result
}

/**
 * @param {Object|function} dictionary
 * @param name
 *
 * @returns {*|null}
 */
function get(dictionary, name) {
    return isFnc(dictionary) ? dictionary(name) : dictionary[name] ?? null
}
/**
 * Returns the first block-template-pair from the template inheritance chain
 * which overwrites the block named `blockName`. Entry point is the `template`.
 * Returns `[null, null]` if no such template is found.
 *
 * @param {string} blockName
 * @param {Object} template
 *
 * @returns {Array}
 */
function getBlockTemplate(blockName, template) {
    return iterateChain(template, tpl => {
        let blockFnc = get(tpl.block, blockName)

        return blockFnc ? [blockFnc, tpl] : null
    }) ?? [null, null]
}

/**
 * @param {function} dictionary
 * @param {string} blockName
 * @param {string} lang
 * @param {Object} local
 * @param {Object} fnc
 * @param {Object} startingTemplate
 * @param {Object} currentTemplate
 *
 * @return {function({string}): *} The `vars` function.
 */
function getVariablesFnc(dictionary, blockName, lang, local, fnc, startingTemplate, currentTemplate) {
    const args = [blockName, lang, local, fnc, startingTemplate, currentTemplate]

    /**
     * @param {string} name
     *
     * @return function The `vars` function. Looks up a variable name. First in
     *                  the local variables, second in the global variables, third
     *                  in the starting template variables, then in the parent,
     *                  then in the parents parent,... and last in the root template
     */
    return function(name) {
        let result = local.vars(name, ...args) ?? dictionary(name, ...args)

        return iterateChain(startingTemplate, tpl => isFnc(tpl.vars) ? tpl.vars(name, ...args) : ((tpl.vars ?? {})[name] ?? null), result)
    }
}

/**
 * Tries to call the function `name` with `args` and returns the result.
 * The function is first looked up on the `object` then on the `template`
 * inheritance chain. If both failed it calls `preset` with `args`. If preset
 * is not a function `preset` is returned.
 *
 * @param {string} name
 * @param {Array} args
 * @param {Object} object
 * @param {Object|null} template
 * @param {*} preset
 *
 * @returns {*|null}
 */
async function conditionalFncCall(name, args, object, template, preset = null) {

    let result = callFncOnObj(object, name, args)

    result = iterateChain(template, tpl => callFncOnObj(tpl.fnc ?? {}, name, args), result)

    return !isNull(result) ? result : (isFnc(preset) ? preset(...args) : preset)
}

/**
 * The user-land rendering function.
 *
 * @param {Object} template template
 * @param {function|Object|null} variables a function returning variable values for passed variable names or a dictionary
 * @param {string} lang the language code or an empty string if no translations are used
 * @param {Object} fnc an object mainly for user-land functionality (`fnc.trans`, `fnc.preCall`, `fnc.postCall`,
 *                     `fnc.preRender`, `fnc.postRender`, `fnc.setCache` and `fnc.getCache` have a special meaning in
 *                     the rendering context), `fnc.block`, `fnc.iterate` and `fnc.render` will be overwritten to
 *                     supply rendering functionality.
 * @param {string} entrypoint The block where rendering starts.
 *
 * @return {Promise<string>} The rendered main block of the `template`.
 */
async function render(template, variables=null, lang='', fnc={}, entrypoint='main') {
    const dictionary = getDictionary(variables)
    const origin = template
    let blockCount = 0

    /**
     * Renders the first block named `blockName` of the template inheritance chain.
     * Returns an empty string if the block does not exist.
     *
     * @param {string} blockName
     * @param {function|Object|null} localVariables a function returning variable values for passed variable names or a dictionary
     * @param {boolean} useDictionary
     *
     * @return {Promise<string>}
     */
    const block = async (blockName, localVariables, useDictionary=true) => {
        return await renderBlock(blockName, origin, localVariables, useDictionary)
    }

    /**
     * Takes the data as `local` object and renders the first block named
     * `blockName` of the template inheritance chain for each item.
     *
     * @param {string} blockName
     * @param {array} data
     * @param {string} separator
     * @param {boolean} useDictionary
     *
     * @return {Promise<string>}
     */
    const iterate = async (blockName, data, separator='', useDictionary=true) =>
        (await Promise.all(data.map(async (localVars, index) => await renderBlock(blockName, origin, getLocalObj(localVars, index), useDictionary)))).join(separator)

    /**
     * Same as block() with initialized local object and global variable scope always.
     */
    fnc.block = (blockName, localVariables) => block(blockName, getLocalObj(localVariables))

    /**
     * Same as iterate() with global variable scope always.
     */
    fnc.iterate = (blockName, data, separator='') => iterate(blockName, data, separator, true)

    fnc.render = (tpl, variables = dictionary, lng = lang, fnc={}, entrypoint='main') =>
        render(tpl, variables, lng, {...fnc}, entrypoint)

    /**
     * Renders the block named `blockName`. Entry point is the starting template.
     *
     * @param {string} blockName
     * @param {Object|null} startingTemplate
     * @param {Object} local
     * @param {boolean} useDictionary
     *
     * @return {Promise<string>}
     */
    const renderBlock = async (blockName, startingTemplate, local, useDictionary=true) => {

        try {
            blockCount += 1
            if (blockCount > maxBlockCount) error('block count exceeds limit of '+maxBlockCount)
    
            let blockFnc, currentTemplate, rendered
    
            if (isNull(startingTemplate)) return '';
    
            [blockFnc, currentTemplate] = getBlockTemplate(blockName, startingTemplate)
    
            if (!isFnc(blockFnc)) error(`block '${ blockName }' is not a function`);
    
            const varFnc = getVariablesFnc(useDictionary ? dictionary : ()=>null, blockName, lang, local, fnc, startingTemplate, currentTemplate)
    
            const args = [lang, blockName, currentTemplate, varFnc, local, fnc]
    
            /**
             * Renders the parent of the current block.
             *
             * @return {Promise<string>}
             */
            local.parent = async () => {
                return await renderBlock(blockName, currentTemplate.parent, local)
            }

            /**
             * Same as block(), with the initialized passed variable scope only. If omitted the last scope is used.
             */
            local.block = async (blockName, localVariables) => block(blockName, localVariables ? getLocalObj(localVariables) : local, false)

            /**
             * Same as iterate() with passed variable scope only.
             */
            local.iterate = async (blockName, data, separator='') => iterate(blockName, data, separator, false)

            local.lang = lang
    
            /**
             * Tries to fetch a translation for `item` in the current template
             * context. Returns the first result from `fnc.trans` and
             * `template.trans` that is not `null`.
             *
             * @param {string} item
             * @param {string|null} category
             *
             * @return {string}
             */
            local.trans = async (item, category=null) => {
                return await conditionalFncCall('trans', [item, category, ...args], fnc, startingTemplate, item)
            }
    
            try {
                await conditionalFncCall('preCall', args, fnc, startingTemplate)
    
                rendered = await conditionalFncCall('getCache', args, fnc, startingTemplate)
    
                if (isNull(rendered)) {
                    await conditionalFncCall('preRender', args, fnc, startingTemplate)
    
                    rendered = await blockFnc(varFnc, local, fnc)
    
                    if (typeof rendered !== 'string') error(`block '${blockName}' has to return a string`)
    
                    await conditionalFncCall('postRender', args, fnc, startingTemplate);
    
                    await conditionalFncCall('setCache', [rendered, ...args], fnc, startingTemplate)
                }
    
                await conditionalFncCall('postCall', args, fnc, startingTemplate)
            } catch (e) {
                rendered = '' + await conditionalFncCall('onError', [e, ...args], fnc, startingTemplate, rethrow)
            }
    
            return rendered    
        } catch(e) {
            e.message = (`${blockName} has thrown: ${ e.message }`)
            rethrow(e)
        }
    }

    return renderBlock(entrypoint, origin, getLocalObj(dictionary), false)
}
