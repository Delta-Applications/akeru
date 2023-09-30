'use strict';
(function () {
    const time = 300;
    window.mozFMRadio = navigator.mozFM || navigator.mozFMRadio;

    function initialize() {
        window.FMElementFMContainer = document.getElementById('fm-container');
        window.FMElementScanProgress = document.getElementById('gaia-progress');
        window.FMElementFrequencyBar = document.getElementById('frequency-bar');
        window.FMElementFrequencyDialer = document.getElementById('frequency');
        window.FMElementTurningStatus = document.getElementById('turning-status');
        window.FMElementFrequencyListUI = document.getElementById('frequency-list');
        window.FMElementFavoriteListWarning = document.getElementById('favoritelist-warning');
        window.FMElementAirplaneModeWarning = document.getElementById('airplane-mode-warning');
        window.FMElementAntennaUnplugWarning = document.getElementById('antenna-warning');
        window.FMElementFrequencyListContainer = document.getElementById('frequency-list-container');
        window.FMElementFrequencyListTemplate = document.getElementById('frequency-list-template');
        window.FMElementFMHeader = document.getElementById('fm-header');
    }
    document.body.classList.toggle('large-text', navigator.largeTextEnabled);
    window.addEventListener('largetextenabledchanged', function () {
        document.body.classList.toggle('large-text', navigator.largeTextEnabled);
    });
    if (navigator.mozAudioChannelManager.headphones || true) {
        FMCacheRestore.hydrateHtml('fm-container');
    } else {
        let fmContainer = document.getElementById('fm-container');
        fmContainer.classList.add('hidden');
    }

    function lazyload() {
        setTimeout(() => {
            let lazyFiles = ['/shared/js/airplane_mode_helper.js', '/shared/elements/gaia-progress/dist/gaia-progress.js', 'js/speaker_state.js', 'js/headphone_state.js', 'js/fm_softkey_helper.js', 'js/history_frequency.js', 'js/stations_list.js', 'js/status_manager.js', 'js/frequency_manager.js', 'js/frequency_dialer.js', 'js/frequency_list.js', 'js/warning_ui.js', 'js/activity.js', 'js/fm_radio.js'];
            LazyLoader.load(lazyFiles, () => {
                initialize();
                FMRadio.init();
                let cachedSoftkey = document.getElementById('cachedSoftkeyPanel');
                if (cachedSoftkey) {
                    document.body.removeChild(cachedSoftkey);
                }
            });
        }, time);
        window.performance.mark('navigationInteractive');
        window.dispatchEvent(new CustomEvent('moz-chrome-interactive'));
        window.performance.mark('visuallyLoaded');
        window.dispatchEvent(new CustomEvent('moz-app-visually-complete'));
        window.performance.mark('contentInteractive');
        window.dispatchEvent(new CustomEvent('moz-content-interactive'));
    }

    function unload() {
        FMRadio.disableFMRadio();
    }
    window.addEventListener('load', lazyload, false);
    window.addEventListener('unload', unload, false);
    window.performance.mark('navigationLoaded');
    window.dispatchEvent(new CustomEvent('moz-chrome-dom-loaded'));
})();