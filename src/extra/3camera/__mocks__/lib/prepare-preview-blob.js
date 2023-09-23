const preparePreviewBlob = () => {
  return new Promise((resolve) => {
    let metadata = {
      blob: null,
      filePath: null
    };
    resolve(metadata);
  });
};
export default preparePreviewBlob;
