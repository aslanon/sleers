{
  "targets": [
    {
      "target_name": "cursor_monitor",
      "sources": [ "cursor_monitor.mm" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15",
        "OTHER_CFLAGS": [
          "-arch arm64",
          "-arch x86_64"
        ],
        "OTHER_LDFLAGS": [
          "-arch arm64",
          "-arch x86_64",
          "-framework CoreGraphics",
          "-framework Cocoa"
        ]
      }
    }
  ]
}
