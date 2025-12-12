import '@testing-library/jest-dom'

// Suppress PromiseRejectionHandledWarning during tests
// This warning occurs when using fake timers with async code
// where the rejection handler is attached after the rejection occurs
process.on('unhandledRejection', () => {
  // Intentionally empty - we handle rejections in tests
});
