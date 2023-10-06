'use strict';
/* global CustomLogoPath */
/* global LogoLoader */

(function(exports) {

  /**
   * SleepMenu controls functionality found in the menu after long-pressing on
   * the power button. Controls include: airplane mode, silence incoming calls,
   * restart, and power off. This file also currently contains a
   * developerOptions object which is not currently in use.
   * @class SleepMenu
   * @requires InitLogoHandler
   * @requires LogoLoader
   */
  function SleepMenu() {}

  SleepMenu.prototype = {
    isShuttingDown: false,

    /**
     * Start listening for events and settings changes.
     * @memberof SleepMenu.prototype
     */
    start: function sm_init() {
      this.showSleepMenu = this.show.bind(this);
      window.addEventListener('holdsleep', this);
      window.addEventListener('batteryshutdown', this);

      Service.register('startPowerOff', this);
      Service.register('showSleepMenu', this);
      Service.registerState('isShuttingDown', this);
      window.dispatchEvent(new CustomEvent('sleepmenuready')); //BTS-1282
    },

    /**
     * Generates menu items.
     * @memberof SleepMenu.prototype
     */
    generateItems: function sm_generateItems() {
      var items = [];
      var _ = navigator.mozL10n.get;
      // keep original implement, maybe someday sleep menu will become dynamic.
      var options = {
        cleanup: {
          label: _('cleanup'),
          callback: () => {
            InitLogoHandler.cleanupMemory();
            Service.request('killApps');
            Service.request('InputWindowManager:kill');
            window.requestAnimationFrame(() => {
              appWindowManager.display(null, null, null, 'home');
              Service.request('focus');
            });
          }
        },
        lock: {
          label: _('lock'),
          callback: Service.request.bind(Service, 'LockscreenView:lock')
        },
        restart: {
          label: _('restart'),
          callback: this.startPowerOff.bind(this, true)
        },
        power: {
          label: _('power'),
          callback: this.startPowerOff.bind(this, false)
        }
      };
      if (!Service.query('isFlip')) {
        items.push(options.lock);
      }
      items.push(options.cleanup);
      items.push(options.restart);
      items.push(options.power);
      return items;
    },

    /**
     * Shows the sleep menu.
     * @memberof SleepMenu.prototype
     */
    show: function sm_show() {
      Service.request('showSystemOptionMenu', {
        customClass: 'sleep-menu',
        header: 'select',
        options: this.generateItems()
      });
    },

    /**
     * General event handler.
     * @memberof SleepMenu.prototype
     * @param {Event} evt The event to handle.
     */
    handleEvent: function sm_handleEvent(evt) {
      switch (evt.type) {
        case 'holdsleep':
          dump("gavin holdsleep");
          this.show();
          break;

        case 'batteryshutdown':
          window.dispatchEvent(
              new CustomEvent('requestshutdown', {detail: this}));
          break;

        default:
          break;
      }
    },

    publish: function(evtName) {
      window.dispatchEvent(new CustomEvent(evtName));
    },

    /**
     * Begins the power off of the device. Also reboots the device if
     * requested.
     * @memberof SleepMenu.prototype
     * @param {Boolean} reboot Whether or not to reboot the phone.
     */
    startPowerOff: function sm_startPowerOff(reboot) {
      this.publish('will-shutdown');
      var power = navigator.mozPower;
      var self = this;
      if (!power) {
        return;
      }

      // Early return if we are already shutting down.
      if (document.getElementById('poweroff-splash')) {
        return;
      }

      this.isShuttingDown = true;

      // Show shutdown animation before actually performing shutdown.
      //  * step1: fade-in poweroff-splash.
      //  * step2: - As default, 3-ring animation is performed on the screen.
      //           - Manufacturer can customize the animation using mp4/png
      //             file to replace the default.
      var div = document.createElement('div');
      div.dataset.zIndexLevel = 'poweroff-splash';
      div.id = 'poweroff-splash';


      var logoLoader = new LogoLoader(CustomLogoPath.poweroff);

      logoLoader.onload = function customizedAnimation(elem) {
        // Perform customized animation.
        div.appendChild(elem);
        div.className = 'step1';

        if (elem.tagName.toLowerCase() == 'video' && !elem.ended) {
          elem.onended = function() {
            elem.classList.add('hide');
            // XXX workaround of bug 831747
            // Unload the video. This releases the video decoding hardware
            // so other apps can use it.
            elem.removeAttribute('src');
            elem.load();
          };
          window.setTimeout(() => {
            //if (!elem.played.length) {
              //self._actualPowerOff(reboot);
            //}
            // FIH change: phone can't poweroof as no transitionend event when close flip
            // so poweroff directly after timeout
            self._actualPowerOff(reboot);
          }, 3000);
          elem.play();
        } else {
          div.addEventListener('animationend', function() {
            elem.classList.add('hide');
            if (elem.tagName.toLowerCase() == 'video') {
                // XXX workaround of bug 831747
                // Unload the video. This releases the video decoding hardware
                // so other apps can use it.
                elem.removeAttribute('src');
                elem.load();
            }
          });
        }

        elem.addEventListener('transitionend', function() {
          self._actualPowerOff(reboot);
        });
        document.getElementById('screen').appendChild(div);
      };

      logoLoader.onnotfound = function defaultAnimation() {
        self._actualPowerOff(reboot);
        document.getElementById('screen').appendChild(div);
      };
    },

    /**
     * Helper for powering the device off.
     * @memberof SleepMenu.prototype
     * @param {Boolean} isReboot Whether or not to reboot the phone.
     */
    _actualPowerOff: function sm_actualPowerOff(isReboot) {
      var power = navigator.mozPower;

      if (isReboot) {
        power.reboot();
      } else {
        power.powerOff();
      }
    }
  };

  exports.SleepMenu = SleepMenu;

}(window));
