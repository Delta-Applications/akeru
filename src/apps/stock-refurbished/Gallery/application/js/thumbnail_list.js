/**
 * ThumbnailList is the class reponsible for rendering all gallery content in to
 * list. It uses GroupClass to group and sort file data as ThumbnailItem.
 *
 * Constructor:
 *    groupClass: the grouping class.
 *    container: the HTML DOM object for containing everything.
 *
 * API:
 *    addItem: add a file data and render it.
 *        item: the file data to add.
 *    removeItem: remove a ThumbnailItem.
 *        filename: the filename of file data.
 *    reset: clears all the internal data structure.
 *
 * Properties:
 *    thumbnailMap: a mapping of filename to ThumbnailItem.
 *    groupMap: a mapping of filename to thumbnail group.
 *    itemGroups: an sorted array of thumbnail group.
 *    count: the total ThumbnailItem in this list.
 *    groupClass: the grouping class this list used.
 *    container: the HTML DOM element containing this list.
 */
function ThumbnailList(groupClass, container) {
  if (!groupClass || !container) {
    throw new Error('group class or container cannot be null or undefined');
  }
  // the group list
  this.itemGroups = [];
  this.groupClass = groupClass;
  this.container = container;
};

ThumbnailList.prototype.findGroup = function(fileInfo) {
  var group = {
    groupID: ThumbnailDateGroup.getGroupID(fileInfo)
  };
  var index = this.itemGroups.bsearch(group, (a, b) => {
      return ThumbnailDateGroup.compareGroupID(b.groupID, a.groupID);
    });
  return index !== -1 ? this.itemGroups[index] : null;
};

ThumbnailList.prototype.findThumbnail = function(fileInfo) {
  var group = this.findGroup(fileInfo);
  if(group) {
    var index = group.getIndex(fileInfo);
    if(-1 !== index)
      return group.container.children[index];
  }
  return null;
};

ThumbnailList.prototype.addItem = function(item, fileKey) {
  if (!item) {
    return null;
  }
  var self = this;
  function createItemGroup(item, before) {
    var group = new self.groupClass(item);

    self.container.insertBefore(group.htmlNode,
                                 before ? before.htmlNode : null);
    return group;
  }

  function getItemGroup(item) {
    var groupID = self.groupClass.getGroupID(item);
    var i;
    for (i = 0; i < self.itemGroups.length; i++) {
      if (self.itemGroups[i].groupID === groupID) {
        return self.itemGroups[i];
      } else if (self.groupClass.compareGroupID(self.itemGroups[i].groupID,
                                                 groupID) < 0) {
        // existing ID is less than current groupID, stop searching/
        break;
      }
    }
    var createdGroup = createItemGroup(item, self.itemGroups[i]);
    self.itemGroups.splice(i, 0, createdGroup);
    return createdGroup;
  }

  var group = getItemGroup(item);
  let thumbnail = group.addItem(item, fileKey);

  return thumbnail;
};

ThumbnailList.prototype.removeItem = function(fileInfo) {
  var group = this.findGroup(fileInfo);
  if(group) {
    group.removeItem(fileInfo);
    if (!group.getCount()) {
      this.container.removeChild(group.htmlNode);
      this.itemGroups.splice(this.itemGroups.indexOf(group), 1);
    }
  }
};

ThumbnailList.prototype.reset = function() {
  this.container.innerHTML = '';
  this.itemGroups = [];
};

ThumbnailList.prototype.resetThumbnail = function() {
  // reset Thumbnail List
  var self = this;
  self.reset();
  for (let [key, value] of FilesStore.filesStoreMap) {
    self.addItem(value, key);
  }
};

ThumbnailList.prototype.getAllThumbnails = function getAllThumbnails() {
  let allThumbnails = [];
  const groups = this.itemGroups;
  for (let i = 0; i < groups.length; i++) {
    const { thumbnails } = groups[i];
    allThumbnails = allThumbnails.concat(thumbnails);
  }
  return allThumbnails;
};
