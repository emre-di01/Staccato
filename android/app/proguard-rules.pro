# Capacitor WebView bridge — must not be obfuscated
-keep class com.getcapacitor.** { *; }
-keep class de.staccato.app.** { *; }

# Firebase / FCM
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
# Firebase Kotlin extensions are referenced but not bundled — suppress R8 missing-class errors
-dontwarn com.google.firebase.ktx.**
-dontwarn com.google.firebase.installations.ktx.**

# Annotations used by Capacitor plugins
-keepattributes *Annotation*
-keepattributes JavascriptInterface

# Prevent stripping of JS interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
