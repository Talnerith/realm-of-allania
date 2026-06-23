// Polyfill setImmediate for gRPC
global.setImmediate = global.setImmediate || ((fn, ...args) => global.setTimeout(fn, 0, ...args));

// Increase timeout for emulator connections
jest.setTimeout(30000);
