
/**
 * @license alameda 1.2.1 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, https://github.com/requirejs/alameda/blob/master/LICENSE
 */
// Going sloppy because loader plugin execs may depend on non-strict execution.
/*jslint sloppy: true, nomen: true, regexp: true */
/*global document, navigator, importScripts, Promise, setTimeout */

var requirejs, require, define;
(function (global, Promise, undef) {
    if (!Promise) {
        throw new Error('No Promise implementation available');
    }

    var topReq, dataMain, src, subPath,
        bootstrapConfig = requirejs || require,
        hasOwn = Object.prototype.hasOwnProperty,
        contexts = {},
        queue = [],
        currDirRegExp = /^\.\//,
        urlRegExp = /^\/|\:|\?|\.js$/,
        commentRegExp = /\/\*[\s\S]*?\*\/|([^:"'=]|^)\/\/.*$/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        slice = Array.prototype.slice;

    if (typeof requirejs === 'function') {
        return;
    }

    var asap = Promise.resolve(undefined);

    // Could match something like ')//comment', do not lose the prefix to comment.
    function commentReplace(match, singlePrefix) {
        return singlePrefix || '';
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return obj && hasProp(obj, prop) && obj[prop];
    }

    function obj() {
        return Object.create(null);
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !Array.isArray(value) && typeof value !== 'function' &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    // Allow getting a global that expressed in
    // dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        value.split('.').forEach(function (part) {
            g = g[part];
        });
        return g;
    }

    function newContext(contextName) {
        var req, main, makeMap, callDep, handlers, checkingLater, load, context,
            defined = obj(),
            waiting = obj(),
            config = {
                // Defaults. Do not set a default for map
                // config to speed up normalize(), which
                // will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            mapCache = obj(),
            requireDeferreds = [],
            deferreds = obj(),
            calledDefine = obj(),
            calledPlugin = obj(),
            loadCount = 0,
            startTime = (new Date()).getTime(),
            errCount = 0,
            trackedErrors = obj(),
            urlFetched = obj(),
            bundlesMap = obj(),
            asyncResolve = Promise.resolve();

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part, length = ary.length;
            for (i = 0; i < length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // If at the start, or previous value is still ..,
                    // keep them so that when converted to a path it may
                    // still work when converted to a path, even though
                    // as an ID it is less than ideal. In larger point
                    // releases, may be better to just kick out an error.
                    if (i === 0 || (i === 1 && ary[2] === '..') || ary[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI,
                baseParts = baseName && baseName.split('/'),
                normalizedBaseParts = baseParts,
                map = config.map,
                starMap = map && map['*'];


            //Adjust any relative paths.
            if (name) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // If wanting node ID compatibility, strip .js from end
                // of IDs. Have to do this here, and not in nameToUrl
                // because node allows either .js or non .js to map
                // to same file.
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                // Starts with a '.' so need the baseName
                if (name[0].charAt(0) === '.' && baseParts) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = normalizedBaseParts.concat(name);
                }

                trimDots(name);
                name = name.join('/');
            }

            // Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        // Find the longest baseName segment match in the config.
                        // So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            // baseName segment has config, find if it has one for
                            // this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    // Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    // Check for a star map match, but just hold on to it,
                    // if there is a shorter segment match later in a matching
                    // config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function makeShimExports(value) {
            function fn() {
                var ret;
                if (value.init) {
                    ret = value.init.apply(global, arguments);
                }
                return ret || (value.exports && getGlobal(value.exports));
            }
            return fn;
        }

        function takeQueue(anonId) {
            var i, id, args, shim;
            for (i = 0; i < queue.length; i += 1) {
                // Peek to see if anon
                if (typeof queue[i][0] !== 'string') {
                    if (anonId) {
                        queue[i].unshift(anonId);
                        anonId = undef;
                    } else {
                        // Not our anon module, stop.
                        break;
                    }
                }
                args = queue.shift();
                id = args[0];
                i -= 1;

                if (!(id in defined) && !(id in waiting)) {
                    if (id in deferreds) {
                        main.apply(undef, args);
                    } else {
                        waiting[id] = args;
                    }
                }
            }

            // if get to the end and still have anonId, then could be
            // a shimmed dependency.
            if (anonId) {
                shim = getOwn(config.shim, anonId) || {};
                main(anonId, shim.deps || [], shim.exportsFn);
            }
        }

        function makeRequire(relName, topLevel) {
            var req = function (deps, callback, errback, alt) {
                var name, cfg;

                if (topLevel) {
                    takeQueue();
                }

                if (typeof deps === "string") {
                    if (handlers[deps]) {
                        return handlers[deps](relName);
                    }
                    // Just return the module wanted. In this scenario, the
                    // deps arg is the module name, and second arg (if passed)
                    // is just the relName.
                    // Normalize module name, if it contains . or ..
                    name = makeMap(deps, relName, true).id;
                    if (!(name in defined)) {
                        throw new Error('Not loaded: ' + name);
                    }
                    return defined[name];
                } else if (deps && !Array.isArray(deps)) {
                    // deps is a config object, not an array.
                    cfg = deps;
                    deps = undef;

                    if (Array.isArray(callback)) {
                        // callback is an array, which means it is a dependency list.
                        // Adjust args if there are dependencies
                        deps = callback;
                        callback = errback;
                        errback = alt;
                    }

                    if (topLevel) {
                        // Could be a new context, so call returned require
                        return req.config(cfg)(deps, callback, errback);
                    }
                }

                // Support require(['a'])
                callback = callback || function () {
                        // In case used later as a promise then value, return the
                        // arguments as an array.
                        return slice.call(arguments, 0);
                    };

                // Complete async to maintain expected execution semantics.
                return asyncResolve.then(function () {
                    // Grab any modules that were defined after a require call.
                    takeQueue();

                    return main(undef, deps || [], callback, errback, relName);
                });
            };

            req.isBrowser = typeof document !== 'undefined' &&
                typeof navigator !== 'undefined';

            req.nameToUrl = function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return req.nameToUrl(bundleId, ext, skipExt);
                }

                // If a colon is in the URL, it indicates a protocol is used and it is
                // just an URL to a file, or if it starts with a slash, contains a query
                // arg (i.e. ?) or ends with .js, then assume the user meant to use an
                // url and not a module id. The slash is important for protocol-less
                // URLs as well as full paths.
                if (urlRegExp.test(moduleName)) {
                    // Just a plain path, not module name lookup, so just return it.
                    // Add extension if it is included. This is a bit wonky, only non-.js
                    // things pass an extension, this method probably needs to be
                    // reworked.
                    url = moduleName + (ext || '');
                } else {
                    // A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    // For each module name segment, see if there is a path
                    // registered for it. Start with most specific name
                    // and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            // If an array, it means there are a few choices,
                            // Choose the one that is desired
                            if (Array.isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    // Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|^blob\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' ||
                        url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs && !/^blob\:/.test(url) ?
                    url + config.urlArgs(moduleName, url) : url;
            };

            /**
             * Converts a module name + .extension into an URL path.
             * *Requires* the use of a module name. It does not support using
             * plain URLs like nameToUrl.
             */
            req.toUrl = function (moduleNamePlusExt) {
                var ext,
                    index = moduleNamePlusExt.lastIndexOf('.'),
                    segment = moduleNamePlusExt.split('/')[0],
                    isRelative = segment === '.' || segment === '..';

                // Have a file extension alias, and it is not the
                // dots from a relative path.
                if (index !== -1 && (!isRelative || index > 1)) {
                    ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                    moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                }

                return req.nameToUrl(normalize(moduleNamePlusExt, relName), ext, true);
            };

            req.defined = function (id) {
                return makeMap(id, relName, true).id in defined;
            };

            req.specified = function (id) {
                id = makeMap(id, relName, true).id;
                return id in defined || id in deferreds;
            };

            return req;
        }

        function resolve(name, d, value) {
            if (name) {
                defined[name] = value;
                if (requirejs.onResourceLoad) {
                    requirejs.onResourceLoad(context, d.map, d.deps);
                }
            }
            d.finished = true;
            d.resolve(value);
        }

        function reject(d, err) {
            d.finished = true;
            d.rejected = true;
            d.reject(err);
        }

        function makeNormalize(relName) {
            return function (name) {
                return normalize(name, relName, true);
            };
        }

        function defineModule(d) {
            d.factoryCalled = true;

            var ret,
                name = d.map.id;

            try {
                ret = context.execCb(name, d.factory, d.values, defined[name]);
            } catch(err) {
                return reject(d, err);
            }

            if (name) {
                // Favor return value over exports. If node/cjs in play,
                // then will not have a return value anyway. Favor
                // module.exports assignment over exports object.
                if (ret === undef) {
                    if (d.cjsModule) {
                        ret = d.cjsModule.exports;
                    } else if (d.usingExports) {
                        ret = defined[name];
                    }
                }
            } else {
                // Remove the require deferred from the list to
                // make cycle searching faster. Do not need to track
                // it anymore either.
                requireDeferreds.splice(requireDeferreds.indexOf(d), 1);
            }
            resolve(name, d, ret);
        }

        // This method is attached to every module deferred,
        // so the "this" in here is the module deferred object.
        function depFinished(val, i) {
            if (!this.rejected && !this.depDefined[i]) {
                this.depDefined[i] = true;
                this.depCount += 1;
                this.values[i] = val;
                if (!this.depending && this.depCount === this.depMax) {
                    defineModule(this);
                }
            }
        }

        function makeDefer(name, calculatedMap) {
            var d = {};
            d.promise = new Promise(function (resolve, reject) {
                d.resolve = resolve;
                d.reject = function(err) {
                    if (!name) {
                        requireDeferreds.splice(requireDeferreds.indexOf(d), 1);
                    }
                    reject(err);
                };
            });
            d.map = name ? (calculatedMap || makeMap(name)) : {};
            d.depCount = 0;
            d.depMax = 0;
            d.values = [];
            d.depDefined = [];
            d.depFinished = depFinished;
            if (d.map.pr) {
                // Plugin resource ID, implicitly
                // depends on plugin. Track it in deps
                // so cycle breaking can work
                d.deps = [makeMap(d.map.pr)];
            }
            return d;
        }

        function getDefer(name, calculatedMap) {
            var d;
            if (name) {
                d = (name in deferreds) && deferreds[name];
                if (!d) {
                    d = deferreds[name] = makeDefer(name, calculatedMap);
                }
            } else {
                d = makeDefer();
                requireDeferreds.push(d);
            }
            return d;
        }

        function makeErrback(d, name) {
            return function (err) {
                if (!d.rejected) {
                    if (!err.dynaId) {
                        err.dynaId = 'id' + (errCount += 1);
                        err.requireModules = [name];
                    }
                    reject(d, err);
                }
            };
        }

        function waitForDep(depMap, relName, d, i) {
            d.depMax += 1;

            // Do the fail at the end to catch errors
            // in the then callback execution.
            callDep(depMap, relName).then(function (val) {
                d.depFinished(val, i);
            }, makeErrback(d, depMap.id)).catch(makeErrback(d, d.map.id));
        }

        function makeLoad(id) {
            var fromTextCalled;
            function load(value) {
                // Protect against older plugins that call load after
                // calling load.fromText
                if (!fromTextCalled) {
                    resolve(id, getDefer(id), value);
                }
            }

            load.error = function (err) {
                reject(getDefer(id), err);
            };

            load.fromText = function (text, textAlt) {
                /*jslint evil: true */
                var d = getDefer(id),
                    map = makeMap(makeMap(id).n),
                    plainId = map.id,
                    execError;

                fromTextCalled = true;

                // Set up the factory just to be a return of the value from
                // plainId.
                d.factory = function (p, val) {
                    return val;
                };

                // As of requirejs 2.1.0, support just passing the text, to reinforce
                // fromText only being called once per resource. Still
                // support old style of passing moduleName but discard
                // that moduleName in favor of the internal ref.
                if (textAlt) {
                    text = textAlt;
                }

                // Transfer any config to this other module.
                if (hasProp(config.config, id)) {
                    config.config[plainId] = config.config[id];
                }

                try {
                    req.exec(text);
                } catch (e) {
                    execError = new Error('fromText eval for ' + plainId +
                        ' failed: ' + e);
                    execError.requireType = 'fromtexteval';
                    reject(d, execError);
                }

                // Execute any waiting define created by the plainId
                takeQueue(plainId);

                // Mark this as a dependency for the plugin
                // resource
                d.deps = [map];
                waitForDep(map, null, d, d.deps.length);
            };

            return load;
        }

        load = typeof importScripts === 'function' ?
            function (map) {
                var url = map.url;
                if (urlFetched[url]) {
                    return;
                }
                urlFetched[url] = true;

                // Ask for the deferred so loading is triggered.
                // Do this before loading, since loading is sync.
                getDefer(map.id);
                importScripts(url);
                takeQueue(map.id);
            } :
            function (map) {
                var script,
                    id = map.id,
                    url = map.url;

                if (urlFetched[url]) {
                    return;
                }
                urlFetched[url] = true;

                script = document.createElement('script');
                script.setAttribute('data-requiremodule', id);
                script.type = config.scriptType || 'text/javascript';
                script.charset = 'utf-8';
                script.async = true;

                loadCount += 1;

                script.addEventListener('load', function () {
                    loadCount -= 1;
                    takeQueue(id);
                }, false);
                script.addEventListener('error', function () {
                    loadCount -= 1;
                    var err,
                        pathConfig = getOwn(config.paths, id);
                    if (pathConfig && Array.isArray(pathConfig) &&
                        pathConfig.length > 1) {
                        script.parentNode.removeChild(script);
                        // Pop off the first array value, since it failed, and
                        // retry
                        pathConfig.shift();
                        var d = getDefer(id);
                        d.map = makeMap(id);
                        // mapCache will have returned previous map value, update the
                        // url, which will also update mapCache value.
                        d.map.url = req.nameToUrl(id);
                        load(d.map);
                    } else {
                        err = new Error('Load failed: ' + id + ': ' + script.src);
                        err.requireModules = [id];
                        err.requireType = 'scripterror';
                        reject(getDefer(id), err);
                    }
                }, false);

                script.src = url;

                // If the script is cached, IE10 executes the script body and the
                // onload handler synchronously here.  That's a spec violation,
                // so be sure to do this asynchronously.
                if (document.documentMode === 10) {
                    asap.then(function() {
                        document.head.appendChild(script);
                    });
                } else {
                    document.head.appendChild(script);
                }
            };

        function callPlugin(plugin, map, relName) {
            plugin.load(map.n, makeRequire(relName), makeLoad(map.id), config);
        }

        callDep = function (map, relName) {
            var args, bundleId,
                name = map.id,
                shim = config.shim[name];

            if (name in waiting) {
                args = waiting[name];
                delete waiting[name];
                main.apply(undef, args);
            } else if (!(name in deferreds)) {
                if (map.pr) {
                    // If a bundles config, then just load that file instead to
                    // resolve the plugin, as it is built into that bundle.
                    if ((bundleId = getOwn(bundlesMap, name))) {
                        map.url = req.nameToUrl(bundleId);
                        load(map);
                    } else {
                        return callDep(makeMap(map.pr)).then(function (plugin) {
                            // Redo map now that plugin is known to be loaded
                            var newMap = map.prn ? map : makeMap(name, relName, true),
                                newId = newMap.id,
                                shim = getOwn(config.shim, newId);

                            // Make sure to only call load once per resource. Many
                            // calls could have been queued waiting for plugin to load.
                            if (!(newId in calledPlugin)) {
                                calledPlugin[newId] = true;
                                if (shim && shim.deps) {
                                    req(shim.deps, function () {
                                        callPlugin(plugin, newMap, relName);
                                    });
                                } else {
                                    callPlugin(plugin, newMap, relName);
                                }
                            }
                            return getDefer(newId).promise;
                        });
                    }
                } else if (shim && shim.deps) {
                    req(shim.deps, function () {
                        load(map);
                    });
                } else {
                    load(map);
                }
            }

            return getDefer(name).promise;
        };

        // Turns a plugin!resource to [plugin, resource]
        // with the plugin being undefined if the name
        // did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Makes a name map, normalizing the name, and using a plugin
         * for normalization if necessary. Grabs a ref to plugin
         * too, as an optimization.
         */
        makeMap = function (name, relName, applyMap) {
            if (typeof name !== 'string') {
                return name;
            }

            var plugin, url, parts, prefix, result, prefixNormalized,
                cacheKey = name + ' & ' + (relName || '') + ' & ' + !!applyMap;

            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];

            if (!prefix && (cacheKey in mapCache)) {
                return mapCache[cacheKey];
            }

            if (prefix) {
                prefix = normalize(prefix, relName, applyMap);
                plugin = (prefix in defined) && defined[prefix];
            }

            // Normalize according
            if (prefix) {
                if (plugin && plugin.normalize) {
                    name = plugin.normalize(name, makeNormalize(relName));
                    prefixNormalized = true;
                } else {
                    // If nested plugin references, then do not try to
                    // normalize, as it will not normalize correctly. This
                    // places a restriction on resourceIds, and the longer
                    // term solution is not to normalize until plugins are
                    // loaded and all normalizations to allow for async
                    // loading of a loader plugin. But for now, fixes the
                    // common uses. Details in requirejs#1131
                    name = name.indexOf('!') === -1 ?
                        normalize(name, relName, applyMap) :
                        name;
                }
            } else {
                name = normalize(name, relName, applyMap);
                parts = splitPrefix(name);
                prefix = parts[0];
                name = parts[1];

                url = req.nameToUrl(name);
            }

            // Using ridiculous property names for space reasons
            result = {
                id: prefix ? prefix + '!' + name : name, // fullName
                n: name,
                pr: prefix,
                url: url,
                prn: prefix && prefixNormalized
            };

            if (!prefix) {
                mapCache[cacheKey] = result;
            }

            return result;
        };

        handlers = {
            require: function (name) {
                return makeRequire(name);
            },
            exports: function (name) {
                var e = defined[name];
                if (typeof e !== 'undefined') {
                    return e;
                } else {
                    return (defined[name] = {});
                }
            },
            module: function (name) {
                return {
                    id: name,
                    uri: '',
                    exports: handlers.exports(name),
                    config: function () {
                        return getOwn(config.config, name) || {};
                    }
                };
            }
        };

        function breakCycle(d, traced, processed) {
            var id = d.map.id;

            traced[id] = true;
            if (!d.finished && d.deps) {
                d.deps.forEach(function (depMap) {
                    var depId = depMap.id,
                        dep = !hasProp(handlers, depId) && getDefer(depId, depMap);

                    // Only force things that have not completed
                    // being defined, so still in the registry,
                    // and only if it has not been matched up
                    // in the module already.
                    if (dep && !dep.finished && !processed[depId]) {
                        if (hasProp(traced, depId)) {
                            d.deps.forEach(function (depMap, i) {
                                if (depMap.id === depId) {
                                    d.depFinished(defined[depId], i);
                                }
                            });
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
            }
            processed[id] = true;
        }

        function check(d) {
            var err, mid, dfd,
                notFinished = [],
                waitInterval = config.waitSeconds * 1000,
                // It is possible to disable the wait interval by using waitSeconds 0.
                expired = waitInterval &&
                    (startTime + waitInterval) < (new Date()).getTime();

            if (loadCount === 0) {
                // If passed in a deferred, it is for a specific require call.
                // Could be a sync case that needs resolution right away.
                // Otherwise, if no deferred, means it was the last ditch
                // timeout-based check, so check all waiting require deferreds.
                if (d) {
                    if (!d.finished) {
                        breakCycle(d, {}, {});
                    }
                } else if (requireDeferreds.length) {
                    requireDeferreds.forEach(function (d) {
                        breakCycle(d, {}, {});
                    });
                }
            }

            // If still waiting on loads, and the waiting load is something
            // other than a plugin resource, or there are still outstanding
            // scripts, then just try back later.
            if (expired) {
                // If wait time expired, throw error of unloaded modules.
                for (mid in deferreds) {
                    dfd = deferreds[mid];
                    if (!dfd.finished) {
                        notFinished.push(dfd.map.id);
                    }
                }
                err = new Error('Timeout for modules: ' + notFinished);
                err.requireModules = notFinished;
                err.requireType = 'timeout';
                notFinished.forEach(function (id) {
                    reject(getDefer(id), err);
                });
            } else if (loadCount || requireDeferreds.length) {
                // Something is still waiting to load. Wait for it, but only
                // if a later check is not already scheduled. Using setTimeout
                // because want other things in the event loop to happen,
                // to help in dependency resolution, and this is really a
                // last ditch check, mostly for detecting timeouts (cycles
                // should come through the main() use of check()), so it can
                // wait a bit before doing the final check.
                if (!checkingLater) {
                    checkingLater = true;
                    setTimeout(function () {
                        checkingLater = false;
                        check();
                    }, 70);
                }
            }
        }

        // Used to break out of the promise try/catch chains.
        function delayedError(e) {
            setTimeout(function () {
                if (!e.dynaId || !trackedErrors[e.dynaId]) {
                    trackedErrors[e.dynaId] = true;
                    req.onError(e);
                }
            });
            return e;
        }

        main = function (name, deps, factory, errback, relName) {
            if (name) {
                // Only allow main calling once per module.
                if (name in calledDefine) {
                    return;
                }
                calledDefine[name] = true;
            }

            var d = getDefer(name);

            // This module may not have dependencies
            if (deps && !Array.isArray(deps)) {
                // deps is not an array, so probably means
                // an object literal or factory function for
                // the value. Adjust args.
                factory = deps;
                deps = [];
            }

            // Create fresh array instead of modifying passed in value.
            deps = deps ? slice.call(deps, 0) : null;

            if (!errback) {
                if (hasProp(config, 'defaultErrback')) {
                    if (config.defaultErrback) {
                        errback = config.defaultErrback;
                    }
                } else {
                    errback = delayedError;
                }
            }

            if (errback) {
                d.promise.catch(errback);
            }

            // Use name if no relName
            relName = relName || name;

            // Call the factory to define the module, if necessary.
            if (typeof factory === 'function') {

                if (!deps.length && factory.length) {
                    // Remove comments from the callback string,
                    // look for require calls, and pull them into the dependencies,
                    // but only if there are function args.
                    factory
                        .toString()
                        .replace(commentRegExp, commentReplace)
                        .replace(cjsRequireRegExp, function (match, dep) {
                            deps.push(dep);
                        });

                    // May be a CommonJS thing even without require calls, but still
                    // could use exports, and module. Avoid doing exports and module
                    // work though if it just needs require.
                    // REQUIRES the function to expect the CommonJS variables in the
                    // order listed below.
                    deps = (factory.length === 1 ?
                        ['require'] :
                        ['require', 'exports', 'module']).concat(deps);
                }

                // Save info for use later.
                d.factory = factory;
                d.deps = deps;

                d.depending = true;
                deps.forEach(function (depName, i) {
                    var depMap;
                    deps[i] = depMap = makeMap(depName, relName, true);
                    depName = depMap.id;

                    // Fast path CommonJS standard dependencies.
                    if (depName === "require") {
                        d.values[i] = handlers.require(name);
                    } else if (depName === "exports") {
                        // CommonJS module spec 1.1
                        d.values[i] = handlers.exports(name);
                        d.usingExports = true;
                    } else if (depName === "module") {
                        // CommonJS module spec 1.1
                        d.values[i] = d.cjsModule = handlers.module(name);
                    } else if (depName === undefined) {
                        d.values[i] = undefined;
                    } else {
                        waitForDep(depMap, relName, d, i);
                    }
                });
                d.depending = false;

                // Some modules just depend on the require, exports, modules, so
                // trigger their definition here if so.
                if (d.depCount === d.depMax) {
                    defineModule(d);
                }
            } else if (name) {
                // May just be an object definition for the module. Only
                // worry about defining if have a module name.
                resolve(name, d, factory);
            }

            startTime = (new Date()).getTime();

            if (!name) {
                check(d);
            }

            return d.promise;
        };

        req = makeRequire(null, true);

        /*
         * Just drops the config on the floor, but returns req in case
         * the config return value is used.
         */
        req.config = function (cfg) {
            if (cfg.context && cfg.context !== contextName) {
                var existingContext = getOwn(contexts, cfg.context);
                if (existingContext) {
                    return existingContext.req.config(cfg);
                } else {
                    return newContext(cfg.context).config(cfg);
                }
            }

            // Since config changed, mapCache may not be valid any more.
            mapCache = obj();

            // Make sure the baseUrl ends in a slash.
            if (cfg.baseUrl) {
                if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                    cfg.baseUrl += '/';
                }
            }

            // Convert old style urlArgs string to a function.
            if (typeof cfg.urlArgs === 'string') {
                var urlArgs = cfg.urlArgs;
                cfg.urlArgs = function(id, url) {
                    return (url.indexOf('?') === -1 ? '?' : '&') + urlArgs;
                };
            }

            // Save off the paths and packages since they require special processing,
            // they are additive.
            var shim = config.shim,
                objs = {
                    paths: true,
                    bundles: true,
                    config: true,
                    map: true
                };

            eachProp(cfg, function (value, prop) {
                if (objs[prop]) {
                    if (!config[prop]) {
                        config[prop] = {};
                    }
                    mixin(config[prop], value, true, true);
                } else {
                    config[prop] = value;
                }
            });

            // Reverse map the bundles
            if (cfg.bundles) {
                eachProp(cfg.bundles, function (value, prop) {
                    value.forEach(function (v) {
                        if (v !== prop) {
                            bundlesMap[v] = prop;
                        }
                    });
                });
            }

            // Merge shim
            if (cfg.shim) {
                eachProp(cfg.shim, function (value, id) {
                    // Normalize the structure
                    if (Array.isArray(value)) {
                        value = {
                            deps: value
                        };
                    }
                    if ((value.exports || value.init) && !value.exportsFn) {
                        value.exportsFn = makeShimExports(value);
                    }
                    shim[id] = value;
                });
                config.shim = shim;
            }

            // Adjust packages if necessary.
            if (cfg.packages) {
                cfg.packages.forEach(function (pkgObj) {
                    var location, name;

                    pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;

                    name = pkgObj.name;
                    location = pkgObj.location;
                    if (location) {
                        config.paths[name] = pkgObj.location;
                    }

                    // Save pointer to main module ID for pkg name.
                    // Remove leading dot in main, so main paths are normalized,
                    // and remove any trailing .js, since different package
                    // envs have different conventions: some use a module name,
                    // some use a file name.
                    config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                            .replace(currDirRegExp, '')
                            .replace(jsSuffixRegExp, '');
                });
            }

            // If a deps array or a config callback is specified, then call
            // require with those args. This is useful when require is defined as a
            // config object before require.js is loaded.
            if (cfg.deps || cfg.callback) {
                req(cfg.deps, cfg.callback);
            }

            return req;
        };

        req.onError = function (err) {
            throw err;
        };

        context = {
            id: contextName,
            defined: defined,
            waiting: waiting,
            config: config,
            deferreds: deferreds,
            req: req,
            execCb: function execCb(name, callback, args, exports) {
                return callback.apply(exports, args);
            }
        };

        contexts[contextName] = context;

        return req;
    }

    requirejs = topReq = newContext('_');

    if (typeof require !== 'function') {
        require = topReq;
    }

    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    topReq.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    topReq.contexts = contexts;

    define = function () {
        queue.push(slice.call(arguments, 0));
    };

    define.amd = {
        jQuery: true
    };

    if (bootstrapConfig) {
        topReq.config(bootstrapConfig);
    }

    // data-main support.
    if (topReq.isBrowser && !contexts._.config.skipDataMain) {
        dataMain = document.querySelectorAll('script[data-main]')[0];
        dataMain = dataMain && dataMain.getAttribute('data-main');
        if (dataMain) {
            // Strip off any trailing .js since dataMain is now
            // like a module name.
            dataMain = dataMain.replace(jsSuffixRegExp, '');

            // Set final baseUrl if there is not already an explicit one,
            // but only do so if the data-main value is not a loader plugin
            // module ID.
            if ((!bootstrapConfig || !bootstrapConfig.baseUrl) &&
                dataMain.indexOf('!') === -1) {
                // Pull off the directory of data-main for use as the
                // baseUrl.
                src = dataMain.split('/');
                dataMain = src.pop();
                subPath = src.length ? src.join('/')  + '/' : './';

                topReq.config({baseUrl: subPath});
            }

            topReq([dataMain]);
        }
    }
}(this, (typeof Promise !== 'undefined' ? Promise : undefined)));
define("alameda", function(){});

// when running in B2G, send output to the console, ANSI-style
/*global dump */

(function() {
  function consoleHelper() {
    let msg = arguments[0] + ':';
    for (let i = 1; i < arguments.length; i++) {
      msg += ' ' + arguments[i];
    }
    msg += '\x1b[0m\n';
    dump(msg);
  }

  if ('mozTCPSocket' in window.navigator) {
    window.console = {
      log: consoleHelper.bind(null, '\x1b[32mLOG'),
      error: consoleHelper.bind(null, '\x1b[31mERR'),
      info: consoleHelper.bind(null, '\x1b[36mINF'),
      warn: consoleHelper.bind(null, '\x1b[33mWAR')
    };
  }
  window.onerror = (msg, url, line) => {
    console.error('onerror reporting:', msg, '@', url, ':', line);
    return false;
  };
}());

define("console_hook", function(){});

/*
 * Custom events lib. Notable features:
 *
 * - the module itself is an event emitter. Useful for "global" pub/sub.
 * - evt.mix can be used to mix in an event emitter into existing object.
 * - notification of listeners is done in a try/catch, so all listeners
 *   are notified even if one fails. Errors are thrown async via setTimeout
 *   so that all the listeners can be notified without escaping from the
 *   code via a throw within the listener group notification.
 * - new evt.Emitter() can be used to create a new instance of an
 *   event emitter.
 * - Uses "this" insternally, so always call object with the emitter args
 * - emit takes an async turn before notifying listeners.
 * - However, `latest` and `latestOnce` will call the function in the same turn
 *   if the target of the `latest` calls is available at that time. of the first
 *   latest call.
 */

define('evt',[],function() {

  let evt,
      slice = Array.prototype.slice,
      props = ['_events', '_pendingEvents', 'on', 'once', 'latest',
               'latestOnce', 'removeListener', 'emitWhenListener', 'emit'];

  function Emitter() {
    this._events = {};
    this._pendingEvents = {};
  }

  Emitter.prototype = {
    on: function(id, fn) {
      let listeners = this._events[id],
          pending = this._pendingEvents[id];
      if (!listeners) {
        listeners = this._events[id] = [];
      }
      listeners.push(fn);

      if (pending) {
        pending.forEach((args) => {
          fn.apply(null, args);
        });
        delete this._pendingEvents[id];
      }
      return this;
    },

    once: function(id, fn) {
      let self = this,
          fired = false;
      function one() {
        if (fired) {
          return;
        }
        fired = true;
        fn.apply(null, arguments);
        // Remove at a further turn so that the event
        // forEach in emit does not get modified during
        // this turn.
        setTimeout(() => {
          self.removeListener(id, one);
        });
      }
      return this.on(id, one);
    },

    /**
     * Waits for a property on the object that has the event interface
     * to be available. That property MUST EVALUATE TO A TRUTHY VALUE.
     * hasOwnProperty is not used because many objects are created with
     * null placeholders to give a proper JS engine shape to them, and
     * this method should not trigger the listener for those cases.
     * If the property is already available, call the listener right
     * away. If not available right away, listens for an event name that
     * matches the property name.
     * @param  {String}   id property name.
     * @param  {Function} fn listener.
     */
    latest: function(id, fn) {
      if (this[id] && !this._pendingEvents[id]) {
        fn(this[id]);
      }
      this.on(id, fn);
    },

    /**
     * Same as latest, but only calls the listener once.
     * @param  {String}   id property name.
     * @param  {Function} fn listener.
     */
    latestOnce: function(id, fn) {
      if (this[id] && !this._pendingEvents[id]) {
        fn(this[id]);
      } else {
        this.once(id, fn);
      }
    },

    removeListener: function(id, fn) {
      let i,
          listeners = this._events[id];
      if (listeners) {
        i = listeners.indexOf(fn);
        if (i !== -1) {
          listeners.splice(i, 1);
        }
        if (listeners.length === 0) {
          delete this._events[id];
        }
      }
    },

    /**
     * Like emit, but if no listeners yet, holds on
     * to the value until there is one. Any other
     * args after first one are passed to listeners.
     * @param  {String} id event ID.
     */
    emitWhenListener: function(id) {
      let listeners = this._events[id];
      if (listeners) {
        this.emit.apply(this, arguments);
      } else {
        if (!this._pendingEvents[id]) {
          this._pendingEvents[id] = [];
        }
        this._pendingEvents[id].push(slice.call(arguments, 1));
      }
    },

    emit: function(id) {
      let args = slice.call(arguments, 1);

      // Trigger an async resolution by using a promise.
      Promise.resolve().then(() => {
        let listeners = this._events[id];
        if (listeners) {
          listeners.forEach((fn) => {
            try {
              fn.apply(null, args);
            } catch (e) {
              // Throw at later turn so that other listeners
              // can complete. While this messes with the
              // stack for the error, continued operation is
              // valued more in this tradeoff.
              // This also means we do not need to .catch()
              // for the wrapping promise.
              setTimeout(() => {
                throw e;
              });
            }
          });
        }
      });
    }
  };

  evt = new Emitter();
  evt.Emitter = Emitter;

  evt.mix = function(obj) {
    let e = new Emitter();
    props.forEach((prop) => {
      if (obj.hasOwnProperty(prop)) {
        throw new Error('Object already has a property "' + prop + '"');
      }
      obj[prop] = e[prop];
    });
    return obj;
  };

  return evt;
});

/**
 * Provides a wrapper over the mozApps.getSelf() API. Structured as an
 * evt emitter, with "latest" support, and "latest" is overridden so
 * that the call to getSelf() is delayed until the very first need
 * for it.
 *
 * This allows code to have a handle on this module, instead of making
 * the getSelf() call, and then only trigger the fetch via a call to
 * latest, delaying the work until it is actually needed. Once getSelf()
 * is fetched once, the result is reused.
 */

define('app_self',['require','exports','module','evt'],function(require, exports, module) {
  let evt = require('evt');

  let appSelf = evt.mix({}),
      mozApps = navigator.mozApps,
      oldLatest = appSelf.latest,
      loaded = false;

  if (!mozApps) {
    appSelf.self = {};
    loaded = true;
  }

  function loadSelf() {
    mozApps.getSelf().onsuccess = (event) => {
      loaded = true;
      appSelf.self = event.target.result;
      appSelf.emit('self', appSelf.self);
    };
  }

  // Override latest to only do the work when something actually wants to
  // listen.
  appSelf.latest = function(id) {
    if (!loaded) {
      loadSelf();
    }

    if (id !== 'self') {
      throw new Error(module.id + ' only supports "self" property');
    }

    return oldLatest.apply(this, arguments);
  };

  return appSelf;
});


define('l10n',{
  load: function(id, require, onload, config) {
    if (config.isBuild) {
      return onload();
    }

    require(['l10nbase', 'l10ndate'], () => {
      navigator.mozL10n.once(() => {
        // The html cache restore in html_cache_restore could have set the ltr
        // direction incorrectly. If the language goes from an RTL one to a LTR
        // one while the app is closed, this could lead to a stale value.
        let dir = navigator.mozL10n.language.direction,
            htmlNode = document.querySelector('html');

        if (htmlNode.getAttribute('dir') !== dir) {
          console.log('email l10n updating html dir to ' + dir);
          htmlNode.setAttribute('dir', dir);
        }

        onload(navigator.mozL10n);
      });
    });
  }
});

/* exported NotificationHelper */
(function(window) {
  

  window.NotificationHelper = {
    getIconURI: function nh_getIconURI(app, entryPoint) {
      var icons = app.manifest.icons;

      if (entryPoint) {
        icons = app.manifest.entry_points[entryPoint].icons;
      }

      if (!icons) {
        return null;
      }

      var sizes = Object.keys(icons).map(function parse(str) {
        return parseInt(str, 10);
      });
      sizes.sort(function(x, y) { return y - x; });

      var HVGA = document.documentElement.clientWidth < 480;
      var index = sizes[HVGA ? sizes.length - 1 : 0];
      return app.installOrigin + icons[index];
    },

    // titleL10n and options.bodyL10n may be:
    // a string -> l10nId
    // an object -> {id: l10nId, args: l10nArgs}
    // an object -> {raw: string}
    send: function nh_send(titleL10n, options) {
      return new Promise(function(resolve, reject) {
        navigator.mozL10n.once(function() {
          var title = getL10n(titleL10n);

          if (options.bodyL10n) {
            options.body = getL10n(options.bodyL10n);
          }

          options.dir = navigator.mozL10n.language.direction;
          options.lang = navigator.mozL10n.language.code;

          var notification = new window.Notification(title, options);

          if (options.closeOnClick !== false) {
            notification.addEventListener('click', function nh_click() {
              notification.removeEventListener('click', nh_click);
              notification.close();
            });
          }

          resolve(notification);
        });
      });
    },
  };

  function getL10n(l10nAttrs) {
    if (typeof l10nAttrs === 'string') {
      return navigator.mozL10n.get(l10nAttrs);
    }
    if (l10nAttrs.raw) {
      return l10nAttrs.raw;
    }
    return navigator.mozL10n.get(l10nAttrs.id, l10nAttrs.args);
  }
})(this);

define("shared/js/notification_helper", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.NotificationHelper;
    };
}(this)));

/*jshint browser: true */
/*global define, console, Notification */

define('sync',['require','app_self','evt','l10n!','shared/js/notification_helper'],function(require) {

  let cronSyncStartTime,
      appSelf = require('app_self'),
      evt = require('evt'),
      mozL10n = require('l10n!'),
      notificationHelper = require('shared/js/notification_helper');

  // Version marker for the notification data format. It is a string because
  // query_string only deals in strings. If the format of the notification data
  // changes, then this version needs to be changed.
  let notificationDataVersion = '1';

  // The expectation is that this module is called as part of model's
  // init process that calls the "model_init" module to finish its construction.
  return function syncInit(model, api) {
    let hasBeenVisible = !document.hidden,
        waitingOnCron = {};

    // Let the back end know the app is interactive, not just
    // a quick sync and shutdown case, so that it knows it can
    // do extra work.
    if (hasBeenVisible) {
      api.setInteractive();
    }

    // If the page is ever not hidden, then do not close it later.
    document.addEventListener('visibilitychange',
      function onVisibilityChange() {
        if (!document.hidden) {
          hasBeenVisible = true;
          api.setInteractive();
        }
    }, false);

    // Creates a string key from an array of string IDs. Uses a space
    // separator since that cannot show up in an ID.
    function makeAccountKey(accountIds) {
      return 'id' + accountIds.join(' ');
    }

    let sendNotification;
    if (typeof Notification !== 'function') {
      console.log('email: notifications not available');
      sendNotification = function() {};
    } else {
      sendNotification = function(notificationId, title, body,
                                  iconUrl, data, behavior) {
        console.log('Notification sent for ' + notificationId);

        if (Notification.permission !== 'granted') {
          console.log('email: notification skipped, permission: ' +
                      Notification.permission);
          return;
        }

        data = data || {};

        //TODO: consider setting dir and lang?
        //https://developer.mozilla.org/en-US/docs/Web/API/notification
        let notificationOptions = {
          body: body,
          icon: iconUrl,
          tag: notificationId,
          data: data,
          mozbehavior: {
            noscreen: true
          }
        };

        if (behavior) {
          Object.keys(behavior).forEach((key) => {
            notificationOptions.mozbehavior[key] = behavior[key];
          });
        }

        let notification = new Notification(title, notificationOptions);

        // If the app is open, but in the background, when the notification
        // comes in, then we do not get notifived via our mozSetMessageHandler
        // that is set elsewhere. Instead need to listen to click event
        // and synthesize an "event" ourselves.
        notification.onclick = function() {
          evt.emit('notification', {
            clicked: true,
            imageURL: iconUrl,
            tag: notificationId,
            data: data
          });
        };
      };
    }

    api.oncronsyncstart = function(accountIds) {
      console.log('email oncronsyncstart: ' + accountIds);
      cronSyncStartTime = Date.now();
      let accountKey = makeAccountKey(accountIds);
      waitingOnCron[accountKey] = true;
    };

    /**
     * Fetches notification data for the notification type, ntype. This method
     * assumes there is only one ntype of notification per account.
     * @param  {String} ntype The notification type, like 'sync'.
     * @return {Promise}      Promise that resolves to a an object whose keys
     * are account IDs and values are notification data.
     */
    function fetchNotificationsData(ntype) {
      if (typeof Notification !== 'function' || !Notification.get) {
        return Promise.resolve({});
      }

      return Notification.get().then((notifications) => {
        let result = {};
        notifications.forEach((notification) => {
          let data = notification.data;

          // Want to avoid unexpected data formats. So if not a version match
          // then just close it since it cannot be processed as expected. This
          // means that notifications not generated by this module may be
          // closed. However, ideally only this module generates notifications,
          // for localization of concerns.
          if (!data.v || data.v !== notificationDataVersion) {
            notification.close();
          } else if (data.ntype === ntype) {
            data.notification = notification;
            result[data.accountId] = data;
          }
        });
        return result;
      }, (err) => {
        // Do not care about errors, just log and keep going.
        console.error('email notification.get call failed: ' + err);
        return {};
      });
    }

    /**
     * Helper to just get some environment data for dealing with sync-based
     * notfication data. Exists to reduce the curly brace pyramid of doom and
     * to normalize existing sync notification info.
     * @param {Function} fn function to call once env info is fetched.
     */
    function getSyncEnv(fn) {
      appSelf.latest('self', (app) => {
        model.latestOnce('account', (currentAccount) => {
          fetchNotificationsData('sync').then(
            function(existingNotificationsData) {
              fn(app, currentAccount, existingNotificationsData);
            }
          );
        });
      });
    }

    /**
     * Generates a list of unique top names sorted by most recent sender first,
     * and limited to a max number. The max number is just to limit amount of
     * work and likely display limits.
     * @param  {Array} latestInfos  array of result.latestMessageInfos. Modifies
     * result.latestMessageInfos via a sort.
     * @param  {Array} oldFromNames old from names from a previous notification.
     * @return {Array} a maxFromList array of most recent senders.
     */
    function topUniqueFromNames(latestInfos, oldFromNames) {
      let names = [],
          maxCount = 3;

      // Get the new from senders from the result. First,
      // need to sort by most recent.
      // Note that sort modifies result.latestMessageInfos
      latestInfos.sort((a, b) => {
        return b.date - a.date;
      });

      // Only need three unique names, and just the name, not
      // the full info object.
      latestInfos.some((info) => {
        if (names.length > maxCount) {
          return true;
        }

        if (names.indexOf(info.from) === -1) {
          names.push(info.from);
        }
      });

      // Now add in old names to fill out a list of
      // max names.
      oldFromNames.some((name) => {
        if (names.length > maxCount) {
          return true;
        }
        if (names.indexOf(name) === -1) {
          names.push(name);
        }
      });

      return names;
    }

    /*
    accountsResults is an object with the following structure:
      accountIds: array of string account IDs.
      updates: array of objects includes properties:
        id: accountId,
        name: account name,
        count: number of new messages total
        latestMessageInfos: array of latest message info objects,
        with properties:
          - from
          - subject
          - accountId
          - messageSuid
     */
    api.oncronsyncstop = function(accountsResults) {
      console.log('email oncronsyncstop: ' + accountsResults.accountIds);

      function finishSync() {
        evt.emit('cronSyncStop', accountsResults.accountIds);

        // Mark this accountId set as no longer waiting.
        let accountKey = makeAccountKey(accountsResults.accountIds);
        waitingOnCron[accountKey] = false;
        let stillWaiting = Object.keys(waitingOnCron).some((key) => {
          return !!waitingOnCron[key];
        });

        if (!hasBeenVisible && !stillWaiting) {
          console.log('sync completed in ' +
                     ((Date.now() - cronSyncStartTime) / 1000) +
                     ' seconds, closing mail app');
          window.close();
        }
      }

      // If no sync updates, wrap it up.
      if (!accountsResults.updates) {
        finishSync();
        return;
      }

      // There are sync updates, get environment and figure out how to notify
      // the user of the updates.
      getSyncEnv(function(app, currentAccount, existingNotificationsData) {
        let iconUrl = notificationHelper.getIconURI(app);

        accountsResults.updates.forEach((result) => {
          // If the current account is being shown, then just send an update
          // to the model to indicate new messages, as the notification will
          // happen within the app for that case. The 'inboxShown' pathway
          // will be sure to close any existing notification for the current
          // account.
          if (currentAccount.id === result.id && !document.hidden) {
            model.notifyInboxMessages(result);
            return;
          }

          // If this account does not want notifications of new messages
          // or if no Notification object, stop doing work.
          if (!model.getAccount(result.id).notifyOnNew ||
              typeof Notification !== 'function') {
            return;
          }

          let dataObject, subject, title, behavior,
              count = result.count,
              oldFromNames = [];

          // Adjust counts/fromNames based on previous notification.
          let existingData = existingNotificationsData[result.id];
          if (existingData) {
            if (existingData.count) {
              count += parseInt(existingData.count, 10);
            }
            if (existingData.fromNames) {
              oldFromNames = existingData.fromNames;
            }
          }

          behavior = {
            soundFile: app.origin + '/sounds/new_mail.ogg'
          };

          if (count > 1) {
            // Multiple messages were synced.
            // topUniqueFromNames modifies result.latestMessageInfos
            let newFromNames = topUniqueFromNames(result.latestMessageInfos,
                                                  oldFromNames);
            dataObject = {
              v: notificationDataVersion,
              ntype: 'sync',
              type: 'message_list',
              accountId: result.id,
              count: count,
              fromNames: newFromNames
            };
            subject = mozL10n.get('new-emails-notify-one-account', {
              n: count
            });
            title = newFromNames.join(mozL10n.get('senders-separation-sign'));
          } else {
            // Only one message to notify about.
            let info = result.latestMessageInfos[0];
            dataObject = {
              v: notificationDataVersion,
              ntype: 'sync',
              type: 'message_reader',
              accountId: info.accountId,
              messageSuid: info.messageSuid,
              count: 1,
              fromNames: [info.from]
            };

            subject = info.subject;
            title = info.from;
          }

          sendNotification(
            result.id,
            title,
            subject,
            iconUrl,
            dataObject,
            behavior
          );
        });

        finishSync();
      });
    };

    // Background Send Notifications

    let BACKGROUND_SEND_NOTIFICATION_ID = 'backgroundSendFailed';
    let sentAudio = null; // Lazy-loaded when first needed

    /**
     * The API passes through background send notifications with the
     * following data (see the "sendOutboxMessages" job and/or
     * `GELAM/js/jobs/outbox.js`):
     *
     * @param {int} accountId
     * @param {string} suid
     *   SUID of the message
     * @param {string} state
     *   'pending', 'syncing', 'success', or 'error'
     * @param {string} err
     *   (if applicable, otherwise null)
     * @param {array} badAddresses
     *   (if applicable)
     * @param {int} sendFailures
     *   Count of the number of times the message failed to send.
     * @param {Boolean} emitNotifications
     *   True if this message is being sent as a direct result of
     *   the user sending a message from the compose window. False
     *   otherwise, as in when the user "refreshes" the outbox.
     * @param {Boolean} willSendMore
     *   True if we will send a subsequent message from the outbox
     *   immediately after sending this message.
     *
     * Additionally, this function appends the following to that
     * structured data:
     *
     * @param {string} localizedDescription Notification text.
     *
     * If the application is in the foreground, we notify the user on
     * both success and failure. If the application is in the
     * background, we only post a system notifiaction on failure.
     */
    api.onbackgroundsendstatus = function(data) {
      console.log('outbox: Message', data.suid, 'status =', JSON.stringify({
        state: data.state,
        err: data.err,
        sendFailures: data.sendFailures,
        emitNotifications: data.emitNotifications
      }));

      // Grab an appropriate localized string here. This description
      // may be displayed in a number of different places, so it's
      // cleaner to do the localization here.

      let descId;
      switch (data.state) {
      case 'pending': descId = 'background-send-pending'; break;
      case 'sending': descId = 'background-send-sending'; break;
      case 'success': descId = 'background-send-success'; break;
      case 'error':
        if ((data.badAddresses && data.badAddresses.length) ||
            data.err === 'bad-recipient') {
          descId = 'background-send-error-recipients';
        } else {
          descId = 'background-send-error';
        }
        break;
      case 'syncDone':
        // We will not display any notification for a 'syncDone'
        // message, except to stop refresh icons from spinning. No
        // need to attempt to populate a description.
        break;
      default:
        console.error('No state description for background send state "' +
                      data.state + '"');
        return;
      }

      // Only get localized description if we have a descId
      if (descId) {
        data.localizedDescription = mozL10n.get(descId);
      }

      // If the message sent successfuly, and we're sending this as a
      // side-effect of the user hitting "send" on the compose screen,
      // (i.e. emitNotifications is true), we may need to play a sound.
      if (data.state === 'success') {
        // Grab an up-to-date reading of the "play sound on send"
        // preference to decide if we're going to play a sound or not.
        model.latestOnce('acctsSlice', () => {
          let account = model.getAccount(data.accountId);
          if (!account) {
            console.error('Invalid account ID', data.accountId,
                          'for a background send notification.');
            return;
          }

          // If email is in the background, we should still be able to
          // play audio due to having the 'audio-channel-notification'
          // permission (unless higher priority audio is playing).

          // TODO: As of June 2014, this behavior is still in limbo;
          // see the following links for relevant discussion. We may
          // need to follow up to ensure we get the behavior we want
          // (which is to play a sound when possible, even if we're in
          // the background).
          //   Thread on dev-gaia: http://goo.gl/l6REZy
          //   AUDIO_COMPETING bugs: https://bugzil.la/911238
          if (account.playSoundOnSend) {
            if (!sentAudio) {
              sentAudio = new Audio('/sounds/mail_sent.ogg');
              sentAudio.mozAudioChannelType = 'notification';
            }
            sentAudio.play();
          }
        });
      }

      if (data.emitNotifications) {
        model.notifyBackgroundSendStatus(data);
      }
    };

    // When inbox is viewed, be sure to clear out any possible notification
    // for that account.
    evt.on('inboxShown', function(accountId) {
      fetchNotificationsData('sync').then(function(notificationsData) {
        if (notificationsData.hasOwnProperty(accountId)) {
          notificationsData[accountId].notification.close();
        }
      });
    });
  };
});


define('model_init',['require','sync','evt','l10n!'],function(require) {
  return function modelInit(model, api) {
    require('sync')(model, api);

    let evt = require('evt'),
        mozL10n = require('l10n!');

    // If our password is bad, we need to pop up a card to ask for the updated
    // password.
    api.onbadlogin = function(account, problem, whichSide) {
      // Use emitWhenListener here, since the model can be started up before
      // the mail_app and cards infrastructure is available.
      evt.emitWhenListener('apiBadLogin', account, problem, whichSide);
    };

    api.onResetAccount = function(account) {
      model.resetAccount(account);
    };

    api.useLocalizedStrings({
      wrote: mozL10n.get('reply-quoting-wrote'),
      originalMessage: mozL10n.get('forward-original-message'),
      forwardHeaderLabels: {
        subject: mozL10n.get('forward-header-subject'),
        date: mozL10n.get('forward-header-date'),
        from: mozL10n.get('forward-header-from'),
        replyTo: mozL10n.get('forward-header-reply-to'),
        to: mozL10n.get('forward-header-to'),
        cc: mozL10n.get('forward-header-cc')
      },
      folderNames: {
        inbox: mozL10n.get('folder-inbox'),
        outbox: mozL10n.get('folder-outbox'),
        sent: mozL10n.get('folder-sent'),
        drafts: mozL10n.get('folder-drafts'),
        trash: mozL10n.get('folder-trash'),
        queue: mozL10n.get('folder-queue'),
        junk: mozL10n.get('folder-junk'),
        archives: mozL10n.get('folder-archives'),
        localdrafts: mozL10n.get('folder-localdrafts')
      }
    });
  };
});


define('model',['require','evt','model_init'],function(require) {
  let evt = require('evt'),
      // Expect a module to provide a function that allows setting up model/api
      // pieces that depend on specific UI or localizations.
      modelInit = require('model_init');

  function dieOnFatalError(msg) {
    console.error('FATAL:', msg);
    throw new Error(msg);
  }

  function saveHasAccount(hasAccount, hasEnableAccount) {
    // Save localStorage value to improve startup choices
    localStorage.setItem('data_has_account', (hasAccount ? 'yes' : 'no'));
    localStorage.setItem('data_has_enable_account', (hasEnableAccount ? 'yes' : 'no'));

    console.log('WRITING LOCAL STORAGE ITEM: ' + 'data_has_account',
      (hasAccount ? 'yes' : 'no'));

    console.log('WRITING LOCAL STORAGE ITEM: ' + 'data_has_enable_account',
      (hasEnableAccount ? 'yes' : 'no'));
  }

/**
 * Provides a front end to the API and slice objects returned from the API.
 * Since the UI right now is driven by a shared set of slices, this module
 * tracks those slices and creates events when they are changed. This means
 * the card modules do not need a direct reference to each other to change
 * the backing data for a card, and that card modules and app logic do not
 * need a hard, static dependency on the MailAPI object. This allows some
 * more flexible and decoupled loading scenarios. In particular, cards can
 * be created an inserted into the DOM without needing the back end to
 * complete its startup and initialization.
 *
 * It mixes in 'evt' capabilities, so it will be common to see model
 * used with 'latest' and 'latestOnce' to get the latest model data
 * whenever it loads.
 *
 * Down the road, it may make sense to have more than one model object
 * in play. At that point, it may make sense to morph this into a
 * constructor function and then have the card objects receive a model
 * instance property for their model reference.
 *
 * @type {Object}
 */
  let model = {
    firstRun: null,

    /**
    * acctsSlice event is fired when the property changes.
    * event: acctsSlice
    * @param {Object} the acctsSlice object.
    **/
    acctsSlice: null,

    /**
    * account event is fired when the property changes.
    * event: account
    * @param {Object} the account object.
    **/
    account: null,

    /**
    * foldersSlice event is fired when the property changes.
    * event: foldersSlice
    * @param {Object} the foldersSlice object.
    **/
    foldersSlice: null,

    /**
    * folder event is fired when the property changes.
    * event: folder
    * @param {Object} the folder object.
    **/
    folder: null,

    /**
     * emits an event based on a property value. Since the
     * event is based on a property value that is on this
     * object, *do not* use emitWhenListener, since, due to
     * the possibility of queuing old values with that
     * method, it could cause bad results (bug 971617), and
     * it is not needed since the latest* methods will get
     * the latest value on this object.
     * @param  {String} id event ID/property name
     */
    _callEmit: function(id) {
      this.emit(id, this[id]);
    },

    inited: false,

    /**
     * Returns true if there is an account. Should only be
     * called after inited is true.
     */
    hasAccount: function() {
      return (model.getAccountCount() > 0);
    },

    checkAccounts: function() {
      let hasEnable = false;
      
      if (this.hasAccount()) {
        for (let i = 0; i < model.acctsSlice.items.length; i++) {
          if (model.acctsSlice.items[i].syncEnable) {
            hasEnable = true;
            break;
          }
        }
        saveHasAccount(true, hasEnable);
      } else {
        saveHasAccount(false, hasEnable);
      }
      return hasEnable;
    },

    /**
     * Given an account ID, get the account object. Only works once the
     * acctsSlice property is available. Use model.latestOnce to get a
     * handle on an acctsSlice property, then call this method.
     * @param  {String} id account ID.
     * @return {Object}    account object.
     */
    getAccount: function(id) {
      if (!model.acctsSlice || !model.acctsSlice.items) {
        throw new Error('No acctsSlice available');
      }

      let targetAccount;
      model.acctsSlice.items.some((account) => {
        if (account.id === id) {
          return !!(targetAccount = account);
        }
      });

      return targetAccount;
    },

    getEnableAccount: function(id, defaultAccount) {
      let index = 0;
      let account;
      for (index; index < model.acctsSlice.items.length; index++) {
        if (defaultAccount) {
          if (model.acctsSlice.items[index].id !== id &&
              model.acctsSlice.items[index].syncEnable) {
            account = model.acctsSlice.items[index];
            break;
          }
        } else {
          if (model.acctsSlice.items[index].isDefault &&
              model.acctsSlice.items[index].id !== id &&
              model.acctsSlice.items[index].syncEnable) {
            account = model.acctsSlice.items[index];
            break;
          }
        }
      }

      return account;
    },

    /**
     * Get the numbers of configured account.
     * Should only be called after this.inited is true.
     * @return {Number} numbers of account.
     */
    getAccountCount: function() {
      let count = 0;

      if (model.acctsSlice &&
          model.acctsSlice.items &&
          model.acctsSlice.items.length) {
        count = model.acctsSlice.items.length;
      }

      return count;
    },

    /**
     * Call this to initialize the model. It can be called more than once
     * per the lifetime of an app. The usual use case for multiple calls
     * is when a new account has been added.
     *
     * It is *not* called by default in this module to allow for lazy startup,
     * and for cases like unit tests that may not want to trigger a full model
     * creation for a simple UI test.
     *
     * @param  {boolean} showLatest Choose the latest account in the
     * acctsSlice. Otherwise it choose the account marked as the default
     * account.
     */
    init: function(showLatest, callback) {
      require(['api'], (api) => {
        if (!this.api) {
          this.api = api;
          modelInit(this, api);
        }

        // If already initialized before, clear out previous state.
        this.die();

        let acctsSlice = api.viewAccounts(false);
        acctsSlice.oncomplete = () => {
          // To prevent a race between Model.init() and
          // acctsSlice.oncomplete, only assign model.acctsSlice when
          // the slice has actually loaded (i.e. after
          // acctsSlice.oncomplete fires).
          model.acctsSlice = acctsSlice;

          this.checkAccounts();

          if (acctsSlice.items.length) {
            // For now, just use the first one; we do attempt to put unified
            // first so this should generally do the right thing.
            // XXX: Because we don't have unified account now, we should
            //      switch to the latest account which user just added.
            let account = showLatest ? acctsSlice.items.slice(-1)[0] :
                                       acctsSlice.defaultAccount;

            this.changeAccount(account, callback);
          } else if (callback) {
            callback();
          }

          this.inited = true;
          this._callEmit('acctsSlice');

          // Once the API/worker has started up and we have received account
          // data, consider the app fully loaded: we have verified full flow
          // of data from front to back.
          evt.emit('metrics:apiDone');
        };

        acctsSlice.onchange = () => {
          model.acctsSlice = acctsSlice;
          this.checkAccounts();
        };
      });
    },

    /**
     * Changes the current account tracked by the model. This results
     * in changes to the 'account', 'foldersSlice' and 'folder' properties.
     * @param  {Object}   account  the account object.
     * @param  {Function} callback function to call once the account and
     * related folder data has changed.
     */
    changeAccount: function(account, callback) {
      // Do not bother if account is the same.
      if (this.account && this.account.id === account.id) {
        if (callback) {
          callback();
        }
        return;
      }

      this.resetAccount(account, callback);
    },

    resetAccount: function(account, callback) {
      this._dieFolders();
      this.account = account;
      this._callEmit('account');
      this.checkAccounts();

      let foldersSlice = this.api.viewFolders('account', account);
      foldersSlice.oncomplete = () => {
        this.foldersSlice = foldersSlice;
        this.foldersSlice.onchange = this.notifyFoldersSliceOnChange.bind(this);
        this.selectInbox(callback);
        this._callEmit('foldersSlice');
      };
    },

    /**
     * Given an account ID, change the current account to that account.
     * @param  {String} accountId
     * @return {Function} callback
     */
    changeAccountFromId: function(accountId, callback) {
      if (!this.acctsSlice || !this.acctsSlice.items.length) {
        throw new Error('No accounts available');
      }

      this.acctsSlice.items.some((account) => {
        if (account.id === accountId) {
          this.changeAccount(account, callback);
          return true;
        }
      });
    },

    /**
     * Just changes the folder property tracked by the model.
     * Assumes the folder still belongs to the currently tracked
     * account. It also does not result in any state changes or
     * event emitting if the new folder is the same as the
     * currently tracked folder.
     * @param  {Object} folder the folder object to use.
     */
    changeFolder: function(folder) {
      if (folder && (!this.folder || folder.id !== this.folder.id)) {
        this.folder = folder;
        this._callEmit('folder');
      }
    },

    /**
     * For the already loaded account and associated foldersSlice,
     * set the inbox as the tracked 'folder'.
     * @param  {Function} callback function called once the inbox
     * has been selected.
     */
    selectInbox: function(callback) {
      this.selectFirstFolderWithType('inbox', callback);
    },

    /**
     * For the already loaded account and associated foldersSlice, set
     * the given folder as the tracked folder. The account MUST have a
     * folder with the given type, or a fatal error will occur.
     */
    selectFirstFolderWithType: function(folderType, callback) {
      if (!this.foldersSlice) {
        throw new Error('No foldersSlice available');
      }

      let folder = this.foldersSlice.getFirstFolderWithType(folderType);
      if (!folder) {
        dieOnFatalError('We have an account without a folderType ' +
                        folderType + '!', this.foldersSlice.items);
      }

      if (this.folder && this.folder.id === folder.id) {
        if (callback) {
          callback();
        }
      } else {
        if (callback) {
          this.once('folder', callback);
        }
        this.changeFolder(folder);
      }
    },

    /**
     * Called by other code when it knows the current account
     * has received new inbox messages. Just triggers an
     * event with the count for now.
     * @param  {Object} accountUpdate update object from
     * sync.js accountResults object structure.
     */
    notifyInboxMessages: function(accountUpdate) {
      if (accountUpdate.id === this.account.id) {
        model.emit('newInboxMessages', accountUpdate.count);
      }
    },

    /**
     * Triggered by the foldersSlice onchange event
     * @param  {Object} folder the folder that changed.
     */
    notifyFoldersSliceOnChange: function(folder) {
      model.emit('foldersSliceOnChange', folder);
    },

    notifyBackgroundSendStatus: function(data) {
      model.emit('backgroundSendStatus', data);
    },

    // Lifecycle

    _dieFolders: function() {
      if (this.foldersSlice) {
        this.foldersSlice.die();
      }
      this.foldersSlice = null;

      this.folder = null;
    },

    die: function() {
      if (this.acctsSlice) {
        this.acctsSlice.die();
      }
      this.acctsSlice = null;
      this.account = null;

      this._dieFolders();
    }
  };

  return evt.mix(model);
});

/* exported MimeMapper */


/**
 * MimeMapper helps gaia apps to decide the mapping of mimetype and extension.
 * The use cases often happen when apps need to know about the exact
 * mimetypes or extensions, such as to delegate the open web activity, we must
 * have suitable mimetypes or extensions to request the right activity
 *
 * The mapping is basically created according to:
 * http://en.wikipedia.org/wiki/Internet_media_type
 *
 * The supported formats are considered base on the deviceStorage properties:
 * http://dxr.mozilla.org/mozilla-central/toolkit/content/
 * devicestorage.properties
 *
 */

var MimeMapper = {
  // This list only contains the extensions we currently supported
  // We should make it more complete for further usages
  _typeToExtensionMap: {
    // Image
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    // Audio
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/3gpp': '3gp',
    'audio/amr': 'amr',
    'audio/x-wav': 'wav',
    'audio/x-midi': 'mid',
    'audio/acc': 'acc',
    // Video
    'video/mp4': 'mp4',
    'video/mpeg': 'mpg',
    'video/ogg': 'ogg',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'video/3gpp2': '3g2',
    // Application
    // If we want to support some types, like pdf, just add
    // 'application/pdf': 'pdf'
    'application/vcard': 'vcf',
    // Text
    'text/vcard': 'vcf',
    'text/x-vcard': 'vcf',
    'text/plain': 'txt',
    'text/kai_plain': 'note'
  },

  // This list only contains the mimetypes we currently supported
  // We should make it more complete for further usages
  _extensionToTypeMap: {
    // Image
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'jpe': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    // Audio
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'm4b': 'audio/mp4',
    'm4p': 'audio/mp4',
    'm4r': 'audio/mp4',
    'aac': 'audio/aac',
    'opus': 'audio/ogg',
    'amr': 'audio/amr',
    'awb': 'audio/amr-wb',
    'wav': 'audio/x-wav',
    'mid': 'audio/x-midi',
    // Video
    'mp4': 'video/mp4',
    'mpeg': 'video/mpeg',
    'mpg': 'video/mpeg',
    'ogv': 'video/ogg',
    'ogx': 'video/ogg',
    'webm': 'video/webm',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    'ogg': 'video/ogg',
    // Application
    // If we want to support some extensions, like pdf, just add
    // 'pdf': 'application/pdf'
    'apk': 'application/vnd.android.package-archive',
    'zip': 'application/zip',
    // Text
    'vcf': 'text/vcard',
    'txt': 'text/plain',
    'note': 'text/kai_plain'
  },
  _parseExtension: function(filename) {
    var array = filename.split('.');
    return array.length > 1 ? array.pop() : '';
  },

  isSupportedType: function(mimetype) {
    return (mimetype in this._typeToExtensionMap);
  },

  isSupportedExtension: function(extension) {
    return (extension in this._extensionToTypeMap);
  },

  isFilenameMatchesType: function(filename, mimetype) {
    var extension = this._parseExtension(filename);
    var guessedType = this.guessTypeFromExtension(extension);
    return (guessedType == mimetype);
  },

  guessExtensionFromType: function(mimetype) {
    return this._typeToExtensionMap[mimetype];
  },

  guessTypeFromExtension: function(extension) {
    return this._extensionToTypeMap[extension];
  },

  // If mimetype is not in the supported list, we will try to
  // predict the possible valid mimetype based on extension.
  guessTypeFromFileProperties: function(filename, mimetype) {
    var extension = this._parseExtension(filename);
    var type = this.isSupportedType(mimetype) ?
      mimetype : this.guessTypeFromExtension(extension);
    return type || '';
  },

  // if mimetype is not supported, preserve the original extension
  // and add the predict result as new extension.
  // If both filename and mimetype are not supported, return the original
  // filename.
  ensureFilenameMatchesType: function(filename, mimetype) {
    if (!this.isFilenameMatchesType(filename, mimetype)) {
      var guessedExt = this.guessExtensionFromType(mimetype);
      if (guessedExt) {
        // We should not add the repeat extension name.
        if (this._parseExtension(filename) !== guessedExt) {
          filename += '.' + guessedExt;
        }
      }
    }
    return filename;
  }
};

define("shared/js/mime_mapper", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.MimeMapper;
    };
}(this)));


define('attachment_name',['require','l10n!','shared/js/mime_mapper'],function(require) {
  let mozL10n = require('l10n!'),
      mapper = require('shared/js/mime_mapper');

  let attachmentName = {
    /**
     * Given a blob, and a possible name, make sure a text name
     * is constructed. If name is already a value, that is used,
     * otherwise, the blob type and the count are used to generate
     * a name.
     * @param  {Blob} blob the blog associated with the attachment.
     * @param  {String} [name] possible existing name.
     * @param  {Number} [count] a count to use in the generated name.
     * @return {String}
     */
    ensureName: function(blob, name, count) {
      if (!name) {
        count = count || 1;
        let suffix = mapper.guessExtensionFromType(blob.type);
        name = mozL10n.get('default-attachment-filename', { n: count }) +
                           (suffix ? ('.' + suffix) : '');
      }
      return name;
    } ,

    /**
     * Given an array of blobs and a corresponding array of file names,
     * make sure there is a file name entry for each blob. If a file name
     * is missing, generate one using part of the mime type of the blob
     * as the file extension in the name. This method MODIFIES the
     * names array, and expects names to be an array.
     * @param  {Array} blobs the blobs that need names.
     * @param  {Array} names list.
     * @return {Array} Array of strings.
     */
    ensureNameList: function(blobs, names) {
      for (let i = 0; i < blobs.length; i++) {
        names[i] = attachmentName.ensureName(blobs[i], names[i], i + 1);
      }
    }
  };

  return attachmentName;
});

define('query_uri',[],function() {
  
  // Some sites may not get URI encoding correct, so this protects
  // us from completely failing in those cases.
  function decode(value) {
    try {
      return decodeURIComponent(value);
    } catch (err) {
      console.error('Skipping "' + value +
                    '", decodeURIComponent error: ' + err);
      return '';
    }
  }

  function queryURI(uri) {
    function addressesToArray(addresses) {
      if (!addresses) {
        return [];
      }
      addresses = addresses.split(/[,;]/);
      return addresses.filter((addr) => {
        return addr.trim() !== '';
      });
    }
    let mailtoReg = /^mailto:(.*)/i;
    let calltoReg = /^callto:(.*)/i;
    let obj = {};

    if (uri && uri.match(mailtoReg)) {
      uri = uri.match(mailtoReg)[1];
      let parts = uri.split('?');
      let subjectReg = /(?:^|&)subject=([^\&]*)/i,
      bodyReg = /(?:^|&)body=([^\&]*)/i,
      ccReg = /(?:^|&)cc=([^\&]*)/i,
      bccReg = /(?:^|&)bcc=([^\&]*)/i;
      // Check if the 'to' field is set and properly decode it
      obj.to = parts[0] ? addressesToArray(decode(parts[0])) : [];

      if (parts.length === 2) {
        let data = parts[1];
        if (data.match(subjectReg)) {
          obj.subject = decode(data.match(subjectReg)[1]);
        }
        if (data.match(bodyReg)) {
          obj.body = decode(data.match(bodyReg)[1]);
        }
        if (data.match(ccReg)) {
          obj.cc = addressesToArray(decode(data.match(ccReg)[1]));
        }
        if (parts[1].match(bccReg)) {
          obj.bcc = addressesToArray(decode(data.match(bccReg)[1]));
        }
      }
    } else if (uri && uri.match(calltoReg)) {
      uri = uri.match(calltoReg)[1];
      obj.number = uri;
    }

    return obj;
  }

  return queryURI;
});



define('activity_composer_data',['require','exports','module','attachment_name','query_uri'],function(require, exports, module) {
  let attachmentName = require('attachment_name'),
      queryUri = require('query_uri');

  return function activityComposeR(rawActivity) {
    // Parse the activity request.
    let source = rawActivity.source;
    let data = source.data;
    let activityName = source.name;
    let dataType = data.type;
    let url = data.url || data.URI;

    let attachData;
    if (dataType === 'url' && activityName === 'share') {
      attachData = {
        body: url
      };
    } else {
      attachData = queryUri(url);
      attachData.attachmentBlobs = data.blobs || [];
      attachData.attachmentNames = data.filenames || [];
      attachData.attachmentFilepaths = data.filepaths || [];

      attachmentName.ensureNameList(attachData.attachmentBlobs,
                                    attachData.attachmentNames);
    }

    return {
      onComposer: function(composer, composeCard) {
        let attachmentBlobs = attachData.attachmentBlobs;
        /* to/cc/bcc/subject/body all have default values that shouldn't
        be clobbered if they are not specified in the URI*/
        if (attachData.to) {
          composer.to = attachData.to;
        }
        if (attachData.subject) {
          composer.subject = attachData.subject;
        }
        if (attachData.body) {
          composer.body = { text: attachData.body };
        }
        if (attachData.cc) {
          composer.cc = attachData.cc;
        }
        if (attachData.bcc) {
          composer.bcc = attachData.bcc;
        }
        if (attachmentBlobs) {
          let attachmentsToAdd = [];
          for (let iBlob = 0; iBlob < attachmentBlobs.length; iBlob++) {
            attachmentsToAdd.push({
              name: attachData.attachmentNames[iBlob],
              pathName: attachData.attachmentFilepaths[iBlob],
              blob: attachmentBlobs[iBlob]
            });
          }
          composeCard.addAttachmentsSubjectToSizeLimits(attachmentsToAdd);
        }
      }
    };
  };
});


define('cards_init',['require'],function(require) {
  return function cardsInit(cards) {
    // Handle cases where a default card is needed for back navigation
    // after a non-default entry point (like an activity) is triggered.
    cards.pushDefaultCard = function(onPushed) {
      cards.pushCard('message_list', 'none', {
        onPushed: onPushed
      },
      // Default to "before" placement.
      'left');
    };
  };
});

// These vars are set in html_cache_restore as a globals.

define('html_cache',['require','exports','module','l10n!'],function(require, exports) {

let mozL10n = require('l10n!');

/**
 * Safely clone a node so that it is inert and no document.registerElement
 * callbacks or magic happens.  This is not particularly intuitive, so it
 * needs a helper method and that helper method needs an appropriately
 * scary/warning-filled name.
 *
 * The most non-obvious thing here is that
 * document.implementation.createHTMLDocument() will create a document that
 * has the same custom element registry as our own, so using importNode
 * on such a document will not actually fix anything!  But a "template"
 * element's contents owner document does use a new registry, so we use
 * that.
 *
 * See the spec's details on this at:
 * http://w3c.github.io/webcomponents/spec/custom/
 *   #creating-and-passing-registries
 */
exports.cloneAsInertNodeAvoidingCustomElementHorrors = function(node) {
  // Create a template node with a new registry.  In theory we could
  // cache this node as long as we're sure no one goes and registers
  // anything in its registry.  Not caching it may result in slightly
  // more GC/memory turnover.
  let templateNode = document.createElement('template');
  // content is a DocumentFragment which does not have importNode, so we need
  // its ownerDocument.
  let cacheDoc = templateNode.content.ownerDocument;
  return cacheDoc.importNode(node, true); // yes, deep
};

/**
 * Saves a JS object to document.cookie using JSON.stringify().
 * This method claims all cookie keys that have pattern
 * /htmlc(\d+)/
 */
exports.save = function htmlCacheSave(moduleId, html) {
  // Only save the last part of the module ID as the cache key. This is specific
  // to how email lays out all card modules in a 'cards/' module ID prefix, and
  // with all / and underscores turned to dashes for component names.
  let id = exports.moduleIdToKey(moduleId);

  let lang = navigator.language;
  let langDir = document.querySelector('html').getAttribute('dir');
  let cachedSoftkeyHtml;
  if (!window.softkeyHTML) {
    let softkey = document.getElementById('softkeyPanel');
    if (softkey.innerText.length > 0) {
      let cachedSoftkeyNode =
          exports.cloneAsInertNodeAvoidingCustomElementHorrors(softkey);
      cachedSoftkeyNode.setAttribute('id', 'cachedSoftkeyPanel');
      cachedSoftkeyHtml = cachedSoftkeyNode.outerHTML;
    }
  } else {
    cachedSoftkeyHtml = window.softkeyHTML;
  }

  html = window.HTML_CACHE_VERSION + ',' + lang +
        (langDir ? ',' + langDir : '') + ',' + cachedSoftkeyHtml + ':' + html;
  try {
    localStorage.setItem('html_cache_' + id, html);
  } catch (e) {
    console.error('htmlCache.save error: ' + e);
  }

  console.log('htmlCache.save ' + id + ': ' +
              html.length + ', lang dir: ' + langDir);
};

/**
 * Clears all the cache.
 */
exports.reset = function() {
  window.softkeyHTML = null;
  localStorage.clear();
};

exports.moduleIdToKey = function moduleIdToKey(moduleId) {
  return moduleId.replace(/^cards\//, '').replace(/-/g, '_');
};

// XXX when a bigger rename can happen, remove the need
// to translate between custom element names and moz-style
// underbar naming, and consider the card- as part of the
// input names.
exports.nodeToKey = function nodeToKey(node) {
  return node.nodeName.toLowerCase().replace(/^cards-/, '').replace(/-/g, '_');
};

/**
 * Does a very basic clone of the given node and schedules it for saving as a
 * cached entry point. WARNING: only use this for very simple cards that do not
 * need to do any customization.
 */
exports.cloneAndSave = function cloneAndSave(moduleId, node) {
  let cachedNode = exports.cloneAsInertNodeAvoidingCustomElementHorrors(node);
  // Since this node is not inserted into the document, translation
  // needs to be manually triggered, and the cloneNode happens before
  // the async Mutation Observer work mozL10n fires.
  mozL10n.translateFragment(cachedNode);
  cachedNode.dataset.cached = 'cached';
  exports.delayedSaveFromNode(moduleId, cachedNode);
};

/**
 * Serializes the node to storage. NOTE: it modifies the node tree, and
 * cloneNode(true) is *NOT SAFE* because of custom element semantics, so
 * you must use cloneAsInertNodeAvoidingCustomElementHorrors(node) on
 * your node and pass that to us.  (And you call it instead of us because
 * you probably really want to perform some transforms/filtering before you
 * pass the node to us.)
 * @param  {Node} node Node to serialize to storage.
 */
exports.saveFromNode = function saveFromNode(moduleId, node) {
  // Make sure card will be visible in center of window. For example,
  // if user clicks on "search" or some other card is showing when
  // message list's atTop is received, then the node could be
  // off-screen when it is passed to this function.
  let cl = node.classList;
  cl.remove('before');
  cl.remove('after');
  cl.add('center');

  let html = node.outerHTML;
  exports.save(moduleId, html);
};

/**
 * setTimeout ID used to track delayed save.
 */
let delayedSaveId = 0;

/**
 * Node to save on a delayed save.
 */
let delayedNode = '';

/**
 * Like saveFromNode, but on a timeout. NOTE: it modifies the node tree,
 * so pass use cloneNode(true) on your node if you use it for other
 * things besides this call.
 * @param  {Node} node Node to serialize to storage.
 */
exports.delayedSaveFromNode = function delayedSaveFromNode(moduleId, node) {
  delayedNode = node;
  if (!delayedSaveId) {
    delayedSaveId = setTimeout(() => {
      delayedSaveId = 0;
      exports.saveFromNode(moduleId, delayedNode);
      delayedNode = null;
    }, 100);
  }
};

});


define('tmpl',['l10n!'], function(mozL10n) {
  let tmpl = {
    pluginBuilder: './tmpl_builder',

    toDom: function(text) {
        let temp = document.createElement('div');
        temp.innerHTML = text;
        let node = temp.children[0];
        mozL10n.translateFragment(node);
        return node;
    },

    load: function(id, require, onload, config) {
      require(['text!' + id], function(text) {
        let node = tmpl.toDom(text);
        onload(node);
      });
    }
  };

  return tmpl;
});

define('tmpl!cards/toaster.html',['tmpl'], function (tmpl) { return tmpl.toDom('<section role="status" class="toaster collapsed">\n  <p class="toaster-text"></p>\n  <div class="toaster-action-target collapsed"><button class="toaster-action"></button></div>\n</section>\n'); });



/**
 * transitionend is not guaranteed to be async after a layout recalulation.
 * Specifically, a clientHeight read might trigger sync dispatch of
 * transitionend event to listeners, which could end up calling the function
 * that did the clientHeight, but the first call would still be stuck waiting
 * on the clientHeight read to finish. The issue is tracked in bug 1135960. This
 * is a workaround for that, to guarantee async dispatch by using the async
 * nature of promise .then callbacks.
 */
define('transition_end',['require','exports','module'],function(require, exports, module) {
  return function transitionEnd(node, fn, capturing) {
    function asyncFn(event) {
      Promise.resolve().then(function() {
        fn(event);
      })
      .catch(function(error) {
        console.error(error);
      });
    }
    node.addEventListener('transitionend', asyncFn, capturing);

    // Return the function used with addEventListener to allow the caller of
    // this helper to later call removeEventListener.
    return asyncFn;
  };
});


define('toaster',['require','l10n!','tmpl!./cards/toaster.html','transition_end'],function(require) {
  let mozL10n = require('l10n!');
  let toasterNode = require('tmpl!./cards/toaster.html');
  let transitionEnd = require('transition_end');

  /**
   * Manages the display of short status notifications, or 'toasts'.
   * Each toast may optionally include an action button. Common uses
   * may include:
   *
   * - Displaying notifications about message sending status
   * - Allowing the user to undo flags/moves/deletes
   * - Allowing the user to retry a failed operation, if applicable
   *
   * This class is a singleton, because there is only room for one
   * toaster on the screen at a time. Subsequent 'toasts' will remove
   * any previously-displaying toast.
   */
  let toaster = {

    defaultTimeout: 2000,

    /**
     * Tracks the CSS class that was previously applied to the action button,
     * so it can be removed on next display.
     */
    _previousActionClass: undefined,

    /**
     * Initialize the Toaster, adding things to the DOM and setting up
     * event handlers. The toaster starts out invisible.
     */
    init: function(parentEl) {
      this.el = toasterNode;
      parentEl.appendChild(this.el);
      this.text = this.el.querySelector('.toaster-text');
      this.actionButton = this.el.querySelector('.toaster-action');

      this.el.addEventListener('click', this.hide.bind(this));
      transitionEnd(this.el, this.hide.bind(this));

      // The target is used for the action to allow a larger tap target than
      // just the button.
      this.el.querySelector('.toaster-action-target')
          .addEventListener('click', this.onAction.bind(this));

      this.currentToast = null; // The data for the currently-displayed toast.
    },

    /**
     * Toast a potentially-undoable mail operation. If the operation
     * is undoable, an 'Undo' button will be shown, allowing the user
     * to undo the action, with one exception: The 'move' and 'delete'
     * operations currently do not allow 'undo' per bug 804916, so
     * those undo buttons are disabled.
     */
    toastOperation: function(op) {
      if (!op || !op.affectedCount) {
        return; // Nothing to do if no messages were affected.
      }

      // No undo for move/delete yet. <https://bugzil.la/804916>
      let type = op.operation;
      let canUndo = (op.undo && type !== 'move' && type !== 'delete');
      let text = mozL10n.get('toaster-message-' + type,
          { n: op.affectedCount });
      if (type === 'move' && op.target) {
        text += mozL10n.get('value-name', { name: op.target.name });
      }

      this.toast({
        text: text,
        actionLabel: mozL10n.get('toaster-undo'),
        actionClass: 'undo',
        action: canUndo && op.undo.bind(op)
      });
    },

    /**
     * Called when the user taps the action button (Undo, Retry, etc).
     */
    onAction: function() {
      let actionFunction = (this.currentToast && this.currentToast.action);
      this.hide();
      if (actionFunction) {
        actionFunction();
      }
    },

    /**
     * Display a transient message as a 'toast', with an optional
     * action button. The toast dismisses automatically, unless the
     * user taps the action button or the toast itself.
     *
     * @param {object} opts opts
     * @param {string} opts.text Localized status text to display.
     * @param {string} opts.timeout timeout of display toast.
     * @param {function} opts.action Optional function to call when the user
     *                               clicks the action button. If not provided,
     *                               the action button will not be visible.
     * @param {string} opts.actionLabel Label to display for the action button.
     *                                  Required only if `opts.action` is
     *                                  provided.
     * @param {string} opts.actionClass a CSS class name to apply to the action
     *                                  button.
     */
    toast: function(opts) {
      opts = opts || {};

      Toaster.showToast({
        message: opts.text,
        latency: opts.timeout || this.defaultTimeout
      });
    },

    isShowing: function() {
      return !this.el.classList.contains('collapsed');
    },

    /**
     * Hide the current toast, if one was visible. Idempotent.
     */
    hide: function() {
      this.currentToast = null;
      this.el.classList.add('collapsed');
      this.el.classList.remove('fadeout');
      window.clearTimeout(this._fadeTimeout);
      this._fadeTimeout = null;
    }
  };

  return toaster;
});

/*
 * This file goes along with shared/style/input_areas.css
 * and is required to make the <button type="reset"> buttons work to clear
 * the form fields they are associated with.
 *
 * Bug 830127 should fix input_areas.css and move this JS functionality
 * to a shared JS file, so this file won't be in the email app for long.
 */

define('input_areas',['require','exports','module'],function(require, exports) {
  let slice = Array.prototype.slice;

  return function hookupInputAreaResetButtons(e) {
    // This selector is from shared/style/input_areas.css
    let selector = 'form p input + button[type="reset"],' +
          'form p textarea + button[type="reset"]';
    let resetButtons = slice.call(e.querySelectorAll(selector));
    resetButtons.forEach((resetButton) => {
      resetButton.addEventListener('mousedown', (e) => {
        e.preventDefault();   // Don't take focus from the input field
      });
      resetButton.addEventListener('click', (e) => {
        e.target.previousElementSibling.value = ''; // Clear input field
        e.preventDefault();   // Don't reset the rest of the form.
      });
    });
  };
});


define('cards',['require','exports','module','cards_init','html_cache','l10n!','evt','toaster','transition_end','input_areas'],function(require, exports, module) {

let cardsInit = require('cards_init'),
    htmlCache = require('html_cache'),
    mozL10n = require('l10n!'),
    evt = require('evt'),
    toaster = require('toaster'),
    transitionEnd = require('transition_end'),
    hookupInputAreaResetButtons = require('input_areas');

function addClass(domNode, name) {
  if (domNode) {
    domNode.classList.add(name);
  }
}

function removeClass(domNode, name) {
  if (domNode) {
    domNode.classList.remove(name);
  }
}

/**
 * Fairly simple card abstraction with support for simple horizontal animated
 * transitions.  We are cribbing from deuxdrop's mobile UI's cards.js
 * implementation created jrburke.
 */
let cards = {
  _endKeyClicked: false,
  _backgroundUpdate: false,
  _cardDefs: {},

  /*
   * Existing cards, left-to-right, new cards getting pushed onto the right.
   */
  _cardStack: [],
  activeCardIndex: -1,
  /*
   * @oneof[null @listof[cardName modeName]]{
   *   If a lazy load is causing us to have to wait before we push a card, this
   *   is the type of card we are planning to push.  This is used by hasCard
   *   to avoid returning misleading answers while an async push is happening.
   * }
   */
  _pendingPush: null,

  /**
   * Cards can stack on top of each other, make sure the stacked set is
   * visible over the lower sets.
   */
  _zIndex: 0,

  /**
   * The DOM node that contains the _containerNode ("#cardContainer") and which
   * we inject popup and masking layers into.  The choice of doing the popup
   * stuff at this layer is arbitrary.
   */
  _rootNode: null,

  /**
   * The "#cardContainer" node which serves as the scroll container for the
   * contained _cardsNode ("#cards").  It is as wide as the viewport.
   */
  _containerNode: null,

  /**
   * The "#cards" node that holds the cards; it is as wide as all of the cards
   * it contains and has its left offset changed in order to change what card
   * is visible.
   */
  _cardsNode: null,

  /**
   * The DOM nodes that should be removed from their parent when our current
   * transition ends.
   */
  _animatingDeadDomNodes: [],

  /**
   * Tracks the number of transition events per card animation. Since each
   * animation ends up with two transitionend events since two cards are
   * moving, need to wait for the last one to be finished before doing
   * cleanup, like DOM removal.
   */
  _transitionCount: 0,

  /**
   * Tracks if startup events have been emitted. The events only need to be
   * emitted once.
   * @type {Boolean}
   */
  _startupEventsEmitted: false,

  /**
   * Is a popup visible, suggesting that any click that is not on the popup
   * should be taken as a desire to close the popup?  This is not a boolean,
   * but rather info on the active popup.
   */
  _popupActive: null,

  /**
   * Are we eating all click events we see until we transition to the next
   * card (possibly due to a call to pushCard that has not yet occurred?).
   * Set by calling `eatEventsUntilNextCard`.
   */
  _eatingEventsUntilNextCard: false,

  _supportBackground: true,

  /**
   * Initialize and bind ourselves to the DOM which should now be fully loaded.
   */
  init: function() {
    this._rootNode = document.body;
    this._containerNode = document.getElementById('cardContainer');
    this._cardsNode = document.getElementById('cards');

    this._statusColorMeta = document.querySelector('meta[name="theme-color"]');

    toaster.init(this._containerNode);

    this._containerNode.addEventListener('click',
                                         this._onMaybeIntercept.bind(this),
                                         true);

    // XXX be more platform detecty. or just add more events. unless the
    // prefixes are already gone with webkit and opera?
    transitionEnd(this._cardsNode, this._onTransitionEnd.bind(this), false);

    // Listen for visibility changes to let current card know of them too.
    // Do this here instead of each card needing to listen, and needing to know
    // if it is also the current card.
    document.addEventListener('visibilitychange', () => {
      let card = this._cardStack[this.activeCardIndex];
      if (card && card.onCurrentCardDocumentVisibilityChange) {
        card.onCurrentCardDocumentVisibilityChange(document.hidden);
      }
    });

    cardsInit(this);

    window.addEventListener('largetextenabledchanged', () => {
      window.location.reload();
      document.body.classList.toggle('large-text', navigator.largeTextEnabled);
    });

    this._initKeydownEngine();
  },

  /**
   * If the tray is active and a click happens in the tray area, transition
   * back to the visible thing (which must be to our right currently.)
   */
  _onMaybeIntercept: function(event) {
    if (this._eatingEventsUntilNextCard && event.key !== 'MicrophoneToggle') {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    if (this._popupActive) {
      event.stopPropagation();
      event.preventDefault();
      this._popupActive.close();
      return;
    }

    // Find the card containing the event target.
    let cardNode;
    let bContain = false;
    for (cardNode = event.target; cardNode; cardNode = cardNode.parentElement) {
      if (cardNode.classList.contains('card')) {
        bContain = true;
        break;
      }
    }

    // handling the debug page event target exception
    if (!bContain) {
      let card = this._cardStack[this.activeCardIndex];
      if (event.key === 'Backspace' &&
          card.localName === 'cards-settings-debug') {
        event.stopPropagation();
        event.preventDefault();
        this.removeCardAndSuccessors(card, 'animate', 1)
      }
    }
  },

  /**
   * Push a card onto the card-stack.
   */
  /* @args[
   *   @param[type]
   *   @param[showMethod @oneof[
   *     @case['animate']{
   *       Perform an animated scrolling transition.
   *     }
   *     @case['immediate']{
   *       Immediately warp to the card without animation.
   *     }
   *     @case['none']{
   *       Don't touch the view at all.
   *     }
   *   ]]
   *   @param[args Object]{
   *     An arguments object to provide to the card's constructor when
   *     instantiating.
   *   }
   *   @param[placement #:optional @oneof[
   *     @case[undefined]{
   *       The card gets pushed onto the end of the stack.
   *     }
   *     @case['left']{
   *       The card gets inserted to the left of the current card.
   *     }
   *     @case['right']{
   *       The card gets inserted to the right of the current card.
   *     }
   *   }
   * ]
   */
  pushCard: function(type, showMethod, args, placement) {
    let cardDef = this._cardDefs[type];

    args = args || {};

    if (window.option) {
      if (window.option.menuVisible) {
        window.option.hideMenu();
      }
      window.option.hide();
    }

    if (!cardDef) {
      let cbArgs = Array.slice(arguments);
      this._pendingPush = [type];

      // Only eat clicks if the card will be visibly displayed.
      if (showMethod !== 'none') {
        this.eatEventsUntilNextCard();
      }

      require(['element!cards/' + type], (Ctor) => {
        this._cardDefs[type] = Ctor;
        this.pushCard.apply(this, cbArgs);
      });
      return;
    }

    this._pendingPush = null;

    console.log('pushCard for type: ' + type);

    let domNode = args.cachedNode || new cardDef();

    if (args && domNode.onArgs) {
      domNode.onArgs(args);
    }

    let cardIndex, insertBuddy;
    if (!placement) {
      cardIndex = this._cardStack.length;
      insertBuddy = null;
      domNode.classList.add(cardIndex === 0 ? 'before' : 'after');
    } else if (placement === 'left') {
      cardIndex = this.activeCardIndex++;
      insertBuddy = this._cardsNode.children[cardIndex];
      domNode.classList.add('before');
    } else if (placement === 'right') {
      cardIndex = this.activeCardIndex + 1;
      if (cardIndex >= this._cardStack.length) {
        insertBuddy = null;
      } else {
        insertBuddy = this._cardsNode.children[cardIndex];
      }
      domNode.classList.add('after');
    }
    this._cardStack.splice(cardIndex, 0, domNode);

    if (!args.cachedNode) {
      this._cardsNode.insertBefore(domNode, insertBuddy);
    }

    // If the card has any <button type="reset"> buttons,
    // make them clear the field they're next to and not the entire form.
    // See input_areas.js and shared/style/input_areas.css.
    hookupInputAreaResetButtons(domNode);

    // Only do auto font size watching for cards that do not have more
    // complicated needs, like message_list, which modifies children contents
    // that are not caught by the font_size_util.
    if (!domNode.callHeaderFontSize) {
      // We're appending new elements to DOM so to make sure headers are
      // properly resized and centered, we emit a lazyload event.
      // This will be removed when the gaia-header web component lands.
      window.dispatchEvent(new CustomEvent('lazyload', {
        detail: domNode
      }));
    }

    if ('postInsert' in domNode) {
      domNode.postInsert();
    }

    if (showMethod !== 'none') {
      // make sure the reflow sees the new node so that the animation
      // later is smooth.
      if (!args.cachedNode) {
        domNode.clientWidth;
      }

      this._showCard(cardIndex, showMethod, 'forward');
    }

    if (args.onPushed) {
      args.onPushed(domNode);
    }
  },

  /**
   * Pushes a new card if none exists, otherwise, uses existing
   * card and passes args to that card via tellCard. Arguments
   * are the same as pushCard.
   * @return {Boolean} true if card was pushed.
   */
  pushOrTellCard: function(type, showMethod, args, placement) {
    let query = type;
    if (this.hasCard(query)) {
      this.tellCard(query, args);
      return false;
    } else {
      this.pushCard.apply(this, Array.slice(arguments));
      return true;
    }
  },

  /**
   * Sets the status bar color. The element, or any of its children, can specify
   * the color by setting data-statuscolor to one of the following values:
   * - default: uses the default data-statuscolor set on the meta theme-color
   * tag is used.
   * - background: the CSS background color, via getComputedStyle, is used. This
   * is useful if the background that is desired is not the one from the element
   * itself, but from one of its children.
   * - a specific color value.
   *
   * If no data-statuscolor attribute is found, then the background color for
   * the element, via getComputedStyle, is used. If that value is not a valid
   * color value, then the default statuscolor on the meta tag is used.
   *
   * Note that this method uses getComputedStyle. This could be expensive
   * depending on when it is called. For the card infrastructure, since it is
   * done as part of a card transition, and done before the card transition code
   * applies transition styles, the target element should not be visible at the
   * time of the query. In practice no negligble end user effect has been seen,
   * and that query is much more desirable than hardcoding colors in JS or HTML.
   *
   * @param {Element} [element] the card element of interest. If no element is
   * passed, the the current card is used.
   */
  setStatusColor: function(element) {
    let color;
    // Some use cases, like dialogs, are outside the card stack, so they may
    // not know what element to use for a baseline. In those cases, Cards
    // decides the target element.
    if (!element) {
      element = this._cardStack[this.activeCardIndex];
    }

    // Try first for specific color override. Do a node query, since for custom
    // elements, the custom elment tag may not set its color, but the template
    // used inside the tag may.
    let statusElement = element.dataset.statuscolor ? element :
                        element.querySelector('[data-statuscolor]');

    if (statusElement) {
      color = statusElement.dataset.statuscolor;
      // Allow cards to just indicate they want the default.
      if (color === 'default') {
        color = null;
      } else if (color === 'background') {
        color = getComputedStyle(statusElement).backgroundColor;
      }
    } else {
      // Just use the background color of the original element.
      color = getComputedStyle(element).backgroundColor;
    }

    // Only use specific color values, not values like 'transparent'.
    if (color && color.indexOf('rgb') !== 0 && color.indexOf('#') !== 0) {
      color = null;
    }

    color = color || this._statusColorMeta.dataset.statuscolor;
    let existingColor = this._statusColorMeta.getAttribute('content');
    if (color !== existingColor) {
      this._statusColorMeta.setAttribute('content', color);
    }
  },

  _findCardUsingType: function(type) {
    for (let i = 0; i < this._cardStack.length; i++) {
      let domNode = this._cardStack[i];
      if (htmlCache.nodeToKey(domNode) === type) {
        return i;
      }
    }
  },

  _findCard: function(query, skipFail) {
    let result;
    if (typeof query === 'string') {
      result = this._findCardUsingType(query, skipFail);
    } else if (typeof(query) === 'number') { // index number
      result = query;
    } else {
      // query is a DOM node in this case
      result = this._cardStack.indexOf(query);
    }

    if (result > -1) {
      return result;
    } else if (!skipFail) {
      throw new Error('Unable to find card with query:', query);
    } else {
      // Returning undefined explicitly so that index comparisons, like
      // the one in hasCard, are correct.
      return undefined;
    }
  },

  hasCard: function(query) {
    if (this._pendingPush && this._pendingPush === query) {
      return true;
    }

    return this._findCard(query, true) > -1;
  },

  isVisible: function(domNode) {
    return !!(domNode &&
              domNode.classList.contains('center'));
  },

  findCardObject: function(query) {
    return this._cardStack[this._findCard(query)];
  },

  getCurrentCard: function() {
    return this._cardStack[this.activeCardIndex];
  },

  getCurrentCardType: function() {
    let result = null,
        card = this._cardStack[this.activeCardIndex];

    // Favor any _pendingPush value as it is about to
    // become current, just waiting on an async cycle
    // to finish. Otherwise use current card value.
    if (this._pendingPush) {
      result = this._pendingPush;
    } else if (card) {
      result = htmlCache.nodeToKey(card);
    }
    return result;
  },

  // Filter is an optional paramater. It is a function that returns
  // true if the folder passed to it should be included in the selector
  folderSelector: function(callback, filter, curFolder) {
    require(['model', 'value_selector'], (model, ValueSelector) => {
      // XXX: Unified folders will require us to make sure we get the folder
      //      list for the account the message originates from.
      let optCancel = {
        name: 'Cancel',
        l10nId: 'opt-cancel',
        priority: 1,
        method: () => {
          this.folderPrompt.hide();
        }
      };

      let optSelect = {
        name: 'Select',
        l10nId: 'select',
        priority: 2
      };

      function onFocusChanged() {
        console.log('folderSelector onFocusChanged');
        let actions = [optCancel, optSelect];
        NavigationMap.setSoftKeyBar(actions);
      }

      if (!this.folderPrompt) {
        let selectorTitle = mozL10n.get('messages-folder-select');
        this.folderPrompt = new ValueSelector(selectorTitle, [], [optCancel]);
      }

      model.latestOnce('foldersSlice', (foldersSlice) => {
        let folders = foldersSlice.items;
        this.folderPrompt.List.length = 0; //clear list

        folders.forEach((folder) => {
          let isMatch = !filter || filter(folder);
          if (folder.neededForHierarchy || isMatch) {
            let folderPrompt = this.folderPrompt;
            folderPrompt.addToList(folder.name, folder.depth,
              isMatch,
              function(folder) {
                return () => {
                  folderPrompt.hide();
                  callback(folder);
                };
              }(folder),
              folder === curFolder, //make current folder selected
              folder);
          }
        });
        this.folderPrompt.show(onFocusChanged);
      });
    });
  },

  moveToCard: function(query, showMethod) {
    this._showCard(this._findCard(query), showMethod || 'animate');
  },

  tellCard: function(query, what) {
    let cardIndex = this._findCard(query),
        domNode = this._cardStack[cardIndex];
    if (!('told' in domNode)) {
      console.warn('Tried to tell a card that\'s not listening!', query, what);
    } else {
      domNode.told(what);
    }
  },

  /**
   * Remove the card identified by its DOM node and all the cards to its right.
   * Pass null to remove all of the cards! If cardDomNode passed, but there
   * are no cards before it, cards.getDefaultCard is called to set up a before
   * card.
   */
  /* @args[
   *   @param[cardDomNode]{
   *     The DOM node that is the first card to remove; all of the cards to its
   *     right will also be removed.  If null is passed it is understood you
   *     want to remove all cards.
   *   }
   *   @param[showMethod @oneof[
   *     @case['animate']{
   *       Perform an animated scrolling transition.
   *     }
   *     @case['immediate']{
   *       Immediately warp to the card without animation.
   *     }
   *     @case['none']{
   *       Remove the nodes immediately, don't do anything about the view
   *       position.  You only want to do this if you are going to push one
   *       or more cards and the last card will use a transition of 'immediate'.
   *     }
   *   ]]
   *   @param[numCards #:optional Number]{
   *     The number of cards to remove.  If omitted, all the cards to the right
   *     of this card are removed as well.
   *   }
   *   @param[nextCardSpec #:optional]{
   *     If a showMethod is not 'none', the card to show after removal.
   *   }
   *   @param[skipDefault #:optional Boolean]{
   *     Skips the default pushCard if the removal ends up with no more
   *     cards in the stack.
   *   }
   * ]
   */
  removeCardAndSuccessors: function(cardDomNode, showMethod, numCards,
                                    nextCardSpec, skipDefault) {
    if (!this._cardStack.length) {
      return;
    }

    if (showMethod === 'delay-animate') {
      this.eatEventsUntilNextCard();
      setTimeout(()=> {
        this.removeCardAndSuccessors(cardDomNode, 'animate', numCards,
                                     nextCardSpec, skipDefault);
      }, 100);
      return;
    }

    if (cardDomNode && this._cardStack.length === 1 && !skipDefault) {
      // No card to go to when done, so ask for a default
      // card and continue work once it exists.
      return cards.pushDefaultCard(() => {
        this.removeCardAndSuccessors(cardDomNode, showMethod, numCards,
                                    nextCardSpec);
      });
    }

    if (window.option) {
      if (window.option.menuVisible) {
        window.option.hideMenu();
      }
      window.option.hide();
    }

    let firstIndex, iCard, domNode;
    if (cardDomNode === undefined) {
      throw new Error('undefined is not a valid card spec!');
    }
    else if (cardDomNode === null) {
      firstIndex = 0;
      // reset the z-index to 0 since we may have cards in the stack that
      // adjusted the z-index (and we are definitively clearing all cards).
      this._zIndex = 0;
    }
    else {
      for (iCard = this._cardStack.length - 1; iCard >= 0; iCard--) {
        domNode = this._cardStack[iCard];
        if (domNode === cardDomNode) {
          firstIndex = iCard;
          break;
        }
      }
      if (firstIndex === undefined) {
        throw new Error('No card represented by that DOM node');
      }
    }
    if (!numCards) {
      numCards = this._cardStack.length - firstIndex;
    }

    if (showMethod === 'none') {
      // If a 'none' remove, and the remove is for a DOM node that used
      // anim-overlay, which would have increased the _zIndex when added, adjust
      // the zIndex appropriately.
      if (cardDomNode && cardDomNode.classList.contains('anim-overlay')) {
        this._zIndex -= 10;
      }
    } else {
      let nextCardIndex = -1;
      if (nextCardSpec) {
        nextCardIndex = this._findCard(nextCardSpec);
      } else if (this._cardStack.length) {
        nextCardIndex = Math.min(firstIndex - 1, this._cardStack.length - 1);
      }

      if (nextCardIndex > -1) {
        this._showCard(nextCardIndex, showMethod, 'back');
      }
    }

    // Update activeCardIndex if nodes were removed that would affect its
    // value.
    if (firstIndex <= this.activeCardIndex) {
      this.activeCardIndex -= numCards;
      if (this.activeCardIndex < -1) {
        this.activeCardIndex = -1;
      }
    }

    let deadDomNodes = this._cardStack.splice(firstIndex, numCards);
    for (iCard = 0; iCard < deadDomNodes.length; iCard++) {
      domNode = deadDomNodes[iCard];
      try {
        domNode.die();
      }
      catch (ex) {
        console.warn('Problem cleaning up card:', ex, '\n', ex.stack);
      }
      switch (showMethod) {
        case 'animate':
        case 'immediate': // XXX handle properly
          this._animatingDeadDomNodes.push(domNode);
          break;
        case 'none':
          domNode.parentNode.removeChild(domNode);
          break;
      }
    }

    // Reset aria-hidden attributes to handle cards visibility.
    this._setScreenReaderVisibility();
  },

  /**
   * Shortcut for removing all the cards
   */
  removeAllCards: function() {
    return this.removeCardAndSuccessors(null, 'none');
  },

  _showCard: function(cardIndex, showMethod, navDirection) {
    // Do not do anything if this is a show card for the current card.
    if (cardIndex === this.activeCardIndex) {
      return;
    }

    // If the active element is one that can have focus, blur it so that the
    // keyboard goes away.
    let activeElement = document.activeElement;
    if (activeElement && activeElement.blur) {
      activeElement.blur();
    }

    // Remove focus when showing card, will reset focus when card visible,
    // this can avoid some focus errors
    let focused = document.querySelectorAll('.focus');
    for (let i = 0; i < focused.length; i++) {
      focused[i].classList.remove('focus');
    }

    if (cardIndex > this._cardStack.length - 1) {
      // Some cards were removed, adjust.
      cardIndex = this._cardStack.length - 1;
    }
    if (this.activeCardIndex > this._cardStack.length - 1) {
      this.activeCardIndex = -1;
    }

    if (this.activeCardIndex === -1) {
      this.activeCardIndex = cardIndex === 0 ? cardIndex : cardIndex - 1;
    }

    let domNode = (cardIndex !== null) ? this._cardStack[cardIndex] : null;
    let beginNode = this._cardStack[this.activeCardIndex];
    let endNode = this._cardStack[cardIndex];
    let isForward = navDirection === 'forward';

    if (this._cardStack.length === 1) {
      // Reset zIndex so that it does not grow ever higher when all but
      // one card are removed
      this._zIndex = 0;
    }

    // If going forward and it is an overlay node, then do not animate the
    // beginning node, it will just sit under the overlay.
    if (isForward && endNode.classList.contains('anim-overlay')) {
      beginNode = null;

      // anim-overlays are the transitions to new layers in the stack. If
      // starting a new one, it is forward movement and needs a new zIndex.
      // Otherwise, going back to
      this._zIndex += 10;
    }

    // If going back and the beginning node was an overlay, do not animate
    // the end node, since it should just be hidden under the overlay.
    if (beginNode && beginNode.classList.contains('anim-overlay')) {
      if (isForward) {
        // If a forward animation and overlay had a vertical transition,
        // disable it, use normal horizontal transition.
        if (showMethod !== 'immediate') {
          if (beginNode.classList.contains('anim-vertical')) {
            removeClass(beginNode, 'anim-vertical');
            addClass(beginNode, 'disabled-anim-vertical');
          } else if (beginNode.classList.contains('anim-fade')) {
            removeClass(beginNode, 'anim-fade');
            addClass(beginNode, 'disabled-anim-fade');
          }
        }
      } else {
        endNode = null;
        this._zIndex -= 10;
      }
    }

    // If the zindex is not zero, then in an overlay stack, adjust zindex
    // accordingly.
    if (endNode && isForward && this._zIndex) {
      endNode.style.zIndex = this._zIndex;
    }

    let cardsNode = this._cardsNode;

    if (showMethod === 'immediate') {
      addClass(beginNode, 'no-anim');
      addClass(endNode, 'no-anim');

      // make sure the reflow sees the transition is turned off.
      cardsNode.clientWidth;
      // explicitly clear since there will be no animation
      this._eatingEventsUntilNextCard = false;
    }
    else if (showMethod === 'none') {
      // do not set _eatingEventsUntilNextCard, but don't clear it either.
    }
    else {
      this._transitionCount = (beginNode && endNode) ? 2 : 1;
      this._eatingEventsUntilNextCard = true;
    }

    if (this.activeCardIndex === cardIndex) {
      // same node, no transition, just bootstrapping UI.
      removeClass(beginNode, 'before');
      removeClass(beginNode, 'after');
      addClass(beginNode, 'center');
    } else if (this.activeCardIndex > cardIndex) {
      // back
      removeClass(beginNode, 'center');
      addClass(beginNode, 'after');

      removeClass(endNode, 'before');
      addClass(endNode, 'center');
    } else {
      // forward
      removeClass(beginNode, 'center');
      addClass(beginNode, 'before');

      removeClass(endNode, 'after');
      addClass(endNode, 'center');
    }

    let prevCard = this._cardStack[this.activeCardIndex];
    if (isForward && prevCard && prevCard.onHidden) {
      prevCard.onHidden();
    }

    // store navDirection used later by calling onCardVisible
    domNode.navDirection = navDirection;
    // Add class 'p-pri' if in large text mode
    if (navigator.largeTextEnabled) {
      ['span', 'input', 'label', 'select', 'a', 'h2'].forEach((tag) => {
        let tags = domNode.getElementsByTagName(tag);
        for (let i = 0; i < tags.length; i++) {
          if (!tags[i].classList.contains('p-pri') &&
              !tags[i].classList.contains('p-sec')) {
            if (tags[i].parentNode.nodeName !== 'H2') {
              tags[i].classList.add('p-pri');
            } else {
              tags[i].classList.add('p-sec');
            }
          }
        }
      });
    }

    if (showMethod === 'immediate') {
      // make sure the instantaneous transition is seen before we turn
      // transitions back on.
      cardsNode.clientWidth;

      removeClass(beginNode, 'no-anim');
      removeClass(endNode, 'no-anim');

      this._onCardVisible(domNode);
    }

    // Hide toaster while active card index changed:
    toaster.hide();

    this.activeCardIndex = cardIndex;

    // Reset aria-hidden attributes to handle cards visibility.
    this._setScreenReaderVisibility();
  },

  _setScreenReaderVisibility: function() {
    // We use aria-hidden to handle visibility instead of CSS because there are
    // semi-transparent cards, such as folder picker.
    this._cardStack.forEach((card, index) => {
      card.setAttribute('aria-hidden', index !== this.activeCardIndex);
    }, this);
  },

  _onTransitionEnd: function(event) {
    // Avoid other transitions except ones on cards as a whole.
    if (!event.target.classList.contains('card')) {
      return;
    }

    let activeCard = this._cardStack[this.activeCardIndex];
    // If no current card, this could be initial setup from cache, no valid
    // cards yet, so bail.
    if (!activeCard) {
      return;
    }

    // Multiple cards can animate, so there can be multiple transitionend
    // events. Only do the end work when all have finished animating.
    if (this._transitionCount > 0) {
      this._transitionCount -= 1;
    }

    if (this._transitionCount === 0) {
      if (this._eatingEventsUntilNextCard) {
        this._eatingEventsUntilNextCard = false;
      }
      if (this._animatingDeadDomNodes.length) {
        // Use a setTimeout to give the animation some space to settle.
        setTimeout(() => {
          this._animatingDeadDomNodes.forEach((domNode) => {
            if (domNode.parentNode) {
              domNode.parentNode.removeChild(domNode);
            }
          });
          this._animatingDeadDomNodes = [];
        }, 100);
      }

      // If an vertical overlay transition was was disabled, if
      // current node index is an overlay, enable it again.
      let endNode = activeCard;

      if (endNode.classList.contains('disabled-anim-vertical')) {
        removeClass(endNode, 'disabled-anim-vertical');
        addClass(endNode, 'anim-vertical');
      } else if (endNode.classList.contains('disabled-anim-fade')) {
        removeClass(endNode, 'disabled-anim-fade');
        addClass(endNode, 'anim-fade');
      }

      // If any action to do at the end of transition trigger now.
      if (this._afterTransitionAction) {
        let afterTransitionAction = this._afterTransitionAction;
        this._afterTransitionAction = null;
        afterTransitionAction();
      }

      this._onCardVisible(activeCard);

      // If the card has next cards that can be preloaded, load them now.
      // Use of nextCards should be balanced with startup performance.
      // nextCards can result in smoother transitions to new cards on first
      // navigation to that new card type, but loading the extra module may
      // also compete with current card and data model performance.
      let nextCards = activeCard.nextCards;
      if (nextCards) {
        console.log('Preloading cards: ' + nextCards);
        require(nextCards.map((id) => {
          return 'cards/' + id;
        }));
      }
    }
  },

  /**
   * Handles final notification of card visibility in the stack.
   * @param  {Card} domNode the card instance.
   */
  _onCardVisible: function(domNode) {
    if (domNode.onCardVisible) {
      domNode.onCardVisible(domNode.navDirection);
    }
    if (window.option) {
      window.option.show();
    }
    this._emitStartupEvents(domNode.skipEmitContentEvents);
  },

  /**
   * Handles emitting startup events used for performance tracking.
   * @param  {Boolean} skipEmitContentEvents if content events should be skipped
   * because the card itself handles it.
   */
  _emitStartupEvents: function(skipEmitContentEvents) {
    if (!this._startupEventsEmitted) {
      if (window.startupCacheEventsSent) {
        // Cache already loaded, so at this point the content shown is wired
        // to event handlers.
        window.performance.mark('contentInteractive');
        window.dispatchEvent(new CustomEvent('moz-content-interactive'));
      } else {
        // Cache was not used, so only now is the chrome dom loaded.
        window.performance.mark('navigationLoaded');
        window.dispatchEvent(new CustomEvent('moz-chrome-dom-loaded'));
      }
      window.performance.mark('navigationInteractive');
      window.dispatchEvent(new CustomEvent('moz-chrome-interactive'));

      // If a card that has a simple static content DOM, content is complete.
      // Otherwise, like message_list, need backend data to call complete.
      if (!skipEmitContentEvents) {
        evt.emit('metrics:contentDone');
      }

      this._startupEventsEmitted = true;
    }
  },

  /**
   * Helper that causes (some) events targeted at our cards to be eaten until
   * we get to the next card.  The idea is to avoid bugs caused by the user
   * still being able to click things while our cards are transitioning or
   * while we are performing a (reliable) async wait before we actually initiate
   * a pushCard in response to user stimulus.
   *
   * This is automatically triggered when performing an animated transition;
   * other code should only call this in the async wait case mentioned above.
   *
   * For example, we don't want the user to have 2 message readers happening
   * at the same time because they managed to click on a second message before
   * the first reader got displayed.
   */
  eatEventsUntilNextCard: function() {
    this._eatingEventsUntilNextCard = true;
  },

  /**
   * Stop eating events, presumably because eatEventsUntilNextCard was used
   * as a hack for a known-fast async operation to avoid bugs (where we knew
   * full well that we weren't going to show a card).
   */
  stopEatingEvents: function() {
    this._eatingEventsUntilNextCard = false;
  },

  /**
   * If there are any cards on the deck right now, log an error and clear them
   * all out.  Our caller is strongly asserting that there should be no cards
   * and the presence of any indicates a bug.
   */
  assertNoCards: function() {
    if (this._cardStack.length) {
      throw new Error('There are ' + this._cardStack.length + ' cards but' +
                      ' there should be ZERO');
    }
  },

  _closeApp: function() {
    window.close();
  },

  _initKeydownEngine: function() {
    window.addEventListener('keydown', (evt) => {
      if (evt.key === 'EndCall' && !this._supportBackground) {
        if (!!this._cardStack[this.activeCardIndex].endkeyHandler) {
          evt.preventDefault();
          if (this._endKeyClicked) {
            this._closeApp();
          } else {
            this._endKeyClicked = true;
            window.dispatchEvent(new CustomEvent('email-endkey', {
              detail: { callback: this._closeApp },
              bubbles: true,
              cancelable: false
            }));
          }
        } else {
          // Do nothing. System will close or kill on demand.
        }
      } else {
        this._onMaybeIntercept(evt);
      }
    });
  },

};

return cards;

});



define('array',['require'],function(require) {
  let array = {
    /**
     * @param {Array} array some array.
     * @param {Function} callback function to test for each element.
     * @param {Object} thisObject object to use as this for callback.
     */
    indexOfGeneric: function(array, callback, thisObject) {
      let result = -1;
      array.some((value, index) => {
        if (callback.call(thisObject, value)) {
          result = index;
          return true;
        }
      });

      return result;
    }
  };

  return array;
});

/*global define */

/**
 * @fileoverview Bug 918303 - HeaderCursor added to provide MessageListCard and
 *     MessageReaderCard the current message and whether there are adjacent
 *     messages that can be advanced to. Expect for [other] consumers to add
 *     additional data to messagesSlice items after they've left the MailAPI.
 */
define('header_cursor',['require','array','evt','model'],function(require) {
  let array = require('array'),
      evt = require('evt'),
      model = require('model');

  function makeListener(type, obj) {
    return function() {
      let args = Array.slice(arguments);
      this.emit.apply(this, ['messages_' + type].concat(args));
    }.bind(obj);
  }

  function compareNoCase(str1, str2) {
    if (!str1) {
      str1 = '';
    }
    if (!str2) {
      str2 = '';
    }
    return str1.toLocaleUpperCase()
        .localeCompare(str2.toLocaleUpperCase());
  }

  let sortFunc = {
    'date':
      function byDate(a, b) {
        return b.date - a.date; //newer first
      },

    'from':
      function byFrom(a, b) {
        return compareNoCase(a.author.address, b.author.address);
      },

    'to':
      function byTo(a, b) {
        return compareNoCase(a.to[0].address, b.to[0].address);
      },

    'subject':
      function bySubject(a, b) {
        return compareNoCase(a.subject, b.subject);
      }
  };

  /**
   * @constructor
   */
  function HeaderCursor() {
    // Inherit from evt.Emitter.
    evt.Emitter.call(this);

    // Need to distinguish between search and nonsearch slices,
    // since there can be two cards that both are listening for
    // slice changes, but one is for search output, and one is
    // for nonsearch output. The message_list is an example.
    this.searchMode = 'nonsearch';
  }

  HeaderCursor.prototype = evt.mix({
    /**
     * @type {CurrentMessage}
     */
    currentMessage: null,

    /**
     * @type {HeadersViewSlice}
     */
    messagesSlice: null,

    /**
     * @type {String}
     */
    expectingMessageSuid: null,

    /**
     * @type {Array}
     */
    sliceEvents: ['splice', 'change', 'status', 'remove', 'complete'],

    _inited: false,

    sortSymbol: false,

    folderSortType: 'date',

    /**
     * Sets up the event wiring and will trigger the slice creation by listening
     * to model 'folder' changes. Want to wait until there are views that need
     * to use the header_cursor for showing UI, to avoid extra work, like in the
     * background sync case.
     */
    init: function() {
      this._inited = true;

      // Listen for some slice events to do some special work.
      this.on('messages_splice', this.onMessagesSplice.bind(this));
      this.on('messages_remove', this.onMessagesSpliceRemove.bind(this));
      this.on('messages_complete', () => {
        // Consumers, like message_list, always want their 'complete' work
        // to fire, but by default the slice removes the complete handler
        // at the end. So rebind on each call here.
        if (this.messagesSlice) {
          this.messagesSlice.oncomplete = makeListener('complete', this);
        }
      });

      // Listen to model for folder changes.
      this.onLatestFolder = this.onLatestFolder.bind(this);
      model.latest('folder', this.onLatestFolder);
    },

    /**
     * The messageReader told us it wanted to advance, so we should go ahead
     * and update our currentMessage appropriately and then report the new one.
     *
     * @param {string} direction either 'next' or 'previous'.
     */
    advance: function(direction) {
      let index = this.indexOfMessageById(this.currentMessage.header.id);
      switch (direction) {
        case 'previous':
          index -= 1;
          break;
        case 'next':
          index += 1;
          break;
      }

      let messages = this.messagesSlice.items;
      if (index < 0 || index >= messages.length) {
        // We can't advance that far!
        return;
      }

      this.setCurrentMessageByIndex(index);
    },

    /**
     * Tracks a messageSuid to use in selecting
     * the currentMessage once the slice data loads.
     * @param {String} messageSuid The message suid.
     */
    setCurrentMessageBySuid: function(messageSuid) {
      this.expectingMessageSuid = messageSuid;
      this.checkExpectingMessageSuid();
    },

    /**
     * Sets the currentMessage if there are messages now to check
     * against expectingMessageSuid. Only works if current folder
     * is set to an "inbox" type, so only useful for jumps into
     * the email app from an entry point like a notification.
     * @param  {Boolean} eventIfNotFound if set to true, an event
     * is emitted if the messageSuid is not found in the set of
     * messages.
     */
    checkExpectingMessageSuid: function(eventIfNotFound) {
      let messageSuid = this.expectingMessageSuid;
      if (!messageSuid || !model.folder || model.folder.type !== 'inbox') {
        return;
      }

      let index = this.indexOfMessageById(messageSuid);
      if (index > -1) {
        this.expectingMessageSuid = null;
        return this.setCurrentMessageByIndex(index);
      }

      if (eventIfNotFound) {
        console.error('header_cursor could not find messageSuid ' +
                      messageSuid + ', emitting messageSuidNotFound');
        this.emit('messageSuidNotFound', messageSuid);
      }
    },

    /**
     * @param {MailHeader} header message header.
     */
    setCurrentMessage: function(header) {
      if (!header) {
        return;
      }

      this.setCurrentMessageByIndex(this.indexOfMessageById(header.id));
    },

    setCurrentMessageByIndex: function(index) {
      let messages = this.messagesSlice.items;

      // Do not bother if not a valid index.
      if (index === -1 || index > messages.length - 1) {
        return;
      }

      let header = messages[index];
      if ('header' in header) {
        header = header.header;
      }

      let currentMessage = new CurrentMessage(header, {
        hasPrevious: index !== 0,                 // Can't be first
        hasNext: index !== messages.length - 1    // Can't be last
      });

      this.emit('currentMessage', currentMessage, index);
      this.currentMessage = currentMessage;
    },

    /**
     * @param {string} id message id.
     * @return {number} the index of the message cursor's current message
     *     in the message slice it has checked out.
     */
    indexOfMessageById: function(id) {
      let messages = (this.messagesSlice && this.messagesSlice.items) || [];
      return array.indexOfGeneric(messages, (message) => {
        let other = 'header' in message ? message.header.id : message.id;
        return other === id;
      });
    },

    /**
     * @param {Object} folder the folder we switched to.
     */
    onLatestFolder: function(folder) {
      // It is possible that the notification of latest folder is fired
      // but in the meantime the foldersSlice could be cleared due to
      // a change in the current account, before this listener is called.
      // So skip this work if no foldersSlice, this method will be called
      // again soon.
      if (!model.foldersSlice) {
        return;
      }

      this.folderSortType = 'date';
      this.freshMessagesSlice();
    },

    startSearch: function(phrase, whatToSearch) {
      this.searchMode = 'search';
      this.bindToSlice(model.api.searchFolderMessages(model.folder,
                                                      phrase,
                                                      whatToSearch));
    },

    endSearch: function() {
      this.die();
      this.searchMode = 'nonsearch';
      this.freshMessagesSlice();
    },

    freshMessagesSlice: function() {
      this.bindToSlice(model.api.viewFolderMessages(model.folder));
    },

    /**
     * holds on to messagesSlice and binds some events to it.
     * @param  {Slice} messagesSlice the new messagesSlice.
     */
    bindToSlice: function(messagesSlice) {
      this.die();

      this.messagesSlice = messagesSlice;
      this.sliceEvents.forEach((type) => {
        messagesSlice['on' + type] = makeListener(type, this);
      });
    },

    onMessagesSplice: function(index, howMany, addedItems,
                                      requested, moreExpected) {
      // Avoid doing work if get called while in the process of
      // shutting down.
      if (!this.messagesSlice) {
        return;
      }

      if (this.sortType || addedItems.length) {
        if (this.messagesSlice.items) {
          if (this.messagesSlice.items.length ===
              this.messagesSlice.headerCount) {
            this.sortType = this.sortType || this.folderSortType;
            this.messagesSlice.items.sort(sortFunc[this.sortType]);
            this.sortType = null;
            if (this.sortSymbol) {
              this.emit('messageSorted');
              this.sortSymbol = false;
            }
          }
        }
      }
      // If there was a messageSuid expected and at the top, then
      // check to see if it was received. This is really just nice
      // for when a new message notification comes in, as the atTop
      // test is a bit fuzzy generally. Not all slices go to the top.
      if (this.messagesSlice.atTop && this.expectingMessageSuid &&
          this.messagesSlice.items && this.messagesSlice.items.length) {
        this.checkExpectingMessageSuid(true);
      }
    },

    /**
     * Choose a new currentMessage if we spilled the existing one.
     * Otherwise, emit 'currentMessage' event to update stale listeners
     * in case we spilled a sibling.
     *
     * @param {MailHeader} removedHeader header that got removed.
     * @param {number} removedFromIndex index header was removed from.
     */
    onMessagesSpliceRemove: function(removedHeader, removedFromIndex) {
      if (this.currentMessage !== removedHeader) {
        // Emit 'currentMessage' event in case we're spilling a sibling.
        return this.setCurrentMessage(this.currentMessage);
      }

      let messages = this.messagesSlice.items;
      if (messages.length === 0) {
        // No more messages... sad!
        return (this.currentMessage = null);
      }

      let index = Math.min(removedFromIndex, messages.length - 1);
      let message = this.messagesSlice.items[index];
      this.setCurrentMessage(message);
    },

    die: function() {
      if (this.messagesSlice) {
        this.messagesSlice.die();
        this.messagesSlice = null;
      }

      this.currentMessage = null;
    },

    sortBy: function(type) {
      let fillSize;
      this.sortSymbol = true;
      if (this.messagesSlice) {
        fillSize = this.messagesSlice.headerCount;
      }
      this.sortType = type;
      this.folderSortType = type;
      this.bindToSlice(model.api.sortFolderMessages(model.folder, fillSize));
    }
  });

  /*
   * Override the .on method so that initialization and slice creation is
   * delayed until there are listeners.
   */
  let oldOn = HeaderCursor.prototype.on;
  HeaderCursor.prototype.on = function() {
    if (!this._inited) {
      this.init();
      HeaderCursor.prototype.on = oldOn;
    }

    return oldOn.apply(this, arguments);
  };

  /**
   * @constructor
   * @param {MailHeader} header message header.
   * @param {Object} siblings whether message has next and previous siblings.
   */
  function CurrentMessage(header, siblings) {
    this.header = header;
    this.siblings = siblings;
  }

  CurrentMessage.prototype = {
    /**
     * @type {MailHeader}
     */
    header: null,

    /**
     * Something like { hasPrevious: true, hasNext: false }.
     * @type {Object}
     */
    siblings: null
  };

  return {
    CurrentMessage: CurrentMessage,
    cursor: new HeaderCursor()
  };
});


/**
 * Sane equivalence checking, originally from loggest's rdcommon/log.js.
 */

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at:
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Raindrop Code.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * This module exports a single comparison function:
 *
 *   equal(a, b) -> boolean
 *
 */
define('ext/ext/equal',['require'],function(require) {

  /**
   * Maximum comparison depth for argument equivalence in expectation checking.
   *  This value gets bumped every time I throw something at it that fails that
   *  still seems reasonable to me.
   */
  var COMPARE_DEPTH = 6;

  function boundedCmpObjs(a, b, depthLeft) {
    var aAttrCount = 0, bAttrCount = 0, key, nextDepth = depthLeft - 1;

    if ('toJSON' in a)
      a = a.toJSON();
    if ('toJSON' in b)
      b = b.toJSON();

    for (key in a) {
      aAttrCount++;
      if (!(key in b))
        return false;

      if (depthLeft) {
        if (!equal(a[key], b[key], nextDepth))
          return false;
      }
      else {
        if (a[key] !== b[key])
          return false;
      }
    }
    // the theory is that if every key in a is in b and its value is equal, and
    //  there are the same number of keys in b, then they must be equal.
    for (key in b) {
      bAttrCount++;
    }
    if (aAttrCount !== bAttrCount)
      return false;
    return true;
  }

  /**
   * @return[Boolean]{
   *   True when equivalent, false when not equivalent.
   * }
   */
  function equal(a, b, depthLeft) {
    if (depthLeft === undefined) {
      depthLeft = COMPARE_DEPTH;
    }
    var ta = typeof(a), tb = typeof(b);
    if (ta !== 'object' || (tb !== ta) || (a == null) || (b == null))
      return a === b;
    // fast-path for identical objects
    if (a === b)
      return true;
    if (Array.isArray(a)) {
      if (!Array.isArray(b))
        return false;
      if (a.length !== b.length)
        return false;
      for (var iArr = 0; iArr < a.length; iArr++) {
        if (!equal(a[iArr], b[iArr], depthLeft - 1))
          return false;
      }
      return true;
    }
    return boundedCmpObjs(a, b, depthLeft);
  }

  return equal;

}); // end define
;
/**
 * Logic is a structured logging system with bonus features for tracking
 * asynchronous code flow and simple unit testing.
 *
 * This docstring is a quick tutorial.
 *
 *******************************************************************************
 * SCOPES
 *
 * Every log must be associated with a Scope.
 *
 * A Scope is just a wrapper around a namespace and a set of default arguments.
 * When you hear "Scope", think "Logger". You could create a scope like so:
 *
 *   var scope = logic.scope('Animal');
 *
 * Then, you'd do this to log events (see below for more on logging):
 *
 *   logic(scope, 'createdAnimal'); // shorthand for logic.event(...)
 *
 * However, it's inconvenient to pass around scopes, just like it's inconvenient
 * to pass around loggers. So Logic allows you to associate a Scope with an
 * object, like a class instance, and use that object in place of the Scope:
 *
 *   function Animal(name) {
 *     logic.defineScope(this, 'Animal');
 *     logic(this, 'createdAnimal');
 *   }
 *
 * Scopes have two properties: a namespace and default details. When you log
 * an event, it absorbs these things from its associated scope.
 *
 * More about Scopes later; let's talk Events.
 *
 *******************************************************************************
 * EVENT BASICS
 *
 * Logic operates under the principle that "everything is an event", and your
 * program's execution flow can be encoded into a big list of events. Rather
 * than tracking hierarchical relationships in logged events itself, Logic
 * stores relevant information (such as a namespace) on each and every event.
 *
 * Every event, when serialized, is just a simple self-describing JSON payload.
 *
 * By distilling program execution into a linear sequence of Events, we can
 * later reconstruct additional hierarchy or metadata by analyzing the resulting
 * stream, rather than pushing the "burden of understanding" onto the logging
 * framework itself.
 *
 * While you can log events with "logic.event(...)", we also expose "logic(...)"
 * as a convenient shorthand.
 *
 * Events consist of the following:
 *
 *   scope:
 *     The associated scope, which lends a 'namespace' and default details.
 *   type:
 *     The type of the event. You define what it means.
 *   details:
 *     A key-value object of additional details. Any default details associated
 *     with the scope are merged into these details.
 *
 * So given the following code:
 *
 *   function Animal(name) {
 *     logic.defineScope('Animal', { name: name });
 *     logic(this, 'animalCreated', { why: 'because' });
 *   }
 *   Animal.prototype.say = function(what) {
 *     logic(this, 'said', { what: what });
 *   }
 *   new Animal('Riker').say('sup');
 *
 * Logic would output something like the following:
 *
 * [
 *   { namespace: 'Animal',
 *     type: 'animalCreated',
 *     details: { name: 'Riker', why: 'because' } },
 *   { namespace: 'Animal',
 *     type: 'said',
 *     details: { name: 'Riker', what: 'sup' } }
 * ]
 *
 * Notice how every event receives a copy of the details it has been passed?
 * This makes events self-describing. Note that the 'name' detail, passed in
 * logic.defineScope, is also copied to each event.
 *
 * It's often useful to log several things with a set of additional details, and
 * for that, we have subscopes:
 *
 *   var subscope = logic.subscope(animal, { color: 'brown' })
 *   logic(subscope, 'run') // ==> { details: { color: 'brown', name: 'Riker' }}
 *
 * There is no explicit concept of hierarchy. Rather, we expect to reconstruct
 * anything we need when viewing the logs later (i.e. in logic-inspector).
 *
 * There is also no concept of log levels. In practice, the logs we want
 * bug-reporters to see are console logs, not logic events, and only we can
 * understand what the chain of complex events means in context. For instance,
 * errors are often expected in unit tests, where it doesn't make sense to
 * categorically treat them as bright-red errors. (The distinction between
 * log/info/warn events is often unclear, but perhaps a case could be made for
 * distinguishing errors.)
 *
 * In general, our logs should just objectively report what happens, leaving
 * logic-inspector to decide what's important.
 *
 *******************************************************************************
 * ASYNC and AWAIT
 *
 * Tracking events _within_ an individual scope is nice, but often we need to
 * track asynchronous events that get passed around. For that, Logic provides
 * 'logic.async' and 'logic.await', two primitives to annotate async behavior.
 *
 *   var promise = logic.async(this, 'does a job', (resolve) => {...})
 *
 *   logic.await(otherScope, 'waiting for job done', promise)
 *     .then(...)
 *
 * Logic will then log events corresponding to the Promise's resolution and
 * state (such as which events depend on other events) so that we can later
 * reconstruct graphs of the code flow and dependencies. With those two
 * primitives, we could construct a graph like the following:
 *
 *   [ Animal ]               [ Owner ]
 *                             __________________
 *    ________________        | ASYNC            |
 *   | AWAIT dog bowl |       | Filling dog bowl |
 *   |                |       |                  |
 *   |                |       |                  |
 *   |________________|       |__________________|
 *         done  <--------------------/
 *
 * Unfortunately, it's hard to display all that information such that it doesn't
 * get in the way. :mcav attempted to add digraph-like views to logic-inspector,
 * but didn't have much success making it usable yet.
 *
 *******************************************************************************
 * TESTING
 *
 * To write tests against your logic logs, Logic provides the 'logic.match'
 * function.
 *
 * var promise = logic
 *   .match('Animal', 'animalCreated', { name: 'Riker' })
 *   .match('Animal', 'say')
 *   .failIfMatched('Animal', 'died');
 *
 * In the snippet above, the first logic.match call returns an object that has
 * `.then` and `.match`, so that you can treat it like a Promise as well as
 * easily chain further expectations. The promise chain will resolve after all
 * of those conditions have matched, or a timeout has been reached.
 *
 * See test_disaster_recovery.js for an example test using these primitives.
 */
define('ext/logic',['require','evt','./ext/equal'],function(require) {
  var evt = require('evt');
  // Use a relative path here to avoid having consumers need special require
  // configs (we already specify 'evt' in the frontend).
  var equal = require('./ext/equal');

  /**
   * The `logic` module is callable, as a shorthand for `logic.event()`.
   */
  function logic() {
    return logic.event.apply(logic, arguments);
  }

  evt.mix(logic);

  /**
   * Create a new Scope with the given namespace and default details.
   *
   * @param {string} namespace
   * @param {object|null} defaultDetails
   */
  logic.scope = function(namespace, defaultDetails) {
      return new Scope(namespace, defaultDetails);
  };

  var objectToScope = new WeakMap();

  function toScope(scope) {
    if (!(scope instanceof Scope)) {
      scope = objectToScope.get(scope);
      if (!scope) {
        throw new Error('Invalid scope ' + scope +
                        ' passed to logic.event(); ' +
                        'did you remember to call logic.defineScope()? ' +
                        new Error().stack);
      }
    }
    return scope;
  }

  /**
   * Most often, scopes and namespaces map one-to-one with class instances. With
   * defineScope(), you can associate a Scope with an object, and then use that
   * object in place of the scope. For instance:
   *
   *   function MyClass() {
   *     logic.defineScope(this, 'MyClass');
   *     logic.event(this, 'initialized');
   *   }
   */
  logic.defineScope = function(obj, namespace, defaultDetails) {
    // Default to the object's class name, if available.
    if (!namespace && obj && obj.constructor && obj.constructor.name) {
      namespace = obj.constructor.name;
    }
    var scope = new Scope(namespace, defaultDetails);
    objectToScope.set(obj, scope);
    return scope;
  };

  /**
   * Sometimes, you may want to log several events, each with shared
   * details. With logic.subscope(), you can create a child scope that
   * shares the same namespace, but adds additional default details
   * onto each message. For instance:
   *
   *   logic.defineScope(this, 'Account', { accountId: 1 });
   *   var scope = logic.subscope(this, { action: 'move' });
   *   logic.log(scope, 'start');
   *   // event: Account/start { accountId: 1, action: 'move' }
   */
  logic.subscope = function(scope, defaultDetails) {
    scope = toScope(scope);
    return new Scope(scope.namespace, into(shallowClone(scope.defaultDetails),
                                           shallowClone(defaultDetails)));
  };

  /**
   * Emit an event. `logic(...)` is shorthand for `logic.event(...)`.
   * See the module docs for more about events.
   *
   * @param {Scope} scope
   *   The scope (i.e. "namespace") for this event.
   * @param {string} type
   *   A string, typically camelCased, describing the event taking place.
   * @param {object} details
   *   Optional details about this event, such as identifiers or parameters.
   *   These details will be mixed in with any default details specified
   *   by the Scope.
   */
  logic.event = function(scope, type, details) {
    scope = toScope(scope);

    // Give others a chance to intercept this event before we do lots of hard
    // JSON object work.
    var isDefaultPrevented = false;
    var preprocessEvent = {
      scope: scope,
      namespace: scope.namespace,
      type: type,
      details: details,
      preventDefault: function() {
        isDefaultPrevented = true;
      }
    };
    logic.emit('preprocessEvent', preprocessEvent);

    if (isDefaultPrevented) {
      return { id: 0 }; // async/await require a return object regardless.
    }

    type = preprocessEvent.type;
    details = preprocessEvent.details;

    if (typeof type !== 'string') {
      throw new Error('Invalid "type" passed to logic.event(); ' +
                      'expected a string, got "' + type + '"');
    }

    if (scope.defaultDetails) {
      if(isPlainObject(details)) {
        details = into(shallowClone(scope.defaultDetails),
                       shallowClone(details));
      } else {
        details = shallowClone(scope.defaultDetails);
      }
    } else {
      details = shallowClone(details);
    }

    var event = new LogicEvent(scope, type, details);
    logic.emit('censorEvent', event);
    logic.emit('event', event);

    if (logic.realtimeLogEverything) {
      dump('logic: ' + event.toString() + '\n');
    }

    return event;
  };


  // True when being run within a test.
  logic.underTest = false;
  logic._currentTestRejectFunction = null;

  /**
   * Immediately fail the current test with the given exception. If no test is
   * in progress, an error is logged, but no exception is thrown. In other
   * words, logic.fail() will NOT throw on you.
   *
   * @param {object} ex
   *   Exception object, as with Promise.reject()
   */
  logic.fail = function(ex) {
    if (logic.underTest) {
      if (logic._currentTestRejectFunction) {
        logic._currentTestRejectFunction(ex);
      } else {
        throw ex;
      }
    } else {
      console.error('Logic fail:', ex);
    }
  };


  var nextId = 1;

  /**
   * Return a sequential unique identifier, unique for users of this module
   * instance.
   */
  logic.uniqueId = function() {
    return nextId++;
  };

  // Hacky way to pass around a global config:
  logic.isCensored = false;
  logic.realtimeLogEverything = false;

  var interceptions = {};

  /**
   * Provide a named hook which can be intercepted by tests.
   */
  logic.interceptable = function(type, fn) {
    if (interceptions[type]) {
      return interceptions[type]();
    } else {
      return fn();
    }
  };

  /**
   * Intercept a named logic.interceptable by calling your function instead.
   */
  logic.interceptOnce = function(type, replacementFn) {
    var prevFn = interceptions[type];
    interceptions[type] = function() {
      interceptions[type] = prevFn;
      return replacementFn();
    };
  }

  /**
   * Return a Promise-like object that is fulfilled when an event
   * matching the given details is logged. Chainable.
   *
   * detailPredicate is optional and can be any of the following:
   *
   *   an object:
   *     Checks to see if the given object is a SUBSET of the event's details.
   *
   *   a function:
   *     The event matches if detailPredicate(event.details) returns true.
   *
   * @param {string} ns
   * @param {string} type
   * @param {object|function} detailPredicate
   */
  logic.match = function(ns, type, detailPredicate) {
    return new LogicMatcher(
      LogicMatcher.normalizeMatchArgs(ns, type, detailPredicate));
  }


  function MismatchError(matcher, event) {
    this.matcher = matcher;
    this.event = event;
  }

  MismatchError.prototype = Object.create(Error.prototype, {
    constructor: { value: MismatchError },
    toString: { value: function() {
      if (this.matcher.not) {
        return 'MismatchError: expected ' + this.event +
          ' to not occur (failIfMatched ' + this.matcher + ').';
      } else {
        return 'MismatchError: expected ' + this.event +
          ' to match ' + JSON.stringify(this.matcher.detailPredicate) + '.';
      }
    }}
  });


  /**
   * This is the object returned from `logic.match`. It acts as a Promise that
   * resolves when a matching event has been logged.
   */
  function LogicMatcher(opts) {
    this.matchedLogs = opts.prevMatcher ? opts.prevMatcher.matchedLogs : [];
    this.capturedLogs = [];
    this.ns = opts.ns;
    this.type = opts.type;
    this.detailPredicate = opts.detailPredicate;
    this.failOnMismatchedDetails = true;
    this.not = opts.not;
    this.timeoutMS = 2000;
    this.resolved = false;
    this.anotherMatcherNeedsMyLogs = false;

    if (opts.prevMatcher) {
      // Tell the previous matcher to not remove its event listener until we've
      // had a chance to pull out any logs which occured between its resolution
      // and our start.
      opts.prevMatcher.anotherMatcherNeedsMyLogs = true;
    }

    logic.defineScope(this, 'LogicMatcher');

    var hasPrevPromise = !!opts.prevPromise;
    var normalizedPrevPromise = opts.prevPromise || Promise.resolve();

    if (this.not) {
      // XXX this should probably bind instantly like the next case.
      this.promise = normalizedPrevPromise.then(() => {
        this.capturedLogs.some((event) => {
          if ((!this.ns || event.namespace === this.ns) &&
              event.matches(this.type, this.detailPredicate)) {
            throw new MismatchError(this, event);
          }
        });
      });
    } else if (this.type) {
      this.promise = new Promise((resolve, reject) => {
        // Once any previous match has been resolved,
        // subscribe to a following match.
        var subscribeToNextMatch = () => {
          var timeoutId = setTimeout(() => {
            logic(this, 'failedMatch',
                  {
                    ns: this.ns,
                    type: this.type,
                    detailPredicate: this.detailPredicate,
                    capturedLogs: this.capturedLogs
                  });
            reject(new Error('LogicMatcherTimeout: ' + this));
          }, this.timeoutMS);

          // Promise chains have "dead spots" in between resolution
          // callbacks. For instance:
          //                 [promise1.then]      [promise2.then]
          //    other events could be logged --^
          //
          // We could miss those events in the middle by just setting
          // up a new listener for each LogicMatcher. Instead, since
          // every matcher has a pointer to its prevMatcher, we can
          // just grab the missing logs from there.
          var resolveThisMatcher = (event) => {
            this.resolved = true;
            this.capturedLogs = []; // Extra events will go here.
            if (!this.anotherMatcherNeedsMyLogs) {
              this.removeMatchListener();
            }
          };

          var matchFn = (event) => {
            this.capturedLogs.push(event);
            if (this.resolved) {
              return;
            }

            if (this.ns && event.namespace !== this.ns ||
                event.type !== this.type) {
              return false; // did not match
            }
            if (event.matches(this.type, this.detailPredicate)) {
              resolveThisMatcher(event);
              this.matchedLogs.push(event);
              clearTimeout(timeoutId);
              logic(this, 'match', { ns: this.ns,
                                     type: this.type,
                                     event: event });
              resolve(event);
              return true;
            } else {
              if (this.failOnMismatchedDetails) {
                resolveThisMatcher(event);
                reject(new MismatchError(this, event));
                return true; // matched
              } else {
                // Ignore mismatched events; maybe we'll match later.
              }
            }
            return false; // not done yet, didn't find a match
          };

          this.removeMatchListener = () => {
            logic.removeListener('event', matchFn);
          };

          logic.on('event', matchFn);

          if (opts.prevMatcher) {
            var prevLogs = opts.prevMatcher.capturedLogs;
            // Run matchFn on prevLogs until one of them matches.
            var matchIndex = prevLogs.findIndex(matchFn);
            // Then, we get to start by capturing all logs that have occured in
            // the intervening time:
            if (matchIndex !== -1) {
              this.capturedLogs = prevLogs.slice(matchIndex + 1);
            }
            // Now that we're done with the previous matcher, it doesn't need to
            // listen to events any more.
            opts.prevMatcher.removeMatchListener();
          }
        }

        if (hasPrevPromise) {
          normalizedPrevPromise.then(subscribeToNextMatch, (e) => reject(e) );
        } else {
          try {
            subscribeToNextMatch();
          } catch(e) {
            reject(e);
          }
        }
      });
    } else {
      // This is the '.then()' case; we still want to return a
      // LogicMatcher so they can chain, but without any further expectations.
      this.promise = normalizedPrevPromise;
    }
  }

  LogicMatcher.normalizeMatchArgs = function(ns, type, details) {
    // 'ns' is optional
    if (typeof type === 'object') {
      details = type;
      type = ns;
      ns = null;
    }
    return { ns: ns, type: type, detailPredicate: details };
  }

  LogicMatcher.prototype = {

    /**
     * Same as `logic.match`.
     */
    match(ns, type, details) {
      var args = LogicMatcher.normalizeMatchArgs(ns, type, details);
      args.prevMatcher = this;
      args.prevPromise = this.promise;
      return new LogicMatcher(args);
    },

    /**
     * Look at THE LOGS ALREADY CAPTURED by this LogicMatcher, and fail if any
     * of them match this one.
     */
    failIfMatched(ns, type, details) {
      var args = LogicMatcher.normalizeMatchArgs(ns, type, details);
      args.not = true;
      args.prevMatcher = this;
      args.prevPromise = this.promise;
      return new LogicMatcher(args);
    },

    /**
     * Like Promise.then(); resolves with an array of matched logs.
     */
    then(fn, catchFn) {
      return new LogicMatcher({
        prevPromise: this.promise.then(() => {
          var ret = fn(this.matchedLogs.slice());
          if (ret instanceof Promise) {
            ret = new LogicMatcher({
              prevPromise: ret
            });
          }
          return ret;
        }, catchFn)
      });
    },

    toString() {
      return '<LogicMatcher ' + (this.ns ? this.ns + '/' : '') +
        this.type + ' ' + new ObjectSimplifier().simplify(this.detailPredicate)
        + '>';
    }
  }

  function Scope(namespace, defaultDetails) {
    this.namespace = namespace;

    if (defaultDetails && !isPlainObject(defaultDetails)) {
      throw new Error('Invalid defaultDetails; expected a plain-old object: ' +
                      defaultDetails);
    }
    this.defaultDetails = defaultDetails;
  }

  function ObjectSimplifier(opts) {
    opts = opts || {};
    this.maxDepth = opts.maxDepth || 10;
    this.maxStringLength = opts.maxStringLength || 1000;
    this.maxArrayLength = opts.maxArrayLength || 1000;
    this.maxObjectLength = opts.maxObjectLength || 10;
  }

  ObjectSimplifier.prototype = {
    simplify: function(x) {
      return this._simplify(x, 0, new WeakSet());
    },

    _simplify: function(x, depth, cacheSet) {
      if (cacheSet.has(x)) {
        return '(cycle)';
      }
      if (typeof x === 'number') {
        return x;
      } else if (typeof x === 'string') {
        return x.slice(0, this.maxStringLength);
      } else if (x && x.BYTES_PER_ELEMENT) {
        // TypedArray
        return x.slice(0, this.maxArrayLength);
      } else if (Array.isArray(x)) {
        if (depth < this.maxDepth) {
          return x.slice(0, this.maxArrayLength)
            .map((element) => this._simplify(element, depth + 1, cacheSet));
        } else {
          return '[Array length=' + x.length + ']';
        }
      } else if (x && typeof x === 'object') {
        cacheSet.add(x);
        if (!isPlainObject(x)) {
          if (x.toJSON) {
            return this._simplify(x.toJSON(), depth, cacheSet);
          } else if (x.toString) {
            return this._simplify(x.toString(), depth, cacheSet);
          } else {
            return '(?)';
          }
        } else {
          if (depth < this.maxDepth) {
            var retObj = {};
            var idx = 0;
            for (var key in x) {
              if (idx > this.maxObjectLength) {
                break;
              }
              retObj[key] = this._simplify(x[key], depth + 1, cacheSet);
              idx++;
            }
            return retObj;
          } else if (x.toString) {
            return this._simplify(x.toString(), depth, cacheSet);
          } else {
            return '(object?)';
          }
        }
      } else if (typeof x === 'function') {
        return '(function)';
      } else {
        return x;
      }
    }
  }

  function LogicEvent(scope, type, details) {
    if (!(scope instanceof Scope)) {
      throw new Error('Invalid "scope" passed to LogicEvent(); ' +
                      'did you remember to call logic.defineScope()?');
    }

    this.scope = scope;
    this.type = type;
    this.details = details;
    this.time = Date.now();
    this.id = logic.uniqueId();
    this.jsonRepresentation = {
      namespace: this.scope.namespace,
      type: this.type,
      details: new ObjectSimplifier().simplify(this.details),
      time: this.time,
      id: this.id
    };
  }

  LogicEvent.fromJSON = function(data) {
    var event = new LogicEvent(new Scope(data.namespace),
                               data.type,
                               data.details);
    event.time = data.time;
    event.id = data.id;
    return event;
  }

  LogicEvent.prototype = {
    get namespace() {
      return this.scope.namespace;
    },

    toJSON: function() {
      return this.jsonRepresentation;
    },

    toString: function() {
      return '<LogicEvent ' + this.namespace + '/' + this.type + ' ' +
        JSON.stringify(this.jsonRepresentation.details) + '>';
    },

    /**
     * Return true if this event matches the given predicate, using the same
     * rules as `logic.match()`.
     *
     * @param {string} type
     * @param {object|function|null} detailPredicate
     */
    matches: function(type, detailPredicate) {
      if (this.type !== type) {
        return false;
      }

      if (typeof detailPredicate === 'function') {
        return !!detailPredicate(this.details);
      } else if (isPlainObject(detailPredicate)) {
        for (var key in detailPredicate) {
          var expected = detailPredicate && detailPredicate[key];
          var actual = this.details && this.details[key];
          if (actual === undefined) {
            actual = null; // For actual comparison, undefined equates to null.
          }

          if (expected === undefined) {
            continue; // We don't care about these.
          } else if (!this.details ||
                     !equal(expected, actual)) {
            return false;
          }
        }
        return true;
      } else if (detailPredicate != null) {
        return equal(this.details, detailPredicate);
      } else {
        return true;
      }
    }
  };

  function isPlainObject(obj) {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    // Object.create(null) has no .toString().
    if (obj.toString && (obj.toString() !== '[object Object]')) {
      return false;
    }
    for (var k in obj) {
      if (typeof k === 'function') {
        return false;
      }
    }
    return true;
  }

  logic.isPlainObject = isPlainObject;

  //----------------------------------------------------------------
  // Promises

  var promiseToStartEventMap = new WeakMap();
  var promiseToResultEventMap = new WeakMap();

  /**
   * For those cases when your logic starts in one place but ends in
   * another, logic.async is slightly inconvenient. This function
   * tracks an async event much like `logic.async`, except that this
   * helper pulls out 'resolve' and 'reject' to allow you to log
   * completion elsewhere.
   *
   * @return An object with 'resolve' and 'reject' properties.
   */
  logic.startAsync = function(scope, type, details) {
    var resolve, reject;
    var promise = logic.async(scope, type, details, (_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });
    return {
      resolve: resolve,
      reject: reject
    };
  }

  /**
   * A tracked version of `new Promise()`, where `fn` here is your promise
   * executor function. As with `logic.event()`, details is optional, but type
   * is required. Events will be logged to track the promise's resolution.
   */
  logic.async = function(scope, type, details, fn) {
    if (!fn && typeof details === 'function') {
      fn = details;
      details = null;
    }

    scope = logic.subscope(scope, details);

    var startEvent;
    var promise = new Promise((resolve, reject) => {
      startEvent = logic(scope, 'begin ' + type, {
        asyncStatus: 0, // 'pending', as per Promise's private 'status' property.
        asyncName: type
      });

      fn((result) => {
        promiseToResultEventMap.set(promise, logic(scope, type, {
          asyncStatus: 1, // 'resolved'
          sourceEventIds: [startEvent.id],
          result: result
        }));
        resolve(result);
      }, (error) => {
        promiseToResultEventMap.set(promise, logic(scope, type, {
          asyncStatus: 2, // 'rejected'
          sourceEventIds: [startEvent.id],
          error: error
        }));
        reject(error);
      });
    });

    promiseToStartEventMap.set(promise, startEvent);
    return promise;
  };

  /**
   * Wraps a Promise, logging events that say "I'm waiting for this Promise" and
   * "I finally got this Promise's result". If the originating promise was
   * created with `logic.async`, we can link the two semantically.
   */
  logic.await = function(scope, type, details, promise) {
    if (!promise && details.then) {
      promise = details;
      details = null;
    }

    scope = logic.subscope(scope, details).subscope(scope);

    var startEvent = promiseToStartEventMap.get(promise);
    var awaitEvent = logic.event(scope, 'await ' + type, {
      awaitStatus: 0, // 'pending', as per Promise's private 'status' property.
      sourceEventIds: startEvent ? [startEvent.id] : null,
      awaitName: type
    });

    return promise.then((result) => {
      var resultEvent = promiseToResultEventMap.get(promise);
      logic(scope, type, {
        awaitStatus: 1, // 'resolved'
        result: result,
        sourceEventIds: (resultEvent
                         ? [resultEvent.id, awaitEvent.id]
                         : [awaitEvent.id])
      });
      return result;
    }, (error) => {
      var resultEvent = promiseToResultEventMap.get(promise);
      logic(scope, type, {
        awaitStatus: 2, // 'rejected'
        error: error,
        sourceEventIds: (resultEvent
                         ? [resultEvent.id, awaitEvent.id]
                         : [awaitEvent.id])
      });
      throw error;
    });
  };

  function shallowClone(x) {
    if (isPlainObject(x)) {
      var ret = {};
      for (var key in x) {
        ret[key] = x[key];
      }
      return ret;
    } else {
      return x;
    }
  }

  /**
   * Merge `source` into `target`.
   */
  function into(target, source) {
    if (!target) {
      target = {};
    }
    for (var key in source) {
      target[key] = source[key];
    }
    return target;
  }


  return logic;
});

// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function(root, factory) {
    

    if (typeof define === 'function' && define.amd) {
        define('ext/ext/addressparser',factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.addressparser = factory();
    }
}(this, function() {
    

    /**
     * Defines an object as a namespace for the parsing function
     */
    var addressparser = {};

    /**
     * Parses structured e-mail addresses from an address field
     *
     * Example:
     *
     *    "Name <address@domain>"
     *
     * will be converted to
     *
     *     [{name: "Name", address: "address@domain"}]
     *
     * @param {String} str Address field
     * @return {Array} An array of address objects
     */
    addressparser.parse = function(str) {
        var tokenizer = new addressparser.Tokenizer(str),
            tokens = tokenizer.tokenize();

        var addresses = [],
            address = [],
            parsedAddresses = [];

        tokens.forEach(function(token) {
            if (token.type === "operator" && (token.value === "," || token.value === ";")) {
                if (address.length) {
                    addresses.push(address);
                }
                address = [];
            } else {
                address.push(token);
            }
        });

        if (address.length) {
            addresses.push(address);
        }

        addresses.forEach(function(address) {
            address = addressparser._handleAddress(address);
            if (address.length) {
                parsedAddresses = parsedAddresses.concat(address);
            }
        });

        return parsedAddresses;
    };

    /**
     * Converts tokens for a single address into an address object
     *
     * @param {Array} tokens Tokens object
     * @return {Object} Address object
     */
    addressparser._handleAddress = function(tokens) {
        var token,
            isGroup = false,
            state = "text",
            address,
            addresses = [],
            data = {
                address: [],
                comment: [],
                group: [],
                text: []
            },
            i, len;

        // Filter out <addresses>, (comments) and regular text
        for (i = 0, len = tokens.length; i < len; i++) {
            token = tokens[i];

            if (token.type === "operator") {
                switch (token.value) {
                    case "<":
                        state = "address";
                        break;
                    case "(":
                        state = "comment";
                        break;
                    case ":":
                        state = "group";
                        isGroup = true;
                        break;
                    default:
                        state = "text";
                }
            } else {
                if (token.value) {
                    data[state].push(token.value);
                }
            }
        }

        // If there is no text but a comment, replace the two
        if (!data.text.length && data.comment.length) {
            data.text = data.comment;
            data.comment = [];
        }

        if (isGroup) {
            // http://tools.ietf.org/html/rfc2822#appendix-A.1.3
            data.text = data.text.join(" ");
            addresses.push({
                name: data.text || (address && address.name),
                group: data.group.length ? addressparser.parse(data.group.join(",")) : []
            });
        } else {
            // If no address was found, try to detect one from regular text
            if (!data.address.length && data.text.length) {
                for (i = data.text.length - 1; i >= 0; i--) {
                    if (data.text[i].match(/^[^@\s]+@[^@\s]+$/)) {
                        data.address = data.text.splice(i, 1);
                        break;
                    }
                }

                var _regexHandler = function(address) {
                    if (!data.address.length) {
                        data.address = [address.trim()];
                        return " ";
                    } else {
                        return address;
                    }
                };

                // still no address
                if (!data.address.length) {
                    for (i = data.text.length - 1; i >= 0; i--) {
                        data.text[i] = data.text[i].replace(/\s*\b[^@\s]+@[^@\s]+\b\s*/, _regexHandler).trim();
                        if (data.address.length) {
                            break;
                        }
                    }
                }
            }

            // If there's still is no text but a comment exixts, replace the two
            if (!data.text.length && data.comment.length) {
                data.text = data.comment;
                data.comment = [];
            }

            // Keep only the first address occurence, push others to regular text
            if (data.address.length > 1) {
                data.text = data.text.concat(data.address.splice(1));
            }

            // Join values with spaces
            data.text = data.text.join(" ");
            data.address = data.address.join(" ");

            if (!data.address && isGroup) {
                return [];
            } else {
                address = {
                    address: data.address || data.text || "",
                    name: data.text || data.address || ""
                };

                if (address.address === address.name) {
                    // here still need to check address if match "address@domain" format
                    // if not match "address@domain" format, we should treat it as invalid address
                    if ((address.address || "").match(/^[^@\s]+@[^@\s]+$/)) {
                        address.name = "";
                    } else {
                        address.address = "";
                    }

                }

                addresses.push(address);
            }
        }

        return addresses;
    };

    /**
     * Creates a Tokenizer object for tokenizing address field strings
     *
     * @constructor
     * @param {String} str Address field string
     */
    addressparser.Tokenizer = function(str) {

        this.str = (str || "").toString();
        this.operatorCurrent = "";
        this.operatorExpecting = "";
        this.node = null;
        this.escaped = false;

        this.list = [];

    };

    /**
     * Operator tokens and which tokens are expected to end the sequence
     */
    addressparser.Tokenizer.prototype.operators = {
        "\"": "\"",
        "(": ")",
        "<": ">",
        ",": "",
        // Groups are ended by semicolons
        ":": ";",
        // Semicolons are not a legal delimiter per the RFC2822 grammar other
        // than for terminating a group, but they are also not valid for any
        // other use in this context.  Given that some mail clients have
        // historically allowed the semicolon as a delimiter equivalent to the
        // comma in their UI, it makes sense to treat them the same as a comma
        // when used outside of a group.
        ";": ""
    };

    /**
     * Tokenizes the original input string
     *
     * @return {Array} An array of operator|text tokens
     */
    addressparser.Tokenizer.prototype.tokenize = function() {
        var chr, list = [];
        for (var i = 0, len = this.str.length; i < len; i++) {
            chr = this.str.charAt(i);
            this.checkChar(chr);
        }

        this.list.forEach(function(node) {
            node.value = (node.value || "").toString().trim();
            if (node.value) {
                list.push(node);
            }
        });

        return list;
    };

    /**
     * Checks if a character is an operator or text and acts accordingly
     *
     * @param {String} chr Character from the address field
     */
    addressparser.Tokenizer.prototype.checkChar = function(chr) {
        if ((chr in this.operators || chr === "\\") && this.escaped) {
            this.escaped = false;
        } else if (this.operatorExpecting && chr === this.operatorExpecting) {
            this.node = {
                type: "operator",
                value: chr
            };
            this.list.push(this.node);
            this.node = null;
            this.operatorExpecting = "";
            this.escaped = false;
            return;
        } else if (!this.operatorExpecting && chr in this.operators) {
            this.node = {
                type: "operator",
                value: chr
            };
            this.list.push(this.node);
            this.node = null;
            this.operatorExpecting = this.operators[chr];
            this.escaped = false;
            return;
        }

        if (!this.escaped && chr === "\\") {
            this.escaped = true;
            return;
        }

        if (!this.node) {
            this.node = {
                type: "text",
                value: ""
            };
            this.list.push(this.node);
        }

        if (this.escaped && chr !== "\\") {
            this.node.value += "\\";
        }

        this.node.value += chr;
        this.escaped = false;
    };

    return addressparser;
}));

/**
 *
 **/

define(
  'ext/mailapi',[
    'exports',
    './logic',
    // Use a relative link so that consumers do not need to create
    // special config to use main-frame-setup.
    './ext/addressparser'
  ],
  function(
    exports,
    logic,
    addressparser
  ) {

function objCopy(obj) {
  var copy = {};
  Object.keys(obj).forEach(function (key) {
    copy[key] = obj[key];
  });
  return copy;
}

/**
 * Error reporting helper; we will probably eventually want different behaviours
 * under development, under unit test, when in use by QA, advanced users, and
 * normal users, respectively.  By funneling all errors through one spot, we
 * help reduce inadvertent breakage later on.
 */
function reportError() {
  var msg = null;
  for (var i = 0; i < arguments.length; i++) {
    if (msg)
      msg += " " + arguments[i];
    else
      msg = "" + arguments[i];
  }
  // When in tests, this will fail the test; when not in tests, we just log.
  logic.fail(new Error(msg));
}
var unexpectedBridgeDataError = reportError,
    internalError = reportError,
    reportClientCodeError = reportError;

/**
 * The number of header wire messages to cache in the recvCache
 */
var HEADER_CACHE_LIMIT = 8;

/**
 *
 */
function MailAccount(api, wireRep, acctsSlice) {
  this._api = api;
  this.id = wireRep.id;

  // Hold on to wireRep for caching
  this._wireRep = wireRep;

  // Hold on to acctsSlice for use in determining default account.
  this.acctsSlice = acctsSlice;

  this.type = wireRep.type;
  this.name = wireRep.name;
  this.authenticatorId = wireRep.authenticatorId;
  this.label = wireRep.label ? wireRep.label : wireRep.name.split('@')[1].split('.')[0];
  this.syncRange = wireRep.syncRange;
  this.syncInterval = wireRep.syncInterval;
  this.notifyOnNew = wireRep.notifyOnNew;
  this.playSoundOnSend = wireRep.playSoundOnSend;
  this.syncEnable = wireRep.syncEnable;
  this.public = wireRep.public;

  /**
   * Is the account currently enabled, as in will we talk to the server?
   * Accounts will be automatically disabled in cases where it would be
   * counter-productive for us to keep trying to access the server.
   *
   * For example: the user's password being (apparently) bad, or gmail getting
   * upset about the amount of data transfer and locking the account out for the
   * rest of the day.
   */
  this.enabled = wireRep.enabled;
  /**
   * @listof[@oneof[
   *   @case['bad-user-or-pass']
   *   @case['bad-address']
   *   @case['needs-oauth-reauth']
   *   @case['imap-disabled']
   *   @case['pop-server-not-great']{
   *     The POP3 server doesn't support IDLE and TOP, so we can't use it.
   *   }
   *   @case['connection']{
   *     Generic connection problem; this problem can quite possibly be present
   *     in conjunction with more specific problems such as a bad username /
   *     password.
   *   }
   * ]]{
   *   A list of known problems with the account which explain why the account
   *   might not be `enabled`.  Once a problem is believed to have been
   *   addressed, `clearProblems` should be called.
   * }
   */
  this.problems = wireRep.problems;

  this.identities = [];
  for (var iIdent = 0; iIdent < wireRep.identities.length; iIdent++) {
    this.identities.push(new MailSenderIdentity(this._api,
                                                wireRep.identities[iIdent]));
  }

  this.username = wireRep.credentials.username;
  this.password = wireRep.credentials.password;
  this.servers = wireRep.servers;

  this.authMechanism = wireRep.credentials.oauth2 ? 'oauth2' : 'password';

  // build a place for the DOM element and arbitrary data into our shape
  this.element = null;
  this.data = null;
}
MailAccount.prototype = {
  toString: function() {
    return '[MailAccount: ' + this.type + ' ' + this.id + ']';
  },
  toJSON: function() {
    return {
      type: 'MailAccount',
      accountType: this.type,
      id: this.id,
    };
  },

  __update: function(wireRep) {
    this.enabled = wireRep.enabled;
    this.problems = wireRep.problems;
    this.syncRange = wireRep.syncRange;
    this.syncInterval = wireRep.syncInterval;
    this.notifyOnNew = wireRep.notifyOnNew;
    this.playSoundOnSend = wireRep.playSoundOnSend;
    this.label = wireRep.label;
    this._wireRep.defaultPriority = wireRep.defaultPriority;
    this.syncEnable = wireRep.syncEnable;
    this.public = wireRep.public;

    for (var i = 0; i < wireRep.identities.length; i++) {
      if (this.identities[i]) {
        this.identities[i].__update(wireRep.identities[i]);
      } else {
        this.identities.push(new MailSenderIdentity(this._api,
                                        wireRep.identities[i]));
      }
    }
  },

  __die: function() {
    // currently, nothing to clean up
  },

  /**
   * Tell the back-end to clear the list of problems with the account, re-enable
   * it, and try and connect.
   */
  clearProblems: function(forceIgnore, callback) {
    this._api._clearAccountProblems(this, forceIgnore, callback);
  },

  /**
   * @args[
   *   @param[mods @dict[
   *     @key[password String]
   *     @key[incomingPassword String]
   *     @key[outgoingPassword String]
   *     @key[username String]
   *     @key[incomingUsername String]
   *     @key[outgoingUsername String]
   *   ]]
   *   @param[callback function]
   * ]{
   *   Modify properties on the account.
   *
   *   In addition to regular account property settings,
   *   "setAsDefault": true can be passed to set this account as the
   *   default acccount.
   *
   *   # Username and Password Setting
   *
   *   If you want to modify the username or password of an account,
   *   keep in mind that IMAP/POP3 accounts might have two separate
   *   passwords, one for incoming mail and one for SMTP. You have a
   *   couple options:
   *
   *   - If you specify "username" and/or "password", we'll change the
   *     incoming side, and if the SMTP side had the same
   *     username/password, we'll change that too.
   *
   *   - If you specify incomingUsername, incomingPassword, etc., we
   *     will NOT do that magic inferring; we'll just change the side
   *     you specify.
   *
   *   Practically speaking, most accounts will likely share the same
   *   username and password. Additionally, if we guess that the
   *   passwords/usernames should match when they actually should
   *   differ, we'll safely recover becuase we'll then ask for a
   *   corrected SMTP password.
   * }
   */
  modifyAccount: function(mods, callback) {
    this._api._modifyAccount(this, mods, callback);
  },

  /**
   * Delete the account and all its associated data.  No privacy guarantees are
   * provided; we just delete the data from the database, so it's up to the
   * (IndexedDB) database's guarantees on that.
   */
  deleteAccount: function() {
    this._api._deleteAccount(this);
  },

  /**
   * Returns true if this account is the default account, by looking at
   * all accounts in the acctsSlice.
   */
  get isDefault() {
    if (!this.acctsSlice)
      throw new Error('No account slice available');

    return this.acctsSlice.defaultAccount === this;
  },
};

/**
 * Sender identities define one of many possible sets of sender info and are
 * associated with a single `MailAccount`.
 *
 * Things that can vary:
 * - user's display name
 * - e-mail address,
 * - reply-to address
 * - signature
 */
function MailSenderIdentity(api, wireRep) {
  // We store the API so that we can create identities for the composer without
  // needing to create an account too.
  this._api = api;
  this.id = wireRep.id;

  this.name = wireRep.name;
  this.address = wireRep.address;
  this.replyTo = wireRep.replyTo;
  this.signature = wireRep.signature;
  this.signatureEnabled = wireRep.signatureEnabled;

}
MailSenderIdentity.prototype = {
  toString: function() {
    return '[MailSenderIdentity: ' + this.type + ' ' + this.id + ']';
  },
  toJSON: function() {
    return { type: 'MailSenderIdentity' };
  },

  __update: function(wireRep) {
    this.id = wireRep.id;
    this.name = wireRep.name;
    this.address = wireRep.address;
    this.replyTo = wireRep.replyTo;
    this.signature = wireRep.signature;
    this.signatureEnabled = wireRep.signatureEnabled;
  },
  /**
   * Modifies the identity. Applies all of the changes in mods
   * and leaves all other values the same.
   *
   * @param  {Object}   mods     The changes to be applied
   * @param  {Function} callback
   */
  modifyIdentity: function(mods, callback) {
    // These update signature data immediately, so that the UI
    // reflects the changes properly before the backend properly
    // updates the data
    if (typeof mods.signature !== 'undefined') {
      this.signature = mods.signature;
    }
    if (typeof mods.signatureEnabled !== 'undefined') {
      this.signatureEnabled = mods.signatureEnabled;
    }
    this._api._modifyIdentity(this, mods, callback);
  },

  __die: function() {
    // nothing to clean up currently
  },
};
// For testing
exports._MailFolder = MailFolder;

function MailFolder(api, wireRep) {
  this._api = api;

  this.__update(wireRep);

  this.onchange = null;
  this.onremove = null;

  // build a place for the DOM element and arbitrary data into our shape
  this.element = null;
  this.data = null;
}
MailFolder.prototype = {
  toString: function() {
    return '[MailFolder: ' + this.path + ']';
  },
  toJSON: function() {
    return {
      type: this.type,
      path: this.path
    };
  },
  /**
   * Loads the current unread message count as reported by the FolderStorage backend.
   * this.unread is the current number of unread messages that are stored within the
   * FolderStorage object for this folder. Thus, it only accounts for messages
   * which the user has loaded from the server.
  */
  __update: function(wireRep) {
    // Hold on to wireRep for caching
    this._wireRep = wireRep;

    this.unread = wireRep.unreadCount;

    this.lastSyncedAt = wireRep.lastSyncedAt ? new Date(wireRep.lastSyncedAt)
                                             : null;
    this.path = wireRep.path;
    this.id = wireRep.id;

    /**
     * The human-readable name of the folder.  (As opposed to its path or the
     * modified utf-7 encoded folder names.)
     */
    this.name = wireRep.name;
    /**
     * The full string of the path.
     */
    this.path = wireRep.path;
    /**
     * The hierarchical depth of this folder.
     */
    this.depth = wireRep.depth;
    /**
     * @oneof[
     *   @case['account']{
     *     It's not really a folder at all, just an account serving as hierarchy
     *   }
     *   @case['nomail']{
     *     A folder that exists only to provide hierarchy but which can't
     *     contain messages.  An artifact of various mail backends that are
     *     reflected in IMAP as NOSELECT.
     *   }
     *   @case['inbox']
     *   @case['drafts']
     *   @case['localdrafts']{
     *     Local-only folder that stores drafts composed on this device.
     *   }
     *   @case['sent']
     *   @case['trash']
     *   @case['archive']
     *   @case['junk']
     *   @case['starred']
     *   @case['important']
     *   @case['normal']{
     *     A traditional mail folder with nothing special about it.
     *   }
     * ]{
     *   Non-localized string indicating the type of folder this is, primarily
     *   for styling purposes.
     * }
     */
    this.type = wireRep.type;

    // Exchange folder name with the localized version if available
    this.name = this._api.l10n_folder_name(this.name, this.type);

    this.selectable = ((wireRep.type !== 'account') &&
                       (wireRep.type !== 'nomail'));

    this.neededForHierarchy = !this.selectable;

    /**
     *  isValidMoveTarget denotes whether this folder is a valid
     *  place for messages to be moved into.
     */
    switch (this.type) {
      case 'localdrafts':
      case 'outbox':
      case 'account':
      case 'nomail':
        this.isValidMoveTarget = false;
        break;
      default:
        this.isValidMoveTarget = true;
    }
  },

  __die: function() {
    // currently nothing to clean up
  }
};

function filterOutBuiltinFlags(flags) {
  // so, we could mutate in-place if we were sure the wire rep actually came
  // over the wire.  Right now there is de facto rep sharing, so let's not
  // mutate and screw ourselves over.
  var outFlags = [];
  for (var i = flags.length - 1; i >= 0; i--) {
    if (flags[i][0] !== '\\')
      outFlags.push(flags[i]);
  }
  return outFlags;
}

/**
 * Extract the canonical naming attributes out of the MailHeader instance.
 */
function serializeMessageName(x) {
  return {
    date: x.date.valueOf(),
    suid: x.id,
    // NB: strictly speaking, this is redundant information.  However, it is
    // also fairly handy to pass around for IMAP since otherwise we might need
    // to perform header lookups later on.  It will likely also be useful for
    // debugging.  But ideally we would not include this.
    guid: x.guid
  };
}

/**
 * Caches contact lookups, both hits and misses, as well as updating the
 * MailPeep instances returned by resolve calls.
 *
 * We maintain strong maps from both contact id and e-mail address to MailPeep
 * instances.  We hold a strong reference because BridgedViewSlices already
 * require explicit lifecycle maintenance (aka call die() when done with them).
 * We need the contact id and e-mail address because when a contact is changed,
 * an e-mail address may be changed, and we don't get to see the old
 * representation.  So if the e-mail address was deleted, we need the contact id
 * mapping.  And if the e-mail address was added, we need the e-mail address
 * mapping.
 *
 * If the mozContacts API is not available, we just create inert MailPeep
 * instances that do not get tracked or updated.
 *
 * Domain notes:
 *
 * The contacts API does not enforce any constraints on the number of contacts
 * who can use an e-mail address, but the e-mail app only allows one contact
 * to correspond to an e-mail address at a time.
 */
var ContactCache = exports.ContactCache = {
  /**
   * Maps e-mail addresses to the mozContact rep for the object, or null if
   * there was a miss.
   *
   * We explicitly do not want to choose an arbitrary MailPeep instance to
   * (re)use because it could lead to GC memory leaks if data/element/an expando
   * were set on the MailPeep and we did not zero it out when the owning slice
   * was destroyed.  We could, however, use the live set of peeps as a fallback
   * if we don't have a contact cached.
   */
  _contactCache: Object.create(null),
  /** The number of entries in the cache. */
  _cacheHitEntries: 0,
  /** The number of stored misses in the cache. */
  _cacheEmptyEntries: 0,

  /**
   * Maximum number of hit entries in the cache before we should clear the
   * cache.
   */
  MAX_CACHE_HITS: 256,
  /** Maximum number of empty entries to store in the cache before clearing. */
  MAX_CACHE_EMPTY: 1024,

  /** Maps contact id to lists of MailPeep instances. */
  _livePeepsById: Object.create(null),
  /** Maps e-mail addresses to lists of MailPeep instances */
  _livePeepsByEmail: Object.create(null),

  pendingLookupCount: 0,

  callbacks: [],

  init: function() {
    var contactsAPI = navigator.mozContacts;
    if (!contactsAPI)
      return;

    contactsAPI.oncontactchange = this._onContactChange.bind(this);
  },

  _resetCache: function() {
    this._contactCache = Object.create(null);
    this._cacheHitEntries = 0;
    this._cacheEmptyEntries = 0;
  },

  shutdown: function() {
    var contactsAPI = navigator.mozContacts;
    if (!contactsAPI)
      return;
    contactsAPI.oncontactchange = null;
  },

  /**
   * Currently we process the updates in real-time as we get them.  There's an
   * inherent trade-off between chewing CPU when we're in the background and
   * minimizing latency when we are displayed.  We're biased towards minimizing
   * latency right now.
   *
   * All contact changes flush our contact cache rather than try and be fancy.
   * We are already fancy with the set of live peeps and our lookups could just
   * leverage that.  (The contact cache is just intended as a steady-state
   * high-throughput thing like when displaying messages in the UI.  We don't
   * expect a lot of contact changes to happen during that time.)
   *
   * For info on the events/triggers, see:
   * https://developer.mozilla.org/en-US/docs/DOM/ContactManager.oncontactchange
   */
  _onContactChange: function(event) {
    var contactsAPI = navigator.mozContacts;
    var livePeepsById = this._livePeepsById,
        livePeepsByEmail = this._livePeepsByEmail;

    // clear the cache if it has anything in it (per the above doc block)
    if (this._cacheHitEntries || this._cacheEmptyEntries)
      this._resetCache();

    // -- Contact removed OR all contacts removed!
    if (event.reason === 'remove') {
      function cleanOutPeeps(livePeeps) {
        for (var iPeep = 0; iPeep < livePeeps.length; iPeep++) {
          var peep = livePeeps[iPeep];
          peep.contactId = null;
          peep.contactName = peep.address;
          if (peep.onchange) {
            try {
              peep.onchange(peep);
            }
            catch (ex) {
              reportClientCodeError('peep.onchange error', ex, '\n',
                                    ex.stack);
            }
          }
        }
      }

      // - all contacts removed! (clear() called)
      var livePeeps;
      if (!event.contactID) {
        for (var contactId in livePeepsById) {
          livePeeps = livePeepsById[contactId];
          cleanOutPeeps(livePeeps);
          this._livePeepsById = Object.create(null);
        }
      }
      // - just one contact removed
      else {
        livePeeps = livePeepsById[event.contactID];
        if (livePeeps) {
          cleanOutPeeps(livePeeps);
          delete livePeepsById[event.contactID];
        }
      }
    }
    // -- Created or updated; we need to fetch the contact to investigate
    else {
      var req = contactsAPI.find({
        filterBy: ['id'],
        filterOp: 'equals',
        filterValue: event.contactID
      });
      req.onsuccess = function() {
        // If the contact disappeared we will hear a 'remove' event and so don't
        // need to process this.
        if (!req.result.length)
          return;
        var contact = req.result[0], livePeeps, iPeep, peep;

        // - process update with apparent e-mail address removal
        if (event.reason === 'update') {
          livePeeps = livePeepsById[contact.id];
          if (livePeeps) {
            var contactEmails = contact.email ?
                  contact.email.map(function(e) { return e.value; }) :
                [];
            for (iPeep = 0; iPeep < livePeeps.length; iPeep++) {
              peep = livePeeps[iPeep];
              if (contactEmails.indexOf(peep.address) === -1) {
                // Need to fix-up iPeep because of the splice; reverse iteration
                // reorders our notifications and we don't want that, hence
                // this.
                livePeeps.splice(iPeep--, 1);
                peep.contactId = null;
                peep.contactName = '';
                if (peep.onchange) {
                  try {
                    peep.onchange(peep);
                    window.dispatchEvent(new CustomEvent('contact-updated',{
                      detail: {peep: peep, photo: contact.photo ? contact.photo[0] : contact.photo},
                      bubbles: true,
                      cancelable: false
                    }));
                  }
                  catch (ex) {
                    reportClientCodeError('peep.onchange error', ex, '\n',
                                          ex.stack);
                  }
                }
              }
            }
            if (livePeeps.length === 0)
              delete livePeepsById[contact.id];
          }
        }
        // - process create/update causing new coverage
        if (!contact.email)
          return;
        for (var iEmail = 0; iEmail < contact.email.length; iEmail++) {
          var email = contact.email[iEmail].value;
          livePeeps = livePeepsByEmail[email];
          // nothing to do if there are no peeps that use that email address
          if (!livePeeps)
            continue;

          for (iPeep = 0; iPeep < livePeeps.length; iPeep++) {
            peep = livePeeps[iPeep];
            // If the peep is not yet associated with this contact or any other
            // contact, then associate it.
            if (!peep.contactId) {
              peep.contactId = contact.id;
              var idLivePeeps = livePeepsById[peep.contactId];
              if (idLivePeeps === undefined)
                idLivePeeps = livePeepsById[peep.contactId] = [];
              idLivePeeps.push(peep);
            }
            // However, if it's associated with a different contact, then just
            // skip the peep.
            else if (peep.contactId !== contact.id) {
              continue;
            }
            // (The peep must be associated with this contact, so update and
            // fire)

            //update photo
            peep._thumbnailBlob =
              (contact.photo && contact.photo.length) ? contact.photo[0] : null;

            if (contact.name && contact.name.length)
              peep.contactName = contact.name[0];
            if (peep.onchange) {
              try {
                peep.onchange(peep);
                window.dispatchEvent(new CustomEvent('contact-updated',{
                  detail: {peep: peep, photo: contact.photo ? contact.photo[0] : contact.photo},
                  bubbles: true,
                  cancelable: false
                }));
              }
              catch (ex) {
                reportClientCodeError('peep.onchange error', ex, '\n',
                                      ex.stack);
              }
            }
          }
        }
      };
      // We don't need to do anything about onerror; the 'remove' event will
      // probably have fired in this case, making us correct.
    }
  },

  resolvePeeps: function(addressPairs) {
    if (addressPairs == null)
      return null;
    var resolved = [];
    for (var i = 0; i < addressPairs.length; i++) {
      resolved.push(this.resolvePeep(addressPairs[i]));
    }
    return resolved;
  },
  /**
   * Create a MailPeep instance with the best information available and return
   * it.  Information from the (moz)Contacts API always trumps the passed-in
   * information.  If we have a cache hit (which covers both positive and
   * negative evidence), we are done/all resolved immediately.  Otherwise, we
   * need to issue an async request.  In that case, you want to check
   * ContactCache.pendingLookupCount and push yourself onto
   * ContactCache.callbacks if you want to be notified when the current set of
   * lookups gets resolved.
   *
   * This is a slightly odd API, but it's based on the knowledge that for a
   * single e-mail we will potentially need to perform multiple lookups and that
   * e-mail addresses are also likely to come in batches so there's no need to
   * generate N callbacks when 1 will do.
   */
  resolvePeep: function(addressPair) {
    if (!addressPair) {
      console.error("NO ADDRESS PAIR?", new Error().stack);
      return;
    }
    var emailAddress = addressPair.address;
    var entry = this._contactCache[emailAddress], contact, peep;
    var contactsAPI = navigator.mozContacts;
    // known miss; create miss peep
    // no contacts API, always a miss, skip out before extra logic happens
    if (entry === null || !contactsAPI) {
      peep = new MailPeep(addressPair.name || '', emailAddress, null, null);
      if (!contactsAPI)
        return peep;
    }
    // known contact; unpack contact info
    else if (entry !== undefined) {
      var name = addressPair.name || '';
      if (entry.name && entry.name.length)
        name = entry.name[0];
      peep = new MailPeep(
        name,
        emailAddress,
        entry.id,
        (entry.photo && entry.photo.length) ? entry.photo[0] : null);
    }
    // not yet looked-up; assume it's a miss and we'll fix-up if it's a hit
    else {
      peep = new MailPeep(addressPair.name || '',
                          emailAddress, null, null);

      // Place a speculative miss in the contact cache so that additional
      // requests take that path.  They will get fixed up when our lookup
      // returns (or if a change event happens to come in before our lookup
      // returns.)  Note that we do not do any hit/miss counting right now; we
      // wait for the result to come back.
      this._contactCache[emailAddress] = null;

      this.pendingLookupCount++;

      // Search contacts, but use an all lower-case name, since the contacts
      // API's search plumbing uses a lowercase version of the email address
      // for these search comparisons. However, the actual display of the
      // contact in the contact app has casing preserved. emailAddress could
      // be undefined though if a group/undisclosed-recipients case, so guard
      // against that (deeper normalization fix tracked in bug 1097820). Using
      // empty string in the undefined emailAddress case because passing the
      // value of undefined directly in the filterValue results in some contacts
      // being returned. Potentially all contacts. However passing empty string
      // gives back no results, even if there is a contact with no email address
      // assigned to it.
      var filterValue = emailAddress ? emailAddress.toLowerCase() : '';
      var req = contactsAPI.find({
                  filterBy: ['email'],
                  filterOp: 'equals',
                  filterValue: filterValue
                });
      var self = this, handleResult = function() {
        if (req.result && req.result.length) {
          // CONSIDER TODO SOMEDAY: since the search is done witha a
          // toLowerCase() call, it is conceivable that we could get multiple
          // results with slightly different casing. It might be nice to try
          // to find the best casing match, but the payoff for that is likely
          // small, and the common case will be that the first one is good to
          // use.
          var contact = req.result[0];

          ContactCache._contactCache[emailAddress] = contact;
          if (++ContactCache._cacheHitEntries > ContactCache.MAX_CACHE_HITS)
            self._resetCache();

          var peepsToFixup = self._livePeepsByEmail[emailAddress];
          // there might no longer be any MailPeeps alive to care; leave
          if (!peepsToFixup)
            return;
          for (var i = 0; i < peepsToFixup.length; i++) {
            var peep = peepsToFixup[i];
            if (!peep.contactId) {
              peep.contactId = contact.id;
              var livePeeps = self._livePeepsById[peep.contactId];
              if (livePeeps === undefined)
                livePeeps = self._livePeepsById[peep.contactId] = [];
              livePeeps.push(peep);
            }

            if (contact.name && contact.name.length)
              peep.contactName = contact.name[0];
            if (contact.photo && contact.photo.length)
              peep._thumbnailBlob = contact.photo[0];

            // If no one is waiting for our/any request to complete, generate an
            // onchange notification.
            if (!self.callbacks.length) {
              if (peep.onchange) {
                try {
                  peep.onchange(peep);
                }
                catch (ex) {
                  reportClientCodeError('peep.onchange error', ex, '\n',
                                        ex.stack);
                }
              }
            }
          }
        }
        else {
          ContactCache._contactCache[emailAddress] = null;
          if (++ContactCache._cacheEmptyEntries > ContactCache.MAX_CACHE_EMPTY)
            self._resetCache();
        }
        // Only notify callbacks if all outstanding lookups have completed
        if (--self.pendingLookupCount === 0) {
          for (i = 0; i < ContactCache.callbacks.length; i++) {
            ContactCache.callbacks[i]();
          }
          ContactCache.callbacks.splice(0, ContactCache.callbacks.length);
        }
      };
      req.onsuccess = handleResult;
      req.onerror = handleResult;
    }

    // - track the peep in our lists of live peeps
    var livePeeps;
    livePeeps = this._livePeepsByEmail[emailAddress];
    if (livePeeps === undefined)
      livePeeps = this._livePeepsByEmail[emailAddress] = [];
    livePeeps.push(peep);

    if (peep.contactId) {
      livePeeps = this._livePeepsById[peep.contactId];
      if (livePeeps === undefined)
        livePeeps = this._livePeepsById[peep.contactId] = [];
      livePeeps.push(peep);
    }

    return peep;
  },

  forgetPeepInstances: function() {
    var livePeepsById = this._livePeepsById,
        livePeepsByEmail = this._livePeepsByEmail;
    for (var iArg = 0; iArg < arguments.length; iArg++) {
      var peeps = arguments[iArg];
      if (!peeps)
        continue;
      for (var iPeep = 0; iPeep < peeps.length; iPeep++) {
        var peep = peeps[iPeep], livePeeps, idx;
        if (peep.contactId) {
          livePeeps = livePeepsById[peep.contactId];
          if (livePeeps) {
            idx = livePeeps.indexOf(peep);
            if (idx !== -1) {
              livePeeps.splice(idx, 1);
              if (livePeeps.length === 0)
                delete livePeepsById[peep.contactId];
            }
          }
        }
        livePeeps = livePeepsByEmail[peep.address];
        if (livePeeps) {
          idx = livePeeps.indexOf(peep);
          if (idx !== -1) {
            livePeeps.splice(idx, 1);
            if (livePeeps.length === 0)
              delete livePeepsByEmail[peep.address];
          }
        }
      }
    }
  },
};

function revokeImageSrc() {
  // see showBlobInImg below for the rationale for useWin.
  var useWin = this.ownerDocument.defaultView || window;
  useWin.URL.revokeObjectURL(this.src);
}

function showBlobInImg(imgNode, blob) {
  // We need to look at the image node because object URLs are scoped per
  // document, and for HTML e-mails, we use an iframe that lives in a different
  // document than us.
  //
  // the "|| window" is for our shimmed testing environment and should not
  // happen in production.
  var useWin = imgNode.ownerDocument.defaultView || window;
  imgNode.src = useWin.URL.createObjectURL(blob);
}

function MailPeep(name, address, contactId, thumbnailBlob) {
  this.name = name;
  this.address = address;
  this.contactId = contactId;
  this._thumbnailBlob = thumbnailBlob;

  this.element = null;
  this.data = null;
  // peeps are usually one of: from, to, cc, bcc
  this.type = null;

  this.onchange = null;
}
MailPeep.prototype = {
  get isContact() {
    return this.contactId !== null;
  },

  toString: function() {
    return '[MailPeep: ' + this.address + ']';
  },
  toJSON: function() {
    return {
      name: this.name,
      address: this.address,
      contactId: this.contactId
    };
  },
  toWireRep: function() {
    return {
      name: this.name,
      address: this.address
    };
  },

  get hasPicture() {
    return this._thumbnailBlob !== null;
  },
  /**
   * Display the contact's thumbnail on the given image node, abstracting away
   * the issue of Blob URL life-cycle management.
   */
  displayPictureInImageTag: function(imgNode) {
    if (this._thumbnailBlob)
      showBlobInImg(imgNode, this._thumbnailBlob);
  },
};

/**
 * Email overview information for displaying the message in the list as planned
 * for the current UI.  Things that we don't need (ex: to/cc/bcc) for the list
 * end up on the body, currently.  They will probably migrate to the header in
 * the future.
 *
 * Events are generated if the metadata of the message changes or if the message
 * is removed.  The `BridgedViewSlice` instance is how the system keeps track
 * of what messages are being displayed/still alive to need updates.
 */
function MailHeader(slice, wireRep) {
  this._slice = slice;

  // Store the wireRep so it can be used for caching.
  this._wireRep = wireRep;

  this.id = wireRep.suid;
  this.guid = wireRep.guid;

  this.author = ContactCache.resolvePeep(wireRep.author);
  this.to = ContactCache.resolvePeeps(wireRep.to);
  this.cc = ContactCache.resolvePeeps(wireRep.cc);
  this.bcc = ContactCache.resolvePeeps(wireRep.bcc);
  this.replyTo = wireRep.replyTo;

  this.date = new Date(wireRep.date);

  this.__update(wireRep);
  this.hasAttachments = wireRep.hasAttachments;

  this.subject = wireRep.subject;
  this.snippet = wireRep.snippet;

  this.onchange = null;
  this.onremove = null;

  // build a place for the DOM element and arbitrary data into our shape
  this.element = null;
  this.data = null;
}
MailHeader.prototype = {
  toString: function() {
    return '[MailHeader: ' + this.id + ']';
  },
  toJSON: function() {
    return {
      type: 'MailHeader',
      id: this.id
    };
  },

  /**
   * The use-case is the message list providing the message reader with a
   * header.  The header really wants to get update notifications from the
   * backend and therefore not be inert, but that's a little complicated and out
   * of scope for the current bug.
   *
   * We clone at all because our MailPeep.onchange and MailPeep.element values
   * were getting clobbered.  All the instances are currently intended to map
   * 1:1 to a single UI widget, so cloning seems like the right thing to do.
   *
   * A deeper issue is whether the message reader will want to have its own
   * slice since the reader will soon allow forward/backward navigation.  I
   * assume we'll want the message list to track that movement, which suggests
   * that it really doesn't want to do that.  This suggests we'll either want
   * non-inert clones or to just use a list-of-handlers model with us using
   * closures and being careful about removing event handlers.
   */
  makeCopy: function() {
    return new MailHeader(this._slice, this._wireRep);
  },

  __update: function(wireRep) {
    this._wireRep = wireRep;
    if (wireRep.snippet !== null) {
      this.snippet = wireRep.snippet;
    }

    this.isRead = wireRep.flags.indexOf('\\Seen') !== -1;
    this.isStarred = wireRep.flags.indexOf('\\Flagged') !== -1;
    this.isRepliedTo = wireRep.flags.indexOf('\\Answered') !== -1;
    this.isForwarded = wireRep.flags.indexOf('$Forwarded') !== -1;
    this.isJunk = wireRep.flags.indexOf('$Junk') !== -1;
    this.tags = filterOutBuiltinFlags(wireRep.flags);

    // Messages in the outbox will have `sendStatus` populated like so:
    // {
    //   state: 'pending', 'error', 'success', 'sending', or 'syncDone'
    //   err: null,
    //   badAddresses: null,
    //   sendFailures: 2
    // }
    this.sendStatus = wireRep.sendStatus || {};
  },

  /**
   * Release subscriptions associated with the header; currently this just means
   * tell the ContactCache we no longer care about the `MailPeep` instances.
   */
  __die: function() {
    ContactCache.forgetPeepInstances([this.author], this.to, this.cc, this.bcc);
  },

  /**
   * Delete this message
   */
  deleteMessage: function() {
    return this._slice._api.deleteMessages([this]);
  },

  /*
   * Copy this message to another folder.
   */
  /*
  copyMessage: function(targetFolder) {
    return this._slice._api.copyMessages([this], targetFolder);
  },
  */

  /**
   * Move this message to another folder.
   */
  moveMessage: function(targetFolder) {
    return this._slice._api.moveMessages([this], targetFolder);
  },

  /**
   * Set or clear the read status of this message.
   */
  setRead: function(beRead) {
    return this._slice._api.markMessagesRead([this], beRead);
  },

  /**
   * Set or clear the starred/flagged status of this message.
   */
  setStarred: function(beStarred) {
    return this._slice._api.markMessagesStarred([this], beStarred);
  },

  /**
   * Add and/or remove tags/flags from this messages.
   */
  modifyTags: function(addTags, removeTags) {
    return this._slice._api.modifyMessageTags([this], addTags, removeTags);
  },

  /**
   * Request the `MailBody` instance for this message, passing it to
   * the provided callback function once retrieved. If you request the
   * bodyReps as part of this call, the backend guarantees that it
   * will only call the "onchange" notification when the body has
   * actually changed. In other words, if you end up calling getBody()
   * multiple times for some reason, the backend will be smart about
   * only fetching the bodyReps the first time and generating change
   * notifications as one would expect.
   *
   * @args[
   *   @param[options @dict[
   *     @key[downloadBodyReps #:default false]{
   *       Asynchronously initiate download of the body reps.  The body may
   *       be returned before the body parts are downloaded, but they will
   *       eventually show up.  Use the 'onchange' event to hear as the body
   *       parts get added.
   *     }
   *     @key[withBodyReps #:default false]{
   *       Don't return until the body parts are fully downloaded.
   *     }
   *   ]]
   * ]
   */
  getBody: function(options, callback) {
    if (typeof(options) === 'function') {
      callback = options;
      options = null;
    }
    this._slice._api._getBodyForMessage(this, options, callback);
  },

  /**
   * Returns the number of bytes needed before we can display the full
   * body. If this value is large, we should warn the user that they
   * may be downloading a large amount of data. For IMAP, this value
   * is the amount of data we need to render bodyReps and
   * relatedParts; for POP3, we need the whole message.
   */
  get bytesToDownloadForBodyDisplay() {
    // If this is unset (old message), default to zero so that we just
    // won't show any warnings (rather than prompting incorrectly).
    return this._wireRep.bytesToDownloadForBodyDisplay || 0;
  },

  /**
   * Assume this is a draft message and return a MessageComposition object
   * that will be asynchronously populated.  The provided callback will be
   * notified once all composition state has been loaded.
   *
   * The underlying message will be replaced by other messages as the draft
   * is updated and effectively deleted once the draft is completed.  (A
   * move may be performed instead.)
   */
  editAsDraft: function(callback) {
    var composer = this._slice._api.resumeMessageComposition(this, callback);
    composer.hasDraft = true;
    return composer;
  },

  /**
   * Start composing a reply to this message.
   *
   * @args[
   *   @param[replyMode @oneof[
   *     @default[null]{
   *       To be specified...
   *     }
   *     @case['sender']{
   *       Reply to the author of the message.
   *     }
   *     @case['list']{
   *       Reply to the mailing list the message was received from.  If there
   *       were other mailing lists copied on the message, they will not
   *       be included.
   *     }
   *     @case['all']{
   *       Reply to the sender and all listed recipients of the message.
   *     }
   *   ]]{
   *     The not currently used reply-mode.
   *   }
   * ]
   * @return[MessageComposition]
   */
  replyToMessage: function(replyMode, callback) {
    return this._slice._api.beginMessageComposition(
      this, null, { replyTo: this, replyMode: replyMode }, callback);
  },

  /**
   * Start composing a forward of this message.
   *
   * @args[
   *   @param[forwardMode @oneof[
   *     @case['inline']{
   *       Forward the message inline.
   *     }
   *   ]]
   * ]
   * @return[MessageComposition]
   */
  forwardMessage: function(forwardMode, callback) {
    return this._slice._api.beginMessageComposition(
      this, null, { forwardOf: this, forwardMode: forwardMode }, callback);
  },
};

/**
 * Represents a mail message that matched some search criteria by providing
 * both the header and information about the matches that occurred.
 */
function MailMatchedHeader(slice, wireRep) {
  this.header = new MailHeader(slice, wireRep.header);
  this.matches = wireRep.matches;

  this.element = null;
  this.data = null;
}
MailMatchedHeader.prototype = {
  toString: function() {
    return '[MailMatchedHeader: ' + this.header.id + ']';
  },
  toJSON: function() {
    return {
      type: 'MailMatchedHeader',
      id: this.header.id
    };
  },

  __update: function(wireRep) {
    this.matches = wireRep.matches;
    this.header.__update(wireRep.header);
  },

  __die: function() {
    this.header.__die();
  },
};

/**
 * Lists the attachments in a message as well as providing a way to display the
 * body while (eventually) also accounting for message quoting.
 *
 * Mail bodies are immutable and so there are no events on them or lifetime
 * management to worry about.  However, you should keep the `MailHeader` alive
 * and worry about its lifetime since the message can get deleted, etc.
 */
function MailBody(api, suid, wireRep, handle) {
  this._api = api;
  this.id = suid;
  this._date = wireRep.date;
  this._handle = handle;

  this.attachments = null;
  if (wireRep.attachments) {
    this.attachments = [];
    for (var iAtt = 0; iAtt < wireRep.attachments.length; iAtt++) {
      this.attachments.push(
        new MailAttachment(this, wireRep.attachments[iAtt]));
    }
  }
  this._relatedParts = wireRep.relatedParts;
  this.bodyReps = wireRep.bodyReps;
  // references is included for debug/unit testing purposes, hence is private
  this._references = wireRep.references;

  this.onchange = null;
  this.ondead = null;
}
MailBody.prototype = {
  toString: function() {
    return '[MailBody: ' + this.id + ']';
  },
  toJSON: function() {
    return {
      type: 'MailBody',
      id: this.id
    };
  },

  __update: function(wireRep, detail) {
    // Related parts and bodyReps have no state we need to maintain.  Just
    // replace them with the new copies for simplicity.
    this._relatedParts = wireRep.relatedParts;
    this.bodyReps = wireRep.bodyReps;

    // detaching an attachment is special since we need to splice the attachment
    // out.
    if (detail && detail.changeDetails &&
        detail.changeDetails.detachedAttachments) {
      var indices = detail.changeDetails.detachedAttachments;
      for (var iSplice = 0; iSplice < indices.length; iSplice++) {
        this.attachments.splice(indices[iSplice], 1);
      }
    }

    // Attachment instances need to be updated rather than replaced.
    if (wireRep.attachments) {
      var i, attachment;
      for (i = 0; i < this.attachments.length; i++) {
        attachment = this.attachments[i];
        attachment.__update(wireRep.attachments[i]);
      }
      // If we added new attachments, construct them now.
      for (i = this.attachments.length; i < wireRep.attachments.length; i++) {
        this.attachments.push(
          new MailAttachment(this, wireRep.attachments[i]));
      }
      // We don't handle the fictional case where wireRep.attachments
      // decreases in size, because that doesn't currently happen and
      // probably won't ever, apart from detachedAttachments above
      // which are a different thing.
    }
  },

  /**
   * true if this is an HTML document with inline images sent as part of the
   * messages.
   */
  get embeddedImageCount() {
    if (!this._relatedParts)
      return 0;
    return this._relatedParts.length;
  },

  /**
   * return the size of all embedded images
   */
  get allEmbeddedImagesSize() {
    var imagesSize = 0;
    var imagesCount = this._relatedParts.length;

    for(var i = 0; i < imagesCount; i++) {
      imagesSize += this._relatedParts[i].sizeEstimate;
    }
    console.log("allEmbeddedImagesSize: all the embedded image count is ", imagesCount);
    console.log("allEmbeddedImagesSize: all the embedded image size is ", imagesSize);
    return imagesSize;
  },

  /**
   * true if all the bodyReps are downloaded.
   */
  get bodyRepsDownloaded() {
    var i = 0;
    var len = this.bodyReps.length;

    for (; i < len; i++) {
      if (!this.bodyReps[i].isDownloaded) {
        return false;
      }
    }
    return true;
  },

  /**
   * true if all of the images are already downloaded.
   */
  get embeddedImagesDownloaded() {
    for (var i = 0; i < this._relatedParts.length; i++) {
      var relatedPart = this._relatedParts[i];
      if (!relatedPart.file)
        return false;
    }
    return true;
  },

  /**
   * Trigger the download of any inline images sent as part of the message.
   * Once the images have been downloaded, invoke the provided callback.
   */
  downloadEmbeddedImages: function(callWhenDone, callOnProgress) {
    var relPartIndices = [];
    for (var i = 0; i < this._relatedParts.length; i++) {
      var relatedPart = this._relatedParts[i];
      if (relatedPart.file)
        continue;
      relPartIndices.push(i);
    }
    if (!relPartIndices.length) {
      if (callWhenDone)
        callWhenDone();
      return;
    }
    this._api._downloadAttachments(this, relPartIndices, [], [],
                                   callWhenDone, callOnProgress);
  },

  /**
   * Synchronously trigger the display of embedded images.
   *
   * The loadCallback allows iframe resizing logic to fire once the size of the
   * image is known since Gecko still doesn't have seamless iframes.
   */
  showEmbeddedImages: function(htmlNode, loadCallback) {
    var i, cidToBlob = {};
    // - Generate object URLs for the attachments
    for (i = 0; i < this._relatedParts.length; i++) {
      var relPart = this._relatedParts[i];
      // Related parts should all be stored as Blobs-in-IndexedDB
      if (relPart.file && !Array.isArray(relPart.file))
        cidToBlob[relPart.contentId] = relPart.file;
    }

    // - Transform the links
    var nodes = htmlNode.querySelectorAll('.moz-embedded-image');
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i],
          cid = node.getAttribute('cid-src');

      if (!cidToBlob.hasOwnProperty(cid))
        continue;
      showBlobInImg(node, cidToBlob[cid]);
      if (loadCallback)
        node.addEventListener('load', loadCallback, false);

      node.removeAttribute('cid-src');
      node.classList.remove('moz-embedded-image');
    }
  },

  /**
   * @return[Boolean]{
   *   True if the given HTML node sub-tree contains references to externally
   *   hosted images.  These are detected by looking for markup left in the
   *   image by the sanitization process.  The markup is not guaranteed to be
   *   stable, so don't do this yourself.
   * }
   */
  checkForExternalImages: function(htmlNode) {
    var someNode = htmlNode.querySelector('.moz-external-image');
    return someNode !== null;
  },

  /**
   * Transform previously sanitized references to external images into live
   * references to images.  This un-does the operations of the sanitization step
   * using implementation-specific details subject to change, so don't do this
   * yourself.
   */
  showExternalImages: function(htmlNode, loadCallback) {
    // querySelectorAll is not live, whereas getElementsByClassName is; we
    // don't need/want live, especially with our manipulations.
    var nodes = htmlNode.querySelectorAll('.moz-external-image');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (loadCallback) {
        node.addEventListener('load', loadCallback, false);
      }
      node.setAttribute('src', node.getAttribute('ext-src'));
      node.removeAttribute('ext-src');
      node.classList.remove('moz-external-image');
    }
  },
  /**
   * Call this method when you are done with a message body.
   */
  die: function() {
    // Remember to cleanup event listeners except ondead!
    this.onchange = null;

    this._api.__bridgeSend({
      type: 'killBody',
      id: this.id,
      handle: this._handle
    });
  }
};

/**
 * Provides the file name, mime-type, and estimated file size of an attachment.
 * In the future this will also be the means for requesting the download of
 * an attachment or for attachment-forwarding semantics.
 */
function MailAttachment(_body, wireRep) {
  this._body = _body;
  this.partId = wireRep.part;
  this.filename = wireRep.name;
  this.mimetype = wireRep.type;
  this.sizeEstimateInBytes = wireRep.sizeEstimate;
  this._file = wireRep.file;

  // build a place for the DOM element and arbitrary data into our shape
  this.element = null;
  this.data = null;
}
MailAttachment.prototype = {
  toString: function() {
    return '[MailAttachment: "' + this.filename + '"]';
  },
  toJSON: function() {
    return {
      type: 'MailAttachment',
      filename: this.filename
    };
  },

  __update: function(wireRep) {
    this.mimetype = wireRep.type;
    this.sizeEstimateInBytes = wireRep.sizeEstimate;
    this._file = wireRep.file;
  },

  get isDownloaded() {
    return !!this._file;
  },

  /**
   * Is this attachment something we can download?  In almost all cases, the
   * answer is yes, regardless of network state.  The exception is that sent
   * POP3 messages do not retain their attachment Blobs and there is no way to
   * download them after the fact.
   */
  get isDownloadable() {
    return this.mimetype !== 'application/x-gelam-no-download';
  },

  resetDownloadState: function() {
    this._file = null;
  },

  /**
   * Queue this attachment for downloading.
   *
   * @param {Function} callWhenDone
   *     A callback to be invoked when the download completes.
   * @param {Function} callOnProgress
   *     A callback to be invoked as the download progresses.  NOT HOOKED UP!
   * @param {Boolean} [registerWithDownloadManager]
   *     Should we register the Blob with the mozDownloadManager (if it is
   *     present)?  For the Gaia mail app this decision is based on the
   *     capabilities of the default gaia apps, and not a decision easily made
   *     by GELAM.
   */
  download: function(callWhenDone, callOnProgress,
                     registerWithDownloadManager) {
    if (this.isDownloaded) {
      callWhenDone();
      return;
    }
    this._body._api._downloadAttachments(
      this._body, [], [this._body.attachments.indexOf(this)],
      [registerWithDownloadManager || false],
      callWhenDone, callOnProgress);
  },
};

/**
 * Undoable operations describe the operation that was performed for
 * presentation to the user and hold onto a handle that can be used to undo
 * whatever it was.  While the current UI plan does not call for the ability to
 * get a list of recently performed actions, the goal is to make it feasible
 * in the future.
 */
function UndoableOperation(_api, operation, affectedCount,
                           _tempHandle, _longtermIds) {
  this._api = _api;
  /**
   * @oneof[
   *   @case['read']{
   *     Marked message(s) as read.
   *   }
   *   @case['unread']{
   *     Marked message(s) as unread.
   *   }
   *   @case['star']{
   *     Starred message(s).
   *   }
   *   @case['unstar']{
   *     Unstarred message(s).
   *   }
   *   @case['addtag']{
   *     Added tag(s).
   *   }
   *   @case['removetag']{
   *     Removed tag(s).
   *   }
   *   @case['move']{
   *     Moved message(s).
   *   }
   *   @case['copy']{
   *     Copied message(s).
   *   }
   *   @case['delete']{
   *     Deleted message(s) by moving to trash folder.
   *   }
   * ]
   */
  this.operation = operation;
  /**
   * The number of messages affected by this operation.
   */
  this.affectedCount = affectedCount;

  /**
   * The temporary handle we use to refer to the operation immediately after
   * issuing it until we hear back from the mail bridge about its more permanent
   * _longtermIds.
   */
  this._tempHandle = _tempHandle;
  /**
   * The names of the per-account operations that this operation was mapped
   * to.
   */
  this._longtermIds = null;

  this._undoRequested = false;
}
UndoableOperation.prototype = {
  toString: function() {
    return '[UndoableOperation]';
  },
  toJSON: function() {
    return {
      type: 'UndoableOperation',
      handle: this._tempHandle,
      longtermIds: this._longtermIds,
    };
  },

  undo: function() {
    // We can't issue the undo until we've heard the longterm id, so just flag
    // it to be processed when we do.
    if (!this._longtermIds) {
      this._undoRequested = true;
      return;
    }
    this._api.__undo(this);
  },
};

/**
 * Ordered list collection abstraction where we may potentially only be viewing
 * a subset of the actual items in the collection.  This allows us to handle
 * lists with lots of items as well as lists where we have to retrieve data
 * from a remote server to populate the list.
 */
function BridgedViewSlice(api, ns, handle) {
  this._api = api;
  this._ns = ns;
  this._handle = handle;

  this.items = [];

  /**
   * @oneof[
   *   @case['new']{
   *     We were just created and have no meaningful state.
   *   }
   *   @case['synchronizing']{
   *     We are talking to a server to populate/expand the contents of this
   *     list.
   *   }
   *   @case['synced']{
   *     We successfully synchronized with the backing store/server.  If we are
   *     known to be offline and did not attempt to talk to the server, then we
   *     will still have this status.
   *   }
   *   @case['syncfailed']{
   *     We tried to synchronize with the server but failed.
   *   }
   * ]{
   *   Quasi-extensible indicator of whether we are synchronizing or not.  The
   *   idea is that if we are synchronizing, a spinner indicator can be shown
   *   at the end of the list of messages.
   * }
   */
  this.status = 'new';

  /**
   * A value in the range [0.0, 1.0] expressing our synchronization progress.
   */
  this.syncProgress = 0.0;

  /**
   * False if we can grow the slice in the negative direction without
   * requiring user prompting.
   */
  this.atTop = false;
  /**
   * False if we can grow the slice in the positive direction without
   * requiring user prompting.
   */
  this.atBottom = false;

  /**
   * Can we potentially grow the slice in the ngative direction if the user
   * requests it?  For example, triggering an IMAP sync for a part of the
   * time-range we have not previously synchronized.
   *
   * This is only really meaningful when `atTop` is true; if we are not at the
   * top, this value will be false.
   */
  this.userCanGrowUpwards = false;

  /**
   * Can we potentially grow the slice in the positive direction if the user
   * requests it?  For example, triggering an IMAP sync for a part of the
   * time-range we have not previously synchronized.
   *
   * This is only really meaningful when `atBottom` is true; if we are not at
   * the bottom, this value will be false.
   */
  this.userCanGrowDownwards = false;

  /**
   * Number of pending requests to the back-end.  To be used by logic that can
   * defer further requests until existing requests are complete.  For example,
   * infinite scrolling logic would do best to wait for the back-end to service
   * its requests before issuing new ones.
   */
  this.pendingRequestCount = 0;
  /**
   * The direction we are growing, if any (0 if not).
   */
  this._growing = 0;

  this.onadd = null;
  this.onchange = null;
  this.onsplice = null;
  this.onremove = null;
  this.onstatus = null;
  this.oncomplete = null;
  this.ondead = null;
}
BridgedViewSlice.prototype = {
  toString: function() {
    return '[BridgedViewSlice: ' + this._ns + ' ' + this._handle + ']';
  },
  toJSON: function() {
    return {
      type: 'BridgedViewSlice',
      namespace: this._ns,
      handle: this._handle
    };
  },

  /**
   * Tell the back-end we no longer need some of the items we know about.  This
   * will manifest as a requested splice at some point in the future, although
   * the back-end may attenuate partially or entirely.
   */
  requestShrinkage: function(firstUsedIndex, lastUsedIndex) {
    this.pendingRequestCount++;
    if (lastUsedIndex >= this.items.length)
      lastUsedIndex = this.items.length - 1;

    // We send indices and suid's.  The indices are used for fast-pathing;
    // if the suid's don't match, a linear search is undertaken.
    this._api.__bridgeSend({
        type: 'shrinkSlice',
        handle: this._handle,
        firstIndex: firstUsedIndex,
        firstSuid: this.items[firstUsedIndex].id,
        lastIndex: lastUsedIndex,
        lastSuid: this.items[lastUsedIndex].id
      });
  },

  /**
   * Request additional data in the given direction, optionally specifying that
   * some potentially costly growth of the data set should be performed.
   */
  requestGrowth: function(dirMagnitude, userRequestsGrowth) {
    if (this._growing) {
      reportError('Already growing in ' + this._growing + ' dir.');
      return;
    }
    this._growing = dirMagnitude;
    this.pendingRequestCount++;

    this._api.__bridgeSend({
        type: 'growSlice',
        dirMagnitude: dirMagnitude,
        userRequestsGrowth: userRequestsGrowth,
        handle: this._handle
      });
  },

  die: function() {
    // Null out all listeners except for the ondead listener.  This avoids
    // the callbacks from having to filter out messages from dead slices.
    this.onadd = null;
    this.onchange = null;
    this.onsplice = null;
    this.onremove = null;
    this.onstatus = null;
    this.oncomplete = null;
    this._api.__bridgeSend({
        type: 'killSlice',
        handle: this._handle
      });

    for (var i = 0; i < this.items.length; i++) {
      var item = this.items[i];
      item.__die();
    }
  },
};

function AccountsViewSlice(api, handle) {
  BridgedViewSlice.call(this, api, 'accounts', handle);
}
AccountsViewSlice.prototype = Object.create(BridgedViewSlice.prototype);

/**
 * Return the account with the given ID, or null.
 */
AccountsViewSlice.prototype.getAccountById = function(id) {
  for (var i = 0; i < this.items.length; i++) {
    if (this.items[i]._wireRep.id === id) {
      return this.items[i];
    }
  }
  return null;
};

Object.defineProperty(AccountsViewSlice.prototype, 'defaultAccount', {
  get: function () {
    var defaultAccount = this.items[0];
    for (var i = 1; i < this.items.length; i++) {
      // For UI upgrades, the defaultPriority may not be set, so default to
      // zero for comparisons
      if ((this.items[i]._wireRep.defaultPriority || 0) >
          (defaultAccount._wireRep.defaultPriority || 0))
        defaultAccount = this.items[i];
    }

    return defaultAccount;
  }
});

function FoldersViewSlice(api, handle) {
  BridgedViewSlice.call(this, api, 'folders', handle);
}
FoldersViewSlice.prototype = Object.create(BridgedViewSlice.prototype);

FoldersViewSlice.prototype.syncList = function(accountId) {
  this._api.__bridgeSend({
      type: 'foldersListRefresh',
      accountId: accountId,
      handle: this._handle
  });
};

FoldersViewSlice.prototype.getFirstFolderWithType = function(type, items) {
  // allow an explicit list of items to be provided, specifically for use in
  // onsplice handlers where the items have not yet been spliced in.
  if (!items)
    items = this.items;
  for (var i = 0; i < items.length; i++) {
    var folder = items[i];
    if (folder.type === type)
      return folder;
  }
  return null;
};

FoldersViewSlice.prototype.getFirstFolderWithName = function(name, items) {
  if (!items)
    items = this.items;
  for (var i = 0; i < items.length; i++) {
    var folder = items[i];
    if (folder.name === name)
      return folder;
  }
  return null;
};

FoldersViewSlice.prototype.getFirstFolderWithPath = function(path, items) {
  if (!items)
    items = this.items;
  for (var i = 0; i < items.length; i++) {
    var folder = items[i];
    if (folder.path === path)
      return folder;
  }
  return null;
};

function HeadersViewSlice(api, handle, ns) {
  BridgedViewSlice.call(this, api, ns || 'headers', handle);

  this._bodiesRequestId = 1;
  this._bodiesRequest = {};
}
HeadersViewSlice.prototype = Object.create(BridgedViewSlice.prototype);

/**
 * Request a re-sync of the time interval covering the effective time
 * range.  If the most recently displayed message is the most recent message
 * known to us, then the date range will cover through "now".  The refresh
 * mechanism will disable normal sync bisection limits, so take care to
 * `requestShrinkage` to a reasonable value if you have a ridiculous number of
 * headers currently present.
 */
HeadersViewSlice.prototype.refresh = function() {
  this._api.__bridgeSend({
      type: 'refreshHeaders',
      handle: this._handle
    });
};

HeadersViewSlice.prototype._notifyRequestBodiesComplete = function(reqId) {
  var callback = this._bodiesRequest[reqId];
  if (reqId && callback) {
    callback(true);
    delete this._bodiesRequest[reqId];
  }
};

/**
 * Requests bodies (if of a reasonable size) given a start/end position.
 *
 *    // start/end inclusive
 *    slice.maybeRequestBodies(5, 10);
 *
 * The results will be sent through the standard slice/header events.
 */
HeadersViewSlice.prototype.maybeRequestBodies =
  function(idxStart, idxEnd, options, callback) {

  if (typeof(options) === 'function') {
    callback = options;
    options = null;
  }

  var messages = [];

  idxEnd = Math.min(idxEnd, this.items.length - 1);

  for (; idxStart <= idxEnd; idxStart++) {
    var item = this.items[idxStart];
    // ns of 'headers' has the id/date on the item, where 'matchedHeaders'
    // has it on header.date
    if (this._ns === 'matchedHeaders') {
      item = item.header;
    }

    if (item && item.snippet === null) {
      messages.push({
        suid: item.id,
        // backend does not care about Date objects
        date: item.date.valueOf()
      });
    }
  }

  if (!messages.length)
    return callback && window.setZeroTimeout(callback, false);

  var reqId = this._bodiesRequestId++;
  this._bodiesRequest[reqId] = callback;

  this._api.__bridgeSend({
    type: 'requestBodies',
    handle: this._handle,
    requestId: reqId,
    messages: messages,
    options: options
  });
};

HeadersViewSlice.prototype.indexOfItemById = function(id) {
  var result = -1;

  for (var i = 0; i < this.items.length; i++) {
    if (this.items[i].id === id) {
      result = i;
      break;
    }
  }

  return result;
};

/**
 * Handle for a current/ongoing message composition process.  The UI reads state
 * out of the object when it resumes editing a draft, otherwise this can just be
 * treated as write-only.
 *
 * == Other clients and drafts:
 *
 * If another client deletes our draft out from under us, we currently won't
 * notice.
 */
function MessageComposition(api, handle) {
  this._api = api;
  this._handle = handle;

  this.senderIdentity = null;

  this.to = null;
  this.cc = null;
  this.bcc = null;

  this.subject = null;

  this.body = null;

  this._references = null;
  /**
   * @property attachments
   * @type Object[]
   *
   * A list of attachments currently attached or currently being attached with
   * the following attributes:
   * - name: The filename
   * - size: The size of the attachment payload in binary form.  This does not
   *   include transport encoding costs.
   *
   * Manipulating this list has no effect on reality; the methods addAttachment
   * and removeAttachment must be used.
   */
  this.attachments = null;

  this.hasDraft = false;
  this.sendType = null;
}
MessageComposition.prototype = {
  toString: function() {
    return '[MessageComposition: ' + this._handle + ']';
  },
  toJSON: function() {
    return {
      type: 'MessageComposition',
      handle: this._handle
    };
  },

  die: function() {
    if (this._handle) {
      this._api._composeDone(this._handle, 'die', null, null);
      this._handle = null;
    }
  },

  /**
   * Add an attachment to this composition.  This is an asynchronous process
   * that incrementally converts the Blob we are provided into a line-wrapped
   * base64-encoded message suitable for use in the rfc2822 message generation
   * process.  We will perform the conversion in slices whose sizes are
   * chosen to avoid causing a memory usage explosion that causes us to be
   * reaped.  Once the conversion is completed we will forget the Blob reference
   * provided to us.
   *
   * From the perspective of our drafts, an attachment is not fully attached
   * until it has been completely encoded, sliced, and persisted to our
   * IndexedDB database.  In the event of a crash during this time window,
   * the attachment will effectively have not been attached.  Our logic will
   * discard the partially-translated attachment when de-persisting the draft.
   * We will, however, create an entry in the attachments array immediately;
   * we also return it to you.  You should be able to safely call
   * removeAttachment with it regardless of what has happened on the backend.
   *
   * The caller *MUST* forget all references to the Blob that is being attached
   * after issuing this call.
   *
   * @args[
   *   @param[attachmentDef @dict[
   *     @key[name String]
   *     @key[blob Blob]
   *   ]]
   * ]
   */
  addAttachment: function(attachmentDef, callback) {
    // There needs to be a draft for us to attach things to.
    if (!this.hasDraft)
      this.saveDraft();
    this._api._composeAttach(this._handle, attachmentDef, callback);

    var placeholderAttachment = {
      name: attachmentDef.name,
      pathName: attachmentDef.pathName,
      blob: attachmentDef.blob
    };
    this.attachments.push(placeholderAttachment);
    return placeholderAttachment;
  },

  /**
   * Remove an attachment previously requested to be added via `addAttachment`.
   *
   * @method removeAttachment
   * @param attachmentDef Object
   *   This must be one of the instances from our `attachments` list.  A
   *   logically equivalent object is no good.
   */
  removeAttachment: function(attachmentDef, callback) {
    var idx = this.attachments.indexOf(attachmentDef);
    if (idx !== -1) {
      this.attachments.splice(idx, 1);
      this._api._composeDetach(this._handle, idx, callback);
    }
  },

  replaceAttachment: function(attachmentDef, targetAttchmentDef, callback) {
    var idx = this.attachments.indexOf(attachmentDef);
    if (idx !== -1) {
      this.attachments.splice(idx, 1);
      this._api._composeDetach(this._handle, idx, callback);

      if (!this.hasDraft) {
        this.saveDraft();
      }
      this._api._composeAttach(this._handle, targetAttchmentDef, callback);

      var placeholderAttachment = {
        name: targetAttchmentDef.name,
        pathName: targetAttchmentDef.pathName,
        blob: targetAttchmentDef.blob
      };
      this.attachments.splice(idx, 0, placeholderAttachment);
    }
  },

  /**
   * Populate our state to send over the wire to the back-end.
   */
  _buildWireRep: function() {
    return {
      senderId: this.senderIdentity.id,
      to: this.to,
      cc: this.cc,
      bcc: this.bcc,
      subject: this.subject,
      body: this.body,
      referencesStr: this._references,
      attachments: this.attachments,
      sendType: this.sendType
    };
  },

  /**
   * Enqueue the message for sending. When the callback fires, the
   * message will be in the outbox, but will likely not have been sent yet.
   */
  finishCompositionSendMessage: function(callback) {
    this._api._composeDone(this._handle, 'send', this._buildWireRep(),
                           callback);
  },

  /**
   * Save the state of this composition.
   */
  saveDraft: function(callback) {
    this.hasDraft = true;
    this._api._composeDone(this._handle, 'save', this._buildWireRep(),
                           callback);
  },

  /**
   * The user has indicated they neither want to send nor save the draft.  We
   * want to delete the message so it is gone from everywhere.
   *
   * In the future, we might support some type of very limited undo
   * functionality, possibly on the UI side of the house.  This is not a secure
   * delete.
   */
  abortCompositionDeleteDraft: function(callback) {
    this._api._composeDone(this._handle, 'delete', null, callback);
  },

};

var LEGAL_CONFIG_KEYS = [];


// Common idioms:
//
// Lead-in (URL and email):
// (                     Capture because we need to know if there was a lead-in
//                       character so we can include it as part of the text
//                       preceding the match.  We lack look-behind matching.
//  ^|                   The URL/email can start at the beginninf of the string.
//  [\s(,;]              Or whitespace or some punctuation that does not imply
//                       a context which would preclude a URL.
// )
//
// We do not need a trailing look-ahead because our regex's will terminate
// because they run out of characters they can eat.

// What we do not attempt to have the regexp do:
// - Avoid trailing '.' and ')' characters.  We let our greedy match absorb
//   these, but have a separate regex for extra characters to leave off at the
//   end.
//
// The Regex (apart from lead-in/lead-out):
// (                     Begin capture of the URL
//  (?:                  (potential detect beginnings)
//   https?:\/\/|        Start with "http" or "https"
//   www\d{0,3}[.][a-z0-9.\-]{2,249}|
//                      Start with "www", up to 3 numbers, then "." then
//                       something that looks domain-namey.  We differ from the
//                       next case in that we do not constrain the top-level
//                       domain as tightly and do not require a trailing path
//                       indicator of "/".  This is IDN root compatible.
//   [a-z0-9.\-]{2,250}[.][a-z]{2,4}\/
//                       Detect a non-www domain, but requiring a trailing "/"
//                       to indicate a path.  This only detects IDN domains
//                       with a non-IDN root.  This is reasonable in cases where
//                       there is no explicit http/https start us out, but
//                       unreasonable where there is.  Our real fix is the bug
//                       to port the Thunderbird/gecko linkification logic.
//
//                       Domain names can be up to 253 characters long, and are
//                       limited to a-zA-Z0-9 and '-'.  The roots don't have
//                       hyphens unless they are IDN roots.  Root zones can be
//                       found here: http://www.iana.org/domains/root/db
//  )
//  [-\w.!~*'();,/?:@&=+$#%]*
//                       path onwards. We allow the set of characters that
//                       encodeURI does not escape plus the result of escaping
//                       (so also '%')
// )
var RE_URL =
  /(^|[\s(,;])((?:https?:\/\/|www\d{0,3}[.][a-z0-9.\-]{2,249}|[a-z0-9.\-]{2,250}[.][a-z]{2,4}\/)[-\w.!~*'();,/?:@&=+$#%]*)/im;
// Set of terminators that are likely to have been part of the context rather
// than part of the URL and so should be uneaten.  This is the same as our
// mirror lead-in set (so '(', ',', ';') plus question end-ing punctuation and
// the potential permutations with parentheses (english-specific)
var RE_UNEAT_LAST_URL_CHARS = /(?:[),;.!?]|[.!?]\)|\)[.!?])$/;
// Don't require the trailing slashes here for pre-pending purposes, although
// our above regex currently requires them.
var RE_HTTP = /^https?:/i;
// Note: the [^\s] is fairly international friendly, but might be too friendly.
//
// Note: We've added support for IDN domains in the e-mail regexp.  We would
// expect optimal presentation of IDN-based e-mail addresses to be using HTML
// mails with an 'a' tag so that the human-readable address is present/visible,
// but we can't be sure of that.
//
// Brief analysis:
//   [a-z0-9.\-]{2,250}[.][a-z0-9\-]{2,32}
//                       Domain portion.  We have looser constraints on the
//                       root in terms of size since we already have the '@'
//                       giving us a high probability of an e-mail address.
//                       Otherwise we use the same base regexp from our URL
//                       logic.
var RE_MAIL =
  /(^|[\s(,;，"<>])([^(,;，"<>@\s]+@[a-z0-9.\-]{2,250}[.][a-z0-9\-]{2,32})/im;
var RE_MAILTO = /^mailto:/i;

var RE_PHONE =
  /(?:\+\d{1,4}[ \t.()-]{0,3}|\()?(?:\d{1,4}[ \t.()-]{0,3})?(?:\d[\d \t.()-]{0,12}\d)\b/i;

var safeStart = /[\s,:;\(>\u0080-\uFFFF]/;

const MINIMUM_DIGITS_IN_PHONE_NUMBER = 5;

var RE_DATE =
  /((^((1[8-9]\d{2})|([2-9]\d{3}))([-\/\._])(10|12|0?[13578])([-\/\._])(3[01]|[12][0-9]|0?[1-9])$)|(^((1[8-9]\d{2})|([2-9]\d{3}))([-\/\._])(11|0?[469])([-\/\._])(30|[12][0-9]|0?[1-9])$)|(^((1[8-9]\d{2})|([2-9]\d{3}))([-\/\._])(0?2)([-\/\._])(2[0-8]|1[0-9]|0?[1-9])$)|(^([2468][048]00)([-\/\._])(0?2)([-\/\._])(29)$)|(^([3579][26]00)([-\/\._])(0?2)([-\/\._])(29)$)|(^([1][89][0][48])([-\/\._])(0?2)([-\/\._])(29)$)|(^([2-9][0-9][0][48])([-\/\._])(0?2)([-\/\._])(29)$)|(^([1][89][2468][048])([-\/\._])(0?2)([-\/\._])(29)$)|(^([2-9][0-9][2468][048])([-\/\._])(0?2)([-\/\._])(29)$)|(^([1][89][13579][26])([-\/\._])(0?2)([-\/\._])(29)$)|(^([2-9][0-9][13579][26])([-\/\._])(0?2)([-\/\._])(29)$))/i;
var RE_IP =
  /((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)/i;

var MailUtils = {

  /**
   * Linkify the given plaintext, producing an Array of HTML nodes as a result.
   */
  linkifyPlain: function(body, doc) {
    var nodes = [];
    var match = true, contentStart;
    while (true) {
      var url = RE_URL.exec(body);
      var email = RE_MAIL.exec(body);
      var phone = RE_PHONE.exec(body);
      // Pick the regexp with the earlier content; index will always be zero.
      if (url &&
          (!email || url.index < email.index) &&
          (!phone || url.index < phone.index)) {
        contentStart = url.index + url[1].length;
        if (contentStart > 0)
          nodes.push(doc.createTextNode(body.substring(0, contentStart)));

        // There are some final characters for a URL that are much more likely
        // to have been part of the enclosing text rather than the end of the
        // URL.
        var useUrl = url[2];
        var uneat = RE_UNEAT_LAST_URL_CHARS.exec(useUrl);
        if (uneat) {
          useUrl = useUrl.substring(0, uneat.index);
        }

        var link = doc.createElement('a');
        link.className = 'moz-external-link';
        // the browser app needs us to put a protocol on the front
        if (RE_HTTP.test(url[2]))
          link.setAttribute('ext-href', useUrl);
        else
          link.setAttribute('ext-href', 'http://' + useUrl);
        var text = doc.createTextNode(useUrl);
        link.appendChild(text);
        nodes.push(link);

        body = body.substring(url.index + url[1].length + useUrl.length);
      }
      else if (email && (!phone || email.index < phone.index)) {
        contentStart = email.index + email[1].length;
        if (contentStart > 0)
          nodes.push(doc.createTextNode(body.substring(0, contentStart)));

        link = doc.createElement('a');
        link.className = 'moz-external-link';
        if (RE_MAILTO.test(email[2]))
          link.setAttribute('ext-href', email[2]);
        else
          link.setAttribute('ext-href', 'mailto:' + email[2]);
        text = doc.createTextNode(email[2]);
        link.appendChild(text);
        nodes.push(link);

        body = body.substring(email.index + email[0].length);
      } else if (phone) {
        contentStart = phone.index;
        var createTextNode = (text) => {
          if (text) {
            var pos = contentStart + text.length;
            var nodeText = body.substring(0, pos);
            nodes.push(doc.createTextNode(nodeText));
            body = body.substring(pos);
          }
        };

        if (phone[0].length > MINIMUM_DIGITS_IN_PHONE_NUMBER) {
          let bDateOrIp = false;
          let bDecimal = false;

          let num = phone[0].split(' ');
          for (let i in num) {
            if (RE_DATE.test(num[i]) || RE_IP.test(num[i])) {
              bDateOrIp = true;
              break;
            }
          }

          if (!bDateOrIp) {
            num = phone[0].split('.');
            if (num.length > 1) {
              for (let i in num) {
                if (num[i].length > 3) {
                  bDecimal = false;
                  break;
                } else if (i === num.length - 1) {
                  bDecimal = true;
                }
              }
            }
          }

          if (RE_DATE.test(phone[0]) || RE_IP.test(phone[0]) ||
              bDateOrIp || bDecimal) {
            createTextNode(phone[0]);
            continue;
          }

          var rest = body.slice(contentStart + phone[0].length);
          if ((rest.length && !safeStart.test(rest.charAt(0))) ||
              (contentStart > 0 &&
               !safeStart.test(body.charAt(contentStart - 1)))) {
            createTextNode(phone[0]);
            continue;
          }
          if (contentStart > 0) {
            nodes.push(doc.createTextNode(body.substring(0, contentStart)));
          }

          link = doc.createElement('a');
          link.className = 'moz-external-link';
          link.setAttribute('ext-href', 'callto:' + phone[0]);
          text = doc.createTextNode(phone[0]);
          link.appendChild(text);
          nodes.push(link);

          body = body.substring(phone.index + phone[0].length);
        } else {
          createTextNode(phone[0]);
        }
      } else {
        break;
      }
    }

    if (body.length > 0)
      nodes.push(doc.createTextNode(body));

    return nodes;
  },

  /**
   * Process the document of an HTML iframe to linkify the text portions of the
   * HTML document.  'A' tags and their descendants are not linkified, nor
   * are the attributes of HTML nodes.
   */
  linkifyHTML: function(doc) {
    function linkElem(elem) {
      var children = elem.childNodes;
      for (var i = 0; i < children.length; i++) {
        var sub = children[i];
        if (sub.nodeName === '#text') {
          var nodes = MailUtils.linkifyPlain(sub.nodeValue, doc);

          elem.replaceChild(nodes[nodes.length - 1], sub);
          for (var iNode = nodes.length - 2; iNode >= 0; --iNode) {
            elem.insertBefore(nodes[iNode], nodes[iNode+1]);
          }
        }
        else if (sub.nodeName !== 'A' || (sub.nodeName === 'A' && !sub.attributes['ext-href'])) {
          linkElem(sub);
        }
      }
    }

    linkElem(doc.body);
  },
};

/**
 * The public API exposed to the client via the MailAPI global.
 */
function MailAPI() {
  this._nextHandle = 1;

  this._slices = {};
  this._pendingRequests = {};
  this._liveBodies = {};
  /**
   * Functions to invoke to actually process/fire splices.  Exists to support
   * the fallout of waiting for contact resolution now that slice changes are
   * batched.
   */
  this._spliceFireFuncs = [];

  // Store bridgeSend messages received before back end spawns.
  this._storedSends = [];

  this._processingMessage = null;
  /**
   * List of received messages whose processing is being deferred because we
   * still have a message that is actively being processed, as stored in
   * `_processingMessage`.
   */
  this._deferredMessages = [];

  /**
   * @dict[
   *   @key[debugLogging]
   *   @key[checkInterval]
   * ]{
   *   Configuration data.  This is currently populated by data from
   *   `MailUniverse.exposeConfigForClient` by the code that constructs us.  In
   *   the future, we will probably want to ask for this from the `MailUniverse`
   *   directly over the wire.
   *
   *   This should be treated as read-only.
   * }
   */
  this.config = {};

  /**
   * @func[
   *   @args[
   *     @param[account MailAccount]
   *   ]
   * ]{
   *   A callback invoked when we fail to login to an account and the server
   *   explicitly told us the login failed and we have no reason to suspect
   *   the login was temporarily disabled.
   *
   *   The account is put in a disabled/offline state until such time as the
   *
   * }
   */
  this.onbadlogin = null;
  this.onResetAccount = null;

  ContactCache.init();
}
exports.MailAPI = MailAPI;
MailAPI.prototype = {
  toString: function() {
    return '[MailAPI]';
  },
  toJSON: function() {
    return { type: 'MailAPI' };
  },

  utils: MailUtils,

  /**
   * Send a message over/to the bridge.  The idea is that we (can) communicate
   * with the backend using only a postMessage-style JSON channel.
   */
  __bridgeSend: function(msg) {
    // This method gets clobbered eventually once back end worker is ready.
    // Until then, it will store calls to send to the back end.

    this._storedSends.push(msg);
  },

  /**
   * Process a message received from the bridge.
   */
  __bridgeReceive: function ma___bridgeReceive(msg) {
    // Pong messages are used for tests
    if (this._processingMessage && msg.type !== 'pong') {
      this._deferredMessages.push(msg);
    }
    else {
      this._processMessage(msg);
    }
  },

  _processMessage: function ma__processMessage(msg) {
    var methodName = '_recv_' + msg.type;
    if (!(methodName in this)) {
      unexpectedBridgeDataError('Unsupported message type:', msg.type);
      return;
    }
    try {
      var done = this[methodName](msg);
      if (!done) {
        this._processingMessage = msg;
      }
    }
    catch (ex) {
      internalError('Problem handling message type:', msg.type, ex,
                    '\n', ex.stack);
      return;
    }
  },

  _doneProcessingMessage: function(msg) {
    if (this._processingMessage && this._processingMessage !== msg)
      throw new Error('Mismatched message completion!');

    this._processingMessage = null;
    while (this._processingMessage === null && this._deferredMessages.length) {
      this._processMessage(this._deferredMessages.shift());
    }
  },

  _recv_badLogin: function ma__recv_badLogin(msg) {
    if (this.onbadlogin)
      this.onbadlogin(new MailAccount(this, msg.account, null),
                      msg.problem,
                      msg.whichSide);
    return true;
  },

  _recv_accountReset: function(msg) {
    if (this.onResetAccount) {
      this.onResetAccount(new MailAccount(this, msg.account, null));
    }
    return true;
  },

  _fireAllSplices: function() {
    for (var i = 0; i < this._spliceFireFuncs.length; i++) {
      var fireSpliceData = this._spliceFireFuncs[i];
      fireSpliceData();
    }

    this._spliceFireFuncs.length = 0;
  },

  _recv_batchSlice: function receiveBatchSlice(msg) {
    var slice = this._slices[msg.handle];
    if (!slice) {
      unexpectedBridgeDataError("Received message about nonexistent slice:", msg.handle);
      return true;
    }

    var updateStatus = this._updateSliceStatus(msg, slice);
    for (var i = 0; i < msg.sliceUpdates.length; i++) {
      var update = msg.sliceUpdates[i];
      if (update.type === 'update') {
        // Updates are identified by their index position, so they need to be
        // processed in the same order we're hearing about them.
        this._spliceFireFuncs.push(
          this._processSliceUpdate.bind(this, msg, update.updates, slice));
      } else {
        // Added items are transformed immediately, but the actual mutation of
        // the slice and notifications do not fire until _fireAllSplices().
        this._transformAndEnqueueSingleSplice(msg, update, slice);
      }
    }

    // If there are pending contact resolutions, we need to wait them to
    // complete before processing and firing the splices.
    if (ContactCache.pendingLookupCount) {
      ContactCache.callbacks.push(function contactsResolved() {
        this._fireAllSplices();
        this._fireStatusNotifications(updateStatus, slice);
        this._doneProcessingMessage(msg);
      }.bind(this));
      // (Wait for us to call _doneProcessingMessage before processing the next
      // message.  This also means this method will only push one callback.)
      return false;
    }

    this._fireAllSplices();
    this._fireStatusNotifications(updateStatus, slice);
    return true; // All done processing; feel free to process the next msg.
  },

  _fireStatusNotifications: function (updateStatus, slice) {
    if (updateStatus && slice.onstatus) {
      slice.onstatus(slice.status);
    }
  },

  _updateSliceStatus: function(msg, slice) {
    // - generate namespace-specific notifications
    slice.atTop = msg.atTop;
    slice.atBottom = msg.atBottom;
    slice.userCanGrowUpwards = msg.userCanGrowUpwards;
    slice.userCanGrowDownwards = msg.userCanGrowDownwards;

    // Have to update slice status before we actually do the work
    var generatedStatusChange = (msg.status &&
      (slice.status !== msg.status ||
      slice.syncProgress !== msg.progress));

    if (msg.status) {
      slice.status = msg.status;
      slice.syncProgress = msg.syncProgress;
    }

    return generatedStatusChange;
  },

  _processSliceUpdate: function (msg, splice, slice) {
    try {
      for (var i = 0; i < splice.length; i += 2) {
        var idx = splice[i], wireRep = splice[i + 1];
        var itemObj = slice.items[idx];
        if (wireRep.suid !== itemObj.id) {
          if (slice.indexOfItemById) {
            var index = slice.indexOfItemById(wireRep.suid);
            idx = (index !== -1) ? index : idx;
          }
          itemObj = slice.items[idx];
        }

        itemObj.__update(wireRep);
        if (slice.onchange) {
          slice.onchange(itemObj, idx);
        }
        if (itemObj.onchange) {
          itemObj.onchange(itemObj, idx);
        }
      }
    }
    catch (ex) {
      reportClientCodeError('onchange notification error', ex,
                            '\n', ex.stack);
    }
  },

  /**
   * Transform the slice splice (for contact-resolution side-effects) and
   * enqueue the eventual processing and firing of the splice once all contacts
   * have been resolved.
   */
  _transformAndEnqueueSingleSplice: function(msg, splice, slice) {
   var transformedItems = this._transform_sliceSplice(splice, slice);
   var fake = false;
    // It's possible that a transformed representation is depending on an async
    // call to mozContacts.  In this case, we don't want to surface the data to
    // the UI until the contacts are fully resolved in order to avoid the UI
    // flickering or just triggering reflows that could otherwise be avoided.
    // Since we could be processing multiple updates, just batch everything here
    // and we'll check later to see if any of our splices requires a contact
    // lookup
    this._spliceFireFuncs.push(function singleSpliceUpdate() {
      this._fireSplice(splice, slice, transformedItems, fake);
    }.bind(this));
  },

  /**
   * Perform the actual splice, generating notifications.
   */
  _fireSplice: function(splice, slice, transformedItems, fake) {
    var i, stopIndex, items, tempMsg;

    // - update header count, but only if the splice tracks a
    // headerCount.
    if (splice.headerCount !== undefined) {
      slice.headerCount = splice.headerCount;
    }

    // - generate slice 'onsplice' notification
    if (slice.onsplice) {
      try {
        slice.onsplice(splice.index, splice.howMany, transformedItems,
                       splice.requested, splice.moreExpected, fake);
      }
      catch (ex) {
        reportClientCodeError('onsplice notification error', ex,
                              '\n', ex.stack);
      }
    }
    // - generate item 'onremove' notifications
    if (splice.howMany) {
      try {
        stopIndex = splice.index + splice.howMany;
        for (i = splice.index; i < stopIndex; i++) {
          var item = slice.items[i];
          if (slice.onremove)
            slice.onremove(item, i);
          if (item.onremove)
            item.onremove(item, i);
          // the item needs a chance to clean up after itself.
          item.__die();
        }
      }
      catch (ex) {
        reportClientCodeError('onremove notification error', ex,
                              '\n', ex.stack);
      }
    }
    // - perform actual splice
    slice.items.splice.apply(
      slice.items,
      [splice.index, splice.howMany].concat(transformedItems));

    // - generate item 'onadd' notifications
    if (slice.onadd) {
      try {
        stopIndex = splice.index + transformedItems.length;
        for (i = splice.index; i < stopIndex; i++) {
          slice.onadd(slice.items[i], i);
        }
      }
      catch (ex) {
        reportClientCodeError('onadd notification error', ex,
                              '\n', ex.stack);
      }
    }

    // - generate 'oncomplete' notification
    if (splice.requested && !splice.moreExpected) {
      slice._growing = 0;
      if (slice.pendingRequestCount)
        slice.pendingRequestCount--;

      if (slice.oncomplete) {
        var completeFunc = slice.oncomplete;
        // reset before calling in case it wants to chain.
        slice.oncomplete = null;
        try {
          // Maybe defer here?
          completeFunc(splice.newEmailCount);
        }
        catch (ex) {
          reportClientCodeError('oncomplete notification error', ex,
                                '\n', ex.stack);
        }
      }
    }
  },

  _transform_sliceSplice: function ma__transform_sliceSplice(splice, slice) {
    var addItems = splice.addItems, transformedItems = [], i;
    switch (slice._ns) {
      case 'accounts':
        for (i = 0; i < addItems.length; i++) {
          transformedItems.push(new MailAccount(this, addItems[i], slice));
        }
        break;

      case 'identities':
        for (i = 0; i < addItems.length; i++) {
          transformedItems.push(new MailSenderIdentity(this, addItems[i]));
        }
        break;

      case 'folders':
        for (i = 0; i < addItems.length; i++) {
          transformedItems.push(new MailFolder(this, addItems[i]));
        }
        break;

      case 'headers':
        for (i = 0; i < addItems.length; i++) {
          transformedItems.push(new MailHeader(slice, addItems[i]));
        }
        break;

      case 'matchedHeaders':
        for (i = 0; i < addItems.length; i++) {
          transformedItems.push(new MailMatchedHeader(slice, addItems[i]));
        }
        break;


      default:
        console.error('Slice notification for unknown type:', slice._ns);
        break;
    }

    return transformedItems;
  },

  _recv_sliceDead: function(msg) {
    var slice = this._slices[msg.handle];
    delete this._slices[msg.handle];
    if (slice.ondead)
      slice.ondead(slice);
    slice.ondead = null;

    return true;
  },

  _getBodyForMessage: function(header, options, callback) {
    var downloadBodyReps = false, withBodyReps = false;

    if (options && options.downloadBodyReps) {
      downloadBodyReps = options.downloadBodyReps;
    }
    if (options && options.withBodyReps) {
      withBodyReps = options.withBodyReps;
    }

    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'getBody',
      suid: header.id,
      callback: callback
    };
    this.__bridgeSend({
      type: 'getBody',
      handle: handle,
      suid: header.id,
      date: header.date.valueOf(),
      downloadBodyReps: downloadBodyReps,
      withBodyReps: withBodyReps
    });
  },

  _recv_gotBody: function(msg) {
    var req = this._pendingRequests[msg.handle];
    if (!req) {
      unexpectedBridgeDataError('Bad handle for got body:', msg.handle);
      return true;
    }
    delete this._pendingRequests[msg.handle];

    var body = msg.bodyInfo ?
      new MailBody(this, req.suid, msg.bodyInfo, msg.handle) :
      null;

    if (body) {
      this._liveBodies[msg.handle] = body;
    }

    req.callback.call(null, body, req.suid);

    return true;
  },

  _recv_requestBodiesComplete: function(msg) {
    var slice = this._slices[msg.handle];
    // The slice may be dead now!
    if (slice)
      slice._notifyRequestBodiesComplete(msg.requestId);

    return true;
  },

  _recv_bodyModified: function(msg) {
    var body = this._liveBodies[msg.handle];

    if (!body) {
      unexpectedBridgeDataError('body modified for dead handle', msg.handle);
      // possible but very unlikely race condition where body is modified while
      // we are removing the reference to the observer...
      return true;
    }

    var wireRep = msg.bodyInfo;
    // We update the body representation regardless of whether there is an
    // onchange listener because the body may contain Blob handles that need to
    // be updated so that in-memory blobs that have been superseded by on-disk
    // Blobs can be garbage collected.
    body.__update(wireRep, msg.detail);

    if (body.onchange) {
      body.onchange(
        msg.detail,
        body
      );
    }

    return true;
  },

  _recv_bodyDead: function(msg) {
    var body = this._liveBodies[msg.handle];

    if (body && body.ondead) {
      body.ondead();
    }

    delete this._liveBodies[msg.handle];
    return true;
  },

  _downloadAttachments: function(body, relPartIndices, attachmentIndices,
                                 registerAttachments,
                                 callWhenDone, callOnProgress) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'downloadAttachments',
      body: body,
      relParts: relPartIndices.length > 0,
      attachments: attachmentIndices.length > 0,
      callback: callWhenDone,
      progress: callOnProgress
    };
    this.__bridgeSend({
      type: 'downloadAttachments',
      handle: handle,
      suid: body.id,
      date: body._date,
      relPartIndices: relPartIndices,
      attachmentIndices: attachmentIndices,
      registerAttachments: registerAttachments
    });
  },

  _recv_downloadedAttachments: function(msg) {
    var req = this._pendingRequests[msg.handle];
    if (!req) {
      unexpectedBridgeDataError('Bad handle for got body:', msg.handle);
      return true;
    }
    delete this._pendingRequests[msg.handle];

    // We used to update the attachment representations here.  This is now
    // handled by `bodyModified` notifications which are guaranteed to occur
    // prior to this callback being invoked.

    if (req.callback)
      req.callback.call(null, req.body);
    return true;
  },

  /**
   * Given a user's email address, try and see if we can autoconfigure the
   * account and what information we'll need to configure it, specifically
   * a password or if XOAuth2 credentials will be needed.
   *
   * @param {Object} details
   * @param {String} details.emailAddress
   *   The user's email address.
   * @param {Function} callback
   *   Invoked once we have an answer.  The object will look something like
   *   one of the following results:
   *
   *   No autoconfig information is available and the user has to do manual
   *   setup:
   *
   *     {
   *       result: 'no-config-info',
   *       configInfo: null
   *     }
   *
   *   Autoconfig information is available and to complete the autoconfig
   *   we need the user's password.  For IMAP and POP3 this means we know
   *   everything we need and can actually create the account.  For ActiveSync
   *   we actually need the password to try and perform autodiscovery.
   *
   *     {
   *       result: 'need-password',
   *       configInfo: { incoming, outgoing }
   *     }
   *
   *   Autoconfig information is available and XOAuth2 authentication should
   *   be attempted and those credentials then provided to us.
   *
   *     {
   *       result: 'need-oauth2',
   *       configInfo: {
   *         incoming,
   *         outgoing,
   *         oauth2Settings: {
   *           secretGroup: 'google' or 'microsoft' or other arbitrary string,
   *           authEndpoint: 'url to the auth endpoint',
   *           tokenEndpoint: 'url to where you ask for tokens',
   *           scope: 'space delimited list of scopes to request'
   *         }
   *       }
   *     }
   *
   *   A `source` property will also be present in the result object.  Its
   *   value will be one of: 'hardcoded', 'local', 'ispdb',
   *   'autoconfig-subdomain', 'autoconfig-wellknown', 'mx local', 'mx ispdb',
   *   'autodiscover'.
   */
  learnAboutAccount: function(details, callback) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'learnAboutAccount',
      details: details,
      callback: callback
    };
    this.__bridgeSend({
      type: 'learnAboutAccount',
      handle: handle,
      details: details
    });
  },

  _recv_learnAboutAccountResults: function(msg) {
    var req = this._pendingRequests[msg.handle];
    if (!req) {
      unexpectedBridgeDataError('Bad handle:', msg.handle);
      return true;
    }
    delete this._pendingRequests[msg.handle];

    req.callback.call(null, msg.data);
    return true;
  },

  checkAndUpdateAccount: function(emailData, callback) {
    let handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'checkAndUpdateAccount',
      data: emailData,
      callback: callback
    };
    this.__bridgeSend({
      type: 'checkAndUpdateAccount',
      handle: handle,
      data: emailData
    });
  },

  _recv_checkAndUpdateAccountResult: function(msg) {
    let req = this._pendingRequests[msg.handle];
    if (!req) {
      unexpectedBridgeDataError('Bad handle:', msg.handle);
      return true;
    }
    delete this._pendingRequests[msg.handle];

    req.callback.call(null, msg.data);
    return true;
  },

  removeDeletedAccounts: function(emailIds, bRemove, callback) {
    let handle = this._nextHandle++;
    if (bRemove === undefined) {
      bRemove = false;
    }
    this._pendingRequests[handle] = {
      type: 'removeDeletedAccounts',
      emailIds: emailIds,
      remove: bRemove,
      callback: callback
    };
    this.__bridgeSend({
      type: 'removeDeletedAccounts',
      handle: handle,
      emailIds: emailIds,
      remove: bRemove
    });
  },

  _recv_removeDeletedAccountsResult: function(msg) {
    let req = this._pendingRequests[msg.handle];
    if (!req) {
      unexpectedBridgeDataError('Bad handle:', msg.handle);
      return true;
    }
    delete this._pendingRequests[msg.handle];

    req.callback.call(null, msg.data);
    return true;
  },

  /**
   * Try to create an account.  There is currently no way to abort the process
   * of creating an account.  You really want to use learnAboutAccount before
   * you call this unless you are an automated test.
   *
   * @typedef[AccountCreationError @oneof[
   *   @case['offline']{
   *     We are offline and have no network access to try and create the
   *     account.
   *   }
   *   @case['no-dns-entry']{
   *     We couldn't find the domain name in question, full stop.
   *
   *     Not currently generated; eventually desired because it suggests a typo
   *     and so a specialized error message is useful.
   *   }
   *   @case['no-config-info']{
   *     We were unable to locate configuration information for the domain.
   *   }
   *   @case['unresponsive-server']{
   *     Requests to the server timed out.  AKA we sent packets into a black
   *     hole.
   *   }
   *   @case['port-not-listening']{
   *     Attempts to connect to the given port on the server failed.  We got
   *     packets back rejecting our connection.
   *
   *     Not currently generated; primarily desired because it is very useful if
   *     we are domain guessing.  Also desirable for error messages because it
   *     suggests a user typo or the less likely server outage.
   *   }
   *   @case['bad-security']{
   *     We were able to connect to the port and initiate TLS, but we didn't
   *     like what we found.  This could be a mismatch on the server domain,
   *     a self-signed or otherwise invalid certificate, insufficient crypto,
   *     or a vulnerable server implementation.
   *   }
   *   @case['bad-user-or-pass']{
   *     The username and password didn't check out.  We don't know which one
   *     is wrong, just that one of them is wrong.
   *   }
   *   @case['bad-address']{
   *     The e-mail address provided was rejected by the SMTP probe.
   *   }
   *   @case['pop-server-not-great']{
   *     The POP3 server doesn't support IDLE and TOP, so we can't use it.
   *   }
   *   @case['imap-disabled']{
   *     IMAP support is not enabled for the Gmail account in use.
   *   }
   *   @case['pop3-disabled']{
   *     POP3 support is not enabled for the Gmail account in use.
   *   }
   *   @case['needs-oauth-reauth']{
   *     The OAUTH refresh token was invalid, or there was some problem with
   *     the OAUTH credentials provided. The user needs to go through the
   *     OAUTH flow again.
   *   }
   *   @case['not-authorized']{
   *     The username and password are correct, but the user isn't allowed to
   *     access the mail server.
   *   }
   *   @case['server-problem']{
   *     We were able to talk to the "server" named in the details object, but
   *     we encountered some type of problem.  The details object will also
   *     include a "status" value.
   *   }
   *   @case['server-maintenance']{
   *     The server appears to be undergoing maintenance, at least for this
   *     account.  We infer this if the server is telling us that login is
   *     disabled in general or when we try and login the message provides
   *     positive indications of some type of maintenance rather than a
   *     generic error string.
   *   }
   *   @case['user-account-exists']{
   *     If the user tries to create an account which is already configured.
   *     Should not be created. We will show that account is already configured
   *   }
   *   @case['unknown']{
   *     We don't know what happened; count this as our bug for not knowing.
   *   }
   *   @case[null]{
   *     No error, the account was created and everything is terrific.
   *   }
   * ]]
   *
   * @param {Object} details
   * @param {String} details.emailAddress
   * @param {String} [details.password]
   *   The user's password
   * @param {Object} [configInfo]
   *   If continuing an autoconfig initiated by learnAboutAccount, the
   *   configInfo it returned as part of its results, although you will need
   *   to poke the following structured properties in if you're doing the oauth2
   *   thing:
   *
   *     {
   *       oauth2Tokens: { accessToken, expireTimeMS }
   *     }
   *
   *   If performing a manual config, a manually created configInfo object of
   *   the following form:
   *
   *     {
   *       incoming: { hostname, port, socketType, username, password }
   *       outgoing: { hostname, port, socketType, username, password }
   *     }
   *
   *
   *
   * @param {Function} callback
   *   The callback to invoke upon success or failure.  The callback will be
   *   called with 2 arguments in the case of failure: the error string code,
   *   and the error details object.
   *
   *
   * @args[
   *   @param[details @dict[
   *     @key[displayName String]{
   *       The name the (human, per EULA) user wants to be known to the world
   *       as.
   *     }
   *     @key[emailAddress String]
   *     @key[password String]
   *   ]]
   *   @param[callback @func[
   *     @args[
   *       @param[err AccountCreationError]
   *       @param[errDetails @dict[
   *         @key[server #:optional String]{
   *           The server we had trouble talking to.
   *         }
   *         @key[status #:optional @oneof[Number String]]{
   *           The HTTP status code number, or "timeout", or something otherwise
   *           providing detailed additional information about the error.  This
   *           is usually too technical to be presented to the user, but is
   *           worth encoding with the error name proper if possible.
   *         }
   *       ]]
   *     ]
   *   ]
   * ]
   */
  tryToCreateAccount: function ma_tryToCreateAccount(details, domainInfo,
                                                     callback) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'tryToCreateAccount',
      details: details,
      domainInfo: domainInfo,
      callback: callback
    };
    this.__bridgeSend({
      type: 'tryToCreateAccount',
      handle: handle,
      details: details,
      domainInfo: domainInfo
    });
  },

  _recv_tryToCreateAccountResults:
      function ma__recv_tryToCreateAccountResults(msg) {
    var req = this._pendingRequests[msg.handle];
    if (!req) {
      unexpectedBridgeDataError('Bad handle for create account:', msg.handle);
      return true;
    }
    delete this._pendingRequests[msg.handle];

    // We create this account to expose modifications functions to the
    // frontend before we have access to the full accounts slice.  Note that
    // we may not have an account if we failed to create the account!
    var account;
    if (msg.account) {
      account = new MailAccount(this, msg.account, null);
    }

    req.callback.call(null, msg.error, msg.errorDetails, account);
    return true;
  },

  _cancelCreation: function ma_cancelCreation(emailAddress) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'cancelCreateAccount',
      details: emailAddress
    };
    this.__bridgeSend({
      type: 'cancelCreateAccount',
      details: emailAddress,
      handle: handle
    });
  },

  _clearAccountProblems:
      function ma__clearAccountProblems(account, forceIgnore, callback) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'clearAccountProblems',
      callback: callback,
    };
    this.__bridgeSend({
      type: 'clearAccountProblems',
      accountId: account.id,
      bIgnore: forceIgnore || false,
      handle: handle,
    });
  },

  _recv_clearAccountProblems: function ma__recv_clearAccountProblems(msg) {
    var req = this._pendingRequests[msg.handle];
    delete this._pendingRequests[msg.handle];
    req.callback && req.callback();
    return true;
  },

  _modifyAccount: function ma__modifyAccount(account, mods, callback) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'modifyAccount',
      callback: callback,
    };
    this.__bridgeSend({
      type: 'modifyAccount',
      accountId: account.id,
      mods: mods,
      handle: handle
    });
  },

  _recv_modifyAccount: function(msg) {
    var req = this._pendingRequests[msg.handle];
    delete this._pendingRequests[msg.handle];
    req.callback && req.callback();
    return true;
  },

  _deleteAccount: function ma__deleteAccount(account) {
    this.__bridgeSend({
      type: 'deleteAccount',
      accountId: account.id,
    });
  },

  _modifyIdentity: function ma__modifyIdentity(identity, mods, callback) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'modifyIdentity',
      callback: callback,
    };
    this.__bridgeSend({
      type: 'modifyIdentity',
      identityId: identity.id,
      mods: mods,
      handle: handle
    });
  },

  _recv_modifyIdentity: function(msg) {
    var req = this._pendingRequests[msg.handle];
    delete this._pendingRequests[msg.handle];
    req.callback && req.callback();
    return true;
  },

  /**
   * Get the list of accounts.  This can be used for the list of accounts in
   * setttings or for a folder tree where only one account's folders are visible
   * at a time.
   *
   * @args[
   *   @param[realAccountsOnly Boolean]{
   *     Should we only list real accounts (aka not unified accounts)?  This is
   *     meaningful for the settings UI and for the move-to-folder UI where
   *     selecting a unified account's folders is useless.
   *   }
   * ]
   */
  viewAccounts: function ma_viewAccounts(realAccountsOnly) {
    var handle = this._nextHandle++,
        slice = new AccountsViewSlice(this, handle);
    this._slices[handle] = slice;

    this.__bridgeSend({
      type: 'viewAccounts',
      handle: handle,
    });
    return slice;
  },

  /**
   * Get the list of sender identities.  The identities can also be found on
   * their owning accounts via `viewAccounts`.
   */
  viewSenderIdentities: function ma_viewSenderIdentities() {
    var handle = this._nextHandle++,
        slice = new BridgedViewSlice(this, 'identities', handle);
    this._slices[handle] = slice;

    this.__bridgeSend({
      type: 'viewSenderIdentities',
      handle: handle,
    });
    return slice;
  },

  /**
   * Retrieve the entire folder hierarchy for either 'navigation' (pick what
   * folder to show the contents of, including unified folders), 'movetarget'
   * (pick target folder for moves, does not include unified folders), or
   * 'account' (only show the folders belonging to a given account, implies
   * selection).  In all cases, there may exist non-selectable folders such as
   * the account roots or IMAP folders that cannot contain messages.
   *
   * When accounts are presented as folders via this UI, they do not expose any
   * of their `MailAccount` semantics.
   *
   * @args[
   *   @param[mode @oneof['navigation' 'movetarget' 'account']
   *   @param[argument #:optional]{
   *     Arguent appropriate to the mode; currently will only be a `MailAccount`
   *     instance.
   *   }
   * ]
   */
  viewFolders: function ma_viewFolders(mode, argument) {
    var handle = this._nextHandle++,
        slice = new FoldersViewSlice(this, handle);

    this._slices[handle] = slice;

    this.__bridgeSend({
      type: 'viewFolders',
      mode: mode,
      handle: handle,
      argument: argument ? argument.id : null,
    });

    return slice;
  },

  /**
   * Retrieve a slice of the contents of a folder, starting from the most recent
   * messages.
   */
  viewFolderMessages: function ma_viewFolderMessages(folder) {
    var handle = this._nextHandle++,
        slice = new HeadersViewSlice(this, handle);
    slice.folderId = folder.id;
    // the initial population counts as a request.
    slice.pendingRequestCount++;
    this._slices[handle] = slice;

    this.__bridgeSend({
      type: 'viewFolderMessages',
      folderId: folder.id,
      handle: handle,
    });

    return slice;
  },

  /**
   * Retrieve a slice of the contents of a folder, make sure get all
   * message headers for sort.
   */
  sortFolderMessages: function(folder, fillSize) {
    var handle = this._nextHandle++,
        slice = new HeadersViewSlice(this, handle);
    // the initial population counts as a request.
    slice.pendingRequestCount++;
    this._slices[handle] = slice;

    this.__bridgeSend({
      type: 'sortFolderMessages',
      folderId: folder.id,
      handle: handle,
      fillSize: fillSize,
    });

    return slice;
  },

  /**
   * Search a folder for messages containing the given text in the sender,
   * recipients, or subject fields, as well as (optionally), the body with a
   * default time constraint so we don't entirely kill the server or us.
   *
   * @args[
   *   @param[folder]{
   *     The folder whose messages we should search.
   *   }
   *   @param[text]{
   *     The phrase to search for.  We don't split this up into words or
   *     anything like that.  We just do straight-up indexOf on the whole thing.
   *   }
   *   @param[whatToSearch @dict[
   *     @key[author #:optional Boolean]
   *     @key[recipients #:optional Boolean]
   *     @key[subject #:optional Boolean]
   *     @key[body #:optional @oneof[false 'no-quotes' 'yes-quotes']]
   *   ]]
   * ]
   */
  searchFolderMessages:
      function ma_searchFolderMessages(folder, text, whatToSearch) {
    var handle = this._nextHandle++,
        slice = new HeadersViewSlice(this, handle, 'matchedHeaders');
    // the initial population counts as a request.
    slice.pendingRequestCount++;
    this._slices[handle] = slice;

    this.__bridgeSend({
      type: 'searchFolderMessages',
      folderId: folder.id,
      handle: handle,
      phrase: text,
      whatToSearch: whatToSearch,
    });

    return slice;
  },

  //////////////////////////////////////////////////////////////////////////////
  // Batch Message Mutation
  //
  // If you want to modify a single message, you can use the methods on it
  // directly.
  //
  // All actions are undoable and return an `UndoableOperation`.

  deleteMessages: function ma_deleteMessages(messages) {
    // We allocate a handle that provides a temporary name for our undoable
    // operation until we hear back from the other side about it.
    var handle = this._nextHandle++;

    var undoableOp = new UndoableOperation(this, 'delete', messages.length,
                                           handle),
        msgSuids = messages.map(serializeMessageName);

    this._pendingRequests[handle] = {
      type: 'mutation',
      handle: handle,
      undoableOp: undoableOp
    };
    this.__bridgeSend({
      type: 'deleteMessages',
      handle: handle,
      messages: msgSuids,
    });

    return undoableOp;
  },

  // Copying messages is not required yet.
  /*
  copyMessages: function ma_copyMessages(messages, targetFolder) {
  },
  */

  moveMessages: function ma_moveMessages(messages, targetFolder, callback) {
    // We allocate a handle that provides a temporary name for our undoable
    // operation until we hear back from the other side about it.
    var handle = this._nextHandle++;

    var undoableOp = new UndoableOperation(this, 'move', messages.length,
                                           handle),
        msgSuids = messages.map(serializeMessageName);

    this._pendingRequests[handle] = {
      type: 'mutation',
      handle: handle,
      undoableOp: undoableOp,
      callback: callback
    };
    this.__bridgeSend({
      type: 'moveMessages',
      handle: handle,
      messages: msgSuids,
      targetFolder: targetFolder.id
    });

    undoableOp.target = targetFolder;
    return undoableOp;
  },

  markMessagesRead: function ma_markMessagesRead(messages, beRead) {
    return this.modifyMessageTags(messages,
                                  beRead ? ['\\Seen'] : null,
                                  beRead ? null : ['\\Seen'],
                                  beRead ? 'read' : 'unread');
  },

  markMessagesStarred: function ma_markMessagesStarred(messages, beStarred) {
    return this.modifyMessageTags(messages,
                                  beStarred ? ['\\Flagged'] : null,
                                  beStarred ? null : ['\\Flagged'],
                                  beStarred ? 'star' : 'unstar');
  },

  markMessagesReply: function ma_markMessagesReply(messages, beReply) {
    return this.modifyMessageTags(messages,
                                  beReply ? ['\\Answered'] : null,
                                  beReply ? null : ['\\Answered'],
                                  null);
  },

  markMessagesForward: function ma_markMessagesForward(messages, beForward) {
    return this.modifyMessageTags(messages,
                                  beForward ? ['\$Forwarded'] : null,
                                  beForward ? null : ['\$Forwarded'],
                                  null);
  },

  modifyMessageTags: function ma_modifyMessageTags(messages, addTags,
                                                   removeTags, _opcode) {
    // We allocate a handle that provides a temporary name for our undoable
    // operation until we hear back from the other side about it.
    var handle = this._nextHandle++;

    if (!_opcode) {
      if (addTags && addTags.length)
        _opcode = 'addtag';
      else if (removeTags && removeTags.length)
        _opcode = 'removetag';
    }
    var undoableOp = new UndoableOperation(this, _opcode, messages.length,
                                           handle),
        msgSuids = messages.map(serializeMessageName);

    this._pendingRequests[handle] = {
      type: 'mutation',
      handle: handle,
      undoableOp: undoableOp
    };
    this.__bridgeSend({
      type: 'modifyMessageTags',
      handle: handle,
      opcode: _opcode,
      addTags: addTags,
      removeTags: removeTags,
      messages: msgSuids,
    });

    return undoableOp;
  },

  /**
   * Check the outbox for pending messages, and initiate a series of
   * jobs to attempt to send them. The callback fires after the first
   * message's send attempt completes; this job will then
   * self-schedule further jobs to attempt to send the rest of the
   * outbox.
   *
   * @param {MailAccount} account
   * @param {function} callback
   *   Called after the first message's send attempt finishes.
   */
  sendOutboxMessages: function (account, callback) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'sendOutboxMessages',
      callback: callback
    };
    this.__bridgeSend({
      type: 'sendOutboxMessages',
      accountId: account.id,
      handle: handle
    });
  },

  _recv_sendOutboxMessages: function(msg) {
    var req = this._pendingRequests[msg.handle];
    delete this._pendingRequests[msg.handle];
    req.callback && req.callback();
    return true;
  },

  /**
   * Enable or disable outbox syncing for this account. This is
   * generally a temporary measure, used when the user is actively
   * editing the list of outbox messages and we don't want to
   * inadvertently move something out from under them. This change
   * does _not_ persist; it's meant to be used only for brief periods
   * of time, not as a "sync schedule" coordinator.
   */
  setOutboxSyncEnabled: function (account, enabled, callback) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'setOutboxSyncEnabled',
      callback: callback
    };
    this.__bridgeSend({
      type: 'setOutboxSyncEnabled',
      accountId: account.id,
      outboxSyncEnabled: enabled,
      handle: handle
    });
  },

  _recv_setOutboxSyncEnabled: function(msg) {
    var req = this._pendingRequests[msg.handle];
    delete this._pendingRequests[msg.handle];
    req.callback && req.callback();
    return true;
  },

  /**
   * Parse a structured email address
   * into a display name and email address parts.
   * It will return null on a parse failure.
   *
   * @param {String} email A email address.
   * @return {Object} An object of the form { name, address }.
   */
  parseMailbox: function(email) {
    try {
      var mailbox = addressparser.parse(email);
      return (mailbox.length >= 1) ? mailbox[0] : null;
    }
    catch (ex) {
      reportClientCodeError('parse mailbox error', ex,
                            '\n', ex.stack);
      return null;
    }
  },

  _recv_mutationConfirmed: function(msg) {
    var req = this._pendingRequests[msg.handle];
    if (!req) {
      unexpectedBridgeDataError('Bad handle for mutation:', msg.handle);
      return true;
    }

    req.undoableOp._tempHandle = null;
    req.undoableOp._longtermIds = msg.longtermIds;
    if (req.undoableOp._undoRequested)
      req.undoableOp.undo();

    if (req.callback) {
      req.callback(msg.result);
    }

    return true;
  },

  __undo: function undo(undoableOp) {
    this.__bridgeSend({
      type: 'undo',
      longtermIds: undoableOp._longtermIds,
    });
  },

  //////////////////////////////////////////////////////////////////////////////
  // Contact Support

  resolveEmailAddressToPeep: function(emailAddress, callback) {
    var peep = ContactCache.resolvePeep({ name: null, address: emailAddress });
    if (ContactCache.pendingLookupCount)
      ContactCache.callbacks.push(callback.bind(null, peep));
    else
      callback(peep);
  },

  //////////////////////////////////////////////////////////////////////////////
  // Message Composition

  /**
   * Begin the message composition process, creating a MessageComposition that
   * stores the current message state and periodically persists its state to the
   * backend so that the message is potentially available to other clients and
   * recoverable in the event of a local crash.
   *
   * Composition is triggered in the context of a given message and folder so
   * that the correct account and sender identity for composition can be
   * inferred.  Message may be null if there are no messages in the folder.
   * Folder is not required if a message is provided.
   *
   * @args[
   *   @param[message #:optional MailHeader]{
   *     Some message to use as context when not issuing a reply/forward.
   *   }
   *   @param[folder #:optional MailFolder]{
   *     The folder to use as context if no `message` is provided and not
   *     issuing a reply/forward.
   *   }
   *   @param[options #:optional @dict[
   *     @key[replyTo #:optional MailHeader]
   *     @key[replyMode #:optional @oneof[null 'list' 'all']]
   *     @key[forwardOf #:optional MailHeader]
   *     @key[forwardMode #:optional @oneof['inline']]
   *   ]]
   *   @param[callback #:optional Function]{
   *     The callback to invoke once the composition handle is fully populated.
   *     This is necessary because the back-end decides what identity is
   *     appropriate, handles "re:" prefixing, quoting messages, etc.
   *   }
   * ]
   */
  beginMessageComposition: function(message, folder, options, callback) {
    if (!callback)
      throw new Error('A callback must be provided; you are using the API ' +
                      'wrong if you do not.');
    if (!options)
      options = {};

    var handle = this._nextHandle++,
        composer = new MessageComposition(this, handle);

    this._pendingRequests[handle] = {
      type: 'compose',
      composer: composer,
      callback: callback,
    };
    var msg = {
      type: 'beginCompose',
      handle: handle,
      mode: null,
      submode: null,
      refSuid: null,
      refDate: null,
      refGuid: null,
      refAuthor: null,
      refSubject: null,
    };
    if (options.hasOwnProperty('replyTo') && options.replyTo) {
      msg.mode = 'reply';
      msg.submode = options.replyMode;
      msg.refSuid = options.replyTo.id;
      msg.refDate = options.replyTo.date.valueOf();
      msg.refGuid = options.replyTo.guid;
      msg.refAuthor = options.replyTo.author.toWireRep();
      msg.refSubject = options.replyTo.subject;
    }
    else if (options.hasOwnProperty('forwardOf') && options.forwardOf) {
      msg.mode = 'forward';
      msg.submode = options.forwardMode;
      msg.refSuid = options.forwardOf.id;
      msg.refDate = options.forwardOf.date.valueOf();
      msg.refGuid = options.forwardOf.guid;
      msg.refAuthor = options.forwardOf.author.toWireRep();
      msg.refSubject = options.forwardOf.subject;
    }
    else {
      msg.mode = 'new';
      if (message) {
        msg.submode = 'message';
        msg.refSuid = message.id;
      }
      else if (folder) {
        msg.submode = 'folder';
        msg.refSuid = folder.id;
      }
    }
    this.__bridgeSend(msg);
    return composer;
  },

  /**
   * Open a message as if it were a draft message (hopefully it is), returning
   * a MessageComposition object that will be asynchronously populated.  The
   * provided callback will be notified once all composition state has been
   * loaded.
   *
   * The underlying message will be replaced by other messages as the draft
   * is updated and effectively deleted once the draft is completed.  (A
   * move may be performed instead.)
   */
  resumeMessageComposition: function(message, callback) {
    if (!callback)
      throw new Error('A callback must be provided; you are using the API ' +
                      'wrong if you do not.');

    var handle = this._nextHandle++,
        composer = new MessageComposition(this, handle);

    this._pendingRequests[handle] = {
      type: 'compose',
      composer: composer,
      callback: callback,
    };

    this.__bridgeSend({
      type: 'resumeCompose',
      handle: handle,
      messageNamer: serializeMessageName(message)
    });

    return composer;
  },

  _recv_composeBegun: function(msg) {
    var req = this._pendingRequests[msg.handle];
    if (!req) {
      unexpectedBridgeDataError('Bad handle for compose begun:', msg.handle);
      return true;
    }

    req.composer.senderIdentity = new MailSenderIdentity(this, msg.identity);
    req.composer.subject = msg.subject;
    req.composer.body = msg.body; // rich obj of {text, html}
    req.composer.to = msg.to;
    req.composer.cc = msg.cc;
    req.composer.bcc = msg.bcc;
    req.composer._references = msg.referencesStr;
    req.composer.attachments = msg.attachments;
    req.composer.sendStatus = msg.sendStatus; // For displaying "Send failed".
    req.composer.sendType = msg.sendType;

    if (req.callback) {
      var callback = req.callback;
      req.callback = null;
      callback.call(null, req.composer);
    }
    return true;
  },

  _composeAttach: function(draftHandle, attachmentDef, callback) {
    if (!draftHandle) {
      return;
    }
    var draftReq = this._pendingRequests[draftHandle];
    if (!draftReq) {
      return;
    }
    var callbackHandle = this._nextHandle++;
    this._pendingRequests[callbackHandle] = {
      type: 'attachBlobToDraft',
      callback: callback
    };
    this.__bridgeSend({
      type: 'attachBlobToDraft',
      handle: callbackHandle,
      draftHandle: draftHandle,
      attachmentDef: attachmentDef
    });
  },

  _recv_attachedBlobToDraft: function(msg) {
    var callbackReq = this._pendingRequests[msg.handle];
    var draftReq = this._pendingRequests[msg.draftHandle];
    if (!callbackReq) {
      return true;
    }
    delete this._pendingRequests[msg.handle];

    if (callbackReq.callback && draftReq && draftReq.composer) {
      callbackReq.callback(msg.err, draftReq.composer);
    }
    return true;
  },

  _composeDetach: function(draftHandle, attachmentIndex, callback) {
    if (!draftHandle) {
      return;
    }
    var draftReq = this._pendingRequests[draftHandle];
    if (!draftReq) {
      return;
    }
    var callbackHandle = this._nextHandle++;
    this._pendingRequests[callbackHandle] = {
      type: 'detachAttachmentFromDraft',
      callback: callback
    };
    this.__bridgeSend({
      type: 'detachAttachmentFromDraft',
      handle: callbackHandle,
      draftHandle: draftHandle,
      attachmentIndex: attachmentIndex
    });
  },

  _recv_detachedAttachmentFromDraft: function(msg) {
    var callbackReq = this._pendingRequests[msg.handle];
    var draftReq = this._pendingRequests[msg.draftHandle];
    if (!callbackReq) {
      return true;
    }
    delete this._pendingRequests[msg.handle];

    if (callbackReq.callback && draftReq && draftReq.composer) {
      callbackReq.callback(msg.err, draftReq.composer);
    }
    return true;
  },

  _composeDone: function(handle, command, state, callback) {
    if (!handle)
      return;
    var req = this._pendingRequests[handle];
    if (!req) {
      return;
    }
    req.type = command;
    if (callback)
      req.callback = callback;
    this.__bridgeSend({
      type: 'doneCompose',
      handle: handle,
      command: command,
      state: state,
    });
  },

  _recv_doneCompose: function(msg) {
    var req = this._pendingRequests[msg.handle];
    if (!req) {
      unexpectedBridgeDataError('Bad handle for doneCompose:', msg.handle);
      return true;
    }
    req.active = null;
    // Do not cleanup on saves. Do cleanup on successful send, delete, die.
    if (req.type === 'die' || (!msg.err && (req.type !== 'save')))
      delete this._pendingRequests[msg.handle];
    if (req.callback) {
      req.callback.call(null, {
        sentDate: msg.sentDate,
        messageId: msg.messageId,
        sendStatus: msg.sendStatus
      });
      req.callback = null;
    }
    return true;
  },

  //////////////////////////////////////////////////////////////////////////////
  // mode setting for back end universe. Set interactive
  // if the user has been exposed to the UI and it is a
  // longer lived application, not just a cron sync.
  setInteractive: function() {
    this.__bridgeSend({
      type: 'setInteractive'
    });
  },

  //////////////////////////////////////////////////////////////////////////////
  // cron syncing

  /**
   * Receive events about the start and stop of periodic syncing
   */
  _recv_cronSyncStart: function ma__recv_cronSyncStart(msg) {
    if (this.oncronsyncstart)
      this.oncronsyncstart(msg.accountIds);
    return true;
  },

  _recv_cronSyncStop: function ma__recv_cronSyncStop(msg) {
    if (this.oncronsyncstop)
      this.oncronsyncstop(msg.accountsResults);
    return true;
  },

  _recv_backgroundSendStatus: function(msg) {
    if (this.onbackgroundsendstatus) {
      this.onbackgroundsendstatus(msg.data);
    }
    return true;
  },

  //////////////////////////////////////////////////////////////////////////////
  // Localization

  /**
   * Provide a list of localized strings for use in message composition.  This
   * should be a dictionary with the following values, with their expected
   * default values for English provided.  Try to avoid being clever and instead
   * just pick the same strings Thunderbird uses for these for the given locale.
   *
   * - wrote: "{{name}} wrote".  Used for the lead-in to the quoted message.
   * - originalMessage: "Original Message".  Gets put between a bunch of dashes
   *    when forwarding a message inline.
   * - forwardHeaderLabels:
   *   - subject
   *   - date
   *   - from
   *   - replyTo (for the "reply-to" header)
   *   - to
   *   - cc
   */
  useLocalizedStrings: function(strings) {
    this.__bridgeSend({
      type: 'localizedStrings',
      strings: strings
    });
    if (strings.folderNames)
      this.l10n_folder_names = strings.folderNames;
  },

  /**
   * L10n strings for folder names.  These map folder types to appropriate
   * localized strings.
   *
   * We don't remap unknown types, so this doesn't need defaults.
   */
  l10n_folder_names: {},

  l10n_folder_name: function(name, type) {
    if (this.l10n_folder_names.hasOwnProperty(type)) {
      var lowerName = name.toLowerCase();
      // Many of the names are the same as the type, but not all.
      if ((type === lowerName) ||
          (type === 'drafts') ||
          (type === 'junk') ||
          (type === 'queue'))
        return this.l10n_folder_names[type];
    }
    return name;
  },


  //////////////////////////////////////////////////////////////////////////////
  // Configuration

  /**
   * Change one-or-more backend-wide settings; use `MailAccount.modifyAccount`
   * to chang per-account settings.
   */
  modifyConfig: function(mods) {
    for (var key in mods) {
      if (LEGAL_CONFIG_KEYS.indexOf(key) === -1)
        throw new Error(key + ' is not a legal config key!');
    }
    this.__bridgeSend({
      type: 'modifyConfig',
      mods: mods
    });
  },

  _recv_config: function(msg) {
    this.config = msg.config;
    return true;
  },

  //////////////////////////////////////////////////////////////////////////////
  // Diagnostics / Test Hacks

  /**
   * After a setZeroTimeout, send a 'ping' to the bridge which will send a
   * 'pong' back, notifying the provided callback.  This is intended to be hack
   * to provide a way to ensure that some function only runs after all of the
   * notifications have been received and processed by the back-end.
   *
   * Note that ping messages are always processed as they are received; they do
   * not get deferred like other messages.
   */
  ping: function(callback) {
    var handle = this._nextHandle++;
    this._pendingRequests[handle] = {
      type: 'ping',
      callback: callback,
    };

    // With the introduction of slice batching, we now wait to send the ping.
    // This is reasonable because there are conceivable situations where the
    // caller really wants to wait until all related callbacks fire before
    // dispatching.  And the ping method is already a hack to ensure correctness
    // ordering that should be done using better/more specific methods, so this
    // change is not any less of a hack/evil, although it does cause misuse to
    // potentially be more capable of causing intermittent failures.
    window.setZeroTimeout(function() {
      this.__bridgeSend({
        type: 'ping',
        handle: handle,
      });
    }.bind(this));
  },

  _recv_pong: function(msg) {
    var req = this._pendingRequests[msg.handle];
    delete this._pendingRequests[msg.handle];
    req.callback();
    return true;
  },

  debugSupport: function(command, argument) {
    if (command === 'setLogging')
      this.config.debugLogging = argument;
    this.__bridgeSend({
      type: 'debugSupport',
      cmd: command,
      arg: argument
    });
  }

  //////////////////////////////////////////////////////////////////////////////
};

}); // end define
;
define('ext/worker-support/main-router',[],function() {
  

  var listeners = {};
  var modules = [];
  var worker = null;

  function register(module) {
    var action,
        name = module.name;

    modules.push(module);

    if (module.process) {
      action = function(msg) {
        module.process(msg.uid, msg.cmd, msg.args);
      };
    } else if (module.dispatch) {
      action = function(msg) {
        if (module.dispatch[msg.cmd]) {
          module.dispatch[msg.cmd].apply(module.dispatch, msg.args);
        }
      };
    }

    listeners[name] = action;

    module.sendMessage = function(uid, cmd, args, transferArgs) {
    //dump('\x1b[34mM => w: send: ' + name + ' ' + uid + ' ' + cmd + '\x1b[0m\n');
      //debug('onmessage: ' + name + ": " + uid + " - " + cmd);
      worker.postMessage({
        type: name,
        uid: uid,
        cmd: cmd,
        args: args
      }, transferArgs);
    };
  }

  function unregister(module) {
    delete listeners['on' + module.name];
  }

  function shutdown() {
    modules.forEach(function(module) {
      if (module.shutdown)
        module.shutdown();
    });
  }

  function useWorker(_worker) {
    worker = _worker;
    worker.onmessage = function dispatchToListener(evt) {
      var data = evt.data;
//dump('\x1b[37mM <= w: recv: '+data.type+' '+data.uid+' '+data.cmd+'\x1b[0m\n');
      var listener = listeners[data.type];
      if (listener)
        listener(data);
    };
  }

  return {
    register: register,
    unregister: unregister,
    useWorker: useWorker,
    shutdown: shutdown
  };
}); // end define
;
define('ext/worker-support/updateCredentials-main',[],function() {
  

  /**
   * Update oauth2 accounts credentials
   */
  function updateAccountCredentials(uid, cmd, accountId) {
    let postResponse = function(credentials) {
      self.sendMessage(uid, cmd, [credentials]);
    };

    navigator.accountManager.getAccounts().then((accounts) => {
      for (let account of accounts) {
        if (accountId === account.accountId) {
          let config = { refreshCredential: true };
          navigator.accountManager.getCredential(account, config).then(
            (credentials) => {
              postResponse(credentials);
            }, (error) => {
              console.log('getCredential rejected: ' + error);
              postResponse(null);
            }
          );
          break;
        }
      }
    });
  }

  let self = {
    name: 'updateCredentials',
    sendMessage: null,
    process: function(uid, cmd, args) {
      updateAccountCredentials(uid, cmd, args[0]);
    }
  };
  return self;
});

define('ext/worker-support/configparser-main',[],function() {
  

  function debug(str) {
    //dump('ConfigParser: ' + str + '\n');
  }

  function nsResolver(prefix) {
    var baseUrl = 'http://schemas.microsoft.com/exchange/autodiscover/';
    var ns = {
      rq: baseUrl + 'mobilesync/requestschema/2006',
      ad: baseUrl + 'responseschema/2006',
      ms: baseUrl + 'mobilesync/responseschema/2006',
    };
    return ns[prefix] || null;
  }

  function parseAccountCommon(uid, cmd, text) {
    var doc = new DOMParser().parseFromString(text, 'text/xml');
    var getNode = function(xpath, rel) {
      return doc.evaluate(xpath, rel || doc, null,
                          XPathResult.FIRST_ORDERED_NODE_TYPE, null)
                            .singleNodeValue;
    };

    var dictifyChildNodes = function(node) {
      if (!node) {
        return null;
      }
      var dict = {};
      for (var kid = node.firstElementChild; kid;
           kid = kid.nextElementSibling) {
        dict[kid.tagName] = kid.textContent;
      }
      return dict;
    };

    var provider = getNode('/clientConfig/emailProvider');
    // Get the first incomingServer we can use (we assume first == best).
    var incoming = getNode('incomingServer[@type="imap"] | ' +
                           'incomingServer[@type="activesync"] | ' +
                           'incomingServer[@type="pop3"]', provider);
    var outgoing = getNode('outgoingServer[@type="smtp"]', provider);
    var oauth2Settings = dictifyChildNodes(getNode('oauth2Settings', provider));

    var config = null;
    var status = null;
    if (incoming) {
      config = {
        type: null,
        incoming: {},
        outgoing: {},
        oauth2Settings: oauth2Settings
      };
      for (var iter in Iterator(incoming.children)) {
        var child = iter[1];
        config.incoming[child.tagName] = child.textContent;
      }

      if (incoming.getAttribute('type') === 'activesync') {
        config.type = 'activesync';
      } else if (outgoing) {
        var isImap = incoming.getAttribute('type') === 'imap';

        config.type = isImap ? 'imap+smtp' : 'pop3+smtp';
        for (var iter in Iterator(outgoing.children)) {
          var child = iter[1];
          config.outgoing[child.tagName] = child.textContent;
        }

        var ALLOWED_SOCKET_TYPES = ['SSL', 'STARTTLS'];

        // We do not support unencrypted connections outside of unit tests.
        if (ALLOWED_SOCKET_TYPES.indexOf(config.incoming.socketType) === -1 ||
            ALLOWED_SOCKET_TYPES.indexOf(config.outgoing.socketType) === -1) {
          config = null;
          status = 'unsafe';
        }
      } else {
        config = null;
        status = 'no-outgoing';
      }
    } else {
      status = 'no-incoming';
    }

    self.sendMessage(uid, cmd, [config, status]);
  }

  function parseActiveSyncAccount(uid, cmd, text, aNoRedirect) {
    var doc = new DOMParser().parseFromString(text, 'text/xml');

    var getNode = function(xpath, rel) {
      return doc.evaluate(xpath, rel, nsResolver,
                          XPathResult.FIRST_ORDERED_NODE_TYPE, null)
                  .singleNodeValue;
    };
    var getNodes = function(xpath, rel) {
      return doc.evaluate(xpath, rel, nsResolver,
                          XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    };
    var getString = function(xpath, rel) {
      return doc.evaluate(xpath, rel, nsResolver, XPathResult.STRING_TYPE,
                          null).stringValue;
    };

    var postResponse = function(error, config, redirectedEmail) {
      self.sendMessage(uid, cmd, [config, error, redirectedEmail]);
    };

    var error = null;
    if (doc.documentElement.tagName === 'parsererror') {
      error = 'Error parsing autodiscover response';
      return postResponse(error);
    }

    // Note: specs seem to indicate the root should be ms:Autodiscover too.
    // It's not clear why we were using ad:Autodiscover or if it ever worked,
    // but there's no meaningful cost to leave that around.
    var responseNode = getNode('/ad:Autodiscover/ms:Response', doc) ||
                       getNode('/ms:Autodiscover/ms:Response', doc);
    if (!responseNode) {
      error = 'Missing Autodiscover Response node';
      return postResponse(error);
    }

    var error = getNode('ms:Error', responseNode) ||
                getNode('ms:Action/ms:Error', responseNode);
    if (error) {
      error = getString('ms:Message/text()', error);
      return postResponse(error);
    }

    var redirect = getNode('ms:Action/ms:Redirect', responseNode);
    if (redirect) {
      if (aNoRedirect) {
        error = 'Multiple redirects occurred during autodiscovery';
        return postResponse(error);
      }

      var redirectedEmail = getString('text()', redirect);
      return postResponse(null, null, redirectedEmail);
    }

    var user = getNode('ms:User', responseNode);
    var config = {
      culture: getString('ms:Culture/text()', responseNode),
      user: {
        name:  getString('ms:DisplayName/text()',  user),
        email: getString('ms:EMailAddress/text()', user),
      },
      servers: [],
    };

    var servers = getNodes('ms:Action/ms:Settings/ms:Server', responseNode);
    var server;
    while ((server = servers.iterateNext())) {
      config.servers.push({
        type:       getString('ms:Type/text()',       server),
        url:        getString('ms:Url/text()',        server),
        name:       getString('ms:Name/text()',       server),
        serverData: getString('ms:ServerData/text()', server),
      });
    }

    // Try to find a MobileSync server from Autodiscovery.
    for (var iter in Iterator(config.servers)) {
      var server = iter[1];
      if (server.type === 'MobileSync') {
        config.mobileSyncServer = server;
        break;
      }
    }

    if (!config.mobileSyncServer) {
      error = 'No MobileSync server found';
      return postResponse(error, config);
    }

    postResponse(null, config);
  };

  var self = {
    name: 'configparser',
    sendMessage: null,
    process: function(uid, cmd, args) {
      debug('process ' + cmd);
      switch (cmd) {
        case 'accountcommon':
          parseAccountCommon(uid, cmd, args[0]);
          break;
        case 'accountactivesync':
          parseActiveSyncAccount(uid, cmd, args[0], args[1]);
          break;
      }
    }
  };
  return self;
});

/*jshint browser: true */
/*global define, console */
define('ext/worker-support/cronsync-main',['require','evt'],function(require) {
  

  var evt = require('evt');

  function debug(str) {
    console.log('cronsync-main: ' + str);
  }

  function makeData(accountIds, interval, date) {
    return {
      type: 'sync',
      accountIds: accountIds,
      interval: interval,
      timestamp: date.getTime()
    };
  }

  // Creates a string key from an array of string IDs. Uses a space
  // separator since that cannot show up in an ID.
  function makeAccountKey(accountIds) {
    return 'id' + accountIds.join(' ');
  }

  // Converts 'interval' + intervalInMillis to just a intervalInMillis
  // Number.
  var prefixLength = 'interval'.length;
  function toInterval(intervalKey) {
    return parseInt(intervalKey.substring(prefixLength), 10);
  }

  // Makes sure two arrays have the same values, account IDs.
  function hasSameValues(ary1, ary2) {
    if (ary1.length !== ary2.length) {
      return false;
    }

    var hasMismatch = ary1.some(function(item, i) {
      return item !== ary2[i];
    });

    return !hasMismatch;
  }

  function getPublicAccounts() {
    const emailSyncKey = 'emailSyncEnable';
    return new Promise(function(resolve, reject) {
      navigator.accountManager.getAccounts().then((accounts) => {
        let data = {
          accounts: accounts,
          syncSwitch: null
        };
        let settings = window.navigator.mozSettings;
        settings.createLock().get(emailSyncKey).then((result) => {
          if (result[emailSyncKey]) {
            data.syncSwitch = result[emailSyncKey];
          }
          resolve(data);
        });
      }, (reason) => {
        reject(reason);
      });
    });
  }

  var dispatcher = {
    _routeReady: false,
    _routeQueue: [],
    _sendMessage: function(type, args) {
      if (this._routeReady) {
        // sendMessage is added to routeRegistration by the main-router module.
        routeRegistration.sendMessage(null, type, args);
      } else {
        this._routeQueue.push([type, args]);
      }
    },

    /**
     * Called by worker side to indicate it can now receive messages.
     */
    hello: function() {
      this._routeReady = true;
      if (this._routeQueue.length) {
        var queue = this._routeQueue;
        this._routeQueue = [];
        queue.forEach(function(args) {
          this._sendMessage(args[0], args[1]);
        }.bind(this));
      }
    },

    /**
     * Clears all sync-based alarms. Normally not called, except perhaps for
     * tests or debugging.
     */
    clearAll: function() {
      var mozAlarms = navigator.mozAlarms;
      if (!mozAlarms) {
        return;
      }

      var r = mozAlarms.getAll();

      r.onsuccess = function(event) {
        var alarms = event.target.result;
        if (!alarms) {
          return;
        }

        alarms.forEach(function(alarm) {
          if (alarm.data && alarm.data.type === 'sync') {
            mozAlarms.remove(alarm.id);
          }
        });
      }.bind(this);
      r.onerror = function(err) {
        console.error('cronsync-main clearAll mozAlarms.getAll: error: ' +
                      err);
      }.bind(this);
    },

    /**
     * Makes sure there is an alarm set for every account in the list.
     * @param  {Object} syncData. An object with keys that are 'interval' +
     * intervalInMilliseconds, and values are arrays of account IDs that should
     * be synced at that interval.
     */
    ensureSync: function (syncData) {

      var mozAlarms = navigator.mozAlarms;
      if (!mozAlarms) {
        console.warn('no mozAlarms support!');
        return;
      }

      debug('ensureSync called');

      var request = mozAlarms.getAll();

      request.onsuccess = function(event) {
        debug('success!');

        var alarms = event.target.result;
        // If there are no alarms a falsey value may be returned.  We want
        // to not die and also make sure to signal we completed, so just make
        // an empty list.
        if (!alarms) {
          alarms = [];
        }

        // Find all IDs being tracked by alarms
        var expiredAlarmIds = [],
            okAlarmIntervals = {},
            uniqueAlarms = {};

        alarms.forEach(function(alarm) {
          // Only care about sync alarms.
          if (!alarm.data || !alarm.data.type || alarm.data.type !== 'sync') {
            return;
          }

          var intervalKey = 'interval' + alarm.data.interval,
              wantedAccountIds = syncData[intervalKey];

          if (!wantedAccountIds || !hasSameValues(wantedAccountIds,
                                                  alarm.data.accountIds)) {
            debug('account array mismatch, canceling existing alarm');
            expiredAlarmIds.push(alarm.id);
          } else {
            // Confirm the existing alarm is still good.
            var interval = toInterval(intervalKey),
                now = Date.now(),
                alarmTime = alarm.data.timestamp,
                accountKey = makeAccountKey(wantedAccountIds);

            // If the interval is nonzero, and there is no other alarm found
            // for that account combo, and if it is not in the past and if it
            // is not too far in the future, it is OK to keep.
            if (interval && !uniqueAlarms.hasOwnProperty(accountKey) &&
                alarmTime > now && alarmTime < now + interval) {
              debug('existing alarm is OK: ' + accountKey);
              uniqueAlarms[accountKey] = true;
              okAlarmIntervals[intervalKey] = true;
            } else {
              debug('existing alarm is out of interval range, canceling');
              expiredAlarmIds.push(alarm.id);
            }
          }
        });

        expiredAlarmIds.forEach(function(alarmId) {
          mozAlarms.remove(alarmId);
        });

        var alarmMax = 0,
            alarmCount = 0,
            self = this;

        // Called when alarms are confirmed to be set.
        function done() {
          alarmCount += 1;
          if (alarmCount < alarmMax) {
            return;
          }

          debug('ensureSync completed');
          // Indicate ensureSync has completed because the
          // back end is waiting to hear alarm was set before
          // triggering sync complete.
          self._sendMessage('syncEnsured');
        }

        Object.keys(syncData).forEach(function(intervalKey) {
          // Skip if the existing alarm is already good.
          if (okAlarmIntervals.hasOwnProperty(intervalKey)) {
            return;
          }

          var interval = toInterval(intervalKey),
              accountIds = syncData[intervalKey],
              date = new Date(Date.now() + interval);

          // Do not set an timer for a 0 interval, bad things happen.
          if (!interval) {
            return;
          }

          alarmMax += 1;

          var alarmRequest = mozAlarms.add(date, 'ignoreTimezone',
                                       makeData(accountIds, interval, date));

          alarmRequest.onsuccess = function() {
            debug('success: mozAlarms.add for ' + 'IDs: ' + accountIds +
                  ' at ' + interval + 'ms');
            done();
          };

          alarmRequest.onerror = function(err) {
            console.error('cronsync-main mozAlarms.add for IDs: ' +
                          accountIds +
                          ' failed: ' + err);
          };
        });

        // If no alarms were added, indicate ensureSync is done.
        if (!alarmMax) {
          done();
        }
      }.bind(this);

      request.onerror = function(err) {
        console.error('cronsync-main ensureSync mozAlarms.getAll: error: ' +
                      err);
      };
    }
  };

  if (navigator.mozSetMessageHandler) {
    navigator.mozSetMessageHandler('alarm', function onAlarm(alarm) {
      console.log('mozSetMessageHandler: received an alarm');

      // Important for gaia email app to know when a mozSetMessageHandler has
      // been dispatched. Could be removed if notification close events did not
      // open the email app, or if we wanted to be less efficient on closing
      // down the email app on those events. Although the email app would not be
      // a good memory citizen in that case.
      if (window.hasOwnProperty('appDispatchedMessage')) {
        window.appDispatchedMessage = true;
      }

      // Do not bother with alarms that are not sync alarms.
      var data = alarm.data;
      if (!data || data.type !== 'sync') {
        return;
      }

      // Need to acquire the wake locks during this notification
      // turn of the event loop -- later turns are not guaranteed to
      // be up and running. However, knowing when to release the locks
      // is only known to the front end, so publish event about it.
      // Need a CPU lock since otherwise the app can be paused
      // mid-function, which could lead to unexpected behavior, and the
      // sync should be completed as quick as possible to then close
      // down the app.
      // TODO: removed wifi wake lock due to network complications, to
      // be addressed in a separate changset.
      if (navigator.requestWakeLock) {
        var locks = [
          navigator.requestWakeLock('cpu')
        ];

        debug('wake locks acquired: ' + locks +
              ' for account IDs: ' + data.accountIds);

        evt.emitWhenListener('cronSyncWakeLocks',
                             makeAccountKey(data.accountIds), locks);
      }

      debug('alarm dispatch started at ' + (new Date()));

      getPublicAccounts().then((accountsData) => {
        dispatcher._sendMessage('alarm',
            [data.accountIds, accountsData, data.interval]);
      });
    });
  }

  var routeRegistration = {
    name: 'cronsync',
    sendMessage: null,
    dispatch: dispatcher
  };

  return routeRegistration;
});

/**
 * This file runs on the main thread, receiving messages sent from a
 * GetDeviceInfo instance -> through the router -> to this file.
 */
define('ext/worker-support/deviceInfo-main',[],function() {
  

  // default get SIM slot 0 info
  let connection;
  if (navigator.mozMobileConnections) {
    connection = navigator.mozMobileConnections[0];
  }

  function debug(str) {
    console.log('DeviceInfo: ' + str + '\n');
  }

  function getDeviceInfoError(str) {
    return 'Get device info:' + str + ' error!';
  }

  function getIMEI() {
    return new Promise(function(resolve, reject) {
      if (!connection) {
        reject('No mozMobileConnections!');
      }
      let request = connection.getDeviceIdentities();
      request.onsuccess = function() {
        let value = request.result.imei;
        resolve(value);
      };
      request.onerror = function() {
        console.error('Could not retrieve the IMEI code!');
        resolve();
      };
    });
  }

  function getPhoneNumber() {
    let msisdn = null;
    if (connection) {
      let iccId = connection.iccId;
      if (iccId) {
        let iccInfo = navigator.mozIccManager.getIccById(iccId);
        msisdn = iccInfo.msisdn || iccInfo.mdn;
      }
    }
    return msisdn;
  }

  function getOperatorName() {
    let operatorName = null;
    if (connection && connection.data && connection.data.network) {
      operatorName = connection.data.network.longName;
    }
    return operatorName;
  }

  function getSettings(key) {
    let settings = navigator.mozSettings;

    return new Promise(function(resolve, reject) {
      if (!settings) {
        reject('No mozSettings!!!');
      }
      let request = settings.createLock().get(key);
      request.onsuccess = function() {
        let value = request.result[key];
        resolve(value);
      };
      request.onerror = function() {
        console.error('Could not get settings value : ' + key);
        resolve();
      };
    });
  }

  /**
   * Get the device Info,
   * deviceInfo: {deciveType, imei, phoneNumber, deciveName, modelName,
   *              OSName, OSLanguage, operatorName}
   */
  function getDeviceInfo(uid, cmd) {
    // given some default values for deviceInfo
    let deviceInfo = {
      deviceType: 'KaiOS',
      imei: '000000000000000',
      phoneNumber: '',
      deviceName: 'KaiDevice',
      modelName: 'KaiOS',
      OSName: 'KaiOS',
      OSLanguage: 'en-US',
      operatorName: ''
    };
    let postResponse = function(error, deviceInfo) {
      self.sendMessage(uid, cmd, [deviceInfo, error]);
    };

    let deviceNameKey = 'deviceinfo.product_device';
    let modelNamekey = 'deviceinfo.product_model';
    let languageKey = 'language.current';

    // get device name , model name and OS Language
    getSettings(deviceNameKey).then((value) => {
      if (value) {
        deviceInfo.deviceName = value;
      }
      getSettings(modelNamekey).then((value) => {
        if (value) {
          deviceInfo.modelName = value;
        }
        getSettings(languageKey).then((value) => {
          if (value) {
            deviceInfo.OSLanguage = value;
          }
          // get IMEI
          getIMEI().then((value) => {
            if (value) {
              deviceInfo.imei = value;
            } else {
              return postResponse(getDeviceInfoError('IMEI'));
            }
            // get phone number and operator name
            let number = getPhoneNumber();
            let operatorName = getOperatorName();
            if (number) {
              deviceInfo.phoneNumber = number;
            }
            if (operatorName) {
              deviceInfo.operatorName = operatorName;
            }
            debug(JSON.stringify(deviceInfo));
            postResponse(null, deviceInfo);
          });
        });
      });
    });
  }

  // factory reset
  function factoryReset() {
    debug('factory reset!!!');
    let power = navigator.mozPower;
    if (!power) {
      console.error('Cannot get mozPower');
      return;
    }

    if (!power.factoryReset) {
      console.error('Cannot invoke mozPower.factoryReset()');
      return;
    }

    power.factoryReset();
  }

  let self = {
    name: 'deviceInfo',
    sendMessage: null,
    process: function(uid, cmd) {
      switch (cmd) {
        case 'get':
          getDeviceInfo(uid, cmd);
          break;
        case 'reset':
          factoryReset();
          break;
      }
    }
  };
  return self;
});
define('ext/worker-support/devicestorage-main',[],function() {
  

  function debug(str) {
    dump('DeviceStorage: ' + str + '\n');
  }


  function save(uid, cmd, storage, blob, filename, registerDownload) {
    // For the download manager, we want to avoid the composite storage
    var deviceStorage = navigator.getDeviceStorage(storage);

    if (!deviceStorage) {
      self.sendMessage(uid, cmd, [false, 'no-device-storage', null, false]);
      return;
    }

    if (filename.indexOf('\r\n') > 0) {
      filename = filename.replace('\r\n', '');
    }

    filename = filename.replace(/[\s#&?<>\$]/g, '');

    filename = 'downloads/' + filename;

    var req = deviceStorage.addNamed(blob, filename);

    req.onerror = function() {
      self.sendMessage(uid, cmd, [false, req.error.name, null, false]);
    };

    req.onsuccess = function(e) {
      var prefix = '';

      if (typeof window.IS_GELAM_TEST !== 'undefined') {
        prefix = 'TEST_PREFIX/';
      }

      var savedPath = prefix + e.target.result;

      var registering = false;
      if (registerDownload) {
        var downloadManager = navigator.mozDownloadManager;
        console.warn('have downloadManager?', !!downloadManager,
                      'have adoptDownload?', downloadManager && !!downloadManager.adoptDownload);
        if (downloadManager && downloadManager.adoptDownload) {
          try {
            var fullPath = e.target.result;
            var firstSlash = fullPath.indexOf('/', 2); // ignore leading /
            var storageName = fullPath.substring(1, firstSlash); // eat 1st /
            var storagePath = fullPath.substring(firstSlash + 1);
            console.log('adopting download', deviceStorage.storageName,
                        e.target.result);
            registering = true;
            downloadManager.adoptDownload({
              totalBytes: blob.size,
              // There's no useful URL we can provide; anything would be an
              // internal URI scheme that we can't service.
              url: '',
              storageName: storageName,
              storagePath: storagePath,
              contentType: blob.type,
              // The time we started isn't inherently interesting given that the
              // entirety of the file appears instantaneously to the download
              // manager, now is good enough.
              startTime: new Date(Date.now()),
            }).then(function() {
              console.log('registered download with download manager');
              self.sendMessage(uid, cmd, [true, null, savedPath, true]);
            }, function() {
              console.warn('failed to register download with download manager');
              self.sendMessage(uid, cmd, [true, null, savedPath, false]);
            });
          } catch (ex) {
            console.error('Problem adopting download!:', ex, '\n', ex.stack);
          }
        } else {
          console.log('download manager not available, not registering.');
        }
      } else {
        console.log('do not want to register download');
      }

      // Bool success, String err, String filename
      if (!registering) {
        self.sendMessage(uid, cmd, [true, null, savedPath, false]);
      }
    };
  }

  var self = {
    name: 'devicestorage',
    sendMessage: null,
    process: function(uid, cmd, args) {
      debug('process ' + cmd);
      switch (cmd) {
        case 'save':
          save(uid, cmd, args[0], args[1], args[2], args[3]);
          break;
      }
    }
  };
  return self;
});

define('ext/worker-support/maildb-main',[],function() {


  function debug(str) {
    dump('MailDB: ' + str + '\n');
  }

  var db = null;
  function open(uid, cmd, args) {
    db = self._debugDB = new MailDB(args[0], function() {
      self.sendMessage(uid, cmd, Array.prototype.slice.call(arguments));
    });
  }

  function others(uid, cmd, args) {
    if (!Array.isArray(args))
      args = [];
    args.push(function() {
      self.sendMessage(uid, cmd, Array.prototype.slice.call(arguments));
    });
    if (!db._db)
      console.warn('trying to call', cmd, 'on apparently dead db. skipping.');
    else
      db[cmd].apply(db, args);
  }

  var self = {
    name: 'maildb',
    sendMessage: null,
    process: function(uid, cmd, args) {
      switch (cmd) {
        case 'open':
          open(uid, cmd, args);
          break;
        default:
          others(uid, cmd, args);
          break;
      }
    },
    _debugDB: null
  };

var IndexedDB;
if (("indexedDB" in window) && window.indexedDB) {
  IndexedDB = window.indexedDB;
} else if (("mozIndexedDB" in window) && window.mozIndexedDB) {
  IndexedDB = window.mozIndexedDB;
} else if (("webkitIndexedDB" in window) && window.webkitIndexedDB) {
  IndexedDB = window.webkitIndexedDB;
} else {
  console.error("No IndexedDB!");
  throw new Error("I need IndexedDB; load me in a content page universe!");
}

/**
 * The current database version.
 *
 * Explanation of most recent bump:
 *
 * Bumping to 22 because of account changes around cronsyncing, an "undefined"
 * error with summaries and some constant changes.
 *
 * Bumping to 21 because of massive error in partial fetching merges.
 *
 * Bumping to 20 because of block sizing changes.
 *
 * Bumping to 19 because of change from uids to ids, but mainly because we are
 * now doing parallel IMAP fetching and we want to see the results of using it
 * immediately.
 *
 * Bumping to 18 because of massive change for lazily fetching snippets and
 * message bodies.
 *
 * Bumping to 17 because we changed the folder representation to store
 * hierarchy.
 */
var CUR_VERSION = 22;

/**
 * What is the lowest database version that we are capable of performing a
 * friendly-but-lazy upgrade where we nuke the database but re-create the user's
 * accounts?  Set this to the CUR_VERSION if we can't.
 *
 * Note that this type of upgrade can still be EXTREMELY DANGEROUS because it
 * may blow away user actions that haven't hit a server yet.
 */
var FRIENDLY_LAZY_DB_UPGRADE_VERSION = 5;

/**
 * The configuration table contains configuration data that should persist
 * despite implementation changes. Global configuration data, and account login
 * info.  Things that would be annoying for us to have to re-type.
 */
var TBL_CONFIG = 'config',
      CONFIG_KEY_ROOT = 'config',
      // key: accountDef:`AccountId`
      CONFIG_KEYPREFIX_ACCOUNT_DEF = 'accountDef:';

/**
 * The folder-info table stores meta-data about the known folders for each
 * account.  This information may be blown away on upgrade.
 *
 * While we may eventually stash info like histograms of messages by date in
 * a folder, for now this is all about serving as a directory service for the
 * header and body blocks.  See `ImapFolderStorage` for the details of the
 * payload.
 *
 * All the folder info for each account is stored in a single object since we
 * keep it all in-memory for now.
 *
 * key: `AccountId`
 */
var TBL_FOLDER_INFO = 'folderInfo';

/**
 * Stores time-clustered information about messages in folders.  Message bodies
 * and attachment names are not included, but initial snippets and the presence
 * of attachments are.
 *
 * We store headers separately from bodies because our access patterns are
 * different for each.  When we want headers, all we want is headers, and don't
 * need the bodies clogging up our IO.  Additionally, we expect better
 * compression for bodies if they are stored together.
 *
 * key: `FolderId`:`BlockId`
 *
 * Each value is an object dictionary whose keys are either UIDs or a more
 * globally unique identifier (ex: gmail's X-GM-MSGID values).  The values are
 * the info on the message; see `ImapFolderStorage` for details.
 */
var TBL_HEADER_BLOCKS = 'headerBlocks';
/**
 * Stores time-clustered information about message bodies.  Body details include
 * the list of attachments, as well as the body payloads and the embedded inline
 * parts if they all met the sync heuristics.  (If we can't sync all the inline
 * images, for example, we won't sync any.)
 *
 * Note that body blocks are not paired with header blocks; their storage is
 * completely separate.
 *
 * key: `FolderId`:`BlockId`
 *
 * Each value is an object dictionary whose keys are either UIDs or a more
 * globally unique identifier (ex: gmail's X-GM-MSGID values).  The values are
 * the info on the message; see `ImapFolderStorage` for details.
 */
var TBL_BODY_BLOCKS = 'bodyBlocks';

/**
 * DB helper methods for Gecko's IndexedDB implementation.  We are assuming
 * the presence of the Mozilla-specific mozGetAll helper right now.  Since our
 * app is also dependent on the existence of the TCP API that no one else
 * supports right now and we are assuming a SQLite-based IndexedDB
 * implementation, this does not seem too crazy.
 *
 * == Useful tidbits on our IndexedDB implementation
 *
 * - SQLite page size is 32k
 * - The data persisted to the database (but not Blobs AFAICS) gets compressed
 *   using snappy on a per-value basis.
 * - Blobs/files are stored as files on the file-system that are referenced by
 *   the data row.  Since they are written in one go, they are highly unlikely
 *   to be fragmented.
 * - Blobs/files are clever once persisted.  Specifically, nsDOMFileFile
 *   instances are created with just the knowledge of the file-path.  This means
 *   the data does not have to be marshaled, and it means that it can be
 *   streamed off the disk.  This is primarily beneficial in that if there is
 *   data we don't need to mutate, we can feed it directly to the web browser
 *   engine without potentially creating JS string garbage.
 *
 * Given the page size and snappy compression, we probably only want to spill to
 * a blob for non-binary data that exceeds 64k by a fair margin, and less
 * compressible binary data that is at least 64k.
 *
 * @args[
 *   @param[testOptions #:optional @dict[
 *     @key[dbVersion #:optional Number]{
 *       Override the database version to treat as the database version to use.
 *       This is intended to let us do simple database migration testing by
 *       creating the database with an old version number, then re-open it
 *       with the current version and seeing a migration happen.  To test
 *       more authentic migrations when things get more complex, we will
 *       probably want to persist JSON blobs to disk of actual older versions
 *       and then pass that in to populate the database.
 *     }
 *     @key[nukeDb #:optional Boolean]{
 *       Compel ourselves to nuke the previous database state and start from
 *       scratch.  This only has an effect when IndexedDB has fired an
 *       onupgradeneeded event.
 *     }
 *   ]]
 * ]
 */
let count = 3;
function MailDB(testOptions, successCb, errorCb, upgradeCb) {
  this._db = null;

  this._lazyConfigCarryover = null;

  /**
   * Fatal error handler.  This gets to be the error handler for all unexpected
   * error cases.
   */
  this._fatalError = function(event) {
    function explainSource(source) {
      if (!source)
        return 'unknown source';
      if (source instanceof IDBObjectStore)
        return 'object store "' + source.name + '"';
      if (source instanceof IDBIndex)
        return 'index "' + source.name + '" on object store "' +
          source.objectStore.name + '"';
      if (source instanceof IDBCursor)
        return 'cursor on ' + explainSource(source.source);
      return 'unexpected source';
    }
    var explainedSource, target = event.target;
    if (target instanceof IDBTransaction) {
      explainedSource = 'transaction (' + target.mode + ')';
    }
    else if (target instanceof IDBRequest) {
      explainedSource = 'request as part of ' +
        (target.transaction ? target.transaction.mode : 'NO') +
        ' transaction on ' + explainSource(target.source);
    }
    else { // dunno, ask it to stringify itself.
      explainedSource = target.toString();
    }
    console.error('indexedDB error:', target.error.name, 'from',
                  explainedSource);

    if ('QuotaExceededError' === target.error.name) {
      if (!localStorage.getItem('data_has_account')) {
        window.close();
      }
    }
  };

  var dbVersion = CUR_VERSION;
  if (testOptions && testOptions.dbDelta)
    dbVersion += testOptions.dbDelta;
  if (testOptions && testOptions.dbVersion)
    dbVersion = testOptions.dbVersion;
  var openRequest = IndexedDB.open('b2g-email', dbVersion), self = this;
  openRequest.onsuccess = function(event) {
    self._db = openRequest.result;
    if (self._db.objectStoreNames.contains(TBL_CONFIG)) {
      successCb();
    } else {
      if (count--) {
        self._db.close();
        self._db = null;
        IndexedDB.deleteDatabase('b2g-email');
        MailDB.call(self, testOptions, successCb, errorCb, upgradeCb);
      }
    }
  };
  openRequest.onupgradeneeded = function(event) {
    console.log('MailDB in onupgradeneeded');
    var db = openRequest.result;

    // - reset to clean slate
    if ((event.oldVersion < FRIENDLY_LAZY_DB_UPGRADE_VERSION) ||
        (testOptions && testOptions.nukeDb)) {
      self._nukeDB(db);
    }
    // - friendly, lazy upgrade
    else {
      var trans = openRequest.transaction;
      // Load the current config, save it off so getConfig can use it, then nuke
      // like usual.  This is obviously a potentially data-lossy approach to
      // things; but this is a 'lazy' / best-effort approach to make us more
      // willing to bump revs during development, not the holy grail.
      self.getConfig(function(configObj, accountInfos) {
        if (configObj)
          self._lazyConfigCarryover = {
            oldVersion: event.oldVersion,
            config: configObj,
            accountInfos: accountInfos
          };
        self._nukeDB(db);
      }, trans);
    }
  };
  openRequest.onerror = this._fatalError;
}

MailDB.prototype = {
  /**
   * Reset the contents of the database.
   */
  _nukeDB: function(db) {
    var existingNames = db.objectStoreNames;
    for (var i = 0; i < existingNames.length; i++) {
      db.deleteObjectStore(existingNames[i]);
    }

    db.createObjectStore(TBL_CONFIG);
    db.createObjectStore(TBL_FOLDER_INFO);
    db.createObjectStore(TBL_HEADER_BLOCKS);
    db.createObjectStore(TBL_BODY_BLOCKS);
  },

  close: function() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  },

  getConfig: function(callback, trans) {
    var transaction = trans ||
                      this._db.transaction([TBL_CONFIG, TBL_FOLDER_INFO],
                                           'readonly');
    var configStore = transaction.objectStore(TBL_CONFIG),
        folderInfoStore = transaction.objectStore(TBL_FOLDER_INFO);

    // these will fire sequentially
    var configReq = configStore.mozGetAll(),
        folderInfoReq = folderInfoStore.mozGetAll();

    configReq.onerror = this._fatalError;
    // no need to track success, we can read it off folderInfoReq
    folderInfoReq.onerror = this._fatalError;
    var self = this;
    folderInfoReq.onsuccess = function(event) {
      var configObj = null, accounts = [], i, obj;

      // - Check for lazy carryover.
      // IndexedDB provides us with a strong ordering guarantee that this is
      // happening after any upgrade check.  Doing it outside this closure would
      // be race-prone/reliably fail.
      if (self._lazyConfigCarryover) {
        var lazyCarryover = self._lazyConfigCarryover;
        self._lazyConfigCarryover = null;
        callback(configObj, accounts, lazyCarryover);
        return;
      }

      // - Process the results
      for (i = 0; i < configReq.result.length; i++) {
        obj = configReq.result[i];
        if (obj.id === 'config')
          configObj = obj;
        else
          accounts.push({def: obj, folderInfo: null});
      }
      for (i = 0; i < folderInfoReq.result.length; i++) {
        accounts[i].folderInfo = folderInfoReq.result[i];
      }

      try {
        callback(configObj, accounts);
      }
      catch(ex) {
        console.error('Problem in configCallback', ex, '\n', ex.stack);
      }
    };
  },

  saveConfig: function(config) {
    var req = this._db.transaction(TBL_CONFIG, 'readwrite')
                        .objectStore(TBL_CONFIG)
                        .put(config, 'config');
    req.onerror = this._fatalError;
  },

  /**
   * Save the addition of a new account or when changing account settings.  Only
   * pass `folderInfo` for the new account case; omit it for changing settings
   * so it doesn't get updated.  For coherency reasons it should only be updated
   * using saveAccountFolderStates.
   */
  saveAccountDef: function(config, accountDef, folderInfo, callback) {
    var trans = this._db.transaction([TBL_CONFIG, TBL_FOLDER_INFO],
                                     'readwrite');

    var configStore = trans.objectStore(TBL_CONFIG);
    configStore.put(config, 'config');
    configStore.put(accountDef, CONFIG_KEYPREFIX_ACCOUNT_DEF + accountDef.id);
    if (folderInfo) {
      trans.objectStore(TBL_FOLDER_INFO)
           .put(folderInfo, accountDef.id);
    }
    trans.onerror = this._fatalError;
    if (callback) {
      trans.oncomplete = function() {
        callback();
      };
    }
  },

  loadHeaderBlock: function(folderId, blockId, callback) {
    var req = this._db.transaction(TBL_HEADER_BLOCKS, 'readonly')
                         .objectStore(TBL_HEADER_BLOCKS)
                         .get(folderId + ':' + blockId);
    req.onerror = this._fatalError;
    req.onsuccess = function() {
      callback(req.result);
    };
  },

  loadBodyBlock: function(folderId, blockId, callback) {
    var req = this._db.transaction(TBL_BODY_BLOCKS, 'readonly')
                         .objectStore(TBL_BODY_BLOCKS)
                         .get(folderId + ':' + blockId);
    req.onerror = this._fatalError;
    req.onsuccess = function() {
      callback(req.result);
    };
  },

  /**
   * Coherently update the state of the folderInfo for an account plus all dirty
   * blocks at once in a single (IndexedDB and SQLite) commit. If we broke
   * folderInfo out into separate keys, we could do this on a per-folder basis
   * instead of per-account.  Revisit if performance data shows stupidity.
   *
   * @args[
   *   @param[accountId]
   *   @param[folderInfo]
   *   @param[perFolderStuff @listof[@dict[
   *     @key[id FolderId]
   *     @key[headerBlocks @dictof[@key[BlockId] @value[HeaderBlock]]]
   *     @key[bodyBlocks @dictof[@key[BlockID] @value[BodyBlock]]]
   *   ]]]
   * ]
   */
  saveAccountFolderStates: function(accountId, folderInfo, perFolderStuff,
                                    deletedFolderIds, callback) {
    var trans = this._db.transaction([TBL_FOLDER_INFO, TBL_HEADER_BLOCKS,
                                      TBL_BODY_BLOCKS], 'readwrite');
    trans.onerror = this._fatalError;
    trans.objectStore(TBL_FOLDER_INFO).put(folderInfo, accountId);

    var headerStore = trans.objectStore(TBL_HEADER_BLOCKS),
        bodyStore = trans.objectStore(TBL_BODY_BLOCKS),
        i;

    /**
     * Calling put/delete on operations can be fairly expensive for these blocks
     * (4-10ms+) which can cause major jerk while scrolling to we send block
     * operations individually (but inside of a single block) to improve
     * responsiveness at the cost of throughput.
     */
    var operationQueue = [];

    function addToQueue() {
      var args = Array.slice(arguments);
      var store = args.shift();
      var type = args.shift();

      operationQueue.push({
        store: store,
        type: type,
        args: args
      });
    }

    function workQueue() {
      var pendingRequest = operationQueue.shift();

      // no more the transition complete handles the callback
      if (!pendingRequest)
        return;

      var store = pendingRequest.store;
      var type = pendingRequest.type;

      var request = store[type].apply(store, pendingRequest.args);

      request.onsuccess = request.onerror = workQueue;
    }

    for (i = 0; i < perFolderStuff.length; i++) {
      var pfs = perFolderStuff[i], block;

      for (var headerBlockId in pfs.headerBlocks) {
        block = pfs.headerBlocks[headerBlockId];
        if (block)
          addToQueue(headerStore, 'put', block, pfs.id + ':' + headerBlockId);
        else
          addToQueue(headerStore, 'delete', pfs.id + ':' + headerBlockId);
      }

      for (var bodyBlockId in pfs.bodyBlocks) {
        block = pfs.bodyBlocks[bodyBlockId];
        if (block)
          addToQueue(bodyStore, 'put', block, pfs.id + ':' + bodyBlockId);
        else
          addToQueue(bodyStore, 'delete', pfs.id + ':' + bodyBlockId);
      }
    }

    if (deletedFolderIds) {
      for (i = 0; i < deletedFolderIds.length; i++) {
        var folderId = deletedFolderIds[i],
            range = IDBKeyRange.bound(folderId + ':',
                                      folderId + ':\ufff0',
                                      false, false);
        addToQueue(headerStore, 'delete', range);
        addToQueue(bodyStore, 'delete', range);
      }
    }

    if (callback) {
      trans.addEventListener('complete', function() {
        callback();
      });
    }

    workQueue();

    return trans;
  },

  /**
   * Delete all traces of an account from the database.
   */
  deleteAccount: function(accountId) {
    var trans = this._db.transaction([TBL_CONFIG, TBL_FOLDER_INFO,
                                      TBL_HEADER_BLOCKS, TBL_BODY_BLOCKS],
                                      'readwrite');
    trans.onerror = this._fatalError;

    trans.objectStore(TBL_CONFIG).delete('accountDef:' + accountId);
    trans.objectStore(TBL_FOLDER_INFO).delete(accountId);
    var range = IDBKeyRange.bound(accountId + '/',
                                  accountId + '/\ufff0',
                                  false, false);
    trans.objectStore(TBL_HEADER_BLOCKS).delete(range);
    trans.objectStore(TBL_BODY_BLOCKS).delete(range);
  },
};

return self;
});

define(
  'ext/async_blob_fetcher',[
    'exports'
  ],
  function(
    exports
  ) {

/**
 * Asynchronously fetch the contents of a Blob, returning a Uint8Array.
 * Exists because there is no FileReader in Gecko workers and this totally
 * works.  In discussion, it sounds like :sicking wants to deprecate the
 * FileReader API anyways.
 *
 * Our consumer in this case is our specialized base64 encode that wants a
 * Uint8Array since that is more compactly represented than a binary string
 * would be.
 *
 * @param blob {Blob}
 * @param callback {Function(err, Uint8Array)}
 */
function asyncFetchBlobAsUint8Array(blob, callback) {
  var blobUrl = URL.createObjectURL(blob);
  var xhr = new XMLHttpRequest();
  xhr.open('GET', blobUrl, true);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function() {
    // blobs currently result in a status of 0 since there is no server.
    if (xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) {
      callback(xhr.status);
      return;
    }
    callback(null, new Uint8Array(xhr.response));
  };
  xhr.onerror = function() {
    callback('error');
  };
  try {
    xhr.send();
  }
  catch(ex) {
    console.error('XHR send() failure on blob');
    callback('error');
  }
  URL.revokeObjectURL(blobUrl);
}

return {
  asyncFetchBlobAsUint8Array: asyncFetchBlobAsUint8Array
};

}); // end define
;
/**
 * The main-thread counterpart to our node-net.js wrapper.
 *
 * Provides the smarts for streaming the content of blobs.  An alternate
 * implementation would be to provide a decorating proxy to implement this
 * since smart Blob transmission is on the W3C raw-socket hit-list (see
 * http://www.w3.org/2012/sysapps/raw-sockets/), but we're already acting like
 * node.js's net implementation on the other side of the equation and a totally
 * realistic implementation is more work and complexity than our needs require.
 *
 * Important implementation notes that affect us:
 *
 * - mozTCPSocket generates ondrain notifications when the send buffer is
 *   completely empty, not when when we go below the target buffer level.
 *
 * - bufferedAmount in the child process mozTCPSocket implementation only gets
 *   updated when the parent process relays a messages to the child process.
 *   When we are performing bulks sends, this means we will only see
 *   bufferedAmount go down when we receive an 'ondrain' notification and the
 *   buffer has hit zero.  As such, trying to do anything clever involving
 *   bufferedAmount other than seeing if it's at zero is not going to do
 *   anything useful.
 *
 * Leading to our strategy:
 *
 * - Always have a pre-fetched block of disk I/O to hand to the socket when we
 *   get a drain event so that disk I/O does not stall our pipeline.
 *   (Obviously, if the network is faster than our disk, there is very little
 *   we can do.)
 *
 * - Pick a page-size so that in the case where the network is extremely fast
 *   we are able to maintain good throughput even when our IPC overhead
 *   dominates.  We just pick one page-size; we intentionally avoid any
 *   excessively clever buffering regimes because those could back-fire and
 *   such effort is better spent on enhancing TCPSocket.
 */
define('ext/worker-support/net-main',['require','../async_blob_fetcher'],function(require) {


var asyncFetchBlobAsUint8Array =
      require('../async_blob_fetcher').asyncFetchBlobAsUint8Array;

// Active sockets
var sockInfoByUID = {};

function open(uid, host, port, options) {
  var socket = navigator.mozTCPSocket;
  var sock = socket.open(host, port, options);

  var sockInfo = sockInfoByUID[uid] = {
    uid: uid,
    sock: sock,
    // Are we in the process of sending a blob?  The blob if so.
    activeBlob: null,
    // Current offset into the blob, if any
    blobOffset: 0,
    queuedData: null,
    // Queued write() calls that are ordering dependent on the Blob being
    // fully sent first.
    backlog: [],
  };

  sock.onopen = function(evt) {
    self.sendMessage(uid, 'onopen');
  };

  sock.onerror = function(evt) {
    var err = evt.data || evt;
    var wrappedErr;
    if (err && typeof(err) === 'object') {
      wrappedErr = {
        name: err.name,
        type: err.type,
        message: err.message
      };
    }
    else {
      wrappedErr = err;
    }
    self.sendMessage(uid, 'onerror', wrappedErr);
  };

  sock.ondata = function(evt) {
    var buf = evt.data;
    self.sendMessage(uid, 'ondata', buf, [buf]);
  };

  sock.ondrain = function(evt) {
    // If we have an activeBlob and data already to send, then send it.
    // If we have an activeBlob but no data, then fetchNextBlobChunk has
    // an outstanding chunk fetch and it will issue the write directly.
    if (sockInfo.activeBlob && sockInfo.queuedData) {
      console.log('net-main(' + sockInfo.uid + '): Socket drained, sending.');
      sock.send(sockInfo.queuedData.buffer, 0, sockInfo.queuedData.byteLength);
      sockInfo.queuedData = null;
      // fetch the next chunk or close out the blob; this method does both
      fetchNextBlobChunk(sockInfo);
    } else {
      // Only forward the drain event if we aren't still taking over.
      self.sendMessage(uid, 'ondrain');
    }
  };

  sock.onclose = function(evt) {
    self.sendMessage(uid, 'onclose');
    delete sockInfoByUID[uid];
  };
}

function beginBlobSend(sockInfo, blob) {
  console.log('net-main(' + sockInfo.uid + '): Blob send of', blob.size,
              'bytes');
  sockInfo.activeBlob = blob;
  sockInfo.blobOffset = 0;
  sockInfo.queuedData = null;
  fetchNextBlobChunk(sockInfo);
}

/**
 * Fetch the next portion of the Blob we are currently sending.  Once the read
 * completes we will either send the data immediately if the socket's buffer is
 * empty or queue it up for sending once the buffer does drain.
 *
 * This logic is used both in the starting case and to help us reach a steady
 * state where (ideally) we always have a pre-fetched buffer of data ready for
 * when we hear the next drain event.
 *
 * We are also responsible for noticing that we're all done sending the Blob.
 */
function fetchNextBlobChunk(sockInfo) {
  // We are all done if the next fetch would be beyond the end of the blob
  if (sockInfo.blobOffset >= sockInfo.activeBlob.size) {
    console.log('net-main(' + sockInfo.uid + '): Blob send completed.',
                'backlog length:', sockInfo.backlog.length);
    sockInfo.activeBlob = null;

    // Drain as much of the backlog as possible.
    var backlog = sockInfo.backlog;
    while (backlog.length) {
      var sendArgs = backlog.shift();
      var data = sendArgs[0];
      if (data instanceof Blob) {
        beginBlobSend(sockInfo, data);
        return;
      }
      sockInfo.sock.send(data, sendArgs[1], sendArgs[2]);
    }
    // (the backlog is now empty)
    return;
  }

  var nextOffset =
        Math.min(sockInfo.blobOffset + self.BLOB_BLOCK_READ_SIZE,
                 sockInfo.activeBlob.size);
  console.log('net-main(' + sockInfo.uid + '): Fetching bytes',
              sockInfo.blobOffset, 'through', nextOffset, 'of',
              sockInfo.activeBlob.size);
  var blobSlice = sockInfo.activeBlob.slice(
                    sockInfo.blobOffset,
                    nextOffset);
  sockInfo.blobOffset = nextOffset;

  function gotChunk(err, binaryDataU8) {
    console.log('net-main(' + sockInfo.uid + '): Retrieved chunk');
    if (err) {
      // I/O errors are fatal to the connection; our abstraction does not let us
      // bubble the error.  The good news is that errors are highly unlikely.
      sockInfo.sock.close();
      return;
    }

    // If the socket has already drained its buffer, then just send the data
    // right away and re-schedule ourselves.
    if (sockInfo.sock.bufferedAmount === 0) {
      console.log('net-main(' + sockInfo.uid + '): Sending chunk immediately.');
      sockInfo.sock.send(binaryDataU8.buffer, 0, binaryDataU8.byteLength);
      fetchNextBlobChunk(sockInfo);
      return;
    }

    sockInfo.queuedData = binaryDataU8;
  };
  asyncFetchBlobAsUint8Array(blobSlice, gotChunk);
}

function close(uid) {
  var sockInfo = sockInfoByUID[uid];
  if (!sockInfo)
    return;
  var sock = sockInfo.sock;
  sock.close();
  sock.onopen = null;
  sock.onerror = null;
  sock.ondata = null;
  sock.ondrain = null;
  sock.onclose = null;
  self.sendMessage(uid, 'onclose');
  delete sockInfoByUID[uid];
}

function write(uid, data, offset, length) {
  var sockInfo = sockInfoByUID[uid];
  if (!sockInfo) {
    return;
  }

  // If there is an activeBlob, then the write must be queued or we would end up
  // mixing this write in with our Blob and that would be embarassing.
  if (sockInfo.activeBlob) {
    sockInfo.backlog.push([data, offset, length]);
    return;
  }

  // Fake an onprogress event so that we can delay wakelock expiration
  // as long as data still flows to the server.
  self.sendMessage(uid, 'onprogress', []);

  if (data instanceof Blob) {
    beginBlobSend(sockInfo, data);
  }
  else {
    sockInfo.sock.send(data, offset, length);
  }
}


function upgradeToSecure(uid) {
  var sockInfo = sockInfoByUID[uid];
  if (!sockInfo)
    return;
  sockInfo.sock.upgradeToSecure();
}


var self = {
  name: 'netsocket',
  sendMessage: null,

  /**
   * What size bites (in bytes) should we take of the Blob for streaming
   * purposes?  See the file header for the sizing rationale.
   */
  BLOB_BLOCK_READ_SIZE: 96 * 1024,

  process: function(uid, cmd, args) {
    switch (cmd) {
      case 'open':
        open(uid, args[0], args[1], args[2]);
        break;
      case 'close':
        close(uid);
        break;
      case 'write':
        write(uid, args[0], args[1], args[2]);
        break;
      case 'upgradeToSecure':
        upgradeToSecure(uid);
        break;
      default:
        console.error('Unhandled net-main command:', cmd);
        break;
    }
  }
};
return self;
});

/**
 * The docs for this can be found in `mailapi/wakelocks.js`.
 *
 * This file runs on the main thread, receiving messages sent from a
 * SmartWakeLock instance -> through the router -> to this file.
 */
define('ext/worker-support/wakelocks-main',[],function() {
  

  function debug(str) {
    dump('WakeLocks: ' + str + '\n');
  }

  var nextId = 1;
  var locks = {};

  function requestWakeLock(type) {
    var lock = navigator.requestWakeLock(type);
    var id = nextId++;
    locks[id] = lock;
    return id;
  }

  var self = {
    name: 'wakelocks',
    sendMessage: null,
    process: function(uid, cmd, args) {
      debug('process ' + cmd + ' ' + JSON.stringify(args));
      switch (cmd) {
      case 'requestWakeLock':
        var type = args[0];
        self.sendMessage(uid, cmd, [requestWakeLock(type)]);
        break;
      case 'unlock':
        var id = args[0];
        var lock = locks[id];
        if (lock) {
          lock.unlock();
          delete locks[id];
        }
        self.sendMessage(uid, cmd, []);
      }
    }
  };
  return self;
});

/**
 * The startup process (which can be improved) looks like this:
 *
 * Main: Initializes worker support logic
 * Main: Spawns worker
 * Worker: Loads core JS
 * Worker: 'hello' => main
 * Main: 'hello' => worker with online status and mozAlarms status
 * Worker: Creates MailUniverse
 * Worker 'mailbridge'.'hello' => main
 * Main: Creates MailAPI, sends event to UI
 * UI: can really do stuff
 *
 * Note: this file is not currently used by the GELAM unit tests;
 * mailapi/testhelper.js (in the worker) and
 * mailapi/worker-support/testhelper-main.js establish the (bounced) bridge.
 **/

// Install super-simple shims here.
window.setZeroTimeout = function(fn) {
  setTimeout(function() { fn(); }, 0);
};

define(
  'ext/main-frame-setup',[
    // Pretty much everything could be dynamically loaded after we kickoff the
    // worker thread.  We just would need to be sure to latch any received
    // messages that we receive before we finish setup.
    './mailapi',
    './worker-support/main-router',
    './worker-support/updateCredentials-main',
    './worker-support/configparser-main',
    './worker-support/cronsync-main',
    './worker-support/deviceInfo-main',
    './worker-support/devicestorage-main',
    './worker-support/maildb-main',
    './worker-support/net-main',
    './worker-support/wakelocks-main',
    'require'
  ],
  function(
    $mailapi,
    $router,
    $updateCredentials,
    $configparser,
    $cronsync,
    $deviceinfo,
    $devicestorage,
    $maildb,
    $net,
    $wakelocks,
    require
  ) {

  var control = {
    name: 'control',
    sendMessage: null,
    process: function(uid, cmd, args) {
      var online = navigator.connection.type !== 'none';
      control.sendMessage(uid, 'hello', [online]);

      window.navigator.connection.addEventListener('typechange', function(evt) {
        var type = evt.target.type;
        if (type !== 'none') {
          control.sendMessage(uid, 'online', [true]);
        } else {
          control.sendMessage(uid, 'offline', [false]);
        }
      });

      $router.unregister(control);
    },
  };

  var MailAPI = new $mailapi.MailAPI();

  var bridge = {
    name: 'bridge',
    sendMessage: null,
    process: function(uid, cmd, args) {
      var msg = args;

      if (msg.type === 'hello') {
        delete MailAPI._fake;
        MailAPI.__bridgeSend = function(msg) {
          worker.postMessage({
            uid: uid,
            type: 'bridge',
            msg: msg
          });
        };

        MailAPI.config = msg.config;

        // Send up all the queued messages to real backend now.
        MailAPI._storedSends.forEach(function (msg) {
          MailAPI.__bridgeSend(msg);
        });
        MailAPI._storedSends = [];
      } else {
        MailAPI.__bridgeReceive(msg);
      }
    },
  };

  // Wire up the worker to the router
  var worker = new Worker(require.toUrl('./worker-bootstrap.js'));
  $router.useWorker(worker);
  $router.register(control);
  $router.register(bridge);
  $router.register($updateCredentials);
  $router.register($configparser);
  $router.register($cronsync);
  $router.register($devicestorage);
  $router.register($deviceinfo);
  $router.register($maildb);
  $router.register($net);
  $router.register($wakelocks);

  return MailAPI;
}); // end define
;

define('accounts_sync',['require','api','evt','model','cards'],function(require) {
  let MailAPI = require('api'),
      evt = require('evt'),
      model = require('model'),
      cards = require('cards');

  let settings = window.navigator.mozSettings;
  const emailSyncKey = 'emailSyncEnable';
  const DELAY_LOAD_TIME = 2000;

  let accountSync = {
    doSync: false,
    bAdded: false,
    index: 0,
    accounts: [],
    accountIds: [],
    accountsList: [],
    syncSwitch: [],
    autoAddedListener: false,
    userAddedListener: false,
    addChangedHandler: false,

    getCredential: function(account, refreshCredential) {
      console.log('Get account credential of ' + account.accountId);
      return new Promise(function(resolve, reject) {
        let config = { refreshCredential: refreshCredential };
        navigator.accountManager.getCredential(account, config).then(
          (credential) => {
            resolve(credential);
          }, (reason) => {
            console.log('getCredential rejected: ' + reason);
            reject(reason);
          }
        );
      });
    },

    // Check and update account to email app
    updateAccount: function(refresh = false, action = 'none') {
      let account = this.accounts[this.index];
      let mailAddress = account.accountId;
      let authenticatorId = account.authenticatorId;
      let enable = true;

      if (this.syncSwitch[mailAddress] !== undefined) {
        enable = this.syncSwitch[mailAddress];
      }

      this.accountIds.push(mailAddress);
      this.getCredential(account, refresh).then((credential) => {
        let oauth2Tokens;
        let password;
        let config = {};
        let mailData = {
          address: mailAddress,
          syncEnable: enable,
          autoSetup: true
        };

        if (credential.access_token) {
          if (Date.now() < credential.expire_timestamp) {
            oauth2Tokens = {
              accessToken: credential.access_token,
              expireTimeMS: credential.expire_timestamp
            };
            mailData.oauth2Tokens = oauth2Tokens;
          } else {
            this.updateAccount(true);
            return;
          }
        } else if (authenticatorId === 'activesync') {
          password = credential.password;
          config = {
            type: 'activesync',
            incoming: {
              username: credential.username,
              server: credential.configInfo.server,
              deviceId: credential.configInfo.deviceId,
              policyKey: credential.configInfo.policyKey
            }
          };
          mailData.password = password;
          mailData.type = 'activesync';
        }

        // Check whether this account exists and update
        // account information if already exist.
        console.log('Check and update account: ' + mailAddress);
        MailAPI.checkAndUpdateAccount(mailData, (result) => {
          if (!result.bExist && action !== 'onrefreshed') {
            if (enable && navigator.connection.type !== 'none') {
              cards.pushCard('setup_progress', 'animate', {
                displayName: '',
                emailAddress: mailAddress,
                password: password,
                configInfo: config,
                oauth2Tokens: oauth2Tokens,
                authenticatorId: authenticatorId,
                autoSetup: true,
                callingCard: cards.getCurrentCard()
              }, 'right');
            } else {
              this.continueAdd();
            }
            this.onAutoAdded();
          } else {
            if (result.bUpdate) {
              evt.emit('accountSyncChanged', { id: result.id });
            }
            this.continueAdd();
          }
        });
      }, () => {
        this.continueAdd();
      });
    },

    continueAdd: function() {
      let accountsNumber = this.accounts.length;
      if (this.index < accountsNumber) {
        if (this.index < accountsNumber - 1) {
          this.index += 1;
          this.updateAccount();
        } else {
          if (this.bAdded) {
            let cacheSoftkeyNode = document.getElementById('cachedSoftkeyPanel');
            if (cacheSoftkeyNode) {
              document.body.removeChild(cacheSoftkeyNode);
            }
            evt.emit('resetApp');
          }
          this.syncAccountsDone();
        }
      }
    },

    syncAccountsDone: function() {
      console.log('Sync accouns done');
      this.doSync = false;
      this.checkDeletedAccounts();
      this.onAccountsChange();
    },

    getAllAccounts: function() {
      return new Promise(function(resolve, reject) {
        navigator.accountManager.getAccounts().then(
          (result) => {
            resolve(result);
          },
          (reason) => {
            reject(reason);
          }
        );
      });
    },

    showLoginPage: function(aAuthenticator, aExtraInfo) {
      return new Promise(function(resolve, reject) {
        navigator.accountManager.showLoginPage(aAuthenticator,
                                               aExtraInfo).then((result) => {
          console.log('showLoginPage resolved: ' + JSON.stringify(result));
          resolve(result);
        }, (reason) => {
          console.log('showLoginPage rejected: ' + reason);
          reject(reason);
        });
      });
    },

    checkDeletedAccounts: function(bRemove = false, noExecute = false) {
      MailAPI.removeDeletedAccounts(this.accountIds, bRemove, (result) => {
        if (result && !noExecute) {
          evt.emit('resetApp');
        }
      });
    },

    sendAccountInfo: function(configData) {
      let account = configData.account;
      let accountId = account.name;
      let username = account.username;
      let accountType = account.type;
      let password = account.password;

      if (accountType === 'activesync') {
        let accountData = {
          accountId: accountId,
          username: username,
          password: password,
          configInfo: account.servers ? account.servers[0].connInfo : account.configInfo
        };

        // send EAS setup info to system(gaia authenticator) to save
        console.log('Send activesync setup info to system');
        let bActive = configData.activity;
        navigator.mozApps.getSelf().onsuccess = (evt) => {
          let app = evt.target.result;
          app.connect('emailcomms').then((ports) => {
            ports.forEach((port) => {
              if (bActive) {
                port.postMessage(accountData);
              }
              port.onmessage = function(event) {
                if (event.data === 'requireData') {
                  port.postMessage(accountData);
                }
              };
            });
            if (!bActive) {
              let authenticator = { authenticatorId: accountType };
              let extraInfo = { hideSetupPage: true };
              this.showLoginPage(authenticator, extraInfo);
            }
          }, (reason) => {
            console.log('Email emailcomms is rejected ' + reason);
          });
        };
      }
    },

    changePassword: function(accountId, authenticatorId, password) {
      if (authenticatorId) {
        console.log('Change password of account: ' + accountId);
        let account = {
          accountId: accountId,
          authenticatorId: authenticatorId
        };

        navigator.accountManager.reauthenticate(account,
            { password: password }).then(() => {
          console.log('Account:' + accountId + '\'s password changed');
        }, () => {
          console.log('Account:' + accountId + ' change password failed');
        });
      }
    },

    removeAccount: function(accountId, authenticatorId) {
      if (authenticatorId) {
        let account = {
          accountId: accountId,
          authenticatorId: authenticatorId
        };

        navigator.accountManager.logout(account).then(
          () => {
            console.log('Account logout: ' + accountId);
            this.updateAccountsList(accountId);
          }, (reason) => {
            console.log('Account logout failed: ' + reason);
          }
        );
      }
    },

    onAccountsChange: function() {
      if (this.addChangedHandler) {
        return;
      }
      console.log('Add accounts change handler');
      this.addChangedHandler = true;
      navigator.accountManager.onchanged = (event) => {
        console.log('Accounts changed action:' + event.detail.action);
        let data = event.detail;
        let account = {
          accountId: data.accountId,
          authenticatorId: data.authenticatorId
        };

        if (data.action === 'onlogin') {
          this.accountsList.push(account);
        } else if (data.action === 'onlogout') {
          this.updateAccountsList(data.accountId);
        }

        if (!document.hidden) {
          return;
        }

        this.clearData();
        if (data.action === 'onrefreshed' ||
            data.action === 'onlogin') {
          this.accountsList.forEach((val) => {
            this.accountIds.push(val.accountId);
          });
          this.accounts.push(account);
          this.updateAccount(false, data.action);
        } else if (data.action === 'onlogout') {
          this.accountIds.push(data.accountId);
          this.checkDeletedAccounts(true);
        }
      };

      settings.addObserver(emailSyncKey, (evt) => {
        if (evt.settingValue) {
          console.log('Email sync switch changed!');
          let values = evt.settingValue;
          if (values) {
            if (Object.keys(values).length ===
                Object.keys(this.syncSwitch).length) {
              console.log('Update accounts because sync value change!');
              this.checkChangedAccount(values);
            } else {
              this.syncSwitch = values;
            }
          }
        }
      });
    },

    clearData: function() {
      this.accountIds = [];
      this.accounts = [];
      this.index = 0;
      this.bAdded = false;
    },

    checkAccountExist: function (accountId) {
      let account = null;
      for (let i = 0; i < this.accountsList.length; i++) {
        if (this.accountsList[i].accountId.toLowerCase() ===
          accountId.toLowerCase()) {
          console.log('Account : ' + accountId +
                      ' already exist in account manager DB');
          account = this.accountsList[i];
          break;
        }
      }
      return account;
    },

    updateAccountsList: function (accountId) {
      for (let i = 0; i < this.accountsList.length; i++) {
        if (this.accountsList[i].accountId === accountId) {
          this.accountsList.splice(i, 1);
          break;
        }
      }
    },

    checkChangedAccount: function(values) {
      let accountId = '';

      this.clearData();
      for (let i in values) {
        if (values.hasOwnProperty(i)) {
          if (this.syncSwitch[i] === undefined || values[i] !== this.syncSwitch[i]) {
            this.syncSwitch[i] = values[i];
            accountId = i;
          }
          this.accountIds.push(i);
        }
      }
      this.syncSwitch = values;
      this.accounts = this.accountsList.filter(val => val.accountId === accountId);

      this.updateAccount();
    },

    updateAccounts: function(bActivity = false) {
      this.getAllAccounts().then((result) => {
        console.log('Account length: ' + result.length);
        this.clearData();
        this.accountsList = result;
        if (!bActivity) {
          if (result.length > 0) {
            this.accounts = result;
            this.updateAccount();
          } else {
            this.syncAccountsDone();
          }
        } else {
          this.onUserAdded();
          this.onAccountsChange();
          if (this.accountsList.length) {
            this.accountsList.forEach((val) => {
              this.accountIds.push(val.accountId);
            });
          }
          this.checkDeletedAccounts(false, true);
        }
      });
    },

    updateSyncInfo: function(accountId) {
      console.log('Update sync switch info');
      return new Promise(function(resolve, reject) {
        settings.createLock().get(emailSyncKey).then((result) => {
          if (result[emailSyncKey]) {
            let syncValue = result[emailSyncKey];
            syncValue[accountId] = true;
            let syncInfo = {};
            syncInfo[emailSyncKey] = syncValue;
            return settings.createLock().set(syncInfo).then(() => {
              resolve(syncValue);
            });
          }
        });
      });
    },

    onAutoAdded: function() {
      if (!this.autoAddedListener) {
        evt.on('autoAddDone', () => {
          this.bAdded = true;
          this.continueAdd();
        });
        this.autoAddedListener = true;
      }
    },

    onUserAdded: function() {
      if (!this.userAddedListener) {
        evt.on('userAddDone', (configData) => {
          this.sendAccountInfo(configData);
        });
        this.userAddedListener = true;
      }
    },

    syncAccounts: function() {
      console.log('Start sync account using accountManager');
      this.doSync = true;
      settings.createLock().get(emailSyncKey).then((result) => {
        if (result[emailSyncKey]) {
          this.syncSwitch = result[emailSyncKey];
        }
        setTimeout(() => {
          this.updateAccounts();
        }, DELAY_LOAD_TIME);
      });

      this.onUserAdded();
    }
  };

  return accountSync;
});

/* jshint -W083 */

(function(exports) {
  

  /**
   * Allowable font sizes for header elements.
   */
  const HEADER_SIZES = [
    16, 17, 18, 19, 20, 21, 22, 23
  ];

  /**
   * Utility functions for measuring and manipulating font sizes
   */
  var FontSizeUtils = {

    /**
     * Keep a cache of canvas contexts with a given font.
     * We do this because it is faster to create new canvases
     * than to re-set the font on existing contexts repeatedly.
     */
    _cachedContexts: {},

    /**
     * Grab or create a cached canvas context for a given fontSize/family pair.
     * @todo Add font-weight as a new dimension for caching.
     *
     * @param {Integer} fontSize The font size of the canvas we want.
     * @param {String} fontFamily The font family of the canvas we want.
     * @param {String} fontStyle The style of the font (default to italic).
     * @return {CanvasRenderingContext2D} A context with the specified font.
     */
    _getCachedContext: function(fontSize, fontFamily, fontStyle) {
      // Default to italic style since this code is only ever used
      // by headers right now and header text is always italic.
      fontStyle = fontStyle || 'italic';

      var cache = this._cachedContexts;
      var ctx = cache[fontSize] && cache[fontSize][fontFamily] ?
                cache[fontSize][fontFamily][fontStyle] : null;

      if (!ctx) {
        var canvas = document.createElement('canvas');
        canvas.setAttribute('moz-opaque', 'true');
        canvas.setAttribute('width', '1');
        canvas.setAttribute('height', '1');

        ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.font = fontStyle + ' ' + fontSize + 'px ' + fontFamily;

        // Populate the contexts cache.
        if (!cache[fontSize]) {
          cache[fontSize] = {};
        }
        if (!cache[fontSize][fontFamily]) {
          cache[fontSize][fontFamily] = {};
        }
        cache[fontSize][fontFamily][fontStyle] = ctx;
      }

      return ctx;
    },

    /**
     * Clear any current canvas contexts from the cache.
     */
    resetCache: function() {
      this._cachedContexts = {};
    },

    /**
     * Use a single observer for all text changes we are interested in.
     */
    _textChangeObserver: null,

    /**
     * Auto resize all text changes.
     * @param {Array} mutations A MutationRecord list.
     */
    _handleTextChanges: function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        this._reformatHeaderText(mutations[i].target);
      }
    },

    /**
     * Singleton-like interface for getting our text change observer.
     * By reusing the observer, we make sure we only ever attach a
     * single observer to any given element we are interested in.
     */
    _getTextChangeObserver: function() {
      if (!this._textChangeObserver) {
        this._textChangeObserver = new MutationObserver(
          this._handleTextChanges.bind(this));
      }
      return this._textChangeObserver;
    },

    /**
     * Perform auto-resize when textContent changes on element.
     *
     * @param {HTMLElement} element The element to observer for changes
     */
    _observeHeaderChanges: function(element) {
      var observer = this._getTextChangeObserver();
      // Listen for any changes in the child nodes of the header.
      observer.observe(element, { childList: true });
    },

    /**
     * Resize and reposition the header text based on string length and
     * container position.
     *
     * @param {HTMLElement} header h1 text inside header to reformat.
     */
    _reformatHeaderText: function(header) {
      // Skip resize logic if header has no content, ie before localization.
      if (header.textContent.trim() === '') {
        return;
      }

      // Reset our centering styles.
      this.resetCentering(header);

      // Cache the element style properites to avoid reflows.
      var style = this.getStyleProperties(header);

      // Perform auto-resize and center.
      style.textWidth = this.autoResizeElement(header, style);
      this.centerTextToScreen(header, style);
    },

    /**
     * Reformat all the headers located inside a DOM node, and add mutation
     * observer to reformat when any changes are made.
     *
     * @param {HTMLElement} domNode
     */
    _registerHeadersInSubtree: function(domNode) {
      if (!domNode) {
        return;
      }

      var headers = domNode.querySelectorAll('header > h1');
      for (var i = 0; i < headers.length; i++) {
        // On some apps wrapping inside a requestAnimationFrame reduces the
        // number of calls to _reformatHeaderText().
        window.requestAnimationFrame(function(header) {
          this._reformatHeaderText(header);
          this._observeHeaderChanges(header);
        }.bind(this, headers[i]));
      }
    },

    /**
     * Get the width of a string in pixels, given its fontSize and fontFamily.
     *
     * @param {String} string The string we are measuring.
     * @param {Integer} fontSize The size of the font to measure against.
     * @param {String} fontFamily The font family to measure against.
     * @param {String} fontStyle The style of the font (default to italic).
     * @return {Integer} The pixel width of the string with the given font.
     */
    getFontWidth: function(string, fontSize, fontFamily, fontStyle) {
      var ctx = this._getCachedContext(fontSize, fontFamily, fontStyle);
      return ctx.measureText(string).width;
    },

    /**
     * Get the maximum allowable fontSize for a string such that it will
     * not overflow past a maximum width.
     *
     * @param {String} string The string for which to check max font size.
     * @param {Array} allowedSizes A list of fontSizes allowed.
     * @param {String} fontFamily The font family of the string we're measuring.
     * @param {Integer} maxWidth The maximum number of pixels before overflow.
     * @return {Object} Dict containing fontSize, overflow and textWidth.
     */
    getMaxFontSizeInfo: function(string, allowedSizes, fontFamily, maxWidth) {
      var fontSize;
      var resultWidth;
      var i = allowedSizes.length - 1;

      do {
        fontSize = allowedSizes[i];
        resultWidth = this.getFontWidth(string, fontSize, fontFamily);
        i--;
      } while (resultWidth > maxWidth && i >= 0);

      return {
        fontSize: fontSize,
        overflow: resultWidth > maxWidth,
        textWidth: resultWidth
      };
    },

    /**
     * Get the amount of characters truncated from overflow ellipses.
     *
     * @param {String} string The string for which to check max font size.
     * @param {Integer} fontSize The font size of the string we are measuring.
     * @param {String} fontFamily The font family of the string we're measuring.
     * @param {Integer} maxWidth The maximum number of pixels before overflow.
     */
    getOverflowCount: function(string, fontSize, fontFamily, maxWidth) {
      var substring;
      var resultWidth;
      var overflowCount = -1;

      do {
        overflowCount++;
        substring = string.substr(0, string.length - overflowCount);
        resultWidth = this.getFontWidth(substring, fontSize, fontFamily);
      } while (substring.length > 0 && resultWidth > maxWidth);

      return overflowCount;
    },

    /**
     * Get an array of allowed font sizes for an element
     *
     * @param {HTMLElement} element The element to get allowed sizes for.
     * @return {Array} An array containing pizels values of allowed sizes.
     */
    getAllowedSizes: function(element) {
      if (element.tagName === 'H1' && element.parentNode.tagName === 'HEADER') {
        return HEADER_SIZES;
      }
      // No allowed sizes for this element, so return empty array.
      return [];
    },

    /**
     * Get an element's content width disregarding its box model sizing.
     *
     * @param {HTMLElement|Object} HTML element, or style object.
     * @returns {Number} width in pixels of elements content.
     */
    getContentWidth: function(style) {
      var width = parseInt(style.width, 10);
      if (style.boxSizing === 'border-box') {
        width -= (parseInt(style.paddingRight, 10) +
          parseInt(style.paddingLeft, 10));
      }
      return width;
    },

    /**
     * Get an element's style properies.
     *
     * @param {HTMLElement} element The element from which to fetch style.
     * @return {Object} A dictionary containing element's style properties.
     */
    getStyleProperties: function(element) {
      var style = window.getComputedStyle(element);
      var contentWidth = this.getContentWidth(style);
      if (isNaN(contentWidth)) {
        contentWidth = 0;
      }

      return {
        fontFamily: style.fontFamily,
        contentWidth: contentWidth,
        paddingRight: parseInt(style.paddingRight, 10),
        paddingLeft: parseInt(style.paddingLeft, 10),
        offsetLeft: element.offsetLeft
      };
    },

    /**
     * Auto resize element's font to fit its content width.
     *
     * @param {HTMLElement} element The element to perform auto-resize on.
     * @param {Object} styleOptions Dictionary containing cached style props,
     *                 to avoid reflows caused by grabbing style properties.
     * @return {Integer} The pixel width of the resized text.
     */
    autoResizeElement: function(element, styleOptions) {
      var allowedSizes = this.getAllowedSizes(element);
      if (allowedSizes.length === 0) {
        return 0;
      }

      var contentWidth = styleOptions.contentWidth ||
        this.getContentWidth(element);

      var fontFamily = styleOptions.fontFamily ||
        getComputedStyle(element).fontFamily;

      var info = this.getMaxFontSizeInfo(
        element.textContent.trim(),
        allowedSizes,
        fontFamily,
        contentWidth
      );

      element.style.fontSize = info.fontSize + 'px';

      return info.textWidth;
    },

    /**
     * Reset the auto-centering styling on an element.
     *
     * @param {HTMLElement} element The element to reset.
     */
    resetCentering: function(element) {
      // We need to set the lateral margins to 0 to be able to measure the
      // element width properly. All previously set values are ignored.
      element.style.marginLeft = element.style.marginRight = '0';
    },

    /**
     * Center an elements text based on screen position rather than container.
     *
     * @param {HTMLElement} element The element whose text we want to center.
     * @param {Object} styleOptions Dictionary containing cached style props,
     *                 avoids reflows caused by caching style properties.
     */
    centerTextToScreen: function(element, styleOptions) {
      // Calculate the minimum amount of space needed for the header text
      // to be displayed without overflowing its content box.
      var minHeaderWidth = styleOptions.textWidth + styleOptions.paddingRight +
        styleOptions.paddingLeft;

      // Get the amount of space on each side of the header text element.
      var sideSpaceLeft = styleOptions.offsetLeft;
      var sideSpaceRight = this.getWindowWidth() - sideSpaceLeft -
        styleOptions.contentWidth - styleOptions.paddingRight -
        styleOptions.paddingLeft;

      // If both margins have the same width, the header is already centered.
      if (sideSpaceLeft === sideSpaceRight) {
        return;
      }

      // To center, we need to make sure the space to the left of the header
      // is the same as the space to the right, so take the largest of the two.
      var margin = Math.max(sideSpaceLeft, sideSpaceRight);

      // If the minimum amount of space our header needs plus the max margins
      // fits inside the width of the window, we can center this header.
      // We subtract 1 pixels to wrap text like Gecko.
      // See https://bugzil.la/1026955
      if (minHeaderWidth + (margin * 2) < this.getWindowWidth() - 1) {
        element.style.marginLeft = element.style.marginRight = margin + 'px';
      }
    },

    _initHeaderFormatting: function() {
      if (navigator.mozL10n) {
        // When l10n is ready, register all displayed headers for formatting.
        navigator.mozL10n.once(function() {
          this._registerHeadersInSubtree(document.body);
        }.bind(this));
      } else {
        this._registerHeadersInSubtree(document.body);
      }
    },

    /**
     * Initialize the FontSizeUtils, add overflow handler and perform
     * auto resize once strings have been localized.
     */
    init: function() {
      // Listen for lazy loaded DOM to register new headers.
      window.addEventListener('lazyload', function(evt) {
        this._registerHeadersInSubtree(evt.detail);
      }.bind(this));

      // Once document is ready, format any headers already in the DOM.
      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', function() {
          this._initHeaderFormatting();
        }.bind(this));
      } else {
        this._initHeaderFormatting();
      }
    },

    /**
     * Cache and return the width of the inner window.
     *
     * @return {Integer} The width of the inner window in pixels.
     */
    getWindowWidth: function() {
      return window.innerWidth;
    }
  };

  FontSizeUtils.init();

  exports.FontSizeUtils = FontSizeUtils;
}(this));

define("shared/js/font_size_utils", function(){});

/**
 * Shim for navigator.mozHour12 API.
 * Send `localechanged` event if mozHour12 is changed.
 *
 * App need include following permission in manifest:
 *
 * "settings":{ "access": "readonly" }
 */
(function(){
  
  // not polyfill if API already exists
  if (window.navigator.mozHour12 || window.navigator.hour12) {return;}

  // mock mozHour12 onto window.navigator
  window.navigator.mozHour12 = null;

  // set hour12 and emit the locale change event if value changed
  var _setMozHour12 = function(result) {
    if (window.navigator.mozHour12 !== result) {
      window.navigator.mozHour12 = result;
      // emit the locale change event
      window.dispatchEvent(new CustomEvent('timeformatchange'));
    }
  };

  // handler observer event
  var _hour12Handler = function(event) {
    _setMozHour12(event.settingValue);
  };

  var _kLocaleTime = 'locale.hour12';
  // update mozHour12 to real value
  var lock = window.navigator.mozSettings.createLock();
  var req = lock.get(_kLocaleTime);
  req.onsuccess = function() {
    _setMozHour12(req.result[_kLocaleTime]);
  };
  if (lock.forceClose) {
    lock.forceClose();
  }
  // monitor settings changes
  window.navigator.mozSettings.addObserver(_kLocaleTime, _hour12Handler);
})();

define("shared/js/date_time_helper", function(){});



/**
 * Handles sending out metrics, since final states are distributed across cards
 * and their interior actions. Need something to coordinate the completion of
 * certain states to know when to emit the right events. Used right now for:
 * https://developer.mozilla.org/en-US/Apps/Build/Performance/Firefox_OS_app_responsiveness_guidelines
 *
 * Events tracked:
 *
 * apiDone: triggered when app knows data is flowing back and forth from the
 * worker.
 *
 * contentDone: when a card's content is completely available. This includes
 * any parts that were needed
 */
define('metrics',['require','evt'],function(require) {
  let evt = require('evt'),
      apiDone = false,
      contentDone = false;

  function checkAppLoaded() {
    if (apiDone && contentDone) {
      window.performance.mark('fullyLoaded');
      window.dispatchEvent(new CustomEvent('moz-app-loaded'));
    }
  }

  // Event listeners. Note they all unsubscribe after the first reception of
  // that kind of event. This is because cards, who can have multiple instances,
  // can emit the events throughout the lifetime of the app, and for the
  // purposes of the startup events, they only need to be done once on startup.
  evt.once('metrics:apiDone', function onApiDone() {
    apiDone = true;
    checkAppLoaded();
  });

  evt.once('metrics:contentDone', function() {
    contentDone = true;

    // Only need to dispatch these events if the startup cache was not used.
    if (!window.startupCacheEventsSent) {
      // Now that content is in, it is visually complete, and content is
      // interactive, since event listeners are bound as part of content
      // insertion.
      window.performance.mark('visuallyLoaded');
      window.dispatchEvent(new CustomEvent('moz-app-visually-complete'));
      window.performance.mark('contentInteractive');
      window.dispatchEvent(new CustomEvent('moz-content-interactive'));
    }

    checkAppLoaded();
  });
});

/*jshint browser: true */
/*globals define, console */

define('wake_locks',['require','evt'],function(require) {
  
  let lockTimeouts = {},
      evt = require('evt'),
      allLocks = {},

      // Using an object instead of an array since dataIDs are unique
      // strings.
      dataOps = {},
      dataOpsTimeoutId = 0,

      // Only allow keeping the locks for a maximum of 45 seconds.
      // This is to prevent a long, problematic sync from consuming
      // all of the battery power in the phone. A more sophisticated
      // method may be to adjust the size of the timeout based on
      // past performance, but that would mean keeping a persistent
      // log of attempts. This naive approach just tries to catch the
      // most likely set of failures: just a temporary really bad
      // cell network situation that once the next sync happens, the
      // issue is resolved.
      maxLockInterval = 45000,

      // Allow UI-triggered data operations to complete in a wake lock timeout
      // case, but only for a certain amount of time, because they could be the
      // cause of the wake lock timeout.
      dataOpsTimeout = 5000;

  // START failsafe close support, bug 1025727.
  // If the wake locks are timed out, it means sync went on too long, and there
  // is likely a problem. Reset state via app shutdown. Allow for UI-triggered
  // data operations to complete though before finally releasing the wake locks
  // and shutting down.
  function close() {
    // Reset state in case a close does not actually happen.
    dataOps = {};
    dataOpsTimeoutId = 0;

    // Only really close if the app is hidden.
    if (document.hidden) {
      console.log('email: cronsync wake locks expired, force closing app');
      window.close();
    } else {
      console.log('email: cronsync wake locks expired, but app visible, ' +
                  'not force closing');
      // User is using the app. Just clear all locks so we do not burn battery.
      // This means the app could still be in a bad data sync state, so just
      // need to rely on the next sync attempt or OOM from other app usage.
      Object.keys(allLocks).forEach(function(accountKey) {
        clearLocks(accountKey);
      });
    }
  }

  function closeIfNoDataOps() {
    let dataOpsKeys = Object.keys(dataOps);

    if (!dataOpsKeys.length) {
      // All clear, no waiting data operations, shut it down.
      return close();
    }

    console.log('email: cronsync wake lock force shutdown waiting on email ' +
                'data operations: ' + dataOpsKeys.join(', '));
    // Allow data operations to complete, but also set a cap on that since
    // they could be the ones causing the sync to fail. Give it 5 seconds.
    dataOpsTimeoutId = setTimeout(close, dataOpsTimeout);
  }

  // Listen for data operation events that might want to delay the failsafe
  // close switch.
  evt.on('uiDataOperationStart', (dataId) => {
    dataOps[dataId] = true;
  });

  evt.on('uiDataOperationStop', (dataId) => {
    delete dataOps[dataId];

    if (dataOpsTimeoutId && !Object.keys(dataOps).length) {
      clearTimeout(dataOpsTimeoutId);
      close();
    }
  });
  // END failsafe close

  function clearLocks(accountKey) {
    console.log('email: clearing wake locks for "' + accountKey + '"');

    // Clear timer
    let lockTimeoutId = lockTimeouts[accountKey];
    if (lockTimeoutId) {
      clearTimeout(lockTimeoutId);
    }
    lockTimeouts[accountKey] = 0;

    // Clear the locks
    let locks = allLocks[accountKey];
    allLocks[accountKey] = null;
    if (locks) {
      locks.forEach((lock) => {
        lock.unlock();
      });
    }
  }

  // Creates a string key from an array of string IDs. Uses a space
  // separator since that cannot show up in an ID.
  function makeAccountKey(accountIds) {
    return 'id' + accountIds.join(' ');
  }

  function onCronStop(accountIds) {
    clearLocks(makeAccountKey(accountIds));
  }

  evt.on('cronSyncWakeLocks', (accountKey, locks) => {
    if (lockTimeouts[accountKey]) {
      // Only support one set of locks. Better to err on the side of
      // saving the battery and not continue syncing vs supporting a
      // pathologic error that leads to a compound set of locks but
      // end up with more syncs completing.
      clearLocks(accountKey);
    }

    allLocks[accountKey] = locks;

    // If timeout is reached, means app is stuck in a bad state, and just
    // shut it down via the failsafe close.
    lockTimeouts[accountKey] = setTimeout(closeIfNoDataOps, maxLockInterval);
  });

  evt.on('cronSyncStop', onCronStop);
});

/**
 * Application logic that isn't specific to cards, specifically entailing
 * startup and mozSetMessageHandler message listening.
 **/
/*global globalOnAppMessage */


define('mail_app',['require','exports','module','l10n!','activity_composer_data','cards','evt','model','header_cursor','html_cache','toaster','accounts_sync','shared/js/font_size_utils','shared/js/date_time_helper','metrics','wake_locks'],function(require, exports, module) {

let mozL10n = require('l10n!'),
    activityComposerData = require('activity_composer_data'),
    cards = require('cards'),
    evt = require('evt'),
    model = require('model'),
    headerCursor = require('header_cursor').cursor,
    htmlCache = require('html_cache'),
    toaster = require('toaster'),
    accountsSync = require('accounts_sync'),
    waitingRawActivity, activityCallback;

require('shared/js/font_size_utils');
require('shared/js/date_time_helper');
require('metrics');
require('wake_locks');

let started = false;

let addActivity = false;
function pushStartCard(id, addedArgs) {
  let args = {};

  // Mix in addedArgs to the args object that is passed to pushCard. Use a new
  // object in case addedArgs is reused again by the caller.
  if (addedArgs) {
    Object.keys(addedArgs).forEach((key) => {
      args[key] = addedArgs[key];
    });
  }

  if (!started) {
    let cachedNode = cards._cardsNode.children[0];

    // Add in cached node to use, if it matches the ID type.
    if (cachedNode && id === htmlCache.nodeToKey(cachedNode)) {
      // l10n may not see this as it was injected before l10n.js was loaded,
      // so let it know it needs to translate it.
      mozL10n.translateFragment(cachedNode);
      args.cachedNode = cachedNode;
    }

    // Set body class to a solid background, see bug 1077605.
    document.body.classList.add('content-visible');
  }
  cards.pushCard(id, 'immediate', args);

  started = true;
}


// Due to the I10n bug, when language changes some pages have problem, 
// and the method of reloading the app is temporarily used to solve the problem.
// We will find the real problem and solve it later.
let Language = navigator.language,
  emailLocation = window.location,
  settings = window.navigator.mozSettings;

settings.addObserver('language.current', (evt) => {
  if (evt.settingValue) {
    if (evt.settingValue !== Language) {
      emailLocation.reload();
    }
  }
});

// Handles visibility changes: if the app becomes visible after starting up
// hidden because of an alarm, start showing some UI.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    if (!accountsSync.doSync && !addActivity) {
      accountsSync.syncAccounts();
    }
    if (!started && startupData && startupData.entry === 'alarm') {
      pushStartCard('message_list');
    }
    NavigationMap.checkStorage();
  } else {
    addActivity = false;
    if (!accountsSync.addChangedHandler) {
      accountsSync.onAccountsChange();
    }
    if (waitingRawActivity) {
      resetStatus();
    }
  }
}, false);

/*
 * Determines if current card is a nonsearch message_list
 * card, which is the default kind of card.
 */
function isCurrentCardMessageList() {
  let cardType = cards.getCurrentCardType();
  return (cardType && cardType === 'message_list');
}


// The add account UI flow is requested.
evt.on('addAccount', () => {
  cards.removeAllCards();

  // Show the first setup card again.
  pushStartCard('setup_account_info', {
    allowBack: true
  });
});

function resetApp(pageName) {
  // Clear any existing local state and reset UI/model state.
  activityCallback = waitingRawActivity = undefined;
  cards.removeAllCards();

  model.init(false, () => {
    let noAccount = !model.checkAccounts();
    if (noAccount) {
      htmlCache.reset();
      model.checkAccounts();
    }

    let cardId = noAccount ? 'welcome_page' :  (pageName? pageName :'message_list');
    pushStartCard(cardId);
  });
}

// An account was deleted. Burn it all to the ground and rise like a phoenix.
// Prefer a UI event vs. a slice listen to give flexibility about UI
// construction: an acctsSlice splice change may not warrant removing all the
// cards.
evt.on('accountDeleted', (account) => {
  accountsSync.removeAccount(account.name, account.authenticatorId);
  resetApp('settings_main');
});
evt.on('resetApp', resetApp);

// Called when account creation canceled, most likely from setup_account_info.
// Need to complete the activity postError flow if an activity is waiting, then
// update the UI to the latest state.
evt.on('setupAccountCanceled', (fromCard) => {
  if (waitingRawActivity) {
    waitingRawActivity.postError('cancelled');
  } else{
    resetStatus();
  }
});

function resetStatus() {
  if (!model.foldersSlice) {
    // No account has been formally initialized, but one likely exists given
    // that this back button should only be available for cases that have
    // accounts. Likely just need the app to reset to load model.
    evt.emit('resetApp');
  } else {
    cards.removeCardAndSuccessors(fromCard, 'delay-animate', 1);
  }
}

function showReEnableDialog(data) {
  let dialogConfig = {
    title: {
      id: 'confirmation-title',
      args: {}
    },
    body: {
      id: 'account-reEnable',
      args: {}
    },
    cancel: {
      l10nId: 'cancel',
      priority: 1
    },
    confirm: {
      l10nId: 'sync',
      priority: 3,
      callback: () => {
        if (data.id) {
          cards.removeAllCards();
          let account = model.getAccount(data.id);
            accountsSync.updateSyncInfo(account.name);
            model.changeAccount(account, () => {
              pushStartCard('message_list');
            });
        } else if (data.account) {
          accountsSync.updateSyncInfo(data.account.accountId);
        }
      }
    }
  };

  NavigationMap.showConfigDialog(dialogConfig);
}

evt.on('accountSyncChanged', (data) => {
  if (data.reEnable) {
    showReEnableDialog(data);
  } else {
    if (model.checkAccounts()) {
      let account = model.getAccount(data.id);
      let bDefault = account.isDefault;

      if (model.account.id === data.id) {
        if (!account.syncEnable) {
          let newAccount = model.getEnableAccount(data.id, bDefault);
          if (bDefault) {
            newAccount.modifyAccount({ setAsDefault: true });
          }
          cards.removeAllCards();
          model.changeAccount(newAccount, () => {
            pushStartCard('message_list');
          });
        } else {
          if (!bDefault) {
            account.modifyAccount({ setAsDefault: true });
          }
          cards.removeAllCards();
          model.changeAccount(account, () => {
            pushStartCard('message_list');
          });
        }
      } else {
        if (!model.account.syncEnable && account.syncEnable) {
          if (!bDefault) {
            account.modifyAccount({setAsDefault: true});
          }
          cards.removeAllCards();
          model.changeAccount(account, () => {
            pushStartCard('message_list');
          });
        } else {
          if (bDefault) {
            model.account.modifyAccount({setAsDefault: true});
          }
        }
      }
    } else {
      let card = cards.getCurrentCard();
      if (card.localName !== 'cards-welcome-page') {
        cards.removeAllCards();
        pushStartCard('welcome_page');
      }
    }
  }
});

// A request to show the latest account in the UI. Usually triggered after an
// account has been added.
evt.on('showLatestAccount', () => {
  cards.removeAllCards();
  if (!model.checkAccounts()) {
    pushStartCard('welcome_page');
    return;
  }

  model.latestOnce('acctsSlice', (acctsSlice) => {
    let account = acctsSlice.items[acctsSlice.items.length - 1];

    model.changeAccount(account, () => {
      pushStartCard('message_list', {
        // If waiting to complete an activity, do so after pushing the message
        // list card.
        onPushed: function() {
          if (activityCallback) {
            let activityCb = activityCallback;
            activityCallback = null;
            activityCb();
            return true;
          }
          return false;
        }
      });
    });
  });
});

let checkPassword = function(account, whichSide) {
  let checkedAccount = {
    accountId: account.username,
    authenticatorId: account.authenticatorId
  };
  navigator.accountManager.reauthenticate(checkedAccount,
    { password: account.password }).then(() => {
    console.log('Account:' + account.username + '\'s password changed');
  }, () => {
    console.log('Account:' + account.username + ' change password failed');
    cards.pushCard('setup_fix_password', 'animate',
      { account: account,
        whichSide: whichSide,
        restoreCard: cards.activeCardIndex },
      'right');
  });
};
// In case the account information is not synchronized, add a delay of 5 seconds
let waitAndCheck = function(callback) {
  let i = 0;
  let timer = setInterval(() => {
    i++;
   if (!accountsSync.doSync) {
     clearInterval(timer);
     callback();
   } else if (i === 5) {
     clearInterval(timer);
   }
 }, 1000);
};
evt.on('apiBadLogin', (account, problem, whichSide) => {
  switch (problem) {
    case 'bad-user-or-pass':
      if (account.type === 'activesync') {
        if (accountsSync.doSync) {
          waitAndCheck(() => {
            checkPassword(account, whichSide);
          });
        } else {
          checkPassword(account, whichSide);
        }
      } else {
        cards.pushCard('setup_fix_password', 'animate',
          { account: account,
            whichSide: whichSide,
            restoreCard: cards.activeCardIndex },
          'right');
      }
      break;
    case 'imap-disabled':
    case 'pop3-disabled':
      cards.pushCard('setup_fix_gmail', 'animate',
                { account: account, restoreCard: cards.activeCardIndex },
                'right');
      break;
    case 'needs-app-pass':
      cards.pushCard('setup_fix_gmail_twofactor', 'animate',
                { account: account, restoreCard: cards.activeCardIndex },
                'right');
      break;
    case 'needs-oauth-reauth':
      cards.pushCard('setup_fix_oauth2', 'animate',
                { account: account, restoreCard: cards.activeCardIndex },
                'right');
      break;
  }
});

// Start init of main view/model modules now that all the registrations for
// top level events have happened, and before triggering of entry points start.
cards.init();
// If config could have already started up the model if there was no cache set
// up, so only trigger init if it is not already started up, for efficiency.
if (!model.inited) {
  model.init();
}

/**
 * Register setMozMessageHandler listeners with the plumbing set up in
 * html_cache_restore
 */
let startupData = globalOnAppMessage({
  activity: function(rawActivity) {
    // Remove previous cards because the card stack could get weird if inserting
    // a new card that would not normally be at that stack level. Primary
    // concern: going to settings, then trying to add a compose card at that
    // stack level. More importantly, the added card could have a "back"
    // operation that does not mean "back to previous state", but "back in
    // application flowchart". Message list is a good known jump point, so do
    // not needlessly wipe that one out if it is the current one.
    if (!isCurrentCardMessageList() &&
        rawActivity.source.data.owner !== 'email') {
      cards.removeAllCards();
    }

    function activityCompose() {
      let cardArgs = {
        activity: rawActivity,
        composerData: activityComposerData(rawActivity)
      };

      pushStartCard('compose', cardArgs);
    }

    if (rawActivity.source.name === 'setup') {
      pushStartCard('setup_manual_config', {
        displayName: '',
        emailAddress: '',
        activity: rawActivity
      });
      addActivity = true;
      accountsSync.updateAccounts(true);
    } else if (globalOnAppMessage.hasAccount()) {
      activityCompose();
    } else {
      activityCallback = activityCompose;
      waitingRawActivity = rawActivity;
      pushStartCard('setup_account_info', {
        allowBack: true,
        launchedFromActivity: true
      });
    }
  },

  notification: function(data) {
    data = data || {};
    let type = data.type || '';
    let folderType = data.folderType || 'inbox';

    model.latestOnce('foldersSlice', () => {
      function onCorrectFolder() {
        // Remove previous cards because the card stack could get weird if
        // inserting a new card that would not normally be at that stack level.
        // Primary concern: going to settings, then trying to add a reader or
        // message list card at that stack level. More importantly, the added
        // card could have a "back" operation that does not mean "back to
        // previous state", but "back in application flowchart". Message list is
        // a good known jump point, so do not needlessly wipe that one out if it
        // is the current one.
        if (!isCurrentCardMessageList()) {
          cards.removeAllCards();
        }
        if (type === 'message_list') {
          cards.removeAllCards();
          pushStartCard('message_list', {});
        } else if (type === 'message_reader') {
          headerCursor.setCurrentMessageBySuid(data.messageSuid);

          window.performance.mark('mail-load-start');
          pushStartCard(type, {
            messageSuid: data.messageSuid
          });
        } else {
          console.error('unhandled notification type: ' + type);
        }
      }

      let acctsSlice = model.acctsSlice,
          accountId = data.accountId;

      if (model.account.id === accountId) {
        // folderType will often be 'inbox' (in the case of a new message
        // notification) or 'outbox' (in the case of a "failed send"
        // notification).
        return model.selectFirstFolderWithType(folderType, onCorrectFolder);
      } else {
        let newAccount;
        acctsSlice.items.some((account) => {
          if (account.id === accountId) {
            newAccount = account;
            return true;
          }
        });

        if (newAccount) {
          model.changeAccount(newAccount, () => {
            model.selectFirstFolderWithType(folderType, onCorrectFolder);
          });
        }
      }
    });
  }
});

console.log('startupData: ' + JSON.stringify(startupData, null, '  '));

// If not a mozSetMessageHandler entry point, start up the UI now. Or, if
// an alarm started the app, but the app became visible during the
// startup. In that case, make sure we show something to the user.
if (startupData.entry === 'default' ||
   (startupData.entry === 'alarm' && !document.hidden)) {
  pushStartCard(startupData.view);
  if (navigator.connection.type === 'none') {
    toaster.toast({
      text: mozL10n.get('no-internet-connection')
    });
  }
  accountsSync.syncAccounts();
  NavigationMap.checkStorage();
}

});

/*global requirejs, TestUrlResolver */


// Set up loading of scripts, but only if not in tests, which set up their own
// config.
if (typeof TestUrlResolver === 'undefined') {
  requirejs.config({
    // waitSeconds is set to the default here; the build step rewrites it to 0
    // in build/email.build.js so that we never timeout waiting for modules in
    // production. This is important when the device is under super-low-memory
    // stress, as it may take a while for the device to get around to loading
    // things email needs for background tasks like periodic sync.
    waitSeconds: 0,
    baseUrl: 'js',
    paths: {
      l10nbase: '../shared/js/l10n',
      l10ndate: '../shared/js/l10n_date',
      style: '../style',
      shared: '../shared'
    },
     map: {
      '*': {
        'api': 'ext/main-frame-setup'
      }
    },
    shim: {
      l10ndate: ['l10nbase'],

      'shared/js/mime_mapper': {
        exports: 'MimeMapper'
      },

      'shared/js/notification_helper': {
        exports: 'NotificationHelper'
      },

      'shared/js/accessibility_helper': {
        exports: 'AccessibilityHelper'
      }
    },
    config: {
      template: {
        tagToId: function(tag) {
          return tag.replace(/^cards-/, 'cards/').replace(/-/g, '_');
        }
      }
    },
    definePrim: 'prim'
  });
}

// Tell audio channel manager that we want to adjust the notification channel if
// the user press the volumeup/volumedown buttons in Email.
if (navigator.mozAudioChannelManager) {
  navigator.mozAudioChannelManager.volumeControlChannel = 'notification';
}

// startupOnModelLoaded can be set to a function in html_cache_restore. In that
// case, html_cache_restore needs to know the model state, if there is an
// account, before proceeding with the startup view to select.
if (window.startupOnModelLoaded) {
  requirejs(['console_hook', 'model'], (hook, model) => {
    model.init();
    window.startupOnModelLoaded(model, () => {
      require(['mail_app']);
    });
  });
} else {
  // Run the app module, bring in fancy logging
  requirejs(['console_hook', 'mail_app']);
}
;
define("config", function(){});

(function(window, undefined) {

  

  /* jshint validthis:true */
  function L10nError(message, id, loc) {
    this.name = 'L10nError';
    this.message = message;
    this.id = id;
    this.loc = loc;
  }
  L10nError.prototype = Object.create(Error.prototype);
  L10nError.prototype.constructor = L10nError;


  /* jshint browser:true */

  var io = {

    _load: function(type, url, callback, sync) {
      var xhr = new XMLHttpRequest();
      var needParse;

      if (xhr.overrideMimeType) {
        xhr.overrideMimeType(type);
      }

      xhr.open('GET', url, !sync);

      if (type === 'application/json') {
        //  Gecko 11.0+ forbids the use of the responseType attribute when
        //  performing sync requests (NS_ERROR_DOM_INVALID_ACCESS_ERR).
        //  We'll need to JSON.parse manually.
        if (sync) {
          needParse = true;
        } else {
          xhr.responseType = 'json';
        }
      }

      xhr.addEventListener('load', function io_onload(e) {
        if (e.target.status === 200 || e.target.status === 0) {
          // Sinon.JS's FakeXHR doesn't have the response property
          var res = e.target.response || e.target.responseText;
          callback(null, needParse ? JSON.parse(res) : res);
        } else {
          callback(new L10nError('Not found: ' + url));
        }
      });
      xhr.addEventListener('error', callback);
      xhr.addEventListener('timeout', callback);

      // the app: protocol throws on 404, see https://bugzil.la/827243
      try {
        xhr.send(null);
      } catch (e) {
        callback(new L10nError('Not found: ' + url));
      }
    },

    load: function(url, callback, sync) {
      return io._load('text/plain', url, callback, sync);
    },

    loadJSON: function(url, callback, sync) {
      return io._load('application/json', url, callback, sync);
    }

  };

  function EventEmitter() {}

  EventEmitter.prototype.emit = function ee_emit() {
    if (!this._listeners) {
      return;
    }

    var args = Array.prototype.slice.call(arguments);
    var type = args.shift();
    if (!this._listeners[type]) {
      return;
    }

    var typeListeners = this._listeners[type].slice();
    for (var i = 0; i < typeListeners.length; i++) {
      typeListeners[i].apply(this, args);
    }
  };

  EventEmitter.prototype.addEventListener = function ee_add(type, listener) {
    if (!this._listeners) {
      this._listeners = {};
    }
    if (!(type in this._listeners)) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(listener);
  };

  EventEmitter.prototype.removeEventListener = function ee_rm(type, listener) {
    if (!this._listeners) {
      return;
    }

    var typeListeners = this._listeners[type];
    var pos = typeListeners.indexOf(listener);
    if (pos === -1) {
      return;
    }

    typeListeners.splice(pos, 1);
  };


  function getPluralRule(lang) {
    var locales2rules = {
      'af': 3,
      'ak': 4,
      'am': 4,
      'ar': 1,
      'asa': 3,
      'az': 0,
      'be': 11,
      'bem': 3,
      'bez': 3,
      'bg': 3,
      'bh': 4,
      'bm': 0,
      'bn': 3,
      'bo': 0,
      'br': 20,
      'brx': 3,
      'bs': 11,
      'ca': 3,
      'cgg': 3,
      'chr': 3,
      'cs': 12,
      'cy': 17,
      'da': 3,
      'de': 3,
      'dv': 3,
      'dz': 0,
      'ee': 3,
      'el': 3,
      'en': 3,
      'eo': 3,
      'es': 3,
      'et': 3,
      'eu': 3,
      'fa': 0,
      'ff': 5,
      'fi': 3,
      'fil': 4,
      'fo': 3,
      'fr': 5,
      'fur': 3,
      'fy': 3,
      'ga': 8,
      'gd': 24,
      'gl': 3,
      'gsw': 3,
      'gu': 3,
      'guw': 4,
      'gv': 23,
      'ha': 3,
      'haw': 3,
      'he': 2,
      'hi': 4,
      'hr': 11,
      'hu': 0,
      'id': 0,
      'ig': 0,
      'ii': 0,
      'is': 3,
      'it': 3,
      'iu': 7,
      'ja': 0,
      'jmc': 3,
      'jv': 0,
      'ka': 0,
      'kab': 5,
      'kaj': 3,
      'kcg': 3,
      'kde': 0,
      'kea': 0,
      'kk': 3,
      'kl': 3,
      'km': 0,
      'kn': 0,
      'ko': 0,
      'ksb': 3,
      'ksh': 21,
      'ku': 3,
      'kw': 7,
      'lag': 18,
      'lb': 3,
      'lg': 3,
      'ln': 4,
      'lo': 0,
      'lt': 10,
      'lv': 6,
      'mas': 3,
      'mg': 4,
      'mk': 16,
      'ml': 3,
      'mn': 3,
      'mo': 9,
      'mr': 3,
      'ms': 0,
      'mt': 15,
      'my': 0,
      'nah': 3,
      'naq': 7,
      'nb': 3,
      'nd': 3,
      'ne': 3,
      'nl': 3,
      'nn': 3,
      'no': 3,
      'nr': 3,
      'nso': 4,
      'ny': 3,
      'nyn': 3,
      'om': 3,
      'or': 3,
      'pa': 3,
      'pap': 3,
      'pl': 13,
      'ps': 3,
      'pt': 3,
      'rm': 3,
      'ro': 9,
      'rof': 3,
      'ru': 11,
      'rwk': 3,
      'sah': 0,
      'saq': 3,
      'se': 7,
      'seh': 3,
      'ses': 0,
      'sg': 0,
      'sh': 11,
      'shi': 19,
      'sk': 12,
      'sl': 14,
      'sma': 7,
      'smi': 7,
      'smj': 7,
      'smn': 7,
      'sms': 7,
      'sn': 3,
      'so': 3,
      'sq': 3,
      'sr': 11,
      'ss': 3,
      'ssy': 3,
      'st': 3,
      'sv': 3,
      'sw': 3,
      'syr': 3,
      'ta': 3,
      'te': 3,
      'teo': 3,
      'th': 0,
      'ti': 4,
      'tig': 3,
      'tk': 3,
      'tl': 4,
      'tn': 3,
      'to': 0,
      'tr': 0,
      'ts': 3,
      'tzm': 22,
      'uk': 11,
      'ur': 3,
      've': 3,
      'vi': 0,
      'vun': 3,
      'wa': 4,
      'wae': 3,
      'wo': 0,
      'xh': 3,
      'xog': 3,
      'yo': 0,
      'zh': 0,
      'zu': 3
    };

    // utility functions for plural rules methods
    function isIn(n, list) {
      return list.indexOf(n) !== -1;
    }
    function isBetween(n, start, end) {
      return typeof n === typeof start && start <= n && n <= end;
    }

    // list of all plural rules methods:
    // map an integer to the plural form name to use
    var pluralRules = {
      '0': function() {
        return 'other';
      },
      '1': function(n) {
        if ((isBetween((n % 100), 3, 10))) {
          return 'few';
        }
        if (n === 0) {
          return 'zero';
        }
        if ((isBetween((n % 100), 11, 99))) {
          return 'many';
        }
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '2': function(n) {
        if (n !== 0 && (n % 10) === 0) {
          return 'many';
        }
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '3': function(n) {
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '4': function(n) {
        if ((isBetween(n, 0, 1))) {
          return 'one';
        }
        return 'other';
      },
      '5': function(n) {
        if ((isBetween(n, 0, 2)) && n !== 2) {
          return 'one';
        }
        return 'other';
      },
      '6': function(n) {
        if (n === 0) {
          return 'zero';
        }
        if ((n % 10) === 1 && (n % 100) !== 11) {
          return 'one';
        }
        return 'other';
      },
      '7': function(n) {
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '8': function(n) {
        if ((isBetween(n, 3, 6))) {
          return 'few';
        }
        if ((isBetween(n, 7, 10))) {
          return 'many';
        }
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '9': function(n) {
        if (n === 0 || n !== 1 && (isBetween((n % 100), 1, 19))) {
          return 'few';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '10': function(n) {
        if ((isBetween((n % 10), 2, 9)) && !(isBetween((n % 100), 11, 19))) {
          return 'few';
        }
        if ((n % 10) === 1 && !(isBetween((n % 100), 11, 19))) {
          return 'one';
        }
        return 'other';
      },
      '11': function(n) {
        if ((isBetween((n % 10), 2, 4)) && !(isBetween((n % 100), 12, 14))) {
          return 'few';
        }
        if ((n % 10) === 0 ||
            (isBetween((n % 10), 5, 9)) ||
            (isBetween((n % 100), 11, 14))) {
          return 'many';
        }
        if ((n % 10) === 1 && (n % 100) !== 11) {
          return 'one';
        }
        return 'other';
      },
      '12': function(n) {
        if ((isBetween(n, 2, 4))) {
          return 'few';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '13': function(n) {
        if ((isBetween((n % 10), 2, 4)) && !(isBetween((n % 100), 12, 14))) {
          return 'few';
        }
        if (n !== 1 && (isBetween((n % 10), 0, 1)) ||
            (isBetween((n % 10), 5, 9)) ||
            (isBetween((n % 100), 12, 14))) {
          return 'many';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '14': function(n) {
        if ((isBetween((n % 100), 3, 4))) {
          return 'few';
        }
        if ((n % 100) === 2) {
          return 'two';
        }
        if ((n % 100) === 1) {
          return 'one';
        }
        return 'other';
      },
      '15': function(n) {
        if (n === 0 || (isBetween((n % 100), 2, 10))) {
          return 'few';
        }
        if ((isBetween((n % 100), 11, 19))) {
          return 'many';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '16': function(n) {
        if ((n % 10) === 1 && n !== 11) {
          return 'one';
        }
        return 'other';
      },
      '17': function(n) {
        if (n === 3) {
          return 'few';
        }
        if (n === 0) {
          return 'zero';
        }
        if (n === 6) {
          return 'many';
        }
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '18': function(n) {
        if (n === 0) {
          return 'zero';
        }
        if ((isBetween(n, 0, 2)) && n !== 0 && n !== 2) {
          return 'one';
        }
        return 'other';
      },
      '19': function(n) {
        if ((isBetween(n, 2, 10))) {
          return 'few';
        }
        if ((isBetween(n, 0, 1))) {
          return 'one';
        }
        return 'other';
      },
      '20': function(n) {
        if ((isBetween((n % 10), 3, 4) || ((n % 10) === 9)) && !(
            isBetween((n % 100), 10, 19) ||
            isBetween((n % 100), 70, 79) ||
            isBetween((n % 100), 90, 99)
            )) {
          return 'few';
        }
        if ((n % 1000000) === 0 && n !== 0) {
          return 'many';
        }
        if ((n % 10) === 2 && !isIn((n % 100), [12, 72, 92])) {
          return 'two';
        }
        if ((n % 10) === 1 && !isIn((n % 100), [11, 71, 91])) {
          return 'one';
        }
        return 'other';
      },
      '21': function(n) {
        if (n === 0) {
          return 'zero';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '22': function(n) {
        if ((isBetween(n, 0, 1)) || (isBetween(n, 11, 99))) {
          return 'one';
        }
        return 'other';
      },
      '23': function(n) {
        if ((isBetween((n % 10), 1, 2)) || (n % 20) === 0) {
          return 'one';
        }
        return 'other';
      },
      '24': function(n) {
        if ((isBetween(n, 3, 10) || isBetween(n, 13, 19))) {
          return 'few';
        }
        if (isIn(n, [2, 12])) {
          return 'two';
        }
        if (isIn(n, [1, 11])) {
          return 'one';
        }
        return 'other';
      }
    };

    // return a function that gives the plural form name for a given integer
    var index = locales2rules[lang.replace(/-.*$/, '')];
    if (!(index in pluralRules)) {
      return function() { return 'other'; };
    }
    return pluralRules[index];
  }




  var MAX_PLACEABLES = 100;


  var PropertiesParser = {
    patterns: null,
    entryIds: null,

    init: function() {
      this.patterns = {
        comment: /^\s*#|^\s*$/,
        entity: /^([^=\s]+)\s*=\s*(.*)$/,
        multiline: /[^\\]\\$/,
        index: /\{\[\s*(\w+)(?:\(([^\)]*)\))?\s*\]\}/i,
        unicode: /\\u([0-9a-fA-F]{1,4})/g,
        entries: /[^\r\n]+/g,
        controlChars: /\\([\\\n\r\t\b\f\{\}\"\'])/g,
        placeables: /\{\{\s*([^\s]*?)\s*\}\}/,
      };
    },

    parse: function(ctx, source) {
      if (!this.patterns) {
        this.init();
      }

      var ast = [];
      this.entryIds = Object.create(null);

      var entries = source.match(this.patterns.entries);
      if (!entries) {
        return ast;
      }
      for (var i = 0; i < entries.length; i++) {
        var line = entries[i];

        if (this.patterns.comment.test(line)) {
          continue;
        }

        while (this.patterns.multiline.test(line) && i < entries.length) {
          line = line.slice(0, -1) + entries[++i].trim();
        }

        var entityMatch = line.match(this.patterns.entity);
        if (entityMatch) {
          try {
            this.parseEntity(entityMatch[1], entityMatch[2], ast);
          } catch (e) {
            if (ctx) {
              ctx._emitter.emit('parseerror', e);
            } else {
              throw e;
            }
          }
        }
      }
      return ast;
    },

    parseEntity: function(id, value, ast) {
      var name, key;

      var pos = id.indexOf('[');
      if (pos !== -1) {
        name = id.substr(0, pos);
        key = id.substring(pos + 1, id.length - 1);
      } else {
        name = id;
        key = null;
      }

      var nameElements = name.split('.');

      if (nameElements.length > 2) {
        throw new L10nError('Error in ID: "' + name + '".' +
            ' Nested attributes are not supported.');
      }

      var attr;
      if (nameElements.length > 1) {
        name = nameElements[0];
        attr = nameElements[1];

        if (attr[0] === '$') {
          throw new L10nError('Attribute can\'t start with "$"', id);
        }
      } else {
        attr = null;
      }

      this.setEntityValue(name, attr, key, this.unescapeString(value), ast);
    },

    setEntityValue: function(id, attr, key, rawValue, ast) {
      var pos, v;

      var value = rawValue.indexOf('{{') > -1 ?
        this.parseString(rawValue) : rawValue;

      if (rawValue.indexOf('<') > -1 || rawValue.indexOf('&') > -1) {
        value = { $o: value };
      }

      if (attr) {
        pos = this.entryIds[id];
        if (pos === undefined) {
          v = {$i: id};
          if (key) {
            v[attr] = {};
            v[attr][key] = value;
          } else {
            v[attr] = value;
          }
          ast.push(v);
          this.entryIds[id] = ast.length - 1;
          return;
        }
        if (key) {
          if (typeof(ast[pos][attr]) === 'string') {
            ast[pos][attr] = {
              $x: this.parseIndex(ast[pos][attr]),
              $v: {}
            };
          }
          ast[pos][attr].$v[key] = value;
          return;
        }
        ast[pos][attr] = value;
        return;
      }

      // Hash value
      if (key) {
        pos = this.entryIds[id];
        if (pos === undefined) {
          v = {};
          v[key] = value;
          ast.push({$i: id, $v: v});
          this.entryIds[id] = ast.length - 1;
          return;
        }
        if (typeof(ast[pos].$v) === 'string') {
          ast[pos].$x = this.parseIndex(ast[pos].$v);
          ast[pos].$v = {};
        }
        ast[pos].$v[key] = value;
        return;
      }

      // simple value
      ast.push({$i: id, $v: value});
      this.entryIds[id] = ast.length - 1;
    },

    parseString: function(str) {
      var chunks = str.split(this.patterns.placeables);
      var complexStr = [];

      var len = chunks.length;
      var placeablesCount = (len - 1) / 2;

      if (placeablesCount >= MAX_PLACEABLES) {
        throw new L10nError('Too many placeables (' + placeablesCount +
                            ', max allowed is ' + MAX_PLACEABLES + ')');
      }

      for (var i = 0; i < chunks.length; i++) {
        if (chunks[i].length === 0) {
          continue;
        }
        if (i % 2 === 1) {
          complexStr.push({t: 'idOrVar', v: chunks[i]});
        } else {
          complexStr.push(chunks[i]);
        }
      }
      return complexStr;
    },

    unescapeString: function(str) {
      if (str.lastIndexOf('\\') !== -1) {
        str = str.replace(this.patterns.controlChars, '$1');
      }
      return str.replace(this.patterns.unicode, function(match, token) {
        return unescape('%u' + '0000'.slice(token.length) + token);
      });
    },

    parseIndex: function(str) {
      var match = str.match(this.patterns.index);
      if (!match) {
        throw new L10nError('Malformed index');
      }
      if (match[2]) {
        return [{t: 'idOrVar', v: match[1]}, match[2]];
      } else {
        return [{t: 'idOrVar', v: match[1]}];
      }
    }
  };



  var KNOWN_MACROS = ['plural'];

  var MAX_PLACEABLE_LENGTH = 2500;
  var rePlaceables = /\{\{\s*(.+?)\s*\}\}/g;

  // Matches characters outside of the Latin-1 character set
  var nonLatin1 = /[^\x01-\xFF]/;

  // Unicode bidi isolation characters
  var FSI = '\u2068';
  var PDI = '\u2069';

  function createEntry(node, env) {
    var keys = Object.keys(node);

    // the most common scenario: a simple string with no arguments
    if (typeof node.$v === 'string' && keys.length === 2) {
      return node.$v;
    }

    var attrs;

    /* jshint -W084 */
    for (var i = 0, key; key = keys[i]; i++) {
      if (key[0] === '$') {
        continue;
      }

      if (!attrs) {
        attrs = Object.create(null);
      }
      attrs[key] = createAttribute(node[key], env, node.$i + '.' + key);
    }

    return {
      id: node.$i,
      value: node.$v !== undefined ? node.$v : null,
      index: node.$x || null,
      attrs: attrs || null,
      env: env,
      // the dirty guard prevents cyclic or recursive references
      dirty: false
    };
  }

  function createAttribute(node, env, id) {
    if (typeof node === 'string') {
      return node;
    }

    return {
      id: id,
      value: node.$v || (node !== undefined ? node : null),
      index: node.$x || null,
      env: env,
      dirty: false
    };
  }


  function format(args, entity) {
    var locals = {
      overlay: false
    };

    if (typeof entity === 'string') {
      return [locals, entity];
    }

    if (entity.dirty) {
      throw new L10nError('Cyclic reference detected: ' + entity.id);
    }

    entity.dirty = true;

    var rv;

    // if format fails, we want the exception to bubble up and stop the whole
    // resolving process;  however, we still need to clean up the dirty flag
    try {
      rv = resolveValue(locals, args, entity.env, entity.value, entity.index);
    } finally {
      entity.dirty = false;
    }
    return rv;
  }

  function resolveIdentifier(args, env, id) {
    if (KNOWN_MACROS.indexOf(id) > -1) {
      return [{}, env['__' + id]];
    }

    if (args && args.hasOwnProperty(id)) {
      if (typeof args[id] === 'string' || (typeof args[id] === 'number' &&
          !isNaN(args[id]))) {
        return [{}, args[id]];
      } else {
        throw new L10nError('Arg must be a string or a number: ' + id);
      }
    }

    // XXX: special case for Node.js where still:
    // '__proto__' in Object.create(null) => true
    if (id in env && id !== '__proto__') {
      return format(args, env[id]);
    }

    throw new L10nError('Unknown reference: ' + id);
  }

  function subPlaceable(locals, args, env, id) {
    var res;

    try {
      res = resolveIdentifier(args, env, id);
    } catch (err) {
      return [{ error: err }, '{{ ' + id + ' }}'];
    }

    var value = res[1];

    if (typeof value === 'number') {
      return res;
    }

    if (typeof value === 'string') {
      // prevent Billion Laughs attacks
      if (value.length >= MAX_PLACEABLE_LENGTH) {
        throw new L10nError('Too many characters in placeable (' +
                            value.length + ', max allowed is ' +
                            MAX_PLACEABLE_LENGTH + ')');
      }

      if (locals.contextIsNonLatin1 || value.match(nonLatin1)) {
        // When dealing with non-Latin-1 text
        // we wrap substitutions in bidi isolate characters
        // to avoid bidi issues.
        res[1] = FSI + value + PDI;
      }

      return res;
    }

    return [{}, '{{ ' + id + ' }}'];
  }

  function interpolate(locals, args, env, arr) {
    return arr.reduce(function(prev, cur) {
      if (typeof cur === 'string') {
        return [prev[0], prev[1] + cur];
      } else if (cur.t === 'idOrVar'){
        var placeable = subPlaceable(locals, args, env, cur.v);
        if (placeable[0].overlay) {
          prev[0].overlay = true;
        }
        return [prev[0], prev[1] + placeable[1]];
      }
    }, [locals, '']);
  }

  function resolveSelector(args, env, expr, index) {
      var selectorName = index[0].v;
      var selector = resolveIdentifier(args, env, selectorName)[1];

      if (typeof selector !== 'function') {
        // selector is a simple reference to an entity or args
        return selector;
      }

      var argValue = index[1] ?
        resolveIdentifier(args, env, index[1])[1] : undefined;

      if (selector === env.__plural) {
        // special cases for zero, one, two if they are defined on the hash
        if (argValue === 0 && 'zero' in expr) {
          return 'zero';
        }
        if (argValue === 1 && 'one' in expr) {
          return 'one';
        }
        if (argValue === 2 && 'two' in expr) {
          return 'two';
        }
      }

      return selector(argValue);
  }

  function resolveValue(locals, args, env, expr, index) {
    if (!expr) {
      return [locals, expr];
    }

    if (expr.$o) {
      expr = expr.$o;
      locals.overlay = true;
    }

    if (typeof expr === 'string' ||
        typeof expr === 'boolean' ||
        typeof expr === 'number') {
      return [locals, expr];
    }

    if (Array.isArray(expr)) {
      locals.contextIsNonLatin1 = expr.some(function($_) {
        return typeof($_) === 'string' && $_.match(nonLatin1);
      });
      return interpolate(locals, args, env, expr);
    }

    // otherwise, it's a dict
    if (index) {
      // try to use the index in order to select the right dict member
      var selector = resolveSelector(args, env, expr, index);
      if (expr.hasOwnProperty(selector)) {
        return resolveValue(locals, args, env, expr[selector]);
      }
    }

    // if there was no index or no selector was found, try 'other'
    if ('other' in expr) {
      return resolveValue(locals, args, env, expr.other);
    }

    // XXX Specify entity id
    throw new L10nError('Unresolvable value');
  }

  var Resolver = {
    createEntry: createEntry,
    format: format,
    rePlaceables: rePlaceables
  };



  /* Utility functions */

  // Recursively walk an AST node searching for content leaves
  function walkContent(node, fn) {
    if (typeof node === 'string') {
      return fn(node);
    }

    if (node.t === 'idOrVar') {
      return node;
    }

    var rv = Array.isArray(node) ? [] : {};
    var keys = Object.keys(node);

    /* jshint boss:true */
    for (var i = 0, key; key = keys[i]; i++) {
      // don't change identifier ($i) nor indices ($x)
      if (key === '$i' || key === '$x') {
        rv[key] = node[key];
      } else {
        rv[key] = walkContent(node[key], fn);
      }
    }
    return rv;
  }


  /* Pseudolocalizations
   *
   * PSEUDO_STRATEGIES is a dict of strategies to be used to modify the English
   * context in order to create pseudolocalizations.  These can be used by
   * developers to test the localizability of their code without having to
   * actually speak a foreign language.
   *
   * Currently, the following pseudolocales are supported:
   *
   *   qps-ploc - Ȧȧƈƈḗḗƞŧḗḗḓ Ḗḗƞɠŀīīşħ
   *
   *     In Accented English all English letters are replaced by accented
   *     Unicode counterparts which don't impair the readability of the content.
   *     This allows developers to quickly test if any given string is being
   *     correctly displayed in its 'translated' form.  Additionally, simple
   *     heuristics are used to make certain words longer to better simulate the
   *     experience of international users.
   *
   *   qps-plocm - ɥsıʅƃuƎ pǝɹoɹɹıW
   *
   *     Mirrored English is a fake RTL locale.  All words are surrounded by
   *     Unicode formatting marks forcing the RTL directionality of characters.
   *     In addition, to make the reversed text easier to read, individual
   *     letters are flipped.
   *
   *     Note: The name above is hardcoded to be RTL in case code editors have
   *     trouble with the RLO and PDF Unicode marks.  In reality, it should be
   *     surrounded by those marks as well.
   *
   * See https://bugzil.la/900182 for more information.
   *
   */

  var reAlphas = /[a-zA-Z]/g;
  var reVowels = /[aeiouAEIOU]/g;

  // ȦƁƇḒḖƑƓĦĪĴĶĿḾȠǾƤɊŘŞŦŬṼẆẊẎẐ + [\\]^_` + ȧƀƈḓḗƒɠħīĵķŀḿƞǿƥɋřşŧŭṽẇẋẏẑ
  var ACCENTED_MAP = '\u0226\u0181\u0187\u1E12\u1E16\u0191\u0193\u0126\u012A' +
                     '\u0134\u0136\u013F\u1E3E\u0220\u01FE\u01A4\u024A\u0158' +
                     '\u015E\u0166\u016C\u1E7C\u1E86\u1E8A\u1E8E\u1E90' +
                     '[\\]^_`' +
                     '\u0227\u0180\u0188\u1E13\u1E17\u0192\u0260\u0127\u012B' +
                     '\u0135\u0137\u0140\u1E3F\u019E\u01FF\u01A5\u024B\u0159' +
                     '\u015F\u0167\u016D\u1E7D\u1E87\u1E8B\u1E8F\u1E91';

  // XXX Until https://bugzil.la/1007340 is fixed, ᗡℲ⅁⅂⅄ don't render correctly
  // on the devices.  For now, use the following replacements: pɟפ˥ʎ
  // ∀ԐↃpƎɟפHIſӼ˥WNOԀÒᴚS⊥∩ɅＭXʎZ + [\\]ᵥ_, + ɐqɔpǝɟƃɥıɾʞʅɯuodbɹsʇnʌʍxʎz
  var FLIPPED_MAP = '\u2200\u0510\u2183p\u018E\u025F\u05E4HI\u017F' +
                    '\u04FC\u02E5WNO\u0500\xD2\u1D1AS\u22A5\u2229\u0245' +
                    '\uFF2DX\u028EZ' +
                    '[\\]\u1D65_,' +
                    '\u0250q\u0254p\u01DD\u025F\u0183\u0265\u0131\u027E' +
                    '\u029E\u0285\u026Fuodb\u0279s\u0287n\u028C\u028Dx\u028Ez';

  function makeLonger(val) {
    return val.replace(reVowels, function(match) {
      return match + match.toLowerCase();
    });
  }

  function makeAccented(map, val) {
    // Replace each Latin letter with a Unicode character from map
    return val.replace(reAlphas, function(match) {
      return map.charAt(match.charCodeAt(0) - 65);
    });
  }

  var reWords = /[^\W0-9_]+/g;

  function makeRTL(val) {
    // Surround each word with Unicode formatting codes, RLO and PDF:
    //   U+202E:   RIGHT-TO-LEFT OVERRIDE (RLO)
    //   U+202C:   POP DIRECTIONAL FORMATTING (PDF)
    // See http://www.w3.org/International/questions/qa-bidi-controls
    return val.replace(reWords, function(match) {
      return '\u202e' + match + '\u202c';
    });
  }

  // strftime tokens (%a, %Eb) and template {vars}
  var reExcluded = /(%[EO]?\w|\{\s*.+?\s*\})/;

  function mapContent(fn, val) {
    if (!val) {
      return val;
    }
    var parts = val.split(reExcluded);
    var modified = parts.map(function(part) {
      if (reExcluded.test(part)) {
        return part;
      }
      return fn(part);
    });
    return modified.join('');
  }

  function Pseudo(id, name, charMap, modFn) {
    this.id = id;
    this.translate = mapContent.bind(null, function(val) {
      return makeAccented(charMap, modFn(val));
    });
    this.name = this.translate(name);
  }

  var PSEUDO_STRATEGIES = {
    'qps-ploc': new Pseudo('qps-ploc', 'Accented English',
                           ACCENTED_MAP, makeLonger),
    'qps-plocm': new Pseudo('qps-plocm', 'Mirrored English',
                            FLIPPED_MAP, makeRTL)
  };



  function Locale(id, ctx) {
    this.id = id;
    this.ctx = ctx;
    this.isReady = false;
    this.isPseudo = PSEUDO_STRATEGIES.hasOwnProperty(id);
    this.entries = Object.create(null);
    this.entries.__plural = getPluralRule(this.isPseudo ?
                                          this.ctx.defaultLocale : id);
  }

  var bindingsIO = {
    extra: function(id, ver, path, type, callback, errback, sync) {
      if (type === 'properties') {
        type = 'text';
      }
      navigator.mozApps.getLocalizationResource(id, ver, path, type).
        then(callback.bind(null, null), errback);
    },
    app: function(id, ver, path, type, callback, errback, sync) {
      switch (type) {
        case 'properties':
          io.load(path, callback, sync);
          break;
        case 'json':
          io.loadJSON(path, callback, sync);
          break;
      }
    },
  };

  Locale.prototype.build = function L_build(callback) {
    var sync = !callback;
    var ctx = this.ctx;
    var self = this;

    var l10nLoads = ctx.resLinks.length;

    function onL10nLoaded(err) {
      if (err) {
        ctx._emitter.emit('fetcherror', err);
      }
      if (--l10nLoads <= 0) {
        self.isReady = true;
        if (callback) {
          callback();
        }
      }
    }

    if (l10nLoads === 0) {
      onL10nLoaded();
      return;
    }

    function onJSONLoaded(err, json) {
      if (!err && json) {
        self.addAST(json);
      }
      onL10nLoaded(err);
    }

    function onPropLoaded(err, source) {
      if (!err && source) {
        var ast = PropertiesParser.parse(ctx, source);
        self.addAST(ast);
      }
      onL10nLoaded(err);
    }

    var idToFetch = this.isPseudo ? ctx.defaultLocale : this.id;
    var source = navigator.mozL10n._config.localeSources[this.id] || 'app';
    var appVersion = navigator.mozL10n._config.appVersion;

    for (var i = 0; i < ctx.resLinks.length; i++) {
      var resLink = decodeURI(ctx.resLinks[i]);
      var path = resLink.replace('{locale}', idToFetch);
      var type = path.substr(path.lastIndexOf('.') + 1);

      var cb;
      switch (type) {
        case 'json':
          cb = onJSONLoaded;
          break;
        case 'properties':
          cb = onPropLoaded;
          break;
      }
      bindingsIO[source](this.id,
        appVersion, path, type, cb, onL10nLoaded, sync);
    }
  };

  function createPseudoEntry(node, entries) {
    return Resolver.createEntry(
      walkContent(node, PSEUDO_STRATEGIES[this.id].translate),
      entries);
  }

  Locale.prototype.addAST = function(ast) {
    /* jshint -W084 */

    var createEntry = this.isPseudo ?
      createPseudoEntry.bind(this) : Resolver.createEntry;

    for (var i = 0; i < ast.length; i++) {
      this.entries[ast[i].$i] = createEntry(ast[i], this.entries);
    }
  };




  function Context(id) {
    this.id = id;
    this.isReady = false;
    this.isLoading = false;

    this.defaultLocale = 'en-US';
    this.availableLocales = [];
    this.supportedLocales = [];

    this.resLinks = [];
    this.locales = {};

    this._emitter = new EventEmitter();
    this._ready = new Promise(this.once.bind(this));
  }


  // Getting translations

  function reportMissing(id, err) {
    this._emitter.emit('notfounderror', err);
    return id;
  }

  function getWithFallback(id) {
    /* jshint -W084 */
    var cur = 0;
    var loc;
    var locale;
    while (loc = this.supportedLocales[cur]) {
      locale = this.getLocale(loc);
      if (!locale.isReady) {
        // build without callback, synchronously
        locale.build(null);
      }
      var entry = locale.entries[id];
      if (entry === undefined) {
        cur++;
        reportMissing.call(this, id, new L10nError(
          '"' + id + '"' + ' not found in ' + loc + ' in ' + this.id,
          id, loc));
        continue;
      }
      return entry;
    }

    throw new L10nError(
      '"' + id + '"' + ' missing from all supported locales in ' + this.id, id);
  }

  function formatTuple(args, entity) {
    try {
      return Resolver.format(args, entity);
    } catch (err) {
      this._emitter.emit('resolveerror', err);
      var locals = {
        error: err
      };
      return [locals, entity.id];
    }
  }

  function formatValue(args, entity) {
    if (typeof entity === 'string') {
      return entity;
    }

    // take the string value only
    return formatTuple.call(this, args, entity)[1];
  }

  function formatEntity(args, entity) {
    var rv = formatTuple.call(this, args, entity);
    var locals = rv[0];
    var value = rv[1];

    var formatted = {
      value: value,
      attrs: null,
      overlay: locals.overlay
    };

    if (entity.attrs) {
      formatted.attrs = Object.create(null);
    }

    for (var key in entity.attrs) {
      /* jshint -W089 */
      formatted.attrs[key] = formatValue.call(this, args, entity.attrs[key]);
    }

    return formatted;
  }

  function formatAsync(fn, id, args) {
    return this._ready.then(
      getWithFallback.bind(this, id)).then(
        fn.bind(this, args),
        reportMissing.bind(this, id));
  }

  Context.prototype.formatValue = function(id, args) {
    return formatAsync.call(this, formatValue, id, args);
  };

  Context.prototype.formatEntity = function(id, args) {
    return formatAsync.call(this, formatEntity, id, args);
  };

  function legacyGet(fn, id, args) {
    if (!this.isReady) {
      throw new L10nError('Context not ready');
    }

    var entry;
    try {
      entry = getWithFallback.call(this, id);
    } catch (err) {
      // Don't handle notfounderrors in individual locales in any special way
      if (err.loc) {
        throw err;
      }
      // For general notfounderrors, report them and return legacy fallback
      reportMissing.call(this, id, err);
      // XXX legacy compat;  some Gaia code checks if returned value is falsy or
      // an empty string to know if a translation is available;  this is bad and
      // will be fixed eventually in https://bugzil.la/1020138
      return '';
    }

    // If translation is broken use regular fallback-on-id approach
    return fn.call(this, args, entry);
  }

  Context.prototype.get = function(id, args) {
    return legacyGet.call(this, formatValue, id, args);
  };

  Context.prototype.getEntity = function(id, args) {
    return legacyGet.call(this, formatEntity, id, args);
  };

  Context.prototype.getLocale = function getLocale(code) {
    /* jshint -W093 */

    var locales = this.locales;
    if (locales[code]) {
      return locales[code];
    }

    return locales[code] = new Locale(code, this);
  };


  // Getting ready

  function negotiate(available, requested, defaultLocale) {
    if (available.indexOf(requested[0]) === -1 ||
        requested[0] === defaultLocale) {
      return [defaultLocale];
    } else {
      return [requested[0], defaultLocale];
    }
  }

  function freeze(supported) {
    var locale = this.getLocale(supported[0]);
    if (locale.isReady) {
      setReady.call(this, supported);
    } else {
      locale.build(setReady.bind(this, supported));
    }
  }

  function setReady(supported) {
    this.supportedLocales = supported;
    this.isReady = true;
    this._emitter.emit('ready');
  }

  Context.prototype.registerLocales = function(defLocale, available) {

    if (defLocale) {
      this.defaultLocale = defLocale;
    }
    /* jshint boss:true */
    this.availableLocales = [this.defaultLocale];

    if (available) {
      for (var i = 0, loc; loc = available[i]; i++) {
        if (this.availableLocales.indexOf(loc) === -1) {
          this.availableLocales.push(loc);
        }
      }
    }
  };

  Context.prototype.requestLocales = function requestLocales() {
    if (this.isLoading && !this.isReady) {
      throw new L10nError('Context not ready');
    }

    this.isLoading = true;
    var requested = Array.prototype.slice.call(arguments);
    if (requested.length === 0) {
      throw new L10nError('No locales requested');
    }

    var reqPseudo = requested.filter(function(loc) {
      return loc in PSEUDO_STRATEGIES;
    });

    var supported = negotiate(this.availableLocales.concat(reqPseudo),
                              requested,
                              this.defaultLocale);
    freeze.call(this, supported);
  };


  // Events

  Context.prototype.addEventListener = function(type, listener) {
    this._emitter.addEventListener(type, listener);
  };

  Context.prototype.removeEventListener = function(type, listener) {
    this._emitter.removeEventListener(type, listener);
  };

  Context.prototype.ready = function(callback) {
    if (this.isReady) {
      setTimeout(callback);
      return;
    }
    this.addEventListener('ready', callback);
  };

  Context.prototype.once = function(callback) {
    /* jshint -W068 */
    if (this.isReady) {
      setTimeout(callback);
      return;
    }

    var callAndRemove = (function() {
      this.removeEventListener('ready', callAndRemove);
      callback();
    }).bind(this);
    this.addEventListener('ready', callAndRemove);
  };



  var allowed = {
    elements: [
      'a', 'em', 'strong', 'small', 's', 'cite', 'q', 'dfn', 'abbr', 'data',
      'time', 'code', 'var', 'samp', 'kbd', 'sub', 'sup', 'i', 'b', 'u',
      'mark', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'span', 'br', 'wbr'
    ],
    attributes: {
      global: [ 'title', 'aria-label', 'aria-valuetext', 'aria-moz-hint' ],
      a: [ 'download' ],
      area: [ 'download', 'alt' ],
      // value is special-cased in isAttrAllowed
      input: [ 'alt', 'placeholder' ],
      menuitem: [ 'label' ],
      menu: [ 'label' ],
      optgroup: [ 'label' ],
      option: [ 'label' ],
      track: [ 'label' ],
      img: [ 'alt' ],
      textarea: [ 'placeholder' ],
      th: [ 'abbr']
    }
  };



  var DEBUG = false;
  var isPretranslated = false;
  var rtlList = [
    'ar-SA', 'he-IL', 'fa-IR', 'ps-AF', 'qps-plocm', 'ur-PK', 'ks-IN', 'ur-IN'
  ];
  var nodeObserver = null;
  var pendingElements = null;

  var moConfig = {
    attributes: true,
    characterData: false,
    childList: true,
    subtree: true,
    attributeFilter: ['data-l10n-id', 'data-l10n-args']
  };

  // Public API

  navigator.mozL10n = {
    ctx: new Context(window.document ? document.URL : null),
    get: function get(id, ctxdata) {
      return navigator.mozL10n.ctx.get(id, ctxdata);
    },
    formatValue: function(id, ctxdata) {
      return navigator.mozL10n.ctx.formatValue(id, ctxdata);
    },
    formatEntity: function(id, ctxdata) {
      return navigator.mozL10n.ctx.formatEntity(id, ctxdata);
    },
    translateFragment: function (fragment) {
      return translateFragment.call(navigator.mozL10n, fragment);
    },
    setAttributes: setL10nAttributes,
    getAttributes: getL10nAttributes,
    ready: function ready(callback) {
      return navigator.mozL10n.ctx.ready(callback);
    },
    once: function once(callback) {
      return navigator.mozL10n.ctx.once(callback);
    },
    get readyState() {
      return navigator.mozL10n.ctx.isReady ? 'complete' : 'loading';
    },
    language: {
      set code(lang) {
        navigator.mozL10n.ctx.requestLocales(lang);
      },
      get code() {
        return navigator.mozL10n.ctx.supportedLocales[0];
      },
      get direction() {
        return getDirection(navigator.mozL10n.ctx.supportedLocales[0]);
      }
    },
    qps: PSEUDO_STRATEGIES,
    _config: {
      appVersion: null,
      localeSources: Object.create(null),
    },
    _getInternalAPI: function() {
      return {
        Error: L10nError,
        Context: Context,
        Locale: Locale,
        Resolver: Resolver,
        getPluralRule: getPluralRule,
        rePlaceables: rePlaceables,
        translateDocument: translateDocument,
        onMetaInjected: onMetaInjected,
        PropertiesParser: PropertiesParser,
        walkContent: walkContent,
        buildLocaleList: buildLocaleList
      };
    }
  };

  navigator.mozL10n.ctx.ready(onReady.bind(navigator.mozL10n));

  navigator.mozL10n.ctx.addEventListener('notfounderror',
    function reportMissingEntity(e) {
      if (DEBUG || e.loc === 'en-US') {
        console.warn(e.toString());
      }
  });

  if (DEBUG) {
    navigator.mozL10n.ctx.addEventListener('fetcherror',
      console.error.bind(console));
    navigator.mozL10n.ctx.addEventListener('parseerror',
      console.error.bind(console));
    navigator.mozL10n.ctx.addEventListener('resolveerror',
      console.error.bind(console));
  }

  function getDirection(lang) {
    return (rtlList.indexOf(lang) >= 0) ? 'rtl' : 'ltr';
  }

  var readyStates = {
    'loading': 0,
    'interactive': 1,
    'complete': 2
  };

  function waitFor(state, callback) {
    state = readyStates[state];
    if (readyStates[document.readyState] >= state) {
      callback();
      return;
    }

    document.addEventListener('readystatechange', function l10n_onrsc() {
      if (readyStates[document.readyState] >= state) {
        document.removeEventListener('readystatechange', l10n_onrsc);
        callback();
      }
    });
  }

  if (window.document) {
    isPretranslated = !PSEUDO_STRATEGIES.hasOwnProperty(navigator.language) &&
                      (document.documentElement.lang === navigator.language);

    // XXX always pretranslate if data-no-complete-bug is set;  this is
    // a workaround for a netError page not firing some onreadystatechange
    // events;  see https://bugzil.la/444165
    var pretranslate = document.documentElement.dataset.noCompleteBug ?
      true : !isPretranslated;
    waitFor('interactive', init.bind(navigator.mozL10n, pretranslate));
  }

  function initObserver() {
    nodeObserver = new MutationObserver(onMutations.bind(navigator.mozL10n));
    nodeObserver.observe(document, moConfig);
  }

  function init(pretranslate) {
    if (pretranslate) {
      initResources.call(navigator.mozL10n);
    } else {
      // if pretranslate is false, we want to initialize MO
      // early, to collect nodes injected between now and when resources
      // are loaded because we're not going to translate the whole
      // document once l10n resources are ready.
      initObserver();
      window.setTimeout(initResources.bind(navigator.mozL10n));
    }
  }

  function initResources() {
    /* jshint boss:true */

    var meta = {};
    var nodes = document.head
                        .querySelectorAll('link[rel="localization"],' +
                                          'meta[name="availableLanguages"],' +
                                          'meta[name="defaultLanguage"],' +
                                          'meta[name="appVersion"],' +
                                          'script[type="application/l10n"]');
    for (var i = 0, node; node = nodes[i]; i++) {
      var type = node.getAttribute('rel') || node.nodeName.toLowerCase();
      switch (type) {
        case 'localization':
          this.ctx.resLinks.push(node.getAttribute('href'));
          break;
        case 'meta':
          onMetaInjected.call(this, node, meta);
          break;
        case 'script':
          onScriptInjected.call(this, node);
          break;
      }
    }

    var additionalLanguagesPromise;

    if (navigator.mozApps && navigator.mozApps.getAdditionalLanguages) {
      // if the environment supports langpacks, register extra languages…
      additionalLanguagesPromise =
        navigator.mozApps.getAdditionalLanguages().catch(function(e) {
          console.error('Error while loading getAdditionalLanguages', e);
        });

      // …and listen to langpacks being added and removed
      document.addEventListener('additionallanguageschange', function(evt) {
        registerLocales.call(this, meta, evt.detail);
      }.bind(this));
    } else {
      additionalLanguagesPromise = Promise.resolve();
    }

    additionalLanguagesPromise.then(function(extraLangs) {
      registerLocales.call(this, meta, extraLangs);
      initLocale.call(this);
    }.bind(this));
  }

  function registerLocales(meta, extraLangs) {
    var locales = buildLocaleList.call(this, meta, extraLangs);
    navigator.mozL10n._config.localeSources = locales[1];
    this.ctx.registerLocales(locales[0], Object.keys(locales[1]));
  }

  function getMatchingLangpack(appVersion, langpacks) {
    for (var i = 0, langpack; (langpack = langpacks[i]); i++) {
      if (langpack.target === appVersion) {
        return langpack;
      }
    }
    return null;
  }

  function buildLocaleList(meta, extraLangs) {
    var loc, lp;
    var localeSources = Object.create(null);
    var defaultLocale = meta.defaultLocale || this.ctx.defaultLocale;

    if (meta.availableLanguages) {
      for (loc in meta.availableLanguages) {
        localeSources[loc] = 'app';
      }
    }

    if (extraLangs) {
      for (loc in extraLangs) {
        lp = getMatchingLangpack(this._config.appVersion, extraLangs[loc]);

        if (!lp) {
          continue;
        }
        if (!(loc in localeSources) ||
            !meta.availableLanguages[loc] ||
            parseInt(lp.revision) > meta.availableLanguages[loc]) {
          localeSources[loc] = 'extra';
        }
      }
    }

    if (!(defaultLocale in localeSources)) {
      localeSources[defaultLocale] = 'app';
    }
    return [defaultLocale, localeSources];
  }

  function splitAvailableLanguagesString(str) {
    var langs = {};

    str.split(',').forEach(function(lang) {
      // code:revision
      lang = lang.trim().split(':');
      // if revision is missing, use NaN
      langs[lang[0]] = parseInt(lang[1]);
    });
    return langs;
  }

  function onMetaInjected(node, meta) {
    switch (node.getAttribute('name')) {
      case 'availableLanguages':
        meta.availableLanguages =
          splitAvailableLanguagesString(node.getAttribute('content'));
        break;
      case 'defaultLanguage':
        meta.defaultLanguage = node.getAttribute('content');
        break;
      case 'appVersion':
        navigator.mozL10n._config.appVersion = node.getAttribute('content');
        break;
    }
  }

  function onScriptInjected(node) {
    var lang = node.getAttribute('lang');
    var locale = this.ctx.getLocale(lang);
    locale.addAST(JSON.parse(node.textContent));
  }

  function initLocale() {
    this.ctx.requestLocales.apply(
      this.ctx, navigator.languages || [navigator.language]);
    window.addEventListener('languagechange', function l10n_langchange() {
      this.ctx.requestLocales.apply(
        this.ctx, navigator.languages || [navigator.language]);
    }.bind(this));
  }

  function localizeMutations(mutations) {
    var mutation;
    var targets = new Set();

    for (var i = 0; i < mutations.length; i++) {
      mutation = mutations[i];
      if (mutation.type === 'childList') {
        var addedNode;

        for (var j = 0; j < mutation.addedNodes.length; j++) {
          addedNode = mutation.addedNodes[j];
          if (addedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          targets.add(addedNode);
        }
      }

      if (mutation.type === 'attributes') {
        targets.add(mutation.target);
      }
    }

    targets.forEach(function(target) {
      if (target.childElementCount) {
        translateFragment.call(this, target);
      } else if (target.hasAttribute('data-l10n-id')) {
        translateElement.call(this, target);
      }
    }, this);
  }

  function onMutations(mutations, self) {
    self.disconnect();
    localizeMutations.call(this, mutations);
    self.observe(document, moConfig);
  }

  function onReady() {
    if (!isPretranslated) {
      translateDocument.call(this);
    }
    isPretranslated = false;

    if (pendingElements) {
      /* jshint boss:true */
      for (var i = 0, element; element = pendingElements[i]; i++) {
        translateElement.call(this, element);
      }
      pendingElements = null;
    }

    if (!nodeObserver) {
      initObserver();
    }
    fireLocalizedEvent.call(this);
  }

  function fireLocalizedEvent() {
    var event = new CustomEvent('localized', {
      'bubbles': false,
      'cancelable': false,
      'detail': {
        'language': this.ctx.supportedLocales[0]
      }
    });
    window.dispatchEvent(event);
  }


  function translateDocument() {
    document.documentElement.lang = this.language.code;
    document.documentElement.dir = this.language.direction;
    translateFragment.call(this, document.documentElement);
  }

  function translateFragment(element) {
    if (element.hasAttribute('data-l10n-id')) {
      translateElement.call(this, element);
    }

    var nodes = getTranslatableChildren(element);
    for (var i = 0; i < nodes.length; i++ ) {
      translateElement.call(this, nodes[i]);
    }
  }

  function setL10nAttributes(element, id, args) {
    element.setAttribute('data-l10n-id', id);
    if (args) {
      element.setAttribute('data-l10n-args', JSON.stringify(args));
    }
  }

  function getL10nAttributes(element) {
    return {
      id: element.getAttribute('data-l10n-id'),
      args: JSON.parse(element.getAttribute('data-l10n-args'))
    };
  }

  function getTranslatableChildren(element) {
    return element ? element.querySelectorAll('*[data-l10n-id]') : [];
  }

  function camelCaseToDashed(string) {
    // XXX workaround for https://bugzil.la/1141934
    if (string === 'ariaValueText') {
      return 'aria-valuetext';
    }

    return string
      .replace(/[A-Z]/g, function (match) {
        return '-' + match.toLowerCase();
      })
      .replace(/^-/, '');
  }

  function translateElement(element) {
    if (!this.ctx.isReady) {
      if (!pendingElements) {
        pendingElements = [];
      }
      pendingElements.push(element);
      return;
    }

    var l10n = getL10nAttributes(element);

    if (!l10n.id) {
      return false;
    }

    var entity = this.ctx.getEntity(l10n.id, l10n.args);

    if (typeof entity.value === 'string') {
      if (!entity.overlay) {
        element.textContent = entity.value;
      } else {
        // start with an inert template element and move its children into
        // `element` but such that `element`'s own children are not replaced
        var translation = element.ownerDocument.createElement('template');
        translation.innerHTML = entity.value;
        // overlay the node with the DocumentFragment
        overlayElement(element, translation.content);
      }
    }

    for (var key in entity.attrs) {
      // XXX A temporary special-case for translations using the old method
      // of declaring innerHTML.  To be removed in https://bugzil.la/1027117
      if (key === 'innerHTML') {
        element.innerHTML = entity.attrs[key];
        continue;
      }
      var attrName = camelCaseToDashed(key);
      if (isAttrAllowed({ name: attrName }, element)) {
        element.setAttribute(attrName, entity.attrs[key]);
      }
    }
  }

  // The goal of overlayElement is to move the children of `translationElement`
  // into `sourceElement` such that `sourceElement`'s own children are not
  // replaced, but onle have their text nodes and their attributes modified.
  //
  // We want to make it possible for localizers to apply text-level semantics to
  // the translations and make use of HTML entities. At the same time, we
  // don't trust translations so we need to filter unsafe elements and
  // attribtues out and we don't want to break the Web by replacing elements to
  // which third-party code might have created references (e.g. two-way
  // bindings in MVC frameworks).
  function overlayElement(sourceElement, translationElement) {
    var result = translationElement.ownerDocument.createDocumentFragment();
    var k, attr;

    // take one node from translationElement at a time and check it against
    // the allowed list or try to match it with a corresponding element
    // in the source
    var childElement;
    while ((childElement = translationElement.childNodes[0])) {
      translationElement.removeChild(childElement);

      if (childElement.nodeType === Node.TEXT_NODE) {
        result.appendChild(childElement);
        continue;
      }

      var index = getIndexOfType(childElement);
      var sourceChild = getNthElementOfType(sourceElement, childElement, index);
      if (sourceChild) {
        // there is a corresponding element in the source, let's use it
        overlayElement(sourceChild, childElement);
        result.appendChild(sourceChild);
        continue;
      }

      if (isElementAllowed(childElement)) {
        const sanitizedChild = childElement.ownerDocument.createElement(
          childElement.nodeName);
        overlayElement(sanitizedChild, childElement);
        result.appendChild(sanitizedChild);
        continue;
      }

      // otherwise just take this child's textContent
      result.appendChild(
        document.createTextNode(childElement.textContent));
    }

    // clear `sourceElement` and append `result` which by this time contains
    // `sourceElement`'s original children, overlayed with translation
    sourceElement.textContent = '';
    sourceElement.appendChild(result);

    // if we're overlaying a nested element, translate the allowed
    // attributes; top-level attributes are handled in `translateElement`
    // XXX attributes previously set here for another language should be
    // cleared if a new language doesn't use them; https://bugzil.la/922577
    if (translationElement.attributes) {
      for (k = 0, attr; (attr = translationElement.attributes[k]); k++) {
        if (isAttrAllowed(attr, sourceElement)) {
          sourceElement.setAttribute(attr.name, attr.value);
        }
      }
    }
  }

  // XXX the allowed list should be amendable; https://bugzil.la/922573
  function isElementAllowed(element) {
    return allowed.elements.indexOf(element.tagName.toLowerCase()) !== -1;
  }

  function isAttrAllowed(attr, element) {
    var attrName = attr.name.toLowerCase();
    var tagName = element.tagName.toLowerCase();
    // is it a globally safe attribute?
    if (allowed.attributes.global.indexOf(attrName) !== -1) {
      return true;
    }
    // are there no allowed attributes for this element?
    if (!allowed.attributes[tagName]) {
      return false;
    }
    // is it allowed on this element?
    // XXX the allowed list should be amendable; https://bugzil.la/922573
    if (allowed.attributes[tagName].indexOf(attrName) !== -1) {
      return true;
    }
    // special case for value on inputs with type button, reset, submit
    if (tagName === 'input' && attrName === 'value') {
      var type = element.type.toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') {
        return true;
      }
    }
    return false;
  }

  // Get n-th immediate child of context that is of the same type as element.
  // XXX Use querySelector(':scope > ELEMENT:nth-of-type(index)'), when:
  // 1) :scope is widely supported in more browsers and 2) it works with
  // DocumentFragments.
  function getNthElementOfType(context, element, index) {
    /* jshint boss:true */
    var nthOfType = 0;
    for (var i = 0, child; child = context.children[i]; i++) {
      if (child.nodeType === Node.ELEMENT_NODE &&
          child.tagName === element.tagName) {
        if (nthOfType === index) {
          return child;
        }
        nthOfType++;
      }
    }
    return null;
  }

  // Get the index of the element among siblings of the same type.
  function getIndexOfType(element) {
    var index = 0;
    var child;
    while ((child = element.previousElementSibling)) {
      if (child.tagName === element.tagName) {
        index++;
      }
    }
    return index;
  }

})(this);

define("l10nbase", function(){});

/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */



/**
 * This lib relies on `l10n.js' to implement localizable date/time strings.
 *
 * The proposed `DateTimeFormat' object should provide all the features that are
 * planned for the `Intl.DateTimeFormat' constructor, but the API does not match
 * exactly the ES-i18n draft.
 *   - https://bugzilla.mozilla.org/show_bug.cgi?id=769872
 *   - http://wiki.ecmascript.org/doku.php?id=globalization:specification_drafts
 *
 * Besides, this `DateTimeFormat' object provides two features that aren't
 * planned in the ES-i18n spec:
 *   - a `toLocaleFormat()' that really works (i.e. fully translated);
 *   - a `fromNow()' method to handle relative dates ("pretty dates").
 *
 * WARNING: this library relies on the non-standard `toLocaleFormat()' method,
 * which is specific to Firefox -- no other browser is supported.
 */

navigator.mozL10n.DateTimeFormat = function(locales, options) {
  var _ = navigator.mozL10n.get;

  // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toLocaleFormat
  function localeFormat(d, format) {
    var tokens = format.match(/(%[E|O|-]?.)/g);

    for (var i = 0; tokens && i < tokens.length; i++) {
      var value = '';

      // http://pubs.opengroup.org/onlinepubs/007908799/xsh/strftime.html
      switch (tokens[i]) {
        // localized day/month names
        case '%a':
          value = _('weekday-' + d.getDay() + '-short');
          break;
        case '%A':
          value = _('weekday-' + d.getDay() + '-long');
          break;
        case '%b':
        case '%h':
          value = _('month-' + d.getMonth() + '-short');
          break;
        case '%B':
          value = _('month-' + d.getMonth() + '-long');
          break;
        case '%Eb':
          value = _('month-' + d.getMonth() + '-genitive');
          break;

        // month without leading zero
        case '%-m':
          value = d.getMonth() + 1;
          break;

        // like %H, but in 12-hour format and without any leading zero
        case '%I':
          value = d.getHours() % 12 || 12;
          break;

        // like %d, without any leading zero
        case '%e':
          value = d.getDate();
          break;

        // %p: 12 hours format (AM/PM)
        case '%p':
          value = d.getHours() < 12 ? _('time_am') : _('time_pm');
          break;

        // localized date/time strings
        case '%c':
        case '%x':
        case '%X':
          // ensure the localized format string doesn't contain any %c|%x|%X
          var tmp = _('dateTimeFormat_' + tokens[i]);
          if (tmp && !(/(%c|%x|%X)/).test(tmp)) {
            value = localeFormat(d, tmp);
          }
          break;

        // other tokens don't require any localization
      }

      format = format.replace(tokens[i], value || d.toLocaleFormat(tokens[i]));
    }

    return format;
  }

  /**
   * Returns the parts of a number of seconds
   */
  function relativeParts(seconds) {
    seconds = Math.abs(seconds);
    var descriptors = {};
    var units = [
      'years', 86400 * 365,
      'months', 86400 * 30,
      'weeks', 86400 * 7,
      'days', 86400,
      'hours', 3600,
      'minutes', 60
    ];

    if (seconds < 60) {
      return {
        minutes: Math.round(seconds / 60)
      };
    }

    for (var i = 0, uLen = units.length; i < uLen; i += 2) {
      var value = units[i + 1];
      if (seconds >= value) {
        descriptors[units[i]] = Math.floor(seconds / value);
        seconds -= descriptors[units[i]] * value;
      }
    }
    return descriptors;
  }

  /**
   * Returns a translated string which respresents the
   * relative time before or after a date.
   * @param {String|Date} time before/after the currentDate.
   * @param {String} useCompactFormat whether to use a compact display format.
   * @param {Number} maxDiff returns a formatted date if the diff is greater.
   */
  function prettyDate(time, useCompactFormat, maxDiff) {
    maxDiff = maxDiff || 86400 * 2; // default = 2 days

    switch (time.constructor) {
      case String: // timestamp
        time = parseInt(time);
        break;
      case Date:
        time = time.getTime();
        break;
    }

    var now = Date.now();
    var secDiff = (now - time) / 1000;
    if (isNaN(secDiff)) {
      return _('incorrectDate');
    }

    if (Math.abs(secDiff) > 60) {
      // round milliseconds up if difference is over 1 minute so the result is
      // closer to what the user would expect (1h59m59s300ms diff should return
      // "in 2 hours" instead of "in an hour")
      secDiff = secDiff > 0 ? Math.ceil(secDiff) : Math.floor(secDiff);
    }

    var today = new Date();
    today.setHours(0,0,0,0);
    var todayMidnight = today.getTime();
    var yesterdayMidnight = todayMidnight - 86400 * 1000;

    const thisyearTimestamp = (new Date(today.getFullYear().toString())).getTime();
    // ex. 11:59 PM or 23:59
    const timeFormat = navigator.mozHour12 ? '%I:%M %p' : '%H:%M';

    if (time < thisyearTimestamp) {
      // before this year, ex. December 31, 2015 11:59 PM
      return localeFormat(new Date(time), '%B %e, %Y ' + timeFormat);
    } else if (time < yesterdayMidnight) {
      // before yesterday and in this year, ex. August 31, 11:59 PM
      return localeFormat(new Date(time), '%B %e, ' + timeFormat);
    } else if (time < todayMidnight) {
      // yesterday
      return _('days-ago-long', {value: 1}) + ', ' + localeFormat(new Date(time), timeFormat);
    } else if (secDiff > 3600 * 4) {
      // today and before 4 hours
      return _('days-ago-long', {value: 0}) + ', ' + localeFormat(new Date(time), timeFormat);
    } else {
      // in 4 hours
      var f = useCompactFormat ? '-short' : '-long';
      var parts = relativeParts(secDiff);

      var affix = secDiff >= 0 ? '-ago' : '-until';
      for (var i in parts) {
        return _(i + affix + f, { value: parts[i]});
      }
    }
  }

  // API
  return {
    localeDateString: function localeDateString(d) {
      return localeFormat(d, '%x');
    },
    localeTimeString: function localeTimeString(d) {
      return localeFormat(d, '%X');
    },
    localeString: function localeString(d) {
      return localeFormat(d, '%c');
    },
    localeFormat: localeFormat,
    fromNow: prettyDate,
    relativeParts: relativeParts
  };
};

define("l10ndate", function(){});


define('text',{
  load: function(name, req, onload, config) {
    let url = req.toUrl(name),
        xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.onreadystatechange = (evt) => {
      let status, err;
      if (xhr.readyState === 4) {
        status = xhr.status;
        if (status > 399 && status < 600) {
          //An http 4xx or 5xx error. Signal an error.
          err = new Error(url + ' HTTP status: ' + status);
          err.xhr = xhr;
          onload.error(err);
        } else {
          onload(xhr.responseText);
        }
      }
    };
    xhr.responseType = 'text';
    xhr.send(null);
  }
});



define('folder_depth_classes',[],function() {

return [
  'fld-folder-depth0',
  'fld-folder-depth1',
  'fld-folder-depth2',
  'fld-folder-depth3',
  'fld-folder-depth4',
  'fld-folder-depth5',
  'fld-folder-depthmax'
];

});

define('tmpl!cards/value_selector.html',['tmpl'], function (tmpl) { return tmpl.toDom('<form class="email-value-selector collapsed" role="dialog" data-type="value-selector">\n  <section class="scrollable">\n    <h1></h1>\n    <ol class="valueSelector_single" role="listbox">\n    </ol>\n  </section>\n</form>\n'); });

define('tmpl!cards/vsl/item.html',['tmpl'], function (tmpl) { return tmpl.toDom('<li role="option"><label role="presentation"> <span class="p-pri"></span></label></li>'); });

/*
!! Warning !!
  This value selector uses the form layout as specified in
  shared/style/value_selector/index.html. If that changes, or its associated
  styles change, then this file or value_selector.html or vsl/index.html may
  need to be adjusted.

How to:
  let prompt1 = new ValueSelector('Dummy title 1', [
    {
      label: 'Dummy element',
      callback: function() {
        alert('Define an action here!');
      }
    }
  ]);

  prompt1.addToList('Another button', 'depth0',
                    true, function(){alert('Another action');});
  prompt1.show();
*/
/*jshint browser: true */
/*global alert, define */
define('value_selector',['require','l10n!','cards','folder_depth_classes','tmpl!cards/value_selector.html','tmpl!cards/vsl/item.html'],function(require) {


let mozL10n = require('l10n!'),
    cards = require('cards'),
    FOLDER_DEPTH_CLASSES = require('folder_depth_classes'),
    formNode = require('tmpl!cards/value_selector.html'),
    itemTemplateNode = require('tmpl!cards/vsl/item.html');

// Used for empty click handlers.
function noop() {}

function ValueSelector(title, list, actions) {
  let init, show, hide, render, setTitle, emptyList, addToList,
      data, getFocusedItem, getSelectedItem;
  //to store previous actions, controlID, and state.
  let backup = {};

  function handleKeydown(evt) {
    switch (evt.key) {
      case 'Backspace':
        evt.preventDefault();
        hide();
        evt.stopPropagation();
        break;
    }
  }

  init = function() {
    data = {
      title: 'No Title',
      list: [
        //label, depth, selectable, callback, selected, data
        {
          label: 'Dummy element',
          callback: function() {
            alert('Define an action here!');
          }
        }
      ]
    };

    document.body.appendChild(formNode);

    // Empty dummy data
    emptyList();

    // Apply optional actions while initializing
    if (typeof title === 'string') {
      setTitle(title);
    }

    if (Array.isArray(list)) {
      data.list = list;
    }
  };

  show = function(onFocusChanged) {
    let delayTime = 0;
    if (actions) {
      // backup previous option, and restore it when its hidden
      if (window.option) {
        backup.actions = window.option.actions;
        // Add 200ms delay to set focus to avoid lost focus if fast clicks
        delayTime = 200;
      }
      NavigationMap.setSoftKeyBar(actions);
    }

    if (typeof onFocusChanged === 'function') {
      formNode.onFocusChanged = onFocusChanged;
    } else {
      formNode.onFocusChanged = undefined;
    }

    render();
    formNode.classList.remove('collapsed');
    formNode.classList.toggle('move-to-folder',
        title === mozL10n.get('messages-folder-select'));
    formNode.classList.toggle('sort-by',
        title === mozL10n.get('sort-by-title'));

    const QUERY_PARENT = '.email-value-selector';
    const QUERY_CHILD = '[role="option"]';
    const CONTROL_ID = QUERY_PARENT + ' ' + QUERY_CHILD;

    NavigationMap.navSetup(QUERY_PARENT, QUERY_CHILD);
    backup.controlID = NavigationMap.setCurrentControl(CONTROL_ID);
    setTimeout(() => {
      NavigationMap.setFocus('first');
    }, delayTime);

    formNode.addEventListener('keydown', handleKeydown);
  };

  hide = function() {
    formNode.classList.add('collapsed');

    // restore previous controlID & options
    NavigationMap.setCurrentControl(backup.controlID);
    if (backup.controlID ===
        'cards-message-list .msg-header-item:not([data-index="-1"])') {
      let messageId = NavigationMap.currentMessageId;
      NavigationMap.setMessageListFocus(messageId, false);
    } else {
      NavigationMap.setFocus('restore');
    }
    if (backup.actions) {
      //Todo: consider previous option was hidden
      NavigationMap.setSoftKeyBar(backup.actions);
    }

    formNode.removeEventListener('keydown', handleKeydown);
  };

  render = function() {
    let title = formNode.querySelector('h1'),
        list = formNode.querySelector('ol');

    title.textContent = data.title;

    list.innerHTML = '';
    data.list.forEach((listItem) => {
      let node = itemTemplateNode.cloneNode(true);

      node.querySelector('span').textContent = listItem.label;

      // Here we apply the folder-card's depth indentation to represent label.
      let depthIdx = listItem.depth;
      depthIdx = Math.min(FOLDER_DEPTH_CLASSES.length - 1, depthIdx);
      node.classList.add(FOLDER_DEPTH_CLASSES[depthIdx]);
      node.classList.add('list-item');

      // If not selectable use an empty click handler. Because of event
      // fuzzing, we want to have something registered, otherwise an
      // adjacent list item may receive the click.
      let callback = listItem.selectable ? listItem.callback : noop;
      node.addEventListener('click', callback, false);

      if (listItem.selected) {
        node.setAttribute('aria-selected', true);
      }

      node.data = listItem; //attatch data
      list.appendChild(node);
    });
  };

  setTitle = function(str) {
    data.title = str;
  };

  emptyList = function() {
    data.list = [];
  };

  addToList = function(label, depth, selectable, callback, selected, source) {
    data.list.push({
      label: label,
      depth: depth,
      selectable: selectable,
      callback: callback,
      selected: selected,
      source: source
    });
  };

  getFocusedItem = function() {
    let node = formNode.querySelector('.focus');
    return node.data;
  };

  getSelectedItem = function() {
    let items = [];
    data.list.forEach((item) => {
      if (item.selected) {
        items.push(item);
      }
    });
    return items;
  };

  init();

  return{
    init: init,
    show: show,
    hide: hide,
    setTitle: setTitle,
    addToList: addToList,
    List: list,
    getFocusedItem: getFocusedItem,
    getSelectedItem: getSelectedItem
  };
}

return ValueSelector;

});

define('iframe_shims',[],function() {



/**
 * Style tag to put in the header of the body.  We currently only support inline
 * styles in general, so these are primarily overrides and defaults.
 */
let DEFAULT_STYLE_TAG =
  '<style type="text/css">\n' +
  // ## blockquote
  // blockquote per html5: before: 1em, after: 1em, start: 4rem, end: 4rem
  'blockquote {' +
  'margin: 0; ' +
  // so, this is quoting styling, which makes less sense to have in here.
  '-moz-border-start: 0.2rem solid gray;' +
  // padding-start isn't a thing yet, somehow.
  'padding: 0; -moz-padding-start: 0.5rem; ' +
  '}\n' +
  // Give the layout engine an upper-bound on the width that's arguably
  // much wider than anyone should find reasonable, but might save us from
  // super pathological cases.
  'html, body { max-width: 120rem; word-wrap: break-word;' +
  // don't let the html/body grow the scrollable area.  Also, it's not clear
  // overflow: hidden actually works in either of these cases, but I did most of
  // the development and testing where things worked with the overflow: hidden
  // present and I'm worried about removing it now.
  ' overflow: hidden; padding: 0; margin: 0; }\n' +
  // pre messes up wrapping very badly if left to its own devices
  'pre { white-space: pre-wrap; word-wrap: break-word; }\n' +
  '.moz-external-link { color: #00aac5; cursor: pointer; }\n' +
  '.focus { border: 0.2rem solid var(--highlight-color, #ff4f1a); }\n' +
  '</style>';

/**
 * Tweakable display settings for timings.  If you want to mess with these
 * values from the debugger, do requirejs('iframe_shims').iframeShimsOpts.
 *
 * All current poll timeouts (circa Sep 19, 2014) are ballpark figures arrived
 * at on a Flame device.  We could probably tighten things up if need be.
 */
let iframeShimsOpts = {
  /**
   * What is the minimum delay between changing the transform setting?  You
   * might think that we want this low, but because we experience memory-spikes
   * if we modify the transform from a setTimeout, we currently want this
   * to be short enough that a human would be unlikely to actually re-trigger
   * while this is active.  It's handy to keep around to turn it way up so that
   * we can reproduce the setTimeout problem for debugging, however.
   */
  zoomDelayMS: 200,
  /**
   * What should our initial scale-factor be?  If 1, it's 100%.  If null, we use
   * the fit-page-width value.
   */
  initialScale: null,
  /**
   * How many times should we poll the dimensions of the HTML iframe before
   * ceasing?  This is used both for initial display and after "display external
   * images" or "display embedded images" is triggered.
   */
  resizeLimit: 4,
  /**
   * After first creating the document, how long should we wait before we start
   * to poll?  Note that the "load" event doesn't work for us and
   * "DOMContentLoaded" turns out to be too early.  Even though we forbid remote
   * resources, it seems like our fonts or something can still need to
   * asynchronously load or the HTML5 parser no longer synchronously lays
   * everything out for us.
   */
  initialResizePollIntervalMS: 200,
  /**
   * If we polled and there was no change in dimensions, how long should we wait
   * before our next poll?  The idea is you might make this shorter in order to
   * make sure we respond sooner / faster.
   */
  noResizePollIntervalMS: 250,
  /**
   * If we polled and there was a change in dimensions, how long should we wait
   * before our next poll?  The idea is you might make this longer so as to
   * avoid churn if there is something going on that would affect sizing.
   */
  didResizePollIntervalMS: 300,
  /**
   * How long should we wait until after we get the last picture "load" event
   * before polling?  Note that in this case we will have reset our resize count
   * back to 0 so resizeLimit will need to be hit again.  The waiting is
   * accomplished by constantly resetting the timeout, so extremely small values
   * are dangerous here.  Also, experience has shown that when we previously
   * tried to update our size immediately or near-immediately getting the final
   * load event, we still would be too early.
   */
  pictureDelayPollIntervalMS: 200
};

/**
 * Logic to help with creating, populating, and handling events involving our
 * HTML message-disply iframes.
 *
 * ## UX Goals ##
 *
 * We want a continuous scrolling experience.  The message's envelope and the
 * HTML body should scroll continuously.
 *
 * Pinch-and-zoom: We want the user to be able to zoom in and out on the message
 * in a responsive fashion without crashing the app.  We also want to start
 * with fit-to-page-width because when the email is wider than the screen it
 * tends to look stupid.
 *
 * ## Security ##
 *
 * All HTML content is passed through a white-list-based sanitization process,
 * but we still want the iframe so that:
 *
 * - We can guarantee the content can't escape out into the rest of the page.
 * - We can both avoid the content being influenced by our stylesheets as well
 *   as to allow the content to use inline "style" tags without any risk to our
 *   styling.
 *
 * Our iframe sandbox attributes (not) specified and rationale are as follows.
 * Note that "NO" means we don't specify the string in our sandbox.
 * - "allow-same-origin": YES.  We do this because in order to touch the
 *   contentDocument we need to live in the same origin.  Because scripts are
 *   not enabled in the iframe this is not believed to have any meaningful
 *   impact.
 *
 *   In the future when we are able to do nested APZ stuff, what we
 *   will likely do is have two layers of iframes.  The outer mozbrowser iframe
 *   will have its own origin but be running (only) our code.  It will talk to
 *   us via postMessage.  Then it will have a sandboxed iframe where script is
 *   disabled but that lives in the same origin.  So our code in that origin
 *   can then poke at things as needed.
 *
 * - "allow-scripts": NO.  We never ever want to let scripts from an email
 *   run.  And since we are setting "allow-same-origin", even if we did want
 *   to allow scripts we *must not* while that setting is on.  Our CSP should
 *   limit the use of scripts if the iframe has the same origin as us since
 *   everything in the iframe should qualify as
 *
 * - "allow-top-navigation": NO.  The iframe should not navigate if the user
 *   clicks on a link.  Note that the current plan is to just capture the
 *   click event and trigger the browse event ourselves so we can show them the
 *   URL, so this is just extra protection.
 *
 * - "allow-forms": NO.  We already sanitize forms out, so this is just extra
 *   protection.
 *
 * - "allow-popups": NO.  We would never want this, but it also shouldn't be
 *   possible to even try to trigger this (scripts are disabled and sanitized,
 *   links are sanitized to forbid link targets as well as being nerfed), so
 *   this is also just extra protection.
 *
 * ## Platform Limitations: We Got'em! ##
 *
 * ### Seamless iframes ###
 *
 * Gecko does not support seamless iframes, so we have to manually make sure
 * that we set the iframe's outer size to what its inner size is.  Because
 * layout is asynchronous (even in the document.write case, apparently), we end
 * up polling after any notable event that might affect layout.
 *
 * I did experiment with the gecko-specific 'overflow' event a bit.  Although I
 * suspect there were complicating factors, I do believe I ran into trouble with
 * it since it is an event that is only generated each time you transition from
 * overflow and back to underflow.  So if you get an overflow event but didn't
 * actually cause yourself to go back to underflow (like if you have weird CSS
 * maybe doing something like setting a width to 105% or something?), you won't
 * get another overflow event.
 *
 * ### Pinch-and-Zoom ###
 *
 * Gecko supports Asynchronous Pan-and-Zoom (APZ), but we can't use it for our
 * HTML pages right now because it can only be used for the root of an
 * app/browser window.  And there is no support for nested subprocesses yet.
 * When that stuff happens, we want to just use that instead of doing manual
 * pinchy-zoomy support.
 *
 * We fake some level of usable pinch-zoom by using a "transform: scale()" on
 * our iframe.  Because the transform is a painting thing and not a layout thing
 * we have to wrap the iframe in a "viewport" div that provides our effective
 * DOM size for scrolling.  We could maybe use better nomenclature for this and
 * maybe even stop nesting the iframe in the viewport.  (The current structure
 * is somewhat historical from when the viewport div actually was clipping the
 * iframe.)
 *
 * For example, let's say our iframe is internally 580px by 1000px but we are
 * displaying it at 50% scale so it's 290px by 500px.  In that case the iframe's
 * size still needs to be 580px by 1000px, but the viewport needs to be 290px by
 * 500px so that the scrolling works out right.  Otherwise you end up with lots
 * of white space at the right and bottom.
 *
 * Likewise if we are zooming it to 200% we need the viewport's dimensions to be
 * doubled so that there is the extra space to scroll into.
 *
 * ### Transform Performance / Memory Limitations ###
 *
 * We can't actually mess with "transform: scale()" in realtime.  This is
 * primarily because it results in memory spikes that can get our process killed
 * as the graphics subsystem's logic glitches and ends up allocating graphics
 * buffers for the entirety of the HTML document, even the parts not on the
 * screen.  But a secondary concern is that especially when it's drawing too
 * much, it can take a very long time to scale.
 *
 * So we've implemented a "quantized" scaling approach where we have four zoom
 * levels: "fit-to-width" (which is <= 1), 100%, 150%, and 200%.  Pinching to
 * zoom in moves you to the right in the list, pinching to zoom out moves you
 * out in the list.
 *
 * We use the shared gesture_detector code to figure out what's going on.
 * Specifically, once the scale in absolute terms is clearly a zoom in or a zoom
 * out, we trigger the scale change and then ignore the rest of the gesture
 * until a new gesture occurs.  This is arguably intuitive, but more importantly
 * it avoids the problems we had in the past where you could just absurdly
 * oscillate your pinchers and kill the app as we swamped the system with a
 * gazillion transforms.
 *
 *
 * ## Email types and Pinchy-Zoomy time ##
 *
 * There are two types of HTML e-mails:
 *
 * 1) E-mails written by humans which are basically unstructured prose plus
 *    quoting.  The biggest problems these face are deep quoting causing
 *    blockquote padding to cause text to have very little screen real estate.
 *
 * 2) Newsletter style e-mails which are structured and may have multiple
 *    columns, grids of images and stuff like that.  They historically have
 *    tended to assume a size of about 600px.  However, it's increasingly common
 *    to be smart and use media queries.  Unfortunately, we don't support media
 *    queries right now and so it's very likely we'll end up in the desktop
 *    case.
 *
 * We originally treated these types of mails differently, but over time it
 * became clear that this was not a great strategy, especially since showing
 * external images/etc. could push a "normal" email into being a "newsletter"
 * email.  We also intentionally would trigger a layout with relaxed constraints
 * then try and tighten them up.
 *
 * Our (new) strategy is to create the iframe so that it fits in the width we
 * have available.  On flame devices that's 290px right now, though the actual
 * size is discovered at runtime and doesn't matter.
 *
 * As discussed above, we poll the scrollWidth and scrollHeight for a while to
 * make sure that it stabilizes.  The trick is that if something is a newsletter
 * it will end up wanting to be wider than our base/screen 290px.  We will
 * detect this and update our various dimensions, including our "fit-to-width"
 * scale.  Since we pick 100% or the computed fit-to-width scale, whichever is
 * smaller, the non-newsletter case is just us using a fit-to-width zoom factor
 * that just happens to be 100%.  The newsletter case is when fit-to-width is
 * less than 100%.
 *
 * ## Bugs / Doc Links ##
 *
 * - Font-inflation is a thing.  It's not clear it affects us:
 *   http://jwir3.wordpress.com/2012/07/30/font-inflation-fennec-and-you/
 *
 * - iframe "seamless" doesn't work, so we manually need to poke stuff:
 *   https://bugzilla.mozilla.org/show_bug.cgi?id=80713
 *
 * Uh, the ^ stuff below should really be @, but it's my jstut syntax that
 * gjslint simply hates, so...
 *
 * ^args[
 *   ^param[htmlStr]
 *   ^param[parentNode]{
 *     The (future) parent node of the iframe.
 *   }
 *   ^param[adjacentNode ^oneof[null HTMLNode]]{
 *     insertBefore semantics.
 *   }
 *   ^param[linkClickHandler ^func[
 *     ^args[
 *       ^param[event]{
 *       }
 *       ^param[linkNode HTMLElement]{
 *         The actual link HTML element
 *       }
 *       ^param[linkUrl String]{
 *         The URL that would be navigated to.
 *       }
 *       ^param[linkText String]{
 *         The text associated with the link.
 *       }
 *     ]
 *   ]]{
 *     The function to invoke when (sanitized) hyperlinks are clicked on.
 *     Currently, the links are always 'a' tags, but we might support image
 *     maps in the future.  (Or permanently rule them out.)
 *   }
 * ]
 */
let iframe = null;
function createAndInsertIframeForContent(htmlStr, scrollContainer,
                                         parentNode, beforeNode,
                                         interactiveMode,
                                         clickHandler, callback) {
  // We used to care about running in Firefox nightly.  This was a fudge-factor
  // to account for its stupid scroll-bars that could not be escaped.  If you
  // are using nightly, maybe it makes sense to turn this back up.  Or maybe we
  // leave this zero and style the scrollbars to be overlays in b2g.  Who knows.
  let scrollPad = 0;

  // Properly narrow transform(98%) to show html message body better
  const aPercent = 0.98;

  let viewportWidth = parentNode.offsetWidth - scrollPad;
  let viewport = document.createElement('div');
  viewport.setAttribute(
    'style',
    'padding: 0; border-width: 0; margin: 0; ' +
    //'position: relative; ' +
    'overflow: hidden;');
  viewport.style.width = viewportWidth + 'px';
  // leave height unsized for now.

  if (!iframe || parentNode.classList.contains('cmp-body-html')) {
    iframe = document.createElement('iframe');

    iframe.setAttribute('sandbox', 'allow-same-origin');
    // Styling!
    iframe.setAttribute(
      'style',
      // no border! no padding/margins.
      'padding: 0; border-width: 0; margin: 0; ' +
      // I don't think this actually stops the iframe from being internally
      // scrolly, but I wouldn't remove this without some testing...
      'overflow: hidden; ' +
      // When scaling, use the top-left for math sanity.
      'transform-origin: top ' +
      (document.documentElement.dir === 'rtl' ? 'right' : 'left') + '; ' +
      // The iframe does not want to process its own clicks!  that's what
      // bindSanitizedClickHandler is for!
      'pointer-events: none;');
  }
  
  if (iframeShimsOpts.tapTransform) {
    iframe.style.transform = 'scale(1)';
  }
  // try and get the page to size itself to our actually available space.
  iframe.style.width = viewportWidth + 'px';

  // We need to be linked into the DOM tree to be able to write to our document
  // and have CSS and improtant things like that work.
  viewport.appendChild(iframe);
  parentNode.insertBefore(viewport, beforeNode);

  // we want this fully synchronous so we can know the size of the document
  iframe.contentDocument.open();
  iframe.contentDocument.write('<!doctype html><html><head>');
  iframe.contentDocument.write(DEFAULT_STYLE_TAG);
  iframe.contentDocument.write('</head><body>');
  // (currently our sanitization only generates a body payload...)
  iframe.contentDocument.write(htmlStr);
  iframe.contentDocument.write('</body>');
  iframe.contentDocument.close();
  let iframeBody = iframe.contentDocument.body;

  // NOTE.  This has gone through some historical iterations here AKA is
  // evolved.  Technically, getBoundingClientRect() may be superior since it can
  // have fractional parts.  I believe I tried using it with
  // iframe.contentDocument.documentElement and it ended up betraying me by
  // reporting clientWidth/clientHeight instead of scrollWidth, whereas
  // scrollWidth/scrollHeight worked better.  However I was trying a lot of
  // things; I might just have been confused by some APZ glitches where panning
  // right would not work immediately after zooming and you'd have to pan left
  // first in order to pan all the way to the newly expaned right.  What we know
  // right now is this gives the desired behaviour sizing behaviour.
  let scrollWidth = iframeBody.scrollWidth;
  let scrollHeight = iframeBody.scrollHeight;

  // fit-to-width scale.
  let baseScale = Math.min(1, viewportWidth / scrollWidth),
      // If there's an initial scale, use that, otherwise fall back to the base
      // (fit-to-width) scale
      lastRequestedScale = iframeShimsOpts.initialScale || baseScale,
      scale = lastRequestedScale,
      lastDoubleTapScale = scale,
      scaleMode = 0;

  viewport.style.width = Math.ceil(scrollWidth * scale) + 'px';
  viewport.style.height = Math.ceil(scrollHeight * scale) + 'px';

  // setting iframe.style.height is not sticky, so be heavy-handed.
  // Also, do not set overflow: hidden since we are already clipped by our
  // viewport or our containing card and Gecko slows down a lot because of the
  // extra clipping.
  iframe.style.width = scrollWidth + 'px';

  let resizeFrame = function(why) {
    if (why === 'initial' || why === 'poll') {
      scrollWidth = iframeBody.scrollWidth;
      scrollHeight = iframeBody.scrollHeight;
      // the baseScale will almost certainly have changed
      let oldBaseScale = baseScale;
      baseScale = Math.min(1, viewportWidth / scrollWidth);
      if (scale === oldBaseScale) {
        scale = baseScale;
      }
      iframe.style.width = scrollWidth + 'px';
      console.log('iframe_shims: recalculating height / width because', why,
                  'sw', scrollWidth, 'sh', scrollHeight, 'bs', baseScale);
    }

    iframe.style.transform = 'scale(' + scale * aPercent + ')';
    iframe.style.height =
      ((scrollHeight * Math.max(1, scale)) + scrollPad) + 'px';
    viewport.style.width = Math.ceil(scrollWidth * scale) + 'px';
    viewport.style.height = (Math.ceil(scrollHeight * scale) + scrollPad) +
                              'px';
  };
  resizeFrame('initial');

  let activeZoom = false, lastCenterX, lastCenterY;
  /**
   * Zoom to the given scale, eventually.  If we are actively zooming or have
   * recently zoomed and need for various async things to catch up, we will
   * wait a bit before actually zooming to that scale.  We latch the most recent
   * value in all cases.
   */
  let zoomFrame = function(newScale, centerX, centerY) {
    // There is nothing to do if we are actually already at this scale level.
    // (Note that there still is something to do if newScale ===
    //  lastRequestedScale, though!)
    if (newScale === scale) {
      return;
    }
    lastRequestedScale = newScale;
    lastCenterX = centerX;
    lastCenterY = centerY;
    if (activeZoom) {
      return;
    }
    activeZoom = true;

    // Our goal is to figure out how to scroll the window so that the
    // location on the iframe corresponding to centerX/centerY maintains
    // its position after zooming.

    // centerX, centerY  are in screen coordinates.  Offset coordinates of
    // the scrollContainer are screen (card) relative, but those of things
    // inside the scrollContainer exist within that coordinate space and
    // do not change as we scroll.
    // console.log('----ZOOM from', scale, 'to', newScale);
    // console.log('cx', centerX, 'cy', centerY,
    //             'vl', viewport.offsetLeft,
    //             'vt', viewport.offsetTop);
    // console.log('sl', scrollContainer.offsetLeft,
    //             'st', scrollContainer.offsetTop);

    // Figure out how much of our iframe is scrolled off the screen.
    let iframeScrolledTop = scrollContainer.scrollTop - extraHeight,
        iframeScrolledLeft = scrollContainer.scrollLeft;

    // and now convert those into iframe-relative coords
    let ix = centerX + iframeScrolledLeft,
        iy = centerY + iframeScrolledTop;

    let scaleDelta = (newScale / scale);

    let vertScrollDelta = Math.ceil(iy * scaleDelta),
        horizScrollDelta = Math.ceil(ix * scaleDelta);

    scale = newScale;
    resizeFrame('zoom');
    scrollContainer.scrollTop = vertScrollDelta + extraHeight - centerY;
    scrollContainer.scrollLeft = horizScrollDelta - centerX;

    // Right, so on a Flame device I'm noticing serious delays in getting all
    // this painting and such done, so it seems like we really want to up this
    // constant to let any async stuff happen and to give the system some time
    // to recover and maybe run a GC.  Because there is a very real chance of
    // someone happilly zooming in-and-out over and over to cause us to hit a
    // GC ceiling.
    window.setTimeout(clearActiveZoom, iframeShimsOpts.zoomDelayMS);
  };
  let clearActiveZoom = function() {
    activeZoom = false;
    if (scale !== lastRequestedScale) {
      window.requestAnimationFrame(function() {
        // This is almost certainly going to cause a memory spike, so log it.
        // ugh.
        console.log('delayed zoomFrame timeout, probably causing a mem-spike');
        zoomFrame(lastRequestedScale, lastCenterX, lastCenterY);
      });
    }
  };

  // See giant block comment and timer constants for a description of our
  // polling logic and knobs.
  let resizePollerTimeout = null;
  // track how many times we've checked.  We want to bound this for battery life
  // purposes and also to avoid weird sad cases.
  let resizePollCount = 0;
  let pollResize = function() {
    let opts = iframeShimsOpts;
    let desiredScrollWidth = iframeBody.scrollWidth;
    let desiredScrollHeight = iframeBody.scrollHeight;
    let resized = false;
    // if we need to grow, grow.  (for stability reasons, we never want to
    // shrink since it could lead to infinite oscillation)
    if (desiredScrollWidth > scrollWidth ||
        desiredScrollHeight > scrollHeight) {
      resizeFrame('poll');
      resized = true;
    }

    if (++resizePollCount < opts.resizeLimit) {
      // we manually schedule ourselves for slack purposes
      resizePollerTimeout = window.setTimeout(
        pollResize,
        resized ? opts.didResizePollIntervalMS : opts.noResizePollIntervalMS);
    } else {
      resizePollerTimeout = null;
      if (callback) {
        callback(scale * aPercent);
      }
    }
  };
  resizePollerTimeout = window.setTimeout(
    pollResize, iframeShimsOpts.initialResizePollIntervalMS);

  let iframeShims = {
    scale: scale,
    iframe: iframe,
    // (This is invoked each time an image "load" event fires.)
    resizeHandler: function() {
      resizePollCount = 0;
      // Reset the existing timeout because many emails with external images
      // will have a LOT of external images so it could take a while for them
      // all to load.
      if (resizePollerTimeout) {
        window.clearTimeout(resizePollerTimeout);
      }
      resizePollerTimeout = window.setTimeout(
        pollResize, iframeShimsOpts.pictureDelayPollIntervalMS);
    }
  };

  if (interactiveMode !== 'interactive') {
    return iframeShims;
  }

  let title = document.getElementsByClassName('msg-reader-header')[0];
  let header = document.getElementsByClassName('msg-envelope-bar')[0];
  let extraHeight = title.clientHeight + header.clientHeight;

  return iframeShims;
}

function bindSanitizedClickHandler(target, clickHandler, topNode, iframe) {
  let eventType, node;
  // Variables that only valid for HTML type mail.
  let root, title, header, attachmentsContainer, msgBodyContainer,
      titleHeight, headerHeight, attachmentsHeight,
      msgBodyMarginTop, msgBodyMarginLeft, attachmentsMarginTop,
      iframeDoc, inputStyle, loadBar, loadBarHeight;
  // Tap gesture event for HTML type mail and click event for plain text mail
  if (iframe) {
    root = document.getElementsByClassName('scrollregion-horizontal-too')[0];
    title = document.getElementsByClassName('msg-reader-header')[0];
    header = document.getElementsByClassName('msg-envelope-bar')[0];
    attachmentsContainer =
      document.getElementsByClassName('msg-attachments-container')[0];
    loadBar = document.getElementsByClassName('msg-reader-load-infobar')[0];
    msgBodyContainer = document.getElementsByClassName('msg-body-container')[0];
    inputStyle = window.getComputedStyle(msgBodyContainer);
    msgBodyMarginTop = parseInt(inputStyle.marginTop);
    msgBodyMarginLeft = parseInt(inputStyle.marginLeft);
    titleHeight = title.clientHeight;
    headerHeight = header.clientHeight;
    eventType = 'tap';
    iframeDoc = iframe.contentDocument;
  } else {
    eventType = 'click';
  }
  target.addEventListener(
    eventType,
    function clicked(event) {
      if (iframe) {
        // Because the "show (external) images" loadBar could be opened or
        // closed depending on what the user does relative to this click, get
        // the client height at the time of click.
        loadBarHeight = loadBar.clientHeight;

        // Because the attachments are updating late,
        // get the client height while clicking iframe.
        attachmentsHeight = attachmentsContainer.clientHeight;
        inputStyle = window.getComputedStyle(attachmentsContainer);
        attachmentsMarginTop =
          (attachmentsHeight) ? parseInt(inputStyle.marginTop) : 0;
        let dx, dy;
        let transform = iframe.style.transform || 'scale(1)';
        let scale = transform.match(/(\d|\.)+/g)[0];

        // When in rtl mode, scroll is relative to right side, but the
        // document inside the iframe is ltr based, since it does not set a
        // document-wide dir setting and instead the DOM content inside the
        // message manages the dir itself.
        if (document.dir === 'rtl') {
          dx = event.detail.clientX - msgBodyMarginLeft +
               // The scrollLeft is calculated from the right side, with right
               // being zero and left being a negative value from the *right*
               // edge of the element. So to get the x value from the left, need
               // the difference of scrollWidth from scrollLeft (which is a
               // negative value), and also subtracting out the width of the
               // element to get the value relative to the *left* side of the
               // element.
               root.scrollWidth + root.scrollLeft - root.clientWidth;
        } else {
          dx = event.detail.clientX + root.scrollLeft - msgBodyMarginLeft;
        }

        dy = event.detail.clientY + root.scrollTop -
             titleHeight - headerHeight - loadBarHeight -
             attachmentsHeight - attachmentsMarginTop - msgBodyMarginTop;

        node = iframeDoc.elementFromPoint(dx / scale, dy / scale);

        // Uncomment to show a red square on where the code thinks the tap
        // occurred in the iframe. Useful for debugging.
        // let temp = iframeDoc.createElement('div');
        // temp.style.position = 'absolute';
        // temp.style.overflow = 'hidden';
        // temp.style.top = ((dy / scale) - 5) + 'px';
        // temp.style.left = ((dx / scale) - 5) + 'px';
        // temp.style.width = '10px';
        // temp.style.height = '10px';
        // temp.style.backgroundColor = 'red';
        // iframeDoc.body.appendChild(temp);
      } else {
        node = event.originalTarget;
      }
      while (node !== topNode) {
        if (node.nodeName === 'A') {
          if (node.hasAttribute('ext-href')) {
            if (clickHandler) {
              clickHandler(event, node, node.getAttribute('ext-href'),
                  node.textContent);
            }
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
        node = node.parentNode;
      }
    });
}

return {
  createAndInsertIframeForContent: createAndInsertIframeForContent,
  bindSanitizedClickHandler: bindSanitizedClickHandler,
  iframeShimsOpts: iframeShimsOpts
};

});



define('cards/editor_mixins',['require'],function(require) {

  return {

    _bindEditor: function(textNode) {
      this._editorNode = textNode;
    },
    /**
     * Inserts an email into the contenteditable element
     */
    populateEditor: function(value) {
      let lines = value.split('\n');
      let frag = document.createDocumentFragment();
      for (let i = 0, len = lines.length; i < len; i++) {
        if (i) {
          frag.appendChild(document.createElement('br'));
        }

        if (lines[i]) {
          frag.appendChild(document.createTextNode(lines[i]));
        }
      }

      // Need at least one text node for tapping and keyboard display to work.
      if (!frag.childNodes.length) {
        frag.appendChild(document.createTextNode(''));
      }

      this._editorNode.appendChild(frag);
    },

    /**
     * Gets the raw value from a contenteditable div
     */
    fromEditor: function(value) {
      let content = '';
      let len = this._editorNode.childNodes.length;
      for (let i = 0; i < len; i++) {
        let node = this._editorNode.childNodes[i];
        if (node.nodeName === 'BR' &&
            // Gecko's contenteditable implementation likes to create a
            // synthetic trailing BR with type="_moz".  We do not like/need
            // this synthetic BR, so we filter it out.  Check out
            // nsTextEditRules::CreateTrailingBRIfNeeded to find out where it
            // comes from.
            node.getAttribute('type') !== '_moz') {
          content += '\n';
        } else {
          content += node.textContent;
        }
      }

      return content;
    }

  };
});

define('tmpl!cards/msg/header_item.html',['tmpl'], function (tmpl) { return tmpl.toDom('<a class="msg-header-item" role="option" tabindex="0">\n  <label class="pack-checkbox negative" aria-hidden="true">\n    <input type="checkbox"><span></span>\n  </label>\n  <div class="msg-header-details-section">\n    <span dir="auto" class="msg-header-author p-pri"></span>\n    <span dir="auto" class="msg-header-subject p-sec"></span>\n    <span dir="auto" class="msg-header-date p-thi"></span>\n    <span dir="auto" class="msg-header-snippet p-thi"></span>\n  </div>\n  <div class="msg-header-syncing-section"></div>\n  <div class="msg-header-flags-section">\n    <div class="msg-header-unread-section"\n       data-l10n-id="message-header-unread"></div>\n    <div class="msg-header-reply-section"\n       data-l10n-id="message-header-reply"></div>\n    <div class="msg-header-forward-section"\n       data-l10n-id="message-header-forward"></div>\n  </div>\n  <div class="msg-header-icons-section">\n    <span class="msg-header-attachments"\n          data-l10n-id="message-header-attachments"></span>\n    <span class="msg-header-star" data-l10n-id="message-header-starred"></span>\n  </div><div class="msg-header-avatar-section" aria-hidden="true">\n  </div></a>\n'); });


define('date',['require','l10n!'],function(require) {
  let mozL10n = require('l10n!');
  let _ = mozL10n.get;

  let date = {
    /**
     * Display a timestamp
     */
    showDateTime: function(time) {
      let dateFormat = new Date(time);
      let options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: window.navigator.mozHour12
      };
      return dateFormat.toLocaleString(navigator.language, options);
    },

    /**
     * Display a human-readable relative timestamp.
     */
    prettyDate: function(time, useCompactFormat, syncTime) {
      let maxDiff = 86400;

      switch (time.constructor) {
        case String: // timestamp
          time = parseInt(time);
          break;
        case Date:
          time = time.getTime();
          break;
      }

      let start;
      if (syncTime) {
        start = Date.now();
        maxDiff *= 7;
      } else {
        start = new Date(new Date().toLocaleDateString()).getTime();
      }

      let secDiff = (start - time) / 1000;
      if (isNaN(secDiff)) {
        return _('incorrectDate');
      }

      if (Math.abs(secDiff) > 60) {
        // round milliseconds up if difference is over 1 minute so the result
        // is closer to what the user would expect (1h59m59s300ms diff should
        // return "in 2 hours" instead of "in an hour")
        secDiff = secDiff > 0 ? Math.ceil(secDiff) : Math.floor(secDiff);
      }

      if (syncTime) {
        return this.dateL10nFormat(time, secDiff, maxDiff, useCompactFormat);
      }

      let options;
      if (Math.abs(secDiff) > maxDiff) {
        options = { year: 'numeric', month: '2-digit', day: '2-digit' };
      } else if (secDiff > 0) {
        return  _('days-ago-long', { value: 1 });
      } else {
        options = {
          hour: '2-digit',
          minute: '2-digit',
          hour12: window.navigator.mozHour12
        };
      }

      let dateFormat = new Date(time);
      return dateFormat.toLocaleString(navigator.language, options);
    },

    dateL10nFormat: function(time, secDiff, maxDiff, useCompactFormat) {
      let dateFormat = new mozL10n.DateTimeFormat();
      if (secDiff > maxDiff) {
        return dateFormat.localeFormat(new Date(time), '%x');
      }

      let f = useCompactFormat ? '-short' : '-long';
      let parts = dateFormat.relativeParts(secDiff);

      let affix = secDiff >= 0 ? '-ago' : '-until';
      for (let i in parts) {
        return _(i + affix + f, { value: parts[i]});
      }
    },

    /**
     * Given a node, show a pretty date for its contents.
     * @param {Node} node  the DOM node.
     * @param {Number} timestamp a timestamp like the one retuned
     * from Date.getTime().
     */
    setPrettyNodeDate: function(node, timestamp) {
      if (timestamp) {
        node.dataset.time = timestamp.valueOf();
        node.dataset.compactFormat = true;
        node.dataset.l10nFormat = true;
        node.textContent = date.prettyDate(timestamp, true, true);
      } else {
        node.textContent = '';
        node.removeAttribute('data-time');
      }
    }
  };

  return date;
});



define('vscroll',['require','exports','module','evt'],function(require, exports, module) {

  let evt = require('evt'),
      slice = Array.prototype.slice,
      useTransform = false;

  /**
   * Indirection for setting the top of a node. Used to allow
   * experimenting with either a transform or using top
   */
  function setTop(node, value) {
    if (useTransform) {
      node.style.transform = 'translateY(' + value + 'px)';
    } else {
      node.style.top = value + 'px';
    }
  }

  // VScroll --------------------------------------------------------
  /**
   * Creates a new VScroll instance. Needs .setData() called on it
   * to actually show content, the constructor just wires up nodes
   * and sets starting state.
   *
   * @param {Node} container the DOM node that will show the items.
   *
   * @param {Node} scrollingContainer the scrolling DOM node, which
   * contains the `container` node. Note that in email, there are
   * other nodes in the scrollingContainer besides just container.
   *
   * @param {Node} template a DOM node that is cloned to provide
   * the DOM node to use for an item that is shown on the screen.
   * The clones of this node are cached and reused for multiple
   * data items.
   *
   * @param {Object} defaultData a placeholder data object to use
   * if list(index) does not return an object. Usually shows up when
   * the scroll gets to a place in the list that does not have data
   * loaded yet from the back end.
   */
  function VScroll(container, scrollingContainer, template, defaultData) {
    evt.Emitter.call(this);

    this.container = container;
    this.scrollingContainer = scrollingContainer;
    this.template = template;
    this.defaultData = defaultData;

    this._inited = false;

    // In a sane world, _initing would not be needed. However, it was discovered
    // during the fastcache work that _init() would be entered twice. The first
    // entrance would pause at the .clientHeight call, which would trigger
    // events that led to nowVisible being called and this second _init call
    // would complete. The first one would try to complete but then rand into
    // errors. This happened on an activity return cancel from contacts to
    // compose card, where the compose card back was pressed without saving the
    // draft. Usually, but not always, this weird condition would manifest
    // during the transition back to the contacts app. The error in the logcat
    // that indicated this error was:
    // ERR: onerror reporting: NotFoundError:
    // Node was not found @ app://email.gaiamobile.org/js/config.js : 10814
    this._initing = false;

    // Because the FxOS keyboard works by resizing our window, we/our caller
    // need to be careful about when we sample things involving the screen size.
    // So, we want to only capture this once and do it separably from other
    // things.
    this._capturedScreenMetrics = false;

    /**
     * What is the first/lowest rendered index?  Tracked so the HTML
     * cache logic can know if we've got the data for it to be able to
     * render the first N nodes.
     */
    this.firstRenderedIndex = 0;

    this._limited = false;

    /**
     * The list of reused Element nodes.  Their order in this list has
     * no correlation with their display position.  If you decide to
     * reorder them you may break/hurt _nextAvailableNode.
     */
    this.nodes = [];
    /**
     * Maps data indexes to their reusable Element nodes if currently
     * rendered, or -1 if previously (but not currently rendered).
     * Populated as nodes are rendered so not being in the map is
     * effectively the same as having a value of -1.
     *
     * Maintained by _setNodeDataIndex and accessed by
     * _getNodeFromDataIndex.  Use those methods and do not touch this
     * map directly.
     */
    this.nodesDataIndices = {};
    /** Internal state variable of _nextAvailableNode for efficiency. */
    this.nodesIndex = -1;

    this.scrollTop = 0;

    /**
     * Any visible height offset to where container sits in relation
     * to scrollingContainer. Expected to be set by owner of the
     * VScroll instance. In email, the search box height is an
     * example of a visibleOffset.
     */
    this.visibleOffset = 0;

    /**
     * The old list size is used for display purposes, to know if new data would
     * affect the scroll offset or if the total display height needs to be
     * adjusted.
     */
    this.oldListSize = 0;

    this._lastEventTime = 0;

    this.listNodeCount = 0;

    // Bind to this to make reuse in functional APIs easier.
    this.onEvent = this.onEvent.bind(this);
    this.onChange = this.onChange.bind(this);
    this._scrollTimeoutPoll = this._scrollTimeoutPoll.bind(this);
  }

  VScroll.nodeClassName = 'vscroll-node';

  /**
   * Given a node that is handled by VScroll, trim it down for use
   * in a string cache, like email's html cache. Modifies the
   * node in place.
   * @param  {Node} node the containerNode that is bound to
   * a VScroll instance.
   * @param  {Number} itemLimit number of items to cache. If greater
   * than the length of items in a NodeCache, the NodeCache item
   * length will be used.
   */
  VScroll.trimMessagesForCache = function(container, itemLimit) {
    // Find the NodeCache that is at the top
    let nodes = slice.call(container.querySelectorAll(
                           '.' + VScroll.nodeClassName));
    nodes.forEach((node) => {
      let index = parseInt(node.dataset.index, 10);
      // None of the clones need this value after we read it off, so reduce
      // the size of the cache by clearing it.
      delete node.dataset.index;
      if (index > itemLimit - 1) {
        container.removeChild(node);
      }
    });
  };

  VScroll.prototype = {
    /**
     * rate limit for event handler, in milliseconds, so that
     * it does not do work for every event received. If set to
     * zero, it means always do the work for every scroll event.
     * If this code continues to use 0, then the onEvent/onChange
     * duality could be removed, and just use onChange directly.
     * A non-zero value, like 50 subjectively seems to result in
     * more checkerboarding of half the screen every so often.
     */
    eventRateLimitMillis: 0,


    /**
     * The maximum number of items visible on the screen at once
     * (derived from available space and rounded up).
     */
    itemsPerScreen: undefined,

    /**
     * The number of screens worth of items to pre-render in the
     * direction we are scrolling beyond the current screen.
     */
    prerenderScreens: 3,

    /**
     * The number of screens worth of items to prefetch (but not
     * render!) beyond what we prerender.
     */
    prefetchScreens: 2,

    /**
     * The number of extra screens worth of rendered items to keep
     * around beyond what is required for prerendering.  When
     * scrolling in a single direction, this ends up being the number
     * of screens worth of items to keep rendered behind us.  If this
     * is less than the value of `prerenderScreens` then a user just
     * jiggling the screen up and down by even a pixel will cause us
     * work as we move the delta back and forth.
     *
     * In other words, don't have this be less than
     * `prerenderScreens`, but you can have it be more.  (Although
     * having it be more is probably wasteful since extra DOM nodes
     * the user is moving away from don't help us.)
     */
    retainExtraRenderedScreens: 3,

    /**
     * When recalculating, pre-render this many screens of messages on
     * each side of the current screen.  This may be a fractional
     * value (we round up).
     *
     * In the initial case we very much want to minimize rendering
     * latency, so it makes sense for this to be smaller than
     * `prerenderScreens`.
     *
     * In the non-initial case we wait for scrolling to have quiesced,
     * so there's no overriding need to bias in either direction.
     */
    recalculatePaddingScreens: 1.5,

    /**
     * Track when the last time vscroll manually changed the scrollTop
     * of the scrolling container. Useful for when knowing if a recent
     * scroll event was triggered by this component or by user action.
     * The value resets to 0 periodically to avoid interested code from
     * doing too many timestamp checks on every scroll event.
     */
    lastScrollTopSetTime: 0,

    /**
     * The number of items to prerender (computed).
     */
    prerenderItemCount: undefined,

    /**
     * The number of items to prefetch (computed).
     */
    prefetchItemCount: undefined,

    /**
     * The number of items to render when (non-initial) recalculating.
     */
    recalculatePaddingItemCount: undefined,

    /**
     * The class to find items that have their default data set,
     * in the case where a scroll into a cache has skipped updates
     * because a previous fast scroll skipped the updates since they
     * were not visible at the time of that fast scroll.
     */
    itemDefaultDataClass: 'default-data',

    /**
     * Hook that is implemented by the creator of a VScroll instance.
     * Called when the VScroll thinks it will need the next set of
     * data, but before the VScroll actually shows that section of
     * data. Passed the inclusive high absolute index for which it
     * wants data.  ASSUMES data sources that only need to grow
     * downward.
     */
    prepareData: function(highAbsoluteIndex) {},

    /**
     * Hook that is implemented by the creator of a VScroll instance.
     * Called when the VScroll wants to bind a model object to a
     * display node.
     */
    bindData: function(model, node) {},

    setListNodeCount: function(count) {
      this.listNodeCount = count;
    },

    /**
     * Sets the list data source, and then triggers a recalculate
     * since the data changed.
     * @param {Function} list the list data source.
     */
    setData: function(list) {
      this.list = list;
      if (this._inited) {
        if (!this.waitingForRecalculate) {
          this._recalculate(0);
        }
        this.emit('dataChanged');
      } else {
        this._init();
        this.renderCurrentPosition();
      }
    },

    /**
     * Called by code that created the VScroll instance, when that
     * code has data fetched and wants to let the VScroll know
     * about it. This is useful from removing the display of
     * defaultData and showing the finally fetched data.
     * @param  {Number} index the list item index for which the
     * data update is available
     * @param  {Array} dataList the list of data items that are
     * now available. The first item in that list corresponds to
     * the data list index given in the first argument.
     * @param  {number} removedCount the count of any items removed.
     * Used mostly to know if a recalculation needs to be done.
     */
    updateDataBind: function(index, dataList, removedCount) {
      if (!this._inited) {
        return;
      }

      // If the list data set length is different from before, that
      // indicates state is now invalid and a recalculate is needed,
      // but wait until scrolling stops. This can happen if items
      // were removed, or if new things were added to the list.
      if (this.oldListSize !== this.list.size() || removedCount) {
        if (!this.waitingForRecalculate) {
          this.waitingForRecalculate = true;
          this.once('scrollStopped', () => {
            this._recalculate(index);
          });
        }
        return;
      }

      // Not a list data size change, just an update to existing
      // data items, so update them in place.
      for (let i = 0; i < dataList.length; i++) {
        let absoluteIndex = index + i;
        let node = this._getNodeFromDataIndex(absoluteIndex);
        if (node) {
          this.bindData(dataList[i], node);
        }
      }
    },

    /**
     * Handles events fired, and allows rate limiting the work if
     * this.eventRateLimitMillis has been set. Otherwise just calls
     * directly to onChange.
     */
    onEvent: function() {
      this._lastEventTime = Date.now();

      if (!this.eventRateLimitMillis) {
        this.onChange();
        return;
      }

      if (this._limited) {
        return;
      }
      this._limited = true;
      setTimeout(this.onChange, this.eventRateLimitMillis);
    },

    /**
     * Process a scroll event (possibly delayed).
     */
    onChange: function() {
      // Rate limit is now expired since doing actual work.
      this._limited = false;

      if (!this._inited) {
        return;
      }

      if (this.lastScrollTopSetTime) {
        // Keep the last scroll time for about a second, which should
        // be enough time for interested parties to check the value.
        if (this.lastScrollTopSetTime + 1000 < Date.now()) {
          this.lastScrollTopSetTime = 0;
        }
      }

      let startIndex,
          endIndex,
          scrollTop = this.scrollingContainer.scrollTop,
          scrollingDown = scrollTop >= this.scrollTop;
      this.scrollTop = scrollTop;
      // must get after updating this.scrollTop since it uses that
      let visibleRange = this.getVisibleIndexRange();

      if (scrollingDown) {
        // both _render and prepareData clamp appropriately
        startIndex = visibleRange[0];
        endIndex = visibleRange[1] + this.prerenderItemCount;
        this.prepareData(endIndex + this.prefetchItemCount);
      } else {
        // scrolling up
        startIndex = visibleRange[0] - this.prerenderItemCount;
        endIndex = visibleRange[1];
        // no need to prepareData; it's already there!
      }

      this._render(startIndex, endIndex);

      this._startScrollStopPolling();
    },

    /**
     * Called when the vscroll becomes visible. In cases where the vscroll
     * may have been intially created for an element that is not visible,
     * the sizing information would not be correct and the vscroll instance
     * would not be initialized correctly. So the instance needs to know
     * when it should check again to properly initialize. Otherwise, there
     * may not be any new data signals from the the list data that a display
     * needs to be tried.
     */
    nowVisible: function() {
      // Only do work if not initialized and have data.
      if (!this._inited && this.list) {
        this._init();
        this.onChange();
      }
    },

    /**
     * Renders the list at the current scroll position.
     */
    renderCurrentPosition: function() {
      if (!this._inited) {
        return;
      }

      this.scrollTop = this.scrollingContainer.scrollTop;

      let visibleRange = this.getVisibleIndexRange();
      // (_render clamps these values for sanity; we don't have to)
      let startIndex = visibleRange[0] - this.recalculatePaddingItemCount;
      let endIndex = visibleRange[1] + this.recalculatePaddingItemCount;

      this._render(startIndex, endIndex);
      // make sure we have at least enough data to cover what we want
      // to display
      this.prepareData(endIndex);
    },

    /**
     * Determine what data index is at the given scroll position.
     * @param  {Number} position scroll position
     * @return {Number} the data index.
     */
    indexAtScrollPosition: function (position) {
      let top = position - this.visibleOffset;
      if (top < 0) {
        top = 0;
      }
      return this.itemHeight ? Math.floor(top / this.itemHeight) : 0;
    },

    /**
     * Returns the start index and end index of the list items that
     * are currently visible to the user using the currently cached
     * scrollTop value.
     * @return {Array} first and last index. Array could be undefined
     * if the VScroll is not in a position to show data yet.
     */
    getVisibleIndexRange: function() {
      // Do not bother if itemHeight has not bee initialized yet.
      if (this.itemHeight === undefined) {
        return undefined;
      }

      let top = this.scrollTop;

      return [
        this.indexAtScrollPosition(top),
        this.indexAtScrollPosition(top + this.innerHeight)
      ];
    },

    /**
     * Given the list index, scroll to the top of that item.
     * @param  {Number} index the list item index.
     */
    jumpToIndex: function(index) {
      this._setContainerScrollTop((index * this.itemHeight) +
                                          this.visibleOffset);
    },

    /**
     * Removes items from display in the container. Just a visual
     * change, does not change data in any way. Data-related
     * elements, like the positions of this.nodes, are reset in
     * the data entry points that follow a clearDisplay, like
     * _init() or recalculate().
     */
    clearDisplay: function() {
      // Clear the HTML content.
      this.container.innerHTML = '';
      this.container.style.height = '0px';

      // Also clear the oldListSize, since it used for height/scroll offset
      // updates, and now that the container does not have any children, this
      // property should be reset to zero. If this is not done, it is possible
      // for an update that matches the same size as the previous data will not
      // end up showing items. This happened for search in bug 1081403.
      this.oldListSize = 0;
    },

    /**
     * Call this method before the VScroll instance will be destroyed.
     * Used to clean up the VScroll.
     */
    destroy: function() {
      this.scrollingContainer.removeEventListener('scroll', this.onEvent);
      if (this._scrollTimeoutPoll) {
        clearTimeout(this._scrollTimeoutPoll);
        this._scrollTimeoutPoll = 0;
      }
    },

    _setContainerScrollTop: function(value) {
      this.scrollingContainer.scrollTop = value;
      // Opt for using a property set instead of an event emitter, since the
      // timing of that event emit is not guaranteed to get to listeners before
      // scroll events.
      this.lastScrollTopSetTime = Date.now();
    },

    /**
     * Ensure that we are rendering at least all messages in the
     * inclusive range [startIndex, endIndex].  Already rendered
     * messages outside this range may be reused but will not be
     * removed or de-rendered unless they are needed.
     *
     *
     * @param {Number} startIndex first inclusive index in this.list's
     * data that should be used.  Will be clamped to the bounds of
     * this.list but what's visible on the screen is not considered
     * @param {Number} endIndex last inclusive index in this.list's
     * data that should be used.  Clamped like startIndex.
     */
    _render: function(startIndex, endIndex) {
      let i,
          listSize = this.list.size();

      // Paranoia clamp the inputs; we depend on callers to deal with
      // the visible range.
      if (startIndex < 0) {
        startIndex = 0;
      }
      if (endIndex >= listSize) {
        endIndex = listSize - 1;
      }

      this.firstRenderedIndex = startIndex;

      if (!this._inited) {
        this._init();
      }

      for (i = startIndex; i <= endIndex; i++) {
        // If node already bound and placed correctly, skip it.
        if (this._getNodeFromDataIndex(i)) {
          continue;
        }

        let node = this._nextAvailableNode(startIndex, endIndex),
            data = this.list(i);

        if (!data) {
          data = this.defaultData;
        }

        // Remove the node while doing updates in positioning to
        // avoid extra layers from being created which really slows
        // down scrolling.
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }

        setTop(node, i * this.itemHeight);
        this._setNodeDataIndex(this.nodesIndex, i);
        this.bindData(data, node);

        this.container.appendChild(node);

      }
    },

    _setNodeDataIndex: function(nodesIndex, dataIndex) {
      // Clear dataIndices map for old dataIndex value.
      let oldDataIndex = this.nodes[nodesIndex].vScrollDataIndex;
      if (oldDataIndex > -1) {
        this.nodesDataIndices[oldDataIndex] = -1;
      }

      let node = this.nodes[nodesIndex];
      node.vScrollDataIndex = dataIndex;
      // Expose the index into the DOM so that the cache logic can
      // consider them since only the underlying DOM node is cloned by
      // cloneNode().  (vScrollDataIndex is an "expando" property on
      // the JS wrapper on the native DOM object.)
      node.dataset.index = dataIndex;
      this.nodesDataIndices[dataIndex] = nodesIndex;
    },

    _getNodeFromDataIndex: function (dataIndex) {
      let index = this.nodesDataIndices[dataIndex];

      if (index === undefined) {
        index = -1;
      }

      return index === -1 ? null : this.nodes[index];
    },

    captureScreenMetrics: function() {
      if (this._capturedScreenMetrics) {
        return;
      }
      this.innerHeight = this.scrollingContainer.getBoundingClientRect().height;
      if (this.innerHeight > 0) {
        this._capturedScreenMetrics = true;
      }
    },

    /**
     * Handles final initialization, once the VScroll is expected
     * to actually show data.
     *
     * XXX eventually consume 'resize' events.  Right now we are
     * assuming that the email app only supports a single orientation
     * (portrait) and that the only time a resize event will trigger
     * is if the keyboard is shown or hidden.  When used in the
     * message_list's search mode, it explicitly calls _init on us
     * prior to causing the keyboard to be displayed, which currently
     * saves us from getting super confused.
     */
    _init: function() {
      if (this._inited || this._initing) {
        return;
      }
      this._initing = true;

      // Clear out any previous container contents. For example, a
      // cached HTML of a previous card may have been used to init
      // this VScroll instance.
      this.container.innerHTML = '';

      // Get the height of an item node.
      let node = this.template.cloneNode(true);
      this.container.appendChild(node);
      this.itemHeight = node.clientHeight;
      this.container.removeChild(node);

      // Set up all the bounds used in scroll calculations
      this.captureScreenMetrics();

      // The instance is not visible yet, so cannot finish initialization.
      // Wait for the next instance API call to see if initialization can
      // complete.
      if (!this.itemHeight || !this.innerHeight) {
        this._initing = false;
        return;
      }

      this.scrollingContainer.addEventListener('scroll', this.onEvent);

      this.itemsPerScreen = Math.ceil(this.innerHeight / this.itemHeight);
      this.prerenderItemCount =
        Math.ceil(this.itemsPerScreen * this.prerenderScreens);
      this.prefetchItemCount =
        Math.ceil(this.itemsPerScreen * this.prefetchScreens);
      this.recalculatePaddingItemCount =
        Math.ceil(this.itemsPerScreen * this.recalculatePaddingScreens);

      this.nodeCount = this.itemsPerScreen + this.prerenderItemCount +
                       Math.ceil(this.retainExtraRenderedScreens *
                                 this.itemsPerScreen);

      if (this.listNodeCount > this.nodeCount) {
        this.nodeCount = this.listNodeCount;
      }
      // Fill up the pool of nodes to use for data items.
      for (let i = 0; i < this.nodeCount; i++) {
        node = this.template.cloneNode(true);
        node.classList.add(VScroll.nodeClassName);
        setTop(node, (-1 * this.itemHeight));
        this.nodes.push(node);
        this._setNodeDataIndex(i, -1);
      }

      this._calculateTotalHeight();
      this._inited = true;
      this._initing = false;
      this.emit('inited');
    },

    /**
     * Finds the next node in the pool to use in the visible area.
     * Uses a hidden persistent index to provide efficient lookup for
     * repeated calls using the same stratIndex/endIndex as long as
     * there are at least (endIndex - beginIndex + 1) * 2 nodes.
     *
     * @param  {Number} beginIndex the starting data index for the
     * range of already visible data indices. They should be
     * avoided as choices since they are already in visible area.
     * @param  {Number} endIndex the ending data index for the
     * range of already visible data indices.
     * @return {Node} the DOM node that can be used next for display.
     */
    _nextAvailableNode: function(beginIndex, endIndex) {
      let i, node, vScrollDataIndex,
          count = 0;

      // Loop over nodes finding the first one that is out of visible
      // range, making sure to loop back to the beginning of the
      // nodes if cycling over the end of the list.
      for (i = this.nodesIndex + 1; count < this.nodes.length; count++, i++) {
        // Loop back to the beginning if past the end of the nodes.
        if (i > this.nodes.length - 1) {
          i = 0;
        }

        node = this.nodes[i];
        vScrollDataIndex = node.vScrollDataIndex;

        if (vScrollDataIndex < beginIndex || vScrollDataIndex > endIndex) {
          this.nodesIndex = i;
          break;
        }
      }

      return node;
    },

    /**
     * Recalculates the size of the container, and resets the
     * display of items in the container. Maintains the scroll
     * position inside the list.
     * @param {Number} refIndex a reference index that spawned
     * the recalculate. If that index is "above" the targeted
     * computed index found by recalculate, then it means the
     * the absolute scroll position may need to change.
     */
    _recalculate: function(refIndex) {
      if (!this._inited) {
        return;
      }

      let node,
          index = this.indexAtScrollPosition(this.scrollTop),
          remainder = this.scrollTop % this.itemHeight,
          sizeDiff = this.list.size() - this.oldListSize;

      // If this recalculate was spawned from the top and more
      // items, then new messages from the top, and account for
      // them so the scroll position does not jump. Only do this
      // though if old size was not 0, which is common on first
      // folder sync, or if the reference index that spawned the
      // recalculate is "above" the target index, since that
      // means the contents above the target index shifted.
      if (refIndex && refIndex < index && sizeDiff > 0 &&
          this.oldListSize !== 0 && index !== 0) {
        index += sizeDiff;
      }

      console.log('VSCROLL scrollTop: ' + this.scrollTop +
                  ', RECALCULATE: ' + index + ', ' + remainder);

      this._calculateTotalHeight();

      // Now clear the caches from the visible area
      for (let i = 0; i < this.nodeCount; i++) {
        node = this.nodes[i];
        setTop(node, (-1 * this.itemHeight));
        this._setNodeDataIndex(i, -1);
      }
      this.waitingForRecalculate = false;

      this._setContainerScrollTop((this.itemHeight * index) + remainder);
      this.renderCurrentPosition();

      this.emit('recalculated', index === 0, refIndex);
    },

    /**
     * Sets the total height of the container.
     */
    _calculateTotalHeight: function() {
      // Size the scrollable area to the full height if all items
      // were rendered inside of it, so that there is no weird
      // scroll bar grow/shrink effects and so that inertia
      // scrolling is not artificially truncated.
      let newListSize = this.list.size();

      // Do not bother if same size, or if the container was set to 0 height,
      // most likely by a clearDisplay.
      if (this.oldListSize !== newListSize ||
        parseInt(this.container.style.height, 10) === 0) {
        let softkeyHeight =
            document.getElementById('softkeyPanel').clientHeight;
        this.totalHeight = this.itemHeight * newListSize;
        this.container.style.height =
            (this.totalHeight + softkeyHeight) + 'px';
        this.oldListSize = newListSize;
      }
    },

    /**
     * Handles checking for the end of a scroll, based on a time
     * delay since the last scroll event.
     */
    _scrollTimeoutPoll: function() {
      this._scrollStopTimeout = 0;
      if (Date.now() > this._lastEventTime + 30) {
        this.emit('scrollStopped');
      } else {
        this._scrollStopTimeout = setTimeout(this._scrollTimeoutPoll, 30);
      }
    },

    /**
     * Starts checking for the end of scroll events.
     */
    _startScrollStopPolling: function() {
      if (!this._scrollStopTimeout) {
        // "this" binding for _scrollTimeoutPoll done in constructor
        this._scrollStopTimeout = setTimeout(this._scrollTimeoutPoll, 30);
      }
    }
  };

  evt.mix(VScroll.prototype);

  // Override on() to allow for a lazy firing of scrollStopped,
  // particularly when the list is not scrolling, so the stop
  // polling is not currently running. This is useful for "once"
  // listeners that just want to be sure to do work when scroll
  // is not in action.
  let originalOn = VScroll.prototype.on;
  VScroll.prototype.on = function(id, fn) {
    if (id === 'scrollStopped') {
      this._startScrollStopPolling();
    }

    return originalOn.apply(this, slice.call(arguments));
  };

  // Introspection tools --------------------------------------------
  // uncomment this section to use them. Useful for tracing how the
  // code is called.
  /*
  require('debug_trace_methods')(VScroll.prototype, module.id);
  */

  return VScroll;
});



(function(exports) {

  var AccessibilityHelper = {
    /**
     * For a set of tab elements, set aria-selected attribute in accordance with
     * the current selection.
     * @param {Object} selectedTab a tab to select object.
     * @param {Array} tabs an array of tabs.
     */
    setAriaSelected: function ah_setAriaSelected(selectedTab, tabs) {
      // In case tabs is a NodeList, that does not have forEach.
      Array.prototype.forEach.call(tabs, function setAriaSelectedAttr(tab) {
        tab.setAttribute('aria-selected',
          tab === selectedTab ? 'true' : 'false');
      });
    }
  };

  exports.AccessibilityHelper = AccessibilityHelper;

})(window);

define("shared/js/accessibility_helper", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.AccessibilityHelper;
    };
}(this)));



/**
 * Helpers for displaying information about email messages.
 */
define('message_display',['require','l10n!'],function(require) {
  let mozL10n = require('l10n!');

  return {
    /**
     * Format the message subject appropriately.  This means ensuring that
     * if the subject is empty, we use a placeholder string instead.
     *
     * @param {DOMElement} subjectNode the DOM node for the message's
     * subject.
     * @param {Object} message the message object.
     */
    subject: function(subjectNode, message) {
      let subject = message.subject && message.subject.trim();
      if (subject) {
        subjectNode.textContent = subject;
        subjectNode.classList.remove('msg-no-subject');
        subjectNode.removeAttribute('data-l10n-id');
      }
      else {
        mozL10n.setAttributes(subjectNode, 'message-no-subject');
        subjectNode.classList.add('msg-no-subject');
      }
    }
  };
});


define('cards/mixins/data-prop',[],function () {
  return {
    templateInsertedCallback: function () {
      let nodes = this.querySelectorAll('[data-prop]'),
          length = nodes.length;

      for (let i = 0; i < length; i++) {
        this[nodes[i].dataset.prop] = nodes[i];
      }
    }
  };
});


define('cards/mixins/data-event',[],function () {
  let slice = Array.prototype.slice;

  return {
    templateInsertedCallback: function () {
      slice.call(this.querySelectorAll('[data-event]'))
      .forEach((node) => {
        // Value is of type 'name:value,name:value',
        // with the :value part optional.
        node.dataset.event.split(',').forEach((pair) => {
          let evtName, method,
              parts = pair.split(':');

          if (!parts[1]) {
            parts[1] = parts[0];
          }
          evtName = parts[0].trim();
          method = parts[1].trim();

          if (typeof this[method] !== 'function') {
            throw new Error('"' + method + '" is not a function, ' +
                            'cannot bind with data-event');
          }

          node.addEventListener(evtName, (evt) => {
            // Treat these events as private to the
            // custom element.
            return this[method](evt);
          }, false);
        });
      });
    }
  };
});


define('cards/base',['require','l10n!','date','evt','./mixins/data-prop','./mixins/data-event'],function(require) {
  let mozL10n = require('l10n!'),
      date = require('date'),
      Emitter = require('evt').Emitter;

  // Set up the global time updates for all nodes.
  (function() {
    let updatePrettyDate = function updatePrettyDate() {
      let labels = document.querySelectorAll('[data-time]');
      let i = labels.length;
      while (i--) {
        labels[i].textContent = date.prettyDate(
          labels[i].dataset.time,
          // the presence of the attribute is our indicator; not its value
          'compactFormat' in labels[i].dataset,
          'l10nFormat' in labels[i].dataset);
      }
    };
    let timer = setInterval(updatePrettyDate, 60 * 1000);

    function updatePrettyDateOnEvent() {
      clearTimeout(timer);
      updatePrettyDate();
      timer = setInterval(updatePrettyDate, 60 * 1000);
    }
    // When user changes the language, update timestamps.
    mozL10n.ready(updatePrettyDateOnEvent);

    // On visibility change to not hidden, update timestamps
    document.addEventListener('visibilitychange', () => {
      if (document && !document.hidden) {
        updatePrettyDateOnEvent();
      }
    });

  })();


  /**
   * Returns an array of objects that can be fed to the 'element' module to
   * create a prototype for a custom element. It takes an optional
   * `templateMixins` object that is the first object to be mixed in by the
   * "mixins insted of prototypes" construction that 'element' favors. This
   * templateMixins should come first, as it sets up the inner DOM structure
   * for an instance of the element, and needs to have been inserted before the
   * other mixins in this base are applied. The templateMixins are normally
   * passed to this function via a `require('template!...')` dependency. The
   * 'template' loader plugin knows how to set up an object for use in this type
   * of 'element' target. See the README.md in this file's directory for more
   * information on the custom element approach.
   * @param {Object|Array} [templateMixins] Handles the templating duties
   * for the inner HTML structure of the element.
   * @returns {Array} Array of objects for use in a mixin construction.
   */
  return function cardBase(templateMixins) {
    // Set up the base mixin
    return [
      // Mix in the template first, so that its createdCallback is
      // called before the other createdCallbacks, so that the
      // template is there for things like l10n mixing and node
      // binding inside the template.
      templateMixins ? templateMixins : {},

      // Wire up support for auto-node binding
      require('./mixins/data-prop'),
      require('./mixins/data-event'),

      // Every custom element is an evt Emitter!
      Emitter.prototype,

      {
        createdCallback: function() {
          Emitter.call(this);

          // Set up extra classes and other node information that distinguishes
          // as a card. Doing this here so that by the time the createdCallback
          // provided by the card so that the DOM at that point can be used for
          // HTML caching purposes.
          if (this.extraClasses) {
            this.classList.add.apply(this.classList,
                                     this.extraClasses);
          }

          this.classList.add('card');
        },

        batchAddClass: function(searchClass, classToAdd) {
          let nodes = this.getElementsByClassName(searchClass);
          for (let i = 0; i < nodes.length; i++) {
            nodes[i].classList.add(classToAdd);
          }
        },

        /**
         * Add an event listener on a container that, when an event is encounted
         * on a descendant, walks up the tree to find the immediate child of the
         * container and tells us what the click was on.
         */
        bindContainerHandler: function(containerNode, eventName, func) {
          containerNode.addEventListener(eventName, (event) => {
            let node = event.target;
            // bail if they clicked on the container and not a child...
            if (node === containerNode) {
              return;
            }
            while (node && node.parentNode !== containerNode) {
              node = node.parentNode;
            }
            func(node, event);
          }, false);
        }
      }
    ];
  };
});

/**
 * element 0.0.0-native-register
 * Copyright (c) 2013-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/element for details
 */
/*jshint browser: true */
/*globals define */
define('element',[],function() {
  
  var slice = Array.prototype.slice,
      callbackSuffix = 'Callback',
      callbackSuffixLength = callbackSuffix.length,
      charRegExp = /[^a-z]/g;

  /**
   * Converts an attribute like a-long-attr to aLongAttr
   * @param  {String} attrName The attribute name
   * @return {String}
   */
  function makePropName(attrName) {
    var parts = attrName.split('-');
    for (var i = 1; i < parts.length; i++) {
      parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substring(1);
    }
    return parts.join('');
  }

  /**
   * Given an attribute name, set the corresponding property
   * name on the custom element instance, if it has such a
   * property.
   * @param  {Object} instance the custom element instance.
   * @param  {String} attrName the attribute name.
   * @param  {String} attrValue The attribute value.
   */
  function setPropFromAttr(instance, attrName, attrValue) {
    var proto = Object.getPrototypeOf(instance),
        propName = makePropName(attrName),
        descriptor = Object.getOwnPropertyDescriptor(proto, propName);

    // Only check immediate prototype for a property that
    // matches, to avoid calling base setters that may be
    // on original HTML-based element that could cause
    // bad effects. Needs more testing for those cases to
    // confirm, but since element is a mixin approach, this
    // approach is safe.
    if (descriptor && descriptor.set) {
      instance[propName] = attrValue;
    }
  }

  function makePropFn(prop) {
    return function() {
      var i, ret,
          args = slice.call(arguments),
          fns = this._element.props[prop];

      for (i = 0; i < fns.length; i++) {
        ret = fns[i].apply(this, args);
      }

      // Last function wins on the return value.
      return ret;
    };
  }

  function mixFnProp(proto, prop, value, operation) {
    if (proto.hasOwnProperty(prop)) {
      var existing = proto._element.props[prop];
      if (!existing) {
        existing = proto._element.props[prop] = [proto[prop]];
        proto[prop] = makePropFn(prop);
      }
      operation = operation || 'push';
      existing[operation](value);
    } else {
      proto[prop] = value;
    }
  }

  function mix(proto, mixin) {
    // Allow a top level of a mixin to be an array of other
    // mixins.
    if (Array.isArray(mixin)) {
      mixin.forEach(function(mixin) {
        mix(proto, mixin);
      });
      return;
    }

    Object.keys(mixin).forEach(function(key) {
      var suffixIndex,
          descriptor = Object.getOwnPropertyDescriptor(mixin, key);

      // Any property that ends in Callback, like the custom element
      // lifecycle events, can be multiplexed.
      suffixIndex = key.indexOf(callbackSuffix);
      if (suffixIndex > 0 &&
          suffixIndex === key.length - callbackSuffixLength) {
        mixFnProp(proto, key, descriptor.value);
      } else {
        Object.defineProperty(proto, key, descriptor);
      }
    });
  }

  /**
   * Main module export. These methods are visible to
   * any module.
   */
  var element = {
    /**
     * The AMD loader plugin API. Called by an AMD loader
     * to handle 'element!' resources.
     * @param  {String} id     module ID to load.
     * @param  {Function} req  context-specific `require` function.
     * @param  {Function} onload function to call once loading is complete.
     * @param  {Object} config config from the loader. Normally just has
     * config.isBuild if in a build scenario.
     */
    load: function(id, req, onload, config) {
      // Normal dependency request.
      req([id], function(mod) {
        // For builds do nothing else. Also if no module export or
        // it is a function because the module already called
        // document.register itself, then do not bother with the
        // other work.
        if (config.isBuild || !mod || typeof mod === 'function') {
          return onload();
        }

        // Create the prototype for the custom element.
        // Allow the module to be an array of mixins.
        // If it is an array, then mix them all in to the
        // prototype.
        var proto = Object.create(HTMLElement.prototype);

        // Define a property to hold all the element-specific information
        Object.defineProperty(proto, '_element', {
          enumerable: false,
          configurable: false,
          writable: false,
          value: {}
        });
        proto._element.props = {};

        mix(proto, mod);

        // Wire attributes to this element's custom/getter setters.
        // Because of the 'unshift' use, this will actually execute
        // before the templateCreatedCallback, which is good. The
        // exterior API should set up the internal state before
        // other parts of createdCallback run.
        mixFnProp(proto, 'createdCallback', function attrCreated() {
          var i, item,
              attrs = this.attributes;

          for (i = 0; i < attrs.length; i++) {
            item = attrs.item(i);
            setPropFromAttr(this, item.nodeName, item.value);
          }
        }, 'unshift');

        // Listen for attribute changed calls, and just trigger getter/setter
        // calling if matching property. Make sure it is the first one in
        // the listener set.
        mixFnProp(proto, 'attributeChangedCallback',
        function attrChanged(name, oldValue, newValue) {
            // Only called if value has changed, so no need to check
            // oldValue !== newValue
            setPropFromAttr(this, name, newValue);
        }, 'unshift');

        // Translate any characters that are unfit for custom element
        // names to dashes
        id = id.toLowerCase().replace(charRegExp, '-');

        onload(document.registerElement(id, {
          prototype: proto
        }));
      });
    }
  };

  return element;
});

/**
 * template 0.0.0-native-register
 * Copyright (c) 2013-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/element for details
 */
/*jshint browser: true, strict: false */
/*globals define, requirejs */
define('template',['require','exports','module','element'],function(require, exports, module) {
  let template, fetchText, templateDiv,
      isReady = false,
      readyQueue = [],
      tagRegExp = /<(\w+-[\w-]+)(\s|>)/g,
      commentRegExp = /<!--*.?-->/g,
      attrIdRegExp = /\s(hrefid|srcid)="([^"]+)"/g,
      buildProtocol = 'build:',
      moduleConfig = module.config(),
      depPrefix = 'element!',
      buildMap = {},
      tagToId = function(tag) { return tag; };

  // Referencing element module to make sure
  // document.register shim is in place. Over time,
  // as browsers implement it, this require call
  // can be removed.
  require('element');

  if (moduleConfig.hasOwnProperty('depPrefix')) {
    depPrefix = moduleConfig.depPrefix;
  }
  if (moduleConfig.hasOwnProperty('tagToId')) {
    tagToId = moduleConfig.tagToId;
  }

  if (typeof document !== 'undefined') {
    templateDiv = document.createElement('div');
  }

  /**
   * Handles converting <template id="body"> template
   * into a real body content, and calling back
   * template.ready listeners.
   */
  function onReady() {
    isReady = true;

    // The template#body is on purpose. Do not want to get
    // other element that may be #body if the page decides
    // to not use the template tag to avoid FOUC.
    let bodyTemplate = document.querySelector('template#body');

    if (bodyTemplate) {
      bodyTemplate.parentNode.removeChild(bodyTemplate);
      document.body.innerHTML = bodyTemplate.innerHTML;
    }

    readyQueue.forEach((fn) => {
      fn();
    });
    readyQueue = [];
  }

  /**
   * For hrefid and srcid resolution, need full IDs.
   * This method takes care of creating full IDs. It
   * could be improved by removing extraneous ./ and
   * ../ references.
   * @param  {String} id    possible local, relative ID
   * @param  {String} refId ID to use as a basis for the
   * the local ID.
   * @return {String} full ID
   */
  function makeFullId(id, refId) {
    if (id.indexOf('.') === 0 && refId) {
      // Trim off the last segment of the refId, as we want
      // the "directory" level of the ID
      let parts = refId.split('/');
      parts.pop();
      refId = parts.join('/');

      id = (refId ? refId + '/' : '') + id;
    }

    return id;
  }

  /**
   * Supports cached internal nodes if data-cached is set to a truthy
   * value.
   */
  function templateCreatedCallback() {
      if (this.dataset.cached === 'cached' || this.template) {
        if (this.dataset.cached !== 'cached' && this.template) {
          // Clear out previous contents. If they were needed, they
          // would have been consumed by the this.template.fn() call.
          this.innerHTML = '';

          this.appendChild(this.template());
        }

        if (this.templateInsertedCallback) {
          this.templateInsertedCallback();
        }
      }
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    // browser loading
    fetchText = function(url, onload, onerror) {
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url, true);
      xhr.onreadystatechange = function() {
        let status, err;

        if (xhr.readyState === 4) {
          status = xhr.status;
          if (status > 399 && status < 600) {
            //An http 4xx or 5xx error. Signal an error.
            err = new Error(url + ' HTTP status: ' + status);
            err.xhr = xhr;
            onerror(err);
          } else {
            onload(xhr.responseText);
          }
        }
      };
      xhr.responseType = 'text';
      xhr.send(null);
    };
  } else {
    // Likely a build scenario. Cheat a bit and use
    // an r.js helper. This could be modified to support
    // more AMD loader tools though in the future.
    fetchText = function(url, onload) {
      onload(requirejs._readFile(url));
    };
  }

  template = {
    fetchText: fetchText,

    /**
     * Register a function to be run once element dependency
     * tracing and registration has finished.
     * @param  {Function} fn
     */
    ready: function(fn) {
      if (isReady) {
        setTimeout(fn);
      } else {
        readyQueue.push(fn);
      }
    },

    makeFullId: makeFullId,

    /**
     * Makes a template function for use as the template object
     * used in a fully realized custom element.
     * @param  {String} text string of HTML
     * @return {Function} by calling this function, creates a
     * clone of the DocumentFragment from template.
     */
    makeTemplateFn: function(text) {
      return function() {
        let e,
            frag = document.createDocumentFragment();

        // For the security conscious: the contents of `text` comes from the
        // require('template!...') calls that exercises this module's
        // functionality as a loader plugin to load UI fragments from .html
        // files via XHR calls to paths the application can reach, or from a \
        // built resource that was constructed from a similar XHR-type call, but
        // done at application build time. This means that dynamic calls to
        // require('template!...') are the source of risk for injection of
        // hostile HTML.
        templateDiv.innerHTML = text;

        while ((e = templateDiv.firstChild)) {
          frag.appendChild(e);
        }
        return frag;
      };
    },

    /**
     * Replaces hrefid and srcid with href and src, using
     * require.toUrl(id) to convert the IDs to paths.
     * @param  {String} text  string of HTML
     * @param  {String} refId the reference module ID to use,
     * which is normallly the module ID associated with the
     * HTML string given as input.
     * @return {String} converted HTML string.
     */
    idsToUrls: function(text, refId) {
      text = text
              .replace(attrIdRegExp, function(match, type, id) {
                id = makeFullId(id, refId);
                let attr = type === 'hrefid' ? 'href' : 'src';

                return ' ' + attr + '="' + require.toUrl(id) + '"';
              });
      return text;
    },

    /**
     * Gives and array of 'element!'-based module IDs for
     * any custom elements found in the string of HTML.
     * So if the HTML has <some-thing> in it, the returned
     * dependency array will have 'element!some-thing' in it.
     * @param  {String} text string of HTML
     * @return {Array} array of dependencies. Could be zero
     * length if no dependencies found.
     */
    depsFromText: function(text) {
      let match, noCommentText,
          deps = [];

      // Remove comments so only legit tags are found
      noCommentText = text.replace(commentRegExp, '');

      tagRegExp.lastIndex = 0;
      while ((match = tagRegExp.exec(noCommentText))) {
        deps.push(depPrefix + tagToId(match[1]));
      }

      return deps;
    },

    /**
     * Converts a string of HTML into a full template
     * object that is used for a custom element's
     * prototype `template` property.
     * @param  {String} text string of HTML
     * @param  {String} id module ID for the custom
     * element associated with this template.
     * @param  {Boolean} skipTranslateIds for build
     * concerns, want to avoid the work that translate
     * IDs until runtime, when more state is known
     * about final path information. If that is the
     * case, then pass true for this value.
     * @return {Object} template object.
     */
    textToTemplate: function(text, id, skipTranslateIds) {
      let obj,
          deps = template.depsFromText(text);

      obj = {
        id: id,
        deps: deps,
        text: text
      };

      if (!skipTranslateIds) {
        obj.text = template.idsToUrls(text, id);
        // Cannot reliably create the template function
        // until IDs are translated, so wait on that
        // step until later.
        obj.fn = template.makeTemplateFn(obj.text);
      }

      return obj;
    },

    /**
     * Turns a template object, created via build, into
     * a template function.
     * @param  {Object} obj the object created by a build.
     * @return {Function}   a function to call to get a
     * DOM object for insertion into the document.
     */
    objToFn: function(obj) {
      let text = template.idsToUrls(obj.text, obj.id);
      return template.makeTemplateFn(text);
    },

    templateCreatedCallback: templateCreatedCallback,

    /**
     * AMD loader plugin API. Loads the resource. Called by an
     * AMD loader.
     * @param  {String} id     resource ID to load.
     * @param  {Function} req    context-specific `require` function.
     * @param  {Function} onload called when loading is complete.
     * @param  {Object} config config object, normally just has
     * config.isBuild to indicate build scenario.
     */
    load: function(id, req, onload, config) {
      let isBuild = config.isBuild;

      // If a build directive, load those files and scan
      // for dependencies, loading them all.
      if (id.indexOf(buildProtocol) === 0 && isBuild) {
        id = id.substring(buildProtocol.length);

        let idList = id.split(','),
            count = 0,
            buildIdDone = function() {
              count += 1;
              if (count === idList.length) {
                onload();
              }
            };

        // Set buildIdDone as executable by the build
        buildIdDone.__requireJsBuild = true;

        // Allow for multiple files separated by commas
        id.split(',').forEach((moduleId) => {
          let path = req.toUrl(moduleId);

          // Leverage r.js optimizer special method for reading
          // files synchronously.
          require(template.depsFromText(requirejs._readFile(path)),
                  buildIdDone);
        });
      } else {
        fetchText(req.toUrl(id), (text) => {
          let templateObj = template.textToTemplate(text, id, isBuild);

          req(templateObj.deps, () => {
            if (isBuild) {
              buildMap[id] = templateObj;
            }
            onload({
              createdCallback: templateCreatedCallback,
              template: templateObj.fn
            });
          });
        }, onload.error);
      }
    },

    /**
     * AMD loader plugin API. Called by a build tool, to give
     * this plugin the opportunity to write a resource to
     * a build file.
     * @param  {String} pluginName ID of this module, according
     * to what the loader thinks the ID is.
     * @param  {String} id         resource ID handled by plugin.
     * @param  {Function} write      Used to write output to build file.
     */
    write: function(pluginName, id, write) {
      if (buildMap.hasOwnProperty(id)) {
        let obj = buildMap[id],
            depString = JSON.stringify(obj.deps);

        depString = depString.replace(/^\s*\[/, '').replace(/\]\s*$/, '')
                             .trim();
        if (depString) {
          depString = ', ' + depString;
        }

        write.asModule(pluginName + '!' + id,
          'define([\'' + module.id + '\'' + depString +
          '], function(template) { return {\n' +
          'createdCallback: template.templateCreatedCallback,\n' +
          'template: template.objToFn(' + JSON.stringify(buildMap[id]) +
          ')}; });\n');
      }
    }
  };

  if (typeof document !== 'undefined') {
    // This section wires up processing of the initial document DOM.
    // In a real document.register browser, this would not be possible
    // to do, as document.register would grab all the tags before this
    // would likely run. Also, onDomDone just a hack related to
    // DOMContentLoaded not firing.
    let onDom, onDomDone = false;
    onDom = function() {
      if (onDomDone) {
        return;
      }
      onDomDone = true;

      // Collect all the tags already in the DOM
      let converted = template.textToTemplate(document.body.innerHTML);

      require(converted.deps, onReady);
    };


    if (document.readyState === 'interactive' ||
        document.readyState === 'complete') {
      onDom();
    } else {
      window.addEventListener('DOMContentLoaded', onDom);
    }
  }

  return template;
});

define('template!cards/message_list.html',['template'], function(template) { return {
createdCallback: template.templateCreatedCallback,
template: template.objToFn({"id":"cards/message_list.html","deps":[],"text":"<!-- Non-search header -->\n<section data-prop=\"normalHeader\"\n         class=\"msg-list-header msg-nonsearch-only\"\n         data-statuscolor=\"default\"\n         role=\"region\">\n  <header>\n    <h1 id=\"folder-header\" data-prop=\"folderLabel\"\n        class=\"msg-list-header-folder-label header-label\">\n      <div class=\"msg-list-header-folder-info\">\n        <span data-prop=\"folderNameNode\"\n            dir=\"auto\"\n            class=\"msg-list-header-folder-name\"></span>\n        <span data-prop=\"folderUnread\"\n            class=\"msg-list-header-folder-unread collapsed\"></span>\n      </div>\n    </h1>\n    <h2 class=\"msg-list-header-sync-label\" data-prop=\"headerSyncLabel\">\n      <div class=\"msg-last-synced-header\">\n        <span data-prop=\"lastSyncedLabel\"\n              class=\"msg-last-synced-label p-sec\"\n              data-l10n-id=\"folder-last-synced-label\"></span>\n        <span data-prop=\"lastSyncedAtNode\"\n              class=\"msg-last-synced-value p-sec\"></span>\n      </div>\n      <span class=\"msg-synchronizing-label\" data-l10n-id=\"synchronizing\">Synchronizing...</span>\n      <span class=\"msg-outbox-unsent-label collapsed\" data-prop=\"msgUnsentLabel\"></span>\n      <span class=\"msg-never-sync-label collapsed\"\n            data-prop=\"msgNeverSync\"\n            data-l10n-id=\"never-sync\">Never sync</span>\n    </h2>\n  </header>\n</section>\n<!-- Multi-edit state header -->\n<section data-prop=\"editHeader\"\n         class=\"msg-listedit-header collapsed\" role=\"region\">\n  <header>\n    <h1 class=\"msg-listedit-header-label\">\n      <div class=\"msg-listedit-header-info\">\n        <span class=\"msg-list-edit-header-name\"\n              data-prop=\"editHeaderNode\"></span>\n      </div>\n    </h1>\n    <h2 data-prop=\"headerNode\" class=\"msg-listedit-selected-label\"></h2>\n  </header>\n</section>\n<!-- Search header -->\n<section role=\"region\" data-prop=\"searchHeader\"\n         class=\"msg-search-header msg-search-only\">\n  <header>\n    <h1 class=\"cmp-compose-header-label search-title\"\n        data-prop=\"searchTitle\"\n        data-l10n-id=\"message-search-header\">\n    </h1>\n  </header>\n  <ul class=\"filter-container\">\n    <li data-prop=\"filterType\" class=\"filter-selector focusable\" role=\"option\"></li>\n  </ul>\n  <li class=\"search-input-li focusable\" data-prop=\"searchInputLi\">\n    <input data-prop=\"searchInput\" data-event=\"input:onSearchTextChange\"\n           type=\"text\" required=\"required\" class=\"msg-search-text\"\n           autocorrect=\"off\"\n           inputmode=\"verbatim\"\n           x-inputmode=\"verbatim\"\n           maxlength=\"100\"\n           dir=\"auto\"\n           data-l10n-id=\"message-search-input\" />\n  </li>\n  <header>\n    <h2 class=\"cmp-compose-header-label search-result collapsed\"\n        data-prop=\"searchResult\"></h2>\n  </header>\n  <!-- Search filter switcher -->\n  <header class=\"msg-search-controls-bar collapsed\">\n    <ul role=\"tablist\" class=\"bb-tablist filter\" data-type=\"filter\">\n      <li role=\"presentation\" class=\"msg-search-from msg-search-filter\"\n          data-filter=\"author\" data-filter-name=\"search-author\">\n        <a data-l10n-id=\"message-search-from\" role=\"tab\"\n          aria-selected=\"false\"></a></li>\n      <li role=\"presentation\" class=\"msg-search-to msg-search-filter\"\n          data-filter=\"recipients\" data-filter-name=\"search-to\">\n        <a data-l10n-id=\"message-search-to\" role=\"tab\"\n          aria-selected=\"false\"></a></li>\n      <li role=\"presentation\" class=\"msg-search-subject msg-search-filter\"\n           data-filter=\"subject\" data-filter-name=\"search-subject\">\n        <a data-l10n-id=\"message-search-subject\" role=\"tab\"\n          aria-selected=\"false\"></a>\n      </li>\n      <li role=\"presentation\" class=\"msg-search-body msg-search-filter\"\n           data-filter=\"body\" data-filter-name=\"search-body\">\n        <a data-l10n-id=\"message-search-body\" role=\"tab\"\n          aria-selected=\"false\"></a></li>\n      <li role=\"presentation\" class=\"msg-search-body msg-search-filter\"\n          data-filter=\"all\" data-filter-name=\"search-all\">\n        <a data-l10n-id=\"message-search-all\" role=\"tab\"\n          aria-selected=\"true\"></a></li>\n    </ul>\n  </header>\n</section>\n<!-- Scroll region -->\n<div data-prop=\"scrollContainer\" class=\"msg-list-scrollouter\">\n  <!-- exists so we can force a minimum height -->\n  <div class=\"msg-list-scrollinner\">\n    <!-- The search textbox hides under the lip of the messages.\n         As soon as any typing happens in it, we push the search\n         controls card. -->\n    <form role=\"search\" data-prop=\"searchBar\"\n          class=\"msg-search-tease-bar msg-nonsearch-only\">\n      <p>\n        <input data-event=\"focus:onSearchButton\"\n               class=\"msg-search-text-tease\" type=\"text\"\n               dir=\"auto\"\n               maxlength=\"100\"\n               data-l10n-id=\"message-search-input\" />\n      </p>\n    </form>\n    <div data-prop=\"messagesContainer\" class=\"msg-messages-container\"\n         role=\"listbox\" aria-multiselectable=\"true\">\n    </div>\n    <!-- maintain vertical space for the syncing/sync more div's\n         regardless of their displayed status so we don't scroll them\n         out of the way -->\n    <div data-prop=\"syncContainer\" class=\"msg-messages-sync-container\">\n      <p data-prop=\"syncingNode\" class=\"msg-messages-syncing collapsed\"\n         role=\"progressbar\" data-l10n-id=\"messages-syncing-progressbar\">\n        <span data-l10n-id=\"messages-syncing\"></span>\n      </p>\n      <p data-prop=\"syncMoreNode\" data-index=\"0\"\n         data-event=\"click:onGetMoreMessages\"\n         class=\"msg-header-item msg-messages-sync-more\"\n         role=\"button\">\n        <span data-l10n-id=\"messages-load-more\"></span>\n      </p>\n    </div>\n\n    <div data-nav-id=\"jumpToHead\" style=\"display: none\"></div>\n    <div data-nav-id=\"jumpToTail\" style=\"display: none\"></div>\n  </div>\n</div>\n<!-- New email notification bar -->\n<div class=\"message-list-topbar\"></div>\n<!-- Conveys background send, plus undo-able recent actions -->\n<div class=\"msg-activity-infobar hidden\">\n</div>\n\n<div data-prop=\"messageEmptyContainer\"\n     class=\"msg-list-empty-container collapsed\">\n  <p data-prop=\"messageEmptyText\"\n     class=\"msg-list-empty-message-text\"\n     data-l10n-id=\"messages-folder-empty\" tabindex=\"-1\"></p>\n</div>\n"})}; });

/*jshint browser: true */
/*global define, console, FontSizeUtils, requestAnimationFrame */


define('cards/message_list',['require','exports','module','tmpl!./msg/header_item.html','cards','date','evt','toaster','model','header_cursor','html_cache','l10n!','vscroll','shared/js/accessibility_helper','message_display','./base','template!./message_list.html'],function(require, exports, module) {

let msgHeaderItemNode = require('tmpl!./msg/header_item.html'),
    cards = require('cards'),
    date = require('date'),
    evt = require('evt'),
    toaster = require('toaster'),
    model = require('model'),
    headerCursor = require('header_cursor').cursor,
    htmlCache = require('html_cache'),
    mozL10n = require('l10n!'),
    VScroll = require('vscroll'),
    accessibilityHelper = require('shared/js/accessibility_helper'),
    messageDisplay = require('message_display');


let MATCHED_TEXT_CLASS = 'highlight';

function appendMatchItemTo(matchItem, node) {
  let text = matchItem.text;
  let idx = 0;
  for (let iRun = 0; iRun <= matchItem.matchRuns.length; iRun++) {
    let run;
    if (iRun === matchItem.matchRuns.length) {
      run = { start: text.length, length: 0 };
    } else {
      run = matchItem.matchRuns[iRun];
    }

    // generate the un-highlighted span
    if (run.start > idx) {
      let tnode = document.createTextNode(text.substring(idx, run.start));
      node.appendChild(tnode);
    }

    if (!run.length) {
      continue;
    }
    let hspan = document.createElement('span');
    hspan.classList.add(MATCHED_TEXT_CLASS);
    hspan.textContent = text.substr(run.start, run.length);
    node.appendChild(hspan);
    idx = run.start + run.length;
  }
}

// Default data used for the VScroll component, when data is not
// loaded yet for display in the virtual scroll listing.
let defaultVScrollData = {
  'isPlaceholderData': true,
  'id': 'INVALID',
  'author': {
    'name': '\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583',
    'address': '',
    'contactId': null
  },
  'to': [
    {
      'name': ' ',
      'address': ' ',
      'contactId': null
    }
  ],
  'cc': null,
  'bcc': null,
  'date': '0',
  'hasAttachments': false,
  'snippet': '\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583' +
             '\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583' +
             '\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583',
  'isRead': true,
  'isStarred': false,
  'sendStatus': {},
  'subject': '\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583' +
             '\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583' +
             '\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583'
};

// We will display this loading data for any messages we are
// pretending exist so that the UI has a reason to poke the search
// slice to do more work.
let defaultSearchVScrollData = {
  header: defaultVScrollData,
  matches: []
};

/**
 * Minimum number of items there must be in the message slice
 * for us to attempt to limit the selection of snippets to fetch.
 */
let MINIMUM_ITEMS_FOR_SCROLL_CALC = 10;

/**
 * Maximum amount of time between issuing snippet requests.
 */
let MAXIMUM_MS_BETWEEN_SNIPPET_REQUEST = 6000;

/**
 * Fetch up to 4kb while scrolling
 */
let MAXIMUM_BYTES_PER_MESSAGE_DURING_SCROLL = 4 * 1024;
/**
 * List messages for listing the contents of folders ('nonsearch' mode) and
 * searches ('search' mode).  Multi-editing is just a state of the card.
 *
 * Nonsearch and search modes exist together in the same card because so much
 * of what they do is the same.  We have the cards differ by marking nodes that
 * are not shared with 'msg-nonsearch-only' or 'msg-search-only'.  We add the
 * collapsed class to all of the nodes that are not applicable for a node at
 * startup.
 *
 * == Cache behavior ==
 *
 * This is a card that can be instantiated using the cached HTML stored by the
 * html_cache. As such, it is constructed to allow clicks on message list items
 * before the back end has loaded up, and to know how to refresh the cached
 * state by looking at the use the usingCachedNode property. It also prevents
 * clicks from button actions that need back end data to complete if the click
 * would result in a card that cannot also handle delayed back end startup.
 * It tracks if the back end has started up by checking curFolder, which is
 * set to a data object sent from the back end.
 *
 * == Less-than-infinite scrolling ==
 *
 * A dream UI would be to let the user smoothly scroll through all of the
 * messages in a folder, syncing them from the server as-needed.  The limits
 * on this are 1) bandwidth cost, and 2) storage limitations.
 *
 * Our sync costs are A) initial sync of a time range, and B) update sync of a
 * time range.  #A is sufficiently expensive that it makes sense to prompt the
 * user when we are going to sync further into a time range.  #B is cheap
 * enough and having already synced the time range suggests sufficient user
 * interest.
 *
 * So the way our UI works is that we do an infinite-scroll-type thing for
 * messages that we already know about.  If we are on metered bandwidth, then
 * we require the user to click a button in the display list to sync more
 * messages.  If we are on unmetered bandwidth, we will eventually forego that.
 * (For testing purposes right now, we want to pretend everything is metered.)
 * We might still want to display a button at some storage threshold level,
 * like if the folder is already using a lot of space.
 *
 * See `onScroll` for more details.
 *
 * XXX this class wants to be cleaned up, badly.  A lot of this may want to
 * happen via pushing more of the hiding/showing logic out onto CSS, taking
 * care to use efficient selectors.
 *
 */

let searchIndex = 4; //default search view is all

const QUERY_CHILD = '.msg-header-item:not([data-index="-1"])';

return [
  require('./base')(require('template!./message_list.html')),
  {
    createdCallback: function() {
      let mode = this.mode;

      if (mode === 'nonsearch') {
        this.batchAddClass('msg-search-only', 'collapsed');
      } else {
        this.batchAddClass('msg-nonsearch-only', 'collapsed');
        // Favor the use of the card background color for the status bar instead
        // of the default color.
        this.dataset.statuscolor = 'background';
      }

      this.bindContainerHandler(this.messagesContainer, 'click',
                                this.onClickMessage.bind(this));
      // Syncing display
      this.setRefreshState(true);

      // -- search mode
      if (mode === 'search') {
        this.bindContainerHandler(
          this.querySelector('.filter'),
          'click', this.onSearchFilterClick.bind(this));
        this.searchFilterTabs = this.querySelectorAll('.filter [role="tab"]');
      }

      this.editMode = false;
      this.selectedMessages = null;
      this.isFirstTimeVisible = true;

      this.curFolder = null;
      this.isIncomingFolder = true;
      this._emittedContentEvents = false;

      this.usingCachedNode = this.dataset.cached === 'cached';
      this.composeSendType = null;

      // use for multi select page options
      this.setReadBoth = false;
      this.setFlagBoth = false;
      this.setAllAsStarred = false;
      this.setAllAsRead = false;

      this.action = null;

      // Set up the list data source for VScroll
      let listFunc = ((index) => {
         return headerCursor.messagesSlice.items[index];
      });

      listFunc.size = () => {
        // This method could get called during VScroll updates triggered
        // by messages_splice. However at that point, the headerCount may
        // not be correct, like when fetching more messages from the
        // server. So approximate by using the size of slice.items.
        let slice = headerCursor.messagesSlice;
        // coerce headerCount to 0 if it was undefined to avoid a NaN
        return Math.max(slice.headerCount || 0, slice.items.length);
      };
      this.listFunc = listFunc;

      // We need to wait for the slice to complete before we can issue any
      // sensible growth requests.
      this.waitingOnChunk = true;
      this.desiredHighAbsoluteIndex = 0;
      this._needVScrollData = false;
      this.vScroll = new VScroll(
        this.messagesContainer,
        this.scrollContainer,
        msgHeaderItemNode,
        (this.mode === 'nonsearch' ?
                       defaultVScrollData : defaultSearchVScrollData)
      );

      // Called by VScroll wants to bind some data to a node it wants to
      // display in the DOM.
      if (this.mode === 'nonsearch') {
        this.vScroll.bindData = (model, node) => {
          if (this.mode === headerCursor.searchMode) {
            model.element = node;
            node.message = model;
            this.updateMessageDom(true, model);
          }
        };
      } else {
        this.vScroll.bindData = (model, node) => {
          if (this.mode === headerCursor.searchMode) {
            model.element = node;
            node.message = model.header;
            this.updateMatchedMessageDom(true, model);
          }
        };
      }

      // Called by VScroll when it detects it will need more data in the near
      // future. VScroll does not know if it already asked for this information,
      // so this function needs to be sure it actually needs to ask for more
      // from the back end.
      this.vScroll.prepareData = (highAbsoluteIndex) => {
        let items = headerCursor.messagesSlice &&
                    headerCursor.messagesSlice.items,
            headerCount = headerCursor.messagesSlice.headerCount;

        if (!items || !headerCount) {
          return;
        }

        // Make sure total amount stays within possible range.
        if (highAbsoluteIndex > headerCount - 1) {
          highAbsoluteIndex = headerCount - 1;
        }

        // We're already prepared if the slice is already that big.
        if (highAbsoluteIndex < items.length) {
          return;
        }

        this.loadNextChunk(highAbsoluteIndex);
      };

      this._hideSearchBoxByScrolling =
        this._hideSearchBoxByScrolling.bind(this);
      this._onVScrollStopped = this._onVScrollStopped.bind(this);

      // Event listeners for VScroll events.
      this.vScroll.on('inited', this._hideSearchBoxByScrolling);
      this.vScroll.on('dataChanged', this._hideSearchBoxByScrolling);
      this.vScroll.on('scrollStopped', this._onVScrollStopped);
      this.vScroll.on('recalculated', (calledFromTop) => {
        if (calledFromTop) {
          this._hideSearchBoxByScrolling();
        }
      });

      // Binding "this" to some functions as they are used for
      // event listeners.
      this._folderChanged = this._folderChanged.bind(this);
      this.onNewMail = this.onNewMail.bind(this);
      this.onFoldersSliceChange = this.onFoldersSliceChange.bind(this);
      this.messages_splice = this.messages_splice.bind(this);
      this.messages_change = this.messages_change.bind(this);
      this.messages_status = this.messages_status.bind(this);
      this.messages_complete = this.messages_complete.bind(this);
      this.onBackgroundSendStatus = this.onBackgroundSendStatus.bind(this);

      model.latest('folder', this._folderChanged);
      model.on('newInboxMessages', this.onNewMail);
      model.on('backgroundSendStatus', this.onBackgroundSendStatus);

      model.on('foldersSliceOnChange', this.onFoldersSliceChange);

      this.sliceEvents.forEach((type) => {
        let name = 'messages_' + type;
        headerCursor.on(name, this[name]);
      });

      this.onCurrentMessage = this.onCurrentMessage.bind(this);
      headerCursor.on('currentMessage', this.onCurrentMessage);

      this.onMessageSorted = this.onMessageSorted.bind(this);
      headerCursor.on('messageSorted', this.onMessageSorted);

      // If this card is created after header_cursor is set up
      // with a messagesSlice, then need to bootstrap this card
      // to catch up, since the normal events will not fire.
      // Common scenarios for this case are: going back to the
      // message list after reading a message from a notification,
      // or from a compose triggered from an activity. However,
      // only do this if there is a current folder. A case
      // where there is not a folder: after deleting an account,
      // and the UI is bootstrapping back to existing account.
      // Also, search pushes a new message_list card, but search
      // needs a special slice, created only when the search
      // actually starts. So do not bootstrap in that case.
      if (this.curFolder && this.mode === 'nonsearch') {
        let items = headerCursor.messagesSlice &&
                    headerCursor.messagesSlice.items;
        if (items && items.length) {
          this.messages_splice(0, 0, items);
          this.messages_complete(0);
        }
      }
      this.isShowEmpty = false;
    },

    // Hack to get separate modules for search vs non-search, but
    // eventually the search branches in this file should be moved
    // to message_list_search
    mode: 'nonsearch',

    /**
     * Cache the distance between messages since rows are effectively fixed
     * height.
     */
    _distanceBetweenMessages: 0,

    sliceEvents: ['splice', 'change', 'status', 'complete'],

    /**
     * Inform Cards to not emit startup content events, this card will trigger
     * them once data from back end has been received and the DOM is up to date
     * with that data.
     * @type {Boolean}
     */
    skipEmitContentEvents: true,

    postInsert: function() {
      this._hideSearchBoxByScrolling();

      // Now that _hideSearchBoxByScrolling has activated the display
      // of the search box, get the height of the search box and tell
      // vScroll about it, but only do this once the DOM is displayed
      // so the ClientRect gives an actual height.
      this.vScroll.visibleOffset =
        this.searchBar.getBoundingClientRect().height;

      // For search we want to make sure that we capture the screen size prior
      // to focusing the input since the FxOS keyboard will resize our window to
      // be smaller which messes up our logic a bit.  We trigger metric
      // gathering in non-search cases too for consistency.
      this.vScroll.captureScreenMetrics();
    },

    onSearchButton: function() {
      // Do not bother if there is no current folder.
      if (!this.curFolder) {
        return;
      }

      cards.pushCard(
        'message_list_search', 'animate',
        {
          folder: this.curFolder
        });
    },

    setEditMode: function(editMode) {
      // Do not bother if this is triggered before
      // a folder has loaded.
      if (!this.curFolder) {
        return;
      }

      if (this.curFolder.type === 'outbox') {
        // You cannot edit the outbox messages if the outbox is syncing.
        if (editMode && this.outboxSyncInProgress) {
          return;
        }

        if (!model.account.enabled) {
          model.account.clearProblems();
        }
        // set this to add delay to avoid lost focus if fast clicks
        NavigationMap.needDelayToFocus = true;
        // Outbox Sync and Edit Mode are mutually exclusive. Disable
        // outbox syncing before allowing us to enter edit mode, and
        // vice versa. The callback shouldn't take long, but we wait to
        // trigger edit mode until outbox sync has been fully disabled,
        // to prevent ugly theoretical race conditions.
        if (!editMode) {
          this._setEditMode(editMode);
          model.api.setOutboxSyncEnabled(model.account, !editMode, () => {});
        } else {
          model.api.setOutboxSyncEnabled(model.account, !editMode, () => {
            this._setEditMode(editMode);
          });
        }
      } else {
        this._setEditMode(editMode);
      }
    },

    // This function is called from setEditMode() after ensuring that
    // the backend is in a state where we can safely use edit mode.
    _setEditMode: function(editMode) {
      let i;

      this.editMode = editMode;
      if (this.mode !== 'search') {
        this.updateScrollContainer();
      }

      // XXX the manual DOM play here is now a bit overkill; we should very
      // probably switch top having the CSS do this for us or at least invest
      // some time in cleanup.
      if (editMode) {
        if (this.mode === 'nonsearch') {
          this.searchHeader.classList.add('collapsed');
          this.editHeader.classList.remove('collapsed');
        }
        this.normalHeader.classList.add('collapsed');
        this.messagesContainer.classList.add('show-edit');

        this.selectedMessages = [];
        this.selectedMessagesUpdated();
      } else {
        if (this.mode === 'nonsearch') {
          this.normalHeader.classList.remove('collapsed');
        } else {
          mozL10n.setAttributes(this.searchTitle, 'message-search-header');
          this.searchHeader.classList.remove('collapsed');
        }
        this.editHeader.classList.add('collapsed');
        this.messagesContainer.classList.remove('show-edit');

        let item = NavigationMap.getCurrentItem();
        if (item && item.message) {
          this.selectedMessages = [item.message];
        }
        this.selectedMessagesUpdated();
      }

      // Reset checked mode for all message items.
      let msgNodes = this.messagesContainer.querySelectorAll(
        '.msg-header-item');
      for (i = 0; i < msgNodes.length; i++) {
        this.setMessageChecked(msgNodes[i], false);
      }

      // UXXX do we want to disable the buttons if nothing is selected?
    },

    // Event handler wired up in HTML template
    setEditModeStart: function() {
      this.setEditMode(true);
    },

    // Event handler wired up in HTML template
    setEditModeDone: function() {
      this.setEditMode(false);
    },

    /**
     * Update the edit mode UI bits sensitive to a change in the set of selected
     * messages.  This means the label that says how many messages are selected,
     * whether the buttons are enabled, which of the toggle-pairs are visible.
     */
    selectedMessagesUpdated: function() {
      this.headerNode.classList.add('collapsed');
      if (this.editMode) {
        if (this.mode === 'search') {
          mozL10n.setAttributes(this.searchTitle,
                                'message-multiedit-search-header',
                                { n: this.selectedMessages.length });
        } else {
          mozL10n.setAttributes(this.editHeaderNode,
                                'message-multiedit-header',
                                { n: this.selectedMessages.length });
        }
      }

      let hasMessages = !!this.selectedMessages.length;

      // Enabling/disabling rules (not UX-signed-off):  Our bias is that people
      // want to star messages and mark messages unread (since it they naturally
      // end up unread), so unless messages are all in this state, we assume
      // that is the desired action.
      let numStarred = 0, numRead = 0;
      for (let i = 0; i < this.selectedMessages.length; i++) {
        let msg = this.selectedMessages[i];
        if (msg.isStarred) {
          numStarred++;
        }
        if (msg.isRead) {
          numRead++;
        }
      }

      // Unstar if everything is starred, otherwise star
      this.setAsStarred = !(numStarred && numStarred ===
                            this.selectedMessages.length);

      // Mark read if everything is unread, otherwise unread
      this.setAsRead = (hasMessages && numRead === 0);

      this.optMarkRead.l10nId =
          this.setAsRead ? 'opt-mark-read' : 'opt-mark-unread';
      this.optAddFlag.l10nId =
          this.setAsStarred ? 'opt-add-flag' : 'opt-remove-flag';

      this.setFlagBoth = (numStarred > 0 &&
                          numStarred < this.selectedMessages.length);
      if (!this.setFlagBoth) {
        this.setAllAsStarred = (numStarred === 0);
      }
      this.setReadBoth = (numRead > 0 &&
                          numRead < this.selectedMessages.length);
      if (!this.setReadBoth) {
        this.setAllAsRead = (numRead === 0);
      }

      if (this.editMode) {
        let focused = document.querySelector('.focus');
        if (focused && focused.message) {
          let checkBox = focused.children[0].children[0];
          if (checkBox && checkBox.checked) {
            this.optionCsk = this.optionDeselect;
          } else {
            this.optionCsk = this.optionSelect;
          }
        }
      }

      this.setSoftkeyBar();
    },

    _hideSearchBoxByScrolling: function() {
      // scroll the search bit out of the way
      let searchBar = this.searchBar,
          scrollContainer = this.scrollContainer;

      // Search bar could have been collapsed with a cache load,
      // make sure it is visible, but if so, adjust the scroll
      // position in case the user has scrolled before this code
      // runs.
      if (searchBar.classList.contains('collapsed')) {
        searchBar.classList.remove('collapsed');
        scrollContainer.scrollTop += searchBar.offsetHeight;
      }

      // Adjust scroll position now that there is something new in
      // the scroll region, but only if at the top. Otherwise, the
      // user's purpose scroll positioning may be disrupted.
      //
      // Note that when we call this.vScroll.clearDisplay() we
      // inherently scroll back up to the top, so this check is still
      // okay even when switching folders.  (We do not want to start
      // index 50 in our new folder because we were at index 50 in our
      // old folder.)
      if (scrollContainer.scrollTop === 0) {
        scrollContainer.scrollTop = searchBar.offsetHeight;
      }
    },

    onShowFolders: function() {
      window.backToShowFolder = false;
      cards.pushCard('folder_picker', 'animate');
    },

    onCompose: function() {
      cards.pushCard('compose', 'animate');
    },

    updateScrollContainer : function() {
      setTimeout(() => {
        let headerHeight;
        let focused = document.querySelector('.focus');
        if (this.editMode) {
          headerHeight = this.headerNode.clientHeight;
        } else {
          headerHeight = this.headerSyncLabel.clientHeight;
        }
        this.scrollContainer.style.height =
            'calc(100% - var(--statusbar-softkeybar-height)' +
            ' - var(--header-height) - ' + headerHeight + 'px' + ')';
        this.vScroll.updateDataBind(0, [], 0);
        NavigationMap.cardContentHeight = this.scrollContainer.clientHeight;
        if (focused && !NavigationMap.isVisible(focused)) {
          focused.scrollIntoView(false);
        }
      });
    },

    updateLastSynced: function(value) {
      if (this.mode === 'search') {
        return;
      }

      if (this.folder.type !== 'localdrafts') {
        this.msgNeverSync.classList.add('collapsed');
        let outboxFolder =
            model.foldersSlice.getFirstFolderWithType('outbox');
        let num = outboxFolder.unread;
        if (this.folder.type === 'inbox' && num > 0) {
          this.msgUnsentLabel.classList.remove('collapsed');
          mozL10n.setAttributes(this.msgUnsentLabel,
              'outbox-unsent-label', { n: num });
        } else {
          this.msgUnsentLabel.classList.add('collapsed');
        }
      } else {
        this.msgUnsentLabel.classList.add('collapsed');
        this.msgNeverSync.classList.remove('collapsed');
        value = null;
      }

      let method = value ? 'remove' : 'add';
      this.lastSyncedLabel.classList[method]('collapsed');
      date.setPrettyNodeDate(this.lastSyncedAtNode, value);
      this.updateScrollContainer();
    },

    updateUnread: function(num) {
      let content = '';
      if (num > 0) {
        content = num > 999 ? mozL10n.get('messages-folder-unread-max') : num;
      }

      this.folderUnread.textContent = '(' + content +')';
      this.folderUnread.classList.toggle('collapsed', !content);
      this.folderNameNode.style.setProperty('margin-right',
          content ? 'unset' : 'auto');
      this.callHeaderFontSize();
    },

    onFoldersSliceChange: function(folder) {
      if (folder === this.curFolder) {
        this.updateUnread(folder.unread);
        this.updateLastSynced(folder.lastSyncedAt);
      } else if (folder.type === 'outbox' &&
          this.curFolder.type === 'inbox') {
        this.updateUnread(this.curFolder.unread);
        this.updateLastSynced(this.curFolder.lastSyncedAt);
      }
    },

    /**
     * A workaround for shared/js/font_size_utils not recognizing child node
     * content changing, and if it did, it would be noisy/extra work if done
     * generically. Using a rAF call to not slow down the rest of card updates,
     * it is something that can happen lazily on another turn.
     */
    callHeaderFontSize: function(node) {
      requestAnimationFrame(() => {
        FontSizeUtils._reformatHeaderText(this.folderLabel);
      });
    },

    /**
     * Show a folder, returning true if we actually changed folders or false if
     * we did nothing because we were already in the folder.
     */
    showFolder: function(folder, forceNewSlice) {
      if (folder === this.curFolder && !forceNewSlice) {
        return false;
      }

      // If using a cache, do not clear the HTML as it will
      // be cleared once real data has been fetched.
      if (!this.usingCachedNode) {
        // This inherently scrolls us back up to the top of the list.
        this.vScroll.clearDisplay();
      }
      this._needVScrollData = true;

      this.curFolder = folder;

      switch (folder.type) {
        case 'drafts':
        case 'localdrafts':
        case 'outbox':
        case 'sent':
          this.isIncomingFolder = false;
          break;
        default:
          this.isIncomingFolder = true;
          break;
      }

      this.folderNameNode.textContent = folder.name;
      this.updateUnread(folder.unread);
      this.messagesContainer.setAttribute('aria-label', folder.name);
      this.hideEmptyLayout();

      this.updateLastSynced(folder.lastSyncedAt);

      if (forceNewSlice) {
        // We are creating a new slice, so any pending snippet requests are
        // moot.
        this._snippetRequestPending = false;
        headerCursor.freshMessagesSlice();
      }

      this.onFolderShown();

      return true;
    },

    showSearch: function(phrase, filter) {
      console.log('sf: showSearch. phrase:', phrase, phrase.length);

      this.curFolder = model.folder;
      this.vScroll.clearDisplay();
      this.vScroll.setListNodeCount(headerCursor.messagesSlice.headerCount);
      this.curFilter = filter;
      if (phrase.length > 0) {
        this.searchResult.classList.remove('collapsed');
      } else {
        this.searchResult.classList.add('collapsed');
        if (this.editMode) {
          this.setEditMode(false);
        }
      }
      this.syncMoreNode.classList.add('collapsed');

      // We are creating a new slice, so any pending snippet requests are moot.
      this._snippetRequestPending = false;
      // Don't bother the new slice with requests until we hears it completion
      // event.
      this.waitingOnChunk = true;
      headerCursor.startSearch(phrase, {
        author: filter === 'all' || filter === 'author',
        recipients: filter === 'all' || filter === 'recipients',
        subject: filter === 'all' || filter === 'subject',
        body: filter === 'all' || filter === 'body'
      });

      return true;
    },

    onSearchFilterClick: function(filterNode, event) {
      accessibilityHelper.setAriaSelected(filterNode.firstElementChild,
        this.searchFilterTabs);
      this.showSearch(this.searchInput.value, filterNode.dataset.filter);
    },

    onSearchTextChange: function(event) {
      console.log('sf: typed, now:', this.searchInput.value);
      if (event.isComposing) {
        return;
      }
      this.showSearch(this.searchInput.value, this.curFilter);
    },

    onSearchSubmit: function(event) {
      // Not a real form to submit, so stop actual submission.
      event.preventDefault();

      // Blur the focus away from the text input. This has the effect of hiding
      // the keyboard. This is useful for the two cases where this function is
      // currently triggered: Enter on the keyboard or Cancel on form submit.
      // Note that the Cancel button has a type="submit", which is technically
      // an incorrect use of that type. However the /shared styles depend on it
      // being marked as such for style reasons.
      this.searchInput.blur();
    },

    onCancelSearch: function(event) {
      try {
        headerCursor.endSearch();
      }
      catch (ex) {
        console.error('problem killing slice:', ex, '\n', ex.stack);
      }
      cards.removeCardAndSuccessors(this, 'animate');
    },

    onGetMoreMessages: function() {
      if (!headerCursor.messagesSlice) {
        return;
      }

      // For accessibility purposes, focus on the first newly loaded item in the
      // messages list. This will ensure that screen reader's cursor position
      // will get updated to the right place.
      this.vScroll.once('recalculated', (calledFromTop, refIndex) => {
        // refIndex is the index of the first new message item.
        this.messagesContainer.querySelector(
          '[data-index="' + refIndex + '"]').focus();
      });

      headerCursor.messagesSlice.requestGrowth(1, true);
    },

    /**
     * Set header state based on the new message status.
     */
    setRefreshState: function(syncing) {
      if (syncing) {
        this.normalHeader.classList.add('synchronizing');
      } else {
        this.normalHeader.classList.remove('synchronizing');
      }
    },

    // The funny name because it is auto-bound as a listener for
    // messagesSlice events in headerCursor using a naming convention.
    messages_status: function(newStatus) {
      if (headerCursor.searchMode !== this.mode) {
        return;
      }

      // The outbox's refresh button is used for sending messages, so we
      // ignore any syncing events generated by the slice. The outbox
      // doesn't need to show many of these indicators (like the "Load
      // More Messages..." node, etc.) and it has its own special
      // "refreshing" display, as documented elsewhere in this file.
      if (this.curFolder.type === 'outbox') {
        return;
      }

      if (newStatus === 'synchronizing' ||
          newStatus === 'syncblocked') {
        this.hideEmptyLayout();
        this.setRefreshState(true);
      } else if (newStatus === 'syncfailed' ||
                 newStatus === 'synced') {
        if (newStatus === 'syncfailed') {
          // If there was a problem talking to the server, notify the user and
          // provide a means to attempt to talk to the server again.  We have
          // made onRefresh pretty clever, so it can do all the legwork on
          // accomplishing this goal.
          let errorInfo;
          if (navigator.connection.type !== 'none') {
            errorInfo = mozL10n.get('toaster-sync-failed');
          } else {
            errorInfo = mozL10n.get('no-internet-connection');
          }
          toaster.toast({
            text: errorInfo
          });
          if (!model.account.enabled) {
            model.account.clearProblems();
          }
        }
        this.setRefreshState(false);
        this._manuallyTriggeredSync = false;
      }
    },

    isEmpty: function() {
      return headerCursor.messagesSlice.items.length === 0;
    },

    /**
     * Hide buttons that are not appropriate if we have no messages and display
     * the appropriate l10n string in the message list proper.
     */
    showEmptyLayout: function() {
      if (!this.syncMoreNode.classList.contains('collapsed')) {
        this.syncMoreNode.classList.add('collapsed');
      }
      if (this.mode === 'search') {
        this.searchResult.classList.add('collapsed');
      }
      if (!this.usingCachedNode) {
        this.usingCachedNode = true;
      }
      this._clearCachedMessages();

      mozL10n.setAttributes(
        this.messageEmptyText,
        (this.mode === 'search') ? 'messages-search-empty' :
                                   'messages-folder-empty');
      if (this.mode !== 'search' || this.searchInput.value) {
        this.messageEmptyContainer.classList.remove('collapsed');
        if (this.mode === 'nonsearch') {
          this.messageEmptyText.focus();
        }
      }

      this._hideSearchBoxByScrolling();
      this.setSoftkeyBar();
      this.isShowEmpty = true;
    },

    /**
     * Show buttons we hid in `showEmptyLayout` and hide the "empty folder"
     * message.
     */
    hideEmptyLayout: function() {
      this.isShowEmpty = false;
      this.messageEmptyContainer.classList.add('collapsed');
      this.setSoftkeyBar();
    },


    /**
     * @param {number=} newEmailCount Optional number of new messages.
     * The funny name because it is auto-bound as a listener for
     * messagesSlice events in headerCursor using a naming convention.
     */
    messages_complete: function(newEmailCount) {
      if (headerCursor.searchMode !== this.mode) {
        return;
      }

      console.log('message_list complete:',
                  headerCursor.messagesSlice.items.length, 'items of',
                  headerCursor.messagesSlice.headerCount,
                  'alleged known headers. canGrow:',
                  headerCursor.messagesSlice.userCanGrowDownwards);

      // Show "load more", but only if the slice can grow and if there is a
      // non-zero headerCount. If zero headerCount, it likely means the folder
      // has never been synchronized, and this display was an offline display,
      // so it is hard to know if messages can be synchronized. In this case,
      // canGrow is not enough of an indicator, because as far as the back end is
      // concerned, it could grow, it just has no way to check for sure yet. So
      // hide the "load more", the user can use the refresh icon once online to
      // load messages.
      if (headerCursor.messagesSlice.userCanGrowDownwards &&
          headerCursor.messagesSlice.headerCount) {
        this.syncMoreNode.classList.remove('collapsed');
        if (!this.syncContainer.contains(this.syncMoreNode)) {
          this.syncContainer.appendChild(this.syncMoreNode);
        }
      } else {
        this.syncMoreNode.classList.add('collapsed');
        if (this.syncContainer.contains(this.syncMoreNode)) {
          this.syncContainer.removeChild(this.syncMoreNode);
        }
      }

      // Show empty layout, unless this is a slice with fake data that
      // will get changed soon.
      if (headerCursor.messagesSlice.items.length === 0) {
        this.showEmptyLayout();
      }

      // Search does not trigger normal conditions for a folder changed,
      // so if vScroll is missing its data, set it up now.
      if (this.mode === 'search' && !this.vScroll.list) {
        this.vScroll.setData(this.listFunc);
      }

      if (this.mode === 'search') {
        this.searchMessages = headerCursor.messagesSlice.headerCount;
        mozL10n.setAttributes(this.searchResult, 'search-result',
            { num: this.searchMessages ? this.searchMessages : 0 });
        if (this.editMode && this.selectedMessages.length > 0) {
          let items = headerCursor.messagesSlice.items;
          let temp = [];
          for (let i = 0; i < items.length; i++) {
            let id = items[i].header.id;
            for (let j = 0; j < this.selectedMessages.length; j++) {
              if (this.selectedMessages[j].id === id) {
                temp.push(this.selectedMessages[j]);
              }
            }
          }
          this.selectedMessages = temp;
          this.selectedMessagesUpdated();
        }
      }

      this.onNewMail(newEmailCount);

      this.waitingOnChunk = false;
      // Load next chunk if one is pending
      if (this.desiredHighAbsoluteIndex) {
        this.loadNextChunk(this.desiredHighAbsoluteIndex);
        this.desiredHighAbsoluteIndex = 0;
      }

      // It's possible for a synchronization to result in a change to
      // headerCount without resulting in a splice.  This is very likely
      // to happen with a search filter when it was lying about another
      // messages existing, but it's also possible to happen in
      // synchronizations.
      //
      // XXX Our total correctness currently depends on headerCount only
      // changing as a result of a synchronization triggered by this slice.
      // This does not hold up when confronted with periodic background sync; we
      // need to finish cleanup up the headerCount change notification stuff.
      //
      // (However, this is acceptable glitchage right now.  We just need to make
      // sure it doesn't happen for searches since it's so blatant.)
      //
      // So, anyways, use updateDataBind() to cause VScroll to double-check that
      // our list size didn't change from what it thought it was.  (It renders
      // coordinate-space predictively based on our headerCount, but we
      // currently only provide strong correctness guarantees for actually
      // reported `items`, so we must do this.)  If our list size is the same,
      // this call is effectively a no-op.
      this.vScroll.updateDataBind(0, [], 0);


      // Inform that content is ready. There could actually be a small delay
      // with vScroll.updateDataBind from rendering the final display, but it is
      // small enough that it is not worth trying to break apart the design to
      // accommodate this metrics signal.
      if (!this._emittedContentEvents) {
        evt.emit('metrics:contentDone');
        this._emittedContentEvents = true;
      }

      NavigationMap.messageListMailCount =
          headerCursor.messagesSlice.headerCount;
      this.setSoftkeyBar();
      this.setRefreshState(false);
      // Update mail list cache
      this._cacheDom();
    },

    onNewMail: function(newEmailCount) {
      let inboxFolder = model.foldersSlice.getFirstFolderWithType('inbox');

      if (inboxFolder && inboxFolder.id === this.curFolder.id &&
          newEmailCount && newEmailCount > 0) {
        if (!cards.isVisible(this)) {
          this._whenVisible = this.onNewMail.bind(this, newEmailCount);
          return;
        }

        this.curFolder.reSort = true;
        // If the user manually synced, then want to jump to show the new
        // messages. Otherwise, show the top bar.
        if (this._manuallyTriggeredSync) {
          this.vScroll.jumpToIndex(0);
          this.action = 'new';
        } else {
          let newMessages = mozL10n.get('new-messages', {
            n: newEmailCount
          });

          toaster.toast({
            text: newMessages
          });
        }
      } else {
        if (this.mode === 'nonsearch' && this.className === 'card center') {
          this.setMessageListFocus(false, true);
        }
      }
    },

    // When an email is being sent from the app (and not from an outbox
    // refresh), we'll receive notification here. Play a sound and
    // raise a toast, if appropriate.
    onBackgroundSendStatus: function(data) {
      if (this.curFolder.type === 'outbox') {
        if (data.state === 'sending') {
          // If the message is now sending, make sure we're showing the
          // outbox as "currently being synchronized".
          this.toggleOutboxSyncingDisplay(true);
        } else if (data.state === 'syncDone') {
          this.toggleOutboxSyncingDisplay(false);
        }
      } else {
        if (data.state === 'sending' && data.sendType) {
          this.composeSendType = data.sendType;
        } else if (data.state === 'success') {
          switch (this.composeSendType) {
            case 'reply':
              model.api.markMessagesReply(this.selectedMessages, true);
              break;
            case 'forward':
              model.api.markMessagesForward(this.selectedMessages, true);
              break;
            default:
              break;
          }
        }
      }

      if (data.emitNotifications && data.sendType || data.state === 'success') {
        toaster.toast({
          text: data.localizedDescription
        });
      } else if (data.state === 'error') {
        let errMsg = data.localizedDescription;
        setTimeout(() => {
          if (navigator.connection.type === 'none') {
            errMsg = mozL10n.get('background-send-pending');
          }
          toaster.toast({
            text: errMsg
          });
        }, 200);
      }
    },

    /**
     * Waits for scrolling to stop before fetching snippets.
     */
    _onVScrollStopped: function() {
      // Give any pending requests in the slice priority.
      if (!headerCursor.messagesSlice ||
          headerCursor.messagesSlice.pendingRequestCount) {
        this.doScrollAction();
        return;
      }

      // Do not bother fetching snippets if this card is not in view.
      // The card could still have a scroll event triggered though
      // by the next/previous work done in message_reader.
      if (cards.isVisible(this) && !this._hasSnippetRequest()) {
        this._requestSnippets();
      }
      this.doScrollAction();
    },

    _hasSnippetRequest: function() {
      let max = MAXIMUM_MS_BETWEEN_SNIPPET_REQUEST;
      let now = Date.now();

      // if we before the maximum time to wait between requests...
      let beforeTimeout = (this._lastSnippetRequest + max) > now;

      // there is an important case where the backend may be slow OR have some
      // fatal error which would prevent us from ever requesting an new set of
      // snippets because we wait until the last batch finishes. To prevent that
      // from ever happening we maintain the request start time and if more then
      // MAXIMUM_MS_BETWEEN_SNIPPET_REQUEST passes we issue a new request.
      return this._snippetRequestPending && beforeTimeout;
    },

    _pendingSnippetRequest: function() {
      this._snippetRequestPending = true;
      this._lastSnippetRequest = Date.now();
    },

    _clearSnippetRequest: function() {
      this._snippetRequestPending = false;
    },

    _requestSnippets: function() {
      let items = headerCursor.messagesSlice.items;
      let len = items.length;

      if (!len) {
        return;
      }

      let clearSnippets = this._clearSnippetRequest.bind(this);
      let options = {
        // this is per message
        maximumBytesToFetch: MAXIMUM_BYTES_PER_MESSAGE_DURING_SCROLL
      };

      if (len < MINIMUM_ITEMS_FOR_SCROLL_CALC) {
        this._pendingSnippetRequest();
        headerCursor.messagesSlice.maybeRequestBodies(0,
            MINIMUM_ITEMS_FOR_SCROLL_CALC - 1, options, clearSnippets);
        return;
      }

      let visibleIndices = this.vScroll.getVisibleIndexRange();

      if (visibleIndices) {
        this._pendingSnippetRequest();
        headerCursor.messagesSlice.maybeRequestBodies(
          visibleIndices[0],
          visibleIndices[1],
          options,
          clearSnippets
        );
      }
    },

    /**
     * How many items in the message list to keep for the _cacheDom call.
     * @type {Number}
     */
    _cacheListLimit: 7,

    /**
     * Tracks if a DOM cache save is scheduled for later.
     * @type {Number}
     */
    _cacheDomTimeoutId: 0,

    /**
     * Confirms card state is in a visual state suitable for caching.
     */
    _isCacheableCardState: function() {
      return this.cacheableFolderId === this.curFolder.id &&
             this.mode === 'nonsearch' &&
             !this.editMode;
    },

    /**
     * Caches the DOM for this card, but trims it down a bit first.
     */
    _cacheDom: function() {
      this._cacheDomTimeoutId = 0;
      if (!this._isCacheableCardState()) {
        return;
      }

      // Safely clone the node so we can mutate the tree to cut out the parts
      // we do not want/need.
      let cacheNode =
          htmlCache.cloneAsInertNodeAvoidingCustomElementHorrors(this);
      cacheNode.dataset.cached = 'cached';

      // Hide search field as it will not operate and gets scrolled out
      // of view after real load.
      let removableCacheNode = cacheNode.querySelector('.msg-search-tease-bar');
      if (removableCacheNode) {
        removableCacheNode.classList.add('collapsed');
      }

      // Hide the last sync number
      let tempNode = cacheNode.querySelector('.msg-last-synced-label');
      if (tempNode) {
        tempNode.innerHTML = mozL10n.get('synchronizing');
      }
      tempNode = cacheNode.querySelector('.msg-last-synced-value');
      if (tempNode) {
        tempNode.innerHTML = '';
      }

      // Trim vScroll containers that are not in play
      VScroll.trimMessagesForCache(
        cacheNode.querySelector('.msg-messages-container'),
        this._cacheListLimit
      );

      // restore syncMoreNode
      if (!cacheNode.querySelector('.msg-messages-sync-more')) {
        let syncContainer =
            cacheNode.querySelector('.msg-messages-sync-container');
        if (syncContainer) {
          syncContainer.appendChild(this.syncMoreNode.cloneNode(true));
        }
      }

      htmlCache.saveFromNode(module.id, cacheNode);
    },

    /**
     * Considers a DOM cache, but only if it meets the criteria for what
     * should be saved in the cache, and if a save is not already scheduled.
     * @param  {Number} index the index of the message that triggered
     *                  this call.
     */
    _considerCacheDom: function(index) {
      // Only bother if not already waiting to update cache and
      if (!this._cacheDomTimeoutId &&
          // card visible state is appropriate
          this._isCacheableCardState() &&
          // if the scroll area is at the top (otherwise the
          // virtual scroll may be showing non-top messages)
          this.vScroll.firstRenderedIndex === 0 &&
          // if actually got a numeric index and
          (index || index === 0) &&
          // if it affects the data we cache
          index < this._cacheListLimit  &&
          this.className === 'card center') {
        this._cacheDomTimeoutId = setTimeout(this._cacheDom.bind(this), 600);
      }
    },

    /**
     * Clears out the messages HTML in messageContainer from using the cached
     * nodes that were picked up when the HTML cache of this list was used
     * (which is indicated by usingCachedNode being true). The cached HTML
     * needs to be purged when the real data is finally available and will
     * replace the cached state. A more sophisticated approach would be to
     * compare the cached HTML to what would be inserted in its place, and
     * if no changes, skip this step, but that comparison operation could get
     * tricky, and it is cleaner just to wipe it and start fresh. Once the
     * cached HTML has been cleared, then usingCachedNode is set to false
     * to indicate that the main piece of content in the card, the message
     * list, is no longer from a cached node.
     */
    _clearCachedMessages: function() {
      if (this.usingCachedNode) {
        this.messagesContainer.innerHTML = '';
        this.usingCachedNode = false;
      }
    },

    /**
     * Request data through desiredHighAbsoluteIndex if we don't have it
     * already and we think it exists.  If we already have an outstanding
     * request we will save off this most recent request to process once
     * the current request completes.  Any previously queued request will
     * be forgotten regardless of how it compares to the newly queued
     * request.
     *
     * @param  {Number} desiredHighAbsoluteIndex
     */
    loadNextChunk: function(desiredHighAbsoluteIndex) {
      // The recalculate logic will trigger a call to prepareData, so
      // it's okay for us to bail.  It's advisable for us to bail
      // because any calls to prepareData will be based on outdated
      // index information.
      if (this.vScroll.waitingForRecalculate) {
        return;
      }

      if (this.waitingOnChunk) {
        this.desiredHighAbsoluteIndex = desiredHighAbsoluteIndex;
        return;
      }

      // Do not bother asking for more than exists
      if (desiredHighAbsoluteIndex >= headerCursor.messagesSlice.headerCount) {
        desiredHighAbsoluteIndex = headerCursor.messagesSlice.headerCount - 1;
      }

      // Do not bother asking for more than what is already
      // fetched
      let items = headerCursor.messagesSlice.items;
      let curHighAbsoluteIndex = items.length - 1;
      let amount = desiredHighAbsoluteIndex - curHighAbsoluteIndex;
      if (amount > 0) {
        // IMPORTANT NOTE!
        // 1 is unfortunately a special value right now for historical reasons
        // that the other side interprets as a request to grow downward with the
        // default growth size.  XXX change backend and its tests...
        console.log('message_list loadNextChunk growing', amount,
                    (amount === 1 ? '(will get boosted to 15!) to' : 'to'),
                    (desiredHighAbsoluteIndex + 1), 'items out of',
                    headerCursor.messagesSlice.headerCount, 'alleged known');
        headerCursor.messagesSlice.requestGrowth(
          amount,
          // the user is not requesting us to go synchronize new messages
          false);
        this.waitingOnChunk = true;
      }
    },

    // The funny name because it is auto-bound as a listener for
    // messagesSlice events in headerCursor using a naming convention.
    messages_splice: function(index, howMany, addedItems,
                              requested, moreExpected, fake) {
      // If no work to do, or wrong mode, just skip it.
      if (headerCursor.searchMode !== this.mode ||
         (index === 0 && howMany === 0 && !addedItems.length)) {
        return;
      }

      this._clearCachedMessages();

      if (this._needVScrollData) {
        let count = headerCursor.messagesSlice.headerCount;
        this.vScroll.setListNodeCount(count);
        this.vScroll.setData(this.listFunc);
        this._needVScrollData = false;
      }

      this.vScroll.updateDataBind(index, addedItems, howMany);

      // Remove the no message text while new messages added:
      if (addedItems.length > 0) {
        this.hideEmptyLayout();
      }

      if (this.mode === 'search') {
        if (this.searchResultNeedUpdate) {
          this.searchMessages = headerCursor.messagesSlice.headerCount;
          mozL10n.setAttributes(this.searchResult, 'search-result',
            { num: this.searchMessages ? this.searchMessages : 0 });
          this.searchResultNeedUpdate = false;
        }
      }

      // If the end result is no more messages, then show empty layout.
      // This is needed mostly because local drafts do not trigger
      // a messages_complete callback when removing the last draft
      // from the compose triggered in that view. The scrollStopped
      // is used to avoid a flash where the old message is briefly visible
      // before cleared, and having the empty layout overlay it.
      // Using the slice's headerCount because it is updated before splice
      // listeners are notified, so should be accurate.
      if (!headerCursor.messagesSlice.headerCount) {
        this.vScroll.once('scrollStopped', () => {
          // Confirm there are still no messages. Since this callback happens
          // async, some items could have appeared since first issuing the
          // request to show empty.
          if (!headerCursor.messagesSlice.headerCount) {
            this.showEmptyLayout();
          }
        });
      } else {
        NavigationMap.messageListMailCount =
            headerCursor.messagesSlice.headerCount;
      }

      if (howMany > 0 && addedItems.length === 0) {
        this.setMessageListFocus(true, false);
      }
      // Only cache if it is an add or remove of items
      if (addedItems.length || howMany) {
        this._considerCacheDom(index);
      }
    },

    // The funny name because it is auto-bound as a listener for
    // messagesSlice events in headerCursor using a naming convention.
    messages_change: function(message, index) {
      if (headerCursor.searchMode !== this.mode) {
        return;
      }

      if (this.mode === 'nonsearch') {
        this.onMessagesChange(message, index);
      } else {
        this.updateMatchedMessageDom(false, message);
      }

      /* update softkey bar for mark read & flag */
      if (message) {
        this.selectedMessagesUpdated();
      }
    },

    onMessagesChange: function(message, index) {
      this.updateMessageDom(false, message);

      // Since the DOM change, cache may need to change.
      this._considerCacheDom(index);
      // update outbox sync state
      if (this.curFolder.type === 'outbox') {
        let status = message.sendStatus && message.sendStatus.state;
        if (status !== 'sending') {
          this.toggleOutboxSyncingDisplay(false);
        }
      }
    },

    _updatePeepDom: function(peep) {
      if (peep.element) {
        peep.element.textContent =
          peep.contactName || peep.name || peep.address;
      }

      //update thumbnail
      if (peep.photoNode) {
        let url = 'url(style/images/icons/contacts_icon.png)';
        if (peep._thumbnailBlob) {
          url = 'url(' + URL.createObjectURL(peep._thumbnailBlob) + '), ' + url;
        }
        peep.photoNode.style.backgroundImage = url;
      }
    },

    /**
     * Update the state of the given DOM node.  Note that DOM nodes are reused
     * so although you can depend on `firstTime` to be accurate, you must ensure
     * that this method cleans up any dirty state resulting from any possible
     * prior operation of this method.
     *
     * Also note that there is a separate method `updateMatchedMessageDom` for
     * our search mode.  If you are changing this method you probably also want
     * to be changing that method.
     */
    updateMessageDom: function(firstTime, message) {
      let msgNode = message.element;

      if (!msgNode) {
        return;
      }

      // If the placeholder data, indicate that in case VScroll
      // wants to go back and fix later.
      let classAction = message.isPlaceholderData ? 'add' : 'remove';
      msgNode.classList[classAction](this.vScroll.itemDefaultDataClass);

      // ID is stored as a data- attribute so that it can survive
      // serialization to HTML for storing in the HTML cache, and
      // be usable before the actual data from the backend has
      // loaded, as clicks to the message list are allowed before
      // the back end is available. For this reason, click
      // handlers should use dataset.id when wanting the ID.
      msgNode.dataset.id = message.id;

      // some things only need to be done once
      let dateNode = msgNode.querySelector('.msg-header-date');
      let subjectNode = msgNode.querySelector('.msg-header-subject');
      let snippetNode = msgNode.querySelector('.msg-header-snippet');
      let avatarNode = msgNode.querySelector('.msg-header-avatar-section');
      if (firstTime) {
        let listPerson;
        if (this.isIncomingFolder) {
          listPerson = message.author;
        // XXX This is not to UX spec, but this is a stop-gap and that would
        // require adding strings which we cannot justify as a slipstream fix.
        } else if (message.to && message.to.length) {
          listPerson = message.to[0];
        } else if (message.cc && message.cc.length) {
          listPerson = message.cc[0];
        } else if (message.bcc && message.bcc.length) {
          listPerson = message.bcc[0];
        }

        // author
        if (listPerson) {
          listPerson.element =
              msgNode.querySelector('.msg-header-author');
          listPerson.photoNode = avatarNode;
          listPerson.onchange = this._updatePeepDom;
          listPerson.onchange(listPerson);
        } else {
          msgNode.querySelector('.msg-header-author').textContent = '';
        }
        // date
        if (message.date) {
          let dateTime = message.date.valueOf();
          dateNode.dataset.time = dateTime;
          dateNode.textContent = dateTime ? date.prettyDate(message.date) : '';
        }
        // subject
        messageDisplay.subject(msgNode.querySelector('.msg-header-subject'),
                              message);

        // attachments (can't change within a message but can change between
        // messages, and since we reuse DOM nodes...)
        let attachmentsNode = msgNode.querySelector('.msg-header-attachments');
        attachmentsNode.classList.toggle('msg-header-attachments-yes',
                                         message.hasAttachments);
        // snippet needs to be shorter if icon is shown
        snippetNode.classList.toggle('icon-short', message.hasAttachments);
      }

      // snippet
      snippetNode.textContent = message.snippet;

      // update styles throughout the node for read vs unread
      msgNode.classList.toggle('unread', !message.isRead);

      // update styles throughout the node if replied
      msgNode.classList.toggle('reply', message.isRepliedTo);

      // update styles throughout the node if forwarded
      msgNode.classList.toggle('forward', message.isForwarded);

      // star
      let starNode = msgNode.querySelector('.msg-header-star');

      starNode.classList.toggle('msg-header-star-starred', message.isStarred);
      // subject needs to give space for star if it is visible
      subjectNode.classList.toggle('icon-short', message.isStarred);

      // sync status
      let syncNode =
          msgNode.querySelector('.msg-header-syncing-section');

      // sendState is only intended for outbox messages, so not all
      // messages will have sendStatus defined.
      let sendState = message.sendStatus && message.sendStatus.state;

      syncNode.classList.toggle('msg-header-syncing-section-syncing',
                                sendState === 'sending');
      syncNode.classList.toggle('msg-header-syncing-section-error',
                                sendState === 'error');

      // Set the accessible label for the syncNode.
      if (sendState) {
        mozL10n.setAttributes(syncNode, 'message-header-state-' + sendState);
      } else {
        syncNode.removeAttribute('data-l10n-id');
      }

      // edit mode select state
      this.setSelectState(msgNode, message);
    },

    updateMatchedMessageDom: function(firstTime, matchedHeader) {
      let msgNode = matchedHeader.element,
          matches = matchedHeader.matches,
          message = matchedHeader.header;

      if (!msgNode) {
        return;
      }

      // If the placeholder data, indicate that in case VScroll
      // wants to go back and fix later.
      let classAction = message.isPlaceholderData ? 'add' : 'remove';
      msgNode.classList[classAction](this.vScroll.itemDefaultDataClass);

      // Even though updateMatchedMessageDom is only used in searches,
      // which likely will not be cached, the dataset.is is set to
      // maintain parity withe updateMessageDom and so click handlers
      // can always just use the dataset property.
      msgNode.dataset.id = matchedHeader.id;

      // some things only need to be done once
      let dateNode = msgNode.querySelector('.msg-header-date');
      let subjectNode = msgNode.querySelector('.msg-header-subject');
      let avatarNode = msgNode.querySelector('.msg-header-avatar-section');
      if (firstTime) {
        // author
        let authorNode = msgNode.querySelector('.msg-header-author');
        if (matches.author) {
          authorNode.textContent = '';
          appendMatchItemTo(matches.author, authorNode);
          message.author.element = null; //don't update author in onChange
        }
        else {
          // we can only update the name if it wasn't matched on.
          message.author.element = authorNode;
        }

        message.author.photoNode = avatarNode;
        message.author.onchange = this._updatePeepDom;
        message.author.onchange(message.author);

        // date
       if (message.date) {
         dateNode.dataset.time = message.date.valueOf();
         dateNode.textContent = date.prettyDate(message.date);
       }

        // subject
        if (matches.subject) {
          subjectNode.textContent = '';
          appendMatchItemTo(matches.subject[0], subjectNode);
        } else {
          messageDisplay.subject(subjectNode, message);
        }

        // snippet
        let snippetNode = msgNode.querySelector('.msg-header-snippet');
        if (matches.body) {
          snippetNode.textContent = '';
          appendMatchItemTo(matches.body[0], snippetNode);
        } else {
          snippetNode.textContent = message.snippet;
        }

        // attachments (can't change within a message but can change between
        // messages, and since we reuse DOM nodes...)
        let attachmentsNode =
            msgNode.querySelector('.msg-header-attachments');
        attachmentsNode.classList.toggle('msg-header-attachments-yes',
                                         message.hasAttachments);
        // snippet needs to be shorter if icon is shown
        snippetNode.classList.toggle('icon-short', message.hasAttachments);
      }

      // Set unread state.
      msgNode.classList.toggle('unread', !message.isRead);

      // Set replied state.
      msgNode.classList.toggle('reply', message.isRepliedTo);

      // Set forwarded state.
      msgNode.classList.toggle('forward', message.isForwarded);

      // star
      let starNode = msgNode.querySelector('.msg-header-star');
      starNode.classList.toggle('msg-header-star-starred', message.isStarred);
      // subject needs to give space for star if it is visible
      subjectNode.classList.toggle('icon-short', message.isStarred);

      // edit mode select state
      this.setSelectState(msgNode, message);
    },

    /**
     * Set or unset the select state based on the edit mode.
     */
    setSelectState: function(msgNode, message) {
      if (this.editMode) {
        let bCheck = false;
        if (this.selectedMessages.length > 0) {
          for (let i = 0; i < this.selectedMessages.length; i++) {
            if (this.selectedMessages[i].id === message.id) {
              bCheck = true;
              break;
            }
          }
        }
        this.setMessageChecked(msgNode, bCheck);
      } else {
        msgNode.removeAttribute('aria-selected');
      }
    },

    /**
     * Set the checked state for the message item in the list. It sets both
     * checkbox checked and aria-selected states.
     */
    setMessageChecked: function(msgNode, checked) {
      let checkbox = msgNode.querySelector('input[type=checkbox]');
      checkbox.checked = checked;
      msgNode.setAttribute('aria-selected', checked);
    },


    /**
     * Listener called when a folder is shown. The listener emits an
     * 'inboxShown' for the current account, if the inbox is really being shown
     * and the app is visible. Useful if periodic sync is involved, and
     * notifications need to be closed if the inbox is visible to the user.
     */
    onFolderShown: function() {
      if (this.mode === 'search') {
        return;
      }

      let account = model.account,
          foldersSlice = model.foldersSlice;

      // The extra checks here are to allow for lazy startup when we might have
      // a card instance but not a full model available. Once the model is
      // available though, this method will get called again, so the event
      // emitting is still correctly done in the lazy startup case.
      if (!document.hidden && account && foldersSlice && this.curFolder) {
        let inboxFolder = foldersSlice.getFirstFolderWithType('inbox');
        if (inboxFolder === this.curFolder) {
          evt.emit('inboxShown', account.id);
        }
      }
    },

    /**
     * An API method for the cards infrastructure, that Cards will call when the
     * page visibility changes and this card is the currently displayed card.
     */
    onCurrentCardDocumentVisibilityChange: function(evt) {
      this.onFolderShown();
      if (cards._backgroundUpdate && !evt) {
        this.onCardVisible('forward');
        cards._backgroundUpdate = false;
      }
    },

    sortElements: function(elements) {
      let arrayElements = Array.prototype.slice.call(elements);
      let syncmore;
      let syncmoreindex;
      arrayElements.forEach((item) => {
        if (item.classList.contains('msg-messages-sync-more')) {
          syncmore = item;
        }
      });

      if (syncmore) {
        syncmoreindex = arrayElements.indexOf(syncmore);
        let headPart = arrayElements.slice(0, syncmoreindex);
        let tailPart = arrayElements.slice(syncmoreindex + 1);
        arrayElements = headPart.concat(tailPart);
      }

      arrayElements.sort((a, b) => {
        return a.dataset.index - b.dataset.index;
      });

      if (syncmore) {
        arrayElements.push(syncmore);
      }

      return arrayElements;
    },

    /**
     * Called by Cards when the instance of this card type is the
     * visible card.
     */
    onCardVisible: function(navDirection) {
      if (this._whenVisible) {
        let fn = this._whenVisible;
        this._whenVisible = null;
        fn();
      }

      // Remove cached softkey panel if it has been restored,
      // so that the card's own softkey panel can be the only
      // one softeky panel instance.
      let cacheSoftkeyNode = document.getElementById('cachedSoftkeyPanel');
      if (cacheSoftkeyNode) {
        document.body.removeChild(cacheSoftkeyNode);
      }

      // First time this card is visible, want the search field focused if this
      // is a search. Do not want to do it on every cardVisible, as the user
      // could be scrolled/have their own place in the search results, and are
      // likely going back and forth between this card and message_reader.
      NavigationMap.searchMode = false;
      if (this.mode === 'search') {
        if (this.isFirstTimeVisible) {
          mozL10n.setAttributes(this.filterType, 'message-search-all');
        }
        NavigationMap.searchMode = true;
        if (!this.keydownForSearchHander) {
          this.keydownForSearchHander = this.handleKeydownForSearch.bind(this);
          window.addEventListener('keydown', this.keydownForSearchHander);
        }
        this.searchInputLi.addEventListener('focus', () => {
          this.searchInput.focus();
          let inputLength = this.searchInput.value.length;
          this.searchInput.setSelectionRange(inputLength, inputLength);
        });
      } else if (this.mode === 'nonsearch') {
        if (!this.keydownHandler) {
          this.keydownHandler = this.handleKeydown.bind(this);
          window.addEventListener('keydown', this.keydownHandler);
        }
      }
      NavigationMap.cardContentHeight = this.scrollContainer.clientHeight;
      this.isFirstTimeVisible = false;

      // In case the vScroll was initialized when the card was not visible, like
      // in an activity/notification flow when this card is created in the
      // background behind the compose/reader card, let it know it is visible
      // now in case it needs to finish initializing and initial display.
      this.vScroll.nowVisible();

      let CARD_NAME = this.localName;
      let CONTROL_ID;
      if (this.mode === 'search') {
        CONTROL_ID = CARD_NAME + ' .focusable, ' + CARD_NAME + ' ' +
                     QUERY_CHILD;
      } else {
        CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;
      }

      // forward: new card pushed
      if (navDirection === 'forward') {
        this.initOption();
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD, this.sortElements);
        let focusIndex = (this.mode === 'search') ? 1 : 'first';
        NavigationMap.setFocus(focusIndex);
        NavigationMap.observeChild(CARD_NAME, QUERY_CHILD, this.sortElements);
      }
      // back: hidden card is restored
      else if (navDirection === 'back') {
        NavigationMap.setCurrentControl(CONTROL_ID);
        let curControl = NavigationMap.getCurrentControl();
        if (!curControl ||
            curControl.container.className !== 'card center' || !NavigationMap.currentMessageId) {
          this.initOption();
          NavigationMap.navSetup(CARD_NAME, QUERY_CHILD, this.sortElements);
          NavigationMap.observeChild(CARD_NAME, QUERY_CHILD, this.sortElements);
        }
        // if we're back from the localdrafts' search compose page, we need to
        // do research to make sure the updated draft mail can be shown.
        if (this.mode === 'search' && this.curFolder.type === 'localdrafts'
            && this.searchInput.value) {
          this.showSearch(this.searchInput.value, this.curFilter);
        }
        this.setMessageListFocus(false, false);
      }
      if (this.isShowEmpty) {
        setTimeout( () => {
          this.messageEmptyText.focus();
        }, 3000);
      }

      if (this.mode === 'nonsearch') {
        this.scrollContainer.setAttribute('role', 'heading');
        this.scrollContainer.setAttribute('aria-labelledby', 'folder-header');
      }
      
      // Optimize opening an email detail performance, preload message_reader here.
      if (!cards._cardDefs['message_reader']) {
        require(['element!cards/message_reader'], (Ctor) => {
          cards._cardDefs['message_reader'] = Ctor;
        });
      }
    },

    setMessageListFocus: function(bDelete, bSync) {
      let currentId;
      if (this.mode === 'search') {
        currentId = NavigationMap.currentSearchId;
      } else {
        currentId = NavigationMap.currentMessageId;
      }
      if (currentId !== 'INVALID') {
        console.log('Message list: set focus list id : ' + currentId);
        if (bSync && currentId === 'load-more') {
          currentId = null;
        }
        NavigationMap.setMessageListFocus(currentId, bDelete);
      } else {
        let focused = document.querySelector('.focus');
        if (focused && focused.message) {
          currentId = focused.message.id;
          NavigationMap.setMessageListFocus(currentId, bDelete);
        }
      }
    },

    onClickMessage: function(messageNode, event) {
      // You cannot open a message if this is the outbox and it is syncing.
      if (this.curFolder &&
          this.curFolder.type === 'outbox' && this.outboxSyncInProgress) {
        return;
      }

      let header = messageNode.message;

      // Skip nodes that are default/placeholder ones.
      if (header && header.isPlaceholderData) {
        return;
      }

      if (this.editMode) {
        let idx = this.selectedMessages.indexOf(header);
        if (idx !== -1) {
          this.selectedMessages.splice(idx, 1);
        } else {
          this.selectedMessages.push(header);
        }
        this.setMessageChecked(messageNode, idx === -1);
        this.selectedMessagesUpdated();
        return;
      }

      if (this.curFolder && this.curFolder.type === 'localdrafts') {
        let composer = header.editAsDraft(() => {
          cards.pushCard('compose', 'animate',
                         { composer: composer });
        });
        return;
      }

      // When tapping a message in the outbox, don't open the message;
      // instead, move it to localdrafts and edit the message as a
      // draft.
      if (this.curFolder && this.curFolder.type === 'outbox') {
        // If the message is currently being sent, abort.
        if (header.sendStatus.state === 'sending') {
          return;
        }
        let draftsFolder =
            model.foldersSlice.getFirstFolderWithType('localdrafts');

        console.log('outbox: Moving message to localdrafts.');
        model.api.moveMessages([header], draftsFolder, (moveMap) => {
          header.id = moveMap[header.id];
          console.log('outbox: Editing message in localdrafts.');
          let composer = header.editAsDraft(() => {
            cards.pushCard('compose', 'animate',
                           { composer: composer });
          });
        });

        return;
      }

      let pushMessageCard = () => {
        cards.pushCard(
          'message_reader', 'animate',
          {
            // The header here may be undefined here, since the click
            // could be on a cached HTML node before the back end has
            // started up. It is OK if header is not available as the
            // message_reader knows how to wait for the back end to
            // start up to get the header value later.
            header: header,
            // Use the property on the HTML, since the click could be
            // from a cached HTML node and the real data object may not
            // be available yet.
            messageSuid: messageNode.dataset.id,
            curFolder: this.curFolder
          });
      };

      if (header) {
        headerCursor.setCurrentMessage(header);
      } else if (messageNode.dataset.id) {
        // a case where header was not set yet, like clicking on a
        // html cached node, or virtual scroll item that is no
        // longer backed by a header.
        headerCursor.setCurrentMessageBySuid(messageNode.dataset.id);
      } else {
        // Not an interesting click, bail
        return;
      }

      window.performance.mark('mail-load-start');
      pushMessageCard();
    },

    /**
     * Scroll to make sure that the current message is in our visible window.
     *
     * @param {header_cursor.CurrentMessage} currentMessage representation of
     *     the email we're currently reading.
     * @param {Number} index the index of the message in the messagesSlice
     */
    onCurrentMessage: function(currentMessage, index) {
      if (!currentMessage || headerCursor.searchMode !== this.mode) {
        return;
      }

      let visibleIndices = this.vScroll.getVisibleIndexRange();
      if (visibleIndices &&
          (index < visibleIndices[0] || index > visibleIndices[1])) {
        this.vScroll.jumpToIndex(index);
      }
    },

    onHoldMessage: function(messageNode, event) {
      if (this.curFolder) {
        this.setEditMode(true);
      }
    },

    /**
     * The outbox has a special role in the message_list, compared to
     * other folders. We don't expect to synchronize the outbox with the
     * server, but we do allow the user to use the refresh button to
     * trigger all of the outbox messages to send.
     *
     * While they're sending, we need to display several spinny refresh
     * icons: One next to each message while it's queued for sending,
     * and also the main refresh button.
     *
     * However, the outbox send operation doesn't happen all in one go;
     * the backend only fires one 'sendOutboxMessages' at a time,
     * iterating through the pending messages. Fortunately, it notifies
     * the frontend (via `onBackgroundSendStatus`) whenever the state of
     * any message changes, and it provides a flag to let us know
     * whether or not the outbox sync is fully complete.
     *
     * So the workflow for outbox's refresh UI display is as follows:
     *
     * 1. The user taps the "refresh" button. In response:
     *
     *    1a. Immediately make all visible refresh icons start spinning.
     *
     *    1b. Immediately kick off a 'sendOutboxMessages' job.
     *
     * 2. We will start to see send status notifications, in this
     *    class's onBackgroundSendStatus notification. We listen to
     *    these events as they come in, and wait until we see a
     *    notification with state === 'syncDone'. We'll keep the main
     *    refresh icon spinning throughout this process.
     *
     * 3. As messages send or error out, we will receive slice
     *    notifications for each message (handled here in `messages_change`).
     *    Since each message holds its own status as `header.sendStatus`,
     *    we don't need to do anything special; the normal rendering logic
     *    will reset each message's status icon to the appropriate state.
     *
     * But don't take my word for it; see `jobs/outbox.js` and
     * `jobmixins.js` in GELAM for backend-centric descriptions of how
     * the outbox sending process works.
     */
    toggleOutboxSyncingDisplay: function(syncing) {
      // Use an internal guard so that we only trigger changes to the UI
      // when necessary, rather than every time, which could break animations.
      if (syncing === this._outboxSyncing) {
        return;
      }

      this._outboxSyncing = syncing;

      let items = this.messagesContainer.getElementsByClassName(
          'msg-header-syncing-section');

      if (syncing) {
        // For maximum perceived responsiveness, show the spinning icons
        // next to each message immediately, rather than waiting for the
        // backend to actually start sending each message. When the
        // backend reports back with message results, it'll update the
        // icon to reflect the proper result.
        for (let i = 0; i < items.length; i++) {
          items[i].classList.add('msg-header-syncing-section-syncing');
          items[i].classList.remove('msg-header-syncing-section-error');
        }
      } else {
        // Similarly, we must stop the refresh icons for each message
        // from rotating further. For instance, if we are offline, we
        // won't actually attempt to send any of those messages, so
        // they'll still have a spinny icon until we forcibly remove it.
        for (let i = 0; i < items.length; i++) {
          items[i].classList.remove('msg-header-syncing-section-syncing');
        }
      }
      this.setRefreshState(syncing);
    },

    onRefresh: function() {
      if (!headerCursor.messagesSlice) {
        return;
      }

      // If this is the outbox, refresh has a different meaning.
      if (this.curFolder.type === 'outbox') {
        // Rather than refreshing the folder, we'll send the pending
        // outbox messages, and spin the refresh icon while doing so.
        this.toggleOutboxSyncingDisplay(true);
      }
      // If this is a normal folder...
      else {
        switch (headerCursor.messagesSlice.status) {
        // If we're still synchronizing, then the user is not well served by
        // queueing a refresh yet, let's just squash this.
        case 'new':
        case 'synchronizing':
          break;
        // If we fully synchronized, then yes, let us refresh.
        case 'synced':
          this._manuallyTriggeredSync = true;
          headerCursor.messagesSlice.refresh();
          break;
        // If we failed to talk to the server, then let's only do a refresh if
        // we know about any messages.  Otherwise let's just create a new slice
        // by forcing reentry into the folder.
        case 'syncfailed':
          if (headerCursor.messagesSlice.items.length) {
            headerCursor.messagesSlice.refresh();
          } else {
            this.showFolder(this.curFolder, /* force new slice */ true);
          }
          break;
        }
      }

      // Even if we're not actually viewing the outbox right now, we
      // should still attempt to sync any pending messages. It's fairly
      // harmless to kick off this job here, but it could also make
      // sense to do this at the backend level. There are a number of
      // cases where we might also want to  sendOutboxMessages() if
      // we follow up with a more comprehensive sync setting -- e.g. on
      // network change, on app startup, etc., so it's worth revisiting
      // this and how coupled we want incoming vs outgoing sync to be.
      model.api.sendOutboxMessages(model.account);

      this.setSoftkeyBar();
    },

    onStarMessages: function(arg) {
      let setValue = (arg === undefined) ? this.setAsStarred : arg;
      let op = model.api.markMessagesStarred(this.selectedMessages,
                                           setValue);
      this.setEditMode(false);
      toaster.toastOperation(op);
    },

    onMarkMessagesRead: function(arg) {
      let setValue = (arg === undefined) ? this.setAsRead : arg;
      let op = model.api.markMessagesRead(this.selectedMessages,
                                          setValue);
      this.setEditMode(false);
      toaster.toastOperation(op);
    },

    onDeleteMessages: function() {
      // TODO: Batch delete back-end mail api is not ready for IMAP now.
      //       Please verify this function under IMAP when api completed.

      if (this.selectedMessages.length === 0) {
        return;
      }
      let dialogConfig = {
        title: {
          id: 'confirm-dialog-title',
          args: {}
        },
        body: {
          id: 'message-multiedit-delete-confirm',
          args: {
            n: this.selectedMessages.length
          }
        },
        cancel: {
          l10nId: 'message-delete-cancel',
          priority: 1
        },
        confirm: {
          l10nId: 'message-edit-menu-delete',
          priority: 3,
          callback: () => {
            let op = model.api.deleteMessages(this.selectedMessages);
            this.updateSearchResult();
            toaster.toastOperation(op);
            this.setEditMode(false);
            if (!this.editMode && this.mode === 'search') {
              this.searchResultNeedUpdate = true;
            }
          }
        }
      };
      NavigationMap.showConfigDialog(dialogConfig);
    },

    updateSearchResult: function() {
      this.searchMessages =
        this.searchMessages - this.selectedMessages.length;
      mozL10n.setAttributes(this.searchResult, 'search-result',
      { num: this.searchMessages ? this.searchMessages : 0 });
    },
    /**
     * Show a warning that the given message is large.
     * Callback is called with cb(true|false) to continue.
     */
    showLargeMessageWarning: function(size, cb) {
      // TODO: If UX designers want the size included in the warning
      // message, add it here.
      let dialogConfig = {
        title: {
          id: 'confirm-dialog-title',
          args: {}
        },
        body: {
          id: 'message-large-message-confirm'
        },
        cancel: {
          l10nId: 'msg-large-message-cancel',
          priority: 1,
          callback: () => {
            cb(true);
          }
        },
        confirm: {
          l10nId: 'msg-large-message-ok',
          priority: 3,
          callback: () => {
            cb(true);
          }
        }
      };

      NavigationMap.showConfigDialog(dialogConfig);
    },

    onMoveMessages: function() {
      // TODO: Batch move back-end mail api is not ready now.
      //       Please verify this function when api landed.
      cards.folderSelector((folder) => {
        let op = model.api.moveMessages(this.selectedMessages, folder);
        this.updateSearchResult();
        toaster.toastOperation(op);
        this.setEditMode(false);
      }, (folder) => {
        return folder.isValidMoveTarget;
      }, this.curFolder);
    },

    _folderChanged: function(folder) {
      // It is possible that the notification of latest folder is fired
      // but in the meantime the foldersSlice could be cleared due to
      // a change in the current account, before this listener is called.
      // So skip this work if no foldersSlice, this method will be called
      // again soon.
      if (!model.foldersSlice) {
        return;
      }

      if (this.curFolder) {
        this.curFolder.sortType = 'date';
      }
      // Folder could have changed because account changed. Make sure
      // the cacheableFolderId is still set correctly.
      let inboxFolder = model.foldersSlice.getFirstFolderWithType('inbox');
      this.cacheableFolderId =
          model.account === model.acctsSlice.defaultAccount ?
                            inboxFolder.id : null;

      this.folder = folder;

      if (this.mode === 'nonsearch') {
        NavigationMap.currentMessageId = null;
        if (this.showFolder(folder)) {
          this._hideSearchBoxByScrolling();
        }
      } else {
        this.showSearch('', 'all');
      }
    },

    onJumptoHead: function() {
      this.vScroll.jumpToIndex(0);
      this.action = 'top';
    },

    onJumptoTail: function() {
      let mailCount = headerCursor.messagesSlice.headerCount;
      this.vScroll.jumpToIndex(mailCount - 1);
      this.action = 'bottom';
    },

    doScrollAction: function() {
      let action = this.action;
      if (!action) {
        return;
      }

      let elements = NavigationMap.getCurrentControl().elements;
      switch (action) {
        case 'top':
          let firstIndex;
          for (let i = 0; i < elements.length; i++) {
            if (!(elements[i].classList.contains('msg-messages-sync-more')) &&
                elements[i].dataset.index === '0') {
              firstIndex = i;
            }
          }
          NavigationMap.setFocus(firstIndex);
          break;
        case 'bottom':
          let lastIndex;
          let mailCount = headerCursor.messagesSlice.headerCount;
          for (let i = 0; i < elements.length; i++) {
            if (elements[i].classList.contains('msg-messages-sync-more')) {
              lastIndex = elements.length - 1;
            } else if (elements[i].dataset.index ===
                (mailCount - 1).toString()) {
              lastIndex = i;
            }
          }
          if (lastIndex) {
            NavigationMap.setFocus(lastIndex);
          }
          break;
        case 'new':
          let messageId = headerCursor.messagesSlice.items[0].id;
          if (messageId) {
            NavigationMap.setMessageListFocus(messageId, false);
          }
          break;
      }
      this.action = null;
    },

    onEmptyTrash: function() {
      function loadAllMessagesAndDelete() {
        let length = headerCursor.messagesSlice.items.length;
        let headerCount = headerCursor.messagesSlice.headerCount;
        if (length < headerCount) {
          headerCursor.messagesSlice.requestGrowth(1, true);
          headerCursor.messagesSlice.oncomplete = function() {
            loadAllMessagesAndDelete();
          };
        } else {
          let op = model.api.deleteMessages(headerCursor.messagesSlice.items);
          if (op) {
            toaster.toast({
              text: mozL10n.get('trash-emptied')
            });
          }
        }
      }

      let dialogConfig = {
        title: {
          id: 'confirm-dialog-title',
          args: {}
        },
        body: {
          id: 'empty-trash-confirm',
          args: {}
        },
        cancel: {
          l10nId: 'cancel',
          priority: 1
        },
        confirm: {
          l10nId: 'empty',
          priority: 3,
          callback: () => {
            loadAllMessagesAndDelete();
          }
        }
      };
      NavigationMap.showConfigDialog(dialogConfig);
    },

    die: function() {
      this.sliceEvents.forEach((type) => {
        let name = 'messages_' + type;
        headerCursor.removeListener(name, this[name]);
      });

      model.removeListener('folder', this._folderChanged);
      model.removeListener('newInboxMessages', this.onNewMail);
      model.removeListener('foldersSliceOnChange', this.onFoldersSliceChange);
      model.removeListener('backgroundSendStatus', this.onBackgroundSendStatus);
      headerCursor.removeListener('currentMessage', this.onCurrentMessage);
      headerCursor.removeListener('messageSorted', this.onMessageSorted);

      this.vScroll.destroy();

      window.removeEventListener('keydown', this.keydownHandler);
      window.removeEventListener('keydown', this.keydownForSearchHander);
      this.keydownHandler = null;
      this.keydownForSearchHander = null;
    },

    searchFilter: ["search-author", "search-to", "search-subject",
                   "search-body", "search-all"],

    initOption: function() {
      let optCompose = {
        name: 'Compose',
        l10nId: 'opt-compose',
        priority: 1,
        method: this.onCompose.bind(this)
      };
      let optSelect = {
        name: 'Select',
        l10nId: 'select',
        priority: 2
      };
      let optDeSelect = {
        name: 'Deselect',
        l10nId: 'deselect',
        priority: 2
      };
      let optMarkRead = {
        name: 'Mark as Read',
        l10nId: 'opt-mark-read',
        priority: 5,
        method: this.onMarkMessagesRead.bind(this)
      };
      let optAddFlag = {
        name: 'Add Flag',
        l10nId: 'opt-add-flag',
        priority: 5,
        method: this.onStarMessages.bind(this)
      };
      let optMove = {
        name: 'Move to Folder',
        l10nId: 'opt-move-message',
        priority: 5,
        method: this.onMoveMessages.bind(this)
      };
      let optDelete = {
        name: 'Delete',
        l10nId: 'opt-delete-message',
        priority: 5,
        method: this.onDeleteMessages.bind(this)
      };
      let optMultiSelect = {
        name: 'Select Multiple',
        l10nId: 'opt-multi-select',
        priority: 5,
        method: this.setEditModeStart.bind(this)
      };
      let optSearch = {
        name: 'Search',
        l10nId: 'opt-search',
        priority: 5,
        method: this.onSearchButton.bind(this)
      };
      let optShowFolders = {
        name: 'View Folders',
        l10nId: 'opt-folders',
        priority: 5,
        method: this.onShowFolders.bind(this)
      };
      let optSort = {
        name: 'Sort',
        l10nId: 'opt-sort',
        priority: 5,
        method: this.onSortMessages.bind(this)
      };
      let optSynchronize = {
        name: 'Synchronize',
        l10nId: 'opt-sync',
        priority: 5,
        method: this.onRefresh.bind(this)
      };
      let optSwitchAccount = {
        name: 'Switch Account',
        l10nId: 'opt-account',
        priority: 5,
        method: this.onSwitchAccount.bind(this)
      };
      let optSettings = {
        name: 'Settings',
        l10nId: 'opt-settings',
        priority: 5,
        method: this.onShowSettings.bind(this)
      };
      let optEmptyTrash = {
        name: 'Empty Trash',
        l10nId: 'opt-empty-trash',
        priority: 5,
        method: this.onEmptyTrash.bind(this)
      };

      /*---------sub-menu: edit-----------*/
      let optEdit = {
        id: 'edit',
        name: 'Edit',
        l10nId: 'opt-edit',
        priority: 5
      };
      let optSubMove = {
        fid:'edit',
        name: 'Move to Folder',
        l10nId: 'opt-move-message',
        priority: 5,
        method: this.onMoveMessages.bind(this)
      };
      let optSubMultiSelect = {
        fid:'edit',
        name: 'Select Multiple',
        l10nId: 'opt-multi-select',
        priority: 5,
        method: this.setEditModeStart.bind(this)
      };

      let optCancelEdit = {
        name: 'Cancel',
        l10nId: 'opt-cancel',
        priority: 1,
        method: this.setEditModeDone.bind(this)
      };
      let optCancelSearch = {
        name: 'Cancel',
        l10nId: 'opt-cancel',
        priority: 1,
        method: this.onCancelSearch.bind(this)
      };

      /*---------options for multi select page---------*/
      this.optionSelectRead = {
        name: 'Mark as Read',
        l10nId: 'opt-mark-read',
        priority: 5,
        method: () => {
          this.onMarkMessagesRead(true);
        }
      };
      this.optionSelectUnread = {
        name: 'Mark as Unread',
        l10nId: 'opt-mark-unread',
        priority: 5,
        method: () => {
          this.onMarkMessagesRead(false);
        }
      };
      this.optionSelectStar = {
        name: 'Add Flag',
        l10nId: 'opt-add-flag',
        priority: 5,
        method: () => {
          this.onStarMessages(true);
        }
      };
      this.optionSelectUnstar = {
        name: 'Remove Flag',
        l10nId: 'opt-remove-flag',
        priority: 5,
        method: () => {
          this.onStarMessages(false);
        }
      };
      this.optionSelectCancel = optCancelEdit;
      this.optionSelect = optSelect;
      this.optionDeselect = optDeSelect;
      this.optionCsk = optSelect;
      this.optionSelectMove = optMove;
      this.optionSelectDelete = optDelete;

      this.optionMain = [optCompose, optSelect, optDelete, optMarkRead,
        optAddFlag, optEdit, optSubMove, optSubMultiSelect, optSearch,
        optShowFolders, optSort, optSynchronize, optSwitchAccount, optSettings];
      this.optionNoSyncEmpty = [optCompose, optShowFolders,
        optSwitchAccount, optSettings];
      this.optionEmpty = [optCompose, optShowFolders, optSynchronize,
        optSwitchAccount, optSettings];
      this.loadMore = [optCompose, optSelect, optShowFolders, optSynchronize,
        optSwitchAccount, optSettings];
      this.optionSearch = [optCancelSearch, optSelect, optMarkRead,
        optAddFlag, optMove, optDelete, optMultiSelect, optSettings];
      this.optionSearchSingle = [optCancelSearch, optSelect, optMarkRead,
        optAddFlag, optMove, optDelete, optSettings];
      this.optionOutbox = [optCompose, optSelect, optDelete, optEdit,
        optSubMultiSelect, optSearch, optShowFolders, optSort, optSynchronize,
        optSwitchAccount, optSettings];
      this.optionOutboxSyncing = [optCompose, optSelect, optSearch,
        optShowFolders, optSort, optSwitchAccount, optSettings];
      this.optionOutboxSelect = [optCancelEdit, optSelect, optDelete];
      this.optionOutboxSearch = [optCancelSearch, optSelect, optDelete,
        optMultiSelect, optSettings];
      this.optionOutboxSearchSingle = [optCancelSearch, optSelect, optDelete,
        optSettings];
      this.optionLocalDrafts = [optCompose, optSelect, optDelete,
        optMarkRead, optAddFlag, optEdit, optSubMultiSelect, optSearch,
        optShowFolders, optSort, optSwitchAccount, optSettings];
      this.optionLocalDraftsSelect = [optCancelEdit, optSelect, optMarkRead,
        optAddFlag, optDelete];
      this.optionLocalDraftsSearch = [optCancelSearch, optSelect,
        optMarkRead, optAddFlag, optDelete, optMultiSelect, optSettings];
      this.optionLocalDraftsSearchSingle = [optCancelSearch, optSelect,
        optMarkRead, optAddFlag, optDelete, optSettings];
      this.optionTrash = [optCompose, optSelect, optEmptyTrash,
        optDelete, optMarkRead, optAddFlag, optEdit, optSubMove,
        optSubMultiSelect, optSearch, optShowFolders, optSort, optSynchronize,
        optSwitchAccount, optSettings];
      this.optMarkRead = optMarkRead;
      this.optAddFlag = optAddFlag;
      this.optEditDone = [optCancelEdit, this.optionCsk];
      this.optCancelSearch = optCancelSearch;
    },

    setSoftkeyBar: function() {
      let currentCard = cards.getCurrentCardType();
      // Do not update softkey bar when option menu shown
      if (!cards.isVisible(this) || !this.selectedMessages ||
           (currentCard !== 'message_list' &&
            currentCard !== 'message_list_search')) {
        //don't update softkeybar if invisible
        return;
      }

      let options = [];
      if (this.editMode) {
        if (this.selectedMessages.length > 0) {
          switch (model.folder.type) {
            case 'localdrafts':
              this.optionLocalDraftsSelect[1] = this.optionCsk;
              options = this.optionLocalDraftsSelect;
              break;
            case 'outbox':
              this.optionOutboxSelect[1] = this.optionCsk;
              options = this.optionOutboxSelect;
              break;
            default:
              options.push(this.optionSelectCancel, this.optionCsk);
              this.setReadBoth ? options.push(this.optionSelectRead,
                  this.optionSelectUnread) :
                  (this.setAllAsRead ? options.push(this.optionSelectRead) :
                   options.push(this.optionSelectUnread));
              this.setFlagBoth ? options.push(this.optionSelectStar,
                  this.optionSelectUnstar) :
                  (this.setAllAsStarred ? options.push(this.optionSelectStar) :
                   options.push(this.optionSelectUnstar));
              options.push(this.optionSelectMove, this.optionSelectDelete);
              break;
          }
        } else {
          options = this.optEditDone;
        }
      }
      else {
        if (this.mode === 'search') {
          if (this.selectedMessages.length > 0) {
            switch (model.folder.type) {
            case 'localdrafts':
              if (this.searchMessages === 1) {
                options = this.optionLocalDraftsSearchSingle;
              } else {
                options = this.optionLocalDraftsSearch;
              }
              break;
            case 'outbox':
              if (this.searchMessages === 1) {
                options = this.optionOutboxSearchSingle;
              } else {
                options = this.optionOutboxSearch;
              }
              break;
            default:
              if (this.searchMessages === 1) {
                options = this.optionSearchSingle;
              } else {
                options = this.optionSearch;
              }
              break;
            }
          } else {
            options = [this.optCancelSearch];
          }
        } else if (this.mode === 'nonsearch') {
          if (typeof window.option !== 'undefined') {
            if (window.option.menuVisible) {
              return;
            }
          }
          let itemLength = 0;
          if (headerCursor.hasOwnProperty('messagesSlice')) {
            itemLength = headerCursor.messagesSlice.items.length;
          }
          if (itemLength > 0 && this.selectedMessages.length > 0) {
            switch (model.folder.type) {
              case 'localdrafts':
                options = this.optionLocalDrafts;
                break;
              case 'outbox':
                if (this._outboxSyncing) {
                  options = this.optionOutboxSyncing;
                } else {
                  options = this.optionOutbox;
                }
                break;
              case 'trash':
                options = this.optionTrash;
                break;
              default:
                options = this.optionMain;
                break;
            }
          } else {
            if (model.folder && (model.folder.type === 'localdrafts' ||
                                 model.folder.type === 'outbox')) {
              options = this.optionNoSyncEmpty;
            } else {
              if (NavigationMap.currentMessageId === 'load-more') {
                options = this.loadMore;
              } else {
                options = this.optionEmpty;
              }
            }
          }
        }
      }

      NavigationMap.setSoftKeyBar(options);
    },

    onFocusChanged: function(queryChild, index, item) {
      console.log(this.localName + '.onFocusChanged, queryChild=' +
                  queryChild +'', index='' + index);
      if (this.className !== 'card center') {
        return;
      }

      if (index === 'jumpToHead') {
        this.onJumptoHead();
      } else if (index === 'jumpToTail') {
        this.onJumptoTail();
      }

      if (!this.editMode) {
        if(item && item.message && !item.message.isPlaceholderData) {
          this.selectedMessages = [item.message];
        } else {
          this.selectedMessages = [];
        }
      }
      this.selectedMessagesUpdated();
    },

    onHidden: function() {
      console.log(this.localName + '.onHidden');
      window.removeEventListener('keydown', this.keydownHandler);
      window.removeEventListener('keydown', this.keydownForSearchHander);
      this.keydownHandler = null;
      this.keydownForSearchHander = null;
    },

    onShowSettings: function() {
      cards.pushCard('settings_main', 'animate');
    },

    onSwitchAccount: function() {
      console.log(this.localName + '.onSwitchAccount');
      cards.pushCard('account_picker', 'animate');
    },

    onSortMessages: function () {
      console.log(this.localName + '.onSortMessages');

      require(['model', 'value_selector'], (model, ValueSelector) => {
        let optCancel = {
          name: 'Cancel',
          l10nId: 'opt-cancel',
          priority: 1,
          method: () => {
            this.sortSelector.hide();
          }
        };
        let optSelect = {
          name: 'Select',
          l10nId: 'select',
          priority: 2
        };
        let options = [optCancel, optSelect];

        if (!this.sortSelector) {
          let selectorTitle = mozL10n.get('sort-by-title');
          this.sortSelector = new ValueSelector(selectorTitle, [], options);
        } else {
          // clear list
          this.sortSelector.List.length = 0;
        }

        const sortType = [
          { id: 'date', label: 'sort-by-date' },
          { id: 'from', label: 'sort-by-from' },
          { id: 'to', label: 'sort-by-to' },
          { id: 'subject', label: 'sort-by-subject' }
        ].forEach((type) => {
          //addToList: label, depth, selectable, callback, selected, source
          this.sortSelector.addToList(mozL10n.get(type.label), //name
            0, //depth
            true, //isMatch(filter)
            () => { //handler of item click
              let item = this.sortSelector.getFocusedItem();
              this.sortSelector.hide();
              if (item && item.source) {
                if (this.curFolder.sortType !== item.source.id || this.curFolder.reSort) {
                  this.curFolder.reSort = false;
                  this.curFolder.sortType = item.source.id;
                  headerCursor.sortBy(item.source.id);
                  item.selected = true;
                }
                let sortName = mozL10n.get('value-name', {
                  name: mozL10n.get(item.source.label)
                });
                let sortMeg = mozL10n.get('toaster-sorted-by') + sortName;

                toaster.toast({
                  text: sortMeg
                });
              }
            },
            type.id === (this.curFolder.sortType || 'date'), //isSelected
            type);
        });

        this.sortSelector.show();
      });
    },

    onMessageSorted: function() {
      this.vScroll.setData(this.listFunc);
    },
    
    handleKeydown: function(evt) {
      switch (evt.key) {
        case 'Backspace':
          if (NavigationMap.configDialogShown()) {
            evt.preventDefault();
            CustomDialog.hide();
          } else {
            if (window.option.menuVisible === false && this.editMode) {
              evt.preventDefault();
              this.setEditModeDone();
            } else {
              if (window.option.menuVisible === false) {
                let bInbox = false;
                let foldersSlice = model.foldersSlice;
                let inboxFolder;
                if (foldersSlice && this.curFolder) {
                  inboxFolder = foldersSlice.getFirstFolderWithType('inbox');
                  if (inboxFolder === this.curFolder) {
                    bInbox = true;
                  }
                }
                if (!bInbox && this.curFolder) {
                  window.backToShowFolder = true;
                  evt.preventDefault();
                  cards.pushCard('folder_picker', 'animate');
                }
              }
            }
          }
          break;
      }
    },

    handleKeydownForSearch: function(evt) {
      let changeFilter = false;
      let activeElement = document.activeElement;
      let filterFocus = activeElement.classList.contains('filter-selector');

      switch (evt.key) {
        case 'ArrowLeft':
          if (filterFocus) {
            searchIndex = searchIndex === 0 ? 4 : --searchIndex;
            changeFilter = true;
          }
          break;
        case 'ArrowRight':
          if (filterFocus) {
            searchIndex = searchIndex === 4 ? 0 : ++searchIndex;
            changeFilter = true;
          }
          break;
        case 'Backspace':
          evt.preventDefault();
          let confirm = document.getElementById('confirm-dialog-container');
          if (confirm.innerHTML.length > 0) {
            CustomDialog.hide();
            option.show();
          } else {
            if (this.editMode && window.option.menuVisible === false) {
                this.setEditModeDone();
            } else {
              if (window.option.menuVisible === false) {
                this.onCancelSearch();
              }
            }
          }
          break;
      }
      if (changeFilter) {
        let filter = this.searchFilter[searchIndex];
        let item = this.searchHeader
                   .querySelector('[data-filter-name="'+ filter +'"]');
        let l10Id = item.firstElementChild.getAttribute('data-l10n-id');
        mozL10n.setAttributes(this.filterType, l10Id);
        item.click();
      }
    }
  }
];
});
