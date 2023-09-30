/* exported Format */
'use strict';

/**
 * format.js: simple formatters and string utilities.
 */

var Format = {

  /**
   * Pads a string to the number of characters specified.
   * @param {String} input value to add padding to.
   * @param {Integer} len length to pad to.
   * @param {String} padWith char to pad with (defaults to " ").
   */
  padLeft: function(input, len, padWith) {
    padWith = padWith || ' ';

    var pad = len - (input + '').length;
    while (--pad > -1) {
      input = padWith + input;
    }
    return input;
  }
};

/*
 * media_frame.js:
 *
 * A MediaFrame displays a photo or a video. The gallery app uses
 * three side by side to support smooth panning from one item to the
 * next.  The Camera app uses one for image and video preview. The
 * Gallery app's open activity uses one of these to display the opened
 * item.
 *
 * MediaFrames have different behavior depending on whether they display
 * images or videos. Photo frames allow the user to zoom and pan on the photo.
 * Video frames allow the user to play and pause but don't allow zooming.
 *
 * When a frame is displaying a video, it handles mouse events.
 * When displaying a picture, however, it expects the client to handle events
 * and call the pan() and zoom() methods.
 *
 * The pan() method is a little unusual. It "uses" as much of the pan
 * event as it can, and returns a number indicating how much of the
 * horizontal motion it did not use. The gallery uses this returned
 * value for transitioning between frames.  If a frame displays a
 * photo that is not zoomed in at all, then it can't use any of the
 * pan, and returns the full amount which the gallery app turns into a
 * panning motion between frames.  But if the photo is zoomed in, then
 * the MediaFrame will just move the photo within itself, if it can, and
 * return 0.
 *
 * MediaFrame uses the #-moz-samplesize media fragment (via the downsample.js
 * module) to downsample large jpeg images while decoding them when necessary.
 * You can specify a maximum image decode size (in megapixels) when invoking
 * the constructor. The MediaFrame code also includes a runtime check for
 * the amount of RAM available on the device, and may limit the image decode
 * size on low-memory devices.
 */
function MediaFrame(container, includeVideo, maxImageSize,autoHideProgressBar) {
  this.clear(); // Set all the properties we'll use to default values

  if (typeof container === 'string')
    container = document.getElementById(container);
  this.container = container;
  this.maximumImageSize = maxImageSize || 0;

  // Create an <img> element to display the image
  this.image = new Image();
  this.image.className = 'image-view';
  this.image.style.opacity = 0;                        // Start off hidden.
  this.image.onload = function() {                     // When image loads...
    this.style.opacity = 1;                            // make it visible
  };
  this.image.style.transformOrigin = 'center center';  // for zooming
  this.image.style.backgroundImage = 'none';
  this.image.style.backgroundSize = 'contain';
  this.image.style.backgroundRepeat = 'no-repeat';
  this.container.appendChild(this.image);

  // Create the video player element unless we know we'll never need it
  if (includeVideo !== false) {
    this.video = new VideoPlayer(container, autoHideProgressBar);
    this.video.hide();
    this.addVideoPlayerListener();
  }

  // Add a class to the container so we could find it later and use it as
  // a key in the instance weakmap.
  container.classList.add('media-frame-container');
  MediaFrame.instancesToLocalize.set(container, this);
}

// WeakMap with the container nodes as keys and MediaFrame instances as values.
MediaFrame.instancesToLocalize = new WeakMap();

navigator.mozL10n.ready(function() {
  // Retrieve MediaFrame instances by searching for container nodes.
  for (var container of document.querySelectorAll('.media-frame-container')) {
    var instance = MediaFrame.instancesToLocalize.get(container);
    if (instance) {
      instance.localize();
    }
  }
});

MediaFrame.computeMaxImageDecodeSize = function(mem) {
  if (!mem) {
    return 0;
  }
  else if (mem < 256) {  // This is a Tarako-class device ultra low-end device.
    return 2 * 1024 * 1024;   // 2 megapixels
  }
  else if (mem < 512) {  // This is a low-end 256mb device
    // Normally we can handle 3mp images on devices like this, but if
    // this device has a big screen and low memory (like a memory
    // throttled Flame) then it needs something smaller than 3mp.
    var screensize = screen.width * window.devicePixelRatio *
      screen.height * window.devicePixelRatio;
    if (mem < 325 && screensize > 480 * 800) {
      return 2.5 * 1024 * 1024;  // 2.5mp megapixels for throttled Flame
    }

    return 3 * 1024 * 1024;      // 3 megapixels otherwise
  }
  else if (mem < 1024) { // A mid-range 512mb device
    return 5 * 1024 * 1024;   // 5 megapixels
  }
  else {                 // A high-end device with 1 gigabyte or more of memory
    // Allow 8 megapixels of image decode size per gigabyte of memory
    return (mem / 1024) * 8 * 1024 * 1024;
  }
};

//
// Find out how much memory this device has because we may need to limit image
// decode size on low-end devices.  Note that navigator.getFeature requires
// the "feature-detection" permission (at least for now) so we only run this
// code if the client app has that permission.
//
if (navigator.getFeature) {
  MediaFrame.pendingPromise = navigator.getFeature('hardware.memory');
  MediaFrame.pendingPromise.then(
    function resolve(mem) {
      delete MediaFrame.pendingPromise;
      MediaFrame.maxImageDecodeSize = MediaFrame.computeMaxImageDecodeSize(mem);
    },
    function reject(err) {
      // This should never happen!
      delete MediaFrame.pendingPromise;
      MediaFrame.maxImageDecodeSize = 0;
    }
  );
}

MediaFrame.prototype.destroy = function destroy() {
  if (this.video) {
    this.removeVideoPlayerListener();
  }
};

MediaFrame.prototype.onHeadphonesChange = function onHeadphonesChange() {
  if (!this.acm.headphones && this.video.playing) {
    this.video.pause();
  }
};

MediaFrame.prototype.addVideoPlayerListener =
  function addVideoPlayerListener() {
    // pause the video player if user unplugs headphone
    this.acm = navigator.mozAudioChannelManager;
    if (this.acm) {
      this.onheadphoneschange = this.onHeadphonesChange.bind(this);
      this.acm.addEventListener('headphoneschange', this.onheadphoneschange);
    }
    // Pause and unload the video if we're hidden so that other apps
    // can use the video decoder hardware.
    window.addEventListener('visibilitychange', this.video.onVisibilityChange);
    // Also resize the player on a resize event
    // (when the user rotates the phone)
    window.addEventListener('resize', this.video.setPlayerSize);
  };

MediaFrame.prototype.removeVideoPlayerListener =
  function removeVideoPlayerListener() {
    if (this.acm) {
      this.acm.removeEventListener('headphoneschange',
        this.onheadphoneschange);
    }
    window.removeEventListener('visibilitychange',
      this.video.onVisibilityChange);
    window.removeEventListener('resize', this.video.setPlayerSize);
  };

MediaFrame.prototype.displayImage = function displayImage(blob,
    width,
    height,
    preview,
    rotation,
    mirrored,
    largeSize)
{
  var self = this;

  // If we are still querying the device memory, wait for that query to
  // complete and then try again.
  if (MediaFrame.pendingPromise) {
    MediaFrame.pendingPromise.then(function resolve() {
      self.displayImage(blob, width, height, preview, rotation, mirrored);
    });
    return;
  }

  this.clear();  // Reset everything

  // Remember what we're displaying. This doesn't really need to be public
  // but the Gallery app uses it.
  this.imageblob = blob;

  // Figure out if we are going to downsample the image before displaying it
  // We expose fullSampleSize as part of the public api only for testing.
  this.fullSampleSize = computeFullSampleSize(blob, width, height);
  this.fullsizeWidth = this.fullSampleSize.scale(width);
  this.fullsizeHeight = this.fullSampleSize.scale(height);

  // Create a blob URL for the image and combine it with the media fragment.
  // imageurl is what we'll call revokeObjectURL on. fullImageURL may
  // have a media fragment appended, so we need to track both properties.
  if (largeSize === true) {
    this.fullImageURL = galleryErrorLargeSrc;
  } else {
    this.imageurl = URL.createObjectURL(blob);
    this.fullImageURL = this.imageurl + this.fullSampleSize;
  }

  // Note: There is a default value for orientation/mirrored since some
  // images don't have EXIF data to retrieve this information.
  this.rotation = rotation || 0;
  this.mirrored = mirrored || false;

  // Keep track of what kind of content we have
  this.displayingImage = true;

  // If a locale is present and ready, go ahead and localize now.
  // Otherwise, localization will be handled by the ready() callback above.
  if (navigator.mozL10n.readyState === 'complete') {
    this.localize();
  }

  // Determine whether we can use the preview image
  function usePreview(preview) {
    // If no preview at all, we can't use it.
    if (!preview)
      return false;

    // If we don't know the preview size, we can't use it.
    if (!preview.width || !preview.height)
      return false;

    // If there isn't a preview offset or file, we can't use it
    if (!preview.start && !preview.filename)
      return false;

    // If the aspect ratio does not match, we can't use it
    if (Math.abs(width / height - preview.width / preview.height) > 0.01)
      return false;

    // If setMinimumPreviewSize has been called, then a preview is big
    // enough if it is at least that big.
    if (self.minimumPreviewWidth && self.minimumPreviewHeight) {
      return Math.max(preview.width, preview.height) >=
        Math.max(self.minimumPreviewWidth, self.minimumPreviewHeight) &&
        Math.min(preview.width, preview.height) >=
        Math.min(self.minimumPreviewWidth, self.minimumPreviewHeight);
    }

    // Otherwise a preview is big enough if at least one dimension is >= twice
    // of the screen size in both portrait and landscape mode.
    var screenWidth = window.innerWidth * window.devicePixelRatio;
    var screenHeight = window.innerHeight * window.devicePixelRatio;

    return ((preview.width >= 2 * screenWidth ||
             preview.height >= 2 * screenHeight) && // portrait
            (preview.width >= 2 * screenHeight ||
             preview.height >= 2 * screenWidth));  // landscape
  }

  // To save memory, we want to avoid displaying the image at full size
  // whenever we can display a smaller preview of it. In general, we only
  // want to decode the full-size image if the user zooms in on it.
  // This code determines whether we have a usable preview image (or whether
  // we can downsample the full-size image) and if so, displays that image
  if (usePreview(preview)) {
    if (preview.start) {
      gotPreview(blob.slice(preview.start, preview.end, 'image/jpeg'),
                 preview.width, preview.height);
    }
    else {
      var storage = navigator.getDeviceStorage('pictures');
      var getreq = storage.get(preview.filename);
      getreq.onsuccess = function() {
        gotPreview(getreq.result, preview.width, preview.height);
      };
      getreq.onerror = function() {
        noPreview();
      };
    }
  }
  else {
    noPreview();
  }

  // If we've got a usable preview blob from EXIF or an external file,
  // this is what we do with it.
  function gotPreview(previewblob, previewWidth, previewHeight) {
    // Create a blob URL for the preview
    self.previewurl = URL.createObjectURL(previewblob);
    // In this case previewImageURL is the same as previewurl. In some other
    // cases, previewImageURL may have a media fragment appended, so we need
    // two distinct properties, however.
    self.previewImageURL = self.previewurl;

    // Remember the preview size
    self.previewWidth = previewWidth;
    self.previewHeight = previewHeight;

    // Start off with the preview image displayed
    self.displayingPreview = true;
    self._displayImage(self.previewImageURL,
                       self.previewWidth, self.previewHeight);
  }

  // If we don't have a preview image we can use this is what we do.
  function noPreview() {
    self.previewurl = null;
    // Figure out whether we can downsample the fullsize image for
    // use as a preview
    var previewSampleSize = computePreviewSampleSize(blob, width, height);

    // If we can create a preview by downsampling...
    if (previewSampleSize !== Downsample.NONE) {
      // Combine the full image url with the downsample media fragment
      // to create a url for the downsampled preview.
      self.previewImageURL = self.imageurl + previewSampleSize;
      // Compute the preview size based on the downsample amount.
      self.previewWidth = previewSampleSize.scale(width);
      self.previewHeight = previewSampleSize.scale(height);

      // Now start off with the downsampled image displayed
      self.displayingPreview = true;
      self._displayImage(self.previewImageURL,
                         self.previewWidth, self.previewHeight);
    }
    else {
      // If we can't (or don't need to) downsample the full image then note
      // that we don't have a preview and display the image at full size.
      self.previewImageURL = null;
      self.displayingPreview = false;
      self._displayImage(self.fullImageURL,
                         self.fullsizeWidth, self.fullsizeHeight);
    }
  }

  // If the blob is a JPEG then we can use #-moz-samplesize to downsample
  // it while decoding. If this is a particularly large image then to avoid
  // OOMs, we may not want to allow it to ever be decoded at full size
  function computeFullSampleSize(blob, width, height) {
    if (blob.type !== 'image/jpeg') {
      // We're not using #-moz-samplesize at all
      return Downsample.NONE;
    }

    // Determine the maximum size we will decode the image at, based on
    // device memory and the maximum size passed to the constructor.
    var max = MediaFrame.maxImageDecodeSize || 0;
    if (self.maximumImageSize && (max === 0 || self.maximumImageSize < max)) {
      max = self.maximumImageSize;
    }

    if (!max || width * height <= max) {
      return Downsample.NONE;
    }

    return Downsample.areaAtLeast(max / (width * height));
  }

  function computePreviewSampleSize(blob, width, height) {
    // If the image is not a JPEG we can't use a samplesize
    if (blob.type !== 'image/jpeg') {
      return Downsample.NONE;
    }

    //
    // Determine how much we can scale the image down and still have it
    // big enough to fill the screen in at least one dimension.
    //
    // For example, suppose we have a 1600x1200 photo and a 320x480 screen
    //
    //  portraitScale = Math.min(.2, .4) = 0.2
    //  landscapeScale = Math.min(.3, .266) = 0.266
    //  scale = 0.266
    //
    var screenWidth = window.innerWidth * window.devicePixelRatio;
    var screenHeight = window.innerHeight * window.devicePixelRatio;

    // To display the image in portrait orientation, this is how much we
    // have to scale it down to ensure that both dimensions fit
    var portraitScale = Math.min(screenWidth / width, screenHeight / height);

    // To display the image in landscape, this is we need to scale it
    // this much
    var landscapeScale = Math.min(screenHeight / width, screenWidth / height);

    // We need an image that is big enough in either orientation
    var scale = Math.max(portraitScale, landscapeScale);

    // Return the largest samplesize that still produces a big enough preview
    return Downsample.sizeNoMoreThan(scale);
  }
};

// An internal method to set the url and size of the img element and to
// reposition the image appropriately. We use this when first displaying an
// image and when switching from the preview image to the full image and back.
// The url argument is used as the img.src. The bg argument, if specified, is
// a URL used for the CSS background-image property.  This is useful for
// switching from a preview image to a full-size image (when the user zooms
// in) without a flash while the full-size image is decoded.
MediaFrame.prototype._displayImage = function(url, width, height, bg) {
  // If a background was specfied, use it. If this is the preview image URL
  // and it is already decoded, it gives us something to display while the
  // full-size image is decoding.
  if (bg) {
    this.image.style.backgroundImage = 'url(' + bg + ')';
  }
  else {
    this.image.style.backgroundImage = 'none';
  }

  // Start loading and decoding the main image
  this.image.src = url;
  this.image.classList.add('displayframe');
  // Remember the width and height, but swap them for rotated images.
  if (this.rotation == 0 || this.rotation == 180) {
    this.itemWidth = width;
    this.itemHeight = height;
  } else {
    this.itemWidth = height;
    this.itemHeight = width;
  }

  // The image div has a new size, so we have to change its transform
  this.computeFit();
  this.setPosition();

  // Query the position of the image in order to flush the changes
  // made by setPosition() above. This prevents us from accidentally
  // animating those changes when the user double taps to zoom.
  var temp = this.image.clientLeft;
};

// This function adds a label for accessibility to the image frame.
// Videos are localized within the video player, so this is only for images.
MediaFrame.prototype.localize = function localize() {
  if (!this.displayingImage) {
    return;
  }

  var portrait = this.fullsizeWidth < this.fullsizeHeight;
  if (this.rotation == 90 || this.rotation == 270) {
    // If rotated sideways, the width and height are swapped.
    portrait = !portrait;
  }

  var timestamp = this.imageblob.lastModifiedDate;
  var orientation = navigator.mozL10n.get(
    portrait ? 'orientationPortrait' : 'orientationLandscape');
  var label = '';

  if (timestamp) {
    var locale_entry = navigator.mozL10n.get(
      'imageDescription', { orientation: orientation });

    if (!this.dtf) {
      this.dtf = new navigator.mozL10n.DateTimeFormat();
    }

    label = this.dtf.localeFormat(new Date(timestamp), locale_entry);
  } else {
    label = navigator.mozL10n.get(
      'imageDescriptionNoTimestamp', { orientation: orientation });
  }

  this.image.setAttribute('aria-label', label);
};

MediaFrame.prototype._switchToFullSizeImage = function _switchToFull() {
  if (!this.displayingImage || !this.displayingPreview)
    return;
  this.displayingPreview = false;
  this._displayImage(this.fullImageURL,
                     this.fullsizeWidth, this.fullsizeHeight,
                     this.previewImageURL);
};

MediaFrame.prototype._switchToPreviewImage = function _switchToPreview() {
  // If we're not displaying an image or already displaying preview
  // or don't have a preview to display then there is nothing to do.
  if (!this.displayingImage || this.displayingPreview ||
      !this.previewImageURL) {
    return;
  }

  this.displayingPreview = true;
  this._displayImage(this.previewImageURL,
                     this.previewWidth, this.previewHeight);
};

MediaFrame.prototype.displayVideo = function displayVideo(videoblob, posterblob,
                                                          width, height,
                                                          rotation)
{
  if (!this.video)
    return;

  this.clear();  // reset everything

  // Keep track of what kind of content we have
  this.displayingVideo = true;

  // Remember the blobs
  this.videoblob = videoblob;
  this.posterblob = posterblob;

  // Get new URLs for the blobs
  this.videourl = URL.createObjectURL(videoblob);
  this.posterurl = URL.createObjectURL(posterblob);

  // Display them in the video element.
  // The VideoPlayer class takes care of positioning itself, so we
  // don't have to do anything here with computeFit() or setPosition()
  this.video.load(this.videourl, this.posterurl, width, height, rotation || 0,
                  videoblob.lastModifiedDate);

  // Show the player controls
  this.video.show();
};

// Reset the frame state, release any urls and and hide everything
MediaFrame.prototype.clear = function clear() {
  // Reset the saved state
  this.displayingImage = false;
  this.displayingPreview = false;
  this.displayingVideo = false;
  this.itemWidth = this.itemHeight = null;
  this.imageblob = null;
  this.videoblob = null;
  this.posterblob = null;
  this.fullSampleSize = null;
  this.fullImageURL = null;
  this.previewImageURL = null;
  this.fullsizeWidth = this.fullsizeHeight = null;
  this.previewWidth = this.previewHeight = null;
  this.fit = null;

  if (this.imageurl) {
    URL.revokeObjectURL(this.imageurl);
  }
  this.imageurl = null;

  if (this.previewurl) {
    URL.revokeObjectURL(this.previewurl);
  }
  this.previewurl = null;

  // hide the image and release anything it was displaying
  if (this.image) {
    this.image.style.opacity = 0;
    this.image.style.backgroundImage = 'none';
    this.image.src = '';
    this.image.removeAttribute('aria-label');
  }

  // Hide the video player
  if (this.video) {
    this.video.reset();
    this.video.hide();
    if (this.videourl)
      URL.revokeObjectURL(this.videourl);
    this.videourl = null;
    if (this.posterurl)
      URL.revokeObjectURL(this.posterurl);
    this.posterurl = null;
  }
};

// Set the item's position based on this.fit
// The VideoPlayer object fits itself to its container, and it
// can't be zoomed or panned, so we only need to do this for images
MediaFrame.prototype.setPosition = function setPosition(zoom) {
  if (!this.fit || !this.displayingImage)
    return;

  var dx = this.fit.left, dy = this.fit.top;

  // We have to adjust the translation to account for the fact that the
  // scaling is being done around the middle of the image, rather than the
  // upper-left corner.  And we have to make this adjustment differently
  // for different rotations.
  switch (this.rotation) {
  case 0:
  case 180:
    dx += (this.fit.width - this.itemWidth) / 2;
    dy += (this.fit.height - this.itemHeight) / 2;
    break;
  case 90:
  case 270:
    dx += (this.fit.width - this.itemHeight) / 2;
    dy += (this.fit.height - this.itemWidth) / 2;
    break;
  }

  var sx = this.mirrored ? -this.fit.scale : this.fit.scale;
  var sy = this.fit.scale;

  var transform =
    'translate(' + dx + 'px, ' + dy + 'px) ' +
    'scale(' + sx + ',' + sy + ')' +
    'rotate(' + this.rotation + 'deg) ';

  this.image.style.transform = transform;
  if(!zoom) {
    this.image.setAttribute('data-origin-scale',this.fit.scale);
    this.image.setAttribute('data-scale-delta',this.fit.scale/5);
    this.image.setAttribute('data-zoom-in',0);
    this.image.setAttribute('data-zoom-out',0);
  }
};

MediaFrame.prototype.computeFit = function computeFit() {
  if (!this.displayingImage)
    return;
  this.viewportWidth = this.container.offsetWidth;
  this.viewportHeight = this.container.offsetHeight;

  var scalex = this.viewportWidth / this.itemWidth;
  var scaley = this.viewportHeight / this.itemHeight;
  var scale = Math.min(Math.min(scalex, scaley), 1);

  // Set the image size and position
  var width = Math.floor(this.itemWidth * scale);
  var height = Math.floor(this.itemHeight * scale);

  this.fit = {
    width: width,
    height: height,
    left: Math.floor((this.viewportWidth - width) / 2),
    top: Math.floor((this.viewportHeight - height) / 2),
    scale: scale,
    baseScale: scale
  };
};

MediaFrame.prototype.reset = function reset() {
  // If we're not displaying the preview image, but we have one,
  // and it is the right size, then switch to it
  if (this.displayingImage && !this.displayingPreview &&
      this.previewImageURL) {
    this._switchToPreviewImage(); // resets image size and position
    return;
  }

  // Otherwise, just resize and position the item we're already displaying
  this.computeFit();
  this.setPosition();
  // If frame is resized, the video's size also need to reset.
  if (this.displayingVideo)
    this.video.setPlayerSize();
};

// We call this from the resize handler when the user rotates the
// screen or when going into or out of fullscreen mode. If the user
// has not zoomed in, then we just fit the image to the new size (same
// as reset).  But if the user has zoomed in (and we need to stay
// zoomed for the new size) then we adjust the fit properties so that
// the pixel that was at the center of the screen before remains at
// the center now, or as close as possible
MediaFrame.prototype.resize = function resize() {
  var oldWidth = this.viewportWidth;
  var oldHeight = this.viewportHeight;
  var newWidth = this.container.offsetWidth;
  var newHeight = this.container.offsetHeight;

  var oldfit = this.fit; // The current image fit

  // If this is triggered by a resize event before the frame has computed
  // its size, then there is nothing we can do yet.
  if (!oldfit)
    return;

  // Compute the new fit.
  // This updates the the viewportWidth, viewportHeight and fit properties
  this.computeFit();

  // This is how the image would fit at the new screen size
  var newfit = this.fit;

  // If no zooming has been done (or almost no zooming), then a resize is just
  // a reset. The same is true if the new fit base scale is greater than the
  // old scale.
  // The scale is calculated with division, the value may not be accurate
  // because of IEEE 754. We use abs difference to do the equality checking.
  if (Math.abs(oldfit.scale - oldfit.baseScale) < 0.01 ||
      newfit.baseScale > oldfit.scale) {

    this.reset();
    return;
  }

  // Otherwise, just adjust the old fit as needed and use that so we
  // retain the zoom factor.
  oldfit.left += (newWidth - oldWidth) / 2;
  oldfit.top += (newHeight - oldHeight) / 2;
  oldfit.baseScale = newfit.baseScale;
  this.fit = oldfit;

  // Reposition this image without resetting the zoom
  this.setPosition();
};

// Zoom in by the specified factor, adjusting the pan amount so that
// the image pixels at (fixedX, fixedY) remain at that position.
// Assume that zoom gestures can't be done in the middle of swipes, so
// if we're calling zoom, then the swipe property will be 0.
// If time is specified and non-zero, then we set a CSS transition
// to animate the zoom.
MediaFrame.prototype.zoom = function zoom(scale, fixedX, fixedY, time) {
  // Ignore zooms if we're not displaying an image
  if (!this.displayingImage)
    return;

  // If we were displaying the preview switch to the full-size image.
  if (this.displayingPreview)
    this._switchToFullSizeImage();

  // Never zoom in farther than the native resolution of the image
  if (this.fit.scale * scale > 1) {
    scale = 1 / (this.fit.scale);
  }
  // And never zoom out to make the image smaller than it would normally be
  else if (this.fit.scale * scale < this.fit.baseScale) {
    scale = this.fit.baseScale / this.fit.scale;
  }

  this.fit.scale = this.fit.scale * scale;

  // Change the size of the photo
  this.fit.width = Math.floor(this.itemWidth * this.fit.scale);
  this.fit.height = Math.floor(this.itemHeight * this.fit.scale);

  // fixedX and fixedY are in viewport coordinates.
  // These are the photo coordinates displayed at that point in the viewport
  var photoX = fixedX - this.fit.left;
  var photoY = fixedY - this.fit.top;

  // After zooming, these are the new photo coordinates.
  // Note we just use the relative scale amount here, not this.fit.scale
  photoX = Math.floor(photoX * scale);
  photoY = Math.floor(photoY * scale);

  // To keep that point still, here are the new left and top values we need
  this.fit.left = fixedX - photoX;
  this.fit.top = fixedY - photoY;

  // Now make sure we didn't pan too much: If the image fits on the
  // screen, fixed it. If the image is bigger than the screen, then
  // make sure we haven't gone past any edges
  if (this.fit.width <= this.viewportWidth) {
    this.fit.left = (this.viewportWidth - this.fit.width) / 2;
  }
  else {
    // Don't let the left of the photo be past the left edge of the screen
    if (this.fit.left > 0)
      this.fit.left = 0;

    // Right of photo shouldn't be to the left of the right edge
    if (this.fit.left + this.fit.width < this.viewportWidth) {
      this.fit.left = this.viewportWidth - this.fit.width;
    }
  }

  if (this.fit.height <= this.viewportHeight) {
    this.fit.top = (this.viewportHeight - this.fit.height) / 2;
  }
  else {
    // Don't let the top of the photo be below the top of the screen
    if (this.fit.top > 0)
      this.fit.top = 0;

    // bottom of photo shouldn't be above the bottom of screen
    if (this.fit.top + this.fit.height < this.viewportHeight) {
      this.fit.top = this.viewportHeight - this.fit.height;
    }
  }

  // If a time was specified, set up a transition so that the
  // call to setPosition() below is animated
  if (time) {
    // If a time was specfied, animate the transformation
    var transition = 'transform ' + time + 'ms ease';
    this.image.style.transition = transition;

    var self = this;
    this.image.addEventListener('transitionend', function done() {
      self.image.removeEventListener('transitionend', done);
      self.image.style.transition = '';
    });
  }

  this.setPosition();
};

MediaFrame.prototype.zoomFrame = function zoomFrame(scale, fixedX, fixedY, time) {
  // Ignore zooms if we're not displaying an image
  if (!this.displayingImage)
    return;

  // If we were displaying the preview switch to the full-size image.
  if (this.displayingPreview)
    this._switchToFullSizeImage();

  this.fit.scale = scale;

  var overflowx = Math.abs(this.fit.width - this.viewportWidth);
  var overflowy = Math.abs(this.fit.height - this.viewportHeight);
  if(this.fit.left >0 || this.fit.width <= this.viewportWidth) {
    var ratiol = 0.5 ;
  }else {
    var ratiol = Math.abs(this.fit.left/overflowx);
  }
  if(this.fit.top >0 || this.fit.height <= this.viewportHeight) {
    var ratiot = 0.5;
  }else {
    var ratiot = Math.abs(this.fit.top/overflowy);
  }



  // Change the size of the photo
  this.fit.width = Math.floor(this.itemWidth * this.fit.scale);
  this.fit.height = Math.floor(this.itemHeight * this.fit.scale);

  // fixedX and fixedY are in viewport coordinates.
  // These are the photo coordinates displayed at that point in the viewport
  var photoX = fixedX - this.fit.left;
  var photoY = fixedY - this.fit.top;


  // After zooming, these are the new photo coordinates.
  // Note we just use the relative scale amount here, not this.fit.scale
  photoX = Math.floor(photoX * scale);
  photoY = Math.floor(photoY * scale);

  // To keep that point still, here are the new left and top values we need
  this.fit.left = fixedX - photoX;
  this.fit.top = fixedY - photoY;

  // Now make sure we didn't pan too much: If the image fits on the
  // screen, fixed it. If the image is bigger than the screen, then
  // make sure we haven't gone past any edges
  if (this.fit.width <= this.viewportWidth) {
    this.fit.left = (this.viewportWidth - this.fit.width) / 2;
  }
  else {
    // Don't let the left of the photo be past the left edge of the screen
    if (this.fit.left > 0)
      this.fit.left = 0;

    // Right of photo shouldn't be to the left of the right edge
    if (Math.abs(this.fit.left) + this.fit.width < this.viewportWidth) {
      this.fit.left = this.viewportWidth - this.fit.width;
    }else {
      this.fit.left = (this.viewportWidth - this.fit.width) * ratiol;
    }
  }

  if (this.fit.height <= this.viewportHeight) {
    this.fit.top = (this.viewportHeight - this.fit.height) / 2;
  }
  else {
    // Don't let the top of the photo be below the top of the screen
    if (this.fit.top > 0)
      this.fit.top = 0;

    // bottom of photo shouldn't be above the bottom of screen
    if (Math.abs(this.fit.top) + this.fit.height < this.viewportHeight) {
      this.fit.top = this.viewportHeight - this.fit.height;
    }else {
      this.fit.top = (this.viewportHeight - this.fit.height) * ratiot;
    }
  }

  // If a time was specified, set up a transition so that the
  // call to setPosition() below is animated
  if (time) {
    // If a time was specfied, animate the transformation
    var transition = 'transform ' + time + 'ms ease';
    this.image.style.transition = transition;

    var self = this;
    this.image.addEventListener('transitionend', function done() {
      self.image.removeEventListener('transitionend', done);
      self.image.style.transition = null;
    });
  }

  this.setPosition(true);
};

// If the item being displayed is larger than the continer, pan it by
// the specified amounts.  Return the "unused" dx amount for the gallery app
// to use for sideways swiping
MediaFrame.prototype.pan = function(dx, dy) {
  // We can only pan images, so return the entire dx amount
  if (!this.displayingImage) {
    return dx;
  }

  // Handle panning in the y direction first, since it is easier.
  // Don't pan in the y direction if we already fit on the screen
  if (this.fit.height > this.viewportHeight) {
    this.fit.top += dy;

    // Don't let the top of the photo be below the top of the screen
    if (this.fit.top > 0)
      this.fit.top = 0;

    // bottom of photo shouldn't be above the bottom of screen
    if (this.fit.top + this.fit.height < this.viewportHeight)
      this.fit.top = this.viewportHeight - this.fit.height;
  }

  // Now handle the X dimension. If we've already panned as far as we can
  // within the image (or if it isn't zoomed in) then return the "extra"
  // unused dx amount to the caller so that the caller can use them to
  // shift the frame left or right.
  var extra = 0;

  if (this.fit.width <= this.viewportWidth) {
    // In this case, the photo isn't zoomed in, so it is all extra
    extra = dx;
  }
  else {
    this.fit.left += dx;

    // If this would take the left edge of the photo past the
    // left edge of the screen, then some of the motion is extra
    if (this.fit.left > 0) {
      extra = this.fit.left;
      this.fit.left = 0;
    }

    // Or, if this would take the right edge of the photo past the
    // right edge of the screen, then we've got extra.
    if (this.fit.left + this.fit.width < this.viewportWidth) {
      extra = this.fit.left + this.fit.width - this.viewportWidth;
      this.fit.left = this.viewportWidth - this.fit.width;
    }
  }

  this.setPosition(true);
  return extra;
};

MediaFrame.prototype.setMinimumPreviewSize = function(w, h) {
  this.minimumPreviewWidth = w;
  this.minimumPreviewHeight = h;
};

'use strict';
let frames = $('frames');
let previousFrame = null;
let currentFrame = null;
let nextFrame = null;
let maxImageSize = CONFIG_MAX_IMAGE_PIXEL_SIZE;
let transitioning = false;
let frameOffset = 0;
window.addEventListener('moveframe', moveFrameHandler);
function removeTransition(event) {
  event.target.style.transition = null;
}

function initFrames() {
  previousFrame = new MediaFrame($('frame1'), false, maxImageSize);
  currentFrame = new MediaFrame($('frame2'), false, maxImageSize);
  nextFrame = new MediaFrame($('frame3'), false, maxImageSize);
  if (CONFIG_REQUIRED_EXIF_PREVIEW_WIDTH) {
    previousFrame.setMinimumPreviewSize(CONFIG_REQUIRED_EXIF_PREVIEW_WIDTH,
      CONFIG_REQUIRED_EXIF_PREVIEW_HEIGHT);
    currentFrame.setMinimumPreviewSize(CONFIG_REQUIRED_EXIF_PREVIEW_WIDTH,
      CONFIG_REQUIRED_EXIF_PREVIEW_HEIGHT);
    nextFrame.setMinimumPreviewSize(CONFIG_REQUIRED_EXIF_PREVIEW_WIDTH,
      CONFIG_REQUIRED_EXIF_PREVIEW_HEIGHT);
  }
  previousFrame.container.addEventListener('transitionend', removeTransition);
  currentFrame.container.addEventListener('transitionend', removeTransition);
  nextFrame.container.addEventListener('transitionend', removeTransition);
}

// Resize all the frames' content, if its container's size is changed
function resizeFrames() {
  if (!currentFrame) {
    return;
  }
  nextFrame.reset();
  previousFrame.reset();
  currentFrame.reset();
}

// transform handler for new keyboard engine
function moveFrameHandler(e) {
  if (photodb.parsingBigFiles)
    return;
  var deltax = 6
  switch(e.detail.keyId) {
    case 0:
      currentFrame.pan(deltax,0);
      break;
    case 1:
      currentFrame.pan(-deltax,0);
      break;
    case 2:
      currentFrame.pan(0,deltax);
      break;
    case 3:
      currentFrame.pan(0,-deltax);
      break;
  }
}

// A utility function to display the nth image in the specified frame
// Used in showFile(), nextFile() and previousFile().
function setupFrameContent(n, frame) {
  // Make sure n is in range
  if (n < 0) {
    frame.clear();
    delete frame.filename;
    return;
  }

  let fileinfo = FilesStore.getFileInfo(n);

  // If we're already displaying this file in this frame, then do nothing
  if (fileinfo.name === frame.filename) {
    return;
  }

  // Remember what file we're going to display
  frame.filename = fileinfo.name;

  photodb.getFile(fileinfo.name, function(imagefile) {
    frame.displayImage(
      imagefile,
      fileinfo.metadata.width,
      fileinfo.metadata.height,
      fileinfo.metadata.preview,
      fileinfo.metadata.rotation,
      fileinfo.metadata.mirrored,
      fileinfo.metadata.largeSize);
  });
}

var FRAME_BORDER_WIDTH = 3;

function setFramesPosition() {
  var width = window.innerWidth + FRAME_BORDER_WIDTH;
  currentFrame.container.style.transform =
    'translateX(' + frameOffset + 'px)';
  if (lowMemory) {
    currentFrame.image.setAttribute('animationMode', 'dontanim');
    nextFrame.image.setAttribute('animationMode', 'dontanim');
    previousFrame.image.setAttribute('animationMode', 'dontanim');
  }

  if (navigator.mozL10n.language.direction === 'ltr') {
    nextFrame.container.style.transform =
      'translateX(' + (frameOffset + width) + 'px)';
    previousFrame.container.style.transform =
      'translateX(' + (frameOffset - width) + 'px)';
  }
  else {
    // For RTL languages we swap next and previous sides
    nextFrame.container.style.transform =
      'translateX(' + (frameOffset - width) + 'px)';
    previousFrame.container.style.transform =
      'translateX(' + (frameOffset + width) + 'px)';
  }

  // XXX Bug 1021782 add 'current' class to currentFrame
  nextFrame.container.classList.remove('current');
  previousFrame.container.classList.remove('current');
  currentFrame.container.classList.add('current');

  // Hide adjacent frames from screen reader
  nextFrame.container.setAttribute('aria-hidden', true);
  previousFrame.container.setAttribute('aria-hidden', true);
  currentFrame.container.removeAttribute('aria-hidden');
}

function resetFramesPosition() {
  frameOffset = 0;
  setFramesPosition();
}

function updateFrames (n) {
  if (!currentFrame) {
    initFrames();
  }
  setupFrameContent(Gallery.getPrevFileIndex(false), previousFrame);
  setupFrameContent(n, currentFrame);
  setupFrameContent(Gallery.getNextFileIndex(false), nextFrame);
  resetFramesPosition();
  Favorite.createPreviewFavoriteDiv();
}

function clearFrames() {
  previousFrame.clear();
  currentFrame.clear();
  nextFrame.clear();
  delete previousFrame.filename;
  delete currentFrame.filename;
  delete nextFrame.filename;
}

// Transition to the next file, animating it over the specified time (ms).
// This is used when the user pans.
function nextFile(time) {
  let thumbnailCount = 0;
  if (Favorite.isFavoriteList) {
    thumbnailCount = Favorite.getALLFavorites().length;
  } else {
    thumbnailCount = NavigationMap.listControls().length;
  }
  if (Gallery.currentFocusIndex === thumbnailCount - 1) {
    return;
  }
  let nextFileKey = Gallery.getNextFileIndex(false);
  if (nextFileKey === -1 || FilesStore.currentFileKey === nextFileKey) {
    return;
  }

  // Set a flag to ignore pan and zoom gestures during the transition.
  transitioning = true;
  setTimeout(function() { transitioning = false; }, time);

  // Set transitions for the visible frames
  var transition = 'transform ' + time + 'ms ease';
  currentFrame.container.style.transition = transition;
  nextFrame.container.style.transition = transition;

  // Cycle the three frames so next becomes current,
  // current becomes previous, and previous becomes next.
  var tmp = previousFrame;
  previousFrame = currentFrame;
  currentFrame = nextFrame;
  nextFrame = tmp;
  FilesStore.currentFileKey = Gallery.getNextFileIndex(true);
  nextFileKey = Gallery.getNextFileIndex(false);
  // Move (transition) the frames to their new position
  resetFramesPosition();

  // Update the frame for the new next item
  setupFrameContent(nextFileKey, nextFrame);

  // When the transition is done, cleanup
  currentFrame.container.addEventListener('transitionend', function done(e) {
    this.removeEventListener('transitionend', done);

    // Reposition the item that just transitioned off the screen
    // to reset any zooming and panning
    previousFrame.reset();
  });
  Favorite.createPreviewFavoriteDiv();
}

// Just like nextFile() but in the other direction
function previousFile(time) {
  // if already displaying the first one, do nothing.
  if (Gallery.currentFocusIndex === 0) {
    return;
  }
  let previousFileKey = Gallery.getPrevFileIndex(false);
  if (previousFileKey === -1 || FilesStore.currentFileKey === previousFileKey) {
    return;
  }

  // Set a flag to ignore pan and zoom gestures during the transition.
  transitioning = true;
  setTimeout(function() { transitioning = false; }, time);

  // Set transitions for the visible frames
  var transition = 'transform ' + time + 'ms ease';
  previousFrame.container.style.transition = transition;
  currentFrame.container.style.transition = transition;

  // Transition to the previous item: previous becomes current, current
  // becomes next, etc.
  var tmp = nextFrame;
  nextFrame = currentFrame;
  currentFrame = previousFrame;
  previousFrame = tmp;
  FilesStore.currentFileKey = Gallery.getPrevFileIndex(true);
  previousFileKey = Gallery.getPrevFileIndex(false);
  // Move (transition) the frames to their new position
  resetFramesPosition();

  // Preload the new previous item
  setupFrameContent(previousFileKey, previousFrame);

  // When the transition is done do some cleanup
  currentFrame.container.addEventListener('transitionend', function done(e) {
    this.removeEventListener('transitionend', done);
    // Reset the size and position of the item that just panned off
    nextFrame.reset();
  });
  Favorite.createPreviewFavoriteDiv();
}
var ZOOM_IN_LIMIT = 9;
var ZOOM_OUT_LIMIT = 0;

function zoomOut(){
  var scaleDelta = parseFloat(currentFrame.image.getAttribute('data-scale-delta'));
  var zoomInTimes = parseInt(currentFrame.image.getAttribute('data-zoom-in'));
  var zoomOutTimes = parseInt(currentFrame.image.getAttribute('data-zoom-out'));
  var scale = currentFrame.fit.scale;
  if(zoomOutTimes >= ZOOM_OUT_LIMIT) {
    return false;
  }
  zoomOutTimes ++;
  zoomInTimes --;
  updateZoomData(zoomInTimes,zoomOutTimes);
  scale=scale - scaleDelta;
  currentFrame.zoomFrame(scale, 0, 0);
  return zoomOutTimes >= ZOOM_OUT_LIMIT?false:true;
}
function zoomIn(){
  var scaleDelta = parseFloat(currentFrame.image.getAttribute('data-scale-delta'));
  var zoomInTimes = parseInt(currentFrame.image.getAttribute('data-zoom-in'));
  var zoomOutTimes = parseInt(currentFrame.image.getAttribute('data-zoom-out'));
  var scale = currentFrame.fit.scale;
  if(zoomInTimes >= ZOOM_IN_LIMIT) {
    return false;
  }
  zoomInTimes ++;
  zoomOutTimes --;
  updateZoomData(zoomInTimes,zoomOutTimes);
  scale=scale + scaleDelta;
  currentFrame.image.classList.add("image-view-zoom");
  currentFrame.zoomFrame(scale, 0, 0);
  return zoomInTimes >= ZOOM_IN_LIMIT?false:true;
}
// update the attribute value of zoom data after we zoom in/out
function updateZoomData(inTimes,outTimes) {
  currentFrame.image.setAttribute('data-zoom-in',inTimes);
  currentFrame.image.setAttribute('data-zoom-out',outTimes);
}
// restore photo when back from zoom mode
function restoreFrame() {
  currentFrame.image.classList.remove("image-view-zoom");
  updateZoomData(0,0);
  backResize();
}

function zoomResize() {
  let container = currentFrame.container;
  container.parentNode.classList.add("frameFullScreen");
  container.favoriteNode.classList.add("framefull-status");
  currentFrame.computeFit();
  currentFrame.setPosition();
};

function backResize() {
  let container = currentFrame.container;
  container.parentNode.classList.remove("frameFullScreen");
  container.favoriteNode.classList.remove("framefull-status");
  currentFrame.computeFit();
  currentFrame.setPosition();
};
