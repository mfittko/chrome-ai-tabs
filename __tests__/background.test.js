import 'jest-chrome';

describe('background.js', () => {
  it('should not throw on load', () => {
    expect(() => {
      require('../background.js');
    }).not.toThrow();
  });
});
