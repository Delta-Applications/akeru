/* global $, setView, LAYOUT_MODE, photodb, LazyLoader, Spinner, ImageEditor */
/* global cropResizeRotate */
/* global CONFIG_MAX_PICK_PIXEL_SIZE, CONFIG_MAX_IMAGE_PIXEL_SIZE */
/* exported Pick */

'use strict';

// XXX: the pick activity could, and probably should be handled with a
// completely different entry point from regular invocations of
// Gallery.  If we can modularize the bootstrap/startup code and the
// thumbnail display code enough that we can use it in both entry
// points, it would probably be better to do it that way.

/*
 *  A pick activity can be in two distinct states:
 *
 *   1) the picking state where the user is browsing thumbnails.
 *      Tapping a thumbnail moves to state 2. Tapping the cancel
 *      button cancels the activity and the app exits.
 *
 *   2) the preview/cropping phase where the user sees a full-screen
 *     image and may have the option to crop it and also sees
 *     cancel and done buttons. Tapping cancel moves back to state 1.
 *     Tapping Done ends the pick activity and the app exits.
 *
 *  This Pick module defines start(), select(), end(), cancel()
 *  and restart() methods to handle these state transitions.
 *  Note that this is not a Pick class, just a module of interacting
 *  functions for managing picks. The gallery code needs to call
 *  Pick.start() and Pick.crop().
 */

var Pick = {
  //properties
  debug: debug.bind(window, 'Pick'),
  request: null,
  pickDataType: null,
  pickWidth: null,
  pickHeight: null,
  arrows: null,
  blobType: null,
  callback: null,
  savedSettings: null,
  homeView: null,
  wallpaper: false, //define is in set-wallpaper mode

   // Called when we are first start up with the activity request object
  start: function(activity) {
    this.request = activity;
    this.pickDataType = this.request.source.data.type;
    var data = this.request.source.data;
    if (data.width && data.height) {
      this.pickWidth = data.width;
      this.pickHeight = data.height;
    } else {
      this.pickWidth = this.pickHeight = 0;
    }

    // re-run the font-fit logic when header is visible
    var pickHeading = $('pick-header-title');
    pickHeading.textContent = pickHeading.textContent;
    if(this.pickDataType.contains('wallpaper')) {
      this.wallpaper = true;
      SoftkeyManager.softkeyItems['cropView.cropRect'] = SoftkeyManager.softkeyItems['cropView.cropRectWallpaper'];
    }
  },

  // Called when the user selects a thumbnail in pick mode.
  select: function(fileinfo) {
    var homeView;
    if(this.wallpaper) {
      homeView = CROP_SUBVIEW.pickWallpaper;
    } else {
      homeView = CROP_SUBVIEW.pickImage;
    }

    this.pick(
      fileinfo,
      {width: this.pickWidth, height: this.pickHeight},
      this.getBlobType(),
      homeView,
      this.end);
  },

  getBlobType: function() {
    var blobType = null;
    // First, figure out what kind of image to return to the requesting app.
    // If the activity request specifically included 'image/jpeg' or
    // 'image/png', then we'll use that type. Otherwise, if a generic
    // 'image/*' was requested (or if an unsupported type was requested)
    // then we use null as the type. This value is passed to
    // cropResizeRotate() and will leave the image unchanged if possible
    // or will use jpeg if changes are needed.
    if (Array.isArray(this.pickDataType)) {
      if (this.pickDataType.contains('image/jpeg')) {
        blobType = 'image/jpeg';
      }
      else if (this.pickDataType.contains('image/png')) {
        blobType = 'image/png';
      }
    }
    return blobType;
  },

  end: function(canvasType) {
    this.request.postResult({
      type: canvasType.type,
      blob: canvasType
    });
  },

  cancel: function() {
    this.request.postError('pick cancelled');
  },

  // Stop cropping the image and go back to picking mode
  restart: function() {
    setView(LAYOUT_MODE.pick);
  },

  //misc
  pick: function(fileInfo, size, blobType, homeView, callback) {
    setView(LAYOUT_MODE.crop);
    NavigationMap.disableNav = true;
    Gallery.lastSubView = null;
    this.homeView = homeView;
    this.blobType = blobType;
    this.callback = callback;
    this.initCrop(fileInfo, size);
  },

  initCrop: function(fileInfo, size) {
    Gallery.loadImageEditorJS(this, () => {
      this.clear();
      photodb.getFile(fileInfo.name,
        this.readFile.bind(this, fileInfo.metadata, size));
    });
  },

  readFile: function(meta, size, blob) {
    if (meta.rotation || meta.mirrored || meta.width * meta.height > size) {
      cropResizeRotate(blob, null, size, null, meta, (error, newBlob) => {
        if (error) {
          log('readFile:', error);
          newBlob = blob;
        }
        Pick.crop.call(Pick, newBlob);
      });
    } else {
      this.crop(blob);
    }
  },

  crop: function(blob) {
    pickEditor.init(blob,$('crop-frame'),$('crop-frame').offsetWidth,$('crop-frame').offsetHeight);
    this.enterHome();
  },

  save: function() {
    this.callback(pickEditor.blob);
    this.callback = null;
  },

  exit: function(evt) {
    Pick.request.postError('pick cancelled');
    if (!evt) {
      return;
    }
    evt.preventDefault();
  },

  enterHome: function() {
    Gallery.subView = this.homeView;
    this.savedSettings = null;
  },

  clear: function() {
    this.blobType = null;
    this.savedSettings = null;
  }
};

