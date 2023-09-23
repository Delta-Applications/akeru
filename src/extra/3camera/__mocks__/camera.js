const Camera = {
  on: jest.fn(),
  setMode: jest.fn(),
  setCamera: jest.fn(),
  load: jest.fn(),
  release: jest.fn(),
  configureHardware: () => {
    return new Promise(resolve => {
      resolve();
    })
  },
  getFreeStorageSpace: () => {
    return new Promise(resolve => {
      resolve();
    })
  },
  checkStorageSpace: () => {
    return new Promise(resolve => {
      resolve();
    })
  }
};
export default Camera;
