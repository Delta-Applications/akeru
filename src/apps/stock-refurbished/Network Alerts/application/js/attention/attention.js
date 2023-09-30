'use strict'; (function (exports) {
    let Attentions = function () { this.DEBUG = true; this.name = 'Attention'; this.alertContent = document.getElementById('alert-content'); this.alertBody = document.getElementById('alert-body'); document.body.classList.toggle('large-text', navigator.largeTextEnabled); }; Attentions.prototype.debug = function (s) { if (this.DEBUG) { console.log(`-*- CMAS ${this.name} -*- ${s}`); } }; 
    Attentions.prototype.init = function () {
        const msg = this.parseMessage(); this.id = msg.id; this.msgDate = parseInt(msg.date); this.mainPage = true; let alertTitle = document.getElementById('alert-title'); let alertDate = document.getElementById('alert-date'); navigator.mozL10n.once(() => {
            SoftkeyHelper.init(); if (Utils.operatorName === 'IT') { SoftkeyHelper.setSoftKey('IT-attention-init'); } else { SoftkeyHelper.setSoftKey('attention-init'); }
            alertTitle.textContent = navigator.mozL10n.get(msg.title); alertDate.textContent = ViewUtils.getDate(this.msgDate); this.alertContent.textContent = msg.body; ViewUtils.linkingContent(this.alertContent); if (document.activeElement === document.body) { this.alertContent.focus(); }
        }); document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }; Attentions.prototype.handleKeyDown = function (e) {
        switch (e.key) {
            case 'BrowserBack': case 'Backspace': if (Utils.operatorName === 'IT') { if (Optionmenu.isActive()) { Optionmenu.hide(); SoftkeyHelper.setSoftKey('IT-main'); } else { evt.preventDefault(); } } else { if (Optionmenu.isActive()) { Optionmenu.hide(); SoftkeyHelper.setSoftKey('main'); } else { this.closeAttentionWindow(); } }
                break; case 'ArrowUp': case 'ArrowDown': ViewUtils.scrollBar(e.key, false); break; default: break;
        }
    }; Attentions.prototype.parseMessage = function (input) { const rParams = /([^?=&]+)(?:=([^&]*))?/g; input = input || window.location.href; let parsed = {}; input.replace(rParams, ($0, $1, $2) => { parsed[decodeURIComponent($1)] = $2 ? decodeURIComponent($2) : $2; }); return parsed; }; Attentions.prototype.closeAttentionWindow = function () { this.debug(`closeAttentionWindow timestamp -> ${this.msgDate}`); window.opener.postMessage({ type: 'closeAttentionWindow', timestamp: this.msgDate }, window.location.origin); }; exports.Attention = new Attentions();
})(window);