'use strict';
const Screen = {
    _currentVersion: '',
    init() {
        navigator.mozApps.getSelf().then(res => {
            this._currentVersion = res.manifest.version;
            navigator.mozL10n.ready(() => {
                this.generateContent();
            });
        });
    },
    generateContent() {
        this.prepareMainPage();
        this.prepareHelpPage();
    },
    prepareMainPage() {
        this.pageReady();
    },
    attachedText(target, content) {
        const textNode = document.createTextNode(content);
        target.appendChild(textNode);
    },
    prepareHelpPage() {
        const pairs = [
            ['#help-title', 'what-is-installer-title'],
            ['#help-desc', 'what-is-installer-desc'],
            ['#how-to-use-title', 'how-to-use-title'],
            ['#how-to-use-desc', 'how-to-use-desc']
        ];
        pairs.forEach(pair => {
            const targetNode = document.querySelector(pair[0]);
            this.appendHelpContent(targetNode, pair[1]);
        });
    },
    appendHelpContent(targetNode, localeKey) {
        const lget = navigator.mozL10n.get;
        const textNode = document.createTextNode(lget(localeKey));
        targetNode.appendChild(textNode);
    },
    pageReady() {
        document.querySelector('#content').classList.remove('hide');
        document.querySelector('#loading').classList.add('hide');
        const evt = new CustomEvent('otp-ui-ready', {
            bubbles: true,
            cancelable: false
        });
        window.dispatchEvent(evt);
    }
};
window.addEventListener('load', function screenLoaded() {
    window.removeEventListener('load', screenLoaded);
    Screen.init();
});