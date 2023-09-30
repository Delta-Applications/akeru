
/**
 * alameda 0.2.0-native-promise Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/alameda for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true, nomen: true, regexp: true */
/*global document, navigator, importScripts, Promise, setTimeout */

var requirejs, require, define;
(function (global, undef) {
    var topReq, dataMain, src, subPath,
        bootstrapConfig = requirejs || require,
        hasOwn = Object.prototype.hasOwnProperty,
        contexts = {},
        queue = [],
        currDirRegExp = /^\.\//,
        urlRegExp = /^\/|\:|\?|\.js$/,
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/;

    if (typeof requirejs === 'function') {
        return;
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return obj && hasProp(obj, prop) && obj[prop];
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

    //Allow getting a global that expressed in
    //dot notation, like 'a.b.c'.
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
            defined = {},
            waiting = {},
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            mapCache = {},
            requireDeferreds = [],
            deferreds = {},
            calledDefine = {},
            calledPlugin = {},
            loadCount = 0,
            startTime = (new Date()).getTime(),
            errCount = 0,
            trackedErrors = {},
            urlFetched = {},
            bundlesMap = {};

        //Uses a resolved promise to get an async resolution, but
        //using the microtask queue inside a promise, instead of
        //a setTimeout, so that other things in the main event
        //loop do not hold up the processing.
        var nextMicroTaskPass;
        (function () {
            

            var waitingResolving,
                waiting = [];

            function callWaiting() {
                waitingResolving = null;
                var w = waiting;
                waiting = [];
                while (w.length) {
                    w.shift()();
                }
            }

            nextMicroTaskPass = function (fn) {
                waiting.push(fn);
                if (!waitingResolving) {
                    waitingResolving = new Promise(function (resolve, reject) {
                        resolve();
                    }).then(callWaiting).catch(delayedError);
                }
            };
        }());

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
                    if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                        //End of the line. Keep at least one non-dot
                        //path segment at the front so it can be mapped
                        //correctly to disk. Otherwise, there is likely
                        //no path mapping for a path starting with '..'.
                        //This can still fail, but catches the most reasonable
                        //uses of ..
                        break;
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
            if (name && name.charAt(0) === '.') {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = name.split('/');
                    lastIndex = name.length - 1;

                    // If wanting node ID compatibility, strip .js from end
                    // of IDs. Have to do this here, and not in nameToUrl
                    // because node allows either .js or non .js to map
                    // to same file.
                    if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                        name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                    }

                    name = normalizedBaseParts.concat(name);
                    trimDots(name);
                    name = name.join('/');
                } else if (name.indexOf('./') === 0) {
                    // No baseName, so this is ID is resolved relative
                    // to baseUrl, pull off the leading dot.
                    name = name.substring(2);
                }
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
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
                //Peek to see if anon
                if (typeof queue[i][0] !== 'string') {
                    if (anonId) {
                        queue[i].unshift(anonId);
                        anonId = undef;
                    } else {
                        //Not our anon module, stop.
                        break;
                    }
                }
                args = queue.shift();
                id = args[0];
                i -= 1;

                if (!hasProp(defined, id) && !hasProp(waiting, id)) {
                    if (hasProp(deferreds, id)) {
                        main.apply(undef, args);
                    } else {
                        waiting[id] = args;
                    }
                }
            }

            //if get to the end and still have anonId, then could be
            //a shimmed dependency.
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
                    //Just return the module wanted. In this scenario, the
                    //deps arg is the module name, and second arg (if passed)
                    //is just the relName.
                    //Normalize module name, if it contains . or ..
                    name = makeMap(deps, relName, true).id;
                    if (!hasProp(defined, name)) {
                        throw new Error('Not loaded: ' + name);
                    }
                    return defined[name];
                } else if (deps && !Array.isArray(deps)) {
                    //deps is a config object, not an array.
                    cfg = deps;
                    deps = undef;

                    if (Array.isArray(callback)) {
                        //callback is an array, which means it is a dependency list.
                        //Adjust args if there are dependencies
                        deps = callback;
                        callback = errback;
                        errback = alt;
                    }

                    if (topLevel) {
                        //Could be a new context, so call returned require
                        return req.config(cfg)(deps, callback, errback);
                    }
                }

                //Support require(['a'])
                callback = callback || function () {};

                //Complete async to maintain expected execution semantics.
                nextMicroTaskPass(function () {
                    //Grab any modules that were defined after a
                    //require call.
                    takeQueue();
                    main(undef, deps || [], callback, errback, relName);
                });

                return req;
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

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (urlRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (Array.isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
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

                //Have a file extension alias, and it is not the
                //dots from a relative path.
                if (index !== -1 && (!isRelative || index > 1)) {
                    ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                    moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                }

                return req.nameToUrl(normalize(moduleNamePlusExt, relName), ext, true);
            };

            req.defined = function (id) {
                return hasProp(defined, makeMap(id, relName, true).id);
            };

            req.specified = function (id) {
                id = makeMap(id, relName, true).id;
                return hasProp(defined, id) || hasProp(deferreds, id);
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
            var name = d.map.id,
                ret = d.factory.apply(defined[name], d.values);

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
                //Remove the require deferred from the list to
                //make cycle searching faster. Do not need to track
                //it anymore either.
                requireDeferreds.splice(requireDeferreds.indexOf(d), 1);
            }
            resolve(name, d, ret);
        }

        //This method is attached to every module deferred,
        //so the "this" in here is the module deferred object.
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

        function makeDefer(name) {
            var d = {};
            d.promise = new Promise(function (resolve, reject) {
                d.resolve = resolve;
                d.reject = reject;
            });
            d.map = name ? makeMap(name, null, true) : {};
            d.depCount = 0;
            d.depMax = 0;
            d.values = [];
            d.depDefined = [];
            d.depFinished = depFinished;
            if (d.map.pr) {
                //Plugin resource ID, implicitly
                //depends on plugin. Track it in deps
                //so cycle breaking can work
                d.deps = [makeMap(d.map.pr)];
            }
            return d;
        }

        function getDefer(name) {
            var d;
            if (name) {
                d = hasProp(deferreds, name) && deferreds[name];
                if (!d) {
                    d = deferreds[name] = makeDefer(name);
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

            //Do the fail at the end to catch errors
            //in the then callback execution.
            callDep(depMap, relName).then(function (val) {
                d.depFinished(val, i);
            }, makeErrback(d, depMap.id)).catch(makeErrback(d, d.map.id));
        }

        function makeLoad(id) {
            var fromTextCalled;
            function load(value) {
                //Protect against older plugins that call load after
                //calling load.fromText
                if (!fromTextCalled) {
                    resolve(id, getDefer(id), value);
                }
            }

            load.error = function (err) {
                getDefer(id).reject(err);
            };

            load.fromText = function (text, textAlt) {
                /*jslint evil: true */
                var d = getDefer(id),
                    map = makeMap(makeMap(id).n),
                   plainId = map.id;

                fromTextCalled = true;

                //Set up the factory just to be a return of the value from
                //plainId.
                d.factory = function (p, val) {
                    return val;
                };

                //As of requirejs 2.1.0, support just passing the text, to reinforce
                //fromText only being called once per resource. Still
                //support old style of passing moduleName but discard
                //that moduleName in favor of the internal ref.
                if (textAlt) {
                    text = textAlt;
                }

                //Transfer any config to this other module.
                if (hasProp(config.config, id)) {
                    config.config[plainId] = config.config[id];
                }

                try {
                    req.exec(text);
                } catch (e) {
                    reject(d, new Error('fromText eval for ' + plainId +
                                    ' failed: ' + e));
                }

                //Execute any waiting define created by the plainId
                takeQueue(plainId);

                //Mark this as a dependency for the plugin
                //resource
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

                    //Ask for the deferred so loading is triggered.
                    //Do this before loading, since loading is sync.
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
                            pathConfig = getOwn(config.paths, id),
                            d = getOwn(deferreds, id);
                        if (pathConfig && Array.isArray(pathConfig) && pathConfig.length > 1) {
                            script.parentNode.removeChild(script);
                            //Pop off the first array value, since it failed, and
                            //retry
                            pathConfig.shift();
                            d.map = makeMap(id);
                            load(d.map);
                        } else {
                            err = new Error('Load failed: ' + id + ': ' + script.src);
                            err.requireModules = [id];
                            getDefer(id).reject(err);
                        }
                    }, false);

                    script.src = url;

                    document.head.appendChild(script);
                };

        function callPlugin(plugin, map, relName) {
            plugin.load(map.n, makeRequire(relName), makeLoad(map.id), {});
        }

        callDep = function (map, relName) {
            var args, bundleId,
                name = map.id,
                shim = config.shim[name];

            if (hasProp(waiting, name)) {
                args = waiting[name];
                delete waiting[name];
                main.apply(undef, args);
            } else if (!hasProp(deferreds, name)) {
                if (map.pr) {
                    //If a bundles config, then just load that file instead to
                    //resolve the plugin, as it is built into that bundle.
                    if ((bundleId = getOwn(bundlesMap, name))) {
                        map.url = req.nameToUrl(bundleId);
                        load(map);
                    } else {
                        return callDep(makeMap(map.pr)).then(function (plugin) {
                            //Redo map now that plugin is known to be loaded
                            var newMap = makeMap(name, relName, true),
                                newId = newMap.id,
                                shim = getOwn(config.shim, newId);

                            //Make sure to only call load once per resource. Many
                            //calls could have been queued waiting for plugin to load.
                            if (!hasProp(calledPlugin, newId)) {
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

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
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

            var plugin, url, parts, prefix, result,
                cacheKey = name + ' & ' + (relName || '') + ' & ' + !!applyMap;

            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];

            if (!prefix && hasProp(mapCache, cacheKey)) {
                return mapCache[cacheKey];
            }

            if (prefix) {
                prefix = normalize(prefix, relName, applyMap);
                plugin = hasProp(defined, prefix) && defined[prefix];
            }

            //Normalize according
            if (prefix) {
                if (plugin && plugin.normalize) {
                    name = plugin.normalize(name, makeNormalize(relName));
                } else {
                    name = normalize(name, relName, applyMap);
                }
            } else {
                name = normalize(name, relName, applyMap);
                parts = splitPrefix(name);
                prefix = parts[0];
                name = parts[1];

                url = req.nameToUrl(name);
            }

            //Using ridiculous property names for space reasons
            result = {
                id: prefix ? prefix + '!' + name : name, //fullName
                n: name,
                pr: prefix,
                url: url
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
                        dep = !hasProp(handlers, depId) && getDefer(depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
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
            var err,
                notFinished = [],
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (startTime + waitInterval) < (new Date()).getTime();

            if (loadCount === 0) {
                //If passed in a deferred, it is for a specific require call.
                //Could be a sync case that needs resolution right away.
                //Otherwise, if no deferred, means it was the last ditch
                //timeout-based check, so check all waiting require deferreds.
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

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if (expired) {
                //If wait time expired, throw error of unloaded modules.
                eachProp(deferreds, function (d) {
                    if (!d.finished) {
                        notFinished.push(d.map.id);
                    }
                });
                err = new Error('Timeout for modules: ' + notFinished);
                err.requireModules = notFinished;
                req.onError(err);
            } else if (loadCount || requireDeferreds.length) {
                //Something is still waiting to load. Wait for it, but only
                //if a later check is not already scheduled. Using setTimeout
                //because want other things in the event loop to happen,
                //to help in dependency resolution, and this is really a
                //last ditch check, mostly for detecting timeouts (cycles
                //should come through the main() use of check()), so it can
                //wait a bit before doing the final check.
                if (!checkingLater) {
                    checkingLater = true;
                    setTimeout(function () {
                        checkingLater = false;
                        check();
                    }, 70);
                }
            }
        }

        //Used to break out of the promise try/catch chains.
        function delayedError(e) {
            setTimeout(function () {
                if (!e.dynaId || !trackedErrors[e.dynaId]) {
                    trackedErrors[e.dynaId] = true;
                    req.onError(e);
                }
            });
        }

        main = function (name, deps, factory, errback, relName) {
            //Only allow main calling once per module.
            if (name && hasProp(calledDefine, name)) {
                return;
            }
            calledDefine[name] = true;

            var d = getDefer(name);

            //This module may not have dependencies
            if (deps && !Array.isArray(deps)) {
                //deps is not an array, so probably means
                //an object literal or factory function for
                //the value. Adjust args.
                factory = deps;
                deps = [];
            }

            d.promise.catch(errback || delayedError);

            //Use name if no relName
            relName = relName || name;

            //Call the factory to define the module, if necessary.
            if (typeof factory === 'function') {

                if (!deps.length && factory.length) {
                    //Remove comments from the callback string,
                    //look for require calls, and pull them into the dependencies,
                    //but only if there are function args.
                    factory
                        .toString()
                        .replace(commentRegExp, '')
                        .replace(cjsRequireRegExp, function (match, dep) {
                            deps.push(dep);
                        });

                    //May be a CommonJS thing even without require calls, but still
                    //could use exports, and module. Avoid doing exports and module
                    //work though if it just needs require.
                    //REQUIRES the function to expect the CommonJS variables in the
                    //order listed below.
                    deps = (factory.length === 1 ?
                            ['require'] :
                            ['require', 'exports', 'module']).concat(deps);
                }

                //Save info for use later.
                d.factory = factory;
                d.deps = deps;

                d.depending = true;
                deps.forEach(function (depName, i) {
                    var depMap;
                    deps[i] = depMap = makeMap(depName, relName, true);
                    depName = depMap.id;

                    //Fast path CommonJS standard dependencies.
                    if (depName === "require") {
                        d.values[i] = handlers.require(name);
                    } else if (depName === "exports") {
                        //CommonJS module spec 1.1
                        d.values[i] = handlers.exports(name);
                        d.usingExports = true;
                    } else if (depName === "module") {
                        //CommonJS module spec 1.1
                        d.values[i] = d.cjsModule = handlers.module(name);
                    } else if (depName === undefined) {
                        d.values[i] = undefined;
                    } else {
                        waitForDep(depMap, relName, d, i);
                    }
                });
                d.depending = false;

                //Some modules just depend on the require, exports, modules, so
                //trigger their definition here if so.
                if (d.depCount === d.depMax) {
                    defineModule(d);
                }
            } else if (name) {
                //May just be an object definition for the module. Only
                //worry about defining if have a module name.
                resolve(name, d, factory);
            }

            startTime = (new Date()).getTime();

            if (!name) {
                check(d);
            }
        };

        req = makeRequire(null, true);

        /*
         * Just drops the config on the floor, but returns req in case
         * the config return value is used.
         */
        req.config = function (cfg) {
            if (cfg.context && cfg.context !== contextName) {
                return newContext(cfg.context).config(cfg);
            }

            //Since config changed, mapCache may not be valid any more.
            mapCache = {};

            //Make sure the baseUrl ends in a slash.
            if (cfg.baseUrl) {
                if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                    cfg.baseUrl += '/';
                }
            }

            //Save off the paths and packages since they require special processing,
            //they are additive.
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

            //Reverse map the bundles
            if (cfg.bundles) {
                eachProp(cfg.bundles, function (value, prop) {
                    value.forEach(function (v) {
                        if (v !== prop) {
                            bundlesMap[v] = prop;
                        }
                    });
                });
            }

            //Merge shim
            if (cfg.shim) {
                eachProp(cfg.shim, function (value, id) {
                    //Normalize the structure
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

            //Adjust packages if necessary.
            if (cfg.packages) {
                cfg.packages.forEach(function (pkgObj) {
                    var location, name;

                    pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;

                    name = pkgObj.name;
                    location = pkgObj.location;
                    if (location) {
                        config.paths[name] = pkgObj.location;
                    }

                    //Save pointer to main module ID for pkg name.
                    //Remove leading dot in main, so main paths are normalized,
                    //and remove any trailing .js, since different package
                    //envs have different conventions: some use a module name,
                    //some use a file name.
                    config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                 .replace(currDirRegExp, '')
                                 .replace(jsSuffixRegExp, '');
                });
            }

            //If a deps array or a config callback is specified, then call
            //require with those args. This is useful when require is defined as a
            //config object before require.js is loaded.
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
            deferreds: deferreds
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
        queue.push([].slice.call(arguments, 0));
    };

    define.amd = {
        jQuery: true
    };

    if (bootstrapConfig) {
        topReq.config(bootstrapConfig);
    }

    //data-main support.
    if (topReq.isBrowser && !contexts._.config.skipDataMain) {
        dataMain = document.querySelectorAll('script[data-main]')[0];
        dataMain = dataMain && dataMain.getAttribute('data-main');
        if (dataMain) {
            //Strip off any trailing .js since dataMain is now
            //like a module name.
            dataMain = dataMain.replace(jsSuffixRegExp, '');

            if (!bootstrapConfig || !bootstrapConfig.baseUrl) {
                //Pull off the directory of data-main for use as the
                //baseUrl.
                src = dataMain.split('/');
                dataMain = src.pop();
                subPath = src.length ? src.join('/')  + '/' : './';

                topReq.config({baseUrl: subPath});
            }

            topReq([dataMain]);
        }
    }
}(this));

define("ext/alameda", function(){});

// this code is from test-agent might use native dom events
// or something else in the future to replace this.
define('responder',['require','exports','module'],function(require, exports, module) {


/**
 * @param {Object} list of events to add onto responder.
 */
function Responder(events) {
  this._$events = Object.create(null);

  // Buffer for emitWhenListener that hangs onto events dispatched for topics
  // no one is currently listening for. Inspired by email's function
  // of the same name.
  this.buffer = {};

  if (typeof(events) !== 'undefined') {
    this.addEventListener(events);
  }
}
module.exports = Responder;

/**
 * Stringifies request to websocket
 *
 *
 * @param {String} command command name.
 * @param {Object} data object to be sent over the wire.
 * @return {String} json object.
 */
Responder.stringify = function stringify(command, data) {
  return JSON.stringify([command, data]);
};

/**
 * Parses request from WebSocket.
 *
 * @param {String} json json string to translate.
 * @return {Object} ex: { event: 'test', data: {} }.
 */
Responder.parse = function parse(json) {
  var data;
  try {
    data = (json.forEach) ? json : JSON.parse(json);
  } catch (e) {
    throw new Error('Could not parse json: "' + json + '"');
  }

  return data;
};

Responder.prototype = {
  parse: Responder.parse,
  stringify: Responder.stringify,

  /**
   * Events on this instance
   *
   * @type Object
   */
  events: null,

  /**
   * Recieves json string event and dispatches an event.
   *
   * @param {String|Object} json data object to respond to.
   * @param {String} json.event event to emit.
   * @param {Object} json.data data to emit with event.
   * @param {Object} [params] option number of params to pass to emit.
   * @return {Object} result of WebSocketCommon.parse.
   */
  respond: function respond(json) {
    var event = Responder.parse(json);
    var args = Array.prototype.slice.call(arguments).slice(1);
    this.emit.apply(this, event.concat(args));
    return event;
  },

  /**
   * Adds an event listener to this object.
   *
   * @param {String} type event name.
   * @param {Function} callback event callback.
   */
  addEventListener: function addEventListener(type, callback) {
    var event;

    if (typeof(callback) === 'undefined' && typeof(type) === 'object') {
      for (event in type) {
        if (type.hasOwnProperty(event)) {
          this.addEventListener(event, type[event]);
        }
      }

      return this;
    }

    if (!(type in this._$events)) {
      this._$events[type] = [];
    }

    this._$events[type].push(callback);
    return this.flushTopicBuffer(type);
  },

  /**
   * Adds an event listener which will
   * only fire once and then remove itself.
   *
   *
   * @param {String} type event name.
   * @param {Function} callback fired when event is emitted.
   */
  once: function once(type, callback) {
    var self = this;
    function onceCb() {
      /*jshint validthis:true */
      self.removeEventListener(type, onceCb);
      callback.apply(this, arguments);
    }

    this.addEventListener(type, onceCb);
    return this.flushTopicBuffer(type);
  },

  flushTopicBuffer: function flushTopicBuffer(topic) {
    if (!(topic in this.buffer)) {
      // Nothing to flush.
      return this;
    }

    this.buffer[topic].forEach(args => {
      args.unshift(topic);
      this.emit.apply(this, args);
    });

    return this;
  },

  /**
   * Emits an event.
   *
   * Accepts any number of additional arguments to pass unto
   * event listener.
   *
   * @param {String} eventName name of the event to emit.
   * @param {Object} [arguments] additional arguments to pass.
   */
  emit: function emit() {
    var args = Array.prototype.slice.call(arguments),
        event = args.shift(),
        eventList,
        self = this;

    if (event in this._$events) {
      eventList = this._$events[event];

      eventList.forEach(function(callback) {
        if (typeof(callback) === 'object' && callback.handleEvent) {
          callback.handleEvent({ type: event, data: args });
        } else {
          callback.apply(self, args);
        }
      });
    }

    return this;
  },

  emitWhenListener: function emitWhenListener() {
    var args = Array.prototype.slice.call(arguments);
    var event = args.shift();

    if (event in this._$events && this._$events[event].length) {
      // Someone is already listening for this event, so this is just
      // a regular old emit.
      return this.emit.apply(this, arguments);
    }

    if (!(event in this.buffer)) {
      this.buffer[event] = [];
    }

    // Now just push the call info onto the topic buffer.
    this.buffer[event].push(args);
    return this;
  },

  /**
   * Removes all event listeners for a given event type
   *
   *
   * @param {String} event event type to remove.
   */
  removeAllEventListeners: function removeAllEventListeners(name) {
    if (name in this._$events) {
      //reuse array
      this._$events[name].length = 0;
    }

    return this;
  },

  /**
   * Removes a single event listener from a given event type
   * and callback function.
   *
   *
   * @param {String} eventName event name.
   * @param {Function} callback same instance of event handler.
   */
  removeEventListener: function removeEventListener(name, callback) {
    var i, length, events;

    if (!(name in this._$events)) {
      return false;
    }

    events = this._$events[name];

    for (i = 0, length = events.length; i < length; i++) {
      if (events[i] && events[i] === callback) {
        events.splice(i, 1);
        return true;
      }
    }

    return false;
  }

};

Responder.prototype.on = Responder.prototype.addEventListener;
Responder.prototype.off = Responder.prototype.removeEventListener;

});

define('debug',['require','exports','module'],function(require, exports, module) {


module.exports = function(name) {
  return function() {
    var args = Array.prototype.slice.call(arguments).map(JSON.stringify);
    args.unshift('[calendar] ');
    args.unshift(name);
    // console.log.apply(console, args);
  };
};

});

define('worker/thread',['require','exports','module','responder','debug'],function(require, exports, module) {


var Responder = require('responder');
var debug = require('debug')('worker/thread');

function Thread(worker) {
  Responder.call(this);
  this.worker = worker;
  this.roles = {};

  this._initEvents();
}
module.exports = Thread;

Thread.prototype = {
  __proto__: Responder.prototype,

  send: function() {
    this.worker.postMessage(Array.prototype.slice.call(arguments));
  },

  addRole: function(name) {
    this.roles[name] = new Responder();
  },

  _remoteEmitter: function(id) {
    var self = this;
    return {
      emit: function emitRemote() {
        var args = Array.prototype.slice.call(arguments);
        self.worker.postMessage([id + ' stream'].concat(args));
      }
    };
  },

  _initEvents: function() {
    var self = this;

    debug('Will listen for messages from the main thread...');
    this.on('_dispatch', function(data) {
      // data.id
      // data.type
      // data.role
      // data.payload
      var callback = self._requestCallback.bind(
        self, data.id
      );

      if (data.role) {
        if (data.role in self.roles) {
          if (data.type && data.type === 'stream') {
            self.roles[data.role].respond(
              data.payload,
              self._remoteEmitter(data.id),
              callback
            );
          } else {
            self.roles[data.role].respond(
              data.payload, callback
            );
          }
        } else {
          // TODO: respond with error
          debug('ERROR: ' + data.role + ' is not available.');
        }
      } else {
        self.respond(data.payload, callback);
      }
    });
  },

  _wrapError: function(err) {
    var errorObject = {};

    errorObject.stack = err.stack || '';
    errorObject.message = err.message || err.toString();
    errorObject.type = err.type || 'Error';
    errorObject.constructorName = err.constructor.name || 'Error';

    if (err.name) {
      errorObject.name = err.name;
    }

    if (err.code) {
      errorObject.code = err.code;
    }

    return errorObject;
  },

  _requestCallback: function(id) {
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift(id + ' end');

    if (args[1] instanceof Error) {
      args[1] = this._wrapError(args[1]);
    }

    this.worker.postMessage(args);
  },

  console: function console(name) {
    return {
      log: function() {
        return postMessage(['log', {
          name: name,
          message: Array.prototype.slice.call(arguments).join(', ')
        }]);
      },
      error: function() {
        return postMessage(['error', {
          name: name,
          message: Array.prototype.slice.call(arguments).join(', ')
        }]);
      }
    };
  }
};

});

/**
 * The way that the current caldav library works,
 * we need to preconfigure some global state :/.
 */
define('worker/initialize',['require','exports','module','./thread','debug'],function(require, exports, module) {


var Thread = require('./thread');
var debug = require('debug')('worker/initialize');

self.window = self;

module.exports = function() {
  var thread = self.thread = new Thread(window);
  thread.addRole('caldav');
  window.console = new thread.console('worker');
  require(['service/caldav'], (CaldavService) => {
    // Lazily loaded so that we can prime environment first.
    debug('Will create new caldav service...');
    self.caldav = new CaldavService(thread.roles.caldav);
  });
};

});



require.config({
  baseUrl: '/js',
  waitSeconds: 60,
  paths: {
    shared: '/shared/js'
  },
  shim: {
    'ext/caldav': {
      deps: ['worker/initialize'],
      exports: 'Caldav'
    },
    'ext/ical': {
      deps: ['worker/initialize'],
      exports: 'ICAL'
    }
  }
});

self.addEventListener('message', function onMessage(msg) {
  if (typeof(caldav) !== 'undefined') {
    return self.thread.respond(msg.data);
  }

  // Try again in a little bit since the worker may not be ready...
  setTimeout(function() {
    onMessage(msg);
  }, 10);
});

require(['worker/initialize'], initialize => initialize());

define("caldav_worker", function(){});

define('service/ical_recur_expansion',['require','exports','module','ext/ical'],function(require, exports, module) {


var ICAL = require('ext/ical');

module.exports = {
  /**
   * Maximum iterations must be > 0 && < Infinity.
   * Lower values are probably better as we can show progress
   * for multiple events rather then complete one long recurring
   * event after another...
   */
  forEachLimit: 200,

  _isDone: function(last, sent, max) {
    if (last && max && last.compare(max) > 0) {
      return true;
    } else if (sent < this.forEachLimit) {
      return false;
    }

    return true;
  },

  /**
   * Iterates through a recur expansion instance.
   * Gracefully handles existing iterators (including failures).
   * Will fallback to complete re-expansion when necessary.
   *
   * NOTE: This method intentionally does not accept the "forEach"
   * function as the final argument to indicate it does not follow
   * the NodeJS example...
   *
   * minDate is always exclusive
   * maxDate is not strict and may include one occurrence beyond.
   *
   * @param {ICAL.Event} event complete event.
   * @param {Null|Object} iterator or nothing.
   * @param {Function} forEach receives [nextDate].
   * @param {ICAL.Time|Null} minDate minimum time (defaults to start).
   * @param {ICAL.Time|Null} maxDate maximum date (defaults to none).
   * @return {ICAL.RecurExpansion} iterator.
   */
  forEach: function(event, iterator, each, min, max) {
    // if there is no iterator create one...
    if (!iterator) {
      return this._beginIteration(event, each, min, max);
    }

    var iter;

    try {
      iter = this._resumeIteration(event, iterator, each, min, max);
    } catch (e) {
      console.error('Iteration Error: ' + e.toString());
      iter = this._beginIteration(event, each, min, max);
    }

    return iter;
  },

  _resumeIteration: function(event, iterator, each, min, max) {
    if (!(iterator instanceof ICAL.RecurExpansion)) {
      iterator = new ICAL.RecurExpansion(iterator);
    }

    this._iterate(event, iterator, each, min, max);
    return iterator;
  },

  _beginIteration: function(event, each, min, max) {
    var iterator = event.iterator();
    this._iterate(event, iterator, each, min, max);

    return iterator;
  },

  _iterate: function(event, iterator, each, min, max) {
    // keep track of the iterations
    var sent = 0;
    var current;

    do {
      current = iterator.next();

      if (!current) {
        break;
      }

      if (!min || current.compare(min) > 0) {
        // sent should be inside the loop to guard against
        // the possibility that the resume functionality breaking.
        if (!this._isDone(current, sent, max)) {
          sent++;
          each(current);
        } else {
          iterator.ruleIterators[0].last = current;
        }
      }

    } while (!this._isDone(current, sent, max));
  }
};

});

define('presets',{
  "google": {
    "providerType": "Caldav",
    "group": "remote",
    "authenticationType": "oauth2",
    "apiCredentials": {
      "tokenUrl": "https://accounts.google.com/o/oauth2/token",
      "authorizationUrl": "https://accounts.google.com/o/oauth2/auth",
      "user_info": {
        "url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "field": "email"
      },
      "client_secret": "nIJTZJiZAgH5_TPDajSmaK26",
      "client_id": "82056718548-pngdg21p12a16hskf2mf5b8mfa60sg97.apps.googleusercontent.com",
      "scope": "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
      "redirect_uri": "http://localhost"
    },
    "options": {
      "domain": "https://apidata.googleusercontent.com",
      "entrypoint": "/caldav/v2/",
      "providerType": "Caldav"
    }
  },
  "activesync": {
    "providerType": "Caldav",
    "group": "remote",
    "authenticationType": "activesync",
    "options": {
      "providerType": "Caldav"
    }
  },
  "yahoo": {
    "providerType": "Caldav",
    "group": "remote",
    "options": {
      "domain": "https://caldav.calendar.yahoo.com",
      "entrypoint": "/",
      "providerType": "Caldav",
      "user": "@yahoo.com",
      "usernameType": "email"
    }
  },
  "caldav": {
    "providerType": "Caldav",
    "group": "remote",
    "options": {
      "domain": "",
      "entrypoint": "",
      "providerType": "Caldav"
    }
  },
  "local": {
    "singleUse": true,
    "providerType": "Local",
    "group": "local",
    "options": {
      "providerType": "Local"
    }
  }
});
define('extend',['require','exports','module'],function(require, exports, module) {


module.exports = function(target, input) {
  for (var key in input) {
    if (hasOwnProperty.call(input, key)) {
      target[key] = input[key];
    }
  }

  return target;
};

});

//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

(function() {
  var _global = this;

  // Unique ID creation requires a high quality random # generator.  We feature
  // detect to determine the best RNG source, normalizing to a function that
  // returns 128-bits of randomness, since that's what's usually required
  var _rng;

  // Node.js crypto-based RNG - http://nodejs.org/docs/v0.6.2/api/crypto.html
  //
  // Moderately fast, high quality
  if (typeof(_global.require) == 'function' && typeof(module) != 'undefined' && module.exports) {
    try {
      var _rb = _global.require('crypto').randomBytes;
      _rng = _rb && function() {return _rb(16);};
    } catch(e) {}
  }

  if (!_rng && _global.crypto && crypto.getRandomValues) {
    // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
    //
    // Moderately fast, high quality
    var _rnds8 = new Uint8Array(16);
    _rng = function whatwgRNG() {
      crypto.getRandomValues(_rnds8);
      return _rnds8;
    };
  }

  if (!_rng) {
    // Math.random()-based (RNG)
    //
    // If all else fails, use Math.random().  It's fast, but is of unspecified
    // quality.
    var  _rnds = new Array(16);
    _rng = function() {
      for (var i = 0, r; i < 16; i++) {
        if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
        _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }

      return _rnds;
    };
  }

  // Buffer class to use
  var BufferClass = typeof(_global.Buffer) == 'function' ? _global.Buffer : Array;

  // Maps for number <-> hex string conversion
  var _byteToHex = [];
  var _hexToByte = {};
  for (var i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }

  // **`parse()` - Parse a UUID into it's component bytes**
  function parse(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = _hexToByte[oct];
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  }

  // **`unparse()` - Convert UUID byte array (ala parse()) into a string**
  function unparse(buf, offset) {
    var i = offset || 0, bth = _byteToHex;
    return  bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]];
  }

  // **`v1()` - Generate time-based UUID**
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html

  // random #'s we need to init node and clockseq
  var _seedBytes = _rng();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  function v1(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || [];

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    var msecs = options.msecs != null ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    var nsecs = options.nsecs != null ? options.nsecs : _lastNSecs + 1;

    // Time since last uuid creation (in msecs)
    var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq == null) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs == null) {
      nsecs = 0;
    }

    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // `time_low`
    var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // `time_mid`
    var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : unparse(b);
  }

  // **`v4()` - Generate random UUID**

  // See https://github.com/broofa/node-uuid for API details
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;

    if (typeof(options) == 'string') {
      buf = options == 'binary' ? new BufferClass(16) : null;
      options = null;
    }
    options = options || {};

    var rnds = options.random || (options.rng || _rng)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || unparse(rnds);
  }

  // Export public API
  var uuid = v4;
  uuid.v1 = v1;
  uuid.v4 = v4;
  uuid.parse = parse;
  uuid.unparse = unparse;
  uuid.BufferClass = BufferClass;

  if (typeof define === 'function' && define.amd) {
    // Publish as AMD module
    define('ext/uuid',[],function() {return uuid;});
  } else if (typeof(module) != 'undefined' && module.exports) {
    // Publish as node.js module
    module.exports = uuid;
  } else {
    // Publish as global (in browsers)
    var _previousRoot = _global.uuid;

    // **`noConflict()` - (browser only) to reset global 'uuid' var**
    uuid.noConflict = function() {
      _global.uuid = _previousRoot;
      return uuid;
    };

    _global.uuid = uuid;
  }
}).call(this);

define('service/caldav',['require','exports','module','ext/caldav','ext/ical','./ical_recur_expansion','presets','responder','debug','extend','ext/uuid'],function(require, exports, module) {


var Caldav = require('ext/caldav');
var ICAL = require('ext/ical');
var IcalRecurExpansion = require('./ical_recur_expansion');
var Presets = require('presets');
var Responder = require('responder');
var debug = require('debug')('service/caldav');
var extend = require('extend');
var uuid = require('ext/uuid');

/* TODO: ugly hack to enable system XHR fix upstream in Caldav lib */
var xhrOpts = {
  /** system is required for cross domain XHR  */
  mozSystem: true,
  /** mozAnon is required to avoid system level popups on 401 status */
  mozAnon: true,
  /** enables use of mozilla only streaming api's when available */
  useMozChunkedText: true
};

Caldav.Xhr.prototype.globalXhrOptions = xhrOpts;

function Service(service) {
  Responder.call(this);

  this.service = service;
  this._initEvents();
}
module.exports = Service;

Service.prototype = {
  __proto__: Responder.prototype,

  /**
   * See: http://tools.ietf.org/html/rfc5545#section-3.7.3
   */
  icalProductId: '-//Mozilla//FirefoxOS',

  /**
   * See: http://tools.ietf.org/html/rfc5545#section-3.7.4
   */
  icalVersion: '2.0',

  _initEvents: function() {
    var events = [
      'noop',
      'getAccount',
      'findCalendars',
      'getCalendar',
      'streamEvents',
      'expandComponents',
      'expandRecurringEvent',
      'deleteEvent',
      'updateEvent',
      'createEvent'
    ];

    debug('Will listen for worker events...');
    events.forEach(function(e) {
      this.service.on(e, this);
    }, this);
  },

  handleEvent: function(e) {
    debug('Worker will fulfill', e.type, 'request...');
    this[e.type].apply(this, e.data);
  },

  /**
   * Builds an Caldav connection from an account model object.
   */
  _createConnection: function(account) {
    var params = extend({}, account);
    var preset = Presets[account.preset];

    if (
        preset &&
        preset.authenticationType &&
        preset.apiCredentials
    ) {
      switch (preset.authenticationType) {
        case 'oauth2':
          params.httpHandler = 'oauth2';
          // shallow copy the apiCredentials on the preset
          params.apiCredentials = extend({}, preset.apiCredentials);
          // the url in this case will always be tokenUrl
          params.apiCredentials.url = preset.apiCredentials.tokenUrl;
          break;
      }
    }

    var connection = new Caldav.Connection(params);
    return connection;
  },

  _requestHome: function(connection, url) {
    return new Caldav.Request.CalendarHome(
      connection,
      { url: url }
    );
  },

  _requestCalendars: function(connection, url) {
    var Finder = Caldav.Request.Resources;
    var Resource = Caldav.Resources.Calendar;

    var req = new Finder(connection, { url: url });

    req.addResource('calendar', Resource);
    req.prop(['ical', 'calendar-color']);
    req.prop(['caldav', 'calendar-description']);
    req.prop('current-user-privilege-set');
    req.prop('displayname');
    req.prop('resourcetype');
    req.prop(['calserver', 'getctag']);

    return req;
  },

  _requestEvents: function(connection, cal, options) {
    var Resource = Caldav.Resources.Calendar;
    var remoteCal = new Resource(connection, cal);
    var query = remoteCal.createQuery();

    query.prop('getetag');

    // only return VEVENT & VTIMEZONE
    var filterQuery = query.filter.setComp('VCALENDAR');
    var filterEvent = filterQuery.comp('VEVENT');

    if (options && options.startDate) {
      // convert startDate to unix ical time.
      var icalDate = new ICAL.Time();

      // ical uses seconds not milliseconds
      icalDate.fromUnixTime(options.startDate.valueOf() / 1000);
      filterEvent.setTimeRange({ start: icalDate.toICALString() });
    }

    // include only the VEVENT/VTIMEZONE in the data
    query.data.setComp('VCALENDAR');

    return query;
  },

  noop: function(callback) {
    callback({ ready: true });
  },

  getAccount: function(account, callback) {
    var url = account.entrypoint;
    debug('Fetching account from:', url);

    var connection = this._createConnection(account);
    var request = this._requestHome(connection, url);
    debug('Will issue calendar home request.');
    return request.send(function(err, data) {
      if (err) {
        debug('Error sending home request:', err);
        return callback(err);
      }

      debug('Received data:', data);
      var result = {};

      if (data.url) {
        result.calendarHome = data.url;
      }

      if (connection.oauth) {
        result.oauth = connection.oauth;
      }

      if (connection.user) {
        result.user = connection.user;
      }

      callback(null, result);
    });
  },

  _formatCalendar: function(cal) {
    var result = Object.create(null);

    result.id = cal.url;
    result.url = cal.url;
    result.name = cal.name;
    result.color = cal.color;
    result.description = cal.description;
    result.syncToken = cal.ctag;
    result.privilegeSet = cal.privilegeSet;

    return result;
  },

  findCalendars: function(account, callback) {
    var self = this;
    var url = account.calendarHome;
    var connection = this._createConnection(account);

    var request = this._requestCalendars(
      connection,
      url
    );

    request.send(function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      var calendars = data.calendar;
      var results = {};
      var key;
      var item;

      for (key in calendars) {
        if (calendars.hasOwnProperty(key)) {
          item = calendars[key];
          var formattedCal = self._formatCalendar(
            item
          );

          // If privilegeSet is not present we will assume full permissions.
          // Its highly unlikey that it is missing however.
          if (('privilegeSet' in formattedCal) &&
              (formattedCal.privilegeSet.indexOf('read') === -1)) {

            // skip calendars without read permissions
            continue;
          }

          results[key] = formattedCal;
        }
      }
      callback(null, results);
    });
  },

  /**
   * Formats an alarm trigger
   * Returns the relative time for that trigger
   *
   * @param {ICAL.Property} trigger property.
   * @param {ICAL.Date} start date.
   */
  _formatTrigger: function(trigger, startDate) {
    var alarmTrigger;
    if (trigger.type == 'duration') {
      alarmTrigger = trigger.getFirstValue().toSeconds();
    } else {
      // Type is date-time
      alarmTrigger = trigger
        .getFirstValue()
        .subtractDate(startDate)
        .toSeconds();
    }

    return alarmTrigger;
  },

  /**
   * Formats an already parsed ICAL.Event instance.
   * Expects event to already contain exceptions, etc..
   *
   * @param {String} etag etag.
   * @param {String} url caldav url.
   * @param {String} ical raw ical string.
   * @param {ICAL.Event} event ical event.
   */
  _formatEvent: function(etag, url, ical, event) {
    var self = this;
    var exceptions = null;
    var key;

    if (event.exceptions) {
      exceptions = [];
      for (key in event.exceptions) {
        exceptions.push(this._formatEvent(
          etag,
          url,
          ical,
          event.exceptions[key]
        ));
      }

      if (!exceptions.length) {
        exceptions = null;
      }
    }

    var rid = event.recurrenceId;

    if (rid) {
      rid = this.formatICALTime(rid);
    }

    var resultAlarms = [];
    var alarms = event.component.getAllSubcomponents('valarm');
    alarms.forEach(function(instance) {
      var action = instance.getFirstPropertyValue('action');
      if (action && action === 'DISPLAY') {
        var triggers = instance.getAllProperties('trigger');
        var i = 0;
        var len = triggers.length;

        for (; i < len; i++) {

          var trigger = triggers[i];

          resultAlarms.push({
            action: action,
            trigger: self._formatTrigger(trigger, event.startDate)
          });
        }
      }
    });

    var result = {
      alarms: resultAlarms,
      syncToken: etag,
      url: url,
      id: event.uid,
      title: event.summary,
      recurrenceId: rid,
      rrule: event.getRecurrenceRule(),
      isRecurring: event.isRecurring(),
      description: event.description,
      location: event.location,
      start: this.formatICALTime(event.startDate),
      end: this.formatICALTime(event.endDate),
      exceptions: exceptions
    };

    return result;
  },

  /**
   * Find and parse the display alarms for an event.
   *
   * @param {Object} details details for specific instance.
   */
  _displayAlarms: function(details) {
    var event = details.item;
    var comp = event.component;
    var alarms = comp.getAllSubcomponents('valarm');
    var result = [];

    var self = this;
    alarms.forEach(function(instance) {
      var action = instance.getFirstPropertyValue('action');
      if (action && action === 'DISPLAY') {
        // lets just assume we might have multiple triggers
        var triggers = instance.getAllProperties('trigger');
        var i = 0;
        var len = triggers.length;

        for (; i < len; i++) {
          result.push({
            action: action,
            trigger: self._formatTrigger(triggers[i], event.startDate)
          });
        }
      }
    });

    return result;
  },

  /**
   * Takes an ICAL.Time object and converts it
   * into the storage format familiar to the calendar app.
   *
   *    var time = new ICAL.Time({
   *      year: 2012,
   *      month: 1,
   *      day: 1,
   *      zone: 'PST'
   *    });
   *
   *    // time is converted to a MS
   *    // then its UTC offset is added
   *    // so the time is at UTC (offset 0) then the
   *    // offset is associated with that time.
   *
   *    var output = {
   *      utc: ms,
   *      offset: (+|-)ms,
   *      // zone can mostly be ignored except
   *      // in the case where the event is "floating"
   *      // in time and we need to convert the utc value
   *      // to the current local time.
   *      tzid: ''
   *    };
   */
  formatICALTime: function(time) {
    var zone = time.zone;
    var offset = time.utcOffset() * 1000;
    var utc = time.toUnixTime() * 1000;

    utc += offset;

    var result = {
      tzid: zone.tzid,
      // from seconds to ms
      offset: offset,
      // from seconds to ms
      utc: utc
    };

    if (time.isDate) {
      result.isDate = true;
    }

    return result;
  },

  /**
   * Formats a given time/date into a ICAL.Time instance.
   * Suitable for converting the output of formatICALTime back
   * into a similar representation of the original.
   *
   * Once a time instance goes through this method it should _not_
   * be modified as the DST information is lost (offset is preserved).
   *
   * @param {ICAL.Time|Object} time formatted ical time
   *                                    or output of formatICALTime.
   */
  formatInputTime: function(time, offsetFlag) {
    if (time instanceof ICAL.Time) {
      return time;
    }

    var utc = time.utc;
    var tzid = time.tzid;
    var offset = time.offset;
    var result;
    var num = offsetFlag === true ? 2 : 1;

    if (tzid === ICAL.Timezone.localTimezone.tzid) {
      result = new ICAL.Time();
      result.fromUnixTime(utc / 1000);
      result.zone = ICAL.Timezone.localTimezone;
    } else {
      result = new ICAL.Time();
      result.fromUnixTime((utc - offset * num) / 1000);
      result.zone = ICAL.Timezone.utcTimezone;
    }

    if (time.isDate) {
      result.isDate = true;
    }

    return result;
  },

  /**
   * Parse an ical data/string into primary
   * event and exceptions.
   *
   * It is assumed there is only one primary event
   * (does not have a RECURRENCE-ID) in the ical content.
   *
   * @param {Object|String|ICAL.Event} ical vcalendar chunk (and exceptions).
   * @param {Function} callback node style callback [err, primary event].
   */
  parseEvent: function(ical, callback) {
    if (ical instanceof ICAL.Event) {
      callback(null, ical);
      return;
    }

    var parser = new ICAL.ComponentParser();
    var primaryEvent;
    var exceptions = [];

    parser.ontimezone = function(zone) {
      var id = zone.tzid;

      if (!ICAL.TimezoneService.has(id)) {
        ICAL.TimezoneService.register(id, zone);
      }
    };

    parser.onevent = function(item) {
      if (item.isRecurrenceException()) {
        exceptions.push(item);
      } else {
        primaryEvent = item;
      }
    };

    parser.oncomplete = function() {
      if (!primaryEvent) {
        //TODO: in the error handling pass we need to define
        //     path to log this information so we can determine
        //     the cause of failures.
        callback(new Error('ical parse error'));
        return;
      }
      exceptions.forEach(primaryEvent.relateException, primaryEvent);
      callback(null, primaryEvent);
    };

    //XXX: Right now ICAL.js is all sync so we
    //     can catch the errors this way in the future
    //     onerror will replace this.
    try {
      parser.process(ical);
    } catch (e) {
      callback(e);
    }
  },

  _defaultMaxDate: function() {
    var now = new Date();

    return new ICAL.Time({
      year: now.getFullYear(),
      // three months in advance
      // +1 because js months are zero based
      month: now.getMonth() + 6,
      day: now.getDate()
    });
  },

  /**
   * Expands a list recurring events by their component.
   *
   * It is expected for this function to receive an array
   * of items each structured as a icalComponent.
   *
   *    [
   *      { ical: '...', lastRecurrenceId: '..', iterator: '...' },
   *      ...
   *    ]
   *
   * @param {Array[icalComponent]} components list of icalComponents.
   * @param {Calendar.Responder} stream to emit events.
   * @param {Object} options list of options.
   * @param {Object} options.maxDate maximum date to expand to.
   * @param {Function} callback only sends an error if fatal.
   */
  expandComponents: function(components, options, stream, callback) {
    var pending = components.length;

    function next() {
      if (!(--pending)) {
        callback();
      }
    }


    components.forEach(function(component) {
      var ical = component.ical;
      var localOpts = {
        maxDate: options.maxDate,
        iterator: component.iterator,
        repeat: component.repeat
      };

      if (component.lastRecurrenceId) {
        localOpts.minDate = component.lastRecurrenceId;
      }

      if (options.local) {
        localOpts.local = options.local;
      }

      // expand each component
      this.expandRecurringEvent(ical, localOpts, stream,
                                function(err, iter, lastRecurId, uid) {

        if (err) {
          stream.emit('error', err);
          next();
          return;
        }

        stream.emit('component', {
          eventId: uid,
          lastRecurrenceId: lastRecurId,
          ical: ical,
          iterator: iter,
          preset: component.preset
        });

        next();
      });
    }, this);
  },

  getRepeatInfo: function(component) {
    let tmpString = component.match(/FREQ=(.*?)[;\r]/);
    let repeatString = !tmpString ? 'NEVER' : (tmpString[1] || 'NEVER');

    return repeatString;
  },

  /**
   * Options:
   *
   *  - iterator: (ICAL.RecurExpander) optional recurrence expander
   *              used to resume the iterator state for existing events.
   *
   *  - maxDate: if instance ends after this date stop expansion.
   *
   *
   * Returns:
   *
   *    [
   *      {
   *        start: { offset: inMS, utc: ms },
   *        endDate: // same format as start,
   *        recurrenceId: // id of specific recurrence.
   *        uid: // uid of event
   *        isException: // true when is exception to usual rule.
   *      },
   *      //...
   *    ]
   */
  expandRecurringEvent: function(component, options, stream, callback) {
    var self = this;
    var maxDate;
    var minDate = null;
    var now;
    var repeat = this.getRepeatInfo(JSON.stringify(component));

    if (options.minDate) {
      minDate = this.formatInputTime(options.minDate, true);
    }

    if (options.maxDate) {
      var intervalIndex = JSON.stringify(component).indexOf('INTERVAL=2');
      var optionsMaxDate = {
        utc: options.maxDate.utc,
        offset: options.maxDate.offset
      }
      maxDate = this.formatInputTime(optionsMaxDate);
    }

    if (!('now' in options)) {
      options.now = ICAL.Time.now();
    }

    if (options.local) {
      minDate -= 1;
    }

    now = options.now;

    // convert to rich ical event
    this.parseEvent(component, function(err, event) {
      if (err) {
        callback(err);
        return;
      }

      var iter = IcalRecurExpansion.forEach(
        event,
        options.iterator,
        occuranceHandler,
        minDate,
        maxDate
      );

      function occuranceHandler(next) {
        var details = event.getOccurrenceDetails(next);

        debug('alarm time',
              event.summary,
              'start:', details.startDate.toJSDate().toString(),
              'end:', details.endDate.toJSDate().toString(),
              'now:', now.toJSDate().toString());

        var occurrence = {
          start: self.formatICALTime(details.startDate),
          end: self.formatICALTime(details.endDate),
          recurrenceId: self.formatICALTime(next),
          eventId: details.item.uid,
          isException: details.item.isRecurrenceException()
        };

        nowUtc = new Date().valueOf();
        endUtc = occurrence.end.utc - occurrence.end.offset;

        // only set alarms for those dates in the future...
        if (endUtc >= nowUtc) {
          var alarms = self._displayAlarms(details);
          if (alarms) {
            occurrence.alarms = alarms;
          }
        }

        if (!options.maxDate.utc ||
          occurrence.start.utc < options.maxDate.utc ||
          occurrence.start.utc === options.maxDate.utc + 1 ||
          'MONTHLY' === repeat || 'WEEKLY' === repeat) {
          stream.emit('occurrence', occurrence);
        }
      }

      var lastRecurrence;

      if (iter.complete) {
        // when the iterator is complete
        // last recurrence is false.
        // We use this to signify the end
        // of the iteration cycle.
        lastRecurrence = false;
      } else {
        // its very important all times used
        // for comparison are based on the recurrence id
        // and not the start date as those can change
        // with exceptions...
        lastRecurrence = self.formatICALTime(
          iter.last
        );
      }

      callback(
        null,
        iter.toJSON(),
        lastRecurrence,
        event.uid
      );
    });
  },

  /**
   * Handle a single caldav event response.
   *
   * @param {String} url location of event.
   * @param {Object} response caldav response object.
   * @param {Calendar.Responder} responder event emitter.
   * @param {Function} callback node style callback fired after event parsing.
   */
  _handleCaldavEvent: function(url, response, stream, callback) {
    var self = this;
    var etag = response.getetag;
    var event = response['calendar-data'];

    if (event.status != 200) {
      callback(new Error('non 200 status code "' + url + '"'));
      return;
    }

    // process event
    var ical = event.value;
    this.parseEvent(ical, function(err, event) {

      if (err) {
        callback(err);
        return;
      }

      var result = self._formatEvent(etag.value, url, ical, event);
      stream.emit('event', result);

      var options = {
        maxDate: self._defaultMaxDate(),
        now: ICAL.Time.now()
      };

      self.expandRecurringEvent(event, options, stream,
                                function(err, iter, lastRecurrenceId) {

        if (err) {
          callback(err);
          return;
        }

        if (!event.isRecurring()) {
          stream.emit('component', {
            eventId: result.id,
            isRecurring: false,
            ical: ical
          });
        } else {
          stream.emit('component', {
            eventId: result.id,
            lastRecurrenceId: lastRecurrenceId,
            ical: ical,
            iterator: iter
          });
        }

        callback(null);
      });
    });
  },

  streamEvents: function(account, calendar, options, stream, callback) {
    var self = this;
    var hasCompleted = false;
    var connection = this._createConnection(account);

    var cache = options.cached;

    // we don't need to pass this around anywhere.
    //delete options.cache;

    var request = this._requestEvents(connection, calendar, options);
    var pending = 0;

    function next(err) {
      if (err) {
        try {
          stream.emit('error', err);
        } catch (e) {
          console.error('Failed to transport err:', err.toString(), err.stack);
        }
      }

      if (!(--pending) && hasCompleted) {
        callback(null);
      }
    }

    function handleResponse(url, data) {
      if (!data || !data['calendar-data']) {
        // throw some error;
        console.error('Could not sync: ', url);
        return;
      }
      var etag = data.getetag.value;
      if (url in cache) {
        // don't need to track this for missing events.
        if (etag !== cache[url].syncToken) {
          pending++;
          self._handleCaldavEvent(url, data, stream, next);
        }

        delete cache[url];
      } else {
        pending++;
        self._handleCaldavEvent(url, data, stream, next);
      }
    }

    request.sax.on('DAV:/response', handleResponse);

    request.send(function(err) {
      hasCompleted = true;
      // when the request is completed stop listening
      // for sax events.
      request.sax.removeEventListener(
        'DAV:/response', handleResponse
      );

      if (err) {
        callback(err);
        return;
      }

      if (!pending) {
        var missing = [];

        for (var url in cache) {
          missing.push(cache[url].id);
        }

        // send missing events
        stream.emit('missingEvents', missing);

        // notify the requester that we have completed.
        callback();
      }
    });
  },

  _assetRequest: function(connection, url) {
    return new Caldav.Request.Asset(connection, url);
  },

  deleteEvent: function(account, calendar, event, callback) {
    var connection = this._createConnection(account);

    var req = this._assetRequest(connection, event.url);

    req.delete({}, function(err) {
      callback(err);
    });
  },

  addAlarms: function(component, alarms, account) {
    alarms = alarms || [];

    for (var i = 0; i < alarms.length; i++) {

      var valarm = new ICAL.Component('valarm');

      // valarm details
      valarm.addPropertyWithValue('action', alarms[i].action);
      valarm.addPropertyWithValue('description', 'This is an event reminder');
      var trigger = valarm.addPropertyWithValue('trigger',
        ICAL.Duration.fromSeconds(
          alarms[i].trigger
        )
      );
      trigger.setParameter('relative', 'START');
      component.addSubcomponent(valarm);

      // Check if we need to mirror the VALARM onto email
      if (this.mirrorAlarms(account)) {
        valarm = new ICAL.Component('valarm');
        valarm.addPropertyWithValue('action', 'EMAIL');
        valarm.addPropertyWithValue('description',
          'This is an event reminder');
        valarm.addPropertyWithValue('ATTENDEE', account.user);
        trigger = valarm.addPropertyWithValue('trigger',
          ICAL.Duration.fromSeconds(
            alarms[i].trigger
          )
        );
        trigger.setParameter('relative', 'START');
        component.addSubcomponent(valarm);
      }
    }
  },

  /**
   * Update absolute alarm times when the startDate changes.
   *
   * @param {ICAL.Time} originalDate of the event.
   * @param {ICAL.Event} event to update.
   */
  adjustAbsoluteAlarms: function(originalDate, event) {
    var alarms = event.component.getAllSubcomponents('valarm');

    alarms.forEach(function(alarm) {
      var trigger = alarm.getFirstProperty('trigger');
      var value = trigger.getValues()[0].clone();

      // absolute time
      if (value instanceof ICAL.Time) {
        // find absolute time difference
        var diff = value.subtractDateTz(originalDate);
        trigger.setValue(diff);
      }
    });
  },

  /**
   * Yahoo needs us to mirror all alarms as EMAIL alarms
   */
  mirrorAlarms: function(account) {
    return account && account.domain === 'https://caldav.calendar.yahoo.com';
  },

  createEvent: function(account, calendar, event, callback) {
    var connection = this._createConnection(account);
    var vcalendar = new ICAL.Component('vcalendar');
    var icalEvent = new ICAL.Event();

    // vcalendar details
    vcalendar.addPropertyWithValue('prodid', this.icalProductId);
    vcalendar.addPropertyWithValue('version', this.icalVersion);

    // text fields
    icalEvent.uid = uuid();
    icalEvent.summary = event.title;
    icalEvent.description = event.description;
    icalEvent.location = event.location;
    icalEvent.sequence = 1;

    if (event.repeat !== 'never') {
      icalEvent.rrule = event.rrule;
    }

    // time fields
    icalEvent.startDate = this.formatInputTime(event.start);
    icalEvent.endDate = this.formatInputTime(event.end);

    // alarms
    this.addAlarms(icalEvent.component, event.alarms, account);

    vcalendar.addSubcomponent(icalEvent.component);

    var url = calendar.url + icalEvent.uid + '.ics';
    var req = this._assetRequest(connection, url);

    event.id = icalEvent.uid;
    event.url = url;
    event.icalComponent = vcalendar.toString();

    req.put({}, event.icalComponent, function(err, data, xhr) {
      if (err) {
        callback(err);
        return;
      }

      var token = xhr.getResponseHeader('Etag');
      event.syncToken = token;
      // TODO: error handling
      callback(err, event);
    });

  },

  /**
   * Updates a single caldav event.
   * Will handle updating both primary events and exceptions.
   *
   * @param {Object} account full account details.
   * @param {Object} calendar full calendar details.
   * @param {Object} eventDetails details to update the event.
   *  unmodified parsed ical component. (VCALENDAR).
   */
  updateEvent: function(account, calendar, eventDetails, callback) {
    var connection = this._createConnection(account);

    var icalComponent = eventDetails.icalComponent;
    var event = eventDetails.event;

    var self = this;
    var req = this._assetRequest(connection, event.url);

    // parse event
    this.parseEvent(icalComponent, function(err, icalEvent) {
      if (err) {
        callback(err);
        return;
      }

      var target = icalEvent;
      var vcalendar = icalEvent.component.parent;
      var originalStartDate = target.startDate;

      // find correct event
      if (event.recurrenceId) {
        var rid = self.formatInputTime(event.recurrenceId);
        rid = rid.toString();
        if (icalEvent.exceptions[rid]) {
          target = icalEvent.exceptions[rid];
        }
      }

      // vcalendar pieces
      vcalendar.updatePropertyWithValue('prodid', self.icalProductId);

      // text fields
      target.summary = event.title;
      target.description = event.description;
      target.location = event.location;

      if (!target.sequence) {
        target.sequence = 0;
      }

      target.sequence = parseInt(target.sequence, 10) + 1;

      // time fields
      target.startDate = self.formatInputTime(
        event.start
      );

      target.endDate = self.formatInputTime(
        event.end
      );

      // adjust absolute alarm time ( we do this before adding/changing our
      // new alarm times )
      self.adjustAbsoluteAlarms(originalStartDate, target);

      // We generally want to remove all 'DISPLAY' alarms
      // UNLESS we are dealing with a YAHOO account
      // Then we overwrite all alarms
      var alarms = target.component.getAllSubcomponents('valarm');
      alarms.forEach(function(alarm) {
        var action = alarm.getFirstPropertyValue('action');
        if (action === 'DISPLAY' || self.mirrorAlarms(account)) {
          target.component.removeSubcomponent(alarm);
        }
      });
      self.addAlarms(target.component, event.alarms, account);

      var vcal = target.component.parent.toString();
      event.icalComponent = vcal;

      req.put({}, vcal, function(err, data, xhr) {
        if (err) {
          callback(err);
          return;
        }

        var token = xhr.getResponseHeader('Etag');
        event.syncToken = token;
        // TODO: error handling
        callback(err, event);
      });
    });
  }
};

});
