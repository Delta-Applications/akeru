'use strict';

/*
 * This is a stripped down version of video.js that handles the view activity
 * and displays streaming videos specified by url.
 *
 * Unfortunately, there is a fair bit of code duplication between this
 * file and video.js, but we are too close to the v1 deadline to refactor
 * the shared code into a single shared file. If the video player UI changes
 * those changes will have to be made in both video.js and view.js
 */
navigator.mozSetMessageHandler('activity', function viewVideo(activity) {
  var dom = {};            // document elements
  var playing = false;
  var endedTimer;
  var controlShowing = false;
  var controlFadeTimeout = null;
  var dragging = false;
  var data = activity.source.data;
  var blob = data.blob;
  var url = data.url;
  var title = data.title || '';
  var storage;       // A device storage object used by the save button
  var saved = false; // Did we save it?
  var endedTimer;    // The workaround of bug 783512.
  var videoRotation = 0;
  var intervalId = null;
  var isFullScreen = false;
  var hasVolumeKey = false;
  var isAlreadyFullscreen = false;
  var metadata = {};
  let players = null;
  var optFullScreen = {
    name: 'Full Screen',
    l10nId: 'opt-fullscreen',
    priority: 1,
    method: function() {
      requstFullscreen();
    }
  };

  var optPlay = {
    icon: 'play',
    l10nId: '',
    name: 'Play',
    priority: 2,
    method: function() {
      handlePlayButtonClick();
    }
  };

  var optSave = {
    l10nId: 'save',
    name: 'Save',
    priority: 5,
    method: function() {
      save();
    }
  };

  var optVolume = {
    l10nId: 'opt-volume',
    name: 'Volume',
    priority: 5,
    method: function () {
      navigator.volumeManager.requestShow();
    }
  }

  var skOpenVideoSoftKey = [optFullScreen, optPlay];
  var skOpenNotVolumeSoftKey = [optFullScreen, optPlay, optVolume];
  if (data.allowSave || !blob.name) {
    skOpenVideoSoftKey.push(optSave);
    skOpenNotVolumeSoftKey.push(optSave);
  }
  let playerskipfoward = document.getElementById('player-skip-foward');
  document.body.classList.toggle('large-text', navigator.largeTextEnabled);
  //
  // Bug 1088456: when the view activity is launched by the bluetooth transfer
  // app (when the user taps on a downloaded file in the notification tray)
  // this code starts running while the regular video app is still running as
  // the foreground app. Since the video app does not get sent to the
  // background in this case, the currently playing video (if there is one) is
  // not paused. And so, in the case of videos that require decoder hardware,
  // the view activity cannot play the video. For this workaround, we have set
  // a localStorage property here. The video.js file should receive an event
  // when we do that and will use that as a signal to unload its video. We use
  // Date.now() as the value of the property so we get a different value and
  // generate an event each time we run.
  //
  try {
    localStorage.setItem('view-activity-wants-to-use-hardware', Date.now());
  } catch(e) {
    console.error('Video activity set storage error!');
  }

  initUI();

  // If blob exists, video should be launched by open activity
  if (blob) {
    // The title we display for this video may be explicitly specified,
    // or it might be the specified filename to save to or it might be
    // the filename of the blob.
    title = data.title || baseName(data.filename) || baseName(blob.name);
    url = URL.createObjectURL(blob);

    // If the app that initiated this activity wants us to allow the
    // user to save this blob as a file, and if device storage is available
    // and if there is enough free space, then display a save button.
    if (data.filename && checkFilename()) {
      storage = navigator.getDeviceStorage('videos');
    }

    // to hide player because it shows in the wrong rotation.
    dom.player.classList.add('hidden');
    // video rotation is not parsed, parse it.
    getVideoRotation(blob, function(rotation) {
      // when error found, fallback to 0
      if (typeof rotation === 'string') {
        console.error('get video rotation error: ' + rotation);
        videoRotation = 0;
      } else {
        videoRotation = rotation;
      }
      // show player when player size and rotation are correct.
      dom.player.classList.remove('hidden');
      // start to play the video that showPlayer also calls fitContainer.
      showPlayer(url, title);
    });
  } else {
    // In the url case, we don't need to calculate the rotation.
    showPlayer(url, title);
  }

  // Detect device whether or not has volume hardware keys.
  navigator.hasFeature('device.capability.volume-key').then((capability) => {
    hasVolumeKey = capability;
  });

  // We get headphoneschange event when the headphones is plugged or unplugged
  var acm = navigator.mozAudioChannelManager;
  if (acm) {
    acm.addEventListener('headphoneschange', function onheadphoneschange() {
      if (!acm.headphones && playing) {
        setVideoPlaying(false);
      }
    });
  }

  function setVideoPlaying(playing) {
    if (playing) {
      play();
    } else {
      pause();
    }
  }

  function initUI() {
    // Fullscreen mode and inline activities don't seem to play well together
    // so we'll play the video without going into fullscreen mode.

    // Get all the elements we use by their id
    var ids = ['player', 'player-view','info-view','file-info',
               'play', 'playHead', 'video-container',
               'elapsedTime', 'duration-text', 'elapsed-text',
               'slider-wrapper', 'timeSlider',
               'banner', 'message', 'in-use-overlay',
               'in-use-overlay-title', 'in-use-overlay-text'];

    ids.forEach(function createElementRef(name) {
      dom[toCamelCase(name)] = document.getElementById(name);
    });

    function toCamelCase(str) {
      return str.replace(/\-(.)/g, function replacer(str, p1) {
        return p1.toUpperCase();
      });
    }

    dom.player.mozAudioChannelType = 'content';
    if (navigator.mozAudioChannelManager) {
      navigator.mozAudioChannelManager.volumeControlChannel = 'content';
    }

    // Rescale when window size changes. This should get called when
    // orientation changes.
    window.addEventListener('resize', function() {
      if (dom.player.readyState !== dom.player.HAVE_NOTHING) {
        VideoUtils.fitContainer(dom.videoContainer, dom.player,
                                videoRotation || 0);
      }
    });
    dom.player.addEventListener('timeupdate', timeUpdated);
    dom.player.addEventListener('seeked', updateSlider);

    dom.player.addEventListener('ended', playerEnded);

    // show/hide controls
    dom.videoContainer.addEventListener('click', toggleVideoControls);

    // handle slider keypress, emitted by the screen reader
    dom.timeSlider.addEventListener('keypress', handleSliderKeypress);
  }

  function checkFilename() {
    var dotIdx = data.filename.lastIndexOf('.');
    if (dotIdx > -1) {
      var ext = data.filename.substr(dotIdx + 1);
      return MimeMapper.guessTypeFromExtension(ext) === blob.type;
    } else {
      return false;
    }
  }

  function setControlsVisibility(visible) {
    dom.playerView.classList[visible ? 'remove' : 'add'](
      'video-controls-hidden');
    controlShowing = visible;
    if (visible) {
      document.body.classList.remove('video-controls-hidden');
    } else {
      document.body.classList.add('video-controls-hidden');
    }

    // Set the proper accessibility label for the video container based on
    // controls showing.
    dom.videoContainer.setAttribute('data-l10n-id', controlShowing ?
      'hide-controls-button' : 'show-controls-button');
    if (visible) {
      // update elapsed time and slider while showing.
      updateSlider();
    }
  }

  function handlePlayButtonClick() {
    setVideoPlaying(dom.player.paused);
  }

  function toggleVideoControls(e) {
    // When we change the visibility state of video controls, we need to check
    // the timeout of auto hiding.
    if (controlFadeTimeout) {
      clearTimeout(controlFadeTimeout);
      controlFadeTimeout = null;
    }
    // We cannot change the visibility state of video contorls when we are in
    // picking mode.
    e.cancelBubble = !controlShowing;
    setControlsVisibility(!controlShowing);
  }

  function done() {
    pause();

    // Release any video resources
    dom.player.removeAttribute('src');
    dom.player.load();
    document.getElementById('video-container').removeChild(dom.player);

    // End the activity
    activity.postResult({saved: saved});

    // Undo the bug 1088456 workaround hack.
    localStorage.removeItem('view-activity-wants-to-use-hardware');
  }

  function checkFreeSpace(size) {
    return new Promise((res, rej) => {
      let freeSpaceRequest = storage.freeSpace();
      freeSpaceRequest.onsuccess = (result) => {
        let freeSpace = result.target.result;
        if(size > freeSpace) {
          res(true);
        } else {
          res(false);
        }
      }

      freeSpaceRequest.onerror = function _onerror() {
        console.warn(`checkAvailableSpace met error: ${this.error}`);
      }
    });
  }

  function save() {
    let name = data.filename.substring(data.filename.lastIndexOf('/') + 1);
    var req = navigator.mozSettings.createLock().get('device.storage.writable.name');
    req.onsuccess = function () {
      let mediaLocation = req.result['device.storage.writable.name'];
      let filePath = `/${mediaLocation}/downloads/${name}`;
      checkFreeSpace(blob.size).then((isFreeSpaceFull) => {
        if (isFreeSpaceFull) {
          let isSdCard = mediaLocation === 'sdcard';
          let header = isSdCard ? 'phone-storage-full-header' : 'sd-storage-full-header';
          let content = isSdCard ? 'phone-storage-full-content' : 'sd-storage-full-content';
          let dialogConfig = {
            title: {id: header, args: {}},
            body: {id: content, args: {}},
            cancel: {
              l10nId: 'opt-cancel',
              priority: 1,
              callback: function() {}
            },
            confirm: {
              l10nId: 'opt-settings',
              priority: 3,
              callback: function() {
                new MozActivity({
                  name: 'moz_configure_window',
                  data: {
                    target: 'device',
                    section: 'mediaStorage'
                  }
                });
                activity.postResult();
              }
            }
          };
          var dialog = new ConfirmDialogHelper(dialogConfig);
          dialog._show(document.getElementById('confirm-dialog-container'));
          return;
        }
        getUnusedFilename(storage, filePath, function(filename) {
          var savereq = storage.addNamed(blob, filename);
          savereq.onsuccess = function() {
            // Remember that it has been saved so we can pass this back
            // to the invoking app
            saved = filename;
            let savedFilename = baseName(filename);
            // And tell the user
            Toaster.showToast({
              message: savedFilename + ' '+ navigator.mozL10n.get('saved'),
              latency: 2000,
            });
          };
          savereq.onerror = function(e) {
            Toaster.showToast({
              message: navigator.mozL10n.get('save-failed'),
              latency: 2000,
            });
            // XXX we don't report this to the user because it is hard to
            // localize.
            console.error('Error saving', filename, e);
          };
        });
      });
    }
  }

  // show video player
  function showPlayer(url, title) {
    function handleLoadedMetadata() {
      var formattedDuration = formatDuration(dom.player.duration);
      dom.durationText.textContent = formattedDuration;
      timeUpdated();

      setButtonPaused(false);
      VideoUtils.fitContainer(dom.videoContainer, dom.player,
                              videoRotation || 0);

      dom.player.currentTime = 0;

      navigator.mozL10n.setAttributes(dom.timeSlider, 'seek-bar',
        { duration: formattedDuration });
      dom.timeSlider.setAttribute('aria-valuemin', 0);
      dom.timeSlider.setAttribute('aria-valuemax', dom.player.duration);
      dom.timeSlider.setAttribute('aria-valuenow', dom.player.currentTime);
      dom.timeSlider.setAttribute('aria-valuetext',
        formatDuration(dom.player.currentTime));
      play();
      reqFullscreen();
      window.focus();
    }

    setControlsVisibility(true);

    var loadingChecker =
      new VideoLoadingChecker(dom.player, dom.inUseOverlay,
                              dom.inUseOverlayTitle,
                              dom.inUseOverlayText);
    loadingChecker.ensureVideoLoads(handleLoadedMetadata);

    dom.player.src = url;

    dom.player.onloadeddata = function(evt) { URL.revokeObjectURL(url); };
    dom.player.onerror = function(evt) {
      var errorid = '';

      switch (evt.target.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          // This aborted error should be triggered by the user
          // so we don't have to show any error messages
          return;
        case MediaError.MEDIA_ERR_NETWORK:
          errorid = 'error-network';
          break;
        case MediaError.MEDIA_ERR_DECODE:
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          // If users tap some video link in an offline page
          // the error code will be MEDIA_ERR_SRC_NOT_SUPPORTED
          // we also prompt the unsupported error message for it
          errorid = 'error-unsupported';
          break;
        // Is it possible to be unknown errors?
        default:
          errorid = 'error-unknown';
          break;
      }

      handleError(errorid);
    };
  }

  function requstFullscreen() {
    updateFullScreenSet(true);
    VideoUtils.fitContainer(dom.videoContainer, dom.player,
      videoRotation || 0);
    window.removeEventListener('keydown', normalHandleKeydown);
    players.requestFullscreen();
  }

  function reqFullscreen() {
    updateFullScreenSet(true);
    VideoUtils.fitContainer(dom.videoContainer, dom.player,
      videoRotation || 0);
    getMetadata();
  }

  function getMetadata() {
    // This is the video element that will get the metadata for us.
    // Because of an apparent bug in gecko, it needs to be here rather than
    // something that is shared globally.
    var offscreenVideo = document.createElement('video');
    offscreenVideo.preload = 'metadata';
    offscreenVideo.src = url;
    offscreenVideo.onloadedmetadata = function() {
      metadata.width = offscreenVideo.videoWidth;
      metadata.height = offscreenVideo.videoHeight;
      setTimeout(function () {
        window.removeEventListener('keydown', normalHandleKeydown);
        if (!document.fullscreenElement && videoRotation === 0
          && metadata.width > metadata.height) {
          if (screen.orientation.type === 'landscape-primary') {
            players = document.getElementById('video-container');
          } else {
            players = document.getElementById('player');
          }
          dom.player.style.backgroundImage = 'none';
        } else {
          players = document.getElementById('video-container');
        }
        players.requestFullscreen();
      }, 300);
    }
  }


  function handleError(msg) {
    var dialogConfig = {
        title: {id: 'confirm-video', args: {}},
        body: {id: msg, args: {}},
        desc: {id: '', args: {}},
        accept: {
            l10nId:'confirm-ok',
            priority:2,
            callback: function() {
              if (document.body.classList.contains('in-use-overlay')) {
                document.body.classList.remove('in-use-overlay');
              }
              if (!dom.inUseOverlay.classList.contains('hidden')) {
                dom.inUseOverlay.classList.add('hidden');
              }
              done();
            },
        },
    };
    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('confirm-dialog-container'));
  }

  function play() {
    // Switch the button icon
    setButtonPaused(false);

    // Start playing
    dom.player.play();
    playing = true;
  }

  function pause() {
    // Switch the button icon
    if (!document.getElementById('option-menu')) {
      setButtonPaused(true);
    }

    // Stop playing the video
    dom.player.pause();
    playing = false;
  }

  // Update the progress bar and play head as the video plays
  function timeUpdated() {
    if (controlShowing) {
      // We can't update a progress bar if we don't know how long
      // the video is. It is kind of a bug that the <video> element
      // can't figure this out for ogv videos.
      if (dom.player.duration === Infinity || dom.player.duration === 0) {
        return;
      }

      updateSlider();
    }

    dom.timeSlider.setAttribute('aria-valuenow', dom.player.currentTime);
    dom.timeSlider.setAttribute('aria-valuetext',
      formatDuration(dom.player.currentTime));

    // Since we don't always get reliable 'ended' events, see if
    // we've reached the end this way.
    // See: https://bugzilla.mozilla.org/show_bug.cgi?id=783512
    // If we're within 1 second of the end of the video, register
    // a timeout a half a second after we'd expect an ended event.
    if (!endedTimer) {
      if (!dragging && dom.player.currentTime >= dom.player.duration - 1) {
        var timeUntilEnd = (dom.player.duration - dom.player.currentTime + .5);
        endedTimer = setTimeout(playerEnded, timeUntilEnd * 1000);
      }
    } else if (dragging && dom.player.currentTime < dom.player.duration - 1) {
      // If there is a timer set and we drag away from the end, cancel the timer
      clearTimeout(endedTimer);
      endedTimer = null;
    }
  }

  function playerEnded() {
    if (dragging) {
      return;
    }
    if (endedTimer) {
      clearTimeout(endedTimer);
      endedTimer = null;
    }

    // If we are still playing when this 'ended' event arrives, then the
    // user played the video all the way to the end, and we skip to the
    // beginning and pause so it is easy for the user to restart. If we
    // reach the end because the user fast forwarded or dragged the slider
    // to the end, then we will have paused the video before we get this
    // event and in that case we will remain paused at the end of the video.
    if (playing) {
      dom.player.currentTime = 0;
      pause();
    }
    //back to non full screen
    if (isFullScreen) {
      updateFullScreenSet(false);
    }
  }

  function updateFullScreenSet(val) {
    if (val) {
      setControlsVisibility(false);
      window.option.hide();
      isFullScreen = true;
    } else {
      window.removeEventListener('keydown', fullScreenHandleClick);
      setControlsVisibility(true);
      isFullScreen = false;
      window.option.show();
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  function setButtonPaused(paused) {
    var params = {
      header: { l10nId:'options-header' },
      items: []
    };
    optPlay.icon = paused ? 'play' : 'pause';
    optPlay.name = paused ? 'Play' : 'Pause';
    params.items = hasVolumeKey ? skOpenVideoSoftKey : skOpenNotVolumeSoftKey;
    if(window.option) {
      window.option.initSoftKeyPanel(params);
    } else {
      window.option = new SoftkeyPanel(params);
      window.option.show();
    }
  }

  function movePlayHead(percent) {
    if (navigator.mozL10n.language.direction === 'ltr') {
      dom.playHead.style.left = percent;
    }
    else {
      dom.playHead.style.right = percent;
    }
  }

  function updateSlider() {
    // We update the slider when we get a 'seeked' event.
    // Don't do updates while we're seeking because the position we fastSeek()
    // to probably isn't exactly where we requested and we don't want jerky
    // updates
    if (dom.player.seeking) {
      return;
    }

    var percent = (dom.player.currentTime / dom.player.duration) * 100;
    if (isNaN(percent)) // this happens when we end the activity
      return;
    percent += '%';

    dom.elapsedText.textContent = formatDuration(dom.player.currentTime);
    dom.elapsedTime.style.width = percent;
    var remainingTime = dom.player.duration - dom.player.currentTime;
    var endTime = formatDuration(remainingTime, true);
    dom.durationText.textContent =
    (remainingTime > 0) ? endTime : navigator.mozL10n.get('not-load-video-time');
    // Don't move the play head if the user is dragging it.
    if (!dragging) {
      movePlayHead(percent);
    }
  }

  function formatDuration(duration, negative) {
    let _ = navigator.mozL10n.get;
    function padLeft(num) {
      var r = String(num);
      if (r.length === 1) {
        r = _('video-time-num', { num: r });
      }
      return r;
    }

    duration = Math.round(duration);
    var minutes = Math.floor(duration / 60);
    var seconds = duration % 60;
    if (minutes < 60) {
      return _('video-time-minute', {
        m: padLeft(minutes),
        s: padLeft(seconds),
        owe: negative ? '-' : ''
      });
    }
    var hours = Math.floor(minutes / 60);
    minutes = Math.floor(minutes % 60);
    return _('video-time-hour', {
      h: hours,
      m: padLeft(minutes),
      s: padLeft(seconds),
      owe: negative ? '-' : ''
    });
  }

  function handleSliderKeypress(event) {
    // The standard accessible control for sliders is arrow up/down keys.
    // Our screenreader synthesizes those events on swipe up/down gestures.
    // Currently, we only allow screen reader users to adjust sliders with a
    // constant step size (there is no page up/down equivalent). In the case
    // of videos, we make sure that the maximum amount of steps for the entire
    // duration is 20, or 2 second increments if the duration is less then 40
    // seconds.
    var step = Math.max(dom.player.duration / 20, 2);
    if (event.keyCode === event.DOM_VK_DOWN) {
      dom.player.fastSeek(dom.player.currentTime - step);
    } else if (event.keyCode === event.DOM_VK_UP) {
      dom.player.fastSeek(dom.player.currentTime + step);
    }
  }

  // Strip directories and just return the base filename
  function baseName(filename) {
    if (!filename)
      return '';
    return filename.substring(filename.lastIndexOf('/') + 1);
  }

  function seekVideo(seekTime) {
    if (seekTime >= dom.player.duration) {
      seekTime = 0;
      pause();
    } else if (seekTime < 0) {
      seekTime = 0;
    }
    dom.player.fastSeek(seekTime);
  }

  window.addEventListener('menuEvent', function(e) {
    if (e.detail.menuVisible) {
      NavigationMap.optionReset();
      pause(true);
    } else {
      setButtonPaused(true);
    }
  });

  function updateSkipicon(isforward) {
    if (isforward === 1) {
      playerskipfoward.setAttribute('data-icon', 'skip-forward');
    } else {
      playerskipfoward.setAttribute('data-icon', 'skip-back');
    }
  }

  function updateDisplay(type) {
    if (type) {
      playerskipfoward.classList.remove('hidden');
      durationtext.classList.add('hidden');
    } else {
      playerskipfoward.classList.add('hidden');
      durationtext.classList.remove('hidden');
    }
  }

  function fullScreenHandleClick(e) {
    switch(e.key) {
      case 'HeadsetHook':
        if (!playing) {
          play();
        } else {
          pause();
        }
        break;
      case 'Enter':
        if (isFullScreen && playing) {
          pause();
        } else if (isFullScreen && !playing) {
          play();
        }
        e.preventDefault();
        e.stopPropagation();
        break;
      case 'SoftLeft':
      case 'SoftRight':
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Backspace':
      case 'BrowserBack':
        if (isFullScreen) {
          updateFullScreenSet(false);
          e.preventDefault();
          e.stopPropagation();
        }
        break;
    }
  }

  function normalHandleKeydown(e) {
    switch (e.key) {
      case 'HeadsetHook':
        if (!playing) {
          play();
        } else {
          pause();
        }
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        var direction = (e.key == 'ArrowRight') ? 1 : -1;
        var offset = direction * 10;
        if (intervalId == null) {
          intervalId = window.setInterval(function() {
            seekVideo(dom.player.currentTime + offset);
            updateSkipicon(direction);
            updateDisplay(true);
          }, 500);
        }
        break;
      case 'Backspace':
      case 'BrowserBack':
        if (!document.getElementById('option-menu')) {
          done();
          e.preventDefault();
          e.stopPropagation();
        }
        break;
      case 'ArrowDown':
        if (navigator.volumeManager && !NavigationMap.optionMenuVisible) {
          navigator.volumeManager.requestDown();
        }
        break;
      case 'ArrowUp':
        if (navigator.volumeManager && !NavigationMap.optionMenuVisible) {
          navigator.volumeManager.requestUp();
        }
        break;
    }
  }

  window.addEventListener('fullscreenchange', () => {
    if (!isAlreadyFullscreen) {
      setControlsVisibility(false);
      window.addEventListener('keydown', fullScreenHandleClick);
    } else {
      VideoUtils.fitContainer(dom.videoContainer, dom.player, videoRotation || 0);
      window.addEventListener('keydown', normalHandleKeydown);
    }
    isAlreadyFullscreen = !isAlreadyFullscreen;
  });

  window.addEventListener('keydown', normalHandleKeydown);
  window.addEventListener('keyup', function(e) {
    if ((e.key == 'ArrowLeft' || e.key == 'ArrowRight') && intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
      updateDisplay(false);
    }
  });
});
