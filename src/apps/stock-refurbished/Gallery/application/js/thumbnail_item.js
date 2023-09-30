/**
 * ThumbnailItem is view object for a single gallery item data. It renders file
 * in listitem object.
 *
 * CONSTRUCTOR:
 *   To create a ThumbnailItem objet requires the following argument:
 *      fileData: the file data object from mediadb.
 *
 * Properties:
 *   htmlNode: the HTML DOM node for this thumbnail item. It is rendered at the
 *             creation of object.
 *   data: the file data object bound with this thumbnail item.
 */
function ThumbnailItem(fileData, fileKey) {
  if (!fileData) {
    throw new Error('fileData should not be null or undefined.');
  }
  this.data = fileData;

  this.htmlNode = document.createElement('div');
  this.htmlNode.classList.add('thumbnail');
  this.htmlNode.dataset.filename = fileData.name;
  this.htmlNode.setAttribute('data-columncount', Gallery.columnCount);

  this.imgNode = document.createElement('div');
  this.imgNode.classList.add('thumbnail-list-img');
  if (fileKey === 0 || fileKey) {
    this.imgNode.setAttribute('data-filesKeyCounter', fileKey);
  } else {
    this.imgNode.setAttribute('data-filesKeyCounter',
      FilesStore.filesKeyCounter);
  }
  this.imgNode.dataset.filename = fileData.name;
  this.imgNode.setAttribute('animationMode', 'dontanim');
  this.imgNode.fileData = fileData;
  this.imgNode.fileData.thumbnailContainer = this.imgNode;

  this.imgNodeOverlay = document.createElement('div');
  this.imgNodeOverlay.classList.add('thumbnail-list-img-overlay');
  createMultipleSelectInput(this.imgNode);
  this.imgNode.appendChild(this.imgNodeOverlay);

  if (fileData.metadata.largeSize) {
    this.htmlNode.classList.add('largeSize');
    const largeIcon = document.createElement('i');
    largeIcon.setAttribute('data-icon', 'exclamation');
    largeIcon.classList.add('thumbnail-list-img-large');
    this.imgNode.appendChild(largeIcon);
  }

  this.htmlNode.appendChild(this.imgNode);

  Favorite.createFavoriteDiv(this.imgNode,
    fileData.metadata.favorite, 'thumbnail-favorite-status');

  this.localize();
}

ThumbnailItem.formatter = new navigator.mozL10n.DateTimeFormat();

ThumbnailItem.prototype.localize = function() {
  var date = new Date(this.data.date);
  var description = navigator.mozL10n.get('imageDescriptionShort');
  var label = ThumbnailItem.formatter.localeFormat(date, description);
  this.htmlNode.setAttribute('aria-label', label);
  this.htmlNode.setAttribute('role', 'heading');
};
