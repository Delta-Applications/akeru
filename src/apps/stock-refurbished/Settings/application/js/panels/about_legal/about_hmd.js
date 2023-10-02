/* global SettingsSoftkey */
/**
 * Used to show about legal panel
 */
define(['require','modules/settings_panel'],function (require) {
    
    var SettingsPanel = require('modules/settings_panel');
    var l10n = navigator.mozL10n;

    return function ctor_about_legal_panel() {
        function _initSoftKey() {
            var softkeyParams = {
                menuClassName: 'menu-button',
                header: {
                    l10nId: 'message'
                },
                items: [{
                    name: 'Select',
                    l10nId: 'select',
                    priority: 2,
                    method: function () {
                    }
                }]
            };

            SettingsSoftkey.init(softkeyParams);
            SettingsSoftkey.show();
        }

           var testpanel;
        return SettingsPanel({
            onInit:function(panel){
                console.log("about HMD panel init");
                testpanel = panel;

                var div = document.getElementById("develop-hmd");

                var p1 = document.createElement("p");
                // p1.innerHTML = LinkHelper.searchAndLinkUrl(eula_url);
                p1.innerHTML = navigator.mozL10n.get('hmd-privacy-description-1');
                div.appendChild(p1);

                var p2 = document.createElement("p");
                p2.innerHTML = LinkHelper.searchAndLinkUrl(navigator.mozL10n.get('hmd-privacy-description-2'));
                div.appendChild(p2);

                var p3 = document.createElement("p");
                p3.innerHTML = navigator.mozL10n.get('hmd-eula-privacy-description-1');
                div.appendChild(p3);

                var p4 = document.createElement("p");
                p4.innerHTML = navigator.mozL10n.get('hmd-privacy-description-4');
                div.appendChild(p4);

                var p5 = document.createElement("p");
                p5.innerHTML = navigator.mozL10n.get('hmd-eula-privacy-description-2');
                div.appendChild(p5);

                var p6 = document.createElement("p");
                p6.innerHTML = LinkHelper.searchAndLinkUrl(navigator.mozL10n.get('hmd-privacy-description-6'));
                div.appendChild(p6);

                // this.focusableLinks1 = panel.querySelectorAll('a');
                //
                // this.focusableLinks2 = div.querySelectorAll('a');

                this.initFocus(panel);

                this.handleKeydown = this._handleKeyDown.bind(this) ;

            },

            onBeforeShow: function () {
                _initSoftKey();
            },

            onShow: function () {
                window.addEventListener('keydown', this.handleKeydown);
            },

            onBeforeHide: function () {
                SettingsSoftkey.hide();
                window.removeEventListener('keydown', this.handleKeydown);
            },

            _handleKeyDown: function (e) {
                console.log("about HMD panel _handleKeyDown");
                switch (e.key) {
                    case 'Enter' :
                        let url = document.querySelector('.focus').dataset.url;
                        let activity = new MozActivity({
                            name: 'view',
                            data: {
                                type: 'url',
                                url: url
                            }
                        });
                        activity.onsuccess = () => {
                        //debug('activity successfuly handled');
                    };
                        activity.onerror = () => {
                        // debug('the activity encouter an error: ' + this.error);
                    };
                        break;

                    case 'ArrowDown':
                        this.updateCurrentViewFocusLinks();
                        var beforeScrollLength = this.inViewFocusableLinks.length;

                        if (beforeScrollLength === 0) {
                            this.removeAllFocus();
                            // this.updateSoftkey(this.params);
                            // 2. the focusable links length is 1.
                            // if has one inview focusable link, we should scroll the
                            // page immediately.
                        } else if (beforeScrollLength === 1) {
                            this.setFocusElement(0);
                            // 3. the focusable links length > 1
                        } else if (beforeScrollLength > 1) {

                            for (var i = 0; i < this.inViewFocusableLinks.length; i++) {
                                let inViewFocusableLink = this.inViewFocusableLinks[i];
                                if (!inViewFocusableLink.classList.contains('focus')) {
                                    this.setFocusElement(i);
                                }
                            }
                        }
                        break;

                    case 'ArrowUp':
                        this.updateCurrentViewFocusLinks();
                        var beforeScrollLength = this.inViewFocusableLinks.length;
                        // 1. the focusable links length is 0.
                        if (beforeScrollLength === 0) {
                            // 2. the focusable links length is 1.
                            // if has one inview focusable link, we should scroll the
                            // page immediately.
                        } else if (beforeScrollLength === 1) {
                            this.setFocusElement(0);
                            // 3. the focusable links length > 1
                        } else if (beforeScrollLength > 1) {

                            for (let i = this.inViewFocusableLinks.length - 1; i >= 0 ; i--) {
                                let inViewFocusableLink = this.inViewFocusableLinks[i];
                                if (!inViewFocusableLink.classList.contains('focus')) {
                                    this.setFocusElement(i);
                                }
                            }
                        }
                        break;
                }

            },

            initFocus : function (panel) {
                this.focusableLinks = panel.querySelectorAll('a');
                this.updateCurrentViewFocusLinks();
                if (this.inViewFocusableLinks.length > 0){
                    this.setFocusElement(0);
                }
            },

            setFocusElement : function(index) {
                this.removeAllFocus();
                if (this.inViewFocusableLinks.length > 0) {
                    var toFocused = this.inViewFocusableLinks[index];
                    toFocused.classList.add('focus');
                    // this.updateSoftkey(this.linkFocusparams);-------------------------------------------------nnn

                    // update currentLinkIndex
                    for (var i = 0; i < this.focusableLinks.length; i++) {
                        if (this.focusableLinks[i] === toFocused) {
                            this.currentLinkIndex = i;
                            break;
                        }
                    }
                }
            },

            removeAllFocus : function() {
                for (var i = 0; i < this.focusableLinks.length; i++) {
                    if (this.focusableLinks[i].classList.contains('focus')) {
                        this.focusableLinks[i].classList.remove('focus');
                    }
                }
                // this.updateSoftkey(this.params);
            },

            updateCurrentViewFocusLinks : function() {

            this.inViewFocusableLinks = []; ////query inview link

            for (var i = 0; i < this.focusableLinks.length; i++) {
                if (this.isVisible(this.focusableLinks[i])) {
                    this.inViewFocusableLinks.push(this.focusableLinks[i]);
                }
            }
        },

            isVisible : function(el) {

                if(el.getBoundingClientRect().top > 0 && el.getBoundingClientRect().top
                    < testpanel.clientHeight-testpanel.querySelector('gaia-header').clientHeight){
                    return true;
                }

                return false;
            },

        });
    };
});
