
/** @license MIT License (c) copyright 2010-2013 B Cavalier & J Hann */

/**
 * curl (cujo resource loader)
 * An AMD-compliant javascript module and resource loader
 *
 * curl is part of the cujo.js family of libraries (http://cujojs.com/)
 *
 * Licensed under the MIT License at:
 * 		http://www.opensource.org/licenses/mit-license.php
 *
 */
(function (global) {
// don't restore this until the config routine is refactored
	var
		version = '0.8.11',
		curlName = 'curl',
		defineName = 'define',
		bootScriptAttr = 'data-curl-run',
		bootScript,
		userCfg,
		prevCurl,
		prevDefine,
		doc = global.document,
		head = doc && (doc['head'] || doc.getElementsByTagName('head')[0]),
		// to keep IE from crying, we need to put scripts before any
		// <base> elements, but after any <meta>. this should do it:
		insertBeforeEl = head && head.getElementsByTagName('base')[0] || null,
		// constants / flags
		msgUsingExports = {},
		msgFactoryExecuted = {},
		// this is the list of scripts that IE is loading. one of these will
		// be the "interactive" script. too bad IE doesn't send a readystatechange
		// event to tell us exactly which one.
		activeScripts = {},
		// readyStates for IE6-9
		readyStates = 'addEventListener' in global ? {} : { 'loaded': 1, 'complete': 1 },
		// these are always handy :)
		cleanPrototype = {},
		toString = cleanPrototype.toString,
		undef,
		// local cache of resource definitions (lightweight promises)
		cache = {},
		// local url cache
		urlCache = {},
		// preload are files that must be loaded before any others
		preload = false,
		// net to catch anonymous define calls' arguments (non-IE browsers)
		argsNet,
		// RegExp's used later, pre-compiled here
		dontAddExtRx = /\?|\.js\b/,
		absUrlRx = /^\/|^[^:]+:\/\/|^[A-Za-z]:[\\/]/,
		findDotsRx = /(\.)(\.?)(?:$|\/([^\.\/]+.*)?)/g,
		removeCommentsRx = /\/\*[\s\S]*?\*\/|\/\/.*?[\n\r]/g,
		findRValueRequiresRx = /require\s*\(\s*(["'])(.*?[^\\])\1\s*\)|[^\\]?(["'])/g,
		splitCommaSepRx = /\s*,\s*/,
		cjsGetters,
		core;

	function noop () {}

	function isType (obj, type) {
		return toString.call(obj).indexOf('[object ' + type) == 0;
	}

	function normalizePkgDescriptor (descriptor, isPkg) {
		var main;

		descriptor.path = removeEndSlash(descriptor['path'] || descriptor['location'] || '');
		if (isPkg) {
			main = descriptor['main'] || './main';
			if (!isRelUrl(main)) main = './' + main;
			// trailing slashes trick reduceLeadingDots to see them as base ids
			descriptor.main = reduceLeadingDots(main, descriptor.name + '/');
		}
		descriptor.config = descriptor['config'];

		return descriptor;
	}

	function isRelUrl (it) {
		return it.charAt(0) == '.';
	}

	function isAbsUrl (it) {
		return absUrlRx.test(it);
	}

	function joinPath (path, file) {
		return removeEndSlash(path) + '/' + file;
	}

	function removeEndSlash (path) {
		return path && path.charAt(path.length - 1) == '/' ? path.substr(0, path.length - 1) : path;
	}

	function reduceLeadingDots (childId, baseId) {
		// this algorithm is similar to dojo's compactPath, which interprets
		// module ids of "." and ".." as meaning "grab the module whose name is
		// the same as my folder or parent folder".  These special module ids
		// are not included in the AMD spec but seem to work in node.js, too.
		var removeLevels, normId, levels, isRelative, diff;

		removeLevels = 1;
		normId = childId;

		// remove leading dots and count levels
		if (isRelUrl(normId)) {
			isRelative = true;
			normId = normId.replace(findDotsRx, function (m, dot, doubleDot, remainder) {
				if (doubleDot) removeLevels++;
				return remainder || '';
			});
		}

		if (isRelative) {
			levels = baseId.split('/');
			diff = levels.length - removeLevels;
			if (diff < 0) {
				// this is an attempt to navigate above parent module.
				// maybe dev wants a url or something. punt and return url;
				return childId;
			}
			levels.splice(diff, removeLevels);
			// normId || [] prevents concat from adding extra "/" when
			// normId is reduced to a blank string
			return levels.concat(normId || []).join('/');
		}
		else {
			return normId;
		}
	}

	function pluginParts (id) {
		var delPos = id.indexOf('!');
		return {
			resourceId: id.substr(delPos + 1),
			// resourceId can be zero length
			pluginId: delPos >= 0 && id.substr(0, delPos)
		};
	}

	function Begetter () {}

	function beget (parent, mixin) {
		Begetter.prototype = parent || cleanPrototype;
		var child = new Begetter();
		Begetter.prototype = cleanPrototype;
		for (var p in mixin) child[p] = mixin[p];
		return child;
	}

	function Promise () {

		var self, thens, complete;

		self = this;
		thens = [];

		function then (resolved, rejected, progressed) {
			// capture calls to callbacks
			thens.push([resolved, rejected, progressed]);
		}

		function notify (which, arg) {
			// complete all callbacks
			var aThen, cb, i = 0;
			while ((aThen = thens[i++])) {
				cb = aThen[which];
				if (cb) cb(arg);
			}
		}

		complete = function promiseComplete (success, arg) {
			// switch over to sync then()
			then = success ?
				function (resolved, rejected) { resolved && resolved(arg); } :
				function (resolved, rejected) { rejected && rejected(arg); };
			// we no longer throw during multiple calls to resolve or reject
			// since we don't really provide useful information anyways.
			complete = noop;
			// complete all callbacks
			notify(success ? 0 : 1, arg);
			// no more notifications
			notify = noop;
			// release memory
			thens = undef;
		};

		this.then = function (resolved, rejected, progressed) {
			then(resolved, rejected, progressed);
			return self;
		};
		this.resolve = function (val) {
			self.resolved = val;
			complete(true, val);
		};
		this.reject = function (ex) {
			self.rejected = ex;
			complete(false, ex);
		};
		this.progress = function (msg) {
			notify(2, msg);
		}

	}

	function isPromise (o) {
		return o instanceof Promise || o instanceof CurlApi;
	}

	function when (promiseOrValue, callback, errback, progback) {
		// we can't just sniff for then(). if we do, resources that have a
		// then() method will make dependencies wait!
		if (isPromise(promiseOrValue)) {
			return promiseOrValue.then(callback, errback, progback);
		}
		else {
			return callback(promiseOrValue);
		}
	}

	/**
	 * Returns a function that when executed, executes a lambda function,
	 * but only executes it the number of times stated by howMany.
	 * When done executing, it executes the completed function. Each callback
	 * function receives the same parameters that are supplied to the
	 * returned function each time it executes.  In other words, they
	 * are passed through.
	 * @private
	 * @param howMany {Number} must be greater than zero
	 * @param lambda {Function} executed each time
	 * @param completed {Function} only executes once when the counter
	 *   reaches zero
	 * @returns {Function}
	 */
	function countdown (howMany, lambda, completed) {
		var result;
		return function () {
			if (--howMany >= 0 && lambda) result = lambda.apply(undef, arguments);
			// we want ==, not <=, since some callers expect call-once functionality
			if (howMany == 0 && completed) completed(result);
			return result;
		}
	}

	core = {

		/**
		 * * reduceLeadingDots of id against parentId
		 *		- if there are too many dots (path goes beyond parent), it's a url
		 *			- return reduceLeadingDots of id against baseUrl + parentId;
		 *	* if id is a url (starts with dots or slash or protocol)
		 *		- pathInfo = { config: userCfg, url: url }
		 *	* if not a url, id-to-id transform here.
		 *		- main module expansion
		 *		- plugin prefix expansion
		 *		- coordinate main module expansion with plugin expansion
		 *			- main module expansion happens first
		 *		- future: other transforms?
		 * @param id
		 * @param parentId
		 * @param cfg
		 * @return {*}
		 */
		toAbsId: function (id, parentId, cfg) {
			var absId, pluginId, parts;

			absId = reduceLeadingDots(id, parentId);

			// if this is still a relative path, it must be a url
			// so just punt, otherwise...
			if (isRelUrl(absId)) return absId;

			// plugin id split
			parts = pluginParts(absId);
			pluginId = parts.pluginId;
			absId = pluginId || parts.resourceId;

			// main id expansion
			if (absId in cfg.pathMap) {
				absId = cfg.pathMap[absId].main || absId;
			}

			// plugin id expansion
			if (pluginId) {
				if (pluginId.indexOf('/') < 0 && !(pluginId in cfg.pathMap)) {
					absId = joinPath(cfg.pluginPath, pluginId);
				}
				absId = absId + '!' + parts.resourceId;
			}

			return absId;
		},

		createContext: function (cfg, baseId, depNames, isPreload) {

			var def;

			def = new Promise();
			def.id = baseId || ''; // '' == global
			def.isPreload = isPreload;
			def.depNames = depNames;
			def.config = cfg;

			// functions that dependencies will use:

			function toAbsId (childId, checkPlugins) {
				var absId, parts, plugin;

				absId = core.toAbsId(childId, def.id, cfg);
				if (!checkPlugins) return absId;

				parts = pluginParts(absId);
				if (!parts.pluginId) return absId;

				plugin = cache[parts.pluginId];
				// check if plugin supports the normalize method
				if ('normalize' in plugin) {
					// note: dojo/has may return falsey values (0, actually)
					parts.resourceId = plugin['normalize'](parts.resourceId, toAbsId, def.config) || '';
				}
				else {
					parts.resourceId = toAbsId(parts.resourceId);
				}
				return parts.pluginId + '!' + parts.resourceId;
			}

			function toUrl (n) {
				// the AMD spec states that we should not append an extension
				// in this function since it could already be appended.
				// we need to use toAbsId in case this is a module id.
				return core.resolvePathInfo(toAbsId(n, true), cfg).url;
			}

			function localRequire (ids, callback, errback) {
				var cb, rvid, childDef, earlyExport;

				// this is public, so send pure function
				// also fixes issue #41
				cb = callback && function () { callback.apply(undef, arguments[0]); };

				// RValue require (CommonJS)
				if (isType(ids, 'String')) {
					if (cb) {
						throw new Error('require(id, callback) not allowed');
					}
					// return resource
					rvid = toAbsId(ids, true);
					childDef = cache[rvid];
					if (!(rvid in cache)) {
						// this should only happen when devs attempt their own
						// manual wrapping of cjs modules or get confused with
						// the callback syntax:
						throw new Error('Module not resolved: '  + rvid);
					}
					earlyExport = isPromise(childDef) && childDef.exports;
					return earlyExport || childDef;
				}
				else {
					when(core.getDeps(core.createContext(cfg, def.id, ids, isPreload)), cb, errback);
				}
			}

			def.require = localRequire;
			localRequire['toUrl'] = toUrl;
			def.toAbsId = toAbsId;

			return def;
		},

		createResourceDef: function (cfg, id, isPreload) {
			var def, origResolve, execute;

			def = core.createContext(cfg, id, undef, isPreload);
			origResolve = def.resolve;

			// using countdown to only execute definition function once
			execute = countdown(1, function (deps) {
				def.deps = deps;
				try {
					return core.executeDefFunc(def);
				}
				catch (ex) {
					def.reject(ex);
				}
			});

			// intercept resolve function to execute definition function
			// before resolving
			def.resolve = function resolve (deps) {
				when(isPreload || preload, function () {
					origResolve((cache[def.id] = urlCache[def.url] = execute(deps)));
				});
			};

			// track exports
			def.exportsReady = function executeFactory (deps) {
				when(isPreload || preload, function () {
					// only resolve early if we also use exports (to avoid
					// circular dependencies). def.exports will have already
					// been set by the getDeps loop before we get here.
					if (def.exports) {
						execute(deps);
						def.progress(msgFactoryExecuted);
					}
				});
			};

			return def;
		},

		createPluginDef: function (cfg, id, resId, isPreload) {
			var def;

			// use resource id for local require and toAbsId
			def = core.createContext(cfg, resId, undef, isPreload);

			return def;
		},

		getCjsRequire: function (def) {
			return def.require;
		},

		getCjsExports: function (def) {
			return def.exports || (def.exports = {});
		},

		getCjsModule: function (def) {
			var module = def.module;
			if (!module) {
				module = def.module = {
					'id': def.id,
					'uri': core.getDefUrl(def),
					'exports': core.getCjsExports(def),
					'config': function () { return def.config; }
				};
				module.exports = module['exports']; // oh closure compiler!
			}
			return module;
		},

		getDefUrl: function (def) {
			// note: this is used by cjs module.uri
			return def.url || (def.url = core.checkToAddJsExt(def.require['toUrl'](def.id), def.config));
		},

		/**
		 * Sets the curl() and define() APIs.
		 * @param [cfg] {Object|Null} set of config params. If missing or null,
		 *   this function will set the default API!
		 */
		setApi: function (cfg) {
			/*
			scenarios:
			1. global config sets apiName: "require"
				- first call to config sets api
				- second and later calls are ignored
				- prevCurl cannot exist
			2. no global config, first call to config() sets api
				- first call to config has no api info
				- second call to config sets api
				- third and later calls must be ignored
			3. global config that doesn't set api, first call does though
				- same as #2
			4. api info is never set
				- how to know when to stop ignoring?

			objectives:
			1. fail before mistakenly overwriting global[curlName]
			2. allow rename/relocate of curl() and define()
			3. restore curl() if we overwrote it
			 */

			var apiName, defName, apiObj, defObj,
				failMsg, okToOverwrite;

			apiName = curlName;
			defName = defineName;
			apiObj = defObj = global;
			failMsg = ' already exists';

			// if we're not setting defaults
			if (cfg) {
				// is it ok to overwrite existing api functions?
				okToOverwrite = cfg['overwriteApi'] || cfg.overwriteApi;
				// allow dev to rename/relocate curl() to another object
				apiName = cfg['apiName'] || cfg.apiName || apiName;
				apiObj = cfg['apiContext'] || cfg.apiContext || apiObj;
				// define() too
				defName = cfg['defineName'] || cfg.defineName || defName;
				defObj = cfg['defineContext'] || cfg.defineContext || defObj;

				// curl() already existed, restore it if this is not a
				// setDefaults pass. dev must be a good citizen and set
				// apiName/apiContext (see below).
				if (prevCurl && isType(prevCurl, 'Function')) {
					// restore previous curl()
					global[curlName] = prevCurl;
				}
				prevCurl = null; // don't check ever again
				// ditto for define()
				if (prevDefine && isType(prevDefine, 'Function')) {
					// restore previous curl()
					global[defineName] = prevDefine;
				}
				prevDefine = null; // don't check ever again

				// check if we're mistakenly overwriting either api
				// if we're configuring, and there's a curl(), and it's not
				// ours -- and we're not explicitly overwriting -- throw!
				// Note: if we're setting defaults, we *must* overwrite curl
				// so that dev can configure it.  This is no different than
				// noConflict()-type methods.
				if (!okToOverwrite) {
					if (apiObj[apiName] && apiObj[apiName] != _curl) {
						throw new Error(apiName + failMsg);
					}
					// check if we're overwriting amd api
					if (defObj[defName] && defObj[defName] != define) {
						throw new Error(defName + failMsg);
					}
				}

			}

			// set curl api
			apiObj[apiName] = _curl;

			// set AMD public api: define()
			defObj[defName] = define;

		},

		config: function (cfg) {
			var prevCfg, newCfg, pluginCfgs, p;

			// convert from closure-safe names
			if ('baseUrl' in cfg) cfg.baseUrl = cfg['baseUrl'];
			if ('main' in cfg) cfg.main = cfg['main'];
			if ('preloads' in cfg) cfg.preloads = cfg['preloads'];
			if ('pluginPath' in cfg) cfg.pluginPath = cfg['pluginPath'];
			if ('dontAddFileExt' in cfg || cfg.dontAddFileExt) {
				cfg.dontAddFileExt = new RegExp(cfg['dontAddFileExt'] || cfg.dontAddFileExt);
			}

			prevCfg = userCfg;
			newCfg = beget(prevCfg, cfg);

			// create object to hold path map.
			// each plugin and package will have its own pathMap, too.
			newCfg.pathMap = beget(prevCfg.pathMap);
			pluginCfgs = cfg['plugins'] || {};
			newCfg.plugins = beget(prevCfg.plugins);
			newCfg.paths = beget(prevCfg.paths, cfg.paths);
			newCfg.packages = beget(prevCfg.packages, cfg.packages);

			// temporary arrays of paths. this will be converted to
			// a regexp for fast path parsing.
			newCfg.pathList = [];

			// normalizes path/package info and places info on either
			// the global cfg.pathMap or on a plugin-specific altCfg.pathMap.
			// also populates a pathList on cfg or plugin configs.
			function fixAndPushPaths (coll, isPkg) {
				var id, pluginId, data, parts, currCfg, info;
				for (var name in coll) {
					data = coll[name];
					if (isType(data, 'String')) data = {
						path: coll[name]
					};
					// grab the package id, if specified. default to
					// property name, if missing.
					data.name = data.name || name;
					currCfg = newCfg;
					// check if this is a plugin-specific path
					parts = pluginParts(removeEndSlash(data.name));
					id = parts.resourceId;
					pluginId = parts.pluginId;
					if (pluginId) {
						// plugin-specific path
						currCfg = pluginCfgs[pluginId];
						if (!currCfg) {
							currCfg = pluginCfgs[pluginId] = beget(newCfg);
							currCfg.pathMap = beget(newCfg.pathMap);
							currCfg.pathList = [];
						}
						// remove plugin-specific path from coll
						delete coll[name];
					}
					info = normalizePkgDescriptor(data, isPkg);
					if (info.config) info.config = beget(newCfg, info.config);
					info.specificity = id.split('/').length;
					if (id) {
						currCfg.pathMap[id] = info;
						currCfg.pathList.push(id);
					}
					else {
						// naked plugin name signifies baseUrl for plugin
						// resources. baseUrl could be relative to global
						// baseUrl.
						currCfg.baseUrl = core.resolveUrl(data.path, newCfg);
					}
				}
			}

			// adds the path matching regexp onto the cfg or plugin cfgs.
			function convertPathMatcher (cfg) {
				var pathMap = cfg.pathMap;
				cfg.pathRx = new RegExp('^(' +
					cfg.pathList.sort(function (a, b) { return pathMap[b].specificity - pathMap[a].specificity; } )
						.join('|')
						.replace(/\/|\./g, '\\$&') +
					')(?=\\/|$)'
				);
				delete cfg.pathList;
			}

			// fix all new packages, then paths (in case there are
			// plugin-specific paths for a main module, such as wire!)
			fixAndPushPaths(cfg['packages'], true);
			fixAndPushPaths(cfg['paths'], false);

			// process plugins after packages in case we already perform an
			// id transform on a plugin (i.e. it's a package.main)
			for (p in pluginCfgs) {
				var absId = core.toAbsId(p + '!', '', newCfg);
				newCfg.plugins[absId.substr(0, absId.length - 1)] = pluginCfgs[p];
			}
			pluginCfgs = newCfg.plugins;

			// create search regex for each path map
			for (p in pluginCfgs) {
				// inherit full config
				pluginCfgs[p] = beget(newCfg, pluginCfgs[p]);
				var pathList = pluginCfgs[p].pathList;
				if (pathList) {
					pluginCfgs[p].pathList = pathList.concat(newCfg.pathList);
					convertPathMatcher(pluginCfgs[p]);
				}
			}

			// ugh, this is ugly, but necessary until we refactor this function
			// copy previous pathMap items onto pathList
			for (p in prevCfg.pathMap) {
				if (!newCfg.pathMap.hasOwnProperty(p)) newCfg.pathList.push(p);
			}

			convertPathMatcher(newCfg);

			return newCfg;

		},

		resolvePathInfo: function (absId, cfg) {
			// searches through the configured path mappings and packages
			var pathMap, pathInfo, path, pkgCfg;

			pathMap = cfg.pathMap;

			if (!isAbsUrl(absId)) {
				path = absId.replace(cfg.pathRx, function (match) {
					// TODO: remove fallbacks here since they should never need to happen
					pathInfo = pathMap[match] || {};
					pkgCfg = pathInfo.config;
					return pathInfo.path || '';
				});
			}
			else {
				path = absId;
			}

			return {
				config: pkgCfg || userCfg,
				url: core.resolveUrl(path, cfg)
			};
		},

		resolveUrl: function (path, cfg) {
			var baseUrl = cfg.baseUrl;
			return baseUrl && !isAbsUrl(path) ? joinPath(baseUrl, path) : path;
		},

		checkToAddJsExt: function (url, cfg) {
			// don't add extension if a ? is found in the url (query params)
			// i'd like to move this feature to a moduleLoader
			return url + ((cfg || userCfg).dontAddFileExt.test(url) ? '' : '.js');
		},

		loadScript: function (def, success, failure) {
			// script processing rules learned from RequireJS
			// TODO: pass a validate function into loadScript to check if a success really is a success

			// insert script
			var el = doc.createElement('script');

			// initial script processing
			function process (ev) {
				ev = ev || global.event;
				// detect when it's done loading
				// ev.type == 'load' is for all browsers except IE6-9
				// IE6-9 need to use onreadystatechange and look for
				// el.readyState in {loaded, complete} (yes, we need both)
				if (ev.type == 'load' || readyStates[el.readyState]) {
					delete activeScripts[def.id];
					// release event listeners
					el.onload = el.onreadystatechange = el.onerror = ''; // ie cries if we use undefined
					success();
				}
			}

			function fail (e) {
				// some browsers send an event, others send a string,
				// but none of them send anything useful, so just say we failed:
				failure(new Error('Syntax or http error: ' + def.url));
			}

			// set type first since setting other properties could
			// prevent us from setting this later
			// actually, we don't even need to set this at all
			//el.type = 'text/javascript';
			// using dom0 event handlers instead of wordy w3c/ms
			el.onload = el.onreadystatechange = process;
			el.onerror = fail;
			// js! plugin uses alternate mimetypes
			el.type = def.mimetype || 'text/javascript';
			// TODO: support other charsets?
			el.charset = 'utf-8';
			el.async = !def.order;
			el.src = def.url;

			// loading will start when the script is inserted into the dom.
			// IE will load the script sync if it's in the cache, so
			// indicate the current resource definition if this happens.
			activeScripts[def.id] = el;

			head.insertBefore(el, insertBeforeEl);

			// the js! plugin uses this
			return el;
		},

		extractCjsDeps: function (defFunc) {
			// Note: ignores require() inside strings and comments
			var source, ids = [], currQuote;
			// prefer toSource (FF) since it strips comments
			source = typeof defFunc == 'string' ?
					 defFunc :
					 defFunc.toSource ? defFunc.toSource() : defFunc.toString();
			// remove comments, then look for require() or quotes
			source.replace(removeCommentsRx, '').replace(findRValueRequiresRx, function (m, rq, id, qq) {
				// if we encounter a string in the source, don't look for require()
				if (qq) {
					currQuote = currQuote == qq ? undef : currQuote;
				}
				// if we're not inside a quoted string
				else if (!currQuote) {
					ids.push(id);
				}
				return ''; // uses least RAM/CPU
			});
			return ids;
		},

		fixArgs: function (args) {
			// resolve args
			// valid combinations for define:
			// (string, array, object|function) sax|saf
			// (array, object|function) ax|af
			// (string, object|function) sx|sf
			// (object|function) x|f

			var id, deps, defFunc, defFuncArity, len, cjs;

			len = args.length;

			defFunc = args[len - 1];
			defFuncArity = isType(defFunc, 'Function') ? defFunc.length : -1;

			if (len == 2) {
				if (isType(args[0], 'Array')) {
					deps = args[0];
				}
				else {
					id = args[0];
				}
			}
			else if (len == 3) {
				id = args[0];
				deps = args[1];
			}

			// Hybrid format: assume that a definition function with zero
			// dependencies and non-zero arity is a wrapped CommonJS module
			if (!deps && defFuncArity > 0) {
				cjs = true;
				deps = ['require', 'exports', 'module'].slice(0, defFuncArity).concat(core.extractCjsDeps(defFunc));
			}

			return {
				id: id,
				deps: deps || [],
				res: defFuncArity >= 0 ? defFunc : function () { return defFunc; },
				cjs: cjs
			};
		},

		executeDefFunc: function (def) {
			var resource, moduleThis;
			// the force of AMD is strong so anything returned
			// overrides exports.
			// node.js assumes `this` === `exports` so we do that
			// for all cjs-wrapped modules, just in case.
			// also, use module.exports if that was set
			// (node.js convention).
			// note: if .module exists, .exports exists.
			moduleThis = def.cjs ? def.exports : undef;
			resource = def.res.apply(moduleThis, def.deps);
			if (resource === undef && def.exports) {
				// note: exports will equal module.exports unless
				// module.exports was reassigned inside module.
				resource = def.module
					? (def.exports = def.module['exports'])
					: def.exports;
			}
			return resource;
		},

		defineResource: function (def, args) {

			def.res = args.res;
			def.cjs = args.cjs;
			def.depNames = args.deps;
			core.getDeps(def);

		},

		getDeps: function (parentDef) {

			var i, names, deps, len, dep, completed, name,
				exportCollector, resolveCollector;

			deps = [];
			names = parentDef.depNames;
			len = names.length;

			if (names.length == 0) allResolved();

			function collect (dep, index, alsoExport) {
				deps[index] = dep;
				if (alsoExport) exportCollector(dep, index);
			}

			// reducer-collectors
			exportCollector = countdown(len, collect, allExportsReady);
			resolveCollector = countdown(len, collect, allResolved);

			// initiate the resolution of all dependencies
			// Note: the correct handling of early exports relies on the
			// fact that the exports pseudo-dependency is always listed
			// before other module dependencies.
			for (i = 0; i < len; i++) {
				name = names[i];
				// is this "require", "exports", or "module"?
				if (name in cjsGetters) {
					// a side-effect of cjsGetters is that the cjs
					// property is also set on the def.
					resolveCollector(cjsGetters[name](parentDef), i, true);
					// if we are using the `module` or `exports` cjs variables,
					// signal any waiters/parents that we can export
					// early (see progress callback in getDep below).
					// note: this may fire for `require` as well, if it
					// is listed after `module` or `exports` in the deps list,
					// but that is okay since all waiters will only record
					// it once.
					if (parentDef.exports) {
						parentDef.progress(msgUsingExports);
					}
				}
				// check for blanks. fixes #32.
				// this helps support yepnope.js, has.js, and the has! plugin
				else if (!name) {
					resolveCollector(undef, i, true);
				}
				// normal module or plugin resource
				else {
					getDep(name, i);
				}
			}

			return parentDef;

			function getDep (name, index) {
				var resolveOnce, exportOnce, childDef, earlyExport;

				resolveOnce = countdown(1, function (dep) {
					exportOnce(dep);
					resolveCollector(dep, index);
				});
				exportOnce = countdown(1, function (dep) {
					exportCollector(dep, index);
				});

				// get child def / dep
				childDef = core.fetchDep(name, parentDef);

				// check if childDef can export. if it can, then
				// we missed the notification and it will never fire in the
				// when() below.
				earlyExport = isPromise(childDef) && childDef.exports;
				if (earlyExport) {
					exportOnce(earlyExport);
				}

				when(childDef,
					resolveOnce,
					parentDef.reject,
					parentDef.exports && function (msg) {
						// messages are only sent from childDefs that support
						// exports, and we only notify parents that understand
						// exports too.
						if (childDef.exports) {
							if (msg == msgUsingExports) {
								// if we're using exports cjs variable on both sides
								exportOnce(childDef.exports);
							}
							else if (msg == msgFactoryExecuted) {
								resolveOnce(childDef.exports);
							}
						}
					}
				);
			}

			function allResolved () {
				parentDef.resolve(deps);
			}

			function allExportsReady () {
				parentDef.exportsReady && parentDef.exportsReady(deps);
			}

		},

		fetchResDef: function (def) {

			// ensure url is computed
			core.getDefUrl(def);

			core.loadScript(def,

				function () {
					var args = argsNet;
					argsNet = undef; // reset it before we get deps

					// if our resource was not explicitly defined with an id (anonymous)
					// Note: if it did have an id, it will be resolved in the define()
					if (def.useNet !== false) {

						// if !args, nothing was added to the argsNet
						if (!args || args.ex) {
							def.reject(new Error(((args && args.ex) || 'define() missing or duplicated: ' + def.url)));
						}
						else {
							core.defineResource(def, args);
						}
					}

				},

				def.reject

			);

			return def;

		},

		fetchDep: function (depName, parentDef) {
			var toAbsId, isPreload, parentCfg, parts, absId, mainId, loaderId, pluginId,
				resId, pathInfo, def, tempDef, resCfg;

			toAbsId = parentDef.toAbsId;
			isPreload = parentDef.isPreload;
			parentCfg = parentDef.config || userCfg; // is this fallback necessary?

			absId = toAbsId(depName);

			if (absId in cache) {
				// module already exists in cache
				mainId = absId;
			}
			else {
				// check for plugin loaderId
				parts = pluginParts(absId);
				resId = parts.resourceId;
				// get id of first resource to load (which could be a plugin)
				mainId = parts.pluginId || resId;
				pathInfo = core.resolvePathInfo(mainId, parentCfg);
			}

			if (!(absId in cache)) {
				resCfg = core.resolvePathInfo(resId, parentCfg).config;
				if (parts.pluginId) {
					loaderId = mainId;
				}
				else {
					// get custom module loader from package config if not a plugin
					// TODO: move config.moduleLoader to config.loader
					loaderId = resCfg['moduleLoader'] || resCfg.moduleLoader
						|| resCfg['loader'] || resCfg.loader;
					if (loaderId) {
						// TODO: allow transforms to have relative module ids?
						// (we could do this by returning package location from
						// resolvePathInfo. why not return all package info?)
						resId = mainId;
						mainId = loaderId;
						pathInfo = core.resolvePathInfo(loaderId, parentCfg);
					}
				}
			}

			if (mainId in cache) {
				def = cache[mainId];
			}
			else if (pathInfo.url in urlCache) {
				def = cache[mainId] = urlCache[pathInfo.url];
			}
			else {
				def = core.createResourceDef(resCfg, mainId, isPreload);
				// TODO: can this go inside createResourceDef?
				// TODO: can we pass pathInfo.url to createResourceDef instead?
				def.url = core.checkToAddJsExt(pathInfo.url, pathInfo.config);
				cache[mainId] = urlCache[pathInfo.url] = def;
				core.fetchResDef(def);
			}

			// plugin or transformer
			if (mainId == loaderId) {

				// use plugin's config if specified
				if (parts.pluginId && parentCfg.plugins[parts.pluginId]) {
					resCfg = parentCfg.plugins[parts.pluginId];
				}
				// we need to use an anonymous promise until plugin tells
				// us normalized id. then, we need to consolidate the promises
				// below. Note: exports objects will be different between
				// pre-normalized and post-normalized defs! does this matter?
				// don't put this resource def in the cache because if the
				// resId doesn't change, the check if this is a new
				// normalizedDef (below) will think it's already being loaded.
				tempDef = new Promise();

				// wait for plugin resource def
				when(def, function(plugin) {
					var normalizedDef, fullId, dynamic;

					dynamic = plugin['dynamic'];
					// check if plugin supports the normalize method
					if ('normalize' in plugin) {
						// note: dojo/has may return falsey values (0, actually)
						resId = plugin['normalize'](resId, toAbsId, def.config) || '';
					}
					else {
						resId = toAbsId(resId);
					}

					// use the full id (loaderId + id) to id plugin resources
					// so multiple plugins may each process the same resource
					// resId could be blank if the plugin doesn't require any (e.g. "domReady!")
					fullId = loaderId + '!' + resId;
					normalizedDef = cache[fullId];

					// if this is our first time fetching this (normalized) def
					if (!(fullId in cache)) {

						// because we're using resId, plugins, such as wire!,
						// can use paths relative to the resource
						normalizedDef = core.createPluginDef(resCfg, fullId, resId, isPreload);

						// don't cache non-determinate "dynamic" resources
						if (!dynamic) {
							cache[fullId] = normalizedDef;
						}

						// curl's plugins prefer to receive a deferred,
						// but to be compatible with AMD spec, we have to
						// piggy-back on the callback function parameter:
						var loaded = function (res) {
							if (!dynamic) cache[fullId] = res;
							normalizedDef.resolve(res);
						};
						loaded['resolve'] = loaded;
						loaded['reject'] = loaded['error'] = normalizedDef.reject;

						// load the resource!
						plugin.load(resId, normalizedDef.require, loaded, resCfg);

					}

					// chain defs (resolve when plugin.load executes)
					if (tempDef != normalizedDef) {
						when(normalizedDef, tempDef.resolve, tempDef.reject, tempDef.progress);
					}

				}, tempDef.reject);

			}

			// return tempDef if this is a plugin-based resource
			return tempDef || def;
		},

		getCurrentDefName: function () {
			// IE6-9 mark the currently executing thread as "interactive"
			// Note: Opera lies about which scripts are "interactive", so we
			// just have to test for it. Opera provides a true browser test, not
			// a UA sniff, thankfully.
			// learned this trick from James Burke's RequireJS
			var def;
			if (!isType(global.opera, 'Opera')) {
				for (var d in activeScripts) {
					if (activeScripts[d].readyState == 'interactive') {
						def = d;
						break;
					}
				}
			}
			return def;
		},

		findScript: function (predicate) {
			var i = 0, scripts, script;
			scripts = doc && (doc.scripts || doc.getElementsByTagName('script'));
			while (scripts && (script = scripts[i++])) {
				if (predicate(script)) return script;
			}
		},

		extractDataAttrConfig: function () {
			var script, attr = '';
			script = core.findScript(function (script) {
				var run;
				// find data-curl-run attr on script element
				run = script.getAttribute(bootScriptAttr);
				if (run) attr = run;
				return run;
			});
			// removeAttribute is wonky (in IE6?) but this works
			if (script) {
				script.setAttribute(bootScriptAttr, '');
			}
			return attr;
		},

		bootScript: function () {
			var urls = bootScript.split(splitCommaSepRx);
			if (urls.length) {
				load();
			}
			function load () {
				// Note: IE calls success handler if it gets a 400+.
				core.loadScript({ url: urls.shift() }, check, check);
			}
			function check () {
				// check if run.js called curl() or curl.config()
				if (bootScript) {
					if (urls.length) {
						// show an error message
						core.nextTurn(fail);
						// try next
						load();
					}
					else fail('run.js script did not run.');
				}
			}
			function fail (msg) {
				throw new Error(msg || 'Primary run.js failed. Trying fallback.');
			}
		},

		nextTurn: function (task) {
			setTimeout(task, 0);
		}

	};

	// hook-up cjs free variable getters
	cjsGetters = {'require': core.getCjsRequire, 'exports': core.getCjsExports, 'module': core.getCjsModule};

	function _curl (/* various */) {
		var args, promise, cfg;

		// indicate we're no longer waiting for a boot script
		bootScript = '';

		args = [].slice.call(arguments);

		// extract config, if it's specified
		if (isType(args[0], 'Object')) {
			cfg = args.shift();
			promise = _config(cfg);
		}

		return new CurlApi(args[0], args[1], args[2], promise);
	}

	function _config (cfg, callback, errback) {
		var pPromise, main, fallback;

		// indicate we're no longer waiting for a boot script
		bootScript = '';

		if (cfg) {
			core.setApi(cfg);
			userCfg = core.config(cfg);
			// check for preloads
			if ('preloads' in cfg) {
				pPromise = new CurlApi(cfg['preloads'], undef, errback, preload, true);
				// yes, this is hacky and embarrassing. now that we've got that
				// settled... until curl has deferred factory execution, this
				// is the only way to stop preloads from dead-locking when
				// they have dependencies inside a bundle.
				core.nextTurn(function () { preload = pPromise; });
			}
			// check for main module(s). all modules wait for preloads implicitly.
			main = cfg['main'];
			if (main) {
				return new CurlApi(main, callback, errback);
			}
		}
	}

	// thanks to Joop Ringelberg for helping troubleshoot the API
	function CurlApi (ids, callback, errback, waitFor, isPreload) {
		var then, ctx;

		ctx = core.createContext(userCfg, undef, [].concat(ids), isPreload);

		this['then'] = this.then = then = function (resolved, rejected) {
			when(ctx,
				// return the dependencies as arguments, not an array
				function (deps) {
					if (resolved) resolved.apply(undef, deps);
				},
				// just throw if the dev didn't specify an error handler
				function (ex) {
					if (rejected) rejected(ex); else throw ex;
				}
			);
			return this;
		};

		this['next'] = function (ids, cb, eb) {
			// chain api
			return new CurlApi(ids, cb, eb, ctx);
		};

		this['config'] = _config;

		if (callback || errback) then(callback, errback);

		// ensure next-turn so inline code can execute first
		core.nextTurn(function () {
			when(isPreload || preload, function () {
				when(waitFor, function () { core.getDeps(ctx); }, errback);
			});
		});
	}

	_curl['version'] = version;
	_curl['config'] = _config;

	function _define (args) {

		var id, def, pathInfo;

		id = args.id;

		if (id == undef) {
			if (argsNet !== undef) {
				argsNet = { ex: 'Multiple anonymous defines encountered' };
			}
			else if (!(id = core.getCurrentDefName())/* intentional assignment */) {
				// anonymous define(), defer processing until after script loads
				argsNet = args;
			}
		}
		if (id != undef) {
			// named define(), it is in the cache if we are loading a dependency
			// (could also be a secondary define() appearing in a built file, etc.)
			def = cache[id];
			if (!(id in cache)) {
				// id is an absolute id in this case, so we can get the config.
				pathInfo = core.resolvePathInfo(id, userCfg);
				def = core.createResourceDef(pathInfo.config, id);
				cache[id] = def;
			}
			if (!isPromise(def)) throw new Error('duplicate define: ' + id);
			// check if this resource has already been resolved
			def.useNet = false;
			core.defineResource(def, args);
		}

	}

	function define () {
		// wrap inner _define so it can be replaced without losing define.amd
		var args = core.fixArgs(arguments);
		_define(args);
	}

	// indicate our capabilities:
	define['amd'] = { 'plugins': true, 'jQuery': true, 'curl': version };

	// default configs
	userCfg = {
		baseUrl: '',
		pluginPath: 'curl/plugin',
		dontAddFileExt: dontAddExtRx,
		paths: {},
		packages: {},
		plugins: {},
		pathMap: {},
		pathRx: /$^/
	};

	// handle pre-existing global
	prevCurl = global[curlName];
	prevDefine = global[defineName];

	// only run config if there is something to config (perf saver?)
	if (prevCurl && isType(prevCurl, 'Object')) {
		// remove global curl object
		global[curlName] = undef; // can't use delete in IE 6-8
		// configure curl
		_config(prevCurl);
	}
	else {
		// set default api
		core.setApi();
	}

	// look for "data-curl-run" directive
	bootScript = core.extractDataAttrConfig();
	// wait a bit in case curl.js is bundled into the boot script
	if (bootScript) core.nextTurn(core.bootScript);

	// allow curl to be a dependency
	cache[curlName] = _curl;

	// expose curl core for special plugins and modules
	// Note: core overrides will only work in either of two scenarios:
	// 1. the files are running un-compressed (Google Closure or Uglify)
	// 2. the overriding module was compressed into the same file as curl.js
	// Compiling curl and the overriding module separately won't work.
	cache['curl/_privileged'] = {
		'core': core,
		'cache': cache,
		'config': function () { return userCfg; },
		'_define': _define,
		'_curl': _curl,
		'Promise': Promise
	};

}(this.window || (typeof global != 'undefined' && global) || this));

define("ext/curl", function(){});

define('date_format',['require','exports','module'],function(require, exports, module) {


module.exports = navigator.mozL10n.DateTimeFormat();

});

define('timespan',['require','exports','module'],function(require, exports, module) {


function Timespan(startDate, endDate) {
  this.start = startDate.valueOf();
  this.end = endDate.valueOf();
}
module.exports = Timespan;

Timespan.prototype = {
  isEqual: function(inputSpan) {
    return (
      this.start === inputSpan.start &&
      this.end === inputSpan.end
    );
  },

  /**
   * If given Timespan overlaps this timespan
   * return a new timespan with the overlapping
   * parts removed.
   *
   * See tests for examples...
   */
  trimOverlap: function(span) {
    if (this.contains(span) || span.contains(this)) {
      return null;
    }

    var start = span.start;
    var end = span.end;
    var ourEnd = this.end;
    var ourStart = this.start;

    var overlapsBefore = start >= ourStart && start < ourEnd;
    var overlapsAfter = ourStart >= start && ourStart < end;

    var newStart = span.start;
    var newEnd = span.end;

    if (overlapsBefore) {
      newStart = ourEnd + 1;
    }

    if (overlapsAfter) {
      newEnd = ourStart - 1;
    }

    return new Timespan(newStart, newEnd);
  },

  /**
   * Checks if given time overlaps with
   * range.
   *
   * @param {Date|Numeric|Timespan} start range or one position.
   * @param {Date|Numeric} [end] do a span comparison.
   */
  overlaps: function(start, end) {
    var ourStart = this.start;
    var ourEnd = this.end;

    if (start instanceof Timespan) {
      end = start.end;
      start = start.start;
    } else {
      // start/end expected
      start = (start instanceof Date) ? start.valueOf() : start;
      end = (end instanceof Date) ? end.valueOf() : end;
    }

    return (
        start >= ourStart && start < ourEnd ||
        ourStart >= start && ourStart < end
    );
  },

  /**
   * When given a date checks if
   * date is inside given range.
   *
   *
   * @param {Date} date date or event.
   */
  contains: function(date) {
    var start = this.start;
    var end = this.end;

    if (date instanceof Date) {
      return start <= date && end >= date;
    } else if (date instanceof Timespan) {
      return start <= date.start &&
             end >= date.end;
    } else {
      return this.containsNumeric(date);
    }
  },

  /**
   * Numeric comparison assumes
   * given seconds since epoch.
   *
   * @param {Numeric} timestamp numeric timestamp.
   */
  containsNumeric: function(timestamp) {
    var start = this.start;
    var end = this.end;

    return start <= timestamp &&
           end >= timestamp;
  }
};

});

define('calc',['require','exports','module','date_format','timespan'],function(require, exports) {


var localeFormat = require('date_format').localeFormat;
var Timespan = require('timespan');

const SECOND = 1000;
const MINUTE = (SECOND * 60);
const HOUR = MINUTE * 60;

exports._hourDate = new Date();
exports.startDay = 0;
exports.FLOATING = 'floating';
exports.ALLDAY = 'allday';
exports.SECOND = SECOND;
exports.MINUTE = MINUTE;
exports.HOUR = HOUR;
exports.PAST = 'past';
exports.NEXT_MONTH = 'next-month';
exports.OTHER_MONTH = 'other-month';
exports.PRESENT = 'present';
exports.FUTURE = 'future';

Object.defineProperty(exports, 'today', {
  get: function() {
    return new Date();
  }
});

exports.getTimeL10nLabel = function(timeLabel) {
  return timeLabel + (navigator.mozHour12 ? '12' : '24');
};

exports.daysInWeek = function() {
  // XXX: We need to localize this...
  return 7;
};

/**
 * Calculates day of week when starting day is Monday.
 */
exports.dayOfWeekFromMonday = function(numeric) {
  var day = numeric - 1;
  if (day < 0) {
    return 6;
  }
  return day;
};

/**
 * Calculates day of week from startDay value
 * passed by the locale currently being used
 */
exports.dayOfWeekFromStartDay = function(numeric) {
  var day = numeric - exports.startDay;
  if (day < 0) {
    return 7 + day;
  }
  return day;
};

/**
 * Checks is given date is today.
 *
 * @param {Date} date compare.
 * @return {Boolean} true when today.
 */
exports.isToday = function(date) {
  return exports.isSameDate(date, exports.today);
};

/**
 * Checks if date object only contains date information (not time).
 *
 * Example:
 *
 *    var time = new Date(2012, 0, 1, 1);
 *    this._isOnlyDate(time); // false
 *
 *    var time = new Date(2012, 0, 1);
 *    this._isOnlyDate(time); // true
 *
 * @param {Date} date to verify.
 * @return {Boolean} see above.
 */
exports.isOnlyDate = function(date) {
  if (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0
  ) {
    return true;
  }

  return false;
};

/**
 * Calculates the difference between
 * two points in hours.
 *
 * @param {Date|Numeric} start start hour.
 * @param {Date|Numeric} end end hour.
 */
exports.hourDiff = function(start, end) {
  start = (start instanceof Date) ? start.valueOf() : start;
  end = (end instanceof Date) ? end.valueOf() : end;

  start = start / HOUR;
  end = end / HOUR;

  return end - start;
};

/**
 * Creates timespan for given day.
 *
 * @param {Date} date date of span.
 * @param {Boolean} includeTime uses given date
 *                           as the start time of the timespan
 *                           rather then the absolute start of
 *                           the day of the given date.
 */
exports.spanOfDay = function(date, includeTime) {
  if (typeof(includeTime) === 'undefined') {
    date = exports.createDay(date);
  }

  var end = exports.createDay(date);
  end.setDate(end.getDate() + 1);
  return new Timespan(date, end);
};

/**
 * Creates timespan for a given month.
 * Starts at the first week that occurs
 * in the given month. Ends at 42 days after the start day,
 * because the UI SPEC require.
 */
exports.spanOfMonth = function(month) {
  var spanScope = 42;
  month = exports.monthStart(month);
  var startDay = exports.getWeekStartDate(month);
  var endDay = exports.monthEnd(month);
  endDay = exports.getWeekEndDate(endDay);
  var  days = exports.daysBetween(startDay, endDay);
  var diffDays = endDay.getDate() + spanScope - days.length;
  if (days.length < spanScope) {
    endDay = exports.createDay(endDay, diffDays);
  }
  return new Timespan(startDay, endDay);
};

exports.monthEnd = function(date, diff = 0) {
  var endDay = new Date(
    date.getFullYear(),
    date.getMonth() + diff + 1,
    1
  );
  endDay.setMilliseconds(-1);
  return endDay;
};

/**
 * Converts a date to UTC
 */
exports.getUTC = function(date) {
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  );
};

/**
 * Converts transport time into a JS Date object.
 *
 * @param {Object} transport date in transport format.
 * @return {Date} javascript date converts the transport into
 *                the current time.
 */
exports.dateFromTransport = function(transport) {
  var utc = transport.utc;
  var offset = transport.offset;
  var zone = transport.tzid;

  var date = new Date(
    // offset is expected to be 0 in the floating case
    parseInt(utc) - parseInt(offset)
  );

  if (zone && zone === exports.FLOATING) {
    return exports.getUTC(date);
  }

  return date;
};

/**
 * Converts a date object into a transport value
 * which can be stored in the database or sent
 * to a service.
 *
 * When the tzid value is given an is the string
 * value of "floating" it will convert the local
 * time directly to UTC zero and record no offset.
 * This along with the tzid is understood to be
 * a "floating" time which will occur at that position
 * regardless of the current tzid's offset.
 *
 * @param {Date} date js date object.
 * @param {String} [tzid] optional tzid.
 * @param {Boolean} isDate true when is a "date" representation.
 */
exports.dateToTransport = function(date, tzid, isDate) {
  var result = Object.create(null);

  if (isDate) {
    result.isDate = isDate;
  }

  if (tzid) {
    result.tzid = tzid;
  }

  var utc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

  // remember a "date" is always a floating
  // point in time otherwise we don't use it...
  if (isDate || tzid && tzid === exports.FLOATING) {
    result.utc = utc;
    result.offset = 0;
    result.tzid = exports.FLOATING;
  } else {
    var localUtc = date.valueOf();
    var offset = utc - localUtc;

    result.utc = utc;
    result.offset = offset;
  }

  return result;
};

/**
 * Checks if two date objects occur
 * on the same date (in the same month, year, day).
 * Disregards time.
 *
 * @param {Date} first date.
 * @param {Date} second date.
 * @return {Boolean} true when they are the same date.
 */
exports.isSameDate = function(first, second) {
  return first.getMonth() == second.getMonth() &&
         first.getDate() == second.getDate() &&
         first.getFullYear() == second.getFullYear();
};

/**
 * Returns an identifier for a specific
 * date in time for a given date
 *
 * @param {Date} date to get id for.
 * @return {String} identifier.
 */
exports.getDayId = function(date) {
  return [
    'd',
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ].join('-');
};

/**
 * Returns a date object from
 * a string id for a date.
 *
 * @param {String} id identifier for date.
 * @return {Date} date output.
 */
exports.dateFromId = function(id) {
  var parts = id.split('-'),
      date,
      type;

  if (parts.length > 1) {
    type = parts.shift();
    switch (type) {
      case 'd':
        date = new Date(parts[0], parts[1], parts[2]);
        break;
      case 'm':
        date = new Date(parts[0], parts[1]);
        break;
    }
  }

  return date;
};

/**
 * Returns an identifier for a specific
 * month in time for a given date.
 *
 * @return {String} identifier.
 */
exports.getMonthId = function(date) {
  return [
    'm',
    date.getFullYear(),
    date.getMonth()
  ].join('-');
};

exports.createDay = function(date, day, month, year) {
  return new Date(
    year != null ? year : date.getFullYear(),
    month != null ? month : date.getMonth(),
    day != null ? day : date.getDate()
  );
};

exports.endOfDay = function(date) {
  var day = exports.createDay(date, date.getDate() + 1);
  day.setMilliseconds(-1);
  return day;
};

exports.monthStart = function(date, diff = 0) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1);
};

/**
 * Returns localized day of week.
 *
 * @param {Date|Number} date numeric or date object.
 */
exports.dayOfWeek = function(date) {
  var number = date;

  if (typeof(date) !== 'number') {
    number = date.getDay();
  }
  return exports.dayOfWeekFromStartDay(number);
};

/**
 * Finds localized week start date of given date.
 *
 * @param {Date} date any day the week.
 * @return {Date} first date in the week of given date.
 */
exports.getWeekStartDate = function(date) {
  var currentDay = exports.dayOfWeek(date);
  var startDay = (date.getDate() - currentDay);

  return exports.createDay(date, startDay);
};

exports.getWeekEndDate = function(date) {
  // TODO: There are localization problems
  // with this approach as we assume a 7 day week.
  var start = exports.getWeekStartDate(date);
  start.setDate(start.getDate() + 7);
  start.setMilliseconds(-1);

  return start;
};

exports.getWeeksOfYear = function(date) {
  var l10Id = exports.startDay === 0 ? '%U' : '%W';
  var weeks = localeFormat(date, l10Id);
  return parseInt(weeks) + 1;
};

/**
 * Returns an array of dates objects.
 * Inclusive. First and last are
 * the given instances.
 *
 * @param {Date} start starting day.
 * @param {Date} end ending day.
 * @param {Boolean} includeTime include times start/end ?
 */
exports.daysBetween = function(start, end, includeTime) {
  if (start instanceof Timespan) {
    if (end) {
      includeTime = end;
    }

    end = new Date(start.end);
    start = new Date(start.start);
  }

  if (start > end) {
    var tmp = end;
    end = start;
    start = tmp;
    tmp = null;
  }

  var list = [];
  var last = start.getDate();

  // handle the case where start & end dates
  // are the same date.
  if (exports.isSameDate(start, end)) {
    if (includeTime) {
      list.push(end);
    } else {
      list.push(exports.createDay(start));
    }
    return list;
  }

  while (true) {
    var next = new Date(
      start.getFullYear(),
      start.getMonth(),
      ++last
    );

    if (next > end) {
      throw new Error(
        'sanity fails next is greater then end'
      );
    }

    if (!exports.isSameDate(next, end)) {
      list.push(next);
      continue;
    }

    break;
  }

  if (includeTime) {
    list.unshift(start);
    list.push(end);
  } else {
    list.unshift(exports.createDay(start));
    list.push(exports.createDay(end));
  }

  return list;
},

/**
 * Returns an array of weekdays based on the start date.
 * Will always return the 7 daysof that week regardless of
 * what the start date isbut they will be returned
 * in the order of their localized getDay function.
 *
 * @param {Date} startDate point of origin.
 * @return {Array} a list of dates in order of getDay().
 */
exports.getWeeksDays = function(startDate) {
  //local day position
  var weeksDayStart = exports.getWeekStartDate(startDate);
  var result = [weeksDayStart];

  for (var i = 1; i < 7; i++) {
    result.push(exports.createDay(weeksDayStart, weeksDayStart.getDate() + i));
  }

  return result;
};

/**
 * Checks if date is in the past
 *
 * @param {Date} date to check.
 * @return {Boolean} true when date is in the past.
 */
exports.isPast = function(date) {
  return (date.valueOf() < exports.today.valueOf());
};

/**
 * Checks if date is in the future
 *
 * @param {Date} date to check.
 * @return {Boolean} true when date is in the future.
 */
exports.isFuture = function(date) {
  return !exports.isPast(date);
};

/**
 * Based on the input date
 * will return one of the following states
 *
 *  past, present, future
 *
 * @param {Date} day for compare.
 * @param {Date} month comparison month.
 * @return {String} state.
 */
exports.relativeState = function(day, month) {
  var states;
  //var today = exports.today;

  // 1. the date is today (real time)
  if (exports.isToday(day)) {
    states = exports.PRESENT;
  } else {
    // 2. the date is in the past (real time)
    if (exports.isPast(day)) {
      states = exports.PAST;
    // 3. the date is in the future (real time)
    } else {
      states = exports.FUTURE;
    }
  }

  // 4. the date is not in the current month (relative time)
  if (day.getMonth() !== month.getMonth()) {
    states += ' ' + exports.OTHER_MONTH;
  }

  return states;
};

/**
 * Computes the relative hour (0...23.9999) inside the given day.
 * If `date` is on a different day than `baseDate` it will return `0`.
 * Used by week view to compute the position of the busytimes relative to
 * the top of the view.
 */
exports.relativeOffset = function(baseDate, date) {
  if (exports.isSameDate(baseDate, date)) {
    return date.getHours() + (date.getMinutes() / 60);
  }
  // different day!
  return 0;
};

/**
 * Computes the relative duration between startDate and endDate inside
 * a given baseDate. Returns a number between 0 and 24.
 * Used by MultiDay view to compute the height of the busytimes relative to
 * the length inside the baseDate.
 */
exports.relativeDuration = function(baseDate, startDate, endDate) {
  if (!exports.isSameDate(startDate, endDate)) {
    if (exports.isSameDate(baseDate, startDate)) {
      endDate = exports.endOfDay(baseDate);
    } else if (exports.isSameDate(baseDate, endDate)) {
      startDate = exports.createDay(endDate);
    } else {
      // started before baseDate and ends on a different day
      return 24;
    }
  }
  return exports.hourDiff(startDate, endDate);
};

/**
 * Check if event spans thru the whole day.
 */
exports.isAllDay = function(baseDate, startDate, endDate) {
  // beginning reference point (start of given date)
  var refStart = exports.createDay(baseDate);
  var refEnd = exports.endOfDay(baseDate);

  var startBefore = startDate <= refStart;
  var endsAfter = endDate >= refEnd;

  // yahoo uses same start/end date for recurring all day events!!!
  return (startBefore && endsAfter) || Number(startDate) === Number(endDate);
};

navigator.mozL10n.once(() => {
  exports.startDay = parseInt(navigator.mozL10n.get('firstDayOfTheWeek'), 10);
});

window.addEventListener('localized', function changeStartDay() {
  exports.startDay = parseInt(navigator.mozL10n.get('firstDayOfTheWeek'), 10);
});

});

define('date_l10n',['require','exports','module','date_format'],function(require, exports) {


var dateFormat = require('date_format');

/**
 * Localizes all elements with data-l10n-date-format.
 */
exports.localizeElements = function() {
  var elements = document.querySelectorAll('[data-l10n-date-format]');
  for (var i = 0; i < elements.length; i++) {
    exports.localizeElement(elements[i]);
  }
};

exports.changeElementsHourFormat = function() {
  var isHour12 = navigator.mozHour12;
  var previousFormat = isHour12 ? 24 : 12;
  var currentFormat = isHour12 ? 12 : 24;
  var elements = document.querySelectorAll(
    `.md__display-hour[data-l10n-date-format*="${previousFormat}"]`
  );
  var itemZeroClock =
    document.querySelectorAll('.md__separator #zero-clock');

  Array.prototype.forEach.call(itemZeroClock, (item) => {
    if (item) {
      item.textContent = isHour12 ? '12' : '00';
    }
  });

  Array.prototype.forEach.call(elements, (element) => {
    var format = element.dataset.l10nDateFormat.replace(
      previousFormat,
      currentFormat
    );

    element.dataset.l10nDateFormat = format;

    var date = new Date(element.dataset.date);
    var displayDate = new Date();
    var hour = date.getHours();

    hour += 1;
    displayDate.setHours(hour, 0, 0, 0);

    if (format === 'week-hour-format12' || format === 'hour-format12') {
      element.textContent = hour !== 24 ?
        dateFormat.localeFormat(displayDate, '%I').replace(/^0/, '') : '';

      if (currentFormat === 12 && hour === 12) {
        displayDate.setHours(hour + 1, 0, 0, 0);
        element.textContent = dateFormat.localeFormat(displayDate, '%p');
      }
    } else {
      element.textContent = hour !== 24 ?
        dateFormat.localeFormat(displayDate, '%H') : '';
    }
  });
};

/**
 * Localize a single element expected to have data-l10n-date-format.
 *
 * Options:
 *
 *   (Boolean) addAmPmClass
 *   (Boolean) removeLeadingZero
 */
exports.localizeElement = function(element, options) {
  var date = element.dataset.date;
  if (!date) {
    return;
  }

  var l10n = navigator.mozL10n;
  var format = l10n.get(element.dataset.l10nDateFormat);
  if (options && options.addAmPmClass) {
    // developer.mozilla.org/docs/Mozilla/Localization/Localization_best_practices#Avoid_unnecessary_complexity_in_strings
    format = format.replace(/\s*%p\s*/, '<span class="ampm">%p</span>');
  }

  var text = dateFormat.localeFormat(new Date(date), format);
  if (options && options.removeLeadingZero) {
    text = text.replace(/^0/, '');
  }

  element.textContent = text;
};

});

define('models/account',['require','exports','module'],function(require, exports, module) {


function Account(options) {
  var key;

  if (typeof(options) === 'undefined') {
    options = {};
  }

  for (key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key];
    }
  }
}
module.exports = Account;

Account.prototype = {

  /**
   * Type of provider this
   * account requires.
   */
  providerType: null,

  /**
   * ID for this model always set
   * by the store when hydrating
   */
  id: null,

  /**
   * Which preset this model came from.
   */
  preset: null,

  /**
   * Domain for account
   */
  domain: '',

  /**
   * url/path for account
   */
  entrypoint: '',

  /**
   * Location where calendars can be found.
   * May be the same as entrypoint.
   */
  calendarHome: '',

  /**
   * username for authentication
   */
  user: '',

  /**
   * password for authentication
   */
  password: '',

  get fullUrl() {
    return this.domain + this.entrypoint;
  },

  set fullUrl(value) {
    var protocolIdx = value.indexOf('://');

    this.domain = value;
    this.entrypoint = '/';

    if (protocolIdx !== -1) {
      protocolIdx += 3;
      // next chunk
      var domainChunk = value.substr(protocolIdx);
      var pathIdx = domainChunk.indexOf('/');


      if (pathIdx !== -1) {
        pathIdx = pathIdx + protocolIdx;

        this.entrypoint = value.substr(pathIdx);
        this.domain = value.substr(0, pathIdx);
      }

    }
  },

  /**
   * Data only version of this object.
   * Used for both passing data between
   * threads (workers) and persisting data
   * in indexeddb.
   */
  toJSON: function() {
    var output = {};
    var fields = [
      'entrypoint',
      'calendarHome',
      'domain',
      'password',
      'user',
      'accountId',
      'providerType',
      'preset',
      'oauth',
      'syncFlag',
      'error'
    ];

    fields.forEach(function(key) {
      output[key] = this[key];
    }, this);

    if (this.exchange) {
      output.exchange = {
        server: this.exchange.server,
        deviceId: this.exchange.deviceId,
        policyKey: this.exchange.policyKey
      }
    }

    if (this._id || this._id === 0) {
      output._id = this._id;
    }

    return output;
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
/**
 * @fileoverview Utilities for converting async functions which use
 *     node-style callbacks to also cater promises callers.
 */
define('promise',['require','exports','module'],function(require, exports) {


function denodeify(fn) {
  // This is our new, denodeified function. You can interact with it using
  // node-style callbacks or promises.
  return function() {
    // Original arguments to fn.
    var args = Array.slice(arguments);
    var callback = args[args.length - 1];
    if (typeof callback === 'function') {
      // If consumer is trying to interact with node-style callback, let them.
      return fn.apply(this, args);
    }

    // We need the defer style promise api here since we don't want to
    // accidentily step on functions that return things like DOMRequests...
    var deferred = defer();
    args.push((err, result) => {
      if (err) {
        return deferred.reject(err);
      }

      deferred.resolve(result);
    });

    // Return the promise <=> the function doesn't return an object.
    var returnValue = fn.apply(this, args);
    return typeof returnValue === 'object' ? returnValue : deferred.promise;
  };
}
exports.denodeify = denodeify;

function denodeifyAll(object, methods) {
  methods.forEach((method) => {
    object[method] = exports.denodeify(object[method]);
  });
}
exports.denodeifyAll = denodeifyAll;

function defer() {
  var deferred = {};
  var promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  deferred.promise = promise;
  return deferred;
}

});

define('next_tick',['require','exports','module'],function(require, exports, module) {


var resolved = Promise.resolve();

/**
 * Very similar to node's nextTick.
 * Much faster than setTimeout or window.postMessage
 */
module.exports = function(callback) {
  resolved.then(callback);
};

});

define('provider/abstract',['require','exports','module','promise','next_tick'],function(require, exports, module) {


var denodeifyAll = require('promise').denodeifyAll;
var nextTick = require('next_tick');

function Abstract(options) {
  var key;
  for (key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key];
    }
  }


  denodeifyAll(this, [
    'eventCapabilities',
    'getAccount',
    'findCalendars',
    'syncEvents',
    'ensureRecurrencesExpanded',
    'createEvent',
    'updateEvent',
    'deleteEvent'
  ]);
}
module.exports = Abstract;

Abstract.prototype = {
  // orange (used by local calendar)
  defaultColor: '#F97C17',

  /**
   * Does this provider require credentials.
   */
  useCredentials: false,

  /**
   * Does this provider require a url.
   */
  useUrl: false,

  /**
   * Can provider sync with remote server?
   */
  canSync: false,

  /**
   * Can expand recurring events?
   */
  canExpandRecurringEvents: false,

  /**
   *  - domain: (String)
   *  - password: (String)
   *  - user: (String)
   *
   * @param {Object} account user credentials.
   * @param {Function} callback node style (err, result).
   */
  getAccount: function(account, callback) {},

  /**
   * Attempts to find all calendars
   * for a given account.
   *
   *
   * account: (same as getAccount)
   *
   * @param {Object} account user credentials.
   * @param {Function} callback node style (err, result).
   */
  findCalendars: function() {},

  /**
   * Sync remote and local events.
   *
   */
  syncEvents: function(account, calendar, callback) {},

  /**
   * Ensures recurring events are expanded up to the given date.
   *
   * Its very important to correctly return the second callback arg
   * in the subclasses callback. When requiredExpansion is returned as true a
   * second call will likely be made to ensureRecurrencesExpanded to verify
   * there are no more pending events for the date (controller handles this).
   *
   * @param {Date} date to expand recurring events to.
   * @param {Function} callback [err, requiredExpansion].
   *  first argument is error, second indicates if any expansion was done.
   */
  ensureRecurrencesExpanded: function(date, callback) {},

  /**
   * Update an event
   *
   * @param {Object} event record from event store.
   *
   * @param {Object} [busytime] optional busytime instance
   *                 when a busytime is passed the edit is treated
   *                 as an "exception" and will only edit the one recurrence
   *                 related to the busytime. This may result in the creation
   *                 of a new "event" related to the busytime.
   */
  updateEvent: function(event, busytime, callback) {},

  /**
   * Delete event
   *
   * @param {Object} event record from the event store.
   * @param {Object} [busytime] optional busytime instance
   *                 when given it will only remove this occurence/exception
   *                 of the event rather then the entire sequence of events.
   */
  deleteEvent: function(event, busytime, callback) {},

  /**
   * Create an event
   */
  createEvent: function(event, callback) {},

  /**
   * Returns an object with three keys used to
   * determine the capabilities of a given calendar.
   *
   * - canCreate (Boolean)
   * - canUpdate (Boolean)
   * - canDelete (Boolean)
   *
   * @param {Object} calendar full calendar details.
   */
  calendarCapabilities: function(calendar) {
    return {
      canCreateEvent: true,
      canUpdateEvent: true,
      canDeleteEvent: true
    };
  },

  /**
   * Returns the capabilities of a single event.
   *
   * @param {Object} event object.
   * @param {Function} callback [err, caps].
   */
  eventCapabilities: function(event, callback) {
    var caps = this.calendarCapabilities();

    nextTick(function() {
      callback(null, {
        canCreate: caps.canCreateEvent,
        canUpdate: caps.canUpdateEvent,
        canDelete: caps.canDeleteEvent
      });
    });
  }
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

/**
 * EventMutations are a simple wrapper for a
 * set of idb transactions that span multiple
 * stores and calling out to the time controller
 * at appropriate times so it can cache the information.
 *
 *
 * Examples:
 *
 *
 *    // create an event
 *    var mutation = Calendar.EventMutations.create({
 *      // this class does not handle/process events
 *      // only persisting the records. Busytimes will
 *      // automatically be recreated.
 *      event: event
 *    });
 *
 *    // add an optional component
 *    // mutation.icalComponent = component;
 *
 *    mutation.commit(function(err) {
 *      if (err) {
 *        // handle it
 *      }
 *
 *      // success event/busytime/etc.. has been created
 *    });
 *
 *
 *    // update an event:
 *    // update shares an identical api but will
 *    // destroy/recreate associated busytimes with event.
 *    var mutation = Calendar.EventMutations.update({
 *      event: event
 *    });
 *
 *    mutation.commit(function() {
 *
 *    });
 *
 *
 */
define('event_mutations',['require','exports','module','calc','ext/uuid'],function(require, exports) {


var Calc = require('calc');
var uuid = require('ext/uuid');

/**
 * Create a single instance busytime for the given event object.
 *
 * @param {Object} event to create busytime for.
 */
function createBusytime(event) {
  return {
    _id: event._id + '-' + uuid.v4(),
    eventId: event._id,
    calendarId: event.calendarId,
    start: event.remote.start,
    end: event.remote.end
  };
}

function Create(options) {
  if (options) {
    for (var key in options) {
      if (options.hasOwnProperty(key)) {
        this[key] = options[key];
      }
    }
  }
}

Create.prototype = {
  commit: function(callback) {
    var app = exports.app;
    var alarmStore = app.store('Alarm');
    var eventStore = app.store('Event');
    var busytimeStore = app.store('Busytime');
    var componentStore = app.store('IcalComponent');

    var trans = eventStore.db.transaction(
      eventStore._dependentStores,
      'readwrite'
    );

    trans.oncomplete = function commitComplete() {
      callback(null);
    };

    trans.onerror = function commitError(e) {
      callback(e.target.error);
    };

    eventStore.persist(this.event, trans);

    if (!this.busytime) {
      this.busytime = createBusytime(this.event);
    }

    if (!this.event.remote.isRecurring) {
      busytimeStore.persist(this.busytime, trans);
    }

    if (this.icalComponent) {
      componentStore.persist(this.icalComponent, trans);
    }

    var alarms = this.event.remote.alarms;
    if (alarms && alarms.length) {
      var i = 0;
      var len = alarms.length;
      var now = Date.now();

      var alarmTrans = alarmStore.db.transaction(
        ['alarms'],
        'readwrite'
      );

      for (; i < len; i++) {

        var alarm = {
          startDate: {
            offset: this.busytime.start.offset,
            utc: this.busytime.start.utc + (alarms[i].trigger * 1000),
            tzid: this.busytime.start.tzid
          },
          eventId: this.busytime.eventId,
          busytimeId: this.busytime._id
        };

        var alarmDate = Calc.dateFromTransport(this.busytime.end).valueOf();
        if (alarmDate < now) {
          continue;
        }

        alarmStore.persist(alarm, alarmTrans);
      }
    }
  }

};

function Update() {
  Create.apply(this, arguments);
}

Update.prototype = {
  commit: function(callback) {
    var app = exports.app;
    var busytimeStore = app.store('Busytime');

    var self = this;

    // required so UI knows to refresh even in the
    // case where the start/end times are the same.
    busytimeStore.removeEvent(this.event._id, function(err) {
      if (err) {
        callback(err);
        return;
      }

      Create.prototype.commit.call(self, callback);
    });
  }
};

/**
 * Will be injected...
 */
exports.app = null;

exports.create = function createMutation(option) {
  return new Create(option);
};

exports.update = function updateMutation(option) {
  return new Update(option);
};

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

define("shared/notification_helper", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.NotificationHelper;
    };
}(this)));

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



(function(window) {

  // Placeholder for storing statically generated performance timestamps,
  // similar to window.performance
  window.mozPerformance = {
    timing: {}
  };

  function dispatch(name) {
    if (!window.mozPerfHasListener) {
      return;
    }

    var now = window.performance.now();
    var epoch = Date.now();

    setTimeout(function() {
      var detail = {
        name: name,
        timestamp: now,
        epoch: epoch
      };
      var event = new CustomEvent('x-moz-perf', { detail: detail });

      window.dispatchEvent(event);
    });
  }

  [
    'moz-chrome-dom-loaded',
    'moz-chrome-interactive',
    'moz-app-visually-complete',
    'moz-content-interactive',
    'moz-app-loaded'
  ].forEach(function(eventName) {
      window.addEventListener(eventName, function mozPerfLoadHandler() {
        dispatch(eventName);
      }, false);
    });

  window.PerformanceTestingHelper = {
    dispatch: dispatch
  };

})(window);

define("shared/performance_testing_helper", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.PerformanceTestingHelper;
    };
}(this)));

define('performance',['require','exports','module','shared/performance_testing_helper'],function(require, exports) {


require('shared/performance_testing_helper');

// Helper for the performance testing events. we created
// this dedicated module since we need some "state machine" logic to avoid
// race conditions and the app contains way too many async operations during
// startup and no simple way to listen to these events.

exports._isMonthAgendaInteractive = false;
exports._isMonthReady = false;
exports._isVisuallyActive = false;
exports._isPendingReady = false;

// TODO: It would be nice if this had an events interface so I could
//     simply do performance.once('moz-app-loaded', () => ...) and
//     I would be called immediately if we were already loaded or
//     when we're loaded otherwise.
var dispatched = {};

/**
 * Performance testing events. See <https://bugzil.la/996038>.
 */
function dispatch(eventType) {
  dispatched[eventType] = true;
  window.dispatchEvent(new CustomEvent(eventType));
}

exports.isComplete = function(eventType) {
  return dispatched[eventType];
};

/**
 * Dispatch 'moz-chrome-dom-loaded' event.
 * Designates that the app's *core* chrome or navigation interface
 * exists in the DOM and is marked as ready to be displayed.
 */
exports.domLoaded = function() {
  window.performance.mark('navigationLoaded');
  // PERFORMANCE EVENT (1): moz-chrome-dom-loaded
  dispatch('moz-chrome-dom-loaded');
};

/**
 * Designates that the app's *core* chrome or navigation interface
 * has its events bound and is ready for user interaction.
 */
exports.chromeInteractive = function() {
  window.performance.mark('navigationInteractive');
  // PERFORMANCE EVENT (2): moz-chrome-interactive
  dispatch('moz-chrome-interactive');
};

/**
 * Should be called when the MonthsDayView
 * rendered all the busytimes for that day.
 */
exports.monthsDayReady = function() {
  if (exports._isMonthAgendaInteractive) {
    return;
  }

  exports._isMonthAgendaInteractive = true;
  dispatchVisuallyCompleteAndInteractive();
};

/**
 * Should be called when the month is "ready" (rendered + event listeners)
 * including the busy times indicator.
 */
exports.monthReady = function() {
  if (exports._isMonthReady) {
    return;
  }

  exports._isMonthReady = true;
  dispatchVisuallyCompleteAndInteractive();
};

/**
 * app-visually-complete and content-interactive will happen after the
 * MonthChild#activate + rendering the busy counts for the current month +
 * DayBased#_loadRecords (inherited by MonthsDayView)
 */
function dispatchVisuallyCompleteAndInteractive() {
  if (exports._isVisuallyActive ||
      !exports._isMonthAgendaInteractive ||
      !exports._isMonthReady) {
    return;
  }

  exports._isVisuallyActive = true;

  // PERFORMANCE EVENT (3): moz-app-visually-complete
  // Designates that the app is visually loaded (e.g.: all of the
  // "above-the-fold" content exists in the DOM and is marked as
  // ready to be displayed).
  window.performance.mark('visuallyLoaded');
  dispatch('moz-app-visually-complete');

  // PERFORMANCE EVENT (4): moz-content-interactive
  // Designates that the app has its events bound for the minimum
  // set of functionality to allow the user to interact with the
  // "above-the-fold" content.
  window.performance.mark('contentInteractive');
  dispatch('moz-content-interactive');

  dispatchAppLoad();
}

/**
 * Register that pending manager completed first batch of operations.
 */
exports.pendingReady = function() {
  if (exports._isPendingReady) {
    return;
  }

  exports._isPendingReady = true;
  dispatchAppLoad();
};

/**
 * App is only considered "loaded" after the MonthView and MonthDayAgenda
 * are "ready" and the first pending operations batch is completed (loading
 * events from DB and recurring events expansion).
 */
function dispatchAppLoad() {
  if (!exports._isPendingReady) {
    // to avoid race conditions (in case this is called before month view
    // is built), should not happen, but maybe in the future when IDB gets
    // faster this might be possible.
    return;
  }

  // PERFORMANCE EVENT (5): moz-app-loaded
  // Designates that the app is *completely* loaded and all relevant
  // "below-the-fold" content exists in the DOM, is marked visible,
  // has its events bound and is ready for user interaction. All
  // required startup background processing should be complete.
  window.performance.mark('fullyLoaded');
  dispatch('moz-app-loaded');
}

});


;(function(){

  /**
   * Perform initial dispatch.
   */

  var dispatch = true;

  /**
   * Base path.
   */

  var base = '';

  /**
   * Running flag.
   */

  var running;

  /**
   * Register `path` with callback `fn()`,
   * or route `path`, or `page.start()`.
   *
   *   page(fn);
   *   page('*', fn);
   *   page('/user/:id', load, user);
   *   page('/user/' + user.id, { some: 'thing' });
   *   page('/user/' + user.id);
   *   page();
   *
   * @param {String|Function} path
   * @param {Function} fn...
   * @api public
   */

  function page(path, fn) {
    // <callback>
    if ('function' == typeof path) {
      return page('*', path);
    }

    // route <path> to <callback ...>
    if ('function' == typeof fn) {
      var route = new Route(path);
      for (var i = 1; i < arguments.length; ++i) {
        page.callbacks.push(route.middleware(arguments[i]));
      }
    // show <path> with [state]
    } else if ('string' == typeof path) {
      page.show(path, fn);
    // start [options]
    } else {
      page.start(path);
    }
  }

  /**
   * Callback functions.
   */

  page.callbacks = [];

  /**
   * Get or set basepath to `path`.
   *
   * @param {String} path
   * @api public
   */

  page.base = function(path){
    if (0 == arguments.length) return base;
    base = path;
  };

  /**
   * Bind with the given `options`.
   *
   * Options:
   *
   *    - `click` bind to click events [true]
   *    - `popstate` bind to popstate [true]
   *    - `dispatch` perform initial dispatch [true]
   *
   * @param {Object} options
   * @api public
   */

  page.start = function(options){
    options = options || {};
    if (running) return;
    running = true;
    if (false === options.dispatch) dispatch = false;
    if (false !== options.popstate) window.addEventListener('popstate', onpopstate, false);
    if (false !== options.click) window.addEventListener('click', onclick, false);
    if (!dispatch) return;
    page.replace(location.pathname + location.search, null, true, dispatch);
  };

  /**
   * Unbind click and popstate event handlers.
   *
   * @api public
   */

  page.stop = function(){
    running = false;
    removeEventListener('click', onclick, false);
    removeEventListener('popstate', onpopstate, false);
  };

  /**
   * Show `path` with optional `state` object.
   *
   * @param {String} path
   * @param {Object} state
   * @return {Context}
   * @api public
   */

  page.show = function(path, state){
    var ctx = new Context(path, state);
    page.dispatch(ctx);
    if (!ctx.unhandled) ctx.pushState();
    return ctx;
  };

  /**
   * Replace `path` with optional `state` object.
   *
   * @param {String} path
   * @param {Object} state
   * @return {Context}
   * @api public
   */

  page.replace = function(path, state, init, dispatch){
    var ctx = new Context(path, state);
    ctx.init = init;
    if (null == dispatch) dispatch = true;
    if (dispatch) page.dispatch(ctx);
    ctx.save();
    return ctx;
  };

  /**
   * Dispatch the given `ctx`.
   *
   * @param {Object} ctx
   * @api private
   */

  page.dispatch = function(ctx){
    var i = 0;

    function next() {
      var fn = page.callbacks[i++];
      if (!fn) return unhandled(ctx);
      fn(ctx, next);
    }

    next();
  };

  /**
   * Unhandled `ctx`. When it's not the initial
   * popstate then redirect. If you wish to handle
   * 404s on your own use `page('*', callback)`.
   *
   * @param {Context} ctx
   * @api private
   */

  function unhandled(ctx) {
    if (window.location.pathname + window.location.search == ctx.canonicalPath) return;
    page.stop();
    ctx.unhandled = true;
    window.location = ctx.canonicalPath;
  }

  /**
   * Initialize a new "request" `Context`
   * with the given `path` and optional initial `state`.
   *
   * @param {String} path
   * @param {Object} state
   * @api public
   */

  function Context(path, state) {
    if ('/' == path[0] && 0 != path.indexOf(base)) path = base + path;
    var i = path.indexOf('?');
    this.canonicalPath = path;
    this.path = path.replace(base, '') || '/';
    this.title = document.title;
    this.state = state || {};
    this.state.path = path;
    this.querystring = ~i ? path.slice(i + 1) : '';
    this.pathname = ~i ? path.slice(0, i) : path;
    this.params = [];
  }

  /**
   * Expose `Context`.
   */

  page.Context = Context;

  /**
   * Push state.
   *
   * @api private
   */

  Context.prototype.pushState = function(){
    history.pushState(this.state, this.title, this.canonicalPath);
  };

  /**
   * Save the context state.
   *
   * @api public
   */

  Context.prototype.save = function(){
    history.replaceState(this.state, this.title, this.canonicalPath);
  };

  /**
   * Initialize `Route` with the given HTTP `path`,
   * and an array of `callbacks` and `options`.
   *
   * Options:
   *
   *   - `sensitive`    enable case-sensitive routes
   *   - `strict`       enable strict matching for trailing slashes
   *
   * @param {String} path
   * @param {Object} options.
   * @api private
   */

  function Route(path, options) {
    options = options || {};
    this.path = path;
    this.method = 'GET';
    this.regexp = pathtoRegexp(path
      , this.keys = []
      , options.sensitive
      , options.strict);
  }

  /**
   * Expose `Route`.
   */

  page.Route = Route;

  /**
   * Return route middleware with
   * the given callback `fn()`.
   *
   * @param {Function} fn
   * @return {Function}
   * @api public
   */

  Route.prototype.middleware = function(fn){
    var self = this;
    return function(ctx, next){
      if (self.match(ctx.path, ctx.params)) return fn(ctx, next);
      next();
    }
  };

  /**
   * Check if this route matches `path`, if so
   * populate `params`.
   *
   * @param {String} path
   * @param {Array} params
   * @return {Boolean}
   * @api private
   */

  Route.prototype.match = function(path, params){
    var keys = this.keys
      , qsIndex = path.indexOf('?')
      , pathname = ~qsIndex ? path.slice(0, qsIndex) : path
      , m = this.regexp.exec(pathname);
  
    if (!m) return false;

    for (var i = 1, len = m.length; i < len; ++i) {
      var key = keys[i - 1];

      var val = 'string' == typeof m[i]
        ? decodeURIComponent(m[i])
        : m[i];

      if (key) {
        params[key.name] = undefined !== params[key.name]
          ? params[key.name]
          : val;
      } else {
        params.push(val);
      }
    }

    return true;
  };

  /**
   * Normalize the given path string,
   * returning a regular expression.
   *
   * An empty array should be passed,
   * which will contain the placeholder
   * key names. For example "/user/:id" will
   * then contain ["id"].
   *
   * @param  {String|RegExp|Array} path
   * @param  {Array} keys
   * @param  {Boolean} sensitive
   * @param  {Boolean} strict
   * @return {RegExp}
   * @api private
   */

  function pathtoRegexp(path, keys, sensitive, strict) {
    if (path instanceof RegExp) return path;
    if (path instanceof Array) path = '(' + path.join('|') + ')';
    path = path
      .concat(strict ? '' : '/?')
      .replace(/\/\(/g, '(?:/')
      .replace(/\+/g, '__plus__')
      .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g, function(_, slash, format, key, capture, optional){
        keys.push({ name: key, optional: !! optional });
        slash = slash || '';
        return ''
          + (optional ? '' : slash)
          + '(?:'
          + (optional ? slash : '')
          + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
          + (optional || '');
      })
      .replace(/([\/.])/g, '\\$1')
      .replace(/__plus__/g, '(.+)')
      .replace(/\*/g, '(.*)');
    return new RegExp('^' + path + '$', sensitive ? '' : 'i');
  };

  /**
   * Handle "populate" events.
   */

  function onpopstate(e) {
    if (e.state) {
      var path = e.state.path;
      page.replace(path, e.state);
    }
  }

  /**
   * Handle "click" events.
   */

  function onclick(e) {
    if (1 != which(e)) return;
    if (e.defaultPrevented) return;
    var el = e.target;
    while (el && 'A' != el.nodeName) el = el.parentNode;
    if (!el || 'A' != el.nodeName) return;
    var href = el.href;
    var path = el.pathname + el.search;
    if (el.hash || '#' == el.getAttribute('href')) return;
    if (!sameOrigin(href)) return;
    var orig = path;
    path = path.replace(base, '');
    if (base && orig == path) return;
    e.preventDefault();
    page.show(orig);
  }

  /**
   * Event button.
   */

  function which(e) {
    e = e || window.event;
    return null == e.which
      ? e.button
      : e.which;
  }

  /**
   * Check if `href` is the same origin.
   */

  function sameOrigin(href) {
    var origin = location.protocol + '//' + location.hostname;
    if (location.port) origin += ':' + location.port;
    return 0 == href.indexOf(origin);
  }

  /**
   * Expose `page`.
   */

  if ('undefined' == typeof module) {
    window.page = page;
  } else {
    module.exports = page;
  }

})();

define("ext/page", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.page;
    };
}(this)));

/* jshint loopfunc: true */
define('router',['require','exports','module','ext/page'],function(require, exports, module) {


var COPY_METHODS = ['start', 'stop', 'show'];

var page = require('ext/page');

function Router() {
  var i = 0;
  var len = COPY_METHODS.length;

  this.page = page;
  this._activeObjects = [];

  for (; i < len; i++) {
    this[COPY_METHODS[i]] = page[COPY_METHODS[i]].bind(page);
  }

  this._lastState = this._lastState.bind(this);
}

Router.prototype = {

  go: function(path, context) {
    this.show(path, context);
  },

  /**
   * Tells router to manage the object.
   * This will call the 'onactive'
   * method if present on the object.
   *
   * When the route is changed all 'manged'
   * object will be cleared and 'oninactive'
   * will be fired.
   */
  mangeObject: function() {
    var args = Array.prototype.slice.call(arguments);
    var object = args.shift();

    this._activeObjects.push(object);
    // intentionally using 'in'
    if ('onactive' in object) {
      object.onactive.apply(object, args);
    }
  },

  /**
   * Clears active objects, calls oninactive
   * on object if available.
   */
  clearObjects: function() {
    var item;
    while ((item = this._activeObjects.pop())) {
      // intentionally using 'in'
      if ('oninactive' in item) {
        item.oninactive();
      }
    }
  },

  /**
   * This method serves two purposes.
   *
   * 1. to safely end the loop by _not_ calling next.
   * 2. to store the last location.
   *
   * This function is added to the end of every rule.
   */
  _lastState: function(ctx) {
    this.last = ctx;
  },

  resetState: function() {
    if (!this.currentPath) {
      this.currentPath = '/month/';
    }

    this.show(this.currentPath);
  },

  /**
   * Adds a route that represents a state of the page.
   * The theory is that a page can only enter
   * one state at a time (basically yield control to some
   * view or other object).
   *
   * Modifiers can be used to alter the behaviour
   * of a given state (without exiting it)
   *
   * @param {String} path path as defined by page.js.
   * @param {String|Array} one or multiple view identifiers.
   * @param {Object} options (clear, path).
   */
  state: function(path, views, options) {

    options = options || {};
    if (!Array.isArray(views)) {
      views = [views];
    }

    var self = this;
    var viewObjs = [];

    function loadAllViews(ctx, next) {
      var len = views.length;
      var numViews = len;
      var i;

      // Reset our views
      viewObjs = [];

      /*jshint loopfunc: true */
      for (i = 0; i < numViews; i++) {
        self.app.view(views[i], function(view) {
          viewObjs.push(view);
          len--;

          if (!len) {
            next();
          }
        });
      }
    }

    function setPath(ctx, next) {
      // Only set the dataset path after the view has loaded
      // its resources. Otherwise, there is some flash and
      // jank while styles start to apply and the view is only
      // partially loaded.
      if (options.path !== false) {
        document.body.dataset.path = ctx.canonicalPath;
        // Need to trigger the DOM to accept the new style
        // right away. Otherwise, once manageObject is called,
        // any styles/animations it triggers may be delayed
        // or dropped as the browser coalesces style changes
        // into one visible change. Example is the settings
        // drawer animation getting chopped so it is not smooth.
        document.body.clientWidth;
      }
      next();
    }

    function handleViews(ctx, next) {

      // Clear views if needed
      if (options.clear !== false) {
        self.clearObjects();
      }

      // Activate objects
      for (var i = 0; i < viewObjs.length; i++) {
        self.mangeObject(viewObjs[i], ctx);
      }

      // Set the current path
      if (options.appPath !== false) {
        self.currentPath = ctx.canonicalPath;
        var evt = new CustomEvent("page-changed", {
          detail: {
            page: self.currentPath
          },
          bubbles: true,
          cancelable: false
        });
        window.dispatchEvent(evt);
      }

      next();
    }

    this.page(path, loadAllViews, setPath, handleViews, this._lastState);
  },

  /**
   * Adds a modifier route
   * Modifiers are essentially views, without the currentPath updating
   */
  modifier: function(path, view, options) {
    options = options || {};
    options.appPath = false;
    options.clear = false;
    this.state(path, view, options);
  }
};

// router is singleton to simplify dependency graph, specially since it's
// needed by notifications and it could get into weird race conditions
module.exports = new Router();

});

/* global Notification */
define('notification',['require','exports','module','shared/notification_helper','debug','performance','router'],function(require, exports, module) {


var NotificationHelper = require('shared/notification_helper');
var debug = require('debug')('notification');
var performance = require('performance');
var router = require('router');

var cachedSelf;
var lock = null

exports.sendNotification = function(title, body, url) {
  return getSelf().then(app => {
    if (!app) {
      // This is perhaps a test environment?
      debug('mozApps.getSelf gave us lemons!');
      return Promise.resolve();
    }

    var icon = NotificationHelper.getIconURI(app);
    icon += '?';
    icon += url;
    var notification = new Notification(title, {
      body: body,
      icon: icon,
      // we use the URL as the ID so we display a single notification for each
      // busytime (it will override previous notifications)
      tag: url
    });
    return new Promise((resolve, reject) => {
      notification.onshow = resolve;
      notification.onerror = reject;
      notification.onclick = function() {
        launch(url);
      };
    });
  });
};

/**
 * Bug 987458 - Multipe requests to mozApps.getSelf will fail if fired
 *     in close succession. Therefore we must make sure to only ever fire
 *     a single request to getSelf.
 */
function getSelf() {
  if (!cachedSelf) {
    cachedSelf = new Promise((resolve, reject) => {
      var request = navigator.mozApps.getSelf();

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = () => {
        reject(new Error('mozApps.getSelf failed!'));
      };
    });
  }

  return cachedSelf;
}

/**
 * Start the calendar app and open the url.
 */
function launch(url) {
  // we close all the notifications for the same busytime when we launch the
  // app; we do it like this to make sure we use the same codepath for cases
  // where notification was handled by mozSetMessageHandler or by the
  // Notification instance onclick listener (Bug 1132336)
  closeNotifications(url);

  if (performance.isComplete('moz-app-loaded')) {
    return foreground(url);
  }

  // If we're not fully loaded, wait for that to happen to foreground
  // ourselves and navigate to the target url so the user
  // experiences less flickering.
  window.addEventListener('moz-app-loaded', function onMozAppLoaded() {
    window.removeEventListener('moz-app-loaded', onMozAppLoaded);
    return foreground(url);
  });
}
exports.launch = launch;

// Bring ourselves to the foreground at some url.
function foreground(url) {
  return getSelf().then(app => {
    router.go(url);
    return app && app.launch();
  });
}

function closeNotifications(url) {
  Notification.get({ tag: url }).then(notifications => {
    notifications.forEach(n => n.close());
  });
}

exports.closeNotifications = closeNotifications;

});

define('provider/caldav_pull_events',['require','exports','module','calc','debug','ext/uuid'],function(require, exports, module) {


var Calc = require('calc');
var debug = require('debug')('pull events');
var uuid = require('ext/uuid');

/**
 * Event synchronization class for caldav provider.
 *
 * Options:
 *  - app: current calendar app
 *  - account: (Calendar.Models.Account) required
 *  - calendar: (Calendar.Models.Calendar) required
 *
 * Example:
 *
 *    // instance of a service stream
 *    var stream;
 *
 *    var pull = new Calendar.Provider.CaldavPullEvents(stream, {
 *      calendar: calendarModel,
 *      account: accountModel,
 *      app: Calendar.App
 *    });
 *
 *    stream.request(function() {
 *      // stream is complete here the audit of
 *      // events can be made. They are flushed
 *      // to the cache where possible but not actually
 *      // persisted in the database.
 *
 *      // assuming we are ready commit the changes
 *      pull.commit(function(err) {
 *        // all changes have been committed at this point.
 *      });
 *    });
 *
 * @param {Calendar.Responder} stream event emitter usually
 *                                    a service stream.
 * @param {Object} options options for instance (see above).
 */
function PullEvents(stream, options) {
  if (options.calendar) {
    this.calendar = options.calendar;
  } else {
    throw new Error('.calendar option must be given');
  }

  if (options.account) {
    this.account = options.account;
  } else {
    throw new Error('.account option must be given');
  }

  this.app = options.app;

  stream.on('event', this);
  stream.on('component', this);
  stream.on('occurrence', this);
  stream.on('missingEvents', this);

  this.icalQueue = [];
  this.eventQueue = [];
  this.busytimeQueue = [];
  this.alarmQueue = [];

  this._busytimeStore = this.app.store('Busytime');

  // Catch account events to watch for mid-sync removal
  this._accountStore = this.app.store('Account');
  this._accountStore.on('remove', this._onRemoveAccount.bind(this));

  this._aborted = false;
  this._trans = null;
}
module.exports = PullEvents;

PullEvents.prototype = {
  eventQueue: null,
  busytimeQueue: null,

  /**
   * Get db id for busytime.
   *
   * @param {Object} busytime service sent busytime.
   */
  busytimeIdFromRemote: function(busytime) {
    var eventId = this.eventIdFromRemote(busytime, !busytime.isException);

    return busytime.start.utc + '-' +
           busytime.end.utc + '-' +
           eventId;
  },

  /**
   * Get db id for event.
   *
   * @param {Object} event service sent event or '.remote'
   *                       property in db event.
   *
   * @param {Boolean} ignoreException when true will ignore
   *                                  recurrence exceptions.
   *
   * @return {String} database object id.
   */
  eventIdFromRemote: function(event, ignoreException) {
    var id = event.eventId || event.id;

    if (!ignoreException && event.recurrenceId) {
      id += '-' + event.recurrenceId.utc;
    }

    return this.calendar._id + '-' + id;
  },

  /**
   * Format an incoming event.
   *
   * @param {Object} event service sent event.
   */
  formatEvent: function(event) {
    // get id or parent id we ignore the exception
    // rules here so children (exceptions) can lookup
    // their parents id.
    var id = this.eventIdFromRemote(event, true);

    var result = Object.create(null);
    result.calendarId = this.calendar._id;
    result.remote = event;

    if (event.recurrenceId) {
      result.parentId = id;
      // don't ignore the exceptions
      result._id = this.eventIdFromRemote(event);
    } else {
      result._id = id;
    }

    return result;
  },

  /**
   * Formats and tags busytime sent from service.
   *
   * @param {Object} time service sent busytime.
   */
  formatBusytime: function(time) {
    var eventId = this.eventIdFromRemote(time, !time.isException);
    var id = eventId + '-' + uuid.v4();
    var calendarId = this.calendar._id;

    time._id = id;
    time.calendarId = calendarId;
    time.eventId = eventId;

    if (time.alarms) {
      var i = 0;
      var len = time.alarms.length;
      var alarm;

      for (; i < len; i++) {
        alarm = time.alarms[i];
        alarm.eventId = eventId;
        alarm.busytimeId = id;
      }
    }

    return this._busytimeStore.initRecord(time);
  },

  handleOccurrenceSync: function(item) {
    var alarms;

    if ('alarms' in item) {
      alarms = item.alarms;
      delete item.alarms;

      if (alarms.length) {
        var i = 0;
        var len = alarms.length;
        var now = Date.now();

        for (; i < len; i++) {
          var alarm = {
            startDate: {},
            eventId: item.eventId,
            busytimeId: item._id
          };

          // Copy the start object
          for (var j in item.start) {
            alarm.startDate[j] = item.start[j];
          }
          alarm.startDate.utc += (alarms[i].trigger * 1000);

          var alarmDate = Calc.dateFromTransport(item.end);
          if (alarmDate.valueOf() < now) {
            continue;
          }
          this.alarmQueue.push(alarm);
        }
      }
    }

    this.busytimeQueue.push(item);
  },

  handleComponentSync: function(component) {
    component.eventId = this.eventIdFromRemote(component);
    component.calendarId = this.calendar._id;

    if (!component.lastRecurrenceId) {
      delete component.lastRecurrenceId;
    }

    this.icalQueue.push(component);
  },

  /**
   * Type:
   * 0: Recurs daily.
   * 1: Recurs weekly
   * 2: Recurs monthly
   *
   * Interval：
   * The Interval specifies the interval between recurrences.
   *
   */
  decodeRecurRule: function(event) {
    let repeatRule = 'never';
    let rrule = event.remote.rrule;

    if (rrule.freq === 'DAILY' && rrule.interval === 1) {
      repeatRule = 'every-day';
    } else if (rrule.freq === 'WEEKLY' && rrule.interval === 1) {
      repeatRule = 'every-week';
    } else if (rrule.freq === 'WEEKLY' && rrule.interval === 2) {
      repeatRule = 'every-2-weeks';
    } else if (rrule.freq === 'MONTHLY' && rrule.interval === 1) {
      repeatRule = 'every-month';
    }

    return repeatRule;
  },

  handleEventSync: function(event) {
    var exceptions = event.remote.exceptions;
    delete event.remote.exceptions;

    var id = event._id;

    // clear any busytimes that could possibly be
    // related to this event as we will be adding new
    // ones as part of the sync.
    this._busytimeStore.removeEvent(id);

    event.remote.repeat =
      event.remote.rrule ? this.decodeRecurRule(event) : 'never';
    this.eventQueue.push(event);

    var component = event.remote.icalComponent;
    delete event.remote.icalComponent;

    // don't save components for exceptions.
    // the parent has the ical data.
    if (!event.remote.recurrenceId) {
      this.icalQueue.push({
        data: component,
        eventId: event._id
      });
    }

    if (exceptions) {
      for (var i = 0; i < exceptions.length; i++) {
        this.handleEventSync(this.formatEvent(exceptions[i]));
      }
    }
  },

  /**
   * Account removal event handler. Aborts the rest of sync processing, if
   * the account deleted is the subject of the current sync.
   *
   * @param {String} database object id.
   */
  _onRemoveAccount: function(id) {
    if (id === this.account._id) {
      // This is our account, so abort the sync.
      this.abort();
    }
  },

  /**
   * Abort the sync. After this, further events will be ignored and commit()
   * will do nothing.
   */
  abort: function() {
    if (this._aborted) {
      // Bail, if already aborted.
      return;
    }
    // Flag that the sync should be aborted.
    this._aborted = true;
    if (this._trans) {
      // Attempt to abort the in-progress commit transaction
      this._trans.abort();
    }
  },

  handleEvent: function(event) {
    if (this._aborted) {
      // Ignore all events, if the sync has been aborted.
      return;
    }

    var data = event.data;

    switch (event.type) {
      case 'missingEvents':
        this.removeList = data[0];
        break;
      case 'occurrence':
        var occur = this.formatBusytime(data[0]);
        this.handleOccurrenceSync(occur);
        break;
      case 'component':
        this.handleComponentSync(data[0]);
        break;
      case 'event':
        var e = this.formatEvent(data[0]);
        this.handleEventSync(e);
        break;
    }

    if (this.account.preset === 'activesync' ||
      this.account.preset === 'local') {
      this.commit((err) => {
        console.log(err);
      });
    }
  },

  /**
   * Commit all pending records.
   *
   *
   * @param {IDBTransaction} [trans] optional transaction.
   * @param {Function} callback fired when transaction completes.
   */
  commit: function(trans, callback) {
    var eventStore = this.app.store('Event');
    var icalComponentStore = this.app.store('IcalComponent');
    var calendarStore = this.app.store('Calendar');
    var busytimeStore = this.app.store('Busytime');
    var alarmStore = this.app.store('Alarm');

    if (typeof(trans) === 'function') {
      callback = trans;
      trans = calendarStore.db.transaction(
        ['calendars', 'events', 'busytimes', 'alarms', 'icalComponents'],
        'readwrite'
      );
    }

    if (this._aborted) {
      // Commit nothing, if sync was aborted.
      return callback && callback(null);
    }

    // Stash a reference to the transaction, in case we still need to abort.
    this._trans = trans;

    var self = this;

    this.eventQueue.forEach(function(event) {
      debug('add event', event);
      eventStore.persist(event, trans);
    });

    this.icalQueue.forEach(function(ical) {
      debug('add component', ical);
      icalComponentStore.persist(ical, trans);
    });

    this.busytimeQueue.forEach(function(busy) {
      debug('add busytime', busy);
      busytimeStore.persist(busy, trans);
    });

    this.alarmQueue.forEach(function(alarm) {
      debug('add alarm', alarm);
      alarmStore.persist(alarm, trans);
    });

    if (this.removeList) {
      this.removeList.forEach(function(id) {
        eventStore.remove(id, trans);
      });
    }

    function handleError(e) {
      if (e && e.type !== 'abort') {
        console.error('Error persisting sync results', e);
      }

      // if we have an event preventDefault so we don't trigger window.onerror
      if (e && e.preventDefault) {
        e.preventDefault();
      }

      self._trans = null;
      callback && callback(e);
    }

    trans.addEventListener('error', handleError);
    trans.addEventListener('abort', handleError);


    trans.addEventListener('complete', function() {
      self._trans = null;
      callback && callback(null);
    });

    this.icalQueue = [];
    this.eventQueue = [];
    this.busytimeQueue = [];
    this.alarmQueue = [];

    return trans;
  }
};

});

define('probably_parse_int',['require','exports','module'],function(require, exports, module) {


var NUMERIC = /^[0-9]+$/;

/**
 * @param {number|string} id Some id.
 */
module.exports = function(id) {
  // by an unfortunate decision we have both
  // string ids and number ids.. based on the
  // input we run parseInt
  if (typeof id === 'string' && id.match(NUMERIC)) {
    return parseInt(id, 10);
  }

  return id;
};

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2011-2012 */

if (typeof ICAL === 'undefined') {
  if (typeof(module) !== 'undefined' && module.exports) {
    // CommonJS
    ICAL = exports;
  } else if (typeof window !== 'undefined') {
    // Browser globals
    this.ICAL = {};
  } else {
    // ...?
    ICAL = {};
  }
}

ICAL.foldLength = 75;
ICAL.newLineChar = '\r\n';

/**
 * Helper functions used in various places within ical.js
 */
ICAL.helpers = {
  initState: function initState(aLine, aLineNr) {
    return {
      buffer: aLine,
      line: aLine,
      lineNr: aLineNr,
      character: 0,
      currentData: null,
      parentData: []
    };
  },

  initComponentData: function initComponentData(aName) {
    return {
      name: aName,
      type: "COMPONENT",
      value: []
    };
  },

  /**
   * Checks if the given number is NaN
   */
  isStrictlyNaN: function(number) {
    return typeof(number) === 'number' && isNaN(number);
  },

  /**
   * Parses a string value that is expected to be an
   * integer, when the valid is not an integer throws
   * a decoration error.
   *
   * @param {String} string raw input.
   * @return {Number} integer.
   */
  strictParseInt: function(string) {
    var result = parseInt(string, 10);

    if (ICAL.helpers.isStrictlyNaN(result)) {
      throw new Error(
        'Could not extract integer from "' + string + '"'
      );
    }

    return result;
  },

  /**
   * Creates or returns a class instance
   * of a given type with the initialization
   * data if the data is not already an instance
   * of the given type.
   *
   *
   * Example:
   *
   *    var time = new ICAL.Time(...);
   *    var result = ICAL.helpers.formatClassType(time, ICAL.Time);
   *
   *    (result instanceof ICAL.Time)
   *    // => true
   *
   *    result = ICAL.helpers.formatClassType({}, ICAL.Time);
   *    (result isntanceof ICAL.Time)
   *    // => true
   *
   *
   * @param {Object} data object initialization data.
   * @param {Object} type object type (like ICAL.Time).
   */
  formatClassType: function formatClassType(data, type) {
    if (typeof(data) === 'undefined')
      return undefined;

    if (data instanceof type) {
      return data;
    }
    return new type(data);
  },

  /**
   * Identical to index of but will only match values
   * when they are not preceded by a backslash char \\\
   *
   * @param {String} buffer string value.
   * @param {String} search value.
   * @param {Numeric} pos start position.
   */
  unescapedIndexOf: function(buffer, search, pos) {
    while ((pos = buffer.indexOf(search, pos)) !== -1) {
      if (pos > 0 && buffer[pos - 1] === '\\') {
        pos += 1;
      } else {
        return pos;
      }
    }
    return -1;
  },

  binsearchInsert: function(list, seekVal, cmpfunc) {
    if (!list.length)
      return 0;

    var low = 0, high = list.length - 1,
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
  },

  dumpn: function() {
    if (!ICAL.debug) {
      return null;
    }

    if (typeof (console) !== 'undefined' && 'log' in console) {
      ICAL.helpers.dumpn = function consoleDumpn(input) {
        return console.log(input);
      }
    } else {
      ICAL.helpers.dumpn = function geckoDumpn(input) {
        dump(input + '\n');
      }
    }

    return ICAL.helpers.dumpn(arguments[0]);
  },

  mixin: function(obj, data) {
    if (data) {
      for (var k in data) {
        obj[k] = data[k];
      }
    }
    return obj;
  },

  isArray: function(o) {
    return o && (o instanceof Array || typeof o == "array");
  },

  clone: function(aSrc, aDeep) {
    if (!aSrc || typeof aSrc != "object") {
      return aSrc;
    } else if (aSrc instanceof Date) {
      return new Date(aSrc.getTime());
    } else if ("clone" in aSrc) {
      return aSrc.clone();
    } else if (ICAL.helpers.isArray(aSrc)) {
      var result = [];
      for (var i = 0; i < aSrc.length; i++) {
        result.push(aDeep ? ICAL.helpers.clone(aSrc[i], true) : aSrc[i]);
      }
      return result;
    } else {
      var result = {};
      for (var name in aSrc) {
        // uses prototype method to allow use of Object.create(null);
        if (Object.prototype.hasOwnProperty.call(aSrc, name)) {
          if (aDeep) {
            result[name] = ICAL.helpers.clone(aSrc[name], true);
          } else {
            result[name] = aSrc[name];
          }
        }
      }
      return result;
    }
  },

  unfoldline: function unfoldline(aState) {
    // Section 3.1
    // if the line ends with a CRLF
    // and the next line starts with a LINEAR WHITESPACE (space, htab, ...)

    // then remove the CRLF and the whitespace to unsplit the line
    var moreLines = true;
    var line = "";

    while (moreLines) {
      moreLines = false;
      var pos = aState.buffer.search(/\r?\n/);
      if (pos > -1) {
        var len = (aState.buffer[pos] == "\r" ? 2 : 1);
        var nextChar = aState.buffer.substr(pos + len, 1);
        if (nextChar.match(/^[ \t]$/)) {
          moreLines = true;
          line += aState.buffer.substr(0, pos);
          aState.buffer = aState.buffer.substr(pos + len + 1);
        } else {
          // We're at the end of the line, copy the found chunk
          line += aState.buffer.substr(0, pos);
          aState.buffer = aState.buffer.substr(pos + len);
        }
      } else {
        line += aState.buffer;
        aState.buffer = "";
      }
    }
    return line;
  },

  foldline: function foldline(aLine) {
    var result = "";
    var line = aLine || "";

    while (line.length) {
      result += ICAL.newLineChar + " " + line.substr(0, ICAL.foldLength);
      line = line.substr(ICAL.foldLength);
    }
    return result.substr(ICAL.newLineChar.length + 1);
  },

  ensureKeyExists: function(obj, key, defvalue) {
    if (!(key in obj)) {
      obj[key] = defvalue;
    }
  },

  hasKey: function(obj, key) {
    return (obj && key in obj && obj[key]);
  },

  pad2: function pad(data) {
    if (typeof(data) !== 'string') {
      // handle fractions.
      if (typeof(data) === 'number') {
        data = parseInt(data);
      }
      data = String(data);
    }

    var len = data.length;

    switch (len) {
      case 0:
        return '00';
      case 1:
        return '0' + data;
      default:
        return data;
    }
  },

  trunc: function trunc(number) {
    return (number < 0 ? Math.ceil(number) : Math.floor(number));
  }
};
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2011-2012 */

(typeof(ICAL) === 'undefined')? ICAL = {} : '';

ICAL.design = (function() {
  

  var ICAL_NEWLINE = /\\\\|\\;|\\,|\\[Nn]/g;

  function DecorationError() {
    Error.apply(this, arguments);
  }

  DecorationError.prototype = {
    __proto__: Error.prototype
  };

  function replaceNewlineReplace(string) {
    switch (string) {
      case "\\\\":
        return "\\";
      case "\\;":
        return ";";
      case "\\,":
        return ",";
      case "\\n":
      case "\\N":
        return "\n";
      default:
        return string;
    }
  }

  function replaceNewline(value) {
    // avoid regex when possible.
    if (value.indexOf('\\') === -1) {
      return value;
    }

    return value.replace(ICAL_NEWLINE, replaceNewlineReplace);
  }

  /**
   * Changes the format of the UNTIl part in the RECUR
   * value type. When no UNTIL part is found the original
   * is returned untouched.
   *
   * @param {String} type toICAL or fromICAL.
   * @param {String} aValue the value to check.
   * @return {String} upgraded/original value.
   */
  function recurReplaceUntil(aType, aValue) {
    var idx = aValue.indexOf('UNTIL=');
    if (idx === -1) {
      return aValue;
    }

    idx += 6;

    // everything before the value
    var begin = aValue.substr(0, idx);

    // everything after the value
    var end;

    // current until value
    var until;

    // end of value could be -1 meaning this is the last param.
    var endValueIdx = aValue.indexOf(';', idx);

    if (endValueIdx === -1) {
      end = '';
      until = aValue.substr(idx);
    } else {
      end = aValue.substr(endValueIdx);
      until = aValue.substr(idx, endValueIdx - idx);
    }

    if (until.length > 10) {
      until = design.value['date-time'][aType](until);
    } else {
      until = design.value.date[aType](until);
    }

    return begin + until + end;
  }
  /**
   * Design data used by the parser to decide if data is semantically correct
   */
  var design = {
    DecorationError: DecorationError,

    defaultType: 'text',

    param: {
      // Although the syntax is DQUOTE uri DQUOTE, I don't think we should
      // enfoce anything aside from it being a valid content line.
      // "ALTREP": { ... },

      // CN just wants a param-value
      // "CN": { ... }

      "cutype": {
        values: ["INDIVIDUAL", "GROUP", "RESOURCE", "ROOM", "UNKNOWN"],
        allowXName: true,
        allowIanaToken: true
      },

      "delegated-from": {
        valueType: "cal-address",
        multiValue: ","
      },
      "delegated-to": {
        valueType: "cal-address",
        multiValue: ","
      },
      // "DIR": { ... }, // See ALTREP
      "encoding": {
        values: ["8BIT", "BASE64"]
      },
      // "FMTTYPE": { ... }, // See ALTREP
      "fbtype": {
        values: ["FREE", "BUSY", "BUSY-UNAVAILABLE", "BUSY-TENTATIVE"],
        allowXName: true,
        allowIanaToken: true
      },
      // "LANGUAGE": { ... }, // See ALTREP
      "member": {
        valueType: "cal-address",
        multiValue: ","
      },
      "partstat": {
        // TODO These values are actually different per-component
        values: ["NEEDS-ACTION", "ACCEPTED", "DECLINED", "TENTATIVE",
                 "DELEGATED", "COMPLETED", "IN-PROCESS"],
        allowXName: true,
        allowIanaToken: true
      },
      "range": {
        values: ["THISLANDFUTURE"]
      },
      "related": {
        values: ["START", "END"]
      },
      "reltype": {
        values: ["PARENT", "CHILD", "SIBLING"],
        allowXName: true,
        allowIanaToken: true
      },
      "role": {
        values: ["REQ-PARTICIPANT", "CHAIR",
                 "OPT-PARTICIPANT", "NON-PARTICIPANT"],
        allowXName: true,
        allowIanaToken: true
      },
      "rsvp": {
        valueType: "boolean"
      },
      "sent-by": {
        valueType: "cal-address"
      },
      "tzid": {
        matches: /^\//
      },
      "value": {
        // since the value here is a 'type' lowercase is used.
        values: ["binary", "boolean", "cal-address", "date", "date-time",
                 "duration", "float", "integer", "period", "recur", "text",
                 "time", "uri", "utc-offset"],
        allowXName: true,
        allowIanaToken: true
      }
    },

    // When adding a value here, be sure to add it to the parameter types!
    value: {

      "binary": {
        decorate: function(aString) {
          return ICAL.Binary.fromString(aString);
        },

        undecorate: function(aBinary) {
          return aBinary.toString();
        }
      },
      "boolean": {
        values: ["TRUE", "FALSE"],

        fromICAL: function(aValue) {
          switch(aValue) {
            case 'TRUE':
              return true;
            case 'FALSE':
              return false;
            default:
              //TODO: parser warning
              return false;
          }
        },

        toICAL: function(aValue) {
          if (aValue) {
            return 'TRUE';
          }
          return 'FALSE';
        }

      },
      "cal-address": {
        // needs to be an uri
      },
      "date": {
        decorate: function(aValue, aProp) {
          return ICAL.Time.fromDateString(aValue, aProp);
        },

        /**
         * undecorates a time object.
         */
        undecorate: function(aValue) {
          return aValue.toString();
        },

        fromICAL: function(aValue) {
          // from: 20120901
          // to: 2012-09-01
          var result = aValue.substr(0, 4) + '-' +
                       aValue.substr(4, 2) + '-' +
                       aValue.substr(6, 2);

          if (aValue[8] === 'Z') {
            result += 'Z';
          }

          return result;
        },

        toICAL: function(aValue) {
          // from: 2012-09-01
          // to: 20120901

          if (aValue.length > 11) {
            //TODO: serialize warning?
            return aValue;
          }

          var result = aValue.substr(0, 4) +
                       aValue.substr(5, 2) +
                       aValue.substr(8, 2);

          if (aValue[10] === 'Z') {
            result += 'Z';
          }

          return result;
        }
      },
      "date-time": {
        fromICAL: function(aValue) {
          // from: 20120901T130000
          // to: 2012-09-01T13:00:00
          var result = aValue.substr(0, 4) + '-' +
                       aValue.substr(4, 2) + '-' +
                       aValue.substr(6, 2) + 'T' +
                       aValue.substr(9, 2) + ':' +
                       aValue.substr(11, 2) + ':' +
                       aValue.substr(13, 2);

          if (aValue[15] === 'Z') {
            result += 'Z'
          }

          return result;
        },

        toICAL: function(aValue) {
          // from: 2012-09-01T13:00:00
          // to: 20120901T130000

          if (aValue.length < 19) {
            // TODO: error
            return aValue;
          }

          var result = aValue.substr(0, 4) +
                       aValue.substr(5, 2) +
                       // grab the (DDTHH) segment
                       aValue.substr(8, 5) +
                       // MM
                       aValue.substr(14, 2) +
                       // SS
                       aValue.substr(17, 2);

          if (aValue[19] === 'Z') {
            result += 'Z';
          }

          return result;
        },

        decorate: function(aValue, aProp) {
          return ICAL.Time.fromDateTimeString(aValue, aProp);
        },

        undecorate: function(aValue) {
          return aValue.toString();
        }
      },
      duration: {
        decorate: function(aValue) {
          return ICAL.Duration.fromString(aValue);
        },
        undecorate: function(aValue) {
          return aValue.toString();
        }
      },
      float: {
        matches: /^[+-]?\d+\.\d+$/,
        decorate: function(aValue) {
          return ICAL.Value.fromString(aValue, "float");
        },

        fromICAL: function(aValue) {
          var parsed = parseFloat(aValue);
          if (ICAL.helpers.isStrictlyNaN(parsed)) {
            // TODO: parser warning
            return 0.0;
          }
          return parsed;
        },

        toICAL: function(aValue) {
          return String(aValue);
        }
      },
      integer: {
        fromICAL: function(aValue) {
          var parsed = parseInt(aValue);
          if (ICAL.helpers.isStrictlyNaN(parsed)) {
            return 0;
          }
          return parsed;
        },

        toICAL: function(aValue) {
          return String(aValue);
        }
      },
      period: {

        fromICAL: function(string) {
          var parts = string.split('/');
          var result = design.value['date-time'].fromICAL(parts[0]) + '/';

          if (ICAL.Duration.isValueString(parts[1])) {
            result += parts[1];
          } else {
            result += design.value['date-time'].fromICAL(parts[1]);
          }

          return result;
        },

        toICAL: function(string) {
          var parts = string.split('/');
          var result = design.value['date-time'].toICAL(parts[0]) + '/';

          if (ICAL.Duration.isValueString(parts[1])) {
            result += parts[1];
          } else {
            result += design.value['date-time'].toICAL(parts[1]);
          }

          return result;
        },

        decorate: function(aValue, aProp) {
          return ICAL.Period.fromString(aValue, aProp);
        },

        undecorate: function(aValue) {
          return aValue.toString();
        }
      },
      recur: {
        fromICAL: recurReplaceUntil.bind(this, 'fromICAL'),
        toICAL: recurReplaceUntil.bind(this, 'toICAL'),

        decorate: function decorate(aValue) {
          return ICAL.Recur.fromString(aValue);
        },

        undecorate: function(aRecur) {
          return aRecur.toString();
        }
      },

      text: {
        matches: /.*/,

        fromICAL: function(aValue, aName) {
          return replaceNewline(aValue);
        },

        toICAL: function escape(aValue, aName) {
          return aValue.replace(/\\|;|,|\n/g, function(str) {
            switch (str) {
            case "\\":
              return "\\\\";
            case ";":
              return "\\;";
            case ",":
              return "\\,";
            case "\n":
              return "\\n";
            default:
              return str;
            }
          });
        }
      },

      time: {
        fromICAL: function(aValue) {
          // from: MMHHSS(Z)?
          // to: HH:MM:SS(Z)?
          if (aValue.length < 6) {
            // TODO: parser exception?
            return aValue;
          }

          // HH::MM::SSZ?
          var result = aValue.substr(0, 2) + ':' +
                       aValue.substr(2, 2) + ':' +
                       aValue.substr(4, 2);

          if (aValue[6] === 'Z') {
            result += 'Z';
          }

          return result;
        },

        toICAL: function(aValue) {
          // from: HH:MM:SS(Z)?
          // to: MMHHSS(Z)?
          if (aValue.length < 8) {
            //TODO: error
            return aValue;
          }

          var result = aValue.substr(0, 2) +
                       aValue.substr(3, 2) +
                       aValue.substr(6, 2);

          if (aValue[8] === 'Z') {
            result += 'Z';
          }

          return result;
        }
      },

      uri: {
        // TODO
        /* ... */
      },

      "utc-offset": {
        toICAL: function(aValue) {
          if (aValue.length < 7) {
            // no seconds
            // -0500
            return aValue.substr(0, 3) +
                   aValue.substr(4, 2);
          } else {
            // seconds
            // -050000
            return aValue.substr(0, 3) +
                   aValue.substr(4, 2) +
                   aValue.substr(7, 2);
          }
        },

        fromICAL: function(aValue) {
          if (aValue.length < 6) {
            // no seconds
            // -05:00
            return aValue.substr(0, 3) + ':' +
                   aValue.substr(3, 2);
          } else {
            // seconds
            // -05:00:00
            return aValue.substr(0, 3) + ':' +
                   aValue.substr(3, 2) + ':' +
                   aValue.substr(5, 2);
          }
        },

        decorate: function(aValue) {
          return ICAL.UtcOffset.fromString(aValue);
        },

        undecorate: function(aValue) {
          return aValue.toString();
        }
      }
    },

    property: {
      decorate: function decorate(aData, aParent) {
        return new ICAL.Property(aData, aParent);
      },
      "attach": {
        defaultType: "uri"
      },
      "attendee": {
        defaultType: "cal-address"
      },
      "categories": {
        defaultType: "text",
        multiValue: ","
      },
      "completed": {
        defaultType: "date-time"
      },
      "created": {
        defaultType: "date-time"
      },
      "dtend": {
        defaultType: "date-time",
        allowedTypes: ["date-time", "date"]
      },
      "dtstamp": {
        defaultType: "date-time"
      },
      "dtstart": {
        defaultType: "date-time",
        allowedTypes: ["date-time", "date"]
      },
      "due": {
        defaultType: "date-time",
        allowedTypes: ["date-time", "date"]
      },
      "duration": {
        defaultType: "duration"
      },
      "exdate": {
        defaultType: "date-time",
        allowedTypes: ["date-time", "date"],
        multiValue: ','
      },
      "exrule": {
        defaultType: "recur"
      },
      "freebusy": {
        defaultType: "period",
        multiValue: ","
      },
      "geo": {
        defaultType: "float",
        multiValue: ";"
      },
      /* TODO exactly 2 values */"last-modified": {
        defaultType: "date-time"
      },
      "organizer": {
        defaultType: "cal-address"
      },
      "percent-complete": {
        defaultType: "integer"
      },
      "repeat": {
        defaultType: "integer"
      },
      "rdate": {
        defaultType: "date-time",
        allowedTypes: ["date-time", "date", "period"],
        multiValue: ',',
        detectType: function(string) {
          if (string.indexOf('/') !== -1) {
            return 'period';
          }
          return (string.indexOf('T') === -1) ? 'date' : 'date-time';
        }
      },
      "recurrence-id": {
        defaultType: "date-time",
        allowedTypes: ["date-time", "date"]
      },
      "resources": {
        defaultType: "text",
        multiValue: ","
      },
      "request-status": {
        defaultType: "text",
        multiValue: ";"
      },
      "priority": {
        defaultType: "integer"
      },
      "rrule": {
        defaultType: "recur"
      },
      "sequence": {
        defaultType: "integer"
      },
      "trigger": {
        defaultType: "duration",
        allowedTypes: ["duration", "date-time"]
      },
      "tzoffsetfrom": {
        defaultType: "utc-offset"
      },
      "tzoffsetto": {
        defaultType: "utc-offset"
      },
      "tzurl": {
        defaultType: "uri"
      },
      "url": {
        defaultType: "uri"
      }
    },

    component: {
      decorate: function decorate(aData, aParent) {
        return new ICAL.Component(aData, aParent);
      },
      "vevent": {}
    }

  };

  return design;
}());
ICAL.stringify = (function() {
  

  var LINE_ENDING = '\r\n';
  var DEFAULT_TYPE = 'text';

  var design = ICAL.design;
  var helpers = ICAL.helpers;

  /**
   * Convert a full jCal Array into a ical document.
   *
   * @param {Array} jCal document.
   * @return {String} ical document.
   */
  function stringify(jCal) {
    if (!jCal[0] || jCal[0] !== 'icalendar') {
      throw new Error('must provide full jCal document');
    }

    // 1 because we skip the initial element.
    var i = 1;
    var len = jCal.length;
    var result = '';

    for (; i < len; i++) {
      result += stringify.component(jCal[i]) + LINE_ENDING;
    }

    return result;
  }

  /**
   * Converts an jCal component array into a ICAL string.
   * Recursive will resolve sub-components.
   *
   * Exact component/property order is not saved all
   * properties will come before subcomponents.
   *
   * @param {Array} component jCal fragment of a component.
   */
  stringify.component = function(component) {
    var name = component[0].toUpperCase();
    var result = 'BEGIN:' + name + LINE_ENDING;

    var props = component[1];
    var propIdx = 0;
    var propLen = props.length;

    for (; propIdx < propLen; propIdx++) {
      result += stringify.property(props[propIdx]) + LINE_ENDING;
    }

    var comps = component[2];
    var compIdx = 0;
    var compLen = comps.length;

    for (; compIdx < compLen; compIdx++) {
      result += stringify.component(comps[compIdx]) + LINE_ENDING;
    }

    result += 'END:' + name;
    return result;
  }

  /**
   * Converts a single property to a ICAL string.
   *
   * @param {Array} property jCal property.
   */
  stringify.property = function(property) {
    var name = property[0].toUpperCase();
    var jsName = property[0];
    var params = property[1];

    var line = name;

    var paramName;
    for (paramName in params) {
      if (params.hasOwnProperty(paramName)) {
        line += ';' + paramName.toUpperCase();
        line += '=' + stringify.propertyValue(params[paramName]);
      }
    }

    // there is no value so return.
    if (property.length === 3) {
      // if no params where inserted and no value
      // we given we must add a blank value.
      if (!paramName) {
        line += ':';
      }
      return line;
    }

    var valueType = property[2];

    var propDetails;
    var multiValue = false;
    var isDefault = false;

    if (jsName in design.property) {
      propDetails = design.property[jsName];

      if ('multiValue' in propDetails) {
        multiValue = propDetails.multiValue;
      }

      if ('defaultType' in propDetails) {
        if (valueType === propDetails.defaultType) {
          isDefault = true;
        }
      } else {
        if (valueType === DEFAULT_TYPE) {
          isDefault = true;
        }
      }
    } else {
      if (valueType === DEFAULT_TYPE) {
        isDefault = true;
      }
    }

    // push the VALUE property if type is not the default
    // for the current property.
    if (!isDefault) {
      // value will never contain ;/:/, so we don't escape it here.
      line += ';VALUE=' + valueType.toUpperCase();
    }

    line += ':';

    if (multiValue) {
      line += stringify.multiValue(
        property.slice(3), multiValue, valueType
      );
    } else {
      line += stringify.value(property[3], valueType);
    }

    return ICAL.helpers.foldline(line);
  }

  /**
   * Handles escaping of property values that may contain:
   *
   *    COLON (:), SEMICOLON (;), or COMMA (,)
   *
   * If any of the above are present the result is wrapped
   * in double quotes.
   *
   * @param {String} value raw value.
   * @return {String} given or escaped value when needed.
   */
  stringify.propertyValue = function(value) {

    if ((helpers.unescapedIndexOf(value, ',') === -1) &&
        (helpers.unescapedIndexOf(value, ':') === -1) &&
        (helpers.unescapedIndexOf(value, ';') === -1)) {

      return value;
    }

    return '"' + value + '"';
  }

  /**
   * Converts an array of ical values into a single
   * string based on a type and a delimiter value (like ",").
   *
   * @param {Array} values list of values to convert.
   * @param {String} delim used to join the values usually (",", ";", ":").
   * @param {String} type lowecase ical value type
   *  (like boolean, date-time, etc..).
   *
   * @return {String} ical string for value.
   */
  stringify.multiValue = function(values, delim, type) {
    var result = '';
    var len = values.length;
    var i = 0;

    for (; i < len; i++) {
      result += stringify.value(values[i], type);
      if (i !== (len - 1)) {
        result += delim;
      }
    }

    return result;
  }

  /**
   * Processes a single ical value runs the associated "toICAL"
   * method from the design value type if available to convert
   * the value.
   *
   * @param {String|Numeric} value some formatted value.
   * @param {String} type lowecase ical value type
   *  (like boolean, date-time, etc..).
   * @return {String} ical value for single value.
   */
  stringify.value = function(value, type) {
    if (type in design.value && 'toICAL' in design.value[type]) {
      return design.value[type].toICAL(value);
    }
    return value;
  }

  return stringify;

}());

ICAL.parse = (function() {
  

  var CHAR = /[^ \t]/;
  var MULTIVALUE_DELIMITER = ',';
  var VALUE_DELIMITER = ':';
  var PARAM_DELIMITER = ';';
  var PARAM_NAME_DELIMITER = '=';
  var DEFAULT_TYPE = 'text';

  var design = ICAL.design;
  var helpers = ICAL.helpers;

  function ParserError(message) {
    this.message = message;

    try {
      throw new Error();
    } catch (e) {
      var split = e.stack.split('\n');
      split.shift();
      this.stack = split.join('\n');
    }
  }

  ParserError.prototype = {
    __proto__: Error.prototype
  };

  function parser(input) {
    var state = {};
    var root = state.component = [
      'icalendar'
    ];

    state.stack = [root];

    parser._eachLine(input, function(err, line) {
      parser._handleContentLine(line, state);
    });


    // when there are still items on the stack
    // throw a fatal error, a component was not closed
    // correctly in that case.
    if (state.stack.length > 1) {
      throw new ParserError(
        'invalid ical body. component began but did not end'
      );
    }

    state = null;

    return root;
  }

  // classes & constants
  parser.ParserError = ParserError;

  parser._formatName = function(name) {
    return name.toLowerCase();
  }

  parser._handleContentLine = function(line, state) {
    // break up the parts of the line
    var valuePos = line.indexOf(VALUE_DELIMITER);
    var paramPos = line.indexOf(PARAM_DELIMITER);

    var lastParamIndex;
    var lastValuePos;

    // name of property or begin/end
    var name;
    var value;
    // params is only overridden if paramPos !== -1.
    // we can't do params = params || {} later on
    // because it sacrifices ops.
    var params = {};

    /**
     * Different property cases
     *
     *
     * 1. RRULE:FREQ=foo
     *    // FREQ= is not a param but the value
     *
     * 2. ATTENDEE;ROLE=REQ-PARTICIPANT;
     *    // ROLE= is a param because : has not happened yet
     */
      // when the parameter delimiter is after the
      // value delimiter then its not a parameter.

    if ((paramPos !== -1 && valuePos !== -1)) {
      // when the parameter delimiter is after the
      // value delimiter then its not a parameter.
      if (paramPos > valuePos) {
        paramPos = -1;
      }
    }

    var parsedParams;
    if (paramPos !== -1) {
      name = line.substring(0, paramPos).toLowerCase();
      parsedParams = parser._parseParameters(line.substring(paramPos), 0);
      params = parsedParams[0];
      lastParamIndex = parsedParams[1].length + parsedParams[2] + paramPos;
      if ((lastValuePos =
        line.substring(lastParamIndex).indexOf(VALUE_DELIMITER)) !== -1) {
        value = line.substring(lastParamIndex + lastValuePos + 1);
      }
    } else if (valuePos !== -1) {
      // without parmeters (BEGIN:VCAENDAR, CLASS:PUBLIC)
      name = line.substring(0, valuePos).toLowerCase();
      value = line.substring(valuePos + 1);

      if (name === 'begin') {
        var newComponent = [value.toLowerCase(), [], []];
        if (state.stack.length === 1) {
          state.component.push(newComponent);
        } else {
          state.component[2].push(newComponent);
        }
        state.stack.push(state.component);
        state.component = newComponent;
        return;
      } else if (name === 'end') {
        state.component = state.stack.pop();
        return;
      }
    } else {
      /**
       * Invalid line.
       * The rational to throw an error is we will
       * never be certain that the rest of the file
       * is sane and its unlikely that we can serialize
       * the result correctly either.
       */
      throw new ParserError(
        'invalid line (no token ";" or ":") "' + line + '"'
      );
    }

    var valueType;
    var multiValue = false;
    var propertyDetails;

    if (name in design.property) {
      propertyDetails = design.property[name];

      if ('multiValue' in propertyDetails) {
        multiValue = propertyDetails.multiValue;
      }

      if (value && 'detectType' in propertyDetails) {
        valueType = propertyDetails.detectType(value);
      }
    }

    // attempt to determine value
    if (!valueType) {
      if (!('value' in params)) {
        if (propertyDetails) {
          valueType = propertyDetails.defaultType;
        } else {
          valueType = DEFAULT_TYPE;
        }
      } else {
        // possible to avoid this?
        valueType = params.value.toLowerCase();
      }
    }

    delete params.value;

    /**
     * Note on `var result` juggling:
     *
     * I observed that building the array in pieces has adverse
     * effects on performance, so where possible we inline the creation.
     * Its a little ugly but resulted in ~2000 additional ops/sec.
     */

    if (value) {
      if (multiValue) {
        var result = [name, params, valueType];
        parser._parseMultiValue(value, multiValue, valueType, result);
      } else {
        value = parser._parseValue(value, valueType);
        var result = [name, params, valueType, value];
      }
    } else {
      var result = [name, params, valueType];
    }

    state.component[1].push(result);
  };

  /**
   * @param {String} value original value.
   * @param {String} type type of value.
   * @return {Object} varies on type.
   */
  parser._parseValue = function(value, type) {
    if (type in design.value && 'fromICAL' in design.value[type]) {
      return design.value[type].fromICAL(value);
    }
    return value;
  };

  /**
   * Parse parameters from a string to object.
   *
   * @param {String} line a single unfolded line.
   * @param {Numeric} start position to start looking for properties.
   * @param {Numeric} maxPos position at which values start.
   * @return {Object} key/value pairs.
   */
  parser._parseParameters = function(line, start) {
    var lastParam = start;
    var pos = 0;
    var delim = PARAM_NAME_DELIMITER;
    var result = {};
    var name;
    var value;
    var type;

    // find the next '=' sign
    // use lastParam and pos to find name
    // check if " is used if so get value from "->"
    // then increment pos to find next ;

    while ((pos !== false) &&
           (pos = helpers.unescapedIndexOf(line, delim, pos + 1)) !== -1) {

      name = line.substr(lastParam + 1, pos - lastParam - 1);

      var nextChar = line[pos + 1];
      if (nextChar === '"') {
        var valuePos = pos + 2;
        pos = helpers.unescapedIndexOf(line, '"', valuePos);
        value = line.substr(valuePos, pos - valuePos);
        lastParam = helpers.unescapedIndexOf(line, PARAM_DELIMITER, pos);
      } else {
        var valuePos = pos + 1;

        // move to next ";"
        var nextPos = helpers.unescapedIndexOf(line, PARAM_DELIMITER, valuePos);
        if (nextPos === -1) {
          // when there is no ";" attempt to locate ":"
          nextPos = helpers.unescapedIndexOf(line, VALUE_DELIMITER, valuePos);

          if (nextPos === -1) {
            nextPos = line.length;
          }
          pos = false;
        } else {
          lastParam = nextPos;
        }

        value = line.substr(valuePos, nextPos - valuePos);
      }

      if (name in design.param && design.param[name].valueType) {
        type = design.param[name].valueType;
      } else {
        type = DEFAULT_TYPE;
      }

      result[name.toLowerCase()] = parser._parseValue(value, type);
    }
    return [result, value, valuePos];
  }

  /**
   * Parse a multi value string
   */
  parser._parseMultiValue = function(buffer, delim, type, result) {
    var pos = 0;
    var lastPos = 0;

    // split each piece
    while ((pos = helpers.unescapedIndexOf(buffer, delim, lastPos)) !== -1) {
      var value = buffer.substr(lastPos, pos - lastPos);
      result.push(parser._parseValue(value, type));
      lastPos = pos + 1;
    }

    // on the last piece take the rest of string
    result.push(
      parser._parseValue(buffer.substr(lastPos), type)
    );

    return result;
  }

  parser._eachLine = function(buffer, callback) {
    var len = buffer.length;
    var lastPos = buffer.search(CHAR);
    var pos = lastPos;
    var line;
    var firstChar;

    var newlineOffset;

    do {
      pos = buffer.indexOf('\n', lastPos) + 1;

      if (buffer[pos - 2] === '\r') {
        newlineOffset = 2;
      } else {
        newlineOffset = 1;
      }

      if (pos === 0) {
        pos = len;
        newlineOffset = 0;
      }

      firstChar = buffer[lastPos];

      if (firstChar === ' ' || firstChar === '\t') {
        // add to line
        line += buffer.substr(
          lastPos + 1,
          pos - lastPos - (newlineOffset + 1)
        );
      } else {
        if (line)
          callback(null, line);
        // push line
        line = buffer.substr(
          lastPos,
          pos - lastPos - newlineOffset
        );
      }

      lastPos = pos;
    } while (pos !== len);

    // extra ending line
    line = line.trim();

    if (line.length)
      callback(null, line);
  }

  return parser;

}());
ICAL.Component = (function() {
  

  var PROPERTY_INDEX = 1;
  var COMPONENT_INDEX = 2;
  var NAME_INDEX = 0;

  /**
   * Create a wrapper for a jCal component.
   *
   * @param {Array|String} jCal
   *  raw jCal component data OR name of new component.
   * @param {ICAL.Component} parent parent component to associate.
   */
  function Component(jCal, parent) {
    if (typeof(jCal) === 'string') {
      // jCal spec (name, properties, components)
      jCal = [jCal, [], []];
    }

    // mostly for legacy reasons.
    this.jCal = jCal;

    this.parent = parent || null;
  }

  Component.prototype = {
    /**
     * Hydrated properties are inserted into the _properties array at the same
     * position as in the jCal array, so its possible the array contains
     * undefined values for unhydrdated properties. To avoid iterating the
     * array when checking if all properties have been hydrated, we save the
     * count here.
     */
    _hydratedPropertyCount: 0,

    /**
     * The same count as for _hydratedPropertyCount, but for subcomponents
     */
    _hydratedComponentCount: 0,

    get name() {
      return this.jCal[NAME_INDEX];
    },

    _hydrateComponent: function(index) {
      if (!this._components) {
        this._components = [];
        this._hydratedComponentCount = 0;
      }

      if (this._components[index]) {
        return this._components[index];
      }

      var comp = new Component(
        this.jCal[COMPONENT_INDEX][index],
        this
      );

      this._hydratedComponentCount++;
      return this._components[index] = comp;
    },

    _hydrateProperty: function(index) {
      if (!this._properties) {
        this._properties = [];
        this._hydratedPropertyCount = 0;
      }

      if (this._properties[index]) {
        return this._properties[index];
      }

      var prop = new ICAL.Property(
        this.jCal[PROPERTY_INDEX][index],
        this
      );

      this._hydratedPropertyCount++;
      return this._properties[index] = prop;
    },

    /**
     * Finds first sub component, optionally filtered by name.
     *
     * @method getFirstSubcomponent
     * @param {String} [name] optional name to filter by.
     */
    getFirstSubcomponent: function(name) {
      if (name) {
        var i = 0;
        var comps = this.jCal[COMPONENT_INDEX];
        var len = comps.length;

        for (; i < len; i++) {
          if (comps[i][NAME_INDEX] === name) {
            var result = this._hydrateComponent(i);
            return result;
          }
        }
      } else {
        if (this.jCal[COMPONENT_INDEX].length) {
          return this._hydrateComponent(0);
        }
      }

      // ensure we return a value (strict mode)
      return null;
    },

    /**
     * Finds all sub components, optionally filtering by name.
     *
     * @method getAllSubcomponents
     * @param {String} [name] optional name to filter by.
     */
    getAllSubcomponents: function(name) {
      var jCalLen = this.jCal[COMPONENT_INDEX].length;

      if (name) {
        var comps = this.jCal[COMPONENT_INDEX];
        var result = [];
        var i = 0;

        for (; i < jCalLen; i++) {
          if (name === comps[i][NAME_INDEX]) {
            result.push(
              this._hydrateComponent(i)
            );
          }
        }
        return result;
      } else {
        if (!this._components ||
            (this._hydratedComponentCount !== jCalLen)) {
          var i = 0;
          for (; i < jCalLen; i++) {
            this._hydrateComponent(i);
          }
        }

        return this._components;
      }
    },

    /**
     * Returns true when a named property exists.
     *
     * @param {String} name property name.
     * @return {Boolean} true when property is found.
     */
    hasProperty: function(name) {
      var props = this.jCal[PROPERTY_INDEX];
      var len = props.length;

      var i = 0;
      for (; i < len; i++) {
        // 0 is property name
        if (props[i][NAME_INDEX] === name) {
          return true;
        }
      }

      return false;
    },

    /**
     * Finds first property.
     *
     * @param {String} [name] lowercase name of property.
     * @return {ICAL.Property} found property.
     */
    getFirstProperty: function(name) {
      if (name) {
        var i = 0;
        var props = this.jCal[PROPERTY_INDEX];
        var len = props.length;

        for (; i < len; i++) {
          if (props[i][NAME_INDEX] === name) {
            var result = this._hydrateProperty(i);
            return result;
          }
        }
      } else {
        if (this.jCal[PROPERTY_INDEX].length) {
          return this._hydrateProperty(0);
        }
      }

      return null;
    },

    /**
     * Returns first properties value if available.
     *
     * @param {String} [name] (lowecase) property name.
     * @return {String} property value.
     */
    getFirstPropertyValue: function(name) {
      var prop = this.getFirstProperty(name);
      if (prop) {
        return prop.getFirstValue();
      }

      return null;
    },

    /**
     * get all properties in the component.
     *
     * @param {String} [name] (lowercase) property name.
     * @return {Array[ICAL.Property]} list of properties.
     */
    getAllProperties: function(name) {
      var jCalLen = this.jCal[PROPERTY_INDEX].length;

      if (name) {
        var props = this.jCal[PROPERTY_INDEX];
        var result = [];
        var i = 0;

        for (; i < jCalLen; i++) {
          if (name === props[i][NAME_INDEX]) {
            result.push(
              this._hydrateProperty(i)
            );
          }
        }
        return result;
      } else {
        if (!this._properties ||
            (this._hydratedPropertyCount !== jCalLen)) {
          var i = 0;
          for (; i < jCalLen; i++) {
            this._hydrateProperty(i);
          }
        }

        return this._properties;
      }

      return null;
    },

    _removeObjectByIndex: function(jCalIndex, cache, index) {
      // remove cached version
      if (cache && cache[index]) {
        var obj = cache[index];
        if ("parent" in obj) {
            obj.parent = null;
        }
        cache.splice(index, 1);
      }

      // remove it from the jCal
      this.jCal[jCalIndex].splice(index, 1);
    },

    _removeObject: function(jCalIndex, cache, nameOrObject) {
      var i = 0;
      var objects = this.jCal[jCalIndex];
      var len = objects.length;
      var cached = this[cache];

      if (typeof(nameOrObject) === 'string') {
        for (; i < len; i++) {
          if (objects[i][NAME_INDEX] === nameOrObject) {
            this._removeObjectByIndex(jCalIndex, cached, i);
            return true;
          }
        }
      } else if (cached) {
        for (; i < len; i++) {
          if (cached[i] && cached[i] === nameOrObject) {
            this._removeObjectByIndex(jCalIndex, cached, i);
            return true;
          }
        }
      }

      return false;
    },

    _removeAllObjects: function(jCalIndex, cache, name) {
      var cached = this[cache];

      // Unfortunately we have to run through all children to reset their
      // parent property.
      var objects = this.jCal[jCalIndex];
      var i = objects.length - 1;

      // descending search required because splice
      // is used and will effect the indices.
      for (; i >= 0; i--) {
        if (!name || objects[i][NAME_INDEX] === name) {
          this._removeObjectByIndex(jCalIndex, cached, i);
        }
      }
    },

    /**
     * Adds a single sub component.
     *
     * @param {ICAL.Component} component to add.
     */
    addSubcomponent: function(component) {
      if (!this._components) {
        this._components = [];
        this._hydratedComponentCount = 0;
      }

      if (component.parent) {
        component.parent.removeSubcomponent(component);
      }

      var idx = this.jCal[COMPONENT_INDEX].push(component.jCal);
      this._components[idx - 1] = component;
      this._hydratedComponentCount++;
      component.parent = this;
    },

    /**
     * Removes a single component by name or
     * the instance of a specific component.
     *
     * @param {ICAL.Component|String} nameOrComp comp type.
     * @return {Boolean} true when comp is removed.
     */
    removeSubcomponent: function(nameOrComp) {
      var removed = this._removeObject(COMPONENT_INDEX, '_components', nameOrComp);
      if (removed) {
        this._hydratedComponentCount--;
      }
      return removed;
    },

    /**
     * Removes all components or (if given) all
     * components by a particular name.
     *
     * @param {String} [name] (lowercase) component name.
     */
    removeAllSubcomponents: function(name) {
      var removed = this._removeAllObjects(COMPONENT_INDEX, '_components', name);
      this._hydratedComponentCount = 0;
      return removed;
    },

    /**
     * Adds a property to the component.
     *
     * @param {ICAL.Property} property object.
     */
    addProperty: function(property) {
      if (!(property instanceof ICAL.Property)) {
        throw new TypeError('must instance of ICAL.Property');
      }

      if (!this._properties) {
        this._properties = [];
        this._hydratedPropertyCount = 0;
      }


      if (property.parent) {
        property.parent.removeProperty(property);
      }

      var idx = this.jCal[PROPERTY_INDEX].push(property.jCal);
      this._properties[idx - 1] = property;
      this._hydratedPropertyCount++;
      property.parent = this;
    },

    /**
     * Helper method to add a property with a value to the component.
     *
     * @param {String} name property name to add.
     * @param {Object} value property value.
     */
    addPropertyWithValue: function(name, value) {
      var prop = new ICAL.Property(name);
      prop.setValue(value);

      this.addProperty(prop);

      return prop;
    },

    /**
     * Helper method that will update or create a property
     * of the given name and sets its value.
     *
     * @param {String} name property name.
     * @param {Object} value property value.
     * @return {ICAL.Property} property.
     */
    updatePropertyWithValue: function(name, value) {
      var prop = this.getFirstProperty(name);

      if (prop) {
        prop.setValue(value);
      } else {
        prop = this.addPropertyWithValue(name, value);
      }

      return prop;
    },

    /**
     * Removes a single property by name or
     * the instance of the specific property.
     *
     * @param {String|ICAL.Property} nameOrProp to remove.
     * @return {Boolean} true when deleted.
     */
    removeProperty: function(nameOrProp) {
      var removed = this._removeObject(PROPERTY_INDEX, '_properties', nameOrProp);
      if (removed) {
        this._hydratedPropertyCount--;
      }
      return removed;
    },

    /**
     * Removes all properties associated with this component.
     *
     * @param {String} [name] (lowecase) optional property name.
     */
    removeAllProperties: function(name) {
      var removed = this._removeAllObjects(PROPERTY_INDEX, '_properties', name);
      this._hydratedPropertyCount = 0;
      return removed;
    },

    toJSON: function() {
      return this.jCal;
    },

    toString: function() {
      return ICAL.stringify.component(
        this.jCal
      );
    }

  };

  return Component;

}());
ICAL.Property = (function() {
  

  var NAME_INDEX = 0;
  var PROP_INDEX = 1;
  var TYPE_INDEX = 2;
  var VALUE_INDEX = 3;

  var design = ICAL.design;

  /**
   * Provides a nicer interface to any kind of property.
   * Its important to note that mutations done in the wrapper
   * directly effect (mutate) the jCal object used to initialize.
   *
   * Can also be used to create new properties by passing
   * the name of the property (as a String).
   *
   *
   * @param {Array|String} jCal raw jCal representation OR
   *  the new name of the property (when creating).
   *
   * @param {ICAL.Component} [parent] parent component.
   */
  function Property(jCal, parent) {
    if (typeof(jCal) === 'string') {
      // because we a creating by name we need
      // to find the type when creating the property.
      var name = jCal;

      if (name in design.property) {
        var prop = design.property[name];
        if ('defaultType' in prop) {
          var type = prop.defaultType;
        } else {
          var type = design.defaultType;
        }
      } else {
        var type = design.defaultType;
      }

      jCal = [name, {}, type];
    }

    this.jCal = jCal;
    this.parent = parent || null;
    this._updateType();
  }

  Property.prototype = {
    get type() {
      return this.jCal[TYPE_INDEX];
    },

    get name() {
      return this.jCal[NAME_INDEX];
    },

    _updateType: function() {
      if (this.type in design.value) {
        var designType = design.value[this.type];

        if ('decorate' in design.value[this.type]) {
          this.isDecorated = true;
        } else {
          this.isDecorated = false;
        }

        if (this.name in design.property) {
          if ('multiValue' in design.property[this.name]) {
            this.isMultiValue = true;
          } else {
            this.isMultiValue = false;
          }
        }
      }
    },

    /**
     * Hydrate a single value.
     */
    _hydrateValue: function(index) {
      if (this._values && this._values[index]) {
        return this._values[index];
      }

      // for the case where there is no value.
      if (this.jCal.length <= (VALUE_INDEX + index)) {
        return null;
      }

      if (this.isDecorated) {
        if (!this._values) {
          this._values = [];
        }
        return this._values[index] = this._decorate(
          this.jCal[VALUE_INDEX + index]
        );
      } else {
        return this.jCal[VALUE_INDEX + index];
      }
    },

    _decorate: function(value) {
      return design.value[this.type].decorate(value, this);
    },

    _undecorate: function(value) {
      return design.value[this.type].undecorate(value, this);
    },

    _setDecoratedValue: function(value, index) {
      if (!this._values) {
        this._values = [];
      }

      if (typeof(value) === 'object' && 'icaltype' in value) {
        // decorated value
        this.jCal[VALUE_INDEX + index] = this._undecorate(value);
        this._values[index] = value;
      } else {
        // undecorated value
        this.jCal[VALUE_INDEX + index] = value;
        this._values[index] = this._decorate(value);
      }
    },

    /**
     * Gets a param on the property.
     *
     * @param {String} name prop name (lowercase).
     * @return {String} prop value.
     */
    getParameter: function(name) {
      return this.jCal[PROP_INDEX][name];
    },

    /**
     * Sets a param on the property.
     *
     * @param {String} value property value.
     */
    setParameter: function(name, value) {
      this.jCal[PROP_INDEX][name] = value;
    },

    /**
     * Removes a parameter
     *
     * @param {String} name prop name (lowercase).
     */
    removeParameter: function(name) {
      return delete this.jCal[PROP_INDEX][name];
    },

    /**
     * Get the default type based on this property's name.
     *
     * @return {String} the default type for this property.
     */
    getDefaultType: function() {
      var name = this.name
      if (name in design.property) {
        var details = design.property[name];
        if ('defaultType' in details) {
          return details.defaultType;
        }
      }
      return null;
    },

    /**
     * Sets type of property and clears out any
     * existing values of the current type.
     *
     * @param {String} type new iCAL type (see design.values).
     */
    resetType: function(type) {
      this.removeAllValues();
      this.jCal[TYPE_INDEX] = type;
      this._updateType();
    },

    /**
     * Finds first property value.
     *
     * @return {String} first property value.
     */
    getFirstValue: function() {
      return this._hydrateValue(0);
    },

    /**
     * Gets all values on the property.
     *
     * NOTE: this creates an array during each call.
     *
     * @return {Array} list of values.
     */
    getValues: function() {
      var len = this.jCal.length - VALUE_INDEX;

      if (len < 1) {
        // its possible for a property to have no value.
        return [];
      }

      var i = 0;
      var result = [];

      for (; i < len; i++) {
        result[i] = this._hydrateValue(i);
      }

      return result;
    },

    removeAllValues: function() {
      if (this._values) {
        this._values.length = 0;
      }
      this.jCal.length = 3;
    },

    /**
     * Sets the values of the property.
     * Will overwrite the existing values.
     *
     * @param {Array} values an array of values.
     */
    setValues: function(values) {
      if (!this.isMultiValue) {
        throw new Error(
          this.name + ': does not not support mulitValue.\n' +
          'override isMultiValue'
        );
      }

      var len = values.length;
      var i = 0;
      this.removeAllValues();

      if (len > 0 &&
          typeof(values[0]) === 'object' &&
          'icaltype' in values[0]) {
        this.resetType(values[0].icaltype);
      }

      if (this.isDecorated) {
        for (; i < len; i++) {
          this._setDecoratedValue(values[i], i);
        }
      } else {
        for (; i < len; i++) {
          this.jCal[VALUE_INDEX + i] = values[i];
        }
      }
    },

    /**
     * Sets the current value of the property. If this is a multi-value
     * property, all other values will be removed.
     *
     * @param {String|Object} value new prop value.
     */
    setValue: function(value) {
      this.removeAllValues();
      if (typeof(value) === 'object' && 'icaltype' in value) {
        this.resetType(value.icaltype);
      }

      if (this.isDecorated) {
        this._setDecoratedValue(value, 0);
      } else {
        this.jCal[VALUE_INDEX] = value;
      }
    },

    /**
     * Returns the jCal representation of this property.
     *
     * @return {Object} jCal.
     */
    toJSON: function() {
      return this.jCal;
    },

    toICAL: function() {
      return ICAL.stringify.property(
        this.jCal
      );
    }

  };

  return Property;

}());
ICAL.UtcOffset = (function() {

  function UtcOffset(aData) {
    this.hours = aData.hours;
    this.minutes = aData.minutes;
    this.factor = aData.factor;
  };

  UtcOffset.prototype = {

    hours: null,
    minutes: null,
    factor: null,

    icaltype: "utc-offset",

    toString: function toString() {
      return (this.factor == 1 ? "+" : "-") +
              ICAL.helpers.pad2(this.hours) + ':' +
              ICAL.helpers.pad2(this.minutes);
    }
  };

  UtcOffset.fromString = function(aString) {
    // -05:00
    var options = {};
    //TODO: support seconds per rfc5545 ?
    options.factor = (aString[0] === '+') ? 1 : -1;
    options.hours = ICAL.helpers.strictParseInt(aString.substr(1, 2));
    options.minutes = ICAL.helpers.strictParseInt(aString.substr(4, 2));

    return new ICAL.UtcOffset(options);
  };


  return UtcOffset;

}());
ICAL.Binary = (function() {

  function Binary(aValue) {
    this.value = aValue;
  };

  Binary.prototype = {
    icaltype: "binary",

    decodeValue: function decodeValue() {
      return this._b64_decode(this.value);
    },

    setEncodedValue: function setEncodedValue(val) {
      this.value = this._b64_encode(val);
    },

    _b64_encode: function base64_encode(data) {
      // http://kevin.vanzonneveld.net
      // +   original by: Tyler Akins (http://rumkin.com)
      // +   improved by: Bayron Guevara
      // +   improved by: Thunder.m
      // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
      // +   bugfixed by: Pellentesque Malesuada
      // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
      // +   improved by: Rafał Kukawski (http://kukawski.pl)
      // *     example 1: base64_encode('Kevin van Zonneveld');
      // *     returns 1: 'S2V2aW4gdmFuIFpvbm5ldmVsZA=='
      // mozilla has this native
      // - but breaks in 2.0.0.12!
      //if (typeof this.window['atob'] == 'function') {
      //    return atob(data);
      //}
      var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                "abcdefghijklmnopqrstuvwxyz0123456789+/=";
      var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
        ac = 0,
        enc = "",
        tmp_arr = [];

      if (!data) {
        return data;
      }

      do { // pack three octets into four hexets
        o1 = data.charCodeAt(i++);
        o2 = data.charCodeAt(i++);
        o3 = data.charCodeAt(i++);

        bits = o1 << 16 | o2 << 8 | o3;

        h1 = bits >> 18 & 0x3f;
        h2 = bits >> 12 & 0x3f;
        h3 = bits >> 6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
      } while (i < data.length);

      enc = tmp_arr.join('');

      var r = data.length % 3;

      return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);

    },

    _b64_decode: function base64_decode(data) {
      // http://kevin.vanzonneveld.net
      // +   original by: Tyler Akins (http://rumkin.com)
      // +   improved by: Thunder.m
      // +      input by: Aman Gupta
      // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
      // +   bugfixed by: Onno Marsman
      // +   bugfixed by: Pellentesque Malesuada
      // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
      // +      input by: Brett Zamir (http://brett-zamir.me)
      // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
      // *     example 1: base64_decode('S2V2aW4gdmFuIFpvbm5ldmVsZA==');
      // *     returns 1: 'Kevin van Zonneveld'
      // mozilla has this native
      // - but breaks in 2.0.0.12!
      //if (typeof this.window['btoa'] == 'function') {
      //    return btoa(data);
      //}
      var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                "abcdefghijklmnopqrstuvwxyz0123456789+/=";
      var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
        ac = 0,
        dec = "",
        tmp_arr = [];

      if (!data) {
        return data;
      }

      data += '';

      do { // unpack four hexets into three octets using index points in b64
        h1 = b64.indexOf(data.charAt(i++));
        h2 = b64.indexOf(data.charAt(i++));
        h3 = b64.indexOf(data.charAt(i++));
        h4 = b64.indexOf(data.charAt(i++));

        bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;

        o1 = bits >> 16 & 0xff;
        o2 = bits >> 8 & 0xff;
        o3 = bits & 0xff;

        if (h3 == 64) {
          tmp_arr[ac++] = String.fromCharCode(o1);
        } else if (h4 == 64) {
          tmp_arr[ac++] = String.fromCharCode(o1, o2);
        } else {
          tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
        }
      } while (i < data.length);

      dec = tmp_arr.join('');

      return dec;
    },

    toString: function() {
      return this.value;
    }
  };

  Binary.fromString = function(aString) {
    return new Binary(aString);
  }

  return Binary;

}());
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2011-2012 */



(typeof(ICAL) === 'undefined')? ICAL = {} : '';
(function() {
  ICAL.Period = function icalperiod(aData) {
    this.wrappedJSObject = this;

    if (aData && 'start' in aData) {
      if (aData.start && !(aData.start instanceof ICAL.Time)) {
        throw new TypeError('.start must be an instance of ICAL.Time');
      }
      this.start = aData.start;
    }

    if (aData && aData.end && aData.duration) {
      throw new Error('cannot accept both end and duration');
    }

    if (aData && 'end' in aData) {
      if (aData.end && !(aData.end instanceof ICAL.Time)) {
        throw new TypeError('.end must be an instance of ICAL.Time');
      }
      this.end = aData.end;
    }

    if (aData && 'duration' in aData) {
      if (aData.duration && !(aData.duration instanceof ICAL.Duration)) {
        throw new TypeError('.duration must be an instance of ICAL.Duration');
      }
      this.duration = aData.duration;
    }
  };

  ICAL.Period.prototype = {

    start: null,
    end: null,
    duration: null,
    icalclass: "icalperiod",
    icaltype: "period",

    clone: function() {
      return ICAL.Period.fromData({
        start: this.start ? this.start.clone() : null,
        end: this.end ? this.end.clone() : null,
        duration: this.duration ? this.duration.clone() : null
      });
    },

    getDuration: function duration() {
      if (this.duration) {
        return this.duration;
      } else {
        return this.end.subtractDate(this.start);
      }
    },

    getEnd: function() {
      if (this.end) {
        return this.end;
      } else {
        var end = this.start.clone();
        end.addDuration(this.duration);
        return end;
      }
    },

    toString: function toString() {
      return this.start + "/" + (this.end || this.duration);
    },

    toICALString: function() {
      return this.start.toICALString() + "/" +
             (this.end || this.duration).toICALString();
    }
  };

  ICAL.Period.fromString = function fromString(str, prop) {
    var parts = str.split('/');

    if (parts.length !== 2) {
      throw new Error(
        'Invalid string value: "' + str + '" must contain a "/" char.'
      );
    }

    var options = {
      start: ICAL.Time.fromDateTimeString(parts[0], prop)
    };

    var end = parts[1];

    if (ICAL.Duration.isValueString(end)) {
      options.duration = ICAL.Duration.fromString(end);
    } else {
      options.end = ICAL.Time.fromDateTimeString(end, prop);
    }

    return new ICAL.Period(options);
  };

  ICAL.Period.fromData = function fromData(aData) {
    return new ICAL.Period(aData);
  };

})();
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2011-2012 */



(typeof(ICAL) === 'undefined')? ICAL = {} : '';
(function() {
  var DURATION_LETTERS = /([PDWHMTS]{1,1})/;

  ICAL.Duration = function icalduration(data) {
    this.wrappedJSObject = this;
    this.fromData(data);
  };

  ICAL.Duration.prototype = {

    weeks: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isNegative: false,
    icalclass: "icalduration",
    icaltype: "duration",

    clone: function clone() {
      return ICAL.Duration.fromData(this);
    },

    toSeconds: function toSeconds() {
      var seconds = this.seconds + 60 * this.minutes + 3600 * this.hours +
                    86400 * this.days + 7 * 86400 * this.weeks;
      return (this.isNegative ? -seconds : seconds);
    },

    fromSeconds: function fromSeconds(aSeconds) {
      var secs = Math.abs(aSeconds);

      this.isNegative = (aSeconds < 0);
      this.days = ICAL.helpers.trunc(secs / 86400);

      // If we have a flat number of weeks, use them.
      if (this.days % 7 == 0) {
        this.weeks = this.days / 7;
        this.days = 0;
      } else {
        this.weeks = 0;
      }

      secs -= (this.days + 7 * this.weeks) * 86400;

      this.hours = ICAL.helpers.trunc(secs / 3600);
      secs -= this.hours * 3600;

      this.minutes = ICAL.helpers.trunc(secs / 60);
      secs -= this.minutes * 60;

      this.seconds = secs;
      return this;
    },

    fromData: function fromData(aData) {
      var propsToCopy = ["weeks", "days", "hours",
                         "minutes", "seconds", "isNegative"];
      for (var key in propsToCopy) {
        var prop = propsToCopy[key];
        if (aData && prop in aData) {
          this[prop] = aData[prop];
        } else {
          this[prop] = 0;
        }
      }
    },

    reset: function reset() {
      this.isNegative = false;
      this.weeks = 0;
      this.days = 0;
      this.hours = 0;
      this.minutes = 0;
      this.seconds = 0;
    },

    compare: function compare(aOther) {
      var thisSeconds = this.toSeconds();
      var otherSeconds = aOther.toSeconds();
      return (thisSeconds > otherSeconds) - (thisSeconds < otherSeconds);
    },

    normalize: function normalize() {
      this.fromSeconds(this.toSeconds());
      return this;
    },

    toString: function toString() {
      if (this.toSeconds() == 0) {
        return "PT0S";
      } else {
        var str = "";
        if (this.isNegative) str += "-";
        str += "P";
        if (this.weeks) str += this.weeks + "W";
        if (this.days) str += this.days + "D";

        if (this.hours || this.minutes || this.seconds) {
          str += "T";
          if (this.hours) str += this.hours + "H";
          if (this.minutes) str += this.minutes + "M";
          if (this.seconds) str += this.seconds + "S";
        }
        return str;
      }
    },

    toICALString: function() {
      return this.toString();
    }
  };

  ICAL.Duration.fromSeconds = function icalduration_from_seconds(aSeconds) {
    return (new ICAL.Duration()).fromSeconds(aSeconds);
  };

  /**
   * Internal helper function to handle a chunk of a duration.
   *
   * @param {String} letter type of duration chunk.
   * @param {String} number numeric value or -/+.
   * @param {Object} dict target to assign values to.
   */
  function parseDurationChunk(letter, number, object) {
    var type;
    switch (letter) {
      case 'P':
        if (number && number === '-') {
          object.isNegative = true;
        } else {
          object.isNegative = false;
        }
        // period
        break;
      case 'D':
        type = 'days';
        break;
      case 'W':
        type = 'weeks';
        break;
      case 'H':
        type = 'hours';
        break;
      case 'M':
        type = 'minutes';
        break;
      case 'S':
        type = 'seconds';
        break;
      default:
        // Not a valid chunk
        return 0;
    }

    if (type) {
      if (!number && number !== 0) {
        throw new Error(
          'invalid duration value: Missing number before "' + letter + '"'
        );
      }
      var num = parseInt(number, 10);
      if (ICAL.helpers.isStrictlyNaN(num)) {
        throw new Error(
          'invalid duration value: Invalid number "' + number + '" before "' + letter + '"'
        );
      }
      object[type] = num;
    }

    return 1;
  }

  /**
   * @param {String} value raw ical value.
   * @return {Boolean}
   *  true when the given value is of the duration ical type.
   */
  ICAL.Duration.isValueString = function(string) {
    return (string[0] === 'P' || string[1] === 'P');
  },

  ICAL.Duration.fromString = function icalduration_from_string(aStr) {
    var pos = 0;
    var dict = Object.create(null);
    var chunks = 0;

    while ((pos = aStr.search(DURATION_LETTERS)) !== -1) {
      var type = aStr[pos];
      var numeric = aStr.substr(0, pos);
      aStr = aStr.substr(pos + 1);

      chunks += parseDurationChunk(type, numeric, dict);
    }

    if (chunks < 2) {
      // There must be at least a chunk with "P" and some unit chunk
      throw new Error(
        'invalid duration value: Not enough duration components in "' + aStr + '"'
      );
    }

    return new ICAL.Duration(dict);
  };

  ICAL.Duration.fromData = function icalduration_from_data(aData) {
    return new ICAL.Duration(aData);
  };
})();
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2011-2012 */



(typeof(ICAL) === 'undefined')? ICAL = {} : '';
(function() {
  var OPTIONS = ["tzid", "location", "tznames",
                 "latitude", "longitude"];

  /**
   * Timezone representation, created by passing in a tzid and component.
   *
   *    var vcalendar;
   *    var timezoneComp = vcalendar.getFirstSubcomponent('vtimezone');
   *    var tzid = timezoneComp.getFirstPropertyValue('tzid');
   *
   *    var timezone = new ICAL.Timezone({
   *      component: timezoneComp,
   *      tzid
   *    });
   *
   *
   * @param {Object} data options for class (see above).
   */
  ICAL.Timezone = function icaltimezone(data) {
    this.wrappedJSObject = this;
    this.fromData(data);
  };

  ICAL.Timezone.prototype = {

    tzid: "",
    location: "",
    tznames: "",

    latitude: 0.0,
    longitude: 0.0,

    component: null,

    expandedUntilYear: 0,

    icalclass: "icaltimezone",

    fromData: function fromData(aData) {
      this.expandedUntilYear = 0;
      this.changes = [];

      if (aData instanceof ICAL.Component) {
        // Either a component is passed directly
        this.component = aData;
      } else {
        // Otherwise the component may be in the data object
        if (aData && "component" in aData) {
          if (typeof aData.component == "string") {
            // If a string was passed, parse it as a component
            var icalendar = ICAL.parse(aData.component);
            this.component = new ICAL.Component(icalendar[1]);
          } else if (aData.component instanceof ICAL.Component) {
            // If it was a component already, then just set it
            this.component = aData.component;
          } else {
            // Otherwise just null out the component
            this.component = null;
          }
        }

        // Copy remaining passed properties
        for (var key in OPTIONS) {
          var prop = OPTIONS[key];
          if (aData && prop in aData) {
            this[prop] = aData[prop];
          }
        }
      }

      // If we have a component but no TZID, attempt to get it from the
      // component's properties.
      if (this.component instanceof ICAL.Component && !this.tzid) {
        this.tzid = this.component.getFirstPropertyValue('tzid');
      }

      return this;
    },

    /**
     * Finds the utcOffset the given time would occur in this timezone.
     *
     * @return {Number} utc offset in seconds.
     */
    utcOffset: function utcOffset(tt) {
      if (this == ICAL.Timezone.utcTimezone || this == ICAL.Timezone.localTimezone) {
        return 0;
      }

      this._ensureCoverage(tt.year);

      if (!this.changes.length) {
        return 0;
      }

      var tt_change = {
        year: tt.year,
        month: tt.month,
        day: tt.day,
        hour: tt.hour,
        minute: tt.minute,
        second: tt.second
      };

      var change_num = this._findNearbyChange(tt_change);
      var change_num_to_use = -1;
      var step = 1;

      // TODO: replace with bin search?
      for (;;) {
        var change = ICAL.helpers.clone(this.changes[change_num], true);
        if (change.utcOffset < change.prevUtcOffset) {
          ICAL.Timezone.adjust_change(change, 0, 0, 0, change.utcOffset);
        } else {
          ICAL.Timezone.adjust_change(change, 0, 0, 0,
                                          change.prevUtcOffset);
        }

        var cmp = ICAL.Timezone._compare_change_fn(tt_change, change);

        if (cmp >= 0) {
          change_num_to_use = change_num;
        } else {
          step = -1;
        }

        if (step == -1 && change_num_to_use != -1) {
          break;
        }

        change_num += step;

        if (change_num < 0) {
          return 0;
        }

        if (change_num >= this.changes.length) {
          break;
        }
      }

      var zone_change = this.changes[change_num_to_use];
      var utcOffset_change = zone_change.utcOffset - zone_change.prevUtcOffset;

      if (utcOffset_change < 0 && change_num_to_use > 0) {
        var tmp_change = ICAL.helpers.clone(zone_change, true);
        ICAL.Timezone.adjust_change(tmp_change, 0, 0, 0,
                                        tmp_change.prevUtcOffset);

        if (ICAL.Timezone._compare_change_fn(tt_change, tmp_change) < 0) {
          var prev_zone_change = this.changes[change_num_to_use - 1];

          var want_daylight = false; // TODO

          if (zone_change.is_daylight != want_daylight &&
              prev_zone_change.is_daylight == want_daylight) {
            zone_change = prev_zone_change;
          }
        }
      }

      // TODO return is_daylight?
      return zone_change.utcOffset;
    },

    _findNearbyChange: function icaltimezone_find_nearby_change(change) {
      // find the closest match
      var idx = ICAL.helpers.binsearchInsert(
        this.changes,
        change,
        ICAL.Timezone._compare_change_fn
      );

      if (idx >= this.changes.length) {
        return this.changes.length - 1;
      }

      return idx;
    },

    _ensureCoverage: function(aYear) {
      if (ICAL.Timezone._minimumExpansionYear == -1) {
        var today = ICAL.Time.now();
        ICAL.Timezone._minimumExpansionYear = today.year;
      }

      var changesEndYear = aYear;
      if (changesEndYear < ICAL.Timezone._minimumExpansionYear) {
        changesEndYear = ICAL.Timezone._minimumExpansionYear;
      }

      changesEndYear += ICAL.Timezone.EXTRA_COVERAGE;

      if (changesEndYear > ICAL.Timezone.MAX_YEAR) {
        changesEndYear = ICAL.Timezone.MAX_YEAR;
      }

      if (!this.changes.length || this.expandedUntilYear < aYear) {
        var subcomps = this.component.getAllSubcomponents();
        var compLen = subcomps.length;
        var compIdx = 0;

        for (; compIdx < compLen; compIdx++) {
          this._expandComponent(
            subcomps[compIdx], changesEndYear, this.changes
          );
        }

        this.changes.sort(ICAL.Timezone._compare_change_fn);
        this.expandedUntilYear = changesEndYear;
      }
    },

    _expandComponent: function(aComponent, aYear, changes) {
      if (!aComponent.hasProperty("dtstart") ||
          !aComponent.hasProperty("tzoffsetto") ||
          !aComponent.hasProperty("tzoffsetfrom")) {
        return null;
      }

      var dtstart = aComponent.getFirstProperty("dtstart").getFirstValue();

      function convert_tzoffset(offset) {
        return offset.factor * (offset.hours * 3600 + offset.minutes * 60);
      }

      function init_changes() {
        var changebase = {};
        changebase.is_daylight = (aComponent.name == "daylight");
        changebase.utcOffset = convert_tzoffset(
          aComponent.getFirstProperty("tzoffsetto").getFirstValue()
        );

        changebase.prevUtcOffset = convert_tzoffset(
          aComponent.getFirstProperty("tzoffsetfrom").getFirstValue()
        );

        return changebase;
      }

      if (!aComponent.hasProperty("rrule") && !aComponent.hasProperty("rdate")) {
        var change = init_changes();
        change.year = dtstart.year;
        change.month = dtstart.month;
        change.day = dtstart.day;
        change.hour = dtstart.hour;
        change.minute = dtstart.minute;
        change.second = dtstart.second;

        ICAL.Timezone.adjust_change(change, 0, 0, 0,
                                        -change.prevUtcOffset);
        changes.push(change);
      } else {
        var props = aComponent.getAllProperties("rdate");
        for (var rdatekey in props) {
          var rdate = props[rdatekey];
          var time = rdate.getFirstValue();
          var change = init_changes();

          change.year = time.year;
          change.month = time.month;
          change.day = time.day;

          if (time.isDate) {
            change.hour = dtstart.hour;
            change.minute = dtstart.minute;
            change.second = dtstart.second;

            if (dtstart.zone != ICAL.Timezone.utcTimezone) {
              ICAL.Timezone.adjust_change(change, 0, 0, 0,
                                              -change.prevUtcOffset);
            }
          } else {
            change.hour = time.hour;
            change.minute = time.minute;
            change.second = time.second;

            if (time.zone != ICAL.Timezone.utcTimezone) {
              ICAL.Timezone.adjust_change(change, 0, 0, 0,
                                              -change.prevUtcOffset);
            }
          }

          changes.push(change);
        }

        var rrule = aComponent.getFirstProperty("rrule");

        if (rrule) {
          rrule = rrule.getFirstValue();
          var change = init_changes();

          if (rrule.until && rrule.until.zone == ICAL.Timezone.utcTimezone) {
            rrule.until.adjust(0, 0, 0, change.prevUtcOffset);
            rrule.until.zone = ICAL.Timezone.localTimezone;
          }

          var iterator = rrule.iterator(dtstart);

          var occ;
          while ((occ = iterator.next())) {
            var change = init_changes();
            if (occ.year > aYear || !occ) {
              break;
            }

            change.year = occ.year;
            change.month = occ.month;
            change.day = occ.day;
            change.hour = occ.hour;
            change.minute = occ.minute;
            change.second = occ.second;
            change.isDate = occ.isDate;

            ICAL.Timezone.adjust_change(change, 0, 0, 0,
                                            -change.prevUtcOffset);
            changes.push(change);
          }
        }
      }

      return changes;
    },

    toString: function toString() {
      return (this.tznames ? this.tznames : this.tzid);
    }

  };

  ICAL.Timezone._compare_change_fn = function icaltimezone_compare_change_fn(a, b) {
    if (a.year < b.year) return -1;
    else if (a.year > b.year) return 1;

    if (a.month < b.month) return -1;
    else if (a.month > b.month) return 1;

    if (a.day < b.day) return -1;
    else if (a.day > b.day) return 1;

    if (a.hour < b.hour) return -1;
    else if (a.hour > b.hour) return 1;

    if (a.minute < b.minute) return -1;
    else if (a.minute > b.minute) return 1;

    if (a.second < b.second) return -1;
    else if (a.second > b.second) return 1;

    return 0;
  };

  ICAL.Timezone.convert_time = function icaltimezone_convert_time(tt, from_zone, to_zone) {
    if (tt.isDate ||
        from_zone.tzid == to_zone.tzid ||
        from_zone == ICAL.Timezone.localTimezone ||
        to_zone == ICAL.Timezone.localTimezone) {
      tt.zone = to_zone;
      return tt;
    }

    var utcOffset = from_zone.utcOffset(tt);
    tt.adjust(0, 0, 0, - utcOffset);

    utcOffset = to_zone.utcOffset(tt);
    tt.adjust(0, 0, 0, utcOffset);

    return null;
  };

  ICAL.Timezone.fromData = function icaltimezone_fromData(aData) {
    var tt = new ICAL.Timezone();
    return tt.fromData(aData);
  };

  ICAL.Timezone.utcTimezone = ICAL.Timezone.fromData({
    tzid: "UTC"
  });

  ICAL.Timezone.localTimezone = ICAL.Timezone.fromData({
    tzid: "floating"
  });

  ICAL.Timezone.adjust_change = function icaltimezone_adjust_change(change, days, hours, minutes, seconds) {
    return ICAL.Time.prototype.adjust.call(
      change,
      days,
      hours,
      minutes,
      seconds,
      change
    );
  };

  ICAL.Timezone._minimumExpansionYear = -1;
  ICAL.Timezone.MAX_YEAR = 2035; // TODO this is because of time_t, which we don't need. Still usefull?
  ICAL.Timezone.EXTRA_COVERAGE = 5;
})();
// singleton class to contain timezones.
// Right now its all manual registry in the
// future we may use this class to download timezone
// information or handle loading pre-expanded timezones.
ICAL.TimezoneService = (function() {
  var zones;

  // Using var rather then return so we don't need to name the functions twice.
  // TimezoneService#get will appear in profiler, etc...
  var TimezoneService = {
    reset: function() {
      zones = Object.create(null);
      var utc = ICAL.Timezone.utcTimezone;

      zones.Z = utc;
      zones.UTC = utc;
      zones.GMT = utc;
    },

    /**
     * Checks if timezone id has been registered.
     *
     * @param {String} tzid (e.g. America/Los_Angeles).
     * @return {Boolean} false when not present.
     */
    has: function(tzid) {
      return !!zones[tzid];
    },

    /**
     * Returns a timezone by its tzid if present.
     *
     * @param {String} tzid name of timezone (e.g. America/Los_Angeles).
     * @return {ICAL.Timezone|Null} zone or null.
     */
    get: function(tzid) {
      return zones[tzid];
    },

    /**
     * Registers a timezone object or component.
     *
     * @param {String} [name] optional uses timezone.tzid by default.
     * @param {ICAL.Component|ICAL.Timezone} zone initialized zone or vtimezone.
     */
    register: function(name, timezone) {
      if (name instanceof ICAL.Component) {
        if (name.name === 'vtimezone') {
          timezone = new ICAL.Timezone(name);
          name = timezone.tzid;
        }
      }

      if (timezone instanceof ICAL.Timezone) {
        zones[name] = timezone;
      } else {
        throw new TypeError('timezone must be ICAL.Timezone or ICAL.Component');
      }
    },

    /**
     * Removes a timezone by its tzid from the list.
     *
     * @param {String} tzid (e.g. America/Los_Angeles).
     */
    remove: function(tzid) {
      return (delete zones[tzid]);
    }
  };

  // initialize defaults
  TimezoneService.reset();

  return TimezoneService;
}());
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2011-2012 */



(typeof(ICAL) === 'undefined')? ICAL = {} : '';
(function() {

  /**
   * Time representation (similar to JS Date object).
   * Fully independent of system (OS) timezone / time.
   * Unlike JS Date month start at 1 (Jan) not zero.
   *
   *
   *    var time = new ICAL.Time({
   *      year: 2012,
   *      month: 10,
   *      day: 11
   *      minute: 0,
   *      second: 0,
   *      isDate: false
   *    });
   *
   *
   * @param {Object} data initialization time.
   * @param {ICAL.Timezone} zone timezone this position occurs in.
   */
  ICAL.Time = function icaltime(data, zone) {
    this.wrappedJSObject = this;
    var time = this._time = Object.create(null);

    /* time defaults */
    time.year = 0;
    time.month = 1;
    time.day = 1;
    time.hour = 0;
    time.minute = 0;
    time.second = 0;
    time.isDate = false;

    this.fromData(data, zone);
  };

  ICAL.Time.prototype = {

    icalclass: "icaltime",

    // is read only strictly defined by isDate
    get icaltype() {
      return this.isDate ? 'date' : 'date-time';
    },

    /**
     * @type ICAL.Timezone
     */
    zone: null,

    /**
     * Internal uses to indicate that a change has been
     * made and the next read operation must attempt to
     * normalize the value (for example changing the day to 33).
     *
     * @type Boolean
     * @private
     */
    _pendingNormalization: false,

    clone: function icaltime_clone() {
      return new ICAL.Time(this._time, this.zone);
    },

    reset: function icaltime_reset() {
      this.fromData(ICAL.Time.epochTime);
      this.zone = ICAL.Timezone.utcTimezone;
    },

    resetTo: function icaltime_resetTo(year, month, day,
                                       hour, minute, second, timezone) {
      this.fromData({
        year: year,
        month: month,
        day: day,
        hour: hour,
        minute: minute,
        second: second,
        zone: timezone
      });
    },

    fromString: function icaltime_fromString(str) {
      var data;
      try {
        data = ICAL.DecorationParser.parseValue(str, "date");
        data.isDate = true;
      } catch (e) {
        data = ICAL.DecorationParser.parseValue(str, "date-time");
        data.isDate = false;
      }
      return this.fromData(data);
    },

    fromJSDate: function icaltime_fromJSDate(aDate, useUTC) {
      if (!aDate) {
        this.reset();
      } else {
        if (useUTC) {
          this.zone = ICAL.Timezone.utcTimezone;
          this.year = aDate.getUTCFullYear();
          this.month = aDate.getUTCMonth() + 1;
          this.day = aDate.getUTCDate();
          this.hour = aDate.getUTCHours();
          this.minute = aDate.getUTCMinutes();
          this.second = aDate.getUTCSeconds();
        } else {
          this.zone = ICAL.Timezone.localTimezone;
          this.year = aDate.getFullYear();
          this.month = aDate.getMonth() + 1;
          this.day = aDate.getDate();
          this.hour = aDate.getHours();
          this.minute = aDate.getMinutes();
          this.second = aDate.getSeconds();
        }
      }
      return this;
    },

    fromData: function fromData(aData, aZone) {
      for (var key in aData) {
        // ical type cannot be set
        if (key === 'icaltype') continue;
        this[key] = aData[key];
      }

      if (aZone) {
        this.zone = aZone;
      }

      if (aData && !("isDate" in aData)) {
        this.isDate = !("hour" in aData);
      } else if (aData && ("isDate" in aData)) {
        this.isDate = aData.isDate;
      }

      if (aData && "timezone" in aData) {
        var zone = ICAL.TimezoneService.get(
          aData.timezone
        );

        this.zone = zone || ICAL.Timezone.localTimezone;
      }

      if (aData && "zone" in aData) {
        this.zone = aData.zone;
      }

      if (!this.zone) {
        this.zone = ICAL.Timezone.localTimezone;
      }

      return this;
    },

    dayOfWeek: function icaltime_dayOfWeek() {
      // Using Zeller's algorithm
      var q = this.day;
      var m = this.month + (this.month < 3 ? 12 : 0);
      var Y = this.year - (this.month < 3 ? 1 : 0);

      var h = (q + Y + ICAL.helpers.trunc(((m + 1) * 26) / 10) + ICAL.helpers.trunc(Y / 4));
      if (true /* gregorian */) {
        h += ICAL.helpers.trunc(Y / 100) * 6 + ICAL.helpers.trunc(Y / 400);
      } else {
        h += 5;
      }

      // Normalize to 1 = sunday
      h = ((h + 6) % 7) + 1;
      return h;
    },

    dayOfYear: function icaltime_dayOfYear() {
      var is_leap = (ICAL.Time.is_leap_year(this.year) ? 1 : 0);
      var diypm = ICAL.Time._days_in_year_passed_month;
      return diypm[is_leap][this.month - 1] + this.day;
    },

    startOfWeek: function startOfWeek() {
      var result = this.clone();
      result.day -= this.dayOfWeek() - 1;
      return result;
    },

    endOfWeek: function endOfWeek() {
      var result = this.clone();
      result.day += 7 - this.dayOfWeek();
      return result;
    },

    startOfMonth: function startOfMonth() {
      var result = this.clone();
      result.day = 1;
      result.isDate = true;
      result.hour = 0;
      result.minute = 0;
      result.second = 0;
      return result;
    },

    endOfMonth: function endOfMonth() {
      var result = this.clone();
      result.day = ICAL.Time.daysInMonth(result.month, result.year);
      result.isDate = true;
      result.hour = 0;
      result.minute = 0;
      result.second = 0;
      return result;
    },

    startOfYear: function startOfYear() {
      var result = this.clone();
      result.day = 1;
      result.month = 1;
      result.isDate = true;
      result.hour = 0;
      result.minute = 0;
      result.second = 0;
      return result;
    },

    endOfYear: function endOfYear() {
      var result = this.clone();
      result.day = 31;
      result.month = 12;
      result.isDate = true;
      result.hour = 0;
      result.minute = 0;
      result.second = 0;
      return result;
    },

    startDoyWeek: function startDoyWeek(aFirstDayOfWeek) {
      var firstDow = aFirstDayOfWeek || ICAL.Time.SUNDAY;
      var delta = this.dayOfWeek() - firstDow;
      if (delta < 0) delta += 7;
      return this.dayOfYear() - delta;
    },

    /**
     * Finds the nthWeekDay relative to the current month (not day).
     * The returned value is a day relative the month that this
     * month belongs to so 1 would indicate the first of the month
     * and 40 would indicate a day in the following month.
     *
     * @param {Numeric} aDayOfWeek day of the week see the day name constants.
     * @param {Numeric} aPos nth occurrence of a given week day
     *                       values of 1 and 0 both indicate the first
     *                       weekday of that type. aPos may be either positive
     *                       or negative.
     *
     * @return {Numeric} numeric value indicating a day relative
     *                   to the current month of this time object.
     */
    nthWeekDay: function icaltime_nthWeekDay(aDayOfWeek, aPos) {
      var daysInMonth = ICAL.Time.daysInMonth(this.month, this.year);
      var weekday;
      var pos = aPos;

      var start = 0;

      var otherDay = this.clone();

      if (pos >= 0) {
        otherDay.day = 1;

        // because 0 means no position has been given
        // 1 and 0 indicate the same day.
        if (pos != 0) {
          // remove the extra numeric value
          pos--;
        }

        // set current start offset to current day.
        start = otherDay.day;

        // find the current day of week
        var startDow = otherDay.dayOfWeek();

        // calculate the difference between current
        // day of the week and desired day of the week
        var offset = aDayOfWeek - startDow;


        // if the offset goes into the past
        // week we add 7 so its goes into the next
        // week. We only want to go forward in time here.
        if (offset < 0)
          // this is really important otherwise we would
          // end up with dates from in the past.
          offset += 7;

        // add offset to start so start is the same
        // day of the week as the desired day of week.
        start += offset;

        // because we are going to add (and multiply)
        // the numeric value of the day we subtract it
        // from the start position so not to add it twice.
        start -= aDayOfWeek;

        // set week day
        weekday = aDayOfWeek;
      } else {

        // then we set it to the last day in the current month
        otherDay.day = daysInMonth;

        // find the ends weekday
        var endDow = otherDay.dayOfWeek();

        pos++;

        weekday = (endDow - aDayOfWeek);

        if (weekday < 0) {
          weekday += 7;
        }

        weekday = daysInMonth - weekday;
      }

      weekday += pos * 7;

      return start + weekday;
    },

    /**
     * Checks if current time is the nthWeekDay.
     * Relative to the current month.
     *
     * Will always return false when rule resolves
     * outside of current month.
     *
     * @param {Numeric} aDayOfWeek day of week.
     * @param {Numeric} aPos position.
     * @param {Numeric} aMax maximum valid day.
     */
    isNthWeekDay: function(aDayOfWeek, aPos) {
      var dow = this.dayOfWeek();

      if (aPos === 0 && dow === aDayOfWeek) {
        return true;
      }

      // get pos
      var day = this.nthWeekDay(aDayOfWeek, aPos);

      if (day === this.day) {
        return true;
      }

      return false;
    },

    weekNumber: function weekNumber(aWeekStart) {
      // This function courtesty of Julian Bucknall, published under the MIT license
      // http://www.boyet.com/articles/publishedarticles/calculatingtheisoweeknumb.html
      var doy = this.dayOfYear();
      var dow = this.dayOfWeek();
      var year = this.year;
      var week1;

      var dt = this.clone();
      dt.isDate = true;
      var first_dow = dt.dayOfWeek();
      var isoyear = this.year;

      if (dt.month == 12 && dt.day > 28) {
        week1 = ICAL.Time.weekOneStarts(isoyear + 1, aWeekStart);
        if (dt.compare(week1) < 0) {
          week1 = ICAL.Time.weekOneStarts(isoyear, aWeekStart);
        } else {
          isoyear++;
        }
      } else {
        week1 = ICAL.Time.weekOneStarts(isoyear, aWeekStart);
        if (dt.compare(week1) < 0) {
          week1 = ICAL.Time.weekOneStarts(--isoyear, aWeekStart);
        }
      }

      var daysBetween = (dt.subtractDate(week1).toSeconds() / 86400);
      return ICAL.helpers.trunc(daysBetween / 7) + 1;
    },

    addDuration: function icaltime_add(aDuration) {
      var mult = (aDuration.isNegative ? -1 : 1);

      // because of the duration optimizations it is much
      // more efficient to grab all the values up front
      // then set them directly (which will avoid a normalization call).
      // So we don't actually normalize until we need it.
      var second = this.second;
      var minute = this.minute;
      var hour = this.hour;
      var day = this.day;

      second += mult * aDuration.seconds;
      minute += mult * aDuration.minutes;
      hour += mult * aDuration.hours;
      day += mult * aDuration.days;
      day += mult * 7 * aDuration.weeks;

      this.second = second;
      this.minute = minute;
      this.hour = hour;
      this.day = day;
    },

    /**
     * Subtract the date details (_excluding_ timezone).
     * Useful for finding the relative difference between
     * two time objects excluding their timezone differences.
     *
     * @return {ICAL.Duration} difference in duration.
     */
    subtractDate: function icaltime_subtract(aDate) {
      var unixTime = this.toUnixTime() + this.utcOffset();
      var other = aDate.toUnixTime() + aDate.utcOffset();
      return ICAL.Duration.fromSeconds(unixTime - other);
    },

    /**
     * Subtract the date details, taking timezones into account.
     *
     * @param {ICAL.Time}  The date to subtract.
     * @return {ICAL.Duration}  The difference in duration.
     */
    subtractDateTz: function icaltime_subtract_abs(aDate) {
      var unixTime = this.toUnixTime();
      var other = aDate.toUnixTime();
      return ICAL.Duration.fromSeconds(unixTime - other);
    },

    compare: function icaltime_compare(other) {
      var a = this.toUnixTime();
      var b = other.toUnixTime();

      if (a > b) return 1;
      if (b > a) return -1;
      return 0;
    },

    compareDateOnlyTz: function icaltime_compareDateOnlyTz(other, tz) {
      function cmp(attr) {
        return ICAL.Time._cmp_attr(a, b, attr);
      }
      var a = this.convertToZone(tz);
      var b = other.convertToZone(tz);
      var rc = 0;

      if ((rc = cmp("year")) != 0) return rc;
      if ((rc = cmp("month")) != 0) return rc;
      if ((rc = cmp("day")) != 0) return rc;

      return rc;
    },

    convertToZone: function convertToZone(zone) {
      var copy = this.clone();
      var zone_equals = (this.zone.tzid == zone.tzid);

      if (!this.isDate && !zone_equals) {
        ICAL.Timezone.convert_time(copy, this.zone, zone);
      }

      copy.zone = zone;
      return copy;
    },

    utcOffset: function utc_offset() {
      if (this.zone == ICAL.Timezone.localTimezone ||
          this.zone == ICAL.Timezone.utcTimezone) {
        return 0;
      } else {
        return this.zone.utcOffset(this);
      }
    },

    /**
     * Returns an RFC 5455 compliant ical representation of this object.
     *
     * @return {String} ical date/date-time.
     */
    toICALString: function() {
      var string = this.toString();

      if (string.length > 10) {
        return ICAL.design.value['date-time'].toICAL(string);
      } else {
        return ICAL.design.value.date.toICAL(string);
      }
    },

    toString: function toString() {
      var result = this.year + '-' +
                   ICAL.helpers.pad2(this.month) + '-' +
                   ICAL.helpers.pad2(this.day);

      if (!this.isDate) {
          result += 'T' + ICAL.helpers.pad2(this.hour) + ':' +
                    ICAL.helpers.pad2(this.minute) + ':' +
                    ICAL.helpers.pad2(this.second);

        if (this.zone === ICAL.Timezone.utcTimezone) {
          result += 'Z';
        }
      }

      return result;
    },

    toJSDate: function toJSDate() {
      if (this.zone == ICAL.Timezone.localTimezone) {
        if (this.isDate) {
          return new Date(this.year, this.month - 1, this.day);
        } else {
          return new Date(this.year, this.month - 1, this.day,
                          this.hour, this.minute, this.second, 0);
        }
      } else {
        return new Date(this.toUnixTime() * 1000);
      }
    },

    _normalize: function icaltime_normalize() {
      var isDate = this._time.isDate;
      if (this._time.isDate) {
        this._time.hour = 0;
        this._time.minute = 0;
        this._time.second = 0;
      }
      this.adjust(0, 0, 0, 0);

      return this;
    },

    adjust: function icaltime_adjust(aExtraDays, aExtraHours,
                                     aExtraMinutes, aExtraSeconds, aTime) {

      var minutesOverflow, hoursOverflow,
          daysOverflow = 0, yearsOverflow = 0;

      var second, minute, hour, day;
      var daysInMonth;

      var time = aTime || this._time;

      if (!time.isDate) {
        second = time.second + aExtraSeconds;
        time.second = second % 60;
        minutesOverflow = ICAL.helpers.trunc(second / 60);
        if (time.second < 0) {
          time.second += 60;
          minutesOverflow--;
        }

        minute = time.minute + aExtraMinutes + minutesOverflow;
        time.minute = minute % 60;
        hoursOverflow = ICAL.helpers.trunc(minute / 60);
        if (time.minute < 0) {
          time.minute += 60;
          hoursOverflow--;
        }

        hour = time.hour + aExtraHours + hoursOverflow;

        time.hour = hour % 24;
        daysOverflow = ICAL.helpers.trunc(hour / 24);
        if (time.hour < 0) {
          time.hour += 24;
          daysOverflow--;
        }
      }


      // Adjust month and year first, because we need to know what month the day
      // is in before adjusting it.
      if (time.month > 12) {
        yearsOverflow = ICAL.helpers.trunc((time.month - 1) / 12);
      } else if (time.month < 1) {
        yearsOverflow = ICAL.helpers.trunc(time.month / 12) - 1;
      }

      time.year += yearsOverflow;
      time.month -= 12 * yearsOverflow;

      // Now take care of the days (and adjust month if needed)
      day = time.day + aExtraDays + daysOverflow;

      if (day > 0) {
        for (;;) {
          var daysInMonth = ICAL.Time.daysInMonth(time.month, time.year);
          if (day <= daysInMonth) {
            break;
          }

          time.month++;
          if (time.month > 12) {
            time.year++;
            time.month = 1;
          }

          day -= daysInMonth;
        }
      } else {
        while (day <= 0) {
          if (time.month == 1) {
            time.year--;
            time.month = 12;
          } else {
            time.month--;
          }

          day += ICAL.Time.daysInMonth(time.month, time.year);
        }
      }

      time.day = day;
      return this;
    },

    fromUnixTime: function fromUnixTime(seconds) {
      this.zone = ICAL.Timezone.utcTimezone;
      var epoch = ICAL.Time.epochTime.clone();
      epoch.adjust(0, 0, 0, seconds);

      this.year = epoch.year;
      this.month = epoch.month;
      this.day = epoch.day;
      this.hour = epoch.hour;
      this.minute = epoch.minute;
      this.second = epoch.second;
    },

    toUnixTime: function toUnixTime() {
      var offset = this.utcOffset();

      // we use the offset trick to ensure
      // that we are getting the actual UTC time
      var ms = Date.UTC(
        this.year,
        this.month - 1,
        this.day,
        this.hour,
        this.minute,
        this.second - offset
      );

      // seconds
      return ms / 1000;
    },

    /**
     * Converts time to into Object
     * which can be serialized then re-created
     * using the constructor.
     *
     * Example:
     *
     *    // toJSON will automatically be called
     *    var json = JSON.stringify(mytime);
     *
     *    var deserialized = JSON.parse(json);
     *
     *    var time = new ICAL.Time(deserialized);
     *
     */
    toJSON: function() {
      var copy = [
        'year',
        'month',
        'day',
        'hour',
        'minute',
        'second',
        'isDate'
      ];

      var result = Object.create(null);

      var i = 0;
      var len = copy.length;
      var prop;

      for (; i < len; i++) {
        prop = copy[i];
        result[prop] = this[prop];
      }

      if (this.zone) {
        result.timezone = this.zone.tzid;
      }

      return result;
    }

  };

  (function setupNormalizeAttributes() {
    // This needs to run before any instances are created!
    function defineAttr(attr) {
      Object.defineProperty(ICAL.Time.prototype, attr, {
        get: function getTimeAttr() {
          if (this._pendingNormalization) {
            this._normalize();
            this._pendingNormalization = false;
          }

          return this._time[attr];
        },
        set: function setTimeAttr(val) {
          this._pendingNormalization = true;
          this._time[attr] = val;

          return val;
        }
      });

    }

    if ("defineProperty" in Object) {
      defineAttr("year");
      defineAttr("month");
      defineAttr("day");
      defineAttr("hour");
      defineAttr("minute");
      defineAttr("second");
      defineAttr("isDate");
    }
  })();

  ICAL.Time.daysInMonth = function icaltime_daysInMonth(month, year) {
    var _daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var days = 30;

    if (month < 1 || month > 12) return days;

    days = _daysInMonth[month];

    if (month == 2) {
      days += ICAL.Time.is_leap_year(year);
    }

    return days;
  };

  ICAL.Time.is_leap_year = function icaltime_is_leap_year(year) {
    if (year <= 1752) {
      return ((year % 4) == 0);
    } else {
      return (((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0));
    }
  };

  ICAL.Time.fromDayOfYear = function icaltime_fromDayOfYear(aDayOfYear, aYear) {
    var year = aYear;
    var doy = aDayOfYear;
    var tt = new ICAL.Time();
    tt.auto_normalize = false;
    var is_leap = (ICAL.Time.is_leap_year(year) ? 1 : 0);

    if (doy < 1) {
      year--;
      is_leap = (ICAL.Time.is_leap_year(year) ? 1 : 0);
      doy += ICAL.Time._days_in_year_passed_month[is_leap][12];
    } else if (doy > ICAL.Time._days_in_year_passed_month[is_leap][12]) {
      is_leap = (ICAL.Time.is_leap_year(year) ? 1 : 0);
      doy -= ICAL.Time._days_in_year_passed_month[is_leap][12];
      year++;
    }

    tt.year = year;
    tt.isDate = true;

    for (var month = 11; month >= 0; month--) {
      if (doy > ICAL.Time._days_in_year_passed_month[is_leap][month]) {
        tt.month = month + 1;
        tt.day = doy - ICAL.Time._days_in_year_passed_month[is_leap][month];
        break;
      }
    }

    tt.auto_normalize = true;
    return tt;
  };

  ICAL.Time.fromStringv2 = function fromString(str) {
    return new ICAL.Time({
      year: parseInt(str.substr(0, 4), 10),
      month: parseInt(str.substr(5, 2), 10),
      day: parseInt(str.substr(8, 2), 10),
      isDate: true
    });
  };

  ICAL.Time.fromDateString = function(aValue, aProp) {
    // Dates should have no timezone.
    // Google likes to sometimes specify Z on dates
    // we specifically ignore that to avoid issues.

    // YYYY-MM-DD
    // 2012-10-10
    return new ICAL.Time({
      year: ICAL.helpers.strictParseInt(aValue.substr(0, 4)),
      month: ICAL.helpers.strictParseInt(aValue.substr(5, 2)),
      day: ICAL.helpers.strictParseInt(aValue.substr(8, 2)),
      isDate: true
    });
  };

  ICAL.Time.fromDateTimeString = function(aValue, prop) {
    if (aValue.length < 19) {
      throw new Error(
        'invalid date-time value: "' + aValue + '"'
      );
    }

    var zone;

    if (aValue[19] === 'Z') {
      zone = 'Z';
    } else if (prop) {
      zone = prop.getParameter('tzid');
    }

    // 2012-10-10T10:10:10(Z)?
    var time = new ICAL.Time({
      year: ICAL.helpers.strictParseInt(aValue.substr(0, 4)),
      month: ICAL.helpers.strictParseInt(aValue.substr(5, 2)),
      day: ICAL.helpers.strictParseInt(aValue.substr(8, 2)),
      hour: ICAL.helpers.strictParseInt(aValue.substr(11, 2)),
      minute: ICAL.helpers.strictParseInt(aValue.substr(14, 2)),
      second: ICAL.helpers.strictParseInt(aValue.substr(17, 2)),
      timezone: zone
    });

    return time;
  };

  ICAL.Time.fromString = function fromString(aValue) {
    if (aValue.length > 10) {
      return ICAL.Time.fromDateTimeString(aValue);
    } else {
      return ICAL.Time.fromDateString(aValue);
    }
  };

  ICAL.Time.fromJSDate = function fromJSDate(aDate, useUTC) {
    var tt = new ICAL.Time();
    return tt.fromJSDate(aDate, useUTC);
  };

  ICAL.Time.fromData = function fromData(aData) {
    var t = new ICAL.Time();
    return t.fromData(aData);
  };

  ICAL.Time.now = function icaltime_now() {
    return ICAL.Time.fromJSDate(new Date(), false);
  };

  ICAL.Time.weekOneStarts = function weekOneStarts(aYear, aWeekStart) {
    var t = ICAL.Time.fromData({
      year: aYear,
      month: 1,
      day: 4,
      isDate: true
    });

    var fourth_dow = t.dayOfWeek();
    t.day += (1 - fourth_dow) + ((aWeekStart || ICAL.Time.SUNDAY) - 1);
    return t;
  };

  ICAL.Time.epochTime = ICAL.Time.fromData({
    year: 1970,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    isDate: false,
    timezone: "Z"
  });

  ICAL.Time._cmp_attr = function _cmp_attr(a, b, attr) {
    if (a[attr] > b[attr]) return 1;
    if (a[attr] < b[attr]) return -1;
    return 0;
  };

  ICAL.Time._days_in_year_passed_month = [
    [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365],
    [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366]
  ];


  ICAL.Time.SUNDAY = 1;
  ICAL.Time.MONDAY = 2;
  ICAL.Time.TUESDAY = 3;
  ICAL.Time.WEDNESDAY = 4;
  ICAL.Time.THURSDAY = 5;
  ICAL.Time.FRIDAY = 6;
  ICAL.Time.SATURDAY = 7;

  ICAL.Time.DEFAULT_WEEK_START = ICAL.Time.MONDAY;
})();
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2011-2012 */



(typeof(ICAL) === 'undefined')? ICAL = {} : '';
(function() {

  var DOW_MAP = {
    SU: ICAL.Time.SUNDAY,
    MO: ICAL.Time.MONDAY,
    TU: ICAL.Time.TUESDAY,
    WE: ICAL.Time.WEDNESDAY,
    TH: ICAL.Time.THURSDAY,
    FR: ICAL.Time.FRIDAY,
    SA: ICAL.Time.SATURDAY
  };

  var REVERSE_DOW_MAP = {};
  for (var key in DOW_MAP) {
    REVERSE_DOW_MAP[DOW_MAP[key]] = key;
  }

  var COPY_PARTS = ["BYSECOND", "BYMINUTE", "BYHOUR", "BYDAY",
                    "BYMONTHDAY", "BYYEARDAY", "BYWEEKNO",
                    "BYMONTH", "BYSETPOS"];

  ICAL.Recur = function icalrecur(data) {
    this.wrappedJSObject = this;
    this.parts = {};

    if (typeof(data) === 'object') {
      for (var key in data) {
        this[key] = data[key];
      }

      if (this.until && !(this.until instanceof ICAL.Time)) {
        this.until = new ICAL.Time(this.until);
      }
    }

    if (!this.parts) {
      this.parts = {};
    }
  };

  ICAL.Recur.prototype = {

    parts: null,

    interval: 1,
    wkst: ICAL.Time.MONDAY,
    until: null,
    count: null,
    freq: null,
    icalclass: "icalrecur",
    icaltype: "recur",

    iterator: function(aStart) {
      return new ICAL.RecurIterator({
        rule: this,
        dtstart: aStart
      });
    },

    clone: function clone() {
      return new ICAL.Recur(this.toJSON());
    },

    isFinite: function isfinite() {
      return !!(this.count || this.until);
    },

    isByCount: function isbycount() {
      return !!(this.count && !this.until);
    },

    addComponent: function addPart(aType, aValue) {
      if (!(aType in this.parts)) {
        this.parts[aType] = [aValue];
      } else {
        this.parts[aType].push(aValue);
      }
    },

    setComponent: function setComponent(aType, aValues) {
      this.parts[aType] = aValues;
    },

    getComponent: function getComponent(aType, aCount) {
      var ucName = aType.toUpperCase();
      var components = (ucName in this.parts ? this.parts[ucName] : []);

      if (aCount) aCount.value = components.length;
      return components;
    },

    getNextOccurrence: function getNextOccurrence(aStartTime, aRecurrenceId) {
      var iter = this.iterator(aStartTime);
      var next, cdt;

      do {
        next = iter.next();
      } while (next && next.compare(aRecurrenceId) <= 0);

      if (next && aRecurrenceId.zone) {
        next.zone = aRecurrenceId.zone;
      }

      return next;
    },

    toJSON: function() {
      //XXX: extract this list up to proto?
      var propsToCopy = [
        "freq",
        "count",
        "until",
        "wkst",
        "interval",
        "parts"
      ];

      var result = Object.create(null);

      var i = 0;
      var len = propsToCopy.length;
      var prop;

      for (; i < len; i++) {
        var prop = propsToCopy[i];
        result[prop] = this[prop];
      }

      if (result.until instanceof ICAL.Time) {
        result.until = result.until.toJSON();
      }

      return result;
    },

    toString: function icalrecur_toString() {
      // TODO retain order
      var str = "FREQ=" + this.freq;
      if (this.count) {
        str += ";COUNT=" + this.count;
      }
      if (this.interval > 1) {
        str += ";INTERVAL=" + this.interval;
      }
      for (var k in this.parts) {
        str += ";" + k + "=" + this.parts[k];
      }
      if (this.until ){
        str += ';UNTIL=' + this.until.toString();
      }
      if ('wkst' in this && this.wkst !== ICAL.Time.DEFAULT_WEEK_START) {
        str += ';WKST=' + ICAL.Recur.numericDayToIcalDay(this.wkst);
      }
      return str;
    }
  };

  function parseNumericValue(type, min, max, value) {
    var result = value;

    if (value[0] === '+') {
      result = value.substr(1);
    }

    result = ICAL.helpers.strictParseInt(result);

    if (min !== undefined && value < min) {
      throw new Error(
        type + ': invalid value "' + value + '" must be > ' + min
      );
    }

    if (max !== undefined && value > max) {
      throw new Error(
        type + ': invalid value "' + value + '" must be < ' + min
      );
    }

    return result;
  }

  /**
   * Convert an ical representation of a day (SU, MO, etc..)
   * into a numeric value of that day.
   *
   * @param {String} day ical day.
   * @return {Numeric} numeric value of given day.
   */
  ICAL.Recur.icalDayToNumericDay = function toNumericDay(string) {
    //XXX: this is here so we can deal
    //     with possibly invalid string values.

    return DOW_MAP[string];
  };

  /**
   * Convert a numeric day value into its ical representation (SU, MO, etc..)
   *
   * @param {Numeric} numeric value of given day.
   * @return {String} day ical day.
   */
  ICAL.Recur.numericDayToIcalDay = function toIcalDay(num) {
    //XXX: this is here so we can deal with possibly invalid number values.
    //     Also, this allows consistent mapping between day numbers and day
    //     names for external users.
    return REVERSE_DOW_MAP[num];
  };

  var VALID_DAY_NAMES = /^(SU|MO|TU|WE|TH|FR|SA)$/;
  var VALID_BYDAY_PART = /^([+-])?(5[0-3]|[1-4][0-9]|[1-9])?(SU|MO|TU|WE|TH|FR|SA)$/;
  var ALLOWED_FREQ = ['SECONDLY', 'MINUTELY', 'HOURLY',
                      'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

  var optionDesign = {
    FREQ: function(value, dict) {
      // yes this is actually equal or faster then regex.
      // upside here is we can enumerate the valid values.
      if (ALLOWED_FREQ.indexOf(value) !== -1) {
        dict.freq = value;
      } else {
        throw new Error(
          'invalid frequency "' + value + '" expected: "' +
          ALLOWED_FREQ.join(', ') + '"'
        );
      }
    },

    COUNT: function(value, dict) {
      dict.count = ICAL.helpers.strictParseInt(value);
    },

    INTERVAL: function(value, dict) {
      dict.interval = ICAL.helpers.strictParseInt(value);
      if (dict.interval < 1) {
        // 0 or negative values are not allowed, some engines seem to generate
        // it though. Assume 1 instead.
        dict.interval = 1;
      }
    },

    UNTIL: function(value, dict) {
      dict.until = ICAL.Time.fromString(value);
    },

    WKST: function(value, dict) {
      if (VALID_DAY_NAMES.test(value)) {
        dict.wkst = ICAL.Recur.icalDayToNumericDay(value);
      } else {
        throw new Error('invalid WKST value "' + value + '"');
      }
    }
  };

  var partDesign = {
    BYSECOND: parseNumericValue.bind(this, 'BYSECOND', 0, 60),
    BYMINUTE: parseNumericValue.bind(this, 'BYMINUTE', 0, 59),
    BYHOUR: parseNumericValue.bind(this, 'BYHOUR', 0, 23),
    BYDAY: function(value) {
      if (VALID_BYDAY_PART.test(value)) {
        return value;
      } else {
        throw new Error('invalid BYDAY value "' + value + '"');
      }
    },
    BYMONTHDAY: parseNumericValue.bind(this, 'BYMONTHDAY', -31, 31),
    BYYEARDAY: parseNumericValue.bind(this, 'BYYEARDAY', -366, 366),
    BYWEEKNO: parseNumericValue.bind(this, 'BYWEEKNO', -53, 53),
    BYMONTH: parseNumericValue.bind(this, 'BYMONTH', 0, 12),
    BYSETPOS: parseNumericValue.bind(this, 'BYSETPOS', -366, 366)
  };

  ICAL.Recur.fromString = function(string) {
    var dict = Object.create(null);
    var dictParts = dict.parts = Object.create(null);

    // split is slower in FF but fast enough.
    // v8 however this is faster then manual split?
    var values = string.split(';');
    var len = values.length;

    for (var i = 0; i < len; i++) {
      var parts = values[i].split('=');
      var name = parts[0];
      var value = parts[1];

      if (name in partDesign) {
        var partArr = value.split(',');
        var partArrIdx = 0;
        var partArrLen = partArr.length;

        for (; partArrIdx < partArrLen; partArrIdx++) {
          partArr[partArrIdx] = partDesign[name](partArr[partArrIdx]);
        }
        dictParts[name] = partArr;
      } else if (name in optionDesign) {
        optionDesign[name](value, dict);
      }
    }

    return new ICAL.Recur(dict);
  };

})();
ICAL.RecurIterator = (function() {

  /**
   * Options:
   *  - rule: (ICAL.Recur) instance
   *  - dtstart: (ICAL.Time) start date of recurrence rule
   *  - initialized: (Boolean) when true will assume options
   *                           are from previously constructed
   *                           iterator and will not re-initialize
   *                           iterator but resume its state from given data.
   *
   *  - by_data: (for iterator de-serialization)
   *  - days: "
   *  - last: "
   *  - by_indices: "
   */
  function icalrecur_iterator(options) {
    this.fromData(options);
  }

  icalrecur_iterator.prototype = {

    /**
     * True when iteration is finished.
     */
    completed: false,

    rule: null,
    dtstart: null,
    last: null,
    occurrence_number: 0,
    by_indices: null,
    initialized: false,
    by_data: null,

    days: null,
    days_index: 0,

    fromData: function(options) {
      this.rule = ICAL.helpers.formatClassType(options.rule, ICAL.Recur);

      if (!this.rule) {
        throw new Error('iterator requires a (ICAL.Recur) rule');
      }

      this.dtstart = ICAL.helpers.formatClassType(options.dtstart, ICAL.Time);

      if (!this.dtstart) {
        throw new Error('iterator requires a (ICAL.Time) dtstart');
      }

      if (options.by_data) {
        this.by_data = options.by_data;
      } else {
        this.by_data = ICAL.helpers.clone(this.rule.parts, true);
      }

      if (options.occurrence_number)
        this.occurrence_number = options.occurrence_number;

      this.days = options.days || [];
      this.last = ICAL.helpers.formatClassType(options.last, ICAL.Time);

      this.by_indices = options.by_indices;

      if (!this.by_indices) {
        this.by_indices = {
          "BYSECOND": 0,
          "BYMINUTE": 0,
          "BYHOUR": 0,
          "BYDAY": 0,
          "BYMONTH": 0,
          "BYWEEKNO": 0,
          "BYMONTHDAY": 0
        };
      }

      this.initialized = options.initialized || false;

      if (!this.initialized) {
        this.init();
      }
    },

    init: function icalrecur_iterator_init() {
      this.initialized = true;
      this.last = this.dtstart.clone();
      var parts = this.by_data;

      if ("BYDAY" in parts) {
        // libical does this earlier when the rule is loaded, but we postpone to
        // now so we can preserve the original order.
        this.sort_byday_rules(parts.BYDAY, this.rule.wkst);
      }

      // If the BYYEARDAY appares, no other date rule part may appear
      if ("BYYEARDAY" in parts) {
        if ("BYMONTH" in parts || "BYWEEKNO" in parts ||
            "BYMONTHDAY" in parts || "BYDAY" in parts) {
          throw new Error("Invalid BYYEARDAY rule");
        }
      }

      // BYWEEKNO and BYMONTHDAY rule parts may not both appear
      if ("BYWEEKNO" in parts && "BYMONTHDAY" in parts) {
        throw new Error("BYWEEKNO does not fit to BYMONTHDAY");
      }

      // For MONTHLY recurrences (FREQ=MONTHLY) neither BYYEARDAY nor
      // BYWEEKNO may appear.
      if (this.rule.freq == "MONTHLY" &&
          ("BYYEARDAY" in parts || "BYWEEKNO" in parts)) {
        throw new Error("For MONTHLY recurrences neither BYYEARDAY nor BYWEEKNO may appear");
      }

      // For WEEKLY recurrences (FREQ=WEEKLY) neither BYMONTHDAY nor
      // BYYEARDAY may appear.
      if (this.rule.freq == "WEEKLY" &&
          ("BYYEARDAY" in parts || "BYMONTHDAY" in parts)) {
        throw new Error("For WEEKLY recurrences neither BYMONTHDAY nor BYYEARDAY may appear");
      }

      // BYYEARDAY may only appear in YEARLY rules
      if (this.rule.freq != "YEARLY" && "BYYEARDAY" in parts) {
        throw new Error("BYYEARDAY may only appear in YEARLY rules");
      }

      this.last.second = this.setup_defaults("BYSECOND", "SECONDLY", this.dtstart.second);
      this.last.minute = this.setup_defaults("BYMINUTE", "MINUTELY", this.dtstart.minute);
      this.last.hour = this.setup_defaults("BYHOUR", "HOURLY", this.dtstart.hour);
      this.last.day = this.setup_defaults("BYMONTHDAY", "DAILY", this.dtstart.day);
      this.last.month = this.setup_defaults("BYMONTH", "MONTHLY", this.dtstart.month);

      if (this.rule.freq == "WEEKLY") {
        if ("BYDAY" in parts) {
          var parts = this.ruleDayOfWeek(parts.BYDAY[0]);
          var pos = parts[0];
          var rule_dow = parts[1];
          var dow = rule_dow - this.last.dayOfWeek();
          if ((this.last.dayOfWeek() < rule_dow && dow >= 0) || dow < 0) {
            // Initial time is after first day of BYDAY data
            this.last.day += dow;
          }
        } else {
          var dayName = ICAL.Recur.numericDayToIcalDay(this.dtstart.dayOfWeek());
          parts.BYDAY = [dayName];
        }
      }

      if (this.rule.freq == "YEARLY") {
        for (;;) {
          this.expand_year_days(this.last.year);
          if (this.days.length > 0) {
            break;
          }
          this.increment_year(this.rule.interval);
        }

        var next = ICAL.Time.fromDayOfYear(this.days[0], this.last.year);

        this.last.day = next.day;
        this.last.month = next.month;
      }

      if (this.rule.freq == "MONTHLY" && this.has_by_data("BYDAY")) {

        var coded_day = this.by_data.BYDAY[this.by_indices.BYDAY];
        var parts = this.ruleDayOfWeek(coded_day);
        var pos = parts[0];
        var dow = parts[1];

        var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
        var poscount = 0;

        if (pos >= 0) {
          for (this.last.day = 1; this.last.day <= daysInMonth; this.last.day++) {
            if (this.last.dayOfWeek() == dow) {
              if (++poscount == pos || pos == 0) {
                break;
              }
            }
          }
        } else {
          pos = -pos;
          for (this.last.day = daysInMonth; this.last.day != 0; this.last.day--) {
            if (this.last.dayOfWeek() == dow) {
              if (++poscount == pos) {
                break;
              }
            }
          }
        }

        //XXX: This feels like a hack, but we need to initialize
        //     the BYMONTHDAY case correctly and byDayAndMonthDay handles
        //     this case. It accepts a special flag which will avoid incrementing
        //     the initial value without the flag days that match the start time
        //     would be missed.
        if (this.has_by_data('BYMONTHDAY')) {
          this._byDayAndMonthDay(true);
        }

        if (this.last.day > daysInMonth || this.last.day == 0) {
          throw new Error("Malformed values in BYDAY part");
        }

      } else if (this.has_by_data("BYMONTHDAY")) {
        if (this.last.day < 0) {
          var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
          this.last.day = daysInMonth + this.last.day + 1;
        }
      }

    },

    next: function icalrecur_iterator_next() {
      var before = (this.last ? this.last.clone() : null);

      if ((this.rule.count && this.occurrence_number >= this.rule.count) ||
          (this.rule.until && this.last.compare(this.rule.until) > 0)) {

        //XXX: right now this is just a flag and has no impact
        //     we can simplify the above case to check for completed later.
        this.completed = true;

        return null;
      }

      if (this.occurrence_number == 0 && this.last.compare(this.dtstart) >= 0) {
        // First of all, give the instance that was initialized
        this.occurrence_number++;
        return this.last;
      }

      do {
        var valid = 1;

        switch (this.rule.freq) {
        case "SECONDLY":
          this.next_second();
          break;
        case "MINUTELY":
          this.next_minute();
          break;
        case "HOURLY":
          this.next_hour();
          break;
        case "DAILY":
          this.next_day();
          break;
        case "WEEKLY":
          this.next_week();
          break;
        case "MONTHLY":
          valid = this.next_month();
          break;
        case "YEARLY":
          this.next_year();
          break;

        default:
          return null;
        }
      } while (!this.check_contracting_rules() ||
               this.last.compare(this.dtstart) < 0 ||
               !valid);

      // TODO is this valid?
      if (this.last.compare(before) == 0) {
        throw new Error("Same occurrence found twice, protecting " +
                        "you from death by recursion");
      }

      if (this.rule.until && this.last.compare(this.rule.until) > 0) {
        this.completed = true;
        return null;
      } else {
        this.occurrence_number++;
        return this.last;
      }
    },

    next_second: function next_second() {
      return this.next_generic("BYSECOND", "SECONDLY", "second", "minute");
    },

    increment_second: function increment_second(inc) {
      return this.increment_generic(inc, "second", 60, "minute");
    },

    next_minute: function next_minute() {
      return this.next_generic("BYMINUTE", "MINUTELY",
                               "minute", "hour", "next_second");
    },

    increment_minute: function increment_minute(inc) {
      return this.increment_generic(inc, "minute", 60, "hour");
    },

    next_hour: function next_hour() {
      return this.next_generic("BYHOUR", "HOURLY", "hour",
                               "monthday", "next_minute");
    },

    increment_hour: function increment_hour(inc) {
      this.increment_generic(inc, "hour", 24, "monthday");
    },

    next_day: function next_day() {
      var has_by_day = ("BYDAY" in this.by_data);
      var this_freq = (this.rule.freq == "DAILY");

      if (this.next_hour() == 0) {
        return 0;
      }

      if (this_freq) {
        this.increment_monthday(this.rule.interval);
      } else {
        this.increment_monthday(1);
      }

      return 0;
    },

    next_week: function next_week() {
      var end_of_data = 0;

      if (this.next_weekday_by_week() == 0) {
        return end_of_data;
      }

      if (this.has_by_data("BYWEEKNO")) {
        var idx = ++this.by_indices.BYWEEKNO;

        if (this.by_indices.BYWEEKNO == this.by_data.BYWEEKNO.length) {
          this.by_indices.BYWEEKNO = 0;
          end_of_data = 1;
        }

        // HACK should be first month of the year
        this.last.month = 1;
        this.last.day = 1;

        var week_no = this.by_data.BYWEEKNO[this.by_indices.BYWEEKNO];

        this.last.day += 7 * week_no;

        if (end_of_data) {
          this.increment_year(1);
        }
      } else {
        // Jump to the next week
        this.increment_monthday(7 * this.rule.interval);
      }

      return end_of_data;
    },

    /**
     * normalize each by day rule for a given year/month.
     * Takes into account ordering and negative rules
     *
     * @param {Numeric} year current year.
     * @param {Numeric} month current month.
     * @param {Array} rules array of rules.
     *
     * @return {Array} sorted and normalized rules.
     *                 Negative rules will be expanded to their
     *                 correct positive values for easier processing.
     */
    normalizeByMonthDayRules: function(year, month, rules) {
      var daysInMonth = ICAL.Time.daysInMonth(month, year);

      // XXX: This is probably bad for performance to allocate
      //      a new array for each month we scan, if possible
      //      we should try to optimize this...
      var newRules = [];

      var ruleIdx = 0;
      var len = rules.length;
      var rule;

      for (; ruleIdx < len; ruleIdx++) {
        rule = rules[ruleIdx];

        // if this rule falls outside of given
        // month discard it.
        if (Math.abs(rule) > daysInMonth) {
          continue;
        }

        // negative case
        if (rule < 0) {
          // we add (not subtract its a negative number)
          // one from the rule because 1 === last day of month
          rule = daysInMonth + (rule + 1);
        } else if (rule === 0) {
          // skip zero its invalid.
          continue;
        }

        // only add unique items...
        if (newRules.indexOf(rule) === -1) {
          newRules.push(rule);
        }

      }

      // unique and sort
      return newRules.sort(function(a,b){return a - b});
    },

    /**
     * NOTES:
     * We are given a list of dates in the month (BYMONTHDAY) (23, etc..)
     * Also we are given a list of days (BYDAY) (MO, 2SU, etc..) when
     * both conditions match a given date (this.last.day) iteration stops.
     *
     * @param {Boolean} [isInit] when given true will not
     *                           increment the current day (this.last).
     */
    _byDayAndMonthDay: function(isInit) {
      var byMonthDay; // setup in initMonth
      var byDay = this.by_data.BYDAY;

      var date;
      var dateIdx = 0;
      var dateLen; // setup in initMonth
      var dayLen = byDay.length;

      // we are not valid by default
      var dataIsValid = 0;

      var daysInMonth;
      var self = this;
      // we need a copy of this, because a DateTime gets normalized
      // automatically if the day is out of range. At some points we 
      // set the last day to 0 to start counting.
      var lastDay = this.last.day;

      function initMonth() {
        daysInMonth = ICAL.Time.daysInMonth(
          self.last.month, self.last.year
        );

        byMonthDay = self.normalizeByMonthDayRules(
          self.last.year,
          self.last.month,
          self.by_data.BYMONTHDAY
        );

        dateLen = byMonthDay.length;

        // For the case of more than one occurrence in one month
        // we have to be sure to start searching after the last
        // found date or at the last BYMONTHDAY.
        while (byMonthDay[dateIdx] <= lastDay && dateIdx < dateLen - 1) {
          dateIdx++;
        }
      }

      function nextMonth() {
        // since the day is incremented at the start
        // of the loop below, we need to start at 0
        lastDay = 0;
        self.increment_month();
        dateIdx = 0;
        initMonth();
      }

      initMonth();

      // should come after initMonth
      if (isInit) {
        lastDay -= 1;
      }

      while (!dataIsValid) {
        // increment the current date. This is really
        // important otherwise we may fall into the infinite
        // loop trap. The initial date takes care of the case
        // where the current date is the date we are looking
        // for.
        date = lastDay + 1;

        if (date > daysInMonth) {
          nextMonth();
          continue;
        }

        // find next date
        var next = byMonthDay[dateIdx++];

        // this logic is dependant on the BYMONTHDAYS
        // being in order (which is done by #normalizeByMonthDayRules)
        if (next >= date) {
          // if the next month day is in the future jump to it.
          lastDay = next;
        } else {
          // in this case the 'next' monthday has past
          // we must move to the month.
          nextMonth();
          continue;
        }

        // Now we can loop through the day rules to see
        // if one matches the current month date.
        for (var dayIdx = 0; dayIdx < dayLen; dayIdx++) {
          var parts = this.ruleDayOfWeek(byDay[dayIdx]);
          var pos = parts[0];
          var dow = parts[1];

          this.last.day = lastDay;
          if (this.last.isNthWeekDay(dow, pos)) {
            // when we find the valid one we can mark
            // the conditions as met and break the loop.
            // (Because we have this condition above
            //  it will also break the parent loop).
            dataIsValid = 1;
            break;
          }
        }

        // Its completely possible that the combination
        // cannot be matched in the current month.
        // When we reach the end of possible combinations
        // in the current month we iterate to the next one.
        // since dateIdx is incremented right after getting
        // "next", we don't need dateLen -1 here.
        if (!dataIsValid && dateIdx === dateLen) {
          nextMonth();
          continue;
        }
      }

      return dataIsValid;
    },

    next_month: function next_month() {
      var this_freq = (this.rule.freq == "MONTHLY");
      var data_valid = 1;

      if (this.next_hour() == 0) {
        return data_valid;
      }

      if (this.has_by_data("BYDAY") && this.has_by_data("BYMONTHDAY")) {
        data_valid = this._byDayAndMonthDay();
      } else if (this.has_by_data("BYDAY")) {
        var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
        var setpos = 0;

        if (this.has_by_data("BYSETPOS")) {
          var last_day = this.last.day;
          for (var day = 1; day <= daysInMonth; day++) {
            this.last.day = day;
            if (this.is_day_in_byday(this.last) && day <= last_day) {
              setpos++;
            }
          }
          this.last.day = last_day;
        }

        for (var day = this.last.day + 1; day <= daysInMonth; day++) {
          this.last.day = day;

          if (this.is_day_in_byday(this.last)) {
            if (!this.has_by_data("BYSETPOS") ||
                this.check_set_position(++setpos) ||
                this.check_set_position(setpos - this.by_data.BYSETPOS.length - 1)) {

              data_valid = 1;
              break;
            }
          }
        }

        if (day > daysInMonth) {
          this.last.day = 1;
          this.increment_month();

          if (this.is_day_in_byday(this.last)) {
            if (!this.has_by_data("BYSETPOS") || this.check_set_position(1)) {
              data_valid = 1;
            }
          } else {
            data_valid = 0;
          }
        }
      } else if (this.has_by_data("BYMONTHDAY")) {
        this.by_indices.BYMONTHDAY++;

        if (this.by_indices.BYMONTHDAY >= this.by_data.BYMONTHDAY.length) {
          this.by_indices.BYMONTHDAY = 0;
          this.increment_month();
        }

        var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);

        var day = this.by_data.BYMONTHDAY[this.by_indices.BYMONTHDAY];

        if (day < 0) {
          day = daysInMonth + day + 1;
        }

        if (day > daysInMonth) {
          this.last.day = 1;
          data_valid = this.is_day_in_byday(this.last);
        } else {
          this.last.day = day;
        }

      } else {
        this.increment_month();
        var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
        this.last.day = Math.min(this.by_data.BYMONTHDAY[0], daysInMonth);
      }

      return data_valid;
    },

    next_weekday_by_week: function next_weekday_by_week() {
      var end_of_data = 0;

      if (this.next_hour() == 0) {
        return end_of_data;
      }

      if (!this.has_by_data("BYDAY")) {
        return 1;
      }

      for (;;) {
        var tt = new ICAL.Time();
        this.by_indices.BYDAY++;

        if (this.by_indices.BYDAY == Object.keys(this.by_data.BYDAY).length) {
          this.by_indices.BYDAY = 0;
          end_of_data = 1;
        }

        var coded_day = this.by_data.BYDAY[this.by_indices.BYDAY];
        var parts = this.ruleDayOfWeek(coded_day);
        var dow = parts[1];

        dow -= this.rule.wkst;

        if (dow < 0) {
          dow += 7;
        }

        tt.year = this.last.year;
        tt.month = this.last.month;
        tt.day = this.last.day;

        var startOfWeek = tt.startDoyWeek(this.rule.wkst);

        if (dow + startOfWeek < 1) {
          // The selected date is in the previous year
          if (!end_of_data) {
            continue;
          }
        }

        var next = ICAL.Time.fromDayOfYear(startOfWeek + dow,
                                                  this.last.year);

        /**
         * The normalization horrors below are due to
         * the fact that when the year/month/day changes
         * it can effect the other operations that come after.
         */
        this.last.year = next.year;
        this.last.month = next.month;
        this.last.day = next.day;

        return end_of_data;
      }
    },

    next_year: function next_year() {

      if (this.next_hour() == 0) {
        return 0;
      }

      if (++this.days_index == this.days.length) {
        this.days_index = 0;
        do {
          this.increment_year(this.rule.interval);
          this.expand_year_days(this.last.year);
        } while (this.days.length == 0);
      }

      var next = ICAL.Time.fromDayOfYear(this.days[this.days_index],
                                                this.last.year);

      this.last.day = next.day;
      this.last.month = next.month;

      return 1;
    },

    ruleDayOfWeek: function ruleDayOfWeek(dow) {
      var matches = dow.match(/([+-]?[0-9])?(MO|TU|WE|TH|FR|SA|SU)/);
      if (matches) {
        var pos = parseInt(matches[1] || 0, 10);
        dow = ICAL.Recur.icalDayToNumericDay(matches[2]);
        return [pos, dow];
      } else {
        return [0, 0];
      }
    },

    next_generic: function next_generic(aRuleType, aInterval, aDateAttr,
                                        aFollowingAttr, aPreviousIncr) {
      var has_by_rule = (aRuleType in this.by_data);
      var this_freq = (this.rule.freq == aInterval);
      var end_of_data = 0;

      if (aPreviousIncr && this[aPreviousIncr]() == 0) {
        return end_of_data;
      }

      if (has_by_rule) {
        this.by_indices[aRuleType]++;
        var idx = this.by_indices[aRuleType];
        var dta = this.by_data[aRuleType];

        if (this.by_indices[aRuleType] == dta.length) {
          this.by_indices[aRuleType] = 0;
          end_of_data = 1;
        }
        this.last[aDateAttr] = dta[this.by_indices[aRuleType]];
      } else if (this_freq) {
        this["increment_" + aDateAttr](this.rule.interval);
      }

      if (has_by_rule && end_of_data && this_freq) {
        this["increment_" + aFollowingAttr](1);
      }

      return end_of_data;
    },

    increment_monthday: function increment_monthday(inc) {
      for (var i = 0; i < inc; i++) {
        var daysInMonth = ICAL.Time.daysInMonth(this.last.month, this.last.year);
        this.last.day++;

        if (this.last.day > daysInMonth) {
          this.last.day -= daysInMonth;
          this.increment_month();
        }
      }
    },

    increment_month: function increment_month() {
      this.last.day = 1;
      if (this.has_by_data("BYMONTH")) {
        this.by_indices.BYMONTH++;

        if (this.by_indices.BYMONTH == this.by_data.BYMONTH.length) {
          this.by_indices.BYMONTH = 0;
          this.increment_year(1);
        }

        this.last.month = this.by_data.BYMONTH[this.by_indices.BYMONTH];
      } else {
        if (this.rule.freq == "MONTHLY") {
          this.last.month += this.rule.interval;
        } else {
          this.last.month++;
        }

        this.last.month--;
        var years = ICAL.helpers.trunc(this.last.month / 12);
        this.last.month %= 12;
        this.last.month++;

        if (years != 0) {
          this.increment_year(years);
        }
      }
    },

    increment_year: function increment_year(inc) {
      this.last.year += inc;
    },

    increment_generic: function increment_generic(inc, aDateAttr,
                                                  aFactor, aNextIncrement) {
      this.last[aDateAttr] += inc;
      var nextunit = ICAL.helpers.trunc(this.last[aDateAttr] / aFactor);
      this.last[aDateAttr] %= aFactor;
      if (nextunit != 0) {
        this["increment_" + aNextIncrement](nextunit);
      }
    },

    has_by_data: function has_by_data(aRuleType) {
      return (aRuleType in this.rule.parts);
    },

    expand_year_days: function expand_year_days(aYear) {
      var t = new ICAL.Time();
      this.days = [];

      // We need our own copy with a few keys set
      var parts = {};
      var rules = ["BYDAY", "BYWEEKNO", "BYMONTHDAY", "BYMONTH", "BYYEARDAY"];
      for (var p in rules) {
        var part = rules[p];
        if (part in this.rule.parts) {
          parts[part] = this.rule.parts[part];
        }
      }

      if ("BYMONTH" in parts && "BYWEEKNO" in parts) {
        var valid = 1;
        var validWeeks = {};
        t.year = aYear;
        t.isDate = true;

        for (var monthIdx = 0; monthIdx < this.by_data.BYMONTH.length; monthIdx++) {
          var month = this.by_data.BYMONTH[monthIdx];
          t.month = month;
          t.day = 1;
          var first_week = t.weekNumber(this.rule.wkst);
          t.day = ICAL.Time.daysInMonth(month, aYear);
          var last_week = t.weekNumber(this.rule.wkst);
          for (monthIdx = first_week; monthIdx < last_week; monthIdx++) {
            validWeeks[monthIdx] = 1;
          }
        }

        for (var weekIdx = 0; weekIdx < this.by_data.BYWEEKNO.length && valid; weekIdx++) {
          var weekno = this.by_data.BYWEEKNO[weekIdx];
          if (weekno < 52) {
            valid &= validWeeks[weekIdx];
          } else {
            valid = 0;
          }
        }

        if (valid) {
          delete parts.BYMONTH;
        } else {
          delete parts.BYWEEKNO;
        }
      }

      var partCount = Object.keys(parts).length;

      if (partCount == 0) {
        var t = this.dtstart.clone();
        t.year = this.last.year;
        this.days.push(t.dayOfYear());
      } else if (partCount == 1 && "BYMONTH" in parts) {
        for (var monthkey in this.by_data.BYMONTH) {
          var t2 = this.dtstart.clone();
          t2.year = aYear;
          t2.month = this.by_data.BYMONTH[monthkey];
          t2.isDate = true;
          this.days.push(t2.dayOfYear());
        }
      } else if (partCount == 1 && "BYMONTHDAY" in parts) {
        for (var monthdaykey in this.by_data.BYMONTHDAY) {
          var t2 = this.dtstart.clone();
          t2.day = this.by_data.BYMONTHDAY[monthdaykey];
          t2.year = aYear;
          t2.isDate = true;
          this.days.push(t2.dayOfYear());
        }
      } else if (partCount == 2 &&
                 "BYMONTHDAY" in parts &&
                 "BYMONTH" in parts) {
        for (var monthkey in this.by_data.BYMONTH) {
          for (var monthdaykey in this.by_data.BYMONTHDAY) {
            t.day = this.by_data.BYMONTHDAY[monthdaykey];
            t.month = this.by_data.BYMONTH[monthkey];
            t.year = aYear;
            t.isDate = true;

            this.days.push(t.dayOfYear());
          }
        }
      } else if (partCount == 1 && "BYWEEKNO" in parts) {
        // TODO unimplemented in libical
      } else if (partCount == 2 &&
                 "BYWEEKNO" in parts &&
                 "BYMONTHDAY" in parts) {
        // TODO unimplemented in libical
      } else if (partCount == 1 && "BYDAY" in parts) {
        this.days = this.days.concat(this.expand_by_day(aYear));
      } else if (partCount == 2 && "BYDAY" in parts && "BYMONTH" in parts) {
        for (var monthkey in this.by_data.BYMONTH) {
          month = this.by_data.BYMONTH[monthkey];
          var daysInMonth = ICAL.Time.daysInMonth(month, aYear);

          t.year = aYear;
          t.month = this.by_data.BYMONTH[monthkey];
          t.day = 1;
          t.isDate = true;

          var first_dow = t.dayOfWeek();
          var doy_offset = t.dayOfYear() - 1;

          t.day = daysInMonth;
          var last_dow = t.dayOfWeek();

          if (this.has_by_data("BYSETPOS")) {
            var set_pos_counter = 0;
            var by_month_day = [];
            for (var day = 1; day <= daysInMonth; day++) {
              t.day = day;
              if (this.is_day_in_byday(t)) {
                by_month_day.push(day);
              }
            }

            for (var spIndex = 0; spIndex < by_month_day.length; spIndex++) {
              if (this.check_set_position(spIndex + 1) ||
                  this.check_set_position(spIndex - by_month_day.length)) {
                this.days.push(doy_offset + by_month_day[spIndex]);
              }
            }
          } else {
            for (var daycodedkey in this.by_data.BYDAY) {
              //TODO: This should return dates in order of occurrence
              //      (1,2,3, etc...) instead of by weekday (su, mo, etc..)
              var coded_day = this.by_data.BYDAY[daycodedkey];
              var parts = this.ruleDayOfWeek(coded_day);
              var pos = parts[0];
              var dow = parts[1];
              var month_day;

              var first_matching_day = ((dow + 7 - first_dow) % 7) + 1;
              var last_matching_day = daysInMonth - ((last_dow + 7 - dow) % 7);

              if (pos == 0) {
                for (var day = first_matching_day; day <= daysInMonth; day += 7) {
                  this.days.push(doy_offset + day);
                }
              } else if (pos > 0) {
                month_day = first_matching_day + (pos - 1) * 7;

                if (month_day <= daysInMonth) {
                  this.days.push(doy_offset + month_day);
                }
              } else {
                month_day = last_matching_day + (pos + 1) * 7;

                if (month_day > 0) {
                  this.days.push(doy_offset + month_day);
                }
              }
            }
          }
        }
      } else if (partCount == 2 && "BYDAY" in parts && "BYMONTHDAY" in parts) {
        var expandedDays = this.expand_by_day(aYear);

        for (var daykey in expandedDays) {
          var day = expandedDays[daykey];
          var tt = ICAL.Time.fromDayOfYear(day, aYear);
          if (this.by_data.BYMONTHDAY.indexOf(tt.day) >= 0) {
            this.days.push(day);
          }
        }
      } else if (partCount == 3 &&
                 "BYDAY" in parts &&
                 "BYMONTHDAY" in parts &&
                 "BYMONTH" in parts) {
        var expandedDays = this.expand_by_day(aYear);

        for (var daykey in expandedDays) {
          var day = expandedDays[daykey];
          var tt = ICAL.Time.fromDayOfYear(day, aYear);

          if (this.by_data.BYMONTH.indexOf(tt.month) >= 0 &&
              this.by_data.BYMONTHDAY.indexOf(tt.day) >= 0) {
            this.days.push(day);
          }
        }
      } else if (partCount == 2 && "BYDAY" in parts && "BYWEEKNO" in parts) {
        var expandedDays = this.expand_by_day(aYear);

        for (var daykey in expandedDays) {
          var day = expandedDays[daykey];
          var tt = ICAL.Time.fromDayOfYear(day, aYear);
          var weekno = tt.weekNumber(this.rule.wkst);

          if (this.by_data.BYWEEKNO.indexOf(weekno)) {
            this.days.push(day);
          }
        }
      } else if (partCount == 3 &&
                 "BYDAY" in parts &&
                 "BYWEEKNO" in parts &&
                 "BYMONTHDAY" in parts) {
        // TODO unimplemted in libical
      } else if (partCount == 1 && "BYYEARDAY" in parts) {
        this.days = this.days.concat(this.by_data.BYYEARDAY);
      } else {
        this.days = [];
      }
      return 0;
    },

    expand_by_day: function expand_by_day(aYear) {

      var days_list = [];
      var tmp = this.last.clone();

      tmp.year = aYear;
      tmp.month = 1;
      tmp.day = 1;
      tmp.isDate = true;

      var start_dow = tmp.dayOfWeek();

      tmp.month = 12;
      tmp.day = 31;
      tmp.isDate = true;

      var end_dow = tmp.dayOfWeek();
      var end_year_day = tmp.dayOfYear();

      for (var daykey in this.by_data.BYDAY) {
        var day = this.by_data.BYDAY[daykey];
        var parts = this.ruleDayOfWeek(day);
        var pos = parts[0];
        var dow = parts[1];

        if (pos == 0) {
          var tmp_start_doy = ((dow + 7 - start_dow) % 7) + 1;

          for (var doy = tmp_start_doy; doy <= end_year_day; doy += 7) {
            days_list.push(doy);
          }

        } else if (pos > 0) {
          var first;
          if (dow >= start_dow) {
            first = dow - start_dow + 1;
          } else {
            first = dow - start_dow + 8;
          }

          days_list.push(first + (pos - 1) * 7);
        } else {
          var last;
          pos = -pos;

          if (dow <= end_dow) {
            last = end_year_day - end_dow + dow;
          } else {
            last = end_year_day - end_dow + dow - 7;
          }

          days_list.push(last - (pos - 1) * 7);
        }
      }
      return days_list;
    },

    is_day_in_byday: function is_day_in_byday(tt) {
      for (var daykey in this.by_data.BYDAY) {
        var day = this.by_data.BYDAY[daykey];
        var parts = this.ruleDayOfWeek(day);
        var pos = parts[0];
        var dow = parts[1];
        var this_dow = tt.dayOfWeek();

        if ((pos == 0 && dow == this_dow) ||
            (tt.nthWeekDay(dow, pos) == tt.day)) {
          return 1;
        }
      }

      return 0;
    },

    /**
     * Checks if given value is in BYSETPOS.
     *
     * @param {Numeric} aPos position to check for.
     * @return {Boolean} false unless BYSETPOS rules exist
     *                   and the given value is present in rules.
     */
    check_set_position: function check_set_position(aPos) {
      if (this.has_by_data('BYSETPOS')) {
        var idx = this.by_data.BYSETPOS.indexOf(aPos);
        // negative numbers are not false-y
        return idx !== -1;
      }
      return false;
    },

    sort_byday_rules: function icalrecur_sort_byday_rules(aRules, aWeekStart) {
      for (var i = 0; i < aRules.length; i++) {
        for (var j = 0; j < i; j++) {
          var one = this.ruleDayOfWeek(aRules[j])[1];
          var two = this.ruleDayOfWeek(aRules[i])[1];
          one -= aWeekStart;
          two -= aWeekStart;
          if (one < 0) one += 7;
          if (two < 0) two += 7;

          if (one > two) {
            var tmp = aRules[i];
            aRules[i] = aRules[j];
            aRules[j] = tmp;
          }
        }
      }
    },

    check_contract_restriction: function check_contract_restriction(aRuleType, v) {
      var indexMapValue = icalrecur_iterator._indexMap[aRuleType];
      var ruleMapValue = icalrecur_iterator._expandMap[this.rule.freq][indexMapValue];
      var pass = false;

      if (aRuleType in this.by_data &&
          ruleMapValue == icalrecur_iterator.CONTRACT) {

        var ruleType = this.by_data[aRuleType];

        for (var bydatakey in ruleType) {
          if (ruleType[bydatakey] == v) {
            pass = true;
            break;
          }
        }
      } else {
        // Not a contracting byrule or has no data, test passes
        pass = true;
      }
      return pass;
    },

    check_contracting_rules: function check_contracting_rules() {
      var dow = this.last.dayOfWeek();
      var weekNo = this.last.weekNumber(this.rule.wkst);
      var doy = this.last.dayOfYear();

      return (this.check_contract_restriction("BYSECOND", this.last.second) &&
              this.check_contract_restriction("BYMINUTE", this.last.minute) &&
              this.check_contract_restriction("BYHOUR", this.last.hour) &&
              this.check_contract_restriction("BYDAY", ICAL.Recur.numericDayToIcalDay(dow)) &&
              this.check_contract_restriction("BYWEEKNO", weekNo) &&
              this.check_contract_restriction("BYMONTHDAY", this.last.day) &&
              this.check_contract_restriction("BYMONTH", this.last.month) &&
              this.check_contract_restriction("BYYEARDAY", doy));
    },

    setup_defaults: function setup_defaults(aRuleType, req, deftime) {
      var indexMapValue = icalrecur_iterator._indexMap[aRuleType];
      var ruleMapValue = icalrecur_iterator._expandMap[this.rule.freq][indexMapValue];

      if (ruleMapValue != icalrecur_iterator.CONTRACT) {
        if (!(aRuleType in this.by_data)) {
          this.by_data[aRuleType] = [deftime];
        }
        if (this.rule.freq != req) {
          return this.by_data[aRuleType][0];
        }
      }
      return deftime;
    },

    /**
     * Convert iterator into a serialize-able object.
     * Will preserve current iteration sequence to ensure
     * the seamless continuation of the recurrence rule.
     */
    toJSON: function() {
      var result = Object.create(null);

      result.initialized = this.initialized;
      result.rule = this.rule.toJSON();
      result.dtstart = this.dtstart.toJSON();
      result.by_data = this.by_data;
      result.days = this.days;
      result.last = this.last.toJSON();
      result.by_indices = this.by_indices;
      result.occurrence_number = this.occurrence_number;

      return result;
    }

  };

  icalrecur_iterator._indexMap = {
    "BYSECOND": 0,
    "BYMINUTE": 1,
    "BYHOUR": 2,
    "BYDAY": 3,
    "BYMONTHDAY": 4,
    "BYYEARDAY": 5,
    "BYWEEKNO": 6,
    "BYMONTH": 7,
    "BYSETPOS": 8
  };

  icalrecur_iterator._expandMap = {
    "SECONDLY": [1, 1, 1, 1, 1, 1, 1, 1],
    "MINUTELY": [2, 1, 1, 1, 1, 1, 1, 1],
    "HOURLY": [2, 2, 1, 1, 1, 1, 1, 1],
    "DAILY": [2, 2, 2, 1, 1, 1, 1, 1],
    "WEEKLY": [2, 2, 2, 2, 3, 3, 1, 1],
    "MONTHLY": [2, 2, 2, 2, 2, 3, 3, 1],
    "YEARLY": [2, 2, 2, 2, 2, 2, 2, 2]
  };
  icalrecur_iterator.UNKNOWN = 0;
  icalrecur_iterator.CONTRACT = 1;
  icalrecur_iterator.EXPAND = 2;
  icalrecur_iterator.ILLEGAL = 3;

  return icalrecur_iterator;

}());
ICAL.RecurExpansion = (function() {
  function formatTime(item) {
    return ICAL.helpers.formatClassType(item, ICAL.Time);
  }

  function compareTime(a, b) {
    return a.compare(b);
  }

  function isRecurringComponent(comp) {
    return comp.hasProperty('rdate') ||
           comp.hasProperty('rrule') ||
           comp.hasProperty('recurrence-id');
  }

  /**
   * Primary class for expanding recurring rules.
   * Can take multiple rrules, rdates, exdate(s)
   * and iterate (in order) over each next occurrence.
   *
   * Once initialized this class can also be serialized
   * saved and continue iteration from the last point.
   *
   * NOTE: it is intended that this class is to be used
   *       with ICAL.Event which handles recurrence exceptions.
   *
   * Options:
   *  - dtstart: (ICAL.Time) start time of event (required)
   *  - component: (ICAL.Component) component (required unless resuming)
   *
   * Examples:
   *
   *    // assuming event is a parsed ical component
   *    var event;
   *
   *    var expand = new ICAL.RecurExpansion({
   *      component: event,
   *      start: event.getFirstPropertyValue('DTSTART')
   *    });
   *
   *    // remember there are infinite rules
   *    // so its a good idea to limit the scope
   *    // of the iterations then resume later on.
   *
   *    // next is always an ICAL.Time or null
   *    var next;
   *
   *    while(someCondition && (next = expand.next())) {
   *      // do something with next
   *    }
   *
   *    // save instance for later
   *    var json = JSON.stringify(expand);
   *
   *    //...
   *
   *    // NOTE: if the component's properties have
   *    //       changed you will need to rebuild the
   *    //       class and start over. This only works
   *    //       when the component's recurrence info is the same.
   *    var expand = new ICAL.RecurExpansion(JSON.parse(json));
   *
   *
   * @param {Object} options see options block.
   */
  function RecurExpansion(options) {
    this.ruleDates = [];
    this.exDates = [];
    this.fromData(options);
  }

  RecurExpansion.prototype = {

    /**
     * True when iteration is fully completed.
     */
    complete: false,

    /**
     * Array of rrule iterators.
     *
     * @type Array[ICAL.RecurIterator]
     * @private
     */
    ruleIterators: null,

    /**
     * Array of rdate instances.
     *
     * @type Array[ICAL.Time]
     * @private
     */
    ruleDates: null,

    /**
     * Array of exdate instances.
     *
     * @type Array[ICAL.Time]
     * @private
     */
    exDates: null,

    /**
     * Current position in ruleDates array.
     * @type Numeric
     * @private
     */
    ruleDateInc: 0,

    /**
     * Current position in exDates array
     * @type Numeric
     * @private
     */
    exDateInc: 0,

    /**
     * Current negative date.
     *
     * @type ICAL.Time
     * @private
     */
    exDate: null,

    /**
     * Current additional date.
     *
     * @type ICAL.Time
     * @private
     */
    ruleDate: null,

    /**
     * Start date of recurring rules.
     *
     * @type ICAL.Time
     */
    dtstart: null,

    /**
     * Last expanded time
     *
     * @type ICAL.Time
     */
    last: null,

    fromData: function(options) {
      var start = ICAL.helpers.formatClassType(options.dtstart, ICAL.Time);

      if (!start) {
        throw new Error('.dtstart (ICAL.Time) must be given');
      } else {
        this.dtstart = start;
      }

      if (options.component) {
        this._init(options.component);
      } else {
        this.last = formatTime(options.last);

        this.ruleIterators = options.ruleIterators.map(function(item) {
          return ICAL.helpers.formatClassType(item, ICAL.RecurIterator);
        });

        this.ruleDateInc = options.ruleDateInc;
        this.exDateInc = options.exDateInc;

        if (options.ruleDates) {
          this.ruleDates = options.ruleDates.map(formatTime);
          this.ruleDate = this.ruleDates[this.ruleDateInc];
        }

        if (options.exDates) {
          this.exDates = options.exDates.map(formatTime);
          this.exDate = this.exDates[this.exDateInc];
        }

        if (typeof(options.complete) !== 'undefined') {
          this.complete = options.complete;
        }
      }
    },

    next: function() {
      var iter;
      var ruleOfDay;
      var next;
      var compare;

      var maxTries = 500;
      var currentTry = 0;

      while (true) {
        if (currentTry++ > maxTries) {
          throw new Error(
            'max tries have occured, rule may be impossible to forfill.'
          );
        }

        next = this.ruleDate;
        iter = this._nextRecurrenceIter(this.last);

        // no more matches
        // because we increment the rule day or rule
        // _after_ we choose a value this should be
        // the only spot where we need to worry about the
        // end of events.
        if (!next && !iter) {
          // there are no more iterators or rdates
          this.complete = true;
          break;
        }

        // no next rule day or recurrence rule is first.
        if (!next || (iter && next.compare(iter.last) > 0)) {
          // must be cloned, recur will reuse the time element.
          next = iter.last.clone();
          // move to next so we can continue
          iter.next();
        }

        // if the ruleDate is still next increment it.
        if (this.ruleDate === next) {
          this._nextRuleDay();
        }

        this.last = next;

        // check the negative rules
        if (this.exDate) {
          compare = this.exDate.compare(this.last);

          if (compare < 0) {
            this._nextExDay();
          }

          // if the current rule is excluded skip it.
          if (compare === 0) {
            this._nextExDay();
            continue;
          }
        }

        //XXX: The spec states that after we resolve the final
        //     list of dates we execute exdate this seems somewhat counter
        //     intuitive to what I have seen most servers do so for now
        //     I exclude based on the original date not the one that may
        //     have been modified by the exception.
        return this.last;
      }
    },

    /**
     * Converts object into a serialize-able format.
     */
    toJSON: function() {
      function toJSON(item) {
        return item.toJSON();
      }

      var result = Object.create(null);
      result.ruleIterators = this.ruleIterators.map(toJSON);

      if (this.ruleDates) {
        result.ruleDates = this.ruleDates.map(toJSON);
      }

      if (this.exDates) {
        result.exDates = this.exDates.map(toJSON);
      }

      result.ruleDateInc = this.ruleDateInc;
      result.exDateInc = this.exDateInc;
      result.last = this.last.toJSON();
      result.dtstart = this.dtstart.toJSON();
      result.complete = this.complete;

      return result;
    },


    _extractDates: function(component, property) {
      var result = [];
      var props = component.getAllProperties(property);
      var len = props.length;
      var i = 0;
      var prop;

      var idx;

      for (; i < len; i++) {
        props[i].getValues().forEach(function(prop) {
          idx = ICAL.helpers.binsearchInsert(
            result,
            prop,
            compareTime
          );

          // ordered insert
          result.splice(idx, 0, prop);
        });
      }

      return result;
    },

    _init: function(component) {
      this.ruleIterators = [];

      this.last = this.dtstart.clone();

      // to provide api consistency non-recurring
      // events can also use the iterator though it will
      // only return a single time.
      if (!isRecurringComponent(component)) {
        this.ruleDate = this.last.clone();
        this.complete = true;
        return;
      }

      if (component.hasProperty('rdate')) {
        this.ruleDates = this._extractDates(component, 'rdate');

        // special hack for cases where first rdate is prior
        // to the start date. We only check for the first rdate.
        // This is mostly for google's crazy recurring date logic
        // (contacts birthdays).
        if ((this.ruleDates[0]) &&
            (this.ruleDates[0].compare(this.dtstart) < 0)) {

          this.ruleDateInc = 0;
          this.last = this.ruleDates[0].clone();
        } else {
          this.ruleDateInc = ICAL.helpers.binsearchInsert(
            this.ruleDates,
            this.last,
            compareTime
          );
        }

        this.ruleDate = this.ruleDates[this.ruleDateInc];
      }

      if (component.hasProperty('rrule')) {
        var rules = component.getAllProperties('rrule');
        var i = 0;
        var len = rules.length;

        var rule;
        var iter;

        for (; i < len; i++) {
          rule = rules[i].getFirstValue();
          iter = rule.iterator(this.dtstart);
          this.ruleIterators.push(iter);

          // increment to the next occurrence so future
          // calls to next return times beyond the initial iteration.
          // XXX: I find this suspicious might be a bug?
          iter.next();
        }
      }

      if (component.hasProperty('exdate')) {
        this.exDates = this._extractDates(component, 'exdate');
        // if we have a .last day we increment the index to beyond it.
        this.exDateInc = ICAL.helpers.binsearchInsert(
          this.exDates,
          this.last,
          compareTime
        );

        this.exDate = this.exDates[this.exDateInc];
      }
    },

    _nextExDay: function() {
      this.exDate = this.exDates[++this.exDateInc];
    },

    _nextRuleDay: function() {
      this.ruleDate = this.ruleDates[++this.ruleDateInc];
    },

    /**
     * Find and return the recurrence rule with the most
     * recent event and return it.
     *
     * @return {Object} iterator.
     */
    _nextRecurrenceIter: function() {
      var iters = this.ruleIterators;

      if (iters.length === 0) {
        return null;
      }

      var len = iters.length;
      var iter;
      var iterTime;
      var iterIdx = 0;
      var chosenIter;

      // loop through each iterator
      for (; iterIdx < len; iterIdx++) {
        iter = iters[iterIdx];
        iterTime = iter.last;

        // if iteration is complete
        // then we must exclude it from
        // the search and remove it.
        if (iter.completed) {
          len--;
          if (iterIdx !== 0) {
            iterIdx--;
          }
          iters.splice(iterIdx, 1);
          continue;
        }

        // find the most recent possible choice
        if (!chosenIter || chosenIter.last.compare(iterTime) > 0) {
          // that iterator is saved
          chosenIter = iter;
        }
      }

      // the chosen iterator is returned but not mutated
      // this iterator contains the most recent event.
      return chosenIter;
    }

  };

  return RecurExpansion;

}());
ICAL.Event = (function() {

  function compareRangeException(a, b) {
    if (a[0] > b[0]) return 1;
    if (b[0] > a[0]) return -1;
    return 0;
  }

  function Event(component, options) {
    if (!(component instanceof ICAL.Component)) {
      options = component;
      component = null;
    }

    if (component) {
      this.component = component;
    } else {
      this.component = new ICAL.Component('vevent');
    }

    this._rangeExceptionCache = Object.create(null);
    this.exceptions = Object.create(null);
    this.rangeExceptions = [];

    if (options && options.strictExceptions) {
      this.strictExceptions = options.strictExceptions;
    }

    if (options && options.exceptions) {
      options.exceptions.forEach(this.relateException, this);
    }
  }

  Event.prototype = {

    THISANDFUTURE: 'THISANDFUTURE',

    /**
     * List of related event exceptions.
     *
     * @type Array[ICAL.Event]
     */
    exceptions: null,

    /**
     * When true will verify exceptions are related by their UUID.
     *
     * @type {Boolean}
     */
    strictExceptions: false,

    /**
     * Relates a given event exception to this object.
     * If the given component does not share the UID of
     * this event it cannot be related and will throw an
     * exception.
     *
     * If this component is an exception it cannot have other
     * exceptions related to it.
     *
     * @param {ICAL.Component|ICAL.Event} obj component or event.
     */
    relateException: function(obj) {
      if (this.isRecurrenceException()) {
        throw new Error('cannot relate exception to exceptions');
      }

      if (obj instanceof ICAL.Component) {
        obj = new ICAL.Event(obj);
      }

      if (this.strictExceptions && obj.uid !== this.uid) {
        throw new Error('attempted to relate unrelated exception');
      }

      var id = obj.recurrenceId.toString();

      // we don't sort or manage exceptions directly
      // here the recurrence expander handles that.
      this.exceptions[id] = obj;

      // index RANGE=THISANDFUTURE exceptions so we can
      // look them up later in getOccurrenceDetails.
      if (obj.modifiesFuture()) {
        var item = [
          obj.recurrenceId.toUnixTime(), id
        ];

        // we keep them sorted so we can find the nearest
        // value later on...
        var idx = ICAL.helpers.binsearchInsert(
          this.rangeExceptions,
          item,
          compareRangeException
        );

        this.rangeExceptions.splice(idx, 0, item);
      }
    },

    /**
     * If this record is an exception and has the RANGE=THISANDFUTURE value.
     *
     * @return {Boolean} true when is exception with range.
     */
    modifiesFuture: function() {
      var range = this.component.getFirstPropertyValue('range');
      return range === this.THISANDFUTURE;
    },

    /**
     * Finds the range exception nearest to the given date.
     *
     * @param {ICAL.Time} time usually an occurrence time of an event.
     * @return {ICAL.Event|Null} the related event/exception or null.
     */
    findRangeException: function(time) {
      if (!this.rangeExceptions.length) {
        return null;
      }

      var utc = time.toUnixTime();
      var idx = ICAL.helpers.binsearchInsert(
        this.rangeExceptions,
        [utc],
        compareRangeException
      );

      idx -= 1;

      // occurs before
      if (idx < 0) {
        return null;
      }

      var rangeItem = this.rangeExceptions[idx];

      // sanity check
      if (utc < rangeItem[0]) {
        return null;
      }

      return rangeItem[1];
    },

    /**
     * Returns the occurrence details based on its start time.
     * If the occurrence has an exception will return the details
     * for that exception.
     *
     * NOTE: this method is intend to be used in conjunction
     *       with the #iterator method.
     *
     * @param {ICAL.Time} occurrence time occurrence.
     */
    getOccurrenceDetails: function(occurrence) {
      var id = occurrence.toString();
      var utcId = occurrence.convertToZone(ICAL.Timezone.utcTimezone).toString();
      var result = {
        //XXX: Clone?
        recurrenceId: occurrence
      };

      if (id in this.exceptions) {
        var item = result.item = this.exceptions[id];
        result.startDate = item.startDate;
        result.endDate = item.endDate;
        result.item = item;
      } else if (utcId in this.exceptions) {
        var item = this.exceptions[utcId];
        result.startDate = item.startDate;
        result.endDate = item.endDate;
        result.item = item;
      } else {
        // range exceptions (RANGE=THISANDFUTURE) have a
        // lower priority then direct exceptions but
        // must be accounted for first. Their item is
        // always the first exception with the range prop.
        var rangeExceptionId = this.findRangeException(
          occurrence
        );

        if (rangeExceptionId) {
          var exception = this.exceptions[rangeExceptionId];

          // range exception must modify standard time
          // by the difference (if any) in start/end times.
          result.item = exception;

          var startDiff = this._rangeExceptionCache[rangeExceptionId];

          if (!startDiff) {
            var original = exception.recurrenceId.clone();
            var newStart = exception.startDate.clone();

            // zones must be same otherwise subtract may be incorrect.
            original.zone = newStart.zone;
            var startDiff = newStart.subtractDate(original);

            this._rangeExceptionCache[rangeExceptionId] = startDiff;
          }

          var start = occurrence.clone();
          start.zone = exception.startDate.zone;
          start.addDuration(startDiff);

          var end = start.clone();
          end.addDuration(exception.duration);

          result.startDate = start;
          result.endDate = end;
        } else {
          // no range exception standard expansion
          var end = occurrence.clone();
          end.addDuration(this.duration);

          result.endDate = end;
          result.startDate = occurrence;
          result.item = this;
        }
      }

      return result;
    },

    /**
     * Builds a recur expansion instance for a specific
     * point in time (defaults to startDate).
     *
     * @return {ICAL.RecurExpansion} expander object.
     */
    iterator: function(startTime) {
      return new ICAL.RecurExpansion({
        component: this.component,
        dtstart: startTime || this.startDate
      });
    },

    isRecurring: function() {
      var comp = this.component;
      return comp.hasProperty('rrule') || comp.hasProperty('rdate');
    },

    isRecurrenceException: function() {
      return this.component.hasProperty('recurrence-id');
    },

    /**
     * Returns the types of recurrences this event may have.
     *
     * Returned as an object with the following possible keys:
     *
     *    - YEARLY
     *    - MONTHLY
     *    - WEEKLY
     *    - DAILY
     *    - MINUTELY
     *    - SECONDLY
     *
     * @return {Object} object of recurrence flags.
     */
    getRecurrenceTypes: function() {
      var rules = this.component.getAllProperties('rrule');
      var i = 0;
      var len = rules.length;
      var result = Object.create(null);

      for (; i < len; i++) {
        var value = rules[i].getFirstValue();
        result[value.freq] = true;
      }

      return result;
    },

    getRecurrenceRule: function() {
      let rules = this.component.getAllProperties('rrule');
      let i = 0;
      let len = rules.length;
      let result = Object.create(null);

      for (; i < len; i++) {
        let value = rules[i].getFirstValue();
        result.freq = value.freq;
        result.interval = value.interval;
      }

      return result;
    },

    get uid() {
      return this._firstProp('uid');
    },

    set uid(value) {
      this._setProp('uid', value);
    },

    get startDate() {
      return this._firstProp('dtstart');
    },

    set startDate(value) {
      this._setTime('dtstart', value);
    },

    get endDate() {
      return this._firstProp('dtend');
    },

    set endDate(value) {
      this._setTime('dtend', value);
    },

    get duration() {
      return this.endDate.subtractDate(this.startDate);
    },

    get location() {
      return this._firstProp('location');
    },

    set location(value) {
      return this._setProp('location', value);
    },

    get attendees() {
      //XXX: This is way lame we should have a better
      //     data structure for this later.
      return this.component.getAllProperties('attendee');
    },

    get summary() {
      return this._firstProp('summary');
    },

    set summary(value) {
      this._setProp('summary', value);
    },

    get rrule() {
      return this._firstProp('rrule');
    },

    set rrule(value) {
      this._setProp('rrule', value);
    },

    get description() {
      return this._firstProp('description');
    },

    set description(value) {
      this._setProp('description', value);
    },

    get organizer() {
      return this._firstProp('organizer');
    },

    set organizer(value) {
      this._setProp('organizer', value);
    },

    get sequence() {
      return this._firstProp('sequence');
    },

    set sequence(value) {
      this._setProp('sequence', value);
    },

    get recurrenceId() {
      return this._firstProp('recurrence-id');
    },

    set recurrenceId(value) {
      this._setProp('recurrence-id', value);
    },

    /**
     * set/update a time property's value.
     * This will also update the TZID of the property.
     *
     * TODO: this method handles the case where we are switching
     * from a known timezone to an implied timezone (one without TZID).
     * This does _not_ handle the case of moving between a known
     *  (by TimezoneService) timezone to an unknown timezone...
     *
     * We will not add/remove/update the VTIMEZONE subcomponents
     *  leading to invalid ICAL data...
     */
    _setTime: function(propName, time) {
      var prop = this.component.getFirstProperty(propName);

      if (!prop) {
        prop = new ICAL.Property(propName);
        this.component.addProperty(prop);
      }

      // utc and local don't get a tzid
      if (
        time.zone === ICAL.Timezone.localTimezone ||
        time.zone === ICAL.Timezone.utcTimezone
      ) {
        // remove the tzid
        prop.removeParameter('tzid');
      } else {
        prop.setParameter('tzid', time.zone.tzid);
      }

      prop.setValue(time);
    },

    _setProp: function(name, value) {
      this.component.updatePropertyWithValue(name, value);
    },

    _firstProp: function(name) {
      return this.component.getFirstPropertyValue(name);
    },

    toString: function() {
      return this.component.toString();
    }

  };

  return Event;

}());
ICAL.ComponentParser = (function() {

  /**
   * Component parser initializer.
   *
   * Usage:
   *
   *    var options = {
   *      // when false no events will be emitted for type
   *      parseEvent: true,
   *      parseTimezone: true
   *    };
   *
   *    var parser = new ICAL.ComponentParser(options);
   *
   *    parser.onevent() {
   *      //...
   *    }
   *
   *    // ontimezone, etc...
   *
   *    parser.oncomplete = function() {
   *
   *    };
   *
   *    parser.process(string | component);
   *
   *
   * @param {Object} options component parser options.
   */
  function ComponentParser(options) {
    if (typeof(options) === 'undefined') {
      options = {};
    }

    var key;
    for (key in options) {
      if (options.hasOwnProperty(key)) {
        this[key] = options[key];
      }
    }
  }

  ComponentParser.prototype = {

    /**
     * When true parse events
     *
     * @type Boolean
     */
    parseEvent: true,

    /**
     * when true parse timezones
     *
     * @type Boolean
     */
    parseTimezone: true,


    /* SAX like events here for reference */

    /**
     * Fired when parsing is complete
     */
    oncomplete: function() {},

    /**
     * Fired if an error occurs during parsing.
     *
     * @param {Error} err details of error.
     */
    onerror: function(err) {},

    /**
     * Fired when a top level component (vtimezone) is found
     *
     * @param {ICAL.Timezone} timezone object.
     */
    ontimezone: function(component) {},

    /*
     * Fired when a top level component (VEVENT) is found.
     * @param {ICAL.Event} component top level component.
     */
    onevent: function(component) {},

    /**
     * Process a string or parse ical object.
     * This function itself will return nothing but
     * will start the parsing process.
     *
     * Events must be registered prior to calling this method.
     *
     * @param {String|Object} ical string or parsed ical object.
     */
    process: function(ical) {
      //TODO: this is sync now in the future we will have a incremental parser.
      if (typeof(ical) === 'string') {
        ical = ICAL.parse(ical)[1];
      }

      if (!(ical instanceof ICAL.Component)) {
        ical = new ICAL.Component(ical);
      }

      var components = ical.getAllSubcomponents();
      var i = 0;
      var len = components.length;
      var component;

      for (; i < len; i++) {
        component = components[i];

        switch (component.name) {
          case 'vtimezone':
            if (this.parseTimezone) {
              var tzid = component.getFirstPropertyValue('tzid');
              if (tzid) {
                this.ontimezone(new ICAL.Timezone({
                  tzid: tzid,
                  component: component
                }));
              }
            }
            break;
          case 'vevent':
            if (this.parseEvent) {
              this.onevent(new ICAL.Event(component));
            }
            break;
          default:
            continue;
        }
      }

      //XXX: ideally we should do a "nextTick" here
      //     so in all cases this is actually async.
      this.oncomplete();
    }
  };

  return ComponentParser;

}());

define("ext/ical", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.ICAL;
    };
}(this)));

define('models/event',['require','exports','module','calc','probably_parse_int','provider/caldav_pull_events','ext/ical'],function(require, exports, module) {


var Calc = require('calc');
var probablyParseInt = require('probably_parse_int');
var CaldavPullEvents = require('provider/caldav_pull_events');
var ICAL = require('ext/ical');

/**
 * Creates a wrapper around a event instance from the db
 */
function Event(data) {
  var isNew = false;

  if (typeof(data) === 'undefined') {
    isNew = true;
    data = Object.create(null);
    data.remote = {};
  }

  this.data = data;
  /** shortcut */
  var remote = this.remote = this.data.remote;

  if ('start' in remote && !('startDate' in remote)) {
    remote.startDate = Calc.dateFromTransport(
      remote.start
    );
  }

  if ('end' in remote && !('endDate' in remote)) {
    remote.endDate = Calc.dateFromTransport(
      remote.end
    );
  }

  if (isNew) {
    this.resetToDefaults();
  }

  var start = this.remote.startDate;
  var end = this.remote.endDate;

  // the typeof check is to see if we have already
  // set the value in resetToDefaults (or prior)
  if (
      typeof(this._isAllDay) === 'undefined' &&
      Calc.isOnlyDate(start) &&
      Calc.isOnlyDate(end)
  ) {
    // mostly to handle the case before the time
    // where we actually managed isAllDay as a setter.
    this.isAllDay = true;
  } else {
    // not on prototype intentionally because
    // we need to either need to resetToDefaults
    // or check startDate/endDate in the constructor.
    this.isAllDay = false;
  }
}
module.exports = Event;

Event.prototype = {

  /**
   * Sets default values of an event.
   */
  resetToDefaults: function() {
    var now = new Date();

    this.isAllDay = false;

    this.startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    this.endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
  },

  get _id() {
    return this.data._id;
  },

  _setDate: function(date, field) {
    if (!(date instanceof Date)) {
      throw new TypeError('must pass instance of Date');
    }

    var allDay = this.isAllDay;

    if (allDay) {
      // clone the existing date
      date = new Date(date.valueOf());

      // filter out the stuff we don't care about
      date.setHours(0);
      date.setMinutes(0);
      date.setSeconds(0);
      date.setMilliseconds(0);
    }

    this.remote[field] = Calc.dateToTransport(
      date,
      null, // TODO allow setting tzid
      allDay
    );

    this.remote[field + 'Date'] = date;
  },

  /* start date */

  get startDate() {
    return this.remote.startDate;
  },

  set startDate(value) {
    this._setDate(value, 'start');
  },

  /* end date */

  get endDate() {
    return this.remote.endDate;
  },

  set endDate(value) {
    this._setDate(value, 'end');
  },

  set isAllDay(value) {
    this._isAllDay = value;

    // send values through the their setter.
    if (this.endDate) {
      this.endDate = this.endDate;
    }

    if (this.startDate) {
      this.startDate = this.startDate;
    }
  },

  get isAllDay() {
    return this._isAllDay;
  },

  /* associated records */

  get calendarId() {
    return this.data.calendarId;
  },

  set calendarId(value) {
    if (value && typeof(value) !== 'number') {
      value = probablyParseInt(value);
    }

    this.data.calendarId = value;
  },

  /* simple setters */

  get syncToken() {
    return this.remote.syncToken;
  },

  set syncToken(value) {
    this.remote.syncToken = value;
  },

  get title() {
    return this.remote.title || '';
  },

  set title(value) {
    this.remote.title = value;
  },

  get description() {
    return this.remote.description || '';
  },

  set description(value) {
    this.remote.description = value;
  },

  get location() {
    return this.remote.location || '';
  },

  set location(value) {
    this.remote.location = value;
    return this.remote.location;
  },

  get repeat() {
    return this.remote.repeat || '';
  },

  set repeat(value) {
    this.remote.repeat = value;
    return this.remote.repeat;
  },

  get isRecurring() {
    return this.remote.isRecurring || false;
  },

  set isRecurring(value) {
    this.remote.isRecurring = value;
    return this.remote.isRecurring;
  },

  get recurrenceId() {
    return this.remote.recurrenceId || '';
  },

  set recurrenceId(value) {
    this.remote.recurrenceId = value;
    return this.remote.recurrenceId;
  },

  get alarms() {
    return this.remote.alarms || [];
  },

  set alarms(value) {
    this.remote.alarms = value;
    return this.remote.alarms;
  },

  get tone() {
    return this.remote.tone;
  },

  set tone(value) {
    this.remote.tone = value;
  },

  get timeStamp() {
    return this.remote.timeStamp || '';
  },

  set timeStamp(value) {
    this.remote.timeStamp = value;
  },
  /**
   * If data doesn't have any errors, the event
   * takes on the attributes of data.
   *
   * @param {Object} data, object that contains
   *  at least some attributes of the event object.
   *
   * @return {Object} errors if validationErrors returns erros,
   *  true otherwise.
   */
  updateAttributes: function(data) {
    var errors = this.validationErrors(data);
    if (errors) {
      return errors;
    }
    for (var field in data) {
      this[field] = data[field];
    }
    return true;
  },

  /**
   * Validates the contents of the model.
   *
   * Output example:
   *
   *   [
   *     {
   *       name: 'invalidDate',
   *       properties: ['startDate', 'endDate']
   *     }
   *     //...
   *   ]
   *
   * @param {Object} data, optional object that contains
   *  at least some attributes of the event object.
   * @return {Array|False} see above.
   */
  validationErrors: function(data) {
    var obj = data || this;
    var end = obj.endDate.valueOf();
    var start = obj.startDate.valueOf();
    var errors = [];

    if (start >= end) {
      errors.push({
        name: 'start-after-end'
      });
    }

    if (errors.length) {
      return errors;
    }

    return false;
  }
};

});

/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {
              tree._listeners.warned = true;
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || !!this._all;
    }
    else {
      return !!this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {
          this._events[type].warned = true;
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define('ext/eventemitter2',[],function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

/**
 * Binary search utilities taken /w permission from :asuth
 */
define('binsearch',['require','exports','module'],function(require, exports) {


exports.find = function(list, seekVal, cmpfunc, aLow, aHigh) {
  var low = ((aLow === undefined) ? 0 : aLow),
      high = ((aHigh === undefined) ? (list.length - 1) : aHigh),
      mid, cmpval;

  while (low <= high) {
    mid = low + Math.floor((high - low) / 2);
    cmpval = cmpfunc(seekVal, list[mid]);
    if (cmpval < 0) {
      high = mid - 1;
    } else if (cmpval > 0) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  return null;
};

exports.insert = function(list, seekVal, cmpfunc) {
  if (!list.length) {
    return 0;
  }

  var low = 0, high = list.length - 1,
      mid, cmpval;

  while (low <= high) {
    mid = low + Math.floor((high - low) / 2);
    cmpval = cmpfunc(seekVal, list[mid]);

    if (cmpval < 0) {
      high = mid - 1;
    } else if (cmpval > 0) {
      low = mid + 1;
    } else {
      break;
    }
  }

  if (cmpval < 0) {
    return mid; // insertion is displacing, so use mid outright.
  } else if (cmpval > 0) {
    return mid + 1;
  } else {
    return mid;
  }
};

});

define('compare',['require','exports','module'],function(require, exports, module) {


module.exports = function(a, b) {
  if (a > b) {
    return 1;
  }

  if (a < b) {
    return -1;
  }

  return 0;
};

});

// these methods are all borrowed from MOUT.js (released under MIT license)
define('utils/mout',['require','exports','module'],function(require, exports) {


// TODO: add MOUT.js as a dependency!!!! this is just a temporary solution

exports.norm = function norm(val, min, max){
  // 0 / 0 === NaN
  if (val === min && min === max) {
    return 1;
  }
  return (val - min) / (max - min);
};

exports.clamp = function clamp(val, min, max) {
  return val < min ? min : (val > max ? max : val);
};

exports.round = function round(value, radix){
  radix = radix || 1; // default round 1
  return Math.round(value / radix) * radix;
};

exports.floor = function floor(val, step) {
  step = Math.abs(step || 1);
  return Math.floor(val / step) * step;
};

exports.ceil = function ceil(val, step) {
  step = Math.abs(step || 1);
  return Math.ceil(val / step) * step;
};

exports.lerp = function lerp(ratio, start, end){
  return start + (end - start) * ratio;
};

exports.debounce = function debounce(fn, threshold, isAsap){
  var timeout, result;
  function debounced(){
    //jshint -W040
    var args = arguments, context = this;
    //jshint +W040
    function delayed(){
      if (! isAsap) {
        result = fn.apply(context, args);
      }
      timeout = null;
    }
    if (timeout) {
      clearTimeout(timeout);
    } else if (isAsap) {
      result = fn.apply(context, args);
    }
    timeout = setTimeout(delayed, threshold);
    return result;
  }
  debounced.cancel = function(){
    clearTimeout(timeout);
  };
  return debounced;
};

exports.throttle = function throttle(fn, delay) {
  var context, timeout, result, args,
    diff,
    prevCall = 0;
  function delayed() {
    prevCall = Date.now();
    timeout = null;
    result = fn.apply(context, args);
  }
  function throttled() {
    //jshint -W040
    context = this;
    //jshint +W040
    args = arguments;
    diff = delay - (Date.now() - prevCall);
    if (diff <= 0) {
      clearTimeout(timeout);
      delayed();
    } else if (!timeout) {
      timeout = setTimeout(delayed, diff);
    }
    return result;
  }
  throttled.cancel = function() {
    clearTimeout(timeout);
  };
  return throttled;
};

});

define('day_observer',['require','exports','module','calc','ext/eventemitter2','binsearch','compare','utils/mout','notification'],function(require, exports) {


// Listen for changes on all busytimes inside a given day
// ---
// This module will listen for changes on any busytime inside a day and
// group/batch multiple add/remove events into a single emit call; making it
// easier to rerender all the busytimes at once and allowing us to use the
// same method to add/remove busytimes from the DOM, drastically simplifying
// the logic required.
// ---
// On the most common scenario there should not be that many busytimes inside
// the same day, and every time we add a new busytime to the DOM we need to
// check for "overlaps", so doing the full rerender will make a lot of sense
// and should not affect performance that much.
// ---
// It's way simpler to use a day-based logic for the whole calendar front-end,
// instead of knowing how to handle months/weeks.

var Calc = require('calc');
var EventEmitter2 = require('ext/eventemitter2');
var binsearch = require('binsearch');
var compare = require('compare');
var daysBetween = Calc.daysBetween;
var debounce = require('utils/mout').debounce;
var getDayId = Calc.getDayId;
var isAllDay = Calc.isAllDay;
var spanOfMonth = Calc.spanOfMonth;
var notification = require('notification');

// make sure we only trigger a single emit for multiple consecutive changes
/*It is modified to 300 to ensure that the number of asynchronous
  and synchronous events is the same after adding events,
  so as to solve the problem of number flash
 */
var DISPATCH_DELAY = 300;

// maximum amount of months to keep in the cache
var MAX_CACHED_MONTHS = 5;

// stores busytimes by Id
// {key:id, value:Busytime}
var busytimes = new Map();

// stores events by Id
// {key:id, value:Event}
var events = new Map();

// relationships between event Ids and busytimes Ids
// {key:eventId, value:Array<busytimeId>}
var eventsToBusytimes = new Map();

// cache a reference to all busytime+event data for the days based on the dayId
// {key:dayId, value:DayRecords}
var cache = new Map();

// stores the days IDs that changed since last dispatch
var dayQueue = new Set();

// stores the timespans for all the cached months
var cachedSpans = [];

// we lock the cache pruning during sync
var cacheLocked = false;

// emitter exposed because of unit tests
var emitter = exports.emitter = new EventEmitter2();

// TODO: convert these dependencies into static modules to avoid ugly injection
// injected later to avoid circular dependencies
exports.busytimeStore = null;
exports.calendarStore = null;
exports.eventStore = null;
exports.syncController = null;
exports.timeController = null;

exports.init = function() {
  // both "change" and "add" operations triggers a "persist" event
  this.eventStore.on('persist', (id, event) => cacheEvent(event));
  this.eventStore.on('remove', removeEventById);

  this.busytimeStore.on('persist', (id, busy) => cacheBusytime(busy));
  this.busytimeStore.on('remove', removeBusytimeById);

  this.syncController.on('syncStart', () => {
    cacheLocked = true;
    Toaster.showToast({
      messageL10nId: 'kai-sync-progress-syncing',
      latency: 2000
    });
  });
  this.syncController.on('syncComplete', (syncInfo) => {
    cacheLocked = false;
    pruneCache();
    dispatch();

    if (!syncInfo.syncSwitch) {
      Toaster.showToast({
        messageL10nId: 'kai-sync-sync-switch-close',
      });
    } else if (!syncInfo.isSyncErr) {
      Toaster.showToast({
        messageL10nId: 'kai-sync-progress-complete',
        latency: 3000
      });
    }
  });

  this.calendarStore.on('calendarVisibilityChange', (id, calendar) => {
    var type = calendar.localDisplayed ? 'add' : 'remove';
    busytimes.forEach((busy, busyId) => {
      if (busy.calendarId === id) {
        registerBusytimeChange(busyId, type);
      }
    });
  });

  this.timeController.on('monthChange', loadMonth);

  // make sure loadMonth is called during setup if 'monthChange' was dispatched
  // before we added the listener
  var month = this.timeController.month;
  if (month) {
    loadMonth(month);
  }
};

exports.on = function(date, callback) {
  var dayId = getDayId(date);
  // important to trigger the callback to avoid getting into weird states when
  // busytimes are loaded while views are not listening for changes
  callback(getDay(dayId, date));
  emitter.on(dayId, callback);
};

exports.getDayEvents = function(date) {
  let dayId = getDayId(date);
  return getDay(dayId, date);
}

function getDay(dayId, date) {
  if (cache.has(dayId)) {
    return cache.get(dayId);
  }

  var day = {
    dayId: dayId,
    date: date,
    amount: 0,
    basic: [],
    allday: []
  };
  cache.set(dayId, day);

  return day;
}

exports.off = function(date, callback) {
  emitter.off(getDayId(date), callback);
};

exports.removeAllListeners = function() {
  emitter.removeAllListeners();
};

exports.getEventsToBusytimes = function(){
  return eventsToBusytimes;
};

// findAssociated is not on the Event/Busytime store so that it can get the
// cache data and show the event details faster on the most common cases
exports.findAssociated = function(busytimeId) {
  return queryBusytime(busytimeId).then(busytime => {
    return queryEvent(busytime.eventId).then(event => {
      return {
        busytime: busytime,
        event: event
      };
    });
  });
};

exports.loadMonthForNofication = function(month) {
  return new Promise((resolve) => {
    loadMonth(month, resolve);
  });
};

function queryBusytime(busytimeId) {
  if (busytimes.has(busytimeId)) {
    return Promise.resolve(busytimes.get(busytimeId));
  }
  return exports.busytimeStore.get(busytimeId);
}

function queryEvent(eventId) {
  if (events.has(eventId)) {
    return Promise.resolve(events.get(eventId));
  }
  return exports.eventStore.get(eventId);
}

function cacheBusytime(busy) {
  var {_id, startDate, endDate, eventId} = busy;

  if (outsideSpans(startDate) && outsideSpans(endDate) &&
    !busytimeOverlapSpans(busy)) {
    // ignore busytimes outside the cached spans
    return;
  }

  busytimes.set(_id, busy);
  eventsToBusytimes.get(eventId).push(_id);
  registerBusytimeChange(_id);
}

function removeBusytimeById(id) {
  var busy = busytimes.get(id);
  if (!busy) {
    // when removing all the data from the calendar the busytime might not be
    // on the cache but still emit a "remove" event
    return;
  }

  var url = '/alarm-display/' + id;
  notification.closeNotifications(url);

  var eventId = busy.eventId;
  var ids = eventsToBusytimes.get(eventId).filter(i => i !== id);
  eventsToBusytimes.set(eventId, ids);
  removeEventIfNoBusytimes(ids, eventId);

  registerBusytimeChange(id, 'remove');
  busytimes.delete(id);
}

function cacheEvent(event) {
  var id = event._id;
  events.set(id, event);
  if (!eventsToBusytimes.has(id)) {
    eventsToBusytimes.set(id, []);
  }
}

function removeEventById(id) {
  events.delete(id);
  // busytimeStore will emit a 'remove' event for each busytime, so no need to
  // handle it here; we simply remove the "join table"
  eventsToBusytimes.delete(id);
}

// every time an event/calendar/busytime changes we need to trigger a change
// event and notify all the views that are listening to that specific date
function registerBusytimeChange(id, type) {
  var busy = busytimes.get(id);
  var {startDate, endDate} = busy;

  // subtract 1 millisecond because allday events ends at 00:00:00 of next day,
  // which would include one day more than expected for daysBetween
  var end = new Date(endDate.getTime() - 1);

  // events from hidden calendars should not be displayed
  var isRemove = type === 'remove' ||
    !exports.calendarStore.shouldDisplayCalendar(busy.calendarId);

  daysBetween(startDate, end).forEach(date => {
    var dayId = getDayId(date);

    if (isRemove && !cache.has(dayId)) {
      return;
    }

    var day = getDay(dayId, date);

    // it should always override the old data
    day.basic = day.basic.filter(r => r.busytime._id !== id);
    day.allday = day.allday.filter(r => r.busytime._id !== id);

    if (!isRemove) {
      var group = isAllDay(date, startDate, endDate) ?
        day.allday :
        day.basic;
      sortedInsert(group, busy);
    }

    day.amount = day.basic.length + day.allday.length;

    dayQueue.add(dayId);
  });

  dispatch();
}

function sortedInsert(group, busy) {
  var index = binsearch.insert(group, busy.startDate, (date, record) => {
    return compare(date, record.busytime.startDate);
  });
  var event = events.get(busy.eventId);
  group.splice(index, 0, {
    event: event,
    busytime: busy,
    color: exports.calendarStore.getColorByCalendarId(event.calendarId)
  });
}

// debounce will make sure that we only trigger one "change" event per day even
// if we have multiple changes happening in a row
var dispatch = debounce(function() {
  dayQueue.forEach(id => {
    // need to remove ID from queue before dispatching event to avoid race
    // conditions (eg. handler triggering a new queue+dispatch)
    dayQueue.delete(id);
    // dispatch is async so there is a small chance data isn't cached anymore
    if (cache.has(id)) {
      emitter.emit(id, cache.get(id));
    }
  });
}, DISPATCH_DELAY);

function loadMonth(newMonth, resolve) {
  var span = spanOfMonth(newMonth);

  // ensure we load the minimum amount of busytimes possible
  var toLoad = span;
  cachedSpans.every(cached => toLoad = cached.trimOverlap(toLoad));

  if (!toLoad) {
    // already loaded all the busytimes
    if (resolve && typeof(resolve) === 'function') {
      resolve();
    }
    return;
  }

  // cache the whole month instead of `toLoad` because we purge whole months
  cachedSpans.push(span);

  exports.busytimeStore.loadSpan(toLoad, onBusytimeSpanLoad, resolve);
}

function onBusytimeSpanLoad(err, busytimes, resolve) {
  if (err) {
    console.error('Error loading Busytimes from TimeSpan:', err.toString());
    return;
  }

  // remove duplicates and avoid loading events that are already cached
  var eventIds = Array.from(new Set(
    busytimes.map(b => b.eventId).filter(id => !events.has(id))
  ));

  exports.eventStore.findByIds(eventIds).then(events => {
    // it's very important to cache the events before the busytimes otherwise
    // the records won't contain the event data
    Object.keys(events).forEach(key => cacheEvent(events[key]));
    busytimes.forEach(cacheBusytime);

    pruneCache();

    if (resolve && typeof(resolve) === 'function') {
      resolve();
    }
  });
}

function pruneCache() {
  if (cacheLocked) {
    return;
  }

  trimCachedSpans();
  cache.forEach(removeDayFromCacheIfOutsideSpans);
  eventsToBusytimes.forEach(removeEventIfNoBusytimes);
}

function trimCachedSpans() {
  while (cachedSpans.length > MAX_CACHED_MONTHS) {
    // since most changes are sequential, remove the timespans that are further
    // away from the current month
    var baseDate = exports.timeController.month;
    var maxDiff = 0;
    var maxDiffIndex = 0;
    cachedSpans.forEach((span, i) => {
      var diff = Math.abs(span.start - baseDate);
      if (diff > maxDiff) {
        maxDiff = diff;
        maxDiffIndex = i;
      }
    });
    cachedSpans.splice(maxDiffIndex, 1);
  }
}

function removeDayFromCacheIfOutsideSpans(day, id) {
  if (outsideSpans(day.date)) {
    day.basic.forEach((record) => {removeRecordIfOutsideSpans(record, day)});
    day.allday.forEach((record) => {removeRecordIfOutsideSpans(record, day)});
  }
}

function outsideSpans(date) {
  return !cachedSpans.some(timespan => timespan.contains(date));
}

function busytimeOverlapSpans(busytime) {
  if (!cachedSpans.length) {
    return false;
  }

  let startTime = cachedSpans[0].start;
  let endTime = cachedSpans[0].end;

  for (let i = 1; i < cachedSpans.length; i++) {
    if (startTime > cachedSpans[i].start) {
      startTime = cachedSpans[i].start;
    }
  }

  for (let i = 1; i < cachedSpans.length; i++) {
    if (endTime < cachedSpans[i].start) {
      endTime = cachedSpans[i].start;
    }
  }

  if (busytime.startDate < startTime && busytime.endDate > endTime) {
    return true;
  }

  return false;
}

function removeRecordIfOutsideSpans(record, day) {
  if (busytimeOverlapSpans(record.busytime)) {
    return;
  }
  removeBusytimeIfOutsideSpans(record.busytime);
  cache.delete(day.dayId);
}

function removeBusytimeIfOutsideSpans(busytime) {
  var {_id, startDate, endDate} = busytime;
  if (outsideSpans(startDate) && outsideSpans(endDate)) {
    removeBusytimeById(_id);
  }
}

function removeEventIfNoBusytimes(ids, eventId) {
  if (!ids.length) {
    removeEventById(eventId);
  }
}

});

define('provider/local',['require','exports','module','./abstract','event_mutations','ext/uuid','notification','calc','provider/caldav_pull_events','next_tick','models/event','day_observer'],function(require, exports, module) {


var Abstract = require('./abstract');
var mutations = require('event_mutations');
var uuid = require('ext/uuid');
var notification = require('notification');
var Calc = require('calc');
var CaldavPullEvents = require('provider/caldav_pull_events');
var nextTick = require('next_tick');
var Event = require('models/event');
var dayObserver = require('day_observer');

var LOCAL_CALENDAR_ID = 'local-first';

function Local() {
  Abstract.apply(this, arguments);

  // TODO: Get rid of this when app global is gone.
  mutations.app = this.app;
  this.service = this.app.serviceController;
  this.events = this.app.store('Event');
  this.busytimes = this.app.store('Busytime');
  this.alarms = this.app.store('Alarm');
}
module.exports = Local;

Local.calendarId = LOCAL_CALENDAR_ID;

/**
 * Returns the details for the default calendars.
 */
Local.defaultCalendar = function() {
  // XXX: Make async
  var l10nId = 'calendar-local';
  var name;

  if ('mozL10n' in window.navigator) {
    name = window.navigator.mozL10n.get(l10nId);
    if (name === l10nId) {
      name = null;
    }
  }

  if (!name) {
    name = 'Offline';
  }

  return {
    // XXX localize this name somewhere
    name: name,
    id: LOCAL_CALENDAR_ID,
    color: Local.prototype.defaultColor
  };

};

Local.prototype = {
  __proto__: Abstract.prototype,

  canExpandRecurringEvents: true,

  getAccount: function(account, callback) {
    callback(null, {});
  },

  findCalendars: function(account, callback) {
    var list = {};
    list[LOCAL_CALENDAR_ID] = Local.defaultCalendar();
    callback(null, list);
  },

  syncEvents: function(account, calendar, cb) {
    cb(null);
  },

  calTimeOffset: function() {
    var d = new Date();
    var offset = d.getTimezoneOffset();
    var from = '00' + (Math.abs(offset) / 60) + '00';
    from = from.slice(-4);

    if (offset <= 0) {
      from = '+' + from;
    } else {
      from = '-' + from;
    }

    return from;
  },

  jointIcal: function(event, endUtc) {
    var rule = '';
    switch (event.remote.repeat) {
      case 'every-day':
        rule = 'FREQ=DAILY;INTERVAL=1';
        break;
      case 'every-week':
        rule = 'FREQ=WEEKLY;INTERVAL=1';
        break;
      case 'every-2-weeks':
        rule = 'FREQ=WEEKLY;INTERVAL=2';
        break;
      case 'every-month':
        rule = 'FREQ=MONTHLY;INTERVAL=1';
        break;
      case 'every-year':
        rule = 'FREQ=YEARLY;INTERVAL=1';
        break;
    }
    var tzid = jstz.determine().name();
    var dtstart = new Date(event.remote.startDate).toString('yyyyMMddTHHmmss');
    var dtend = new Date(event.remote.endDate).toString('yyyyMMddTHHmmss');
    var dtstamp = new Date().toString('yyyyMMddTHHmmss');
    var offset = this.calTimeOffset();

    var ical = '';
    ical += 'BEGIN:VCALENDAR\r\n';
    ical += 'PRODID:-//H5OS//Calendar 1.0//EN\r\n';
    ical += 'VERSION:2.0\r\n';
    ical += 'CALSCALE:GREGORIAN\r\n';

    ical += 'BEGIN:VTIMEZONE\r\n';
    ical += 'TZID:' + tzid + '\r\n';
    ical += 'BEGIN:STANDARD\r\n';
    ical += 'TZOFFSETFROM:' + offset + '\r\n';
    ical += 'TZOFFSETTO:' + offset + '\r\n';
    ical += 'DTSTART;TZID=' + tzid + ':' + dtstart + '\r\n';
    ical += 'END:STANDARD\r\n';
    ical += 'END:VTIMEZONE\r\n';

    ical += 'BEGIN:VEVENT\r\n';
    ical += 'DTSTART;TZID=' + tzid + ':' + dtstart + '\r\n';
    ical += 'DTEND;TZID=' + tzid + ':' + dtend + '\r\n';
    ical += 'RRULE:' + rule + '\r\n';
    ical += 'DTSTAMP;TZID=' + tzid + ':' + dtstamp + '\r\n';
    ical += 'UID:' + event.remote.id + '\r\n';
    ical += 'DESCRIPTION:' + JSON.stringify(event.remote.description) + '\r\n';
    ical += 'LOCATION:' + event.remote.location + '\r\n';
    ical += 'SEQUENCE:1\r\n';
    ical += 'STATUS:CONFIRMED\r\n';
    ical += 'SUMMARY:' + event.remote.title + '\r\n';
    ical += 'TRANSP:TRANSPARENT\r\n';

    event.remote.alarms.forEach(function(alarm) {
      ical += 'BEGIN:VALARM\r\n';
      if (alarm.trigger < 0) {
        ical += 'TRIGGER:-PT' + (Math.abs(alarm.trigger) / 60) + 'M\r\n';
      } else {
        ical += 'TRIGGER:PT' + (Math.abs(alarm.trigger) / 60) + 'M\r\n';
      }
      ical += 'ACTION:' + alarm.action + '\r\n';
      ical += 'END:VALARM\r\n';
    });

    // This is entire. Please do not add parameters among them.
    // _getEndUtc: function(icalString)
    ical += 'endUtc:' + endUtc +'\r\n';
    ical += 'END:VEVENT\r\n';
    ical += 'END:VCALENDAR\r\n';

    return ical;
  },

  /**
   * @return {Calendar.EventMutations.Create} mutation object.
   */
  createEvent: function(event, busytime, callback, endUtc, expand) {
    // most providers come with their own built in
    // id system when creating a local event we need to generate
    // our own UUID.
    if (!event.remote.id) {
      // TOOD: uuid is provided by ext/uuid.js
      //       if/when platform supports a safe
      //       random number generator (values never conflict)
      //       we can use that instead of uuid.js
      event.remote.id = uuid();
    }

    var self = this;
    var create = mutations.create({ event: event });
    if (event.remote.isRecurring) {
      create.icalComponent = {
        calendarId: event.calendarId,
        eventId: event.calendarId + '-' + event.remote.id,
        lastRecurrenceId: {
          tzid: jstz.determine().name(),
          offset: event.remote.start.offset,
          utc: event.remote.start.utc,
          isDate: true,
        },
        ical: this.jointIcal(event, !endUtc ? 0 : endUtc),
        repeat: event.remote.repeat,
        preset: event.remote.preset
      };
      create.excludeBusy = true;
      event.endUtc = !endUtc ? 0 : endUtc;
    }

    create.commit((err) => {
      if (err) {
        return callback && callback(err);
      }

      if (callback) {
        callback(null, create.busytime, create.event);
      }

      if (!expand || expand !== 'noexpand') {
        self._expandRecuEvent(create.event);
      }
    });

    return create;
  },

  _expandRecuEvent: function(event) {
    if (event.remote.isRecurring) {
      nextTick(function() {
        if (event.calendarId === 'local-first') {
          mutations.app.recurringEventsController.queueExpand(
            mutations.app.timeController.position
          );
        } else {
          mutations.app.recurringEventsController.queueExpand(
            event.remote.startDate
          );
        }
      });
    }
  },

  deleteEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }
    this.app.store('Event').remove(event._id, callback);

    if (busytime) {
      this.app.store('Busytime').remove(busytime._id, function(err) {
        if (err) {
          return;
        }

        var url = '/alarm-display/' + busytime._id;
        notification.closeNotifications(url);
      });
    }
  },

  deleteEventFuture: function(event, busytime, callback, endUtc) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    // to update a recurring event
    // 1. delete the event
    // 2. create a new event
    this.deleteEvent(event, function(err) {
      if (err) {
        return callback(err);
      }

      // to erase it's original id, and then
      // apply it a new id in creation
      nextTick(function() {
        delete event._id;
        delete event.remote.id;
        this.createEvent(event, null, callback, endUtc);
      }.bind(this));
    }.bind(this));
  },

  deleteBusytime: function(busytimeId, callback) {
    this.app.store('Busytime').remove(busytimeId, callback);
  },

  /**
   * @return {Calendar.EventMutations.Update} mutation object.
   */
  updateEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    var update = mutations.update({ event: event });
    update.commit(function(err) {
      if (err) {
        return callback(err);
      }

      callback(null, update.busytime, update.event);
    });

    if (busytime) {
      var url = '/alarm-display/' + busytime._id;
      notification.closeNotifications(url);
    }

    return update;
  },

  compareEventdate: function(event) {
    let selectDate = new Date(this.app.timeController.selectedDay.valueOf() +
      event.remote.start.offset);
    let eventDate = new Date(event.remote.startDate.valueOf());
    if (selectDate.getUTCFullYear() === eventDate.getUTCFullYear() &&
      selectDate.getUTCMonth() === eventDate.getUTCMonth()&&
      selectDate.getUTCDate() === eventDate.getUTCDate()) {
      return true;
    }

    return false;
  },


  /**
   * To update a recurring event
   */
  updateEventAll: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    // to update a recurring event
    // 1. delete the event
    // 2. create a new event
    this.deleteEvent(event, busytime, function(err) {
      if (err) {
        return callback(err);
      }

      let tzOffset = new Date().getTimezoneOffset() * 60 * 1000;
      let startDate;
      let endDate;
      let offset;

      if (this.compareEventdate(event) && event.remote.repeat !== 'never') {
        if (event.remote.isAllDay) {
          startDate = new Date(busytime.start.utc + tzOffset);
        } else {
          startDate = new Date(busytime.start.utc);
        }

        if (event.remote.isAllDay && !busytime.isAllDay) {
          startDate.setHours(0, 0, 0, 0);
        } else {
          startDate.setUTCHours(event.remote.startDate.getUTCHours());
          startDate.setUTCMinutes(event.remote.startDate.getUTCMinutes());
          startDate.setUTCSeconds(event.remote.startDate.getUTCSeconds());
        }

        offset =
          event.remote.endDate.valueOf() - event.remote.startDate.valueOf();
        endDate = new Date(startDate.valueOf() + offset);
        event.remote.start.offset = busytime.start.offset;
        event.remote.end.offset = busytime.end.offset;
      } else {
        startDate = new Date(event.remote.startDate.valueOf());
        endDate = new Date(event.remote.endDate.valueOf());
      }

      event.remote.start.utc = startDate.valueOf() - tzOffset;
      event.remote.startDate = startDate;
      event.remote.end.utc = endDate.valueOf() - tzOffset;
      event.remote.endDate = endDate;

      // to erase it's original id, and then
      // apply it a new id in creation
      nextTick(function() {
        delete event._id;
        delete event.remote.id;
        this.createEvent(event, null, callback, event.endUtc);
      }.bind(this));
    }.bind(this));
  },

  updateEventFuture: function(event, busytime, callback, endRecuUtc) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    this.app.store('Event').get(busytime._id.slice(0,-37), (err, value) => {
      if(!err) {
        nextTick(function() {
          let now = new Date();
          let offset = now.getTimezoneOffset() * 60 * 1000;
          delete value._id;
          delete value.remote.id;
          this.createEvent(value, null, callback, endRecuUtc - offset);
        }.bind(this));
      }
    });

    // to update a recurring event
    // 1. delete the event
    // 2. create a new event
    this.deleteEvent(event, function(err) {
      if (err) {
        return callback(err);
      }

      // to erase it's original id, and then
      // apply it a new id in creation
      nextTick(function() {
        delete event._id;
        delete event.remote.id;
        this.createEvent(event, callback, null, event.endUtc);
      }.bind(this));
    }.bind(this));
  },

  ensureRecurrencesExpanded: function(date, callback) {
    var self = this;
    var icalComponents = this.app.store('IcalComponent');
    icalComponents.findRecurrencesBefore(date, function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      if (!results.length) {
        callback(null, false);
        return;
      }

      // CaldavPullRequest is based on a calendar/account combination
      // so we must group all of the outstanding components into
      // their calendars before we can begin expanding them.
      var groups = Object.create(null);
      results.forEach(function(comp) {
        var calendarId = comp.calendarId;
        if (!(calendarId in groups)) {
          groups[calendarId] = [];
        }

        groups[calendarId].push(comp);
      });

      var pullGroups = [];
      var pending = 0;
      var options = {
        maxDate: Calc.dateToTransport(date),
        local: true
      };

      function next(err, pull) {
        if (!err && pull) {
          pullGroups.push(pull);
        }
        if (!(--pending)) {
          var trans = self.app.db.transaction(
            ['icalComponents', 'alarms', 'busytimes'],
            'readwrite'
          );

          trans.oncomplete = function() {
            callback(null, false);
          };

          trans.onerror = function(event) {
            callback(event.result.error.name);
          };

          pullGroups.forEach(function(pull) {
            pull.commit(trans);
          });
        }
      }

      let completeFlag = false;
      for (var calendarId in groups) {
        for (let i = 0; i < groups[calendarId].length; i++) {
          let groupArray = [];
          let endRecuUtc =
            parseInt(self._getEndUtc(groups[calendarId][i].ical));
          groupArray.push(groups[calendarId][i]);
          pending++;
          if (endRecuUtc &&
            endRecuUtc <= groups[calendarId][i].lastRecurrenceId.utc) {
            completeFlag = true;
            next();
            continue;
          }
          completeFlag = false;

          if (endRecuUtc && endRecuUtc < options.maxDate.utc) {
            var newOptions = {
              maxDate: Calc.dateToTransport(date),
              local: true
            };
            newOptions.maxDate.utc = endRecuUtc;

            self._expandComponents(
              calendarId,
              groupArray,
              newOptions,
              next
            );
          } else {
            self._expandComponents(
              calendarId,
              groupArray,
              options,
              next
            );
          }
        }
      }

      if (completeFlag) {
        callback(null, false);
      }

    });
  },

  _getEndUtc: function(icalString) {
    var endUtc =
      icalString.substring(icalString.indexOf('endUtc'),
      icalString.indexOf('END:VEVENT'));

    return endUtc.substr(endUtc.indexOf(':') + 1);
  },

  _expandComponents: function(calendarId, comps, options, callback) {
    var calStore = this.app.store('Calendar');
    calStore.ownersOf(calendarId, function(err, owners) {
      if (err) {
        return callback(err);
      }
      if (owners.account.providerType !== 'Local' &&
        owners.account.preset !== 'activesync') {
        return callback('Not local provider');
      }

      var calendar = owners.calendar;
      var account = owners.account;

      var stream = this.service.stream(
        'caldav',
        'expandComponents',
        comps,
        options
      );

      var pull = new CaldavPullEvents(
        stream, {
          account: account,
          calendar: calendar,
          app: this.app,
          stores: ['busytimes', 'alarms', 'icalComponents']
        }
      );

      stream.request(function(err) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, pull);
      });

    }.bind(this));
  }
};

});

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

define('store/abstract',['require','exports','module','responder','promise','next_tick'],function(require, exports, module) {


var Responder = require('responder');
var denodeifyAll = require('promise').denodeifyAll;
var nextTick = require('next_tick');

/**
 * Creates an abstract store instance.
 * Every store must contain a reference
 * to the database.
 */
function Abstract(db, app) {
  this.db = db;
  this.app = app;
  this._cached = Object.create(null);
  Responder.call(this);

  denodeifyAll(this, [
    'persist',
    'all',
    '_allCached',
    'removeByIndex',
    'get',
    'remove',
    'removeDependents',
    'count'
  ]);
}
module.exports = Abstract;

Abstract.prototype = {
  __proto__: Responder.prototype,

  _store: null,

  /**
   * Stores that will need to be removed
   * when a record is removed from this store.
   *
   * @type {Array}
   */
  _dependentStores: null,

  _createModel: function(object, id) {
    if (typeof(id) !== 'undefined') {
      object._id = id;
    }

    return object;
  },

  _addToCache: function(object) {
    this._cached[object._id] = object;
  },

  _removeFromCache: function(id) {
    if (id in this._cached) {
      delete this._cached[id];
    }
  },

  _transactionCallback: function(trans, callback) {
    if (callback) {
      trans.addEventListener('error', function(e) {
        callback(e);
      });

      trans.addEventListener('complete', function() {
        callback(null);
      });
    }
  },

  /**
   * Adds an account to the database.
   *
   * @param {Object} object reference to account object to store.
   * @param {IDBTransaction} trans transaction.
   * @param {Function} callback node style callback.
   */
  persist: function(object, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }

    if (!trans) {
      trans = this.db.transaction(
        this._dependentStores || this._store,
        'readwrite'
      );
    }

    var self = this;
    var store = trans.objectStore(this._store);
    var data = this._objectData(object);
    var id;
    var model;

    var putReq;
    var reqType = this._detectPersistType(object);

    // determine type of event
    if (reqType === 'update') {
      putReq = store.put(data);
    } else {
      this._assignId(data);
      putReq = store.add(data);
    }

    trans.addEventListener('error', function(event) {
      if (callback) {
        callback(event);
      }
    });

    this._addDependents(object, trans);

    // when we have the id we can add the model to the cache.
    if (data._id) {
      id = data._id;
      model = self._createModel(object, id);
      self._addToCache(model);
    }

    trans.addEventListener('complete', function(data) {
      if (!model) {
        id = putReq.result;
        model = self._createModel(object, id);
        self._addToCache(model);
      }

      if (callback) {
        callback(null, id, model);
      }

      self.emit(reqType, id, model);
      self.emit('persist', id, model);
    });
  },

  _allCached: function(callback) {
    var list = this._cached;
    nextTick(function() {
      callback(null, list);
    });
  },

  /**
   * Loads all records in the database
   * for this store.
   *
   * Using this function will fill
   * the cache with all records in the store.
   * As such this should only be used once
   * during the app life-cycle.
   */
  all: function(callback) {
    if (this._allCallbacks) {
      this._allCallbacks.push(callback);
      return;
    }

    // list of pending callbacks
    this._allCallbacks = [callback];

    var self = this;
    var trans = this.db.transaction(this._store);
    var store = trans.objectStore(this._store);

    function process(data) {
      return self._addToCache(self._createModel(data));
    }

    function fireQueue(err, value) {
      var callback;
      while ((callback = self._allCallbacks.shift())) {
        callback(err, value);
      }
    }

    store.mozGetAll().onsuccess = function(event) {
      event.target.result.forEach(process);
    };

    trans.onerror = function(event) {
      fireQueue(event.target.error.name);
    };

    trans.oncomplete = function() {
      fireQueue(null, self._cached);
      self.all = self._allCached;
    };
  },

  _addDependents: function() {},
  _removeDependents: function(trans) {},

  _detectPersistType: function(object) {
    return ('_id' in object) ? 'update' : 'add';
  },

  _parseId: function(id) {
    return id;
  },

  _assignId: function(obj) {
  },

  /**
   * Removes all records a index value and removes
   * them from the cache. 'remove' events are *not* emitted
   * when removing in this manner for performance reasons.
   *
   * TODO: the test for this method still lives in the event store tests
   *       where this code began should refactor those tests to be general
   *       and live in the abstract tests.
   *
   * @param {String} indexName name of store index.
   * @param {Numeric} indexValue value in index.
   * @param {IDBTransation} [trans] optional transaction to reuse.
   * @param {Function} [callback] optional callback to use.
   *                   When called without a transaction chances
   *                   are you should pass a callback.
   */
  removeByIndex: function(indexName, indexValue, trans, callback) {
    var self = this;
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }

    if (!trans) {
      trans = this.db.transaction(
        this._dependentStores || this._store,
        'readwrite'
      );
    }
    if (callback) {

      trans.addEventListener('complete', function() {
        callback(null);
      });

      trans.addEventListener('error', function(event) {
        callback(event);
      });
    }


    var index = trans.objectStore(this._store).index(indexName);
    var req = index.openCursor(
      IDBKeyRange.only(indexValue)
    );

    req.onsuccess = function(event) {
      var cursor = event.target.result;
      if (cursor) {
        // remove deps first intentionally to mimic, removes normal behaviour
        self._removeDependents(cursor.primaryKey, trans);
        self._removeFromCache(cursor.primaryKey);
        cursor.delete();
        cursor.continue();
      }
    };

    return req;
  },

  /**
   * Finds a single record.
   *
   * Does not go through any cache or emit any events.
   *
   * @param {String} id id of record.
   * @param {IDBTransaction} [trans] optional transaction.
   * @param {Function} callback node style [err, record].
   */
  get: function(id, trans, callback) {
    var self = this;

    if (typeof(trans) === 'function') {
      callback = trans;
      trans = null;
    }

    if (!trans) {
      trans = this.db.transaction(this._store);
    }

    var store = trans.objectStore(this._store);
    var req = store.get(this._parseId(id));

    req.onsuccess = function() {
      var model;

      if (req.result) {
        model = self._createModel(req.result);
      }

      callback(null, model);
    };

    req.onerror = function(event) {
      callback(event);
    };
  },

  /**
   * Removes a object from the store.
   *
   * @param {String} id record reference.
   * @param {IDBTransaction} trans transaction.
   * @param {Function} callback node style callback.
   */
  remove: function(id, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }

    if (!trans) {
      trans = this.db.transaction(
        this._dependentStores || this._store,
        'readwrite'
      );
    }

    var self = this;
    var store = trans.objectStore(this._store);
    id = this._parseId(id);

    store.delete(id);

    this._removeDependents(id, trans);
    self.emit('preRemove', id);

    trans.addEventListener('error', function(event) {
      if (callback) {
        callback(event);
      }
    });

    trans.addEventListener('complete', function() {
      if (callback) {
        callback(null, id);
      }

      self.emit('remove', id);

      // intentionally after the callbacks...
      self._removeFromCache(id);
    });
  },

  removeDependents: function(id, trans) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }

    if (!trans) {
      trans = this.db.transaction(
        this._dependentStores || this._store,
        'readwrite'
      );
    }

    var store = trans.objectStore(this._store);
    id = this._parseId(id);

    this._removeDependents(id, trans);
  },

  /**
   * Find number of records in store.
   *
   * @param {Function} callback node style err/count.
   */
  count: function(callback) {
    var trans = this.db.transaction(this._store);
    var store = trans.objectStore(this._store);

    var req = store.count();

    req.onsuccess = function() {
      callback(null, req.result);
    };

    req.onerror = function(e) {
      callback(e);
    };
  },

  _objectData: function(data) {
    if ('toJSON' in data) {
      return data.toJSON();
    }
    return data;
  }
};

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

define('error',['require','exports','module'],function(require, exports, module) {


/**
 * These errors are _not_ exceptions and are designed to be passed not thrown
 * in typical |throw new X| fashion.
 */
function Base(name, detail) {
  this.message = 'oops... why did you throw this?';
  this.name = name;
  this.detail = detail;
}
module.exports = Base;

Base.prototype = Object.create(Error.prototype);

function errorFactory(name, l10nID) {
  var error = function(detail) {
    this.name = name;
    this.detail = detail;
    /**
     * we need to use l10nID's for backwards compatibility
     * (not changing string IDs between releases).
     */
    this.l10nID = l10nID || name;
  };

  error.prototype = Object.create(Base.prototype);
  return error;
}

/* note names should _never_ change */
Base.Authentication = errorFactory('authentication', 'error-unauthenticated');
Base.InvalidServer = errorFactory('invalid-server', 'error-internal-server-error');
Base.ServerFailure = errorFactory('server-failure', 'error-internal-server-error');
Base.CaldavUnknownError = errorFactory('caldav-unknown', 'error-unkown');

});

define('provider/caldav',['require','exports','module','./abstract','error','calc','./caldav_pull_events','error','error','./local','error','error','event_mutations','next_tick','responder','router'],function(require, exports, module) {


var Abstract = require('./abstract');
var Authentication = require('error').Authentication;
var Calc = require('calc');
var CaldavPullEvents = require('./caldav_pull_events');
var CalendarError = require('error');
var InvalidServer = require('error').InvalidServer;
var Local = require('./local');
var ServerFailure = require('error').ServerFailure;
var CaldavUnknownError = require('error').CaldavUnknownError;
var mutations = require('event_mutations');
var nextTick = require('next_tick');
var Responder = require('responder');
var router = require('router');

var CALDAV_ERROR_MAP = {
  'caldav-authentication': Authentication,
  'caldav-invalid-entrypoint': InvalidServer,
  'caldav-server-failure': ServerFailure,
  'caldav-unknown': CaldavUnknownError
};
var oneDayMilliseconds = 86400000;

function mapError(error, detail) {
  console.error('Error with name:', error.name);
  var calError = CALDAV_ERROR_MAP[error.name];
  if (!calError) {
    calError = new CalendarError(error.name, detail);
  } else {
    calError = new calError(detail);
  }

  return calError;
}

function CaldavProvider() {
  Abstract.apply(this, arguments);

  // TODO: Get rid of this when app global is gone.
  mutations.app = this.app;
  this.service = this.app.serviceController;
  this.accounts = this.app.store('Account');
  this.busytimes = this.app.store('Busytime');
  this.events = this.app.store('Event');
  this.icalComponents = this.app.store('IcalComponent');
  this.asproto = this.app.asproto;
}
module.exports = CaldavProvider;

CaldavProvider.prototype = {
  __proto__: Abstract.prototype,
  role: 'caldav',
  useUrl: true,
  useCredentials: true,
  canSync: true,
  canExpandRecurringEvents: true,

  /**
   * Number of dates in the past to sync.
   * This is usually from the first sync date.
   */
  daysToSyncInPast: 30,

  canCreateEvent: true,
  canUpdateEvent: true,
  canDeleteEvent: true,

  hasAccountSettings: true,

  /**
   * Error handling can be complex- this is the centralized location where
   * methods can send their error state and some context (an account).
   *
   *    this._handleServiceError(
   *      err,
   *      { account: account, calendar: calendar }
   *    );
   *
   * @param {Object} rawErr from service.
   * @param {Object} detail for the error.
   */
  _handleServiceError: function(rawErr, detail) {
    var calendarErr = mapError(rawErr, detail);

    // when we receive a permanent error we should mark the account with an
    // error.
    if (
      calendarErr instanceof Authentication ||
      calendarErr instanceof InvalidServer
    ) {
      // there must always be an account
      if (detail.account) {
        // but we only mark it with a permanent error if its persisted.
        if (detail.account._id) {
          this.accounts.markWithError(detail.account, calendarErr);
        }
      } else {
        console.error('Permanent server error without an account!');
      }
    }

    return calendarErr;
  },

  /**
   * Determines the capabilities of a specific calendar.
   *
   * The .remote property should contain a .privilegeSet array
   * with the caldav specific names of privileges.
   * In the case where .privilegeSet is missing all privileges are granted.
   *
   * (see http://tools.ietf.org/html/rfc3744#section-5.4).
   *
   *   - write-content: (PUT) can edit/add events
   *   - unbind: (DELETE) remove events
   *
   *
   * There are aggregate values (write for example) but
   * the spec states the specific permissions must also be expanded
   * so even if they have full write permissions we only check
   * for write-content.
   *
   * @param {Object} calendar object with caldav remote details.
   * @return {Object} object with three properties
   *  (canUpdate, canDelete, canCreate).
   */
  calendarCapabilities: function(calendar) {
    var remote = calendar.remote;

    if (!remote.privilegeSet) {
      return {
        canUpdateEvent: true,
        canDeleteEvent: true,
        canCreateEvent: true
      };
    }

    var privilegeSet = remote.privilegeSet;
    var canWriteConent = privilegeSet.indexOf('write-content') !== -1;

    return {
      canUpdateEvent: canWriteConent,
      canCreateEvent: canWriteConent,
      canDeleteEvent: privilegeSet.indexOf('unbind') !== -1
    };
  },

  /**
   * Returns the capabilities of a single event.
   *
   * @param {Object} event local object.
   * @param {Function} callback [err, caps].
   */
  eventCapabilities: function(event, callback) {
    var calendarStore = this.app.store('Calendar');

    calendarStore.get(event.calendarId, function(err, calendar) {
      if (err) {
        return callback(err);
      }

      var caps = this.calendarCapabilities(
        calendar
      );

      callback(null, {
        canCreate: caps.canCreateEvent,
        canUpdate: caps.canUpdateEvent,
        canDelete: caps.canDeleteEvent
      });
    }.bind(this));
  },

  getAccount: function(account, callback) {
    if (this.bailWhenOffline(callback)) {
      return;
    }

    var self = this;
    this.service.request(
      'caldav',
      'getAccount',
      account,
      function(err, data) {
        if (err) {
          return callback(
            self._handleServiceError(err, { account: account })
          );
        }
        callback(null, data);
      }
    );
  },

  /**
   * Hook to format remote data if needed.
   */
  formatRemoteCalendar: function(calendar) {
    if (!calendar.color) {
      calendar.color = this.defaultColor;
    }

    return calendar;
  },

  findCalendars: function(account, callback) {
    if (this.bailWhenOffline(callback)) {
      return;
    }

    var self = this;
    function formatCalendars(err, data) {
      if (err) {
        return callback(self._handleServiceError(err, {
          account: account
        }));
      }

      // format calendars if needed
      if (data) {
        for (var key in data) {
          data[key] = self.formatRemoteCalendar(data[key]);
        }
      }

      callback(err, data);
    }

    this.service.request(
      'caldav',
      'findCalendars',
      account.toJSON(),
      formatCalendars
    );
  },

  syncActivesyncEvent: function(account, calendar, stream, cached, callback) {
    var conn = new this.asproto.Connection(account.exchange.deviceId,
      account.exchange.policyKey, calendar, stream);
    conn.open(account.exchange.server, account.user, account.password,
      account.accountId, this.app);
    conn.timeout = 30 * 1000;
    conn.connect((error, options) => {
      if (error && error.status === 401) {
        let state = {
          errMessage: 'incorrect password'
        }

        router.go('/password/' + account._id + '/', state);
        callback(error);
        return;
      }

      conn.getSyncData(cached, (err) => {
        conn.disconnect();
        callback(err);
      });
      setTimeout(()=>{
        document.getElementById("progress-indicator").style.display = 'none';       
      },100)
    })

  },

  _syncEvents: function(account, calendar, cached, callback) {

    var startDate;
    // calculate the first date we want to sync
    if (!calendar.firstEventSyncDate) {
      startDate = Calc.createDay(new Date());

      // will be persisted if sync is successful (clone is required)
      calendar.firstEventSyncDate = new Date(
        startDate.valueOf()
      );
    } else {
      startDate = new Date(calendar.firstEventSyncDate.valueOf());
    }

    // start date - the amount of days is the sync range
    startDate.setDate(startDate.getDate() - this.daysToSyncInPast);

    var options = {
      startDate: startDate,
      cached: cached
    };

    var stream;

    if (account.preset === 'activesync') {
       stream = new Responder();
    } else {
       stream = this.service.stream(
        'caldav',
        'streamEvents',
        account.toJSON(),
        calendar.remote,
        options
      );
    }

    var pull = new CaldavPullEvents(stream, {
      app: this.app,
      account: account,
      calendar: calendar
    });


    if (account.preset === 'activesync') {
      this.syncActivesyncEvent(account, calendar, stream, cached, callback);
    } else {
      var calendarStore = this.app.store('Calendar');
      var syncStart = new Date();

      var self = this;
      stream.request(function(err) {
        if (err) {
          return callback(
            self._handleServiceError(err, {
              account: account,
              calendar: calendar
            })
          );
        }

        var trans = pull.commit(function(commitErr) {
          if (commitErr) {
            callback(err);
            return;
          }
          callback(null);
        });

        /**
         * Successfully synchronizing a calendar indicates we can remove this
         * error.
         */
        calendar.error = undefined;

        calendar.lastEventSyncToken = calendar.remote.syncToken;
        calendar.lastEventSyncDate = syncStart;

        calendarStore.persist(calendar, trans);

      });
    }
    return pull;
  },

  /**
   * Builds list of event urls & sync tokens.
   *
   * @param {Calendar.Model.Calendar} calender model instance.
   * @param {Function} callback node style [err, results].
   */
  _cachedEventsFor: function(calendar, account, callback) {
    var store = this.app.store('Event');

    store.eventsForCalendar(calendar._id, function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      var list = Object.create(null);

      var i = 0;
      var len = results.length;
      var item;

      if (account.preset === 'activesync') {
        for (; i < len; i++) {
          item = results[i];

          let idLength = item.calendarId.toString().length;
          let eventUID = item._id.substring(idLength + 1);

          list[eventUID] = {
            _id: item._id,
            calendarId: item.calendarId,
            remote: item.remote
          };
        }
      } else {
        for (; i < len; i++) {
          item = results[i];
          list[item.remote.url] = {
            syncToken: item.remote.syncToken,
            id: item._id
          };
        }
      }

      callback(null, list);
    });
  },

  /**
   * Sync remote and local events for a calendar.
   */
  syncEvents: function(account, calendar, callback) {
    var self = this;

    if (this.bailWhenOffline(callback)) {
      return;
    }

    if (!calendar._id) {
      throw new Error('calendar must be assigned an _id');
    }

    // Don't attempt to sync when provider cannot
    // or we have matching tokens
    if ((calendar.lastEventSyncToken &&
         calendar.lastEventSyncToken === calendar.remote.syncToken)) {
      return nextTick(callback);
    }

    this._cachedEventsFor(calendar, account, function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      self._syncEvents(
        account,
        calendar,
        results,
        callback
      );
    });
  },

  /**
   * See abstract for contract details...
   *
   * Finds all ical components that have not been expanded
   * beyond the given point and expands / persists them.
   *
   * @param {Date} maxDate maximum date to expand to.
   * @param {Function} callback [err, didExpand].
   */
  ensureRecurrencesExpanded: function(maxDate, callback) {
    var self = this;
    this.icalComponents.findRecurrencesBefore(maxDate,
                                              function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      if (!results.length ||
        (results.length === 1 && (results[0].calendarId === 'local-first' ||
        results[0].preset === 'activesync'))) {
        callback(null, false);
        return;
      }

      // CaldavPullRequest is based on a calendar/account combination
      // so we must group all of the outstanding components into
      // their calendars before we can begin expanding them.
      var groups = Object.create(null);
      results.forEach(function(comp) {
        var calendarId = comp.calendarId;
        if (calendarId !== 'local-first' && comp.preset !== 'activesync') {
          if (!(calendarId in groups)) {
            groups[calendarId] = [];
          }

          groups[calendarId].push(comp);
        }
      });

      var pullGroups = [];
      var pending = 0;
      var options = {
        maxDate: Calc.dateToTransport(maxDate)
      };

      function next(err, pull) {
        pullGroups.push(pull);
        if (!(--pending)) {
          var trans = self.app.db.transaction(
            ['icalComponents', 'alarms', 'busytimes'],
            'readwrite'
          );

          trans.oncomplete = function() {
            callback(null, true);
          };

          trans.onerror = function(event) {
            callback(event.result.error.name);
          };

          pullGroups.forEach(function(pull) {
            pull.commit(trans);
          });
        }
      }

      for (var calendarId in groups) {
        pending++;
        self._expandComponents(
          calendarId,
          groups[calendarId],
          options,
          next
        );
      }

    });
  },

  _expandComponents: function(calendarId, comps, options, callback) {
    var calStore = this.app.store('Calendar');

    calStore.ownersOf(calendarId, function(err, owners) {
      if (err) {
        return callback(err);
      }

      var calendar = owners.calendar;
      var account = owners.account;

      var stream = this.service.stream(
        'caldav',
        'expandComponents',
        comps,
        options
      );

      var pull = new CaldavPullEvents(
        stream,
        {
          account: account,
          calendar: calendar,
          app: this.app,
          stores: [
            'busytimes', 'alarms', 'icalComponents'
          ]
        }
      );

      stream.request(function(err) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, pull);
      });

    }.bind(this));
  },

  createEventForActivesync: function(account, calendar, event, noSync, callback) {
    var conn = new this.asproto.Connection(account.exchange.deviceId,
      account.exchange.policyKey);
    conn.open(account.exchange.server, account.user, account.password,
      account.accountId);
    conn.timeout = 30 * 1000;
    conn.connect((error, options) => {
      conn.addEvent(account, calendar, event, (err) => {
        conn.disconnect();
        if (!noSync) {
          mutations.app.syncController.all();
        }
        callback();
      });
    })

  },

  endUtcToString: function(endUtc) {
    let date = new Date(endUtc);
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth() + 1;
    let day = date.getUTCDate();
    let hour = date.getUTCHours();
    let minutes = date.getUTCMinutes();
    let seconds = date.getUTCSeconds();

    month = month < 10 ? ('0' + month) : month;
    day = day < 10 ? ('0' + day) : day;
    hour = hour < 10 ? ('0' + hour) : hour;
    minutes = minutes < 10 ? ('0' + minutes) : minutes;
    seconds = seconds < 10 ? ('0' + seconds) : seconds;

    let dateString = year + '-' + month + '-' + day + 'T' + hour + ':' +
      minutes + ':' + seconds + 'Z';

    return dateString;
  },

  /**
   * INTERVAL:
   * The Interval specifies the interval between recurrences.
   *
   */
  getEventRrule: function(event) {
    let rule;

    switch (event.remote.repeat) {
      case 'every-day':
        rule = 'FREQ=DAILY;';
        break;
      case 'every-week':
        rule = 'FREQ=WEEKLY;';
        break;
      case 'every-2-weeks':
        rule = 'FREQ=WEEKLY;INTERVAL=2';
        break;
      case 'every-month':
        rule = 'FREQ=MONTHLY;';
        break;
      case 'every-year':
        rule = 'FREQ=YEARLY;';
        break;
    }

    if (event.remote.until) {
      rule += 'UNTIL=' + event.remote.until;
    }

    return rule;
  },

  createEvent: function(event, busytime, callback, endUtc, noSync) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    if (this.bailWhenOffline(callback)) {
      return;
    }

    this.events.ownersOf(event, fetchOwners);

    var self = this;
    var calendar;
    var account;
    function fetchOwners(err, owners) {
      calendar = owners.calendar;
      account = owners.account;

      if (account.preset === 'activesync') {
        event.endUtc = endUtc;
        self.createEventForActivesync(account, calendar, event, noSync, callback);
      } else {
        if (event.remote.repeat !== 'never') {
          if (endUtc) {
            event.remote.until = self.endUtcToString(endUtc);
          }

          event.remote.rrule = self.getEventRrule(event);
        }

        delete event.remote.url;
        delete event.remote.syncToken;
        event.remote.description =
          !event.remote.description ? '' : event.remote.description;
        event.remote.location =
          !event.remote.location ? '' : event.remote.location;

        self.service.request(
          'caldav',
          'createEvent',
          account,
          calendar.remote,
          event.remote,
          handleRequest
        );
      }
    }

    function handleRequest(err, remote) {
      if (err) {
        return callback(self._handleServiceError(err, {
          account: account,
          calendar: calendar
        }));
      }

      var event = {
        _id: calendar._id + '-' + remote.id,
        calendarId: calendar._id
      };

      var component = {
        eventId: event._id,
        ical: remote.icalComponent
      };

      delete remote.icalComponent;
      event.remote = remote;

      var create = mutations.create({
        event: event,
        icalComponent: component
      });

      create.commit(function(err) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, create.busytime, create.event);
        mutations.app.syncController.all();
      });
    }
  },

  updateEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    if (this.bailWhenOffline(callback)) {
      return;
    }

    this.events.ownersOf(event, fetchOwners);

    var self = this;
    var calendar;
    var account;

    function fetchOwners(err, owners) {
      calendar = owners.calendar;
      account = owners.account;

      self.icalComponents.get(
        event._id, fetchComponent
      );
    }

    function fetchComponent(err, ical) {
      if (err) {
        callback(err);
        return;
      }

      var details = {
        event: event.remote,
        icalComponent: ical.ical
      };

      if (account.preset === 'activesync') {
        self.deleteEventForActivesync(account, calendar, event, () => {
          self.createEventForActivesync(account, calendar, event, false, callback);
        });
      } else {
        self.service.request(
          'caldav',
          'updateEvent',
          account,
          calendar.remote,
          details,
          handleUpdate
        );
      }
    }

    function handleUpdate(err, remote) {
      if (err) {
        callback(self._handleServiceError(err, {
          account: account,
          calendar: calendar
        }));
        return;
      }

      var component = {
        eventId: event._id,
        ical: remote.icalComponent
      };

      delete remote.icalComponent;
      event.remote = remote;

      var update = mutations.update({
        event: event,
        icalComponent: component
      });

      update.commit(function(err) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, update.busytime, update.event);
      });
    }
  },

  compareEventdate: function(event) {
    let nowDate = new Date();
    let tzOffset = nowDate.getTimezoneOffset() * 60 * 1000;
    let selectDate = this.app.timeController.selectedDay;
    let eventDate = new Date(event.remote.startDate.valueOf());

    selectDate = new Date(selectDate.valueOf() - tzOffset);
    if (selectDate.getUTCFullYear() === eventDate.getUTCFullYear() &&
      selectDate.getUTCMonth() === eventDate.getUTCMonth()&&
      selectDate.getUTCDate() === eventDate.getUTCDate()) {
      return true;
    }

    return false;
  },

  /**
   * To update a recurring event
   */
  updateEventAll: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    // to update a recurring event
    // 1. delete the event
    // 2. create a new event
    this.deleteEvent(event, function(err) {
      if (err) {
        return callback(err);
      }

      let startDate;
      let endDate;
      if (event.remote.isAllDay ||
        (this.compareEventdate(event) && event.remote.repeat !== 'never')) {
        if (event.remote.isAllDay) {
          let allDayOffset = event.remote.endDate - event.remote.startDate;
          startDate = new Date(busytime.start.utc - busytime.start.offset * 2);
          endDate = new Date(startDate.valueOf() + allDayOffset);
        } else {
          startDate = new Date(busytime.start.utc);
          endDate = new Date(busytime.end.utc);
        }

        startDate.setUTCHours(event.remote.startDate.getUTCHours());
        startDate.setUTCMinutes(event.remote.startDate.getUTCMinutes());
        startDate.setUTCSeconds(event.remote.startDate.getUTCSeconds());

        endDate.setUTCHours(event.remote.endDate.getUTCHours());
        endDate.setUTCMinutes(event.remote.endDate.getUTCMinutes());
        endDate.setUTCSeconds(event.remote.endDate.getUTCSeconds());
      } else {
        startDate = new Date(event.remote.startDate.valueOf());
        endDate = new Date(event.remote.endDate.valueOf());
      }

      event.remote.start.offset = busytime.start.offset;
      event.remote.start.utc = startDate.valueOf();
      event.remote.startDate = startDate;
      event.remote.end.offset = busytime.end.offset;
      event.remote.end.utc = endDate.valueOf();
      event.remote.endDate = endDate;

      if (event.remote.isAllDay) {
        let now = new Date();
        let timezoneOffset = now.getTimezoneOffset() * 60 * 1000;
        event.remote.startDate.utc -= timezoneOffset;
        event.remote.endDate.utc -= timezoneOffset;
      }

      // to erase it's original id, and then
      // apply it a new id in creation
      nextTick(function() {
        delete event._id;
        delete event.remote.id;
        this.createEvent(event, null, callback, event.endUtc, false);
      }.bind(this));
    }.bind(this));
  },

  updateEventFuture: function(event, busytime, callback, endRecuUtc) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }
    this.app.store('Event').get(busytime._id.slice(0,-37), (err, value) => {
      if (err) {
        return callback(err);
      }

      if (event.remote.repeat !== value.remote.repeat ||
        event.remote.startDate.valueOf() === busytime.startDate.valueOf()) {
        this.updateEventAll(event, busytime, callback);
        return;
      }

      // to update a recurring event
      // 1. delete the event
      // 2. create a new event
      this.deleteEvent(event, (err) => {
        if (err) {
          return callback(err);
        }

        let creatFutureEvent = () => {
          mutations.app.actDelForUpdate = event.remote.id;

          let offset =
            event.remote.preset === 'google' ? 0 : oneDayMilliseconds;

          event.remote.startDate =
            new Date(event.remote.startDate.valueOf());
          event.remote.endDate =
            new Date(event.remote.endDate.valueOf());
          event.remote.start = Calc.dateToTransport(
            event.remote.startDate,
            null, // TODO allow setting tzid
            event.remote.isAllDay
          );
          event.remote.end = Calc.dateToTransport(
            event.remote.endDate,
            null, // TODO allow setting tzid
            event.remote.isAllDay
          );

          setTimeout(() => {
            delete event._id;
            delete event.remote.id;
            this.createEvent(event, null, callback, event.endUtc, false);
          }, 0);
        }

        nextTick(() => {
          delete value._id;
          delete value.remote.id;
          let now = new Date();
          let offset = now.getTimezoneOffset() * 60 * 1000;
          this.createEvent(value, null, creatFutureEvent,
            endRecuUtc - offset, true);
        });
      });
    });
  },

  deleteEventForActivesync: function(account, calendar, event, callback) {
    var conn = new this.asproto.Connection(account.exchange.deviceId,
      account.exchange.policyKey);
    conn.open(account.exchange.server, account.user, account.password);
    conn.timeout = 30 * 1000;
    conn.connect((error, options) => {
      conn.deleteEvent(account, calendar, event, (err) => {
        conn.disconnect();
        callback();
      });
    })

  },

  deleteEvent: function(event, busytime, callback) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    if (this.bailWhenOffline(callback)) {
      return;
    }

    this.events.ownersOf(event, fetchOwners);

    var calendar;
    var account;
    var self = this;

    Local.prototype.deleteEvent.call(self, event, busytime);

    function fetchOwners(err, owners) {
      calendar = owners.calendar;
      account = owners.account;

      if (account.preset === 'activesync') {
        self.deleteEventForActivesync(account, calendar, event, callback);
      } else {
        self.service.request(
          'caldav',
          'deleteEvent',
          account,
          calendar.remote,
          event.remote,
          handleRequest
        );
      }
    }

    function handleRequest(err) {
      if (err) {
        callback(self._handleServiceError(err, {
          account: account,
          calendar: calendar
        }));
        return;
      }

      return callback();
    }
  },

  deleteEventFuture: function(event, busytime, callback, endUtc) {
    if (typeof(busytime) === 'function') {
      callback = busytime;
      busytime = null;
    }

    // to update a recurring event
    // 1. delete the event
    // 2. create a new event
    this.deleteEvent(event, function(err) {
      if (err) {
        return callback(err);
      }

      // to erase it's original id, and then
      // apply it a new id in creation
      nextTick(function() {
        delete event._id;
        delete event.remote.id;
        this.createEvent(event, null, callback, endUtc, false);
      }.bind(this));
    }.bind(this));
  },

  bailWhenOffline: function(callback) {
    if (!this.offlineMessage && 'mozL10n' in window.navigator) {
      this.offlineMessage = window.navigator.mozL10n.get('error-offline');
    }

    var ret = this.app.offline() && callback;
    if (ret) {
      var error = new Error();
      error.name = 'offline';
      error.message = this.offlineMessage;
      callback(error);
    }
    return ret;
  }
};

});

define('provider/caldav_visual_log',['require','exports','module','calc'],function(require, exports, module) {


var Calc = require('calc');

/**
 * This is a more crude version of what asuth does in email.
 * Right now this class is here only for debugging sync issues.
 * We need to add the settings so we can optionally turn this on.
 */
function EventLogger() {
  this.events = Object.create(null);
  this.occurs = Object.create(null);

  this.richLog = {};
}
module.exports = EventLogger;

EventLogger.prototype = {
  displayLog: function(id, string) {
    if (!(id in this.richLog)) {
      this.richLog[id] = [];
    }
    this.richLog[id].push(string);
  },

  addEvent: function(event) {
    var id = event.id;
    this.events[id] = event;
    var log = this.formatEvent(event);
    this.displayLog(id, log);
  },

  addBusytime: function(busy) {
    var id = busy.eventId;
    this.occurs[id] = busy;
    this.displayLog(id, this.formatBusytime(busy));
  },

  formatEvent: function(event) {
    var format = [
      'add event: (' + event.id + ')',
      'title:' + event.title,
      'start:' + (Calc.dateFromTransport(event.start)).toString(),
      'end:' + (Calc.dateFromTransport(event.end)).toString(),
      'isException:' + event.isException
    ];

    return format.join(' || ');
  },

  formatBusytime: function(busy) {
    var event = this.events[busy.eventId];
    var title = 'busytime for event: ' + busy.eventId;

    if (event) {
      title = 'busytime for event: ' + event.title;
    }

    var format = [
      title,
      'start:' + (Calc.dateFromTransport(busy.start)).toString(),
      'end:' + (Calc.dateFromTransport(busy.end)).toString(),
      'isException:' + busy.isException
    ];

    return format.join(' || ');
  }
};

});

define('provider/provider',['require','exports','module','./abstract','./caldav','./caldav_pull_events','./caldav_visual_log','./local'],function(require, exports) {


exports.Abstract = require('./abstract');
exports.Caldav = require('./caldav');
exports.CaldavPullEvents = require('./caldav_pull_events');
exports.CaldavVisualLog = require('./caldav_visual_log');
exports.Local = require('./local');

});

/**
 * TODO(gareth): This thing must die.
 */
define('provider/provider_factory',['require','exports','module','./provider'],function(require, exports) {


var Provider = require('./provider');

var providers = exports.providers = {};

// Will be injected...
exports.app = null;

exports.get = function(name) {
  if (!providers[name]) {
    providers[name] = new Provider[name]({ app: exports.app });
  }

  return providers[name];
};

});

define('store/account',['require','exports','module','models/account','./abstract','debug','promise','extend','next_tick','probably_parse_int','provider/provider_factory'],function(require, exports, module) {


var AccountModel = require('models/account');
var Abstract = require('./abstract');
var debug = require('debug')('store/account');
var denodeifyAll = require('promise').denodeifyAll;
var extend = require('extend');
var nextTick = require('next_tick');
var probablyParseInt = require('probably_parse_int');
var providerFactory = require('provider/provider_factory');

function Account() {
  Abstract.apply(this, arguments);

  denodeifyAll(this, [
    'verifyAndPersist',
    'sync',
    'markWithError',
    'syncableAccounts',
    'availablePresets'
  ]);
}
module.exports = Account;

Account.prototype = {
  __proto__: Abstract.prototype,

  _store: 'accounts',

  _parseId: probablyParseInt,

  /**
   * Checks if a given account is a duplicate of another.
   *
   * @param {Calendar.Model.Account} model to check.
   * @param {Function} callback [err].
   */
  _validateModel: function(model, callback) {
    this.all(function(err, allAccounts) {
      if (err) {
        callback(err);
        return;
      }

      // check if this account is already registered
      for (var index in allAccounts) {
        if ((model.preset === 'activesync' &&
          allAccounts[index].user === model.user &&
          allAccounts[index]._id !== model._id) ||
          (allAccounts[index].user === model.user &&
          allAccounts[index].fullUrl === model.fullUrl &&
          allAccounts[index]._id !== model._id)) {
          var dupErr = new Error(
            'Cannot add two accounts with the same url / entry point'
          );

          dupErr.name = 'account-exist';
          callback(dupErr);
          return;
        }
      }

      callback();
    });
  },

  verifyAndPersist: function(model, callback) {
    var self = this;
    var provider = providerFactory.get(
      model.providerType
    );

    provider.getAccount(model.toJSON(), function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      model.error = undefined;

      // if this works we always will get a calendar home.
      // This is used to find calendars.
      model.calendarHome = data.calendarHome;

      // server may override properties on demand.
      extend(model, data);

      self._validateModel(model, function(err) {
        if (err) {
          return callback(err);
        }

        self.persist(model, callback);
      });
    });
  },

  verifyAndPersistNew: function(model, callback) {
    this._validateModel(model.toJSON(), (err) => {
      if (err) {
        return callback(err);
      }

      this.persist(model, callback);
    });
  },

  updateAccountData: function(model, callback) {
    this.persist(model, callback);
  },

  /**
   * Because this is a top-level store
   * when we remove an account all records
   * related to it must be removed.
   */
  _dependentStores: [
    'accounts', 'calendars', 'events',
    'busytimes', 'alarms', 'icalComponents'
  ],

  _removeDependents: function(id, trans) {
    var store = this.db.getStore('Calendar');
    store.remotesByAccount(id, trans, function(err, related) {
      if (err) {
        return console.error('Error removing deps for account: ', id);
      }

      var key;
      for (key in related) {
        store.remove(related[key]._id, trans);
      }
    });
  },

  sync: function(account, callback) {
    // TODO: We need to block removal when syncing
    // OR after removal ensure everything created here
    // is purged.

    if (account.preset === 'google' &&
      Date.now() >= account.oauth.issued_at + account.oauth.expires_in) {
      navigator.accountManager.getAccounts().then((accounts) => {
        let index = accounts.findIndex((node) => {
          return node.accountId === account.user;
        });

        if (index === -1) {
          callback();
          return;
        }

        navigator.accountManager.getCredential(accounts[index],
          {refreshCredential: true}).then((credentials) => {
          account.oauth.access_token = credentials.access_token;
          account.oauth.issued_at = Date.now();
          account.oauth.expires_in =
            credentials.expire_timestamp - account.oauth.issued_at;

          let trans = this.db.transaction(
            this._dependentStores || this._store,
            'readwrite'
          );

          let store = trans.objectStore('accounts');
          let putReq = store.put(account);

          trans.addEventListener('error', (event) => {
            if (callback) {
              callback(event);
            }
          });

          // when we have the id we can add the model to the cache.
          if (account._id) {
            var model = this._createModel(account, account._id);
            this._addToCache(model);
          }

          trans.addEventListener('complete', (data) => {
            this.syncPro(account, callback);
          });
        }, (reason) => {
          if (reason === 'timeout') {
            Toaster.showToast({
              messageL10nId: 'error-time-out',
              messageL10nArgs: { server: account.domain }
            });
          }

          callback(reason);
          console.log("getCredentials rejected: " + reason);
        });
      });
    } else {
      this.syncPro(account, callback);
    }
  },

  /**
   * Syncs all calendars for account.
   *
   * TODO: Deprecate this method in favor of new provider API's.
   *
   * @param {Calendar.Models.Account} account sync target.
   * @param {Function} callback node style.
   */
  syncPro: function(account, callback) {
    // TODO: We need to block removal when syncing
    // OR after removal ensure everything created here
    // is purged.

    var self = this;
    var provider = providerFactory.get(account.providerType);
    var calendarStore = this.db.getStore('Calendar');

    var persist = [];

    // remotesByAccount return an object indexed by remote ids
    var calendars;

    // these are remote ids not local ones
    var originalIds;

    function fetchExistingCalendars(err, results) {
      if (err) {
        return callback(err);
      }

      calendars = results;
      originalIds = Object.keys(calendars);

      provider.findCalendars(account, persistCalendars);
    }

    function persistCalendars(err, remoteCals) {
      var key;

      if (err) {
        callback(err);
        return;
      }

      for (key in remoteCals) {
        if (remoteCals.hasOwnProperty(key)) {
          var cal = remoteCals[key];
          var idx = originalIds.indexOf(key);

          if (idx !== -1) {
            // update an existing calendar
            originalIds.splice(idx, 1);

            var original = calendars[key];
            original.remote = cal;
            original.error = undefined;
            persist.push(original);
          } else {
            // create a new calendar
            persist.push(
              calendarStore._createModel({
                remote: new Object(cal),
                accountId: account._id
              })
            );
          }
        }
      }

      // at this point whatever is left in originalIds
      // is considered a removed calendar.

      // update / remove
      if (persist.length || originalIds.length) {
        var trans = self.db.transaction(
          self._dependentStores,
          'readwrite'
        );

        originalIds.forEach(function(id) {
          calendarStore.remove(calendars[id]._id, trans);
        });

        persist.forEach(function(object) {
          if (object.remote.name !== 'Holiday Calendar') {
            calendarStore.persist(object, trans);
          }
        });

        // event listeners must come at the end
        // because persist/remove also listen to
        // transaction complete events.
        trans.addEventListener('error', function(err) {
          callback(err);
        });

        trans.addEventListener('complete', function() {
          callback(null);
        });
      } else {
        // invoke callback nothing to sync
        callback(null);
      }
    }

    calendarStore.remotesByAccount(
      account._id,
      fetchExistingCalendars
    );
  },

  syncCalendars: function(account, callback) {
    var self = this;
    var provider = providerFactory.get(account.providerType);
    var calendarStore = this.db.getStore('Calendar');
    var persist = [];
    // these are remote ids not local ones
    var originalIds;
    var cal = {
      description: account.user,
      name: account.user,
      id: '/' + account.user + '/events/'
    };
    var calendars = calendarStore._createModel({
      remote: new Object(cal),
      accountId: account._id
    });
    var trans = self.db.transaction(
      self._dependentStores,
      'readwrite'
    );

    calendarStore.persist(calendars, trans);

    // event listeners must come at the end
    // because persist/remove also listen to
    // transaction complete events.
    trans.addEventListener('error', function(err) {
      callback(err);
    });

    trans.addEventListener('complete', function() {
      callback(null);
    });
  },

  _createModel: function(obj, id) {
    if (!(obj instanceof AccountModel)) {
      obj = new AccountModel(obj);
    }

    if (typeof(id) !== 'undefined') {
      obj._id = id;
    }

    return obj;
  },

  /**
   * Marks given model with an error and sends an error event with the given
   * model
   *
   * This will trigger an 'error' event immediately with the given model.
   * The callback fires _after_ the event. Its entirely possible (under rare
   * conditions) that this operation will fail but the event will fire.
   *
   *
   * @param {Object} account model.
   * @param {Calendar.Error} error to mark model with.
   * @param {IDBTransaction} [trans] optional transaction.
   * @param {Function} [callback] optional called with [err, model].
   */
  markWithError: function(account, error, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = null;
    }

    if (!account._id) {
      throw new Error('given account must be persisted');
    }

    if (!account.error) {
      account.error = {
        name: error.name,
        date: new Date(),
        count: 0
      };
    }

    // increment the error count
    account.error.count++;

    var calendarStore = this.db.getStore('Calendar');
    var self = this;
    function fetchedCalendars(err, calendars) {
      if (!trans) {
        trans = self.db.transaction(
          self._dependentStores,
          'readwrite'
        );
      }

      if (err) {
        console.error('Cannot fetch all calendars', err);
        return self.persist(account, trans, callback);
      }

      for (var id in calendars) {
        calendarStore.markWithError(calendars[id], error, trans);
      }

      self.persist(account, trans);
      self._transactionCallback(trans, callback);

    }

    // find related calendars and mark those too
    calendarStore.remotesByAccount(
      account._id,
      fetchedCalendars
    );
  },

  /**
   * Finds and returns all accounts that can sync (based on their provider).
   *
   *    accountStore.syncableAccounts(function(err, list) {
   *      if (list.length === 0)
   *        // hide sync options
   *    });
   *
   * @param {Function} callback [Error err, Array accountList].
   */
  syncableAccounts: function(callback) {
    debug('Will find syncable accounts...');
    this.all((err, list) => {
      if (err) {
        return callback(err);
      }

      var results = [];
      for (var key in list) {
        var account = list[key];
        var provider = providerFactory.get(account.providerType);
        if (provider.canSync) {
          results.push(account);
        }
      }

      callback(null, results);
    });
  },

  handleRefreshCredential: function(account) {
    navigator.accountManager.getAccounts().then((accounts) => {
      let index = accounts.findIndex((node) => {
        return node.accountId === account.user;
      });

      if (index === -1) {
        callback();
        return;
      }

      navigator.accountManager.getCredential(accounts[index],
        {refreshCredential: true}).then((credentials) => {
        account.oauth.access_token = credentials.access_token;
        account.oauth.issued_at = Date.now();
        account.oauth.expires_in =
          credentials.expire_timestamp - account.oauth.issued_at;

        let trans = this.db.transaction(
          this._dependentStores || this._store,
          'readwrite'
        );

        let store = trans.objectStore('accounts');
        let putReq = store.put(account);

        trans.addEventListener('error', (event) => {
          if (callback) {
            callback(event);
          }
        });

        // when we have the id we can add the model to the cache.
        if (account._id) {
          var model = this._createModel(account, account._id);
          this._addToCache(model);
        }

        trans.addEventListener('complete', (data) => {
        });
      }, (reason) => {
        if (reason === 'timeout') {
          Toaster.showToast({
            messageL10nId: 'error-time-out',
            messageL10nArgs: { server: account.domain }
          });
        }

        callback(reason);
        console.log("getCredentials rejected: " + reason);
      });
    });
  },

  /**
   * Returns a list of available presets filtered by
   * the currently used presets in the database.
   *
   * Expected structure of the presetList is as follows:
   *
   *    {
   *      'presetType': {
   *        // most important field when true if the preset
   *        // is available in the database that preset type
   *        // will be excluded.
   *        singleUse: true
   *        providerType: 'X',
   *        options: {}
   *      }
   *
   *    }
   *
   * @param {Object} presetList see example ^^^.
   * @param {Function} callback [err, ['presetKey', ...]].
   */
  availablePresets: function(presetList, callback) {
    var results = [];
    var singleUse = {};
    var hasSingleUses = false;

    for (var preset in presetList) {
      if (presetList[preset].singleUse) {
        hasSingleUses = true;
        singleUse[preset] = true;
      } else {
        results.push(preset);
      }
    }

    if (!hasSingleUses) {
      return nextTick(function() {
        callback(null, results);
      });
    }

    this.all(function(err, list) {
      if (err) {
        callback(err);
        return;
      }

      for (var id in list) {
        var preset = list[id].preset;
        if (singleUse[preset]) {
          delete singleUse[preset];
        }
      }

      // add un-used presets to the list.
      callback(null, results.concat(Object.keys(singleUse)));
    });
  }
};

});

/**
 * @fileoverview Simple helper function to convert basic platform DOMRequest
 *     into Promise. Deprecate once there is platform support for something
 *     like DOMRequest.then().
 */
define('create_dom_promise',['require','exports','module'],function(require, exports, module) {


module.exports = function createDOMPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = resolve;
    request.onerror = reject;
  });
};

});

define('message_handler',['require','exports','module','responder','debug','notification'],function(require, exports, module) {


var Responder = require('responder');
var debug = require('debug')('message_handler');
var notification = require('notification');

// Will be injected...
exports.app = null;
var responder = exports.responder = new Responder();

exports.start = function() {
  if (!('mozSetMessageHandler' in navigator)) {
    debug('mozSetMessageHandler is missing!');
    return;
  }

  debug('Will listen for alarm messages...');
  navigator.mozSetMessageHandler('alarm', message => {
    debug('Received alarm message!');
    var data = message.data;
    switch (data.type) {
      case 'sync':
        responder.emitWhenListener('sync');
        break;
      default:
        let lock = navigator.requestWakeLock('cpu');
        notification.lock = lock;
        responder.emitWhenListener('alarm', data);
        break;
    }
  });

  // Handle notifications when the calendar app process is closed.
  debug('Will listen for notification messages...');
  navigator.mozSetMessageHandler('notification', message => {
    debug('Received notification message!');
    if (!message.clicked) {
      return debug('Notification was not clicked?');
    }

    let imageURL = message.imageURL || message.iconURL;
    let url = imageURL.split('?')[1];
    notification.launch(url);
  });
};

});

define('controllers/notifications',['require','exports','module','calc','date_format','debug','message_handler','notification'],function(require, exports) {


var calc = require('calc');
var dateFormat = require('date_format');
var debug = require('debug')('controllers/notifications');
var messageHandler = require('message_handler');
var notification = require('notification');
var _ = navigator.mozL10n.get;

function formatDate(date, fmt) {
  var ishour12 = /(h+)/.test(fmt);
    var o = {
    "M+" : date.getMonth()+1,
    "d+" : date.getDate(),
    "h+" : date.getHours()%12 == 0 ? 12 : date.getHours()%12,
    "H+" : date.getHours(),
    "m+" : date.getMinutes(),
    "s+" : date.getSeconds(),
    "q+" : Math.floor((date.getMonth()+3)/3),
    "S" : date.getMilliseconds()
    };
    var week = {
    "0" : "/u65e5",
    "1" : "/u4e00",
    "2" : "/u4e8c",
    "3" : "/u4e09",
    "4" : "/u56db",
    "5" : "/u4e94",
    "6" : "/u516d"
    };
    if(/(y+)/.test(fmt)){
        fmt=fmt.replace(RegExp.$1, (date.getFullYear()+"").substr(4 - RegExp.$1.length));
    }
    if(/(E+)/.test(fmt)){
        fmt=fmt.replace(RegExp.$1, ((RegExp.$1.length>1) ? (RegExp.$1.length>2 ? "/u661f/u671f" : "/u5468") : "")+week[date.getDay()+""]);
    }
    for(var k in o){
        if(new RegExp("("+ k +")").test(fmt)){
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
        }
    }
  if(ishour12) {
    fmt = fmt + (date.getHours() >= 12? " PM": " AM");
  }
    return fmt;
}

// Will be injected...
exports.app = null;

exports.observe = function() {
  debug('Will start notifications controller...');
  messageHandler.responder.on('alarm', exports.onAlarm);
};

exports.unobserve = function() {
  messageHandler.responder.off('alarm', exports.onAlarm);
};

exports.onAlarm = function(alarm) {
  debug('Will request cpu wake lock...');
  debug('Received cpu lock. Will issue notification...');
  return issueNotification(alarm).catch(err => {
    let lock = notification.lock;
    lock.unlock();
    notification.lock = null;
  }).then(() => {
    // release cpu lock with or without errors
    debug('Will release cpu wake lock...');
    let lock = notification.lock;
    lock.unlock();
    notification.lock = null;
  });
};

function prettyDateForCalendar(time, useCompactFormat, maxDiff) {
  var _ = navigator.mozL10n.get;

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
    // After exit the calendar application, it takes a few seconds to pull up 
    // the alarm event.
    secDiff = secDiff > 0 ? Math.ceil(secDiff) : Math.floor(secDiff - 30);
  }

  var today = new Date();
  today.setHours(0,0,0,0);
  var todayMidnight = today.getTime();
  var yesterdayMidnight = todayMidnight - 86400 * 1000;

  const thisyearTimestamp = 
        (new Date(today.getFullYear().toString())).getTime();
  // ex. 11:59 PM or 23:59
  const timeFormat = navigator.mozHour12 ? '%I:%M %p' : '%H:%M';

  if (time < thisyearTimestamp) {
    // before this year, ex. December 31, 2015 11:59 PM
    return dateFormat.localeFormat(new Date(time), '%B %e, %Y ' + timeFormat);
  } else if (time < yesterdayMidnight || 
             time >= todayMidnight + 86400 * 1000 * 3) {
    // before yesterday and in this year, ex. August 31, 11:59 PM
    return dateFormat.localeFormat(new Date(time), '%B %e, ' + timeFormat);
  } else if (time < todayMidnight) {
    // yesterday
    return _('days-ago-long', {value: 1}) + ', ' + 
           dateFormat.localeFormat(new Date(time), timeFormat);
  } else if (time >= todayMidnight + 86400 * 1000 * 2) {
    return _('days-until-long', {value: 2});
  } else if (time >= todayMidnight + 86400 * 1000) {
    return _('days-until-long', {value: 1});
  } else if (secDiff > 3600 * 4) {
    // today and before 4 hours
    return _('days-ago-long', {value: 0}) + ', ' + 
           dateFormat.localeFormat(new Date(time), timeFormat);
  } else {
    // in 4 hours
    var f = useCompactFormat ? '-short' : '-long';
    var parts = dateFormat.relativeParts(secDiff);

    var affix = secDiff >= 0 ? '-ago' : '-until';
    for (var i in parts) {
      return _(i + affix + f, { value: parts[i]});
    }
  }
}

function issueNotification(alarm) {
  var app = exports.app;
  var eventStore = app.store('Event');
  var busytimeStore = app.store('Busytime');

  var trans = app.db.transaction(['busytimes', 'events']);

  // Find the event and busytime associated with this alarm.
  return Promise.all([
    eventStore.get(alarm.eventId, trans),
    busytimeStore.get(alarm.busytimeId, trans)
  ]).then((values) => {
    var [event, busytime] = values;
    var _ = navigator.mozL10n.get;

    // just a safeguard on the very unlikely case that busytime or event
    // doesn't exist anymore (should be really hard to happen)
    if (!event) {
      throw new Error(`can't find event with ID: ${alarm.eventId}`);
    }
    if (!busytime) {
      throw new Error(`can't find busytime with ID: ${alarm.busytimeId}`);
    }

    var begins = calc.dateFromTransport(busytime.start);
    var ends = calc.dateFromTransport(busytime.end);
    var distance = '';
    var now = new Date();

    if (now > ends) {
      return;
    }

    if (event.remote.isAllDay) {
      distance = prettyDateForAlldayEvent(begins, ends, now, event);
    } else {
      distance = prettyDateForNotAlldayEvent(begins, ends, now, event);
    }

    var title = event.remote.title;
    debug('Will send event notification with title:', title, 'body:', distance);
    return notification.sendNotification(
      title,
      distance,
      `/alarm-display/${busytime._id}`
    );
  });
}

function prettyDateForAlldayEvent(begins, ends, now, event) {
  if (!event.remote.alarms) {
    return null;
  }

  let tomorrow = new Date(now.valueOf() + 24 * 60 * 60 *1000);
  let beginsDate = new Date(event.remote.startDate.valueOf());
  let endsDate = new Date(event.remote.endDate.valueOf() - 1);
  let nowDate = now.valueOf();
  let dateString = '';
  let timeFormat = '';
  let offset =
    event.remote.endDate.valueOf() - event.remote.startDate.valueOf();
  let oneDay =  24 * 60 * 60 * 1000;

  // today Today
  if (offset === oneDay &&
    nowDate <= event.remote.endDate.valueOf() &&
    nowDate >= event.remote.startDate.valueOf()) {
    dateString = _('today-all-day-event');
  // tomorrow Tomorrow
  } else if (offset === oneDay &&
    tomorrow <= event.remote.endDate.valueOf() &&
    tomorrow >= event.remote.startDate.valueOf()) {
    dateString = _('tomorrow-all-day-event');
  // May 10, 2021 - May 10, 2021
  } else if (begins.getFullYear() !== ends.getFullYear()) {
    timeFormat = '%b %e, %Y';
    dateString = _('event-notice-timeformat', {
      start: dateFormat.localeFormat(new Date(beginsDate), timeFormat),
      end: dateFormat.localeFormat(new Date(endsDate), timeFormat)
    });
  // Apr.10 - Apr.12
  } else {
    timeFormat = '%b.%e';
    dateString = _('event-notice-timeformat', {
      start: dateFormat.localeFormat(new Date(beginsDate), timeFormat),
      end: dateFormat.localeFormat(new Date(endsDate), timeFormat)
    });
  }

  return dateString;
}

function getPastTimeFormatThree(time, now) {
  let secDiff = (now.valueOf() - time.valueOf()) / 1000;
  if (isNaN(secDiff)) {
    return _('incorrectDate');
  }

  if (Math.abs(secDiff) > 60) {
    // round milliseconds up if difference is over 1 minute so the result is
    // closer to what the user would expect (1h59m59s300ms diff should return
    // "in 2 hours" instead of "in an hour")
    // After exit the calendar application, it takes a few seconds to pull up
    // the alarm event.
    secDiff = secDiff > 0 ? Math.ceil(secDiff) : Math.floor(secDiff - 30);
  }

  let today = new Date(now);
  today.setHours(0, 0, 0, 0);
  let todayMidnight = today.getTime();
  let yesterdayMidnight = todayMidnight - 86400 * 1000;
  let dateFormat = navigator.mozL10n.DateTimeFormat();
  const thisyearTimestamp =
    (new Date(today.getFullYear().toString())).getTime();

  if (time < thisyearTimestamp) {
    // before this year, ex. Wed, Dec 25, 2015
    return dateFormat.localeFormat(new Date(time), '%a, %b %e, %Y');
  /* eslint no-else-return: "off" */
  } else if (time < todayMidnight - 86400 * 1000 * 7) {
    // before a week ago, ex.  Sat, August 10
    return dateFormat.localeFormat(new Date(time), '%a, %B %e');
  } else if (time < yesterdayMidnight) {
    // before yesterday and in this week, ex. AM Wednesday
    return dateFormat.localeFormat(new Date(time), '%A');
  } else if (time < todayMidnight) {
    // Yesterday, 3:00 PM
    return _('days-ago-yesterday-single');
  } else {
    // today and before 4 hours ex. Today, 2:00 PM
    return _('days-ago-today-single');
  }
}

function prettyDateForNotAlldayEvent(begins, ends, now, event) {
  if (!event.remote.alarms) {
    return null;
  }

  let tomorrow = new Date(now.valueOf() + 24 * 60 * 60 *1000);
  let beginsDate = begins.valueOf();
  let endsDate = ends.valueOf();
  let nowDate = now.valueOf();
  let dateString = '';
  let timeFormat = navigator.mozHour12 ? '%I:%M %p' : '%H:%M';

  // May 10, 2021 5:30 PM - May 10, 2021 5:30 PM
  if (begins.getFullYear() !== ends.getFullYear()) {
    timeFormat = '%b %e, %Y ' + timeFormat;
    dateString = _('event-notice-timeformat', {
      start: dateFormat.localeFormat(new Date(beginsDate), timeFormat),
      end: dateFormat.localeFormat(new Date(endsDate), timeFormat)
    });
  // today 3:30 PM - 4:30 PM
  } else if (begins.getDate() === now.getDate() &&
    ends.getDate() === now.getDate() &&
    begins.getMonth() === now.getMonth() &&
    ends.getMonth() === now.getMonth()) {
    dateString = _('event-notice-timeformat', {
      start: dateFormat.localeFormat(new Date(beginsDate), timeFormat),
      end: dateFormat.localeFormat(new Date(endsDate), timeFormat)
    });
  // tomorrow Tomorrow, 3:00PM - 4:30 PM
  } else if (begins.getDate() === tomorrow.getDate() &&
    ends.getDate() === tomorrow.getDate() &&
    begins.getMonth() === tomorrow.getMonth() &&
    ends.getMonth() === tomorrow.getMonth() && nowDate < beginsDate) {
    dateString = _('tomorrow-event-notice-timeformat', {
      start: dateFormat.localeFormat(new Date(beginsDate), timeFormat),
      end: dateFormat.localeFormat(new Date(endsDate), timeFormat)
    });
  // Apr.10, 3:30 PM - Apr.12, 4:30 PM
  } else {
    timeFormat = '%b.%e, ' + timeFormat;
    dateString = _('event-notice-timeformat', {
      start: dateFormat.localeFormat(new Date(beginsDate), timeFormat),
      end: dateFormat.localeFormat(new Date(endsDate), timeFormat)
    });
  }

  return dateString;
}

function getPastTimeFormatTwo(time, now) {
  let _ = navigator.mozL10n.get;
  let secDiff = (now.valueOf() - time.valueOf()) / 1000;
  if (isNaN(secDiff)) {
    return _('incorrectDate');
  }

  if (Math.abs(secDiff) > 60) {
    // round milliseconds up if difference is over 1 minute so the result is
    // closer to what the user would expect (1h59m59s300ms diff should return
    // "in 2 hours" instead of "in an hour")
    // After exit the calendar application, it takes a few seconds to pull up
    // the alarm event.
    secDiff = secDiff > 0 ? Math.ceil(secDiff) : Math.floor(secDiff - 30);
  }

  let today = new Date(now);
  today.setHours(0,0,0,0);
  let todayMidnight = today.getTime();
  let yesterdayMidnight = todayMidnight - 86400 * 1000;

  const thisyearTimestamp =
        (new Date(today.getFullYear().toString())).getTime();
  // ex. 11:59 PM or 23:59
  const timeFormat = navigator.mozHour12 ? '%I:%M %p' : '%H:%M';

  if (time < thisyearTimestamp) {
    // before this year, ex.  Thu, Nov 4, 2014, 2:00 PM
    return dateFormat.localeFormat(new Date(time),
      `%a, %b %e, %Y, ${timeFormat}`);
  } else if (time < todayMidnight - 86400 * 1000 * 7) {
    // before a week ago, ex.  Sat, August 10, 2:00 PM
    return dateFormat.localeFormat(new Date(time),
      `%a, %B %e, ${timeFormat}`);
  } else if (time < yesterdayMidnight) {
    // before yesterday and in this week, ex. Thursday, 10:00 AM
    return dateFormat.localeFormat(new Date(time), `%A ${timeFormat}`);
  } else if (time < todayMidnight) {
    // Yesterday, 3:00 PM
    return _('days-ago-yesterday', {
      timeString: dateFormat.localeFormat(new Date(time), timeFormat)
    });
  } else if (secDiff > 3600 * 4) {
    // today and before 4 hours ex. Today, 2:00 PM
    return _('days-ago-today', {
      timeString: dateFormat.localeFormat(new Date(time), timeFormat)
    });
  } else {
    // in 4 hours
    let parts = dateFormat.relativeParts(secDiff);

    for (let i in parts) {
      return _(`${i}-ago-long`, { value: parts[i] });
    }
  }
}

function getGeneralTimeFormat(date, isAllDay) {
  let timeFormat = navigator.mozHour12 ? '%I:%M %p' : '%H:%M';
  timeFormat = isAllDay ? '%B %e' : `%B %e, ${timeFormat}`;

  // General Time Format ex. June 4, 2:30 PM
  return dateFormat.localeFormat(new Date(date), timeFormat);
}

function getNotificationBody(triggers, begins) {
  let reminderStr = '';
  let startDate = dateFormat.localeFormat(new Date(begins), '%Y/%m/%d');

  switch (triggers) {
    case 0:
      reminderStr = _('notice-now');
      break;
    case -300:
      reminderStr = _('notice-5-minutes-before');
      break;
    case -900:
      reminderStr = _('notice-15-minutes-before');
      break;
    case -1800:
      reminderStr = _('notice-30-minutes-before');
      break;
    case -3600:
      reminderStr = _('notice-1-hour-before');
      break;
    case -7200:
      reminderStr = _('notice-2-hours-before');
      break;
    case -86400:
      reminderStr = _('notice-1-day-before');
      break;
    case 32400:
      reminderStr = _('notice-on-day-event-all');
      break;
    case -54000:
      reminderStr = _('notice-1-day-before-all');
      break;
    case -140400:
      reminderStr = _('notice-2-day-before-all');
      break;
    case -572400:
      reminderStr = _('notice-weeks-before-all', {
        startDate: startDate
      });
      break;
    case -1177200:
      reminderStr = _('notice-weeks-before-all', {
        startDate: startDate
      });
      break;
    default:
      break;
  }

  return reminderStr;
}
});

define('object',['require','exports','module'],function(require, exports, module) {


exports.filter = function(obj, fn, thisArg) {
  var results = [];
  exports.forEach(obj, function(key, value) {
    if (fn.call(thisArg, key, value)) {
      results.push(value);
    }
  });

  return results;
};

exports.forEach = function(obj, fn, thisArg) {
  exports.map(obj, fn, thisArg);
};

exports.map = function(obj, fn, thisArg) {
  var results = [];
  Object.keys(obj).forEach((key) => {
    var value = obj[key];
    var result = fn.call(thisArg, key, value);
    results.push(result);
  });

  return results;
};

exports.values = function(obj) {
  return exports.map(obj, (key, value) => {
    return value;
  });
};

});

define('store/alarm',['require','exports','module','./abstract','calc','create_dom_promise','debug','promise','controllers/notifications','object'],function(require, exports, module) {


var Abstract = require('./abstract');
var Calc = require('calc');
var createDOMPromise = require('create_dom_promise');
var debug = require('debug')('store/alarm');
var denodeifyAll = require('promise').denodeifyAll;
var notificationsController = require('controllers/notifications');
var object = require('object');

/**
 * The alarm store can be thought of as a big queue.
 * Over time we add and remove alarm times related to
 * a specific busytime/event instance.
 * (and there could be multiple alarms per busytime/event).
 *
 * When `workQueue` is called records will be removed
 * from the queue (this object store) and added (via mozAlarms).
 */
function Alarm() {
  Abstract.apply(this, arguments);
  this._processQueue = this._processQueue.bind(this);

  denodeifyAll(this, [
    'findAllByBusytimeId',
    'workQueue'
  ]);
}
module.exports = Alarm;

Alarm.prototype = {
  __proto__: Abstract.prototype,

  _store: 'alarms',

  _dependentStores: ['alarms'],

  /**
   * Number of hours ahead of current time to add new alarms.
   *
   * @type Numeric
   */
  _alarmAddThresholdHours: 48,

  /** disable caching */
  _addToCache: function() {},
  _removeFromCache: function() {},

  /**
   * When false will not process queue automatically
   * (that is after each alarm transaction is complete).
   *
   * @type {Boolean}
   */
  autoQueue: false,

  _processQueue: function() {
    this.workQueue();
  },

  _objectData: function(object) {
    var data = Abstract.prototype._objectData.call(this, object);
    if (data.startDate) {
      // ensure the pending trigger is always in sync
      // with the current trigger whenever we update
      // the model.
      data.trigger = data.startDate;
    }

    return data;
  },

  /**
   * Manage the queue when alarms are added.
   */
  _addDependents: function(obj, trans) {
    if (!this.autoQueue) {
      return;
    }

    // by using processQueue even if we added
    // 6000 alarms during a single transaction we only
    // receive the event once as addEventListener discards
    // duplicates.
    trans.addEventListener('complete', this._processQueue);
  },

  /**
   * Move alarms over to the alarm api's database.
   *
   *
   * @param {Date} now date to use as current time.
   *
   * @param {Boolean} requiresAlarm attempts to ensure at
   *                                lest one alarm is added.
   *
   * @param {Function} callback node style callback.
   */
  _moveAlarms: function(now, requiresAlarm, callback) {
    // use transport dates so we can handle timezones & floating time.
    var time = Calc.dateToTransport(now);
    var utc = time.utc;
    // keep adding events until we are beyond this time.
    var minimum = utc + (this._alarmAddThresholdHours * Calc.HOUR);

    var request = this.db
      .transaction('alarms', 'readwrite')
      .objectStore('alarms')
      .index('trigger')
      .openCursor();

    request.onerror = function() {
      callback(new Error('Alarm cursor failed to open.'));
    };

    var past = [];  // Alarms that should be fired immediately.
    var future = [];  // Alarms that should fire in the future.
    request.onsuccess = function(event) {
      var cursor = event.target.result;
      if (!cursor ||
          (cursor.key >= minimum && (!requiresAlarm || future.length))) {
        // We've pulled all (or at least enough) alarms into memory.
        // Now we can send them to the notifications controller
        // or the alarms api.
        return dispatchAlarms(past, future)
        .then(callback)
        .catch(error => debug('Error dispatching alarms:', error));
      }

      var record = cursor.value;
      var date = Calc.dateFromTransport(record.trigger);
      var bucket = date < Date.now() ? past : future;
      bucket.push(record);
      // We need to save the trigger time so that we can send the
      // appropriate time to the alarms api. However, we want to mark
      // that we've handled this alarm so delete the trigger prop.
      record.triggered = record.trigger;
      delete record.trigger;
      cursor.update(record);
      cursor.continue();
    };
  },

  /**
   * Finds single alarm by busytime id.
   *
   * @param {Object} related busytime object.
   * @param {IDBTransaction} [trans] optional transaction.
   * @param {Function} callback node style [err, records].
   */
  findAllByBusytimeId: function(busytimeId, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = null;
    }

    if (!trans) {
      trans = this.db.transaction(this._dependentStores);
    }

    var store = trans.objectStore(this._store);
    var index = store.index('busytimeId');
    var key = IDBKeyRange.only(busytimeId);

    index.mozGetAll(key).onsuccess = function(e) {
      callback(null, e.target.result);
    };
  },

  /**
   * Works queue putting alarms into the alarm api database where needed.
   *
   */
  workQueue: function(now, callback) {
    if (typeof(now) === 'function') {
      callback = now;
      now = null;
    }

    now = now || new Date();
    var alarms = navigator.mozAlarms;

    if (!alarms) {
      if (callback) {
        callback(null);
      }

      return;
    }

    var self = this;
    var requiresAlarm = false;

    /**
     * Why are we getting all alarms here?
     *
     * The alarms are designed to keep the total number
     * of entires (in mozAlarms) down but we should keep at
     * minimum one active at all times. For example if the user
     * has sync turned off and wants notifications we need
     * to have an alarm go off to trigger adding more alarms.
     */
    var req = alarms.getAll();

    //XXX: even with the good reasons above we need
    //     to justify the perf cost here later.
    req.onsuccess = function(e) {
      var data = e.target.result;
      var len = data.length;
      var mozAlarm;

      requiresAlarm = true;

      for (var i = 0; i < len; i++) {
        mozAlarm = data[i].data;
        if (
          mozAlarm &&
          'eventId' in mozAlarm &&
          'trigger' in mozAlarm
        ) {
          requiresAlarm = false;
          break;
        }
      }

      callback = callback || function() {};
      self._moveAlarms(
        now,
        requiresAlarm,
        callback
      );
    };

    req.onerror = function() {
      var msg = 'failed to get alarms';
      console.error('CALENDAR:', msg);

      if (callback) {
        callback(new Error(msg));
      }
    };
  }
};

function dispatchAlarms(past, future) {
  // If the alarm was meant to be triggered in the past,
  // we want to immediately issue a notification.
  // However, in bug 857284 we add the stipulation that
  // we shouldn't issue duplicates, so handle that here also.
  var eventToAlarm = {};
  past.forEach(alarm => {
    var event = alarm.eventId;
    if (!event || event in eventToAlarm) {
      return;
    }

    eventToAlarm[event] = alarm;
  });

  object.forEach(eventToAlarm, (event, alarm) => {
    notificationsController.onAlarm(alarm);
  });

  // If the alarm should be triggered in the future, then we can create an
  // entry in the alarms api to wake us up to issue a notification for it
  // at the appropriate time.
  var alarms = navigator.mozAlarms;
  return Promise.all(future.map(alarm => {
    var timezone = alarm.triggered.tzid === Calc.FLOATING ?
      'ignoreTimezone' :
      'honorTimezone';
    return createDOMPromise(
      alarms.add(
        Calc.dateFromTransport(alarm.triggered),
        timezone,
        alarm
      )
    );
  }));
}

});

define('time_observer',['require','exports','module','timespan'],function(require, exports, module) {


var Timespan = require('timespan');

function TimeObserver() {
  this._timeObservers = [];
}
module.exports = TimeObserver;

TimeObserver.enhance = function(given) {
  var key;
  var proto = TimeObserver.prototype;
  for (key in proto) {
    if (proto.hasOwnProperty(key)) {
      given[key] = proto[key];
    }
  }
};

TimeObserver.prototype = {
 /**
   * Adds observer for timespan.
   *
   * Object example:
   *
   *    object.handleEvent = function(e) {
   *      // e.type
   *      // e.data
   *      // e.time
   *    }
   *
   *    // when given an object
   *    EventStore.observe(timespan, object)
   *
   *
   * Callback example:
   *
   *    EventStore.observe(timespan, function(event) {
   *      // e.type
   *      // e.data
   *      // e.time
   *    });
   *
   * @param {Calendar.Timespan} timespan span to observe.
   * @param {Function|Object} callback function or object follows
   *                                   EventTarget pattern.
   */
  observeTime: function(timespan, callback) {
    if (!(timespan instanceof Timespan)) {
      throw new Error(
        'must pass an instance of Timespan as first argument'
      );
    }
    this._timeObservers.push([timespan, callback]);
  },

  /**
   * Finds index of timespan/object|callback pair.
   *
   * Used internally and in tests has little practical use
   * unless you have the original timespan object.
   *
   * @param {Calendar.Timespan} timespan original (===) timespan used.
   * @param {Function|Object} callback original callback/object.
   * @return {Numeric} -1 when not found otherwise index.
   */
  findTimeObserver: function(timespan, callback) {
    var len = this._timeObservers.length;
    var field;
    var i = 0;

    for (; i < len; i++) {
      field = this._timeObservers[i];

      if (field[0] === timespan &&
          field[1] === callback) {

        return i;
      }
    }

    return -1;
  },

  /**
   * Removes a time observer you
   * must pass the same instance of both
   * the timespan and the callback/object
   *
   *
   * @param {Calendar.Timespan} timespan timespan object.
   * @param {Function|Object} callback original callback/object.
   * @return {Boolean} true when found & removed callback.
   */
  removeTimeObserver: function(timespan, callback) {
    var idx = this.findTimeObserver(timespan, callback);

    if (idx !== -1) {
      this._timeObservers.splice(idx, 1);
      return true;
    } else {
      return false;
    }
  },

  /**
   * Fires a time based event.
   *
   * @param {String} type name of event.
   * @param {Date|Numeric} start start position of time event.
   * @param {Date|Numeric} end end position of time event.
   * @param {Object} data data related to event.
   */
  fireTimeEvent: function(type, start, end, data) {
    var i = 0;
    var len = this._timeObservers.length;
    var observer;
    var event = {
      time: true,
      data: data,
      type: type
    };

    for (; i < len; i++) {
      observer = this._timeObservers[i];
      if (observer[0].overlaps(start, end)) {
        if (typeof(observer[1]) === 'object') {
          observer[1].handleEvent(event);
        } else {
          observer[1](event);
        }
      }
    }
  }
};

});

define('store/busytime',['require','exports','module','./abstract','calc','time_observer','binsearch','compare','promise'],function(require, exports, module) {


var Abstract = require('./abstract');
var Calc = require('calc');
var TimeObserver = require('time_observer');
var binsearch = require('binsearch');
var compare = require('compare');
var denodeifyAll = require('promise').denodeifyAll;

/**
 * Objects saved in the busytime store:
 *
 *    {
 *      _id: (uuid),
 *      start: Calendar.Calc.dateToTransport(x),
 *      end: Calendar.Calc.dateToTransport(x),
 *      eventId: eventId,
 *      calendarId: calendarId
 *    }
 *
 */
function Busytime() {
  Abstract.apply(this, arguments);
  this._setupCache();

  denodeifyAll(this, [
    'removeEvent',
    'loadSpan'
  ]);
}
module.exports = Busytime;

Busytime.prototype = {
  __proto__: Abstract.prototype,

  _store: 'busytimes',

  _dependentStores: ['alarms', 'busytimes'],

  _setupCache: function() {
    // reset time observers
    TimeObserver.call(this);

    this._byEventId = Object.create(null);
  },

  _createModel: function(input, id) {
    return this.initRecord(input, id);
  },

  initRecord: function(input, id) {
    var _super = Abstract.prototype._createModel;
    var model = _super.apply(this, arguments);
    model.startDate = Calc.dateFromTransport(model.start);
    model.endDate = Calc.dateFromTransport(model.end);
    return model;
  },

  _removeDependents: function(id, trans) {
    this.db.getStore('Alarm').removeByIndex('busytimeId', id, trans);
  },

  removeEvent: function(id, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }

    if (typeof(trans) === 'undefined') {
      trans = this.db.transaction(
        this._dependentStores,
        'readwrite'
      );
    }

    // build the request using the inherited method
    var req = this.removeByIndex('eventId', id, trans);

    // get the original method which handles the generic bit
    var success = req.onsuccess;

    // override the default .onsuccess to get the ids
    // so we can emit remove events.
    var self = this;
    req.onsuccess = function(e) {
      var cursor = e.target.result;

      if (cursor) {
        var id = cursor.primaryKey;
        self.emit('remove', id);
      }

      success(e);
    };

    this._transactionCallback(trans, callback);
  },

  _startCompare: function(aObj, bObj) {
    var a = aObj.start.utc;
    var b = bObj.start.utc;
    return compare(a, b);
  },

  /**
   * Loads all busytimes in given timespan.
   *
   * @param {Calendar.Timespan} span timespan.
   * @param {Function} callback node style callback
   *                            where first argument is
   *                            an error (or null)
   *                            and the second argument
   *                            is a list of all loaded
   *                            busytimes in the timespan.
   */
  loadSpan: function(span, callback, resolve) {
    var trans = this.db.transaction(this._store);
    var store = trans.objectStore(this._store);

    var startPoint = Calc.dateToTransport(new Date(span.start));
    var endPoint = Calc.dateToTransport(new Date(span.end));

    // XXX: we need to implement busytime chunking
    // to make this efficient.
    var keyRange = IDBKeyRange.lowerBound(startPoint.utc);

    var index = store.index('end');
    var self = this;

    index.mozGetAll(keyRange).onsuccess = function(e) {
      var data = e.target.result;

      // sort data
      data = data.sort(self._startCompare);

      // attempt to find a start time that occurs
      // after the end time of the span
      var idx = binsearch.insert(
        data,
        { start: { utc: endPoint.utc + 1 } },
        self._startCompare
      );

      // remove unrelated timespan...
      data = data.slice(0, idx);

      // fire callback
      if (callback) {
        callback(null, data.map(function(item) {
          return self.initRecord(item);
        }), resolve);
      }

    };
  },

  /* we don't use id based caching for busytimes */

  _addToCache: function() {},
  _removeFromCache: function() {}

};

});

define('models/calendar',['require','exports','module'],function(require, exports, module) {


function Cal(options) {
  if (typeof(options) === 'undefined') {
    options = {};
  }

  this.remote = {};

  for (var key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key];
    }
  }
}
module.exports = Cal;

Cal.prototype = {

  /**
   * Local copy of calendars remote state.
   * Taken from a calendar providers .toJSON method.
   *
   * @type {Object}
   */
  remote: null,

  /**
   * The date at which this calendar's events
   * where synchronized.
   *
   * @type {Date}
   */
  firstEventSyncDate: null,

  /**
   * Last sync token used in previous
   * event synchronization.
   *
   * @type {String}
   */
  lastEventSyncToken: '',

  /**
   * Last date of event synchronization.
   * This is not going to be used
   * for any kind of serious operation
   * right now this is just for the UI.
   *
   * @type {Date}
   */
  lastEventSyncDate: '',

  /**
   * Indicates if calendar is displayed
   * locally in the ui.
   *
   * @type {Boolean}
   */
  localDisplayed: true,

  /**
   * Id of account this record
   * is associated with.
   */
  accountId: '',

  /**
   * Updates remote with data from a calendar provider.
   *
   * @param {Calendar.Provider.Calendar.Abstract} provider remote.
   */
  updateRemote: function(provider) {
    var data = provider;
    if ('toJSON' in provider) {
        data = provider.toJSON();
    }

    this.remote = data;
  },

  /**
   * Checks if local and remote state differ
   * via sync tokens. Returns true when
   * local sync token and remote do not match.
   * Does not account for local changes only
   * when the server state has changed
   * and we have not yet synchronized.
   *
   * @return {Boolean} true when sync needed.
   */
  eventSyncNeeded: function() {
    var local = this.lastEventSyncToken;
    var remote = this.remote.syncToken;

    return local != remote;
  },

  set name(name) {
    this.remote.name = name;
    return this.remote.name;
  },

  set color(color) {
    this.remote.color = color;
    return this.remote.color;
  },

  set description(description) {
    this.remote.description = description;
    return this.remote.description;
  },

  get name() {
    return this.remote.name;
  },

  get color() {
    var color = this.remote.color;
    if (color) {
      if (color.substr(0, 1) === '#') {
        return color.substr(0, 7);
      }
    }
    return this.remote.color;
  },

  get description() {
    return this.remote.description;
  },

  toJSON: function() {
    var result = {
      error: this.error,
      remote: this.remote,
      accountId: this.accountId,
      localDisplayed: this.localDisplayed,
      lastEventSyncDate: this.lastEventSyncDate,
      lastEventSyncToken: this.lastEventSyncToken,
      firstEventSyncDate: this.firstEventSyncDate
    };

    if (this._id || this._id === 0) {
      result._id = this._id;
    }

    return result;
  }

};

});

define('store/calendar',['require','exports','module','./abstract','models/calendar','provider/local','promise','probably_parse_int','provider/provider_factory'],function(require, exports, module) {


var Abstract = require('./abstract');
var CalendarModel = require('models/calendar');
var Local = require('provider/local');
var denodeifyAll = require('promise').denodeifyAll;
var probablyParseInt = require('probably_parse_int');
var providerFactory = require('provider/provider_factory');

function Store() {
  Abstract.apply(this, arguments);
  this._usedColors = [];

  denodeifyAll(this, [
    'markWithError',
    'remotesByAccount',
    'sync',
    'providerFor',
    'ownersOf'
  ]);
}
module.exports = Store;

/**
 * Remote calendar colors
 */
Store.REMOTE_COLORS = [
  '#f53d16',
  '#644237',
  '#8c8c8c',
  '#4f6a79',
  '#e82928',
  '#da0051',
  '#af0779',
  '#840fa2',
  '#5026aa',
  '#2f3da7',
  '#2383f2',
  '#1e98f2',
  '#25afca',
  '#1e8675',
  '#47a13a',
  '#7eb832',
  '#c3d51c',
  '#fde61b',
  '#fab200'
];

/**
 * Local calendar color (orange)
 */
Store.LOCAL_COLOR =
  getComputedStyle(document.documentElement).getPropertyValue('--color-orange'),

/**
 * List of possible calendar capabilities.
 */
Store.capabilities = {
  createEvent: 'canCreateEvent',
  updateEvent: 'canUpdateEvent',
  deleteEvent: 'canDeleteEvent'
};

Store.prototype = {
  __proto__: Abstract.prototype,

  _store: 'calendars',

  _dependentStores: [
    'calendars', 'events', 'busytimes',
    'alarms', 'icalComponents'
  ],

  _parseId: probablyParseInt,

  _createModel: function(obj, id) {
    if (!(obj instanceof CalendarModel)) {
      obj = new CalendarModel(obj);
    }

    if (typeof(id) !== 'undefined') {
      obj._id = id;
    }

    return obj;
  },

  _removeDependents: function(id, trans) {
    var store = this.db.getStore('Event');
    store.removeByIndex('calendarId', id, trans);
  },

  /**
   * Marks a given calendar with an error.
   *
   * Emits a 'error' event immediately.. This method is typically
   * triggered by an account wide error.
   *
   *
   * @param {Object} calendar model.
   * @param {Calendar.Error} error for given calendar.
   * @param {IDBTransaction} transaction optional.
   * @param {Function} callback fired when model is saved [err, id, model].
   */
  markWithError: function(calendar, error, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = null;
    }

    if (!calendar._id) {
      throw new Error('given calendar must be persisted.');
    }

    calendar.error = {
      name: error.name,
      date: new Date()
    };

    this.persist(calendar, trans, callback);
  },

  persist: function(calendar, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = undefined;
    }

    this._updateCalendarColor(calendar);

    var cb = callback;
    var cached = this._cached[calendar._id];

    if (cached && cached.localDisplayed !== calendar.localDisplayed) {
      cb = function(err, id, model) {
        this.emit('calendarVisibilityChange', id, model);
        callback(err, id, model);
      }.bind(this);
    }

    Abstract.prototype.persist.call(this, calendar, trans, cb);
  },

  remove: function(id, trans, callback) {
    this._removeCalendarColorFromCache(id);
    Abstract.prototype.remove.apply(this, arguments);
  },

  _updateCalendarColor: function(calendar) {
    // we avoid storing multiple colors for same calendar in case of an
    // "update" operation
    this._removeCalendarColorFromCache(calendar._id);
    this._setCalendarColor(calendar);
    // cache is built asynchronously, we need to store the color as soon as
    // possible to avoid adding same color multiple times in a row (eg.
    // account with multiple calendars will call persist multiple times)
    this._usedColors.push(calendar.color);
  },

  _removeCalendarColorFromCache: function(id) {
    // we need to remove the color from index as soon as possible to avoid
    // race conditions (remove is async)
    var color = this.getColorByCalendarId(id);
    var index = this._usedColors.indexOf(color);
    if (index !== -1) {
      this._usedColors.splice(index, 1);
    }
  },

  getColorByCalendarId: function(id) {
    return this._cached[id] && this._cached[id].color;
  },

  _setCalendarColor: function(calendar) {
    // local calendar should always use the same color
    if (calendar._id === Local.calendarId) {
      calendar.color = Store.LOCAL_COLOR;
      return;
    }

    // restore previous color only if it is part of the palette, otherwise we
    // get the next available color (or least used)
    var prevColor = this.getColorByCalendarId(calendar._id);
    if (prevColor && Store.REMOTE_COLORS.indexOf(prevColor) !== -1) {
      calendar.color = prevColor;
    } else {
      calendar.color = this._getNextColor();
    }
  },

  _getNextColor: function() {
    var available = Store.REMOTE_COLORS.filter(function(color) {
      return this._usedColors.indexOf(color) === -1;
    }, this);

    return available.length ? available[0] : this._getLeastUsedColor();
  },

  _getLeastUsedColor: function() {
    var counter = {};
    this._usedColors.forEach(function(color) {
      counter[color] = (counter[color] || 0) + 1;
    });

    var leastUsedColor;
    var leastUsedCount = Infinity;
    for (var color in counter) {
      if (counter[color] < leastUsedCount) {
        leastUsedCount = counter[color];
        leastUsedColor = color;
      }
    }

    return leastUsedColor;
  },

  shouldDisplayCalendar: function(calendarId) {
    var calendar = this._cached[calendarId];
    return calendar && calendar.localDisplayed;
  },

  /**
   * Find calendars in a specific account.
   * Results will be returned in an object where
   * the key is the remote.id and the value is the calendar.
   *
   * @param {String|Numeric} accountId id of account.
   * @param {Function} callback [err, object] see above.
   */
  remotesByAccount: function(accountId, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = null;
    }

    if (!trans) {
      trans = this.db.transaction(this._store);
    }

    var store = trans.objectStore(this._store);

    var reqKey = IDBKeyRange.only(accountId);
    var req = store.index('accountId').mozGetAll(reqKey);

    req.onerror = function remotesError(e) {
      callback(e.target.error);
    };

    var self = this;
    req.onsuccess = function remotesSuccess(e) {
      var result = Object.create(null);
      e.target.result.forEach(function(calendar) {
        result[calendar.remote.id] = self._createModel(
          calendar,
          calendar._id
        );
      });

      callback(null, result);
    };
  },

  /**
   * Sync remote and local events for a calendar.
   *
   * TODO: Deprecate use of this function in favor of a sync methods
   *       inside of providers.
   */
  sync: function(account, calendar, callback) {
    var provider = providerFactory.get(account.providerType);
    provider.syncEvents(account, calendar, callback);
  },

  /**
   * Shortcut to find provider for calendar.
   *
   * @param {Calendar.Models.Calendar} calendar input calendar.
   * @param {Function} callback [err, provider].
   */
  providerFor: function(calendar, callback) {
    this.ownersOf(calendar, function(err, owners) {
      if (err) {
        return callback(err);
      }

      callback(null, providerFactory.get(owners.account.providerType));
    });
  },

  /**
   * Finds calendar/account for a given event.
   *
   * TODO: think about moving this function into its
   * own file as a mixin.
   *
   * @param {Object|String|Numeric} objectOrId must contain .calendarId.
   * @param {Function} callback [err, { ... }].
   */
  ownersOf: function(objectOrId, callback) {
    var result = {};

    var accountStore = this.db.getStore('Account');

    // case 1. given a calendar
    if (objectOrId instanceof CalendarModel) {
      result.calendar = objectOrId;
      accountStore.get(objectOrId.accountId, fetchAccount);
      return;
    }

    // case 2 given a calendar id or object

    if (typeof(objectOrId) === 'object') {
      objectOrId = objectOrId.calendarId;
    }

    // why??? because we use this method in event store too..
    var calendarStore = this.db.getStore('Calendar');
    calendarStore.get(objectOrId, fetchCalendar);

    function fetchCalendar(err, calendar) {
      if (err) {
        return callback(err);
      }

      result.calendar = calendar;
      accountStore.get(calendar.accountId, fetchAccount);
    }

    function fetchAccount(err, account) {
      if (err) {
        return callback(err);
      }

      result.account = account;
      callback(null, result);
    }
  }
};

});

define('store/event',['require','exports','module','./abstract','calc','./calendar','promise','provider/provider_factory'],function(require, exports, module) {


var Abstract = require('./abstract');
var Calc = require('calc');
var Calendar = require('./calendar');
var denodeifyAll = require('promise').denodeifyAll;
var providerFactory = require('provider/provider_factory');

function Events() {
  Abstract.apply(this, arguments);

  denodeifyAll(this, [
    'providerFor',
    'findByIds',
    'ownersOf',
    'eventsForCalendar'
  ]);
}
module.exports = Events;

Events.prototype = {
  __proto__: Abstract.prototype,
  _store: 'events',
  _dependentStores: ['events', 'busytimes', 'alarms', 'icalComponents'],

  /** disable caching */
  _addToCache: function() {},
  _removeFromCache: function() {},

  _createModel: function(input, id) {
    var _super = Abstract.prototype._createModel;
    var model = _super.apply(this, arguments);
    model.remote.startDate = Calc.dateFromTransport(model.remote.start);
    model.remote.endDate = Calc.dateFromTransport(model.remote.end);
    return model;
  },

  /**
   * Link busytime dependants see _addDependents.
   */
  _removeDependents: function(id, trans) {
    this.removeByIndex('parentId', id, trans);

    var busy = this.db.getStore('Busytime');
    busy.removeEvent(id, trans);

    var component = this.db.getStore('IcalComponent');
    component.remove(id, trans);
  },

  /**
   * Generate an id for a newly created record.
   * Based off of remote id (uuid) and calendar id.
   */
  _assignId: function(obj) {
    var id = obj.calendarId + '-' + obj.remote.id;
    obj._id = id;
    return id;
  },

  /**
   * Shortcut finds provider for given event.
   *
   * @param {Object} event full event record from db.
   */
  providerFor: function(event, callback) {
    this.ownersOf(event, function(err, owners) {
      callback(null, providerFactory.get(owners.account.providerType));
    });
  },

  /**
   * Finds a list of events by id.
   *
   * @param {Array} ids list of ids.
   * @param {Function} callback node style second argument
   *                            is an object of _id/event.
   */
  findByIds: function(ids, callback) {
    var results = {};
    var pending = ids.length;
    var self = this;

    if (!pending) {
      callback(null, results);
    }

    function next() {
      if (!(--pending)) {
        // fatal errors should break
        // and so we are not handling them
        // here...
        callback(null, results);
      }
    }

    function success(e) {
      var item = e.target.result;

      if (item) {
        results[item._id] = self._createModel(item);
      }

      next();
    }

    function error() {
      // can't find it or something
      // skip!
      next();
    }

    ids.forEach(function(id) {
      var trans = this.db.transaction('events');
      var store = trans.objectStore('events');
      var req = store.get(id);

      req.onsuccess = success;
      req.onerror = error;
    }, this);
  },

  /**
   * Finds calendar/account for a given event.
   *
   * @param {Object} event must contain .calendarId.
   * @param {Function} callback [err, { ... }].
   */
  ownersOf: Calendar.prototype.ownersOf,
  /**
   * Loads all events for given calendarId
   * and returns results. Does not cache.
   *
   * @param {String} calendarId calendar to find.
   * @param {Function} callback node style [err, array of events].
   */
  eventsForCalendar: function(calendarId, callback) {
    var trans = this.db.transaction('events');
    var store = trans.objectStore('events');
    var index = store.index('calendarId');
    var key = IDBKeyRange.only(calendarId);

    var req = index.mozGetAll(key);

    req.onsuccess = function(e) {
      callback(null, e.target.result);
    };

    req.onerror = function(e) {
      callback(e);
    };
  }
};

});

define('store/ical_component',['require','exports','module','./abstract','calc','promise'],function(require, exports, module) {


var Abstract = require('./abstract');
var Calc = require('calc');
var denodeifyAll = require('promise').denodeifyAll;

function IcalComponent() {
  Abstract.apply(this, arguments);

  denodeifyAll(this, [
    'findRecurrencesBefore'
  ]);
}
module.exports = IcalComponent;

IcalComponent.prototype = {
  __proto__: Abstract.prototype,

  _store: 'icalComponents',

  _dependentStores: ['icalComponents'],

  /** disable caching */
  _addToCache: function() {},
  _removeFromCache: function() {},

  _createModel: function(object) {
    return object;
  },

  _detectPersistType: function(object) {
    // always fire update.
    return 'update';
  },

  /**
   * Finds all components which have recurrences
   * that are not expanded beyond the given date.
   *
   * @param {Date} maxDate max date to find.
   * @param {Function} callback results of search [err, [icalComp, ...]].
   */
  findRecurrencesBefore: function(maxDate, callback) {
    var trans = this.db.transaction(this._store, 'readwrite');

    trans.onerror = function(event) {
      callback(event.target.error.name);
    };

    var time = Calc.dateToTransport(maxDate);
    var utc = time.utc;
    // When utc is negative, avoid IDBKeyRange.bound(0, utc) from reporting an error
    var range = utc < 0 ? IDBKeyRange.upperBound(0, true) : IDBKeyRange.bound(0, utc);
    var store = trans.objectStore(this._store);
    var idx = store.index('lastRecurrenceId');

    var req = idx.mozGetAll(range);

    req.onsuccess = function(event) {
      callback(null, event.target.result);
    };
  }
};

});

define('store/setting',['require','exports','module','./abstract','promise','next_tick'],function(require, exports, module) {


var Abstract = require('./abstract');
var denodeifyAll = require('promise').denodeifyAll;
var nextTick = require('next_tick');

function Setting() {
  Abstract.apply(this, arguments);
  denodeifyAll(this, [
    'getValue',
    'set'
  ]);
}
module.exports = Setting;

Setting.prototype = {
  __proto__: Abstract.prototype,

  _store: 'settings',

  /**
   * Default option values.
   */
  defaults: {
    standardAlarmDefault: -300,
    alldayAlarmDefault: 32400,
    syncFrequency: 30,
    syncAlarm: {
      alarmId: null,
      start: null,
      end: null
    }
  },

  /** disable caching */
  _addToCache: function() {},
  _removeFromCache: function() {},

  /**
   * This method also will use the internal cache to ensure
   * callers are in a consistent state and don't require round
   * trips to the database. When the value does not exist defaults
   * are used where possible...
   *
   *
   *    settings.getValue('syncFrequency', function(err, value) {
   *      // ...
   *    });
   *
   *
   * @param {String} key name of setting.
   * @param {Function} callback usual [err, value] does not include metadata.
   */
  getValue: function(key, callback) {
    var self = this;

    if (key in this._cached) {
      nextTick(function handleCached() {
        callback(null, self._cached[key].value);
      });

      // we have cached value exit...
      return;
    }

    this.get(key, function handleStored(err, value) {
      if (err) {
        return callback(err);
      }

      if (value === undefined) {
        if (self.defaults[key] !== undefined) {
          value = { value: self.defaults[key] };
          self._cached[key] = value;
          return callback(null, value.value);
        } else {
          return callback(new Error('Can not get value with ' + key));
        }
      } else {
        self._cached[key] = value;
        return callback(null, value.value);
      }
    });
  },

  /**
   * Persist a setting change.
   *
   * In addition to updating the value of the setting
   * it will also update the updatedAt & createdAt properties
   * of the record.
   *
   * Calling this function will also emit a 'change' event
   * prior to fully persisting the record to the database.
   *
   * Example:
   *
   *    var settingStore;
   *
   *    settingStore.set('syncFrequency', 15, function() {
   *      // done
   *    });
   *
   *    // somewhere else in the app:
   *
   *    settingStore.on('syncFrequencyChange', function(value) {
   *      // value === 15
   *    });
   *
   * @param {String} key name of setting.
   * @param {Object} value any object that IndexedDb can store.
   * @param {IDBTransaction} [trans] idb transaction optional.
   * @param {Function} [callback] optional callback.
   */
  set: function(key, value, trans, callback) {
    if (typeof(trans) === 'function') {
      callback = trans;
      trans = null;
    }

    var cached = this._cached[key];
    var record;

    if (cached && cached._id) {
      cached.value = value;
      cached.updatedAt = new Date();
      record = cached;
    } else {
      var created = new Date();
      this._cached[key] = record = {
        _id: key,
        createdAt: created,
        updatedAt: created,
        value: value
      };
    }

    this.emit(key + 'Change', value, record);
    this.persist(record, trans, callback);
  }

};

});

define('store/store',['require','exports','module','./abstract','./account','./alarm','./busytime','./calendar','./event','./ical_component','./setting'],function(require, exports) {


exports.Abstract = require('./abstract');
exports.Account = require('./account');
exports.Alarm = require('./alarm');
exports.Busytime = require('./busytime');
exports.Calendar = require('./calendar');
exports.Event = require('./event');
exports.IcalComponent = require('./ical_component');
exports.Setting = require('./setting');

});

/* jshint loopfunc: true */
define('db',['require','exports','module','models/account','presets','provider/local','responder','store/store','debug','next_tick','probably_parse_int','ext/uuid'],function(require, exports, module) {


var Account = require('models/account');
var Presets = require('presets');
var Local = require('provider/local');
var Responder = require('responder');
var Store = require('store/store');
var debug = require('debug')('db');
var nextTick = require('next_tick');
var probablyParseInt = require('probably_parse_int');
var uuid = require('ext/uuid');

var idb = window.indexedDB;

const VERSION = 15;

var store = Object.freeze({
  events: 'events',
  accounts: 'accounts',
  calendars: 'calendars',
  busytimes: 'busytimes',
  settings: 'settings',
  alarms: 'alarms',
  icalComponents: 'icalComponents'
});

function Db(name, app) {
  this.app = app;
  this.name = name;
  this._stores = Object.create(null);
  Responder.call(this);
  this._upgradeOperations = [];
}
module.exports = Db;

Db.prototype = {
  __proto__: Responder.prototype,

  /**
   * Database connection
   */
  connection: null,

  getStore: function(name) {
    if (!(name in this._stores)) {
      try {
        this._stores[name] = new Store[name](this, this.app);
      } catch (e) {
        console.error('Error', e.name, e.message);
        console.error('Failed to load store', name, e.stack);
      }
    }

    return this._stores[name];
  },

  load: function(callback) {
    debug('Will load b2g-calendar db.');

    var self = this;
    function setupDefaults() {
      if (self.oldVersion < 8) {
        self._setupDefaults(callback);
      } else {
        nextTick(callback);
      }
    }

    if (this.isOpen) {
      return setupDefaults();
    }
    this.open(VERSION, setupDefaults);
  },


  /**
   * Opens connection to database.
   *
   * @param {Numeric} [version] version of database to open.
   *                            default to current version.
   *                            Should _only_ be used in testing.
   *
   * @param {Function} [callback] first argument is error, second
   *                            is result of operation or null
   *                            in the error case.
   */
  open: function(version, callback) {
    if (typeof(version) === 'function') {
      callback = version;
      version = VERSION;
    }

    var req = idb.open(this.name, version);
    this.version = version;

    var self = this;

    req.onsuccess = function() {
      self.isOpen = true;
      self.connection = req.result;

      // if we have pending upgrade operations
      if (self._upgradeOperations.length) {
        var pending = self._upgradeOperations.length;

        var operation;
        while ((operation = self._upgradeOperations.shift())) {
          operation.call(self, function next() {
            if (!(--pending)) {
              callback(null, self);
              self.emit('open', self);
            }
          });
        }
      } else {
        callback(null, self);
        self.emit('open', self);
      }
    };

    req.onblocked = function(error) {
      callback(error, null);
      self.emit('error', error);
    };

    req.onupgradeneeded = function(event) {
      self._handleVersionChange(req.result, event);
    };

    req.onerror = function(error) {
      //TODO: steal asuth's error handling...
      window.close();
      callback(error, null);
      self.emit('error', error);
    };
  },

  transaction: function(list, state) {
    var names;
    var self = this;

    if (typeof(list) === 'string') {
      names = [];
      names.push(this.store[list] || list);
    } else {
      names = list.map(function(name) {
        return self.store[name] || name;
      });
    }

    return this.connection.transaction(names, state || 'readonly');
  },

  _handleVersionChange: function(db, event) {
    var newVersion = event.newVersion;
    var curVersion = event.oldVersion;
    var transaction = event.currentTarget.transaction;

    this.hasUpgraded = true;
    this.oldVersion = curVersion;
    this.upgradedVersion = newVersion;

    for (; curVersion < newVersion; curVersion++) {
      // if version is < 7 then it was from pre-production
      // db and we can safely discard its information.
      if (curVersion < 6) {
        // ensure clean state if this was an old db.
        var existingNames = db.objectStoreNames;
        for (var i = 0; i < existingNames.length; i++) {
          db.deleteObjectStore(existingNames[i]);
        }

        // version 0-r are not maintained increment to 6
        curVersion = 6;

        // busytimes has one event, has one calendar
        var busytimes = db.createObjectStore(
          store.busytimes,
          { keyPath: '_id' }
        );

        busytimes.createIndex(
          'end',
          'end.utc',
          { unique: false, multiEntry: false }
        );

        busytimes.createIndex(
          'eventId',
          'eventId',
          { unique: false, multiEntry: false }
        );

        // events -> belongs to calendar
        var events = db.createObjectStore(
          store.events,
          { keyPath: '_id' }
        );

        events.createIndex(
          'calendarId',
          'calendarId',
          { unique: false, multiEntry: false }
        );

        events.createIndex(
          'parentId',
          'parentId',
          { unique: false, multiEntry: false }
        );

        // accounts -> has many calendars
        db.createObjectStore(
          store.accounts, { keyPath: '_id', autoIncrement: true }
        );

        // calendars -> has many events
        db.createObjectStore(
          store.calendars, { keyPath: '_id', autoIncrement: true }
        );

      } else if (curVersion === 7) {
        db.createObjectStore(store.settings, { keyPath: '_id' });
      } else if (curVersion === 8) {
        var alarms = db.createObjectStore(
          store.alarms, { keyPath: '_id', autoIncrement: true }
        );

        alarms.createIndex(
          'trigger',
          'trigger.utc',
          { unique: false, multiEntry: false }
        );

        alarms.createIndex(
          'busytimeId',
          'busytimeId',
          { unique: false, multiEntry: false }
        );
     } else if (curVersion === 12) {
        var icalComponents = db.createObjectStore(
          store.icalComponents, { keyPath: 'eventId', autoIncrement: false }
        );

        icalComponents.createIndex(
          'lastRecurrenceId',
          'lastRecurrenceId.utc',
          { unique: false, multiEntry: false }
        );
      } else if (curVersion === 13) {
        var calendarStore = transaction.objectStore(store.calendars);
        calendarStore.createIndex(
          'accountId', 'accountId', { unique: false, multiEntry: false }
        );
      } else if (curVersion === 14) {
        // Bug 851003 - The database may have some busytimes and/or events
        // which have their calendarId field as a string rather than an int.
        // We need to fix the calendarIds and also remove any of the idb
        // objects that have deleted calendars.
        this.sanitizeEvents(transaction);
      }
    }
  },

  /**
   * 1. Find all events with string calendar ids and index them.
   * 2. Check for each of the events whether the calendar
   *    they reference still exists.
   * 3. Fix the events' calendarIds if the calendar still exists else
   *    delete them.
   * @param {IDBTransaction} trans The active idb transaction during db
   *     upgrade.
   */
  sanitizeEvents: function(trans) {
    /**
     * Map from calendar ids to lists of event ids
     * which we've fixed with that id.
     * @type {Object.<number, Array.<number>>}
     */
    var badCalendarIdToEventIds = {};

    var objectStore = trans.objectStore(store.events);
    objectStore.openCursor().onsuccess = (function(evt) {
      var cursor = evt.target.result;
      if (!cursor) {
        return this._updateXorDeleteEvents(badCalendarIdToEventIds, trans);
      }

      var calendarId = cursor.value.calendarId;
      if (typeof(calendarId) === 'number') {
        // Nothing to do here!
        return cursor.continue();
      }

      // Record the bad reference.
      var eventIds = badCalendarIdToEventIds[calendarId] || [];
      eventIds.push(cursor.key);
      badCalendarIdToEventIds[calendarId] = eventIds;
      cursor.continue();
    }).bind(this);
  },

  /**
   * 1. Check for each of the events whether the calendar
   *    they reference still exists.
   * 2. Fix the events' calendarIds if the calendar still exists else
   *    delete them.
   *
   * @param {Object.<number, Array.<number>>} badCalendarIdToEventIds Map
   *     from calendar ids to lists of event ids which we've fixed with
   *     that id.
   * @param {IDBTransaction} trans The active idb transaction during db
   *     upgrade.
   * @private
   */
  _updateXorDeleteEvents: function(badCalendarIdToEventIds, trans) {
    var calendarIds = Object.keys(badCalendarIdToEventIds);
    calendarIds.forEach(function(calendarId) {
      //Bug 887698 cases for calendarIds of types strings or integers
      calendarId = probablyParseInt(calendarId);
      var eventIds = badCalendarIdToEventIds[calendarId];
      var calendars = trans.objectStore(store.calendars);
      calendars.get(calendarId).onsuccess = (function(evt) {
        var result = evt.target.result;
        if (result) {
          this._updateEvents(eventIds, calendarId, trans);
        } else {
          this._deleteEvents(eventIds, trans);
        }
      }).bind(this);
    }, this);
  },

  /**
   * Update a collection of events and the busytimes that depend on them.
   *
   * @param {Array.<number>>} eventIds An array of event ids for the events.
   * @param {number} calendarId A numerical id to set as calendarId.
   * @param {IDBTransaction} trans The active idb transaction during db
   *     upgrade.
   * @private
   */
  _updateEvents: function(eventIds, calendarId, trans) {
    var eventStore = trans.objectStore(store.events);
    var busytimeStore = trans.objectStore(store.busytimes);
    var busytimeStoreIndexedByEventId = busytimeStore.index('eventId');

    eventIds.forEach(function(eventId) {
      eventStore.get(eventId).onsuccess = function(evt) {
        var result = evt.target.result;
        result.calendarId = calendarId;
        eventStore.put(result);
      };

      busytimeStoreIndexedByEventId.get(eventId).onsuccess = function(evt) {
        var result = evt.target.result;
        result.calendarId = calendarId;
        busytimeStore.put(result);
      };
    });
  },

  /**
   * Delete a collection of events and the busytimes that depend on them.
   *
   * @param {Array.<number>>} eventIds An array of event ids for the events.
   * @param {IDBTransaction} trans The active idb transaction during db
   *     upgrade.
   * @private
   */
  _deleteEvents: function(eventIds, trans) {
    var events = this.getStore('Event');
    eventIds.forEach(function(eventId) {
      events.remove(eventId, trans);
    });
  },

  get store() {
    return store;
  },

  /**
   * Shortcut method for connection.close
   */
  close: function() {
    if (this.connection) {
      this.isOpen = false;
      this.connection.close();
      this.connection = null;
    }
  },

  clearNonCredentials: function(callback) {
    var stores = ['events', 'busytimes'];
    var trans = this.transaction(
      stores,
      'readwrite'
    );

    trans.addEventListener('complete', callback);

    stores.forEach(function(store) {
      store = trans.objectStore(store);
      store.clear();
    });
  },

  /**
   * Setup default values for initial calendar load.
   */
  _setupDefaults: function(callback) {
    debug('Will setup defaults.');
    var calendarStore = this.getStore('Calendar');
    var accountStore = this.getStore('Account');

    var trans = calendarStore.db.transaction(
      ['accounts', 'calendars'],
      'readwrite'
    );

    if (callback) {
      trans.addEventListener('error', function(err) {
        callback(err);
      });

      trans.addEventListener('complete', function() {
        callback();
      });
    }

    var options = Presets.local.options;
    debug('Creating local calendar with options:', options);
    var account = new Account(options);
    account.preset = 'local';
    account._id = uuid();

    var calendar = {
      _id: Local.calendarId,
      accountId: account._id,
      remote: Local.defaultCalendar()
    };

    accountStore.persist(account, trans);
    calendarStore.persist(calendar, trans);
  },

  deleteDatabase: function(callback) {
    var req = idb.deleteDatabase(this.name);

    req.onblocked = function() {
      // improve interface
      callback(new Error('blocked'));
    };

    req.onsuccess = function(event) {
      callback(null, event);
    };

    req.onerror = function(event) {
      callback(event, null);
    };
  }
};

});

define('controllers/error',['require','exports','module','error','error','responder','next_tick','notification'],function(require, exports, module) {


var Authentication = require('error').Authentication;
var InvalidServer = require('error').InvalidServer;
var Responder = require('responder');
var nextTick = require('next_tick');
var notification = require('notification');

/**
 * Global error handler / default handling for errors.
 *
 * @param {Calendar.App} app current application.
 */
function ErrorController(app) {
  Responder.call(this);

  this.app = app;
  this._handlers = Object.create(null);
}
module.exports = ErrorController;

ErrorController.prototype = {
  __proto__: Responder.prototype,

  /**
   * URL in which account errors are dispatched to.
   */
  accountErrorUrl: '/update-account/',

  /**
   * Dispatch an error event.
   *
   * If this type of event has been captured will be dispatched directly to
   * the callback provided. Otherwise the default behaviour will be triggered.
   *
   * @param {Calendar.Error} error to dispatch.
   */
  dispatch: function(error) {
    if (error instanceof Authentication || error instanceof InvalidServer) {
      this.handleAuthenticate(error.detail.account);
    }

    this.emit('error', error);
  },

  /**
   * Default handler for authentication errors.
   *
   * @param {Object} account to notify user about.
   * @param {Function} [callback] optional callback.
   */
  handleAuthenticate: function(account, callback) {
    if (!account) {
      return console.error('attempting to trigger reauth without an account');
    }

    // only trigger notification the first time there is an error.
    if (!account.error || account.error.count !== 1) {
      return nextTick(callback);
    }

    var lock = navigator.requestWakeLock('cpu');

    var l10n = navigator.mozL10n;
    var title = account.preset === 'caldav' ?
      l10n.get('notification-error-caldav-sync-title') :
      l10n.get('notification-error-sync-title');
    var description = account.preset === 'caldav' ?
      l10n.get('notification-error-caldav-sync-description') :
      l10n.get('notification-error-sync-description');
    var url = account.preset === 'caldav' ?
      '/password/' + account._id + '/' :
      this.accountErrorUrl + account._id;

    notification.sendNotification(title, description, url).then(() => {
      callback && callback();
      lock.unlock();
    });
  }
};

});

define('pending_manager',['require','exports','module'],function(require, exports, module) {


function PendingManager() {
  this.objects = [];
  this.pending = 0;
  this.onstart = this.onstart.bind(this);
  this.onend = this.onend.bind(this);
}
module.exports = PendingManager;

PendingManager.prototype = {
  register: function(object) {
    object.on(object.startEvent, this.onstart);
    object.on(object.completeEvent, this.onend);

    var wasPending = this.isPending();
    this.objects.push(object);
    if (object.pending) {
      this.pending++;

      if (!wasPending) {
        this.onpending && this.onpending();
      }
    }
  },

  /**
   * Unregister an object.
   * Note it is intended that objects that
   * are unregistered are never in a state
   * where we are waiting for their pending
   * status to complete. If an incomplete
   * object is removed it will break .pending.
   */
  unregister: function(object) {
    var idx = this.objects.indexOf(object);
    if (idx !== -1) {
      this.objects.splice(idx, 1);
      return true;
    }

    return false;
  },

  isPending: function() {
    return this.objects.some((object) => {
      return object.pending;
    });
  },

  onstart: function() {
    if (!this.pending) {
      this.onpending && this.onpending();
    }

    this.pending++;
  },

  onend: function() {
    this.pending--;
    if (!this.pending) {
      this.oncomplete && this.oncomplete();
    }
  }
};

});

define('controllers/recurring_events',['require','exports','module','responder','debug','next_tick','provider/provider_factory'],function(require, exports, module) {


var Responder = require('responder');
var debug = require('debug')('controllers/recurring_events');
var nextTick = require('next_tick');
var providerFactory = require('provider/provider_factory');

function RecurringEvents(app) {
  this.app = app;
  this.accounts = app.store('Account');
  Responder.call(this);
}
module.exports = RecurringEvents;

RecurringEvents.prototype = {
  __proto__: Responder.prototype,

  startEvent: 'expandStart',
  completeEvent: 'expandComplete',

  /**
   * Adds N number of days to the window to expand
   * events until. Its very important for this number
   * to be greater then the maximum number of days displayed
   * in the month view (or a view with more days) otherwise
   * the view may be loaded without actually expanding all
   * the visible days.
   *
   * @type Number
   */
  paddingInDays: 43,

  /**
   * Amount of time (in MS) to wait between triggering
   * the recurring event expansions.
   */
  waitBeforeMove: 750,

  /**
   * We need to limit the number of tries on expansions
   * otherwise its possible we never complete during error
   * or long recurring event.
   */
  maximumExpansions: 25,

  /**
   * private timeout (as in setTimeout id) use with waitBeforeMove.
   */
  _moveTimeout: null,

  /**
   * True when queue is running...
   */
  pending: false,

  unobserve: function() {
    this.app.timeController.removeEventListener(
      'monthChange',
      this
    );

    this.app.syncController.removeEventListener(
      'syncComplete',
      this
    );
  },

  observe: function() {
    var time = this.app.timeController;

    // expand initial time this is necessary
    // for cases where user has device off for long periods of time.
    if (time.position) {
      this.queueExpand(time.position);
    }

    // register observers
    time.on('monthChange', this);

    // we must re-expand after sync so events at least
    // expand to the current position....
    this.app.syncController.on('syncComplete', this);
  },

  handleEvent: function(event) {
    switch (event.type) {
      case 'syncComplete':
        this.queueExpand(
          this.app.timeController.position
        );
        break;

      case 'monthChange':
        if (this._moveTimeout !== null) {
          clearTimeout(this._moveTimeout);
          this._moveTimeout = null;
        }

        // trigger the event queue when we move
        this._moveTimeout = setTimeout(
          // data[0] is the new date.
          this.queueExpand.bind(this, event.data[0]),
          this.waitBeforeMove
        );
        break;
    }
  },

  /**
   * Attempts to expand provider until no events require expansion.
   *
   * @param {Date} expandDate expands up to this date.
   * @param {Calendar.Provider.Abstract} provider instance.
   * @param {Function} callback
   *  fired when maximumExpansions is hit or
   *  no more events require expansion.
   *
   */
  _expandProvider: function(expandDate, provider, callback) {
    debug('Will attempt to expand provider until:', expandDate);
    var tries = 0;
    var max = this.maximumExpansions;

    function attemptCompleteExpand() {
      debug('Will try to complete expansion (tries = ' + tries + ')');
      if (tries >= max) {
        return callback(new Error(
          'could not complete expansion after "' + tries + '"'
        ));
      }

      provider.ensureRecurrencesExpanded(expandDate, function(err, didExpand) {
        if (err) {
          return callback(err);
        }

        debug('Expansion attempt did expand:', didExpand);

        if (!didExpand) {
          // successfully expanded and no events need expansion
          // for this date anymore...
          callback();
        } else {
          tries++;
          // attempt another expand without stack.
          nextTick(attemptCompleteExpand);
        }
      });
    }

    attemptCompleteExpand();
  },

  /**
   * Queues an expansion. If the given date is before
   * any dates in the stack it will be discarded.
   */
  queueExpand: function(expandTo) {
    if (this.pending) {
      if (!this._next) {
        this._next = expandTo;
      } else if (expandTo > this._next) {
        this._next = expandTo;
      }
      // don't start the queue if pending...
      return;
    }

    // either way we need to process an event
    // so increment pending for running and non-running cases.
    this.pending = true;
    this.emit('expandStart');

    var self = this;
    function expandNext(date) {
      self.expand(date, function() {
        if (date === self._next) {
          self._next = null;
        }

        var next = self._next;

        // when the queue is empty emit expandComplete
        if (!next) {
          self.pending = false;
          self.emit('expandComplete');
          return;
        }

        expandNext(next);
      });
    }

    expandNext(expandTo);
  },

  /**
   * Ensures we have time converage until the given date.
   * Additional time will be added to the date see .paddingInDays.
   *
   * @param {Date} expandTo date to expand to.
   */
  expand: function(expandTo, callback) {
    debug('expand', expandTo);

    this.accounts.all((err, accounts) => {
      if (err) {
        return callback(err);
      }

      // add minimum padding...
      var expandDate = new Date(expandTo.valueOf());
      expandDate.setDate(expandDate.getDate() + this.paddingInDays);

      var providers = this._getExpandableProvidersNew(accounts);
      var pending = providers.length;

      if (!pending) {
        return nextTick(callback);
      }

      providers.forEach(provider => {
        this._expandProvider(expandDate, provider, () => {
          if (--pending <= 0) {
            callback();
          }
        });
      });
    });
  },

  _getExpandableProvidersNew: function(accounts) {
    var providers = [];
    Object.keys(accounts).forEach(key => {
      var account = accounts[key];

      var providerType = account.preset === 'activesync' ? 'Local' : account.providerType;

      var provider = providerFactory.get(providerType);
      if (provider &&
          provider.canExpandRecurringEvents &&
          providers.indexOf(provider) === -1) {
        providers.push(provider);
      }
    });

    return providers;
  },

  _getExpandableProviders: function(accounts) {
    var providers = [];
    Object.keys(accounts).forEach(key => {
      var account = accounts[key];
      var provider = providerFactory.get(account.providerType);
      if (provider &&
          provider.canExpandRecurringEvents &&
          providers.indexOf(provider) === -1) {
        providers.push(provider);
      }
    });

    return providers;
  }
};

});

define('worker/manager',['require','exports','module','responder','debug'],function(require, exports, module) {


var Responder = require('responder');
var debug = require('debug')('worker/manager');

const IDLE_CLEANUP_TIME = 5000;

/**
 * Worker manager. Each worker/thread
 * is assigned one or more roles.
 *
 * There may be one or more workers for
 * each role and there is a contract
 * that assumes all roles are stateless
 * requests/streams are routed to workers
 * and will be completed eventually
 * but without order guarantees.
 */
function Manager() {
  this._lastId = 0;

  Responder.call(this);

  this.roles = Object.create(null);
  this.workers = [];
}
module.exports = Manager;

Manager.prototype = {
  // So that we can mock out Worker API in unit tests...
  Worker: Worker,

  __proto__: Responder.prototype,

  _onLog: debug,

  _formatData: function(data) {
    if (data[1] && data[1].stack && data[1].constructorName) {
      var err = data[1];
      var builtErr;

      if (window[err.constructorName]) {
        builtErr = Object.create(window[err.constructorName].prototype);
      } else {
        builtErr = Object.create(Error.prototype);
      }

      var key;

      for (key in err) {
        if (err.hasOwnProperty(key)) {
          builtErr[key] = err[key];
        }
      }

      data[1] = builtErr;
    }

    return data;
  },

  _onWorkerError: function(worker, err) {
    if (/reference to undefined property/.test(err.message)) {
      // This is a warning spewed out by javascript.options.strict,
      // the worker actually didn't crash at all, so ignore it.
      return;
    }

    if (worker.instance) {
      worker.instance.terminate();
      worker.instance = null;
    }
    var pending = worker.pending;
    worker.pending = Object.create(null);
    for (var id in pending) {
      if (pending[id].stream) {
        pending[id].stream.emit('error', err);
      }
      pending[id].callback(err);
    }
  },

  _onWorkerMessage: function(worker, event) {
    var data = this._formatData(event.data);
    var type = data.shift();
    var match = type.match(/^(\d+) (end|stream)$/);

    if (type == 'log') {
      this._onLog.apply(this, data);

    } else if (match) {
      var pending = worker.pending[match[1]];
      if (pending) {
        this._dispatchMessage(worker, pending, match[2], data);
      } else {
        throw new Error('Message arrived for unknown consumer: ' +
                        type + ' ' + JSON.stringify(data));
      }
    } else {
      this.respond([type].concat(data));
    }
  },

  _dispatchMessage: function(worker, pending, type, data) {
    if (type == 'stream') {
      pending.stream.respond(data);
    } else { // 'end'
      pending.callback.apply(null, data);
      delete worker.pending[pending.id];
      // Bail out if there are other pending requests.
      if (Object.keys(worker.pending).length) {
        return;
      }
      // If none are left, schedule cleanup
      this._scheduleCleanup(worker);
    }
  },

  _addPending: function(worker, pending) {
    worker.pending[pending.id] = pending;
    clearTimeout(worker.cleanup);
  },

  _scheduleCleanup: function(worker) {
    clearTimeout(worker.cleanup);
    worker.cleanup = setTimeout(function() {
      // Ensure we don't have a race condition where someone just
      // added a request but the timeout fired anyway.
      if (Object.keys(worker.pending).length) {
        return;
      }
      if (!worker.instance) {
        return;
      }

      worker.instance.terminate();
      worker.instance = null;
    }, IDLE_CLEANUP_TIME);
  },

  /**
   * Adds a worker to the manager.
   * Worker is associated with one or
   * more roles. Workers are assumed
   * stateless.
   *
   *
   * @param {String|Array} role one or more roles.
   * @param {String} worker url.
   */
  add: function(role, workerURL) {
    debug('Will add', role, 'worker at', workerURL);
    var worker = {
      // Actual Worker instance, when active
      instance: null,
      // Handlers that are waiting for a response from this worker
      pending: Object.create(null),
      // Script URL
      url: workerURL,
      // Timeout set to disable the worker when it hasn't been used
      // for a given period of time
      cleanup: null
    };

    this.workers.push(worker);
    [].concat(role).forEach(function(role) {
      if (!(role in this.roles)) {
        this.roles[role] = [worker];
      } else {
        this.roles[role].push(worker);
      }
    }, this);
  },

  _ensureActiveWorker: function(role) {
    if (role in this.roles) {
      var workers = this.roles[role];
      var worker = workers[Math.floor(Math.random() * workers.length)];
      if (worker.instance) {
        return worker;
      } else {
        this._startWorker(worker);
        return worker;
      }
    } else {
      throw new Error('no worker with role "' + role + '" active');
    }
  },

  _startWorker: function(worker) {
    worker.instance = new this.Worker(
      // ?time= is for cache busting in development...
      // there have been cases where nightly would not
      // clear the cache of the worker.
      worker.url + '?time=' + Date.now()
    );

    worker.instance.onerror = this._onWorkerError.bind(this, worker);
    worker.instance.onmessage = this._onWorkerMessage.bind(this, worker);
    this._scheduleCleanup(worker);
  },

  request: function(role /*, args..., callback*/) {
    var args = Array.prototype.slice.call(arguments, 1);
    var callback = args.pop();
    var worker = null;

    try {
      worker = this._ensureActiveWorker(role);
    } catch (e) {
      callback(e);
      return;
    }

    var data = {
      id: this._lastId++,
      role: role,
      payload: args
    };

    this._addPending(worker, {
      id: data.id,
      callback: callback
    });

    worker.instance.postMessage(['_dispatch', data]);
  },

  stream: function(role /*, args...*/) {
    var args = Array.prototype.slice.call(arguments, 1);
    var stream = new Responder();
    var self = this;

    var data = {
      id: this._lastId++,
      role: role,
      payload: args,
      type: 'stream'
    };

    stream.request = function(callback) {
      var worker = null;

      stream.request = function() {
        throw new Error('stream request has been sent');
      };

      try {
        worker = self._ensureActiveWorker(role);
      } catch (e) {
        callback(e);
        return;
      }

      self._addPending(worker, {
        id: data.id,
        stream: stream,
        callback: callback
      });
      worker.instance.postMessage(['_dispatch', data]);
    };
    return stream;
  }
};

});

define('controllers/service',['require','exports','module','worker/manager','debug'],function(require, exports, module) {


var Manager = require('worker/manager');
var debug = require('debug')('controllers/service');

function Service() {
  Manager.call(this);
}
module.exports = Service;

Service.prototype = {
  __proto__: Manager.prototype,

  start: function() {
    debug('Will load and initialize worker...');
    this.add('caldav', '/js/caldav_worker.js');
  }
};

});

define('controllers/sync',['require','exports','module','responder','error','error'],function(require, exports, module) {


var Responder = require('responder');
var Authentication = require('error').Authentication;
var InvalidServer = require('error').InvalidServer;

/**
 * Handles all synchronization related
 * tasks. The intent is that this will
 * be the focal point for any view
 * to observe sync events and this
 * controller will decide when to actually
 * tell the stores when to sync.
 */
function Sync(app) {
  this.app = app;
  this.pending = 0;

  Responder.call(this);
}
module.exports = Sync;

Sync.prototype = {
  __proto__: Responder.prototype,

  startEvent: 'syncStart',
  completeEvent: 'syncComplete',
  isSyncErr: false,
  syncSwitch: false,

  _incrementPending: function() {
    if (!this.pending) {
      this.emit('syncStart');
    }

    this.pending++;
  },

  _resolvePending: function(err) {
    if (err && (err.status === 401 ||
      (err.detail.account.preset === 'google' &&
      (err instanceof Authentication || err instanceof InvalidServer)))) {
      this.isSyncErr = true;
    }

    if (!(--this.pending)) {
      this.emit('syncComplete', {
        isSyncErr: this.isSyncErr,
        syncSwitch: this.syncSwitch,
      });

      this.isSyncErr = false;
      this.syncSwitch = false;
    }

    if (this.pending < 0) {
      dump('\n\n Error calendar sync .pending is < 0 \n\n');
    }
  },

  /**
   * Sync all accounts, calendars, events.
   * There is no callback for all intentionally.
   *
   * Use:
   *
   *    controller.once('syncComplete', cb);
   *
   */
  all: function(callback) {
    // this is for backwards compatibility... in reality we should remove
    // callbacks from .all.
    if (callback) {
      this.once('syncComplete', callback);
    }

    if (navigator.mozWifiManager && navigator.mozWifiManager.connection &&
      navigator.mozWifiManager.connection.status === 'connected') {
      this.getAllAccount();
    } else {
      this.app.getAllDataState().then((results) => {
        let connectFlag = false;
        for (let i = 0; i < results.length; i++) {
          if (results[i] === 'connected') {
            connectFlag = true;
            break;
          }
        }

        if (connectFlag) {
          this.getAllAccount();
        } else {
          this.emit('offline');
          return;
        }
      });
    }
  },

  getAllAccount: function() {
    let account = this.app.store('Account');

    account.all((err, list) => {
      this.syncSwitch = false;

      for (let key in list) {
        if (list[key].syncFlag || list[key].preset === 'local' ||
          list[key].preset === 'caldav') {
          this.account(list[key]);

          if (list[key].syncFlag || list[key].preset === 'caldav') {
            this.syncSwitch = true;
          }
        }
      }

      // If we have nothing to sync
      if (!this.pending) {
        this.emit('syncComplete');
      }

    });
  },

  /**
   * Initiates a sync for a single calendar.
   *
   * @param {Object} account parent of calendar.
   * @param {Object} calendar specific calendar to sync.
   * @param {Function} [callback] optional callback.
   */
  calendar: function(account, calendar, callback) {
    var store = this.app.store('Calendar');
    var self = this;

    if (account.syncFlag || account.preset === 'caldav') {
      this.syncSwitch = true;
    }

    this._incrementPending();
    store.sync(account, calendar, err => {
      self._resolvePending(err);
      this.handleError(err, callback);
    });
  },

  /**
   * Initiates a sync of a single account and all
   * associated calendars (calendars that exist after
   * the full sync of the account itself).
   *
   * The contract is if an callback is given the callback MUST handle the
   * error given. The default behaviour is to bubble up the error up to the
   * error controller.
   *
   * @param {Object} account sync target.
   * @param {Function} [callback] optional callback.
  */
  account: function(account, callback) {
    var accountStore = this.app.store('Account');
    var calendarStore = this.app.store('Calendar');

    var self = this;

    if (account.preset === 'activesync') {
      self._incrementPending();
      calendarStore.remotesByAccount(account._id, (err, calendars) => {
        if (err) {
          self._resolvePending(err);
          return self.handleError(err, callback);
        }

        var store = self.app.store('Calendar');
        for (var key in calendars) {
          store.sync(account, calendars[key], (err) => {
            if (err) {
              self._resolvePending(err);
              self.handleError(err, callback);
            }

            self._resolvePending();
            callback && callback();
          });
        }
      });
    } else {
      self._incrementPending();
      accountStore.sync(account, (err) => {
        if (err) {
          self._resolvePending(err);
          return self.handleError(err, callback);
        }

        var pending = 0;
        function next() {
          if (!(--pending)) {
            self._resolvePending();

            if (callback) {
              callback();
            }
          }
        }

        function fetchCalendars(err, calendars) {
          if (err) {
            self._resolvePending(err);
            return self.handleError(err, callback);
          }

          for (var key in calendars) {
            if (account.preset !== 'google' ||
              account.user === calendars[key].remote.name) {
              pending++;
              self.calendar(account, calendars[key], next);
            }
          }
        }

        // find all calendars
        calendarStore.remotesByAccount(
          account._id,
          fetchCalendars
        );
      });
    }
  },

  /**
   * Private helper for choosing how to dispatch errors.
   * When given a callback the callback will be called otherwise the error
   * controller will be invoked.
   */
  handleError: function(err, callback) {
    if (callback) {
      return callback(err);
    }

    if (!err) {
      return;
    }

    if (err.detail.account.preset === 'google' &&
      (err instanceof Authentication || err instanceof InvalidServer)) {
      let accountStore = this.app.store('Account');
      accountStore.handleRefreshCredential(err.detail.account);
    } else {
      this.app.errorController.dispatch(err);
    }
  }
};

});

define('controllers/time',['require','exports','module','calc','responder'],function(require, exports, module) {


// Controls the selected/displayed dates by all the calendar views.
// ---
// All views that needs to listen date selection/navigation changes, or set
// a new value, should do it through this module (eg. day/week/month views and
// DayObserver)

var isSameDate = require('calc').isSameDate;
var Responder = require('responder');

function Time(app) {
  this.app = app;
  Responder.call(this);

  this._timeCache = Object.create(null);
}
module.exports = Time;

Time.prototype = {
  __proto__: Responder.prototype,

  /**
   * Current position in time.
   * Includes year, month and day.
   *
   * @type {Date}
   */
  _position: null,

  /**
   * Current center point of cached
   * time spans. This is not the last
   * loaded timespan but the last
   * requested timespan.
   *
   * @type {Calendar.Timespan}
   */
  _currentTimespan: null,

  /**
   * Hash that contains
   * the pieces of the current _position.
   * (month, day, year)
   */
  _timeCache: null,

  /**
   * The time 'scale' of the current
   * state of the calendar.
   *
   * Usually one of: ['day', 'month', 'week']
   * @type {String}
   */
  _scale: null,

  /**
   * private state of mostRecentDayType
   */
  _mostRecentDayType: 'day',

  /**
   * When true will lock the cache so no records are
   * purged. This is critical during sync because some
   * records may not yet be in the database.
   */
  cacheLocked: false,

  /**
   * Returns the most recently changed
   * day type either 'day' or 'selectedDay'
   */
  get mostRecentDayType() {
    return this._mostRecentDayType;
  },

  get mostRecentDay() {
    if (this.mostRecentDayType === 'selectedDay') {
      return this.selectedDay;
    } else {
      return this.position;
    }
  },

  get timespan() {
    return this._currentTimespan;
  },

  get scale() {
    return this._scale;
  },

  set scale(value) {
    var oldValue = this._scale;
    if (value !== oldValue) {
      this._scale = value;
      this.emit('scaleChange', value, oldValue);
    }
  },

  get selectedDay() {
    return this._selectedDay;
  },

  set selectedDay(value) {
    let day = this._selectedDay;
    let oneDay = 24 * 60 * 60 * 1000;
    this._mostRecentDayType = 'selectedDay';
    if (!day || !this.isSameUTCDate(day, value) ||
      (value.valueOf() >=0 && value.valueOf() < oneDay &&
      day.getDate() !== 1) ||
      (day.valueOf() >=0 && day.valueOf() < oneDay && value.getDate() !== 1)) {
      this._selectedDay = value;
      this.emit('selectedDayChange', value, day);
    }
  },

  isSameUTCDate: function(first, second) {
    return first.getUTCMonth() == second.getUTCMonth() &&
           first.getUTCDate() == second.getUTCDate() &&
           first.getUTCFullYear() == second.getUTCFullYear();
  },

  /**
   * Helper function to 'move' state of calendar
   * to the most recently modified day type.
   *
   * (in the case where selectedDay was changed after day)
   */
  moveToMostRecentDay: function() {
    if (this.mostRecentDayType === 'selectedDay') {
      this.move(this.selectedDay);
    }
  },

  _updateCache: function(type, value) {
    var old = this._timeCache[type];

    if (!old || !isSameDate(value, old)) {
      this._timeCache[type] = value;
      this.emit(type + 'Change', value, old);
    }
  },

  get month() {
    return this._timeCache.month;
  },

  get day() {
    return this._timeCache.day;
  },

  get year() {
    return this._timeCache.year;
  },

  get position() {
    return this._position;
  },

  /**
   * Sets position of controller
   * in time.
   *
   * @param {Date} date position to move to.
   */
  move: function(date) {
    var year = date.getFullYear();
    var month = date.getMonth();
    var yearDate = new Date(year, 0, 1);
    var monthDate = new Date(year, month, 1);

    this._position = date;
    this._mostRecentDayType = 'day';

    this._updateCache('year', yearDate);
    this._updateCache('month', monthDate);
    this._updateCache('day', date);
  }
};

});

define('controllers/delete',['require','exports','module','promise','provider/provider_factory'],function(require, exports, module) {


var denodeifyAll = require('promise').denodeifyAll;
var providerFactory = require('provider/provider_factory');

function DeleteController(app) {
  this.app = app;
  this.events = this.app.store('Event');
  this.busytimes = this.app.store('Busytime');

  denodeifyAll(this, [
    'deleteLocalEvent',
    'deleteLocalRecurringEvent',
    'deleteLocalBusytime',
    'deleteEvent'
  ]);
}
module.exports = DeleteController;

DeleteController.prototype = {
  /*
   * delete event
   */
  deleteEvent: function(event, callback) {
    this.events.ownersOf(event, function (err, owners) {
      if (err) {
        callback(err);
        return;
      }

      var provider = providerFactory.get(owners.account.providerType);
      provider.eventCapabilities(event, function (err, caps) {
        if (err) {
          callback(err);
          return;
        }

        if (caps.canDelete) {
          provider.deleteEvent(event, function(err) {
            if (err) {
              callback(err);
            } else {
              callback(null, event);
            }
          });
        } else {
          callback('No delete capability');
        }
      });
    });
  },

  /*
   * delete local event and all dependencies
   */
  deleteLocalEvent: function(event, callback) {
    this._ensureLocalProvider(event, function(err, localProvider) {
      if (err) {
        callback(err);
        return;
      }

      localProvider.deleteEvent(event, function(err) {
        if (err) {
          callback(err);
        } else {
          callback(null, event);
        }
      });
    });
  },

  /*
   * delete local recurring event and all dependencies
   */
  deleteLocalRecurringEvent: function(event, callback) {
    if (!event.remote.isRecurring) {
      callback('Not recurring event');
    } else {
      this.deleteLocalEvent(event, callback);
    }
  },

  /*
   * delete the busytime item only
   */
  deleteLocalBusytime: function(event, busytimeId, callback) {
    this._ensureLocalProvider(event, function(err, localProvider) {
      if (err) {
        callback(err);
        return;
      }

      localProvider.deleteBusytime(busytimeId, function(err) {
        if (err) {
          callback(err);
        } else {
          callback(null, busytimeId);
        }
      });
    });
  },

  /*
   * To ensure the event passed in is belonging to
   * local provider and it can be deleted.
   */
  _ensureLocalProvider: function(event, callback) {
    this.events.ownersOf(event, function (err, owners) {
      if (err) {
        callback(err);
        return;
      }

      var providerType = owners.account.providerType;
      if (providerType === 'Local') {
        var provider = providerFactory.get(providerType);
        provider.eventCapabilities(event, function (err, caps) {
          if (err) {
            callback(err);
            return;
          }

          if (caps.canDelete) {
            callback(null, provider);
          } else {
            callback('No delete capability');
          }
        });
      } else {
        callback('Not local provider');
      }
    });
  }
};

});

/**
 * @fileoverview Period sync controller manages
 *
 *     1. Seeding first sync alarm when app starts.
 *     2. Syncing when a sync alarm fires and issuing a new sync alarm.
 *     3. Invalidating any existing sync alarms and issuing a new one
 *        when the sync interval changes.
 */
define('controllers/periodic_sync',['require','exports','module','responder','debug','message_handler'],function(require, exports) {


var Responder = require('responder');
var debug = require('debug')('controllers/periodic_sync');
var messageHandler = require('message_handler');

/**
 * Cached alarm previously sent to alarms db.
 * @type {Object}
 */
var syncAlarm;

/**
 * Cached sync value (every x minutes) from scheduling.
 * @type {Number}
 */
var prevSyncFrequency;

/**
 * Most recently set sync interval (every x minutes).
 * @type {Number}
 */
var syncFrequency;

/**
 * Cached promise representing pending sync operation.
 * @type {Promise}
 */
var syncing;

/**
 * Cached promise representing pending schedule operation.
 * @type {Promise}
 */
var scheduling;

var events = new Responder();
exports.events = events;

var accounts;
var settings;

// Will be injected...
exports.app = null;

exports.observe = function() {
  debug('Will start periodic sync controller...');
  var app = exports.app;
  accounts = app.store('Account');
  settings = app.store('Setting');
  return Promise.all([
    settings.getValue('syncAlarm'),
    settings.getValue('syncFrequency')
  ])
  .then(values => {
    [syncAlarm, syncFrequency] = values;
    // Trigger whenever there is a change to the accounts collection
    // since we need to re-evaluate whether periodic sync is still necessary.
    accounts.on('persist', onAccountsChange);
    accounts.on('remove', onAccountsChange);
    // Listen to the settings collection for a change to sync frequency so that
    // we can update any alarms we've sent to the alarms api accordingly.
    debug('Will listen for syncFrequencyChange...');
    settings.on('syncFrequencyChange', exports);
    // Listen for sync event from alarms api.
    messageHandler.responder.on('sync', exports);
    return scheduleSync();
  });
};

exports.unobserve = function() {
  syncAlarm = null;
  prevSyncFrequency = null;
  syncFrequency = null;
  syncing = null;
  scheduling = null;
  accounts.off('persist', onAccountsChange);
  accounts.off('remove', onAccountsChange);
  settings.off('syncFrequencyChange', exports);
  messageHandler.responder.off('sync', exports);
};

exports.handleEvent = function(event) {
  switch (event.type) {
    case 'sync':
      // Gets triggered by mozSetMessageHandler alarm event.
      return onSync();
    case 'syncFrequencyChange':
      // Gets triggered by settings db change to sync frequency.
      debug('Received syncFrequencyChange!');
      return onSyncFrequencyChange(event.data[0]);
  }
};

/**
 * 1. Wait until we're done with any previous work.
 * 2. Sync.
 * 3. Schedule the next periodic sync.
 */
function onSync() {
  return sync().then(scheduleSync);
}

/**
 * 1. Wait until we're done with any previous work.
 * 2. Schedule a periodic sync at the new interval.
 */
function onSyncFrequencyChange(value) {
  debug('Sync frequency changed to', value);
  syncFrequency = value;
  return maybeScheduleSync();
}

/**
 * No syncable accounts => revoke any previously scheduled sync alarms.
 * Syncable accounts and no previously scheduled sync => schedule new sync.
 */
function onAccountsChange() {
  debug('Looking up syncable accounts...');
  return accounts.syncableAccounts().then(syncable => {
    if (!syncable || !syncable.length) {
      debug('There are no syncable accounts!');
      revokePreviousAlarm();
      events.emit('pause');
      return;
    }

    debug('There are', syncable.length, 'syncable accounts');

    if (!syncAlarmIssued()) {
      debug('The first syncable account was just added.');
      return scheduleSync();
    }
  });
}

function sync() {
  if (!syncing) {
    syncing = new Promise((resolve, reject) => {
      debug('Will request cpu and wifi wake locks...');
      var cpuLock = navigator.requestWakeLock('cpu');
      var wifiLock = navigator.requestWakeLock('wifi');
      debug('Will start periodic sync...');
      var app = exports.app;
      app.syncController.all(() => {
        debug('Sync complete! Will release cpu and wifi wake locks...');
        cpuLock.unlock();
        wifiLock.unlock();
        events.emit('sync');
        syncing = null;
        resolve();
      });
    });
  }

  return syncing;
}

function scheduleSync() {
  if (scheduling) {
    return scheduling;
  }

  scheduling = accounts.syncableAccounts()
  .then(syncable => {
    if (!syncable || !syncable.length) {
      debug('There seem to be no syncable accounts, will defer scheduling...');
      return Promise.resolve();
    }

    debug('Will schedule periodic sync in:', syncFrequency);
    // Cache the sync interval which we're sending to the alarms api.
    prevSyncFrequency = syncFrequency;
    revokePreviousAlarm();

    return issueSyncAlarm().then(cacheSyncAlarm).then(maybeScheduleSync);
  })
  .then(() => {
    events.emit('schedule');
    scheduling = null;
  })
  .catch(error => {
    debug('Error scheduling sync:', error);
    console.error(error.toString());
    scheduling = null;
  });

  return scheduling;
}

// TODO: When navigator.mozAlarms.remove (one day) returns a DOMRequest,
//     we should make this async...
function revokePreviousAlarm() {
  if (!syncAlarmIssued()) {
    debug('No sync alarms issued, nothing to revoke...');
    return;
  }

  debug('Will revoke alarm', syncAlarm.alarmId);
  var alarms = navigator.mozAlarms;
  alarms.remove(syncAlarm.alarmId);
}

function issueSyncAlarm() {
  if (!prevSyncFrequency) {
    debug('Periodic sync disabled!');
    return Promise.resolve({ alarmId: null, start: null, end: null });
  }

  var start = new Date();
  var end = new Date(
    start.getTime() +
    prevSyncFrequency * 60 * 1000 // minutes to ms
  );

  var alarms = navigator.mozAlarms;
  var request = alarms.add(end, 'ignoreTimezone', { type: 'sync' });

  return new Promise((resolve, reject) => {
    request.onsuccess = function() {
      resolve({ alarmId: this.result, start: start, end: end });
    };

    request.onerror = function() {
      reject(this.error);
    };
  });
}

function cacheSyncAlarm(alarm) {
  debug('Will save alarm:', alarm);
  syncAlarm = alarm;
  return settings.set('syncAlarm', syncAlarm);
}

function maybeScheduleSync() {
  if (syncFrequency === prevSyncFrequency) {
    // Nothing to do!
    return Promise.resolve();
  }

  if (scheduling) {
    return scheduling.then(scheduleSync);
  }

  return scheduleSync();
}

function syncAlarmIssued() {
  return syncAlarm && !!syncAlarm.alarmId;
}

});

define('snake_case',['require','exports','module'],function(require, exports, module) {


module.exports = function(name) {
  return name
    .replace(/^./, chr => chr.toLowerCase())
    .replace(/[A-Z]/g, chr => '_' + chr.toLowerCase());
};

});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   // node.js
//   if (typeof exports === 'object') {
//     module.exports = factory();
//     this.Blob = require('./blob').Blob;
//     var stringencoding = require('ext/stringencoding');
//     this.TextEncoder = stringencoding.TextEncoder;
//     this.TextDecoder = stringencoding.TextDecoder;
//   }
//   // browser environment, AMD loader
//   else if (typeof define === 'function' && define.amd) {
//     define(factory);
//   }
//   // browser environment, no AMD loader
//   else {
//     root.WBXML = factory();
//   }
// }(this, function() {
define('activesync/wbxml/wbxml',['require','exports','module'],function(require, exports, module) {
  

  var exports = {};

  var Tokens = {
    SWITCH_PAGE: 0x00,
    END:         0x01,
    ENTITY:      0x02,
    STR_I:       0x03,
    LITERAL:     0x04,
    EXT_I_0:     0x40,
    EXT_I_1:     0x41,
    EXT_I_2:     0x42,
    PI:          0x43,
    LITERAL_C:   0x44,
    EXT_T_0:     0x80,
    EXT_T_1:     0x81,
    EXT_T_2:     0x82,
    STR_T:       0x83,
    LITERAL_A:   0x84,
    EXT_0:       0xC0,
    EXT_1:       0xC1,
    EXT_2:       0xC2,
    OPAQUE:      0xC3,
    LITERAL_AC:  0xC4,
  };

  var EndOfData = {
    message: 'THIS IS AN INTERNAL CONTROL FLOW HACK THAT YOU SHOULD NOT SEE'
  };

  /**
   * Create a constructor for a custom error type that works like a built-in
   * Error.
   *
   * @param name the string name of the error
   * @param parent (optional) a parent class for the error, defaults to Error
   * @param extraArgs an array of extra arguments that can be passed to the
   *        constructor of this error type
   * @return the constructor for this error
   */
  function makeError(name, parent, extraArgs) {
    function CustomError() {
      // Try to let users call this as CustomError(...) without the "new". This
      // is imperfect, and if you call this function directly and give it a
      // |this| that's a CustomError, things will break. Don't do it!
      var self = this instanceof CustomError ?
                 this : Object.create(CustomError.prototype);
      var tmp = Error();
      var offset = 1;

      self.stack = tmp.stack.substring(tmp.stack.indexOf('\n') + 1);
      self.message = arguments[0] || tmp.message;
      if (extraArgs) {
        offset += extraArgs.length;
        for (var i = 0; i < extraArgs.length; i++)
          self[extraArgs[i]] = arguments[i+1];
      }

      var m = /@(.+):(.+)/.exec(self.stack);
      self.fileName = arguments[offset] || (m && m[1]) || "";
      self.lineNumber = arguments[offset + 1] || (m && m[2]) || 0;

      return self;
    }
    CustomError.prototype = Object.create((parent || Error).prototype);
    CustomError.prototype.name = name;
    CustomError.prototype.constructor = CustomError;

    return CustomError;
  }

  var ParseError = makeError('WBXML.ParseError');
  exports.ParseError = ParseError;

  function StringTable(data, decoder) {
    this.strings = [];
    this.offsets = {};

    var start = 0;
    for (var i = 0; i < data.length; i++) {
      if (data[i] === 0) {
        this.offsets[start] = this.strings.length;
        this.strings.push(decoder.decode( data.subarray(start, i) ));
        start = i + 1;
      }
    }
  }

  StringTable.prototype = {
    get: function(offset) {
      if (offset in this.offsets)
        return this.strings[this.offsets[offset]];
      else {
        if (offset < 0)
          throw new ParseError('offset must be >= 0');

        var curr = 0;
        for (var i = 0; i < this.strings.length; i++) {
          // Add 1 to the current string's length here because we stripped a
          // null-terminator earlier.
          if (offset < curr + this.strings[i].length + 1)
            return this.strings[i].slice(offset - curr);
          curr += this.strings[i].length + 1;
        }
      }
      throw new ParseError('invalid offset');
    },
  };

  function CompileCodepages(codepages) {
    codepages.__nsnames__ = {};
    codepages.__tagnames__ = {};
    codepages.__attrdata__ = {};

    for (var name in codepages) {
      var page = codepages[name];
      if (name.match(/^__/))
        continue;

      if (page.Tags) {
        // The upper byte(s) correspond to the namespace.
        var tagName, tagValue;
        for (tagName in page.Tags) {
          tagValue = page.Tags[tagName];
          codepages.__nsnames__[tagValue >> 8] = name;
          break;
        }

        for (tagName in page.Tags) {
          tagValue = page.Tags[tagName];
          codepages.__tagnames__[tagValue] = tagName;
        }
      }

      if (page.Attrs) {
        for (var attrName in page.Attrs) {
          var attrData = page.Attrs[attrName];
          if (!('name' in attrData))
            attrData.name = attrName;
          codepages.__attrdata__[attrData.value] = attrData;
          page.Attrs[attrName] = attrData.value;
        }
      }
    }
  }
  exports.CompileCodepages = CompileCodepages;

  var mib2str = {
      3: 'US-ASCII',
      4: 'ISO-8859-1',
      5: 'ISO-8859-2',
      6: 'ISO-8859-3',
      7: 'ISO-8859-4',
      8: 'ISO-8859-5',
      9: 'ISO-8859-6',
     10: 'ISO-8859-7',
     11: 'ISO-8859-8',
     12: 'ISO-8859-9',
     13: 'ISO-8859-10',
    106: 'UTF-8',
  };

  // TODO: Really, we should build our own map here with synonyms for the
  // various encodings, but this is a step in the right direction.
  var str2mib = {};
  for (var mibId in mib2str) {
    var mibStr = mib2str[mibId];
    str2mib[mibStr] = mibId;
  }

  function Element(ownerDocument, type, tag) {
    this.ownerDocument = ownerDocument;
    this.type = type;
    this._attrs = {};

    if (typeof tag === 'string') {
      var pieces = tag.split(':');
      if (pieces.length === 1) {
        this.localTagName = pieces[0];
      } else {
        this.namespaceName = pieces[0];
        this.localTagName = pieces[1];
      }
    }
    else {
      this.tag = tag;
      Object.defineProperties(this, {
        'namespace':     { get: function() { return this.tag >> 8; } },
        'localTag':      { get: function() { return this.tag & 0xff; } },
        'namespaceName': { get: function() {
          return this.ownerDocument._codepages.__nsnames__[this.namespace];
        } },
        'localTagName':  { get: function() {
          return this.ownerDocument._codepages.__tagnames__[this.tag];
        } },
      });
    }
  }
  exports.Element = Element;
  Element.prototype = {
    get tagName() {
      var ns = this.namespaceName;
      ns = ns ? ns + ':' : '';
      return ns + this.localTagName;
    },

    getAttributes: function() {
      var attributes = [];
      for (var name in this._attrs) {
        var pieces = this._attrs[name];
        var data = name.split(':');
        attributes.push({ name: name, namespace: data[0], localName: data[1],
                          value: this._getAttribute(pieces) });
      }
      return attributes;
    },

    getAttribute: function(attr) {
      if (typeof attr === 'number')
        attr = this.ownerDocument._codepages.__attrdata__[attr].name;
      else if (!(attr in this._attrs) && this.namespace !== null &&
               attr.indexOf(':') === -1)
        attr = this.namespaceName + ':' + attr;
      return this._getAttribute(this._attrs[attr]);
    },

    _getAttribute: function(pieces) {
      var strValue = '';
      var array = [];

      for (var i = 0; i < pieces.length; i++) {
        var hunk = pieces[i];
        if (hunk instanceof Extension) {
          if (strValue) {
            array.push(strValue);
            strValue = '';
          }
          array.push(hunk);
        }
        else if (typeof hunk === 'number') {
          strValue += this.ownerDocument._codepages.__attrdata__[hunk].data ||
                      '';
        }
        else {
          strValue += hunk;
        }
      }
      if (strValue)
        array.push(strValue);

      return array.length === 1 ? array[0] : array;
    },

    _addAttribute: function(attr) {
      if (typeof attr === 'string') {
        if (attr in this._attrs)
          throw new ParseError('attribute '+attr+' is repeated');
        return this._attrs[attr] = [];
      }
      else {
        var namespace = attr >> 8;
        var localAttr = attr & 0xff;

        var localName = this.ownerDocument._codepages.__attrdata__[localAttr]
                            .name;
        var nsName = this.ownerDocument._codepages.__nsnames__[namespace];
        var name = nsName + ':' + localName;

        if (name in this._attrs)
          throw new ParseError('attribute '+name+' is repeated');
        return this._attrs[name] = [attr];
      }
    },
  };

  function EndTag(ownerDocument) {
    this.ownerDocument = ownerDocument;
  }
  exports.EndTag = EndTag;
  EndTag.prototype = {
    get type() { return 'ETAG'; },
  };

  function Text(ownerDocument, textContent) {
    this.ownerDocument = ownerDocument;
    this.textContent = textContent;
  }
  exports.Text = Text;
  Text.prototype = {
    get type() { return 'TEXT'; },
  };

  function Extension(ownerDocument, subtype, index, value) {
    this.ownerDocument = ownerDocument;
    this.subtype = subtype;
    this.index = index;
    this.value = value;
  }
  exports.Extension = Extension;
  Extension.prototype = {
    get type() { return 'EXT'; },
  };

  function ProcessingInstruction(ownerDocument) {
    this.ownerDocument = ownerDocument;
  }
  exports.ProcessingInstruction = ProcessingInstruction;
  ProcessingInstruction.prototype = {
    get type() { return 'PI'; },

    get target() {
      if (typeof this.targetID === 'string')
        return this.targetID;
      else
        return this.ownerDocument._codepages.__attrdata__[this.targetID].name;
    },

    _setTarget: function(target) {
      this.targetID = target;
      if (typeof target === 'string')
        return this._data = [];
      else
        return this._data = [target];
    },

    // XXX: this seems impolite...
    _getAttribute: Element.prototype._getAttribute,

    get data() { return this._getAttribute(this._data); },
  };

  function Opaque(ownerDocument, data) {
    this.ownerDocument = ownerDocument;
    this.data = data;
  }
  exports.Opaque = Opaque;
  Opaque.prototype = {
    get type() { return 'OPAQUE'; },
  };

  function Reader(data, codepages) {
    this._data = data instanceof Writer ? data.bytes : data;
    this._codepages = codepages;
    this.rewind();
  }
  exports.Reader = Reader;
  Reader.prototype = {
    _get_uint8: function() {
      if (this._index === this._data.length)
        throw EndOfData;
      return this._data[this._index++];
    },

    _get_mb_uint32: function() {
      var b;
      var result = 0;
      do {
        b = this._get_uint8();
        result = result*128 + (b & 0x7f);
      } while(b & 0x80);
      return result;
    },

    _get_slice: function(length) {
      var start = this._index;
      this._index += length;
      return this._data.subarray(start, this._index);
    },

    _get_c_string: function() {
      var start = this._index;
      while (this._get_uint8());
      return this._data.subarray(start, this._index - 1);
    },

    rewind: function() {
      // Although in theory we could cache this.document since we no longer use
      // iterators, there is clearly some kind of rep exposure that goes awry
      // for us, so I'm having us re-do our work.  This does not matter in the
      // normal use-case, just for debugging and just for our test server, which
      // both rely on rewind().

      this._index = 0;

      var v = this._get_uint8();
      this.version = ((v & 0xf0) + 1).toString() + '.' + (v & 0x0f).toString();
      this.pid = this._get_mb_uint32();
      this.charset = mib2str[this._get_mb_uint32()] || 'unknown';
      this._decoder = new TextDecoder(this.charset);

      var tbl_len = this._get_mb_uint32();
      this.strings = new StringTable(this._get_slice(tbl_len), this._decoder);

      this.document = this._getDocument();
    },

    // start        = version publicid charset strtbl body
    // strtbl       = length *byte
    // body         = *pi element *pi
    // element      = stag [ 1*attribute END ] [ *content END ]
    //
    // content      = element | string | extension | entity | pi | opaque
    //
    // stag         = TAG | ( LITERAL index )
    // attribute    = attrStart *attrValue
    // attrStart    = ATTRSTART | ( LITERAL index )
    // attrValue    = ATTRVALUE | string | extension | entity
    //
    // extension    = ( EXT_I termstr ) | ( EXT_T index ) | EXT
    //
    // string       = inline | tableref
    // inline       = STR_I termstr
    // tableref     = STR_T index
    //
    // entity       = ENTITY entcode
    // entcode      = mb_u_int32            // UCS-4 character code
    //
    // pi           = PI attrStart *attrValue END
    //
    // opaque       = OPAQUE length *byte
    //
    // version      = u_int8 containing WBXML version number
    // publicid     = mb_u_int32 | ( zero index )
    // charset      = mb_u_int32
    // termstr      = charset-dependent string with termination
    // index        = mb_u_int32            // integer index into string table.
    // length       = mb_u_int32            // integer length.
    // zero         = u_int8                // containing the value zero (0).
    _getDocument: function() {
      // Parser states
      var States = {
        BODY: 0,
        ATTRIBUTES: 1,
        ATTRIBUTE_PI: 2,
      };

      var state = States.BODY;
      var currentNode;
      var currentAttr;
      var codepage = 0;
      var depth = 0;
      var foundRoot = false;
      var doc = [];

      var appendString = (function(s) {
        if (state === States.BODY) {
          if (!currentNode)
            currentNode = new Text(this, s);
          else
            currentNode.textContent += s;
        }
        else { // if (state === States.ATTRIBUTES || state === States.ATTRIBUTE_PI)
          currentAttr.push(s);
        }
        // We can assume that we're in a valid state, so don't bother checking
        // here.
      }).bind(this);

      try { while (true) {
        var tok = this._get_uint8();

        if (tok === Tokens.SWITCH_PAGE) {
          codepage = this._get_uint8();
          if (!(codepage in this._codepages.__nsnames__))
            throw new ParseError('unknown codepage '+codepage);
        }
        else if (tok === Tokens.END) {
          if (state === States.BODY && depth-- > 0) {
            if (currentNode) {
              doc.push(currentNode);
              currentNode = null;
            }
            doc.push(new EndTag(this));
          }
          else if (state === States.ATTRIBUTES || state === States.ATTRIBUTE_PI) {
            state = States.BODY;

            doc.push(currentNode);
            currentNode = null;
            currentAttr = null;
          }
          else {
            throw new ParseError('unexpected END token');
          }
        }
        else if (tok === Tokens.ENTITY) {
          if (state === States.BODY && depth === 0)
            throw new ParseError('unexpected ENTITY token');
          var e = this._get_mb_uint32();
          appendString('&#'+e+';');
        }
        else if (tok === Tokens.STR_I) {
          if (state === States.BODY && depth === 0)
            throw new ParseError('unexpected STR_I token');
          appendString(this._decoder.decode(this._get_c_string()));
        }
        else if (tok === Tokens.PI) {
          if (state !== States.BODY)
            throw new ParseError('unexpected PI token');
          state = States.ATTRIBUTE_PI;

          if (currentNode)
            doc.push(currentNode);
          currentNode = new ProcessingInstruction(this);
        }
        else if (tok === Tokens.STR_T) {
          if (state === States.BODY && depth === 0)
            throw new ParseError('unexpected STR_T token');
          var r = this._get_mb_uint32();
          appendString(this.strings.get(r));
        }
        else if (tok === Tokens.OPAQUE) {
          if (state !== States.BODY)
            throw new ParseError('unexpected OPAQUE token');
          var len = this._get_mb_uint32();
          var data = this._get_slice(len);

          if (currentNode) {
            doc.push(currentNode);
            currentNode = null;
          }
          doc.push(new Opaque(this, data));
        }
        else if (((tok & 0x40) || (tok & 0x80)) && (tok & 0x3f) < 3) {
          var hi = tok & 0xc0;
          var lo = tok & 0x3f;
          var subtype;
          var value;

          if (hi === Tokens.EXT_I_0) {
            subtype = 'string';
            value = this._decoder.decode(this._get_c_string());
          }
          else if (hi === Tokens.EXT_T_0) {
            subtype = 'integer';
            value = this._get_mb_uint32();
          }
          else { // if (hi === Tokens.EXT_0)
            subtype = 'byte';
            value = null;
          }

          var ext = new Extension(this, subtype, lo, value);
          if (state === States.BODY) {
            if (currentNode) {
              doc.push(currentNode);
              currentNode = null;
            }
            doc.push(ext);
          }
          else { // if (state === States.ATTRIBUTES || state === States.ATTRIBUTE_PI)
            currentAttr.push(ext);
          }
        }
        else if (state === States.BODY) {
          if (depth === 0) {
            if (foundRoot)
              throw new ParseError('multiple root nodes found');
            foundRoot = true;
          }

          var tag = (codepage << 8) + (tok & 0x3f);
          if ((tok & 0x3f) === Tokens.LITERAL) {
            var r = this._get_mb_uint32();
            tag = this.strings.get(r);
          }

          if (currentNode)
            doc.push(currentNode);
          currentNode = new Element(this, (tok & 0x40) ? 'STAG' : 'TAG', tag);
          if (tok & 0x40)
            depth++;

          if (tok & 0x80) {
            state = States.ATTRIBUTES;
          }
          else {
            state = States.BODY;

            doc.push(currentNode);
            currentNode = null;
          }
        }
        else { // if (state === States.ATTRIBUTES || state === States.ATTRIBUTE_PI)
          var attr = (codepage << 8) + tok;
          if (!(tok & 0x80)) {
            if (tok === Tokens.LITERAL) {
              var r = this._get_mb_uint32();
              attr = this.strings.get(r);
            }
            if (state === States.ATTRIBUTE_PI) {
              if (currentAttr)
                throw new ParseError('unexpected attribute in PI');
              currentAttr = currentNode._setTarget(attr);
            }
            else {
              currentAttr = currentNode._addAttribute(attr);
            }
          }
          else {
            currentAttr.push(attr);
          }
        }
      } } catch (e) {
        if (e !== EndOfData)
          throw e;
      }
      return doc;
    },

    dump: function(indentation, header) {
      var result = '';

      if (indentation === undefined)
        indentation = 2;
      var indent = function(level) {
        return new Array(level*indentation + 1).join(' ');
      };
      var tagstack = [];

      if (header) {
        result += 'Version: ' + this.version + '\n';
        result += 'Public ID: ' + this.pid + '\n';
        result += 'Charset: ' + this.charset + '\n';
        result += 'String table:\n  "' +
                  this.strings.strings.join('"\n  "') + '"\n\n';
      }

      var newline = false;
      var doc = this.document;
      var doclen = doc.length;
      for (var iNode = 0; iNode < doclen; iNode++) {
        var node = doc[iNode];
        if (node.type === 'TAG' || node.type === 'STAG') {
          result += indent(tagstack.length) + '<' + node.tagName;

          var attributes = node.getAttributes();
          for (var i = 0; i < attributes.length; i++) {
            var attr = attributes[i];
            result += ' ' + attr.name + '="' + attr.value + '"';
          }

          if (node.type === 'STAG') {
            tagstack.push(node.tagName);
            result += '>\n';
          }
          else
            result += '/>\n';
        }
        else if (node.type === 'ETAG') {
          var tag = tagstack.pop();
          result += indent(tagstack.length) + '</' + tag + '>\n';
        }
        else if (node.type === 'TEXT') {
          result += indent(tagstack.length) + node.textContent + '\n';
        }
        else if (node.type === 'PI') {
          result += indent(tagstack.length) + '<?' + node.target;
          if (node.data)
            result += ' ' + node.data;
          result += '?>\n';
        }
        else if (node.type === 'OPAQUE') {
          result += indent(tagstack.length) + '<![CDATA[' + node.data + ']]>\n';
        }
        else {
          throw new Error('Unknown node type "' + node.type + '"');
        }
      }

      return result;
    },
  };

  /**
   * @param version {String}
   *   WBXML version. v1.1 is the most recent W3C spec.  The Open Mobile
   *   Alliance spec version is v1.3.
   * @param pid {Number}
   *   The public identifier.  Popular choices include 0 (it's in the string
   *   table) and 1 (Unknown/missing).  ActiveSync uses 1.  Check your standard
   *   for other values.
   * @param charset {String}
   *   This must be 'UTF-8', but conceptually it's the string value of an IANA
   *   allocated MIB enum.  This must be UTF-8 because we use TextEncoder and
   *   it only likes to encode into UTF-8 and UTF-16 to make the world a better
   *   place.  We could support UTF-16 if we added a MIB entry, probably.
   * @param [strings=null] {String[]}
   *   A list of strings to encode into the string table.  Use `str_t` to
   *   reference the string table by offset.  You'll want to provide an
   *   enhancement if you really want to use this functionality because it
   *   would be horribly painful to use as it exists.
   * @param [dataType="arraybuffer"] {String}
   *   The type of output desired from the Writer.  Currently supported values
   *   are "arraybuffer" (the default) and "blob".  You must use "blob" if you
   *   want to write Blobs into the output (currently only supported for use
   *   by opaque()).  If using "arraybuffer", retrieve your output from the
   *   `buffer` or `bytes` getters.  If using "blob", retrieve it using `blob`.
   */
  function Writer(version, pid, charset, strings, dataType) {
    // When creating a Blob for output, we use our normal _rawbuf/_buffer/_pos
    // logic until a Blob gets written via opaque().  At that point we wrap the
    // ArrayBuffer into a Blob, push it into _blobs, and reset the ArrayBuffer
    // state.
    if (dataType === 'blob')
      this._blobs = [];
    else
      this._blobs = null;
    this.dataType = dataType || 'arraybuffer';
    this._rawbuf = new ArrayBuffer(1024);
    this._buffer = new Uint8Array(this._rawbuf);
    this._pos = 0;
    this._codepage = 0;
    this._tagStack = [];

    /**
     * @private
     * @property _rootTagValue
     * @type Number|null
     *
     * The tag value of the first tag written to the buffer, or null if no
     * tag has yet been written.  This is used by jsas's postCommand helper
     * method to extract the command from an already-written string as a caller
     * convenience.  It is publicly exposed via the `firstLocalTagName` getter.
     */
    this._rootTagValue = null;

    var infos = version.split('.').map(function(x) {
      return parseInt(x);
    });
    var major = infos[0], minor = infos[1];
    var v = ((major - 1) << 4) + minor;

    var charsetNum = charset;
    if (typeof charset === 'string') {
      charsetNum = str2mib[charset];
      if (charsetNum === undefined)
        throw new Error('unknown charset '+charset);
    }
    var encoder = this._encoder = new TextEncoder(charset);

    this._write(v);
    this._write(pid);
    this._write(charsetNum);
    if (strings) {
      var bytes = strings.map(function(s) { return encoder.encode(s); });
      var len = bytes.reduce(function(x, y) { return x + y.length + 1; }, 0);
      this._write_mb_uint32(len);
      for (var i = 0; i < bytes.length; i++) {
        var b = bytes[i];
        this._write_bytes(b);
        this._write(0x00);
      }
    }
    else {
      this._write(0x00);
    }
  }
  exports.Writer = Writer;

  Writer.Attribute = function(name, value) {
    this.isValue = typeof name === 'number' && (name & 0x80);
    if (this.isValue && value !== undefined)
      throw new Error("Can't specify a value for attribute value constants");
    this.name = name;
    this.value = value;
  };

  Writer.StringTableRef = function(index) {
    this.index = index;
  };

  Writer.Entity = function(code) {
    this.code = code;
  };

  Writer.Extension = function(subtype, index, data) {
    var validTypes = {
      'string':  { value:     Tokens.EXT_I_0,
                   validator: function(data) {
                     return typeof data === 'string';
                   } },
      'integer': { value:     Tokens.EXT_T_0,
                   validator: function(data) {
                     return typeof data === 'number';
                   } },
      'byte':    { value:     Tokens.EXT_0,
                   validator: function(data) {
                     return data === null || data === undefined;
                   } },
    };

    var info = validTypes[subtype];
    if (!info)
      throw new Error('Invalid WBXML Extension type');
    if (!info.validator(data))
      throw new Error('Data for WBXML Extension does not match type');
    if (index !== 0 && index !== 1 && index !== 2)
      throw new Error('Invalid WBXML Extension index');

    this.subtype = info.value;
    this.index = index;
    this.data = data;
  };

  Writer.a = function(name, val) { return new Writer.Attribute(name, val); };
  Writer.str_t = function(index) { return new Writer.StringTableRef(index); };
  Writer.ent = function(code) { return new Writer.Entity(code); };
  Writer.ext = function(subtype, index, data) { return new Writer.Extension(
    subtype, index, data); };

  Writer.prototype = {
    _write: function(tok) {
      // Expand the buffer by a factor of two if we ran out of space.
      if (this._pos === this._buffer.length - 1) {
        this._rawbuf = new ArrayBuffer(this._rawbuf.byteLength * 2);
        var buffer = new Uint8Array(this._rawbuf);

        for (var i = 0; i < this._buffer.length; i++)
          buffer[i] = this._buffer[i];

        this._buffer = buffer;
      }

      this._buffer[this._pos++] = tok;
    },

    _write_mb_uint32: function(value) {
      var bytes = [];
      bytes.push(value % 0x80);
      while (value >= 0x80) {
        value >>= 7;
        bytes.push(0x80 + (value % 0x80));
      }

      for (var i = bytes.length - 1; i >= 0; i--)
        this._write(bytes[i]);
    },

    _write_bytes: function(bytes) {
      for (var i = 0; i < bytes.length; i++)
        this._write(bytes[i]);
    },

    _write_str: function(str) {
      this._write_bytes(this._encoder.encode(str));
    },

    _setCodepage: function(codepage) {
      if (this._codepage !== codepage) {
        this._write(Tokens.SWITCH_PAGE);
        this._write(codepage);
        this._codepage = codepage;
      }
    },

    _writeTag: function(tag, stag, attrs) {
      if (tag === undefined)
        throw new Error('unknown tag');

      var flags = 0x00;
      if (stag)
        flags += 0x40;
      if (attrs.length)
        flags += 0x80;

      if (tag instanceof Writer.StringTableRef) {
        this._write(Tokens.LITERAL + flags);
        this._write_mb_uint32(tag.index);
      }
      else {
        this._setCodepage(tag >> 8);
        this._write((tag & 0xff) + flags);
        if (!this._rootTagValue)
          this._rootTagValue = tag;
      }

      if (attrs.length) {
        for (var i = 0; i < attrs.length; i++) {
          var attr = attrs[i];
          this._writeAttr(attr);
        }
        this._write(Tokens.END);
      }
    },

    _writeAttr: function(attr) {
      if (!(attr instanceof Writer.Attribute))
        throw new Error('Expected an Attribute object');
      if (attr.isValue)
        throw new Error("Can't use attribute value constants here");

      if (attr.name instanceof Writer.StringTableRef) {
        this._write(Tokens.LITERAL);
        this._write(attr.name.index);
      }
      else {
        this._setCodepage(attr.name >> 8);
        this._write(attr.name & 0xff);
      }
      this._writeText(attr.value, true);
    },

    _writeText: function(value, inAttr) {
      if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i++) {
          var piece = value[i];
          this._writeText(piece, inAttr);
        }
      }
      else if (value instanceof Writer.StringTableRef) {
        this._write(Tokens.STR_T);
        this._write_mb_uint32(value.index);
      }
      else if (value instanceof Writer.Entity) {
        this._write(Tokens.ENTITY);
        this._write_mb_uint32(value.code);
      }
      else if (value instanceof Writer.Extension) {
        this._write(value.subtype + value.index);
        if (value.subtype === Tokens.EXT_I_0) {
          this._write_str(value.data);
          this._write(0x00);
        }
        else if (value.subtype === Tokens.EXT_T_0) {
          this._write_mb_uint32(value.data);
        }
      }
      else if (value instanceof Writer.Attribute) {
        if (!value.isValue)
          throw new Error('Unexpected Attribute object');
        if (!inAttr)
          throw new Error("Can't use attribute value constants outside of " +
                          "attributes");
        this._setCodepage(value.name >> 8);
        this._write(value.name & 0xff);
      }
      else if (value !== null && value !== undefined) {
        this._write(Tokens.STR_I);
        this._write_str(value.toString());
        this._write(0x00);
      }
    },

    tag: function(tag) {
      var tail = arguments.length > 1 ? arguments[arguments.length - 1] : null;
      if (tail === null || tail instanceof Writer.Attribute) {
        var rest = Array.prototype.slice.call(arguments, 1);
        this._writeTag(tag, false, rest);
        return this;
      }
      else {
        var head = Array.prototype.slice.call(arguments, 0, -1);
        return this.stag.apply(this, head)
                     .text(tail)
                   .etag();
      }
    },

    stag: function(tag) {
      var rest = Array.prototype.slice.call(arguments, 1);
      this._writeTag(tag, true, rest);
      this._tagStack.push(tag);
      return this;
    },

    etag: function(tag) {
      if (this._tagStack.length === 0)
        throw new Error('Spurious etag() call!');
      var expectedTag = this._tagStack.pop();
      if (tag !== undefined && tag !== expectedTag)
        throw new Error('Closed the wrong tag');

      this._write(Tokens.END);
      return this;
    },

    text: function(value) {
      this._writeText(value);
      return this;
    },

    pi: function(target, data) {
      this._write(Tokens.PI);
      this._writeAttr(Writer.a(target, data));
      this._write(Tokens.END);
      return this;
    },

    ext: function(subtype, index, data) {
      return this.text(Writer.ext(subtype, index, data));
    },

    /**
     * Write opaque data. (OPAQUE token followed by data).
     *
     * @param data {String|TypedArray|Blob}
     *   You must have specified dataType=blob in the constructor to write a
     *   Blob.
     */
    opaque: function(data) {
      this._write(Tokens.OPAQUE);
      if (data instanceof Blob) {
        if (!this._blobs)
          throw new Error('Writer not opened in blob mode');
        this._write_mb_uint32(data.size);
        // Because we're forgetting about our typed array and its buffer, we
        // don't need to snapshot it with a Bool or new ArrayBuffer, etc.
        this._blobs.push(this.bytes);
        this._blobs.push(data);
        // reset out buffer state
        this._rawbuf = new ArrayBuffer(1024);
        this._buffer = new Uint8Array(this._rawbuf);
        this._pos = 0;
      }
      else if (typeof data === 'string') {
        this._write_mb_uint32(data.length);
        this._write_str(data);
      }
      else { // Array or Uint8Array
        this._write_mb_uint32(data.length);
        for (var i = 0; i < data.length; i++)
          this._write(data[i]);
      }
      return this;
    },

    /**
     * Returns a fresh ArrayBuffer containing the written data.
     *
     * @property buffer
     * @type ArrayBuffer
     */
    get buffer() { return this._rawbuf.slice(0, this._pos); },
    /**
     * Returns a Uint8Array view on the backing raw buffer.  The backing
     * ArrayBuffer will very likely be larger than the returned array, so be
     * careful about making assumptions about the backing buffer.
     *
     * @property bytes
     * @type Uint8Array
     */
    get bytes() { return new Uint8Array(this._rawbuf, 0, this._pos); },
    get blob() {
      if (!this._blobs)
        throw new Error("No blobs!");
      var useBlobs = this._blobs;
      // We don't have a concept of finalizing the stream right now, although
      // it's pretty unlikely anyone would write to us after this given the
      // semantics of XML documents...
      if (this._pos)
        useBlobs = useBlobs.concat([this.bytes]);
      // Our existing consumers don't care about a mime type right now, but
      // maybe there should be a way to specify one?
      var superBlob = new Blob(useBlobs);
      return superBlob;
    },

    /**
     * Return the tag value of the root tag of the WBXML document.
     */
    get rootTag() {
      return this._rootTagValue;
    },
  };

  function EventParser() {
    this.listeners = [];
    this.onerror = function(e) { throw e; };
  }
  exports.EventParser = EventParser;
  EventParser.prototype = {
    addEventListener: function(path, callback) {
      this.listeners.push({path: path, callback: callback});
    },

    _pathMatches: function(a, b) {
      return a.length === b.length && a.every(function(val, i) {
        if (b[i] === '*')
          return true;
        else if (Array.isArray(b[i])) {
          return b[i].indexOf(val) !== -1;
        }
        else
          return val === b[i];
      });
    },

    run: function(reader) {
      var fullPath = [];
      var recPath = [];
      var recording = 0;

      var doc = reader.document;
      var doclen = doc.length;
      var listeners = this.listeners, iListener, listener;
      for (var iNode = 0; iNode < doclen; iNode++) {
        var node = doc[iNode];
        if (node.type === 'TAG') {
          fullPath.push(node.tag);
          for (iListener = 0; iListener < listeners.length; iListener++) {
            listener = listeners[iListener];
            if (this._pathMatches(fullPath, listener.path)) {
              node.children = [];
              try {
                listener.callback(node);
              }
              catch (e) {
                if (this.onerror)
                  this.onerror(e);
              }
            }
          }

          fullPath.pop();
        }
        else if (node.type === 'STAG') {
          fullPath.push(node.tag);

          for (iListener = 0; iListener < listeners.length; iListener++) {
            listener = listeners[iListener];
            if (this._pathMatches(fullPath, listener.path)) {
              recording++;
            }
          }
        }
        else if (node.type === 'ETAG') {
          for (iListener = 0; iListener < listeners.length; iListener++) {
            listener = listeners[iListener];
            if (this._pathMatches(fullPath, listener.path)) {
              recording--;
              try {
                listener.callback(recPath[recPath.length-1]);
              }
              catch (e) {
                if (this.onerror)
                  this.onerror(e);
              }
            }
          }

          fullPath.pop();
        }

        if (recording) {
          if (node.type === 'STAG') {
            node.type = 'TAG';
            node.children = [];
            if (recPath.length)
              recPath[recPath.length-1].children.push(node);
            recPath.push(node);
          }
          else if (node.type === 'ETAG') {
            recPath.pop();
          }
          else {
            node.children = [];
            recPath[recPath.length-1].children.push(node);
          }
        }
      }
    },

    runGetNum: function(reader) {
      let fullPath = [];
      let recPath = [];
      let recording = 0;
      let addNum = 0;
      let asAdd = 7;  // AirSync.Add

      let doc = reader.document;
      let doclen = doc.length;
      let listeners = this.listeners, iListener, listener;
      for (let iNode = 0; iNode < doclen; iNode++) {
        let node = doc[iNode];
        if (node.type === 'TAG') {
          fullPath.push(node.tag);
          for (iListener = 0; iListener < listeners.length; iListener++) {
            listener = listeners[iListener];
            if (this._pathMatches(fullPath, listener.path)) {
              node.children = [];
              try {
                listener.callback(addNum);
              }
              catch (e) {
                if (this.onerror) {
                  this.onerror(e);
                }
              }
            }
          }

          fullPath.pop();
        } else if (node.type === 'STAG') {
          fullPath.push(node.tag);

          for (iListener = 0; iListener < listeners.length; iListener++) {
            listener = listeners[iListener];
            if (this._pathMatches(fullPath, listener.path)) {
              recording++;
            }
          }
        } else if (node.type === 'ETAG') {
          for (iListener = 0; iListener < listeners.length; iListener++) {
            listener = listeners[iListener];
            if (this._pathMatches(fullPath, listener.path)) {
              recording--;
              try {
                listener.callback(addNum);
              }
              catch (e) {
                if (this.onerror) {
                  this.onerror(e);
                }
              }
            }
          }

          fullPath.pop();
        }

        if (recording && node.type === 'STAG' && node.tag === asAdd) {
          addNum++;
        }
      }
    },
  };

  return exports;
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPCommon = factory();
// }(this, function() {
define('activesync/codepages/Common',['require','exports','module'],function(require, exports, module) {
  

  return {
    Enums: {
      Status: {
        InvalidContent:                                  '101',
        InvalidWBXML:                                    '102',
        InvalidXML:                                      '103',
        InvalidDateTime:                                 '104',
        InvalidCombinationOfIDs:                         '105',
        InvalidIDs:                                      '106',
        InvalidMIME:                                     '107',
        DeviceIdMissingOrInvalid:                        '108',
        DeviceTypeMissingOrInvalid:                      '109',
        ServerError:                                     '110',
        ServerErrorRetryLater:                           '111',
        ActiveDirectoryAccessDenied:                     '112',
        MailboxQuotaExceeded:                            '113',
        MailboxServerOffline:                            '114',
        SendQuotaExceeded:                               '115',
        MessageRecipientUnresolved:                      '116',
        MessageReplyNotAllowed:                          '117',
        MessagePreviouslySent:                           '118',
        MessageHasNoRecipient:                           '119',
        MailSubmissionFailed:                            '120',
        MessageReplyFailed:                              '121',
        AttachmentIsTooLarge:                            '122',
        UserHasNoMailbox:                                '123',
        UserCannotBeAnonymous:                           '124',
        UserPrincipalCouldNotBeFound:                    '125',
        UserDisabledForSync:                             '126',
        UserOnNewMailboxCannotSync:                      '127',
        UserOnLegacyMailboxCannotSync:                   '128',
        DeviceIsBlockedForThisUser:                      '129',
        AccessDenied:                                    '130',
        AccountDisabled:                                 '131',
        SyncStateNotFound:                               '132',
        SyncStateLocked:                                 '133',
        SyncStateCorrupt:                                '134',
        SyncStateAlreadyExists:                          '135',
        SyncStateVersionInvalid:                         '136',
        CommandNotSupported:                             '137',
        VersionNotSupported:                             '138',
        DeviceNotFullyProvisionable:                     '139',
        RemoteWipeRequested:                             '140',
        LegacyDeviceOnStrictPolicy:                      '141',
        DeviceNotProvisioned:                            '142',
        PolicyRefresh:                                   '143',
        InvalidPolicyKey:                                '144',
        ExternallyManagedDevicesNotAllowed:              '145',
        NoRecurrenceInCalendar:                          '146',
        UnexpectedItemClass:                             '147',
        RemoteServerHasNoSSL:                            '148',
        InvalidStoredRequest:                            '149',
        ItemNotFound:                                    '150',
        TooManyFolders:                                  '151',
        NoFoldersFounds:                                 '152',
        ItemsLostAfterMove:                              '153',
        FailureInMoveOperation:                          '154',
        MoveCommandDisallowedForNonPersistentMoveAction: '155',
        MoveCommandInvalidDestinationFolder:             '156',
        AvailabilityTooManyRecipients:                   '160',
        AvailabilityDLLimitReached:                      '161',
        AvailabilityTransientFailure:                    '162',
        AvailabilityFailure:                             '163',
        BodyPartPreferenceTypeNotSupported:              '164',
        DeviceInformationRequired:                       '165',
        InvalidAccountId:                                '166',
        AccountSendDisabled:                             '167',
        IRM_FeatureDisabled:                             '168',
        IRM_TransientError:                              '169',
        IRM_PermanentError:                              '170',
        IRM_InvalidTemplateID:                           '171',
        IRM_OperationNotPermitted:                       '172',
        NoPicture:                                       '173',
        PictureTooLarge:                                 '174',
        PictureLimitReached:                             '175',
        BodyPart_ConversationTooLarge:                   '176',
        MaximumDevicesReached:                           '177',
        InvalidMimeBodyCombination:                      '178',
        InvalidSmartForwardParameters:                   '179',
        InvalidRecipients:                               '183',
        OneOrMoreExceptionsFailed:                       '184'
      }
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPAirSync = factory();
// }(this, function() {
define('activesync/codepages/AirSync',['require','exports','module'],function(require, exports, module) {
  
  return {
    Tags: {
      Sync:              0x0005,
      Responses:         0x0006,
      Add:               0x0007,
      Change:            0x0008,
      Delete:            0x0009,
      Fetch:             0x000A,
      SyncKey:           0x000B,
      ClientId:          0x000C,
      ServerId:          0x000D,
      Status:            0x000E,
      Collection:        0x000F,
      Class:             0x0010,
      Version:           0x0011,
      CollectionId:      0x0012,
      GetChanges:        0x0013,
      MoreAvailable:     0x0014,
      WindowSize:        0x0015,
      Commands:          0x0016,
      Options:           0x0017,
      FilterType:        0x0018,
      Truncation:        0x0019,
      RtfTruncation:     0x001A,
      Conflict:          0x001B,
      Collections:       0x001C,
      ApplicationData:   0x001D,
      DeletesAsMoves:    0x001E,
      NotifyGUID:        0x001F,
      Supported:         0x0020,
      SoftDelete:        0x0021,
      MIMESupport:       0x0022,
      MIMETruncation:    0x0023,
      Wait:              0x0024,
      Limit:             0x0025,
      Partial:           0x0026,
      ConversationMode:  0x0027,
      MaxItems:          0x0028,
      HeartbeatInterval: 0x0029,
    },

    Enums: {
      Status: {
        Success:            '1',
        InvalidSyncKey:     '3',
        ProtocolError:      '4',
        ServerError:        '5',
        ConversionError:    '6',
        MatchingConflict:   '7',
        ObjectNotFound:     '8',
        OutOfSpace:         '9',
        HierarchyChanged:  '12',
        IncompleteRequest: '13',
        InvalidInterval:   '14',
        InvalidRequest:    '15',
        Retry:             '16',
      },
      FilterType: {
        NoFilter:        '0',
        OneDayBack:      '1',
        ThreeDaysBack:   '2',
        OneWeekBack:     '3',
        TwoWeeksBack:    '4',
        OneMonthBack:    '5',
        ThreeMonthsBack: '6',
        SixMonthsBack:   '7',
        IncompleteTasks: '8',
      },
      Conflict: {
        ClientReplacesServer: '0',
        ServerReplacesClient: '1',
      },
      MIMESupport: {
        Never:     '0',
        SMIMEOnly: '1',
        Always:    '2',
      },
      MIMETruncation: {
        TruncateAll:  '0',
        Truncate4K:   '1',
        Truncate5K:   '2',
        Truncate7K:   '3',
        Truncate10K:  '4',
        Truncate20K:  '5',
        Truncate50K:  '6',
        Truncate100K: '7',
        NoTruncate:   '8',
      },
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPContacts = factory();
// }(this, function() {
define('activesync/codepages/Contacts',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      Anniversary:               0x0105,
      AssistantName:             0x0106,
      AssistantPhoneNumber:      0x0107,
      Birthday:                  0x0108,
      Body:                      0x0109,
      BodySize:                  0x010A,
      BodyTruncated:             0x010B,
      Business2PhoneNumber:      0x010C,
      BusinessAddressCity:       0x010D,
      BusinessAddressCountry:    0x010E,
      BusinessAddressPostalCode: 0x010F,
      BusinessAddressState:      0x0110,
      BusinessAddressStreet:     0x0111,
      BusinessFaxNumber:         0x0112,
      BusinessPhoneNumber:       0x0113,
      CarPhoneNumber:            0x0114,
      Categories:                0x0115,
      Category:                  0x0116,
      Children:                  0x0117,
      Child:                     0x0118,
      CompanyName:               0x0119,
      Department:                0x011A,
      Email1Address:             0x011B,
      Email2Address:             0x011C,
      Email3Address:             0x011D,
      FileAs:                    0x011E,
      FirstName:                 0x011F,
      Home2PhoneNumber:          0x0120,
      HomeAddressCity:           0x0121,
      HomeAddressCountry:        0x0122,
      HomeAddressPostalCode:     0x0123,
      HomeAddressState:          0x0124,
      HomeAddressStreet:         0x0125,
      HomeFaxNumber:             0x0126,
      HomePhoneNumber:           0x0127,
      JobTitle:                  0x0128,
      LastName:                  0x0129,
      MiddleName:                0x012A,
      MobilePhoneNumber:         0x012B,
      OfficeLocation:            0x012C,
      OtherAddressCity:          0x012D,
      OtherAddressCountry:       0x012E,
      OtherAddressPostalCode:    0x012F,
      OtherAddressState:         0x0130,
      OtherAddressStreet:        0x0131,
      PagerNumber:               0x0132,
      RadioPhoneNumber:          0x0133,
      Spouse:                    0x0134,
      Suffix:                    0x0135,
      Title:                     0x0136,
      WebPage:                   0x0137,
      YomiCompanyName:           0x0138,
      YomiFirstName:             0x0139,
      YomiLastName:              0x013A,
      CompressedRTF:             0x013B,
      Picture:                   0x013C,
      Alias:                     0x013D,
      WeightedRank:              0x013E,
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPEmail = factory();
// }(this, function() {
define('activesync/codepages/Email',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      Attachment:              0x0205,
      Attachments:             0x0206,
      AttName:                 0x0207,
      AttSize:                 0x0208,
      Att0Id:                  0x0209,
      AttMethod:               0x020A,
      AttRemoved:              0x020B,
      Body:                    0x020C,
      BodySize:                0x020D,
      BodyTruncated:           0x020E,
      DateReceived:            0x020F,
      DisplayName:             0x0210,
      DisplayTo:               0x0211,
      Importance:              0x0212,
      MessageClass:            0x0213,
      Subject:                 0x0214,
      Read:                    0x0215,
      To:                      0x0216,
      Cc:                      0x0217,
      From:                    0x0218,
      ReplyTo:                 0x0219,
      AllDayEvent:             0x021A,
      Categories:              0x021B,
      Category:                0x021C,
      DTStamp:                 0x021D,
      EndTime:                 0x021E,
      InstanceType:            0x021F,
      BusyStatus:              0x0220,
      Location:                0x0221,
      MeetingRequest:          0x0222,
      Organizer:               0x0223,
      RecurrenceId:            0x0224,
      Reminder:                0x0225,
      ResponseRequested:       0x0226,
      Recurrences:             0x0227,
      Recurrence:              0x0228,
      Recurrence_Type:         0x0229,
      Recurrence_Until:        0x022A,
      Recurrence_Occurrences:  0x022B,
      Recurrence_Interval:     0x022C,
      Recurrence_DayOfWeek:    0x022D,
      Recurrence_DayOfMonth:   0x022E,
      Recurrence_WeekOfMonth:  0x022F,
      Recurrence_MonthOfYear:  0x0230,
      StartTime:               0x0231,
      Sensitivity:             0x0232,
      TimeZone:                0x0233,
      GlobalObjId:             0x0234,
      ThreadTopic:             0x0235,
      MIMEData:                0x0236,
      MIMETruncated:           0x0237,
      MIMESize:                0x0238,
      InternetCPID:            0x0239,
      Flag:                    0x023A,
      Status:                  0x023B,
      ContentClass:            0x023C,
      FlagType:                0x023D,
      CompleteTime:            0x023E,
      DisallowNewTimeProposal: 0x023F
    },
    Enums: {
      Importance: {
        Low:    '0',
        Normal: '1',
        High:   '2',
      },
      InstanceType: {
        Single:             '0',
        RecurringMaster:    '1',
        RecurringInstance:  '2',
        RecurringException: '3',
      },
      BusyStatus: {
        Free:      '0',
        Tentative: '1',
        Busy:      '2',
        Oof:       '3',
      },
      Recurrence_Type: {
        Daily:             '0',
        Weekly:             '1',
        MonthlyNthDay:      '2',
        Monthly:            '3',
        YearlyNthDay:       '5',
        YearlyNthDayOfWeek: '6',
      },
      /* XXX: missing Recurrence_DayOfWeek */
      Sensitivity: {
        Normal:       '0',
        Personal:     '1',
        Private:      '2',
        Confidential: '3',
      },
      Status: {
        Cleared:  '0',
        Complete: '1',
        Active:   '2',
      },
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPCalendar = factory();
// }(this, function() {
define('activesync/codepages/Calendar',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      TimeZone:                  0x0405,
      AllDayEvent:               0x0406,
      Attendees:                 0x0407,
      Attendee:                  0x0408,
      Email:                     0x0409,
      Name:                      0x040A,
      Body:                      0x040B,
      BodyTruncated:             0x040C,
      BusyStatus:                0x040D,
      Categories:                0x040E,
      Category:                  0x040F,
      CompressedRTF:             0x0410,
      DtStamp:                   0x0411,
      EndTime:                   0x0412,
      Exception:                 0x0413,
      Exceptions:                0x0414,
      Deleted:                   0x0415,
      ExceptionStartTime:        0x0416,
      Location:                  0x0417,
      MeetingStatus:             0x0418,
      OrganizerEmail:            0x0419,
      OrganizerName:             0x041A,
      Recurrence:                0x041B,
      Type:                      0x041C,
      Until:                     0x041D,
      Occurrences:               0x041E,
      Interval:                  0x041F,
      DayOfWeek:                 0x0420,
      DayOfMonth:                0x0421,
      WeekOfMonth:               0x0422,
      MonthOfYear:               0x0423,
      Reminder:                  0x0424,
      Sensitivity:               0x0425,
      Subject:                   0x0426,
      StartTime:                 0x0427,
      UID:                       0x0428,
      AttendeeStatus:            0x0429,
      AttendeeType:              0x042A,
      Attachment:                0x042B,
      Attachments:               0x042C,
      AttName:                   0x042D,
      AttSize:                   0x042E,
      AttOid:                    0x042F,
      AttMethod:                 0x0430,
      AttRemoved:                0x0431,
      DisplayName:               0x0432,
      DisallowNewTimeProposal:   0x0433,
      ResponseRequested:         0x0434,
      AppointmentReplyTime:      0x0435,
      ResponseType:              0x0436,
      CalendarType:              0x0437,
      IsLeapMonth:               0x0438,
      FirstDayOfWeek:            0x0439,
      OnlineMeetingConfLink:     0x043A,
      OnlineMeetingExternalLink: 0x043B,
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPMove = factory();
// }(this, function() {
define('activesync/codepages/Move',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      MoveItems: 0x0505,
      Move:      0x0506,
      SrcMsgId:  0x0507,
      SrcFldId:  0x0508,
      DstFldId:  0x0509,
      Response:  0x050A,
      Status:    0x050B,
      DstMsgId:  0x050C,
    },
    Enums: {
      Status: {
        InvalidSourceID: '1',
        InvalidDestID:   '2',
        Success:         '3',
        SourceIsDest:    '4',
        MoveFailure:     '5',
        ItemLocked:      '7',
      },
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPItemEstimate = factory();
// }(this, function() {
define('activesync/codepages/ItemEstimate',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      GetItemEstimate: 0x0605,
      Version:         0x0606,
      Collections:     0x0607,
      Collection:      0x0608,
      Class:           0x0609,
      CollectionId:    0x060A,
      DateTime:        0x060B,
      Estimate:        0x060C,
      Response:        0x060D,
      Status:          0x060E,
    },
    Enums: {
      Status: {
        Success:           '1',
        InvalidCollection: '2',
        NoSyncState:       '3',
        InvalidSyncKey:    '4',
      },
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPHierarchy = factory();
// }(this, function() {
define('activesync/codepages/FolderHierarchy',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      Folders:      0x0705,
      Folder:       0x0706,
      DisplayName:  0x0707,
      ServerId:     0x0708,
      ParentId:     0x0709,
      Type:         0x070A,
      Response:     0x070B,
      Status:       0x070C,
      ContentClass: 0x070D,
      Changes:      0x070E,
      Add:          0x070F,
      Delete:       0x0710,
      Update:       0x0711,
      SyncKey:      0x0712,
      FolderCreate: 0x0713,
      FolderDelete: 0x0714,
      FolderUpdate: 0x0715,
      FolderSync:   0x0716,
      Count:        0x0717,
    },
    Enums: {
      Type: {
        Generic:         '1',
        DefaultInbox:    '2',
        DefaultDrafts:   '3',
        DefaultDeleted:  '4',
        DefaultSent:     '5',
        DefaultOutbox:   '6',
        DefaultTasks:    '7',
        DefaultCalendar: '8',
        DefaultContacts: '9',
        DefaultNotes:   '10',
        DefaultJournal: '11',
        Mail:           '12',
        Calendar:       '13',
        Contacts:       '14',
        Tasks:          '15',
        Journal:        '16',
        Notes:          '17',
        Unknown:        '18',
        RecipientCache: '19',
      },
      Status: {
        Success:              '1',
        FolderExists:         '2',
        SystemFolder:         '3',
        FolderNotFound:       '4',
        ParentFolderNotFound: '5',
        ServerError:          '6',
        InvalidSyncKey:       '9',
        MalformedRequest:    '10',
        UnknownError:        '11',
        CodeUnknown:         '12',
      }
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPMeetingResponse = factory();
// }(this, function() {
define('activesync/codepages/MeetingResponse',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      CalendarId:      0x0805,
      CollectionId:    0x0806,
      MeetingResponse: 0x0807,
      RequestId:       0x0808,
      Request:         0x0809,
      Result:          0x080A,
      Status:          0x080B,
      UserResponse:    0x080C,
      InstanceId:      0x080E,
    },
    Enums: {
      Status: {
        Success:        '1',
        InvalidRequest: '2',
        MailboxError:   '3',
        ServerError:    '4',
      },
      UserResponse: {
        Accepted:  '1',
        Tentative: '2',
        Declined:  '3',
      },
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPTasks = factory();
// }(this, function() {
define('activesync/codepages/Tasks',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      Body:                   0x0905,
      BodySize:               0x0906,
      BodyTruncated:          0x0907,
      Categories:             0x0908,
      Category:               0x0909,
      Complete:               0x090A,
      DateCompleted:          0x090B,
      DueDate:                0x090C,
      UtcDueDate:             0x090D,
      Importance:             0x090E,
      Recurrence:             0x090F,
      Recurrence_Type:        0x0910,
      Recurrence_Start:       0x0911,
      Recurrence_Until:       0x0912,
      Recurrence_Occurrences: 0x0913,
      Recurrence_Interval:    0x0914,
      Recurrence_DayOfMonth:  0x0915,
      Recurrence_DayOfWeek:   0x0916,
      Recurrence_WeekOfMonth: 0x0917,
      Recurrence_MonthOfYear: 0x0918,
      Recurrence_Regenerate:  0x0919,
      Recurrence_DeadOccur:   0x091A,
      ReminderSet:            0x091B,
      ReminderTime:           0x091C,
      Sensitivity:            0x091D,
      StartDate:              0x091E,
      UtcStartDate:           0x091F,
      Subject:                0x0920,
      CompressedRTF:          0x0921,
      OrdinalDate:            0x0922,
      SubOrdinalDate:         0x0923,
      CalendarType:           0x0924,
      IsLeapMonth:            0x0925,
      FirstDayOfWeek:         0x0926,
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPResolveRecipients = factory();
// }(this, function() {
define('activesync/codepages/ResolveRecipients',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      ResolveRecipients:      0x0A05,
      Response:               0x0A06,
      Status:                 0x0A07,
      Type:                   0x0A08,
      Recipient:              0x0A09,
      DisplayName:            0x0A0A,
      EmailAddress:           0x0A0B,
      Certificates:           0x0A0C,
      Certificate:            0x0A0D,
      MiniCertificate:        0x0A0E,
      Options:                0x0A0F,
      To:                     0x0A10,
      CertificateRetrieval:   0x0A11,
      RecipientCount:         0x0A12,
      MaxCertificates:        0x0A13,
      MaxAmbiguousRecipients: 0x0A14,
      CertificateCount:       0x0A15,
      Availability:           0x0A16,
      StartTime:              0x0A17,
      EndTime:                0x0A18,
      MergedFreeBusy:         0x0A19,
      Picture:                0x0A1A,
      MaxSize:                0x0A1B,
      Data:                   0x0A1C,
      MaxPictures:            0x0A1D,
    },
    Enums: {
      Status: {
        Success:                   '1',
        AmbiguousRecipientFull:    '2',
        AmbiguousRecipientPartial: '3',
        RecipientNotFound:         '4',
        ProtocolError:             '5',
        ServerError:               '6',
        InvalidSMIMECert:          '7',
        CertLimitReached:          '8',
      },
      CertificateRetrieval: {
        None: '1',
        Full: '2',
        Mini: '3',
      },
      MergedFreeBusy: {
        Free:      '0',
        Tentative: '1',
        Busy:      '2',
        Oof:       '3',
        NoData:    '4',
      },
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPValidateCert = factory();
// }(this, function() {
define('activesync/codepages/ValidateCert',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      ValidateCert:     0x0B05,
      Certificates:     0x0B06,
      Certificate:      0x0B07,
      CertificateChain: 0x0B08,
      CheckCRL:         0x0B09,
      Status:           0x0B0A,
    },
    Enums: {
      Status: {
        Success:               '1',
        ProtocolError:         '2',
        InvalidSignature:      '3',
        UntrustedSource:       '4',
        InvalidChain:          '5',
        NotForEmail:           '6',
        Expired:               '7',
        InconsistentTimes:     '8',
        IdMisused:             '9',
        MissingInformation:   '10',
        CAEndMismatch:        '11',
        EmailAddressMismatch: '12',
        Revoked:              '13',
        ServerOffline:        '14',
        ChainRevoked:         '15',
        RevocationUnknown:    '16',
        UnknownError:         '17',
      },
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPContacts2 = factory();
// }(this, function() {
define('activesync/codepages/Contacts2',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      CustomerId:       0x0C05,
      GovernmentId:     0x0C06,
      IMAddress:        0x0C07,
      IMAddress2:       0x0C08,
      IMAddress3:       0x0C09,
      ManagerName:      0x0C0A,
      CompanyMainPhone: 0x0C0B,
      AccountName:      0x0C0C,
      NickName:         0x0C0D,
      MMS:              0x0C0E,
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPPing = factory();
// }(this, function() {
define('activesync/codepages/Ping',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      Ping:              0x0D05,
      AutdState:         0x0D06,
      Status:            0x0D07,
      HeartbeatInterval: 0x0D08,
      Folders:           0x0D09,
      Folder:            0x0D0A,
      Id:                0x0D0B,
      Class:             0x0D0C,
      MaxFolders:        0x0D0D,
    },
    Enums: {
      Status: {
        Expired:           '1',
        Changed:           '2',
        MissingParameters: '3',
        SyntaxError:       '4',
        InvalidInterval:   '5',
        TooManyFolders:    '6',
        SyncFolders:       '7',
        ServerError:       '8',
      },
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPProvision = factory();
// }(this, function() {
define('activesync/codepages/Provision',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      Provision:                                0x0E05,
      Policies:                                 0x0E06,
      Policy:                                   0x0E07,
      PolicyType:                               0x0E08,
      PolicyKey:                                0x0E09,
      Data:                                     0x0E0A,
      Status:                                   0x0E0B,
      RemoteWipe:                               0x0E0C,
      EASProvisionDoc:                          0x0E0D,
      DevicePasswordEnabled:                    0x0E0E,
      AlphanumericDevicePasswordRequired:       0x0E0F,
      DeviceEncryptionEnabled:                  0x0E10,
      RequireStorageCardEncryption:             0x0E10,
      PasswordRecoveryEnabled:                  0x0E11,
      AttachmentsEnabled:                       0x0E13,
      MinDevicePasswordLength:                  0x0E14,
      MaxInactivityTimeDeviceLock:              0x0E15,
      MaxDevicePasswordFailedAttempts:          0x0E16,
      MaxAttachmentSize:                        0x0E17,
      AllowSimpleDevicePassword:                0x0E18,
      DevicePasswordExpiration:                 0x0E19,
      DevicePasswordHistory:                    0x0E1A,
      AllowStorageCard:                         0x0E1B,
      AllowCamera:                              0x0E1C,
      RequireDeviceEncryption:                  0x0E1D,
      AllowUnsignedApplications:                0x0E1E,
      AllowUnsignedInstallationPackages:        0x0E1F,
      MinDevicePasswordComplexCharacters:       0x0E20,
      AllowWiFi:                                0x0E21,
      AllowTextMessaging:                       0x0E22,
      AllowPOPIMAPEmail:                        0x0E23,
      AllowBluetooth:                           0x0E24,
      AllowIrDA:                                0x0E25,
      RequireManualSyncWhenRoaming:             0x0E26,
      AllowDesktopSync:                         0x0E27,
      MaxCalendarAgeFilter:                     0x0E28,
      AllowHTMLEmail:                           0x0E29,
      MaxEmailAgeFilter:                        0x0E2A,
      MaxEmailBodyTruncationSize:               0x0E2B,
      MaxEmailHTMLBodyTruncationSize:           0x0E2C,
      RequireSignedSMIMEMessages:               0x0E2D,
      RequireEncryptedSMIMEMessages:            0x0E2E,
      RequireSignedSMIMEAlgorithm:              0x0E2F,
      RequireEncryptionSMIMEAlgorithm:          0x0E30,
      AllowSMIMEEncryptionAlgorithmNegotiation: 0x0E31,
      AllowSMIMESoftCerts:                      0x0E32,
      AllowBrowser:                             0x0E33,
      AllowConsumerEmail:                       0x0E34,
      AllowRemoteDesktop:                       0x0E35,
      AllowInternetSharing:                     0x0E36,
      UnapprovedInROMApplicationList:           0x0E37,
      ApplicationName:                          0x0E38,
      ApprovedApplicationList:                  0x0E39,
      Hash:                                     0x0E3A,
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPSearch = factory();
// }(this, function() {
define('activesync/codepages/Search',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      Search:         0x0F05,
      Stores:         0x0F06,
      Store:          0x0F07,
      Name:           0x0F08,
      Query:          0x0F09,
      Options:        0x0F0A,
      Range:          0x0F0B,
      Status:         0x0F0C,
      Response:       0x0F0D,
      Result:         0x0F0E,
      Properties:     0x0F0F,
      Total:          0x0F10,
      EqualTo:        0x0F11,
      Value:          0x0F12,
      And:            0x0F13,
      Or:             0x0F14,
      FreeText:       0x0F15,
      DeepTraversal:  0x0F17,
      LongId:         0x0F18,
      RebuildResults: 0x0F19,
      LessThan:       0x0F1A,
      GreaterThan:    0x0F1B,
      Schema:         0x0F1C,
      Supported:      0x0F1D,
      UserName:       0x0F1E,
      Password:       0x0F1F,
      ConversationId: 0x0F20,
      Picture:        0x0F21,
      MaxSize:        0x0F22,
      MaxPictures:    0x0F23,
    },
    Enums: {
      Status: {
        Success:              '1',
        InvalidRequest:       '2',
        ServerError:          '3',
        BadLink:              '4',
        AccessDenied:         '5',
        NotFound:             '6',
        ConnectionFailure:    '7',
        TooComplex:           '8',
        Timeout:             '10',
        SyncFolders:         '11',
        EndOfRange:          '12',
        AccessBlocked:       '13',
        CredentialsRequired: '14',
      }
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPGAL = factory();
// }(this, function() {
define('activesync/codepages/GAL',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      DisplayName:  0x1005,
      Phone:        0x1006,
      Office:       0x1007,
      Title:        0x1008,
      Company:      0x1009,
      Alias:        0x100A,
      FirstName:    0x100B,
      LastName:     0x100C,
      HomePhone:    0x100D,
      MobilePhone:  0x100E,
      EmailAddress: 0x100F,
      Picture:      0x1010,
      Status:       0x1011,
      Data:         0x1012,
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPAirSyncBase = factory();
// }(this, function() {
define('activesync/codepages/AirSyncBase',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      BodyPreference:     0x1105,
      Type:               0x1106,
      TruncationSize:     0x1107,
      AllOrNone:          0x1108,
      Reserved:           0x1109,
      Body:               0x110A,
      Data:               0x110B,
      EstimatedDataSize:  0x110C,
      Truncated:          0x110D,
      Attachments:        0x110E,
      Attachment:         0x110F,
      DisplayName:        0x1110,
      FileReference:      0x1111,
      Method:             0x1112,
      ContentId:          0x1113,
      ContentLocation:    0x1114,
      IsInline:           0x1115,
      NativeBodyType:     0x1116,
      ContentType:        0x1117,
      Preview:            0x1118,
      BodyPartPreference: 0x1119,
      BodyPart:           0x111A,
      Status:             0x111B,
      Location:           0x1120,
    },
    Enums: {
      Type: {
        PlainText: '1',
        HTML:      '2',
        RTF:       '3',
        MIME:      '4',
      },
      Method: {
        Normal:          '1',
        EmbeddedMessage: '5',
        AttachOLE:       '6',
      },
      NativeBodyType: {
        PlainText: '1',
        HTML:      '2',
        RTF:       '3',
      },
      Status: {
        Success: '1',
      }
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPSettings = factory();
// }(this, function() {
define('activesync/codepages/Settings',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      Settings:                    0x1205,
      Status:                      0x1206,
      Get:                         0x1207,
      Set:                         0x1208,
      Oof:                         0x1209,
      OofState:                    0x120A,
      StartTime:                   0x120B,
      EndTime:                     0x120C,
      OofMessage:                  0x120D,
      AppliesToInternal:           0x120E,
      AppliesToExternalKnown:      0x120F,
      AppliesToExternalUnknown:    0x1210,
      Enabled:                     0x1211,
      ReplyMessage:                0x1212,
      BodyType:                    0x1213,
      DevicePassword:              0x1214,
      Password:                    0x1215,
      DeviceInformation:           0x1216,
      Model:                       0x1217,
      IMEI:                        0x1218,
      FriendlyName:                0x1219,
      OS:                          0x121A,
      OSLanguage:                  0x121B,
      PhoneNumber:                 0x121C,
      UserInformation:             0x121D,
      EmailAddresses:              0x121E,
      SmtpAddress:                 0x121F,
      UserAgent:                   0x1220,
      EnableOutboundSMS:           0x1221,
      MobileOperator:              0x1222,
      PrimarySmtpAddress:          0x1223,
      Accounts:                    0x1224,
      Account:                     0x1225,
      AccountId:                   0x1226,
      AccountName:                 0x1227,
      UserDisplayName:             0x1228,
      SendDisabled:                0x1229,
      /* Missing tag value 0x122A */
      RightsManagementInformation: 0x122B,
    },
    Enums: {
      Status: {
        Success:              '1',
        ProtocolError:        '2',
        AccessDenied:         '3',
        ServerError:          '4',
        InvalidArguments:     '5',
        ConflictingArguments: '6',
        DeniedByPolicy:       '7',
      },
      OofState: {
        Disabled:  '0',
        Global:    '1',
        TimeBased: '2',
      }
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPDocumentLibrary = factory();
// }(this, function() {
define('activesync/codepages/DocumentLibrary',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      LinkId:           0x1305,
      DisplayName:      0x1306,
      IsFolder:         0x1307,
      CreationDate:     0x1308,
      LastModifiedDate: 0x1309,
      IsHidden:         0x130A,
      ContentLength:    0x130B,
      ContentType:      0x130C,
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPItemOperations = factory();
// }(this, function() {
define('activesync/codepages/ItemOperations',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      ItemOperations:      0x1405,
      Fetch:               0x1406,
      Store:               0x1407,
      Options:             0x1408,
      Range:               0x1409,
      Total:               0x140A,
      Properties:          0x140B,
      Data:                0x140C,
      Status:              0x140D,
      Response:            0x140E,
      Version:             0x140F,
      Schema:              0x1410,
      Part:                0x1411,
      EmptyFolderContents: 0x1412,
      DeleteSubFolders:    0x1413,
      UserName:            0x1414,
      Password:            0x1415,
      Move:                0x1416,
      DstFldId:            0x1417,
      ConversationId:      0x1418,
      MoveAlways:          0x1419,
    },
    Enums: {
      Status: {
        Success:               '1',
        ProtocolError:         '2',
        ServerError:           '3',
        BadURI:                '4',
        AccessDenied:          '5',
        ObjectNotFound:        '6',
        ConnectionFailure:     '7',
        InvalidByteRange:      '8',
        UnknownStore:          '9',
        EmptyFile:            '10',
        DataTooLarge:         '11',
        IOFailure:            '12',
        ConversionFailure:    '14',
        InvalidAttachment:    '15',
        ResourceAccessDenied: '16',
      },
    },
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPComposeMail = factory();
// }(this, function() {
define('activesync/codepages/ComposeMail',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      SendMail:        0x1505,
      SmartForward:    0x1506,
      SmartReply:      0x1507,
      SaveInSentItems: 0x1508,
      ReplaceMime:     0x1509,
      /* Missing tag value 0x150A */
      Source:          0x150B,
      FolderId:        0x150C,
      ItemId:          0x150D,
      LongId:          0x150E,
      InstanceId:      0x150F,
      Mime:            0x1510,
      ClientId:        0x1511,
      Status:          0x1512,
      AccountId:       0x1513,
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPEmail2 = factory();
// }(this, function() {
define('activesync/codepages/Email2',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      UmCallerID:            0x1605,
      UmUserNotes:           0x1606,
      UmAttDuration:         0x1607,
      UmAttOrder:            0x1608,
      ConversationId:        0x1609,
      ConversationIndex:     0x160A,
      LastVerbExecuted:      0x160B,
      LastVerbExecutionTime: 0x160C,
      ReceivedAsBcc:         0x160D,
      Sender:                0x160E,
      CalendarType:          0x160F,
      IsLeapMonth:           0x1610,
      AccountId:             0x1611,
      FirstDayOfWeek:        0x1612,
      MeetingMessageType:    0x1613,
    },
    Enums: {
      LastVerbExecuted: {
        Unknown:       '0',
        ReplyToSender: '1',
        ReplyToAll:    '2',
        Forward:       '3',
      },
      CalendarType: {
        Default:                     '0',
        Gregorian:                   '1',
        GregorianUS:                 '2',
        Japan:                       '3',
        Taiwan:                      '4',
        Korea:                       '5',
        Hijri:                       '6',
        Thai:                        '7',
        Hebrew:                      '8',
        GregorianMeFrench:           '9',
        GregorianArabic:            '10',
        GregorianTranslatedEnglish: '11',
        GregorianTranslatedFrench:  '12',
        JapaneseLunar:              '14',
        ChineseLunar:               '15',
        KoreanLunar:                '20',
      },
      FirstDayOfWeek: {
        Sunday:    '0',
        Monday:    '1',
        Tuesday:   '2',
        Wednesday: '3',
        Thursday:  '4',
        Friday:    '5',
        Saturday:  '6',
      },
      MeetingMessageType: {
        Unspecified:         '0',
        InitialRequest:      '1',
        FullUpdate:          '2',
        InformationalUpdate: '3',
        Outdated:            '4',
        DelegatorsCopy:      '5',
        Delegated:           '6',
      }
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPNotes = factory();
// }(this, function() {
define('activesync/codepages/Notes',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      Subject:          0x1705,
      MessageClass:     0x1706,
      LastModifiedDate: 0x1707,
      Categories:       0x1708,
      Category:         0x1709,
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object')
//     module.exports = factory();
//   else if (typeof define === 'function' && define.amd)
//     define([], factory);
//   else
//     root.ASCPRightsManagement = factory();
// }(this, function() {
define('activesync/codepages/RightsManagement',['require','exports','module'],function(require, exports, module) {
  

  return {
    Tags: {
      RightsManagementSupport:            0x1805,
      RightsManagementTemplates:          0x1806,
      RightsManagementTemplate:           0x1807,
      RightsManagementLicense:            0x1808,
      EditAllowed:                        0x1809,
      ReplyAllowed:                       0x180A,
      ReplyAllAllowed:                    0x180B,
      ForwardAllowed:                     0x180C,
      ModifyRecipientsAllowed:            0x180D,
      ExtractAllowed:                     0x180E,
      PrintAllowed:                       0x180F,
      ExportAllowed:                      0x1810,
      ProgrammaticAccessAllowed:          0x1811,
      Owner:                              0x1812,
      ContentExpiryDate:                  0x1813,
      TemplateID:                         0x1814,
      TemplateName:                       0x1815,
      TemplateDescription:                0x1816,
      ContentOwner:                       0x1817,
      RemoveRightsManagementDistribution: 0x1818,
    }
  };
});

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// (function (root, factory) {
//   if (typeof exports === 'object') {
//     define = function(deps, factory) {
//       deps = deps.map.forEach(function(id) {
//         return require(id);
//       });
//       module.exports = factory(deps);
//     };
//     define.amd = {};
//   }

//   if (typeof define === 'function' && define.amd) {
//     define([
//       './wbxml/wbxml',
//       './codepages/Common',
//       './codepages/AirSync',
//       './codepages/Contacts',
//       './codepages/Email',
//       './codepages/Calendar',
//       './codepages/Move',
//       './codepages/ItemEstimate',
//       './codepages/FolderHierarchy',
//       './codepages/MeetingResponse',
//       './codepages/Tasks',
//       './codepages/ResolveRecipients',
//       './codepages/ValidateCert',
//       './codepages/Contacts2',
//       './codepages/Ping',
//       './codepages/Provision',
//       './codepages/Search',
//       './codepages/GAL',
//       './codepages/AirSyncBase',
//       './codepages/Settings',
//       './codepages/DocumentLibrary',
//       './codepages/ItemOperations',
//       './codepages/ComposeMail',
//       './codepages/Email2',
//       './codepages/Notes',
//       './codepages/RightsManagement'
//     ], factory);
//   } else {
//     root.ActiveSyncCodepages = factory(WBXML,
//                                        ASCPCommon,
//                                        ASCPAirSync,WBXML
//                                        ASCPContacts,
//                                        ASCPEmail,
//                                        ASCPCalendar,
//                                        ASCPMove,
//                                        ASCPItemEstimate,
//                                        ASCPHierarchy,
//                                        ASCPMeetingResponse,
//                                        ASCPTasks,
//                                        ASCPResolveRecipients,
//                                        ASCPValidateCert,
//                                        ASCPContacts2,
//                                        ASCPPing,
//                                        ASCPProvision,
//                                        ASCPSearch,
//                                        ASCPGAL,
//                                        ASCPAirSyncBase,
//                                        ASCPSettings,
//                                        ASCPDocumentLibrary,
//                             // Email: Email,
    // Calendar: Calendar,
    // Move: Move,
    // ItemEstimate: ItemEstimate,
    // FolderHierarchy: FolderHierarchy,
    // MeetingResponse: MeetingResponse,
    // Tasks: Tasks,
    // ResolveRecipients: ResolveRecipients,
    // ValidateCert: ValidateCert,
    // Contacts2: Contacts2,
    // Ping: Ping,
    // Provision: Provision,
    // Search: Search,
    // GAL: GAL,
    // AirSyncBase: AirSyncBase,
    // Settings: Settings,
    // DocumentLibrary: DocumentLibrary,
    // ItemOperations: ItemOperations,
    // ComposeMail: ComposeMail,
    // Email2: Email2,
    // Notes: Notes,
    // RightsManagement: RightsManagement            ASCPItemOperations,
//                                        ASCPComposeMail,
//                                        ASCPEmail2,
//                                        ASCPNotes,
//                                        ASCPRightsManagement);
//   }
// }(this, function(WBXML, Common, AirSync, Contacts, Email, Calendar, Move,
//                  ItemEstimate, FolderHierarchy, MeetingResponse, Tasks,
//                  ResolveRecipients, ValidateCert, Contacts2, Ping, Provision,
//                  Search, GAL, AirSyncBase, Settings, DocumentLibrary,
//                  ItemOperations, ComposeMail, Email2, Notes, RightsManagement) {

define('activesync/codepages',['require','exports','module','./wbxml/wbxml','./codepages/Common','./codepages/AirSync','./codepages/Contacts','./codepages/Email','./codepages/Calendar','./codepages/Move','./codepages/ItemEstimate','./codepages/FolderHierarchy','./codepages/MeetingResponse','./codepages/Tasks','./codepages/ResolveRecipients','./codepages/ValidateCert','./codepages/Contacts2','./codepages/Ping','./codepages/Provision','./codepages/Search','./codepages/GAL','./codepages/AirSyncBase','./codepages/Settings','./codepages/DocumentLibrary','./codepages/ItemOperations','./codepages/ComposeMail','./codepages/Email2','./codepages/Notes','./codepages/RightsManagement'],function(require, exports, module) {  
  
  var WBXML = require('./wbxml/wbxml');
  var Common = require('./codepages/Common');
  var AirSync = require('./codepages/AirSync');
  var Contacts = require('./codepages/Contacts');
  var Email = require('./codepages/Email');
  var Calendar = require('./codepages/Calendar');
  var Move = require('./codepages/Move');
  var ItemEstimate = require('./codepages/ItemEstimate');
  var FolderHierarchy = require('./codepages/FolderHierarchy');
  var MeetingResponse = require('./codepages/MeetingResponse');
  var Tasks = require('./codepages/Tasks');
  var ResolveRecipients = require('./codepages/ResolveRecipients');
  var ValidateCert = require('./codepages/ValidateCert');
  var Contacts2 = require('./codepages/Contacts2');
  var Ping = require('./codepages/Ping');
  var Provision = require('./codepages/Provision');
  var Search = require('./codepages/Search');
  var GAL = require('./codepages/GAL');
  var AirSyncBase = require('./codepages/AirSyncBase');
  var Settings = require('./codepages/Settings');
  var DocumentLibrary = require('./codepages/DocumentLibrary');
  var ItemOperations = require('./codepages/ItemOperations');
  var ComposeMail = require('./codepages/ComposeMail');
  var Email2 = require('./codepages/Email2');
  var Notes = require('./codepages/Notes');
  var RightsManagement = require('./codepages/RightsManagement');

  var codepages = {
    Common: Common,
    AirSync: AirSync,
    Contacts: Contacts,
    Email: Email,
    Calendar: Calendar,
    Move: Move,
    ItemEstimate: ItemEstimate,
    FolderHierarchy: FolderHierarchy,
    MeetingResponse: MeetingResponse,
    Tasks: Tasks,
    ResolveRecipients: ResolveRecipients,
    ValidateCert: ValidateCert,
    Contacts2: Contacts2,
    Ping: Ping,
    Provision: Provision,
    Search: Search,
    GAL: GAL,
    AirSyncBase: AirSyncBase,
    Settings: Settings,
    DocumentLibrary: DocumentLibrary,
    ItemOperations: ItemOperations,
    ComposeMail: ComposeMail,
    Email2: Email2,
    Notes: Notes,
    RightsManagement: RightsManagement
  };

  WBXML.CompileCodepages(codepages);

  return codepages;
});
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// (function (root, factory) {
//   if (typeof exports === 'object'){
//     module.exports = factory(require('activesync/wbxml/wbxml'),
//       require('activesync/codepages'));}
//   else if (typeof define === 'function' && define.amd){
//     define(['activesync/wbxml/wbxml', 'activesync/codepages'], factory);}
//   else{
//     root.ActiveSyncProtocol = factory(WBXML, ActiveSyncCodepages);}
// }(this, function(WBXML, ASCP) {

define('activesync/protocol',['require','exports','module','activesync/wbxml/wbxml','activesync/codepages','./../day_observer','./../provider/local'],function(require, exports, module) {
  
  var WBXML = require('activesync/wbxml/wbxml');
  var ASCP = require('activesync/codepages');
  var dayObserver = require('./../day_observer');
  var Local = require('./../provider/local');

  var exports = {};
  var USER_AGENT = 'KaiOS ActiveSync Client';

  //the unit is second
  var stardarReminderArr = [0, -300, -900, -1800, -3600, -7200, -86400];
  var alldayReminderArr = [32400, -54000, -140400, -572400, -1177200];

  function nullCallback() {}

  /**
   * Create a constructor for a custom error type that works like a built-in
   * Error.
   *
   * @param name the string name of the error
   * @param parent (optional) a parent class for the error, defaults to Error
   * @param extraArgs an array of extra arguments that can be passed to the
   *        constructor of this error type
   * @return the constructor for this error
   */
  function makeError(name, parent, extraArgs) {
    function CustomError() {
      // Try to let users call this as CustomError(...) without the "new". This
      // is imperfect, and if you call this function directly and give it a
      // |this| that's a CustomError, things will break. Don't do it!
      var self = this instanceof CustomError ?
        this : Object.create(CustomError.prototype);
      var tmp = Error();
      var offset = 1;

      self.stack = tmp.stack.substring(tmp.stack.indexOf('\n') + 1);
      self.message = arguments[0] || tmp.message;
      if (extraArgs) {
        offset += extraArgs.length;
        for (var i = 0; i < extraArgs.length; i++)
          self[extraArgs[i]] = arguments[i+1];
      }

      var m = /@(.+):(.+)/.exec(self.stack);
      self.fileName = arguments[offset] || (m && m[1]) || "";
      self.lineNumber = arguments[offset + 1] || (m && m[2]) || 0;

      return self;
    }
    CustomError.prototype = Object.create((parent || Error).prototype);
    CustomError.prototype.name = name;
    CustomError.prototype.constructor = CustomError;

    return CustomError;
  }

  var AutodiscoverError = makeError('ActiveSync.AutodiscoverError');
  exports.AutodiscoverError = AutodiscoverError;

  var AutodiscoverDomainError = makeError('ActiveSync.AutodiscoverDomainError',
                                          AutodiscoverError);
  exports.AutodiscoverDomainError = AutodiscoverDomainError;

  var HttpError = makeError('ActiveSync.HttpError', null, ['status']);
  exports.HttpError = HttpError;

  function nsResolver(prefix) {
    var baseUrl = 'http://schemas.microsoft.com/exchange/autodiscover/';
    var ns = {
      rq: baseUrl + 'mobilesync/requestschema/2006',
      ad: baseUrl + 'responseschema/2006',
      ms: baseUrl + 'mobilesync/responseschema/2006'
    };
    return ns[prefix] || null;
  }

  function Version(str) {
    var details = str.split('.').map(function(x) {
      return parseInt(x);
    });
    this.major = details[0], this.minor = details[1];
  }
  exports.Version = Version;
  Version.prototype = {
    eq: function(other) {
      if (!(other instanceof Version))
        other = new Version(other);
      return this.major === other.major && this.minor === other.minor;
    },
    ne: function(other) {
      return !this.eq(other);
    },
    gt: function(other) {
      if (!(other instanceof Version))
        other = new Version(other);
      return this.major > other.major ||
             (this.major === other.major && this.minor > other.minor);
    },
    gte: function(other) {
      if (!(other instanceof Version))
        other = new Version(other);
      return this.major >= other.major ||
             (this.major === other.major && this.minor >= other.minor);
    },
    lt: function(other) {
      return !this.gte(other);
    },
    lte: function(other) {
      return !this.gt(other);
    },
    toString: function() {
      return this.major + '.' + this.minor;
    },
  };

  /**
   * Set the Authorization header on an XMLHttpRequest.
   *
   * @param xhr the XMLHttpRequest
   * @param username the username
   * @param password the user's password
   */
  function setAuthHeader(xhr, username, password) {
    var authorization = 'Basic ' + btoa(username + ':' + password);
    xhr.setRequestHeader('Authorization', authorization);
  }

  /**
   * Perform autodiscovery for the server associated with this account.
   *
   * @param aEmailAddress the user's email address
   * @param aPassword the user's password
   * @param aTimeout a timeout (in milliseconds) for the request
   * @param aCallback a callback taking an error status (if any) and the
   *        server's configuration
   * @param aNoRedirect true if autodiscovery should *not* follow any
   *        specified redirects (typically used when autodiscover has already
   *        told us about a redirect)
   */
  function autodiscover(aEmailAddress, aPassword, aTimeout, aCallback,
    aNoRedirect) {
    if (!aCallback) aCallback = nullCallback;
    var domain = aEmailAddress.substring(aEmailAddress.indexOf('@') + 1);

    // The first time we try autodiscovery, we should try to recover from
    // AutodiscoverDomainErrors and HttpErrors. The second time, *all* errors
    // should be reported to the callback.
    do_autodiscover('autodiscover.' + domain, aEmailAddress, aPassword,
      aTimeout, aNoRedirect, function(aError, aConfig) {
      if (aError instanceof AutodiscoverDomainError ||
        aError instanceof HttpError)
        do_autodiscover(domain, aEmailAddress, aPassword, aTimeout,
          aNoRedirect, aCallback);
      else
        aCallback(aError, aConfig);
    });
  }
  exports.autodiscover = autodiscover;

  /**
   * Perform the actual autodiscovery process for a given URL.
   *
   * @param aHost the host name to attempt autodiscovery for
   * @param aEmailAddress the user's email address
   * @param aPassword the user's password
   * @param aTimeout a timeout (in milliseconds) for the request
   * @param aNoRedirect true if autodiscovery should *not* follow any
   *        specified redirects (typically used when autodiscover has already
   *        told us about a redirect)
   * @param aCallback a callback taking an error status (if any) and the
   *        server's configuration
   */
  function do_autodiscover(aHost, aEmailAddress, aPassword, aTimeout,
    aNoRedirect, aCallback) {
    var url = 'https://' + aHost + '/autodiscover/autodiscover.xml';
    return raw_autodiscover(url, aEmailAddress, aPassword, aTimeout,
      aNoRedirect, aCallback);
  }

  function raw_autodiscover(aUrl, aEmailAddress, aPassword, aTimeout,
    aNoRedirect, aCallback) {
    var xhr = new XMLHttpRequest({mozSystem: true, mozAnon: true});
    xhr.open('POST', aUrl, true);
    setAuthHeader(xhr, aEmailAddress, aPassword);
    xhr.setRequestHeader('Content-Type', 'text/xml');
    xhr.setRequestHeader('User-Agent', USER_AGENT);
    xhr.timeout = aTimeout;

    xhr.upload.onprogress = xhr.upload.onload = function() {
      xhr.timeout = 0;
    };

    xhr.onload = function() {
      if (xhr.status < 200 || xhr.status >= 300)
        return aCallback(new HttpError(xhr.statusText, xhr.status));

      var uid = Math.random();
      self.postMessage({
        uid: uid,
        type: 'configparser',
        cmd: 'accountactivesync',
        args: [xhr.responseText, aNoRedirect]
      });

      self.addEventListener('message', function onworkerresponse(evt) {
        var data = evt.data;
        if (data.type != 'configparser' || data.cmd != 'accountactivesync' ||
          data.uid != uid) {
          return;
        }
        self.removeEventListener(evt.type, onworkerresponse);

        var args = data.args;
        var config = args[0], error = args[1], redirectedEmail = args[2];
        if (error) {
          aCallback(new AutodiscoverDomainError(error), config);
        } else if (redirectedEmail) {
          autodiscover(redirectedEmail, aPassword, aTimeout, aCallback, true);
        } else {
          aCallback(null, config);
        }
      });
    };

    xhr.ontimeout = xhr.onerror = function() {
      // Something bad happened in the network layer, so treat this like an HTTP
      // error.
      aCallback(new HttpError('Error getting Autodiscover URL', null));
    };

    // TODO: use something like
    // http://ejohn.org/blog/javascript-micro-templating/ here?
    var postdata =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<Autodiscover xmlns="' + nsResolver('rq') + '">\n' +
    '  <Request>\n' +
    '    <EMailAddress>' + aEmailAddress + '</EMailAddress>\n' +
    '    <AcceptableResponseSchema>' + nsResolver('ms') +
         '</AcceptableResponseSchema>\n' +
    '  </Request>\n' +
    '</Autodiscover>';

    xhr.send(postdata);
  }
  exports.raw_autodiscover = raw_autodiscover;

  /**
   * Create a new ActiveSync connection.
   *
   * ActiveSync connections use XMLHttpRequests to communicate with the
   * server. These XHRs are created with mozSystem: true and mozAnon: true to,
   * respectively, help with CORS, and to ignore the authentication cache. The
   * latter is important because 1) it prevents the HTTP auth dialog from
   * appearing if the user's credentials are wrong and 2) it allows us to
   * connect to the same server as multiple users.
   *
   * @param aDeviceId (optional) a string identifying this device
   * @param aPolicyKey(optional) a string with a maximum of 64 characters, it
   *        is used by the server to mark the state of policy settings on the
   *        client in the settings
   download phase of the Provision command.

   * @param aDeviceType (optional) a string identifying the type of this device
   */
  function Connection(aDeviceId, aPolicyKey, calendar, stream, aDeviceType) {
    this._deviceId = aDeviceId || 'v140Device';
    this._deviceType = aDeviceType || 'KaiOS';
    this.timeout = 0;

    this.stream = stream;
    this.calendar = calendar;

    this._connected = false;
    this._waitingForConnection = false;
    this._connectionError = null;
    this._connectionCallbacks = [];

    this.baseUrl = null;
    this._username = null;
    this._password = null;
    this._accountId = null;
    this._app = null;

    this.SyncKey = null;
    this.CollectionId = null;

    this.versions = [];
    this.supportedCommands = [];
    this.currentVersion = null;
    this.policyKey = aPolicyKey || 0;

    /**
     * Debug support function that is called every time an XHR call completes.
     * This is intended to be used for logging.
     *
     * The arguments to the function are:
     *
     * - type: 'options' if caused by a call to getOptions.  'post' if caused by
     *   a call to postCommand/postData.
     *
     * - special: 'timeout' if a timeout error occurred, 'redirect' if the
     *   status code was 451 and the call is being reissued, 'error' if some
     *   type of error occurred, or 'ok' on success.  Check xhr.status for the
     *   specific http status code.
     *
     * - xhr: The XMLHttpRequest used.  Use this to check the statusCode,
     *   statusText, or response headers.
     *
     * - params: The object dictionary of parameters encoded into the URL.
     *   Always present if type is 'post', not present for 'options'.
     *
     * - extraHeaders: Optional dictionary of extra request headers that were
     *   provided.  These will not include the always-present request headers of
     *   MS-ASProtocolVersion and Content-Type.
     *
     * - sent data: If type is 'post', the ArrayBuffer provided to xhr.send().
     *
     * - response: In the case of a successful 'post', the WBXML Reader instance
     *   that will be passed to the callback for the method.  If you use the
     *   reader, you are responsible for calling rewind() on it.
     */
    this.onmessage = null;
  }
  exports.Connection = Connection;
  Connection.prototype = {
    /**
     * Perform any callbacks added during the connection process.
     *
     * @param aError the error status (if any)
     */
    _notifyConnected: function(aError) {
      if (aError)
        this.disconnect();

      for (var iter in Iterator(this._connectionCallbacks)) {
        var callback = iter[1];
        callback.apply(callback, arguments);
      }
      this._connectionCallbacks = [];
    },

    /**
     * Get the connection status.
     *
     * @return true if we are fully connected to the server
     */
    get connected() {
      return this._connected;
    },

    /*
     * Initialize the connection with a server and account credentials.
     *
     * @param aURL the ActiveSync URL to connect to
     * @param aUsername the account's username
     * @param aPassword the account's password
     */
    open: function(aURL, aUsername, aPassword, accountId, app) {
      // XXX: We add the default service path to the URL if it's not already
      // there. This is a hack to work around the failings of Hotmail (and
      // possibly other servers), which doesn't provide the service path in its
      // URL. If it turns out this causes issues with other domains, remove it.
      var servicePath = '/Microsoft-Server-ActiveSync';
      this.baseUrl = aURL;
      if (!this.baseUrl.endsWith(servicePath))
        this.baseUrl += servicePath;

      this._username = aUsername;
      this._password = aPassword;
      this._accountId = accountId ? accountId.toLowerCase() : null;
      this._app = app;
    },

    /**
     * Connect to the server with this account by getting the OPTIONS and
     * policy from the server (and verifying the account's credentials).
     *
     * @param aCallback a callback taking an error status (if any) and the
     *        server's options.
     */
    connect: function(aCallback) {
      // If we're already connected, just run the callback and return.
      if (this.connected) {
        if (aCallback)
          aCallback(null);
        return;
      }

      // Otherwise, queue this callback up to fire when we do connect.
      if (aCallback)
        this._connectionCallbacks.push(aCallback);

      // Don't do anything else if we're already trying to connect.
      if (this._waitingForConnection)
        return;

      this._waitingForConnection = true;
      this._connectionError = null;

      this.getOptions((function(aError, aOptions) {
        this._waitingForConnection = false;
        this._connectionError = aError;

        if (aError) {
          console.error('Error connecting to ActiveSync:', aError);
          return this._notifyConnected(aError, aOptions);
        }

        this._connected = true;
        this.versions = aOptions.versions;
        this.supportedCommands = aOptions.commands;
        this.currentVersion = new Version(aOptions.versions.slice(-1)[0]);

        this.enforcement(((aError, aResponse) => {
          var errorStr = 'Error get Security Policy for ActiveSync: ';

          if (aError) {
            console.error(errorStr, aError);
            return this._notifyConnected(aError, aOptions);
          }

          var e = new WBXML.EventParser();
          var as = ASCP.AirSync.Tags;
          var ace = ASCP.Common.Enums;
          var afe = ASCP.FolderHierarchy.Enums;
          var fh = ASCP.FolderHierarchy.Tags;

          e.addEventListener([fh.FolderSync, fh.Changes,
            [fh.Add, fh.Delete, fh.Update]], function(node) {
            var folder = {};
            for (var iter in Iterator(node.children)) {
              var child = iter[1];
              folder[child.localTagName] = child.children[0].textContent;
            }

            if (folder.Type === '8') {
              this.CollectionId = folder.ServerId;
              this.getSynckey(((aError, aResponse) => {
                var errorStr = 'Error get Security Policy for ActiveSync: ';
      
                if (aError) {
                  console.error(errorStr, aError);
                  return this._notifyConnected(aError, aOptions);
                }
      
                var e = new WBXML.EventParser();
                var as = ASCP.AirSync.Tags;
                var ace = ASCP.Common.Enums;
                var afe = ASCP.FolderHierarchy.Enums;
                var fh = ASCP.FolderHierarchy.Tags;
      
                e.addEventListener([as.Sync, as.Collections, as.Collection, as.SyncKey],
                  function(node) {
                  this.SyncKey = node.children[0].textContent;
                  aCallback();
                }.bind(this));
      
                try {
                  e.run(aResponse);
                }
                catch (ex) {
                  console.error(errorStr, ex);
                }
      
              }).bind(this))
            }
          }.bind(this));

          try {
            e.run(aResponse);
          }
          catch (ex) {
            console.error(errorStr, ex);
          }
        }).bind(this))
      }).bind(this));
    },

    /**
     * Disconnect from the ActiveSync server, and reset the connection state.
     * The server and credentials remain set however, so you can safely call
     * connect() again immediately after.
     */
    disconnect: function() {
      if (this._waitingForConnection)
        throw new Error("Can't disconnect while waiting for server response");

      this._connected = false;
      this.versions = [];
      this.supportedCommands = [];
      this.currentVersion = null;
      this.SyncKey = null;
      this.CollectionId = null;
    },

    /**
     * Get the device Info to download Policy from Server.
     * @param aCallback a callback an error status (if any) and
     *        the device info.
     */
    getDeviceInfo: function(aCallback) {
      var uid = Math.random();
      self.postMessage({
        uid: uid,
        type: 'deviceInfo',
        cmd: 'get'
      });

      self.addEventListener('message', function onworkerresponse(evt) {
        var data = evt.data;
        if (data.type != 'deviceInfo' || data.cmd != 'get' ||
            data.uid != uid) {
          return;
        }
        self.removeEventListener(evt.type, onworkerresponse);

        var args = data.args;
        var data = args[0], error = args[1];
        if (error) {
          aCallback(null, error);
        } else {
          aCallback(data);
        }
      });
    },

    /**
     * Attempt to provision this account, we use this to Downloads Policy
     * from Server.
     * @param doFinal determine whether to get "final" PolicyKey
     * @param aCallback a callback taking an error status (if any) and the
     *        WBXML response
     */
    provision: function(doFinal, aCallback) {
      var pv = ASCP.Provision.Tags;
      var st = ASCP.Settings.Tags;
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(pv.Provision);
      var bSetDeviceInfo = !doFinal && this.currentVersion.gte('12.0');
      if (bSetDeviceInfo) {
        this.getDeviceInfo((function(deviceInfo, error) {
          if (error) {
            aCallback(error);
          }
          w.stag(st.DeviceInformation)
            .stag(st.Set)
              .tag(st.FriendlyName, deviceInfo.deviceName)
              .tag(st.Model, deviceInfo.modelName)
              .tag(st.IMEI, deviceInfo.imei)
              .tag(st.OS, deviceInfo.OSName)
              .tag(st.OSLanguage, deviceInfo.OSLanguage);
          if (deviceInfo.phoneNumber.length > 0) {
             w.tag(st.PhoneNumber, deviceInfo.phoneNumber);
          }
          if (this.currentVersion.gte('14.0')) {
             w.tag(st.MobileOperator, deviceInfo.operatorName);
          }
            w.etag()
          .etag();

          w.stag(pv.Policies)
            .stag(pv.Policy)
              .tag(pv.PolicyType, 'MS-EAS-Provisioning-WBXML');

              w.etag()
            .etag()
          .etag();
          this.postCommand(w, aCallback);
        }).bind(this));
      } else {
        w.stag(pv.Policies)
          .stag(pv.Policy)
            .tag(pv.PolicyType, 'MS-EAS-Provisioning-WBXML');

        if (doFinal) {
           w.tag(pv.PolicyKey, this.policyKey)
            .tag(pv.Status, 1);
        }

            w.etag()
          .etag()
        .etag();
        this.postCommand(w, aCallback);
      }
    },

    /**
     * Downloading the Current Server Security Policy
     * Phase 1: Enforcement
     * the client tries the FolderSync command, which is denied by the server
     * because the server has determined that the client does not have the
     * current policy (as denoted by the X-MS-PolicyKey header). The server
     * returns HTTP 200 (ok) with a global status code in the body of the
     * response of 142.
     * @param aCallback a callback taking an error status (if any) and the
     *        WBXML response
     */
    enforcementOld: function(aCallback) {
      var fh = ASCP.FolderHierarchy.Tags;
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(fh.FolderSync)
          .tag(fh.SyncKey, '0')
        .etag();
      this.postCommand(w, aCallback);
    },

    getSynckeyOld: function(aCallback) {
      var as = ASCP.AirSync.Tags;
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(as.Sync)
        .stag(as.Collections)
          .stag(as.Collection)
            .tag(as.SyncKey, '0')
            .tag(as.CollectionId, '1')
          .etag()
        .etag()
      .etag();
      this.postCommand(w, aCallback);
    },

    /**
     * Downloading the Current Server Security Policy
     * Phase 2: Client Downloads Policy from Server
     * Phase 3: Client Acknowledges Receipt and Application of Policy Settings
     * @param bFinal determine whether to get "final" PolicyKey
     * @param aCallback a callback taking an error status (if any)， If get
     *        policyKey callback null.
     */
    getPolicyKey: function(bFinal, aCallback) {
      this.provision(bFinal, (function(aError, aResponse) {
        if (aError) {
          aCallback(aError);
        }

        var e = new WBXML.EventParser();
        var pv = ASCP.Provision.Tags;
        var base = [pv.Provision, pv.Policies, pv.Policy];

        e.addEventListener(base.concat(pv.PolicyKey), (function(node) {
          this.policyKey = node.children[0].textContent;
          aCallback(null);
        }).bind(this));

        if (!bFinal) {
          e.addEventListener(base.concat([pv.Data, pv.EASProvisionDoc]),
              (function(node) {
            this.securitySettings(pv, node);
          }).bind(this));
        }

        try {
          e.run(aResponse);
        }
        catch (ex) {
          aCallback(ex);
        }
      }).bind(this));
    },

    // Todo:
    /*
     * Parse security policy data and
     * @param pv exchange provision tags
     * @param node WEBXML node contains security policy data
     */
    securitySettings: function(pv, node) {
      for (var iter in Iterator(node.children)) {
        var child = iter[1];
        var childText =
            child.children.length ? child.children[0].textContent : null;
        switch (child.tag) {
          case pv.DevicePasswordEnabled:
            break;
          case pv.AlphanumericDevicePasswordRequired:
            break;
          case pv.PasswordRecoveryEnabled:
            break;
          case pv.RequireStorageCardEncryption:
            break;
          case pv.AttachmentsEnabled:
            break;
          case pv.MinDevicePasswordLength:
            break;
          case pv.MaxInactivityTimeDeviceLock:
            break;
          case pv.MaxAttachmentSize:
            break;
          case pv.MaxDevicePasswordFailedAttempts:
            break;
          case pv.AllowSimpleDevicePassword:
            break;
          case pv.DevicePasswordExpiration:
            break;
          case pv.DevicePasswordHistory:
            break;
        }
      }
    },

    wipeCommand: function(pv, bWipe, callback) {
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(pv.Provision);
      if (bWipe) {
        w.stag(pv.RemoteWipe)
            .tag(pv.Status, 1)
            .etag();
      }
      w.etag();

      this.postCommand(w, function(aError, aResponse) {
        var e = new WBXML.EventParser();
        if (aError) {
          callback(aError);
        }

        e.addEventListener([pv.Provision, pv.Status], function(node) {
          var status = node.children[0].textContent;
          // Success
          if (status === '1') {
            callback(null);
          } else {
            var error = 'Remote wipe error, error status: ' + status;
            console.error(error);
            callback(error);
          }
        });

        try {
          e.run(aResponse);
        }
        catch (ex) {
          callback(ex);
        }
      });
    },

    deviceWipe: function(callback) {
      var pv = ASCP.Provision.Tags;
      this.wipeCommand(pv, false, (function(aError) {
        if (aError) {
          callback(aError);
          return;
        }
        this.wipeCommand(pv, true, function(aError) {
          if (aError) {
            callback(aError);
            return;
          } else {
            callback(null);
            // do factory reset
            var uid = Math.random();
            self.postMessage({
              uid: uid,
              type: 'deviceInfo',
              cmd: 'reset'
            });
          }
        });
      }).bind(this));
    },

    /**
     * Get the options for the server associated with this account.
     *
     * @param aCallback a callback taking an error status (if any), and the
     *        resulting options.
     */
    getOptions: function(aCallback) {
      if (!aCallback) aCallback = nullCallback;

      var conn = this;
      var xhr = new XMLHttpRequest({mozSystem: true, mozAnon: true});
      xhr.open('OPTIONS', this.baseUrl, true);
      setAuthHeader(xhr, this._username, this._password);
      xhr.setRequestHeader('User-Agent', USER_AGENT);
      xhr.timeout = this.timeout;

      xhr.upload.onprogress = xhr.upload.onload = function() {
        xhr.timeout = 0;
      };

      xhr.onload = function() {
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error('ActiveSync options request failed with response ' +
                        xhr.status);
          if (conn.onmessage)
            conn.onmessage('options', 'error', xhr, null, null, null, null);
          aCallback(new HttpError(xhr.statusText, xhr.status));
          return;
        }

        // These headers are comma-separated lists. Sometimes, people like to
        // put spaces after the commas, so make sure we trim whitespace too.
        var result = {
          versions: xhr.getResponseHeader('MS-ASProtocolVersions')
                       .split(/\s*,\s*/),
          commands: xhr.getResponseHeader('MS-ASProtocolCommands')
                       .split(/\s*,\s*/)
        };

        if (conn.onmessage)
          conn.onmessage('options', 'ok', xhr, null, null, null, result);
        aCallback(null, result);
      };

      xhr.ontimeout = xhr.onerror = function() {
        var error = new Error('Error getting OPTIONS URL');
        console.error(error);
        if (conn.onmessage)
          conn.onmessage('options', 'timeout', xhr, null, null, null, null);
        aCallback(error);
      };

      // Set the response type to "text" so that we don't try to parse an empty
      // body as XML.
      xhr.responseType = 'text';
      xhr.send();
    },

    /**
     * Check if the server supports a particular command. Requires that we be
     * connected to the server already.
     *
     * @param aCommand a string/tag representing the command type
     * @return true iff the command is supported
     */
    supportsCommand: function(aCommand) {
      if (!this.connected)
        throw new Error('Connection required to get command');

      if (typeof aCommand === 'number')
        aCommand = ASCP.__tagnames__[aCommand];
      return this.supportedCommands.indexOf(aCommand) !== -1;
    },

    /**
     * DEPRECATED. See postCommand() below.
     */
    doCommand: function() {
      console.warn('doCommand is deprecated. Use postCommand instead.');
      this.postCommand.apply(this, arguments);
    },

    /**
     * Send a WBXML command to the ActiveSync server and listen for the
     * response.
     *
     * @param aCommand {WBXML.Writer|String|Number}
     *   The WBXML representing the command or a string/tag representing the
     *   command type for empty commands
     * @param aCallback a callback to call when the server has responded; takes
     *        two arguments: an error status (if any) and the response as a
     *        WBXML reader. If the server returned an empty response, the
     *        response argument is null.
     * @param aExtraParams (optional) an object containing any extra URL
     *        parameters that should be added to the end of the request URL
     * @param aExtraHeaders (optional) an object containing any extra HTTP
     *        headers to send in the request
     * @param aProgressCallback (optional) a callback to invoke with progress
     *        information, when available. Two arguments are provided: the
     *        number of bytes received so far, and the total number of bytes
     *        expected (when known, 0 if unknown).
     */
    postCommand: function(aCommand, aCallback, aExtraParams, aExtraHeaders,
                          aProgressCallback) {
      var contentType = 'application/vnd.ms-sync.wbxml';

      if (typeof aCommand === 'string' || typeof aCommand === 'number') {
        this.postData(aCommand, contentType, null, aCallback, aExtraParams,
                      aExtraHeaders);
      }
      // WBXML.Writer
      else {
        var commandName = ASCP.__tagnames__[aCommand.rootTag];
        this.postData(
          commandName, contentType,
          aCommand.dataType === 'blob' ? aCommand.blob : aCommand.buffer,
          aCallback, aExtraParams, aExtraHeaders, aProgressCallback);
      }
    },

    /**
     * Send arbitrary data to the ActiveSync server and listen for the response.
     *
     * @param aCommand a string (or WBXML tag) representing the command type
     * @param aContentType the content type of the post data
     * @param aData {ArrayBuffer|Blob} the data to be posted
     * @param aCallback a callback to call when the server has responded; takes
     *        two arguments: an error status (if any) and the response as a
     *        WBXML reader. If the server returned an empty response, the
     *        response argument is null.
     * @param aExtraParams (optional) an object containing any extra URL
     *        parameters that should be added to the end of the request URL
     * @param aExtraHeaders (optional) an object containing any extra HTTP
     *        headers to send in the request
     * @param aProgressCallback (optional) a callback to invoke with progress
     *        information, when available. Two arguments are provided: the
     *        number of bytes received so far, and the total number of bytes
     *        expected (when known, 0 if unknown).
     */
    postData: function(aCommand, aContentType, aData, aCallback, aExtraParams,
      aExtraHeaders, aProgressCallback) {
      // Make sure our command name is a string.
      if (typeof aCommand === 'number')
        aCommand = ASCP.__tagnames__[aCommand];

      if (!this.supportsCommand(aCommand)) {
        var error = new Error("This server doesn't support the command " +
          aCommand);
        console.error(error);
        aCallback(error);
        return;
      }

      // Build the URL parameters.
      var params = [
        ['Cmd', aCommand],
        ['User', this._username],
        ['DeviceId', this._deviceId],
        ['DeviceType', this._deviceType]
      ];
      if (aExtraParams) {
        for (var iter in Iterator(params)) {
          var param = iter[1];
          if (param[0] in aExtraParams)
            throw new TypeError('reserved URL parameter found');
        }
        for (var kv in Iterator(aExtraParams))
          params.push(kv);
      }
      var paramsStr = params.map(function(i) {
        return encodeURIComponent(i[0]) + '=' + encodeURIComponent(i[1]);
      }).join('&');

      // Now it's time to make our request!
      var xhr = new XMLHttpRequest({mozSystem: true, mozAnon: true});
      xhr.open('POST', this.baseUrl + '?' + paramsStr, true);
      setAuthHeader(xhr, this._username, this._password);
      // xhr.setRequestHeader('MS-ASProtocolVersion', this.currentVersion);
      xhr.setRequestHeader('MS-ASProtocolVersion', this.currentVersion);
      xhr.setRequestHeader('Content-Type', aContentType);
      xhr.setRequestHeader('User-Agent', USER_AGENT);
      xhr.setRequestHeader('X-MS-PolicyKey', this.policyKey);

      // Add extra headers if we have any.
      if (aExtraHeaders) {
        for (var iter in Iterator(aExtraHeaders)) {
          var key = iter[0], value = iter[1];
          xhr.setRequestHeader(key, value);
        }
      }

      xhr.timeout = this.timeout;

      xhr.upload.onprogress = xhr.upload.onload = function() {
        xhr.timeout = 0;
      };
      xhr.onprogress = function(event) {
        if (aProgressCallback)
          aProgressCallback(event.loaded, event.total);
      };

      var conn = this;
      var parentArgs = arguments;
      xhr.onload = function() {
        // This status code is a proprietary Microsoft extension used to
        // indicate a redirect, not to be confused with the draft-standard
        // "Unavailable For Legal Reasons" status. More info available here:
        // <http://msdn.microsoft.com/en-us/library/gg651019.aspx>
        if (xhr.status === 451) {
          conn.baseUrl = xhr.getResponseHeader('X-MS-Location');
          if (conn.onmessage)
            conn.onmessage(aCommand, 'redirect', xhr, params, aExtraHeaders,
              aData, null);
          conn.postData.apply(conn, parentArgs);
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          console.error('ActiveSync command ' + aCommand + ' failed with ' +
            'response ' + xhr.status);
          if (conn.onmessage)
            conn.onmessage(aCommand, 'error', xhr, params, aExtraHeaders,
              aData, null);
          aCallback(new HttpError(xhr.statusText, xhr.status));
          return;
        }

        var response = null;
        if (xhr.response.byteLength > 0)
          response = new WBXML.Reader(new Uint8Array(xhr.response), ASCP);
        if (conn.onmessage)
          conn.onmessage(aCommand, 'ok', xhr, params, aExtraHeaders,
            aData, response);
        aCallback(null, response);
      };

      xhr.ontimeout = xhr.onerror = function(evt) {
        var error = new Error('Command URL ' + evt.type + ' for command ' +
          aCommand + ' at baseUrl ' + this.baseUrl);
        console.error(error);
        if (conn.onmessage)
          conn.onmessage(aCommand, evt.type, xhr, params, aExtraHeaders,
                         aData, null);
        aCallback(error);
      }.bind(this);

      xhr.responseType = 'arraybuffer';
      xhr.send(aData);
    },

    getSynckey: function(aCallback) {
      var as = ASCP.AirSync.Tags;
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(as.Sync)
        .stag(as.Collections)
          .stag(as.Collection)
            .tag(as.SyncKey, '0')
            .tag(as.CollectionId, this.CollectionId)
          .etag()
        .etag()
      .etag();
      this.postCommand(w, aCallback);
    },

    enforcement: function(aCallback) {
      var fh = ASCP.FolderHierarchy.Tags;
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(fh.FolderSync)
          .tag(fh.SyncKey, '0')
        .etag();
      this.postCommand(w, aCallback);
    },

    syncData: function(aCallback) {
      let as = ASCP.AirSync.Tags;
      let asb = ASCP.AirSyncBase.Tags;
      let type = ASCP.AirSyncBase.Enums.Type;
      let w = new WBXML.Writer('1.3', 1, 'UTF-8');
      let filterType = ASCP.AirSync.Enums.FilterType.ThreeMonthsBack;
      w.stag(as.Sync)
        .stag(as.Collections)
          .stag(as.Collection)
            .tag(as.SyncKey, this.SyncKey)
            .tag(as.CollectionId, this.CollectionId)
            .tag(as.DeletesAsMoves)
            .tag(as.GetChanges)
            .stag(as.Options)
              .tag(as.FilterType, filterType)
              .stag(asb.BodyPreference)
                .tag(asb.Type, type.PlainText)
              .etag()
            .etag()
          .etag()
        .etag()
      .etag();
      this.postCommand(w, aCallback);
    },

    dateToTransport: function(date, tzid, isDate) {
      var result = Object.create(null);
    
      if (isDate) {
        result.isDate = isDate;
      }
    
      if (tzid) {
        result.tzid = tzid;
      }
    
      var utc = Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds()
      );
    
      // remember a "date" is always a floating
      // point in time otherwise we don't use it...
      if (isDate || tzid && tzid === 'floating') {
        result.utc = utc;
        result.offset = 0;
        result.tzid = 'floating';
      } else {
        var localUtc = date.valueOf();
        var offset = utc - localUtc;
    
        result.utc = utc;
        result.offset = offset;
      }
    
      return result;
    },

    proSyncDate: function(date) {
      let dataTime = new Date();

      dataTime.setUTCFullYear(parseInt(date.substring(0, 4)));
      dataTime.setUTCMonth(parseInt(date.substring(4, 6)) - 1);
      dataTime.setUTCDate(parseInt(date.substring(6, 8)));
      dataTime.setUTCHours(parseInt(date.substring(9, 11)));
      dataTime.setUTCMinutes(parseInt(date.substring(11, 13)));
      dataTime.setUTCSeconds(parseInt(date.substring(13, 15)));
      dataTime.setUTCMilliseconds(0);
      
      return dataTime;
    },

    proAlldayDate: function(date) {
      if (date.getUTCHours() === 0 &&
        date.getUTCMinutes() === 0 &&
        date.getUTCSeconds() === 0) {
        let now = new Date();
        let timezoneOffset = now.getTimezoneOffset();

        return new Date(date.valueOf() + timezoneOffset * 60000);
      } else {
        return date;
      }
    },

    addCalendarBusytime: function(calendarData){
      let occurrence = {
        eventId: calendarData.UID,
        isException: false
      };
      occurrence.alarms = [];
      
      let startTime = this.proSyncDate(calendarData.StartTime);
      let endTime = this.proSyncDate(calendarData.EndTime);

      if (calendarData.AllDayEvent === '1') {
        startTime = this.proAlldayDate(startTime);
        endTime = this.proAlldayDate(endTime);
      }

      occurrence.start = this.dateToTransport(
        startTime,
        null, // TODO allow setting tzid
        false
      );
      occurrence.end = this.dateToTransport(
        endTime,
        null, // TODO allow setting tzid
        false
      );
      occurrence.recurrenceId = occurrence.start;

      let isAllDay = calendarData.AllDayEvent === '1' ? true : false;
      let alarmTrigger =
        this.getReminderData(calendarData.Reminder, isAllDay);

      occurrence.alarms.push({
        action: 'DISPLAY',
        trigger: alarmTrigger,
        tzid: null
      });

      this.stream.emit('occurrence', occurrence);
    },

    addCalendarEvent: function(calendarData){
      let eventData = {
        id: calendarData.UID,
        title: calendarData.Subject,
        location: calendarData.Location,
        recurrenceId:null,
        isRecurring:false,
        description: calendarData.description ? calendarData.description : null,
        serverId: calendarData.serverId,
        isAllDay: calendarData.AllDayEvent === '1' ? true : false
      };

      let startTime = this.proSyncDate(calendarData.StartTime);
      let endTime = this.proSyncDate(calendarData.EndTime);
      
      if (calendarData.AllDayEvent === '1') {
        startTime = this.proAlldayDate(startTime);
        endTime = this.proAlldayDate(endTime);
      }

      eventData.start = this.dateToTransport(
        startTime,
        null, // TODO allow setting tzid
        false
      );
      eventData.end = this.dateToTransport(
        endTime,
        null, // TODO allow setting tzid
        false
      );

      let alarmTrigger =
        this.getReminderData(calendarData.Reminder, eventData.isAllDay);

      eventData.alarms = [];
      eventData.alarms.push({
        action: 'DISPLAY',
        trigger: alarmTrigger,
        tzid: null
      });
      
      this.stream.emit('event', eventData);
    },

    calendarDataExist(calendarData, cached) {
      if (!(calendarData.UID in cached)) {
        return false;
      }

      let cachedItem = cached[calendarData.UID].remote;
      let repeatRule = 'never';
      if (calendarData.repeat) {
        repeatRule = this.decodeRecurrenceRule(calendarData);
      }

      let eventData = {
        id: calendarData.UID,
        title: calendarData.Subject,
        location: calendarData.Location,
        recurrenceId: null,
        isRecurring: false,
        description: calendarData.description ? calendarData.description : null,
        serverId: calendarData.serverId,
        isAllDay: calendarData.AllDayEvent === '1' ? true : false
      };

      let startTime = this.proSyncDate(calendarData.StartTime);
      let endTime = this.proSyncDate(calendarData.EndTime);

      if (calendarData.AllDayEvent === '1') {
        startTime = this.proAlldayDate(startTime);
        endTime = this.proAlldayDate(endTime);
      }

      eventData.start = this.dateToTransport(
        startTime,
        null, // TODO allow setting tzid
        false
      );
      eventData.end = this.dateToTransport(
        endTime,
        null, // TODO allow setting tzid
        false
      );

      let alarmTrigger =
        this.getReminderData(calendarData.Reminder, eventData.isAllDay);

      eventData.alarms = [];
      eventData.alarms.push({
        action: 'DISPLAY',
        trigger: alarmTrigger,
        tzid: null
      });

      if (eventData.title !== cachedItem.title ||
        eventData.location !== cachedItem.location ||
        eventData.isRecurring !== cachedItem.isRecurring ||
        eventData.description !== cachedItem.description ||
        eventData.serverId !== cachedItem.serverId ||
        eventData.isAllDay !== cachedItem.isAllDay ||
        eventData.start.startTime !== cachedItem.start.startTime ||
        eventData.start.offset !== cachedItem.start.offset ||
        eventData.end.endTime !== cachedItem.end.endTime ||
        eventData.end.offset !== cachedItem.end.offset ||
        eventData.alarms[0].trigger !== cachedItem.alarms[0].trigger ||
        repeatRule !== cachedItem.repeat) {
        return false;
      }

      return true;
    },

    getReminderData: function(reminder, isAllDay) {
      let alarmTrigger;
      let onlineReminder = parseInt(reminder) * -1 * 60;
      if (!reminder) {
        alarmTrigger = 'none';
      } else if (isAllDay) {
        alarmTrigger = alldayReminderArr.includes(onlineReminder) ?
          onlineReminder : this._app.alldayReminder;
      } else {
        alarmTrigger = stardarReminderArr.includes(onlineReminder) ?
          onlineReminder : this._app.standarReminder;
      }

      return alarmTrigger;
    },

    /**
     * Type:
     * 0: Recurs daily.
     * 1: Recurs weekly
     * 2: Recurs monthly
     * 
     * Interval：
     * The Interval specifies the interval between recurrences.
     * 
     */
    decodeRecurrenceRule: function(calendarData) {
      var repeatRule = 'feature phone not support';

      if (calendarData.Type === '0' && calendarData.Interval === '1') {
        repeatRule = 'every-day';
      } else if (calendarData.Type === '1' && calendarData.Interval === '1') {
        repeatRule = 'every-week';
      } else if (calendarData.Type === '1' && calendarData.Interval === '2') {
        repeatRule = 'every-2-weeks';
      } else if (calendarData.Type === '2' && calendarData.Interval === '1') {
        repeatRule = 'every-month';
      }

      return repeatRule;
    },

    recurrenceData: function(calendarData) {
      let data = {};
      let repeatRule = this.decodeRecurrenceRule(calendarData);

      data.remote = {
        title: calendarData.Subject,
        id: calendarData.UID,
        serverId: calendarData.serverId,
        location: calendarData.Location,
        repeat: 'every-day',
        description: calendarData.description ? calendarData.description : null,
        recurrenceId: null,
        isRecurring: true,
        isAllDay: calendarData.AllDayEvent === '1' ? true : false,
        preset: 'activesync',
      };

      data.remote.repeat = repeatRule;

      let startTime = this.proSyncDate(calendarData.StartTime);
      let endTime = this.proSyncDate(calendarData.EndTime);

      if (data.remote.isAllDay) {
        let now = new Date();
        let offset = now.getTimezoneOffset() * 60 * 1000;
        startTime = new Date(startTime.valueOf() + offset);
        endTime = new Date(endTime.valueOf() + offset);
      }

      data.remote.startDate = startTime;
      data.remote.endDate = endTime;

      data.remote.start = this.dateToTransport(
        startTime,
        null, // TODO allow setting tzid
        false
      );
      data.remote.end = this.dateToTransport(
        endTime,
        null, // TODO allow setting tzid
        false
      );

      data.remote.alarms = [];
      data.calendarId = this.calendar._id;

      let alarmTrigger =
        this.getReminderData(calendarData.Reminder, data.remote.isAllDay);

      data.remote.alarms.push({
        action: 'DISPLAY',
        trigger: alarmTrigger,
        tzid: null
      });

      return data;
    },

    getRecurrenceUntil: function(calendarData) {
      if (!calendarData.Until) {
        return null;
      }
      // <calendar:Until>20090713T190000Z</calendar:Until>
      let until = calendarData.Until;
      let endDateString = until.substring(0, 4) + '-' +
        until.substring(4, 6) + '-' +
        until.substring(6, 8) + ' ' +
        until.substring(9, 11) + ':' +
        until.substring(11, 13) + ':' +
        until.substring(13, 15);
      //new Date('2016-01-01 17:22:37')
      let endDate = new Date(endDateString);
      let oneMinuteMilliseconds = 60 * 1000;
      let endUtc = endDate.valueOf() -
        endDate.getTimezoneOffset() * oneMinuteMilliseconds;

      return endUtc;
    },

    addRecurenceCalendar: function(calendarData) {
      //delete this repeat event for update all future
      if (calendarData.UID === this._app.actDelForUpdate) {
        return;
      }

      // 1. creat event data
      let data = this.recurrenceData(calendarData);
      let endUtc = this.getRecurrenceUntil(calendarData);

      // 2. call local interface
      Local.prototype.createEvent(data, null, null, endUtc, 'noexpand');
    },

    deleteCalendarEvent: function(cache) {
      let arr = dayObserver.getEventsToBusytimes().get(cache._id);
      if (!arr) {
        return;
      }

      let busytimeId = arr[0];
      dayObserver.findAssociated(busytimeId).then(value => {
        Local.prototype.deleteEvent.call(self, value.event, value.busytime);
      })
    },

    getSyncData: function(cached, callback) {
      var moreAvailable = false;
      this.syncData((aError, aResponse) => {
        var errorStr = 'Error get Security Policy for ActiveSync: ';
        var doGetPolicy = false;
        if (aError) {
          console.error(errorStr, aError);
          if (aError.status === 449) {
            doGetPolicy = true;
          } else {
            return this._notifyConnected(aError, aOptions);
          }
        }

        if (!aResponse) {
          return callback && callback();
        }

        var as = ASCP.AirSync.Tags;
        let asEnum = ASCP.AirSync.Enums;
        var ace = ASCP.Common.Enums;
        var afe = ASCP.FolderHierarchy.Enums;
        var addNum = 0;
        var dataCollection = {};

        var eventNum = new WBXML.EventParser();
        eventNum.addEventListener([as.Sync, as.Collections, as.Collection,
          as.Commands], (function(num) {
          addNum = num;

          var e = new WBXML.EventParser();
          e.addEventListener([as.Sync,as.Collections,as.Collection,as.SyncKey],
            (node) => {
            this.SyncKey = node.children[0].textContent;
          });
          e.addEventListener(
            [as.Sync,as.Collections,as.Collection,as.MoreAvailable], (app) =>{
            moreAvailable = true;
          });
          e.addEventListener([as.Sync,as.Collections,as.Collection,as.Status],
            (node)=> {
            status = node.children[0].textContent;
          })
          e.addEventListener([as.Sync, as.Collections, as.Collection,
            as.Commands, [as.Add, as.Change, as.Delete]], (node) => {
            var folder = {};
            var calendarData = {};

            for (var iter in Iterator(node.children)) {
              var child = iter[1];
              folder[child.localTagName] = child.children[0].textContent;
              if (child.localTagName === 'ApplicationData') {
                for (var iter in Iterator(child.children)){
                  var childData = iter[1];

                  if (childData.localTagName === 'Recurrence') {
                    calendarData.repeat = true;

                    for (let item in Iterator(childData.children)) {
                      let childItem = item[1];
                      if (!childItem.children[0]) {
                        calendarData[childItem.localTagName] = null;
                      } else {
                        calendarData[childItem.localTagName] =
                          childItem.children[0].textContent;
                      }
                    }
                  } else if (childData.localTagName === 'Location' &&
                    childData.children[0] &&
                    childData.children[0].children[0]) {
                    calendarData[childData.localTagName] =
                    childData.children[0].children[0].textContent;
                  } else if (childData.localTagName === 'Body') {
                    for (let i = 0; i < childData.children.length; i++) {
                      if (childData.children[i].localTagName === 'Data') {
                        calendarData.description =
                          childData.children[i].children[0].textContent;
                        break;
                      }
                    }
                  } else if (!childData.children[0]) {
                    calendarData[childData.localTagName] = null;
                  } else {
                    calendarData[childData.localTagName] =
                      childData.children[0].textContent;
                  }
                }
              }
            }

            if (node.tag === as.Add &&
              calendarData.OrganizerEmail.toLowerCase() === this._accountId) {
              calendarData.serverId = folder.ServerId;
              if (!this.calendarDataExist(calendarData, cached)) {
                if (!calendarData.repeat) {
                  this.addCalendarEvent(calendarData);
                  this.addCalendarBusytime(calendarData);
                } else {
                  this.addRecurenceCalendar(calendarData);
                }
              }
            }

            if (calendarData.UID in cached) {
              delete cached[calendarData.UID];
            }

            addNum--;
            if (addNum <= 0) {
              for (var id in cached) {
                this.deleteCalendarEvent(cached[id]);
              }

              this._app.recurringEventsController.queueExpand(
                this._app.timeController.position
              );

              if (!moreAvailable) {
                callback();
              }
            }
          });
          try{
            e.run(aResponse)
          } catch(ex){
            console.error(errorStr, ex);
          }
          if (status === asEnum.Status.Success) {
            if (moreAvailable) {
              this.getSyncData(cached,err=>{
                callback(err)
              });
            }
          }
        }).bind(this));
        try {
          eventNum.runGetNum(aResponse);
        }
        catch (ex) {
          console.error(errorStr, ex);
        }
      });
    }, 

    dateToString: function(date) {
      var year = date.getUTCFullYear().toString();
      var month = (date.getUTCMonth() + 1).toString();
      var day = date.getUTCDate().toString();
      var hour = date.getUTCHours().toString();
      var minute = date.getUTCMinutes().toString();
      var second = date.getUTCSeconds().toString();

      if (month.length === 1) {
        month = '0' + month;
      }

      if (day.length === 1) {
        day = '0' + day;
      }

      if (hour.length === 1) {
        hour = '0' + hour;
      }

      if (minute.length === 1) {
        minute = '0' + minute;
      }

      if (second.length === 1) {
        second = '0' + second;
      }

      var dateString = year + month + day + 'T' + hour + minute + second + 'Z'

      return dateString;
    },

    /**
     * recurType:
     * 0: Recurs daily.
     * 1: Recurs weekly
     * 2: Recurs monthly
     * 
     * recurInterval:
     * The Interval specifies the interval between recurrences.
     * 
     * dayOfWeek:
     * The dayOfWeek specifies the day of the week for the recurrence.
     * 1: Sunday
     * 2: Monday
     * 4: Tuesday
     * 8: Wednesday
     * 16: Thursday
     * 32: Friday
     * 64: Saturday
     * 
     */
    getRecurrenceRule: function (event) {
      let recurType = null;
      let recurInterval = null;
      let dayOfWeek = null;
      let dayOfMonth = null;
      let firstDayOfWeek = null;
      let recurrenceRule = {};
      let dayWeekArr = [1, 2, 4, 8, 16, 32, 64];

      switch (event.remote.repeat) {
        case 'every-day':
          recurType = 0;
          recurInterval = 1;
          break;
        case 'every-week':
          recurType = 1;
          recurInterval = 1;
          dayOfWeek = dayWeekArr[event.remote.startDate.getDay()];
          break;
        case 'every-2-weeks':
          recurType = 1;
          recurInterval = 2;
          dayOfWeek = dayWeekArr[event.remote.startDate.getDay()];
          break;
        case 'every-month':
          recurType = 2;
          recurInterval = 1;
          dayOfMonth = event.remote.startDate.getDate();
          break;
      }

      recurrenceRule.type = recurType;
      recurrenceRule.interval = recurInterval;
      recurrenceRule.dayOfWeek = dayOfWeek;
      recurrenceRule.dayOfMonth = dayOfMonth;
      recurrenceRule.firstDayOfWeek = firstDayOfWeek;

      return recurrenceRule;
    },

    addEventData: function(event, aCallback) {
      this.isCreateEvent = false;
      let startDate = this.dateToString(event.remote.startDate);
      let endDate = this.dateToString(event.remote.endDate);
      let as = ASCP.AirSync.Tags;
      let asb = ASCP.AirSyncBase.Tags;
      let ca = ASCP.Calendar.Tags;
      let type = ASCP.AirSyncBase.Enums.Type;
      let w = new WBXML.Writer('1.3', 1, 'UTF-8');
      let recurRule = this.getRecurrenceRule(event);
      let isAllDay = event.isAllDay || event.remote.isAllDay ? 1 : 0;

      if (isAllDay) {
        let now = new Date();
        let offset = now.getTimezoneOffset() * 60 *1000;
        startDate = this.dateToString(
          new Date(event.remote.startDate.valueOf() - offset));
        endDate = this.dateToString(
          new Date(event.remote.endDate.valueOf() - offset));
      }

      w.stag(as.Sync)
          .stag(as.Collections)
            .stag(as.Collection)
              .tag(as.SyncKey, this.SyncKey)
              .tag(as.CollectionId, this.CollectionId)
              .stag(as.Commands)
                .stag(as.Add)
                  .tag(as.ClientId, Date.now().toString()+'@kaios')
                  .stag(as.ApplicationData)
                     .tag(ca.StartTime, startDate)
                     .tag(ca.Subject, event.remote.title)
                    if (recurRule.type !== null) {
                      w.stag(ca.Recurrence)
                        .tag(ca.Type, recurRule.type)
                        .tag(ca.Interval, recurRule.interval)
                        if (recurRule.dayOfWeek) {
                          w.tag(ca.DayOfWeek, recurRule.dayOfWeek)
                        }

                        if (recurRule.dayOfMonth) {
                          w.tag(ca.DayOfMonth, recurRule.dayOfMonth)
                        }

                        if (event.endUtc) {
                          w.tag(ca.Until,
                            this.dateToString(new Date(event.endUtc)))
                        }

                      w.etag()
                    }
                    // 14.1 -- the exchange server's version
                    if (this.currentVersion.lte('14.1')) {
                      w.tag(ca.UID, this._accountId + Date.now().toString() +
                        Math.random().toString());
                    }
                    if (event.remote.location &&
                      this.currentVersion.gte('16.0')){
                      w.stag(asb.Location)
                        .tag(asb.DisplayName, event.remote.location)
                      .etag()
                    }
                    if (event.remote.description) {
                      w.stag(asb.Body)
                        .tag(asb.Type, type.PlainText)
                        .tag(asb.Data, event.remote.description)
                      .etag()
                    }
                    if (event.remote.alarms[0]) {
                      w.tag(ca.Reminder,
                        Math.abs(event.remote.alarms[0].trigger) / 60);
                    }
                     w.tag(ca.EndTime, endDate)
                    .tag(ca.AllDayEvent, isAllDay)
                  .etag()
                .etag()
              .etag()
            .etag()
          .etag()
        .etag();
      this.postCommand(w, aCallback);
    },

    addEvent: function(account, calendar, event, callback) {
      this.addEventData(event, (function(aError, aResponse) {
        var errorStr = 'Error get Security Policy for ActiveSync: ';
        var doGetPolicy = false;
        if (aError) {
          console.error(errorStr, aError);
          if (aError.status === 449) {
            doGetPolicy = true;
          } else {
            return this._notifyConnected(aError, aOptions);
          }
        }

        var e = new WBXML.EventParser();
        var as = ASCP.AirSync.Tags;
        var ace = ASCP.Common.Enums;
        var afe = ASCP.FolderHierarchy.Enums;

        e.addEventListener([as.Sync, as.Collections, as.Collection, as.Responses, 
          [as.Add]], (function(node) {
           var folder = {};
           var calendarData = {};

          for (var iter in Iterator(node.children)) {
            var child = iter[1];
            folder[child.localTagName] = child.children[0].textContent;
          }

          // Status = '1' means 'Success'
          if (folder.Status && folder.Status === '1') {
            callback();
          }
        }).bind(this));

        try {
          e.run(aResponse);
        }
        catch (ex) {
          console.error(errorStr, ex);
          callback();
        }
      }).bind(this));
    },



    deleteEventData: function(event, aCallback) {
      var as = ASCP.AirSync.Tags;
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');

      w.stag(as.Sync)
          .stag(as.Collections)
            .stag(as.Collection)
              .tag(as.SyncKey, this.SyncKey)
              .tag(as.CollectionId, this.CollectionId)
              .tag(as.DeletesAsMoves)
              .tag(as.GetChanges)
              .stag(as.Commands)
                .stag(as.Delete)
                  .tag(as.ServerId, event.remote.serverId)
                .etag()
              .etag()
            .etag()
          .etag()
        .etag();

      this.postCommand(w, aCallback);
    },

    deleteEvent: function(account, calendar, event, callback) {
      this.deleteEventData(event, (function(aError, aResponse) {
        var errorStr = 'Error get Security Policy for ActiveSync: ';
        var doGetPolicy = false;
        if (aError) {
          console.error(errorStr, aError);
          if (aError.status === 449) {
            doGetPolicy = true;
          } else {
            return this._notifyConnected(aError, aOptions);
          }
        }

        var e = new WBXML.EventParser();
        var as = ASCP.AirSync.Tags;
        var ace = ASCP.Common.Enums;
        var afe = ASCP.FolderHierarchy.Enums;

        e.addEventListener([as.Sync, as.Collections, as.Collection], (function(node) {
           var folder = {};
           var calendarData = {};

          for (var iter in Iterator(node.children)) {
            var child = iter[1];
            folder[child.localTagName] = child.children[0].textContent;
          }

          // Status = '1' means 'Success'
          if (folder.Status && folder.Status === '1') {
            callback();
          }
        }).bind(this));

        try {
          e.run(aResponse);
        }
        catch (ex) {
          console.error(errorStr, ex);
          callback();
        }
      }).bind(this));
    }
  };

  return exports;
});

define('app',['require','exports','module','calc','date_l10n','db','controllers/error','pending_manager','controllers/recurring_events','router','controllers/service','controllers/sync','controllers/time','controllers/delete','day_observer','debug','message_handler','next_tick','controllers/notifications','controllers/periodic_sync','performance','provider/provider_factory','snake_case','presets','models/account','activesync/protocol'],function(require, exports, module) {


var Calc = require('calc');
var DateL10n = require('date_l10n');
var Db = require('db');
var ErrorController = require('controllers/error');
var PendingManager = require('pending_manager');
var RecurringEventsController = require('controllers/recurring_events');
var router = require('router');
var ServiceController = require('controllers/service');
var SyncController = require('controllers/sync');
var TimeController = require('controllers/time');
var DeleteController = require('controllers/delete');
var Views = {};
var dayObserver = require('day_observer');
var debug = require('debug')('app');
var messageHandler = require('message_handler');
var nextTick = require('next_tick');
var notificationsController = require('controllers/notifications');
var periodicSyncController = require('controllers/periodic_sync');
var performance = require('performance');
var providerFactory = require('provider/provider_factory');
var snakeCase = require('snake_case');
var Presets = require('presets');
var Account = require('models/account');
var asproto = require('activesync/protocol');

var pendingClass = 'pending-operation';
var settings = window.navigator.mozSettings;
const calendarSyncKey = 'calendarSyncEnable';

/**
 * Focal point for state management
 * within calendar application.
 *
 * Contains tools for routing and central
 * location to reference database.
 */
module.exports = {
  startingURL: window.location.href,
  skPanel: null,
  deleteDialogShown: false,
  lowMemory: false,
  calendarIdNum: 0,
  eventDetails: {},
  multiEventDetails: {},
  loginAccount: false,
  asproto: null,
  selectedDayUTC: 0,
  duplicateAccount: false,
  actDelForUpdate: null,
  isShowLunday: false, // Defect216-ting-wang@t2mobile.com-Chinese Calendar requirement just use in China
  standarReminder: 0,
  alldayReminder: 0,

  /**
   * Entry point for application
   * must be called at least once before
   * using other methods.
   */
  configure: function(db) {
    debug('Configure calendar with db.');
    this.db = db;
    router.app = this;

    providerFactory.app = this;

    this._views = Object.create(null);
    this._routeViewFn = Object.create(null);
    this._pendingManager = new PendingManager();

    window.require(['css!lazy_loaded']);

    this._pendingManager.oncomplete = function onpending() {
      document.body.classList.remove(pendingClass);
      performance.pendingReady();
    };

    this._pendingManager.onpending = function oncomplete() {
      document.body.classList.add(pendingClass);
    };

    messageHandler.app = this;
    messageHandler.start();
    this.timeController = new TimeController(this);
    this.syncController = new SyncController(this);
    this.serviceController = new ServiceController(this);
    this.errorController = new ErrorController(this);
    notificationsController.app = this;
    periodicSyncController.app = this;

    dayObserver.busytimeStore = this.store('Busytime');
    dayObserver.calendarStore = this.store('Calendar');
    dayObserver.eventStore = this.store('Event');
    dayObserver.syncController = this.syncController;
    dayObserver.timeController = this.timeController;

    // observe sync events
    this.observePendingObject(this.syncController);

    // Tell audio channel manager that we want to adjust the notification
    // channel if the user press the volumeup/volumedown buttons in Calendar.
    if (navigator.mozAudioChannelManager) {
      navigator.mozAudioChannelManager.volumeControlChannel = 'notification';
    }
    //Defect216-ting-wang@t2mobile.com-Chinese Calendar requirement just use in China-begin
    navigator.customization.getValue("lunar.day.enable").then((result) => {
      dump("The lunar day state is" + result);
      this.isShowLunday = (result == undefined) ? false : result;

    });
    // Defect216-ting-wang@t2mobile.com-Chinese Calendar requirement just use in China-end
  },

  /**
   * Observes localized events and localizes elements
   * with data-l10n-date-format should be registered
   * after the first localized event.
   *
   *
   * Example:
   *
   *
   *    <span
   *      data-date="Wed Jan 09 2013 19:25:38 GMT+0100 (CET)"
   *      data-l10n-date-format="%x">
   *
   *      2013/9/19
   *
   *    </span>
   *
   */
  observeDateLocalization: function() {
    window.addEventListener('localized', DateL10n.localizeElements);
    window.addEventListener('timeformatchange', () => {
      this.setCurrentTimeFormat();
      DateL10n.changeElementsHourFormat();
    });
  },

  setCurrentTimeFormat: function() {
    document.body.dataset.timeFormat = navigator.mozHour12 ? '12' : '24';
  },

  /**
   * Adds observers to objects capable of being pending.
   *
   * Object must emit some kind of start/complete events
   * and have the following properties:
   *
   *  - startEvent (used to register an observer)
   *  - endEvent ( ditto )
   *  - pending
   *
   * @param {Object} object to observe.
   */
  observePendingObject: function(object) {
    this._pendingManager.register(object);
  },

  isPending: function() {
    return this._pendingManager.isPending();
  },

  _routes: function() {

    /* routes */
    router.state('/week/', 'Week');
    router.state('/day/', 'Day');
    router.state('/month/', ['Month', 'MonthDayAgenda']);
    router.state('/settings/', 'Settings');
    router.state('/advanced-settings/', 'AdvancedSettings');
    router.state('/switchto-date/', 'SwitchtoDate');
    router.state('/search/', 'EventSearch');
    router.state('/alarm-display/:id', 'ViewEvent', { path: false });
    router.state('/show-multi-events/', 'MultiEvents');

    router.state('/event/add/', 'ModifyEvent');
    router.state('/event/edit/:id', 'ModifyEvent');
    router.state('/event/show/:id', 'ViewEvent');

    router.state('/select-preset/', 'CreateAccount');
    router.state('/create-account/:preset', 'ModifyAccount');
    router.state('/update-account/:id', 'ModifyAccount');
    router.state('/password/:id', 'ModifyPassword');
    //Task 5317587 Add by ting-wang@t2mobile.com 20170911
    router.state('/lunar-day/', 'LunarDay');

    router.start();

    // at this point the tabs should be interactive and the router ready to
    // handle the path changes (meaning the user can start interacting with
    // the app)
    performance.chromeInteractive();

  },

  _initControllers: function() {
    // controllers can only be initialized after db.load

    // start the workers
    this.serviceController.start(false);

    notificationsController.observe();
    periodicSyncController.observe();

    var recurringEventsController = new RecurringEventsController(this);
    this.observePendingObject(recurringEventsController);
    recurringEventsController.observe();
    this.recurringEventsController = recurringEventsController;
    this.deleteController = new DeleteController(this);

    // turn on the auto queue this means that when
    // alarms are added to the database we manage them
    // transparently. Defaults to off for tests.
    this.store('Alarm').autoQueue = true;
  },

  _getCalendarIdNum() {
    var calendarStore = this.store('Calendar');
    calendarStore.all(function(err, calendars) {
      if (err) {
        return console.error('Could not build list of calendars');
      }
      for (var id in calendars) {
        this.calendarIdNum++;
      }
    }.bind(this));
  },

  _createModel: function(preset, callback) {
    var settings = Presets[preset];
    var model = new Account(settings.options);
    model.preset = preset;
    return model;
  },

  _addSyncGoogleAccount: function(aAccount, refresh) {
    let model = this._createModel(aAccount.authenticatorId);

    navigator.accountManager.getCredential(aAccount,
      {refreshCredential: refresh}).then((credentials) => {
      if (Date.now() >= credentials.expire_timestamp) {
        this._addSyncGoogleAccount(aAccount, true);
        return;
      }

      model.oauth = {
        access_token: credentials.access_token,
        issued_at: Date.now(),
        expires_in: 0,
        token_type: credentials.token_type,
        id_token: null,
        refresh_token: null,
        scope: null
      }
      model.oauth.expires_in =
        credentials.expire_timestamp - model.oauth.issued_at;
      model.user = aAccount.accountId;
      model.calendarHome = '/caldav/v2/' +
        aAccount.accountId.replace(/@/g, '%40');
      model.syncFlag = true;

      let accountStore = this.store('Account');
      let calendarStore = this.store('Calendar');
      accountStore.verifyAndPersistNew(model, (accErr, id, result) => {
        if (accErr) {
          return;
        }
        accountStore.syncCalendars(result, (syncErr) => {
          if (syncErr) {
            return;
          }

          this.syncController.all();
          return;
        });
      });
    }, (reason) => {
      console.log("getCredentials rejected: " + reason);
    });
  },


  _addSyncActivesyncAccount: function(aAccount) {
    let model = this._createModel(aAccount.authenticatorId);

    navigator.accountManager.getCredential(aAccount,
      {refreshCredential: false}).then((credentials) => {
      model.exchange = {
        server: credentials.configInfo.server,
        deviceId: credentials.configInfo.deviceId,
        policyKey: credentials.configInfo.policyKey
      }
      model.accountId = aAccount.accountId;
      model.user = credentials.username;
      model.password = credentials.password;
      model.syncFlag = true;

      let accountStore = this.store('Account');
      let calendarStore = this.store('Calendar');
      accountStore.verifyAndPersistNew(model, (accErr, id, result) => {
        if (accErr) {
          // we bail when we cannot create the account
          // but also give custom erro_createModelr events.
          return;
        }

        // finally sync the account so when
        // we exit the request the user actually
        // has some calendars. This should not take
        // too long (compared to event sync).
        accountStore.syncCalendars(result, (syncErr) => {
          if (syncErr) {
            return;
          }

          this.syncController.all();
          return;
        });
      });
    }, (reason) => {
      console.log("getCredentials rejected: " + reason);
    });
  },

  _addSyncAccount: function(accounts) {
    if (accounts.length === 0) {
      return;
    }

    for (let i = 0; i < accounts.length; i++) {
      if (accounts[i].authenticatorId === 'google') {
        this._addSyncGoogleAccount(accounts[i], true);
      } else if (accounts[i].authenticatorId === 'activesync') {
        this._addSyncActivesyncAccount(accounts[i]);
      }
    }
  },

  _getCalendarAccount: function() {
    settings.createLock().get(calendarSyncKey).then((result) => {
      this._checkAccountChange(result.calendarSyncEnable, true);
    });
  },

  _refreshAccount: function(syncAccount, localAccount, refresh, syncFlag) {
    navigator.accountManager.getCredential(syncAccount,
      {refreshCredential: refresh}).then((credentials) => {
      if (localAccount.preset === 'google') {
        if (Date.now() < credentials.expire_timestamp) {
          localAccount.oauth.access_token = credentials.access_token;
          localAccount.oauth.issued_at = Date.now();
          localAccount.oauth.expires_in =
            credentials.expire_timestamp - localAccount.oauth.issued_at;
        } else {
          this._refreshAccount(syncAccount, localAccount, true);
          return;
        }
      } else if (localAccount.preset === 'activesync') {
        localAccount.password = credentials.password;
      }

      if (syncFlag) {
        localAccount.syncFlag = syncFlag;
      }

      let accountStore = this.store('Account');
      accountStore.verifyAndPersistNew(localAccount, (accErr, id, result) => {
        if (accErr) {
          return;
        }

        if (syncFlag) {
          this.syncController.all();
        }
      });
    }, (reason) => {
      console.log("getCredentials rejected: " + reason);
    });
    return;
  },

  _accountManagerOnchanged: function(event) {
    // event.detail
    // Object { action: "onlogout", accountId: "xxx@gmail.com",
    //         authenticatorId: "google" }
    var data = event.detail;

    if (!document.hidden) {
      return;
    }

    navigator.accountManager.getAccounts().then((accounts) => {
      var syncIndex = accounts.findIndex((node) => {
        return node.accountId === data.accountId;
      });

      if (data.action === 'onlogin') {
        return;
      }

      var account = this.store('Account');
      account.all(function(err, list) {
        var findFlag = false;
        for (var i in list) {
          if (list[i].user === data.accountId ||
            list[i].accountId === data.accountId) {
            findFlag = true;
            break;
          }
        }

        if (!findFlag) {
          return;
        }

        if (data.action === 'onlogout') {
          account.remove(list[i]._id);
        } else if (data.action === 'onrefreshed') {
          this._refreshAccount(accounts[syncIndex], list[i], false);
        }
      }.bind(this));
    });
  },

  _checkAccountChange: function(settingValue, lanuchFlag) {
    navigator.accountManager.getAccounts().then((accounts) => {
      var account = this.store('Account');
      account.all((err, list) => {
        for (var i in settingValue) {
          var checkFlag = false;
          for (var j in list) {
            if (list[j].user === i || list[j].accountId === i) {
              checkFlag = true;
              break;
            }
          }

          var syncIndex = accounts.findIndex((node) => {
            return node.accountId === i;
          });
          if (settingValue[i] && !checkFlag) {
            // add account


            if (syncIndex === -1) {
              continue;
            }

            this._addSyncAccount([accounts[syncIndex]]);

            // sync account data
          } else if (!settingValue[i] && checkFlag) {
            if (list[j].syncFlag) {
              this.accountSyncChange(list[j]._id, false);
            }
          } else if (settingValue[i] && checkFlag) {
            this._refreshAccount(accounts[syncIndex], list[j], false,
              !list[j].syncFlag);
          }
        }

        if (lanuchFlag) {
          for (let listIndex in list) {
            let existFlag = false;
            for (let settingIndex in settingValue) {
              if (list[listIndex].user === settingIndex ||
                list[listIndex].accountId === settingIndex) {
                existFlag = true;
                break;
              }
            }

            if (!existFlag && (list[listIndex].preset === 'google' ||
              list[listIndex].preset === 'activesync')) {
              account.remove(list[listIndex]._id);
            }
          }
        }
      });
    });
  },

  _calendarSettingsChange: function(evt) {
    if (evt.settingValue && (document.hidden || this.duplicateAccount)) {
      this.duplicateAccount = false;
      this._checkAccountChange(evt.settingValue);
    }
  },

  _initUI: function() {
    this._syncTodayDate();

    this.setCurrentTimeFormat();
    // re-localize dates on screen
    this.observeDateLocalization();

    let datetime = new Date();
    this.timeController.move(datetime);
    this.timeController.selectedDay = datetime;

    // at this point we remove the .loading class and user will see the main
    // app frame
    performance.domLoaded();

    this._routes();
    this._getCalendarIdNum();
    this._getCalendarAccount();
    navigator.accountManager.onchanged =
      this._accountManagerOnchanged.bind(this);
    settings.addObserver(calendarSyncKey, this._calendarSettingsChange.bind(this));
    this.asproto = asproto;

    nextTick(() => this.view('Errors'));

    window.addEventListener('largetextenabledchanged', (event) => {
      document.body.classList.toggle('large-text', navigator.largeTextEnabled);
    });
    document.body.classList.toggle('large-text', navigator.largeTextEnabled);
  },

  _setPresentDate: function() {
    var id = Calc.getDayId(new Date());
    var presentDate = document.querySelector(
      '#month-view [data-date="' + id + '"]'
    );
    var previousDate = document.querySelector('#month-view .present');

    previousDate.classList.remove('present');
    previousDate.classList.add('past');
    presentDate.classList.add('present');
  },

  _syncTodayDate: function() {
    var now = new Date();
    var midnight = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() + 1,
      0, 0, 0
    );

    var timeout = midnight.getTime() - now.getTime();
    setTimeout(() => {
      this._setPresentDate();
      this._syncTodayDate();
    }, timeout);
  },

  _initReminder: function() {
    let settings = this.store('Setting');
    settings.getValue('standardAlarmDefault', (err, value) => {
      if (err) {
        // event reminder 5 minutes before
        this.standarReminder = -300;
        return;
      }

      this.standarReminder = value;
    });

    settings.getValue('alldayAlarmDefault', (err, value) => {
      if (err) {
        // all day event reminder on day of 9:00 am
        this.alldayReminder = 32400;
        return;
      }

      this.alldayReminder = value;
    });
  },

  /**
   * Primary code for app can go here.
   */
  init: function() {
    debug('Will initialize calendar app...');

    if (!this.db) {
      this.configure(new Db('b2g-calendar', this));
    }

    this.db.load(() => {
      this._initControllers();
      // it should only start listening for month change after we have the
      // calendars data, otherwise we might display events from calendars that
      // are not visible. this also makes sure we load the calendars as soon as
      // possible

      dayObserver.init()
      // we init the UI after the db.load to increase perceived performance
      // (will feel like busytimes are displayed faster)
      this._initUI();
      this._initReminder();
      this.lowMemory = localStorage.getItem('isLowMemoryDevice') === 'true' ?
        true : false;
      window.addEventListener('routerGoMonth', () => {
        router.go('/month/');
      });
    });
  },

  _initView: function(name) {
    var view = new Views[name]({ app: this });
    this._views[name] = view;
  },

  /**
   * Initializes a view and stores
   * a internal reference so when
   * view is called a second
   * time the same view is used.
   *
   * Makes an asynchronous call to
   * load the script if we do not
   * have the view cached.
   *
   *    // for example if you have
   *    // a calendar view Foo
   *
   *    Calendar.Views.Foo = Klass;
   *
   *    app.view('Foo', function(view) {
   *      (view instanceof Calendar.Views.Foo) === true
   *    });
   *
   * @param {String} name view name.
   * @param {Function} view loaded callback.
   */
  view: function(name, cb) {
    if (name in this._views) {
      debug('Found view named ', name);
      var view = this._views[name];
      return cb && nextTick(() => cb.call(this, view));
    }

    if (name in Views) {
      debug('Must initialize view', name);
      this._initView(name);
      return this.view(name, cb);
    }

    var snake = snakeCase(name);
    debug('Will try to load view', name);
    // we need to grab the global `require` because the async require is not
    // part of the AMD spec and is not implemented by all loaders
    window.require([ 'views/' + snake ], (aView) => {
      debug('Loaded view', name);
      Views[name] = aView;
      return this.view(name, cb);
    });
  },

  /**
   * Pure convenience function for
   * referencing a object store.
   *
   * @param {String} name store name. (e.g events).
   * @return {Calendar.Store.Abstact} store.
   */
  store: function(name) {
    return this.db.getStore(name);
  },

  /**
   * Returns the offline status.
   */
  offline: function() {
    return (navigator && 'onLine' in navigator) ? !navigator.onLine : true;
  },

  getDataState: function(key) {
    return new Promise((resolve, reject) => {
      var dataCallMgr = navigator.dataCallManager;

      if(!dataCallMgr){
        reject('dataCallMgr is null')
        return;
      }

      let dataPromise = dataCallMgr.getDataCallState("default", key);
      dataPromise.then((dataObj) => {
        resolve(dataObj);
      }).catch((error) => {
        reject(error);
      });
    });
  },

  getAllDataState: function() {
    return new Promise((resolve) => {
      var promiseList = [];
      for (var i = 0; i < navigator.mozMobileConnections.length; i++) {
        promiseList.push(this.getDataState(i));
      }

      Promise.all(promiseList).then((results) => {
        resolve(results);
      });
    });
  },

  getDataConnState: function() {
    return new Promise((resolve) => {
      if (navigator.mozWifiManager && navigator.mozWifiManager.connection &&
        navigator.mozWifiManager.connection.status === 'connected') {
        resolve(true);
      } else {
        self.app.getAllDataState().then((results) => {
          let connectFlag = false;
          for (let i = 0; i < results.length; i++) {
            if (results[i] === 'connected') {
              connectFlag = true;
              break;
            }
          }

          if (connectFlag) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }
    });
  },

  setCalendarSyncSettingValue: function(accountId, checked) {
    settings.createLock().get(calendarSyncKey).then((result) => {
      if (result[calendarSyncKey]) {
        let calendarSync = result[calendarSyncKey];
        calendarSync[accountId.toLowerCase()] = checked;
        let syncInfo = {};
        syncInfo[calendarSyncKey] = calendarSync;
        settings.createLock().set(syncInfo);
      }
    });
  },

  accountSyncChange: function(accountId, syncFlag, setSettingValue) {
    let accountStore = this.store('Account');

    accountStore.get(accountId, (err, value) => {
      value.syncFlag = syncFlag;
      accountStore.updateAccountData(value, (accErr, id, result) => {
        if (accErr) {
          return;
        }

        if (syncFlag) {
          this.syncController.all();
        }

        if (setSettingValue) {
          this.setCalendarSyncSettingValue(result.user, syncFlag);
        }
      });
    });
  },

  createSks: function(actions) {
    var params = {
      header: {
        l10nId: 'options',
        name: 'Options'
      },
      items: actions
    };
    if (this.skPanel) {
      this.skPanel.initSoftKeyPanel(params);
      this.skPanel.show();
    } else {
      this.skPanel = new SoftkeyPanel(params);
      this.skPanel.show();
    }
    if(actions.length == 0) {
      this.hideSkPanel();
    }
  },

  getSkPanel: function() {
    return this.skPanel;
  },

  hideSkPanel: function() {
    if(this.skPanel) {
      this.skPanel.hide();
    }
  },

  showSkPanel: function() {
    if(this.skPanel) {
      this.skPanel.show();
    }
  },

  closeApp: function() {
    window.close();
  }
};

});

(function() {


window.require = window.require || window.curl;

require.config({
  baseUrl: '/js',
  waitSeconds: 60,
  paths: {
    shared: '/shared/js',
    dom: 'curl/plugin/dom',
    css: 'curl/plugin/css'
  },
  shim: {
    'ext/caldav': { exports: 'Caldav' },
    'ext/ical': { exports: 'ICAL' },
    'ext/page': { exports: 'page' },
    'shared/input_parser': { exports: 'InputParser' },
    'shared/notification_helper': { exports: 'NotificationHelper' },
    'shared/performance_testing_helper': { exports: 'PerformanceTestingHelper' }
  }
});

// first require.config call is used by r.js optimizer, so we do this second
// call to list modules that are bundled to avoid duplicate defines
require.config({
  paths: {
    'views/week': 'lazy_loaded',
    'views/advanced_settings': 'lazy_loaded',
    'views/create_account': 'lazy_loaded',
    'views/day': 'lazy_loaded',
    'views/modify_account': 'lazy_loaded',
    'views/modify_password': 'lazy_loaded',
    'views/modify_event': 'lazy_loaded',
    'views/settings': 'lazy_loaded',
    'views/view_event': 'lazy_loaded',
    'views/event_search': 'lazy_loaded',
    'views/multi_events': 'lazy_loaded',
    'views/switchto_date': 'lazy_loaded',
    'views/lunar_day':'lazy_loaded'
  }
});

require(['app'], app => app.init());

}());

define("main", function(){});

define('view',['require','exports','module'],function(require, exports, module) {


var DEFAULT_ERROR_ID = 'error-default';
const INVALID_CSS = /([^a-zA-Z\-\_0-9])/g;

/**
 * Very simple base class for views.
 * Provides functionality for active/inactive.
 *
 * The first time the view is activated
 * the onactive function/event will fire.
 *
 * The .seen property is added to each object
 * with view in its prototype. .seen can be used
 * to detect if the view has ever been activated.
 *
 * @param {String|Object} options options or a selector for element.
 */
function View(options) {
  if (typeof(options) === 'undefined') {
    options = {};
  }

  if (typeof(options) === 'string') {
    this.selectors = { element: options };
  } else {
    var key;

    if (typeof(options) === 'undefined') {
      options = {};
    }

    for (key in options) {
      if (options.hasOwnProperty(key)) {
        this[key] = options[key];
      }
    }
  }

  this.hideErrors = this.hideErrors.bind(this);
}
module.exports = View;

View.ACTIVE = 'active';

View.prototype = {
  seen: false,
  activeClass: View.ACTIVE,
  errorVisible: false,

  get element() {
    return this._findElement('element');
  },

  get status() {
    return this._findElement('status');
  },

  get errors() {
    return this._findElement('errors');
  },

  /**
   * Creates a string id for a given model.
   *
   *    view.idForModel('foo-', { _id: 1 }); // => foo-1
   *    view.idForModel('foo-', '2'); // => foo-2
   *
   * @param {String} prefix of string.
   * @param {Object|String|Numeric} objectOrString representation of model.
   */
  idForModel: function(prefix, objectOrString) {
    prefix += (typeof(objectOrString) === 'object') ?
      objectOrString._id :
      objectOrString;

    return prefix;
  },

  calendarId: function(input) {
    if (typeof(input) !== 'string') {
      input = input.calendarId;
    }

    input = this.cssClean(input);
    return 'calendar-id-' + input;
  },

  /**
   * Delegate pattern event listener.
   *
   * @param {HTMLElement} element parent element.
   * @param {String} type type of dom event.
   * @param {String} selector css selector element should match
   *                          _note_ there is no magic here this
   *                          is determined from the root of the document.
   * @param {Function|Object} handler event handler.
   *                                  first argument is the raw
   *                                  event second is the element
   *                                  matching the pattern.
   */
  delegate: function(element, type, selector, handler) {
    if (typeof(handler) === 'object') {
      var context = handler;
      handler = function() {
        context.handleEvent.apply(context, arguments);
      };
    }

    element.addEventListener(type, function(e) {
      var target = e.target;
      while (target !== element) {
        if ('mozMatchesSelector' in target &&
            target.mozMatchesSelector(selector)) {
          return handler(e, target);
        }
        target = target.parentNode;
      }
    });
  },

  /**
   * Clean a string for use with css.
   * Converts illegal chars to legal ones.
   */
  cssClean: function(string) {
    if (typeof(string) !== 'string') {
      return string;
    }

    //TODO: I am worried about the performance
    //of using this all over the place =/
    //consider sanitizing all keys to ensure
    //they don't blow up when used as a selector?
    return string.replace(INVALID_CSS, '-');
  },

  /**
   * Finds a caches a element defined
   * by selectors
   *
   * @param {String} selector name as defined in selectors.
   * @param {Boolean} all true when to find all elements. (default false).
   */
  _findElement: function(name, all, element) {
    if (typeof(all) === 'object') {
      element = all;
      all = false;
    }

    element = element || document;

    var cacheName;
    var selector;

    if (typeof(all) === 'undefined') {
      all = false;
    }

    if (name in this.selectors) {
      cacheName = '_' + name + 'Element';
      selector = this.selectors[name];

      if (!this[cacheName]) {
        if (all) {
          this[cacheName] = element.querySelectorAll(selector);
        } else {
          this[cacheName] = element.querySelector(selector);
        }
      }

      return this[cacheName];
    }

    return null;
  },

 /**
   * Displays a list of errors
   *
   * @param {Array} list error list
   *  (see Event.validaitonErrors) or Error object.
   */
  showErrors: function(list) {
    var _ = navigator.mozL10n.get;
    var errors = '';

    // We can pass Error objects or
    // Array of {name: foo} objects
    if (!Array.isArray(list)) {
        list = [list];
    }

    var i = 0;
    var len = list.length;

    for (; i < len; i++) {
      var name = list[i].l10nID || list[i].name;
      errors += _('error-' + name) || _(DEFAULT_ERROR_ID);
    }

    Toaster.showToast({
      message: errors
    });
  },

  hideErrors: function() {
    this.status.classList.remove(this.activeClass);
    this.status.removeEventListener('animationend', this.hideErrors);
    this.errorVisible = false;
  },

  stripItem: function(params,tarName) {
    for(var i in params) {
      if(params[i].name === tarName) {
        params.splice(i,1);
      }
    }
    return params;
  },

  onactive: function() {
    if (this.errorVisible) {
      this.hideErrors();
    }

    // seen can be set to anything other than false to override this behaviour
    if (this.seen === false) {
      this.onfirstseen();
    }

    // intentionally using 'in'
    if ('dispatch' in this) {
      this.dispatch.apply(this, arguments);
    }

    this.seen = true;
    if (this.element) {
      this.element.classList.add(this.activeClass);
    }
  },

  oninactive: function() {
    if (this.element) {
      this.element.classList.remove(this.activeClass);
    }
  },

  onfirstseen: function() {},

  showWarningDialog: function(isLocalCalendar, type, cb) {
    return new Promise((resolve, reject) => {
      if (navigator.mozWifiManager && navigator.mozWifiManager.connection &&
        navigator.mozWifiManager.connection.status === 'connected') {
        resolve(this.showWarningDialogPro(isLocalCalendar, type, false, cb));
      } else {
        this.app.getAllDataState().then((results) => {
          let connectFlag = false;
          for (let i = 0; i < results.length; i++) {
            if (results[i] === 'connected') {
              connectFlag = true;
              break;
            }
          }

          resolve(
            this.showWarningDialogPro(isLocalCalendar, type, !connectFlag, cb));
        });
      }
    });
  },

  showWarningDialogPro: function(isLocalCalendar, type, offline, cb) {
    let shouldShowWarningDialog = offline && !isLocalCalendar;

    if (shouldShowWarningDialog) {
      var textId = type === 'delete' ?
          'error-delete-online-event' : 'error-edit-online-event';
      var dialogConfig = {
        title: {id: 'error-confirmation-title', args: {}},
        body: {id: textId, args: {}},
        accept: {
          name: 'Ok',
          l10nId: 'ok',
          priority: 2,
          callback: function() {
            return cb && cb();
          }
        }
      }
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('confirm-dialog-container'));
    }
    return shouldShowWarningDialog;
  }
};

});

define('dom',['require','exports','module'],function(require, exports) {


exports.load = function(id, require, onLoad, config) {
  if (config.isBuild) {
    return onLoad();
  }

  var node = document.getElementById(id);
  if (!node) {
    onLoad.error('can\'t find element with id #' + id);
    return;
  }

  LazyLoader.load(node, function() {
    onLoad(node);
  });
};

});

define('views/errors',['require','exports','module','view','dom!errors'],function(require, exports, module) {


var View = require('view');

require('dom!errors');

function Errors() {
  View.apply(this, arguments);
  this.app.syncController.on('offline', this);
}
module.exports = Errors;

Errors.prototype = {
  __proto__: View.prototype,

  selectors: {
    status: '*[role="application"] > section[role="status"]',
    errors: '*[role="application"] > section > .errors'
  },

  handleEvent: function(event) {
    switch (event.type) {
      case 'offline':
        this.showErrors([{name: 'offline'}]);
        break;
    }
  }
};

});

define('views/month_day',['require','exports','module','calc','day_observer'],function(require, exports, module) {


var Calc = require('calc');
var dayObserver = require('day_observer');
var l10n = navigator.mozL10n;

// MonthDay represents a single day inside the Month view grid.
function MonthDay(options) {
  this.container = options.container;
  this.date = options.date;
  this.month = options.month;
  this._updateBusyCount = this._updateBusyCount.bind(this);
}
module.exports = MonthDay;

MonthDay.prototype = {

  container: null,
  date: null,
  element: null,
  month: null,

  create: function() {
    var dayId = Calc.getDayId(this.date);
    var id = 'month-view-day-' + dayId;
    var state = Calc.relativeState(this.date, this.month);
    var l10nStateId = state.replace(/\s/g, '-');
    var date = this.date.getDate();
    var week = this.date.getDay();

    if (l10nStateId === 'present') {
      l10nStateId = 'present-description';
    } else {
      l10nStateId = 'day-description';
    }

    var el = document.createElement('li');
    el.setAttribute('role', 'button');
    el.id = id;
    el.tabindex = 0;
    var describeInfo = navigator.mozL10n.get(l10nStateId, {
      weekday:navigator.mozL10n.get('weekday-' + week),
      date: date
    });
    el.dataset.date = dayId;
    el.className = state;
    el.classList.add('month-day');
    el.classList.add('focusable');
    el.innerHTML = `<span class="day" role="button">${date}</span>
      <div id="${id}-busy-indicator" aria-hidden="true" class="busy-indicator"></div>
      <span id="${id}-description" aria-hidden="true" class="day-describe"
        aria-label="${describeInfo}">
      </span>`;

    this.element = el;
    this._updateAriaLabel();
    this.container.appendChild(el);
  },

  _updateAriaLabel: function() {
    var day = this.element.querySelector('.day');
    var busyIndicator = this.element.querySelector('.busy-indicator');
    var dayDescribe = this.element.querySelector('.day-describe');
    var busyLabel = busyIndicator.getAttribute('aria-label');
    var dayDescribeLabel = dayDescribe.getAttribute('aria-label');
    var dayLabel = '';
    if (dayDescribeLabel) {
      dayLabel = dayDescribeLabel;
    }
    if (busyLabel) {
      dayLabel = dayLabel + ' ' + busyLabel;
    }
    day.setAttribute('aria-label', dayLabel);
  },

  activate: function() {
    dayObserver.on(this.date, this._updateBusyCount);
  },

  deactivate: function() {
    dayObserver.off(this.date, this._updateBusyCount);
  },

  destroy: function() {
    this.deactivate();
    this.container = this.element = null;
  },

  _updateBusyCount: function(data) {
    var count = Math.min(1, data.amount);
    var holder = this.element.querySelector('.busy-indicator');

    if (count >= 0) {
      holder.setAttribute('aria-label', navigator.mozL10n.get('busy', {
        n: count
      }));
      this._updateAriaLabel();
    } else {
      holder.removeAttribute('aria-label');
    }

    var diff = count - holder.childNodes.length;
    if (diff === 0) {
      return;
    }

    if (diff > 0) {
      var dot;
      var arr = data.allday.concat(data.basic);
      while (diff--) {
        dot = document.createElement('div');
        dot.className = 'gaia-icon icon-calendar-dot';
        holder.appendChild(dot);
      }
      return;
    }

    // difference < 0
    while (diff++) {
      holder.removeChild(holder.firstChild);
    }
  }
};

});

define('views/single_month',['require','exports','module','calc','./month_day','view'],function(require, exports, module) {


var Calc = require('calc');
var MonthDay = require('./month_day');
var View = require('view');
var daysBetween = Calc.daysBetween;
var daysInWeek = Calc.daysInWeek;
var getDayId = Calc.getDayId;
var spanOfMonth = Calc.spanOfMonth;

var SELECTED = 'selected';

// SingleMonth contains all the logic required to build the Month view grid and
// groups all the MonthDay instances for that given month.
function SingleMonth() {
  View.apply(this, arguments);
  this.days = [];
  this.timespan = spanOfMonth(this.date);
  this.timeController = this.app.timeController;
  this.weeklys = null;
  this.limit_row = 2;
}

module.exports = SingleMonth;

SingleMonth.prototype = {
  __proto__: View.prototype,

  active: false,
  container: null,
  date: null,
  days: null,
  element: null,

  create: function() {
    var element = document.createElement('section');
    element.className = 'month';
    element.setAttribute('role', 'grid');

    element.setAttribute('aria-readonly', true);
    element.innerHTML = this._renderDayHeaders();
    element.dataset.date = getDayId(this.date);
    this.element = element;
    this._buildWeeks();
  },

  _renderDayHeaders: function() {
    // startDay might change during the 'localized' event
    var startDay = Calc.startDay;
    var days = [];
    var i;
    for (i = startDay; i < 7; i++) {
      days.push(this._dayHeader(i));
    }

    if (startDay > 0) {
      for (i = 0; i < startDay; i++) {
        days.push(this._dayHeader(i));
      }
    }

    var html = `<header id="month-days" role="presentation">
      <ol role="row">${days.join('')}</ol>
    </header>`;
    return html;
  },

  _dayHeader: function(dayIndex) {
    return `<li data-l10n-id="weekday-${dayIndex}-single-char"
      role="columnheader" class="h4"></li>`;
  },

  _buildWeeks: function() {
    var weekLength = daysInWeek();
    var week;
    daysBetween(this.timespan).forEach((date, i) => {
      if (i % weekLength === 0) {
        week = document.createElement('ol');
        week.setAttribute('role', 'row');
        this.element.appendChild(week);
      }
      var day = new MonthDay({
        date: date,
        month: this.date,
        container: week
      });
      day.create();
      this.days.push(day);
    });
  },

  activate: function() {
    if (this.active) {
      return;
    }
    this.active = true;

    this.onactive();
    this.days.forEach(day => day.activate());
    this._onSelectedDayChange(this.timeController.selectedDay);
    this.timeController.on('selectedDayChange', this);
  },

  deactivate: function() {
    if (!this.active) {
      return;
    }
    this.active = false;

    this.oninactive();
    this.days.forEach(day => day.deactivate());
    this.timeController.off('selectedDayChange', this);
  },

  destroy: function() {
    this.deactivate();
    this._detach();
    this.days.forEach(day => day.destroy());
    this.days = [];
  },

  append: function() {
    this.container.appendChild(this.element);
  },

  _detach: function() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  },

  handleEvent: function(e) {
    if (e.type === 'selectedDayChange') {
      this._onSelectedDayChange(e.data[0]);
    }
  },

  _clearSelectedDay: function() {
    var day = this.element.querySelector(`li.${SELECTED}`);
    if (day) {
      day.classList.remove(SELECTED);
    }
  },
  _isPortraitMode: function(){
    return screen.orientation.type.startsWith('portrait');
  },

  _onSelectedDayChange: function(date) {
    this._clearSelectedDay();

    if (!date || !this.timespan.contains(date)) {
      return;
    }

    var el = this.element.querySelector(`li[data-date="${getDayId(date)}"]`);
    el.classList.add(SELECTED);

    if (!this._isPortraitMode() && window.location.pathname === '/switchto-date/' && !el.classList.contains('present')) {
      this._handlerExhibition(el);
    }
  },

    /** In mode landscape is visible only 3 weekly row's,
     * this method is responsible for handler exhibition of rows. */
    _handlerExhibition: function(dayActive) {
      if (!this.weeklys) {
        var nodes = document.querySelectorAll('#view-switchto-month .month.active ol');
        this.weeklys = Array.prototype.slice.call(nodes);
        this.weeklys.shift();
      }

      var currentRowIndex = this.weeklys.indexOf(dayActive.parentNode);
      if (currentRowIndex > this.limit_row) {
        this._toggleExhibitionRow(this.weeklys[currentRowIndex], true);

        for (let i = 0; i <= (currentRowIndex - 3); i++) {
          this._toggleExhibitionRow(this.weeklys[i], false);
        }
      } else {
        this._toggleExhibitionRow(this.weeklys[currentRowIndex], true);
        this._toggleExhibitionRow(this.weeklys[currentRowIndex + 3], false);
      }
    },
    _toggleExhibitionRow: function(element, active) {
      if (active) {
        element.classList.add('row-visible');
        element.classList.remove('row-hidden');
      } else {
        element.classList.add('row-hidden');
        element.classList.remove('row-visible');
      }
    }
};

});

/* exported InputParser */


/**
 * Stateless object for input parser functions..
 * The intent is the methods here will only relate to the parsing
 * of input[type="date|time"]
 */
var InputParser = (function() {

  var InputParser = {
    _dateParts: ['year', 'month', 'date'],
    _timeParts: ['hours', 'minutes', 'seconds'],

    /**
     * Import HTML5 input[type="time"] string value
     *
     * @param {String} value 23:20:50.52, 17:39:57.
     * @return {Object} { hours: 23, minutes: 20, seconds: 50 }.
     */
    importTime: function(value) {
      var result = {
        hours: 0,
        minutes: 0,
        seconds: 0
      };

      if (typeof(value) !== 'string') {
        return result;
      }

      var parts = value.split(':');
      var part;
      var partName;

      var i = 0;
      var len = InputParser._timeParts.length;

      for (; i < len; i++) {
        partName = InputParser._timeParts[i];
        part = parts[i];
        if (part) {
          result[partName] = parseInt(part.slice(0, 2), 10) || 0;
        }
      }

      return result;
    },

    /**
     * Export date to HTML5 input[type="time"]
     *
     * @param {Date} value export value.
     * @return {String} 17:39:57.
     */
    exportTime: function(value) {
      var hour = value.getHours();
      var minute = value.getMinutes();
      var second = value.getSeconds();

      var result = '';

      result += InputParser.padNumber(hour) + ':';
      result += InputParser.padNumber(minute) + ':';
      result += InputParser.padNumber(second);

      return result;
    },

    /**
     * Import HTML5 input[type="time"] to object.
     *
     * @param {String} value 1997-12-19.
     * @return {Object} { year: 1997, month: 12, date: 19 }.
     */
    importDate: function(value) {
      var result = {
        year: 0,
        month: 0,
        date: 0
      };

      var parts = value.split('-');
      var part;
      var partName;

      var i = 0;
      var len = InputParser._dateParts.length;

      for (; i < len; i++) {
        partName = InputParser._dateParts[i];
        part = parts[i];
        if (part) {
          result[partName] = parseInt(part, 10);
        }
      }

      if (result.month > 0) {
        result.month = result.month - 1;
      }

      result.date = result.date || 1;

      return result;
    },

    /**
     * Export js date to HTML5 input[type="date"]
     *
     * @param {Date} value export value.
     * @return {String} date string (1997-12-19).
     */
    exportDate: function(value) {
      var year = value.getFullYear();
      var month = value.getMonth() + 1;
      var date = value.getDate();

      var result = '';

      result += InputParser.padNumber(year) + '-';
      result += InputParser.padNumber(month) + '-';
      result += InputParser.padNumber(date);

      return result;
    },

    /**
     * Designed to take a date & time value from
     * html5 input types and returns a JS Date.
     *
     * @param {String} date input date.
     * @param {String} time input time.
     *
     * @return {Date} full date object from date/time.
     */
    formatInputDate: function(date, time) {
      time = InputParser.importTime(time);
      date = InputParser.importDate(date);

      return new Date(
        date.year,
        date.month,
        date.date,
        time.hours,
        time.minutes,
        time.seconds
      );
    },

    /**
     * @param {Numeric} numeric value.
     * @return {String} Pad the numeric with a leading zero if < 10.
     */
    padNumber: function(numeric) {
      var value = String(numeric);
      if (numeric < 10) {
        return '0' + value;
      }

      return value;
    }
  };

  return InputParser;
}());

define("shared/input_parser", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.InputParser;
    };
}(this)));

define('views/month',['require','exports','module','calc','./single_month','view','router','day_observer','shared/input_parser','provider/local','next_tick'],function(require, exports, module) {


var Calc = require('calc');
var SingleMonth = require('./single_month');
var View = require('view');
var dateFromId = Calc.dateFromId;
var monthStart = Calc.monthStart;
var router = require('router');
var dayObserver = require('day_observer');
var InputParser = require('shared/input_parser');
var Local = require('provider/local');
var nextTick = require('next_tick');

// minimum difference between X and Y axis to be considered an horizontal swipe
var XSWIPE_OFFSET = window.innerWidth / 10;
var dateItemMonth = document.querySelector('.select-value .date-hidden-input');
var valueItemMonth = document.querySelector('.select-value .calendarId-select');

var skAddEvent = {
  name: 'Add Event',
  l10nId: 'add-event',
  priority: 1,
  method: function() {
    router.go('/event/add/');
  }
};

var skWeeklyView = {
  name: 'Week View',
  l10nId: 'week-view',
  priority: 5,
  method: function () {
    console.log('Weekly View');
    window.history.backfrom = 'month-view';
    router.go('/week/');
  }
};

var skDayView = {
  name: 'Day View',
  l10nId: 'day-view',
  priority: 5,
  method: function () {
    console.log('Day View');
    router.go('/day/');
  }
};

var skCurrentDate = {
  name: 'Today',
  l10nId: 'today',
  priority: 5,
  method: function () {
    console.log('Current Date');
    var date = new Date();
    var controller = self.app.timeController;
    dateItemMonth.value = InputParser.exportDate(date);
    self.controller.move(date);
    self.controller.selectedDay = date;
    var evt = new CustomEvent('tcl-date-changed', {
      detail: {
        toDate: date
      },
      bubbles: true,
      cancelable: false
    });

    document.dispatchEvent(evt);
  }
};

var skGoToDate = {
  name: 'Go to Date',
  l10nId: 'go',
  priority: 5,
  method: function () {
    console.log('Go To Date');
    valueItemMonth.dataset.valueFlag = 1;
    dateItemMonth.value = InputParser.exportDate(self.controller.selectedDay);
    dateItemMonth.focus();
  }
};

var skSearch = {
  name: 'Search',
  l10nId: 'search',
  priority: 5,
  method: function () {
    console.log('Search');
    router.go('/search/');
  }
};

var skCalendarsToDisplay = {
  name: 'Calendars to Display',
  l10nId: 'calendar-to-display',
  priority: 5,
  method: function () {
    console.log('Calendars to Display');
    valueItemMonth.dataset.valueFlag = 2;
    valueItemMonth.focus();
  }
};

var skSync = {
  name: 'Sync calendar',
  l10nId: 'sync-calendar',
  priority: 5,
  method: function () {
    self.app.syncController.all();
  }
};

var skSettings = {
  name: 'Settings',
  l10nId: 'settings',
  priority: 5,
  method: function () {
    console.log('Settings');
    router.go('/advanced-settings/');
  }
};

var skDefaultCSK = {
  name: 'select',
  l10nId: 'select',
  priority: 2,
  method: function() {}
};
//Task 5317587 Add by ting-wang@t2mobile.com 20170911 begin
var skLunar = {
  name: 'Lunar Calendar',
  l10nId: 'lunar-calendar',
  priority: 5,
  method: function () {
    router.go('/lunar-day/');
  }
};

var monthUiAddEventWithOptionActions = [
    skAddEvent, skDefaultCSK, skWeeklyView, skDayView,
    skCurrentDate, skGoToDate, skSearch,
    skCalendarsToDisplay, skSync, skSettings];

var monthUiAddEventWithOptionActionsNoSync = [
    skAddEvent, skDefaultCSK, skWeeklyView, skDayView,
    skCurrentDate, skGoToDate, skSearch,
    skCalendarsToDisplay, skSettings];

var monthUiAddEventWithOptionActionsLowMem = [
    skAddEvent, skDefaultCSK, skWeeklyView, skDayView,
    skCurrentDate, skGoToDate, skSearch, skSettings];

function Month() {
  View.apply(this, arguments);
  this.frames = new Map();
}
module.exports = Month;

Month.prototype = {
  __proto__: View.prototype,

  SCALE: 'month',

  // boolean to control the inversed keydown
  isRtl: false,

  selectors: {
    element: '#month-view',
    selectedDay:'.month.active ol li.focus',
    accountList: '#advanced-settings-view .account-list',
    currentTime: '#time-views #launch-view'
  },

  date: null,

  /** @type {SingleMonth} */
  currentFrame: null,

  /** @type {DOMElement} used to detect if dbltap happened on same date */
  _lastTarget: null,

  self:null,

  /**
   * store current, previous and next months
   * we load them beforehand and keep on the cache to speed up swipes
   * @type {Array<SingleMonth>}
   */
  frames: null,
  records: null,
  actionIfy:"",
  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    self = this;
    this._findElement('currentTime').classList.remove('active');
    if (router.last && /^\/(week|day|switchto-date)/.test(router.last.path)) {
      var controller = self.app.timeController;
      window.history.state.monthselectedDay = controller.selectedDay;
      controller.moveToMostRecentDay();
    } else {
      delete window.history.state.monthselectedDay;
    }
    this.app.timeController.scale = this.SCALE;
    if (this.currentFrame) {
      this.currentFrame.activate();
    }
    self.actionIfy="";

    if (!dateItemMonth.dataset.inputEventMonth){
      SettingsListener.observe('selectOptionPopup.state', 0,
        this._updateMonthDate.bind(this));
      if (!this.app.lowMemory) {
        var calendars = this.app.store('Calendar');
        var calendarId = document.querySelector('select[name="calendarId"]');
        this._calendarIdFirstSeen();
        calendars.on('add', this._addCalendarId.bind(this));
        calendars.on('preRemove', this._removeCalendarId.bind(this));
        calendars.on('remove', this._removeCalendarId.bind(this));
        calendars.on('update', this._updateCalendarId.bind(this));
      }
      dateItemMonth.dataset.inputEventMonth = true;
    }

    // Defect216-ting-wang@t2mobile.com-Chinese Calendar requirement just use in China-begin
    if (this.app.isShowLunday && !monthUiAddEventWithOptionActions.includes(skLunar)){
        monthUiAddEventWithOptionActions.push(skLunar);
        monthUiAddEventWithOptionActionsNoSync.push(skLunar);
        monthUiAddEventWithOptionActionsLowMem.push(skLunar);
    }
    this.updateSKs(monthUiAddEventWithOptionActions);
    // Defect216-ting-wang@t2mobile.com-Chinese Calendar requirement just use in China-end
    window.addEventListener('keydown', this._keyDownEvent, false);
    window.addEventListener('index-changed', this);
    window.addEventListener('moztimechange', this._changeMonthDate);
    window.addEventListener('localized', this);
  },

  _initEvents: function() {
    this.controller = this.app.timeController;
    this.controller.on('monthChange', this);
  },

  _changeMonthDate: function() {
    var date = new Date();
    var controller = self.app.timeController;
    dateItemMonth.value = InputParser.exportDate(date);
    self.controller.move(date);
    self.controller.selectedDay = date;
    self.app._setPresentDate();
    var evt = new CustomEvent('tcl-date-changed', {
      detail: {
        toDate: date
      },
      bubbles: true,
      cancelable: false
    });

    document.dispatchEvent(evt);
  },

  _calendarIDChange: function(e) {
    var items =
      document.querySelectorAll(".select-value .calendarId-select option");
    for(var i = 0; i < items.length; i++) {
      this._saveCalendarDisplay(items[i].value, !!items[i].selected);
    }
  },

  _saveCalendarDisplay: function(id, displayed) {
    var store = this.app.store('Calendar');
    var settingStore = this.app.store('Setting');
    var self = this;

    function persist(err, id, model) {
      if (err) {
        return console.error('Cannot save calendar', err);
      }

      if (self.ondisplaypersist) {
        self.ondisplaypersist(model);
      }
    }

    function fetch(err, calendar) {
      if (err) {
        return console.error('Cannot fetch calendar', id);
      }

      calendar.localDisplayed = displayed;
      store.persist(calendar, persist);
    }

    settingStore.set(id + 'calendarID', displayed);
    store.get(id, fetch);
  },

  _updateMonthDate: function(value) {
    if (window.location.pathname === '/month/' &&
      valueItemMonth.dataset.valueFlag === '1' && value === 0) {
        valueItemMonth.dataset.valueFlag = null;
        NavigationMap.menuUpdate();

        if (!dateItemMonth.value) {
          return;
        }

        var selected = InputParser.importDate(dateItemMonth.value);
        var date = new Date(selected.year, selected.month, selected.date);
        var self = this;

        self.controller.move(date);
        self.controller.selectedDay = date;

        var evt = new CustomEvent('tcl-date-changed', {
          detail: {
            toDate: date
          },
          bubbles: true,
          cancelable: false
        });
        document.dispatchEvent(evt);
    } else if (valueItemMonth.dataset.valueFlag === '2' && value === 0){
        valueItemMonth.dataset.valueFlag = null;
        NavigationMap.menuUpdate();
        this._calendarIDChange();
    }
  },

  _calendarIdFirstSeen: function() {
    // we need to notify users (specially automation tests) somehow that the
    // options are still being loaded from DB, this is very important to
    // avoid race conditions (eg.  trying to set calendar before list is
    // built) notice that we also add the class to the markup because on some
    // really rare occasions "onfirstseen" is called after the EventBase
    // removed the "loading" class from the root element (seen it happen less
    // than 1% of the time)
    var element = document.querySelector('.select-value .calendarId-select');
    element.classList.add('loading');

    var calendarStore = this.app.store('Calendar');
    calendarStore.all(function(err, calendars) {
      if (err) {
        return console.error('Could not build list of calendars');
      }

      var pending = 0;
      var self = this;

      function next() {
        if (!--pending) {
          element.classList.remove('loading');

          if (self.onafteronfirstseen) {
            self.onafteronfirstseen();
          }
        }
      }

      for (var id in calendars) {
        pending++;
        this._addCalendarId(id, calendars[id], next, true);
      }

      var settingStore = this.app.store('Setting');
      settingStore.getValue('calendarFirstEnter', (err, value) => {
        if (!value) {
          settingStore.set('calendarFirstEnter', true);
          setTimeout(() => {
            var items =
              document.querySelectorAll('.select-value .calendarId-select option');
            for (var i = 0; i < items.length; i++) {
              if (items[0].value === 'local-first') {
                items[i].selected = true;
                this._saveCalendarDisplay(items[i].value, !!items[i].selected);
              }
            }
          }, 500);
        }
      })
    }.bind(this));
  },

  /**
   * Updates a calendar id option.
   *
   * @param {String} id calendar id.
   * @param {Calendar.Model.Calendar} calendar model.
   */
  _updateCalendarId: function(id, calendar) {
    var element = document.querySelector('.select-value .calendarId-select');
    var option = element.querySelector('[value="' + id + '"]');
    var store = this.app.store('Calendar');

    store.providerFor(calendar, function(err, provider) {
      var caps = provider.calendarCapabilities(
        calendar
      );

      if (!caps.canCreateEvent) {
        this._removeCalendarId(id);
        return;
      }

      if (option && id !== Local.calendarId) {
        option.text = calendar.remote.name;
      }


      if (this.oncalendarupdate) {
        this.oncalendarupdate(calendar);
      }
    }.bind(this));
  },

  /**
   * Add a single calendar id.
   *
   * @param {String} id calendar id.
   * @param {Calendar.Model.Calendar} calendar calendar to add.
   */
  _addCalendarId: function(id, calendar, callback, firstFlag) {
    var store = this.app.store('Calendar');
    store.providerFor(calendar, function(err, provider) {
      var caps = provider.calendarCapabilities(
        calendar
      );

      if (!caps.canCreateEvent) {
        if (callback) {
          nextTick(callback);
        }
        return;
      }

      var items =
        document.querySelectorAll(".select-value .calendarId-select option");
      for(var i = 0; i < items.length; i++) {
        if (id === items[i].value ||
          items[i].textContent === calendar.remote.name) {
          return;
        }
      }

      var option;
      var element = document.querySelector('.select-value .calendarId-select');

      option = document.createElement('option');

      if (id === Local.calendarId) {
        option.text = navigator.mozL10n.get('calendar-local');
        option.setAttribute('data-l10n-id', 'calendar-local');
      } else {
        option.text = calendar.remote.name;
      }

      option.value = id;

      if (id === Local.calendarId && element.children.length > 0) {
        element.insertBefore(option, element.children[0]);
      } else {
        element.add(option);
      }

      let settingStore = this.app.store('Setting');
      if (!firstFlag) {
        this.app.calendarIdNum++;
        option.selected = true;
        settingStore.set(id + 'calendarID', true);
      } else {
        settingStore.getValue(id + 'calendarID', (err, value) => {
          option.selected = value;
          this._saveCalendarDisplay(id, !!value);
        })
      }
      if (callback) {
        nextTick(callback);
      }

      if (this.onaddcalendar) {
        this.onaddcalendar(calendar);
      }
    }.bind(this));
  },

  /**
   * Remove a single calendar id.
   *
   * @param {String} id to remove.
   */
  _removeCalendarId: function(id) {
    var element = document.querySelector('.select-value .calendarId-select');

    var option = element.querySelector('[value="' + id + '"]');
    if (option) {
      element.removeChild(option);
      this.app.calendarIdNum--;
    }

    if (this.onremovecalendar) {
      this.onremovecalendar(id);
    }
  },

  _postMonthChanged: function(dalta) {
    var item = NavigationMap.getCurItem();
    var current_date = dateFromId(item.dataset.date);
    var next_date  = self._get_day(current_date, dalta);

    self.controller.move(next_date);
    var evt = new CustomEvent('tcl-date-changed', {
      detail: {
        toDate: next_date
      },
      bubbles: true,
      cancelable: false
    });

    document.dispatchEvent(evt);
  },

  _get_day:function(date , count){
      var yesterday_all_milliseconds = date.getTime() - count * 1000 * 60 * 60 * 24;
      var today=new Date();
      today.setTime(yesterday_all_milliseconds);
      var temp_hour = today.getHours();
      var temp_date = today.getDate();
      if(temp_hour >= 12)
      {
        today.setDate(temp_date+1);
        today.setHours(0);
      }
      return today;
  },

  _keyDownEvent: function(e) {
    this.isRtl = document.documentElement.dir === 'rtl';
    var leftRightKeys = this.isRtl ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
    if(!!self.app.skPanel && !self.app.skPanel.menuVisible) {
      switch(e.key) {
        case 'Enter':
        case 'Accept':
          self.records = dayObserver.getDayEvents(self.controller.selectedDay);

          if (self.records.amount === 0) {
            //the CSK needn't to show and nothing to do
          } else if (self.records.amount === 1) {
            if (self.records.allday.length === 1) {
              router.show('/event/show/' + self.records.allday[0].busytime._id);
            } else {
              router.show('/event/show/' + self.records.basic[0].busytime._id);
            }
          } else {
            var param = {date: self.controller.selectedDay};
            router.go('/show-multi-events/', param);
          }
          break;
        case 'Backspace':
        case 'BrowserBack':
          // Do nothing;
          break;
        case leftRightKeys[0]:
          if (e.target.style.getPropertyValue('--pre-month-1')) {
            self._postMonthChanged(1);
          }
          break;
        case leftRightKeys[1]:
          if (e.target.style.getPropertyValue('--next-month-1')) {
            self._postMonthChanged(-1);
          }
          break;
        case 'ArrowDown':
          if (e.target.style.getPropertyValue('--next-month-7')) {
            self._postMonthChanged(-7);
          }
          break;
        case 'ArrowUp':
          if (e.target.style.getPropertyValue('--pre-month-7')) {
            self._postMonthChanged(7);
          }
          break;
      }
    }
  },
  updateSKs:function(actions){
    self.app.createSks(actions);
  },

  handleEvent: function(e, target) {
    switch (e.type) {
      case 'monthChange':
        this.changeDate(e.data[0]);
        break;
      case 'localized':
        this.reconstruct();
        break;
      case 'index-changed':
        var item = e.detail.focusedItem;
        var currentDate = dateFromId(item.dataset.date);

        if(item.classList.contains('other-month')) {
          self.controller.move(currentDate);
          var evt = new CustomEvent('tcl-date-changed', {
            detail: {
              toDate: currentDate
            },
            bubbles: true,
            cancelable: false
          });

          document.dispatchEvent(evt);
        }

        if (this.app.selectedDayUTC) {
          dayObserver.off(this.app.selectedDayUTC,
            this._saveRecordsData.bind(this));
        }

        this.app.selectedDayUTC = currentDate;
        self.controller.selectedDay = currentDate;
        dayObserver.on(self.controller.selectedDay, this._saveRecordsData.bind(this));
        this._createSks();
        break;

    }
    this._lastTarget = target;
  },

  _goToAddEvent: function(date) {
    // slight delay to avoid tapping the elements inside the add event screen
    setTimeout(() => {
      // don't need to set the date since the first tap triggers a click that
      // sets the  timeController.selectedDay
      router.go('/event/add/');
    }, 50);
  },

  changeDate: function(time) {
    this.date = monthStart(time);

    if (this.currentFrame) {
      this.currentFrame.deactivate();
    }

    this.currentFrame = this._getFrame(this.date);

    this._trimFrames();
    this._appendFrames();

    this.currentFrame.activate();
  },

  _getFrame: function(date) {
    var id = date.getTime();
    var frame = this.frames.get(id);
    if (!frame) {
      frame = new SingleMonth({
        app: this.app,
        date: date,
        container: this.element
      });
      frame.create();
      this.frames.set(id, frame);
    }
    return frame;
  },

  _trimFrames: function() {
    if (this.frames.size <= 3) {
      return;
    }

    // full month (we always keep previous/next months)
    var delta = 31 * 24 * 60 * 60 * 1000;

    this.frames.forEach((frame, ts) => {
      var base = Number(this.date);
      if (Math.abs(base - ts) > delta) {
        frame.destroy();
        this.frames.delete(ts);
      }
    });
  },

  _appendFrames: function() {
    // sort elements by timestamp (key = timestamp) so DOM makes more sense
    Array.from(this.frames.keys())
    .sort((a, b) => a - b)
    .forEach(key => this.frames.get(key).append());
  },

  oninactive: function() {
    View.prototype.oninactive.call(this);
    if (this.currentFrame) {
      this.currentFrame.deactivate();
    }
    window.removeEventListener('keydown', this._keyDownEvent, false);
    window.removeEventListener('index-changed', this);
    window.removeEventListener('moztimechange', this._changeMonthDate);
    window.removeEventListener('localized', this);

    self.actionIfy="";
  },

   _createSks: function() {
    var actions;

    if (self.app.lowMemory) {
      actions = [].concat(monthUiAddEventWithOptionActionsLowMem);
    } else {
      if (self.app.calendarIdNum > 1) {
        actions = [].concat(monthUiAddEventWithOptionActions);
      } else {
        actions = [].concat(monthUiAddEventWithOptionActionsNoSync);
      }
    }

    var selectedDay = document.querySelector(self.selectors.selectedDay);
    var isToday = false;
    if (!selectedDay && typeof(selectedDay) !== 'undefined') {
      isToday = true;
    } else {
      isToday = Calc.isToday(dateFromId(selectedDay.dataset.date));
    }

    if (isToday) {
      actions = self.stripItem(actions, 'Today');
    }
    if (self.records.amount === 0) {
      actions = self.stripItem(actions, 'select');
    }

    if (JSON.stringify(actions) !== self.actionIfy) {
      this.updateSKs(actions);
      self.actionIfy = JSON.stringify(actions);
    }
  },

  onfirstseen: function() {
    this.app.view('TimeHeader', (header) => header.render());
    this._initEvents();
    this.changeDate(this.controller.month);
  },

  destroy: function() {
    this.frames.forEach((frame, key) => {
      this.frames.delete(key);
      frame.destroy();
    });
  },

  reconstruct: function() {
    // Watch for changed value from transition of a locale to another
    this.destroy();
    this.changeDate(this.controller.month);
    NavigationMap.reset('month-view');
  },

  _saveRecordsData: function(records) {
    self.records = records;
    self._createSks && self._createSks();
  }

};

});

define('template',['require','exports','module'],function(require, exports, module) {


var POSSIBLE_HTML = /[&<>"'`]/;

var span = document.createElement('span');

function create(templates) {
  var key, result = {};

  for (key in templates) {
    if (templates.hasOwnProperty(key)) {
      result[key] = new Template(templates[key]);
    }
  }

  return result;
}

function Template(fn) {
  this.template = fn;
}
module.exports = Template;

Template.prototype = {
  arg: function(key) {
    if (typeof(this.data) === 'undefined') {
      return '';
    } else if (typeof(this.data) !== 'object') {
      return this.data;
    }

    return this.data[key];
  },

  h: function(a) {
    var arg = this.arg(a);
    // accept anything that can be converted into a string and we make sure
    // the only falsy values that are converted into empty strings are
    // null/undefined to avoid mistakes
    arg = arg == null ? '' : String(arg);

    //only escape bad looking stuff saves
    //a ton of time
    if (POSSIBLE_HTML.test(arg)) {
      span.textContent = arg;
      return span.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    } else {
      return arg;
    }
  },

  s: function(a) {
    var arg = this.arg(a);
    return String((arg || ''));
  },

  bool: function(key, onTrue) {
    if (this.data[key]) {
      return onTrue;
    } else {
      return '';
    }
  },

  l10n: function(key, prefix) {
    var value = this.arg(key);

    if (prefix) {
      value = prefix + value;
    }
    return navigator.mozL10n.get(value);
  },

  l10nId: function(a) {
    return this.s(a).replace(/\s/g, '-');
  },

  /**
   * Renders template with given slots.
   *
   * @param {Object} object key, value pairs for template.
   */
  render: function(data) {
    this.data = data;
    return this.template();
  },

  /**
   * Renders template multiple times
   *
   * @param {Array} objects object details to render.
   * @param {String} [join] optional join argument will join the array.
   * @return {String|Array} String if join argument is given array otherwise.
   */
  renderEach: function(objects, join) {
    var i = 0, len = objects.length,
        result = [];

    for (; i < len; i++) {
      result.push(this.render(objects[i]));
    }

    if (typeof(join) !== 'undefined') {
      return result.join(join);
    }

    return result;
  }
};

Template.create = create;

});

define('templates/date_span',['require','exports','module','calc','template','date_format'],function(require, exports, module) {


var Calc = require('calc');
var create = require('template').create;
var dateFormat = require('date_format');

var l10n = navigator.mozL10n;

module.exports = create({
  time: function() {
    var time = this.arg('time');
    var format = Calc.getTimeL10nLabel(this.h('format'));
    var displayTime = dateFormat.localeFormat(time, l10n.get(format));

    return `<span class="p-pri" data-l10n-date-format="${format}"
                  data-date="${time}">${displayTime}</span>`;
  },

  hour: function() {
    var hour = this.h('hour');
    var format = Calc.getTimeL10nLabel(this.h('format'));
    var className = this.h('className');
    // 0ms since epoch as base date to avoid issues with daylight saving time
    var date = new Date();
    date.setHours(hour, 0, 0, 0);

    var displayDate = new Date();
    var h = hour === '23' ? hour : parseInt(hour)  + 1;
    displayDate.setHours(h, 0, 0, 0);

    var l10nLabel = l10n.get(format);

    if (navigator.mozHour12 && h === 12){
      displayDate.setHours(h + 1, 0, 0, 0);
      l10nLabel = '%p';
    }

    var displayHour = dateFormat.localeFormat(displayDate, l10nLabel);
    // remove leading zero
    if (navigator.mozHour12) {
      displayHour = displayHour.replace(/^0/, '');
    }

    if (hour === '23') {
      var index = displayHour.indexOf('<');
      displayHour = index > 0 ? displayHour.substring(index) : '';
    }
    var l10nAttr = (hour === Calc.ALLDAY) ?
      'data-l10n-id="hour-allday"' :
      `data-l10n-date-format="${format}"`;
    return `<span class="${className}" data-date="${date}" ${l10nAttr}>
              ${displayHour}
            </span>`;
  }
});

});

define('templates/month_day_agenda',['require','exports','module','./date_span','template'],function(require, exports, module) {


var DateSpan = require('./date_span');
var create = require('template').create;

var MonthDayAgenda = create({
  event: function() {
    var busytimeId = this.h('busytimeId');
    var color = this.h('color');

    var eventTime;
    if (this.arg('isAllDay')) {
      eventTime = '<div class="all-day" data-l10n-id="hour-allday"></div>';
    } else {
      var startTime = formatTime(this.arg('startTime'));
      var endTime = formatTime(this.arg('endTime'));
      eventTime = `<div class="start-time">${startTime}</div>
        <div class="end-time">${endTime}</div>`;
    }

    var title = this.h('title');
    var eventDetails = `<h5 role="presentation">${title}</h5>`;
    var location = this.h('location');
    if (location && location.length > 0) {
      eventDetails += `<span class="details">
        <span class="location">${location}</span>
      </span>`;
    }

    var alarmClass = this.arg('hasAlarms') ? 'has-alarms' : '';

    return `<a href="/event/show/${busytimeId}/" class="event ${alarmClass}"
      role="option" aria-describedby="${busytimeId}-icon-calendar-alarm">
      <div class="container">
      <div class="gaia-icon icon-calendar-dot" style="color:${color}"
          aria-hidden="true"></div>
        <div class="event-time">${eventTime}</div>
        <div class="event-details" dir="auto">${eventDetails}</div>
        <div id="${busytimeId}-icon-calendar-alarm" aria-hidden="true"
          class="gaia-icon icon-calendar-alarm" style="color:${color}"
          data-l10n-id="icon-calendar-alarm"></div>
      </div>
      </a>`;
  },

  eventDescription: function() {
    var description = this.h('eventDescription');
    var amount = parseInt(this.h('amount'));

    if (_isPortraitMode()) {
      return `<div class="event-details" dir="auto"><h5 role="presentation" class="p-pri" data-l10n-id="busy" data-l10n-args={"n":${amount}}></h5></div>`;
    }

    return getDescriptionModeLandscape(description, amount);
  }
});

module.exports = MonthDayAgenda;

function formatTime(time) {
  return DateSpan.time.render({
    time: time,
    format: 'shortTimeFormat'
  });
}


function _isPortraitMode() {
  return screen.orientation.type.startsWith('portrait');
}

function getDescriptionModeLandscape(label, amount) {
  var _separator = " ";
  var partials = label.split(_separator);
  partials[1] = partials[1].toLocaleLowerCase();
  var busy = partials.join(_separator);
  var busyEvent = '';

  if (parseInt(partials[0])) {
    busy = partials[0];
    busyEvent = partials[1];
  }

  return `<div class="event-details" dir="auto"><h5 role="presentation" class="p-pri busy ${busyEvent ? 'events' : ''}">${busy}</h5><span class="busy_event" data-l10n-id="busy" data-l10n-args={"n":${amount}}></span></div>`;

}

});

define('views/month_day_agenda',['require','exports','module','view','calc','date_format','day_observer','calc','templates/month_day_agenda'],function(require, exports, module) {


var Parent = require('view');
var createDay = require('calc').createDay;
var dateFormat = require('date_format');
var dayObserver = require('day_observer');
var isAllDay = require('calc').isAllDay;
var template = require('templates/month_day_agenda');

function MonthDayAgenda() {
  Parent.apply(this, arguments);
  this._render = this._render.bind(this);
  this.controller = this.app.timeController;
}
module.exports = MonthDayAgenda;

MonthDayAgenda.prototype = {
  __proto__: Parent.prototype,

  date: null,

  selectors: {
    element: '#month-day-agenda',
    events: '.day-events',
    currentDate: '#event-list-date'
  },

  get element() {
    return this._findElement('element');
  },

  get events() {
    return this._findElement('events');
  },

  get currentDate() {
    return this._findElement('currentDate');
  },

  onactive: function() {
    Parent.prototype.onactive.call(this);
    this.controller.on('selectedDayChange', this);
    this.changeDate(this.controller.selectedDay);
  },

  oninactive: function() {
    Parent.prototype.oninactive.call(this);
    if (this.date) {
      dayObserver.off(this.date, this._render);
    }
    this.controller.removeEventListener('selectedDayChange', this);
    this.date = null;
  },

  _isPortraitMode: function(){
    return screen.orientation.type.startsWith('portrait');
  },  
  changeDate: function(date) {
    // first time view is active the `selectedDay` is null
    date = date || createDay(new Date());

    if (this.date) {
      dayObserver.off(this.date, this._render);
    }
    this.date = date;
    dayObserver.on(this.date, this._render);

    var formatId = this._isPortraitMode() ? 'months-day-view-header-format' : 'months-day-view-header-format-small';
    this.currentDate.innerHTML = dateFormat.localeFormat(
      date,
      navigator.mozL10n.get(formatId)
    );
    // we need to set the [data-date] and [data-l10n-date-format] because
    // locale might change while the app is still open
    this.currentDate.dataset.date = date;
    this.currentDate.dataset.l10nDateFormat = formatId;
  },

  _render: function(records) {
    // we should always render allday events at the top
    var description = null;
    if (records.amount === 0) {
      description = navigator.mozL10n.get('no-events');
    } else if(records.amount === 1) {
      description = records.amount + " " + navigator.mozL10n.get('kai-single-event');
    } else if(records.amount > 1) {
      description = records.amount + " " + navigator.mozL10n.get('kai-event-count');
    }
    this.events.innerHTML = template.eventDescription.render({
      eventDescription: description,
      amount: records.amount
    });
      
    this.element.classList.toggle('no-event', records.amount === 0);

  },

  _renderEvent: function(record) {
    var {event, busytime, color} = record;
    var {startDate, endDate} = busytime;

    return template.event.render({
      hasAlarms: !!(event.remote.alarms && event.remote.alarms.length),
      busytimeId: busytime._id,
      color: color,
      title: event.remote.title,
      location: event.remote.location,
      startTime: startDate,
      endTime: endDate,
      isAllDay: isAllDay(this.date, startDate, endDate)
    });
  },

  handleEvent: function(e) {
    switch (e.type) {
      case 'selectedDayChange':
        this.changeDate(e.data[0]);
        break;
    }
  }
};

});

define('views/time_header',['require','exports','module','view','date_format','router','calc'],function(require, exports, module) {


var View = require('view');
var dateFormat = require('date_format');
var router = require('router');
var Calc = require('calc');

var SETTINGS = /settings/;

function TimeHeader() {
  View.apply(this, arguments);
  this.controller = this.app.timeController;
  this.controller.on('scaleChange', this);

  this.element.addEventListener('action', (e) => {
    e.stopPropagation();
    var path = window.location.pathname;
    if (SETTINGS.test(path)) {
      router.resetState();
    } else {
      router.show('/settings/');
    }
  });
}
module.exports = TimeHeader;

TimeHeader.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#time-header',
    title: '#time-header h1'
  },

  scales: {
    month: 'multi-month-view-header-format',
    day: 'day-view-header-format',
    // when week starts in one month and ends
    // in another, we need both of them
    // in the header
    multiMonth: 'multi-month-view-header-format'
  },

  handleEvent: function(e) {
    // Week view will update title by self.
    if (window.location.pathname == '/week/') {
      return;
    }
    // respond to all events here but
    // we add/remove listeners to reduce
    // calls
    switch (e.type) {
      case 'yearChange':
      case 'monthChange':
      case 'dayChange':
      case 'weekChange':
        this._updateTitle();
        break;
      case 'scaleChange':
        this._updateScale.apply(this, e.data);
        break;
    }
  },

  get title() {
    return this._findElement('title');
  },

  _scaleEvent: function(event) {
    switch (event) {
      case 'month':
        return 'monthChange';
      case 'year':
        return 'yearChange';
      case 'week':
        return 'weekChange';
    }

    return 'dayChange';
  },

  _updateScale: function(newScale, oldScale) {
    if (oldScale) {
      this.controller.removeEventListener(
        this._scaleEvent(oldScale),
        this
      );
    }

    this.controller.addEventListener(
      this._scaleEvent(newScale),
      this
    );

    this._updateTitle();
  },

  getScale: function(type) {
    var position = this.controller.position;
    if (type === 'week') {
      var l10nLabel = navigator.mozL10n.get('week-view-header-format', {
        value: Calc.getWeeksOfYear(position)
      });

      return dateFormat.localeFormat(position, l10nLabel);
    }
    return this._localeFormat(position, type || 'month');
  },

  _getLastWeekday: function(){
    // we display 5 days at a time, controller.position is always the day on
    // the left of the view
    var position = this.controller.position;
    return new Date(
      position.getFullYear(),
      position.getMonth(),
      position.getDate() + 6
    );
  },

  _localeFormat: function(date, scale) {
    return dateFormat.localeFormat(
      date,
      navigator.mozL10n.get(this.scales[scale])
    );
  },

  _updateTitle: function() {
    var con = this.app.timeController;
    var title = this.title;

    title.dataset.l10nDateFormat =
      this.scales[con.scale] || this.scales.month;

    title.dataset.date = con.position.toString();

    title.textContent = this.getScale(
      con.scale
    );
  },

  render: function() {
    this._updateScale(this.controller.scale);
  }
};

});

define("bundle", function(){});
