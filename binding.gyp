{
  "targets": [
    {
      "target_name": "cursor_manager",
      "sources": [
        "native/cursor_manager.mm"
      ],
      "include_dirs": [
        "<!(node -e \"require('node-addon-api').include\")"
      ],
      "libraries": [
        "-framework Cocoa"
      ],
      "xcode_settings": {
        "OTHER_CFLAGS": [
          "-fobjc-arc",
          "-x objective-c++",
          "-fexceptions",
          "-arch arm64"
        ],
        "CLANG_CXX_LIBRARY": "libc++",
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        "MACOSX_DEPLOYMENT_TARGET": "13.0",
        "ARCHS": ["arm64"],
        "VALID_ARCHS": ["arm64"]
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      }
    }
  ]
} 