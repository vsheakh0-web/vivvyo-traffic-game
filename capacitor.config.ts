/**
 * Capacitor Android Packaging Configuration for Bus Jam Mobile
 * Application ID: com.transitpuzzle.busjammobile
 */
const config = {
  appId: 'com.transitpuzzle.busjammobile',
  appName: 'Bus Jam Mobile',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#020617',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#020617',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#020617',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#020617',
    },
  },
};

export default config;
