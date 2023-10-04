
const SETTINGS_OPTION_KEY = 'settings_option_key'; const MARQUEE_SPEED = 6 * 1000 / 90; const MARQUEE_INTERVAL = 0; var App = (function () {
    var app; var chromeInteractive = false; let bScanning = false; let overlay = document.getElementById('overlay'); let promisePick; addLargeText(); init(); initOverlay(); function init() {
        navigator.mozL10n.once(function onLocalizationInit() {
            window.performance.mark('navigationLoaded'); if (navigator.getFeature) { navigator.getFeature('hardware.memory').then((memOnDevice) => { app.bLowMemoryDevice = (memOnDevice === 256); }); }
            initDB(); ListView.init(); SubListView.init(); SearchView.init(); TabBar.init(); setStartMode(); if (document.URL.indexOf('#pick') === -1) { ListView.activate({ option: 'playlist' }); jioDongleStatusListener(); }
            navigator.mozL10n.ready(function () { ModeManager.updateTitle(); if (!chromeInteractive) { chromeInteractive = true; window.performance.mark('navigationInteractive'); } }); marquee(MARQUEE_SPEED, MARQUEE_INTERVAL); document.addEventListener('visibilitychange', () => {
                if (Dialog.isActive()) { Dialog.element.focus(); return; }
                if (window.closeResolve) { return window.closeResolve(); }
                if (!document.hidden) {
                    if (ModeManager.currentMode === MODE_PLAYER) {
                        let oldFocusElement = document.activeElement; if (oldFocusElement !== PlayerView.view) {
                            PlayerView.view.addEventListener('focus', checkFocus); PlayerView.view.focus(); function checkFocus() {
                                PlayerView.view.removeEventListener('focus', checkFocus); if (document.querySelectorAll(':focus').length > 1 && oldFocusElement.classList.contains('focusable')) {
                                    if (oldFocusElement.nodeName === 'INPUT') { oldFocusElement.parentNode.classList.remove('focused'); }
                                    let cloneNode = oldFocusElement.cloneNode(true); oldFocusElement.parentElement.replaceChild(cloneNode, oldFocusElement); oldFocusElement = null;
                                }
                            }
                        }
                    } else if (typeof PlayerView !== 'undefined' && PlayerView.playStatus === PLAYSTATUS_STOPPED && ModeManager.currentMode === MODE_LIST) { ListView.view.focus(); }
                    if (firstScanDone) { musicdb.active = true; musicdb.scan(); }
                    return;
                }
                if (document.hidden && typeof PlayerView !== 'undefined' && (PlayerView.playStatus === PLAYSTATUS_PLAYING || PlayerView.playStatus === PLAYSTATUS_PAUSED || PlayerView.playStatus === INTERRUPT_BEGIN)) {
                    OptionMenu.isActive() && OptionMenu.cancel(); Dialog.isActive() && Dialog.cancel(); if (dongleState.canPlayByDongle) { return; }
                    ModeManager._modeStack = [MODE_LIST, MODE_PLAYER]; ModeManager._updateMode(); ModeManager.clearState();
                }
            });
        }); navigator.mozAudioChannelManager.volumeControlChannel = 'content';
    }
    function addLargeText() { document.body.classList.toggle('large-text', navigator.largeTextEnabled); window.addEventListener('largetextenabledchanged', function () { document.body.classList.toggle('large-text', navigator.largeTextEnabled); }); }
    function setStartMode() {
        if (document.URL.indexOf('#pick') !== -1) {
            promisePick = new Promise(resolve => {
                navigator.mozSetMessageHandler('activity', function activityHandler(a) {
                    var activityName = a.source.name; if (activityName === 'pick') { a.source.data.selectMode === 'multiple' && jioDongleStatusListener(true); app.pendingPick = a; }
                    resolve();
                });
            }); TabBar.option = 'title'; ModeManager.start(MODE_PICKER);
        } else { TabBar.option = 'playlist'; ModeManager.start(MODE_LIST); asyncStorage.getItem(SETTINGS_OPTION_KEY, function (settings) { app.playerSettings = settings; }); }
    }
    function initOverlay() { overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !bScanning || e.key === 'Backspace') { if (!window.closeResolve) { new Promise(resolve => { window.closeResolve = resolve; }).then(() => { window.close(); }); } } else if (e.key !== 'MicrophoneToggle' && e.key !== 'VolumeDown' && e.key !== 'VolumeUp') { e.preventDefault(); e.stopPropagation(); } }); overlay.addEventListener('keyup', (e) => { if (e.key === 'Enter' && !bScanning) { if (window.closeResolve) { window.closeResolve = null; window.close(); } } }); }
    function showOverlay(id) {
        bScanning = id === 'scanning'; if (bScanning) { SoftKeyStore.register({ center: '' }, overlay); } else { SoftKeyStore.register({ center: 'ok' }, overlay); }
        document.activeElement.blur(); app.currentOverlay = id; function setVisibility(visible) { Array.forEach(document.body.children, function (elt) { if (elt.id === 'overlay') { elt.classList.toggle('hidden', !visible); visible && elt.focus(); } else if (elt.id === 'region-views') { elt.classList.toggle('hidden', visible); } else { elt.setAttribute('aria-hidden', visible); } }); }
        if (id === null) { setVisibility(false); return; }
        let l10nIds = { 'text': id + '-text' }; let textElement = document.getElementById('overlay-text'); textElement.dataset.l10nId = l10nIds.text; setVisibility(true);
    }
    function showCorrectOverlay(count) { if (typeof count === 'undefined' || count > 0) { app.showOverlay(null); } else if (reparsingMetadata) { app.showOverlay('upgrade'); } else { if (App.pendingPick) { app.showOverlay('pick-empty'); } else { app.showOverlay('empty'); } } }
    function showCurrentView(callback) {
        LazyLoader.load('js/metadata/album_art.js', function () {
            if (!!promisePick) { promisePick.then(() => { if (ModeManager.currentMode === MODE_PLAYER) { ModeManager.withRefresh = true; } else { ListView.resetUI(); callback && callback(); } }); } else if (ModeManager.currentMode === MODE_LIST) { ListView.resetUI(); callback && callback(); } else if (ModeManager.currentMode === MODE_SUBLIST) {
                if (window.localStorage.getItem('musicCount') === '0') { ModeManager.start(MODE_LIST); ListView.resetUI(); return; }
                ModeManager._modeStack.splice(-1, 1); if (SubListView.isInMyPlaylist) { if (promiseUpdate) { promiseUpdate.then(() => { SubListView.activateSubListView(); }); } else { SubListView.activateSubListView(); } } else { ListView.activateSubListView(); }
            }
            window.dispatchEvent(new CustomEvent('visuallyLoaded')); window.performance.mark('visuallyLoaded'); window.performance.mark('contentInteractive');
        });
    }
    function jioDongleStatusListener(isMultipicker = false) {
        if (navigator.dongleManager) {
            dongleState.isDongleConnected = navigator.dongleManager.dongleStatus; navigator.dongleManager.ondonglestatuschange = (event) => {
                dongleState.isDongleConnected = event.isConnected; if (isMultipicker && !event.isConnected) { window.close(); }
                let mode = ModeManager.currentMode; if (event.isConnected && dongleState.isJioMediaCableInstalled) { if (mode === MODE_PLAYER) { playByDongle(PlayerView); } }
                if (mode === MODE_LIST || mode === MODE_SEARCH_FROM_LIST) { ListView.updateSoftKeys(); } else if (mode === MODE_SUBLIST || mode === MODE_SUBLIST_LIST || mode === MODE_SEARCH_FROM_SUBLIST) { SubListView.updateSoftKeys(); }
            }
        }
    }
    app = { pendingPick: null, playerSettings: null, currentOverlay: null, knownSongs: [], bLowMemoryDevice: false, discover: null, showOverlay: showOverlay, showCorrectOverlay: showCorrectOverlay, showCurrentView: showCurrentView, }; return app;
})();