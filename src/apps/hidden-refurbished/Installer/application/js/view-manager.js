'use strict';
const ACTIVE_PAGE = {
    LOADING: 'loading',
    MAIN: 'main',
    HELP: 'help'
}
const ViewManager = {
    _currentActivePage: ACTIVE_PAGE.MAIN,
    init() {
        window.addEventListener('keydown', this.handleKeydown.bind(this));
        window.addEventListener('otp-ui-ready', this.handleUIReady.bind(this));
    },
    handleUIReady() {
        this._currentActivePage = ACTIVE_PAGE.MAIN;
    },
    handleKeydown(event) {
        const key = event.key;
        const themeColor = document.querySelector('meta[name=theme-color]');
        switch (key) {
            case 'Enter':
                if (this._currentActivePage === ACTIVE_PAGE.MAIN) {
                    Installer.pickActivity();
                }
                break;
            case 'SoftRight':
                if (this._currentActivePage === ACTIVE_PAGE.MAIN) {
                    this._currentActivePage = ACTIVE_PAGE.HELP;
                    themeColor.setAttribute('content', 'rgb(0,0,0)');
                    this.updateView(ACTIVE_PAGE.MAIN);
                }
                break;
            case 'Backspace':
            case 'SoftLeft':
                if (this._currentActivePage === ACTIVE_PAGE.HELP) {
                    event.preventDefault();
                    this._currentActivePage = ACTIVE_PAGE.MAIN;
                    themeColor.setAttribute('content', 'transparent');
                    this.updateView(ACTIVE_PAGE.HELP);
                }
                break;
            default:
                break;
        }
    },
    updateView(currentPage) {
        switch (currentPage) {
            case ACTIVE_PAGE.MAIN:
                this.togglePage(ACTIVE_PAGE.HELP);
                this.updateSoftKey({
                    left: 'back',
                    center: '',
                    right: ''
                });
                break;
            case ACTIVE_PAGE.HELP:
                this.togglePage(ACTIVE_PAGE.MAIN);
                this.updateSoftKey({
                    left: ' ',
                    center: 'pick',
                    right: 'info'
                });
                break;
            default:
                break;
        }
    },
    togglePage(targetPage) {
        const main = document.querySelector('#installer-main');
        const helpInfo = document.querySelector('#help-info');
        if (targetPage === ACTIVE_PAGE.MAIN) {
            main.style.display = "flex";
            helpInfo.style.display = "none";
        } else {
            main.style.display = "none";
            helpInfo.style.display = "flex";
        }
    },
    updateSoftKey(option = {
        left: '',
        center: '',
        right: ''
    }) {
        const {
            left,
            center,
            right
        } = option;
        document.querySelector('#softkey-left').textContent = left;
        document.querySelector('#softkey-center').textContent = center;
        document.querySelector('#softkey-right').textContent = right;
    }
};
ViewManager.init();