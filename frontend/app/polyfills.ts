// Polyfills for older iOS Safari versions (pre-15.4)

// Array.prototype.at — available from iOS 15.4+
if (!Array.prototype.at) {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Array.prototype, "at", {
    value: function at(this: unknown[], index: number) {
      const n = Math.trunc(index) || 0;
      const i = n < 0 ? this.length + n : n;
      return i < 0 || i >= this.length ? undefined : this[i];
    },
    writable: true,
    configurable: true
  });
}

// String.prototype.at — available from iOS 15.4+
if (!String.prototype.at) {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(String.prototype, "at", {
    value: function at(this: string, index: number) {
      const n = Math.trunc(index) || 0;
      const i = n < 0 ? this.length + n : n;
      return i < 0 || i >= this.length ? undefined : this[i];
    },
    writable: true,
    configurable: true
  });
}

// Object.hasOwn — available from iOS 15.4+
if (!Object.hasOwn) {
  Object.hasOwn = function hasOwn(obj: object, key: PropertyKey) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  };
}
