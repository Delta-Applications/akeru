
/**
 * alameda 0.2.0 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/alameda for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true, nomen: true, regexp: true */
/*global setTimeout, process, document, navigator, importScripts,
  setImmediate */

var requirejs, require, define;
(function (global, undef) {
    var prim, topReq, dataMain, src, subPath,
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

    //START prim 0.0.6
    /**
     * Changes from baseline prim
     * - removed UMD registration
     */
    (function () {
        

        var waitingId, nextTick,
            waiting = [];

        function callWaiting() {
            waitingId = 0;
            var w = waiting;
            waiting = [];
            while (w.length) {
                w.shift()();
            }
        }

        function asyncTick(fn) {
            waiting.push(fn);
            if (!waitingId) {
                waitingId = setTimeout(callWaiting, 0);
            }
        }

        function syncTick(fn) {
            fn();
        }

        function isFunObj(x) {
            var type = typeof x;
            return type === 'object' || type === 'function';
        }

        //Use setImmediate.bind() because attaching it (or setTimeout directly
        //to prim will result in errors. Noticed first on IE10,
        //issue requirejs/alameda#2)
        nextTick = typeof setImmediate === 'function' ? setImmediate.bind() :
            (typeof process !== 'undefined' && process.nextTick ?
                process.nextTick : (typeof setTimeout !== 'undefined' ?
                    asyncTick : syncTick));

        function notify(ary, value) {
            prim.nextTick(function () {
                ary.forEach(function (item) {
                    item(value);
                });
            });
        }

        function callback(p, ok, yes) {
            if (p.hasOwnProperty('v')) {
                prim.nextTick(function () {
                    yes(p.v);
                });
            } else {
                ok.push(yes);
            }
        }

        function errback(p, fail, no) {
            if (p.hasOwnProperty('e')) {
                prim.nextTick(function () {
                    no(p.e);
                });
            } else {
                fail.push(no);
            }
        }

        prim = function prim(fn) {
            var promise, f,
                p = {},
                ok = [],
                fail = [];

            function makeFulfill() {
                var f, f2,
                    called = false;

                function fulfill(v, prop, listeners) {
                    if (called) {
                        return;
                    }
                    called = true;

                    if (promise === v) {
                        called = false;
                        f.reject(new TypeError('value is same promise'));
                        return;
                    }

                    try {
                        var then = v && v.then;
                        if (isFunObj(v) && typeof then === 'function') {
                            f2 = makeFulfill();
                            then.call(v, f2.resolve, f2.reject);
                        } else {
                            p[prop] = v;
                            notify(listeners, v);
                        }
                    } catch (e) {
                        called = false;
                        f.reject(e);
                    }
                }

                f = {
                    resolve: function (v) {
                        fulfill(v, 'v', ok);
                    },
                    reject: function(e) {
                        fulfill(e, 'e', fail);
                    }
                };
                return f;
            }

            f = makeFulfill();

            promise = {
                then: function (yes, no) {
                    var next = prim(function (nextResolve, nextReject) {

                        function finish(fn, nextFn, v) {
                            try {
                                if (fn && typeof fn === 'function') {
                                    v = fn(v);
                                    nextResolve(v);
                                } else {
                                    nextFn(v);
                                }
                            } catch (e) {
                                nextReject(e);
                            }
                        }

                        callback(p, ok, finish.bind(undefined, yes, nextResolve));
                        errback(p, fail, finish.bind(undefined, no, nextReject));

                    });
                    return next;
                },

                catch: function (no) {
                    return promise.then(null, no);
                }
            };

            try {
                fn(f.resolve, f.reject);
            } catch (e) {
                f.reject(e);
            }

            return promise;
        };

        prim.resolve = function (value) {
            return prim(function (yes) {
                yes(value);
            });
        };

        prim.reject = function (err) {
            return prim(function (yes, no) {
                no(err);
            });
        };

        prim.cast = function (x) {
            // A bit of a weak check, want "then" to be a function,
            // but also do not want to trigger a getter if accessing
            // it. Good enough for now.
            if (isFunObj(x) && 'then' in x) {
                return x;
            } else {
                return prim(function (yes, no) {
                    if (x instanceof Error) {
                        no(x);
                    } else {
                        yes(x);
                    }
                });
            }
        };

        prim.all = function (ary) {
            return prim(function (yes, no) {
                var count = 0,
                    length = ary.length,
                    result = [];

                function resolved(i, v) {
                    result[i] = v;
                    count += 1;
                    if (count === length) {
                        yes(result);
                    }
                }

                ary.forEach(function (item, i) {
                    prim.cast(item).then(function (v) {
                        resolved(i, v);
                    }, function (err) {
                        no(err);
                    });
                });
            });
        };

        prim.nextTick = nextTick;
    }());
    //END prim

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

                //Simulate async callback;
                prim.nextTick(function () {
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
            d.promise = prim(function (resolve, reject) {
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
                //Otherwise, if no deferred, means a nextTick and all
                //waiting require deferreds should be checked.
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
                //if a later check is not already scheduled.
                if (!checkingLater) {
                    checkingLater = true;
                    prim.nextTick(function () {
                        checkingLater = false;
                        check();
                    });
                }
            }
        }

        //Used to break out of the promise try/catch chains.
        function delayedError(e) {
            prim.nextTick(function () {
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
            var primId,
                shim = config.shim,
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

            //If want prim injected, inject it now.
            primId = config.definePrim;
            if (primId) {
                waiting[primId] = [primId, [], function () { return prim; }];
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

define("alameda", function(){});

var window = self;

function consoleHelper() {
  var msg = arguments[0] + ':';
  for (var i = 1; i < arguments.length; i++) {
    msg += ' ' + arguments[i];
  }
  msg += '\x1b[0m\n';
  dump(msg);
}
window.console = {
  log: consoleHelper.bind(null, '\x1b[32mWLOG'),
  error: consoleHelper.bind(null, '\x1b[31mWERR'),
  info: consoleHelper.bind(null, '\x1b[36mWINF'),
  warn: consoleHelper.bind(null, '\x1b[33mWWAR')
};

// These pragmas are for r.js and tell it to remove this code section. It will
// be replaced with inline content after a build.

require(['worker-setup']);
define("worker-bootstrap", function(){});

/*global require, setTimeout */
// Note: No AMD module here since this file configures RequireJS.
(function(root) {
  

  requirejs.config({
    baseUrl: '.',
    packages: [{
      name: 'wo-imap-handler',
      location: 'ext/imap-handler/src',
      main: 'imap-handler'
    }],

    map: {
      'browserbox': {
        'axe': 'axeshim-browserbox'
      },
      'browserbox-imap': {
        'axe': 'axeshim-browserbox'
      },
      'ext/smtpclient': {
        'axe': 'axeshim-smtpclient'
      },
    },

    paths: {
      // Configure any manual paths here:
      'bleach': 'ext/bleach.js/lib/bleach',
      'imap-formal-syntax': 'ext/imap-handler/src/imap-formal-syntax',
      'smtpclient-response-parser':
      'ext/smtpclient/src/smtpclient-response-parser',
      'tests': '../test/unit',
      'wbxml': 'ext/activesync-lib/wbxml/wbxml',
      'activesync/codepages': 'ext/activesync-lib/codepages',
      'activesync/protocol': 'ext/activesync-lib/protocol',

      // This lists every top-level module in GELAM/js/ext.
      // CAUTION: It is automatically updated during the build step;
      // don't change or your edits will be as sticky as a dusty post-it.
      // If you see changes here because you modified our deps, commit it!
      // <gelam-ext>
      'activesync-lib': 'ext/activesync-lib',
      'addressparser': 'ext/addressparser',
      'alameda': 'ext/alameda',
      'axe': 'ext/axe',
      'axe-logger': 'ext/axe-logger',
      'axeshim-browserbox': 'ext/axeshim-browserbox',
      'axeshim-smtpclient': 'ext/axeshim-smtpclient',
      'bleach.js': 'ext/bleach.js',
      'browserbox': 'ext/browserbox',
      'browserbox-imap': 'ext/browserbox-imap',
      'co': 'ext/co',
      'equal': 'ext/equal',
      'evt': 'ext/evt',
      'imap-handler': 'ext/imap-handler',
      'mailbuild': 'ext/mailbuild',
      'md5': 'ext/md5',
      'mimefuncs': 'ext/mimefuncs',
      'mimeparser': 'ext/mimeparser',
      'mimeparser-tzabbr': 'ext/mimeparser-tzabbr',
      'mimetypes': 'ext/mimetypes',
      'mix': 'ext/mix',
      'punycode': 'ext/punycode',
      'safe-base64': 'ext/safe-base64',
      'smtpclient': 'ext/smtpclient',
      'stringencoding': 'ext/stringencoding',
      'tcp-socket': 'ext/tcp-socket',
      'utf7': 'ext/utf7',
      'wo-utf7': 'ext/wo-utf7'
      // </gelam-ext>
    },
    // Timeouts are mostly to detect 404 errors, however, there are erorrs
    // generated in the logs in those cases, so the main concern is slow
    // devices taking a while/email app competing with other apps for time,
    // so set this to zero always.
    waitSeconds: 0
  });

  // Allow baseUrl override for things like tests
  if (typeof gelamWorkerBaseUrl === 'string') {
    requirejs.config({
      baseUrl: gelamWorkerBaseUrl
    });
  }

  // Install super-simple shims here.
  root.setZeroTimeout = function(fn) {
    setTimeout(function() { fn(); }, 0);
  };
})(this);

define("worker-config", function(){});

define('worker-router',[],function() {

var listeners = {};

function receiveMessage(evt) {
  var data = evt.data;
//dump('\x1b[37mw <= M: recv: '+data.type+' '+data.uid+' '+data.cmd +'\x1b[0m\n');
  var listener = listeners[data.type];
  if (listener)
    listener(data);
}

window.addEventListener('message', receiveMessage);


function unregister(type) {
  delete listeners[type];
}

function registerSimple(type, callback) {
  listeners[type] = callback;

  return function sendSimpleMessage(cmd, args) {
    //dump('\x1b[34mw => M: send: ' + type + ' null ' + cmd + '\x1b[0m\n');
    window.postMessage({ type: type, uid: null, cmd: cmd, args: args });
  };
}

var callbackSenders = {};

/**
 * Register a message type that allows sending messages that may expect a return
 * message that should trigger a callback.  Messages may not be received unless
 * they have an associated callback from a previous sendMessage.
 */
function registerCallbackType(type) {
  if (callbackSenders.hasOwnProperty(type))
    return callbackSenders[type];
  listeners[type] = function receiveCallbackMessage(data) {
    var callback = callbacks[data.uid];
    if (!callback)
      return;
    delete callbacks[data.uid];

    callback.apply(callback, data.args);
  };
  var callbacks = {};
  var uid = 0;

  var sender = function sendCallbackMessage(cmd, args, callback) {
    if (callback) {
      callbacks[uid] = callback;
    }

    //dump('\x1b[34mw => M: send: ' + type + ' ' + uid + ' ' + cmd + '\x1b[0m\n');
    window.postMessage({ type: type, uid: uid++, cmd: cmd, args: args });
  };
  callbackSenders[type] = sender;
  return sender;
}

/**
 * Register a message type that gets associated with a specific set of callbacks
 * keyed by 'cmd' for received messages.
 */
function registerInstanceType(type) {
  var uid = 0;
  var instanceMap = {};
  listeners[type] = function receiveInstanceMessage(data) {
    var instanceListener = instanceMap[data.uid];
    if (!instanceListener)
      return;

    instanceListener(data);
  };

  return {
    register: function(instanceListener) {
      var thisUid = uid++;
      instanceMap[thisUid] = instanceListener;

      return {
        sendMessage: function sendInstanceMessage(cmd, args, transferArgs) {
//dump('\x1b[34mw => M: send: ' + type + ' ' + thisUid + ' ' + cmd + '\x1b[0m\n');
          window.postMessage({ type: type, uid: thisUid,
                               cmd: cmd, args: args },
                             transferArgs);
        },
        unregister: function unregisterInstance() {
          delete instanceMap[thisUid];
        }
      };
    },
  };
}

function shutdown() {
  window.removeEventListener('message', receiveMessage);
  listeners = {};
  callbackSenders = {};
}

return {
  registerSimple: registerSimple,
  registerCallbackType: registerCallbackType,
  registerInstanceType: registerInstanceType,
  unregister: unregister,
  shutdown: shutdown
};

}); // end define
;
// COPIED FROM gaia/apps/emailjs/evt.js
/*global define, setTimeout */
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
 *
 */
define('evt',[],function() {

  var evt,
      slice = Array.prototype.slice,
      props = ['_events', '_pendingEvents', 'on', 'once', 'latest',
               'latestOnce', 'removeListener', 'emitWhenListener', 'emit'];

  function Emitter() {
    this._events = {};
    this._pendingEvents = {};
  }

  Emitter.prototype = {
    on: function(id, fn) {
      var listeners = this._events[id],
          pending = this._pendingEvents[id];
      if (!listeners) {
        listeners = this._events[id] = [];
      }
      listeners.push(fn);

      if (pending) {
        pending.forEach(function(args) {
          fn.apply(null, args);
        });
        delete this._pendingEvents[id];
      }
      return this;
    },

    once: function(id, fn) {
      var self = this,
          fired = false;
      function one() {
        if (fired)
          return;
        fired = true;
        fn.apply(null, arguments);
        // Remove at a further turn so that the event
        // forEach in emit does not get modified during
        // this turn.
        setTimeout(function() {
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
      if (this[id] && !this._pendingEvents[id])
        fn(this[id]);
      else
        this.once(id, fn);
    },

    removeListener: function(id, fn) {
      var i,
          listeners = this._events[id];
      if (listeners) {
        i = listeners.indexOf(fn);
        if (i !== -1) {
          listeners.splice(i, 1);
        }
        if (listeners.length === 0)
          delete this._events[id];
      }
    },

    /**
     * Like emit, but if no listeners yet, holds on
     * to the value until there is one. Any other
     * args after first one are passed to listeners.
     * @param  {String} id event ID.
     */
    emitWhenListener: function(id) {
      var listeners = this._events[id];
      if (listeners) {
        this.emit.apply(this, arguments);
      } else {
        if (!this._pendingEvents[id])
          this._pendingEvents[id] = [];
        this._pendingEvents[id].push(slice.call(arguments, 1));
      }
    },

    emit: function(id) {
      var args = slice.call(arguments, 1),
          listeners = this._events[id];
      if (listeners) {
        listeners.forEach(function(fn) {
          try {
            fn.apply(null, args);
          } catch (e) {
            // Throw at later turn so that other listeners
            // can complete. While this messes with the
            // stack for the error, continued operation is
            // valued more in this tradeoff.
            setTimeout(function() {
              throw e;
            });
          }
        });
      }
    }
  };

  evt = new Emitter();
  evt.Emitter = Emitter;

  evt.mix = function(obj) {
    var e = new Emitter();
    props.forEach(function(prop) {
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
define('ext/equal',['require'],function(require) {

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
define('logic',['require','evt','./ext/equal'],function(require) {
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

/**
 *
 **/

define(
  'util',[
    'exports'
  ],
  function(
    exports
  ) {

/**
 * Header info comparator that orders messages in order of numerically
 * decreasing date and UIDs.  So new messages come before old messages,
 * and messages with higher UIDs (newer-ish) before those with lower UIDs
 * (when the date is the same.)
 */
var cmpHeaderYoungToOld = exports.cmpHeaderYoungToOld =
    function cmpHeaderYoungToOld(a, b) {
  var delta = b.date - a.date;
  if (delta)
    return delta;
  // favor larger UIDs because they are newer-ish.
  return b.id - a.id;
}

/**
 * Perform a binary search on an array to find the correct insertion point
 *  in the array for an item.  From deuxdrop; tested in
 *  deuxdrop's `unit-simple-algos.js` test.
 *
 * @return[Number]{
 *   The correct insertion point in the array, thereby falling in the inclusive
 *   range [0, arr.length].
 * }
 */
var bsearchForInsert = exports.bsearchForInsert =
    function bsearchForInsert(list, seekVal, cmpfunc) {
  if (!list.length)
    return 0;
  var low  = 0, high = list.length - 1,
      mid, cmpval;
  while (low <= high) {
    mid = low + Math.floor((high - low) / 2);
    cmpval = cmpfunc(seekVal, list[mid]);
    if (cmpval < 0)
      high = mid - 1;
    else if (cmpval > 0)
      low = mid + 1;
    else
      break;
  }
  if (cmpval < 0)
    return mid; // insertion is displacing, so use mid outright.
  else if (cmpval > 0)
    return mid + 1;
  else
    return mid;
};

var bsearchMaybeExists = exports.bsearchMaybeExists =
    function bsearchMaybeExists(list, seekVal, cmpfunc, aLow, aHigh) {
  var low  = ((aLow === undefined)  ? 0                 : aLow),
      high = ((aHigh === undefined) ? (list.length - 1) : aHigh),
      mid, cmpval;
  while (low <= high) {
    mid = low + Math.floor((high - low) / 2);
    cmpval = cmpfunc(seekVal, list[mid]);
    if (cmpval < 0)
      high = mid - 1;
    else if (cmpval > 0)
      low = mid + 1;
    else
      return mid;
  }
  return null;
};

/**
 * Partition a list of messages (identified by message namers, aka the suid and
 * date of the message) by the folder they belong to.
 *
 * @args[
 *   @param[messageNamers @listof[MessageNamer]]
 * ]
 * @return[@listof[@dict[
 *   @key[folderId FolderID]
 *   @key[messages @listof[MessageNamer]]
 * ]
 */
exports.partitionMessagesByFolderId =
    function partitionMessagesByFolderId(messageNamers) {
  var results = [], foldersToMsgs = {};
  for (var i = 0; i < messageNamers.length; i++) {
    var messageNamer = messageNamers[i],
        messageSuid = messageNamer.suid,
        idxLastSlash = messageSuid.lastIndexOf('/'),
        folderId = messageSuid.substring(0, idxLastSlash);

    if (!foldersToMsgs.hasOwnProperty(folderId)) {
      var messages = [messageNamer];
      results.push({
        folderId: folderId,
        messages: messages,
      });
      foldersToMsgs[folderId] = messages;
    }
    else {
      foldersToMsgs[folderId].push(messageNamer);
    }
  }
  return results;
};

exports.formatAddresses = function(nameAddrPairs) {
  var addrstrings = [];
  for (var i = 0; i < nameAddrPairs.length; i++) {
    var pair = nameAddrPairs[i];
    // support lazy people providing only an e-mail... or very careful
    // people who are sure they formatted things correctly.
    if (typeof(pair) === 'string') {
      addrstrings.push(pair);
    }
    else if (!pair.name) {
      addrstrings.push(pair.address);
    }
    else {
      addrstrings.push(
        '"' + pair.name.replace(/["',]/g, '') + '" <' +
          pair.address + '>');
    }
  }

  return addrstrings.join(', ');
};

}); // end define
;
/* Holds localized strings fo mailchew. mailbridge will set the values.
 * This is broken out as a separate module so that mailchew can be loaded
 * async as needed.
 **/

define(
  'mailchew-strings',[
    'exports',
    'evt'
  ],
  function(
    exports,
    evt
  ) {

exports.events = new evt.Emitter();

exports.set = function set(strings) {
  exports.strings = strings;
  exports.events.emit('strings', strings);
};

});

define(
  'date',[
    'module',
    'exports'
  ],
  function(
    $module,
    exports
  ) {

////////////////////////////////////////////////////////////////////////////////
// Time
//
// == JS Dates
//
// We primarily deal in UTC timestamps.  When we need to talk dates with IMAP
// (see next section), we need these timestamps to line up with midnight for
// a given day.  We do not need to line up with weeks, months, or years,
// saving us a lot of complexity.
//
// Day algebra is straightforward because JS Date objects have no concept of
// leap seconds.  We don't need to worry that a leap second will cause adding
// a day to be less than or more than a day.  Hooray!
//
// == IMAP and Time
//
// The stock IMAP SEARCH command's SINCE and BEFORE predicates only operate on
// whole-dates (and ignore the non-date time parts).  Additionally, SINCE is
// inclusive and BEFORE is exclusive.
//
// We use JS millisecond timestamp values throughout, and it's important to us
// that our date logic is consistent with IMAP's time logic where relevant.
// All of our IMAP-exposed time-interval related logic operates on day
// granularities.  Our timestamp/date values are always normalized to midnight
// which happily works out with intuitive range operations.
//
// Observe the pretty ASCII art where as you move to the right you are moving
// forward in time.
//
//             ________________________________________
//      BEFORE)| midnight (0 millis) ... 11:59:59:999 |
// ON_OR_BEFORE]
//             [SINCE......................................
//              (AFTER.....................................
//
// Our date range comparisons (noting that larger timestamps are 'younger') are:
// SINCE analog:  (testDate >= comparisonDate)
//   testDate is as-recent-as or more-recent-than the comparisonDate.
// BEFORE analog: (testDate < comparisonDate)
//   testDate is less-recent-than the comparisonDate
//
// Because "who is the test date and who is the range value under discussion"
// can be unclear and the numerical direction of time is not always intuitive,
// I'm introducing simple BEFORE and SINCE helper functions to try and make
// the comparison logic ridiculously explicit as well as calling out where we
// are being consistent with IMAP.
//
// Not all of our time logic is consistent with IMAP!  Specifically, use of
// exclusive time bounds without secondary comparison keys means that ranges
// defined in this way cannot spread messages with the same timestamp over
// multiple ranges.  This allows for pathological data structure situations
// where there's too much data in a data block, etc.
// Our date ranges are defined by 'startTS' and 'endTS'.  Using math syntax, our
// IMAP-consistent time ranges end up as: [startTS, endTS).  It is always true
// that BEFORE(startTS, endTS) and SINCE(endTS, startTS) in these cases.
//
// As such, I've also created an ON_OR_BEFORE helper that allows equivalence and
// STRICTLY_AFTER that does not check equivalence to round out all possibilities
// while still being rather explicit.


/**
 * IMAP-consistent date comparison; read this as "Is `testDate` BEFORE
 * `comparisonDate`"?
 *
 * !BEFORE(a, b) === SINCE(a, b)
 */
var BEFORE = exports.BEFORE =
      function BEFORE(testDate, comparisonDate) {
  // testDate is numerically less than comparisonDate, so it is chronologically
  // before it.
  return testDate < comparisonDate;
};

var ON_OR_BEFORE = exports.ON_OR_BEFORE =
      function ON_OR_BEFORE(testDate, comparisonDate) {
  return testDate <= comparisonDate;
};

/**
 * IMAP-consistent date comparison; read this as "Is `testDate` SINCE
 * `comparisonDate`"?
 *
 * !SINCE(a, b) === BEFORE(a, b)
 */
var SINCE = exports.SINCE =
      function SINCE(testDate, comparisonDate) {
  // testDate is numerically greater-than-or-equal-to comparisonDate, so it
  // chronologically after/since it.
  return testDate >= comparisonDate;
};

var STRICTLY_AFTER = exports.STRICTLY_AFTER =
      function STRICTLY_AFTER(testDate, comparisonDate) {
  return testDate > comparisonDate;
};

var IN_BS_DATE_RANGE = exports.IN_BS_DATE_RANGE =
      function IN_BS_DATE_RANGE(testDate, startTS, endTS) {
  return testDate >= startTS && testDate < endTS;
};

var PASTWARDS = 1, FUTUREWARDS = -1;
/**
 * Check if `testDate` is "beyond" the comparison date given the `dir`.  If
 * the direction is pastwards, we will return true if testDate happened
 * chronologically before comparisonDate.  If the direction is futurewards,
 * we will return true if testDate happened chronologically after
 * comparisonDate.
 */
var TIME_DIR_AT_OR_BEYOND = exports.TIME_DIR_AT_OR_BEYOND =
      function TIME_DIR_AT_OR_BEYOND(dir, testDate, comparisonDate) {
  if (dir === PASTWARDS)
    return testDate <= comparisonDate;
  // we use null as a sentinel value for 'the future'/'now'
  else if (comparisonDate === null)
    return testDate >= NOW();
  else // FUTUREWARDS
    return testDate >= comparisonDate;
};
/**
 * Compute the delta of the `testDate` relative to the `comparisonDate` where
 * a positive value indicates `testDate` is beyond the `comparisonDate` in
 * the given direction and a negative value indicates it is before it.
 */
var TIME_DIR_DELTA = exports.TIME_DIR_DELTA =
      function TIME_DIR_DELTA(dir, testDate, comparisonDate) {
  if (dir === PASTWARDS)
    return testDate - comparisonDate;
  else // FUTUREWARDS
    return comparisonDate - testDate;
};
/**
 * Add `time` to the `baseDate` in the given direction.  So if the direction
 * is `PASTWARDS`, then we add the date, otherwise we subtract it.
 */
var TIME_DIR_ADD = exports.TIME_DIR_ADD =
      function TIME_DIR_ADD(dir, baseDate, time) {
  if (dir === PASTWARDS)
    return baseDate + time;
  else // FUTUREWARDS
    return baseDate - time;
};

//function DATE_RANGES_OVERLAP(A_startTS, A_endTS, B_startTS, B_endTS) {
//}

var HOUR_MILLIS = exports.HOUR_MILLIS = 60 * 60 * 1000;
var DAY_MILLIS = exports.DAY_MILLIS = 24 * 60 * 60 * 1000;

/**
 * Testing override that when present replaces use of Date.now().
 */
var TIME_WARPED_NOW = null;

/**
 * Pretend that 'now' is actually a fixed point in time for the benefit of
 * unit tests using canned message stores.
 */
exports.TEST_LetsDoTheTimewarpAgain = function(fakeNow) {
  if (fakeNow === null) {
    TIME_WARPED_NOW = null;
    return;
  }
  if (typeof(fakeNow) !== 'number')
    fakeNow = fakeNow.valueOf();
  TIME_WARPED_NOW = fakeNow;
};

var NOW = exports.NOW =
      function NOW() {
  return TIME_WARPED_NOW || Date.now();
};

/**
 * Like NOW, but uses performance.now instead. This means it can be reset or
 * changed to a value different than the last window or worker lifetime value.
 * Allows TIME_WARP overrides and falls back to Date.now. So while all the
 * values are in milliseconds, if performance.now() is used, can have a decimal
 * value indicating up to one thousandth of a millisecond.
 */
var perfObj = typeof performance !== 'undefined' ? performance : Date;
exports.PERFNOW = function PERFNOW() {
  return TIME_WARPED_NOW || perfObj.now();
};

/**
 * Make a timestamp some number of days in the past, quantized to midnight of
 * that day.  This results in rounding up; if it's noon right now and you
 * ask for 2 days ago, you really get 2.5 days worth of time.
 */
var makeDaysAgo = exports.makeDaysAgo =
      function makeDaysAgo(numDays) {
  var past = quantizeDate(TIME_WARPED_NOW || Date.now()) -
               numDays * DAY_MILLIS;
  return past;
};
var makeDaysBefore = exports.makeDaysBefore =
      function makeDaysBefore(date, numDaysBefore) {
  if (date === null)
    return makeDaysAgo(numDaysBefore - 1);
  return quantizeDate(date) - numDaysBefore * DAY_MILLIS;
};
/**
 * Quantize a date to midnight on that day.
 */
var quantizeDate = exports.quantizeDate =
      function quantizeDate(date) {
  if (date === null)
    return null;
  if (typeof(date) === 'number')
    date = new Date(date);
  return date.setUTCHours(0, 0, 0, 0).valueOf();
};

/**
 * If a date is already lined up with midnight of its day, then return that,
 * otherwise round up to the midnight of the next day.
 */
var quantizeDateUp = exports.quantizeDateUp =
      function quantizeDateUp(date) {
  if (typeof(date) === 'number')
    date = new Date(date);
  var truncated = date.setUTCHours(0, 0, 0, 0).valueOf();
  if (date.valueOf()  === truncated)
    return truncated;
  return truncated + DAY_MILLIS;
};

}); // end define
;
/*global define */
define(
  'slice_bridge_proxy',[
    'exports'
  ],
  function(
    exports
  ) {

/**
 * The abstraction for back-end slices to talk to front-end slices.
 *
 * Consolidates communication which allows us to provide transparent batching
 * to our multiple varieties of slices as well as allowing for us to be hacked
 * up to not actually send anything anywhere.
 *
 * The types of slices we support are:
 * - The main `MailSlice` implementation in mailslice.js
 * - The filtering `SearchSlice` implementation in searchfilter.js
 * - The cronsync.js use-case that uses us to be able to hook up a normal
 *   `MailSlice` without there actually being anything to listen to what it
 *   says.  It gives us a minimal/fake MailBridge that has a no-op
 *   __sendMessage.
 *
 * If you change this class, you want to make sure you've considered those
 * slices and their tests too.
 */
function SliceBridgeProxy(bridge, ns, handle) {
  this._bridge = bridge;
  this._ns = ns;
  this._handle = handle;
  this.__listener = null;

  this.status = 'synced';
  this.progress = 0.0;
  this.atTop = false;
  this.atBottom = false;
  this.headerCount = 0;

  /**
   * Can we potentially grow the slice in the negative direction if explicitly
   * desired by the user or UI desires to be up-to-date?  For example,
   * triggering an IMAP sync.
   *
   * This is only really meaningful when `atTop` is true; if we are not at the
   * top then this value will be false.
   *
   * For messages, the implication is that we are not synchronized through 'now'
   * if this value is true (and atTop is true).
   */
  this.userCanGrowUpwards = false;
  this.userCanGrowDownwards = false;
  /**
   *  We batch both slices and updates into the same queue. The MailAPI checks
   *  to differentiate between the two.
   */
  this.pendingUpdates = [];
  this.scheduledUpdate = false;
}

exports.SliceBridgeProxy = SliceBridgeProxy;

SliceBridgeProxy.prototype = {
  /**
   * Issue a splice to add and remove items.
   * @param {number} newEmailCount Number of new emails synced during this
   *     slice request.
   */
  sendSplice: function sbp_sendSplice(index, howMany, addItems, requested,
                                      moreExpected, newEmailCount) {
    var updateSplice = {
      index: index,
      howMany: howMany,
      addItems: addItems,
      requested: requested,
      moreExpected: moreExpected,
      newEmailCount: newEmailCount,
      // send header count here instead of batchSlice,
      // since need an accurate count for each splice
      // call: there could be two splices for the 0
      // index in a row, and setting count on the
      // batchSlice will not give an accurate picture
      // that the slice actions are growing the slice.
      headerCount: this.headerCount,
      type: 'slice'
    };
    this.addUpdate(updateSplice);
  },

  /**
   * Issue an update for existing items.
   *
   * @param {Array[]} indexUpdatesRun
   *   Flattened pairs of index and the updated object wire representation.
   */
  sendUpdate: function sbp_sendUpdate(indexUpdatesRun) {
    var update = {
      updates: indexUpdatesRun,
      type: 'update',
    };
    this.addUpdate(update);
  },

  /**
   * @param {number} newEmailCount Number of new emails synced during this
   *     slice request.
   */
  sendStatus: function sbp_sendStatus(status, requested, moreExpected,
                                      progress, newEmailCount) {
    this.status = status;
    if (progress != null) {
      this.progress = progress;
    }
    this.sendSplice(0, 0, [], requested, moreExpected, newEmailCount);
  },

  sendSyncProgress: function(progress) {
    this.progress = progress;
    this.sendSplice(0, 0, [], true, true);
  },

  addUpdate: function sbp_addUpdate(update) {
    this.pendingUpdates.push(update);
    // If we batched a lot, flush now. Otherwise
    // we sometimes get into a position where nothing happens
    // and then a bunch of updates occur, causing jank
    if (this.pendingUpdates.length > 5) {
      this.flushUpdates();
    } else if (!this.scheduledUpdate) {
      window.setZeroTimeout(this.flushUpdates.bind(this));
      this.scheduledUpdate = true;
    }
  },

  flushUpdates: function sbp_flushUpdates() {
    this._bridge.__sendMessage({
      type: 'batchSlice',
      handle: this._handle,
      status: this.status,
      progress: this.progress,
      atTop: this.atTop,
      atBottom: this.atBottom,
      userCanGrowUpwards: this.userCanGrowUpwards,
      userCanGrowDownwards: this.userCanGrowDownwards,
      sliceUpdates: this.pendingUpdates
    });

    this.pendingUpdates = [];
    this.scheduledUpdate = false;
  },

  die: function sbp_die() {
    if (this.__listener)
      this.__listener.die();
  },
};

});

/**
 *
 **/

define(
  'mailbridge',[
    'logic',
    './util',
    './mailchew-strings',
    './date',
    './slice_bridge_proxy',
    'require',
    'module',
    'exports'
  ],
  function(
    logic,
    $imaputil,
    $mailchewStrings,
    $date,
    $sliceBridgeProxy,
    require,
    $module,
    exports
  ) {
var bsearchForInsert = $imaputil.bsearchForInsert,
    bsearchMaybeExists = $imaputil.bsearchMaybeExists,
    SliceBridgeProxy = $sliceBridgeProxy.SliceBridgeProxy;

function toBridgeWireOn(x) {
  return x.toBridgeWire();
}

var FOLDER_TYPE_TO_SORT_PRIORITY = {
  account: 'a',
  inbox: 'c',
  starred: 'e',
  important: 'f',
  drafts: 'g',
  localdrafts: 'h',
  outbox: 'i',
  queue: 'j',
  sent: 'k',
  junk: 'l',
  trash: 'n',
  archive: 'p',
  normal: 'z',
  // nomail folders are annoying since they are basically just hierarchy,
  //  but they are also rare and should only happen amongst normal folders.
  nomail: 'z',
};

/**
 * Make a folder sorting function that groups folders by account, puts the
 * account header first in that group, maps priorities using
 * FOLDER_TYPE_TO_SORT_PRIORITY, then sorts by path within that.
 *
 * This is largely necessitated by localeCompare being at the mercy of glibc's
 * locale database and failure to fallback to unicode code points for
 * comparison purposes.
 */
function makeFolderSortString(account, folder) {
  if (!folder)
    return account.id;

  var parentFolder = account.getFolderMetaForFolderId(folder.parentId);
  return makeFolderSortString(account, parentFolder) + '!' +
         FOLDER_TYPE_TO_SORT_PRIORITY[folder.type] + '!' +
         folder.name.toLocaleLowerCase();
}

function strcmp(a, b) {
  if (a < b)
    return -1;
  else if (a > b)
    return 1;
  return 0;
}

function checkIfAddressListContainsAddress(list, addrPair) {
  if (!list)
    return false;
  var checkAddress = addrPair.address;
  for (var i = 0; i < list.length; i++) {
    if (list[i].address === checkAddress)
      return true;
  }
  return false;
}

/**
 * There is exactly one `MailBridge` instance for each `MailAPI` instance.
 * `same-frame-setup.js` is the only place that hooks them up together right
 * now.
 */
function MailBridge(universe, name) {
  this.universe = universe;
  this.universe.registerBridge(this);

  logic.defineScope(this, 'MailBridge', { name: name });

  /** @dictof[@key[handle] @value[BridgedViewSlice]]{ live slices } */
  this._slices = {};
  /** @dictof[@key[namespace] @value[@listof[BridgedViewSlice]]] */
  this._slicesByType = {
    accounts: [],
    identities: [],
    folders: [],
    headers: [],
    matchedHeaders: [],
  };

  /**
   * Observed bodies in the format of:
   *
   * @dictof[
   *   @key[suid]
   *   @value[@dictof[
   *     @key[handleId]
   *     @value[@oneof[Function null]]
   *   ]]
   * ]
   *
   * Similar in concept to folder slices but specific to bodies.
   */
  this._observedBodies = {};

  // outstanding persistent objects that aren't slices. covers: composition
  this._pendingRequests = {};
  //
  this._lastUndoableOpPair = null;
}
exports.MailBridge = MailBridge;
MailBridge.prototype = {
  __sendMessage: function(msg) {
    throw new Error('This is supposed to get hidden by an instance var.');
  },

  __receiveMessage: function mb___receiveMessage(msg) {
    var implCmdName = '_cmd_' + msg.type;
    if (!(implCmdName in this)) {
      logic(this, 'badMessageType', { type: msg.type });
      return;
    }
    logic(this, 'cmd', {
      type: msg.type,
      msg: msg
    });
    try {
      this[implCmdName](msg);
    } catch(ex) {
      logic.fail(ex);
      return; // note that we did not throw
    }
  },

  _cmd_ping: function mb__cmd_ping(msg) {
    this.__sendMessage({
      type: 'pong',
      handle: msg.handle,
    });
  },

  _cmd_modifyConfig: function mb__cmd_modifyConfig(msg) {
    this.universe.modifyConfig(msg.mods);
  },

  /**
   * Public api to verify if body has observers.
   *
   *
   *   MailBridge.bodyHasObservers(header.id) // => true/false.
   *
   */
  bodyHasObservers: function(suid) {
    return !!this._observedBodies[suid];
  },

  notifyConfig: function(config) {
    this.__sendMessage({
      type: 'config',
      config: config,
    });
  },

  _cmd_debugSupport: function mb__cmd_debugSupport(msg) {
    switch (msg.cmd) {
      case 'setLogging':
        this.universe.modifyConfig({ debugLogging: msg.arg });
        break;

      case 'dumpLog':
        switch (msg.arg) {
          case 'storage':
            this.universe.dumpLogToDeviceStorage();
            break;
        }
        break;
    }
  },

  _cmd_setInteractive: function mb__cmd_setInteractive(msg) {
    this.universe.setInteractive();
  },

  _cmd_localizedStrings: function mb__cmd_localizedStrings(msg) {
    $mailchewStrings.set(msg.strings);
  },

  _cmd_checkAndUpdateAccount: function(msg) {
    this.universe.checkAndUpdateAccount(msg.data, (result) => {
      this.__sendMessage({
        type: 'checkAndUpdateAccountResult',
        handle: msg.handle,
        data: result
      });
    });
  },

  _cmd_removeDeletedAccounts: function(msg) {
    this.universe.removeDeletedAccounts(msg.emailIds, msg.remove, (result) => {
      this.__sendMessage({
        type: 'removeDeletedAccountsResult',
        handle: msg.handle,
        data: result
      });
    });
  },

  _cmd_learnAboutAccount: function(msg) {
    this.universe.learnAboutAccount(msg.details).then(
      function success(info) {
        this.__sendMessage({
            type: 'learnAboutAccountResults',
            handle: msg.handle,
            data: info
          });
      }.bind(this),
      function errback(err) {
        this.__sendMessage({
            type: 'learnAboutAccountResults',
            handle: msg.handle,
            data: { result: 'no-config-info', configInfo: null }
          });
      }.bind(this));
  },

  _cmd_tryToCreateAccount: function mb__cmd_tryToCreateAccount(msg) {
    var self = this;
    this.universe.tryToCreateAccount(msg.details, msg.domainInfo,
                                     function(error, account, errorDetails) {
        self.__sendMessage({
            type: 'tryToCreateAccountResults',
            handle: msg.handle,
            account: account ? account.toBridgeWire() : null,
            error: error,
            errorDetails: errorDetails,
          });
      });
  },

  _cmd_cancelCreateAccount: function mb__cmd_cancelCreateAccount(msg) {
    this.universe.setNeedCancelAccount(msg);
  } ,

  _cmd_clearAccountProblems: function mb__cmd_clearAccountProblems(msg) {
    var account = this.universe.getAccountForAccountId(msg.accountId),
        self = this,
        bIgnore = msg.bIgnore;
    account.checkAccount(function(incomingErr, outgoingErr) {
      // Note that ActiveSync accounts won't have an outgoingError,
      // but that's fine. It just means that outgoing never errors!
      function canIgnoreError(err) {
        // If we succeeded or the problem was not an authentication,
        // assume everything went fine. This includes the case we're
        // offline.
        return (!err || (
          err !== 'bad-user-or-pass' &&
          err !== 'bad-address' &&
          err !== 'needs-oauth-reauth' &&
          err !== 'imap-disabled'
        ));
      }
      if ((canIgnoreError(incomingErr) && canIgnoreError(outgoingErr)) ||
          bIgnore) {
        self.universe.clearAccountProblems(account);
      }
      self.__sendMessage({
        type: 'clearAccountProblems',
        handle: msg.handle,
      });
    });
  },

  _cmd_modifyAccount: function mb__cmd_modifyAccount(msg) {
    var account = this.universe.getAccountForAccountId(msg.accountId),
        accountDef = account.accountDef;

    for (var key in msg.mods) {
      var val = msg.mods[key];

      switch (key) {
        case 'name':
          accountDef.name = val;
          break;

        case 'label':
          accountDef.label = val;
          break;

        case 'username':
          // See the 'password' section below and/or
          // MailAPI.modifyAccount docs for the rationale for this
          // username equality check:
          if (accountDef.credentials.outgoingUsername ===
              accountDef.credentials.username) {
            accountDef.credentials.outgoingUsername = val;
          }
          accountDef.credentials.username = val;
          break;
        case 'incomingUsername':
          accountDef.credentials.username = val;
          break;
        case 'outgoingUsername':
          accountDef.credentials.outgoingUsername = val;
          break;
        case 'password':
          // 'password' is for changing both passwords, if they
          // currently match. If this account contains an SMTP
          // password (only composite ones will) and the passwords
          // were previously the same, assume that they both need to
          // remain the same. NOTE: By doing this, we save the user
          // from typing their password twice in the extremely common
          // case that both passwords are actually the same. If the
          // SMTP password is actually different, we'll just prompt
          // them for that independently if we discover it's still not
          // correct.
          if (accountDef.credentials.outgoingPassword ===
              accountDef.credentials.password) {
            accountDef.credentials.outgoingPassword = val;
          }
          accountDef.credentials.password = val;
          break;
        case 'incomingPassword':
          accountDef.credentials.password = val;
          break;
        case 'outgoingPassword':
          accountDef.credentials.outgoingPassword = val;
          break;
        case 'oauthTokens':
          var oauth2 = accountDef.credentials.oauth2;
          oauth2.accessToken = val.accessToken;
          oauth2.expireTimeMS = val.expireTimeMS;
          break;

        case 'syncEnable':
          accountDef.syncEnable = val;
          break;

        case 'public':
          accountDef.public = val;
          break;

        case 'identities':
          // TODO: support identity mutation
          // we expect a list of identity mutation objects, namely an id and the
          // rest are attributes to change
          break;

        case 'servers':
          // TODO: support server mutation
          // we expect a list of server mutation objects; namely, the type names
          // the server and the rest are attributes to change
          break;

        case 'syncRange':
          accountDef.syncRange = val;
          break;

        case 'syncInterval':
          accountDef.syncInterval = val;
          break;

        case 'notifyOnNew':
          accountDef.notifyOnNew = val;
          break;

        case 'playSoundOnSend':
          accountDef.playSoundOnSend = val;
          break;

        case 'setAsDefault':
          // Weird things can happen if the device's clock goes back in time,
          // but this way, at least the user can change their default if they
          // cycle through their accounts.
          if (val)
            accountDef.defaultPriority = $date.NOW();
          break;

        default:
          throw new Error('Invalid key for modifyAccount: "' + key + '"');
      }
    }

    this.universe.saveAccountDef(accountDef, null);
    this.__sendMessage({
      type: 'modifyAccount',
      handle: msg.handle,
    });
  },

  _cmd_deleteAccount: function mb__cmd_deleteAccount(msg) {
    this.universe.deleteAccount(msg.accountId);
  },

  _cmd_modifyIdentity: function mb__cmd_modifyIdentity(msg) {
    var account = this.universe.getAccountForSenderIdentityId(msg.identityId),
        accountDef = account.accountDef,
        identity = this.universe.getIdentityForSenderIdentityId(msg.identityId);

    for (var key in msg.mods) {
      var val = msg.mods[key];

      switch (key) {
        case 'name':
          identity.name = val;
          break;

        case 'address':
          identity.address = val;
          break;

        case 'replyTo':
          identity.replyTo = val;
          break;

        case 'signature':
          identity.signature = val;
          break;

        case 'signatureEnabled':
          identity.signatureEnabled = val;
          break;

        default:
          throw new Error('Invalid key for modifyIdentity: "' + key + '"');
      }
    }
    // accountDef has the identity, so this persists it as well
    this.universe.saveAccountDef(accountDef, null, function() {
      this.__sendMessage({
        type: 'modifyIdentity',
        handle: msg.handle,
      });
    }.bind(this));

  },

  /**
   * Notify the frontend that login failed.
   *
   * @param account
   * @param {string} problem
   * @param {'incoming'|'outgoing'} whichSide
   */
  notifyBadLogin: function mb_notifyBadLogin(account, problem, whichSide) {
    this.__sendMessage({
      type: 'badLogin',
      account: account.toBridgeWire(),
      problem: problem,
      whichSide: whichSide,
    });
  },

  _cmd_viewAccounts: function mb__cmd_viewAccounts(msg) {
    var proxy = this._slices[msg.handle] =
          new SliceBridgeProxy(this, 'accounts', msg.handle);
    proxy.markers = this.universe.accounts.map(function(x) { return x.id; });

    this._slicesByType['accounts'].push(proxy);
    var wireReps = this.universe.accounts.map(toBridgeWireOn);
    // send all the accounts in one go.
    proxy.sendSplice(0, 0, wireReps, true, false);
  },

  notifyAccountAdded: function mb_notifyAccountAdded(account) {
    var accountWireRep = account.toBridgeWire();
    var i, proxy, slices, wireSplice = null, markersSplice = null;
    // -- notify account slices
    slices = this._slicesByType['accounts'];
    for (i = 0; i < slices.length; i++) {
      proxy = slices[i];
      proxy.sendSplice(proxy.markers.length, 0, [accountWireRep], false, false);
      proxy.markers.push(account.id);
    }

    // -- notify folder slices
    accountWireRep = account.toBridgeFolder();
    slices = this._slicesByType['folders'];
    var startMarker = makeFolderSortString(account, accountWireRep),
        idxStart;
    for (i = 0; i < slices.length; i++) {
      proxy = slices[i];
      // If it's filtered to an account, it can't care about us.  (You can't
      // know about an account before it's created.)
      if (proxy.mode === 'account')
        continue;

      idxStart = bsearchForInsert(proxy.markers, startMarker, strcmp);
      wireSplice = [accountWireRep];
      markersSplice = [startMarker];
      for (var iFolder = 0; iFolder < account.folders.length; iFolder++) {
        var folder = account.folders[iFolder],
            folderMarker = makeFolderSortString(account, folder),
            idxFolder = bsearchForInsert(markersSplice, folderMarker, strcmp);
        wireSplice.splice(idxFolder, 0, folder);
        markersSplice.splice(idxFolder, 0, folderMarker);
      }
      proxy.sendSplice(idxStart, 0, wireSplice, false, false);
      proxy.markers.splice.apply(proxy.markers,
                                 [idxStart, 0].concat(markersSplice));
    }
  },

  /**
   * Generate modifications for an account.  We only generate this for account
   * queries proper and not the folder representations of accounts because we
   * define that there is nothing interesting mutable for the folder
   * representations.
   */
  notifyAccountModified: function(account) {
    var slices = this._slicesByType['accounts'],
        accountWireRep = account.toBridgeWire();
    for (var i = 0; i < slices.length; i++) {
      var proxy = slices[i];
      var idx = proxy.markers.indexOf(account.id);
      if (idx !== -1) {
        proxy.sendUpdate([idx, accountWireRep]);
      }
    }
  },

  notifyAccountRemoved: function(accountId) {
    var i, proxy, slices;
    // -- notify account slices
    slices = this._slicesByType['accounts'];
    for (i = 0; i < slices.length; i++) {
      proxy = slices[i];
      var idx = proxy.markers.indexOf(accountId);
      if (idx !== -1) {
        proxy.sendSplice(idx, 1, [], false, false);
        proxy.markers.splice(idx, 1);
      }
    }

    // -- notify folder slices
    slices = this._slicesByType['folders'];
    var startMarker = accountId + '!!',
        endMarker = accountId + '!|';
    for (i = 0; i < slices.length; i++) {
      proxy = slices[i];
      var idxStart = bsearchForInsert(proxy.markers, startMarker,
                                      strcmp),
          idxEnd = bsearchForInsert(proxy.markers, endMarker,
                                    strcmp);
      if (idxEnd !== idxStart) {
        proxy.sendSplice(idxStart, idxEnd - idxStart, [], false, false);
        proxy.markers.splice(idxStart, idxEnd - idxStart);
      }
    }
  },

  notifyAccountReset: function(account) {
    this.__sendMessage({
      type: 'accountReset',
      account: account.toBridgeWire()
    });
  },

  _cmd_viewSenderIdentities: function mb__cmd_viewSenderIdentities(msg) {
    var proxy = this._slices[msg.handle] =
          new SliceBridgeProxy(this, 'identities', msg.handle);
    this._slicesByType['identities'].push(proxy);
    var wireReps = this.universe.identities;
    // send all the identities in one go.
    proxy.sendSplice(0, 0, wireReps, true, false);
  },

  _cmd_requestBodies: function(msg) {
    var self = this;
    this.universe.downloadBodies(msg.messages, msg.options, function() {
      self.__sendMessage({
        type: 'requestBodiesComplete',
        handle: msg.handle,
        requestId: msg.requestId
      });
    });
  },

  notifyFolderAdded: function(account, folderMeta) {
    var newMarker = makeFolderSortString(account, folderMeta);

    var slices = this._slicesByType['folders'];
    for (var i = 0; i < slices.length; i++) {
      var proxy = slices[i];
      var idx = bsearchForInsert(proxy.markers, newMarker, strcmp);
      proxy.sendSplice(idx, 0, [folderMeta], false, false);
      proxy.markers.splice(idx, 0, newMarker);
    }
  },

  notifyFolderModified: function(account, folderMeta) {
    var marker = makeFolderSortString(account, folderMeta);

    var slices = this._slicesByType['folders'];
    for (var i = 0; i < slices.length; i++) {
      var proxy = slices[i];

      var idx = bsearchMaybeExists(proxy.markers, marker, strcmp);
      if (idx === null)
        continue;

      proxy.sendUpdate([idx, folderMeta]);
    }
  },

  notifyFolderRemoved: function(account, folderMeta) {
    var marker = makeFolderSortString(account, folderMeta);

    var slices = this._slicesByType['folders'];
    for (var i = 0; i < slices.length; i++) {
      var proxy = slices[i];

      var idx = bsearchMaybeExists(proxy.markers, marker, strcmp);
      if (idx === null)
        continue;
      proxy.sendSplice(idx, 1, [], false, false);
      proxy.markers.splice(idx, 1);
    }
  },

  /**
   * Sends a notification of a change in the body.  Because FolderStorage is
   * the authoritative store of body representations and access is currently
   * mediated through mutexes, this method should really only be called by
   * FolderStorage.updateMessageBody.
   *
   * @param suid {SUID}
   *   The message whose body representation has been updated
   * @param detail {Object}
   *   See {{#crossLink "FolderStorage/updateMessageBody"}{{/crossLink}} for
   *   more information on the structure of this object.
   * @param body {BodyInfo}
   *   The current representation of the body.
   */
  notifyBodyModified: function(suid, detail, body) {
    var handles = this._observedBodies[suid];
    var defaultHandler = this.__sendMessage;

    if (handles) {
      for (var handle in handles) {
        // the suid may have an existing handler which captures the output of
        // the notification instead of dispatching here... This allows us to
        // aggregate pending notifications while fetching the bodies so updates
        // never come before the actual body.
        var emit = handles[handle] || defaultHandler;
        emit.call(this, {
          type: 'bodyModified',
          handle: handle,
          bodyInfo: body,
          detail: detail
        });
      }
    }
  },

  _cmd_viewFolders: function mb__cmd_viewFolders(msg) {
    var proxy = this._slices[msg.handle] =
          new SliceBridgeProxy(this, 'folders', msg.handle);
    this._slicesByType['folders'].push(proxy);
    proxy.mode = msg.mode;
    proxy.argument = msg.argument;
    var markers = proxy.markers = [];

    var wireReps = [];

    function pushAccountFolders(acct) {
      for (var iFolder = 0; iFolder < acct.folders.length; iFolder++) {
        var folder = acct.folders[iFolder];
        var newMarker = makeFolderSortString(acct, folder);
        var idx = bsearchForInsert(markers, newMarker, strcmp);
        wireReps.splice(idx, 0, folder);
        markers.splice(idx, 0, newMarker);
      }
    }

    if (msg.mode === 'account') {
      pushAccountFolders(
        this.universe.getAccountForAccountId(msg.argument));
    }
    else {
      var accounts = this.universe.accounts.concat();

      // sort accounts by their id's
      accounts.sort(function (a, b) {
        return a.id.localeCompare(b.id);
      });

      for (var iAcct = 0; iAcct < accounts.length; iAcct++) {
        var acct = accounts[iAcct], acctBridgeRep = acct.toBridgeFolder(),
            acctMarker = makeFolderSortString(acct, acctBridgeRep),
            idxAcct = bsearchForInsert(markers, acctMarker, strcmp);

        wireReps.splice(idxAcct, 0, acctBridgeRep);
        markers.splice(idxAcct, 0, acctMarker);
        pushAccountFolders(acct);
      }
    }
    proxy.sendSplice(0, 0, wireReps, true, false);
  },

  _cmd_foldersListRefresh: function (msg) {
    var acct = this.universe.getAccountForAccountId(msg.accountId);
    this.universe.syncFolderList(acct);
  },

  _cmd_viewFolderMessages: function mb__cmd_viewFolderMessages(msg) {
    var proxy = this._slices[msg.handle] =
          new SliceBridgeProxy(this, 'headers', msg.handle);
    this._slicesByType['headers'].push(proxy);

    var account = this.universe.getAccountForFolderId(msg.folderId);
    account.sliceFolderMessages(msg.folderId, proxy);
  },

  _cmd_sortFolderMessages: function mb__cmd_sortFolderMessages(msg) {
    var proxy = this._slices[msg.handle] =
        new SliceBridgeProxy(this, 'headers', msg.handle);
    this._slicesByType['headers'].push(proxy);
    var account = this.universe.getAccountForFolderId(msg.folderId);
    account.sortFolderMessages(msg.folderId, proxy, msg.fillSize);
  },

  _cmd_searchFolderMessages: function mb__cmd_searchFolderMessages(msg) {
    var proxy = this._slices[msg.handle] =
          new SliceBridgeProxy(this, 'matchedHeaders', msg.handle);
    this._slicesByType['matchedHeaders'].push(proxy);
    var account = this.universe.getAccountForFolderId(msg.folderId);
    account.searchFolderMessages(
      msg.folderId, proxy, msg.phrase, msg.whatToSearch);
  },

  _cmd_refreshHeaders: function mb__cmd_refreshHeaders(msg) {
    var proxy = this._slices[msg.handle];
    if (!proxy) {
      logic(this, 'badSliceHandle', { handle: msg.handle });
      return;
    }

    if (proxy.__listener)
      proxy.__listener.refresh();
  },

  _cmd_growSlice: function mb__cmd_growSlice(msg) {
    var proxy = this._slices[msg.handle];
    if (!proxy) {
      logic(this, 'badSliceHandle', { handle: msg.handle });
      return;
    }

    if (proxy.__listener)
      proxy.__listener.reqGrow(msg.dirMagnitude, msg.userRequestsGrowth);
  },

  _cmd_shrinkSlice: function mb__cmd_shrinkSlice(msg) {
    var proxy = this._slices[msg.handle];
    if (!proxy) {
      logic(this, 'badSliceHandle', { handle: msg.handle });
      return;
    }

    if (proxy.__listener)
      proxy.__listener.reqNoteRanges(
        msg.firstIndex, msg.firstSuid, msg.lastIndex, msg.lastSuid);
  },

  _cmd_killSlice: function mb__cmd_killSlice(msg) {
    var proxy = this._slices[msg.handle];
    if (!proxy) {
      logic(this, 'badSliceHandle', { handle: msg.handle });
      return;
    }

    delete this._slices[msg.handle];
    var proxies = this._slicesByType[proxy._ns],
        idx = proxies.indexOf(proxy);
    proxies.splice(idx, 1);
    proxy.die();

    this.__sendMessage({
      type: 'sliceDead',
      handle: msg.handle,
    });
  },

  _cmd_getBody: function mb__cmd_getBody(msg) {
    var self = this;
    // map the message id to the folder storage
    var folderStorage = this.universe.getFolderStorageForMessageSuid(msg.suid);

    // when requesting the body we also create a observer to notify the client
    // of events... We never want to send the updates before fetching the body
    // so we buffer them here with a temporary handler.
    var pendingUpdates = [];

    var catchPending = function catchPending(msg) {
      pendingUpdates.push(msg);
    };

    if (!this._observedBodies[msg.suid])
      this._observedBodies[msg.suid] = {};

    this._observedBodies[msg.suid][msg.handle] = catchPending;

    var handler = function(bodyInfo) {
      self.__sendMessage({
        type: 'gotBody',
        handle: msg.handle,
        bodyInfo: bodyInfo
      });

      // if all body reps where requested we verify that all are present
      // otherwise we begin the request for more body reps.
      if (
        msg.downloadBodyReps &&
        !folderStorage.messageBodyRepsDownloaded(bodyInfo)
      ) {

        self.universe.downloadMessageBodyReps(
          msg.suid,
          msg.date,
          function() { /* we don't care it will send update events */ }
        );
      }

      // dispatch pending updates...
      pendingUpdates.forEach(self.__sendMessage, self);
      pendingUpdates = null;

      // revert to default handler. Note! this is intentionally
      // set to null and not deleted if deleted the observer is removed.
      self._observedBodies[msg.suid][msg.handle] = null;
    };

    if (msg.withBodyReps)
      folderStorage.getMessageBodyWithReps(msg.suid, msg.date, handler);
    else
      folderStorage.getMessageBody(msg.suid, msg.date, handler);
  },

  _cmd_killBody: function(msg) {
    var handles = this._observedBodies[msg.id];
    if (handles) {
      delete handles[msg.handle];

      var purgeHandles = true;
      for (var key in handles) {
        purgeHandles = false;
        break;
      }

      if (purgeHandles) {
        delete this._observedBodies[msg.id];
      }
    }

    this.__sendMessage({
      type: 'bodyDead',
      handle: msg.handle
    });
  },

  _cmd_downloadAttachments: function mb__cmd__downloadAttachments(msg) {
    var self = this;
    this.universe.downloadMessageAttachments(
      msg.suid, msg.date, msg.relPartIndices, msg.attachmentIndices,
      msg.registerAttachments,
      function(err) {
        self.__sendMessage({
          type: 'downloadedAttachments',
          handle: msg.handle
        });
      });
  },

  //////////////////////////////////////////////////////////////////////////////
  // Message Mutation
  //
  // All mutations are told to the universe which breaks the modifications up on
  // a per-account basis.

  _cmd_modifyMessageTags: function mb__cmd_modifyMessageTags(msg) {
    // XXXYYY

    // - The mutations are written to the database for persistence (in case
    //   we fail to make the change in a timely fashion) and so that we can
    //   know enough to reverse the operation.
    // - Speculative changes are made to the headers in the database locally.

    var longtermIds = this.universe.modifyMessageTags(
      msg.opcode, msg.messages, msg.addTags, msg.removeTags);
    this.__sendMessage({
      type: 'mutationConfirmed',
      handle: msg.handle,
      longtermIds: longtermIds,
    });
  },

  _cmd_deleteMessages: function mb__cmd_deleteMessages(msg) {
    var longtermIds = this.universe.deleteMessages(
      msg.messages);
    this.__sendMessage({
      type: 'mutationConfirmed',
      handle: msg.handle,
      longtermIds: longtermIds,
    });
  },

  _cmd_moveMessages: function mb__cmd_moveMessages(msg) {
    var longtermIds = this.universe.moveMessages(
      msg.messages, msg.targetFolder, function(err, moveMap) {
        this.__sendMessage({
          type: 'mutationConfirmed',
          handle: msg.handle,
          longtermIds: longtermIds,
          result: moveMap
        });
      }.bind(this));
  },

  _cmd_sendOutboxMessages: function(msg) {
    var account = this.universe.getAccountForAccountId(msg.accountId);
    this.universe.sendOutboxMessages(account, {
      reason: 'api request'
    }, function(err) {
      this.__sendMessage({
        type: 'sendOutboxMessages',
        handle: msg.handle
      });
    }.bind(this));
  },

  _cmd_setOutboxSyncEnabled: function(msg) {
    var account = this.universe.getAccountForAccountId(msg.accountId);
    this.universe.setOutboxSyncEnabled(
      account, msg.outboxSyncEnabled, function() {
        this.__sendMessage({
          type: 'setOutboxSyncEnabled',
          handle: msg.handle
        });
      }.bind(this));
  },

  _cmd_undo: function mb__cmd_undo(msg) {
    this.universe.undoMutation(msg.longtermIds);
  },

  //////////////////////////////////////////////////////////////////////////////
  // Composition

  _cmd_beginCompose: function mb__cmd_beginCompose(msg) {
    require(['./drafts/composer', 'mailchew'], function ($composer, $mailchew) {
      var req = this._pendingRequests[msg.handle] = {
        type: 'compose',
        active: 'begin',
        account: null,
        persistedNamer: null,
        die: false
      };

      // - figure out the identity to use
      var account, identity, folderId;
      if (msg.mode === 'new' && msg.submode === 'folder')
        account = this.universe.getAccountForFolderId(msg.refSuid);
      else
        account = this.universe.getAccountForMessageSuid(msg.refSuid);
      req.account = account;

      identity = account.identities[0];

      var bodyText = $mailchew.generateBaseComposeBody(identity);
      if (msg.mode !== 'reply' && msg.mode !== 'forward') {
        return this.__sendMessage({
          type: 'composeBegun',
          handle: msg.handle,
          error: null,
          identity: identity,
          subject: '',
          body: { text: bodyText, html: null },
          to: [],
          cc: [],
          bcc: [],
          references: null,
          attachments: [],
          sendType: 'new'
        });
      }

      var folderStorage =
        this.universe.getFolderStorageForMessageSuid(msg.refSuid);
      var self = this;
      folderStorage.getMessage(
        msg.refSuid, msg.refDate, { withBodyReps: true }, function(res) {

        if (!res) {
          // cannot compose a reply/fwd message without a header/body
          return console.warn(
            'Cannot compose message missing header/body: ',
            msg.refSuid
          );
        }

        var header = res.header;
        var bodyInfo = res.body;

        if (msg.mode === 'reply') {
          var rTo, rCc, rBcc;
          // Clobber the sender's e-mail with the reply-to address if provided.
          // The Reply-To header can contain multiple addresses, but we only
          // reply to the first. In the event of a reply-to address, we clobber
          // both the name and address with the provided value; notably, if the
          // reply-to header doesn't contain a display name, we leave the
          // display name blank as intended. A quick survey of some mailings
          // indicates that most Reply-To headers include a display name
          // identical to the From header anyway.
          var replyToAddress = header.replyTo && header.replyTo[0];
          var effectiveAuthor = replyToAddress || msg.refAuthor;
          switch (msg.submode) {
            case 'list':
              // XXX we can't do this without headers we're not retrieving,
              // fall through for now.
            case null:
            case 'sender':
              rTo = [effectiveAuthor];
              rCc = rBcc = [];
              break;
            case 'all':
              // No need to change the lists if the author is already on the
              // reply lists.
              //
              // nb: Our logic here is fairly simple; Thunderbird's
              // nsMsgCompose.cpp does a lot of checking that we should
              // audit, although much of it could just be related to its
              // much more extensive identity support.
              if (checkIfAddressListContainsAddress(header.to,
                                                    effectiveAuthor) ||
                  checkIfAddressListContainsAddress(header.cc,
                                                    effectiveAuthor)) {
                rTo = header.to;
              }
              // add the author as the first 'to' person
              else {
                if (header.to && header.to.length)
                  rTo = [effectiveAuthor].concat(header.to);
                else
                  rTo = [effectiveAuthor];
              }

              // For reply-all, don't reply to your own address.
              var notYourIdentity = function(person) {
                return person.address !== identity.address;
              };

              if (rTo.length > 1) {
                rTo = rTo.filter(notYourIdentity);
              }
              rCc = (header.cc || []).filter(notYourIdentity);
              rBcc = header.bcc;
              break;
          }

          var referencesStr;
          if (bodyInfo.references) {
            referencesStr = bodyInfo.references.concat([msg.refGuid])
                              .map(function(x) { return '<' + x + '>'; })
                              .join(' ');
          }
          else if (msg.refGuid) {
            referencesStr = '<' + msg.refGuid + '>';
          }
          // ActiveSync does not thread so good
          else {
            referencesStr = '';
          }
          req.active = null;

          self.__sendMessage({
            type: 'composeBegun',
            handle: msg.handle,
            error: null,
            identity: identity,
            subject: $mailchew.generateReplySubject(msg.refSubject),
            // blank lines at the top are baked in
            body: $mailchew.generateReplyBody(
                    bodyInfo.bodyReps, effectiveAuthor, msg.refDate,
                    identity, msg.refGuid),
            to: rTo,
            cc: rCc,
            bcc: rBcc,
            referencesStr: referencesStr,
            attachments: [],
            sendType: 'reply'
          });
        }
        else {
          req.active = null;
          self.__sendMessage({
            type: 'composeBegun',
            handle: msg.handle,
            error: null,
            identity: identity,
            subject: $mailchew.generateForwardSubject(msg.refSubject),
            // blank lines at the top are baked in by the func
            body: $mailchew.generateForwardMessage(
                    msg.refAuthor, msg.refDate, msg.refSubject,
                    header, bodyInfo, identity),
            // forwards have no assumed envelope information
            to: [],
            cc: [],
            bcc: [],
            // XXX imitate Thunderbird current or previous behaviour; I
            // think we ended up linking forwards into the conversation
            // they came from, but with an extra header so that it was
            // possible to detect it was a forward.
            references: null,
            attachments: [],
            sendType: 'forward'
          });
        }
      });
    }.bind(this));
  },

  _cmd_attachBlobToDraft: function(msg) {
    // for ordering consistency reasons with other draft logic, this needs to
    // require composer as a dependency too.
    require(['./drafts/composer'], function ($composer) {
      var draftReq = this._pendingRequests[msg.draftHandle];
      if (!draftReq)
        return;

      this.universe.attachBlobToDraft(
        draftReq.account,
        draftReq.persistedNamer,
        msg.attachmentDef,
        function (err) {
          this.__sendMessage({
            type: 'attachedBlobToDraft',
            // Note! Our use of 'msg' here means that our reference to the Blob
            // will be kept alive slightly longer than the job keeps it alive,
            // but just slightly.
            handle: msg.handle,
            draftHandle: msg.draftHandle,
            err: err
          });
        }.bind(this));
    }.bind(this));
  },

  _cmd_detachAttachmentFromDraft: function(msg) {
    // for ordering consistency reasons with other draft logic, this needs to
    // require composer as a dependency too.
    require(['./drafts/composer'], function ($composer) {
    var req = this._pendingRequests[msg.draftHandle];
    if (!req)
      return;

    this.universe.detachAttachmentFromDraft(
      req.account,
      req.persistedNamer,
      msg.attachmentIndex,
      function (err) {
        this.__sendMessage({
          type: 'detachedAttachmentFromDraft',
          handle: msg.handle,
          draftHandle: msg.draftHandle,
          err: err
        });
      }.bind(this));
    }.bind(this));
  },

  _cmd_resumeCompose: function mb__cmd_resumeCompose(msg) {
    var req = this._pendingRequests[msg.handle] = {
      type: 'compose',
      active: 'resume',
      account: null,
      persistedNamer: msg.messageNamer,
      die: false
    };

    // NB: We are not acquiring the folder mutex here because
    var account = req.account =
          this.universe.getAccountForMessageSuid(msg.messageNamer.suid);
    var folderStorage = this.universe.getFolderStorageForMessageSuid(
                          msg.messageNamer.suid);
    var self = this;
    folderStorage.runMutexed('resumeCompose', function(callWhenDone) {
      function fail() {
        self.__sendMessage({
          type: 'composeBegun',
          handle: msg.handle,
          error: 'no-message'
        });
        callWhenDone();
      }
      folderStorage.getMessage(msg.messageNamer.suid, msg.messageNamer.date,
                               function(res) {
        try {
          if (!res.header || !res.body) {
            fail();
            return;
          }
          var header = res.header, body = res.body;

          // -- convert from header/body rep to compose rep

          var composeBody = {
            text: '',
            html: null,
          };

          // Body structure should be guaranteed, but add some checks.
          if (body.bodyReps.length >= 1 &&
              body.bodyReps[0].type === 'plain' &&
              body.bodyReps[0].content.length === 2 &&
              body.bodyReps[0].content[0] === 0x1) {
            composeBody.text = body.bodyReps[0].content[1];
          }
          // HTML is optional, but if present, should satisfy our guard
          if (body.bodyReps.length == 2 &&
              body.bodyReps[1].type === 'html') {
            composeBody.html = body.bodyReps[1].content;
          }

          var attachments = [];
          body.attachments.forEach(function(att) {
            attachments.push({
              name: att.name,
              pathName: att.pathName,
              data: att.vCardData,
              blob: {
                size: att.sizeEstimate,
                type: att.type
              }
            });
          });

          req.active = null;
          self.__sendMessage({
            type: 'composeBegun',
            handle: msg.handle,
            error: null,
            identity: account.identities[0],
            subject: header.subject,
            body: composeBody,
            to: header.to,
            cc: header.cc,
            bcc: header.bcc,
            referencesStr: body.references,
            attachments: attachments,
            sendStatus: header.sendStatus
          });
          callWhenDone();
        }
        catch (ex) {
          fail(); // calls callWhenDone
        }
      });
    });
  },

  /**
   * Save a draft, delete a draft, or try and send a message.
   *
   * Drafts are saved in our IndexedDB storage. This is notable because we are
   * told about attachments via their Blobs.
   */
  _cmd_doneCompose: function mb__cmd_doneCompose(msg) {
    require(['./drafts/composer'], function ($composer) {
      var req = this._pendingRequests[msg.handle], self = this;
      if (!req) {
        return;
      }
      if (msg.command === 'die') {
        if (req.active) {
          req.die = true;
        }
        else {
          delete this._pendingRequests[msg.handle];
        }
        return;
      }
      var account;
      if (msg.command === 'delete') {
        function sendDeleted() {
          self.__sendMessage({
            type: 'doneCompose',
            handle: msg.handle
          });
        }
        if (req.persistedNamer) {
          account = this.universe.getAccountForMessageSuid(
                      req.persistedNamer.suid);
          this.universe.deleteDraft(account, req.persistedNamer, sendDeleted);
        }
        else {
          sendDeleted();
        }
        delete this._pendingRequests[msg.handle];
        // XXX if we have persistedFolder/persistedUID, enqueue a delete of that
        // message and try and execute it.
        return;
      }

      var wireRep = msg.state;
      account = this.universe.getAccountForSenderIdentityId(wireRep.senderId);
      var identity = this.universe.getIdentityForSenderIdentityId(
                       wireRep.senderId);
      var sendType = wireRep.sendType;

      if (msg.command === 'send') {
        // To enqueue a message for sending:
        //   1. Save the draft.
        //   2. Move the draft to the outbox.
        //   3. Fire off a job to send pending outbox messages.

        req.persistedNamer = this.universe.saveDraft(
          account, req.persistedNamer, wireRep,
          function(err, newRecords) {
            req.active = null;
            if (req.die) {
              delete this._pendingRequests[msg.handle];
            }

            var outboxFolder = account.getFirstFolderWithType('outbox');
            this.universe.moveMessages([req.persistedNamer], outboxFolder.id);

            // We only want to display notifications if the universe
            // is online, i.e. we expect this sendOutboxMessages
            // invocation to actually fire immediately. If we're in
            // airplane mode, for instance, this job won't actually
            // run until we're online, in which case it no longer
            // makes sense to emit notifications for this job.
            this.universe.sendOutboxMessages(account, {
              reason: 'moved to outbox',
              emitNotifications: this.universe.online
            });
          }.bind(this));

        var initialSendStatus = {
          accountId: account.id,
          suid: req.persistedNamer.suid,
          state: (this.universe.online ? 'sending' : 'pending'),
          emitNotifications: true,
          sendType: sendType
        };

        // Send 'doneCompose' nearly immediately, as saveDraft might
        // take a while to complete if other stuff is going on. We'll
        // pass along the initialSendStatus so that we can immediately
        // display status information.
        this.__sendMessage({
          type: 'doneCompose',
          handle: msg.handle,
          sendStatus: initialSendStatus
        });

        // Broadcast the send status immediately here as well.
        this.universe.__notifyBackgroundSendStatus(initialSendStatus);
      }
      else if (msg.command === 'save') {
        // Save the draft, updating our persisted namer.
        req.persistedNamer = this.universe.saveDraft(
          account, req.persistedNamer, wireRep,
          function(err) {
            req.active = null;
            if (req.die)
              delete self._pendingRequests[msg.handle];
            self.__sendMessage({
              type: 'doneCompose',
              handle: msg.handle
            });
          });
      }
    }.bind(this));
  },

  notifyCronSyncStart: function mb_notifyCronSyncStart(accountIds) {
    this.__sendMessage({
      type: 'cronSyncStart',
      accountIds: accountIds
    });
  },

  notifyCronSyncStop: function mb_notifyCronSyncStop(accountsResults) {
    this.__sendMessage({
      type: 'cronSyncStop',
      accountsResults: accountsResults
    });
  },

  /**
   * Notify the frontend about the status of message sends. Data has
   * keys like 'state', 'error', etc, per the sendOutboxMessages job.
   */
  notifyBackgroundSendStatus: function(data) {
    this.__sendMessage({
      type: 'backgroundSendStatus',
      data: data
    });
  }

};

}); // end define
;
// asuth.

/**
 * ASCII-encoding tricks, particularly ordered-base64 encoding for
 * lexicographically ordered things like IndexedDB or 64-bit number support that
 * we can't use JS numbers for.
 *
 * The math logic is by me (asuth); hopefully it's not too embarassing.
 **/

define(
  'a64',[
    'exports'
  ],
  function(
    exports
  ) {

/**
 * A lexicographically ordered base64 encoding.  Our two extra characters are {
 * and } because they are at the top of the ordering space and have a clear (to
 * JS coders) ordering which makes it tractable to eyeball an encoded value and
 * not be completely confused/misled.
 */
var ORDERED_ARBITRARY_BASE64_CHARS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd',
  'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
  'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x',
  'y', 'z', '{', '}'
];
/**
 * Zero padding to get us up to the maximum encoding length of a 64-bit value in
 * our encoding (11) or for decimal re-conversion (16).
 */
var ZERO_PADDING = '0000000000000000';

/**
 * Encode a JS int in our base64 encoding.
 */
function encodeInt(v, padTo) {
  var sbits = [];
  do {
    // note: bitwise ops are 32-bit only.
    // so, this is fine:
    sbits.push(ORDERED_ARBITRARY_BASE64_CHARS[v & 0x3f]);
    // but this can't be >>> 6 and has to be a divide.
    v = Math.floor(v / 64);
  } while (v > 0);
  sbits.reverse();
  var estr = sbits.join('');
  if (padTo && estr.length < padTo)
    return ZERO_PADDING.substring(0, padTo - estr.length) + estr;
  return estr;
}
exports.encodeInt = encodeInt;

/**
 * 10^14 >> 14 so that its 'lowest' binary 1 ends up in the one's place.  It
 * is encoded in 33 bits itself.
 */
var E10_14_RSH_14 = Math.pow(10, 14) / Math.pow(2, 14),
      P2_14 = Math.pow(2, 14),
      P2_22 = Math.pow(2, 22),
      P2_32 = Math.pow(2, 32),
      P2_36 = Math.pow(2, 36),
      MASK32 = 0xffffffff;

/**
 * Convert a decimal uint64 string to a compact string representation that can
 * be compared using our helper method `cmpUI64`.  We could do direct straight
 * string comparison if we were willing to pad all strings out to 11 characters,
 * but that's a lot of overhead considering that we expect a lot of our values
 * to be muuuuch smaller.  (Appropriate padding can be requested for cases
 * where the ordering is explicitly desired, like IndexedDB keys.  Just only
 * request as many bits as you really need!)
 *
 * JS can handle up to 2^53 reliably which means that for numbers larger than
 * that we will have to do a second parse.  For that to work (easily), we need
 * to pick a power of 10 to cut at where the smallest '1' in its binary encoding
 * is at least in the 14th bit so we can pre-shift off 13 bits so when we
 * multiply by 10 we don't go floating point, as it were.  (We also need to add
 * in the relevant bits from the lower parse appropriately shifted.)
 */
exports.parseUI64 = function p(s, padTo) {
  // 2^53 is 16 digits long, so any string shorter than that can be handled
  // by the built-in logic.
  if (s.length < 16) {
    return encodeInt(parseInt(s, 10));
  }

  var lowParse = parseInt(s.substring(s.length - 14), 10),
      highParse = parseInt(s.substring(0, s.length - 14), 10),
      // multiply the high parse by our scaled power of 10
      rawHighBits = highParse * E10_14_RSH_14;

  // Now lowParse's low 14 bits are valid, but everything above that needs to
  // be mixed (by addition) with rawHighBits.  We'll mix in 22 bits from
  // rawHighBits to get lowBits to 36 useful bits.  The main thing is to lop off
  // the higher bits in rawHighBits that we don't want so they don't go float.
  // We do want the 37rd bit if there was addition overflow to carry to the
  // upper calculation.
  var lowBitsAdded = (((rawHighBits % P2_36) * P2_14) % P2_36 +
                      lowParse % P2_36),
      lowBits = lowBitsAdded % P2_36,
      overflow = Math.floor(lowBitsAdded / P2_36) % 2;

  // We can lop off the low 22-bits of the high bits (since lowBits is taking
  // care of that) and combine that with the bits of low above 36.
  var highBits = Math.floor(rawHighBits / P2_22) +
                 Math.floor(lowParse / P2_36) + overflow;

  var outStr = encodeInt(highBits) + encodeInt(lowBits, 6);
  if (padTo && outStr.length < padTo)
    return ZERO_PADDING.substring(0, padTo - outStr.length) + outStr;
  return outStr;
};

exports.cmpUI64 = function(a, b) {
  // longer equals bigger!
  var c = a.length - b.length;
  if (c !== 0)
    return c;

  if (a < b)
    return -1;
  else if (a > b)
    return 1;
  return 0;
};

/**
 * Convert the output of `parseUI64` back into a decimal string.
 */
exports.decodeUI64 = function d(es) {
  var iNonZero = 0;
  for (;es.charCodeAt(iNonZero) === 48; iNonZero++) {
  }
  if (iNonZero)
    es = es.substring(iNonZero);

  var v, i;
  // 8 characters is 48 bits, JS can do that internally.
  if (es.length <= 8) {
    v = 0;
    for (i = 0; i < es.length; i++) {
      v = v * 64 + ORDERED_ARBITRARY_BASE64_CHARS.indexOf(es[i]);
    }
    return v.toString(10);
  }

  // upper-string gets 28 bits (that could hold 30), lower-string gets 36 bits.
  // This is how we did things in encoding is why.
  var ues = es.substring(0, es.length - 6), uv = 0,
      les = es.substring(es.length - 6), lv = 0;

  for (i = 0; i < ues.length; i++) {
    uv = uv * 64 + ORDERED_ARBITRARY_BASE64_CHARS.indexOf(ues[i]);
  }
  for (i = 0; i < les.length; i++) {
    lv = lv * 64 + ORDERED_ARBITRARY_BASE64_CHARS.indexOf(les[i]);
  }

  // Do the division to figure out the "high" string from our encoding (a whole
  // number.)  Then subtract that whole number off our effective number, leaving
  // us dealing with <53 bits so we can just hand it off to the JS engine.

  var rsh14val = (uv * P2_22 + Math.floor(lv / P2_14)),
      uraw = rsh14val / E10_14_RSH_14,
      udv = Math.floor(uraw),
      uds = udv.toString();

  var rsh14Leftover = rsh14val - udv * E10_14_RSH_14,
      lowBitsRemoved = rsh14Leftover * P2_14 + lv % P2_14;

  var lds = lowBitsRemoved.toString();
  if (lds.length < 14)
    lds = ZERO_PADDING.substring(0, 14 - lds.length) + lds;

  return uds + lds;
};
//d(p('10000000000000000'));
//d(p('18014398509481984'));
//d(p('1171221845949812801'));

}); // end define
;
define(
  'syncbase',[
    './date',
    'exports'
  ],
  function(
    $date,
    exports
  ) {

////////////////////////////////////////////////////////////////////////////////
// IMAP time constants

/**
 * How recently synchronized does a time range have to be for us to decide that
 * we don't need to refresh the contents of the time range when opening a slice?
 * If the last full synchronization is more than this many milliseconds old, we
 * will trigger a refresh, otherwise we will skip it.
 */
exports.OPEN_REFRESH_THRESH_MS = 10 * 60 * 1000;

/**
 * How recently synchronized does a time range have to be for us to decide that
 * we don't need to refresh the contents of the time range when growing a slice?
 * If the last full synchronization is more than this many milliseconds old, we
 * will trigger a refresh, otherwise we will skip it.
 */
exports.GROW_REFRESH_THRESH_MS = 60 * 60 * 1000;

////////////////////////////////////////////////////////////////////////////////
// Database Block constants
//
// Used to live in mailslice.js, but they got out of sync with the below which
// caused problems.

exports.EXPECTED_BLOCK_SIZE = 8;

/**
 * What is the maximum number of bytes a block should store before we split
 * it?
 */
exports.MAX_BLOCK_SIZE = exports.EXPECTED_BLOCK_SIZE * 1024,
/**
 * How many bytes should we target for the small part when splitting 1:2?
 */
exports.BLOCK_SPLIT_SMALL_PART = (exports.EXPECTED_BLOCK_SIZE / 3) * 1024,
/**
 * How many bytes should we target for equal parts when splitting 1:1?
 */
exports.BLOCK_SPLIT_EQUAL_PART = (exports.EXPECTED_BLOCK_SIZE / 2) * 1024,
/**
 * How many bytes should we target for the large part when splitting 1:2?
 */
exports.BLOCK_SPLIT_LARGE_PART = (exports.EXPECTED_BLOCK_SIZE / 1.5) * 1024;


////////////////////////////////////////////////////////////////////////////////
// Block Purging Constants (IMAP only)
//
// These values are all intended for resource-constrained mobile devices.  A
// more powerful tablet-class or desktop-class app would probably want to crank
// the values way up.

/**
 * Every time we create this many new body blocks, queue a purge job for the
 * folder.
 *
 * Body sizes are most variable and should usually take up more space than their
 * owning header blocks, so it makes sense for this to be the proxy we use for
 * disk space usage/growth.
 *
 * This used to be 4 when EXPECTED_BLOCK_SIZE was 96, it's now 8.  A naive
 * scaling would be by 12 to 48, but that doesn't handle that blocks can be
 * over the limit, so we want to aim a little lower, so 32.
 */
exports.BLOCK_PURGE_EVERY_N_NEW_BODY_BLOCKS = 32;

/**
 * How much time must have elapsed since the given messages were last
 * synchronized before purging?  Our accuracy ranges are updated whenever we are
 * online and we attempt to display messages.  So before we purge messages, we
 * make sure that the accuracy range covering the messages was updated at least
 * this long ago before deciding to purge.
 */
exports.BLOCK_PURGE_ONLY_AFTER_UNSYNCED_MS = 14 * $date.DAY_MILLIS;

/**
 * What is the absolute maximum number of blocks we will store per folder for
 * each block type?  If we have more blocks than this, we will discard them
 * regardless of any time considerations.
 *
 * The hypothetical upper bound for disk uage per folder is:
 * X 'number of blocks' * 2 'types of blocks' * 8k 'maximum block size'.  In
 * reality, blocks can be larger than their target if they have very large
 * bodies.
 *
 * This was 128 when our target size was 96k for a total of 24 megabytes.  Now
 * that our target size is 8k we're only scaling up by 8 instead of 12 because
 * of the potential for a large number of overage blocks.  This takes us to a
 * max of 1024 blocks.
 *
 * This is intended to protect people who have ridiculously high message
 * densities from time-based heuristics not discarding things fast enough.
 */
exports.BLOCK_PURGE_HARD_MAX_BLOCK_LIMIT = 1024;

////////////////////////////////////////////////////////////////////////////////
// POP3 Sync Constants

/**
 * As we're syncing with POP3, pause every N messages to save state to disk.
 * This value was chosen somewhat arbitrarily.
 */
exports.POP3_SAVE_STATE_EVERY_N_MESSAGES = 50;


/**
 * The maximum number of messages to retrieve during a single POP3
 * sync operation. If the number of unhandled messages left in the
 * spool exceeds this value, leftover messages will be filtered out of
 * this sync operation. They can later be downloaded through a
 * "download more messages..." option as per
 * <https://bugzil.la/939375>.
 *
 * This value (initially 100) is selected to be large enough that most
 * POP3 users won't exceed this many new messages in a given sync, but
 * small enough that we won't get completely overwhelmed that we have
 * to download this many headers.
 */
exports.POP3_MAX_MESSAGES_PER_SYNC = 100;


/**
 * If a message is larger than INFER_ATTACHMENTS_SIZE bytes, guess
 * that it has an attachment.
 */
exports.POP3_INFER_ATTACHMENTS_SIZE = 512 * 1024;


/**
 * Attempt to fetch this many bytes of messages during snippet fetching.
 */
exports.POP3_SNIPPET_SIZE_GOAL = 4 * 1024; // in bytes

////////////////////////////////////////////////////////////////////////////////
// General Sync Constants

/**
 * How frequently do we want to automatically synchronize our folder list?
 * Currently, we think that once a day is sufficient.  This is a lower bound,
 * we may sync less frequently than this.
 */
exports.SYNC_FOLDER_LIST_EVERY_MS = $date.DAY_MILLIS;

/**
 * How many messages should we send to the UI in the first go?
 */
exports.INITIAL_FILL_SIZE = 15;

/**
 * How many days in the past should we first look for messages.
 *
 * IMAP only.
 */
exports.INITIAL_SYNC_DAYS = 3;

/**
 * When growing our synchronization range, what should be the initial number of
 * days we should scan?
 */
exports.INITIAL_SYNC_GROWTH_DAYS = 3;

/**
 * What should be multiple the current number of sync days by when we perform
 * a sync and don't find any messages?  There are upper bounds in
 * `ImapFolderSyncer.onSyncCompleted` that cap this and there's more comments
 * there.  Note that we keep moving our window back as we go.
 *
 * This was 1.6 for a while, but it was proving to be a bit slow when the first
 * messages start a ways back.  Also, once we moved to just syncing headers
 * without bodies, the cost of fetching more than strictly required went way
 * down.
 *
 * IMAP only.
 */
exports.TIME_SCALE_FACTOR_ON_NO_MESSAGES = 2;

/**
 * What is the furthest back in time we are willing to go?  This is an
 * arbitrary choice to avoid our logic going crazy, not to punish people with
 * comprehensive mail collections.
 *
 * All of our sync range timestamps are quantized UTC days, so we are sure to
 * use an already UTC-quantized timestamp here.
 *
 * IMAP only.
 */
exports.OLDEST_SYNC_DATE = Date.UTC(1990, 0, 1);

/**
 * Don't bother with iterative deepening if a folder has less than this many
 * messages; just sync the whole thing.  The trade-offs here are:
 *
 * - Not wanting to fetch more messages than we need.
 * - Because header envelope fetches are done in a batch and IMAP servers like
 *   to sort UIDs from low-to-high, we will get the oldest messages first.
 *   This can be mitigated by having our sync logic use request windowing to
 *   offset this.
 * - The time required to fetch the headers versus the time required to
 *   perform deepening.  Because of network and disk I/O, deepening can take
 *   a very long time
 *
 * IMAP only.
 */
exports.SYNC_WHOLE_FOLDER_AT_N_MESSAGES = 40;

/**
 * If we issued a search for a date range and we are getting told about more
 * than the following number of messages, we will try and reduce the date
 * range proportionately (assuming a linear distribution) so that we sync
 * a smaller number of messages.  This will result in some wasted traffic
 * but better a small wasted amount (for UIDs) than a larger wasted amount
 * (to get the dates for all the messages.)
 *
 * IMAP only.
 */
exports.BISECT_DATE_AT_N_MESSAGES = 60;

/**
 * What's the maximum number of messages we should ever handle in a go and
 * where we should start failing by pretending like we haven't heard of the
 * excess messages?  This is a question of message time-density and not a
 * limitation on the number of messages in a folder.
 *
 * This could be eliminated by adjusting time ranges when we know the
 * density is high (from our block indices) or by re-issuing search results
 * when the server is telling us more than we can handle.
 *
 * IMAP only.
 */
exports.TOO_MANY_MESSAGES = 2000;

/**
 * How fuzzy should we consider the results from an IMAP server's
 * SEARCH? Our database lookup during IMAP sync is extended on both
 * sides by this amount. (IMAP servers do not consistently return
 * SEARCH results, primarily due to timezone and implementation
 * inconsistencies; see bug 886534.)
 *
 * IMAP only, fortunately.
 */
exports.IMAP_SEARCH_AMBIGUITY_MS = $date.DAY_MILLIS;

////////////////////////////////////////////////////////////////////////////////
// Size Estimate Constants

/**
 * The estimated size of a `HeaderInfo` structure.  We are using a constant
 * since there is not a lot of variability in what we are storing and this
 * is probably good enough.
 *
 * Our estimate is based on guesses based on presumed structured clone encoding
 * costs for each field using a reasonable upper bound for length.  Our
 * estimates are trying not to factor in compressability too much since our
 * block size targets are based on the uncompressed size.
 * - id: 4: integer less than 64k
 * - srvid: 40: 38 char uuid with {}'s, (these are uuid's on hotmail)
 * - suid: 13: 'xx/xx/xxxxx' (11)
 * - guid: 80: 66 character (unquoted) message-id from gmail, 48 from moco.
 *         This is unlikely to compress well and there could be more entropy
 *         out there, so guess high.
 * - author: 70: 32 for the e-mail address covers to 99%, another 32 for the
 *           display name which will usually be shorter than 32 but could
 *           involve encoded characters that bloat the utf8 persistence.
 * - date: 9: double that will be largely used)
 * - flags: 32: list which should normally top out at ['\Seen', '\Flagged'], but
 *              could end up with non-junk markers, etc. so plan for at least
 *              one extra.
 * - hasAttachments: 2: boolean
 * - subject: 80
 * - snippet: 100 (we target 100, it will come in under)
 */
exports.HEADER_EST_SIZE_IN_BYTES = 430;


////////////////////////////////////////////////////////////////////////////////
// Error / Retry Constants

/**
 * What is the maximum number of tries we should give an operation before
 * giving up on the operation as hopeless?  Note that in some suspicious
 * error cases, the try cont will be incremented by more than 1.
 *
 * This value is somewhat generous because we do assume that when we do
 * encounter a flakey connection, there is a high probability of the connection
 * being flakey in the short term.  The operations will not be excessively
 * penalized for this since IMAP connections have to do a lot of legwork to
 * establish the connection before we start the operation (CAPABILITY, LOGIN,
 * CAPABILITY).
 */
exports.MAX_OP_TRY_COUNT = 10;

/**
 * The value to increment the operation tryCount by if we receive an
 * unexpected error.
 */
exports.OP_UNKNOWN_ERROR_TRY_COUNT_INCREMENT = 5;

/**
 * If we need to defer an operation because the folder/resource was not
 * available, how long should we defer for?
 */
exports.DEFERRED_OP_DELAY_MS = 30 * 1000;

////////////////////////////////////////////////////////////////////////////////
// General defaults

/**
 * We use an enumerated set of sync values for UI localization reasons; time
 * is complex and we don't have/use a helper library for this.
 */
exports.CHECK_INTERVALS_ENUMS_TO_MS = {
  'manual': 0, // 0 disables; no infinite checking!
  '3min': 3 * 60 * 1000,
  '5min': 5 * 60 * 1000,
  '10min': 10 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '60min': 60 * 60 * 1000,
};

/**
 * Default to not automatically checking for e-mail for reasons to avoid
 * degrading the phone experience until we are more confident about our resource
 * usage, etc.
 */
exports.DEFAULT_CHECK_INTERVAL_ENUM = 'manual';

/**
 * How many milliseconds should we wait before giving up on the
 * connection?
 *
 * This really wants to be adaptive based on the type of the
 * connection, but right now we have no accurate way of guessing how
 * good the connection is in terms of latency, overall internet
 * speed, etc. Experience has shown that 10 seconds is currently
 * insufficient on an unagi device on 2G on an AT&T network in
 * American suburbs, although some of that may be problems internal
 * to the device. I am tripling that to 30 seconds for now because
 * although it's horrible to drag out a failed connection to an
 * unresponsive server, it's far worse to fail to connect to a real
 * server on a bad network, etc.
 */
exports.CONNECT_TIMEOUT_MS = 30000;

/**
 * When an IMAP connection has been left in the connection pool for
 * this amount of time, don't use that connection; spin up a fresh
 * connection instead. This value should be large enough that we don't
 * constantly spin up new connections, but short enough that we might
 * actually have connections open for that length of time.
 */
exports.STALE_CONNECTION_TIMEOUT_MS = 30000;

/**
 * Kill any open IMAP connections if there are no jobs pending and there are no
 * slices open. This flag is mainly just for unit test sanity because 1) most
 * tests were written before this flag existed and 2) most tests don't care.
 * This gets disabled by default in testing; tests that care should turn this
 * back on.
 */
exports.KILL_CONNECTIONS_WHEN_JOBLESS = true;


var DAY_MILLIS = 24 * 60 * 60 * 1000;

/**
 * Map the ActiveSync-limited list of sync ranges to milliseconds.  Do NOT
 * add additional values to this mapping unless you make sure that our UI
 * properly limits ActiveSync accounts to what the protocol supports.
 */
exports.SYNC_RANGE_ENUMS_TO_MS = {
  // This choice is being made for IMAP.
  'auto': 30 * DAY_MILLIS,
    '1d': 1 * DAY_MILLIS,
    '3d': 3 * DAY_MILLIS,
    '1w': 7 * DAY_MILLIS,
    '2w': 14 * DAY_MILLIS,
    '1m': 30 * DAY_MILLIS,
   'all': 30 * 365 * DAY_MILLIS,
};

////////////////////////////////////////////////////////////////////////////////
// Cronsync/periodic sync stuff

/**
 * Caps the number of quas-headers we report to the front-end via cronsync
 * completion notifications (per-account).  We report the newest headers from
 * each sync.
 *
 * The value 5 was arbitrarily chosen, but per :jrburke, the current (hamachi,
 * flame) phone devices in portrait orientation "can fit about three unique
 * names in a grouped notification", so 5 still seems like a pretty good value.
 * This may want to change on landscape devices or devices with more screen
 * real-estate, like tablets.
 */
exports.CRONSYNC_MAX_MESSAGES_TO_REPORT_PER_ACCOUNT = 5;

/**
 * Caps the number of snippets we are willing to fetch as part of each cronsync
 * for each account.  We fetch snippets for the newest headers.
 *
 * The primary factors here are:
 * - Latency of sync reporting.  Right now, snippet fetches will defer the
 *   cronsync completion notification.
 * - Optimizing UX by having the snippets already available when the user goes
 *   to view the message list, at least the top of the message list.  An
 *   interacting factor is how good the UI is at requesting snippets in
 *   advance of messages being displayed on the screen.
 *
 * The initial/current value of 5 was chosen because a Hamachi device could
 * show 5 messages on the screen at a time.  On fancier devices like the flame,
 * this is still approximately right; about 5.5 messages are visible on 2.0,
 * with the snippet part for the last one not displayed.
 */
exports.CRONSYNC_MAX_SNIPPETS_TO_FETCH_PER_ACCOUNT = 5;

/**
 * What's the largest portion of a message's body content to fetch in order
 * to generate a snippet?
 *
 * The 4k value is chosen to match the Gaia mail app's use of 4k in its
 * snippet fetchin as we scroll.  Arguably that choice should be superseded
 * by this constant in the future.
 * TODO: make front-end stop specifying snippet size.
 */
exports.MAX_SNIPPET_BYTES = 4 * 1024;

////////////////////////////////////////////////////////////////////////////////
// Unit test support

/**
 * Override individual syncbase values for unit testing. Any key in
 * syncbase can be overridden.
 */
exports.TEST_adjustSyncValues = function TEST_adjustSyncValues(syncValues) {

  // Legacy values: This function used to accept a mapping that didn't
  // match one-to-one with constant names, but was changed to map
  // directly to constant names for simpler grepping.
  var legacyKeys = {
    fillSize: 'INITIAL_FILL_SIZE',
    days: 'INITIAL_SYNC_DAYS',
    growDays: 'INITIAL_SYNC_GROWTH_DAYS',
    wholeFolderSync: 'SYNC_WHOLE_FOLDER_AT_N_MESSAGES',
    bisectThresh: 'BISECT_DATE_AT_N_MESSAGES',
    tooMany: 'TOO_MANY_MESSAGES',
    scaleFactor: 'TIME_SCALE_FACTOR_ON_NO_MESSAGES',
    openRefreshThresh: 'OPEN_REFRESH_THRESH_MS',
    growRefreshThresh: 'GROW_REFRESH_THRESH_MS',
  };

  for (var key in syncValues) if (syncValues.hasOwnProperty(key)) {
    var outKey = legacyKeys[key] || key;
    if (exports.hasOwnProperty(outKey)) {
      exports[outKey] = syncValues[key];
    } else {
      // In the future (after we have a chance to review all calls to
      // this function), we could make this throw an exception
      // instead.
      console.warn('Invalid key for TEST_adjustSyncValues: ' + key);
    }
  }
};

}); // end define
;
/**
 *
 **/

define(
  'maildb',[
    './worker-router',
    'exports'
  ],
  function(
    $router,
    exports
  ) {


var sendMessage = $router.registerCallbackType('maildb');

function MailDB(testOptions) {
  this._callbacksQueue = [];
  function processQueue() {
    console.log('main thread reports DB ready');
    this._ready = true;

    this._callbacksQueue.forEach(function executeCallback(cb) {
      cb();
    });
    this._callbacksQueue = null;
  }

  sendMessage('open', [testOptions], processQueue.bind(this));
}
exports.MailDB = MailDB;
MailDB.prototype = {
  close: function() {
    sendMessage('close');
  },

  getConfig: function(callback) {
    if (!this._ready) {
      console.log('deferring getConfig call until ready');
      this._callbacksQueue.push(this.getConfig.bind(this, callback));
      return;
    }

    console.log('issuing getConfig call to main thread');
    sendMessage('getConfig', null, callback);
  },

  saveConfig: function(config) {
    sendMessage('saveConfig', [config]);
  },

  saveAccountDef: function(config, accountDef, folderInfo, callback) {
    sendMessage('saveAccountDef', [ config, accountDef, folderInfo ], callback);
  },

  loadHeaderBlock: function(folderId, blockId, callback) {
    sendMessage('loadHeaderBlock', [ folderId, blockId], callback);
  },

  loadBodyBlock: function(folderId, blockId, callback) {
    sendMessage('loadBodyBlock', [ folderId, blockId], callback);
  },

  saveAccountFolderStates: function(accountId, folderInfo, perFolderStuff,
                                    deletedFolderIds, callback, reuseTrans) {
    var args = [ accountId, folderInfo, perFolderStuff, deletedFolderIds ];
    sendMessage('saveAccountFolderStates', args, callback);
    // XXX vn Does this deserve any purpose?
    return null;
  },

  deleteAccount: function(accountId) {
    sendMessage('deleteAccount', [accountId]);
  },
};

}); // end define
;
/**
 * Simple coordination logic that might be better handled by promises, although
 * we probably have the edge in comprehensibility for now.
 **/

define('allback',['exports'], function(exports) {

/**
 * Create multiple named callbacks whose results are aggregated and a single
 * callback invoked once all the callbacks have returned their result.  This
 * is intended to provide similar benefit to $Q.all in our non-promise world
 * while also possibly being more useful.
 *
 * Example:
 * @js{
 *   var callbacks = allbackMaker(['foo', 'bar'], function(aggrData) {
 *       console.log("Foo's result was", aggrData.foo);
 *       console.log("Bar's result was", aggrData.bar);
 *     });
 *   asyncFooFunc(callbacks.foo);
 *   asyncBarFunc(callbacks.bar);
 * }
 *
 * Protection against a callback being invoked multiple times is provided as
 * an anti-foot-shooting measure.  Timeout logic and other protection against
 * potential memory leaks is not currently provided, but could be.
 */
exports.allbackMaker = function allbackMaker(names, allDoneCallback) {
  var aggrData = Object.create(null), callbacks = {},
      waitingFor = names.concat();

  names.forEach(function(name) {
    // (build a consistent shape for aggrData regardless of callback ordering)
    aggrData[name] = undefined;
    callbacks[name] = function anAllback(callbackResult) {
      var i = waitingFor.indexOf(name);
      if (i === -1) {
        console.error("Callback '" + name + "' fired multiple times!");
        throw new Error("Callback '" + name + "' fired multiple times!");
      }
      waitingFor.splice(i, 1);
      if (arguments.length > 1)
        aggrData[name] = arguments;
      else
        aggrData[name] = callbackResult;
      if (waitingFor.length === 0 && allDoneCallback)
        allDoneCallback(aggrData);
    };
  });

  return callbacks;
};


/**
 * A lightweight deferred 'run-all'-like construct for waiting for
 * multiple callbacks to finish executing, with a final completion
 * callback at the end. Neither promises nor Q provide a construct
 * quite like this; Q.all and Promise.all tend to either require all
 * promises to be created up front, or they return when the first
 * error occurs. This is designed to allow you to wait for an unknown
 * number of callbacks, with the knowledge that they're going to
 * execute anyway -- no sense trying to abort early.
 *
 * Results passed to each callback can be passed along to the final
 * result by adding a `name` parameter when calling latch.defer().
 *
 * Example usage:
 *
 * var latch = allback.latch();
 * setTimeout(latch.defer('timeout1'), 200);
 * var cb = latch.defer('timeout2');
 * cb('foo');
 * latch.then(function(results) {
 *   console.log(results.timeout2[0]); // => 'foo'
 * });
 *
 * The returned latch is an A+ Promises-compatible thennable, so you
 * can chain multiple callbacks to the latch.
 *
 * The promise will never fail; it will always succeed. Each
 * `.defer()` call can be passed a `name`; if a name is provided, that
 * callback's arguments will be made available as a key on the result
 * object.
 *
 * NOTE: The latch will not actually fire completion until you've
 * attached a callback handler. This way, you can create the latch
 * before you know how many callbacks you'll need; when you've called
 * .defer() as many times as necessary, you can call `then()` to
 * actually fire the completion function (when they have all
 * completed).
 */
exports.latch = function() {
  var ready = false;
  var deferred = {};
  // Avoid Object.prototype and any for-enumerations getting tripped up
  var results = Object.create(null);
  var count = 0;

  deferred.promise = new Promise(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  function defer(name) {
    count++;
    var resolved = false;
    return function resolve() {
      if (resolved) {
        var err = new Error("You have already resolved this deferred!");
        // Exceptions aren't always readily visible, but this is a
        // serious error and needs to be addressed.
        console.error(err + '\n' + err.stack);
        throw err;
      }
      resolved = true;
      // 'name' might be the integer zero (among other integers) if
      // the callee is doing array processing, so we pass anything not
      // equalling null and undefined, even the poor falsey zero.
      if (name != null) {
        results[name] = Array.slice(arguments);
      }
      if (--count === 0) {
        setZeroTimeout(function() {
          deferred.resolve(results);
        });
      }
    };
  }
  var unlatch = defer();
  return {
    defer: defer,
    then: function () {
      var ret = deferred.promise.then.apply(deferred.promise, arguments);
      if (!ready) {
        ready = true;
        unlatch();
      }
      return ret;
    }
  };
};

/**
 * Given the results object from an allback.latch() where named callbacks were
 * used (or else we won't save the result!) and the callbacks use the form of
 * callback(errIfAny, ...), find and return the first error object, or return
 * null if none was found.
 *
 * Important notes:
 * - Use this for callback-based idioms in the node style
 * - You MUST use latch.defer(name), not latch.defer()!
 * - Because of JS object property ordering, we actually will return the result
 *   of the first callback that fired with an error value, but you probably
 *   do not want to be depending on this too much.
 */
exports.extractErrFromCallbackArgs = function(results) {
  // If there are any errors, find and propagate.
  var anyErr = null;
  for (var key in results) {
    var args = results[key];
    var errIfAny = args[0];
    if (errIfAny) {
      anyErr = errIfAny;
      break;
    }
  }
  return anyErr;
};

exports.latchedWithRejections = function(namedPromises) {
  return new Promise(function(resolve, reject) {
    // Avoid Object.prototype
    var results = Object.create(null);
    var pending = 0;
    Object.keys(namedPromises).forEach(function(name) {
      pending++;
      var promise = namedPromises[name];
      promise.then(
        function(result) {
          results[name] = { resolved: true, value: result };
          if (--pending === 0) {
            resolve(results);
          }
        },
        function(err) {
          results[name] = { resolved: false, value: err };
          if (--pending === 0) {
            resolve(results);
          }
        });
    });
    // If we didn't end up scheduling anything
    if (!pending) {
      resolve(results);
    }
  });
};

}); // end define
;
/**
 * Presents a message-centric view of a slice of time from IMAP search results.
 *
 * == Use-case assumptions
 *
 * - We are backing a UI showing a list of time-ordered messages.  This can be
 *   the contents of a folder, on-server search results, or the
 *   (server-facilitated) list of messages in a conversation.
 * - We want to fetch more messages as the user scrolls so that the entire
 *   contents of the folder/search results list are available.
 * - We want to show the message as soon as possible.  So we can show a message
 *   in the list before we have its snippet.  However, we do want the
 *   bodystructure before we show it so we can accurately know if it has
 *   attachments.
 * - We want to update the state of the messages in real-time as we hear about
 *   changes from the server, such as another client starring a message or
 *   marking the message read.
 * - We will synchronize some folders with either a time and/or message count
 *   threshold.
 * - We want mutations made locally to appear as if they are applied
 *   immediately, even if we are operating offline.
 *
 * == Efficiency desires
 *
 * - Avoid redundant network traffic by caching our results using IndexedDB.
 * - Keep the I/O burden and overhead low from caching/sync.  We know our
 *   primary IndexedDB implementation is backed by SQLite with full
 *   transaction commits corresponding to IndexedDB transaction commits.
 *   We also know that all IndexedDB work gets marshaled to another thread.
 *   Since the server is the final word in state, except for mutations we
 *   trigger, we don't need to be aggressive about persisting state.
 *   Accordingly, let's persist our data in big blocks only on major
 *   transitions (folder change) or when our memory usage is getting high.
 *   (If we were using LevelDB, large writes would probably be less
 *   desirable.)
 *
 * == Of slices, folders, and gmail
 *
 * It would be silly for a slice that is for browsing the folder unfiltered and
 * a slice that is a result of a search to act as if they were dealing with
 * different messages.  Similarly, it would be silly in gmail for us to fetch
 * a message that we know is the same message across multiple (labels as)
 * folders.  So we abstract away the storage details to `FolderStorage`.
 *
 * == Latency, offline access, and IMAP
 *
 * The fundamental trade-off is between delaying showing things in the UI and
 * showing them and then having a bunch of stuff happen a split-second later.
 * (Messages appearing, disappearing, having their status change, etc.)
 *
 **/

define('mailslice',['require','exports','module','logic','./util','./a64','./allback','./date','./syncbase'],function(require, exports, module) {

var logic = require('logic');
var $util = require('./util');
var $a64 = require('./a64');
var $allback = require('./allback');
var $date = require('./date');
var $sync = require('./syncbase');

var bsearchForInsert = $util.bsearchForInsert,
    bsearchMaybeExists = $util.bsearchMaybeExists,
    cmpHeaderYoungToOld = $util.cmpHeaderYoungToOld,
    allbackMaker = $allback.allbackMaker,
    BEFORE = $date.BEFORE,
    ON_OR_BEFORE = $date.ON_OR_BEFORE,
    SINCE = $date.SINCE,
    STRICTLY_AFTER = $date.STRICTLY_AFTER,
    IN_BS_DATE_RANGE = $date.IN_BS_DATE_RANGE,
    HOUR_MILLIS = $date.HOUR_MILLIS,
    DAY_MILLIS = $date.DAY_MILLIS,
    NOW = $date.NOW,
    quantizeDate = $date.quantizeDate,
    quantizeDateUp = $date.quantizeDateUp;

var PASTWARDS = 1, FUTUREWARDS = -1;

// What do we think the post-snappy compression overhead of the structured clone
// persistence rep will be for various things?  These are total guesses right
// now.  Keep in mind we do want the pre-compression size of the data in all
// cases and we just hope it will compress a bit.  For the attributes we are
// including the attribute name as well as any fixed-overhead for its payload,
// especially numbers which may or may not be zig-zag encoded/etc.
var OBJ_OVERHEAD_EST = 2, STR_ATTR_OVERHEAD_EST = 5,
    NUM_ATTR_OVERHEAD_EST = 10, LIST_ATTR_OVERHEAD_EST = 4,
    NULL_ATTR_OVERHEAD_EST = 2, LIST_OVERHEAD_EST = 4,
    NUM_OVERHEAD_EST = 8, STR_OVERHEAD_EST = 4;

/**
 * Intersects two objects each defining tupled ranges of the type
 * { startTS, startUID, endTS, endUID }, like block infos and mail slices.
 * This is exported for unit testing purposes and because no state is closed
 * over.
 */
var tupleRangeIntersectsTupleRange = exports.tupleRangeIntersectsTupleRange =
    function tupleRangeIntersectsTupleRange(a, b) {
  if (BEFORE(a.endTS, b.startTS) ||
      STRICTLY_AFTER(a.startTS, b.endTS))
    return false;
  if ((a.endTS === b.startTS && a.endUID < b.startUID) ||
      (a.startTS === b.endTS && a.startTS > b.endUID))
    return false;
  return true;
};

/**
 * How much progress in the range [0.0, 1.0] should we report for just having
 * started the synchronization process?  The idea is that by having this be
 * greater than 0, our progress bar indicates that we are doing something or
 * at least know we should be doing something.
 */
var SYNC_START_MINIMUM_PROGRESS = 0.02;

/**
 * Book-keeping and limited agency for the slices.
 *
 * === Batching ===
 * Headers are removed, added, or modified using the onHeader* methods.
 * The updates are sent to 'SliceBridgeProxy' which batches updates and
 * puts them on the event loop. We batch so that we can minimize the number of
 * reflows and painting on the DOM side. This also enables us to batch data
 * received in network packets around the smae time without having to handle it in
 * each protocol's logic.
 *
 * Currently, we only batch updates that are done between 'now' and the next time
 * a zeroTimeout can fire on the event loop.  In order to keep the UI responsive,
 * We force flushes if we have more than 5 pending slices to send.
 */
function MailSlice(bridgeHandle, storage, fillSize) {
  this._bridgeHandle = bridgeHandle;
  bridgeHandle.__listener = this;
  this._storage = storage;

  logic.defineScope(this, 'MailSlice', { bridgeHandle: bridgeHandle._handle });

  // The time range of the headers we are looking at right now.
  this.startTS = null;
  this.startUID = null;
  // If the end values line up with the most recent message known about for this
  // folder, then we will grow to encompass more recent messages.
  this.endTS = null;
  this.endUID = null;

  /**
   * A string value for hypothetical debugging purposes, but which is coerced
   * to a Boolean value for some of our slice notifications as both the
   * userRequested/moreExpected values, although they aren't super important.
   */
  this.waitingOnData = false;

  /**
   * If true, don't add any headers.  This is used by ActiveSync during its
   * synchronization step to wait until all headers have been retrieved and
   * then the slice is populated from the database.  After this initial sync,
   * ignoreHeaders is set to false so that updates and (hopefully small
   * numbers of) additions/removals can be observed.
   */
  this.ignoreHeaders = false;

  /**
   * @listof[HeaderInfo]
   */
  this.headers = [];
  if (fillSize) {
    $sync.INITIAL_FILL_SIZE = fillSize;
  }
  this.desiredHeaders = $sync.INITIAL_FILL_SIZE;

  this.headerCount = storage.headerCount;
}
exports.MailSlice = MailSlice;
MailSlice.prototype = {
  /**
   * We are a folder-backed view-slice.
   */
  type: 'folder',

  set atTop(val) {
    if (this._bridgeHandle)
      this._bridgeHandle.atTop = val;
    return val;
  },
  set atBottom(val) {
    if (this._bridgeHandle)
      this._bridgeHandle.atBottom = val;
    return val;
  },
  set userCanGrowUpwards(val) {
    if (this._bridgeHandle)
      this._bridgeHandle.userCanGrowUpwards = val;
    return val;
  },
  set userCanGrowDownwards(val) {
    if (this._bridgeHandle)
      this._bridgeHandle.userCanGrowDownwards = val;
    return val;
  },
  get headerCount() {
    if (this._bridgeHandle) {
      return this._bridgeHandle.headerCount;
    }
    return null;
  },
  set headerCount(val) {
    if (this._bridgeHandle)
      this._bridgeHandle.headerCount = val;
    return val;
  },

  _updateSliceFlags: function() {
    var flagHolder = this._bridgeHandle;
    flagHolder.atTop = this._storage.headerIsYoungestKnown(this.endTS,
                                                           this.endUID);
    flagHolder.atBottom = this._storage.headerIsOldestKnown(this.startTS,
                                                            this.startUID);
    if (flagHolder.atTop)
      flagHolder.userCanGrowUpwards = !this._storage.syncedToToday();
    else
      flagHolder.userCanGrowUpwards = false;

    if (flagHolder.atBottom)
      flagHolder.userCanGrowDownwards = !this._storage.syncedToDawnOfTime();
    else
      flagHolder.userCanGrowDownwards = false;
  },

  /**
   * Reset the state of the slice, clearing out any known headers.
   */
  reset: function() {
    if (!this._bridgeHandle)
      return;
    this.headerCount = this._storage.headerCount;

    if (this.headers.length) {
      this._bridgeHandle.sendSplice(0, this.headers.length, [], false, true);
      this.headers.splice(0, this.headers.length);

      this.startTS = null;
      this.startUID = null;
      this.endTS = null;
      this.endUID = null;
    }
  },

  /**
   * Force an update of our current date range.
   */
  refresh: function() {
    this._storage.refreshSlice(this);
  },

  reqNoteRanges: function(firstIndex, firstSuid, lastIndex, lastSuid) {
    if (!this._bridgeHandle)
      return;

    var i;
    // - Fixup indices if required
    if (firstIndex >= this.headers.length ||
        this.headers[firstIndex].suid !== firstSuid) {
      firstIndex = 0; // default to not splicing if it's gone
      for (i = 0; i < this.headers.length; i++) {
        if (this.headers[i].suid === firstSuid) {
          firstIndex = i;
          break;
        }
      }
    }
    if (lastIndex >= this.headers.length ||
        this.headers[lastIndex].suid !== lastSuid) {
      for (i = this.headers.length - 1; i >= 0; i--) {
        if (this.headers[i].suid === lastSuid) {
          lastIndex = i;
          break;
        }
      }
    }

    // - Perform splices as required
    // (high before low to avoid index changes)
    if (lastIndex + 1 < this.headers.length) {
      this.atBottom = false;
      this.userCanGrowDownwards = false;
      var delCount = this.headers.length - lastIndex  - 1;
      this.desiredHeaders -= delCount;
      this._bridgeHandle.sendSplice(
        lastIndex + 1, delCount, [],
        // This is expected; more coming if there's a low-end splice
        true, firstIndex > 0);
      this.headers.splice(lastIndex + 1, this.headers.length - lastIndex - 1);
      var lastHeader = this.headers[lastIndex];
      this.startTS = lastHeader.date;
      this.startUID = lastHeader.id;
    }
    if (firstIndex > 0) {
      this.atTop = false;
      this.userCanGrowUpwards = false;
      this.desiredHeaders -= firstIndex;
      this._bridgeHandle.sendSplice(0, firstIndex, [], true, false);
      this.headers.splice(0, firstIndex);
      var firstHeader = this.headers[0];
      this.endTS = firstHeader.date;
      this.endUID = firstHeader.id;
    }

    this._storage.sliceShrunk(this);
  },

  reqGrow: function(dirMagnitude, userRequestsGrowth) {
    if (dirMagnitude === -1)
      dirMagnitude = -$sync.INITIAL_FILL_SIZE;
    else if (dirMagnitude === 1)
      dirMagnitude = $sync.INITIAL_FILL_SIZE;
    this._storage.growSlice(this, dirMagnitude, userRequestsGrowth);
  },

  sendEmptyCompletion: function() {
    this.setStatus('synced', true, false);
  },

  setStatus: function(status, requested, moreExpected, flushAccumulated,
                      progress, newEmailCount) {
    if (!this._bridgeHandle)
      return;

    switch (status) {
      case 'synced':
      case 'syncfailed':
        this._updateSliceFlags();
        break;
    }
    this._bridgeHandle.sendStatus(status, requested, moreExpected, progress,
                                    newEmailCount);
  },

  /**
   * Update our sync progress with a value in the range [0.0, 1.0].  We leave
   * it up to the specific protocol to determine how it maps values.
   */
  setSyncProgress: function(value) {
    if (!this._bridgeHandle)
      return;
    this._bridgeHandle.sendSyncProgress(value);
  },

  /**
   * @args[
   *   @param[headers @listof[MailHeader]]
   *   @param[insertAt @oneof[
   *     @case[-1]{
   *       Append to the end of the list
   *     }
   *     @case[Number]{
   *       Insert the headers at the given index.
   *     }
   *   ]]
   *   @param[moreComing Boolean]
   * ]
   */
  batchAppendHeaders: function(headers, insertAt, moreComing) {
    if (!this._bridgeHandle)
      return;

    logic(this, 'headersAppended', { headers: headers });
    if (insertAt === -1)
      insertAt = this.headers.length;
    this.headers.splice.apply(this.headers, [insertAt, 0].concat(headers));

    // XXX this can obviously be optimized to not be a loop
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];
      if (this.startTS === null ||
          BEFORE(header.date, this.startTS)) {
        this.startTS = header.date;
        this.startUID = header.id;
      }
      else if (header.date === this.startTS &&
               header.id < this.startUID) {
        this.startUID = header.id;
      }
      if (this.endTS === null ||
          STRICTLY_AFTER(header.date, this.endTS)) {
        this.endTS = header.date;
        this.endUID = header.id;
      }
      else if (header.date === this.endTS &&
               header.id > this.endUID) {
        this.endUID = header.id;
      }
    }

    this._updateSliceFlags();
    this._bridgeHandle.sendSplice(insertAt, 0, headers,
                                  true, moreComing);
  },

  /**
   * Tell the slice about a header it should be interested in.  This should
   * be unconditionally called by a sync populating this slice, or conditionally
   * called when the header is in the time-range of interest and a refresh,
   * cron-triggered sync, or IDLE/push tells us to do so.
   */
  onHeaderAdded: function(header, body, syncDriven, messageIsNew) {
    if (!this._bridgeHandle)
      return;

    var idx = bsearchForInsert(this.headers, header, cmpHeaderYoungToOld);
    var hlen = this.headers.length;
    // Don't append the header if it would expand us beyond our requested
    // amount.  Note that this does not guarantee that we won't end up with more
    // headers than originally planned; if we get told about headers earlier
    // than the last slot, we will insert them and grow without forcing a
    // removal of something else to offset.
    if (hlen >= this.desiredHeaders && idx === hlen)
      return;
    // If we are inserting (not at the end) then be sure to grow
    // the number of desired headers to be consistent with the number of headers
    // we have.
    if (hlen >= this.desiredHeaders)
      this.desiredHeaders++;

    if (this.startTS === null ||
        BEFORE(header.date, this.startTS)) {
      this.startTS = header.date;
      this.startUID = header.id;
    }
    else if (header.date === this.startTS &&
             header.id < this.startUID) {
      this.startUID = header.id;
    }
    if (this.endTS === null ||
        STRICTLY_AFTER(header.date, this.endTS)) {
      this.endTS = header.date;
      this.endUID = header.id;
    }
    else if (header.date === this.endTS &&
             header.id > this.endUID) {
      this.endUID = header.id;
    }

    logic(this, 'headerAdded', { index: idx, header: header });
    this._bridgeHandle.sendSplice(idx, 0, [header],
                                  Boolean(this.waitingOnData),
                                  Boolean(this.waitingOnData));
    this.headers.splice(idx, 0, header);
  },

  /**
   * Tells the slice that a header it should know about has changed.  (If
   * this is a search, it's okay for it not to know...)
   */
  onHeaderModified: function(header, body) {
    if (!this._bridgeHandle)
      return;

    // this can only affect flags which will not affect ordering
    var idx = bsearchMaybeExists(this.headers, header, cmpHeaderYoungToOld);
    if (idx !== null) {
      // There is no identity invariant to ensure this is already true.
      this.headers[idx] = header;
      logic(this, 'headerModified', { index: idx, header: header });
      this._bridgeHandle.sendUpdate([idx, header]);
    }
  },

  /**
   * Tells the slice that a header it should know about has been removed.
   */
  onHeaderRemoved: function(header) {
    if (!this._bridgeHandle)
      return;

    var idx = bsearchMaybeExists(this.headers, header, cmpHeaderYoungToOld);
    if (idx !== null) {
      logic(this, 'headerRemoved', { index: idx, header: header });
      this._bridgeHandle.sendSplice(idx, 1, [],
                                    Boolean(this.waitingOnData),
                                    Boolean(this.waitingOnData));
      this.headers.splice(idx, 1);

      // update time-ranges if required...
      if (header.date === this.endTS && header.id === this.endUID) {
        if (!this.headers.length) {
          this.endTS = null;
          this.endUID = null;
        }
        else {
          this.endTS = this.headers[0].date;
          this.endUID = this.headers[0].id;
        }
      }
      if (header.date === this.startTS && header.id === this.startUID) {
        if (!this.headers.length) {
          this.startTS = null;
          this.startUID = null;
        }
        else {
          var lastHeader = this.headers[this.headers.length - 1];
          this.startTS = lastHeader.date;
          this.startUID = lastHeader.id;
        }
      }
    }
  },

  die: function() {
    this._bridgeHandle = null;
    this.desiredHeaders = 0;
    this._storage.dyingSlice(this);
  },

  get isDead() {
    return this._bridgeHandle === null;
  },
};


/**
 * Folder version history:
 *
 * v3: Unread count tracking fixed, so we need to re-run it.
 *
 * v2: Initial unread count tracking.  Regrettably with bad maths.
 */
var FOLDER_DB_VERSION = exports.FOLDER_DB_VERSION = 3;

/**
 * Per-folder message caching/storage; issues per-folder `MailSlice`s and keeps
 * them up-to-date.  Access is mediated through the use of mutexes which must be
 * acquired for write access and are advisable for read access that requires
 * access to more than a single message.
 *
 * ## Naming and Ordering
 *
 * Messages in the folder are named and ordered by the tuple of the message's
 * received date and a "sufficiently unique identifier" (SUID) we allocate.
 *
 * The SUID is actually a concatenation of an autoincrementing per-folder 'id'
 * to our folder id, which in turn contains the account id.  Internally, we only
 * care about the 'id' since the rest is constant for the folder.  However, all
 * APIs layered above us need to deal in SUIDs since we will eventually have
 * `MailSlice` instances that aggregate the contents so it is important that the
 * extra information always be passed around.
 *
 * Because the SUID has no time component and for performance we want a total
 * ordering on the messages, messages are first ordered on their 'received'
 * date.  For IMAP this is the message's INTERNALDATE.  For ActiveSync this is
 * the email:DateReceived element.  Accordingly, when performing a lookup, we
 * either need the exact date of the message or a reasonable bounded time range
 * in which it could fall (which should be a given for date range scans).
 *
 * ## Storage, Caching, Cache Flushing
 *
 * Storage is done using IndexedDB, with message header information and message
 * body information stored in separate blocks of information.  See the
 * `maildb.js` file and `MailDB` class for more detailed information.
 *
 * Blocks are loaded from disk on demand and cached, although preferably hints
 * are received so we can pre-load information.  Blocks are discarded from the
 * cache automatically when a mutex is released or when explicitly invoked by
 * the code currently holding the mutex.  Code that can potentially cause a
 * large number of blocks to be loaded is responsible for periodically
 * triggering cache evictions and/or writing of dirty blocks to disk so that
 * cache evictions are possible.
 *
 * We avoid automatic cache eviction in order to avoid the class of complex bugs
 * that might arise.  While well-written code should not run afoul of automatic
 * cache eviction were it to exist, buggy code happens.  We can more reliably
 * detect potentially buggy code this way by simply reporting whenever the
 * number of loaded blocks exceeds some threshold.
 *
 * When evicting blocks from cache, we try and keep blocks around that contain
 * messages referenced by active `MailSlice` instances in order to avoid the
 * situation where we discard blocks just to reload them with the next user
 * action, and with added latency.
 *
 * If WeakMap were standardized, we would instead move blocks into a WeakMap,
 * but it's not, so we don't.
 *
 * ## Block Purging (IMAP)
 *
 * For account types like IMAP where we can incrementally grow the set of
 * messages we have synchronized from the server, our entire database is
 * effectively a cache of the server state.  This is in contrast to ActiveSync
 * where we synchronize a fixed time-window of messages and so the exact set of
 * messages we should know about is well-defined and bounded.  As a result, we
 * need to be able to purge old messages that the user no longer appears to
 * care about so that our disk usage does not grow without bound.
 *
 * We currently trigger block purging as the result of block growth in a folder.
 * Specifically
 *
 * Messages are discarded from storage when experiencing storage pressure.  We
 * figure it's better to cache what we have until it's known useless (deleted
 * messages) or we definitely need the space for something else.
 *
 * ## Concurrency and I/O
 *
 * The logic in this class can operate synchronously as long as the relevant
 * header/body blocks are in-memory.  For simplicity, we (asynchronously) defer
 * execution of calls that mutate state while loads are in-progress; callers
 * will not block.  This simplifies our implementation and thinking about our
 * implementation without making life for our users much worse.
 *
 * Specifically, all UI requests for data will be serviced immediately if the
 * data is available.  If the data is not available, the wait would have
 * happened anyways.  Mutations will be enqueued, but are always speculatively
 * assumed to succeed by the UI anyways so when they are serviced is not
 * exceedingly important other than a burden on us to surface in the UI that
 * we still have some state to synchronize to the server so the user does
 * not power-off their phone quite yet.
 *
 * ## Types
 *
 * @typedef[AccuracyRangeInfo @dict[
 *   @key[endTS DateMS]{
 *     This value is exclusive in keeping with IMAP BEFORE semantics.
 *   }
 *   @key[startTS DateMS]{
 *     This value is inclusive in keeping with IMAP SINCE semantics.
 *   }
 *   @key[fullSync @dict[
 *     @key[highestModseq #:optional String]{
 *       The highest modseq for this range, if we have one.  This would be the
 *       value reported on folder entry, plus any maximization that occurs if we
 *       utilized IDLE or some other mechanism to keep the range up-to-date.
 *       On servers without highestmodseq, this will be null.
 *     }
 *     @key[updated DateMS]{
 *       What was our local timestamp the last time we synchronized this range?
 *       This is speculative and probably just for debugging unless we have the
 *       UI reflect that in offline mode it knows what it is showing you could
 *       be fairly out of date.
 *     }
 *   }
 *   ]]{
 *     Did we fully synchronize this time range (because of a date scan)?  If
 *     false, the implication is that we know about the messages in this range
 *     because of some type of search.
 *   }
 * ]]{
 *   Describes the provenance of the data we have for a given time range.
 *   Tracked independently of the block data because there doesn't really seem
 *   to be an upside to coupling them.
 *
 *   This lets us know when we have sufficiently valid data to display messages
 *   without needing to talk to the server, allows us to size checks for
 *   new messages in time ranges, and should be a useful debugging aid.
 * }
 * @typedef[FolderBlockInfo @dict[
 *   @key[blockId BlockId]{
 *     The name of the block for storage access.
 *   }
 *   @key[startTS DateMS]{
 *     The timestamp of the last and therefore (possibly equally) oldest message
 *     in this block.  Forms the first part of a composite key with `startUID`.
 *   }
 *   @key[startUID UID]{
 *     The UID of the last and therefore (possibly equally) oldest message
 *     in this block.  Forms the second part of a composite key with `startTS`.
 *   }
 *   @key[endTS DateMS]{
 *     The timestamp of the first and therefore (possibly equally) newest
 *     message in this block.  Forms the first part of a composite key with
 *     `endUID`.
 *   }
 *   @key[endUID UID]{
 *     The UID of the first and therefore (possibly equally) newest message
 *     in this block.  Forms the second part of a composite key with `endTS`.
 *   }
 *   @key[count Number]{
 *     The number of messages in this bucket.
 *   }
 *   @key[estSize Number]{
 *     The estimated size in bytes all of the messages in this bucket use.  This
 *     is to assist us in known when to split/merge blocks.
 *   }
 * ]]{
 *   The directory entries for our `HeaderBlock` and `BodyBlock` instances.
 *   Currently, these are always stored in memory since they are small and
 *   there shouldn't be a tremendous number of them.
 *
 *   These
 * }
 * @typedef[EmailAddress String]
 * @typedef[NameAddressPair @dict[
 *   @key[address EmailAddress]
 *   @key[name String]
 * ]]
 * @typedef[HeaderInfo @dict[
 *   @key[id]{
 *     An id allocated by the back-end that names the message within the folder.
 *     We use this instead of the server-issued UID because if we used the UID
 *     for this purpose then we would still need to issue our own temporary
 *     speculative id's for offline operations and would need to implement
 *     renaming and it all gets complicated.
 *   }
 *   @key[srvid]{
 *     The server-issued UID for the folder, or 0 if the folder is an offline
 *     header.
 *   }
 *   @key[suid]{
 *     Basically "account id/folder id/message id", although technically the
 *     folder id includes the account id.
 *   }
 *   @key[guid String]{
 *     This is the message-id header value of the message.
 *   }
 *   @key[author NameAddressPair]
 *   @key[date DateMS]
 *   @key[flags @listof[String]]
 *   @key[hasAttachments Boolean]
 *   @key[subject String]
 *   @key[snippet @oneof[
 *     @case[null]{
 *       We haven't tried to generate a snippet yet.
 *     }
 *     @case['']{
 *       We tried to generate a snippet, but got nothing useful.  Note that we
 *       may try and generate a snippet from a partial body fetch; this does not
 *       indicate that we should avoid computing a better snippet.  Whenever the
 *       snippet is falsey and we have retrieved more body data, we should
 *       always try and derive a snippet.
 *     }
 *     @case[String]{
 *       A non-empty string means we managed to produce some snippet data.  It
 *        is still appropriate to regenerate the snippet if more body data is
 *        fetched since our snippet may be a fallback where we chose quoted text
 *        instead of authored text, etc.
 *     }
 *   ]]
 * ]]
 * @typedef[HeaderBlock @dict[
 *   @key[ids @listof[ID]]{
 *     The issued-by-us-id's of the headers in the same order (not the IMAP
 *     UID).  This is intended as a fast parallel search mechanism.  It can be
 *     discarded if it doesn't prove useful.
 *
 *     XXX We want to rename this to be "ids" in a refactoring pass in the
 *     future.
 *   }
 *   @key[headers @listof[HeaderInfo]]{
 *     Headers in numerically decreasing time and issued-by-us-ID order.  The
 *     header at index 0 should correspond to the 'end' characteristics of the
 *     blockInfo and the header at n-1 should correspond to the start
 *     characteristics.
 *   }
 * ]]
 * @typedef[AttachmentInfo @dict[
 *   @key[name String]{
 *     The filename of the attachment, if any.
 *   }
 *   @key[contentId String]{
 *     The content-id of the attachment if this is a related part for inline
 *     display.
 *   }
 *   @key[type String]{
 *     The (full) mime-type of the attachment.
 *   }
 *   @key[part String]{
 *     The IMAP part number for fetching the attachment.
 *   }
 *   @key[encoding String]{
 *     The encoding of the attachment so we know how to decode it.
 *   }
 *   @key[sizeEstimate Number]{
 *     Estimated file size in bytes.  Gets updated to be the correct size on
 *     attachment download.
 *   }
 *   @key[file @oneof[
 *     @case[null]{
 *       The attachment has not been downloaded, the file size is an estimate.
 *     }
 *     @case[@list["device storage type" "file path"]{
 *       The DeviceStorage type (ex: pictures) and the path to the file within
 *       device storage.
 *     }
 *     @case[HTMLBlob]{
 *       The Blob that contains the attachment.  It can be thought of as a
 *       handle/name to access the attachment.  IndexedDB in Gecko stores the
 *       blobs as (quota-tracked) files on the file-system rather than inline
 *       with the record, to the attachments don't need to count against our
 *       block size since they are not part of the direct I/O burden for the
 *       block.
 *     }
 *   ]]
 *   @key[charset @oneof[undefined String]]{
 *     The character set, for example "ISO-8859-1".  If not specified, as is
 *     likely for binary attachments, this should be null.
 *   }
 *   @key[textFormat @oneof[undefined String]]{
 *     The text format, for example, "flowed" for format=flowed.  If not
 *     specified, as is likely for binary attachments, this should be null.
 *   }
 * ]]
 * @typedef[BodyInfo @dict[
 *   @key[date DateMS]{
 *     Redundantly stored date info for block splitting purposes.  We pretty
 *     much need this no matter what because our ordering is on the tuples of
 *     dates and UIDs, so we could have trouble efficiently locating our header
 *     from the body without this.
 *   }
 *   @key[size Number]
 *   @key[to @listof[NameAddressPair]]
 *   @key[cc @listof[NameAddressPair]]
 *   @key[bcc @listof[NameAddressPair]]
 *   @key[replyTo NameAddressPair]
 *   @key[attachments @listof[AttachmentInfo]]{
 *     Proper attachments for explicit downloading.
 *   }
 *   @key[relatedParts @oneof[null @listof[AttachmentInfo]]]{
 *     Attachments for inline display in the contents of the (hopefully)
 *     multipart/related message.
 *   }
 *   @key[references @oneof[null @listof[String]]]{
 *     The contents of the references header as a list of de-quoted ('<' and
 *     '>' removed) message-id's.  If there was no header, this is null.
 *   }
 *   @key[bodyReps @listof[@oneof[String Array]]]{
 *     This is a list where each two consecutive elements describe a body
 *     representation.  The even indices are the body rep types which are
 *     either 'plain' or 'html'.  The odd indices are the actual
 *     representations.
 *
 *     The representation for 'plain' values is a `quotechew.js` processed
 *     body representation (which is itself a similar pair-wise list except
 *     that the identifiers are packed integers).
 *
 *     The body representation for 'html' values is an already sanitized and
 *     already quote-normalized String representation that could be directly
 *     fed into innerHTML safely if you were so inclined.  See `htmlchew.js`
 *     for more on that process.
 *   }
 * ]]{
 *   Information on the message body that is only for full message display.
 *   The to/cc/bcc information may get moved up to the header in the future,
 *   but our driving UI doesn't need it right now.
 * }
 * @typedef[BodyBlock @dict[
 *   @key[ids @listof[ID]]{
 *     The issued-by-us id's of the messages; the order is parallel to the order
 *     of `bodies.`
 *   }
 *   @key[bodies @dictof[
 *     @key["unique identifier" ID]
 *     @value[BodyInfo]
 *   ]]
 * ]]
 */
function FolderStorage(account, folderId, persistedFolderInfo, dbConn,
                       FolderSyncer) {
  /** Our owning account. */
  this._account = account;
  this._imapDb = dbConn;

  this.folderId = folderId;
  this.folderMeta = persistedFolderInfo.$meta;
  this._folderImpl = persistedFolderInfo.$impl;

  logic.defineScope(this, 'FolderStorage', {
    accountId: account.id,
    folderId: folderId
  });

  /**
   * @listof[AccuracyRangeInfo]{
   *   Newest-to-oldest sorted list of accuracy range info structures that are
   *   keyed by their IMAP-consistent startTS (inclusive) and endTS (exclusive)
   *   on a per-day granularity.
   * }
   */
  this._accuracyRanges = persistedFolderInfo.accuracy;
  /**
   * @listof[FolderBlockInfo]{
   *   Newest-to-oldest (numerically decreasing time and ID) sorted list of
   *   header folder block infos.  They are keyed by a composite key consisting
   *   of messages' "date" and "id" fields.
   * }
   */
  this._headerBlockInfos = persistedFolderInfo.headerBlocks;

  // Calculate total number of messages
  this.headerCount = 0;
  if (this._headerBlockInfos) {
    this._headerBlockInfos.forEach(function(headerBlockInfo) {
      this.headerCount += headerBlockInfo.count;
    }.bind(this));
  }

  /**
   * @listof[FolderBlockInfo]{
   *   Newest-to-oldest (numerically decreasing time and ID) sorted list of
   *   body folder block infos.  They are keyed by a composite key consisting
   *   of messages' "date" and "id" fields.
   * }
   */
  this._bodyBlockInfos = persistedFolderInfo.bodyBlocks;

  /**
   * @oneof[null @dictof[
   *   @key[ServerID]{
   *     The "srvid" value of a header entry.
   *   }
   *   @value[BlockID]{
   *     The block the header is stored in.
   *   }
   * ]]
   */
  this._serverIdHeaderBlockMapping =
    persistedFolderInfo.serverIdHeaderBlockMapping;

  /**
   * @dictof[@key[BlockId] @value[HeaderBlock]]{
   *   In-memory cache of header blocks.
   * }
   */
  this._headerBlocks = {};
  /**
   * @listof[FolderBlockInfo]{
   *   The block infos of all the header blocks in `_headerBlocks`.  Exists so
   *   that we don't need to map blocks back to their block infos when we are
   *   considering flushing things.  This could also be used for most recently
   *   loaded tracking.
   * }
   */
  this._loadedHeaderBlockInfos = [];
  /**
   * @dictof[@key[BlockId] @value[BodyBlock]]{
   *   In-memory cache of body blocks.
   * }
   */
  this._bodyBlocks = {};
  /**
   * @listof[FolderBlockInfo]{
   *   The block infos of all the body blocks in `_bodyBlocks`.  Exists so
   *   that we don't need to map blocks back to their block infos when we are
   *   considering flushing things.  This could also be used for most recently
   *   loaded tracking.
   * }
   */
  this._loadedBodyBlockInfos = [];

  this._flushExcessTimeoutId = 0;

  this._bound_flushExcessOnTimeout = this._flushExcessOnTimeout.bind(this);
  this._bound_makeHeaderBlock = this._makeHeaderBlock.bind(this);
  this._bound_insertHeaderInBlock = this._insertHeaderInBlock.bind(this);
  this._bound_splitHeaderBlock = this._splitHeaderBlock.bind(this);
  this._bound_deleteHeaderFromBlock = this._deleteHeaderFromBlock.bind(this);

  this._bound_makeBodyBlock = this._makeBodyBlock.bind(this);
  this._bound_insertBodyInBlock = this._insertBodyInBlock.bind(this);
  this._bound_splitBodyBlock = this._splitBodyBlock.bind(this);
  this._bound_deleteBodyFromBlock = this._deleteBodyFromBlock.bind(this);


  /**
   * Has our internal state altered at all and will need to be persisted?
   */
  this._dirty = false;
  /** @dictof[@key[BlockId] @value[HeaderBlock]] */
  this._dirtyHeaderBlocks = {};
  /** @dictof[@key[BlockId] @value[BodyBlock]] */
  this._dirtyBodyBlocks = {};

  /**
   * @listof[AggrBlockId]
   */
  this._pendingLoads = [];
  /**
   * @dictof[
   *   @key[AggrBlockId]
   *   @key[@listof[@func]]
   * ]
   */
  this._pendingLoadListeners = {};

  /**
   * @listof[@func[]]{
   *   A list of fully-bound functions to drain when the last pending load gets
   *   loaded, at least until a new load goes pending.
   * }
   */
  this._deferredCalls = [];

  /**
   * @listof[@dict[
   *   @key[name String]{
   *     A string describing the operation to be performed for debugging
   *     purposes.  This string must not include any user data.
   *   }
   *   @key[func @func[@args[callWhenDone]]]{
   *     The function to be invoked.
   *   }
   * ]]{
   *   The list of mutexed call operations queued.  The first entry is the
   *   currently executing entry.
   * }
   */
  this._mutexQueue = [];

  /**
   * Active view / search slices on this folder.
   */
  this._slices = [];

  /**
   * The slice that is driving our current synchronization and wants to hear
   * about all header modifications/notes as they occur.  This will be null
   * when performing a refresh sync.
   */
  this._curSyncSlice = null;

  this._messagePurgeScheduled = false;
  this.folderSyncer = FolderSyncer && new FolderSyncer(account, this);
}
exports.FolderStorage = FolderStorage;

/**
 * Return true if the given folder type is local-only (i.e. we will
 * not try to sync this folder with the server).
 *
 * @param {String} type
 *   The type of the folderStorage, e.g. 'inbox' or 'localdrafts'.
 */
FolderStorage.isTypeLocalOnly = function(type) {
  if (typeof type !== 'string') {
    throw new Error('isTypeLocalOnly() expects a string, not ' + type);
  }
  return (type === 'outbox' || type === 'localdrafts');
};

FolderStorage.prototype = {
  get hasActiveSlices() {
    return this._slices.length > 0;
  },

  get isLocalOnly() {
    return FolderStorage.isTypeLocalOnly(this.folderMeta.type);
  },

  /**
   * Reset all active slices.
   */
  resetAndRefreshActiveSlices: function() {
    if (!this._slices.length)
      return;
    // This will splice out slices as we go, so work from the back to avoid
    // processing any slice more than once.  (Shuffling of processed slices
    // will occur, but we don't care.)
    for (var i = this._slices.length - 1; i >= 0; i--) {
      var slice = this._slices[i];
      slice.desiredHeaders = $sync.INITIAL_FILL_SIZE;
      slice.reset();
      if (slice.type === 'folder') {
        this._resetAndResyncSlice(slice, true, null);
      }
    }
  },

  /**
   * Called by our owning account to generate lists of dirty blocks to be
   * persisted to the database if we have any dirty blocks.
   *
   * We trigger a cache flush after clearing the set of dirty blocks because
   * this is the first time we can flush the no-longer-dirty blocks and this is
   * an acceptable/good time to clear the cache since we must not be in a mutex.
   */
  generatePersistenceInfo: function() {
    if (!this._dirty)
      return null;
    var pinfo = {
      id: this.folderId,
      headerBlocks: this._dirtyHeaderBlocks,
      bodyBlocks: this._dirtyBodyBlocks,
    };
    logic(this, 'generatePersistenceInfo', { info: pinfo });
    this._dirtyHeaderBlocks = {};
    this._dirtyBodyBlocks = {};
    this._dirty = false;
    this.flushExcessCachedBlocks('persist');
    // Generate a notification that something about this folder has probably
    // changed.  If it was important enough to save us, then it's arguably
    // important enough to tell the front-end about it too.  Plus the I/O
    // overhead is way more costly than throwing some minimal updates at the
    // front-end.
    //
    // (Previously all that could change was our last sync time and so
    // we only did this in markSyncRange().  Now we maintain an unread count
    // too.  And it's likely we'll be adding more values we care about in the
    // future.)
    this._account.universe.__notifyModifiedFolder(this._account,
                                                  this.folderMeta);
    return pinfo;
  },

  _invokeNextMutexedCall: function() {
    var callInfo = this._mutexQueue[0], self = this, done = false;
    this._mutexedCallInProgress = true;
    logic(this, 'mutexedCall_begin', { name: callInfo.name });

    try {
      var mutexedOpDone = function(err) {
        if (done) {
          logic(self, 'tooManyCallbacks', { name: callInfo.name });
          return;
        }
        logic(self, 'mutexedCall_end', { name: callInfo.name });
        logic(self, 'mailslice:mutex-released',
                   { folderId: self.folderId, err: err });

        done = true;
        if (self._mutexQueue[0] !== callInfo) {
          logic(self, 'mutexInvariantFail', {
            callName: callInfo.name,
            mutexName: self._mutexQueue[0].name
          });
          return;
        }
        self._mutexQueue.shift();
        self.flushExcessCachedBlocks('mutex');
        // Although everything should be async, avoid stack explosions by
        // deferring the execution to a future turn of the event loop.
        if (self._mutexQueue.length)
          window.setZeroTimeout(self._invokeNextMutexedCall.bind(self));
        else if (self._slices.length === 0)
          self.folderSyncer.allConsumersDead();
      };

      callInfo.func(mutexedOpDone);
    }
    catch (ex) {
      logic(this, 'mutexedOpErr', { ex: ex });
    }
  },

  /**
   * If you want to modify the state of things in the FolderStorage, or be able
   * to view the state of the FolderStorage without worrying about some other
   * logic mutating its state, then use this to schedule your function to run
   * with (notional) exclusive write access.  Because everything is generally
   * asynchronous, it's assumed your function is still doing work until it calls
   * the passed-in function to indicate it is done.
   *
   * This mutex should not be held longer than required.  Specifically, if error
   * handling determines that we should wait a few seconds to retry a network
   * operation, then the function should mark itself completed and issue a call
   * to runMutexed again in the future once the timeout has elapsed.
   *
   * Keep in mind that there is nothing actually stopping other code from trying
   * to manipulate the database.
   *
   * It's okay to issue reads against the FolderStorage if the value is
   * immutable or there are other protective mechanisms in place.  For example,
   * fetching a message body should always be safe even if a block load needs
   * to occur.  But if you wanted to fetch a header, mutate it, and write it
   * back, then you would want to do all of that with the mutex held; reading
   * the header before holding the mutex could result in a race.
   *
   * @args[
   *   @param[name String]{
   *     A short name to identify what operation this is for debugging purposes.
   *     No private user data or sensitive data should be included in the name.
   *   }
   *   @param[func @func[@args[@param[callWhenDone Function]]]]{
   *     The function to run with (notional) exclusive access to the
   *     FolderStorage.
   *   }
   * ]
   */
  runMutexed: function(name, func) {
    var doRun = this._mutexQueue.length === 0;
    this._mutexQueue.push({ name: name, func: func });

    if (doRun)
      this._invokeNextMutexedCall();
  },

  /**
   * This queues the proper upgrade jobs and updates the version, if necessary
   */
  upgradeIfNeeded: function() {
    if (!this.folderMeta.version || FOLDER_DB_VERSION > this.folderMeta.version) {
      this._account.universe.performFolderUpgrade(this.folderMeta.id);
    }
  },


  _issueNewHeaderId: function() {
    return this._folderImpl.nextId++;
  },

  /**
   * Create an empty header `FolderBlockInfo` and matching `HeaderBlock`.  The
   * `HeaderBlock` will be inserted into the block map, but it's up to the
   * caller to insert the returned `FolderBlockInfo` in the right place.
   */
  _makeHeaderBlock: function ifs__makeHeaderBlock(
      startTS, startUID, endTS, endUID, estSize, ids, headers) {
    var blockId = $a64.encodeInt(this._folderImpl.nextHeaderBlock++),
        blockInfo = {
          blockId: blockId,
          startTS: startTS,
          startUID: startUID,
          endTS: endTS,
          endUID: endUID,
          count: ids ? ids.length : 0,
          estSize: estSize || 0,
        },
        block = {
          ids: ids || [],
          headers: headers || [],
        };
    this._dirty = true;
    this._headerBlocks[blockId] = block;
    this._dirtyHeaderBlocks[blockId] = block;

    // Update the server id mapping if we are maintaining one.
    if (this._serverIdHeaderBlockMapping && headers) {
      var srvMapping = this._serverIdHeaderBlockMapping;
      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        if (header.srvid)
          srvMapping[header.srvid] = blockId;
      }
    }

    return blockInfo;
  },

  _insertHeaderInBlock: function ifs__insertHeaderInBlock(header, uid, info,
                                                          block) {
    var idx = bsearchForInsert(block.headers, header, cmpHeaderYoungToOld);
    block.ids.splice(idx, 0, header.id);
    block.headers.splice(idx, 0, header);
    this._dirty = true;
    this._dirtyHeaderBlocks[info.blockId] = block;
    // Insertion does not need to update start/end TS/UID because the calling
    // logic is able to handle it.
  },

  _deleteHeaderFromBlock: function ifs__deleteHeaderFromBlock(uid, info, block) {
    var idx = block.ids.indexOf(uid), header;

    // Whatever we're looking for should absolutely exist; log an error if it
    // does not.  But just silently return since there's little to be gained
    // from blowing up the world.
    if (idx === -1) {
      logic(this, 'badDeletionRequest', {
        header: header,
        uid: uid
      });
      return;
    }
    header = block.headers[idx];

    // - remove, update counts
    if (header.flags && header.flags.indexOf('\\Seen') === -1) {
      this.folderMeta.unreadCount--;
    }

    block.ids.splice(idx, 1);
    block.headers.splice(idx, 1);
    info.estSize -= $sync.HEADER_EST_SIZE_IN_BYTES;
    info.count--;

    this._dirty = true;
    this._dirtyHeaderBlocks[info.blockId] = block;

    // - update endTS/endUID if necessary
    if (idx === 0 && info.count) {
      header = block.headers[0];
      info.endTS = header.date;
      info.endUID = header.id;
    }
    // - update startTS/startUID if necessary
    if (idx === info.count && idx > 0) {
      header = block.headers[idx - 1];
      info.startTS = header.date;
      info.startUID = header.id;
    }
  },

  /**
   * Split the contents of the given header block into a newer and older block.
   * The newer info block will be mutated in place; the older block info will
   * be created and returned.  The newer block is filled with data until it
   * first overflows newerTargetBytes.  This method is responsible for updating
   * the actual containing blocks as well.
   */
  _splitHeaderBlock: function ifs__splitHeaderBlock(splinfo, splock,
                                                    newerTargetBytes) {
    // We currently assume a fixed size, so this is easy.
    var numHeaders = Math.ceil(newerTargetBytes /
                               $sync.HEADER_EST_SIZE_IN_BYTES);
    if (numHeaders > splock.headers.length)
      throw new Error("No need to split!");

    var olderNumHeaders = splock.headers.length - numHeaders,
        olderEndHeader = splock.headers[numHeaders],
        // (This will update the server id mappings for the headers too)
        olderInfo = this._makeHeaderBlock(
                      // Take the start info from the block, because it may have
                      // been extended beyond the header (for an insertion if
                      // we change back to inserting after splitting.)
                      splinfo.startTS, splinfo.startUID,
                      olderEndHeader.date, olderEndHeader.id,
                      olderNumHeaders * $sync.HEADER_EST_SIZE_IN_BYTES,
                      splock.ids.splice(numHeaders, olderNumHeaders),
                      splock.headers.splice(numHeaders, olderNumHeaders));

    var newerStartHeader = splock.headers[numHeaders - 1];
    splinfo.count = numHeaders;
    splinfo.estSize = numHeaders * $sync.HEADER_EST_SIZE_IN_BYTES;
    splinfo.startTS = newerStartHeader.date;
    splinfo.startUID = newerStartHeader.id;
    // this._dirty is already touched by makeHeaderBlock when it dirties the
    // block it creates.
    this._dirtyHeaderBlocks[splinfo.blockId] = splock;

    return olderInfo;
  },

  /**
   * Create an empty header `FolderBlockInfo` and matching `BodyBlock`.  The
   * `BodyBlock` will be inserted into the block map, but it's up to the
   * caller to insert the returned `FolderBlockInfo` in the right place.
   */
  _makeBodyBlock: function ifs__makeBodyBlock(
      startTS, startUID, endTS, endUID, size, ids, bodies) {
    var blockId = $a64.encodeInt(this._folderImpl.nextBodyBlock++),
        blockInfo = {
          blockId: blockId,
          startTS: startTS,
          startUID: startUID,
          endTS: endTS,
          endUID: endUID,
          count: ids ? ids.length : 0,
          estSize: size || 0,
        },
        block = {
          ids: ids || [],
          bodies: bodies || {},
        };
    this._dirty = true;
    this._bodyBlocks[blockId] = block;
    this._dirtyBodyBlocks[blockId] = block;

    if (this._folderImpl.nextBodyBlock %
          $sync.BLOCK_PURGE_EVERY_N_NEW_BODY_BLOCKS === 0 &&
        !this._messagePurgeScheduled) {
      this._messagePurgeScheduled = true;
      this._account.scheduleMessagePurge(this.folderId);
    }

    return blockInfo;
  },

  _insertBodyInBlock: function ifs__insertBodyInBlock(body, id, info, block) {
    function cmpBodyByID(aID, bID) {
      var aDate = (aID === id) ? body.date : block.bodies[aID].date,
          bDate = (bID === id) ? body.date : block.bodies[bID].date,
          d = bDate - aDate;
      if (d)
        return d;
      d = bID - aID;
      return d;
    }

    var idx = bsearchForInsert(block.ids, id, cmpBodyByID);
    block.ids.splice(idx, 0, id);
    block.bodies[id] = body;
    this._dirty = true;
    this._dirtyBodyBlocks[info.blockId] = block;
    // Insertion does not need to update start/end TS/UID because the calling
    // logic is able to handle it.
  },

  _deleteBodyFromBlock: function ifs__deleteBodyFromBlock(id, info, block) {
    // - delete
    var idx = block.ids.indexOf(id);
    var body = block.bodies[id];
    if (idx === -1 || !body) {
      logic(this, 'bodyBlockMissing', { id: id, index: idx, hasBody: !!body });
      return;
    }
    block.ids.splice(idx, 1);
    delete block.bodies[id];
    info.estSize -= body.size;
    info.count--;

    this._dirty = true;
    this._dirtyBodyBlocks[info.blockId] = block;

    // - update endTS/endUID if necessary
    if (idx === 0 && info.count) {
      info.endUID = id = block.ids[0];
      info.endTS = block.bodies[id].date;
    }
    // - update startTS/startUID if necessary
    if (idx === info.count && idx > 0) {
      info.startUID = id = block.ids[idx - 1];
      info.startTS = block.bodies[id].date;
    }
  },

  /**
   * Split the contents of the given body block into a newer and older block.
   * The newer info block will be mutated in place; the older block info will
   * be created and returned.  The newer block is filled with data until it
   * first overflows newerTargetBytes.  This method is responsible for updating
   * the actual containing blocks as well.
   */
  _splitBodyBlock: function ifs__splitBodyBlock(splinfo, splock,
                                                newerTargetBytes) {
    // Save off the start timestamp/uid; these may have been extended beyond the
    // delimiting bodies because of the insertion triggering the split.  (At
    // least if we start inserting after splitting again in the future.)
    var savedStartTS = splinfo.startTS, savedStartUID = splinfo.startUID;

    var newerBytes = 0, ids = splock.ids, newDict = {}, oldDict = {},
        inNew = true, numHeaders = null, i, id, body,
        idxLast = ids.length - 1;
    // loop for new traversal; picking a split-point so that there is at least
    // one item in each block.
    for (i = 0; i < idxLast; i++) {
      id = ids[i];
      body = splock.bodies[id];
      newerBytes += body.size;
      newDict[id] = body;
      if (newerBytes >= newerTargetBytes) {
        i++;
        break;
      }
    }
    // mark the breakpoint; i is pointing at the first old-block message
    splinfo.count = numHeaders = i;
    // and these values are from the last processed new-block message
    splinfo.startTS = body.date;
    splinfo.startUID = id;
    // loop for old traversal
    for (; i < ids.length; i++) {
      id = ids[i];
      oldDict[id] = splock.bodies[id];
    }

    var oldEndUID = ids[numHeaders];
    var olderInfo = this._makeBodyBlock(
      savedStartTS, savedStartUID,
      oldDict[oldEndUID].date, oldEndUID,
      splinfo.estSize - newerBytes,
      // (the older block gets the uids the new/existing block does not want,
      //  leaving `uids` containing only the d
      ids.splice(numHeaders, ids.length - numHeaders),
      oldDict);
    splinfo.estSize = newerBytes;
    splock.bodies = newDict;
    // _makeBodyBlock dirties the block it creates and touches _dirty
    this._dirtyBodyBlocks[splinfo.blockId] = splock;

    return olderInfo;
  },

  /**
   * Flush cached blocks that are unlikely to be used again soon.  Our
   * heuristics for deciding what to keep is simple:
   * - Dirty blocks are always kept; this is required for correctness.
   * - Header blocks that overlap with live `MailSlice` instances are kept.
   *
   * It could also make sense to support some type of MRU tracking, but the
   * complexity is not currently justified since the live `MailSlice` should
   * lead to a near-perfect hit rate on immediate actions and the UI's
   * pre-emptive slice growing should insulate it from any foolish discards
   * we might make.
   *
   * For bodies, since they are larger, and the UI may not always shrink a
   * slice, only keep around one blockInfo of them, which contain the most
   * likely immediately needed blockInfos, for instance a direction reversal
   * in a next/previous navigation.
   */
  flushExcessCachedBlocks: function(debugLabel) {
    // We only care about explicitly folder-backed slices for cache eviction
    // purposes.  Search filters are sparse and would keep way too much in
    // memory.
    var slices = this._slices.filter(function (slice) {
                   return slice.type === 'folder';
                 });
    function blockIntersectsAnySlice(blockInfo) {
      for (var i = 0; i < slices.length; i++) {
        var slice = slices[i];
        if (tupleRangeIntersectsTupleRange(slice, blockInfo)) {
          // Here is some useful debug you can uncomment!
          /*
          console.log('  slice intersect. slice:',
                      slice.startTS, slice.startUID,
                      slice.endTS, slice.endUID, '  block:',
                      blockInfo.startTS, blockInfo.startUID,
                      blockInfo.endTS, blockInfo.endUID);
           */
          return true;
        }
      }
      return false;
    }
    function maybeDiscard(blockType, blockInfoList, loadedBlockInfos,
                          blockMap, dirtyMap, shouldDiscardFunc) {
      // console.warn('!! flushing', blockType, 'blocks because:', debugLabel);

      // Go backwards in array, to allow code to keep a count of
      // blockInfos to keep that favor the most current ones.
      for (var i = loadedBlockInfos.length - 1; i > -1; i--) {
        var blockInfo = loadedBlockInfos[i];
        // do not discard dirty blocks
        if (dirtyMap.hasOwnProperty(blockInfo.blockId)) {
          // console.log('  dirty block:', blockInfo.blockId);
          continue;
        }

        if (shouldDiscardFunc(blockInfo)) {
          // console.log('discarding', blockType, 'block', blockInfo.blockId);
          delete blockMap[blockInfo.blockId];
          loadedBlockInfos.splice(i, 1);
        }
      }
    }

    maybeDiscard(
      'header',
      this._headerBlockInfos,
      this._loadedHeaderBlockInfos,
      this._headerBlocks,
      this._dirtyHeaderBlocks,
      function (blockInfo) {
        // Do not discard blocks that overlap mail slices.
        return !blockIntersectsAnySlice(blockInfo);
      }
    );

    // Keep one body block around if there are open folder slices.  If there are
    // no open slices, discard everything.  (If there are no headers then there
    // isn't really a way to access the bodies.)
    var keepCount = slices.length ? 1 : 0,
        foundCount = 0;

    maybeDiscard(
      'body',
      this._bodyBlockInfos,
      this._loadedBodyBlockInfos,
      this._bodyBlocks,
      this._dirtyBodyBlocks,
      function(blockInfo) {
        // For bodies, want to always purge as front end may decide to
        // never shrink a messages slice, but keep one block around to
        // avoid wasteful DB IO for commonly grouped operations, for
        // example, a next/previous message navigation direction change.
        foundCount += 1;
        return foundCount > keepCount;
      }
    );
  },

  /**
   * Called after a timeout to do cleanup of cached blocks to keep memory
   * low. However, only do the cleanup if there is no more mutex-controlled
   * work so as to keep likely useful cache items still in memory.
   */
  _flushExcessOnTimeout: function() {
    this._flushExcessTimeoutId = 0;
    if (!this.isDead && this._mutexQueue.length === 0) {
      this.flushExcessCachedBlocks('flushExcessOnTimeout');
    }
  },

  /**
   * Discard the cached block that contains the message header or body in
   * question.  This is intended to be used in cases where we want to re-read
   * a header or body from disk to get IndexedDB file-backed Blobs to replace
   * our (likely) memory-backed Blobs.
   *
   * This will log, but not throw, an error in the event the block in question
   * is currently tracked as a dirty block or there is no block that contains
   * the named message.  Both cases indicate an assumption that is being
   * violated.  This should cause unit tests to fail but not break us if this
   * happens out in the real-world.
   *
   * If the block is not currently loaded, no error is triggered.
   *
   * This method executes synchronously.
   *
   * @method _discardCachedBlockUsingDateAndID
   * @param type {'header'|'body'}
   * @param date {Number}
   *   The timestamp of the message in question.
   * @param id {Number}
   *   The folder-local id we allocated for the message.  Not the SUID, not the
   *   server-id.
   */
  _discardCachedBlockUsingDateAndID: function(type, date, id) {
    var scope = logic.subscope(this, { type: type, date: date, id: id });

    var blockInfoList, loadedBlockInfoList, blockMap, dirtyMap;
    logic(scope, 'discardFromBlock');
    if (type === 'header') {
      blockInfoList = this._headerBlockInfos;
      loadedBlockInfoList = this._loadedHeaderBlockInfos;
      blockMap = this._headerBlocks;
      dirtyMap = this._dirtyHeaderBlocks;
    }
    else {
      blockInfoList = this._bodyBlockInfos;
      loadedBlockInfoList = this._loadedBodyBlockInfos;
      blockMap = this._bodyBlocks;
      dirtyMap = this._dirtyBodyBlocks;
    }

    var infoTuple = this._findRangeObjIndexForDateAndID(blockInfoList,
                                                        date, id),
        iInfo = infoTuple[0], info = infoTuple[1];
    // Asking to discard something that does not exist in a block is a
    // violated assumption.  Log an error.
    if (!info) {
      logic(scope, 'badDiscardRequest');
      return;
    }

    var blockId = info.blockId;
    // Nothing to do if the block isn't present
    if (!blockMap.hasOwnProperty(blockId))
      return;

    // Violated assumption if the block is dirty
    if (dirtyMap.hasOwnProperty(blockId)) {
      logic(scope, 'badDiscardRequest');
      return;
    }

    // Discard the block
    delete blockMap[blockId];
    var idxLoaded = loadedBlockInfoList.indexOf(info);
    // Something is horribly wrong if this is -1.
    if (idxLoaded !== -1)
      loadedBlockInfoList.splice(idxLoaded, 1);
  },

  /**
   * Purge messages from disk storage for size and/or time reasons.  This is
   * only used for IMAP folders and we fast-path out if invoked on ActiveSync.
   *
   * This method is invoked as a result of new block allocation as a job /
   * operation run inside a mutex.  This means that we won't be run unless a
   * synchronization job triggers us and that we won't run until that
   * synchronization job completes.  This is important because it means that
   * if a user doesn't use the mail app for a long time it's not like a cron
   * process will purge our synchronized state for everything so that when they
   * next use the mail app all the information will be gone.  Likewise, if the
   * user is disconnected from the net, we won't purge their cached stuff that
   * they are still looking at.  The non-obvious impact on 'archive' folders
   * whose first messages are quite some ways in the past is that the accuracy
   * range for archive folders will have been updated with the current date for
   * at least whatever the UI needed, so we won't go completely purging archive
   * folders.
   *
   * Our strategy is to pick cut points based on a few heuristics and then go
   * with the deepest cut.  Cuts are time-based and always quantized to the
   * subsequent local (timezone compensated) midnight for the server in order to
   * line up with our sync boundaries.  The cut point defines an exclusive range
   * of [0, cutTS).
   *
   * The heuristics are:
   *
   * - Last (online) access: scan accuracy ranges from the oldest until we run
   *   into one that is less than `$sync.BLOCK_PURGE_ONLY_AFTER_UNSYNCED_MS`
   *   milliseconds old.  We clip this against the 'syncRange' interval for the
   *   account.
   *
   * - Hard block limits: If there are more than
   *   `$sync.BLOCK_PURGE_HARD_MAX_BLOCK_LIMIT` header or body blocks, then we
   *   issue a cut-point of the start date of the block at that index.  The date
   *   will then be quantized, which may effectively result in more blocks being
   *   discarded.
   *
   * Deletion is performed by asynchronously, iteratively:
   * - Making sure the oldest header block is loaded.
   * - Checking the oldest header in the block.  If it is more recent than our
   *   cut point, then we are done.
   *
   * What we *do not* do:
   * - We do not do anything about attachments saved to DeviceStorage.  We leave
   *   those around and it's on the user to clean those up from the gallery.
   * - We do not currently take the size of downloaded embedded images into
   *   account.
   *
   * @args[
   *   @param[callback @func[
   *     @args[
   *       @param[numDeleted Number]{
   *         The number of messages deleted.
   *       }
   *       @param[cutTS DateMS]
   *     ]
   *   ]]
   * ]
   */
  purgeExcessMessages: function(callback) {
    this._messagePurgeScheduled = false;
    var cutTS = Math.max(
      this._purge_findLastAccessCutPoint(),
      this._purge_findHardBlockCutPoint(this._headerBlockInfos),
      this._purge_findHardBlockCutPoint(this._bodyBlockInfos));

    if (cutTS === 0) {
      callback(0, cutTS);
      return;
    }

    // Quantize to the subsequent UTC midnight, then apply the timezone
    // adjustment that is what our IMAP database lookup does to account for
    // skew.  (See `ImapFolderConn.syncDateRange`)
    cutTS = quantizeDate(cutTS + DAY_MILLIS);

    // Update the accuracy ranges by nuking accuracy ranges that are no longer
    // relevant and updating any overlapped range.
    var aranges = this._accuracyRanges;
    var splitInfo = this._findFirstObjIndexForDateRange(aranges, cutTS, cutTS);
    // we only need to update a range if there was in fact some overlap.
    if (splitInfo[1]) {
      splitInfo[1].startTS = cutTS;
      // then be sure not to splice ourselves...
      aranges.splice(splitInfo[0] + 1, aranges.length - splitInfo[0]);
    }
    else {
      // do splice things at/after
      aranges.splice(splitInfo[0], aranges.length - splitInfo[0]);
    }

    var headerBlockInfos = this._headerBlockInfos,
        headerBlocks = this._headerBlocks,
        deletionCount = 0,
        // These variables let us detect if the deletion happened fully
        // synchronously and thereby avoid blowing up the stack.
        callActive = false, deleteTriggered = false;
    var deleteNextHeader = function() {
      // if things are happening synchronously, bail out
      if (callActive) {
        deleteTriggered = true;
        return;
      }

      while (true) {
        // - bail if we ran out of blocks somehow
        if (!headerBlockInfos.length) {
          callback(deletionCount, cutTS);
          return;
        }
        // - load the last header block if not currently loaded
        var blockInfo = headerBlockInfos[headerBlockInfos.length - 1];
        if (!this._headerBlocks.hasOwnProperty(blockInfo.blockId)) {
          this._loadBlock('header', blockInfo, deleteNextHeader);
          return;
        }
        // - get the last header, check it
        var headerBlock = this._headerBlocks[blockInfo.blockId],
            lastHeader = headerBlock.headers[headerBlock.headers.length - 1];
        if (SINCE(lastHeader.date, cutTS)) {
          // all done! header is more recent than the cut date
          callback(deletionCount, cutTS);
          return;
        }
        deleteTriggered = false;
        callActive = true;
        deletionCount++;
        this.deleteMessageHeaderAndBodyUsingHeader(lastHeader,
                                                   deleteNextHeader);
        callActive = false;
        if (!deleteTriggered)
          return;
      }
    }.bind(this);
    deleteNextHeader();
  },

  _purge_findLastAccessCutPoint: function() {
    var aranges = this._accuracyRanges,
        cutoffDate = $date.NOW() - $sync.BLOCK_PURGE_ONLY_AFTER_UNSYNCED_MS;
    // When the loop terminates, this is the block we should use to cut, so
    // start with an invalid value.
    var iCutRange;
    for (iCutRange = aranges.length; iCutRange >= 1; iCutRange--) {
      var arange = aranges[iCutRange - 1];
      // We can destroy things that aren't fully synchronized.
      // NB: this case was intended for search-on-server which is not yet
      // implemented.
      if (!arange.fullSync)
        continue;
      if (arange.fullSync.updated > cutoffDate)
        break;
    }
    if (iCutRange === aranges.length)
      return 0;

    var cutTS = aranges[iCutRange].endTS,
        syncRangeMS = $sync.SYNC_RANGE_ENUMS_TO_MS[
                        this._account.accountDef.syncRange] ||
                      $sync.SYNC_RANGE_ENUMS_TO_MS['auto'],
        // Determine the sync horizon, but then subtract an extra day off so
        // that the quantization does not take a bite out of the sync range
        syncHorizonTS = $date.NOW() - syncRangeMS - DAY_MILLIS;

    // If the proposed cut is more recent than our sync horizon, use the sync
    // horizon.
    if (STRICTLY_AFTER(cutTS, syncHorizonTS))
      return syncHorizonTS;
    return cutTS;
  },

  _purge_findHardBlockCutPoint: function(blockInfoList) {
    if (blockInfoList.length <= $sync.BLOCK_PURGE_HARD_MAX_BLOCK_LIMIT)
      return 0;
    return blockInfoList[$sync.BLOCK_PURGE_HARD_MAX_BLOCK_LIMIT].startTS;
  },

  /**
   * Find the first object that contains date ranges whose date ranges contains
   * the provided date.  For use to find the right index in `_accuracyRanges`,
   * `_headerBlockInfos`, and `_bodyBlockInfos`, all of which are pre-sorted.
   *
   * @return[@list[
   *   @param[index Number]{
   *     The index of the Object that contains the date, or if there is no such
   *     structure, the index that it should be inserted at.
   *   }
   *   @param[inside Object]
   * ]]
   */
  _findRangeObjIndexForDate: function ifs__findRangeObjIndexForDate(
      list, date) {
    var i;
    // linear scan for now; binary search later
    for (i = 0; i < list.length; i++) {
      var info = list[i];
      // - Stop if we will never find a match if we keep going.
      // If our date is after the end of this range, then it will never fall
      // inside any subsequent ranges, because they are all chronologically
      // earlier than this range.
      if (SINCE(date, info.endTS))
        return [i, null];
      // therefore BEFORE(date, info.endTS)

      if (SINCE(date, info.startTS))
        return [i, info];
      // (Older than the startTS, keep going.)
    }

    return [i, null];
  },

  /**
   * Find the first object that contains date ranges whose date ranges contains
   * the provided composite date/UID.  For use to find the right index in
   * `_headerBlockInfos`, and `_bodyBlockInfos`, all of which are pre-sorted.
   *
   * @return[@list[
   *   @param[index Number]{
   *     The index of the Object that contains the date, or if there is no such
   *     structure, the index that it should be inserted at.
   *   }
   *   @param[inside Object]
   * ]]
   */
  _findRangeObjIndexForDateAndID: function ifs__findRangeObjIndexForDateAndID(
      list, date, uid) {
    var i;
    // linear scan for now; binary search later
    for (i = 0; i < list.length; i++) {
      var info = list[i];
      // - Stop if we will never find a match if we keep going.
      // If our date is after the end of this range, then it will never fall
      // inside any subsequent ranges, because they are all chronologically
      // earlier than this range.
      // If our date is the same and our UID is higher, then likewise we
      // shouldn't go further because IDs decrease too.
      if (STRICTLY_AFTER(date, info.endTS) ||
          (date === info.endTS && uid > info.endUID))
        return [i, null];
      // therefore BEFORE(date, info.endTS) ||
      //           (date === info.endTS && uid <= info.endUID)
      if (STRICTLY_AFTER(date, info.startTS) ||
          (date === info.startTS && uid >= info.startUID))
        return [i, info];
      // (Older than the startTS, keep going.)
    }

    return [i, null];
  },


  /**
   * Find the first object that contains date ranges that overlaps the provided
   * date range.  Scans from the present into the past.  If endTS is null, get
   * treat it as being a date infinitely far in the future.
   */
  _findFirstObjIndexForDateRange: function ifs__findFirstObjIndexForDateRange(
      list, startTS, endTS) {
    var i;
    // linear scan for now; binary search later
    for (i = 0; i < list.length; i++) {
      var info = list[i];
      // - Stop if we will never find a match if we keep going.
      // If our comparison range starts AFTER the end of this range, then it
      // does not overlap this range and will never overlap any subsequent
      // ranges because they are all chronologically earlier than this range.
      //
      // nb: We are saying that there is no overlap if one range starts where
      // the other one ends.  This is consistent with the inclusive/exclusive
      // definition of since/before and our ranges.
      if (STRICTLY_AFTER(startTS, info.endTS))
        return [i, null];
      // therefore ON_OR_BEFORE(startTS, info.endTS)

      // nb: SINCE(endTS, info.startTS) is not right here because the equals
      // case does not result in overlap because endTS is exclusive.
      if (endTS === null || STRICTLY_AFTER(endTS, info.startTS))
        return [i, info];
      // (no overlap yet)
    }

    return [i, null];
  },

  /**
   * Find the last object that contains date ranges that overlaps the provided
   * date range.  Scans from the past into the present.
   */
  _findLastObjIndexForDateRange: function ifs__findLastObjIndexForDateRange(
      list, startTS, endTS) {
    var i;
    // linear scan for now; binary search later
    for (i = list.length - 1; i >= 0; i--) {
      var info = list[i];
      // - Stop if we will never find a match if we keep going.
      // If our comparison range ends ON OR BEFORE the end of this range, then
      // it does not overlap this range and will never overlap any subsequent
      // ranges because they are all chronologically later than this range.
      //
      // nb: We are saying that there is no overlap if one range starts where
      // the other one ends.  This is consistent with the inclusive/exclusive
      // definition of since/before and our ranges.
      if (ON_OR_BEFORE(endTS, info.startTS))
        return [i + 1, null];
      // therefore STRICTLY_AFTER(endTS, info.startTS)

      // we match in this entry if the start stamp is before the range's end
      if (BEFORE(startTS, info.endTS))
        return [i, info];

      // (no overlap yet)
    }

    return [0, null];
  },


  /**
   * Find the first object in the list whose `date` falls inside the given
   * IMAP style date range.  If `endTS` is null, find the first object whose
   * `date` is at least `startTS`.
   */
  _findFirstObjForDateRange: function ifs__findFirstObjForDateRange(
      list, startTS, endTS) {
    var i;
    var dateComparator = endTS === null ? SINCE : IN_BS_DATE_RANGE;
    for (i = 0; i < list.length; i++) {
      var date = list[i].date;
      if (dateComparator(date, startTS, endTS))
        return [i, list[i]];
    }
    return [i, null];
  },

  /**
   * Find the right block to insert a header/body into using its date and UID.
   * This is an asynchronous operation because we potentially need to load
   * blocks from disk.
   *
   * == Usage patterns
   *
   * - In initial-sync cases and scrolling down through the list, we will
   *   generate messages from a younger-to-older direction.  The insertion point
   *   will then likely occur after the last block.
   * - In update-sync cases, we should be primarily dealing with new mail which
   *   is still retrieved endTS to startTS.  The insertion point will start
   *   before the first block and then move backwards within that block.
   * - Update-sync cases may also encounter messages moved into the folder
   *   from other folders since the last sync.  An archive folder is the
   *   most likely case for this, and we would expect random additions with a
   *   high degree of clustering on message date.
   * - Update-sync cases may experience a lot of apparent message deletion due
   *   to actual deletion or moves to other folders.  These can shrink blocks
   *   and we need to consider block merges to avoid pathological behavior.
   * - Forgetting messages that are no longer being kept alive by sync settings
   *   or apparent user interest.  There's no benefit to churn for the sake of
   *   churn, so we can just forget messages in blocks wholesale when we
   *   experience disk space pressure (from ourselves or elsewhere).  In that
   *   case we will want to traverse from the startTS messages, dropping them and
   *   consolidating blocks as we go until we have freed up enough space.
   *
   * == General strategy
   *
   * - If we fall in an existing block and it won't overflow, use it.
   * - If we fall in an existing block and it would overflow, split it.
   * - If we fall outside existing blocks, check older and newer blocks in that
   *   order for a non-overflow fit.  If we would overflow, pick the existing
   *   block further from the center to perform a split.
   * - If there are no existing blocks at all, create a new one.
   * - When splitting, if we are the first or last block, split 2/3 towards the
   *   center and 1/3 towards the edge.  The idea is that growth is most likely
   *   to occur near the edges, so concentrate the empty space there without
   *   leaving the center blocks so overloaded they can't accept random
   *   additions without further splits.
   * - When splitting, otherwise, split equally-ish.
   *
   * == Block I/O
   *
   * While we can make decisions about where to insert things, we need to have
   * blocks in memory in order to perform the actual splits.  The outcome
   * of splits can't be predicted because the size of things in blocks is
   * only known when the block is loaded.
   *
   * @args[
   *   @param[type @oneof['header' 'body']]
   *   @param[date DateMS]
   *   @param[estSizeCost Number]{
   *     The rough byte cost of whatever we want to stick in a block.
   *   }
   *   @param[thing Object]
   *   @param[blockPickedCallback @func[
   *     @args[
   *       @param[blockInfo FolderBlockInfo]
   *       @param[block @oneof[HeaderBlock BodyBlock]]
   *     ]
   *   ]]{
   *     Callback function to invoke once we have found/created/made-room-for
   *     the thing in the block.  This needs to be a callback because if we need
   *     to perform any splits, we require that the block be loaded into memory
   *     first.  (For consistency and simplicity, we then made us always return
   *     the block.)
   *   }
   * ]
   */
  _insertIntoBlockUsingDateAndUID: function ifs__pickInsertionBlocks(
      type, date, uid, srvid, estSizeCost, thing, blockPickedCallback) {
    var blockInfoList, loadedBlockInfoList, blockMap, makeBlock, insertInBlock,
        splitBlock, serverIdBlockMapping;
    if (type === 'header') {
      blockInfoList = this._headerBlockInfos;
      loadedBlockInfoList = this._loadedHeaderBlockInfos;
      blockMap = this._headerBlocks;
      serverIdBlockMapping = this._serverIdHeaderBlockMapping;
      makeBlock = this._bound_makeHeaderBlock;
      insertInBlock = this._bound_insertHeaderInBlock;
      splitBlock = this._bound_splitHeaderBlock;
    }
    else {
      blockInfoList = this._bodyBlockInfos;
      loadedBlockInfoList = this._loadedBodyBlockInfos;
      blockMap = this._bodyBlocks;
      serverIdBlockMapping = null; // only headers have the mapping
      makeBlock = this._bound_makeBodyBlock;
      insertInBlock = this._bound_insertBodyInBlock;
      splitBlock = this._bound_splitBodyBlock;
    }

    // -- find the current containing block / insertion point
    var infoTuple = this._findRangeObjIndexForDateAndID(blockInfoList,
                                                        date, uid),
        iInfo = infoTuple[0], info = infoTuple[1];

    // For database consistency reasons in the worst-case we want to make sure
    // that we don't update the block info structure until we are also
    // simultaneously updating the block itself.  We use null for sentinel
    // values.  We only update when non-null.
    var updateInfo = {
      startTS: null,
      startUID: null,
      endTS: null,
      endUID: null
    };

    // -- not in a block, find or create one
    if (!info) {
      // - Create a block if no blocks exist at all.
      if (blockInfoList.length === 0) {
        info = makeBlock(date, uid, date, uid);
        blockInfoList.splice(iInfo, 0, info);
        loadedBlockInfoList.push(info);
      }
      // - Is there a trailing/older dude and we fit?
      else if (iInfo < blockInfoList.length &&
               (blockInfoList[iInfo].estSize + estSizeCost <
                 $sync.MAX_BLOCK_SIZE)) {
        info = blockInfoList[iInfo];

        // We are chronologically/UID-ically more recent, so check the end range
        // for expansion needs.
        if (STRICTLY_AFTER(date, info.endTS)) {
          updateInfo.endTS = date;
          updateInfo.endUID = uid;
        }
        else if (date === info.endTS &&
                 uid > info.endUID) {
          updateInfo.endUID = uid;
        }
      }
      // - Is there a preceding/younger dude and we fit?
      else if (iInfo > 0 &&
               (blockInfoList[iInfo - 1].estSize + estSizeCost <
                  $sync.MAX_BLOCK_SIZE)) {
        info = blockInfoList[--iInfo];

        // We are chronologically less recent, so check the start range for
        // expansion needs.
        if (BEFORE(date, info.startTS)) {
          updateInfo.startTS = date;
          updateInfo.startUID = uid;
        }
        else if (date === info.startTS &&
                 uid < info.startUID) {
          updateInfo.startUID = uid;
        }
      }
      // Any adjacent blocks at this point are overflowing, so it's now a
      // question of who to split.  We pick the one further from the center that
      // exists.
      // - Preceding (if possible and) suitable OR the only choice
      else if ((iInfo > 0 && iInfo < blockInfoList.length / 2) ||
               (iInfo === blockInfoList.length)) {
        info = blockInfoList[--iInfo];
        // We are chronologically less recent, so check the start range for
        // expansion needs.
        if (BEFORE(date, info.startTS)) {
          updateInfo.startTS = date;
          updateInfo.startUID = uid;
        }
        else if (date === info.startTS &&
                 uid < info.startUID) {
          updateInfo.startUID = uid;
        }
      }
      // - It must be the trailing dude
      else {
        info = blockInfoList[iInfo];
        // We are chronologically/UID-ically more recent, so check the end range
        // for expansion needs.
        if (STRICTLY_AFTER(date, info.endTS)) {
          updateInfo.endTS = date;
          updateInfo.endUID = uid;
        }
        else if (date === info.endTS &&
                 uid > info.endUID) {
          updateInfo.endUID = uid;
        }
      }
    }
    // (info now definitely exists and is definitely in blockInfoList)

    function processBlock(block) { // 'this' gets explicitly bound
      // -- perform the insertion
      // - update block info
      if (updateInfo.startTS !== null) {
        info.startTS = updateInfo.startTS;
      }
      if (updateInfo.startUID !== null) {
        info.startUID = updateInfo.startUID;
      }
      if (updateInfo.endTS !== null) {
        info.endTS = updateInfo.endTS;
      }
      if (updateInfo.endUID !== null) {
        info.endUID = updateInfo.endUID;
      }
      // We could do this after the split, but this makes things simpler if
      // we want to factor in the newly inserted thing's size in the
      // distribution of bytes.
      info.estSize += estSizeCost;
      info.count++;

      // - actual insertion
      insertInBlock(thing, uid, info, block);

      // -- split if necessary
      if (info.count > 1 && info.estSize >= $sync.MAX_BLOCK_SIZE) {
        // - figure the desired resulting sizes
        var firstBlockTarget;
        // big part to the center at the edges (favoring front edge)
        if (iInfo === 0)
          firstBlockTarget = $sync.BLOCK_SPLIT_SMALL_PART;
        else if (iInfo === blockInfoList.length - 1)
          firstBlockTarget = $sync.BLOCK_SPLIT_LARGE_PART;
        // otherwise equal split
        else
          firstBlockTarget = $sync.BLOCK_SPLIT_EQUAL_PART;


        // - split
        var olderInfo;
        olderInfo = splitBlock(info, block, firstBlockTarget);
        blockInfoList.splice(iInfo + 1, 0, olderInfo);
        loadedBlockInfoList.push(olderInfo);

        // - figure which of the blocks our insertion went in
        if (BEFORE(date, olderInfo.endTS) ||
            ((date === olderInfo.endTS) && (uid <= olderInfo.endUID))) {
          iInfo++;
          info = olderInfo;
          block = blockMap[info.blockId];
        }
      }
      // otherwise, no split necessary, just use it
      if (serverIdBlockMapping && srvid)
        serverIdBlockMapping[srvid] = info.blockId;

      if (blockPickedCallback) {
        blockPickedCallback(info, block);
      }
    }

    if (blockMap.hasOwnProperty(info.blockId))
      processBlock.call(this, blockMap[info.blockId]);
    else
      this._loadBlock(type, info, processBlock.bind(this));
  },

  /**
   * Run deferred calls until we run out of deferred calls or _pendingLoads goes
   * non-zero again.
   */
  _runDeferredCalls: function ifs__runDeferredCalls() {
    while (this._deferredCalls.length && this._pendingLoads.length === 0) {
      var toCall = this._deferredCalls.shift();
      try {
        toCall();
      }
      catch (ex) {
        logic(this, 'callbackErr', { ex: ex });
      }
    }
  },

  _findBlockInfoFromBlockId: function(type, blockId) {
    var blockInfoList;
    if (type === 'header')
      blockInfoList = this._headerBlockInfos;
    else
      blockInfoList = this._bodyBlockInfos;

    for (var i = 0; i < blockInfoList.length; i++) {
      var blockInfo = blockInfoList[i];
      if (blockInfo.blockId === blockId)
        return blockInfo;
    }
    return null;
  },

  /**
   * Request the load of the given block and the invocation of the callback with
   * the block when the load completes.
   */
  _loadBlock: function ifs__loadBlock(type, blockInfo, callback) {
    var blockId = blockInfo.blockId;
    var aggrId = type + blockId;
    if (this._pendingLoads.indexOf(aggrId) !== -1) {
      this._pendingLoadListeners[aggrId].push(callback);
      return;
    }

    var index = this._pendingLoads.length;
    this._pendingLoads.push(aggrId);
    this._pendingLoadListeners[aggrId] = [callback];

    var self = this;
    function onLoaded(block) {
      if (!block)
        logic(self, 'badBlockLoad', { type: type, blockId: blockId });
      logic(self, 'loadBlock_end',
            { type: type, blockId: blockId, block: block });
      if (type === 'header') {
        self._headerBlocks[blockId] = block;
        self._loadedHeaderBlockInfos.push(blockInfo);
      }
      else {
        self._bodyBlocks[blockId] = block;
        self._loadedBodyBlockInfos.push(blockInfo);
      }
      self._pendingLoads.splice(self._pendingLoads.indexOf(aggrId), 1);
      var listeners = self._pendingLoadListeners[aggrId];
      delete self._pendingLoadListeners[aggrId];
      for (var i = 0; i < listeners.length; i++) {
        try {
          listeners[i](block);
        }
        catch (ex) {
          logic(self, 'callbackErr', { ex: ex });
        }
      }

      if (self._pendingLoads.length === 0)
        self._runDeferredCalls();

      // Ask for cleanup of old blocks in case the UI is not shrinking
      // any slices.
      if (self._mutexQueue.length === 0 && !self._flushExcessTimeoutId) {
        self._flushExcessTimeoutId = setTimeout(
          self._bound_flushExcessOnTimeout,
          // Choose 5 seconds, since it is a human-scale value around
          // the order of how long we expect it would take the user
          // to realize they hit the opposite arrow navigation button
          // from what they meant.
          5000
        );
      }
    }

    logic(this, 'loadBlock_begin', { type: type, blockId: blockId });
    if (type === 'header')
      this._imapDb.loadHeaderBlock(this.folderId, blockId, onLoaded);
    else
      this._imapDb.loadBodyBlock(this.folderId, blockId, onLoaded);
  },

  _deleteFromBlock: function ifs__deleteFromBlock(type, date, id, callback) {
    var blockInfoList, loadedBlockInfoList, blockMap, deleteFromBlock;
    var scope = logic.subscope(this, { type: type, date: date, id: id });
    logic(scope, 'deleteFromBlock');
    if (type === 'header') {
      blockInfoList = this._headerBlockInfos;
      loadedBlockInfoList = this._loadedHeaderBlockInfos;
      blockMap = this._headerBlocks;
      deleteFromBlock = this._bound_deleteHeaderFromBlock;
    }
    else {
      blockInfoList = this._bodyBlockInfos;
      loadedBlockInfoList = this._loadedBodyBlockInfos;
      blockMap = this._bodyBlocks;
      deleteFromBlock = this._bound_deleteBodyFromBlock;
    }

    var infoTuple = this._findRangeObjIndexForDateAndID(blockInfoList,
                                                        date, id),
        iInfo = infoTuple[0], info = infoTuple[1];
    // If someone is asking for us to delete something, there should definitely
    // be a block that includes it!
    if (!info) {
      console.log('badDeletionRequest');
      return;
    }

    function processBlock(block) {
      // The delete function is in charge of updating the start/end TS/ID info
      // because it knows about the internal block structure to do so.
      deleteFromBlock(id, info, block);

      // - Nuke the block if it's empty
      if (info.count === 0) {
        blockInfoList.splice(iInfo, 1);
        delete blockMap[info.blockId];
        loadedBlockInfoList.splice(loadedBlockInfoList.indexOf(info), 1);

        this._dirty = true;
        if (type === 'header')
          this._dirtyHeaderBlocks[info.blockId] = null;
        else
          this._dirtyBodyBlocks[info.blockId] = null;
      }
      if (callback)
        callback();
    }
    if (blockMap.hasOwnProperty(info.blockId))
      processBlock.call(this, blockMap[info.blockId]);
    else
      this._loadBlock(type, info, processBlock.bind(this));
  },

  sliceOpenSearch: function fs_sliceOpenSearch(slice) {
    this._slices.push(slice);
  },

  /**
   * Track a new slice that wants to start from the most recent messages we know
   * about in the folder.
   *
   * If we have previously synchronized the folder, we will return the known
   * messages from the database.  If we are also online, we will trigger a
   * refresh covering the time range of the messages.
   *
   * If we have not previously synchronized the folder, we will initiate
   * synchronization starting from 'now'.
   *
   * For IMAP, an important ramification is that merely opening a slice may not
   * cause us to synchronize all the way up to 'now'.  The slice's consumer will
   * need to keep checking 'atTop' and 'userCanGrowUpwards' and trigger
   * synchronizations until they both go false.  For consumers that really only
   * want us to synchronize the most recent messages, they should either
   * consider purging our storage first or creating a new API that deals with
   * the change in invariants so that gaps in synchronized intervals can exist.
   *
   * Note: previously, we had a function called "sliceOpenFromNow" that would
   * provide guarantees that the slice was accurate and grown from 'now'
   * backwards, but at the very high cost of potentially requiring the user to
   * wait until some amount of synchronization was required.  This resulted in
   * bad UX from a latency perspective and also actually increased
   * synchronization complexity because we had to implement multiple sync
   * heuristics.  Our new approach is much better from a latency perspective but
   * may result in UI complications since we can be so far behind 'now'.
   *
   * @args[
   *   @param[forceRefresh #:optional Boolean]{
   *     Should we ensure that we try and perform a refresh if we are online?
   *     Without this flag, we may decide not to attempt to trigger a refresh
   *     if our data is sufficiently recent.
   *   }
   * ]
   */
  sliceOpenMostRecent: function fs_sliceOpenMostRecent(slice, forceRefresh) {
    // Set the status immediately so that the UI will convey that the request is
    // being processed, even though it might take a little bit to acquire the
    // mutex.
    slice.setStatus('synchronizing', false, true, false,
                    SYNC_START_MINIMUM_PROGRESS);

    var sliceFn = this._sliceOpenMostRecent.bind(this, slice, forceRefresh);

    // Local-only folders don't have a real sync process, so we don't
    // need to hold the mutex when syncing; all mutating operations
    // run in job-ops.
    if (this.isLocalOnly || !this._account.universe.online ||
        !this._account.accountDef.syncEnable) {
      sliceFn(function fakeReleaseMutex() { /* nothing to do */ });
    } else {
      this.runMutexed('sync', sliceFn);
    }
  },
  _sliceOpenMostRecent: function fs__sliceOpenMostRecent(slice, forceRefresh,
                                                         releaseMutex) {
    // We only put the slice in the list of slices now that we have the mutex
    // in order to avoid having the slice have data fed into it if there were
    // other synchronizations already in progress.
    this._slices.push(slice);
    // refresh the headerCount; it might have gotten stalled out if a
    // double-open happened.
    slice.headerCount = this.headerCount;
    var doneCallback = function doneSyncCallback(err, reportSyncStatusAs,
                                                 moreExpected) {
      if (!reportSyncStatusAs) {
        if (err)
          reportSyncStatusAs = 'syncfailed';
        else
          reportSyncStatusAs = 'synced';
      }
      if (moreExpected === undefined)
        moreExpected = false;

      slice.waitingOnData = false;
      slice.setStatus(reportSyncStatusAs, true, moreExpected, true);
      this._curSyncSlice = null;

      releaseMutex(err);
    }.bind(this);

    // -- grab from database if we have ever synchronized this folder
    // OR if it's synthetic

    if (this._accuracyRanges.length || this.isLocalOnly ||
        this._headerBlockInfos.length) {
      // We can only trigger a refresh if we are online.  Our caller may want to
      // force the refresh, ignoring recency data.  (This logic was too ugly as
      // a straight-up boolean/ternarny combo.)
      var triggerRefresh;
      if (this._account.universe.online && this.folderSyncer.syncable &&
          !this.isLocalOnly) {
        if (forceRefresh)
          triggerRefresh = 'force';
        else
          triggerRefresh = true;
      }
      else {
        triggerRefresh = false;
      }

      slice.waitingOnData = 'db';
      this.getMessagesInImapDateRange(
        0, null, $sync.INITIAL_FILL_SIZE, $sync.INITIAL_FILL_SIZE,
        // trigger a refresh if we are online
        this.onFetchDBHeaders.bind(
          this, slice, triggerRefresh,
          doneCallback, releaseMutex)
      );
      return;
    }
    // (we have never synchronized this folder)

    // -- no work to do if we are offline or synthetic folder
    if (!this._account.universe.online || this.isLocalOnly) {
      doneCallback();
      return;
    }
    // If the folder can't be synchronized right now, just report the sync as
    // blocked. We'll update it soon enough.
    if (!this.folderSyncer.syncable) {
      console.log('Synchronization is currently blocked; waiting...');
      doneCallback(null, 'syncblocked', true);
      return;
    }

    // -- Bad existing data, issue a sync
    var progressCallback = slice.setSyncProgress.bind(slice);
    var syncCallback = function syncCallback(syncMode,
                                             ignoreHeaders) {
      slice.waitingOnData = syncMode;
      if (ignoreHeaders) {
        slice.ignoreHeaders = true;
      }
      this._curSyncSlice = slice;
      // headerCount is updated as changes occur, but as a base case we need to
      // update it here.  (Note: the slice also initialized itself with this
      // value when created, but since this is by definition an async
      // callback...)
      slice.headerCount = this.headerCount;
    }.bind(this);

    // The slice flags are not yet valid; we are primarily interested in having
    // atTop be true when splice notifications for generated as headers are
    // added.
    slice._updateSliceFlags();
    this.folderSyncer.initialSync(
      slice, $sync.INITIAL_SYNC_DAYS,
      syncCallback, doneCallback, progressCallback);
  },

  /**
   * The slice wants more headers.  Grab from the database and/or sync as
   * appropriate to get more headers.  If there is a cost, require an explicit
   * request to perform the sync.
   *
   * We can think of there existing ~2 classes of headers that we might return
   * and our returned headers will always consist of only 1 of these classes at
   * a time.
   *
   * 1a) Headers from the database that are known to be up-to-date because they
   * were recently synchronized or refreshed.
   *
   * 1b) Headers from the database that need to be refreshed because our
   * information is old enough that we might be out of sync with the server.
   * For ActiveSync, no messages will ever be in this state.  For IMAP, this
   * is determined by checking the accuracy ranges and the REFRESH_THRESH_MS
   * constant.  Logic related to this lives in `ImapFolderSyncer`.
   *
   * 2) Headers that we need to synchronize with a growSync.  This only exists
   * for IMAP.
   *
   *
   * The steps we actually perform:
   *
   * - Try and get messages from the database.  If the database knows about
   * any, we will add them to the slice.
   *
   * - If there were any messages and `FolderSyncer.canGrowSync` is true, check
   * the time-span covered by the messages from the database.  If any of the
   * time-span is not sufficiently recently refreshed, issue a refresh over the
   * required time interval to bring those messages up-to-date.
   *
   * - Return if there were any headers.
   *
   * - Issue a grow request.  Start with the day adjacent to the furthest known
   *   message in the direction of growth.  We could alternately try and use
   *   the accuracy range to start even further away.  However, our growth
   *   process likes to keep going until it hits a message, and that's when
   *   it would commit its sync process, so the accuracy range is unlikely
   *   to buy us anything additional at the current time.
   */
  growSlice: function ifs_growSlice(slice, dirMagnitude, userRequestsGrowth) {
    // If the user requested synchronization, provide UI feedback immediately,
    // otherwise, let the method set this state if/when we actually decide to
    // talk to the server.
    if (userRequestsGrowth)
      slice.setStatus('synchronizing', false, true, false,
                      SYNC_START_MINIMUM_PROGRESS);
    this.runMutexed(
      'grow',
      this._growSlice.bind(this, slice, dirMagnitude, userRequestsGrowth));
  },
  _growSlice: function ifs__growSlice(slice, dirMagnitude, userRequestsGrowth,
                                      releaseMutex) {
    var dir, desiredCount;

    var batchHeaders = [];
    // --- process messages
    var gotMessages = function gotMessages(headers, moreExpected) {
      if (headers.length === 0) {
        // no array manipulation required
      }
      if (dir === PASTWARDS) {
        batchHeaders = batchHeaders.concat(headers);
      }
      else { // dir === FUTUREWARDS
        batchHeaders = headers.concat(batchHeaders);
      }

      if (moreExpected)
        return;

      // -- callbacks which may or may not get used
      var doneCallback = function doneGrowCallback(err) {
        // In a refresh, we may have asked for more than we know about in case
        // of a refresh at the edge where the database didn't have all the
        // headers we wanted, so latch it now.
        slice.desiredHeaders = slice.headers.length;
        slice.waitingOnData = false;
        slice.setStatus(err ? 'syncfailed' : 'synced', true, false, true);
        this._curSyncSlice = null;

        releaseMutex(err);
      }.bind(this);

      var progressCallback = slice.setSyncProgress.bind(slice);

      // -- Handle already-known headers
      if (batchHeaders.length) {
        var refreshInterval;

        // - compute refresh interval, if needed
            // offline? don't need a refresh!
        if (!this._account.universe.online ||
            // disabled account? don't need a refresh!
            !this._account.enabled ||
            // can't incrementally refresh? don't need a refresh!
            !this.folderSyncer.canGrowSync) {
          refreshInterval = null;
        }
        else {
          // - Figure out refresh range.
          // We want to make sure that our refresh covers any gaps between the
          // last message in our slice and the first message that we retrieved.

          // NB: endTS is exclusive, so we need to pad it out by a day relative
          // to a known message if we want to make sure it gets covered by the
          // sync range.

          // NB: We quantize to whole dates, but compensate for server timezones
          // so that our refresh actually lines up with the messages we are
          // interested in.  (We want the date in the server's timezone, so we
          // add the timezone to be relative to that timezone.)  We do adjust
          // startTS for the timezone offset in here rather than in the
          // quantization blow below because we do not timezone adjust the oldest
          // full sync date because it's already in the right 'units'.

          var highestLegalEndTS;
          // If we hit the highestLegalEndTS, flag that we should mark endTS as
          // open-ended if we decide we do need to refresh.
          var openEndTS = false;

          var startTS, endTS;
          if (dir === PASTWARDS) {
            var oldestHeader = batchHeaders[batchHeaders.length - 1];
            // If we were always going to sync the entire day, we could
            // subtract an entire day off of slice.startTS, but we are planning
            // to start grabbing less than whole days, so we want to leave it
            // up to checkAccuracyCoverageNeedingRefresh to get rid of any
            // redundant coverage of what we are currently looking at.
            //
            // We do want to cap the date so that we don't re-refresh today and
            // any other intervening days spuriously.  When we sync we only use
            // an endTS of tz-adjusted NOW(), so our rounding up can be too
            // aggressive otherwise and prevent range shrinking.  We call
            // quantizeDateUp afterwards so that if any part of the day is still
            // covered we will have our refresh cover it.
            //
            // NB: We use OPEN_REFRESH_THRESH_MS here because since we are
            // growing past-wards, we don't really care about refreshing things
            // in our future.  This is not the case for FUTUREWARDS.
            highestLegalEndTS = NOW() - $sync.OPEN_REFRESH_THRESH_MS;
            endTS = slice.startTS + $date.DAY_MILLIS;

            // (Note that unlike the else case, we don't need to worry about
            // IMAP_SEARCH_AMBIGUITY since by definition the message can't
            // belong to a time range we haven't searched over.  Well, ignoring
            // daylight-savings-time snafus, but that would be a super edge
            // case we're willing to glitch on.)
            if (this.headerIsOldestKnown(oldestHeader.date, oldestHeader.id)) {
              startTS = this.getOldestFullSyncDate();
            // Because of deletion ambiguity and our desire to make sure we are
            // up-to-date for all of the headers we are telling the user about,
            // we need to subtract off an extra ambiguity interval.  (Otherwise
            // we might only declare a message deleted after a user had already
            // scrolled beyond it!  Oops!)
            } else {
              startTS = oldestHeader.date - $sync.IMAP_SEARCH_AMBIGUITY_MS;
            }
          }
          else { // dir === FUTUREWARDS
            // Unlike PASTWARDS, we do want to be more aggressively up-to-date
            // about the future, so only subtract off the grow range coverage.
            // (If we didn't subtract anything off, quick scrolling back and
            // forth could cause us to refresh more frequently than
            // GROW_REFRESH_THRESH_MS, which is not what we want.)
            highestLegalEndTS = NOW() - $sync.GROW_REFRESH_THRESH_MS;

            var youngestHeader = batchHeaders[0];
            // see the PASTWARDS case for why we don't add a day to this
            startTS = slice.endTS;
            endTS = youngestHeader.date + $date.DAY_MILLIS;
          }
          // We do not want this clamped/saturated case quantized, but we do
          // want all the (other) future-dated endTS cases quantized.
          if (STRICTLY_AFTER(endTS, highestLegalEndTS)) {
            endTS = highestLegalEndTS;
            openEndTS = true;
          }
          else {
            endTS = quantizeDate(endTS);
          }

          // Now, it's not super-likely, but it is possible that because of
          // clock skew or what not that our startTS could end up after our
          // endTS, which we do not want.  Now, we could just clamp this,
          // but since we know the result would be a zero-coverage range,
          // we can just set the refreshInterval to null and be done.
          if (SINCE(startTS, endTS))
            refreshInterval = null;
          else
            refreshInterval = this.checkAccuracyCoverageNeedingRefresh(
              quantizeDate(startTS),
              endTS, // quantized above except when it would go into the future.
              $sync.GROW_REFRESH_THRESH_MS);
        }

        // We could also send the headers in as they come across the wire,
        // but we expect to be dealing in bite-sized requests, so that could
        // be overkill.
        slice.batchAppendHeaders(
          batchHeaders, dir === PASTWARDS ? -1 : 0,
          // !!refreshInterval is more efficient, but this way we can reuse
          // doneCallback() below in the else case simply.
          true);
        // If the database had fewer headers than are requested, it's possible
        // the refresh may give us extras, so allow those to be reported.
        slice.desiredHeaders = Math.max(slice.headers.length, desiredCount);

        if (refreshInterval &&
            // If the values are the same, by definition we have nothing to do,
            // but more importantly, the rounding might not improve the
            // situation, which could result in pathological sync failure on
            // gmail where it returns all the messages it knows about.
            refreshInterval.startTS !== refreshInterval.endTS) {

          // If growth was not requested, make sure we convey server traffic is
          // happening.
          if (!userRequestsGrowth)
            slice.setStatus('synchronizing', false, true, false,
                            SYNC_START_MINIMUM_PROGRESS);

          this.folderSyncer.refreshSync(
            slice, dir,
            quantizeDate(refreshInterval.startTS),
            // If we didn't shrink the endTS and we flagged to be open-ended, then
            // use null.  But if we did shrink the range, then there's no need to
            // go open-ended.
            (openEndTS && refreshInterval.endTS === highestLegalEndTS) ? null
              : quantizeDateUp(refreshInterval.endTS),
            /* origStartTS */ null,
            doneCallback, progressCallback);
        }
        else {
          doneCallback();
        }

        return;
      }

      // -- grow!
      // - do not grow if offline / no support / no user request
      if (!this._account.universe.online ||
          !this.folderSyncer.canGrowSync ||
          !userRequestsGrowth) {
        if (this.folderSyncer.syncable)
          slice.sendEmptyCompletion();
        releaseMutex(null);
        return;
      }

      if (!userRequestsGrowth)
        slice.setStatus('synchronizing', false, true, false,
                        SYNC_START_MINIMUM_PROGRESS);
      this._curSyncSlice = slice;
      // headerCount is updated as changes occur, but as a base case we need to
      // update it here.  (Note: the slice also initialized itself with this
      // value when created, but since this is by definition an async
      // callback...)
      slice.headerCount = this.headerCount;
      slice.waitingOnData = 'grow';
      // We only add the desired count now that we are sure we are growing; if
      // we did it earlier we might boost the desiredHeaders count and then
      // not sync, resulting in the next time we do grow fetching more than we
      // want.
      slice.desiredHeaders += desiredCount;

      // TODO: when we support partial day sync, these growth steps will need
      // to be adjusted by 1-day if day covering the edge message has not been
      // fully synchronized.
      this.folderSyncer.growSync(
        slice, dir,
        dir === PASTWARDS ? quantizeDate(slice.startTS)
                          : quantizeDate(slice.endTS + $date.DAY_MILLIS),
        $sync.INITIAL_SYNC_GROWTH_DAYS,
        doneCallback, progressCallback);
    }.bind(this);

    // The front end may not be calling shrink any more, to reduce
    // complexity for virtual scrolling. So be sure to clear caches
    // that are not needed, to avoid a large memory growth from
    // keeping the header bodies as the user does next/previous
    // navigation.
    if (this._mutexQueue.length === 0) {
      this.flushExcessCachedBlocks('grow');
    }

    // --- request messages
    if (dirMagnitude < 0) {
      dir = FUTUREWARDS;
      desiredCount = -dirMagnitude;

      this.getMessagesAfterMessage(
        slice.endTS, slice.endUID, desiredCount, gotMessages);
    }
    else {
      dir = PASTWARDS;
      desiredCount = dirMagnitude;

      this.getMessagesBeforeMessage(
        slice.startTS, slice.startUID, desiredCount, gotMessages);
    }
  },

  /**
   * A notification from a slice that it is has reduced the span of time that it
   * covers.  We use this to run a cache eviction if there is not currently a
   * mutex held.
   */
  sliceShrunk: function fs_sliceShrunk(slice) {
    if (this._mutexQueue.length === 0)
      this.flushExcessCachedBlocks('shrunk');
  },

  /**
   * Refresh our understanding of the time range covered by the messages
   * contained in the slice, plus expansion to the bounds of our known sync
   * date boundaries if the messages are the first/last known message.
   *
   * In other words, if the most recently known message is from a week ago and
   * that is the most recent message the slice is displaying, then we will
   * expand our sync range to go all the way through today.  Likewise, if the
   * oldest known message is from two weeks ago and is in the slice, but we
   * scanned for messages all the way back to 1990 then we will query all the
   * way back to 1990.  And if we have no messages in the slice, then we use the
   * full date bounds.
   */
  refreshSlice: function fs_refreshSlice(slice) {
    // Set the status immediately so that the UI will convey that the request is
    // being processed, even though it might take a little bit to acquire the
    // mutex.
    slice.setStatus('synchronizing', false, true, false, 0.0);

    var refreshFn = this._refreshSlice.bind(this, slice, false);

    // Local-only folders don't have a real sync process, so we don't
    // need to hold the mutex when syncing; all mutating operations
    // run in job-ops.
    if (this.isLocalOnly) {
      refreshFn(function fakeReleaseMutex() { /* nothing to do */ });
    } else {
      this.runMutexed('refresh', refreshFn);
    }

  },
  _refreshSlice: function fs__refreshSlice(slice, checkOpenRecency,
                                           releaseMutex) {

    var doneCallback = function refreshDoneCallback(err, bisectInfo,
                                                    numMessages) {
      slice._onAddingHeader = null;

      var reportSyncStatusAs = 'synced';
      switch (err) {
      case 'aborted':
      case 'unknown':
        reportSyncStatusAs = 'syncfailed';
        break;
      }

      releaseMutex(err);
      slice.waitingOnData = false;
      slice.setStatus(reportSyncStatusAs, true, false, false, null,
                      newEmailCount);
      return undefined;
    }.bind(this);

    // If the slice is dead, its startTS and endTS will be set to
    // null, so there is no range available to refresh. (See Bug 941991.)
    if (slice.isDead) {
      console.log('MailSlice: Attempted to refresh a dead slice.');
      doneCallback('unknown');
      return;
    }

    slice.waitingOnData = 'refresh';

    var startTS = slice.startTS, endTS = slice.endTS,
        // In the event we grow the startTS to the dawn of time, then we want
        // to also provide the original startTS so that the bisection does not
        // need to scan through years of empty space.
        origStartTS = null,
        // If we are refreshing through 'now', we will count the new messages we
        // hear about and update this.newEmailCount once the sync completes.  If
        // we are performing any othe sync, the value will not be updated.
        newEmailCount = null;

    // - Grow endTS
    // If the endTS lines up with the most recent known message for the folder,
    // then remove the timestamp constraint so it goes all the way to now.
    // OR if we just have no known messages
    if (this.headerIsYoungestKnown(endTS, slice.endUID)) {
      var prevTS = endTS;
      newEmailCount = 0;

      /**
       * Increment our new email count if the following conditions are met:
       * 1. This header is younger than the youngest one before sync
       * 2. and this hasn't already been seen.
       * @param {HeaderInfo} header The header being added.
       */
      slice._onAddingHeader = function(header, currentSlice) {
        if (SINCE(header.date, prevTS) &&
            (!header.flags || header.flags.indexOf('\\Seen') === -1)) {
          newEmailCount += 1;
          if (slice.onNewHeader)
            slice.onNewHeader(header);
        }
      }.bind(this);

      endTS = null;
    }
    else {
      // We want the range to include the day; since it's an exclusive range
      // quantized to midnight, we need to adjust forward a day and then
      // quantize.  We also need to compensate for the timezone; we want this
      // time in terms of server time, so we add the timezone offset.
      endTS = quantizeDate(endTS + DAY_MILLIS);
    }

    // - Grow startTS
    // Grow the start-stamp to include the oldest continuous accuracy range
    // coverage date.  Keep original date around for bisect per above.
    if (this.headerIsOldestKnown(startTS, slice.startUID)) {
      origStartTS = quantizeDate(startTS);
      startTS = this.getOldestFullSyncDate();
    // Because of deletion ambiguity and our desire to make sure we are
    // up-to-date for all of the headers we are telling the user about,
    // we need to subtract off an extra ambiguity interval.  (Otherwise
    // we might only declare a message deleted after a user had already
    // scrolled beyond it!  Oops!)
    } else {
      startTS -= $sync.IMAP_SEARCH_AMBIGUITY_MS;
    }

    // quantize the start date
    if (startTS)
      startTS = quantizeDate(startTS);

    // In the initial open case, we support a constant that allows us to
    // fast-path out without bothering the server.
    if (checkOpenRecency) {
      // We use now less the refresh threshold as the accuracy range end-post;
      // since markSyncRange uses NOW() when 'null' is provided (which it will
      // be for a sync through now), this all works out consistently.
      if (this.checkAccuracyCoverageNeedingRefresh(
             startTS,
             endTS ||
               NOW() - $sync.OPEN_REFRESH_THRESH_MS,
             $sync.OPEN_REFRESH_THRESH_MS) === null) {
        doneCallback();
        return;
      }
    }

    // The choice of PASTWARDS/FUTUREWARDS impacts the direction our chunks
    // happen if we have to bisect (if that happens) and (eventually) the
    // direction new bodies are fetched.
    //
    // There are arguments for both choices:
    //
    // Initial slice open refresh:
    // - PASTWARDS: Show the user the newest messages, but at the cost of a
    //   gap between the known messages and these new messages we are
    //   synchronizing in.  The gap is potentially confusing and ordering could
    //   also be confusing to the user.
    // - FUTUREWARDS: Avoid that gap, having the scrolling make sense.
    //   There is a pathological case here where we are ridiculously out-of-date
    //   and it would take the user a loooong time to sync all the way back up
    //   to now and it would be better to just restart with an initial deepening
    //   sync and/or throw things away.  Arguably, these are cases that should
    //   be explicitly handled outside of us.
    //
    // Manual refresh:
    // - PASTWARDS: Newest first.
    // - FUTUREWARDS: Have the messages show up in the order they were received.
    //
    // We currently choose FUTUREWARDS to avoid the gap and have messages show
    // up chronologically.
    this.folderSyncer.refreshSync(
      slice, FUTUREWARDS, startTS, endTS, origStartTS,
      doneCallback, slice.setSyncProgress.bind(slice));
  },

  _resetAndResyncSlice: function(slice, forceRefresh, releaseMutex) {
    this._slices.splice(this._slices.indexOf(slice), 1);
    if (releaseMutex)
      this._sliceOpenMostRecent(slice, forceRefresh, releaseMutex);
    else
      this.sliceOpenMostRecent(slice, forceRefresh);
  },

  dyingSlice: function ifs_dyingSlice(slice) {
    var idx = this._slices.indexOf(slice);
    this._slices.splice(idx, 1);

    // If this was a folder-backed slice, we potentially can now free up a lot
    // of cached memory, so do that.
    if (slice.type === 'folder') {
      this.flushExcessCachedBlocks('deadslice');
    }

    if (this._slices.length === 0 && this._mutexQueue.length === 0) {
      this.folderSyncer.allConsumersDead();
    }
  },

  /**
   * Receive messages directly from the database (streaming).
   */
  onFetchDBHeaders: function(slice, triggerRefresh, doneCallback, releaseMutex,
                             headers, moreMessagesComing) {
    var triggerNow = false;
    if (!moreMessagesComing && triggerRefresh) {
      moreMessagesComing = true;
      triggerNow = true;
    }

    // (always call this even if there are no headers so metadata like
    // headerCount can be propagated.)
    // Claim there are more headers coming since we will trigger setStatus
    // right below and we want that to be the only edge transition.
    slice.batchAppendHeaders(headers, -1, true);

    if (!moreMessagesComing) {
      slice.desiredHeaders = slice.headers.length;
      doneCallback();
    }
    else if (triggerNow) {
      slice.desiredHeaders = slice.headers.length;
      // refreshSlice expects this to be null for two reasons:
      // 1) Invariant about only having one sync-like thing happening at a time.
      // 2) We want to generate header deltas rather than initial filling,
      //    and this is keyed off of whether the slice is the current sync
      //    slice.
      this._curSyncSlice = null;
      // We want to have the refresh check its refresh recency range unless we
      // have been explicitly told to force a refresh.
      var checkOpenRecency = triggerRefresh !== 'force';
      this._refreshSlice(slice, checkOpenRecency, releaseMutex);
    }
  },

  sliceQuicksearch: function ifs_sliceQuicksearch(slice, searchParams) {
  },

  getYoungestMessageTimestamp: function() {
    if (!this._headerBlockInfos.length)
      return 0;
    return this._headerBlockInfos[0].endTS;
  },

  /**
   * Return true if the identified header is the most recent known message for
   * this folder as part of our fully-synchronized time-span.  Messages known
   * because of sparse searches do not count.  If null/null is passed and there
   * are no known headers, we will return true.
   */
  headerIsYoungestKnown: function(date, uid) {
    // NB: unlike oldest known, this should not actually be impacted by messages
    // found by search.
    if (!this._headerBlockInfos.length)
      return (date === null && uid === null);
    var blockInfo = this._headerBlockInfos[0];

    return (date === blockInfo.endTS &&
            uid === blockInfo.endUID);
  },

  getOldestMessageTimestamp: function() {
    if (!this._headerBlockInfos.length)
      return 0;
    return this._headerBlockInfos[this._headerBlockInfos.length - 1].startTS;
  },

  /**
   * Return true if the identified header is the oldest known message for this
   * folder as part of our fully-synchronized time-span.  Messages known because
   * of sparse searches do not count.  If null/null is passed and there are no
   * known headers, we will return true.
   */
  headerIsOldestKnown: function(date, uid) {
    // TODO: when we implement search, this logic will need to be more clever
    // to check our full-sync range since we may indeed have cached messages
    // from way in the past.
    if (!this._headerBlockInfos.length)
      return (date === null && uid === null);

    var blockInfo = this._headerBlockInfos[this._headerBlockInfos.length - 1];
    return (date === blockInfo.startTS &&
            uid === blockInfo.startUID);
  },

  /**
   * What is the most recent date we have fully synchronized through?
   */
  getNewestFullSyncDate: function() {
    // If we have any accuracy range, it should be what we want.
    if (this._accuracyRanges.length)
      return this._accuracyRanges[0].endTS;
    // If we have no accuracy ranges, then 0 at least safely indicates we are
    // not up-to-date.
    return 0;
  },

  /**
   * What is the oldest date we have fully synchronized through per our
   * accuracy information?
   */
  getOldestFullSyncDate: function() {
    // Start at the oldest index and run towards the newest until we find a
    // fully synced range or run out of ranges.
    //
    // We used to start at the newest and move towards the oldest since this
    // checked our fully-synced-from-now invariant, but that invariant has now
    // gone by the wayside and is not required for correctness for the purposes
    // of us/our callers.
    var idxAR = this._accuracyRanges.length - 1;
    // Run futurewards in time until we find one without a fullSync or run out
    while (idxAR >= 0 &&
           !this._accuracyRanges[idxAR].fullSync) {
      idxAR--;
    }
    // Sanity-check, use.
    var syncTS;
    if (idxAR >= 0)
      syncTS = this._accuracyRanges[idxAR].startTS;
    else
      syncTS = NOW();
    return syncTS;
  },

  /**
   * Are we synchronized close enough to 'now' so that a refresh of the time
   * interval will include new message received today?  This relies on our
   * IMAP sync generally operating on day granularities.
   */
  syncedToToday: function() {
    if (!this.folderSyncer.canGrowSync)
      return true;

    var newestSyncTS = this.getNewestFullSyncDate();
    return SINCE(newestSyncTS, quantizeDate(NOW()));
  },

  /**
   * Are we synchronized as far back in time as we are able to synchronize?
   *
   * If true, this means that a refresh of the oldest known message should
   * result in the refresh also covering through `$sync.OLDEST_SYNC_DATE.`
   * Once this becomes true for a folder, it will remain true unless we
   * perform a refresh through the dawn of time that needs to be bisected.  In
   * that case we will drop the through-the-end-of-time coverage via
   * `clearSyncedToDawnOfTime`.
   */
  syncedToDawnOfTime: function() {
    if (!this.folderSyncer.canGrowSync)
      return true;

    var oldestSyncTS = this.getOldestFullSyncDate();
    // We add a day to the oldest sync date to allow for some timezone-related
    // slop.  This is done defensively.  Unit tests ensure that our refresh of
    // synced-to-the-dawn-of-time does not result in date drift that would cause
    // the date to slowly move in and escape the slop.
    return ON_OR_BEFORE(oldestSyncTS, $sync.OLDEST_SYNC_DATE + $date.DAY_MILLIS);
  },

  /**
   * Tally and return the number of messages we believe to exist in the folder.
   */
  getKnownMessageCount: function() {
    var count = 0;
    for (var i = 0; i < this._headerBlockInfos.length; i++) {
      var blockInfo = this._headerBlockInfos[i];
      count += blockInfo.count;
    }
    return count;
  },

  /**
   * Retrieve the (ordered list) of messages covering a given IMAP-style date
   * range that we know about.  Use `getMessagesBeforeMessage` or
   * `getMessagesAfterMessage` to perform iteration relative to a known
   * message.
   *
   * @args[
   *   @param[startTS DateMS]{
   *     SINCE-evaluated start timestamp (inclusive).
   *   }
   *   @param[endTS DateMS]{
   *     BEFORE-evaluated end timestamp (exclusive).  If endTS is null, get all
   *     messages since startTS.
   *   }
   *   @param[minDesired #:optional Number]{
   *     The minimum number of messages to return.  We will keep loading blocks
   *     from disk until this limit is reached.
   *   }
   *   @param[maxDesired #:optional Number]{
   *     The maximum number of messages to return.  If there are extra messages
   *     available in a header block after satisfying `minDesired`, we will
   *     return them up to this limit.
   *   }
   *   @param[messageCallback @func[
   *     @args[
   *       @param[headers @listof[HeaderInfo]]
   *       @param[moreMessagesComing Boolean]]
   *     ]
   *   ]
   * ]
   */
  getMessagesInImapDateRange: function ifs_getMessagesInDateRange(
      startTS, endTS, minDesired, maxDesired, messageCallback) {
    var toFill = (minDesired != null) ? minDesired : $sync.TOO_MANY_MESSAGES,
        maxFill = (maxDesired != null) ? maxDesired : $sync.TOO_MANY_MESSAGES,
        self = this,
        // header block info iteration
        iHeadBlockInfo = null, headBlockInfo;

    // find the first header block with the data we want
    var headerPair = this._findFirstObjIndexForDateRange(
                       this._headerBlockInfos, startTS, endTS);
    iHeadBlockInfo = headerPair[0];
    headBlockInfo = headerPair[1];
    if (!headBlockInfo) {
      // no blocks equals no messages.
      messageCallback([], false);
      return;
    }

    function fetchMore() {
      while (true) {
        // - load the header block if required
        if (!self._headerBlocks.hasOwnProperty(headBlockInfo.blockId)) {
          self._loadBlock('header', headBlockInfo, fetchMore);
          return;
        }
        var headerBlock = self._headerBlocks[headBlockInfo.blockId];
        // - use up as many headers in the block as possible
        // (previously used destructuring, but we want uglifyjs to work)
        var headerTuple = self._findFirstObjForDateRange(
                            headerBlock.headers,
                            startTS, endTS),
            iFirstHeader = headerTuple[0], header = headerTuple[1];
        // aw man, no usable messages?!
        if (!header) {
          messageCallback([], false);
          return;
        }
        // (at least one usable message)

        var iHeader = iFirstHeader;
        for (; iHeader < headerBlock.headers.length && maxFill;
             iHeader++, maxFill--) {
          header = headerBlock.headers[iHeader];
          // (we are done if we have found a header earlier than what we want)
          if (BEFORE(header.date, startTS))
            break;
        }
        // (iHeader is pointing at the index of message we don't want)
        // There is no further processing to do if we bailed early.
        if (maxFill && iHeader < headerBlock.headers.length)
          toFill = 0;
        else
          toFill -= iHeader - iFirstHeader;

        if (!toFill) {
        }
        // - There may be viable messages in the next block, check.
        else if (++iHeadBlockInfo >= self._headerBlockInfos.length) {
          // Nope, there are no more messages, nothing left to do.
          toFill = 0;
        }
        else {
          headBlockInfo = self._headerBlockInfos[iHeadBlockInfo];
          // We may not want to go back any farther
          if (STRICTLY_AFTER(startTS, headBlockInfo.endTS))
            toFill = 0;
        }
        // generate the notifications fo what we did create
        messageCallback(headerBlock.headers.slice(iFirstHeader, iHeader),
                        Boolean(toFill));
        if (!toFill)
          return;
        // (there must be some overlap, keep going)
      }
    }

    fetchMore();
  },

  /**
   * Batch/non-streaming version of `getMessagesInDateRange` using an IMAP
   * style date-range for syncing.
   *
   * @args[
   *   @param[allCallback @func[
   *     @args[
   *       @param[headers @listof[HeaderInfo]]
   *     ]
   *   ]
   * ]
   */
  getAllMessagesInImapDateRange: function ifs_getAllMessagesInDateRange(
      startTS, endTS, allCallback) {
    var allHeaders = null;
    function someMessages(headers, moreHeadersExpected) {
      if (allHeaders)
        allHeaders = allHeaders.concat(headers);
      else
        allHeaders = headers;
      if (!moreHeadersExpected)
        allCallback(allHeaders);
    }
    this.getMessagesInImapDateRange(startTS, endTS, null, null, someMessages);
  },

  /**
   * Fetch up to `limit` messages chronologically before the given message
   * (in the direction of 'start').
   *
   * If date/id do not point to a valid message, return messages as
   * though it did point to a valid message (i.e. return messages past
   * that point, as you would probably expect).
   *
   * If date/id are null, it as if the date/id of the most recent message
   * are passed.
   */
  getMessagesBeforeMessage: function(date, id, limit, messageCallback) {
    var toFill = (limit != null) ? limit : $sync.TOO_MANY_MESSAGES, self = this;

    var headerPair, iHeadBlockInfo, headBlockInfo;
    if (date) {
      headerPair = this._findRangeObjIndexForDateAndID(
                     this._headerBlockInfos, date, id);
      iHeadBlockInfo = headerPair[0];
      headBlockInfo = headerPair[1];
    }
    else {
      iHeadBlockInfo = 0;
      headBlockInfo = this._headerBlockInfos[0];
    }

    if (!headBlockInfo) {
      // headBlockInfo will be null if this date/id pair does not fit
      // properly into a block, but iHeadBlockInfo will still point to
      // a location from which we can start looking, and that leads us
      // to one of two cases: Either iHeadBlockInfo points to a valid
      // block (the one immediately after this point), in which case
      // we can just pretend that our targeted date/id resides
      // immediately futureward of the current block; or we've reached
      // the complete end of all blocks and iHeadBlockInfo points past
      // the end of headerBlockInfos, indicating that there are no
      // more messages pastward of our requested point.
      if (iHeadBlockInfo < this._headerBlockInfos.length) {
        // Search in this block.
        headBlockInfo = this._headerBlockInfos[iHeadBlockInfo];
      } else {
        // If this message is older than all the existing blocks,
        // there aren't any messages to return, period, since we're
        // seeking pastward.
        messageCallback([], false);
        return;
      }
    }

    var iHeader = null;
    function fetchMore() {
      while (true) {
        // - load the header block if required
        if (!self._headerBlocks.hasOwnProperty(headBlockInfo.blockId)) {
          self._loadBlock('header', headBlockInfo, fetchMore);
          return;
        }
        var headerBlock = self._headerBlocks[headBlockInfo.blockId];

        // Null means find it by id...
        if (iHeader === null) {
          if (id != null) {
            iHeader = bsearchForInsert(headerBlock.headers, {
              date: date,
              id: id
            }, cmpHeaderYoungToOld);

            if (headerBlock.ids[iHeader] === id) {
              // If we landed exactly on the message we were searching
              // for, we must skip _past_ it, as this method is not
              // intended to return this message, but only ones past it.
              iHeader++;
            } else {
              // If we didn't land on the exact header we sought, we
              // can just start returning results from iHeader onward.
              // since iHeader points to a message immediately beyond
              // the message we sought.
            }
          } else {
            // If we didn't specify an id to search for, we're
            // supposed to pretend that the first message in the block
            // was the one we wanted; in that case, start from index 1.
            iHeader = 1;
          }
        }
        // otherwise we know we are starting at the front of the block.
        else {
          iHeader = 0;
        }

        var useHeaders = Math.min(
              headerBlock.headers.length - iHeader,
              toFill);
        if (iHeader >= headerBlock.headers.length)
          useHeaders = 0;
        toFill -= useHeaders;

        // If there's nothing more to...
        if (!toFill) {
        }
        // - There may be viable messages in the next block, check.
        else if (++iHeadBlockInfo >= self._headerBlockInfos.length) {
          // Nope, there are no more messages, nothing left to do.
          toFill = 0;
        }
        else {
          headBlockInfo = self._headerBlockInfos[iHeadBlockInfo];
        }
        // generate the notifications for what we did create
        messageCallback(headerBlock.headers.slice(iHeader,
                                                  iHeader + useHeaders),
                        Boolean(toFill));
        if (!toFill)
          return;
        // (there must be some overlap, keep going)
      }
    }

    fetchMore();
  },

  /**
   * Fetch up to `limit` messages chronologically after the given message (in
   * the direction of 'end').
   *
   * NOTE: Unlike getMessagesBeforeMessage, this method currently
   * expects date/id to point to a valid message, otherwise we'll
   * raise a badIterationStart error.
   */
  getMessagesAfterMessage: function(date, id, limit, messageCallback) {
    var toFill = (limit != null) ? limit : $sync.TOO_MANY_MESSAGES, self = this;

    var headerPair = this._findRangeObjIndexForDateAndID(
                       this._headerBlockInfos, date, id);
    var iHeadBlockInfo = headerPair[0];
    var headBlockInfo = headerPair[1];

    var scope = logic.subscope(this, { date: date, id: id });

    if (!headBlockInfo) {
      // The iteration request is somehow not current; log an error and return
      // an empty result set.
      logic(scope, 'badIterationStart');
      messageCallback([], false);
      return;
    }

    var iHeader = null;
    function fetchMore() {
      while (true) {
        // - load the header block if required
        if (!self._headerBlocks.hasOwnProperty(headBlockInfo.blockId)) {
          self._loadBlock('header', headBlockInfo, fetchMore);
          return;
        }
        var headerBlock = self._headerBlocks[headBlockInfo.blockId];

        // Null means find it by id...
        if (iHeader === null) {
          iHeader = headerBlock.ids.indexOf(id);
          if (iHeader === -1) {
            logic(scope, 'badIterationStart');
            toFill = 0;
          }
          iHeader--;
        }
        // otherwise we know we are starting at the end of the block (and
        // moving towards the front)
        else {
          iHeader = headerBlock.headers.length - 1;
        }

        var useHeaders = Math.min(iHeader + 1, toFill);
        if (iHeader < 0)
          useHeaders = 0;
        toFill -= useHeaders;

        // If there's nothing more to...
        if (!toFill) {
        }
        // - There may be viable messages in the previous block, check.
        else if (--iHeadBlockInfo < 0) {
          // Nope, there are no more messages, nothing left to do.
          toFill = 0;
        }
        else {
          headBlockInfo = self._headerBlockInfos[iHeadBlockInfo];
        }
        // generate the notifications for what we did create
        var messages = headerBlock.headers.slice(iHeader - useHeaders + 1,
                                                 iHeader + 1);
        messageCallback(messages, Boolean(toFill));
        if (!toFill)
          return;
        // (there must be some overlap, keep going)
      }
    }

    fetchMore();
  },


  /**
   * Mark a given time range as synchronized.  Timestamps are currently UTC
   * day-quantized values that indicate the day range that we have fully
   * synchronized with the server.  The actual time-range of the synchronized
   * messages will be offset by the effective timezone of the server.
   *
   * To re-state in another way: if you take these timestamps and represent them
   * in UTC-0, that's the date we talk to the IMAP server with in terms of SINCE
   * and BEFORE.
   *
   * Note: I did consider doing timezones the right way where we would compute
   * things in the time-zone of the server.  The problem with that is that our
   * timezone for the server is just a guess and the server's timezone can
   * actually change.  And if the timezone changes, then all the dates would end
   * up shifted by a day when quantized, which is distinctly not what we want to
   * happen.
   *
   * @args[
   *   @param[startTS DateMS]
   *   @param[endTS DateMS]
   *   @param[modseq]
   *   @param[updated DateMS]
   * ]
   */
  markSyncRange: function(startTS, endTS, modseq, updated) {
    // If our range was marked open-ended, it's really accurate through now.
    // But we don't want true UTC now, we want the now of the server in terms of
    // IMAP's crazy SINCE/BEFORE quantized date-range.  If it's already tomorrow
    // as far as the server is concerned date-wise, then we need to reflect that
    // here.
    //
    // To really spell it out, let's say that it's currently daylight savings
    // time, we live on the east coast (utc-4), and our server is in Europe
    // (utc+2).
    //
    // Let's say it's 7pm, which is 11pm at utc-0 and 1am at utc+2.  NOW() is
    // going to net us the 11pm value; we need to add the timezone offset of
    // +2 to get to 1am, which is then what we want to use for markSyncRange.
    //
    if (!endTS)
      endTS = NOW();
    if (startTS > endTS)
      throw new Error('Your timestamps are switched!');

    var aranges = this._accuracyRanges;
    function makeRange(start, end, modseq, updated) {
      return {
        startTS: start, endTS: end,
        // let an existing fullSync be passed in instead...
        fullSync: (typeof(modseq) === 'string') ?
          { highestModseq: modseq, updated: updated } :
          { highestModseq: modseq.fullSync.highestModseq,
            updated: modseq.fullSync.updated },
      };
    }

    var newInfo = this._findFirstObjIndexForDateRange(aranges, startTS, endTS),
        oldInfo = this._findLastObjIndexForDateRange(aranges, startTS, endTS),
        newSplits, oldSplits;
    // We need to split the new block if we overlap a block and our end range
    // is not 'outside' the range.
    newSplits = newInfo[1] && STRICTLY_AFTER(newInfo[1].endTS, endTS);
    // We need to split the old block if we overlap a block and our start range
    // is not 'outside' the range.
    oldSplits = oldInfo[1] && BEFORE(oldInfo[1].startTS, startTS);

    var insertions = [],
        delCount = oldInfo[0] - newInfo[0];
    if (oldInfo[1])
      delCount++;

    if (newSplits) {
      // should this just be an effective merge with our insertion?
      if (newInfo[1].fullSync &&
          newInfo[1].fullSync.highestModseq === modseq &&
          newInfo[1].fullSync.updated === updated)
        endTS = newInfo[1].endTS;
      else
        insertions.push(makeRange(endTS, newInfo[1].endTS, newInfo[1]));
    }
    insertions.push(makeRange(startTS, endTS, modseq, updated));
    if (oldSplits) {
      // should this just be an effective merge with what we just inserted?
      if (oldInfo[1].fullSync &&
          oldInfo[1].fullSync.highestModseq === modseq &&
          oldInfo[1].fullSync.updated === updated)
        insertions[insertions.length-1].startTS = oldInfo[1].startTS;
      else
        insertions.push(makeRange(oldInfo[1].startTS, startTS, oldInfo[1]));
    }

    // - merges
    // Consider a merge if there is an adjacent accuracy range in the given dir.
    var newNeighbor = newInfo[0] > 0 ? aranges[newInfo[0] - 1] : null,
        oldAdjust = oldInfo[1] ? 1 : 0,
        oldNeighbor = oldInfo[0] < (aranges.length - oldAdjust) ?
                        aranges[oldInfo[0] + oldAdjust] : null;
    // We merge if our starts and ends line up...
    if (newNeighbor &&
       insertions[0].endTS === newNeighbor.startTS &&
        newNeighbor.fullSync &&
        newNeighbor.fullSync.highestModseq === modseq &&
        newNeighbor.fullSync.updated === updated) {
      insertions[0].endTS = newNeighbor.endTS;
      newInfo[0]--;
      delCount++;
    }
    if (oldNeighbor &&
        insertions[insertions.length-1].startTS === oldNeighbor.endTS &&
        oldNeighbor.fullSync &&
        oldNeighbor.fullSync.highestModseq === modseq &&
        oldNeighbor.fullSync.updated === updated) {
      insertions[insertions.length-1].startTS = oldNeighbor.startTS;
      delCount++;
    }

    aranges.splice.apply(aranges, [newInfo[0], delCount].concat(insertions));

    /*lastSyncedAt depends on current timestamp of the client device
     should not be added timezone offset*/
    this.folderMeta.lastSyncedAt = NOW();
    this._dirty = true;
  },

  /**
   * Mark that the most recent sync is believed to have synced all the messages
   * in the folder.  For ActiveSync, this always happens and is effectively
   * meaningless; it's only an artifact of previous hacks that it calls this at
   * all.  For IMAP, this is an inference that depends on us being up-to-date
   * with the rest of the folder.  However it is also a self-correcting
   * inference since it causes our refreshes to include that time range since we
   * believe it to be safely empty.
   */
  markSyncedToDawnOfTime: function() {
    logic(this, 'syncedToDawnOfTime');

    // We can just expand the first accuracy range structure to stretch to the
    // dawn of time and nuke the rest.
    var aranges = this._accuracyRanges;
    // (If aranges is the empty list, there are deep invariant problems and
    // the exception is desired.)
    aranges[aranges.length - 1].startTS = $sync.OLDEST_SYNC_DATE;

    /*lastSyncedAt depends on current timestamp of the client device
     should not be added timezone offset*/
    this.folderMeta.lastSyncedAt = NOW();
    this._dirty = true;
  },

  /**
   * Clear our indication that we have synced the entire folder through the dawn
   * of time, truncating the time coverage of the oldest accuracy range or
   * dropping it entirely.  It is assumed/required that a call to markSyncRange
   * will follow this call within the same transaction, so the key thing is that
   * we lose the dawn-of-time bit without throwing away useful endTS values.
   */
  clearSyncedToDawnOfTime: function(newOldestTS) {
    var aranges = this._accuracyRanges;
    if (!aranges.length)
      return;
    var lastRange = aranges[aranges.length - 1];
    // Only update the startTS if it leaves a valid accuracy range
    if (STRICTLY_AFTER(lastRange.endTS, newOldestTS)) {
      lastRange.startTS = newOldestTS;
    }
    // Otherwise, pop the range to get rid of the info.  This is a defensive
    // programming thing; we do not expect this case to happen, so we log.
    else {
      logic(this, 'accuracyRangeSuspect', { lastRange: lastRange });
      aranges.pop();
    }
  },

  /**
   * Given a time range, check if we have fully-synchronized data covering
   * that range or part of that range.  Return the smallest possible single
   * range covering all areas that are unsynchronized or were not synchronized
   * recently enough.
   *
   * We only return one range, so in the case we have valid data for Tuesday to
   * Thursday but the requested range is Monday to Friday, we still have to
   * return Monday to Friday because 1 range can't capture Monday to Monday and
   * Friday to Friday at the same time.
   *
   * @args[
   *   @param[startTS DateMS]{
   *     Inclusive range start.
   *   }
   *   @param[endTS DateMS]{
   *     Exclusive range start; consistent with accuracy range rep.
   *   }
   *   @param[threshMS Number]{
   *     The number of milliseconds to use as the threshold value for
   *     determining if a time-range is recent enough.
   *   }
   * ]
   * @return[@oneof[
   *   @case[null]{
   *     Everything is sufficiently up-to-date.  No refresh required.
   *   }
   *   @case[@dict[
   *     @key[startTS DateMS]{
   *       Inclusive start date.
   *     }
   *     @key[endTS DateMS]{
   *       Exclusive end date.
   *     }
   *   ]]
   * ]]
   */
  checkAccuracyCoverageNeedingRefresh: function(startTS, endTS, threshMS) {
    var aranges = this._accuracyRanges, arange,
        newInfo = this._findFirstObjIndexForDateRange(aranges, startTS, endTS),
        oldInfo = this._findLastObjIndexForDateRange(aranges, startTS, endTS),
        recencyCutoff = NOW() - threshMS;
    var result = { startTS: startTS, endTS: endTS };
    if (newInfo[1]) {
      // - iterate from the 'end', trying to push things as far as we can go.
      var i;
      for (i = newInfo[0]; i <= oldInfo[0]; i++) {
        arange = aranges[i];
        // skip out if this range would cause a gap (will not happen in base
        // case.)
        if (BEFORE(arange.endTS, result.endTS))
          break;
        // skip out if this range was not fully updated or the data is too old
        if (!arange.fullSync ||
            BEFORE(arange.fullSync.updated, recencyCutoff))
          break;
        // if the range covers all of us or further than we need, we are done.
        if (ON_OR_BEFORE(arange.startTS, result.startTS))
          return null;
        // the range only partially covers us; shrink our range and keep going
        result.endTS = arange.startTS;
      }
      // - iterate from the 'start', trying to push things as far as we can go.
      // (if we are here, we must not completely cover the range.)
      for (i = oldInfo[0]; i >= 0; i--) {
        arange = aranges[i];
        // skip out if this range would cause a gap
        if (STRICTLY_AFTER(arange.startTS, result.startTS))
          break;
        // skip out if this range was not fully updated or the data is too old
        if (!arange.fullSync ||
            BEFORE(arange.fullSync.updated, recencyCutoff))
          break;
        // the range only partially covers us; shrink our range and keep going
        result.startTS = arange.endTS;
      }
    }
    return result;
  },

  /**
   * Retrieve a full message (header/body) by suid & date. If either the body or
   * header is not present res will be null.
   *
   *    folderStorage.getMessage(suid, date, function(res) {
   *      if (!res) {
   *        // don't do anything
   *      }
   *
   *      res.header;
   *      res.body;
   *    });
   *
   */
  getMessage: function(suid, date, options, callback) {
    if (typeof(options) === 'function') {
      callback = options;
      options = undefined;
    }

    var header;
    var body;
    var pending = 2;

    function next() {
      if (!--pending) {
        if (!body || !header) {
          return callback(null);
        }

        callback({ header: header, body: body });
      }
    }

    this.getMessageHeader(suid, date, function(_header) {
      header = _header;
      next();
    });

    var gotBody = function gotBody(_body) {
      body = _body;
      next();
    };

    if (options && options.withBodyReps) {
      this.getMessageBodyWithReps(suid, date, gotBody);
    } else {
      this.getMessageBody(suid, date, gotBody);
    }
  },

  /**
   * Retrieve a message header by its SUID and date; you would do this if you
   * only had the SUID and date, like in a 'job'.
   */
  getMessageHeader: function ifs_getMessageHeader(suid, date, callback) {
    var id = parseInt(suid.substring(suid.lastIndexOf('/') + 1)),
        posInfo = this._findRangeObjIndexForDateAndID(this._headerBlockInfos,
                                                      date, id);

    if (posInfo[1] === null) {
      logic(this, 'headerNotFound');
      try {
        callback(null);
      }
      catch (ex) {
        logic(this, 'callbackErr', { ex: ex });
      }
      return;
    }
    var headerBlockInfo = posInfo[1], self = this;
    if (!(this._headerBlocks.hasOwnProperty(headerBlockInfo.blockId))) {
      this._loadBlock('header', headerBlockInfo, function(headerBlock) {
          var idx = headerBlock.ids.indexOf(id);
          var headerInfo = headerBlock.headers[idx] || null;
          if (!headerInfo)
            logic(self, 'headerNotFound');
          try {
            callback(headerInfo);
          }
          catch (ex) {
            logic(self, 'callbackErr', { ex: ex });
          }
        });
      return;
    }
    var block = this._headerBlocks[headerBlockInfo.blockId],
        idx = block.ids.indexOf(id),
        headerInfo = block.headers[idx] || null;
    if (!headerInfo)
      logic(this, 'headerNotFound');
    try {
      callback(headerInfo);
    }
    catch (ex) {
      logic(this, 'callbackErr', { ex: ex });
    }
  },

  /**
   * Retrieve multiple message headers.
   */
  getMessageHeaders: function ifs_getMessageHeaders(namers, callback) {
    var pending = namers.length;

    var headers = [];
    var gotHeader = function gotHeader(header) {
      if (header) {
        headers.push(header);
      }

      if (!--pending) {
        callback(headers);
      }
    };
    for (var i = 0; i < namers.length; i++) {
      var namer = namers[i];
      this.getMessageHeader(namer.suid, namer.date, gotHeader);
    }
  },

  /**
   * Add a new message to the database, generating slice notifications.
   *
   * @param header
   * @param [body]
   *   Optional body, exists to hint to slices so that SearchFilter can peek
   *   directly at the body without needing to make an additional request to
   *   look at the body.
   */
  addMessageHeader: function ifs_addMessageHeader(header, body, callback) {
    if (header.id == null || header.suid == null) {
      throw new Error('No valid id: ' + header.id + ' or suid: ' + header.suid);
    }

    if (this._pendingLoads.length) {
      this._deferredCalls.push(this.addMessageHeader.bind(
                                 this, header, body, callback));
      return;
    }

    if (header.flags && header.flags.indexOf('\\Seen') === -1) {
      this.folderMeta.unreadCount++;
    }

    logic(this, 'addMessageHeader',
               { date: header.date, id: header.id, srvid: header.srvid });

    this.headerCount += 1;

    if (this._curSyncSlice) {
      // TODO: make sure the slice knows the true offset of its
      // first header in the folder. Currently the UI never
      // shrinks its slice so this number is always 0 and we can
      // get away without providing that offset for now.
      this._curSyncSlice.headerCount = this.headerCount;
      if (!this._curSyncSlice.ignoreHeaders) {
        this._curSyncSlice.onHeaderAdded(header, body, true, true);
      }
    }

    // - Generate notifications for (other) interested slices
    if (this._slices.length > (this._curSyncSlice ? 1 : 0)) {
      var date = header.date, uid = header.id;
      for (var iSlice = 0; iSlice < this._slices.length; iSlice++) {
        var slice = this._slices[iSlice];
        if (slice === this._curSyncSlice) {
          continue;
        }

        if (slice.type === 'folder') {
          // TODO: make sure the slice knows the true offset of its
          // first header in the folder. Currently the UI never
          // shrinks its slice so this number is always 0 and we can
          // get away without providing that offset for now.
          slice.headerCount = this.headerCount;
        }

        // Note: the following control flow is to decide when to bail; if we
        // make it through the conditionals, the header gets reported to the
        // slice.

        // (if the slice is empty, it cares about any header, so keep going)
        if (slice.startTS !== null) {
          // We never automatically grow a slice into the past if we are full,
          // but we do allow it if not full.
          if (BEFORE(date, slice.startTS)) {
            if (slice.headers.length >= slice.desiredHeaders) {
              continue;
            }
          }
          // We do grow a slice into the present if it's already up-to-date.
          // We do count messages from the same second as our
          else if (SINCE(date, slice.endTS)) {
            // !(covers most recently known message)
            if(!(this._headerBlockInfos.length &&
                 slice.endTS === this._headerBlockInfos[0].endTS &&
                 slice.endUID === this._headerBlockInfos[0].endUID))
              continue;
          }
          else if ((date === slice.startTS &&
                    uid < slice.startUID) ||
                   (date === slice.endTS &&
                    uid > slice.endUID)) {
            continue;
          }
        }
        else {
          // Make sure to increase the number of desired headers so the
          // truncating heuristic won't rule the header out.
          slice.desiredHeaders++;
        }

        if (slice._onAddingHeader) {
          try {
            slice._onAddingHeader(header);
          }
          catch (ex) {
            logic(this, 'callbackErr', { ex: ex });
          }
        }

        try {
          slice.onHeaderAdded(header, body, false, true);
        }
        catch (ex) {
          logic(this, 'callbackErr', { ex: ex });
        }
      }
    }


    this._insertIntoBlockUsingDateAndUID(
      'header', header.date, header.id, header.srvid,
      $sync.HEADER_EST_SIZE_IN_BYTES, header, callback);
  },

  /**
   * Update an existing mesage header in the database, generating slice
   * notifications and dirtying its containing block to cause eventual database
   * writeback.
   *
   * A message header gets updated ONLY because of a change in its flags.  We
   * don't consider this change large enough to cause us to need to split a
   * block.
   *
   * This function can either be used to replace the header or to look it up
   * and then call a function to manipulate the header.
   *
   * Options:
   *   { silent: true }
   *     Don't send slice updates. Used when updating an internal
   *     IMAP-specific flag (imapMissingInSyncRange: slices don't need
   *     to know about it) so that existing tests don't get mad that
   *     we're sending out extra updateMessageHeader events without
   *     expecting them. This flag should be removed in the test
   *     refactoring to allow more fine-grained control over
   *     onHeaderModified assertions.
   */
  updateMessageHeader: function ifs_updateMessageHeader(date, id, partOfSync,
                                                        headerOrMutationFunc,
                                                        body,
                                                        callback,
                                                        opts) {
    // (While this method can complete synchronously, we want to maintain its
    // perceived ordering relative to those that cannot be.)
    if (this._pendingLoads.length) {
      this._deferredCalls.push(this.updateMessageHeader.bind(
                                 this, date, id, partOfSync,
                                 headerOrMutationFunc, body, callback));
      return;
    }

    // We need to deal with the potential for the block having been discarded
    // from memory thanks to the potential asynchrony due to pending loads or
    // on the part of the caller.
    var infoTuple = this._findRangeObjIndexForDateAndID(
                      this._headerBlockInfos, date, id),
        iInfo = infoTuple[0], info = infoTuple[1], self = this;
    function doUpdateHeader(block) {
      var idx = block.ids.indexOf(id), header;
      if (idx === -1) {
        // Call the mutation func with null to let it know we couldn't find the
        // header.
        if (headerOrMutationFunc instanceof Function)
          headerOrMutationFunc(null);
        else
          throw new Error('Failed to find ID ' + id + '!');
      }
      else if (headerOrMutationFunc instanceof Function) {
        // If it returns false it means that the header did not change and so
        // there is no need to mark anything dirty and we can leave without
        // notifying anyone.
        if (!headerOrMutationFunc((header = block.headers[idx])))
          header = null;
      }
      else {
        header = block.headers[idx] = headerOrMutationFunc;
      }
      // only dirty us and generate notifications if there is a header
      if (header) {
        self._dirty = true;
        self._dirtyHeaderBlocks[info.blockId] = block;

        logic(self, 'updateMessageHeader',
              { date: header.date, id: header.id, srvid: header.srvid });

        if (self._slices.length > (self._curSyncSlice ? 1 : 0)) {
          for (var iSlice = 0; iSlice < self._slices.length; iSlice++) {
            var slice = self._slices[iSlice];
            if (partOfSync && slice === self._curSyncSlice)
              continue;
            if (opts && opts.silent) {
              continue;
            }
            if (BEFORE(date, slice.startTS) ||
                STRICTLY_AFTER(date, slice.endTS))
              continue;
            if ((date === slice.startTS &&
                 id < slice.startUID) ||
                (date === slice.endTS &&
                 id > slice.endUID))
              continue;
            try {
              slice.onHeaderModified(header, body);
            }
            catch (ex) {
              logic(this, 'callbackErr', { ex: ex });
            }
          }
        }
      }
      if (callback)
        callback();
    }
    if (!info) {
      if (headerOrMutationFunc instanceof Function)
        headerOrMutationFunc(null);
      else
        throw new Error('Failed to find block containing header with date: ' +
                        date + ' id: ' + id);
    }
    else if (!this._headerBlocks.hasOwnProperty(info.blockId))
      this._loadBlock('header', info, doUpdateHeader);
    else
      doUpdateHeader(this._headerBlocks[info.blockId]);
  },

  /**
   * Retrieve and update a header by locating it
   */
  updateMessageHeaderByServerId: function(srvid, partOfSync,
                                          headerOrMutationFunc, body,
                                          callback) {
    if (this._pendingLoads.length) {
      this._deferredCalls.push(this.updateMessageHeaderByServerId.bind(
        this, srvid, partOfSync, headerOrMutationFunc, body, callback));
      return;
    }

    var blockId = this._serverIdHeaderBlockMapping[srvid];
    if (srvid === undefined) {
      logic(this, 'serverIdMappingMissing', { srvid: srvid });
      return;
    }

    var findInBlock = function findInBlock(headerBlock) {
      var headers = headerBlock.headers;
      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        if (header.srvid === srvid) {
          // future work: this method will duplicate some work to re-locate
          // the header; we could try and avoid doing that.
          this.updateMessageHeader(
            header.date, header.id, partOfSync, headerOrMutationFunc, body,
            callback);
          return;
        }
      }
    }.bind(this);

    if (this._headerBlocks.hasOwnProperty(blockId)) {
      findInBlock(this._headerBlocks[blockId]);
    }
    else {
      var blockInfo = this._findBlockInfoFromBlockId('header', blockId);
      this._loadBlock('header', blockInfo, findInBlock);
    }
  },

  /**
   * A notification that an existing header is still up-to-date.
   */
  unchangedMessageHeader: function ifs_unchangedMessageHeader(header) {
    if (this._pendingLoads.length) {
      this._deferredCalls.push(this.unchangedMessageHeader.bind(this, header));
      return;
    }
    // (no block update required)
    if (this._curSyncSlice && !this._curSyncSlice.ignoreHeaders)
      this._curSyncSlice.onHeaderAdded(header, true, false);
  },

  hasMessageWithServerId: function(srvid) {
    if (!this._serverIdHeaderBlockMapping)
      throw new Error('Server ID mapping not supported for this storage!');

    var blockId = this._serverIdHeaderBlockMapping[srvid];
    if (srvid === undefined) {
      logic(this, 'serverIdMappingMissing', { srvid: srvid });
      return false;
    }

    return !!blockId;
  },

  deleteMessageHeaderAndBody: function(suid, date, callback) {
    this.getMessageHeader(suid, date, function(header) {
      if (header)
        this.deleteMessageHeaderAndBodyUsingHeader(header, callback);
      else
        callback();
    }.bind(this));
  },

  deleteMessageHeaderUsingHeader: function(header, callback) {
    if (this._pendingLoads.length) {
      this._deferredCalls.push(this.deleteMessageHeaderUsingHeader.bind(
                               this, header, callback));
      return;
    }

    this.headerCount -= 1;

    if (this._curSyncSlice) {
      // TODO: make sure the slice knows the true offset of its
      // first header in the folder. Currently the UI never
      // shrinks its slice so this number is always 0 and we can
      // get away without providing that offset for now.
      this._curSyncSlice.headerCount = this.headerCount;
      // NB: ignoreHeaders should never be true if we are deleting headers, but
      // just doing this as a simple transform for equivalence purposes.
      // ignoreHeaders should go away.
      if (!this._curSyncSlice.ignoreHeaders) {
        this._curSyncSlice.onHeaderRemoved(header);
      }
    }
    if (this._slices.length > (this._curSyncSlice ? 1 : 0)) {
      for (var iSlice = 0; iSlice < this._slices.length; iSlice++) {
        var slice = this._slices[iSlice];

        if (slice.type === 'folder') {
          // TODO: make sure the slice knows the true offset of its
          // first header in the folder. Currently the UI never
          // shrinks its slice so this number is always 0 and we can
          // get away without providing that offset for now.
          slice.headerCount = this.headerCount;
        }

        if (slice === this._curSyncSlice)
          continue;
        if (BEFORE(header.date, slice.startTS) ||
            STRICTLY_AFTER(header.date, slice.endTS))
          continue;
        if ((header.date === slice.startTS &&
             header.id < slice.startUID) ||
            (header.date === slice.endTS &&
             header.id > slice.endUID))
          continue;

        slice.onHeaderRemoved(header);
      }
    }

    if (this._serverIdHeaderBlockMapping && header.srvid)
      delete this._serverIdHeaderBlockMapping[header.srvid];

    this._deleteFromBlock('header', header.date, header.id, callback);
  },

  deleteMessageHeaderAndBodyUsingHeader: function(header, callback) {
    if (this._pendingLoads.length) {
      this._deferredCalls.push(this.deleteMessageHeaderAndBodyUsingHeader.bind(
                               this, header, callback));
      return;
    }
    this.deleteMessageHeaderUsingHeader(header, function() {
      this._deleteFromBlock('body', header.date, header.id, callback);
    }.bind(this));
  },

  /**
   * Delete a message header and its body using only the server id for the
   * message.  This requires that `serverIdHeaderBlockMapping` was enabled.
   * Currently, the mapping is a naive, always-in-memory (at least as long as
   * the FolderStorage is in memory) map.
   */
  deleteMessageByServerId: function(srvid, callback) {
    if (!this._serverIdHeaderBlockMapping)
      throw new Error('Server ID mapping not supported for this storage!');

    if (this._pendingLoads.length) {
      this._deferredCalls.push(this.deleteMessageByServerId.bind(this, srvid,
                                                                 callback));
      return;
    }

    var blockId = this._serverIdHeaderBlockMapping[srvid];
    if (srvid === undefined) {
      logic(this, 'serverIdMappingMissing', { srvid: srvid });
      return;
    }

    var findInBlock = function findInBlock(headerBlock) {
      var headers = headerBlock.headers;
      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        if (header.srvid === srvid) {
          this.deleteMessageHeaderAndBodyUsingHeader(header, callback);
          return;
        }
      }
    }.bind(this);

    if (this._headerBlocks.hasOwnProperty(blockId)) {
      findInBlock(this._headerBlocks[blockId]);
    }
    else {
      var blockInfo = this._findBlockInfoFromBlockId('header', blockId);
      this._loadBlock('header', blockInfo, findInBlock);
    }
  },

  /**
   * Add a message body to the system; you must provide the header associated
   * with the body.
   */
  addMessageBody: function ifs_addMessageBody(header, bodyInfo, callback) {
    if (this._pendingLoads.length) {
      this._deferredCalls.push(this.addMessageBody.bind(
                                 this, header, bodyInfo, callback));
      return;
    }
    logic(this, 'addMessageBody',
          { date: header.date,
            id: header.id,
            srvid: header.srvid,
            bodyInfo: bodyInfo });

    // crappy size estimates where we assume the world is ASCII and so a UTF-8
    // encoding will take exactly 1 byte per character.
    var sizeEst = OBJ_OVERHEAD_EST + NUM_ATTR_OVERHEAD_EST +
                    4 * NULL_ATTR_OVERHEAD_EST;
    function sizifyAddrs(addrs) {
      sizeEst += LIST_ATTR_OVERHEAD_EST;
      if (!addrs)
        return;
      for (var i = 0; i < addrs.length; i++) {
        var addrPair = addrs[i];
        sizeEst += OBJ_OVERHEAD_EST + 2 * STR_ATTR_OVERHEAD_EST +
                     (addrPair.name ? addrPair.name.length : 0) +
                     (addrPair.address ? addrPair.address.length : 0);
      }
    }
    function sizifyAttachments(atts) {
      sizeEst += LIST_ATTR_OVERHEAD_EST;
      if (!atts)
        return;
      for (var i = 0; i < atts.length; i++) {
        var att = atts[i];
        sizeEst += OBJ_OVERHEAD_EST + 2 * STR_ATTR_OVERHEAD_EST +
                     att.name.length + att.type.length +
                     NUM_ATTR_OVERHEAD_EST;
      }
    }
    function sizifyStr(str) {
      sizeEst += STR_ATTR_OVERHEAD_EST + str.length;
    }
    function sizifyStringList(strings) {
      sizeEst += LIST_OVERHEAD_EST;
      if (!strings)
        return;
      for (var i = 0; i < strings.length; i++) {
        sizeEst += STR_ATTR_OVERHEAD_EST + strings[i].length;
      }
    }
    function sizifyBodyRep(rep) {
      sizeEst += LIST_OVERHEAD_EST +
                   NUM_OVERHEAD_EST * (rep.length / 2) +
                   STR_OVERHEAD_EST * (rep.length / 2);
      for (var i = 1; i < rep.length; i += 2) {
        if (rep[i])
          sizeEst += rep[i].length;
      }
    };
    function sizifyBodyReps(reps) {
      if (!reps)
        return;


      sizeEst += STR_OVERHEAD_EST * (reps.length / 2);
      for (var i = 0; i < reps.length; i++) {
        var rep = reps[i];
        if (rep.type === 'html') {
          sizeEst += STR_OVERHEAD_EST + rep.amountDownloaded;
        } else {
          rep.content && sizifyBodyRep(rep.content);
        }
      }
    };

    if (bodyInfo.to)
      sizifyAddrs(bodyInfo.to);
    if (bodyInfo.cc)
      sizifyAddrs(bodyInfo.cc);
    if (bodyInfo.bcc)
      sizifyAddrs(bodyInfo.bcc);
    if (bodyInfo.replyTo)
      sizifyStr(bodyInfo.replyTo);


    sizifyAttachments(bodyInfo.attachments);
    sizifyAttachments(bodyInfo.relatedParts);
    sizifyStringList(bodyInfo.references);
    sizifyBodyReps(bodyInfo.bodyReps);

    bodyInfo.size = sizeEst;

    this._insertIntoBlockUsingDateAndUID(
      'body', header.date, header.id, header.srvid, bodyInfo.size, bodyInfo,
      callback);
  },

  /**
   * Determines if the bodyReps of a given body have been downloaded...
   *
   * Note that for POP3 we will return false here if there are undownloaded
   * attachments even if the body parts are entirely downloaded.  This
   * situation would occur if the body is extremely small and so our snippet
   * fetch is able to fully retrieve the observed body parts.
   *
   *    storage.messageBodyRepsDownloaded(bodyInfo) => true/false
   *
   */
  messageBodyRepsDownloaded: function(bodyInfo) {
    // no reps its as close to downloaded as its going to get.
    if (!bodyInfo.bodyReps || !bodyInfo.bodyReps.length)
      return true;

    var bodyRepsDownloaded = bodyInfo.bodyReps.every(function(rep) {
      return rep.isDownloaded;
    });

    // As noted above, for POP3 we want to also validate the state of the
    // attachments since they need to be downloaded for the whole message to
    // have been downloaded.  Of course, we only want to do this for the inbox;
    // all other folders are synthetic and downloading is nonsensical.
    //
    // Sarcastic hooray for POP3 forcing us to do stuff like this.
    if (this._account.type !== 'pop3' || this.folderMeta.type !== 'inbox') {
      return bodyRepsDownloaded;
    }
    var attachmentsDownloaded = bodyInfo.attachments.every(function(att) {
      return !!att.file;
    });
    return bodyRepsDownloaded && attachmentsDownloaded;
  },

  /**
   * Identical to getMessageBody but will attempt to download all body reps
   * prior to firing its callback .
   */
  getMessageBodyWithReps: function(suid, date, callback) {
    var self = this;
    // try to get the body without any magic
    this.getMessageBody(suid, date, function(bodyInfo) {
      if (!bodyInfo) {
        return callback(bodyInfo);
      }
      if (self.messageBodyRepsDownloaded(bodyInfo)) {
        return callback(bodyInfo);
      }

      // queue a job and return bodyInfo after it completes..
      self._account.universe.downloadMessageBodyReps(suid, date,
                                                     function(err, bodyInfo) {
        // the err (if any) will be logged by the job.
        callback(bodyInfo);
      });
    });
  },

  /**
   * Load the given message body while obeying call ordering consistency rules.
   * If any other calls have gone asynchronous because block loads are required,
   * then this call will wait for those calls to complete first even if we
   * already have the requested body block loaded.  If we haven't gone async and
   * the body is already available, the callback will be invoked synchronously
   * while this function is still on the stack.  So, uh, don't be surprised by
   * that.
   */
  getMessageBody: function ifs_getMessageBody(suid, date, callback) {
    if (this._pendingLoads.length) {
      this._deferredCalls.push(
        this.getMessageBody.bind(this, suid, date, callback));
      return;
    }

    var id = parseInt(suid.substring(suid.lastIndexOf('/') + 1)),
        posInfo = this._findRangeObjIndexForDateAndID(this._bodyBlockInfos,
                                                      date, id);
    if (posInfo[1] === null) {
      logic(this, 'bodyNotFound');
      try {
        callback(null);
      }
      catch (ex) {
        logic(this, 'callbackErr', { ex: ex });
      }
      return;
    }
    var bodyBlockInfo = posInfo[1], self = this;
    if (!(this._bodyBlocks.hasOwnProperty(bodyBlockInfo.blockId))) {
      this._loadBlock('body', bodyBlockInfo, function(bodyBlock) {
          var bodyInfo = bodyBlock.bodies[id] || null;
          if (!bodyInfo)
            logic(self, 'bodyNotFound');
          try {
            callback(bodyInfo);
          }
          catch (ex) {
            logic(self, 'callbackErr', { ex: ex });
          }
        });
      return;
    }
    var block = this._bodyBlocks[bodyBlockInfo.blockId],
        bodyInfo = block.bodies[id] || null;
    if (!bodyInfo)
      logic(this, 'bodyNotFound');
    try {
      callback(bodyInfo);
    }
    catch (ex) {
      logic(this, 'callbackErr', { ex: ex });
    }
  },

  /**
   * Update a message body; this should only happen because of attachments /
   * related parts being downloaded or purged from the system.  This is an
   * asynchronous operation.
   *
   * Right now it is assumed/required that this body was retrieved via
   * getMessageBody while holding a mutex so that the body block must still
   * be around in memory.
   *
   * Additionally the final argument allows you to send an event to any client
   * listening for changes on a given body.
   *
   *    // client listening for a body change event
   *
   *    // ( body is a MessageBody )
   *    body.onchange = function(detail, bodyInfo) {
   *      // detail => { changeDetails: { bodyReps: [0], ... }, value: y }
   *    };
   *
   *    // in the backend
   *
   *    storage.updateMessageBody(
   *      header,
   *      changedBodyInfo,
   *      { changeDetails: { bodyReps: [0], ... }, value: y }
   *    );
   *
   * @method updateMessageBody
   * @param header {HeaderInfo}
   * @param bodyInfo {BodyInfo}
   * @param options {Object}
   * @param [options.flushBecause] {'blobs'}
   *   If present, indicates that we should flush the message body to disk and
   *   read it back from IndexedDB because we are writing Blobs that are not
   *   already known to IndexedDB and we want to replace potentially
   *   memory-backed Blobs with disk-backed Blobs.  This is essential for
   *   memory management.  There are currently no extenuating circumstances
   *   where you should lie to us about this.
   *
   *   This inherently causes saveAccountState to be invoked, so callers should
   *   sanity-check they aren't doing something weird to the database that could
   *   cause a non-coherent state to appear.
   *
   *   If you pass a value for this, you *must* forget your reference to the
   *   bodyInfo you pass in in order for our garbage collection to work!
   * @param eventDetails {Object}
   *   An event details object that describes the changes being made to the
   *   body representation.  This object will be directly reported to clients.
   *   If omitted, no event will be generated.  Only do this if you're doing
   *   something that should not be made visible to anything; like while the
   *   process of attaching
   *
   *   Please be sure to document everything here for now.
   * @param eventDetails.changeDetails {Object}
   *   An object indicating what changed in the body.  All of the following
   *   attributes are optional.  If they aren't present, the thing didn't
   *   change.
   * @param eventDetails.changeDetails.bodyReps {Number[]}
   *   The indices of the bodyReps array that changed.  In general bodyReps
   *   should only be added or modified.  However, in the case of POP3, a
   *   fictitious body part of type 'fake' may be created and may subsequently
   *   be removed.  No index is generated for the removal, but this should
   *   end up being okay because the UI should not reflect the 'fake' bodyRep
   *   into anything.
   * @param eventDetails.changeDetails.attachments {Number[]}
   *   The indices of the attachments array that changed by being added or
   *   modified.  Attachments may be detached; these indices are reported in
   *   detachedAttachments.
   * @param eventDetails.changeDetails.relatedParts {Number[]}
   *   The indices of the relatedParts array that changed by being added or
   *   modified.
   * @param eventDetails.changeDetails.detachedAttachments {Number[]}
   *   The indices of the attachments array that were deleted.  Note that this
   *   should only happen for drafts and no code should really be holding onto
   *   those bodies.  Additionally, the draft headers/bodies get nuked and
   *   re-created every time a draft is saved, so they shouldn't hang around in
   *   general.  However, we really do not want to allow the Blob references to
   *   leak, so we do report this so we can clean them up in clients.  splices
   *   for this case should be performed in the order reported.
   * @param callback {Function}
   *   A callback to be invoked after the body has been updated and after any
   *   body change notifications have been handed off to the MailUniverse.  The
   *   callback receives a reference to the updated BodyInfo object.
   */
  updateMessageBody: function(header, bodyInfo, options, eventDetails,
                              callback) {
    if (typeof(eventDetails) === 'function') {
      callback = eventDetails;
      eventDetails = null;
    }

    // (While this method can complete synchronously, we want to maintain its
    // perceived ordering relative to those that cannot be.)
    if (this._pendingLoads.length) {
      this._deferredCalls.push(this.updateMessageBody.bind(
                                 this, header, bodyInfo, options,
                                 eventDetails, callback));
      return;
    }

    var suid = header.suid;
    var id = parseInt(suid.substring(suid.lastIndexOf('/') + 1));
    var self = this;

    // (called when addMessageBody completes)
    function bodyUpdated() {
      if (options.flushBecause) {
        bodyInfo = null;
        self._account.saveAccountState(
          null, // no transaction to reuse
          function forgetAndReGetMessageBody() {
            // Force the block hosting the body to be discarded from the
            // cache.
            self.getMessageBody(suid, header.date, performNotifications);
          },
          'flushBody');
      }
      else {
        performNotifications();
      }
    }

    function performNotifications(refreshedBody) {
      if (refreshedBody) {
        bodyInfo = refreshedBody;
      }
      if (eventDetails && self._account.universe) {
        self._account.universe.__notifyModifiedBody(
          suid, eventDetails, bodyInfo
        );
      }

      if (callback) {
        callback(bodyInfo);
      }
    }

    // We always recompute the size currently for safety reasons, but as of
    // writing this, changes to attachments/relatedParts will not affect the
    // body size, only changes to body reps.
    this._deleteFromBlock('body', header.date, id, function() {
      self.addMessageBody(header, bodyInfo, bodyUpdated);
    });
  },

  shutdown: function() {
    // reverse iterate since they will remove themselves as we kill them
    for (var i = this._slices.length - 1; i >= 0; i--) {
      this._slices[i].die();
    }
    this.folderSyncer.shutdown();
  },

  /**
   * The folder is no longer known on the server or we are just deleting the
   * account; close out any live connections or processing.  Database cleanup
   * will be handled at the account level so it can go in a transaction with
   * all the other related changes.
   */
  youAreDeadCleanupAfterYourself: function() {
    // XXX close connections, etc.
  },
};


}); // end define
;
/*global define, console */
/**
 * Drives periodic synchronization, covering the scheduling, deciding what
 * folders to sync, and generating notifications to relay to the UI.  More
 * specifically, we have two goals:
 *
 * 1) Generate notifications about new messages.
 *
 * 2) Cause the device to synchronize its offline store periodically with the
 *    server for general responsiveness and so the user can use the device
 *    offline.
 *
 * We use mozAlarm to schedule ourselves to wake up when our next
 * synchronization should occur.
 *
 * All synchronization occurs in parallel because we want the interval that we
 * force the device's radio into higher power modes to be as short as possible.
 *
 * This logic is part of the back-end, not the front-end.  We want to notify
 * the front-end of new messages, but we want the front-end to be the one that
 * displays and services them to the user.
 **/

define('cronsync',['require','exports','module','logic','./worker-router','./mailslice','./syncbase','./allback','./slice_bridge_proxy'],function(require, exports) {


var logic = require('logic'),
    router = require('./worker-router'),
    mailslice = require('./mailslice'),
    syncbase = require('./syncbase'),
    allback = require( './allback');

function debug(str) {
  console.log('cronsync: ' + str + '\n');
}

var SliceBridgeProxy = require('./slice_bridge_proxy').SliceBridgeProxy;

/**
 * Create a specialized sync slice via clobbering that accumulates a list of
 * new headers and invokes a callback when the sync has fully completed.
 *
 * Fully completed includes:
 * - The account update has been fully saved to disk.
 *
 * New header semantics are:
 * - Header is as new or newer than the newest header we previously knew about.
 *   Specifically we're using SINCE which is >=, so a message that arrived at
 *   the same second as the other message still counts as new.  Because the new
 *   message will inherently have a higher id than the other message, this
 *   meets with our other ordering semantics, although I'm thinking it wasn't
 *   totally intentional.
 * - Header is unread.  (AKA Not \Seen)
 *
 * "Clobbering" in this case means this is a little hacky.  What we do is:
 * - Take a normal slice and hook it up to a normal SliceBridgeProxy, but
 *   give the proxy a fake bridge that never sends any data anywhere.  This
 *   is reasonably future-proof/safe.
 *
 * - Put an onNewHeader method on the slice to accumulate the new headers.
 *   The new headers are all we care about.  The rest of the headers loaded/etc.
 *   are boring to us and do not matter.  However, there's relatively little
 *   memory or CPU overhead to letting that stuff get populated/retained since
 *   it's in memory already anyways and at worst we're only delaying the GC by
 *   a little bit.  (This is not to say there aren't pathological situations
 *   possible, but they'd be largely the same if the user triggered the sync.
 *   The main difference cronsync currently will definitely not shrink the
 *   slice.
 *
 * - Clobber proy.sendStatus to know when the sync has completed via the
 *   same signal the front-end uses to know when the sync is over.
 *
 * You as the caller need to:
 * - Make sure to kill the slice in a timely fashion after we invoke the
 *   callback.  Since killing the slice can result in the connection immediately
 *   being closed, you want to make sure that if you're doing anything like
 *   scheduling snippet downloads that you do that first.
 */
function makeHackedUpSlice(storage, callback) {
  var fakeBridgeThatEatsStuff = {
        __sendMessage: function() {}
      },
      proxy = new SliceBridgeProxy(fakeBridgeThatEatsStuff, 'cron'),
      slice = new mailslice.MailSlice(proxy, storage),
      oldStatusMethod = proxy.sendStatus,
      newHeaders = [];

  slice.onNewHeader = function(header) {
    console.log('onNewHeader: ' + header);
    newHeaders.push(header);
  };

  proxy.sendStatus = function(status, requested, moreExpected,
                              progress, newEmailCount) {
    // (maintain normal behaviour)
    oldStatusMethod.apply(this, arguments);

    // We do not want to declare victory until the sync process has fully
    // completed which (significantly!) includes waiting for the save to have
    // completed.
    // (Only fire completion once.)
    if (callback) {
      switch (status) {
        // normal success and failure
        case 'synced':
        case 'syncfailed':
        // ActiveSync specific edge-case where syncFolderList has not yet
        // completed.  If the slice is still alive when syncFolderList completes
        // the slice will auto-refresh itself.  We don't want or need this,
        // which is fine since we kill the slice in the callback.
        case 'syncblocked':
          try {
            callback(newHeaders);
          }
          catch (ex) {
            console.error('cronsync callback error:', ex, '\n', ex.stack);
            callback = null;
            throw ex;
          }
          callback = null;
          break;
      }
    }
  };

  return slice;
}

/**
 * The brains behind periodic account synchronization; only created by the
 * universe once it has loaded its configuration and accounts.
 */
function CronSync(universe) {
  this._universe = universe;

  logic.defineScope(this, 'CronSync');

  this._ensureSyncResolve = null;

  this.sendCronSync = router.registerSimple('cronsync', (data) => {
    var args = data.args;
    switch (data.cmd) {
      case 'alarm':
        debug('received an alarm via a message handler');
        this.onAlarm.apply(this, args);
        break;
      case 'syncEnsured':
        debug('received an syncEnsured via a message handler');
        this.onSyncEnsured.apply(this, args);
        break;
    }
  });
  this.sendCronSync('hello');

  this.ensureSync();
}

exports.CronSync = CronSync;
CronSync.prototype = {
  /**
   * Makes sure there is a sync timer set up for all accounts.
   */
  ensureSync: function() {
    // Only execute ensureSync if it is not already in progress. Otherwise, due
    // to async timing of mozAlarm setting, could end up with two sync tasks for
    // the same ID.
    if (this._ensureSyncResolve) {
      return;
    }

    logic(this, 'ensureSync_begin');

    this._ensureSyncPromise = new Promise((resolve) => {
      // No error pathway for the bridge hop, so just tracking resolve.
      this._ensureSyncResolve = resolve;
    });

    debug('ensureSync called');

    var accounts = this._universe.accounts,
        syncData = {};

    accounts.forEach(function(account) {
      // Store data by interval, use a more obvious string key instead of just
      // stringifying a number, which could be confused with an array construct.
      var interval = account.accountDef.syncInterval,
          intervalKey = 'interval' + interval;

      if (!syncData.hasOwnProperty(intervalKey)) {
        syncData[intervalKey] = [];
      }
      syncData[intervalKey].push(account.id);
    });

    this.sendCronSync('ensureSync', [syncData]);
  },

  /**
   * Called from cronsync-main once ensureSync as set any alarms needed. Need to
   * wait for it before signaling sync is done because otherwise the app could
   * get closed down before the alarm additions succeed.
   */
  onSyncEnsured: function() {
    this._ensureSyncResolve();
    this._ensureSyncResolve = null;
    logic(this, 'ensureSync_end');
  },

  /**
   * Synchronize the given account. This fetches new messages for the inbox, and
   * attempts to send pending outbox messages (if applicable). The callback
   * occurs after both of those operations have completed.
   */
  syncAccount: function(account) {
    return new Promise((resolve) => {
      var scope = logic.subscope(this, { accountId: account.id });

      // - Skip syncing if we are offline or the account is disabled
      if (!this._universe.online || !account.enabled) {
        debug('syncAccount early exit: online: ' +
              this._universe.online + ', enabled: ' + account.enabled);
        logic(scope, 'syncSkipped');
        resolve();
        return;
      }

      var latch = allback.latch();
      var inboxDone = latch.defer('inbox');

      var inboxFolder = account.getFirstFolderWithType('inbox');
      var storage = account.getFolderStorageForFolderId(inboxFolder.id);

      // XXX check when the folder was most recently synchronized and skip this
      // sync if it is sufficiently recent.

      // - Initiate a sync of the folder covering the desired time range.
      logic(scope, 'syncAccount_begin');
      logic(scope, 'syncAccountHeaders_begin');

      var slice = makeHackedUpSlice(storage, (newHeaders) => {
        logic(scope, 'syncAccountHeaders_end', { headers: newHeaders });

        // Reduce headers to the minimum number and data set needed for
        // notifications.
        var notifyHeaders = [];
        newHeaders.some(function(header, i) {
          notifyHeaders.push({
            date: header.date,
            from: header.author.name || header.author.address,
            subject: header.subject,
            accountId: account.id,
            messageSuid: header.suid
          });

          if (i === syncbase.CRONSYNC_MAX_MESSAGES_TO_REPORT_PER_ACCOUNT - 1) {
            return true;
          }
        });

        if (newHeaders.length) {
          debug('Asking for snippets for ' + notifyHeaders.length + ' headers');
          // POP3 downloads snippets as part of the sync process, there is no
          // need to call downloadBodies.
          if (account.accountDef.type === 'pop3+smtp') {
            logic(scope, 'syncAccount_end');
            inboxDone([newHeaders.length, notifyHeaders]);
          } else if (this._universe.online) {
            logic(scope, 'syncAccountSnippets_begin');
            this._universe.downloadBodies(
              newHeaders.slice(
                0, syncbase.CRONSYNC_MAX_SNIPPETS_TO_FETCH_PER_ACCOUNT),
              {
                maximumBytesToFetch: syncbase.MAX_SNIPPET_BYTES
              },
              () => {
                debug('Notifying for ' + newHeaders.length + ' headers');
                logic(scope, 'syncAccountSnippets_end');
                logic(scope, 'syncAccount_end');
                inboxDone([newHeaders.length, notifyHeaders]);
              });
          } else {
            logic(scope, 'syncAccount_end');
            debug('UNIVERSE OFFLINE. Notifying for ' + newHeaders.length +
                  ' headers');
            inboxDone([newHeaders.length, notifyHeaders]);
          }
        } else {
          logic(scope, 'syncAccount_end');
          inboxDone();
        }

        // Kill the slice.  This will release the connection and result in its
        // death if we didn't schedule snippet downloads above.
        slice.die();
      });

      // Pass true to force contacting the server.
      storage.sliceOpenMostRecent(slice, true);

      // Check the outbox; if it has pending messages, attempt to send them.
      var outboxFolder = account.getFirstFolderWithType('outbox');
      if (outboxFolder) {
        var outboxStorage = account
                                  .getFolderStorageForFolderId(outboxFolder.id);
        if (outboxStorage.getKnownMessageCount() > 0) {
          var outboxDone = latch.defer('outbox');
          logic(scope, 'sendOutbox_begin');
          this._universe.sendOutboxMessages(
            account,
            {
              reason: 'syncAccount'
            },
            () => {
              logic(scope, 'sendOutbox_end');
              outboxDone();
            });
        }
      }

      // After both inbox and outbox syncing are algorithmically done, wait for
      // any ongoing job operations to complete so that the app is not killed in
      // the middle of a sync.
      latch.then((latchResults) => {
        // Right now, we ignore the outbox sync's results; we only care about
        // the inbox.
        var inboxResult = latchResults.inbox[0];
        this._universe.waitForAccountOps(account, function() {
          // Also wait for any account save to finish. Most likely failure will
          // be new message headers not getting saved if the callback is not
          // fired until after account saves.
          account.runAfterSaves(function() {
            resolve(inboxResult);
          });
        });
      });
    });
  },

  onAlarm: function(accountIds, accountsData) {
    logic(this, 'alarmFired', { accountIds: accountIds });

    if (!accountIds) {
      return;
    }

    let accounts = this._universe.accounts,
        targetAccounts = [],
        ids = [];

    let syncSwitch = accountsData.syncSwitch;
    let getPublicAccount = (address) => {
      let account = null;
      for (let pAccount of accountsData.accounts) {
        if (pAccount.accountId === address) {
          account = pAccount;
          break;
        }
      }
      return account;
    };

    logic(this, 'cronSync_begin');
    this._universe.__notifyStartedCronSync(accountIds);

    // Make sure the acount IDs are still valid. This is to protect against an
    // account deletion that did not clean up any alarms correctly.
    accountIds.forEach(function(id) {
      accounts.some(function(account) {
        let address = account.identities[0].address;
        let pAccount = getPublicAccount(address);
        if (account.id === id && (!account.accountDef.public ||
            (pAccount && syncSwitch[pAccount.accountId]))) {
          targetAccounts.push(account);
          ids.push(id);
          return true;
        }
      });
    });

    // Make sure next alarm is set up. In the case of a cold start background
    // sync, this is a bit redundant in that the startup of the mailuniverse
    // would trigger this work. However, if the app is already running, need to
    // be sure next alarm is set up, so ensure the next sync is set up here. Do
    // it here instead of after a sync in case an error in sync would prevent
    // the next sync from getting scheduled.
    this.ensureSync();

    var syncResults = [];
    var accountsResults = {
      accountIds: accountIds
    };

    var done = () => {
      // Make sure the ensure work is done before wrapping up.
      this._ensureSyncPromise.then(() => {
        if (syncResults.length) {
          accountsResults.updates = syncResults;
        }

        this._universe.__notifyStoppedCronSync(accountsResults);
        logic(this, 'syncAccounts_end', { accountsResults: accountsResults });
        logic(this, 'cronSync_end');
      });
    };

    // Nothing new to sync, probably old accounts. Just return and indicate that
    // syncing is done.
    if (!ids.length) {
      done();
      return;
    }

    logic(this, 'syncAccounts_begin');
    Promise.all(targetAccounts.map((account) => {
      return this.syncAccount(account).then((result) => {
        if (result) {
          syncResults.push({
            id: account.id,
            address: account.identities[0].address,
            count: result[0],
            latestMessageInfos: result[1]
          });
        }
      });
    }))
    .then(done);
  },

  shutdown: function() {
    router.unregister('cronsync');
  }
};

}); // end define
;
/**
 * Common code for creating and working with various account types.
 **/

define(
  'accountcommon',[
    './a64',
    'logic',
    './allback',
    'require',
    'module',
    'exports'
  ],
  function(
    $a64,
    logic,
    allback,
    require,
    $module,
    exports
  ) {

var latchedWithRejections = allback.latchedWithRejections;

// The number of milliseconds to wait for various (non-ActiveSync) XHRs to
// complete during the autoconfiguration process. This value is intentionally
// fairly large so that we don't abort an XHR just because the network is
// spotty.
var AUTOCONFIG_TIMEOUT_MS = 30 * 1000;

var ISPDB_AUTOCONFIG_ROOT =
  'https://live.mozillamessaging.com/autoconfig/v1.1/';

function requireConfigurator(type, fn) {
  if (type === 'activesync') {
    require(['activesync/configurator'], fn);
  } else if (type === 'pop3+smtp' || type === 'imap+smtp') {
    require(['composite/configurator'], fn);
  }
}

function accountTypeToClass(type, callback) {
  requireConfigurator(type, function(mod) {
    callback(mod.account.Account);
  });
}
exports.accountTypeToClass = accountTypeToClass;

// Simple hard-coded autoconfiguration by domain...
var autoconfigByDomain = exports._autoconfigByDomain = {
  'localhost': {
    type: 'imap+smtp',
    incoming: {
      hostname: 'localhost',
      port: 143,
      socketType: 'plain',
      username: '%EMAILLOCALPART%',
    },
    outgoing: {
      hostname: 'localhost',
      port: 25,
      socketType: 'plain',
      username: '%EMAILLOCALPART%',
    },
  },
  'fakeimaphost': {
    type: 'imap+smtp',
    incoming: {
      hostname: 'localhost',
      port: 0,
      socketType: 'plain',
      username: '%EMAILLOCALPART%',
    },
    outgoing: {
      hostname: 'localhost',
      port: 0,
      socketType: 'plain',
      username: '%EMAILLOCALPART%',
    },
  },
  'fakepop3host': {
    type: 'pop3+smtp',
    incoming: {
      hostname: 'localhost',
      port: 0,
      socketType: 'plain',
      username: '%EMAILLOCALPART%',
    },
    outgoing: {
      hostname: 'localhost',
      port: 0,
      socketType: 'plain',
      username: '%EMAILLOCALPART%',
    },
  },
  'slocalhost': {
    type: 'imap+smtp',
    incoming: {
      hostname: 'localhost',
      port: 993,
      socketType: 'SSL',
      username: '%EMAILLOCALPART%',
    },
    outgoing: {
      hostname: 'localhost',
      port: 465,
      socketType: 'SSL',
      username: '%EMAILLOCALPART%',
    },
  },
  'fakeashost': {
    type: 'activesync',
    displayName: 'Test',
    incoming: {
      // This string will be clobbered with the correct port number when running
      // as a unit test.
      server: 'http://localhost:8880',
      username: '%EMAILADDRESS%',
    },
  },
  // like slocalhost, really just exists to generate a test failure
  'saslocalhost': {
    type: 'activesync',
    displayName: 'Test',
    incoming: {
      server: 'https://localhost:443',
      username: '%EMAILADDRESS%',
    },
  },
  // Mapping for a nonexistent domain for testing a bad domain without it being
  // detected ahead of time by the autoconfiguration logic or otherwise.
  'nonesuch.nonesuch': {
    type: 'imap+smtp',
    imapHost: 'nonesuch.nonesuch',
    imapPort: 993,
    imapCrypto: true,
    smtpHost: 'nonesuch.nonesuch',
    smtpPort: 465,
    smtpCrypto: true,
    usernameIsFullEmail: false,
  },
};

/**
 * Recreate the array of identities for a given account.
 *
 * @param universe the MailUniverse
 * @param accountId the ID for this account
 * @param oldIdentities an array of the old identities
 * @return the new identities
 */
function recreateIdentities(universe, accountId, oldIdentities) {
  var identities = [];
  for (var iter in Iterator(oldIdentities)) {
    var oldIdentity = iter[1];
    identities.push({
      id: accountId + '/' + $a64.encodeInt(universe.config.nextIdentityNum++),
      name: oldIdentity.name,
      address: oldIdentity.address,
      replyTo: oldIdentity.replyTo,
      signature: oldIdentity.signature,
      signatureEnabled: oldIdentity.signatureEnabled
    });
  }
  return identities;
}
exports.recreateIdentities = recreateIdentities;

function fillConfigPlaceholders(userDetails, sourceConfigInfo) {
  // Return a mutated copy, don't mutate the original.
  var configInfo = JSON.parse(JSON.stringify(sourceConfigInfo));

  var details = userDetails.emailAddress.split('@');
  var emailLocalPart = details[0], emailDomainPart = details[1];
  var domain = emailDomainPart.toLowerCase();

  var placeholderFields = {
    incoming: ['username', 'hostname', 'server'],
    outgoing: ['username', 'hostname'],
  };

  function fillPlaceholder(value) {
    return value.replace('%EMAILADDRESS%', userDetails.emailAddress)
                .replace('%EMAILLOCALPART%', emailLocalPart)
                .replace('%EMAILDOMAIN%', emailDomainPart)
                .replace('%REALNAME%', userDetails.displayName);
  }

  for (var serverType in placeholderFields) {
    var fields = placeholderFields[serverType];
    var server = configInfo[serverType];
    if (!server) {
      continue;
    }

    for (var iField = 0; iField < fields.length; iField++) {
      var field = fields[iField];

      if (server.hasOwnProperty(field)) {
        server[field] = fillPlaceholder(server[field]);
      }
    }
  }

  return configInfo;
}
exports.fillConfigPlaceholders = fillConfigPlaceholders;


/**
 * The Autoconfigurator tries to automatically determine account settings, in
 * large part by taking advantage of Thunderbird's prior work on autoconfig:
 * <https://developer.mozilla.org/en-US/docs/Thunderbird/Autoconfiguration>.
 * There are some important differences, however, since we support ActiveSync
 * whereas Thunderbird does not.
 *
 * The v2 process is as follows.  All of this is done without a password (since
 * it might turn out we don't need a password in the case of OAuth2-based auth.)
 *
 *  1) Get the domain from the user's email address
 *  2) Check hardcoded-into-GELAM account settings for the domain (useful for
 *     unit tests)
 *  3) Check locally stored XML config files in Gaia for the domain at
 *     `/autoconfig/<domain>`
 *  4) In parallel:
 *     - Do server-hosted autoconfig checks at URLs, passing the user's email
 *       address in the query string (as `emailaddress`)
 *       - `https://autoconfig.<domain>/mail/config-v1.1.xml` and
 *       - `https://<domain>/.well-known/autoconfig/mail/config-v1.1.xml`,
 *     - Check the Mozilla ISPDB for the domain:
 *       - `https://live.mozillamessaging.com/autoconfig/v1.1/<domain>`
 *     - Having the Mozilla ISPDB do an MX lookup.
 *  5) If we didn't reach a conclusion in step 4, check the MX lookup result.
 *     If it differed from the domain, then re-lookup the locally stored XML
 *     config and failing that, check the ISPDB for that domain.
 *  6) If that didn't net us anything, look for evidence of ActiveSync
 *     AutoDiscover endpoints at the following locations in parallel:
 *     `https://<domain>/autodiscover/autodiscover.xml`
 *     `https://autodiscover.<domain>/autodiscover/autodiscover.xml`
 *
 * This differs from the v1 process in that:
 * - v1 did everything in serial not parallel
 * - v1 used http, not httpS, to look for self-hosted autoconfig servers.
 * - v1 ran autodiscover before checking with the ISPDB but after local and
 *   server-hosted ISPDB autoconfig files.
 * - v1 actually ran autodiscover.  Now we just look for evidence of
 *   autodiscover.  AutoDiscover requires being able to authenticate the user
 *   which implies having the password.  Since we're not sure if we need a
 *   password or not, we can't do that yet.  We leave AutoDiscover up to the
 *   ActiveSync configurator to perform.
 * - v1 wanted the user's password
 *
 * These changes were informed by the following needs and observations:
 * - http was a bad idea security-wise, but was done for consistency with
 *   Thunderbird.  The Thunderbird rationale involved DNS also being insecure,
 *   so an attacker could already win with local network control.  However,
 *   Thunderbird also allowed autoconfig to return settings that didn't
 *   use SSL/TLS, whereas we do not.  (We ignore them).
 *
 *   Thunderbird has recently come around to the use of https instead of http
 *   for this purpose.  It's also worth noting that as far as we know, almost
 *   no one actually hosts their own autoconfig servers.
 *
 * - AutoDiscover can be very slow, especially if we're waiting for our requests
 *   to timeout.
 *
 * - It's become common to see servers that implement ActiveSync (which we
 *   strongly dislike) as well as IMAP (which we strongly prefer).  By letting
 *   ActiveSync derail the decision-making process we rob ourselves of the
 *   ability to have the ISPDB indicate the IMAP is an option.
 *
 * - If the user's server supports OAuth2, there's no need to make them type in
 *   their password; it might even be confusing to them.
 *
 * Our ConfigInfo structures look like the following:
 *
 * {
 *   type: 'imap+smtp',
 *   incoming: {
 *     hostname: <imap hostname>,
 *     port: <imap port number>,
 *     socketType: <one of 'plain', 'SSL', 'STARTTLS'>,
 *     username: <imap username>,
 *     authentication: <one of 'password-cleartext', 'xoauth2'>
 *   },
 *   outgoing: {
 *     hostname: <smtp hostname>,
 *     port: <smtp port>,
 *     socketType: <one of 'plain', 'SSL', 'STARTTLS'>,
 *     username: <smtp username>,
 *     authentication: <one of 'password-cleartext', 'xoauth2'>
 *   },
 *   oauth2Settings: null or {
 *     secretGroup: <group identify which app secrets should be used>,
 *     authEndpoint: <auth url of the page to show to the user>,
 *     tokenEndpoint: <url for getting/refreshing tokens (no user ui)>,
 *     scope: <space-delimited scopes to request>
 *   }
 * }
 *
 * POP3 is similar to IMAP/SMTP but it's 'pop3+smtp'.  ActiveSync looks
 * like:
 *
 * {
 *   type: 'activesync',
 *   displayName: <display name>, (optional)
 *   incoming: {
 *     server: 'https://<activesync hostname>'
 *   },
 * }
 */
function Autoconfigurator() {
  this.timeout = AUTOCONFIG_TIMEOUT_MS;
  logic.defineScope(this, 'Autoconfigurator');
}
exports.Autoconfigurator = Autoconfigurator;
Autoconfigurator.prototype = {
  /**
   * The list of fatal error codes.
   *
   * What's fatal and why:
   * - bad-user-or-pass: We found a server, it told us the credentials were
   *     bogus.  There is no point going on.
   * - not-authorized: We found a server, it told us the credentials are fine
   *     but the access rights are insufficient.  There is no point going on.
   *
   * Non-fatal and why:
   * - unknown: If something failed we should keep checking other info sources.
   * - no-config-info: The specific source had no details; we should keep
   *     checking other sources.
   */
  _fatalErrors: ['bad-user-or-pass', 'not-authorized'],

  /**
   * Check the supplied error and return true if it's really a "success" or if
   * it's a fatal error we can't recover from.
   *
   * @param error the error code
   * @return true if the error is a "success" or if it's a fatal error
   */
  _isSuccessOrFatal: function(error) {
    return !error || this._fatalErrors.indexOf(error) !== -1;
  },

  /**
   * Get an XML config file from the supplied url. The format is defined at
   * <https://wiki.mozilla.org/Thunderbird:Autoconfiguration:ConfigFileFormat>.
   *
   * @param url the URL to fetch the config file from
   * @param callback a callback taking an error string (if any) and the config
   *        info, formatted as JSON
   */
  _getXmlConfig: function getXmlConfig(url) {
    return new Promise(function(resolve, reject) {

      var scope = logic.subscope(this, { method: 'GET', url: url });
      logic(scope, 'xhr:start');
      var xhr = new XMLHttpRequest({mozSystem: true});
      xhr.open('GET', url, true);
      xhr.timeout = this.timeout;

      xhr.onload = function() {
        logic(scope, 'xhr:end', { status: xhr.status });
        if (xhr.status < 200 || xhr.status >= 300) {
          reject('status' + xhr.status);
          return;
        }
        // XXX: For reasons which are currently unclear (possibly a platform
        // issue), trying to use responseXML results in a SecurityError when
        // running XPath queries. So let's just do an end-run around the
        // "security".
        self.postMessage({
          uid: 0,
          type: 'configparser',
          cmd: 'accountcommon',
          args: [xhr.responseText]
        });

        self.addEventListener('message', function onworkerresponse(evt) {
          var data = evt.data;
          if (data.type != 'configparser' || data.cmd != 'accountcommon') {
            return;
          }
          self.removeEventListener(evt.type, onworkerresponse);
          var args = data.args;
          var config = args[0], status = args[1];
          resolve(config);
        });
      };

      // Caution: don't overwrite ".onerror" twice here. Just be careful
      // to only assign that once until <http://bugzil.la/949722> is fixed.

      xhr.ontimeout = function() {
        logic(scope, 'xhr:end', { status: 'timeout' });
        reject('timeout');
      };

      xhr.onerror = function() {
        logic(scope, 'xhr:end', { status: 'error' });
        reject('error');
      };

      // At least in the past, Gecko might synchronously throw when we call
      // send for a locally-hosted file, so we're sticking with this until the
      // end of time.
      try {
        xhr.send();
      }
      catch(e) {
        logic(scope, 'xhr:end', { status: 'sync-error' });
        reject('status404');
      }
    }.bind(this));
  },

  /**
   * Attempt to get an XML config file locally.
   *
   * @param domain the domain part of the user's email address
   * @param callback a callback taking an error string (if any) and the config
   *        info, formatted as JSON
   */
  _getConfigFromLocalFile: function getConfigFromLocalFile(domain) {
    return this._getXmlConfig('/autoconfig/' + encodeURIComponent(domain));
  },

  /**
   * Check whether it looks like there's an AutoDiscover endpoint at the given
   * URL. AutoDiscover wants us to be authenticated, so we treat a 401 status
   * or 200 status(some servers do not verify the account password) as success
   * and anything else as failure.
   *
   * For maximum realism we perform a POST.
   */
  _checkAutodiscoverUrl: function(url) {
    return new Promise(function(resolve, reject) {
      var scope = logic.subscope(this, { method: 'POST', url: url });
      logic(scope, 'autodiscoverProbe:start');
      var xhr = new XMLHttpRequest({mozSystem: true});
      xhr.open('POST', url, true);
      xhr.timeout = this.timeout;

      var victory = function() {
        resolve({
          type: 'activesync',
          incoming: {
            autodiscoverEndpoint: [url]
          }
        });
      }.bind(this);

      xhr.onload = function() {
        logic(scope, 'autodiscoverProbe:end', { status: xhr.status });
        if (xhr.status === 401 || xhr.status === 200) {
          victory();
          return;
        }
        reject('status' + xhr.status);
      };

      xhr.ontimeout = function() {
        logic(scope, 'autodiscoverProbe:end', { status: 'timeout' });
        reject('timeout');
      };

      xhr.onerror = function() {
        logic(scope, 'autodiscoverProbe:end', { status: 'error' });
        reject('error');
      };

      try {
        xhr.send(null);
      }
      catch(e) {
        logic(scope, 'autodiscoverProbe:end', { status: 'sync-error' });
        reject('status404');
      }
    }.bind(this));
  },

  /**
   * Look for AutoDiscover endpoints for the given domain.  If we find one, we
   * return what amounts to pseudo-config information.  We don't actually know
   * enough information to do a full autodiscover at this point, so we need to
   * return enough for our ActiveSync account's tryToCreateAccount method to
   * handle things from there.
   */
  _probeForAutodiscover: function(domain) {
    var subdirUrl = 'https://' + domain + '/autodiscover/autodiscover.xml';
    var domainUrl = 'https://autodiscover.' + domain +
                      '/autodiscover/autodiscover.xml';
    return latchedWithRejections({
      subdir: this._checkAutodiscoverUrl(subdirUrl),
      domain: this._checkAutodiscoverUrl(domainUrl)
    }).then(function(results) {
      // Favor the subdirectory discovery point.
      var result = null;
      if (results.domain.resolved && results.domain.value) {
        result = results.domain.value;
      }
      if (results.subdir.resolved && results.subdir.value) {
        if (!result) {
          result = results.subdir.value;
        } else {
          var value = results.subdir.value.incoming.autodiscoverEndpoint;
          results.domain.value.incoming.autodiscoverEndpoint.push(value);
        }
      }
      return result;
    }.bind(this));
  },

  /**
   * Attempt to get an XML config file from the Mozilla ISPDB.
   *
   * @param domain the domain part of the user's email address
   */
  _getConfigFromISPDB: function(domain) {
    return this._getXmlConfig(ISPDB_AUTOCONFIG_ROOT +
                              encodeURIComponent(domain));
  },

  /**
   * Look up the DNS MX record for a domain. This currently uses a web service
   * instead of querying it directly.
   *
   * @param domain the domain part of the user's email address
   *
   * @return {Promise}
   *   If we locate a MX domain and that domain differs from our own domain, we
   *   will resolve the promise with that String.  If there is no MX domain or
   *   it is the same as our existing domain, we will resolve with a null value.
   *   In the event of a problem contacting the ISPDB server, we will reject
   *   the promise.
   */
  _getMX: function getMX(domain) {
    return new Promise(function(resolve, reject) {

      var scope = logic.subscope(this, { domain: domain });
      logic(scope, 'mxLookup:begin');
      var xhr = new XMLHttpRequest({mozSystem: true});
      xhr.open('GET', 'https://live.mozillamessaging.com/dns/mx/' +
               encodeURIComponent(domain), true);
      xhr.timeout = this.timeout;

      xhr.onload = function() {
        var reportDomain = null;
        if (xhr.status === 200) {
          var normStr = xhr.responseText.split('\n')[0];
          if (normStr) {
            normStr = normStr.toLowerCase();
            // XXX: We need to normalize the domain here to get the base domain,
            // but that's complicated because people like putting dots in
            // TLDs. For now, let's just pretend no one would do such a horrible
            // thing.
            var mxDomain = normStr.split('.').slice(-2).join('.');
            if (mxDomain !== domain) {
              reportDomain = mxDomain;
            }
          }
        }
        logic(scope, 'mxLookup:end',
            { 'raw': normStr, normalized: mxDomain, reporting: reportDomain });
        resolve(reportDomain);
      };

      xhr.ontimeout = function() {
        logic(scope, 'mxLookup:end', { status: 'timeout' });
        reject('timeout');
      };
      xhr.onerror = function() {
        logic(scope, 'mxLookup:end', { status: 'error' });
        reject('error');
      };

      xhr.send();
    }.bind(this));
  },

  _getHostedAndISPDBConfigs: function(domain, emailAddress) {
    var commonAutoconfigSuffix = '/mail/config-v1.1.xml?emailaddress=' +
          encodeURIComponent(emailAddress);
    // subdomain autoconfig URL
    var subdomainAutoconfigUrl =
      'https://autoconfig.' + domain + commonAutoconfigSuffix;
    // .well-known autoconfig URL
    var wellKnownAutoconfigUrl =
          'https://' + domain + '/.well-known/autoconfig' +
          commonAutoconfigSuffix;

    return latchedWithRejections({
      autoconfigSubdomain: this._getXmlConfig(subdomainAutoconfigUrl),
      autoconfigWellKnown: this._getXmlConfig(wellKnownAutoconfigUrl),
      ispdb: this._getConfigFromISPDB(domain),
      mxDomain: this._getMX(domain)
    }).then(function(results) {
      // Favor the autoconfig subdomain for historical reasons
      if (results.autoconfigSubdomain.resolved &&
          results.autoconfigSubdomain.value) {
        return { type: 'config', source: 'autoconfig-subdomain',
                 config: results.autoconfigSubdomain.value };
      }
      // Then the well-known
      if (results.autoconfigWellKnown.resolved &&
          results.autoconfigWellKnown.value) {
        return { type: 'config', source: 'autoconfig-wellknown',
                 config: results.autoconfigWellKnown.value };
      }
      // Then the ISPDB
      if (results.ispdb.resolved &&
          results.ispdb.value) {
        return { type: 'config', source: 'ispdb',
                 config: results.ispdb.value };
      }
      if (results.mxDomain.resolved &&
          results.mxDomain.value &&
          results.mxDomain.value !== domain) {
        return { type: 'mx', domain: results.mxDomain.value };
      }
      return { type: null };
    }.bind(this));

  },

  /**
   * Attempt to get an XML config file by checking the DNS MX record and
   * querying the Mozilla ISPDB.
   *
   * @param domain the domain part of the user's email address
   * @param callback a callback taking an error string (if any) and the config
   *        info, formatted as JSON
   */
  _getConfigFromMX: function getConfigFromMX(domain, callback) {
    var self = this;
    this._getMX(domain, function(error, mxDomain, errorDetails) {
      if (error)
        return callback(error, null, errorDetails);

      console.log('  Found MX for', mxDomain);

      if (domain === mxDomain)
        return callback('no-config-info', null, { status: 'mxsame' });

      // If we found a different domain after MX lookup, we should look in our
      // local file store (mostly to support Google Apps domains) and, if that
      // doesn't work, the Mozilla ISPDB.
      console.log('  Looking in local file store');
      self._getConfigFromLocalFile(mxDomain, function(error, config,
                                                      errorDetails) {
        // (Local XML lookup should not have any fatal errors)
        if (!error) {
          callback(error, config, errorDetails);
          return;
        }

        console.log('  Looking in the Mozilla ISPDB');
        self._getConfigFromDB(mxDomain, callback);
      });
    });
  },

  _checkGelamConfig: function(domain) {
    if (autoconfigByDomain.hasOwnProperty(domain)) {
      return autoconfigByDomain[domain];
    }
    return null;
  },

  /**
   * See the MailAPI.learnAboutAccount documentation for usage information.
   *
   * Internals:
   *
   *
   *
   * @return {Promise}
   */
  learnAboutAccount: function(details) {
    return new Promise(function(resolve, reject) {
      var emailAddress = details.emailAddress;
      var emailParts = emailAddress.split('@');
      var emailLocalPart = emailParts[0], emailDomainPart = emailParts[1];
      var domain = emailDomainPart.toLowerCase();
      var scope = logic.subscope(this, { domain: domain });
      logic(scope, 'autoconfig:begin');

      // Call this when we find a usable config setting to perform appropriate
      // normalization, logging, and promise resolution.
      var victory = function(sourceConfigInfo, source) {
        var configInfo = null, result;
        if (sourceConfigInfo) {
          configInfo = fillConfigPlaceholders(details, sourceConfigInfo);
          if (configInfo.incoming &&
              configInfo.incoming.authentication === 'xoauth2') {
            result = 'need-oauth2';
          } else {
            result = 'need-password';
          }
        } else {
          result = 'no-config-info';
        }
        logic(scope, 'autoconfig:end', {
          result: result,
          source: source,
          configInfo: configInfo
        });
        resolve({ result: result, source: source, configInfo: configInfo });
      }.bind(this);
      // Call this if we can't find a configuration.
      var failsafeFailure = function(err) {
        logic(this, 'autoconfig:end', { err: {
          message: err && err.message,
          stack: err && err.stack
        }});
        resolve({ result: 'no-config-info', configInfo: null });
      }.bind(this);

      // Helper that turns a rejection into a null and outputs a log entry.
      var coerceRejectionToNull = function(err) {
        logic(scope, 'autoconfig:coerceRejection', { err: err });
        return null;
      }.bind(this);

      // -- Synchronous logic
      // - Group 0: hardcoded in GELAM (testing only)
      var hardcodedConfig = this._checkGelamConfig(domain);
      if (hardcodedConfig) {
        victory(hardcodedConfig, 'hardcoded');
        return;
      }

      // -- Asynchronous setup
      // This all wants to be a generator.  It doesn't make a lot of sense to
      // structure this as a chain of then's since we do want an early return.
      // This is a good candidate for 'koa' or something like it in the near
      // future.

      // - Group 1: local config
      var localConfigHandler = function(info) {
        if (info) {
          victory(info, 'local');
          return null;
        }

        // We don't need to coerce because there will be no rejections.
        return this._getHostedAndISPDBConfigs(domain, emailAddress)
          .then(selfHostedAndISPDBHandler);
      }.bind(this);

      // - Group 2: self-hosted autoconfig, ISPDB first checks
      var mxDomain;
      var selfHostedAndISPDBHandler = function(typedResult) {
        if (typedResult.type === 'config') {
          victory(typedResult.config, typedResult.source);
          return null;
        }
        // Did we get a different MX result?
        if (typedResult.type === 'mx') {
          mxDomain = typedResult.domain;
          return this._getConfigFromLocalFile(mxDomain)
            .catch(coerceRejectionToNull)
            .then(mxLocalHandler);
        }
        // No MX result, probe autodiscover.
        return this._probeForAutodiscover(domain)
          .then(autodiscoverHandler);
      }.bind(this);

      // - Group 3: MX-derived lookups
      var mxLocalHandler = function(info) {
        if (info) {
          victory(info, 'mx local');
          return null;
        }
        // We didn't know about it locally, ask the ISPDB
        return this._getConfigFromISPDB(mxDomain)
          .catch(coerceRejectionToNull)
          .then(mxISPDBHandler);
      }.bind(this);

      var mxISPDBHandler = function(info) {
        if (info) {
          victory(info, 'mx ispdb');
          return null;
        }
        // The ISPDB didn't know, probe for autodiscovery.  No coercion needed.
        return this._probeForAutodiscover(domain)
          .then(autodiscoverHandler);
      }.bind(this);

      // - Group 4: Autodiscover probing
      var autodiscoverHandler = function(info) {
        // This is either success or we're simply done.
        victory(info, info ? 'autodiscover' : null);
        return null;
      }.bind(this);

      // -- Kick it off.
      this._getConfigFromLocalFile(domain)
        // Coerce the rejection for our then handler's purpose.
        .catch(coerceRejectionToNull)
        .then(localConfigHandler)
        // Register a catch-handler against localConfigHandler and all of the
        // follow-on handlers we associate.  Technically we should never call
        // this, but better safe than sorry.
        .catch(failsafeFailure);
    }.bind(this));
  },

  /**
   * Try to create an account for the user's email address by running through
   * autoconfigure and, if successful, delegating to the appropriate account
   * type.
   *
   * @param universe the MailUniverse object
   * @param userDetails an object containing `emailAddress` and `password`
   *        attributes
   * @param callback a callback taking an error string (if any) and the config
   *        info, formatted as JSON
   */
  tryToCreateAccount: function(universe, userDetails, callback) {
    this.learnAboutAccount(userDetails).then(
      function success(results) {
        // If we found a config and we just need a password, then we're good
        // to go.
        if (results.result === 'need-password') {
          var config = results.configInfo;
          requireConfigurator(config.type, function (mod) {
            mod.configurator.tryToCreateAccount(universe, userDetails, config,
                                                callback);
          });
          return;
        }

        logic(this, 'legacyCreateFail', { result: results.result });
        // need-oauth2 is not supported via this code-path; coerce to a config
        // failure...
        callback('no-config-info');
      }.bind(this),
      function failure(err) {
        callback(err, null, null);
      }.bind(this));
  },
};

/**
 * Recreate an existing account, e.g. after a database upgrade.
 *
 * @param universe the MailUniverse
 * @param oldVersion the old database version, to help with migration
 * @param accountInfo the old account info
 * @param callback a callback to fire when we've completed recreating the
 *        account
 */
function recreateAccount(universe, oldVersion, accountInfo, callback) {
  requireConfigurator(accountInfo.def.type, function (mod) {
    mod.configurator.recreateAccount(universe, oldVersion,
                                     accountInfo, callback);
  });
}
exports.recreateAccount = recreateAccount;

function tryToManuallyCreateAccount(universe, userDetails, domainInfo,
                                    callback) {
  requireConfigurator(domainInfo.type, function (mod) {
    mod.configurator.tryToCreateAccount(universe, userDetails, domainInfo,
                                        callback);
  });
}
exports.tryToManuallyCreateAccount = tryToManuallyCreateAccount;

}); // end define
;
/**
 *
 **/
/*global define, console, window, Blob */
define(
  'mailuniverse',[
    'logic',
    './a64',
    './date',
    './syncbase',
    './worker-router',
    './maildb',
    './cronsync',
    './accountcommon',
    './allback',
    'module',
    'exports'
  ],
  function(
    logic,
    $a64,
    $date,
    $syncbase,
    $router,
    $maildb,
    $cronsync,
    $acctcommon,
    $allback,
    $module,
    exports
  ) {

/**
 * How many operations per account should we track to allow for undo operations?
 * The B2G email app only demands a history of 1 high-level op for undoing, but
 * we are supporting somewhat more for unit tests, potential fancier UIs, and
 * because high-level ops may end up decomposing into multiple lower-level ops
 * someday.
 *
 * This limit obviously is not used to discard operations not yet performed!
 */
var MAX_MUTATIONS_FOR_UNDO = 10;

/**
 * When debug logging is enabled, how long should we store logs in the
 * circular buffer?
 */
var MAX_LOG_BACKLOG_MS = 30000;

/**
 * Creates a method to add to MailUniverse that calls a method
 * on all bridges.
 * @param  {String} bridgeMethod name of bridge method to call
 * @return {Function} function to attach to MailUniverse. Assumes
 * "this" is the MailUniverse instance, and that up to three args
 * are passed to the method.
 */
function makeBridgeFn(bridgeMethod) {
  return function(a1, a2, a3) {
    for (var iBridge = 0; iBridge < this._bridges.length; iBridge++) {
      var bridge = this._bridges[iBridge];
      bridge[bridgeMethod](a1, a2, a3);
    }
  };
}

/**
 * The MailUniverse is the keeper of the database, the root logging instance,
 * and the mail accounts.  It loads the accounts from the database on startup
 * asynchronously, so whoever creates it needs to pass a callback for it to
 * invoke on successful startup.
 *
 * Our concept of mail accounts bundles together both retrieval (IMAP,
 * activesync) and sending (SMTP, activesync) since they really aren't
 * separable and in some cases are basically the same (activesync) or coupled
 * (BURL SMTP pulling from IMAP, which we don't currently do but aspire to).
 *
 * @typedef[ConnInfo @dict[
 *   @key[hostname]
 *   @key[port]
 *   @key[crypto @oneof[
 *     @case[false]{
 *       No encryption; plaintext.
 *     }
 *     @case['starttls']{
 *       Upgrade to TLS after establishing a plaintext connection.  Abort if
 *       the server seems incapable of performing the upgrade.
 *     }
 *     @case[true]{
 *       Establish a TLS connection from the get-go; never use plaintext at all.
 *       By convention this may be referred to as an SSL or SSL/TLS connection.
 *     }
 * ]]
 * @typedef[AccountCredentials @dict[
 *   @key[username String]{
 *     The name we use to identify ourselves to the server.  This will
 *     frequently be the whole e-mail address.  Ex: "joe@example.com" rather
 *     than just "joe".
 *   }
 *   @key[password String]{
 *     The password.  Ideally we would have a keychain mechanism so we wouldn't
 *     need to store it like this.
 *   }
 * ]]
 * @typedef[IdentityDef @dict[
 *   @key[id String]{
 *     Unique identifier resembling folder id's;
 *     "{account id}-{unique value for this account}" is what it looks like.
 *   }
 *   @key[name String]{
 *     Display name, ex: "Joe User".
 *   }
 *   @key[address String]{
 *     E-mail address, ex: "joe@example.com".
 *   }
 *   @key[replyTo @oneof[null String]]{
 *     The e-mail address to put in the "reply-to" header for recipients
 *     to address their replies to.  If null, the header will be omitted.
 *   }
 *   @key[signature @oneof[null String]]{
 *     An optional signature block.  If present, we ensure the body text ends
 *     with a newline by adding one if necessary, append "-- \n", then append
 *     the contents of the signature.  Once we start supporting HTML, we will
 *     need to indicate whether the signature is plaintext or HTML.  For now
 *     it must be plaintext.
 *   }
 * ]]
 * @typedef[UniverseConfig @dict[
 *   @key[nextAccountNum Number]
 *   @key[nextIdentityNum Number]
 *   @key[debugLogging Boolean]{
 *     Has logging been turned on for debug purposes?
 *   }
 * ]]{
 *   The configuration fields stored in the database.
 * }
 * @typedef[AccountDef @dict[
 *   @key[id AccountId]
 *   @key[name String]{
 *     The display name for the account.
 *   }
 *   @key[identities @listof[IdentityDef]]
 *
 *   @key[type @oneof['pop3+smtp' 'imap+smtp' 'activesync']]
 *   @key[receiveType @oneof['pop3' 'imap' 'activesync']]
 *   @key[sendType @oneof['smtp' 'activesync']]
 *   @key[receiveConnInfo ConnInfo]
 *   @key[sendConnInfo ConnInfo]
 * ]]
 * @typedef[MessageNamer @dict[
 *   @key[date DateMS]
 *   @key[suid SUID]
 * ]]{
 *   The information we need to locate a message within our storage.  When the
 *   MailAPI tells the back-end things, it uses this representation.
 * }
 * @typedef[SerializedMutation @dict[
 *   @key[type @oneof[
 *     @case['modtags']{
 *       Modify tags by adding and/or removing them.  Idempotent and atomic
 *       under all implementations; no explicit account saving required.
 *     }
 *     @case['delete']{
 *       Delete a message under the "move to trash" model.  For IMAP, this is
 *       the same as a move operation.
 *     }
 *     @case['move']{
 *       Move message(s) within the same account.  For IMAP, this is neither
 *       atomic or idempotent and requires account state to be checkpointed as
 *       running the operation prior to running it.  Dunno for ActiveSync, but
 *       probably atomic and idempotent.
 *     }
 *     @case['copy']{
 *       NOT YET IMPLEMENTED (no gaia UI requirement).  But will be:
 *       Copy message(s) within the same account.  For IMAP, atomic and
 *       idempotent.
 *     }
 *   ]]{
 *     The implementation opcode used to determine what functions to call.
 *   }
 *   @key[longtermId]{
 *     Unique-ish identifier for the mutation.  Just needs to be unique enough
 *     to not refer to any pending or still undoable-operation.
 *   }
 *   @key[lifecyle @oneof[
 *     @case['do']{
 *       The initial state of an operation; indicates we want to execute the
 *       operation to completion.
 *     }
 *     @case['done']{
 *       The operation completed, it's done!
 *     }
 *     @case['undo']{
 *       We want to undo the operation.
 *     }
 *     @case['undone']{
 *     }
 *     @case['moot']{
 *       Either the local or server operation failed and mooted the operation.
 *     }
 *   ]]{
 *     Tracks the overall desired state and completion state of the operation.
 *     Operations currently cannot be redone after they are undone.  This field
 *     differs from the `localStatus` and `serverStatus` in that they track
 *     what we have done to the local database and the server rather than our
 *     goals.  It is very possible for an operation to have a lifecycle of
 *     'undone' without ever having manipulated the local database or told the
 *     server anything.
 *   }
 *   @key[localStatus @oneof[
 *     @case[null]{
 *       Nothing has happened; no changes have been made to the local database.
 *     }
 *     @case['doing']{
 *       'local_do' is running.  An attempt to undo the operation while in this
 *       state will not interrupt 'local_do', but will enqueue the operation
 *       to run 'local_undo' subsequently.
 *     }
 *     @case['done']{
 *       'local_do' has successfully run to completion.
 *     }
 *     @case['undoing']{
 *       'local_undo' is running.
 *     }
 *     @case['undone']{
 *       'local_undo' has successfully run to completion or we canceled the
 *       operation
 *     }
 *     @case['unknown']{
 *       We're not sure what actually got persisted to disk.  If we start
 *       generating more transactions once we're sure the I/O won't be harmful,
 *       we can remove this state.
 *     }
 *   ]]{
 *     The state of the local mutation effects of this operation.  This used
 *     to be conflated together with `serverStatus` in a single status variable,
 *     but the multiple potential undo transitions once local_do became async
 *     made this infeasible.
 *   }
 *   @key[serverStatus @oneof[
 *     @case[null]{
 *       Nothing has happened; no attempt has been made to talk to the server.
 *     }
 *     @case['check']{
 *       We don't know what has or hasn't happened on the server so we need to
 *       run a check operation before doing anything.
 *     }
 *     @case['checking']{
 *       A check operation is currently being run.
 *     }
 *     @case['doing']{
 *       'do' is currently running.  Invoking `undoMutation` will not attempt to
 *       stop 'do', but will enqueue the operation with a desire of 'undo' to be
 *       run later.
 *     }
 *     @case['done']{
 *       'do' successfully ran to completion.
 *     }
 *     @case['undoing']{
 *       'undo' is currently running.  Invoking `undoMutation` will not attempt
 *       to stop this but will enqueut the operation with a desire of 'do' to be
 *       run later.
 *     }
 *     @case['undone']{
 *       The operation was 'done' and has now been 'undone'.
 *     }
 *     @case['moot']{
 *       The job is no longer relevant; the messages it operates on don't exist,
 *       the target folder doesn't exist, or we failed so many times that we
 *       assume something is fundamentally wrong and the request simply cannot
 *       be executed.
 *     }
 *     @case['n/a']{
 *       The op does not need to be run online.
 *     }
 *   ]]{
 *     The state of the operation on the server.  This is tracked separately
 *     from the `localStatus` to reduce the number of possible states.
 *   }
 *   @key[tryCount Number]{
 *     How many times have we attempted to run this operation.  If we retry an
 *     operation too many times, we eventually will discard it with the
 *     assumption that it's never going to succeed.
 *   }
 *   @key[humanOp String]{
 *     The user friendly opcode where flag manipulations like starring have
 *     their own opcode.
 *   }
 *   @key[messages @listof[MessageNamer]]
 *
 *   @key[folderId #:optional FolderId]{
 *     If this is a move/copy, the target folder
 *   }
 * ]]
 */
function MailUniverse(callAfterBigBang, online, testOptions) {
  /** @listof[Account] */
  this.accounts = [];
  this._accountsById = {};

  /** @listof[IdentityDef] */
  this.identities = [];
  this._identitiesById = {};

  /**
   * @dictof[
   *   @key[AccountID]
   *   @value[@dict[
   *     @key[active Boolean]{
   *       Is there an active operation right now?
   *     }
   *     @key[local @listof[SerializedMutation]]{
   *       Operations to be run for local changes.  This queue is drained with
   *       preference to the `server` queue.  Operations on this list will also
   *       be added to the `server` list.
   *     }
   *     @key[server @listof[SerializedMutation]]{
   *       Operations to be run against the server.
   *     }
   *     @key[deferred @listof[SerializedMutation]]{
   *       Operations that were taken out of either of the above queues because
   *       of a failure where we need to wait some amount of time before
   *       retrying.
   *     }
   *   ]]
   * ]{
   *   Per-account lists of operations to run for local changes (first priority)
   *   and against the server (second priority).  This does not contain
   *   completed operations; those are stored on `MailAccount.mutations` (along
   *   with uncompleted operations!)
   * }
   */
  this._opsByAccount = {};
  // populated by waitForAccountOps, invoked when all ops complete
  this._opCompletionListenersByAccount = {};
  // maps longtermId to a callback that cares. non-persisted.
  this._opCallbacks = {};

  this._bridges = [];

  this._testModeDisablingLocalOps = false;
  /** Fake navigator to use for navigator.onLine checks */
  this._testModeFakeNavigator = (testOptions && testOptions.fakeNavigator) ||
                                null;

  // We used to try and use navigator.connection, but it's not supported on B2G,
  // so we have to use navigator.onLine like suckers.
  this.online = true; // just so we don't cause an offline->online transition
  // Events for online/offline are now pushed into us externally.  They need
  // to be bridged from the main thread anyways, so no point faking the event
  // listener.
  this._onConnectionChange(online);

  // Track the mode of the universe. Values are:
  // 'cron': started up in background to do tasks like sync.
  // 'interactive': at some point during its life, it was used to
  // provide functionality to a user interface. Once it goes
  // 'interactive', it cannot switch back to 'cron'.
  this._mode = 'cron';

  /**
   * A setTimeout handle for when we next dump deferred operations back onto
   * their operation queues.
   */
  this._deferredOpTimeout = null;
  this._boundQueueDeferredOps = this._queueDeferredOps.bind(this);

  this.config = null;
  this._logBacklog = [];
  this.needCanceleAccountAddress = null;

  this._db = new $maildb.MailDB(testOptions);
  this._cronSync = null;
  var self = this;
  this._db.getConfig(function(configObj, accountInfos, lazyCarryover) {
    function setupLogging(config) {

      // To avoid being overly verbose, and to avoid revealing private
      // information in logs (unless we've explicitly enabled it), we censor
      // event details when in secretDebugMode and for console logs.
      function censorLogs() {
        logic.isCensored = true;

        function censorValue(value) {
          if (value && (value.suid || value.srvid)) {
            return {
              date: value.date,
              suid: value.suid,
              srvid: value.srvid
            };
          } else if (value && typeof value === 'object') {
            return value.toString();
          } else {
            return value;
          }
        }

        // We:
        //   - Remove properties starting with an underscore.
        //   - Process one level of Arrays.
        //   - Allow primitives to pass through.
        //   - Objects get stringified unless they are a mail header,
        //     in which case we return just the date/suid/srvid.
        logic.on('censorEvent', function(e) {
          if (logic.isPlainObject(e.details)) {
            for (var key in e.details) {
              var value = e.details[key];
              if (key[0] === '_') {
                delete e.details[key];
              } else if (Array.isArray(value)) {
                // Include one level of arrays.
                e.details[key] = value.map(censorValue);
              } else {
                e.details[key] = censorValue(value);
              }
            }
          }
        });
      }

      if (self.config.debugLogging) {

        if (self.config.debugLogging === 'realtime-dangerous') {
          console.warn('!!!');
          console.warn('!!! REALTIME USER-DATA ENTRAINING LOGGING ENABLED !!!');
          console.warn('!!!');
          console.warn('You are about to see a lot of logs, as they happen!');
          console.warn('They will also be circularly buffered for saving.');
          console.warn('');
          console.warn('These logs will contain SENSITIVE DATA.  The CONTENTS');
          console.warn('OF EMAILS, maybe some PASSWORDS.  This was turned on');
          console.warn('via the secret debug mode UI.  Use it to turn us off:');
          console.warn('https://wiki.mozilla.org/Gaia/Email/SecretDebugMode');
          logic.realtimeLogEverything = true;
        }
        else if (self.config.debugLogging !== 'dangerous') {
          console.warn('GENERAL LOGGING ENABLED!');
          console.warn('(CIRCULAR EVENT LOGGING WITH NON-SENSITIVE DATA)');
          censorLogs();
        }
        else {
          console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          console.warn('DANGEROUS USER-DATA ENTRAINING LOGGING ENABLED !!!');
          console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          console.warn('This means contents of e-mails and passwords if you');
          console.warn('set up a new account.  (The IMAP protocol sanitizes');
          console.warn('passwords, but the bridge logger may not.)');
          console.warn('');
          console.warn('If you forget how to turn us off, see:');
          console.warn('https://wiki.mozilla.org/Gaia/Email/SecretDebugMode');
          console.warn('...................................................');
        }
      } else if (!logic.underTest) {
        censorLogs();

        var NAMESPACES_TO_ALWAYS_LOG = [
          'BrowserBox',
          'SmtpClient',
          'ActivesyncConfigurator',
          'ImapFolderSync',
          'Pop3Prober',
          'Autoconfigurator',
          'DisasterRecovery',
          'ImapClient',
          'ImapJobDriver',
          'Oauth',
          'Pop3FolderSyncer',
          'SmtpProber'
        ];

        // If we don't have debug logging enabled, bail out early by
        // short-circuiting any events that wouldn't be logged anyway.
        logic.on('preprocessEvent', function(e) {
          var eventShouldBeLogged = (
            NAMESPACES_TO_ALWAYS_LOG.indexOf(e.namespace) !== -1 ||
            // The smtp portion uses a namespace of 'Account', but we want it.
            (e.namespace === 'Account' &&
             e.details && e.details.accountType === 'smtp') ||
            // We also want these.
            e.type === 'allOpsCompleted' ||
            e.type === 'mailslice:mutex-released'
          );

          if (!eventShouldBeLogged) {
            e.preventDefault();
          }
        });

        // Then, since only the logs we care about make it this far, we can log
        // all remaining events here.
        logic.on('event', function(e) {
          var obj = e.toJSON();
          console.log('[' + obj.namespace + '] ' + obj.type +
                      '  ' + JSON.stringify(obj.details) + '\n');
        });
      }
    }

    var accountInfo, i;
    var doneCount = 0;
    var accountCount = accountInfos.length;
    if (configObj) {
      self.config = configObj;
      setupLogging();

      logic.defineScope(self, 'MailUniverse');

      if (self.config.debugLogging)
        self._enableCircularLogging();

      logic(self, 'configLoaded',
            { config: self.config, accountInfos: accountInfos });

      function done() {
        doneCount += 1;
        if (doneCount === accountCount) {
          self._initFromConfig();
          callAfterBigBang();
        }
      }

      if (accountCount) {
        for (i = 0; i < accountCount; i++) {
          accountInfo = accountInfos[i];
          self._loadAccount(accountInfo.def, accountInfo.folderInfo,
                            null, done);
        }

        // return since _loadAccount needs to finish before completing
        // the flow in done().
        return;
      }
    }
    else {
      self.config = {
        // We need to put the id in here because our startup query can't
        // efficiently get both the key name and the value, just the values.
        id: 'config',
        nextAccountNum: 0,
        nextIdentityNum: 0,
        debugLogging: lazyCarryover ? lazyCarryover.config.debugLogging : false
      };
      setupLogging();

      logic.defineScope(self, 'MailUniverse');

      if (self.config.debugLogging)
        self._enableCircularLogging();
      self._db.saveConfig(self.config);

      // - Try to re-create any accounts using old account infos.
      if (lazyCarryover) {
        logic(self, 'configMigrating_begin', { lazyCarryover: lazyCarryover });
        var waitingCount = lazyCarryover.accountInfos.length;
        var oldVersion = lazyCarryover.oldVersion;

        var accountRecreated = function(accountInfo, err) {
          logic(self, 'recreateAccount_end',
                { type: accountInfo.type,
                  id: accountInfo.id,
                  error: err });
          // We don't care how they turn out, just that they get a chance
          // to run to completion before we call our bootstrap complete.
          if (--waitingCount === 0) {
            logic(self, 'configMigrating_end');
            this._initFromConfig();
            callAfterBigBang();
          }
        };

        for (i = 0; i < lazyCarryover.accountInfos.length; i++) {
          var accountInfo = lazyCarryover.accountInfos[i];
          logic(this, 'recreateAccount_begin',
                { type: accountInfo.type,
                  id: accountInfo.id,
                  error: null });
          $acctcommon.recreateAccount(
            self, oldVersion, accountInfo,
            accountRecreated.bind(this, accountInfo));
        }
        // Do not let callAfterBigBang get called.
        return;
      }
      else {
        logic(self, 'configCreated', { config: self.config });
      }
    }
    self._initFromConfig();
    callAfterBigBang();
  }.bind(this));
}
exports.MailUniverse = MailUniverse;
MailUniverse.prototype = {
  //////////////////////////////////////////////////////////////////////////////
  // Logging
  _enableCircularLogging: function() {
    this._logBacklog = [];
    logic.on('event', (event) => {
      this._logBacklog.push(event.toJSON());
      // Remove any events we've kept for longer than MAX_LOG_BACKLOG_MS.
      var oldestTimeAllowed = Date.now() - MAX_LOG_BACKLOG_MS;
      while (this._logBacklog.length &&
             this._logBacklog[0].time < oldestTimeAllowed) {
        this._logBacklog.shift();
      }
    });
  },

  createLogBacklogRep: function() {
    return {
      type: 'logic',
      events: this._logBacklog
    };
  },

  dumpLogToDeviceStorage: function() {
    // This reuses the existing registration if one exists.
    var sendMessage = $router.registerCallbackType('devicestorage');
    try {
      var blob = new Blob([JSON.stringify(this.createLogBacklogRep())],
                          {
                            type: 'application/json',
                            endings: 'transparent'
                          });
      var filename = 'gem-log-' + Date.now() + '.json';
      sendMessage('save', ['sdcard', blob, filename], function(success, err, savedFile) {
        if (success)
          console.log('saved log to "sdcard" devicestorage:', savedFile);
        else
          console.error('failed to save log to', filename);

      });
    }
    catch(ex) {
      console.error('Problem dumping log to device storage:', ex,
                    '\n', ex.stack);
    }
  },

  //////////////////////////////////////////////////////////////////////////////
  // Config / Settings

  /**
   * Perform initial initialization based on our configuration.
   */
  _initFromConfig: function() {
    this._cronSync = new $cronsync.CronSync(this);
  },

  /**
   * Return the subset of our configuration that the client can know about.
   */
  exposeConfigForClient: function() {
    // eventually, iterate over a whitelist, but for now, it's easy...
    return {
      debugLogging: this.config.debugLogging
    };
  },

  modifyConfig: function(changes) {
    for (var key in changes) {
      var val = changes[key];
      switch (key) {
        case 'debugLogging':
          break;
        default:
          continue;
      }
      this.config[key] = val;
    }
    this._db.saveConfig(this.config);
    this.__notifyConfig();
  },

  __notifyConfig: function() {
    var config = this.exposeConfigForClient();
    for (var iBridge = 0; iBridge < this._bridges.length; iBridge++) {
      var bridge = this._bridges[iBridge];
      bridge.notifyConfig(config);
    }
  },

  setInteractive: function() {
    this._mode = 'interactive';
  },

  //////////////////////////////////////////////////////////////////////////////
  _onConnectionChange: function(isOnline) {
    var wasOnline = this.online;
    /**
     * Are we online?  AKA do we have actual internet network connectivity.
     * This should ideally be false behind a captive portal.  This might also
     * end up temporarily false if we move to a 2-phase startup process.
     */
    this.online = this._testModeFakeNavigator ?
                    this._testModeFakeNavigator.onLine : isOnline;
    // Knowing when the app thinks it is online/offline is going to be very
    // useful for our console.log debug spew.
    console.log('Email knows that it is:', this.online ? 'online' : 'offline',
                'and previously was:', wasOnline ? 'online' : 'offline');
    /**
     * Do we want to minimize network usage?  Right now, this is the same as
     * metered, but it's conceivable we might also want to set this if the
     * battery is low, we want to avoid stealing network/cpu from other
     * apps, etc.
     *
     * NB: We used to get this from navigator.connection.metered, but we can't
     * depend on that.
     */
    this.minimizeNetworkUsage = true;
    /**
     * Is there a marginal cost to network usage?  This is intended to be used
     * for UI (decision) purposes where we may want to prompt before doing
     * things when bandwidth is metered, but not when the user is on comparably
     * infinite wi-fi.
     *
     * NB: We used to get this from navigator.connection.metered, but we can't
     * depend on that.
     */
    this.networkCostsMoney = true;

    if (!wasOnline && this.online) {
      // - check if we have any pending actions to run and run them if so.
      for (var iAcct = 0; iAcct < this.accounts.length; iAcct++) {
        this._resumeOpProcessingForAccount(this.accounts[iAcct]);
      }
    }
  },

  /**
   * Helper function to wrap calls to account.runOp for local operations; done
   * only for consistency with `_dispatchServerOpForAccount`.
   */
  _dispatchLocalOpForAccount: function(account, op) {
    var queues = this._opsByAccount[account.id];
    queues.active = true;

    var mode;
    switch (op.lifecycle) {
      case 'do':
        mode = 'local_do';
        op.localStatus = 'doing';
        break;
      case 'undo':
        mode = 'local_undo';
        op.localStatus = 'undoing';
        break;
      default:
        throw new Error('Illegal lifecycle state for local op');
    }

    account.runOp(
      op, mode,
      this._localOpCompleted.bind(this, account, op));
  },

  /**
   * Helper function to wrap calls to account.runOp for server operations since
   * it now gets more complex with 'check' mode.
   */
  _dispatchServerOpForAccount: function(account, op) {
    var queues = this._opsByAccount[account.id];
    queues.active = true;

    var mode = op.lifecycle;
    if (op.serverStatus === 'check')
      mode = 'check';
    op.serverStatus = mode + 'ing';

    account.runOp(
      op, mode,
      this._serverOpCompleted.bind(this, account, op));
  },

  /**
   * Start processing ops for an account if it's able and has ops to run.
   */
  _resumeOpProcessingForAccount: function(account) {
    var queues = this._opsByAccount[account.id];
    if (!account.enabled)
      return;
    // Nothing to do if there's a local op running
    if (!queues.local.length &&
        queues.server.length &&
        // (it's possible there is still an active job right now)
        (queues.server[0].serverStatus !== 'doing' &&
         queues.server[0].serverStatus !== 'undoing')) {
      var op = queues.server[0];
      this._dispatchServerOpForAccount(account, op);
    }
  },

  /**
   * Return true if there are server jobs that are currently running or will run
   * imminently.
   *
   * It's possible for this method to be called during the cleanup stage of the
   * last job in the queue.  It was intentionally decided to not try and be
   * clever in that case because the job could want to be immediately
   * rescheduled.  Also, propagating the data to do that turned out to involve a
   * lot of sketchy manual propagation.
   *
   * If you have some logic you want to trigger when the server jobs have
   * all been sufficiently used up, you can use `waitForAccountOps`  or add
   * logic to the account's `allOperationsCompleted` method.
   */
  areServerJobsWaiting: function(account) {
    var queues = this._opsByAccount[account.id];
    if (!queues) {
      return false;
    }
    if (!account.enabled) {
      return false;
    }
    return !!queues.server.length;
  },

  registerBridge: function(mailBridge) {
    this._bridges.push(mailBridge);
  },

  unregisterBridge: function(mailBridge) {
    var idx = this._bridges.indexOf(mailBridge);
    if (idx !== -1)
      this._bridges.splice(idx, 1);
  },

  learnAboutAccount: function(details) {
    var configurator = new $acctcommon.Autoconfigurator();
    return configurator.learnAboutAccount(details);
  },

  checkAndUpdateAccount: function(data, callback) {
    let result = {
      bExist: false,
      type: ''
    };
    for (let i = 0; i < this.accounts.length; i++) {
      let enable = this.accounts[i].accountDef.syncEnable;
      if (data.address.toLowerCase() ===
        this.accounts[i].identities[0].address.toLowerCase() &&
          (data.type === this.accounts[i].accountDef.type || !data.type)) {
        result.bExist = true;
        result.type = this.accounts[i].accountDef.type;
        if (data.autoSetup) {
          let accountDef = this.accounts[i].accountDef;
          if (enable !== data.syncEnable) {
            result.bUpdate = true;
            result.id = this.accounts[i].id;
            accountDef.syncEnable = data.syncEnable;
          }
          if (data.password && accountDef.credentials.password &&
              data.password !== accountDef.credentials.password) {
            accountDef.credentials.password = data.password;
          }
          if (data.oauth2Tokens && accountDef.credentials.oauth2) {
            // Update oauth2 accessToken and expireTimeMS
            if (accountDef.credentials.oauth2.accessToken !==
                data.oauth2Tokens.accessToken) {
              accountDef.credentials.oauth2.accessToken =
                  data.oauth2Tokens.accessToken;
            }
            if (accountDef.credentials.oauth2.expireTimeMS !==
                data.oauth2Tokens.expireTimeMS) {
              accountDef.credentials.oauth2.expireTimeMS =
                  data.oauth2Tokens.expireTimeMS;
            }
          }
          this.saveAccountDef(accountDef, null, () => {
            callback(result);
          });
        } else {
          if (!enable) {
            result.id = this.accounts[i].id;
          }
          callback(result);
        }
        return;
      } else {
        // Update for old created account
        if (enable === undefined) {
          let accountDef = this.accounts[i].accountDef;
          accountDef.syncEnable = true;
          accountDef.public = false;
          this.saveAccountDef(accountDef, null);
        }
      }
    }
    callback(result);
  },

  removeDeletedAccounts: function(emailIds, remove, callback) {
    let bDelete = false;
    for (let i = 0; i < this.accounts.length; i++) {
      let index = emailIds.indexOf(this.accounts[i].identities[0].address);
      if (this.accounts[i].accountDef.public) {
        if (remove) {
          if (index > -1) {
            this.deleteAccount(this.accounts[i].id);
            bDelete = true;
          }
        } else if (index < 0) {
          this.deleteAccount(this.accounts[i].id);
          bDelete = true;
        }
      }
    }
    callback(bDelete);
  },

  tryToCreateAccount: function mu_tryToCreateAccount(userDetails, domainInfo,
                                                     callback) {
    this.resetNeedCancelAccount();
    if (!this.online) {
      callback('offline');
      return;
    }
    if (!userDetails.forceCreate) {
      for (var i = 0; i < this.accounts.length; i++) {
        if (userDetails.emailAddress ===
            this.accounts[i].identities[0].address &&
            this.accounts[i].accountDef.type === domainInfo.type) {
          callback('user-account-exists');
          return;
        }
      }
    }

    if (domainInfo) {
      $acctcommon.tryToManuallyCreateAccount(this, userDetails, domainInfo,
                                             callback);
    }
    else {
      // XXX: store configurator on this object so we can abort the connections
      // if necessary.
      var configurator = new $acctcommon.Autoconfigurator();
      configurator.tryToCreateAccount(this, userDetails, callback);
    }
  },

  setNeedCancelAccount: function(msg) {
    if (msg) {
      this.needCanceleAccountAddress = msg.details;
    }
  },

  getNeedCancelAccount: function() {
    return this.needCanceleAccountAddress;
  },

  resetNeedCancelAccount: function() {
    this.needCanceleAccountAddress = null;
  },

  /**
   * Shutdown the account, forget about it, nuke associated database entries.
   */
  deleteAccount: function(accountId) {
    var savedEx = null;
    var account = this._accountsById[accountId];
    try {
      account.accountDeleted();
    }
    catch (ex) {
      // save the failure until after we have done other cleanup.
      savedEx = ex;
    }
    this._db.deleteAccount(accountId);

    delete this._accountsById[accountId];
    var idx = this.accounts.indexOf(account);
    this.accounts.splice(idx, 1);

    for (var i = 0; i < account.identities.length; i++) {
      var identity = account.identities[i];
      idx = this.identities.indexOf(identity);
      this.identities.splice(idx, 1);
      delete this._identitiesById[identity.id];
    }

    delete this._opsByAccount[accountId];
    delete this._opCompletionListenersByAccount[accountId];

    this.__notifyRemovedAccount(accountId);

    if (savedEx)
      throw savedEx;
  },

  saveAccountDef: function(accountDef, folderInfo, callback) {
    this._db.saveAccountDef(this.config, accountDef, folderInfo, callback);
    var account = this.getAccountForAccountId(accountDef.id);

    // Make sure syncs are still accurate, since syncInterval
    // could have changed.
    if (this._cronSync) {
      this._cronSync.ensureSync();
    }

    // If account exists, notify of modification. However on first
    // save, the account does not exist yet.
    if (account)
      this.__notifyModifiedAccount(account);
  },

  /**
   * Instantiate an account from the persisted representation.
   * Asynchronous. Calls callback with the account object.
   */
  _loadAccount: function mu__loadAccount(accountDef, folderInfo,
                                         receiveProtoConn, callback) {
    $acctcommon.accountTypeToClass(accountDef.type, function (constructor) {
      if (!constructor) {
        logic(this, 'badAccountType', { type: accountDef.type });
        return;
      }
      var account = new constructor(this, accountDef, folderInfo, this._db,
                                    receiveProtoConn);

      this.accounts.push(account);
      this._accountsById[account.id] = account;
      this._opsByAccount[account.id] = {
        active: false,
        local: [],
        server: [],
        deferred: []
      };
      this._opCompletionListenersByAccount[account.id] = null;

      for (var iIdent = 0; iIdent < accountDef.identities.length; iIdent++) {
        var identity = accountDef.identities[iIdent];
        this.identities.push(identity);
        this._identitiesById[identity.id] = identity;
      }

      this.__notifyAddedAccount(account);

      if (account.accountDef.syncEnable) {
        // - issue a (non-persisted) syncFolderList if needed
        var timeSinceLastFolderSync = Date.now() - account.meta.lastFolderSyncAt;
        if (timeSinceLastFolderSync >= $syncbase.SYNC_FOLDER_LIST_EVERY_MS) {
          this.syncFolderList(account);
        }

        // - check for mutations that still need to be processed
        // This will take care of deferred mutations too because they are still
        // maintained in this list.
        for (var i = 0; i < account.mutations.length; i++) {
          var op = account.mutations[i];
          if (op.lifecycle !== 'done' && op.lifecycle !== 'undone' &&
              op.lifecycle !== 'moot') {
            // For localStatus, we currently expect it to be consistent with the
            // state of the folder's database.  We expect this to be true going
            // forward and as we make changes because when we save the account's
            // operation status, we should also be saving the folder changes at
            // the same time.
            //
            // The same cannot be said for serverStatus, so we need to check. See
            // comments about operations elsewhere (currently in imap/jobs.js).
            op.serverStatus = 'check';
            this._queueAccountOp(account, op);
          }
        }
        account.upgradeFolderStoragesIfNeeded();
      }
      callback(account);
    }.bind(this));
  },

  /**
   * Self-reporting by an account that it is experiencing difficulties.
   *
   * We mutate its state for it, and generate a notification if this is a new
   * problem.  For problems that require user action, we additionally generate
   * a bad login notification.
   *
   * @param account
   * @param {string} problem
   * @param {'incoming'|'outgoing'} whichSide
   */
  __reportAccountProblem: function(account, problem, whichSide) {
    var suppress = false;
    // nothing to do if the problem is already known
    if (account.problems.indexOf(problem) !== -1) {
      suppress = true;
    }
    logic(this, 'reportProblem',
          { problem: problem, suppress: suppress, accountId: account.id });
    if (suppress) {
      return;
    }

    account.problems.push(problem);
    account.enabled = false;

    this.__notifyModifiedAccount(account);

    switch (problem) {
      case 'bad-user-or-pass':
      case 'needs-oauth-reauth':
      case 'bad-address':
      case 'imap-disabled':
        this.__notifyBadLogin(account, problem, whichSide);
        break;
    }
  },

  __removeAccountProblem: function(account, problem) {
    var idx = account.problems.indexOf(problem);
    if (idx === -1)
      return;
    account.problems.splice(idx, 1);
    account.enabled = (account.problems.length === 0);

    this.__notifyModifiedAccount(account);

    if (account.enabled)
      this._resumeOpProcessingForAccount(account);
  },

  clearAccountProblems: function(account) {
    logic(this, 'clearAccountProblems', { accountId: account.id });
    // TODO: this would be a great time to have any slices that had stalled
    // syncs do whatever it takes to make them happen again.
    account.enabled = true;
    account.problems = [];
    this._resumeOpProcessingForAccount(account);
  },

  // expects (account, problem, whichSide)
  __notifyBadLogin: makeBridgeFn('notifyBadLogin'),

  // expects (account)
  __notifyAddedAccount: makeBridgeFn('notifyAccountAdded'),

  // expects (account)
  __notifyModifiedAccount: makeBridgeFn('notifyAccountModified'),

  // expects (accountId)
  __notifyRemovedAccount: makeBridgeFn('notifyAccountRemoved'),

  // expects (accountId)
  __notifyResetAccount: makeBridgeFn('notifyAccountReset'),

  // expects (account, folderMeta)
  __notifyAddedFolder: makeBridgeFn('notifyFolderAdded'),

  // expects (account, folderMeta)
  __notifyModifiedFolder: makeBridgeFn('notifyFolderModified'),

  // expects (account, folderMeta)
  __notifyRemovedFolder: makeBridgeFn('notifyFolderRemoved'),

  // expects (suid, detail, body)
  __notifyModifiedBody: makeBridgeFn('notifyBodyModified'),


  //////////////////////////////////////////////////////////////////////////////
  // cronsync Stuff

  // expects (accountIds)
  __notifyStartedCronSync: makeBridgeFn('notifyCronSyncStart'),

  // expects (accountsResults)
  __notifyStoppedCronSync: makeBridgeFn('notifyCronSyncStop'),

  // __notifyBackgroundSendStatus expects {
  //   suid: messageSuid,
  //   accountId: accountId,
  //   sendFailures: (integer),
  //   state: 'pending', 'sending', 'error', 'success', or 'syncDone'
  //   emitNotifications: Boolean,
  //   err: (if applicable),
  //   badAddresses: (if applicable)
  // }
  __notifyBackgroundSendStatus: makeBridgeFn('notifyBackgroundSendStatus'),

  //////////////////////////////////////////////////////////////////////////////
  // Lifetime Stuff

  /**
   * Write the current state of the universe to the database.
   */
  saveUniverseState: function(callback) {
    var curTrans = null;
    var latch = $allback.latch();

    logic(this, 'saveUniverseState_begin');
    for (var iAcct = 0; iAcct < this.accounts.length; iAcct++) {
      var account = this.accounts[iAcct];
      curTrans = account.saveAccountState(curTrans, latch.defer(account.id),
                                          'saveUniverse');
    }
    latch.then(function() {
      logic(this, 'saveUniverseState_end');
      if (callback) {
        callback();
      }
    }.bind(this));
  },

  /**
   * Shutdown all accounts; this is currently for the benefit of unit testing.
   * We expect our app to operate in a crash-only mode of operation where a
   * clean shutdown means we get a heads-up, put ourselves offline, and trigger a
   * state save before we just demand that our page be closed.  That's future
   * work, of course.
   *
   * If a callback is provided, a cleaner shutdown will be performed where we
   * wait for all current IMAP connections to be be shutdown by the server
   * before invoking the callback.
   */
  shutdown: function(callback) {
    var waitCount = this.accounts.length;
    // (only used if a 'callback' is passed)
    function accountShutdownCompleted() {
      if (--waitCount === 0)
        callback();
    }
    for (var iAcct = 0; iAcct < this.accounts.length; iAcct++) {
      var account = this.accounts[iAcct];
      // only need to pass our handler if clean shutdown is desired
      account.shutdown(callback ? accountShutdownCompleted : null);
    }

    if (this._cronSync) {
      this._cronSync.shutdown();
    }
    this._db.close();

    if (!this.accounts.length)
      callback();
  },

  //////////////////////////////////////////////////////////////////////////////
  // Lookups: Account, Folder, Identity

  getAccountForAccountId: function mu_getAccountForAccountId(accountId) {
    return this._accountsById[accountId];
  },

  /**
   * Given a folder-id, get the owning account.
   */
  getAccountForFolderId: function mu_getAccountForFolderId(folderId) {
    var accountId = folderId.substring(0, folderId.indexOf('/')),
        account = this._accountsById[accountId];
    return account;
  },

  /**
   * Given a message's sufficiently unique identifier, get the owning account.
   */
  getAccountForMessageSuid: function mu_getAccountForMessageSuid(messageSuid) {
    var accountId = messageSuid.substring(0, messageSuid.indexOf('/')),
        account = this._accountsById[accountId];
    return account;
  },

  getFolderStorageForFolderId: function mu_getFolderStorageForFolderId(
                                 folderId) {
    var account = this.getAccountForFolderId(folderId);
    return account.getFolderStorageForFolderId(folderId);
  },

  getFolderStorageForMessageSuid: function mu_getFolderStorageForFolderId(
                                    messageSuid) {
    var folderId = messageSuid.substring(0, messageSuid.lastIndexOf('/')),
        account = this.getAccountForFolderId(folderId);
    return account.getFolderStorageForFolderId(folderId);
  },

  getAccountForSenderIdentityId: function mu_getAccountForSenderIdentityId(
                                   identityId) {
    var accountId = identityId.substring(0, identityId.indexOf('/')),
        account = this._accountsById[accountId];
    return account;
  },

  getIdentityForSenderIdentityId: function mu_getIdentityForSenderIdentityId(
                                    identityId) {
    return this._identitiesById[identityId];
  },

  //////////////////////////////////////////////////////////////////////////////
  // Message Mutation and Undoing

  /**
   * Partitions messages by account.  Accounts may want to partition things
   * further, such as by folder, but we leave that up to them since not all
   * may require it.  (Ex: activesync and gmail may be able to do things
   * that way.)
   */
  _partitionMessagesByAccount: function(messageNamers, targetAccountId) {
    var results = [], acctToMsgs = {};

    for (var i = 0; i < messageNamers.length; i++) {
      var messageNamer = messageNamers[i],
          messageSuid = messageNamer.suid,
          accountId = messageSuid.substring(0, messageSuid.indexOf('/'));
      if (!acctToMsgs.hasOwnProperty(accountId)) {
        var messages = [messageNamer];
        results.push({
          account: this._accountsById[accountId],
          messages: messages,
          crossAccount: (targetAccountId && targetAccountId !== accountId),
        });
        acctToMsgs[accountId] = messages;
      }
      else {
        acctToMsgs[accountId].push(messageNamer);
      }
    }

    return results;
  },

  /**
   * Put an operation in the deferred mutations queue and ensure the deferred
   * operation timer is active.  The deferred queue is persisted to disk too
   * and transferred across to the non-deferred queue at account-load time.
   */
  _deferOp: function(account, op) {
    this._opsByAccount[account.id].deferred.push(op.longtermId);
    if (this._deferredOpTimeout !== null)
      this._deferredOpTimeout = window.setTimeout(
        this._boundQueueDeferredOps, $syncbase.DEFERRED_OP_DELAY_MS);
  },

  /**
   * Enqueue all deferred ops; invoked by the setTimeout scheduled by
   * `_deferOp`.  We use a single timeout across all accounts, so the duration
   * of the defer delay can vary a bit, but our goal is just to avoid deferrals
   * turning into a tight loop that pounds the server, nothing fancier.
   */
  _queueDeferredOps: function() {
    this._deferredOpTimeout = null;

    // If not in 'interactive' mode, then this is just a short
    // 'cron' existence that needs to shut down soon. Wait one
    // more cycle in case the app switches over to 'interactive'
    // in the meantime.
    if (this._mode !== 'interactive') {
      console.log('delaying deferred op since mode is ' + this._mode);
      this._deferredOpTimeout = window.setTimeout(
        this._boundQueueDeferredOps, $syncbase.DEFERRED_OP_DELAY_MS);
      return;
    }

    for (var iAccount = 0; iAccount < this.accounts.length; iAccount++) {
      var account = this.accounts[iAccount],
          queues = this._opsByAccount[account.id];
      // we need to mutate in-place, so concat is not an option
      while (queues.deferred.length) {
        var op = queues.deferred.shift();
        // There is no need to enqueue the operation if:
        // - It's already enqueued because someone called undo
        // - Undo got called and that ran to completion
        if (queues.server.indexOf(op) === -1 &&
            op.lifecycle !== 'undo')
          this._queueAccountOp(account, op);
      }
    }
  },

  /**
   * A local op finished; figure out what the error means, perform any requested
   * saves, and *only after the saves complete*, issue any appropriate callback
   * and only then start the next op.
   */
  _localOpCompleted: function(account, op, err, resultIfAny,
                              accountSaveSuggested) {

    var queues = this._opsByAccount[account.id],
        serverQueue = queues.server,
        localQueue = queues.local;

    var removeFromServerQueue = false,
        completeOp = false,
        wasMode = 'local_' + op.localStatus.slice(0, -3);
    if (err) {
      switch (err) {
        // Only defer is currently supported as a recoverable local failure
        // type.
        case 'defer':
          if (++op.tryCount < $syncbase.MAX_OP_TRY_COUNT) {
            logic(this, 'opDeferred', { type: op.type,
                                        longtermId: op.longtermId });
            this._deferOp(account, op);
            removeFromServerQueue = true;
            break;
          }
          // fall-through to an error
        default:
          logic(this, 'opGaveUp', { type: op.type,
                                    longtermId: op.longtermId });
          op.lifecycle = 'moot';
          op.localStatus = 'unknown';
          op.serverStatus = 'moot';
          removeFromServerQueue = true;
          completeOp = true;
          break;
      }

      // Do not save if this was an error.
      accountSaveSuggested = false;
    }
    else {
      switch (op.localStatus) {
        case 'doing':
          op.localStatus = 'done';
          // We have introduced the ability for a local op to decide that it
          // no longer wants a server operation to happen.  It accomplishes this
          // by marking the serverStatus as skip, which we then process and
          // convert to 'n/a'.  This is intended to be done by the local job
          // right before returning so the value doesn't get surfaced elsewhere.
          // Some might ask why this isn't some type of explicit return value.
          // To those people I say, "Good point, shut up."  I might then go on
          // to say that the v3 refactor will likely deal with this and that's
          // real soon.
          if (op.serverStatus === 'skip') {
            removeFromServerQueue = true;
            op.serverStatus = 'n/a';
            accountSaveSuggested = true; // this op change needs a save!
          }
          if (op.serverStatus === 'n/a') {
            op.lifecycle = 'done';
            completeOp = true;
          }
          break;
        case 'undoing':
          op.localStatus = 'undone';
          if (op.serverStatus === 'skip') {
            removeFromServerQueue = true;
            op.serverStatus = 'n/a';
            accountSaveSuggested = true; // this op change needs a save!
          }
          if (op.serverStatus === 'n/a') {
            op.lifecycle = 'undone';
            completeOp = true;
          }
          break;
      }
    }

    if (removeFromServerQueue) {
      var idx = serverQueue.indexOf(op);
      if (idx !== -1)
        serverQueue.splice(idx, 1);
    }
    localQueue.shift();

    console.log('runOp_end(' + wasMode + ': ' +
                JSON.stringify(op).substring(0, 160) + ')\n');
    logic(account, 'runOp_end',
          { mode: wasMode,
            type: op.type,
            error: err,
            op: op });

    // Complete the asynchronous log event pertaining to 'runOp'.
    if (op._logicAsyncEvent) {
      if (err) {
        op._logicAsyncEvent.reject(err);
      } else {
        op._logicAsyncEvent.resolve();
      }
    }

    var callback;
    if (completeOp) {
      if (this._opCallbacks.hasOwnProperty(op.longtermId)) {
        callback = this._opCallbacks[op.longtermId];
        delete this._opCallbacks[op.longtermId];
      }
    }

    if (accountSaveSuggested) {
      account.saveAccountState(
        null,
        this._startNextOp.bind(this, account, callback, op, err, resultIfAny),
        'localOp:' + op.type);
      return;
    }

    this._startNextOp(account, callback, op, err, resultIfAny);
  },

  /**
   * A server op finished; figure out what the error means, perform any
   * requested saves, and *only after the saves complete*, issue any appropriate
   * callback and only then start the next op.
   *
   * @args[
   *   @param[account[
   *   @param[op]{
   *     The operation.
   *   }
   *   @param[err @oneof[
   *     @case[null]{
   *       Success!
   *     }
   *     @case['defer']{
   *       The resource was unavailable, but might be available again in the
   *       future.  Defer the operation to be run in the future by putting it on
   *       a deferred list that will get re-added after an arbitrary timeout.
   *       This does not imply that a check operation needs to be run.  This
   *       reordering violates our general ordering guarantee; we could be
   *       better if we made sure to defer all other operations that can touch
   *       the same resource, but that's pretty complex.
   *
   *       Deferrals do boost the tryCount; our goal with implementing this is
   *       to support very limited
   *     }
   *     @case['aborted-retry']{
   *       The operation was started, but we lost the connection before we
   *       managed to accomplish our goal.  Run a check operation then run the
   *       operation again depending on what 'check' says.
   *
   *       'defer' should be used instead if it's known that no mutations could
   *       have been perceived by the server, etc.
   *     }
   *     @case['failure-give-up']{
   *       Something is broken in a way we don't really understand and it's
   *       unlikely that retrying is actually going to accomplish anything.
   *       Although we mark the status 'moot', this is a more sinister failure
   *       that should generate debugging/support data when appropriate.
   *     }
   *     @case['moot']{
   *       The operation no longer makes any sense.
   *     }
   *     @default{
   *       Some other type of error occurred.  This gets treated the same as
   *       aborted-retry
   *     }
   *   ]]
   *   @param[resultIfAny]{
   *     A result to be relayed to the listening callback for the operation, if
   *     there is one.  This is intended to be used for things like triggering
   *     attachment downloads where it would be silly to make the callback
   *     re-get the changed data itself.
   *   }
   *   @param[accountSaveSuggested #:optional Boolean]{
   *     Used to indicate that this has changed the state of the system and a
   *     save should be performed at some point in the future.
   *   }
   * ]
   */
  _serverOpCompleted: function(account, op, err, resultIfAny,
                               accountSaveSuggested) {
    var queues = this._opsByAccount[account.id];
    if (queues === undefined) {
      return;
    }

    var serverQueue = queues.server,
        localQueue = queues.local;

    var scope = logic.subscope(this, { type: op.type,
                                       longtermId: op.longtermId });

    if (serverQueue[0] !== op)
      logic(scope, 'opInvariantFailure');

    // Should we attempt to retry (but fail if tryCount is reached)?
    var maybeRetry = false;
    // Pop the event off the queue? (avoid bugs versus multiple calls)
    var consumeOp = true;
    // Generate completion notifications for the op?
    var completeOp = true;
    var wasMode = op.serverStatus.slice(0, -3);
    if (err) {
      switch (err) {
        case 'defer':
          if (++op.tryCount < $syncbase.MAX_OP_TRY_COUNT) {
            // Defer the operation if we still want to do the thing, but skip
            // deferring if we are now trying to undo the thing.
            if (op.serverStatus === 'doing' && op.lifecycle === 'do') {
              logic(scope, 'opDeferred');
              this._deferOp(account, op);
            }
            // remove the op from the queue, but don't mark it completed
            completeOp = false;
          }
          else {
            op.lifecycle = 'moot';
            op.serverStatus = 'moot';
          }
          break;
        case 'aborted-retry':
          op.tryCount++;
          maybeRetry = true;
          break;
        default: // (unknown case)
          op.tryCount += $syncbase.OP_UNKNOWN_ERROR_TRY_COUNT_INCREMENT;
          maybeRetry = true;
          break;
        case 'failure-give-up':
          logic(scope, 'opGaveUp');
          // we complete the op, but the error flag is propagated
          op.lifecycle = 'moot';
          op.serverStatus = 'moot';
          break;
        case 'moot':
          logic(scope, 'opMooted');
          // we complete the op, but the error flag is propagated
          op.lifecycle = 'moot';
          op.serverStatus = 'moot';
          break;
      }
    }
    else {
      switch (op.serverStatus) {
        case 'checking':
          // Update the status, and figure out if there is any work to do based
          // on our desire.
          switch (resultIfAny) {
            case 'checked-notyet':
            case 'coherent-notyet':
              op.serverStatus = null;
              break;
            case 'idempotent':
              if (op.lifecycle === 'do' || op.lifecycle === 'done')
                op.serverStatus = null;
              else
                op.serverStatus = 'done';
              break;
            case 'happened':
              op.serverStatus = 'done';
              break;
            case 'moot':
              op.lifecycle = 'moot';
              op.serverStatus = 'moot';
              break;
            // this is the same thing as defer.
            case 'bailed':
              logic(scope, 'opDeferred');
              this._deferOp(account, op);
              completeOp = false;
              break;
          }
          break;
        case 'doing':
          op.serverStatus = 'done';
          // lifecycle may have changed to 'undo'; don't mutate if so
          if (op.lifecycle === 'do')
            op.lifecycle = 'done';
          break;
        case 'undoing':
          op.serverStatus = 'undone';
          // this will always be true until we gain 'redo' functionality
          if (op.lifecycle === 'undo')
            op.lifecycle = 'undone';
          break;
      }
      // If we still want to do something, then don't consume the op.
      if (op.lifecycle === 'do' || op.lifecycle === 'undo')
        consumeOp = false;
    }

    if (maybeRetry) {
      if (op.tryCount < $syncbase.MAX_OP_TRY_COUNT) {
        // We're still good to try again, but we will need to check the status
        // first.
        op.serverStatus = 'check';
        consumeOp = false;
      }
      else {
        logic(scope, 'opTryLimitReached');
        // we complete the op, but the error flag is propagated
        op.lifecycle = 'moot';
        op.serverStatus = 'moot';
      }
    }

    if (consumeOp)
      serverQueue.shift();

    console.log('runOp_end(' + wasMode + ': ' +
                JSON.stringify(op).substring(0, 160) + ')\n');
    logic(account, 'runOp_end', { mode: wasMode,
                                  type: op.type,
                                  error: err,
                                  op: op });

    // Complete the asynchronous log event pertaining to 'runOp'.
    if (op._logicAsyncEvent) {
      if (err) {
        op._logicAsyncEvent.reject(err);
      } else {
        op._logicAsyncEvent.resolve();
      }
    }

    // Some completeOp callbacks want to wait for account
    // save but they are triggered before save is attempted,
    // for the account to properly trigger runAfterSaves
    // callbacks, so set a flag indicating save state here.
    if (accountSaveSuggested)
      account._saveAccountIsImminent = true;

    var callback;
    if (completeOp) {
      if (this._opCallbacks.hasOwnProperty(op.longtermId)) {
        callback = this._opCallbacks[op.longtermId];
        delete this._opCallbacks[op.longtermId];
      }

      // This is a suggestion; in the event of high-throughput on operations,
      // we probably don't want to save the account every tick, etc.
      if (accountSaveSuggested) {
        account._saveAccountIsImminent = false;
        account.saveAccountState(
          null,
          this._startNextOp.bind(this, account, callback, op, err, resultIfAny),
          'serverOp:' + op.type);
        return;
      }
    }

    this._startNextOp(account, callback, op, err, resultIfAny);
  },

  /**
   * Shared code for _localOpCompleted and _serverOpCompleted to figure out what
   * to do next *after* any account save has completed, including invoking
   * callbacks.  See bug https://bugzil.la/1039007 for rationale as to why we
   * think it makes sense to defer the callbacks or to provide new reasons why
   * we should change this behaviour.
   *
   * It used to be that we would trigger saves without waiting for them to
   * complete with the theory that this would allow us to generally be more
   * efficient without losing correctness since the IndexedDB transaction model
   * is strong and takes care of data dependency issues for us.  However, for
   * both testing purposes and with some new concerns over correctness issues,
   * it's now making sense to wait on the transaction to commit.  There are
   * potentially some memory-use wins from waiting for the transaction to
   * complete, especially if we imagine some particularly pathological
   * situations.
   *
   * @param account
   * @param {Function} [callback]
   *   The callback associated with the last operation.  May be omitted.  If
   *    provided then all of the following arguments must also be provided.
   * @param [lastOp]
   * @param [err]
   * @param [result]
   */
  _startNextOp: function(account, callback, lastOp, err, result) {
    var queues = this._opsByAccount[account.id],
        serverQueue = queues.server,
        localQueue = queues.local;
    var op;
    let isCalled = false;

    if (callback) {
      try {
        isCalled = true;
        callback(err, result, account, lastOp);
      }
      catch(ex) {
        console.log(ex.message, ex.stack);
        logic(this, 'opCallbackErr', { type: lastOp.type });
      }
    }

    // We must hold off on freeing up queue.active until after we have
    // completed processing and called the callback, just as we do in
    // _localOpCompleted. This allows `callback` to safely schedule
    // new jobs without interfering with the scheduling we're going to
    // do immediately below.
    queues.active = false;
    if (localQueue.length) {
      op = localQueue[0];
      this._dispatchLocalOpForAccount(account, op);
    }
    else if (serverQueue.length) {
      op = serverQueue[0];
      if (this.online && account.enabled) {
        this._dispatchServerOpForAccount(account, op);
      } else {
        let offlineCallback = this._opCallbacks[lastOp.longtermId];
        if (!isCalled) {
          offlineCallback && offlineCallback('offline', null, account, lastOp);
        }
      }
    }
    // We finished all the operations!  Woo!
    else {
      // Notify listeners
      if (this._opCompletionListenersByAccount[account.id]) {
        this._opCompletionListenersByAccount[account.id](account);
        this._opCompletionListenersByAccount[account.id] = null;
      }
      logic(this, 'allOpsCompleted', { accountId: account.id });


      // - Tell the account so it can clean-up its connections, etc.
      // (We do this after notifying listeners for the connection cleanup case
      // so that if the listener wants to schedule new activity, it can do so
      // without having to wastefully establish a new connection.)
      account.allOperationsCompleted();
    }
  },

  /**
   * Enqueue an operation for processing.  The local mutation is enqueued if it
   * has not yet been run.  The server piece is always enqueued.
   *
   * @args[
   *   @param[account]
   *   @param[op SerializedMutation]{
   *     Note that a `null` longtermId should be passed in if the operation
   *     should be persisted, and a 'session' string if the operation should
   *     not be persisted.  In both cases, a longtermId will be allocated,
   *   }
   *   @param[optionalCallback #:optional Function]{
   *     A callback to invoke when the operation completes.  Callbacks are
   *     obviously not capable of being persisted and are merely best effort.
   *   }
   * ]
   */
  _queueAccountOp: function(account, op, optionalCallback) {
    var queues = this._opsByAccount[account.id];
    // Log the op for debugging assistance
    // TODO: Create a real logger event; this will require updating existing
    // tests and so is not sufficiently trivial to do at this time.
    console.log('queueOp', account.id, op.type, 'pre-queues:',
                'local:', queues.local.length, 'server:', queues.server.length);
    // - Name the op, register callbacks
    if (op.longtermId === null) {
      // mutation job must be persisted until completed otherwise bad thing
      // will happen.
      op.longtermId = account.id + '/' +
                        $a64.encodeInt(account.meta.nextMutationNum++);
      account.mutations.push(op);
      // Clear out any completed/dead operations that put us over the undo
      // threshold.
      while (account.mutations.length > MAX_MUTATIONS_FOR_UNDO &&
             (account.mutations[0].lifecycle === 'done') ||
             (account.mutations[0].lifecycle === 'undone') ||
             (account.mutations[0].lifecycle === 'moot')) {
        account.mutations.shift();
      }
    }
    else if (op.longtermId === 'session') {
      op.longtermId = account.id + '/' +
                        $a64.encodeInt(account.meta.nextMutationNum++);
    }

    if (optionalCallback)
      this._opCallbacks[op.longtermId] = optionalCallback;



    // - Enqueue
    // Local processing needs to happen if we're not in the right local state.
    if (!this._testModeDisablingLocalOps &&
        ((op.lifecycle === 'do' && op.localStatus === null) ||
         (op.lifecycle === 'undo' && op.localStatus !== 'undone' &&
          op.localStatus !== 'unknown')))
      queues.local.push(op);
    if (op.serverStatus !== 'n/a' && op.serverStatus !== 'moot')
      queues.server.push(op);

    // If there is already something active, don't do anything!
    if (queues.active) {
    }
    else if (queues.local.length) {
      // Only actually dispatch if there is only the op we just (maybe).
      if (queues.local.length === 1 && queues.local[0] === op)
        this._dispatchLocalOpForAccount(account, op);
      // else: we grabbed control flow to avoid the server queue running
    }
    else if (queues.server.length === 1 && queues.server[0] === op &&
             this.online && account.enabled) {
      this._dispatchServerOpForAccount(account, op);
    }

    return op.longtermId;
  },

  waitForAccountOps: function(account, callback) {
    var queues = this._opsByAccount[account.id];
    if (!queues.active &&
        queues.local.length === 0 &&
        (queues.server.length === 0 || !this.online || !account.enabled))
      callback();
    else
      this._opCompletionListenersByAccount[account.id] = callback;
  },

  syncFolderList: function(account, callback) {
    this._queueAccountOp(
      account,
      {
        type: 'syncFolderList',
        longtermId: 'session',
        lifecycle: 'do',
        localStatus: 'done',
        serverStatus: null,
        tryCount: 0,
        humanOp: 'syncFolderList'
      },
      callback);
  },

  /**
   * Schedule a purge of the excess messages from the given folder.  This
   * currently only makes sense for IMAP accounts and will automatically be
   * called by the FolderStorage and its owning account when a sufficient
   * number of blocks have been allocated by the storage.
   */
  purgeExcessMessages: function(account, folderId, callback) {
    this._queueAccountOp(
      account,
      {
        type: 'purgeExcessMessages',
        longtermId: 'session',
        lifecycle: 'do',
        localStatus: null,
        serverStatus: 'n/a',
        tryCount: 0,
        humanOp: 'purgeExcessMessages',
        folderId: folderId
      },
      callback);
  },

  /**
   * Download entire bodyRep(s) representation.
   */
  downloadMessageBodyReps: function(suid, date, callback) {
    var account = this.getAccountForMessageSuid(suid);
    this._queueAccountOp(
      account,
      {
        type: 'downloadBodyReps',
        longtermId: 'session',
        lifecycle: 'do',
        localStatus: 'done',
        serverStatus: null,
        tryCount: 0,
        humanOp: 'downloadBodyReps',
        messageSuid: suid,
        messageDate: date
      },
      callback
    );
  },

  downloadBodies: function(messages, options, callback) {
    if (typeof(options) === 'function') {
      callback = options;
      options = null;
    }

    var self = this;
    var pending = 0;

    function next() {
      if (!--pending) {
        callback();
      }
    }
    this._partitionMessagesByAccount(messages, null).forEach(function(x) {
      pending++;
      self._queueAccountOp(
        x.account,
        {
          type: 'downloadBodies',
          longtermId: 'session', // don't persist this job.
          lifecycle: 'do',
          localStatus: 'done',
          serverStatus: null,
          tryCount: 0,
          humanOp: 'downloadBodies',
          messages: x.messages,
          options: options
        },
        next
      );
    });
  },

  /**
   * Download one or more related-part or attachments from a message.
   * Attachments are named by their index because the indices are stable and
   * flinging around non-authoritative copies of the structures might lead to
   * some (minor) confusion.
   *
   * This request is persistent although the callback will obviously be
   * discarded in the event the app is killed.
   *
   * @param {String[]} relPartIndices
   *     The part identifiers of any related parts to be saved to IndexedDB.
   * @param {String[]} attachmentIndices
   *     The part identifiers of any attachment parts to be saved to
   *     DeviceStorage.  For each entry in this array there should be a
   *     corresponding boolean in registerWithDownloadManager.
   * @param {Boolean[]} registerAttachments
   *     An array of booleans corresponding to each entry in attachmentIndices
   *     indicating whether the download should be registered with the download
   *     manager.
   */
  downloadMessageAttachments: function(messageSuid, messageDate,
                                       relPartIndices, attachmentIndices,
                                       registerAttachments,
                                       callback) {
    var account = this.getAccountForMessageSuid(messageSuid);
    var longtermId = this._queueAccountOp(
      account,
      {
        type: 'download',
        longtermId: null,
        lifecycle: 'do',
        localStatus: null,
        serverStatus: null,
        tryCount: 0,
        humanOp: 'download',
        messageSuid: messageSuid,
        messageDate: messageDate,
        relPartIndices: relPartIndices,
        attachmentIndices: attachmentIndices,
        registerAttachments: registerAttachments
      },
      callback);
  },

  modifyMessageTags: function(humanOp, messageSuids, addTags, removeTags) {
    var self = this, longtermIds = [];
    this._partitionMessagesByAccount(messageSuids, null).forEach(function(x) {
      var longtermId = self._queueAccountOp(
        x.account,
        {
          type: 'modtags',
          longtermId: null,
          lifecycle: 'do',
          localStatus: null,
          serverStatus: null,
          tryCount: 0,
          humanOp: humanOp,
          messages: x.messages,
          addTags: addTags,
          removeTags: removeTags,
          // how many messages have had their tags changed already.
          progress: 0,
        });
      longtermIds.push(longtermId);
    });
    return longtermIds;
  },

  moveMessages: function(messageSuids, targetFolderId, callback) {
    var self = this, longtermIds = [],
        targetFolderAccount = this.getAccountForFolderId(targetFolderId);
    var latch = $allback.latch();
    this._partitionMessagesByAccount(messageSuids, null).forEach(function(x, i) {
      // TODO: implement cross-account moves and then remove this constraint
      // and instead schedule the cross-account move.
      if (x.account !== targetFolderAccount)
        throw new Error('cross-account moves not currently supported!');

      // If the move is entirely local-only (i.e. folders that will
      // never be synced to the server), we don't need to run the
      // server side of the job.
      //
      // When we're moving a message between an outbox and
      // localdrafts, we need the operation to succeed even if we're
      // offline, and we also need to receive the "moveMap" returned
      // by the local side of the operation, so that the client can
      // call "editAsDraft" on the moved message.
      //
      // TODO: When we have server-side 'draft' folder support, we
      // actually still want to run the server side of the operation,
      // but we won't want to wait for it to complete. Maybe modify
      // the job system to pass back localResult and serverResult
      // independently, or restructure the way we move outbox messages
      // back to the drafts folder.
      var targetStorage =
            targetFolderAccount.getFolderStorageForFolderId(targetFolderId);

      // If any of the sourceStorages (or targetStorage) is not
      // local-only, we can stop looking.
      var isLocalOnly = targetStorage.isLocalOnly;
      for (var j = 0; j < x.messages.length && isLocalOnly; j++) {
        var sourceStorage =
              self.getFolderStorageForMessageSuid(x.messages[j].suid);
        if (!sourceStorage.isLocalOnly) {
          isLocalOnly = false;
        }
      }

      var longtermId = self._queueAccountOp(
        x.account,
        {
          type: 'move',
          longtermId: null,
          lifecycle: 'do',
          localStatus: null,
          serverStatus: isLocalOnly ? 'n/a' : null,
          tryCount: 0,
          humanOp: 'move',
          messages: x.messages,
          targetFolder: targetFolderId,
        }, latch.defer(i));
      longtermIds.push(longtermId);
    });

    // When the moves finish, they'll each pass back results of the
    // form [err, moveMap]. The moveMaps provide a mapping of
    // sourceSuid => targetSuid, allowing the client to point itself
    // to the moved messages. Since multiple moves would result in
    // multiple moveMap results, we combine them here into a single
    // result map.
    latch.then(function(results) {
      // results === [[err, moveMap], [err, moveMap], ...]
      var combinedMoveMap = {};
      for (var key in results) {
        var moveMap = results[key][1];
        for (var k in moveMap) {
          combinedMoveMap[k] = moveMap[k];
        }
      }
      callback && callback(/* err = */ null, /* result = */ combinedMoveMap);
    });
    return longtermIds;
  },

  deleteMessages: function(messageSuids) {
    var self = this, longtermIds = [];
    this._partitionMessagesByAccount(messageSuids, null).forEach(function(x) {
      var longtermId = self._queueAccountOp(
        x.account,
        {
          type: 'delete',
          longtermId: null,
          lifecycle: 'do',
          localStatus: null,
          serverStatus: null,
          tryCount: 0,
          humanOp: 'delete',
          messages: x.messages
        });
      longtermIds.push(longtermId);
    });
    return longtermIds;
  },

  /**
   * APPEND messages to an IMAP server without locally saving the messages.
   * This was originally an IMAP testing operation that was co-opted to be
   * used for saving sent messages in a corner-cutting fashion.  (The right
   * thing for us to do would be to save the message locally too and deal with
   * the UID implications.  But that is tricky.)
   *
   * See ImapAccount.saveSentMessage for more context.
   *
   * POP3's variation on this is saveSentDraft
   */
  appendMessages: function(folderId, messages, callback) {
    var account = this.getAccountForFolderId(folderId);
    var longtermId = this._queueAccountOp(
      account,
      {
        type: 'append',
        // Don't persist.  See ImapAccount.saveSentMessage for our rationale.
        longtermId: 'session',
        lifecycle: 'do',
        localStatus: 'done',
        serverStatus: null,
        tryCount: 0,
        humanOp: 'append',
        messages: messages,
        folderId: folderId,
      },
      callback);
    return [longtermId];
  },

  /**
   * Save a sent POP3 message to the account's "sent" folder.  See
   * Pop3Account.saveSentMessage for more information.
   *
   * IMAP's variation on this is appendMessages.
   *
   * @param folderId {FolderID}
   * @param sentSafeHeader {HeaderInfo}
   *   The header ready to be added to the sent folder; suid issued and
   *   everything.
   * @param sentSafeBody {BodyInfo}
   *   The body ready to be added to the sent folder; attachment blobs stripped.
   * @param callback {function(err)}
   */
  saveSentDraft: function(folderId, sentSafeHeader, sentSafeBody, callback) {
    var account = this.getAccountForMessageSuid(sentSafeHeader.suid);
    var longtermId = this._queueAccountOp(
      account,
      {
        type: 'saveSentDraft',
        // we can persist this since we have stripped the blobs
        longtermId: null,
        lifecycle: 'do',
        localStatus: null,
        serverStatus: 'n/a',
        tryCount: 0,
        humanOp: 'saveSentDraft',
        folderId: folderId,
        headerInfo: sentSafeHeader,
        bodyInfo: sentSafeBody
      },
      callback);
    return [longtermId];
  },

  /**
   * Process the given attachment blob in slices into base64-encoded Blobs
   * that we store in IndexedDB (currently).  This is a local-only operation.
   *
   * This function is implemented as a job/operation so it is inherently ordered
   * relative to other draft-related calls.  But do keep in mind that you need
   * to make sure to not destroy the underlying storage for the Blob (ex: when
   * using DeviceStorage) until the callback has fired.
   */
  attachBlobToDraft: function(account, existingNamer, attachmentDef, callback) {
    this._queueAccountOp(
      account,
      {
        type: 'attachBlobToDraft',
        // We don't persist the operation to disk in order to avoid having the
        // Blob we are attaching get persisted to IndexedDB.  Better for the
        // disk I/O to be ours from the base64 encoded writes we do even if
        // there is a few seconds of data-loss-ish vulnerability.
        longtermId: 'session',
        lifecycle: 'do',
        localStatus: null,
        serverStatus: 'n/a', // local-only currently
        tryCount: 0,
        humanOp: 'attachBlobToDraft',
        existingNamer: existingNamer,
        attachmentDef: attachmentDef
      },
      callback
    );
  },

  /**
   * Remove an attachment from a draft.  This will not interrupt an active
   * attaching operation or moot a pending one.  This is a local-only operation.
   */
  detachAttachmentFromDraft: function(account, existingNamer, attachmentIndex,
                                      callback) {
    this._queueAccountOp(
      account,
      {
        type: 'detachAttachmentFromDraft',
        // This is currently non-persisted for symmetry with attachBlobToDraft
        // but could be persisted if we wanted.
        longtermId: 'session',
        lifecycle: 'do',
        localStatus: null,
        serverStatus: 'n/a', // local-only currently
        tryCount: 0,
        humanOp: 'detachAttachmentFromDraft',
        existingNamer: existingNamer,
        attachmentIndex: attachmentIndex
      },
      callback
    );
  },

  /**
   * Save a new (local) draft or update an existing (local) draft.  A new namer
   * is synchronously created and returned which will be the name for the draft
   * assuming the save completes successfully.
   *
   * This function is implemented as a job/operation so it is inherently ordered
   * relative to other draft-related calls.
   *
   * @method saveDraft
   * @param account
   * @param [existingNamer] {MessageNamer}
   * @param draftRep
   * @param callback {Function}
   * @return {MessageNamer}
   *
   */
  saveDraft: function(account, existingNamer, draftRep, callback) {
    var draftsFolderMeta = account.getFirstFolderWithType('localdrafts');
    var draftsFolderStorage = account.getFolderStorageForFolderId(
                                draftsFolderMeta.id);
    var newId = draftsFolderStorage._issueNewHeaderId();
    var newDraftInfo = {
      id: newId,
      suid: draftsFolderStorage.folderId + '/' + newId,
      // There are really 3 possible values we could use for this; when the
      // front-end initiates the draft saving, when we, the back-end observe and
      // enqueue the request (now), or when the draft actually gets saved to
      // disk.
      //
      // This value does get surfaced to the user, so we ideally want it to
      // occur within a few seconds of when the save is initiated.  We do this
      // here right now because we have access to $date, and we should generally
      // be timely about receiving messages.
      date: $date.NOW(),
    };
    this._queueAccountOp(
      account,
      {
        type: 'saveDraft',
        longtermId: null,
        lifecycle: 'do',
        localStatus: null,
        serverStatus: 'n/a', // local-only currently
        tryCount: 0,
        humanOp: 'saveDraft',
        existingNamer: existingNamer,
        newDraftInfo: newDraftInfo,
        draftRep: draftRep,
      },
      callback
    );
    return {
      suid: newDraftInfo.suid,
      date: newDraftInfo.date
    };
  },

  /**
   * Kick off a job to send pending outgoing messages. See the job
   * documentation regarding "sendOutboxMessages" for more details.
   *
   * @param {MailAccount} account
   * @param {MessageNamer} opts.beforeMessage
   *   If provided, start with the first message older than this one.
   *   (This is only used internally within the job itself.)
   * @param {string} opts.reason
   *   Optional description, used for debugging.
   * @param {Boolean} opts.emitNotifications
   *   True to pass along send status notifications to the model.
   */
  sendOutboxMessages: function(account, opts, callback) {
    opts = opts || {};

    console.log('outbox: sendOutboxMessages(', JSON.stringify(opts), ')');

    // If we are not online, we won't actually kick off a job until we
    // come back online. Immediately fire a status notification
    // indicating that we are done attempting to sync for now.
    if (!this.online) {
      this.notifyOutboxSyncDone(account);
      // Fall through; we still want to queue the op.
    }

    // Do not attempt to check if the outbox is empty here. This op is
    // queued immediately after the client moves a message to the
    // outbox. The outbox may be empty here, but it might be filled
    // when the op runs.
    this._queueAccountOp(
      account,
      {
        type: 'sendOutboxMessages',
        longtermId: 'session', // Does not need to be persisted.
        lifecycle: 'do',
        localStatus: 'n/a',
        serverStatus: null,
        tryCount: 0,
        beforeMessage: opts.beforeMessage,
        emitNotifications: opts.emitNotifications,
        humanOp: 'sendOutboxMessages'
      },
      callback);
  },

  /**
   * Dispatch a notification to the frontend, indicating that we're
   * done trying to send messages from the outbox for now.
   */
  notifyOutboxSyncDone: function(account) {
    this.__notifyBackgroundSendStatus({
      accountId: account.id,
      state: 'syncDone'
    });
  },

  /**
   * Enable or disable Outbox syncing temporarily. For instance, you
   * will want to disable outbox syncing if the user is in "edit mode"
   * for the list of messages in the outbox folder. This setting does
   * not persist.
   */
  setOutboxSyncEnabled: function(account, enabled, callback) {
    this._queueAccountOp(
      account,
      {
        type: 'setOutboxSyncEnabled',
        longtermId: 'session', // Does not need to be persisted.
        lifecycle: 'do',
        localStatus: null,
        serverStatus: 'n/a', // Local-only.
        outboxSyncEnabled: enabled,
        tryCount: 0,
        humanOp: 'setOutboxSyncEnabled'
      },
      callback);
  },

  /**
   * Delete an existing (local) draft.
   *
   * This function is implemented as a job/operation so it is inherently ordered
   * relative to other draft-related calls.
   */
  deleteDraft: function(account, messageNamer, callback) {
    this._queueAccountOp(
      account,
      {
        type: 'deleteDraft',
        longtermId: null,
        lifecycle: 'do',
        localStatus: null,
        serverStatus: 'n/a', // local-only currently
        tryCount: 0,
        humanOp: 'deleteDraft',
        messageNamer: messageNamer
      },
      callback
    );

  },

  /**
   * Create a folder that is the child/descendant of the given parent folder.
   * If no parent folder id is provided, we attempt to create a root folder,
   * but honoring the server's configured personal namespace if applicable.
   *
   * @param [AccountId] accountId
   * @param {String} [parentFolderId]
   *   If null, place the folder at the top-level, otherwise place it under
   *   the given folder.
   * @param {String} folderName
   *   The (unencoded) name of the folder to be created.
   * @param {String} folderType
   *   The gelam folder type we should think of this folder as.  On servers
   *   supporting SPECIAL-USE we will attempt to set the metadata server-side
   *   as well.
   * @param {Boolean} containOtherFolders
   *   Should this folder only contain other folders (and no messages)?
   *   On some servers/backends, mail-bearing folders may not be able to
   *   create sub-folders, in which case one would have to pass this.
   * @param {Function(err, folderMeta)} callback
   *   A callback that gets called with the folderMeta of the successfully
   *   created folder or null if there was an error.  (The error code is also
   *   provided as the first argument.)
   * ]
   */
  createFolder: function(accountId, parentFolderId, folderName, folderType,
                         containOtherFolders, callback) {
    var account = this.getAccountForAccountId(accountId);
    var longtermId = this._queueAccountOp(
      account,
      {
        type: 'createFolder',
        longtermId: null,
        lifecycle: 'do',
        localStatus: null,
        serverStatus: null,
        tryCount: 0,
        humanOp: 'createFolder',
        parentFolderId: parentFolderId,
        folderName: folderName,
        folderType: folderType,
        containOtherFolders: containOtherFolders
      },
      callback);
    return [longtermId];
  },

  /**
   * Idempotently trigger the undo logic for the performed operation.  Calling
   * undo on an operation that is already undone/slated for undo has no effect.
   */
  undoMutation: function(longtermIds) {
    for (var i = 0; i < longtermIds.length; i++) {
      var longtermId = longtermIds[i],
          account = this.getAccountForFolderId(longtermId), // (it's fine)
          queues = this._opsByAccount[account.id];

      for (var iOp = 0; iOp < account.mutations.length; iOp++) {
        var op = account.mutations[iOp];
        if (op.longtermId === longtermId) {
          // There is nothing to do if we have already processed the request or
          // or the op has already been fully undone.
          if (op.lifecycle === 'undo' || op.lifecycle === 'undone') {
            continue;
          }

          // Queue an undo operation if we're already done.
          if (op.lifecycle === 'done') {
            op.lifecycle = 'undo';
            this._queueAccountOp(account, op);
            continue;
          }
          // else op.lifecycle === 'do'

          // If we have not yet started processing the operation, we can
          // simply remove the operation from the local queue.
          var idx = queues.local.indexOf(op);
          if (idx !== -1) {
              op.lifecycle = 'undone';
              queues.local.splice(idx, 1);
              continue;
          }
          // (the operation must have already been run locally, which means
          // that at the very least we need to local_undo, so queue it.)

          op.lifecycle = 'undo';
          this._queueAccountOp(account, op);
        }
      }
    }
  },

  /**
   * Trigger the necessary folder upgrade logic
   */
  performFolderUpgrade: function(folderId, callback) {
    var account = this.getAccountForFolderId(folderId);
    this._queueAccountOp(
      account,
      {
        type: 'upgradeDB',
        longtermId: 'session',
        lifecycle: 'do',
        localStatus: null,
        serverStatus: 'n/a',
        tryCount: 0,
        humanOp: 'append',
        folderId: folderId
      },
      callback
    );
  }

  //////////////////////////////////////////////////////////////////////////////
};

}); // end define
;
define(
  'worker-setup',[
    './worker-router',
    './mailbridge',
    'logic',
    './mailuniverse',
    'exports'
  ],
  function(
    $router,
    $mailbridge,
    logic,
    $mailuniverse,
    exports
  ) {


var routerBridgeMaker = $router.registerInstanceType('bridge');

var bridgeUniqueIdentifier = 0;
function createBridgePair(universe) {
  var uid = bridgeUniqueIdentifier++;

  var TMB = new $mailbridge.MailBridge(universe);
  var routerInfo = routerBridgeMaker.register(function(data) {
    TMB.__receiveMessage(data.msg);
  });
  var sendMessage = routerInfo.sendMessage;

  TMB.__sendMessage = function(msg) {
    logic(TMB, 'send', { type: msg.type, msg: msg });
    sendMessage(null, msg);
  };

  // Let's say hello to the main thread in order to generate a
  // corresponding mailAPI.
  TMB.__sendMessage({
    type: 'hello',
    config: universe.exposeConfigForClient()
  });
}

var universe = null;

function onUniverse() {
  createBridgePair(universe);
  console.log("Mail universe/bridge created and notified!");
}

var sendControl = $router.registerSimple('control', function(data) {
  var args = data.args;
  switch (data.cmd) {
    case 'hello':
      universe = new $mailuniverse.MailUniverse(onUniverse, args[0]);
      break;

    case 'online':
    case 'offline':
      universe._onConnectionChange(args[0]);
      break;
  }
});
sendControl('hello');

////////////////////////////////////////////////////////////////////////////////

});

(function (root, factory) {
    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.
    if (typeof define === 'function' && define.amd) {
        define('bleach/css-parser/tokenizer',['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory(root);
    }
}(this, function (exports) {

var between = function (num, first, last) { return num >= first && num <= last; }
function digit(code) { return between(code, 0x30,0x39); }
function hexdigit(code) { return digit(code) || between(code, 0x41,0x46) || between(code, 0x61,0x66); }
function uppercaseletter(code) { return between(code, 0x41,0x5a); }
function lowercaseletter(code) { return between(code, 0x61,0x7a); }
function letter(code) { return uppercaseletter(code) || lowercaseletter(code); }
function nonascii(code) { return code >= 0xa0; }
function namestartchar(code) { return letter(code) || nonascii(code) || code == 0x5f; }
function namechar(code) { return namestartchar(code) || digit(code) || code == 0x2d; }
function nonprintable(code) { return between(code, 0,8) || between(code, 0xe,0x1f) || between(code, 0x7f,0x9f); }
function newline(code) { return code == 0xa || code == 0xc; }
function whitespace(code) { return newline(code) || code == 9 || code == 0x20; }
function badescape(code) { return newline(code) || isNaN(code); }

// Note: I'm not yet acting smart enough to actually handle astral characters.
var maximumallowedcodepoint = 0x10ffff;

function tokenize(str, options) {
	if(options == undefined) options = {transformFunctionWhitespace:false, scientificNotation:false};
	var i = -1;
	var tokens = [];
	var state = "data";
	var code;
	var currtoken;

	// Line number information.
	var line = 0;
	var column = 0;
	// The only use of lastLineLength is in reconsume().
	var lastLineLength = 0;
	var incrLineno = function() {
		line += 1;
		lastLineLength = column;
		column = 0;
	};
	var locStart = {line:line, column:column};

	var next = function(num) { if(num === undefined) num = 1; return str.charCodeAt(i+num); };
	var consume = function(num) {
		if(num === undefined)
			num = 1;
		i += num;
		code = str.charCodeAt(i);
		if (newline(code)) incrLineno();
		else column += num;
		//console.log('Consume '+i+' '+String.fromCharCode(code) + ' 0x' + code.toString(16));
		return true;
	};
	var reconsume = function() {
		i -= 1;
		if (newline(code)) {
			line -= 1;
			column = lastLineLength;
		} else {
			column -= 1;
		}
		locStart.line = line;
		locStart.column = column;
		return true;
	};
	var eof = function() { return i >= str.length; };
	var donothing = function() {};
	var emit = function(token) {
		if(token) {
			token.finish();
		} else {
			token = currtoken.finish();
		}
		if (options.loc === true) {
			token.loc = {};
			token.loc.start = {line:locStart.line, column:locStart.column, idx: locStart.idx};
			locStart = {line: line, column: column, idx: i};
			token.loc.end = locStart;
		}
		tokens.push(token);
		//console.log('Emitting ' + token);
		currtoken = undefined;
		return true;
	};
	var create = function(token) { currtoken = token; return true; };
	// mozmod: disable console.log
	var parseerror = function() { /* console.log("Parse error at index " + i + ", processing codepoint 0x" + code.toString(16) + " in state " + state + "."); */ return true; };
	// mozmod: disable console.log
	var catchfire = function(msg) { /* console.log("MAJOR SPEC ERROR: " + msg); */ return true;}
	var switchto = function(newstate) {
		state = newstate;
		//console.log('Switching to ' + state);
		return true;
	};
	var consumeEscape = function() {
		// Assume the the current character is the \
		consume();
		if(hexdigit(code)) {
			// Consume 1-6 hex digits
			var digits = [];
			for(var total = 0; total < 6; total++) {
				if(hexdigit(code)) {
					digits.push(code);
					consume();
				} else { break; }
			}
			var value = parseInt(digits.map(String.fromCharCode).join(''), 16);
			if( value > maximumallowedcodepoint ) value = 0xfffd;
			// If the current char is whitespace, cool, we'll just eat it.
			// Otherwise, put it back.
			if(!whitespace(code)) reconsume();
			return value;
		} else {
			return code;
		}
	};

	for(;;) {
		if(i > str.length*2) return "I'm infinite-looping!";
		consume();
		switch(state) {
		case "data":
			if(whitespace(code)) {
				emit(new WhitespaceToken);
				while(whitespace(next())) consume();
			}
			else if(code == 0x22) switchto("double-quote-string");
			else if(code == 0x23) switchto("hash");
			else if(code == 0x27) switchto("single-quote-string");
			else if(code == 0x28) emit(new OpenParenToken);
			else if(code == 0x29) emit(new CloseParenToken);
			else if(code == 0x2b) {
				if(digit(next()) || (next() == 0x2e && digit(next(2)))) switchto("number") && reconsume();
				else emit(new DelimToken(code));
			}
			else if(code == 0x2d) {
				if(next(1) == 0x2d && next(2) == 0x3e) consume(2) && emit(new CDCToken);
				else if(digit(next()) || (next(1) == 0x2e && digit(next(2)))) switchto("number") && reconsume();
				else switchto('ident') && reconsume();
			}
			else if(code == 0x2e) {
				if(digit(next())) switchto("number") && reconsume();
				else emit(new DelimToken(code));
			}
			else if(code == 0x2f) {
				if(next() == 0x2a) consume() && switchto("comment");
				else emit(new DelimToken(code));
			}
			else if(code == 0x3a) emit(new ColonToken);
			else if(code == 0x3b) emit(new SemicolonToken);
			else if(code == 0x3c) {
				if(next(1) == 0x21 && next(2) == 0x2d && next(3) == 0x2d) consume(3) && emit(new CDOToken);
				else emit(new DelimToken(code));
			}
			else if(code == 0x40) switchto("at-keyword");
			else if(code == 0x5b) emit(new OpenSquareToken);
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && emit(new DelimToken(code));
				else switchto('ident') && reconsume();
			}
			else if(code == 0x5d) emit(new CloseSquareToken);
			else if(code == 0x7b) emit(new OpenCurlyToken);
			else if(code == 0x7d) emit(new CloseCurlyToken);
			else if(digit(code)) switchto("number") && reconsume();
			else if(code == 0x55 || code == 0x75) {
				if(next(1) == 0x2b && hexdigit(next(2))) consume() && switchto("unicode-range");
				else switchto('ident') && reconsume();
			}
			else if(namestartchar(code)) switchto('ident') && reconsume();
			else if(eof()) { emit(new EOFToken); return tokens; }
			else emit(new DelimToken(code));
			break;

		case "double-quote-string":
			if(currtoken == undefined) create(new StringToken);

			if(code == 0x22) emit() && switchto("data");
			else if(eof()) parseerror() && emit() && switchto("data") && reconsume();
			else if(newline(code)) parseerror() && emit(new BadStringToken) && switchto("data") && reconsume();
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && emit(new BadStringToken) && switchto("data");
				else if(newline(next())) consume();
				else currtoken.append(consumeEscape());
			}
			else currtoken.append(code);
			break;

		case "single-quote-string":
			if(currtoken == undefined) create(new StringToken);

			if(code == 0x27) emit() && switchto("data");
			else if(eof()) parseerror() && emit() && switchto("data");
			else if(newline(code)) parseerror() && emit(new BadStringToken) && switchto("data") && reconsume();
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && emit(new BadStringToken) && switchto("data");
				else if(newline(next())) consume();
				else currtoken.append(consumeEscape());
			}
			else currtoken.append(code);
			break;

		case "hash":
			if(namechar(code)) create(new HashToken(code)) && switchto("hash-rest");
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && emit(new DelimToken(0x23)) && switchto("data") && reconsume();
				else create(new HashToken(consumeEscape())) && switchto('hash-rest');
			}
			else emit(new DelimToken(0x23)) && switchto('data') && reconsume();
			break;

		case "hash-rest":
			if(namechar(code)) currtoken.append(code);
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && emit() && switchto("data") && reconsume();
				else currtoken.append(consumeEscape());
			}
			else emit() && switchto('data') && reconsume();
			break;

		case "comment":
			if(code == 0x2a) {
				if(next() == 0x2f) consume() && switchto('data');
				else donothing();
			}
			else if(eof()) parseerror() && switchto('data') && reconsume();
			else donothing();
			break;

		case "at-keyword":
			if(code == 0x2d) {
				if(namestartchar(next())) create(new AtKeywordToken(0x2d)) && switchto('at-keyword-rest');
				else if(next(1) == 0x5c && !badescape(next(2))) create(new AtKeywordtoken(0x2d)) && switchto('at-keyword-rest');
				else parseerror() && emit(new DelimToken(0x40)) && switchto('data') && reconsume();
			}
			else if(namestartchar(code)) create(new AtKeywordToken(code)) && switchto('at-keyword-rest');
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && emit(new DelimToken(0x23)) && switchto("data") && reconsume();
				else create(new AtKeywordToken(consumeEscape())) && switchto('at-keyword-rest');
			}
			else emit(new DelimToken(0x40)) && switchto('data') && reconsume();
			break;

		case "at-keyword-rest":
			if(namechar(code)) currtoken.append(code);
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && emit() && switchto("data") && reconsume();
				else currtoken.append(consumeEscape());
			}
			else emit() && switchto('data') && reconsume();
			break;

		case "ident":
			if(code == 0x2d) {
				if(namestartchar(next())) create(new IdentifierToken(code)) && switchto('ident-rest');
				else if(next(1) == 0x5c && !badescape(next(2))) create(new IdentifierToken(code)) && switchto('ident-rest');
				else emit(new DelimToken(0x2d)) && switchto('data');
			}
			else if(namestartchar(code)) create(new IdentifierToken(code)) && switchto('ident-rest');
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && switchto("data") && reconsume();
				else create(new IdentifierToken(consumeEscape())) && switchto('ident-rest');
			}
			else catchfire("Hit the generic 'else' clause in ident state.") && switchto('data') && reconsume();
			break;

		case "ident-rest":
			if(namechar(code)) currtoken.append(code);
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && emit() && switchto("data") && reconsume();
				else currtoken.append(consumeEscape());
			}
			else if(code == 0x28) {
				if(currtoken.ASCIImatch('url')) switchto('url');
				else emit(new FunctionToken(currtoken)) && switchto('data');
			}
			else if(whitespace(code) && options.transformFunctionWhitespace) switchto('transform-function-whitespace') && reconsume();
			else emit() && switchto('data') && reconsume();
			break;

		case "transform-function-whitespace":
			if(whitespace(next())) donothing();
			else if(code == 0x28) emit(new FunctionToken(currtoken)) && switchto('data');
			else emit() && switchto('data') && reconsume();
			break;

		case "number":
			create(new NumberToken());

			if(code == 0x2d) {
				if(digit(next())) consume() && currtoken.append([0x2d,code]) && switchto('number-rest');
				else if(next(1) == 0x2e && digit(next(2))) consume(2) && currtoken.append([0x2d,0x2e,code]) && switchto('number-fraction');
				else switchto('data') && reconsume();
			}
			else if(code == 0x2b) {
				if(digit(next())) consume() && currtoken.append([0x2b,code]) && switchto('number-rest');
				else if(next(1) == 0x2e && digit(next(2))) consume(2) && currtoken.append([0x2b,0x2e,code]) && switchto('number-fraction');
				else switchto('data') && reconsume();
			}
			else if(digit(code)) currtoken.append(code) && switchto('number-rest');
			else if(code == 0x2e) {
				if(digit(next())) consume() && currtoken.append([0x2e,code]) && switchto('number-fraction');
				else switchto('data') && reconsume();
			}
			else switchto('data') && reconsume();
			break;

		case "number-rest":
			if(digit(code)) currtoken.append(code);
			else if(code == 0x2e) {
				if(digit(next())) consume() && currtoken.append([0x2e,code]) && switchto('number-fraction');
				else emit() && switchto('data') && reconsume();
			}
			else if(code == 0x25) emit(new PercentageToken(currtoken)) && switchto('data');
			else if(code == 0x45 || code == 0x65) {
				if(digit(next())) consume() && currtoken.append([0x25,code]) && switchto('sci-notation');
				else if((next(1) == 0x2b || next(1) == 0x2d) && digit(next(2))) currtoken.append([0x25,next(1),next(2)]) && consume(2) && switchto('sci-notation');
				else create(new DimensionToken(currtoken,code)) && switchto('dimension');
			}
			else if(code == 0x2d) {
				if(namestartchar(next())) consume() && create(new DimensionToken(currtoken,[0x2d,code])) && switchto('dimension');
				else if(next(1) == 0x5c && badescape(next(2))) parseerror() && emit() && switchto('data') && reconsume();
				else if(next(1) == 0x5c) consume() && create(new DimensionToken(currtoken, [0x2d,consumeEscape()])) && switchto('dimension');
				else emit() && switchto('data') && reconsume();
			}
			else if(namestartchar(code)) create(new DimensionToken(currtoken, code)) && switchto('dimension');
			else if(code == 0x5c) {
				if(badescape(next)) parseerror() && emit() && switchto('data') && reconsume();
				else create(new DimensionToken(currtoken,consumeEscape)) && switchto('dimension');
			}
			else emit() && switchto('data') && reconsume();
			break;

		case "number-fraction":
			currtoken.type = "number";

			if(digit(code)) currtoken.append(code);
			else if(code == 0x25) emit(new PercentageToken(currtoken)) && switchto('data');
			else if(code == 0x45 || code == 0x65) {
				if(digit(next())) consume() && currtoken.append([0x65,code]) && switchto('sci-notation');
				else if((next(1) == 0x2b || next(1) == 0x2d) && digit(next(2))) currtoken.append([0x65,next(1),next(2)]) && consume(2) && switchto('sci-notation');
				else create(new DimensionToken(currtoken,code)) && switchto('dimension');
			}
			else if(code == 0x2d) {
				if(namestartchar(next())) consume() && create(new DimensionToken(currtoken,[0x2d,code])) && switchto('dimension');
				else if(next(1) == 0x5c && badescape(next(2))) parseerror() && emit() && switchto('data') && reconsume();
				else if(next(1) == 0x5c) consume() && create(new DimensionToken(currtoken, [0x2d,consumeEscape()])) && switchto('dimension');
				else emit() && switchto('data') && reconsume();
			}
			else if(namestartchar(code)) create(new DimensionToken(currtoken, code)) && switchto('dimension');
			else if(code == 0x5c) {
				if(badescape(next)) parseerror() && emit() && switchto('data') && reconsume();
				else create(new DimensionToken(currtoken,consumeEscape())) && switchto('dimension');
			}
			else emit() && switchto('data') && reconsume();
			break;

		case "dimension":
			if(namechar(code)) currtoken.append(code);
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && emit() && switchto('data') && reconsume();
				else currtoken.append(consumeEscape());
			}
			else emit() && switchto('data') && reconsume();
			break;

		case "sci-notation":
			currtoken.type = "number";

			if(digit(code)) currtoken.append(code);
			else emit() && switchto('data') && reconsume();
			break;

		case "url":
			if(eof()) parseerror() && emit(new BadURLToken) && switchto('data');
			else if(code == 0x22) switchto('url-double-quote');
			else if(code == 0x27) switchto('url-single-quote');
			else if(code == 0x29) emit(new URLToken) && switchto('data');
			else if(whitespace(code)) donothing();
			else switchto('url-unquoted') && reconsume();
			break;

		case "url-double-quote":
			if(! (currtoken instanceof URLToken)) create(new URLToken);

			if(eof()) parseerror() && emit(new BadURLToken) && switchto('data');
			else if(code == 0x22) switchto('url-end');
			else if(newline(code)) parseerror() && switchto('bad-url');
			else if(code == 0x5c) {
				if(newline(next())) consume();
				else if(badescape(next())) parseerror() && emit(new BadURLToken) && switchto('data') && reconsume();
				else currtoken.append(consumeEscape());
			}
			else currtoken.append(code);
			break;

		case "url-single-quote":
			if(! (currtoken instanceof URLToken)) create(new URLToken);

			if(eof()) parseerror() && emit(new BadURLToken) && switchto('data');
			else if(code == 0x27) switchto('url-end');
			else if(newline(code)) parseerror() && switchto('bad-url');
			else if(code == 0x5c) {
				if(newline(next())) consume();
				else if(badescape(next())) parseerror() && emit(new BadURLToken) && switchto('data') && reconsume();
				else currtoken.append(consumeEscape());
			}
			else currtoken.append(code);
			break;

		case "url-end":
			if(eof()) parseerror() && emit(new BadURLToken) && switchto('data');
			else if(whitespace(code)) donothing();
			else if(code == 0x29) emit() && switchto('data');
			else parseerror() && switchto('bad-url') && reconsume();
			break;

		case "url-unquoted":
			if(! (currtoken instanceof URLToken)) create(new URLToken);

			if(eof()) parseerror() && emit(new BadURLToken) && switchto('data');
			else if(whitespace(code)) switchto('url-end');
			else if(code == 0x29) emit() && switchto('data');
			else if(code == 0x22 || code == 0x27 || code == 0x28 || nonprintable(code)) parseerror() && switchto('bad-url');
			else if(code == 0x5c) {
				if(badescape(next())) parseerror() && switchto('bad-url');
				else currtoken.append(consumeEscape());
			}
			else currtoken.append(code);
			break;

		case "bad-url":
			if(eof()) parseerror() && emit(new BadURLToken) && switchto('data');
			else if(code == 0x29) emit(new BadURLToken) && switchto('data');
			else if(code == 0x5c) {
				if(badescape(next())) donothing();
				else consumeEscape();
			}
			else donothing();
			break;

		case "unicode-range":
			// We already know that the current code is a hexdigit.

			var start = [code], end = [code];

			for(var total = 1; total < 6; total++) {
				if(hexdigit(next())) {
					consume();
					start.push(code);
					end.push(code);
				}
				else break;
			}

			if(next() == 0x3f) {
				for(;total < 6; total++) {
					if(next() == 0x3f) {
						consume();
						start.push("0".charCodeAt(0));
						end.push("f".charCodeAt(0));
					}
					else break;
				}
				emit(new UnicodeRangeToken(start,end)) && switchto('data');
			}
			else if(next(1) == 0x2d && hexdigit(next(2))) {
				consume();
				consume();
				end = [code];
				for(var total = 1; total < 6; total++) {
					if(hexdigit(next())) {
						consume();
						end.push(code);
					}
					else break;
				}
				emit(new UnicodeRangeToken(start,end)) && switchto('data');
			}
			else emit(new UnicodeRangeToken(start)) && switchto('data');
			break;

		default:
			catchfire("Unknown state '" + state + "'");
		}
	}
}

function stringFromCodeArray(arr) {
	return String.fromCharCode.apply(null,arr.filter(function(e){return e;}));
}

function CSSParserToken(options) { return this; }
CSSParserToken.prototype.finish = function() { return this; }
CSSParserToken.prototype.toString = function() { return this.tokenType; }
CSSParserToken.prototype.toJSON = function() { return this.toString(); }

function BadStringToken() { return this; }
BadStringToken.prototype = new CSSParserToken;
BadStringToken.prototype.tokenType = "BADSTRING";

function BadURLToken() { return this; }
BadURLToken.prototype = new CSSParserToken;
BadURLToken.prototype.tokenType = "BADURL";

function WhitespaceToken() { return this; }
WhitespaceToken.prototype = new CSSParserToken;
WhitespaceToken.prototype.tokenType = "WHITESPACE";
WhitespaceToken.prototype.toString = function() { return "WS"; }

function CDOToken() { return this; }
CDOToken.prototype = new CSSParserToken;
CDOToken.prototype.tokenType = "CDO";

function CDCToken() { return this; }
CDCToken.prototype = new CSSParserToken;
CDCToken.prototype.tokenType = "CDC";

function ColonToken() { return this; }
ColonToken.prototype = new CSSParserToken;
ColonToken.prototype.tokenType = ":";

function SemicolonToken() { return this; }
SemicolonToken.prototype = new CSSParserToken;
SemicolonToken.prototype.tokenType = ";";

function OpenCurlyToken() { return this; }
OpenCurlyToken.prototype = new CSSParserToken;
OpenCurlyToken.prototype.tokenType = "{";

function CloseCurlyToken() { return this; }
CloseCurlyToken.prototype = new CSSParserToken;
CloseCurlyToken.prototype.tokenType = "}";

function OpenSquareToken() { return this; }
OpenSquareToken.prototype = new CSSParserToken;
OpenSquareToken.prototype.tokenType = "[";

function CloseSquareToken() { return this; }
CloseSquareToken.prototype = new CSSParserToken;
CloseSquareToken.prototype.tokenType = "]";

function OpenParenToken() { return this; }
OpenParenToken.prototype = new CSSParserToken;
OpenParenToken.prototype.tokenType = "(";

function CloseParenToken() { return this; }
CloseParenToken.prototype = new CSSParserToken;
CloseParenToken.prototype.tokenType = ")";

function EOFToken() { return this; }
EOFToken.prototype = new CSSParserToken;
EOFToken.prototype.tokenType = "EOF";

function DelimToken(code) {
	this.value = String.fromCharCode(code);
	return this;
}
DelimToken.prototype = new CSSParserToken;
DelimToken.prototype.tokenType = "DELIM";
DelimToken.prototype.toString = function() { return "DELIM("+this.value+")"; }

function StringValuedToken() { return this; }
StringValuedToken.prototype = new CSSParserToken;
StringValuedToken.prototype.append = function(val) {
	if(val instanceof Array) {
		for(var i = 0; i < val.length; i++) {
			this.value.push(val[i]);
		}
	} else {
		this.value.push(val);
	}
	return true;
}
StringValuedToken.prototype.finish = function() {
	this.value = this.valueAsString();
	return this;
}
StringValuedToken.prototype.ASCIImatch = function(str) {
	return this.valueAsString().toLowerCase() == str.toLowerCase();
}
StringValuedToken.prototype.valueAsString = function() {
	if(typeof this.value == 'string') return this.value;
	return stringFromCodeArray(this.value);
}
StringValuedToken.prototype.valueAsCodes = function() {
	if(typeof this.value == 'string') {
		var ret = [];
		for(var i = 0; i < this.value.length; i++)
			ret.push(this.value.charCodeAt(i));
		return ret;
	}
	return this.value.filter(function(e){return e;});
}

function IdentifierToken(val) {
	this.value = [];
	this.append(val);
}
IdentifierToken.prototype = new StringValuedToken;
IdentifierToken.prototype.tokenType = "IDENT";
IdentifierToken.prototype.toString = function() { return "IDENT("+this.value+")"; }

function FunctionToken(val) {
	// These are always constructed by passing an IdentifierToken
	this.value = val.finish().value;
}
FunctionToken.prototype = new StringValuedToken;
FunctionToken.prototype.tokenType = "FUNCTION";
FunctionToken.prototype.toString = function() { return "FUNCTION("+this.value+")"; }

function AtKeywordToken(val) {
	this.value = [];
	this.append(val);
}
AtKeywordToken.prototype = new StringValuedToken;
AtKeywordToken.prototype.tokenType = "AT-KEYWORD";
AtKeywordToken.prototype.toString = function() { return "AT("+this.value+")"; }

function HashToken(val) {
	this.value = [];
	this.append(val);
}
HashToken.prototype = new StringValuedToken;
HashToken.prototype.tokenType = "HASH";
HashToken.prototype.toString = function() { return "HASH("+this.value+")"; }

function StringToken(val) {
	this.value = [];
	this.append(val);
}
StringToken.prototype = new StringValuedToken;
StringToken.prototype.tokenType = "STRING";
StringToken.prototype.toString = function() { return "\""+this.value+"\""; }

function URLToken(val) {
	this.value = [];
	this.append(val);
}
URLToken.prototype = new StringValuedToken;
URLToken.prototype.tokenType = "URL";
URLToken.prototype.toString = function() { return "URL("+this.value+")"; }

function NumberToken(val) {
	this.value = [];
	this.append(val);
	this.type = "integer";
}
NumberToken.prototype = new StringValuedToken;
NumberToken.prototype.tokenType = "NUMBER";
NumberToken.prototype.toString = function() {
	if(this.type == "integer")
		return "INT("+this.value+")";
	return "NUMBER("+this.value+")";
}
NumberToken.prototype.finish = function() {
	this.repr = this.valueAsString();
	this.value = this.repr * 1;
	if(Math.abs(this.value) % 1 != 0) this.type = "number";
	return this;
}

function PercentageToken(val) {
	// These are always created by passing a NumberToken as val
	val.finish();
	this.value = val.value;
	this.repr = val.repr;
}
PercentageToken.prototype = new CSSParserToken;
PercentageToken.prototype.tokenType = "PERCENTAGE";
PercentageToken.prototype.toString = function() { return "PERCENTAGE("+this.value+")"; }

function DimensionToken(val,unit) {
	// These are always created by passing a NumberToken as the val
	val.finish();
	this.num = val.value;
	this.unit = [];
	this.repr = val.repr;
	this.append(unit);
}
DimensionToken.prototype = new CSSParserToken;
DimensionToken.prototype.tokenType = "DIMENSION";
DimensionToken.prototype.toString = function() { return "DIM("+this.num+","+this.unit+")"; }
DimensionToken.prototype.append = function(val) {
	if(val instanceof Array) {
		for(var i = 0; i < val.length; i++) {
			this.unit.push(val[i]);
		}
	} else {
		this.unit.push(val);
	}
	return true;
}
DimensionToken.prototype.finish = function() {
	this.unit = stringFromCodeArray(this.unit);
	this.repr += this.unit;
	return this;
}

function UnicodeRangeToken(start,end) {
	// start and end are array of char codes, completely finished
	start = parseInt(stringFromCodeArray(start),16);
	if(end === undefined) end = start + 1;
	else end = parseInt(stringFromCodeArray(end),16);

	if(start > maximumallowedcodepoint) end = start;
	if(end < start) end = start;
	if(end > maximumallowedcodepoint) end = maximumallowedcodepoint;

	this.start = start;
	this.end = end;
	return this;
}
UnicodeRangeToken.prototype = new CSSParserToken;
UnicodeRangeToken.prototype.tokenType = "UNICODE-RANGE";
UnicodeRangeToken.prototype.toString = function() {
	if(this.start+1 == this.end)
		return "UNICODE-RANGE("+this.start.toString(16).toUpperCase()+")";
	if(this.start < this.end)
		return "UNICODE-RANGE("+this.start.toString(16).toUpperCase()+"-"+this.end.toString(16).toUpperCase()+")";
	return "UNICODE-RANGE()";
}
UnicodeRangeToken.prototype.contains = function(code) {
	return code >= this.start && code < this.end;
}


// Exportation.
// TODO: also export the various tokens objects?
exports.tokenize = tokenize;
exports.EOFToken = EOFToken;

}));

(function (root, factory) {
    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.
    if (typeof define === 'function' && define.amd) {
        define('bleach/css-parser/parser',['require', 'exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(require, exports);
    } else {
        factory(root);
    }
}(this, function (require, exports) {
var tokenizer = require('./tokenizer');

function parse(tokens, initialMode) {
	var mode = initialMode || 'top-level';
	var i = -1;
	var token;

	var stylesheet;
        switch (mode) {
          case 'top-level':
             stylesheet = new Stylesheet;
             break;
          // (Used for style attributes; start out parsing declarations which
          // means that our container must be a StyleRule.)
          case 'declaration':
             stylesheet = new StyleRule;
             break;
        }
        stylesheet.startTok = tokens[0];
        //console.log('  initial tok', JSON.stringify(tokens[0]), JSON.stringify(stylesheet));
	var stack = [stylesheet];
	var rule = stack[0];

	var consume = function(advance) {
		if(advance === undefined) advance = 1;
		i += advance;
		if(i < tokens.length)
			token = tokens[i];
		else
			token = new EOFToken;
		return true;
	};
	var reprocess = function() {
		i--;
		return true;
	}
	var next = function() {
		return tokens[i+1];
	};
	var switchto = function(newmode) {
		if(newmode === undefined) {
			if(rule.fillType !== '')
				mode = rule.fillType;
			else if(rule.type == 'STYLESHEET')
				mode = 'top-level'
			// mozmod: disable console.log
			else { /* console.log("Unknown rule-type while switching to current rule's content mode: ",rule); mode = ''; */ }
		} else {
			mode = newmode;
		}
		return true;
	}
	var push = function(newRule) {
		rule = newRule;
                rule.startTok = token;
                //console.log('  startTok', JSON.stringify(token), JSON.stringify(rule));
		stack.push(rule);
		return true;
	}
	var parseerror = function(msg) {
		// mozmod: disable console.log
		//console.log("Parse error at token " + i + ": " + token + ".\n" + msg);
		return true;
	}
	var pop = function() {
		var oldrule = stack.pop();
                oldrule.endTok = token;
                //console.log('  endTok', JSON.stringify(token), JSON.stringify(oldrule));
		rule = stack[stack.length - 1];
		rule.append(oldrule);
		return true;
	}
	var discard = function() {
		stack.pop();
		rule = stack[stack.length - 1];
		return true;
	}
	var finish = function() {
		while(stack.length > 1) {
			pop();
		}
                rule.endTok = token;
                //console.log('  endTok', JSON.stringify(token), JSON.stringify(rule));
	}

	for(;;) {
		consume();

		switch(mode) {
		case "top-level":
			switch(token.tokenType) {
			case "CDO":
			case "CDC":
			case "WHITESPACE": break;
			case "AT-KEYWORD": push(new AtRule(token.value)) && switchto('at-rule'); break;
			case "{": parseerror("Attempt to open a curly-block at top-level.") && consumeAPrimitive(); break;
			case "EOF": finish(); return stylesheet;
			default: push(new StyleRule) && switchto('selector') && reprocess();
			}
			break;

		case "at-rule":
			switch(token.tokenType) {
			case ";": pop() && switchto(); break;
			case "{":
				if(rule.fillType !== '') switchto(rule.fillType);
				else parseerror("Attempt to open a curly-block in a statement-type at-rule.") && discard() && switchto('next-block') && reprocess();
				break;
			case "EOF": finish(); return stylesheet;
			default: rule.appendPrelude(consumeAPrimitive());
			}
			break;

		case "rule":
			switch(token.tokenType) {
			case "WHITESPACE": break;
			case "}": pop() && switchto(); break;
			case "AT-KEYWORD": push(new AtRule(token.value)) && switchto('at-rule'); break;
			case "EOF": finish(); return stylesheet;
			default: push(new StyleRule) && switchto('selector') && reprocess();
			}
			break;

		case "selector":
			switch(token.tokenType) {
			case "{": switchto('declaration'); break;
			case "EOF": discard() && finish(); return stylesheet;
			default: rule.appendSelector(consumeAPrimitive());
			}
			break;

		case "declaration":
			switch(token.tokenType) {
			case "WHITESPACE":
			case ";": break;
			case "}": pop() && switchto(); break;
			case "AT-RULE": push(new AtRule(token.value)) && switchto('at-rule'); break;
			case "IDENT": push(new Declaration(token.value)) && switchto('after-declaration-name'); break;
			case "EOF": finish(); return stylesheet;
			default: parseerror() && discard() && switchto('next-declaration');
			}
			break;

		case "after-declaration-name":
			switch(token.tokenType) {
			case "WHITESPACE": break;
			case ":": switchto('declaration-value'); break;
			case ";": parseerror("Incomplete declaration - semicolon after property name.") && discard() && switchto(); break;
			case "EOF": discard() && finish(); return stylesheet;
			default: parseerror("Invalid declaration - additional token after property name") && discard() && switchto('next-declaration');
			}
			break;

		case "declaration-value":
			switch(token.tokenType) {
			case "DELIM":
				if(token.value == "!" && next().tokenType == 'IDENTIFIER' && next().value.toLowerCase() == "important") {
					consume();
					rule.important = true;
					switchto('declaration-end');
				} else {
					rule.append(token);
				}
				break;
			case ";": pop() && switchto(); break;
			case "}": pop() && pop() && switchto(); break;
			case "EOF": finish(); return stylesheet;
			default: rule.append(consumeAPrimitive());
			}
			break;

		case "declaration-end":
			switch(token.tokenType) {
			case "WHITESPACE": break;
			case ";": pop() && switchto(); break;
			case "}": pop() && pop() && switchto(); break;
			case "EOF": finish(); return stylesheet;
			default: parseerror("Invalid declaration - additional token after !important.") && discard() && switchto('next-declaration');
			}
			break;

		case "next-block":
			switch(token.tokenType) {
			case "{": consumeAPrimitive() && switchto(); break;
			case "EOF": finish(); return stylesheet;
			default: consumeAPrimitive(); break;
			}
			break;

		case "next-declaration":
			switch(token.tokenType) {
			case ";": switchto('declaration'); break;
			case "}": switchto('declaration') && reprocess(); break;
			case "EOF": finish(); return stylesheet;
			default: consumeAPrimitive(); break;
			}
			break;

		default:
			// If you hit this, it's because one of the switchto() calls is typo'd.
			// mozmod: disable console.log
			//console.log('Unknown parsing mode: ' + mode);
			return;
		}
	}

	function consumeAPrimitive() {
		switch(token.tokenType) {
		case "(":
		case "[":
		case "{": return consumeASimpleBlock();
		case "FUNCTION": return consumeAFunc();
		default: return token;
		}
	}

	function consumeASimpleBlock() {
		var endingTokenType = {"(":")", "[":"]", "{":"}"}[token.tokenType];
		var block = new SimpleBlock(token.tokenType);

		for(;;) {
			consume();
			switch(token.tokenType) {
			case "EOF":
			case endingTokenType: return block;
			default: block.append(consumeAPrimitive());
			}
		}
	}

	function consumeAFunc() {
		var func = new Func(token.value);
		var arg = new FuncArg();

		for(;;) {
			consume();
			switch(token.tokenType) {
			case "EOF":
			case ")": func.append(arg); return func;
			case "DELIM":
				if(token.value == ",") {
					func.append(arg);
					arg = new FuncArg();
				} else {
					arg.append(token);
				}
				break;
			default: arg.append(consumeAPrimitive());
			}
		}
	}
}

function CSSParserRule() { return this; }
CSSParserRule.prototype.fillType = '';
CSSParserRule.prototype.toString = function(indent) {
	return JSON.stringify(this.toJSON(),null,indent);
}
CSSParserRule.prototype.append = function(val) {
	this.value.push(val);
	return this;
}

function Stylesheet() {
	this.value = [];
	return this;
}
Stylesheet.prototype = new CSSParserRule;
Stylesheet.prototype.type = "STYLESHEET";
Stylesheet.prototype.toJSON = function() {
	return {type:'stylesheet', value: this.value.map(function(e){return e.toJSON();})};
}

function AtRule(name) {
	this.name = name;
	this.prelude = [];
	this.value = [];
	if(name in AtRule.registry)
		this.fillType = AtRule.registry[name];
	return this;
}
AtRule.prototype = new CSSParserRule;
AtRule.prototype.type = "AT-RULE";
AtRule.prototype.appendPrelude = function(val) {
	this.prelude.push(val);
	return this;
}
AtRule.prototype.toJSON = function() {
	return {type:'at', name:this.name, prelude:this.prelude.map(function(e){return e.toJSON();}), value:this.value.map(function(e){return e.toJSON();})};
}
AtRule.registry = {
	'import': '',
	'media': 'rule',
	'font-face': 'declaration',
	'page': 'declaration',
	'keyframes': 'rule',
	'namespace': '',
	'counter-style': 'declaration',
	'supports': 'rule',
	'document': 'rule',
	'font-feature-values': 'declaration',
	'viewport': '',
	'region-style': 'rule'
};

function StyleRule() {
	this.selector = [];
	this.value = [];
	return this;
}
StyleRule.prototype = new CSSParserRule;
StyleRule.prototype.type = "STYLE-RULE";
StyleRule.prototype.fillType = 'declaration';
StyleRule.prototype.appendSelector = function(val) {
	this.selector.push(val);
	return this;
}
StyleRule.prototype.toJSON = function() {
	return {type:'selector', selector:this.selector.map(function(e){return e.toJSON();}), value:this.value.map(function(e){return e.toJSON();})};
}

function Declaration(name) {
	this.name = name;
	this.value = [];
	return this;
}
Declaration.prototype = new CSSParserRule;
Declaration.prototype.type = "DECLARATION";
Declaration.prototype.toJSON = function() {
	return {type:'declaration', name:this.name, value:this.value.map(function(e){return e.toJSON();})};
}

function SimpleBlock(type) {
	this.name = type;
	this.value = [];
	return this;
}
SimpleBlock.prototype = new CSSParserRule;
SimpleBlock.prototype.type = "BLOCK";
SimpleBlock.prototype.toJSON = function() {
	return {type:'block', name:this.name, value:this.value.map(function(e){return e.toJSON();})};
}

function Func(name) {
	this.name = name;
	this.value = [];
	return this;
}
Func.prototype = new CSSParserRule;
Func.prototype.type = "FUNCTION";
Func.prototype.toJSON = function() {
	return {type:'func', name:this.name, value:this.value.map(function(e){return e.toJSON();})};
}

function FuncArg() {
	this.value = [];
	return this;
}
FuncArg.prototype = new CSSParserRule;
FuncArg.prototype.type = "FUNCTION-ARG";
FuncArg.prototype.toJSON = function() {
	return this.value.map(function(e){return e.toJSON();});
}

// Exportation.
// TODO: also export the various rule objects?
exports.parse = parse;

}));

if (typeof exports === 'object' && typeof define !== 'function') {
    define = function (factory) {
        factory(require, exports, module);
    };
}

define('bleach',['require','exports','module','./bleach/css-parser/tokenizer','./bleach/css-parser/parser'],function (require, exports, module) {
var tokenizer = require('./bleach/css-parser/tokenizer');
var parser = require('./bleach/css-parser/parser');

var ALLOWED_TAGS = [
    'a',
    'abbr',
    'acronym',
    'b',
    'blockquote',
    'code',
    'em',
    'i',
    'li',
    'ol',
    'strong',
    'ul'
];
var ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title'],
    'abbr': ['title'],
    'acronym': ['title']
};
var ALLOWED_STYLES = [];

var Node = {
  ELEMENT_NODE                :  1,
  ATTRIBUTE_NODE              :  2,
  TEXT_NODE                   :  3,
  CDATA_SECTION_NODE          :  4,
  ENTITY_REFERENCE_NODE       :  5,
  ENTITY_NODE                 :  6,
  PROCESSING_INSTRUCTION_NODE :  7,
  COMMENT_NODE                :  8,
  DOCUMENT_NODE               :  9,
  DOCUMENT_TYPE_NODE          : 10,
  DOCUMENT_FRAGMENT_NODE      : 11,
  NOTATION_NODE               : 12
};

var DEFAULTS = {
  tags: ALLOWED_TAGS,
  prune: [],
  attributes: ALLOWED_ATTRIBUTES,
  styles: ALLOWED_STYLES,
  strip: false,
  stripComments: true
};

/**
 * Clean a string.
 */
exports.clean = function (html, opts) {
  if (!html) return '';

  // This is poor's man doctype/meta cleanup. I wish DOMParser works in a
  // worker but it sounds like a dream, see bug 677123.
  // Someone needs to come with a better approach but I'm running out of
  // time...
  // Prevoiusly, only removed DOCTYPE at start of string, but some HTML
  // senders are so bad they just leave them in the middle of email
  // content, as if they just dump from their CMS. So removing all of them
  // now
  html = html.replace(/<!DOCTYPE\s+[^>]*>/gi, '');

  return exports.cleanNode(html, opts);
};


/**
 */
exports.cleanNode = function(html, opts) {
try {
  function debug(str) {
    console.log("Bleach: " + str + "\n");
  }

  opts = opts || DEFAULTS;

  var attrsByTag = opts.hasOwnProperty('attributes') ?
                    opts.attributes : DEFAULTS.attributes;
  var wildAttrs;
  if (Array.isArray(attrsByTag)) {
    wildAttrs = attrsByTag;
    attrsByTag = {};
  } else if (attrsByTag.hasOwnProperty('*')) {
    wildAttrs = attrsByTag['*'];
  } else {
    wildAttrs = [];
  }
  var sanitizeOptions = {
    ignoreComment: ('stripComments' in opts) ? opts.stripComments
                                             : DEFAULTS.stripComments,
    allowedStyles: opts.styles || DEFAULTS.styles,
    allowedTags: opts.tags || DEFAULTS.tags,
    stripMode: ('strip' in opts) ? opts.strip : DEFAULTS.strip,
    pruneTags: opts.prune || DEFAULTS.prune,
    allowedAttributesByTag: attrsByTag,
    wildAttributes: wildAttrs,
    callbackRegexp: opts.callbackRegexp || null,
    callback: opts.callbackRegexp && opts.callback || null,
    maxLength: opts.maxLength || 0
  };

  var sanitizer = new HTMLSanitizer(sanitizeOptions);
  HTMLParser.HTMLParser(html, sanitizer);
  return sanitizer.output;
} catch(e) {
  console.error(e, '\n', e.stack);
  throw e;
}

};

var RE_NORMALIZE_WHITESPACE = /\s+/g;

var HTMLSanitizer = function(options) {
  this.output = '';

  this.ignoreComment = options.ignoreComment;
  this.allowedStyles = options.allowedStyles;
  this.allowedTags = options.allowedTags;
  this.stripMode = options.stripMode;
  this.pruneTags = options.pruneTags;
  this.allowedAttributesByTag = options.allowedAttributesByTag;
  this.wildAttributes = options.wildAttributes;

  this.callbackRegexp = options.callbackRegexp;
  this.callback = options.callback;

  this.isInsideStyleTag = false;
  // How many pruned tag types are on the stack; we require them to be fully
  // balanced, but don't care if what's inside them is balanced or not.
  this.isInsidePrunedTag = 0;
  // Similar; not clear why we need to bother counting for these. debug?
  this.isInsideStrippedTag = 0;

  // Added to allow snippet generation. Pass in
  // maxLength to get snippet work.
  this.maxLength = options.maxLength || 0;

  // Flag to indicate parsing should not
  // continue because maxLength has been hit.
  this.complete = false;

  // If just getting a snippet, the input
  // may also just be an HTML snippet, so
  // if parsing cannot continue, signal
  // just to stop at that point.
  this.ignoreFragments = this.maxLength > 0;
};

HTMLSanitizer.prototype = {
  start: function(tag, attrs, unary) {
    // - prune (trumps all else)
    if (this.pruneTags.indexOf(tag) !== -1) {
      if (!unary)
        this.isInsidePrunedTag++;
      return;
    }
    else if (this.isInsidePrunedTag) {
      return;
    }
    // - strip
    if (this.allowedTags.indexOf(tag) === -1) {
      // In strip mode we discard the tag rather than escaping it.
      if (this.stripMode) {
        if (!unary) {
          this.isInsideStrippedTag++;
        }
        return;
      }

      // The tag is not in the whitelist
      this.output += "&lt;" + (unary ? "/" : "") + tag + "&gt;";
      return;
    }

    this.isInsideStyleTag = (tag == "style" && !unary);

    // If a callback was specified and it matches the tag name, then invoke
    // the callback.  This happens before the attribute filtering so that
    // the function can observe dangerous attributes, but in the event of
    // the (silent) failure of this function, they will still be safely
    // removed.
    var callbackRegexp = this.callbackRegexp;
    if (callbackRegexp && callbackRegexp.test(tag)) {
      attrs = this.callback(tag, attrs);
    }

    var whitelist = this.allowedAttributesByTag[tag];
    var wildAttrs = this.wildAttributes;
    var result = "<" + tag;
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      var attrName = attr.name.toLowerCase();
      if (attr.safe || wildAttrs.indexOf(attrName) !== -1 ||
          (whitelist && whitelist.indexOf(attrName) !== -1)) {
        if (attrName == "style") {
          var attrValue = '';
          try {
            attrValue = CSSParser.parseAttribute(attr.escaped,
                                                   this.allowedStyles);
          } catch (e) {
            console.log('CSSParser.parseAttribute failed for: "' +
                         attr.escaped + '", skipping. Error: ' + e);
          }
          result += " " + attrName + '="' + attrValue + '"';
        } else {
          result += " " + attrName + '="' + attr.escaped + '"';
        }
      }
    }
    result += (unary ? "/" : "") + ">";

    this.output += result;
  },

  end: function(tag) {
    if (this.pruneTags.indexOf(tag) !== -1) {
      this.isInsidePrunedTag--;
      return;
    }
    else if (this.isInsidePrunedTag) {
      return;
    }

    if (this.allowedTags.indexOf(tag) === -1) {
      if (this.isInsideStrippedTag) {
        this.isInsideStrippedTag--;
        return;
      }

      this.output += "&lt;/" + tag + "&gt;";
      return;
    }

    if (this.isInsideStyleTag) {
      this.isInsideStyleTag = false;
    }

    this.output += "</" + tag + ">";
  },

  chars: function(text) {
    if (this.isInsidePrunedTag || this.complete)
      return;
    if (this.isInsideStyleTag) {
      this.output += CSSParser.parseBody(text, this.allowedStyles);
      return;
    }

    //console.log('HTML SANITIZER CHARS GIVEN: ' + text);
    if (this.maxLength) {
      if (this.insideTagForSnippet) {
        if (text.indexOf('>') !== -1) {
          // All clear now, for the next chars call
          this.insideTagForSnippet = false;
        }
        return;
      } else {
        // Skip chars that are for a tag, not wanted for a snippet.
        if (text.charAt(0) === '<') {
          this.insideTagForSnippet = true;
          return;
        }
      }

      // the whitespace down to one whitespace character.
      var normalizedText = text.replace(RE_NORMALIZE_WHITESPACE, ' ');

      // If the join would create two adjacents spaces, then skip the one
      // on the thing we are concatenating.
      var length = this.output.length;
      if (length && normalizedText[0] === ' ' &&
          this.output[length - 1] === ' ') {
        normalizedText = normalizedText.substring(1);
      }

      this.output += normalizedText;
      if (this.output.length >= this.maxLength) {
        this.output = this.output.substring(0, this.maxLength);
        // XXX We got the right numbers of chars
        // Do not process anymore, and also set state
        // the parser can use to know to stop doing work.
        this.complete = true;
      }
    } else {
      this.output += escapeHTMLTextKeepingExistingEntities(text);
    }
  },

  comment: function(comment) {
    if (this.isInsidePrunedTag)
      return;
    if (this.ignoreComment)
      return;
    this.output += '<!--' + comment + '-->';
  }
};

/*
 * HTML Parser By John Resig (ejohn.org)
 * Although the file only calls out MPL as a valid license, the upstream is
 * available under Apache 2.0 and John Resig has indicated by e-mail to
 * asuth@mozilla.com on 2013-03-13 that Apache 2.0 is fine.  So we are using
 * it under Apache 2.0.
 * http://ejohn.org/blog/pure-javascript-html-parser/
 *
 * Original code by Erik Arvidsson, tri-licensed under Apache 2.0, MPL 1.1
 * (probably implicitly 1.1+), or GPL 2.0+ (as visible in the file):
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 * // Use like so:
 * HTMLParser(htmlString, {
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 */


var HTMLParser = (function(){
  // Important syntax notes from the WHATWG HTML spec and observations.
  // http://www.whatwg.org/specs/web-apps/current-work/multipage/syntax.html
  // http://www.whatwg.org/specs/web-apps/current-work/multipage/common-microsyntaxes.html#common-parser-idioms
  //
  // The spec says _html_ tag names are [A-Za-z0-9]; we also include '-' and '_'
  // because that's what the code already did, but also since Gecko seems to be
  // very happy to parse those characters.
  //
  // The spec defines attributes by what they must not include, which is:
  // [\0\s"'>/=] plus also no control characters, or non-unicode characters.
  //
  // The (inherited) code used to have the regular expression effectively
  // validate the attribute syntax by including their grammer in the regexp.
  // The problem with this is that it can make the regexp fail to match tags
  // that are clearly tags.  When we encountered (quoted) attributes without
  // whitespace between them, we would escape the entire tag.  Attempted
  // trivial fixes resulted in regex back-tracking, which begged the issue of
  // why the regex would do this in the first place.  So we stopped doing that.
  //
  // CDATA *is not a thing* in the HTML namespace.  <![CDATA[ just gets treated
  // as a "bogus comment".  See:
  // http://www.whatwg.org/specs/web-apps/current-work/multipage/tokenization.html#markup-declaration-open-state

  // NOTE: tag and attr regexps changed to ignore name spaces prefixes!
  //
  // CHANGE: "we" previously required there to be white-space between attributes.
  // Unfortunately, the world does not agree with this, so we now require
  // whitespace only after the tag name prior to the first attribute and make
  // the whole attribute clause optional.
  //
  // - Regular Expressions for parsing tags and attributes
  // ^<                     anchored tag open character
  // (?:[-A-Za-z0-9_]+:)?   eat the namespace
  // ([-A-Za-z0-9_]+)       the tag name
  // ([^>]*)                capture attributes and/or closing '/' if present
  // >                      tag close character
  var startTag = /^<(?:[-A-Za-z0-9_]+:)?([-A-Za-z0-9_]+)([^>]*)>/,
  // ^<\/                   close tag lead-in
  // (?:[-A-Za-z0-9_]+:)?   optional tag prefix
  // ([-A-Za-z0-9_]+)       tag name
  // [^>]*                  The spec says this should be whitespace, we forgive.
  // >
    endTag = /^<\/(?:[-A-Za-z0-9_]+:)?([-A-Za-z0-9_]+)[^>]*>/,
  // NOTE: This regexp was doing something freaky with the value quotings
  // before. (?:"((?:\\.|[^"])*)") instead of (?:"[^"]*") from the tag part,
  // which is deeply confusing.  Since the period thing seems meaningless, I am
  // replacing it from the bits from startTag
  //
  // (?:[-A-Za-z0-9_]+:)?   attribute prefix
  // ([-A-Za-z0-9_]+)       attribute name
  // (?:                    The attribute doesn't need a value
  //  \s*=\s*               whitespace, = to indicate value, whitespace
  //  (?:                   attribute values:
  //   (?:"([^"]*)")|       capture double-quoted
  //   (?:'([^']*)')|       capture single-quoted
  //   ([^>\s]+)            capture unquoted
  //  )
  // )?                    (the attribute does't need a value)
    attr = /(?:[-A-Za-z0-9_]+:)?([-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^>\s]+)))?/g;

  // - Empty Elements - HTML 4.01
  var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed");

  // - Block Elements - HTML 4.01
  var block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul");

  // - Inline Elements - HTML 4.01, With the exception of "a", bug 1091310.
  // The "close inline if current tag is block" used in bleach is now a bit out
  // of date with the HTML parsing definition:
  // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-inbody
  // Specifically, native "inline" vs "block" elements are not primary branch
  // points in closing logic, but it is very tag-specific. The most notable
  // point  is that p elements should be closed more often by those rules than
  // what is done here, and 'a' elements are not treated special when wrapping
  // a "block" element.. And in the case of
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1091310
  // specifically, there is no special closing behavior when encountering a
  // table start tag, except to close any previously open p tag.
  // Complete removal of the "block" and "inline" checking for closed tags was
  // considered to fix bug 1091310, and to match more closely the behavior in
  // the spec document. However:
  // - we are currently looking at limiting the amount of changes for a possible
  //   uplift to a more stable branch in gaia
  // - There are still some notable inconsistencies with the spec, like this
  //   code not closing of p tags in the same way.
  // - These lists have things like iframe, object, and script in them, and want
  //   to really think through the possible impact of the change in behavior.
  var inline = makeMap("abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

  // - Elements that you can, intentionally, leave open (and close themselves)
  var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");

  // - Attributes that have their values filled in disabled="disabled"
  var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

  // - Special Elements (can contain anything)
  var special = makeMap("script,style");

  var HTMLParser = this.HTMLParser = function( html, handler ) {
    var index, chars, match, stack = [], last = html;
    stack.last = function(){
      return this[ this.length - 1 ];
    };

    while ( html ) {
      chars = true;

      // Make sure we're not in a script or style element
      if ( !stack.last() || !special[ stack.last() ] ) {

        // Comment
        if ( html.lastIndexOf("<!--", 0) == 0 ) {
          index = html.indexOf("-->");

          // WHATWG spec says the text can't start with the closing tag.
          // Of course, this is not obeyed, and it arguably is harmless to
          // interpret the string "<!---->" as just a one-off dumb comment.
          if ( index >= 4 ) {
            if ( handler.comment)
              handler.comment( html.substring( 4, index ) );
            html = html.substring( index + 3 );
            chars = false;
          } else {
            // The comment does not have a end. Let's return the whole string as a comment then.
            if ( handler.comment )
              handler.comment( html.substring( 4, -1 ) );
            html = '';
            chars = false;
          }

        // end tag
        } else if ( html.lastIndexOf("</", 0) == 0 ) {
          match = html.match( endTag );

          if ( match ) {
            html = html.substring( match[0].length );
            match[0].replace( endTag, parseEndTag );
            chars = false;
          }

        // start tag
        } else if ( html.lastIndexOf("<", 0) == 0 ) {
          match = html.match( startTag );

          if ( match ) {
            html = html.substring( match[0].length );
            match[0].replace( startTag, parseStartTag );
            chars = false;
          }
        }

        if ( chars ) {
          index = html.indexOf("<");

          if (index === 0) {
            // This is not a valid tag in regards of the parser.
            var text = html.substring(0, 1);
            html = html.substring(1);
          } else {
            var text = index < 0 ? html : html.substring( 0, index );
            html = index < 0 ? "" : html.substring( index );
          }

          if ( handler.chars ) {
            handler.chars( text );
            if ( handler.complete )
              return this;
          }
        }

      } else { // specials: script or style
        var skipWork = false;
        html = html.replace(
          // we use "[^]" instead of "." because it matches newlines too
          new RegExp("^([^]*?)<\/" + stack.last() + "[^>]*>", "i"),
          function(all, text){
            if (!skipWork) {
              text = text.replace(/<!--([^]*?)-->/g, "$1")
                .replace(/<!\[CDATA\[([^]*?)]]>/g, "$1");

              if ( handler.chars ) {
                handler.chars( text );
                skipWork = handler.complete;
              }
            }

            return "";
          });

        if ( handler.complete )
          return this;

        parseEndTag( "", stack.last() );
      }

      if ( html == last ) {
        // May just have a fragment of HTML, to
        // generate a snippet. If that is the case
        // just end parsing now.
        if ( handler.ignoreFragments ) {
          return;
        } else {
          console.log(html);
          console.log(last);
          throw "Parse Error: " + html;
        }
      }
      last = html;
    }

    // Clean up any remaining tags
    parseEndTag();

    function parseStartTag( tag, tagName, rest ) {
      tagName = tagName.toLowerCase();
      if ( block[ tagName ] ) {
        while ( stack.last() && inline[ stack.last() ] ) {
          parseEndTag( "", stack.last() );
        }
      }

      if ( closeSelf[ tagName ] && stack.last() == tagName ) {
        parseEndTag( "", tagName );
      }

      var unary = empty[ tagName ];
      // to simplify the regexp, the 'rest capture group now absorbs the /, so
      // we need to strip it off if it's there.
      if (rest.length && rest[rest.length - 1] === '/') {
        unary = true;
        rest = rest.slice(0, -1);
      }

      if ( !unary )
        stack.push( tagName );

      if ( handler.start ) {
        var attrs = [];

        rest.replace(attr, function(match, name) {
          // The attr regexp capture groups:
          // 1: attribute name
          // 2: double-quoted attribute value (whitespace allowed inside)
          // 3: single-quoted attribute value (whitespace allowed inside)
          // 4: un-quoted attribute value (whitespace forbidden)
          // We need to escape double-quotes because of the risks in there.
          var value = arguments[2] ? arguments[2] :
            arguments[3] ? arguments[3] :
            arguments[4] ? arguments[4] :
            fillAttrs[name] ? name : "";

          attrs.push({
            name: name,
            value: value,
            escaped: value.replace(/"/g, '&quot;'),
            safe: false
          });
        });

        if ( handler.start )
          handler.start( tagName, attrs, unary );
      }
    }

    function parseEndTag( tag, tagName ) {
      // If no tag name is provided, clean shop
      if ( !tagName )
        var pos = 0;

      // Find the closest opened tag of the same type
      else {
        tagName = tagName.toLowerCase();
        for ( var pos = stack.length - 1; pos >= 0; pos-- )
          if ( stack[ pos ] == tagName )
            break;
      }

      if ( pos >= 0 ) {
        // Close all the open elements, up the stack
        for ( var i = stack.length - 1; i >= pos; i-- )
          if ( handler.end )
            handler.end( stack[ i ] );

        // Remove the open elements from the stack
        stack.length = pos;
      }
    }
  };

  function makeMap(str){
    var obj = {}, items = str.split(",");
    for ( var i = 0; i < items.length; i++ )
      obj[ items[i] ] = true;
    return obj;
  }

  return this;
})();

var CSSParser = {
  parseAttribute: function (data, allowedStyles) {
    var tokens = tokenizer.tokenize(data, { loc: true });
    var rule = parser.parse(tokens, 'declaration');

    var keepText = [];
    this._filterDeclarations(null, rule.value, allowedStyles, data, keepText);
    var oot = keepText.join('');
    //console.log('IN:', data, '\n OUT:', oot);
    return oot;
  },

  _filterDeclarations: function(parent, decls, allowedStyles, fullText,
                                textOut) {
    for (var i = 0; i < decls.length; i++) {
      var decl = decls[i];
      if (decl.type !== 'DECLARATION') {
        continue;
      }
      if (allowedStyles.indexOf(decl.name) !== -1) {
        textOut.push(fullText.substring(
          decl.startTok.loc.start.idx,
          // If we have a parent and our parent ends on the same token as us,
          // then don't emit our ending token (ex: '}'), otherwise do emit it
          // (ex: ';').  We don't want a parent when it's synthetic like for
          // parseAttribute.
          (parent && parent.endTok === decl.endTok) ?
            decl.endTok.loc.start.idx :
            decl.endTok.loc.end.idx + 1));
      }
    }
  },

  parseBody: function (data, allowedStyles) {
    var body = "";
    var oot = "";

    try {
      var tokens = tokenizer.tokenize(data, { loc: true });
      var stylesheet = parser.parse(tokens);

      var keepText = [];

      for (var i = 0; i < stylesheet.value.length; i++) {
        var sub = stylesheet.value[i];
        if (sub.type === 'STYLE-RULE') {
          // We want our tokens up to the start of our first child.  If we have
          // no children, just go up to the start of our ending token.
          keepText.push(data.substring(
            sub.startTok.loc.start.idx,
            sub.value.length ? sub.value[0].startTok.loc.start.idx
                             : sub.endTok.loc.start.idx));
          this._filterDeclarations(sub, sub.value, allowedStyles, data, keepText);
          // we want all of our terminating token.
          keepText.push(data.substring(
            sub.endTok.loc.start.idx, sub.endTok.loc.end.idx + 1));
        }
      }

      oot = keepText.join('');
    } catch (e) {
      console.log('bleach CSS parsing failed, skipping. Error: ' + e);
      oot = '';
    }

    //console.log('IN:', data, '\n OUT:', oot);
    return oot;
  }
};


var entities = {
  34 : 'quot',
  38 : 'amp',
  39 : 'apos',
  60 : 'lt',
  62 : 'gt',
  160 : 'nbsp',
  161 : 'iexcl',
  162 : 'cent',
  163 : 'pound',
  164 : 'curren',
  165 : 'yen',
  166 : 'brvbar',
  167 : 'sect',
  168 : 'uml',
  169 : 'copy',
  170 : 'ordf',
  171 : 'laquo',
  172 : 'not',
  173 : 'shy',
  174 : 'reg',
  175 : 'macr',
  176 : 'deg',
  177 : 'plusmn',
  178 : 'sup2',
  179 : 'sup3',
  180 : 'acute',
  181 : 'micro',
  182 : 'para',
  183 : 'middot',
  184 : 'cedil',
  185 : 'sup1',
  186 : 'ordm',
  187 : 'raquo',
  188 : 'frac14',
  189 : 'frac12',
  190 : 'frac34',
  191 : 'iquest',
  192 : 'Agrave',
  193 : 'Aacute',
  194 : 'Acirc',
  195 : 'Atilde',
  196 : 'Auml',
  197 : 'Aring',
  198 : 'AElig',
  199 : 'Ccedil',
  200 : 'Egrave',
  201 : 'Eacute',
  202 : 'Ecirc',
  203 : 'Euml',
  204 : 'Igrave',
  205 : 'Iacute',
  206 : 'Icirc',
  207 : 'Iuml',
  208 : 'ETH',
  209 : 'Ntilde',
  210 : 'Ograve',
  211 : 'Oacute',
  212 : 'Ocirc',
  213 : 'Otilde',
  214 : 'Ouml',
  215 : 'times',
  216 : 'Oslash',
  217 : 'Ugrave',
  218 : 'Uacute',
  219 : 'Ucirc',
  220 : 'Uuml',
  221 : 'Yacute',
  222 : 'THORN',
  223 : 'szlig',
  224 : 'agrave',
  225 : 'aacute',
  226 : 'acirc',
  227 : 'atilde',
  228 : 'auml',
  229 : 'aring',
  230 : 'aelig',
  231 : 'ccedil',
  232 : 'egrave',
  233 : 'eacute',
  234 : 'ecirc',
  235 : 'euml',
  236 : 'igrave',
  237 : 'iacute',
  238 : 'icirc',
  239 : 'iuml',
  240 : 'eth',
  241 : 'ntilde',
  242 : 'ograve',
  243 : 'oacute',
  244 : 'ocirc',
  245 : 'otilde',
  246 : 'ouml',
  247 : 'divide',
  248 : 'oslash',
  249 : 'ugrave',
  250 : 'uacute',
  251 : 'ucirc',
  252 : 'uuml',
  253 : 'yacute',
  254 : 'thorn',
  255 : 'yuml',
  402 : 'fnof',
  913 : 'Alpha',
  914 : 'Beta',
  915 : 'Gamma',
  916 : 'Delta',
  917 : 'Epsilon',
  918 : 'Zeta',
  919 : 'Eta',
  920 : 'Theta',
  921 : 'Iota',
  922 : 'Kappa',
  923 : 'Lambda',
  924 : 'Mu',
  925 : 'Nu',
  926 : 'Xi',
  927 : 'Omicron',
  928 : 'Pi',
  929 : 'Rho',
  931 : 'Sigma',
  932 : 'Tau',
  933 : 'Upsilon',
  934 : 'Phi',
  935 : 'Chi',
  936 : 'Psi',
  937 : 'Omega',
  945 : 'alpha',
  946 : 'beta',
  947 : 'gamma',
  948 : 'delta',
  949 : 'epsilon',
  950 : 'zeta',
  951 : 'eta',
  952 : 'theta',
  953 : 'iota',
  954 : 'kappa',
  955 : 'lambda',
  956 : 'mu',
  957 : 'nu',
  958 : 'xi',
  959 : 'omicron',
  960 : 'pi',
  961 : 'rho',
  962 : 'sigmaf',
  963 : 'sigma',
  964 : 'tau',
  965 : 'upsilon',
  966 : 'phi',
  967 : 'chi',
  968 : 'psi',
  969 : 'omega',
  977 : 'thetasym',
  978 : 'upsih',
  982 : 'piv',
  8226 : 'bull',
  8230 : 'hellip',
  8242 : 'prime',
  8243 : 'Prime',
  8254 : 'oline',
  8260 : 'frasl',
  8472 : 'weierp',
  8465 : 'image',
  8476 : 'real',
  8482 : 'trade',
  8501 : 'alefsym',
  8592 : 'larr',
  8593 : 'uarr',
  8594 : 'rarr',
  8595 : 'darr',
  8596 : 'harr',
  8629 : 'crarr',
  8656 : 'lArr',
  8657 : 'uArr',
  8658 : 'rArr',
  8659 : 'dArr',
  8660 : 'hArr',
  8704 : 'forall',
  8706 : 'part',
  8707 : 'exist',
  8709 : 'empty',
  8711 : 'nabla',
  8712 : 'isin',
  8713 : 'notin',
  8715 : 'ni',
  8719 : 'prod',
  8721 : 'sum',
  8722 : 'minus',
  8727 : 'lowast',
  8730 : 'radic',
  8733 : 'prop',
  8734 : 'infin',
  8736 : 'ang',
  8743 : 'and',
  8744 : 'or',
  8745 : 'cap',
  8746 : 'cup',
  8747 : 'int',
  8756 : 'there4',
  8764 : 'sim',
  8773 : 'cong',
  8776 : 'asymp',
  8800 : 'ne',
  8801 : 'equiv',
  8804 : 'le',
  8805 : 'ge',
  8834 : 'sub',
  8835 : 'sup',
  8836 : 'nsub',
  8838 : 'sube',
  8839 : 'supe',
  8853 : 'oplus',
  8855 : 'otimes',
  8869 : 'perp',
  8901 : 'sdot',
  8968 : 'lceil',
  8969 : 'rceil',
  8970 : 'lfloor',
  8971 : 'rfloor',
  9001 : 'lang',
  9002 : 'rang',
  9674 : 'loz',
  9824 : 'spades',
  9827 : 'clubs',
  9829 : 'hearts',
  9830 : 'diams',
  338 : 'OElig',
  339 : 'oelig',
  352 : 'Scaron',
  353 : 'scaron',
  376 : 'Yuml',
  710 : 'circ',
  732 : 'tilde',
  8194 : 'ensp',
  8195 : 'emsp',
  8201 : 'thinsp',
  8204 : 'zwnj',
  8205 : 'zwj',
  8206 : 'lrm',
  8207 : 'rlm',
  8211 : 'ndash',
  8212 : 'mdash',
  8216 : 'lsquo',
  8217 : 'rsquo',
  8218 : 'sbquo',
  8220 : 'ldquo',
  8221 : 'rdquo',
  8222 : 'bdquo',
  8224 : 'dagger',
  8225 : 'Dagger',
  8240 : 'permil',
  8249 : 'lsaquo',
  8250 : 'rsaquo',
  8364 : 'euro'
};

var reverseEntities;
// Match on named entities as well as numeric/hex entities as well,
// covering range from &something; &Another; &#1234; &#x22; &#X2F;
// http://www.whatwg.org/specs/web-apps/current-work/multipage/syntax.html#character-references
var entityRegExp = /\&([#a-zA-Z0-9]+);/g;

function makeReverseEntities () {
  reverseEntities = {};
  Object.keys(entities).forEach(function (key) {
    reverseEntities[entities[key]] = key;
  });
}

/**
 * Escapes HTML characters like [<>"'&] in the text,
 * leaving existing HTML entities intact.
 */
function escapeHTMLTextKeepingExistingEntities(text) {
  return text.replace(/[<>"']|&(?![#a-zA-Z0-9]+;)/g, function(c) {
    return '&#' + c.charCodeAt(0) + ';';
  });
}

exports.unescapeHTMLEntities = function unescapeHTMLEntities(text) {
  return text.replace(entityRegExp, function (match, ref) {
    var converted = '';
    if (ref.charAt(0) === '#') {
      var secondChar = ref.charAt(1);
      if (secondChar === 'x' || secondChar === 'X') {
        // hex
        converted = String.fromCharCode(parseInt(ref.substring(2), 16));
      } else {
        // base 10 reference
        converted = String.fromCharCode(parseInt(ref.substring(1), 10));
      }
    } else {
      // a named character reference
      // build up reverse entities on first use.
      if (!reverseEntities)
        makeReverseEntities();

      if (reverseEntities.hasOwnProperty(ref))
        converted = String.fromCharCode(reverseEntities[ref]);
    }
    return converted;
  });
};

/**
 * Renders text content safe for injecting into HTML by
 * replacing all characters which could be used to create HTML elements.
 */
exports.escapePlaintextIntoElementContext = function (text) {
  return text.replace(/[&<>"'\/]/g, function(c) {
    var code = c.charCodeAt(0);
    return '&' + (entities[code] || '#' + code) + ';';
  });
}

/**
 * Escapes all characters with ASCII values less than 256, other than
 * alphanumeric characters, with the &#xHH; format to prevent
 * switching out of the attribute.
 */
exports.escapePlaintextIntoAttribute = function (text) {
  return text.replace(/[\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u0100]/g, function(c) {
    var code = c.charCodeAt(0);
    return '&' + (entities[code] || '#' + code) + ';';
  });
}


}); // end define
;
/**
 * Process text/html for message body purposes.  Specifically:
 *
 * - sanitize HTML (using bleach.js): discard illegal markup entirely, render
 *   legal but 'regulated' markup inert (ex: links to external content).
 * - TODO: perform normalization of quote markup from different clients into
 *   blockquotes, like how Thunderbird conversations does it.
 * - snippet generation: Try and generate a usable snippet string from something
 *   that is not a quote.
 *
 * We may eventually try and perform more detailed analysis like `quotechew.js`
 * does with structured markup, potentially by calling out to quotechew, but
 * that's a tall order to get right, so it's mightily postponed.
 **/

define(
  'htmlchew',[
    'exports',
    'bleach'
  ],
  function(
    exports,
    $bleach
  ) {

/**
 * Whitelisted HTML tags list. Currently from nsTreeSanitizer.cpp which credits
 * Mark Pilgrim and Sam Ruby for its own initial whitelist.
 *
 * IMPORTANT THUNDERBIRD NOTE: Thunderbird only engages its sanitization logic
 * when processing mailto URIs, when the non-default
 * "view | message body as | simple html" setting is selected, or when
 * displaying spam messages.  Accordingly, the settings are pretty strict
 * and not particularly thought-out.  Non-CSS presentation is stripped, which
 * is pretty much the lingua franca of e-mail.  (Thunderbird itself generates
 * font tags, for example.)
 *
 * Some things are just not in the list at all:
 * - SVG: Thunderbird nukes these itself because it forces
 *   SanitizerCidEmbedsOnly which causes flattening of everything in the SVG
 *   namespace.
 *
 * Tags that we are opting not to include will be commented with a reason tag:
 * - annoying: This thing is ruled out currently because it only allows annoying
 *   things to happen *given our current capabilities*.
 * - scripty: This thing requires scripting to make anything happen, and we do
 *   not allow scripting.
 * - forms: We have no UI to expose the target of a form right now, so it's
 *   not safe.  Thunderbird displays a scam warning, which isn't realy a big
 *   help, but it's something.  Because forms are largely unsupported or just
 *   broken in many places, they are rarely used, so we are turning them off
 *   entirely.
 * - non-body: previously killed as part of the parse process because we were
 *   assigning to innerHTML rather than creating a document with the string in
 *   it.  We could change this up in a future bug now.
 * - dangerous: The semantics of the tag are intentionally at odds with our
 *   goals and/or are extensible.  (ex: link tag.)  Our callbacks could be
 *   used to only let through okay things.
 * - interactive-ui: A cross between scripty and forms, things like (HTML5)
 *   menu and command imply some type of mutation that requires scripting.
 *   They also are frequently very attribute-heavy.
 * - svg: it's SVG, we don't support it yet!
 */
var LEGAL_TAGS = [
  'a', 'abbr', 'acronym', 'area', 'article', 'aside',
  // annoying: 'audio',
  'b',
  'bdi', 'bdo', // (bidirectional markup stuff)
  'big', 'blockquote',
  // implicitly-nuked: 'body'
  'br',
  // forms: 'button',
  // scripty: canvas
  'caption',
  'center',
  'cite', 'code', 'col', 'colgroup',
  // interactive-ui: 'command',
  // forms: 'datalist',
  'dd', 'del', 'details', 'dfn', 'dir', 'div', 'dl', 'dt',
  'em',
  // forms: 'fieldset' (but allowed by nsTreeSanitizer)
  'figcaption', 'figure',
  'font',
  'footer',
  // forms: 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // non-body: 'head'
  'header', 'hgroup', 'hr',
  // non-body: 'html'
  'i', 'img',
  // forms: 'input',
  'ins', // ("represents a range of text that has been inserted to a document")
  'kbd', // ("The kbd element represents user input")
  'label', 'legend', 'li',
  // dangerous: link (for CSS styles
  /* link supports many types, none of which we want, some of which are
   * risky: http://dev.w3.org/html5/spec/links.html#linkTypes. Specifics:
   * - "stylesheet": This would be okay for cid links, but there's no clear
   *   advantage over inline styles, so we forbid it, especially as supporting
   *   it might encourage other implementations to dangerously support link.
   * - "prefetch": Its whole point is de facto information leakage.
   */
  'listing', // (deprecated, like "pre")
  'map', 'mark',
  // interactive-ui: 'menu', 'meta', 'meter',
  'nav',
  'nobr', // (deprecated "white-space:nowrap" equivalent)
  'noscript',
  'ol',
  // forms: 'optgroup',
  // forms: 'option',
  'output', // (HTML5 draft: "result of a calculation in a form")
  'p', 'pre',
  // interactive-ui: 'progress',
  'q',
  /* http://www.w3.org/TR/ruby/ is a pronounciation markup that is not directly
   * supported by gecko at this time (although there is a Firefox extension).
   * All of 'rp', 'rt', and 'ruby' are ruby tags.  The spec also defines 'rb'
   * and 'rbc' tags that nsTreeSanitizer does not whitelist, however.
   */
  'rp', 'rt', 'ruby',
  's', 'samp', 'section',
  // forms: 'select',
  'small',
  // annoying?: 'source',
  'span', 'strike', 'strong',
  'style',
  'sub', 'summary', 'sup',
  // svg: 'svg', NB: this lives in its own namespace
  'table', 'tbody', 'td',
  // forms: 'textarea',
  'tfoot', 'th', 'thead', 'time',
  'title', // XXX does this mean anything outside head?
  'tr',
  // annoying?: 'track'
  'tt',
  'u', 'ul', 'var',
  // annoying: 'video',
  'wbr' // (HTML5 draft: line break opportunity)
];

/**
 * Tags whose children should be removed along with the tag itself, rather than
 * splicing the children into the position originally occupied by the parent.
 *
 * We do this for:
 * - forms; see `LEGAL_TAGS` for the rationale.  Note that we don't bother
 *   including children that should already be nuked by PRUNE_TAGS.  For
 *   example, 'option' and 'optgroup' only make sense under 'select' or
 *   'datalist', so we need not include them.  This means that if the tags
 *   are used in nonsensical positions, they will have their contents
 *   merged into the document text, but that's not a major concern.
 * - non-body: don't have stuff from the header show up like it's part of the
 *   body!  For now we do want <style> tags to fall out, but we want <title>
 *   to not show up, etc.
 * - 'script': no one wants to read the ignored JS code!
 * Note that bleach.js now is aware of the special nature of 'script' and
 * 'style' tags, so putting them in prune is not strictly required.
 */
var PRUNE_TAGS = [
  'button', // (forms)
  'datalist', // (forms)
  'script', // (script)
  'select', // (forms)
  'svg', // (svg)
  'title', // (non-body)
];

/**
 * What attributes to allow globally and on specific tags.
 *
 * Forbidden marker names:
 * - URL-like: The attribute can contain URL's and we don't care enough to
 *   sanitize the contents right now.
 * - sanitized: We manually do something with the attribute in our processing
 *   logic.
 * - specific: The attribute is explicitly named on the relevant element types.
 * - unsupported: Gecko ignores the attribute and there is no chance of
 *   standardization, so just strip it.
 * - microformat: we can't do anything with microformats right now, save some
 *   space.
 * - awkward: It's not dangerous, but it's not clear how it could have useful
 *   semantics.
 */
var LEGAL_ATTR_MAP = {
  '*': [
    'abbr', // (tables: removed from HTML5)
    // forms: 'accept', 'accept-charset',
    // interactive-ui: 'accesskey',
    // forms: 'action',
    'align', // (pres)
    'alt', // (fallback content)
    // forms: 'autocomplete', 'autofocus',
    // annoying: 'autoplay',
    'axis', // (tables: removed from HTML5)
    // URL-like: 'background',
    'bgcolor', 'border', // (pres)
    'cellpadding', 'cellspacing', // (pres)
    // unsupported: 'char',
    'charoff', // (tables)
    // specific: 'charset'
    // forms, interactive-ui: 'checked',
    // URL-like: 'cite'
    'class', 'clear', 'color', // (pres)
    'cols', 'colspan', // (tables)
    'compact', // (pres)
    // dangerous: 'content', (meta content refresh is bad.)
    // interactive-ui: 'contenteditable', (we already use this ourselves!)
    // interactive-ui: 'contextmenu',
    // annoying: 'controls', (media)
    'coords', // (area image map)
    'datetime', // (ins, del, time semantic markups)
    // forms: 'disabled',
    'dir', // (rtl)
    // interactive-ui: 'draggable',
    // forms: 'enctype',
    'face', // (pres)
    // forms: 'for',
    'frame', // (tables)
    'headers', // (tables)
    'height', // (layout)
    // interactive-ui: 'hidden', 'high',
    // sanitized: 'href',
    // specific: 'hreflang',
    'hspace', // (pres)
    // dangerous: 'http-equiv' (meta refresh, maybe other trickiness)
    // interactive-ui: 'icon',
    'id', // (pres; white-listed for style targets)
    // specific: 'ismap', (area image map)
    // microformat: 'itemid', 'itemprop', 'itemref', 'itemscope', 'itemtype',
    // annoying: 'kind', (media)
    // annoying, forms, interactive-ui: 'label',
    'lang', // (language support)
    // forms: 'list',
    // dangerous: 'longdesc', (link to a long description, html5 removed)
    // annoying: 'loop',
    // interactive-ui: 'low',
    // forms, interactive-ui: 'max',
    // forms: 'maxlength',
    'media', // (media-query for linky things; safe if links are safe)
    // forms: 'method',
    // forms, interactive-ui: 'min',
    // unsupported: 'moz-do-not-send', (thunderbird internal composition)
    // forms: 'multiple',
    // annoying: 'muted',
    // forms, interactive-ui: 'name', (although pretty safe)
    'nohref', // (image maps)
    // forms: 'novalidate',
    'noshade', // (pres)
    'nowrap', // (tables)
    'open', // (for "details" element)
    // interactive-ui: 'optimum',
    // forms: 'pattern', 'placeholder',
    // annoying: 'playbackrate',
    'pointsize', // (pres)
    // annoying:  'poster', 'preload',
    // forms: 'prompt',
    'pubdate', // ("time" element)
    // forms: 'radiogroup', 'readonly',
    // dangerous: 'rel', (link rel, a rel, area rel)
    // forms: 'required',
    // awkward: 'rev' (reverse link; you can't really link to emails)
    'reversed', // (pres? "ol" reverse numbering)
    // interactive-ui: 'role', We don't want a screen reader making the user
    //   think that part of the e-mail is part of the UI.  (WAI-ARIA defines
    //   "accessible rich internet applications", not content markup.)
    'rows', 'rowspan', 'rules', // (tables)
    // sanitized: 'src',
    'size', // (pres)
    'scope', // (tables)
    'scoped', // (pres; on "style" elem)
    // forms: 'selected',
    'shape', // (image maps)
    'span', // (tables)
    // interactive-ui: 'spellcheck',
    // sanitized, dangerous: 'src'
    // annoying: 'srclang',
    'start', // (pres? "ol" numbering)
    'summary', // (tables accessibility)
    'style', // (pres)
    // interactive-ui: 'tabindex',
    // dangerous: 'target', (specifies a browsing context, but our semantics
    //   are extremely clear and don't need help.)
    'title', // (advisory)
    // specific, dangerous: type (various, but mime-type for links is not the
    //   type of thing we would ever want to propagate or potentially deceive
    //   the user with.)
    'valign', // (pres)
    'value', // (pres? "li" override for "ol"; various form uses)
    'vspace', // (pres)
    'width', // (layout)
    // forms: 'wrap',
  ],
  'a': ['ext-href', 'hreflang'],
  'area': ['ext-href', 'hreflang'],
  // these are used by our quoting and Thunderbird's quoting
  'blockquote': ['cite', 'type'],
  'img': ['cid-src', 'ext-src', 'ismap', 'usemap'],
  // This may only end up being used as a debugging thing, but let's let charset
  // through for now.
  'meta': ['charset'],
  'ol': ['type'], // (pres)
  'style': ['type'],
};

/**
 * CSS Style rules to support.
 *
 * nsTreeSanitizer is super lazy about style binding and does not help us out.
 * What it does is nuke all rule types except NAMESPACE (@namespace), FONT_FACE
 * (@font-face), and STYLE rules (actual styling).  This means nuking CHARSET
 * (@charset to specify the encoding of the stylesheet if the server did not
 * provide it), IMPORT (@import to reference other stylesheet files), MEDIA
 * (@media media queries), PAGE (@page page box info for paged media),
 * MOZ_KEYFRAMES, MOZ_KEYFRAME, SUPPORTS (@supports provides support for rules
 * conditioned on browser support, but is at risk.)  The only style directive it
 * nukes is "-moz-binding" which is the XBL magic and considered dangerous.
 *
 * Risks: Anything that takes a url() is dangerous insofar as we need to
 * sanitize the url.  XXX for now we just avoid any style that could potentially
 * hold a URI.
 *
 * Good news: We always cram things into an iframe, so we don't need to worry
 * about clever styling escaping out into our UI.
 *
 * New reasons not to allow:
 * - animation: We don't want or need animated wackiness.
 * - slow: Doing the thing is slow!
 */
var LEGAL_STYLES = [
  // animation: animation*
  // URI-like: background, background-image
  'background-color',
  // NB: border-image is not set by the 'border' aliases
  'border',
  'border-bottom', 'border-bottom-color', 'border-bottom-left-radius',
  'border-bottom-right-radius', 'border-bottom-style', 'border-bottom-width',
  'border-color',
  // URI-like: border-image*
  'border-left', 'border-left-color', 'border-left-style', 'border-left-width',
  'border-radius',
  'border-right', 'border-right-color', 'border-right-style',
  'border-right-width',
  'border-style',
  'border-top', 'border-top-color', 'border-top-left-radius',
  'border-top-right-radius', 'border-top-style', 'border-top-width',
  'border-width',
  // slow: box-shadow
  'clear',
  'color',
  'display',
  'float',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'line-height',
  // URI-like: list-style, list-style-image
  'list-style-position',
  'list-style-type',
  'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top',
  'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top',
  'text-align', 'text-align-last',
  'text-decoration', 'text-decoration-color', 'text-decoration-line',
  'text-decoration-style', 'text-indent',
  'vertical-align',
  'white-space',
  'width',
  'word-break', 'word-spacing', 'word-wrap',
];

/**
 * The regular expression to detect nodes that should be passed to stashLinks.
 *
 * ignore-case is not required; the value is checked against the lower-cased tag.
 */
var RE_NODE_NEEDS_TRANSFORM = /^(?:a|area|img)$/;

var RE_CID_URL = /^cid:/i;
var RE_HTTP_URL = /^http(?:s)?/i;
var RE_MAILTO_URL = /^mailto:/i;

var RE_IMG_TAG = /^img$/;

function getAttributeFromList(attrs, name) {
  var len = attrs.length;
  for (var i = 0; i < len; i++) {
    var attr = attrs[i];
    if (attr.name.toLowerCase() === name) {
      return attr;
    }
  }
  return null;
}

/**
 * Transforms src tags, ensure that links are http and transform them too so
 * that they don't actually navigate when clicked on but we can hook them.  (The
 * HTML display iframe is not intended to navigate; we just want to trigger the
 * browser.
 */
function stashLinks(lowerTag, attrs) {
  var classAttr;
  // - img: src
  if (RE_IMG_TAG.test(lowerTag)) {
    // filter out things we might write to, also find the 'class attr'
    attrs = attrs.filter(function(attr) {
      switch (attr.name.toLowerCase()) {
        case 'cid-src':
        case 'ext-src':
          return false;
        case 'class':
          classAttr = attr;
        default:
          return true;
      }
    });

    var srcAttr = getAttributeFromList(attrs, 'src');
    if (srcAttr) {
      if (RE_CID_URL.test(srcAttr.escaped)) {
        srcAttr.name = 'cid-src';
        if (classAttr)
          classAttr.escaped += ' moz-embedded-image';
        else
          attrs.push({ name: 'class', escaped: 'moz-embedded-image' });
        // strip the cid: bit, it is necessarily there and therefore redundant.
        srcAttr.escaped = srcAttr.escaped.substring(4);
      }
      else if (RE_HTTP_URL.test(srcAttr.escaped)) {
        srcAttr.name = 'ext-src';
        if (classAttr)
          classAttr.escaped += ' moz-external-image';
        else
          attrs.push({ name: 'class', escaped: 'moz-external-image' });
      }
    }
  }
  // - a, area: href
  else {
    // filter out things we might write to, also find the 'class attr'
    attrs = attrs.filter(function(attr) {
      switch (attr.name.toLowerCase()) {
        case 'cid-src':
        case 'ext-src':
          return false;
        case 'class':
          classAttr = attr;
        default:
          return true;
      }
    });
    var linkAttr = getAttributeFromList(attrs, 'href');
    if (linkAttr) {
      var link = linkAttr.escaped;
      if (RE_HTTP_URL.test(link) ||
          RE_MAILTO_URL.test(link)) {

        linkAttr.name = 'ext-href';
        if (classAttr)
          classAttr.escaped += ' moz-external-link';
        else
          attrs.push({ name: 'class', escaped: 'moz-external-link' });
      }
      else {
        // paranoia; no known benefit if this got through
        attrs.splice(attrs.indexOf(linkAttr), 1);
      }
    }
  }
  return attrs;
}

var BLEACH_SETTINGS = {
  tags: LEGAL_TAGS,
  strip: true,
  stripComments: true,
  prune: PRUNE_TAGS,
  attributes: LEGAL_ATTR_MAP,
  styles: LEGAL_STYLES,
  asNode: true,
  callbackRegexp: RE_NODE_NEEDS_TRANSFORM,
  callback: stashLinks
};

var BLEACH_SNIPPET_SETTINGS = {
  tags: [],
  strip: true,
  stripComments: true,
  prune: [
    'style',
    'button', // (forms)
    'datalist', // (forms)
    'script', // (script)
    'select', // (forms)
    'svg', // (svg)
    'title' // (non-body)
  ],
  asNode: true,
  maxLength: 100
};

/**
 * @args[
 *   @param[htmlString String]{
 *     An unsanitized HTML string.  The HTML content can be a fully valid HTML
 *     document with 'html' and 'body' tags and such, but most of that extra
 *     structure will currently be discarded.
 *
 *     In the future we may try and process the body and such correctly, but for
 *     now we don't.  This is consistent with many webmail clients who ignore
 *     style tags in the head, etc.
 *   }
 * ]
 * @return[HtmlString]{
 *   The sanitized HTML string wrapped into a div container.
 * }
 */
exports.sanitizeAndNormalizeHtml = function sanitizeAndNormalize(htmlString) {
  return $bleach.clean(htmlString, BLEACH_SETTINGS);
};

/**
 * Derive snippet text from the an HTML string. It will also sanitize it.
 * Note that it unescapes HTML enttities, so best to only use this output
 * in textContent cases.
 */
exports.generateSnippet = function generateSnippet(htmlString) {
  return $bleach.unescapeHTMLEntities($bleach.clean(htmlString,
                                                    BLEACH_SNIPPET_SETTINGS));
};

var BLEACH_SEARCHABLE_TEXT_WITH_QUOTES_SETTINGS = {
  tags: [],
  strip: true,
  stripComments: true,
  prune: [
    'style',
    'button', // (forms)
    'datalist', // (forms)
    'script', // (script)
    'select', // (forms)
    'svg', // (svg)
    'title' // (non-body)
  ],
  asNode: true,
};

var BLEACH_SEARCHABLE_TEXT_WITHOUT_QUOTES_SETTINGS = {
  tags: [],
  strip: true,
  stripComments: true,
  prune: [
    'style',
    'button', // (forms)
    'datalist', // (forms)
    'script', // (script)
    'select', // (forms)
    'svg', // (svg)
    'title', // (non-body),
    // specific to getting rid of quotes:
    'blockquote'
  ],
  asNode: true,
};


/**
 * Produce a textual version of the body of the e-mail suitable for search
 * purposes.  This is basically the same thing as generateSnippet but without a
 * length limit applied and with the ability to either include quoted text or
 * not include quoted text.  We do process the entire document in a go and
 * return the entire results, so this could be fairly inefficient from a
 * memory/time perspective.
 *
 * The following potential enhancements could be fairly good ideas:
 * - Avoid processing the entire HTML document by passing the search string in
 *   or using a generator-type implementation to yield incremental string hunks.
 * - Generate a semantic representation similar/identical to the one used by
 *   quotechew (at least for this searchable text mode.)
 */
exports.generateSearchableTextVersion = function(htmlString, includeQuotes) {
  var settings;
  if (includeQuotes) {
    settings = BLEACH_SEARCHABLE_TEXT_WITH_QUOTES_SETTINGS;
  }
  else {
    settings = BLEACH_SEARCHABLE_TEXT_WITHOUT_QUOTES_SETTINGS;
  }
  var cleaned = $bleach.clean(htmlString, settings);
  return $bleach.unescapeHTMLEntities(cleaned);
};

/**
 * Wrap text/plain content into a serialized HTML string safe for insertion
 * via innerHTML.
 *
 * By default we wrap everything in a 'div' tag with 'br' indicating newlines.
 * Alternately, we could use 'white-space: pre-wrap' if we were more confident
 * about recipients having sufficient CSS support and our own desire to have
 * things resemble text/plain.
 *
 */
exports.wrapTextIntoSafeHTMLString = function(text, wrapTag,
                                              transformNewlines, attrs) {
  if (transformNewlines === undefined) {
    transformNewlines = true;
  }

  wrapTag = wrapTag || 'div';

  text = $bleach.escapePlaintextIntoElementContext(text);
  text = transformNewlines ? text.replace(/\n/g, '<br/>') : text;

  var attributes = '';
  if (attrs) {
    var len = attrs.length;
    for (var i = 0; i < len; i += 2) {
      attributes += ' ' + attrs[i] + '="' +
        $bleach.escapePlaintextIntoAttribute(attrs[i + 1]) + '"';
    }
  }

  return '<' + wrapTag + attributes + '>' + text + '</' + wrapTag + '>';
};

var RE_QUOTE_CHAR = /"/g;

/**
 * Make an HTML attribute value safe.
 */
exports.escapeAttrValue = function(s) {
  return s.replace(RE_QUOTE_CHAR, '&quot;');
};

}); // end define
;
/**
 * Searchfilters provide for local searching by checking each message against
 * one or more tests.  This is similar to Thunderbird's non-global search
 * mechanism.  Although searching in this fashion could be posed as a
 * decorated slice, the point of local search is fast local search, so we
 * don't want to use real synchronized slices.  Instead, we interact directly
 * with a `FolderStorage` to retrieve known headers in an iterative fashion.  We
 * expose this data as a slice and therefore are capable of listening for
 * changes from the server.  We do end up in a possible situation where we have
 * stale local information that we display to the user, but presumably that's
 * an okay thing.
 *
 * The main fancy/unusual thing we do is that all search predicates contribute
 * to a match representation that allows us to know which predicates in an 'or'
 * configuration actually fired and can provide us with the relevant snippets.
 * In order to be a little bit future proof, wherever we provide a matching
 * snippet, we actually provide an object of the following type.  (We could
 * provide a list of the objects, but the reality is that our UI right now
 * doesn't have the space to display more than one match per filter, so it
 * would just complicate things and generate bloat to do more work than
 * providing one match, especially because we provide a boolean match, not a
 * weighted score.
 *
 * @typedef[FilterMatchItem @dict[
 *   @key[text String]{
 *     The string we think is appropriate for display purposes.  For short
 *     things, this might be the entire strings.  For longer things like a
 *     message subject or the message body, this will be a snippet.
 *   }
 *   @key[offset Number]{
 *     If this is a snippet, the offset of the `text` within the greater whole,
 *     which may be zero.  In the event this is not a snippet, the value will
 *     be zero, but you can't use that to disambiguate; use the length of the
 *     `text` for that.
 *   }
 *   @key[matchRuns @listof[@dict[
 *     @key[start]{
 *       An offset relative to the snippet provided in `text` that identifies
 *       the index of the first JS character deemed to be matching.  If you
 *       want to generate highlights from the raw body, you need to add this
 *       offset to the offset of the `FilterMatchItem`.
 *     }
 *     @key[length]{
 *       The length in JS characters of what we deem to be the match.  In the
 *       even there is some horrible multi-JS-character stuff, assume we are
 *       doing the right thing.  If we are not, patch us, not your code.
 *     }
 *   ]]]{
 *     A list of the offsets within the snippet where matches occurred.  We
 *     do this so that in the future if we support any type of stemming or the
 *     like, the front-end doesn't find itself needing to duplicate the logic.
 *     We provide offsets and lengths rather than pre-splitting the strings so
 *     that a complicated UI could merge search results from searches for
 *     different phrases without having to do a ton of reverse engineering.
 *   }
 *   @key[path #:optional Array]{
 *     Identifies the piece in an aggregate where the match occurred by
 *     providing a traversal path to get to the origin of the string.  For
 *     example, if the display name of the 3rd recipient, the path would be
 *     [2 'name'].  If the e-mail address matched, the path would be
 *     [2 'address'].
 *
 *     This is intended to allow the match information to allow the integration
 *     of the matched data in their context.  For example, the recipients list
 *     in the message reader could be re-ordered so that matching addresses
 *     show up first (especially if some are elided), and are not duplicated in
 *     their original position in the list.
 *   }
 * ]
 *
 * We implement filters for the following:
 * - Author
 * - Recipients
 * - Subject
 * - Body, allows ignoring quoted bits
 **/

define(
  'searchfilter',[
    'logic',
    './util',
    './allback',
    './syncbase',
    './date',
    './htmlchew',
    'module',
    'exports'
  ],
  function(
    logic,
    $util,
    allback,
    $syncbase,
    $date,
    htmlchew,
    $module,
    exports
  ) {
var BEFORE = $date.BEFORE,
    ON_OR_BEFORE = $date.ON_OR_BEFORE,
    SINCE = $date.SINCE,
    STRICTLY_AFTER = $date.STRICTLY_AFTER;
var bsearchMaybeExists = $util.bsearchMaybeExists,
    bsearchForInsert = $util.bsearchForInsert;

/**
 * cmpHeaderYoungToOld with matched-header unwrapping
 */
function cmpMatchHeadersYoungToOld(aMatch, bMatch) {
  var a = aMatch.header, b = bMatch.header;
  var delta = b.date - a.date;
  if (delta)
    return delta;
  // favor larger UIDs because they are newer-ish.
  return b.id - a.id;

}

/**
 * This internal function checks if a string or a regexp matches an input
 * and if it does, it returns a 'return value' as RegExp.exec does.  Note that
 * the 'index' of the returned value will be relative to the provided
 * `fromIndex` as if the string had been sliced using fromIndex.
 */
function matchRegexpOrString(phrase, input, fromIndex) {
  if (!input) {
    return null;
  }

  if (phrase instanceof RegExp) {
    return phrase.exec(fromIndex ? input.slice(fromIndex) : input);
  }

  var idx = input.indexOf(phrase, fromIndex);
  if (idx == -1) {
    return null;
  }

  var ret = [ phrase ];
  ret.index = idx - fromIndex;
  return ret;
}

/**
 * Match a single phrase against the author's display name or e-mail address.
 * Match results are stored in the 'author' attribute of the match object as a
 * `FilterMatchItem`.
 *
 * We will favor matches on the display name over the e-mail address.
 */
function AuthorFilter(phrase) {
  this.phrase = phrase;
}
exports.AuthorFilter = AuthorFilter;
AuthorFilter.prototype = {
  needsBody: false,

  testMessage: function(header, body, match) {
    var author = header.author, phrase = this.phrase, ret;
    if ((ret = matchRegexpOrString(phrase, author.name, 0))) {
      match.author = {
        text: author.name,
        offset: 0,
        matchRuns: [{ start: ret.index, length: ret[0].length }],
        path: null,
      };
      return true;
    }
    if ((ret = matchRegexpOrString(phrase, author.address, 0))) {
      match.author = {
        text: author.address,
        offset: 0,
        matchRuns: [{ start: ret.index, length: ret[0].length }],
        path: null,
      };
      return true;
    }
    match.author = null;
    return false;
  },
};

/**
 * Checks any combination of the recipients lists.  Match results are stored
 * as a list of `FilterMatchItem` instances in the 'recipients' attribute with
 * 'to' matches before 'cc' matches before 'bcc' matches.
 *
 * We will stop trying to match after the configured number of matches.  If your
 * UI doesn't have the room for a lot of matches, just pass 1.
 *
 * For a given recipient, if both the display name and e-mail address both
 * match, we will still only report the display name.
 */
function RecipientFilter(phrase, stopAfterNMatches,
                         checkTo, checkCc, checkBcc) {
  this.phrase = phrase;
  this.stopAfter = stopAfterNMatches;
  this.checkTo = checkTo;
  this.checkCc = checkCc;
  this.checkBcc = checkBcc;
}
exports.RecipientFilter = RecipientFilter;
RecipientFilter.prototype = {
  needsBody: true,

  testMessage: function(header, body, match) {
    var phrase = this.phrase, stopAfter = this.stopAfter;
    var matches = [];
    function checkRecipList(list) {
      var ret;
      for (var i = 0; i < list.length; i++) {
        var recip = list[i];
        if ((ret = matchRegexpOrString(phrase, recip.name, 0))) {
          matches.push({
            text: recip.name,
            offset: 0,
            matchRuns: [{ start: ret.index, length: ret[0].length }],
            path: null,
          });
          if (matches.length < stopAfter)
            continue;
          return;
        }
        if ((ret = matchRegexpOrString(phrase, recip.address, 0))) {
          matches.push({
            text: recip.address,
            offset: 0,
            matchRuns: [{ start: ret.index, length: ret[0].length }],
            path: null,
          });
          if (matches.length >= stopAfter)
            return;
        }
      }
    }

    if (this.checkTo && header.to)
      checkRecipList(header.to);
    if (this.checkCc && header.cc && matches.length < stopAfter)
      checkRecipList(header.cc);
    if (this.checkBcc && header.bcc && matches.length < stopAfter)
      checkRecipList(header.bcc);

    if (matches.length) {
      match.recipients = matches;
      return true;
    }
    else {
      match.recipients = null;
      return false;
    }
  },

};

/**
 * Assists in generating a `FilterMatchItem` for a substring that is part of a
 * much longer string where we expect we need to reduce things down to a
 * snippet.
 *
 * Context generating is whitespace-aware and tries to avoid leaving partial
 * words.  In the event our truncation would leave us without any context
 * whatsoever, we will leave partial words.  This is also important for us not
 * being rude to CJK languages (although the number used for contextBefore may
 * be too high for CJK, we may want to have them 'cost' more.)
 *
 * We don't pursue any whitespace normalization here because we want our offsets
 * to line up properly with the real data, but also because we can depend on
 * HTML to help us out and normalize everything anyways.
 */
function snippetMatchHelper(str, start, length, contextBefore, contextAfter,
                            path) {
  if (contextBefore > start)
    contextBefore = start;
  var offset = str.indexOf(' ', start - contextBefore);
  // Just fragment the preceding word if there was no match whatsoever or the
  // whitespace match happened preceding our word or anywhere after it.
  if (offset === -1 || offset >= (start - 1)) {
    offset = start - contextBefore;
  }
  else {
    // do not start on the space character
    offset++;
  }

  var endIdx;
  if (start + length + contextAfter >= str.length) {
    endIdx = str.length;
  }
  else {
    endIdx = str.lastIndexOf(' ', start + length + contextAfter - 1);
    if (endIdx <= start + length) {
      endIdx = start + length + contextAfter;
    }
  }
  var snippet = str.substring(offset, endIdx);

  return {
    text: snippet,
    offset: offset,
    matchRuns: [{ start: start - offset, length: length }],
    path: path
  };
}

/**
 * Searches the subject for a phrase.  Provides snippeting functionality in case
 * of non-trivial subject lengths.   Multiple matches are supported, but
 * subsequent matches will never overlap with previous strings.  (So if you
 * search for 'bob', and the subject is 'bobobob', you will get 2 matches, not
 * 3.)
 *
 * For details on snippet generation, see `snippetMatchHelper`.
 */
function SubjectFilter(phrase, stopAfterNMatches, contextBefore, contextAfter) {
  this.phrase = phrase;
  this.stopAfter = stopAfterNMatches;
  this.contextBefore = contextBefore;
  this.contextAfter = contextAfter;
}
exports.SubjectFilter = SubjectFilter;
SubjectFilter.prototype = {
  needsBody: false,
  testMessage: function(header, body, match) {
    var subject = header.subject;
    // Empty subjects can't match *anything*; no empty regexes allowed, etc.
    if (!subject)
      return false;
    var phrase = this.phrase,
        slen = subject.length,
        stopAfter = this.stopAfter,
        contextBefore = this.contextBefore, contextAfter = this.contextAfter,
        matches = [],
        idx = 0;

    while (idx < slen && matches.length < stopAfter) {
      var ret = matchRegexpOrString(phrase, subject, idx);
      if (!ret)
        break;

      matches.push(snippetMatchHelper(subject, idx + ret.index, ret[0].length,
                                      contextBefore, contextAfter, null));
      idx += ret.index + ret[0].length;
    }

    if (matches.length) {
      match.subject = matches;
      return true;
    }
    else {
      match.subject = null;
      return false;
    }
  },
};

// stable value from quotechew.js; full export regime not currently required.
var CT_AUTHORED_CONTENT = 0x1;
// HTML DOM constants
var ELEMENT_NODE = 1, TEXT_NODE = 3;

/**
 * Searches the body of the message, it can ignore quoted stuff or not.
 * Provides snippeting functionality.  Multiple matches are supported, but
 * subsequent matches will never overlap with previous strings.  (So if you
 * search for 'bob', and the subject is 'bobobob', you will get 2 matches, not
 * 3.)
 *
 * For details on snippet generation, see `snippetMatchHelper`.
 */
function BodyFilter(phrase, matchQuotes, stopAfterNMatches,
                    contextBefore, contextAfter) {
  this.phrase = phrase;
  this.stopAfter = stopAfterNMatches;
  this.contextBefore = contextBefore;
  this.contextAfter = contextAfter;
  this.matchQuotes = matchQuotes;
}
exports.BodyFilter = BodyFilter;
BodyFilter.prototype = {
  needsBody: true,
  testMessage: function(header, body, match) {
    var phrase = this.phrase,
        stopAfter = this.stopAfter,
        contextBefore = this.contextBefore, contextAfter = this.contextAfter,
        matches = [],
        matchQuotes = this.matchQuotes,
        idx, ret;

    for (var iBodyRep = 0; iBodyRep < body.bodyReps.length; iBodyRep++) {
      var bodyType = body.bodyReps[iBodyRep].type,
          bodyRep = body.bodyReps[iBodyRep].content;

      if (bodyType === 'plain') {
        for (var iRep = 0; iRep < bodyRep.length && matches.length < stopAfter;
             iRep += 2) {
          var etype = bodyRep[iRep]&0xf, block = bodyRep[iRep + 1],
              repPath = null;

          // Ignore blocks that are not message-author authored unless we are
          // told to match quotes.
          if (!matchQuotes && etype !== CT_AUTHORED_CONTENT)
            continue;

          for (idx = 0; idx < block.length && matches.length < stopAfter;) {
            ret = matchRegexpOrString(phrase, block, idx);
            if (!ret) {
              break;
            }
            if (repPath === null) {
              repPath = [iBodyRep, iRep];
            }
            matches.push(snippetMatchHelper(
              block, idx + ret.index, ret[0].length,
              contextBefore, contextAfter,
              repPath));
            idx += ret.index + ret[0].length;
          }
        }
      }
      else if (bodyType === 'html') {
        var searchableText = htmlchew.generateSearchableTextVersion(
          bodyRep, this.matchQuotes);
        for (idx = 0; idx < bodyRep.length && matches.length < stopAfter;) {
          ret = matchRegexpOrString(phrase, searchableText, idx);
          if (!ret) {
            break;
          }
          // note: because we heavily discard DOM structure, we are unable to
          // generate a useful path.  The good news is we don't use the path
          // anywhere at this time, so it's not particularly a big deal.
          matches.push(snippetMatchHelper(
            searchableText, idx + ret.index, ret[0].length,
            contextBefore, contextAfter, null));
          idx += ret.index + ret[0].length;
        }
      }
    }

    if (matches.length) {
      match.body = matches;
      return true;
    }
    else {
      match.body = null;
      return false;
    }
  },
};

/**
 * Filters messages using the 'OR' of all specified filters.  We don't need
 * 'AND' right now, but we are not opposed to its inclusion.
 */
function MessageFilterer(filters) {
  this.filters = filters;
  this.bodiesNeeded = false;

  /**
   * How many headers have we tried to match against?  This is for unit tests.
   */
  this.messagesChecked = 0;


  for (var i = 0; i < filters.length; i++) {
    var filter = filters[i];
    if (filter.needsBody)
      this.bodiesNeeded = true;
  }
}
exports.MessageFilterer = MessageFilterer;
MessageFilterer.prototype = {
  /**
   * Check if the message matches the filter.  If it does not, false is
   * returned.  If it does match, a match object is returned whose attributes
   * are defined by the filterers in use.
   */
  testMessage: function(header, body) {
    this.messagesChecked++;

    //console.log('sf: testMessage(', header.suid, header.author.address,
    //            header.subject, 'body?', !!body, ')');
    var matched = false, matchObj = {};
    var filters = this.filters;
    try {
      for (var i = 0; i < filters.length; i++) {
        var filter = filters[i];
        if (filter.testMessage(header, body, matchObj))
          matched = true;
      }
    }
    catch (ex) {
      console.error('filter exception', ex, '\n', ex.stack);
    }
    //console.log('   =>', matched, JSON.stringify(matchObj));
    if (matched)
      return matchObj;
    else
      return false;
  },
};

var CONTEXT_CHARS_BEFORE = 16;
var CONTEXT_CHARS_AFTER = 40;

/**
 *
 */
function SearchSlice(bridgeHandle, storage, phrase, whatToSearch) {
console.log('sf: creating SearchSlice:', phrase);
  this._bridgeHandle = bridgeHandle;
  bridgeHandle.__listener = this;
  // this mechanism never allows triggering synchronization.
  bridgeHandle.userCanGrowDownwards = false;

  this._storage = storage;
  logic.defineScope(this, 'SearchSlice');

  // XXX: This helps test_search_slice do its job, in a world where
  // we no longer have loggers associated with specific instances.
  SearchSlice._TEST_latestInstance = this;

  // These correspond to the range of headers that we have searched to generate
  // the current set of matched headers.  Our matches will always be fully
  // contained by this range.
  //
  // This range can and will shrink when reqNoteRanges is called.  Currently we
  // shrink to the first/last remaining matches.  Strictly speaking, this is too
  // aggressive.  The optimal shrink constraint would be to pick the message
  // adjacent to the first matches we are discarding so that growing by one
  // message would immediately re-find the message.  However it would be even
  // MORE efficient to just maintain a compact list of messages that have
  // matched that we never forget, so we'll just do that when we're feeling all
  // fancy in the future.
  this.startTS = null;
  this.startUID = null;
  this.endTS = null;
  this.endUID = null;

  var filters = [];

  if (phrase) {
    if (!(phrase instanceof RegExp)) {
      phrase = new RegExp(phrase.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,
                                         '\\$&'),
                          'i');
    }

    if (whatToSearch.author)
      filters.push(new AuthorFilter(phrase));
    if (whatToSearch.recipients)
      filters.push(new RecipientFilter(phrase, 1, true, true, true));
    if (whatToSearch.subject)
      filters.push(new SubjectFilter(
                     phrase, 1, CONTEXT_CHARS_BEFORE, CONTEXT_CHARS_AFTER));
    if (whatToSearch.body) {
      filters.push(new BodyFilter(
                     phrase, whatToSearch.body === 'yes-quotes',
                     1, CONTEXT_CHARS_BEFORE, CONTEXT_CHARS_AFTER));
      // A latch for use to make sure that _gotMessages' checkHandle calls are
      // sequential even when _gotMessages is invoked with no headers and
      // !moreMessagesComing.
      //
      // (getBody calls are inherently ordered, but if we have no headers, then
      // the function call that decides whether we fetch more messages needs
      // some way to wait for the body loads to occur.  Previously we used
      // storage.runAfterDeferredCalls, but that's now removed because it was a
      // footgun and its semantics were slightly broken to boot.)
      //
      // TODO: In the future, refactor this logic into a more reusable
      // iterator/stream mechanism so that this class doesn't have to deal with
      // it.
      //
      // The usage pattern is this:
      // - Whenever we have any bodies to fetch, we create a latch and assign it
      //   here.
      // - Whenever we don't have any bodies to fetch, we use a .then() on the
      //   current value of the latch, if there is one.
      // - We clear this in _gotMessages' checkHandle in the case we are calling
      //   reqGrow.  This avoids the latch hanging around with potential GC
      //   implications and provides a nice invariant.
      this._pendingBodyLoadLatch = null;
    }
  }

  this.filterer = new MessageFilterer(filters);

  this._bound_gotOlderMessages = this._gotMessages.bind(this, 1);
  this._bound_gotNewerMessages = this._gotMessages.bind(this, -1);


  this.desiredHeaders = null;
  this.reset();
}
exports.SearchSlice = SearchSlice;
SearchSlice.prototype = {
  /**
   * We are a filtering search slice.  To reduce confusion, we still call this
   * search.
   */
  type: 'search',

  set atTop(val) {
    this._bridgeHandle.atTop = val;
  },
  get atBottom() {
    return this._bridgeHandle.atBottom;
  },
  set atBottom(val) {
    this._bridgeHandle.atBottom = val;
  },
  set headerCount(val) {
    if (this._bridgeHandle)
      this._bridgeHandle.headerCount = val;
    return val;
  },

  /**
   * How many messages should we pretend exist when we haven't yet searched all
   * of the folder?
   *
   * As a lazy search, we have no idea how many messages actually match a user's
   * search.  We now assume a virtual scroll list that sizes itself based on
   * knowing how many headers there are using headerCount and thus no longer
   * really cares about atBottom (at least until we start automatically
   * synchronizing new messages.)
   *
   * 1 is a pretty good value for this since it only takes 1 lied-about message
   * to trigger us.  Also, the UI will show the "I'm still loading stuff!"
   * fake message until we find something...
   *
   * TODO: Either stop lying or come up with a better rationale for this.  All
   * we really want is for the UI to remember to ask us for more stuff, and all
   * the UI probably wants is to show some type of search-specific string that
   * says "Hey, I'm searching here!  Give it a minute!".  Not doing this right
   * now because that results in all kinds of scope creep and such.
   */
  IMAGINARY_MESSAGE_COUNT_WHEN_NOT_AT_BOTTOM: 1,

  reset: function() {
    // misnomer but simplifies cutting/pasting/etc.  Really an array of
    // { header: header, matches: matchObj }
    this.headers = [];
    this.headerCount = 0;
    // Track when we are still performing the initial database scan so that we
    // can ignore dynamic additions/modifications.  The initial database scan
    // is currently not clever enough to deal with concurrent manipulation, so
    // we just ignore all such events.  This has an extremely low probability
    // of resulting in false negatives.
    this._loading = true;
    this.startTS = null;
    this.startUID = null;
    this.endTS = null;
    this.endUID = null;
    // Fetch as many headers as we want in our results; we probably will have
    // less than a 100% hit-rate, but there isn't much savings from getting the
    // extra headers now, so punt on those.
    this._storage.getMessagesInImapDateRange(
      0, null, this.desiredHeaders, this.desiredHeaders,
      this._gotMessages.bind(this, 1));
  },

  _gotMessages: function(dir, headers, moreMessagesComing) {
    if (!this._bridgeHandle) {
      return;
    }
    // conditionally indent messages that are non-notable callbacks since we
    // have more messages coming.  sanity measure for asuth for now.
    var logPrefix = moreMessagesComing ? 'sf: ' : 'sf:';
    console.log(logPrefix, 'gotMessages', headers.length, 'more coming?',
                moreMessagesComing);
    // update the range of what we have seen and searched
    if (headers.length) {
      if (dir === -1) { // (more recent)
        this.endTS = headers[0].date;
        this.endUID = headers[0].id;
      }
      else { // (older)
        var lastHeader = headers[headers.length - 1];
        this.startTS = lastHeader.date;
        this.startUID = lastHeader.id;
        if (this.endTS === null) {
          this.endTS = headers[0].date;
          this.endUID = headers[0].id;
        }
      }
    }

    /**
     * Called once we have all the data needed to actually check for matches.
     * Specifically, we may have had to fetch the bodies.
     *
     * @param {MailHeader[]} headers
     * @param {Object} [resolvedGetBodyCalls]
     *   The results of an allback.latch() resolved by getBody calls.  The
     *   keys are the headers' suid's and the values are the gotBody argument
     *   callback list, which will look like [MailBody, header/message suid].
     */
    var checkHandle = function checkHandle(headers, resolvedGetBodyCalls) {
      if (!this._bridgeHandle) {
        return;
      }

      // run a filter on these
      var matchPairs = [];
      for (i = 0; i < headers.length; i++) {
        var header = headers[i],
            body = resolvedGetBodyCalls ? resolvedGetBodyCalls[header.id][0] :
                                          null;
        this._headersChecked++;
        var matchObj = this.filterer.testMessage(header, body);
        if (matchObj)
          matchPairs.push({ header: header, matches: matchObj });
      }

      var atTop = this.atTop = this._storage.headerIsYoungestKnown(
                    this.endTS, this.endUID);
      var atBottom = this.atBottom = this._storage.headerIsOldestKnown(
                       this.startTS, this.startUID);
      var canGetMore = (dir === -1) ? !atTop : !atBottom;
      var willHave = this.headers.length + matchPairs.length,
          wantMore = !moreMessagesComing &&
                     (willHave < this.desiredHeaders) &&
                     canGetMore;
      if (matchPairs.length) {
        console.log(logPrefix, 'willHave', willHave, 'of', this.desiredHeaders,
                    'want more?', wantMore);
        var insertAt = dir === -1 ? 0 : this.headers.length;
        logic(this, 'headersAppended', { insertAt: insertAt,
                                         matchPairs: matchPairs });

        this.headers.splice.apply(this.headers,
                                  [insertAt, 0].concat(matchPairs));
        this.headerCount = this.headers.length +
          (atBottom ? 0 : this.IMAGINARY_MESSAGE_COUNT_WHEN_NOT_AT_BOTTOM);

        this._bridgeHandle.sendSplice(
          insertAt, 0, matchPairs, true,
          moreMessagesComing || wantMore);

        if (wantMore) {
          console.log(logPrefix, 'requesting more because want more');
          this.reqGrow(dir, false, true);
        }
        else if (!moreMessagesComing) {
          console.log(logPrefix, 'stopping (already reported), no want more.',
                      'can get more?', canGetMore);
          this._loading = false;
          this.desiredHeaders = this.headers.length;
        }
      }
      // XXX this branch is largely the same as in the prior case except for
      // specialization because the sendSplice call obviates the need to call
      // sendStatus.  Consider consolidation.
      else if (!moreMessagesComing) {
        // Update our headerCount, potentially reducing our headerCount by 1!
        this.headerCount = this.headers.length +
          (atBottom ? 0 : this.IMAGINARY_MESSAGE_COUNT_WHEN_NOT_AT_BOTTOM);

        // If there aren't more messages coming, we either need to get more
        // messages (if there are any left in the folder that we haven't seen)
        // or signal completion.  We can use our growth function directly since
        // there are no state invariants that will get confused.
        if (wantMore) {
          console.log(logPrefix,
                      'requesting more because no matches but want more');
          this._pendingBodyLoadLatch = null;
          this.reqGrow(dir, false, true);
        }
        else {
          console.log(logPrefix, 'stopping, no matches, no want more.',
                      'can get more?', canGetMore);
          this._bridgeHandle.sendStatus('synced', true, false);
          // We can now process dynamic additions/modifications
          this._loading = false;
          this.desiredHeaders = this.headers.length;
        }
      }
      // (otherwise we need to wait for the additional messages to show before
      //  doing anything conclusive)
    }.bind(this);

    if (this.filterer.bodiesNeeded) {
      // To batch our updates to the UI, just get all the bodies then advance
      // to the next stage of processing.

      // See the docs in the constructor on _pendingBodyLoadLatch.
      if (headers.length) {
        var latch = this._pendingBodyLoadLatch = allback.latch();
        for (var i = 0; i < headers.length; i++) {
          var header = headers[i];
          this._storage.getMessageBody(
            header.suid, header.date, latch.defer(header.id));
        }
        latch.then(checkHandle.bind(null, headers));
      } else {
        // note that we are explicitly binding things so the existing result
        // from _pendingBodyLoadLatch will be positionally extra and unused.
        var deferredCheck = checkHandle.bind(null, headers, null);
        if (this._pendingBodyLoadLatch) {
          this._pendingBodyLoadLatch.then(deferredCheck);
        } else {
          deferredCheck();
        }
      }
    }
    else {
      checkHandle(headers, null);
    }
  },

  refresh: function() {
    // no one should actually call this.  If they do, we absolutely don't want
    // to do anything since we may span a sufficiently large time-range that it
    // would be insane for our current/baseline IMAP support.  Eventually, on
    // QRESYNC-capable IMAP and things like ActiveSync/POP3 where sync is
    // simple it would make sense to pass this through.
  },

  /**
   * We are hearing about a new header (possibly with body), or have transformed
   * an onHeaderModified notification into onHeaderAdded since there's a
   * possibility the header may now match the search filter.
   *
   * It is super important to keep in mind that / be aware of:
   * - We only get called about headers that are inside the range we already
   *   cover or if FolderStorage thinks the slice should grow because of being
   *   latched to the top or something like that.
   * - We maintain the start/end ranges based on the input to the filtering step
   *   and not the filtered results.  So we always want to apply the start/end
   *   update logic.
   */
  onHeaderAdded: function(header, body) {
    if (!this._bridgeHandle || this._loading) {
      return;
    }

    // COPY-N-PASTE: logic from MailSlice.onHeaderAdded
    if (this.startTS === null ||
        BEFORE(header.date, this.startTS)) {
      this.startTS = header.date;
      this.startUID = header.id;
    }
    else if (header.date === this.startTS &&
             header.id < this.startUID) {
      this.startUID = header.id;
    }
    if (this.endTS === null ||
        STRICTLY_AFTER(header.date, this.endTS)) {
      this.endTS = header.date;
      this.endUID = header.id;
    }
    else if (header.date === this.endTS &&
             header.id > this.endUID) {
      this.endUID = header.id;
    }
    // END COPY-N-PASTE

    var matchObj = this.filterer.testMessage(header, body);
    if (!matchObj) {
      // In the range-extending case, addMessageHeader may help us out by
      // boosting our desiredHeaders.  It does this assuming we will then
      // include the header like a normal slice, so we need to correct for this
      // be capping ourselves back to desiredHeaders again
      this.desiredHeaders = this.headers.length;
      return;
    }

    var wrappedHeader = { header: header, matches: matchObj };
    var idx = bsearchForInsert(this.headers, wrappedHeader,
                               cmpMatchHeadersYoungToOld);

    // We don't need to do headers.length checking here because the caller
    // checks this for us sufficiently.  (The inclusion of the logic in
    // MailSlice.onHeaderAdded relates to slices directly fed by the sync
    // process which may be somewhat moot but definite is not something that
    // happens to us, a search slice.)
    //
    // For sanity, we should make sure desiredHeaders doesn't get out-of-wack,
    // though.
    this.desiredHeaders = this.headers.length;

    logic(this, 'headerAdded', { index: idx, header: wrappedHeader });
    this.headers.splice(idx, 0, wrappedHeader);
    this.headerCount = this.headers.length +
      (this.atBottom ? 0 : this.IMAGINARY_MESSAGE_COUNT_WHEN_NOT_AT_BOTTOM);
    this._bridgeHandle.sendSplice(idx, 0, [wrappedHeader], false, false);
  },

  /**
   * As a shortcut on many levels, we only allow messages to transition from not
   * matching to matching.  This is logically consistent since we don't support
   * filtering on the user-mutable aspects of a message (flags / folder / etc.),
   * but can end up downloading more pieces of a message's body which can result
   * in a message starting to match.
   *
   * This is also a correctness shortcut since we rely on body-hints to be
   * provided by synchronization logic.  They will be provided when the body is
   * being updated since we always update the header at the same time, but will
   * not be provided in the case of flag-only changes.  Obviously it would suck
   * if the flagged state of a message changed and then we dropped the message
   * from the match list because we had no body against which to match.  There
   * are things we could do to track body-matchingness indepenently of the flags
   * but it's simplest to just only allow the 1-way transition for now.
   */
  onHeaderModified: function(header, body) {
    if (!this._bridgeHandle || this._loading) {
      return;
    }


    var wrappedHeader = { header: header, matches: null };
    var idx = bsearchMaybeExists(this.headers, wrappedHeader,
                                 cmpMatchHeadersYoungToOld);
    if (idx !== null) {
      // Update the header in the match and send it out.
      var existingMatch = this.headers[idx];
      existingMatch.header = header;
      logic(this, 'headerModified', { index: idx,
                                      existingMatch: existingMatch });
      this._bridgeHandle.sendUpdate([idx, existingMatch]);
      return;
    }

    // No transition is possible if we don't care about bodies or don't have one
    if (!this.filterer.bodiesNeeded || !body) {
      return;
    }

    // Okay, let the add logic see if it fits.
    this.onHeaderAdded(header, body);
  },

  onHeaderRemoved: function(header) {
    if (!this._bridgeHandle) {
      return;
    }
    // NB: We must always apply this logic since our range characterizes what we
    // have searched/filtered, not what's inside us.  Unfortunately, when this
    // does happen, we will drastically decrease our scope to the mesages
    // we have matched.  What we really need for maximum correctness is to be
    // able to know the message namers on either side of the header being
    // deleted.  This could be interrogated by us or provided by the caller.
    //
    // (This would not necessitate additional block loads since if the header is
    // at either end of its containing block, then the namer for the thing on
    // the other side is known from the message namer defining the adjacent
    // block.)
    //
    // So, TODO: Do not drastically decrease range / lose 'latch to new'
    // semantics when the messages bounding our search get deleted.
    //
    // COPY-N-PASTE-N-MODIFY: logic from MailSlice.onHeaderRemoved
    if (header.date === this.endTS && header.id === this.endUID) {
      if (!this.headers.length) {
        this.endTS = null;
        this.endUID = null;
      }
      else {
        this.endTS = this.headers[0].header.date;
        this.endUID = this.headers[0].header.id;
      }
    }
    if (header.date === this.startTS && header.id === this.startUID) {
      if (!this.headers.length) {
        this.startTS = null;
        this.startUID = null;
      }
      else {
        var lastHeader = this.headers[this.headers.length - 1];
        this.startTS = lastHeader.header.date;
        this.startUID = lastHeader.header.id;
      }
    }
    // END COPY-N-PASTE

    var wrappedHeader = { header: header, matches: null };
    var idx = bsearchMaybeExists(this.headers, wrappedHeader,
                                 cmpMatchHeadersYoungToOld);
    if (idx !== null) {
      logic(this, 'headerRemoved', { index: idx, header: wrappedHeader });
      this.headers.splice(idx, 1);
      this.headerCount = this.headers.length +
        (this.atBottom ? 0 : this.IMAGINARY_MESSAGE_COUNT_WHEN_NOT_AT_BOTTOM);
      this._bridgeHandle.sendSplice(idx, 1, [], false, false);
    }
  },

  reqNoteRanges: function(firstIndex, firstSuid, lastIndex, lastSuid) {
    // when shrinking our range, we could try and be clever and use the values
    // of the first thing we are updating to adjust our range, but it's safest/
    // easiest right now to just use what we are left with.

    // THIS CODE IS COPIED FROM `MailSlice`'s reqNoteRanges implementation

    var i;
    // - Fixup indices if required
    if (firstIndex >= this.headers.length ||
        this.headers[firstIndex].suid !== firstSuid) {
      firstIndex = 0; // default to not splicing if it's gone
      for (i = 0; i < this.headers.length; i++) {
        if (this.headers[i].suid === firstSuid) {
          firstIndex = i;
          break;
        }
      }
    }
    if (lastIndex >= this.headers.length ||
        this.headers[lastIndex].suid !== lastSuid) {
      for (i = this.headers.length - 1; i >= 0; i--) {
        if (this.headers[i].suid === lastSuid) {
          lastIndex = i;
          break;
        }
      }
    }

    // - Perform splices as required
    // (high before low to avoid index changes)
    if (lastIndex + 1 < this.headers.length) {
      this.atBottom = false;
      this.userCanGrowDownwards = false;
      var delCount = this.headers.length - lastIndex  - 1;
      this.desiredHeaders -= delCount;

      this.headers.splice(lastIndex + 1, this.headers.length - lastIndex - 1);
      // (we are definitely not atBottom, so lie, lie, lie!)
      this.headerCount = this.headers.length +
        this.IMAGINARY_MESSAGE_COUNT_WHEN_NOT_AT_BOTTOM;

      this._bridgeHandle.sendSplice(
        lastIndex + 1, delCount, [],
        // This is expected; more coming if there's a low-end splice
        true, firstIndex > 0);

      var lastHeader = this.headers[lastIndex].header;
      this.startTS = lastHeader.date;
      this.startUID = lastHeader.id;
    }
    if (firstIndex > 0) {
      this.atTop = false;
      this.desiredHeaders -= firstIndex;

      this.headers.splice(0, firstIndex);
      this.headerCount = this.headers.length +
        (this.atBottom ? 0 : this.IMAGINARY_MESSAGE_COUNT_WHEN_NOT_AT_BOTTOM);

      this._bridgeHandle.sendSplice(0, firstIndex, [], true, false);

      var firstHeader = this.headers[0].header;
      this.endTS = firstHeader.date;
      this.endUID = firstHeader.id;
    }
  },

  reqGrow: function(dirMagnitude, userRequestsGrowth, autoDoNotDesireMore) {
    // If the caller is impatient and calling reqGrow on us before we are done,
    // ignore them.  (Otherwise invariants will be violated, etc. etc.)  This
    // is okay from an event perspective since we will definitely generate a
    // completion notification, so the only way this could break the caller is
    // if they maintained a counter of complete notifications to wait for.  But
    // they cannot/must not do that since you can only ever get one of these!
    // (And the race/confusion is inherently self-solving for naive code.)
    if (!autoDoNotDesireMore && this._loading) {
      return;
    }

    // Stop processing dynamic additions/modifications while this is happening.
    this._loading = true;
    var count;
    if (dirMagnitude < 0) {
      if (dirMagnitude === -1) {
        count = $syncbase.INITIAL_FILL_SIZE;
      }
      else {
        count = -dirMagnitude;
      }
      if (!autoDoNotDesireMore) {
        this.desiredHeaders += count;
      }
      this._storage.getMessagesAfterMessage(this.endTS, this.endUID,
                                            count,
                                            this._gotMessages.bind(this, -1));
    }
    else {
      if (dirMagnitude <= 1) {
        count = $syncbase.INITIAL_FILL_SIZE;
      }
      else {
        count = dirMagnitude;
      }
      if (!autoDoNotDesireMore) {
        this.desiredHeaders += count;
      }
      this._storage.getMessagesBeforeMessage(this.startTS, this.startUID,
                                             count,
                                             this._gotMessages.bind(this, 1));
    }
  },

  die: function() {
    this._storage.dyingSlice(this);
    this._bridgeHandle = null;
  },
};

}); // end define
;
define('wakelocks',['require','./worker-router'],function(require) {
  

  var $router = require('./worker-router');
  var sendMessage = $router.registerCallbackType('wakelocks');

  /**
   * SmartWakeLock: A renewable, failsafe Wake Lock manager.
   *
   * Example:
   *   var lock = new SmartWakeLock({ locks: ['cpu', 'screen'] });
   *   // do things; if we do nothing, the lock expires eventually.
   *   lock.renew(); // Keep the lock around for a while longer.
   *   // Some time later...
   *   lock.unlock();
   *
   * Grab a set of wake locks, holding on to them until either a
   * failsafe timeout expires, or you release them.
   *
   * @param {int} opts.timeout
   *   Timeout, in millseconds, to hold the lock if you fail to call
   *   .unlock().
   * @param {String[]} opts.locks
   *   Array of strings, e.g. ['cpu', 'wifi'], representing the locks
   *   you wish to acquire.
   */
  function SmartWakeLock(opts) {
    this.timeoutMs = opts.timeout || SmartWakeLock.DEFAULT_TIMEOUT_MS;
    var locks = this.locks = {}; // map of lockType -> wakeLockInstance

    this._timeout = null; // The ID returned from our setTimeout.

    // Since we have to fling things over the bridge, requesting a
    // wake lock here is asynchronous. Using a Promise to track when
    // we've successfully acquired the locks (and blocking on it in
    // the methods on this class) ensures that folks can ignore the
    // ugly asynchronous parts and not worry about when things happen
    // under the hood.
    this._readyPromise = Promise.all(opts.locks.map(function(type) {
      return new Promise(function(resolve, reject) {
        sendMessage('requestWakeLock', [type], function(lockId) {
          locks[type] = lockId;
          resolve();
        });
      });
    })).then(function() {
      this._debug('Acquired', this, 'for', this.timeoutMs + 'ms');
      // For simplicity of implementation, we reuse the `renew` method
      // here to add the initial `opts.timeout` to the unlock clock.
      this.renew(); // Start the initial timeout.
    }.bind(this));
  }

  SmartWakeLock.DEFAULT_TIMEOUT_MS = 45000;

  SmartWakeLock.prototype = {
    /**
     * Renew the timeout, if you're certain that you still need to hold
     * the locks longer.
     */
    renew: function(/* optional */ reason, callback) {
      if (typeof reason === 'function') {
        callback = reason;
        reason = null;
      }

      // Wait until we've successfully acquired the wakelocks, then...
      this._readyPromise.then(function() {
        // If we've already set a timeout, we'll clear that first.
        // (Otherwise, we're just loading time on for the first time,
        // and don't need to clear or log anything.)
        if (this._timeout) {
          clearTimeout(this._timeout);
          this._debug('Renewing', this, 'for another', this.timeoutMs + 'ms' +
                      (reason ? ' (reason: ' + reason + ')' : '') + ',',
                      'would have expired in ' +
                      (this.timeoutMs - (Date.now() - this._timeLastRenewed)) +
                      'ms if not renewed.');
        }

        this._timeLastRenewed = Date.now(); // Solely for debugging.

        this._timeout = setTimeout(function() {
          this._debug('*** Unlocking', this,
                      'due to a TIMEOUT. Did you remember to unlock? ***');
          this.unlock.bind(this);
        }.bind(this), this.timeoutMs);

        callback && callback();
      }.bind(this));
    },

    /**
     * Unlock all the locks. This happens asynchronously behind the
     * scenes; if you want to block on completion, hook onto the
     * Promise returned from this function.
     */
    unlock: function(/* optional */ reason) {
      // Make sure weve been locked before we try to unlock. Also,
      // return the promise, throughout the chain of calls here, so
      // that listeners can listen for completion if they need to.
      return this._readyPromise.then(function() {
        var desc = this.toString();

        var locks = this.locks;
        this.locks = {}; // Clear the locks.
        clearTimeout(this._timeout);

        // Wait for all of them to successfully unlock.
        return Promise.all(Object.keys(locks).map(function(type) {
          return new Promise(function(resolve, reject) {
            sendMessage('unlock', [locks[type]], function(lockId) {
              resolve();
            });
          });
        })).then(function() {
          this._debug('Unlocked', desc + '.',
                      (reason ? 'Reason: ' + reason : ''));
        }.bind(this));

      }.bind(this));
    },

    toString: function() {
      return Object.keys(this.locks).join('+') || '(no locks)';
    },

    _debug: function() {
      var args = Array.slice(arguments);
      console.log.apply(console, ['SmartWakeLock:'].concat(args));
    }
  };

  return {
    SmartWakeLock: SmartWakeLock
  };

});

/**
 * This file implements a function which performs a
 * a streaming search of a folder to determine the count of
 * headers which match a particular filter.
 */


define(
  'headerCounter',[
    'module',
    'exports'
  ],
  function(
    $module,
    exports) {


exports.countHeaders = function(storage, filter, options, callback) {

  var fetchClobber = null;
  if (typeof options === "function") {
    callback = options;
  } else {
    fetchClobber = options.fetchSize;
  }
  var matched = 0;

  // Relatively arbitrary value, but makes sure we don't use too much
  // memory while streaming
  var fetchSize = fetchClobber || 100;
  var startTS = null;
  var startUID = null;

  function gotMessages(dir, callback, headers, moreMessagesComing) {
    // conditionally indent messages that are non-notable callbacks since we
    // have more messages coming.  sanity measure for asuth for now.
    var logPrefix = moreMessagesComing ? 'sf: ' : 'sf:';
    console.log(logPrefix, 'gotMessages', headers.length, 'more coming?',
                moreMessagesComing);
    // update the range of what we have seen and searched
    if (headers.length) {
        var lastHeader = headers[headers.length - 1];
        startTS = lastHeader.date;
        startUID = lastHeader.id;
    }

    var checkHandle = function checkHandle(headers) {
      // Update the matched count
      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        var isMatch = filter(header);
        if (isMatch) {
          matched++;
        }
      }

      var atBottom = storage.headerIsOldestKnown(
                        startTS, startUID);
      var canGetMore = !atBottom,
          wantMore = !moreMessagesComing && canGetMore;

      if (wantMore) {
        console.log(logPrefix, 'requesting more because want more');
        getNewMessages(dir, false, true, callback);
      } else if (!moreMessagesComing) {
        callback(matched);
      }

      // (otherwise we need to wait for the additional messages to show before
      //  doing anything conclusive)
    };

    checkHandle(headers);
  }


  function getNewMessages (dirMagnitude, userRequestsGrowth, autoDoNotDesireMore,
    callback) {

    storage.flushExcessCachedBlocks('countHeaders');

    storage.getMessagesBeforeMessage(startTS, startUID,
        fetchSize, gotMessages.bind(null, 1, callback));

  }

  storage.getMessagesInImapDateRange(
    0, null, fetchSize, fetchSize,
    gotMessages.bind(null, 1, callback));

};

}); // end define
;
/**
 * Mix-ins for account job functionality where the code is reused.
 **/

define(
  'jobmixins',[
    './worker-router',
    './util',
    './allback',
    './wakelocks',
    './date',
    './syncbase',
    './mailslice',
    './headerCounter',
    'logic',
    'exports',
    'require'
  ],
  function(
    $router,
    $util,
    $allback,
    $wakelocks,
    $date,
    $sync,
    $mailslice,
    $count,
    logic,
    exports,
    require
  ) {

var sendMessage = $router.registerCallbackType('devicestorage');

exports.local_do_modtags = function(op, doneCallback, undo) {
  var self = this;
  var addTags = undo ? op.removeTags : op.addTags,
      removeTags = undo ? op.addTags : op.removeTags;
  var mutationsPerformed = 0;
  this._partitionAndAccessFoldersSequentially(
    op.messages,
    false,
    function perFolder(ignoredConn, storage, headers, namers, callWhenDone) {
      var waitingOn = headers.length;
      function next() {
        if (--waitingOn === 0)
          callWhenDone();
      }
      for (var iHeader = 0; iHeader < headers.length; iHeader++) {
        var header = headers[iHeader];
        var iTag, tag, existing, modified = false;
        if (addTags) {
          for (iTag = 0; iTag < addTags.length; iTag++) {
            tag = addTags[iTag];
            // The list should be small enough that native stuff is better
            // than JS bsearch.
            existing = header.flags.indexOf(tag);
            if (existing !== -1)
              continue;
            header.flags.push(tag);
            mutationsPerformed++;
            if (tag === '\\Seen') {
              storage.folderMeta.unreadCount--;
            }
            header.flags.sort(); // (maintain sorted invariant)
            modified = true;
          }
        }
        if (removeTags) {
          for (iTag = 0; iTag < removeTags.length; iTag++) {
            tag = removeTags[iTag];
            existing = header.flags.indexOf(tag);
            if (existing === -1)
              continue;
            header.flags.splice(existing, 1);
            mutationsPerformed++;
            if (tag === '\\Seen') {
              storage.folderMeta.unreadCount++;
            }
            modified = true;
          }
        }
        storage.updateMessageHeader(header.date, header.id, false,
                                    header, /* body hint */ null, next);
      }
    },
    function() {
      // If we didn't actually do anything, then we don't actually need to do
      // anything on the server either and we can skip it.
      //
      // Note that this does get us into some edge cases around the semantics of
      // undo.  Before this change, "undo" always just meant "do the opposite
      // modification of what I said" which is notably different from "undo the
      // things you actually just did" which gave rise to the (currently
      // unfixed) https://bugzil.la/997496.  And so with this change, we'll do
      // the "right" thing, but in other cases we'll still do the "wrong" thing.
      if (mutationsPerformed === 0) {
        op.serverStatus = 'skip';
      }
      doneCallback(null, null, true);
    },
    null, // connection loss does not happen for local-only ops
    undo,
    'modtags');
};

exports.local_undo_modtags = function(op, callback) {
  // Undoing is just a question of flipping the add and remove lists.
  return this.local_do_modtags(op, callback, true);
};


exports.local_do_move = function(op, doneCallback, targetFolderId) {
  // create a scratch field to store the guid's for check purposes
  op.guids = {};
  var nukeServerIds = !this.resilientServerIds;

  var stateDelta = this._stateDelta, addWait = 0, self = this;
  if (!stateDelta.moveMap)
    stateDelta.moveMap = {};
  if (!stateDelta.serverIdMap)
    stateDelta.serverIdMap = {};
  if (!targetFolderId)
    targetFolderId = op.targetFolder;

  this._partitionAndAccessFoldersSequentially(
    op.messages, false,
    function perFolder(ignoredConn, sourceStorage, headers, namers,
                       perFolderDone) {
      var count = 0;
      // -- open the target folder for processing
      function targetOpened_nowProcess(ignoredConn, _targetStorage) {
        targetStorage = _targetStorage;
        processNext();
      }
      // -- get the body for the next header (or be done)
      function processNext() {
        if (iNextHeader >= headers.length) {
          perFolderDone();
          return;
        }
        header = headers[iNextHeader++];
        sourceStorage.getMessageBody(header.suid, header.date,
                                     gotBody_nowDelete);
      }
      // -- delete the header and body from the source
      function gotBody_nowDelete(_body) {
        body = _body;

        // We need an entry in the server id map if we are moving/deleting it.
        // We don't need this if we're moving a message to the folder it's
        // already in, but it doesn't hurt anything.
        if (header.srvid)
          stateDelta.serverIdMap[header.suid] = header.srvid;

        if (sourceStorage === targetStorage ||
            // localdraft messages aren't real, and so must not be
            // moved and are only eligible for nuke deletion. But they
            // _can_ be moved to the outbox, and vice versa!
            (sourceStorage.folderMeta.type === 'localdrafts' &&
             targetStorage.folderMeta.type !== 'outbox') ||
            (sourceStorage.folderMeta.type === 'outbox' &&
             targetStorage.folderMeta.type !== 'localdrafts')) {
          if (op.type === 'move') {
            // A move from a folder to itself is a no-op.
            processNext();
          }
          else { // op.type === 'delete'
            // If the op is a delete and the source and destination folders
            // match, we're deleting from trash, so just perma-delete it.
            sourceStorage.deleteMessageHeaderAndBodyUsingHeader(
              header, processNext);
          }
        }
        else {
          sourceStorage.deleteMessageHeaderAndBodyUsingHeader(
            header, deleted_nowAdd);
        }
      }
      // -- add the header/body to the target folder
      function deleted_nowAdd() {
        var sourceSuid = header.suid;

        // - update id fields
        header.id = targetStorage._issueNewHeaderId();
        header.suid = targetStorage.folderId + '/' + header.id;

        op.messages[count].moveSuid = header.suid;
        count++;
        if (nukeServerIds)
          header.srvid = null;

        stateDelta.moveMap[sourceSuid] = header.suid;
        addWait = 2;
        targetStorage.addMessageHeader(header, body, added);
        targetStorage.addMessageBody(header, body, added);
      }
      function added() {
        if (--addWait !== 0)
          return;
        processNext();
      }
      var iNextHeader = 0, targetStorage = null, header = null, body = null,
          addWait = 0;

      // If the source folder and the target folder are the same, don't try
      // to access the target folder!
      if (sourceStorage.folderId === targetFolderId) {
        targetStorage = sourceStorage;
        processNext();
      }
      else {
        self._accessFolderForMutation(targetFolderId, false,
                                      targetOpened_nowProcess, null,
                                      'local move target');
      }
    },
    function() {
      // Pass along the moveMap as the move's result, so that the
      // frontend can directly obtain a reference to the moved
      // message. This is used when tapping a message in the outbox
      // folder (wherein we expect it to be moved to localdrafts and
      // immediately edited).
      doneCallback(null, stateDelta.moveMap, true);
    },
    null, // connection loss does not happen for local-only ops
    false,
    'local move source');
};

// XXX implement!
exports.local_undo_move = function(op, doneCallback, targetFolderId) {
  doneCallback(null);
};

exports.local_do_delete = function(op, doneCallback) {
  var trashFolder = this.account.getFirstFolderWithType('trash');
  if (!trashFolder) {
    this.account.ensureEssentialOnlineFolders();
    doneCallback('defer');
    return;
  }
  this.local_do_move(op, doneCallback, trashFolder.id);
};

exports.local_undo_delete = function(op, doneCallback) {
  var trashFolder = this.account.getFirstFolderWithType('trash');
  if (!trashFolder) {
    // the absence of the trash folder when it must have previously existed is
    // confusing.
    doneCallback('unknown');
    return;
  }
  this.local_undo_move(op, doneCallback, trashFolder.id);
};

exports.do_download = function(op, callback) {
  var self = this;
  var idxLastSlash = op.messageSuid.lastIndexOf('/'),
      folderId = op.messageSuid.substring(0, idxLastSlash);

  var folderConn, folderStorage;
  // Once we have the connection, get the current state of the body rep.
  var gotConn = function gotConn(_folderConn, _folderStorage) {
    folderConn = _folderConn;
    folderStorage = _folderStorage;

    folderStorage.getMessageHeader(op.messageSuid, op.messageDate, gotHeader);
  };
  var deadConn = function deadConn() {
    callback('aborted-retry');
  };
  // Now that we have the body, we can know the part numbers and eliminate /
  // filter out any redundant download requests.  Issue all the fetches at
  // once.
  var partsToDownload = [], storePartsTo = [], registerDownload = [],
      header, bodyInfo, uid;
  var gotHeader = function gotHeader(_headerInfo) {
    header = _headerInfo;
    uid = header.srvid;
    folderStorage.getMessageBody(op.messageSuid, op.messageDate, gotBody);
  };
  var gotBody = function gotBody(_bodyInfo) {
    bodyInfo = _bodyInfo;
    var i, partInfo;
    for (i = 0; i < op.relPartIndices.length; i++) {
      partInfo = bodyInfo.relatedParts[op.relPartIndices[i]];
      partsToDownload.push(partInfo);
      storePartsTo.push('idb');
      registerDownload.push(false);
    }
    for (i = 0; i < op.attachmentIndices.length; i++) {
      partInfo = bodyInfo.attachments[op.attachmentIndices[i]];
      partsToDownload.push(partInfo);
      // right now all attachments go in sdcard
      storePartsTo.push('sdcard');
      registerDownload.push(op.registerAttachments[i]);
    }

    folderConn.downloadMessageAttachments(uid, partsToDownload, gotParts);
  };

  var downloadErr = null;
  var gotParts = function gotParts(err, bodyBlobs) {
    if (!bodyBlobs || bodyBlobs.length !== partsToDownload.length) {
      callback(err, null, false);
      return;
    }
    downloadErr = err;
    var pendingCbs = 1;
    function next() {
      if (!--pendingCbs) {
        done();
      }
    }

    for (var i = 0; i < partsToDownload.length; i++) {
      // Because we should be under a mutex, this part should still be the
      // live representation and we can mutate it.
      var partInfo = partsToDownload[i],
          blob = bodyBlobs[i],
          storeTo = storePartsTo[i];

      if (blob) {
        partInfo.sizeEstimate = blob.size;
        partInfo.type = blob.type;
        if (storeTo === 'idb') {
          partInfo.file = blob;
        } else {
          pendingCbs++;
          saveToDeviceStorage(
              self, blob, storeTo, registerDownload[i],
              partInfo.name, partInfo, next);
        }
      }
    }

    next();
  };
  function done() {
    folderStorage.updateMessageBody(
      header, bodyInfo,
      { flushBecause: 'blobs' },
      {
        changeDetails: {
          attachments: op.attachmentIndices
        }
      },
      function() {
        callback(downloadErr, null, true);
      });
  };

  self._accessFolderForMutation(folderId, true, gotConn, deadConn,
                                'download');
}

/**
 * Save an attachment to device storage, making the filename unique if we
 * encounter a collision.
 */
var saveToDeviceStorage = exports.saveToDeviceStorage =
function(scope, blob, storeTo, registerDownload, filename, partInfo, cb,
         isRetry) {
  var self = this;
  var callback = function(success, error, savedFilename, registered) {
    if (success) {
      logic(scope, 'savedAttachment', { storeTo: storeTo,
                                        type: blob.type,
                                        size: blob.size });
      console.log('saved attachment to', storeTo, savedFilename,
                  'type:', blob.type, 'registered:', registered);
      partInfo.file = [storeTo, savedFilename];
      cb();
    } else {
      logic(scope, 'saveFailure', { storeTo: storeTo,
                                    type: blob.type,
                                    size: blob.size,
                                    error: error,
                                    filename: filename });
      console.warn('failed to save attachment to', storeTo, filename,
                   'type:', blob.type);
      // if we failed to unique the file after appending junk, just give up
      if (isRetry) {
        cb(error);
        return;
      }
      // retry by appending a super huge timestamp to the file before its
      // extension.
      var idxLastPeriod = filename.lastIndexOf('.');
      if (idxLastPeriod === -1)
        idxLastPeriod = filename.length;
      filename = filename.substring(0, idxLastPeriod) + '-' + $date.NOW() +
        filename.substring(idxLastPeriod);

      saveToDeviceStorage(scope, blob, storeTo, registerDownload,
                          filename, partInfo, cb, true);
    }
  };
  sendMessage('save', [storeTo, blob, filename, registerDownload], callback);
}

exports.local_do_download = function(op, callback) {
  // Downloads are inherently online operations.
  callback(null);
};

exports.check_download = function(op, callback) {
  // If we downloaded the file and persisted it successfully, this job would be
  // marked done because of the atomicity guarantee on our commits.
  callback(null, 'coherent-notyet');
};
exports.local_undo_download = function(op, callback) {
  callback(null);
};
exports.undo_download = function(op, callback) {
  callback(null);
};


exports.local_do_downloadBodies = function(op, callback) {
  callback(null);
};

exports.do_downloadBodies = function(op, callback) {
  var aggrErr = null, totalDownloaded = 0;
  this._partitionAndAccessFoldersSequentially(
    op.messages,
    true,
    function perFolder(folderConn, storage, headers, namers, callWhenDone) {
      folderConn.downloadBodies(headers, op.options, function(err, numDownloaded) {
        totalDownloaded += numDownloaded;
        if (err && !aggrErr) {
          aggrErr = err;
        }
        callWhenDone();
      });
    },
    function allDone() {
      callback(aggrErr, null,
               // save if we might have done work.
               totalDownloaded > 0);
    },
    function deadConn() {
      aggrErr = 'aborted-retry';
    },
    false, // reverse?
    'downloadBodies',
    true // require headers
  );
};

exports.check_downloadBodies = function(op, callback) {
  // If we had downloaded the bodies and persisted them successfully, this job
  // would be marked done because of the atomicity guarantee on our commits.  It
  // is possible this request might only be partially serviced, in which case we
  // will avoid redundant body fetches, but redundant folder selection is
  // possible if this request spans multiple folders.
  callback(null, 'coherent-notyet');
};

exports.check_downloadBodyReps = function(op, callback) {
  // If we downloaded all of the body parts and persisted them successfully,
  // this job would be marked done because of the atomicity guarantee on our
  // commits.  But it's not, so there's more to do.
  callback(null, 'coherent-notyet');
};

exports.do_downloadBodyReps = function(op, callback) {
  var self = this;
  var idxLastSlash = op.messageSuid.lastIndexOf('/'),
      folderId = op.messageSuid.substring(0, idxLastSlash);

  var folderConn, folderStorage;
  // Once we have the connection, get the current state of the body rep.
  var gotConn = function gotConn(_folderConn, _folderStorage) {
    folderConn = _folderConn;
    folderStorage = _folderStorage;

    folderStorage.getMessageHeader(op.messageSuid, op.messageDate, gotHeader);
  };
  var deadConn = function deadConn() {
    callback('aborted-retry');
  };

  var gotHeader = function gotHeader(header) {
    // header may have been deleted by the time we get here...
    if (!header) {
      callback();
      return;
    }

    // Check to see if we've already downloaded the bodyReps for this
    // message. If so, no need to even try to fetch them again. This
    // allows us to enforce an idempotency guarantee regarding how
    // many times body change notifications will be fired.
    folderStorage.getMessageBody(header.suid, header.date,
                                         function(body) {
      if (!folderStorage.messageBodyRepsDownloaded(body)) {
        folderConn.downloadBodyReps(header, onDownloadReps);
      } else {
        // passing flushed = true because we don't need to save anything
        onDownloadReps(null, body, /* flushed = */ true);
      }
    });
  };

  var onDownloadReps = function onDownloadReps(err, bodyInfo, flushed) {
    if (err) {
      console.error('Error downloading reps', err);
      // fail we cannot download for some reason?
      callback('unknown');
      return;
    }

    // Since we downloaded something, we do want to save what we downloaded,
    // but only if the downloader didn't already force a save while flushing.
    var save = !flushed;
    callback(null, bodyInfo, save);
  };

  self._accessFolderForMutation(folderId, true, gotConn, deadConn,
                                'downloadBodyReps');
};

exports.local_do_downloadBodyReps = function(op, callback) {
  callback(null);
};


////////////////////////////////////////////////////////////////////////////////
// sendOutboxMessages

/**
 * Send some messages from the outbox. At a high level, you can
 * pretend that "sendOutboxMessages" just kicks off a process to send
 * all the messages in the outbox.
 *
 * As an implementation detail, to keep memory requirements low, this
 * job is designed to send only one message at a time; it
 * self-schedules future jobs to walk through the list of outbox
 * messages, one at a time.
 *
 * In pseudocode:
 *
 *         CLIENT: "Hey, please kick off a sendOutboxMessages job."
 *   OUTBOX JOB 1: "Okay, I'll send the first message."
 *         CLIENT: "thanks"
 *   OUTBOX JOB 1: "Okay, done. Oh, there are more messages. Scheduling
 *                  a future job to send the next message."
 *         CLIENT: "ok"
 *   OUTBOX JOB 1: *dies*
 *         CLIENT: *goes off to do other things*
 *   OUTBOX JOB 2: "on it, sending another message"
 *
 * This allows other jobs to interleave the sending process, to avoid
 * introducing long delays in a world where we only run one job
 * concurrently.
 *
 * This job accepts a `beforeMessage` parameter; if that parameter is
 * null (the normal case), we'll attempt to send the newest message.
 * After the first message has been sent, we will _self-schedule_ a
 * second sendOutboxMessages job to continue sending the rest of the
 * available messages (one per job).
 *
 * We set `header.sendStatus` to an object representing the current
 * state of the send operation. If the send fails, we'll remove the
 * flag and indicate that there was an error sending, unless the app
 * crashes, in which case we'll try to resend upon startup again (see
 * `outboxNeedsFreshSync`).
 */
exports.do_sendOutboxMessages = function(op, callback) {
  var account = this.account;
  var outboxFolder = account.getFirstFolderWithType('outbox');
  if (!outboxFolder) {
    callback('moot'); // This shouldn't happen, we should always have an outbox.
    return;
  }

  // If we temporarily paused outbox syncing, don't do anything.
  if (!account.outboxSyncEnabled) {
    console.log('outbox: Outbox syncing temporarily disabled; not syncing.');
    callback(null);
    return;
  }

  var outboxNeedsFreshSync = account.outboxNeedsFreshSync;
  if (outboxNeedsFreshSync) {
    console.log('outbox: This is the first outbox sync for this account.');
    account.outboxNeedsFreshSync = false;
  }

  // Hold both a CPU and WiFi wake lock for the duration of the send
  // operation. We'll pass this in to the Composer instance for each
  // message, so that the SMTP/ActiveSync sending process can renew
  // the wake lock from time to time as the send continues.
  var wakeLock = new $wakelocks.SmartWakeLock({
    locks: ['cpu', 'wifi']
  });

  this._accessFolderForMutation(
    outboxFolder.id, /* needConn = */ false,
    function(nullFolderConn, folderStorage) {
      require(['jobs/outbox'], function ($outbox) {
        $outbox.sendNextAvailableOutboxMessage(
          account.compositeAccount || account, // Requires the main account.
          folderStorage,
          op.beforeMessage,
          op.emitNotifications,
          outboxNeedsFreshSync,
          wakeLock
        ).then(function(result) {
          var moreExpected = result.moreExpected;
          var messageNamer = result.messageNamer;

          wakeLock.unlock('send complete');

          // If there may be more messages to send, schedule another
          // sync to send the next available message.
          if (moreExpected) {
            account.universe.sendOutboxMessages(account, {
              beforeMessage: messageNamer
            });
          }
          // Otherwise, we're done. Mark the outbox as "synced".
          else {
            account.universe.notifyOutboxSyncDone(account);
            folderStorage.markSyncRange(
              $sync.OLDEST_SYNC_DATE, null, 'XXX', $date.NOW());
          }
          // Since we modified the folders, save the account.
          callback(null, /* result = */ null, /* save = */ true);
        }).catch(function(e) {
          console.error('Exception while sending a message.',
                        'Send failure: ' + e, e.stack);
          wakeLock.unlock(e);
          callback('aborted-retry');
        });

      });
    },
    /* no conn => no deathback required */ null,
    'sendOutboxMessages');
};

exports.check_sendOutboxMessages = function(op, callback) {
  callback(null, 'moot');
};

exports.local_undo_sendOutboxMessages = function(op, callback) {
  callback(null); // You cannot undo sendOutboxMessages.
};

exports.local_do_setOutboxSyncEnabled = function(op, callback) {
  // Set a flag on the account to prevent us from kicking off further
  // sends while the outbox is being edited on the client. The account
  // referenced by `this.account` is actually the receive piece in a
  // composite account; this flag is initialized in accountmixins.js.
  this.account.outboxSyncEnabled = op.outboxSyncEnabled;
  callback(null);
};

////////////////////////////////////////////////////////////////


exports.postJobCleanup = function(error) {
  if (!error) {
    var deltaMap, fullMap;
    // - apply updates to the serverIdMap map
    if (this._stateDelta.serverIdMap) {
      deltaMap = this._stateDelta.serverIdMap;
      fullMap = this._state.suidToServerId;
      for (var suid in deltaMap) {
        var srvid = deltaMap[suid];
        if (srvid === null)
          delete fullMap[suid];
        else
          fullMap[suid] = srvid;
      }
    }
    // - apply updates to the move map
    if (this._stateDelta.moveMap) {
      deltaMap = this._stateDelta.moveMap;
      fullMap = this._state.moveMap;
      for (var oldSuid in deltaMap) {
        var newSuid = deltaMap[oldSuid];
        fullMap[oldSuid] = newSuid;
      }
    }
  }

  for (var i = 0; i < this._heldMutexReleasers.length; i++) {
    this._heldMutexReleasers[i](error);
  }
  this._heldMutexReleasers = [];

  this._stateDelta.serverIdMap = null;
  this._stateDelta.moveMap = null;
};

exports.allJobsDone =  function() {
  this._state.suidToServerId = {};
  this._state.moveMap = {};
};

/**
 * Partition messages identified by namers by folder, then invoke the callback
 * once per folder, passing in the loaded message header objects for each
 * folder.
 *
 * This method will filter out removed headers (which would otherwise be null).
 * Its possible that entire folders will be skipped if no headers requested are
 * now present.
 *
 * Connection loss by default causes this method to stop trying to traverse
 * folders, calling callOnConnLoss and callWhenDone in that order.  If you want
 * to do something more clever, extend this method so that you can return a
 * sentinel value or promise or something and do your clever thing.
 *
 * @args[
 *   @param[messageNamers @listof[MessageNamer]]
 *   @param[needConn Boolean]{
 *     True if we should try and get a connection from the server.  Local ops
 *     should pass false, server ops should pass true.  This additionally
 *     determines whether we provide headers to the operation (!needConn),
 *     or server id's for messages (needConn).
 *   }
 *   @param[callInFolder @func[
 *     @args[
 *       @param[folderConn ImapFolderConn]
 *       @param[folderStorage FolderStorage]
 *       @param[headersOrServerIds @oneof[
 *         @listof[HeaderInfo]
 *         @listof[ServerID]]
 *       ]
 *       @param[messageNamers @listof[MessageNamer]]
 *       @param[callWhenDoneWithFolder Function]
 *     ]
 *   ]]
 *   @param[callWhenDone @func[
 *     @args[err @oneof[null 'connection-list']]
 *   ]]{
 *     The function to invoke when all of the folders have been processed or the
 *     connection has been lost and we're giving up.  This will be invoked after
 *     `callOnConnLoss` in the event of a conncetion loss.
 *   }
 *   @param[callOnConnLoss Function]{
 *     This function we invoke when we lose a connection.  Traditionally, you would
 *     use this to flag an error in your function that you would then return when
 *     we invoke `callWhenDone`.  Then your check function will be invoked and you
 *     can laboriously check what actually happened on the server, etc.
 *   }
 *   @param[reverse #:optional Boolean]{
 *     Should we walk the partitions in reverse order?
 *   }
 *   @param[label String]{
 *     The label to use to name the usage of the folder connection.
 *   }
 *   @param[requireHeaders Boolean]{
 *     True if connection & headers are needed.
 *   }
 * ]
 */
exports._partitionAndAccessFoldersSequentially = function(
    allMessageNamers,
    needConn,
    callInFolder,
    callWhenDone,
    callOnConnLoss,
    reverse,
    label,
    requireHeaders) {
  var partitions = $util.partitionMessagesByFolderId(allMessageNamers);
  var folderConn, storage, self = this,
      folderId = null, folderMessageNamers = null, serverIds = null,
      iNextPartition = 0, curPartition = null, modsToGo = 0,
      // Set to true immediately before calling callWhenDone; causes us to
      // immediately bail out of any of our callbacks in order to avoid
      // continuing beyond the point when we should have stopped.
      terminated = false;

  if (reverse)
    partitions.reverse();

  var openNextFolder = function openNextFolder() {
    if (terminated)
      return;
    if (iNextPartition >= partitions.length) {
      terminated = true;
      callWhenDone(null);
      return;
    }
    // Cleanup the last folder (if there was one)
    if (iNextPartition) {
      folderConn = null;
      // The folder's mutex should be last; if the callee acquired any
      // additional mutexes in the last round, it should have freed it then
      // too.
      var releaser = self._heldMutexReleasers.pop();
      if (releaser)
        releaser();
      folderConn = null;
    }

    curPartition = partitions[iNextPartition++];
    folderMessageNamers = curPartition.messages;
    serverIds = null;
    if (curPartition.folderId !== folderId) {
      folderId = curPartition.folderId;
      self._accessFolderForMutation(folderId, needConn, gotFolderConn,
                                    connDied, label);
    }
  };
  var connDied = function connDied() {
    if (terminated)
      return;
    if (callOnConnLoss) {
      try {
        callOnConnLoss();
      }
      catch (ex) {
        self.log.error('callbackErr', { ex: ex });
      }
    }
    terminated = true;
    callWhenDone('connection-lost');
  };
  var gotFolderConn = function gotFolderConn(_folderConn, _storage) {
    if (terminated)
      return;
    folderConn = _folderConn;
    storage = _storage;
    // - Get headers or resolve current server id from name map
    if (needConn && !requireHeaders) {
      var neededHeaders = [],
          suidToServerId = self._state.suidToServerId;
      serverIds = [];
      for (var i = 0; i < folderMessageNamers.length; i++) {
        var namer = folderMessageNamers[i];
        var srvid = suidToServerId[namer.suid];
        if (srvid) {
          serverIds.push(srvid);
        }
        else {
          serverIds.push(null);
          neededHeaders.push(namer);
        }
      }

      if (!neededHeaders.length) {
        try {
          callInFolder(folderConn, storage, serverIds, folderMessageNamers,
                       openNextFolder);
        }
        catch (ex) {
          console.error('PAAFS error:', ex, '\n', ex.stack);
        }
      }
      else {
        storage.getMessageHeaders(neededHeaders, gotNeededHeaders);
      }
    }
    else {
      storage.getMessageHeaders(folderMessageNamers, gotHeaders);
    }
  };
  var gotNeededHeaders = function gotNeededHeaders(headers) {
    if (terminated)
      return;
    var iNextServerId = serverIds.indexOf(null);
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];
      // It's possible that by the time this job actually gets a chance to run
      // that the header is no longer in the folder.  This is rare but not
      // particularly exceptional.
      if (header) {
        var srvid = header.srvid;
        serverIds[iNextServerId] = srvid;
        // A header that exists but does not have a server id is exceptional and
        // bad, although logic should handle it because of the above dead-header
        // case.  suidToServerId should really have provided this information to
        // us.
        if (!srvid)
          console.warn('Header', headers[i].suid, 'missing server id in job!');
      }
      iNextServerId = serverIds.indexOf(null, iNextServerId + 1);
    }

    // its entirely possible that we need headers but there are none so we can
    // skip entering this folder as the job cannot do anything with an empty
    // header.
    if (!serverIds.length) {
      openNextFolder();
      return;
    }

    try {
      callInFolder(folderConn, storage, serverIds, folderMessageNamers,
                   openNextFolder);
    }
    catch (ex) {
      console.error('PAAFS error:', ex, '\n', ex.stack);
    }
  };
  var gotHeaders = function gotHeaders(headers) {
    if (terminated)
      return;
    // its unlikely but entirely possible that all pending headers have been
    // removed somehow between when the job was queued and now.
    if (!headers.length) {
      openNextFolder();
      return;
    }

    // Sort the headers in ascending-by-date order so that slices hear about
    // changes from oldest to newest. That way, they won't get upset about being
    // asked to expand into the past.
    headers.sort(function(a, b) { return a.date > b.date; });
    try {
      callInFolder(folderConn, storage, headers, folderMessageNamers,
                   openNextFolder);
    }
    catch (ex) {
      console.error('PAAFS error:', ex, '\n', ex.stack);
    }
  };
  openNextFolder();
};

exports.local_do_upgradeDB = function (op, doneCallback) {
  var storage = this.account.getFolderStorageForFolderId(op.folderId);
  var filter = function(header) {
    return header.flags &&
      header.flags.indexOf('\\Seen') === -1;
  };
  $count.countHeaders(storage, filter, function(num) {
    storage._dirty = true;
    storage.folderMeta.version = $mailslice.FOLDER_DB_VERSION;
    storage.folderMeta.unreadCount = num;
    doneCallback(/* no error */ null, /* no result */ null,
                 /* yes save */ true);
  });
};

}); // end define
;

/**
 * This module exposes a single helper method,
 * `sendNextAvailableOutboxMessage`, which is used by the
 * sendOutboxMessages job in jobmixins.js.
 */
define('jobs/outbox',['require'],function(require) {


  /**
   * Send the next available outbox message. Returns a promise that
   * resolves to the following:
   *
   * {
   *   moreExpected: (Boolean),
   *   messageNamer: { date, suid }
   * }
   *
   * If there might be more messages left to send after this one,
   * moreExpected will be `true`.
   *
   * If we attempted to send a message, messageNamer will point to it.
   * This can then be passed to a subsequent invocation of this, to
   * send the next available message after the given messageNamer.
   *
   * @param {CompositeAccount|ActiveSyncAccount} account
   * @param {FolderStorage} storage
   * @param {MessageNamer|null} beforeMessage
   *   Send the first message chronologically preceding `beforeMessage`.
   * @param {Boolean} emitNotifications
   *   If true, we will emit backgroundSendStatus notifications
   *   for this message.
   * @param {Boolean} outboxNeedsFreshSync
   *   If true, ignore any potentially stale "sending" state,
   *   as in when we restore the app from a crash.
   * @param {SmartWakeLock} wakeLock
   *   A SmartWakeLock to be held open during the sending process.
   * @return {Promise}
   * @public
   */
  function sendNextAvailableOutboxMessage(
    account, storage, beforeMessage, emitNotifications,
    outboxNeedsFreshSync, wakeLock) {

    return getNextHeader(storage, beforeMessage).then(function(header) {
      // If there are no more messages to send, resolve `null`. This
      // should ordinarily not happen, because clients should pay
      // attention to the `moreExpected` results from earlier sends;
      // but job scheduling might introduce edge cases where this
      // happens, so better to be safe.
      if (!header) {
        return {
          moreExpected: false,
          messageNamer: null
        };
      }

      // Figure out if this is the last message to consider sending in the
      // outbox.  (We are moving from newest to oldest, so this is the last one
      // if it is the oldest.  We need to figure this out before the send
      // process completes since we will delete the header once it's all sent.)
      var moreExpected = !storage.headerIsOldestKnown(header.date,
                                                      header.id);

      if (!header.sendStatus) {
        header.sendStatus = {};
      }

      // If the header has not been sent, or we've been instructed to
      // ignore any existing sendStatus, clear it out.
      if (header.sendStatus.state !== 'sending' || outboxNeedsFreshSync) {
        // If this message is not already being sent, send it.
        return constructComposer(account, storage, header, wakeLock)
          .then(sendMessage.bind(null, account, storage, emitNotifications))
          .then(function(header) {
            return {
              moreExpected: moreExpected,
              messageNamer: {
                suid: header.suid,
                date: header.date
              }
            };
          });
      } else {
        // If this message is currently being sent, advance to the
        // next header.
        return sendNextAvailableOutboxMessage(account, storage, {
          suid: header.suid,
          date: header.date
        }, emitNotifications, outboxNeedsFreshSync, wakeLock);
      }
    });
  }


  ////////////////////////////////////////////////////////////////
  // The following functions are internal helpers.

  /**
   * Resolve to the header immediately preceding `beforeMessage` in
   * time. If beforeMessage is null, resolve the most recent message.
   * If no message could be found, resolve `null`.
   *
   * @param {FolderStorage} storage
   * @param {MessageNamer} beforeMessage
   * @return {Promise(MailHeader)}
   */
  function getNextHeader(storage, /* optional */ beforeMessage) {
    return new Promise(function(resolve) {
      if (beforeMessage) {
        // getMessagesBeforeMessage expects an 'id', not a 'suid'.
        var id = parseInt(beforeMessage.suid.substring(
          beforeMessage.suid.lastIndexOf('/') + 1));
        storage.getMessagesBeforeMessage(
          beforeMessage.date,
          id,
          /* limit = */ 1,
          function(headers, moreExpected) {
            // There may be no headers, and that's okay.
            resolve(headers[0] || null);
          });
      } else {
        storage.getMessagesInImapDateRange(
          0,
          null,
          /* min */ 1,
          /* max */ 1,
          function(headers, moreExpected) {
            resolve(headers[0]);
          });
      }
    });
  }

  /**
   * Build a Composer instance pointing to the given header.
   *
   * @param {MailAccount} account
   * @param {FolderStorage} storage
   * @param {MailHeader} header
   * @param {SmartWakeLock} wakeLock
   * @return {Promise(Composer)}
   */
  function constructComposer(account, storage, header, wakeLock) {
    return new Promise(function(resolve, reject) {
      storage.getMessage(header.suid, header.date, function(msg) {

        // If for some reason the message doesn't have a body, we
        // can't construct a composer for this header.
        if (!msg || !msg.body) {
          console.error('Failed to create composer; no body available.');
          reject();
          return;
        }

        require(['../drafts/composer'], function(cmp) {
          var composer = new cmp.Composer(msg, account, account.identities[0]);
          composer.setSmartWakeLock(wakeLock);

          resolve(composer);
        });
      });
    });
  }

  /**
   * Attempt to send the given message from the outbox.
   *
   * During the sending process, post status updates to the universe,
   * so that the frontend can display status notifications if it
   * desires.
   *
   * If the message successfully sends, remove it from the outbox;
   * otherwise, its `sendStatus.state` will equal 'error', with
   * details about the failure.
   *
   * Resolves to the header; you can check `header.sendStatus` to see
   * the result of this send attempt.
   *
   * @param {MailAccount} account
   * @param {FolderStorage} storage
   * @param {Composer} composer
   * @return {Promise(MailHeader)}
   */
  function sendMessage(account, storage, emitNotifications, composer) {
    var header = composer.header;
    var progress = publishStatus.bind(
      null, account, storage, composer, header, emitNotifications);

    // As part of the progress notification, the client would like to
    // know whether or not they can expect us to immediately send more
    // messages after this one. If there are messages in the outbox
    // older than this one, the answer is yes.
    var oldestDate = storage.getOldestMessageTimestamp();
    var willSendMore = oldestDate > 0 && oldestDate < header.date.valueOf();

    // Send the initial progress information.
    progress({
      state: 'sending',
      err: null,
      badAddresses: null,
      sendFailures: header.sendStatus && header.sendStatus.sendFailures || 0
    });

    return new Promise(function(resolve) {
      account.sendMessage(composer, function(err, badAddresses) {
        if (err) {
          console.log('Message failed to send (' + err + ')');

          progress({
            state: 'error',
            err: err,
            badAddresses: badAddresses,
            sendFailures: (header.sendStatus.sendFailures || 0) + 1
          });

          resolve(composer.header);
        } else {
          console.log('Message sent; deleting from outbox.');

          progress({
            state: 'success',
            err: null,
            badAddresses: null
          });
          storage.deleteMessageHeaderAndBodyUsingHeader(header, function() {
            resolve(composer.header);
          });
        }
      });
    });
  }

  /**
   * Publish a universe notification with the message's current send
   * status, and queue it for persistence in the database.
   *
   * NOTE: Currently, we do not checkpoint our state, so the
   * intermediary "sending" steps will not actually get written to
   * disk. That is generally fine, since sendStatus is invalid upon a
   * restart. However, when we address bug 1032451 (sendMessage is not
   * actually atomic), we will want to checkpoint state during the
   * sending process.
   */
  function publishStatus(account, storage, composer,
                         header, emitNotifications, status) {
    header.sendStatus = {
      state: status.state,
      err: status.err,
      badAddresses: status.badAddresses,
      sendFailures: status.sendFailures
    };

    account.universe.__notifyBackgroundSendStatus({
      // Status information (also stored on the header):
      state: status.state,
      err: status.err,
      badAddresses: status.badAddresses,
      sendFailures: status.sendFailures,
      // Message/Account Information (for notifications):
      accountId: account.id,
      suid: header.suid,
      emitNotifications: emitNotifications,
      // Unit test support:
      messageId: composer.messageId,
      sentDate: composer.sentDate
    });

    storage.updateMessageHeader(
      header.date,
      header.id,
      /* partOfSync */ false,
      header,
      /* body hint */ null);
  }

  return {
    sendNextAvailableOutboxMessage: sendNextAvailableOutboxMessage
  };
});

/**
 * Centralize the creation of our header and body object representations.
 *
 * We provide constructor functions which take input objects that should
 * basically look like the output object, but the function enforces
 * consistency and provides the ability to assert about the state of the
 * representation at the call-site.  We discussed making sure to check
 * representations when we are inserting records into our database, but we
 * might also want to opt to do it at creation time too so we can explode
 * slightly closer to the source of the problem.
 *
 * This module will also provide representation checking functions to make
 * sure all the data structures are well-formed/have no obvious problems.
 *
 * @module mailapi/db/mail_rep
 **/

define('db/mail_rep',[],function() {

/*
 * @typedef[HeaderInfo @dict[
 *   @key[id]{
 *     An id allocated by the back-end that names the message within the folder.
 *     We use this instead of the server-issued UID because if we used the UID
 *     for this purpose then we would still need to issue our own temporary
 *     speculative id's for offline operations and would need to implement
 *     renaming and it all gets complicated.
 *   }
 *   @key[srvid]{
 *     The server-issued UID for the folder, or 0 if the folder is an offline
 *     header.
 *   }
 *   @key[suid]{
 *     Basically "account id/folder id/message id", although technically the
 *     folder id includes the account id.
 *   }
 *   @key[guid String]{
 *     This is the message-id header value of the message.
 *   }
 *   @key[author NameAddressPair]
 *   @key[to #:optional @listof[NameAddressPair]]
 *   @key[cc #:optional @listof[NameAddressPair]]
 *   @key[bcc #:optional @listof[NameAddressPair]]
 *   @key[replyTo #:optional String]{
 *     The contents of the reply-to header.
 *   }
 *   @key[date DateMS]
 *   @key[flags @listof[String]]
 *   @key[hasAttachments Boolean]
 *   @key[subject @oneof [String null]]
 *   @key[snippet @oneof[
 *     @case[null]{
 *       We haven't tried to generate a snippet yet.
 *     }
 *     @case['']{
 *       We tried to generate a snippet, but got nothing useful.  Note that we
 *       may try and generate a snippet from a partial body fetch; this does not
 *       indicate that we should avoid computing a better snippet.  Whenever the
 *       snippet is falsey and we have retrieved more body data, we should
 *       always try and derive a snippet.
 *     }
 *     @case[String]{
 *       A non-empty string means we managed to produce some snippet data.  It
 *        is still appropriate to regenerate the snippet if more body data is
 *        fetched since our snippet may be a fallback where we chose quoted text
 *        instead of authored text, etc.
 *     }
 *   ]]
 * ]]
 */
function makeHeaderInfo(raw) {
  // All messages absolutely need the following; the caller needs to make up
  // values if they're missing.
  if (!raw.author)
    throw new Error('No author?!');
  if (!raw.date)
    throw new Error('No date?!');
  // We also want/require a valid id, but we check that at persistence time
  // since POP3 assigns the id/suid slightly later on.  We check the suid at
  // that point too.  (Checked in FolderStorage.addMessageHeader.)

  return {
    id: raw.id,
    srvid: raw.srvid || null,
    suid: raw.suid || null,
    guid: raw.guid || null,
    author: raw.author,
    to: raw.to || null,
    cc: raw.cc || null,
    bcc: raw.bcc || null,
    replyTo: raw.replyTo || null,
    date: raw.date,
    flags: raw.flags || [],
    hasAttachments: raw.hasAttachments || false,
    // These can be empty strings which are falsey, so no ||
    subject: (raw.subject != null) ? raw.subject : null,
    snippet: (raw.snippet != null) ? raw.snippet : null,
    imapMissingInSyncRange: raw.imapMissingInSyncRange || null
  };
}

/*
 * @typedef[BodyInfo @dict[
 *   @key[date DateMS]{
 *     Redundantly stored date info for block splitting purposes.  We pretty
 *     much need this no matter what because our ordering is on the tuples of
 *     dates and UIDs, so we could have trouble efficiently locating our header
 *     from the body without this.
 *   }
 *   @key[size Number]
 *   @key[attaching #:optional AttachmentInfo]{
 *     Because of memory limitations, we need to encode and attach attachments
 *     in small pieces.  An attachment in the process of being attached is
 *     stored here until fully processed.  Its 'file' field contains a list of
 *     Blobs.
 *   }
 *   @key[attachments @listof[AttachmentInfo]]{
 *     Proper attachments for explicit downloading.
 *   }
 *   @key[relatedParts @oneof[null @listof[AttachmentInfo]]]{
 *     Attachments for inline display in the contents of the (hopefully)
 *     multipart/related message.
 *   }
 *   @key[references @oneof[null @listof[String]]]{
 *     The contents of the references header as a list of de-quoted ('<' and
 *     '>' removed) message-id's.  If there was no header, this is null.
 *   }
 *   @key[bodyReps @listof[BodyPartInfo]]
 * ]]{
 *   Information on the message body that is only for full message display.
 *   The to/cc/bcc information may get moved up to the header in the future,
 *   but our driving UI doesn't need it right now.
 * }
 */
function makeBodyInfo(raw) {
  if (!raw.date)
    throw new Error('No date?!');
  if (!raw.attachments || !raw.bodyReps)
    throw new Error('No attachments / bodyReps?!');

  return {
    date: raw.date,
    size: raw.size || 0,
    attachments: raw.attachments,
    relatedParts: raw.relatedParts || null,
    references: raw.references || null,
    bodyReps: raw.bodyReps
  };
}

/*
 * @typedef[BodyPartInfo @dict[
 *   @key[type @oneof['plain' 'html']]{
 *     The type of body; this is actually the MIME sub-type.
 *   }
 *   @key[part String]{
 *     IMAP part number.
 *   }
 *   @key[sizeEstimate Number]
 *   @key[amountDownloaded Number]
 *   @key[isDownloaded Boolean]
 *   @key[_partInfo #:optional RawIMAPPartInfo]
 *   @key[content]{
 *     The representation for 'plain' values is a `quotechew.js` processed
 *     body representation which is pair-wise list where the first item in each
 *     pair is a packed integer identifier and the second is a string containing
 *     the text for that block.
 *
 *     The body representation for 'html' values is an already sanitized and
 *     already quote-normalized String representation that could be directly
 *     fed into innerHTML safely if you were so inclined.  See `htmlchew.js`
 *     for more on that process.
 *   }
 * ]]
 */
function makeBodyPart(raw) {
  // We don't persist body types to our representation that we don't understand.
  if (raw.type !== 'plain' &&
      raw.type !== 'html')
    throw new Error('Bad body type: ' + raw.type);
  // 0 is an okay body size, but not giving us a guess is not!
  if (raw.sizeEstimate === undefined)
    throw new Error('Need size estimate!');

  return {
    type: raw.type,
    part: raw.part || null,
    sizeEstimate: raw.sizeEstimate,
    amountDownloaded: raw.amountDownloaded || 0,
    isDownloaded: raw.isDownloaded || false,
    _partInfo: raw._partInfo || null,
    content: raw.content || ''
  };
}


/*
 * @typedef[AttachmentInfo @dict[
 *   @key[name String]{
 *     The filename of the attachment, if any.
 *   }
 *   @key[contentId String]{
 *     The content-id of the attachment if this is a related part for inline
 *     display.
 *   }
 *   @key[type String]{
 *     The (full) mime-type of the attachment.
 *   }
 *   @key[part String]{
 *     The IMAP part number for fetching the attachment.
 *   }
 *   @key[encoding String]{
 *     The encoding of the attachment so we know how to decode it.  For
 *     ActiveSync, the server takes care of this for us so there is no encoding
 *     from our perspective.  (Although the attachment may get base64 encoded
 *     for transport in the inline case, but that's a protocol thing and has
 *     nothing to do with the message itself.)
 *   }
 *   @key[sizeEstimate Number]{
 *     Estimated file size in bytes.  Gets updated to be the correct size on
 *     attachment download.
 *   }
 *   @key[file @oneof[
 *     @case[null]{
 *       The attachment has not been downloaded, the file size is an estimate.
 *     }
 *     @case[@list["device storage type" "file path"]{
 *       The DeviceStorage type (ex: pictures) and the path to the file within
 *       device storage.
 *     }
 *     @case[HTMLBlob]{
 *       The Blob that contains the attachment.  It can be thought of as a
 *       handle/name to access the attachment.  IndexedDB in Gecko stores the
 *       blobs as (quota-tracked) files on the file-system rather than inline
 *       with the record, so the attachments don't need to count against our
 *       block size since they are not part of the direct I/O burden for the
 *       block.
 *     }
 *     @case[@listof[HTMLBlob]]{
 *       For draft messages, a list of one or more pre-base64-encoded attachment
 *       pieces that were sliced up in chunks due to Gecko's inability to stream
 *       Blobs to disk off the main thread.
 *     }
 *   ]]
 *   @key[charset @oneof[undefined String]]{
 *     The character set, for example "ISO-8859-1".  If not specified, as is
 *     likely for binary attachments, this should be null.
 *   }
 *   @key[textFormat @oneof[undefined String]]{
 *     The text format, for example, "flowed" for format=flowed.  If not
 *     specified, as is likely for binary attachments, this should be null.
 *   }
 * ]]
 */
function makeAttachmentPart(raw) {
  // Something is very wrong if there is no size estimate.
  if (raw.sizeEstimate === undefined)
    throw new Error('Need size estimate!');

  return {
    // XXX ActiveSync may leave this null, although it's conceivable the
    // server might do normalization to save us.  This needs a better treatment.
    // IMAP generates a made-up name for us if there isn't one.
    name: (raw.name != null) ? raw.name : null,
    contentId: raw.contentId || null,
    type: raw.type || 'application/octet-stream',
    part: raw.part || null,
    encoding: raw.encoding || null,
    sizeEstimate: raw.sizeEstimate,
    file: raw.file || null,
    charset: raw.charset || null,
    textFormat: raw.textFormat || null,
    pathName: raw.pathName || null,
    vCardData: raw.vCardData || null
  };
}

return {
  makeHeaderInfo: makeHeaderInfo,
  makeBodyInfo: makeBodyInfo,
  makeBodyPart: makeBodyPart,
  makeAttachmentPart: makeAttachmentPart
};

}); // end define
;
/**
 * Back-end draft abstraction.
 *
 * Drafts are saved to folder storage and look almost exactly like received
 * messages.  The primary difference is that attachments that are in the
 * process of being attached are stored in an `attaching` field on the
 * `BodyInfo` instance and that they are discarded on load if still present
 * (indicating a crash/something like a crash during the save process).
 *
 **/

define('drafts/draft_rep',['require','../db/mail_rep'],function(require) {

var mailRep = require('../db/mail_rep');

/**
 * Create a new header and body for a draft by extracting any useful state
 * from the previous draft's persisted header/body and the revised draft.
 *
 * @method mergeDraftStates
 * @param oldHeader {HeaderInfo}
 * @param oldBody {BodyInfo}
 * @param newDraftRep {DraftRep}
 * @param newDraftInfo {Object}
 * @param newDraftInfo.id {Number}
 * @param newDraftInfo.suid {SUID}
 * @param newDraftInfo.date {Number}
 */
function mergeDraftStates(oldHeader, oldBody,
                          newDraftRep, newDraftInfo,
                          universe) {

  var identity = universe.getIdentityForSenderIdentityId(newDraftRep.senderId);

  // -- convert from compose rep to header/body rep
  var newHeader = mailRep.makeHeaderInfo({
    id: newDraftInfo.id,
    srvid: null, // stays null
    suid: newDraftInfo.suid, // filled in by the job
    // we currently don't generate a message-id for drafts, but we'll need to
    // do this when we start appending to the server.
    guid: oldHeader ? oldHeader.guid : null,
    author: { name: identity.name, address: identity.address},
    to: newDraftRep.to,
    cc: newDraftRep.cc,
    bcc: newDraftRep.bcc,
    replyTo: identity.replyTo,
    date: newDraftInfo.date,
    flags: [],
    hasAttachments: oldBody ? oldBody.attachments.length > 0 : false,
    subject: newDraftRep.subject,
    snippet: newDraftRep.body.text.substring(0, 100),
  });
  var newBody = mailRep.makeBodyInfo({
    date: newDraftInfo.date,
    size: 0,
    attachments: oldBody ? oldBody.attachments.concat() : [],
    relatedParts: oldBody ? oldBody.relatedParts.concat() : [],
    references: newDraftRep.referencesStr,
    bodyReps: []
  });
  newBody.bodyReps.push(mailRep.makeBodyPart({
    type: 'plain',
    part: null,
    sizeEstimate: newDraftRep.body.text.length,
    amountDownloaded: newDraftRep.body.text.length,
    isDownloaded: true,
    _partInfo: {},
    content: [0x1, newDraftRep.body.text]
  }));
  if (newDraftRep.body.html) {
    newBody.bodyReps.push(mailRep.makeBodyPart({
      type: 'html',
      part: null,
      sizeEstimate: newDraftRep.body.html.length,
      amountDownloaded: newDraftRep.body.html.length,
      isDownloaded: true,
      _partInfo: {},
      content: newDraftRep.body.html
    }));
  }

  return {
    header: newHeader,
    body: newBody
  };
}

function convertHeaderAndBodyToDraftRep(account, header, body) {
  var composeBody = {
    text: '',
    html: null,
  };

  // Body structure should be guaranteed, but add some checks.
  if (body.bodyReps.length >= 1 &&
      body.bodyReps[0].type === 'plain' &&
      body.bodyReps[0].content.length === 2 &&
      body.bodyReps[0].content[0] === 0x1) {
    composeBody.text = body.bodyReps[0].content[1];
  }
  // HTML is optional, but if present, should satisfy our guard
  if (body.bodyReps.length == 2 &&
      body.bodyReps[1].type === 'html') {
    composeBody.html = body.bodyReps[1].content;
  }

  var attachments = [];
  body.attachments.forEach(function(att) {
    attachments.push({
      name: att.name,
      blob: att.file
    });
  });

  var draftRep = {
    identity: account.identities[0],
    subject: header.subject,
    body: composeBody,
    to: header.to,
    cc: header.cc,
    bcc: header.bcc,
    referencesStr: body.references,
    attachments: attachments
  };
}

/**
 * Given the HeaderInfo and BodyInfo for a draft, create a new header and body
 * suitable for saving to the sent folder for a POP3 account.  Specifically:
 * - mark the message as read
 * - make sure body.attaching does not make it through
 * - strip the Blob references so we don't accidentally keep the base64
 *   encoded attachment parts around forever and clog up the disk.
 * - avoid accidental use of the same instances between the drafts folder and
 *   the sent folder
 *
 * @param header {HeaderInfo}
 * @param body {BodyInfo}
 * @param newInfo
 * @param newInfo.id
 * @param newInfo.suid {SUID}
 * @return { header, body }
 */
function cloneDraftMessageForSentFolderWithoutAttachments(header, body,
                                                          newInfo) {
  // clone the header (drops excess fields)
  var newHeader = mailRep.makeHeaderInfo(header);
  // clobber the id/suid
  newHeader.id = newInfo.id;
  newHeader.suid = newInfo.suid;
  // Mark the message as read.  We are clobbering other flags, but we don't
  // currently support a way for them to exist.
  newHeader.flags = ['\\Seen'];

  // clone the body, dropping excess fields like "attaching".
  var newBody = mailRep.makeBodyInfo(body);
  // transform attachments
  if (newBody.attachments) {
    newBody.attachments = newBody.attachments.map(function(oldAtt) {
      var newAtt =  mailRep.makeAttachmentPart(oldAtt);
      // mark the attachment as non-downloadable
      newAtt.type = 'application/x-gelam-no-download';
      // get rid of the blobs!
      newAtt.file = null;
      // we will keep around the sizeEstimate so they know how much they sent
      // and we keep around encoding/charset/textFormat because we don't care

      return newAtt;
    });
  }
  // We currently can't generate related parts, but just in case.
  if (newBody.relatedParts) {
    newBody.relatedParts = [];
  }
  // Body parts can be transferred verbatim.
  newBody.bodyReps = newBody.bodyReps.map(function(oldRep) {
    return mailRep.makeBodyPart(oldRep);
  });

  return { header: newHeader, body: newBody };
}


return {
  mergeDraftStates: mergeDraftStates,
  convertHeaderAndBodyToDraftRep: convertHeaderAndBodyToDraftRep,
  cloneDraftMessageForSentFolderWithoutAttachments:
    cloneDraftMessageForSentFolderWithoutAttachments
};

}); // end define
;
define('safe-base64',['require','exports','module'],function(require, exports, module) {

  /**
   * Safe atob-variant that does not throw exceptions and just ignores
   * characters that it does not know about. This is an attempt to
   * mimic node's implementation so that we can parse base64 with
   * newlines present as well as being tolerant of complete gibberish
   * people throw at us. Since we are doing this by hand, we also take
   * the opportunity to put the output directly in a typed array.
   *
   * In contrast, window.atob() throws Exceptions for all kinds of
   * angry reasons.
   */
  exports.decode = function(s) {
    var bitsSoFar = 0, validBits = 0, iOut = 0,
        arr = new Uint8Array(Math.ceil(s.length * 3 / 4));
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), bits;
      if (c >= 65 && c <= 90) // [A-Z]
        bits = c - 65;
      else if (c >= 97 && c <= 122) // [a-z]
        bits = c - 97 + 26;
      else if (c >= 48 && c <= 57) // [0-9]
        bits = c - 48 + 52;
      else if (c === 43) // +
        bits = 62;
      else if (c === 47) // /
        bits = 63;
      else if (c === 61) { // =
        validBits = 0;
        continue;
      }
      // ignore all other characters!
      else
        continue;
      bitsSoFar = (bitsSoFar << 6) | bits;
      validBits += 6;
      if (validBits >= 8) {
        validBits -= 8;
        arr[iOut++] = bitsSoFar >> validBits;
        if (validBits === 2)
          bitsSoFar &= 0x3;
        else if (validBits === 4)
          bitsSoFar &= 0xf;
      }
    }

    if (iOut < arr.length)
      return arr.subarray(0, iOut);
    return arr;
  }

  /**
   * UInt8Array => base64 => UTF-8 String
   */
  exports.encode = function(view) {
    var sbits, i;
    sbits = new Array(view.length);
    for (i = 0; i < view.length; i++) {
      sbits[i] = String.fromCharCode(view[i]);
    }
    // (btoa is binary JS string -> base64 ASCII string)
    return window.btoa(sbits.join(''));
  }

  /**
   * Base64 binary data from a Uint8array to a Uint8Array the way an
   * RFC2822 MIME message likes it. Which is to say with a maximum of
   * 76 bytes of base64 encoded data followed by a \r\n. If the last
   * line has less than 76 bytes of encoded data we still put the \r\n
   * on.
   *
   * This method came into existence because we were blowing out our
   * memory limits which is how it justifies all this specialization.
   * Use window.btoa if you don't need this exact logic/help.
   */
  exports.mimeStyleBase64Encode = function(data) {
    var wholeLines = Math.floor(data.length / 57);
    var partialBytes = data.length - (wholeLines * 57);
    var encodedLength = wholeLines * 78;
    if (partialBytes) {
      // The padding bytes mean we're always a multiple of 4 long.  And then we
      // still want a CRLF as part of our encoding contract.
      encodedLength += Math.ceil(partialBytes / 3) * 4 + 2;
    }

    var encoded = new Uint8Array(encodedLength);

    // A nibble is 4 bits.
    function encode6Bits(nibbly) {
      // [0, 25] => ['A', 'Z'], 'A'.charCodeAt(0) === 65
      if (nibbly <= 25) {
        encoded[iWrite++] = 65 + nibbly;
      }
      // [26, 51] => ['a', 'z'], 'a'.charCodeAt(0) === 97
      else if (nibbly <= 51) {
        encoded[iWrite++] = 97 - 26 + nibbly;
      }
      // [52, 61] => ['0', '9'], '0'.charCodeAt(0) === 48
      else if (nibbly <= 61) {
        encoded[iWrite++] = 48 - 52 + nibbly;
      }
      // 62 is '+',  '+'.charCodeAt(0) === 43
      else if (nibbly === 62) {
        encoded[iWrite++] = 43;
      }
      // 63 is '/',  '/'.charCodeAt(0) === 47
      else {
        encoded[iWrite++] = 47;
      }
    }

    var iRead = 0, iWrite = 0, bytesToRead;
    // Steady state
    for (bytesToRead = data.length; bytesToRead >= 3; bytesToRead -= 3) {
      var b1 = data[iRead++], b2 = data[iRead++], b3 = data[iRead++];
      // U = Use, i = ignore
      // UUUUUUii
      encode6Bits(b1 >> 2);
      // iiiiiiUU UUUUiiii
      encode6Bits(((b1 & 0x3) << 4) | (b2 >> 4));
      //          iiiiUUUU UUiiiiii
      encode6Bits(((b2 & 0xf) << 2) | (b3 >> 6));
      //                   iiUUUUUU
      encode6Bits(b3 & 0x3f);

      // newlines; it's time to wrap every 57 bytes, or if it's our
      // last full set
      if ((iRead % 57) === 0 || bytesToRead === 3) {
        encoded[iWrite++] = 13; // \r
        encoded[iWrite++] = 10; // \n
      }
    }
    // Leftovers (could be zero). If we ended on a full set in the
    // prior loop, the newline is taken care of.
    switch(bytesToRead) {
    case 2:
      b1 = data[iRead++];
      b2 = data[iRead++];
      encode6Bits(b1 >> 2);
      encode6Bits(((b1 & 0x3) << 4) | (b2 >> 4));
      encode6Bits(((b2 & 0xf) << 2) | 0);
      encoded[iWrite++] = 61; // '='.charCodeAt(0) === 61
      encoded[iWrite++] = 13; // \r
      encoded[iWrite++] = 10; // \n
      break;
    case 1:
      b1 = data[iRead++];
      encode6Bits(b1 >> 2);
      encode6Bits(((b1 & 0x3) << 4) | 0);
      encoded[iWrite++] = 61; // '='.charCodeAt(0) === 61
      encoded[iWrite++] = 61;
      encoded[iWrite++] = 13; // \r
      encoded[iWrite++] = 10; // \n
      break;
    }

    // The code was used to help sanity check, but is inert.  Left in for
    // reviewers or those who suspect this code! :)
    /*
     if (iWrite !== encodedLength)
     throw new Error('Badly written code! iWrite: ' + iWrite +
     ' encoded length: ' + encodedLength);
     */

    return encoded;
  }

}); // end define
;
define(
  'async_blob_fetcher',[
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
 * Draft jobs: save/delete drafts, attach/remove attachments.  These gets mixed
 * into the specific JobDriver implementations.
 **/

define('drafts/jobs',['require','exports','module','../db/mail_rep','../drafts/draft_rep','safe-base64','../async_blob_fetcher'],function(require, exports) {

var mailRep = require('../db/mail_rep');
var draftRep = require('../drafts/draft_rep');
var base64 = require('safe-base64');
var asyncFetchBlobAsUint8Array =
      require('../async_blob_fetcher').asyncFetchBlobAsUint8Array;

var draftsMixins = exports.draftsMixins = {};

////////////////////////////////////////////////////////////////////////////////
// attachBlobToDraft

/**
 * How big a chunk of an attachment should we encode in a single read?  Because
 * we want our base64-encoded lines to be 76 bytes long (before newlines) and
 * there's a 4/3 expansion factor, we want to read a multiple of 57 bytes.
 *
 * I initially chose the largest value just under 1MiB.  This appeared too
 * chunky on the ZTE open, so I'm halving to just under 512KiB.  Calculated via
 * Math.floor(512 * 1024 / 57) = 9198.  The encoded size of this ends up to be
 * 9198 * 78 which is ~700 KiB.  So together that's ~1.2 megs if we don't
 * generate a ton of garbage by creating a lot of intermediary strings.
 *
 * This seems reasonable given goals of not requiring the GC to run after every
 * block and not having us tie up the CPU too long during our encoding.
 */
draftsMixins.BLOB_BASE64_BATCH_CONVERT_SIZE = 9198 * 57;

/**
 * Incrementally convert an attachment into its base64 encoded attachment form
 * which we save in chunks to IndexedDB to avoid using too much memory now or
 * during the sending process.
 *
 * - Retrieve the body the draft is persisted to,
 * - Repeat until the attachment is fully attached:
 *   - take a chunk of the source attachment
 *   - base64 encode it into a Blob by creating a Uint8Array and manually
 *     encoding into that.  (We need to put a \r\n after every 76 bytes, and
 *     doing that using window.btoa is going to create a lot of garbage. And
 *     addressing that is no longer premature optimization.)
 *   - update the body with that Blob
 *   - trigger a save of the account so that IndexedDB writes the account to
 *     disk.
 *   - force the body block to be discarded from the cache and then re-get the
 *     body.  We won't be saving any memory until the Blob has been written to
 *     disk and we have forgotten all references to the in-memory Blob we wrote
 *     to the database.  (The Blob does not magically get turned into a
 *     reference to the database.)
 * - Be done.  Note that we leave the "small" Blobs independent; we do not
 *   create a super Blob.
 *
 * ## Logging ##
 *
 * We log at:
 * - The start of the process.
 * - For each block.
 * - The end of the process.
 */
draftsMixins.local_do_attachBlobToDraft = function(op, callback) {
  var localDraftsFolder = this.account.getFirstFolderWithType('localdrafts');
  if (!localDraftsFolder) {
    callback('moot');
    return;
  }
  var self = this;
  this._accessFolderForMutation(
    localDraftsFolder.id, /* needConn*/ false,
    function(nullFolderConn, folderStorage) {
      var wholeBlob = op.attachmentDef.blob;

      // - Retrieve the message
      var header, body;
      var blobOffset = 0;
      console.log('attachBlobToDraft: retrieving message');
      folderStorage.getMessage(
        op.existingNamer.suid, op.existingNamer.date, {}, gotMessage);
      function gotMessage(records) {
        header = records.header;
        body = records.body;

        if (!header || !body) {
          // No header/body suggests either some major invariant is busted or
          // one or more UIs issued attach commands after the draft was mooted.
          callback('failure-give-up');
          return;
        }

        body.attaching = mailRep.makeAttachmentPart({
          name: op.attachmentDef.name,
          type: wholeBlob.type,
          sizeEstimate: wholeBlob.size,
          pathName: op.attachmentDef.pathName,
          // this is where we put the Blob segments...
          file: [],
          vCardData: null
        });

        // save vcard blob to mail db, so that we can get it for preview
        if (wholeBlob.type.indexOf('vcard') > 0) {
          body.attaching.vCardData = wholeBlob;
        }
        convertNextChunk(body);
      }

      function convertNextChunk(refreshedBody) {
        body = refreshedBody;
        var nextOffset =
              Math.min(wholeBlob.size,
                       blobOffset + self.BLOB_BASE64_BATCH_CONVERT_SIZE);
        console.log('attachBlobToDraft: fetching', blobOffset, 'to',
                    nextOffset, 'of', wholeBlob.size);
        var slicedBlob = wholeBlob.slice(blobOffset, nextOffset);
        blobOffset = nextOffset;

        asyncFetchBlobAsUint8Array(slicedBlob, gotChunk);
      }

      function gotChunk(err, binaryDataU8) {
        console.log('attachBlobToDraft: fetched');
        // The Blob really should not be disappear out from under us, but it
        // could happen.
        if (err) {
          callback('failure-give-up');
          return;
        }

        var lastChunk = (blobOffset >= wholeBlob.size);
        var encodedU8 = base64.mimeStyleBase64Encode(binaryDataU8);
        body.attaching.file.push(new Blob([encodedU8],
                                          { type: wholeBlob.type }));

        var eventDetails;
        if (lastChunk) {
          var attachmentIndex = body.attachments.length;
          body.attachments.push(body.attaching);
          delete body.attaching; // bad news for shapes, but drafts are rare.

          eventDetails = {
            changeDetails: {
              attachments: [attachmentIndex]
            }
          };
        }
        else {
          // Do not generate an event for intermediary states; there is nothing
          // to observe.
          eventDetails = null;
        }

        console.log('attachBlobToDraft: flushing');
        folderStorage.updateMessageBody(
          header, body, { flushBecause: 'blobs' }, eventDetails,
          lastChunk ? bodyUpdatedAllDone : convertNextChunk);
        body = null;
      }

      function bodyUpdatedAllDone(newBodyInfo) {
        console.log('attachBlobToDraft: blob fully attached');
        callback(null);
      }
    },
    /* no conn => no deathback required */ null,
    'attachBlobToDraft');
};
draftsMixins.do_attachBlobToDraft = function(op, callback) {
  // there is no server component for this
  callback(null);
};
draftsMixins.check_attachBlobToDraft = function(op, callback) {
  callback(null, 'moot');
};
draftsMixins.local_undo_attachBlobToDraft = function(op, callback) {
  callback(null);
};
draftsMixins.undo_attachBlobToDraft = function(op, callback) {
  callback(null);
};

////////////////////////////////////////////////////////////////////////////////
// detachAttachmentFromDraft

draftsMixins.local_do_detachAttachmentFromDraft = function(op, callback) {
  var localDraftsFolder = this.account.getFirstFolderWithType('localdrafts');
  if (!localDraftsFolder) {
    callback('moot');
    return;
  }
  var self = this;
  this._accessFolderForMutation(
    localDraftsFolder.id, /* needConn*/ false,
    function(nullFolderConn, folderStorage) {
      // - Retrieve the message
      var header, body;
      console.log('detachAttachmentFromDraft: retrieving message');
      folderStorage.getMessage(
        op.existingNamer.suid, op.existingNamer.date, {}, gotMessage);
      function gotMessage(records) {
        header = records.header;
        body = records.body;

        if (!header || !body) {
          // No header/body suggests either some major invariant is busted or
          // one or more UIs issued attach commands after the draft was mooted.
          callback('failure-give-up');
          return;
        }

        // Just forget about the attachment.  Splice handles insane indices.
        body.attachments.splice(op.attachmentIndex, 1);

        console.log('detachAttachmentFromDraft: flushing');
        folderStorage.updateMessageBody(
          header, body,
          { flushBecause: 'blobs' },
          {
            changeDetails: {
              detachedAttachments: [op.attachmentIndex]
            }
          },
          bodyUpdatedAllDone);
      }

      function bodyUpdatedAllDone(newBodyInfo) {
        console.log('detachAttachmentFromDraft: blob fully detached');
        callback(null);
      }
    },
    /* no conn => no deathback required */ null,
    'detachAttachmentFromDraft');
};

draftsMixins.do_detachAttachmentFromDraft = function(op, callback) {
  // there is no server component for this at this time.
  callback(null);
};

draftsMixins.check_detachAttachmentFromDraft = function(op, callback) {
  callback(null);
};

draftsMixins.local_undo_detachAttachmentFromDraft = function(op, callback) {
  callback(null);
};

draftsMixins.undo_detachAttachmentFromDraft = function(op, callback) {
  callback(null);
};


////////////////////////////////////////////////////////////////////////////////
// saveDraft

/**
 * Save a draft; if there already was a draft, it gets replaced.  The new
 * draft gets a new date and id/SUID so it is logically distinct.  However,
 * we will propagate attachment and on-server information between drafts.
 */
draftsMixins.local_do_saveDraft = function(op, callback) {
  var localDraftsFolder = this.account.getFirstFolderWithType('localdrafts');
  if (!localDraftsFolder) {
    callback('moot');
    return;
  }
  var self = this;
  this._accessFolderForMutation(
    localDraftsFolder.id, /* needConn*/ false,
    function(nullFolderConn, folderStorage) {
      // there's always a header add and a body add
      var waitingForDbMods = 2;
      function gotMessage(oldRecords) {
        var newRecords = draftRep.mergeDraftStates(
          oldRecords.header, oldRecords.body,
          op.draftRep,
          op.newDraftInfo,
          self.account.universe);

        // If there already was a draft saved, delete it.
        // Note that ordering of the removal and the addition doesn't really
        // matter here because of our use of transactions.
        if (op.existingNamer) {
          waitingForDbMods++;
          folderStorage.deleteMessageHeaderAndBody(
            op.existingNamer.suid, op.existingNamer.date, dbModCompleted);
        }

        folderStorage.addMessageHeader(newRecords.header, newRecords.body,
                                       dbModCompleted);
        folderStorage.addMessageBody(newRecords.header, newRecords.body,
                                     dbModCompleted);
        function dbModCompleted() {
          if (--waitingForDbMods === 0) {
            callback(
              /* no error */ null,
              /* result */ newRecords,
              /* save account */ true);
          }
        }
      }

      if (op.existingNamer) {
        folderStorage.getMessage(
          op.existingNamer.suid, op.existingNamer.date, null, gotMessage);
      }
      else {
        gotMessage({ header: null, body: null });
      }
    },
    /* no conn => no deathback required */ null,
    'saveDraft');
};

/**
 * FUTURE WORK: Save a draft to the server; this is inherently IMAP only.
 * Tracked on: https://bugzilla.mozilla.org/show_bug.cgi?id=799822
 *
 * It is very possible that we will save local drafts faster / more frequently
 * than we can update our server state.  It only makes sense to upload the
 * latest draft state to the server.  Because we delete our old local drafts,
 * it's obvious when we should skip out on updating the server draft for
 * something.
 *
 * Because IMAP drafts have to replace the prior drafts, we use our old 'srvid'
 * to know what message to delete as well as what message to pull attachments
 * from when we're in a mode where we upload attachments to drafts and CATENATE
 * is available.
 */
draftsMixins.do_saveDraft = function(op, callback) {
  callback(null);
};
draftsMixins.check_saveDraft = function(op, callback) {
  callback(null, 'moot');
};
draftsMixins.local_undo_saveDraft = function(op, callback) {
  callback(null);
};
draftsMixins.undo_saveDraft = function(op, callback) {
  callback(null);
};

////////////////////////////////////////////////////////////////////////////////
// deleteDraft

draftsMixins.local_do_deleteDraft = function(op, callback) {
  var localDraftsFolder = this.account.getFirstFolderWithType('localdrafts');
  if (!localDraftsFolder) {
    callback('moot');
    return;
  }
  var self = this;
  this._accessFolderForMutation(
    localDraftsFolder.id, /* needConn*/ false,
    function(nullFolderConn, folderStorage) {
      folderStorage.deleteMessageHeaderAndBody(
        op.messageNamer.suid, op.messageNamer.date,
        function() {
          callback(null, null, /* save account */ true);
        });
    },
    /* no conn => no deathback required */ null,
    'deleteDraft');
};

draftsMixins.do_deleteDraft = function(op, callback) {
  // there is no server component for this
  callback(null);
};
draftsMixins.check_deleteDraft = function(op, callback) {
  callback(null, 'moot');
};
draftsMixins.local_undo_deleteDraft = function(op, callback) {
  callback(null);
};
draftsMixins.undo_deleteDraft = function(op, callback) {
  callback(null);
};

////////////////////////////////////////////////////////////////////////////////

}); // end define
;
define('disaster-recovery',['require','./logic'],function(require) {
  /**
   * DisasterRecovery: A universal error-handling helper. When
   * unexpected and unhandled exceptions occur in the world, do the
   * best we can to recover as safely as possible from exceptions
   * thrown in strange places. This entails finishing any job ops,
   * closing any socket (if applicable) to ensure it doesn't get left
   * in a weird state, and logging an error as best we can.
   *
   * Besides connections, the only resources job-ops can acquire are
   * folder mutexes.  Currently, these are tracked
   *
   * In order to do this, we must track the following:
   *
   * - Which account a socket is attached to (in case it throws)
   * - Whether or not an account is running a job operation
   *
   * Then, the error handling is just a process of cleaning up any
   * resources we can.
   */

  var logic = require('./logic');

  var socketToAccountMap = new WeakMap();
  var accountToOperationMap = new WeakMap();

  var scope = logic.scope('DisasterRecovery');

  var DisasterRecovery = {

    setCurrentAccountOp: function(account, op, jobCompletedCallback) {
      accountToOperationMap.set(account, {
        op: op,
        callback: jobCompletedCallback
      });
    },

    clearCurrentAccountOp: function(account) {
      accountToOperationMap.delete(account);
    },

    // Track which account maps to each socket.

    associateSocketWithAccount: function(socket, account) {
      socketToAccountMap.set(socket, account);
    },

    /**
     * Wrap calls to external socket handlers in this function; if
     * they throw an exception, we'll try to mitigate it.
     */
    catchSocketExceptions: function(socket, fn) {
      try {
        fn();
      } catch(e) {
        var account = socketToAccountMap.get(socket);

        // Attempt to close the socket so that we're less likely to
        // get stuck in a completely broken state, either by sending
        // bogus data or barfing on further received data.
        try {
          socket.close();
        } catch(socketEx) {
          console.error('Error attempting to close socket:', socketEx);
        }

        this.handleDisastrousError(e, account);
      }
    },

    /**
     * Something horrible has happened, and we must clean up the mess.
     * Perhaps a socket ondata handler threw an exception, or
     * something of that nature. If we're running a job, we should
     * abort and maybe reschedule. If we have the mutex, we must
     * release it.
     *
     * @param {Error} exception
     * @param {MailAccount|null} account
     */
    handleDisastrousError: function(e, account) {
      var op, jobDoneCallback;
      if (account) {
        var opInfo = accountToOperationMap.get(account);
        if (opInfo) {
          op = opInfo.op;
          jobDoneCallback = opInfo.callback;
        }
      }

      logic(scope, 'exception', {
        accountId: account && account.id,
        op: op,
        error: e,
        errorName: e && e.name,
        errorMessage: e && e.message,
        stack: e.stack
      });

      console.error('*** Disastrous Error for email accountId',
                    account && account.id,
                    '-- attempting to recover...');


      // See if we can recover in any way.
      if (account) {
        if (op) {
          logic(scope, 'finished-job', { error: e });
          console.warn('Force-completing in-progress op:', op);
          jobDoneCallback('disastrous-error');
        } else {
          console.warn('No job operation was currently running.');
        }
      } else {
        console.warn('No account associated with this error; nothing to abort.');
      }
    }

  };

  return DisasterRecovery;
});

define('accountmixins',['require','exports','module','./disaster-recovery','logic'],function(require, exports) {

var DisasterRecovery = require('./disaster-recovery');
var logic = require('logic');

/**
 * The no-op operation for job operations that are not implemented.
 * Returns successs in a future turn of the event loop.
 */
function unimplementedJobOperation(op, callback) {
  window.setZeroTimeout(function() {
    callback(null, null);
  });
}

/**
 * Account Mixins:
 *
 * This mixin function is executed from the constructor of the
 * CompositeAccount and ActiveSyncAccount, with 'this' being bound to
 * the main account instance. If the account has separate receive/send
 * parts, they are passed as arguments. (ActiveSync's receive and send
 * pieces merely reference the root account.)
 */
exports.accountConstructorMixin = function(receivePiece, sendPiece) {
  // The following flags are set on the receivePiece, because the
  // receiving side is what manages the job operations (and sending
  // messages from the outbox is a job).

  // On startup, we need to ignore any stale sendStatus information
  // from messages in the outbox. See `sendOutboxMessages` in
  // jobmixins.js.
  receivePiece.outboxNeedsFreshSync = true;
  // This is a runtime flag, used to temporarily prevent
  // `sendOutboxMessages` from executing, such as when the user is
  // actively trying to edit the list of messages in the Outbox.
  receivePiece.outboxSyncEnabled = true;
};

/**
 * @args[
 *   @param[op MailOp]
 *   @param[mode @oneof[
 *     @case['local_do']{
 *       Apply the mutation locally to our database rep.
 *     }
 *     @case['check']{
 *       Check if the manipulation has been performed on the server.  There
 *       is no need to perform a local check because there is no way our
 *       database can be inconsistent in its view of this.
 *     }
 *     @case['do']{
 *       Perform the manipulation on the server.
 *     }
 *     @case['local_undo']{
 *       Undo the mutation locally.
 *     }
 *     @case['undo']{
 *       Undo the mutation on the server.
 *     }
 *   ]]
 *   @param[callback @func[
 *     @args[
 *       @param[error @oneof[String null]]
 *     ]
 *   ]]
 *   }
 * ]
 */
exports.runOp = function runOp(op, mode, callback) {
  console.log('runOp(' + mode + ': ' + JSON.stringify(op).substring(0, 160) +
              ')');

  var methodName = mode + '_' + op.type;

  // If the job driver doesn't support the operation, assume that it
  // is a moot operation that will succeed. Assign it a no-op callback
  // that completes in the next tick, so as to maintain job ordering.
  var method = this._jobDriver[methodName];
  if (!method) {
    console.warn('Unsupported op:', op.type, 'mode:', mode);
    method = unimplementedJobOperation;
  }

  var alreadyCompleted = false;

  var jobCompletedCallback = function(error, resultIfAny, accountSaveSuggested) {
    // If DisasterRecovery already called the completion callback due
    // to an unforeseen error, ensure that we don't try to
    // double-resolve this job.
    if (alreadyCompleted) {
      console.warn('Job already completed, ignoring secondary completion:',
                   mode, JSON.stringify(op).substring(0, 160), error, resultIfAny);
      return;
    }
    alreadyCompleted = true;

    DisasterRecovery.clearCurrentAccountOp(this);
    this._jobDriver.postJobCleanup(error);
    // We used to log the runOp_end here, but this is too early because the
    //  book-keeping for the op actually happens in the following callback.  So
    //  we leave it to _localOpCompleted and _serverOpCompleted to log this.
    // defer the callback to the next tick to avoid deep recursion
    window.setZeroTimeout(function() {
      callback(error, resultIfAny, accountSaveSuggested);
    });
  }.bind(this);

  DisasterRecovery.setCurrentAccountOp(this, op, jobCompletedCallback);

  // Legacy tests:
  logic(this, 'runOp_begin', { mode: mode, type: op.type, op: op });
  // New-style tests:
  Object.defineProperty(op, '_logicAsyncEvent', {
    configurable: true,
    enumerable: false, // So that we don't try to JSONify it.
    value: logic.startAsync(this, 'runOp', {
      mode: mode, type: op.type, op: op
    })
  });

  try {
    method.call(this._jobDriver, op, jobCompletedCallback);
  }
  catch (ex) {
    DisasterRecovery.clearCurrentAccountOp(this);
    logic(this, 'opError', { mode: mode, type: op.type, ex: ex });
  }
};


/**
 * Return the folder metadata for the first folder with the given type, or null
 * if no such folder exists.
 */
exports.getFirstFolderWithType = function(type) {
  var folders = this.folders;
  for (var iFolder = 0; iFolder < folders.length; iFolder++) {
    if (folders[iFolder].type === type)
      return folders[iFolder];
  }
 return null;
};
exports.getFolderByPath = function(folderPath) {
  var folders = this.folders;
  for (var iFolder = 0; iFolder < folders.length; iFolder++) {
    if (folders[iFolder].path === folderPath)
      return folders[iFolder];
  }
 return null;
};

/**
 * Ensure that local-only folders live in a reasonable place in the
 * folder hierarchy by moving them if necessary.
 *
 * We proactively create local-only folders at the root level before
 * we synchronize with the server; if possible, we want these
 * folders to reside as siblings to other system-level folders on
 * the account. This is called at the end of syncFolderList, after
 * we have learned about all existing server folders.
 */
exports.normalizeFolderHierarchy = function() {
  // Find a folder for which we'd like to become a sibling.
  var sibling =
        this.getFirstFolderWithType('drafts') ||
        this.getFirstFolderWithType('sent');

  // If for some reason we can't find those folders yet, that's
  // okay, we will try this again after the next folder sync.
  if (!sibling) {
    return;
  }

  var parent = this.getFolderMetaForFolderId(sibling.parentId);

  // NOTE: `parent` may be null if `sibling` is a top-level folder.
  var foldersToMove = [this.getFirstFolderWithType('localdrafts'),
                       this.getFirstFolderWithType('outbox')];

  foldersToMove.forEach(function(folder) {
    // These folders should always exist, but we double-check here
    // for safety. Also, if the folder is already in the right
    // place, we're done.
    if (!folder || folder.parentId === sibling.parentId) {
      return;
    }

    console.log('Moving folder', folder.name,
                'underneath', parent && parent.name || '(root)');


    this.universe.__notifyRemovedFolder(this, folder);

    // On `delim`: We previously attempted to discover a
    // server-specific root delimiter. ActiveSync hard-codes "/". POP3
    // doesn't even go that far. An empty delimiter would be
    // incorrect, as it could cause folder paths to smush into one
    // another. In the case where our folder doesn't specify a
    // delimiter, fall back to the standard-ish '/'.
    if (parent) {
      folder.path = parent.path + (parent.delim || '/') + folder.name;
      folder.delim = parent.delim || '/';
      folder.parentId = parent.id;
      folder.depth = parent.depth + 1;
    } else {
      folder.path = folder.name;
      folder.delim = '/';
      folder.parentId = null;
      folder.depth = 0;
    }

    this.universe.__notifyAddedFolder(this, folder);

  }, this);

};

/**
 * Save the state of this account to the database.  This entails updating all
 * of our highly-volatile state (folderInfos which contains counters, accuracy
 * structures, and our block info structures) as well as any dirty blocks.
 *
 * This should be entirely coherent because the structured clone should occur
 * synchronously during this call, but it's important to keep in mind that if
 * that ever ends up not being the case that we need to cause mutating
 * operations to defer until after that snapshot has occurred.
 */
exports.saveAccountState = function(reuseTrans, callback, reason) {
  if (!this._alive) {
    logic(this, 'accountDeleted', { reason: 'saveAccountState' });
    return null;
  }

  logic(this, 'saveAccountState_begin', { reason: reason,
                                          folderSaveCount: null });

  // Indicate save is active, in case something, like
  // signaling the end of a sync, needs to run after
  // a save, via runAfterSaves.
  this._saveAccountStateActive = true;
  if (!this._deferredSaveAccountCalls) {
    this._deferredSaveAccountCalls = [];
  }

  if (callback)
    this.runAfterSaves(callback);

  var perFolderStuff = [], self = this;
  for (var iFolder = 0; iFolder < this.folders.length; iFolder++) {
    var folderPub = this.folders[iFolder],
        folderStorage = this._folderStorages[folderPub.id],
        folderStuff = folderStorage.generatePersistenceInfo();
    if (folderStuff)
      perFolderStuff.push(folderStuff);
  }
  var folderSaveCount = perFolderStuff.length;
  var trans = this._db.saveAccountFolderStates(
    this.id, this._folderInfos, perFolderStuff,
    this._deadFolderIds,
    function stateSaved() {
      this._saveAccountStateActive = false;
      logic(this, 'saveAccountState_end', { reason: reason,
                                           folderSaveCount: folderSaveCount });

      // NB: we used to log when the save completed, but it ended up being
      // annoying to the unit tests since we don't block our actions on
      // the completion of the save at this time.

      var callbacks = this._deferredSaveAccountCalls;
      this._deferredSaveAccountCalls = [];
      callbacks.forEach(function(callback) {
        callback();
      });
    }.bind(this),
    reuseTrans);
  // Reduce the length of time perFolderStuff and its contents are kept alive.
  perFolderStuff = null;
  this._deadFolderIds = null;
  return trans;
};

exports.runAfterSaves = function(callback) {
  if (this._saveAccountStateActive || this._saveAccountIsImminent) {
    this._deferredSaveAccountCalls.push(callback);
  } else {
    callback();
  }
};

/**
 * This function goes through each folder storage object in
 * an account and performs the necessary upgrade steps if
 * there is a new version. See upgradeIfNeeded in mailslice.js.
 * Note: This function schedules a job for each folderStorage
 * object in the account.
 */
exports.upgradeFolderStoragesIfNeeded = function() {
  for (var key in this._folderStorages) {
    var storage = this._folderStorages[key];
    storage.upgradeIfNeeded();
  }
}

}); // end define
;
/**
 * Process text/plain message bodies for quoting / signatures.
 *
 * We have two main goals in our processing:
 *
 * 1) Improve display by being able to automatically collapse excessively quoted
 * blocks and large/redundant signature blocks and hide them entirely from snippet
 * generation.
 *
 * 2) Allow us to reply to messages and provide automatically limited quoting.
 * Specifically, we want to provide one message's worth of context when replying
 * to a message.  We also want to avoid messages in a thread indefinitely
 * growing in size because all users keep replying and leaving default quoting
 * intact.
 *
 * The quotechew representation is a flat array consisting of (flattened) pairs
 * of an encoded content type integer and a string that is the content whose
 * nature is described by that block.
 *
 * NOTE: This representation was okay, but arguably a compromise between:
 * - premature optimization storage concerns
 * - wide eyes looking at a future where we could be more clever about quoting
 *   than we ended up being able to be
 * - wanting to be able to efficiently render the quoted text into the DOM
 *   without having complicated render code or having to worry about security
 *   issues.
 *
 * Going forward, a more DOM-y representation that could allow the UI to
 * more uniformly treat text/plain and text/html for display purposes could be
 * nice.  In particular, I think it would be great to be able to have quotes
 * tagged as such and things like boilerplate be indicated both at the top-level
 * and inside quotes.  This would be great for smart-collapsing of quotes and
 * things no one cares about.
 **/

define(
  'quotechew',[
    'exports'
  ],
  function(
    exports
  ) {

////////////////////////////////////////////////////////////////////////////////
// Content Type Encoding
//
// We encode content type values as integers in an attempt to have the serialized
// form not be super huge and be pretty quick to check without generating garbage
// objects.
//
// The low-order nibble encodes the type for styling purposes; everything above
// that nibble is per-type and may encode integer values or use hot bits to
// indicate type.

/**
 * Actual content of the message written by the user.
 */
var CT_AUTHORED_CONTENT = 0x1;
/**
 * Niceties like greetings/thanking someone/etc.  These are things that we want to
 * show when displaying the message, but that arguably are of lower importance and
 * might want to be elided for snippet purposes, etc.
 */
var CT_AUTHORED_NICETIES = 0x11;
/**
 * The signature of the message author; might contain useful information in it.
 */
var CT_SIGNATURE = 0x2;

/**
 * The line that says "Blah wrote:" that precedes a quote.  It's not part of the
 * user content, but it's also not part of the quote.
 */
var CT_LEADIN_TO_QUOTE = 0x3;

var CT_QUOTED_TYPE = 0x4;

/**
 * A quoted reply; eligible for collapsing.  Depth of quoting will also be
 * encoded in the actual integer value.
 */
var CT_QUOTED_REPLY = 0x14;
/**
 * A quoted forwarded message; we would guess that the user has not previously seen
 * the message and the quote wants to be displayed.
 */
var CT_QUOTED_FORWARD = 0x24;
/**
 * Quoted content that has not been pruned.  Aspirational!
 */
var CT_QUOTED_IN_ENTIRETY = 0x40;
/**
 * The quote has been subjected to some level of manual intervention. Aspirational!
 */
var CT_QUOTED_GARDENED = 0x80;

var CT_QUOTE_DEPTH_MASK = 0xff00;

/**
 * Legal-ish boilerplate about how it's only for the recipient, etc. etc.
 * Generally going to be long and boring.
 */
var CT_BOILERPLATE_DISCLAIMER = 0x5;
/**
 * Boilerplate about the message coming from a mailing list, info about the
 * mailing list.
 */
var CT_BOILERPLATE_LIST_INFO = 0x6;
/**
 * Product branding boilerplate that may or may not indicate that the composing
 * device was a mobile device (which is useful).
 */
var CT_BOILERPLATE_PRODUCT = 0x7;
/**
 * Advertising automatically inserted by the mailing list or free e-mailing service,
 * etc.  This is assumed to be boring.
 */
var CT_BOILERPLATE_ADS = 0x8;

var CHARCODE_GT = ('>').charCodeAt(0),
    CHARCODE_SPACE = (' ').charCodeAt(0),
    CHARCODE_NBSP = ('\xa0').charCodeAt(0),
    CHARCODE_NEWLINE = ('\n').charCodeAt(0);

var RE_ORIG_MESAGE_DELIM = /^-{5} Original Message -{5}$/;

var RE_ALL_WS = /^\s+$/;

var RE_SECTION_DELIM = /^[_-]{6,}$/;

var RE_LIST_BOILER = /mailing list$/;

/**
 * Non-localized hard-coded heuristic to help us detect whether a line is the
 * lead-in to a quote block.  This is only checked against the last content line
 * preceding a quote block.  This only results in styling guidance, so if it's
 * too aggresive or insufficiently aggressive, the worst that happens is the
 * line will be dark gray instead of black.  (For now!  Moohoohahahahahaha.)
 */
var RE_WROTE_LINE = /wrote/;

/**
 * Hacky reply helper to check if the last line in a content block contains the
 * words wrote.  In a nutshell:
 * - The current quoting logic can only detect a quoting lead-in in non-quoted
 *   text and I'm not crazy enough to enhance this at this time.  (The current
 *   mechanism is already complex and assumes it's not dealing with '>'
 *   characters.  An enhanced mechanism could operate on a normalized
 *   representation where the quoting has been normalized to no longer include
 *   the > characters.  That would be a sortof multi-pass AST/tree-transformer.
 *   Future work.)
 * - The reply logic performs normalization on output, but without knowing about
 *   lead-ins, it makes the wrong normalization call for these wrote lines,
 *   inserting wasted whitespace.  This regex is an attempt to retroactively do
 *   the cool thing the former bullet proposes.  And it does indeed work out
 *   because of our aggressive newline normalization logic.
 * - Obviously this is not localized at all, but neither is the above.
 *
 * To keep the regex cost-effective and doing what we want, we anchor it to the
 * end of the string and ensure there are no newline characters before wrote.
 * (And we check for wrote without any other constraints because that's what the
 * above does.)
 *
 * Again, since this only controls whether a newline is inserted or not, it's
 * really not the end of the world.
 */
var RE_REPLY_LAST_LINE_IN_BLOCK_CONTAINS_WROTE = /wrote[^\n]+$/;

var RE_SIGNATURE_LINE = /^-- $/;

/**
 * The maximum number of lines that can be in a boilerplate chunk.  We expect
 * disclaimer boilerplate to be what drives this.
 */
var MAX_BOILERPLATE_LINES = 20;

/**
 * Catch various common well-known product branding lines:
 * - "Sent from my iPhone/iPad/mobile device".  Apple, others.
 * - "Sent from my Android ...".  Common prefix for wildly varying Android
 *     strings.
 * - "Sent from my ...".  And there are others that don't match the above but
 *     that match the prefix.
 * - "Sent from Mobile"
 */
var RE_PRODUCT_BOILER = /^(?:Sent from (?:Mobile|my .+))$/;

var RE_LEGAL_BOILER_START = /^(?:This message|Este mensaje)/;

/**
 * String.indexOf helper that will return the provided default value when -1
 * would otherwise be returned.
 */
function indexOfDefault(string, search, startIndex, defVal) {
  var idx = string.indexOf(search, startIndex);
  if (idx === -1)
    return defVal;
  return idx;
}

var NEWLINE = '\n', RE_NEWLINE = /\n/g;

/**
 * Count the number of newlines in the string in the [startIndex, endIndex)
 * characterized region.  (Using mathy syntax there: startIndex is inclusive,
 * endIndex is exclusive.)
 */
function countNewlinesInRegion(string, startIndex, endIndex) {
  var idx = startIndex - 1, count = 0;
  for (;;) {
    idx = string.indexOf(NEWLINE, idx + 1);
    if (idx === -1 || idx >= endIndex)
      return count;
    count++;
  }
  return null;
}

/**
 * Process the contents of a text body for quoting purposes.
 *
 * Key behaviors:
 *
 * - Whitespace is trimmed at the boundaries of regions.  Our CSS styling will
 *   take care of making sure there is appropriate whitespace.  This is an
 *   intentional normalization that should cover both people who fail to put
 *   whitespace in their messages (jerks) and people who put whitespace in.
 *
 * - Newlines are maintained inside of blocks.
 *
 * - We look backwards for boilerplate blocks once we encounter the first quote
 *   block or the end of the message.  We keep incrementally looking backwards
 *   until we reach something that we don't think is boilerplate.
 */
exports.quoteProcessTextBody = function quoteProcessTextBody(fullBodyText) {
  // Our serialized representation of the body, incrementally built.  Consists
  // of pairwise integer codes and content string blocks.
  var contentRep = [];
  // The current content line being parsed by our parsing loop, does NOT include
  // the trailing newline.
  var line;

  /**
   * Count the number of '>' quoting characters in the line, mutating `line` to
   * not include the quoting characters.  Some clients will place a single space
   * between each '>' at higher depths, and we support that.  But any more spaces
   * than that and we decide we've reached the end of the quote marker.
   */
  function countQuoteDepthAndNormalize() {
    // We know that the first character is a '>' already.
    var count = 1;
    var lastStartOffset = 1, spaceOk = true;

    for (var i = 1; i < line.length; i++) {
      var c = line.charCodeAt(i);
      if (c === CHARCODE_GT) {
        count++;
        lastStartOffset++;
        spaceOk = true;
      }
      else if (c === CHARCODE_SPACE) {
        if (!spaceOk)
          break;
        lastStartOffset++;
        spaceOk = false;
      }
      else {
        break;
      }
    }
    if (lastStartOffset)
      line = line.substring(lastStartOffset);
    return count;
  }

  /**
   * Scan backwards line-by-line through a chunk of content (AKA non-quoted)
   * text looking for boilerplate chunks.  We can stop once we determine we're
   * not in boilerplate.
   *
   * Note: The choice to not run us against quoted blocks was an intentional
   * simplification at the original time of implementation, presumably because
   * knowing something was a quote was sufficient and realistically all our
   * styling could hope to handle.  Also, the ontological commitment to a flat
   * document representation.  In retrospect, I think it could make sense to
   * use a tree that marks up each layer as quote/content/boilerplate/etc. in a
   * more DOM-like fashion.
   *
   * - Product blurbs must be the first non-whitespace line seen to be detected;
   *   they do not have to be delimited by an ASCII line.
   *
   * - Legal boilerplate must be delimited by an ASCII line.
   */
  function lookBackwardsForBoilerplate(chunk) {
    var idxLineStart, idxLineEnd, line,
        idxRegionEnd = chunk.length,
        scanLinesLeft = MAX_BOILERPLATE_LINES,
        sawNonWhitespaceLine = false,
        lastContentLine = null,
        lastBoilerplateStart = null,
        sawProduct = false,
        insertAt = contentRep.length;

    function pushBoilerplate(contentType, merge) {
      var boilerChunk = chunk.substring(idxLineStart, idxRegionEnd);
      var idxChunkEnd = idxLineStart - 1;
      // We used to do a trimRight here, but that would eat spaces in addition
      // to newlines.  This was undesirable for both roundtripping purposes and
      // mainly because the "-- " signature marker has a significant space
      // character on the end there.
      while (chunk.charCodeAt(idxChunkEnd - 1) === CHARCODE_NEWLINE) {
        idxChunkEnd--;
      }
      var newChunk = chunk.substring(0, idxChunkEnd);
      var ate = countNewlinesInRegion(chunk, newChunk.length, idxLineStart - 1);
      chunk = newChunk;
      idxRegionEnd = chunk.length;

      if (!merge) {
        contentRep.splice(insertAt, 0,
                          ((ate&0xff) << 8) | contentType,
                          boilerChunk);
      }
      else {
        // nb: this merge does not properly reuse the previous existing 'ate'
        // value; if we start doing more complex merges, the hardcoded '\n'
        // below will need to be computed.
        contentRep[insertAt] = ((ate&0xff) << 8) | (contentRep[insertAt]&0xff);
        contentRep[insertAt + 1] = boilerChunk + '\n' +
                                     contentRep[insertAt + 1];
      }

      sawNonWhitespaceLine = false;
      scanLinesLeft = MAX_BOILERPLATE_LINES;
      lastContentLine = null;
      lastBoilerplateStart = idxLineStart;
    }

    for (idxLineStart = chunk.lastIndexOf('\n') + 1,
           idxLineEnd = chunk.length;
         idxLineEnd > 0 && scanLinesLeft;
         idxLineEnd = idxLineStart - 1,
           idxLineStart = chunk.lastIndexOf('\n', idxLineEnd - 1) + 1,
           scanLinesLeft--) {

      // (do not include the newline character)
      line = chunk.substring(idxLineStart, idxLineEnd);

      // - Skip whitespace lines.
      if (!line.length ||
          (line.length === 1 && line.charCodeAt(0) === CHARCODE_NBSP))
        continue;

      // - Explicit signature demarcation
      if (RE_SIGNATURE_LINE.test(line)) {
        // Check if this is just tagging something we decided was boilerplate in
        // a proper signature wrapper.  If so, then execute a boilerplate merge.
        if (idxLineEnd + 1 === lastBoilerplateStart) {
          pushBoilerplate(null, true);
        }
        else {
          pushBoilerplate(CT_SIGNATURE);
        }
        continue;
      }

      // - Section delimiter; try and classify what lives in this section
      if (RE_SECTION_DELIM.test(line)) {
        if (lastContentLine) {
          // - Look for a legal disclaimer sequentially following the line.
          if (RE_LEGAL_BOILER_START.test(lastContentLine)) {
            pushBoilerplate(CT_BOILERPLATE_DISCLAIMER);
            continue;
          }
          // - Look for mailing list
          if (RE_LIST_BOILER.test(lastContentLine)) {
            pushBoilerplate(CT_BOILERPLATE_LIST_INFO);
            continue;
          }
        }
        // The section was not boilerplate, so thus ends the reign of
        // boilerplate.  Bail.
        return chunk;
      }
      // - A line with content!
      if (!sawNonWhitespaceLine) {
        sawNonWhitespaceLine = true;
      }
      lastContentLine = line;
    }

    return chunk;
  }

  /**
   * Interpret the current content region starting at (from the loop)
   * idxRegionStart as a user-authored content-region which may have one or more
   * segments of boilerplate on the end that should be chopped off and marked as
   * such.
   *
   * We are called by the main parsing loop and assume that all the shared state
   * variables that we depend on have been properly maintained and we will,
   * in-turn, mutate them.
   */
  function pushContent(considerForBoilerplate, upToPoint, forcePostLine) {
    if (idxRegionStart === null) {
      if (atePreLines) {
        // decrement atePreLines if we are not the first chunk because then we get
        // an implicit/free newline.
        if (contentRep.length)
          atePreLines--;
        contentRep.push((atePreLines&0xff) << 8 | CT_AUTHORED_CONTENT);
        contentRep.push('');
      }
    }
    else {
      if (upToPoint === undefined)
        upToPoint = idxLineStart;

      var chunk = fullBodyText.substring(idxRegionStart,
                                         idxLastNonWhitespaceLineEnd);
      var atePostLines = forcePostLine ? 1 : 0;
      if (idxLastNonWhitespaceLineEnd + 1 !== upToPoint) {
        // We want to count the number of newlines after the newline that
        // belongs to the last non-meaningful-whitespace line up to the
        // effective point.  If we saw a lead-in, the effective point is
        // preceding the lead-in line's newline.  Otherwise it is the start point
        // of the current line.
        atePostLines += countNewlinesInRegion(fullBodyText,
                                              idxLastNonWhitespaceLineEnd + 1,
                                              upToPoint);
      }
      contentRep.push(((atePreLines&0xff) << 8) | ((atePostLines&0xff) << 16) |
                      CT_AUTHORED_CONTENT);
      var iChunk = contentRep.push(chunk) - 1;

      if (considerForBoilerplate) {
        var newChunk = lookBackwardsForBoilerplate(chunk);
        if (chunk.length !== newChunk.length) {
          // Propagate any atePost lines.
          if (atePostLines) {
            var iLastMeta = contentRep.length - 2;
            // We can blindly write post-lines since boilerplate currently
            // doesn't infer any post-newlines on its own.
            contentRep[iLastMeta] = ((atePostLines&0xff) << 16) |
                                    contentRep[iLastMeta];
            contentRep[iChunk - 1] = ((atePreLines&0xff) << 8) |
                                     CT_AUTHORED_CONTENT;
          }

          // If we completely processed the chunk into boilerplate, then we can
          // remove it after propagating any pre-eat amount.
          if (!newChunk.length) {
            if (atePreLines) {
              var bpAte = (contentRep[iChunk + 1] >> 8)&0xff;
              bpAte += atePreLines;
              contentRep[iChunk + 1] = ((bpAte&0xff) << 8) |
                                       (contentRep[iChunk + 1]&0xffff00ff);
            }
            contentRep.splice(iChunk - 1, 2);
          }
          else {
            contentRep[iChunk] = newChunk;
          }
        }
      }
    }

    atePreLines = 0;
    idxRegionStart = null;
    lastNonWhitespaceLine = null;
    idxLastNonWhitespaceLineEnd = null;
    idxPrevLastNonWhitespaceLineEnd = null;
  }

  /**
   * Interpret the current content region starting at (from the loop)
   * idxRegionStart as a quoted block.
   *
   * We are called by the main parsing loop and assume that all the shared state
   * variables that we depend on have been properly maintained and we will,
   * in-turn, mutate them.
   */
  function pushQuote(newQuoteDepth) {
    var atePostLines = 0;
    // Discard empty lines at the end.  We already skipped adding blank lines, so
    // no need to do the front side.
    while (quoteRunLines.length &&
           !quoteRunLines[quoteRunLines.length - 1]) {
      quoteRunLines.pop();
      atePostLines++;
    }
    contentRep.push(((atePostLines&0xff) << 24) |
                    ((ateQuoteLines&0xff) << 16) |
                    ((inQuoteDepth - 1) << 8) |
                    CT_QUOTED_REPLY);
    contentRep.push(quoteRunLines.join('\n'));
    inQuoteDepth = newQuoteDepth;
    if (inQuoteDepth)
      quoteRunLines = [];
    else
      quoteRunLines = null;

    ateQuoteLines = 0;
    generatedQuoteBlock = true;
  }

  // == On indices and newlines
  // Our line ends always point at the newline for the line; for the last line
  // in the body, there may be no newline, but that doesn't matter since substring
  // is fine with us asking for more than it has.


  // ==== It's the big parsing loop!
  // Each pass of the for-loop tries to look at one line of the message at a
  // time.  (This is sane because text/plain messages are line-centric.)
  //
  // The main goal of the loop is to keep processing lines of a single content
  // type until it finds content of a different type and then "push"/flush what
  // it accumulated.  Then it can start processing that content type until it
  // finds a different content type.
  //
  // This mainly means noticing when we change quoting levels, and if we're
  // entering a deeper level of quoting, separating off any quoting lead-in (ex:
  // "Alive wrote:").

  var idxLineStart, idxLineEnd, bodyLength = fullBodyText.length,
      // null means we are looking for a non-whitespace line.
      idxRegionStart = null,
      lastNonWhitespaceLine = null,
      // The index of the last non-purely whitespace line. (Its \n)
      idxLastNonWhitespaceLineEnd = null,
      // value of idxLastNonWhitespaceLineEnd prior to its current value
      idxPrevLastNonWhitespaceLineEnd = null,
      // Our current quote depth.  0 if we're not in quoting right now.
      inQuoteDepth = 0,
      quoteRunLines = null,
      // XXX very sketchy mechanism that inhibits boilerplate detection if we
      // have ever generated a quoted block.  This seems like it absolutely
      // must be broken and the intent was for it to be some type of short-term
      // memory effect that ended up being a permanent memory effect.
      generatedQuoteBlock = false,
      atePreLines = 0, ateQuoteLines = 0;
  for (idxLineStart = 0,
         idxLineEnd = indexOfDefault(fullBodyText, '\n', idxLineStart,
                                     fullBodyText.length);
       idxLineStart < bodyLength;
       idxLineStart = idxLineEnd + 1,
         idxLineEnd = indexOfDefault(fullBodyText, '\n', idxLineStart,
                                     fullBodyText.length)) {

    line = fullBodyText.substring(idxLineStart, idxLineEnd);

    // - Do not process purely whitespace lines.
    // Because our content runs are treated as regions, ignoring whitespace
    // lines simply means that we don't start or end content blocks on blank
    // lines.  Blank lines in the middle of a content block are maintained
    // because our slice will include them.
    if (!line.length ||
        (line.length === 1
         && line.charCodeAt(0) === CHARCODE_NBSP)) {
      if (inQuoteDepth)
        pushQuote(0);
      if (idxRegionStart === null)
        atePreLines++;
      continue;
    }

    if (line.charCodeAt(0) === CHARCODE_GT) {
      var lineDepth = countQuoteDepthAndNormalize();
      // We are transitioning into a quote state...
      if (!inQuoteDepth) {
        // - Check for a "Blah wrote:" content line
        if (lastNonWhitespaceLine &&
            RE_WROTE_LINE.test(lastNonWhitespaceLine)) {

          // But surprise!  This could be a non-format-flowed message where the
          // true lead-in line started on the previous line and the "wrote" bit
          // that triggered us spills over.

          // Let's start with just the line we've got...
          // (count the newlines up to the lead-in's newline)
          var upToPoint = idxLastNonWhitespaceLineEnd;

          // Now let's see if the preceding line had content.  We can infer this
          // by whether we find a newline between the prevLast and last points.
          // No newline means there's content on that preceding line.  (There
          // could also be more content on the line(s) prior to that that flow
          // into this, but that's not particularly likely unless something is
          // going wrong with our heuristic.  At which point it's good for us
          // to mitigate the damage.)
          if (idxPrevLastNonWhitespaceLineEnd !== null) {
            var considerIndex = idxPrevLastNonWhitespaceLineEnd + 1;
            while (considerIndex < idxLastNonWhitespaceLineEnd) {
              if (fullBodyText[considerIndex++] === '\n') {
                break;
              }
            }

            if (considerIndex === idxLastNonWhitespaceLineEnd) {
              // We didn't encounter a newline.  So now we need to rewind the
              // point to be at the start of the PrevLast line.
              upToPoint =
                fullBodyText.lastIndexOf(
                  '\n', idxPrevLastNonWhitespaceLineEnd - 1);
              lastNonWhitespaceLine =
                fullBodyText.substring(upToPoint + 1,
                                       idxLastNonWhitespaceLineEnd)
                .replace(/\s*\n\s*/, ' ');
              // Note, we really should be scanning further to elide whitespace,
              // but this is largely a hack to mitigate worse-case snippet
              // generating behaviour in the face of bottom-posting where the
              // quoting lines are the first things observed.
              idxPrevLastNonWhitespaceLineEnd = upToPoint - 1;
              if (idxPrevLastNonWhitespaceLineEnd <= idxRegionStart) {
                idxRegionStart = null;
              }
            }
          }

          idxLastNonWhitespaceLineEnd = idxPrevLastNonWhitespaceLineEnd;
          // Nuke the content region if the lead-in was the start of the region;
          // this can be inferred by there being no prior content line.
          if (idxLastNonWhitespaceLineEnd === null)
            idxRegionStart = null;

          var leadin = lastNonWhitespaceLine;
          pushContent(!generatedQuoteBlock, upToPoint);
          var leadinNewlines = 0;
          if (upToPoint + 1 !== idxLineStart)
            leadinNewlines = countNewlinesInRegion(fullBodyText,
                                                   upToPoint + 1, idxLineStart);
          contentRep.push((leadinNewlines << 8) | CT_LEADIN_TO_QUOTE);
          contentRep.push(leadin);
        }
        else {
          pushContent(!generatedQuoteBlock);
        }
        quoteRunLines = [];
        inQuoteDepth = lineDepth;
      }
      // There is a change in quote depth
      else if (lineDepth !== inQuoteDepth) {
        pushQuote(lineDepth);
      }

      // Eat whitespace lines until we get a non-whitespace (quoted) line.
      if (quoteRunLines.length || line.length) {
        quoteRunLines.push(line);
      } else {
        ateQuoteLines++;
      }
    } else { // We're leaving a quoted region!
      if (inQuoteDepth) {
        pushQuote(0);
        idxLastNonWhitespaceLineEnd = null;
      }
      if (idxRegionStart === null)
        idxRegionStart = idxLineStart;

      lastNonWhitespaceLine = line;
      idxPrevLastNonWhitespaceLineEnd = idxLastNonWhitespaceLineEnd;
      idxLastNonWhitespaceLineEnd = idxLineEnd;
    }
  }
  if (inQuoteDepth) {
    pushQuote(0);
  }
  else {
    // There is no implicit newline for the final block, so force it if we had
    // a newline.
    pushContent(true, fullBodyText.length,
                (fullBodyText.charCodeAt(fullBodyText.length - 1) ===
                  CHARCODE_NEWLINE));
  }

  return contentRep;
};

/**
 * The maximum number of characters to shrink the snippet to try and find a
 * whitespace boundary.  If it would take more characters than this, we just
 * do a hard truncation and hope things work out visually.
 */
var MAX_WORD_SHRINK = 8;

var RE_NORMALIZE_WHITESPACE = /\s+/g;

/**
 * Derive the snippet for a message from its processed body representation.  We
 * take the snippet from the first non-empty content block, normalizing
 * all whitespace to a single space character for each instance, then truncate
 * with a minor attempt to align on word boundaries.
 */
exports.generateSnippet = function generateSnippet(rep, desiredLength) {
  for (var i = 0; i < rep.length; i += 2) {
    var etype = rep[i]&0xf, block = rep[i + 1];
    switch (etype) {
      case CT_AUTHORED_CONTENT:
        if (!block.length)
          break;
        // - truncate
        // (no need to truncate if short)
        if (block.length < desiredLength)
          return block.trim().replace(RE_NORMALIZE_WHITESPACE, ' ');
        // try and truncate on a whitespace boundary
        var idxPrevSpace = block.lastIndexOf(' ', desiredLength);
        if (desiredLength - idxPrevSpace < MAX_WORD_SHRINK)
          return block.substring(0, idxPrevSpace).trim()
                      .replace(RE_NORMALIZE_WHITESPACE, ' ');
        return block.substring(0, desiredLength).trim()
                    .replace(RE_NORMALIZE_WHITESPACE, ' ');
    }
  }

  return '';
};

/**
 * What is the deepest quoting level that we should repeat?  Our goal is not to be
 * the arbiter of style, but to provide a way to bound message growth in the face
 * of reply styles where humans do not manually edit quotes.
 *
 * We accept depth levels up to 5 mainly because a quick perusal of mozilla lists
 * shows cases where 5 levels of nesting were used to provide useful context.
 */
var MAX_QUOTE_REPEAT_DEPTH = 5;
// we include a few more than we need for forwarded text regeneration
var replyQuotePrefixStrings = [
  '> ', '>> ', '>>> ', '>>>> ', '>>>>> ', '>>>>>> ', '>>>>>>> ', '>>>>>>>> ',
  '>>>>>>>>> ',
];
var replyQuotePrefixStringsNoSpace = [
  '>', '>>', '>>>', '>>>>', '>>>>>', '>>>>>>', '>>>>>>>', '>>>>>>>>',
  '>>>>>>>>>',
];
var replyQuoteNewlineReplaceStrings = [
  '\n> ', '\n>> ', '\n>>> ', '\n>>>> ', '\n>>>>> ', '\n>>>>>> ', '\n>>>>>>> ',
  '\n>>>>>>>> ',
];
var replyQuoteNewlineReplaceStringsNoSpace = [
  '\n>', '\n>>', '\n>>>', '\n>>>>', '\n>>>>>', '\n>>>>>>', '\n>>>>>>>',
  '\n>>>>>>>>',
];
var replyQuoteBlankLine = [
  '\n', '>\n', '>>\n', '>>>\n', '>>>>\n', '>>>>>\n', '>>>>>>\n', '>>>>>>>\n',
  '>>>>>>>>\n',
];
var replyPrefix = '> ', replyNewlineReplace = '\n> ';

function expandQuotedPrefix(s, depth) {
  if (s.charCodeAt(0) === CHARCODE_NEWLINE)
    return replyQuotePrefixStringsNoSpace[depth];
  return replyQuotePrefixStrings[depth];
}

/**
 * Expand a quoted block so that it has the right number of greater than signs
 * and inserted whitespace where appropriate.  (Blank lines don't want
 * whitespace injected.)
 */
function expandQuoted(s, depth) {
  var ws = replyQuoteNewlineReplaceStrings[depth],
      nows = replyQuoteNewlineReplaceStringsNoSpace[depth];
  return s.replace(RE_NEWLINE, function(m, idx) {
    if (s.charCodeAt(idx+1) === CHARCODE_NEWLINE)
      return nows;
    else
      return ws;
  });
}

/**
 * Generate a text message reply given an already quote-processed body.  We do
 * not simply '>'-prefix everything because
 * 1. We don't store the raw message text because it's faster for us to not
 *    quote-process everything every time we display a message
 * 2. We want to strip some stuff out of the reply.
 * 3. It is not our goal to provide a verbatim quoting.  (However, it is our
 *    goal in the forwarding case.  Which is why forwarding makes use of the
 *    counts of newlines we ate to try and reconstruct whitespace and the
 *    message verbatim.)
 */
exports.generateReplyText = function generateReplyText(rep) {
  var strBits = [];
  // For the insertion of delimiting whitespace newlines between blocks, we want
  // to continue the quoting
  var lastContentDepth = null;
  // Lead-ins do not want delimiting newlines between them and their quoted
  // content.
  var suppressWhitespaceBlankLine = false;
  for (var i = 0; i < rep.length; i += 2) {
    var etype = rep[i]&0xf, block = rep[i + 1];
    switch (etype) {
      default:
      case CT_AUTHORED_CONTENT:
      case CT_SIGNATURE:
      case CT_LEADIN_TO_QUOTE: // (only first-level!)
        // Ignore content blocks with nothing in them.  (These may exist for
        // the benefit of the forwarding logic which wants them for whitespace
        // consistency.)
        if (block.length) {
          if (lastContentDepth !== null) {
            // Blocks lack trailing newlines, so we need to flush the newline if
            // there was a preceding one.
            strBits.push(NEWLINE);
            // Add appropriate delimiting whitespace
            if (!suppressWhitespaceBlankLine) {
              strBits.push(replyQuoteBlankLine[lastContentDepth]);
            }
          }
          strBits.push(expandQuotedPrefix(block, 0));
          strBits.push(expandQuoted(block, 0));
          lastContentDepth = 1;
          suppressWhitespaceBlankLine = (etype === CT_LEADIN_TO_QUOTE);
        }
        break;
      case CT_QUOTED_TYPE:
        var depth = ((rep[i] >> 8)&0xff) + 1;
        // If this quoting level is too deep, just pretend like it does not
        // exist.
        if (depth < MAX_QUOTE_REPEAT_DEPTH) {
          if (lastContentDepth !== null) {
            // Blocks lack trailing newlines, so we need to flush the newline if
            // there was a preceding one.
            strBits.push(NEWLINE);
            // Add appropriate delimiting whitespace
            if (!suppressWhitespaceBlankLine) {
              strBits.push(replyQuoteBlankLine[lastContentDepth]);
            }
          }
          strBits.push(expandQuotedPrefix(block, depth));
          strBits.push(expandQuoted(block, depth));
          lastContentDepth = depth;
          // Don't suppress a whitespace blank line unless we seem to include
          // a quote lead-in at the end of our block.  See the regex's content
          // block for more details on this.
          suppressWhitespaceBlankLine =
            RE_REPLY_LAST_LINE_IN_BLOCK_CONTAINS_WROTE.test(block);
        }
        break;
      // -- eat boilerplate!
      // No one needs to read boilerplate in a reply; the point is to
      // provide context, not the whole message.  (Forward the message if
      // you want the whole thing!)
      case CT_BOILERPLATE_DISCLAIMER:
      case CT_BOILERPLATE_LIST_INFO:
      case CT_BOILERPLATE_PRODUCT:
      case CT_BOILERPLATE_ADS:
        break;
    }
  }

  return strBits.join('');
};

/**
 * Regenerate the text of a message for forwarding.  'Original Message' is not
 * prepended and information about the message's header is not prepended.  That
 * is done in `generateForwardMessage`.
 *
 * We attempt to generate a message as close to the original message as
 * possible, but it doesn't have to be 100%.
 */
exports.generateForwardBodyText = function generateForwardBodyText(rep) {
  var strBits = [], nl;

  for (var i = 0; i < rep.length; i += 2) {
    if (i) {
      strBits.push(NEWLINE);
    }

    var etype = rep[i]&0xf, block = rep[i + 1];
    switch (etype) {
      // - injected with restored whitespace
      default:
      case CT_AUTHORED_CONTENT:
        // pre-newlines
        for (nl = (rep[i] >> 8)&0xff; nl; nl--) {
          strBits.push(NEWLINE);
        }
        strBits.push(block);
        // post new-lines
        for (nl = (rep[i] >> 16)&0xff; nl; nl--) {
          strBits.push(NEWLINE);
        }
        break;
      case CT_LEADIN_TO_QUOTE:
        strBits.push(block);
        for (nl = (rep[i] >> 8)&0xff; nl; nl--) {
          strBits.push(NEWLINE);
        }
        break;
      // - injected verbatim,
      case CT_SIGNATURE:
      case CT_BOILERPLATE_DISCLAIMER:
      case CT_BOILERPLATE_LIST_INFO:
      case CT_BOILERPLATE_PRODUCT:
      case CT_BOILERPLATE_ADS:
        for (nl = (rep[i] >> 8)&0xff; nl; nl--) {
          strBits.push(NEWLINE);
        }
        strBits.push(block);
        for (nl = (rep[i] >> 16)&0xff; nl; nl--) {
          strBits.push(NEWLINE);
        }
        break;
      // - quote character reconstruction
      // this is not guaranteed to round-trip since we assume the non-whitespace
      // variant...
      case CT_QUOTED_TYPE:
        var depth = Math.min((rep[i] >> 8)&0xff, 8);
        for (nl = (rep[i] >> 16)&0xff; nl; nl--) {
          strBits.push(replyQuotePrefixStringsNoSpace[depth]);
          strBits.push(NEWLINE);
        }
        strBits.push(expandQuotedPrefix(block, depth));
        strBits.push(expandQuoted(block, depth));
        for (nl = (rep[i] >> 24)&0xff; nl; nl--) {
          strBits.push(NEWLINE);
          strBits.push(replyQuotePrefixStringsNoSpace[depth]);
        }
        break;
    }
  }

  return strBits.join('');
};
}); // end define
;
/**
 * Message processing logic that deals with message representations at a higher
 * level than just text/plain processing (`quotechew.js`) or text/html
 * (`htmlchew.js`) parsing.  We are particularly concerned with replying to
 * messages and forwarding messages, and use the aforementioned libs to do the
 * gruntwork.
 *
 * For replying and forwarding, we synthesize messages so that there is always
 * a text part that is the area where the user can enter text which may be
 * followed by a read-only editable HTML block.  If replying to a text/plain
 * message, the quoted text is placed in the text area.  If replying to a
 * message with any text/html parts, we generate an HTML block for all parts.
 **/

define(
  'mailchew',[
    'exports',
    'logic',
    './util',
    './mailchew-strings',
    './quotechew',
    './htmlchew'
  ],
  function(
    exports,
    logic,
    $util,
    $mailchewStrings,
    $quotechew,
    $htmlchew
  ) {

var DESIRED_SNIPPET_LENGTH = 100;

var scope = logic.scope('MailChew');

/**
 * Generate the default compose body for a new e-mail
 * @param  {MailSenderIdentity} identity The current composer identity
 * @return {String} The text to be inserted into the body
 */
exports.generateBaseComposeBody = function generateBaseComposeBody(identity) {
  if (identity.signatureEnabled &&
      identity.signature &&
      identity.signature.length > 0) {

    var body = '\n\n-- \n' + identity.signature;
    return body;
  } else {
    return '';
  }
};


var RE_RE = /^[Rr][Ee]:/;

/**
 * Generate the reply subject for a message given the prior subject.  This is
 * simply prepending "Re: " to the message if it does not already have an
 * "Re:" equivalent.
 *
 * Note, some clients/gateways (ex: I think the google groups web client? at
 * least whatever has a user-agent of G2/1.0) will structure mailing list
 * replies so they look like "[list] Re: blah" rather than the "Re: [list] blah"
 * that Thunderbird would produce.  Thunderbird (and other clients) pretend like
 * that inner "Re:" does not exist, and so do we.
 *
 * We _always_ use the exact string "Re: " when prepending and do not localize.
 * This is done primarily for consistency with Thunderbird, but it also is
 * friendly to other e-mail applications out there.
 *
 * Thunderbird does support recognizing a
 * mail/chrome/messenger-region/region.properties property,
 * "mailnews.localizedRe" for letting locales specify other strings used by
 * clients that do attempt to localize "Re:".  Thunderbird also supports a
 * weird "Re(###):" or "Re[###]:" idiom; see
 * http://mxr.mozilla.org/comm-central/ident?i=NS_MsgStripRE for more details.
 */
exports.generateReplySubject = function generateReplySubject(origSubject) {
  var re = 'Re: ';
  if (origSubject) {
    if (RE_RE.test(origSubject))
      return origSubject;

    return re + origSubject;
  }
  return re;
};

var FWD_FWD = /^[Ff][Ww][Dd]:/;

/**
 * Generate the foward subject for a message given the prior subject.  This is
 * simply prepending "Fwd: " to the message if it does not already have an
 * "Fwd:" equivalent.
 */
exports.generateForwardSubject = function generateForwardSubject(origSubject) {
  var fwd = 'Fwd: ';
  if (origSubject) {
    if (FWD_FWD.test(origSubject))
      return origSubject;

    return fwd + origSubject;
  }
  return fwd;
};


var l10n_wroteString = '{name} wrote',
    l10n_originalMessageString = 'Original Message';

/*
 * L10n strings for forward headers.  In Thunderbird, these come from
 * mime.properties:
 * http://mxr.mozilla.org/comm-central/source/mail/locales/en-US/chrome/messenger/mime.properties
 *
 * The libmime logic that injects them is mime_insert_normal_headers:
 * http://mxr.mozilla.org/comm-central/source/mailnews/mime/src/mimedrft.cpp#791
 *
 * Our dictionary maps from the lowercased header name to the human-readable
 * string.
 *
 * XXX actually do the l10n hookup for this
 */
var l10n_forward_header_labels = {
  subject: 'Subject',
  date: 'Date',
  from: 'From',
  replyTo: 'Reply-To',
  to: 'To',
  cc: 'CC'
};

exports.setLocalizedStrings = function(strings) {
  l10n_wroteString = strings.wrote;
  l10n_originalMessageString = strings.originalMessage;

  l10n_forward_header_labels = strings.forwardHeaderLabels;
};

// Grab the localized strings, if not available, listen for the event that
// sets them.
if ($mailchewStrings.strings) {
  exports.setLocalizedStrings($mailchewStrings.strings);
}
$mailchewStrings.events.on('strings', function(strings) {
  exports.setLocalizedStrings(strings);
});

/**
 * Generate the reply body representation given info about the message we are
 * replying to.
 *
 * This does not include potentially required work such as propagating embedded
 * attachments or de-sanitizing links/embedded images/external images.
 */
exports.generateReplyBody = function generateReplyMessage(reps, authorPair,
                                                          msgDate,
                                                          identity, refGuid) {
  var useName = authorPair.name ? authorPair.name.trim() : authorPair.address;

  var textMsg = '\n\n' + l10n_wroteString.replace('{name}', useName) + ':\n',
      htmlMsg = null;

  //To render the signature before sender's original message
  if (identity.signature && identity.signatureEnabled) {
    textMsg = '\n\n-- \n' + identity.signature + '\n\n' +
                l10n_wroteString.replace('{name}', useName) + ':\n';
  }

  for (var i = 0; i < reps.length; i++) {
    var repType = reps[i].type, rep = reps[i].content;

    if (repType === 'plain') {
      var replyText = $quotechew.generateReplyText(rep);
      // If we've gone HTML, this needs to get concatenated onto the HTML.
      if (htmlMsg) {
        htmlMsg += $htmlchew.wrapTextIntoSafeHTMLString(replyText) + '\n';
      }
      // We haven't gone HTML yet, so this can all still be text.
      else {
        textMsg += replyText;
      }
    }
    else if (repType === 'html') {
      if (!htmlMsg) {
        htmlMsg = '';
        // slice off the trailing newline of textMsg
        if (textMsg.slice(-1) === '\n') {
          textMsg = textMsg.slice(0, -1);
        }
      }
      // rep has already been sanitized and therefore all HTML tags are balanced
      // and so there should be no rude surprises from this simplistic looking
      // HTML creation.  The message-id of the message never got sanitized,
      // however, so it needs to be escaped.  Also, in some cases (Activesync),
      // we won't have the message-id so we can't cite it.
      htmlMsg += '<blockquote ';
      if (refGuid) {
        htmlMsg += 'cite="mid:' + $htmlchew.escapeAttrValue(refGuid) + '" ';
      }
      htmlMsg += 'type="cite">' + rep + '</blockquote>';
    }
  }

  return {
    text: textMsg,
    html: htmlMsg
  };
};

/**
 * Generate the body of an inline forward message.  XXX we need to generate
 * the header summary which needs some localized strings.
 */
exports.generateForwardMessage =
  function(author, date, subject, headerInfo, bodyInfo, identity) {
  var textMsg = '\n\n', htmlMsg = null;

  if (identity.signature && identity.signatureEnabled)
    textMsg += '-- \n' + identity.signature + '\n\n';

  textMsg += '-------- ' + l10n_originalMessageString + ' --------\n';
  // XXX l10n! l10n! l10n!

  // Add the headers in the same order libmime adds them in
  // mime_insert_normal_headers so that any automated attempt to re-derive
  // the headers has a little bit of a chance (since the strings are
  // localized.)

  // : subject
  textMsg += l10n_forward_header_labels['subject'] + ': ' + subject + '\n';

  // We do not track or remotely care about the 'resent' headers
  // : resent-comments
  // : resent-date
  // : resent-from
  // : resent-to
  // : resent-cc
  // : date
  textMsg += l10n_forward_header_labels['date'] + ': ' + new Date(date) + '\n';
  // : from
  textMsg += l10n_forward_header_labels['from'] + ': ' +
               $util.formatAddresses([author]) + '\n';
  // : reply-to
  if (headerInfo.replyTo)
    textMsg += l10n_forward_header_labels['replyTo'] + ': ' +
                 $util.formatAddresses([headerInfo.replyTo]) + '\n';
  // : organization
  // : to
  if (headerInfo.to)
    textMsg += l10n_forward_header_labels['to'] + ': ' +
                 $util.formatAddresses(headerInfo.to) + '\n';
  // : cc
  if (headerInfo.cc)
    textMsg += l10n_forward_header_labels['cc'] + ': ' +
                 $util.formatAddresses(headerInfo.cc) + '\n';
  // (bcc should never be forwarded)
  // : newsgroups
  // : followup-to
  // : references (only for newsgroups)

  textMsg += '\n';

  var reps = bodyInfo.bodyReps;
  for (var i = 0; i < reps.length; i++) {
    var repType = reps[i].type, rep = reps[i].content;

    if (repType === 'plain') {
      var forwardText = $quotechew.generateForwardBodyText(rep);
      // If we've gone HTML, this needs to get concatenated onto the HTML.
      if (htmlMsg) {
        htmlMsg += $htmlchew.wrapTextIntoSafeHTMLString(forwardText) + '\n';
      }
      // We haven't gone HTML yet, so this can all still be text.
      else {
        textMsg += forwardText;
      }
    }
    else if (repType === 'html') {
      if (!htmlMsg) {
        htmlMsg = '';
        // slice off the trailing newline of textMsg
        if (textMsg.slice(-1) === '\n') {
          textMsg = textMsg.slice(0, -1);
        }
      }
      htmlMsg += rep;
    }
  }

  return {
    text: textMsg,
    html: htmlMsg
  };
};

var HTML_WRAP_TOP =
  '<html><body><body bgcolor="#FFFFFF" text="#000000">';
var HTML_WRAP_BOTTOM =
  '</body></html>';

/**
 * Combine the user's plaintext composition with the read-only HTML we provided
 * them into a final HTML representation.
 */
exports.mergeUserTextWithHTML = function mergeReplyTextWithHTML(text, html) {
  return HTML_WRAP_TOP +
         $htmlchew.wrapTextIntoSafeHTMLString(text, 'div') +
         html +
         HTML_WRAP_BOTTOM;
};

/**
 * Generate the snippet and parsed body from the message body's content.
 */
exports.processMessageContent = function processMessageContent(
    content, type, isDownloaded, generateSnippet) {

  // Strip any trailing newline.
  if (content.slice(-1) === '\n') {
    content = content.slice(0, -1);
  }

  var parsedContent, snippet;
  switch (type) {
    case 'plain':
      try {
        parsedContent = $quotechew.quoteProcessTextBody(content);
      }
      catch (ex) {
        logic(scope, 'textChewError', { ex: ex });
        // An empty content rep is better than nothing.
        parsedContent = [];
      }

      if (generateSnippet) {
        try {
          snippet = $quotechew.generateSnippet(
            parsedContent, DESIRED_SNIPPET_LENGTH
          );
        }
        catch (ex) {
          logic(scope, 'textSnippetError', { ex: ex });
          snippet = '';
        }
      }
      break;
    case 'html':
      if (generateSnippet) {
        try {
          snippet = $htmlchew.generateSnippet(content);
        }
        catch (ex) {
          logic(scope, 'htmlSnippetError', { ex: ex });
          snippet = '';
        }
      }
      if (isDownloaded) {
        try {
          parsedContent = $htmlchew.sanitizeAndNormalizeHtml(content);
        }
        catch (ex) {
          logic(scope, 'htmlParseError', { ex: ex });
          parsedContent = '';
        }
      }
      break;
  }

  return { content: parsedContent, snippet: snippet };
};

}); // end define
;
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
        define('addressparser',factory);
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
 * Proxies navigator.mozTCPSocket from the worker thread to the main
 * thread, as TCPSocket is not available on workers yet. This API is
 * largely compatible with the real mozTCPSocket implementation,
 * except for bufferedAmount and other buffering semantics (because we
 * can't synchronously retrieve those values).
 *
 * See worker-support/net-main.js for the main-thread counterpart.
 *
 * NOTE: There is also a whiteout-io/tcp-socket repo, which provides a
 * compatibility shim for TCPSocket on non-browser runtimes. This
 * module performs the same type of wrapping (i.e. exporting TCPSocket
 * directly) so that we don't have to modify browserbox/smtpclient to
 * expect a different socket wrapper module.
 *
 * ## Sending lots of data: flow control, Blobs ##
 *
 * mozTCPSocket provides a flow-control mechanism (the return value to
 * send indicates whether we've crossed a buffering boundary and
 * 'ondrain' tells us when all buffered data has been sent), but does
 * not yet support enqueueing Blobs for processing (which is part of
 * the proposed standard at
 * http://www.w3.org/2012/sysapps/raw-sockets/). Also, the raw-sockets
 * spec calls for generating the 'drain' event once our buffered
 * amount goes back under the internal buffer target rather than
 * waiting for it to hit zero like mozTCPSocket.
 *
 * Our main desire right now for flow-control is to avoid using a lot
 * of memory and getting killed by the OOM-killer. As such, flow
 * control is not important to us if we're just sending something that
 * we're already keeping in memory. The things that will kill us are
 * giant things like attachments (or message bodies we are
 * quoting/repeating, potentially) that we are keeping as Blobs.
 *
 * As such, rather than echoing the flow-control mechanisms over to
 * this worker context, we just allow ourselves to write() a Blob and
 * have the net-main.js side take care of streaming the Blobs over the
 * network.
 *
 * Note that successfully sending a lot of data may entail holding a
 * wake-lock to avoid having the network device we are using turned
 * off in the middle of our sending. The network-connection
 * abstraction is not currently directly involved with the wake-lock
 * management, but I could see it needing to beef up its error
 * inference in terms of timeouts/detecting disconnections so we can
 * avoid grabbing a wi-fi wake-lock, having our connection quietly
 * die, and then we keep holding the wi-fi wake-lock for much longer
 * than we should.
 */
define('tcp-socket',['require','exports','module','worker-router','disaster-recovery'],function(require, exports, module) {

  var router = require('worker-router');
  var routerMaker = router.registerInstanceType('netsocket');
  var DisasterRecovery = require('disaster-recovery');

  function TCPSocketProxy(host, port, options) {
    options = options || {};
    options.binaryType = 'arraybuffer';

    // Supported TCPSocket attributes:
    this.host = host;
    this.port = port;
    this.ssl = !!options.useSecureTransport;
    this.binaryType = options.binaryType;
    this.bufferedAmount = 0; // This is fake.
    this.readyState = 'connecting';

    // Event handlers:
    var routerInfo = routerMaker.register(function(data) {
      var eventHandlerName = data.cmd;
      var internalHandler = this['_' + eventHandlerName];
      var externalHandler = this[eventHandlerName];
      // Allow this class to update internal state first:
      internalHandler && internalHandler.call(this, data.args);
      // Then, emulate the real TCP socket events (vaguely):
      DisasterRecovery.catchSocketExceptions(this, function() {
        externalHandler && externalHandler.call(this, { data: data.args });
      });
    }.bind(this));

    this._sendMessage = routerInfo.sendMessage;
    this._unregisterWithRouter = routerInfo.unregister;

    this._sendMessage('open', [host, port, options]);
  }

  TCPSocketProxy.prototype = {
    _onopen: function() {
      this.readyState = 'open';
    },

    _onclose: function() {
      this._unregisterWithRouter();
      this.readyState = 'closed';
    },

    upgradeToSecure: function() {
      this._sendMessage('upgradeToSecure', []);
    },

    suspend: function() {
      throw new Error('tcp-socket.js does not support suspend().');
    },

    resume: function() {
      throw new Error('tcp-socket.js does not support resume().');
    },

    close: function() {
      if (this.readyState !== 'closed') {
        this._sendMessage('close');
      }
    },

    // We do not use transferrables by default; historically we
    // wrapped a NodeJS-style API whose semantics did not take
    // ownership. However, there is an optimization we want to perform
    // related to Uint8Array.subarray().
    //
    // All the subarray does is create a view on the underlying
    // buffer. This is important and notable because the structured
    // clone implementation for typed arrays and array buffers is
    // *not* clever; it just serializes the entire underlying buffer
    // and the typed array as a view on that. (This does have the
    // upside that you can transfer a whole bunch of typed arrays and
    // only one copy of the buffer.) The good news is that
    // ArrayBuffer.slice() does create an entirely new copy of the
    // buffer, so that works with our semantics and we can use that to
    // transfer only what needs to be transferred.
    send: function(u8array) {
      if (u8array instanceof Blob) {
        // We always send blobs in their entirety; you should slice the blob and
        // give us that if that's what you want.
        this._sendMessage('write', [u8array]);
      }
      else if (u8array instanceof ArrayBuffer) {
        this._sendMessage('write', [u8array, 0, u8array.byteLength]);
      }
      // Slice the underlying buffer and transfer it if the array is a subarray
      else if (u8array.byteOffset !== 0 ||
          u8array.length !== u8array.buffer.byteLength) {
        var buf = u8array.buffer.slice(u8array.byteOffset,
                                       u8array.byteOffset + u8array.length);
        this._sendMessage('write',
                          [buf, 0, buf.byteLength],
                          [buf]);
      }
      else {
        this._sendMessage('write',
                          [u8array.buffer, u8array.byteOffset, u8array.length]);
      }

      return true;
    }
  };


  return {
    open: function(host, port, options) {
      return new TCPSocketProxy(host, port, options);
    }
  };
});

/*global define*/
define('mix',[],function() {
  /**
   * Mixes properties from source into target.
   * @param  {Object} target   target of the mix.
   * @param  {Object} source   source object providing properties to mix in.
   * @param  {Boolean} override if target already has a the property,
   * override it with the one from source.
   * @return {Object}          the target object, now with the new properties
   * mixed in.
   */
  return function mix(target, source, override) {
    Object.keys(source).forEach(function(key) {
      if (!target.hasOwnProperty(key) || override)
        target[key] = source[key];
    });
    return target;
  };
});

/**
 * Shim for 'axe-logger' as required by the email.js libs.
 */
define('axe-logger',[],function() {
  // For now, silence debug/log, and forward warn/error to the
  // console just in case.
  return {
    debug: function() { /* shh */ },
    log: function() { /* shh */ },
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };
});

/**
 * Alternate-named shim for 'axe-logger', referenced in third-party
 * dependencies. This could alternately just be included within our
 * RequireJS configuration.
 */
define('axe',['axe-logger'], function(axe) {
  return axe;
});

define('errorutils',['exports'], function(exports) {

  /**
   * Helpers to deal with our normalized error strings. Provides
   * metadata such as whether we should retry or report errors given
   * an error string.
   *
   * For a full description of each of these errors and why they might
   * be raised, see `mailapi.js`.
   */

  var ALL_ERRORS = {

    // Transient Errors
    'offline': { reachable: false, retry: true, report: false },
    'server-maintenance': { reachable: true, retry: true, report: false },
    'unresponsive-server': { reachable: false, retry: true, report: false },
    'port-not-listening': { reachable: false, retry: true, report: false },

    // Permanent Account Errors (user intervention required)
    'bad-user-or-pass': { reachable: true, retry: false, report: true },
    'needs-oauth-reauth': { reachable: true, retry: false, report: true },
    'imap-disabled': { reachable: true, retry: false, report: true },
    'pop3-disabled': { reachable: true, retry: false, report: true },
    'not-authorized': { reachable: true, retry: false, report: true },

    // Account Configuration Errors
    'bad-security': { reachable: true, retry: false, report: true },
    'no-config-info': { reachable: false, retry: false, report: false },
    'user-account-exists': { reachable: false, retry: false, report: false },
    'pop-server-not-great': { reachable: true, retry: false, report: false },
    'no-dns-entry': { reachable: false, retry: false, report: false },

    // Action-Specific Errors
    'bad-address': { reachable: true, retry: false, report: false },
    'server-problem': { reachable: true, retry: false, report: false },
    'unknown': { reachable: false, retry: false, report: false }

  };

  /**
   * Should we surface the error to the user so that they can take
   * action? Permanent connection problems and credential errors
   * require user intervention.
   *
   * @param {String} err
   *   A normalized error string.
   * @return {Boolean}
   */
  exports.shouldReportProblem = function(err) {
    return (ALL_ERRORS[err] || ALL_ERRORS['unknown']).report;
  };

  /**
   * Should we retry the operation using backoff? Only for errors that
   * will likely resolve themselves automatically, such as network
   * problems and server maintenance.
   *
   * @param {String} err
   *   A normalized error string.
   * @return {Boolean}
   */
  exports.shouldRetry = function(err) {
    return (ALL_ERRORS[err] || ALL_ERRORS['unknown']).retry;
  };

  /**
   * Did this error occur when the server was reachable?
   */
  exports.wasErrorFromReachableState = function(err) {
    return (ALL_ERRORS[err] || ALL_ERRORS['unknown']).reachable;
  };

  /**
   * Analyze an error object (specifically, an exception or an
   * exception-like object) and attempt to find a matching normalized
   * string error code. Returns null if none matched, for easy
   * cascading with more specific error types.
   *
   * @param {String} err
   *   A normalized error string.
   * @return {String|null}
   */
  exports.analyzeException = function(err) {
    // XXX: Fault-injecting-socket returns the string "Connection
    // refused" for certian socket errors. (Does mozTCPSocket raise
    // that error verbatim?) Convert that to an Error-like object.
    if (err === 'Connection refused') {
      err = { name: 'ConnectionRefusedError' };
    }
    // Otherwise, assume a plain-old string is already normalized.
    else if (typeof err === 'string') {
      return err;
    }

    if (!err.name) {
      return null;
    }

    if (/^Security/.test(err.name)) {
      return 'bad-security';
    }
    else if (/^ConnectionRefused/i.test(err.name)) {
      return 'unresponsive-server';
    }
    else {
      return null;
    }
  }

});

define('db/folder_info_rep',['require'],function(require) {



/**
 *
 * @typedef {Object} FolderMeta
 *
 * @property {string} id - ID assigned to the folder by the backend.
 *
 * @property {string} serverId - Optional. For ActiveSync folders, the
 * server-issued id for the folder that we use to reference the folder.
 *
 * @property {string} name - The human-readable name of the folder with all utf-7
 * decoding/etc performed. This is intended to be shown to the user,
 * the path should not be. Folder names should be considered
 * private/personal data and if logged should be marked to be
 * sanitized unless the user has explicitly enabled super-verbose
 * privacy-entraining logs.
 *
 * @property {string} type - The type of the folder, i.e. 'inbox' or 'drafts'.
 * Refer to mailapi.js for a list of acceptable values.
 *
 * @property {string} path - The fully qualified path of the folder.
 * For IMAP servers, this is the raw path including utf-7 encoded parts.
 * For ActiveSync and POP3 this is just for super-verbose private-data-entraining
 * debugging and testing.
 * This should be considered private/personal data like the folder name.
 *
 * @property {number} depth - The depth of the folder in the folder tree.
 * This is useful since the folders are stored as a flattened list, so
 * attempts to display the folder hierarchy would otherwise have to compute
 * this themsevles.
 *
 * @property {DateMS} lastSyncedAt - The last time the folder was synced.
 *
 * @property {number} unreadCount - The total number of locally stored unread
 * messages in the folder.
 *
 * @property {string} syncKey - ActiveSync-only per-folder synchronization key.
 */


function makeFolderMeta(raw) {
  return {
    id: raw.id || null,
    serverId: raw.serverId || null,
    name: raw.name || null,
    type: raw.type || null,
    path: raw.path || null,
    parentId: raw.parentId || null,
    depth: raw.depth || 0,
    lastSyncedAt: raw.lastSyncedAt || 0,
    unreadCount: raw.unreadCount || 0,
    syncKey: raw.syncKey || null,
    version: raw.version || null
  }
};

return {
	makeFolderMeta: makeFolderMeta
}

}); // end define
;
// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

(function(root, factory) {
    
    if (typeof define === 'function' && define.amd) {
        define('mimetypes',factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.mimetypes = factory();
    }
}(this, function() {
    

    /**
     * Returns file extension for a content type string. If no suitable extensions
     * are found, 'bin' is used as the default extension
     *
     * @param {String} mimeType Content type to be checked for
     * @return {String} File extension
     */
    function detectExtension(mimeType) {
        mimeType = (mimeType || '').toString().toLowerCase().replace(/\s/g, '');
        if (!(mimeType in mimetypesList)) {
            return 'bin';
        }

        if (typeof mimetypesList[mimeType] === 'string') {
            return mimetypesList[mimeType];
        }

        var mimeParts = mimeType.split('/');

        // search for name match
        for (var i = 0, len = mimetypesList[mimeType].length; i < len; i++) {
            if (mimeParts[1] === mimetypesList[mimeType][i]) {
                return mimetypesList[mimeType][i];
            }
        }

        // use the first one
        return mimetypesList[mimeType][0];
    }

    /**
     * Returns content type for a file extension. If no suitable content types
     * are found, 'application/octet-stream' is used as the default content type
     *
     * @param {String} extension Extension to be checked for
     * @return {String} File extension
     */
    function detectMimeType(extension) {
        extension = (extension || '').toString().toLowerCase().replace(/\s/g, '').replace(/^\./g, '');

        if (!(extension in mimetypesExtensions)) {
            return 'application/octet-stream';
        }

        if (typeof mimetypesExtensions[extension] === 'string') {
            return mimetypesExtensions[extension];
        }

        var mimeParts;

        // search for name match
        for (var i = 0, len = mimetypesExtensions[extension].length; i < len; i++) {
            mimeParts = mimetypesExtensions[extension][i].split('/');
            if (mimeParts[1] === extension) {
                return mimetypesExtensions[extension][i];
            }
        }

        // use the first one
        return mimetypesExtensions[extension][0];
    }

    var mimetypesList = {
        'application/acad': 'dwg',
        'application/andrew-inset': '',
        'application/applixware': 'aw',
        'application/arj': 'arj',
        'application/atom+xml': 'xml',
        'application/atomcat+xml': 'atomcat',
        'application/atomsvc+xml': 'atomsvc',
        'application/base64': ['mm', 'mme'],
        'application/binhex': 'hqx',
        'application/binhex4': 'hqx',
        'application/book': ['boo', 'book'],
        'application/ccxml+xml,': 'ccxml',
        'application/cdf': 'cdf',
        'application/cdmi-capability': 'cdmia',
        'application/cdmi-container': 'cdmic',
        'application/cdmi-domain': 'cdmid',
        'application/cdmi-object': 'cdmio',
        'application/cdmi-queue': 'cdmiq',
        'application/clariscad': 'ccad',
        'application/commonground': 'dp',
        'application/cu-seeme': 'cu',
        'application/davmount+xml': 'davmount',
        'application/drafting': 'drw',
        'application/dsptype': 'tsp',
        'application/dssc+der': 'dssc',
        'application/dssc+xml': 'xdssc',
        'application/dxf': 'dxf',
        'application/ecmascript': ['js', 'es'],
        'application/emma+xml': 'emma',
        'application/envoy': 'evy',
        'application/epub+zip': 'epub',
        'application/excel': ['xl', 'xla', 'xlb', 'xlc', 'xld', 'xlk', 'xll', 'xlm', 'xls', 'xlt', 'xlv', 'xlw'],
        'application/exi': 'exi',
        'application/font-tdpfr': 'pfr',
        'application/fractals': 'fif',
        'application/freeloader': 'frl',
        'application/futuresplash': 'spl',
        'application/gnutar': 'tgz',
        'application/groupwise': 'vew',
        'application/hlp': 'hlp',
        'application/hta': 'hta',
        'application/hyperstudio': 'stk',
        'application/i-deas': 'unv',
        'application/iges': ['iges', 'igs'],
        'application/inf': 'inf',
        'application/internet-property-stream': 'acx',
        'application/ipfix': 'ipfix',
        'application/java': 'class',
        'application/java-archive': 'jar',
        'application/java-byte-code': 'class',
        'application/java-serialized-object': 'ser',
        'application/java-vm': 'class',
        'application/javascript': 'js',
        'application/json': 'json',
        'application/lha': 'lha',
        'application/lzx': 'lzx',
        'application/mac-binary': 'bin',
        'application/mac-binhex': 'hqx',
        'application/mac-binhex40': 'hqx',
        'application/mac-compactpro': 'cpt',
        'application/macbinary': 'bin',
        'application/mads+xml': 'mads',
        'application/marc': 'mrc',
        'application/marcxml+xml': 'mrcx',
        'application/mathematica': 'ma',
        'application/mathml+xml': 'mathml',
        'application/mbedlet': 'mbd',
        'application/mbox': 'mbox',
        'application/mcad': 'mcd',
        'application/mediaservercontrol+xml': 'mscml',
        'application/metalink4+xml': 'meta4',
        'application/mets+xml': 'mets',
        'application/mime': 'aps',
        'application/mods+xml': 'mods',
        'application/mp21': 'm21',
        'application/mp4': 'mp4',
        'application/mspowerpoint': ['pot', 'pps', 'ppt', 'ppz'],
        'application/msword': ['doc', 'dot', 'w6w', 'wiz', 'word'],
        'application/mswrite': 'wri',
        'application/mxf': 'mxf',
        'application/netmc': 'mcp',
        'application/octet-stream': ['*'],
        'application/oda': 'oda',
        'application/oebps-package+xml': 'opf',
        'application/ogg': 'ogx',
        'application/olescript': 'axs',
        'application/onenote': 'onetoc',
        'application/patch-ops-error+xml': 'xer',
        'application/pdf': 'pdf',
        'application/pgp-encrypted': '',
        'application/pgp-signature': 'pgp',
        'application/pics-rules': 'prf',
        'application/pkcs-12': 'p12',
        'application/pkcs-crl': 'crl',
        'application/pkcs10': 'p10',
        'application/pkcs7-mime': ['p7c', 'p7m'],
        'application/pkcs7-signature': 'p7s',
        'application/pkcs8': 'p8',
        'application/pkix-attr-cert': 'ac',
        'application/pkix-cert': ['cer', 'crt'],
        'application/pkix-crl': 'crl',
        'application/pkix-pkipath': 'pkipath',
        'application/pkixcmp': 'pki',
        'application/plain': 'text',
        'application/pls+xml': 'pls',
        'application/postscript': ['ai', 'eps', 'ps'],
        'application/powerpoint': 'ppt',
        'application/pro_eng': ['part', 'prt'],
        'application/prs.cww': 'cww',
        'application/pskc+xml': 'pskcxml',
        'application/rdf+xml': 'rdf',
        'application/reginfo+xml': 'rif',
        'application/relax-ng-compact-syntax': 'rnc',
        'application/resource-lists+xml': 'rl',
        'application/resource-lists-diff+xml': 'rld',
        'application/ringing-tones': 'rng',
        'application/rls-services+xml': 'rs',
        'application/rsd+xml': 'rsd',
        'application/rss+xml': 'xml',
        'application/rtf': ['rtf', 'rtx'],
        'application/sbml+xml': 'sbml',
        'application/scvp-cv-request': 'scq',
        'application/scvp-cv-response': 'scs',
        'application/scvp-vp-request': 'spq',
        'application/scvp-vp-response': 'spp',
        'application/sdp': 'sdp',
        'application/sea': 'sea',
        'application/set': 'set',
        'application/set-payment-initiation': 'setpay',
        'application/set-registration-initiation': 'setreg',
        'application/shf+xml': 'shf',
        'application/sla': 'stl',
        'application/smil': ['smi', 'smil'],
        'application/smil+xml': 'smi',
        'application/solids': 'sol',
        'application/sounder': 'sdr',
        'application/sparql-query': 'rq',
        'application/sparql-results+xml': 'srx',
        'application/srgs': 'gram',
        'application/srgs+xml': 'grxml',
        'application/sru+xml': 'sru',
        'application/ssml+xml': 'ssml',
        'application/step': ['step', 'stp'],
        'application/streamingmedia': 'ssm',
        'application/tei+xml': 'tei',
        'application/thraud+xml': 'tfi',
        'application/timestamped-data': 'tsd',
        'application/toolbook': 'tbk',
        'application/vda': 'vda',
        'application/vnd.3gpp.pic-bw-large': 'plb',
        'application/vnd.3gpp.pic-bw-small': 'psb',
        'application/vnd.3gpp.pic-bw-var': 'pvb',
        'application/vnd.3gpp2.tcap': 'tcap',
        'application/vnd.3m.post-it-notes': 'pwn',
        'application/vnd.accpac.simply.aso': 'aso',
        'application/vnd.accpac.simply.imp': 'imp',
        'application/vnd.acucobol': 'acu',
        'application/vnd.acucorp': 'atc',
        'application/vnd.adobe.air-application-installer-package+zip': 'air',
        'application/vnd.adobe.fxp': 'fxp',
        'application/vnd.adobe.xdp+xml': 'xdp',
        'application/vnd.adobe.xfdf': 'xfdf',
        'application/vnd.ahead.space': 'ahead',
        'application/vnd.airzip.filesecure.azf': 'azf',
        'application/vnd.airzip.filesecure.azs': 'azs',
        'application/vnd.amazon.ebook': 'azw',
        'application/vnd.americandynamics.acc': 'acc',
        'application/vnd.amiga.ami': 'ami',
        'application/vnd.android.package-archive': 'apk',
        'application/vnd.anser-web-certificate-issue-initiation': 'cii',
        'application/vnd.anser-web-funds-transfer-initiation': 'fti',
        'application/vnd.antix.game-component': 'atx',
        'application/vnd.apple.installer+xml': 'mpkg',
        'application/vnd.apple.mpegurl': 'm3u8',
        'application/vnd.aristanetworks.swi': 'swi',
        'application/vnd.audiograph': 'aep',
        'application/vnd.blueice.multipass': 'mpm',
        'application/vnd.bmi': 'bmi',
        'application/vnd.businessobjects': 'rep',
        'application/vnd.chemdraw+xml': 'cdxml',
        'application/vnd.chipnuts.karaoke-mmd': 'mmd',
        'application/vnd.cinderella': 'cdy',
        'application/vnd.claymore': 'cla',
        'application/vnd.cloanto.rp9': 'rp9',
        'application/vnd.clonk.c4group': 'c4g',
        'application/vnd.cluetrust.cartomobile-config': 'c11amc',
        'application/vnd.cluetrust.cartomobile-config-pkg': 'c11amz',
        'application/vnd.commonspace': 'csp',
        'application/vnd.contact.cmsg': 'cdbcmsg',
        'application/vnd.cosmocaller': 'cmc',
        'application/vnd.crick.clicker': 'clkx',
        'application/vnd.crick.clicker.keyboard': 'clkk',
        'application/vnd.crick.clicker.palette': 'clkp',
        'application/vnd.crick.clicker.template': 'clkt',
        'application/vnd.crick.clicker.wordbank': 'clkw',
        'application/vnd.criticaltools.wbs+xml': 'wbs',
        'application/vnd.ctc-posml': 'pml',
        'application/vnd.cups-ppd': 'ppd',
        'application/vnd.curl.car': 'car',
        'application/vnd.curl.pcurl': 'pcurl',
        'application/vnd.data-vision.rdz': 'rdz',
        'application/vnd.denovo.fcselayout-link': 'fe_launch',
        'application/vnd.dna': 'dna',
        'application/vnd.dolby.mlp': 'mlp',
        'application/vnd.dpgraph': 'dpg',
        'application/vnd.dreamfactory': 'dfac',
        'application/vnd.dvb.ait': 'ait',
        'application/vnd.dvb.service': 'svc',
        'application/vnd.dynageo': 'geo',
        'application/vnd.ecowin.chart': 'mag',
        'application/vnd.enliven': 'nml',
        'application/vnd.epson.esf': 'esf',
        'application/vnd.epson.msf': 'msf',
        'application/vnd.epson.quickanime': 'qam',
        'application/vnd.epson.salt': 'slt',
        'application/vnd.epson.ssf': 'ssf',
        'application/vnd.eszigno3+xml': 'es3',
        'application/vnd.ezpix-album': 'ez2',
        'application/vnd.ezpix-package': 'ez3',
        'application/vnd.fdf': 'fdf',
        'application/vnd.fdsn.seed': 'seed',
        'application/vnd.flographit': 'gph',
        'application/vnd.fluxtime.clip': 'ftc',
        'application/vnd.framemaker': 'fm',
        'application/vnd.frogans.fnc': 'fnc',
        'application/vnd.frogans.ltf': 'ltf',
        'application/vnd.fsc.weblaunch': 'fsc',
        'application/vnd.fujitsu.oasys': 'oas',
        'application/vnd.fujitsu.oasys2': 'oa2',
        'application/vnd.fujitsu.oasys3': 'oa3',
        'application/vnd.fujitsu.oasysgp': 'fg5',
        'application/vnd.fujitsu.oasysprs': 'bh2',
        'application/vnd.fujixerox.ddd': 'ddd',
        'application/vnd.fujixerox.docuworks': 'xdw',
        'application/vnd.fujixerox.docuworks.binder': 'xbd',
        'application/vnd.fuzzysheet': 'fzs',
        'application/vnd.genomatix.tuxedo': 'txd',
        'application/vnd.geogebra.file': 'ggb',
        'application/vnd.geogebra.tool': 'ggt',
        'application/vnd.geometry-explorer': 'gex',
        'application/vnd.geonext': 'gxt',
        'application/vnd.geoplan': 'g2w',
        'application/vnd.geospace': 'g3w',
        'application/vnd.gmx': 'gmx',
        'application/vnd.google-earth.kml+xml': 'kml',
        'application/vnd.google-earth.kmz': 'kmz',
        'application/vnd.grafeq': 'gqf',
        'application/vnd.groove-account': 'gac',
        'application/vnd.groove-help': 'ghf',
        'application/vnd.groove-identity-message': 'gim',
        'application/vnd.groove-injector': 'grv',
        'application/vnd.groove-tool-message': 'gtm',
        'application/vnd.groove-tool-template': 'tpl',
        'application/vnd.groove-vcard': 'vcg',
        'application/vnd.hal+xml': 'hal',
        'application/vnd.handheld-entertainment+xml': 'zmm',
        'application/vnd.hbci': 'hbci',
        'application/vnd.hhe.lesson-player': 'les',
        'application/vnd.hp-hpgl': ['hgl', 'hpg', 'hpgl'],
        'application/vnd.hp-hpid': 'hpid',
        'application/vnd.hp-hps': 'hps',
        'application/vnd.hp-jlyt': 'jlt',
        'application/vnd.hp-pcl': 'pcl',
        'application/vnd.hp-pclxl': 'pclxl',
        'application/vnd.hydrostatix.sof-data': 'sfd-hdstx',
        'application/vnd.hzn-3d-crossword': 'x3d',
        'application/vnd.ibm.minipay': 'mpy',
        'application/vnd.ibm.modcap': 'afp',
        'application/vnd.ibm.rights-management': 'irm',
        'application/vnd.ibm.secure-container': 'sc',
        'application/vnd.iccprofile': 'icc',
        'application/vnd.igloader': 'igl',
        'application/vnd.immervision-ivp': 'ivp',
        'application/vnd.immervision-ivu': 'ivu',
        'application/vnd.insors.igm': 'igm',
        'application/vnd.intercon.formnet': 'xpw',
        'application/vnd.intergeo': 'i2g',
        'application/vnd.intu.qbo': 'qbo',
        'application/vnd.intu.qfx': 'qfx',
        'application/vnd.ipunplugged.rcprofile': 'rcprofile',
        'application/vnd.irepository.package+xml': 'irp',
        'application/vnd.is-xpr': 'xpr',
        'application/vnd.isac.fcs': 'fcs',
        'application/vnd.jam': 'jam',
        'application/vnd.jcp.javame.midlet-rms': 'rms',
        'application/vnd.jisp': 'jisp',
        'application/vnd.joost.joda-archive': 'joda',
        'application/vnd.kahootz': 'ktz',
        'application/vnd.kde.karbon': 'karbon',
        'application/vnd.kde.kchart': 'chrt',
        'application/vnd.kde.kformula': 'kfo',
        'application/vnd.kde.kivio': 'flw',
        'application/vnd.kde.kontour': 'kon',
        'application/vnd.kde.kpresenter': 'kpr',
        'application/vnd.kde.kspread': 'ksp',
        'application/vnd.kde.kword': 'kwd',
        'application/vnd.kenameaapp': 'htke',
        'application/vnd.kidspiration': 'kia',
        'application/vnd.kinar': 'kne',
        'application/vnd.koan': 'skp',
        'application/vnd.kodak-descriptor': 'sse',
        'application/vnd.las.las+xml': 'lasxml',
        'application/vnd.llamagraphics.life-balance.desktop': 'lbd',
        'application/vnd.llamagraphics.life-balance.exchange+xml': 'lbe',
        'application/vnd.lotus-1-2-3': '123',
        'application/vnd.lotus-approach': 'apr',
        'application/vnd.lotus-freelance': 'pre',
        'application/vnd.lotus-notes': 'nsf',
        'application/vnd.lotus-organizer': 'org',
        'application/vnd.lotus-screencam': 'scm',
        'application/vnd.lotus-wordpro': 'lwp',
        'application/vnd.macports.portpkg': 'portpkg',
        'application/vnd.mcd': 'mcd',
        'application/vnd.medcalcdata': 'mc1',
        'application/vnd.mediastation.cdkey': 'cdkey',
        'application/vnd.mfer': 'mwf',
        'application/vnd.mfmp': 'mfm',
        'application/vnd.micrografx.flo': 'flo',
        'application/vnd.micrografx.igx': 'igx',
        'application/vnd.mif': 'mif',
        'application/vnd.mobius.daf': 'daf',
        'application/vnd.mobius.dis': 'dis',
        'application/vnd.mobius.mbk': 'mbk',
        'application/vnd.mobius.mqy': 'mqy',
        'application/vnd.mobius.msl': 'msl',
        'application/vnd.mobius.plc': 'plc',
        'application/vnd.mobius.txf': 'txf',
        'application/vnd.mophun.application': 'mpn',
        'application/vnd.mophun.certificate': 'mpc',
        'application/vnd.mozilla.xul+xml': 'xul',
        'application/vnd.ms-artgalry': 'cil',
        'application/vnd.ms-cab-compressed': 'cab',
        'application/vnd.ms-excel': ['xla', 'xlc', 'xlm', 'xls', 'xlt', 'xlw', 'xlb', 'xll'],
        'application/vnd.ms-excel.addin.macroenabled.12': 'xlam',
        'application/vnd.ms-excel.sheet.binary.macroenabled.12': 'xlsb',
        'application/vnd.ms-excel.sheet.macroenabled.12': 'xlsm',
        'application/vnd.ms-excel.template.macroenabled.12': 'xltm',
        'application/vnd.ms-fontobject': 'eot',
        'application/vnd.ms-htmlhelp': 'chm',
        'application/vnd.ms-ims': 'ims',
        'application/vnd.ms-lrm': 'lrm',
        'application/vnd.ms-officetheme': 'thmx',
        'application/vnd.ms-outlook': 'msg',
        'application/vnd.ms-pki.certstore': 'sst',
        'application/vnd.ms-pki.pko': 'pko',
        'application/vnd.ms-pki.seccat': 'cat',
        'application/vnd.ms-pki.stl': 'stl',
        'application/vnd.ms-pkicertstore': 'sst',
        'application/vnd.ms-pkiseccat': 'cat',
        'application/vnd.ms-pkistl': 'stl',
        'application/vnd.ms-powerpoint': ['pot', 'pps', 'ppt', 'ppa', 'pwz'],
        'application/vnd.ms-powerpoint.addin.macroenabled.12': 'ppam',
        'application/vnd.ms-powerpoint.presentation.macroenabled.12': 'pptm',
        'application/vnd.ms-powerpoint.slide.macroenabled.12': 'sldm',
        'application/vnd.ms-powerpoint.slideshow.macroenabled.12': 'ppsm',
        'application/vnd.ms-powerpoint.template.macroenabled.12': 'potm',
        'application/vnd.ms-project': 'mpp',
        'application/vnd.ms-word.document.macroenabled.12': 'docm',
        'application/vnd.ms-word.template.macroenabled.12': 'dotm',
        'application/vnd.ms-works': ['wcm', 'wdb', 'wks', 'wps'],
        'application/vnd.ms-wpl': 'wpl',
        'application/vnd.ms-xpsdocument': 'xps',
        'application/vnd.mseq': 'mseq',
        'application/vnd.musician': 'mus',
        'application/vnd.muvee.style': 'msty',
        'application/vnd.neurolanguage.nlu': 'nlu',
        'application/vnd.noblenet-directory': 'nnd',
        'application/vnd.noblenet-sealer': 'nns',
        'application/vnd.noblenet-web': 'nnw',
        'application/vnd.nokia.configuration-message': 'ncm',
        'application/vnd.nokia.n-gage.data': 'ngdat',
        'application/vnd.nokia.n-gage.symbian.install': 'n-gage',
        'application/vnd.nokia.radio-preset': 'rpst',
        'application/vnd.nokia.radio-presets': 'rpss',
        'application/vnd.nokia.ringing-tone': 'rng',
        'application/vnd.novadigm.edm': 'edm',
        'application/vnd.novadigm.edx': 'edx',
        'application/vnd.novadigm.ext': 'ext',
        'application/vnd.oasis.opendocument.chart': 'odc',
        'application/vnd.oasis.opendocument.chart-template': 'otc',
        'application/vnd.oasis.opendocument.database': 'odb',
        'application/vnd.oasis.opendocument.formula': 'odf',
        'application/vnd.oasis.opendocument.formula-template': 'odft',
        'application/vnd.oasis.opendocument.graphics': 'odg',
        'application/vnd.oasis.opendocument.graphics-template': 'otg',
        'application/vnd.oasis.opendocument.image': 'odi',
        'application/vnd.oasis.opendocument.image-template': 'oti',
        'application/vnd.oasis.opendocument.presentation': 'odp',
        'application/vnd.oasis.opendocument.presentation-template': 'otp',
        'application/vnd.oasis.opendocument.spreadsheet': 'ods',
        'application/vnd.oasis.opendocument.spreadsheet-template': 'ots',
        'application/vnd.oasis.opendocument.text': 'odt',
        'application/vnd.oasis.opendocument.text-master': 'odm',
        'application/vnd.oasis.opendocument.text-template': 'ott',
        'application/vnd.oasis.opendocument.text-web': 'oth',
        'application/vnd.olpc-sugar': 'xo',
        'application/vnd.oma.dd2+xml': 'dd2',
        'application/vnd.openofficeorg.extension': 'oxt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.slide': 'sldx',
        'application/vnd.openxmlformats-officedocument.presentationml.slideshow': 'ppsx',
        'application/vnd.openxmlformats-officedocument.presentationml.template': 'potx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.template': 'xltx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.template': 'dotx',
        'application/vnd.osgeo.mapguide.package': 'mgp',
        'application/vnd.osgi.dp': 'dp',
        'application/vnd.palm': 'pdb',
        'application/vnd.pawaafile': 'paw',
        'application/vnd.pg.format': 'str',
        'application/vnd.pg.osasli': 'ei6',
        'application/vnd.picsel': 'efif',
        'application/vnd.pmi.widget': 'wg',
        'application/vnd.pocketlearn': 'plf',
        'application/vnd.powerbuilder6': 'pbd',
        'application/vnd.previewsystems.box': 'box',
        'application/vnd.proteus.magazine': 'mgz',
        'application/vnd.publishare-delta-tree': 'qps',
        'application/vnd.pvi.ptid1': 'ptid',
        'application/vnd.quark.quarkxpress': 'qxd',
        'application/vnd.realvnc.bed': 'bed',
        'application/vnd.recordare.musicxml': 'mxl',
        'application/vnd.recordare.musicxml+xml': 'musicxml',
        'application/vnd.rig.cryptonote': 'cryptonote',
        'application/vnd.rim.cod': 'cod',
        'application/vnd.rn-realmedia': 'rm',
        'application/vnd.rn-realplayer': 'rnx',
        'application/vnd.route66.link66+xml': 'link66',
        'application/vnd.sailingtracker.track': 'st',
        'application/vnd.seemail': 'see',
        'application/vnd.sema': 'sema',
        'application/vnd.semd': 'semd',
        'application/vnd.semf': 'semf',
        'application/vnd.shana.informed.formdata': 'ifm',
        'application/vnd.shana.informed.formtemplate': 'itp',
        'application/vnd.shana.informed.interchange': 'iif',
        'application/vnd.shana.informed.package': 'ipk',
        'application/vnd.simtech-mindmapper': 'twd',
        'application/vnd.smaf': 'mmf',
        'application/vnd.smart.teacher': 'teacher',
        'application/vnd.solent.sdkm+xml': 'sdkm',
        'application/vnd.spotfire.dxp': 'dxp',
        'application/vnd.spotfire.sfs': 'sfs',
        'application/vnd.stardivision.calc': 'sdc',
        'application/vnd.stardivision.draw': 'sda',
        'application/vnd.stardivision.impress': 'sdd',
        'application/vnd.stardivision.math': 'smf',
        'application/vnd.stardivision.writer': 'sdw',
        'application/vnd.stardivision.writer-global': 'sgl',
        'application/vnd.stepmania.stepchart': 'sm',
        'application/vnd.sun.xml.calc': 'sxc',
        'application/vnd.sun.xml.calc.template': 'stc',
        'application/vnd.sun.xml.draw': 'sxd',
        'application/vnd.sun.xml.draw.template': 'std',
        'application/vnd.sun.xml.impress': 'sxi',
        'application/vnd.sun.xml.impress.template': 'sti',
        'application/vnd.sun.xml.math': 'sxm',
        'application/vnd.sun.xml.writer': 'sxw',
        'application/vnd.sun.xml.writer.global': 'sxg',
        'application/vnd.sun.xml.writer.template': 'stw',
        'application/vnd.sus-calendar': 'sus',
        'application/vnd.svd': 'svd',
        'application/vnd.symbian.install': 'sis',
        'application/vnd.syncml+xml': 'xsm',
        'application/vnd.syncml.dm+wbxml': 'bdm',
        'application/vnd.syncml.dm+xml': 'xdm',
        'application/vnd.tao.intent-module-archive': 'tao',
        'application/vnd.tmobile-livetv': 'tmo',
        'application/vnd.trid.tpt': 'tpt',
        'application/vnd.triscape.mxs': 'mxs',
        'application/vnd.trueapp': 'tra',
        'application/vnd.ufdl': 'ufd',
        'application/vnd.uiq.theme': 'utz',
        'application/vnd.umajin': 'umj',
        'application/vnd.unity': 'unityweb',
        'application/vnd.uoml+xml': 'uoml',
        'application/vnd.vcx': 'vcx',
        'application/vnd.visio': 'vsd',
        'application/vnd.visionary': 'vis',
        'application/vnd.vsf': 'vsf',
        'application/vnd.wap.wbxml': 'wbxml',
        'application/vnd.wap.wmlc': 'wmlc',
        'application/vnd.wap.wmlscriptc': 'wmlsc',
        'application/vnd.webturbo': 'wtb',
        'application/vnd.wolfram.player': 'nbp',
        'application/vnd.wordperfect': 'wpd',
        'application/vnd.wqd': 'wqd',
        'application/vnd.wt.stf': 'stf',
        'application/vnd.xara': ['web', 'xar'],
        'application/vnd.xfdl': 'xfdl',
        'application/vnd.yamaha.hv-dic': 'hvd',
        'application/vnd.yamaha.hv-script': 'hvs',
        'application/vnd.yamaha.hv-voice': 'hvp',
        'application/vnd.yamaha.openscoreformat': 'osf',
        'application/vnd.yamaha.openscoreformat.osfpvg+xml': 'osfpvg',
        'application/vnd.yamaha.smaf-audio': 'saf',
        'application/vnd.yamaha.smaf-phrase': 'spf',
        'application/vnd.yellowriver-custom-menu': 'cmp',
        'application/vnd.zul': 'zir',
        'application/vnd.zzazz.deck+xml': 'zaz',
        'application/vocaltec-media-desc': 'vmd',
        'application/vocaltec-media-file': 'vmf',
        'application/voicexml+xml': 'vxml',
        'application/widget': 'wgt',
        'application/winhlp': 'hlp',
        'application/wordperfect': ['wp', 'wp5', 'wp6', 'wpd'],
        'application/wordperfect6.0': ['w60', 'wp5'],
        'application/wordperfect6.1': 'w61',
        'application/wsdl+xml': 'wsdl',
        'application/wspolicy+xml': 'wspolicy',
        'application/x-123': 'wk1',
        'application/x-7z-compressed': '7z',
        'application/x-abiword': 'abw',
        'application/x-ace-compressed': 'ace',
        'application/x-aim': 'aim',
        'application/x-authorware-bin': 'aab',
        'application/x-authorware-map': 'aam',
        'application/x-authorware-seg': 'aas',
        'application/x-bcpio': 'bcpio',
        'application/x-binary': 'bin',
        'application/x-binhex40': 'hqx',
        'application/x-bittorrent': 'torrent',
        'application/x-bsh': ['bsh', 'sh', 'shar'],
        'application/x-bytecode.elisp': 'elc',
        'applicaiton/x-bytecode.python': 'pyc',
        'application/x-bzip': 'bz',
        'application/x-bzip2': ['boz', 'bz2'],
        'application/x-cdf': 'cdf',
        'application/x-cdlink': 'vcd',
        'application/x-chat': ['cha', 'chat'],
        'application/x-chess-pgn': 'pgn',
        'application/x-cmu-raster': 'ras',
        'application/x-cocoa': 'cco',
        'application/x-compactpro': 'cpt',
        'application/x-compress': 'z',
        'application/x-compressed': ['tgz', 'gz', 'z', 'zip'],
        'application/x-conference': 'nsc',
        'application/x-cpio': 'cpio',
        'application/x-cpt': 'cpt',
        'application/x-csh': 'csh',
        'application/x-debian-package': 'deb',
        'application/x-deepv': 'deepv',
        'application/x-director': ['dcr', 'dir', 'dxr'],
        'application/x-doom': 'wad',
        'application/x-dtbncx+xml': 'ncx',
        'application/x-dtbook+xml': 'dtb',
        'application/x-dtbresource+xml': 'res',
        'application/x-dvi': 'dvi',
        'application/x-elc': 'elc',
        'application/x-envoy': ['env', 'evy'],
        'application/x-esrehber': 'es',
        'application/x-excel': ['xla', 'xlb', 'xlc', 'xld', 'xlk', 'xll', 'xlm', 'xls', 'xlt', 'xlv', 'xlw'],
        'application/x-font-bdf': 'bdf',
        'application/x-font-ghostscript': 'gsf',
        'application/x-font-linux-psf': 'psf',
        'application/x-font-otf': 'otf',
        'application/x-font-pcf': 'pcf',
        'application/x-font-snf': 'snf',
        'application/x-font-ttf': 'ttf',
        'application/x-font-type1': 'pfa',
        'application/x-font-woff': 'woff',
        'application/x-frame': 'mif',
        'application/x-freelance': 'pre',
        'application/x-futuresplash': 'spl',
        'application/x-gnumeric': 'gnumeric',
        'application/x-gsp': 'gsp',
        'application/x-gss': 'gss',
        'application/x-gtar': 'gtar',
        'application/x-gzip': ['gz', 'gzip'],
        'application/x-hdf': 'hdf',
        'application/x-helpfile': ['help', 'hlp'],
        'application/x-httpd-imap': 'imap',
        'application/x-ima': 'ima',
        'application/x-internet-signup': ['ins', 'isp'],
        'application/x-internett-signup': 'ins',
        'application/x-inventor': 'iv',
        'application/x-ip2': 'ip',
        'application/x-iphone': 'iii',
        'application/x-java-class': 'class',
        'application/x-java-commerce': 'jcm',
        'application/x-java-jnlp-file': 'jnlp',
        'application/x-javascript': 'js',
        'application/x-koan': ['skd', 'skm', 'skp', 'skt'],
        'application/x-ksh': 'ksh',
        'application/x-latex': ['latex', 'ltx'],
        'application/x-lha': 'lha',
        'application/x-lisp': 'lsp',
        'application/x-livescreen': 'ivy',
        'application/x-lotus': 'wq1',
        'application/x-lotusscreencam': 'scm',
        'application/x-lzh': 'lzh',
        'application/x-lzx': 'lzx',
        'application/x-mac-binhex40': 'hqx',
        'application/x-macbinary': 'bin',
        'application/x-magic-cap-package-1.0': 'mc$',
        'application/x-mathcad': 'mcd',
        'application/x-meme': 'mm',
        'application/x-midi': ['mid', 'midi'],
        'application/x-mif': 'mif',
        'application/x-mix-transfer': 'nix',
        'application/x-mobipocket-ebook': 'prc',
        'application/x-mplayer2': 'asx',
        'application/x-ms-application': 'application',
        'application/x-ms-wmd': 'wmd',
        'application/x-ms-wmz': 'wmz',
        'application/x-ms-xbap': 'xbap',
        'application/x-msaccess': 'mdb',
        'application/x-msbinder': 'obd',
        'application/x-mscardfile': 'crd',
        'application/x-msclip': 'clp',
        'application/x-msdownload': ['dll', 'exe'],
        'application/x-msexcel': ['xla', 'xls', 'xlw'],
        'application/x-msmediaview': ['m13', 'm14', 'mvb'],
        'application/x-msmetafile': 'wmf',
        'application/x-msmoney': 'mny',
        'application/x-mspowerpoint': 'ppt',
        'application/x-mspublisher': 'pub',
        'application/x-msschedule': 'scd',
        'application/x-msterminal': 'trm',
        'application/x-mswrite': 'wri',
        'application/x-navi-animation': 'ani',
        'application/x-navidoc': 'nvd',
        'application/x-navimap': 'map',
        'application/x-navistyle': 'stl',
        'application/x-netcdf': ['cdf', 'nc'],
        'application/x-newton-compatible-pkg': 'pkg',
        'application/x-nokia-9000-communicator-add-on-software': 'aos',
        'application/x-omc': 'omc',
        'application/x-omcdatamaker': 'omcd',
        'application/x-omcregerator': 'omcr',
        'application/x-pagemaker': ['pm4', 'pm5'],
        'application/x-pcl': 'pcl',
        'application/x-perfmon': ['pma', 'pmc', 'pml', 'pmr', 'pmw'],
        'application/x-pixclscript': 'plx',
        'application/x-pkcs10': 'p10',
        'application/x-pkcs12': ['p12', 'pfx'],
        'application/x-pkcs7-certificates': ['p7b', 'spc'],
        'application/x-pkcs7-certreqresp': 'p7r',
        'application/x-pkcs7-mime': ['p7c', 'p7m'],
        'application/x-pkcs7-signature': ['p7s', 'p7a'],
        'application/x-pointplus': 'css',
        'application/x-portable-anymap': 'pnm',
        'application/x-project': ['mpc', 'mpt', 'mpv', 'mpx'],
        'application/x-qpro': 'wb1',
        'application/x-rar-compressed': 'rar',
        'application/x-rtf': 'rtf',
        'application/x-sdp': 'sdp',
        'application/x-sea': 'sea',
        'application/x-seelogo': 'sl',
        'application/x-sh': 'sh',
        'application/x-shar': ['shar', 'sh'],
        'application/x-shockwave-flash': 'swf',
        'application/x-silverlight-app': 'xap',
        'application/x-sit': 'sit',
        'application/x-sprite': ['spr', 'sprite'],
        'application/x-stuffit': 'sit',
        'application/x-stuffitx': 'sitx',
        'application/x-sv4cpio': 'sv4cpio',
        'application/x-sv4crc': 'sv4crc',
        'application/x-tar': 'tar',
        'application/x-tbook': ['sbk', 'tbk'],
        'application/x-tcl': 'tcl',
        'application/x-tex': 'tex',
        'application/x-tex-tfm': 'tfm',
        'application/x-texinfo': ['texi', 'texinfo'],
        'application/x-troff': ['roff', 't', 'tr'],
        'application/x-troff-man': 'man',
        'application/x-troff-me': 'me',
        'application/x-troff-ms': 'ms',
        'application/x-troff-msvideo': 'avi',
        'application/x-ustar': 'ustar',
        'application/x-visio': ['vsd', 'vst', 'vsw'],
        'application/x-vnd.audioexplosion.mzz': 'mzz',
        'application/x-vnd.ls-xpix': 'xpix',
        'application/x-vrml': 'vrml',
        'application/x-wais-source': ['src', 'wsrc'],
        'application/x-winhelp': 'hlp',
        'application/x-wintalk': 'wtk',
        'application/x-world': ['svr', 'wrl'],
        'application/x-wpwin': 'wpd',
        'application/x-wri': 'wri',
        'application/x-x509-ca-cert': ['cer', 'crt', 'der'],
        'application/x-x509-user-cert': 'crt',
        'application/x-xfig': 'fig',
        'application/x-xpinstall': 'xpi',
        'application/x-zip-compressed': 'zip',
        'application/xcap-diff+xml': 'xdf',
        'application/xenc+xml': 'xenc',
        'application/xhtml+xml': 'xhtml',
        'application/xml': 'xml',
        'application/xml-dtd': 'dtd',
        'application/xop+xml': 'xop',
        'application/xslt+xml': 'xslt',
        'application/xspf+xml': 'xspf',
        'application/xv+xml': 'mxml',
        'application/yang': 'yang',
        'application/yin+xml': 'yin',
        'application/ynd.ms-pkipko': 'pko',
        'application/zip': 'zip',
        'audio/adpcm': 'adp',
        'audio/aiff': ['aif', 'aifc', 'aiff'],
        'audio/basic': ['au', 'snd'],
        'audio/it': 'it',
        'audio/make': ['funk', 'my', 'pfunk'],
        'audio/make.my.funk': 'pfunk',
        'audio/mid': ['mid', 'rmi'],
        'audio/midi': ['kar', 'mid', 'midi'],
        'audio/mod': 'mod',
        'audio/mp4': 'mp4a',
        'audio/mpeg': ['mp3', 'm2a', 'mp2', 'mpa', 'mpg', 'mpga'],
        'audio/mpeg3': 'mp3',
        'audio/nspaudio': ['la', 'lma'],
        'audio/ogg': 'oga',
        'audio/s3m': 's3m',
        'audio/tsp-audio': 'tsi',
        'audio/tsplayer': 'tsp',
        'audio/vnd.dece.audio': 'uva',
        'audio/vnd.digital-winds': 'eol',
        'audio/vnd.dra': 'dra',
        'audio/vnd.dts': 'dts',
        'audio/vnd.dts.hd': 'dtshd',
        'audio/vnd.lucent.voice': 'lvp',
        'audio/vnd.ms-playready.media.pya': 'pya',
        'audio/vnd.nuera.ecelp4800': 'ecelp4800',
        'audio/vnd.nuera.ecelp7470': 'ecelp7470',
        'audio/vnd.nuera.ecelp9600': 'ecelp9600',
        'audio/vnd.qcelp': 'qcp',
        'audio/vnd.rip': 'rip',
        'audio/voc': 'voc',
        'audio/voxware': 'vox',
        'audio/wav': 'wav',
        'audio/webm': 'weba',
        'audio/x-aac': 'aac',
        'audio/x-adpcm': 'snd',
        'audio/x-aiff': ['aif', 'aifc', 'aiff'],
        'audio/x-au': 'au',
        'audio/x-gsm': ['gsd', 'gsm'],
        'audio/x-jam': 'jam',
        'audio/x-liveaudio': 'lam',
        'audio/x-mid': ['mid', 'midi'],
        'audio/x-midi': ['mid', 'midi'],
        'audio/x-mod': 'mod',
        'audio/x-mpeg': 'mp2',
        'audio/x-mpeg-3': 'mp3',
        'audio/x-mpegurl': 'm3u',
        'audio/x-mpequrl': 'm3u',
        'audio/x-ms-wax': 'wax',
        'audio/x-ms-wma': 'wma',
        'audio/x-nspaudio': ['la', 'lma'],
        'audio/x-pn-realaudio': ['ra', 'ram', 'rm', 'rmm', 'rmp'],
        'audio/x-pn-realaudio-plugin': ['ra', 'rmp', 'rpm'],
        'audio/x-psid': 'sid',
        'audio/x-realaudio': 'ra',
        'audio/x-twinvq': 'vqf',
        'audio/x-twinvq-plugin': ['vqe', 'vql'],
        'audio/x-vnd.audioexplosion.mjuicemediafile': 'mjf',
        'audio/x-voc': 'voc',
        'audio/x-wav': 'wav',
        'audio/xm': 'xm',
        'chemical/x-cdx': 'cdx',
        'chemical/x-cif': 'cif',
        'chemical/x-cmdf': 'cmdf',
        'chemical/x-cml': 'cml',
        'chemical/x-csml': 'csml',
        'chemical/x-pdb': ['pdb', 'xyz'],
        'chemical/x-xyz': 'xyz',
        'drawing/x-dwf': 'dwf',
        'i-world/i-vrml': 'ivr',
        'image/bmp': ['bmp', 'bm'],
        'image/cgm': 'cgm',
        'image/cis-cod': 'cod',
        'image/cmu-raster': ['ras', 'rast'],
        'image/fif': 'fif',
        'image/florian': ['flo', 'turbot'],
        'image/g3fax': 'g3',
        'image/gif': 'gif',
        'image/ief': ['ief', 'iefs'],
        'image/jpeg': ['jpe', 'jpeg', 'jpg', 'jfif', 'jfif-tbnl'],
        'image/jutvision': 'jut',
        'image/ktx': 'ktx',
        'image/naplps': ['nap', 'naplps'],
        'image/pict': ['pic', 'pict'],
        'image/pipeg': 'jfif',
        'image/pjpeg': ['jfif', 'jpe', 'jpeg', 'jpg'],
        'image/png': ['png', 'x-png'],
        'image/prs.btif': 'btif',
        'image/svg+xml': 'svg',
        'image/tiff': ['tif', 'tiff'],
        'image/vasa': 'mcf',
        'image/vnd.adobe.photoshop': 'psd',
        'image/vnd.dece.graphic': 'uvi',
        'image/vnd.djvu': 'djvu',
        'image/vnd.dvb.subtitle': 'sub',
        'image/vnd.dwg': ['dwg', 'dxf', 'svf'],
        'image/vnd.dxf': 'dxf',
        'image/vnd.fastbidsheet': 'fbs',
        'image/vnd.fpx': 'fpx',
        'image/vnd.fst': 'fst',
        'image/vnd.fujixerox.edmics-mmr': 'mmr',
        'image/vnd.fujixerox.edmics-rlc': 'rlc',
        'image/vnd.ms-modi': 'mdi',
        'image/vnd.net-fpx': ['fpx', 'npx'],
        'image/vnd.rn-realflash': 'rf',
        'image/vnd.rn-realpix': 'rp',
        'image/vnd.wap.wbmp': 'wbmp',
        'image/vnd.xiff': 'xif',
        'image/webp': 'webp',
        'image/x-cmu-raster': 'ras',
        'image/x-cmx': 'cmx',
        'image/x-dwg': ['dwg', 'dxf', 'svf'],
        'image/x-freehand': 'fh',
        'image/x-icon': 'ico',
        'image/x-jg': 'art',
        'image/x-jps': 'jps',
        'image/x-niff': ['nif', 'niff'],
        'image/x-pcx': 'pcx',
        'image/x-pict': ['pct', 'pic'],
        'image/x-portable-anymap': 'pnm',
        'image/x-portable-bitmap': 'pbm',
        'image/x-portable-graymap': 'pgm',
        'image/x-portable-greymap': 'pgm',
        'image/x-portable-pixmap': 'ppm',
        'image/x-quicktime': ['qif', 'qti', 'qtif'],
        'image/x-rgb': 'rgb',
        'image/x-tiff': ['tif', 'tiff'],
        'image/x-windows-bmp': 'bmp',
        'image/x-xbitmap': 'xbm',
        'image/x-xbm': 'xbm',
        'image/x-xpixmap': ['xpm', 'pm'],
        'image/x-xwd': 'xwd',
        'image/x-xwindowdump': 'xwd',
        'image/xbm': 'xbm',
        'image/xpm': 'xpm',
        'message/rfc822': ['mht', 'mhtml', 'nws', 'mime', 'eml'],
        'model/iges': ['iges', 'igs'],
        'model/mesh': 'msh',
        'model/vnd.collada+xml': 'dae',
        'model/vnd.dwf': 'dwf',
        'model/vnd.gdl': 'gdl',
        'model/vnd.gtw': 'gtw',
        'model/vnd.mts': 'mts',
        'model/vnd.vtu': 'vtu',
        'model/vrml': ['vrml', 'wrl', 'wrz'],
        'model/x-pov': 'pov',
        'multipart/x-gzip': 'gzip',
        'multipart/x-ustar': 'ustar',
        'multipart/x-zip': 'zip',
        'music/crescendo': ['mid', 'midi'],
        'music/x-karaoke': 'kar',
        'paleovu/x-pv': 'pvu',
        'text/asp': 'asp',
        'text/calendar': 'ics',
        'text/css': 'css',
        'text/csv': 'csv',
        'text/ecmascript': 'js',
        'text/h323': '323',
        'text/html': ['htm', 'html', 'stm', 'acgi', 'htmls', 'htx', 'shtml'],
        'text/iuls': 'uls',
        'text/javascript': 'js',
        'text/mcf': 'mcf',
        'text/n3': 'n3',
        'text/pascal': 'pas',
        'text/plain': ['bas', 'c', 'h', 'txt', 'c++', 'cc', 'com', 'conf', 'cxx', 'def', 'f', 'f90', 'for', 'g', 'hh', 'idc', 'jav', 'java', 'list', 'log', 'lst', 'm', 'mar', 'pl', 'sdml', 'text'],
        'text/plain-bas': 'par',
        'text/prs.lines.tag': 'dsc',
        'text/richtext': ['rtx', 'rt', 'rtf'],
        'text/scriplet': 'wsc',
        'text/scriptlet': 'sct',
        'text/sgml': ['sgm', 'sgml'],
        'text/tab-separated-values': 'tsv',
        'text/troff': 't',
        'text/turtle': 'ttl',
        'text/uri-list': ['uni', 'unis', 'uri', 'uris'],
        'text/vnd.abc': 'abc',
        'text/vnd.curl': 'curl',
        'text/vnd.curl.dcurl': 'dcurl',
        'text/vnd.curl.mcurl': 'mcurl',
        'text/vnd.curl.scurl': 'scurl',
        'text/vnd.fly': 'fly',
        'text/vnd.fmi.flexstor': 'flx',
        'text/vnd.graphviz': 'gv',
        'text/vnd.in3d.3dml': '3dml',
        'text/vnd.in3d.spot': 'spot',
        'text/vnd.rn-realtext': 'rt',
        'text/vnd.sun.j2me.app-descriptor': 'jad',
        'text/vnd.wap.wml': 'wml',
        'text/vnd.wap.wmlscript': 'wmls',
        'text/webviewhtml': 'htt',
        'text/x-asm': ['asm', 's'],
        'text/x-audiosoft-intra': 'aip',
        'text/x-c': ['c', 'cc', 'cpp'],
        'text/x-component': 'htc',
        'text/x-fortran': ['f', 'f77', 'f90', 'for'],
        'text/x-h': ['h', 'hh'],
        'text/x-java-source': ['jav', 'java'],
        'text/x-java-source,java': 'java',
        'text/x-la-asf': 'lsx',
        'text/x-m': 'm',
        'text/x-pascal': 'p',
        'text/x-script': 'hlb',
        'text/x-script.csh': 'csh',
        'text/x-script.elisp': 'el',
        'text/x-script.guile': 'scm',
        'text/x-script.ksh': 'ksh',
        'text/x-script.lisp': 'lsp',
        'text/x-script.perl': 'pl',
        'text/x-script.perl-module': 'pm',
        'text/x-script.phyton': 'py',
        'text/x-script.rexx': 'rexx',
        'text/x-script.scheme': 'scm',
        'text/x-script.sh': 'sh',
        'text/x-script.tcl': 'tcl',
        'text/x-script.tcsh': 'tcsh',
        'text/x-script.zsh': 'zsh',
        'text/x-server-parsed-html': ['shtml', 'ssi'],
        'text/x-setext': 'etx',
        'text/x-sgml': ['sgm', 'sgml'],
        'text/x-speech': ['spc', 'talk'],
        'text/x-uil': 'uil',
        'text/x-uuencode': ['uu', 'uue'],
        'text/x-vcalendar': 'vcs',
        'text/x-vcard': 'vcf',
        'text/xml': 'xml',
        'video/3gpp': '3gp',
        'video/3gpp2': '3g2',
        'video/animaflex': 'afl',
        'video/avi': 'avi',
        'video/avs-video': 'avs',
        'video/dl': 'dl',
        'video/fli': 'fli',
        'video/gl': 'gl',
        'video/h261': 'h261',
        'video/h263': 'h263',
        'video/h264': 'h264',
        'video/jpeg': 'jpgv',
        'video/jpm': 'jpm',
        'video/mj2': 'mj2',
        'video/mp4': 'mp4',
        'video/mpeg': ['mp2', 'mpa', 'mpe', 'mpeg', 'mpg', 'mpv2', 'm1v', 'm2v', 'mp3'],
        'video/msvideo': 'avi',
        'video/ogg': 'ogv',
        'video/quicktime': ['mov', 'qt', 'moov'],
        'video/vdo': 'vdo',
        'video/vivo': ['viv', 'vivo'],
        'video/vnd.dece.hd': 'uvh',
        'video/vnd.dece.mobile': 'uvm',
        'video/vnd.dece.pd': 'uvp',
        'video/vnd.dece.sd': 'uvs',
        'video/vnd.dece.video': 'uvv',
        'video/vnd.fvt': 'fvt',
        'video/vnd.mpegurl': 'mxu',
        'video/vnd.ms-playready.media.pyv': 'pyv',
        'video/vnd.rn-realvideo': 'rv',
        'video/vnd.uvvu.mp4': 'uvu',
        'video/vnd.vivo': ['viv', 'vivo'],
        'video/vosaic': 'vos',
        'video/webm': 'webm',
        'video/x-amt-demorun': 'xdr',
        'video/x-amt-showrun': 'xsr',
        'video/x-atomic3d-feature': 'fmf',
        'video/x-dl': 'dl',
        'video/x-dv': ['dif', 'dv'],
        'video/x-f4v': 'f4v',
        'video/x-fli': 'fli',
        'video/x-flv': 'flv',
        'video/x-gl': 'gl',
        'video/x-isvideo': 'isu',
        'video/x-la-asf': ['lsf', 'lsx'],
        'video/x-m4v': 'm4v',
        'video/x-motion-jpeg': 'mjpg',
        'video/x-mpeg': ['mp2', 'mp3'],
        'video/x-mpeq2a': 'mp2',
        'video/x-ms-asf': ['asf', 'asr', 'asx'],
        'video/x-ms-asf-plugin': 'asx',
        'video/x-ms-wm': 'wm',
        'video/x-ms-wmv': 'wmv',
        'video/x-ms-wmx': 'wmx',
        'video/x-ms-wvx': 'wvx',
        'video/x-msvideo': 'avi',
        'video/x-qtc': 'qtc',
        'video/x-scm': 'scm',
        'video/x-sgi-movie': ['movie', 'mv'],
        'windows/metafile': 'wmf',
        'www/mime': 'mime',
        'x-conference/x-cooltalk': 'ice',
        'x-music/x-midi': ['mid', 'midi'],
        'x-world/x-3dmf': ['3dm', '3dmf', 'qd3', 'qd3d'],
        'x-world/x-svr': 'svr',
        'x-world/x-vrml': ['flr', 'vrml', 'wrl', 'wrz', 'xaf', 'xof'],
        'x-world/x-vrt': 'vrt',
        'xgl/drawing': 'xgz',
        'xgl/movie': 'xmz',
    };

    var mimetypesExtensions = {
        '': ['application/andrew-inset', 'application/pgp-encrypted'],
        '*': 'application/octet-stream',
        '123': 'application/vnd.lotus-1-2-3',
        '323': 'text/h323',
        '3dm': 'x-world/x-3dmf',
        '3dmf': 'x-world/x-3dmf',
        '3dml': 'text/vnd.in3d.3dml',
        '3g2': 'video/3gpp2',
        '3gp': 'video/3gpp',
        '7z': 'application/x-7z-compressed',
        'a': 'application/octet-stream',
        'aab': 'application/x-authorware-bin',
        'aac': 'audio/x-aac',
        'aam': 'application/x-authorware-map',
        'aas': 'application/x-authorware-seg',
        'abc': 'text/vnd.abc',
        'abw': 'application/x-abiword',
        'ac': 'application/pkix-attr-cert',
        'acc': 'application/vnd.americandynamics.acc',
        'ace': 'application/x-ace-compressed',
        'acgi': 'text/html',
        'acu': 'application/vnd.acucobol',
        'acx': 'application/internet-property-stream',
        'adp': 'audio/adpcm',
        'aep': 'application/vnd.audiograph',
        'afl': 'video/animaflex',
        'afp': 'application/vnd.ibm.modcap',
        'ahead': 'application/vnd.ahead.space',
        'ai': 'application/postscript',
        'aif': ['audio/aiff', 'audio/x-aiff'],
        'aifc': ['audio/aiff', 'audio/x-aiff'],
        'aiff': ['audio/aiff', 'audio/x-aiff'],
        'aim': 'application/x-aim',
        'aip': 'text/x-audiosoft-intra',
        'air': 'application/vnd.adobe.air-application-installer-package+zip',
        'ait': 'application/vnd.dvb.ait',
        'ami': 'application/vnd.amiga.ami',
        'ani': 'application/x-navi-animation',
        'aos': 'application/x-nokia-9000-communicator-add-on-software',
        'apk': 'application/vnd.android.package-archive',
        'application': 'application/x-ms-application',
        'apr': 'application/vnd.lotus-approach',
        'aps': 'application/mime',
        'arc': 'application/octet-stream',
        'arj': ['application/arj', 'application/octet-stream'],
        'art': 'image/x-jg',
        'asf': 'video/x-ms-asf',
        'asm': 'text/x-asm',
        'aso': 'application/vnd.accpac.simply.aso',
        'asp': 'text/asp',
        'asr': 'video/x-ms-asf',
        'asx': ['video/x-ms-asf', 'application/x-mplayer2', 'video/x-ms-asf-plugin'],
        'atc': 'application/vnd.acucorp',
        'atomcat': 'application/atomcat+xml',
        'atomsvc': 'application/atomsvc+xml',
        'atx': 'application/vnd.antix.game-component',
        'au': ['audio/basic', 'audio/x-au'],
        'avi': ['video/avi', 'video/msvideo', 'application/x-troff-msvideo', 'video/x-msvideo'],
        'avs': 'video/avs-video',
        'aw': 'application/applixware',
        'axs': 'application/olescript',
        'azf': 'application/vnd.airzip.filesecure.azf',
        'azs': 'application/vnd.airzip.filesecure.azs',
        'azw': 'application/vnd.amazon.ebook',
        'bas': 'text/plain',
        'bcpio': 'application/x-bcpio',
        'bdf': 'application/x-font-bdf',
        'bdm': 'application/vnd.syncml.dm+wbxml',
        'bed': 'application/vnd.realvnc.bed',
        'bh2': 'application/vnd.fujitsu.oasysprs',
        'bin': ['application/octet-stream', 'application/mac-binary', 'application/macbinary', 'application/x-macbinary', 'application/x-binary'],
        'bm': 'image/bmp',
        'bmi': 'application/vnd.bmi',
        'bmp': ['image/bmp', 'image/x-windows-bmp'],
        'boo': 'application/book',
        'book': 'application/book',
        'box': 'application/vnd.previewsystems.box',
        'boz': 'application/x-bzip2',
        'bsh': 'application/x-bsh',
        'btif': 'image/prs.btif',
        'bz': 'application/x-bzip',
        'bz2': 'application/x-bzip2',
        'c': ['text/plain', 'text/x-c'],
        'c++': 'text/plain',
        'c11amc': 'application/vnd.cluetrust.cartomobile-config',
        'c11amz': 'application/vnd.cluetrust.cartomobile-config-pkg',
        'c4g': 'application/vnd.clonk.c4group',
        'cab': 'application/vnd.ms-cab-compressed',
        'car': 'application/vnd.curl.car',
        'cat': ['application/vnd.ms-pkiseccat', 'application/vnd.ms-pki.seccat'],
        'cc': ['text/plain', 'text/x-c'],
        'ccad': 'application/clariscad',
        'cco': 'application/x-cocoa',
        'ccxml': 'application/ccxml+xml,',
        'cdbcmsg': 'application/vnd.contact.cmsg',
        'cdf': ['application/cdf', 'application/x-cdf', 'application/x-netcdf'],
        'cdkey': 'application/vnd.mediastation.cdkey',
        'cdmia': 'application/cdmi-capability',
        'cdmic': 'application/cdmi-container',
        'cdmid': 'application/cdmi-domain',
        'cdmio': 'application/cdmi-object',
        'cdmiq': 'application/cdmi-queue',
        'cdx': 'chemical/x-cdx',
        'cdxml': 'application/vnd.chemdraw+xml',
        'cdy': 'application/vnd.cinderella',
        'cer': ['application/pkix-cert', 'application/x-x509-ca-cert'],
        'cgm': 'image/cgm',
        'cha': 'application/x-chat',
        'chat': 'application/x-chat',
        'chm': 'application/vnd.ms-htmlhelp',
        'chrt': 'application/vnd.kde.kchart',
        'cif': 'chemical/x-cif',
        'cii': 'application/vnd.anser-web-certificate-issue-initiation',
        'cil': 'application/vnd.ms-artgalry',
        'cla': 'application/vnd.claymore',
        'class': ['application/octet-stream', 'application/java', 'application/java-byte-code', 'application/java-vm', 'application/x-java-class'],
        'clkk': 'application/vnd.crick.clicker.keyboard',
        'clkp': 'application/vnd.crick.clicker.palette',
        'clkt': 'application/vnd.crick.clicker.template',
        'clkw': 'application/vnd.crick.clicker.wordbank',
        'clkx': 'application/vnd.crick.clicker',
        'clp': 'application/x-msclip',
        'cmc': 'application/vnd.cosmocaller',
        'cmdf': 'chemical/x-cmdf',
        'cml': 'chemical/x-cml',
        'cmp': 'application/vnd.yellowriver-custom-menu',
        'cmx': 'image/x-cmx',
        'cod': ['image/cis-cod', 'application/vnd.rim.cod'],
        'com': ['application/octet-stream', 'text/plain'],
        'conf': 'text/plain',
        'cpio': 'application/x-cpio',
        'cpp': 'text/x-c',
        'cpt': ['application/mac-compactpro', 'application/x-compactpro', 'application/x-cpt'],
        'crd': 'application/x-mscardfile',
        'crl': ['application/pkix-crl', 'application/pkcs-crl'],
        'crt': ['application/pkix-cert', 'application/x-x509-user-cert', 'application/x-x509-ca-cert'],
        'cryptonote': 'application/vnd.rig.cryptonote',
        'csh': ['text/x-script.csh', 'application/x-csh'],
        'csml': 'chemical/x-csml',
        'csp': 'application/vnd.commonspace',
        'css': ['text/css', 'application/x-pointplus'],
        'csv': 'text/csv',
        'cu': 'application/cu-seeme',
        'curl': 'text/vnd.curl',
        'cww': 'application/prs.cww',
        'cxx': 'text/plain',
        'dae': 'model/vnd.collada+xml',
        'daf': 'application/vnd.mobius.daf',
        'davmount': 'application/davmount+xml',
        'dcr': 'application/x-director',
        'dcurl': 'text/vnd.curl.dcurl',
        'dd2': 'application/vnd.oma.dd2+xml',
        'ddd': 'application/vnd.fujixerox.ddd',
        'deb': 'application/x-debian-package',
        'deepv': 'application/x-deepv',
        'def': 'text/plain',
        'der': 'application/x-x509-ca-cert',
        'dfac': 'application/vnd.dreamfactory',
        'dif': 'video/x-dv',
        'dir': 'application/x-director',
        'dis': 'application/vnd.mobius.dis',
        'djvu': 'image/vnd.djvu',
        'dl': ['video/dl', 'video/x-dl'],
        'dll': 'application/x-msdownload',
        'dms': 'application/octet-stream',
        'dna': 'application/vnd.dna',
        'doc': 'application/msword',
        'docm': 'application/vnd.ms-word.document.macroenabled.12',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'dot': 'application/msword',
        'dotm': 'application/vnd.ms-word.template.macroenabled.12',
        'dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
        'dp': ['application/commonground', 'application/vnd.osgi.dp'],
        'dpg': 'application/vnd.dpgraph',
        'dra': 'audio/vnd.dra',
        'drw': 'application/drafting',
        'dsc': 'text/prs.lines.tag',
        'dssc': 'application/dssc+der',
        'dtb': 'application/x-dtbook+xml',
        'dtd': 'application/xml-dtd',
        'dts': 'audio/vnd.dts',
        'dtshd': 'audio/vnd.dts.hd',
        'dump': 'application/octet-stream',
        'dv': 'video/x-dv',
        'dvi': 'application/x-dvi',
        'dwf': ['model/vnd.dwf', 'drawing/x-dwf'],
        'dwg': ['application/acad', 'image/vnd.dwg', 'image/x-dwg'],
        'dxf': ['application/dxf', 'image/vnd.dwg', 'image/vnd.dxf', 'image/x-dwg'],
        'dxp': 'application/vnd.spotfire.dxp',
        'dxr': 'application/x-director',
        'ecelp4800': 'audio/vnd.nuera.ecelp4800',
        'ecelp7470': 'audio/vnd.nuera.ecelp7470',
        'ecelp9600': 'audio/vnd.nuera.ecelp9600',
        'edm': 'application/vnd.novadigm.edm',
        'edx': 'application/vnd.novadigm.edx',
        'efif': 'application/vnd.picsel',
        'ei6': 'application/vnd.pg.osasli',
        'el': 'text/x-script.elisp',
        'elc': ['application/x-elc', 'application/x-bytecode.elisp'],
        'eml': 'message/rfc822',
        'emma': 'application/emma+xml',
        'env': 'application/x-envoy',
        'eol': 'audio/vnd.digital-winds',
        'eot': 'application/vnd.ms-fontobject',
        'eps': 'application/postscript',
        'epub': 'application/epub+zip',
        'es': ['application/ecmascript', 'application/x-esrehber'],
        'es3': 'application/vnd.eszigno3+xml',
        'esf': 'application/vnd.epson.esf',
        'etx': 'text/x-setext',
        'evy': ['application/envoy', 'application/x-envoy'],
        'exe': ['application/octet-stream', 'application/x-msdownload'],
        'exi': 'application/exi',
        'ext': 'application/vnd.novadigm.ext',
        'ez2': 'application/vnd.ezpix-album',
        'ez3': 'application/vnd.ezpix-package',
        'f': ['text/plain', 'text/x-fortran'],
        'f4v': 'video/x-f4v',
        'f77': 'text/x-fortran',
        'f90': ['text/plain', 'text/x-fortran'],
        'fbs': 'image/vnd.fastbidsheet',
        'fcs': 'application/vnd.isac.fcs',
        'fdf': 'application/vnd.fdf',
        'fe_launch': 'application/vnd.denovo.fcselayout-link',
        'fg5': 'application/vnd.fujitsu.oasysgp',
        'fh': 'image/x-freehand',
        'fif': ['application/fractals', 'image/fif'],
        'fig': 'application/x-xfig',
        'fli': ['video/fli', 'video/x-fli'],
        'flo': ['image/florian', 'application/vnd.micrografx.flo'],
        'flr': 'x-world/x-vrml',
        'flv': 'video/x-flv',
        'flw': 'application/vnd.kde.kivio',
        'flx': 'text/vnd.fmi.flexstor',
        'fly': 'text/vnd.fly',
        'fm': 'application/vnd.framemaker',
        'fmf': 'video/x-atomic3d-feature',
        'fnc': 'application/vnd.frogans.fnc',
        'for': ['text/plain', 'text/x-fortran'],
        'fpx': ['image/vnd.fpx', 'image/vnd.net-fpx'],
        'frl': 'application/freeloader',
        'fsc': 'application/vnd.fsc.weblaunch',
        'fst': 'image/vnd.fst',
        'ftc': 'application/vnd.fluxtime.clip',
        'fti': 'application/vnd.anser-web-funds-transfer-initiation',
        'funk': 'audio/make',
        'fvt': 'video/vnd.fvt',
        'fxp': 'application/vnd.adobe.fxp',
        'fzs': 'application/vnd.fuzzysheet',
        'g': 'text/plain',
        'g2w': 'application/vnd.geoplan',
        'g3': 'image/g3fax',
        'g3w': 'application/vnd.geospace',
        'gac': 'application/vnd.groove-account',
        'gdl': 'model/vnd.gdl',
        'geo': 'application/vnd.dynageo',
        'gex': 'application/vnd.geometry-explorer',
        'ggb': 'application/vnd.geogebra.file',
        'ggt': 'application/vnd.geogebra.tool',
        'ghf': 'application/vnd.groove-help',
        'gif': 'image/gif',
        'gim': 'application/vnd.groove-identity-message',
        'gl': ['video/gl', 'video/x-gl'],
        'gmx': 'application/vnd.gmx',
        'gnumeric': 'application/x-gnumeric',
        'gph': 'application/vnd.flographit',
        'gqf': 'application/vnd.grafeq',
        'gram': 'application/srgs',
        'grv': 'application/vnd.groove-injector',
        'grxml': 'application/srgs+xml',
        'gsd': 'audio/x-gsm',
        'gsf': 'application/x-font-ghostscript',
        'gsm': 'audio/x-gsm',
        'gsp': 'application/x-gsp',
        'gss': 'application/x-gss',
        'gtar': 'application/x-gtar',
        'gtm': 'application/vnd.groove-tool-message',
        'gtw': 'model/vnd.gtw',
        'gv': 'text/vnd.graphviz',
        'gxt': 'application/vnd.geonext',
        'gz': ['application/x-gzip', 'application/x-compressed'],
        'gzip': ['multipart/x-gzip', 'application/x-gzip'],
        'h': ['text/plain', 'text/x-h'],
        'h261': 'video/h261',
        'h263': 'video/h263',
        'h264': 'video/h264',
        'hal': 'application/vnd.hal+xml',
        'hbci': 'application/vnd.hbci',
        'hdf': 'application/x-hdf',
        'help': 'application/x-helpfile',
        'hgl': 'application/vnd.hp-hpgl',
        'hh': ['text/plain', 'text/x-h'],
        'hlb': 'text/x-script',
        'hlp': ['application/winhlp', 'application/hlp', 'application/x-helpfile', 'application/x-winhelp'],
        'hpg': 'application/vnd.hp-hpgl',
        'hpgl': 'application/vnd.hp-hpgl',
        'hpid': 'application/vnd.hp-hpid',
        'hps': 'application/vnd.hp-hps',
        'hqx': ['application/mac-binhex40', 'application/binhex', 'application/binhex4', 'application/mac-binhex', 'application/x-binhex40', 'application/x-mac-binhex40'],
        'hta': 'application/hta',
        'htc': 'text/x-component',
        'htke': 'application/vnd.kenameaapp',
        'htm': 'text/html',
        'html': 'text/html',
        'htmls': 'text/html',
        'htt': 'text/webviewhtml',
        'htx': 'text/html',
        'hvd': 'application/vnd.yamaha.hv-dic',
        'hvp': 'application/vnd.yamaha.hv-voice',
        'hvs': 'application/vnd.yamaha.hv-script',
        'i2g': 'application/vnd.intergeo',
        'icc': 'application/vnd.iccprofile',
        'ice': 'x-conference/x-cooltalk',
        'ico': 'image/x-icon',
        'ics': 'text/calendar',
        'idc': 'text/plain',
        'ief': 'image/ief',
        'iefs': 'image/ief',
        'ifm': 'application/vnd.shana.informed.formdata',
        'iges': ['application/iges', 'model/iges'],
        'igl': 'application/vnd.igloader',
        'igm': 'application/vnd.insors.igm',
        'igs': ['application/iges', 'model/iges'],
        'igx': 'application/vnd.micrografx.igx',
        'iif': 'application/vnd.shana.informed.interchange',
        'iii': 'application/x-iphone',
        'ima': 'application/x-ima',
        'imap': 'application/x-httpd-imap',
        'imp': 'application/vnd.accpac.simply.imp',
        'ims': 'application/vnd.ms-ims',
        'inf': 'application/inf',
        'ins': ['application/x-internet-signup', 'application/x-internett-signup'],
        'ip': 'application/x-ip2',
        'ipfix': 'application/ipfix',
        'ipk': 'application/vnd.shana.informed.package',
        'irm': 'application/vnd.ibm.rights-management',
        'irp': 'application/vnd.irepository.package+xml',
        'isp': 'application/x-internet-signup',
        'isu': 'video/x-isvideo',
        'it': 'audio/it',
        'itp': 'application/vnd.shana.informed.formtemplate',
        'iv': 'application/x-inventor',
        'ivp': 'application/vnd.immervision-ivp',
        'ivr': 'i-world/i-vrml',
        'ivu': 'application/vnd.immervision-ivu',
        'ivy': 'application/x-livescreen',
        'jad': 'text/vnd.sun.j2me.app-descriptor',
        'jam': ['application/vnd.jam', 'audio/x-jam'],
        'jar': 'application/java-archive',
        'jav': ['text/plain', 'text/x-java-source'],
        'java': ['text/plain', 'text/x-java-source,java', 'text/x-java-source'],
        'jcm': 'application/x-java-commerce',
        'jfif': ['image/pipeg', 'image/jpeg', 'image/pjpeg'],
        'jfif-tbnl': 'image/jpeg',
        'jisp': 'application/vnd.jisp',
        'jlt': 'application/vnd.hp-jlyt',
        'jnlp': 'application/x-java-jnlp-file',
        'joda': 'application/vnd.joost.joda-archive',
        'jpe': ['image/jpeg', 'image/pjpeg'],
        'jpeg': ['image/jpeg', 'image/pjpeg'],
        'jpg': ['image/jpeg', 'image/pjpeg'],
        'jpgv': 'video/jpeg',
        'jpm': 'video/jpm',
        'jps': 'image/x-jps',
        'js': ['application/javascript', 'application/ecmascript', 'text/javascript', 'text/ecmascript', 'application/x-javascript'],
        'json': 'application/json',
        'jut': 'image/jutvision',
        'kar': ['audio/midi', 'music/x-karaoke'],
        'karbon': 'application/vnd.kde.karbon',
        'kfo': 'application/vnd.kde.kformula',
        'kia': 'application/vnd.kidspiration',
        'kml': 'application/vnd.google-earth.kml+xml',
        'kmz': 'application/vnd.google-earth.kmz',
        'kne': 'application/vnd.kinar',
        'kon': 'application/vnd.kde.kontour',
        'kpr': 'application/vnd.kde.kpresenter',
        'ksh': ['application/x-ksh', 'text/x-script.ksh'],
        'ksp': 'application/vnd.kde.kspread',
        'ktx': 'image/ktx',
        'ktz': 'application/vnd.kahootz',
        'kwd': 'application/vnd.kde.kword',
        'la': ['audio/nspaudio', 'audio/x-nspaudio'],
        'lam': 'audio/x-liveaudio',
        'lasxml': 'application/vnd.las.las+xml',
        'latex': 'application/x-latex',
        'lbd': 'application/vnd.llamagraphics.life-balance.desktop',
        'lbe': 'application/vnd.llamagraphics.life-balance.exchange+xml',
        'les': 'application/vnd.hhe.lesson-player',
        'lha': ['application/octet-stream', 'application/lha', 'application/x-lha'],
        'lhx': 'application/octet-stream',
        'link66': 'application/vnd.route66.link66+xml',
        'list': 'text/plain',
        'lma': ['audio/nspaudio', 'audio/x-nspaudio'],
        'log': 'text/plain',
        'lrm': 'application/vnd.ms-lrm',
        'lsf': 'video/x-la-asf',
        'lsp': ['application/x-lisp', 'text/x-script.lisp'],
        'lst': 'text/plain',
        'lsx': ['video/x-la-asf', 'text/x-la-asf'],
        'ltf': 'application/vnd.frogans.ltf',
        'ltx': 'application/x-latex',
        'lvp': 'audio/vnd.lucent.voice',
        'lwp': 'application/vnd.lotus-wordpro',
        'lzh': ['application/octet-stream', 'application/x-lzh'],
        'lzx': ['application/lzx', 'application/octet-stream', 'application/x-lzx'],
        'm': ['text/plain', 'text/x-m'],
        'm13': 'application/x-msmediaview',
        'm14': 'application/x-msmediaview',
        'm1v': 'video/mpeg',
        'm21': 'application/mp21',
        'm2a': 'audio/mpeg',
        'm2v': 'video/mpeg',
        'm3u': ['audio/x-mpegurl', 'audio/x-mpequrl'],
        'm3u8': 'application/vnd.apple.mpegurl',
        'm4v': 'video/x-m4v',
        'ma': 'application/mathematica',
        'mads': 'application/mads+xml',
        'mag': 'application/vnd.ecowin.chart',
        'man': 'application/x-troff-man',
        'map': 'application/x-navimap',
        'mar': 'text/plain',
        'mathml': 'application/mathml+xml',
        'mbd': 'application/mbedlet',
        'mbk': 'application/vnd.mobius.mbk',
        'mbox': 'application/mbox',
        'mc$': 'application/x-magic-cap-package-1.0',
        'mc1': 'application/vnd.medcalcdata',
        'mcd': ['application/mcad', 'application/vnd.mcd', 'application/x-mathcad'],
        'mcf': ['image/vasa', 'text/mcf'],
        'mcp': 'application/netmc',
        'mcurl': 'text/vnd.curl.mcurl',
        'mdb': 'application/x-msaccess',
        'mdi': 'image/vnd.ms-modi',
        'me': 'application/x-troff-me',
        'meta4': 'application/metalink4+xml',
        'mets': 'application/mets+xml',
        'mfm': 'application/vnd.mfmp',
        'mgp': 'application/vnd.osgeo.mapguide.package',
        'mgz': 'application/vnd.proteus.magazine',
        'mht': 'message/rfc822',
        'mhtml': 'message/rfc822',
        'mid': ['audio/mid', 'audio/midi', 'music/crescendo', 'x-music/x-midi', 'audio/x-midi', 'application/x-midi', 'audio/x-mid'],
        'midi': ['audio/midi', 'music/crescendo', 'x-music/x-midi', 'audio/x-midi', 'application/x-midi', 'audio/x-mid'],
        'mif': ['application/vnd.mif', 'application/x-mif', 'application/x-frame'],
        'mime': ['message/rfc822', 'www/mime'],
        'mj2': 'video/mj2',
        'mjf': 'audio/x-vnd.audioexplosion.mjuicemediafile',
        'mjpg': 'video/x-motion-jpeg',
        'mlp': 'application/vnd.dolby.mlp',
        'mm': ['application/base64', 'application/x-meme'],
        'mmd': 'application/vnd.chipnuts.karaoke-mmd',
        'mme': 'application/base64',
        'mmf': 'application/vnd.smaf',
        'mmr': 'image/vnd.fujixerox.edmics-mmr',
        'mny': 'application/x-msmoney',
        'mod': ['audio/mod', 'audio/x-mod'],
        'mods': 'application/mods+xml',
        'moov': 'video/quicktime',
        'mov': 'video/quicktime',
        'movie': 'video/x-sgi-movie',
        'mp2': ['video/mpeg', 'audio/mpeg', 'video/x-mpeg', 'audio/x-mpeg', 'video/x-mpeq2a'],
        'mp3': ['audio/mpeg', 'audio/mpeg3', 'video/mpeg', 'audio/x-mpeg-3', 'video/x-mpeg'],
        'mp4': ['video/mp4', 'application/mp4'],
        'mp4a': 'audio/mp4',
        'mpa': ['video/mpeg', 'audio/mpeg'],
        'mpc': ['application/vnd.mophun.certificate', 'application/x-project'],
        'mpe': 'video/mpeg',
        'mpeg': 'video/mpeg',
        'mpg': ['video/mpeg', 'audio/mpeg'],
        'mpga': 'audio/mpeg',
        'mpkg': 'application/vnd.apple.installer+xml',
        'mpm': 'application/vnd.blueice.multipass',
        'mpn': 'application/vnd.mophun.application',
        'mpp': 'application/vnd.ms-project',
        'mpt': 'application/x-project',
        'mpv': 'application/x-project',
        'mpv2': 'video/mpeg',
        'mpx': 'application/x-project',
        'mpy': 'application/vnd.ibm.minipay',
        'mqy': 'application/vnd.mobius.mqy',
        'mrc': 'application/marc',
        'mrcx': 'application/marcxml+xml',
        'ms': 'application/x-troff-ms',
        'mscml': 'application/mediaservercontrol+xml',
        'mseq': 'application/vnd.mseq',
        'msf': 'application/vnd.epson.msf',
        'msg': 'application/vnd.ms-outlook',
        'msh': 'model/mesh',
        'msl': 'application/vnd.mobius.msl',
        'msty': 'application/vnd.muvee.style',
        'mts': 'model/vnd.mts',
        'mus': 'application/vnd.musician',
        'musicxml': 'application/vnd.recordare.musicxml+xml',
        'mv': 'video/x-sgi-movie',
        'mvb': 'application/x-msmediaview',
        'mwf': 'application/vnd.mfer',
        'mxf': 'application/mxf',
        'mxl': 'application/vnd.recordare.musicxml',
        'mxml': 'application/xv+xml',
        'mxs': 'application/vnd.triscape.mxs',
        'mxu': 'video/vnd.mpegurl',
        'my': 'audio/make',
        'mzz': 'application/x-vnd.audioexplosion.mzz',
        'n-gage': 'application/vnd.nokia.n-gage.symbian.install',
        'n3': 'text/n3',
        'nap': 'image/naplps',
        'naplps': 'image/naplps',
        'nbp': 'application/vnd.wolfram.player',
        'nc': 'application/x-netcdf',
        'ncm': 'application/vnd.nokia.configuration-message',
        'ncx': 'application/x-dtbncx+xml',
        'ngdat': 'application/vnd.nokia.n-gage.data',
        'nif': 'image/x-niff',
        'niff': 'image/x-niff',
        'nix': 'application/x-mix-transfer',
        'nlu': 'application/vnd.neurolanguage.nlu',
        'nml': 'application/vnd.enliven',
        'nnd': 'application/vnd.noblenet-directory',
        'nns': 'application/vnd.noblenet-sealer',
        'nnw': 'application/vnd.noblenet-web',
        'npx': 'image/vnd.net-fpx',
        'nsc': 'application/x-conference',
        'nsf': 'application/vnd.lotus-notes',
        'nvd': 'application/x-navidoc',
        'nws': 'message/rfc822',
        'o': 'application/octet-stream',
        'oa2': 'application/vnd.fujitsu.oasys2',
        'oa3': 'application/vnd.fujitsu.oasys3',
        'oas': 'application/vnd.fujitsu.oasys',
        'obd': 'application/x-msbinder',
        'oda': 'application/oda',
        'odb': 'application/vnd.oasis.opendocument.database',
        'odc': 'application/vnd.oasis.opendocument.chart',
        'odf': 'application/vnd.oasis.opendocument.formula',
        'odft': 'application/vnd.oasis.opendocument.formula-template',
        'odg': 'application/vnd.oasis.opendocument.graphics',
        'odi': 'application/vnd.oasis.opendocument.image',
        'odm': 'application/vnd.oasis.opendocument.text-master',
        'odp': 'application/vnd.oasis.opendocument.presentation',
        'ods': 'application/vnd.oasis.opendocument.spreadsheet',
        'odt': 'application/vnd.oasis.opendocument.text',
        'oga': 'audio/ogg',
        'ogv': 'video/ogg',
        'ogx': 'application/ogg',
        'omc': 'application/x-omc',
        'omcd': 'application/x-omcdatamaker',
        'omcr': 'application/x-omcregerator',
        'onetoc': 'application/onenote',
        'opf': 'application/oebps-package+xml',
        'org': 'application/vnd.lotus-organizer',
        'osf': 'application/vnd.yamaha.openscoreformat',
        'osfpvg': 'application/vnd.yamaha.openscoreformat.osfpvg+xml',
        'otc': 'application/vnd.oasis.opendocument.chart-template',
        'otf': 'application/x-font-otf',
        'otg': 'application/vnd.oasis.opendocument.graphics-template',
        'oth': 'application/vnd.oasis.opendocument.text-web',
        'oti': 'application/vnd.oasis.opendocument.image-template',
        'otp': 'application/vnd.oasis.opendocument.presentation-template',
        'ots': 'application/vnd.oasis.opendocument.spreadsheet-template',
        'ott': 'application/vnd.oasis.opendocument.text-template',
        'oxt': 'application/vnd.openofficeorg.extension',
        'p': 'text/x-pascal',
        'p10': ['application/pkcs10', 'application/x-pkcs10'],
        'p12': ['application/pkcs-12', 'application/x-pkcs12'],
        'p7a': 'application/x-pkcs7-signature',
        'p7b': 'application/x-pkcs7-certificates',
        'p7c': ['application/pkcs7-mime', 'application/x-pkcs7-mime'],
        'p7m': ['application/pkcs7-mime', 'application/x-pkcs7-mime'],
        'p7r': 'application/x-pkcs7-certreqresp',
        'p7s': ['application/pkcs7-signature', 'application/x-pkcs7-signature'],
        'p8': 'application/pkcs8',
        'par': 'text/plain-bas',
        'part': 'application/pro_eng',
        'pas': 'text/pascal',
        'paw': 'application/vnd.pawaafile',
        'pbd': 'application/vnd.powerbuilder6',
        'pbm': 'image/x-portable-bitmap',
        'pcf': 'application/x-font-pcf',
        'pcl': ['application/vnd.hp-pcl', 'application/x-pcl'],
        'pclxl': 'application/vnd.hp-pclxl',
        'pct': 'image/x-pict',
        'pcurl': 'application/vnd.curl.pcurl',
        'pcx': 'image/x-pcx',
        'pdb': ['application/vnd.palm', 'chemical/x-pdb'],
        'pdf': 'application/pdf',
        'pfa': 'application/x-font-type1',
        'pfr': 'application/font-tdpfr',
        'pfunk': ['audio/make', 'audio/make.my.funk'],
        'pfx': 'application/x-pkcs12',
        'pgm': ['image/x-portable-graymap', 'image/x-portable-greymap'],
        'pgn': 'application/x-chess-pgn',
        'pgp': 'application/pgp-signature',
        'pic': ['image/pict', 'image/x-pict'],
        'pict': 'image/pict',
        'pkg': 'application/x-newton-compatible-pkg',
        'pki': 'application/pkixcmp',
        'pkipath': 'application/pkix-pkipath',
        'pko': ['application/ynd.ms-pkipko', 'application/vnd.ms-pki.pko'],
        'pl': ['text/plain', 'text/x-script.perl'],
        'plb': 'application/vnd.3gpp.pic-bw-large',
        'plc': 'application/vnd.mobius.plc',
        'plf': 'application/vnd.pocketlearn',
        'pls': 'application/pls+xml',
        'plx': 'application/x-pixclscript',
        'pm': ['text/x-script.perl-module', 'image/x-xpixmap'],
        'pm4': 'application/x-pagemaker',
        'pm5': 'application/x-pagemaker',
        'pma': 'application/x-perfmon',
        'pmc': 'application/x-perfmon',
        'pml': ['application/vnd.ctc-posml', 'application/x-perfmon'],
        'pmr': 'application/x-perfmon',
        'pmw': 'application/x-perfmon',
        'png': 'image/png',
        'pnm': ['application/x-portable-anymap', 'image/x-portable-anymap'],
        'portpkg': 'application/vnd.macports.portpkg',
        'pot': ['application/vnd.ms-powerpoint', 'application/mspowerpoint'],
        'potm': 'application/vnd.ms-powerpoint.template.macroenabled.12',
        'potx': 'application/vnd.openxmlformats-officedocument.presentationml.template',
        'pov': 'model/x-pov',
        'ppa': 'application/vnd.ms-powerpoint',
        'ppam': 'application/vnd.ms-powerpoint.addin.macroenabled.12',
        'ppd': 'application/vnd.cups-ppd',
        'ppm': 'image/x-portable-pixmap',
        'pps': ['application/vnd.ms-powerpoint', 'application/mspowerpoint'],
        'ppsm': 'application/vnd.ms-powerpoint.slideshow.macroenabled.12',
        'ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
        'ppt': ['application/vnd.ms-powerpoint', 'application/mspowerpoint', 'application/powerpoint', 'application/x-mspowerpoint'],
        'pptm': 'application/vnd.ms-powerpoint.presentation.macroenabled.12',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'ppz': 'application/mspowerpoint',
        'prc': 'application/x-mobipocket-ebook',
        'pre': ['application/vnd.lotus-freelance', 'application/x-freelance'],
        'prf': 'application/pics-rules',
        'prt': 'application/pro_eng',
        'ps': 'application/postscript',
        'psb': 'application/vnd.3gpp.pic-bw-small',
        'psd': ['application/octet-stream', 'image/vnd.adobe.photoshop'],
        'psf': 'application/x-font-linux-psf',
        'pskcxml': 'application/pskc+xml',
        'ptid': 'application/vnd.pvi.ptid1',
        'pub': 'application/x-mspublisher',
        'pvb': 'application/vnd.3gpp.pic-bw-var',
        'pvu': 'paleovu/x-pv',
        'pwn': 'application/vnd.3m.post-it-notes',
        'pwz': 'application/vnd.ms-powerpoint',
        'py': 'text/x-script.phyton',
        'pya': 'audio/vnd.ms-playready.media.pya',
        'pyc': 'applicaiton/x-bytecode.python',
        'pyv': 'video/vnd.ms-playready.media.pyv',
        'qam': 'application/vnd.epson.quickanime',
        'qbo': 'application/vnd.intu.qbo',
        'qcp': 'audio/vnd.qcelp',
        'qd3': 'x-world/x-3dmf',
        'qd3d': 'x-world/x-3dmf',
        'qfx': 'application/vnd.intu.qfx',
        'qif': 'image/x-quicktime',
        'qps': 'application/vnd.publishare-delta-tree',
        'qt': 'video/quicktime',
        'qtc': 'video/x-qtc',
        'qti': 'image/x-quicktime',
        'qtif': 'image/x-quicktime',
        'qxd': 'application/vnd.quark.quarkxpress',
        'ra': ['audio/x-realaudio', 'audio/x-pn-realaudio', 'audio/x-pn-realaudio-plugin'],
        'ram': 'audio/x-pn-realaudio',
        'rar': 'application/x-rar-compressed',
        'ras': ['image/cmu-raster', 'application/x-cmu-raster', 'image/x-cmu-raster'],
        'rast': 'image/cmu-raster',
        'rcprofile': 'application/vnd.ipunplugged.rcprofile',
        'rdf': 'application/rdf+xml',
        'rdz': 'application/vnd.data-vision.rdz',
        'rep': 'application/vnd.businessobjects',
        'res': 'application/x-dtbresource+xml',
        'rexx': 'text/x-script.rexx',
        'rf': 'image/vnd.rn-realflash',
        'rgb': 'image/x-rgb',
        'rif': 'application/reginfo+xml',
        'rip': 'audio/vnd.rip',
        'rl': 'application/resource-lists+xml',
        'rlc': 'image/vnd.fujixerox.edmics-rlc',
        'rld': 'application/resource-lists-diff+xml',
        'rm': ['application/vnd.rn-realmedia', 'audio/x-pn-realaudio'],
        'rmi': 'audio/mid',
        'rmm': 'audio/x-pn-realaudio',
        'rmp': ['audio/x-pn-realaudio-plugin', 'audio/x-pn-realaudio'],
        'rms': 'application/vnd.jcp.javame.midlet-rms',
        'rnc': 'application/relax-ng-compact-syntax',
        'rng': ['application/ringing-tones', 'application/vnd.nokia.ringing-tone'],
        'rnx': 'application/vnd.rn-realplayer',
        'roff': 'application/x-troff',
        'rp': 'image/vnd.rn-realpix',
        'rp9': 'application/vnd.cloanto.rp9',
        'rpm': 'audio/x-pn-realaudio-plugin',
        'rpss': 'application/vnd.nokia.radio-presets',
        'rpst': 'application/vnd.nokia.radio-preset',
        'rq': 'application/sparql-query',
        'rs': 'application/rls-services+xml',
        'rsd': 'application/rsd+xml',
        'rt': ['text/richtext', 'text/vnd.rn-realtext'],
        'rtf': ['application/rtf', 'text/richtext', 'application/x-rtf'],
        'rtx': ['text/richtext', 'application/rtf'],
        'rv': 'video/vnd.rn-realvideo',
        's': 'text/x-asm',
        's3m': 'audio/s3m',
        'saf': 'application/vnd.yamaha.smaf-audio',
        'saveme': 'application/octet-stream',
        'sbk': 'application/x-tbook',
        'sbml': 'application/sbml+xml',
        'sc': 'application/vnd.ibm.secure-container',
        'scd': 'application/x-msschedule',
        'scm': ['application/vnd.lotus-screencam', 'video/x-scm', 'text/x-script.guile', 'application/x-lotusscreencam', 'text/x-script.scheme'],
        'scq': 'application/scvp-cv-request',
        'scs': 'application/scvp-cv-response',
        'sct': 'text/scriptlet',
        'scurl': 'text/vnd.curl.scurl',
        'sda': 'application/vnd.stardivision.draw',
        'sdc': 'application/vnd.stardivision.calc',
        'sdd': 'application/vnd.stardivision.impress',
        'sdkm': 'application/vnd.solent.sdkm+xml',
        'sdml': 'text/plain',
        'sdp': ['application/sdp', 'application/x-sdp'],
        'sdr': 'application/sounder',
        'sdw': 'application/vnd.stardivision.writer',
        'sea': ['application/sea', 'application/x-sea'],
        'see': 'application/vnd.seemail',
        'seed': 'application/vnd.fdsn.seed',
        'sema': 'application/vnd.sema',
        'semd': 'application/vnd.semd',
        'semf': 'application/vnd.semf',
        'ser': 'application/java-serialized-object',
        'set': 'application/set',
        'setpay': 'application/set-payment-initiation',
        'setreg': 'application/set-registration-initiation',
        'sfd-hdstx': 'application/vnd.hydrostatix.sof-data',
        'sfs': 'application/vnd.spotfire.sfs',
        'sgl': 'application/vnd.stardivision.writer-global',
        'sgm': ['text/sgml', 'text/x-sgml'],
        'sgml': ['text/sgml', 'text/x-sgml'],
        'sh': ['application/x-shar', 'application/x-bsh', 'application/x-sh', 'text/x-script.sh'],
        'shar': ['application/x-bsh', 'application/x-shar'],
        'shf': 'application/shf+xml',
        'shtml': ['text/html', 'text/x-server-parsed-html'],
        'sid': 'audio/x-psid',
        'sis': 'application/vnd.symbian.install',
        'sit': ['application/x-stuffit', 'application/x-sit'],
        'sitx': 'application/x-stuffitx',
        'skd': 'application/x-koan',
        'skm': 'application/x-koan',
        'skp': ['application/vnd.koan', 'application/x-koan'],
        'skt': 'application/x-koan',
        'sl': 'application/x-seelogo',
        'sldm': 'application/vnd.ms-powerpoint.slide.macroenabled.12',
        'sldx': 'application/vnd.openxmlformats-officedocument.presentationml.slide',
        'slt': 'application/vnd.epson.salt',
        'sm': 'application/vnd.stepmania.stepchart',
        'smf': 'application/vnd.stardivision.math',
        'smi': ['application/smil', 'application/smil+xml'],
        'smil': 'application/smil',
        'snd': ['audio/basic', 'audio/x-adpcm'],
        'snf': 'application/x-font-snf',
        'sol': 'application/solids',
        'spc': ['text/x-speech', 'application/x-pkcs7-certificates'],
        'spf': 'application/vnd.yamaha.smaf-phrase',
        'spl': ['application/futuresplash', 'application/x-futuresplash'],
        'spot': 'text/vnd.in3d.spot',
        'spp': 'application/scvp-vp-response',
        'spq': 'application/scvp-vp-request',
        'spr': 'application/x-sprite',
        'sprite': 'application/x-sprite',
        'src': 'application/x-wais-source',
        'sru': 'application/sru+xml',
        'srx': 'application/sparql-results+xml',
        'sse': 'application/vnd.kodak-descriptor',
        'ssf': 'application/vnd.epson.ssf',
        'ssi': 'text/x-server-parsed-html',
        'ssm': 'application/streamingmedia',
        'ssml': 'application/ssml+xml',
        'sst': ['application/vnd.ms-pkicertstore', 'application/vnd.ms-pki.certstore'],
        'st': 'application/vnd.sailingtracker.track',
        'stc': 'application/vnd.sun.xml.calc.template',
        'std': 'application/vnd.sun.xml.draw.template',
        'step': 'application/step',
        'stf': 'application/vnd.wt.stf',
        'sti': 'application/vnd.sun.xml.impress.template',
        'stk': 'application/hyperstudio',
        'stl': ['application/vnd.ms-pkistl', 'application/sla', 'application/vnd.ms-pki.stl', 'application/x-navistyle'],
        'stm': 'text/html',
        'stp': 'application/step',
        'str': 'application/vnd.pg.format',
        'stw': 'application/vnd.sun.xml.writer.template',
        'sub': 'image/vnd.dvb.subtitle',
        'sus': 'application/vnd.sus-calendar',
        'sv4cpio': 'application/x-sv4cpio',
        'sv4crc': 'application/x-sv4crc',
        'svc': 'application/vnd.dvb.service',
        'svd': 'application/vnd.svd',
        'svf': ['image/vnd.dwg', 'image/x-dwg'],
        'svg': 'image/svg+xml',
        'svr': ['x-world/x-svr', 'application/x-world'],
        'swf': 'application/x-shockwave-flash',
        'swi': 'application/vnd.aristanetworks.swi',
        'sxc': 'application/vnd.sun.xml.calc',
        'sxd': 'application/vnd.sun.xml.draw',
        'sxg': 'application/vnd.sun.xml.writer.global',
        'sxi': 'application/vnd.sun.xml.impress',
        'sxm': 'application/vnd.sun.xml.math',
        'sxw': 'application/vnd.sun.xml.writer',
        't': ['text/troff', 'application/x-troff'],
        'talk': 'text/x-speech',
        'tao': 'application/vnd.tao.intent-module-archive',
        'tar': 'application/x-tar',
        'tbk': ['application/toolbook', 'application/x-tbook'],
        'tcap': 'application/vnd.3gpp2.tcap',
        'tcl': ['text/x-script.tcl', 'application/x-tcl'],
        'tcsh': 'text/x-script.tcsh',
        'teacher': 'application/vnd.smart.teacher',
        'tei': 'application/tei+xml',
        'tex': 'application/x-tex',
        'texi': 'application/x-texinfo',
        'texinfo': 'application/x-texinfo',
        'text': ['application/plain', 'text/plain'],
        'tfi': 'application/thraud+xml',
        'tfm': 'application/x-tex-tfm',
        'tgz': ['application/gnutar', 'application/x-compressed'],
        'thmx': 'application/vnd.ms-officetheme',
        'tif': ['image/tiff', 'image/x-tiff'],
        'tiff': ['image/tiff', 'image/x-tiff'],
        'tmo': 'application/vnd.tmobile-livetv',
        'torrent': 'application/x-bittorrent',
        'tpl': 'application/vnd.groove-tool-template',
        'tpt': 'application/vnd.trid.tpt',
        'tr': 'application/x-troff',
        'tra': 'application/vnd.trueapp',
        'trm': 'application/x-msterminal',
        'tsd': 'application/timestamped-data',
        'tsi': 'audio/tsp-audio',
        'tsp': ['application/dsptype', 'audio/tsplayer'],
        'tsv': 'text/tab-separated-values',
        'ttf': 'application/x-font-ttf',
        'ttl': 'text/turtle',
        'turbot': 'image/florian',
        'twd': 'application/vnd.simtech-mindmapper',
        'txd': 'application/vnd.genomatix.tuxedo',
        'txf': 'application/vnd.mobius.txf',
        'txt': 'text/plain',
        'ufd': 'application/vnd.ufdl',
        'uil': 'text/x-uil',
        'uls': 'text/iuls',
        'umj': 'application/vnd.umajin',
        'uni': 'text/uri-list',
        'unis': 'text/uri-list',
        'unityweb': 'application/vnd.unity',
        'unv': 'application/i-deas',
        'uoml': 'application/vnd.uoml+xml',
        'uri': 'text/uri-list',
        'uris': 'text/uri-list',
        'ustar': ['application/x-ustar', 'multipart/x-ustar'],
        'utz': 'application/vnd.uiq.theme',
        'uu': ['application/octet-stream', 'text/x-uuencode'],
        'uue': 'text/x-uuencode',
        'uva': 'audio/vnd.dece.audio',
        'uvh': 'video/vnd.dece.hd',
        'uvi': 'image/vnd.dece.graphic',
        'uvm': 'video/vnd.dece.mobile',
        'uvp': 'video/vnd.dece.pd',
        'uvs': 'video/vnd.dece.sd',
        'uvu': 'video/vnd.uvvu.mp4',
        'uvv': 'video/vnd.dece.video',
        'vcd': 'application/x-cdlink',
        'vcf': 'text/x-vcard',
        'vcg': 'application/vnd.groove-vcard',
        'vcs': 'text/x-vcalendar',
        'vcx': 'application/vnd.vcx',
        'vda': 'application/vda',
        'vdo': 'video/vdo',
        'vew': 'application/groupwise',
        'vis': 'application/vnd.visionary',
        'viv': ['video/vivo', 'video/vnd.vivo'],
        'vivo': ['video/vivo', 'video/vnd.vivo'],
        'vmd': 'application/vocaltec-media-desc',
        'vmf': 'application/vocaltec-media-file',
        'voc': ['audio/voc', 'audio/x-voc'],
        'vos': 'video/vosaic',
        'vox': 'audio/voxware',
        'vqe': 'audio/x-twinvq-plugin',
        'vqf': 'audio/x-twinvq',
        'vql': 'audio/x-twinvq-plugin',
        'vrml': ['model/vrml', 'x-world/x-vrml', 'application/x-vrml'],
        'vrt': 'x-world/x-vrt',
        'vsd': ['application/vnd.visio', 'application/x-visio'],
        'vsf': 'application/vnd.vsf',
        'vst': 'application/x-visio',
        'vsw': 'application/x-visio',
        'vtu': 'model/vnd.vtu',
        'vxml': 'application/voicexml+xml',
        'w60': 'application/wordperfect6.0',
        'w61': 'application/wordperfect6.1',
        'w6w': 'application/msword',
        'wad': 'application/x-doom',
        'wav': ['audio/wav', 'audio/x-wav'],
        'wax': 'audio/x-ms-wax',
        'wb1': 'application/x-qpro',
        'wbmp': 'image/vnd.wap.wbmp',
        'wbs': 'application/vnd.criticaltools.wbs+xml',
        'wbxml': 'application/vnd.wap.wbxml',
        'wcm': 'application/vnd.ms-works',
        'wdb': 'application/vnd.ms-works',
        'web': 'application/vnd.xara',
        'weba': 'audio/webm',
        'webm': 'video/webm',
        'webp': 'image/webp',
        'wg': 'application/vnd.pmi.widget',
        'wgt': 'application/widget',
        'wiz': 'application/msword',
        'wk1': 'application/x-123',
        'wks': 'application/vnd.ms-works',
        'wm': 'video/x-ms-wm',
        'wma': 'audio/x-ms-wma',
        'wmd': 'application/x-ms-wmd',
        'wmf': ['windows/metafile', 'application/x-msmetafile'],
        'wml': 'text/vnd.wap.wml',
        'wmlc': 'application/vnd.wap.wmlc',
        'wmls': 'text/vnd.wap.wmlscript',
        'wmlsc': 'application/vnd.wap.wmlscriptc',
        'wmv': 'video/x-ms-wmv',
        'wmx': 'video/x-ms-wmx',
        'wmz': 'application/x-ms-wmz',
        'woff': 'application/x-font-woff',
        'word': 'application/msword',
        'wp': 'application/wordperfect',
        'wp5': ['application/wordperfect', 'application/wordperfect6.0'],
        'wp6': 'application/wordperfect',
        'wpd': ['application/wordperfect', 'application/vnd.wordperfect', 'application/x-wpwin'],
        'wpl': 'application/vnd.ms-wpl',
        'wps': 'application/vnd.ms-works',
        'wq1': 'application/x-lotus',
        'wqd': 'application/vnd.wqd',
        'wri': ['application/mswrite', 'application/x-wri', 'application/x-mswrite'],
        'wrl': ['model/vrml', 'x-world/x-vrml', 'application/x-world'],
        'wrz': ['model/vrml', 'x-world/x-vrml'],
        'wsc': 'text/scriplet',
        'wsdl': 'application/wsdl+xml',
        'wspolicy': 'application/wspolicy+xml',
        'wsrc': 'application/x-wais-source',
        'wtb': 'application/vnd.webturbo',
        'wtk': 'application/x-wintalk',
        'wvx': 'video/x-ms-wvx',
        'x-png': 'image/png',
        'x3d': 'application/vnd.hzn-3d-crossword',
        'xaf': 'x-world/x-vrml',
        'xap': 'application/x-silverlight-app',
        'xar': 'application/vnd.xara',
        'xbap': 'application/x-ms-xbap',
        'xbd': 'application/vnd.fujixerox.docuworks.binder',
        'xbm': ['image/xbm', 'image/x-xbm', 'image/x-xbitmap'],
        'xdf': 'application/xcap-diff+xml',
        'xdm': 'application/vnd.syncml.dm+xml',
        'xdp': 'application/vnd.adobe.xdp+xml',
        'xdr': 'video/x-amt-demorun',
        'xdssc': 'application/dssc+xml',
        'xdw': 'application/vnd.fujixerox.docuworks',
        'xenc': 'application/xenc+xml',
        'xer': 'application/patch-ops-error+xml',
        'xfdf': 'application/vnd.adobe.xfdf',
        'xfdl': 'application/vnd.xfdl',
        'xgz': 'xgl/drawing',
        'xhtml': 'application/xhtml+xml',
        'xif': 'image/vnd.xiff',
        'xl': 'application/excel',
        'xla': ['application/vnd.ms-excel', 'application/excel', 'application/x-msexcel', 'application/x-excel'],
        'xlam': 'application/vnd.ms-excel.addin.macroenabled.12',
        'xlb': ['application/excel', 'application/vnd.ms-excel', 'application/x-excel'],
        'xlc': ['application/vnd.ms-excel', 'application/excel', 'application/x-excel'],
        'xld': ['application/excel', 'application/x-excel'],
        'xlk': ['application/excel', 'application/x-excel'],
        'xll': ['application/excel', 'application/vnd.ms-excel', 'application/x-excel'],
        'xlm': ['application/vnd.ms-excel', 'application/excel', 'application/x-excel'],
        'xls': ['application/vnd.ms-excel', 'application/excel', 'application/x-msexcel', 'application/x-excel'],
        'xlsb': 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
        'xlsm': 'application/vnd.ms-excel.sheet.macroenabled.12',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xlt': ['application/vnd.ms-excel', 'application/excel', 'application/x-excel'],
        'xltm': 'application/vnd.ms-excel.template.macroenabled.12',
        'xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
        'xlv': ['application/excel', 'application/x-excel'],
        'xlw': ['application/vnd.ms-excel', 'application/excel', 'application/x-msexcel', 'application/x-excel'],
        'xm': 'audio/xm',
        'xml': ['application/xml', 'text/xml', 'application/atom+xml', 'application/rss+xml'],
        'xmz': 'xgl/movie',
        'xo': 'application/vnd.olpc-sugar',
        'xof': 'x-world/x-vrml',
        'xop': 'application/xop+xml',
        'xpi': 'application/x-xpinstall',
        'xpix': 'application/x-vnd.ls-xpix',
        'xpm': ['image/xpm', 'image/x-xpixmap'],
        'xpr': 'application/vnd.is-xpr',
        'xps': 'application/vnd.ms-xpsdocument',
        'xpw': 'application/vnd.intercon.formnet',
        'xslt': 'application/xslt+xml',
        'xsm': 'application/vnd.syncml+xml',
        'xspf': 'application/xspf+xml',
        'xsr': 'video/x-amt-showrun',
        'xul': 'application/vnd.mozilla.xul+xml',
        'xwd': ['image/x-xwd', 'image/x-xwindowdump'],
        'xyz': ['chemical/x-xyz', 'chemical/x-pdb'],
        'yang': 'application/yang',
        'yin': 'application/yin+xml',
        'z': ['application/x-compressed', 'application/x-compress'],
        'zaz': 'application/vnd.zzazz.deck+xml',
        'zip': ['application/zip', 'multipart/x-zip', 'application/x-zip-compressed', 'application/x-compressed'],
        'zir': 'application/vnd.zul',
        'zmm': 'application/vnd.handheld-entertainment+xml',
        'zoo': 'application/octet-stream',
        'zsh': 'text/x-script.zsh'
    };

    return {
        detectExtension: detectExtension,
        detectMimeType: detectMimeType
    };
}));
// Copyright (c) 2010-2011 Konstantin Käfer

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
        define('utf7',factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.utf7 = factory();
    }
}(this, function() {
    

    function encode(str) {
        var b = new Uint8Array(str.length * 2),
            octets = '',
            i, bi, len, c, encoded;

        for (i = 0, bi = 0, len = str.length; i < len; i++) {
            // Note that we can't simply convert a UTF-8 string to Base64 because
            // UTF-8 uses a different encoding. In modified UTF-7, all characters
            // are represented by their two byte Unicode ID.
            c = str.charCodeAt(i);
            // Upper 8 bits shifted into lower 8 bits so that they fit into 1 byte.
            b[bi++] = c >> 8;
            // Lower 8 bits. Cut off the upper 8 bits so that they fit into 1 byte.
            b[bi++] = c & 0xFF;
        }

        // Convert b:Uint8Array to a binary string
        for (i = 0, len = b.length; i < len; i++) {
            octets += String.fromCharCode(b[i]);
        }

        // Modified Base64 uses , instead of / and omits trailing =.
        encoded = '';
        if (typeof window !== 'undefined' && btoa) {
            encoded = btoa(octets);
        } else {
            encoded = (new Buffer(octets, "binary")).toString("base64");
        }
        return encoded.replace(/=+$/, '');
    }

    /**
     * Safe base64 decoding. Does not throw on unexpected input.
     *
     * Implementation from the MDN docs:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
     * (MDN code samples are MIT licensed)
     *
     * @param {String} base64Str Base64 encoded string
     * @returns {Uint8Array} Decoded binary blob
     */
    function base64toTypedArray(base64Str) {
        var bitsSoFar = 0;
        var validBits = 0;
        var iOut = 0;
        var arr = new Uint8Array(Math.ceil(base64Str.length * 3 / 4));
        var c;
        var bits;

        for (var i = 0, len = base64Str.length; i < len; i++) {
            c = base64Str.charCodeAt(i);
            if (c >= 0x41 && c <= 0x5a) { // [A-Z]
                bits = c - 0x41;
            } else if (c >= 0x61 && c <= 0x7a) { // [a-z]
                bits = c - 0x61 + 0x1a;
            } else if (c >= 0x30 && c <= 0x39) { // [0-9]
                bits = c - 0x30 + 0x34;
            } else if (c === 0x2b) { // +
                bits = 0x3e;
            } else if (c === 0x2f) { // /
                bits = 0x3f;
            } else if (c === 0x3d) { // =
                validBits = 0;
                continue;
            } else {
                // ignore all other characters!
                continue;
            }
            bitsSoFar = (bitsSoFar << 6) | bits;
            validBits += 6;
            if (validBits >= 8) {
                validBits -= 8;
                arr[iOut++] = bitsSoFar >> validBits;
                if (validBits === 2) {
                    bitsSoFar &= 0x03;
                } else if (validBits === 4) {
                    bitsSoFar &= 0x0f;
                }
            }
        }

        if (iOut < arr.length) {
            return arr.subarray(0, iOut);
        }
        return arr;
    }

    function decode(str) {
        var octets = base64toTypedArray(str),
            r = [];

        for (var i = 0, len = octets.length; i < len;) {
            // Calculate charcode from two adjacent bytes.
            r.push(String.fromCharCode(octets[i++] << 8 | octets[i++]));
        }
        return r.join('');
    }

    // Escape RegEx from http://simonwillison.net/2006/Jan/20/escape/
    function escape(chars) {
        return chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    // Character classes defined by RFC 2152.
    var setD = 'A-Za-z0-9' + escape('\'(),-./:?'),
        setO = escape('!"#$%&*;<=>@[]^_\'{|}'),
        setW = escape(' \r\n\t'),

        // Stores compiled regexes for various replacement pattern.
        regexes = {},
        regexAll = new RegExp('[^' + setW + setD + setO + ']+', 'g');

    return {
        // RFC 2152 UTF-7 encoding.
        encode: function(str, mask) {
            // Generate a RegExp object from the string of mask characters.
            if (!mask) {
                mask = '';
            }
            if (!regexes[mask]) {
                regexes[mask] = new RegExp('[^' + setD + escape(mask) + ']+', 'g');
            }

            // We replace subsequent disallowed chars with their escape sequence.
            return str.replace(regexes[mask], function(chunk) {
                // + is represented by an empty sequence +-, otherwise call encode().
                return '+' + (chunk === '+' ? '' : encode(chunk)) + '-';
            });
        },

        // RFC 2152 UTF-7 encoding with all optionals.
        encodeAll: function(str) {
            // We replace subsequent disallowed chars with their escape sequence.
            return str.replace(regexAll, function(chunk) {
                // + is represented by an empty sequence +-, otherwise call encode().
                return '+' + (chunk === '+' ? '' : encode(chunk)) + '-';
            });
        },

        // RFC 2152 UTF-7 decoding.
        decode: function(str) {
            return str.replace(/\+([A-Za-z0-9\/]*)-?/gi, function(_, chunk) {
                // &- represents &.
                if (chunk === '') {
                    return '+';
                }
                return decode(chunk);
            });
        },

        imap: {
            // RFC 3501, section 5.1.3 UTF-7 encoding.
            encode: function(str) {
                // All printable ASCII chars except for & must be represented by themselves.
                // We replace subsequent non-representable chars with their escape sequence.
                return str.replace(/&/g, '&-').replace(/[^\x20-\x7e]+/g, function(chunk) {
                    // & is represented by an empty sequence &-, otherwise call encode().
                    chunk = (chunk === '&' ? '' : encode(chunk)).replace(/\//g, ',');
                    return '&' + chunk + '-';
                });
            },

            // RFC 3501, section 5.1.3 UTF-7 decoding.
            decode: function(str) {
                return str.replace(/&([^-]*)-/g, function(_, chunk) {
                    // &- represents &.
                    if (chunk === '') {
                        return '&';
                    }
                    return decode(chunk.replace(/,/g, '/'));
                });
            }
        }
    };
}));

/**
 * This TextEncoder and TextDecoder are used by MimeParser. In
 * addition to their standard behavior, we also support decoding utf-7.
 */
define('stringencoding',['require','utf7','mimefuncs'],function(require) {
  var utf7 = require('utf7');
  return {
    TextEncoder: function(encoding) {
      var encoder = new TextEncoder(encoding);
      this.encode = encoder.encode.bind(encoder);
    },
    TextDecoder: function(encoding) {
      encoding = encoding && encoding.toLowerCase();
      if (encoding === 'utf-7' || encoding === 'utf7') {
        this.decode = function(buf) {
          var mimefuncs = require('mimefuncs');
          return utf7.decode(mimefuncs.fromTypedArray(buf));
        };
      } else {
        var decoder = new TextDecoder(encoding);
        this.decode = decoder.decode.bind(decoder)
      }
    }
  };
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
    

    var encoding;

    if (typeof define === 'function' && define.amd) {
        // amd for browser
        define('mimefuncs',['stringencoding'], function(encoding) {
            return factory(encoding.TextEncoder, encoding.TextDecoder, root.btoa);
        });
    } else if (typeof exports === 'object' && typeof navigator !== 'undefined') {
        // common.js for browser
        encoding = require('wo-stringencoding');
        module.exports = factory(encoding.TextEncoder, encoding.TextDecoder, root.btoa);
    } else if (typeof exports === 'object') {
        // common.js for node.js
        encoding = require('wo-stringencoding');
        module.exports = factory(encoding.TextEncoder, encoding.TextDecoder, function(str) {
            var NodeBuffer = require('buffer').Buffer;
            return new NodeBuffer(str, 'binary').toString("base64");
        });
    } else {
        // global for browser
        root.mimefuncs = factory(root.TextEncoder, root.TextDecoder, root.btoa);
    }
}(this, function(TextEncoder, TextDecoder, btoa) {
    

    btoa = btoa || base64Encode;

    var mimefuncs = {
        /**
         * Encodes all non printable and non ascii bytes to =XX form, where XX is the
         * byte value in hex. This function does not convert linebreaks etc. it
         * only escapes character sequences
         *
         * @param {String|Uint8Array} data Either a string or an Uint8Array
         * @param {String} [fromCharset='UTF-8'] Source encoding
         * @return {String} Mime encoded string
         */
        mimeEncode: function(data, fromCharset) {
            fromCharset = fromCharset || 'UTF-8';

            const buffer = mimefuncs.charset.convert(data, fromCharset);
            return buffer.reduce((aggregate, ord, index) =>
                _checkRanges(ord) && !((ord === 0x20 || ord === 0x09) && (index === buffer.length - 1 || buffer[index + 1] === 0x0a || buffer[index + 1] === 0x0d))
                    ? aggregate + String.fromCharCode(ord) // if the char is in allowed range, then keep as is, unless it is a ws in the end of a line
                    : aggregate + '=' + (ord < 0x10 ? '0' : '') + ord.toString(16).toUpperCase(), '');

            function _checkRanges (nr) {
                const ranges = [ // https://tools.ietf.org/html/rfc2045#section-6.7
                    [0x09], // <TAB>
                    [0x0A], // <LF>
                    [0x0D], // <CR>
                    [0x20, 0x3C], // <SP>!"#$%&'()*+,-./0123456789:;
                    [0x3E, 0x7E] // >?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}
                ];
                return ranges.reduce((val, range) => val || (range.length === 1 && nr === range[0]) || (range.length === 2 && nr >= range[0] && nr <= range[1]), false);
            }
        },

        /**
         * Decodes mime encoded string to an unicode string
         *
         * @param {String} str Mime encoded string
         * @param {String} [fromCharset='UTF-8'] Source encoding
         * @return {String} Decoded unicode string
         */
        mimeDecode: function(str, fromCharset) {
            str = (str || '').toString();

            fromCharset = fromCharset || 'UTF-8';

            var encodedBytesCount = (str.match(/\=[\da-fA-F]{2}/g) || []).length,
                bufferLength = str.length - encodedBytesCount * 2,
                chr, hex,
                buffer = new Uint8Array(bufferLength),
                bufferPos = 0;

            for (var i = 0, len = str.length; i < len; i++) {
                chr = str.charAt(i);
                if (chr === '=' && (hex = str.substr(i + 1, 2)) && /[\da-fA-F]{2}/.test(hex)) {
                    buffer[bufferPos++] = parseInt(hex, 16);
                    i += 2;
                    continue;
                }
                buffer[bufferPos++] = chr.charCodeAt(0);
            }

            return mimefuncs.charset.decode(buffer, fromCharset);
        },

        /**
         * Encodes a string or an typed array of given charset into unicode
         * base64 string. Also adds line breaks
         *
         * @param {String|Uint8Array} data String to be base64 encoded
         * @param {String} [fromCharset='UTF-8']
         * @return {String} Base64 encoded string
         */
        base64Encode: function(data, fromCharset) {
            var buf, b64;

            if (fromCharset !== 'binary' && typeof data !== 'string') {
                buf = mimefuncs.charset.convert(data || '', fromCharset);
            } else {
                buf = data;
            }

            b64 = mimefuncs.base64.encode(buf);
            return mimefuncs._addSoftLinebreaks(b64, 'base64');
        },

        /**
         * Decodes a base64 string of any charset into an unicode string
         *
         * @param {String} str Base64 encoded string
         * @param {String} [fromCharset='UTF-8'] Original charset of the base64 encoded string
         * @return {String} Decoded unicode string
         */
        base64Decode: function(str, fromCharset) {
            var buf = mimefuncs.base64.decode(str || '', 'buffer');
            return mimefuncs.charset.decode(buf, fromCharset);
        },

        /**
         * Encodes a string or an Uint8Array into a quoted printable encoding
         * This is almost the same as mimeEncode, except line breaks will be changed
         * as well to ensure that the lines are never longer than allowed length
         *
         * @param {String|Uint8Array} data String or an Uint8Array to mime encode
         * @param {String} [fromCharset='UTF-8'] Original charset of the string
         * @return {String} Mime encoded string
         */
        quotedPrintableEncode: function(data, fromCharset) {
            var mimeEncodedStr = mimefuncs.mimeEncode(data, fromCharset);

            mimeEncodedStr = mimeEncodedStr.
                // fix line breaks, ensure <CR><LF>
            replace(/\r?\n|\r/g, '\r\n').
                // replace spaces in the end of lines
            replace(/[\t ]+$/gm, function(spaces) {
                return spaces.replace(/ /g, '=20').replace(/\t/g, '=09');
            });

            // add soft line breaks to ensure line lengths sjorter than 76 bytes
            return mimefuncs._addSoftLinebreaks(mimeEncodedStr, 'qp');
        },

        /**
         * Decodes a string from a quoted printable encoding. This is almost the
         * same as mimeDecode, except line breaks will be changed as well
         *
         * @param {String} str Mime encoded string to decode
         * @param {String} [fromCharset='UTF-8'] Original charset of the string
         * @return {String} Mime decoded string
         */
        quotedPrintableDecode: function(str, fromCharset) {
            str = (str || '').toString();

            str = str.
                // remove invalid whitespace from the end of lines
            replace(/[\t ]+$/gm, '').
                // remove soft line breaks
            replace(/\=(?:\r?\n|$)/g, '');

            return mimefuncs.mimeDecode(str, fromCharset);
        },

        /**
         * Encodes a string or an Uint8Array to an UTF-8 MIME Word (rfc2047)
         *
         * @param {String|Uint8Array} data String to be encoded
         * @param {String} mimeWordEncoding='Q' Encoding for the mime word, either Q or B
         * @param {Number} [maxLength=0] If set, split mime words into several chunks if needed
         * @param {String} [fromCharset='UTF-8'] Source sharacter set
         * @return {String} Single or several mime words joined together
         */
        mimeWordEncode: function(data, mimeWordEncoding, maxLength, fromCharset) {
            mimeWordEncoding = (mimeWordEncoding || 'Q').toString().toUpperCase().trim().charAt(0);

            if (!fromCharset && typeof maxLength === 'string' && !maxLength.match(/^[0-9]+$/)) {
                fromCharset = maxLength;
                maxLength = undefined;
            }

            maxLength = maxLength || 0;

            var encodedStr,
                toCharset = 'UTF-8',
                i, len, parts;

            if (maxLength && maxLength > 7 + toCharset.length) {
                maxLength -= (7 + toCharset.length);
            }

            if (mimeWordEncoding === 'Q') {
                encodedStr = mimefuncs.mimeEncode(data, fromCharset);
                // https://tools.ietf.org/html/rfc2047#section-5 rule (3)
                encodedStr = encodedStr.replace(/[^a-z0-9!*+\-\/=]/ig, function(chr) {
                    var code = chr.charCodeAt(0);
                    if (chr === ' ') {
                        return '_';
                    } else {
                        return '=' + (code < 0x10 ? '0' : '') + code.toString(16).toUpperCase();
                    }
                });
            } else if (mimeWordEncoding === 'B') {
                encodedStr = typeof data === 'string' ? data : mimefuncs.decode(data, fromCharset);
                maxLength = Math.max(3, (maxLength - maxLength % 4) / 4 * 3);
            }

            if (maxLength && encodedStr.length > maxLength) {
                if (mimeWordEncoding === 'Q') {
                    encodedStr = mimefuncs._splitMimeEncodedString(encodedStr, maxLength).join('?= =?' + toCharset + '?' + mimeWordEncoding + '?');
                } else {

                    // RFC2047 6.3 (2) states that encoded-word must include an integral number of characters, so no chopping unicode sequences
                    parts = [];
                    for (i = 0, len = encodedStr.length; i < len; i += maxLength) {
                        parts.push(mimefuncs.base64.encode(encodedStr.substr(i, maxLength)));
                    }

                    if (parts.length > 1) {
                        return '=?' + toCharset + '?' + mimeWordEncoding + '?' + parts.join('?= =?' + toCharset + '?' + mimeWordEncoding + '?') + '?=';
                    } else {
                        encodedStr = parts.join('');
                    }
                }
            } else if (mimeWordEncoding === 'B') {
                encodedStr = mimefuncs.base64.encode(encodedStr);
            }

            return '=?' + toCharset + '?' + mimeWordEncoding + '?' + encodedStr + (encodedStr.substr(-2) === '?=' ? '' : '?=');
        },

        /**
         * Finds word sequences with non ascii text and converts these to mime words
         *
         * @param {String|Uint8Array} data String to be encoded
         * @param {String} mimeWordEncoding='Q' Encoding for the mime word, either Q or B
         * @param {Number} [maxLength=0] If set, split mime words into several chunks if needed
         * @param {String} [fromCharset='UTF-8'] Source sharacter set
         * @return {String} String with possible mime words
         */
        mimeWordsEncode: function(data, mimeWordEncoding, maxLength, fromCharset) {
            if (!fromCharset && typeof maxLength === 'string' && !maxLength.match(/^[0-9]+$/)) {
                fromCharset = maxLength;
                maxLength = undefined;
            }

            maxLength = maxLength || 0;

            var decodedValue = mimefuncs.charset.decode(mimefuncs.charset.convert((data || ''), fromCharset)),
                encodedValue;

            encodedValue = decodedValue.replace(/([^\s\u0080-\uFFFF]*[\u0080-\uFFFF]+[^\s\u0080-\uFFFF]*(?:\s+[^\s\u0080-\uFFFF]*[\u0080-\uFFFF]+[^\s\u0080-\uFFFF]*\s*)?)+(?=\s|$)/g, function(match) {
                return match.length ? mimefuncs.mimeWordEncode(match, mimeWordEncoding || 'Q', maxLength) : '';
            });

            return encodedValue;
        },

        /**
         * Decode a complete mime word encoded string
         *
         * @param {String} str Mime word encoded string
         * @return {String} Decoded unicode string
         */
        mimeWordDecode: function(str) {
            str = (str || '').toString().trim();

            var fromCharset, encoding, match;

            match = str.match(/^=\?([\w_\-*]+)\?([QqBb])\?([^?]*)\?=$/i);
            if (!match) {
                return str;
            }

            // RFC2231 added language tag to the encoding
            // see: https://tools.ietf.org/html/rfc2231#section-5
            // this implementation silently ignores this tag
            fromCharset = match[1].split('*').shift();

            encoding = (match[2] || 'Q').toString().toUpperCase();
            str = (match[3] || '').replace(/_/g, ' ');

            if (encoding === 'B') {
                return mimefuncs.base64Decode(str, fromCharset);
            } else if (encoding === 'Q') {
                return mimefuncs.mimeDecode(str, fromCharset);
            } else {
                return str;
            }

        },

        /**
         * Decode a string that might include one or several mime words
         *
         * @param {String} str String including some mime words that will be encoded
         * @return {String} Decoded unicode string
         */
        mimeWordsDecode: function(str) {
            str = str.toString().replace(/(=\?[^?]+\?[QqBb]\?[^?]+\?=)\s+(?==\?[^?]+\?[QqBb]\?[^?]*\?=)/g, '$1');
            str = str.replace(/\?==\?[uU][tT][fF]-8\?[QqBb]\?/g, '');// join bytes of multi-byte UTF-8

            str = str.replace(/=\?[\w_\-*]+\?[QqBb]\?[^?]*\?=/g, mimeWord => mimefuncs.mimeWordDecode(mimeWord.replace(/\s+/g, '')));
            return str;
        },

        /**
         * Folds long lines, useful for folding header lines (afterSpace=false) and
         * flowed text (afterSpace=true)
         *
         * @param {String} str String to be folded
         * @param {Number} [lineLengthMax=76] Maximum length of a line
         * @param {Boolean} afterSpace If true, leave a space in th end of a line
         * @return {String} String with folded lines
         */
        foldLines: function(str, lineLengthMax, afterSpace) {
            str = (str || '').toString();
            lineLengthMax = lineLengthMax || 76;

            var pos = 0,
                len = str.length,
                result = '',
                line, match;

            while (pos < len) {
                line = str.substr(pos, lineLengthMax);
                if (line.length < lineLengthMax) {
                    result += line;
                    break;
                }
                if ((match = line.match(/^[^\n\r]*(\r?\n|\r)/))) {
                    line = match[0];
                    result += line;
                    pos += line.length;
                    continue;
                } else if ((match = line.match(/(\s+)[^\s]*$/)) && match[0].length - (afterSpace ? (match[1] || '').length : 0) < line.length) {
                    line = line.substr(0, line.length - (match[0].length - (afterSpace ? (match[1] || '').length : 0)));
                } else if ((match = str.substr(pos + line.length).match(/^[^\s]+(\s*)/))) {
                    line = line + match[0].substr(0, match[0].length - (!afterSpace ? (match[1] || '').length : 0));
                }

                result += line;
                pos += line.length;
                if (pos < len) {
                    result += '\r\n';
                }
            }

            return result;
        },

        /**
         * Encodes and folds a header line for a MIME message header.
         * Shorthand for mimeWordsEncode + foldLines
         *
         * @param {String} key Key name, will not be encoded
         * @param {String|Uint8Array} value Value to be encoded
         * @param {String} [fromCharset='UTF-8'] Character set of the value
         * @return {String} encoded and folded header line
         */
        headerLineEncode: function(key, value, fromCharset) {
            var encodedValue = mimefuncs.mimeWordsEncode(value, 'Q', 52, fromCharset);
            return mimefuncs.foldLines(key + ': ' + encodedValue, 76);
        },

        /**
         * Splits a string by :
         * The result is not mime word decoded, you need to do your own decoding based
         * on the rules for the specific header key
         *
         * @param {String} headerLine Single header line, might include linebreaks as well if folded
         * @return {Object} And object of {key, value}
         */
        headerLineDecode: function(headerLine) {
            var line = (headerLine || '').toString().replace(/(?:\r?\n|\r)[ \t]*/g, ' ').trim(),
                match = line.match(/^\s*([^:]+):(.*)$/),
                key = (match && match[1] || '').trim(),
                value = (match && match[2] || '').trim();

            return {
                key: key,
                value: value
            };
        },

        /**
         * Parses a block of header lines. Does not decode mime words as every
         * header might have its own rules (eg. formatted email addresses and such)
         *
         * @param {String} headers Headers string
         * @return {Object} An object of headers, where header keys are object keys. NB! Several values with the same key make up an Array
         */
        headerLinesDecode: function(headers) {
            var lines = headers.split(/\r?\n|\r/),
                headersObj = {},
                key, value,
                header,
                i, len;

            for (i = lines.length - 1; i >= 0; i--) {
                if (i && lines[i].match(/^\s/)) {
                    lines[i - 1] += '\r\n' + lines[i];
                    lines.splice(i, 1);
                }
            }

            for (i = 0, len = lines.length; i < len; i++) {
                header = mimefuncs.headerLineDecode(lines[i]);
                key = (header.key || '').toString().toLowerCase().trim();
                value = header.value || '';

                if (!headersObj[key]) {
                    headersObj[key] = value;
                } else {
                    headersObj[key] = [].concat(headersObj[key], value);
                }
            }

            return headersObj;
        },

        /**
         * Converts 'binary' string to an Uint8Array
         *
         * @param {String} 'binary' string
         * @return {Uint8Array} Octet stream buffer
         */
        toTypedArray: function(binaryString) {
            var buf = new Uint8Array(binaryString.length);
            for (var i = 0, len = binaryString.length; i < len; i++) {
                buf[i] = binaryString.charCodeAt(i);
            }
            return buf;
        },

        /**
         * Converts an Uint8Array to 'binary' string
         *
         * @param {Uint8Array} buf Octet stream buffer
         * @return {String} 'binary' string
         */
        fromTypedArray: function(buf) {
            var i, l;

            // ensure the value is a Uint8Array, not ArrayBuffer if used
            if (!buf.buffer) {
                buf = new Uint8Array(buf);
            }

            var sbits = new Array(buf.length);
            for (i = 0, l = buf.length; i < l; i++) {
                sbits[i] = String.fromCharCode(buf[i]);
            }

            return sbits.join('');
        },

        /**
         * Parses a header value with key=value arguments into a structured
         * object.
         *
         *   parseHeaderValue('content-type: text/plain; CHARSET='UTF-8'') ->
         *   {
         *     'value': 'text/plain',
         *     'params': {
         *       'charset': 'UTF-8'
         *     }
         *   }
         *
         * @param {String} str Header value
         * @return {Object} Header value as a parsed structure
         */
        parseHeaderValue: function(str) {
            var response = {
                    value: false,
                    params: {}
                },
                key = false,
                value = '',
                type = 'value',
                quote = false,
                escaped = false,
                chr;

            for (var i = 0, len = str.length; i < len; i++) {
                chr = str.charAt(i);
                if (type === 'key') {
                    if (chr === '=') {
                        key = value.trim().toLowerCase();
                        type = 'value';
                        value = '';
                        continue;
                    }
                    value += chr;
                } else {
                    if (escaped) {
                        value += chr;
                    } else if (chr === '\\') {
                        escaped = true;
                        continue;
                    } else if (quote && chr === quote) {
                        quote = false;
                    } else if (!quote && chr === '"') {
                        quote = chr;
                    } else if (!quote && chr === ';') {
                        if (key === false) {
                            response.value = value.trim();
                        } else {
                            response.params[key] = value.trim();
                        }
                        type = 'key';
                        value = '';
                    } else {
                        value += chr;
                    }
                    escaped = false;

                }
            }

            if (type === 'value') {
                if (key === false) {
                    response.value = value.trim();
                } else {
                    response.params[key] = value.trim();
                }
            } else if (value.trim()) {
                response.params[value.trim().toLowerCase()] = '';
            }

            // handle parameter value continuations
            // https://tools.ietf.org/html/rfc2231#section-3

            // preprocess values
            Object.keys(response.params).forEach(function(key) {
                var actualKey, nr, match, value;
                if ((match = key.match(/(\*(\d+)|\*(\d+)\*|\*)$/))) {
                    actualKey = key.substr(0, match.index);
                    nr = Number(match[2] || match[3]) || 0;

                    if (!response.params[actualKey] || typeof response.params[actualKey] !== 'object') {
                        response.params[actualKey] = {
                            charset: false,
                            values: []
                        };
                    }

                    value = response.params[key];

                    if (nr === 0 && match[0].substr(-1) === '*' && (match = value.match(/^([^']*)'[^']*'(.*)$/))) {
                        response.params[actualKey].charset = match[1] || 'iso-8859-1';
                        value = match[2];
                    }

                    response.params[actualKey].values[nr] = value;

                    // remove the old reference
                    delete response.params[key];
                }
            });

            // concatenate split rfc2231 strings and convert encoded strings to mime encoded words
            Object.keys(response.params).forEach(function(key) {
                var value;
                if (response.params[key] && Array.isArray(response.params[key].values)) {
                    value = response.params[key].values.map(function(val) {
                        return val || '';
                    }).join('');

                    if (response.params[key].charset) {
                        // convert "%AB" to "=?charset?Q?=AB?="
                        response.params[key] = '=?' +
                            response.params[key].charset +
                            '?Q?' +
                            value.
                            // fix invalidly encoded chars
                        replace(/[=\?_\s]/g, function(s) {
                                var c = s.charCodeAt(0).toString(16);
                                if (s === ' ') {
                                    return '_';
                                } else {
                                    return '%' + (c.length < 2 ? '0' : '') + c;
                                }
                            }).
                            // change from urlencoding to percent encoding
                        replace(/%/g, '=') +
                            '?=';
                    } else {
                        response.params[key] = value;
                    }
                }
            }.bind(this));

            return response;
        },

        /**
         * Encodes a string or an Uint8Array to an UTF-8 Parameter Value Continuation encoding (rfc2231)
         * Useful for splitting long parameter values.
         *
         * For example
         *      title="unicode string"
         * becomes
         *     title*0*="utf-8''unicode"
         *     title*1*="%20string"
         *
         * @param {String|Uint8Array} data String to be encoded
         * @param {Number} [maxLength=50] Max length for generated chunks
         * @param {String} [fromCharset='UTF-8'] Source sharacter set
         * @return {Array} A list of encoded keys and headers
         */
        continuationEncode: function(key, data, maxLength, fromCharset) {
            var list = [];
            var encodedStr = typeof data === 'string' ? data : mimefuncs.decode(data, fromCharset);
            var chr;
            var line;
            var startPos = 0;
            var isEncoded = false;

            maxLength = maxLength || 50;

            // process ascii only text
            if (/^[\w.\- ]*$/.test(data)) {

                // check if conversion is even needed
                if (encodedStr.length <= maxLength) {
                    return [{
                        key: key,
                        value: /[\s";=]/.test(encodedStr) ? '"' + encodedStr + '"' : encodedStr
                    }];
                }

                encodedStr = encodedStr.replace(new RegExp('.{' + maxLength + '}', 'g'), function(str) {
                    list.push({
                        line: str
                    });
                    return '';
                });

                if (encodedStr) {
                    list.push({
                        line: encodedStr
                    });
                }

            } else {

                // first line includes the charset and language info and needs to be encoded
                // even if it does not contain any unicode characters
                line = 'utf-8\'\'';
                isEncoded = true;
                startPos = 0;
                // process text with unicode or special chars
                for (var i = 0, len = encodedStr.length; i < len; i++) {

                    chr = encodedStr[i];

                    if (isEncoded) {
                        chr = encodeURIComponent(chr);
                    } else {
                        // try to urlencode current char
                        chr = chr === ' ' ? chr : encodeURIComponent(chr);
                        // By default it is not required to encode a line, the need
                        // only appears when the string contains unicode or special chars
                        // in this case we start processing the line over and encode all chars
                        if (chr !== encodedStr[i]) {
                            // Check if it is even possible to add the encoded char to the line
                            // If not, there is no reason to use this line, just push it to the list
                            // and start a new line with the char that needs encoding
                            if ((encodeURIComponent(line) + chr).length >= maxLength) {
                                list.push({
                                    line: line,
                                    encoded: isEncoded
                                });
                                line = '';
                                startPos = i - 1;
                            } else {
                                isEncoded = true;
                                i = startPos;
                                line = '';
                                continue;
                            }
                        }
                    }

                    // if the line is already too long, push it to the list and start a new one
                    if ((line + chr).length >= maxLength) {
                        list.push({
                            line: line,
                            encoded: isEncoded
                        });
                        line = chr = encodedStr[i] === ' ' ? ' ' : encodeURIComponent(encodedStr[i]);
                        if (chr === encodedStr[i]) {
                            isEncoded = false;
                            startPos = i - 1;
                        } else {
                            isEncoded = true;
                        }
                    } else {
                        line += chr;
                    }
                }

                if (line) {
                    list.push({
                        line: line,
                        encoded: isEncoded
                    });
                }
            }

            return list.map(function(item, i) {
                return {
                    // encoded lines: {name}*{part}*
                    // unencoded lines: {name}*{part}
                    // if any line needs to be encoded then the first line (part==0) is always encoded
                    key: key + '*' + i + (item.encoded ? '*' : ''),
                    value: /[\s";=]/.test(item.line) ? '"' + item.line + '"' : item.line
                };
            });
        },

        /**
         * Splits a mime encoded string. Needed for dividing mime words into smaller chunks
         *
         * @param {String} str Mime encoded string to be split up
         * @param {Number} maxlen Maximum length of characters for one part (minimum 12)
         * @return {Array} Split string
         */
        _splitMimeEncodedString: function(str, maxlen) {
            var curLine, match, chr, done,
                lines = [];

            // require at least 12 symbols to fit possible 4 octet UTF-8 sequences
            maxlen = Math.max(maxlen || 0, 12);

            while (str.length) {
                curLine = str.substr(0, maxlen);

                // move incomplete escaped char back to main
                if ((match = curLine.match(/\=[0-9A-F]?$/i))) {
                    curLine = curLine.substr(0, match.index);
                }

                done = false;
                while (!done) {
                    done = true;
                    // check if not middle of a unicode char sequence
                    if ((match = str.substr(curLine.length).match(/^\=([0-9A-F]{2})/i))) {
                        chr = parseInt(match[1], 16);
                        // invalid sequence, move one char back anc recheck
                        if (chr < 0xC2 && chr > 0x7F) {
                            curLine = curLine.substr(0, curLine.length - 3);
                            done = false;
                        }
                    }
                }

                if (curLine.length) {
                    lines.push(curLine);
                }
                str = str.substr(curLine.length);
            }

            return lines;
        },

        /**
         * Adds soft line breaks (the ones that will be stripped out when decoding) to
         * ensure that no line in the message is never longer than 76 symbols
         *
         * Lines can't be longer than 76 + <CR><LF> = 78 bytes
         * http://tools.ietf.org/html/rfc2045#section-6.7
         *
         * @param {String} str Encoded string
         * @param {String} encoding Either "qp" or "base64" (the default)
         * @return {String} String with forced line breaks
         */
        _addSoftLinebreaks: function(str, encoding) {
            var lineLengthMax = 76;

            encoding = (encoding || 'base64').toString().toLowerCase().trim();

            if (encoding === 'qp') {
                return mimefuncs._addQPSoftLinebreaks(str, lineLengthMax);
            } else {
                return mimefuncs._addBase64SoftLinebreaks(str, lineLengthMax);
            }
        },

        /**
         * Adds soft line breaks (the ones that will be stripped out when decoding base64) to
         * ensure that no line in the message is never longer than lineLengthMax
         *
         * @param {String} base64EncodedStr String in BASE64 encoding
         * @param {Number} lineLengthMax Maximum length of a line
         * @return {String} String with forced line breaks
         */
        _addBase64SoftLinebreaks: function(base64EncodedStr, lineLengthMax) {
            base64EncodedStr = (base64EncodedStr || '').toString().trim();
            return base64EncodedStr.replace(new RegExp('.{' + lineLengthMax + '}', 'g'), '$&\r\n').trim();
        },

        /**
         * Adds soft line breaks(the ones that will be stripped out when decoding QP) to * ensure that no line in the message is never longer than lineLengthMax * * Not sure of how and why this works, but at least it seems to be working: /
         *
         * @param {String} qpEncodedStr String in Quoted-Printable encoding
         * @param {Number} lineLengthMax Maximum length of a line
         * @return {String} String with forced line breaks
         */
        _addQPSoftLinebreaks: function(qpEncodedStr, lineLengthMax) {
            qpEncodedStr = (qpEncodedStr || '').toString();

            lineLengthMax = lineLengthMax || 76;

            var pos = 0,
                len = qpEncodedStr.length,
                match, code, line,
                lineMargin = Math.floor(lineLengthMax / 3),
                result = '';

            // insert soft linebreaks where needed
            while (pos < len) {
                line = qpEncodedStr.substr(pos, lineLengthMax);
                if ((match = line.match(/\r\n/))) {
                    line = line.substr(0, match.index + match[0].length);
                    result += line;
                    pos += line.length;
                    continue;
                }

                if (line.substr(-1) === '\n') {
                    // nothing to change here
                    result += line;
                    pos += line.length;
                    continue;
                } else if ((match = line.substr(-lineMargin).match(/\n.*?$/))) {
                    // truncate to nearest line break
                    line = line.substr(0, line.length - (match[0].length - 1));
                    result += line;
                    pos += line.length;
                    continue;
                } else if (line.length > lineLengthMax - lineMargin && (match = line.substr(-lineMargin).match(/[ \t\.,!\?][^ \t\.,!\?]*$/))) {
                    // truncate to nearest space
                    line = line.substr(0, line.length - (match[0].length - 1));
                } else if (line.substr(-1) === '\r') {
                    line = line.substr(0, line.length - 1);
                } else {
                    if (line.match(/\=[\da-f]{0,2}$/i)) {

                        // push incomplete encoding sequences to the next line
                        if ((match = line.match(/\=[\da-f]{0,1}$/i))) {
                            line = line.substr(0, line.length - match[0].length);
                        }

                        // ensure that utf-8 sequences are not split
                        while (line.length > 3 && line.length < len - pos && !line.match(/^(?:=[\da-f]{2}){1,4}$/i) && (match = line.match(/\=[\da-f]{2}$/ig))) {
                            code = parseInt(match[0].substr(1, 2), 16);
                            if (code < 128) {
                                break;
                            }

                            line = line.substr(0, line.length - 3);

                            if (code >= 0xC0) {
                                break;
                            }
                        }

                    }
                }

                if (pos + line.length < len && line.substr(-1) !== '\n') {
                    if (line.length === lineLengthMax && line.match(/\=[\da-f]{2}$/i)) {
                        line = line.substr(0, line.length - 3);
                    } else if (line.length === lineLengthMax) {
                        line = line.substr(0, line.length - 1);
                    }
                    pos += line.length;
                    line += '=\r\n';
                } else {
                    pos += line.length;
                }

                result += line;
            }

            return result;
        }
    };

    /**
     * Character set encoding and decoding functions
     */
    mimefuncs.charset = {

        /**
         * Encodes an unicode string into an Uint8Array object as UTF-8
         *
         * TextEncoder only supports unicode encodings (utf-8, utf16le/be) but no other,
         * so we force UTF-8 here.
         *
         * @param {String} str String to be encoded
         * @return {Uint8Array} UTF-8 encoded typed array
         */
        encode: function(str) {
            return new TextEncoder('UTF-8').encode(str);
        },

        /**
         * Decodes a string from Uint8Array to an unicode string using specified encoding
         *
         * @param {Uint8Array} buf Binary data to be decoded
         * @param {String} [fromCharset='UTF-8'] Binary data is decoded into string using this charset
         * @return {String} Decded string
         */
        decode: function(buf, fromCharset) {
            fromCharset = mimefuncs.charset.normalizeCharset(fromCharset || 'UTF-8');

            // ensure the value is a Uint8Array, not ArrayBuffer if used
            if (!buf.buffer) {
                buf = new Uint8Array(buf);
            }

            try {
                return new TextDecoder(fromCharset).decode(buf);
            } catch (E) {
                try {
                    return new TextDecoder('utf-8', {
                        fatal: true // if the input is not a valid utf-8 the decoder will throw
                    }).decode(buf);
                } catch (E) {
                    try {
                        return new TextDecoder('iso-8859-15').decode(buf);
                    } catch (E) {
                        // should not happen as there is something matching for every byte (non character bytes are allowed)
                        return mimefuncs.fromTypedArray(buf);
                    }
                }
            }

        },

        /**
         * Convert a string from specific encoding to UTF-8 Uint8Array
         *
         * @param {String|Uint8Array} str String to be encoded
         * @param {String} [fromCharset='UTF-8'] Source encoding for the string
         * @return {Uint8Array} UTF-8 encoded typed array
         */
        convert: function(data, fromCharset) {
            fromCharset = mimefuncs.charset.normalizeCharset(fromCharset || 'UTF-8');

            var bufString;

            if (typeof data !== 'string') {
                if (fromCharset.match(/^utf[\-_]?8$/)) {
                    return data;
                }
                bufString = mimefuncs.charset.decode(data, fromCharset);
                return mimefuncs.charset.encode(bufString);
            }
            return mimefuncs.charset.encode(data);
        },

        /**
         * Converts well known invalid character set names to proper names.
         * eg. win-1257 will be converted to WINDOWS-1257
         *
         * @param {String} charset Charset name to convert
         * @return {String} Canoninicalized charset name
         */
        normalizeCharset: function(charset) {
            var match;

            if ((match = charset.match(/^utf[\-_]?(\d+)$/i))) {
                return 'UTF-' + match[1];
            }

            if ((match = charset.match(/^win[\-_]?(\d+)$/i))) {
                return 'WINDOWS-' + match[1];
            }

            if ((match = charset.match(/^latin[\-_]?(\d+)$/i))) {
                return 'ISO-8859-' + match[1];
            }

            return charset;
        }
    };

    /**
     * Base64 encoding and decoding functions
     */
    mimefuncs.base64 = {

        /**
         * Encodes input into base64
         *
         * @param {String|Uint8Array} data Data to be encoded into base64
         * @return {String} Base64 encoded string
         */
        encode: function(data) {
            if (!data) {
                return '';
            }

            if (typeof data === 'string') {
                // window.btoa uses pseudo binary encoding, so unicode strings
                // need to be converted before encoding
                return btoa(unescape(encodeURIComponent(data)));
            }

            var len = data.byteLength,
                binStr = '';

            if (!data.buffer) {
                data.buffer = new Uint8Array(data);
            }

            for (var i = 0; i < len; i++) {
                binStr += String.fromCharCode(data[i]);
            }

            return btoa(binStr);
        },

        /**
         * Decodes base64 encoded string into an unicode string or Uint8Array
         *
         * @param {String} data Base64 encoded data
         * @param {String} [outputEncoding='buffer'] Output encoding, either 'string' or 'buffer' (Uint8Array)
         * @return {String|Uint8Array} Decoded string
         */
        decode: function(data, outputEncoding) {
            outputEncoding = (outputEncoding || 'buffer').toLowerCase().trim();

            var buf = mimefuncs.base64.toTypedArray(data);

            if (outputEncoding === 'string') {
                return mimefuncs.charset.decode(buf);
            } else {
                return buf;
            }
        },

        /**
         * Safe base64 decoding. Does not throw on unexpected input.
         *
         * Implementation from the MDN docs:
         * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
         * (MDN code samples are MIT licensed)
         *
         * @param {String} base64Str Base64 encoded string
         * @returns {Uint8Array} Decoded binary blob
         */
        toTypedArray: function(base64Str) {
            var bitsSoFar = 0;
            var validBits = 0;
            var iOut = 0;
            var arr = new Uint8Array(Math.ceil(base64Str.length * 3 / 4));
            var c;
            var bits;

            for (var i = 0, len = base64Str.length; i < len; i++) {
                c = base64Str.charCodeAt(i);
                if (c >= 0x41 && c <= 0x5a) { // [A-Z]
                    bits = c - 0x41;
                } else if (c >= 0x61 && c <= 0x7a) { // [a-z]
                    bits = c - 0x61 + 0x1a;
                } else if (c >= 0x30 && c <= 0x39) { // [0-9]
                    bits = c - 0x30 + 0x34;
                } else if (c === 0x2b) { // +
                    bits = 0x3e;
                } else if (c === 0x2f) { // /
                    bits = 0x3f;
                } else if (c === 0x3d) { // =
                    validBits = 0;
                    continue;
                } else {
                    // ignore all other characters!
                    continue;
                }
                bitsSoFar = (bitsSoFar << 6) | bits;
                validBits += 6;
                if (validBits >= 8) {
                    validBits -= 8;
                    arr[iOut++] = bitsSoFar >> validBits;
                    if (validBits === 2) {
                        bitsSoFar &= 0x03;
                    } else if (validBits === 4) {
                        bitsSoFar &= 0x0f;
                    }
                }
            }

            if (iOut < arr.length) {
                return arr.subarray(0, iOut);
            }
            return arr;
        }
    };

    /*
     * Encodes a string in base 64. DedicatedWorkerGlobalScope for Safari does not provide btoa.
     * https://github.com/davidchambers/Base64.js
     */
    function base64Encode(input) {
        var str = String(input);
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        for (var block, charCode, idx = 0, map = chars, output = ''; str.charAt(idx | 0) || (map = '=', idx % 1); output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {
            charCode = str.charCodeAt(idx += 3 / 4);
            if (charCode > 0xFF) {
                throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
            }
            block = block << 8 | charCode;
        }
        return output;
    }

    return mimefuncs;
}));