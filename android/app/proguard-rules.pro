# Bus Jam Mobile — ProGuard / R8 Release Optimization Rules
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# Preserve Capacitor / WebView JS Bridge classes
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Strip debug logs in production release APK / AAB
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
}
