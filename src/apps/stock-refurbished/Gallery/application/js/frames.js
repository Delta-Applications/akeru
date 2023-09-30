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
