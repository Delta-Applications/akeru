var jsdom = require("jsdom");

module.exports = require("./lib/bleach.js"), module.exports.documentConstructor = jsdom.jsdom, 
module.exports._preCleanNodeHack = function(e, o) {
    "" === e.innerHTML && o.match(/<!--/) && (e.innerHTML = o + "-->");
};